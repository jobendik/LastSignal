import type { Game } from "../core/Game";
import type { GameSettings } from "../core/Types";

export class SettingsSystem {
  constructor(private readonly game: Game) {}

  get current(): GameSettings {
    return this.game.core.settings;
  }

  update(patch: Partial<GameSettings>): void {
    const s = { ...this.game.core.settings, ...patch };
    this.game.core.settings = s;
    this.game.persistence.saveSettings(s);
    this.game.audio.applySettings(s);
    this.game.bus.emit("settings:changed", s);
  }
}
