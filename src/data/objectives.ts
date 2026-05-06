import type { EnemyType, TowerType } from "../core/Types";

/**
 * Sector objectives — primary (required to clear) and secondary (optional, reward research).
 *
 * Objectives are evaluated by the ObjectivesSystem against runtime stats.
 * Each objective has a "kind" that identifies a measurable predicate.
 */
export type ObjectiveKind =
  /** Survive every wave in the sector (default win condition). */
  | "survive_all"
  /** Defeat the named boss (final wave or earlier specific encounter). */
  | "defeat_boss"
  /** Finish the run with core integrity at or above the given pct (0..1). */
  | "core_above_pct"
  /** Lose fewer than N enemies to the core across the entire run. */
  | "leak_under"
  /** Build at least N towers of the given type during the run. */
  | "build_n_of_type"
  /** Build at least one tower of the given type during the run. */
  | "build_any_of_type"
  /** Total credits earned during the run >= threshold. */
  | "credits_earned"
  /** Unspent credits at run end >= threshold. */
  | "credits_unspent"
  /** Kill at least N enemies of a given type. */
  | "kill_n_type"
  /** Kill all enemies of the given types this run (boss style). */
  | "kill_any_type"
  /** Don't sell more than N towers during the run. */
  | "sells_under"
  /** Don't lose more than N towers (boss-disable / future destruction). */
  | "towers_lost_under"
  /** Sector-specific: keep a Scanner / detection structure alive at end. */
  | "scanner_alive"
  /** Sector-specific: end run with at least N harvesters built. */
  | "harvesters_at_least"
  /** Difficulty reach: clear in <= N total seconds (for fast clears). */
  | "fast_clear";

export interface ObjectiveDefinition {
  id: string;
  /** Short label for HUD/sector card (e.g. "Survive all waves"). */
  label: string;
  /** Slightly longer description shown on sector cards / victory screens. */
  detail: string;
  kind: ObjectiveKind;
  /** Numeric threshold used by some kinds (count / pct / seconds). */
  value?: number;
  /** Enemy type(s) referenced by kill_* objectives. */
  enemyType?: EnemyType;
  enemyTypes?: EnemyType[];
  /** Tower type referenced by build_* / scanner_alive objectives. */
  towerType?: TowerType;
  /** Research point reward for completing this secondary objective. */
  rewardResearch?: number;
  /** Optional credit reward at run end. */
  rewardCredits?: number;
}

export interface SectorObjectives {
  primary: ObjectiveDefinition;
  /** 3-4 optional objectives. */
  secondary: ObjectiveDefinition[];
  /** Short, atmospheric briefing used on the sector card and run start. */
  briefing: string;
  /** Suggested counterplay shown on the sector card. */
  counterplay: string[];
  /** Sector hazard summary shown on the sector card. */
  hazards?: string;
}

/**
 * Per-sector objective configuration. Keyed by sector id (matches sectors.ts).
 * Endless / Void uses a procedural/generic survival objective.
 */
