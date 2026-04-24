import type { Game } from "../core/Game";
import { enemyDefinitions, enemyOrder } from "../data/enemies";
import { codexEntries } from "../data/codex";
import { el, clear } from "./dom";

export class CodexPanel {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-overlay ls-codex" });
  }

  refresh(): void {
    clear(this.el);
    this.el.append(el("div", { class: "ls-overlay-title", text: "THREAT CODEX" }));
    const grid = el("div", { class: "ls-codex-grid" });
    for (const id of enemyOrder) {
      const def = enemyDefinitions[id];
      const seen = this.game.codex.has(id);
      const entry = codexEntries[id];
      const card = el("div", { class: `ls-codex-card${seen ? "" : " locked"}` });
      card.style.borderColor = seen ? def.color : "#444";
      if (seen) {
        card.append(
          el("div", { class: "ls-codex-name", text: def.name }),
          el("div", { class: "ls-codex-role", text: def.role }),
          el("div", { class: "ls-codex-hp", html:
            `<span>HP <b>${def.hp}</b></span><span>SPD <b>${def.speed}</b></span><span>REW <b>${def.reward}</b></span>` }),
          el("div", { class: "ls-codex-desc", text: def.description }),
          el("div", { class: "ls-codex-threat", text: entry.threatHeadline }),
          el("div", { class: "ls-codex-counters", text: "Counters: " + entry.counters.join(", ") }),
          el("div", { class: "ls-codex-tip", text: "Tip: " + entry.tip }),
        );
      } else {
        card.append(
          el("div", { class: "ls-codex-name", text: "??? UNKNOWN" }),
          el("div", { class: "ls-codex-desc", text: "Threat profile unavailable. Encounter this anomaly during a mission to unlock." }),
        );
      }
      grid.append(card);
    }
    this.el.append(grid);
    const close = el("button", { class: "ls-btn ls-btn-primary", text: "Close" });
    close.onclick = () => this.game.ui.closeCodex();
    this.el.append(close);
  }
}
