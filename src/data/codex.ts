import type { CodexEntry, EnemyType } from "../core/Types";

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
  sprinter: {
    enemyId: "sprinter",
    threatHeadline: "Ultra-fast courier — negligible HP.",
    counters: ["Stasis", "Blaster", "Barrier slow"],
    tip: "Slow them and they die to anything. Unslowed, they'll run past everything.",
  },
  juggernaut: {
    enemyId: "juggernaut",
    threatHeadline: "Heavily armored siege unit.",
    counters: ["Railgun", "Armor-piercer", "Mortar inside Stasis"],
    tip: "Burst them with Railgun or chew through with armor-piercer Blaster.",
  },
  shielder: {
    enemyId: "shielder",
    threatHeadline: "Projects a bubble — slows incoming damage.",
    counters: ["Sustained fire", "Tesla chain", "Mortar splash"],
    tip: "Ignore it while the bubble is up — focus elsewhere, clean up after.",
  },
  splitter: {
    enemyId: "splitter",
    threatHeadline: "Fission on death — spawns Grunts.",
    counters: ["Splash damage", "Stasis kill zone"],
    tip: "Kill them deep in your grid so the halves die before reaching the core.",
  },
  jammer: {
    enemyId: "jammer",
    threatHeadline: "Disrupts tower fire rate in a small aura.",
    counters: ["Snipe with Railgun", "Blaster burst", "Focus fire"],
    tip: "Kill on sight. Jammers neuter entire tower clusters while they live.",
  },
  swarm: {
    enemyId: "swarm",
    threatHeadline: "Disposable micro-drone — low HP, high count.",
    counters: ["Flamer", "Blaster", "Tesla"],
    tip: "Wide AoE melts them. Don't waste Mortar shots on individual swarm units.",
  },
  overlord: {
    enemyId: "overlord",
    threatHeadline: "Mid-run elite boss — escorts swarm units.",
    counters: ["Tesla chain", "Stasis + focus fire", "Barrier"],
    tip: "Break its escort first. The Overlord itself is slow — punish it.",
  },
};
