import type { Game } from "../../core/Game";
import { el, clear } from "./dom";
import { MobileBuildSquadDrawer } from "./MobileBuildSquadDrawer";
import { MobileTowerSheet } from "./MobileTowerSheet";
import { enemyDefinitions } from "../../data/enemies";

/**
 * MobileShell — top-level mobile UI orchestrator.
 *
 * Owns the three persistent mobile chrome elements:
 *   1. Top HUD bar (.ls-mhud)         — credits, core HP, wave + status, START WAVE, pause, ⋯ menu, settings
 *   2. Bottom action bar (.ls-mabar)  — speed toggle, BUILD/SQUAD tab switcher, contextual CONFIRM/CANCEL slot
 *   3. "More" menu flyout (.ls-mmore) — REPAIR, EMP, RELAY, COMMAND TIER, CODEX, RESEARCH (the desktop button row that
 *                                       doesn't fit in a thumb-zone bar)
 *
 * Also owns the build/squad drawer and the tower selection bottom sheet, both of which live as children of this shell
 * so we can co-ordinate their visibility (e.g. opening the tower sheet collapses the drawer).
 *
 * Visibility is driven by game.state — the shell is shown only during PLANNING / WAVE_ACTIVE / WAVE_COMPLETE / PAUSED.
 */
export class MobileShell {
  /** Root container appended once to game.uiRoot. */
  el: HTMLElement;

  // Persistent chrome.
  private mhud!: HTMLElement;
  private mabar!: HTMLElement;
  private mmoreBackdrop!: HTMLElement;
  private mmore!: HTMLElement;
  private minfoBackdrop!: HTMLElement;
  private minfo!: HTMLElement;
  private minfoBody!: HTMLElement;
  private ghostHint: HTMLElement;

  // Top HUD elements we mutate every frame.
  private creditsEl = el("span", { text: "0" });
  private coreFillEl = el("div", { class: "ls-mhud-core-fill" });
  private coreTextEl = el("div", { class: "ls-mhud-core-text", text: "100/100" });
  private waveEl = el("span", { text: "0/0" });
  private statusEl = el("span", { class: "ls-mhud-status", text: "" });
  private startWaveBtn = el("button", { class: "ls-mhud-start ls-mhud-btn", text: "LAUNCH" });
  private pauseBtn = el("button", { class: "ls-mhud-btn", text: "❚❚" });
  private settingsBtn = el("button", { class: "ls-mhud-btn", text: "⚙" });
  private moreBtn = el("button", { class: "ls-mhud-btn", text: "☰" });
  private cancelModeBtn = el("button", { class: "ls-mhud-btn warning", text: "✕" });
  private empBtn = el("button", { class: "ls-mhud-btn warning", text: "EMP" });

  // Bottom action bar elements.
  private speedBtn = el("button", { class: "ls-mabar-speed", text: "1×" });
  private buildTab = el("button", { class: "ls-mabar-tab active" });
  private squadTab = el("button", { class: "ls-mabar-tab" });
  private confirmSlot = el("div", { class: "ls-mabar-confirm-slot" });

  // Owned subviews.
  drawer!: MobileBuildSquadDrawer;
  towerSheet!: MobileTowerSheet;

  // Display smoothing.
  private displayedCredits = 0;
  private targetCredits = 0;
  private creditsPrimed = false;

  // Local UI state.
  /** Current drawer tab. */
  activeTab: "build" | "squad" = "build";
  /** Current "armed" state — drives the confirm/cancel slot. */
  private armedKind: "tower" | "squad" | "relay" | "killzone" | null = null;

  private rafId = 0;

  constructor(private readonly game: Game) {
    document.body.classList.add("ls-mobile-shell-ready");
    this.el = el("div", { class: "ls-mshell" });
    this.buildTopHud();
    this.buildBottomBar();
    this.buildMoreMenu();
    this.buildInfoSheet();
    this.ghostHint = el("div", { class: "ls-mghost-hint" });

    this.drawer = new MobileBuildSquadDrawer(game, this);
    this.towerSheet = new MobileTowerSheet(game, this);

    this.el.append(
      this.mhud,
      this.mabar,
      this.drawer.el,
      this.towerSheet.el,
      this.ghostHint,
      this.mmoreBackdrop,
      this.mmore,
      this.minfoBackdrop,
      this.minfo,
    );

    this.bind();
    this.onStateChanged({ prev: "BOOT", next: this.game.state });
    this.startTick();
  }

