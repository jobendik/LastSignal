import type { Game } from "../core/Game";
import { MainMenu } from "./MainMenu";
import { SectorSelect } from "./SectorSelect";
import { HUD } from "./HUD";
import { BuildMenu } from "./BuildMenu";
import { TowerPanel } from "./TowerPanel";
import { WavePreviewPanel } from "./WavePreviewPanel";
import { RewardScreen } from "./RewardScreen";
import { PauseMenu } from "./PauseMenu";
import { GameOverScreen } from "./GameOverScreen";
import { VictoryScreen } from "./VictoryScreen";
import { SettingsPanel } from "./SettingsPanel";
import { MetaPanel } from "./MetaPanel";
import { AchievementToast } from "./AchievementToast";
import { KillFeed } from "./KillFeed";
import { SubtitleOverlay } from "./SubtitleOverlay";
import { TutorialOverlay } from "./TutorialOverlay";
import { SectorBriefingOverlay } from "./SectorBriefingOverlay";
import { GuidanceOverlay } from "./GuidanceOverlay";
import { MobileShell } from "./mobile/MobileShell";
import { el, clear } from "./dom";
import type { CodexPanel } from "./CodexPanel";
import type { HelpCategoryId } from "../data/help";

type CodexTab = HelpCategoryId | "threats";

interface CodexPanelHandle {
  el: HTMLElement;
  openAt(tab: CodexTab): void;
  refresh(): void;
}

/**
 * Orchestrates all UI panels. Each panel is a small DOM component that
 * shows/hides in response to state:changed events.
 */
export class UIManager {
  root: HTMLElement;
  mainMenu: MainMenu;
  sectorSelect: SectorSelect;
  hud: HUD;
  buildMenu: BuildMenu;
  towerPanel: TowerPanel;
  wavePreview: WavePreviewPanel;
  rewardScreen: RewardScreen;
  pauseMenu: PauseMenu;
  gameOver: GameOverScreen;
  victory: VictoryScreen;
  settingsPanel: SettingsPanel;
  codexPanel: CodexPanelHandle;
  metaPanel: MetaPanel;
  achievementToast: AchievementToast;
  killFeed: KillFeed;
  subtitles: SubtitleOverlay;
  tutorial: TutorialOverlay;
  sectorBriefing: SectorBriefingOverlay;
  guidanceOverlay: GuidanceOverlay;
  mobileShell: MobileShell | null = null;
  private loadedCodexPanel: CodexPanel | null = null;
  private codexPanelPromise: Promise<CodexPanel> | null = null;

  constructor(private readonly game: Game) {
    this.root = game.uiRoot;

    this.mainMenu = new MainMenu(game);
    this.sectorSelect = new SectorSelect(game);
    this.hud = new HUD(game);
    this.buildMenu = new BuildMenu(game);
    this.towerPanel = new TowerPanel(game);
    this.wavePreview = new WavePreviewPanel(game);
    this.rewardScreen = new RewardScreen(game);
    this.pauseMenu = new PauseMenu(game);
    this.gameOver = new GameOverScreen(game);
    this.victory = new VictoryScreen(game);
    this.settingsPanel = new SettingsPanel(game);
    this.codexPanel = this.createCodexPanelHandle();
    this.metaPanel = new MetaPanel(game);
    this.achievementToast = new AchievementToast(game);
    this.killFeed = new KillFeed(game);
    this.subtitles = new SubtitleOverlay(game);
    this.tutorial = new TutorialOverlay(game);
    this.sectorBriefing = new SectorBriefingOverlay(game);
    this.guidanceOverlay = new GuidanceOverlay(game);
    if (game.isMobile) {
      this.mobileShell = new MobileShell(game);
    }
  }

  attach(): void {
    this.root.append(
      this.mainMenu.el,
      this.sectorSelect.el,
      this.hud.el,
      this.buildMenu.el,
      this.towerPanel.el,
      this.wavePreview.el,
      this.rewardScreen.el,
      this.pauseMenu.el,
      this.gameOver.el,
      this.victory.el,
      this.settingsPanel.el,
      this.codexPanel.el,
      this.metaPanel.el,
      this.killFeed.el,
      this.achievementToast.el,
      this.subtitles.el,
      this.tutorial.el,
      this.sectorBriefing.el,
      this.guidanceOverlay.el
    );
    if (this.mobileShell) this.root.append(this.mobileShell.el);
    this.root.addEventListener("pointerover", (e) => {
      const target = e.target as Element | null;
      const button = target?.closest("button");
      if (!button) return;
      const related = e.relatedTarget as Node | null;
      if (related && button.contains(related)) return;
      this.game.audio.sfxUiHover();
    });
    this.root.addEventListener("click", (e) => {
      const target = e.target as Element | null;
      if (target?.closest("button")) this.game.audio.sfxUiClick();
    });
    this.game.bus.on<{ prev: string; next: string }>("state:changed", (p) => this.onState(p));
    this.game.bus.on("ui:mainMenuConfirm", () => this.game.setState("SECTOR_SELECT"));
    this.game.bus.on("ui:toggleWavePreview", () => this.wavePreview.toggle());
    this.game.bus.on("ui:esc", () => this.onEscape());
    this.onState({ prev: "BOOT", next: this.game.state });
  }

