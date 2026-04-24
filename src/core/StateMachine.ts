import type { GameStateId } from "./Types";
import type { EventBus } from "./EventBus";

/**
 * Minimal state machine. Real behavior lives in systems / UI that react to
 * "state:changed" events — the machine itself only governs transitions.
 */
export class StateMachine {
  private current: GameStateId = "BOOT";

  constructor(private readonly bus: EventBus) {}

  get state(): GameStateId {
    return this.current;
  }

  is(state: GameStateId): boolean {
    return this.current === state;
  }

  set(next: GameStateId): void {
    if (next === this.current) return;
    const prev = this.current;
    this.current = next;
    this.bus.emit<{ prev: GameStateId; next: GameStateId }>("state:changed", {
      prev,
      next,
    });
  }
}
