import type { ObjectiveId } from '../core/Types';

/**
 * Objective strings shown to the player. Kept in one place so copy can be
 * tuned without touching game logic.
 */
export const OBJECTIVES: Record<ObjectiveId, string> = {
  'start':           'Inspect the desk. Read what you can.',
  'find-tapes':      'Find the cassette tapes. Insert them into the deck.',
  'decode-pulses':   'Tape A: low-pass the noise, count the pulse groups.',
  'decode-reversed': 'Tape B: play in reverse. A number is spoken.',
  'decode-tones':    'Tape C: isolate the carrier near 2.4 kHz with the band-pass filter.',
  'enter-code':      'Enter the three-digit code on the drawer keypad (A–B–C).',
  'play-final':      'Play the unmarked cassette recovered from the drawer.',
  'ending':          'Listen.',
};
