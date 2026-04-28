import { Events } from '../../core/Events';
import { Config } from '../../app/config';
import type { ClueSystem } from '../clues/ClueSystem';
import type { ObjectiveId } from '../../core/Types';
import { OBJECTIVES } from '../../data/objectives';
import type { FilterState } from '../audio/AudioGraph';
import {
  TAPE_A_LOWPASS_TARGET_HZ,
  TAPE_C_BANDPASS_TARGET_HZ,
  TAPE_C_BANDPASS_TOLERANCE_HZ,
} from '../../data/tapes';

/**
 * PuzzleSystem — evaluates puzzle conditions in response to events.
 *
 * The architecture is *condition-driven*: the system subscribes to tape
 * state, filter state, documents-read, and code-entry events, and from
 * that derives which clue/objective should next be revealed. This keeps
 * gameplay state in one place and avoids hardcoded conditionals spread
 * across devices.
 *
 * Key puzzle beats:
 *  - Reading the Maintenance Card → unlock clue-maintenance
 *  - Playing tape A past 8s with lowpass < 1kHz → discover clue-tape-a-digit
 *  - Playing tape B in reverse for >4s → discover clue-tape-b-digit
 *  - Playing tape C with bandpass within tolerance → discover clue-tape-c-digit
 *  - Entering the correct code on the panel → unlock drawer + discover clue
 *  - Inserting & playing the final tape → trigger ending
 */
export class PuzzleSystem {
  private objective: ObjectiveId = 'start';
  private readonly puzzleSteps = new Set<string>();

  // Per-tape play timers used to require *sustained* correct settings
  private tapeAValidAccum = 0;
  private tapeBValidAccum = 0;
  private tapeCValidAccum = 0;

  private currentTape: string | null = null;
  private tapePlaying = false;
  private tapeReversed = false;
  private tapeTime = 0;
  private filters: FilterState | null = null;

  private drawerUnlocked = false;
  private finalPlayedAccum = 0;
  private endingTriggered = false;
  private readonly offs: (() => void)[] = [];

  constructor(private readonly clues: ClueSystem) {
    this.offs.push(Events.on('tape:inserted', ({ tapeId }) => {
      this.currentTape = tapeId;
      this.resetTapeTimers();
    }));
    this.offs.push(Events.on('tape:ejected', () => {
      this.currentTape = null;
      this.tapePlaying = false;
      this.resetTapeTimers();
    }));
    this.offs.push(Events.on('tape:playStateChanged', ({ playing, reversed }) => {
      this.tapePlaying = playing;
      this.tapeReversed = reversed;
    }));
    this.offs.push(Events.on('tape:timeChanged', ({ time }) => { this.tapeTime = time; }));
    this.offs.push(Events.on('audio:filtersChanged', (fs) => {
      this.filters = { ...(this.filters ?? fs), ...fs };
    }));
    this.offs.push(Events.on('document:read', ({ id }) => this.onDocumentRead(id)));
    this.offs.push(Events.on('code:attempted', ({ code, correct }) => this.onCodeAttempt(code, correct)));
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
  }

  setFilterSnapshot(fs: FilterState): void { this.filters = fs; }

  setObjective(id: ObjectiveId): void {
    if (this.objective === id) return;
    this.objective = id;
    Events.emit('objective:changed', { id, text: OBJECTIVES[id] });
  }

  currentObjective(): ObjectiveId { return this.objective; }

