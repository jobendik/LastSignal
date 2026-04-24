import type { Game } from "../core/Game";
import { towerSpecializations } from "../data/towers";
import { el, clear } from "./dom";
import type { Tower } from "../entities/Tower";

/** Right-side panel shown when a tower is selected. */
export class TowerPanel {
  el: HTMLElement;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-tower-panel" });
    game.bus.on("tower:selected", () => this.refresh());
    game.bus.on("tower:upgraded", () => this.refresh());
    game.bus.on("tower:specialized", () => this.refresh());
    game.bus.on("tower:sold", () => this.refresh());
    game.bus.on("credits:changed", () => this.refresh());
    game.bus.on("ui:cleared", () => this.refresh());
  }

  refresh(): void {
    clear(this.el);
    const t = this.game.towers.selected;
    if (!t) {
      this.el.classList.remove("visible");
      return;
    }
    this.el.classList.add("visible");
    this.renderForTower(t);
  }

  private renderForTower(t: Tower): void {
    const stats = t.statBlock();
    this.el.append(
      el("div", { class: "ls-tp-title", text: t.def.name }),
      el("div", { class: "ls-tp-role", text: t.def.role }),
      el("div", { class: "ls-tp-level", text: `Level ${t.level}` }),
      el("div", { class: "ls-tp-stats", html:
        `<div>DMG <b>${stats.damage.toFixed(1)}</b></div>` +
        `<div>RNG <b>${Math.round(stats.range)}</b></div>` +
        `<div>CD <b>${stats.cooldown.toFixed(2)}s</b></div>` +
        (stats.splashRadius ? `<div>SPL <b>${Math.round(stats.splashRadius)}</b></div>` : "") +
        (stats.chainMax ? `<div>CHN <b>${stats.chainMax}</b></div>` : "") +
        (stats.income ? `<div>INC <b>${Math.round(stats.income)}/tick</b></div>` : "")
      }),
      el("div", { class: "ls-tp-kills", text: `Kills: ${t.kills}` }),
    );

    const actions = el("div", { class: "ls-tp-actions" });
    const upg = el("button", { class: "ls-btn", text: `UPGRADE (${t.upgradeCost}CR)` });
    upg.onclick = () => this.game.towers.upgrade(t);
    if (this.game.core.credits < t.upgradeCost) upg.classList.add("disabled");
    const sell = el("button", { class: "ls-btn ls-btn-ghost", text: `SELL (${Math.floor(t.totalInvested * this.game.core.upgrades.sellRefundMul)}CR)` });
    sell.onclick = () => this.game.towers.sell(t);
    actions.append(upg, sell);
    this.el.append(actions);

    // Specialization.
    if (t.canSpecialize) {
      this.el.append(el("div", { class: "ls-tp-spec-title", text: "SPECIALIZATION AVAILABLE" }));
      const tree = towerSpecializations[t.type];
      const list = el("div", { class: "ls-tp-spec-list" });
      for (const opt of tree.options) {
        const b = el("button", { class: "ls-tp-spec-option" });
        b.append(
          el("div", { class: "ls-tp-spec-name", text: opt.name }),
          el("div", { class: "ls-tp-spec-desc", text: opt.description }),
        );
        b.onclick = () => this.game.towers.applySpecialization(t, opt.id);
        list.append(b);
      }
      this.el.append(list);
    } else if (t.specId) {
      this.el.append(el("div", { class: "ls-tp-spec-applied", text: "SPEC: " + t.specId.replace(/_/g, " ").toUpperCase() }));
    }
  }
}
