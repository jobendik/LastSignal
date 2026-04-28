import { Events } from '../core/Events';
import { Logger, setLogLevel } from '../core/Logger';
import { InputManager } from '../engine/InputManager';
import { SaveSystem, type Settings } from '../engine/SaveSystem';
import { AudioManager } from '../engine/AudioManager';
import { ThreeApp } from '../three/ThreeApp';
import { InvestigationScene } from '../scene/InvestigationScene';
import { MainMenu, PauseMenu, SettingsPanel, HelpOverlay, LoadingScreen, EndingScreen } from '../ui/Menus';

/**
 * GameApp — top-level orchestrator. Boots the renderer, handles scene
 * transitions (menu → investigation → ending), and owns the main loop.
 */
export class GameApp {
  private canvas: HTMLCanvasElement;
  private uiRoot: HTMLDivElement;
  private three!: ThreeApp;
  private input!: InputManager;
  private audio = new AudioManager();
  private save = new SaveSystem();

  private mainMenu: MainMenu | null = null;
  private pauseMenu: PauseMenu | null = null;
  private settingsPanel: SettingsPanel | null = null;
  private helpOverlay: HelpOverlay | null = null;
  private endingScreen: EndingScreen | null = null;
  private scene: InvestigationScene | null = null;

  private settings: Settings;
  private paused = false;
  private lastTime = 0;
  private raf = 0;
  private fadeOverlay!: HTMLDivElement;
  private readonly globalOffs: (() => void)[] = [];
  private readonly sceneOffs: (() => void)[] = [];

  constructor(host: HTMLElement) {
    // Prefer the pre-existing DOM nodes from index.html; create them if missing.
    this.canvas = (host.querySelector('#game-canvas') as HTMLCanvasElement | null)
      ?? (() => { const c = document.createElement('canvas'); c.id = 'game-canvas'; host.appendChild(c); return c; })();
    this.uiRoot = (host.querySelector('#ui-root') as HTMLDivElement | null)
      ?? (() => { const d = document.createElement('div'); d.id = 'ui-root'; host.appendChild(d); return d; })();

    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.className = 'fade-overlay';
    this.uiRoot.appendChild(this.fadeOverlay);

    this.settings = this.save.loadSettings();
    const meta = import.meta as unknown as { env?: { DEV?: boolean } };
    if (meta.env?.DEV) setLogLevel('debug');
  }

  async boot(): Promise<void> {
    const loader = new LoadingScreen(this.uiRoot);
    loader.setProgress(0.1, 'initialising renderer');

    this.three = new ThreeApp(this.canvas);
    this.input = new InputManager(this.canvas);

    loader.setProgress(0.5, 'renderer ready · awaiting audio');

    // Wire global pause/help/debug
    this.globalOffs.push(Events.on('ui:pauseToggle', () => this.togglePause()));

    loader.setProgress(1.0, 'ready');
    window.setTimeout(() => loader.close(), 200);

    this.showMainMenu();

    // Main loop
    this.lastTime = performance.now() / 1000;
    this.raf = requestAnimationFrame(this.tick);
    Logger.info('GameApp', 'booted');
  }

  private tick = (): void => {
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now() / 1000;
    let dt = now - this.lastTime;
    // Clamp dt to avoid huge jumps after tab switches
    if (dt > 0.1) dt = 0.1;
    this.lastTime = now;

    if (this.scene && !this.paused) {
      this.scene.update(dt, now);
    }
    this.three.render();
  };

  // ---------- menu flow ----------

  private showMainMenu(): void {
    this.tearDownScene();
    if (this.mainMenu) return;
    this.mainMenu = new MainMenu(this.uiRoot, this.save, (action) => {
      switch (action) {
        case 'continue': this.startGame(true); break;
        case 'new':      this.save.reset(); this.startGame(false); break;
        case 'settings': this.openSettings(() => {}); break;
        case 'help':     this.openHelp(() => {}); break;
        case 'reset':    this.save.reset(); this.mainMenu?.setHasSave(false); break;
      }
    });
  }

