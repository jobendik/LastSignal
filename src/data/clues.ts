import type { ClueData } from '../core/Types';
import { Config } from '../app/config';

/**
 * All clues the player can discover. A clue is a *named fact* that is
 * surfaced in the notebook. The puzzle system checks clue presence to
 * advance objectives.
 */
export const CLUES: ClueData[] = [
  // Document clues
  { id: 'clue-field-log',    title: 'The operator left unfinished notes',
    description: 'Operator Bek references three tapes (A/B/C) and a bench processor.',
    source: 'Field Log' },
  { id: 'clue-maintenance',  title: 'Maintenance card decoded',
    description: 'A=count pulses (low-pass), B=reverse + pitch, C=tune band-pass near 2.4 kHz.',
    source: 'Maintenance Card' },
  { id: 'clue-torn-memo',    title: 'Drawer accepts A-B-C order',
    description: 'Combination is the digit from Tape A, then B, then C, entered on the drawer keypad.',
    source: 'Torn Memo' },

  // Audio-puzzle clues
  { id: 'clue-tape-a-digit', title: 'Tape A — pulse count',
    description: `Using low-pass filter below 1 kHz reveals ${Config.puzzle.tapeDigits.A} distinct low pulse groups. First digit: ${Config.puzzle.tapeDigits.A}.`,
    source: 'Tape A (pulses)' },
  { id: 'clue-tape-b-digit', title: 'Tape B — spoken number',
    description: `When played in reverse, the recovered number resolves to ${Config.puzzle.tapeDigits.B}. Second digit: ${Config.puzzle.tapeDigits.B}.`,
    source: 'Tape B (reversed)' },
  { id: 'clue-tape-c-digit', title: 'Tape C — isolated carrier',
    description: `Band-pass lock near ~2.4 kHz reveals the carrier identity as ${Config.puzzle.tapeDigits.C}. Third digit: ${Config.puzzle.tapeDigits.C}.`,
    source: 'Tape C (carrier)' },

  { id: 'clue-drawer-unlocked', title: 'Drawer unlocked',
    description: 'The lockbox inside the drawer contained a single unmarked cassette.',
    source: 'Drawer' },
  { id: 'clue-final-tape',      title: 'The unmarked tape',
    description: 'A final tape recovered from the drawer. Something about it feels off.',
    source: 'Drawer' },
];

export const CLUE_BY_ID = new Map<string, ClueData>(CLUES.map(c => [c.id, c]));
