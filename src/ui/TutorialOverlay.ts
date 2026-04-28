import type { Game } from "../core/Game";
import { el, clear } from "./dom";

export class TutorialOverlay {
  el: HTMLElement;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-overlay ls-briefing" });
    this.bind();
  }

  private bind(): void {
    this.game.bus.on("sector:started", () => this.maybeShow());
    this.game.bus.on("state:changed", ({ next }: { next: string }) => {
      if (next !== "PLANNING") {
        this.el.classList.remove("visible");
        return;
      }
      this.maybeShow();
    });
  }

  maybeShow(): void {
    const p = this.game.core.profile;
    if (p.commanderBriefingSeen) return;
    if (this.game.state !== "PLANNING") return;
    if (this.game.core.waveIndex > 0) return;
    this.refresh();
    this.el.classList.add("visible");
  }

  refresh(): void {
    clear(this.el);
    const wave = this.game.waves.nextWaveDef;
    const counters = wave?.recommendedCounters?.slice(0, 3).join(" • ") ?? "Pulse • Stasis • Mortar";
    this.el.append(
      el("div", { class: "ls-overlay-title", text: "COMMAND BRIEFING" }),
      el("div", { class: "ls-overlay-subtitle", text: "Welcome to LAST SIGNAL. Stabilize lanes, then trigger the wave when ready." }),
      el("div", { class: "ls-briefing-list", html:
        `<div>1) Build a front line near active lanes.</div>
         <div>2) Mix <b>damage + control</b> towers.</div>
         <div>3) Keep <b>30 credits</b> in reserve for repairs.</div>
         <div>4) Use <b>Space</b> to start a wave early for bonus credits.</div>
         <div class="ls-briefing-counters">Recommended counters: <b>${counters}</b></div>` }),
    );

    const row = el("div", { class: "ls-overlay-actions" });
    const ok = el("button", { class: "ls-btn ls-btn-primary", text: "Deploy" });
    ok.onclick = () => this.close(true);
    const remind = el("button", { class: "ls-btn", text: "Show Again Next Run" });
    remind.onclick = () => this.close(false);
    row.append(ok, remind);
    this.el.append(row);
  }

  private close(markSeen: boolean): void {
    this.el.classList.remove("visible");
    if (!markSeen) return;
    this.game.core.profile.commanderBriefingSeen = true;
    this.game.persistence.saveProfile(this.game.core.profile);
  }
}
