import type { Game } from "../core/Game";
import { el } from "./dom";

export class PauseMenu {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-overlay ls-pause" });
    this.el.append(
      el("div", { class: "ls-overlay-title", text: "PAUSED" }),
      el("div", { class: "ls-overlay-subtitle", text: "Press P to resume." })
    );
    const row = el("div", { class: "ls-overlay-actions" });
    const resume = el("button", { class: "ls-btn ls-btn-primary", text: "Resume" });
    resume.onclick = () => this.game.togglePause();
    const settings = el("button", { class: "ls-btn", text: "Settings" });
    settings.onclick = () => this.game.ui.openSettings();
    const quit = el("button", { class: "ls-btn ls-btn-ghost", text: "Main Menu" });
    quit.onclick = () => this.game.returnToMenu();
    row.append(resume, settings, quit);
    this.el.append(row);
  }
}
