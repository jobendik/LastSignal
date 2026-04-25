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
    role: "Long-range sniper",
    description:
      "Devastating single shot with massive range. Slow fire rate. Good vs Juggernauts.",
    cost: 150,
    range: 260,
    damage: 42,
    cooldown: 2.6,
    color: "#ffeb3b",
    damageType: "kinetic",
    projectileSpeed: 900,
    hotkey: "7",
  },
  flamer: {
    id: "flamer",
    name: "Flamer",
    role: "Short-range sweep",
    description:
      "Emits a continuous flame cone. Melts Swarm and Scout waves at short range.",
    cost: 70,
    range: 74,
    damage: 1.8,
    cooldown: 0.09,
    color: "#ff6e40",
    damageType: "energy",
    projectileSpeed: 260,
    hotkey: "8",
  },
  barrier: {
    id: "barrier",
    name: "Barrier Node",
    role: "Defensive shield",
    description:
      "Pulses a defensive field. Reduces incoming breach damage to the core while active.",
    cost: 90,
    range: 120,
    damage: 0,
    cooldown: 0.6,
    color: "#80d8ff",
    damageType: "none",
    effect: "slow",
    hotkey: "9",
  },
  amplifier: {
    id: "amplifier",
    name: "Amplifier",
    role: "Support booster",
    description:
      "Doesn't fire. Boosts all towers within 1 tile by +15% damage. Stack strategically.",
    cost: 110,
    range: 48,
    damage: 0,
    cooldown: 99999,
    color: "#ff6d00",
    damageType: "none",
    hotkey: "0",
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
  "flamer",
  "barrier",
  "amplifier",
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
        id: "stasis_singularity",
        name: "Singularity Field",
        description: "Creates a gravity well that pulls nearby enemies into the target point.",
        mod: { flags: { singularity: true } },
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
        id: "railgun_heavy_slug",
        name: "Heavy Slug",
        description: "+40% damage; slightly longer cooldown.",
        mod: { damageMul: 1.4, cooldownMul: 1.08 },
      },
      {
        id: "railgun_overcharge",
        name: "Overcharge",
        description: "+25% range, +15% damage.",
        mod: { rangeMul: 1.25, damageMul: 1.15 },
      },
      {
        id: "railgun_piercing_round",
        name: "Piercing Round",
        description: "Rounds pierce through the first target.",
        mod: { flags: { armorPiercer: true } },
      },
    ],
  },
  flamer: {
    unlockLevel: 3,
    options: [
      {
        id: "flamer_wide_cone",
        name: "Wide Cone",
        description: "+20% range.",
        mod: { rangeMul: 1.2 },
      },
      {
        id: "flamer_scorch",
        name: "Scorch",
        description: "Leaves a short burning ground on impact.",
        mod: { flags: { burningGround: true } },
      },
      {
        id: "flamer_overburn",
        name: "Overburn",
        description: "+25% damage on slowed targets.",
        mod: { flags: { vulnerabilityPulse: true } },
      },
    ],
  },
  barrier: {
    unlockLevel: 3,
    options: [
      {
        id: "barrier_reinforce",
        name: "Reinforce",
        description: "+30% range on the barrier field.",
        mod: { rangeMul: 1.3 },
      },
      {
        id: "barrier_reflect",
        name: "Deflector Grid",
        description: "Projects a shield over the core, reducing each breach by 1.",
        mod: { flags: { deflectorGrid: true } },
      },
      {
        id: "barrier_stasis_core",
        name: "Stasis Core",
        description: "Enemies inside are briefly slowed.",
        mod: { flags: { cryoField: true } },
      },
    ],
  },
  amplifier: {
    unlockLevel: 3,
    options: [
      {
        id: "amplifier_overdrive",
        name: "Overdrive Array",
        description: "Boost radius extends to 2 tiles. More towers benefit.",
        mod: { rangeMul: 2.0 },
      },
      {
        id: "amplifier_resonance",
        name: "Resonance Core",
        description: "+25% damage boost instead of +15%.",
        mod: { flags: { resonanceCore: true } },
      },
      {
        id: "amplifier_fire_rate",
        name: "Overclock",
        description: "Also boosts adjacent tower fire rate by +10%.",
        mod: { flags: { overclockAdjacent: true } },
      },
    ],
  },
};
