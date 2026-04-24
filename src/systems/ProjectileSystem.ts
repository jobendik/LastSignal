import type { Game } from "../core/Game";
import { Projectile } from "../entities/Projectile";
import { Vector2 } from "../core/Vector2";
import type { Enemy } from "../entities/Enemy";
import { PROJECTILE_CAP } from "../core/Config";

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
      } else {
        dir = p.lastDir;
      }
      p.lastDir = dir;
      // Record trail position before moving.
      p.trail.push(p.pos.clone());
      if (p.trail.length > 6) p.trail.shift();
      p.pos = p.pos.add(dir.mult(p.speed * dt));

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
      this.game.particles.spawnRing(impactX, impactY, p.splashRadius, p.color);
      this.game.particles.spawnBurst(impactX, impactY, p.color, 12, { speed: 180, life: 0.5, size: 3 });
      this.game.audio.sfxExplosion(0.35);
      for (const e of this.game.enemies.list) {
        if (!e.active) continue;
        if (e.isPhased && !p.owner.tower?.flags.phaseDisruptor) continue;
        const d = e.pos.dist(new Vector2(impactX, impactY));
        if (d <= p.splashRadius) {
          const falloff = 1 - d / p.splashRadius * 0.5;
          let dmg = p.damage * falloff;
          dmg *= this.globalMul(p);
          if (p.armorBreak && e.def.armor) dmg *= 1.6;
          this.game.enemies.damage(e, dmg, this.sourceFor(p));
        }
      }
      if (p.burningGround) {
        this.game.particles.spawnDamageZone(impactX, impactY, p.splashRadius * 0.7, p.damage * 0.4, 2.5);
      }
    } else if (direct) {
      let dmg = p.damage * this.globalMul(p);
      if (p.armorPierce && (direct.type === "brute" || direct.type === "carrier")) dmg *= 1.6;
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
    return { type: "tower", towerType: p.ownerType };
  }

  private globalMul(p: Projectile): number {
    const up = this.game.core.upgrades;
    let mul = 1;
    if (p.owner.tower) {
      mul *= up.towerDamageMul;
      const spec = up.specificTowerDamageMul[p.owner.tower.type];
      if (spec) mul *= spec;
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
