import type { AchievementDefinition } from "../core/Types";

export const achievementDefinitions: AchievementDefinition[] = [
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
    id: "flawless_wave",
    name: "Flawless Wave",
    description: "Finish a wave without losing any core integrity.",
    icon: "✦",
    researchReward: 2,
  },
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
    id: "nightmare_clear",
    name: "Nightmare Protocol",
    description: "Clear a sector on Nightmare difficulty.",
    icon: "☣",
    researchReward: 6,
  },
];