  // ──────────────────────────────────────────────────────────
  // Top HUD
  // ──────────────────────────────────────────────────────────
  private buildTopHud(): void {
    this.mhud = el("div", { class: "ls-mhud" });

    // CREDITS
    const credStat = el("div", { class: "ls-mhud-stat ls-mhud-credits" });
    credStat.append(
      el("div", { class: "ls-mhud-stat-label", text: "CR" }),
      el("div", { class: "ls-mhud-stat-value" }, [this.creditsEl]),
    );

    // CORE
    const coreStat = el("div", { class: "ls-mhud-core" });
    const coreBar = el("div", { class: "ls-mhud-core-bar" });
    coreBar.append(this.coreFillEl);
    coreStat.append(coreBar, this.coreTextEl);

    // WAVE + STATUS (compressed)
    const waveStat = el("div", { class: "ls-mhud-stat ls-mhud-wave" });
    waveStat.append(
      el("div", { class: "ls-mhud-stat-label", text: "WAVE" }),
      el("div", { class: "ls-mhud-stat-value" }, [this.waveEl]),
    );

    // BUTTON ROW (right side)
    const btnRow = el("div", { class: "ls-mhud-buttons" });

    this.startWaveBtn.title = "Start the next wave early — earns bonus credits.";
    this.startWaveBtn.onclick = () => {
      if (this.game.state === "PLANNING" && this.game.waves.hasMoreWaves) {
        this.game.waves.startWave(true);
        this.haptic(20);
      }
    };

    this.pauseBtn.title = "Pause / resume.";
    this.pauseBtn.onclick = () => {
      this.game.togglePause();
      this.haptic(10);
    };

    this.moreBtn.title = "More commands: repair, EMP, relay, command tier, codex.";
    this.moreBtn.onclick = () => this.toggleMoreMenu();
    this.empBtn.title = "Core EMP (combat quick action).";
    this.empBtn.onclick = () => {
      if (this.game.activateCoreAbility()) this.haptic([10, 30, 10]);
    };

    this.settingsBtn.title = "Settings.";
    this.settingsBtn.onclick = () => this.game.ui.openSettings();
    this.cancelModeBtn.title = "Cancel current placement mode.";
    this.cancelModeBtn.onclick = () => this.cancelArmed();

    btnRow.append(this.startWaveBtn, this.empBtn, this.cancelModeBtn, this.pauseBtn, this.moreBtn, this.settingsBtn);

    this.mhud.append(credStat, coreStat, waveStat, this.statusEl, btnRow);
  }

  // ──────────────────────────────────────────────────────────
  // Bottom action bar (thumb zone)
  // ──────────────────────────────────────────────────────────
  private buildBottomBar(): void {
    this.mabar = el("div", { class: "ls-mabar" });

    // SPEED toggle — cycles 1× → 2× → 3× → 1×.
    this.speedBtn.title = "Cycle game speed (1×/2×/3×).";
    this.speedBtn.onclick = () => {
      const cur = this.game.core.speed;
      const next = cur === 1 ? 2 : cur === 2 ? 3 : 1;
      this.game.setSpeed(next as 1 | 2 | 3);
      this.haptic(8);
    };

    // BUILD / SQUAD tab switcher.
    const tabs = el("div", { class: "ls-mabar-tabs" });
    const buildLbl = el("span", { class: "ls-mabar-tab-label", text: "BUILD" });
    const buildDot = el("span", { class: "ls-mabar-tab-dot" });
    this.buildTab.append(buildLbl, buildDot);
    this.buildTab.title = "Open the build menu (towers).";
    this.buildTab.onclick = () => this.setTab("build");

    const squadLbl = el("span", { class: "ls-mabar-tab-label", text: "SQUAD" });
    const squadDot = el("span", { class: "ls-mabar-tab-dot" });
    this.squadTab.append(squadLbl, squadDot);
    this.squadTab.title = "Open the squad command menu (Recon / Engineer / Strike / Shield).";
    this.squadTab.onclick = () => this.setTab("squad");

    tabs.append(this.buildTab, this.squadTab);

    this.mabar.append(this.speedBtn, tabs, this.confirmSlot);
  }

