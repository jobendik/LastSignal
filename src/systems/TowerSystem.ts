import type { Game } from "../core/Game";
import { Tower } from "../entities/Tower";
import type { Enemy } from "../entities/Enemy";
import type { TowerType } from "../core/Types";
import { towerDefinitions } from "../data/towers";
import { Projectile } from "../entities/Projectile";
import { Vector2 } from "../core/Vector2";
import {
  ENGINEER_DISABLED_REPAIR_BONUS,
  ENGINEER_REPAIR_STACK_CAP,
  ENGINEER_REPAIR_STACK_FACTOR,
  ENGINEER_TOWER_REPAIR_RATE,
  JAMMER_REPAIR_PENALTY,
  SABOTEUR_DISABLE_DURATION,
  SHIELD_TOWER_DAMAGE_REDUCTION,
  STRUCTURE_TARGET_PRIORITY,
  TOWER_BASE_HP,
  TOWER_CRITICAL_DAMAGE_MUL,
  TOWER_CRITICAL_FIRE_RATE_MUL,
  TOWER_CRITICAL_RANGE_MUL,
  TOWER_DAMAGED_FIRE_RATE_MUL,
  TOWER_HP_BY_TYPE,
  TOWER_HP_PER_LEVEL_MUL,
  WAVE_END_PASSIVE_HEAL_PCT,
} from "../core/Config";

/** Handles tower behavior: targeting, firing, specialization effects, upgrades, economy ticks. */
export class TowerSystem {
  list: Tower[] = [];
  /** Towers mid-sell-dissolve (removed from grid, still rendered briefly). */
  dissolving: Tower[] = [];
  selected: Tower | null = null;
  /** Tower disable timers keyed on tower ref. */
  disabled = new Map<Tower, number>();

  constructor(private readonly game: Game) {}

  reset(): void {
    this.list.length = 0;
    this.dissolving.length = 0;
    this.selected = null;
    this.disabled.clear();
  }

  buildCost(type: TowerType, c?: number, r?: number): number {
    const base = towerDefinitions[type].cost;
    const combo = c != null && r != null && this.hasComboDiscount(type, c, r) ? 0.9 : 1;
    let modCostMul = 1;
    for (const m of this.game.core.activeModifiers) {
      if (m.towerCostMul) modCostMul *= m.towerCostMul;
    }
    return Math.max(1, Math.floor(base * this.game.core.upgrades.towerBuildCostMul * combo * modCostMul));
  }

  canPlace(type: TowerType, c: number, r: number): { ok: boolean; reason?: string } {
    const def = towerDefinitions[type];
    if (!this.isTierUnlocked(type)) return { ok: false, reason: `Unlocks at wave ${this.unlockWave(type)}` };
    const limit = this.buildLimit(type);
    if (limit != null && this.list.filter((t) => t.type === type).length >= limit) {
      return { ok: false, reason: `Build limit ${limit}` };
    }
    if (this.game.core.credits < this.buildCost(type, c, r)) return { ok: false, reason: "Insufficient credits" };
    // Signal-territory gate: towers and harvesters can only be built on cells
    // that are inside the active signal network. This is what makes relay
    // expansion the central strategic loop on large maps.
    if (!this.game.grid.isCellInSignalCoverage(c, r)) {
      return { ok: false, reason: "Outside signal range" };
    }
    // Don't allow placement on top of an active strategic map point —
    // they own the tile until destroyed/depleted.
    if (this.game.strategicPoints) {
      const sp = this.game.strategicPoints.pointAtCell(c, r);
      if (sp && sp.state !== "destroyed" && sp.state !== "depleted") {
        return { ok: false, reason: "Strategic point" };
      }
    }
    const walkOk = this.game.grid.canPlaceTower(c, r, Boolean(def.requiresCrystal));
    if (!walkOk) return { ok: false, reason: "Invalid location" };
    // Check tile is currently empty / crystal as expected.
    const i = this.game.grid.idx(c, r);
    const cur = this.game.grid.cells[i];
    if (def.requiresCrystal && cur !== 4 /* crystal */) return { ok: false, reason: "Requires crystal" };
    if (!def.requiresCrystal && cur !== 0 /* empty */) return { ok: false, reason: "Occupied" };
    return { ok: true };
  }

