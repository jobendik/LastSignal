import type { Game } from "../core/Game";

export interface TutorialHint {
  id: string;
  text: string;
  /** Condition to trigger this hint. */
  shouldShow: (g: Game) => boolean;
}

/** Lightweight first-time player hints. Show once per profile. */
export class TutorialSystem {
  private shown = new Set<string>();
  private pending: TutorialHint | null = null;
  private timer = 0;

  hints: TutorialHint[] = [
    {
      id: "welcome",
      text: "Protect the Core. Hover the grid and click 1-9 to select towers, then click a tile to build.",
      shouldShow: (g) => g.state === "PLANNING" && g.core.waveIndex === 0,
    },
    {
      id: "start_wave",
      text: "Press SPACE or click START WAVE when you're ready. Starting early earns bonus credits.",
      shouldShow: (g) => g.state === "PLANNING" && g.core.waveIndex === 0 && g.towers.list.length > 0,
    },
    {
      id: "harvester",
      text: "Build Harvesters on crystals to generate credits during waves. Economy scales your run.",
      shouldShow: (g) => g.state === "PLANNING" && g.core.waveIndex === 1,
    },
    {
      id: "upgrade",
      text: "Click a tower to select it, then UPGRADE (U) to level it up. Level 3 unlocks specializations.",
      shouldShow: (g) => g.state === "PLANNING" && g.core.waveIndex === 2,
    },
    {
      id: "codex",
      text: "The CODEX reveals threat profiles. Learn counters before the wave hits.",
      shouldShow: (g) => g.state === "PLANNING" && g.core.waveIndex === 3,
    },
  ];

  constructor(private readonly game: Game) {
    const seen = this.game.core.profile.tutorialSeen;
    if (seen) {
      for (const h of this.hints) this.shown.add(h.id);
    }
  }

  reset(): void {
    this.pending = null;
    this.timer = 0;
  }

  update(dt: number): void {
    if (!this.game.core.settings.showTutorial) return;
    if (this.pending) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.dismiss();
      }
      return;
    }
    for (const h of this.hints) {
      if (this.shown.has(h.id)) continue;
      if (h.shouldShow(this.game)) {
        this.pending = h;
        this.timer = 8;
        this.shown.add(h.id);
        this.game.bus.emit("tutorial:hint", h);
        return;
      }
    }
    // Mark tutorial as fully seen once all are shown
    if (this.shown.size >= this.hints.length && !this.game.core.profile.tutorialSeen) {
      this.game.core.profile.tutorialSeen = true;
      this.game.persistence.saveProfile(this.game.core.profile);
    }
  }

  dismiss(): void {
    this.pending = null;
    this.timer = 0;
    this.game.bus.emit("tutorial:dismiss");
  }

  get currentHint(): TutorialHint | null {
    return this.pending;
  }

  forceShow(id: string): void {
    const h = this.hints.find((x) => x.id === id);
    if (!h) return;
    this.pending = h;
    this.timer = 8;
    this.game.bus.emit("tutorial:hint", h);
  }
}
