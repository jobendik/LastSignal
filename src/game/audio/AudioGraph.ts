/**
 * AudioGraph — the master Web Audio routing graph.
 *
 * Structure:
 *
 *   [per-source] → gain → filters(hp → lp → bp) → analyser → masterGain → destination
 *
 * Multiple bus gains (sfx, ambience, tapeOut) attach to the masterGain,
 * so the player's settings-menu sliders can mix independently.
 *
 * All nodes live for the lifetime of the game; we mutate parameters rather
 * than tearing down / rebuilding the graph, which avoids glitches.
 */

import { Config } from '../../app/config';
import { Events } from '../../core/Events';
import { clamp } from '../../core/Math';

export interface FilterState {
  lowpass: number;   // Hz  (20000 = off)
  highpass: number;  // Hz  (20 = off)
  bandpass: number;  // Hz
  q: number;         // resonance (0.5..20)
  gain: number;      // linear (0..2)
  bandpassEnabled: boolean;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  lowpass: 20000,
  highpass: 20,
  bandpass: 1000,
  q: 1.0,
  gain: 1.0,
  bandpassEnabled: false,
};

export class AudioGraph {
  readonly ctx: AudioContext;

  // Source bus — tape output lives here
  readonly tapeIn: GainNode;

  // Filter chain (tape path)
  readonly highpass: BiquadFilterNode;
  readonly lowpass: BiquadFilterNode;
  readonly bandpass: BiquadFilterNode;
  readonly bandpassDry: GainNode;  // wet/dry mix when bandpass disabled
  readonly bandpassWet: GainNode;

  // Analyser taps the signal *after* filters so the oscilloscope shows
  // exactly what the player hears — critical for audio puzzles.
  readonly analyser: AnalyserNode;

  readonly tapeOutGain: GainNode;

  // Other buses
  readonly sfxIn: GainNode;
  readonly ambienceIn: GainNode;

  readonly master: GainNode;

  private _filterState: FilterState = { ...DEFAULT_FILTER_STATE };

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = Config.audio.masterStartVolume;
    this.master.connect(ctx.destination);

    this.sfxIn = ctx.createGain();
    this.sfxIn.gain.value = Config.audio.sfxStartVolume;
    this.sfxIn.connect(this.master);

    this.ambienceIn = ctx.createGain();
    this.ambienceIn.gain.value = Config.audio.musicStartVolume;
    this.ambienceIn.connect(this.master);

    // Tape path
    this.tapeIn = ctx.createGain();
    this.tapeIn.gain.value = 1.0;

    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = this._filterState.highpass;
    this.highpass.Q.value = 0.707;

    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = this._filterState.lowpass;
    this.lowpass.Q.value = 0.707;

    this.bandpass = ctx.createBiquadFilter();
    this.bandpass.type = 'bandpass';
    this.bandpass.frequency.value = this._filterState.bandpass;
    this.bandpass.Q.value = this._filterState.q;

    this.bandpassDry = ctx.createGain();
    this.bandpassDry.gain.value = 1.0;
    this.bandpassWet = ctx.createGain();
    this.bandpassWet.gain.value = 0.0;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;

    this.tapeOutGain = ctx.createGain();
    this.tapeOutGain.gain.value = 1.0;

    // Routing: tapeIn → hp → lp
    // Then split: lp → bandpassDry → analyser
    //        and lp → bandpass → bandpassWet → analyser
    this.tapeIn.connect(this.highpass);
    this.highpass.connect(this.lowpass);

    this.lowpass.connect(this.bandpassDry);
    this.lowpass.connect(this.bandpass);
    this.bandpass.connect(this.bandpassWet);

    this.bandpassDry.connect(this.analyser);
    this.bandpassWet.connect(this.analyser);

    this.analyser.connect(this.tapeOutGain);
    this.tapeOutGain.connect(this.master);
  }

  get filterState(): Readonly<FilterState> { return this._filterState; }

  setFilters(patch: Partial<FilterState>): void {
    const s = { ...this._filterState, ...patch };
    s.lowpass  = clamp(s.lowpass, 60, 20000);
    s.highpass = clamp(s.highpass, 20, 12000);
    s.bandpass = clamp(s.bandpass, 120, 8000);
    s.q        = clamp(s.q, 0.3, 18);
    s.gain     = clamp(s.gain, 0, 2);
    this._filterState = s;

    const t = this.ctx.currentTime;
    const ramp = 0.02;
    this.lowpass.frequency.setTargetAtTime(s.lowpass,  t, ramp);
    this.highpass.frequency.setTargetAtTime(s.highpass, t, ramp);
    this.bandpass.frequency.setTargetAtTime(s.bandpass, t, ramp);
    this.bandpass.Q.setTargetAtTime(s.q, t, ramp);
    this.tapeOutGain.gain.setTargetAtTime(s.gain, t, ramp);

    if (s.bandpassEnabled) {
      this.bandpassWet.gain.setTargetAtTime(1.0, t, 0.04);
      this.bandpassDry.gain.setTargetAtTime(0.0, t, 0.04);
    } else {
      this.bandpassWet.gain.setTargetAtTime(0.0, t, 0.04);
      this.bandpassDry.gain.setTargetAtTime(1.0, t, 0.04);
    }

    Events.emit('audio:filtersChanged', { ...s });
  }

  setMasterVolume(v: number): void { this.master.gain.setTargetAtTime(clamp(v, 0, 1), this.ctx.currentTime, 0.03); }
  setSfxVolume(v: number): void    { this.sfxIn.gain.setTargetAtTime(clamp(v, 0, 1), this.ctx.currentTime, 0.03); }
  setMusicVolume(v: number): void  { this.ambienceIn.gain.setTargetAtTime(clamp(v, 0, 1), this.ctx.currentTime, 0.03); }
}
