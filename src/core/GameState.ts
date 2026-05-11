import { EventBus } from "./EventBus";
import { StateMachine } from "./StateMachine";
import { Time } from "./Time";
import type { GameSettings, PersistedProfile, RunModifier, RunStats, SectorDefinition, SpeedMultiplier, TowerType, UpgradeEffect } from "./Types";

/** Aggregate upgrade state (accumulated effects from chosen signal upgrades). */
export interface UpgradeAggregate {
  towerFireRateMul: number;
  towerDamageMul: number;
  towerRangeMul: number;
  towerRangeAdd: number;
  specificTowerDamageMul: Partial<Record<TowerType, number>>;
  specificTowerRangeMul: Partial<Record<TowerType, number>>;
  droneDamageAdd: number;
  droneRangeAdd: number;
  harvesterIncomeMul: number;
  slowedEnemyDamageMul: number;
  teslaChainAdd: number;
  mortarSplashMul: number;
  phantomVisibleBonus: number;
  towerBuildCostMul: number;
  sellRefundMul: number;
  lowCoreFireRateMul: number;
  lowCoreThreshold: number;
  /** Whether the player has the Tactical Pause upgrade (1 slow-mo per wave). */
  tacticalPause: boolean;
  appliedUpgradeIds: string[];
  // ---------- BUILD-DEFINING (Part 5) ----------
  pulseSplitShots: boolean;
  pulseDeathMark: boolean;
  pulseCoreBoost: boolean;
  stasisDeathSlow: boolean;
  stasisDeeperSlow: number;
  mortarSwarmBonus: number;
  mortarAlwaysBurn: boolean;
  teslaLongChain: boolean;
  teslaVulnerability: boolean;
  teslaPhantomBonus: number;
  flamerPanicSlow: boolean;
  flamerSwarmFocus: boolean;
  railgunBossFocus: number;
  railgunPierceAll: boolean;
  droneCorePriority: boolean;
  droneRevealAll: boolean;
  droneRepairFaster: boolean;
  harvesterShieldAdjacent: boolean;
  harvesterAdjacencyBonus: number;
  unspentInterestPct: number;
  unspentInterestCap: number;
  waveCompleteCredits: number;
  reflectorRailgunMul: number;
  // ---------- SQUAD COMMAND PROTOCOLS (Part 16) ----------
  squadCapAdd: number;
  squadCooldownMul: number;
  squadCostMul: number;
  squadReconRevealMul: number;
  squadEngineerCaptureBonus: number;
  squadStrikeDamageMul: number;
  squadShieldStrengthMul: number;
  squadJammerResistance: number;
  // ---------- TOWER DURABILITY (Part 15) ----------
  engineerRepairMul: number;
  towerHpAdd: number;
  towerHpMul: number;
  saboteurDisableReduction: number;
  saboteurTowerDamageMul: number;
  emergencyNanitesPct: number;
  shieldTowerStrengthMul: number;
  abandonedTurretHpMul: number;
}

export function createEmptyUpgradeAggregate(): UpgradeAggregate {
  return {
    towerFireRateMul: 1,
    towerDamageMul: 1,
    towerRangeMul: 1,
    towerRangeAdd: 0,
    specificTowerDamageMul: {},
    specificTowerRangeMul: {},
    droneDamageAdd: 0,
    droneRangeAdd: 0,
    harvesterIncomeMul: 1,
    slowedEnemyDamageMul: 1,
    teslaChainAdd: 0,
    mortarSplashMul: 1,
    phantomVisibleBonus: 0,
    towerBuildCostMul: 1,
    sellRefundMul: 0.5,
    lowCoreFireRateMul: 1,
    lowCoreThreshold: 0,
    tacticalPause: false,
    appliedUpgradeIds: [],
    pulseSplitShots: false,
    pulseDeathMark: false,
    pulseCoreBoost: false,
    stasisDeathSlow: false,
    stasisDeeperSlow: 0,
    mortarSwarmBonus: 0,
    mortarAlwaysBurn: false,
    teslaLongChain: false,
    teslaVulnerability: false,
    teslaPhantomBonus: 0,
    flamerPanicSlow: false,
    flamerSwarmFocus: false,
    railgunBossFocus: 0,
    railgunPierceAll: false,
    droneCorePriority: false,
    droneRevealAll: false,
    droneRepairFaster: false,
    harvesterShieldAdjacent: false,
    harvesterAdjacencyBonus: 0,
    unspentInterestPct: 0,
    unspentInterestCap: 0,
    waveCompleteCredits: 0,
    reflectorRailgunMul: 1,
    squadCapAdd: 0,
    squadCooldownMul: 1,
    squadCostMul: 1,
    squadReconRevealMul: 1,
    squadEngineerCaptureBonus: 0,
    squadStrikeDamageMul: 1,
    squadShieldStrengthMul: 1,
    squadJammerResistance: 0,
    engineerRepairMul: 1,
    towerHpAdd: 0,
    towerHpMul: 1,
    saboteurDisableReduction: 0,
    saboteurTowerDamageMul: 1,
    emergencyNanitesPct: 0,
    shieldTowerStrengthMul: 1,
    abandonedTurretHpMul: 1,
  };
}

