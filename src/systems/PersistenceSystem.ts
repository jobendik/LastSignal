import type { GameSettings, PersistedProfile } from "../core/Types";

const SETTINGS_KEY = "last_signal:settings";
const PROFILE_KEY = "last_signal:profile";

export const defaultSettings: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.25,
  sfxVolume: 0.7,
  muted: false,
  screenShake: true,
  reducedFlashing: false,
  showDamageNumbers: true,
  colorblind: false,
  crtEffect: true,
  autoStartWave: false,
  planningCountdown: 25,
  showTutorial: true,
};

export const defaultProfile: PersistedProfile = {
  bestSectorCleared: 0,
  bestWaveReached: 0,
  bestCoreRemaining: 0,
  codexSeen: [],
  research: 0,
  unlockedNodes: [],
  achievementsUnlocked: [],
  endlessBestWave: {},
  totalRuns: 0,
  totalVictories: 0,
  tutorialSeen: false,
  preferredDifficulty: "operative",
};

export class PersistenceSystem {
  loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...defaultSettings };
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return { ...defaultSettings, ...parsed };
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
      if (!raw) return { ...defaultProfile, codexSeen: [], unlockedNodes: [], achievementsUnlocked: [], endlessBestWave: {} };
      const parsed = JSON.parse(raw) as Partial<PersistedProfile>;
      return {
        ...defaultProfile,
        ...parsed,
        codexSeen: parsed.codexSeen ?? [],
        unlockedNodes: parsed.unlockedNodes ?? [],
        achievementsUnlocked: parsed.achievementsUnlocked ?? [],
        endlessBestWave: parsed.endlessBestWave ?? {},
      };
    } catch {
      return { ...defaultProfile, codexSeen: [], unlockedNodes: [], achievementsUnlocked: [], endlessBestWave: {} };
    }
  }

  saveProfile(p: PersistedProfile): void {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }

  wipeProfile(): void {
    try {
      localStorage.removeItem(PROFILE_KEY);
    } catch {
      /* ignore */
    }
  }
}
