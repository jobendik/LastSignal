import type { DifficultyDefinition, DifficultyId } from "../core/Types";

export const difficultyDefinitions: Record<DifficultyId, DifficultyDefinition> = {
  recruit: {
    id: "recruit",
    name: "Recruit",
    description: "Generous core HP and tame anomalies. Learn the ropes.",
    accentColor: "#4caf50",
    enemyHpMul: 0.75,
    enemySpeedMul: 0.9,
    rewardMul: 1.0,
    coreIntegrityMul: 1.35,
    researchMul: 0.75,
  },
  standard: {
    id: "standard",
    name: "Standard",
    description: "The classic LAST SIGNAL tuning. Balanced threat and reward.",
    accentColor: "#66fcf1",
    enemyHpMul: 1,
    enemySpeedMul: 1,
    rewardMul: 1,
    coreIntegrityMul: 1,
    researchMul: 1,
  },
  veteran: {
    id: "veteran",
    name: "Veteran",
    description: "Faster, tougher anomalies. Extra research for the survivors.",
    accentColor: "#ffb300",
    enemyHpMul: 1.35,
    enemySpeedMul: 1.1,
    rewardMul: 1.1,
    coreIntegrityMul: 0.85,
    researchMul: 1.5,
  },
  nightmare: {
    id: "nightmare",
    name: "Nightmare",
    description: "Brutal. One bad placement ends the run. Maximum research yield.",
    accentColor: "#f44336",
    enemyHpMul: 1.8,
    enemySpeedMul: 1.25,
    rewardMul: 1.2,
    coreIntegrityMul: 0.65,
    researchMul: 2.25,
  },
};

export const difficultyOrder: DifficultyId[] = [
  "recruit",
  "standard",
  "veteran",
  "nightmare",
];
