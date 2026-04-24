import type { Game } from "../core/Game";
import { el, clear } from "./dom";

function statsSummary(g: Game): string {
  const s = g.core.stats;
  const rows: string[] = [];
  rows.push(`Enemies destroyed: <b>${s.enemiesKilled}</b>`);
  rows.push(`Credits earned: <b>${s.creditsEarned}</b>`);
  rows.push(`Core damage taken: <b>${Math.round(s.coreDamageTaken)}</b>`);
  if (s.bestTowerType) {
    rows.push(`Best tower: <b>${s.bestTowerType.toUpperCase()} L${s.bestTowerLevel}</b>`);
  }
  const topKills = Object.entries(s.killsByEnemyType)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  if (topKills) rows.push(`Kills: ${topKills}`);
  return rows.map((r) => `<div>${r}</div>`).join("");
}

export class GameOverScreen {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-overlay ls-gameover" });
  }
  refresh(): void {
    clear(this.el);
    this.el.append(
      el("div", { class: "ls-overlay-title", text: "CORE OFFLINE" }),
      el("div", { class: "ls-overlay-subtitle", text: "The signal has been lost." }),
      el("div", { class: "ls-stats", html: statsSummary(this.game) }),
    );
    const row = el("div", { class: "ls-overlay-actions" });
    const retry = el("button", { class: "ls-btn ls-btn-primary", text: "Retry Sector" });
    retry.onclick = () => {
      const s = this.game.core.sector;
      if (s) this.game.beginSector(s);
    };
    const menu = el("button", { class: "ls-btn", text: "Main Menu" });
    menu.onclick = () => this.game.returnToMenu();
    row.append(retry, menu);
    this.el.append(row);
  }
}

export class VictoryScreen {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-overlay ls-victory" });
  }
  refresh(): void {
    clear(this.el);
    this.el.append(
      el("div", { class: "ls-overlay-title", text: "SIGNAL HELD" }),
      el("div", { class: "ls-overlay-subtitle", text: "The Leviathan is destroyed. The relay endures." }),
      el("div", { class: "ls-stats", html: statsSummary(this.game) }),
    );
    const row = el("div", { class: "ls-overlay-actions" });
    const again = el("button", { class: "ls-btn ls-btn-primary", text: "New Run" });
    again.onclick = () => this.game.setState("SECTOR_SELECT");
    const menu = el("button", { class: "ls-btn", text: "Main Menu" });
    menu.onclick = () => this.game.returnToMenu();
    row.append(again, menu);
    this.el.append(row);
  }
}
