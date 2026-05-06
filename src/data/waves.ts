import type { WaveDefinition, EnemyType } from "../core/Types";

/** Build a rough enemy summary for UI purposes. */
function summarize(w: Omit<WaveDefinition, "enemySummary">): WaveDefinition {
  const map = new Map<string, number>();
  for (const lane of w.lanes) {
    for (const g of lane.enemies) {
      map.set(g.type, (map.get(g.type) ?? 0) + g.count);
    }
  }
  return {
    ...w,
    enemySummary: Array.from(map.entries()).map(([type, count]) => ({
      type: type as WaveDefinition["lanes"][number]["enemies"][number]["type"],
      count,
    })),
  };
}

/**
 * 15-wave campaign arc, used by Sector 1 and as fallback.
 * Sectors typically override or extend this via their own waves.
 *
 * Sector 1 is now an explicit teaching arc:
 *  - Waves 1-2 introduce Pulse-friendly scouts/grunts.
 *  - Wave 3 introduces brutes (armor lesson).
 *  - Wave 4 introduces phantoms gently (one phantom).
 *  - Wave 5 introduces carriers (priority lesson).
 *  - Each new threat appears alone first, then in mixed waves later.
 */
export const defaultWaves: WaveDefinition[] = [
  summarize({
    id: "w01_first_contact",
    name: "First Contact",
    description: "Fast scouts probe the relay perimeter.",
    warning: "Lightly armored scouts. Start with Pulse + Blaster on the spawner lane.",
    recommendedCounters: ["Pulse", "Blaster"],
    rewardCredits: 35,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "north",
        enemies: [{ type: "scout", count: 6, interval: 0.85 }],
      },
    ],
  }),
  summarize({
    id: "w02_signal_pressure",
    name: "Signal Pressure",
    description: "Standard grunts test your baseline defense.",
    warning: "Steady line of grunts. Range and DPS balance matter more than speed.",
    recommendedCounters: ["Pulse", "Blaster"],
    rewardCredits: 50,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "south",
        enemies: [{ type: "grunt", count: 9, interval: 0.95 }],
      },
    ],
  }),
  summarize({
    id: "w03_iron_wall",
    name: "Iron Wall",
    description: "Three armored Brutes lead a grunt column.",
    warning: "Brutes are slow but very tough. Stasis or Mortar makes the difference.",
    recommendedCounters: ["Stasis", "Mortar"],
    rewardCredits: 60,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "south",
        enemies: [
          { type: "brute", count: 3, interval: 1.7 },
          { type: "grunt", count: 8, interval: 0.7 },
        ],
      },
    ],
  }),
  summarize({
    id: "w04_phase_echo",
    name: "Phase Echo",
    description: "A single phantom probe shadows incoming scouts.",
    warning: "Phantoms are immune while phased — wide coverage handles them.",
    recommendedCounters: ["Tesla", "Wide coverage"],
    rewardCredits: 65,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "north",
        enemies: [{ type: "scout", count: 7, interval: 0.45 }],
      },
      {
        spawnerId: "east",
        enemies: [{ type: "phantom", count: 2, interval: 1.4 }],
        startDelay: 1.4,
      },
    ],
  }),
  summarize({
    id: "w05_carrier_breach",
    name: "Carrier Breach",
    description: "A single carrier threatens to split into scouts.",
    warning: "Kill carriers far from the core — their scout burst can breach.",
    recommendedCounters: ["Stasis", "Mortar"],
    rewardCredits: 75,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "west",
        enemies: [{ type: "carrier", count: 1, interval: 1.0 }],
      },
      {
        spawnerId: "east",
        enemies: [{ type: "scout", count: 8, interval: 0.4 }],
        startDelay: 1.6,
      },
    ],
  }),
  summarize({
    id: "w06_weaver_escort",
    name: "Weaver Escort",
    description: "Healers protect a brute column.",
    warning: "Weavers repair nearby enemies. Prioritize them.",
    recommendedCounters: ["Tesla chain", "Mortar splash"],
    rewardCredits: 85,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "north",
        enemies: [
          { type: "brute", count: 4, interval: 1.2 },
          { type: "weaver", count: 2, interval: 2.5 },
        ],
      },
    ],
  }),
  summarize({
    id: "w07_ghost_column",
    name: "Ghost Column",
    description: "Phantoms hide inside a wider grunt column.",
    warning: "Phantoms blend with grunts. Detection or wide coverage required.",
    recommendedCounters: ["Tesla + Phase Disruptor", "Scanner Drone"],
    rewardCredits: 90,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "east",
        enemies: [{ type: "phantom", count: 6, interval: 0.9 }],
      },
      {
        spawnerId: "south",
        enemies: [{ type: "grunt", count: 12, interval: 0.5 }],
        startDelay: 0.8,
      },
    ],
  }),
  summarize({
    id: "w07b_silence_protocol",
    name: "Silence Protocol",
    description: "Tower systems offline for 5s. Pre-position your defense.",
    warning: "SILENCE WAVE: towers suppressed for 5s at start. Layout is your only defense.",
    recommendedCounters: ["Core positioning", "Kill zone", "Drones"],
    rewardCredits: 95,
    rewardChoice: true,
    waveEvent: "silence",
    lanes: [
      {
        spawnerId: "west",
        enemies: [{ type: "brute", count: 5, interval: 0.95 }],
      },
      {
        spawnerId: "east",
        enemies: [{ type: "grunt", count: 12, interval: 0.45 }],
        startDelay: 1.0,
      },
    ],
  }),
  summarize({
    id: "w08_nest_splitters",
    name: "Nest Splitters",
    description: "Multiple carriers flood the grid if not controlled.",
    warning: "A single missed carrier can snowball into a scout breach.",
    recommendedCounters: ["Stasis", "Mortar", "Chain"],
    rewardCredits: 100,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "west",
        enemies: [{ type: "carrier", count: 3, interval: 2.0 }],
      },
      {
        spawnerId: "north",
        enemies: [{ type: "weaver", count: 2, interval: 1.2 }],
        startDelay: 1,
      },
    ],
  }),
  summarize({
    id: "w09_swarm_burst",
    name: "Blitz Swarm",
    description: "A pure scout swarm arrives all at once.",
    warning: "BLITZ WAVE: no stagger. Volume over armor — chain and splash dominate.",
    recommendedCounters: ["Blaster", "Tesla", "Mortar"],
    rewardCredits: 110,
    rewardChoice: false,
    waveEvent: "blitz",
    lanes: [
      {
        spawnerId: "north",
        enemies: [{ type: "scout", count: 18, interval: 0.16 }],
      },
      {
        spawnerId: "south",
        enemies: [{ type: "scout", count: 18, interval: 0.16 }],
        startDelay: 0.4,
      },
    ],
  }),
  summarize({
    id: "w10_armored_ghosts",
    name: "Armored Ghosts",
    description: "Brutes and Phantoms combine pressure with immunity windows.",
    warning: "Hard checkpoint. Specialization choices matter here.",
    recommendedCounters: ["Mortar", "Tesla", "Stasis"],
    rewardCredits: 120,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "east",
        enemies: [{ type: "brute", count: 9, interval: 0.85 }],
      },
      {
        spawnerId: "west",
        enemies: [{ type: "phantom", count: 5, interval: 0.8 }],
        startDelay: 1,
      },
    ],
  }),
  summarize({
    id: "w11_carrier_tide",
    name: "Carrier Tide",
    description: "Slow but dangerous carrier wave.",
    warning: "Control the tempo; don't let scouts spawn near the core.",
    recommendedCounters: ["Stasis", "Mortar"],
    rewardCredits: 130,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "south",
        enemies: [{ type: "carrier", count: 4, interval: 1.6 }],
      },
    ],
  }),
  summarize({
    id: "w12_repair_swarm",
    name: "Repair Swarm",
    description: "Weavers protect a large body of grunts.",
    warning: "Weavers will keep grunts alive forever. Focus them down.",
    recommendedCounters: ["Tesla", "Mortar splash"],
    rewardCredits: 140,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "north",
        enemies: [{ type: "grunt", count: 26, interval: 0.28 }],
      },
      {
        spawnerId: "east",
        enemies: [{ type: "weaver", count: 5, interval: 1.2 }],
        startDelay: 1,
      },
    ],
  }),
  summarize({
    id: "w13_crushing_mass",
    name: "Crushing Mass",
    description: "Heavy armor and carriers.",
    warning: "Strong AoE control recommended.",
    recommendedCounters: ["Mortar", "Stasis", "Tesla"],
    rewardCredits: 150,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "west",
        enemies: [{ type: "brute", count: 13, interval: 0.7 }],
      },
      {
        spawnerId: "east",
        enemies: [{ type: "carrier", count: 4, interval: 1.6 }],
        startDelay: 1.5,
      },
    ],
  }),
  summarize({
    id: "w14_fractured_reality",
    name: "Fractured Reality",
    description: "Fast scouts and many phantoms attack together.",
    warning: "Chaos incoming. Reduced-flashing mode can help readability.",
    recommendedCounters: ["Tesla", "Blaster", "Drones"],
    rewardCredits: 160,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "north",
        enemies: [{ type: "phantom", count: 16, interval: 0.45 }],
      },
      {
        spawnerId: "south",
        enemies: [{ type: "scout", count: 18, interval: 0.2 }],
        startDelay: 0.3,
      },
    ],
  }),
  summarize({
    id: "w15_gauntlet",
    name: "The Gauntlet",
    description: "One of every common enemy type in sequence.",
    warning: "BOSS RUSH: every enemy type appears in sequence. Adapt and never stop firing.",
    recommendedCounters: ["Everything"],
    rewardCredits: 220,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "scout", count: 6, interval: 0.45 }], startDelay: 0 },
      { spawnerId: "south", enemies: [{ type: "grunt", count: 6, interval: 0.65 }], startDelay: 5 },
      { spawnerId: "east", enemies: [{ type: "sprinter", count: 5, interval: 0.4 }], startDelay: 11 },
      { spawnerId: "west", enemies: [{ type: "brute", count: 4, interval: 1.1 }], startDelay: 16 },
      { spawnerId: "north", enemies: [{ type: "phantom", count: 4, interval: 0.85 }], startDelay: 22 },
      { spawnerId: "south", enemies: [{ type: "weaver", count: 3, interval: 1.4 }], startDelay: 27 },
      { spawnerId: "east", enemies: [{ type: "shielder", count: 4, interval: 1.0 }], startDelay: 33 },
      { spawnerId: "west", enemies: [{ type: "jammer", count: 3, interval: 1.2 }], startDelay: 39 },
      { spawnerId: "north", enemies: [{ type: "splitter", count: 3, interval: 1.5 }], startDelay: 45 },
      { spawnerId: "south", enemies: [{ type: "carrier", count: 3, interval: 1.8 }], startDelay: 52 },
      { spawnerId: "east", enemies: [{ type: "juggernaut", count: 2, interval: 3.0 }], startDelay: 60 },
    ],
  }),
];

