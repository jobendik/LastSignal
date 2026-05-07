import type { EnemyType, StrategicPointType, TowerType } from "../core/Types";

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
  | "fast_clear"
  /** Strategic map points: capture at least N points of a given type. */
  | "capture_n_strategic"
  /** Strategic map points: destroy at least N hostile structures of a given type. */
  | "destroy_n_strategic";

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
  /** Strategic point type referenced by capture_/destroy_ objectives. */
  strategicType?: StrategicPointType;
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

  sector_06_fractured_expanse: {
    briefing:
      "Lost relays, hostile rifts, and dead-air zones stretch past the dish. Push your signal network outward — capture what helps you, suppress what's killing you, and survive the multi-front swarm.",
    counterplay: [
      "Roll relays toward signal nodes",
      "Capture the radar dish for wave intel",
      "Bring towers within range of rift anchors",
    ],
    hazards: "Hostile rift anchors and a jammer dim the map until destroyed.",
    primary: {
      id: "s6_primary",
      label: "Survive every wave of the Fractured Expanse.",
      detail: "Hold the home core through all 25 waves.",
      kind: "survive_all",
    },
    secondary: [
      {
        id: "s6_capture_signal_nodes",
        label: "Signal Nodes captured (2).",
        detail: "Extend your network through the captured repeaters.",
        kind: "capture_n_strategic",
        strategicType: "signal_node",
        value: 2,
        rewardResearch: 2,
        rewardCredits: 40,
      },
      {
        id: "s6_capture_radar",
        label: "Radar Dish secured.",
        detail: "Wave intel and reveal range scale up once it's online.",
        kind: "capture_n_strategic",
        strategicType: "radar_dish",
        value: 1,
        rewardResearch: 2,
      },
      {
        id: "s6_activate_turret",
        label: "Wreckage turret activated.",
        detail: "Capture the abandoned turret on the NE forward line.",
        kind: "capture_n_strategic",
        strategicType: "abandoned_turret",
        value: 1,
        rewardResearch: 1,
        rewardCredits: 30,
      },
      {
        id: "s6_destroy_rifts",
        label: "Rift Anchors destroyed (2).",
        detail: "Bring towers into range and tear down both corruption spires.",
        kind: "destroy_n_strategic",
        strategicType: "rift_anchor",
        value: 2,
        rewardResearch: 3,
        rewardCredits: 60,
      },
      {
        id: "s6_silence_jammers",
        label: "Jammer silenced.",
        detail: "Clears the suppression field around your network.",
        kind: "destroy_n_strategic",
        strategicType: "jammer",
        value: 1,
        rewardResearch: 2,
      },
      {
        id: "s6_recover_caches",
        label: "Data Caches recovered (2).",
        detail: "Each cache gives credits and a research breakthrough.",
        kind: "capture_n_strategic",
        strategicType: "data_cache",
        value: 2,
        rewardResearch: 1,
      },
      {
        id: "s6_core_above_50",
        label: "Finish with core integrity above 50%.",
        detail: "Steady defense across the long campaign.",
        kind: "core_above_pct",
        value: 0.5,
        rewardResearch: 2,
      },
    ],
  },

  sector_07_blackout_array: {
    briefing:
      "The Blackout Array belongs to the rift. Two jammers smother your towers and three anchors pump scout pressure. Capturing isn't optional — destroying enemy infrastructure IS the mission.",
    counterplay: [
      "Push east to bring towers in range of rift anchors",
      "Destroy a jammer before tower fire rate cripples you",
      "Use the forward auto-gun as a midline foothold",
    ],
    hazards: "Multiple rift anchors and jammers. Signal interference rolls. Darkness.",
    primary: {
      id: "s7_primary",
      label: "Survive the suppression and hold the array.",
      detail: "Hold the home core through every wave of the Blackout Array.",
      kind: "survive_all",
    },
    secondary: [
      {
        id: "s7_destroy_rifts",
        label: "Rift Anchors destroyed (3).",
        detail: "Tear down all three corruption spires.",
        kind: "destroy_n_strategic",
        strategicType: "rift_anchor",
        value: 3,
        rewardResearch: 4,
        rewardCredits: 120,
      },
      {
        id: "s7_silence_jammers",
        label: "Jammers silenced (2).",
        detail: "Both jammer arrays must fall to clear the suppression field.",
        kind: "destroy_n_strategic",
        strategicType: "jammer",
        value: 2,
        rewardResearch: 3,
        rewardCredits: 60,
      },
      {
        id: "s7_capture_radar",
        label: "Damaged Radar Dish secured.",
        detail: "Radar reveal is critical for spotting hostile structures.",
        kind: "capture_n_strategic",
        strategicType: "radar_dish",
        value: 1,
        rewardResearch: 2,
      },
      {
        id: "s7_activate_turret",
        label: "Forward Auto-Gun activated.",
        detail: "Capture the abandoned turret on the central forward line.",
        kind: "capture_n_strategic",
        strategicType: "abandoned_turret",
        value: 1,
        rewardResearch: 2,
        rewardCredits: 40,
      },
      {
        id: "s7_recover_cache",
        label: "SE Data Cache recovered.",
        detail: "The data cache is deep in hostile territory — risk it.",
        kind: "capture_n_strategic",
        strategicType: "data_cache",
        value: 1,
        rewardResearch: 1,
      },
      {
        id: "s7_core_above_40",
        label: "Finish with core integrity above 40%.",
        detail: "The Array hits hard — keep the home core breathing.",
        kind: "core_above_pct",
        value: 0.4,
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
  "sector_06_fractured_expanse",
  "sector_07_blackout_array",
];
