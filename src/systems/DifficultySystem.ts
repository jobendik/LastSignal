import type { Game } from "../core/Game";
import { difficultyDefinitions } from "../data/difficulty";
import type { DifficultyDefinition, DifficultyId } from "../core/Types";

/**
 * Tracks the currently selected difficulty and exposes the tuning values.
 * The actual effects are applied by the systems that care (Enemy, Tower, Waves).
 */
export class DifficultySystem {
  current: DifficultyId = "standard";

  constructor(private readonly game: Game) {
    this.current = this.game.core.profile.lastDifficulty ?? "standard";
  }

  select(id: DifficultyId): void {
    if (!difficultyDefinitions[id]) return;
    this.current = id;
    this.game.core.profile.lastDifficulty = id;
    this.game.persistence.saveProfile(this.game.core.profile);
    this.game.bus.emit("difficulty:changed", id);
  }

  get def(): DifficultyDefinition {
    return difficultyDefinitions[this.current];
  }
}
