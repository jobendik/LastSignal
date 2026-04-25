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
      paused: false,
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
    this.core.speed = 1;
    this.time.timeScale = 1;

    // Roll run modifiers (skip on very first sector to ease new players in).
    const sectorIdx = sectorDefinitions.findIndex((s) => s.id === sector.id);
    const mods = rollModifiers(sectorIdx);
    this.core.activeModifiers = mods;
    // Apply core integrity modifier, then sync coreIntegrity to final coreMax.
    for (const m of mods) {
      if (m.coreMul) {
        this.core.coreMax = Math.round(this.core.coreMax * m.coreMul);
      }
    }
    this.core.coreIntegrity = this.core.coreMax;

    this.grid.loadSector(sector);
    this.render.invalidateTerrainCache();
    this.enemies.reset();
    this.towers.reset();
    this.projectiles.reset();
    this.particles.reset();
    this.drones.reset();
    this.waves.reset();
    this.codex.reset();
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
    // Cursed upgrades also add a permanent debuff modifier for the rest of the run.
    if (u.curse) {
      this.core.activeModifiers.push(u.curse);
      this.bus.emit("modifier:cursed", u.curse);
    }
    this.bus.emit("upgrade:applied", u);
  }

  damageCore(amount: number, byType?: EnemyType, fromX?: number, fromY?: number): void {
    if (amount > 0 && this.hasCoreDeflector()) {
      amount = Math.max(0, amount - 1);
      this.particles.spawnRing(this.grid.corePos.x, this.grid.corePos.y, 78, "#80d8ff");
      this.particles.spawnFloatingText(this.grid.corePos.x, this.grid.corePos.y - 38, "DEFLECT", "#80d8ff", 0.7, 11);
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
    if (fromX != null && fromY != null) {
      const cx = this.grid.corePos.x;
      const cy = this.grid.corePos.y;
      const len = Math.hypot(fromX - cx, fromY - cy) || 1;
      this.core.shakeDir = { x: (fromX - cx) / len, y: (fromY - cy) / len };
    }
    this.audio.sfxCoreHit(this.grid.corePos);
    this.bus.emit("core:damaged", { amount, by: byType });
    if (this.core.coreIntegrity <= 0) {
      this.core.coreIntegrity = 0;
      this.onGameOver();
    }
  }

  hasCoreDeflector(): boolean {
    if (!this.towers) return false;
    const core = this.grid.corePos;
    for (const t of this.towers.list) {
      if (t.type !== "barrier" || !t.flags.deflectorGrid) continue;
      if (t.pos.dist(core) <= this.towers.effectiveStats(t).range) return true;
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
    const result = this.state === "VICTORY" ? "victory" : "defeat";
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
    p.runHistory = [
      this.stats.createJournalEntry(result),
      ...(p.runHistory ?? []),
    ].slice(0, 12);
    this.persistence.saveProfile(p);
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
    if (this.core.shake > 0) this.core.shake = Math.max(0, this.core.shake - dt * 30);
    if (this.core.shakeRot > 0) this.core.shakeRot = Math.max(0, this.core.shakeRot - dt * 8);
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
        this.towers.update(dt);
        this.enemies.update(dt);
        this.projectiles.update(dt);
        this.drones.update(dt);
        this.economy.update(dt);
      }

      // Wave completion check (only when simulation is running).
      if (this.core.hitStopTimer <= 0 && this.state === "WAVE_ACTIVE" && this.waves.isWaveFinished() && this.enemies.list.length === 0) {
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

  private updatePowerSurges(dt: number): void {
    if (this.state !== "WAVE_ACTIVE") return;
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
