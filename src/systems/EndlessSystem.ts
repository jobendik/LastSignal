import type { Game } from "../core/Game";
import type { EnemyType, WaveDefinition } from "../core/Types";
import { createRNG } from "../core/Random";

/**
 * Procedurally generates escalating waves for endless mode.
 * After a sector is cleared, Endless replaces the wave list with an infinite ladder.
 */
export class EndlessSystem {
  private rng = createRNG(Date.now());

  constructor(private readonly game: Game) {}

  reset(): void {
    this.rng = createRNG(Date.now());
  }

  /**
   * Build the next N endless waves. These are generated on demand and appended
   * to the sector's waves array so the existing WaveSystem can play them.
   */
  generateNextBatch(startFromWave: number, count = 5): WaveDefinition[] {
    const waves: WaveDefinition[] = [];
    for (let i = 0; i < count; i++) {
      const n = startFromWave + i + 1;
      waves.push(this.generateWave(n));
    }
    return waves;
  }

  private generateWave(n: number): WaveDefinition {
    const pickPool = (tier: number): EnemyType[] => {
      const base: EnemyType[] = ["scout", "grunt", "brute", "weaver", "phantom", "carrier"];
      if (tier >= 2) base.push("shielded", "sapper", "swarmling");
      if (tier >= 3) base.push("wraith", "corruptor");
      if (tier >= 4) base.push("titan");
      return base;
    };

    const tier = Math.min(4, 1 + Math.floor(n / 4));
    const pool = pickPool(tier);

    const laneCount = 1 + Math.min(3, Math.floor(n / 3));
    const spawners = ["north", "south", "east", "west"];
    const lanes: WaveDefinition["lanes"] = [];

    for (let i = 0; i < laneCount; i++) {
      const spawnerId = this.rng.pick(spawners);
      const groups = [];
      const groupCount = 1 + this.rng.int(0, 1);
      for (let g = 0; g < groupCount; g++) {
        const type = this.rng.pick(pool);
        const scaling = 1 + n * 0.15;
        const baseCount = Math.max(2, Math.floor((8 + this.rng.int(-3, 5)) * scaling / 2));
        const countAdj = type === "leviathan" || type === "harbinger" || type === "titan" ? 1 : baseCount;
        const interval = Math.max(0.12, 0.65 - n * 0.015 + this.rng.range(-0.1, 0.1));
        groups.push({
          type,
          count: Math.min(40, countAdj),
          interval,
        });
      }
      lanes.push({
        spawnerId,
        enemies: groups,
        startDelay: i === 0 ? 0 : this.rng.range(0.2, 1.5),
      });
    }

    // Boss every 10 waves in endless
    const isBoss = n % 10 === 0;
    if (isBoss) {
      lanes.push({
        spawnerId: this.rng.pick(spawners),
        enemies: [{ type: n % 20 === 0 ? "leviathan" : "harbinger", count: 1, interval: 1 }],
        startDelay: 2,
      });
    }

    const enemySummary = new Map<EnemyType, number>();
    for (const lane of lanes) {
      for (const g of lane.enemies) enemySummary.set(g.type, (enemySummary.get(g.type) ?? 0) + g.count);
    }

    return {
      id: `endless_wave_${n}`,
      name: `Endless Wave ${n}`,
      description: isBoss ? "Endless boss wave — elite incursion inbound." : "Procedurally escalating threat.",
      warning: isBoss ? "Endless elite! Prepare heavy fire." : "Signal grows unstable.",
      recommendedCounters: ["Adapt"],
      rewardCredits: Math.floor(80 + n * 15),
      rewardChoice: n % 3 === 0,
      isBossWave: isBoss,
      lanes,
      enemySummary: Array.from(enemySummary.entries()).map(([type, count]) => ({ type, count })),
    };
  }

  /** Called when the current wave list is about to be exhausted. */
  extendIfNeeded(): void {
    const sector = this.game.core.sector;
    if (!sector || !this.game.core.endless) return;
    const remaining = sector.waves.length - this.game.core.waveIndex;
    if (remaining < 3) {
      const more = this.generateNextBatch(sector.waves.length, 5);
      sector.waves.push(...more);
    }
  }
}
