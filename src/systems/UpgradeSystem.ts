import type { Game } from "../core/Game";
import { upgradeDefinitions } from "../data/upgrades";
import type { UpgradeDefinition } from "../core/Types";
import { rng } from "../core/Random";

/** Offers roguelite reward choices after applicable waves. */
export class RewardSystem {
  currentChoices: UpgradeDefinition[] = [];
  readonly rerollCost = 35;

  constructor(private readonly game: Game) {}

  /** Produce 3 unique upgrades not yet applied. */
  rollChoices(count = 3): UpgradeDefinition[] {
    const applied = new Set(this.game.core.upgrades.appliedUpgradeIds);
    const pool = upgradeDefinitions.filter((u) => !applied.has(u.id));
    const shuffled = rng.shuffle(pool);
    this.currentChoices = shuffled.slice(0, count);
    return this.currentChoices;
  }

  choose(id: string): void {
    const u = this.currentChoices.find((c) => c.id === id);
    if (!u) return;
    this.game.applyUpgrade(u);
    this.currentChoices = [];
    this.game.audio.sfxReward();
  }

  reroll(): boolean {
    if (this.currentChoices.length === 0) return false;
    if (!this.game.spendCredits(this.rerollCost)) return false;
    const applied = new Set(this.game.core.upgrades.appliedUpgradeIds);
    const previous = new Set(this.currentChoices.map((u) => u.id));
    const freshPool = upgradeDefinitions.filter((u) => !applied.has(u.id) && !previous.has(u.id));
    const fallbackPool = upgradeDefinitions.filter((u) => !applied.has(u.id));
    const pool = freshPool.length >= this.currentChoices.length ? freshPool : fallbackPool;
    this.currentChoices = rng.shuffle(pool).slice(0, this.currentChoices.length);
    this.game.audio.sfxReward();
    this.game.bus.emit("reward:rerolled");
    return true;
  }
}

export class UpgradeSystem {
  constructor(private readonly game: Game) {}

  /** Convenience: apply a raw upgrade by id (for debug). */
  applyById(id: string): void {
    const u = upgradeDefinitions.find((x) => x.id === id);
    if (u) this.game.applyUpgrade(u);
  }
}
