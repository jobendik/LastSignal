import type { Game } from "../core/Game";
import type { WaveDefinition, EnemyType, SpawnerDefinition } from "../core/Types";
import { EARLY_START_BONUS } from "../core/Config";

interface PendingGroup {
  type: EnemyType;
  remaining: number;
  interval: number;
  timer: number;
  spawner: SpawnerDefinition;
  startDelay: number;
}

/** Wave spawn orchestration. Lanes run in parallel; each lane queues its enemies. */
export class WaveSystem {
  private pending: PendingGroup[] = [];
  private allSpawned = false;

  constructor(private readonly game: Game) {}

  reset(): void {
    this.pending.length = 0;
    this.allSpawned = false;
    this.planningCountdown = 0;
    this.endlessCurrent = null;
  }

  /** Called by Game when entering PLANNING. Starts an auto-start countdown. */
  beginPlanningCountdown(): void {
    this.planningCountdown = this.planningDuration;
  }

  /** Remembered endless wave so HUD/codex have a stable reference. */
  private endlessCurrent: WaveDefinition | null = null;

  /** Planning-phase countdown (seconds) until auto-start. 0 disables auto-start. */
  planningCountdown = 0;
  readonly planningDuration = 20;

  get currentWaveDef(): WaveDefinition | null {
    const sector = this.game.core.sector;
    if (!sector) return null;
    if (this.game.endless.active && this.game.core.waveIndex >= sector.waves.length) {
      return this.endlessCurrent;
    }
    return sector.waves[this.game.core.waveIndex] ?? null;
  }

  get nextWaveDef(): WaveDefinition | null {
    return this.currentWaveDef;
  }

  get hasMoreWaves(): boolean {
    const sector = this.game.core.sector;
    if (!sector) return false;
    if (this.game.endless.active) return true;
    return this.game.core.waveIndex < sector.waves.length;
  }

  get totalWaves(): number {
    if (this.game.endless.active) {
      // Cosmetic: extend the displayed total by current endless progression.
      return (this.game.core.sector?.waves.length ?? 0) + this.game.endless.wave + 1;
    }
    return this.game.core.sector?.waves.length ?? 0;
  }

  startWave(early = false): void {
    // Generate the next endless wave on demand so it's ready to read.
    if (
      this.game.endless.active &&
      this.game.core.sector &&
      this.game.core.waveIndex >= this.game.core.sector.waves.length
    ) {
      this.endlessCurrent = this.game.endless.generateWave();
    }
    const wave = this.currentWaveDef;
    if (!wave) return;

    // Early-start bonus credits.
    if (early) {
      this.game.addCredits(EARLY_START_BONUS);
      this.game.particles.spawnFloatingText(
        this.game.grid.corePos.x,
        this.game.grid.corePos.y - 24,
        `+${EARLY_START_BONUS}`,
        "#ffeb3b"
      );
    }

    // Build pending groups.
    this.pending = [];
    for (const lane of wave.lanes) {
      const spawner = this.game.grid.spawners.find((s) => s.id === lane.spawnerId) ?? this.game.grid.spawners[0];
      if (!spawner) continue;
      let timerOffset = lane.startDelay ?? 0;
      for (const g of lane.enemies) {
        this.pending.push({
          type: g.type,
          remaining: g.count,
          interval: g.interval,
          timer: timerOffset, // seconds until first spawn
          spawner,
          startDelay: timerOffset,
        });
        // Stagger subsequent groups so they don't overlap unless interval is intentionally short.
        timerOffset += g.count * g.interval;
      }
    }
    this.allSpawned = false;

    this.game.setState("WAVE_ACTIVE");
    this.game.audio.sfxWaveStart();
    this.game.bus.emit("wave:started", wave);
  }

  isWaveFinished(): boolean {
    return this.allSpawned && this.pending.length === 0;
  }

  onWaveComplete(): void {
    const wave = this.currentWaveDef;
    if (!wave) return;

    this.game.addCredits(wave.rewardCredits);
    this.game.economy.onWaveComplete();
    this.game.setState("WAVE_COMPLETE");
    this.game.audio.sfxReward();
    this.game.bus.emit("wave:complete", wave);

    // Advance wave index.
    this.game.core.waveIndex++;

    setTimeout(() => {
      if (this.game.state !== "WAVE_COMPLETE") return;
      if (wave.rewardChoice) {
        // Offer upgrade choices.
        const choices = this.game.rewards.rollChoices(3);
        if (choices.length > 0) {
          this.game.setState("REWARD_CHOICE");
          return;
        }
      }
      this.goToNextOrVictory();
    }, 700);
  }

  goToNextOrVictory(): void {
    if (!this.hasMoreWaves) {
      this.game.onVictory();
    } else {
      // Endless: update the best-wave tracker for persistence.
      if (this.game.endless.active) {
        const prof = this.game.core.profile;
        prof.endlessBestWave = Math.max(prof.endlessBestWave, this.game.endless.wave);
        this.game.persistence.saveProfile(prof);
      }
      this.game.setState("PLANNING");
    }
  }

  updatePlanningCountdown(dt: number): void {
    if (this.planningCountdown <= 0) return;
    this.planningCountdown = Math.max(0, this.planningCountdown - dt);
    if (this.planningCountdown <= 0 && this.hasMoreWaves) {
      this.startWave(false);
    }
  }

  update(dt: number): void {
    if (this.pending.length === 0) {
      // Either all spawned or nothing queued.
      this.allSpawned = true;
      return;
    }
    for (const g of this.pending) {
      g.timer -= dt;
      while (g.timer <= 0 && g.remaining > 0) {
        const s = g.spawner;
        // Spawn near spawner tile, slight random offset.
        const x = s.c * 32 + 16;
        const y = s.r * 32 + 16;
        this.game.enemies.spawn(g.type, x, y);
        g.remaining--;
        g.timer += g.interval;
      }
    }
    this.pending = this.pending.filter((g) => g.remaining > 0);
    this.allSpawned = this.pending.length === 0;
  }
}
