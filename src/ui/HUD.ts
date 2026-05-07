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
  private commandPanel = el("div", { class: "ls-command-panel" });
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
    bus.on("command:tierUp", () => this.refresh());
    bus.on("core:ability", () => this.refresh());
    bus.on("core:emergency", () => this.refresh());
    bus.on("sector:started", () => {
      this.objectivesLastSig = "";
      this.objectivesLastBuild = 0;
      this.objectiveLastCompleted.clear();
      this.refresh();
    });
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
    this.commandTierBtn.onclick = () => this.game.upgradeCommandTier();
    this.relayCoreBtn.title = "Relay cores extend signal range and unlock new build zones.";
    this.commandTierBtn.title = "Command Tier increases drone cap, militia pulse, and relay reach.";
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

    this.countdownBar.append(this.countdownFill);
    this.countdownEl.append(this.countdownLabel, this.countdownValue, this.countdownBar);

    // Right sidebar holds the OBJECTIVES + COMMAND DIRECTIVES panels in a
    // dedicated vertical column on the right side of the screen.
    this.rightSidebar.append(this.objectivesPanel, this.commandPanel);

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
    this.relayCoreBtn.textContent = this.game.core.coreDeployMode
      ? `PLACE RELAY (ESC)`
      : `RELAY ${relayBuilds} • ${relayCost}CR (R)`;
    this.relayCoreBtn.style.display = this.repairBtn.style.display;
    this.relayCoreBtn.classList.toggle("disabled", !canRelay);
    this.relayCoreBtn.classList.toggle("active", this.game.core.coreDeployMode);

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
    let text: string;
    let ok = false;
    if (game.core.coreDeployMode) {
      text = "Place a relay on signal-network edge to expand build zone.";
    } else if (built >= max) {
      text = `Relay cap ${built}/${max} — raise Command Tier for more.`;
      ok = true;
    } else if (game.canDeployRelayCore()) {
      text = `Relay ready — extend signal range for ${cost}CR (R).`;
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

  private hasRecommendedTower(counters: string[]): boolean {
    const names = counters.map((c) => c.toLowerCase());
    const towers = this.game.towers.list as Tower[];
    if (names.length === 0) return towers.length >= 2;
    return towers.some((t) => names.some((n) => t.name.toLowerCase().includes(n)));
  }
}
