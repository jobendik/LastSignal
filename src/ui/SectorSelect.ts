import type { Game } from "../core/Game";
import { sectorDefinitions } from "../data/sectors";
import { el, clear } from "./dom";

export class SectorSelect {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-sector-select" });
  }
  refresh(): void {
    clear(this.el);
    this.el.append(
      el("div", { class: "ls-title", text: "Select Sector" }),
      el("div", { class: "ls-subtitle", text: "Choose where to defend the signal." })
    );

    const grid = el("div", { class: "ls-sector-grid" });
    for (const s of sectorDefinitions) {
      const card = el("button", { class: "ls-sector-card" });
      card.style.borderColor = s.accentColor;
      card.append(
        el("div", { class: "ls-sector-name", text: s.name }),
        el("div", { class: "ls-sector-desc", text: s.description }),
        el("div", { class: "ls-sector-meta", html:
          `<span>${s.waves.length} waves</span> · <span>Core ${s.coreIntegrity}</span> · <span>Credits ${s.startingCredits}</span>` }),
      );
      card.onclick = () => this.game.beginSector(s);
      grid.append(card);
    }
    this.el.append(grid);

    const back = el("button", { class: "ls-btn ls-btn-ghost", text: "← Back" });
    back.onclick = () => this.game.setState("MAIN_MENU");
    this.el.append(back);
  }
}
