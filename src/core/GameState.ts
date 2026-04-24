import { EventBus } from "./EventBus";
import { StateMachine } from "./StateMachine";
import { Time } from "./Time";
import type { GameSettings, PersistedProfile, RunStats, SectorDefinition, SpeedMultiplier, TowerType, UpgradeEffect } from "./Types";

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
  slowMo: number; // seconds of slow-motion
  showHeatmap: boolean;               // live enemy-density heat overlay (H key)
}

export function createEmptyStats(): RunStats {
  return {
    enemiesKilled: 0,
    creditsEarned: 0,
    coreDamageTaken: 0,
    damageByTowerType: {},
    damageByEnemyType: {},
    killsByEnemyType: {},
    startedAt: performance.now(),
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
  if (effect.sellRefundMul) agg.sellRefundMul = effect.sellRefundMul;
  if (effect.lowCoreFireRateMul) {
    agg.lowCoreFireRateMul = Math.max(agg.lowCoreFireRateMul, effect.lowCoreFireRateMul);
  }
  if (effect.lowCoreThreshold != null) {
    agg.lowCoreThreshold = Math.max(agg.lowCoreThreshold, effect.lowCoreThreshold);
  }
}
