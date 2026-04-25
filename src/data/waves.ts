import type { WaveDefinition } from "../core/Types";

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
 * 15-wave campaign arc shared by the three starter sectors.
 * Sectors can override or extend this via their own waves.
 */
export const defaultWaves: WaveDefinition[] = [
  summarize({
    id: "w01_first_contact",
    name: "First Contact",
    description: "Fast scouts probe the relay perimeter.",
    warning: "Fast, lightly armored scouts. Expect pressure, not damage.",
    recommendedCounters: ["Pulse", "Blaster"],
    rewardCredits: 40,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "north",
        enemies: [{ type: "scout", count: 6, interval: 0.75 }],
      },
    ],
  }),
  summarize({
    id: "w02_signal_pressure",
    name: "Signal Pressure",
    description: "Standard grunts advance in a steady line.",
    warning: "Grunts test your baseline defense.",
    recommendedCounters: ["Pulse", "Blaster"],
    rewardCredits: 55,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "south",
        enemies: [{ type: "grunt", count: 10, interval: 0.85 }],
      },
    ],
  }),
  summarize({
    id: "w03_phase_echo",
    name: "Phase Echo",
    description: "Phantom signatures detected hiding behind scouts.",
    warning: "Phantoms are immune while phased — spread fire, keep coverage wide.",
    recommendedCounters: ["Tesla", "Wide coverage"],
    rewardCredits: 60,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "north",
        enemies: [{ type: "scout", count: 8, interval: 0.42 }],
      },
      {
        spawnerId: "east",
        enemies: [{ type: "phantom", count: 2, interval: 1.4 }],
        startDelay: 1.2,
      },
    ],
  }),
  summarize({
    id: "w04_heavy_contact",
    name: "Heavy Contact",
    description: "Brutes require sustained damage or control.",
    warning: "Brutes are slow but very tough.",
    recommendedCounters: ["Stasis", "Mortar"],
    rewardCredits: 65,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "south",
        enemies: [
          { type: "grunt", count: 12, interval: 0.62 },
          { type: "brute", count: 3, interval: 1.7 },
        ],
      },
    ],
  }),
  summarize({
    id: "w05_carrier_breach",
    name: "Carrier Breach",
    description: "Carriers split into Scouts when destroyed.",
    warning: "Kill carriers far from the core — their scout burst can breach.",
    recommendedCounters: ["Stasis", "Tesla", "Mortar"],
    rewardCredits: 70,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "west",
        enemies: [{ type: "carrier", count: 1, interval: 1.0 }],
      },
      {
        spawnerId: "east",
        enemies: [{ type: "scout", count: 10, interval: 0.32 }],
        startDelay: 1.6,
      },
    ],
  }),
  summarize({
    id: "w06_weaver_escort",
    name: "Weaver Escort",
    description: "Healers protect a group of armored Brutes.",
    warning: "Weavers repair nearby enemies. Eliminate them first.",
    recommendedCounters: ["Stasis", "Mortar", "Tesla chain"],
    rewardCredits: 80,
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
    description: "Phantoms hide inside a larger attack group.",
    warning: "Phantoms are dangerous in numbers.",
    recommendedCounters: ["Tesla + Phase Disruptor", "Scanner Drone"],
    rewardCredits: 85,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "east",
        enemies: [{ type: "phantom", count: 8, interval: 0.85 }],
      },
      {
        spawnerId: "south",
        enemies: [{ type: "grunt", count: 15, interval: 0.45 }],
        startDelay: 0.5,
      },
    ],
  }),
  summarize({
    id: "w08_nest_splitters",
    name: "Nest Splitters",
    description: "Multiple carriers flood the grid if not controlled.",
    warning: "A single missed carrier can snowball into a scout breach.",
    recommendedCounters: ["Stasis", "Mortar", "Chain"],
    rewardCredits: 95,
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
    description: "A pure scout swarm arrives all at once. Blasters and Tesla arrays shine here.",
    warning: "BLITZ WAVE: no stagger. Volume over armor. Chain and splash dominate.",
    recommendedCounters: ["Blaster", "Tesla", "Mortar"],
    rewardCredits: 100,
    rewardChoice: false,
    waveEvent: "blitz",
    lanes: [
      {
        spawnerId: "north",
        enemies: [{ type: "scout", count: 20, interval: 0.14 }],
      },
      {
        spawnerId: "south",
        enemies: [{ type: "scout", count: 20, interval: 0.15 }],
        startDelay: 0.4,
      },
    ],
  }),
  summarize({
    id: "w10_armored_ghosts",
    name: "Armored Ghosts",
    description: "Brutes and Phantoms combine pressure with immunity windows.",
    warning: "A hard checkpoint. Consider specialization choices.",
    recommendedCounters: ["Mortar", "Tesla", "Stasis"],
    rewardCredits: 115,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "east",
        enemies: [{ type: "brute", count: 10, interval: 0.82 }],
      },
      {
        spawnerId: "west",
        enemies: [{ type: "phantom", count: 5, interval: 0.75 }],
        startDelay: 1,
      },
    ],
  }),
  summarize({
    id: "w11_carrier_tide",
    name: "Carrier Tide",
    description: "A slow but dangerous carrier wave.",
    warning: "Control the tempo; don't let scouts spawn near the core.",
    recommendedCounters: ["Stasis", "Mortar"],
    rewardCredits: 120,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "south",
        enemies: [{ type: "carrier", count: 5, interval: 1.55 }],
      },
    ],
  }),
  summarize({
    id: "w12_repair_swarm",
    name: "Repair Swarm",
    description: "Weavers protect a large body of grunts.",
    warning: "Weavers will keep grunts alive forever. Focus them down.",
    recommendedCounters: ["Tesla", "Mortar splash"],
    rewardCredits: 130,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "north",
        enemies: [{ type: "grunt", count: 30, interval: 0.26 }],
      },
      {
        spawnerId: "east",
        enemies: [{ type: "weaver", count: 6, interval: 1.15 }],
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
    rewardCredits: 140,
    rewardChoice: false,
    lanes: [
      {
        spawnerId: "west",
        enemies: [{ type: "brute", count: 15, interval: 0.65 }],
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
    rewardCredits: 150,
    rewardChoice: true,
    lanes: [
      {
        spawnerId: "north",
        enemies: [{ type: "phantom", count: 20, interval: 0.42 }],
      },
      {
        spawnerId: "south",
        enemies: [{ type: "scout", count: 20, interval: 0.18 }],
        startDelay: 0.3,
      },
    ],
  }),
  summarize({
    id: "w15_leviathan",
    name: "The Leviathan",
    description: "Final boss anomaly inbound with heavy escort.",
    warning: "Boss fight: multi-phase. Summons escorts, disables towers.",
    recommendedCounters: ["Everything"],
    rewardCredits: 250,
    rewardChoice: false,
    isBossWave: true,
    lanes: [
      {
        spawnerId: "west",
        enemies: [{ type: "leviathan", count: 1, interval: 1.0 }],
      },
      {
        spawnerId: "north",
        enemies: [{ type: "carrier", count: 3, interval: 1.4 }],
        startDelay: 3,
      },
      {
        spawnerId: "south",
        enemies: [{ type: "brute", count: 8, interval: 1.0 }],
        startDelay: 1.5,
      },
    ],
  }),
];
