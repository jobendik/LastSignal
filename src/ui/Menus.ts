import { el } from './dom';
import { Config } from '../app/config';
import type { SaveSystem, Settings } from '../engine/SaveSystem';

export type MainMenuAction = 'continue' | 'new' | 'settings' | 'help' | 'reset';

/**
 * MainMenu — entry screen. Shows "Continue" only when a save exists.
 */
export class MainMenu {
  private root: HTMLDivElement;

  constructor(mount: HTMLElement, private readonly save: SaveSystem, onAction: (a: MainMenuAction) => void) {
    const hasSave = !!this.save.load();

    const continueBtn = el('button', { class: 'menu-btn' + (hasSave ? '' : ' disabled') }, ['Continue']);
    if (!hasSave) continueBtn.setAttribute('disabled', '');
    continueBtn.addEventListener('click', () => onAction('continue'));

    const newBtn = el('button', { class: 'menu-btn' }, ['New Investigation']);
    newBtn.addEventListener('click', () => onAction('new'));

    const settingsBtn = el('button', { class: 'menu-btn' }, ['Settings']);
    settingsBtn.addEventListener('click', () => onAction('settings'));

    const helpBtn = el('button', { class: 'menu-btn' }, ['How to Play']);
    helpBtn.addEventListener('click', () => onAction('help'));

    const resetBtn = el('button', { class: 'menu-btn small' }, ['Reset progress']);
    resetBtn.addEventListener('click', () => onAction('reset'));

    this.root = el('div', { class: 'menu' }, [
      el('h1', { class: 'menu-title' }, [Config.app.title]),
      el('div', { class: 'menu-subtitle' }, ['Analog Investigation · 3D Puzzle Prototype']),
      el('div', { class: 'menu-buttons' }, [continueBtn, newBtn, settingsBtn, helpBtn, resetBtn]),
      el('div', { class: 'menu-footer' }, ['v' + Config.app.version + ' · click anywhere, then use the mouse · ', el('span', {}, ['Headphones recommended'])]),
    ]);
    mount.appendChild(this.root);
  }

  setHasSave(has: boolean): void {
    const btn = this.root.querySelector<HTMLButtonElement>('.menu-btn:first-child');
    if (!btn) return;
    if (has) { btn.removeAttribute('disabled'); btn.classList.remove('disabled'); }
    else     { btn.setAttribute('disabled', ''); btn.classList.add('disabled'); }
  }

  destroy(): void { this.root.remove(); }
}

/**
 * PauseMenu — shown when ESC is pressed during investigation.
 */
export class PauseMenu {
  private root: HTMLDivElement | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly onResume: () => void,
    private readonly onSettings: () => void,
    private readonly onQuitToMenu: () => void,
    private readonly onHelp: () => void,
  ) {}

  get isOpen(): boolean { return this.root !== null; }

  open(): void {
    if (this.root) return;
    const resumeBtn = el('button', { class: 'menu-btn' }, ['Resume']);
    resumeBtn.addEventListener('click', () => { this.close(); this.onResume(); });

    const settings = el('button', { class: 'menu-btn' }, ['Settings']);
    settings.addEventListener('click', () => this.onSettings());

    const help = el('button', { class: 'menu-btn' }, ['How to Play']);
    help.addEventListener('click', () => this.onHelp());

    const quit = el('button', { class: 'menu-btn' }, ['Return to Main Menu']);
    quit.addEventListener('click', () => { this.close(); this.onQuitToMenu(); });

    this.root = el('div', { class: 'menu' }, [
      el('h1', { class: 'menu-title' }, ['Paused']),
      el('div', { class: 'menu-subtitle' }, ['Signal held.']),
      el('div', { class: 'menu-buttons' }, [resumeBtn, settings, help, quit]),
      el('div', { class: 'menu-footer' }, ['Press ESC to resume']),
    ]);
    this.mount.appendChild(this.root);
  }

  close(): void {
    this.root?.remove();
    this.root = null;
  }

  toggle(): void { if (this.isOpen) { this.close(); this.onResume(); } else this.open(); }
}

/**
 * SettingsPanel — master/sfx/music volume + reduced motion.
 */
export class SettingsPanel {
  private root: HTMLDivElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly getSettings: () => Settings,
    private readonly applySettings: (s: Settings) => void,
    private readonly onReset: () => void,
  ) {}

  get isOpen(): boolean { return this.root !== null; }

  open(onClose: () => void): void {
    if (this.root) return;
    const s = { ...this.getSettings() };

    const makeSlider = (label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void): HTMLDivElement => {
      const valSpan = el('span', { class: 'val' }, [value.toFixed(2)]);
      const input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) }) as HTMLInputElement;
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        valSpan.textContent = v.toFixed(2);
        onInput(v);
      });
      return el('div', { class: 'settings-row' }, [el('label', {}, [label]), input, valSpan]);
    };

    const makeCheck = (label: string, checked: boolean, onChange: (v: boolean) => void): HTMLDivElement => {
      const input = el('input', { type: 'checkbox' }) as HTMLInputElement;
      input.checked = checked;
      input.addEventListener('change', () => onChange(input.checked));
      return el('div', { class: 'settings-row' }, [el('label', {}, [label]), input]);
    };

    const closeBtn = el('button', { class: 'menu-btn small', style: 'margin-top:8px;' }, ['Close']);
    closeBtn.addEventListener('click', () => { this.close(); onClose(); });

    const resetBtn = el('button', { class: 'menu-btn small', style: 'margin-top:4px;' }, ['Reset save']);
    resetBtn.addEventListener('click', () => this.onReset());

    this.root = el('div', { class: 'menu' }, [
      el('div', { class: 'settings-panel' }, [
        el('h2', {}, ['Settings']),
        makeSlider('Master',  s.master,  0, 1, 0.01, (v) => { s.master = v;  this.applySettings(s); }),
        makeSlider('SFX',     s.sfx,     0, 1, 0.01, (v) => { s.sfx = v;     this.applySettings(s); }),
        makeSlider('Music',   s.music,   0, 1, 0.01, (v) => { s.music = v;   this.applySettings(s); }),
        makeCheck('Reduced motion (disable camera sway & FX)', s.reducedMotion, (v) => { s.reducedMotion = v; this.applySettings(s); }),
        closeBtn,
        resetBtn,
      ]),
    ]);
    this.mount.appendChild(this.root);

    // Close on ESC. Keep a reference so closing via button removes the listener too.
    this.keyHandler = (e: KeyboardEvent): void => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.close();
        onClose();
      }
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  close(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    this.root?.remove();
    this.root = null;
  }
}

