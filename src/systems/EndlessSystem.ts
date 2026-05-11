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
    // HP curve: aggressive early (×0.22/wave) keeps w1–w12 spicy, then a
    // softer late slope (×0.04/wave past w12) so long endless runs stay
    // survivable instead of becoming pure DPS checks.
    this.hpScale = 1 + this.wave * 0.22 + Math.max(0, this.wave - 12) * 0.04;
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
    // Boss cadence: every 8 waves, with rotating boss + escort archetype so
    // pattern recognition doesn't kick in by w16.
    const isBoss = this.wave % 8 === 0;
    // Wave events: silence on 5, 17, 29... and blitz on 11, 23, 35...
    // Avoid stacking an event with a boss wave so the player isn't punished
    // by RNG-collision on the run's hardest beats.
    let waveEvent: "blitz" | "silence" | undefined;
    if (!isBoss) {
      if (this.wave >= 5 && (this.wave - 5) % 12 === 0) waveEvent = "silence";
      else if (this.wave >= 11 && (this.wave - 11) % 12 === 0) waveEvent = "blitz";
    }

    if (isBoss && lanes.length > 0) {
      // Themed boss rotations with matched escort flavour. Each act adds a
      // qualitatively distinct fight so endless runs feel like a campaign
      // rather than a stat-treadmill.
      const cycle = Math.floor((this.wave - 1) / 8);
      let bossType: EnemyType;
      let escortType: EnemyType;
      switch (cycle % 4) {
        case 0: // w8: Overlord + sprinters (raw aggression)
          bossType = "overlord";
          escortType = "sprinter";
          break;
        case 1: // w16: Harbinger + saboteurs (positioning + sabotage)
          bossType = "harbinger";
          escortType = "saboteur";
          break;
        case 2: // w24: Leviathan + mirrors (pierce + reflection)
          bossType = "leviathan";
          escortType = "mirror";
          break;
        default: // w32+: dual-boss combo (Harbinger + Overlord)
          bossType = "harbinger";
          escortType = "overlord";
          break;
      }
      // Inject boss + a small themed escort group on the first lane.
      const firstLane = lanes[0]!;
      firstLane.enemies.push({ type: bossType, count: 1, interval: 0.1 });
      if (lanes.length > 1) {
        lanes[1]!.enemies.push({
          type: escortType,
          count: 3 + Math.floor(this.wave / 8),
          interval: 0.7,
        });
      }
    }

    // Reward tuning: every wave gives a reward choice from wave 3 onwards
    // (was every 3rd) so endless feels generous; bosses always offer one.
    const rewardChoice = isBoss || this.wave % 2 === 0;

    this.game.bus.emit("endless:wave", { wave: this.wave });
    return {
      id,
      name: `ENDLESS ${this.wave.toString().padStart(2, "0")}${
        waveEvent ? ` · ${waveEvent.toUpperCase()}` : ""
      }${isBoss ? " · BOSS" : ""}`,
      description: this.flavorText(isBoss, waveEvent),
      warning: this.warningText(isBoss, waveEvent),
      recommendedCounters: [],
      rewardCredits: 40 + this.wave * 10 + (isBoss ? 80 : 0),
      rewardChoice,
      lanes,
      isBossWave: isBoss,
      ...(waveEvent ? { waveEvent } : {}),
    };
  }

  private flavorText(isBoss: boolean, event: "blitz" | "silence" | undefined): string {
    if (isBoss) return "A larger signal anomaly punches through. Boss escort detected.";
    if (event === "blitz") return "Coordinated blitz across every gate.";
    if (event === "silence") return "Tower systems briefly drop offline mid-wave.";
    return "Procedurally-generated endless anomaly surge.";
  }

  private warningText(isBoss: boolean, event: "blitz" | "silence" | undefined): string {
    if (isBoss) return "BOSS ESCORT DETECTED";
    if (event === "blitz") return "BLITZ WAVE — all lanes spawn together. Pre-set kill zones.";
    if (event === "silence") return "SILENCE WAVE — towers go quiet for 5s. Drones and squads still operate.";
    return "Increasing anomaly pressure.";
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
