import type { Game } from "../core/Game";
import { el } from "./dom";

export class PauseMenu {
  el: HTMLElement;
  constructor(private readonly game: Game) {
    this.el = el("div", {
      class: "ls-overlay ls-pause",
      attrs: { role: "dialog", "aria-label": "Pause menu", "aria-modal": "true" },
    });
    this.el.addEventListener("keydown", (e) => this.onKeyDown(e));
    this.el.append(
      el("div", { class: "ls-overlay-title", text: "PAUSED" }),
      el("div", { class: "ls-overlay-subtitle", text: "Press P to resume." })
    );
    const row = el("div", { class: "ls-overlay-actions" });
    const resume = el("button", {
      class: "ls-btn ls-btn-primary",
      text: "Resume",
      attrs: { "aria-label": "Resume game" },
    });
    resume.onclick = () => this.game.togglePause();
    const settings = el("button", {
      class: "ls-btn",
      text: "Settings",
      attrs: { "aria-label": "Open settings" },
    });
    settings.onclick = () => this.game.ui.openSettings();
    const quit = el("button", {
      class: "ls-btn ls-btn-ghost",
      text: "Main Menu",
      attrs: { "aria-label": "Return to main menu" },
    });
    quit.onclick = () => this.game.returnToMenu();
    row.append(resume, settings, quit);
    this.el.append(row);
  }

  focusFirst(): void {
    window.requestAnimationFrame(() => {
      this.focusableElements()[0]?.focus();
    });
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.el.classList.contains("visible")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.game.togglePause();
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
    return Array.from(this.el.querySelectorAll<HTMLElement>("button"))
      .filter((node) => !(node as HTMLButtonElement).disabled && node.offsetParent !== null);
  }
}