/* ============================================================
 * SECTOR 2 — CRYSTAL SCAR (economy / greed sector)
 * ============================================================
 * Theme: bigger crystal field, harvester economy is tempting,
 * pressure scales steadily so over-greed is punished.
 * Introduces Sprinter (slow lesson) and Splitter (splash lesson)
 * and rewards harvester-friendly economy.
 */
export const sector2Waves: WaveDefinition[] = [
  summarize({
    id: "s2_w01_probe",
    name: "Crystal Probe",
    description: "Light grunt probe. Plant your first harvesters.",
    warning: "Build a harvester or two before committing to a long line.",
    recommendedCounters: ["Pulse", "Harvester investment"],
    rewardCredits: 45,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "grunt", count: 7, interval: 0.85 }] },
    ],
  }),
  summarize({
    id: "s2_w02_first_sprint",
    name: "First Sprint",
    description: "Sprinters arrive — the slow-or-die lesson.",
    warning: "Sprinters outrun static defenses. Slow them or lose them.",
    recommendedCounters: ["Stasis", "Snare", "Barrier"],
    rewardCredits: 60,
    rewardChoice: true,
    lanes: [
      { spawnerId: "south", enemies: [{ type: "sprinter", count: 6, interval: 0.6 }] },
      { spawnerId: "north", enemies: [{ type: "grunt", count: 6, interval: 0.85 }], startDelay: 1.5 },
    ],
  }),
  summarize({
    id: "s2_w03_split_kindling",
    name: "Split Kindling",
    description: "Splitters break apart on death — splash damage shines.",
    warning: "Splitters split into 3 grunts on death. Use AoE.",
    recommendedCounters: ["Mortar", "Tesla", "Flamer"],
    rewardCredits: 75,
    rewardChoice: false,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "splitter", count: 4, interval: 1.5 }] },
      { spawnerId: "west", enemies: [{ type: "grunt", count: 8, interval: 0.7 }], startDelay: 1.5 },
    ],
  }),
  summarize({
    id: "s2_w04_brute_rumble",
    name: "Brute Rumble",
    description: "Brutes test sustained DPS and stasis kill zones.",
    warning: "Mortar inside Stasis is the textbook combo.",
    recommendedCounters: ["Stasis", "Mortar"],
    rewardCredits: 85,
    rewardChoice: true,
    lanes: [
      { spawnerId: "south", enemies: [{ type: "brute", count: 4, interval: 1.2 }] },
      { spawnerId: "north", enemies: [{ type: "grunt", count: 10, interval: 0.6 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s2_w05_credit_run",
    name: "Credit Run",
    description: "Light wave — safe to invest credits in harvesters.",
    warning: "Greed window. Don't over-extend.",
    recommendedCounters: ["Pulse", "Blaster"],
    rewardCredits: 95,
    rewardChoice: false,
    lanes: [
      { spawnerId: "west", enemies: [{ type: "grunt", count: 8, interval: 0.85 }] },
      { spawnerId: "east", enemies: [{ type: "scout", count: 6, interval: 0.6 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s2_w06_sprint_storm",
    name: "Sprint Storm",
    description: "Heavy sprinter wave — slow effects mandatory.",
    warning: "If you don't have control, they'll run past everything.",
    recommendedCounters: ["Stasis", "Snare", "Barrier"],
    rewardCredits: 110,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "sprinter", count: 12, interval: 0.4 }] },
      { spawnerId: "south", enemies: [{ type: "scout", count: 8, interval: 0.45 }], startDelay: 1.5 },
    ],
  }),
  summarize({
    id: "s2_w07_armor_test",
    name: "Armor Test",
    description: "Brutes plus a Shielder. Burst the bubble first.",
    warning: "Shielder bubble absorbs 2 hits — use cheap shots to break it.",
    recommendedCounters: ["Blaster volume", "Tesla chain"],
    rewardCredits: 120,
    rewardChoice: false,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "brute", count: 5, interval: 1.0 }] },
      { spawnerId: "west", enemies: [{ type: "shielder", count: 3, interval: 1.4 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s2_w08_silence",
    name: "Silence Protocol",
    description: "Tower systems offline for 5s.",
    warning: "SILENCE WAVE: towers suppressed for 5s. Pre-position carefully.",
    recommendedCounters: ["Core positioning", "Drones"],
    rewardCredits: 130,
    rewardChoice: true,
    waveEvent: "silence",
    lanes: [
      { spawnerId: "west", enemies: [{ type: "brute", count: 5, interval: 0.95 }] },
      { spawnerId: "east", enemies: [{ type: "grunt", count: 12, interval: 0.4 }], startDelay: 1.0 },
    ],
  }),
  summarize({
    id: "s2_w09_split_wave",
    name: "Fission Tide",
    description: "Many splitters arrive at once.",
    warning: "Each Splitter fragments into 3 Grunts on death. Pack splash.",
    recommendedCounters: ["Mortar", "Flamer", "Tesla"],
    rewardCredits: 140,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "splitter", count: 7, interval: 0.95 }] },
      { spawnerId: "south", enemies: [{ type: "scout", count: 10, interval: 0.4 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s2_w10_carrier_pair",
    name: "Carrier Pair",
    description: "Two carriers — fragmentation pressure rises.",
    warning: "Kill carriers far from the core.",
    recommendedCounters: ["Stasis", "Mortar"],
    rewardCredits: 150,
    rewardChoice: true,
    lanes: [
      { spawnerId: "west", enemies: [{ type: "carrier", count: 2, interval: 2.0 }] },
      { spawnerId: "east", enemies: [{ type: "weaver", count: 2, interval: 1.4 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s2_w11_blitz",
    name: "Blitz Swarm",
    description: "Pure scout swarm.",
    warning: "BLITZ WAVE — no stagger.",
    recommendedCounters: ["Blaster", "Flamer", "Tesla"],
    rewardCredits: 160,
    rewardChoice: false,
    waveEvent: "blitz",
    lanes: [
      { spawnerId: "north", enemies: [{ type: "scout", count: 22, interval: 0.16 }] },
      { spawnerId: "south", enemies: [{ type: "scout", count: 22, interval: 0.16 }], startDelay: 0.4 },
    ],
  }),
  summarize({
    id: "s2_w12_economy_clash",
    name: "Economy Clash",
    description: "Mixed armor and speed pressure.",
    warning: "Spread your defenses. Mixed pressure punishes all-in builds.",
    recommendedCounters: ["Mortar", "Tesla", "Stasis"],
    rewardCredits: 170,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "brute", count: 5, interval: 1.0 }] },
      { spawnerId: "east", enemies: [{ type: "sprinter", count: 9, interval: 0.45 }], startDelay: 1 },
      { spawnerId: "south", enemies: [{ type: "splitter", count: 4, interval: 1.4 }], startDelay: 2 },
    ],
  }),
  summarize({
    id: "s2_w13_repair_brutes",
    name: "Reinforced Wall",
    description: "Brutes with Weaver support.",
    warning: "Weavers double brute lifetime. Focus them.",
    recommendedCounters: ["Tesla chain", "Mortar splash"],
    rewardCredits: 180,
    rewardChoice: false,
    lanes: [
      { spawnerId: "south", enemies: [{ type: "brute", count: 8, interval: 0.9 }] },
      { spawnerId: "west", enemies: [{ type: "weaver", count: 4, interval: 1.4 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s2_w14_overlord",
    name: "Crystal Overlord",
    description: "An elite Overlord arrives flanked by escorts.",
    warning: "MID-BOSS: Overlord births swarms when chip-damaged. Burst it down.",
    recommendedCounters: ["Railgun", "Mortar", "Stasis"],
    rewardCredits: 220,
    rewardChoice: true,
    isBossWave: true,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "overlord", count: 1, interval: 1 }] },
      { spawnerId: "north", enemies: [{ type: "swarm", count: 12, interval: 0.4 }], startDelay: 2 },
      { spawnerId: "south", enemies: [{ type: "grunt", count: 8, interval: 0.7 }], startDelay: 3 },
    ],
  }),
  summarize({
    id: "s2_w15_gauntlet",
    name: "Crystal Gauntlet",
    description: "Final test — every economy threat appears.",
    warning: "Final wave. Adapt to mixed pressure.",
    recommendedCounters: ["Everything"],
    rewardCredits: 260,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "scout", count: 8, interval: 0.4 }], startDelay: 0 },
      { spawnerId: "south", enemies: [{ type: "sprinter", count: 8, interval: 0.45 }], startDelay: 4 },
      { spawnerId: "east", enemies: [{ type: "splitter", count: 5, interval: 1.2 }], startDelay: 9 },
      { spawnerId: "west", enemies: [{ type: "brute", count: 5, interval: 1.0 }], startDelay: 16 },
      { spawnerId: "north", enemies: [{ type: "shielder", count: 4, interval: 1.1 }], startDelay: 24 },
      { spawnerId: "south", enemies: [{ type: "carrier", count: 3, interval: 1.6 }], startDelay: 33 },
      { spawnerId: "east", enemies: [{ type: "weaver", count: 4, interval: 1.3 }], startDelay: 42 },
    ],
  }),
];

