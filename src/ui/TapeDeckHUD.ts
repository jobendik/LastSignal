import { el, clearChildren } from './dom';
import { Events } from '../core/Events';
import { TAPES, FINAL_TAPE, TAPE_BY_ID } from '../data/tapes';
import { formatTime, mapRange, clamp } from '../core/Math';
import type { AudioManager } from '../engine/AudioManager';
import type { FilterState } from '../game/audio/AudioGraph';

/**
 * TapeDeckHUD — the diegetic-styled control surface shown when the player
 * focuses on the tape deck. Exposes:
 *   - cassette tray (choose which tape to insert / eject)
 *   - transport buttons (play / pause / stop / rewind / fast-forward / reverse)
 *   - scrub bar (click to seek)
 *   - five knobs: Low-Pass, High-Pass, Band-Pass, Q, Gain
 *
 * All state is read from the AudioManager; user input mutates via the same
 * manager. The HUD listens to tape events so display stays in sync even
 * when state changes from code (e.g., save restore, ending sequence).
 */
export class TapeDeckHUD {
  private root: HTMLDivElement;
  private labelChip: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private timeEl: HTMLDivElement;
  private progressFill: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private buttonBox: HTMLDivElement;
  private trayEl: HTMLDivElement;
  private knobsEl: HTMLDivElement;

  private availableTapes = new Set<string>([...TAPES.map(t => t.id)]);
  private isFinalAvailable = false;

  private filterSnapshot: FilterState;
  private readonly offs: (() => void)[] = [];
  private bpToggle: HTMLButtonElement | null = null;

  constructor(mount: HTMLElement, private readonly audio: AudioManager) {
    this.filterSnapshot = { ...this.audio.graph.filterState };

    this.labelChip     = el('div', { class: 'label-chip empty' }, ['NO TAPE']);
    this.titleEl       = el('div', { class: 'title' }, ['— No tape inserted —']);
    this.timeEl        = el('div', { class: 'time' }, ['00:00 / 00:00']);
    this.progressFill  = el('div', { class: 'fill' });
    this.progressBar   = el('div', { class: 'progress' }, [this.progressFill]);
    this.progressBar.addEventListener('click', (e) => this.onScrubClick(e));

    this.buttonBox = el('div', { class: 'btns' });
    this.trayEl = el('div', { class: 'cassette-tray' });
    this.knobsEl = el('div', { class: 'proc-row' });

    this.root = el('div', { class: 'deck-hud' }, [
      el('div', { class: 'row' }, [this.labelChip, this.titleEl, this.timeEl]),
      el('div', { class: 'row' }, [this.progressBar]),
      el('div', { class: 'row' }, [this.buttonBox]),
      this.trayEl,
      this.knobsEl,
      el('div', { class: 'close-hint' }, ['ESC — Step back']),
    ]);

    mount.appendChild(this.root);

    this.buildTransport();
    this.buildTray();
    this.buildKnobs();

    // Sync from events
    this.offs.push(Events.on('tape:inserted', () => this.syncFromState()));
    this.offs.push(Events.on('tape:ejected', () => this.syncFromState()));
    this.offs.push(Events.on('tape:playStateChanged', () => this.syncFromState()));
    this.offs.push(Events.on('tape:timeChanged', ({ time, duration }) => this.updateTime(time, duration)));
    this.offs.push(Events.on('audio:filtersChanged', (fs) => {
      this.filterSnapshot = {
        ...this.filterSnapshot,
        ...fs,
      };
      this.refreshKnobs();
      this.refreshBandpassToggle();
    }));
    this.offs.push(Events.on('drawer:unlocked', () => {
      this.isFinalAvailable = true;
      this.availableTapes.add(FINAL_TAPE.id);
      this.rebuildTray();
    }));

    this.syncFromState();
  }

  setOpen(flag: boolean): void {
    this.root.classList.toggle('open', flag);
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
    this.root.remove();
  }

  markFinalAvailable(flag: boolean): void {
    this.isFinalAvailable = flag;
    if (flag) this.availableTapes.add(FINAL_TAPE.id);
    this.rebuildTray();
  }

