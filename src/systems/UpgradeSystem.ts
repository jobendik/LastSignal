import type { Game } from "../core/Game";
import { upgradeDefinitions } from "../data/upgrades";
import type { UpgradeDefinition } from "../core/Types";
import { rng } from "../core/Random";

/** Offers roguelite reward choices after applicable waves. */
export class RewardSystem {
  currentChoices: UpgradeDefinition[] = [];
  currentCurse: UpgradeDefinition | null = null;
  readonly rerollCost = 35;

  constructor(private readonly game: Game) {}

  /** Produce 3 unique non-curse upgrades not yet applied. */
  rollChoices(count = 3): UpgradeDefinition[] {
    const bonus = this.game.core.bonusUpgradeCount;
    this.game.core.bonusUpgradeCount = 0;
    const total = count + bonus;
    const applied = new Set(this.game.core.upgrades.appliedUpgradeIds);
    const pool = upgradeDefinitions.filter((u) => !applied.has(u.id) && u.rarity !== "cursed");
    const shuffled = rng.shuffle(pool);
    this.currentChoices = shuffled.slice(0, total);
    return this.currentChoices;
  }

  /**
   * Roll a single cursed upgrade card to present alongside normal choices.
   * Only offered from wave 2 onward so new players aren't overwhelmed.
   */
  rollCurseCard(): UpgradeDefinition | null {
    if (this.game.core.waveIndex < 2) {
      this.currentCurse = null;
      return null;
    }
    const applied = new Set(this.game.core.upgrades.appliedUpgradeIds);
    const pool = upgradeDefinitions.filter((u) => u.rarity === "cursed" && !applied.has(u.id));
    if (pool.length === 0) {
      this.currentCurse = null;
      return null;
    }
    this.currentCurse = rng.shuffle(pool)[0] ?? null;
    return this.currentCurse;
  }

  choose(id: string): void {
    const all = [...this.currentChoices, ...(this.currentCurse ? [this.currentCurse] : [])];
    const u = all.find((c) => c.id === id);
    if (!u) return;
    this.game.applyUpgrade(u);
    this.currentChoices = [];
    this.currentCurse = null;
    this.game.audio.sfxReward();
  }

  reroll(): boolean {
    if (this.currentChoices.length === 0) return false;
    if (!this.game.spendCredits(this.rerollCost)) return false;
    const applied = new Set(this.game.core.upgrades.appliedUpgradeIds);
    const previous = new Set(this.currentChoices.map((u) => u.id));
    const freshPool = upgradeDefinitions.filter(
      (u) => !applied.has(u.id) && !previous.has(u.id) && u.rarity !== "cursed"
    );
    const fallbackPool = upgradeDefinitions.filter((u) => !applied.has(u.id) && u.rarity !== "cursed");
    const pool = freshPool.length >= this.currentChoices.length ? freshPool : fallbackPool;
    this.currentChoices = rng.shuffle(pool).slice(0, this.currentChoices.length);
    this.rollCurseCard();
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