/* ============================================================
 * SECTOR 3 — PHANTOM GATE (detection / control sector)
 * ============================================================
 * Theme: phantom-heavy. Detection and disruption are core lessons.
 * Mutation pass on top of these (in sectors.ts) ramps phantom density,
 * but the base waves themselves teach jammer/saboteur counterplay.
 */
export const sector3Waves: WaveDefinition[] = [
  summarize({
    id: "s3_w01_first_phase",
    name: "First Phase",
    description: "Initial phantom probe.",
    warning: "Phantoms phase out — keep a wide field of fire.",
    recommendedCounters: ["Pulse + wide coverage"],
    rewardCredits: 45,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "scout", count: 5, interval: 0.6 }] },
      { spawnerId: "east", enemies: [{ type: "phantom", count: 2, interval: 1.4 }], startDelay: 1.2 },
    ],
  }),
  summarize({
    id: "s3_w02_jammer_intro",
    name: "Signal Jammer",
    description: "A Jammer suppresses tower fire-rate in an aura.",
    warning: "Jammer auras drop tower fire rate by 30% nearby. Snipe it.",
    recommendedCounters: ["Railgun", "Focus fire"],
    rewardCredits: 60,
    rewardChoice: true,
    lanes: [
      { spawnerId: "south", enemies: [{ type: "jammer", count: 1, interval: 1 }] },
      { spawnerId: "west", enemies: [{ type: "grunt", count: 8, interval: 0.7 }], startDelay: 1.0 },
    ],
  }),
  summarize({
    id: "s3_w03_phase_volley",
    name: "Phase Volley",
    description: "Phantoms in numbers.",
    warning: "Coverage matters. Detection towers shine here.",
    recommendedCounters: ["Tesla Phase Disruptor", "Scanner Drone"],
    rewardCredits: 75,
    rewardChoice: false,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "phantom", count: 6, interval: 0.95 }] },
    ],
  }),
  summarize({
    id: "s3_w04_saboteur_intro",
    name: "Saboteur Cell",
    description: "Saboteurs disable nearby towers for 3s.",
    warning: "A Saboteur near a cluster shuts the cluster down.",
    recommendedCounters: ["Snare", "Barrier slow", "Railgun"],
    rewardCredits: 85,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "saboteur", count: 3, interval: 1.4 }] },
      { spawnerId: "south", enemies: [{ type: "grunt", count: 9, interval: 0.65 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s3_w05_ghost_column",
    name: "Ghost Column",
    description: "Phantoms blend into a grunt push.",
    warning: "Detection or wide coverage required.",
    recommendedCounters: ["Tesla", "Scanner Drone"],
    rewardCredits: 95,
    rewardChoice: false,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "phantom", count: 6, interval: 0.85 }] },
      { spawnerId: "south", enemies: [{ type: "grunt", count: 12, interval: 0.5 }], startDelay: 0.8 },
    ],
  }),
  summarize({
    id: "s3_w06_jammer_pair",
    name: "Jammer Pair",
    description: "Two Jammers escort a brute column.",
    warning: "Snipe Jammers first. Brutes will eat your towers otherwise.",
    recommendedCounters: ["Railgun", "Mortar", "Focus fire"],
    rewardCredits: 105,
    rewardChoice: true,
    lanes: [
      { spawnerId: "west", enemies: [{ type: "jammer", count: 2, interval: 1.4 }] },
      { spawnerId: "east", enemies: [{ type: "brute", count: 5, interval: 1.1 }], startDelay: 1.2 },
    ],
  }),
  summarize({
    id: "s3_w07_phantom_blitz",
    name: "Phantom Blitz",
    description: "Phantom-only swarm.",
    warning: "Pure phantom rush — detection is mandatory.",
    recommendedCounters: ["Scanner Drone", "Tesla Phase Disruptor"],
    rewardCredits: 115,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "phantom", count: 14, interval: 0.45 }] },
    ],
  }),
  summarize({
    id: "s3_w08_silence",
    name: "Silence Protocol",
    description: "Towers offline for 5s.",
    warning: "SILENCE WAVE — pre-position carefully.",
    recommendedCounters: ["Layout", "Drones"],
    rewardCredits: 125,
    rewardChoice: true,
    waveEvent: "silence",
    lanes: [
      { spawnerId: "south", enemies: [{ type: "phantom", count: 5, interval: 0.85 }] },
      { spawnerId: "east", enemies: [{ type: "grunt", count: 14, interval: 0.4 }], startDelay: 1.0 },
    ],
  }),
  summarize({
    id: "s3_w09_saboteur_storm",
    name: "Saboteur Storm",
    description: "Saboteurs flood from multiple lanes.",
    warning: "Multiple Saboteurs — defend in depth.",
    recommendedCounters: ["Snare", "Railgun", "Wide coverage"],
    rewardCredits: 135,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "saboteur", count: 5, interval: 1.0 }] },
      { spawnerId: "south", enemies: [{ type: "saboteur", count: 5, interval: 1.0 }], startDelay: 0.7 },
    ],
  }),
  summarize({
    id: "s3_w10_armored_ghosts",
    name: "Armored Ghosts",
    description: "Brutes and Phantoms together.",
    warning: "Hard checkpoint.",
    recommendedCounters: ["Mortar", "Tesla", "Stasis"],
    rewardCredits: 145,
    rewardChoice: true,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "brute", count: 8, interval: 0.85 }] },
      { spawnerId: "west", enemies: [{ type: "phantom", count: 6, interval: 0.8 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s3_w11_mirror_intro",
    name: "Mirror Vanguard",
    description: "Mirror units reflect tower fire.",
    warning: "Don't focus expensive towers on Mirrors. Spread fire.",
    recommendedCounters: ["Mortar splash", "Flamer", "Stasis"],
    rewardCredits: 160,
    rewardChoice: false,
    lanes: [
      { spawnerId: "west", enemies: [
        { type: "mirror", count: 3, interval: 1.7 },
        { type: "grunt", count: 10, interval: 0.4 },
      ] },
    ],
  }),
  summarize({
    id: "s3_w12_jammer_phantom",
    name: "Disruption Field",
    description: "Jammers and phantoms together.",
    warning: "Towers fire slower while Jammers live. Detection still needed.",
    recommendedCounters: ["Railgun", "Tesla Phase Disruptor"],
    rewardCredits: 170,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "jammer", count: 3, interval: 1.2 }] },
      { spawnerId: "east", enemies: [{ type: "phantom", count: 10, interval: 0.6 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s3_w13_carrier_phase",
    name: "Phantom Carrier",
    description: "Carriers backed by phantoms.",
    warning: "Splash phantoms while killing carriers far from core.",
    recommendedCounters: ["Stasis + Mortar", "Tesla"],
    rewardCredits: 185,
    rewardChoice: false,
    lanes: [
      { spawnerId: "south", enemies: [{ type: "carrier", count: 3, interval: 1.6 }] },
      { spawnerId: "west", enemies: [{ type: "phantom", count: 8, interval: 0.7 }], startDelay: 1.5 },
    ],
  }),
  summarize({
    id: "s3_w14_breach_test",
    name: "Detection Breach",
    description: "All control-themed threats together.",
    warning: "Saboteurs, Jammers, and Phantoms in one push.",
    recommendedCounters: ["Snare", "Tesla Phase Disruptor", "Railgun"],
    rewardCredits: 200,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "saboteur", count: 4, interval: 1.0 }] },
      { spawnerId: "east", enemies: [{ type: "jammer", count: 3, interval: 1.2 }], startDelay: 1 },
      { spawnerId: "south", enemies: [{ type: "phantom", count: 8, interval: 0.55 }], startDelay: 2 },
    ],
  }),
  summarize({
    id: "s3_w15_phantom_gauntlet",
    name: "Phantom Gauntlet",
    description: "Final phantom-themed test.",
    warning: "Final wave. Detection wins or loses you the run.",
    recommendedCounters: ["Tesla Phase Disruptor", "Scanner Drone"],
    rewardCredits: 260,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "phantom", count: 10, interval: 0.5 }], startDelay: 0 },
      { spawnerId: "south", enemies: [{ type: "saboteur", count: 5, interval: 0.95 }], startDelay: 5 },
      { spawnerId: "east", enemies: [{ type: "jammer", count: 4, interval: 1.2 }], startDelay: 12 },
      { spawnerId: "west", enemies: [{ type: "mirror", count: 4, interval: 1.5 }], startDelay: 20 },
      { spawnerId: "north", enemies: [{ type: "carrier", count: 2, interval: 2.0 }], startDelay: 30 },
      { spawnerId: "south", enemies: [{ type: "phantom", count: 12, interval: 0.45 }], startDelay: 40 },
    ],
  }),
];

