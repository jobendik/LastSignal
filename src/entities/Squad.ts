import { Vector2 } from "../core/Vector2";
import { rnd } from "../core/Random";
import { squadDefinitions } from "../data/squads";
import type { SquadDefinition, SquadState, SquadType } from "../core/Types";
import type { StrategicPoint } from "./StrategicPoint";
import type { Tower } from "./Tower";

let squadIdCounter = 0;

/** Lightweight active-command flavor on top of Squad — drives behavior dispatch. */
export type SquadOrder =
  | "auto"
  | "scout"
  | "capture"
  | "repair"
  | "strike"
  | "shield"
  | "evac";

/**
 * Runtime mobile squad. Represents a small group of drone scouts/engineers/
 * strike units commanded by the player as a single beacon. Sub-drones around
 * the squad center are purely cosmetic.
 */
export class Squad {
  readonly id: number;
  readonly type: SquadType;
  readonly def: SquadDefinition;
  pos: Vector2;
  vel = new Vector2();
  state: SquadState = "spawning";
  /** World-space target the squad is moving toward / channeling on. */
  target: Vector2;
  /** Optional anchored target entity (point or tower); cleared if it dies. */
  targetPoint: StrategicPoint | null = null;
  targetTower: Tower | null = null;
  health: number;
  readonly maxHealth: number;
  /** Total lifetime in seconds. Decreases each tick; 0 = expired. */
  duration: number;
  readonly maxDuration: number;
  /** Sub-drone visual offsets (cosmetic, used by RenderSystem). */
  readonly satellites: { angle: number; orbit: number }[] = [];
  /** Spawn-in animation timer (0 → 1 over ~0.4s). */
  spawnTimer = 0.4;
  /** Cooldown for periodic combat / capture / repair / scan tick. */
  effectTimer = 0;
  /** Whether this squad has emitted its arrival scan-pulse yet (Recon). */
  scanPulseDone = false;
  /** True once removed from the active list. */
  active = true;
  /** Snapshot color so HUD can match button accents. */
  readonly color: string;
  /** Active command tag (set by MobileSquadSystem retask/deploy). */
  order: SquadOrder = "auto";
  /** True while an evac order is active and the squad is fleeing to safety. */
  evacuating = false;
  /** Live "is currently inside a hostile jammer field" — set each tick. */
  jammed = false;
  /** Live "is currently inside a hostile rift aura" — set each tick. */
  inRiftAura = false;
  /** Recent damage timestamp (game.time.elapsed) — used by HUD damage indicator. */
  lastHitTime = -Infinity;
  /** Brief retask-acknowledged flash timer (seconds). */
  ackTimer = 0;
  /** Time of last shield ring pulse so the visual ripple stays on a steady cadence. */
  lastShieldPulse = 0;
  /** True once the squad has applied a one-time scan effect at its current target. */
  scanCompletedAt: { x: number; y: number } | null = null;
  /** Last-tick HP snapshot — used to detect drops for the damage-flash badge. */
  prevHealth = 0;

  constructor(type: SquadType, x: number, y: number, target: Vector2) {
    this.id = ++squadIdCounter;
    this.type = type;
    this.def = squadDefinitions[type];
    this.pos = new Vector2(x, y);
    this.target = target.clone();
    this.health = this.def.maxHealth;
    this.maxHealth = this.def.maxHealth;
    this.prevHealth = this.health;
    this.duration = this.def.duration;
    this.maxDuration = this.def.duration;
    this.color = this.def.color;
    // Three orbital satellites for the cosmetic formation. Random offsets so
    // squads of the same type don't pulse in lockstep.
    for (let i = 0; i < 3; i++) {
      this.satellites.push({
        angle: (i / 3) * Math.PI * 2 + rnd(-0.2, 0.2),
        orbit: rnd(14, 18),
      });
    }
  }
}
