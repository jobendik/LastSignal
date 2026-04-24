import type { Game } from "../core/Game";
import { Drone } from "../entities/Drone";
import type { DroneType } from "../core/Types";
import { droneDefinitions } from "../data/drones";
import { Vector2 } from "../core/Vector2";
import { Projectile } from "../entities/Projectile";
import { clamp, rnd } from "../core/Random";
import { MAX_DRONES, STARTING_DRONE_COST, DRONE_COST_SCALING, VIEW_HEIGHT, VIEW_WIDTH } from "../core/Config";

/**
 * Drone behavior. Hunter: seek-and-fire. Scanner: reveals phantoms. Guardian: orbits core.
 */
export class DroneSystem {
  list: Drone[] = [];

  constructor(private readonly game: Game) {}

  reset(): void {
    this.list.length = 0;
  }

  nextCost(type: DroneType): number {
    const def = droneDefinitions[type];
    const sameCount = this.list.filter((d) => d.type === type).length;
    const base = Math.max(def.cost, STARTING_DRONE_COST);
    return Math.floor(base * Math.pow(DRONE_COST_SCALING, sameCount));
  }

  canBuy(type: DroneType): boolean {
    if (this.list.length >= MAX_DRONES) return false;
    return this.game.core.credits >= this.nextCost(type);
  }

  buy(type: DroneType): Drone | null {
    if (!this.canBuy(type)) return null;
    const cost = this.nextCost(type);
    this.game.core.credits -= cost;
    const core = this.game.grid.corePos;
    const d = new Drone(type, core.x + rnd(-30, 30), core.y + rnd(-30, 30));
    this.list.push(d);
    this.game.bus.emit("drone:bought", d);
    return d;
  }

  update(dt: number): void {
    for (const d of this.list) {
      d.timer -= dt;
      if (d.type === "hunter") this.updateHunter(d, dt);
      else if (d.type === "scanner") this.updateScanner(d, dt);
      else if (d.type === "guardian") this.updateGuardian(d, dt);

      d.pos.x = clamp(d.pos.x, 8, VIEW_WIDTH - 8);
      d.pos.y = clamp(d.pos.y, 8, VIEW_HEIGHT - 8);

      if (d.vel.mag() > 0.1) {
        const targetAng = Math.atan2(d.vel.y, d.vel.x);
        let diff = targetAng - d.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        d.angle += diff * 10 * dt;
      }
    }
  }

  private updateHunter(d: Drone, dt: number): void {
    let target = null;
    let min = Infinity;
    for (const e of this.game.enemies.list) {
      if (!e.active || e.isPhased) continue;
      const dist = e.pos.dist(d.pos);
      if (dist < min) { min = dist; target = e; }
    }
    let steer = new Vector2();
    if (target && min < 300) {
      steer = this.seek(d, target.pos);
      if (min < d.range + this.game.core.upgrades.droneRangeAdd && d.timer <= 0) {
        this.fire(d, target);
        d.timer = d.cooldown;
      }
    } else {
      steer = this.wander(d);
      const core = this.game.grid.corePos;
      if (d.pos.dist(core) > 180) steer = steer.add(this.seek(d, core).mult(2));
    }
    steer = steer.add(this.separate(d).mult(1.4));
    d.vel = d.vel.add(steer.mult(dt));
    if (d.vel.mag() > d.maxSpeed) d.vel = d.vel.normalize().mult(d.maxSpeed);
    d.pos = d.pos.add(d.vel.mult(dt));
  }

