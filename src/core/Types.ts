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
  /** Grid dimensions. When omitted, defaults to DEFAULT_COLS × DEFAULT_ROWS (32×22). */
  cols?: number;
  rows?: number;
  /** Optional flavor text shown on the sector star map. */
  lore?: string;
  /** Darkness sectors dim the playfield; tower lights become strategic visibility pools. */
  darkness?: boolean;
  /**
   * Per-sector hazard enable flags. When omitted, every hazard runs (legacy behavior).
   * Set to false to suppress hazards that don't fit the sector theme.
   */
  hazards?: SectorHazardConfig;
  /**
   * Optional strategic map points (capture objectives + hostile structures).
   * Sectors that omit this array behave exactly as before.
   */
  strategicPoints?: StrategicPointDefinition[];
}

// ---------- Strategic map points ----------
/**
 * Strategic map points are neutral or hostile objects placed on the grid that
 * give the large maps tactical depth beyond crystal economy:
 *  - SIGNAL_NODE      → capture for local signal/build coverage
 *  - RADAR_DISH       → capture for global reveal + wave intel
 *  - DATA_CACHE       → one-time credits + research reward
 *  - ABANDONED_TURRET → captures into an allied static gun
 *  - RIFT_ANCHOR      → hostile structure that empowers enemies until destroyed
 *  - JAMMER           → hostile structure that suppresses signal/towers in radius
 */
export type StrategicPointType =
  | "signal_node"
  | "radar_dish"
  | "data_cache"
  | "abandoned_turret"
  | "rift_anchor"
  | "jammer";

export type StrategicPointState =
  /** Neutral and ready to be captured. */
  | "neutral"
  /** Hostile enemy structure, intact. */
  | "enemy"
  /** Captured by the player (friendly active). */
  | "captured"
  /** One-shot point already collected (data cache after pickup). */
  | "depleted"
  /** Destroyed enemy structure (no longer affecting play). */
  | "destroyed";

/** Authoring-time definition (sectors.ts). Runtime adds progress/state. */
export interface StrategicPointDefinition {
  /** Stable per-sector identifier. Used for objective targeting and saves. */
  id: string;
  type: StrategicPointType;
  /** Cell-space position. The point occupies a single tile. */
  c: number;
  r: number;
  /** Optional override for capture time (seconds). */
  captureSeconds?: number;
  /** Optional override for hostile structure HP. */
  health?: number;
  /** Optional override for influence radius (cells). */
  radiusCells?: number;
  /** Optional override for one-time reward (credits/research). */
  rewardCredits?: number;
  rewardResearch?: number;
  /** Friendly display name (defaults derived from type when omitted). */
  name?: string;
  /** Short flavor description shown on hover. */
  description?: string;
}

