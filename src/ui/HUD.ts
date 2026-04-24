import type { Game } from "../core/Game";
import { el, clear } from "./dom";

/** Persistent top HUD: credits, core HP, wave info, speed, pause. */
export class HUD {
  el: HTMLElement;
  private creditsEl = el("span", { text: "0" });
  private coreEl = el("span", { text: "100" });
  private coreBarFill = el("div", { class: "ls-core-fill" });
  private waveEl = el("span", { text: "0/0" });
  private statusEl = el("span", { class: "ls-hud-status", text: "" });
  private speedEl = el("span", { text: "1x" });
  private startWaveBtn = el("button", { class: "ls-btn ls-start-wave", text: "START WAVE" });
  private pauseBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "PAUSE (P)" });
  private settingsBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "⚙" });
  private codexBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "CODEX" });
  private codexAlert = el("div", { class: "ls-codex-alert" });
  private bossBar = el("div", { class: "ls-boss-bar" });
  private countdownEl = el("div", { class: "ls-wave-countdown" });
  private countdownLabel = el("span", { class: "ls-wave-countdown-label", text: "NEXT WAVE IN" });
  private countdownValue = el("span", { class: "ls-wave-countdown-value", text: "--" });
  private countdownBar = el("div", { class: "ls-wave-countdown-bar" });
  private countdownFill = el("div", { class: "ls-wave-countdown-fill" });
  private rafId = 0;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-hud" });
    this.build();

    const bus = game.bus;
    bus.on("credits:changed", () => this.refresh());
    bus.on("tower:built", () => this.refresh());
    bus.on("tower:upgraded", () => this.refresh());
    bus.on("tower:sold", () => this.refresh());
    bus.on("speed:changed", () => this.refresh());
    bus.on("wave:started", () => this.refresh());
    bus.on("wave:complete", () => this.refresh());
    bus.on("boss:spawned", () => this.refresh());
    bus.on("boss:killed", () => this.refresh());
  }

  private build(): void {
    const left = el("div", { class: "ls-hud-left" });
    left.append(
      el("span", { class: "ls-hud-label", text: "CR" }), this.creditsEl,
      el("span", { class: "ls-hud-label", text: "CORE" }),
      el("div", { class: "ls-core-bar" }, [this.coreBarFill]),
      this.coreEl,
      el("span", { class: "ls-hud-label", text: "WAVE" }), this.waveEl,
      this.statusEl,
    );
    const right = el("div", { class: "ls-hud-right" });
    this.speedEl.classList.add("ls-speed");
    const speedDown = el("button", { class: "ls-btn ls-btn-ghost", text: "−" });
    speedDown.onclick = () => this.game.cycleSpeed(-1);
    const speedUp = el("button", { class: "ls-btn ls-btn-ghost", text: "+" });
    speedUp.onclick = () => this.game.cycleSpeed(1);
    right.append(
      this.startWaveBtn,
      speedDown, this.speedEl, speedUp,
      this.pauseBtn,
      this.codexBtn,
      this.settingsBtn,
    );

    this.startWaveBtn.onclick = () => {
      if (this.game.state === "PLANNING" && this.game.waves.hasMoreWaves) {
        this.game.waves.startWave(true);
      }
    };
    this.pauseBtn.onclick = () => this.game.togglePause();
    this.settingsBtn.onclick = () => this.game.ui.openSettings();
    this.codexBtn.onclick = () => this.game.ui.openCodex();

    this.countdownBar.append(this.countdownFill);
    this.countdownEl.append(this.countdownLabel, this.countdownValue, this.countdownBar);

    this.el.append(left, right, this.countdownEl, this.codexAlert, this.bossBar);

    this.game.bus.on("codex:new", (id: unknown) => this.showCodexAlert(String(id)));
    this.game.bus.on("codex:alertDismissed", () => this.hideCodexAlert());

    // Keep the countdown ticking via rAF so we don't need a full refresh.
    const tick = () => {
      this.updateCountdown();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private updateCountdown(): void {
    const w = this.game.waves;
    const show = this.game.state === "PLANNING" && w.planningCountdown > 0 && w.hasMoreWaves;
    if (!show) {
      this.countdownEl.classList.remove("visible");
      return;
    }
    this.countdownEl.classList.add("visible");
    const secs = Math.ceil(w.planningCountdown);
    this.countdownValue.textContent = `${secs}s`;
    const pct = Math.max(0, Math.min(1, w.planningCountdown / w.planningDuration));
    this.countdownFill.style.width = `${(pct * 100).toFixed(1)}%`;
    this.countdownFill.style.background =
      pct < 0.25 ? "#f44336" : pct < 0.5 ? "#ffb300" : "#66fcf1";
  }

  refresh(): void {
    const c = this.game.core;
    this.creditsEl.textContent = `${c.credits}`;
    this.coreEl.textContent = `${Math.max(0, Math.ceil(c.coreIntegrity))}/${c.coreMax}`;
    const pct = Math.max(0, Math.min(1, c.coreIntegrity / c.coreMax));
    this.coreBarFill.style.width = `${(pct * 100).toFixed(1)}%`;
    this.coreBarFill.style.background = pct < 0.3 ? "#f44336" : pct < 0.6 ? "#ffb300" : "#4caf50";

    const wave = this.game.waves.nextWaveDef;
    this.waveEl.textContent = `${Math.min(c.waveIndex + 1, this.game.waves.totalWaves)}/${this.game.waves.totalWaves}`;
    this.statusEl.textContent = wave ? wave.name : (this.game.state === "VICTORY" ? "VICTORY" : "");
    this.speedEl.textContent = `${c.speed}x`;
    this.startWaveBtn.style.display = this.game.state === "PLANNING" && this.game.waves.hasMoreWaves ? "" : "none";

    // Boss bar.
    const boss = this.game.enemies.list.find((e) => e.isBoss && e.active);
    if (boss) {
      this.bossBar.classList.add("visible");
      clear(this.bossBar);
      const pct = Math.max(0, boss.hp / boss.maxHp);
      const fill = el("div", { class: "ls-boss-fill" });
      fill.style.width = `${(pct * 100).toFixed(1)}%`;
      this.bossBar.append(
        el("div", { class: "ls-boss-label", text: `LEVIATHAN — PHASE ${Math.max(1, boss.bossPhase)}` }),
        el("div", { class: "ls-boss-track" }, [fill]),
      );
    } else {
      this.bossBar.classList.remove("visible");
    }
  }

  private showCodexAlert(id: string): void {
    this.codexAlert.classList.add("visible");
    clear(this.codexAlert);
    this.codexAlert.append(
      el("div", { class: "ls-codex-alert-title", text: "THREAT CATALOGUED" }),
      el("div", { class: "ls-codex-alert-body", text: `New enemy: ${id.toUpperCase()}` }),
    );
  }
  private hideCodexAlert(): void {
    this.codexAlert.classList.remove("visible");
  }
}
