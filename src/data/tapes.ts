import { Config } from '../app/config';
import type { TapeDefinition } from '../core/Types';

/**
 * Three main tapes + one final tape. Each tape's procedural audio spec
 * encodes the puzzle digit derived from Config.puzzle.tapeDigits.
 */
export const TAPES: TapeDefinition[] = [
  {
    id: 'tape-a',
    title: 'A — Room Tone',
    label: 'A',
    duration: Config.audio.procTapeDurationSec,
    color: '#7c3b1e',
    hint: 'Noisy speech. Try a low-pass filter. Count the pulse groups.',
    spec: {
      kind: 'pulses',
      baseNoise: 0.7,
      seed: 0xA11CE1,
      pulseCount: Config.puzzle.tapeDigits.A,
    },
  },
  {
    id: 'tape-b',
    title: 'B — Reverse Log',
    label: 'B',
    duration: Config.audio.procTapeDurationSec,
    color: '#2a5aa8',
    hint: 'Speech was captured backwards. Try REVERSE playback.',
    spec: {
      kind: 'reversed',
      baseNoise: 0.5,
      seed: 0xB055E7,
      reversedDigit: Config.puzzle.tapeDigits.B,
    },
  },
  {
    id: 'tape-c',
    title: 'C — Carrier Signal',
    label: 'C',
    duration: Config.audio.procTapeDurationSec,
    color: '#3b8a56',
    hint: 'A hidden carrier hides at ≈ 2.4 kHz. Tune the band-pass filter.',
    spec: {
      kind: 'tones',
      baseNoise: 0.65,
      seed: 0xC0CA17,
      hiddenFrequencyHz: 2400,
    },
  },
];

export const FINAL_TAPE: TapeDefinition = {
  id: 'tape-final',
  title: '— UNMARKED —',
  label: '∞',
  duration: 18,
  color: '#1a1a1a',
  hint: 'No label. The reel is heavier.',
  spec: {
    kind: 'tones', // unused — generator makes a bespoke final tape
    baseNoise: 0.8,
    seed: 0xF11A1E, // "FIN ALE"
    hiddenFrequencyHz: 440,
  },
};

export const TAPE_BY_ID = new Map<string, TapeDefinition>(
  [...TAPES, FINAL_TAPE].map(t => [t.id, t])
);

/** Condition helpers used by the puzzle system. */
export const TAPE_C_BANDPASS_TARGET_HZ = 2400;
export const TAPE_C_BANDPASS_TOLERANCE_HZ = 220; // ± band
export const TAPE_A_LOWPASS_TARGET_HZ = 900;     // lowpass below this reveals pulses
