import type { SectorDefinition, WaveDefinition, EnemyType } from "../core/Types";
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
];

export const sectorDefinitions: SectorDefinition[] = baseSectorDefinitions.map((s) => ({
  ...s,
  layout: expandLayout(s.layout),
  spawners: expandSpawners(s.spawners, s.layout),
}));
