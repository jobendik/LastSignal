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
  | "harvester"
  | "railgun"
  | "flamer"
  | "barrier"
  | "amplifier"
  | "reflector"
  | "snare"
  | "overclock";

/** How a tower selects its next target. */
export type TargetMode = "closest_to_core" | "weakest" | "strongest" | "fastest";

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
  | "singularity"
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
  | "deflectorGrid"
  | "resonanceCore"
  | "overclockAdjacent"
  | "railRicochet"
  | "pinnacle";

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
  /** Optional second-stage max-level upgrade. */
  pinnacle?: SpecializationOption;
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
  | "sprinter"
  | "juggernaut"
  | "shielder"
  | "splitter"
  | "jammer"
  | "swarm"
  | "overlord"
  | "tunneler"
  | "saboteur"
  | "cache"
  | "mirror"
  | "harbinger";

export type EnemyAbility = "none" | "heal" | "phase" | "spawn" | "boss" | "tunnel" | "mirror" | "artillery";

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
  /** Optional special event that changes how the wave plays. */
  waveEvent?: "blitz" | "silence";
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
  /** Optional flavor text shown on the sector star map. */
  lore?: string;
  /** Darkness sectors dim the playfield; tower lights become strategic visibility pools. */
  darkness?: boolean;
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
  /** Grants the Tactical Pause ability (1 slow-mo per wave). */
  tacticalPause?: boolean;
}

export type UpgradeRarity = "common" | "uncommon" | "rare" | "legendary" | "cursed";

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  target: UpgradeTarget;
  rarity?: UpgradeRarity;
  synergyHint?: string;
  effect: UpgradeEffect;
  /** If set, choosing this upgrade also adds a permanent debuff modifier for the rest of the run. */
  curse?: RunModifier;
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
  uiVolume: number;
  muted: boolean;
  screenShake: boolean;
  reducedMotion: boolean;
  reducedFlashing: boolean;
  showDamageNumbers: boolean;
  subtitles: boolean;
  mouseButtonSwap: boolean;
  colorblind: boolean;
  highContrast: boolean;
  fontScale: number;
  graphicsQuality: "low" | "medium" | "high";
  /** User-rebindable keyboard controls, stored as KeyboardEvent.code values. */
  keyBindings: Record<string, string>;
  gamepadEnabled: boolean;
}

export interface RunStats {
  enemiesKilled: number;
  creditsEarned: number;
  creditsSpent: number;
  coreDamageTaken: number;
  damageByTowerType: Partial<Record<TowerType, number>>;
  damageByEnemyType: Partial<Record<EnemyType, number>>;
  killsByEnemyType: Partial<Record<EnemyType, number>>;
  killsByTowerType: Partial<Record<TowerType, number>>;
  startedAt: number;
  bestTowerType: TowerType | null;
  bestTowerLevel: number;
}

export type RunResult = "victory" | "defeat";

export interface RunJournalEntry {
  id: string;
  result: RunResult;
  sectorId: string;
  sectorName: string;
  difficulty: DifficultyId;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  waveReached: number;
  totalWaves: number;
  endless: boolean;
  coreRemainingPct: number;
  enemiesKilled: number;
  creditsEarned: number;
  creditsSpent: number;
  bestTowerType: TowerType | null;
  bestTowerLevel: number;
  modifiers: string[];
}

export interface PersistedProfile {
  bestSectorCleared: number;
  bestWaveReached: number;
  bestCoreRemaining: number;
  codexSeen: EnemyType[];
  researchPoints: number;
  researchUnlocked: string[];
  achievementsUnlocked: string[];
  endlessBestWave: number;
  lastDifficulty: DifficultyId;
  runHistory: RunJournalEntry[];
  prestigeLevel: number;
  prestigeMultiplier: number;
  dailyBestScore: number;
  dailyBestDate: string;
}

// ---------- Difficulty ----------
export type DifficultyId = "recruit" | "standard" | "veteran" | "nightmare";

export interface DifficultyDefinition {
  id: DifficultyId;
  name: string;
  description: string;
  accentColor: string;
  enemyHpMul: number;
  enemySpeedMul: number;
  rewardMul: number;
  coreIntegrityMul: number;
  researchMul: number;
}

// ---------- Meta progression / research ----------
export type ResearchId = string;

export interface ResearchNode {
  id: ResearchId;
  name: string;
  description: string;
  cost: number;
  requires?: ResearchId[];
  /** Purely cosmetic/gameplay tag for UI rendering. */
  tier: 1 | 2 | 3;
  effect: ResearchEffect;
}

export interface ResearchEffect {
  startingCreditsAdd?: number;
  coreIntegrityAdd?: number;
  towerDamageMul?: number;
  towerRangeAdd?: number;
  harvesterIncomeMul?: number;
  unlocksTower?: TowerType;
  unlocksMode?: "endless";
  rewardMul?: number;
}

// ---------- Achievements ----------
export type AchievementId = string;

export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  researchReward: number;
}

// ---------- Endless mode ----------
export interface EndlessWaveState {
  active: boolean;
  wave: number;
  hpScale: number;
  speedScale: number;
}

// ---------- Run modifiers ----------
/** A random per-run modifier rolled at sector start that twists the rules. */
export interface RunModifier {
  id: string;
  name: string;
  description: string;
  /** Each active enemy heals this many HP per second. */
  enemyHealPerSec?: number;
  /** Multiplier on enemy movement speed applied at spawn. */
  enemySpeedMul?: number;
  /** Multiplier on enemy max HP applied at spawn. */
  enemyHpMul?: number;
  /** Flat armor added to every enemy (0..1 range; capped at 0.95). */
  enemyArmorAdd?: number;
  /** Multiplier on enemy credit reward at kill time. */
  enemyRewardMul?: number;
  /** Multiplier on tower build costs. */
  towerCostMul?: number;
  /** Cooldown multiplier on towers (< 1 = shorter cooldown = faster fire). */
  towerCooldownMul?: number;
  /** If true, harvesters produce no passive income. */
  harvestDisabled?: boolean;
  /** Multiplier applied to harvester income (stacks with upgrade aggregate). */
  harvesterIncomeMul?: number;
  /** Multiplier on core max integrity at sector start. */
  coreMul?: number;
}


// Re-exported for convenience.
export type { SpeedMultiplier } from "./Config";
