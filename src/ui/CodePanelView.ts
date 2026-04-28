import { el, clearChildren } from './dom';
import { Events } from '../core/Events';
import type { AudioManager } from '../engine/AudioManager';
import type { PuzzleSystem } from '../game/puzzles/PuzzleSystem';

/**
 * CodePanelView — full-screen code keypad UI shown when the player focuses
 * on the drawer. Enforces the canonical 3-digit code via PuzzleSystem.
 *
 * Emits 'code:attempted' events, displays visual/audio feedback, and
 * auto-dismisses on success.
 */
export class CodePanelView {
  private root: HTMLDivElement | null = null;
  private digits: string[] = [];
  private displayEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private readonly onKey: (e: KeyboardEvent) => void;
  private attempts = 0;

  constructor(
    private readonly mount: HTMLElement,
    private readonly puzzle: PuzzleSystem,
    private readonly audio: AudioManager,
    private readonly onClose?: () => void,
  ) {
    this.onKey = (e: KeyboardEvent) => {
      if (!this.root) return;
      if (e.code === 'Escape') { this.consume(e); this.close(); return; }
      if (e.code === 'Enter')  { this.consume(e); this.submit(); return; }
      if (e.code === 'Backspace') { this.consume(e); this.delete(); return; }
      if (/^Digit[0-9]$/.test(e.code)) {
        this.consume(e);
        this.addDigit(e.code.replace('Digit', ''));
      }
    };
  }

  get isOpen(): boolean { return this.root !== null; }

  open(): void {
    if (this.root) return;
    this.digits = [];
    this.attempts = 0;

    this.displayEl = el('div', { class: 'display' }, this.makeDigitCells());
    this.statusEl = el('div', { class: 'status' }, ['Enter three digits']);

    const keypad = el('div', { class: 'keypad' });
    for (let i = 1; i <= 9; i++) {
      keypad.appendChild(this.makeKey(i.toString()));
    }
    const clearBtn = this.makeKey('CLR', 'danger', () => this.clear());
    const zeroBtn = this.makeKey('0');
    const enterBtn = this.makeKey('ENTER', 'accent', () => this.submit());
    keypad.appendChild(clearBtn);
    keypad.appendChild(zeroBtn);
    keypad.appendChild(enterBtn);

    this.root = el('div', { class: 'code-panel' }, [
      el('div', { class: 'device' }, [
        el('h2', {}, ['Drawer Keypad']),
        el('div', { class: 'hint' }, ['A — B — C  ·  3 digits']),
        this.displayEl,
        keypad,
        this.statusEl,
        el('div', {
          class: 'hint',
          style: 'margin-top:12px; text-align:right;'
        }, ['ESC — Cancel']),
      ]),
    ]);

    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });

    this.mount.appendChild(this.root);
    window.addEventListener('keydown', this.onKey, { capture: true });
  }

  close(): void {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
    this.displayEl = null;
    this.statusEl = null;
    window.removeEventListener('keydown', this.onKey, { capture: true } as EventListenerOptions);
    this.onClose?.();
  }

  dispose(): void { this.close(); }

  private consume(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  private makeKey(label: string, extra?: string, onClick?: () => void): HTMLButtonElement {
    const classes = 'key' + (extra ? ` ${extra}` : '') + (label.length > 2 ? ' wide' : '');
    const b = el('button', { class: classes }, [label]);
    b.addEventListener('click', () => {
      if (onClick) onClick();
      else this.addDigit(label);
    });
    return b;
  }

  private makeDigitCells(): Node[] {
    const cells: Node[] = [];
    for (let i = 0; i < 3; i++) {
      cells.push(el('div', { class: 'digit' }, [this.digits[i] ?? '—']));
    }
    return cells;
  }

  private rebuildDisplay(): void {
    if (!this.displayEl) return;
    clearChildren(this.displayEl);
    for (const n of this.makeDigitCells()) this.displayEl.appendChild(n);
  }

  private addDigit(d: string): void {
    if (this.digits.length >= 3) return;
    this.digits.push(d);
    this.rebuildDisplay();
    this.audio.sfx.button();
    if (this.digits.length === 3) {
      if (this.statusEl) this.statusEl.textContent = 'Press ENTER';
    }
  }

  private delete(): void {
    if (this.digits.length === 0) return;
    this.digits.pop();
    this.rebuildDisplay();
    this.audio.sfx.knob();
  }

  private clear(): void {
    this.digits = [];
    this.rebuildDisplay();
    if (this.statusEl) {
      this.statusEl.textContent = 'Cleared';
      this.statusEl.className = 'status';
    }
    this.audio.sfx.knob();
  }

  private submit(): void {
    if (this.digits.length < 3) {
      if (this.statusEl) {
        this.statusEl.textContent = 'Need 3 digits';
        this.statusEl.className = 'status err';
      }
      this.audio.sfx.wrong();
      return;
    }
    const code = this.digits.join('');
    const correct = this.puzzle.validateCode(code);
    Events.emit('code:attempted', { code, correct });

    this.attempts++;

    if (correct) {
      if (this.displayEl) this.displayEl.classList.add('correct');
      if (this.statusEl) {
        this.statusEl.textContent = 'ACCEPTED';
        this.statusEl.className = 'status ok';
      }
      this.audio.sfx.right();
      this.audio.sfx.drawerUnlock();
      window.setTimeout(() => this.close(), 1200);
    } else {
      if (this.displayEl) {
        this.displayEl.classList.add('shake');
        window.setTimeout(() => this.displayEl?.classList.remove('shake'), 420);
      }
      if (this.statusEl) {
        let msg = 'Rejected';
        if (this.attempts >= 3) msg = 'Rejected — check your notebook';
        this.statusEl.textContent = msg;
        this.statusEl.className = 'status err';
      }
      this.audio.sfx.wrong();
      // Reset digits after a short delay
      window.setTimeout(() => { this.digits = []; this.rebuildDisplay(); }, 600);
    }
  }
}