  // ──────────────────────────────────────────────────────────
  // More menu flyout
  // ──────────────────────────────────────────────────────────
  private buildMoreMenu(): void {
    this.mmoreBackdrop = el("div", { class: "ls-mmore-backdrop" });
    this.mmoreBackdrop.onclick = () => this.closeMoreMenu();

    this.mmore = el("div", { class: "ls-mmore" });
  }

  private toggleMoreMenu(): void {
    if (this.mmore.classList.contains("visible")) this.closeMoreMenu();
    else this.openMoreMenu();
  }

  private openMoreMenu(): void {
    this.refreshMoreMenu();
    this.mmore.classList.add("visible");
    this.mmoreBackdrop.classList.add("visible");
    this.haptic(8);
  }

  private closeMoreMenu(): void {
    this.mmore.classList.remove("visible");
    this.mmoreBackdrop.classList.remove("visible");
  }

  private refreshMoreMenu(): void {
    clear(this.mmore);
    this.mmore.append(el("div", { class: "ls-mmore-title", text: "COMMAND" }));
    this.mmore.append(el("div", { class: "ls-mmore-group", text: "TACTICAL" }));

    const game = this.game;
    const c = game.core;

    // REPAIR
    const repairCap = c.coreMax * 0.8;
    const canRepair =
      (game.state === "PLANNING" || game.state === "WAVE_COMPLETE") &&
      c.coreIntegrity < repairCap &&
      c.credits >= 30;
    this.mmore.append(this.moreButton({
      label: "REPAIR CORE",
      sub: "Restore +5% core integrity (cap 80%)",
      cost: "30 CR",
      enabled: canRepair,
      onClick: () => {
        if (game.repairCore()) { this.haptic(12); this.closeMoreMenu(); }
      },
    }));

    // EMP
    const cd = c.coreAbilityCooldown;
    const canEmp = game.state === "WAVE_ACTIVE" && cd <= 0 && game.enemies.list.length > 0;
    this.mmore.append(this.moreButton({
      label: cd > 0 ? `EMP (${Math.ceil(cd)}s)` : "CORE EMP",
      sub: "Stun all active enemies for 2s",
      cost: cd > 0 ? "COOLDOWN" : "READY",
      enabled: canEmp,
      onClick: () => {
        if (game.activateCoreAbility()) { this.haptic([10, 30, 10]); this.closeMoreMenu(); }
      },
    }));

    // RELAY
    const canRelay = game.canDeployRelayCore();
    const built = c.coreNodesBuilt;
    const max = game.maxRelayCoresForRun();
    const relayCost = game.relayCoreCost();
    this.mmore.append(this.moreButton({
      label: c.coreDeployMode ? "PICKING SPOT…" : `RELAY ${built}/${max}`,
      sub: "Extends signal coverage. Tap map to place.",
      cost: `${relayCost} CR`,
      enabled: canRelay,
      active: c.coreDeployMode,
      onClick: () => {
        if (!canRelay && !c.coreDeployMode) return;
        c.coreDeployMode = !c.coreDeployMode;
        if (c.coreDeployMode) {
          game.input.selectedTowerType = null;
          game.input.showPlacementPreview = false;
          game.squads?.cancelCommand();
          this.setArmed("relay");
        } else {
          this.setArmed(null);
        }
        this.haptic(8);
        this.closeMoreMenu();
      },
    }));

    // COMMAND TIER
    const canTier = game.canUpgradeCommandTier();
    const tier = c.commandTier;
    const tierCost = game.nextCommandTierCost();
    this.mmore.append(this.moreButton({
      label: tier >= 3 ? "COMMAND T3 (MAX)" : `COMMAND T${tier} → T${tier + 1}`,
      sub: tier >= 3 ? "Top tier reached" : "Unlock new squads + relay slots",
      cost: tier >= 3 ? "—" : `${tierCost} CR`,
      enabled: canTier,
      onClick: () => {
        if (game.upgradeCommandTier()) { this.haptic([10, 20, 30]); this.closeMoreMenu(); }
      },
    }));

    // TACTICAL INTEL
    this.mmore.append(this.moreButton({
      label: "TACTICAL INTEL",
      sub: "Objectives, next wave, modifiers, map status",
      cost: "",
      enabled: true,
      onClick: () => {
        this.openInfoSheet();
        this.closeMoreMenu();
      },
    }));

    this.mmore.append(el("div", { class: "ls-mmore-group", text: "STRATEGIC" }));
    // CODEX
    this.mmore.append(this.moreButton({
      label: "FIELD MANUAL",
      sub: "Codex: enemies, systems, controls",
      cost: "",
      enabled: true,
      onClick: () => { game.ui.openCodex(); this.closeMoreMenu(); },
    }));

    if (game.state !== "WAVE_ACTIVE") {
      this.mmore.append(this.moreButton({
        label: "RESEARCH",
        sub: "Spend research points (next run)",
        cost: `${c.profile.researchPoints} RP`,
        enabled: true,
        onClick: () => { game.ui.openMeta(); this.closeMoreMenu(); },
      }));
    }
  }

