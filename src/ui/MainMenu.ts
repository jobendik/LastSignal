import type { Game } from "../core/Game";
import { el, clear } from "./dom";

export class MainMenu {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-mainmenu" });
  }
  refresh(): void {
    clear(this.el);
    const p = this.game.core.profile;

    this.el.append(
      el("div", { class: "ls-title", text: "LAST SIGNAL" }),
      el("div", { class: "ls-subtitle", text: "Tactical Sci-Fi Roguelite Tower Defense" }),
      el("div", { class: "ls-profile", html:
        `<div>Best sector cleared: <strong>${p.bestSectorCleared}</strong></div>` +
        `<div>Best wave reached: <strong>${p.bestWaveReached}</strong></div>` +
        `<div>Codex entries: <strong>${p.codexSeen.length}</strong> / 7</div>`,
      }),
    );

    const actions = el("div", { class: "ls-actions" });
    const startBtn = el("button", { class: "ls-btn ls-btn-primary", text: "START MISSION" });
    startBtn.onclick = () => this.game.setState("SECTOR_SELECT");
    actions.append(startBtn);

    const codexBtn = el("button", { class: "ls-btn", text: "CODEX" });
    codexBtn.onclick = () => this.game.ui.openCodex();
    actions.append(codexBtn);

    const settingsBtn = el("button", { class: "ls-btn", text: "SETTINGS" });
    settingsBtn.onclick = () => this.game.ui.openSettings();
    actions.append(settingsBtn);

    this.el.append(actions);

    this.el.append(el("div", { class: "ls-hint", html:
      "Hotkeys: <span>1-6</span> build, <span>U</span> upgrade, <span>S</span> sell, <span>D</span> drone, <span>Space</span> start wave / confirm, <span>Tab</span> wave preview, <span>P</span> pause, <span>+/-</span> speed, <span>F1</span> debug." }));
  }
}