  // ---------- transport ----------
  private buildTransport(): void {
    const make = (label: string, cls: string, handler: () => void): HTMLButtonElement => {
      const b = el('button', { class: `btn ${cls}` }, [label]);
      b.addEventListener('click', () => { this.audio.sfx.button(); handler(); });
      return b;
    };

    this.buttonBox.appendChild(make('⏮  Rew', 'rew', () => this.audio.deck.nudge(-2)));
    this.buttonBox.appendChild(make('▶ Play', 'play', () => this.audio.deck.play()));
    this.buttonBox.appendChild(make('⏸ Pause', 'pause', () => this.audio.deck.pause()));
    this.buttonBox.appendChild(make('⏹ Stop', 'stop', () => this.audio.deck.stop()));
    this.buttonBox.appendChild(make('⏭ FF', 'ff', () => this.audio.deck.nudge(+2)));
    this.buttonBox.appendChild(make('◀ REV', 'reverse', () => this.audio.deck.setReversed(!this.audio.deck.reversed)));
  }

  // ---------- cassette tray ----------
  private buildTray(): void {
    this.trayEl.appendChild(el('span', { class: 'lbl' }, ['Tray']));
    this.rebuildTray();
  }

  private rebuildTray(): void {
    // Keep the label, replace the chips
    const label = this.trayEl.querySelector('.lbl');
    clearChildren(this.trayEl);
    if (label) this.trayEl.appendChild(label);

    const tapes = [...TAPES];
    if (this.isFinalAvailable) tapes.push(FINAL_TAPE);

    const inserted = this.audio.deck.insertedTapeId;

    for (const t of tapes) {
      const chip = el('button', { class: 'chip' + (inserted === t.id ? ' inserted' : '') },
        [t.label]);
      chip.title = t.title;
      chip.addEventListener('click', () => {
        this.audio.sfx.insert();
        if (inserted === t.id) {
          this.audio.deck.eject();
        } else {
          const isFinal = t.id === FINAL_TAPE.id;
          this.audio.insertTape(t, isFinal);
        }
      });
      this.trayEl.appendChild(chip);
    }

    // Eject button
    if (inserted) {
      const ej = el('button', { class: 'chip' }, ['Eject ⏏']);
      ej.addEventListener('click', () => {
        this.audio.sfx.eject();
        this.audio.deck.eject();
      });
      this.trayEl.appendChild(ej);
    }
  }

  // ---------- knobs ----------
  private buildKnobs(): void {
    const specs: {
      key: keyof FilterState | 'bandpassEnabled';
      label: string;
      min: number; max: number;
      toDisplay: (v: number) => string;
      log?: boolean;
      toggle?: boolean;
    }[] = [
      { key: 'lowpass',  label: 'LP', min: 200, max: 16000, log: true,
        toDisplay: v => v >= 1000 ? (v/1000).toFixed(1) + 'k' : Math.round(v).toString() },
      { key: 'highpass', label: 'HP', min: 20,  max: 4000, log: true,
        toDisplay: v => v >= 1000 ? (v/1000).toFixed(1) + 'k' : Math.round(v).toString() },
      { key: 'bandpass', label: 'BP', min: 200, max: 6000, log: true,
        toDisplay: v => v >= 1000 ? (v/1000).toFixed(2) + 'k' : Math.round(v).toString() },
      { key: 'q',        label: 'Q',  min: 0.5, max: 16,
        toDisplay: v => v.toFixed(1) },
      { key: 'gain',     label: 'G',  min: 0,   max: 1.8,
        toDisplay: v => v.toFixed(2) },
    ];

    for (const s of specs) {
      const k = this.makeKnob(s);
      this.knobsEl.appendChild(k);
    }

    // Bandpass enable toggle (above the BP knob label)
    const bpToggle = el('button', {
      class: 'btn',
      style: 'min-width:auto; padding:4px 8px; font-size:10px;',
    }, ['BP OFF']);
    this.bpToggle = bpToggle;
    bpToggle.addEventListener('click', () => {
      const cur = this.filterSnapshot.bandpassEnabled;
      this.audio.graph.setFilters({ bandpassEnabled: !cur });
      this.audio.sfx.knob();
    });
    this.refreshBandpassToggle();

    const bpWrap = el('div', {
      style: 'grid-column:3; display:flex; justify-content:center; margin-top:4px;',
    }, [bpToggle]);
    this.knobsEl.appendChild(bpWrap);
  }

