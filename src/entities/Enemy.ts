import { Vector2 } from "../core/Vector2";
import type {
  EnemyDefinition,
  EnemyType,
  TowerType,
} from "../core/Types";
import { enemyDefinitions } from "../data/enemies";
import { clamp, rnd } from "../core/Random";

export type DamageSource = { type: "tower"; towerType: TowerType } | { type: "drone" } | { type: "other" };

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

  // Boss-only phase tracker.
  bossPhase = 0;
  bossPhaseTimer = 0;
  bossRushing = false;

  // Specialization marks.
  signalMarked = false;

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
  }

  get currentSpeed(): number {
    if (this.stunTimer > 0) return 0;
    let s = this.baseSpeed * this.speedMul;
    if (this.slowTimer > 0) s *= this.slowStrength;
    return s;
  }

  damage(amount: number, source: DamageSource | null): void {
    const armor = this.def.armor ?? 0;
    const actual = amount * (1 - armor);
    this.hp -= actual;
    this.lastDamageSource = source ?? this.lastDamageSource;
    if (this.hp <= 0) this.active = false;
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