export interface GameRefs {
  bus: EventBus;
  stateMachine: StateMachine;
  time: Time;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  uiRoot: HTMLElement;
}

export interface GameCoreState {
  credits: number;
  coreIntegrity: number;
  coreMax: number;
  waveIndex: number; // 0-based; next wave to play = waveIndex
  sector: SectorDefinition | null;
  speed: SpeedMultiplier;
  upgrades: UpgradeAggregate;
  stats: RunStats;
  settings: GameSettings;
  profile: PersistedProfile;

  debug: {
    show: boolean;
    showFlow: boolean;
    showPaths: boolean;
  };
  shake: number;
  shakeDir: { x: number; y: number }; // normalized direction of last impact
  shakeRot: number;                   // rotational shake amplitude (radians)
  slowMo: number;       // seconds of slow-motion remaining
  slowMoScale: number;  // time scale during slow-mo (default 0.35, lower = more dramatic)
  showHeatmap: boolean;               // live enemy-density heat overlay (H key)
  coreAbilityCooldown: number;
  coreAbilityCooldownMax: number;
  emergencyTriggered: boolean;
  emergencyTimer: number;
  emergencyOverheatTimer: number;
  /** Active run modifiers rolled at sector start. */
  activeModifiers: RunModifier[];
  /** Seconds of simulation freeze remaining after a big kill (hit-stop effect). */
  hitStopTimer: number;
  /** Whether the one-per-sector tower recall ability has been used. */
  towerRecallUsed: boolean;
  /** Player-designated kill zone tile: all enemies on this cell take +20% damage. Cleared at each wave start. */
  killZone: { c: number; r: number } | null;
  /** While true, the next map click designates the kill zone rather than selecting/placing. */
  killZoneMode: boolean;
  /** Extra reward cards to show at the next reward screen (from milestone achievements). */
  bonusUpgradeCount: number;
  /** Milestone IDs already achieved this run (prevents re-triggering). */
  achievedMilestones: Set<string>;
  /** Number of Tactical Pause slow-mo uses remaining this wave. */
  tacticalPauseCharges: number;
  /** Seconds until the next environmental power surge can strike a combat tower. */
  powerSurgeTimer: number;
  /** Active meteor strike warnings. Each counts down to impact. */
  meteorStrikes: MeteorStrike[];
  /** Seconds until the next meteor shower event. */
  meteorShowerCooldown: number;
  /** Moving gravity anomaly zone. Null when inactive. */
  gravityAnomaly: GravityAnomaly | null;
  /** Seconds until the next gravity anomaly spawns. */
  gravityAnomalyCooldown: number;
  /** Decay rate for screen shake (higher = faster fade = snappier). Default 30. */
  shakeDecay: number;
  /** Active signal interference zone that reduces tower range. Null when inactive. */
  signalInterference: SignalInterference | null;
  /** Seconds until the next signal interference zone can appear. */
  signalInterferenceCooldown: number;
  /** Salvage pickups on the map that the player can click to collect. */
  salvagePickups: SalvagePickup[];
  /** True while the player is selecting where to deploy a new relay core node. */
  coreDeployMode: boolean;
  /** Number of relay core nodes deployed this run. */
  coreNodesBuilt: number;
  /** Command tier acts like a base-tech level (Warcraft-style tech progression). */
  commandTier: 1 | 2 | 3;
  /** Timer for periodic militia squad spawns unlocked by command tiers. */
  militiaPulseTimer: number;
  /** Which relay variant the player has selected for the next deployment. */
  relayDeployVariant: "signal" | "hardened";
}

