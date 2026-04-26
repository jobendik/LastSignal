import type { Game } from "../core/Game";
import { researchNodes } from "../data/research";
import { el, clear } from "./dom";

const CARD_W = 158;
const CARD_H = 72;

// Hand-tuned tree layout: x/y = top-left of card within the tree canvas.
const NODE_POS: Record<string, { x: number; y: number }> = {
  logistics_1:       { x: 10,  y: 60  },
  reinforced_core:   { x: 10,  y: 190 },
  logistics_2:       { x: 230, y: 10  },
  calibrated_optics: { x: 230, y: 100 },
  plasma_metallurgy: { x: 230, y: 190 },
  deep_mining:       { x: 230, y: 280 },
  unlock_railgun:    { x: 230, y: 370 },
  unlock_flamer:     { x: 230, y: 460 },
  unlock_barrier:    { x: 230, y: 550 },
  bountyful:         { x: 230, y: 640 },
  unlock_endless:    { x: 450, y: 190 },
};
const TREE_W = 620;
const TREE_H = 730;

/** Meta-progression research tree rendered as a visual node graph. */
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

    // Header.
    const header = el("div", { class: "ls-meta-header" });
    header.append(
      el("div", { class: "ls-title", text: "Research Array" }),
      el("div", { class: "ls-subtitle", text: "Persistent upgrades carried across runs." }),
      el("div", { class: "ls-meta-points", text: `RESEARCH POINTS: ${prof.researchPoints}` })
    );
    this.el.append(header);

    // Tree container.
    const treeWrap = el("div", { class: "ls-meta-tree-wrap" });
    const tree = el("div", { class: "ls-meta-tree" });
    tree.style.width = `${TREE_W}px`;
    tree.style.height = `${TREE_H}px`;

    // SVG connection layer.
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(TREE_W));
    svg.setAttribute("height", String(TREE_H));
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.pointerEvents = "none";
    svg.style.overflow = "visible";

    // Draw bezier connection lines between prerequisites and their targets.
    for (const node of researchNodes) {
      const toPos = NODE_POS[node.id];
      if (!toPos || !node.requires?.length) continue;
      const unlocked = this.game.meta.isUnlocked(node.id);

      for (const reqId of node.requires) {
        const fromPos = NODE_POS[reqId];
        if (!fromPos) continue;
        const fromUnlocked = this.game.meta.isUnlocked(reqId);

        const x1 = fromPos.x + CARD_W;
        const y1 = fromPos.y + CARD_H / 2;
        const x2 = toPos.x;
        const y2 = toPos.y + CARD_H / 2;
        const cpX = (x1 + x2) / 2;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} C ${cpX} ${y1}, ${cpX} ${y2}, ${x2} ${y2}`);
        path.setAttribute("fill", "none");
        const lineColor = unlocked ? "#4caf50" : fromUnlocked ? "#ffeb3b" : "rgba(102,252,241,0.2)";
        path.setAttribute("stroke", lineColor);
        path.setAttribute("stroke-width", unlocked ? "2" : "1.5");
        path.setAttribute("stroke-dasharray", unlocked ? "none" : fromUnlocked ? "4 3" : "3 5");
        svg.appendChild(path);

        // Arrow head at target end.
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const aw = 5, ah = 6;
        arrow.setAttribute("points", `${x2},${y2} ${x2 - aw},${y2 - ah / 2} ${x2 - aw},${y2 + ah / 2}`);
        arrow.setAttribute("fill", lineColor);
        svg.appendChild(arrow);
      }
    }

    tree.appendChild(svg);

    // Tier column labels.
    const tierLabels: { x: number; label: string }[] = [
      { x: 10 + CARD_W / 2, label: "TIER I" },
      { x: 230 + CARD_W / 2, label: "TIER II" },
      { x: 450 + CARD_W / 2, label: "TIER III" },
    ];
    for (const { x, label } of tierLabels) {
      const lbl = el("div", { class: "ls-meta-tree-tier-label", text: label });
      lbl.style.position = "absolute";
      lbl.style.left = `${x}px`;
      lbl.style.top = "0";
      lbl.style.transform = "translateX(-50%)";
      tree.appendChild(lbl);
    }

    // Node cards.
    for (const node of researchNodes) {
      const pos = NODE_POS[node.id];
      if (!pos) continue;

      const unlocked = this.game.meta.isUnlocked(node.id);
      const canBuy = this.game.meta.canPurchase(node);

      const card = el("button", { class: "ls-meta-node" });
      card.style.position = "absolute";
      card.style.left = `${pos.x}px`;
      card.style.top = `${pos.y}px`;
      card.style.width = `${CARD_W}px`;
      card.style.height = `${CARD_H}px`;

      if (unlocked) card.classList.add("unlocked");
      else if (canBuy) card.classList.add("available");
      else card.classList.add("locked");

      // Status icon.
      const icon = unlocked ? "✓" : canBuy ? "◈" : "◌";
      const iconEl = el("div", { class: "ls-meta-node-icon", text: icon });

      const nameEl = el("div", { class: "ls-meta-node-name", text: node.name });
      const costEl = el("div", {
        class: "ls-meta-node-cost",
        text: unlocked ? "ACQUIRED" : `${node.cost} RP`,
      });

      card.append(iconEl, nameEl, costEl);

      // Tooltip on hover.
      const tip = el("div", { class: "ls-meta-node-tip" });
      tip.append(
        el("div", { class: "ls-meta-node-tip-name", text: node.name }),
        el("div", { class: "ls-meta-node-tip-desc", text: node.description }),
      );
      if (node.requires?.length) {
        const reqNames = node.requires
          .map((rid) => researchNodes.find((n) => n.id === rid)?.name ?? rid)
          .join(", ");
        tip.append(el("div", { class: "ls-meta-node-tip-req", text: `Requires: ${reqNames}` }));
      }
      card.appendChild(tip);

      if (!unlocked && canBuy) {
        card.onclick = () => {
          this.game.meta.purchase(node.id);
          this.refresh();
        };
      } else {
        card.disabled = !canBuy;
      }

      tree.appendChild(card);
    }

    treeWrap.appendChild(tree);
    this.el.append(treeWrap);

    const close = el("button", { class: "ls-btn ls-btn-ghost", text: "← Back" });
    close.onclick = () => this.game.ui.closeMeta();
    this.el.append(close);
  }
}
