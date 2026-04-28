import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveSystem } from '../engine/SaveSystem';
import { Config } from '../app/config';

// Minimal localStorage shim for node-env tests.
function mockLocalStorage(): void {
  const store = new Map<string, string>();
  const impl = {
    getItem:    (k: string): string | null => store.has(k) ? store.get(k)! : null,
    setItem:    (k: string, v: string): void => { store.set(k, v); },
    removeItem: (k: string): void => { store.delete(k); },
    clear:      (): void => { store.clear(); },
    key:        (i: number): string | null => Array.from(store.keys())[i] ?? null,
    get length(): number { return store.size; },
  };
  vi.stubGlobal('window', { localStorage: impl });
  vi.stubGlobal('localStorage', impl);
}

describe('SaveSystem', () => {
  beforeEach(() => { mockLocalStorage(); });

  it('returns null when no save exists', () => {
    const s = new SaveSystem();
    expect(s.load()).toBeNull();
  });

  it('save/load round-trips', () => {
    const s = new SaveSystem();
    const state = s.empty();
    state.discoveredClues = ['a', 'b'];
    state.drawerUnlocked = true;
    s.save(state);
    const restored = s.load();
    expect(restored).not.toBeNull();
    expect(restored!.discoveredClues).toEqual(['a', 'b']);
    expect(restored!.drawerUnlocked).toBe(true);
  });

  it('ignores saves with a different version', () => {
    const s = new SaveSystem();
    const state = s.empty();
    state.version = Config.app.saveVersion + 99;
    // Need to bypass the auto-version-overwrite in save(): write directly.
    window.localStorage.setItem(Config.app.saveKey, JSON.stringify(state));
    // Artificially downgrade: save() overwrites version, so write a raw JSON
    // with mismatched version:
    const bad = { ...s.empty(), version: Config.app.saveVersion + 99 };
    window.localStorage.setItem(Config.app.saveKey, JSON.stringify(bad));
    expect(s.load()).toBeNull();
  });

  it('gracefully handles corrupt JSON', () => {
    window.localStorage.setItem(Config.app.saveKey, '{not json');
    const s = new SaveSystem();
    expect(s.load()).toBeNull();
  });

  it('reset() clears the save', () => {
    const s = new SaveSystem();
    s.save(s.empty());
    expect(s.load()).not.toBeNull();
    s.reset();
    expect(s.load()).toBeNull();
  });

  it('settings persist separately from save', () => {
    const s = new SaveSystem();
    s.saveSettings({ master: 0.4, sfx: 0.3, music: 0.2, reducedMotion: true });
    s.reset();
    const settings = s.loadSettings();
    expect(settings.master).toBe(0.4);
    expect(settings.reducedMotion).toBe(true);
  });
});
