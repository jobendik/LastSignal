import type { Game } from "../core/Game";
import { Projectile } from "../entities/Projectile";
import { Vector2 } from "../core/Vector2";
import type { Enemy } from "../entities/Enemy";
import { PROJECTILE_CAP } from "../core/Config";
import { CellKind } from "../core/Types";

export class ProjectileSystem {
  list: Projectile[] = [];

  constructor(private readonly game: Game) {}

  reset(): void {
    this.list.length = 0;
  }

  spawn(p: Projectile): void {
    if (this.list.length >= PROJECTILE_CAP) {
      // Drop the oldest projectile to avoid unbounded growth.
      this.list.shift();
    }
    p.maxLife = p.life;
    this.list.push(p);
  }

  update(dt: number): void {
    for (const p of this.list) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // Re-target if the target died.
      if (p.target && !p.target.active) {
        p.target = null;
      }

      let dir: Vector2;
      if (p.target && p.target.active) {
        dir = p.target.pos.sub(p.pos).normalize();
        p.targetPos = p.target.pos.clone();
      } else if (p.reflectedTower) {
        dir = p.reflectedTower.pos.sub(p.pos).normalize();
        p.targetPos = p.reflectedTower.pos.clone();
      } else {
        dir = p.lastDir;
      }
      p.lastDir = dir;
      // Record trail position before moving.
      p.trail.push(p.pos.clone());
      if (p.trail.length > 6) p.trail.shift();
      p.pos = p.pos.add(dir.mult(this.effectiveProjectileSpeed(p) * dt));
      if (p.reflectedTower) {
        if (!this.game.towers.list.includes(p.reflectedTower)) {
          p.active = false;
          continue;
        }
        if (p.pos.dist(p.reflectedTower.pos) < 8) {
          this.game.towers.disableTower(p.reflectedTower, p.reflectedDisable);
          this.game.particles.spawnBurst(p.reflectedTower.pos.x, p.reflectedTower.pos.y, p.color, 9, { speed: 90, life: 0.35, size: 2 });
          this.game.particles.spawnRing(p.reflectedTower.pos.x, p.reflectedTower.pos.y, 24, p.color, 0.28);
          this.game.particles.spawnFloatingText(p.reflectedTower.pos.x, p.reflectedTower.pos.y - 18, "REFLECT HIT", p.color, 0.8, 10);
          p.active = false;
          continue;
        }
      }
      if (!p.target && p.kind !== "mortar" && this.hitTerrain(p)) {
        this.game.particles.spawnImpactBurst(p.pos.x, p.pos.y, Math.atan2(-dir.y, -dir.x), p.color, 0.8);
        p.active = false;
        continue;
      }

      // Collision with target (direct hit) or world.
      if (p.target) {
        const d = p.pos.dist(p.target.pos);
        if (d < p.target.size + 2) {
          this.onImpact(p, p.target);
          p.active = false;
        }
      } else if (p.kind === "mortar") {
        // Mortar keeps flying to the original target pos.
        if (p.pos.dist(p.targetPos) < 6) {
          this.onImpact(p, null);
          p.active = false;
        }
      } else {
        // Bullet with no target — fade out quickly.
        p.life -= dt * 3;
      }
    }
    this.list = this.list.filter((p) => p.active);
  }

  private onImpact(p: Projectile, direct: Enemy | null): void {
    const impactX = p.targetPos.x;
    const impactY = p.targetPos.y;

    // Splash damage or direct hit.
    if (p.splashRadius > 0) {
      this.game.particles.spawnMortarExplosion(impactX, impactY, p.splashRadius, p.color);
      // Bass drop on large mortar explosions.
      if (p.splashRadius >= 80 && !this.game.core.settings.reducedFlashing) {
        this.game.particles.spawnScreenFlash("#000000", 0.55, 0.04);
      }
      this.game.audio.sfxExplosion(0.35, { x: impactX });
      for (const e of this.game.enemies.list) {
        if (!e.active) continue;
        if (e.isPhased && !p.owner.tower?.flags.phaseDisruptor) continue;
        const d = e.pos.dist(new Vector2(impactX, impactY));
        if (d <= p.splashRadius) {
          const falloff = 1 - d / p.splashRadius * 0.5;
          let dmg = p.damage * falloff;
          dmg *= this.globalMul(p);
          if (p.armorBreak && e.def.armor) dmg *= 1.6;
          // Kill zone bonus applies to splash targets too.
          const kzS = this.game.core.killZone;
          if (kzS) {
            const { c, r } = this.game.grid.worldToCell(e.pos.x, e.pos.y);
            if (c === kzS.c && r === kzS.r) dmg *= 1.2;
          }
          this.game.enemies.damage(e, dmg, this.sourceFor(p));
          const knock = 165 * Math.max(0, 1 - d / p.splashRadius);
          if (knock > 20) this.game.enemies.knockback(e, impactX, impactY, knock);
        }
      }
      if (p.burningGround) {
        this.game.particles.spawnDamageZone(impactX, impactY, p.splashRadius * 0.7, p.damage * 0.4, 2.5);
      }
    } else if (direct) {
      let dmg = p.damage * this.globalMul(p);
      if (p.armorPierce && (direct.type === "brute" || direct.type === "carrier")) dmg *= 1.6;
      // Kill zone bonus: +20% damage to enemies standing on the designated tile.
      const kz = this.game.core.killZone;
      if (kz) {
        const { c, r } = this.game.grid.worldToCell(direct.pos.x, direct.pos.y);
        if (c === kz.c && r === kz.r) dmg *= 1.2;
      }
      this.game.enemies.damage(direct, dmg, this.sourceFor(p));
      if (p.slowOnHit > 0) direct.applySlow(p.slowOnHit, p.slowStrength);
      if (p.stunChance > 0 && Math.random() < p.stunChance) direct.applyStun(0.6);
      if (p.mark) direct.signalMarked = true;

      this.game.particles.spawnBurst(direct.pos.x, direct.pos.y, p.color, 5, { speed: 100, life: 0.3 });
    }
  }

  private sourceFor(p: Projectile): import("../entities/Enemy").DamageSource | null {
    if (p.ownerType === "drone") return { type: "drone" };
    if (p.ownerType === "other") return { type: "other" };
    return { type: "tower", towerType: p.ownerType, tower: p.owner.tower };
  }

  private hitTerrain(p: Projectile): boolean {
    if (p.pos.x < 0 || p.pos.y < 0 || p.pos.x > this.game.width || p.pos.y > this.game.height) return false;
    const { c, r } = this.game.grid.worldToCell(p.pos.x, p.pos.y);
    const cell = this.game.grid.cells[this.game.grid.idx(c, r)];
    return cell === CellKind.Rock;
  }

  private effectiveProjectileSpeed(p: Projectile): number {
    const g = this.game.core.gravityAnomaly;
    if (!g) return p.speed;
    const dx = p.pos.x - g.x;
    const dy = p.pos.y - g.y;
    return dx * dx + dy * dy < g.radius * g.radius ? p.speed * 0.55 : p.speed;
  }

  private globalMul(p: Projectile): number {
    const up = this.game.core.upgrades;
    let mul = 1;
    if (p.owner.tower) {
      mul *= up.towerDamageMul;
      const spec = up.specificTowerDamageMul[p.owner.tower.type];
      if (spec) mul *= spec;

      // Amplifier tower adjacency: +15% per adjacent amplifier (or +25% with Resonance Core).
      const tc = p.owner.tower.c;
      const tr = p.owner.tower.r;
      for (const amp of this.game.towers.list) {
        if (amp.type !== "amplifier") continue;
        const tileRange = amp.flags.resonanceCore ? 2 : 1;
        if (Math.max(Math.abs(amp.c - tc), Math.abs(amp.r - tr)) <= tileRange) {
          mul *= amp.flags.resonanceCore ? 1.25 : 1.15;
        }
      }
    }
    // Low-core circuit.
    if (
      up.lowCoreFireRateMul > 1 &&
      this.game.core.coreIntegrity / this.game.core.coreMax <= up.lowCoreThreshold
    ) {
      mul *= 1.15; // mild bonus damage alongside fire rate
    }
    return mul;
  }
}
