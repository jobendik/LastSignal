import type { CodexEntry, EnemyType, TowerCodexEntry, TowerType } from "../core/Types";

export const codexEntries: Record<EnemyType, CodexEntry> = {
  scout: {
    enemyId: "scout",
    threatHeadline: "Fast recon anomaly — low HP.",
    counters: ["Blaster", "Tesla", "Hunter Drone"],
    tip: "Blanket coverage beats speed. Cheap Pulse + Blaster wins.",
  },
  grunt: {
    enemyId: "grunt",
    threatHeadline: "Standard attacker — average threat.",
    counters: ["Pulse", "Mortar", "Tesla"],
    tip: "Any reasonable defense handles grunts. Save credits for harder waves.",
  },
  brute: {
    enemyId: "brute",
    threatHeadline: "Armored slow unit — dangerous alone.",
    counters: ["Stasis + Mortar", "Armor-piercer Blaster"],
    tip: "Slow them and hit hard. Mortar inside a Stasis zone is brutal.",
  },
  weaver: {
    enemyId: "weaver",
    threatHeadline: "Healer — repairs nearby enemies.",
    counters: ["Tesla chain", "Mortar splash", "Focus fire"],
    tip: "Kill weavers first. Chain damage from Tesla reaches them in the crowd.",
  },
  phantom: {
    enemyId: "phantom",
    threatHeadline: "Phases in/out — immune while phased.",
    counters: ["Tesla Phase Disruptor", "Scanner Drone", "Timing"],
    tip: "Build wide coverage so phantoms are always in at least one tower's window.",
  },
  carrier: {
    enemyId: "carrier",
    threatHeadline: "Splits into Scouts on death.",
    counters: ["Kill inside a kill zone", "Stasis + Tesla"],
    tip: "Never let carriers die near the core — the scout burst will breach.",
  },
  leviathan: {
    enemyId: "leviathan",
    threatHeadline: "Final boss. Multi-phase threat.",
    counters: ["Everything. Mass towers, drones, and upgrades."],
    tip: "Expect escort waves and tower shutdowns. Keep the core above 50%.",
  },
  swarmling: {
    enemyId: "swarmling",
    threatHeadline: "Tiny splinter — appears from Carriers and Corruptors.",
    counters: ["Blaster", "Flamethrower", "Tesla"],
    tip: "Wide AoE is king — a single Mortar can clear a dozen.",
  },
  shielded: {
    enemyId: "shielded",
    threatHeadline: "Bulwark — frontal shield absorbs 60% damage.",
    counters: ["Tesla chain", "Flanking", "Signal Marker"],
    tip: "Flank with chain damage. Once the shield cracks, they're soft.",
  },
  sapper: {
    enemyId: "sapper",
    threatHeadline: "Suicide bomber — detonates near towers.",
    counters: ["Long-range", "Aegis Pylon", "Railgun"],
    tip: "Spread towers out and kill sappers early. Aegis Reflect Field neutralizes them.",
  },
  wraith: {
    enemyId: "wraith",
    threatHeadline: "Fast phasing assassin.",
    counters: ["Scanner Drone", "Tesla Phase Disruptor", "Flamethrower"],
    tip: "Wraiths phase faster but die fast when exposed. Broad coverage or cones work.",
  },
  titan: {
    enemyId: "titan",
    threatHeadline: "Elite mid-wave threat — armored and tough.",
    counters: ["Railgun Overcharge", "Armor Breaker Mortar", "Vulnerability Pulse"],
    tip: "Don't chip — commit. Stasis + Railgun melts Titans.",
  },
  corruptor: {
    enemyId: "corruptor",
    threatHeadline: "Slows nearby tower fire rates.",
    counters: ["Focus fire", "Railgun", "Drones"],
    tip: "Kill Corruptors first. Drones don't care about the aura.",
  },
  harbinger: {
    enemyId: "harbinger",
    threatHeadline: "Endless-mode mini-boss — scales each appearance.",
    counters: ["Everything"],
    tip: "Keep your economy churning between waves. Harbingers punish weak builds.",
  },
};

export const towerCodexEntries: Record<TowerType, TowerCodexEntry> = {
  pulse: {
    towerId: "pulse",
    headline: "Cheap, reliable, and scales well.",
    tip: "A Pulse at every choke saves credits for luxury towers later.",
  },
  blaster: {
    towerId: "blaster",
    headline: "Shreds low-HP swarms.",
    tip: "Pair with Signal Marker for drone synergy.",
  },
  stasis: {
    towerId: "stasis",
    headline: "No damage, massive value. Creates kill zones.",
    tip: "Place Stasis inside Mortar range — armored enemies evaporate.",
  },
  mortar: {
    towerId: "mortar",
    headline: "Heavy splash, slow cadence.",
    tip: "Stack Burning Ground and Shrapnel for sustained area denial.",
  },
  tesla: {
    towerId: "tesla",
    headline: "Chains through densely packed enemies.",
    tip: "Chain Storm + EMP Arc is the ultimate anti-swarm.",
  },
  harvester: {
    towerId: "harvester",
    headline: "Economy backbone. Requires crystals.",
    tip: "Build harvesters early. Relay Node buffs nearby towers.",
  },
  railgun: {
    towerId: "railgun",
    headline: "Piercing long-range precision.",
    tip: "Place where enemies funnel — each shot can punch through multiple.",
  },
  flamethrower: {
    towerId: "flamethrower",
    headline: "Short-range cone of burning plasma.",
    tip: "Place where swarms converge. Napalm Pool amplifies the DoT.",
  },
  shield: {
    towerId: "shield",
    headline: "Defensive aura. Doesn't attack.",
    tip: "Place near the core. Reactive Armor halves breach damage.",
  },
};
