import type { Game } from "../core/Game";
import type { EnemyType, WaveDefinition } from "../core/Types";

/**
 * Endless mode. After the last sector wave, we start generating waves
 * procedurally with escalating HP and speed.
 */
export class EndlessSystem {
  active = false;
  wave = 0;
  hpScale = 1;
  speedScale = 1;

  constructor(private readonly game: Game) {}

  reset(): void {
    this.active = false;
    this.wave = 0;
    this.hpScale = 1;
    this.speedScale = 1;
  }

  enable(): void {
    this.active = true;
    this.wave = 0;
    this.hpScale = 1;
    this.speedScale = 1;
    this.game.bus.emit("endless:started");
  }

  /** Build a dynamic wave definition for the next endless wave. */
  generateWave(): WaveDefinition {
    this.wave++;
    this.hpScale = 1 + this.wave * 0.18;
    this.speedScale = 1 + Math.min(this.wave * 0.04, 0.9);
    const pool: EnemyType[] = [
      "scout",
      "grunt",
      "sprinter",
      "swarm",
    ];
    if (this.wave >= 3) pool.push("brute", "weaver");
    if (this.wave >= 5) pool.push("phantom", "shielder");
    if (this.wave >= 7) pool.push("splitter", "jammer");
    if (this.wave >= 8) pool.push("tunneler");
    if (this.wave >= 10) pool.push("juggernaut", "carrier", "saboteur");
    if (this.wave >= 6) pool.push("mirror");

    const spawners = this.game.grid.spawners;
    const lanes = spawners.map((s, i) => ({
      spawnerId: s.id,
      startDelay: i * 0.4,
      enemies: this.rollGroup(pool),
    }));

    const id = `endless_${this.wave}`;
    const isBoss = this.wave % 8 === 0;
    if (isBoss) {
      const type: EnemyType = this.wave >= 16 ? "leviathan" : "overlord";
      lanes[0]!.enemies.push({ type, count: 1, interval: 0.1 });
    }

    this.game.bus.emit("endless:wave", { wave: this.wave });
    return {
      id,
      name: `ENDLESS ${this.wave.toString().padStart(2, "0")}`,
      description: "Procedurally-generated endless anomaly surge.",
      warning: isBoss ? "BOSS ESCORT DETECTED" : "Increasing anomaly pressure.",
      recommendedCounters: [],
      rewardCredits: 30 + this.wave * 6,
      rewardChoice: this.wave % 3 === 0,
      lanes,
      isBossWave: isBoss,
    };
  }

  private rollGroup(pool: EnemyType[]) {
    const groups: { type: EnemyType; count: number; interval: number }[] = [];
    const kinds = 2 + Math.min(3, Math.floor(this.wave / 4));
    for (let i = 0; i < kinds; i++) {
      const type = pool[Math.floor(Math.random() * pool.length)]!;
      groups.push({
        type,
        count: 3 + Math.floor(Math.random() * 5) + Math.floor(this.wave / 2),
        interval: 0.35 + Math.random() * 0.4,
      });
    }
    return groups;
  }
}
