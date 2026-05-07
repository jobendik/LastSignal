import type { Game } from "../core/Game";
import type { GuidanceCard } from "../systems/GuidanceSystem";
import { el, clear } from "./dom";

/**
 * Renders the three layers of in-game guidance produced by GuidanceSystem:
 *
 *   - Tutorial card (sticky popup, pinned to bottom-center, ≤ 480 px wide)
 *   - "New mechanic" banner (top-center, smaller, auto-fades)
 *   - Contextual hint (top-right, transient, no buttons)
 *
 * Each layer has its own DOM node so they can stack visually without
 * fighting for the same z-space. They never block clicks on the canvas
 * outside their own footprint.
 */
export class GuidanceOverlay {
  el: HTMLElement;
  private tutorialEl: HTMLElement;
  private bannerEl: HTMLElement;
  private hintEl: HTMLElement;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-guidance-root" });
    this.tutorialEl = el("div", { class: "ls-guidance-tutorial" });
    this.bannerEl = el("div", { class: "ls-guidance-banner" });
    this.hintEl = el("div", { class: "ls-guidance-hint" });
    this.el.append(this.tutorialEl, this.bannerEl, this.hintEl);

    game.bus.on("guidance:changed", () => this.refresh());
    // Hide everything when returning to menu / game-over so stale prompts don't bleed.
    game.bus.on<{ next: string }>("state:changed", (ev) => {
      if (ev.next === "MAIN_MENU" || ev.next === "SECTOR_SELECT") {
        this.tutorialEl.classList.remove("visible");
        this.bannerEl.classList.remove("visible");
        this.hintEl.classList.remove("visible");
      }
    });
  }

  refresh(): void {
    const guide = this.game.guidance;
    if (!guide) return;
    this.renderTutorial(guide.activeTutorial);
    this.renderBanner(guide.activeBanner);
    this.renderHint(guide.activeHint);
  }

  private renderTutorial(card: GuidanceCard | null): void {
    if (!card) {
      this.tutorialEl.classList.remove("visible");
      return;
    }
    clear(this.tutorialEl);

    const head = el("div", { class: "ls-guidance-head" });
    head.append(
      el("div", { class: "ls-guidance-eyebrow", text: "TUTORIAL" }),
      el("div", { class: "ls-guidance-title", text: card.title })
    );
    if (card.hint) {
      head.append(el("div", { class: "ls-guidance-hint-pill", text: card.hint }));
    }
    this.tutorialEl.append(head);
    this.tutorialEl.append(el("div", { class: "ls-guidance-body", text: card.body }));

    const actions = el("div", { class: "ls-guidance-actions" });
    if (card.codexTab) {
      const open = el("button", { class: "ls-btn ls-btn-ghost ls-guidance-btn", text: "OPEN CODEX" });
      open.title = "Open the field manual at this topic.";
      open.onclick = () => {
        this.game.ui.codexPanel.openAt(card.codexTab!);
        this.game.guidance.dismissTutorial();
      };
      actions.append(open);
    }
    const ok = el("button", { class: "ls-btn ls-guidance-btn", text: "GOT IT" });
    ok.onclick = () => this.game.guidance.dismissTutorial();
    actions.append(ok);
    this.tutorialEl.append(actions);

    this.tutorialEl.classList.add("visible");
  }

  private renderBanner(card: GuidanceCard | null): void {
    if (!card) {
      this.bannerEl.classList.remove("visible");
      return;
    }
    clear(this.bannerEl);
    const close = el("button", { class: "ls-guidance-banner-close", text: "✕" });
    close.title = "Dismiss";
    close.onclick = () => this.game.guidance.dismissBanner();

    this.bannerEl.append(
      el("div", { class: "ls-guidance-banner-title", text: card.title }),
      el("div", { class: "ls-guidance-banner-body", text: card.body })
    );
    if (card.codexTab) {
      const open = el("button", { class: "ls-guidance-banner-link", text: "OPEN CODEX" });
      open.onclick = () => {
        this.game.ui.codexPanel.openAt(card.codexTab!);
        this.game.guidance.dismissBanner();
      };
      this.bannerEl.append(open);
    }
    this.bannerEl.append(close);
    this.bannerEl.classList.add("visible");
  }

  private renderHint(card: GuidanceCard | null): void {
    if (!card) {
      this.hintEl.classList.remove("visible");
      return;
    }
    clear(this.hintEl);
    this.hintEl.append(
      el("div", { class: "ls-guidance-hint-title", text: card.title }),
      el("div", { class: "ls-guidance-hint-body", text: card.body })
    );
    this.hintEl.classList.add("visible");
  }
}
