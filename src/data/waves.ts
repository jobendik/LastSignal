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
    name: "Swarm Burst",
    description: "A pure scout swarm. Blasters and Tesla arrays shine here.",
    warning: "Volume over armor. Chain and splash dominate.",
    recommendedCounters: ["Blaster", "Tesla", "Mortar"],
    rewardCredits: 100,
    rewardChoice: false,
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

/**
 * Advanced wave set featuring new enemies. Used by later sectors (4-6).
 */
export const advancedWaves: WaveDefinition[] = [
  summarize({
    id: "adv01_sapper_threat",
    name: "Sapper Threat",
    description: "Kamikaze sappers approach. Keep your towers spread out.",
    warning: "Sappers detonate when reaching towers — spread out your defense.",
    recommendedCounters: ["Blaster", "Aegis Pylon"],
    rewardCredits: 60,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "sapper", count: 5, interval: 1.2 }] },
      { spawnerId: "south", enemies: [{ type: "grunt", count: 8, interval: 0.5 }], startDelay: 1.0 },
    ],
  }),
  summarize({
    id: "adv02_bulwark_column",
    name: "Bulwark Column",
    description: "Shielded bulwarks push forward in formation.",
    warning: "Frontal shields absorb damage — flank with chain or splash.",
    recommendedCounters: ["Tesla", "Mortar", "Railgun"],
    rewardCredits: 80,
    rewardChoice: true,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "shielded", count: 5, interval: 1.4 }] },
      { spawnerId: "west", enemies: [{ type: "grunt", count: 10, interval: 0.4 }], startDelay: 0.8 },
    ],
  }),
  summarize({
    id: "adv03_wraith_incursion",
    name: "Wraith Incursion",
    description: "Fast phasing wraiths slip past gaps in coverage.",
    warning: "Wraiths phase faster than Phantoms — broad coverage is essential.",
    recommendedCounters: ["Tesla + Phase Disruptor", "Scanner Drone", "Flamethrower"],
    rewardCredits: 95,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "wraith", count: 10, interval: 0.7 }] },
      { spawnerId: "east", enemies: [{ type: "phantom", count: 4, interval: 1.0 }], startDelay: 1.5 },
    ],
  }),
  summarize({
    id: "adv04_corruptor_pressure",
    name: "Corruptor Pressure",
    description: "Corruptors debuff towers in an aura.",
    warning: "Your towers fire slower near Corruptors. Kill them quickly.",
    recommendedCounters: ["Focus fire", "Mortar", "Railgun"],
    rewardCredits: 110,
    rewardChoice: true,
    lanes: [
      { spawnerId: "south", enemies: [{ type: "corruptor", count: 3, interval: 1.6 }] },
      { spawnerId: "west", enemies: [{ type: "brute", count: 6, interval: 0.9 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "adv05_swarm_storm",
    name: "Swarm Storm",
    description: "A massive swarm of Swarmlings and Scouts.",
    warning: "Overwhelming numbers. AoE is critical.",
    recommendedCounters: ["Flamethrower", "Tesla", "Mortar"],
    rewardCredits: 120,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "swarmling", count: 40, interval: 0.14 }] },
      { spawnerId: "south", enemies: [{ type: "scout", count: 25, interval: 0.18 }], startDelay: 0.4 },
    ],
  }),
  summarize({
    id: "adv06_weaver_shield",
    name: "Weaver Shield",
    description: "Weavers escort a phalanx of Bulwarks.",
    warning: "Healers + shielded — break shields fast and then focus weavers.",
    recommendedCounters: ["Chain", "Splash", "Signal Marker"],
    rewardCredits: 130,
    rewardChoice: true,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "shielded", count: 6, interval: 1.0 }, { type: "weaver", count: 3, interval: 1.6 }] },
    ],
  }),
  summarize({
    id: "adv07_titan_vanguard",
    name: "Titan Vanguard",
    description: "A Titan elite leads a grunt column.",
    warning: "Titans are armored and resist explosives — stasis and railguns excel.",
    recommendedCounters: ["Railgun", "Stasis", "Vulnerability"],
    rewardCredits: 160,
    rewardChoice: false,
    lanes: [
      { spawnerId: "west", enemies: [{ type: "titan", count: 1, interval: 1 }] },
      { spawnerId: "north", enemies: [{ type: "grunt", count: 18, interval: 0.35 }], startDelay: 1.2 },
    ],
  }),
  summarize({
    id: "adv08_phase_wraiths",
    name: "Phase Wraiths",
    description: "Wraiths, Phantoms, and sappers together.",
    warning: "Layered threats. Use drones and wide coverage.",
    recommendedCounters: ["Scanner Drone", "Flamethrower", "Railgun"],
    rewardCredits: 175,
    rewardChoice: true,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "wraith", count: 10, interval: 0.5 }] },
      { spawnerId: "west", enemies: [{ type: "sapper", count: 6, interval: 0.9 }], startDelay: 0.5 },
      { spawnerId: "south", enemies: [{ type: "phantom", count: 8, interval: 0.7 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "adv09_carrier_corruption",
    name: "Carrier Corruption",
    description: "Carriers and Corruptors in tandem.",
    warning: "Stop carriers far from the core; corruptors weaken towers.",
    recommendedCounters: ["Mortar", "Tesla", "Aegis Pylon"],
    rewardCredits: 190,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "carrier", count: 4, interval: 1.4 }] },
      { spawnerId: "south", enemies: [{ type: "corruptor", count: 4, interval: 1.3 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "adv10_titan_duo",
    name: "Titan Duo",
    description: "Two Titans with armored escort.",
    warning: "Bring heavy anti-armor.",
    recommendedCounters: ["Railgun Overcharge", "Armor Breaker Mortar"],
    rewardCredits: 210,
    rewardChoice: true,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "titan", count: 2, interval: 3 }] },
      { spawnerId: "west", enemies: [{ type: "brute", count: 10, interval: 0.7 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "adv11_wraith_swarm",
    name: "Wraith Swarm",
    description: "A dense wraith onslaught.",
    warning: "Phasing + speed. Scanner drones are essential.",
    recommendedCounters: ["Scanner Drones", "Tesla Chain Storm"],
    rewardCredits: 220,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "wraith", count: 25, interval: 0.35 }] },
      { spawnerId: "south", enemies: [{ type: "swarmling", count: 30, interval: 0.2 }], startDelay: 0.4 },
    ],
  }),
  summarize({
    id: "adv12_bulwark_tide",
    name: "Bulwark Tide",
    description: "A huge shielded advance.",
    warning: "Frontal shields and armor everywhere.",
    recommendedCounters: ["Chain", "Flamethrower", "Signal Marker"],
    rewardCredits: 230,
    rewardChoice: true,
    lanes: [
      { spawnerId: "east", enemies: [{ type: "shielded", count: 14, interval: 0.6 }] },
      { spawnerId: "west", enemies: [{ type: "sapper", count: 6, interval: 0.9 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "adv13_corrupt_storm",
    name: "Corruption Storm",
    description: "Multiple Corruptors + Phantoms.",
    warning: "Your towers will feel sluggish — clear Corruptors first.",
    recommendedCounters: ["Drones", "Railgun", "Tesla"],
    rewardCredits: 250,
    rewardChoice: false,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "corruptor", count: 5, interval: 1.2 }] },
      { spawnerId: "east", enemies: [{ type: "phantom", count: 12, interval: 0.6 }], startDelay: 0.5 },
    ],
  }),
  summarize({
    id: "adv14_escalation",
    name: "Escalation",
    description: "A chaotic mixed wave.",
    warning: "Titans, wraiths, sappers, and swarmlings.",
    recommendedCounters: ["Everything"],
    rewardCredits: 280,
    rewardChoice: true,
    lanes: [
      { spawnerId: "north", enemies: [{ type: "titan", count: 1, interval: 1 }, { type: "wraith", count: 10, interval: 0.5 }] },
      { spawnerId: "south", enemies: [{ type: "sapper", count: 8, interval: 0.8 }, { type: "swarmling", count: 20, interval: 0.2 }], startDelay: 1 },
    ],
  }),
  summarize({
    id: "adv15_harbinger",
    name: "The Harbinger",
    description: "A Harbinger leads the final assault.",
    warning: "Elite mid-boss inbound with an escort. Keep core above 40%.",
    recommendedCounters: ["Everything"],
    rewardCredits: 400,
    rewardChoice: false,
    isBossWave: true,
    lanes: [
      { spawnerId: "west", enemies: [{ type: "harbinger", count: 1, interval: 1 }] },
      { spawnerId: "north", enemies: [{ type: "shielded", count: 6, interval: 1.0 }], startDelay: 2 },
      { spawnerId: "south", enemies: [{ type: "wraith", count: 10, interval: 0.6 }], startDelay: 3 },
      { spawnerId: "east", enemies: [{ type: "carrier", count: 2, interval: 2 }], startDelay: 5 },
    ],
  }),
];
