/**
 * Global tuning constants. Gameplay-specific numbers live in /data/* whenever possible.
 */
export const TILE_SIZE = 32;
export const COLS = 32;
export const ROWS = 22;
export const VIEW_WIDTH = TILE_SIZE * COLS;   // 1024
export const VIEW_HEIGHT = TILE_SIZE * ROWS;  // 704

export const MAX_DT = 1 / 30; // cap delta-time to avoid spiral-of-death
export const SPEED_MULTIPLIERS = [1, 2, 3] as const;
export type SpeedMultiplier = (typeof SPEED_MULTIPLIERS)[number];

export const PARTICLE_CAP = 500;
export const PROJECTILE_CAP = 400;
export const FLOATING_TEXT_CAP = 120;

export const STARTING_DRONE_COST = 90;
export const DRONE_COST_SCALING = 1.35;
export const MAX_DRONES = 6;

export const EARLY_START_BONUS = 25;

export const UPGRADE_COST_BASE_MUL = 1.8;

export const SELL_REFUND_DEFAULT = 0.5;

export const REWARD_WAVES = new Set<number>([2, 4, 6, 8, 10, 12, 14]); // wave indices (1-based) that grant reward choice

export const COLOR = {
  accent: "#66fcf1",
  accentDim: "#45a29e",
  warning: "#ffb300",
  danger: "#f44336",
  good: "#4caf50",
  bg: "#0b0c10",
  grid: "rgba(102, 252, 241, 0.08)",
  gridStrong: "rgba(102, 252, 241, 0.18)",
  core: "#66fcf1",
  text: "#c5c6c7",
};
