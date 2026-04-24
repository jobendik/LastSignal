import type { Game } from "../core/Game";
import { achievementDefinitions } from "../data/achievements";
import type { AchievementDefinition } from "../core/Types";

/**
 * Tracks achievement progress and emits "achievement:unlocked" events
 * for the UI toast. Hooks onto game bus events to detect conditions.
 */
export class AchievementSystem {
  private towerTypesBuilt = new Set<string>();
  private creditsThisRun = 0;
  private flawlessArm = true;

  constructor(private readonly game: Game) {
    this.bind();
  }

  private bind(): void {
    const bus = this.game.bus;
    bus.on("enemy:killed", () => this.unlock("first_blood"));
    bus.on("boss:killed", () => this.unlock("boss_down"));
    bus.on("game:victory", () => this.unlock("sector_cleared"));
    bus.on("wave:started", () => { this.flawlessArm = true; });
    bus.on("core:damaged", () => { this.flawlessArm = false; });
    bus.on("wave:complete", () => {
      if (this.flawlessArm) this.unlock("flawless_wave");
    });
    bus.on("sector:started", () => {
      this.towerTypesBuilt.clear();
      this.creditsThisRun = 0;
    });
    bus.on<{ amount: number }>("credits:earned", (ev) => {
      this.creditsThisRun += ev.amount;
      if (this.creditsThisRun >= 1000) this.unlock("economy_king");
    });
    bus.on<{ type: string }>("tower:builtType", (ev) => {
      this.towerTypesBuilt.add(ev.type);
      if (this.towerTypesBuilt.size >= 5) this.unlock("tower_collector");
    });
    bus.on<{ wave: number }>("endless:wave", (ev) => {
      if (ev.wave >= 10) this.unlock("endless_10");
      if (ev.wave >= 25) this.unlock("endless_25");
    });
    bus.on("game:victory", () => {
      if (this.game.difficulty.current === "nightmare") {
        this.unlock("nightmare_clear");
      }
    });
  }

  list(): AchievementDefinition[] {
    return achievementDefinitions;
  }

  isUnlocked(id: string): boolean {
    return this.game.core.profile.achievementsUnlocked.includes(id);
  }

  unlock(id: string): void {
    if (this.isUnlocked(id)) return;
    const def = achievementDefinitions.find((a) => a.id === id);
    if (!def) return;
    this.game.core.profile.achievementsUnlocked.push(id);
    this.game.core.profile.researchPoints += def.researchReward;
    this.game.persistence.saveProfile(this.game.core.profile);
    this.game.bus.emit("achievement:unlocked", def);
  }
}
