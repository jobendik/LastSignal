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

/**
 * Shift authored strategic-point positions by the same layout-centering
 * offset that expandLayout/expandSpawners use, so authors can place strategic
 * points relative to the source layout without needing to know the final grid.
 */
function expandStrategicPoints(
  points: StrategicPointDefinition[] | undefined,
  layout: string[]
): StrategicPointDefinition[] | undefined {
  if (!points) return undefined;
  const srcH = layout.length;
  const srcW = Math.max(...layout.map((r) => r.length));
  const offC = Math.max(0, Math.floor((COLS - srcW) / 2));
  const offR = Math.max(0, Math.floor((ROWS - srcH) / 2));
  return points.map((p) => ({ ...p, c: p.c + offC, r: p.r + offR }));
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
 * The Fractured Expanse is the main "command-defense showcase". The point
 * selection here teaches the full system in roughly the same order the player
 * naturally encounters it during a run:
 *
 *   1. North Repeater (signal_node)         — easy capture, in initial reach.
 *   2. South Repeater (signal_node)         — second teaching capture.
 *   3. Western Radar Dish (radar_dish)      — relay-roll target; reveals threats.
 *   4. NE Data Cache (data_cache)           — risk/reward exploration reward.
 *   5. SW Data Cache (data_cache)           — second cache to confirm the loop.
 *   6. NE Wreckage Turret (abandoned_turret)— forward foothold near NE rift anchor.
 *   7. East Rift Anchor (rift_anchor)       — forces the player to push east.
 *   8. South Rift Anchor (rift_anchor)      — pressures the south spawner lane.
 *   9. East Jammer (jammer)                 — prevents pure turtle play.
 */
const expanseStrategicPoints: StrategicPointDefinition[] = [
  // Friendly signal repeaters — the North one is intentionally inside the
  // initial main-core signal radius so the player can capture it during the
  // very first wave to learn the mechanic.
  { id: "s6_signal_north", type: "signal_node", c: 32, r: 14, name: "North Repeater" },
  { id: "s6_signal_south", type: "signal_node", c: 32, r: 30, name: "South Repeater" },
  // Big sensor dish — needs a relay roll west to be capturable.
  { id: "s6_radar_west", type: "radar_dish", c: 12, r: 22, name: "Western Radar Dish" },
  // One-time research/credit caches in the corners (exploration reward).
  { id: "s6_cache_ne", type: "data_cache", c: 52, r: 11, name: "NE Data Cache",
    rewardCredits: 110, rewardResearch: 1 },
  { id: "s6_cache_sw", type: "data_cache", c: 12, r: 33, name: "SW Data Cache",
    rewardCredits: 110, rewardResearch: 1 },
  // Free static turret on the NE forward route — sitting between the NE
  // rift anchor and the home core, so capturing it gives the player a real
  // foothold for pushing the rift anchor down.
  { id: "s6_turret_ne", type: "abandoned_turret", c: 40, r: 14, name: "Wreckage Auto-Gun" },
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

// ──────────────────────────────────────────────────────────
// SECTOR 7 — BLACKOUT ARRAY (64×44) — hostile-structure showcase
// Companion sector to Sector 6: where Sector 6 teaches expansion via friendly
// signal nodes and radar, Sector 7 teaches *suppression* — the player must
// dismantle hostile rifts/jammers to survive instead of relying on captures.
// ──────────────────────────────────────────────────────────
function buildBlackoutLayout(): string[] {
  const W = 64, H = 44;
  const rows = Array.from({ length: H }, () => Array.from({ length: W }, () => "."));
  const set = (c: number, r: number, ch: string) => {
    if (r >= 0 && r < H && c >= 0 && c < W) rows[r]![c] = ch;
  };
  // Place core cluster near (28, 22) — slightly west of center so the eastern
  // half of the map (where most hostile structures sit) feels like enemy turf.
  const coreC = 27, coreR = 21;
  set(coreC, coreR, "X"); set(coreC + 1, coreR, "X");
  set(coreC, coreR + 1, "X"); set(coreC + 1, coreR + 1, "X");

  // Tighter rock-cluster pattern — fewer hard chokepoints than Sector 6 but
  // the rocks form distinct lanes so the player can read enemy approaches.
  const rockClusters: [number, number][] = [
    [12, 6], [44, 6], [54, 12], [40, 18], [18, 28], [50, 30],
    [12, 36], [40, 36], [22, 14], [22, 36], [56, 22], [8, 22],
  ];
  for (const [cx, cy] of rockClusters) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) set(cx + dx, cy + dy, "#");
    }
  }
  // Crystals are scarcer than Sector 6 — the sector intentionally feels
  // resource-tight so suppression payoffs (rift/jammer destruction credits)
  // matter more than passive harvesting.
  const crystals: [number, number][] = [
    [22, 22], [33, 22],   // inner ring (within reach without relays)
    [16, 14], [38, 14], [32, 30], [22, 32], [44, 26],
    [50, 38], [10, 32], [56, 6], [6, 8], [58, 38],
  ];
  for (const [cx, cy] of crystals) set(cx, cy, "C");

  // Spawners — only 4 (no NE/SW). Less omnidirectional pressure than Sector 6
  // because the sector's threat budget is spent on hostile structures.
  set(32, 0, "N"); set(32, 43, "S"); set(0, 22, "W"); set(63, 22, "E");
  return rows.map((r) => r.join(""));
}

