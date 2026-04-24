import { Vector2 } from "../core/Vector2";
import type { Enemy } from "./Enemy";
import type { Tower } from "./Tower";
import type { TowerType } from "../core/Types";

export type ProjectileKind = "bullet" | "beam" | "mortar";

export interface ProjectileOwner {
  tower?: Tower;
  isDrone?: boolean;
}

/** Straight-flight bullet or mortar shell. */
export class Projectile {
  pos: Vector2;
  target: Enemy | null;
  targetPos: Vector2;
  damage: number;
  color: string;
  speed: number;
  kind: ProjectileKind;
  splashRadius: number;
  slowOnHit: number; // duration if >0
  slowStrength: number;
  stunChance: number;
  chainMax: number;
  chainRange: number;
  owner: ProjectileOwner;
  ownerType: TowerType | "drone" | "other";
  active = true;
  life = 2.5;
  maxLife = 2.5;
  lastDir = new Vector2(1, 0);
  trail: Vector2[] = [];
  mark = false;
  armorPierce = false;
  armorBreak = false;
  burningGround = false;

  constructor(opts: {
    pos: Vector2;
    target: Enemy | null;
    targetPos?: Vector2;
    damage: number;
    color: string;
    speed: number;
    kind: ProjectileKind;
    owner: ProjectileOwner;
    ownerType: TowerType | "drone" | "other";
    splashRadius?: number;
    slowOnHit?: number;
    slowStrength?: number;
    stunChance?: number;
    chainMax?: number;
    chainRange?: number;
    mark?: boolean;
    armorPierce?: boolean;
    armorBreak?: boolean;
    burningGround?: boolean;
  }) {
    this.pos = opts.pos.clone();
    this.target = opts.target;
    this.targetPos = opts.targetPos ? opts.targetPos.clone() : (opts.target ? opts.target.pos.clone() : this.pos.clone());
    this.damage = opts.damage;
    this.color = opts.color;
    this.speed = opts.speed;
    this.kind = opts.kind;
    this.owner = opts.owner;
    this.ownerType = opts.ownerType;
    this.splashRadius = opts.splashRadius ?? 0;
    this.slowOnHit = opts.slowOnHit ?? 0;
    this.slowStrength = opts.slowStrength ?? 0.5;
    this.stunChance = opts.stunChance ?? 0;
    this.chainMax = opts.chainMax ?? 0;
    this.chainRange = opts.chainRange ?? 0;
    this.mark = Boolean(opts.mark);
    this.armorPierce = Boolean(opts.armorPierce);
    this.armorBreak = Boolean(opts.armorBreak);
    this.burningGround = Boolean(opts.burningGround);
  }
}
