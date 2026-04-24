import type { DroneDefinition, DroneType } from "../core/Types";

export const droneDefinitions: Record<DroneType, DroneDefinition> = {
  hunter: {
    id: "hunter",
    name: "Hunter Drone",
    role: "Mobile attack unit",
    description:
      "Seeks out and attacks the nearest visible enemy. Effective against stragglers.",
    cost: 90,
    damage: 1.5,
    range: 112,
    cooldown: 0.34,
    speed: 92,
    color: "#00bcd4",
  },
  scanner: {
    id: "scanner",
    name: "Scanner Drone",
    role: "Anti-phase support",
    description:
      "Reveals Phantoms and extends their visible windows. Shares targeting intel with towers.",
    cost: 110,
    damage: 0,
    range: 140,
    cooldown: 0.8,
    speed: 80,
    color: "#ffeb3b",
  },
  guardian: {
    id: "guardian",
    name: "Guardian Drone",
    role: "Core defender",
    description:
      "Orbits the core, intercepting enemies that break through and reducing core damage.",
    cost: 130,
    damage: 3,
    range: 82,
    cooldown: 0.55,
    speed: 70,
    color: "#4caf50",
  },
};

export const droneOrder: DroneType[] = ["hunter", "scanner", "guardian"];
