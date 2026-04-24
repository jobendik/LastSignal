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
};

export const defaultProfile: PersistedProfile = {
  bestSectorCleared: 0,
  bestWaveReached: 0,
  bestCoreRemaining: 0,
  codexSeen: [],
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
      if (!raw) return { ...defaultProfile, codexSeen: [] };
      const parsed = JSON.parse(raw) as Partial<PersistedProfile>;
      return { ...defaultProfile, ...parsed, codexSeen: parsed.codexSeen ?? [] };
    } catch {
      return { ...defaultProfile, codexSeen: [] };
    }
  }

  saveProfile(p: PersistedProfile): void {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }
}
