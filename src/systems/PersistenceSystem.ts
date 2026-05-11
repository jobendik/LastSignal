import type { GameSettings, PersistedProfile } from "../core/Types";

const SETTINGS_KEY = "last_signal:settings";
const PROFILE_KEY = "last_signal:profile";
const RUN_KEY = "last_signal:run_snapshot";
const REPLAY_KEY = "last_signal:latest_replay";
const SDK_SYNC_TIMEOUT_MS = 5000;

interface CloudSavePort {
  init(): Promise<void>;
  loadRemote(): Promise<PersistedProfile | null>;
  saveRemote(profile: PersistedProfile): Promise<void>;
  merge(local: PersistedProfile, remote: PersistedProfile | null): PersistedProfile;
}

interface SaveProfileOptions {
  touch?: boolean;
  remote?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isPalette(value: unknown): value is GameSettings["palette"] {
  return (
    value === "default" ||
    value === "deuteranopia" ||
    value === "protanopia" ||
    value === "highContrast"
  );
}

export const defaultSettings: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.25,
  sfxVolume: 0.7,
  uiVolume: 0.7,
  muted: false,
  screenShake: true,
  reduceMotion: false,
  reducedMotion: false,
  reducedFlashing: false,
  showDamageNumbers: true,
  subtitles: false,
  mouseButtonSwap: false,
  colorblind: false,
  highContrast: false,
  fontScale: 1,
  palette: "default",
  uiScale: 1,
  keyboardNav: true,
  graphicsQuality: "high",
  // Per-effect VFX toggles. Default to the "high" preset (everything on).
  vfxScanlines: true,
  vfxVignette: true,
  vfxPhosphor: true,
  vfxFilmGrain: true,
  vfxChromaticAberration: true,
  vfxBarrelDistortion: true,
  vfxBloom: true,
  vfxFlicker: true,
  vfxParticleDensity: 1,
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
  guidanceSeen: [],
  tutorialHintsEnabled: true,
  contextualHintsEnabled: true,
  trainingCompleted: false,
  trainingStagesCompleted: 0,
  lastPlayedAt: 0,
};

export function hydrateProfile(value: unknown): PersistedProfile {
  const parsed = value && typeof value === "object"
    ? value as Partial<PersistedProfile>
    : {};

  return {
    ...defaultProfile,
    ...parsed,
    codexSeen: Array.isArray(parsed.codexSeen) ? parsed.codexSeen : [],
    researchUnlocked: Array.isArray(parsed.researchUnlocked) ? parsed.researchUnlocked : [],
    achievementsUnlocked: Array.isArray(parsed.achievementsUnlocked) ? parsed.achievementsUnlocked : [],
    runHistory: Array.isArray(parsed.runHistory) ? parsed.runHistory.slice(0, 12) : [],
    prestigeLevel: parsed.prestigeLevel ?? 0,
    prestigeMultiplier: parsed.prestigeMultiplier ?? 1,
    dailyBestScore: parsed.dailyBestScore ?? 0,
    dailyBestDate: parsed.dailyBestDate ?? "",
    commanderBriefingSeen: parsed.commanderBriefingSeen ?? false,
    guidanceSeen: Array.isArray(parsed.guidanceSeen) ? parsed.guidanceSeen : [],
    tutorialHintsEnabled: parsed.tutorialHintsEnabled ?? true,
    contextualHintsEnabled: parsed.contextualHintsEnabled ?? true,
    trainingCompleted: parsed.trainingCompleted ?? false,
    trainingStagesCompleted: parsed.trainingStagesCompleted ?? 0,
    lastPlayedAt: typeof parsed.lastPlayedAt === "number" && Number.isFinite(parsed.lastPlayedAt)
      ? parsed.lastPlayedAt
      : 0,
  };
}

export class PersistenceSystem {
  constructor(private readonly cloudSave: CloudSavePort | null = null) {}

  loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...defaultSettings };
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      const merged = {
        ...defaultSettings,
        ...parsed,
        keyBindings: { ...defaultSettings.keyBindings, ...(parsed.keyBindings ?? {}) },
      };
      const reduceMotion = parsed.reduceMotion ?? parsed.reducedMotion ?? defaultSettings.reduceMotion;
      const palette = isPalette(merged.palette) ? merged.palette : defaultSettings.palette;
      const uiScale = typeof merged.uiScale === "number" && Number.isFinite(merged.uiScale)
        ? clamp(merged.uiScale, 0.8, 1.4)
        : defaultSettings.uiScale;
      return {
        ...merged,
        reduceMotion,
        reducedMotion: reduceMotion,
        palette,
        uiScale,
        keyboardNav: merged.keyboardNav !== false,
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
      return hydrateProfile(JSON.parse(raw));
    } catch {
      return this.emptyProfile();
    }
  }

  async loadProfileAtStartup(sdkReady?: Promise<unknown>): Promise<PersistedProfile> {
    const local = this.loadProfile();
    if (!this.cloudSave) return local;

    await this.waitForSdk(sdkReady);

    try {
      await this.cloudSave.init();
      const remote = await this.cloudSave.loadRemote();
      const merged = this.cloudSave.merge(local, remote);
      this.saveProfile(merged, { touch: false, remote: false });
      void this.cloudSave.saveRemote(merged);
      return merged;
    } catch {
      return local;
    }
  }

  saveProfile(p: PersistedProfile, options: SaveProfileOptions = {}): void {
    if (options.touch !== false) {
      p.lastPlayedAt = Date.now();
    } else if (typeof p.lastPlayedAt !== "number" || !Number.isFinite(p.lastPlayedAt)) {
      p.lastPlayedAt = 0;
    }
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
    if (options.remote !== false) {
      void this.cloudSave?.saveRemote(p);
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
      guidanceSeen: [],
      tutorialHintsEnabled: true,
      contextualHintsEnabled: true,
      trainingCompleted: false,
      trainingStagesCompleted: 0,
      lastPlayedAt: 0,
    };
  }

  private async waitForSdk(sdkReady?: Promise<unknown>): Promise<void> {
    if (!sdkReady) return;
    await Promise.race([
      sdkReady.catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, SDK_SYNC_TIMEOUT_MS)),
    ]);
  }
}
