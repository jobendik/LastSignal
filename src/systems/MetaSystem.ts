import type { Game } from "../core/Game";
import { researchNodes } from "../data/research";
import type { ResearchNode } from "../core/Types";

export interface ResearchAggregate {
  startingCreditsAdd: number;
  coreIntegrityAdd: number;
  towerDamageMul: number;
  towerRangeAdd: number;
  harvesterIncomeMul: number;
  rewardMul: number;
  unlockedTowers: string[];
  hasEndless: boolean;
}

/** Meta progression / research tree. Research points persist across runs. */
export class MetaSystem {
  constructor(private readonly game: Game) {}

  get nodes(): ResearchNode[] {
    return researchNodes;
  }

  isUnlocked(id: string): boolean {
    return this.game.core.profile.researchUnlocked.includes(id);
  }

  canPurchase(node: ResearchNode): boolean {
    if (this.isUnlocked(node.id)) return false;
    if (this.game.core.profile.researchPoints < node.cost) return false;
    for (const req of node.requires ?? []) {
      if (!this.isUnlocked(req)) return false;
    }
    return true;
  }

  purchase(nodeId: string): boolean {
    const node = researchNodes.find((n) => n.id === nodeId);
    if (!node || !this.canPurchase(node)) return false;
    this.game.core.profile.researchPoints -= node.cost;
    this.game.core.profile.researchUnlocked.push(node.id);
    this.game.persistence.saveProfile(this.game.core.profile);
    this.game.bus.emit("meta:unlocked", node);
    return true;
  }

  addResearchPoints(amount: number): void {
    if (amount <= 0) return;
    const mul = this.game.difficulty.def.researchMul * this.game.core.profile.prestigeMultiplier;
    const gain = Math.max(1, Math.round(amount * mul));
    this.game.core.profile.researchPoints += gain;
    this.game.persistence.saveProfile(this.game.core.profile);
    this.game.bus.emit("meta:points", gain);
  }

  canPrestige(): boolean {
    return this.game.core.profile.bestSectorCleared >= 4 && this.game.core.profile.researchUnlocked.length >= researchNodes.length;
  }

  prestige(): boolean {
    if (!this.canPrestige()) return false;
    const p = this.game.core.profile;
    p.prestigeLevel += 1;
    p.prestigeMultiplier = 1 + p.prestigeLevel * 0.12;
    p.researchUnlocked = [];
    p.researchPoints = 0;
    this.game.persistence.saveProfile(p);
    this.game.bus.emit("meta:points", 0);
    this.game.bus.emit("meta:prestige", p.prestigeLevel);
    return true;
  }

  /** Aggregate effect of all purchased research for this run. */
  aggregate(): ResearchAggregate {
    const out: ResearchAggregate = {
      startingCreditsAdd: 0,
      coreIntegrityAdd: 0,
      towerDamageMul: 1,
      towerRangeAdd: 0,
      harvesterIncomeMul: 1,
      rewardMul: 1,
      unlockedTowers: [],
      hasEndless: false,
    };
    for (const id of this.game.core.profile.researchUnlocked) {
      const node = researchNodes.find((n) => n.id === id);
      if (!node) continue;
      const e = node.effect;
      if (e.startingCreditsAdd) out.startingCreditsAdd += e.startingCreditsAdd;
      if (e.coreIntegrityAdd) out.coreIntegrityAdd += e.coreIntegrityAdd;
      if (e.towerDamageMul) out.towerDamageMul *= e.towerDamageMul;
      if (e.towerRangeAdd) out.towerRangeAdd += e.towerRangeAdd;
      if (e.harvesterIncomeMul) out.harvesterIncomeMul *= e.harvesterIncomeMul;
      if (e.rewardMul) out.rewardMul *= e.rewardMul;
      if (e.unlocksTower) out.unlockedTowers.push(e.unlocksTower);
      if (e.unlocksMode === "endless") out.hasEndless = true;
    }
    return out;
  }
}
