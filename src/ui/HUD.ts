import type { Game } from "../core/Game";
import { enemyDefinitions } from "../data/enemies";
import { el, clear } from "./dom";

/** Persistent top HUD: credits, core HP, wave info, speed, pause. */
export class HUD {
  el: HTMLElement;
  private creditsEl = el("span", { text: "0" });
  private coreEl = el("span", { text: "100" });
  private coreSegments: HTMLElement[] = [];
  private coreBarEl = el("div", { class: "ls-core-bar-segmented" });
  private waveEl = el("span", { text: "0/0" });
  private statusEl = el("span", { class: "ls-hud-status", text: "" });
  private speedEl = el("span", { text: "1x" });
  private startWaveBtn = el("button", { class: "ls-btn ls-start-wave", text: "START WAVE" });
  private repairBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "REPAIR 30" });
  private empBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "EMP" });
  private pauseBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "PAUSE (P)" });
  private settingsBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "⚙" });
  private codexBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "CODEX" });
  private codexAlert = el("div", { class: "ls-codex-alert" });
  private bossBar = el("div", { class: "ls-boss-bar" });
  private modifierStrip = el("div", { class: "ls-modifier-strip" });
  private countdownEl = el("div", { class: "ls-wave-countdown" });
  private countdownLabel = el("span", { class: "ls-wave-countdown-label", text: "NEXT WAVE IN" });
  private countdownValue = el("span", { class: "ls-wave-countdown-value", text: "--" });
  private countdownBar = el("div", { class: "ls-wave-countdown-bar" });
  private countdownFill = el("div", { class: "ls-wave-countdown-fill" });
  private waveIntel = el("div", { class: "ls-wave-intel" });
  private waveTimeline = el("div", { class: "ls-wave-timeline" });
  private criticalOverlay = el("div", { class: "ls-critical-overlay" });
  private rafId = 0;
  private displayedCredits = 0;
  private targetCredits = 0;
  private creditsPrimed = false;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-hud" });
    this.build();

    const bus = game.bus;
    bus.on("credits:changed", () => this.refresh());
    bus.on("tower:built", () => this.refresh());
    bus.on("tower:upgraded", () => this.refresh());
    bus.on("tower:sold", () => this.refresh());
    bus.on("speed:changed", () => {
      this.refresh();
      this.speedEl.classList.remove("ls-speed-flash");
      void this.speedEl.offsetWidth; // reflow
      this.speedEl.classList.add("ls-speed-flash");
    });
    bus.on("wave:started", () => this.refresh());
    bus.on("wave:complete", () => this.refresh());
    bus.on("boss:spawned", () => this.refresh());
    bus.on("boss:killed", () => this.refresh());
    bus.on("core:repaired", () => this.refresh());
    bus.on("core:ability", () => this.refresh());
    bus.on("core:emergency", () => this.refresh());
    bus.on("sector:started", () => this.refresh());
  }

  private build(): void {
    // Build 10 core integrity segments.
    for (let i = 0; i < 10; i++) {
      const seg = el("div", { class: "ls-core-segment" });
      this.coreSegments.push(seg);
      this.coreBarEl.append(seg);
    }

    const left = el("div", { class: "ls-hud-left" });
    left.append(
      el("span", { class: "ls-hud-label", text: "CR" }), this.creditsEl,
      el("span", { class: "ls-hud-label", text: "CORE" }),
      this.coreBarEl,
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
      this.repairBtn,
      this.empBtn,
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
    this.repairBtn.onclick = () => this.game.repairCore();
    this.empBtn.onclick = () => this.game.activateCoreAbility();
    this.settingsBtn.onclick = () => this.game.ui.openSettings();
    this.codexBtn.onclick = () => this.game.ui.openCodex();

    this.countdownBar.append(this.countdownFill);
    this.countdownEl.append(this.countdownLabel, this.countdownValue, this.countdownBar);

    this.el.append(
      left,
      right,
      this.countdownEl,
      this.waveIntel,
      this.waveTimeline,
      this.codexAlert,
      this.modifierStrip,
      this.bossBar,
      this.criticalOverlay
    );

    this.game.bus.on("codex:new", (id: unknown) => this.showCodexAlert(String(id)));
    this.game.bus.on("codex:alertDismissed", () => this.hideCodexAlert());

    // Keep the countdown ticking via rAF so we don't need a full refresh.
    const tick = () => {
      this.updateCreditsDisplay();
      this.updateCountdown();
      this.updateWaveIntel();
      this.updateCoreActions();
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
    this.targetCredits = c.credits;
    if (!this.creditsPrimed) {
      this.displayedCredits = c.credits;
      this.creditsPrimed = true;
      this.creditsEl.textContent = `${c.credits}`;
    }
    this.coreEl.textContent = `${Math.max(0, Math.ceil(c.coreIntegrity))}/${c.coreMax}`;
    const pct = Math.max(0, Math.min(1, c.coreIntegrity / c.coreMax));
    // Update 10 segments: segments light up left-to-right based on HP%.
    const litCount = Math.ceil(pct * 10);
    const isCritical = pct < 0.3;
    const segColor = pct < 0.3 ? "#f44336" : pct < 0.6 ? "#ffb300" : "#4caf50";
    this.coreBarEl.classList.toggle("critical", isCritical);
    for (let i = 0; i < 10; i++) {
      const seg = this.coreSegments[i]!;
      if (i < litCount) {
        seg.style.background = segColor;
        seg.style.boxShadow = isCritical ? `0 0 4px ${segColor}` : "";
        seg.classList.remove("dim");
      } else {
        seg.style.background = "";
        seg.style.boxShadow = "";
        seg.classList.add("dim");
      }
    }

    const wave = this.game.waves.nextWaveDef;
    this.waveEl.textContent = `${Math.min(c.waveIndex + 1, this.game.waves.totalWaves)}/${this.game.waves.totalWaves}`;
    this.statusEl.textContent = wave ? wave.name : (this.game.state === "VICTORY" ? "VICTORY" : "");
    this.speedEl.textContent = `${c.speed}x`;
    this.startWaveBtn.style.display = this.game.state === "PLANNING" && this.game.waves.hasMoreWaves ? "" : "none";
    this.updateWaveIntel();
    this.updateCoreActions();
    this.criticalOverlay.classList.toggle("visible", pct < 0.15);

    // Modifier strip.
    this.updateModifierStrip();

    // Boss bar.
    const boss = this.game.enemies.list.find((e) => e.isBoss && e.active);
    if (boss) {
      this.bossBar.classList.add("visible");
      clear(this.bossBar);
      const bossHpPct = Math.max(0, boss.hp / boss.maxHp);
      const label = boss.bossEntranceTimer > 0 ? "LEVIATHAN — INCOMING" : `LEVIATHAN — PHASE ${Math.max(1, boss.bossPhase)}`;
      const fill = el("div", { class: "ls-boss-fill" });
      fill.style.width = `${(bossHpPct * 100).toFixed(1)}%`;
      const track = el("div", { class: "ls-boss-track" });
      track.append(fill);
      // Phase threshold markers at 70%, 40%, 15%.
      for (const threshold of [0.70, 0.40, 0.15]) {
        const marker = el("div", { class: "ls-boss-phase-marker" });
        marker.style.left = `${(threshold * 100).toFixed(1)}%`;
        // Dim the marker once that phase has been crossed.
        if (bossHpPct < threshold) marker.classList.add("crossed");
        track.append(marker);
      }
      this.bossBar.append(
        el("div", { class: "ls-boss-label", text: label }),
        track,
      );
    } else {
      this.bossBar.classList.remove("visible");
    }
  }

  private updateModifierStrip(): void {
    const mods = this.game.core.activeModifiers;
    if (mods.length === 0) {
      this.modifierStrip.classList.remove("visible");
      return;
    }
    // Show during PLANNING and WAVE_ACTIVE so the player is always aware.
    const shouldShow = this.game.state === "PLANNING" || this.game.state === "WAVE_ACTIVE" || this.game.state === "WAVE_COMPLETE";
    if (!shouldShow) {
      this.modifierStrip.classList.remove("visible");
      return;
    }
    this.modifierStrip.classList.add("visible");
    clear(this.modifierStrip);
    this.modifierStrip.append(el("span", { class: "ls-hud-label", text: "MODIFIERS" }));
    for (const m of mods) {
      const isDebuff = Boolean(m.enemyHealPerSec || m.harvestDisabled || m.enemyArmorAdd || m.enemySpeedMul);
      const isBuff = Boolean(m.coreMul || (m.harvesterIncomeMul && !m.towerCostMul));
      const cls = `ls-modifier-chip${isDebuff ? " debuff" : isBuff ? " buff" : " mixed"}`;
      const chip = el("div", { class: cls });
      chip.title = m.description;
      chip.append(
        el("span", { class: "ls-modifier-name", text: m.name }),
        el("span", { class: "ls-modifier-desc", text: m.description }),
      );
      this.modifierStrip.append(chip);
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

  private updateCreditsDisplay(): void {
    if (!this.creditsPrimed) return;
    const diff = this.targetCredits - this.displayedCredits;
    if (Math.abs(diff) < 0.5) {
      this.displayedCredits = this.targetCredits;
    } else {
      this.displayedCredits += diff * 0.18;
    }
    this.creditsEl.textContent = `${Math.round(this.displayedCredits)}`;
  }

  private updateWaveIntel(): void {
    clear(this.waveIntel);
    const showIntel = this.game.state === "WAVE_ACTIVE" || this.game.state === "WAVE_COMPLETE";
    const composition = this.game.waves.waveComposition();
    if (!showIntel || composition.length === 0) {
      this.waveIntel.classList.remove("visible");
    } else {
      this.waveIntel.classList.add("visible");
      this.waveIntel.append(el("span", { class: "ls-hud-label", text: "INCOMING" }));
      for (const row of composition) {
        const def = enemyDefinitions[row.type];
        const done = row.killed >= row.total;
        const chip = el("div", { class: `ls-wave-enemy-chip${done ? " done" : ""}` });
        const swatch = el("span", { class: "ls-wave-enemy-swatch" });
        swatch.style.background = def.color;
        chip.append(swatch, el("span", { text: `${def.name} ${row.killed}/${row.total}` }));
        this.waveIntel.append(chip);
      }
      const eta = this.game.waves.estimatedCompletionSeconds();
      this.waveIntel.append(
        el("span", {
          class: "ls-wave-eta",
          text: eta == null ? (this.game.waves.allEnemiesSpawned ? "ETA --" : "SPAWNING") : `ETA ${Math.ceil(eta)}s`,
        })
      );
    }

    clear(this.waveTimeline);
    const showTimeline = this.game.state === "PLANNING" || this.game.state === "WAVE_COMPLETE";
    const upcoming = this.game.waves.upcomingWaves(3);
    if (!showTimeline || upcoming.length === 0) {
      this.waveTimeline.classList.remove("visible");
      return;
    }
    this.waveTimeline.classList.add("visible");
    this.waveTimeline.append(el("span", { class: "ls-hud-label", text: "NEXT" }));
    upcoming.forEach((w, idx) => {
      this.waveTimeline.append(
        el("div", { class: "ls-wave-timeline-chip", text: `${this.game.core.waveIndex + idx + 1}. ${w.name}` })
      );
    });
  }

  private updateCoreActions(): void {
    const c = this.game.core;
    const repairCap = c.coreMax * 0.8;
    const canRepair =
      (this.game.state === "PLANNING" || this.game.state === "WAVE_COMPLETE") &&
      c.coreIntegrity < repairCap &&
      c.credits >= 30;
    this.repairBtn.style.display =
      this.game.state === "PLANNING" || this.game.state === "WAVE_COMPLETE" ? "" : "none";
    this.repairBtn.classList.toggle("disabled", !canRepair);

    const cd = c.coreAbilityCooldown;
    this.empBtn.textContent = cd > 0 ? `EMP ${Math.ceil(cd)}s` : "EMP READY";
    this.empBtn.style.display = this.game.state === "WAVE_ACTIVE" ? "" : "none";
    this.empBtn.classList.toggle("disabled", cd > 0 || this.game.enemies.list.length === 0);
  }
}
