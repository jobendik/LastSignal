import { EventBus } from "./EventBus";
import { StateMachine } from "./StateMachine";
import { Time } from "./Time";
import {
  applyUpgradeEffect,
  createEmptyStats,
  createEmptyUpgradeAggregate,
  type GameCoreState,
  type GravityAnomaly,
  type SignalInterference,
} from "./GameState";
import {
  MAX_DT,
  RELAY_CORE_SIGNAL_RADIUS_CELLS,
  RELAY_DEPLOY_RADIUS_CELLS,
  SPEED_MULTIPLIERS,
  TILE_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./Config";
import { Camera } from "./Camera";
import type {
  EnemyType,
  GameStateId,
  SectorDefinition,
  SpeedMultiplier,
  UpgradeDefinition,
} from "./Types";

import { AudioSystem } from "../systems/AudioSystem";
import { loadoutDefinitions } from "../data/loadouts";
import { upgradeDefinitions } from "../data/upgrades";
import { rng } from "./Random";
import { GridSystem } from "../systems/GridSystem";
import { EnemySystem } from "../systems/EnemySystem";
import { TowerSystem } from "../systems/TowerSystem";
import { ProjectileSystem } from "../systems/ProjectileSystem";
import { ParticleSystem } from "../systems/ParticleSystem";
import { WaveSystem } from "../systems/WaveSystem";
import { DroneSystem } from "../systems/DroneSystem";
import { RenderSystem } from "../systems/RenderSystem";
import { InputSystem } from "../systems/InputSystem";
import { EconomySystem } from "../systems/EconomySystem";
import { UpgradeSystem } from "../systems/UpgradeSystem";
import { RewardSystem } from "../systems/RewardSystem";
import { CodexSystem } from "../systems/CodexSystem";
import { PersistenceSystem } from "../systems/PersistenceSystem";
import { SettingsSystem } from "../systems/SettingsSystem";
import { StatsSystem } from "../systems/StatsSystem";
import { DifficultySystem } from "../systems/DifficultySystem";
import { MetaSystem } from "../systems/MetaSystem";
import { AchievementSystem } from "../systems/AchievementSystem";
import { EndlessSystem } from "../systems/EndlessSystem";
import { ObjectivesSystem } from "../systems/ObjectivesSystem";
import { StrategicPointSystem } from "../systems/StrategicPointSystem";
import { MobileSquadSystem } from "../systems/MobileSquadSystem";
import { GuidanceSystem } from "../systems/GuidanceSystem";

import { UIManager } from "../ui/UIManager";
import { sectorDefinitions } from "../data/sectors";
import { rollModifiers } from "../data/modifiers";

export class Game {
  bus = new EventBus();
  stateMachine = new StateMachine(this.bus);
  time = new Time();

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  uiRoot: HTMLElement;
  /** True when running with the touch-first mobile chrome enabled. */
  public isMobile = false;

  // Systems
  persistence = new PersistenceSystem();
  settings!: SettingsSystem;
  audio = new AudioSystem();
  camera = new Camera();
  grid = new GridSystem();
  enemies!: EnemySystem;
  towers!: TowerSystem;
  projectiles!: ProjectileSystem;
  particles!: ParticleSystem;
  waves!: WaveSystem;
  drones!: DroneSystem;
  economy!: EconomySystem;
  upgrades!: UpgradeSystem;
  rewards!: RewardSystem;
  codex!: CodexSystem;
  stats!: StatsSystem;
  difficulty!: DifficultySystem;
  meta!: MetaSystem;
  achievements!: AchievementSystem;
  endless!: EndlessSystem;
  objectives!: ObjectivesSystem;
  strategicPoints!: StrategicPointSystem;
  squads!: MobileSquadSystem;
  guidance!: GuidanceSystem;
  render!: RenderSystem;
  input!: InputSystem;
  ui!: UIManager;

  core: GameCoreState;

  private rafId = 0;
  private running = false;
  private replayEvents: { t: number; event: string; data?: unknown }[] = [];

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, isMobile = false) {
    this.canvas = canvas;
    this.isMobile = isMobile;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    this.ctx = ctx;
    this.uiRoot = uiRoot;

    this.settings = new SettingsSystem(this);
    this.audio.setSubtitleHandler((cue) => this.bus.emit("audio:subtitle", cue));
    const loadedSettings = this.persistence.loadSettings();
    const loadedProfile = this.persistence.loadProfile();

    this.core = {
      credits: 0,
      coreIntegrity: 100,
      coreMax: 100,
      waveIndex: 0,
      sector: null,
      speed: 1,
      upgrades: createEmptyUpgradeAggregate(),
      stats: createEmptyStats(),
      settings: loadedSettings,
      profile: loadedProfile,
      debug: { show: false, showFlow: false, showPaths: false },
      shake: 0,
      shakeDir: { x: 0, y: 0 },
      shakeRot: 0,
      slowMo: 0,
      slowMoScale: 0.35,
      showHeatmap: false,
      coreAbilityCooldown: 0,
      coreAbilityCooldownMax: 60,
      emergencyTriggered: false,
      emergencyTimer: 0,
      emergencyOverheatTimer: 0,
      activeModifiers: [],
      hitStopTimer: 0,
      towerRecallUsed: false,
      killZone: null,
      killZoneMode: false,
      bonusUpgradeCount: 0,
      achievedMilestones: new Set(),
      tacticalPauseCharges: 0,
      powerSurgeTimer: 8,
      meteorStrikes: [],
      meteorShowerCooldown: 35,
      gravityAnomaly: null,
      gravityAnomalyCooldown: 50,
      shakeDecay: 30,
      signalInterference: null,
      signalInterferenceCooldown: 55,
      salvagePickups: [],
      coreDeployMode: false,
      coreNodesBuilt: 0,
      commandTier: 1,
      militiaPulseTimer: 12,
    };

    // Wire systems that need `this`.
    this.enemies = new EnemySystem(this);
    this.towers = new TowerSystem(this);
    this.projectiles = new ProjectileSystem(this);
    this.particles = new ParticleSystem(this);
    this.waves = new WaveSystem(this);
    this.drones = new DroneSystem(this);
    this.economy = new EconomySystem(this);
    this.upgrades = new UpgradeSystem(this);
    this.rewards = new RewardSystem(this);
    this.codex = new CodexSystem(this);
    this.stats = new StatsSystem(this);
    this.difficulty = new DifficultySystem(this);
    this.meta = new MetaSystem(this);
    this.achievements = new AchievementSystem(this);
    this.endless = new EndlessSystem(this);
    this.objectives = new ObjectivesSystem(this);
    this.strategicPoints = new StrategicPointSystem(this);
    this.squads = new MobileSquadSystem(this);
    this.guidance = new GuidanceSystem(this);
    this.render = new RenderSystem(this);
    this.input = new InputSystem(this);
    this.ui = new UIManager(this);
  }

  start(): void {
    this.audio.applySettings(this.core.settings);
    this.input.attach();
    this.ui.attach();
    this.guidance.attach();
    this.settings.applyVisualSettings();
    this.setState("MAIN_MENU");
    this.running = true;
    const loop = (now: number) => {
      if (!this.running) return;
      this.time.tick(now);
      this.update(this.time.scaledDt);
      this.render.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.audio.stopMusic();
  }

  setState(next: GameStateId): void {
    this.stateMachine.set(next);
    if (next === "PLANNING" && this.waves) {
      this.waves.beginPlanningCountdown();
    }
    // Adaptive music intensity.
    if (next === "WAVE_ACTIVE") this.audio.setMusicIntensity(1);
    else if (next === "PLANNING" || next === "WAVE_COMPLETE" || next === "REWARD_CHOICE") this.audio.setMusicIntensity(0);
  }
  get state(): GameStateId {
    return this.stateMachine.state;
  }

  // ----- Lifecycle helpers called by UI -----

  beginSector(sector: SectorDefinition, opts: { endless?: boolean; loadoutId?: string } = {}): void {
    const diff = this.difficulty.def;
    const meta = this.meta.aggregate();
    const loadout = opts.loadoutId ? loadoutDefinitions.find((l) => l.id === opts.loadoutId) : null;

    this.core.sector = sector;
    this.core.credits = sector.startingCredits + meta.startingCreditsAdd + (loadout?.creditsBonus ?? 0);
    this.core.coreMax = Math.round(
      sector.coreIntegrity * diff.coreIntegrityMul + meta.coreIntegrityAdd
    );
    this.core.coreIntegrity = this.core.coreMax;
    this.core.waveIndex = 0;
    this.core.upgrades = createEmptyUpgradeAggregate();
    this.core.upgrades.towerDamageMul *= meta.towerDamageMul;
    this.core.upgrades.towerRangeAdd += meta.towerRangeAdd;
    this.core.upgrades.harvesterIncomeMul *= meta.harvesterIncomeMul;
    this.core.stats = createEmptyStats();
    this.core.shake = 0;
    this.core.slowMo = 0;
    this.core.slowMoScale = 0.35;
    this.core.coreAbilityCooldown = 0;
    this.core.emergencyTriggered = false;
    this.core.emergencyTimer = 0;
    this.core.emergencyOverheatTimer = 0;
    this.core.hitStopTimer = 0;
    this.core.towerRecallUsed = false;
    this.core.killZone = null;
    this.core.killZoneMode = false;
    this.core.bonusUpgradeCount = 0;
    this.core.achievedMilestones = new Set();
    this.core.tacticalPauseCharges = 0;
    this.core.powerSurgeTimer = 8;
    this.core.meteorStrikes = [];
    this.core.meteorShowerCooldown = 35;
    this.core.gravityAnomaly = null;
    this.core.gravityAnomalyCooldown = 50;
    this.core.shakeDecay = 30;
    this.core.signalInterference = null;
    this.core.signalInterferenceCooldown = 55;
    this.core.salvagePickups = [];
    this.core.coreDeployMode = false;
    this.core.coreNodesBuilt = 0;
    this.core.commandTier = 1;
    this.core.militiaPulseTimer = 12;
    this.core.speed = 1;
    this.time.timeScale = 1;

    // Roll run modifiers (skip on very first sector to ease new players in,
    // and always skip on the optional Operator Training run so the
    // simulation stays predictable).
    const sectorIdx = sectorDefinitions.findIndex((s) => s.id === sector.id);
    const mods = sector.isTraining ? [] : rollModifiers(sectorIdx);
    this.core.activeModifiers = mods;
    // Apply core integrity modifier, then sync coreIntegrity to final coreMax.
    for (const m of mods) {
      if (m.coreMul) {
        this.core.coreMax = Math.round(this.core.coreMax * m.coreMul);
      }
    }
    this.core.coreIntegrity = this.core.coreMax;

    this.grid.loadSector(sector);
    this.applyCommandTierToGrid();
    this.strategicPoints.loadSector(sector);
    this.camera.init(this.grid.worldW, this.grid.worldH, this.grid.corePos.x, this.grid.corePos.y);
    this.camera.snap();
    this.render.invalidateTerrainCache();
    this.enemies.reset();
    this.towers.reset();
    this.projectiles.reset();
    this.particles.reset();
    this.drones.reset();
    this.squads.reset();
    this.waves.reset();
    this.codex.reset();
    this.guidance.reset();
    this.endless.reset();
    if (opts.endless) this.endless.enable();

    // Apply starting loadout upgrade.
    if (loadout) {
      if (loadout.startUpgradeId === "random_rare") {
        const pool = upgradeDefinitions.filter(
          (u) => (u.rarity === "rare" || u.rarity === "legendary") && !u.curse
        );
        const chosen = rng.shuffle([...pool])[0];
        if (chosen) this.applyUpgrade(chosen);
      } else {
        const u = upgradeDefinitions.find((u) => u.id === loadout.startUpgradeId);
        if (u) this.applyUpgrade(u);
      }
    }

    this.audio.init();
    this.audio.resume();
    this.audio.startMusic();

    this.setState("PLANNING");
    this.bus.emit("sector:started", { sector, loadoutId: opts.loadoutId ?? null });
  }

  returnToMenu(): void {
    // Tear down the active sector run so the canvas stops rendering the
    // previous run's terrain/towers/enemies behind the menu.
    this.core.sector = null;
    this.core.waveIndex = 0;
    this.core.killZone = null;
    this.core.killZoneMode = false;
    this.core.coreDeployMode = false;
    this.core.shake = 0;
    this.core.shakeRot = 0;
    this.core.slowMo = 0;
    this.core.hitStopTimer = 0;
    this.core.meteorStrikes = [];
    this.core.gravityAnomaly = null;
    this.core.signalInterference = null;
    this.core.salvagePickups = [];
    this.core.activeModifiers = [];
    if (this.enemies) this.enemies.reset();
    if (this.towers) this.towers.reset();
    if (this.projectiles) this.projectiles.reset();
    if (this.particles) this.particles.reset();
    if (this.drones) this.drones.reset();
    if (this.squads) this.squads.reset();
    if (this.waves) this.waves.reset();
    if (this.strategicPoints) this.strategicPoints.reset();
    // Clear the grid so darkness/tile-state from the old sector doesn't render.
    if (this.grid) this.grid.reset();
    if (this.render) this.render.invalidateTerrainCache();
    this.camera.init(VIEW_WIDTH, VIEW_HEIGHT, VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
    this.camera.snap();
    this.audio.stopMusic();
    this.audio.setMusicIntensity(0);
    this.setState("MAIN_MENU");
    this.bus.emit("menu:returned");
  }

  recordReplayEvent(event: string, data?: unknown): void {
    this.replayEvents.push({ t: Number(this.time.elapsed.toFixed(3)), event, data });
    if (this.replayEvents.length > 1200) this.replayEvents.shift();
  }

  startDailyChallenge(): void {
    const today = new Date().toISOString().slice(0, 10);
    const index = Math.abs(today.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % sectorDefinitions.length;
    this.core.profile.dailyBestDate = today;
    this.beginSector(sectorDefinitions[index]!, {
      endless: false,
      loadoutId: "assault",
    });
    this.particles.spawnFloatingText(this.grid.corePos.x, this.grid.corePos.y - 46, "DAILY CHALLENGE", "#ffeb3b", 1.8, 14);
  }

  private prePauseState: GameStateId = "WAVE_ACTIVE";

  togglePause(): void {
    if (this.state === "PAUSED") {
      this.setState(this.prePauseState);
    } else if (this.state === "WAVE_ACTIVE") {
      this.prePauseState = this.state;
      this.setState("PAUSED");
    } else if (this.state === "PLANNING") {
      this.prePauseState = this.state;
      this.setState("PAUSED");
    }
  }

  setSpeed(mul: SpeedMultiplier): void {
    if (!SPEED_MULTIPLIERS.includes(mul)) return;
    this.core.speed = mul;
    this.time.timeScale = mul;
    this.bus.emit("speed:changed", mul);
  }

  cycleSpeed(delta: number): void {
    const idx = SPEED_MULTIPLIERS.indexOf(this.core.speed);
    const next = SPEED_MULTIPLIERS[Math.max(0, Math.min(SPEED_MULTIPLIERS.length - 1, idx + delta))]!;
    this.setSpeed(next);
  }

  /** Apply a chosen signal upgrade (roguelite reward). */
  applyUpgrade(u: UpgradeDefinition): void {
    if (this.core.upgrades.appliedUpgradeIds.includes(u.id)) return;
    applyUpgradeEffect(this.core.upgrades, u.effect);
    this.core.upgrades.appliedUpgradeIds.push(u.id);
    if (u.effect.coreIntegrityAdd) {
      this.core.coreIntegrity = Math.min(
        this.core.coreMax,
        this.core.coreIntegrity + u.effect.coreIntegrityAdd
      );
    }
    // Hardened Circuits / Tower HP upgrades: refresh existing towers' max HP.
    if (
      u.effect.towerHpAdd != null ||
      u.effect.towerHpMul != null
    ) {
      for (const t of this.towers.list) this.towers.applyDurabilityAggregate(t);
    }
    // Auto-Gun Plating: bump captured abandoned turret HP cap retroactively.
    if (u.effect.abandonedTurretHpMul != null && this.strategicPoints) {
      const mul = u.effect.abandonedTurretHpMul;
      for (const p of this.strategicPoints.list) {
        if (p.type !== "abandoned_turret" || p.state !== "captured") continue;
        const newMax = Math.max(1, Math.round(p.maxHealth * mul));
        const pct = p.maxHealth > 0 ? p.health / p.maxHealth : 1;
        (p as { maxHealth: number }).maxHealth = newMax;
        p.health = Math.max(1, Math.round(newMax * pct));
      }
    }
    // Cursed upgrades also add a permanent debuff modifier for the rest of the run.
    if (u.curse) {
      this.core.activeModifiers.push(u.curse);
      this.bus.emit("modifier:cursed", u.curse);
    }
    this.bus.emit("upgrade:applied", u);
  }

  damageCore(amount: number, byType?: EnemyType, fromX?: number, fromY?: number): void {
    // Resolve which cluster was struck so feedback localizes there. Falls back
    // to the primary core when no impact position is supplied (UI / scripted hits).
    const impact = fromX != null && fromY != null
      ? this.grid.getNearestCoreCenter(fromX, fromY)
      : this.grid.getPrimaryCoreCenter();
    // Shield squads near the impact reduce incoming damage. Reduction stacks
    // multiplicatively when multiple shield fields overlap.
    if (amount > 0 && this.squads) {
      const mul = this.squads.shieldDamageMul(impact.x, impact.y);
      if (mul < 1) {
        const before = amount;
        amount = amount * mul;
        const absorbed = before - amount;
        if (absorbed > 0.01) {
          this.particles.spawnRing(impact.x, impact.y, 70, "#80deea", 0.45);
          this.particles.spawnFloatingText(impact.x, impact.y - 32, "SHIELDED", "#80deea", 0.7, 11);
        }
      }
    }
    if (amount > 0 && this.hasCoreDeflector()) {
      amount = Math.max(0, amount - 1);
      this.particles.spawnRing(impact.x, impact.y, 78, "#80d8ff");
      this.particles.spawnFloatingText(impact.x, impact.y - 38, "DEFLECT", "#80d8ff", 0.7, 11);
      if (amount <= 0) {
        this.bus.emit("core:shielded", { amount: 1 });
        return;
      }
    }
    this.core.coreIntegrity -= amount;
    this.core.stats.coreDamageTaken += amount;
    if (byType) {
      this.core.stats.damageByEnemyType[byType] =
        (this.core.stats.damageByEnemyType[byType] ?? 0) + amount;
    }
    const shakeAmt = Math.min(10, amount / 4);
    this.core.shake = Math.min(18, this.core.shake + shakeAmt);
    this.core.shakeRot = Math.min(0.04, this.core.shakeRot + shakeAmt * 0.003);
    // Core hits use slow-decay rumble profile.
    this.core.shakeDecay = Math.min(this.core.shakeDecay, 6);
    if (fromX != null && fromY != null) {
      const cx = impact.x;
      const cy = impact.y;
      const len = Math.hypot(fromX - cx, fromY - cy) || 1;
      this.core.shakeDir = { x: (fromX - cx) / len, y: (fromY - cy) / len };
    }
    this.audio.sfxCoreHit(impact);
    this.bus.emit("core:damaged", { amount, by: byType });
    if (this.core.coreIntegrity <= 0) {
      this.core.coreIntegrity = 0;
      this.onGameOver();
    }
  }

  hasCoreDeflector(): boolean {
    if (!this.towers) return false;
    // Deflector grids count if they cover ANY core/relay cluster — once a
    // relay's territory is yours, its deflector should defend your home too.
    const centers = this.grid.getCoreCenters();
    for (const t of this.towers.list) {
      if (t.type !== "barrier" || !t.flags.deflectorGrid) continue;
      const range = this.towers.effectiveStats(t).range;
      for (const c of centers) {
        if (t.pos.dist(c) <= range) return true;
      }
    }
    return false;
  }

  repairCore(): boolean {
    if (this.state !== "PLANNING" && this.state !== "WAVE_COMPLETE") return false;
    const repairCap = this.core.coreMax * 0.8;
    if (this.core.coreIntegrity >= repairCap) return false;
    const cost = 30;
    if (this.core.credits < cost) return false;

    if (!this.spendCredits(cost)) return false;
    const repaired = this.core.coreMax * 0.05;
    this.core.coreIntegrity = Math.min(repairCap, this.core.coreIntegrity + repaired);
    this.particles.spawnFloatingText(
      this.grid.corePos.x,
      this.grid.corePos.y - 30,
      `+${Math.round(repaired)} CORE`,
      "#4caf50",
      0.9,
      12
    );
    this.particles.spawnRing(this.grid.corePos.x, this.grid.corePos.y, 54, "#4caf50");
    this.audio.sfxReward();
    this.bus.emit("core:repaired", { amount: repaired });
    return true;
  }

  /**
   * How many relay cores the player may build this run.
   * Tier 1 → up to 2, Tier 2 → up to 3, Tier 3 → up to 4.
   * Early waves still gate on at least 2 cleared waves so the first one
   * always feels earned.
   */
  maxRelayCoresForRun(): number {
    const earned = 1 + Math.floor(this.core.waveIndex / 3); // wave gating
    const tierCap = 1 + this.core.commandTier; // T1=2, T2=3, T3=4
    return Math.max(0, Math.min(tierCap, earned));
  }

  /** Cost to deploy the next relay core. Slight discount at higher tiers. */
  relayCoreCost(): number {
    if (this.core.commandTier >= 3) return 150;
    if (this.core.commandTier >= 2) return 165;
    return 180;
  }

  canDeployRelayCore(): boolean {
    if (this.state !== "PLANNING" && this.state !== "WAVE_COMPLETE") return false;
    if (this.core.waveIndex < 2) return false;
    if (this.core.coreNodesBuilt >= this.maxRelayCoresForRun()) return false;
    return this.core.credits >= this.relayCoreCost();
  }

  /**
   * Combined relay placement validity — wraps the grid check with a
   * strategic-point overlap test so the 2x2 relay footprint can't bury an
   * active capturable / hostile structure.
   */
  canPlaceRelayAt(c: number, r: number): { ok: boolean; reason?: string } {
    const placement = this.grid.canPlaceCoreCluster(c, r);
    if (!placement.ok) return placement;
    if (this.strategicPoints) {
      for (let dr = 0; dr < 2; dr++) {
        for (let dc = 0; dc < 2; dc++) {
          const sp = this.strategicPoints.pointAtCell(c + dc, r + dr);
          if (sp && sp.state !== "destroyed" && sp.state !== "depleted") {
            return { ok: false, reason: "Strategic point" };
          }
        }
      }
    }
    return { ok: true };
  }

  deployRelayCore(c: number, r: number): boolean {
    if (!this.canDeployRelayCore()) return false;
    const placement = this.canPlaceRelayAt(c, r);
    if (!placement.ok) {
      // Surface the reason at the player's cursor so they can react.
      const px = (c + 1) * TILE_SIZE;
      const py = (r + 1) * TILE_SIZE;
      this.particles.spawnFloatingText(px, py - 16, placement.reason ?? "Invalid", "#ff5252", 1.0, 11);
      this.audio.sfxShoot(0.45, 0.06);
      return false;
    }
    const cost = this.relayCoreCost();
    if (!this.spendCredits(cost)) return false;
    this.grid.placeCoreCluster(c, r);
    this.core.coreNodesBuilt++;
    this.core.coreMax += 40;
    this.core.coreIntegrity = Math.min(this.core.coreMax, this.core.coreIntegrity + 40);
    const x = (c + 1) * TILE_SIZE;
    const y = (r + 1) * TILE_SIZE;
    this.particles.spawnRing(x, y, 46, "#66fcf1");
    this.particles.spawnRing(x, y, this.grid.relaySignalRadiusCells * TILE_SIZE, "#66fcf1", 0.4);
    this.particles.spawnBurst(x, y, "#66fcf1", 18, { speed: 160, life: 0.55, size: 2.5 });
    this.particles.spawnFloatingText(x, y - 24, "RELAY CORE ONLINE", "#66fcf1", 1.2, 11);
    this.audio.sfxReward();
    this.core.coreDeployMode = false;
    this.bus.emit("core:relayBuilt", { c, r, built: this.core.coreNodesBuilt, max: this.maxRelayCoresForRun() });
    return true;
  }

  nextCommandTierCost(): number {
    if (this.core.commandTier === 1) return 220;
    if (this.core.commandTier === 2) return 380;
    return 0;
  }

  canUpgradeCommandTier(): boolean {
    if (this.state !== "PLANNING" && this.state !== "WAVE_COMPLETE") return false;
    if (this.core.commandTier >= 3) return false;
    return this.core.credits >= this.nextCommandTierCost();
  }

  upgradeCommandTier(): boolean {
    if (!this.canUpgradeCommandTier()) return false;
    const cost = this.nextCommandTierCost();
    if (!this.spendCredits(cost)) return false;
    this.core.commandTier = Math.min(3, this.core.commandTier + 1) as 1 | 2 | 3;
    this.core.militiaPulseTimer = 6;
    this.applyCommandTierToGrid();
    this.particles.spawnFloatingText(this.grid.corePos.x, this.grid.corePos.y - 42, `COMMAND TIER ${this.core.commandTier}`, "#ffeb3b", 1.4, 12);
    this.particles.spawnRing(this.grid.corePos.x, this.grid.corePos.y, 72, "#ffeb3b");
    // Pulse all existing core/relay rings to advertise the territory expansion.
    for (const c of this.grid.coreClusters) {
      this.particles.spawnRing(c.center.x, c.center.y, c.signalRadiusCells * TILE_SIZE, "#ffeb3b", 0.45);
    }
    this.audio.sfxReward();
    this.bus.emit("command:tierUp", { tier: this.core.commandTier });
    return true;
  }

  /**
   * Apply Command-Tier driven scaling to relay/coverage radii. Tier 1 leaves
   * everything at its base; Tier 2 grows relay coverage modestly; Tier 3 grows
   * both coverage and the deploy reach so expansion accelerates.
   */
  applyCommandTierToGrid(): void {
    const t = this.core.commandTier;
    // Base values are pulled from Config so a single source of truth governs
    // both the initial sector load and the tier-up scaling.
    const base = RELAY_CORE_SIGNAL_RADIUS_CELLS;
    const baseDeploy = RELAY_DEPLOY_RADIUS_CELLS;
    const relayBonus = t === 3 ? 2 : t === 2 ? 1 : 0;
    const deployBonus = t === 3 ? 2 : t === 2 ? 1 : 0;
    this.grid.relaySignalRadiusCells = base + relayBonus;
    this.grid.relayDeployRadiusCells = baseDeploy + deployBonus;
    // Apply the new radius to existing relay clusters so they actually grow.
    // Synthetic clusters (e.g. captured signal nodes — cells.length === 0)
    // keep their authored radius so they don't bloat into full-size relays.
    for (const cluster of this.grid.coreClusters) {
      if (cluster.isPrimary) continue;
      if (cluster.cells.length === 0) continue;
      cluster.signalRadiusCells = this.grid.relaySignalRadiusCells;
    }
  }

  activateCoreAbility(): boolean {
    if (this.state !== "WAVE_ACTIVE" || this.core.coreAbilityCooldown > 0) return false;
    let affected = 0;
    for (const e of this.enemies.list) {
      if (!e.active) continue;
      e.applyStun(2);
      affected++;
    }
    if (affected === 0) return false;

    const { x, y } = this.grid.corePos;
    this.core.coreAbilityCooldown = this.core.coreAbilityCooldownMax;
    this.particles.spawnRing(x, y, 240, "#66fcf1");
    this.particles.spawnBurst(x, y, "#66fcf1", 34, { speed: 230, life: 0.65, size: 2.5 });
    this.particles.spawnFloatingText(x, y - 42, "CORE EMP", "#66fcf1", 1.1, 17);
    this.audio.sfxStasis(this.grid.corePos);
    this.bus.emit("core:ability", { affected });
    return true;
  }

  addCredits(amount: number): void {
    if (amount <= 0) return;
    const mul = this.meta?.aggregate().rewardMul ?? 1;
    const diffMul = this.difficulty?.def.rewardMul ?? 1;
    const total = Math.max(1, Math.round(amount * mul * diffMul));
    this.core.credits += total;
    this.core.stats.creditsEarned += total;
    this.bus.emit("credits:changed", this.core.credits);
    this.bus.emit("credits:earned", { amount: total });
  }

  spendCredits(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.core.credits < amount) return false;
    this.core.credits -= amount;
    this.core.stats.creditsSpent += amount;
    this.bus.emit("credits:changed", this.core.credits);
    return true;
  }

  onGameOver(): void {
    this.stats.finalize();
    // Even on defeat, partial-progress objectives that don't require a win are awarded
    // (most secondaries gate on runWon, so the practical effect is a no-op).
    this.objectives.awardOnRunEnd(false);
    this.setState("GAME_OVER");
    this.audio.sfxLose();
    this.bus.emit("game:over");
    this.commitProfile();
  }

  onVictory(): void {
    this.stats.finalize();
    // Award secondary-objective research before commitProfile saves the new total.
    this.objectives.awardOnRunEnd(true);
    this.setState("VICTORY");
    this.audio.sfxVictory();
    this.bus.emit("game:victory");
    this.awardResearchOnClear();
    this.commitProfile();
  }

  private awardResearchOnClear(): void {
    // 2 base points plus up to 3 bonus by remaining core integrity.
    const corePct = this.core.coreIntegrity / this.core.coreMax;
    this.meta.addResearchPoints(2 + Math.floor(corePct * 3));
  }

  private commitProfile(): void {
    const p = this.core.profile;
    if (!this.core.sector) return;
    const result = this.state === "VICTORY" ? "victory" : "defeat";
    const isTraining = this.core.sector.isTraining === true;
    const sectorIndex =
      sectorDefinitions.findIndex((s) => s.id === this.core.sector!.id) + 1;
    if (this.state === "VICTORY") {
      // Training never updates campaign progression — it's optional and
      // sits outside the Sector 1 → 7 unlock chain.
      if (!isTraining) {
        p.bestSectorCleared = Math.max(p.bestSectorCleared, sectorIndex);
      } else {
        // Mark training as completed + count secondary stages cleared so the
        // completion screen and Sector Select can show "Training Complete".
        p.trainingCompleted = true;
        const secondaries = this.objectives.evaluateSecondaries(true);
        const cleared = secondaries.filter((r) => r.completed).length;
        p.trainingStagesCompleted = Math.max(p.trainingStagesCompleted, cleared);
      }
    }
    p.bestWaveReached = Math.max(p.bestWaveReached, this.core.waveIndex);
    const corePct = Math.floor(
      (this.core.coreIntegrity / this.core.coreMax) * 100
    );
    p.bestCoreRemaining = Math.max(p.bestCoreRemaining, corePct);
    p.runHistory = [
      this.stats.createJournalEntry(result),
      ...(p.runHistory ?? []),
    ].slice(0, 12);
    const today = new Date().toISOString().slice(0, 10);
    const dailyScore = this.core.waveIndex * 1000 + this.core.stats.enemiesKilled + corePct * 10;
    if (p.dailyBestDate === today) p.dailyBestScore = Math.max(p.dailyBestScore, dailyScore);
    this.persistence.saveProfile(p);
  }

  /** Convenience getter — true while the active sector is the training run. */
  get isTraining(): boolean {
    return this.core.sector?.isTraining === true;
  }

  // ----- Update -----

  private update(dt: number): void {
    if (dt <= 0) return;
    if (dt > MAX_DT) dt = MAX_DT;

    // Always-on updates (UI, shake decay, slow-mo, hit-stop decay using real time).
    const rawDt = this.time.dt;
    if (this.core.hitStopTimer > 0) {
      this.core.hitStopTimer = Math.max(0, this.core.hitStopTimer - rawDt);
    }
    if (this.core.shake > 0) {
      this.core.shake = Math.max(0, this.core.shake - dt * this.core.shakeDecay);
      if (this.core.shake === 0) this.core.shakeDecay = 30; // reset to default after each shake event
    }
    if (this.core.shakeRot > 0) this.core.shakeRot = Math.max(0, this.core.shakeRot - dt * 8);

    // Tick salvage pickup timers; remove expired ones.
    if (this.core.salvagePickups.length > 0) {
      for (const s of this.core.salvagePickups) s.timer -= rawDt;
      this.core.salvagePickups = this.core.salvagePickups.filter((s) => s.timer > 0);
    }
    if (this.core.slowMo > 0) {
      this.core.slowMo -= rawDt;
      this.time.timeScale = this.core.slowMoScale;
      if (this.core.slowMo <= 0) {
        this.time.timeScale = this.core.speed;
        this.core.slowMoScale = 0.35; // reset for next use
      }
    }
    if (this.core.coreAbilityCooldown > 0) {
      this.core.coreAbilityCooldown = Math.max(0, this.core.coreAbilityCooldown - dt);
    }
    this.updateEmergencyProtocol(dt);

    // Crystal ambient sparkles — Poisson rate ~0.6/s per crystal.
    if (this.grid.crystalCells.length > 0 && Math.random() < 0.6 * dt * this.grid.crystalCells.length) {
      const idx = this.grid.crystalCells[Math.floor(Math.random() * this.grid.crystalCells.length)]!;
      const { c, r } = this.grid.coords(idx);
      const px = c * 32 + 16 + (Math.random() - 0.5) * 14;
      const py = r * 32 + 16 + (Math.random() - 0.5) * 14;
      this.particles.spawnBurst(px, py, "#00e676", 1, { speed: 14, life: 0.9, size: 1.5 });
    }

    // Only tick simulation during active wave / wave-complete / victory fanfare.
    const active = this.state === "WAVE_ACTIVE" || this.state === "WAVE_COMPLETE";
    if (active) {
      // Particles always update for visual feedback; simulation freezes during hit-stop.
      this.particles.update(dt);
      if (this.core.hitStopTimer <= 0) {
        this.waves.update(dt);
        this.updatePowerSurges(dt);
        this.updateMeteorShowers(dt);
        this.updateGravityAnomaly(dt);
        this.updateSignalInterference(dt);
        this.towers.update(dt);
        this.enemies.update(dt);
        this.projectiles.update(dt);
        this.drones.update(dt);
        this.squads.update(dt);
        this.economy.update(dt);
        this.strategicPoints.update(dt);
      }

      // Wave completion check (only when simulation is running).
      if (this.core.hitStopTimer <= 0 && this.state === "WAVE_ACTIVE" && this.waves.isWaveFinished() && this.enemies.list.length === 0) {
        this.waves.onWaveComplete();
      }
      this.saveRunSnapshot();
    } else if (this.state === "PLANNING") {
      // Tower visuals og bygging skal oppdateres i PLANNING-fasen.
      this.towers.update(dt); // <- fikser at byggede tårn blir synlige
      this.drones.update(dt * 0.5);
      this.squads.update(dt);
      this.particles.update(dt);
      this.waves.updatePlanningCountdown(dt);
      // Capture progress should advance during planning so the player can
      // claim points without starting the wave first.
      this.strategicPoints.update(dt);
      this.saveRunSnapshot();
    } else if (this.state === "PAUSED") {
      // Freeze simulation; particles continue for ambient visual only.
      this.particles.update(dt * 0.2);
    }

    this.camera.update(dt);
    this.input.update(dt);
    // Guidance ticks regardless of state so tutorials persist on pause and
    // hints can wind down naturally. Uses raw dt so pause freezes the timers.
    if (this.guidance) this.guidance.update(this.time.dt);
  }

  private saveRunSnapshot(): void {
    if (!this.core.sector || (this.state !== "PLANNING" && this.state !== "WAVE_ACTIVE" && this.state !== "WAVE_COMPLETE")) return;
    this.persistence.saveRunSnapshot({
      version: 1,
      state: this.state,
      sectorId: this.core.sector.id,
      waveIndex: this.core.waveIndex,
      credits: this.core.credits,
      coreIntegrity: this.core.coreIntegrity,
      towers: this.towers.list.map((t) => ({
        type: t.type,
        c: t.c,
        r: t.r,
        level: t.level,
        specId: t.specId,
        pinnacleId: t.pinnacleId,
      })),
      stats: this.core.stats,
      savedAt: Date.now(),
    });
    this.persistence.saveReplay(this.replayEvents);
  }

  // ----- Convenience world metrics -----
  get width(): number { return this.grid.worldW; }
  get height(): number { return this.grid.worldH; }

  private updateEmergencyProtocol(dt: number): void {
    const corePct = this.core.coreIntegrity / this.core.coreMax;
    if (
      !this.core.emergencyTriggered &&
      this.state === "WAVE_ACTIVE" &&
      corePct > 0 &&
      corePct < 0.2
    ) {
      this.core.emergencyTriggered = true;
      this.core.emergencyTimer = 15;
      this.core.emergencyOverheatTimer = 0;
      this.particles.spawnFloatingText(
        this.grid.corePos.x,
        this.grid.corePos.y - 46,
        "EMERGENCY PROTOCOL",
        "#ff5252",
        1.6,
        16
      );
      this.particles.spawnRing(this.grid.corePos.x, this.grid.corePos.y, 180, "#ff5252");
      this.audio.sfxBossAlert(this.grid.corePos);
      this.bus.emit("core:emergency", { active: true });
    }

    if (this.core.emergencyTimer > 0) {
      this.core.emergencyTimer = Math.max(0, this.core.emergencyTimer - dt);
      if (this.core.emergencyTimer <= 0) {
        this.core.emergencyOverheatTimer = 5;
        this.particles.spawnFloatingText(
          this.grid.corePos.x,
          this.grid.corePos.y - 46,
          "SYSTEM OVERHEAT",
          "#ff9800",
          1.3,
          15
        );
        this.bus.emit("core:emergency", { active: false });
      }
    } else if (this.core.emergencyOverheatTimer > 0) {
      this.core.emergencyOverheatTimer = Math.max(0, this.core.emergencyOverheatTimer - dt);
    }
  }

  private updateMeteorShowers(dt: number): void {
    if (this.state !== "WAVE_ACTIVE") return;
    // Sector hazard gating (Part 7). Existing strikes still tick so harbinger-spawned
    // meteors and other systems that PUSH onto meteorStrikes still impact correctly;
    // we only suppress the ambient "spawn new shower" path.
    const enabled = this.core.sector?.hazards?.meteors ?? true;
    const c = this.core;

    // Tick existing strikes; handle impacts.
    for (const m of c.meteorStrikes) {
      m.timer -= dt;
      if (m.timer <= 0 && m.timer > -0.05) {
        // Impact: damage enemies within 52px of tile center.
        const px = m.c * TILE_SIZE + TILE_SIZE / 2;
        const py = m.r * TILE_SIZE + TILE_SIZE / 2;
        for (const e of this.enemies.list) {
          if (!e.active) continue;
          const dx = e.pos.x - px, dy = e.pos.y - py;
          if (dx * dx + dy * dy < 52 * 52) {
            e.damage(22, { type: "other" });
          }
        }
        // Disable any tower on this tile for 2s.
        const tower = this.towers.findTowerAt(m.c, m.r);
        if (tower) this.towers.disableTower(tower, 2);
        // Impact FX.
        this.particles.spawnBurst(px, py, "#ff7043", 18, { speed: 140, life: 0.6, size: 3 });
        this.particles.spawnBurst(px, py, "#ffffff", 6, { speed: 60, life: 0.25, size: 2 });
        this.particles.spawnRing(px, py, 48, "#ff7043", 0.4);
        this.particles.spawnRing(px, py, 28, "#ffffff", 0.25);
        this.core.shake = Math.min(18, this.core.shake + 6);
        this.core.shakeRot = Math.min(0.04, this.core.shakeRot + 0.012);
        this.bus.emit("meteor:impact", m);
      }
    }
    c.meteorStrikes = c.meteorStrikes.filter((m) => m.timer > -0.1);

    // Spawn new shower (gated by sector hazard config).
    if (!enabled) return;
    c.meteorShowerCooldown -= dt;
    if (c.meteorShowerCooldown > 0) return;
    c.meteorShowerCooldown = 28 + Math.random() * 20;

    // Pick 2-4 non-rock, non-core tiles.
    const candidates: { c: number; r: number }[] = [];
    for (let attempt = 0; attempt < 80 && candidates.length < 4; attempt++) {
      const tc = Math.floor(Math.random() * this.grid.cols);
      const tr = Math.floor(Math.random() * this.grid.rows);
      const kind = this.grid.cells[this.grid.idx(tc, tr)];
      if (kind === 0 || kind === 2 /* tower */) candidates.push({ c: tc, r: tr });
    }
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < Math.min(count, candidates.length); i++) {
      const target = candidates[i]!;
      c.meteorStrikes.push({ c: target.c, r: target.r, timer: 2.2, maxTimer: 2.2 });
      const px = target.c * TILE_SIZE + TILE_SIZE / 2;
      const py = target.r * TILE_SIZE + TILE_SIZE / 2;
      this.particles.spawnFloatingText(px, py - 22, "IMPACT", "#ff7043", 2.0, 11);
    }
    this.bus.emit("meteor:incoming", count);
  }

  private updateGravityAnomaly(dt: number): void {
    if (this.state !== "WAVE_ACTIVE") return;
    const enabled = this.core.sector?.hazards?.gravity ?? true;
    const c = this.core;

    // Tick active anomaly.
    if (c.gravityAnomaly) {
      const g = c.gravityAnomaly;
      g.timer -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      // Bounce off edges.
      if (g.x < g.radius || g.x > this.grid.worldW - g.radius) g.vx *= -1;
      if (g.y < g.radius || g.y > this.grid.worldH - g.radius) g.vy *= -1;

      // Apply slow to enemies inside the anomaly.
      for (const e of this.enemies.list) {
        if (!e.active || e.isBoss) continue;
        const dx = e.pos.x - g.x, dy = e.pos.y - g.y;
        if (dx * dx + dy * dy < g.radius * g.radius) {
          e.applySlow(0.25, 0.45);
        }
      }

      if (g.timer <= 0) c.gravityAnomaly = null;
      return;
    }

    // Spawn new anomaly (gated by sector hazard config).
    if (!enabled) return;
    c.gravityAnomalyCooldown -= dt;
    if (c.gravityAnomalyCooldown > 0) return;
    c.gravityAnomalyCooldown = 45 + Math.random() * 25;

    const px = this.grid.worldW * (0.2 + Math.random() * 0.6);
    const py = this.grid.worldH * (0.2 + Math.random() * 0.6);
    const angle = Math.random() * Math.PI * 2;
    const speed = 28 + Math.random() * 22;
    c.gravityAnomaly = {
      x: px, y: py,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 64 + Math.random() * 24,
      timer: 12 + Math.random() * 8,
      maxTimer: 20,
    };
    c.gravityAnomaly.maxTimer = c.gravityAnomaly.timer;
    this.particles.spawnFloatingText(px, py - 36, "GRAVITY ANOMALY", "#b39ddb", 2.2, 12);
    this.particles.spawnRing(px, py, c.gravityAnomaly.radius, "#b39ddb", 0.45);
    this.bus.emit("gravity:anomaly", c.gravityAnomaly as GravityAnomaly);
  }

  private updateSignalInterference(dt: number): void {
    if (this.state !== "WAVE_ACTIVE" || this.core.waveIndex < 5) return;
    const enabled = this.core.sector?.hazards?.signalInterference ?? true;
    const c = this.core;

    // Tick active zone.
    if (c.signalInterference) {
      const si = c.signalInterference;
      si.totalTimer -= dt;
      si.moveTimer -= dt;

      if (si.moveTimer <= 0) {
        // Jump to a new random open tile center.
        for (let attempt = 0; attempt < 40; attempt++) {
          const tc = Math.floor(Math.random() * this.grid.cols);
          const tr = Math.floor(Math.random() * this.grid.rows);
          const kind = this.grid.cells[this.grid.idx(tc, tr)];
          if (kind === 0 || kind === 2) {
            si.x = tc * TILE_SIZE + TILE_SIZE / 2;
            si.y = tr * TILE_SIZE + TILE_SIZE / 2;
            break;
          }
        }
        si.moveTimer = 10;
        this.particles.spawnRing(si.x, si.y, si.radius, "#ef6c00", 0.4);
        this.particles.spawnFloatingText(si.x, si.y - 30, "SIGNAL SHIFT", "#ef6c00", 1.2, 10);
      }

      if (si.totalTimer <= 0) {
        c.signalInterference = null;
        c.signalInterferenceCooldown = 55 + Math.random() * 25;
      }
      return;
    }

    // Countdown to next zone (gated by sector hazard config).
    if (!enabled) return;
    c.signalInterferenceCooldown -= dt;
    if (c.signalInterferenceCooldown > 0) return;

    // Spawn at a random open tile center.
    let sx = this.grid.worldW / 2, sy = this.grid.worldH / 2;
    for (let attempt = 0; attempt < 60; attempt++) {
      const tc = Math.floor(Math.random() * this.grid.cols);
      const tr = Math.floor(Math.random() * this.grid.rows);
      const kind = this.grid.cells[this.grid.idx(tc, tr)];
      if (kind === 0 || kind === 2) {
        sx = tc * TILE_SIZE + TILE_SIZE / 2;
        sy = tr * TILE_SIZE + TILE_SIZE / 2;
        break;
      }
    }
    const life = 28 + Math.random() * 16;
    c.signalInterference = {
      x: sx, y: sy,
      radius: 80 + Math.random() * 24,
      moveTimer: 10,
      totalTimer: life,
      maxTotalTimer: life,
    };
    this.particles.spawnFloatingText(sx, sy - 38, "SIGNAL INTERFERENCE", "#ef6c00", 2.4, 12);
    this.particles.spawnRing(sx, sy, c.signalInterference.radius, "#ef6c00", 0.5);
    this.bus.emit("interference:start", c.signalInterference as SignalInterference);
  }

  private updatePowerSurges(dt: number): void {
    if (this.state !== "WAVE_ACTIVE") return;
    const enabled = this.core.sector?.hazards?.powerSurges ?? true;
    if (!enabled) return;
    this.core.powerSurgeTimer -= dt;
    if (this.core.powerSurgeTimer > 0) return;

    const candidates = this.towers.list.filter((t) =>
      t.buildProgress >= 1 &&
      t.powerSurgeTimer <= 0 &&
      !t.isEco &&
      t.type !== "amplifier" &&
      !this.towers.disabled.has(t)
    );
    if (candidates.length === 0) {
      this.core.powerSurgeTimer = 4;
      return;
    }

    const tower = candidates[Math.floor(Math.random() * candidates.length)]!;
    tower.powerSurgeTimer = 3;
    this.core.powerSurgeTimer = 12 + Math.random() * 8;
    this.particles.spawnFloatingText(tower.pos.x, tower.pos.y - 30, "POWER SURGE", "#64ffda", 1.2, 12);
    this.particles.spawnRing(tower.pos.x, tower.pos.y, 44, "#64ffda", 0.35);
    this.particles.spawnBurst(tower.pos.x, tower.pos.y, "#64ffda", 14, { speed: 92, life: 0.45, size: 2 });
    this.audio.sfxPowerSurge(tower.pos);
    this.bus.emit("tower:powerSurge", tower);
  }
}
