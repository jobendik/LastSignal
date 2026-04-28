import { el, clearChildren } from './dom';
import { Events } from '../core/Events';
import { OBJECTIVES } from '../data/objectives';
import type { ClueSystem } from '../game/clues/ClueSystem';
import type { PuzzleSystem } from '../game/puzzles/PuzzleSystem';

/**
 * Notebook — displays current objective and discovered clues. Toggled with
 * TAB or via the UI. Uses warm paper styling so it feels tactile.
 */
export class NotebookView {
  private readonly root: HTMLDivElement;
  private readonly objectiveEl: HTMLDivElement;
  private readonly listEl: HTMLUListElement;
  private open = false;
  private readonly offs: (() => void)[] = [];

  constructor(mount: HTMLElement, private readonly clues: ClueSystem, private readonly puzzle: PuzzleSystem) {
    this.objectiveEl = el('div', { class: 'objective' }, [
      el('span', { class: 'objective-label' }, ['Current objective']),
      el('span', { class: 'objective-text' }, [OBJECTIVES.start]),
    ]);
    this.listEl = el('ul', { class: 'clue-list' });
    this.root = el('div', { class: 'notebook' }, [
      el('h2', {}, ['Field Notebook']),
      el('div', { class: 'sub' }, ['Case: Signal Room — 3 cassette recordings']),
      this.objectiveEl,
      this.listEl,
      el('div', { class: 'close-hint' }, ['TAB to close']),
    ]);
    mount.appendChild(this.root);

    this.offs.push(Events.on('ui:notebookToggle', ({ open }) => this.toggle(open)));
    this.offs.push(Events.on('clue:discovered', () => this.rebuild()));
    this.offs.push(Events.on('objective:changed', ({ text }) => {
      const span = this.objectiveEl.querySelector('.objective-text');
      if (span) span.textContent = text;
    }));
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
    this.root.remove();
  }

  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
    this.root.classList.toggle('open', this.open);
    if (this.open) this.rebuild();
  }

  isOpen(): boolean { return this.open; }

  private rebuild(): void {
    clearChildren(this.listEl);
    const items = this.clues.list();
    if (items.length === 0) {
      this.listEl.appendChild(el('li', { class: 'empty' }, ['No clues yet. Inspect the desk.']));
    } else {
      for (const c of items) {
        this.listEl.appendChild(
          el('li', {}, [
            el('div', { class: 't' }, [c.title]),
            el('div', { class: 'd' }, [c.description]),
            el('div', { class: 'src' }, ['Source · ' + c.source]),
          ])
        );
      }
    }
    // Refresh objective text in case it lags events
    const text = OBJECTIVES[this.puzzle.currentObjective()];
    const span = this.objectiveEl.querySelector('.objective-text');
    if (span) span.textContent = text;
  }
}