  private moreButton(opts: {
    label: string;
    sub: string;
    cost: string;
    enabled: boolean;
    active?: boolean;
    onClick: () => void;
  }): HTMLElement {
    const cls = `ls-mmore-btn${opts.enabled ? "" : " disabled"}${opts.active ? " active" : ""}`;
    const btn = el("button", { class: cls });
    btn.append(
      el("div", { class: "ls-mmore-label", text: opts.label }),
      el("div", { class: "ls-mmore-sub", text: opts.sub }),
    );
    if (opts.cost) btn.append(el("div", { class: "ls-mmore-cost", text: opts.cost }));
    btn.onclick = () => { if (opts.enabled) opts.onClick(); };
    return btn;
  }

  // Mobile tactical intel sheet: replaces desktop-only wave preview,
  // objectives/sidebar, modifier strip, boss bar, and rift warning.
  private buildInfoSheet(): void {
    this.minfoBackdrop = el("div", { class: "ls-minfo-backdrop" });
    this.minfoBackdrop.onclick = () => this.closeInfoSheet();

    this.minfo = el("div", { class: "ls-minfo" });
    const head = el("div", { class: "ls-minfo-head" });
    const close = el("button", { class: "ls-minfo-close", text: "X" });
    close.onclick = () => this.closeInfoSheet();
    head.append(el("div", { class: "ls-minfo-title", text: "TACTICAL INTEL" }), close);
    this.minfoBody = el("div", { class: "ls-minfo-body" });
    this.minfo.append(head, this.minfoBody);
  }

  private openInfoSheet(): void {
    this.refreshInfoSheet();
    this.minfo.classList.add("visible");
    this.minfoBackdrop.classList.add("visible");
    this.drawer.close();
    this.haptic(6);
  }

  private closeInfoSheet(): void {
    this.minfo.classList.remove("visible");
    this.minfoBackdrop.classList.remove("visible");
  }

  private refreshInfoSheet(): void {
    if (!this.minfo.classList.contains("visible")) return;
    clear(this.minfoBody);
    this.renderInfoWave();
    this.renderInfoObjectives();
    this.renderInfoModifiers();
    this.renderInfoStrategic();
    this.renderInfoBoss();
  }

  private renderInfoWave(): void {
    const wave = this.game.waves.nextWaveDef;
    const section = this.infoSection("WAVE INTEL");
    if (!wave) {
      section.append(el("div", { class: "ls-minfo-muted", text: "No further waves." }));
      this.minfoBody.append(section);
      return;
    }
    const waveNum = Math.min(this.game.core.waveIndex + 1, this.game.waves.totalWaves);
    section.append(el("div", { class: "ls-minfo-main", text: `${waveNum}/${this.game.waves.totalWaves} - ${wave.name}` }));
    if (wave.description) section.append(el("div", { class: "ls-minfo-copy", text: wave.description }));
    if (wave.warning) section.append(el("div", { class: "ls-minfo-warn", text: wave.warning }));

    const summary = wave.enemySummary ?? [];
    if (summary.length > 0) {
      const list = el("div", { class: "ls-minfo-chiprow" });
      for (const entry of summary) {
        const def = enemyDefinitions[entry.type];
        const chip = el("div", { class: "ls-minfo-chip" });
        const swatch = el("span", { class: "ls-minfo-swatch" });
        swatch.style.background = def.color;
        chip.append(swatch, el("span", { text: `${def.name} x${entry.count}` }));
        list.append(chip);
      }
      section.append(list);
    }

    if (wave.recommendedCounters?.length) {
      section.append(el("div", { class: "ls-minfo-subhead", text: "Recommended" }));
      const counters = el("div", { class: "ls-minfo-chiprow" });
      for (const c of wave.recommendedCounters) {
        counters.append(el("span", { class: "ls-minfo-pill", text: c }));
      }
      section.append(counters);
    }
    this.minfoBody.append(section);
  }