export interface GravityAnomaly {
  /** World-space center X. */
  x: number;
  /** World-space center Y. */
  y: number;
  /** Movement velocity X (px/s). */
  vx: number;
  vy: number;
  /** Radius of effect in pixels. */
  radius: number;
  /** Seconds of life remaining. */
  timer: number;
  maxTimer: number;
}

export interface MeteorStrike {
  c: number;
  r: number;
  /** Countdown to impact (seconds). */
  timer: number;
  maxTimer: number;
}

export interface SignalInterference {
  /** World-space center X. */
  x: number;
  /** World-space center Y. */
  y: number;
  /** Effect radius in pixels. */
  radius: number;
  /** Seconds until next position jump. */
  moveTimer: number;
  /** Total seconds of life remaining. */
  totalTimer: number;
  maxTotalTimer: number;
}

export interface SalvagePickup {
  x: number;
  y: number;
  /** Credit value when collected. */
  value: number;
  /** Seconds until this pickup expires. */
  timer: number;
}

export function createEmptyStats(): RunStats {
  return {
    enemiesKilled: 0,
    creditsEarned: 0,
    creditsSpent: 0,
    coreDamageTaken: 0,
    damageByTowerType: {},
    damageByEnemyType: {},
    killsByEnemyType: {},
    killsByTowerType: {},
    startedAt: Date.now(),
    bestTowerType: null,
    bestTowerLevel: 0,
  };
}

