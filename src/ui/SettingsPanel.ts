import type { Game } from "../core/Game";
import type { GameSettings } from "../core/Types";
import { ConsentSystem } from "../systems/ConsentSystem";
import { ConsentModal } from "./ConsentModal";
import { el, clear } from "./dom";

export class SettingsPanel {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", {
      class: "ls-overlay ls-settings",
      attrs: { role: "dialog", "aria-label": "Settings", "aria-modal": "true" },
    });
    this.el.addEventListener("keydown", (e) => this.onKeyDown(e));
    this.game.bus.on("consent:changed", () => this.build());
    this.build();
  }

  focusFirst(): void {
    window.requestAnimationFrame(() => {
      this.focusableElements()[0]?.focus();
    });
  }

  private build(): void {
    clear(this.el);
    const s = this.game.core.settings;
    this.el.append(el("div", { class: "ls-overlay-title", text: "SETTINGS" }));
    const form = el("div", { class: "ls-form" });

    form.append(
      this.sliderRow("Master Volume", "masterVolume", s.masterVolume),
      this.sliderRow("Music Volume", "musicVolume", s.musicVolume),
      this.sliderRow("SFX Volume", "sfxVolume", s.sfxVolume),
      this.sliderRow("UI Volume", "uiVolume", s.uiVolume),
      this.checkboxRow("Mute All", "muted", s.muted),
    );

    form.append(el("div", { class: "ls-form-section", text: "ACCESSIBILITY" }));
    form.append(
      this.selectRow("Palette", "palette", s.palette, [
        ["default", "Default"],
        ["deuteranopia", "Deuteranopia"],
        ["protanopia", "Protanopia"],
        ["highContrast", "High Contrast"],
      ]),
      this.uiScaleRow(s.uiScale),
      this.checkboxRow("Reduce Motion", "reduceMotion", s.reduceMotion || s.reducedMotion),
      this.checkboxRow("Keyboard Navigation", "keyboardNav", s.keyboardNav)
    );

    form.append(
      this.checkboxRow("Screen Shake", "screenShake", s.screenShake),
      this.checkboxRow("Reduced Flashing", "reducedFlashing", s.reducedFlashing),
      this.checkboxRow("Show Damage Numbers", "showDamageNumbers", s.showDamageNumbers),
      this.checkboxRow("Subtitles", "subtitles", s.subtitles),
      this.checkboxRow("Swap Mouse Buttons", "mouseButtonSwap", s.mouseButtonSwap),
      this.checkboxRow("Gamepad", "gamepadEnabled", s.gamepadEnabled),
      this.checkboxRow("Colorblind Markers", "colorblind", s.colorblind),
      this.checkboxRow("High Contrast", "highContrast", s.highContrast),
      this.selectRow("Font Scale", "fontScale", String(s.fontScale), [
        ["0.8", "80%"],
        ["1", "100%"],
        ["1.2", "120%"],
        ["1.5", "150%"],
      ]),
      this.selectRow("Graphics Preset", "graphicsQuality", s.graphicsQuality, [
        ["low", "Clean HD"],
        ["medium", "Subtle CRT"],
        ["high", "Full Retro"],
        ["custom", "Custom"],
      ]),
      this.privacyRow(),
    );
    // Per-effect graphics toggles. Picking a preset above sets all of these,
    // but the player can also override any individual effect.
    form.append(el("div", { class: "ls-form-section", text: "VISUAL EFFECTS" }));
    form.append(
      this.checkboxRow("Scanlines", "vfxScanlines", s.vfxScanlines),
      this.checkboxRow("Vignette", "vfxVignette", s.vfxVignette),
      this.checkboxRow("Phosphor Persistence", "vfxPhosphor", s.vfxPhosphor),
      this.checkboxRow("Film Grain", "vfxFilmGrain", s.vfxFilmGrain),
      this.checkboxRow("Chromatic Aberration", "vfxChromaticAberration", s.vfxChromaticAberration),
      this.checkboxRow("Barrel Distortion", "vfxBarrelDistortion", s.vfxBarrelDistortion),
      this.checkboxRow("Neon Bloom", "vfxBloom", s.vfxBloom),
      this.checkboxRow("Random Flicker", "vfxFlicker", s.vfxFlicker),
      this.particleDensityRow(s.vfxParticleDensity),
    );
    form.append(el("div", { class: "ls-form-section", text: "GUIDANCE" }));
    const profile = this.game.core.profile;
    form.append(
      this.profileBoolRow(
        "Tutorial Cards & Banners",
        profile.tutorialHintsEnabled !== false,
        (next) => {
          profile.tutorialHintsEnabled = next;
          this.game.persistence.saveProfile(profile);
        }
      ),
      this.profileBoolRow(
        "Contextual Hints",
        profile.contextualHintsEnabled !== false,
        (next) => {
          profile.contextualHintsEnabled = next;
          this.game.persistence.saveProfile(profile);
        }
      )
    );
    const replayRow = el("div", { class: "ls-form-row" });
    replayRow.append(el("span", { class: "ls-form-label", text: "Replay Tutorials" }));
    const replayBtn = el("button", {
      class: "ls-btn ls-keybind-btn",
      text: "RESET",
      attrs: { "aria-label": "Reset tutorial guidance" },
    });
    replayBtn.title =
      "Forget seen tutorials and mechanic banners so they show again next sector.";
    replayBtn.onclick = () => {
      this.game.guidance.resetAllPersistedGuidance();
      replayBtn.textContent = "RESET ✓";
      window.setTimeout(() => (replayBtn.textContent = "RESET"), 1400);
    };
    replayRow.append(replayBtn);
    form.append(replayRow);

    form.append(el("div", { class: "ls-form-section", text: "HOTKEYS" }));
    for (const [action, code] of Object.entries(s.keyBindings)) {
      form.append(this.keybindRow(action, code));
    }
    this.el.append(form);
    const row = el("div", { class: "ls-overlay-actions" });
    const close = el("button", {
      class: "ls-btn ls-btn-primary",
      text: "Close",
      attrs: { "aria-label": "Close settings" },
    });
    close.onclick = () => this.game.ui.closeSettings();
    row.append(close);
    this.el.append(row);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.el.classList.contains("visible")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.game.ui.closeSettings();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = this.focusableElements();
    if (focusable.length === 0) return;
    const current = document.activeElement as HTMLElement | null;
    const idx = current ? focusable.indexOf(current) : -1;
    const nextIdx = e.shiftKey
      ? (idx <= 0 ? focusable.length - 1 : idx - 1)
      : (idx === -1 || idx >= focusable.length - 1 ? 0 : idx + 1);
    e.preventDefault();
    focusable[nextIdx]?.focus();
  }

  private focusableElements(): HTMLElement[] {
    return Array.from(
      this.el.querySelectorAll<HTMLElement>(
        "button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])"
      )
    ).filter((node) => {
      const disabled = "disabled" in node && Boolean((node as HTMLButtonElement | HTMLInputElement).disabled);
      return !disabled && node.offsetParent !== null;
    });
  }

  private sliderRow(label: string, key: keyof GameSettings, value: number): HTMLElement {
    const row = el("label", { class: "ls-form-row" });
    row.append(el("span", { class: "ls-form-label", text: label }));
    const input = el("input", { attrs: { type: "range", min: "0", max: "1", step: "0.05" } }) as HTMLInputElement;
    input.value = String(value);
    const valEl = el("span", { class: "ls-form-value", text: `${Math.round(value * 100)}%` });
    input.oninput = () => {
      const v = parseFloat(input.value);
      valEl.textContent = `${Math.round(v * 100)}%`;
      this.game.settings.update({ [key]: v } as Partial<GameSettings>);
    };
    row.append(input, valEl);
    return row;
  }

  private checkboxRow(label: string, key: keyof GameSettings, value: boolean): HTMLElement {
    const row = el("label", { class: "ls-form-row" });
    row.append(el("span", { class: "ls-form-label", text: label }));
    const input = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement;
    input.checked = value;
    input.onchange = () => {
      this.game.settings.update({ [key]: input.checked } as Partial<GameSettings>);
      // Rebuild so the Graphics Preset dropdown can reflect the new "custom".
      if (String(key).startsWith("vfx")) this.build();
    };
    row.append(input);
    return row;
  }

  /** Checkbox row for a value stored on PersistedProfile (not GameSettings). */
  private profileBoolRow(
    label: string,
    value: boolean,
    onChange: (next: boolean) => void
  ): HTMLElement {
    const row = el("label", { class: "ls-form-row" });
    row.append(el("span", { class: "ls-form-label", text: label }));
    const input = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement;
    input.checked = value;
    input.onchange = () => onChange(input.checked);
    row.append(input);
    return row;
  }

  private particleDensityRow(value: number): HTMLElement {
    const row = el("label", { class: "ls-form-row" });
    row.append(el("span", { class: "ls-form-label", text: "Particle Density" }));
    const input = el("input", { attrs: { type: "range", min: "0.15", max: "1", step: "0.05" } }) as HTMLInputElement;
    input.value = String(value);
    const valEl = el("span", { class: "ls-form-value", text: `${Math.round(value * 100)}%` });
    input.oninput = () => {
      const v = parseFloat(input.value);
      valEl.textContent = `${Math.round(v * 100)}%`;
      this.game.settings.update({ vfxParticleDensity: v });
    };
    row.append(input, valEl);
    return row;
  }

  private selectRow(
    label: string,
    key: keyof GameSettings,
    value: string,
    options: [string, string][]
  ): HTMLElement {
    const row = el("label", { class: "ls-form-row" });
    row.append(el("span", { class: "ls-form-label", text: label }));
    const select = el("select", { class: "ls-select" }) as HTMLSelectElement;
    for (const [v, text] of options) {
      const option = el("option", { attrs: { value: v }, text }) as HTMLOptionElement;
      option.selected = v === value;
      select.append(option);
    }
    select.onchange = () => {
      const raw = select.value;
      const next = key === "fontScale" ? parseFloat(raw) : raw;
      this.game.settings.update({ [key]: next } as Partial<GameSettings>);
      // Picking a graphics preset cascades to the per-effect flags; rebuild
      // so the checkboxes below reflect the new state immediately.
      if (key === "graphicsQuality") this.build();
    };
    row.append(select);
    return row;
  }

  private uiScaleRow(value: number): HTMLElement {
    const row = el("label", { class: "ls-form-row" });
    row.append(el("span", { class: "ls-form-label", text: "UI Scale" }));
    const input = el("input", {
      attrs: { type: "range", min: "0.8", max: "1.4", step: "0.05", "aria-label": "UI scale" },
    }) as HTMLInputElement;
    input.value = String(value);
    const valEl = el("span", { class: "ls-form-value", text: `${Math.round(value * 100)}%` });
    input.oninput = () => {
      const v = parseFloat(input.value);
      valEl.textContent = `${Math.round(v * 100)}%`;
      this.game.settings.update({ uiScale: v });
    };
    row.append(input, valEl);
    return row;
  }

  private privacyRow(): HTMLElement {
    const row = el("div", { class: "ls-form-row ls-privacy-row" });
    row.append(el("span", { class: "ls-form-label", text: "Privacy & data" }));
    const state = el("span", {
      class: "ls-form-value ls-consent-state",
      text: this.consentSummary(),
    });
    const btn = el("button", {
      class: "ls-btn ls-keybind-btn",
      text: "OPEN",
      attrs: { "aria-label": "Open privacy and data settings" },
    });
    btn.onclick = async () => {
      await ConsentModal.open(this.game.uiRoot, { force: true });
      this.build();
    };
    row.append(state, btn);
    return row;
  }

  private consentSummary(): string {
    const flags = ConsentSystem.getFlags();
    const asked = flags.consentRequested ? "Yes" : "No";
    const ads = flags.adsAllowed ? "Yes" : "No";
    const cloud = flags.cloudSaveAllowed ? "Yes" : "No";
    return `Asked ${asked} / Ads ${ads} / Cloud ${cloud}`;
  }

  private keybindRow(action: string, code: string): HTMLElement {
    const row = el("div", { class: "ls-form-row" });
    row.append(el("span", { class: "ls-form-label", text: this.labelForAction(action) }));
    const btn = el("button", {
      class: "ls-btn ls-keybind-btn",
      text: this.prettyCode(code),
      attrs: { "aria-label": `Rebind ${this.labelForAction(action)}` },
    });
    btn.onclick = () => {
      btn.textContent = "PRESS KEY";
      const handler = (ev: KeyboardEvent) => {
        ev.preventDefault();
        const next = { ...this.game.core.settings.keyBindings, [action]: ev.code };
        this.game.settings.update({ keyBindings: next });
        window.removeEventListener("keydown", handler, true);
        this.build();
      };
      window.addEventListener("keydown", handler, true);
    };
    row.append(btn);
    return row;
  }

  private labelForAction(action: string): string {
    return action
      .replace(/^build(\d+)$/, "Build $1")
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (m) => m.toUpperCase());
  }

  private prettyCode(code: string): string {
    return code.replace("Digit", "").replace("Key", "").replace("Equal", "+").replace("Minus", "-");
  }
}