  private renderInfoObjectives(): void {
    const obj = this.game.objectives.currentSectorObjectives;
    const section = this.infoSection("OBJECTIVES");
    if (!obj) {
      section.append(el("div", { class: "ls-minfo-muted", text: "No active sector objectives." }));
      this.minfoBody.append(section);
      return;
    }
    const snap = this.game.objectives.snapshot();
    const primary = this.game.objectives.evaluate(obj.primary, snap, false);
    section.append(this.objectiveLine("PRIMARY", obj.primary.label, primary.completed, primary.progressText));
    for (const sec of obj.secondary) {
      const ev = this.game.objectives.evaluate(sec, snap, false);
      const ok = ev.completed || (ev.progress != null && ev.progress >= 1);
      section.append(this.objectiveLine("+", sec.label, ok, ev.progressText));
    }
    this.minfoBody.append(section);
  }

  private renderInfoModifiers(): void {
    const mods = this.game.core.activeModifiers;
    if (mods.length === 0) return;
    const section = this.infoSection("RUN MODIFIERS");
    for (const m of mods) {
      section.append(el("div", { class: "ls-minfo-row" }, [
        el("span", { class: "ls-minfo-row-name", text: m.name }),
        el("span", { class: "ls-minfo-row-detail", text: m.description }),
      ]));
    }
    this.minfoBody.append(section);
  }

  private renderInfoStrategic(): void {
    const sps = this.game.strategicPoints;
    if (!sps || sps.list.length === 0) return;
    let captured = 0;
    let neutral = 0;
    let hostile = 0;
    let imminent = 0;
    let soonest = Infinity;
    for (const p of sps.list) {
      if (p.state === "captured" || p.state === "depleted") captured++;
      else if (p.state === "neutral") neutral++;
      else if (p.state === "enemy") hostile++;
      if (p.type === "rift_anchor" && p.state === "enemy" && p.discovered && p.effectTimer <= 2 && p.effectTimer > 0) {
        imminent++;
        soonest = Math.min(soonest, p.effectTimer);
      }
    }
    const section = this.infoSection("STRATEGIC MAP");
    section.append(el("div", { class: "ls-minfo-statgrid" }, [
      this.infoStat("Held", `${captured}`),
      this.infoStat("Neutral", `${neutral}`),
      this.infoStat("Hostile", `${hostile}`),
    ]));
    if (imminent > 0) {
      section.append(el("div", {
        class: "ls-minfo-warn",
        text: `Rift pulse imminent x${imminent} (${soonest.toFixed(1)}s)`,
      }));
    }
    this.minfoBody.append(section);
  }

  private renderInfoBoss(): void {
    const boss = this.game.enemies.list.find((e) => e.isBoss && e.active);
    if (!boss) return;
    const section = this.infoSection("BOSS");
    const pct = Math.max(0, boss.hp / Math.max(1, boss.maxHp));
    const fill = el("div", { class: "ls-minfo-bar-fill" });
    fill.style.width = `${(pct * 100).toFixed(1)}%`;
    section.append(
      el("div", {
        class: "ls-minfo-main danger",
        text: boss.bossEntranceTimer > 0 ? "LEVIATHAN - INCOMING" : `LEVIATHAN - PHASE ${Math.max(1, boss.bossPhase)}`,
      }),
      el("div", { class: "ls-minfo-bar" }, [fill]),
    );
    this.minfoBody.append(section);
  }

  private infoSection(title: string): HTMLElement {
    return el("section", { class: "ls-minfo-section" }, [
      el("div", { class: "ls-minfo-section-title", text: title }),
    ]);
  }

