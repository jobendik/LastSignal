import { VIEW_WIDTH } from "../core/Config";
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
  uiGain: GainNode | null = null;
  limiter: DynamicsCompressorNode | null = null;
  reverb: ConvolverNode | null = null;
  reverbGain: GainNode | null = null;
  bgmOsc: OscillatorNode | null = null;
  /** Tension drone: fades in during waves, fades out during planning. */
  private bgmTensionGain: GainNode | null = null;
  /** Beat pulse layer: sparse rhythmic clicks that intensify during waves. */
  private bgmBeatInterval: ReturnType<typeof setInterval> | null = null;
  private bgmIntensity = 0; // 0=calm, 1=wave, 2=boss
  initialized = false;
  muted = false;
  private settings: GameSettings | null = null;
  private subtitleHandler: ((cue: AudioSubtitleCue) => void) | null = null;
  private subtitleCooldowns = new Map<string, number>();
  private voiceExpiries: Record<AudioCategory, number[]> = {
    bullet: [],
    explosion: [],
    enemy: [],
    ui: [],
    alert: [],
    reward: [],
    world: [],
  };

  setSubtitleHandler(handler: (cue: AudioSubtitleCue) => void): void {
    this.subtitleHandler = handler;
  }

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
      this.uiGain = this.ctx.createGain();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -8;
      this.limiter.knee.value = 12;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.25;
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.createImpulseResponse(0.55, 1.9);
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.uiGain.connect(this.master);
      this.reverb.connect(this.reverbGain);
      this.reverbGain.connect(this.sfxGain);
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
      this.master.gain.value = 0.8;
      this.musicGain.gain.value = 0.25;
      this.sfxGain.gain.value = 0.7;
      this.uiGain.gain.value = 0.7;
      this.initialized = true;
      if (this.settings) this.applySettings(this.settings);
    } catch (err) {
      console.warn("[audio] init failed", err);
    }
  }

  applySettings(s: GameSettings): void {
    this.settings = s;
    if (!this.initialized || !this.master || !this.musicGain || !this.sfxGain || !this.uiGain) return;
    const effMaster = s.muted ? 0 : s.masterVolume;
    this.master.gain.value = effMaster;
    this.musicGain.gain.value = s.musicVolume;
    this.sfxGain.gain.value = s.sfxVolume;
    this.uiGain.gain.value = s.uiVolume;
  }

  resume(): void {
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume();
    }
  }

  startMusic(): void {
    if (!this.initialized || !this.ctx || !this.musicGain || this.bgmOsc) return;
    const ctx = this.ctx;

    // Base drone: deep sawtooth with slow LFO pitch wobble.
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

    // Tension layer: higher-pitched dissonant overtone that cross-fades in during waves.
    const tensionOsc = ctx.createOscillator();
    tensionOsc.type = "triangle";
    tensionOsc.frequency.value = 82.5; // minor third above 55Hz for tension
    const tensionFilter = ctx.createBiquadFilter();
    tensionFilter.type = "highpass";
    tensionFilter.frequency.value = 120;
    const tensionGain = ctx.createGain();
    tensionGain.gain.value = 0; // starts silent
    tensionOsc.connect(tensionFilter);
    tensionFilter.connect(tensionGain);
    tensionGain.connect(this.musicGain);
    tensionOsc.start();
    this.bgmTensionGain = tensionGain;

    // Beat pulse: occasional sparse rhythmic clicks during wave.
    this.bgmBeatInterval = setInterval(() => {
      if (this.bgmIntensity < 1 || !this.ctx || !this.musicGain) return;
      this.bgmPulse();
    }, 1800);
  }

  stopMusic(): void {
    if (this.bgmOsc) {
      try { this.bgmOsc.stop(); } catch { /* ignore */ }
      this.bgmOsc = null;
    }
    if (this.bgmBeatInterval !== null) {
      clearInterval(this.bgmBeatInterval);
      this.bgmBeatInterval = null;
    }
    this.bgmTensionGain = null;
  }

  /** Set music intensity: 0=planning calm, 1=wave active, 2=boss fight. */
  setMusicIntensity(intensity: 0 | 1 | 2): void {
    if (!this.initialized || !this.ctx || !this.bgmTensionGain) return;
    this.bgmIntensity = intensity;
    const now = this.ctx.currentTime;
    const targetGain = intensity === 0 ? 0 : intensity === 1 ? 0.18 : 0.35;
    this.bgmTensionGain.gain.cancelScheduledValues(now);
    this.bgmTensionGain.gain.setValueAtTime(this.bgmTensionGain.gain.value, now);
    this.bgmTensionGain.gain.linearRampToValueAtTime(targetGain, now + (intensity > 0 ? 1.8 : 4.0));
  }

  private bgmPulse(): void {
    if (!this.initialized || !this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 110;
    g.gain.setValueAtTime(0.06 * (this.bgmIntensity === 2 ? 2.0 : 1.0), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(g); g.connect(this.musicGain);
    osc.start(now); osc.stop(now + 0.2);
  }

  // ---- SFX: per-tower procedural sounds ----

  sfxTowerFire(type: string, position?: AudioPosition): void {
    this.emitSubtitle(this.towerCue(type), "tower", 1.25, 0.95);
    switch (type) {
      case "tesla":    this.sfxTesla(position); break;
      case "railgun":  this.sfxRailgun(position); break;
      case "mortar":   this.sfxMortar(position); break;
      case "flamer":   this.sfxFlamer(position); break;
      case "stasis":   this.sfxStasis(position); break;
      case "blaster":  this.sfxShoot(1.35, 0.14, "bullet", position); break;
      case "barrier":  break; // barrier is silent on pulse
      default:         this.sfxShoot(1, 0.17, "bullet", position); break;
    }
  }

  sfxTesla(position?: AudioPosition): void {
    if (!this.ready() || !this.beginVoice("bullet", 0.12)) return;
    const now = this.ctx!.currentTime;
    const out = this.spatialOutput("bullet", position, 0.14);
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
    noise.connect(flt); flt.connect(gain); gain.connect(out);
    noise.start(now);
    // Add a sharp high ping.
    const osc = this.ctx!.createOscillator();
    const og = this.ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.07);
    og.gain.setValueAtTime(0.18, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(og); og.connect(out);
    osc.start(now); osc.stop(now + 0.09);
  }

  sfxRailgun(position?: AudioPosition): void {
    if (!this.ready() || !this.beginVoice("bullet", 0.24)) return;
    const now = this.ctx!.currentTime;
    const out = this.spatialOutput("bullet", position, 0.28);
    // Deep crack + high snap.
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain); gain.connect(out);
    osc.start(now); osc.stop(now + 0.24);
    // High transient click for snap.
    const osc2 = this.ctx!.createOscillator();
    const g2 = this.ctx!.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(1800, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.04);
    g2.gain.setValueAtTime(0.3, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc2.connect(g2); g2.connect(out);
    osc2.start(now); osc2.stop(now + 0.06);
  }

  sfxMortar(position?: AudioPosition): void {
    if (!this.ready() || !this.beginVoice("bullet", 0.32)) return;
    const now = this.ctx!.currentTime;
    const out = this.spatialOutput("bullet", position, 0.36);
    // Deep low-frequency thump.
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.28);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain); gain.connect(out);
    osc.start(now); osc.stop(now + 0.32);
  }

  sfxFlamer(position?: AudioPosition): void {
    if (!this.ready() || !this.beginVoice("bullet", 0.12)) return;
    const now = this.ctx!.currentTime;
    const out = this.spatialOutput("bullet", position, 0.16);
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
    noise.connect(flt); flt.connect(gain); gain.connect(out);
    noise.start(now);
  }

  sfxStasis(position?: AudioPosition): void {
    if (!this.ready() || !this.beginVoice("bullet", 0.22)) return;
    const now = this.ctx!.currentTime;
    const out = this.spatialOutput("bullet", position, 0.3);
    // Crystalline ascending chime.
    const freqs = [880, 1320, 1760];
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + i * 0.04);
      gain.gain.setValueAtTime(0.1, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.04 + 0.18);
      osc.connect(gain); gain.connect(out);
      osc.start(now + i * 0.04); osc.stop(now + i * 0.04 + 0.2);
    });
  }

  // ---- SFX: procedural helpers ----

  sfxShoot(pitch = 1, volume = 0.2, category: AudioCategory = "bullet", position?: AudioPosition): void {
    if (!this.ready() || !this.beginVoice(category, 0.12)) return;
    const now = this.ctx!.currentTime;
    const out = this.spatialOutput(category, position, 0.16);
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(900 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(200 * pitch, now + 0.06);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  sfxExplosion(volume = 0.4, position?: AudioPosition): void {
    this.emitSubtitle("EXPLOSION", "alert", 1.2, 1.2);
    if (!this.ready() || !this.beginVoice("explosion", 0.36)) return;
    const now = this.ctx!.currentTime;
    const out = this.spatialOutput("explosion", position, 0.45);
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
    gain.connect(out);
    if (this.reverb) gain.connect(this.reverb);
    noise.start(now);
  }

  sfxDeath(pitch = 0.5, position?: AudioPosition): void {
    this.sfxShoot(pitch, 0.15, "enemy", position);
  }

  sfxCoreHit(position?: AudioPosition): void {
    this.emitSubtitle("CORE ALERT", "alert", 2.0, 0.8, 2);
    if (!this.ready() || !this.beginVoice("alert", 0.32)) return;
    this.duckMusic(0.45, 0.45);
    const now = this.ctx!.currentTime;
    const out = this.spatialOutput("alert", position, 0.38);
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  sfxBuild(position?: AudioPosition): void {
    this.emitSubtitle("TOWER DEPLOYED", "tower", 1.2, 0.7);
    this.sfxShoot(1.4, 0.15, "world", position);
  }

  sfxUpgrade(position?: AudioPosition): void {
    this.emitSubtitle("UPGRADE APPLIED", "reward", 1.4, 0.7);
    this.sfxShoot(1.8, 0.2, "world", position);
  }

  sfxPowerSurge(position?: AudioPosition): void {
    this.emitSubtitle("POWER SURGE", "reward", 1.5, 0.6, 2);
    this.sfxShoot(1.75, 0.16, "world", position);
  }

  sfxSell(position?: AudioPosition): void {
    this.emitSubtitle("TOWER SOLD", "neutral", 1.2, 0.7);
    this.sfxShoot(0.7, 0.15, "world", position);
  }

  sfxWaveStart(): void {
    this.emitSubtitle("WAVE START", "alert", 1.7, 0.5, 2);
    if (!this.ready() || !this.beginVoice("alert", 0.42)) return;
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

  sfxBossAlert(position?: AudioPosition): void {
    this.emitSubtitle("BOSS ALERT", "alert", 2.1, 0.7, 3);
    if (!this.ready() || !this.beginVoice("alert", 1.05)) return;
    this.duckMusic(1.15, 0.32);
    const now = this.ctx!.currentTime;
    const out = this.spatialOutput("alert", position, 1.15);
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now + i * 0.3);
      osc.frequency.exponentialRampToValueAtTime(90, now + i * 0.3 + 0.25);
      gain.gain.setValueAtTime(0.3, now + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.3 + 0.25);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + i * 0.3);
      osc.stop(now + i * 0.3 + 0.3);
    }
  }

  sfxReward(): void {
    this.emitSubtitle("REWARD READY", "reward", 1.5, 0.9);
    this.sfxShoot(2.2, 0.22, "reward");
  }

  sfxVictory(): void {
    this.emitSubtitle("VICTORY STING", "reward", 2.2, 0.5, 3);
    if (!this.ready() || !this.beginVoice("alert", 0.7)) return;
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
    this.emitSubtitle("SIGNAL LOST", "alert", 2.4, 0.5, 3);
    if (!this.ready() || !this.beginVoice("alert", 1.4)) return;
    const now = this.ctx!.currentTime;
    [300, 225, 150, 75].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = i === 3 ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.16);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.45), now + i * 0.16 + 0.42);
      gain.gain.setValueAtTime(0.22, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.55);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.6);
    });
  }

  sfxUiHover(): void {
    this.sfxShoot(1.9, 0.045, "ui");
  }

  sfxUiClick(): void {
    this.ensureStartedForGesture();
    this.sfxShoot(1.25, 0.09, "ui");
  }

  sfxPanel(open = true): void {
    this.sfxShoot(open ? 1.55 : 0.85, 0.08, "ui");
  }

  sfxAchievement(): void {
    this.emitSubtitle("ACHIEVEMENT UNLOCKED", "reward", 1.8, 0.8, 2);
    if (!this.ready() || !this.beginVoice("reward", 0.45)) return;
    const now = this.ctx!.currentTime;
    [1046, 1318, 1568].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.12, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.24);
    });
  }

  sfxCardFlip(): void {
    this.sfxShoot(2.6, 0.055, "ui");
  }

  sfxCredit(position?: AudioPosition): void {
    this.emitSubtitle("CREDITS COLLECTED", "reward", 1.0, 2.0);
    this.sfxShoot(2.05, 0.08, "reward", position);
  }

  sfxEnemyArrival(type: string, position?: AudioPosition): void {
    const pitch = type === "brute" || type === "carrier" ? 0.62 : type === "phantom" ? 1.45 : 0.92;
    this.sfxShoot(pitch, 0.07, "enemy", position);
  }

  sfxEnemyAbility(kind: "heal" | "phase" | "spawn", position?: AudioPosition): void {
    const text = kind === "heal" ? "WEAVER HEAL" : kind === "phase" ? "PHANTOM PHASE" : "ENEMY RELEASE";
    this.emitSubtitle(text, "enemy", 1.4, 0.9);
    if (kind === "heal") this.sfxShoot(1.65, 0.08, "enemy", position);
    else if (kind === "phase") this.sfxShoot(1.9, 0.055, "enemy", position);
    else this.sfxShoot(0.75, 0.1, "enemy", position);
  }

  sfxEnemyDeath(type: string, position?: AudioPosition): void {
    const pitch = type === "brute" || type === "juggernaut" ? 0.38 : type === "phantom" ? 1.25 : 0.58;
    this.sfxDeath(pitch, position);
  }

  private ready(): boolean {
    return Boolean(this.initialized && this.ctx && this.sfxGain && this.uiGain);
  }

  private outputFor(category: AudioCategory): GainNode {
    return category === "ui" ? this.uiGain! : this.sfxGain!;
  }

  private spatialOutput(category: AudioCategory, position: AudioPosition | undefined, duration: number): AudioNode {
    const output = this.outputFor(category);
    if (!position || category === "ui" || !this.ctx || typeof this.ctx.createStereoPanner !== "function") return output;
    const pan = this.panFromPosition(position);
    if (Math.abs(pan) < 0.01) return output;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(output);
    window.setTimeout(() => {
      try { panner.disconnect(); } catch { /* ignore */ }
    }, Math.ceil((duration + 0.2) * 1000));
    return panner;
  }

  private panFromPosition(position: AudioPosition): number {
    const x = typeof position === "number" ? position : position.x;
    const normalized = (x / VIEW_WIDTH) * 2 - 1;
    return Math.max(-0.9, Math.min(0.9, normalized));
  }

  private ensureStartedForGesture(): void {
    if (!this.initialized) this.init();
    this.resume();
  }

  private beginVoice(category: AudioCategory, duration: number): boolean {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    const list = this.voiceExpiries[category];
    while (list.length > 0 && list[0]! <= now) list.shift();
    if (list.length >= this.voiceLimit(category)) return false;
    list.push(now + duration);
    return true;
  }

  private voiceLimit(category: AudioCategory): number {
    switch (category) {
      case "bullet": return 8;
      case "explosion": return 4;
      case "enemy": return 8;
      case "ui": return 6;
      case "alert": return 3;
      case "reward": return 4;
      case "world": return 8;
    }
  }

  private duckMusic(duration: number, factor: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const base = this.settings?.musicVolume ?? 0.25;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(base * factor, now + 0.035);
    this.musicGain.gain.linearRampToValueAtTime(base, now + duration);
  }

  private towerCue(type: string): string {
    switch (type) {
      case "tesla": return "TESLA CHAIN";
      case "railgun": return "RAILGUN DISCHARGE";
      case "mortar": return "MORTAR LAUNCH";
      case "flamer": return "FLAMER BURST";
      case "stasis": return "STASIS CHIME";
      case "blaster": return "BLASTER FIRE";
      case "barrier": return "BARRIER PULSE";
      case "harvester": return "HARVESTER PULSE";
      case "amplifier": return "AMPLIFIER RESONANCE";
      default: return "PULSE FIRE";
    }
  }

  private emitSubtitle(
    text: string,
    tone: AudioSubtitleTone = "neutral",
    duration = 1.5,
    cooldown = 1,
    priority = 1
  ): void {
    if (!this.settings?.subtitles || !this.subtitleHandler) return;
    const now = performance.now() / 1000;
    const key = `${tone}:${text}`;
    const nextAllowed = this.subtitleCooldowns.get(key) ?? 0;
    if (now < nextAllowed) return;
    this.subtitleCooldowns.set(key, now + cooldown);
    this.subtitleHandler({ text, tone, duration, priority });
  }

  private createImpulseResponse(seconds: number, decay: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const rate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * seconds));
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return impulse;
  }
}

type AudioCategory = "bullet" | "explosion" | "enemy" | "ui" | "alert" | "reward" | "world";
type AudioPosition = number | { x: number };
export type AudioSubtitleTone = "neutral" | "alert" | "reward" | "enemy" | "tower";

export interface AudioSubtitleCue {
  text: string;
  tone: AudioSubtitleTone;
  duration: number;
  priority: number;
}
