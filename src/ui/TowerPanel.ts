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
    // Durability state changes — keep the HP/state readout live without
    // forcing the panel to re-render every frame.
    game.bus.on("tower:sabotaged", () => this.refresh());
    game.bus.on("tower:disabled", () => this.refresh());
    game.bus.on("tower:restored", () => this.refresh());
    // Lightweight 4 Hz tick so HP bar fills visibly while the tower is still
    // selected. Only re-rendering when a tower is actually selected so the
    // panel is cheap when nothing is open.
    setInterval(() => {
      if (this.game.towers.selected) this.refresh();
    }, 250);
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
    );

    // ──────────────────────────────────────────────────────────
    // Durability summary: HP bar + state label + active effects.
    // The bar color tracks state so a glance reads as
    // operational / damaged / critical / disabled.
    // ──────────────────────────────────────────────────────────
    const ds = t.durabilityState;
    const stateLabel = ds === "operational" ? "OPERATIONAL"
      : ds === "damaged" ? "DAMAGED"
      : ds === "critical" ? "CRITICAL"
      : "DISABLED";
    const stateColor = ds === "operational" ? "#9be7a7"
      : ds === "damaged" ? "#ffd54f"
      : ds === "critical" ? "#ff8a65"
      : "#ff5252";
    const hpRow = el("div", { class: "ls-tp-hp" });
    const hpLabel = el("div", { class: "ls-tp-hp-label" });
    hpLabel.innerHTML =
      `<span>HP <b>${Math.max(0, Math.round(t.hp))} / ${Math.round(t.maxHp)}</b></span>` +
      `<span class="ls-tp-hp-state" style="color:${stateColor}">${stateLabel}</span>`;
    const bar = el("div", { class: "ls-tp-hp-bar" });
    const fill = el("div", { class: "ls-tp-hp-fill" });
    fill.style.width = `${Math.max(0, Math.min(100, t.hpPct * 100)).toFixed(1)}%`;
    fill.style.background = stateColor;
    bar.append(fill);
    hpRow.append(hpLabel, bar);
    this.el.append(hpRow);

    // Active-effect chips for shielded / under repair / sabotaged.
    const effects: string[] = [];
    if (t.shielded) effects.push('<span class="ls-tp-fx ls-tp-fx-shield">SHIELDED</span>');
    if (t.underRepair) effects.push('<span class="ls-tp-fx ls-tp-fx-repair">UNDER REPAIR</span>');
    if (this.game.time.elapsed - t.lastDamagedAt < 1.5 && ds !== "operational") {
      effects.push('<span class="ls-tp-fx ls-tp-fx-hit">RECENT HIT</span>');
    }
    if (effects.length > 0) {
      this.el.append(el("div", { class: "ls-tp-fx-row", html: effects.join("") }));
    }

    this.el.append(
      el("div", { class: "ls-tp-kills", text: `Kills: ${t.kills} | Damage: ${Math.round(t.totalDamage)}` }),
      el("div", {
        class: "ls-tp-kills",
        text: t.isEco
          ? "Manual: unavailable"
          : `Manual: ${manualReady ? "READY" : `${t.manualCooldown.toFixed(1)}s`}`,
      }),
    );

    // Jammer warning banner — surfaces the suppression status so the player
    // doesn't think the tower is bugged when its fire rate falls.
    const sps = this.game.strategicPoints;
    const inJammerField = sps ? sps.isWorldPointJammed(t.pos.x, t.pos.y) : false;
    const jammerEnemyNearby = this.game.enemies.list.some(
      (e) => e.active && e.type === "jammer" && e.pos.dist(t.pos) < 80
    );
    if (inJammerField || jammerEnemyNearby) {
      this.el.append(
        el("div", {
          class: "ls-tp-jammed",
          text: "JAMMED — fire rate -30%. Repairs slowed. Destroy the source to clear.",
        })
      );
    }
    // State-driven repair hint. Disabled = top priority; damaged = soft hint.
    if (ds === "disabled") {
      this.el.append(
        el("div", { class: "ls-tp-hint ls-tp-hint-warn", text: "Tower offline. Send Engineer to restore." })
      );
    } else if (ds === "critical") {
      this.el.append(
        el("div", { class: "ls-tp-hint ls-tp-hint-warn", text: "Critical damage. Fire rate / range reduced. Engineer recommended." })
      );
    } else if (ds === "damaged") {
      this.el.append(
        el("div", { class: "ls-tp-hint", text: "Damaged. Engineer can restore HP." })
      );
    }

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

    // Reflector requires an in-range Railgun to do anything. Surface this
    // dependency directly in the panel so players don't think the tower is
    // bugged when it never fires.
    if (t.type === "reflector") {
      // 96 px buffer past the reflector's own range matches GuidanceSystem's
      // detection radius so the panel hint and onTowerBuilt hint agree.
      const r = (stats.range || 84) + 96;
      const r2 = r * r;
      const hasRailgun = this.game.towers.list.some((other) => {
        if (other === t || other.type !== "railgun") return false;
        const dx = other.pos.x - t.pos.x;
        const dy = other.pos.y - t.pos.y;
        return dx * dx + dy * dy <= r2;
      });
      this.el.append(
        el("div", {
          class: hasRailgun ? "ls-tp-hint ls-tp-hint-ok" : "ls-tp-hint ls-tp-hint-warn",
          text: hasRailgun
            ? "Railgun in range — beams will redirect through this Reflector."
            : "Requires Railgun in range — currently idle. Build a Railgun nearby or sell.",
        })
      );
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
    upg.title = `Upgrade to level ${t.level + 1}. Improves damage, range, and cooldown. (U)`;
    upg.onclick = () => this.game.towers.upgrade(t);
    if (this.game.core.credits < t.upgradeCost) upg.classList.add("disabled");
    const sell = el("button", { class: "ls-btn ls-btn-ghost", text: `SELL (${Math.floor(t.totalInvested * this.game.core.upgrades.sellRefundMul)}CR)` });
    sell.title = "Sell this tower for a partial refund. (S)";
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
