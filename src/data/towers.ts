import type { TowerDefinition, TowerType, SpecializationTree } from "../core/Types";

export const towerDefinitions: Record<TowerType, TowerDefinition> = {
  pulse: {
    id: "pulse",
    name: "Pulse Cannon",
    role: "Reliable all-rounder",
    description:
      "Basic kinetic pulse defense. Good range, good reliability. Cheap foundation of any build.",
    cost: 20,
    range: 112,
    damage: 3,
    cooldown: 0.48,
    color: "#4caf50",
    damageType: "kinetic",
    projectileSpeed: 460,
    hotkey: "1",
  },
  blaster: {
    id: "blaster",
    name: "Blaster Node",
    role: "Anti-scout",
    description:
      "Very high fire rate. Best against fast, low-health enemies and scout swarms.",
    cost: 40,
    range: 88,
    damage: 1.15,
    cooldown: 0.12,
    color: "#2196f3",
    damageType: "kinetic",
    projectileSpeed: 560,
    hotkey: "2",
  },
  stasis: {
    id: "stasis",
    name: "Stasis Projector",
    role: "Control",
    description:
      "Slows enemies for 2.6s. Deals no damage but creates kill zones for heavy towers.",
    cost: 50,
    range: 132,
    damage: 0,
    cooldown: 1.35,
    color: "#9c27b0",
    damageType: "none",
    effect: "slow",
    hotkey: "3",
  },
  mortar: {
    id: "mortar",
    name: "Mortar Relay",
    role: "Area burst",
    description:
      "Heavy explosive shell. Strong against grouped or slowed enemies; slow fire rate.",
    cost: 80,
    range: 165,
    damage: 15,
    cooldown: 2.15,
    color: "#f44336",
    damageType: "explosive",
    effect: "splash",
    splashRadius: 76,
    projectileSpeed: 320,
    hotkey: "4",
  },
  tesla: {
    id: "tesla",
    name: "Tesla Array",
    role: "Chain damage",
    description:
      "Arcs lightning through nearby enemies. Excellent versus dense swarms.",
    cost: 120,
    range: 102,
    damage: 6,
    cooldown: 0.95,
    color: "#00e5ff",
    damageType: "chain",
    effect: "chain",
    chainMax: 3,
    chainRange: 64,
    hotkey: "5",
  },
  harvester: {
    id: "harvester",
    name: "Eco Harvester",
    role: "Economy",
    description:
      "Must be built on crystals. Generates credits during waves. Invest early, profit later.",
    cost: 60,
    range: 0,
    damage: 0,
    cooldown: 5.0,
    color: "#00e676",
    damageType: "none",
    isEco: true,
    income: 15,
    requiresCrystal: true,
    hotkey: "6",
  },
  railgun: {
    id: "railgun",
    name: "Railgun",
    role: "Piercing sniper",
    description:
      "High-velocity slug punches straight through enemies in a line. Long range, slow rate.",
    cost: 150,
    range: 220,
    damage: 28,
    cooldown: 2.4,
    color: "#ffd740",
    damageType: "kinetic",
    projectileSpeed: 900,
    pierce: 2,
    hotkey: "7",
    unlockRequires: "unlock_railgun",
  },
  flamethrower: {
    id: "flamethrower",
    name: "Pyro Lance",
    role: "Area burn",
    description:
      "Projects a cone of burning plasma. Short range, ignites enemies for sustained DoT.",
    cost: 100,
    range: 92,
    damage: 1.3,
    cooldown: 0.08,
    color: "#ff7043",
    damageType: "fire",
    effect: "burn",
    coneArc: Math.PI / 3,
    hotkey: "8",
    unlockRequires: "unlock_flame",
  },
  shield: {
    id: "shield",
    name: "Aegis Pylon",
    role: "Defensive support",
    description:
      "Emits a protective aura. Enemies in the aura deal reduced breach damage and nearby towers gain damage.",
    cost: 90,
    range: 0,
    damage: 0,
    cooldown: 1,
    color: "#80d8ff",
    damageType: "none",
    auraRadius: 128,
    hotkey: "9",
    unlockRequires: "unlock_shield",
  },
};

export const towerOrder: TowerType[] = [
  "pulse",
  "blaster",
  "stasis",
  "mortar",
  "tesla",
  "harvester",
  "railgun",
  "flamethrower",
  "shield",
];

/**
 * Specialization choices for each tower at level 3.
 * Data-driven — TowerSystem just reads the mod at apply time.
 */
