import type { Game } from "../core/Game";
import { enemyDefinitions } from "../data/enemies";
import { el, clear } from "./dom";

interface KillFeedEntry {
  id: number;
  text: string;
  detail: string;
  kind: "normal" | "special";
}

export class KillFeed {
  el: HTMLElement;
  private entries: KillFeedEntry[] = [];
  private nextId = 1;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-kill-feed" });

    game.bus.on<{ type: string; towerType?: string; damage?: number; isBoss?: boolean }>(
      "enemy:killed",
      (p) => {
        if (!p) return;
        const enemy = enemyDefinitions[p.type as keyof typeof enemyDefinitions];
        const enemyName = enemy?.name ?? p.type;
        const tower = (p.towerType ?? "unknown").toUpperCase();
        this.add({
          text: `${tower} -> ${enemyName.toUpperCase()}`,
          detail: `${p.damage ?? 0} damage`,
          kind: p.isBoss ? "special" : "normal",
        });
      }
    );
    game.bus.on("boss:killed", () => {
      this.add({ text: "LEVIATHAN SLAIN", detail: "Boss neutralized", kind: "special" }, 5200);
    });
    game.bus.on<{ streak: number }>("kill:streak", (p) => {
      if (!p) return;
      this.add({ text: `CHAIN KILL x${p.streak}`, detail: "Rapid eliminations", kind: "special" }, 4200);
    });
    game.bus.on("wave:perfect", () => {
      this.add({ text: "PERFECT WAVE", detail: "No core damage taken", kind: "special" }, 4600);
    });
  }

  private add(entry: Omit<KillFeedEntry, "id">, ttl = 3200): void {
    const full = { ...entry, id: this.nextId++ };
    this.entries.unshift(full);
    this.entries = this.entries.slice(0, 8);
    this.render();
    setTimeout(() => {
      this.entries = this.entries.filter((x) => x.id !== full.id);
      this.render();
    }, ttl);
  }

  private render(): void {
    clear(this.el);
    for (const entry of this.entries) {
      this.el.append(
        el("div", { class: `ls-kill-entry ${entry.kind}` }, [
          el("div", { class: "ls-kill-text", text: entry.text }),
          el("div", { class: "ls-kill-detail", text: entry.detail }),
        ])
      );
    }
  }
}
