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
    "Damaged transmission node. Capture to extend local signal coverage.",
  radar_dish:
    "Wrecked sensor dish. Capture to widen reveal range and read wave intel.",
  data_cache:
    "Sealed archive crate. Recover for credits and a research breakthrough.",
  abandoned_turret:
    "Dormant defense gun. Capture to wake it as a free static turret.",
  rift_anchor:
    "Corrupted spire feeding the wave. Empowers nearby enemies until destroyed.",
  jammer:
    "Hostile signal scrambler. Suppresses your towers and capture progress nearby.",
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
  /** Whether the structure has been damaged at least once (for HUD reveal cues). */
  damagedOnce = false;
  /** Whether the player has been told this point exists (lights up after first reveal). */
  discovered = false;
  /** Visual capture-completion flash timer. */
  flashTimer = 0;

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

    this.state = isHostile(def.type) ? "enemy" : "neutral";
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
    default: return 0;
  }
}
