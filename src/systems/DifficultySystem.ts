import type { Game } from "../core/Game";
import type { DifficultyDefinition, DifficultyId } from "../core/Types";
import { difficultyDefinitions } from "../data/difficulty";

/** Applies HP/reward/speed scaling based on the current difficulty selection. */
export class DifficultySystem {
  constructor(private readonly game: Game) {}

  get current(): DifficultyDefinition {
    return difficultyDefinitions[this.game.core.difficulty];
  }

  setDifficulty(id: DifficultyId): void {
    this.game.core.difficulty = id;
    this.game.core.profile.preferredDifficulty = id;
    this.game.persistence.saveProfile(this.game.core.profile);
    this.game.bus.emit("difficulty:changed", id);
  }

  /** Scales spawn HP. Used by WaveSystem → EnemySystem.spawn. */
  hpScale(isBoss: boolean, isElite: boolean): number {
    const d = this.current;
    let mul = d.hpMul;
    if (isBoss) mul *= 1.0;
    if (isElite) mul *= 1.05;
    return mul;
  }

  rewardScale(): number {
    return this.current.rewardMul;
  }

  speedScale(): number {
    return this.current.speedMul;
  }

  coreScale(): number {
    return this.current.coreIntegrityMul;
  }
}
