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
  paused: boolean;
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
  if (effect.towerFireRateMul) agg.towerFireRateMul *= effect.towerFireRateMul;
  if (effect.towerDamageMul) agg.towerDamageMul *= effect.towerDamageMul;
  if (effect.towerRangeMul) agg.towerRangeMul *= effect.towerRangeMul;
  if (effect.towerRangeAdd) agg.towerRangeAdd += effect.towerRangeAdd;
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
  if (effect.droneDamageAdd) agg.droneDamageAdd += effect.droneDamageAdd;
  if (effect.droneRangeAdd) agg.droneRangeAdd += effect.droneRangeAdd;
  if (effect.harvesterIncomeMul) agg.harvesterIncomeMul *= effect.harvesterIncomeMul;
  if (effect.slowedEnemyDamageMul) agg.slowedEnemyDamageMul *= effect.slowedEnemyDamageMul;
  if (effect.teslaChainAdd) agg.teslaChainAdd += effect.teslaChainAdd;
  if (effect.mortarSplashMul) agg.mortarSplashMul *= effect.mortarSplashMul;
  if (effect.phantomVisibleBonus) agg.phantomVisibleBonus += effect.phantomVisibleBonus;
  if (effect.towerBuildCostMul) agg.towerBuildCostMul *= effect.towerBuildCostMul;
  if (effect.sellRefundMul) agg.sellRefundMul = Math.max(agg.sellRefundMul, effect.sellRefundMul);
  if (effect.lowCoreFireRateMul) {
    agg.lowCoreFireRateMul = Math.max(agg.lowCoreFireRateMul, effect.lowCoreFireRateMul);
  }
  if (effect.lowCoreThreshold != null) {
    agg.lowCoreThreshold = Math.max(agg.lowCoreThreshold, effect.lowCoreThreshold);
  }
  if (effect.tacticalPause) agg.tacticalPause = true;
}
