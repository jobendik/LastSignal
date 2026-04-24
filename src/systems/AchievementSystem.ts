import type { Game } from "../core/Game";
import { achievementDefinitions } from "../data/achievements";
import type { AchievementDefinition } from "../core/Types";

/** Tracks and unlocks achievements; grants research points; emits toast events. */
export class AchievementSystem {
  private combo = 0; // flamethrower combo tracker

  constructor(private readonly game: Game) {
    this.wire();
  }

  private wire(): void {
    const bus = this.game.bus;
    bus.on("enemy:killed", () => this.onKill());
    bus.on("wave:complete", () => this.check("first_wave"));
    bus.on("tower:built", () => this.checkTowerBaron());
    bus.on("tower:specialized", () => this.checkSpecialized());
    bus.on("drone:bought", () => this.checkDroneSwarm());
    bus.on("boss:killed", () => this.check("boss_killer"));
    bus.on("game:victory", () => this.onVictory());
    bus.on("endless:wave", (w: unknown) => this.onEndlessWave(Number(w)));
    bus.on("speed:changed", () => this.checkSpeedrunner());
  }

  get definitions(): AchievementDefinition[] {
    return achievementDefinitions;
  }

  has(id: string): boolean {
    return this.game.core.profile.achievementsUnlocked.includes(id);
  }

  private unlock(id: string): void {
    if (this.has(id)) return;
    const def = achievementDefinitions.find((a) => a.id === id);
    if (!def) return;
    this.game.core.profile.achievementsUnlocked.push(id);
    if (def.research) this.game.meta.grantResearch(def.research, `Achievement: ${def.name}`);
    this.game.persistence.saveProfile(this.game.core.profile);
    this.game.bus.emit("achievement:unlocked", def);
    this.game.audio.sfxAchievement();
  }

  check(id: string): void {
    if (!this.has(id)) this.unlock(id);
  }

  private onKill(): void {
    this.check("first_blood");
    this.combo++;
    if (this.combo >= 20) this.check("flamewaver");
    // Wealthy check
    if (this.game.core.stats.creditsEarned >= 2000) this.check("wealthy");
    // Codex completeness
    if (this.game.core.profile.codexSeen.length >= 14) this.check("codex_full");
  }

  private checkTowerBaron(): void {
    if (this.game.core.stats.towersBuilt >= 15) this.check("tower_baron");
    const harvesterCount = this.game.towers.list.filter((t) => t.type === "harvester").length;
    if (harvesterCount >= 5) this.check("harvester_tycoon");
  }

  private checkSpecialized(): void {
    if (this.game.core.stats.specsApplied >= 6) this.check("specialized");
  }

  private checkDroneSwarm(): void {
    if (this.game.drones.list.length >= 6) this.check("drone_swarm");
  }

  private checkSpeedrunner(): void {
    if (this.game.core.speed === 3) this.game.bus.emit("speed:max");
  }

  private onVictory(): void {
    // Sector clears + special checks
    const sector = this.game.core.sector;
    if (!sector) return;
    const idx = this.sectorIndex();
    if (idx === 1) this.check("first_sector");
    if (idx === 2) this.check("sector_2");
    if (idx === 3) this.check("sector_3");
    if (idx === 4) this.check("sector_4");
    if (idx === 5) this.check("sector_5");
    if (idx === 6) this.check("sector_6");

    if (this.game.core.stats.coreDamageTaken === 0) this.check("untouchable");
    if (this.game.drones.list.length === 0) this.check("no_drone_win");

    const diff = this.game.core.difficulty;
    if (diff === "veteran") this.check("veteran_clear");
    if (diff === "nightmare") this.check("nightmare_clear");
    if (this.game.core.speed === 3) this.check("speedrunner");
  }

  private onEndlessWave(wave: number): void {
    if (wave >= 10) this.check("endless_10");
    if (wave >= 25) this.check("endless_25");
  }

  resetCombo(): void {
    this.combo = 0;
  }

  private sectorIndex(): number {
    const s = this.game.core.sector;
    if (!s) return 0;
    const arr = ["sector_01_broken_relay", "sector_02_crystal_scar", "sector_03_phantom_gate", "sector_04_iron_bastion", "sector_05_mirror_expanse", "sector_06_the_abyss"];
    return arr.indexOf(s.id) + 1;
  }
}
