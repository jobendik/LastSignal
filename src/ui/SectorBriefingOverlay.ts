import type { Game } from "../core/Game";
import { sectorObjectives } from "../data/objectives";
import { el, clear } from "./dom";

/**
 * Brief, non-blocking sector intro shown at the start of every sector run.
 *
 * Distinct from TutorialOverlay (which is a one-time global "how to play" briefing).
 * Auto-dismisses after a few seconds or on click. Reads the sector's curated
 * primary objective + counterplay + hazard text from src/data/objectives.ts.
 */
export class SectorBriefingOverlay {
  el: HTMLElement;
  private dismissHandle: number | null = null;
  private visible = false;
  /** Seconds the briefing remains visible before auto-dismissing. */
  private readonly autoDismissSec = 7;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-sector-briefing" });
    this.bind();
  }

  private bind(): void {
    this.game.bus.on("sector:started", () => {
      // Only show if we have curated objective data for this sector.
      const id = this.game.core.sector?.id;
      if (!id || !sectorObjectives[id]) return;
      this.show();
    });
    // Hide on wave start so it never blocks gameplay readability.
    this.game.bus.on("wave:started", () => this.hide());
    // Hide whenever returning to menu / game-over to avoid stale UI.
    this.game.bus.on<{ next: string }>("state:changed", (ev) => {
      if (ev.next === "MAIN_MENU" || ev.next === "GAME_OVER" || ev.next === "VICTORY") {
        this.hide();
      }
    });
  }

  private show(): void {
    const sector = this.game.core.sector;
    if (!sector) return;
    const obj = sectorObjectives[sector.id];
    if (!obj) return;

    clear(this.el);
    this.el.append(
      el("div", { class: "ls-sb-eyebrow", text: "INCOMING ASSIGNMENT" }),
      el("div", { class: "ls-sb-name", text: sector.name }),
      el("div", { class: "ls-sb-brief", text: obj.briefing }),
      el("div", { class: "ls-sb-row", html: `<span class="ls-sb-tag">PRIMARY</span><span>${obj.primary.label}</span>` }),
    );
    if (obj.counterplay.length) {
      this.el.append(
        el("div", { class: "ls-sb-row", html: `<span class="ls-sb-tag">COUNTERS</span><span>${obj.counterplay.join(" · ")}</span>` })
      );
    }
    if (obj.hazards) {
      this.el.append(
        el("div", { class: "ls-sb-row", html: `<span class="ls-sb-tag warn">HAZARDS</span><span>${obj.hazards}</span>` })
      );
    }
    this.el.classList.add("visible");
    this.visible = true;
    this.el.onclick = () => this.hide();
    // Single setTimeout for auto-dismiss, no per-frame polling.
    this.clearDismissTimer();
    this.dismissHandle = window.setTimeout(() => this.hide(), this.autoDismissSec * 1000);
  }

  private hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.el.classList.remove("visible");
    this.clearDismissTimer();
  }

  private clearDismissTimer(): void {
    if (this.dismissHandle != null) {
      window.clearTimeout(this.dismissHandle);
      this.dismissHandle = null;
    }
  }

  /** Tear down listeners and pending timers; safe to call multiple times. */
  dispose(): void {
    this.clearDismissTimer();
    this.visible = false;
    this.el.classList.remove("visible");
    this.el.onclick = null;
  }
}
