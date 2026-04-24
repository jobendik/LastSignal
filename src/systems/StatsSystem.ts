import type { Game } from "../core/Game";
import type { EnemyType } from "../core/Types";

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
}
