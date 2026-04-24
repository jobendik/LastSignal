import type { Game } from "../core/Game";
import { sectorDefinitions } from "../data/sectors";
import { difficultyDefinitions, difficultyOrder } from "../data/difficulty";
import { el, clear } from "./dom";

export class SectorSelect {
  el: HTMLElement;
  private endlessRequested = false;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-sector-select" });
  }

  refresh(): void {
    clear(this.el);
    this.el.append(
      el("div", { class: "ls-title", text: "Select Sector" }),
      el("div", { class: "ls-subtitle", text: "Choose where to defend the signal." })
    );

    this.el.append(this.buildDifficultyPicker());

    const grid = el("div", { class: "ls-sector-grid" });
    for (const s of sectorDefinitions) {
      const card = el("button", { class: "ls-sector-card" });
      card.style.borderColor = s.accentColor;
      card.append(
        el("div", { class: "ls-sector-name", text: s.name }),
        el("div", { class: "ls-sector-desc", text: s.description }),
        el("div", {
          class: "ls-sector-meta",
          html: `<span>${s.waves.length} waves</span> · <span>Core ${s.coreIntegrity}</span> · <span>Credits ${s.startingCredits}</span>`,
        })
      );
      card.onclick = () =>
        this.game.beginSector(s, { endless: this.endlessRequested });
      grid.append(card);
    }
    this.el.append(grid);

    // Endless toggle — only if research unlocked.
    if (this.game.meta.aggregate().hasEndless) {
      const endlessRow = el("div", { class: "ls-endless-row" });
      const toggle = el("button", {
        class: "ls-btn ls-btn-endless",
        text: this.endlessRequested ? "ENDLESS: ON" : "ENDLESS: OFF",
      });
      toggle.onclick = () => {
        this.endlessRequested = !this.endlessRequested;
        this.refresh();
      };
      endlessRow.append(
        toggle,
        el("span", {
          class: "ls-endless-note",
          text: `Best wave: ${this.game.core.profile.endlessBestWave}`,
        })
      );
      this.el.append(endlessRow);
    }

    const buttons = el("div", { class: "ls-sector-buttons" });
    const back = el("button", { class: "ls-btn ls-btn-ghost", text: "← Back" });
    back.onclick = () => this.game.setState("MAIN_MENU");
    const research = el("button", { class: "ls-btn", text: "RESEARCH" });
    research.onclick = () => this.game.ui.openMeta();
    buttons.append(back, research);
    this.el.append(buttons);
  }

  private buildDifficultyPicker(): HTMLElement {
    const wrap = el("div", { class: "ls-diff-picker" });
    wrap.append(
      el("div", { class: "ls-diff-label", text: "DIFFICULTY" })
    );
    const row = el("div", { class: "ls-diff-row" });
    const current = this.game.difficulty.current;
    for (const id of difficultyOrder) {
      const def = difficultyDefinitions[id];
      const btn = el("button", { class: "ls-diff-chip" });
      btn.style.borderColor = def.accentColor;
      if (id === current) btn.classList.add("active");
      btn.append(
        el("div", { class: "ls-diff-name", text: def.name }),
        el("div", { class: "ls-diff-desc", text: def.description })
      );
      btn.onclick = () => {
        this.game.difficulty.select(id);
        this.refresh();
      };
      row.append(btn);
    }
    wrap.append(row);
    return wrap;
  }
}
