/**
 * Core shared types and interfaces for LAST SIGNAL.
 * Data-driven design: most balance numbers live in /src/data/*.
 */

// ---------- Game state machine ----------
export type GameStateId =
  | "BOOT"
  | "MAIN_MENU"
  | "SECTOR_SELECT"
  | "PLANNING"
  | "WAVE_ACTIVE"
  | "WAVE_COMPLETE"
  | "REWARD_CHOICE"
  | "PAUSED"
  | "GAME_OVER"
  | "VICTORY";

// ---------- Cell / grid ----------
export const CellKind = {
  Empty: 0,
  Core: 1,
  Tower: 2,
  Rock: 3,
  Crystal: 4,
  Harvester: 5,
} as const;
export type CellKind = (typeof CellKind)[keyof typeof CellKind];

// ---------- Towers ----------
export type TowerType =
  | "pulse"
  | "blaster"
  | "stasis"
  | "mortar"
  | "tesla"
  | "harvester";

export type DamageType = "kinetic" | "energy" | "explosive" | "chain" | "none";
export type StatusEffect = "none" | "slow" | "splash" | "chain" | "mark";

export interface TowerDefinition {
  id: TowerType;
  name: string;
  role: string;
  description: string;
  cost: number;
  range: number;
  damage: number;
  cooldown: number;
  color: string;
  damageType: DamageType;
  effect?: StatusEffect;
  splashRadius?: number;
  chainMax?: number;
  chainRange?: number;
  projectileSpeed?: number;
  isEco?: boolean;
  income?: number;
  requiresCrystal?: boolean;
  hotkey?: string;
}

export type TowerFlag =
  | "tripleBurst"
  | "armorPiercer"
  | "suppressiveFire"
  | "deepFreeze"
  | "cryoField"
  | "vulnerabilityPulse"
  | "shrapnel"
  | "armorBreaker"
  | "burningGround"
  | "chainStorm"
  | "empArc"
  | "phaseDisruptor"
  | "deepExtraction"
  | "crystalStabilizer"
  | "relayNode"
  | "signalMarker";

export interface TowerMod {
  rangeMul?: number;
  rangeAdd?: number;
  damageMul?: number;
  damageAdd?: number;
  cooldownMul?: number;
  splashRadiusMul?: number;
  chainMaxAdd?: number;
  incomeMul?: number;
  flags?: Partial<Record<TowerFlag, boolean>>;
}

export interface SpecializationOption {
  id: string;
  name: string;
  description: string;
  /** Modifies tower runtime stats (additive / multiplicative, data-driven). */
  mod: TowerMod;
}

export interface SpecializationTree {
  /** Tower level at which spec unlock becomes available. */
  unlockLevel: number;
  options: SpecializationOption[];
}

// ---------- Enemies ----------
export type EnemyType =
  | "scout"
  | "grunt"
  | "brute"
  | "weaver"
  | "phantom"
  | "carrier"
  | "leviathan";

export type EnemyAbility = "none" | "heal" | "phase" | "spawn" | "boss";

export interface EnemyDefinition {
  id: EnemyType;
  name: string;
  role: string;
  description: string;
  hp: number;
  speed: number;
  reward: number;
  breach: number;
  color: string;
  size: number;
  ability: EnemyAbility;
  isBoss?: boolean;
  armor?: number; // damage reduction 0..1
}

// ---------- Waves / sectors ----------
export interface WaveEnemyGroup {
  type: EnemyType;
  count: number;
  /** Delay between individual spawns inside this group, seconds. */
  interval: number;
}

export interface WaveLane {
  spawnerId: string;
  enemies: WaveEnemyGroup[];
  /** Optional offset in seconds before this lane starts spawning. */
  startDelay?: number;
}

export interface WaveDefinition {
  id: string;
  name: string;
  description: string;
  warning: string;
  recommendedCounters: string[];
  rewardCredits: number;
  rewardChoice: boolean;
  lanes: WaveLane[];
  /** Convenience flat list for UI + codex generation. */
  enemySummary?: { type: EnemyType; count: number }[];
  isBossWave?: boolean;
}

export interface SpawnerDefinition {
  id: string;
  label: string; // e.g. "North Gate"
  c: number;
  r: number;
}

export interface SectorDefinition {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  /** Map grid as string rows: "." empty, "#" rock, "C" crystal, "X" core, "N/E/S/W" spawner tiles. */
  layout: string[];
  spawners: SpawnerDefinition[];
  waves: WaveDefinition[];
  startingCredits: number;
  coreIntegrity: number;
}

// ---------- Upgrades ----------
export type UpgradeTarget =
  | "global"
  | TowerType
  | "drone"
  | "core"
  | "economy";

export interface UpgradeEffect {
  towerFireRateMul?: number;
  towerDamageMul?: number;
  towerRangeMul?: number;
  towerRangeAdd?: number;
  specificTowerDamageMul?: { type: TowerType; mul: number };
  specificTowerRangeMul?: { type: TowerType; mul: number };
  droneDamageAdd?: number;
  droneRangeAdd?: number;
  harvesterIncomeMul?: number;
  slowedEnemyDamageMul?: number;
  teslaChainAdd?: number;
  mortarSplashMul?: number;
  phantomVisibleBonus?: number;
  coreIntegrityAdd?: number;
  towerBuildCostMul?: number;
  sellRefundMul?: number;
  lowCoreFireRateMul?: number;
  lowCoreThreshold?: number;
}

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  target: UpgradeTarget;
  effect: UpgradeEffect;
}

// ---------- Drones ----------
export type DroneType = "hunter" | "scanner" | "guardian";

export interface DroneDefinition {
  id: DroneType;
  name: string;
  description: string;
  cost: number;
  damage: number;
  range: number;
  cooldown: number;
  speed: number;
  color: string;
  role: string;
}

// ---------- Codex ----------
export interface CodexEntry {
  enemyId: EnemyType;
  threatHeadline: string;
  counters: string[];
  tip: string;
}

// ---------- Settings / stats ----------
export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  screenShake: boolean;
  reducedFlashing: boolean;
  showDamageNumbers: boolean;
  colorblind: boolean;
}

export interface RunStats {
  enemiesKilled: number;
  creditsEarned: number;
  coreDamageTaken: number;
  damageByTowerType: Partial<Record<TowerType, number>>;
  damageByEnemyType: Partial<Record<EnemyType, number>>;
  killsByEnemyType: Partial<Record<EnemyType, number>>;
  startedAt: number;
  bestTowerType: TowerType | null;
  bestTowerLevel: number;
}

export interface PersistedProfile {
  bestSectorCleared: number;
  bestWaveReached: number;
  bestCoreRemaining: number;
  codexSeen: EnemyType[];
}


// Re-exported for convenience.
export type { SpeedMultiplier } from "./Config";
