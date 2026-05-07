import type {
  SectorDefinition,
  StrategicPointDefinition,
  WaveDefinition,
} from "../core/Types";
import { summarize } from "./waves";

/**
 * OPERATOR TRAINING — Sector 0
 *
 * Optional, replayable simulation that teaches Last Signal's command-defense
 * systems through gameplay. Pressure is intentionally lower than even Sector 1
 * so a brand-new player can experiment without losing the run.
 *
 * Mission identity: an instructor-narrated simulation. Eight short waves walk
 * the player through:
 *   - basic tower placement + signal coverage
 *   - relay expansion
 *   - strategic capture (signal node, radar dish, abandoned turret, data cache)
 *   - mobile squads (Recon → Engineer → Strike → Shield)
 *   - tower durability (Saboteur → Engineer repair)
 *   - hostile structure suppression (Jammer + Rift Anchor)
 *   - certification wave
 *
 * The map fits inside the default 25-wide canvas. The home core sits
 * slightly west of centre so the eastern half feels like the "frontier"
 * the player must push into.
 *
 * Coordinates below are in the source-layout space; expandLayout / expandSpawners
 * / expandStrategicPoints in sectors.ts shift them onto the runtime grid.
 */

// 25 cols × 18 rows source layout. Default expand pads to 32×22.
//                   col: 0123456789012345678901234
//                                  1111111111222222
// IMPORTANT: the home core (X cells) MUST have at least one walkable
// neighbour or the BFS in GridSystem.rebuildFlow can't escape the core,
// every spawner ends up at distance Infinity, and canPlaceTower fails
// the "all spawners reachable" check for every tile (reported as
// "Invalid location" everywhere). Rows 7 and 10 are intentionally clear
// directly above/below the core so the network is connected.
export const trainingLayout: string[] = [
  ".........................", // 0
  ".........................", // 1
  ".......C.........C.......", // 2  inner-ring crystals
  ".........................", // 3
  "......####.....####......", // 4  rock walls hint west/east lanes
  ".........................", // 5
  ".....................C...", // 6
  ".........................", // 7  open — corridor above the core
  "...........#XX#..........", // 8  HOME CORE row 1
  "N..........#XX#.........E", // 9  HOME CORE row 2 (N+E spawners flank)
  ".........................", // 10 open — corridor below the core
  ".........................", // 11
  "...C.....................", // 12
  ".........................", // 13
  "......####.....####......", // 14 rock walls south
  ".........................", // 15
  ".......C.........C.......", // 16
  ".........................", // 17
];

export const trainingSpawners = [
  { id: "north", label: "North Gate", c: 12, r: 0 },
  { id: "south", label: "South Gate", c: 12, r: 17 },
  { id: "west",  label: "West Gate",  c: 0,  r: 9  },
  { id: "east",  label: "East Gate",  c: 24, r: 9  },
];

/**
 * Strategic points are placed so the player encounters them in the order
 * the lessons teach:
 *
 *   STAGE 3 (capture):
 *     - signal node north  (12,4)  — inside initial coverage, easy capture
 *     - radar dish west    (4,9)   — at the western edge, may need short reach
 *     - data cache east    (20,9)  — across the map, uses a relay roll east
 *     - abandoned turret S (12,14) — protects the south lane
 *
 *   STAGE 5/7 (suppression):
 *     - jammer east        (18,12) — small radius near home, easy to clear
 *     - rift anchor east   (22,5)  — high-pressure target, kill before final wave
 *
 * Coordinates land inside the open lanes (no rock collisions) by inspection
 * against trainingLayout above.
 */
