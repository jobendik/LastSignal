import { Vector2 } from "../core/Vector2";
import type {
  DamageType,
  EnemyDefinition,
  EnemyType,
  TowerType,
} from "../core/Types";
import { enemyDefinitions } from "../data/enemies";
import { clamp, rnd } from "../core/Random";

export type DamageSource =
  | { type: "tower"; towerType: TowerType; damageType?: DamageType }
  | { type: "drone" }
  | { type: "other" };

/** Runtime enemy entity. All behavior that depends on the world lives in EnemySystem. */
export class Enemy {
  type: EnemyType;
  def: EnemyDefinition;
  pos: Vector2;
  vel = new Vector2();

  hp: number;
  maxHp: number;

  baseSpeed: number;
  speedMul = 1;
  slowTimer = 0;
  slowStrength = 0.5; // multiplier applied while slowed
  stunTimer = 0;
  burnTimer = 0;
  burnDps = 0;

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
  hitOnce = false;

  // Boss-only phase tracker.
  bossPhase = 0;
  bossPhaseTimer = 0;
  bossRushing = false;

  // Specialization marks.
  signalMarked = false;

  // Shielded
  shieldHp = 0;
  shieldMax = 0;

  // Sapper
  exploded = false;
  explodeTimer = 0;

  // Corruptor
  corruptRadius = 96;

  // Last movement direction (for frontal-shield checks).
  faceX = 1;
  faceY = 0;

  // Hit flash timer (white flash when hit).
  hitFlash = 0;

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
    if (def.shieldHp) {
      this.shieldHp = def.shieldHp;
      this.shieldMax = def.shieldHp;
    }
  }

  get currentSpeed(): number {
    if (this.stunTimer > 0) return 0;
    let s = this.baseSpeed * this.speedMul;
    if (this.slowTimer > 0) s *= this.slowStrength;
    return s;
  }

  /**
   * Apply incoming damage to the enemy.
   * Returns the actual HP damage dealt (not shield damage) for stats/bounty tracking.
   */
  damage(amount: number, source: DamageSource | null, bypassShield = false, fromBack = false): number {
    let remaining = amount;

    // Resistance by damage type.
    if (source && "damageType" in source && source.damageType) {
      const resist = this.def.resist?.[source.damageType];
      if (resist) remaining *= 1 - resist;
    }

    // Shield absorbs frontal damage first.
    if (!bypassShield && this.shieldHp > 0 && !fromBack) {
      const absorb = Math.min(this.shieldHp, remaining * 0.6);
      this.shieldHp -= absorb;
      remaining -= absorb;
    }

    const armor = this.def.armor ?? 0;
    const actual = remaining * (1 - armor);
    this.hp -= actual;
    this.lastDamageSource = source ?? this.lastDamageSource;
    this.hitOnce = true;
    this.hitFlash = 0.1;
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

  applyBurn(duration: number, dps: number): void {
    if (duration > this.burnTimer) this.burnTimer = duration;
    this.burnDps = Math.max(this.burnDps, dps);
  }

  /** Phantom phase visibility: true when the enemy can be damaged. */
  get visible(): boolean {
    if (this.ability !== "phase") return true;
    // Visibility window widens with phaseVisibilityBonus.
    const threshold = clamp(0.35 - this.phaseVisibilityBonus * 0.4, -0.5, 0.5);
    const phaseRate = this.type === "wraith" ? 3.1 : 2.1;
    return Math.sin(this.timer * phaseRate + this.phaseOffset) <= threshold;
  }

  get hasShield(): boolean {
    return this.shieldHp > 0.1;
  }
}