  private async startGame(restore: boolean): Promise<void> {
    this.clearSceneEventHandlers();
    // Unlock audio on user gesture
    try { await this.audio.unlock(); }
    catch (err) { Logger.warn('GameApp', 'audio unlock failed', err); }

    // Apply settings to audio
    this.audio.graph.setMasterVolume(this.settings.master);
    this.audio.graph.setSfxVolume(this.settings.sfx);
    this.audio.graph.setMusicVolume(this.settings.music);

    // Start ambience
    this.audio.ambience.start();

    // Build scene
    this.scene = new InvestigationScene(this.three, this.audio, this.input, this.uiRoot);
    this.scene.applySettings(this.settings);

    // Restore save if requested
    if (restore) {
      const data = this.save.load();
      if (data) {
        this.scene.restore({
          clues: data.discoveredClues,
          steps: data.puzzleSteps,
          drawerUnlocked: data.drawerUnlocked,
          endingStarted: data.endingStarted,
          readDocuments: data.readDocuments,
          insertedTape: data.insertedTape,
          tapePositions: data.tapePositions,
        });
      }
    }

    // Listen for ending
    this.sceneOffs.push(Events.on('ending:complete', () => this.handleEndingComplete()));

    // Autosave on major events
    this.sceneOffs.push(Events.on('clue:discovered',   () => this.autosave()));
    this.sceneOffs.push(Events.on('drawer:unlocked',   () => this.autosave()));
    this.sceneOffs.push(Events.on('puzzle:stepComplete', () => this.autosave()));
    this.sceneOffs.push(Events.on('document:read',     () => this.autosave()));
    this.sceneOffs.push(Events.on('code:attempted',    ({ correct }) => { if (correct) this.autosave(); }));

    // Close main menu
    this.mainMenu?.destroy();
    this.mainMenu = null;
  }

  private autosave(): void {
    if (!this.scene) return;
    const snap = this.scene.snapshot();
    this.save.save({
      ...this.save.empty(),
      objective: snap.objective,
      discoveredClues: snap.clues,
      readDocuments: snap.readDocuments,
      insertedTape: snap.insertedTape,
      tapePositions: snap.tapePositions,
      puzzleSteps: snap.steps,
      drawerUnlocked: snap.drawerUnlocked,
      endingStarted: snap.endingStarted,
      endingComplete: false,
    });
  }

  private clearSceneEventHandlers(): void {
    for (const off of this.sceneOffs.splice(0)) off();
  }

  private tearDownScene(): void {
    this.clearSceneEventHandlers();
    if (this.scene) {
      this.scene.dispose();
      this.scene = null;
      this.audio.ambience?.stop();
      // Remove any lingering UI children from the scene
      // (HUD elements created as siblings of canvas)
      while (this.uiRoot.children.length > 1) {
        const first = this.uiRoot.firstElementChild;
        if (!first) break;
        // Keep the fade overlay (added first)
        if (first === this.fadeOverlay) {
          const next = this.uiRoot.children[1];
          if (!next) break;
          next.remove();
        } else {
          first.remove();
        }
      }
    }
    this.endingScreen?.close(); this.endingScreen = null;
  }

  private togglePause(): void {
    if (!this.scene) return;
    if (this.paused) {
      this.pauseMenu?.close();
      this.pauseMenu = null;
      this.paused = false;
      return;
    }
    this.paused = true;
    this.pauseMenu = new PauseMenu(
      this.uiRoot,
      () => { this.paused = false; },
      () => this.openSettings(() => { /* keep paused */ }),
      () => { this.paused = false; this.showMainMenu(); },
      () => this.openHelp(() => {}),
    );
    this.pauseMenu.open();
  }

  private openSettings(onClose: () => void): void {
    if (this.settingsPanel?.isOpen) return;
    this.settingsPanel = new SettingsPanel(
      this.uiRoot,
      () => this.settings,
      (s) => {
        this.settings = s;
        this.save.saveSettings(s);
        this.audio.graph.setMasterVolume(s.master);
        this.audio.graph.setSfxVolume(s.sfx);
        this.audio.graph.setMusicVolume(s.music);
        this.scene?.applySettings(s);
        Events.emit('settings:changed', s);
      },
      () => this.save.reset(),
    );
    this.settingsPanel.open(onClose);
  }

  private openHelp(onClose: () => void): void {
    this.helpOverlay = new HelpOverlay(this.uiRoot);
    this.helpOverlay.open(onClose);
  }

  private handleEndingComplete(): void {
    if (this.endingScreen) return;
    // Fade to black, then show ending
    this.fadeOverlay.classList.add('active');
    window.setTimeout(() => {
      this.endingScreen = new EndingScreen(this.uiRoot);
      this.endingScreen.show(() => {
        this.fadeOverlay.classList.remove('active');
        this.endingScreen?.close();
        this.endingScreen = null;
        // Mark save completed
        const s = this.save.load();
        if (s) { s.endingComplete = true; this.save.save(s); }
        this.showMainMenu();
      });
    }, 1400);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.tearDownScene();
    for (const off of this.globalOffs.splice(0)) off();
    this.input?.dispose();
    this.three?.dispose();
  }
}
