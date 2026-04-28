import type { GameSettings, PersistedProfile } from "../core/Types";

const SETTINGS_KEY = "last_signal:settings";
const PROFILE_KEY = "last_signal:profile";
const RUN_KEY = "last_signal:run_snapshot";
const REPLAY_KEY = "last_signal:latest_replay";

export const defaultSettings: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.25,
  sfxVolume: 0.7,
  uiVolume: 0.7,
  muted: false,
  screenShake: true,
  reducedMotion: false,
  reducedFlashing: false,
  showDamageNumbers: true,
  subtitles: false,
  mouseButtonSwap: false,
  colorblind: false,
  highContrast: false,
  fontScale: 1,
  graphicsQuality: "high",
  keyBindings: {
    build1: "Digit1",
    build2: "Digit2",
    build3: "Digit3",
    build4: "Digit4",
    build5: "Digit5",
    build6: "Digit6",
    build7: "Digit7",
    build8: "Digit8",
    build9: "Digit9",
    build10: "Digit0",
    upgrade: "KeyU",
    sell: "KeyS",
    pause: "KeyP",
    start: "Space",
    speedUp: "Equal",
    speedDown: "Minus",
    drone: "KeyD",
    killZone: "KeyK",
    tacticalPause: "KeyT",
    wavePreview: "Tab",
  },
  gamepadEnabled: true,
};

export const defaultProfile: PersistedProfile = {
  bestSectorCleared: 0,
  bestWaveReached: 0,
  bestCoreRemaining: 0,
  codexSeen: [],
  researchPoints: 0,
  researchUnlocked: [],
  achievementsUnlocked: [],
  endlessBestWave: 0,
  lastDifficulty: "standard",
  runHistory: [],
  prestigeLevel: 0,
  prestigeMultiplier: 1,
  dailyBestScore: 0,
  dailyBestDate: "",
  commanderBriefingSeen: false,
};

export class PersistenceSystem {
  loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...defaultSettings };
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return {
        ...defaultSettings,
        ...parsed,
        keyBindings: { ...defaultSettings.keyBindings, ...(parsed.keyBindings ?? {}) },
      };
    } catch {
      return { ...defaultSettings };
    }
  }

  saveSettings(s: GameSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      /* ignore — private mode, etc. */
    }
  }

  loadProfile(): PersistedProfile {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return this.emptyProfile();
      const parsed = JSON.parse(raw) as Partial<PersistedProfile>;
      return {
        ...defaultProfile,
        ...parsed,
        codexSeen: parsed.codexSeen ?? [],
        researchUnlocked: parsed.researchUnlocked ?? [],
        achievementsUnlocked: parsed.achievementsUnlocked ?? [],
        runHistory: (parsed.runHistory ?? []).slice(0, 12),
        prestigeLevel: parsed.prestigeLevel ?? 0,
        prestigeMultiplier: parsed.prestigeMultiplier ?? 1,
        dailyBestScore: parsed.dailyBestScore ?? 0,
        dailyBestDate: parsed.dailyBestDate ?? "",
        commanderBriefingSeen: parsed.commanderBriefingSeen ?? false,
      };
    } catch {
      return this.emptyProfile();
    }
  }

  saveProfile(p: PersistedProfile): void {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }

  saveRunSnapshot(snapshot: unknown): void {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(snapshot));
    } catch {
      /* ignore */
    }
  }

  loadRunSnapshot<T = unknown>(): T | null {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      return raw ? JSON.parse(raw) as T : null;
    } catch {
      return null;
    }
  }

  saveReplay(events: unknown[]): void {
    try {
      localStorage.setItem(REPLAY_KEY, JSON.stringify(events.slice(-1200)));
    } catch {
      /* ignore */
    }
  }

  private emptyProfile(): PersistedProfile {
    return {
      ...defaultProfile,
      codexSeen: [],
      researchUnlocked: [],
      achievementsUnlocked: [],
      runHistory: [],
      prestigeLevel: 0,
      prestigeMultiplier: 1,
      dailyBestScore: 0,
      dailyBestDate: "",
      commanderBriefingSeen: false,
    };
  }
}
