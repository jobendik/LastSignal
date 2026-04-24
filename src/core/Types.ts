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
  | "VICTORY"
  | "META";

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
  | "harvester"
  | "railgun"
  | "flamethrower"
  | "shield";

export type DamageType = "kinetic" | "energy" | "explosive" | "chain" | "fire" | "none";
export type StatusEffect = "none" | "slow" | "splash" | "chain" | "mark" | "burn";

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
  /** Meta-unlock requirement (node id). If absent, always available. */
  unlockRequires?: string;
  /** For flamethrower: cone arc in radians, and range of cone. */
  coneArc?: number;
  /** For shield: aura radius and aura effect. */
  auraRadius?: number;
  /** For railgun: pierces through multiple enemies in a straight line. */
  pierce?: number;
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
  | "signalMarker"
  // Railgun specs
  | "overcharge"
  | "longbarrel"
  | "markTarget"
  // Flamethrower specs
  | "ignitionBoost"
  | "napalmPool"
  | "heatWave"
  // Shield specs
  | "reactiveArmor"
  | "regenPulse"
  | "reflectField";

export interface TowerMod {
  rangeMul?: number;
  rangeAdd?: number;
  damageMul?: number;
  damageAdd?: number;
  cooldownMul?: number;
  splashRadiusMul?: number;
  chainMaxAdd?: number;
  incomeMul?: number;
  pierceAdd?: number;
  coneArcMul?: number;
  auraRadiusMul?: number;
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
  | "leviathan"
  | "swarmling"
  | "shielded"
  | "sapper"
  | "wraith"
  | "titan"
  | "corruptor"
  | "harbinger";

export type EnemyAbility =
  | "none"
  | "heal"
  | "phase"
  | "spawn"
  | "boss"
  | "shield"
  | "explode"
  | "corrupt"
  | "titan"
  | "split";

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
  /** Optional: resistant to specific damage types (reduces by fraction). */
  resist?: Partial<Record<DamageType, number>>;
  /** For shielded: frontal shield HP that absorbs damage first. */
  shieldHp?: number;
  /** For sapper: explosion radius + damage to nearest tower. */
  explodeRadius?: number;
  explodeTowerDamage?: number;
  /** For titan/harbinger: elite multiplier. */
  elite?: boolean;
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
  /** Time limit before wave auto-starts during planning (seconds). */
  planningSeconds?: number;
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
  /** Meta-unlock required (sector id of previous best or explicit unlock). */
  unlockRequires?: number; // index of prior sector cleared
  /** Environmental modifier (flavor). */
  hazard?: "none" | "lowpower" | "nocrystals" | "fastenemies" | "doubleLanes";
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
  droneFireRateMul?: number;
  harvesterIncomeMul?: number;
  slowedEnemyDamageMul?: number;
  teslaChainAdd?: number;
  mortarSplashMul?: number;
  phantomVisibleBonus?: number;
  coreIntegrityAdd?: number;
  coreMaxAdd?: number;
  towerBuildCostMul?: number;
  sellRefundMul?: number;
  lowCoreFireRateMul?: number;
  lowCoreThreshold?: number;
  // New
  burnDamageMul?: number;
  markedDamageMul?: number;
  overkillCreditsMul?: number;
  firstHitDamageMul?: number;
  coreRegenPerWave?: number;
  shieldedBonusDamageMul?: number;
  startingCreditsAdd?: number;
}

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  target: UpgradeTarget;
  effect: UpgradeEffect;
  /** Rarity tier: common=1, rare=2, legendary=3. Affects color + weighting. */
  rarity?: 1 | 2 | 3;
}

// ---------- Drones ----------
export type DroneType = "hunter" | "scanner" | "guardian" | "strike";

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
  unlockRequires?: string;
}

// ---------- Codex ----------
export interface CodexEntry {
  enemyId: EnemyType;
  threatHeadline: string;
  counters: string[];
  tip: string;
}

export interface TowerCodexEntry {
  towerId: TowerType;
  headline: string;
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
  crtEffect: boolean;
  autoStartWave: boolean;
  planningCountdown: number; // seconds; 0 disables
  showTutorial: boolean;
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
  towersBuilt: number;
  towersSold: number;
  specsApplied: number;
  wavesCleared: number;
  upgradesChosen: number;
}

export interface PersistedProfile {
  bestSectorCleared: number;
  bestWaveReached: number;
  bestCoreRemaining: number;
  codexSeen: EnemyType[];
  research: number;
  unlockedNodes: string[];
  achievementsUnlocked: string[];
  endlessBestWave: Record<string, number>;
  totalRuns: number;
  totalVictories: number;
  tutorialSeen: boolean;
  preferredDifficulty: DifficultyId;
}

// ---------- Difficulty ----------
export type DifficultyId = "cadet" | "operative" | "veteran" | "nightmare";

export interface DifficultyDefinition {
  id: DifficultyId;
  name: string;
  description: string;
  hpMul: number;
  speedMul: number;
  rewardMul: number;
  coreIntegrityMul: number;
  color: string;
}

// ---------- Achievements ----------
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  secret?: boolean;
  /** Research point grant on first unlock. */
  research: number;
}

// ---------- Meta progression ----------
export interface MetaNodeEffect {
  startingCreditsAdd?: number;
  coreMaxAdd?: number;
  towerDamageMul?: number;
  harvesterIncomeMul?: number;
  droneDamageAdd?: number;
  sellRefundAdd?: number;
  unlocksTower?: TowerType;
  unlocksDrone?: DroneType;
  unlocksSector?: number;
  unlocksEndless?: boolean;
  unlocksDifficulty?: DifficultyId;
  rewardChoiceExtra?: number;
}

export interface MetaNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  requires?: string[];
  effect: MetaNodeEffect;
  tier: number;
}


// Re-exported for convenience.
export type { SpeedMultiplier } from "./Config";
