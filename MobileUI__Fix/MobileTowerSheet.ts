import type { Game } from "../../core/Game";
import { el, clear } from "./dom";
import type { MobileShell } from "./MobileShell";
import type { Tower, TargetingMode } from "../../core/Types";

/**
 * MobileTowerSheet — bottom sheet that opens when the player taps an existing
 * tower. Shows:
 *   • Header: name, level chip, close ✕, drag handle (swipe-down to dismiss).
 *   • HP bar + state label.
 *   • Stats triplet (DPS / RNG / FIRE).
 *   • Status effect chips (jammed / shield / repair / hit).
 *   • Action chips: UPGRADE, SELL, TARGET▼ (expandable row of modes), DETAILS toggle.
 *   • Specialization picker once eligible (T2 → two paths each with a one-line description).
 *   • Optional details accordion mirroring TowerPanel's deeper breakdown.
 *
 * Designed to sit ABOVE the build/squad drawer; opening the sheet collapses
 * the drawer (MobileShell handles that coordination). Swipe-down on the drag
 * handle dismisses.
 */
export class MobileTowerSheet {
  el: HTMLElement;
  isOpen = false;

  private head: HTMLElement;
  private body: HTMLElement;

  private detailsOpen = false;
  private targetRowOpen = false;

  private rafId = 0;
  private lastSig = "";
  private lastTowerId: string | null = null;

  // Drag-to-dismiss state.
  private dragStartY = -1;
  private dragLastY = -1;

