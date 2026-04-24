import type { UpgradeDefinition } from "../core/Types";

/**
 * Roguelite signal upgrades. At least 12. Effects are applied by UpgradeSystem
 * via the game.upgradeState aggregate and sampled by Tower/Drone/Harvester logic.
 */
export const upgradeDefinitions: UpgradeDefinition[] = [
  {
    id: "overclock_protocol",
    name: "Overclock Protocol",
    description: "All towers fire 10% faster.",
    target: "global",
    effect: { towerFireRateMul: 1.1 },
  },
  {
    id: "drone_command_link",
    name: "Drone Command Link",
    description: "Drones gain +1 damage and +20 range.",
    target: "drone",
    effect: { droneDamageAdd: 1, droneRangeAdd: 20 },
  },
  {
    id: "crystal_resonance",
    name: "Crystal Resonance",
    description: "Harvesters generate 25% more credits.",
    target: "economy",
    effect: { harvesterIncomeMul: 1.25 },
  },
  {
    id: "stasis_amplifier",
    name: "Stasis Amplifier",
    description: "Slowed enemies take 20% more damage.",
    target: "stasis",
    effect: { slowedEnemyDamageMul: 1.2 },
  },
  {
    id: "emergency_core_shield",
    name: "Emergency Core Shield",
    description: "Immediately restore 20 Core Integrity.",
    target: "core",
    effect: { coreIntegrityAdd: 20 },
  },
  {
    id: "tesla_conductor",
    name: "Tesla Conductor",
    description: "Tesla chains jump one extra time.",
    target: "tesla",
    effect: { teslaChainAdd: 1 },
  },
  {
    id: "mortar_payload",
    name: "Mortar Payload",
    description: "Mortar splash radius increased by 20%.",
    target: "mortar",
    effect: { mortarSplashMul: 1.2 },
  },
  {
    id: "scanner_pulse",
    name: "Scanner Pulse",
    description: "Phased enemies are visible 40% longer.",
    target: "global",
    effect: { phantomVisibleBonus: 0.4 },
  },
  {
    id: "pulse_calibration",
    name: "Pulse Calibration",
    description: "Pulse towers gain +15% range and +15% damage.",
    target: "pulse",
    effect: {
      specificTowerDamageMul: { type: "pulse", mul: 1.15 },
      specificTowerRangeMul: { type: "pulse", mul: 1.15 },
    },
  },
  {
    id: "rapid_construction",
    name: "Rapid Construction",
    description: "New towers cost 10% less.",
    target: "economy",
    effect: { towerBuildCostMul: 0.9 },
  },
  {
    id: "salvage_protocol",
    name: "Salvage Protocol",
    description: "Selling towers refunds 70% instead of 50%.",
    target: "economy",
    effect: { sellRefundMul: 0.7 },
  },
  {
    id: "last_stand_circuit",
    name: "Last Stand Circuit",
    description:
      "When core integrity drops below 25%, all towers fire 30% faster.",
    target: "global",
    effect: { lowCoreFireRateMul: 1.3, lowCoreThreshold: 0.25 },
  },
  {
    id: "focus_array",
    name: "Focus Array",
    description: "Blaster damage +25%.",
    target: "blaster",
    effect: { specificTowerDamageMul: { type: "blaster", mul: 1.25 } },
  },
  {
    id: "heavy_munitions",
    name: "Heavy Munitions",
    description: "Mortar damage +20%.",
    target: "mortar",
    effect: { specificTowerDamageMul: { type: "mortar", mul: 1.2 } },
  },
  {
    id: "global_range",
    name: "Signal Amplifier",
    description: "All towers gain +6 range.",
    target: "global",
    effect: { towerRangeAdd: 6 },
  },
];
