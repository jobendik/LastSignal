import type { DocumentData } from '../core/Types';

/**
 * The readable documents available in the scene. Each one either guides the
 * player through the audio puzzle or sets tone. They are intentionally terse.
 */
export const DOCUMENTS: DocumentData[] = [
  {
    id: 'doc-field-log',
    title: 'Field Log — Station 7',
    meta: 'Operator Bek • 14/03',
    stamp: 'Archive',
    body:
`Arrived at the station at 21:40. Power nominal but the compressor on the
east wall is cycling every 11 minutes. Air feels old.

Found three tapes in the cabinet, unlabelled except for A, B, C. The
notation on the maintenance card refers to them — the previous operator
must have intended them to be played in order.

The deck needs a warm-up but is responsive. Using the bench processor for
noise reduction. Something is hidden in the recordings, but I haven't
worked out what yet.`,
    signature: '— Bek',
    clueId: 'clue-field-log',
  },

  {
    id: 'doc-maintenance',
    title: 'Maintenance Card',
    meta: 'Bench Processor Mk. II',
    body:
`TAPE A  →  lift VOICE above the static floor.
            drop LP below 1 kHz; the pulses live beneath the speech.
            COUNT the pulse GROUPS. That is the first digit.

TAPE B  →  capture was reversed during transfer.
            use REVERSE to recover the message.
            REVERSE stabilizes the recovered number; PITCH can make it clearer.

TAPE C  →  the carrier rides near ~2.4 kHz.
            narrow the BAND-PASS and sweep until the tone locks.
            read the signal-strength meter.`,
    clueId: 'clue-maintenance',
  },

  {
    id: 'doc-torn-memo',
    title: 'Torn Memo',
    meta: 'found taped under the desk',
    body:
`… three digits, in order: A, then B, then C.
     the drawer accepts only that combination.
     if the combination fails, wait — do not force the mechanism.
     it will remember.

the machine only remembers what was filtered.

if the notebook writes a number down, trust the number.
if it writes something else down, close it.`,
    clueId: 'clue-torn-memo',
  },

  {
    id: 'doc-access-note',
    title: 'Access Procedure',
    meta: 'Pre-fabbed form, filled in by hand',
    body:
`1. Confirm the lamp is on.
2. Warm the deck for a full minute.
3. Verify ambient hum is present (normal).
4. Transcribe clues in the order A – B – C.
5. Enter the code on the drawer keypad.
6. If the drawer opens, secure the contents and
   end recording.`,
  },

  {
    id: 'doc-final-note',
    title: 'No heading.',
    meta: 'handwritten, very small',
    body:
`if you are reading this, play the final tape.
do not turn up the volume.
do not turn it down.
just listen.`,
    signature: '',
  },
];

export const DOCUMENT_BY_ID = new Map<string, DocumentData>(DOCUMENTS.map(d => [d.id, d]));
