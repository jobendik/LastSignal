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
    this.game.rewards.currentChoices.forEach((u, i) => {
      const rarity = u.rarity ?? "common";
      const card = el("button", { class: `ls-reward-card ${rarity}` });
      card.style.animationDelay = `${i * 0.15}s`;
      card.append(
        el("div", { class: "ls-reward-rarity", text: rarity.toUpperCase() }),
        el("div", { class: "ls-reward-name", text: u.name }),
        el("div", { class: "ls-reward-target", text: u.target.toUpperCase() }),
        el("div", { class: "ls-reward-desc", text: u.description }),
        el("div", { class: "ls-reward-hint", text: u.synergyHint ?? "" }),
      );
      card.onclick = () => {
        this.game.rewards.choose(u.id);
        this.game.waves.goToNextOrVictory();
      };
      row.append(card);
      window.setTimeout(() => this.game.audio.sfxCardFlip(), i * 150);
    });
    this.el.append(row);

    const actions = el("div", { class: "ls-overlay-actions" });
    const reroll = el("button", { class: "ls-btn", text: `Reroll (${this.game.rewards.rerollCost}CR)` });
    if (this.game.core.credits < this.game.rewards.rerollCost) reroll.classList.add("disabled");
    reroll.onclick = () => {
      if (this.game.rewards.reroll()) this.refresh();
    };
    const skip = el("button", { class: "ls-btn ls-btn-ghost", text: "Skip" });
    skip.onclick = () => this.game.waves.goToNextOrVictory();
    actions.append(reroll, skip);
    this.el.append(actions);
  }
}
