import type { SectorDefinition, WaveDefinition, EnemyType } from "../core/Types";
import { advancedWaves, defaultWaves } from "./waves";

/**
 * Layouts are 20 rows of 25 chars.
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

// Sector 4 — Iron Bastion: fortress layout with rock chokepoints and scarce crystals.
const sector4Layout = [
  "#########...#....########",
  "#.......................#",
  "#..C......#......C......#",
  "#.........#..............",
  "...#######.######........",
  ".........................",
  "...C..........C..........",
  ".##.##...........##.##...",
  ".........#XX#............",
  "N........#XX#...........E",
  ".........####............",
  ".##.##...........##.##...",
  "..........C..............",
  "......................C..",
  "...######.##########.....",
  ".........................",
  "#..........C............#",
  "#..C.....................",
  "#.......................#",
  "##########.....##########",
];

// Sector 5 — Mirror Expanse: long open field, many spawners, many crystals.
const sector5Layout = [
  ".........................",
  "C.C...C..C...C..C...C.C..",
  ".........................",
  "...####..............####",
  ".........................",
  ".....C...C....C...C......",
  ".........................",
  "...#.................#...",
  ".........#XX#............",
  "N........#XX#...........E",
  ".........####............",
  "...#.................#...",
  ".........................",
  ".....C...C....C...C......",
  ".........................",
  "####..............####...",
  ".........................",
  "C.C...C..C...C..C...C.C..",
  ".........................",
  ".........................",
];

// Sector 6 — The Abyss: chaotic, hazard-heavy final campaign sector.
const sector6Layout = [
  "#....#....#....#....#...#",
  ".......................C.",
  ".#...C.........C.....#...",
  "..........#..............",
  "...C..#..........#..C....",
  ".........................",
  ".#.....C.....C.......#...",
  "...........###...........",
  "..........#XX#...........",
  "N.........#XX#..........E",
  "...........###...........",
  ".#...C.......C........C..",
  ".........................",
  "....#..........#.........",
  "......C..............C...",
  "..........#...........#..",
  ".#.....C.........C...#...",
  ".......................C.",
  "..C.........C.....C......",
  "#....#....#....#....#...#",
];

const defaultSpawners = [
  { id: "north", label: "North Gate", c: 12, r: 0 },
  { id: "south", label: "South Gate", c: 12, r: 19 },
  { id: "east", label: "East Gate", c: 24, r: 9 },
  { id: "west", label: "West Gate", c: 0, r: 9 },
];

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

// Sector 2 wave tweaks: slightly harder from wave 4 onwards.
function harderWaves(): WaveDefinition[] {
  const out = cloneWaves(defaultWaves);
  for (const w of out) {
    for (const lane of w.lanes) {
      for (const g of lane.enemies) {
        g.count = Math.ceil(g.count * 1.1);
      }
    }
    w.rewardCredits = Math.round(w.rewardCredits * 1.1);
  }
  return out;
}

// Sector 3: phantom-heavy rebalance.
function phantomHeavy(): WaveDefinition[] {
  const out = cloneWaves(defaultWaves);
  const phantomTypes: EnemyType[] = ["scout", "grunt"];
  for (const w of out) {
    for (const lane of w.lanes) {
      for (const g of lane.enemies) {
        if (phantomTypes.includes(g.type) && Math.random() < 0.5) {
          g.type = "phantom";
        }
      }
    }
  }
  return out;
}

// Sector 4: advanced waves 1-15, slightly reduced counts (fortress layout is tight).
function bastionWaves(): WaveDefinition[] {
  const out = cloneWaves(advancedWaves);
  for (const w of out) {
    for (const lane of w.lanes) {
      for (const g of lane.enemies) {
        g.count = Math.max(1, Math.floor(g.count * 0.9));
      }
    }
  }
  return out;
}

// Sector 5: wider-lane version with shielded/corrupt weighting.
function mirrorWaves(): WaveDefinition[] {
  return cloneWaves(advancedWaves);
}

// Sector 6: hardest campaign. Full advanced + endless-mode flavor.
function abyssWaves(): WaveDefinition[] {
  const out = cloneWaves(advancedWaves);
  for (const w of out) {
    for (const lane of w.lanes) {
      for (const g of lane.enemies) {
        g.count = Math.ceil(g.count * 1.2);
      }
    }
    w.rewardCredits = Math.round(w.rewardCredits * 1.2);
  }
  return out;
}

export const sectorDefinitions: SectorDefinition[] = [
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
  },
  {
    id: "sector_02_crystal_scar",
    name: "Sector 2 — Crystal Scar",
    description:
      "A dense crystal field. Economy decisions matter here — harvesters thrive but side lanes are thinner.",
    accentColor: "#00e676",
    layout: sector2Layout,
    spawners: defaultSpawners,
    waves: harderWaves(),
    startingCredits: 230,
    coreIntegrity: 100,
  },
  {
    id: "sector_03_phantom_gate",
    name: "Sector 3 — Phantom Gate",
    description:
      "Narrow corridors and few crystals. Expect phantom-heavy waves — anti-phase becomes essential.",
    accentColor: "#9e9e9e",
    layout: sector3Layout,
    spawners: defaultSpawners,
    waves: phantomHeavy(),
    startingCredits: 260,
    coreIntegrity: 100,
  },
  {
    id: "sector_04_iron_bastion",
    name: "Sector 4 — Iron Bastion",
    description:
      "A fortified compound. Sappers test your spread; shielded bulwarks demand chain damage. Unlocks new threats.",
    accentColor: "#ffc107",
    layout: sector4Layout,
    spawners: defaultSpawners,
    waves: bastionWaves(),
    startingCredits: 280,
    coreIntegrity: 110,
    unlockRequires: 1,
  },
  {
    id: "sector_05_mirror_expanse",
    name: "Sector 5 — Mirror Expanse",
    description:
      "A wide, open field with many crystal nodes. Flanks matter. Corruptors will pressure fire rate.",
    accentColor: "#ba68c8",
    layout: sector5Layout,
    spawners: defaultSpawners,
    waves: mirrorWaves(),
    startingCredits: 280,
    coreIntegrity: 110,
    unlockRequires: 2,
  },
  {
    id: "sector_06_the_abyss",
    name: "Sector 6 — The Abyss",
    description:
      "The deepest signal fracture. Titans, wraiths and a Harbinger. This is the end of the campaign.",
    accentColor: "#ff1744",
    layout: sector6Layout,
    spawners: defaultSpawners,
    waves: abyssWaves(),
    startingCredits: 320,
    coreIntegrity: 125,
    unlockRequires: 3,
    hazard: "fastenemies",
  },
];
