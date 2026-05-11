import type { ResearchNode } from "../core/Types";

export const researchNodes: ResearchNode[] = [
  // ──────────────────────────────────────────────
  // TIER I — Foundation
  // ──────────────────────────────────────────────
  {
    id: "logistics_1",
    name: "Logistics I",
    description: "+25 starting credits for every sector.",
    cost: 3,
    tier: 1,
    effect: { startingCreditsAdd: 25 },
  },
  {
    id: "reinforced_core",
    name: "Reinforced Core",
    description: "+25 core integrity on every run.",
    cost: 4,
    tier: 1,
    effect: { coreIntegrityAdd: 25 },
  },

  // ──────────────────────────────────────────────
  // TIER II — Upgrades
  // ──────────────────────────────────────────────
  {
    id: "logistics_2",
    name: "Logistics II",
    description: "+50 starting credits (requires Logistics I).",
    cost: 5,
    tier: 2,
    requires: ["logistics_1"],
    effect: { startingCreditsAdd: 50 },
  },
  {
    id: "calibrated_optics",
    name: "Calibrated Optics",
    description: "All towers gain +12 range.",
    cost: 4,
    tier: 2,
    effect: { towerRangeAdd: 12 },
  },
  {
    id: "plasma_metallurgy",
    name: "Plasma Metallurgy",
    description: "All towers deal +15% damage.",
    cost: 6,
    tier: 2,
    effect: { towerDamageMul: 1.15 },
  },
  {
    id: "deep_mining",
    name: "Deep Mining",
    description: "Harvesters produce +25% more income.",
    cost: 5,
    tier: 2,
    effect: { harvesterIncomeMul: 1.25 },
  },
  {
    id: "unlock_railgun",
    name: "Railgun Prototype",
    description: "Unlock the Railgun tower in the build menu.",
    cost: 6,
    tier: 2,
    effect: { unlocksTower: "railgun" },
  },
  {
    id: "unlock_flamer",
    name: "Thermal Projector",
    description: "Unlock the Flamer tower.",
    cost: 5,
    tier: 2,
    effect: { unlocksTower: "flamer" },
  },
  {
    id: "unlock_barrier",
    name: "Barrier Matrix",
    description: "Unlock the Barrier Node tower.",
    cost: 5,
    tier: 2,
    effect: { unlocksTower: "barrier" },
  },
  {
    id: "bountyful",
    name: "Bountyful Hunt",
    description: "+15% credits earned from kills.",
    cost: 4,
    tier: 2,
    effect: { rewardMul: 1.15 },
  },
  {
    id: "fortified_signal",
    name: "Fortified Signal",
    description: "+50 core integrity on every run (requires Reinforced Core).",
    cost: 6,
    tier: 2,
    requires: ["reinforced_core"],
    effect: { coreIntegrityAdd: 50 },
  },
  {
    id: "unlock_amplifier",
    name: "Signal Amplifier Array",
    description: "Unlock the Amplifier tower (buffs adjacent towers).",
    cost: 5,
    tier: 2,
    requires: ["calibrated_optics"],
    effect: { unlocksTower: "amplifier" },
  },
  {
    id: "unlock_snare",
    name: "Disruption Snare",
    description: "Unlock the Snare tower (slows and marks targets).",
    cost: 4,
    tier: 2,
    requires: ["logistics_1"],
    effect: { unlocksTower: "snare" },
  },

  // ──────────────────────────────────────────────
  // TIER III — Mastery
  // ──────────────────────────────────────────────
  {
    id: "unlock_endless",
    name: "Endless Protocol",
    description: "Unlock Endless mode on cleared sectors.",
    cost: 10,
    tier: 3,
    requires: ["plasma_metallurgy", "reinforced_core"],
    effect: { unlocksMode: "endless" },
  },
  {
    id: "logistics_3",
    name: "Logistics III",
    description: "+75 starting credits (requires Logistics II and Bountyful Hunt).",
    cost: 8,
    tier: 3,
    requires: ["logistics_2", "bountyful"],
    effect: { startingCreditsAdd: 75 },
  },
  {
    id: "advanced_arsenal",
    name: "Advanced Arsenal",
    description: "All towers deal an additional +20% damage.",
    cost: 9,
    tier: 3,
    requires: ["plasma_metallurgy"],
    effect: { towerDamageMul: 1.2 },
  },
  {
    id: "precision_optics",
    name: "Precision Optics",
    description: "All towers gain +20 range.",
    cost: 7,
    tier: 3,
    requires: ["calibrated_optics"],
    effect: { towerRangeAdd: 20 },
  },
  {
    id: "deep_reserves",
    name: "Deep Reserves",
    description: "Harvesters produce +25% more income (stacks with Deep Mining).",
    cost: 8,
    tier: 3,
    requires: ["deep_mining"],
    effect: { harvesterIncomeMul: 1.25 },
  },
  {
    id: "supply_chain",
    name: "Supply Chain",
    description: "+15% credits earned from kills (stacks with Bountyful Hunt).",
    cost: 7,
    tier: 3,
    requires: ["bountyful"],
    effect: { rewardMul: 1.15 },
  },
  {
    id: "unlock_overclock",
    name: "Overclock Station",
    description: "Unlock the Overclock tower (temporarily boosts adjacent tower fire rate).",
    cost: 8,
    tier: 3,
    requires: ["unlock_amplifier", "unlock_flamer"],
    effect: { unlocksTower: "overclock" },
  },

  // ──────────────────────────────────────────────
  // TIER II — Mechanical (non-stat) bonuses
  // ──────────────────────────────────────────────
  {
    id: "reinforced_construction",
    name: "Reinforced Construction",
    description: "All towers gain +30% max HP. Saboteurs and rift pulses sting less.",
    cost: 5,
    tier: 2,
    effect: { towerHpMul: 1.3 },
  },
  {
    id: "salvage_protocol",
    name: "Salvage Protocol",
    description: "Recover +2 credits from every enemy kill (stacks with kill rewards).",
    cost: 5,
    tier: 2,
    effect: { creditsPerKill: 2 },
  },
  {
    id: "squad_bandwidth_research",
    name: "Tactical Bandwidth",
    description: "+1 global squad slot. Field one more squad at any time.",
    cost: 6,
    tier: 2,
    effect: { squadCapAdd: 1 },
  },

  // ──────────────────────────────────────────────
  // TIER III — Mechanical capstones
  // ──────────────────────────────────────────────
  {
    id: "wave_bounty_network",
    name: "Wave Bounty Network",
    description: "Per-wave completion bonus +30%. Compounds with kill rewards.",
    cost: 8,
    tier: 3,
    requires: ["bountyful"],
    effect: { waveRewardMul: 1.3 },
  },
  {
    id: "rapid_capacitors",
    name: "Rapid Capacitors",
    description: "All towers fire 12% faster. Stacks multiplicatively with upgrades.",
    cost: 8,
    tier: 3,
    requires: ["plasma_metallurgy"],
    effect: { towerFireRateMul: 1.12 },
  },
];
