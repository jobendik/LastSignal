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
  }

  get currentWaveDef(): WaveDefinition | null {
    const sector = this.game.core.sector;
    if (!sector) return null;
    return sector.waves[this.game.core.waveIndex] ?? null;
  }

  get nextWaveDef(): WaveDefinition | null {
    return this.currentWaveDef;
  }

  get hasMoreWaves(): boolean {
    const sector = this.game.core.sector;
    if (!sector) return false;
    return this.game.core.waveIndex < sector.waves.length;
  }

  get totalWaves(): number {
    return this.game.core.sector?.waves.length ?? 0;
  }

  startWave(early = false): void {
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

    // Reset planning timer
    this.game.core.planningTimer = 0;
    this.game.core.planningMax = 0;

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
          timer: timerOffset,
          spawner,
          startDelay: timerOffset,
        });
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

    // Apply per-wave core regen (from upgrades) and Aegis regen pulse.
    const regen = this.game.core.upgrades.coreRegenPerWave;
    if (regen > 0) {
      this.game.core.coreIntegrity = Math.min(this.game.core.coreMax, this.game.core.coreIntegrity + regen);
      this.game.particles.spawnFloatingText(
        this.game.grid.corePos.x,
        this.game.grid.corePos.y - 24,
        `+${regen}`,
        "#4caf50"
      );
    }
    for (const t of this.game.towers.list) {
      if (t.type === "shield" && t.flags.regenPulse) {
        this.game.core.coreIntegrity = Math.min(this.game.core.coreMax, this.game.core.coreIntegrity + 5);
      }
    }

    this.game.core.stats.wavesCleared++;
    this.game.setState("WAVE_COMPLETE");
    this.game.audio.sfxReward();
    this.game.bus.emit("wave:complete", wave);

    // Endless: extend waves on demand
    if (this.game.core.endless) {
      this.game.endless.extendIfNeeded();
      this.game.bus.emit("endless:wave", this.game.core.waveIndex + 1);
    }

    // Advance wave index.
    this.game.core.waveIndex++;

    setTimeout(() => {
      if (this.game.state !== "WAVE_COMPLETE") return;
      if (wave.rewardChoice) {
        const choices = this.game.rewards.rollChoices(3 + this.game.meta.rewardChoiceExtra);
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
      this.game.setState("PLANNING");
    }
  }

  update(dt: number): void {
    if (this.pending.length === 0) {
      this.allSpawned = true;
      return;
    }
    for (const g of this.pending) {
      g.timer -= dt;
      while (g.timer <= 0 && g.remaining > 0) {
        const s = g.spawner;
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
