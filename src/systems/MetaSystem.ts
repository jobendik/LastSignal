import type { Game } from "../core/Game";
import type { DifficultyId, DroneType, MetaNode, TowerType } from "../core/Types";
import { metaNodes } from "../data/meta";

/**
 * Meta progression: permanent research points spent on unlocks.
 * Stored in the persisted profile so the player keeps progress between runs.
 */
export class MetaSystem {
  constructor(private readonly game: Game) {}

  get allNodes(): MetaNode[] {
    return metaNodes;
  }

  isUnlocked(id: string): boolean {
    return this.game.core.profile.unlockedNodes.includes(id);
  }

  canUnlock(node: MetaNode): { ok: boolean; reason?: string } {
    if (this.isUnlocked(node.id)) return { ok: false, reason: "Already unlocked" };
    if (this.game.core.profile.research < node.cost)
      return { ok: false, reason: "Not enough Research" };
    if (node.requires) {
      for (const r of node.requires) {
        if (!this.isUnlocked(r)) return { ok: false, reason: `Requires: ${r.replace(/_/g, " ")}` };
      }
    }
    return { ok: true };
  }

  unlock(id: string): boolean {
    const node = metaNodes.find((n) => n.id === id);
    if (!node) return false;
    const check = this.canUnlock(node);
    if (!check.ok) return false;
    this.game.core.profile.research -= node.cost;
    this.game.core.profile.unlockedNodes.push(id);
    this.game.persistence.saveProfile(this.game.core.profile);
    this.game.bus.emit("meta:unlocked", id);
    return true;
  }

  /** Total bonus to starting credits from unlocked meta nodes. */
  get startingCreditsBonus(): number {
    let bonus = 0;
    for (const n of metaNodes) {
      if (!this.isUnlocked(n.id)) continue;
      bonus += n.effect.startingCreditsAdd ?? 0;
    }
    return bonus;
  }

  get coreMaxBonus(): number {
    let bonus = 0;
    for (const n of metaNodes) {
      if (!this.isUnlocked(n.id)) continue;
      bonus += n.effect.coreMaxAdd ?? 0;
    }
    return bonus;
  }

  get towerDamageMul(): number {
    let mul = 1;
    for (const n of metaNodes) {
      if (!this.isUnlocked(n.id)) continue;
      if (n.effect.towerDamageMul) mul *= n.effect.towerDamageMul;
    }
    return mul;
  }

  get harvesterIncomeMul(): number {
    let mul = 1;
    for (const n of metaNodes) {
      if (!this.isUnlocked(n.id)) continue;
      if (n.effect.harvesterIncomeMul) mul *= n.effect.harvesterIncomeMul;
    }
    return mul;
  }

  get droneDamageAdd(): number {
    let a = 0;
    for (const n of metaNodes) {
      if (!this.isUnlocked(n.id)) continue;
      a += n.effect.droneDamageAdd ?? 0;
    }
    return a;
  }

  get sellRefundAdd(): number {
    let a = 0;
    for (const n of metaNodes) {
      if (!this.isUnlocked(n.id)) continue;
      a += n.effect.sellRefundAdd ?? 0;
    }
    return a;
  }

  get rewardChoiceExtra(): number {
    let a = 0;
    for (const n of metaNodes) {
      if (!this.isUnlocked(n.id)) continue;
      a += n.effect.rewardChoiceExtra ?? 0;
    }
    return a;
  }

  isTowerUnlocked(type: TowerType): boolean {
    // Check if any unlock node targets this tower AND is unlocked.
    const gatingNodes = metaNodes.filter((n) => n.effect.unlocksTower === type);
    if (gatingNodes.length === 0) return true; // default unlocked
    return gatingNodes.some((n) => this.isUnlocked(n.id));
  }

  isDroneUnlocked(type: DroneType): boolean {
    const gatingNodes = metaNodes.filter((n) => n.effect.unlocksDrone === type);
    if (gatingNodes.length === 0) return true;
    return gatingNodes.some((n) => this.isUnlocked(n.id));
  }

  isDifficultyUnlocked(id: DifficultyId): boolean {
    if (id !== "nightmare") return true;
    const gatingNodes = metaNodes.filter((n) => n.effect.unlocksDifficulty === id);
    return gatingNodes.some((n) => this.isUnlocked(n.id));
  }

  isEndlessUnlocked(): boolean {
    const gatingNodes = metaNodes.filter((n) => n.effect.unlocksEndless);
    return gatingNodes.some((n) => this.isUnlocked(n.id));
  }

  grantResearch(amount: number, reason = ""): void {
    if (amount <= 0) return;
    this.game.core.profile.research += amount;
    this.game.persistence.saveProfile(this.game.core.profile);
    this.game.bus.emit("meta:research", { amount, reason });
  }
}
