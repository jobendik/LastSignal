import type { Game } from "../core/Game";
import { Squad } from "../entities/Squad";
import { Vector2 } from "../core/Vector2";
import { squadDefinitions, squadOrder } from "../data/squads";
import {
  SQUAD_CAP_BASE,
  SQUAD_CAP_TIER_BONUS,
  TILE_SIZE,
} from "../core/Config";
import type { Enemy } from "../entities/Enemy";
import type { StrategicPoint } from "../entities/StrategicPoint";
import type { Tower } from "../entities/Tower";
import type { SquadDefinition, SquadType } from "../core/Types";

/**
 * Snapshot of a squad command's availability for the HUD. Lets the HUD render
 * locked / cooldown / cap states without reaching into the system internals.
 */
export interface SquadCommandStatus {
  type: SquadType;
  def: SquadDefinition;
  unlocked: boolean;
  affordable: boolean;
  /** True while the cooldown timer is positive. */
  onCooldown: boolean;
  /** Remaining cooldown seconds (0 when ready). */
  cooldownRemaining: number;
  /** Remaining global squad slots (across all types). */
  globalSlotsLeft: number;
  /** Active squads of this type. */
  active: number;
  /** Cap on simultaneous squads of this type. */
  capPerType: number;
  /** Reason the squad can't be deployed right now (or null when ready). */
  reason: string | null;
}

/**
 * Owns the per-run state of mobile command squads. Squads are a tactical
 * "command ability" layer on top of the existing tower-defense core: the
 * player picks a squad command from the HUD, then clicks a target location
 * to deploy. Squads then move, scout, repair, attack, or shield based on
 * type. They are NOT individual unit micro — there's no drag-select, no
 * control groups, and no production buildings.
 */
export class MobileSquadSystem {
  list: Squad[] = [];
  /** Per-type cooldown remaining (seconds). */
  cooldowns: Record<SquadType, number> = {
    recon: 0,
    engineer: 0,
    strike: 0,
    shield: 0,
  };
  /** Currently armed squad command (null = none). Set by HUD; consumed by InputSystem. */
  pendingCommand: SquadType | null = null;

  constructor(private readonly game: Game) {}

  reset(): void {
    this.list = [];
    this.cooldowns = { recon: 0, engineer: 0, strike: 0, shield: 0 };
    this.pendingCommand = null;
  }

  /** Global active squad cap (across ALL types). */
  globalCap(): number {
    return SQUAD_CAP_BASE + (this.game.core.commandTier - 1) * SQUAD_CAP_TIER_BONUS;
  }

  /** True if the squad type's tier requirement is met. */
  isUnlocked(type: SquadType): boolean {
    return this.game.core.commandTier >= squadDefinitions[type].tierRequired;
  }

  activeCountOfType(type: SquadType): number {
    let n = 0;
    for (const s of this.list) if (s.type === type && s.active) n++;
    return n;
  }

  /** Build a status snapshot for every squad type (used by HUD). */
  statuses(): SquadCommandStatus[] {
    const cap = this.globalCap();
    const slotsLeft = Math.max(0, cap - this.list.length);
    return squadOrder.map<SquadCommandStatus>((type) => {
      const def = squadDefinitions[type];
      const unlocked = this.isUnlocked(type);
      const cd = this.cooldowns[type];
      const active = this.activeCountOfType(type);
      const affordable = this.game.core.credits >= def.cost;
      let reason: string | null = null;
      if (!unlocked) reason = `Requires Command T${def.tierRequired}`;
      else if (cd > 0) reason = `Cooling down (${Math.ceil(cd)}s)`;
      else if (active >= def.capPerType) reason = `Cap reached ${active}/${def.capPerType}`;
      else if (slotsLeft <= 0) reason = `Squad cap ${this.list.length}/${cap}`;
      else if (!affordable) reason = `Need ${def.cost} CR`;
      return {
        type,
        def,
        unlocked,
        affordable,
        onCooldown: cd > 0,
        cooldownRemaining: cd,
        globalSlotsLeft: slotsLeft,
        active,
        capPerType: def.capPerType,
        reason,
      };
    });
  }

