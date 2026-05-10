import type { Game } from "../../core/Game";
import type { TargetMode } from "../../core/Types";
import type { Tower } from "../../entities/Tower";
import { towerSpecializations } from "../../data/towers";
import { clear, el } from "./dom";
import type { MobileShell } from "./MobileShell";

export class MobileTowerSheet {
  el: HTMLElement;
  isOpen = false;

  private head: HTMLElement;
  private body: HTMLElement;
  private detailsOpen = false;
  private targetRowOpen = false;
  private lastSig = "";
  private lastTowerId: string | null = null;
  private dragStartY = -1;
  private dragLastY = -1;

  constructor(private readonly game: Game, private readonly shell: MobileShell) {
    this.el = el("div", { class: "ls-msheet" });
    this.head = el("div", { class: "ls-msheet-head" });
    this.body = el("div", { class: "ls-msheet-body" });
    this.el.append(this.head, this.body);

    this.head.addEventListener("touchstart", (ev) => {
      this.dragStartY = ev.touches[0]?.clientY ?? -1;
      this.dragLastY = this.dragStartY;
    }, { passive: true });
    this.head.addEventListener("touchmove", (ev) => {
      if (this.dragStartY < 0) return;
      this.dragLastY = ev.touches[0]?.clientY ?? this.dragLastY;
      const dy = Math.max(0, this.dragLastY - this.dragStartY);
      this.el.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    const endDrag = () => {
      if (this.dragStartY < 0) return;
      const dy = this.dragLastY - this.dragStartY;
      this.el.style.transform = "";
      this.dragStartY = -1;
      this.dragLastY = -1;
      if (dy > 60) this.close();
    };
    this.head.addEventListener("touchend", endDrag);
    this.head.addEventListener("touchcancel", endDrag);

    this.startTick();
  }

  open(): void {
    const tower = this.game.towers.selected;
    if (!tower) return;
    this.isOpen = true;
    this.el.classList.add("open");
    const id = this.towerId(tower);
    if (id !== this.lastTowerId) {
      this.detailsOpen = false;
      this.targetRowOpen = false;
      this.lastTowerId = id;
    }
    this.lastSig = "";
    this.refresh();
    this.shell.haptic(6);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove("open");
    this.el.style.transform = "";
    if (this.game.towers.selected) {
      this.game.towers.selected = null;
      this.game.bus.emit("tower:selected", null);
    }
  }

  private startTick(): void {
    const tick = () => {
      if (this.isOpen) this.refresh();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private refresh(): void {
    const tower = this.game.towers.selected;
    if (!tower) {
      this.isOpen = false;
      this.el.classList.remove("open");
      return;
    }

    const stats = this.game.towers.effectiveStats(tower);
    const sig = [
      this.towerId(tower),
      Math.round(tower.hp),
      Math.round(tower.maxHp),
      tower.level,
      tower.upgradeCost,
      tower.sellValue,
      tower.targetMode,
      tower.specId ?? "_",
      tower.pinnacleId ?? "_",
      tower.durabilityState,
      tower.shielded ? "S" : "_",
      tower.underRepair ? "R" : "_",
      this.isJammed(tower) ? "J" : "_",
      Math.round(stats.damage * 10),
      Math.round(stats.range),
      Math.round(stats.cooldown * 100),
      this.game.core.credits,
      this.detailsOpen ? "D" : "_",
      this.targetRowOpen ? "T" : "_",
    ].join("|");
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    this.renderHead(tower);
    this.renderBody(tower, stats);
  }

  private renderHead(tower: Tower): void {
    clear(this.head);
    this.head.append(el("div", { class: "ls-msheet-handle" }));
    const title = el("div", { class: "ls-msheet-title", text: tower.def.name });
    const level = el("div", { class: "ls-msheet-lvl", text: `L${tower.level}` });
    level.style.borderColor = tower.def.color;
    level.style.color = tower.def.color;
    const closeBtn = el("button", { class: "ls-msheet-close", text: "X" });
    closeBtn.onclick = () => this.close();
    this.head.append(title, level, closeBtn);
  }

  private renderBody(tower: Tower, stats: ReturnType<Game["towers"]["effectiveStats"]>): void {
    clear(this.body);

    const hpPct = Math.max(0, tower.hp / Math.max(1, tower.maxHp));
    const hpFill = el("div", { class: "ls-msheet-hp-fill" });
    hpFill.style.width = `${(hpPct * 100).toFixed(0)}%`;
    hpFill.style.background = this.durabilityColor(tower);
    const hpBar = el("div", { class: "ls-msheet-hp" }, [hpFill]);
    const hpLabel = el("div", { class: "ls-msheet-hp-label" }, [
      el("span", { text: `HP ${Math.max(0, Math.ceil(tower.hp))}/${tower.maxHp}` }),
      el("span", { class: "ls-msheet-state", text: this.durabilityLabel(tower) }),
    ]);
    this.body.append(hpBar, hpLabel);

    const fxRow = el("div", { class: "ls-msheet-fx-row" });
    if (this.isJammed(tower)) fxRow.append(el("span", { class: "ls-msheet-fx jammed", text: "JAMMED" }));
    if (tower.shielded) fxRow.append(el("span", { class: "ls-msheet-fx shield", text: "SHIELDED" }));
    if (tower.underRepair) fxRow.append(el("span", { class: "ls-msheet-fx repair", text: "REPAIRING" }));
    if (tower.damageFlashTimer > 0) fxRow.append(el("span", { class: "ls-msheet-fx hit", text: "HIT" }));
    if (fxRow.childElementCount > 0) this.body.append(fxRow);

    const dps = tower.isEco || stats.damage <= 0
      ? "-"
      : `${Math.round((stats.damage / Math.max(0.05, stats.cooldown)) * 10) / 10}`;
    this.body.append(el("div", { class: "ls-msheet-stats" }, [
      this.statBlock("DPS", dps),
      this.statBlock("RNG", `${Math.round(stats.range)}`),
      this.statBlock("FIRE", `${(1 / Math.max(0.05, stats.cooldown)).toFixed(2)}/s`),
    ]));

    this.renderActions(tower);
    this.renderSpecialization(tower);

    if (tower.durabilityState === "disabled") {
      this.body.append(el("div", { class: "ls-msheet-hint warn", text: "OFFLINE - send Engineer to repair." }));
    }

    const detailsToggle = el("button", { class: `ls-msheet-details-toggle${this.detailsOpen ? " open" : ""}` }, [
      el("span", { text: this.detailsOpen ? "HIDE DETAILS" : "DETAILS" }),
    ]);
    detailsToggle.onclick = () => {
      this.detailsOpen = !this.detailsOpen;
      this.lastSig = "";
      this.refresh();
      this.shell.haptic(4);
    };
    this.body.append(detailsToggle);

    if (this.detailsOpen) this.renderDetails(tower, stats);
  }

  private renderActions(tower: Tower): void {
    const disabledByHP = tower.durabilityState === "disabled";
    const canUpgrade = this.game.core.credits >= tower.upgradeCost;
    const actions = el("div", { class: "ls-msheet-actions three" });

    const upgradeBtn = el("button", { class: `ls-msheet-act${canUpgrade ? "" : " disabled"}` });
    upgradeBtn.append(
      el("div", { class: "ls-msheet-act-label", text: "UPGRADE" }),
      el("div", { class: "ls-msheet-act-cost", text: `${tower.upgradeCost} CR` }),
    );
    upgradeBtn.onclick = () => {
      if (!canUpgrade) {
        this.shell.haptic(40);
        return;
      }
      this.game.towers.upgrade(tower);
      this.shell.haptic([8, 20, 8]);
    };

    const sellBtn = el("button", { class: "ls-msheet-act warning" });
    sellBtn.append(
      el("div", { class: "ls-msheet-act-label", text: "SELL" }),
      el("div", { class: "ls-msheet-act-cost", text: `+${tower.sellValue}` }),
    );
    sellBtn.onclick = () => {
      this.game.towers.sell(tower);
      this.shell.haptic([10, 30]);
      this.close();
    };

    const targetBtn = el("button", {
      class: `ls-msheet-act${disabledByHP || tower.isEco ? " disabled" : ""}${this.targetRowOpen ? " active" : ""}`,
    });
    targetBtn.append(
      el("div", { class: "ls-msheet-act-label", text: "TARGET" }),
      el("div", { class: "ls-msheet-act-cost", text: this.targetingLabel(tower.targetMode) }),
    );
    targetBtn.onclick = () => {
      if (disabledByHP || tower.isEco) return;
      this.targetRowOpen = !this.targetRowOpen;
      this.lastSig = "";
      this.refresh();
      this.shell.haptic(6);
    };

    actions.append(upgradeBtn, sellBtn, targetBtn);
    this.body.append(actions);

    if (this.targetRowOpen) {
      const row = el("div", { class: "ls-msheet-target-row" });
      const modes: TargetMode[] = ["closest_to_core", "weakest", "strongest", "fastest"];
      for (const mode of modes) {
        const btn = el("button", {
          class: `ls-msheet-target-btn${tower.targetMode === mode ? " active" : ""}`,
          text: this.targetingLabel(mode),
        });
        btn.onclick = () => {
          tower.targetMode = mode;
          this.lastSig = "";
          this.refresh();
          this.shell.haptic(4);
        };
        row.append(btn);
      }
      this.body.append(row);
    }
  }

  private renderSpecialization(tower: Tower): void {
    const tree = towerSpecializations[tower.type];
    if (tower.canSpecialize) {
      const wrap = el("div", { class: "ls-msheet-spec" });
      wrap.append(el("div", { class: "ls-msheet-spec-title", text: "CHOOSE SPECIALIZATION" }));
      for (const opt of tree.options) {
        const card = el("button", { class: "ls-msheet-spec-opt" });
        card.append(
          el("div", { class: "ls-msheet-spec-name", text: opt.name }),
          el("div", { class: "ls-msheet-spec-desc", text: opt.description }),
        );
        card.onclick = () => {
          this.game.towers.applySpecialization(tower, opt.id);
          this.shell.haptic([10, 30, 10]);
        };
        wrap.append(card);
      }
      this.body.append(wrap);
      return;
    }

    if (tower.specId) {
      this.body.append(el("div", { class: "ls-msheet-spec-applied" }, [
        el("span", { class: "ls-msheet-spec-applied-label", text: "SPEC:" }),
        el("span", { class: "ls-msheet-spec-applied-name", text: tower.specId.replace(/_/g, " ").toUpperCase() }),
      ]));
    }
  }

  private renderDetails(tower: Tower, stats: ReturnType<Game["towers"]["effectiveStats"]>): void {
    const details = el("div", { class: "ls-msheet-details" });
    details.append(this.detailLine("Damage", `${Math.round(stats.damage)}`));
    details.append(this.detailLine("Reload", `${stats.cooldown.toFixed(2)}s`));
    details.append(this.detailLine("Range", `${Math.round(stats.range)}`));
    if (stats.splashRadius) details.append(this.detailLine("Splash", `${Math.round(stats.splashRadius)}`));
    if (stats.chainMax) details.append(this.detailLine("Chain", `${stats.chainMax}`));
    if (stats.income) details.append(this.detailLine("Income", `${Math.round(stats.income)}/tick`));
    details.append(this.detailLine("Kills", `${tower.kills}`));
    details.append(this.detailLine("Damage done", `${Math.round(tower.totalDamage)}`));
    details.append(this.detailLine("Investment", `${tower.totalInvested} CR`));
    details.append(this.detailLine("Sell return", `${tower.sellValue} CR`));
    details.append(this.detailLine("Role", tower.def.role));
    details.append(this.detailLine("Description", tower.def.description));
    this.body.append(details);
  }

  private statBlock(label: string, value: string): HTMLElement {
    return el("div", { class: "ls-msheet-stat" }, [
      el("div", { class: "ls-msheet-stat-label", text: label }),
      el("div", { class: "ls-msheet-stat-value", text: value }),
    ]);
  }

  private detailLine(label: string, value: string): HTMLElement {
    return el("div", { class: "ls-msheet-detail-line" }, [
      el("span", { class: "ls-msheet-detail-label", text: label }),
      el("span", { class: "ls-msheet-detail-value", text: value }),
    ]);
  }

  private durabilityColor(tower: Tower): string {
    switch (tower.durabilityState) {
      case "disabled":
      case "critical":
        return "var(--ls-m-danger)";
      case "damaged":
        return "var(--ls-m-warning)";
      default:
        return "var(--ls-m-good)";
    }
  }

  private durabilityLabel(tower: Tower): string {
    switch (tower.durabilityState) {
      case "operational": return "OPERATIONAL";
      case "damaged": return "DAMAGED";
      case "critical": return "CRITICAL";
      case "disabled": return "OFFLINE";
      case "destroyed": return "DESTROYED";
      default: return String(tower.durabilityState).toUpperCase();
    }
  }

  private targetingLabel(mode: TargetMode): string {
    switch (mode) {
      case "closest_to_core": return "NEAR";
      case "weakest": return "WEAK";
      case "strongest": return "STRONG";
      case "fastest": return "FAST";
    }
  }

  private isJammed(tower: Tower): boolean {
    const sps = this.game.strategicPoints;
    return Boolean(sps?.isWorldPointJammed(tower.pos.x, tower.pos.y)) ||
      this.game.enemies.list.some((e) => e.active && e.type === "jammer" && e.pos.dist(tower.pos) < 80);
  }

  private towerId(tower: Tower): string {
    return `${tower.type}:${tower.c}:${tower.r}`;
  }
}
