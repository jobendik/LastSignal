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

// ──────────────────────────────────────────────────────────
// Mobile command squads
// Specialized mobile drone squads deployed as command abilities. They give
// the player active map agency without turning the game into a classic RTS:
// no drag-select, no control groups, no production queues — just timed
// tactical beacons that move, reveal, repair, attack, or shield.
// ──────────────────────────────────────────────────────────

/** Base squad cap that applies regardless of tier (across ALL types together). */
export const SQUAD_CAP_BASE = 2;
/** Extra global squad slots gained at each command tier above 1. */
export const SQUAD_CAP_TIER_BONUS = 1;

// Recon — fast, fragile, reveals darkness and exposes hidden strategic points.
// Tuned cheap and re-deployable — Recon is the always-affordable scout that
// players should reach for whenever the map is dark.
export const RECON_COST = 40;
export const RECON_COOLDOWN = 11;
export const RECON_SPEED = 230;
export const RECON_DURATION = 20;
export const RECON_HEALTH = 26;
export const RECON_REVEAL_RADIUS = 230;
export const RECON_INTERACTION_RADIUS = 28;

// Engineer — accelerates capture, repairs, recovers caches faster. The bump
// to 28s duration gives the player a longer field-deploy window for Sector 6
// expansions; capture multiplier stays at 2.2 so paired tower fire still
// matters more than bare-engineer captures.
export const ENGINEER_COST = 70;
export const ENGINEER_COOLDOWN = 22;
export const ENGINEER_SPEED = 135;
export const ENGINEER_DURATION = 28;
export const ENGINEER_HEALTH = 55;
export const ENGINEER_REVEAL_RADIUS = 110;
export const ENGINEER_INTERACTION_RADIUS = 60;
export const ENGINEER_CAPTURE_MULTIPLIER = 2.2;
export const ENGINEER_REPAIR_RATE = 6;

// Strike — combat squad for emergency suppression / hostile structures.
// Slightly bumped duration + lower attack cooldown so a Strike Squad alone
// can credibly chip a rift anchor when paired with tower fire.
export const STRIKE_COST = 110;
export const STRIKE_COOLDOWN = 32;
export const STRIKE_SPEED = 150;
export const STRIKE_DURATION = 24;
export const STRIKE_HEALTH = 75;
export const STRIKE_REVEAL_RADIUS = 130;
export const STRIKE_INTERACTION_RADIUS = 200;
export const STRIKE_DAMAGE = 10;
export const STRIKE_ATTACK_COOLDOWN = 0.50;
export const STRIKE_STRUCTURE_DAMAGE_MUL = 1.7;

// Shield / Support — projects a temporary shielding field around an area.
export const SHIELD_COST = 130;
export const SHIELD_COOLDOWN = 45;
export const SHIELD_SPEED = 110;
export const SHIELD_DURATION = 16;
export const SHIELD_HEALTH = 90;
export const SHIELD_REVEAL_RADIUS = 90;
export const SHIELD_INTERACTION_RADIUS = 168;
export const SHIELD_DAMAGE_REDUCTION = 0.4;
export const SHIELD_SLOW_AMOUNT = 0.35;
/** Hard cap on how much damage reduction Shield Harmonics can push into. */
export const SHIELD_DAMAGE_REDUCTION_MAX = 0.65;

// ──────────────────────────────────────────────────────────
// Squad counterplay & enemy targeting
// Squads aren't full RTS units, so enemies don't fully retarget them — but
// nearby enemies chip them on contact, certain types are extra dangerous, and
// hostile structures (jammers/rifts) materially change squad effectiveness.
// ──────────────────────────────────────────────────────────
/** Pixel radius around a squad center where an enemy contributes contact damage. */
export const SQUAD_CONTACT_DAMAGE_RADIUS = 28;
/** Base contact damage per second from an adjacent enemy. */
export const SQUAD_CONTACT_DAMAGE_PER_SEC = 8;
/** Multiplier on contact damage when the attacker is a Saboteur (anti-squad spike). */
export const SQUAD_SABOTEUR_DAMAGE_MUL = 2.4;
/** Multiplier on contact damage when the attacker is a Sprinter (fast contact). */
export const SQUAD_SPRINTER_DAMAGE_MUL = 1.5;
/** Multiplier on contact damage when the attacker is a Boss (aura pressure on shields). */
export const SQUAD_BOSS_DAMAGE_MUL = 0.5;
/** Pixel radius around a Jammer enemy where squad effectiveness drops. */
export const SQUAD_JAMMER_ENEMY_RADIUS = 80;
/** Multiplier on Jammer-enemy contact damage. */
export const SQUAD_JAMMER_DAMAGE_MUL = 1.2;
/** Pixel radius from a hostile Phantom inside which it acts as a soft "anti-drone" threat. */
export const SQUAD_PHANTOM_RADIUS = 36;

/** While inside a jammer field, squad action speed is multiplied by this (< 1 = slower). */
export const SQUAD_JAMMER_ACTION_PENALTY = 0.5;
/** While inside a jammer field, squad reveal radius is multiplied by this. */
export const SQUAD_JAMMER_REVEAL_PENALTY = 0.5;
/** While inside a rift anchor aura, the squad takes this much HP/s as instability damage. */
export const SQUAD_RIFT_AURA_DPS = 4;

/** Speed multiplier applied while a squad is evacuating (it sprints home). */
export const SQUAD_EVAC_SPEED_MUL = 1.6;
/** How close (px) an evacuating squad must get to a friendly cluster before despawning. */
export const SQUAD_EVAC_ARRIVAL_RADIUS = 36;
/** Fraction of base cooldown returned when a squad evacuates safely. */
export const SQUAD_EVAC_REFUND = 0.5;
