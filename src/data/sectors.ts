import type {
  SectorDefinition,
  WaveDefinition,
  EnemyType,
  StrategicPointDefinition,
} from "../core/Types";
import { defaultWaves, sector2Waves, sector3Waves, sector4Waves } from "./waves";
import { COLS, ROWS } from "../core/Config";
import { mulberry32 } from "../core/Random";

/**
 * Base layouts are authored in a compact format, then auto-expanded to the runtime map size.
 *   . empty    # rock     C crystal    X core
 *   N/E/S/W   spawner marker (matching spawner id)
 */

// Sector 1 — Broken Relay: simple four-lane teaching map.
const sector1Layout = [
  ".........................",
  ".........................",
  "...#...........C.........",
  ".........................",
  "....................C....",
  ".........................",
  "..C........######........",
  ".........................",
  "...........#XX#..........",
  "N..........#XX#.........E",
  "...........####..........",
  ".........................",
  ".......C.................",
  ".........................",
  ".........................",
  "................C........",
  ".........................",
  "..........#..............",
  ".........................",
  ".........................",
];

// Sector 2 — Crystal Scar: more crystals, tougher side lanes.
const sector2Layout = [
  ".........................",
  "..C....C...........C.....",
  ".........................",
  ".....####........####....",
  ".........................",
  "...C.................C...",
  ".........................",
  "........###.#.###........",
  ".........#XX#............",
  "N........#XX#...........E",
  ".........####............",
  ".........................",
  "..C.................C....",
  ".........................",
  ".....####........####....",
  ".........................",
  ".......C........C........",
  ".........................",
  "...C.................C...",
  ".........................",
];

// Sector 3 — Phantom Gate: narrow approaches + crystal scarcity.
const sector3Layout = [
  "#.......................#",
  "#.......................#",
  "#...###.....C......###..#",
  "#...............#........",
  "..........#..............",
  ".................#.......",
  "......C......#...........",
  ".......#.................",
  "...........#XX#..........",
  "N..........#XX#.........E",
  "...........####..........",
  ".................#.......",
  ".........#...............",
  "..............C..........",
  "........#................",
  ".................#.......",
  "#....###....C......###..#",
  "#........................",
  "#.......................#",
  "#.......................#",
];

const sector4Layout = [
  "..#......C....#......C...",
  "....###.........###......",
  "C........#.#...........C.",
  "....#.............#......",
  "..####....###....####....",
  ".........#...#...........",
  ".C....#.........#....C...",
  "......#..#####..#........",
  "N........#XX#...........E",
  ".........#XX#............",
  "......#..####...#........",
  ".C....#.........#....C...",
  ".........#...#...........",
  "..####....###....####....",
  "....#.............#......",
  "C........#.#...........C.",
  "....###.........###......",
  "..#......C....#......C...",
  "............#............",
  ".........................",
];

function voidLayout(seed = 1337): string[] {
  const rows = Array.from({ length: 20 }, () => Array.from({ length: 25 }, () => "."));
  rows[8]![12] = "X"; rows[8]![13] = "X"; rows[9]![12] = "X"; rows[9]![13] = "X";
  rows[9]![0] = "N"; rows[9]![24] = "E";
  for (let i = 0; i < 44; i++) {
    const c = Math.floor(Math.abs(Math.sin(seed + i * 91.7)) * 25);
    const r = Math.floor(Math.abs(Math.sin(seed * 0.7 + i * 47.3)) * 20);
    if (c >= 10 && c <= 15 && r >= 7 && r <= 11) continue;
    rows[r]![c] = i % 7 === 0 ? "C" : "#";
  }
  return rows.map((r) => r.join(""));
}

const defaultSpawners = [
  { id: "north", label: "North Gate", c: 12, r: 0 },
  { id: "south", label: "South Gate", c: 12, r: 19 },
  { id: "east", label: "East Gate", c: 24, r: 9 },
  { id: "west", label: "West Gate", c: 0, r: 9 },
];