const blackoutSpawners = [
  { id: "north", label: "North Gate", c: 32, r: 0  },
  { id: "south", label: "South Gate", c: 32, r: 43 },
  { id: "east",  label: "East Gate",  c: 63, r: 22 },
  { id: "west",  label: "West Gate",  c: 0,  r: 22 },
];

/**
 * Sector 7 strategic map points.
 *
 * The player starts close to friendly territory and the "good" signal node,
 * but most of the map is enemy turf — three rift anchors and two jammers
 * form a defensive belt across the eastern half of the map. The radar dish
 * is a high-value but contested mid-route capture; a single abandoned turret
 * gives the player a forward foothold mid-game.
 */
const blackoutStrategicPoints: StrategicPointDefinition[] = [
  // Friendly captures (the "good news" half).
  { id: "s7_signal_north", type: "signal_node",     c: 28, r: 12, name: "North Repeater" },
  { id: "s7_signal_south", type: "signal_node",     c: 28, r: 32, name: "South Repeater" },
  { id: "s7_radar_mid",    type: "radar_dish",      c: 14, r: 22, name: "Damaged Radar Dish" },
  { id: "s7_turret_mid",   type: "abandoned_turret",c: 36, r: 22, name: "Forward Auto-Gun" },
  { id: "s7_cache_se",     type: "data_cache",      c: 56, r: 32, name: "SE Data Cache",
    rewardCredits: 130, rewardResearch: 1 },
  // Hostile structures (the "bad news" half) — eastern wall. Positions are
  // chosen so they don't overlap any rock cluster (clusters span ±1 around
  // their listed centers in buildBlackoutLayout).
  { id: "s7_rift_north",   type: "rift_anchor",     c: 50, r: 8,  name: "North Rift Anchor" },
  { id: "s7_rift_east",    type: "rift_anchor",     c: 58, r: 22, name: "East Rift Anchor" },
  { id: "s7_rift_south",   type: "rift_anchor",     c: 48, r: 36, name: "South Rift Anchor" },
  { id: "s7_jammer_ne",    type: "jammer",          c: 44, r: 12, name: "NE Jammer Array" },
  { id: "s7_jammer_se",    type: "jammer",          c: 44, r: 32, name: "SE Jammer Array" },
];