export interface SectorHazardConfig {
  /** Random meteor showers strike the field. */
  meteors?: boolean;
  /** Roaming gravity anomaly slows enemies and projectiles. */
  gravity?: boolean;
  /** Signal interference zone reduces tower range. */
  signalInterference?: boolean;
  /** Periodic environmental power surge buffs random combat tower. */
  powerSurges?: boolean;
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
  // ---------- BUILD-DEFINING (Part 5) ----------
  /** Pulse: chance every Nth shot splits into multiple weaker shots. */
  pulseSplitShots?: boolean;
  /** Pulse: marked enemies explode on death (small AoE). */
  pulseDeathMark?: boolean;
  /** Pulse: closer to core = more damage (up to +50%). */
  pulseCoreBoost?: boolean;
  /** Stasis: slow effect spreads briefly on enemy death. */
  stasisDeathSlow?: boolean;
  /** Stasis: slow strength deepens by an extra amount. */
  stasisDeeperSlow?: number;
  /** Mortar: bonus damage vs swarm/scout (anti-density). */
  mortarSwarmBonus?: number;
  /** Mortar: burn ground always on. */
  mortarAlwaysBurn?: boolean;
  /** Tesla: chain jumps gain extra range but lose more damage per jump. */
  teslaLongChain?: boolean;
  /** Tesla: applies vulnerability briefly to anything hit. */
  teslaVulnerability?: boolean;
  /** Tesla: bonus damage to phased enemies. */
  teslaPhantomBonus?: number;
  /** Flamer: burning enemies are slowed slightly. */
  flamerPanicSlow?: boolean;
  /** Flamer: bonus damage vs swarms, reduced vs bosses. */
  flamerSwarmFocus?: boolean;
  /** Railgun: bonus damage vs bosses. */
  railgunBossFocus?: number;
  /** Railgun: pierces through enemies in line. */
  railgunPierceAll?: boolean;
  /** Drone: hunter prioritizes enemies near core. */
  droneCorePriority?: boolean;
  /** Drone: scanner reveals all phantoms on map. */
  droneRevealAll?: boolean;
  /** Drone: repair drone restores towers faster (shorter disable timers). */
  droneRepairFaster?: boolean;
  // ---------- SQUAD COMMAND PROTOCOLS (Part 16) ----------
  /** Bonus added to global squad cap (cap = base + tier bonus + squadCapAdd). */
  squadCapAdd?: number;
  /** Multiplier on squad cooldowns (< 1 = faster recharge). */
  squadCooldownMul?: number;
  /** Multiplier on squad cost (< 1 = cheaper deployment). */
  squadCostMul?: number;
  /** Multiplier on Recon reveal radius and scan-pulse reach. */
  squadReconRevealMul?: number;
  /** Bonus to engineer capture multiplier (additive on top of base). */
  squadEngineerCaptureBonus?: number;
  /** Multiplier on Strike squad damage vs enemies and structures. */
  squadStrikeDamageMul?: number;
  /** Multiplier on Shield damage reduction (capped at SHIELD_DAMAGE_REDUCTION_MAX). */
  squadShieldStrengthMul?: number;
  /** Reduce jammer/rift suppression effect on squads (0..1, fraction subtracted from penalty). */
  squadJammerResistance?: number;
  /** Economy: harvester also shields adjacent towers (reduces incoming disable durations). */
  harvesterShieldAdjacent?: boolean;
  /** Economy: bonus credits per non-harvester tower adjacent to harvester. */
  harvesterAdjacencyBonus?: number;
  /** Economy: interest on unspent credits at wave end (% of unspent up to a cap). */
  unspentInterestPct?: number;
  /** Economy: interest cap (max bonus credits per wave). */
  unspentInterestCap?: number;
  /** Generic: every wave-complete grants this many credits. */
  waveCompleteCredits?: number;
  /** Reflector synergy: adjacent reflectors give railguns +bonus damage. */
  reflectorRailgunMul?: number;
  /** Adds N starting drones to a free tier-1 spawn pool (cosmetic boost). */
  bonusDrones?: number;
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

// ---------- Mobile command squads ----------
/**
 * Specialized mobile drone squads deployed as command abilities. They are
 * NOT individual unit micro — they act like timed command beacons that move,
 * scout, repair, attack, or shield. Each squad type has a focused purpose.
 */
export type SquadType = "recon" | "engineer" | "strike" | "shield";

/** Lifecycle state for a deployed squad. */
export type SquadState =
  | "spawning"
  | "moving"
  | "scouting"
  | "capturing"
  | "repairing"
  | "attacking"
  | "shielding"
  | "evacuating"
  | "returning"
  | "expired"
  | "destroyed";

/** Active retask command applied to a deployed squad. */
export type SquadCommand =
  | { kind: "move"; x: number; y: number }
  | { kind: "scout"; x: number; y: number }
  | { kind: "capture"; pointId: string }
  | { kind: "repair"; towerId: number }
  | { kind: "strike_structure"; pointId: string }
  | { kind: "strike_area"; x: number; y: number }
  | { kind: "shield"; x: number; y: number }
  | { kind: "evac" };

/**
 * Authoring-time definition for a squad type. Numbers live in /src/core/Config
 * via the squadDefinitions builder so balance constants stay in one place.
 */
export interface SquadDefinition {
  id: SquadType;
  name: string;
  /** One-line role tag for the HUD button. */
  role: string;
  /** Long-form tooltip describing best use case. */
  description: string;
  /** Credit cost to deploy. */
  cost: number;
  /** Cooldown (seconds) between deployments of this squad type. */
  cooldown: number;
  /** Command Tier required to unlock this squad. 1 = available from start. */
  tierRequired: 1 | 2 | 3;
  /** Color used for HUD button accent and squad rendering. */
  color: string;
  /** Maximum simultaneous active squads of this type. */
  capPerType: number;
  /** Movement speed in pixels/second. */
  speed: number;
  /** Maximum hit points. */
  maxHealth: number;
  /** Total active duration in seconds. */
  duration: number;
  /** Reveal radius (pixels) — used by Recon and partially by all squads. */
  revealRadius: number;
  /** Interaction radius (pixels) — capture/repair/attack range from squad center. */
  interactionRadius: number;
  /** Optional combat stats. */
  damage?: number;
  attackCooldown?: number;
  /** Damage multiplier vs hostile structures. */
  structureDamageMul?: number;
  /** Engineer: capture progress multiplier when channeling on a strategic point. */
  captureMultiplier?: number;
  /** Engineer: HP repaired per second on damaged towers / cores. */
  repairPerSecond?: number;
  /** Shield: damage reduction (0..1) applied to nearby cores/towers. */
  shieldDamageReduction?: number;
  /** Shield: enemy slow strength in shield field. */
  shieldSlowAmount?: number;
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
  graphicsQuality: "low" | "medium" | "high" | "custom";
  /** Individual VFX toggles. Per-effect overrides; default values match the
   *  graphicsQuality preset selected at first run, but the player can disable
   *  any effect they don't like and the renderer will respect it. */
  vfxScanlines: boolean;
  vfxVignette: boolean;
  vfxPhosphor: boolean;
  vfxFilmGrain: boolean;
  vfxChromaticAberration: boolean;
  vfxBarrelDistortion: boolean;
  vfxBloom: boolean;
  vfxFlicker: boolean;
  /** Particle density 0..1. Lower = fewer/cheaper particles, cleaner look. */
  vfxParticleDensity: number;
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
  /** True after the player has dismissed the in-game commander briefing. */
  commanderBriefingSeen: boolean;
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
