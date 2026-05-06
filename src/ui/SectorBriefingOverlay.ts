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
  private dismissTimer = 0;
  private rafId = 0;
  private visible = false;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-sector-briefing" });
    this.bind();
    const tick = () => {
      if (this.visible && this.dismissTimer > 0) {
        this.dismissTimer -= 1 / 60;
        if (this.dismissTimer <= 0) this.hide();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
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
    this.dismissTimer = 7;
    this.el.onclick = () => this.hide();
  }

  private hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.dismissTimer = 0;
    this.el.classList.remove("visible");
  }
}