  /** Toggle / arm a squad command. Returns true if armed; false if disarmed. */
  armCommand(type: SquadType): boolean {
    if (this.pendingCommand === type) {
      this.pendingCommand = null;
      this.game.bus.emit("squad:disarm", { type });
      return false;
    }
    if (!this.canArm(type)) {
      const status = this.statuses().find((s) => s.type === type);
      if (status?.reason) {
        const corePos = this.game.grid.corePos;
        this.game.particles.spawnFloatingText(
          corePos.x,
          corePos.y - 80,
          status.reason.toUpperCase(),
          "#ff5252",
          1.0,
          11
        );
        this.game.audio.sfxShoot(0.5, 0.07);
      }
      return false;
    }
    this.pendingCommand = type;
    // Cancel any conflicting placement modes.
    this.game.input.selectedTowerType = null;
    this.game.input.showPlacementPreview = false;
    this.game.core.coreDeployMode = false;
    this.game.core.killZoneMode = false;
    this.game.bus.emit("squad:arm", { type });
    return true;
  }

  cancelCommand(): void {
    if (this.pendingCommand) {
      const type = this.pendingCommand;
      this.pendingCommand = null;
      this.game.bus.emit("squad:disarm", { type });
    }
  }

  /** Returns true if the squad command can be armed right now. */
  canArm(type: SquadType): boolean {
    const status = this.statuses().find((s) => s.type === type);
    if (!status) return false;
    if (!status.unlocked) return false;
    if (status.onCooldown) return false;
    if (status.active >= status.capPerType) return false;
    if (status.globalSlotsLeft <= 0) return false;
    if (!status.affordable) return false;
    // Squads can be deployed during planning and active waves only.
    const st = this.game.state;
    return st === "PLANNING" || st === "WAVE_ACTIVE";
  }

  /**
   * Deploy a squad of the pending command type at a world-space target.
   * Returns true on success. The InputSystem calls this when the player
   * clicks on the map while a command is armed.
   */
  deployAt(targetX: number, targetY: number): boolean {
    const type = this.pendingCommand;
    if (!type) return false;
    if (!this.canArm(type)) return false;
    const def = squadDefinitions[type];
    if (!this.game.spendCredits(def.cost)) return false;

    // Spawn from the nearest active core / relay center so the deployment
    // visibly originates from the player's signal network.
    const origin = this.game.grid.getNearestCoreCenter(targetX, targetY);
    const target = new Vector2(targetX, targetY);
    const squad = new Squad(type, origin.x, origin.y, target);
    this.list.push(squad);
    this.cooldowns[type] = def.cooldown;
    this.pendingCommand = null;

    // Deployment FX — burst and floating text near the spawn point.
    const color = def.color;
    this.game.particles.spawnRing(origin.x, origin.y, 32, color, 0.45);
    this.game.particles.spawnBurst(origin.x, origin.y, color, 12, {
      speed: 140,
      life: 0.45,
      size: 2.2,
    });
    this.game.particles.spawnFloatingText(
      origin.x,
      origin.y - 24,
      this.deployLabel(type),
      color,
      1.2,
      12
    );
    this.game.audio.sfxReward();
    this.game.bus.emit("squad:deployed", { type, x: targetX, y: targetY });
    return true;
  }

  private deployLabel(type: SquadType): string {
    switch (type) {
      case "recon":
        return "RECON DEPLOYED";
      case "engineer":
        return "ENGINEERS DEPLOYED";
      case "strike":
        return "STRIKE SQUAD DEPLOYED";
      case "shield":
        return "SHIELD ONLINE";
    }
  }

