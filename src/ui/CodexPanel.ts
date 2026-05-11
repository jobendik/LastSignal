import type { Game } from "../core/Game";
import { enemyDefinitions, enemyOrder } from "../data/enemies";
import type { CodexEntry, EnemyType } from "../core/Types";
import type { HelpCategoryId, HelpCategory } from "../data/help";
import { el, clear } from "./dom";

interface CodexPanelData {
  codexEntries: Record<EnemyType, CodexEntry>;
  helpCategories: HelpCategory[];
}

/**
 * Codex / Help screen.
 *
 * Tabbed reference manual with two top-level modes:
 *   1. HELP categories — design-driven topic explanations (Basics, Signal
 *      Network, Strategic Points, Hostile Structures, Squads, Tower
 *      Durability, Command Tier, Enemies, Controls, Sector Types).
 *   2. THREAT codex — per-enemy detail, unlocked by encounter.
 *
 * The tab list lives at the top, the active category renders below. Escape
 * closes the overlay (handled in InputSystem). The panel does not block
 * gameplay simulation while open — the screen still updates underneath, but
 * input is captured by the overlay so accidental builds/squad deploys are
 * impossible while the codex is in front.
 */
export class CodexPanel {
  el: HTMLElement;
  private activeTab: HelpCategoryId | "threats" = "basics";
  private data: CodexPanelData | null = null;
  private dataPromise: Promise<CodexPanelData> | null = null;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-overlay ls-codex" });
    // Click outside the inner card closes the codex (tap-to-dismiss).
    this.el.addEventListener("click", (e) => {
      if (e.target === this.el) this.game.ui.closeCodex();
    });
  }

  /** Open at a specific tab (used by tutorial 'Open Codex' shortcuts). */
  openAt(tab: HelpCategoryId | "threats"): void {
    this.activeTab = tab;
    this.refresh();
  }

  refresh(): void {
    clear(this.el);

    if (!this.data) {
      this.renderLoading();
      void this.loadData().then(() => {
        if (this.el.classList.contains("visible")) this.refresh();
      });
      return;
    }

    // Inner card so click-outside-to-close works without the entire body
    // counting as the close target.
    const card = el("div", { class: "ls-codex-card-root" });

    // Header row with title + close button.
    const header = el("div", { class: "ls-codex-header" });
    header.append(
      el("div", { class: "ls-overlay-title", text: "FIELD MANUAL" }),
      el("div", {
        class: "ls-codex-subtitle",
        text: "Quick reference for every system Last Signal asks you to manage. Esc or H closes.",
      })
    );
    const closeRow = el("div", { class: "ls-codex-close-row" });
    const close = el("button", { class: "ls-btn ls-btn-ghost", text: "✕ CLOSE" });
    close.title = "Close (Esc / H)";
    close.onclick = () => this.game.ui.closeCodex();
    closeRow.append(close);
    header.append(closeRow);
    card.append(header);

    // Tab strip — help categories first, then threats.
    const tabs = el("div", { class: "ls-codex-tabs" });
    for (const cat of this.data.helpCategories) {
      const tab = el("button", {
        class: `ls-codex-tab${this.activeTab === cat.id ? " active" : ""}`,
        text: cat.label,
      });
      tab.style.borderColor = cat.color;
      if (this.activeTab === cat.id) tab.style.color = cat.color;
      tab.title = cat.subtitle;
      tab.onclick = () => {
        this.activeTab = cat.id;
        this.refresh();
      };
      tabs.append(tab);
    }
    const threatTab = el("button", {
      class: `ls-codex-tab${this.activeTab === "threats" ? " active" : ""}`,
      text: "THREATS",
    });
    threatTab.style.borderColor = "#ff5252";
    if (this.activeTab === "threats") threatTab.style.color = "#ff5252";
    threatTab.title = "Per-enemy threat codex (unlocked on first encounter).";
    threatTab.onclick = () => {
      this.activeTab = "threats";
      this.refresh();
    };
    tabs.append(threatTab);
    card.append(tabs);

    // Body.
    const body = el("div", { class: "ls-codex-body" });
    if (this.activeTab === "threats") {
      body.append(this.renderThreats());
    } else {
      const cat = this.data.helpCategories.find((c) => c.id === this.activeTab);
      if (cat) body.append(this.renderHelpCategory(cat));
    }
    card.append(body);

    this.el.append(card);
  }

  private loadData(): Promise<CodexPanelData> {
    if (this.data) return Promise.resolve(this.data);
    this.dataPromise ??= Promise.all([
      import("../data/codex"),
      import("../data/help"),
    ]).then(([codex, help]) => {
      const data = {
        codexEntries: codex.codexEntries,
        helpCategories: help.helpCategories,
      };
      this.data = data;
      return data;
    });
    return this.dataPromise;
  }

  private renderLoading(): void {
    const card = el("div", { class: "ls-codex-card-root" });
    const header = el("div", { class: "ls-codex-header" });
    header.append(
      el("div", { class: "ls-overlay-title", text: "FIELD MANUAL" }),
      el("div", {
        class: "ls-codex-subtitle",
        text: "Loading reference archive...",
      })
    );
    const closeRow = el("div", { class: "ls-codex-close-row" });
    const close = el("button", { class: "ls-btn ls-btn-ghost", text: "CLOSE" });
    close.title = "Close (Esc / H)";
    close.onclick = () => this.game.ui.closeCodex();
    closeRow.append(close);
    header.append(closeRow);
    card.append(
      header,
      el("div", {
        class: "ls-codex-body",
        html: `<div class="ls-help-section"><div class="ls-help-section-title">DECRYPTING</div><div class="ls-help-section-subtitle">Fetching codex and field manual data.</div></div>`,
      })
    );
    this.el.append(card);
  }

  private renderHelpCategory(cat: HelpCategory): HTMLElement {
    const wrap = el("div", { class: "ls-help-section" });
    const title = el("div", { class: "ls-help-section-title" });
    title.style.color = cat.color;
    title.textContent = cat.label;
    wrap.append(
      title,
      el("div", { class: "ls-help-section-subtitle", text: cat.subtitle })
    );
    const list = el("div", { class: "ls-help-entry-list" });
    for (const entry of cat.entries) {
      const card = el("div", { class: "ls-help-entry" });
      card.style.borderColor = entry.color ?? cat.color;
      card.append(
        el("div", { class: "ls-help-entry-title", text: entry.title })
      );
      for (const para of entry.body) {
        card.append(el("div", { class: "ls-help-entry-body", text: para }));
      }
      if (entry.bullets && entry.bullets.length > 0) {
        const ul = el("ul", { class: "ls-help-entry-bullets" });
        for (const b of entry.bullets) {
          const li = document.createElement("li");
          li.textContent = b;
          ul.append(li);
        }
        card.append(ul);
      }
      if (entry.tip) {
        card.append(el("div", { class: "ls-help-entry-tip", text: `Tip: ${entry.tip}` }));
      }
      list.append(card);
    }
    wrap.append(list);
    return wrap;
  }

  private renderThreats(): HTMLElement {
    const wrap = el("div", { class: "ls-help-section" });
    const title = el("div", { class: "ls-help-section-title" });
    title.style.color = "#ff5252";
    title.textContent = "THREAT CODEX";
    wrap.append(
      title,
      el("div", {
        class: "ls-help-section-subtitle",
        text: "Per-enemy threat profile. Entries unlock the first time you encounter the unit in any sector.",
      })
    );
    const grid = el("div", { class: "ls-codex-grid" });
    for (const id of enemyOrder) {
      const def = enemyDefinitions[id];
      const seen = this.game.codex.has(id);
      const entry = this.data!.codexEntries[id];
      const cardEl = el("div", { class: `ls-codex-card${seen ? "" : " locked"}` });
      cardEl.style.borderColor = seen ? def.color : "#444";
      if (seen) {
        cardEl.append(
          el("div", { class: "ls-codex-name", text: def.name }),
          el("div", { class: "ls-codex-role", text: def.role }),
          el("div", {
            class: "ls-codex-hp",
            html:
              `<span>HP <b>${def.hp}</b></span><span>SPD <b>${def.speed}</b></span><span>REW <b>${def.reward}</b></span>`,
          }),
          el("div", { class: "ls-codex-desc", text: def.description }),
          el("div", { class: "ls-codex-threat", text: entry.threatHeadline }),
          el("div", { class: "ls-codex-counters", text: "Counters: " + entry.counters.join(", ") }),
          el("div", { class: "ls-codex-tip", text: "Tip: " + entry.tip })
        );
      } else {
        cardEl.append(
          el("div", { class: "ls-codex-name", text: "??? UNKNOWN" }),
          el("div", {
            class: "ls-codex-desc",
            text: "Threat profile unavailable. Encounter this anomaly during a mission to unlock.",
          })
        );
      }
      grid.append(cardEl);
    }
    wrap.append(grid);
    return wrap;
  }
}
