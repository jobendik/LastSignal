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
};
