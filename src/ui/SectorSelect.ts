import type { Game } from "../core/Game";
import type { SectorDefinition } from "../core/Types";
import {
  loadTrainingSectorDefinition,
  sectorDefinitions,
  trainingSectorCardDefinition,
} from "../data/sectors";
import { difficultyDefinitions, difficultyOrder } from "../data/difficulty";
import { loadoutDefinitions, type LoadoutDefinition } from "../data/loadouts";
import { sectorObjectives } from "../data/objectives";
import { el, clear } from "./dom";

export class SectorSelect {
  el: HTMLElement;
  private endlessRequested = false;
  private mode: "sectors" | "loadout" = "sectors";

  constructor(private readonly game: Game) {
    this.el = el("div", {
      class: "ls-panel ls-sector-select",
      attrs: { role: "region", "aria-label": "Sector select" },
    });
  }

  refresh(): void {
    this.mode = "sectors";
    clear(this.el);
    this.el.append(
      el("div", { class: "ls-title", text: "Select Sector" }),
      el("div", { class: "ls-subtitle", text: "Choose where to defend the signal." })
    );

    this.el.append(this.buildDifficultyPicker());

    // Training simulation banner — rendered above the campaign grid so it
    // never has to compete with locked sectors for attention. Always
    // available, never gates progression.
    this.el.append(this.buildTrainingCard(trainingSectorCardDefinition));

    const grid = el("div", { class: "ls-sector-grid ls-sector-starmap" });
    const bestCleared = this.game.core.profile.bestSectorCleared;
    const hasEndless = this.game.meta.aggregate().hasEndless;
    sectorDefinitions.forEach((s, i) => {
      // Training is rendered separately above; skip it here so it never
      // appears as a numbered campaign card.
      if (s.isTraining) return;
      const sectorIndex = i + 1; // 1-based
      const isVoid = s.id === "sector_void";
      const isExpanse = s.id === "sector_06_fractured_expanse";
      const isBlackout = s.id === "sector_07_blackout_array";
      // Custom unlock chains so that Sector 6/7 don't accidentally require
      // the (post-game) Void to be cleared first. Sector 6 unlocks once the
      // main campaign is done (best >= 4); Sector 7 needs Sector 6 cleared.
      let isLocked: boolean;
      let lockReason = "";
      if (isVoid) {
        isLocked = bestCleared < 4 || !hasEndless;
        lockReason = "Locked — clear Sector 4 and unlock Endless research.";
      } else if (isExpanse) {
        isLocked = bestCleared < 4;
        lockReason = "Locked — clear Sector 4 first.";
      } else if (isBlackout) {
        // Sector 7 requires Sector 6 cleared. Clearing Sector 6 sets the
        // bestSectorCleared to its sector index (6), so we test against that.
        const sector6Index = sectorDefinitions.findIndex((d) => d.id === "sector_06_fractured_expanse") + 1;
        isLocked = bestCleared < sector6Index;
        lockReason = "Locked — clear Sector 6 first.";
      } else {
        isLocked = sectorIndex > 1 && bestCleared < sectorIndex - 1;
        lockReason = `Locked — clear Sector ${sectorIndex - 1} first.`;
      }
      const isCleared = sectorIndex <= bestCleared;
      const card = el("button", {
        class: "ls-sector-card",
        attrs: { "aria-label": `${s.name}: ${isLocked ? lockReason : "Select sector"}` },
      });
      if (isLocked) card.classList.add("ls-sector-locked");
      if (isCleared) card.classList.add("ls-sector-cleared");
      card.style.borderColor = isLocked ? "#3a3a3a" : s.accentColor;
      const preview = this.buildMapPreview(s);
      const statusText = isLocked
        ? lockReason
        : isCleared
        ? "Cleared"
        : "Available";
      card.append(
        preview,
        el("div", { class: "ls-sector-name", text: s.name }),
        el("div", { class: "ls-sector-desc", text: s.description }),
        el("div", { class: "ls-sector-lore", text: s.lore ?? "" }),
        el("div", { class: "ls-sector-status", text: statusText }),
        el("div", {
          class: "ls-sector-meta",
          html: `<span>${s.waves.length} waves</span> · <span>Core ${s.coreIntegrity}</span> · <span>Credits ${s.startingCredits}</span>`,
        })
      );
      // Objectives + counterplay block (Part 8 — sector card UX).
      const obj = sectorObjectives[s.id];
      if (obj) {
        const block = el("div", { class: "ls-sector-objectives" });
        block.append(
          el("div", { class: "ls-sector-obj-primary", text: `PRIMARY · ${obj.primary.label}` })
        );
        // Cap the rendered secondary list to 4 so massive sectors (Sector 6/7
        // with 8+ objectives) don't visually blow out the card. The full
        // list is still visible in the in-run objectives panel.
        const secList = el("div", { class: "ls-sector-obj-secondary" });
        const secondaryShown = obj.secondary.slice(0, 4);
        for (const sec of secondaryShown) {
          secList.append(el("div", { class: "ls-sector-obj-row", text: `+ ${sec.label}` }));
        }
        if (obj.secondary.length > secondaryShown.length) {
          secList.append(
            el("div", {
              class: "ls-sector-obj-row",
              text: `+ ${obj.secondary.length - secondaryShown.length} more secondary`,
            })
          );
        }
        block.append(secList);
        if (obj.counterplay.length) {
          block.append(
            el("div", { class: "ls-sector-obj-counter", text: `Counter: ${obj.counterplay.join(" · ")}` })
          );
        }
        if (obj.hazards) {
          block.append(el("div", { class: "ls-sector-obj-hazard", text: `Hazard: ${obj.hazards}` }));
        }
        // Surface the "new mechanic" tag here too so the sector picker tells
        // the player upfront when a sector adds a major system.
        const mech = newMechanicForSector(s.id);
        if (mech) {
          block.append(el("div", { class: "ls-sector-obj-mech", text: `NEW · ${mech}` }));
        }
        card.append(block);
      }
      if (isLocked) {
        (card as HTMLButtonElement).disabled = true;
      } else {
        card.onclick = () => this.showLoadoutPicker(s);
      }
      grid.append(card);
    });
    this.el.append(grid);

    // Endless toggle — only if research unlocked.
    if (hasEndless) {
      const endlessRow = el("div", { class: "ls-endless-row" });
      const toggle = el("button", {
        class: "ls-btn ls-btn-endless",
        text: this.endlessRequested ? "ENDLESS: ON" : "ENDLESS: OFF",
        attrs: { "aria-label": "Toggle endless mode" },
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
    back.setAttribute("aria-label", "Back to main menu");
    back.onclick = () => this.game.setState("MAIN_MENU");
    const research = el("button", { class: "ls-btn", text: "RESEARCH" });
    research.setAttribute("aria-label", "Open research");
    research.onclick = () => this.game.ui.openMeta();
    const codex = el("button", { class: "ls-btn ls-btn-ghost", text: "FIELD MANUAL (H)" });
    codex.setAttribute("aria-label", "Open field manual");
    codex.title = "Open the codex to read up on systems before launching.";
    codex.onclick = () => this.game.ui.openCodex();
    buttons.append(back, codex, research);
    this.el.append(buttons);
  }

  private showLoadoutPicker(sector: SectorDefinition): void {
    this.mode = "loadout";
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
    backBtn.setAttribute("aria-label", "Back to sectors");
    backBtn.onclick = () => this.refresh();
    const wrap = el("div", { class: "ls-sector-buttons" });
    wrap.append(backBtn);
    this.el.append(wrap);
  }

  private buildLoadoutCard(loadout: LoadoutDefinition, sector: SectorDefinition): HTMLElement {
    const card = el("button", {
      class: "ls-loadout-card",
      attrs: { "aria-label": `Select ${loadout.name} loadout for ${sector.name}` },
    });
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

  /**
   * Renders the dedicated Training Simulation card. Unlike campaign cards
   * this one is always available, never numbered, and skips the loadout
   * picker — the player launches directly into a fixed training run.
   */
  private buildTrainingCard(sector: typeof trainingSectorCardDefinition): HTMLElement {
    const wrap = el("div", { class: "ls-training-card" });
    wrap.style.borderColor = sector.accentColor;
    const completed = this.game.core.profile.trainingCompleted;
    const stagesCompleted = this.game.core.profile.trainingStagesCompleted;

    const head = el("div", { class: "ls-training-card-head" });
    head.append(
      el("div", { class: "ls-training-tag", text: "OPTIONAL · TRAINING" }),
      el("div", { class: "ls-training-name", text: sector.name }),
      el("div", { class: "ls-training-desc", text: sector.description })
    );
    if (completed) {
      head.append(
        el("div", {
          class: "ls-training-status complete",
          text: `Training Complete · ${stagesCompleted} stage${stagesCompleted === 1 ? "" : "s"} cleared`,
        })
      );
    }
    wrap.append(head);

    const actions = el("div", { class: "ls-training-card-actions" });
    const startBtn = el("button", {
      class: "ls-btn ls-btn-primary",
      text: completed ? "REPLAY TRAINING" : "START TRAINING",
      attrs: { "aria-label": completed ? "Replay training" : "Start training" },
    });
    startBtn.title =
      "Launch the optional training simulation. Eight short drills. No campaign progress required.";
    startBtn.onclick = async () => {
      // Skip the loadout picker — training uses a fixed starting setup.
      startBtn.disabled = true;
      startBtn.textContent = "LOADING TRAINING";
      const trainingSector = await loadTrainingSectorDefinition();
      this.game.beginSector(trainingSector, { endless: false });
    };
    const codexBtn = el("button", { class: "ls-btn ls-btn-ghost", text: "FIELD MANUAL (H)" });
    codexBtn.setAttribute("aria-label", "Open field manual");
    codexBtn.title = "Open the codex for system reference before starting.";
    codexBtn.onclick = () => this.game.ui.openCodex();
    actions.append(startBtn, codexBtn);
    wrap.append(actions);

    return wrap;
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

  // (helper newMechanicForSector lives at module scope below.)

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
      btn.setAttribute("aria-label", `Select ${def.name} difficulty`);
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

  onEscape(): boolean {
    if (this.mode === "loadout") {
      this.refresh();
      return true;
    }
    this.game.setState("MAIN_MENU");
    return true;
  }
}

/**
 * One-line summary of the major mechanic this sector introduces. Returns
 * null for sectors that don't add a new system on top of the basics.
 * Mirrors the same helper inside SectorBriefingOverlay so the sector card
 * and the in-run briefing share the same wording.
 */
function newMechanicForSector(id: string): string | null {
  switch (id) {
    case "sector_03_deep_space_wreckage":
      return "Strategic capture points";
    case "sector_06_fractured_expanse":
      return "Relay expansion + map control";
    case "sector_07_blackout_array":
      return "Hostile suppression + tower durability";
    default:
      return null;
  }
}