function expandLayout(layout: string[]): string[] {
  const srcH = layout.length;
  const srcW = Math.max(...layout.map((r) => r.length));
  const offC = Math.max(0, Math.floor((COLS - srcW) / 2));
  const offR = Math.max(0, Math.floor((ROWS - srcH) / 2));
  const out = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => "."));
  for (let r = 0; r < srcH; r++) {
    for (let c = 0; c < srcW; c++) {
      const ch = layout[r]?.charAt(c) || ".";
      if (offR + r >= ROWS || offC + c >= COLS) continue;
      out[offR + r]![offC + c] = ch;
    }
  }
  return out.map((row) => row.join(""));
}

function expandSpawners(spawners: SectorDefinition["spawners"], layout: string[]): SectorDefinition["spawners"] {
  const srcH = layout.length;
  const srcW = Math.max(...layout.map((r) => r.length));
  const offC = Math.max(0, Math.floor((COLS - srcW) / 2));
  const offR = Math.max(0, Math.floor((ROWS - srcH) / 2));
  return spawners.map((s) => ({ ...s, c: s.c + offC, r: s.r + offR }));
}

function cloneWaves(waves: WaveDefinition[]): WaveDefinition[] {
  // Structural clone so sector tweaks don't leak across sectors.
  return waves.map((w) => ({
    ...w,
    lanes: w.lanes.map((l) => ({
      ...l,
      enemies: l.enemies.map((g) => ({ ...g })),
    })),
    enemySummary: w.enemySummary?.map((e) => ({ ...e })),
  }));
}

// Sector 2 (Crystal Scar) curated waves — economy / greed teaching.
function crystalScarWaves(): WaveDefinition[] {
  return cloneWaves(sector2Waves);
}

// Sector 3 (Phantom Gate) curated waves — detection / control teaching.
// We additionally apply a deterministic phantom-mutation pass so a portion
// of generic scouts/grunts in any sub-wave become phantoms; this preserves
// the "phantom-heavy" feel while keeping waves stable & previewable.
function phantomGateWaves(): WaveDefinition[] {
  const out = cloneWaves(sector3Waves);
  const phantomTargets: EnemyType[] = ["scout", "grunt"];
  const rand = mulberry32(0xC0FFEE);
  for (const w of out) {
    // Don't mutate boss waves or final-gauntlet pacing.
    if (w.isBossWave) continue;
    for (const lane of w.lanes) {
      for (const g of lane.enemies) {
        if (phantomTargets.includes(g.type) && rand() < 0.35) {
          g.type = "phantom";
        }
      }
    }
    if (w.enemySummary) {
      const map = new Map<EnemyType, number>();
      for (const lane of w.lanes) {
        for (const g of lane.enemies) map.set(g.type, (map.get(g.type) ?? 0) + g.count);
      }
      w.enemySummary = Array.from(map.entries()).map(([type, count]) => ({ type, count }));
    }
  }
  return out;
}

// Sector 4 (Hostile Core) curated waves — final-exam difficulty with two bosses.
function hostileCoreWaves(): WaveDefinition[] {
  return cloneWaves(sector4Waves);
}

// Void waves: take a deterministically scrambled & buffed Sector-4 wave list
// to give post-game / endless runs combined-arms pressure.
function voidWaves(): WaveDefinition[] {
  const out = cloneWaves(sector4Waves);
  for (const w of out) {
    for (const lane of w.lanes) {
      for (const g of lane.enemies) {
        g.count = Math.ceil(g.count * 1.15);
      }
    }
    w.rewardCredits = Math.round(w.rewardCredits * 1.1);
  }
  return out;
}



