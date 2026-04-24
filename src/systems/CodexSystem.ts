import type { Game } from "../core/Game";
import { codexEntries } from "../data/codex";
import type { CodexEntry, EnemyType } from "../core/Types";

export class CodexSystem {
  private seen = new Set<EnemyType>();
  private pendingAlert: EnemyType | null = null;
  private alertTimer = 0;

  constructor(private readonly game: Game) {
    for (const id of this.game.core.profile.codexSeen) this.seen.add(id);
  }

  reset(): void {
    this.pendingAlert = null;
    this.alertTimer = 0;
  }

  has(id: EnemyType): boolean {
    return this.seen.has(id);
  }

  get allSeen(): EnemyType[] {
    return [...this.seen];
  }

  entry(id: EnemyType): CodexEntry {
    return codexEntries[id];
  }

  /** Called by EnemySystem when an enemy is spawned. Shows a threat alert on first encounter. */
  onEncounter(id: EnemyType): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.pendingAlert = id;
    this.alertTimer = 4;
    this.game.bus.emit<EnemyType>("codex:new", id);

    // Persist across runs.
    const profile = this.game.core.profile;
    if (!profile.codexSeen.includes(id)) {
      profile.codexSeen.push(id);
      this.game.persistence.saveProfile(profile);
    }
  }

  update(dt: number): void {
    if (this.alertTimer > 0) {
      this.alertTimer -= dt;
      if (this.alertTimer <= 0) {
        this.pendingAlert = null;
        this.game.bus.emit("codex:alertDismissed");
      }
    }
  }

  get currentAlert(): EnemyType | null {
    return this.pendingAlert;
  }
}