export const trainingStrategicPoints: StrategicPointDefinition[] = [
  {
    id: "tr_signal_north",
    type: "signal_node",
    c: 12,
    r: 4,
    name: "North Repeater",
    description:
      "Friendly signal repeater. Channel friendlies on top to capture.",
    captureSeconds: 5,
  },
  {
    id: "tr_radar_west",
    type: "radar_dish",
    c: 4,
    r: 9,
    name: "Damaged Radar Dish",
    description:
      "Capturing reveals more of the map and exposes hidden hostile structures.",
    captureSeconds: 6,
  },
  {
    id: "tr_cache_east",
    type: "data_cache",
    c: 20,
    r: 9,
    name: "Eastern Data Cache",
    description:
      "One-time pickup. Gives credits and a research point. Engineer captures faster.",
    captureSeconds: 5,
    rewardCredits: 80,
    rewardResearch: 1,
  },
  {
    id: "tr_turret_south",
    type: "abandoned_turret",
    c: 12,
    r: 14,
    name: "Wreckage Auto-Gun",
    description:
      "Salvageable turret. Capture to wake a free forward gun on the south lane.",
    captureSeconds: 6,
  },
  {
    id: "tr_jammer_east",
    type: "jammer",
    c: 18,
    r: 12,
    name: "Short-Range Jammer",
    // Smaller radius and weaker health than campaign jammers so it teaches
    // suppression without crippling an inexperienced defense.
    radiusCells: 4,
    health: 60,
  },
  {
    id: "tr_rift_east",
    type: "rift_anchor",
    c: 22,
    r: 5,
    name: "Frayed Rift Anchor",
    radiusCells: 5,
    health: 80,
  },
];

/**
 * Eight short training waves. Each wave is hand-authored with rich name /
 * warning / counter text so the wave-preview panel reads like a guided
 * exercise. Counts and intervals are intentionally low — the focus is on
 * teaching, not mechanical pressure.
 */
