import type { Game } from "../core/Game";
import { enemyDefinitions } from "../data/enemies";
import { el, clear } from "./dom";

/**
 * Tab-toggled panel showing next wave composition + recommended counters.
 *
 * Layout:
 *   - Title + wave-number eyebrow.
 *   - Description (sector author's voice).
 *   - Warning chip (yellow if any, red if a boss/blitz).
 *   - Recommended counters chips (split into squad / tower hints).
 *   - Enemy composition list with HP/SPD/REW per type.
 *   - Boss-only callout when next wave is flagged isBossWave.
 */
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

    // Header row.
    const header = el("div", { class: "ls-wp-header" });
    const eyebrow = el("div", { class: "ls-wp-eyebrow" });
    const waveNum = Math.min(this.game.core.waveIndex + 1, this.game.waves.totalWaves);
    eyebrow.textContent = `WAVE ${waveNum} / ${this.game.waves.totalWaves}`;
    header.append(eyebrow, el("div", { class: "ls-wp-title", text: wave.name }));
    if (wave.isBossWave) {
      const bossChip = el("span", { class: "ls-wp-boss-chip", text: "BOSS WAVE" });
      header.append(bossChip);
    }
    this.el.append(header);

    if (wave.description) {
      this.el.append(el("div", { class: "ls-wp-desc", text: wave.description }));
    }

    // Warning band.
    if (wave.warning) {
      const warn = el("div", {
        class: `ls-wp-warning${wave.isBossWave ? " danger" : ""}`,
        text: wave.warning,
      });
      this.el.append(warn);
    }

    // Wave event flag (blitz / silence).
    if (wave.waveEvent) {
      const eventLabel =
        wave.waveEvent === "blitz"
          ? "BLITZ — enemies arrive without stagger."
          : wave.waveEvent === "silence"
          ? "SILENCE — wave intel suppressed; trust the gates."
          : wave.waveEvent;
      this.el.append(el("div", { class: "ls-wp-event", text: eventLabel }));
    }

    // Composition.
    const list = el("div", { class: "ls-wp-enemy-list" });
    for (const entry of wave.enemySummary ?? []) {
      const def = enemyDefinitions[entry.type];
      const row = el("div", { class: "ls-wp-enemy-row" });
      const swatch = el("div", { class: "ls-wp-enemy-swatch" });
      swatch.style.background = def.color;
      const meta = el("span", {
        class: "ls-wp-enemy-meta",
        text: `HP ${def.hp} · SPD ${def.speed} · REW ${def.reward}`,
      });
      row.append(
        swatch,
        el("span", { class: "ls-wp-enemy-name", text: def.name }),
        el("span", { class: "ls-wp-enemy-count", text: `× ${entry.count}` }),
        meta
      );
      list.append(row);
    }
    this.el.append(list);

    // Recommended counters.
    const counters = el("div", { class: "ls-wp-counters" });
    counters.append(el("div", { class: "ls-wp-counters-title", text: "Recommended:" }));
    for (const c of wave.recommendedCounters) {
      const isSquad = /squad/i.test(c) || /recon|engineer|strike|shield/i.test(c);
      counters.append(
        el("span", {
          class: `ls-wp-counter-chip${isSquad ? " squad" : ""}`,
          text: c,
        })
      );
    }
    this.el.append(counters);

    // Tip footer with one fallback hint when no counters are authored.
    if ((wave.recommendedCounters?.length ?? 0) === 0) {
      this.el.append(
        el("div", {
          class: "ls-wp-fallback",
          text: "Mix damage and control. Keep ~30 CR in reserve. Recall and redeploy if you over-built.",
        })
      );
    }

    // Hotkey hint.
    this.el.append(
      el("div", { class: "ls-wp-hotkey", text: "Tab: close · Space: start now · H: codex" })
    );
  }
}
