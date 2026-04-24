import type { MetaNode } from "../core/Types";

/**
 * Meta progression tree. Spend research points earned from runs/achievements
 * to unlock permanent bonuses, towers, drones, difficulties, and endless mode.
 */
export const metaNodes: MetaNode[] = [
  // Tier 1 — starter unlocks
  {
    id: "starting_credits_1",
    name: "Field Reserves I",
    description: "Start each run with +40 credits.",
    cost: 3,
    effect: { startingCreditsAdd: 40 },
    tier: 1,
  },
  {
    id: "core_hp_1",
    name: "Core Plating I",
    description: "+10 Maximum Core Integrity.",
    cost: 3,
    effect: { coreMaxAdd: 10 },
    tier: 1,
  },
  {
    id: "harvester_boost",
    name: "Extraction Enhancement",
    description: "Harvesters produce +10% credits.",
    cost: 4,
    effect: { harvesterIncomeMul: 1.1 },
    tier: 1,
  },
  {
    id: "sell_bonus",
    name: "Salvage Team",
    description: "Sell refund +10% (stacks with upgrades).",
    cost: 4,
    effect: { sellRefundAdd: 0.1 },
    tier: 1,
  },

  // Tier 2 — tower unlocks
  {
    id: "unlock_railgun",
    name: "Unlock: Railgun",
    description: "Unlocks the Railgun tower — piercing precision shots.",
    cost: 10,
    requires: ["core_hp_1"],
    effect: { unlocksTower: "railgun" },
    tier: 2,
  },
  {
    id: "unlock_flame",
    name: "Unlock: Pyro Lance",
    description: "Unlocks the Pyro Lance — short-range burn cone.",
    cost: 10,
    requires: ["starting_credits_1"],
    effect: { unlocksTower: "flamethrower" },
    tier: 2,
  },
  {
    id: "unlock_shield",
    name: "Unlock: Aegis Pylon",
    description: "Unlocks the Aegis Pylon — defensive aura support.",
    cost: 12,
    requires: ["harvester_boost"],
    effect: { unlocksTower: "shield" },
    tier: 2,
  },
  {
    id: "unlock_strike",
    name: "Unlock: Strike Drone",
    description: "Unlocks the heavy-damage Strike Drone.",
    cost: 8,
    requires: ["sell_bonus"],
    effect: { unlocksDrone: "strike" },
    tier: 2,
  },

  // Tier 3 — difficulty + sector + endless
  {
    id: "starting_credits_2",
    name: "Field Reserves II",
    description: "Start each run with +80 credits (total).",
    cost: 8,
    requires: ["starting_credits_1"],
    effect: { startingCreditsAdd: 40 },
    tier: 3,
  },
  {
    id: "core_hp_2",
    name: "Core Plating II",
    description: "+15 Maximum Core Integrity (total +25).",
    cost: 8,
    requires: ["core_hp_1"],
    effect: { coreMaxAdd: 15 },
    tier: 3,
  },
  {
    id: "tower_damage",
    name: "Weapon Calibration",
    description: "All towers deal +5% damage.",
    cost: 10,
    requires: ["unlock_railgun", "unlock_flame"],
    effect: { towerDamageMul: 1.05 },
    tier: 3,
  },
  {
    id: "drone_edge",
    name: "Drone Edge",
    description: "+1 drone damage.",
    cost: 6,
    requires: ["unlock_strike"],
    effect: { droneDamageAdd: 1 },
    tier: 3,
  },

  // Tier 4 — endgame
  {
    id: "extra_reward_choice",
    name: "Cognitive Load",
    description: "Reward choices show +1 option (4 instead of 3).",
    cost: 15,
    requires: ["tower_damage"],
    effect: { rewardChoiceExtra: 1 },
    tier: 4,
  },
  {
    id: "unlock_endless",
    name: "Unlock: Endless Mode",
    description: "Unlocks Endless mode on all cleared sectors.",
    cost: 12,
    requires: ["core_hp_2"],
    effect: { unlocksEndless: true },
    tier: 4,
  },
  {
    id: "unlock_nightmare",
    name: "Unlock: Nightmare",
    description: "Unlocks Nightmare difficulty for all sectors.",
    cost: 20,
    requires: ["extra_reward_choice", "unlock_endless"],
    effect: { unlocksDifficulty: "nightmare" },
    tier: 4,
  },
];