export function trainingWaves(): WaveDefinition[] {
  return [
    summarize({
      id: "tr_w1_basic_contact",
      name: "Drill 1: Basic Contact",
      description: "Light scout probe from the north gate.",
      warning: "Build 2 towers inside Signal Coverage. Click START WAVE when ready.",
      recommendedCounters: ["Pulse Cannon", "Blaster Node"],
      rewardCredits: 60,
      rewardChoice: false,
      lanes: [{ spawnerId: "north", enemies: [{ type: "scout", count: 5, interval: 1.0 }] }],
    }),
    summarize({
      id: "tr_w2_split_signal",
      name: "Drill 2: Split Signal",
      description: "Two-lane probe. The west gate joins the assault.",
      warning: "Coverage is the priority. Consider deploying a Relay Core (R) to extend Signal Coverage.",
      recommendedCounters: ["Pulse Cannon", "Relay Core"],
      rewardCredits: 75,
      rewardChoice: false,
      lanes: [
        { spawnerId: "north", enemies: [{ type: "grunt", count: 6, interval: 0.95 }] },
        { spawnerId: "west", enemies: [{ type: "scout", count: 5, interval: 0.85 }], startDelay: 2.5 },
      ],
    }),
    summarize({
      id: "tr_w3_capture_drill",
      name: "Drill 3: Capture Drill",
      description: "Light pressure while you secure the North Repeater.",
      warning: "Capture the Signal Node north of the core. Engineer (F2) accelerates capture.",
      recommendedCounters: ["Engineer Squad", "Capture progress"],
      rewardCredits: 90,
      rewardChoice: true,
      lanes: [
        { spawnerId: "south", enemies: [{ type: "grunt", count: 6, interval: 1.1 }] },
      ],
    }),
    summarize({
      id: "tr_w4_radar_drill",
      name: "Drill 4: Visibility Drill",
      description: "A small wave gives you time to capture the western radar.",
      warning: "Push west and capture the Damaged Radar Dish. Recon Squad (F1) reveals dark areas.",
      recommendedCounters: ["Recon Squad", "Radar capture"],
      rewardCredits: 100,
      rewardChoice: false,
      lanes: [
        { spawnerId: "east", enemies: [{ type: "scout", count: 5, interval: 0.9 }] },
        { spawnerId: "west", enemies: [{ type: "grunt", count: 4, interval: 1.1 }], startDelay: 3.0 },
      ],
    }),
    summarize({
      id: "tr_w5_saboteur_drill",
      name: "Drill 5: Saboteur Drill",
      description: "A single Saboteur tests your line. Towers will take real damage.",
      warning: "Saboteurs damage tower HP. Engineers (F2) repair towers — including disabled ones.",
      recommendedCounters: ["Engineer Squad", "Stasis", "Snare"],
      rewardCredits: 120,
      rewardChoice: true,
      lanes: [
        { spawnerId: "south", enemies: [{ type: "grunt", count: 5, interval: 1.0 }] },
        { spawnerId: "south", enemies: [{ type: "saboteur", count: 1, interval: 1 }], startDelay: 4.0 },
      ],
    }),
    summarize({
      id: "tr_w6_rift_drill",
      name: "Drill 6: Rift Drill",
      description: "The eastern Rift Anchor begins pulsing. A jammer suppresses fire near it.",
      warning: "Strike Squad (F3) cracks hostile structures. Shield Squad (F4) absorbs rift pulses.",
      recommendedCounters: ["Strike Squad", "Shield Squad", "Engineer repair"],
      rewardCredits: 140,
      rewardChoice: false,
      lanes: [
        { spawnerId: "east", enemies: [{ type: "scout", count: 4, interval: 0.7 }] },
        { spawnerId: "north", enemies: [{ type: "grunt", count: 4, interval: 1.0 }], startDelay: 3.0 },
      ],
    }),
    summarize({
      id: "tr_w7_combined",
      name: "Drill 7: Combined Exercise",
      description: "A modest mixed wave. Use the captured turret, your towers, and your squads together.",
      warning: "Coordinate — your forward turret, towers, and any active squads should converge here.",
      recommendedCounters: ["Mixed defense", "Active squad usage"],
      rewardCredits: 160,
      rewardChoice: true,
      lanes: [
        { spawnerId: "north", enemies: [{ type: "grunt", count: 5, interval: 1.0 }] },
        { spawnerId: "south", enemies: [{ type: "scout", count: 4, interval: 0.7 }], startDelay: 2.5 },
        { spawnerId: "east", enemies: [{ type: "saboteur", count: 1, interval: 1 }], startDelay: 6.0 },
      ],
    }),
    summarize({
      id: "tr_w8_certification",
      name: "Drill 8: Certification",
      description: "The graduation wave. Everything you've learned, in one short engagement.",
      warning: "Final assessment. Towers, repair, squads, and structure suppression all matter — but you have the tools.",
      recommendedCounters: ["Engineer", "Strike", "Shield", "Steady fire"],
      rewardCredits: 200,
      rewardChoice: false,
      lanes: [
        { spawnerId: "north", enemies: [{ type: "grunt", count: 6, interval: 1.0 }] },
        { spawnerId: "east", enemies: [{ type: "scout", count: 6, interval: 0.7 }], startDelay: 1.5 },
        { spawnerId: "south", enemies: [{ type: "grunt", count: 4, interval: 1.0 }], startDelay: 3.5 },
      ],
    }),
  ];
}

/**
 * Final SectorDefinition for the training run. Marked `isTraining: true` so
 * Game / SectorSelect can apply training-specific behavior (no random
 * modifiers, never updates bestSectorCleared, always available, etc.).
 */
export const trainingSectorDefinition: SectorDefinition = {
  id: "sector_00_operator_training",
  name: "Sector 0 — Operator Training",
  description:
    "Optional simulation. Learn tower placement, signal expansion, strategic capture, mobile squads, tower repair, and hostile structure suppression in a low-pressure environment.",
  accentColor: "#ffeb3b",
  layout: trainingLayout,
  spawners: trainingSpawners,
  waves: trainingWaves(),
  // Generous credits + core integrity so a struggling new player still finishes.
  startingCredits: 350,
  coreIntegrity: 140,
  lore: "Field exercise. The signals you defend here are echoes — but the lessons are real.",
  // Strip every environmental hazard so the only pressure comes from authored waves.
  hazards: { meteors: false, gravity: false, signalInterference: false, powerSurges: false },
  strategicPoints: trainingStrategicPoints,
  isTraining: true,
};
