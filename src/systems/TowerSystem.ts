import type { Game } from "../core/Game";
import { Tower } from "../entities/Tower";
import type { Enemy } from "../entities/Enemy";
import type { TowerType } from "../core/Types";
import { towerDefinitions } from "../data/towers";
import { Projectile } from "../entities/Projectile";
import { Vector2 } from "../core/Vector2";
import { VIEW_HEIGHT, VIEW_WIDTH } from "../core/Config";

/** Handles tower behavior: targeting, firing, specialization effects, upgrades, economy ticks. */
export class TowerSystem {
  list: Tower[] = [];
  selected: Tower | null = null;
  /** Tower disable timers keyed on tower ref. */
  disabled = new Map<Tower, number>();

  constructor(private readonly game: Game) {}

  reset(): void {
    this.list.length = 0;
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

  upgrade(t: Tower): boolean {
    const cost = t.upgradeCost;
    if (this.game.core.credits < cost) return false;
    if (!this.game.spendCredits(cost)) return false;
    t.level++;
    t.totalInvested += cost;
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
    this.game.grid.removeTower(t.c, t.r, Boolean(def.requiresCrystal));
    this.list = this.list.filter((x) => x !== t);
    if (this.selected === t) this.selected = null;
    this.game.audio.sfxSell(t.pos);
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 20, `+${refund}`, "#ffeb3b");
    this.game.bus.emit("credits:changed", this.game.core.credits);
    this.game.bus.emit("tower:sold", t);
  }

