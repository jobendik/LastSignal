import type { AchievementDefinition } from "../core/Types";

export const achievementDefinitions: AchievementDefinition[] = [
  // ──────────────────────────────────────────────
  // FIRST-TIME MILESTONES
  // ──────────────────────────────────────────────
  {
    id: "first_blood",
    name: "First Blood",
    description: "Destroy your first anomaly.",
    icon: "◎",
    researchReward: 1,
  },
  {
    id: "sector_cleared",
    name: "Signal Stabilized",
    description: "Clear a sector for the first time.",
    icon: "★",
    researchReward: 2,
  },
  {
    id: "boss_down",
    name: "Titan Slayer",
    description: "Defeat a boss anomaly.",
    icon: "☠",
    researchReward: 3,
  },
  {
    id: "first_specialization",
    name: "Specialized",
    description: "Unlock a tower specialization.",
    icon: "⬡",
    researchReward: 2,
  },
  {
    id: "first_relay",
    name: "Signal Extended",
    description: "Deploy your first relay core.",
    icon: "⊕",
    researchReward: 2,
  },
  {
    id: "first_squad",
    name: "Boots on the Ground",
    description: "Deploy your first mobile squad.",
    icon: "▶",
    researchReward: 2,
  },
  {
    id: "first_capture",
    name: "Foothold Secured",
    description: "Capture your first strategic point.",
    icon: "⚑",
    researchReward: 2,
  },
  // ──────────────────────────────────────────────
  // WAVE & COMBAT
  // ──────────────────────────────────────────────
  {
    id: "flawless_wave",
    name: "Flawless Wave",
    description: "Finish a wave without losing any core integrity.",
    icon: "✦",
    researchReward: 2,
  },
  {
    id: "flawless_5",
    name: "Iron Signal",
    description: "Complete 5 consecutive waves without taking any core damage.",
    icon: "✦✦",
    researchReward: 4,
  },
  {
    id: "kill_100",
    name: "Hundred Kills",
    description: "Kill 100 enemies in a single run.",
    icon: "💀",
    researchReward: 2,
  },
  {
    id: "kill_500",
    name: "Extinction Protocol",
    description: "Kill 500 enemies in a single run.",
    icon: "💀💀",
    researchReward: 5,
  },
  {
    id: "kill_leviathan",
    name: "Leviathan Down",
    description: "Defeat the Leviathan.",
    icon: "◈",
    researchReward: 3,
  },
  {
    id: "kill_harbinger",
    name: "Harbinger Silenced",
    description: "Defeat the Harbinger.",
    icon: "◈",
    researchReward: 4,
  },
  {
    id: "destroy_rift",
    name: "Rift Suppressed",
    description: "Destroy a rift anchor structure.",
    icon: "⟁",
    researchReward: 3,
  },
  // ──────────────────────────────────────────────
  // ECONOMY & CONSTRUCTION
  // ──────────────────────────────────────────────
  {
    id: "economy_king",
    name: "Harvest King",
    description: "Earn 1000 credits in a single run.",
    icon: "$",
    researchReward: 2,
  },
  {
    id: "tower_collector",
    name: "Grid Architect",
    description: "Build five different tower types in one run.",
    icon: "▣",
    researchReward: 2,
  },
  {
    id: "build_all_towers",
    name: "Arsenal Complete",
    description: "Build every tower type in a single run.",
    icon: "▦",
    researchReward: 6,
  },
  {
    id: "relay_network",
    name: "Network Established",
    description: "Deploy 3 relay cores in a single run.",
    icon: "⊕⊕⊕",
    researchReward: 3,
  },
  // ──────────────────────────────────────────────
  // ADVANCED COMMAND
  // ──────────────────────────────────────────────
  {
    id: "all_squads",
    name: "Full Spectrum Command",
    description: "Deploy all 4 squad types in a single run.",
    icon: "◈",
    researchReward: 4,
  },
  {
    id: "command_tier_3",
    name: "High Command",
    description: "Reach Command Tier 3.",
    icon: "⬆",
    researchReward: 4,
  },
  // ──────────────────────────────────────────────
  // SECTOR PROGRESSION
  // ──────────────────────────────────────────────
  {
    id: "all_sectors_cleared",
    name: "The Signal Holds",
    description: "Clear all 4 main campaign sectors.",
    icon: "★★★★",
    researchReward: 8,
  },
  {
    id: "void_cleared",
    name: "Into the Void",
    description: "Clear Sector 5 — Void.",
    icon: "∅",
    researchReward: 4,
  },
  {
    id: "sector_6_cleared",
    name: "Expanse Secured",
    description: "Clear Sector 6 — Fractured Expanse.",
    icon: "★★★★★★",
    researchReward: 5,
  },
  {
    id: "sector_7_cleared",
    name: "Blackout Ended",
    description: "Clear Sector 7 — Blackout Array.",
    icon: "★★★★★★★",
    researchReward: 8,
  },
  // ──────────────────────────────────────────────
  // DIFFICULTY
  // ──────────────────────────────────────────────
  {
    id: "veteran_clear",
    name: "Hardened Operator",
    description: "Clear a sector on Veteran difficulty.",
    icon: "⬡",
    researchReward: 4,
  },
  {
    id: "nightmare_clear",
    name: "Nightmare Protocol",
    description: "Clear a sector on Nightmare difficulty.",
    icon: "☣",
    researchReward: 6,
  },
  // ──────────────────────────────────────────────
  // ENDLESS MODE
  // ──────────────────────────────────────────────
  {
    id: "endless_10",
    name: "Endless — 10",
    description: "Reach wave 10 in Endless mode.",
    icon: "∞",
    researchReward: 4,
  },
  {
    id: "endless_25",
    name: "Endless — 25",
    description: "Reach wave 25 in Endless mode.",
    icon: "∞",
    researchReward: 6,
  },
  {
    id: "endless_50",
    name: "Endless — 50",
    description: "Reach wave 50 in Endless mode.",
    icon: "∞∞",
    researchReward: 10,
  },
  // ──────────────────────────────────────────────
  // META-PROGRESSION
  // ──────────────────────────────────────────────
  {
    id: "prestige_1",
    name: "Second Awakening",
    description: "Complete your first prestige.",
    icon: "✵",
    researchReward: 10,
  },
];