// ──────────────────────────────────────────────────────────
// SECTOR 6 — FRACTURED EXPANSE (64×44) — first large-format map
// ──────────────────────────────────────────────────────────
function buildExpanseLayout(): string[] {
  const W = 64, H = 44;
  const rows = Array.from({ length: H }, () => Array.from({ length: W }, () => "."));
  // Helper to set a cell.
  const set = (c: number, r: number, ch: string) => { if (r >= 0 && r < H && c >= 0 && c < W) rows[r]![c] = ch; };
  // Place core cluster (2x2) at center. Center-of-cluster is roughly (32.5, 22.5).
  const coreC = 31, coreR = 21;
  set(coreC, coreR, "X"); set(coreC+1, coreR, "X"); set(coreC, coreR+1, "X"); set(coreC+1, coreR+1, "X");
  // Outer rock clusters that form natural "between core and relay" chokepoints.
  // Tuned so relay deployments at the edge of the initial signal radius
  // (~8 cells) are funneled through readable lanes rather than open desert.
  const rockClusters = [
    [10, 8], [50, 8], [10, 35], [50, 35], [30, 5], [30, 38],
    [8, 22], [55, 22], [20, 14], [44, 14], [20, 30], [44, 30],
  ];
  for (const [cx, cy] of rockClusters) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(cx! + dx, cy! + dy, "#");
  }
  // Crystal nodes — three tiers:
  //   1. Inner ring (within initial signal range): playable economy from turn 1.
  //   2. Mid ring (just outside initial range): unlocked by the first relay.
  //   3. Outer ring (corners): unlocked by chained relays.
  const innerCrystals = [
    [25, 18], [38, 18], [25, 26], [38, 26],
  ];
  const midCrystals = [
    [20, 10], [44, 10], [20, 33], [44, 33], [15, 22], [48, 22], [32, 8], [32, 36],
  ];
  const outerCrystals = [
    [5, 5], [58, 5], [5, 38], [58, 38],
  ];
  for (const [cx, cy] of innerCrystals) set(cx!, cy!, "C");
  for (const [cx, cy] of midCrystals) set(cx!, cy!, "C");
  for (const [cx, cy] of outerCrystals) set(cx!, cy!, "C");
  // Spawner markers.
  set(32, 0, "N"); set(32, 43, "S"); set(0, 22, "W"); set(63, 22, "E");
  set(58, 5, "."); set(5, 5, "."); // Clear outer-corner crystals where spawners would overlap; re-place nearby.
  set(56, 3, "C"); set(7, 3, "C");
  // Extra spawners (NE, SW).
  set(60, 3, "."); set(3, 40, ".");
  return rows.map(r => r.join(""));
}

/**
 * Sector 6 strategic map points.
 *
 * Positions are chosen to sit on empty tiles outside the rock-cluster
 * footprints. They form a ring of objectives that the player must roll relays
 * out to reach:
 *   - 2 SIGNAL_NODE  : reachable shortly after the first relay (N/S of core).
 *   - 1 RADAR_DISH   : sits near a mid-ring choke; clears wave intel for darkness.
 *   - 2 DATA_CACHE   : on the diagonals; pure exploration reward.
 *   - 2 RIFT_ANCHOR  : near opposite spawners; suppress to weaken pressure.
 *   - 1 JAMMER       : on the side opposite the radar; punishes turtling.
 */
const expanseStrategicPoints: StrategicPointDefinition[] = [
  // Friendly signal repeaters — reachable from the first relay.
  { id: "s6_signal_north", type: "signal_node", c: 32, r: 12, name: "North Repeater" },
  { id: "s6_signal_south", type: "signal_node", c: 32, r: 32, name: "South Repeater" },
  // Big sensor dish — captures unlock radar reveal.
  { id: "s6_radar_west", type: "radar_dish", c: 12, r: 22, name: "Western Radar Dish" },
  // One-time research/credit caches in the corners (exploration reward).
  { id: "s6_cache_ne", type: "data_cache", c: 52, r: 11, name: "NE Data Cache",
    rewardCredits: 110, rewardResearch: 1 },
  { id: "s6_cache_sw", type: "data_cache", c: 12, r: 33, name: "SW Data Cache",
    rewardCredits: 110, rewardResearch: 1 },
  // Hostile rift anchors near opposite gates — destroying them weakens waves.
  { id: "s6_rift_east", type: "rift_anchor", c: 56, r: 14, name: "East Rift Anchor" },
  { id: "s6_rift_south", type: "rift_anchor", c: 28, r: 39, name: "South Rift Anchor" },
  // One jammer punishes pure turtle play; suppresses signal until cleared.
  { id: "s6_jammer_east", type: "jammer", c: 50, r: 28, name: "East Jammer" },
];

