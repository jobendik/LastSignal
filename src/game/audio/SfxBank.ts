import { clamp } from '../../core/Math';

/**
 * SfxBank — procedurally generates short UI/device SFX on demand, using
 * only Web Audio API oscillators + noise. This keeps the prototype fully
 * audible without any binary audio files.
 *
 * Every SFX is routed through the AudioGraph's sfxIn gain so the settings
 * menu's SFX slider works uniformly.
 */
export class SfxBank {
  constructor(private readonly ctx: AudioContext, private readonly destination: AudioNode) {}

  button(): void   { this.clickLike(0.035, 1800, 0.45); }
  heavyButton(): void { this.clickLike(0.06, 900, 0.7); }
  knob(): void     { this.clickLike(0.02, 2800, 0.25); }
  insert(): void   { this.thunk(0.08, 150); this.clickLike(0.04, 600, 0.4, 0.08); }
  eject(): void    { this.clickLike(0.05, 500, 0.4); this.thunk(0.1, 100, 0.09); }
  drawerUnlock(): void { this.thunk(0.18, 110, 0); this.clickLike(0.06, 1200, 0.5, 0.08); }
  wrong(): void    { this.beep(120, 0.22, 'square', 0.35); this.beep(110, 0.25, 'square', 0.36, 0.07); }
  right(): void    { this.beep(660, 0.1, 'sine', 0.3); this.beep(990, 0.16, 'sine', 0.3, 0.08); }
  clue(): void     { this.beep(1200, 0.08, 'sine', 0.22); this.beep(1800, 0.12, 'sine', 0.2, 0.05); }
  stinger(): void  {
    // Low, slow swell — used for reveal moments
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(this.destination);
    const now = this.ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.5, now + 0.3);
    g.gain.linearRampToValueAtTime(0.0, now + 2.5);
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine';     o2.frequency.value = 120;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';  f.frequency.value = 400;
    o1.connect(f); o2.connect(f); f.connect(g);
    o1.start(now); o2.start(now); o1.stop(now + 2.6); o2.stop(now + 2.6);
  }

  private beep(freq: number, dur: number, type: OscillatorType, gain = 0.3, delay = 0): void {
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(this.destination);
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    o.connect(g);
    const now = this.ctx.currentTime + delay;
    g.gain.linearRampToValueAtTime(clamp(gain, 0, 1), now + 0.005);
    g.gain.linearRampToValueAtTime(0, now + dur);
    o.start(now); o.stop(now + dur + 0.02);
  }

  /** Short broadband click with a spiky envelope (noise burst + oscillator). */
  private clickLike(dur: number, freq: number, gain: number, delay = 0): void {
    const now = this.ctx.currentTime + delay;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(this.destination);

    // Oscillator ping
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.4), now + dur);
    o.connect(g);

    // Noise burst
    const nBuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const nd = nBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 2);
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = nBuf;
    const nG = this.ctx.createGain(); nG.gain.value = 0.5;
    nSrc.connect(nG); nG.connect(g);

    g.gain.linearRampToValueAtTime(gain, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    o.start(now); o.stop(now + dur + 0.01);
    nSrc.start(now);
  }

  /** Low thunk (for drawer/cassette). */
  private thunk(dur: number, freq: number, delay = 0): void {
    const now = this.ctx.currentTime + delay;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(this.destination);

    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.6, now);
    o.frequency.exponentialRampToValueAtTime(freq, now + dur);
    o.connect(g);

    g.gain.linearRampToValueAtTime(0.55, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur + 0.02);
  }
}

/**
 * Ambience — long looping noise beds & low hum. Always on while the
 * investigation scene is active. Individual layers are exposed so events
 * can swell them (e.g., during the ending).
 */
export class AmbienceBed {
  private nodes: { stop: () => void }[] = [];

  constructor(private readonly ctx: AudioContext, private readonly destination: AudioNode) {}

  start(): void {
    if (this.nodes.length > 0) return;

    // Room tone: filtered pink-ish noise at low volume
    const noiseBuf = this.makeNoiseBuffer(2.5);
    const roomSrc = this.ctx.createBufferSource();
    roomSrc.buffer = noiseBuf;
    roomSrc.loop = true;
    const roomFilter = this.ctx.createBiquadFilter();
    roomFilter.type = 'lowpass'; roomFilter.frequency.value = 900;
    const roomGain = this.ctx.createGain(); roomGain.gain.value = 0.08;
    roomSrc.connect(roomFilter); roomFilter.connect(roomGain); roomGain.connect(this.destination);
    roomSrc.start();
    this.nodes.push({ stop: () => { try { roomSrc.stop(); roomSrc.disconnect(); } catch { /* */ } } });

    // Low electrical hum (50/100 Hz)
    const humOsc1 = this.ctx.createOscillator(); humOsc1.type = 'sine'; humOsc1.frequency.value = 50;
    const humOsc2 = this.ctx.createOscillator(); humOsc2.type = 'sine'; humOsc2.frequency.value = 100;
    const humGain = this.ctx.createGain(); humGain.gain.value = 0.04;
    humOsc1.connect(humGain); humOsc2.connect(humGain); humGain.connect(this.destination);
    humOsc1.start(); humOsc2.start();
    this.nodes.push({ stop: () => {
      try { humOsc1.stop(); humOsc2.stop(); humOsc1.disconnect(); humOsc2.disconnect(); } catch { /* */ }
    }});

  }

  stop(): void {
    for (const n of this.nodes) n.stop();
    this.nodes = [];
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    // Simple "brown-ish" noise (integrated white)
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) * 0.995;
      d[i] = last * 3;
    }
    return buf;
  }
}
