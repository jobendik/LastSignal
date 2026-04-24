import type { Game } from "../core/Game";
import { towerDefinitions, towerOrder } from "../data/towers";
import { droneDefinitions, droneOrder } from "../data/drones";
import { el, clear } from "./dom";

/** Left-side build menu: tower buttons + drones. */
export class BuildMenu {
  el: HTMLElement;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-build-menu" });

    game.bus.on("credits:changed", () => this.refresh());
    game.bus.on("build:tool", () => this.refresh());
    game.bus.on("tower:built", () => this.refresh());
    game.bus.on("tower:sold", () => this.refresh());
    game.bus.on("drone:bought", () => this.refresh());
  }

  refresh(): void {
    clear(this.el);
    this.el.append(el("div", { class: "ls-build-title", text: "TOWERS" }));
    const towerList = el("div", { class: "ls-tower-list" });
    const metaUnlocks = new Set(this.game.meta.aggregate().unlockedTowers);
    const gatedTowers = new Set(["railgun", "flamer", "barrier"]);
    for (const type of towerOrder) {
      if (gatedTowers.has(type) && !metaUnlocks.has(type)) continue;
      const def = towerDefinitions[type];
      const cost = this.game.towers.buildCost(type);
      const active = this.game.input.selectedTowerType === type;
      const affordable = this.game.core.credits >= cost;
      const btn = el("button", {
        class: `ls-tower-btn${active ? " active" : ""}${affordable ? "" : " disabled"}`,
      });
      btn.style.borderColor = def.color;
      btn.append(
        el("div", { class: "ls-tower-row" }, [
          el("span", { class: "ls-tower-key", text: def.hotkey ?? "" }),
          el("span", { class: "ls-tower-name", text: def.name }),
          el("span", { class: "ls-tower-cost", text: `${cost}CR` }),
        ]),
        el("div", { class: "ls-tower-role", text: def.role }),
      );
      btn.onclick = () => this.game.input.setBuildTool(type);
      towerList.append(btn);
    }
    this.el.append(towerList);

    this.el.append(el("div", { class: "ls-build-title", text: "DRONES" }));
    const droneList = el("div", { class: "ls-tower-list" });
    for (const type of droneOrder) {
      const def = droneDefinitions[type];
      const cost = this.game.drones.nextCost(type);
      const affordable = this.game.core.credits >= cost;
      const btn = el("button", {
        class: `ls-tower-btn${affordable ? "" : " disabled"}`,
      });
      btn.style.borderColor = def.color;
      btn.append(
        el("div", { class: "ls-tower-row" }, [
          el("span", { class: "ls-tower-name", text: def.name }),
          el("span", { class: "ls-tower-cost", text: `${cost}CR` }),
        ]),
        el("div", { class: "ls-tower-role", text: def.role }),
      );
      btn.onclick = () => this.game.drones.buy(type);
      droneList.append(btn);
    }
    this.el.append(droneList);
  }
}
