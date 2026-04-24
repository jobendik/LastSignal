import type { Game } from "../core/Game";
import { researchNodes } from "../data/research";
import { el, clear } from "./dom";

/** Meta-progression research tree. Persistent across runs. */
export class MetaPanel {
  el: HTMLElement;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-meta-panel" });
    this.game.bus.on("meta:unlocked", () => this.refresh());
    this.game.bus.on("meta:points", () => this.refresh());
  }

  refresh(): void {
    clear(this.el);
    const prof = this.game.core.profile;

    const header = el("div", { class: "ls-meta-header" });
    header.append(
      el("div", { class: "ls-title", text: "Research Array" }),
      el("div", { class: "ls-subtitle", text: "Persistent upgrades unlocked between runs." }),
      el("div", {
        class: "ls-meta-points",
        text: `RESEARCH POINTS: ${prof.researchPoints}`,
      })
    );
    this.el.append(header);

    const tiers: (1 | 2 | 3)[] = [1, 2, 3];
    for (const tier of tiers) {
      const tierNodes = researchNodes.filter((n) => n.tier === tier);
      if (tierNodes.length === 0) continue;
      const row = el("div", { class: "ls-meta-tier" });
      row.append(el("div", { class: "ls-meta-tier-label", text: `TIER ${tier}` }));
      const grid = el("div", { class: "ls-meta-grid" });
      for (const node of tierNodes) {
        const unlocked = this.game.meta.isUnlocked(node.id);
        const canBuy = this.game.meta.canPurchase(node);
        const card = el("button", { class: "ls-meta-card" });
        if (unlocked) card.classList.add("unlocked");
        if (!unlocked && canBuy) card.classList.add("available");
        if (!unlocked && !canBuy) card.classList.add("locked");

        const reqLabel = (node.requires ?? []).map((r) => r).join(", ");
        card.append(
          el("div", { class: "ls-meta-card-name", text: node.name }),
          el("div", { class: "ls-meta-card-desc", text: node.description }),
          el("div", {
            class: "ls-meta-card-meta",
            text: unlocked
              ? "ACQUIRED"
              : `Cost: ${node.cost}${reqLabel ? ` · Needs: ${reqLabel}` : ""}`,
          })
        );
        if (!unlocked && canBuy) {
          card.onclick = () => {
            this.game.meta.purchase(node.id);
            this.refresh();
          };
        }
        grid.append(card);
      }
      row.append(grid);
      this.el.append(row);
    }

    const close = el("button", { class: "ls-btn ls-btn-ghost", text: "← Back" });
    close.onclick = () => this.game.ui.closeMeta();
    this.el.append(close);
  }
}
