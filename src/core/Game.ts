import { EventBus } from "./EventBus";
import { StateMachine } from "./StateMachine";
import { Time } from "./Time";
import {
  applyUpgradeEffect,
  createEmptyStats,
  createEmptyUpgradeAggregate,
  type GameCoreState,
} from "./GameState";
import { MAX_DT, SPEED_MULTIPLIERS, VIEW_HEIGHT, VIEW_WIDTH } from "./Config";
import type {
  EnemyType,
  GameStateId,
  SectorDefinition,
  SpeedMultiplier,
  TowerType,
  UpgradeDefinition,
} from "./Types";

import { AudioSystem } from "../systems/AudioSystem";
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

import { UIManager } from "../ui/UIManager";
import { sectorDefinitions } from "../data/sectors";

export class Game {
  bus = new EventBus();
  stateMachine = new StateMachine(this.bus);
  time = new Time();

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  uiRoot: HTMLElement;

  // Systems
  persistence = new PersistenceSystem();
  settings!: SettingsSystem;
  audio = new AudioSystem();
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
  render!: RenderSystem;
  input!: InputSystem;
  ui!: UIManager;

  core: GameCoreState;

  private rafId = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    this.ctx = ctx;
    this.uiRoot = uiRoot;

    this.settings = new SettingsSystem(this);
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
      paused: false,
      debug: { show: false, showFlow: false, showPaths: false },
      shake: 0,
      shakeDir: { x: 0, y: 0 },
      shakeRot: 0,
      slowMo: 0,
      showHeatmap: false,
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
    this.render = new RenderSystem(this);
    this.input = new InputSystem(this);
    this.ui = new UIManager(this);
  }

  start(): void {
    this.audio.applySettings(this.core.settings);
    this.input.attach();
    this.ui.attach();
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
  }
  get state(): GameStateId {
    return this.stateMachine.state;
  }

  // ----- Lifecycle helpers called by UI -----

  beginSector(sector: SectorDefinition, opts: { endless?: boolean } = {}): void {
    const diff = this.difficulty.def;
    const meta = this.meta.aggregate();

    this.core.sector = sector;
    this.core.credits = sector.startingCredits + meta.startingCreditsAdd;
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
    this.core.speed = 1;
    this.time.timeScale = 1;

    this.grid.loadSector(sector);
    this.enemies.reset();
    this.towers.reset();
    this.projectiles.reset();
    this.particles.reset();
    this.drones.reset();
    this.waves.reset();
    this.codex.reset();
    this.endless.reset();
    if (opts.endless) this.endless.enable();

    this.audio.init();
    this.audio.resume();
    this.audio.startMusic();

    this.setState("PLANNING");
    this.bus.emit("sector:started", sector);
  }

  returnToMenu(): void {
    this.setState("MAIN_MENU");
    this.bus.emit("menu:returned");
  }

  togglePause(): void {
    if (this.state === "PAUSED") {
      this.setState("WAVE_ACTIVE"); // resume implies a wave was active
    } else if (this.state === "WAVE_ACTIVE") {
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
    this.bus.emit("upgrade:applied", u);
  }

  damageCore(amount: number, byType?: EnemyType, fromX?: number, fromY?: number): void {
    this.core.coreIntegrity -= amount;
    this.core.stats.coreDamageTaken += amount;
    if (byType) {
      this.core.stats.damageByEnemyType[byType] =
        (this.core.stats.damageByEnemyType[byType] ?? 0) + amount;
    }
    const shakeAmt = Math.min(10, amount / 4);
    this.core.shake = Math.min(18, this.core.shake + shakeAmt);
    this.core.shakeRot = Math.min(0.04, this.core.shakeRot + shakeAmt * 0.003);
    if (fromX != null && fromY != null) {
      const cx = this.grid.corePos.x;
      const cy = this.grid.corePos.y;
      const len = Math.hypot(fromX - cx, fromY - cy) || 1;
      this.core.shakeDir = { x: (fromX - cx) / len, y: (fromY - cy) / len };
    }
    this.audio.sfxCoreHit();
    this.bus.emit("core:damaged", { amount, by: byType });
    if (this.core.coreIntegrity <= 0) {
      this.core.coreIntegrity = 0;
      this.onGameOver();
    }
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

  onGameOver(): void {
    this.stats.finalize();
    this.setState("GAME_OVER");
    this.audio.sfxLose();
    this.bus.emit("game:over");
    this.commitProfile();
  }

  onVictory(): void {
    this.stats.finalize();
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
    const sectorIndex =
      sectorDefinitions.findIndex((s) => s.id === this.core.sector!.id) + 1;
    if (this.state === "VICTORY") {
      p.bestSectorCleared = Math.max(p.bestSectorCleared, sectorIndex);
    }
    p.bestWaveReached = Math.max(p.bestWaveReached, this.core.waveIndex);
    const corePct = Math.floor(
      (this.core.coreIntegrity / this.core.coreMax) * 100
    );
    p.bestCoreRemaining = Math.max(p.bestCoreRemaining, corePct);
    this.persistence.saveProfile(p);
  }

  // ----- Update -----

  private update(dt: number): void {
    if (dt <= 0) return;
    if (dt > MAX_DT) dt = MAX_DT;

    // Always-on updates (UI, shake decay, slow-mo etc.)
    if (this.core.shake > 0) this.core.shake = Math.max(0, this.core.shake - dt * 30);
    if (this.core.shakeRot > 0) this.core.shakeRot = Math.max(0, this.core.shakeRot - dt * 8);
    if (this.core.slowMo > 0) {
      this.core.slowMo -= dt;
      this.time.timeScale = 0.35;
      if (this.core.slowMo <= 0) this.time.timeScale = this.core.speed;
    }

    // Only tick simulation during active wave / wave-complete / victory fanfare.
    const active = this.state === "WAVE_ACTIVE" || this.state === "WAVE_COMPLETE";
    if (active) {
      this.waves.update(dt);
      this.towers.update(dt);
      this.enemies.update(dt);
      this.projectiles.update(dt);
      this.drones.update(dt);
      this.particles.update(dt);
      this.economy.update(dt);

      // Wave completion check
      if (this.state === "WAVE_ACTIVE" && this.waves.isWaveFinished() && this.enemies.list.length === 0) {
        this.waves.onWaveComplete();
      }
    } else if (this.state === "PLANNING") {
      // Tower visuals still animate a bit, drones idle, particles decay.
      this.drones.update(dt * 0.5);
      this.particles.update(dt);
      this.waves.updatePlanningCountdown(dt);
    } else if (this.state === "PAUSED") {
      // Freeze simulation; particles continue for ambient visual only.
      this.particles.update(dt * 0.2);
    }

    this.input.update(dt);
  }

  // ----- Convenience world metrics -----
  get width(): number { return VIEW_WIDTH; }
  get height(): number { return VIEW_HEIGHT; }
}
