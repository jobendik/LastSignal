import { Events } from '../../core/Events';
import { clamp } from '../../core/Math';
import type { TapeDefinition } from '../../core/Types';
import type { AudioGraph } from './AudioGraph';

/**
 * TapeDeckController — manages a single inserted tape's playback on top of
 * the AudioGraph.
 *
 * We recreate AudioBufferSourceNode on every play/scrub because buffer sources
 * are one-shot nodes in Web Audio. Reverse mode plays a reversed copy of the
 * buffer while the UI playhead still moves forward from 0→duration; that makes
 * the puzzle interaction intuitive: insert tape B, press REV, press Play.
 */
export class TapeDeckController {
  private inserted: { def: TapeDefinition; buffer: AudioBuffer; reversedBuffer: AudioBuffer } | null = null;
  private source: AudioBufferSourceNode | null = null;
  private positionSec = 0;          // current UI playhead in seconds
  private lastStartCtxTime = 0;     // ctx.currentTime when current source started
  private _playing = false;
  private _rate = 1.0;
  private _reversed = false;

  /** Raised by the render loop via tick() to publish progress updates. */
  private lastPublishedTime = -1;

  constructor(private readonly graph: AudioGraph) {}

  // ---------- public state getters ----------
  get isPlaying(): boolean { return this._playing; }
  get rate():      number  { return this._rate; }
  get reversed():  boolean { return this._reversed; }
  get insertedTapeId(): string | null { return this.inserted?.def.id ?? null; }
  get currentTape(): TapeDefinition | null { return this.inserted?.def ?? null; }
  get time(): number       { return this.computeTime(); }
  get duration(): number   { return this.inserted?.def.duration ?? 0; }

  // ---------- insertion ----------
  insert(def: TapeDefinition, buffer: AudioBuffer): void {
    this.eject();
    const reversedBuffer = this.makeReversed(buffer);
    this.inserted = { def, buffer, reversedBuffer };
    this.positionSec = 0;
    this._reversed = false;
    this._rate = 1.0;
    Events.emit('tape:inserted', { tapeId: def.id });
    this.emitPlayState();
    this.publishTime(true);
  }

  eject(): string | null {
    this.stop();
    const id = this.inserted?.def.id ?? null;
    this.inserted = null;
    if (id) Events.emit('tape:ejected', { tapeId: id });
    return id;
  }

  // ---------- transport ----------
  play(): void {
    if (!this.inserted || this._playing) return;
    if (this.positionSec >= this.inserted.def.duration - 0.02) {
      this.positionSec = 0;
    }
    this.spawnSource();
    this._playing = true;
    this.emitPlayState();
    this.publishTime(true);
  }

  pause(): void {
    if (!this._playing) return;
    this.positionSec = this.computeTime();
    this.killSource();
    this._playing = false;
    this.emitPlayState();
    this.publishTime(true);
  }

  stop(): void {
    const wasPlaying = this._playing;
    this.killSource();
    this.positionSec = 0;
    this._playing = false;
    if (wasPlaying || this.inserted) this.emitPlayState();
    this.publishTime(true);
  }

  seek(sec: number): void {
    if (!this.inserted) return;
    const was = this._playing;
    this.killSource();
    this.positionSec = clamp(sec, 0, this.inserted.def.duration);
    this._playing = false;
    if (was) this.play();
    else this.publishTime(true);
  }

  nudge(delta: number): void {
    if (!this.inserted) return;
    this.seek(this.computeTime() + delta);
  }

  setRate(r: number): void {
    this._rate = clamp(r, 0.5, 1.8);
    if (this._playing && this.source) {
      this.source.playbackRate.setTargetAtTime(this._rate, this.graph.ctx.currentTime, 0.05);
    }
    this.emitPlayState();
  }

  setReversed(flag: boolean): void {
    if (this._reversed === flag) return;
    const was = this._playing;
    const t = this.computeTime();
    this.killSource();
    this.positionSec = t;
    this._reversed = flag;
    this._playing = false;
    if (was) this.play();
    else {
      this.emitPlayState();
      this.publishTime(true);
    }
  }

  /** Restore a saved tape position (without auto-play). */
  restorePosition(sec: number): void {
    if (!this.inserted) return;
    this.positionSec = clamp(sec, 0, this.inserted.def.duration);
    this.publishTime(true);
  }

  // ---------- frame tick ----------
  /**
   * Called every frame; handles auto-stop at end of tape and periodic
   * 'tape:timeChanged' events (~ every 100ms).
   */
  tick(): void {
    if (!this.inserted) return;
    const t = this.computeTime();
    if (this._playing && t >= this.inserted.def.duration - 0.02) {
      this.finishPlayback();
      return;
    }
    if (Math.abs(t - this.lastPublishedTime) >= 0.1) {
      this.publishTime(false);
    }
  }

  // ---------- internals ----------
  private spawnSource(): void {
    if (!this.inserted) return;
    const { buffer, reversedBuffer } = this.inserted;
    const src = this.graph.ctx.createBufferSource();
    src.buffer = this._reversed ? reversedBuffer : buffer;
    src.loop = false;
    src.playbackRate.value = this._rate;
    src.connect(this.graph.tapeIn);

    const offset = clamp(this.positionSec, 0, Math.max(0, this.inserted.def.duration - 0.001));
    src.start(0, offset);
    this.source = src;
    this.lastStartCtxTime = this.graph.ctx.currentTime;

    src.onended = () => {
      if (this.source === src && this._playing) this.finishPlayback();
    };
  }

  private killSource(): void {
    if (this.source) {
      try { this.source.onended = null; this.source.stop(); } catch { /* already stopped */ }
      try { this.source.disconnect(); } catch { /* ignore */ }
      this.source = null;
    }
  }

  private finishPlayback(): void {
    if (!this.inserted) return;
    const duration = this.inserted.def.duration;
    this.killSource();
    this.positionSec = duration;
    this._playing = false;
    this.emitPlayState();
    this.publishTime(true);
  }

  private computeTime(): number {
    if (!this.inserted) return 0;
    if (!this._playing) return this.positionSec;
    const elapsed = (this.graph.ctx.currentTime - this.lastStartCtxTime) * this._rate;
    return clamp(this.positionSec + elapsed, 0, this.inserted.def.duration);
  }

  private publishTime(force: boolean): void {
    const t = this.computeTime();
    if (!force && Math.abs(t - this.lastPublishedTime) < 0.05) return;
    this.lastPublishedTime = t;
    Events.emit('tape:timeChanged', { time: t, duration: this.duration });
  }

  private emitPlayState(): void {
    Events.emit('tape:playStateChanged', { playing: this._playing, rate: this._rate, reversed: this._reversed });
  }

  private makeReversed(src: AudioBuffer): AudioBuffer {
    const out = this.graph.ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
    for (let ch = 0; ch < src.numberOfChannels; ch++) {
      const a = src.getChannelData(ch);
      const b = out.getChannelData(ch);
      const n = a.length;
      for (let i = 0; i < n; i++) b[i] = a[n - 1 - i]!;
    }
    return out;
  }
}
