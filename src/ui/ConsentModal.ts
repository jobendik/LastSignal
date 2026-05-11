import { ConsentSystem, type ConsentFlags } from "../systems/ConsentSystem";
import { el } from "./dom";

interface ConsentModalOptions {
  force?: boolean;
}

export class ConsentModal {
  private static activePromise: Promise<ConsentFlags> | null = null;

  static open(root: HTMLElement, options: ConsentModalOptions = {}): Promise<ConsentFlags> {
    if (!options.force && ConsentSystem.consentRequested) {
      return Promise.resolve(ConsentSystem.getFlags());
    }
    if (this.activePromise) return this.activePromise;

    this.activePromise = new Promise<ConsentFlags>((resolve) => {
      const overlay = el("div", {
        class: "ls-overlay ls-consent-modal visible",
        attrs: {
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "ls-consent-title",
          "aria-describedby": "ls-consent-copy",
        },
      });
      overlay.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      overlay.addEventListener("click", (ev) => ev.stopPropagation());

      const flags = ConsentSystem.getFlags();
      const title = el("div", {
        class: "ls-overlay-title",
        text: "PRIVACY & DATA",
        attrs: { id: "ls-consent-title" },
      });
      const copy = el("p", {
        class: "ls-consent-copy",
        text:
          "LAST SIGNAL plays ads, can save your progress to CrazyGames cloud, and records anonymous gameplay stats so we can improve the game. You can change this any time in Settings.",
        attrs: { id: "ls-consent-copy" },
      });
      const current = el("div", {
        class: "ls-consent-current",
        text: this.formatFlags(flags),
      });

      const actions = el("div", { class: "ls-overlay-actions" });
      const accept = el("button", {
        class: "ls-btn ls-btn-primary",
        text: "Accept all",
      }) as HTMLButtonElement;
      const essential = el("button", {
        class: "ls-btn ls-btn-primary",
        text: "Essential only",
      }) as HTMLButtonElement;

      const finish = (choice: "all" | "essential") => {
        if (choice === "all") ConsentSystem.acceptAll();
        else ConsentSystem.essentialOnly();
        const snapshot = ConsentSystem.getFlags();
        overlay.remove();
        this.activePromise = null;
        resolve(snapshot);
      };

      accept.onclick = () => finish("all");
      essential.onclick = () => finish("essential");
      actions.append(accept, essential);
      overlay.append(title, copy, current, actions);
      root.append(overlay);
      window.setTimeout(() => accept.focus(), 0);
    });

    return this.activePromise;
  }

  private static formatFlags(flags: ConsentFlags): string {
    const asked = flags.consentRequested ? "yes" : "no";
    const ads = flags.adsAllowed ? "allowed" : "off";
    const cloud = flags.cloudSaveAllowed ? "allowed" : "off";
    return `Current: asked ${asked} / ads ${ads} / cloud save ${cloud}`;
  }
}
