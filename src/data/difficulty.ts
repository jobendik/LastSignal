import type { DifficultyDefinition, DifficultyId } from "../core/Types";

export const difficultyDefinitions: Record<DifficultyId, DifficultyDefinition> = {
  cadet: {
    id: "cadet",
    name: "Cadet",
    description: "Gentler start. Enemies 30% weaker, 20% more credits. Perfect for learning.",
    hpMul: 0.7,
    speedMul: 0.95,
    rewardMul: 1.2,
    coreIntegrityMul: 1.2,
    color: "#4caf50",
  },
  operative: {
    id: "operative",
    name: "Operative",
    description: "Standard difficulty. Balanced tuning — the authored experience.",
    hpMul: 1.0,
    speedMul: 1.0,
    rewardMul: 1.0,
    coreIntegrityMul: 1.0,
    color: "#66fcf1",
  },
  veteran: {
    id: "veteran",
    name: "Veteran",
    description: "For experienced signal-keepers. +30% enemy HP, -10% rewards.",
    hpMul: 1.3,
    speedMul: 1.05,
    rewardMul: 0.9,
    coreIntegrityMul: 0.9,
    color: "#ffb300",
  },
  nightmare: {
    id: "nightmare",
    name: "Nightmare",
    description: "Brutal. +60% HP, +10% speed, -25% rewards. Only for the fearless.",
    hpMul: 1.6,
    speedMul: 1.1,
    rewardMul: 0.75,
    coreIntegrityMul: 0.75,
    color: "#f44336",
  },
};

export const difficultyOrder: DifficultyId[] = ["cadet", "operative", "veteran", "nightmare"];
