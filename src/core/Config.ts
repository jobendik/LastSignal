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

// ──────────────────────────────────────────────────────────
// Strategic map points
// Capturable nodes (signal node, radar dish, data cache, abandoned turret) and
// hostile structures (rift anchor, jammer) live on the grid. They give the
// large-format maps a reason to expand beyond economy: the player chases
// scouting, suppression, and tactical rewards.
// ──────────────────────────────────────────────────────────
/** Default seconds it takes to fully capture a neutral strategic point. */
export const CAPTURE_TIME_SECONDS = 7;
/** Pixel radius around a point where enemy presence pauses/reverses capture. */
export const CAPTURE_CONTEST_RADIUS = 96;
/** Capture progress drains per second while contested by enemies. */
export const CAPTURE_DECAY_PER_SECOND = 0.35;

/** Coverage radius (cells) granted by a captured signal node. */
export const SIGNAL_NODE_RADIUS_CELLS = 5;
/** Reveal radius (cells) granted by a captured radar dish in darkness sectors. */
export const RADAR_REVEAL_BONUS_CELLS = 14;

/** One-time credit reward for recovering a data cache. */
export const DATA_CACHE_CREDIT_REWARD = 90;
/** One-time research reward for recovering a data cache (also given to the run profile). */
export const DATA_CACHE_RESEARCH_REWARD = 1;

/** Health pool of a Rift Anchor enemy structure. */
export const RIFT_ANCHOR_HEALTH = 320;
/** Seconds between rift-anchor minor spawns / aura pulses. */
export const RIFT_ANCHOR_PULSE_INTERVAL = 9;
/** Credit reward for destroying a Rift Anchor. */
export const RIFT_ANCHOR_DESTROY_REWARD = 110;
/** Aura radius (px) around a rift anchor that buffs enemies inside it. */
export const RIFT_ANCHOR_AURA_RADIUS = 200;

/** Health pool of a Jammer enemy structure. */
export const JAMMER_HEALTH = 220;
/** Effect radius (cells) of a jammer (suppresses signal/radar/tower fire). */
export const JAMMER_RADIUS_CELLS = 6;
/** Credit reward for destroying a Jammer. */
export const JAMMER_DESTROY_REWARD = 70;

/**
 * Tower-targeting priority for hostile structures. Higher = more attractive.
 * < 1 means towers prefer real enemies and only swing onto a structure when no
 * regular threat is in range.
 */
export const STRUCTURE_TARGET_PRIORITY = 0.35;
/** Auto-finder for an Abandoned Turret: shooting cooldown in seconds. */
export const ABANDONED_TURRET_COOLDOWN = 1.1;
/** Damage of a captured Abandoned Turret per shot. */
export const ABANDONED_TURRET_DAMAGE = 12;
/** Range (px) of a captured Abandoned Turret. */
export const ABANDONED_TURRET_RANGE = 170;

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
