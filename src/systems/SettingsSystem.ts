import type { Game } from "../core/Game";
import type { GameSettings } from "../core/Types";

/** VFX flag tuple; each preset toggles all of these in lockstep. */
type VfxFlags = Pick<
  GameSettings,
  | "vfxScanlines"
  | "vfxVignette"
  | "vfxPhosphor"
  | "vfxFilmGrain"
  | "vfxChromaticAberration"
  | "vfxBarrelDistortion"
  | "vfxBloom"
  | "vfxFlicker"
> & { vfxParticleDensity: number };

const VFX_PRESETS: Record<"low" | "medium" | "high", VfxFlags> = {
  // "Low" = clean HD: every CRT/grain effect off; bloom off; minimal particles.
  low: {
    vfxScanlines: false,
    vfxVignette: false,
    vfxPhosphor: false,
    vfxFilmGrain: false,
    vfxChromaticAberration: false,
    vfxBarrelDistortion: false,
    vfxBloom: false,
    vfxFlicker: false,
    vfxParticleDensity: 0.55,
  },
  // "Medium" = subtle CRT: scanlines + vignette + bloom; no grain/persistence/distortion.
  medium: {
    vfxScanlines: true,
    vfxVignette: true,
    vfxPhosphor: false,
    vfxFilmGrain: false,
    vfxChromaticAberration: false,
    vfxBarrelDistortion: false,
    vfxBloom: true,
    vfxFlicker: true,
    vfxParticleDensity: 0.8,
  },
  // "High" = full retro: everything on.
  high: {
    vfxScanlines: true,
    vfxVignette: true,
    vfxPhosphor: true,
    vfxFilmGrain: true,
    vfxChromaticAberration: true,
    vfxBarrelDistortion: true,
    vfxBloom: true,
    vfxFlicker: true,
    vfxParticleDensity: 1,
  },
};

export class SettingsSystem {
  constructor(private readonly game: Game) {}

  get current(): GameSettings {
    return this.game.core.settings;
  }

  update(patch: Partial<GameSettings>): void {
    let s = { ...this.game.core.settings, ...patch };
    // Apply preset when graphicsQuality changes (unless caller already set custom flags).
    if ("graphicsQuality" in patch && patch.graphicsQuality && patch.graphicsQuality !== "custom") {
      const preset = VFX_PRESETS[patch.graphicsQuality];
      s = { ...s, ...preset };
    } else {
      // If the caller toggled an individual VFX flag, mark the preset as "custom".
      const vfxKeys: (keyof VfxFlags)[] = [
        "vfxScanlines",
        "vfxVignette",
        "vfxPhosphor",
        "vfxFilmGrain",
        "vfxChromaticAberration",
        "vfxBarrelDistortion",
        "vfxBloom",
        "vfxFlicker",
        "vfxParticleDensity",
      ];
      const toggledVfx = vfxKeys.some((k) => k in patch);
      if (toggledVfx && s.graphicsQuality !== "custom") s.graphicsQuality = "custom";
    }
    this.game.core.settings = s;
    this.game.persistence.saveSettings(s);
    this.game.audio.applySettings(s);
    this.applyVisualSettings(s);
    this.game.bus.emit("settings:changed", s);
  }

  applyVisualSettings(s: GameSettings = this.game.core.settings): void {
    const root = this.game.uiRoot;
    root.style.setProperty("--ls-font-scale", String(s.fontScale));
    root.classList.toggle("ls-high-contrast", s.highContrast);
    root.classList.toggle("ls-reduced-motion", s.reducedMotion);
    // Treat "custom" as low for the global CSS dim/disable hooks (those are
    // mostly for animation-cost reductions; the renderer reads VFX flags
    // directly for fine-grained control).
    root.classList.toggle("ls-quality-low", s.graphicsQuality === "low");
    root.classList.toggle("ls-quality-medium", s.graphicsQuality === "medium");
    root.classList.toggle("ls-quality-high", s.graphicsQuality === "high");
    root.classList.toggle("ls-quality-custom", s.graphicsQuality === "custom");
    // Body-level toggle for the global CSS scanlines overlay (main.css).
    document.body.classList.toggle("ls-no-scanlines", !s.vfxScanlines);
  }
}
