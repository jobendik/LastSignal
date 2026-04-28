import { Logger } from '../core/Logger';
import { Config } from '../app/config';

/**
 * LocalStorage-backed save system.
 *
 * Save data is intentionally *small and transparent* — a plain JSON document —
 * so that corruption recovery is trivial and so that a future real game could
 * upgrade across versions with a simple migration step.
 */

export interface SaveState {
  version: number;
  createdAt: number;
  updatedAt: number;

  objective: string;
  discoveredClues: string[];
  readDocuments: string[];
  insertedTape: string | null;
  tapePositions: Record<string, number>;
  puzzleSteps: string[];
  drawerUnlocked: boolean;
  endingStarted: boolean;
  endingComplete: boolean;
}

export interface Settings {
  master: number;
  sfx: number;
  music: number;
  reducedMotion: boolean;
}

const emptySave = (): SaveState => ({
  version: Config.app.saveVersion,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  objective: 'start',
  discoveredClues: [],
  readDocuments: [],
  insertedTape: null,
  tapePositions: {},
  puzzleSteps: [],
  drawerUnlocked: false,
  endingStarted: false,
  endingComplete: false,
});

const defaultSettings = (): Settings => ({
  master: Config.audio.masterStartVolume,
  sfx:    Config.audio.sfxStartVolume,
  music:  Config.audio.musicStartVolume,
  reducedMotion: false,
});

function safeGet(key: string): string | null {
  try { return window.localStorage.getItem(key); }
  catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); }
  catch (err) { Logger.warn('SaveSystem', 'localStorage unavailable', err); }
}
function safeRemove(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

export class SaveSystem {
  load(): SaveState | null {
    const raw = safeGet(Config.app.saveKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SaveState;
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.version !== Config.app.saveVersion) {
        Logger.warn('SaveSystem', `ignoring save of unknown version ${parsed.version}`);
        return null;
      }
      // Normalize shape defensively so new fields don't crash old saves.
      const merged: SaveState = { ...emptySave(), ...parsed };
      merged.discoveredClues = Array.isArray(parsed.discoveredClues) ? parsed.discoveredClues : [];
      merged.readDocuments   = Array.isArray(parsed.readDocuments)   ? parsed.readDocuments   : [];
      merged.puzzleSteps     = Array.isArray(parsed.puzzleSteps)     ? parsed.puzzleSteps     : [];
      merged.tapePositions   = (parsed.tapePositions && typeof parsed.tapePositions === 'object')
        ? parsed.tapePositions : {};
      return merged;
    } catch (err) {
      Logger.warn('SaveSystem', 'corrupt save data, ignoring', err);
      return null;
    }
  }

  save(state: SaveState): void {
    const snapshot: SaveState = { ...state, updatedAt: Date.now(), version: Config.app.saveVersion };
    safeSet(Config.app.saveKey, JSON.stringify(snapshot));
  }

  reset(): SaveState {
    safeRemove(Config.app.saveKey);
    return emptySave();
  }

  empty = emptySave;

  // Settings are stored separately so they persist across resets.
  loadSettings(): Settings {
    const raw = safeGet(Config.app.settingsKey);
    if (!raw) return defaultSettings();
    try {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...defaultSettings(), ...parsed };
    } catch { return defaultSettings(); }
  }

  saveSettings(settings: Settings): void {
    safeSet(Config.app.settingsKey, JSON.stringify(settings));
  }
}
