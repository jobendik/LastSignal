import type { Game } from "../core/Game";
import type { Tower } from "../entities/Tower";
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
  private commandTierBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "COMMAND T1" });
  private relayCoreBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "RELAY 0/1 (R)" });
  /** Toggles between Signal and Hardened relay variant before deploying. */
  private relayVariantBtn = el("button", { class: "ls-btn ls-btn-ghost ls-relay-variant-btn", text: "SIG" });
  private empBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "EMP" });
  private pauseBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "PAUSE (P)" });
  private settingsBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "⚙" });
  private codexBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "CODEX (H)" });
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
  private commandPanel = el("div", { class: "ls-command-panel" });
  private squadPanel = el("div", { class: "ls-squad-panel" });
  /** Cached signature so we only rebuild the squad panel when state changes. */
  private squadPanelLastSig = "";
  private objectivesPanel = el("div", { class: "ls-objectives-panel" });
  /** Right-side sidebar that holds the OBJECTIVES + COMMAND DIRECTIVES panels.
   *  Positioned absolutely so it doesn't make the HUD bar tall and doesn't
   *  overlap the build menu on the left. Auto-hides when the tower panel is
   *  shown so player info doesn't fight for the same space. */
  private rightSidebar = el("div", { class: "ls-hud-right-sidebar" });
  /** Global "rift pulse imminent" warning shown when any discovered rift
   *  anchor is within 2 s of pulsing. Sized to be small and unobtrusive. */
  private riftWarning = el("div", { class: "ls-rift-warning" });
  private criticalOverlay = el("div", { class: "ls-critical-overlay" });
  private rafId = 0;
  private displayedCredits = 0;
  private targetCredits = 0;
  private creditsPrimed = false;
  private waveCoreIntegrityStart = 0;
  private tookCoreDamageThisWave = false;
  /** Mobile-only toggle button for the right-side info sidebar. */
  private mobileSidebarBtn = el("button", { class: "ls-btn ls-btn-ghost ls-mobile-only ls-mobile-sidebar-toggle", text: "INFO" });

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
    bus.on("wave:started", () => {
      this.waveCoreIntegrityStart = this.game.core.coreIntegrity;
      this.tookCoreDamageThisWave = false;
      this.refresh();
    });
    bus.on("wave:complete", () => this.refresh());
    bus.on("core:damaged", () => {
      if (this.game.state === "WAVE_ACTIVE" && this.game.core.coreIntegrity < this.waveCoreIntegrityStart) {
        this.tookCoreDamageThisWave = true;
      }
    });
    bus.on("boss:spawned", () => this.refresh());
    bus.on("boss:killed", () => this.refresh());
    bus.on("core:repaired", () => this.refresh());
    bus.on("core:relayBuilt", () => this.refresh());
    bus.on("core:relayDestroyed", () => this.refresh());
    bus.on("command:tierUp", () => this.refresh());
    bus.on("core:ability", () => this.refresh());
    bus.on("core:emergency", () => this.refresh());
    bus.on("sector:started", () => {
      this.objectivesLastSig = "";
      this.objectivesLastBuild = 0;
      this.objectiveLastCompleted.clear();
      this.refresh();
    });
    // Squad lifecycle events — force the panel signature to refresh so the
    // active-squad list updates immediately rather than on next tick.
    const invalidate = () => { this.squadPanelLastSig = ""; };
    bus.on("squad:deployed", invalidate);
    bus.on("squad:selected", invalidate);
    bus.on("squad:retask", invalidate);
    bus.on("squad:retaskBegin", invalidate);
    bus.on("squad:retaskCancel", invalidate);
    bus.on("squad:evacBegin", invalidate);
    bus.on("squad:recalled", invalidate);
    bus.on("squad:expired", invalidate);
    bus.on("squad:destroyed", invalidate);
    bus.on("squad:arm", invalidate);
    bus.on("squad:disarm", invalidate);
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
      this.commandTierBtn,
      this.relayCoreBtn,
      this.relayVariantBtn,
      this.empBtn,
      speedDown, this.speedEl, speedUp,
      this.pauseBtn,
      this.codexBtn,
      this.mobileSidebarBtn,
      this.settingsBtn,
    );

    this.startWaveBtn.onclick = () => {
      if (this.game.state === "PLANNING" && this.game.waves.hasMoreWaves) {
        this.game.waves.startWave(true);
      }
    };
    this.pauseBtn.onclick = () => this.game.togglePause();
    this.repairBtn.onclick = () => this.game.repairCore();
    this.commandTierBtn.onclick = () => this.game.upgradeCommandTier();
    this.relayCoreBtn.title =
      "Relay Core: extends signal coverage so you can build farther from the home core. " +
      "Click to enter deploy mode (R), then click a valid spot. Esc cancels.";
    this.relayVariantBtn.title =
      "Toggle relay variant: Signal Relay (SIG) has wide coverage; " +
      "Hardened Relay (HRD) has smaller coverage but a much larger HP pool and costs more.";
    this.commandTierBtn.title =
      "Command Tier: upgrades your command network. Higher tiers unlock new squads " +
      "(Engineer at T2, Strike + Shield at T3) and increase relay caps and coverage. (Y)";
    this.codexBtn.title = "Open the Field Manual / Codex (H or ?). Reference for every system, control, and threat.";
    this.startWaveBtn.title = "Start the next wave early (Space). Earlier starts award bonus credits.";
    this.repairBtn.title = "Spend 30 CR to restore Core Integrity (capped at 80%).";
    this.empBtn.title = "Core EMP: stuns all active enemies for 2 seconds (1 minute cooldown).";
    this.pauseBtn.title = "Pause / resume the simulation (P).";
    this.settingsBtn.title = "Settings: audio, graphics, hotkeys, tutorial toggles.";
    this.relayVariantBtn.onclick = () => {
      const v = this.game.core.relayDeployVariant;
      this.game.core.relayDeployVariant = v === "signal" ? "hardened" : "signal";
      this.refresh();
    };
    this.relayCoreBtn.onclick = () => {
      if (!this.game.canDeployRelayCore()) return;
      this.game.core.coreDeployMode = !this.game.core.coreDeployMode;
      // Toggling into deploy mode should cancel any in-progress tower build,
      // so the click on the map deploys a relay instead of trying to place a tower.
      if (this.game.core.coreDeployMode) {
        this.game.input.selectedTowerType = null;
        this.game.input.showPlacementPreview = false;
      }
    };
    this.empBtn.onclick = () => this.game.activateCoreAbility();
    this.settingsBtn.onclick = () => this.game.ui.openSettings();
    this.codexBtn.onclick = () => this.game.ui.openCodex();
    this.mobileSidebarBtn.title = "Show / hide objectives, squad and command panels.";
    this.mobileSidebarBtn.onclick = () => {
      this.rightSidebar.classList.toggle("ls-mobile-open");
      this.mobileSidebarBtn.classList.toggle(
        "active",
        this.rightSidebar.classList.contains("ls-mobile-open"),
      );
    };

    this.countdownBar.append(this.countdownFill);
    this.countdownEl.append(this.countdownLabel, this.countdownValue, this.countdownBar);

    // Right sidebar holds the OBJECTIVES, SQUAD COMMAND, and COMMAND
    // DIRECTIVES panels in a dedicated vertical column on the right side.
    this.rightSidebar.append(this.objectivesPanel, this.squadPanel, this.commandPanel);

    this.el.append(
      left,
      right,
      this.countdownEl,
      this.waveIntel,
      this.waveTimeline,
      this.rightSidebar,
      this.codexAlert,
      this.modifierStrip,
      this.bossBar,
      this.riftWarning,
      this.criticalOverlay
    );

    // The tower panel uses the same right-side area; the sidebar's visibility
    // is updated each frame in updateRightSidebarVisibility() via the rAF tick
    // (no explicit deselect event exists — towers.selected is just nulled).

    this.game.bus.on("codex:new", (id: unknown) => this.showCodexAlert(String(id)));
    this.game.bus.on("codex:alertDismissed", () => this.hideCodexAlert());

    // Keep the countdown ticking via rAF so we don't need a full refresh.
    const tick = () => {
      this.updateCreditsDisplay();
      this.updateCountdown();
      this.updateWaveIntel();
      this.updateCoreActions();
      this.updateCommandPanel();
      this.updateSquadPanel();
      this.updateObjectivesPanel();
      this.updateRightSidebarVisibility();
      this.updateRiftWarning();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * Show a small "RIFT PULSE IMMINENT" line in the HUD when any discovered
   * rift anchor is within 2 seconds of pulsing. Adds a global glance-target
   * for sectors with multiple anchors (Sector 7) so the player doesn't have
   * to track each anchor's local countdown ring during heavy combat.
   */
  private updateRiftWarning(): void {
    const sps = this.game.strategicPoints;
    if (!sps || sps.list.length === 0) {
      this.riftWarning.classList.remove("visible");
      return;
    }
    const stateActive =
      this.game.state === "PLANNING" ||
      this.game.state === "WAVE_ACTIVE" ||
      this.game.state === "WAVE_COMPLETE";
    if (!stateActive) {
      this.riftWarning.classList.remove("visible");
      return;
    }
    let imminent = 0;
    let soonest = Infinity;
    for (const p of sps.list) {
      if (p.type !== "rift_anchor" || p.state !== "enemy") continue;
      if (!p.discovered) continue;
      if (p.effectTimer <= 2 && p.effectTimer > 0) {
        imminent++;
        if (p.effectTimer < soonest) soonest = p.effectTimer;
      }
    }
    if (imminent === 0) {
      this.riftWarning.classList.remove("visible");
      return;
    }
    const label = imminent > 1
      ? `RIFT PULSE IMMINENT × ${imminent}  (${soonest.toFixed(1)}s)`
      : `RIFT PULSE IMMINENT  (${soonest.toFixed(1)}s)`;
    if (this.riftWarning.textContent !== label) this.riftWarning.textContent = label;
    this.riftWarning.classList.add("visible");
  }

  private updateRightSidebarVisibility(): void {
    const towerSelected = !!this.game.towers.selected;
    // Show only when the tower panel isn't taking the right column.
    this.rightSidebar.classList.toggle("hidden-by-tower-panel", towerSelected);
  }

  private objectivesLastBuild = 0;
  private objectivesLastSig = "";
  /** Map of objective id → previously-completed flag, for one-shot ✓ feedback. */
  private objectiveLastCompleted = new Map<string, boolean>();
  private updateObjectivesPanel(): void {
    const show = this.game.state === "PLANNING" || this.game.state === "WAVE_ACTIVE" || this.game.state === "WAVE_COMPLETE";
    const obj = this.game.objectives.currentSectorObjectives;
    if (!show || !obj) {
      this.objectivesPanel.classList.remove("visible");
      return;
    }
    this.objectivesPanel.classList.add("visible");
    // Rate-limit panel rebuilds so we don't thrash the DOM every frame.
    const now = performance.now();
    if (now - this.objectivesLastBuild < 350) return;
    this.objectivesLastBuild = now;

    const snap = this.game.objectives.snapshot();
    const primary = this.game.objectives.evaluate(obj.primary, snap, false);
    const sigParts: string[] = [];
    sigParts.push(`p:${primary.completed ? 1 : 0}:${primary.progressText ?? ""}`);
    const secEvals = obj.secondary.map((sec) => this.game.objectives.evaluate(sec, snap, false));
    for (let i = 0; i < secEvals.length; i++) {
      const ev = secEvals[i]!;
      const okFlag = ev.completed || (ev.progress != null && ev.progress >= 1) ? 1 : 0;
      sigParts.push(`${i}:${okFlag}:${ev.progressText ?? ""}`);
    }
    const sig = sigParts.join("|");
    if (sig === this.objectivesLastSig) return;
    this.objectivesLastSig = sig;

    // Check for newly-completed objectives so we can flash the row + spawn
    // a small celebratory floating text near the home core. We use only the
    // hard `ev.completed` flag — progress >= 1 isn't reliable here because
    // some kinds (e.g. core_above_pct) gate completion on runWon and would
    // otherwise toast every time the player crosses the threshold mid-run.
    const justCompleted = new Set<string>();
    for (let i = 0; i < secEvals.length; i++) {
      const ev = secEvals[i]!;
      const sec = obj.secondary[i]!;
      const isDone = ev.completed;
      const wasDone = this.objectiveLastCompleted.get(sec.id) ?? false;
      if (isDone && !wasDone) {
        justCompleted.add(sec.id);
        // Floating text near the home core so the player notices the moment.
        const corePos = this.game.grid.corePos;
        this.game.particles.spawnFloatingText(
          corePos.x, corePos.y - 60, "OBJECTIVE COMPLETE", "#9be7a7", 1.6, 13
        );
        this.game.particles.spawnRing(corePos.x, corePos.y, 70, "#9be7a7", 0.45);
        this.game.audio.sfxObjective();
      }
      this.objectiveLastCompleted.set(sec.id, isDone);
    }

    clear(this.objectivesPanel);
    this.objectivesPanel.append(el("div", { class: "ls-obj-title", text: "OBJECTIVES" }));
    const primRow = el("div", { class: "ls-obj-row primary" });
    primRow.append(
      el("span", { class: "ls-obj-marker", text: "★" }),
      el("span", { class: "ls-obj-text", text: obj.primary.label })
    );
    if (primary.progressText) {
      primRow.append(el("span", { class: "ls-obj-progress", text: primary.progressText }));
    }
    this.objectivesPanel.append(primRow);
    for (let i = 0; i < obj.secondary.length; i++) {
      const sec = obj.secondary[i]!;
      const ev = secEvals[i]!;
      const ok = ev.completed || (ev.progress != null && ev.progress >= 1);
      const flash = justCompleted.has(sec.id);
      const row = el("div", {
        class: `ls-obj-row secondary${ok ? " ok" : ""}${flash ? " just-completed" : ""}`,
      });
      row.append(
        el("span", { class: "ls-obj-marker", text: ok ? "✓" : "+" }),
        el("span", { class: "ls-obj-text", text: sec.label })
      );
      if (ev.progressText) row.append(el("span", { class: "ls-obj-progress", text: ev.progressText }));
      this.objectivesPanel.append(row);
    }
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
    this.updateCommandPanel();
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
    const relayBuilds = `${this.game.core.coreNodesBuilt}/${this.game.maxRelayCoresForRun()}`;
    const canRelay = this.game.canDeployRelayCore();
    const canTierUp = this.game.canUpgradeCommandTier();
    const nextTierCost = this.game.nextCommandTierCost();
    this.commandTierBtn.textContent =
      this.game.core.commandTier >= 3
        ? "COMMAND T3 MAX"
        : `COMMAND T${this.game.core.commandTier} → T${this.game.core.commandTier + 1} (${nextTierCost})`;
    this.commandTierBtn.style.display = this.repairBtn.style.display;
    this.commandTierBtn.classList.toggle("disabled", !canTierUp);
    const relayCost = this.game.relayCoreCost();
    const atRelayCap = this.game.core.coreNodesBuilt >= this.game.maxRelayCoresForRun();
    if (this.game.core.coreDeployMode) {
      const variantLabel = this.game.core.relayDeployVariant === "hardened" ? "HARDENED" : "SIGNAL";
      this.relayCoreBtn.textContent = `PLACE ${variantLabel} RELAY (ESC)`;
    } else if (atRelayCap && this.game.core.commandTier < 3) {
      this.relayCoreBtn.textContent = `RELAY CAP ${relayBuilds} — upgrade Command Tier for more`;
    } else {
      this.relayCoreBtn.textContent = `RELAY ${relayBuilds} • ${relayCost}CR (R)`;
    }
    this.relayCoreBtn.style.display = this.repairBtn.style.display;
    this.relayCoreBtn.classList.toggle("disabled", !canRelay && !this.game.core.coreDeployMode);
    this.relayCoreBtn.classList.toggle("active", this.game.core.coreDeployMode);

    // Relay variant toggle: only visible during planning phases, hidden during waves.
    const showRelayButtons = this.game.state === "PLANNING" || this.game.state === "WAVE_COMPLETE";
    this.relayVariantBtn.style.display = showRelayButtons ? "" : "none";
    const v = this.game.core.relayDeployVariant;
    this.relayVariantBtn.textContent = v === "hardened" ? "HRD" : "SIG";
    this.relayVariantBtn.classList.toggle("ls-relay-variant-hardened", v === "hardened");

    const cd = c.coreAbilityCooldown;
    this.empBtn.textContent = cd > 0 ? `EMP ${Math.ceil(cd)}s` : "EMP READY";
    this.empBtn.style.display = this.game.state === "WAVE_ACTIVE" ? "" : "none";
    this.empBtn.classList.toggle("disabled", cd > 0 || this.game.enemies.list.length === 0);
  }

  private updateCommandPanel(): void {
    const show = this.game.state === "PLANNING" || this.game.state === "WAVE_ACTIVE";
    if (!show) {
      this.commandPanel.classList.remove("visible");
      return;
    }
    this.commandPanel.classList.add("visible");
    clear(this.commandPanel);

    const next = this.game.waves.nextWaveDef;
    const counters = (next?.recommendedCounters ?? []).slice(0, 2);
    const hasCounterTower = this.hasRecommendedTower(counters);
    const perfectWaveOk = !this.tookCoreDamageThisWave;
    const reserveOk = this.game.core.credits >= 30;

    this.commandPanel.append(
      el("div", { class: "ls-command-title", text: "COMMAND DIRECTIVES" }),
      this.directiveRow(
        hasCounterTower,
        hasCounterTower ? "Counter setup online." : `Build counters: ${counters.join(" + ") || "mixed defense"}.`
      ),
      this.directiveRow(perfectWaveOk, perfectWaveOk ? "Perfect wave possible (no core breaches)." : "Core breached this wave."),
      this.directiveRow(reserveOk, reserveOk ? "Emergency reserve secured (30+ credits)." : "Hold 30 credits for repair/EMP safety.")
    );
    this.commandPanel.append(this.relayDirectiveRow());
    // Strategic-intel summary appears only when the active sector defines points.
    const intelRow = this.strategicDirectiveRow();
    if (intelRow) this.commandPanel.append(intelRow);
  }

  /**
   * One-line summary of strategic-map progress: how many points the player
   * controls and how many enemy structures remain. Returns null if the active
   * sector has no strategic points so existing sectors stay clean.
   */
  private strategicDirectiveRow(): HTMLElement | null {
    const sps = this.game.strategicPoints;
    if (!sps || sps.list.length === 0) return null;
    let captured = 0;
    let neutralLeft = 0;
    let hostilesLeft = 0;
    for (const p of sps.list) {
      if (p.state === "captured" || p.state === "depleted") captured++;
      else if (p.state === "neutral") neutralLeft++;
      else if (p.state === "enemy") hostilesLeft++;
    }
    let text: string;
    let ok = false;
    if (hostilesLeft > 0) {
      text = `Strategic: ${captured} held · ${hostilesLeft} hostile structure${hostilesLeft === 1 ? "" : "s"} active.`;
    } else if (neutralLeft > 0) {
      text = `Strategic: ${captured} held · ${neutralLeft} neutral point${neutralLeft === 1 ? "" : "s"} to capture.`;
    } else {
      text = `Strategic: ${captured} secured · sector pacified.`;
      ok = true;
    }
    return el("div", { class: `ls-command-row ${ok ? "ok" : "warn"}`, text: `◆ ${text}` });
  }

  /**
   * One-line tutorial-style hint about the relay system. Adapts to current
   * game state: locked, ready, or active. Renders below the directives so it's
   * always visible without dominating the panel.
   */
  private relayDirectiveRow(): HTMLElement {
    const game = this.game;
    const built = game.core.coreNodesBuilt;
    const max = game.maxRelayCoresForRun();
    const cost = game.relayCoreCost();
    const variant = game.core.relayDeployVariant;
    let text: string;
    let ok = false;
    if (game.core.coreDeployMode) {
      const vLabel = variant === "hardened" ? "hardened relay" : "signal relay";
      text = `Place a ${vLabel} on signal-network edge to expand build zone.`;
    } else if (built >= max && game.core.commandTier < 3) {
      text = `Relay cap ${built}/${max} — upgrade Command Tier to unlock more.`;
    } else if (built >= max) {
      text = `Relay network at maximum capacity (${built}/${max}).`;
      ok = true;
    } else if (game.canDeployRelayCore()) {
      const vLabel = variant === "hardened" ? "hardened relay" : "relay";
      text = `${vLabel.charAt(0).toUpperCase() + vLabel.slice(1)} ready — extend signal range for ${cost}CR (R).`;
      ok = true;
    } else if (game.core.waveIndex < 2) {
      text = "Relay cores extend signal range and unlock new build zones.";
    } else {
      text = `Save ${cost}CR for next relay deployment.`;
    }
    return el("div", { class: `ls-command-row ${ok ? "ok" : "warn"}`, text: `◇ ${text}` });
  }

  private directiveRow(ok: boolean, text: string): HTMLElement {
    return el("div", { class: `ls-command-row ${ok ? "ok" : "warn"}`, text: `${ok ? "✓" : "•"} ${text}` });
  }

  /**
   * Mobile command squad panel. Rebuilds whenever squad state changes
   * (cooldown ticks, active count, pending command, command tier) so the
   * player can see availability at a glance. Buttons gracefully show
   * locked/cap/cooldown reasons instead of being disabled silently.
   */
  private updateSquadPanel(): void {
    const sys = this.game.squads;
    const show =
      !!sys &&
      (this.game.state === "PLANNING" || this.game.state === "WAVE_ACTIVE");
    if (!show || !sys) {
      this.squadPanel.classList.remove("visible");
      this.squadPanelLastSig = "";
      return;
    }
    this.squadPanel.classList.add("visible");

    const statuses = sys.statuses();
    const cap = sys.globalCap();
    const selectedId = sys.selected?.id ?? null;
    const retask = sys.retaskMode;
    // Active-squad list signature so we rebuild only on real state changes.
    const activeParts: string[] = [];
    for (const s of sys.list) {
      if (!s.active) continue;
      activeParts.push(
        `${s.id}:${s.type}:${Math.ceil(s.health)}:${Math.ceil(s.duration)}:${s.state}:${s.evacuating ? "E" : "_"}:${s.jammed ? "J" : "_"}`
      );
    }
    const sigParts: string[] = [
      `tier:${this.game.core.commandTier}`,
      `cap:${sys.list.length}/${cap}`,
      `pending:${sys.pendingCommand ?? "_"}`,
      `sel:${selectedId ?? "_"}`,
      `retask:${retask ? 1 : 0}`,
      `act:${activeParts.join(",")}`,
    ];
    for (const s of statuses) {
      sigParts.push(
        `${s.type}:${s.unlocked ? 1 : 0}:${Math.ceil(s.cooldownRemaining)}:${s.active}:${s.affordable ? 1 : 0}:${s.effectiveCost}:${s.reason ?? ""}`
      );
    }
    const sig = sigParts.join("|");
    if (sig === this.squadPanelLastSig) return;
    this.squadPanelLastSig = sig;

    clear(this.squadPanel);
    const titleRow = el("div", { class: "ls-squad-title-row" });
    titleRow.append(
      el("div", { class: "ls-command-title", text: "SQUAD COMMAND" }),
      el("div", { class: "ls-squad-cap", text: `Slots ${sys.list.length}/${cap}` })
    );
    this.squadPanel.append(titleRow);

    // Active squad roster — clickable rows with HP, duration, state.
    if (sys.list.length > 0) {
      const roster = el("div", { class: "ls-squad-roster" });
      for (const s of sys.list) {
        if (!s.active) continue;
        const sel = s.id === selectedId;
        const hpPct = Math.max(0, s.health / s.maxHealth);
        const durPct = Math.max(0, s.duration / s.maxDuration);
        const state = s.state;
        const status = stateLabel(state, s.evacuating, s.jammed);
        const row = el("div", {
          class: `ls-squad-active${sel ? " selected" : ""}${s.evacuating ? " evac" : ""}${s.jammed ? " jammed" : ""}`,
        });
        row.style.borderLeftColor = s.def.color;
        const head = el("div", { class: "ls-squad-active-head" });
        head.append(
          el("span", { class: "ls-squad-active-name", text: s.def.name }),
          el("span", { class: "ls-squad-active-state", text: status })
        );
        // Mini HP and duration bars.
        const bars = el("div", { class: "ls-squad-active-bars" });
        const hpBar = el("div", { class: "ls-squad-active-bar" });
        const hpFill = el("div", { class: "ls-squad-active-bar-fill" });
        hpFill.style.width = `${(hpPct * 100).toFixed(0)}%`;
        hpFill.style.background =
          hpPct > 0.5 ? "#9be7a7" : hpPct > 0.25 ? "#ffd180" : "#ff5252";
        hpBar.append(hpFill);
        const durBar = el("div", { class: "ls-squad-active-bar" });
        const durFill = el("div", { class: "ls-squad-active-bar-fill" });
        durFill.style.width = `${(durPct * 100).toFixed(0)}%`;
        durFill.style.background = "#80d8ff";
        durBar.append(durFill);
        bars.append(hpBar, durBar);
        // Action row
        const actions = el("div", { class: "ls-squad-active-actions" });
        const retaskBtn = el("button", {
          class: `ls-squad-mini-btn${retask && sel ? " active" : ""}`,
          text: retask && sel ? "PICK TARGET" : "RETASK",
        });
        retaskBtn.disabled = s.evacuating;
        retaskBtn.title = "Retask the selected squad to a new target/location.";
        retaskBtn.onclick = (ev) => {
          ev.stopPropagation();
          if (!sel) sys.selectSquad(s);
          if (sys.selected) sys.beginRetask();
        };
        const evacBtn = el("button", { class: "ls-squad-mini-btn", text: "EVAC" });
        evacBtn.disabled = s.evacuating;
        evacBtn.title = "Recall the squad to the nearest core/relay (Q).";
        evacBtn.onclick = (ev) => {
          ev.stopPropagation();
          sys.evacSquad(s);
        };
        actions.append(retaskBtn, evacBtn);
        row.append(head, bars, actions);
        row.onclick = () => sys.selectSquad(s);
        row.title = `${s.def.name} — click to select. Right-click world to retask, Q to evac.`;
        roster.append(row);
      }
      // Roster footer — global EVAC ALL action.
      const footer = el("div", { class: "ls-squad-roster-footer" });
      const evacAllBtn = el("button", { class: "ls-squad-mini-btn evac-all", text: "EVAC ALL" });
      evacAllBtn.title = "Recall every active squad to safety (Shift+Q).";
      evacAllBtn.disabled = sys.list.every((s) => !s.active || s.evacuating);
      evacAllBtn.onclick = () => sys.evacAll();
      footer.append(evacAllBtn);
      roster.append(footer);
      this.squadPanel.append(roster);
    }

    const grid = el("div", { class: "ls-squad-grid" });
    for (const status of statuses) {
      const def = status.def;
      const isPending = sys.pendingCommand === status.type;
      const cls = [
        "ls-squad-btn",
        isPending ? "active" : "",
        !status.unlocked ? "locked" : "",
        status.unlocked && status.reason ? "disabled" : "",
        status.unlocked && !status.reason ? "ready" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const btn = el("button", { class: cls });
      btn.style.borderColor = def.color;
      const header = el("div", { class: "ls-squad-row" });
      const hotkey = squadHotkeyLabel(status.type);
      header.append(
        el("span", { class: "ls-squad-name", text: `${hotkey} ${def.name}` }),
        el("span", { class: "ls-squad-cost", text: `${status.effectiveCost}CR` })
      );
      const meta = el("div", { class: "ls-squad-meta" });
      const cdLabel =
        status.cooldownRemaining > 0
          ? `CD ${Math.ceil(status.cooldownRemaining)}s`
          : `CD ${Math.round(status.effectiveCooldown)}s`;
      meta.append(
        el("span", { class: "ls-squad-role", text: def.role }),
        el("span", { class: "ls-squad-cd", text: cdLabel })
      );
      const detail = el("div", {
        class: "ls-squad-detail",
        text: status.reason
          ? status.reason
          : `${status.active}/${status.capPerType} active · T${def.tierRequired}+`,
      });
      btn.append(header, meta, detail);
      // Tooltip: role-aware summary so hovering reads like a quick reference
      // card. Includes unlock tier, cost, cooldown, cap, and hotkey.
      btn.title =
        `${def.name} — ${def.role}\n${def.description}\n` +
        `Unlock: Command Tier ${def.tierRequired}\n` +
        `Cost: ${status.effectiveCost} CR · Cooldown: ${Math.round(status.effectiveCooldown)}s · Cap ${def.capPerType}\n` +
        `Hotkey: ${hotkey}\n` +
        `Right-click world to retask · Q to evac · Shift+Q to evac all`;
      btn.onclick = () => {
        if (!status.unlocked) return;
        sys.armCommand(status.type);
      };
      grid.append(btn);
    }
    this.squadPanel.append(grid);
  }

  /** Public hook for InputSystem to refresh the squad panel when state changes. */
  invalidateSquadPanel(): void {
    this.squadPanelLastSig = "";
  }

  private hasRecommendedTower(counters: string[]): boolean {
    const names = counters.map((c) => c.toLowerCase());
    const towers = this.game.towers.list as Tower[];
    if (names.length === 0) return towers.length >= 2;
    return towers.some((t) => names.some((n) => t.name.toLowerCase().includes(n)));
  }
}

function squadHotkeyLabel(type: "recon" | "engineer" | "strike" | "shield"): string {
  switch (type) {
    case "recon": return "[F1]";
    case "engineer": return "[F2]";
    case "strike": return "[F3]";
    case "shield": return "[F4]";
  }
}

/** Compact human label for a squad's current behavior state. */
function stateLabel(state: string, evacuating: boolean, jammed: boolean): string {
  if (evacuating) return "EVAC";
  if (jammed) return "JAMMED";
  switch (state) {
    case "spawning": return "DEPLOYING";
    case "moving": return "MOVING";
    case "scouting": return "SCANNING";
    case "capturing": return "CAPTURING";
    case "repairing": return "REPAIRING";
    case "attacking": return "ATTACKING";
    case "shielding": return "SHIELDING";
    case "evacuating": return "EVAC";
    case "expired": return "EXPIRED";
    case "destroyed": return "LOST";
    default: return state.toUpperCase();
  }
}
