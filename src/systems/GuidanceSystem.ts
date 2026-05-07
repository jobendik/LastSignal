import type { Game } from "../core/Game";
import type { HelpCategoryId } from "../data/help";

/**
 * Guidance / onboarding system for LAST SIGNAL.
 *
 * Three layers of contextual help, all driven from this single system:
 *
 *   1. Tutorial cards   — first-time popups that explain a mechanic the moment
 *                         it becomes relevant (e.g. first relay unlock, first
 *                         saboteur, first squad available). Each card has a
 *                         stable id and is shown at most once per profile
 *                         (persisted via guidanceSeen[]).
 *
 *   2. Contextual hints — small, transient HUD lines that appear when the
 *                         player appears stuck or a mechanic becomes briefly
 *                         critical (e.g. "Tower disabled — send Engineer").
 *                         Hints have priority + cooldown and fade out.
 *
 *   3. Mechanic banners — small "New mechanic" bannerss shown once per sector/
 *                         mechanic when the player enters a sector that
 *                         introduces a major system (Sector 3, 6, 7).
 *
 * The HUD subscribes to `guidance:changed` and renders the active card / hint
 * / banner. Players can disable each layer independently via Settings:
 * `tutorialHintsEnabled` / `contextualHintsEnabled` flags on the profile.
 */

export interface GuidanceCard {
  id: string;
  /** Short title (≤ 24 chars). */
  title: string;
  /** 1-2 sentence body. */
  body: string;
  /** Optional key/button hint shown next to the title. */
  hint?: string;
  /** Optional codex tab to open via 'Open Codex' shortcut. */
  codexTab?: HelpCategoryId;
  /** Display flavor: 'tutorial' (modal-ish), 'banner' (small), 'hint' (transient). */
  kind: "tutorial" | "banner" | "hint";
  /** Priority among hints. Higher = more important; replaces lower-priority active hints. */
  priority?: number;
  /** Auto-dismiss after this many seconds (hints only). */
  ttl?: number;
}

interface ActiveGuidance {
  card: GuidanceCard;
  spawnedAt: number;
  expiresAt: number;
}

export class GuidanceSystem {
  /** First-time tutorial card currently displayed (sticky until dismissed). */
  private tutorial: ActiveGuidance | null = null;
  /** "New mechanic" banner currently displayed (auto-dismiss after a delay or click). */
  private banner: ActiveGuidance | null = null;
  /** Transient contextual hint currently displayed (auto-dismiss). */
  private hint: ActiveGuidance | null = null;

  /** Per-run flags so we don't re-show within a single run after dismissal. */
  private runSeen = new Set<string>();
  /** Per-hint-id last-shown timestamp so we don't spam. */
  private hintCooldowns = new Map<string, number>();

  /** Tracking flags for trigger detection (per run). */
  private firstTowerBuilt = false;
  private firstRelayBuilt = false;
  private firstSaboteurSeen = false;
  private firstTowerDamagedSeen = false;
  private firstTowerDisabledSeen = false;
  private firstSquadDamagedSeen = false;
  /** Squads that have been deployed at least once this run. */
  private deployedSquadTypes = new Set<string>();
  /** Strategic point types we've already reacted to discovery for. */
  private discoveredStrategicTypes = new Set<string>();

  /** Time accumulator for low-frequency contextual checks. */
  private contextTickAccum = 0;
  /** Lazy hint queue throttle. */
  private readonly HINT_DEFAULT_COOLDOWN_SEC = 22;
  /** Time accumulator for training-stage stuck checks. */
  private trainingStuckAccum = 0;

  constructor(private readonly game: Game) {}

  /** Bind to game events. Called by Game.start (after wave/towers/etc are constructed). */
  attach(): void {
    const bus = this.game.bus;
    bus.on("sector:started", () => this.onSectorStarted());
    bus.on("tower:built", () => this.onTowerBuilt());
    bus.on("core:relayBuilt", () => this.onRelayBuilt());
    bus.on("strategic:discovered", (ev: unknown) => this.onStrategicDiscovered(ev));
    bus.on("strategic:captured", (ev: unknown) => this.onStrategicCaptured(ev));
    bus.on("squad:deployed", (ev: unknown) => this.onSquadDeployed(ev));
    bus.on("squad:destroyed", () => this.maybeShowEvacHint());
    bus.on("tower:sabotaged", () => this.onTowerSabotaged());
    bus.on("tower:disabled", () => this.onTowerDisabled());
    bus.on("command:tierUp", () => this.dismissHint("command_tier_available"));
    bus.on("build:tool", (type: unknown) => this.onBuildToolChange(type));
    // Training-specific stage cards fire on wave-complete so the player gets
    // a beat to read between drills.
    bus.on("wave:complete", () => this.onWaveCompleteTraining());
  }

