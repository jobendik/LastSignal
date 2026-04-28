/**
 * Central configuration — tuning numbers that designers/engineers would tweak.
 * Avoids magic numbers scattered across the codebase.
 */
export const Config = {
  app: {
    title: 'Signal Room',
    version: '0.1.1',
    saveVersion: 1,
    saveKey: 'signalroom.save.v1',
    settingsKey: 'signalroom.settings.v1',
  },

  renderer: {
    pixelRatioMax: 2,
    fov: 48,
    near: 0.05,
    far: 60,
    clearColor: 0x05080a,
  },

  camera: {
    // Overview pose — looking at the desk
    overview: {
      position: [0, 1.55, 1.7] as const,
      lookAt:   [0, 0.92, 0.2] as const,
    },
    // Smooth focus transition duration
    focusDurationSec: 0.9,
    // Idle sway (breathing)
    idleSwayAmp: 0.004,
    idleSwaySpeed: 0.35,
  },

  interaction: {
    hoverOutlineColor: 0x58c5d4,
    focusOutlineColor: 0x3be08a,
    maxRayDistance: 6,
  },

  audio: {
    sampleRate: 44100,
    procTapeDurationSec: 28, // per-tape procedural duration
    masterStartVolume: 0.7,
    sfxStartVolume: 0.8,
    musicStartVolume: 0.55,
  },

  puzzle: {
    /** The final 3-digit code. Derived from the three tape digits below. */
    code: '472',
    tapeDigits: { A: 4, B: 7, C: 2 },
  },
} as const;

export type AppConfig = typeof Config;
