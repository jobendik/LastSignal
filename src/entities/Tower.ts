import { Vector2 } from "../core/Vector2";
import type {
  TowerDefinition,
  TowerType,
  TowerFlag,
  TowerMod,
  TargetMode,
} from "../core/Types";
import { towerDefinitions, towerSpecializations } from "../data/towers";
import { TILE_SIZE, UPGRADE_COST_BASE_MUL } from "../core/Config";

/** Runtime tower entity. Behavior runs in TowerSystem; this class holds state. */
export class Tower {
  type: TowerType;
  def: TowerDefinition;
  c: number;
  r: number;
  pos: Vector2;
  level = 1;
  timer: number;
  angle = -Math.PI / 2;
  recoil = 0;
  manualCooldown = 0;
  manualCooldownMax = 12;
  overcharge = 0;
  totalInvested: number;
  kills = 0;
  totalDamage = 0;
  burstCount = 0; // for Pulse triple burst
  /** Heat accumulated by Flamer while firing (decays when idle). Drives overheat visual. */
  heatTimer = 0;
  /** Construction animation: counts 0→1 over 0.4s. Tower is disabled while < 1. */
  buildProgress = 0;
  specId: string | null = null;
  flags: Partial<Record<TowerFlag, boolean>> = {};
  mods: TowerMod[] = [];
  targetMode: TargetMode = "closest_to_core";

  constructor(type: TowerType, c: number, r: number, buildCost: number) {
    const def = towerDefinitions[type];
    this.type = type;
    this.def = def;
    this.c = c;
    this.r = r;
    this.pos = new Vector2(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2);
    this.totalInvested = buildCost;
    this.timer = def.cooldown * 0.45;
  }

  get name(): string {
    return this.def.name;
  }

  get isEco(): boolean {
    return Boolean(this.def.isEco);
  }

  /** Effective stats after level + specialization, before global/run-wide upgrades. */
  statBlock(): {
    range: number;
    damage: number;
    cooldown: number;
    splashRadius: number;
    chainMax: number;
    income: number;
  } {
    const levelMul = 1 + (this.level - 1) * 0.35;
    let range = this.def.range;
    let damage = this.def.damage * levelMul;
    let cooldown = this.def.cooldown * Math.max(0.25, 1 - (this.level - 1) * 0.12);
    let splashRadius = this.def.splashRadius ?? 0;
    let chainMax = (this.def.chainMax ?? 0) + Math.floor((this.level - 1) * 0.75);
    let income = (this.def.income ?? 0) * levelMul;

    for (const m of this.mods) {
      if (m.rangeMul) range *= m.rangeMul;
      if (m.rangeAdd) range += m.rangeAdd;
      if (m.damageMul) damage *= m.damageMul;
      if (m.damageAdd) damage += m.damageAdd;
      if (m.cooldownMul) cooldown *= m.cooldownMul;
      if (m.splashRadiusMul) splashRadius *= m.splashRadiusMul;
      if (m.chainMaxAdd) chainMax += m.chainMaxAdd;
      if (m.incomeMul) income *= m.incomeMul;
    }
    return { range, damage, cooldown, splashRadius, chainMax, income };
  }

  get upgradeCost(): number {
    return Math.floor(this.def.cost * Math.pow(UPGRADE_COST_BASE_MUL, this.level - 1));
  }

  get sellValue(): number {
    return Math.floor(this.totalInvested * 0.5);
  }

  get canSpecialize(): boolean {
    const tree = towerSpecializations[this.type];
    return this.level >= tree.unlockLevel && this.specId == null;
  }

  applySpecialization(specId: string): void {
    const tree = towerSpecializations[this.type];
    const opt = tree.options.find((o) => o.id === specId);
    if (!opt) return;
    this.specId = specId;
    this.mods.push(opt.mod);
    if (opt.mod.flags) {
      for (const [k, v] of Object.entries(opt.mod.flags)) {
        if (v) this.flags[k as TowerFlag] = true;
      }
    }
  }
}
