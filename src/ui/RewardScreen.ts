import type { Game } from "../core/Game";
import { el, clear } from "./dom";

/** Full-screen overlay shown at reward-eligible wave ends. */
export class RewardScreen {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-overlay ls-reward" });
  }

  refresh(): void {
    clear(this.el);
    this.el.append(
      el("div", { class: "ls-overlay-title", text: "SIGNAL UPGRADE" }),
      el("div", { class: "ls-overlay-subtitle", text: "Choose one upgrade to persist through the rest of this run." }),
    );
    const row = el("div", { class: "ls-reward-row" });
    for (const u of this.game.rewards.currentChoices) {
      const card = el("button", { class: "ls-reward-card" });
      card.append(
        el("div", { class: "ls-reward-name", text: u.name }),
        el("div", { class: "ls-reward-target", text: u.target.toUpperCase() }),
        el("div", { class: "ls-reward-desc", text: u.description }),
      );
      card.onclick = () => {
        this.game.rewards.choose(u.id);
        this.game.waves.goToNextOrVictory();
      };
      row.append(card);
    }
    this.el.append(row);

    const skip = el("button", { class: "ls-btn ls-btn-ghost", text: "Skip" });
    skip.onclick = () => this.game.waves.goToNextOrVictory();
    this.el.append(skip);
  }
}
