/**
 * Global tuning constants. Gameplay-specific numbers live in /data/* whenever possible.
 */
export const TILE_SIZE = 32;

/** Default grid dimensions (used by legacy sectors that don't specify cols/rows). */
export const DEFAULT_COLS = 32;
export const DEFAULT_ROWS = 22;
/** Backward-compat aliases — systems that only reference COLS/ROWS still compile.
 *  At runtime, always prefer GridSystem.cols / GridSystem.rows for the active sector. */
export const COLS = DEFAULT_COLS;
export const ROWS = DEFAULT_ROWS;

/** Maximum grid dimensions — used for pre-allocated buffer sizing. */
export const MAX_COLS = 80;
export const MAX_ROWS = 56;

/** Viewport (canvas logical) size — independent of world/map size. */
export const VIEW_WIDTH  = 1024;
export const VIEW_HEIGHT = 704;

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

// ──────────────────────────────────────────────────────────
// Signal / Relay network
// Buildable territory radiates from the primary core and from each relay
// core. Tower & harvester placement is gated by these radii so the large
// map becomes meaningful expansion territory rather than free real estate.
// ──────────────────────────────────────────────────────────
/**
 * Radius (in cells) within which the player can build around the primary core.
 * Sized so legacy 32×22 sectors stay playable end-to-end without relays, while
 * the 64×44 Fractured Expanse only has its inner ring of crystals reachable
 * from the start.
 */
export const MAIN_CORE_SIGNAL_RADIUS_CELLS = 11;
/** Radius (in cells) within which the player can build around each deployed relay core. */
export const RELAY_CORE_SIGNAL_RADIUS_CELLS = 8;
/** Max distance (in cells) a relay core may be deployed from the existing signal network. */
export const RELAY_DEPLOY_RADIUS_CELLS = 11;
/** Minimum spacing (in cells) between two core cluster centers. */
export const MIN_RELAY_SPACING_CELLS = 6;
/** Minimum distance (in cells) a relay must be from any spawner. */
export const MIN_RELAY_TO_SPAWNER_CELLS = 3;

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
