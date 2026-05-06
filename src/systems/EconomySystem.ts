import type { Game } from "../core/Game";

/** Harvester income + periodic credit ticks. */
export class EconomySystem {
  constructor(private readonly game: Game) {}

  update(dt: number): void {
    // Harvester ticks are handled inside TowerSystem (unified with other towers).
    // Reserved hook for future events: crystal overcharge, market fluctuations, etc.
    void dt;
  }

  /** Called when wave ends — crystal stabilizer bonus payouts. */
  onWaveComplete(): void {
    for (const t of this.game.towers.list) {
      if (t.type === "harvester" && t.flags.crystalStabilizer) {
        const bonus = Math.round((t.def.income ?? 15) * 2);
        this.game.addCredits(bonus);
        this.game.particles.spawnFloatingText(t.pos.x, t.pos.y - 18, `+${bonus}`, "#00e676");
      }
    }
  }
}
