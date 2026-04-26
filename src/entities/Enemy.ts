import { Vector2 } from "../core/Vector2";
import type {
  EnemyDefinition,
  EnemyType,
  TowerType,
} from "../core/Types";
import type { Tower } from "./Tower";
import { enemyDefinitions } from "../data/enemies";
import { clamp, rnd } from "../core/Random";

export type DamageSource =
  | { type: "tower"; towerType: TowerType; tower?: Tower }
  | { type: "drone" }
  | { type: "other" };

/** Runtime enemy entity. All behavior that depends on the world lives in EnemySystem. */
export class Enemy {
  type: EnemyType;
  def: EnemyDefinition;
  pos: Vector2;
  vel = new Vector2();
  knockbackVel = new Vector2();

  hp: number;
  maxHp: number;

  baseSpeed: number;
  speedMul = 1;
  slowTimer = 0;
  slowStrength = 0.5; // multiplier applied while slowed
  stunTimer = 0;

  reward: number;
  breach: number;
  color: string;
  size: number;
  isBoss: boolean;
  ability: EnemyDefinition["ability"];

  active = true;
  timer = 0;
  isPhased = false;
  phaseOffset = rnd(0, Math.PI * 2);
  phaseVisibilityBonus = 0; // added to visible window fraction
  healCooldown = rnd(0.4, 1.2);
  lastDamageSource: DamageSource | null = null;
  damageTakenThisWave = 0;
  freezeFxTimer = 0;
  freezeFxMax = 1;
  spawnFxTimer = 0;
  spawnFxMax = 0.35;
  breached = false;

  // Boss-only phase tracker.
  bossPhase = 0;
  bossPhaseTimer = 0;
  bossRushing = false;
  /** Seconds remaining in the boss entrance cinematic (boss is frozen while > 0). */
  bossEntranceTimer = 0;
  readonly bossEntranceMax = 2.2;

  // Specialization marks.
  signalMarked = false;

  /** Extra armor added by run modifiers (flat 0..1, stacked with def.armor). */
  extraArmor = 0;

  // Tunneler-specific state.
  isTunneling = false;
  /** Counts up; triggers underground dive when it reaches tunnelInterval. */
  tunnelTimer = 0;
  /** Randomized interval (seconds) between tunnel dives. */
  tunnelInterval = 3.5 + Math.random() * 2;
  /** 0..1 — animation progress for dive/surface transitions. */
  tunnelTransitionProg = 0;

  // Saboteur-specific state.
  /** Seconds remaining until this Saboteur can disable another tower. */
  saboteurCooldown = 0;

  /** True if this enemy is an elite mini-boss variant (150% HP, glowing border). */
  isElite = false;

  /**
   * Flanking direction: ±1 makes this enemy add a lateral perpendicular force to their
   * flow-field vector, diverging from the main lane. 0 = standard pathing.
   */
  flankDir: -1 | 0 | 1 = 0;

  // Battle damage marks — set when hit by a specific tower type, persist until death.
  burnMark = false;    // Flamer
  iceMark = false;     // Stasis
  electricMark = false; // Tesla

  /** Number of active shield drones orbiting this enemy. Each absorbs one hit. */
  shieldDroneCount = 0;
  /** Orbit phase angles for each shield drone slot. */
  readonly shieldDroneAngles = [0, Math.PI * 2 / 3, Math.PI * 4 / 3];

  // Mirror-specific state: reflects projectiles back at source tower.
  mirrorCharges = 3; // remaining reflections before mirror breaks
  mirrorCooldown = 0; // seconds between reflections

  // Harbinger artillery boss state.
  artilleryCooldown = 2.8;
  leviathanSegments: { hp: number; maxHp: number; angle: number; active: boolean }[] = [];

  // Singularity pull state applied by upgraded Stasis towers.
  singularityTimer = 0;
  singularityMax = 1;
  singularityX = 0;
  singularityY = 0;

  constructor(type: EnemyType, x: number, y: number, hpOverride?: number) {
    const def = enemyDefinitions[type];
    this.def = def;
    this.type = type;
    this.pos = new Vector2(x, y);
    this.hp = hpOverride ?? def.hp;
    this.maxHp = this.hp;
    this.baseSpeed = def.speed;
    this.reward = def.reward;
    this.breach = def.breach;
    this.color = def.color;
    this.size = def.size;
    this.isBoss = Boolean(def.isBoss);
    this.ability = def.ability;
    if (type === "leviathan") {
      this.leviathanSegments = Array.from({ length: 7 }, (_, i) => ({
        hp: this.maxHp / 7,
        maxHp: this.maxHp / 7,
        angle: (i / 7) * Math.PI * 2,
        active: true,
      }));
    }
  }

  get currentSpeed(): number {
    if (this.stunTimer > 0) return 0;
    let s = this.baseSpeed * this.speedMul;
    if (this.slowTimer > 0) s *= this.slowStrength;
    return s;
  }

  damage(amount: number, source: DamageSource | null): number {
    // Shield drones absorb the next tower or drone hit before it reaches the enemy.
    if (this.shieldDroneCount > 0 && source != null && source.type !== "other") {
      this.shieldDroneCount--;
      // Signal absorption via a marker the caller/renderer can check (no HP lost).
      return 0;
    }
    const armor = Math.min(0.95, (this.def.armor ?? 0) + this.extraArmor);
    const actual = amount * (1 - armor);
    if (this.type === "leviathan" && this.leviathanSegments.length > 0) {
      const live = this.leviathanSegments.filter((s) => s.active);
      const seg = live[Math.floor(Math.random() * live.length)];
      if (seg) {
        seg.hp -= actual;
        if (seg.hp <= 0) seg.active = false;
      }
    }
    this.hp -= actual;
    this.damageTakenThisWave += actual;
    this.lastDamageSource = source ?? this.lastDamageSource;
    if (source?.type === "tower") {
      if (source.towerType === "flamer") this.burnMark = true;
      else if (source.towerType === "stasis") this.iceMark = true;
      else if (source.towerType === "tesla") this.electricMark = true;
    }
    if (this.hp <= 0) this.active = false;
    return actual;
  }

  applySlow(duration: number, strength: number): void {
    // Keep the strongest/longest of current vs new slow.
    if (duration > this.slowTimer) this.slowTimer = duration;
    if (strength < this.slowStrength) this.slowStrength = strength;
  }

  applyStun(duration: number): void {
    if (duration > this.stunTimer) this.stunTimer = duration;
  }

  /** Phantom phase visibility: true when the enemy can be damaged. */
  get visible(): boolean {
    if (this.ability !== "phase") return true;
    // Visibility window widens with phaseVisibilityBonus.
    const threshold = clamp(0.35 - this.phaseVisibilityBonus * 0.4, -0.5, 0.5);
    return Math.sin(this.timer * 2.1 + this.phaseOffset) <= threshold;
  }
}
