import type { Game } from "../core/Game";
import type { AudioSubtitleCue } from "../systems/AudioSystem";
import { el, clear } from "./dom";

type SubtitleTone = AudioSubtitleCue["tone"];

export class SubtitleOverlay {
  el: HTMLElement;
  private nextId = 1;
  private activeIds: number[] = [];

  constructor(private readonly game: Game) {
    this.el = el("div", {
      class: "ls-subtitle-overlay",
      attrs: { "aria-live": "polite", "aria-atomic": "false" },
    });
    game.bus.on<AudioSubtitleCue>("audio:subtitle", (cue) => this.show(cue));
    game.bus.on<{ phase: number; text: string }>("boss:phase", () => {
      this.show({ text: "BOSS PHASE CHANGE", tone: "alert", duration: 2.2, priority: 3 });
    });
    game.bus.on("settings:changed", () => {
      if (!this.game.core.settings.subtitles) this.hideAll();
    });
  }

  private show(cue: AudioSubtitleCue): void {
    if (!this.game.core.settings.subtitles) return;
    const id = this.nextId++;
    const line = el("div", { class: `ls-subtitle-line ${this.toneClass(cue.tone)}`, text: cue.text });
    line.dataset.subtitleId = String(id);
    this.el.classList.add("visible");
    this.el.append(line);
    this.activeIds.push(id);
    this.trim();
    window.setTimeout(() => this.remove(id), Math.max(0.6, cue.duration) * 1000);
  }

  private remove(id: number): void {
    const line = this.el.querySelector(`[data-subtitle-id="${id}"]`);
    line?.remove();
    this.activeIds = this.activeIds.filter((activeId) => activeId !== id);
    if (this.activeIds.length === 0) this.el.classList.remove("visible");
  }

  private trim(): void {
    while (this.activeIds.length > 3) {
      const id = this.activeIds.shift();
      if (id == null) break;
      this.el.querySelector(`[data-subtitle-id="${id}"]`)?.remove();
    }
  }

  private hideAll(): void {
    clear(this.el);
    this.activeIds = [];
    this.el.classList.remove("visible");
  }

  private toneClass(tone: SubtitleTone): string {
    switch (tone) {
      case "alert": return "alert";
      case "reward": return "reward";
      case "enemy": return "enemy";
      case "tower": return "tower";
      default: return "neutral";
    }
  }
}
