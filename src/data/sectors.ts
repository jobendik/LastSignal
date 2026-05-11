import type {
  SectorDefinition,
  WaveDefinition,
  EnemyType,
  StrategicPointDefinition,
} from "../core/Types";
import { defaultWaves, sector2Waves, sector3Waves, sector4Waves, summarize } from "./waves";
import { COLS, ROWS } from "../core/Config";
import { mulberry32 } from "../core/Random";
import { trainingSectorDefinition } from "./training";

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
  // Add 10 more waves of escalating pressure using all spawners. Squad-aware
  // counter hints rotate so the player is reminded of role tools at intervals
  // without every wave feeling like a tutorial.
  const extraTypes: EnemyType[] = ["grunt", "brute", "phantom", "splitter", "shielder", "carrier", "jammer", "tunneler", "saboteur", "juggernaut"];
  const squadHints = [
    "Recon helps reveal the route.",
    "Engineer accelerates capture under pressure.",
    "Strike can suppress rift anchors.",
    "Shield exposed relays during boss waves.",
  ];
  for (let i = 0; i < 10; i++) {
    const mainType = extraTypes[i]!;
    const supportType = extraTypes[(i + 3) % extraTypes.length]!;
    const laneIds = ["north", "south", "east", "west", "northeast", "southwest"];
    const wave: WaveDefinition = {
      id: `s6_extra_${i + 16}`,
      name: `Expanse ${i + 16}`,
      description: `Multi-lane ${mainType} pressure.`,
      warning: i % 2 === 0
        ? `Enemies attack from multiple directions. ${squadHints[i % squadHints.length]}`
        : "Enemies attack from multiple directions.",
      recommendedCounters: i % 3 === 0 ? [squadHints[Math.floor(i / 3) % squadHints.length]!] : [],
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
 * Layout-vs-coverage tuning (main core at (28.5, 22.5), main signal radius 11
 * cells, relay signal radius 8 cells, relay deploy radius 11 cells):
 *
 *   - Both signal nodes sit just inside main coverage (~10c) so the player
 *     can capture them turn 1 and learn the mechanic. They each extend the
 *     network a bit — useful but not transformational.
 *   - The radar dish at (14, 22) is just outside main coverage and requires
 *     one relay roll west. Captured radar is the "vision" win condition.
 *   - The forward auto-gun at (45, 22) is well outside main coverage. The
 *     player must roll a relay east to capture it; once captured, its
 *     170 px (~5 c) range covers the east lane into the core. Real foothold.
 *   - The data cache deep in SE corner is only reachable after the player
 *     has expanded all the way down the east lane — it's the trip-fee for
 *     the Phase 3 reward. Bumped reward to 150 credits for the trek.
 *   - Hostile structures form the eastern wall. The player must dismantle
 *     them to relieve pulse pressure during Phases 3–5.
 */
const blackoutStrategicPoints: StrategicPointDefinition[] = [
  // Friendly captures (the "good news" half).
  { id: "s7_signal_north", type: "signal_node",     c: 28, r: 12, name: "North Repeater" },
  { id: "s7_signal_south", type: "signal_node",     c: 28, r: 32, name: "South Repeater" },
  { id: "s7_radar_mid",    type: "radar_dish",      c: 14, r: 22, name: "Damaged Radar Dish" },
  { id: "s7_turret_mid",   type: "abandoned_turret",c: 45, r: 22, name: "Forward Auto-Gun" },
  { id: "s7_cache_se",     type: "data_cache",      c: 56, r: 32, name: "SE Data Cache",
    rewardCredits: 150, rewardResearch: 1 },
  // Hostile structures (the "bad news" half) — eastern wall. Positions are
  // chosen so they don't overlap any rock cluster (clusters span ±1 around
  // their listed centers in buildBlackoutLayout).
  { id: "s7_rift_north",   type: "rift_anchor",     c: 50, r: 8,  name: "North Rift Anchor" },
  { id: "s7_rift_east",    type: "rift_anchor",     c: 58, r: 22, name: "East Rift Anchor" },
  { id: "s7_rift_south",   type: "rift_anchor",     c: 48, r: 36, name: "South Rift Anchor" },
  { id: "s7_jammer_ne",    type: "jammer",          c: 44, r: 12, name: "NE Jammer Array" },
  { id: "s7_jammer_se",    type: "jammer",          c: 44, r: 32, name: "SE Jammer Array" },
];

/**
 * Sector 7 — Blackout Array — bespoke 18-wave campaign.
 *
 * Five-phase structure:
 *
 *   PHASE 1 (1–4)   : "Entry into the blackout zone"
 *                     Light contact while the player learns the sector.
 *   PHASE 2 (5–8)   : "Jammer pressure / contested expansion"
 *                     Mixed pressure; jammers and phantoms force expansion
 *                     toward the radar / abandoned turret.
 *   PHASE 3 (9–13)  : "Rift suppression war"
 *                     Heavier waves; rift anchors actively pulse extra
 *                     scouts. Destroying anchors visibly reduces pressure.
 *   PHASE 4 (14–17) : "Blackout escalation"
 *                     Multi-lane chaos with a Harbinger mid-boss.
 *   PHASE 5 (18)    : "The Array Awakens"
 *                     Climactic 4-lane Leviathan finale.
 *
 * Every wave is hand-authored with name / warning / counter hints so the
 * Wave Preview Panel and HUD status text read as a real mission, not as
 * "wave 12 of default-seq". Thresholds (counts, intervals, startDelay) are
 * tuned around 460 starting credits + 130 core integrity.
 */
function blackoutWaves(): WaveDefinition[] {
  return [
    // ── PHASE 1 — Entry into the blackout zone ────────────────────────────
    summarize({
      id: "s7_w01_contact_static",
      name: "Wave 1: Contact in the Static",
      description: "Recon scouts probe the western perimeter.",
      warning: "Light scout pressure. Build a Pulse on the west lane and read the map.",
      recommendedCounters: ["Pulse", "Blaster"],
      rewardCredits: 45,
      rewardChoice: false,
      lanes: [
        { spawnerId: "west", enemies: [{ type: "scout", count: 7, interval: 0.85 }] },
      ],
    }),
    summarize({
      id: "s7_w02_probing_perimeter",
      name: "Wave 2: Probing the Perimeter",
      description: "Standard grunts test the southern approach.",
      warning: "A second lane opens. Consider expanding toward the North Repeater.",
      recommendedCounters: ["Pulse", "Blaster"],
      rewardCredits: 60,
      rewardChoice: true,
      lanes: [
        { spawnerId: "south", enemies: [{ type: "grunt", count: 9, interval: 0.95 }] },
      ],
    }),
    summarize({
      id: "s7_w03_blackout_echo",
      name: "Wave 3: Blackout Echo",
      description: "Light pressure from two spawners simultaneously.",
      warning: "Multi-lane scouts. The radar dish to the west would help — Recon Squad reveals the route.",
      recommendedCounters: ["Pulse", "Blaster", "Recon Squad to scout west"],
      rewardCredits: 70,
      rewardChoice: false,
      lanes: [
        { spawnerId: "west", enemies: [{ type: "scout", count: 6, interval: 0.55 }] },
        { spawnerId: "east", enemies: [{ type: "scout", count: 6, interval: 0.55 }], startDelay: 1.2 },
      ],
    }),
    summarize({
      id: "s7_w04_first_surge",
      name: "Wave 4: First Surge",
      description: "Sprinters punctuate a grunt column.",
      warning: "Sprinters are very fast. Slow effects matter — Stasis pays off here.",
      recommendedCounters: ["Stasis", "Blaster"],
      rewardCredits: 85,
      rewardChoice: true,
      lanes: [
        { spawnerId: "south", enemies: [{ type: "grunt", count: 8, interval: 0.7 }] },
        { spawnerId: "north", enemies: [{ type: "sprinter", count: 5, interval: 0.55 }], startDelay: 2.0 },
      ],
    }),

    // ── PHASE 2 — Jammer pressure and contested expansion ────────────────
    summarize({
      id: "s7_w05_static_convergence",
      name: "Wave 5: Static Convergence",
      description: "Phantoms blend into a multi-lane probe.",
      warning: "Phantoms are immune while phased. Capture the radar to spot them.",
      recommendedCounters: ["Tesla Phase Disruptor", "Scanner Drone", "Wide coverage"],
      rewardCredits: 105,
      rewardChoice: false,
      lanes: [
        { spawnerId: "west", enemies: [{ type: "grunt", count: 8, interval: 0.7 }] },
        { spawnerId: "east", enemies: [{ type: "scout", count: 6, interval: 0.6 }], startDelay: 1.5 },
        { spawnerId: "east", enemies: [{ type: "phantom", count: 2, interval: 1.6 }], startDelay: 5.0 },
      ],
    }),
    summarize({
      id: "s7_w06_jammer_echo",
      name: "Wave 6: Jammer Echo",
      description: "Hostile Jammer units suppress nearby towers.",
      warning: "Jammer enemies dim your fire rate. Strike Squad can suppress them on the move.",
      recommendedCounters: ["Tesla", "Mortar splash", "Strike Squad on jammer enemies"],
      rewardCredits: 120,
      rewardChoice: true,
      lanes: [
        { spawnerId: "south", enemies: [{ type: "grunt", count: 9, interval: 0.7 }] },
        { spawnerId: "west", enemies: [{ type: "jammer", count: 3, interval: 1.4 }], startDelay: 2.5 },
      ],
    }),
    summarize({
      id: "s7_w07_forward_pressure",
      name: "Wave 7: Forward Pressure",
      description: "Brutes anchor a mixed assault from three sides.",
      warning: "Brutes need armor-piercing. Capture the abandoned auto-gun for a forward foothold.",
      recommendedCounters: ["Mortar", "Railgun", "Stasis"],
      rewardCredits: 140,
      rewardChoice: false,
      lanes: [
        { spawnerId: "south", enemies: [{ type: "brute", count: 4, interval: 1.4 }] },
        { spawnerId: "west", enemies: [{ type: "grunt", count: 8, interval: 0.65 }], startDelay: 1.0 },
        { spawnerId: "east", enemies: [{ type: "scout", count: 6, interval: 0.5 }], startDelay: 3.0 },
      ],
    }),
    summarize({
      id: "s7_w08_suppression_test",
      name: "Wave 8: Suppression Test",
      description: "Tower systems offline for 5s — pre-position your defenses.",
      warning: "SILENCE WAVE: tower fire suppressed for 5s. Layout matters more than DPS.",
      recommendedCounters: ["Layout discipline", "Drones", "Kill zone"],
      rewardCredits: 160,
      rewardChoice: true,
      waveEvent: "silence",
      lanes: [
        { spawnerId: "west", enemies: [{ type: "grunt", count: 8, interval: 0.6 }] },
        { spawnerId: "south", enemies: [{ type: "jammer", count: 4, interval: 1.0 }], startDelay: 2.0 },
        { spawnerId: "east", enemies: [{ type: "phantom", count: 2, interval: 1.5 }], startDelay: 5.0 },
      ],
    }),

    // ── PHASE 3 — Rift suppression war ────────────────────────────────────
    summarize({
      id: "s7_w09_rift_bloom",
      name: "Wave 9: Rift Bloom",
      description: "Rift anchors pulse aggressively. Splitters multiply on death.",
      warning: "Rift anchors empower nearby enemies — Strike Squad can break one alongside tower fire.",
      recommendedCounters: ["Mortar splash", "Stasis", "Strike Squad on rift anchors"],
      rewardCredits: 175,
      rewardChoice: false,
      lanes: [
        { spawnerId: "west", enemies: [{ type: "splitter", count: 5, interval: 1.1 }] },
        { spawnerId: "north", enemies: [{ type: "grunt", count: 6, interval: 0.6 }], startDelay: 1.5 },
        { spawnerId: "east", enemies: [{ type: "sprinter", count: 5, interval: 0.55 }], startDelay: 3.0 },
      ],
    }),
    summarize({
      id: "s7_w10_armored_tide",
      name: "Wave 10: Armored Tide",
      description: "Brutes and Juggernauts wall up multiple lanes.",
      warning: "Heavy armor across two lanes. Railguns and pierce shots earn their cost.",
      recommendedCounters: ["Railgun", "Reflector", "Armor-pierce specs"],
      rewardCredits: 200,
      rewardChoice: true,
      lanes: [
        { spawnerId: "east", enemies: [{ type: "brute", count: 5, interval: 1.1 }] },
        { spawnerId: "west", enemies: [{ type: "juggernaut", count: 4, interval: 1.4 }], startDelay: 1.5 },
        { spawnerId: "south", enemies: [{ type: "grunt", count: 8, interval: 0.6 }], startDelay: 2.5 },
      ],
    }),
    summarize({
      id: "s7_w11_saboteur_cascade",
      name: "Wave 11: Saboteur Cascade",
      description: "Tower-disabler infiltrators arrive with phantom support.",
      warning: "Saboteurs damage and disable towers. Engineer to restore, Shield to protect, Snare/EMP to slow them.",
      recommendedCounters: ["Engineer Squad to repair", "Shield Squad on key towers", "Snare", "Tesla EMP arc"],
      rewardCredits: 220,
      rewardChoice: false,
      lanes: [
        { spawnerId: "east", enemies: [{ type: "saboteur", count: 4, interval: 0.9 }] },
        { spawnerId: "west", enemies: [{ type: "phantom", count: 5, interval: 0.8 }], startDelay: 1.5 },
        { spawnerId: "north", enemies: [{ type: "scout", count: 9, interval: 0.45 }], startDelay: 3.0 },
      ],
    }),
    summarize({
      id: "s7_w12_rift_surge",
      name: "Wave 12: Rift Surge",
      description: "All four lanes activate. Weavers stitch the line back together.",
      warning: "Weavers heal nearby enemies — focus them. Rift anchors compound the pressure.",
      recommendedCounters: ["Tesla chain", "Mortar splash", "Stasis on choke"],
      rewardCredits: 240,
      rewardChoice: true,
      lanes: [
        { spawnerId: "east", enemies: [{ type: "sprinter", count: 8, interval: 0.4 }] },
        { spawnerId: "south", enemies: [{ type: "weaver", count: 4, interval: 1.4 }], startDelay: 1.8 },
        { spawnerId: "west", enemies: [{ type: "brute", count: 4, interval: 1.0 }], startDelay: 2.8 },
        { spawnerId: "north", enemies: [{ type: "splitter", count: 5, interval: 1.0 }], startDelay: 4.0 },
      ],
    }),
    summarize({
      id: "s7_w13_mirror_convergence",
      name: "Wave 13: Mirror Convergence",
      description: "Mirror units reflect projectiles. Jammers thicken the suppression.",
      warning: "Mirrors absorb three projectile hits and disable the firing tower each time.",
      recommendedCounters: ["Tesla chain", "Mortar splash", "Sustained pressure"],
      rewardCredits: 260,
      rewardChoice: false,
      lanes: [
        { spawnerId: "west", enemies: [{ type: "mirror", count: 4, interval: 1.5 }] },
        { spawnerId: "east", enemies: [{ type: "jammer", count: 5, interval: 1.1 }], startDelay: 2.0 },
        { spawnerId: "south", enemies: [{ type: "grunt", count: 10, interval: 0.55 }], startDelay: 3.0 },
        { spawnerId: "north", enemies: [{ type: "sprinter", count: 5, interval: 0.5 }], startDelay: 4.5 },
      ],
    }),

    // ── PHASE 4 — Blackout escalation ─────────────────────────────────────
    summarize({
      id: "s7_w14_heavy_eclipse",
      name: "Wave 14: Heavy Eclipse",
      description: "Juggernauts and Brutes form a slow armored siege.",
      warning: "Fielding two armor-piercing setups on the front line is non-negotiable now.",
      recommendedCounters: ["Railgun", "Mortar", "Stasis stack"],
      rewardCredits: 285,
      rewardChoice: true,
      lanes: [
        { spawnerId: "south", enemies: [{ type: "juggernaut", count: 5, interval: 1.2 }] },
        { spawnerId: "west", enemies: [{ type: "brute", count: 6, interval: 1.0 }], startDelay: 2.0 },
        { spawnerId: "east", enemies: [{ type: "weaver", count: 4, interval: 1.2 }], startDelay: 3.5 },
        { spawnerId: "north", enemies: [{ type: "grunt", count: 7, interval: 0.55 }], startDelay: 4.5 },
      ],
    }),
    summarize({
      id: "s7_w15_blackout_cascade",
      name: "Wave 15: Blackout Cascade",
      description: "Everything spawns at once. Coordination collapses.",
      warning: "BLITZ WAVE: no stagger. Volume hits all four spawners simultaneously.",
      recommendedCounters: ["Tesla chain", "Mortar splash", "Pre-set kill zone"],
      rewardCredits: 310,
      rewardChoice: false,
      waveEvent: "blitz",
      lanes: [
        { spawnerId: "east", enemies: [{ type: "sprinter", count: 12, interval: 0.18 }] },
        { spawnerId: "west", enemies: [{ type: "phantom", count: 6, interval: 0.4 }] },
        { spawnerId: "south", enemies: [{ type: "grunt", count: 10, interval: 0.25 }] },
        { spawnerId: "north", enemies: [{ type: "saboteur", count: 5, interval: 0.45 }] },
      ],
    }),
    summarize({
      id: "s7_w16_harbinger_approach",
      name: "Wave 16: Harbinger Approach",
      description: "An artillery boss anchors a coordinated assault.",
      warning: "HARBINGER INCOMING. Spread your towers and Shield exposed relays — artillery clusters are lethal.",
      recommendedCounters: ["Spread placement", "Shield Squad on relays", "Snare"],
      rewardCredits: 340,
      rewardChoice: true,
      isBossWave: true,
      lanes: [
        { spawnerId: "east", enemies: [{ type: "harbinger", count: 1, interval: 1 }] },
        { spawnerId: "south", enemies: [{ type: "brute", count: 6, interval: 1.0 }], startDelay: 2.0 },
        { spawnerId: "north", enemies: [{ type: "phantom", count: 5, interval: 0.85 }], startDelay: 3.5 },
        { spawnerId: "west", enemies: [{ type: "jammer", count: 4, interval: 1.1 }], startDelay: 5.0 },
      ],
    }),
    summarize({
      id: "s7_w17_final_bloom",
      name: "Wave 17: Final Bloom",
      description: "Carriers and weavers feed an HP-dense assault.",
      warning: "Carriers split into scouts on death — kill them far from the core.",
      recommendedCounters: ["Stasis", "Mortar", "Tesla chain"],
      rewardCredits: 360,
      rewardChoice: false,
      lanes: [
        { spawnerId: "east", enemies: [{ type: "splitter", count: 6, interval: 1.1 }] },
        { spawnerId: "west", enemies: [{ type: "carrier", count: 4, interval: 1.8 }], startDelay: 1.5 },
        { spawnerId: "south", enemies: [{ type: "weaver", count: 5, interval: 1.2 }], startDelay: 3.0 },
        { spawnerId: "north", enemies: [{ type: "saboteur", count: 5, interval: 0.9 }], startDelay: 4.5 },
      ],
    }),

    // ── PHASE 5 — Final assault ────────────────────────────────────────────
    summarize({
      id: "s7_w18_array_awakens",
      name: "Wave 18: The Array Awakens",
      description: "The Blackout Array surges in unison. The Leviathan emerges.",
      warning: "FINAL BLACKOUT ASSAULT. Shield the core, Strike the rifts, EVAC squads if you can't save them.",
      recommendedCounters: ["Boss damage", "Shield Squad on home core", "Strike Squad on rifts"],
      rewardCredits: 450,
      rewardChoice: false,
      isBossWave: true,
      lanes: [
        { spawnerId: "east", enemies: [{ type: "leviathan", count: 1, interval: 1 }] },
        { spawnerId: "east", enemies: [{ type: "phantom", count: 6, interval: 0.85 }], startDelay: 4.0 },
        { spawnerId: "west", enemies: [{ type: "mirror", count: 4, interval: 1.4 }], startDelay: 1.0 },
        { spawnerId: "west", enemies: [{ type: "brute", count: 6, interval: 1.0 }], startDelay: 5.0 },
        { spawnerId: "north", enemies: [{ type: "sprinter", count: 8, interval: 0.4 }], startDelay: 2.0 },
        { spawnerId: "north", enemies: [{ type: "saboteur", count: 4, interval: 0.9 }], startDelay: 6.5 },
        { spawnerId: "south", enemies: [{ type: "grunt", count: 10, interval: 0.5 }], startDelay: 1.5 },
        { spawnerId: "south", enemies: [{ type: "splitter", count: 4, interval: 1.0 }], startDelay: 7.0 },
      ],
    }),
  ];
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
    startingCredits: 185,
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
    startingCredits: 195,
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
    startingCredits: 215,
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
    startingCredits: 240,
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
    startingCredits: 200,
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
      "A jammed, hostile frontier. Expand carefully, restore visibility with the radar, then dismantle enemy infrastructure before the final blackout assault.",
    accentColor: "#ff5252",
    layout: buildBlackoutLayout(),
    spawners: blackoutSpawners,
    waves: blackoutWaves(),
    // 480 starting credits leaves room to plant 2-3 starter towers and have
    // spare for a relay roll by wave 4. Core 130 lets the player eat one or
    // two early breaches without the run instantly collapsing.
    startingCredits: 480,
    coreIntegrity: 130,
    cols: 64,
    rows: 44,
    darkness: true,
    lore: "Three rifts and two jammer arrays form a wall across the array. Tearing them down is the mission, not a bonus.",
    hazards: { meteors: true, gravity: false, signalInterference: true, powerSurges: false },
    strategicPoints: blackoutStrategicPoints,
  },
  // Operator Training is appended at the end so it does NOT disturb the
  // sector index used for modifier rolls or campaign progression. Sector
  // Select renders it first via the trainingSectorDefinition.isTraining flag.
  trainingSectorDefinition,
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