  private objectiveLine(tag: string, label: string, ok: boolean, progress?: string): HTMLElement {
    const row = el("div", { class: `ls-minfo-objective${ok ? " ok" : ""}` });
    row.append(
      el("span", { class: "ls-minfo-objective-tag", text: ok ? "OK" : tag }),
      el("span", { class: "ls-minfo-objective-label", text: label }),
    );
    if (progress) row.append(el("span", { class: "ls-minfo-objective-progress", text: progress }));
    return row;
  }

  private infoStat(label: string, value: string): HTMLElement {
    return el("div", { class: "ls-minfo-stat" }, [
      el("div", { class: "ls-minfo-stat-value", text: value }),
      el("div", { class: "ls-minfo-stat-label", text: label }),
    ]);
  }

  // ──────────────────────────────────────────────────────────
  // Tab switching + armed state (drives CONFIRM/CANCEL slot)
  // ──────────────────────────────────────────────────────────
  setTab(tab: "build" | "squad"): void {
    if (this.activeTab === tab) {
      // Toggling the same tab while drawer is open closes it (so the player
      // can reclaim screen real-estate without closing the tower sheet).
      if (this.drawer.isOpen) this.drawer.close();
      else this.drawer.open(tab);
      return;
    }
    this.activeTab = tab;
    this.buildTab.classList.toggle("active", tab === "build");
    this.squadTab.classList.toggle("active", tab === "squad");
    this.drawer.open(tab);
    this.haptic(6);
  }

  /**
   * Switch the bottom action bar between its normal "tabs" mode and the
   * "armed" mode where it shows CONFIRM ✓ / CANCEL ✕ for the current
   * placement (tower / squad / relay / killzone).
   */
  setArmed(kind: "tower" | "squad" | "relay" | "killzone" | null): void {
    this.armedKind = kind;
    clear(this.confirmSlot);
    if (!kind) {
      this.mabar.classList.remove("armed");
      this.cancelModeBtn.classList.remove("visible");
      this.ghostHint.classList.remove("visible", "invalid");
      return;
    }
    this.mabar.classList.add("armed");
    this.cancelModeBtn.classList.add("visible");

    const cancelBtn = el("button", { class: "ls-mabar-cancel", text: "✕ CANCEL" });
    cancelBtn.onclick = () => this.cancelArmed();

    if (kind === "tower") {
      const hint = el("div", { class: "ls-mabar-armed-hint", text: "TAP MAP TO BUILD" });
      this.confirmSlot.append(hint, cancelBtn);
    } else {
      const hintLabel = kind === "squad" ? "TAP MAP TO DEPLOY"
        : kind === "relay" ? "TAP MAP FOR RELAY"
        : "TAP MAP TO MARK";
      const hint = el("div", { class: "ls-mabar-armed-hint", text: hintLabel });
      this.confirmSlot.append(hint, cancelBtn);
    }

    this.updateGhostHint();
  }

  private cancelArmed(): void {
    const game = this.game;
    if (this.armedKind === "tower") {
      game.input.selectedTowerType = null;
      game.input.showPlacementPreview = false;
      game.input.cancelGhostPlacement?.();
    } else if (this.armedKind === "squad") {
      game.squads?.cancelCommand();
    } else if (this.armedKind === "relay") {
      game.core.coreDeployMode = false;
    } else if (this.armedKind === "killzone") {
      game.core.killZoneMode = false;
    }
    this.haptic(6);
    this.setArmed(null);
  }

  private confirmTowerPlacement(): void {
    const ok = this.game.input.confirmGhostPlacement?.();
    if (ok) {
      this.haptic([12, 20, 12]);
      this.setArmed(null);
    } else {
      // Failed placement — rejection buzz.
      this.haptic(40);
      this.ghostHint.classList.add("invalid");
      this.ghostHint.textContent = "INVALID SPOT";
      window.setTimeout(() => {
        this.ghostHint.classList.remove("invalid");
        this.updateGhostHint();
      }, 700);
    }
  }

