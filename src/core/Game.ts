import { EventBus } from "./EventBus";
import { StateMachine } from "./StateMachine";
import { Time } from "./Time";
import {
  applyUpgradeEffect,
  createEmptyStats,
  createEmptyUpgradeAggregate,
  type GameCoreState,
} from "./GameState";
import { DEFAULT_PLANNING_SECONDS, MAX_DT, SPEED_MULTIPLIERS, VIEW_HEIGHT, VIEW_WIDTH } from "./Config";
import type {
  DifficultyId,
  EnemyType,
  GameStateId,
  SectorDefinition,
  SpeedMultiplier,
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
import { TutorialSystem } from "../systems/TutorialSystem";

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
  render!: RenderSystem;
  input!: InputSystem;
  ui!: UIManager;
  difficulty!: DifficultySystem;
  meta!: MetaSystem;
  achievements!: AchievementSystem;
  endless!: EndlessSystem;
  tutorial!: TutorialSystem;

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
      slowMo: 0,
      difficulty: loadedProfile.preferredDifficulty ?? "operative",
      endless: false,
      planningTimer: 0,
      planningMax: 0,
    };

    // Wire systems that need `this`.
    this.difficulty = new DifficultySystem(this);
    this.meta = new MetaSystem(this);
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
    this.achievements = new AchievementSystem(this);
    this.endless = new EndlessSystem(this);
    this.tutorial = new TutorialSystem(this);
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
  }
  get state(): GameStateId {
    return this.stateMachine.state;
  }

  // ----- Lifecycle helpers called by UI -----

  beginSector(sector: SectorDefinition, options?: { difficulty?: DifficultyId; endless?: boolean }): void {
    if (options?.difficulty) this.difficulty.setDifficulty(options.difficulty);
    const endless = Boolean(options?.endless);
    this.core.endless = endless;

    this.core.sector = sector;
    const metaCredits = this.meta.startingCreditsBonus;
    this.core.credits = Math.max(0, Math.round((sector.startingCredits + metaCredits) * 1));
    const coreBoost = this.meta.coreMaxBonus;
    const diffScale = this.difficulty.coreScale();
    this.core.coreMax = Math.round((sector.coreIntegrity + coreBoost) * diffScale);
    this.core.coreIntegrity = this.core.coreMax;
    this.core.waveIndex = 0;
    this.core.upgrades = createEmptyUpgradeAggregate();
    this.core.stats = createEmptyStats();
    this.core.shake = 0;
    this.core.slowMo = 0;
    this.core.speed = 1;
    this.core.planningTimer = 0;
    this.core.planningMax = 0;
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
    this.tutorial.reset();
    this.achievements.resetCombo();

    // Endless: if we selected endless mode, extend the sector's waves now.
    if (endless) {
      const more = this.endless.generateNextBatch(sector.waves.length, 8);
      sector.waves.push(...more);
    }

    this.audio.init();
    this.audio.resume();
    this.audio.startMusic();

    this.setState("PLANNING");
    this.bus.emit("sector:started", sector);
    this.core.profile.totalRuns++;
    this.persistence.saveProfile(this.core.profile);
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
    if (u.effect.coreMaxAdd) {
      this.core.coreMax += u.effect.coreMaxAdd;
    }
    this.bus.emit("upgrade:applied", u);
    this.core.stats.upgradesChosen++;
  }

  damageCore(amount: number, byType?: EnemyType): void {
    this.core.coreIntegrity -= amount;
    this.core.stats.coreDamageTaken += amount;
    if (byType) {
      this.core.stats.damageByEnemyType[byType] =
        (this.core.stats.damageByEnemyType[byType] ?? 0) + amount;
    }
    this.core.shake = Math.min(18, this.core.shake + Math.min(10, amount / 4));
    this.audio.sfxCoreHit();
    if (this.core.coreIntegrity <= 0) {
      this.core.coreIntegrity = 0;
      this.onGameOver();
    }
  }

  addCredits(amount: number): void {
    if (amount <= 0) return;
    this.core.credits += amount;
    this.core.stats.creditsEarned += amount;
    this.bus.emit("credits:changed", this.core.credits);
  }

  onGameOver(): void {
    this.stats.finalize();
    this.setState("GAME_OVER");
    this.audio.sfxLose();
    this.bus.emit("game:over");
    this.commitProfile();
    // Grant research for run progress
    const r = Math.min(5, Math.floor(this.core.stats.enemiesKilled / 40));
    if (r > 0) this.meta.grantResearch(r, "Run reached end");
  }

  onVictory(): void {
    this.stats.finalize();
    this.setState("VICTORY");
    this.audio.sfxVictory();
    this.bus.emit("game:victory");
    this.commitProfile();
    this.core.profile.totalVictories++;
    // Research reward for victory
    const base = 10 + (this.core.sector ? this.sectorIndex() * 2 : 0);
    this.meta.grantResearch(base, "Sector cleared");
    this.persistence.saveProfile(this.core.profile);
  }

  private sectorIndex(): number {
    if (!this.core.sector) return 0;
    return sectorDefinitions.findIndex((s) => s.id === this.core.sector!.id) + 1;
  }

  private commitProfile(): void {
    const p = this.core.profile;
    if (!this.core.sector) return;
    const sectorIndex = this.sectorIndex();
    if (this.state === "VICTORY") {
      p.bestSectorCleared = Math.max(p.bestSectorCleared, sectorIndex);
    }
    p.bestWaveReached = Math.max(p.bestWaveReached, this.core.waveIndex);
    const corePct = Math.floor(
      (this.core.coreIntegrity / this.core.coreMax) * 100
    );
    p.bestCoreRemaining = Math.max(p.bestCoreRemaining, corePct);

    if (this.core.endless) {
      const cur = p.endlessBestWave[this.core.sector.id] ?? 0;
      p.endlessBestWave[this.core.sector.id] = Math.max(cur, this.core.waveIndex);
    }

    this.persistence.saveProfile(p);
  }

  // ----- Update -----

  private update(dt: number): void {
    if (dt <= 0) return;
    if (dt > MAX_DT) dt = MAX_DT;

    // Always-on updates (UI, shake decay, slow-mo etc.)
    if (this.core.shake > 0) this.core.shake = Math.max(0, this.core.shake - dt * 30);
    if (this.core.slowMo > 0) {
      this.core.slowMo -= dt;
      this.time.timeScale = 0.35;
      if (this.core.slowMo <= 0) this.time.timeScale = this.core.speed;
    }

    // Planning countdown.
    if (this.state === "PLANNING" && this.core.settings.autoStartWave && this.waves.hasMoreWaves) {
      if (this.core.planningMax <= 0) {
        const override = this.waves.nextWaveDef?.planningSeconds;
        this.core.planningMax = override && override > 0 ? override : (this.core.settings.planningCountdown || DEFAULT_PLANNING_SECONDS);
        this.core.planningTimer = this.core.planningMax;
      } else {
        this.core.planningTimer = Math.max(0, this.core.planningTimer - dt);
        if (this.core.planningTimer <= 0) {
          this.core.planningTimer = 0;
          this.core.planningMax = 0;
          this.waves.startWave(false);
        }
      }
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
      this.tutorial.update(dt);
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