/** Merge an UpgradeEffect into the aggregate. */
export function applyUpgradeEffect(
  agg: UpgradeAggregate,
  effect: UpgradeEffect
): void {
  if (effect.towerFireRateMul != null) agg.towerFireRateMul *= effect.towerFireRateMul;
  if (effect.towerDamageMul != null) agg.towerDamageMul *= effect.towerDamageMul;
  if (effect.towerRangeMul != null) agg.towerRangeMul *= effect.towerRangeMul;
  if (effect.towerRangeAdd != null) agg.towerRangeAdd += effect.towerRangeAdd;
  if (effect.specificTowerDamageMul) {
    const { type, mul } = effect.specificTowerDamageMul;
    agg.specificTowerDamageMul[type] =
      (agg.specificTowerDamageMul[type] ?? 1) * mul;
  }
  if (effect.specificTowerRangeMul) {
    const { type, mul } = effect.specificTowerRangeMul;
    agg.specificTowerRangeMul[type] =
      (agg.specificTowerRangeMul[type] ?? 1) * mul;
  }
  if (effect.droneDamageAdd != null) agg.droneDamageAdd += effect.droneDamageAdd;
  if (effect.droneRangeAdd != null) agg.droneRangeAdd += effect.droneRangeAdd;
  if (effect.harvesterIncomeMul != null) agg.harvesterIncomeMul *= effect.harvesterIncomeMul;
  if (effect.slowedEnemyDamageMul != null) agg.slowedEnemyDamageMul *= effect.slowedEnemyDamageMul;
  if (effect.teslaChainAdd != null) agg.teslaChainAdd += effect.teslaChainAdd;
  if (effect.mortarSplashMul != null) agg.mortarSplashMul *= effect.mortarSplashMul;
  if (effect.phantomVisibleBonus != null) agg.phantomVisibleBonus += effect.phantomVisibleBonus;
  if (effect.towerBuildCostMul != null) agg.towerBuildCostMul *= effect.towerBuildCostMul;
  if (effect.sellRefundMul != null) agg.sellRefundMul = Math.max(agg.sellRefundMul, effect.sellRefundMul);
  if (effect.lowCoreFireRateMul) {
    agg.lowCoreFireRateMul = Math.max(agg.lowCoreFireRateMul, effect.lowCoreFireRateMul);
  }
  if (effect.lowCoreThreshold != null) {
    agg.lowCoreThreshold = Math.max(agg.lowCoreThreshold, effect.lowCoreThreshold);
  }
  if (effect.tacticalPause) agg.tacticalPause = true;
  // Build-defining flags (Part 5).
  if (effect.pulseSplitShots) agg.pulseSplitShots = true;
  if (effect.pulseDeathMark) agg.pulseDeathMark = true;
  if (effect.pulseCoreBoost) agg.pulseCoreBoost = true;
  if (effect.stasisDeathSlow) agg.stasisDeathSlow = true;
  if (effect.stasisDeeperSlow != null) agg.stasisDeeperSlow = Math.max(agg.stasisDeeperSlow, effect.stasisDeeperSlow);
  if (effect.mortarSwarmBonus != null) agg.mortarSwarmBonus = Math.max(agg.mortarSwarmBonus, effect.mortarSwarmBonus);
  if (effect.mortarAlwaysBurn) agg.mortarAlwaysBurn = true;
  if (effect.teslaLongChain) agg.teslaLongChain = true;
  if (effect.teslaVulnerability) agg.teslaVulnerability = true;
  if (effect.teslaPhantomBonus != null) agg.teslaPhantomBonus = Math.max(agg.teslaPhantomBonus, effect.teslaPhantomBonus);
  if (effect.flamerPanicSlow) agg.flamerPanicSlow = true;
  if (effect.flamerSwarmFocus) agg.flamerSwarmFocus = true;
  if (effect.railgunBossFocus != null) agg.railgunBossFocus = Math.max(agg.railgunBossFocus, effect.railgunBossFocus);
  if (effect.railgunPierceAll) agg.railgunPierceAll = true;
  if (effect.droneCorePriority) agg.droneCorePriority = true;
  if (effect.droneRevealAll) agg.droneRevealAll = true;
  if (effect.droneRepairFaster) agg.droneRepairFaster = true;
  if (effect.harvesterShieldAdjacent) agg.harvesterShieldAdjacent = true;
  if (effect.harvesterAdjacencyBonus != null) agg.harvesterAdjacencyBonus = Math.max(agg.harvesterAdjacencyBonus, effect.harvesterAdjacencyBonus);
  if (effect.unspentInterestPct != null) agg.unspentInterestPct = Math.max(agg.unspentInterestPct, effect.unspentInterestPct);
  if (effect.unspentInterestCap != null) agg.unspentInterestCap = Math.max(agg.unspentInterestCap, effect.unspentInterestCap);
  if (effect.waveCompleteCredits != null) agg.waveCompleteCredits += effect.waveCompleteCredits;
  if (effect.reflectorRailgunMul != null) agg.reflectorRailgunMul *= effect.reflectorRailgunMul;
  if (effect.squadCapAdd != null) agg.squadCapAdd += effect.squadCapAdd;
  if (effect.squadCooldownMul != null) agg.squadCooldownMul *= effect.squadCooldownMul;
  if (effect.squadCostMul != null) agg.squadCostMul *= effect.squadCostMul;
  if (effect.squadReconRevealMul != null) agg.squadReconRevealMul *= effect.squadReconRevealMul;
  if (effect.squadEngineerCaptureBonus != null) agg.squadEngineerCaptureBonus += effect.squadEngineerCaptureBonus;
  if (effect.squadStrikeDamageMul != null) agg.squadStrikeDamageMul *= effect.squadStrikeDamageMul;
  if (effect.squadShieldStrengthMul != null) agg.squadShieldStrengthMul *= effect.squadShieldStrengthMul;
  if (effect.squadJammerResistance != null) {
    agg.squadJammerResistance = Math.min(0.9, agg.squadJammerResistance + effect.squadJammerResistance);
  }
  if (effect.engineerRepairMul != null) agg.engineerRepairMul *= effect.engineerRepairMul;
  if (effect.towerHpAdd != null) agg.towerHpAdd += effect.towerHpAdd;
  if (effect.towerHpMul != null) agg.towerHpMul *= effect.towerHpMul;
  if (effect.saboteurDisableReduction != null) {
    agg.saboteurDisableReduction = Math.min(0.9, agg.saboteurDisableReduction + effect.saboteurDisableReduction);
  }
  if (effect.saboteurTowerDamageMul != null) agg.saboteurTowerDamageMul *= effect.saboteurTowerDamageMul;
  if (effect.emergencyNanitesPct != null) agg.emergencyNanitesPct = Math.max(agg.emergencyNanitesPct, effect.emergencyNanitesPct);
  if (effect.shieldTowerStrengthMul != null) agg.shieldTowerStrengthMul *= effect.shieldTowerStrengthMul;
  if (effect.abandonedTurretHpMul != null) agg.abandonedTurretHpMul *= effect.abandonedTurretHpMul;
}