  private updateScanner(d: Drone, dt: number): void {
    // Wander close to the active path area. Reveals phantoms by granting them visibility bonus briefly.
    const target = this.findPhantom();
    let steer;
    if (target) {
      steer = this.seek(d, target.pos);
      if (d.pos.dist(target.pos) < d.range + this.game.core.upgrades.droneRangeAdd) {
        // Temporarily extend visibility on phantoms near the scanner.
        for (const e of this.game.enemies.list) {
          if (!e.active || e.ability !== "phase") continue;
          if (e.pos.dist(d.pos) < d.range) e.phaseVisibilityBonus = Math.max(e.phaseVisibilityBonus, 0.5);
        }
        if (d.timer <= 0) {
          this.game.particles.spawnRing(d.pos.x, d.pos.y, 26, d.color);
          d.timer = d.cooldown;
        }
      }
    } else {
      steer = this.wander(d);
    }
    steer = steer.add(this.separate(d).mult(1.2));
    d.vel = d.vel.add(steer.mult(dt));
    if (d.vel.mag() > d.maxSpeed) d.vel = d.vel.normalize().mult(d.maxSpeed);
    d.pos = d.pos.add(d.vel.mult(dt));
  }

  private updateGuardian(d: Drone, dt: number): void {
    // Orbit core.
    d.orbit += dt * 1.2;
    const core = this.game.grid.corePos;
    const targetPos = new Vector2(core.x + Math.cos(d.orbit) * 70, core.y + Math.sin(d.orbit) * 70);
    const steer = this.seek(d, targetPos);
    d.vel = d.vel.add(steer.mult(dt));
    if (d.vel.mag() > d.maxSpeed) d.vel = d.vel.normalize().mult(d.maxSpeed);
    d.pos = d.pos.add(d.vel.mult(dt));

    // Intercept enemies very close to core.
    let target = null as null | typeof this.game.enemies.list[number];
    let min = d.range;
    for (const e of this.game.enemies.list) {
      if (!e.active || e.isPhased) continue;
      const dc = e.pos.dist(core);
      if (dc < 90 && e.pos.dist(d.pos) < min) {
        min = e.pos.dist(d.pos);
        target = e;
      }
    }
    if (target && d.timer <= 0) {
      this.fire(d, target);
      d.timer = d.cooldown;
    }
  }

  private findPhantom() {
    for (const e of this.game.enemies.list) {
      if (e.active && e.ability === "phase") return e;
    }
    return null;
  }

  private seek(d: Drone, tgt: Vector2): Vector2 {
    const desired = tgt.sub(d.pos).normalize().mult(d.maxSpeed);
    let steer = desired.sub(d.vel);
    if (steer.mag() > d.maxForce) steer = steer.normalize().mult(d.maxForce);
    return steer;
  }

  private wander(d: Drone): Vector2 {
    d.wanderAngle += rnd(-0.48, 0.48);
    const circleCenter = d.vel.mag() > 0 ? d.vel.normalize().mult(50) : new Vector2();
    const displacement = new Vector2(Math.cos(d.wanderAngle), Math.sin(d.wanderAngle)).mult(25);
    let force = circleCenter.add(displacement);
    if (force.mag() > d.maxForce) force = force.normalize().mult(d.maxForce);
    return force;
  }

  private separate(d: Drone): Vector2 {
    let steer = new Vector2();
    let count = 0;
    for (const other of this.list) {
      if (other === d) continue;
      const dist = d.pos.dist(other.pos);
      if (dist > 0 && dist < 40) {
        steer = steer.add(d.pos.sub(other.pos).normalize().mult(1 / dist));
        count++;
      }
    }
    if (count > 0) {
      steer = steer.mult(1 / count);
      if (steer.mag() > 0) steer = steer.normalize().mult(d.maxSpeed).sub(d.vel);
      if (steer.mag() > d.maxForce) steer = steer.normalize().mult(d.maxForce);
    }
    return steer;
  }

  private fire(d: Drone, target: NonNullable<ReturnType<DroneSystem["findPhantom"]>>): void {
    let dmg = d.damage + this.game.core.upgrades.droneDamageAdd;
    if (target.signalMarked) dmg *= 1.25;
    this.game.projectiles.spawn(
      new Projectile({
        pos: d.pos,
        target,
        damage: dmg,
        color: d.color,
        speed: 500,
        kind: "bullet",
        owner: { isDrone: true },
        ownerType: "drone",
      })
    );
    this.game.audio.sfxShoot(1.5, 0.12);
  }
}
