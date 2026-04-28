import { el, clearChildren } from './dom';
import { Events } from '../core/Events';
import type { AudioManager } from '../engine/AudioManager';
import type { PuzzleSystem } from '../game/puzzles/PuzzleSystem';
import type { ClueSystem } from '../game/clues/ClueSystem';
import type { FocusSystem } from '../game/interaction/FocusSystem';
import { formatTime } from '../core/Math';
import { Config } from '../app/config';

/**
 * DebugOverlay — F1 toggle, shows live state plus dev shortcuts.
 */
export class DebugOverlay {
  private root: HTMLDivElement;
  private fpsEl: HTMLElement;
  private dlEl: HTMLDListElement;
  private frameCount = 0;
  private frameTime = 0;
  private fps = 0;
  private _open = false;
  private hoveredId: string | null = null;
  private readonly offs: (() => void)[] = [];

  constructor(
    mount: HTMLElement,
    private readonly audio: AudioManager,
    private readonly puzzle: PuzzleSystem,
    private readonly clues: ClueSystem,
    private readonly focus: FocusSystem,
  ) {
    this.fpsEl = el('dd', {}, ['0']);
    this.dlEl = el('dl');

    const shortcuts = el('div', { class: 'shortcuts' });
    const makeBtn = (label: string, fn: () => void): HTMLButtonElement => {
      const b = el('button', {}, [label]);
      b.addEventListener('click', fn);
      return b;
    };
    shortcuts.append(
      makeBtn('Unlock drawer', () => Events.emit('code:attempted', { code: Config.puzzle.code, correct: true })),
      makeBtn('Reveal clues',  () => {
        // Developer shortcut: discover every clue that has a public id
        for (const id of ['clue-field-log','clue-maintenance','clue-torn-memo',
          'clue-tape-a-digit','clue-tape-b-digit','clue-tape-c-digit']) this.clues.discover(id);
      }),
      makeBtn('Trigger ending', () => Events.emit('ending:triggered', {})),
      makeBtn('Print save',     () => console.info('[debug save]', localStorage.getItem(Config.app.saveKey))),
    );

    this.root = el('div', { class: 'debug-overlay hidden' }, [
      el('h3', {}, ['Signal Room — Debug']),
      this.dlEl,
      shortcuts,
    ]);
    mount.appendChild(this.root);

    this.offs.push(Events.on('ui:debugToggle', ({ open }) => this.toggle(open)));
    this.offs.push(Events.on('hover:changed', ({ id }) => { this.hoveredId = id ?? null; }));
  }

  get isOpen(): boolean { return this._open; }


  dispose(): void {
    for (const off of this.offs.splice(0)) off();
    this.root.remove();
  }

  toggle(force?: boolean): void {
    this._open = force ?? !this._open;
    this.root.classList.toggle('hidden', !this._open);
  }

  update(dt: number): void {
    this.frameCount++;
    this.frameTime += dt;
    if (this.frameTime >= 0.5) {
      this.fps = this.frameCount / this.frameTime;
      this.frameCount = 0;
      this.frameTime = 0;
    }
    if (!this._open) return;

    const deck = this.audio.isReady ? this.audio.deck : null;
    const fs = this.audio.isReady ? this.audio.graph.filterState : null;

    const rows: [string, string][] = [
      ['fps', this.fps.toFixed(1)],
      ['hovered', this.hoveredId ?? '—'],
      ['focus', this.focus.focusId ?? 'overview'],
      ['objective', this.puzzle.currentObjective()],
      ['clues', `${this.clues.list().length} / 8`],
      ['drawer', this.puzzle.isDrawerUnlocked() ? 'unlocked' : 'locked'],
      ['tape', deck?.insertedTapeId ?? '—'],
      ['state', deck ? (deck.isPlaying ? 'play' : 'stop') + (deck.reversed ? ' (rev)' : '') : '—'],
      ['t/dur', deck ? `${formatTime(deck.time)} / ${formatTime(deck.duration)}` : '—'],
      ['rate', deck ? deck.rate.toFixed(2) : '—'],
      ['LP', fs ? `${fs.lowpass.toFixed(0)} Hz` : '—'],
      ['HP', fs ? `${fs.highpass.toFixed(0)} Hz` : '—'],
      ['BP', fs ? `${fs.bandpass.toFixed(0)} Hz` : '—'],
      ['Q',  fs ? fs.q.toFixed(2) : '—'],
      ['BP on', fs ? String(fs.bandpassEnabled) : '—'],
      ['cam',  `(${this.focusCamStr()})`],
    ];

    clearChildren(this.dlEl);
    this.dlEl.appendChild(el('dt', {}, ['fps'])); this.dlEl.appendChild(this.fpsEl);
    this.fpsEl.textContent = rows[0]![1];
    for (let i = 1; i < rows.length; i++) {
      const [k, v] = rows[i]!;
      this.dlEl.appendChild(el('dt', {}, [k]));
      this.dlEl.appendChild(el('dd', {}, [v]));
    }
  }

  private focusCamStr(): string {
    // Imported camera position via focus system's camera reference isn't
    // exposed; we keep this compact stub.
    return this.focus.isAnimating ? 'moving' : 'idle';
  }
}
