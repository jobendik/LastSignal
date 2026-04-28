import { Config } from '../../app/config';
import { RNG } from '../../core/RNG';
import type { TapeAudioSpec } from '../../core/Types';

/**
 * Procedural generator for tape audio. Produces mono AudioBuffers whose
 * content encodes puzzle clues audibly & visually.
 *
 * The generator is DETERMINISTIC: given the same spec+seed it renders
 * identical waveforms. This keeps "the answer" stable across sessions.
 *
 * Layers:
 *  - noise bed            (always)
 *  - tape hiss            (always)
 *  - muffled "voice" tone (simulates speech cadence via modulated sines)
 *  - puzzle-specific payload per spec.kind
 *
 * NOTE: No real voice recording is included (per copyright guidance). The
 * "voice" layer is a modulated sine cluster that *sounds like* speech
 * cadence and sits in a telephone-band frequency region, so filters behave
 * meaningfully against it.
 */
export class ProceduralTapeGenerator {
  constructor(private readonly ctx: AudioContext) {}

  generate(spec: TapeAudioSpec): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const duration = Config.audio.procTapeDurationSec;
    const length = Math.floor(sr * duration);
    const buffer = this.ctx.createBuffer(1, length, sr);
    const data = buffer.getChannelData(0);
    const rng = new RNG(spec.seed);

    // --- noise bed -------------------------------------------------------
    const noiseAmp = spec.baseNoise;
    for (let i = 0; i < length; i++) {
      data[i] = (rng.next() * 2 - 1) * noiseAmp * 0.35;
    }

    // --- high-freq tape hiss --------------------------------------------
    // A rolling random with simple emphasis on high band
    let prev = 0;
    for (let i = 0; i < length; i++) {
      const n = (rng.next() * 2 - 1);
      const high = n - prev;
      prev = n;
      data[i] += high * 0.05;
    }

    // --- simulated speech cadence ("voice" layer) -----------------------
    // A cluster of amplitude-modulated sines around 600-1800 Hz,
    // gated by a slow 2-5 Hz envelope to suggest syllables.
    this.addSpeechLayer(data, sr, rng);

    // --- puzzle payload --------------------------------------------------
    switch (spec.kind) {
      case 'pulses':
        this.addPulseGroup(data, sr, spec.pulseCount ?? 3);
        break;
      case 'reversed':
        this.addReversedCountdown(data, sr, spec.reversedDigit ?? 0);
        break;
      case 'tones':
        this.addToneBursts(data, sr, spec.hiddenFrequencyHz ?? 2400);
        break;
    }

    // Light tape-wow modulation across the whole buffer to feel analog
    this.applyWow(data, sr);

    // Normalize peaks to ~ -3dB
    this.softNormalize(data, 0.7);

