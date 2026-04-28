/**
 * AudioAnalyzer — thin wrapper around AnalyserNode providing cached
 * Float32 time-domain and Uint8 frequency-domain buffers for the
 * oscilloscope/waveform renderer. Works with the AudioGraph's single
 * shared AnalyserNode (post-filter) so visuals match the audible signal.
 */
export class AudioAnalyzer {
  readonly node: AnalyserNode;
  private readonly _time: Float32Array;
  private readonly _freq: Uint8Array;

  constructor(node: AnalyserNode) {
    this.node = node;
    this._time = new Float32Array(new ArrayBuffer(node.fftSize * 4));
    this._freq = new Uint8Array(new ArrayBuffer(node.frequencyBinCount));
  }

  get timeDomain(): Float32Array {
    this.node.getFloatTimeDomainData(this._time as unknown as Float32Array<ArrayBuffer>);
    return this._time;
  }

  get frequencyDomain(): Uint8Array {
    this.node.getByteFrequencyData(this._freq as unknown as Uint8Array<ArrayBuffer>);
    return this._freq;
  }

  /** Average RMS level (0..~1) — used for signal strength meters. */
  rms(): number {
    const d = this.timeDomain;
    let s = 0;
    for (let i = 0; i < d.length; i++) s += d[i]! * d[i]!;
    return Math.sqrt(s / d.length);
  }

  /** Index of the strongest frequency bin (for clue detection). */
  peakBin(): number {
    const d = this.frequencyDomain;
    let best = 0, bestIdx = 0;
    for (let i = 0; i < d.length; i++) {
      if (d[i]! > best) { best = d[i]!; bestIdx = i; }
    }
    return bestIdx;
  }

  /** Convert bin index to Hz for a given sample rate. */
  binToHz(bin: number, sampleRate: number): number {
    return (bin * sampleRate) / this.node.fftSize;
  }
}