  reset(): void {
    this.tutorial = null;
    this.banner = null;
    this.hint = null;
    this.runSeen.clear();
    this.hintCooldowns.clear();
    this.firstTowerBuilt = false;
    this.firstRelayBuilt = false;
    this.firstSaboteurSeen = false;
    this.firstTowerDamagedSeen = false;
    this.firstTowerDisabledSeen = false;
    this.firstSquadDamagedSeen = false;
    this.deployedSquadTypes.clear();
    this.discoveredStrategicTypes.clear();
    this.contextTickAccum = 0;
    this.trainingStuckAccum = 0;
  }

  /** True while the active sector is the optional Operator Training run. */
  private isTrainingActive(): boolean {
    return this.game.core.sector?.isTraining === true;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Public render hooks (HUD reads these)
  // ────────────────────────────────────────────────────────────────────────

  get activeTutorial(): GuidanceCard | null {
    return this.tutorial?.card ?? null;
  }
  get activeBanner(): GuidanceCard | null {
    return this.banner?.card ?? null;
  }
  get activeHint(): GuidanceCard | null {
    return this.hint?.card ?? null;
  }

  dismissTutorial(): void {
    if (!this.tutorial) return;
    this.markPersistedSeen(this.tutorial.card.id);
    this.tutorial = null;
    this.game.bus.emit("guidance:changed");
  }
  dismissBanner(): void {
    if (!this.banner) return;
    this.markPersistedSeen(this.banner.card.id);
    this.banner = null;
    this.game.bus.emit("guidance:changed");
  }
  dismissHint(id?: string): void {
    if (!this.hint) return;
    if (id && this.hint.card.id !== id) return;
    this.hint = null;
    this.game.bus.emit("guidance:changed");
  }

  // ────────────────────────────────────────────────────────────────────────
  // Tick: contextual checks (run continuously while game is in PLANNING /
  // WAVE_ACTIVE / WAVE_COMPLETE).
  // ────────────────────────────────────────────────────────────────────────

  update(dt: number): void {
    const now = this.game.time.elapsed;
    if (this.tutorial && this.tutorial.expiresAt < now) {
      this.dismissTutorial();
    }
    if (this.banner && this.banner.expiresAt < now) {
      this.dismissBanner();
    }
    if (this.hint && this.hint.expiresAt < now) {
      this.dismissHint();
    }

    this.contextTickAccum += dt;
    if (this.contextTickAccum < 0.4) return;
    this.contextTickAccum = 0;
    this.checkContextualTriggers();
    if (this.isTrainingActive()) this.checkTrainingStuckHints(dt);
  }

  /**
   * Training-only safety rails: detect common "what do I do" states and surface
   * a one-line hint. Each id is on its own cooldown so we never hammer the
   * player. Only runs in the training sector.
   */
  private checkTrainingStuckHints(dt: number): void {
    this.trainingStuckAccum += dt;
    if (this.trainingStuckAccum < 1.0) return;
    this.trainingStuckAccum = 0;
    const game = this.game;
    if (game.state !== "PLANNING" && game.state !== "WAVE_ACTIVE") return;

    // No towers built yet, planning has been open a while → "build a tower".
    if (game.state === "PLANNING" && game.towers.list.length === 0 && game.waves.planningCountdown < game.waves.planningDuration - 8) {
      this.queueHint({
        id: "hint_training_no_towers",
        title: "Build a tower",
        body: "Click 1 to pick Pulse Cannon, then click an empty cell inside the cyan Signal Coverage circle.",
        kind: "hint",
        priority: 50,
        ttl: 6,
      });
      return;
    }

    // Wave 2+ and no relay built → "consider relay".
    if (
      game.core.waveIndex >= 2 &&
      game.core.coreNodesBuilt === 0 &&
      game.canDeployRelayCore()
    ) {
      this.queueHint({
        id: "hint_training_relay",
        title: "Try a Relay Core",
        body: "Press R to enter relay deploy mode. Place inside the cyan deploy radius around your home core.",
        kind: "hint",
        priority: 45,
        ttl: 6,
      });
      return;
    }

    // Wave 5+ and no engineer / repair drone deployed → "engineer repairs".
    if (
      game.core.waveIndex >= 4 &&
      !this.deployedSquadTypes.has("engineer") &&
      game.core.commandTier >= 2
    ) {
      this.queueHint({
        id: "hint_training_engineer",
        title: "Engineer fixes towers",
        body: "Drop F2 Engineer near a damaged tower to repair. Engineers also accelerate strategic capture.",
        kind: "hint",
        priority: 35,
        ttl: 6,
      });
      return;
    }

    // Final waves and no Strike deployed → suggest Strike on the rift.
    if (
      game.core.waveIndex >= 5 &&
      !this.deployedSquadTypes.has("strike") &&
      game.core.commandTier >= 3
    ) {
      this.queueHint({
        id: "hint_training_strike",
        title: "Strike the Rift Anchor",
        body: "F3 deploys a Strike Squad. Drop one near the eastern anchor to crack it open.",
        kind: "hint",
        priority: 35,
        ttl: 6,
      });
      return;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ────────────────────────────────────────────────────────────────────────

  private onSectorStarted(): void {
    // Per-run flags reset.
    this.runSeen.clear();
    this.hintCooldowns.clear();
    this.firstTowerBuilt = false;
    this.firstRelayBuilt = false;
    this.firstSaboteurSeen = false;
    this.firstTowerDamagedSeen = false;
    this.firstTowerDisabledSeen = false;
    this.firstSquadDamagedSeen = false;
    this.deployedSquadTypes.clear();
    this.discoveredStrategicTypes.clear();
    this.tutorial = null;
    this.banner = null;
    this.hint = null;

    // Banner for sector-introduced mechanics (Sector 3 / 6 / 7) or the
    // Training simulation entry banner.
    const sector = this.game.core.sector;
    if (!sector) return;
    if (sector.isTraining) {
      this.queueBanner({
        id: "banner_training_intro",
        title: "OPERATOR TRAINING",
        body: "Eight short drills. Build, expand, capture, command squads, repair, and suppress hostile structures. You can dismiss tutorial cards any time.",
        kind: "banner",
        codexTab: "basics",
        ttl: 18,
      });
      // The very first tutorial card welcomes the player and pins to the
      // bottom-centre. Subsequent cards trigger off events / waves.
      this.queueTutorial({
        id: "tut_training_welcome",
        title: "Welcome, Operator",
        body: "This simulation teaches Last Signal's command-defense systems. Each drill highlights one mechanic. Build 2 towers inside Signal Coverage, then START WAVE.",
        kind: "tutorial",
        hint: "1: Pulse · 2: Blaster",
        codexTab: "basics",
      });
      this.game.bus.emit("guidance:changed");
      return;
    }
    if (sector.id === "sector_03_deep_space_wreckage") {
      this.queueBanner({
        id: "banner_sector3",
        title: "NEW: Strategic Capture Points",
        body: "Sector 3 introduces capture mechanics. Capture the abandoned turret on the western lane for a free forward gun.",
        kind: "banner",
        codexTab: "strategic",
      });
    } else if (sector.id === "sector_06_fractured_expanse") {
      this.queueBanner({
        id: "banner_sector6",
        title: "NEW: Relay Expansion & Map Control",
        body: "Roll Relay Cores outward to reach distant crystals, signal nodes, and the western radar dish. Recon scouts the dark frontier.",
        kind: "banner",
        codexTab: "signal",
      });
    } else if (sector.id === "sector_07_blackout_array") {
      this.queueBanner({
        id: "banner_sector7",
        title: "ADVANCED: Hostile Suppression",
        body: "Three rift anchors and two jammers wall off the array. Restore visibility, dismantle hostile structures, and shield exposed relays.",
        kind: "banner",
        codexTab: "hostile",
      });
    }

    this.game.bus.emit("guidance:changed");
  }

  private onBuildToolChange(toolType: unknown): void {
    if (!toolType) return;
    // First-time prompt the moment the player picks any tower from the build menu.
    this.queueTutorial({
      id: "tut_build_tower",
      title: "Build inside coverage",
      body: "Place towers inside the cyan Signal Coverage circle. Click an empty cell to deploy. Right-click cancels.",
      kind: "tutorial",
      hint: "1-9: pick a tower",
    });
  }

  private onTowerBuilt(): void {
    if (this.firstTowerBuilt) return;
    this.firstTowerBuilt = true;
    // No tutorial here yet; the build-tool tutorial covers it. Fire the first
    // strategic-discovery prompt the moment any strategic point becomes visible
    // (handled separately in strategic:discovered).
  }

  private onRelayBuilt(): void {
    if (this.firstRelayBuilt) return;
    this.firstRelayBuilt = true;
    this.queueTutorial({
      id: "tut_relay_built",
      title: "Relay Online",
      body: "Relay Cores extend Signal Coverage. Use them to claim distant territory and reach strategic points beyond the home core.",
      kind: "tutorial",
      hint: "R: redeploy",
      codexTab: "signal",
    });
  }

  private onStrategicDiscovered(ev: unknown): void {
    const e = ev as { id?: string; type?: string } | null;
    if (!e?.type) return;
    const t = e.type;
    if (this.discoveredStrategicTypes.has(t)) return;
    this.discoveredStrategicTypes.add(t);

    switch (t) {
      case "signal_node":
        this.queueTutorial({
          id: "tut_first_signal_node",
          title: "Signal Node found",
          body: "Capture signal nodes to extend your network. Connect a friendly tile to the node and capture progress fills.",
          kind: "tutorial",
          codexTab: "strategic",
        });
        break;
      case "radar_dish":
        this.queueTutorial({
          id: "tut_first_radar",
          title: "Radar Dish found",
          body: "Captured radar reveals more of the sector and exposes hostile structures. Push a relay toward it.",
          kind: "tutorial",
          codexTab: "strategic",
        });
        break;
      case "data_cache":
        this.queueTutorial({
          id: "tut_first_cache",
          title: "Data Cache found",
          body: "One-time pickup. Capturing awards credits and a research point. Engineer captures faster — but the trip's not free.",
          kind: "tutorial",
          codexTab: "strategic",
        });
        break;
      case "abandoned_turret":
        this.queueTutorial({
          id: "tut_first_turret",
          title: "Abandoned Turret found",
          body: "Capture to wake a forward gun. It has its own HP and can be repaired by Engineers if it gets damaged.",
          kind: "tutorial",
          codexTab: "strategic",
        });
        break;
      case "rift_anchor":
        this.queueTutorial({
          id: "tut_first_rift",
          title: "Rift Anchor exposed",
          body: "Hostile structure. Pulses periodically and empowers nearby spawners. Destroy with towers or Strike squads.",
          kind: "tutorial",
          codexTab: "hostile",
        });
        break;
      case "jammer":
        this.queueTutorial({
          id: "tut_first_jammer",
          title: "Jammer exposed",
          body: "Suppresses tower fire rate, repairs, and capture inside its field. Dismantle it or fight outside the field.",
          kind: "tutorial",
          codexTab: "hostile",
        });
        break;
    }
  }

  private onStrategicCaptured(_ev: unknown): void {
    // Currently informational — capture sound + floating text already cover it.
    // Reserved for future onboarding hooks.
    void _ev;
  }

  private onSquadDeployed(ev: unknown): void {
    const e = ev as { type?: string } | null;
    if (!e?.type) return;
    if (this.deployedSquadTypes.has(e.type)) return;
    this.deployedSquadTypes.add(e.type);
    // First-time tutorial per squad type (ties strongly to capability).
    switch (e.type) {
      case "recon":
        this.queueTutorial({
          id: "tut_squad_recon",
          title: "Recon scouts darkness",
          body: "Recon reveals the area it crosses and exposes hostile structures. Right-click world to retask, Q to evac.",
          kind: "tutorial",
          codexTab: "squads",
          hint: "F1 / Q",
        });
        break;
      case "engineer":
        this.queueTutorial({
          id: "tut_squad_engineer",
          title: "Engineer repairs and captures",
          body: "Engineers accelerate capture and repair damaged or disabled towers. Drop them on the unit you want fixed.",
          kind: "tutorial",
          codexTab: "squads",
          hint: "F2 / E retask",
        });
        break;
      case "strike":
        this.queueTutorial({
          id: "tut_squad_strike",
          title: "Strike suppresses structures",
          body: "Strike squads hit hard, especially against hostile structures. Use them to crack rift anchors and finish jammers.",
          kind: "tutorial",
          codexTab: "squads",
          hint: "F3",
        });
        break;
      case "shield":
        this.queueTutorial({
          id: "tut_squad_shield",
          title: "Shield protects exposed assets",
          body: "Shield squads project a damage-reduction field around towers, relays, and the core. Use it for boss waves and rift pulses.",
          kind: "tutorial",
          codexTab: "squads",
          hint: "F4",
        });
        break;
    }
  }

  private onTowerSabotaged(): void {
    if (!this.firstTowerDamagedSeen) {
      this.firstTowerDamagedSeen = true;
      this.queueTutorial({
        id: "tut_first_tower_damaged",
        title: "Tower took damage",
        body: "Towers have HP. Damaged towers fire slower; critical towers are barely combat-effective. Send Engineer to repair.",
        kind: "tutorial",
        codexTab: "durability",
      });
    }
    if (!this.firstSaboteurSeen) {
      this.firstSaboteurSeen = true;
      this.queueTutorial({
        id: "tut_first_saboteur",
        title: "Saboteur incoming",
        body: "Saboteurs damage and disable towers on contact. Prioritize them or protect towers with Shield squads.",
        kind: "tutorial",
        codexTab: "durability",
      });
    }
  }

  private onTowerDisabled(): void {
    if (this.firstTowerDisabledSeen) return;
    this.firstTowerDisabledSeen = true;
    this.queueTutorial({
      id: "tut_first_tower_disabled",
      title: "Tower disabled",
      body: "Disabled towers stop firing but aren't lost. Deploy an Engineer to restore them — passive end-of-wave repair won't fix a 0-HP tower.",
      kind: "tutorial",
      codexTab: "durability",
    });
  }

  private maybeShowEvacHint(): void {
    if (this.firstSquadDamagedSeen) return;
    this.firstSquadDamagedSeen = true;
    this.queueHint({
      id: "hint_squad_evac",
      title: "Squad lost",
      body: "Damaged squads can be EVAC'd to save them. Press Q to recall the selected squad, Shift+Q to recall all.",
      kind: "hint",
      priority: 60,
      ttl: 8,
    });
  }

  /**
   * Training-only: fires after every drill completes. Drops a short stage
   * card that previews the next mechanic. Stage cards live in their own id
   * namespace ("tut_training_stageN") so they're independent of the campaign
   * tutorials and bypass persistedSeen via isTrainingActive().
   */
  private onWaveCompleteTraining(): void {
    if (!this.isTrainingActive()) return;
    const idx = this.game.core.waveIndex; // 0-based AFTER increment in WaveSystem
    // Cards align with the wave the player is about to start next.
    switch (idx) {
      case 1:
        this.queueTutorial({
          id: "tut_training_stage2",
          title: "Stage 2 — Expand the Network",
          body: "Drill 2 opens a second lane. Press R to deploy a Relay Core for an extended Signal Coverage and a forward repair point.",
          kind: "tutorial",
          hint: "R: relay deploy",
          codexTab: "signal",
        });
        break;
      case 2:
        this.queueTutorial({
          id: "tut_training_stage3",
          title: "Stage 3 — Capture Drill",
          body: "The North Repeater is inside coverage. Stand a friendly on it and capture progress fills. Engineer (F2) speeds it up.",
          kind: "tutorial",
          hint: "F2: Engineer",
          codexTab: "strategic",
        });
        break;
      case 3:
        this.queueTutorial({
          id: "tut_training_stage4",
          title: "Stage 4 — Visibility",
          body: "Push west and capture the Damaged Radar Dish. Recon Squad (F1) scouts dark areas and exposes hostile structures.",
          kind: "tutorial",
          hint: "F1: Recon",
          codexTab: "strategic",
        });
        break;
      case 4:
        this.queueTutorial({
          id: "tut_training_stage5",
          title: "Stage 5 — Saboteurs",
          body: "Drill 5 sends a Saboteur. Towers take real HP damage. Engineer (F2) repairs damaged or disabled towers in the field.",
          kind: "tutorial",
          hint: "F2 to repair",
          codexTab: "durability",
        });
        break;
      case 5:
        this.queueTutorial({
          id: "tut_training_stage6",
          title: "Stage 6 — Suppression",
          body: "The eastern Rift Anchor pulses while alive; the Jammer slows fire. Strike (F3) cracks structures, Shield (F4) absorbs pulses.",
          kind: "tutorial",
          hint: "F3 / F4",
          codexTab: "hostile",
        });
        break;
      case 6:
        this.queueTutorial({
          id: "tut_training_stage7",
          title: "Stage 7 — Combined Exercise",
          body: "Use everything together. Captured turret + towers + active squads make the south lane easy.",
          kind: "tutorial",
          codexTab: "squads",
        });
        break;
      case 7:
        this.queueTutorial({
          id: "tut_training_stage8",
          title: "Stage 8 — Certification",
          body: "Final drill. EVAC any damaged squad with Q to save them — that completes Stage 8 and your training.",
          kind: "tutorial",
          hint: "Q: EVAC",
          codexTab: "squads",
        });
        break;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Contextual hints
  // ────────────────────────────────────────────────────────────────────────

  private checkContextualTriggers(): void {
    const game = this.game;
    if (!this.contextualEnabled()) return;
    if (game.state !== "PLANNING" && game.state !== "WAVE_ACTIVE" && game.state !== "WAVE_COMPLETE") return;

    // Highest-priority first; only one hint shown at a time.

    // Disabled tower: critical, repair needed.
    const disabled = this.countDisabledTowers();
    if (disabled > 0) {
      this.queueHint({
        id: "hint_tower_disabled",
        title: disabled > 1 ? `${disabled} towers offline` : "Tower offline",
        body: "Disabled towers can't fire. Deploy an Engineer squad (F2) to repair them.",
        kind: "hint",
        priority: 90,
        ttl: 7,
      });
      return;
    }

    // Rift pulse imminent.
    const sps = game.strategicPoints;
    if (sps && sps.list.length > 0) {
      const imminent = sps.list.some(
        (p) =>
          p.type === "rift_anchor" &&
          p.state === "enemy" &&
          p.discovered &&
          p.effectTimer > 0 &&
          p.effectTimer <= 2.5
      );
      if (imminent) {
        this.queueHint({
          id: "hint_rift_pulse",
          title: "Rift pulse imminent",
          body: "Shield exposed relays (F4) or Strike the anchor (F3) before the pulse releases.",
          kind: "hint",
          priority: 85,
          ttl: 4,
        });
        return;
      }
    }

    // Build outside coverage attempt — soft hint when nothing buildable in coverage.
    if (game.input?.selectedTowerType && this.allCellsBlocked()) {
      this.queueHint({
        id: "hint_no_buildable",
        title: "No buildable cells nearby",
        body: "Expand your network with a Relay Core (R) or capture a signal node to claim more territory.",
        kind: "hint",
        priority: 70,
        ttl: 6,
      });
      return;
    }

    // Command Tier upgrade available.
    if (game.canUpgradeCommandTier()) {
      this.queueHint({
        id: "hint_command_tier",
        title: "Command Tier upgrade available",
        body: `Spend ${game.nextCommandTierCost()} CR (Y) to unlock new squads and expand your relay network.`,
        kind: "hint",
        priority: 40,
        ttl: 8,
      });
      return;
    }

    // Unused squad capacity.
    if (game.squads && game.state === "WAVE_ACTIVE") {
      const sys = game.squads;
      const unused = Math.max(0, sys.globalCap() - sys.list.length);
      const anyReady = sys.statuses().some((s) => s.unlocked && s.affordable && s.cooldownRemaining <= 0 && s.active < s.capPerType);
      if (unused > 1 && anyReady) {
        this.queueHint({
          id: "hint_unused_squad_cap",
          title: `${unused} squad slots unused`,
          body: "Deploy Recon to scout, Engineer to capture/repair, or Strike to suppress hostile structures.",
          kind: "hint",
          priority: 30,
          ttl: 8,
        });
        return;
      }
    }

    // Codex hint (low priority, occasional reminder once per run).
    if (!this.runSeen.has("hint_codex_available") && game.core.waveIndex === 0) {
      this.queueHint({
        id: "hint_codex_available",
        title: "Field manual available",
        body: "Press H or click CODEX at any time to read about systems, controls, and threats.",
        kind: "hint",
        priority: 10,
        ttl: 6,
      });
      return;
    }
  }

  private countDisabledTowers(): number {
    if (!this.game.towers) return 0;
    let n = 0;
    for (const t of this.game.towers.list) {
      if (t.durabilityState === "disabled") n++;
    }
    return n;
  }

  private allCellsBlocked(): boolean {
    // Heuristic: when the player has a tower picked but the hover cell isn't
    // valid AND signal coverage is small, surface a hint. We don't iterate
    // every cell — instead we trust the input system's invalid timer +
    // coverage size. This avoids being an O(n²) hint trigger.
    const inp = this.game.input;
    if (!inp || !inp.selectedTowerType) return false;
    if (inp.placementInvalidTimer <= 0) return false;
    // Only suggest expansion when the player has fewer than 3 relays so the
    // advice is actionable.
    if (this.game.core.coreNodesBuilt >= this.game.maxRelayCoresForRun()) return false;
    return true;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Queueing
  // ────────────────────────────────────────────────────────────────────────

  private queueTutorial(card: GuidanceCard): void {
    if (!this.tutorialEnabled()) return;
    if (this.runSeen.has(card.id)) return;
    // Training sector ignores persisted seen flags so a returning player
    // can run the simulation again and still see every stage card. Run-level
    // dedup still applies so a single drill can't spam the same card.
    if (!this.isTrainingActive() && this.persistedSeen(card.id)) {
      this.runSeen.add(card.id);
      return;
    }
    this.runSeen.add(card.id);
    const now = this.game.time.elapsed;
    this.tutorial = {
      card,
      spawnedAt: now,
      // Tutorials don't time out by default — players dismiss explicitly.
      // Auto-expire after a generous 60s safety net so a sector transition
      // can't strand them if the player never clicks.
      expiresAt: now + (card.ttl ?? 60),
    };
    this.game.audio.sfxPanel(true);
    this.game.bus.emit("guidance:changed");
  }

  private queueBanner(card: GuidanceCard): void {
    if (!this.tutorialEnabled()) return;
    if (this.runSeen.has(card.id)) return;
    if (!this.isTrainingActive() && this.persistedSeen(card.id)) {
      this.runSeen.add(card.id);
      return;
    }
    this.runSeen.add(card.id);
    const now = this.game.time.elapsed;
    this.banner = {
      card,
      spawnedAt: now,
      expiresAt: now + (card.ttl ?? 14),
    };
    this.game.audio.sfxUiClick();
    this.game.bus.emit("guidance:changed");
  }

  private queueHint(card: GuidanceCard): void {
    if (!this.contextualEnabled()) return;
    const now = this.game.time.elapsed;
    const last = this.hintCooldowns.get(card.id) ?? -Infinity;
    const cooldown = this.HINT_DEFAULT_COOLDOWN_SEC;
    if (now - last < cooldown) return;
    // Don't replace a higher-priority active hint with a lower-priority one.
    if (this.hint && (this.hint.card.priority ?? 0) > (card.priority ?? 0)) return;
    // Don't replace the same hint with itself if it's already showing.
    if (this.hint?.card.id === card.id) return;
    this.hintCooldowns.set(card.id, now);
    this.runSeen.add(card.id);
    this.hint = {
      card,
      spawnedAt: now,
      expiresAt: now + (card.ttl ?? 6),
    };
    this.game.bus.emit("guidance:changed");
  }

  // ────────────────────────────────────────────────────────────────────────
  // Persistence helpers
  // ────────────────────────────────────────────────────────────────────────

  private persistedSeen(id: string): boolean {
    return this.game.core.profile.guidanceSeen.includes(id);
  }
  private markPersistedSeen(id: string): void {
    const profile = this.game.core.profile;
    if (profile.guidanceSeen.includes(id)) return;
    profile.guidanceSeen.push(id);
    this.game.persistence.saveProfile(profile);
  }

  /** Player toggle: tutorial cards + banners. */
  private tutorialEnabled(): boolean {
    return this.game.core.profile.tutorialHintsEnabled !== false;
  }
  /** Player toggle: contextual hints. */
  private contextualEnabled(): boolean {
    return this.game.core.profile.contextualHintsEnabled !== false;
  }

  /** Wipe all 'seen' guidance so the player can replay tutorials. */
  resetAllPersistedGuidance(): void {
    const profile = this.game.core.profile;
    profile.guidanceSeen = [];
    profile.commanderBriefingSeen = false;
    this.game.persistence.saveProfile(profile);
    this.runSeen.clear();
    this.hintCooldowns.clear();
  }
}