    return buffer;
  }

  private addSpeechLayer(data: Float32Array, sr: number, rng: RNG): void {
    // Two sine carriers + slow envelope. Voice-like in perception, but
    // intelligible only when bandlimited to mid-band and lightly lowpassed.
    const f1 = 700  + rng.range(-60, 60);
    const f2 = 1400 + rng.range(-80, 80);
    const syllRate = 3.3 + rng.range(-0.3, 0.4);
    const wordRate = 0.9;

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      // Syllable envelope (half-wave rectified sine)
      const syl = Math.max(0, Math.sin(2 * Math.PI * syllRate * t));
      // Word envelope — larger pauses
      const word = 0.5 + 0.5 * Math.sin(2 * Math.PI * wordRate * t - 1);
      const env = Math.pow(syl, 1.4) * word * 0.28;
      // Slight vibrato
      const vib = 1 + 0.012 * Math.sin(2 * Math.PI * 5.5 * t);
      const s = Math.sin(2 * Math.PI * f1 * vib * t) * 0.55
              + Math.sin(2 * Math.PI * f2 * vib * t) * 0.35;
      data[i] += s * env;
    }
  }

  /**
   * Insert a distinct group of N short pulses in the middle section of the
   * tape. The pulse train shows clearly on the oscilloscope and can be
   * counted by ear / eye once the player low-passes the voice layer.
   */
  private addPulseGroup(data: Float32Array, sr: number, count: number): void {
    const startT = 8.0;
    const pulseDur = 0.18;
    const gap = 0.42;
    const pulseFreq = 180; // low enough to survive a lowpass filter
    for (let p = 0; p < count; p++) {
      const t0 = startT + p * (pulseDur + gap);
      const i0 = Math.floor(t0 * sr);
      const n = Math.floor(pulseDur * sr);
      for (let j = 0; j < n; j++) {
        const i = i0 + j;
        if (i >= data.length) break;
        const t = j / sr;
        const env = Math.sin(Math.PI * (j / n)); // smooth bell
        data[i] += Math.sin(2 * Math.PI * pulseFreq * t) * env * 0.65;
      }
    }
  }

  /**
   * Place a reversed "countdown" tone sequence. Playing the tape normally
   * produces an ascending chirp ending at the target digit; playing in
   * REVERSE produces a descending chirp that resolves to the digit's pitch.
   *
   * Digit encoding: base 220 Hz + digit * 45 Hz (so pitch is identifiable
   * once isolated + lightly pitch-shifted, fulfilling the "adjust pitch"
   * design beat).
   */
  private addReversedCountdown(data: Float32Array, sr: number, digit: number): void {
    const startT = 6.0;
    const dur = 10.0;
    const endFreq = 220 + digit * 45;
    const startFreq = endFreq + 300;
    const i0 = Math.floor(startT * sr);
    const n = Math.floor(dur * sr);
    // Write *forward* — but we write the "answer" tone at the END, so that
    // reversed playback reveals it clearly at the beginning of the reverse.
    for (let j = 0; j < n; j++) {
      const i = i0 + j;
      if (i >= data.length) break;
      const t = j / n;
      const f = startFreq + (endFreq - startFreq) * t;
      const env = Math.min(1, t * 2) * Math.min(1, (1 - t) * 3) * 0.4;
      data[i] += Math.sin(2 * Math.PI * f * (j / sr)) * env;
    }
    // Distinct "hit" tone at end (= digit pitch) to help ID
    const hitI = i0 + n - Math.floor(0.6 * sr);
    const hitN = Math.floor(0.5 * sr);
    for (let j = 0; j < hitN; j++) {
      const i = hitI + j;
      if (i >= data.length) break;
      const env = Math.sin(Math.PI * (j / hitN)) * 0.55;
      data[i] += Math.sin(2 * Math.PI * endFreq * (j / sr)) * env;
    }
  }

  /**
   * Embed a small set of tone bursts at a hidden carrier frequency. The
   * bursts are masked under the noise/voice layers and become audible only
   * when the band-pass filter is tuned near the carrier.
   */
  private addToneBursts(data: Float32Array, sr: number, freq: number): void {
    const starts = [4.0, 9.5, 15.0, 20.5];
    const dur = 1.1;
    for (const s of starts) {
      const i0 = Math.floor(s * sr);
      const n = Math.floor(dur * sr);
      for (let j = 0; j < n; j++) {
        const i = i0 + j;
        if (i >= data.length) break;
        const env = Math.sin(Math.PI * (j / n)) ** 2 * 0.32;
        data[i] += Math.sin(2 * Math.PI * freq * (j / sr)) * env;
      }
    }
  }

  private applyWow(data: Float32Array, sr: number): void {
    // Subtle amplitude modulation (we don't want to displace samples - that
    // would require resampling). Gives a gentle "analog" feel.
    const rate = 0.45;
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const m = 1 + 0.02 * Math.sin(2 * Math.PI * rate * t);
      data[i] *= m;
    }
  }

  private softNormalize(data: Float32Array, target: number): void {
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]!);
      if (a > peak) peak = a;
    }
    if (peak < 1e-5) return;
    const g = target / peak;
    if (g >= 1) return;
    for (let i = 0; i < data.length; i++) data[i]! *= g;
  }

  /** Creates a "final tape" — unsettling, sparse, with a reveal tone. */
  generateFinalTape(): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const duration = 18;
    const buffer = this.ctx.createBuffer(1, Math.floor(sr * duration), sr);
    const data = buffer.getChannelData(0);
    const rng = new RNG(0xBAD510);
    // Dense noise bed
    for (let i = 0; i < data.length; i++) data[i] = (rng.next() * 2 - 1) * 0.18;
    // Sparse low rumble
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      data[i] += Math.sin(2 * Math.PI * 45 * t) * 0.15 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.15 * t));
    }
    // "Knocking" pulse sequence (Morse-ish) in the middle
    const knockT = [4.0, 4.4, 5.0, 6.1, 6.4, 7.2];
    for (const t0 of knockT) {
      const i0 = Math.floor(t0 * sr);
      const n = Math.floor(0.12 * sr);
      for (let j = 0; j < n; j++) {
        const i = i0 + j;
        if (i >= data.length) break;
        const env = Math.sin(Math.PI * (j / n));
        data[i] += Math.sin(2 * Math.PI * 120 * (j / sr)) * env * 0.55;
      }
    }
    // Final reveal tone — clean, sustained, rising — that the oscilloscope
    // will clearly trace even through noise.
    const revStart = 11.5;
    const revDur = 5.5;
    const i0 = Math.floor(revStart * sr);
    const n = Math.floor(revDur * sr);
    for (let j = 0; j < n; j++) {
      const i = i0 + j;
      if (i >= data.length) break;
      const t = j / n;
      const f = 180 + t * 260;
      const env = Math.min(1, t * 4) * Math.min(1, (1 - t) * 2) * 0.4;
      data[i] += Math.sin(2 * Math.PI * f * (j / sr)) * env;
    }
    this.softNormalize(data, 0.75);
    return buffer;
  }
}
