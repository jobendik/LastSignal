import type { Game } from "../core/Game";
import { Tower } from "../entities/Tower";
import type { Enemy } from "../entities/Enemy";
import type { TowerType } from "../core/Types";
import { towerDefinitions } from "../data/towers";
import { Projectile } from "../entities/Projectile";
import { Vector2 } from "../core/Vector2";

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

  buildCost(type: TowerType): number {
    const base = towerDefinitions[type].cost;
    return Math.max(1, Math.floor(base * this.game.core.upgrades.towerBuildCostMul));
  }

  canPlace(type: TowerType, c: number, r: number): { ok: boolean; reason?: string } {
    const def = towerDefinitions[type];
    if (def.unlockRequires && !this.game.meta.isTowerUnlocked(type)) {
      return { ok: false, reason: "Locked — unlock in Research" };
    }
    if (this.game.core.credits < this.buildCost(type)) return { ok: false, reason: "Insufficient credits" };
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
    const cost = this.buildCost(type);
    this.game.core.credits -= cost;
    const def = towerDefinitions[type];
    const t = new Tower(type, c, r, cost);
    this.list.push(t);
    this.game.grid.placeTower(c, r, type, Boolean(def.isEco));
    this.game.audio.sfxBuild();
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, def.color, 10, { speed: 80, life: 0.5 });
    this.game.bus.emit("tower:built", t);
    this.game.core.stats.towersBuilt++;
    return t;
  }

  upgrade(t: Tower): boolean {
    const cost = t.upgradeCost;
    if (this.game.core.credits < cost) return false;
    this.game.core.credits -= cost;
    t.level++;
    t.totalInvested += cost;
    this.game.audio.sfxUpgrade();
    this.game.particles.spawnRing(t.pos.x, t.pos.y, 24, t.def.color);
    this.game.bus.emit("tower:upgraded", t);
    return true;
  }

  sell(t: Tower): void {
    const refund = Math.floor(
      t.totalInvested * (this.game.core.upgrades.sellRefundMul + this.game.meta.sellRefundAdd)
    );
    this.game.core.credits += refund;
    const def = t.def;
    this.game.grid.removeTower(t.c, t.r, Boolean(def.requiresCrystal));
    this.list = this.list.filter((x) => x !== t);
    if (this.selected === t) this.selected = null;
    this.game.audio.sfxSell();
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 20, `+${refund}`, "#ffeb3b");
    this.game.bus.emit("tower:sold", t);
    this.game.core.stats.towersSold++;
  }

  applySpecialization(t: Tower, specId: string): void {
    t.applySpecialization(specId);
    this.game.bus.emit("tower:specialized", t);
    this.game.core.stats.specsApplied++;
  }

  disableTower(t: Tower, duration: number): void {
    const existing = this.disabled.get(t) ?? 0;
    this.disabled.set(t, Math.max(existing, duration));
  }

  findTowerAt(c: number, r: number): Tower | null {
    for (const t of this.list) if (t.c === c && t.r === r) return t;
    return null;
  }

  update(dt: number): void {
    const up = this.game.core.upgrades;
    const lowCoreActive =
      up.lowCoreThreshold > 0 &&
      this.game.core.coreIntegrity / this.game.core.coreMax <= up.lowCoreThreshold;

    for (const t of this.list) {
      // Handle disables.
      const dTimer = this.disabled.get(t);
      if (dTimer != null) {
        const nt = dTimer - dt;
        if (nt <= 0) this.disabled.delete(t);
        else this.disabled.set(t, nt);
        continue;
      }

      // Recoil + muzzle flash decay.
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 20);
      if (t.muzzleFlash > 0) t.muzzleFlash = Math.max(0, t.muzzleFlash - dt);
      if (t.flameActive > 0) t.flameActive = Math.max(0, t.flameActive - dt);

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

      // Shield pylon — passive aura; just keep cooldown ticking for visual pulse.
      if (t.type === "shield") {
        this.updateShield(t, dt);
        continue;
      }

      // Flamethrower: continuous fire while any enemy in cone.
      if (t.type === "flamethrower") {
        this.updateFlamethrower(t, dt);
        continue;
      }

      // Fire-rate modifier.
      let fireRateMul = up.towerFireRateMul;
      if (lowCoreActive) fireRateMul *= up.lowCoreFireRateMul;
      // Relay node: harvester boost.
      if (this.hasNearbyRelay(t)) fireRateMul *= 1.1;
      // Corruptor debuff.
      if (this.hasCorruptorAura(t)) fireRateMul *= 0.55;

      const stats = this.effectiveStats(t);
      t.timer -= dt * fireRateMul;
      // Railgun charge visual:
      if (t.type === "railgun") {
        t.chargeProgress = Math.max(0, Math.min(1, 1 - t.timer / stats.cooldown));
      }
      if (t.timer <= 0) {
        const target = this.findTarget(t, stats.range);
        if (target) {
          this.fire(t, target, stats);
          t.timer = stats.cooldown;
          t.recoil = 4;
          t.muzzleFlash = 0.08;
        }
      }
    }
  }

  private updateHarvester(t: Tower, dt: number): void {
    const stats = this.effectiveStats(t);
    t.timer -= dt;
    if (t.timer <= 0) {
      t.timer = stats.cooldown;
      const income = Math.round(
        stats.income * this.game.core.upgrades.harvesterIncomeMul * this.game.meta.harvesterIncomeMul
      );
      this.game.addCredits(income);
      this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 18, `+${income}`, "#00e676", 0.8, 12);
      this.game.particles.spawnRing(t.pos.x, t.pos.y, 22, "#00e676");
    }
  }

  private updateStasis(t: Tower, dt: number): void {
    const stats = this.effectiveStats(t);
    let fireRateMul = this.game.core.upgrades.towerFireRateMul;
    if (this.hasNearbyRelay(t)) fireRateMul *= 1.1;
    if (this.hasCorruptorAura(t)) fireRateMul *= 0.55;
    t.timer -= dt * fireRateMul;
    if (t.timer > 0) return;

    // Slow the nearest in-range target.
    const target = this.findTarget(t, stats.range);
    if (!target) return;
    t.timer = stats.cooldown;
    t.muzzleFlash = 0.08;

    const strength = t.flags.deepFreeze ? 0.3 : 0.55;
    const duration = t.flags.deepFreeze ? 3.4 : 2.6;
    target.applySlow(duration, strength);
    this.game.particles.spawnBeam(t.pos.x, t.pos.y, target.pos.x, target.pos.y, t.def.color, 0.18);

    // Cryo Field: slow everyone around the target a bit.
    if (t.flags.cryoField) {
      for (const e of this.game.enemies.list) {
        if (e === target || !e.active) continue;
        if (e.pos.dist(target.pos) < 40) e.applySlow(duration * 0.6, strength + 0.1);
      }
      this.game.particles.spawnRing(target.pos.x, target.pos.y, 40, t.def.color);
    }
  }

  private updateShield(t: Tower, dt: number): void {
    t.timer -= dt;
    if (t.timer <= 0) {
      t.timer = 1.1 + Math.random() * 0.3;
      const stats = this.effectiveStats(t);
      this.game.particles.spawnRing(t.pos.x, t.pos.y, stats.auraRadius, t.def.color);
    }
  }

  private updateFlamethrower(t: Tower, dt: number): void {
    const stats = this.effectiveStats(t);
    let fireRateMul = this.game.core.upgrades.towerFireRateMul;
    if (this.hasNearbyRelay(t)) fireRateMul *= 1.1;
    if (this.hasCorruptorAura(t)) fireRateMul *= 0.55;

    // Find aim target (nearest in cone).
    const aim = this.findTarget(t, stats.range);
    if (!aim) return;

    t.timer -= dt * fireRateMul;
    if (t.timer > 0) return;
    t.timer = stats.cooldown;

    // Compute cone direction
    const ang = Math.atan2(aim.pos.y - t.pos.y, aim.pos.x - t.pos.x);
    t.flameActive = 0.15;
    t.muzzleFlash = 0.08;

    // Damage everything in the cone.
    const half = stats.coneArc / 2;
    const burnDur = 1.6;
    const burnDps = stats.damage * 2;
    let hits = 0;
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      if (e.isPhased && !t.flags.phaseDisruptor) continue;
      const dx = e.pos.x - t.pos.x;
      const dy = e.pos.y - t.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > stats.range) continue;
      const ea = Math.atan2(dy, dx);
      let diff = Math.abs(((ea - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > half) continue;
      const falloff = 1 - (d / stats.range) * 0.3;
      const dmg = stats.damage * falloff * this.globalDamageMul(t);
      this.game.enemies.damage(e, dmg, { type: "tower", towerType: "flamethrower", damageType: "fire" }, { fromX: t.pos.x, fromY: t.pos.y });
      const boostedBurn = t.flags.ignitionBoost ? burnDps * 1.6 : burnDps;
      e.applyBurn(burnDur, boostedBurn);
      if (t.flags.heatWave && Math.random() < 0.1) e.applySlow(0.4, 0.7);
      hits++;
    }
    if (t.flags.napalmPool && hits > 0) {
      const ex = t.pos.x + Math.cos(ang) * stats.range * 0.6;
      const ey = t.pos.y + Math.sin(ang) * stats.range * 0.6;
      this.game.particles.spawnDamageZone(ex, ey, 40, stats.damage * 1.2, 1.6, "#ff7043");
    }

    // Visual: draw the cone as multiple bursts/rings along the cone path.
    for (let i = 0; i < 6; i++) {
      const r = (i / 6) * stats.range;
      const spread = (Math.random() - 0.5) * stats.coneArc;
      const px = t.pos.x + Math.cos(ang + spread) * r;
      const py = t.pos.y + Math.sin(ang + spread) * r;
      this.game.particles.spawnBurst(px, py, "#ff7043", 2, { speed: 20, life: 0.25, size: 2 });
    }

    this.game.audio.sfxTowerFire("flamethrower");
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

  /** Returns true if any enemy Corruptor is within its aura of the given tower. */
  private hasCorruptorAura(t: Tower): boolean {
    for (const e of this.game.enemies.list) {
      if (!e.active || e.ability !== "corrupt") continue;
      if (t.pos.dist(e.pos) < e.corruptRadius) return true;
    }
    return false;
  }

  /** Returns true if any Aegis Pylon with reactiveArmor is in range of given tower. */
  hasShieldBuff(t: Tower): boolean {
    for (const s of this.list) {
      if (s.type !== "shield" || s === t) continue;
      if (s.pos.dist(t.pos) < (s.def.auraRadius ?? 128)) return true;
    }
    return false;
  }

  private effectiveStats(t: Tower) {
    const base = t.statBlock();
    const up = this.game.core.upgrades;
    let range = base.range * up.towerRangeMul + up.towerRangeAdd;
    const specRangeMul = up.specificTowerRangeMul[t.type];
    if (specRangeMul) range *= specRangeMul;

    let splashRadius = base.splashRadius * up.mortarSplashMul;
    let chainMax = base.chainMax + (t.type === "tesla" ? up.teslaChainAdd : 0);

    return {
      range,
      damage: base.damage,
      cooldown: base.cooldown,
      splashRadius,
      chainMax,
      income: base.income,
      pierce: base.pierce,
      coneArc: base.coneArc,
      auraRadius: base.auraRadius,
    };
  }

  private findTarget(t: Tower, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      // Phased enemies are skipped unless Tesla/Flamethrower has Phase Disruptor.
      if (e.isPhased && e.ability === "phase" && !(t.flags.phaseDisruptor)) continue;
      const d = e.pos.dist(t.pos);
      if (d > range) continue;
      const distToCore = this.game.grid.getDistAtWorld(e.pos.x, e.pos.y);
      const score = distToCore * 1000 + d;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  private globalDamageMul(t: Tower): number {
    const up = this.game.core.upgrades;
    let mul = up.towerDamageMul * this.game.meta.towerDamageMul;
    const spec = up.specificTowerDamageMul[t.type];
    if (spec) mul *= spec;
    if (this.hasShieldBuff(t)) mul *= 1.1;
    return mul;
  }

  private fire(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    this.game.audio.sfxTowerFire(t.type);

    switch (t.type) {
      case "pulse": this.firePulse(t, target, stats); break;
      case "blaster": this.fireBlaster(t, target, stats); break;
      case "mortar": this.fireMortar(t, target, stats); break;
      case "tesla": this.fireTesla(t, target, stats); break;
      case "railgun": this.fireRailgun(t, target, stats); break;
      default: break;
    }
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
    const chainRange = t.def.chainRange ?? 64;
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
      let dmg = stats.damage * this.globalDamageMul(t);
      if (e.isPhased && t.flags.phaseDisruptor) dmg *= 0.4;
      this.game.enemies.damage(e, dmg, { type: "tower", towerType: "tesla", damageType: "chain" }, { fromX: t.pos.x, fromY: t.pos.y });
      if (t.flags.empArc && Math.random() < 0.25) e.applyStun(0.5);
    }

    this.game.particles.spawnLightning(pts, t.def.color);
  }

  private fireRailgun(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    // Instant-hit piercing beam along direction to target.
    const ang = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    // Enemies within narrow corridor and within range are hit in order.
    const hits: { e: Enemy; dist: number }[] = [];
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      if (e.isPhased) continue;
      const relX = e.pos.x - t.pos.x;
      const relY = e.pos.y - t.pos.y;
      const forward = relX * dx + relY * dy;
      if (forward < 0 || forward > stats.range) continue;
      const lateral = Math.abs(-relX * dy + relY * dx);
      if (lateral > e.size + 4) continue;
      hits.push({ e, dist: forward });
    }
    hits.sort((a, b) => a.dist - b.dist);

    const maxHits = 1 + Math.max(0, stats.pierce);
    let delivered = 0;
    let dmgRemaining = stats.damage * this.globalDamageMul(t);
    const endX = t.pos.x + dx * stats.range;
    const endY = t.pos.y + dy * stats.range;
    for (const { e } of hits) {
      if (delivered >= maxHits) break;
      this.game.enemies.damage(e, dmgRemaining, { type: "tower", towerType: "railgun", damageType: "kinetic" }, { fromX: t.pos.x, fromY: t.pos.y });
      if (t.flags.markTarget) e.signalMarked = true;
      delivered++;
      dmgRemaining *= 0.85; // slight fall-off per pierce
    }
    // Visual: piercing beam.
    this.game.particles.spawnBeam(t.pos.x, t.pos.y, endX, endY, t.def.color, 0.18);
    this.game.particles.spawnBurst(t.pos.x, t.pos.y, t.def.color, 10, { speed: 200, life: 0.3, size: 2 });
  }
}
