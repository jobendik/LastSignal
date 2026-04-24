import type { Game } from "../core/Game";
import type { AchievementDefinition } from "../core/Types";
import { el, clear } from "./dom";

/**
 * Transient popup that slides in when an achievement is unlocked.
 * Queues multiple achievements and shows them one at a time.
 */
export class AchievementToast {
  el: HTMLElement;
  private queue: AchievementDefinition[] = [];
  private showing = false;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-achievement-toast" });
    this.game.bus.on<AchievementDefinition>("achievement:unlocked", (def) =>
      this.enqueue(def)
    );
  }

  private enqueue(def: AchievementDefinition): void {
    this.queue.push(def);
    if (!this.showing) this.next();
  }

  private next(): void {
    const def = this.queue.shift();
    if (!def) {
      this.showing = false;
      return;
    }
    this.showing = true;
    clear(this.el);
    this.el.append(
      el("div", { class: "ls-achievement-icon", text: def.icon }),
      el("div", { class: "ls-achievement-body" }, [
        el("div", { class: "ls-achievement-title", text: "ACHIEVEMENT" }),
        el("div", { class: "ls-achievement-name", text: def.name }),
        el("div", { class: "ls-achievement-desc", text: def.description }),
        el("div", {
          class: "ls-achievement-reward",
          text: `+${def.researchReward} RESEARCH`,
        }),
      ])
    );
    this.el.classList.add("visible");
    window.setTimeout(() => {
      this.el.classList.remove("visible");
      window.setTimeout(() => this.next(), 300);
    }, 3200);
  }
}
