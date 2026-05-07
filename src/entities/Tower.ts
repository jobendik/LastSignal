import { Vector2 } from "../core/Vector2";
import type {
  TowerDefinition,
  TowerType,
  TowerFlag,
  TowerMod,
  TargetMode,
} from "../core/Types";
import { towerDefinitions, towerSpecializations } from "../data/towers";
import {
  TILE_SIZE,
  TOWER_BASE_HP,
  TOWER_HP_BY_TYPE,
  TOWER_DAMAGED_THRESHOLD,
  TOWER_CRITICAL_THRESHOLD,
  UPGRADE_COST_BASE_MUL,
} from "../core/Config";

/** Coarse durability state derived from HP percent. */
export type TowerDurabilityState =
  | "operational"
  | "damaged"
  | "critical"
  | "disabled"
  | "destroyed";

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
  /** Sell dissolve animation: counts down from 0.45 to 0; tower renders as disintegrating while > 0. */
  dissolveTimer = 0;
  /** Environmental power surge: while > 0, tower fires at double rate. */
  powerSurgeTimer = 0;
  static readonly DISSOLVE_MAX = 0.45;
  specId: string | null = null;
  pinnacleId: string | null = null;
  flags: Partial<Record<TowerFlag, boolean>> = {};
  mods: TowerMod[] = [];
  targetMode: TargetMode = "closest_to_core";

  // ──────────────────────────────────────────────────────────
  // Durability — towers are no longer abstract immortal guns.
  // hp / maxHp drive the operational/damaged/critical/disabled states.
  // ──────────────────────────────────────────────────────────
  hp: number;
  maxHp: number;
  /** Bonus HP added by upgrades (Hardened Circuits etc.). */
  hpBonus = 0;
  /** Brief flash timer (seconds) used by the renderer for hit feedback. */
  damageFlashTimer = 0;
  /** Time of last incoming damage (game.time.elapsed) — used for HUD readout + sfx throttling. */
  lastDamagedAt = -Infinity;
  /** Game time of last "damaged" sfx so we don't spam audio. */
  lastDamageSfxAt = -Infinity;
  /** True while hp <= 0 — the tower is offline and visually broken. */
  disabled = false;
  /** Game time the tower entered the disabled state. */
  disabledSinceGameTime = -Infinity;
  /** True while an Engineer squad is actively channeling repair. Rendered as a soft beam halo. */
  underRepair = false;
  /** Cleared each frame; set by MobileSquadSystem when a Shield field overlaps. */
  shielded = false;

  constructor(type: TowerType, c: number, r: number, buildCost: number) {
    const def = towerDefinitions[type];
    this.type = type;
    this.def = def;
    this.c = c;
    this.r = r;
    this.pos = new Vector2(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2);
    this.totalInvested = buildCost;
    this.timer = def.cooldown * 0.45;
    this.maxHp = baseTowerMaxHp(type);
    this.hp = this.maxHp;
  }

  /** HP percent 0..1. */
  get hpPct(): number {
    if (this.maxHp <= 0) return 1;
    return Math.max(0, Math.min(1, this.hp / this.maxHp));
  }

  /** Coarse durability state used by UI / firing penalty / rendering. */
  get durabilityState(): TowerDurabilityState {
    if (this.disabled || this.hp <= 0) return "disabled";
    const pct = this.hpPct;
    if (pct <= TOWER_CRITICAL_THRESHOLD) return "critical";
    if (pct <= TOWER_DAMAGED_THRESHOLD) return "damaged";
    return "operational";
  }


  get name(): string {
    return this.def.name;
  }

  get isEco(): boolean {
    return Boolean(this.def.isEco);
  }

  /**
   * Lifecycle predicate used by TowerSystem hot paths. Towers don't "die" the
   * way enemies do — sold towers are pulled out of the active list and moved
   * into the dissolving list, so any tower the system iterates over is active
   * by definition. This getter exists so we can write defensive checks like
   * `if (!t.active) continue;` symmetrically with Enemy.
   */
  get active(): boolean {
    return this.dissolveTimer === 0;
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
      if (m.rangeMul != null) range *= m.rangeMul;
      if (m.rangeAdd != null) range += m.rangeAdd;
      if (m.damageMul != null) damage *= m.damageMul;
      if (m.damageAdd != null) damage += m.damageAdd;
      if (m.cooldownMul != null) cooldown *= m.cooldownMul;
      if (m.splashRadiusMul != null) splashRadius *= m.splashRadiusMul;
      if (m.chainMaxAdd != null) chainMax += m.chainMaxAdd;
      if (m.incomeMul != null) income *= m.incomeMul;
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

  get canPinnacle(): boolean {
    if (this.level < 5 || this.specId == null || this.pinnacleId != null) return false;
    const tree = towerSpecializations[this.type];
    const opt = tree.options.find((o) => o.id === this.specId);
    return Boolean(opt?.pinnacle);
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

  applyPinnacle(): void {
    if (!this.specId) return;
    const tree = towerSpecializations[this.type];
    const opt = tree.options.find((o) => o.id === this.specId);
    const pinnacle = opt?.pinnacle;
    if (!pinnacle) return;
    this.pinnacleId = pinnacle.id;
    this.mods.push(pinnacle.mod);
    if (pinnacle.mod.flags) {
      for (const [k, v] of Object.entries(pinnacle.mod.flags)) {
        if (v) this.flags[k as TowerFlag] = true;
      }
    }
  }
}

/** Base maxHp for a tower type — used by Tower constructor and refreshMaxHp. */
function baseTowerMaxHp(type: TowerType): number {
  return TOWER_HP_BY_TYPE[type] ?? TOWER_BASE_HP;
}
