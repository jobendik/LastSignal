import type { Game } from "../core/Game";
import type { SectorDefinition } from "../core/Types";
import { sectorDefinitions } from "../data/sectors";
import { difficultyDefinitions, difficultyOrder } from "../data/difficulty";
import { loadoutDefinitions, type LoadoutDefinition } from "../data/loadouts";
import { el, clear } from "./dom";

export class SectorSelect {
  el: HTMLElement;
  private endlessRequested = false;
  private pendingSector: SectorDefinition | null = null;

  constructor(private readonly game: Game) {
    this.el = el("div", { class: "ls-panel ls-sector-select" });
  }

  refresh(): void {
    this.pendingSector = null;
    clear(this.el);
    this.el.append(
      el("div", { class: "ls-title", text: "Select Sector" }),
      el("div", { class: "ls-subtitle", text: "Choose where to defend the signal." })
    );

    this.el.append(this.buildDifficultyPicker());

    const grid = el("div", { class: "ls-sector-grid ls-sector-starmap" });
    for (const s of sectorDefinitions) {
      const card = el("button", { class: "ls-sector-card" });
      card.style.borderColor = s.accentColor;
      const preview = this.buildMapPreview(s);
      card.append(
        preview,
        el("div", { class: "ls-sector-name", text: s.name }),
        el("div", { class: "ls-sector-desc", text: s.description }),
        el("div", { class: "ls-sector-lore", text: s.lore ?? "" }),
        el("div", {
          class: "ls-sector-meta",
          html: `<span>${s.waves.length} waves</span> · <span>Core ${s.coreIntegrity}</span> · <span>Credits ${s.startingCredits}</span>`,
        })
      );
      card.onclick = () => this.showLoadoutPicker(s);
      grid.append(card);
    }
    this.el.append(grid);

    // Endless toggle — only if research unlocked.
    if (this.game.meta.aggregate().hasEndless) {
      const endlessRow = el("div", { class: "ls-endless-row" });
      const toggle = el("button", {
        class: "ls-btn ls-btn-endless",
        text: this.endlessRequested ? "ENDLESS: ON" : "ENDLESS: OFF",
      });
      toggle.onclick = () => {
        this.endlessRequested = !this.endlessRequested;
        this.refresh();
      };
      endlessRow.append(
        toggle,
        el("span", {
          class: "ls-endless-note",
          text: `Best wave: ${this.game.core.profile.endlessBestWave}`,
        })
      );
      this.el.append(endlessRow);
    }

    const buttons = el("div", { class: "ls-sector-buttons" });
    const back = el("button", { class: "ls-btn ls-btn-ghost", text: "← Back" });
    back.onclick = () => this.game.setState("MAIN_MENU");
    const research = el("button", { class: "ls-btn", text: "RESEARCH" });
    research.onclick = () => this.game.ui.openMeta();
    buttons.append(back, research);
    this.el.append(buttons);
  }

  private showLoadoutPicker(sector: SectorDefinition): void {
    this.pendingSector = sector;
    clear(this.el);

    this.el.append(
      el("div", { class: "ls-title ls-title-sm", text: "CHOOSE LOADOUT" }),
      el("div", { class: "ls-subtitle", text: `Deploying to: ${sector.name}` })
    );

    const grid = el("div", { class: "ls-loadout-grid" });
    for (const loadout of loadoutDefinitions) {
      grid.append(this.buildLoadoutCard(loadout, sector));
    }
    this.el.append(grid);

    const backBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "← Back to Sectors" });
    backBtn.onclick = () => this.refresh();
    const wrap = el("div", { class: "ls-sector-buttons" });
    wrap.append(backBtn);
    this.el.append(wrap);
  }

  private buildLoadoutCard(loadout: LoadoutDefinition, sector: SectorDefinition): HTMLElement {
    const card = el("button", { class: "ls-loadout-card" });
    card.style.setProperty("--loadout-color", loadout.accentColor);
    card.style.borderColor = loadout.accentColor;

    card.append(
      el("div", { class: "ls-loadout-name", text: loadout.name }),
      el("div", { class: "ls-loadout-desc", text: loadout.description }),
      el("div", { class: "ls-loadout-detail", text: loadout.detail }),
      el("div", { class: "ls-loadout-flavor", text: `"${loadout.flavor}"` })
    );
    card.onclick = () => {
      this.game.beginSector(sector, {
        endless: this.endlessRequested,
        loadoutId: loadout.id,
      });
    };
    return card;
  }

  private buildMapPreview(sector: SectorDefinition): HTMLElement {
    const preview = el("div", { class: "ls-sector-preview" });
    preview.style.borderColor = sector.accentColor;
    for (let r = 0; r < sector.layout.length; r += 2) {
      const row = el("div", { class: "ls-sector-preview-row" });
      for (let c = 0; c < sector.layout[r]!.length; c += 2) {
        const ch = sector.layout[r]![c]!;
        row.append(el("span", { class: `ls-sector-px ${this.previewClass(ch)}` }));
      }
      preview.append(row);
    }
    return preview;
  }

  private previewClass(ch: string): string {
    if (ch === "#") return "rock";
    if (ch === "C") return "crystal";
    if (ch === "X") return "core";
    if ("NESW".includes(ch)) return "spawn";
    return "empty";
  }

  private buildDifficultyPicker(): HTMLElement {
    const wrap = el("div", { class: "ls-diff-picker" });
    wrap.append(
      el("div", { class: "ls-diff-label", text: "DIFFICULTY" })
    );
    const row = el("div", { class: "ls-diff-row ls-diff-slider" });
    const current = this.game.difficulty.current;
    for (const id of difficultyOrder) {
      const def = difficultyDefinitions[id];
      const btn = el("button", { class: "ls-diff-chip" });
      btn.style.borderColor = def.accentColor;
      if (id === current) btn.classList.add("active");
      btn.append(
        el("div", { class: "ls-diff-name", text: def.name }),
        el("div", { class: "ls-diff-desc", text: def.description })
      );
      btn.onclick = () => {
        this.game.difficulty.select(id);
        this.refresh();
      };
      row.append(btn);
    }
    wrap.append(row);
    return wrap;
  }
}
