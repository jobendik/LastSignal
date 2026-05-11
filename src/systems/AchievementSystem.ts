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
  private flawlessStreak = 0;
  private killsThisRun = 0;
  private relayCoresThisRun = 0;
  private squadTypesDeployed = new Set<string>();
  private lastBossType = "";

  constructor(private readonly game: Game) {
    this.bind();
  }

  private bind(): void {
    const bus = this.game.bus;

    // ── first-time milestones ──────────────────────
    bus.on("enemy:killed", (ev: unknown) => {
      const e = ev as { type: string; isBoss?: boolean };
      this.unlock("first_blood");

      // Boss-specific achievements – track most recent boss type.
      if (e.isBoss) this.lastBossType = e.type;

      // Per-run kill counter.
      this.killsThisRun++;
      if (this.killsThisRun >= 100) this.unlock("kill_100");
      if (this.killsThisRun >= 500) this.unlock("kill_500");
    });

    bus.on("boss:killed", () => {
      this.unlock("boss_down");
      if (this.lastBossType === "leviathan") this.unlock("kill_leviathan");
      if (this.lastBossType === "harbinger") this.unlock("kill_harbinger");
    });

    bus.on("game:victory", () => {
      this.unlock("sector_cleared");
      // Difficulty-based clears.
      if (this.game.difficulty.current === "veteran") this.unlock("veteran_clear");
      if (this.game.difficulty.current === "nightmare") this.unlock("nightmare_clear");
      // Sector-specific clears.
      const sectorId = this.game.core.sector?.id ?? "";
      if (sectorId === "sector_void") this.unlock("void_cleared");
      if (sectorId === "sector_06_fractured_expanse") this.unlock("sector_6_cleared");
      if (sectorId === "sector_07_blackout_array") this.unlock("sector_7_cleared");
      // All 4 main campaign sectors cleared.
      if (this.game.core.profile.bestSectorCleared >= 4) this.unlock("all_sectors_cleared");
    });

    bus.on("tower:specialized", () => this.unlock("first_specialization"));

    bus.on("core:relayBuilt", () => {
      this.unlock("first_relay");
      this.relayCoresThisRun++;
      if (this.relayCoresThisRun >= 3) this.unlock("relay_network");
    });

    bus.on("squad:deployed", (ev: unknown) => {
      const e = ev as { type: string };
      this.unlock("first_squad");
      this.squadTypesDeployed.add(e.type);
      if (this.squadTypesDeployed.size >= 4) this.unlock("all_squads");
    });

    bus.on("strategic:captured", () => this.unlock("first_capture"));

    bus.on("strategic:destroyed", (ev: unknown) => {
      const e = ev as { type: string };
      if (e.type === "rift_anchor") this.unlock("destroy_rift");
    });

    // ── wave / combat ─────────────────────────────
    bus.on("wave:started", () => {
      this.flawlessArm = true;
    });

    bus.on("core:damaged", () => {
      this.flawlessArm = false;
      this.flawlessStreak = 0;
    });

    bus.on("wave:complete", () => {
      if (this.flawlessArm) {
        this.unlock("flawless_wave");
        this.flawlessStreak++;
        if (this.flawlessStreak >= 5) this.unlock("flawless_5");
      }
    });

    // ── economy & construction ────────────────────
    bus.on("sector:started", () => {
      this.towerTypesBuilt.clear();
      this.creditsThisRun = 0;
      this.killsThisRun = 0;
      this.relayCoresThisRun = 0;
      this.squadTypesDeployed.clear();
      this.flawlessStreak = 0;
      this.lastBossType = "";
    });

    bus.on<{ amount: number }>("credits:earned", (ev) => {
      this.creditsThisRun += ev.amount;
      if (this.creditsThisRun >= 1000) this.unlock("economy_king");
    });

    // Fix: listen on tower:built (the event that is actually emitted),
    // not the never-emitted tower:builtType.
    bus.on("tower:built", (ev: unknown) => {
      const t = ev as { type: string };
      this.towerTypesBuilt.add(t.type);
      if (this.towerTypesBuilt.size >= 5) this.unlock("tower_collector");
      // 13 tower types in the game; require all to be built in one run.
      if (this.towerTypesBuilt.size >= 13) this.unlock("build_all_towers");
    });

    // ── advanced command ──────────────────────────
    bus.on("command:tierUp", (ev: unknown) => {
      const e = ev as { tier: number };
      if (e.tier >= 3) this.unlock("command_tier_3");
    });

    // ── endless mode ──────────────────────────────
    bus.on<{ wave: number }>("endless:wave", (ev) => {
      if (ev.wave >= 10) this.unlock("endless_10");
      if (ev.wave >= 25) this.unlock("endless_25");
      if (ev.wave >= 50) this.unlock("endless_50");
    });

    // ── meta-progression ──────────────────────────
    bus.on("meta:prestige", () => this.unlock("prestige_1"));
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
