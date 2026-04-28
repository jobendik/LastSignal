import { Config } from '../app/config';
import type { TapeDefinition } from '../core/Types';
import { AudioGraph } from '../game/audio/AudioGraph';
import { AudioAnalyzer } from '../game/audio/AudioAnalyzer';
import { TapeDeckController } from '../game/audio/TapeDeckController';
import { ProceduralTapeGenerator } from '../game/audio/ProceduralTapeGenerator';
import { SfxBank, AmbienceBed } from '../game/audio/SfxBank';
import { Logger } from '../core/Logger';

/**
 * AudioManager — the public facade over the audio subsystem.
 *
 * Web Audio has a "user-gesture required" unlock step on most browsers, so
 * this manager is instantiated lazily on the first user interaction and
 * exposes an `unlock()` guard used by the game boot.
 */
export class AudioManager {
  private ctxInternal: AudioContext | null = null;
  private graphInternal: AudioGraph | null = null;
  private deckInternal: TapeDeckController | null = null;
  private analyzerInternal: AudioAnalyzer | null = null;
  private sfxInternal: SfxBank | null = null;
  private ambienceInternal: AmbienceBed | null = null;
  private generatorInternal: ProceduralTapeGenerator | null = null;

  private readonly tapeBuffers = new Map<string, AudioBuffer>();

  get isReady(): boolean { return this.ctxInternal !== null; }
  get ctx(): AudioContext { this.assert(); return this.ctxInternal!; }
  get graph(): AudioGraph { this.assert(); return this.graphInternal!; }
  get deck(): TapeDeckController { this.assert(); return this.deckInternal!; }
  get analyzer(): AudioAnalyzer { this.assert(); return this.analyzerInternal!; }
  get sfx(): SfxBank { this.assert(); return this.sfxInternal!; }
  get ambience(): AmbienceBed { this.assert(); return this.ambienceInternal!; }
  get generator(): ProceduralTapeGenerator { this.assert(); return this.generatorInternal!; }

  /** Lazy initialisation triggered by a user gesture. Safe to call repeatedly. */
  async unlock(): Promise<void> {
    if (this.ctxInternal) {
      if (this.ctxInternal.state === 'suspended') {
        try { await this.ctxInternal.resume(); } catch (err) { Logger.warn('AudioManager', 'resume failed', err); }
      }
      return;
    }
    try {
      const AnyAudioCtx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new AnyAudioCtx({ sampleRate: Config.audio.sampleRate });
      this.ctxInternal = ctx;
      this.graphInternal = new AudioGraph(ctx);
      this.analyzerInternal = new AudioAnalyzer(this.graphInternal.analyser);
      this.deckInternal = new TapeDeckController(this.graphInternal);
      this.generatorInternal = new ProceduralTapeGenerator(ctx);
      this.sfxInternal = new SfxBank(ctx, this.graphInternal.sfxIn);
      this.ambienceInternal = new AmbienceBed(ctx, this.graphInternal.ambienceIn);
      if (ctx.state === 'suspended') await ctx.resume();
    } catch (err) {
      Logger.error('AudioManager', 'failed to initialise audio', err);
      throw err;
    }
  }

  /** Pre-generate procedural audio buffers for all known tapes. */
  ensureTapeBuffer(def: TapeDefinition, finalTape = false): AudioBuffer {
    const cached = this.tapeBuffers.get(def.id);
    if (cached) return cached;
    const buf = finalTape ? this.generator.generateFinalTape() : this.generator.generate(def.spec);
    this.tapeBuffers.set(def.id, buf);
    return buf;
  }

  /** Convenience to insert a tape with its procedural buffer. */
  insertTape(def: TapeDefinition, finalTape = false): void {
    const buf = this.ensureTapeBuffer(def, finalTape);
    this.deck.insert(def, buf);
  }

  private assert(): void {
    if (!this.ctxInternal) throw new Error('AudioManager: not unlocked yet (awaits user gesture)');
  }
}