  private onState({ next }: { prev: string; next: string }): void {
    const all = [
      this.mainMenu, this.sectorSelect, this.hud, this.buildMenu, this.towerPanel,
      this.wavePreview, this.rewardScreen, this.pauseMenu, this.gameOver,
      this.victory, this.settingsPanel, this.codexPanel, this.metaPanel,
      this.killFeed,
    ];
    for (const p of all) p.el.classList.remove("visible");

    switch (next) {
      case "MAIN_MENU":
        this.mainMenu.el.classList.add("visible");
        this.mainMenu.refresh();
        break;
      case "SECTOR_SELECT":
        this.sectorSelect.el.classList.add("visible");
        this.sectorSelect.refresh();
        break;
      case "PLANNING":
      case "WAVE_ACTIVE":
        this.hud.el.classList.add("visible");
        this.buildMenu.el.classList.add("visible");
        this.killFeed.el.classList.add("visible");
        this.hud.refresh();
        this.buildMenu.refresh();
        break;
      case "PAUSED":
        this.hud.el.classList.add("visible");
        this.buildMenu.el.classList.add("visible");
        this.pauseMenu.el.classList.add("visible");
        this.pauseMenu.focusFirst();
        break;
      case "REWARD_CHOICE":
        this.hud.el.classList.add("visible");
        this.rewardScreen.el.classList.add("visible");
        this.rewardScreen.refresh();
        break;
      case "WAVE_COMPLETE":
        this.hud.el.classList.add("visible");
        this.buildMenu.el.classList.add("visible");
        this.killFeed.el.classList.add("visible");
        break;
      case "GAME_OVER":
        this.gameOver.el.classList.add("visible");
        this.gameOver.refresh();
        break;
      case "VICTORY":
        this.victory.el.classList.add("visible");
        this.victory.refresh();
        break;
    }
  }

  openSettings(): void {
    this.settingsPanel.el.classList.add("visible");
    this.settingsPanel.focusFirst();
    this.game.audio.sfxPanel(true);
  }
  closeSettings(): void {
    this.settingsPanel.el.classList.remove("visible");
    this.game.audio.sfxPanel(false);
  }
  openCodex(): void {
    // Cancel any in-flight build / squad / relay mode so the overlay can't
    // accidentally inherit a click-to-build state when it closes.
    if (this.game.input) {
      this.game.input.selectedTowerType = null;
      this.game.input.showPlacementPreview = false;
    }
    if (this.game.core) {
      this.game.core.coreDeployMode = false;
      this.game.core.killZoneMode = false;
    }
    if (this.game.squads) {
      this.game.squads.cancelCommand();
    }
    this.codexPanel.el.classList.add("visible");
    if (this.loadedCodexPanel) {
      this.loadedCodexPanel.refresh();
    } else {
      this.renderCodexPanelLoading();
      void this.ensureCodexPanel().then((panel) => {
        if (panel.el.classList.contains("visible")) panel.refresh();
      });
    }
    this.game.audio.sfxPanel(true);
  }
  closeCodex(): void {
    this.codexPanel.el.classList.remove("visible");
    this.game.audio.sfxPanel(false);
  }
  openMeta(): void {
    this.metaPanel.el.classList.add("visible");
    this.metaPanel.refresh();
    this.game.audio.sfxPanel(true);
  }
  closeMeta(): void {
    this.metaPanel.el.classList.remove("visible");
    this.game.audio.sfxPanel(false);
  }

  private onEscape(): void {
    if (this.settingsPanel.el.classList.contains("visible")) {
      this.closeSettings();
      return;
    }
    if (this.codexPanel.el.classList.contains("visible")) {
      this.closeCodex();
      return;
    }
    if (this.metaPanel.el.classList.contains("visible")) {
      this.closeMeta();
      return;
    }
    if (this.game.state === "PAUSED") {
      this.game.togglePause();
      return;
    }
    if (this.game.state === "SECTOR_SELECT") {
      if (!this.sectorSelect.onEscape()) this.game.setState("MAIN_MENU");
    }
  }

  private createCodexPanelHandle(): CodexPanelHandle {
    return {
      el: el("div", { class: "ls-overlay ls-codex" }),
      openAt: (tab) => {
        void this.openCodexAt(tab);
      },
      refresh: () => {
        if (this.loadedCodexPanel) this.loadedCodexPanel.refresh();
        else this.renderCodexPanelLoading();
      },
    };
  }

  private async openCodexAt(tab: CodexTab): Promise<void> {
    this.openCodex();
    const panel = await this.ensureCodexPanel();
    panel.openAt(tab);
  }

  private ensureCodexPanel(): Promise<CodexPanel> {
    if (this.loadedCodexPanel) return Promise.resolve(this.loadedCodexPanel);
    this.codexPanelPromise ??= import("./CodexPanel").then(({ CodexPanel }) => {
      const panel = new CodexPanel(this.game);
      const wasVisible = this.codexPanel.el.classList.contains("visible");
      this.codexPanel.el.replaceWith(panel.el);
      this.codexPanel.el = panel.el;
      if (wasVisible) panel.el.classList.add("visible");
      this.loadedCodexPanel = panel;
      return panel;
    });
    return this.codexPanelPromise;
  }

  private renderCodexPanelLoading(): void {
    clear(this.codexPanel.el);
    const card = el("div", { class: "ls-codex-card-root" });
    const header = el("div", { class: "ls-codex-header" });
    header.append(
      el("div", { class: "ls-overlay-title", text: "FIELD MANUAL" }),
      el("div", { class: "ls-codex-subtitle", text: "Loading reference interface..." })
    );
    const closeRow = el("div", { class: "ls-codex-close-row" });
    const close = el("button", { class: "ls-btn ls-btn-ghost", text: "CLOSE" });
    close.title = "Close (Esc / H)";
    close.onclick = () => this.closeCodex();
    closeRow.append(close);
    header.append(closeRow);
    card.append(
      header,
      el("div", {
        class: "ls-codex-body",
        html: `<div class="ls-help-section"><div class="ls-help-section-title">LINKING</div><div class="ls-help-section-subtitle">Opening the field manual module.</div></div>`,
      })
    );
    this.codexPanel.el.append(card);
  }
}