  private updateGhostHint(): void {
    if (!this.armedKind) { this.ghostHint.classList.remove("visible"); return; }
    let text = "DRAG ON MAP";
    if (this.armedKind === "tower") text = "TAP MAP TO BUILD";
    else if (this.armedKind === "squad") text = "TAP MAP TO DEPLOY";
    else if (this.armedKind === "relay") text = "TAP TO PLACE RELAY";
    else if (this.armedKind === "killzone") text = "TAP TO MARK KILL ZONE";
    this.ghostHint.textContent = text;
    this.ghostHint.classList.add("visible");
  }

  // ──────────────────────────────────────────────────────────
  // Bus binding
  // ──────────────────────────────────────────────────────────
  private bind(): void {
    const bus = this.game.bus;

    bus.on("credits:changed", () => this.refreshTopHud());
    bus.on("core:damaged", () => this.refreshTopHud());
    bus.on("core:repaired", () => this.refreshTopHud());
    bus.on("speed:changed", () => this.refreshSpeed());
    bus.on("wave:started", () => { this.refreshTopHud(); this.refreshTabAlerts(); });
    bus.on("wave:complete", () => this.refreshTopHud());
    bus.on<{ prev: string; next: string }>("state:changed", (ev) => this.onStateChanged(ev));

    // Build / squad arming routes through the action bar.
    bus.on<unknown>("build:tool", (type) => {
      if (type) {
        // Cancel any squad arm so we don't double-arm.
        this.game.squads?.cancelCommand();
        this.setArmed("tower");
      } else if (this.armedKind === "tower") {
        this.setArmed(null);
      }
    });
    bus.on("squad:arm", () => this.setArmed("squad"));
    bus.on("squad:disarm", () => { if (this.armedKind === "squad") this.setArmed(null); });

    // Tower selection opens the bottom sheet; clearing closes it.
    bus.on("tower:selected", () => {
      if (this.game.towers.selected) {
        this.towerSheet.open();
        // Collapse the drawer so the sheet has room.
        if (this.drawer.isOpen) this.drawer.close();
      } else {
        this.towerSheet.close();
      }
    });
    bus.on("ui:cleared", () => this.towerSheet.close());

    // Relay / killzone modes: detect via core flags through state polling
    // (no dedicated event exists, so we reflect them via the per-frame tick).
  }

  private onStateChanged(ev: { prev: string; next: string }): void {
    const next = ev.next;
    const showShell =
      next === "PLANNING" || next === "WAVE_ACTIVE" ||
      next === "WAVE_COMPLETE" || next === "PAUSED";
    this.el.classList.toggle("visible", showShell);

    // Reset transient state on entering / leaving PLANNING.
    if (next === "MAIN_MENU" || next === "SECTOR_SELECT" || next === "GAME_OVER" || next === "VICTORY") {
      this.setArmed(null);
      this.drawer.close();
      this.towerSheet.close();
      this.closeMoreMenu();
      this.closeInfoSheet();
    }

    if (showShell) {
      this.refreshTopHud();
      this.refreshSpeed();
      this.refreshStartWave();
      this.refreshTabAlerts();
    }
  }