  applySpecialization(t: Tower, specId: string): void {
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

  disableTower(t: Tower, duration: number): void {
    const existing = this.disabled.get(t) ?? 0;
    this.disabled.set(t, Math.max(existing, duration));
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
    if (type === "tesla" || type === "mortar" || type === "flamer" || type === "barrier") return 3;
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
    const up = this.game.core.upgrades;
    const lowCoreActive =
      up.lowCoreThreshold > 0 &&
      this.game.core.coreIntegrity / this.game.core.coreMax <= up.lowCoreThreshold;

    for (const t of this.list) {
      // Construction: advance build animation, skip firing until complete.
      if (t.buildProgress < 1) {
        t.buildProgress = Math.min(1, t.buildProgress + dt / 0.4);
        continue;
      }

      if (t.manualCooldown > 0) t.manualCooldown = Math.max(0, t.manualCooldown - dt);

      // Handle disables.
      const dTimer = this.disabled.get(t);
      if (dTimer != null) {
        const nt = dTimer - dt;
        if (nt <= 0) this.disabled.delete(t);
        else this.disabled.set(t, nt);
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

      // Flamer heat management.
      if (t.type === "flamer") {
        t.heatTimer = Math.max(0, t.heatTimer - dt * 0.6);
      }

      // Fire-rate modifier.
      let fireRateMul = up.towerFireRateMul;
      if (lowCoreActive) fireRateMul *= up.lowCoreFireRateMul;
      if (this.game.core.emergencyTimer > 0) fireRateMul *= 1.5;
      // Relay node: harvester boost.
      if (this.hasNearbyRelay(t)) fireRateMul *= 1.1;
      // Run modifier: overclock (lower towerCooldownMul = shorter cooldown = faster fire).
      for (const m of this.game.core.activeModifiers) {
        if (m.towerCooldownMul) fireRateMul /= m.towerCooldownMul;
      }
      // Jammer aura: nearby Jammer enemies suppress fire rate by 30%.
      if (this.isInJammerAura(t)) fireRateMul *= 0.7;

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

      const income = Math.round(stats.income * this.game.core.upgrades.harvesterIncomeMul * modIncomeMul);
      this.game.addCredits(income);
      this.game.audio.sfxCredit(t.pos);
      this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 18, `+${income}`, "#00e676", 0.8, 12);
      this.game.particles.spawnRing(t.pos.x, t.pos.y, 22, "#00e676");
    }
  }

  private updateStasis(t: Tower, dt: number): void {
    const stats = this.effectiveStats(t);
    let fireRateMul = this.game.core.upgrades.towerFireRateMul;
    if (this.game.core.emergencyTimer > 0) fireRateMul *= 1.5;
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
    const strength = t.flags.deepFreeze ? 0.3 : 0.55;
    const duration = t.flags.deepFreeze ? 3.4 : 2.6;
    target.applySlow(duration, strength);
    target.freezeFxTimer = duration;
    target.freezeFxMax = duration;
    this.game.particles.spawnBeam(t.pos.x, t.pos.y, target.pos.x, target.pos.y, t.def.color, 0.18);

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
    return false;
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

    let splashRadius = base.splashRadius * up.mortarSplashMul;
    let chainMax = base.chainMax + (t.type === "tesla" ? up.teslaChainAdd : 0);
    let chainRange = t.def.chainRange ?? 0;
    let cooldown = base.cooldown;

    if (t.type === "tesla" && this.hasAdjacentType(t, "stasis")) {
      chainRange *= 1.3;
    }
    if (t.type === "barrier" && this.hasAdjacentType(t, "harvester")) {
      cooldown = 1 / (1 / Math.max(0.05, cooldown) + 1);
    }

    return {
      range,
      damage: base.damage,
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
      default: break;
    }

    // Muzzle flash particle — purely visual, drawn by RenderSystem.
    const ang = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
    this.game.particles.spawnMuzzleFlash(t.pos.x, t.pos.y, ang, t.def.color);
  }

  private fireRailgun(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    // Instant hit ray + big beam.
    const dmg = stats.damage;
    this.game.enemies.damage(target, dmg, { type: "tower", towerType: "railgun", tower: t });
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
    if (t.flags.armorPiercer) {
      for (const e of this.game.enemies.list) {
        if (e === target || !e.active) continue;
        // Pierce any enemy roughly along the line between t and target (simple distance check).
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
        if (perp < 10) this.game.enemies.damage(e, dmg * 0.5, { type: "tower", towerType: "railgun", tower: t });
      }
    }
  }

  private rayToScreenEdge(x1: number, y1: number, x2: number, y2: number): { x1: number; y1: number; x2: number; y2: number } {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const candidates: number[] = [];

    if (nx > 0) candidates.push((VIEW_WIDTH - x1) / nx);
    else if (nx < 0) candidates.push((0 - x1) / nx);
    if (ny > 0) candidates.push((VIEW_HEIGHT - y1) / ny);
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
    const ang = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      const d = e.pos.dist(t.pos);
      if (d > stats.range) continue;
      const ea = Math.atan2(e.pos.y - t.pos.y, e.pos.x - t.pos.x);
      let delta = Math.abs(((ea - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (delta > 0.6) continue;
      this.game.enemies.damage(e, stats.damage, { type: "tower", towerType: "flamer", tower: t });
      if (t.flags.burningGround) e.applySlow(0.4, 0.85);
    }
    this.game.particles.spawnFlameJet(t.pos.x, t.pos.y, ang, stats.range, 0.6);
  }

  private updateBarrier(t: Tower, dt: number): void {
    const stats = this.effectiveStats(t);
    const fireRateMul = this.game.core.emergencyTimer > 0 ? 1.5 : 1;
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

  private firePulse(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    const shots = t.flags.tripleBurst && (t.burstCount % 3 === 2) ? 3 : 1;
    t.burstCount++;
    for (let i = 0; i < shots; i++) {
      const spread = shots === 3 ? (i - 1) * 0.15 : 0;
      const ang = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x) + spread;
      const dir = new Vector2(Math.cos(ang), Math.sin(ang));
      const p = new Projectile({
        pos: t.pos,
        target,
        targetPos: t.pos.add(dir.mult(400)),
        damage: stats.damage,
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

  private fireMortar(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
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
      burningGround: Boolean(t.flags.burningGround),
    });
    this.game.projectiles.spawn(p);
  }

  private fireTesla(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    const chained: Enemy[] = [target];
    const pts: { x: number; y: number }[] = [{ x: t.pos.x, y: t.pos.y }, { x: target.pos.x, y: target.pos.y }];
    let current = target;
    const chainRange = stats.chainRange || 64;
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

    for (const e of chained) {
      let dmg = stats.damage;
      if (e.isPhased && t.flags.phaseDisruptor) dmg *= 0.4;
      this.game.enemies.damage(e, dmg, { type: "tower", towerType: "tesla", tower: t });
      if (t.flags.empArc && Math.random() < 0.25) e.applyStun(0.5);
    }

    this.game.particles.spawnLightning(pts, t.def.color);
  }
}
