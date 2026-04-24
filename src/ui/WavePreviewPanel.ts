import type { Game } from "../core/Game";
import { enemyDefinitions } from "../data/enemies";
import { el, clear } from "./dom";

/** Tab-toggled panel showing next wave composition + recommended counters. */
export class WavePreviewPanel {
  el: HTMLElement;
  private isOpen = false;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-wave-preview" });
    game.bus.on("wave:started", () => this.close());
    game.bus.on("state:changed", () => this.refresh());
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.refresh();
  }
  close(): void {
    this.isOpen = false;
    this.refresh();
  }

  refresh(): void {
    if (this.isOpen && (this.game.state === "PLANNING" || this.game.state === "WAVE_ACTIVE")) {
      this.el.classList.add("visible");
      this.renderBody();
    } else {
      this.el.classList.remove("visible");
    }
  }

  private renderBody(): void {
    clear(this.el);
    const wave = this.game.waves.nextWaveDef;
    if (!wave) {
      this.el.append(el("div", { class: "ls-wp-title", text: "No further waves." }));
      return;
    }
    this.el.append(
      el("div", { class: "ls-wp-title", text: wave.name }),
      el("div", { class: "ls-wp-warning", text: wave.warning }),
    );
    const list = el("div", { class: "ls-wp-enemy-list" });
    for (const entry of wave.enemySummary ?? []) {
      const def = enemyDefinitions[entry.type];
      const row = el("div", { class: "ls-wp-enemy-row" });
      const swatch = el("div", { class: "ls-wp-enemy-swatch" });
      swatch.style.background = def.color;
      row.append(swatch, el("span", { class: "ls-wp-enemy-name", text: def.name }), el("span", { class: "ls-wp-enemy-count", text: `× ${entry.count}` }));
      list.append(row);
    }
    this.el.append(list);

    const counters = el("div", { class: "ls-wp-counters" });
    counters.append(el("div", { class: "ls-wp-counters-title", text: "Recommended:" }));
    for (const c of wave.recommendedCounters) {
      counters.append(el("span", { class: "ls-wp-counter-chip", text: c }));
    }
    this.el.append(counters);
  }
}
