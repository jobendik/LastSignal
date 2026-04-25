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
import { CodexPanel } from "./CodexPanel";
import { MetaPanel } from "./MetaPanel";
import { AchievementToast } from "./AchievementToast";
import { KillFeed } from "./KillFeed";
import { SubtitleOverlay } from "./SubtitleOverlay";

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
  codexPanel: CodexPanel;
  metaPanel: MetaPanel;
  achievementToast: AchievementToast;
  killFeed: KillFeed;
  subtitles: SubtitleOverlay;

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
    this.codexPanel = new CodexPanel(game);
    this.metaPanel = new MetaPanel(game);
    this.achievementToast = new AchievementToast(game);
    this.killFeed = new KillFeed(game);
    this.subtitles = new SubtitleOverlay(game);
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
      this.subtitles.el
    );
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
    this.game.audio.sfxPanel(true);
  }
  closeSettings(): void {
    this.settingsPanel.el.classList.remove("visible");
    this.game.audio.sfxPanel(false);
  }
  openCodex(): void {
    this.codexPanel.el.classList.add("visible");
    this.codexPanel.refresh();
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
}