  // ──────────────────────────────────────────────────────────
  // Update
  // ──────────────────────────────────────────────────────────
  update(dt: number): void {
    // Tick cooldowns regardless of state so the player's command panel
    // shows progress while a wave is rolling. They only freeze on pause.
    for (const t of squadOrder) {
      if (this.cooldowns[t] > 0) {
        this.cooldowns[t] = Math.max(0, this.cooldowns[t] - dt);
      }
    }

    // Squads themselves are driven by simulation dt, so they freeze during
    // pause and slow during slow-mo just like enemies/towers/drones.
    for (const s of this.list) {
      if (!s.active) continue;
      if (s.spawnTimer > 0) s.spawnTimer = Math.max(0, s.spawnTimer - dt);
      this.tickSquad(s, dt);
    }

    // Sweep destroyed/expired squads.
    if (this.list.some((s) => !s.active)) {
      this.list = this.list.filter((s) => s.active);
    }
  }

  /** Per-frame behavior dispatch. */
  private tickSquad(s: Squad, dt: number): void {
    // Duration timer always counts down once spawning is complete.
    if (s.spawnTimer <= 0) {
      s.duration -= dt;
      if (s.duration <= 0) {
        this.expireSquad(s);
        return;
      }
    }

    // Squad center vulnerability: if any enemy is in close contact, take
    // small contact damage. Bosses ignore squads (they're focused on the
    // core path). This keeps wave behavior stable while still making
    // squads feel risky.
    this.applyContactDamage(s, dt);
    if (this.game.strategicPoints) {
      // Hostile zones (rift anchor aura, jammer) chip squads.
      const auraMul = this.game.strategicPoints.riftAuraMultiplier(s.pos.x, s.pos.y);
      if (auraMul > 1) s.health -= dt * 4;
      if (this.game.strategicPoints.isWorldPointJammed(s.pos.x, s.pos.y)) {
        s.health -= dt * 3;
      }
    }
    if (s.health <= 0) {
      this.destroySquad(s);
      return;
    }

    // Light reveal pulse so squads always contribute to darkness reveal.
    this.contributeReveal(s);

    // Behavior dispatch.
    switch (s.type) {
      case "recon":
        this.updateRecon(s, dt);
        break;
      case "engineer":
        this.updateEngineer(s, dt);
        break;
      case "strike":
        this.updateStrike(s, dt);
        break;
      case "shield":
        this.updateShield(s, dt);
        break;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Movement helpers
  // ──────────────────────────────────────────────────────────
  /** Move squad toward `target` at its base speed. Returns distance to target. */
  private moveToward(s: Squad, target: Vector2, dt: number): number {
    const dx = target.x - s.pos.x;
    const dy = target.y - s.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) {
      s.vel.set(0, 0);
      return dist;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    // Smoothly steer the velocity toward the desired direction so motion
    // feels less jittery than instant-snap velocity.
    const desiredVx = nx * s.def.speed;
    const desiredVy = ny * s.def.speed;
    s.vel.x += (desiredVx - s.vel.x) * Math.min(1, dt * 6);
    s.vel.y += (desiredVy - s.vel.y) * Math.min(1, dt * 6);
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;
    // Clamp inside the world.
    const margin = 8;
    s.pos.x = Math.max(margin, Math.min(this.game.grid.worldW - margin, s.pos.x));
    s.pos.y = Math.max(margin, Math.min(this.game.grid.worldH - margin, s.pos.y));
    return dist;
  }

  /** True if the squad is "at" its current target position. */
  private hasArrived(s: Squad, target: Vector2): boolean {
    const dx = target.x - s.pos.x;
    const dy = target.y - s.pos.y;
    return dx * dx + dy * dy < 18 * 18;
  }

  // ──────────────────────────────────────────────────────────
  // Recon — fast scout. Reveals darkness and exposes hidden points.
  // ──────────────────────────────────────────────────────────
  private updateRecon(s: Squad, dt: number): void {
    const dist = this.moveToward(s, s.target, dt);
    if (dist < 14) {
      s.state = "scouting";
      // One-shot scan pulse on arrival — bigger than the passive reveal.
      if (!s.scanPulseDone) {
        s.scanPulseDone = true;
        this.game.particles.spawnRing(s.pos.x, s.pos.y, s.def.revealRadius * 0.9, s.def.color, 0.6);
        this.game.particles.spawnRing(s.pos.x, s.pos.y, s.def.revealRadius * 0.5, "#ffffff", 0.4);
        this.game.particles.spawnFloatingText(s.pos.x, s.pos.y - 26, "SCAN COMPLETE", s.def.color, 1.0, 11);
        this.exposeStrategicPointsNear(s);
      }
      // After arrival, slowly orbit to keep the scan alive.
      const wander = (this.game.time.elapsed * 0.4) % (Math.PI * 2);
      s.pos.x += Math.cos(wander) * 8 * dt;
      s.pos.y += Math.sin(wander) * 8 * dt;
    } else {
      s.state = "moving";
      // Periodically expose newly-detected strategic points while in transit.
      s.effectTimer -= dt;
      if (s.effectTimer <= 0) {
        s.effectTimer = 0.6;
        this.exposeStrategicPointsNear(s);
      }
    }
  }

  /** Mark hidden strategic points / hostile structures within the recon's reach as discovered. */
  private exposeStrategicPointsNear(s: Squad): void {
    const sps = this.game.strategicPoints;
    if (!sps) return;
    const radius = s.def.revealRadius;
    const r2 = radius * radius;
    for (const p of sps.list) {
      if (p.discovered) continue;
      if (p.state === "destroyed" || p.state === "depleted") continue;
      const dx = p.pos.x - s.pos.x;
      const dy = p.pos.y - s.pos.y;
      if (dx * dx + dy * dy <= r2) {
        p.discovered = true;
        if (p.state === "enemy") {
          this.game.particles.spawnFloatingText(
            p.pos.x,
            p.pos.y - 28,
            "HOSTILE STRUCTURE DETECTED",
            "#ff5252",
            1.4,
            11
          );
          this.game.particles.spawnRing(p.pos.x, p.pos.y, 36, "#ff5252", 0.4);
          this.game.bus.emit("strategic:discovered", { id: p.id, type: p.type });
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // Engineer — accelerates capture, repairs disabled towers, and slowly
  // restores small core integrity while channeling near a real cluster.
  // ──────────────────────────────────────────────────────────
  private updateEngineer(s: Squad, dt: number): void {
    // Re-resolve target if the original entity has gone away.
    if (s.targetPoint && (s.targetPoint.state === "destroyed" || s.targetPoint.state === "depleted")) {
      s.targetPoint = null;
    }
    if (s.targetTower && !this.game.towers.list.includes(s.targetTower)) {
      s.targetTower = null;
    }

    const point = s.targetPoint ?? this.findNearbyCapturablePoint(s);
    const tower = s.targetTower ?? this.findNearbyDisabledTower(s);

    // Prefer capturable strategic point > disabled tower > target location.
    if (point) {
      s.targetPoint = point;
      const dist = this.moveToward(s, point.pos, dt);
      if (dist < s.def.interactionRadius) {
        s.state = "capturing";
        // Engineer accelerates capture progress on neutral points whenever
        // they're inside player coverage. We push directly into captureProgress
        // so the existing StrategicPointSystem still runs all of its
        // pulse/reward bookkeeping when the point completes naturally.
        if (point.state === "neutral" && point.inCoverage && !point.contested) {
          const rate = 1 / Math.max(0.5, point.captureSeconds);
          const boost = (s.def.captureMultiplier ?? 1) - 1;
          point.captureProgress = Math.min(
            1,
            point.captureProgress + dt * rate * boost
          );
          s.effectTimer -= dt;
          if (s.effectTimer <= 0) {
            s.effectTimer = 0.9;
            this.game.particles.spawnFloatingText(
              point.pos.x,
              point.pos.y - 32,
              "CAPTURE BOOSTED",
              s.def.color,
              0.7,
              10
            );
          }
          this.drawWorkBeam(s.pos, point.pos, s.def.color);
        }
        return;
      }
      s.state = "moving";
      return;
    }

    if (tower) {
      s.targetTower = tower;
      const dist = this.moveToward(s, tower.pos, dt);
      if (dist < s.def.interactionRadius) {
        s.state = "repairing";
        // Drain remaining disabled timer faster — equivalent of "repairing
        // a damaged tower" since towers don't have HP. Also speeds up
        // mid-construction tower build progress.
        const disabledMap = this.game.towers.disabled;
        const remaining = disabledMap.get(tower);
        if (remaining != null && remaining > 0) {
          const next = Math.max(0, remaining - dt * 2.2);
          if (next <= 0) disabledMap.delete(tower);
          else disabledMap.set(tower, next);
        }
        if (tower.buildProgress < 1) {
          tower.buildProgress = Math.min(1, tower.buildProgress + dt * 1.6);
        }
        s.effectTimer -= dt;
        if (s.effectTimer <= 0) {
          s.effectTimer = 1.2;
          this.game.particles.spawnFloatingText(
            tower.pos.x,
            tower.pos.y - 30,
            "REPAIRING",
            s.def.color,
            0.7,
            10
          );
        }
        this.drawWorkBeam(s.pos, tower.pos, s.def.color);
        return;
      }
      s.state = "moving";
      return;
    }

    // Default behavior: hold position at the target and slowly heal the
    // nearest cluster's integrity if we're inside its signal coverage.
    const dist = this.moveToward(s, s.target, dt);
    if (dist < 14) {
      s.state = "repairing";
      const cluster = this.game.grid.getNearestCoreCenter(s.pos.x, s.pos.y);
      const dx = s.pos.x - cluster.x;
      const dy = s.pos.y - cluster.y;
      // Only stabilize if we're close to a real cluster and core integrity is below max.
      if (dx * dx + dy * dy < (s.def.interactionRadius * 1.4) * (s.def.interactionRadius * 1.4)) {
        const repairPerSecond = s.def.repairPerSecond ?? 0;
        if (this.game.core.coreIntegrity < this.game.core.coreMax) {
          this.game.core.coreIntegrity = Math.min(
            this.game.core.coreMax,
            this.game.core.coreIntegrity + repairPerSecond * dt * 0.55
          );
          s.effectTimer -= dt;
          if (s.effectTimer <= 0) {
            s.effectTimer = 1.5;
            this.game.particles.spawnFloatingText(cluster.x, cluster.y - 38, "+CORE", s.def.color, 0.7, 10);
          }
          this.drawWorkBeam(s.pos, cluster, s.def.color);
        }
      }
    } else {
      s.state = "moving";
    }
  }

  private findNearbyCapturablePoint(s: Squad): StrategicPoint | null {
    const sps = this.game.strategicPoints;
    if (!sps) return null;
    let best: StrategicPoint | null = null;
    let bestSq = 220 * 220;
    for (const p of sps.list) {
      if (p.state !== "neutral") continue;
      const dx = p.pos.x - s.target.x;
      const dy = p.pos.y - s.target.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = p;
      }
    }
    return best;
  }

  private findNearbyDisabledTower(s: Squad): Tower | null {
    const towers = this.game.towers.list;
    let best: Tower | null = null;
    let bestSq = 220 * 220;
    for (const t of towers) {
      const isDisabled = this.game.towers.disabled.has(t) || t.buildProgress < 1;
      if (!isDisabled) continue;
      const dx = t.pos.x - s.target.x;
      const dy = t.pos.y - s.target.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = t;
      }
    }
    return best;
  }

  private drawWorkBeam(a: Vector2, b: Vector2, color: string): void {
    // Short-lived beam — refreshed each tick so it appears continuous while
    // engineering, then fades when the squad moves away or the work completes.
    this.game.particles.spawnBeam(a.x, a.y, b.x, b.y, color, 0.18, { width: 2 });
  }

  // ──────────────────────────────────────────────────────────
  // Strike — combat squad. Targets hostile structures, then enemies near it.
  // ──────────────────────────────────────────────────────────
  private updateStrike(s: Squad, dt: number): void {
    // Stay near the commanded target so the player's intent is honored, but
    // the squad will engage opportunistic enemies en route.
    const dist = this.moveToward(s, s.target, dt);
    s.state = dist < 18 ? "attacking" : "moving";
    s.effectTimer -= dt;
    if (s.effectTimer > 0) return;
    s.effectTimer = s.def.attackCooldown ?? 0.6;

    // Priority order:
    //  1. directly-targeted hostile structure
    //  2. enemy within interaction radius
    //  3. nearby hostile structure when no enemies in range
    const struct = this.findNearbyHostileStructure(s);
    const enemy = this.findNearbyEnemy(s);
    if (struct && enemy) {
      // If the enemy is dangerously close, prioritize survival.
      if (enemy.pos.dist(s.pos) < 60) this.attackEnemy(s, enemy);
      else this.attackStructure(s, struct);
    } else if (enemy) {
      this.attackEnemy(s, enemy);
    } else if (struct) {
      this.attackStructure(s, struct);
    }
  }

  private findNearbyEnemy(s: Squad): Enemy | null {
    const r = s.def.interactionRadius;
    const r2 = r * r;
    let best: Enemy | null = null;
    let bestSq = r2;
    for (const e of this.game.enemies.list) {
      if (!e.active || e.isPhased || e.isTunneling) continue;
      const dx = e.pos.x - s.pos.x;
      const dy = e.pos.y - s.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = e;
      }
    }
    return best;
  }

  private findNearbyHostileStructure(s: Squad): StrategicPoint | null {
    const sps = this.game.strategicPoints;
    if (!sps) return null;
    const r = s.def.interactionRadius;
    const r2 = r * r;
    let best: StrategicPoint | null = null;
    let bestSq = r2;
    for (const p of sps.list) {
      if (p.state !== "enemy") continue;
      const dx = p.pos.x - s.pos.x;
      const dy = p.pos.y - s.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = p;
      }
    }
    return best;
  }

  private attackEnemy(s: Squad, e: Enemy): void {
    const dmg = s.def.damage ?? 6;
    e.damage(dmg, { type: "drone" });
    this.game.particles.spawnBeam(s.pos.x, s.pos.y, e.pos.x, e.pos.y, s.def.color, 0.14, { width: 2 });
    this.game.particles.spawnBurst(e.pos.x, e.pos.y, s.def.color, 4, {
      speed: 90,
      life: 0.3,
      size: 2,
    });
    this.game.audio.sfxShoot(1.6, 0.1, "bullet", s.pos);
  }

  private attackStructure(s: Squad, p: StrategicPoint): void {
    const baseDmg = s.def.damage ?? 6;
    const dmg = baseDmg * (s.def.structureDamageMul ?? 1.5);
    const destroyed = this.game.strategicPoints.damageStructure(p, dmg, { source: "drone" });
    this.game.particles.spawnBeam(s.pos.x, s.pos.y, p.pos.x, p.pos.y, s.def.color, 0.18, { width: 2.5 });
    if (destroyed) {
      this.game.particles.spawnFloatingText(
        p.pos.x,
        p.pos.y - 50,
        "HOSTILE STRUCTURE DESTROYED",
        s.def.color,
        1.6,
        12
      );
    }
  }

  // ──────────────────────────────────────────────────────────
  // Shield — projects a stabilizing field at the deployed location.
  // ──────────────────────────────────────────────────────────
  private updateShield(s: Squad, dt: number): void {
    const dist = this.moveToward(s, s.target, dt);
    if (dist < 18) {
      s.state = "shielding";
      // Slow enemies inside the shield bubble; this is the visible "field".
      const slowAmount = s.def.shieldSlowAmount ?? 0.5;
      const radius = s.def.interactionRadius;
      const r2 = radius * radius;
      for (const e of this.game.enemies.list) {
        if (!e.active || e.isBoss) continue;
        const dx = e.pos.x - s.pos.x;
        const dy = e.pos.y - s.pos.y;
        if (dx * dx + dy * dy < r2) {
          e.applySlow(0.4, 1 - slowAmount);
        }
      }
      // Periodic ripple ring to telegraph the active field.
      s.effectTimer -= dt;
      if (s.effectTimer <= 0) {
        s.effectTimer = 1.0;
        this.game.particles.spawnRing(s.pos.x, s.pos.y, radius, s.def.color, 0.5);
      }
    } else {
      s.state = "moving";
    }
  }

  /**
   * Total damage reduction applied to core damage when it lands inside any
   * active shield squad's field. Game.damageCore consults this. Returns the
   * residual fraction (0..1) that should still be applied — 1 means no
   * reduction, 0 means fully absorbed.
   */
  shieldDamageMul(x: number, y: number): number {
    let mul = 1;
    for (const s of this.list) {
      if (s.type !== "shield" || !s.active) continue;
      if (s.state !== "shielding" && s.state !== "moving") continue;
      const radius = s.def.interactionRadius;
      const dx = x - s.pos.x;
      const dy = y - s.pos.y;
      if (dx * dx + dy * dy <= radius * radius) {
        const reduction = s.def.shieldDamageReduction ?? 0.4;
        mul *= 1 - reduction;
      }
    }
    return mul;
  }

  // ──────────────────────────────────────────────────────────
  // Vulnerability + reveal helpers
  // ──────────────────────────────────────────────────────────
  private applyContactDamage(s: Squad, dt: number): void {
    const r = 26;
    const r2 = r * r;
    let chip = 0;
    for (const e of this.game.enemies.list) {
      if (!e.active || e.isBoss) continue;
      const dx = e.pos.x - s.pos.x;
      const dy = e.pos.y - s.pos.y;
      if (dx * dx + dy * dy <= r2) {
        chip += 8 * dt;
      }
    }
    if (chip > 0) s.health -= chip;
  }

  private contributeReveal(s: Squad): void {
    // Mark the squad's vicinity as discovered for any nearby strategic point
    // so the player gets passive reveal even without a Recon squad. Recon
    // just covers more ground per second.
    const sps = this.game.strategicPoints;
    if (!sps) return;
    const radius = s.def.revealRadius * 0.7;
    const r2 = radius * radius;
    for (const p of sps.list) {
      if (p.discovered) continue;
      if (p.state === "destroyed" || p.state === "depleted") continue;
      const dx = p.pos.x - s.pos.x;
      const dy = p.pos.y - s.pos.y;
      if (dx * dx + dy * dy <= r2) {
        p.discovered = true;
        this.game.bus.emit("strategic:discovered", { id: p.id, type: p.type });
      }
    }
  }

  /**
   * Public per-squad reveal radius used by the renderer's darkness pass.
   * Returns 0 for an inactive squad. Strike/Recon contribute the most.
   */
  squadRevealRadius(s: Squad): number {
    if (!s.active) return 0;
    return s.def.revealRadius;
  }

  /** Public per-squad cap used by the HUD. */
  globalSlotsLeft(): number {
    return Math.max(0, this.globalCap() - this.list.length);
  }

  // ──────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────
  private expireSquad(s: Squad): void {
    s.state = "expired";
    s.active = false;
    this.game.particles.spawnRing(s.pos.x, s.pos.y, 22, s.def.color, 0.4);
    this.game.particles.spawnFloatingText(s.pos.x, s.pos.y - 22, "SQUAD RECALLED", s.def.color, 0.9, 10);
    this.game.bus.emit("squad:expired", { type: s.type, id: s.id });
  }

  private destroySquad(s: Squad): void {
    s.state = "destroyed";
    s.active = false;
    this.game.particles.spawnRing(s.pos.x, s.pos.y, 36, "#ff5252", 0.5);
    this.game.particles.spawnBurst(s.pos.x, s.pos.y, s.def.color, 14, {
      speed: 160,
      life: 0.5,
      size: 2.2,
    });
    this.game.particles.spawnFloatingText(s.pos.x, s.pos.y - 28, "SQUAD LOST", "#ff5252", 1.3, 12);
    this.game.audio.sfxExplosion(0.4);
    this.game.bus.emit("squad:destroyed", { type: s.type, id: s.id });
  }

  /** Sanity utility for input/HUD modules. */
  static cellToWorld(c: number, r: number): Vector2 {
    return new Vector2(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2);
  }
}
