import type { Game } from "../core/Game";
import type { GameSettings } from "../core/Types";
import { el, clear } from "./dom";

export class SettingsPanel {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-overlay ls-settings" });
    this.build();
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
      this.checkboxRow("Mute All", "muted", s.muted),
      this.checkboxRow("Screen Shake", "screenShake", s.screenShake),
      this.checkboxRow("Reduced Flashing", "reducedFlashing", s.reducedFlashing),
      this.checkboxRow("Show Damage Numbers", "showDamageNumbers", s.showDamageNumbers),
      this.checkboxRow("Colorblind Markers", "colorblind", s.colorblind),
    );
    this.el.append(form);
    const row = el("div", { class: "ls-overlay-actions" });
    const close = el("button", { class: "ls-btn ls-btn-primary", text: "Close" });
    close.onclick = () => this.game.ui.closeSettings();
    row.append(close);
    this.el.append(row);
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
    };
    row.append(input);
    return row;
  }
}