/* ============================================================
 * SECTOR 4 — HOSTILE CORE (final exam)
 * ============================================================
 * Theme: artillery, sabotage, multi-boss, escalation. Big finale.
 * Includes the Harbinger mid-sector and the Leviathan finale.
 */
export const sector4Waves: WaveDefinition[] = [
  summarize({
    id: "s4_w01_advance",
    name: "Hostile Advance",
    description: "Heavy grunts probe the core.",
    warning: "Pre-buffed enemies. Build conservatively.",
    recommendedCounters: ["Pulse", "Mortar"],
    rewardCredits: 60,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "grunt", count: 12, interval: 0.7 }] },
      { spawnerId: "south", enemies: [{ type: "scout", count: 8, interval: 0.55 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s4_w02_brute_volley",
    name: "Brute Volley",
    description: "Brutes lead the assault.",
    warning: "Burst damage required.",
    recommendedCounters: ["Stasis + Mortar", "Railgun"],
    rewardCredits: 75,
    rewardChoice: true,
    lanes: [
      { spawnerId: "west", enemies: [{ type: "brute", count: 6, interval: 1.0 }] },
      { spawnerId: "east", enemies: [{ type: "grunt", count: 10, interval: 0.55 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s4_w03_saboteur_test",
    name: "Saboteur Test",
    description: "Tower-disablers approach.",
    warning: "Defend in depth — saboteurs love clusters.",
    recommendedCounters: ["Snare", "Railgun"],
    rewardCredits: 90,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "saboteur", count: 4, interval: 1.0 }] },
      { spawnerId: "south", enemies: [{ type: "brute", count: 5, interval: 1.2 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s4_w04_carrier_brute",
    name: "Carrier Wedge",
    description: "Carrier splits ahead of brutes.",
    warning: "Kill carriers far from core.",
    recommendedCounters: ["Stasis", "Mortar"],
    rewardCredits: 105,
    rewardChoice: true,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "carrier", count: 2, interval: 1.6 }] },
      { spawnerId: "west", enemies: [{ type: "brute", count: 6, interval: 1.0 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s4_w05_phantom_breach",
    name: "Phantom Breach",
    description: "Phantoms with brute escort.",
    warning: "Detection or wide coverage required.",
    recommendedCounters: ["Tesla Phase Disruptor", "Scanner Drone"],
    rewardCredits: 120,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "phantom", count: 8, interval: 0.7 }] },
      { spawnerId: "south", enemies: [{ type: "brute", count: 5, interval: 1.0 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s4_w06_juggernaut_intro",
    name: "Juggernaut Charge",
    description: "Heavy armor — armor-piercer matters.",
    warning: "Juggernauts have 30% armor. Bring piercer.",
    recommendedCounters: ["Railgun", "Armor-piercer Blaster"],
    rewardCredits: 135,
    rewardChoice: true,
    lanes: [
      { spawnerId: "west", enemies: [{ type: "juggernaut", count: 3, interval: 1.6 }] },
      { spawnerId: "east", enemies: [{ type: "saboteur", count: 4, interval: 1.0 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s4_w07_silence",
    name: "Silence Protocol",
    description: "Towers offline for 5s.",
    warning: "SILENCE WAVE — pre-position carefully.",
    recommendedCounters: ["Layout", "Drones"],
    rewardCredits: 145,
    rewardChoice: false,
    waveEvent: "silence",
    lanes: [
      { spawnerId: "north", enemies: [{ type: "juggernaut", count: 2, interval: 1.4 }] },
      { spawnerId: "south", enemies: [{ type: "grunt", count: 16, interval: 0.4 }], startDelay: 1.0 },
    ],
  }),
  summarize({
    id: "s4_w08_blitz",
    name: "Blitz Swarm",
    description: "Pure scout swarm — chain and splash dominate.",
    warning: "BLITZ WAVE.",
    recommendedCounters: ["Tesla", "Flamer", "Mortar"],
    rewardCredits: 160,
    rewardChoice: true,
    waveEvent: "blitz",
    lanes: [
      { spawnerId: "north", enemies: [{ type: "scout", count: 24, interval: 0.14 }] },
      { spawnerId: "south", enemies: [{ type: "scout", count: 24, interval: 0.14 }], startDelay: 0.4 },
    ],
  }),
  summarize({
    id: "s4_w09_mirror_armor",
    name: "Mirror Armor",
    description: "Mirrors among juggernauts.",
    warning: "Mirrors disable towers on reflect. Spread fire.",
    recommendedCounters: ["Mortar splash", "Flamer cones"],
    rewardCredits: 175,
    rewardChoice: false,
    lanes: [
      { spawnerId: "east", enemies: [
        { type: "mirror", count: 4, interval: 1.4 },
        { type: "juggernaut", count: 3, interval: 1.8 },
      ] },
      { spawnerId: "west", enemies: [{ type: "grunt", count: 12, interval: 0.5 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s4_w10_jammer_field",
    name: "Jammer Field",
    description: "Jammers escort brutes and phantoms.",
    warning: "Snipe Jammers; tower fire is suppressed otherwise.",
    recommendedCounters: ["Railgun", "Focus fire"],
    rewardCredits: 190,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "jammer", count: 4, interval: 1.0 }] },
      { spawnerId: "south", enemies: [{ type: "phantom", count: 8, interval: 0.6 }], startDelay: 1 },
      { spawnerId: "east", enemies: [{ type: "brute", count: 6, interval: 1.0 }], startDelay: 2 },
    ],
  }),
  summarize({
    id: "s4_w11_overlord",
    name: "Overlord Strike",
    description: "Mid-sector boss — Overlord with escorts.",
    warning: "MID-BOSS: Overlord births swarms when chip-damaged.",
    recommendedCounters: ["Railgun", "Mortar", "Stasis"],
    rewardCredits: 220,
    rewardChoice: false,
    isBossWave: true,
    lanes: [
      { spawnerId: "west", enemies: [{ type: "overlord", count: 1, interval: 1 }] },
      { spawnerId: "east", enemies: [{ type: "brute", count: 6, interval: 1.0 }], startDelay: 2 },
      { spawnerId: "north", enemies: [{ type: "swarm", count: 14, interval: 0.4 }], startDelay: 3 },
    ],
  }),
  summarize({
    id: "s4_w12_tunneler_intro",
    name: "Tunneler Cell",
    description: "Tunnelers dive beneath defenses.",
    warning: "Tunnelers surface inside your grid. Defense in depth required.",
    recommendedCounters: ["Wide coverage", "Mortar splash"],
    rewardCredits: 200,
    rewardChoice: true,
    lanes: [
      { spawnerId: "south", enemies: [{ type: "tunneler", count: 6, interval: 0.95 }] },
      { spawnerId: "east", enemies: [{ type: "grunt", count: 12, interval: 0.5 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "s4_w13_harbinger",
    name: "Harbinger at the Edge",
    description: "Artillery boss anchors at the perimeter.",
    warning: "BOSS: Harbinger marks tower clusters with artillery.",
    recommendedCounters: ["Railgun", "Reflector", "Spread layout"],
    rewardCredits: 240,
    rewardChoice: true,
    isBossWave: true,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "harbinger", count: 1, interval: 1 }] },
      { spawnerId: "west", enemies: [{ type: "jammer", count: 4, interval: 1.5 }], startDelay: 3 },
      { spawnerId: "north", enemies: [{ type: "brute", count: 6, interval: 1.1 }], startDelay: 5 },
    ],
  }),
  summarize({
    id: "s4_w14_final_push",
    name: "Final Push",
    description: "Combined-arms onslaught before the finale.",
    warning: "Mixed pressure — every counter matters.",
    recommendedCounters: ["Everything"],
    rewardCredits: 220,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "juggernaut", count: 3, interval: 1.6 }] },
      { spawnerId: "south", enemies: [{ type: "saboteur", count: 5, interval: 1.0 }], startDelay: 1 },
      { spawnerId: "east", enemies: [{ type: "phantom", count: 8, interval: 0.6 }], startDelay: 2 },
      { spawnerId: "west", enemies: [{ type: "tunneler", count: 4, interval: 1.0 }], startDelay: 3 },
    ],
  }),
  summarize({
    id: "s4_w15_leviathan",
    name: "The Leviathan",
    description: "The hostile core itself awakens.",
    warning: "FINAL BOSS: multi-phase. Summons escorts, disables towers.",
    recommendedCounters: ["Everything"],
    rewardCredits: 320,
    rewardChoice: false,
    isBossWave: true,
    lanes: [
      { spawnerId: "west", enemies: [{ type: "leviathan", count: 1, interval: 1.0 }] },
      { spawnerId: "north", enemies: [{ type: "carrier", count: 3, interval: 1.4 }], startDelay: 3 },
      { spawnerId: "south", enemies: [{ type: "brute", count: 8, interval: 1.0 }], startDelay: 1.5 },
      { spawnerId: "east", enemies: [{ type: "saboteur", count: 5, interval: 1.0 }], startDelay: 6 },
    ],
  }),
];