/**
 * HelpOverlay — how to play / controls.
 */
export class HelpOverlay {
  private root: HTMLDivElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private readonly mount: HTMLElement) {}

  open(onClose: () => void): void {
    if (this.root) return;
    const closeBtn = el('button', { class: 'menu-btn small', style: 'margin-top:14px;' }, ['Close']);
    closeBtn.addEventListener('click', () => { this.close(); onClose(); });

    this.root = el('div', { class: 'menu' }, [
      el('div', { class: 'help-panel' }, [
        el('h2', {}, ['How to Play']),
        el('p', { style: 'color:var(--ink-dim);margin-bottom:8px;' }, ['You are inside an analog investigation room. Tapes hold clues. The drawer is locked.']),
        el('h3', {}, ['Controls']),
        el('ul', {}, [
          el('li', {}, [el('kbd', {}, ['LMB']), el('span', {}, ['Interact (inspect objects, press buttons)'])]),
          el('li', {}, [el('kbd', {}, ['ESC']), el('span', {}, ['Step back from a device / open the pause menu'])]),
          el('li', {}, [el('kbd', {}, ['TAB']), el('span', {}, ['Open / close the notebook'])]),
          el('li', {}, [el('kbd', {}, ['F1']), el('span', {}, ['Toggle developer overlay'])]),
          el('li', {}, [el('kbd', {}, ['Drag']), el('span', {}, ['On knobs — rotate (vertical drag or mouse wheel)'])]),
        ]),
        el('h3', {}, ['Investigating']),
        el('ul', {}, [
          el('li', {}, [el('kbd', {}, ['1']), el('span', {}, ['Read documents for clues and puzzle hints.'])]),
          el('li', {}, [el('kbd', {}, ['2']), el('span', {}, ['Insert cassettes into the tape deck.'])]),
          el('li', {}, [el('kbd', {}, ['3']), el('span', {}, ['Use the filter knobs to uncover hidden layers in each tape.'])]),
          el('li', {}, [el('kbd', {}, ['4']), el('span', {}, ['The oscilloscope always shows what you\'re hearing.'])]),
          el('li', {}, [el('kbd', {}, ['5']), el('span', {}, ['Find the 3-digit code. Enter it on the drawer.'])]),
        ]),
        el('div', { class: 'close-note' }, ['Headphones strongly recommended.']),
        closeBtn,
      ]),
    ]);
    this.mount.appendChild(this.root);

    this.keyHandler = (e: KeyboardEvent): void => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.close();
        onClose();
      }
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  close(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    this.root?.remove();
    this.root = null;
  }
}

/**
 * LoadingScreen — minimal progress indicator used during boot.
 */
export class LoadingScreen {
  private root: HTMLDivElement;
  private fill: HTMLSpanElement;
  private taglineEl: HTMLDivElement;

  constructor(mount: HTMLElement) {
    this.fill = el('span', {});
    this.taglineEl = el('div', { class: 'tagline' }, ['initialising systems']);
    this.root = el('div', { class: 'loading' }, [
      el('div', {}, ['Signal Room · Booting']),
      el('div', { class: 'bar' }, [this.fill]),
      this.taglineEl,
    ]);
    mount.appendChild(this.root);
  }

  setProgress(p: number, tag?: string): void {
    this.fill.style.width = `${Math.round(p * 100)}%`;
    if (tag) this.taglineEl.textContent = tag;
  }

  close(): void {
    this.root.classList.add('fade-out');
    window.setTimeout(() => this.root.remove(), 420);
  }
}

/**
 * EndingScreen — fade-in post-ending text.
 */
export class EndingScreen {
  private root: HTMLDivElement | null = null;

  constructor(private readonly mount: HTMLElement) {}

  show(onMenu: () => void): void {
    if (this.root) return;
    const menuBtn = el('button', { class: 'menu-btn small' }, ['Main Menu']);
    menuBtn.addEventListener('click', onMenu);

    this.root = el('div', { class: 'ending-screen' }, [
      el('div', { class: 'glyph' }, ['∞']),
      el('div', { class: 'body' }, [
        'The signal was always there.',
        el('br', {}),
        'You were only listening for the wrong things.',
      ]),
      el('div', { class: 'meta' }, ['— end of prototype —']),
      menuBtn,
    ]);
    this.mount.appendChild(this.root);
  }

  close(): void { this.root?.remove(); this.root = null; }
}