  tick(dt: number): void {
    // Tape A — needs lowpass < target & tape playing past pulse region
    if (this.currentTape === 'tape-a' && this.tapePlaying && !this.tapeReversed && this.filters) {
      if (this.filters.lowpass <= TAPE_A_LOWPASS_TARGET_HZ && this.tapeTime > 7.8) {
        this.tapeAValidAccum += dt;
        if (this.tapeAValidAccum > 2.0 && !this.clues.has('clue-tape-a-digit')) {
          this.clues.discover('clue-tape-a-digit');
        }
      } else {
        this.tapeAValidAccum = 0;
      }
    } else {
      this.tapeAValidAccum = 0;
    }
    // Tape B — needs reverse playback active for a few continuous seconds.
    if (this.currentTape === 'tape-b' && this.tapePlaying && this.tapeReversed) {
      this.tapeBValidAccum += dt;
      if (this.tapeBValidAccum > 3.0 && !this.clues.has('clue-tape-b-digit')) {
        this.clues.discover('clue-tape-b-digit');
      }
    } else {
      this.tapeBValidAccum = 0;
    }
    // Tape C — needs bandpass enabled within tolerance of target.
    if (this.currentTape === 'tape-c' && this.tapePlaying && !this.tapeReversed && this.filters?.bandpassEnabled) {
      const off = Math.abs(this.filters.bandpass - TAPE_C_BANDPASS_TARGET_HZ);
      if (off < TAPE_C_BANDPASS_TOLERANCE_HZ) {
        this.tapeCValidAccum += dt;
        if (this.tapeCValidAccum > 1.5 && !this.clues.has('clue-tape-c-digit')) {
          this.clues.discover('clue-tape-c-digit');
        }
      } else {
        this.tapeCValidAccum = 0;
      }
    } else {
      this.tapeCValidAccum = 0;
    }

    // Final tape — play any part of it to trigger the ending
    if (this.currentTape === 'tape-final' && this.tapePlaying && !this.endingTriggered) {
      this.finalPlayedAccum += dt;
      if (this.finalPlayedAccum > 3.0) {
        this.endingTriggered = true;
        Events.emit('ending:triggered', {});
      }
    }

    this.updateObjective();
  }

  private resetTapeTimers(): void {
    this.tapeAValidAccum = 0;
    this.tapeBValidAccum = 0;
    this.tapeCValidAccum = 0;
  }

  private onDocumentRead(id: string): void {
    this.puzzleSteps.add(`read:${id}`);
    Events.emit('puzzle:stepComplete', { stepId: `read:${id}` });
  }

  private onCodeAttempt(code: string, correct: boolean): void {
    if (correct && !this.drawerUnlocked) {
      this.drawerUnlocked = true;
      this.clues.discover('clue-drawer-unlocked');
      this.clues.discover('clue-final-tape');
      Events.emit('drawer:unlocked', {});
    }
    // Record attempts for save/debug
    this.puzzleSteps.add(`code:${code}:${correct ? 'ok' : 'no'}`);
  }

  private updateObjective(): void {
    // Advance objective based on which clues exist
    if (!this.clues.has('clue-maintenance')) {
      this.setObjective('start');
      return;
    }
    if (!this.clues.has('clue-tape-a-digit')) { this.setObjective('decode-pulses'); return; }
    if (!this.clues.has('clue-tape-b-digit')) { this.setObjective('decode-reversed'); return; }
    if (!this.clues.has('clue-tape-c-digit')) { this.setObjective('decode-tones'); return; }
    if (!this.drawerUnlocked) { this.setObjective('enter-code'); return; }
    if (!this.endingTriggered) { this.setObjective('play-final'); return; }
    this.setObjective('ending');
  }

  /** Code validation. Compares the entered string to Config.puzzle.code. */
  validateCode(code: string): boolean {
    return code === Config.puzzle.code;
  }

  isDrawerUnlocked(): boolean { return this.drawerUnlocked; }

  serialize(): { steps: string[]; drawerUnlocked: boolean; endingStarted: boolean; objective: ObjectiveId } {
    return {
      steps: Array.from(this.puzzleSteps),
      drawerUnlocked: this.drawerUnlocked,
      endingStarted: this.endingTriggered,
      objective: this.objective,
    };
  }

  restore(data: { steps: readonly string[]; drawerUnlocked: boolean; endingStarted: boolean; objective?: ObjectiveId }): void {
    this.puzzleSteps.clear();
    for (const s of data.steps) this.puzzleSteps.add(s);
    this.drawerUnlocked = data.drawerUnlocked;
    this.endingTriggered = data.endingStarted;
    if (data.objective) this.objective = data.objective;
  }
}