  constructor(private readonly game: Game, private readonly shell: MobileShell) {
    this.el = el("div", { class: "ls-msheet" });
    this.head = el("div", { class: "ls-msheet-head" });
    this.body = el("div", { class: "ls-msheet-body" });
    this.el.append(this.head, this.body);

    // Swipe-down on the sheet head dismisses.
    this.head.addEventListener("touchstart", (ev) => {
      this.dragStartY = ev.touches[0].clientY;
      this.dragLastY = this.dragStartY;
    }, { passive: true });
    this.head.addEventListener("touchmove", (ev) => {
      if (this.dragStartY < 0) return;
      this.dragLastY = ev.touches[0].clientY;
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
    const t = this.game.towers.selected;
    if (!t) return;
    this.isOpen = true;
    this.el.classList.add("open");
    if (t.instanceId !== this.lastTowerId) {
      // New tower — reset accordion state so we don't leak the previous tower's view.
      this.detailsOpen = false;
      this.targetRowOpen = false;
      this.lastTowerId = t.instanceId;
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
    // Tell the game system to clear selection too.
    if (this.game.towers.selected) {
      this.game.towers.clearSelection();
    }
  }

  private startTick(): void {
    const tick = () => {
      if (this.isOpen) this.refresh();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  // ──────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────
  private refresh(): void {
    const t = this.game.towers.selected;
    if (!t) { this.close(); return; }
    // Build a render signature so we only repaint on meaningful change.
    const sig = [
      t.instanceId,
      Math.round(t.health),
      t.level,
      t.upgradeCost,
      t.sellValue,
      t.targetingMode,
      t.specialization ?? "_",
      t.durabilityState,
      t.jamRemaining > 0 ? "J" : "_",
      t.shieldRemaining > 0 ? "S" : "_",
      t.repairTickRemaining > 0 ? "R" : "_",
      this.game.core.credits,
      this.detailsOpen ? "D" : "_",
      this.targetRowOpen ? "T" : "_",
    ].join("|");
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.renderHead(t);
    this.renderBody(t);
  }

  private renderHead(t: Tower): void {
    clear(this.head);
    this.head.append(el("div", { class: "ls-msheet-handle" }));
    const title = el("div", { class: "ls-msheet-title", text: t.def.name });
    const lvl = el("div", { class: "ls-msheet-lvl", text: `L${t.level}` });
    lvl.style.borderColor = t.def.color;
    lvl.style.color = t.def.color;
    const closeBtn = el("button", { class: "ls-msheet-close", text: "✕" });
    closeBtn.onclick = () => this.close();
    this.head.append(title, lvl, closeBtn);
  }

  private renderBody(t: Tower): void {
    clear(this.body);

    // HP bar.
    const hpBar = el("div", { class: "ls-msheet-hp" });
    const hpFill = el("div", { class: "ls-msheet-hp-fill" });
    const hpPct = Math.max(0, t.health / t.maxHealth);
    hpFill.style.width = `${(hpPct * 100).toFixed(0)}%`;
    const hpColor =
      t.durabilityState === "disabled" ? "var(--ls-m-danger)" :
      t.durabilityState === "critical" ? "var(--ls-m-danger)" :
      t.durabilityState === "wounded" ? "var(--ls-m-warning)" : "var(--ls-m-good)";
    hpFill.style.background = hpColor;
    hpBar.append(hpFill);
    const hpLabel = el("div", { class: "ls-msheet-hp-label" });
    hpLabel.append(
      el("span", { text: `HP ${Math.max(0, Math.ceil(t.health))}/${t.maxHealth}` }),
      el("span", { class: "ls-msheet-state", text: this.durabilityLabel(t.durabilityState) }),
    );
    this.body.append(hpBar, hpLabel);

    // Status effect chips.
    const fxRow = el("div", { class: "ls-msheet-fx-row" });
    let fxCount = 0;
    if (t.jamRemaining > 0) {
      fxRow.append(el("span", { class: "ls-msheet-fx jammed", text: `JAMMED ${Math.ceil(t.jamRemaining)}s` }));
      fxCount++;
    }
    if (t.shieldRemaining > 0) {
      fxRow.append(el("span", { class: "ls-msheet-fx shield", text: `SHIELD ${Math.ceil(t.shieldRemaining)}s` }));
      fxCount++;
    }
    if (t.repairTickRemaining > 0) {
      fxRow.append(el("span", { class: "ls-msheet-fx repair", text: "REPAIRING" }));
      fxCount++;
    }
    if (t.recentHitFlash > 0) {
      fxRow.append(el("span", { class: "ls-msheet-fx hit", text: "HIT" }));
      fxCount++;
    }
    if (fxCount > 0) this.body.append(fxRow);

    // Stat triplet.
    const stats = el("div", { class: "ls-msheet-stats" });
    const dps = t.def.role === "Support" || t.def.role === "Economy"
      ? "—"
      : `${Math.round((t.damage / Math.max(0.05, t.fireCooldown)) * 10) / 10}`;
    stats.append(
      this.statBlock("DPS", dps),
      this.statBlock("RNG", `${Math.round(t.range)}`),
      this.statBlock("FIRE", `${(1 / Math.max(0.05, t.fireCooldown)).toFixed(2)}/s`),
    );
    this.body.append(stats);

    // Primary action chips: UPGRADE, SELL, TARGET▼, DETAILS▼.
    const upgradeCap = t.level >= t.maxLevel;
    const upgradeAfford = !upgradeCap && this.game.core.credits >= t.upgradeCost;
    const disabledByHP = t.durabilityState === "disabled";

    const actions = el("div", { class: "ls-msheet-actions three" });

    const upgradeBtn = el("button", {
      class: `ls-msheet-act${upgradeAfford ? "" : " disabled"}`,
    });
    upgradeBtn.append(
      el("div", { class: "ls-msheet-act-label", text: upgradeCap ? "MAX LV" : "UPGRADE" }),
      el("div", { class: "ls-msheet-act-cost", text: upgradeCap ? "—" : `${t.upgradeCost} CR` }),
    );
    upgradeBtn.onclick = () => {
      if (!upgradeAfford) { this.shell.haptic(40); return; }
      this.game.towers.upgrade(t);
      this.shell.haptic([8, 20, 8]);
    };

    const sellBtn = el("button", { class: "ls-msheet-act warning" });
    sellBtn.append(
      el("div", { class: "ls-msheet-act-label", text: "SELL" }),
      el("div", { class: "ls-msheet-act-cost", text: `+${t.sellValue}` }),
    );
    sellBtn.onclick = () => {
      this.game.towers.sell(t);
      this.shell.haptic([10, 30]);
      this.close();
    };

    const targetBtn = el("button", {
      class: `ls-msheet-act${disabledByHP ? " disabled" : ""}${this.targetRowOpen ? " active" : ""}`,
    });
    targetBtn.append(
      el("div", { class: "ls-msheet-act-label", text: "TARGET" }),
      el("div", { class: "ls-msheet-act-cost", text: this.targetingLabel(t.targetingMode) }),
    );
    targetBtn.onclick = () => {
      if (disabledByHP) return;
      this.targetRowOpen = !this.targetRowOpen;
      this.lastSig = "";
      this.refresh();
      this.shell.haptic(6);
    };

    actions.append(upgradeBtn, sellBtn, targetBtn);
    this.body.append(actions);

    // Expanded targeting row.
    if (this.targetRowOpen) {
      const row = el("div", { class: "ls-msheet-target-row" });
      const modes: TargetingMode[] = ["first", "last", "strongest", "weakest", "closest"];
      for (const m of modes) {
        const b = el("button", {
          class: `ls-msheet-target-btn${t.targetingMode === m ? " active" : ""}`,
          text: m.toUpperCase(),
        });
        b.onclick = () => {
          this.game.towers.setTargetingMode(t, m);
          this.shell.haptic(4);
        };
        row.append(b);
      }
      this.body.append(row);
    }

    // Specialization picker (only if eligible and not yet chosen).
    if (t.level >= 2 && !t.specialization && t.specializationOptions && t.specializationOptions.length > 0) {
      const sp = el("div", { class: "ls-msheet-spec" });
      sp.append(el("div", { class: "ls-msheet-spec-title", text: "CHOOSE SPECIALIZATION" }));
      for (const opt of t.specializationOptions) {
        const card = el("button", { class: "ls-msheet-spec-opt" });
        card.append(
          el("div", { class: "ls-msheet-spec-name", text: opt.name }),
          el("div", { class: "ls-msheet-spec-desc", text: opt.description }),
        );
        card.onclick = () => {
          this.game.towers.applySpecialization(t, opt.id);
          this.shell.haptic([10, 30, 10]);
        };
        sp.append(card);
      }
      this.body.append(sp);
    } else if (t.specialization) {
      const sp = el("div", { class: "ls-msheet-spec-applied" });
      sp.append(
        el("span", { class: "ls-msheet-spec-applied-label", text: "SPEC:" }),
        el("span", { class: "ls-msheet-spec-applied-name", text: t.specialization.name }),
      );
      this.body.append(sp);
    }

    // Disabled hint.
    if (disabledByHP) {
      const hint = el("div", { class: "ls-msheet-hint warn", text: "OFFLINE — repair required to resume fire." });
      this.body.append(hint);
    }

    // DETAILS toggle row.
    const detailsToggle = el("button", { class: `ls-msheet-details-toggle${this.detailsOpen ? " open" : ""}` });
    detailsToggle.append(
      el("span", { text: this.detailsOpen ? "HIDE DETAILS ▴" : "DETAILS ▾" }),
    );
    detailsToggle.onclick = () => {
      this.detailsOpen = !this.detailsOpen;
      this.lastSig = "";
      this.refresh();
      this.shell.haptic(4);
    };
    this.body.append(detailsToggle);

    if (this.detailsOpen) {
      const details = el("div", { class: "ls-msheet-details" });
      details.append(this.detailLine("Damage", `${Math.round(t.damage)}`));
      details.append(this.detailLine("Reload", `${(t.fireCooldown).toFixed(2)}s`));
      details.append(this.detailLine("Range", `${Math.round(t.range)}`));
      if (t.def.splashRadius) details.append(this.detailLine("Splash", `${Math.round(t.def.splashRadius)}`));
      if (t.amplifierBoost > 0) details.append(this.detailLine("Amp boost", `+${Math.round(t.amplifierBoost * 100)}%`));
      if (t.reflectorCharges > 0) details.append(this.detailLine("Reflect charges", `${t.reflectorCharges}`));
      details.append(this.detailLine("Investment", `${t.totalInvested} CR`));
      details.append(this.detailLine("Sell return", `${t.sellValue} CR (${Math.round((t.sellValue / Math.max(1, t.totalInvested)) * 100)}%)`));
      details.append(this.detailLine("Role", t.def.role));
      details.append(this.detailLine("Description", t.def.description));
      this.body.append(details);
    }
  }

  private statBlock(label: string, value: string): HTMLElement {
    const w = el("div", { class: "ls-msheet-stat" });
    w.append(
      el("div", { class: "ls-msheet-stat-label", text: label }),
      el("div", { class: "ls-msheet-stat-value", text: value }),
    );
    return w;
  }

  private detailLine(label: string, value: string): HTMLElement {
    const r = el("div", { class: "ls-msheet-detail-line" });
    r.append(
      el("span", { class: "ls-msheet-detail-label", text: label }),
      el("span", { class: "ls-msheet-detail-value", text: value }),
    );
    return r;
  }

  private durabilityLabel(d: Tower["durabilityState"]): string {
    switch (d) {
      case "intact": return "INTACT";
      case "wounded": return "WOUNDED";
      case "critical": return "CRITICAL";
      case "disabled": return "OFFLINE";
      default: return String(d).toUpperCase();
    }
  }

  private targetingLabel(m: TargetingMode): string {
    switch (m) {
      case "first": return "FIRST";
      case "last": return "LAST";
      case "strongest": return "STRONG";
      case "weakest": return "WEAK";
      case "closest": return "CLOSE";
      default: return "FIRST";
    }
  }
}