const expanseSpawners = [
  { id: "north",     label: "North Gate",     c: 32, r: 0  },
  { id: "south",     label: "South Gate",     c: 32, r: 43 },
  { id: "east",      label: "East Gate",      c: 63, r: 22 },
  { id: "west",      label: "West Gate",      c: 0,  r: 22 },
  { id: "northeast", label: "NE Rift",        c: 60, r: 3  },
  { id: "southwest", label: "SW Rift",        c: 3,  r: 40 },
];

function expanseWaves(): WaveDefinition[] {
  // Extended 25-wave campaign using multi-lane pressure.
  const waves = cloneWaves(defaultWaves);
  // Scale up all existing waves by 1.5x count and add a few extra spawner lanes.
  for (const w of waves) {
    for (const lane of w.lanes) {
      for (const g of lane.enemies) {
        g.count = Math.ceil(g.count * 1.5);
      }
    }
    w.rewardCredits = Math.round(w.rewardCredits * 1.4);
  }
  // Add 10 more waves of escalating pressure using all spawners.
  const extraTypes: EnemyType[] = ["grunt", "brute", "phantom", "splitter", "shielder", "carrier", "jammer", "tunneler", "saboteur", "juggernaut"];
  for (let i = 0; i < 10; i++) {
    const mainType = extraTypes[i]!;
    const supportType = extraTypes[(i + 3) % extraTypes.length]!;
    const laneIds = ["north", "south", "east", "west", "northeast", "southwest"];
    const wave: WaveDefinition = {
      id: `s6_extra_${i + 16}`,
      name: `Expanse ${i + 16}`,
      description: `Multi-lane ${mainType} pressure.`,
      warning: "Enemies attack from multiple directions.",
      recommendedCounters: [],
      rewardCredits: 180 + i * 20,
      rewardChoice: i % 2 === 0,
      lanes: [
        { spawnerId: laneIds[i % 6]!, enemies: [{ type: mainType, count: 8 + i * 2, interval: 0.6 }] },
        { spawnerId: laneIds[(i + 2) % 6]!, enemies: [{ type: supportType, count: 5 + i, interval: 0.8 }], startDelay: 2 },
        { spawnerId: laneIds[(i + 4) % 6]!, enemies: [{ type: "grunt" as EnemyType, count: 6 + i, interval: 0.5 }], startDelay: 4 },
      ],
      isBossWave: i === 9,
    };
    if (i === 4) wave.waveEvent = "blitz";
    if (i === 7) wave.waveEvent = "silence";
    if (i === 9) {
      wave.lanes.push({ spawnerId: "north", enemies: [{ type: "leviathan", count: 1, interval: 1 }], startDelay: 8 });
    }
    waves.push(wave);
  }
  return waves;
}

