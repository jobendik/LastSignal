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
    const refund = Math.floor(t.totalInvested * this.game.core.upgrades.sellRefundMul);
    this.game.core.credits += refund;
    const def = t.def;
    this.game.grid.removeTower(t.c, t.r, Boolean(def.requiresCrystal));
    this.list = this.list.filter((x) => x !== t);
    if (this.selected === t) this.selected = null;
    this.game.audio.sfxSell();
    this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 20, `+${refund}`, "#ffeb3b");
    this.game.bus.emit("tower:sold", t);
  }

  applySpecialization(t: Tower, specId: string): void {
    t.applySpecialization(specId);
    this.game.bus.emit("tower:specialized", t);
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

      // Recoil decay.
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 20);

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

      // Fire-rate modifier.
      let fireRateMul = up.towerFireRateMul;
      if (lowCoreActive) fireRateMul *= up.lowCoreFireRateMul;
      // Relay node: harvester boost.
      if (this.hasNearbyRelay(t)) fireRateMul *= 1.1;

      const stats = this.effectiveStats(t);
      t.timer -= dt * fireRateMul;
      if (t.timer <= 0) {
        const target = this.findTarget(t, stats.range);
        if (target) {
          this.fire(t, target, stats);
          t.timer = stats.cooldown;
          t.recoil = 4;
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
      const income = Math.round(stats.income * this.game.core.upgrades.harvesterIncomeMul);
      this.game.addCredits(income);
      this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 18, `+${income}`, "#00e676", 0.8, 12);
      // Spawn visual pulse.
      this.game.particles.spawnRing(t.pos.x, t.pos.y, 22, "#00e676");
    }
  }

  private updateStasis(t: Tower, dt: number): void {
    const stats = this.effectiveStats(t);
    let fireRateMul = this.game.core.upgrades.towerFireRateMul;
    if (this.hasNearbyRelay(t)) fireRateMul *= 1.1;
    t.timer -= dt * fireRateMul;
    if (t.timer > 0) return;

    // Slow the nearest in-range target.
    const target = this.findTarget(t, stats.range);
    if (!target) return;
    t.timer = stats.cooldown;

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

  private hasNearbyRelay(t: Tower): boolean {
    if (t.type === "harvester") return false;
    for (const other of this.list) {
      if (other === t || other.type !== "harvester") continue;
      if (!other.flags.relayNode) continue;
      if (other.pos.dist(t.pos) < 96) return true;
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
    };
  }

  private findTarget(t: Tower, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      // Phased enemies are skipped unless Tesla has Phase Disruptor.
      if (e.isPhased && e.ability === "phase" && !(t.type === "tesla" && t.flags.phaseDisruptor)) continue;
      const d = e.pos.dist(t.pos);
      if (d > range) continue;
      const distToCore = this.game.grid.getDistAtWorld(e.pos.x, e.pos.y);
      const score = distToCore * 1000 + d;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  private fire(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    this.game.audio.sfxShoot(t.type === "blaster" ? 1.3 : t.type === "tesla" ? 0.9 : 1);

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
    this.game.enemies.damage(target, dmg, { type: "tower", towerType: "railgun" });
    this.game.particles.spawnBeam(
      t.pos.x, t.pos.y, target.pos.x, target.pos.y, t.def.color, 0.22
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
        if (perp < 10) this.game.enemies.damage(e, dmg * 0.5, { type: "tower", towerType: "railgun" });
      }
    }
  }

  private fireFlamer(t: Tower, target: Enemy, stats: ReturnType<TowerSystem["effectiveStats"]>): void {
    // Apply continuous damage to all enemies inside a small cone.
    const ang = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      const d = e.pos.dist(t.pos);
      if (d > stats.range) continue;
      const ea = Math.atan2(e.pos.y - t.pos.y, e.pos.x - t.pos.x);
      let delta = Math.abs(((ea - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (delta > 0.6) continue;
      this.game.enemies.damage(e, stats.damage, { type: "tower", towerType: "flamer" });
      if (t.flags.burningGround) e.applySlow(0.4, 0.85);
    }
    this.game.particles.spawnBeam(
      t.pos.x, t.pos.y, target.pos.x, target.pos.y, t.def.color, 0.08
    );
  }

  private updateBarrier(t: Tower, dt: number): void {
    const stats = this.effectiveStats(t);
    t.timer -= dt;
    if (t.timer > 0) return;
    t.timer = stats.cooldown;
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
      let dmg = stats.damage;
      if (e.isPhased && t.flags.phaseDisruptor) dmg *= 0.4;
      this.game.enemies.damage(e, dmg, { type: "tower", towerType: "tesla" });
      if (t.flags.empArc && Math.random() < 0.25) e.applyStun(0.5);
    }

    this.game.particles.spawnLightning(pts, t.def.color);
  }
}