function blackoutWaves(): WaveDefinition[] {
  // A tighter 18-wave campaign that pushes hostile-structure pressure early
  // rather than scaling up gradually. Reuse the default wave shape but cut
  // it short and add a few authored "structure-focus" waves.
  const base = cloneWaves(defaultWaves);
  const trimmed = base.slice(0, 12);
  for (const w of trimmed) {
    for (const lane of w.lanes) {
      for (const g of lane.enemies) g.count = Math.ceil(g.count * 1.2);
    }
    w.rewardCredits = Math.round(w.rewardCredits * 1.3);
  }
  // Authored "blackout" waves emphasising suppression — fewer enemies but
  // jammers/phantoms that punish unsupported towers.
  const extraTypes: EnemyType[] = ["jammer", "phantom", "splitter", "saboteur", "shielder", "juggernaut"];
  const laneIds = ["north", "south", "east", "west"];
  for (let i = 0; i < 6; i++) {
    const main = extraTypes[i]!;
    const wave: WaveDefinition = {
      id: `s7_blackout_${i + 13}`,
      name: `Blackout ${i + 13}`,
      description: `${main}-led suppression wave.`,
      warning: "Hostile infrastructure aiding enemy push.",
      recommendedCounters: [],
      rewardCredits: 200 + i * 25,
      rewardChoice: i % 2 === 1,
      lanes: [
        { spawnerId: laneIds[i % 4]!, enemies: [{ type: main, count: 6 + i, interval: 0.7 }] },
        {
          spawnerId: laneIds[(i + 2) % 4]!,
          enemies: [{ type: "grunt" as EnemyType, count: 8 + i, interval: 0.5 }],
          startDelay: 2,
        },
      ],
      isBossWave: i === 5,
    };
    if (i === 5) {
      wave.lanes.push({
        spawnerId: "east",
        enemies: [{ type: "harbinger", count: 1, interval: 1 }],
        startDelay: 6,
      });
    }
    trimmed.push(wave);
  }
  return trimmed;
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
    // One captured wreckage turret near the western lane teaches the
    // strategic-point mechanic in a smaller, focused sector before the
    // sprawling Sector 6 introduces the full system.
    strategicPoints: [
      {
        id: "s3_wreck_turret",
        type: "abandoned_turret",
        // Source-layout coords; expandStrategicPoints shifts to (8, 10) at
        // runtime so it sits on the western approach to the home core.
        c: 5,
        r: 9,
        name: "Wreckage Auto-Gun",
        description:
          "Salvageable turret half-buried in the hull plating. Capture to wake it.",
      },
    ],
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
    strategicPoints: expanseStrategicPoints,
  },
  {
    id: "sector_07_blackout_array",
    name: "Sector 7 — Blackout Array",
    description:
      "A jammed, hostile frontier. Most of the map belongs to the rift. Suppress hostile infrastructure to survive — turtling fails here.",
    accentColor: "#ff5252",
    layout: buildBlackoutLayout(),
    spawners: blackoutSpawners,
    waves: blackoutWaves(),
    startingCredits: 460,
    coreIntegrity: 130,
    cols: 64,
    rows: 44,
    darkness: true,
    lore: "Three rifts and two jammer arrays form a wall across the array. Tearing them down is the mission, not a bonus.",
    hazards: { meteors: true, gravity: false, signalInterference: true, powerSurges: false },
    strategicPoints: blackoutStrategicPoints,
  },
];

export const sectorDefinitions: SectorDefinition[] = baseSectorDefinitions.map((s) => {
  // Large sectors (those that specify cols/rows) use their layout as-is.
  if (s.cols && s.rows) return { ...s };
  // Legacy sectors get centered/expanded to COLS×ROWS, including their
  // authored strategic points so source-layout coords stay accurate.
  return {
    ...s,
    layout: expandLayout(s.layout),
    spawners: expandSpawners(s.spawners, s.layout),
    strategicPoints: expandStrategicPoints(s.strategicPoints, s.layout),
  };
});
