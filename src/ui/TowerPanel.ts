import type { Game } from "../core/Game";
import { towerSpecializations } from "../data/towers";
import { el, clear } from "./dom";
import type { Tower } from "../entities/Tower";
import type { TargetMode } from "../core/Types";
import { UPGRADE_COST_BASE_MUL } from "../core/Config";

/** Right-side panel shown when a tower is selected. */
export class TowerPanel {
  el: HTMLElement;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-tower-panel" });
    game.bus.on("tower:selected", () => this.refresh());
    game.bus.on("tower:upgraded", () => this.refresh());
    game.bus.on("tower:specialized", () => this.refresh());
    game.bus.on("tower:sold", () => this.refresh());
    game.bus.on("tower:manualFired", () => this.refresh());
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
    const stats = this.game.towers.effectiveStats(t);
    const synergies = this.game.towers.activeSynergies(t);
    const dps = stats.cooldown > 0 ? stats.damage / stats.cooldown : 0;
    const manualReady = t.manualCooldown <= 0;
    this.el.append(
      el("div", { class: "ls-tp-title", text: t.def.name }),
      el("div", { class: "ls-tp-role", text: t.def.role }),
      el("div", { class: "ls-tp-level", text: `Level ${t.level}` }),
      el("div", { class: "ls-tp-stats", html:
        `<div>DMG <b>${stats.damage.toFixed(1)}</b></div>` +
        `<div>RNG <b>${Math.round(stats.range)}</b></div>` +
        `<div>CD <b>${stats.cooldown.toFixed(2)}s</b></div>` +
        (!t.isEco ? `<div>DPS <b>${dps.toFixed(1)}</b></div>` : "") +
        (stats.splashRadius ? `<div>SPL <b>${Math.round(stats.splashRadius)}</b></div>` : "") +
        (stats.chainMax ? `<div>CHN <b>${stats.chainMax}</b></div>` : "") +
        (stats.income ? `<div>INC <b>${Math.round(stats.income)}/tick</b></div>` : "")
      }),
      el("div", { class: "ls-tp-kills", text: `Kills: ${t.kills} | Damage: ${Math.round(t.totalDamage)}` }),
      el("div", {
        class: "ls-tp-kills",
        text: t.isEco
          ? "Manual: unavailable"
          : `Manual: ${manualReady ? "READY" : `${t.manualCooldown.toFixed(1)}s`}`,
      }),
    );

    if (synergies.length > 0) {
      const list = el("div", { class: "ls-tp-synergy-list" });
      for (const s of synergies) {
        list.append(
          el("div", { class: "ls-tp-synergy" }, [
            el("div", { class: "ls-tp-synergy-name", text: s.name }),
            el("div", { class: "ls-tp-synergy-desc", text: s.description }),
          ])
        );
      }
      this.el.append(list);
    }

    // Targeting mode selector (not for eco towers).
    if (!t.isEco) {
      const modes: { id: TargetMode; label: string; title: string }[] = [
        { id: "closest_to_core", label: "NEAR", title: "Closest to core (default)" },
        { id: "weakest",         label: "WEAK", title: "Lowest HP enemy" },
        { id: "strongest",       label: "STRG", title: "Highest HP enemy" },
        { id: "fastest",         label: "FAST", title: "Fastest enemy" },
      ];
      const modeRow = el("div", { class: "ls-tp-target-row" });
      modeRow.append(el("span", { class: "ls-hud-label", text: "TARGET" }));
      for (const m of modes) {
        const btn = el("button", { class: "ls-btn ls-btn-ghost ls-tp-target-btn" + (t.targetMode === m.id ? " active" : ""), text: m.label });
        btn.title = m.title;
        btn.onclick = () => { t.targetMode = m.id; this.refresh(); };
        modeRow.append(btn);
      }
      this.el.append(modeRow);
    }

    const actions = el("div", { class: "ls-tp-actions" });
    const upg = el("button", { class: "ls-btn", text: `UPGRADE (${t.upgradeCost}CR)` });
    upg.onclick = () => this.game.towers.upgrade(t);
    if (this.game.core.credits < t.upgradeCost) upg.classList.add("disabled");
    const sell = el("button", { class: "ls-btn ls-btn-ghost", text: `SELL (${Math.floor(t.totalInvested * this.game.core.upgrades.sellRefundMul)}CR)` });
    sell.onclick = () => this.game.towers.sell(t);
    actions.append(upg, sell);
    this.el.append(actions);

    // Recall button: one-per-sector full refund.
    const recallUsed = this.game.core.towerRecallUsed;
    const recall = el("button", {
      class: "ls-btn ls-btn-recall" + (recallUsed ? " disabled" : ""),
      text: recallUsed ? "RECALL USED" : `RECALL (${t.totalInvested}CR — 100%)`,
    });
    recall.title = recallUsed ? "Already used this sector" : "Full refund. Once per sector.";
    if (!recallUsed) recall.onclick = () => this.game.towers.recall(t);
    this.el.append(recall);

    const costRow = el("div", { class: "ls-tp-cost-row" });
    costRow.append(el("span", { class: "ls-hud-label", text: "NEXT" }));
    for (let i = 0; i < 3; i++) {
      const level = t.level + i;
      const cost = Math.floor(t.def.cost * Math.pow(UPGRADE_COST_BASE_MUL, level - 1));
      costRow.append(el("span", { class: "ls-tp-cost-chip", text: `${cost}` }));
    }
    this.el.append(costRow);

    // Specialization.
    const tree = towerSpecializations[t.type];
    if (t.canSpecialize) {
      this.el.append(el("div", { class: "ls-tp-spec-title", text: "SPECIALIZATION AVAILABLE" }));
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
      if (t.type === "pulse" && this.game.towers.hasAdjacentLevel(t, "stasis", 3)) {
        const b = el("button", { class: "ls-tp-spec-option" });
        b.append(
          el("div", { class: "ls-tp-spec-name", text: "Cryo Proximity" }),
          el("div", { class: "ls-tp-spec-desc", text: "Cross-specialization unlocked by adjacent L3 Stasis. Pulse shots inherit a cryo field module." }),
        );
        b.onclick = () => this.game.towers.applySpecialization(t, "pulse_cryo_proximity");
        list.append(b);
      }
      this.el.append(list);
    } else if (t.specId) {
      this.el.append(el("div", { class: "ls-tp-spec-applied", text: "SPEC: " + t.specId.replace(/_/g, " ").toUpperCase() }));
    } else if (t.level >= tree.unlockLevel - 1) {
      this.el.append(el("div", { class: "ls-tp-spec-title", text: `SPECIALIZATION AT LEVEL ${tree.unlockLevel}` }));
      const list = el("div", { class: "ls-tp-spec-list" });
      for (const opt of tree.options) {
        list.append(
          el("div", { class: "ls-tp-spec-option locked" }, [
            el("div", { class: "ls-tp-spec-name", text: opt.name }),
            el("div", { class: "ls-tp-spec-desc", text: opt.description }),
          ])
        );
      }
      this.el.append(list);
    }
  }
}
