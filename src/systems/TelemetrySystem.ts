/**
 * TelemetrySystem — anonymised gameplay event collection.
 *
 * Design notes:
 * - Only activated when ConsentSystem.telemetryAllowed is true.
 * - Events are buffered in memory and POSTed in batches to VITE_TELEMETRY_URL.
 * - In dev mode (import.meta.env.DEV) every event is also console.debug-logged.
 * - PII protection: only an explicit allow-list of property keys is serialised;
 *   everything else is silently dropped before the event is buffered.
 * - A stable anonymous session ID (crypto.randomUUID) is stored in localStorage
 *   under the key "ls.anonId" and reused across page loads.
 * - flush() is called every 30 s and on beforeunload. It is fire-and-forget
 *   with no retries — losing a batch is acceptable.
 */

import type { Game } from "../core/Game";
import type { Tower } from "../entities/Tower";
import type { UpgradeDefinition } from "../core/Types";
import { ConsentSystem } from "./ConsentSystem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PropValue = string | number | boolean;

interface TelemetryEvent {
  event: string;
  props: Record<string, PropValue>;
  ts: number; // Unix ms
}

// ---------------------------------------------------------------------------
// PII allow-list — the ONLY keys that may appear in a serialised event.
// ---------------------------------------------------------------------------
const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "sectorId",
  "difficulty",
  "modifiers",
  "durationS",
  "livesRemaining",
  "waveIndex",
  "type",
  "id",
  "wave",
  "anonId",
]);

// ---------------------------------------------------------------------------
// TelemetrySystem
// ---------------------------------------------------------------------------

export class TelemetrySystem {
  private static buffer: TelemetryEvent[] = [];
  private static anonId = "";
  private static endpoint = "";
  private static flushTimer = 0;
  private static unloadHandler: (() => void) | null = null;
  private static sectorStartTime = 0;
  private static game: Game | null = null;
  private static active = false;

  // -------------------------------------------------------------------------
  // Public surface
  // -------------------------------------------------------------------------

  /**
   * Initialise the system. Must be called after ConsentSystem flags are set
   * and the Game instance is available.
   *
   * @param game  - the live Game instance (needed to read state on events)
   */
  static init(game: Game): void {
    if (!ConsentSystem.telemetryAllowed) return;
    this.active = true;
    this.game = game;

    // Stable anonymous ID — never changes for this browser profile.
    this.anonId = this.resolveAnonId();

    // Telemetry endpoint (optional — falls back to console only).
    this.endpoint = this.readEndpoint();

    // Wire EventBus listeners.
    this.attachListeners(game);

    // Flush every 30 s.
    this.flushTimer = window.setInterval(() => this.flush(), 30_000);

    // Flush on page unload (best-effort; synchronous fetch not guaranteed).
    this.unloadHandler = () => this.flush();
    window.addEventListener("beforeunload", this.unloadHandler);

    // Respect future consent changes (user may opt-out mid-session).
    game.bus.on("consent:changed", (flags) => {
      if (!flags.telemetryAllowed) {
        this.teardown();
      }
    });
  }

  /**
   * Push an event to the in-memory buffer.
   * Properties are filtered through the allow-list before storage.
   */
  static record(event: string, props: Record<string, PropValue> = {}): void {
    if (!this.active) return;
    const safe = this.sanitise(props);
    const entry: TelemetryEvent = { event, props: safe, ts: Date.now() };
    this.buffer.push(entry);

    if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
      console.debug("[telemetry]", event, safe);
    }
  }

  /**
   * POST the buffered events to the configured endpoint.
   * Fire-and-forget — no retries, failures are silently swallowed.
   */
  static flush(): void {
    if (!this.active || this.buffer.length === 0) return;
    const batch = this.buffer.splice(0); // drain
    const payload = JSON.stringify({
      anonId: this.anonId,
      events: batch,
    });

    if (this.endpoint) {
      try {
        navigator.sendBeacon
          ? navigator.sendBeacon(this.endpoint, new Blob([payload], { type: "application/json" }))
          : void fetch(this.endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payload,
              keepalive: true,
            });
      } catch {
        // swallow — telemetry is best-effort
      }
    } else if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
      console.debug("[telemetry] flush (no endpoint)", batch);
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private static attachListeners(game: Game): void {
    const bus = game.bus;

    // sector_start — fired when beginSector() emits "sector:started"
    bus.on("sector:started", ({ sector }) => {
      this.sectorStartTime = Date.now();
      this.record("sector_start", {
        sectorId: sector.id,
        difficulty: game.difficulty.current,
        modifiers: game.core.activeModifiers.map((m) => m.id).join(","),
      });
    });

    // sector_clear — fired on "game:victory"
    bus.on("game:victory", () => {
      const sectorId = game.core.sector?.id ?? "unknown";
      const durationS = Math.round((Date.now() - this.sectorStartTime) / 1000);
      const livesRemaining = game.core.coreIntegrity;
      this.record("sector_clear", { sectorId, durationS, livesRemaining });
    });

    // sector_fail — fired on "game:over"
    bus.on("game:over", () => {
      const sectorId = game.core.sector?.id ?? "unknown";
      const durationS = Math.round((Date.now() - this.sectorStartTime) / 1000);
      const waveIndex = game.core.waveIndex;
      this.record("sector_fail", { sectorId, waveIndex, durationS });
    });

    // wave_start — fired on "wave:started"
    bus.on("wave:started", () => {
      const sectorId = game.core.sector?.id ?? "unknown";
      const waveIndex = game.core.waveIndex;
      this.record("wave_start", { sectorId, waveIndex });
    });

    // tower_built — fired on "tower:built"
    bus.on("tower:built", (tower) => {
      const t = tower as Tower;
      this.record("tower_built", { type: t.type });
    });

    // modifier_picked — fired on "upgrade:applied"
    bus.on("upgrade:applied", (upgrade) => {
      const u = upgrade as UpgradeDefinition;
      this.record("modifier_picked", { id: u.id });
    });

    // endless_wave_reached — fired on "endless:wave"
    bus.on("endless:wave", ({ wave }: { wave: number }) => {
      this.record("endless_wave_reached", { wave });
    });
  }

  /** Filter props: keep only allow-listed keys, coerce values to primitives. */
  private static sanitise(
    props: Record<string, PropValue>
  ): Record<string, PropValue> {
    const result: Record<string, PropValue> = {};
    for (const [k, v] of Object.entries(props)) {
      if (!ALLOWED_KEYS.has(k)) continue;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        result[k] = v;
      }
    }
    return result;
  }

  private static resolveAnonId(): string {
    try {
      const stored = localStorage.getItem("ls.anonId");
      if (stored) return stored;
      const fresh =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("ls.anonId", fresh);
      return fresh;
    } catch {
      return "anon-fallback";
    }
  }

  private static readEndpoint(): string {
    try {
      const env = (import.meta as unknown as { env?: { VITE_TELEMETRY_URL?: string } }).env;
      return env?.VITE_TELEMETRY_URL ?? "";
    } catch {
      return "";
    }
  }

  /** Tear down listeners / timers when consent is revoked. */
  private static teardown(): void {
    this.active = false;
    this.buffer = [];
    if (this.flushTimer) {
      window.clearInterval(this.flushTimer);
      this.flushTimer = 0;
    }
    if (this.unloadHandler) {
      window.removeEventListener("beforeunload", this.unloadHandler);
      this.unloadHandler = null;
    }
    this.game = null;
  }
}
