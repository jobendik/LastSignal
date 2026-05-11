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
// Relay vulnerability & specialisation
// Signal Relays are the standard expandable node; Hardened Relays trade
// smaller coverage for a much larger HP pool, functioning as a mini-fort.
// Both types take damage when enemies breach to their cluster and are
// permanently destroyed at 0 HP (with a salvage credit refund).
// ──────────────────────────────────────────────────────────
/** HP pool for a standard Signal Relay. */
export const RELAY_MAX_HP = 120;
/** HP pool for a Hardened Relay variant. */
export const HARDENED_RELAY_MAX_HP = 280;
/** Signal coverage radius (cells) for the Hardened Relay variant. */
export const HARDENED_RELAY_SIGNAL_RADIUS_CELLS = 5;
/** Cost multiplier applied to the Hardened Relay variant. */
export const HARDENED_RELAY_COST_MULTIPLIER = 1.4;
/** Fraction of the relay's original cost refunded when it is destroyed. */
export const RELAY_SALVAGE_FRACTION = 0.55;
/** Passive range bonus (multiplicative, per relay cluster covering the tower). */
export const RELAY_PASSIVE_RANGE_BONUS = 0.05;

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

// ──────────────────────────────────────────────────────────
// Tower durability / repair (Part 1–2)
// Tower HP is intentionally generous — towers stay operational through normal
// combat, but Saboteurs/bosses/rifts can grind them down enough that the player
// notices state changes (damaged/critical/disabled) and reaches for Engineer
// or Shield squads. We do NOT want a maintenance simulator: damage is rare and
// recovery is cheap relative to rebuilding, so the loop adds tension and
// agency without becoming chore-like.
// ──────────────────────────────────────────────────────────
import type { TowerType } from "./Types";

/** Default HP for a tower if its type isn't listed below. */
export const TOWER_BASE_HP = 60;

/**
 * Per-type max HP. Cheap/disposable towers are softer; expensive heavies and
 * support towers are sturdier. Long-range fragiles (Railgun) take more hits
 * than a Pulse but less than a Mortar. Harvester is the toughest non-combat
 * structure to make economic loss reads as painful but recoverable.
 */
export const TOWER_HP_BY_TYPE: Record<TowerType, number> = {
  pulse: 50,
  blaster: 50,
  stasis: 55,
  mortar: 80,
  tesla: 70,
  harvester: 90,
  railgun: 60,
  flamer: 55,
  barrier: 75,
  amplifier: 65,
  reflector: 60,
  snare: 50,
  overclock: 65,
};

/**
 * Per-level HP multiplier. Levels are explicit investment — keeping towers
 * leveled means they can absorb more sabotage before going offline. We keep
 * the curve gentle (×1.20 per level) so this does not eclipse the level-based
 * damage curve and become the dominant upgrade reason.
 */
export const TOWER_HP_PER_LEVEL_MUL = 1.20;

/** HP percent thresholds. ≤ damaged → "damaged", ≤ critical → "critical". */
export const TOWER_DAMAGED_THRESHOLD = 0.65;
export const TOWER_CRITICAL_THRESHOLD = 0.30;

/** Fire-rate / range / damage mults applied while in damaged or critical state. */
export const TOWER_DAMAGED_FIRE_RATE_MUL = 0.92;
export const TOWER_CRITICAL_FIRE_RATE_MUL = 0.70;
export const TOWER_CRITICAL_RANGE_MUL = 0.85;
export const TOWER_CRITICAL_DAMAGE_MUL = 0.85;

/** Engineer squad HP-restored-per-second when channeling on a damaged tower. */
export const ENGINEER_TOWER_REPAIR_RATE = 14;
/** Bonus rate added when reviving a fully disabled tower (faster restart). */
export const ENGINEER_DISABLED_REPAIR_BONUS = 1.5;
/** When inside a jammer field, repair speed is multiplied by this. */
export const JAMMER_REPAIR_PENALTY = 0.5;
/** Fraction of repair throughput retained per additional engineer (diminishing returns). */
export const ENGINEER_REPAIR_STACK_FACTOR = 0.5;
/** Cap on simultaneous engineers contributing to one tower's repair. */
export const ENGINEER_REPAIR_STACK_CAP = 2;

/** Saboteur tower-damage tuning (replaces hard-disable at full HP). */
export const SABOTEUR_TOWER_DAMAGE = 22;
/**
 * Seconds a tower stays disabled when a Saboteur kills its HP. Note: this is
 * the soft-disable timer — once HP regenerates above 0 (via repair / passive),
 * the tower comes back online sooner. This timer guarantees a minimum offline
 * window when the saboteur scores a finishing blow.
 */
export const SABOTEUR_DISABLE_DURATION = 3.0;
/** Seconds between sabotage applications from the same saboteur. */
export const SABOTEUR_TOWER_COOLDOWN = 5.0;
/** Saboteur sabotage radius (px) — slightly tighter than v1 since damage replaces disable. */
export const SABOTEUR_TOWER_RADIUS = 38;

/** Boss corruption pulse: per-tower HP damage applied on top of the existing disable. */
export const BOSS_TOWER_DAMAGE = 14;
/** Multiplier to BOSS_TOWER_DAMAGE for Leviathan / Harbinger so their pulses really threaten infrastructure. */
export const BOSS_TOWER_DAMAGE_MULTIPLIER = 1.4;

/** HP per second drained from towers caught in a rift-anchor pulse aura. */
export const RIFT_TOWER_DAMAGE_PER_SECOND = 3.5;

/** Extra damage reduction Shield Squad applies specifically to towers (on top of core protection). */
export const SHIELD_TOWER_DAMAGE_REDUCTION = 0.45;

/** Abandoned turret HP (durable but not immortal). */
export const ABANDONED_TURRET_HP = 130;
/** HP/s an Engineer restores when reinforcing a captured abandoned turret. */
export const ABANDONED_TURRET_REPAIR_RATE = 12;

/**
 * End-of-wave passive recovery (Part 16). Damaged towers inside coverage heal
 * 12% of max HP at wave complete. Disabled towers stay disabled — the player
 * has to actively repair them, which preserves saboteur threat across waves.
 */
export const WAVE_END_PASSIVE_HEAL_PCT = 0.12;