  place(type: TowerType, c: number, r: number): Tower | null {
    const check = this.canPlace(type, c, r);
    if (!check.ok) return null;
    const comboDiscount = this.hasComboDiscount(type, c, r);
    const cost = this.buildCost(type, c, r);
    if (!this.game.spendCredits(cost)) return null;
    const def = towerDefinitions[type];
    const t = new Tower(type, c, r, cost);
    this.applyDurabilityAggregate(t);
    this.list.push(t);
    this.game.grid.placeTower(c, r, type, Boolean(def.isEco));
    this.game.audio.sfxBuild(t.pos);
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, def.color, 10, { speed: 80, life: 0.5 });
    if (comboDiscount) {
      this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 24, "COMBO -10%", "#00e676", 0.9, 12);
      this.game.particles.spawnRing(t.pos.x, t.pos.y, 34, "#00e676");
    }
    this.game.bus.emit("tower:built", t);
    return t;
  }

  /** Apply current upgrade aggregate values to a tower's durability. */
  applyDurabilityAggregate(t: Tower): void {
    const up = this.game.core.upgrades;
    const baseType = TOWER_HP_BY_TYPE[t.type] ?? TOWER_BASE_HP;
    const bonus = (up.towerHpAdd ?? 0);
    const baseAfterBonus = (baseType + bonus) * (up.towerHpMul ?? 1);
    const next = Math.max(1, Math.round(baseAfterBonus * Math.pow(TOWER_HP_PER_LEVEL_MUL, t.level - 1)));
    const pct = t.maxHp > 0 ? t.hp / t.maxHp : 1;
    t.hpBonus = bonus;
    t.maxHp = next;
    t.hp = Math.max(0, Math.min(next, Math.round(next * pct)));
  }

  /**
   * Apply HP damage to a tower from any structural threat (saboteur, boss,
   * rift). Returns true if the tower transitioned into the disabled state on
   * this hit. Damage above maxHp triggers a soft-disable timer.
   */
  damageTower(
    t: Tower,
    rawAmount: number,
    source: "saboteur" | "boss" | "rift" | "jammer" | "other",
  ): { dealt: number; nowDisabled: boolean } {
    if (rawAmount <= 0 || t.disabled || !t.active) return { dealt: 0, nowDisabled: false };
    let amt = rawAmount;
    // Shield squads materially reduce structural damage to towers within field.
    if (t.shielded) {
      const up = this.game.core.upgrades;
      const reduction = Math.min(0.85, SHIELD_TOWER_DAMAGE_REDUCTION * (up.shieldTowerStrengthMul ?? 1));
      amt *= 1 - reduction;
    }
    if (source === "saboteur") {
      amt *= this.game.core.upgrades.saboteurTowerDamageMul ?? 1;
    }

    const prev = t.hp;
    t.hp = Math.max(0, t.hp - amt);
    const dealt = prev - t.hp;
    t.damageFlashTimer = Math.max(t.damageFlashTimer, 0.45);
    t.lastDamagedAt = this.game.time.elapsed;
    let nowDisabled = false;
    if (t.hp <= 0 && !t.disabled) {
      this.disable(t, source);
      nowDisabled = true;
    }
    // Audio throttle: at most one damage tick sfx per second per tower.
    if (this.game.time.elapsed - t.lastDamageSfxAt > 1.0) {
      t.lastDamageSfxAt = this.game.time.elapsed;
      this.game.audio.sfxTowerDamaged?.(t.pos);
    }
    if (this.game.core.settings.showDamageNumbers && dealt >= 1) {
      this.game.particles.spawnFloatingText(
        t.pos.x,
        t.pos.y - 14,
        `-${Math.round(dealt)}`,
        source === "saboteur" ? "#ff6f00" : "#ff5252",
        0.6,
        10
      );
    }
    return { dealt, nowDisabled };
  }

  /**
   * Mark a tower as fully disabled (no firing, dim render). Existing
   * disable-timer infrastructure is reused so legacy boss/saboteur/mirror
   * timed-disable flows still work — but this version sticks until repair
   * brings HP back above zero.
   */
  private disable(t: Tower, source: "saboteur" | "boss" | "rift" | "jammer" | "other"): void {
    if (t.disabled) return;
    t.disabled = true;
    t.disabledSinceGameTime = this.game.time.elapsed;
    t.timer = Math.max(t.timer, t.def.cooldown * 0.6);
    // Use the existing disable timer as a soft minimum offline window. This
    // makes saboteur kills feel impactful (you can't insta-engineer them back).
    let dur = SABOTEUR_DISABLE_DURATION;
    if (source === "boss") dur = 4.5;
    if (source === "rift") dur = 2.4;
    const reduce = this.game.core.upgrades.saboteurDisableReduction ?? 0;
    if (source === "saboteur" && reduce > 0) dur *= 1 - reduce;
    const existing = this.disabled.get(t) ?? 0;
    this.disabled.set(t, Math.max(existing, dur));
    // Visual + audio for disable transition.
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 30, "#ff5252", 0.45);
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, "#ff5252", 10, { speed: 90, life: 0.45, size: 2 });
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 22, "OFFLINE", "#ff5252", 1.0, 12);
    this.game.audio.sfxTowerDisabled?.(t.pos);
    this.game.bus.emit("tower:disabled", { tower: t, source });
  }

  /**
   * Engineer-style HP repair. amount is HP added per call. Returns the actual
   * delta (clamped to maxHp). Reviving a fully disabled tower forces hp ≥ 1
   * before clearing the disabled flag.
   */
  repairTower(t: Tower, amount: number): number {
    if (!t.active || amount <= 0) return 0;
    const prev = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + amount);
    if (t.disabled && t.hp > 0) {
      t.disabled = false;
      this.disabled.delete(t);
      this.game.particles.spawnRing(t.pos.x, t.pos.y, 28, "#00e676", 0.45);
      this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 24, "RESTORED", "#00e676", 1.1, 12);
      this.game.audio.sfxTowerRestored?.(t.pos);
      this.game.bus.emit("tower:restored", { tower: t });
    }
    if (t.hp >= t.maxHp && prev < t.maxHp) {
      this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 22, "FULL HP", "#9be7a7", 0.8, 11);
      this.game.audio.sfxTowerRepaired?.(t.pos);
    }
    return t.hp - prev;
  }

  /** Tick called by MobileSquadSystem: repair throughput from one engineer. */
  engineerRepairTick(t: Tower, dt: number, jammed: boolean): { healed: number; restored: boolean } {
    if (!t.active) return { healed: 0, restored: false };
    if (t.hp >= t.maxHp && !t.disabled) return { healed: 0, restored: false };

    // Stacking cap: if multiple Engineers channel on the same tower this
    // frame we keep only the first ENGINEER_REPAIR_STACK_CAP and trim
    // throughput by ENGINEER_REPAIR_STACK_FACTOR each.
    const live = this.engineerCountOnTower(t);
    const slot = Math.min(live, ENGINEER_REPAIR_STACK_CAP);
    const stackMul = Math.pow(ENGINEER_REPAIR_STACK_FACTOR, Math.max(0, slot - 1));

    const up = this.game.core.upgrades;
    const baseRate = ENGINEER_TOWER_REPAIR_RATE * (up.engineerRepairMul ?? 1);
    const disabledBonus = t.disabled ? ENGINEER_DISABLED_REPAIR_BONUS : 1;
    const jammerMul = jammed ? JAMMER_REPAIR_PENALTY : 1;
    const restorePrev = t.disabled;
    const heal = baseRate * disabledBonus * jammerMul * stackMul * dt;
    const healed = this.repairTower(t, heal);
    return { healed, restored: restorePrev && !t.disabled };
  }

  /** Approximate count of Engineers actively in repair contact on the same tower. */
  private engineerCountOnTower(t: Tower): number {
    if (!this.game.squads) return 1;
    let count = 0;
    for (const s of this.game.squads.list) {
      if (!s.active || s.type !== "engineer") continue;
      if (s.targetTower !== t) continue;
      if (s.state !== "repairing") continue;
      count++;
    }
    return Math.max(1, count);
  }

  /** Wave-end passive recovery — see WAVE_END_PASSIVE_HEAL_PCT in Config. */
  applyWaveEndRecovery(): void {
    const up = this.game.core.upgrades;
    const grid = this.game.grid;
    let healedTowers = 0;
    let nanitesUsed = false;
    for (const t of this.list) {
      if (!t.active) continue;
      // Disabled towers stay disabled. Optional: Emergency Nanites upgrade
      // restores the FIRST disabled tower per wave to a fraction of max HP.
      if (t.disabled) {
        if (!nanitesUsed && up.emergencyNanitesPct > 0) {
          nanitesUsed = true;
          const target = Math.max(1, Math.round(t.maxHp * up.emergencyNanitesPct));
          const delta = target - t.hp;
          if (delta > 0) {
            this.repairTower(t, delta);
            this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 26, "NANITES", "#9be7a7", 1.1, 11);
          }
        }
        continue;
      }
      if (t.hp >= t.maxHp) continue;
      // Only towers inside signal coverage benefit from passive recovery.
      if (!grid.isCellInSignalCoverage(t.c, t.r)) continue;
      const heal = Math.max(1, Math.round(t.maxHp * WAVE_END_PASSIVE_HEAL_PCT));
      this.repairTower(t, heal);
      healedTowers++;
    }
    if (healedTowers > 0) {
      const corePos = this.game.grid.corePos;
      this.game.particles.spawnFloatingText(
        corePos.x,
        corePos.y - 60,
        `FIELD REPAIRS: ${healedTowers} TOWERS`,
        "#9be7a7",
        1.4,
        12
      );
    }
  }

  upgrade(t: Tower): boolean {
    const cost = t.upgradeCost;
    if (this.game.core.credits < cost) return false;
    if (!this.game.spendCredits(cost)) return false;
    t.level++;
    t.totalInvested += cost;
    // Upgrade preserves HP percent. Recompute against the new level. If the
    // tower was disabled we don't auto-restore — it stays offline until repair
    // brings HP > 0. Documented behavior so future readers know the rule.
    this.applyDurabilityAggregate(t);
    this.game.audio.sfxUpgrade(t.pos);
    // Dramatic level-up FX.
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 36, "#ffd700");
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 20, t.def.color);
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, "#ffd700", 16, { speed: 140, life: 0.5, size: 2.5 });
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, "#ffffff", 8, { speed: 80, life: 0.3, size: 1.5 });
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 18, `LEVEL ${t.level}`, "#ffd700", 1.1, 15);
    this.game.bus.emit("tower:upgraded", t);
    return true;
  }

  sell(t: Tower): void {
    const refund = Math.floor(t.totalInvested * this.game.core.upgrades.sellRefundMul);
    this.game.core.credits += refund;
    const def = t.def;
    // Remove from grid and active list immediately so towers can be placed here again.
    this.game.grid.removeTower(t.c, t.r, Boolean(def.requiresCrystal));
    this.list = this.list.filter((x) => x !== t);
    if (this.selected === t) this.selected = null;
    this.game.audio.sfxSell(t.pos);
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 20, `+${refund}`, "#ffeb3b");
    this.game.bus.emit("credits:changed", this.game.core.credits);
    this.game.bus.emit("tower:sold", t);
    // Clear any squad target references so engineer/repair beams don't dangle
    // when the tower is removed mid-channel.
    if (this.game.squads) {
      for (const s of this.game.squads.list) {
        if (s.targetTower === t) {
          s.targetTower = null;
          s.effectTimer = 0;
        }
      }
    }
    // Start dissolve animation — tower moves to dissolving list and is removed after timer.
    t.dissolveTimer = Tower.DISSOLVE_MAX;
    this.dissolving.push(t);
    // Burst particles to sell-credit color.
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, t.def.color, 8, { speed: 80, life: 0.4, size: 2 });
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, "#ffeb3b", 5, { speed: 55, life: 0.5, size: 1.5 });
  }

  /** One-per-sector tower recall: refunds 100% of invested credits. */
  recall(t: Tower): boolean {
    if (this.game.core.towerRecallUsed) return false;
    const refund = t.totalInvested;
    this.game.core.credits += refund;
    const def = t.def;
    this.game.grid.removeTower(t.c, t.r, Boolean(def.requiresCrystal));
    this.list = this.list.filter((x) => x !== t);
    if (this.selected === t) this.selected = null;
    if (this.game.squads) {
      for (const s of this.game.squads.list) {
        if (s.targetTower === t) { s.targetTower = null; s.effectTimer = 0; }
      }
    }
    this.game.core.towerRecallUsed = true;
    this.game.audio.sfxSell(t.pos);
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 28, `RECALLED +${refund}`, "#66fcf1", 1.5, 13);
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, "#66fcf1", 18, { speed: 140, life: 0.7, size: 3 });
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 24, "#66fcf1");
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 44, "#ffffff");
    this.game.bus.emit("credits:changed", this.game.core.credits);
    this.game.bus.emit("tower:sold", t);
    return true;
  }

  applySpecialization(t: Tower, specId: string): void {
    if (specId === "pulse_cryo_proximity" && t.type === "pulse") {
      t.specId = specId;
      t.mods.push({ damageMul: 1.1, flags: { cryoField: true } });
      this.game.bus.emit("tower:specialized", t);
      this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 28, "CRYO PROXIMITY", "#80d8ff", 1.4, 13);
      this.game.audio.sfxUpgrade(t.pos);
      return;
    }
    t.applySpecialization(specId);
    this.game.bus.emit("tower:specialized", t);
    // Dramatic specialization FX: slow-mo pop + radial burst.
    this.game.core.slowMoScale = 0.22;
    this.game.core.slowMo = 0.55;
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 22, t.def.color);
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 44, "#ffffff");
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, t.def.color, 20, { speed: 180, life: 0.65, size: 3 });
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 28, "SPEC LOCKED", t.def.color, 1.4, 13);
    this.game.audio.sfxUpgrade(t.pos);
  }

  applyPinnacle(t: Tower): boolean {
    if (!t.canPinnacle) return false;
    t.applyPinnacle();
    this.game.bus.emit("tower:specialized", t);
    this.game.core.slowMoScale = 0.18;
    this.game.core.slowMo = 0.65;
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 58, "#ffffff");
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 32, t.def.color);
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, "#ffffff", 12, { speed: 220, life: 0.55, size: 2.5 });
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, t.def.color, 24, { speed: 180, life: 0.75, size: 3 });
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 34, "PINNACLE ONLINE", "#ffffff", 1.5, 14);
    this.game.audio.sfxUpgrade(t.pos);
    return true;
  }

  disableTower(t: Tower, duration: number): void {
    let actual = duration;
    const up = this.game.core.upgrades;
    // Field Repair Kits: tower disable durations are 30% shorter.
    if (up.droneRepairFaster) actual *= 0.7;
    // Conduit Aura: harvester adjacency halves disable durations on neighbors.
    if (up.harvesterShieldAdjacent) {
      for (const other of this.list) {
        if (!other.isEco) continue;
        const dc = Math.abs(other.c - t.c);
        const dr = Math.abs(other.r - t.r);
        if (dc <= 1 && dr <= 1) {
          actual *= 0.5;
          this.game.particles.spawnRing(other.pos.x, other.pos.y, 18, "#00e676", 0.18);
          break;
        }
      }
    }
    const existing = this.disabled.get(t) ?? 0;
    this.disabled.set(t, Math.max(existing, actual));
  }

  findTowerAt(c: number, r: number): Tower | null {
    for (const t of this.list) if (t.c === c && t.r === r) return t;
    return null;
  }

  activeSynergies(t: Tower): { name: string; description: string }[] {
    const synergies: { name: string; description: string }[] = [];
    if (
      (t.type === "tesla" && this.hasAdjacentType(t, "stasis")) ||
      (t.type === "stasis" && this.hasAdjacentType(t, "tesla"))
    ) {
      synergies.push({
        name: "Stasis Conduction",
        description: "Adjacent Tesla arrays gain +30% chain range.",
      });
    }
    if (
      (t.type === "barrier" && this.hasAdjacentType(t, "harvester")) ||
      (t.type === "harvester" && this.hasAdjacentType(t, "barrier"))
    ) {
      synergies.push({
        name: "Shield Capacitor",
        description: "Adjacent Barrier nodes pulse +1 time per second.",
      });
    }
    return synergies;
  }

  isTierUnlocked(type: TowerType): boolean {
    return this.game.core.waveIndex + 1 >= this.unlockWave(type);
  }

  unlockWave(type: TowerType): number {
    if (type === "railgun") return 6;
    if (type === "tesla" || type === "mortar" || type === "flamer" || type === "barrier" || type === "amplifier" || type === "reflector" || type === "snare" || type === "overclock") return 3;
    return 1;
  }

  buildLimit(type: TowerType): number | null {
    if (type === "railgun") return 3;
    if (type === "tesla") return 4;
    return null;
  }

  hasComboDiscount(type: TowerType, c: number, r: number): boolean {
    for (const other of this.list) {
      const adjacent = Math.abs(other.c - c) <= 1 && Math.abs(other.r - r) <= 1;
      if (!adjacent) continue;
      if ((type === "stasis" && other.type === "tesla") || (type === "tesla" && other.type === "stasis")) return true;
      if ((type === "barrier" && other.type === "harvester") || (type === "harvester" && other.type === "barrier")) return true;
    }
    return false;
  }

  manualFire(t: Tower): boolean {
    if (this.disabled.has(t) || t.isEco || t.manualCooldown > 0) return false;

    const stats = this.effectiveStats(t);
    let didFire = false;

    if (t.type === "stasis") {
      const target = this.findTarget(t, stats.range);
      if (target) {
        this.updateAim(t, target, 1);
        this.applyStasisPulse(t, target, stats);
        didFire = true;
      }
    } else if (t.type === "barrier") {
      this.applyBarrierPulse(t, stats);
      didFire = true;
    } else {
      const target = this.findTarget(t, stats.range);
      if (target) {
        this.updateAim(t, target, 1);
        this.fire(t, target, this.applyOvercharge(t, stats));
        didFire = true;
      }
    }

    if (!didFire) {
      this.game.audio.sfxShoot(0.5, 0.08, "bullet", t.pos);
      return false;
    }

    t.manualCooldown = t.manualCooldownMax;
    t.overcharge = 0;
    t.recoil = 5;
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 24, "MANUAL", "#ffeb3b", 0.75, 11);
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 28, "#ffeb3b");
    this.game.bus.emit("tower:manualFired", t);
    return true;
  }

  update(dt: number): void {
    // Tick dissolving towers (sold towers that are still animating out).
    for (const t of this.dissolving) {
      t.dissolveTimer = Math.max(0, t.dissolveTimer - dt);
    }
    this.dissolving = this.dissolving.filter((t) => t.dissolveTimer > 0);

    const up = this.game.core.upgrades;
    const lowCoreActive =
      up.lowCoreThreshold > 0 &&
      this.game.core.coreIntegrity / this.game.core.coreMax <= up.lowCoreThreshold;

    for (const t of this.list) {
      if (t.powerSurgeTimer > 0) t.powerSurgeTimer = Math.max(0, t.powerSurgeTimer - dt);

      // Decay damage-flash + repair flag every frame; squad systems set them on demand.
      if (t.damageFlashTimer > 0) t.damageFlashTimer = Math.max(0, t.damageFlashTimer - dt);
      // Clear underRepair flag — squad system sets it on demand each frame
      // when an engineer is actively in repair contact.
      t.underRepair = false;
      // shielded is recomputed each frame.
      t.shielded = this.computeShielded(t);

      // Construction: advance build animation, skip firing until complete.
      if (t.buildProgress < 1) {
        t.buildProgress = Math.min(1, t.buildProgress + dt / 0.4);
        continue;
      }

      // Rift-anchor aura: any tower inside the aura takes a small DPS over time
      // while the rift is alive. Telegraph + ring already render at the source.
      this.applyRiftAuraDamage(t, dt);

      if (t.manualCooldown > 0) t.manualCooldown = Math.max(0, t.manualCooldown - dt);

      // Handle disables (legacy timers + HP-driven disabled flag).
      const dTimer = this.disabled.get(t);
      if (dTimer != null) {
        const nt = dTimer - dt;
        if (nt <= 0) this.disabled.delete(t);
        else this.disabled.set(t, nt);
        continue;
      }
      if (t.disabled) {
        // HP-disabled towers don't fire until restored. The render layer
        // shows them dimmed and the engineer can repair them back online.
        continue;
      }

      // Recoil decay.
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 20);
      if (this.game.core.emergencyOverheatTimer > 0 && !t.isEco) continue;

      // Harvester income (isEco).
      if (t.isEco) {
        this.updateHarvester(t, dt);
        continue;
      }

      // Silence wave: all tower fire suppressed while silenceTimer > 0.
      if (this.game.waves.silenceTimer > 0) continue;

      // Stasis towers.
      if (t.type === "stasis") {
        this.updateStasis(t, dt);
        continue;
      }

      // Barrier: passive slow pulse in range; zero direct damage.
      if (t.type === "barrier") {
        this.updateBarrier(t, dt);
        continue;
      }

      if (t.type === "amplifier" || t.type === "reflector") continue;
      if (t.type === "overclock") {
        this.updateOverclockStation(t, dt);
        continue;
      }

      // Flamer heat management.
      if (t.type === "flamer") {
        t.heatTimer = Math.max(0, t.heatTimer - dt * 0.6);
      }

      // Fire-rate modifier.
      let fireRateMul = up.towerFireRateMul;
      if (lowCoreActive) fireRateMul *= up.lowCoreFireRateMul;
      if (this.game.core.emergencyTimer > 0) fireRateMul *= 1.5;
      fireRateMul *= this.powerSurgeMul(t);
      // Relay node: harvester boost.
      if (this.hasNearbyRelay(t)) fireRateMul *= 1.1;
      // Run modifier: overclock (lower towerCooldownMul = shorter cooldown = faster fire).
      for (const m of this.game.core.activeModifiers) {
        if (m.towerCooldownMul) fireRateMul /= m.towerCooldownMul;
      }
      // Jammer aura: nearby Jammer enemies suppress fire rate by 30%.
      if (this.isInJammerAura(t)) fireRateMul *= 0.7;
      // Durability-based penalty: damaged towers fire slightly slower; critical
      // towers fire much slower. Disabled towers were already early-returned.
      const ds = t.durabilityState;
      if (ds === "damaged") fireRateMul *= TOWER_DAMAGED_FIRE_RATE_MUL;
      else if (ds === "critical") fireRateMul *= TOWER_CRITICAL_FIRE_RATE_MUL;
      // Amplifier Overclock specialization: adjacent amplifiers with overclockAdjacent give +10% fire rate.
      for (const amp of this.list) {
        if (amp.type === "amplifier" && amp.flags.overclockAdjacent) {
          if (Math.max(Math.abs(amp.c - t.c), Math.abs(amp.r - t.r)) <= 1) fireRateMul *= 1.1;
        }
      }

      const stats = this.effectiveStats(t);
      const target = this.findTarget(t, stats.range);
      this.updateAim(t, target, dt);
      t.timer -= dt * fireRateMul;
      if (t.timer <= 0) {
        if (target) {
          this.fire(t, target, this.applyOvercharge(t, stats));
          t.timer = stats.cooldown;
          t.recoil = 4;
          t.overcharge = 0;
          // Flamer heat accumulation.
          if (t.type === "flamer") {
            t.heatTimer = Math.min(10, t.heatTimer + stats.cooldown + 0.25);
          }
        } else if (this.fireAtStructure(t, stats)) {
          t.timer = stats.cooldown;
          t.recoil = 3;
          t.overcharge = 0;
        } else {
          t.overcharge = Math.min(5, t.overcharge + dt);
        }
      }

      // Flamer overheat steam particles (Poisson rate ~5/s at full heat).
      if (t.type === "flamer" && t.heatTimer > 5) {
        const rate = 5 * Math.min(1, (t.heatTimer - 5) / 4);
        if (Math.random() < rate * dt) {
          this.game.particles.spawnBurst(t.pos.x, t.pos.y - 6, "#b0b0b0", 1, { speed: 16, life: 0.9, size: 3 });
        }
      }
    }
  }

  private updateHarvester(t: Tower, dt: number): void {
    // Harvester passes credit every def.cooldown seconds.
    const stats = this.effectiveStats(t);
    t.timer -= dt;
    if (t.timer <= 0) {
      t.timer = stats.cooldown;

      // Check run modifier: scarcity disables income; credit_flood boosts it.
      let modIncomeMul = 1;
      for (const m of this.game.core.activeModifiers) {
        if (m.harvestDisabled) { modIncomeMul = 0; break; }
        if (m.harvesterIncomeMul) modIncomeMul *= m.harvesterIncomeMul;
      }
      if (modIncomeMul <= 0) return;

      // Resonant Mining: count adjacent non-harvester towers for an income bonus.
      let adjBonus = 0;
      const up = this.game.core.upgrades;
      if (up.harvesterAdjacencyBonus > 0) {
        let neighbors = 0;
        for (const other of this.list) {
          if (other === t || other.isEco) continue;
          const dc = Math.abs(other.c - t.c);
          const dr = Math.abs(other.r - t.r);
          if (dc <= 1 && dr <= 1) neighbors++;
        }
        adjBonus = up.harvesterAdjacencyBonus * neighbors;
      }
      const income = Math.round(stats.income * up.harvesterIncomeMul * modIncomeMul * (1 + adjBonus));
      this.game.addCredits(income);
      this.game.audio.sfxCredit(t.pos);
      this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 18, `+${income}`, "#00e676", 0.8, 12);
      this.game.particles.spawnRing(t.pos.x, t.pos.y, 22, "#00e676");
      this.game.particles.spawnCreditOrbs(t.pos.x, t.pos.y, 2);
    }
  }

  private updateStasis(t: Tower, dt: number): void {
    const stats = this.effectiveStats(t);
    let fireRateMul = this.game.core.upgrades.towerFireRateMul;
    if (this.game.core.emergencyTimer > 0) fireRateMul *= 1.5;
    fireRateMul *= this.powerSurgeMul(t);
    if (this.hasNearbyRelay(t)) fireRateMul *= 1.1;
    for (const m of this.game.core.activeModifiers) {
      if (m.towerCooldownMul) fireRateMul /= m.towerCooldownMul;
    }
    t.timer -= dt * fireRateMul;

    const target = this.findTarget(t, stats.range);
    this.updateAim(t, target, dt);
    if (t.timer > 0) return;

    // Slow the nearest in-range target.
    if (!target) return;
    t.timer = stats.cooldown;
    this.applyStasisPulse(t, target, stats);
  }

  private applyStasisPulse(t: Tower, target: Enemy, _stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    this.game.audio.sfxTowerFire(t.type, t.pos);
    t.recoil = 4;
    const up = this.game.core.upgrades;
    let strength = t.flags.deepFreeze ? 0.3 : 0.55;
    // Cryo Saturation: deeper slow.
    if (up.stasisDeeperSlow > 0) strength = Math.max(0.15, strength - up.stasisDeeperSlow);
    const duration = t.flags.deepFreeze ? 3.4 : 2.6;
    target.applySlow(duration, strength);
    target.freezeFxTimer = duration;
    target.freezeFxMax = duration;
    // Vulnerability Pulse specialization: tag the primary target as vulnerable.
    if (t.flags.vulnerabilityPulse) {
      target.vulnerableTimer = Math.max(target.vulnerableTimer, duration);
    }
    this.game.particles.spawnBeam(t.pos.x, t.pos.y, target.pos.x, target.pos.y, t.def.color, 0.18);

    if (t.flags.singularity) {
      this.applySingularityPulse(t, target, duration, strength);
      return;
    }

    // Cryo Field: slow everyone around the target a bit.
    if (t.flags.cryoField) {
      for (const e of this.game.enemies.list) {
        if (e === target || !e.active) continue;
        if (e.pos.dist(target.pos) < 40) {
          e.applySlow(duration * 0.6, strength + 0.1);
          e.freezeFxTimer = Math.max(e.freezeFxTimer, duration * 0.6);
          e.freezeFxMax = Math.max(e.freezeFxMax, duration * 0.6);
        }
      }
      this.game.particles.spawnRing(target.pos.x, target.pos.y, 40, t.def.color);
    }
  }

  private applySingularityPulse(t: Tower, target: Enemy, duration: number, strength: number): void {
    const radius = 76;
    const pullDuration = t.flags.deepFreeze ? 1.45 : 1.15;
    const center = target.pos.clone();
    let affected = 0;

    for (const e of this.game.enemies.list) {
      if (!e.active || e.isTunneling) continue;
      const d = e.pos.dist(center);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      const slowDuration = duration * (0.45 + falloff * 0.45);
      e.applySlow(slowDuration, Math.max(0.25, strength - 0.05));
      e.freezeFxTimer = Math.max(e.freezeFxTimer, slowDuration);
      e.freezeFxMax = Math.max(e.freezeFxMax, slowDuration);
      e.singularityX = center.x;
      e.singularityY = center.y;
      e.singularityTimer = Math.max(e.singularityTimer, pullDuration);
      e.singularityMax = Math.max(e.singularityMax, pullDuration);
      if (d > 4) {
        const impulse = (e.isBoss ? 70 : 185) * falloff;
        e.knockbackVel = e.knockbackVel.add(center.sub(e.pos).normalize().mult(impulse));
      }
      affected++;
    }

    this.game.particles.spawnRing(center.x, center.y, radius, t.def.color, 0.42);
    this.game.particles.spawnRing(center.x, center.y, radius * 0.52, "#ffffff", 0.22);
    this.game.particles.spawnBurst(center.x, center.y, t.def.color, Math.min(18, 4 + affected * 2), {
      speed: 34,
      life: 0.55,
      size: 2,
    });
    if (affected >= 4) {
      this.game.particles.spawnFloatingText(center.x, center.y - 24, "SINGULARITY", t.def.color, 0.9, 11);
    }
  }

  private hasNearbyRelay(t: Tower): boolean {
    if (t.type === "harvester") return false;
    for (const other of this.list) {
      if (other === t || other.type !== "harvester") continue;
      if (!other.flags.relayNode) continue;
      if (other.pos.dist(t.pos) < 96) return true;
    }
    return false;
  }

  private isInJammerAura(t: Tower): boolean {
    for (const e of this.game.enemies.list) {
      if (!e.active || e.type !== "jammer") continue;
      if (e.pos.dist(t.pos) < 80) return true;
    }
    // Strategic-point jammers also suppress fire rate inside their field.
    if (this.game.strategicPoints?.isWorldPointJammed(t.pos.x, t.pos.y)) return true;
    return false;
  }

  /** True if any active Shield squad's interaction radius covers this tower. */
  private computeShielded(t: Tower): boolean {
    if (!this.game.squads) return false;
    for (const s of this.game.squads.list) {
      if (s.type !== "shield" || !s.active || s.evacuating) continue;
      const radius = s.def.interactionRadius;
      if (s.pos.dist(t.pos) <= radius) return true;
    }
    return false;
  }

  /** Per-tick rift-anchor aura damage to towers caught inside an active rift's radius. */
  private applyRiftAuraDamage(t: Tower, dt: number): void {
    const sps = this.game.strategicPoints;
    if (!sps) return;
    let dps = 0;
    for (const p of sps.list) {
      if (p.type !== "rift_anchor" || p.state !== "enemy") continue;
      const r = 200; // RIFT_ANCHOR_AURA_RADIUS — kept inline to avoid import churn
      if (t.pos.dist(p.pos) > r) continue;
      // Conservative DPS: 3.5 HP/s per rift (Config: RIFT_TOWER_DAMAGE_PER_SECOND).
      dps += 3.5;
    }
    if (dps <= 0) return;
    this.damageTower(t, dps * dt, "rift");
  }

  private hasAdjacentType(t: Tower, type: TowerType): boolean {
    for (const other of this.list) {
      if (other === t || other.type !== type) continue;
      const dc = Math.abs(other.c - t.c);
      const dr = Math.abs(other.r - t.r);
      if (dc <= 1 && dr <= 1) return true;
    }
    return false;
  }

  private updateAim(t: Tower, target: Enemy | null, dt: number): void {
    if (!target || t.isEco || t.type === "barrier") return;
    const desired = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
    let delta = desired - t.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    t.angle += delta * Math.min(1, dt * 8);
  }

  private applyOvercharge(
    t: Tower,
    stats: ReturnType<TowerSystem["effectiveStats"]>
  ): ReturnType<TowerSystem["effectiveStats"]> {
    if (t.overcharge < 5 || stats.damage <= 0) return stats;
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 26, "OVERCHARGE ×3", "#ffeb3b", 0.9, 12);
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 42, "#ffeb3b");
    return { ...stats, damage: stats.damage * 3 };
  }

  effectiveStats(t: Tower) {
    const base = t.statBlock();
    const up = this.game.core.upgrades;
    let range = base.range * up.towerRangeMul + up.towerRangeAdd;
    const specRangeMul = up.specificTowerRangeMul[t.type];
    if (specRangeMul) range *= specRangeMul;

    // Signal interference: reduce range by 40% for towers inside the zone.
    const si = this.game.core.signalInterference;
    if (si) {
      const dx = t.pos.x - si.x, dy = t.pos.y - si.y;
      if (dx * dx + dy * dy < si.radius * si.radius) range *= 0.6;
    }

    let splashRadius = base.splashRadius * up.mortarSplashMul;
    let chainMax = base.chainMax + (t.type === "tesla" ? up.teslaChainAdd : 0);
    let chainRange = t.def.chainRange ?? 0;
    let cooldown = base.cooldown;
    let damage = base.damage;

    if (t.type === "tesla" && this.hasAdjacentType(t, "stasis")) {
      chainRange *= 1.3;
    }
    if (t.type === "barrier" && this.hasAdjacentType(t, "harvester")) {
      cooldown = 1 / (1 / Math.max(0.05, cooldown) + 1);
    }

    // Critical-HP penalties — damaged towers are less precise.
    if (t.durabilityState === "critical") {
      range *= TOWER_CRITICAL_RANGE_MUL;
      damage *= TOWER_CRITICAL_DAMAGE_MUL;
    }

    return {
      range,
      damage,
      cooldown,
      splashRadius,
      chainMax,
      chainRange,
      income: base.income,
    };
  }

  private findTarget(t: Tower, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = Infinity;
    const mode = t.targetMode;

    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      if (e.isPhased && e.ability === "phase" && !(t.type === "tesla" && t.flags.phaseDisruptor)) continue;
      if (e.isTunneling) continue;
      const d = e.pos.dist(t.pos);
      if (d > range) continue;

      let score: number;
      switch (mode) {
        case "weakest":
          score = e.hp / e.maxHp; // lowest HP% first
          break;
        case "strongest":
          score = -(e.hp / e.maxHp); // highest HP% first
          break;
        case "fastest":
          score = -e.currentSpeed; // highest speed first
          break;
        default: { // closest_to_core
          const distToCore = this.game.grid.getDistAtWorld(e.pos.x, e.pos.y);
          score = distToCore * 1000 + d;
          break;
        }
      }
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  private fire(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    this.game.audio.sfxTowerFire(t.type, t.pos);

    switch (t.type) {
      case "pulse": this.firePulse(t, target, stats); break;
      case "blaster": this.fireBlaster(t, target, stats); break;
      case "mortar": this.fireMortar(t, target, stats); break;
      case "tesla": this.fireTesla(t, target, stats); break;
      case "railgun": this.fireRailgun(t, target, stats); break;
      case "flamer": this.fireFlamer(t, target, stats); break;
      case "snare": this.fireSnare(t, target, stats); break;
      default: break;
    }

    // Muzzle flash particle — purely visual, drawn by RenderSystem.
    const ang = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
    this.game.particles.spawnMuzzleFlash(t.pos.x, t.pos.y, ang, t.def.color);
  }

  private fireRailgun(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    const up = this.game.core.upgrades;
    // Instant hit ray + big beam. Apply boss focus + reflector synergy on the primary hit.
    let dmg = stats.damage;
    if (up.railgunBossFocus > 0 && target.isBoss) dmg *= 1 + up.railgunBossFocus;
    if (up.reflectorRailgunMul > 1) {
      const adjReflectors = this.list.filter((r) => r.type === "reflector"
        && Math.max(Math.abs(r.c - t.c), Math.abs(r.r - t.r)) <= 1
        && r.buildProgress >= 1).length;
      if (adjReflectors > 0) dmg *= 1 + 0.25 * adjReflectors;
    }
    this.applyTowerDamage(target, dmg, { type: "tower", towerType: "railgun", tower: t }, t);
    const beam = this.rayToScreenEdge(t.pos.x, t.pos.y, target.pos.x, target.pos.y);
    this.game.particles.spawnBeam(
      beam.x1,
      beam.y1,
      beam.x2,
      beam.y2,
      t.def.color,
      0.15,
      { kind: "railgun", width: 12 }
    );
    // Linear Resolve / Piercing Round: pierce other enemies along the line.
    const pierceAll = up.railgunPierceAll || t.flags.armorPiercer;
    if (pierceAll) {
      const pierceMul = up.railgunPierceAll ? 0.5 : 0.5;
      for (const e of this.game.enemies.list) {
        if (e === target || !e.active) continue;
        const dx = target.pos.x - t.pos.x;
        const dy = target.pos.y - t.pos.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const px = e.pos.x - t.pos.x;
        const py = e.pos.y - t.pos.y;
        const along = (px * dx + py * dy) / (len * len);
        if (along < 0 || along > 1.05) continue;
        const perp = Math.abs(px * nx + py * ny);
        if (perp < 12) this.applyTowerDamage(e, dmg * pierceMul, { type: "tower", towerType: "railgun", tower: t }, t);
      }
    }
    this.tryReflectRailgun(t, target, stats);
  }

  hasAdjacentLevel(t: Tower, type: TowerType, minLevel: number): boolean {
    for (const other of this.list) {
      if (other === t || other.type !== type || other.level < minLevel) continue;
      const dc = Math.abs(other.c - t.c);
      const dr = Math.abs(other.r - t.r);
      if (dc <= 1 && dr <= 1) return true;
    }
    return false;
  }

  private tryReflectRailgun(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    const reflectors = this.list.filter((x) => x.type === "reflector" && x.buildProgress >= 1);
    if (reflectors.length === 0) {
      if (t.flags.railRicochet) this.tryTerrainRicochet(t, target, stats);
      return;
    }

    const dx = target.pos.x - t.pos.x;
    const dy = target.pos.y - t.pos.y;
    const len = Math.hypot(dx, dy) || 1;
    let best: Tower | null = null;
    let bestPerp = Infinity;
    for (const r of reflectors) {
      const px = r.pos.x - t.pos.x;
      const py = r.pos.y - t.pos.y;
      const along = (px * dx + py * dy) / (len * len);
      if (along < 0.15 || along > 1.35) continue;
      const perp = Math.abs(px * (-dy / len) + py * (dx / len));
      if (perp < Math.min(18, this.effectiveStats(r).range * 0.22) && perp < bestPerp) {
        bestPerp = perp;
        best = r;
      }
    }
    if (!best) {
      if (t.flags.railRicochet) this.tryTerrainRicochet(t, target, stats);
      return;
    }

    const next = this.findReflectTarget(best, target, stats.range * 0.9);
    if (!next) return;
    const boosted = best.mods.some((m) => m.damageMul && m.damageMul > 1);
    this.applyTowerDamage(next, stats.damage * (boosted ? 0.75 : 0.6), { type: "tower", towerType: "railgun", tower: t }, t);
    this.game.particles.spawnBeam(t.pos.x, t.pos.y, best.pos.x, best.pos.y, t.def.color, 0.12, { kind: "railgun", width: 8 });
    this.game.particles.spawnBeam(best.pos.x, best.pos.y, next.pos.x, next.pos.y, best.def.color, 0.16, { kind: "railgun", width: 9 });
    this.game.particles.spawnRing(best.pos.x, best.pos.y, 28, best.def.color, 0.32);
  }

  private tryTerrainRicochet(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    let bounced = 0;
    let from = target.pos;
    for (const e of this.game.enemies.list) {
      if (!e.active || e === target || bounced >= 2) continue;
      if (e.pos.dist(from) > 96) continue;
      bounced++;
      this.applyTowerDamage(e, stats.damage * 0.35, { type: "tower", towerType: "railgun", tower: t }, t);
      this.game.particles.spawnBeam(from.x, from.y, e.pos.x, e.pos.y, t.def.color, 0.1, { kind: "railgun", width: 6 });
      from = e.pos;
    }
  }

  private findReflectTarget(reflector: Tower, exclude: Enemy, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = range;
    for (const e of this.game.enemies.list) {
      if (!e.active || e === exclude || e.isTunneling) continue;
      const d = e.pos.dist(reflector.pos);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private rayToScreenEdge(x1: number, y1: number, x2: number, y2: number): { x1: number; y1: number; x2: number; y2: number } {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const candidates: number[] = [];
    const mapW = this.game.grid.worldW;
    const mapH = this.game.grid.worldH;

    if (nx > 0) candidates.push((mapW - x1) / nx);
    else if (nx < 0) candidates.push((0 - x1) / nx);
    if (ny > 0) candidates.push((mapH - y1) / ny);
    else if (ny < 0) candidates.push((0 - y1) / ny);

    const forwardCandidates = candidates.filter((v) => v > 0);
    const forward = Math.min(...forwardCandidates);
    if (!Number.isFinite(forward)) return { x1, y1, x2, y2 };
    return {
      x1: x1 - nx * 18,
      y1: y1 - ny * 18,
      x2: x1 + nx * forward,
      y2: y1 + ny * forward,
    };
  }

  private fireFlamer(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    const up = this.game.core.upgrades;
    const ang = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      const d = e.pos.dist(t.pos);
      if (d > stats.range) continue;
      const ea = Math.atan2(e.pos.y - t.pos.y, e.pos.x - t.pos.x);
      let delta = Math.abs(((ea - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (delta > 0.6) continue;
      let dmg = stats.damage;
      // Swarm Igniter: +80% to swarms, -25% to bosses.
      if (up.flamerSwarmFocus) {
        if (e.type === "swarm" || e.type === "scout") dmg *= 1.8;
        else if (e.isBoss) dmg *= 0.75;
      }
      this.applyTowerDamage(e, dmg, { type: "tower", towerType: "flamer", tower: t }, t);
      if (t.flags.burningGround) e.applySlow(0.4, 0.85);
      // Flame Panic: any burning enemy is mildly slowed.
      if (up.flamerPanicSlow) e.applySlow(0.6, 0.8);
      // Overburn: flamer applies vulnerability so all sources do more damage briefly.
      if (t.flags.vulnerabilityPulse) {
        e.vulnerableTimer = Math.max(e.vulnerableTimer, 2.0);
      }
    }
    this.game.particles.spawnFlameJet(t.pos.x, t.pos.y, ang, stats.range, 0.6);
  }

  private updateBarrier(t: Tower, dt: number): void {
    const stats = this.effectiveStats(t);
    let fireRateMul = this.game.core.emergencyTimer > 0 ? 1.5 : 1;
    fireRateMul *= this.powerSurgeMul(t);
    t.timer -= dt * fireRateMul;
    if (t.timer > 0) return;
    t.timer = stats.cooldown;
    this.applyBarrierPulse(t, stats);
  }

  private applyBarrierPulse(t: Tower, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    // Slow all enemies within the barrier aura; very gentle.
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      if (e.pos.dist(t.pos) <= stats.range) {
        e.applySlow(0.6, t.flags.cryoField ? 0.7 : 0.85);
      }
    }
    this.game.particles.spawnRing(t.pos.x, t.pos.y, stats.range, t.def.color);
  }

  private updateOverclockStation(t: Tower, dt: number): void {
    const stats = this.effectiveStats(t);
    t.timer -= dt;
    if (t.timer > 0) return;

    const rangeTiles = stats.range / 48;
    let best: Tower | null = null;
    let bestDamage = -1;
    for (const other of this.list) {
      if (
        other === t ||
        other.isEco ||
        other.type === "amplifier" ||
        other.type === "reflector" ||
        other.type === "overclock"
      ) continue;
      if (Math.max(Math.abs(other.c - t.c), Math.abs(other.r - t.r)) > rangeTiles) continue;
      if (other.powerSurgeTimer > 0 || this.disabled.has(other)) continue;
      const dmg = this.effectiveStats(other).damage;
      if (dmg > bestDamage) {
        bestDamage = dmg;
        best = other;
      }
    }

    t.timer = stats.cooldown;
    if (!best) return;
    best.powerSurgeTimer = Math.max(best.powerSurgeTimer, 5);
    if (t.mods.some((m) => m.damageMul && m.damageMul > 1)) best.overcharge = Math.max(best.overcharge, 5);
    this.game.particles.spawnBeam(t.pos.x, t.pos.y, best.pos.x, best.pos.y, t.def.color, 0.2);
    this.game.particles.spawnRing(best.pos.x, best.pos.y, 36, t.def.color, 0.35);
    this.game.particles.spawnFloatingText(best.pos.x, best.pos.y - 26, "OVERCLOCK", t.def.color, 1.0, 11);
    this.game.audio.sfxPowerSurge(best.pos);
  }

  private powerSurgeMul(t: Tower): number {
    return t.powerSurgeTimer > 0 ? 2 : 1;
  }

  /**
   * Single canonical multiplier for any tower-sourced damage.
   * Combines: global towerDamageMul, per-type multipliers, low-core bonus,
   * and Amplifier auras (basic +15% / Resonance Core +25% within tile range).
   * Used by ProjectileSystem AND by direct-damage paths (Railgun/Tesla/Flamer/splash)
   * so all towers get consistent global modifiers (Part 1 — mechanical correctness).
   */
  getTowerDamageMultiplier(t: Tower | undefined): number {
    if (!t) return 1;
    const up = this.game.core.upgrades;
    let mul = up.towerDamageMul;
    const spec = up.specificTowerDamageMul[t.type];
    if (spec) mul *= spec;

    // Amplifier adjacency bonus. Default tile range = 1, Resonance Core = 2.
    for (const amp of this.list) {
      if (amp.type !== "amplifier" || amp.buildProgress < 1) continue;
      const tileRange = amp.flags.resonanceCore ? 2 : 1;
      if (Math.max(Math.abs(amp.c - t.c), Math.abs(amp.r - t.r)) <= tileRange) {
        mul *= amp.flags.resonanceCore ? 1.25 : 1.15;
      }
    }

    // Low-core bonus damage when "Last Stand Circuit" is active.
    if (
      up.lowCoreFireRateMul > 1 &&
      this.game.core.coreIntegrity / this.game.core.coreMax <= up.lowCoreThreshold
    ) {
      mul *= 1.15;
    }
    return mul;
  }

  /** Apply a tower-sourced damage hit to an enemy through the canonical multiplier. */
  applyTowerDamage(target: Enemy, amount: number, src: import("../entities/Enemy").DamageSource | null, tower: Tower | undefined): void {
    const mul = this.getTowerDamageMultiplier(tower);
    this.game.enemies.damage(target, amount * mul, src);
  }

  private firePulse(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    const up = this.game.core.upgrades;
    // Splitter Pulse: every third shot fires a 3-way split with 70% damage each.
    const splitNow = up.pulseSplitShots && (t.burstCount % 3 === 2);
    const burstNow = t.flags.tripleBurst && (t.burstCount % 3 === 2);
    let shots = 1;
    let perShotMul = 1;
    if (splitNow) { shots = 3; perShotMul = 0.7; }
    else if (burstNow) { shots = 3; perShotMul = 1; }
    t.burstCount++;
    // Last-Stand Pulse: damage scales up to +50% as enemies approach core.
    let baseDmg = stats.damage;
    if (up.pulseCoreBoost) {
      const distCells = this.game.grid.getDistAtWorld(target.pos.x, target.pos.y);
      const close = Math.max(0, Math.min(1, 1 - distCells / 8));
      baseDmg *= 1 + 0.5 * close;
    }
    for (let i = 0; i < shots; i++) {
      const spread = shots === 3 ? (i - 1) * 0.15 : 0;
      const ang = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x) + spread;
      const dir = new Vector2(Math.cos(ang), Math.sin(ang));
      const p = new Projectile({
        pos: t.pos,
        target,
        targetPos: t.pos.add(dir.mult(400)),
        damage: baseDmg * perShotMul,
        color: t.def.color,
        speed: t.def.projectileSpeed ?? 460,
        kind: "bullet",
        owner: { tower: t },
        ownerType: "pulse",
        mark: Boolean(t.flags.signalMarker),
      });
      this.game.projectiles.spawn(p);
    }
  }

  private fireBlaster(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    const p = new Projectile({
      pos: t.pos,
      target,
      damage: stats.damage,
      color: t.def.color,
      speed: t.def.projectileSpeed ?? 560,
      kind: "bullet",
      owner: { tower: t },
      ownerType: "blaster",
      armorPierce: Boolean(t.flags.armorPiercer),
      slowOnHit: t.flags.suppressiveFire ? 0.4 : 0,
      slowStrength: 0.75,
    });
    this.game.projectiles.spawn(p);
  }

  private fireSnare(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    const p = new Projectile({
      pos: t.pos,
      target,
      damage: stats.damage,
      color: t.def.color,
      speed: t.def.projectileSpeed ?? 420,
      kind: "bullet",
      owner: { tower: t },
      ownerType: "snare",
      slowOnHit: 2.0,
      slowStrength: 0,
      stunChance: t.flags.empArc ? 1 : 0,
    });
    this.game.projectiles.spawn(p);
  }

  private fireMortar(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    const up = this.game.core.upgrades;
    const p = new Projectile({
      pos: t.pos,
      target,
      targetPos: target.pos,
      damage: stats.damage,
      color: t.def.color,
      speed: t.def.projectileSpeed ?? 320,
      kind: "mortar",
      owner: { tower: t },
      ownerType: "mortar",
      splashRadius: stats.splashRadius,
      armorBreak: Boolean(t.flags.armorBreaker),
      // Incendiary Loadout: every shell leaves burning ground.
      burningGround: Boolean(t.flags.burningGround) || up.mortarAlwaysBurn,
    });
    this.game.projectiles.spawn(p);
  }

  /**
   * Secondary targeting pass — when no enemy is in range, take a shot at the
   * closest hostile strategic structure within range. Damage is scaled down by
   * STRUCTURE_TARGET_PRIORITY so towers feel less effective vs. structures
   * than vs. enemies (encouraging the player to bring the structure into
   * range deliberately rather than getting it for free).
   *
   * Returns true if a shot was fired so the caller can spend the cooldown.
   */
  private fireAtStructure(t: Tower, stats: ReturnType<TowerSystem["effectiveStats"]>): boolean {
    const sps = this.game.strategicPoints;
    if (!sps || stats.damage <= 0) return false;
    if (t.type === "harvester" || t.type === "amplifier" || t.type === "reflector") return false;

    let best: import("../entities/StrategicPoint").StrategicPoint | null = null;
    let bestSq = stats.range * stats.range;
    for (const p of sps.list) {
      if (p.state !== "enemy") continue;
      const dx = p.pos.x - t.pos.x;
      const dy = p.pos.y - t.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = p;
      }
    }
    if (!best) return false;

    const towerMul = this.getTowerDamageMultiplier(t);
    const dmg = stats.damage * towerMul * STRUCTURE_TARGET_PRIORITY;
    const ang = Math.atan2(best.pos.y - t.pos.y, best.pos.x - t.pos.x);
    t.angle = ang;
    this.game.audio.sfxTowerFire(t.type, t.pos);
    this.game.particles.spawnMuzzleFlash(t.pos.x, t.pos.y, ang, t.def.color);
    this.game.particles.spawnBeam(
      t.pos.x, t.pos.y, best.pos.x, best.pos.y, t.def.color, 0.12,
      { kind: t.type === "railgun" ? "railgun" : "standard", width: 4 }
    );
    sps.damageStructure(best, dmg, { source: "tower" });
    return true;
  }

  private fireTesla(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    const up = this.game.core.upgrades;
    const chained: Enemy[] = [target];
    const pts: { x: number; y: number }[] = [{ x: t.pos.x, y: t.pos.y }, { x: target.pos.x, y: target.pos.y }];
    let current = target;
    let chainRange = stats.chainRange || 64;
    if (up.teslaLongChain) chainRange *= 1.7;
    const maxJumps = Math.max(1, stats.chainMax);

    for (let i = 1; i < maxJumps; i++) {
      let next: Enemy | null = null;
      let best = chainRange;
      for (const e of this.game.enemies.list) {
        if (!e.active || chained.includes(e)) continue;
        if (e.isPhased && !t.flags.phaseDisruptor) continue;
        const d = current.pos.dist(e.pos);
        if (d < best) { best = d; next = e; }
      }
      if (!next) break;
      chained.push(next);
      pts.push({ x: next.pos.x, y: next.pos.y });
      current = next;
    }

    for (let i = 0; i < chained.length; i++) {
      const e = chained[i]!;
      let dmg = stats.damage;
      // Storm Reach: each subsequent jump deals less damage.
      if (up.teslaLongChain && i > 0) dmg *= Math.pow(0.75, i);
      // Phantom Lash: bonus damage to phased enemies (works only if can hit).
      if (up.teslaPhantomBonus > 0 && e.isPhased) dmg *= 1 + up.teslaPhantomBonus;
      if (e.isPhased && t.flags.phaseDisruptor) dmg *= 0.4;
      this.applyTowerDamage(e, dmg, { type: "tower", towerType: "tesla", tower: t }, t);
      if (t.flags.empArc && Math.random() < 0.25) e.applyStun(0.5);
      // Disruptor Coil: every Tesla hit applies vulnerability.
      if (up.teslaVulnerability) {
        e.vulnerableTimer = Math.max(e.vulnerableTimer, 1.2);
      }
    }

    this.game.particles.spawnLightning(pts, t.def.color);
  }
}