export const towerSpecializations: Record<TowerType, SpecializationTree> = {
  pulse: {
    unlockLevel: 3,
    options: [
      {
        id: "pulse_focus_lens",
        name: "Focus Lens",
        description: "+40% range. Hit targets deeper into their lane.",
        mod: { rangeMul: 1.4 },
      },
      {
        id: "pulse_burst_capacitor",
        name: "Burst Capacitor",
        description: "Every third attack fires a triple burst.",
        mod: { flags: { tripleBurst: true } },
      },
      {
        id: "pulse_signal_marker",
        name: "Signal Marker",
        description: "Marked enemies take +25% damage from drones.",
        mod: { flags: { signalMarker: true } },
      },
    ],
  },
  blaster: {
    unlockLevel: 3,
    options: [
      {
        id: "blaster_twin_barrels",
        name: "Twin Barrels",
        description: "Fires two shots per attack.",
        mod: { damageMul: 1.9 },
      },
      {
        id: "blaster_armor_piercer",
        name: "Armor Piercer",
        description: "Bonus damage against Brutes and Carriers.",
        mod: { flags: { armorPiercer: true } },
      },
      {
        id: "blaster_suppressive_fire",
        name: "Suppressive Fire",
        description: "Small chance to briefly slow enemies.",
        mod: { flags: { suppressiveFire: true } },
      },
    ],
  },
  stasis: {
    unlockLevel: 3,
    options: [
      {
        id: "stasis_deep_freeze",
        name: "Deep Freeze",
        description: "Slow effect becomes stronger and lasts longer.",
        mod: { flags: { deepFreeze: true } },
      },
      {
        id: "stasis_cryo_field",
        name: "Cryo Field",
        description: "Applies slow in a small area around the target.",
        mod: { flags: { cryoField: true } },
      },
      {
        id: "stasis_vulnerability",
        name: "Vulnerability Pulse",
        description: "Slowed enemies take +25% damage from all sources.",
        mod: { flags: { vulnerabilityPulse: true } },
      },
    ],
  },
  mortar: {
    unlockLevel: 3,
    options: [
      {
        id: "mortar_shrapnel",
        name: "Shrapnel Shells",
        description: "+30% splash radius.",
        mod: { splashRadiusMul: 1.3, flags: { shrapnel: true } },
      },
      {
        id: "mortar_armor_breaker",
        name: "Armor Breaker",
        description: "Bonus damage against large enemies.",
        mod: { flags: { armorBreaker: true } },
      },
      {
        id: "mortar_burning_ground",
        name: "Burning Ground",
        description: "Leaves a short-lived damage zone on impact.",
        mod: { flags: { burningGround: true } },
      },
    ],
  },
  tesla: {
    unlockLevel: 3,
    options: [
      {
        id: "tesla_chain_storm",
        name: "Chain Storm",
        description: "+2 chain jumps.",
        mod: { chainMaxAdd: 2, flags: { chainStorm: true } },
      },
      {
        id: "tesla_emp_arc",
        name: "EMP Arc",
        description: "Chance to briefly stun enemies.",
        mod: { flags: { empArc: true } },
      },
      {
        id: "tesla_phase_disruptor",
        name: "Phase Disruptor",
        description: "Can hit phased enemies for reduced damage.",
        mod: { flags: { phaseDisruptor: true } },
      },
    ],
  },
  harvester: {
    unlockLevel: 3,
    options: [
      {
        id: "harvester_deep_extraction",
        name: "Deep Extraction",
        description: "+50% income from this harvester.",
        mod: { incomeMul: 1.5, flags: { deepExtraction: true } },
      },
      {
        id: "harvester_crystal_stabilizer",
        name: "Crystal Stabilizer",
        description: "Crystal yields a bonus pulse of credits each wave end.",
        mod: { flags: { crystalStabilizer: true } },
      },
      {
        id: "harvester_relay_node",
        name: "Relay Node",
        description: "Nearby towers gain +10% fire rate.",
        mod: { flags: { relayNode: true } },
      },
    ],
  },
  railgun: {
    unlockLevel: 3,
    options: [
      {
        id: "railgun_overcharge",
        name: "Overcharge",
        description: "+50% damage, -10% fire rate.",
        mod: { damageMul: 1.5, cooldownMul: 1.1, flags: { overcharge: true } },
      },
      {
        id: "railgun_longbarrel",
        name: "Long Barrel",
        description: "+30% range and +1 pierce.",
        mod: { rangeMul: 1.3, pierceAdd: 1, flags: { longbarrel: true } },
      },
      {
        id: "railgun_marktarget",
        name: "Acquisition Lock",
        description: "Marks hit targets — +30% damage from all sources.",
        mod: { flags: { markTarget: true, signalMarker: true } },
      },
    ],
  },
  flamethrower: {
    unlockLevel: 3,
    options: [
      {
        id: "flame_ignition_boost",
        name: "Ignition Boost",
        description: "Burn damage increased by 60%.",
        mod: { flags: { ignitionBoost: true } },
      },
      {
        id: "flame_napalm_pool",
        name: "Napalm Pool",
        description: "Leaves a short burning pool at target site.",
        mod: { flags: { napalmPool: true } },
      },
      {
        id: "flame_heatwave",
        name: "Heat Wave",
        description: "Wider cone arc; covers flanks.",
        mod: { coneArcMul: 1.45, flags: { heatWave: true } },
      },
    ],
  },
  shield: {
    unlockLevel: 3,
    options: [
      {
        id: "shield_reactive",
        name: "Reactive Armor",
        description: "Enemies within aura deal 50% less breach damage.",
        mod: { flags: { reactiveArmor: true } },
      },
      {
        id: "shield_regen",
        name: "Regen Pulse",
        description: "Pulse every wave end restores 5 Core Integrity per Aegis.",
        mod: { flags: { regenPulse: true } },
      },
      {
        id: "shield_reflect",
        name: "Reflect Field",
        description: "Sappers within aura detonate harmlessly; enemies flicker-stunned.",
        mod: { flags: { reflectField: true } },
      },
    ],
  },
};