  private makeKnob(spec: { key: keyof FilterState; label: string; min: number; max: number; log?: boolean; toDisplay: (v: number) => string }): HTMLDivElement {
    const dial = el('div', { class: 'dial' });
    const val = el('div', { class: 'val' });
    const wrap = el('div', { class: 'knob' }, [
      dial,
      el('div', { class: 'lbl' }, [spec.label]),
      val,
    ]);

    const update = (): void => {
      const v = this.filterSnapshot[spec.key] as number;
      let t: number;
      if (spec.log) {
        t = Math.log(v / spec.min) / Math.log(spec.max / spec.min);
      } else {
        t = (v - spec.min) / (spec.max - spec.min);
      }
      t = clamp(t, 0, 1);
      const deg = mapRange(t, 0, 1, -135, 135);
      dial.style.setProperty('--rot', `${deg}deg`);
      val.textContent = spec.toDisplay(v);
    };
    update();
    wrap.dataset['key'] = spec.key;
    (wrap as unknown as { _refresh: () => void })._refresh = update;

    // Drag to rotate (vertical) + wheel
    let dragging = false;
    let lastY = 0;
    let dragStartValue = 0;
    const onMove = (dy: number): void => {
      const range = spec.log
        ? Math.log(spec.max / spec.min)
        : (spec.max - spec.min);
      const stepFactor = spec.log ? 0.008 : 0.4;
      if (spec.log) {
        const t0 = Math.log(dragStartValue / spec.min) / range;
        const t1 = clamp(t0 - dy * stepFactor * 0.01, 0, 1);
        const v = spec.min * Math.exp(t1 * range);
        this.audio.graph.setFilters({ [spec.key]: v } as Partial<FilterState>);
      } else {
        const v = clamp(dragStartValue - dy * stepFactor * 0.05 * range, spec.min, spec.max);
        this.audio.graph.setFilters({ [spec.key]: v } as Partial<FilterState>);
      }
    };
    dial.addEventListener('pointerdown', (e) => {
      dragging = true; lastY = e.clientY;
      dragStartValue = this.filterSnapshot[spec.key] as number;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    dial.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      onMove(e.clientY - lastY);
      if (Math.abs(e.movementY) > 0.5) this.audio.sfx.knob();
    });
    dial.addEventListener('pointerup', () => { dragging = false; });
    dial.addEventListener('pointercancel', () => { dragging = false; });
    dial.addEventListener('wheel', (e) => {
      e.preventDefault();
      dragStartValue = this.filterSnapshot[spec.key] as number;
      onMove(e.deltaY * 0.5);
      this.audio.sfx.knob();
    }, { passive: false });

    return wrap;
  }

  private refreshKnobs(): void {
    this.knobsEl.querySelectorAll('.knob').forEach((n) => {
      const r = (n as unknown as { _refresh?: () => void })._refresh;
      if (r) r();
    });
  }

  private refreshBandpassToggle(): void {
    if (!this.bpToggle) return;
    const on = this.filterSnapshot.bandpassEnabled;
    this.bpToggle.textContent = on ? 'BP ON' : 'BP OFF';
    this.bpToggle.classList.toggle('active', on);
  }

  // ---------- sync helpers ----------
  private syncFromState(): void {
    const deck = this.audio.deck;
    const id = deck.insertedTapeId;
    const def = id ? TAPE_BY_ID.get(id) ?? null : null;

    if (def) {
      this.labelChip.textContent = def.label;
      this.labelChip.classList.remove('empty');
      this.titleEl.textContent = def.title;
    } else {
      this.labelChip.textContent = 'NO TAPE';
      this.labelChip.classList.add('empty');
      this.titleEl.textContent = '— No tape inserted —';
    }

    this.updateTime(deck.time, deck.duration);
    this.rebuildTray();

    // Active button states
    this.buttonBox.querySelectorAll('.btn').forEach((b) => b.classList.remove('active'));
    const activeBtn = this.buttonBox.querySelector(deck.isPlaying ? '.btn.play' : '.btn.pause');
    if (deck.isPlaying) activeBtn?.classList.add('active');
    const revBtn = this.buttonBox.querySelector('.btn.reverse');
    if (deck.reversed) revBtn?.classList.add('active');
    else revBtn?.classList.remove('active');
  }

  private updateTime(time: number, duration: number): void {
    this.timeEl.textContent = `${formatTime(time)} / ${formatTime(duration)}`;
    const pct = duration > 0 ? (time / duration) * 100 : 0;
    this.progressFill.style.width = `${clamp(pct, 0, 100)}%`;
  }

  private onScrubClick(e: MouseEvent): void {
    const rect = this.progressBar.getBoundingClientRect();
    const pct = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const dur = this.audio.deck.duration;
    if (dur > 0) {
      this.audio.deck.seek(pct * dur);
      this.audio.sfx.knob();
    }
  }
}
