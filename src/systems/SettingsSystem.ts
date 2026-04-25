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
    this.applyVisualSettings(s);
    this.game.bus.emit("settings:changed", s);
  }

  applyVisualSettings(s: GameSettings = this.game.core.settings): void {
    const root = this.game.uiRoot;
    root.style.setProperty("--ls-font-scale", String(s.fontScale));
    root.classList.toggle("ls-high-contrast", s.highContrast);
    root.classList.toggle("ls-reduced-motion", s.reducedMotion);
    root.classList.toggle("ls-quality-low", s.graphicsQuality === "low");
    root.classList.toggle("ls-quality-medium", s.graphicsQuality === "medium");
    root.classList.toggle("ls-quality-high", s.graphicsQuality === "high");
  }
}
