import type { Game } from "../core/Game";
import type { EnemyType, RunJournalEntry, RunResult } from "../core/Types";

/** Tracks and writes persistence summary of the current run. */
export class StatsSystem {
  constructor(private readonly game: Game) {}

  recordDamage(byTower: string, amount: number): void {
    const stats = this.game.core.stats;
    const t = byTower as keyof typeof stats.damageByTowerType;
    stats.damageByTowerType[t] = (stats.damageByTowerType[t] ?? 0) + amount;
  }

  recordKill(enemy: EnemyType): void {
    const stats = this.game.core.stats;
    stats.enemiesKilled++;
    stats.killsByEnemyType[enemy] = (stats.killsByEnemyType[enemy] ?? 0) + 1;
  }

  finalize(): void {
    const stats = this.game.core.stats;
    // Identify best tower by current level.
    let best = null as null | { type: string; level: number };
    for (const t of this.game.towers.list) {
      if (!best || t.level > best.level) best = { type: t.type, level: t.level };
    }
    stats.bestTowerType = best ? (best.type as typeof stats.bestTowerType) : null;
    stats.bestTowerLevel = best?.level ?? 0;
  }

  createJournalEntry(result: RunResult): RunJournalEntry {
    const stats = this.game.core.stats;
    const now = Date.now();
    const sector = this.game.core.sector;
    const sectorWaveCount = sector?.waves.length ?? this.game.waves.totalWaves;
    const endlessWaveReached =
      this.game.endless.active &&
      this.game.endless.wave > 0 &&
      this.game.core.waveIndex >= sectorWaveCount;
    const totalWaves = endlessWaveReached
      ? Math.max(this.game.waves.totalWaves, sectorWaveCount + this.game.endless.wave)
      : this.game.waves.totalWaves;
    const waveReached = result === "victory"
      ? totalWaves
      : endlessWaveReached
        ? sectorWaveCount + this.game.endless.wave
        : Math.max(1, Math.min(totalWaves || 1, this.game.core.waveIndex + 1));
    const coreRemainingPct = this.game.core.coreMax > 0
      ? Math.round((this.game.core.coreIntegrity / this.game.core.coreMax) * 100)
      : 0;

    return {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      result,
      sectorId: sector?.id ?? "unknown",
      sectorName: sector?.name ?? "Unknown Sector",
      difficulty: this.game.difficulty.current,
      startedAt: stats.startedAt,
      endedAt: now,
      durationSec: Math.max(0, Math.round((now - stats.startedAt) / 1000)),
      waveReached,
      totalWaves,
      endless: this.game.endless.active,
      coreRemainingPct: Math.max(0, Math.min(100, coreRemainingPct)),
      enemiesKilled: stats.enemiesKilled,
      creditsEarned: stats.creditsEarned,
      creditsSpent: stats.creditsSpent,
      bestTowerType: stats.bestTowerType,
      bestTowerLevel: stats.bestTowerLevel,
      modifiers: this.game.core.activeModifiers.map((m) => m.name),
    };
  }
}
