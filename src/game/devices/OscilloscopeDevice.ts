import * as THREE from 'three';
import type { AudioAnalyzer } from '../audio/AudioAnalyzer';
import type { FilterState } from '../audio/AudioGraph';
import type { OscilloscopeBuild } from '../../scene/PlaceholderModelFactory';

/**
 * OscilloscopeDevice — renders a CRT-styled waveform + frequency display
 * onto the canvas texture of the oscilloscope mesh. The screen reacts in
 * real time to the post-filter analyser, so the signal the player hears
 * and the signal they see are the same.
 *
 * The display includes:
 *  - phosphor-green waveform line w/ after-glow
 *  - scanlines + flicker
 *  - frequency spectrum strip at the bottom
 *  - band-pass lock-on indicator (green when tuned within tolerance)
 *  - signal-strength meter (RMS)
 *  - when the final tape is playing, a subtle "impossible waveform"
 *    glyph is overlaid by `markFinalReveal()`
 */
export class OscilloscopeDevice {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly w: number;
  private readonly h: number;
  private flicker = 0;
  private time = 0;
  private lockTargetHz: number | null = null;
  private lockToleranceHz = 220;
  private finalReveal = false;
  private filters: FilterState | null = null;

  constructor(
    private readonly build: OscilloscopeBuild,
    private readonly analyzer: AudioAnalyzer,
    _sampleRate: number,
  ) {
    const c = build.canvas.getContext('2d');
    if (!c) throw new Error('OscilloscopeDevice: canvas 2D context unavailable');
    this.ctx = c;
    this.w = build.canvas.width;
    this.h = build.canvas.height;
    this.drawIdle();
  }

  /** Caller tells us the active filter state so we can show lock/meter cues. */
  setFilterState(fs: FilterState): void { this.filters = fs; }

  /** Enable visual lock indicator for band-pass target (tape C). */
  setLockTarget(hz: number | null, tolerance = 220): void {
    this.lockTargetHz = hz;
    this.lockToleranceHz = tolerance;
  }

  markFinalReveal(flag: boolean): void { this.finalReveal = flag; }

  mesh(): THREE.Mesh { return this.build.screen; }

  update(dt: number): void {
    this.time += dt;
    this.flicker = 0.92 + Math.random() * 0.08;

    const c = this.ctx;
    const w = this.w, h = this.h;

    // Background
    c.fillStyle = '#020504';
    c.fillRect(0, 0, w, h);

    // Phosphor background gradient
    const grad = c.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.6);
    grad.addColorStop(0, 'rgba(20,45,30,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);

    // Grid
    c.strokeStyle = 'rgba(60,200,110,0.12)';
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= w; x += w / 16) { c.moveTo(x, 0); c.lineTo(x, h); }
    for (let y = 0; y <= h; y += h / 10) { c.moveTo(0, y); c.lineTo(w, y); }
    c.stroke();

    // Center axis
    c.strokeStyle = 'rgba(60,200,110,0.25)';
    c.beginPath();
    c.moveTo(0, h * 0.45);
    c.lineTo(w, h * 0.45);
    c.stroke();

    // --- waveform ---
    const timeData = this.analyzer.timeDomain;
    c.strokeStyle = `rgba(59,224,138,${0.95 * this.flicker})`;
    c.shadowColor = 'rgba(59,224,138,0.7)';
    c.shadowBlur = 10;
    c.lineWidth = 2;
    c.beginPath();
    const n = timeData.length;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = h * 0.45 - timeData[i]! * h * 0.35;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    c.shadowBlur = 0;

    // Ghost trace (after-glow): translucent redraw offset
    c.strokeStyle = 'rgba(59,224,138,0.18)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = h * 0.45 - timeData[i]! * h * 0.33 + 2;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();

    // --- spectrum strip (bottom) ---
    const freq = this.analyzer.frequencyDomain;
    const barCount = 64;
    const stripTop = h * 0.78;
    const stripH = h * 0.18;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(0, stripTop, w, stripH);
    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor((i / barCount) * freq.length * 0.6);
      const v = (freq[idx] ?? 0) / 255;
      const barW = w / barCount - 2;
      const bh = v * stripH;
      c.fillStyle = `rgba(59,224,138,${0.25 + v * 0.65})`;
      c.fillRect(i * (w / barCount) + 1, stripTop + stripH - bh, barW, bh);
    }

    // --- band-pass lock indicator ---
    if (this.lockTargetHz && this.filters && this.filters.bandpassEnabled) {
      const off = Math.abs(this.filters.bandpass - this.lockTargetHz);
      const locked = off < this.lockToleranceHz;
      const x = w - 70, y = 14;
      c.strokeStyle = locked ? '#3be08a' : 'rgba(228,220,193,0.35)';
      c.lineWidth = 1;
      c.strokeRect(x, y, 56, 16);
      c.fillStyle = locked ? '#3be08a' : 'rgba(228,220,193,0.35)';
      c.font = '10px monospace';
      c.fillText(locked ? 'LOCK OK' : 'SEARCH', x + 6, y + 12);
      // Hidden symbol revealed when locked
      if (locked) {
        c.save();
        c.fillStyle = 'rgba(59,224,138,0.9)';
        c.font = 'bold 62px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.shadowColor = 'rgba(59,224,138,0.6)';
        c.shadowBlur = 12;
        // The hidden symbol is the digit encoded by Tape C — we derive it
        // via the target HZ → the config is baked into the lockTarget call
        c.fillText(this.lockDigit, w * 0.5, h * 0.4);
        c.restore();
      }
    }

    // --- signal strength meter (top-left) ---
    const rms = this.analyzer.rms();
    const meterX = 14, meterY = 14, meterW = 100, meterH = 8;
    c.strokeStyle = 'rgba(228,220,193,0.35)';
    c.strokeRect(meterX, meterY, meterW, meterH);
    c.fillStyle = '#3be08a';
    c.fillRect(meterX + 1, meterY + 1, Math.min(1, rms * 4) * (meterW - 2), meterH - 2);
    c.fillStyle = 'rgba(228,220,193,0.6)';
    c.font = '9px monospace';
    c.fillText('SIG', meterX, meterY + 20);

    // --- scanlines ---
    c.fillStyle = 'rgba(0,0,0,0.14)';
    for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);

    // --- flicker / noise ---
    if (Math.random() < 0.04) {
      c.fillStyle = 'rgba(255,255,255,0.05)';
      c.fillRect(0, Math.random() * h, w, 2);
    }

    // --- final reveal overlay ---
    if (this.finalReveal) {
      c.save();
      c.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 2.5);
      c.strokeStyle = '#3be08a';
      c.lineWidth = 1.5;
      c.beginPath();
      // Impossible Lissajous-style spiral
      const steps = 220;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const r = 20 + t * (Math.min(w, h) * 0.35) * (0.8 + 0.2 * Math.sin(this.time + t * 14));
        const a = t * Math.PI * 10 + this.time * 0.7;
        const x = w * 0.5 + Math.cos(a) * r;
        const y = h * 0.45 + Math.sin(a * 1.07) * r * 0.6;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      c.restore();
    }

    this.build.texture.needsUpdate = true;
  }

  /** Idle frame used before audio has started. */
  drawIdle(): void {
    const c = this.ctx;
    c.fillStyle = '#020504';
    c.fillRect(0, 0, this.w, this.h);
    c.fillStyle = 'rgba(60,200,110,0.35)';
    c.font = '14px monospace';
    c.fillText('— STANDBY —', 10, this.h * 0.5);
    this.build.texture.needsUpdate = true;
  }

  // Digit hint displayed when locked — set by the scene.
  lockDigit = '';
}