const baseSectorDefinitions: SectorDefinition[] = [
  {
    id: "sector_01_broken_relay",
    name: "Sector 1 — Broken Relay",
    description:
      "A simple four-lane outpost. Good teaching layout. Plenty of crystal room to experiment.",
    accentColor: "#66fcf1",
    layout: sector1Layout,
    spawners: defaultSpawners,
    waves: cloneWaves(defaultWaves),
    startingCredits: 250,
    coreIntegrity: 100,
    lore: "A battered relay still whispers through the static. Hold it long enough to triangulate the source.",
    // Sector 1 is the teaching sector — keep the field clean of environmental chaos.
    hazards: { meteors: false, gravity: false, signalInterference: false, powerSurges: false },
  },
  {
    id: "sector_02_orbital_platform",
    name: "Sector 2 — Crystal Scar",
    description:
      "A dense crystal field. Economy decisions matter here — harvesters thrive but side lanes are thinner.",
    accentColor: "#00e676",
    layout: sector2Layout,
    spawners: defaultSpawners,
    waves: crystalScarWaves(),
    startingCredits: 230,
    coreIntegrity: 100,
    lore: "The platform's gravity wells are failing in sequence. Every corridor has become a launch tube.",
    // Crystal Scar: economy + power surges fit the theme; keep it tactical.
    hazards: { meteors: false, gravity: false, signalInterference: false, powerSurges: true },
  },
  {
    id: "sector_03_deep_space_wreckage",
    name: "Sector 3 — Phantom Gate",
    description:
      "Narrow corridors and few crystals. Expect phantom-heavy waves — anti-phase becomes essential.",
    accentColor: "#9e9e9e",
    layout: sector3Layout,
    spawners: defaultSpawners,
    waves: phantomGateWaves(),
    startingCredits: 260,
    coreIntegrity: 100,
    lore: "Something inside the wreck is answering your pings. The reply arrives before the signal is sent.",
    darkness: true,
    // Phantom Gate: signal interference + gravity anomaly fit the disruptor theme.
    hazards: { meteors: false, gravity: true, signalInterference: true, powerSurges: false },
  },
  {
    id: "sector_04_hostile_core",
    name: "Sector 4 - Hostile Core",
    description:
      "Final sector. Enemies start pre-buffed across 20 waves with two boss encounters and no mercy windows.",
    accentColor: "#ff1744",
    layout: sector4Layout,
    spawners: defaultSpawners,
    waves: hostileCoreWaves(),
    startingCredits: 280,
    coreIntegrity: 110,
    lore: "This is not a relay. It is the thing using relays to speak.",
    // Hostile Core: meteors + power surges, plus boss artillery already provides "shells".
    hazards: { meteors: true, gravity: false, signalInterference: true, powerSurges: true },
  },
  {
    id: "sector_void",
    name: "Void - Procedural Drift",
    description:
      "A stitched room-template layout generated from a fixed seed for replayable randomized pressure.",
    accentColor: "#b39ddb",
    layout: voidLayout(),
    spawners: defaultSpawners,
    waves: voidWaves(),
    startingCredits: 240,
    coreIntegrity: 100,
    lore: "The Void is a map that forgot its own shape. The route is stable only until the next run.",
    darkness: true,
    // Void: every hazard. Combined chaos is the point.
    hazards: { meteors: true, gravity: true, signalInterference: true, powerSurges: true },
  },
  {
    id: "sector_06_fractured_expanse",
    name: "Sector 6 — Fractured Expanse",
    description:
      "A vast open battlefield with 6 spawners. Deploy relay cores to extend your signal network and reach distant crystals before the swarm does.",
    accentColor: "#40c4ff",
    layout: buildExpanseLayout(),
    spawners: expanseSpawners,
    waves: expanseWaves(),
    // Tuned higher so the player can afford the early build-out + first relay
    // by wave 3 without being forced into a lossy economy stall.
    startingCredits: 420,
    coreIntegrity: 120,
    cols: 64,
    rows: 44,
    // Sensor range shrinks past the initial signal network — taking the map
    // means rolling new relays forward to push back the dark.
    darkness: true,
    lore: "The expanse stretches past sensor range. What you can't see, you can't defend.",
    hazards: { meteors: true, gravity: false, signalInterference: false, powerSurges: true },
  },
];

export const sectorDefinitions: SectorDefinition[] = baseSectorDefinitions.map((s) => {
  // Large sectors (those that specify cols/rows) use their layout as-is.
  if (s.cols && s.rows) return { ...s };
  // Legacy sectors get centered/expanded to COLS×ROWS.
  return {
    ...s,
    layout: expandLayout(s.layout),
    spawners: expandSpawners(s.spawners, s.layout),
  };
});