export const sectorObjectives: Record<string, SectorObjectives> = {
  sector_01_broken_relay: {
    briefing:
      "Faint hostile chatter on the relay perimeter. Hold long enough for triangulation. Build wide, learn the lanes.",
    counterplay: ["Pulse + Blaster baseline", "Stasis on chokepoints", "Watch for early Brutes"],
    hazards: "Light environment — no special hazards. Focus on placement.",
    primary: {
      id: "s1_primary",
      label: "Survive all 15 waves.",
      detail: "Hold the relay through every scheduled wave.",
      kind: "survive_all",
    },
    secondary: [
      {
        id: "s1_iron_core",
        label: "Finish with core integrity above 75%.",
        detail: "End the run with at least 75% core health.",
        kind: "core_above_pct",
        value: 0.75,
        rewardResearch: 2,
      },
      {
        id: "s1_use_stasis",
        label: "Build at least one Stasis Projector.",
        detail: "Slow the line — control beats brute force.",
        kind: "build_any_of_type",
        towerType: "stasis",
        rewardResearch: 1,
      },
      {
        id: "s1_no_leak",
        label: "Lose fewer than 6 enemies to the core.",
        detail: "Total breaches across the entire sector.",
        kind: "leak_under",
        value: 6,
        rewardResearch: 2,
      },
      {
        id: "s1_no_panic_sell",
        label: "Sell no more than 2 towers.",
        detail: "Confident placement — no panic-pivots.",
        kind: "sells_under",
        value: 2,
        rewardResearch: 1,
      },
    ],
  },

  sector_02_orbital_platform: {
    briefing:
      "Crystal field mid-collapse. Greedy harvest pays — but enemy pressure scales fast. Decide when to invest, when to defend.",
    counterplay: ["Harvesters early", "Reflectors and Mortars on dense lanes", "Don't over-spend"],
    hazards: "Resource surges and crystal instability. Telegraphed.",
    primary: {
      id: "s2_primary",
      label: "Survive all 15 waves.",
      detail: "Hold the platform through every scheduled wave.",
      kind: "survive_all",
    },
    secondary: [
      {
        id: "s2_harvester_4",
        label: "Build at least 4 Harvesters.",
        detail: "Crystal mining at scale.",
        kind: "build_n_of_type",
        towerType: "harvester",
        value: 4,
        rewardResearch: 2,
      },
      {
        id: "s2_credits_900",
        label: "Earn at least 900 credits this run.",
        detail: "Total credits gained from kills, harvest, and waves.",
        kind: "credits_earned",
        value: 900,
        rewardResearch: 2,
      },
      {
        id: "s2_credits_unspent_120",
        label: "End the run with 120+ unspent credits.",
        detail: "Don't blow your reserves.",
        kind: "credits_unspent",
        value: 120,
        rewardResearch: 1,
      },
      {
        id: "s2_core_above_50",
        label: "Never let core drop below 50%.",
        detail: "Core integrity at end >= 50%.",
        kind: "core_above_pct",
        value: 0.5,
        rewardResearch: 2,
      },
    ],
  },

  sector_03_deep_space_wreckage: {
    briefing:
      "Phantom-heavy approach. Detection and disruption matter more than raw firepower. Plan coverage, not damage.",
    counterplay: ["Tesla Phase Disruptor", "Scanner Drone", "Wide tower coverage"],
    hazards: "Signal interference zones reduce tower range — they telegraph before settling.",
    primary: {
      id: "s3_primary",
      label: "Survive the phantom breach.",
      detail: "Hold against all 15 waves of phased pressure.",
      kind: "survive_all",
    },
    secondary: [
      {
        id: "s3_kill_phantoms",
        label: "Destroy at least 25 phantoms.",
        detail: "Phantom kill counter across the run.",
        kind: "kill_n_type",
        enemyType: "phantom",
        value: 25,
        rewardResearch: 2,
      },
      {
        id: "s3_phantom_no_leak",
        label: "Allow no more than 3 phantoms to breach.",
        detail: "Phantoms reaching the core.",
        kind: "leak_under",
        value: 3,
        enemyType: "phantom",
        rewardResearch: 2,
      },
      {
        id: "s3_use_tesla",
        label: "Build at least one Tesla Array.",
        detail: "Detection and chain damage are essential here.",
        kind: "build_any_of_type",
        towerType: "tesla",
        rewardResearch: 1,
      },
      {
        id: "s3_core_above_50",
        label: "Finish with core integrity above 50%.",
        detail: "End the run at 50%+ core.",
        kind: "core_above_pct",
        value: 0.5,
        rewardResearch: 2,
      },
    ],
  },

  sector_04_hostile_core: {
    briefing:
      "The hostile core itself. Sabotage, artillery, multi-boss pressure. Spread your towers, defend in depth, expect the unexpected.",
    counterplay: ["Spread placement (anti-artillery)", "Snare/EMP for Saboteurs", "Railgun + Reflector for boss damage"],
    hazards: "Harbinger artillery and Saboteur sabotage punish dense clusters. Spacing matters.",
    primary: {
      id: "s4_primary",
      label: "Defeat the Leviathan.",
      detail: "Destroy the final-wave anomaly.",
      kind: "defeat_boss",
      enemyType: "leviathan",
    },
    secondary: [
      {
        id: "s4_harbinger_kill",
        label: "Destroy the Harbinger.",
        detail: "The artillery boss appears mid-sector.",
        kind: "kill_n_type",
        enemyType: "harbinger",
        value: 1,
        rewardResearch: 3,
      },
      {
        id: "s4_core_above_50",
        label: "Finish with core above 50%.",
        detail: "End the run at 50%+ core integrity.",
        kind: "core_above_pct",
        value: 0.5,
        rewardResearch: 2,
      },
      {
        id: "s4_no_panic_sell",
        label: "Sell fewer than 5 towers.",
        detail: "Stay confident in your placement.",
        kind: "sells_under",
        value: 5,
        rewardResearch: 1,
      },
      {
        id: "s4_kill_saboteurs",
        label: "Destroy at least 8 Saboteurs.",
        detail: "Tower-disabler tally for the run.",
        kind: "kill_n_type",
        enemyType: "saboteur",
        value: 8,
        rewardResearch: 2,
      },
    ],
  },

  sector_void: {
    briefing:
      "Procedural drift. The map remembers nothing. All hazards combine — adapt every wave.",
    counterplay: ["All counters", "High flexibility", "Sell aggressively"],
    hazards: "Combined random hazards. The Void respects no template.",
    primary: {
      id: "void_primary",
      label: "Survive as long as possible.",
      detail: "Survive the Void's escalating pressure.",
      kind: "survive_all",
    },
    secondary: [
      {
        id: "void_kills_300",
        label: "Destroy 300+ enemies.",
        detail: "Total kill count for the run.",
        kind: "credits_earned",
        value: 0,
        rewardResearch: 2,
      },
      {
        id: "void_core_25",
        label: "Finish with core above 25%.",
        detail: "End the run at 25%+ core integrity.",
        kind: "core_above_pct",
        value: 0.25,
        rewardResearch: 2,
      },
    ],
  },
};

/** Sector-id ordered list, useful for UI iteration. */
export const sectorObjectiveOrder: string[] = [
  "sector_01_broken_relay",
  "sector_02_orbital_platform",
  "sector_03_deep_space_wreckage",
  "sector_04_hostile_core",
  "sector_void",
];
