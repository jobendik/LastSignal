import type { GameSettings } from "../core/Types";

/**
 * Procedural Web Audio system. Must be unlocked on first user gesture
 * (browsers block AudioContext creation until then).
 */
export class AudioSystem {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  bgmOsc: OscillatorNode | null = null;
  initialized = false;
  muted = false;
  private settings: GameSettings | null = null;

  init(): void {
    if (this.initialized) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.master.gain.value = 0.8;
      this.musicGain.gain.value = 0.25;
      this.sfxGain.gain.value = 0.7;
      this.initialized = true;
      if (this.settings) this.applySettings(this.settings);
    } catch (err) {
      console.warn("[audio] init failed", err);
    }
  }

  applySettings(s: GameSettings): void {
    this.settings = s;
    if (!this.initialized || !this.master || !this.musicGain || !this.sfxGain) return;
    const effMaster = s.muted ? 0 : s.masterVolume;
    this.master.gain.value = effMaster;
    this.musicGain.gain.value = s.musicVolume;
    this.sfxGain.gain.value = s.sfxVolume;
  }

  resume(): void {
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume();
    }
  }

  startMusic(): void {
    if (!this.initialized || !this.ctx || !this.musicGain || this.bgmOsc) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 55;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 260;
    filter.Q.value = 3;
    const g = ctx.createGain();
    g.gain.value = 0.55;
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    osc.start();
    lfo.start();
    this.bgmOsc = osc;
  }

  stopMusic(): void {
    if (this.bgmOsc) {
      try {
        this.bgmOsc.stop();
      } catch {
        /* ignore */
      }
      this.bgmOsc = null;
    }
  }

  // ---- SFX: per-tower procedural sounds ----

  sfxTowerFire(type: string): void {
    switch (type) {
      case "tesla":    this.sfxTesla(); break;
      case "railgun":  this.sfxRailgun(); break;
      case "mortar":   this.sfxMortar(); break;
      case "flamer":   this.sfxFlamer(); break;
      case "stasis":   this.sfxStasis(); break;
      case "blaster":  this.sfxShoot(1.35, 0.14); break;
      case "barrier":  break; // barrier is silent on pulse
      default:         this.sfxShoot(1, 0.17); break;
    }
  }

  sfxTesla(): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    // Sharp electric crack: burst of noise + high-pitch oscillator.
    const bufSize = Math.max(1, Math.floor(this.ctx!.sampleRate * 0.05));
    const buf = this.ctx!.createBuffer(1, bufSize, this.ctx!.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const noise = this.ctx!.createBufferSource();
    noise.buffer = buf;
    const flt = this.ctx!.createBiquadFilter();
    flt.type = "bandpass";
    flt.frequency.value = 3200;
    flt.Q.value = 1.2;
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    noise.connect(flt); flt.connect(gain); gain.connect(this.sfxGain!);
    noise.start(now);
    // Add a sharp high ping.
    const osc = this.ctx!.createOscillator();
    const og = this.ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.07);
    og.gain.setValueAtTime(0.18, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(og); og.connect(this.sfxGain!);
    osc.start(now); osc.stop(now + 0.09);
  }

  sfxRailgun(): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    // Deep crack + high snap.
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain); gain.connect(this.sfxGain!);
    osc.start(now); osc.stop(now + 0.24);
    // High transient click for snap.
    const osc2 = this.ctx!.createOscillator();
    const g2 = this.ctx!.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(1800, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.04);
    g2.gain.setValueAtTime(0.3, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc2.connect(g2); g2.connect(this.sfxGain!);
    osc2.start(now); osc2.stop(now + 0.06);
  }

  sfxMortar(): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    // Deep low-frequency thump.
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.28);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain); gain.connect(this.sfxGain!);
    osc.start(now); osc.stop(now + 0.32);
  }

  sfxFlamer(): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    // Hissing roar: filtered noise with low-pass sweep.
    const bufSize = Math.max(1, Math.floor(this.ctx!.sampleRate * 0.12));
    const buf = this.ctx!.createBuffer(1, bufSize, this.ctx!.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const noise = this.ctx!.createBufferSource();
    noise.buffer = buf;
    const flt = this.ctx!.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.setValueAtTime(800, now);
    flt.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    noise.connect(flt); flt.connect(gain); gain.connect(this.sfxGain!);
    noise.start(now);
  }

  sfxStasis(): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    // Crystalline ascending chime.
    const freqs = [880, 1320, 1760];
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + i * 0.04);
      gain.gain.setValueAtTime(0.1, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.04 + 0.18);
      osc.connect(gain); gain.connect(this.sfxGain!);
      osc.start(now + i * 0.04); osc.stop(now + i * 0.04 + 0.2);
    });
  }

  // ---- SFX: procedural helpers ----

  sfxShoot(pitch = 1, volume = 0.2): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(900 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(200 * pitch, now + 0.06);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  sfxExplosion(volume = 0.4): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    const bufferSize = Math.max(1, Math.floor(this.ctx!.sampleRate * 0.35));
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx!.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + 0.3);
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    noise.start(now);
  }

  sfxDeath(): void {
    this.sfxShoot(0.5, 0.15);
  }

  sfxCoreHit(): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  sfxBuild(): void {
    this.sfxShoot(1.4, 0.15);
  }

  sfxUpgrade(): void {
    this.sfxShoot(1.8, 0.2);
  }

  sfxSell(): void {
    this.sfxShoot(0.7, 0.15);
  }

  sfxWaveStart(): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.35);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  sfxBossAlert(): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now + i * 0.3);
      osc.frequency.exponentialRampToValueAtTime(90, now + i * 0.3 + 0.25);
      gain.gain.setValueAtTime(0.3, now + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.3 + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.3);
      osc.stop(now + i * 0.3 + 0.3);
    }
  }

  sfxReward(): void {
    this.sfxShoot(2.2, 0.22);
  }

  sfxVictory(): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    const freqs = [440, 550, 660, 880];
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, now + i * 0.12);
      gain.gain.setValueAtTime(0.18, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.25);
    });
  }

  sfxLose(): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 1.2);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + 1.4);
  }

  private ready(): boolean {
    return Boolean(this.initialized && this.ctx && this.sfxGain);
  }
}