  // ──────────────────────────────────────────────────────────
  // Per-frame tick
  // ──────────────────────────────────────────────────────────
  private startTick(): void {
    const tick = () => {
      this.updateCreditsDisplay();
      this.refreshStartWave();
      this.refreshEmpQuickAction();
      this.refreshStatusText();
      this.reflectModeFlags();
      this.refreshTabAlerts();
      this.refreshInfoSheet();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /** Sync the action bar with mode flags that don't emit events. */
  private reflectModeFlags(): void {
    const game = this.game;
    // Relay / killzone modes — reflect them as armed states. Don't fight a
    // higher-priority armed state (tower/squad currently being placed).
    if (game.core.coreDeployMode && this.armedKind !== "relay") {
      this.setArmed("relay");
    } else if (!game.core.coreDeployMode && this.armedKind === "relay") {
      this.setArmed(null);
    }
    if (game.core.killZoneMode && this.armedKind !== "killzone" && this.armedKind !== "relay") {
      this.setArmed("killzone");
    } else if (!game.core.killZoneMode && this.armedKind === "killzone") {
      this.setArmed(null);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Top HUD refresh
  // ──────────────────────────────────────────────────────────
  refreshTopHud(): void {
    const c = this.game.core;
    this.targetCredits = c.credits;
    if (!this.creditsPrimed) {
      this.displayedCredits = c.credits;
      this.creditsPrimed = true;
      this.creditsEl.textContent = `${c.credits}`;
    }
    const pct = Math.max(0, Math.min(1, c.coreIntegrity / Math.max(1, c.coreMax)));
    this.coreFillEl.style.width = `${(pct * 100).toFixed(1)}%`;
    const color = pct < 0.3 ? "var(--ls-m-danger)" : pct < 0.6 ? "var(--ls-m-warning)" : "var(--ls-m-good)";
    this.coreFillEl.style.background = color;
    this.coreTextEl.textContent = `${Math.max(0, Math.ceil(c.coreIntegrity))}/${c.coreMax}`;
    this.coreTextEl.classList.toggle("critical", pct < 0.3);

    const total = this.game.waves.totalWaves;
    const cur = Math.min(c.waveIndex + 1, total);
    this.waveEl.textContent = `${cur}/${total}`;
  }

  private refreshSpeed(): void {
    this.speedBtn.textContent = `${this.game.core.speed}×`;
  }

  private refreshStartWave(): void {
    const show = this.game.state === "PLANNING" && this.game.waves.hasMoreWaves;
    this.startWaveBtn.classList.toggle("visible", show);
    if (show) {
      const cd = this.game.waves.planningCountdown;
      if (cd > 0) {
        this.startWaveBtn.textContent = `LAUNCH (${Math.ceil(cd)}s)`;
      } else {
        this.startWaveBtn.textContent = "LAUNCH";
      }
    }
  }

  private refreshStatusText(): void {
    const wave = this.game.waves.nextWaveDef;
    let text = "";
    if (this.game.state === "WAVE_ACTIVE" && wave) text = wave.name;
    else if (this.game.state === "PLANNING" && wave) text = `NEXT: ${wave.name}`;
    else if (this.game.state === "WAVE_COMPLETE") text = "WAVE CLEAR";
    else if (this.game.state === "PAUSED") text = "PAUSED";
    if (this.statusEl.textContent !== text) this.statusEl.textContent = text;
    const isCombat = this.game.state === "WAVE_ACTIVE";
    this.mhud.classList.toggle("combat-priority", isCombat);
    this.mhud.classList.toggle("compact", window.innerWidth <= 430);
  }

  private refreshEmpQuickAction(): void {
    const c = this.game.core;
    const cd = c.coreAbilityCooldown;
    const show = this.game.state === "WAVE_ACTIVE";
    const ready = show && cd <= 0 && this.game.enemies.list.length > 0;
    this.empBtn.classList.toggle("visible", show);
    this.empBtn.classList.toggle("primary", ready);
    this.empBtn.textContent = show ? (cd > 0 ? `EMP ${Math.ceil(cd)}s` : "EMP") : "EMP";
    this.empBtn.title = ready ? "Core EMP ready." : "Core EMP on cooldown.";
  }

  /** Lights up dots on the build/squad tabs when something interesting is happening there. */
  private refreshTabAlerts(): void {
    // Build tab alert: any tower at critical/disabled HP.
    const buildAlert = this.game.towers.list.some(
      (t) => t.durabilityState === "critical" || t.durabilityState === "disabled",
    );
    this.buildTab.classList.toggle("has-alert", buildAlert);

    // Squad tab alert: any squad ready to deploy AND we're in active wave.
    let squadAlert = false;
    if (this.game.squads && this.game.state === "WAVE_ACTIVE") {
      const statuses = this.game.squads.statuses();
      squadAlert = statuses.some(
        (s) => s.unlocked && s.cooldownRemaining <= 0 && s.affordable && s.active < s.capPerType,
      );
    }
    this.squadTab.classList.toggle("has-alert", squadAlert);
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

  // ──────────────────────────────────────────────────────────
  // Haptic helper. No-op on non-supporting browsers.
  // ──────────────────────────────────────────────────────────
  haptic(pattern: number | number[]): void {
    try {
      // Respect reduced-motion: skip non-essential vibration.
      if (this.game.core.settings?.reducedMotion) return;
      navigator.vibrate?.(pattern);
    } catch {
      /* ignore */
    }
  }
}
