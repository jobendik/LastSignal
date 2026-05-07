import type { Game } from "../core/Game";
import { sectorObjectives } from "../data/objectives";
import { el, clear } from "./dom";

/**
 * Brief, non-blocking sector intro shown at the start of every sector run.
 *
 * Layout:
 *   - Eyebrow ("INCOMING ASSIGNMENT")
 *   - Sector name
 *   - 2-3 sentence briefing (mission identity)
 *   - Primary objective row
 *   - Recommended counters row
 *   - Hazards row (if any)
 *   - "New this sector" callout when the sector introduces a major mechanic.
 *
 * Auto-dismisses after a few seconds or on click. Hides on wave start so it
 * never blocks gameplay readability.
 */
export class SectorBriefingOverlay {
  el: HTMLElement;
  private dismissHandle: number | null = null;
  private visible = false;
  /** Seconds the briefing remains visible before auto-dismissing. */
  private readonly autoDismissSec = 8;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-sector-briefing" });
    this.bind();
  }

  private bind(): void {
    this.game.bus.on("sector:started", () => {
      const id = this.game.core.sector?.id;
      if (!id || !sectorObjectives[id]) return;
      this.show();
    });
    this.game.bus.on("wave:started", () => this.hide());
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
      el("div", {
        class: "ls-sb-row",
        html: `<span class="ls-sb-tag">PRIMARY</span><span>${obj.primary.label}</span>`,
      })
    );

    // Secondary objectives (top 2) so the player sees what bonuses are at stake.
    const sec = obj.secondary?.slice(0, 2) ?? [];
    if (sec.length > 0) {
      const secondaryHtml = sec
        .map((s) => `<span class="ls-sb-secondary">+ ${s.label}</span>`)
        .join("");
      this.el.append(
        el("div", {
          class: "ls-sb-row",
          html: `<span class="ls-sb-tag">SECONDARY</span><span>${secondaryHtml}</span>`,
        })
      );
    }

    if (obj.counterplay.length) {
      this.el.append(
        el("div", {
          class: "ls-sb-row",
          html: `<span class="ls-sb-tag">COUNTERS</span><span>${obj.counterplay.join(" · ")}</span>`,
        })
      );
    }
    if (obj.hazards) {
      this.el.append(
        el("div", {
          class: "ls-sb-row",
          html: `<span class="ls-sb-tag warn">HAZARDS</span><span>${obj.hazards}</span>`,
        })
      );
    }

    // Mechanics-introduced callout for sectors that add a major system.
    const mechanic = newMechanicForSector(sector.id);
    if (mechanic) {
      const callout = el("div", { class: "ls-sb-mechanic" });
      callout.append(
        el("span", { class: "ls-sb-mechanic-tag", text: "NEW" }),
        el("span", { class: "ls-sb-mechanic-text", text: mechanic })
      );
      this.el.append(callout);
    }

    // Footer hint.
    this.el.append(
      el("div", { class: "ls-sb-footer", text: "Click to dismiss · Press H for the field manual" })
    );

    this.el.classList.add("visible");
    this.visible = true;
    this.el.onclick = () => this.hide();
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

/**
 * One-line summary of the major mechanic this sector introduces. Returns
 * null for sectors that don't add a new system on top of the basics.
 */
function newMechanicForSector(id: string): string | null {
  switch (id) {
    case "sector_03_deep_space_wreckage":
      return "Strategic capture points — capture the abandoned turret for a free forward gun.";
    case "sector_06_fractured_expanse":
      return "Relay expansion + map control. Roll relays outward; capture nodes, radar, and turrets.";
    case "sector_07_blackout_array":
      return "Hostile suppression. Dismantle rift anchors and jammers. Tower durability matters.";
    default:
      return null;
  }
}
