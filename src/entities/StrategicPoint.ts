import { Vector2 } from "../core/Vector2";
import { TILE_SIZE } from "../core/Config";
import type {
  StrategicPointDefinition,
  StrategicPointState,
  StrategicPointType,
} from "../core/Types";

const DEFAULT_NAMES: Record<StrategicPointType, string> = {
  signal_node: "Signal Node",
  radar_dish: "Radar Dish",
  data_cache: "Data Cache",
  abandoned_turret: "Abandoned Turret",
  rift_anchor: "Rift Anchor",
  jammer: "Jammer",
};

const DEFAULT_DESCRIPTIONS: Record<StrategicPointType, string> = {
  signal_node:
    "Damaged transmission node. Capture to extend local signal coverage and unlock new build zones.",
  radar_dish:
    "Wrecked sensor dish. Capture to expand reveal range and expose hostile map markers.",
  data_cache:
    "Sealed archive crate. Recover once for credits and a research breakthrough.",
  abandoned_turret:
    "Neutral defense platform. Capture to activate as an allied static turret.",
  rift_anchor:
    "Hostile structure. Periodically empowers enemies and surges scouts. Destroy to weaken the sector.",
  jammer:
    "Hostile structure. Suppresses tower fire rate and blocks capture progress. Destroy to restore signal clarity.",
};

/**
 * Short one-line "what does capturing/destroying do?" reward summary used by
 * the tooltip so the player can read the payoff at a glance.
 */
const REWARD_SUMMARIES: Record<StrategicPointType, string> = {
  signal_node: "Reward: extends signal coverage (build territory).",
  radar_dish: "Reward: wider reveal + reveals hostile structures.",
  data_cache: "Reward: credits + research point (one time).",
  abandoned_turret: "Reward: free static turret on your side.",
  rift_anchor: "Reward: removes enemy buff aura and surges.",
  jammer: "Reward: removes tower suppression and capture block.",
};

/** Runtime instance of a strategic map point. Holds mutable per-run state. */
export class StrategicPoint {
  readonly id: string;
  readonly type: StrategicPointType;
  readonly c: number;
  readonly r: number;
  readonly pos: Vector2;
  readonly name: string;
  readonly description: string;
  /** Cells of influence (used by radar reveal, signal node, jammer). */
  readonly radiusCells: number;
  /** Total seconds required to capture (neutral/enemy → captured). */
  readonly captureSeconds: number;
  /** One-time reward — applied when the point is captured (data cache). */
  readonly rewardCredits: number;
  readonly rewardResearch: number;

  state: StrategicPointState;
  /** Capture progress 0..1 (only meaningful when state == "neutral"). */
  captureProgress = 0;
  /** Health for hostile structures. 0 means destroyed. */
  health: number;
  readonly maxHealth: number;
  /** Cooldown for periodic effects (rift anchor pulses, abandoned turret shots). */
  effectTimer = 0;
  /**
   * Cooldown a hostile structure was *originally* set to on the most recent
   * pulse — used by the renderer to draw a fill-bar countdown that shows the
   * percent of time remaining before the next pulse triggers.
   */
  pulseInterval = 0;
  /** Whether the structure has been damaged at least once (for HUD reveal cues). */
  damagedOnce = false;
  /** Whether the player has been told this point exists (lights up after first reveal). */
  discovered = false;
  /** Visual capture-completion flash timer. */
  flashTimer = 0;
  /** Live "is currently inside the player's signal coverage" — set by SPS each tick. */
  inCoverage = false;
  /** Live "currently contested by enemies" — set by SPS each tick. */
  contested = false;
  /** Live "currently inside an active hostile jammer field" — set by SPS each tick. */
  jammed = false;
  /**
   * For captured abandoned turrets: while disabled the turret stops firing and
   * renders as broken. Engineer repair restores HP and clears the flag. Other
   * structure types ignore this field.
   */
  disabled = false;
  /** Game-time of last damage taken (used for HUD readout / sfx throttling). */
  lastDamagedAt = -Infinity;
  /** Damage flash timer used by the renderer (0..0.5s). */
  damageFlashTimer = 0;
  /** True while an Engineer squad is currently channeling repair on this point. */
  underRepair = false;
  /** Last-known reward summary used by the tooltip helper. */
  readonly rewardSummary: string;

  constructor(def: StrategicPointDefinition) {
    this.id = def.id;
    this.type = def.type;
    this.c = def.c;
    this.r = def.r;
    this.pos = new Vector2(def.c * TILE_SIZE + TILE_SIZE / 2, def.r * TILE_SIZE + TILE_SIZE / 2);
    this.name = def.name ?? DEFAULT_NAMES[def.type];
    this.description = def.description ?? DEFAULT_DESCRIPTIONS[def.type];
    this.radiusCells = def.radiusCells ?? defaultRadiusCells(def.type);
    this.captureSeconds = def.captureSeconds ?? defaultCaptureSeconds(def.type);
    this.rewardCredits = def.rewardCredits ?? 0;
    this.rewardResearch = def.rewardResearch ?? 0;

    const hp = def.health ?? defaultHealth(def.type);
    this.maxHealth = hp;
    this.health = hp;
    this.rewardSummary = REWARD_SUMMARIES[def.type];

    this.state = isHostile(def.type) ? "enemy" : "neutral";

    // Hostile structures get a one-pulse-interval grace period at sector
    // start so the player has time to see the warning UI rather than being
    // greeted with an immediate pulse on tick 1.
    if (isHostile(def.type)) {
      this.effectTimer = defaultPulseInterval(def.type);
      this.pulseInterval = this.effectTimer;
    }
  }

  /** Convenience predicates. */
  get isFriendly(): boolean { return this.state === "captured"; }
  get isHostile(): boolean { return this.state === "enemy"; }
  get isCapturable(): boolean { return this.state === "neutral"; }
  get isDestroyed(): boolean { return this.state === "destroyed"; }
  get isDepleted(): boolean { return this.state === "depleted"; }
}

export function isHostile(type: StrategicPointType): boolean {
  return type === "rift_anchor" || type === "jammer";
}

function defaultRadiusCells(type: StrategicPointType): number {
  switch (type) {
    case "signal_node": return 5;
    case "radar_dish": return 14;
    case "rift_anchor": return 6;
    case "jammer": return 6;
    default: return 0;
  }
}

function defaultCaptureSeconds(type: StrategicPointType): number {
  switch (type) {
    case "data_cache": return 4;
    case "abandoned_turret": return 6;
    case "radar_dish": return 8;
    case "signal_node": return 7;
    default: return 7;
  }
}

function defaultHealth(type: StrategicPointType): number {
  switch (type) {
    case "rift_anchor": return 320;
    case "jammer": return 220;
    case "abandoned_turret": return 130;
    default: return 0;
  }
}

/** Default seconds-between-pulses for a hostile structure. */
function defaultPulseInterval(type: StrategicPointType): number {
  switch (type) {
    case "rift_anchor": return 9;
    case "jammer": return 9;
    default: return 0;
  }
}
