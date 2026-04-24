import type { GameSettings } from "../core/Types";

/**
 * Procedural Web Audio system. Must be unlocked on first user gesture
 * (browsers block AudioContext creation until then).
 *
 * All SFX are synthesized in real time; replace with sample playback later
 * when real assets arrive by calling the matching sfxXxx method.
 */
export class AudioSystem {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  bgmNodes: OscillatorNode[] = [];
  initialized = false;
  muted = false;
  private settings: GameSettings | null = null;
  private lastShotAt = 0;
  private musicIntensity = 0; // 0..1, ramps during combat

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

  /** Layered ambient loop: sub-bass + drone + pad. */
  startMusic(): void {
    if (!this.initialized || !this.ctx || !this.musicGain || this.bgmNodes.length > 0) return;
    const ctx = this.ctx;

    // Sub-bass layer.
    const sub = ctx.createOscillator();
    sub.type = "sawtooth";
    sub.frequency.value = 55;
    const subLfo = ctx.createOscillator();
    subLfo.frequency.value = 0.08;
    const subLfoGain = ctx.createGain();
    subLfoGain.gain.value = 4;
    subLfo.connect(subLfoGain);
    subLfoGain.connect(sub.frequency);
    const subFilter = ctx.createBiquadFilter();
    subFilter.type = "lowpass";
    subFilter.frequency.value = 220;
    subFilter.Q.value = 3;
    const subG = ctx.createGain();
    subG.gain.value = 0.5;
    sub.connect(subFilter);
    subFilter.connect(subG);
    subG.connect(this.musicGain);
    sub.start();
    subLfo.start();

    // Pad layer.
    const pad = ctx.createOscillator();
    pad.type = "sine";
    pad.frequency.value = 220;
    const padG = ctx.createGain();
    padG.gain.value = 0.08;
    pad.connect(padG);
    padG.connect(this.musicGain);
    pad.start();

    // Shimmer layer (modulated triangle higher up).
    const shimmer = ctx.createOscillator();
    shimmer.type = "triangle";
    shimmer.frequency.value = 440;
    const shimmerLfo = ctx.createOscillator();
    shimmerLfo.frequency.value = 0.3;
    const shimmerLfoGain = ctx.createGain();
    shimmerLfoGain.gain.value = 8;
    shimmerLfo.connect(shimmerLfoGain);
    shimmerLfoGain.connect(shimmer.frequency);
    const shimmerG = ctx.createGain();
    shimmerG.gain.value = 0.05;
    shimmer.connect(shimmerG);
    shimmerG.connect(this.musicGain);
    shimmer.start();
    shimmerLfo.start();

    this.bgmNodes = [sub, subLfo, pad, shimmer, shimmerLfo];
  }

  stopMusic(): void {
    for (const node of this.bgmNodes) {
      try {
        node.stop();
      } catch {
        /* ignore */
      }
    }
    this.bgmNodes = [];
  }

  // ---- SFX: procedural helpers ----

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    volume = 0.2,
    type: OscillatorType = "square"
  ): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noise(duration: number, volume: number, lpStart: number, lpEnd: number): void {
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    const bufferSize = Math.max(1, Math.floor(this.ctx!.sampleRate * duration));
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx!.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx!.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lpStart, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(10, lpEnd), now + duration);
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    src.start(now);
  }

  /** Tower-specific shoot variants. */
  sfxShoot(pitch = 1, volume = 0.18): void {
    // Throttle if firing very fast to avoid click storm.
    if (!this.ready()) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastShotAt < 0.012) return;
    this.lastShotAt = now;
    this.tone(900 * pitch, 200 * pitch, 0.08, volume, "square");
  }

  sfxTowerFire(kind: string): void {
    switch (kind) {
      case "pulse":
        this.tone(680, 240, 0.08, 0.14, "square");
        break;
      case "blaster":
        this.tone(1100, 380, 0.05, 0.1, "square");
        break;
      case "mortar":
        this.tone(140, 80, 0.18, 0.25, "sawtooth");
        this.noise(0.12, 0.15, 800, 120);
        break;
      case "tesla":
        this.tone(1600, 400, 0.1, 0.12, "sawtooth");
        this.noise(0.08, 0.1, 3000, 600);
        break;
      case "railgun":
        this.tone(260, 40, 0.3, 0.3, "sawtooth");
        this.noise(0.15, 0.15, 2200, 180);
        break;
      case "flamethrower":
        this.noise(0.12, 0.08, 1800, 400);
        break;
      case "shield":
        this.tone(500, 700, 0.12, 0.1, "triangle");
        break;
      default:
        this.sfxShoot(1, 0.14);
    }
  }

  sfxExplosion(volume = 0.4): void {
    this.noise(0.35, volume, 1200, 60);
    this.tone(120, 30, 0.25, volume * 0.4, "sawtooth");
  }

  sfxDeath(): void {
    this.tone(500, 100, 0.12, 0.1, "triangle");
  }

  sfxCoreHit(): void {
    this.tone(180, 60, 0.25, 0.32, "triangle");
    this.noise(0.18, 0.1, 600, 80);
  }

  sfxBuild(): void {
    this.tone(300, 800, 0.1, 0.16, "triangle");
  }

  sfxUpgrade(): void {
    this.tone(500, 1100, 0.12, 0.18, "triangle");
    this.tone(800, 1400, 0.1, 0.1, "sine");
  }

  sfxSell(): void {
    this.tone(800, 300, 0.12, 0.14, "triangle");
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
    this.tone(220, 440, 0.2, 0.12, "sine");
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
    this.tone(660, 990, 0.2, 0.18, "triangle");
    this.tone(880, 1320, 0.18, 0.14, "sine");
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

  sfxAchievement(): void {
    this.tone(660, 990, 0.12, 0.14, "triangle");
    this.tone(990, 1320, 0.12, 0.1, "sine");
  }

  sfxTick(): void {
    this.tone(800, 800, 0.03, 0.06, "square");
  }

  sfxBurn(): void {
    this.noise(0.06, 0.04, 2000, 600);
  }

  sfxShieldUp(): void {
    this.tone(220, 600, 0.25, 0.12, "triangle");
    this.tone(440, 880, 0.2, 0.08, "sine");
  }

  sfxSapperExplode(): void {
    this.noise(0.25, 0.3, 1500, 80);
    this.tone(180, 60, 0.18, 0.2, "sawtooth");
  }

  setMusicIntensity(intensity: number): void {
    this.musicIntensity = Math.max(0, Math.min(1, intensity));
    // Optional: modulate the shimmer gain based on intensity in future iterations.
  }

  private ready(): boolean {
    return Boolean(this.initialized && this.ctx && this.sfxGain);
  }
}
