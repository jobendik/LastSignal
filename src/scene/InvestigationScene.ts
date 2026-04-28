import * as THREE from 'three';
import { Events } from '../core/Events';
import type { AudioManager } from '../engine/AudioManager';
import type { InputManager } from '../engine/InputManager';
import type { ThreeApp } from '../three/ThreeApp';
import type { Settings } from '../engine/SaveSystem';
import { FocusSystem, type FocusPose } from '../game/interaction/FocusSystem';
import { InteractionSystem } from '../game/interaction/InteractionSystem';
import { ObjectRegistry, type Interactable } from '../game/interaction/ObjectRegistry';
import { OscilloscopeDevice } from '../game/devices/OscilloscopeDevice';
import { ClueSystem } from '../game/clues/ClueSystem';
import { PuzzleSystem } from '../game/puzzles/PuzzleSystem';
import { TapeDeckHUD } from '../ui/TapeDeckHUD';
import { DocumentView } from '../ui/DocumentView';
import { CodePanelView } from '../ui/CodePanelView';
import { HUDLayer } from '../ui/HUDLayer';
import { NotebookView } from '../ui/NotebookView';
import { DebugOverlay } from '../ui/DebugOverlay';
import { TAPES, FINAL_TAPE, TAPE_C_BANDPASS_TARGET_HZ, TAPE_C_BANDPASS_TOLERANCE_HZ } from '../data/tapes';
import { DOCUMENT_BY_ID } from '../data/documents';
import { Config } from '../app/config';
import {
  buildRoom, buildDesk, buildTapeDeck, buildOscilloscope, buildAudioProcessor,
  buildLamp, buildCassette, buildDocument, buildCodePanel,
} from './PlaceholderModelFactory';

/**
 * InvestigationScene — builds the room, registers all interactables,
 * owns the per-device HUD, and drives the ending sequence.
 *
 * This file is intentionally long because it *is* the integration layer;
 * isolating it here keeps every subordinate system small and testable.
 */
export class InvestigationScene {
  private readonly registry = new ObjectRegistry();
  private readonly focus: FocusSystem;
  private readonly interaction: InteractionSystem;

  private readonly hud: HUDLayer;
  // Notebook is kept mounted for global TAB toggle; reference retained to prevent GC.
  private readonly notebook: NotebookView;
  private readonly deckHud: TapeDeckHUD;
  private readonly docView: DocumentView;
  private readonly codePanel: CodePanelView;
  private readonly oscilloscope: OscilloscopeDevice;
  private readonly debug: DebugOverlay;

  private readonly clues: ClueSystem;
  private readonly puzzle: PuzzleSystem;

  private readonly sceneGroup = new THREE.Group();

  // references kept for animation
  private reelL!: THREE.Object3D;
  private reelR!: THREE.Object3D;
  private playLed!: THREE.Mesh;
  private drawerGroup!: THREE.Object3D;
  private drawerLedMat: THREE.MeshBasicMaterial | null = null;
  private lampLight!: THREE.PointLight;
  private lampBulb!: THREE.Mesh;

  private cassetteMeshes: { id: string; mesh: THREE.Object3D; origin: THREE.Vector3 }[] = [];
  private readonly offs: (() => void)[] = [];
  private readonly inputOffs: (() => void)[] = [];
  private readonly readDocuments = new Set<string>();
  private drawerOpenedVisual = false;
  private horrorTension = 0;
  private horrorPulse = 0;
  private endingTriggered = false;
  private endingClock = 0;
  private reducedMotion = false;

  constructor(
    private readonly app: ThreeApp,
    private readonly audio: AudioManager,
    private readonly input: InputManager,
    uiRoot: HTMLElement,
  ) {
    // Systems
    this.clues  = new ClueSystem();
    this.puzzle = new PuzzleSystem(this.clues);
    this.focus  = new FocusSystem(app.camera);
    this.interaction = new InteractionSystem(app.camera, input, this.registry);

    // UI
    this.hud       = new HUDLayer(uiRoot);
    this.notebook  = new NotebookView(uiRoot, this.clues, this.puzzle);
    void this.notebook; // held for TAB toggle & GC prevention
    this.deckHud   = new TapeDeckHUD(uiRoot, audio);
    this.docView   = new DocumentView(uiRoot);
    this.codePanel = new CodePanelView(uiRoot, this.puzzle, audio, () => {
      if (this.focus.focusId === 'drawer') this.focus.unfocus();
    });
    this.debug     = new DebugOverlay(uiRoot, audio, this.puzzle, this.clues, this.focus);

    // Build world
    this.buildScene();
    this.wireDevices();

    // Oscilloscope is created after scene build because it uses the mesh
    const scopeBuild = this.scopeBuild!;
    this.oscilloscope = new OscilloscopeDevice(scopeBuild, audio.analyzer, audio.ctx.sampleRate);
    this.oscilloscope.setLockTarget(TAPE_C_BANDPASS_TARGET_HZ, TAPE_C_BANDPASS_TOLERANCE_HZ);
    this.oscilloscope.lockDigit = Config.puzzle.tapeDigits.C.toString();
    this.oscilloscope.setFilterState(audio.graph.filterState);
    this.offs.push(Events.on('audio:filtersChanged', (fs) => {
      this.oscilloscope.setFilterState({ ...audio.graph.filterState, ...fs });
    }));

    // Clue notification toasts
    this.offs.push(Events.on('clue:discovered', ({ id, title, description }) => {
      this.hud.showClueToast(title, description);
      this.audio.sfx.clue();
      if (id.includes('tape-b') || id.includes('tape-c') || id.includes('final')) {
        this.horrorTension += 1;
        this.horrorPulse = Math.max(this.horrorPulse, 1.0);
        this.audio.sfx.stinger();
      }
    }));

    // Drawer unlock feedback — turn LED green, allow final tape
    this.offs.push(Events.on('drawer:unlocked', () => {
      this.applyDrawerUnlockedVisuals();
    }));

    // Ending sequence
    this.offs.push(Events.on('ending:triggered', () => { this.startEnding(); }));

    this.offs.push(Events.on('document:read', ({ id }) => { this.readDocuments.add(id); }));
    this.offs.push(Events.on('code:attempted', ({ correct }) => {
      if (!correct) {
        this.horrorTension += 1;
        this.horrorPulse = Math.max(this.horrorPulse, 1.4);
      }
    }));

    // Initial objective
    this.hud.setObjective(this.puzzle.currentObjective());
  }

  private scopeBuild: import('./PlaceholderModelFactory').OscilloscopeBuild | null = null;

  private buildScene(): void {
    this.app.scene.add(this.sceneGroup);

    // Lighting — minimal rig; lamp supplies most of it
    const ambient = new THREE.AmbientLight(0x6a7080, 0.25);
    this.sceneGroup.add(ambient);
    const coolFill = new THREE.DirectionalLight(0x6a7a90, 0.22);
    coolFill.position.set(-2, 3, 2);
    this.sceneGroup.add(coolFill);

    // Room + desk
    const room = buildRoom();
    this.sceneGroup.add(room);
    const desk = buildDesk();
    this.sceneGroup.add(desk);

    // Identify drawer sub-group
    const drawer = desk.getObjectByName('drawer');
    if (!drawer) throw new Error('drawer group not found');
    this.drawerGroup = drawer;
    const led = drawer.getObjectByName('drawer-lock-led') as THREE.Mesh | undefined;
    if (led) this.drawerLedMat = led.material as THREE.MeshBasicMaterial;

    // Tape deck
    const deck = buildTapeDeck();
    deck.position.set(-0.55, 0.82, 0.0);
    deck.rotation.y = 0.05;
    this.sceneGroup.add(deck);
    this.reelL = deck.getObjectByName('reel-L')!;
    this.reelR = deck.getObjectByName('reel-R')!;
    this.playLed = deck.getObjectByName('play-led') as THREE.Mesh;

    // Audio processor (knob rack) between deck and scope
    const proc = buildAudioProcessor();
    proc.position.set(0.0, 0.82, 0.05);
    this.sceneGroup.add(proc);

    // Oscilloscope
    const scope = buildOscilloscope();
    scope.group.position.set(0.7, 0.82, -0.15);
    scope.group.rotation.y = -0.12;
    this.sceneGroup.add(scope.group);
    this.scopeBuild = scope;

    // Lamp on left of desk
    const lamp = buildLamp();
    lamp.position.set(-1.15, 0.82, 0.35);
    this.sceneGroup.add(lamp);
    this.lampLight = lamp.getObjectByName('lamp-light') as THREE.PointLight;
    this.lampBulb = lamp.getObjectByName('lamp-bulb') as THREE.Mesh;

    // Cassettes (three visible on the desk)
    const cassSpecs: { def: typeof TAPES[number]; pos: [number, number, number] }[] = [
      { def: TAPES[0]!, pos: [ 0.75, 0.83,  0.42] },
      { def: TAPES[1]!, pos: [ 0.62, 0.83,  0.50] },
      { def: TAPES[2]!, pos: [ 0.88, 0.84,  0.38] },
    ];
    for (const cs of cassSpecs) {
      const c = buildCassette(cs.def.color, cs.def.label);
      c.position.set(...cs.pos);
      c.rotation.y = (Math.random() - 0.5) * 0.3;
      this.sceneGroup.add(c);
      this.cassetteMeshes.push({ id: cs.def.id, mesh: c, origin: c.position.clone() });
    }

    // Documents on the desk
    const docSpecs: { id: string; pos: [number, number, number]; rot: number }[] = [
      { id: 'doc-field-log',    pos: [-0.25, 0.821, 0.40], rot: 0.2 },
      { id: 'doc-maintenance',  pos: [ 0.10, 0.821, 0.42], rot: -0.1 },
      { id: 'doc-torn-memo',    pos: [-0.85, 0.821, 0.38], rot: 0.35 },
      { id: 'doc-access-note',  pos: [ 0.25, 0.821, 0.54], rot: -0.25 },
      { id: 'doc-final-note',   pos: [ 0.45, 0.821, 0.50], rot: 0.15 },
    ];
    for (const ds of docSpecs) {
      const d = buildDocument();
      d.position.set(...ds.pos);
      d.rotation.y = ds.rot;
      d.userData['docId'] = ds.id;
      this.sceneGroup.add(d);
    }

    // Code panel (small device on top of the drawer)
    const codeP = buildCodePanel();
    codeP.position.set(1.0, 0.87, 0.48);
    codeP.rotation.x = -0.2;
    this.sceneGroup.add(codeP);
    this.codePanelGroup = codeP;
    this.deckGroup = deck;
    this.procGroup = proc;
    this.scopeGroup = scope.group;
    this.docSpecs = docSpecs;
  }

  private codePanelGroup!: THREE.Group;
  private deckGroup!: THREE.Group;
  private procGroup!: THREE.Group;
  private scopeGroup!: THREE.Group;
  private docSpecs: { id: string; pos: [number, number, number]; rot: number }[] = [];

  /** Register every interactable + its focus/click behavior. */
  private wireDevices(): void {
    // ---------- tape deck ----------
    const deckPose: FocusPose = {
      position: new THREE.Vector3(-0.55, 1.02, 0.55),
      lookAt:   new THREE.Vector3(-0.55, 0.88, 0.0),
    };
    this.registerInteractable({
      id: 'tapeDeck',
      kind: 'device',
      label: 'Tape Deck',
      hint: 'Click',
      hitTargets: [this.deckGroup],
      onHoverChange: (h) => this.setOutline(this.deckGroup, h ? Config.interaction.hoverOutlineColor : 0),
      onClick: () => { this.audio.sfx.button(); this.focus.focus('tapeDeck', deckPose); return true; },
    });

    // ---------- audio processor ----------
    // Shares the same close-up as the deck because filter knobs are shown
    // in the TapeDeckHUD. We register the processor as a distinct hit target
    // so hover highlights it, and clicking it brings up the same HUD.
    this.registerInteractable({
      id: 'audioProcessor',
      kind: 'device',
      label: 'Audio Processor',
      hint: 'Click',
      hitTargets: [this.procGroup],
      onHoverChange: (h) => this.setOutline(this.procGroup, h ? Config.interaction.hoverOutlineColor : 0),
      onClick: () => { this.audio.sfx.button(); this.focus.focus('tapeDeck', deckPose); return true; },
    });

    // ---------- oscilloscope ----------
    const scopePose: FocusPose = {
      position: new THREE.Vector3(0.7, 1.08, 0.55),
      lookAt:   new THREE.Vector3(0.7, 0.95, 0.0),
    };
    this.registerInteractable({
      id: 'oscilloscope',
      kind: 'device',
      label: 'Oscilloscope',
      hint: 'Inspect',
      hitTargets: [this.scopeGroup],
      onHoverChange: (h) => this.setOutline(this.scopeGroup, h ? Config.interaction.hoverOutlineColor : 0),
      onClick: () => { this.audio.sfx.button(); this.focus.focus('oscilloscope', scopePose); return true; },
    });

    // ---------- drawer / code panel ----------
    const drawerPose: FocusPose = {
      position: new THREE.Vector3(1.0, 1.05, 0.85),
      lookAt:   new THREE.Vector3(1.0, 0.88, 0.45),
    };
    this.registerInteractable({
      id: 'drawer',
      kind: 'container',
      label: () => this.puzzle.isDrawerUnlocked() ? 'Drawer (open)' : 'Drawer (locked)',
      hint: () => this.puzzle.isDrawerUnlocked() ? 'Recovered tape tray' : 'Enter code',
      hitTargets: [this.drawerGroup, this.codePanelGroup],
      onHoverChange: (h) => {
        this.setOutline(this.codePanelGroup, h ? Config.interaction.hoverOutlineColor : 0);
        this.setOutline(this.drawerGroup, h ? Config.interaction.hoverOutlineColor : 0);
      },
      onClick: () => {
        if (this.puzzle.isDrawerUnlocked()) {
          // Already open — nothing to do; tape is in the tray
          this.audio.sfx.button();
          return true;
        }
        this.audio.sfx.button();
        this.focus.focus('drawer', drawerPose);
        // Delay opening the keypad slightly so camera is there
        window.setTimeout(() => this.codePanel.open(), 500);
        return true;
      },
    });

    // ---------- cassettes on desk ----------
    // Each cassette, when clicked while NOT focused on the deck, just flashes
    // a label. The real insertion UI is in the deck HUD. But we give them
    // focus handling so players can "pick up" to read the label.
    for (const c of this.cassetteMeshes) {
      this.registerInteractable({
        id: `cass-${c.id}`,
        kind: 'cassette',
        label: `Cassette ${c.id.slice(-1).toUpperCase()}`,
        hint: 'Tap',
        hitTargets: [c.mesh],
        onHoverChange: (h) => this.setOutline(c.mesh, h ? Config.interaction.hoverOutlineColor : 0),
        onClick: () => {
          this.audio.sfx.insert();
          // Directly insert this tape
          const def = TAPES.find(t => t.id === c.id);
          if (def) this.audio.insertTape(def);
          this.focus.focus('tapeDeck', deckPose);
          return true;
        },
      });
    }

    // ---------- documents ----------
    for (const ds of this.docSpecs) {
      // Find mesh by docId — each doc group was added with userData.docId set.
      // We stored them in scene; we need a direct ref. Walk scene once.
      const mesh = this.findDocMesh(ds.id);
      if (!mesh) continue;
      this.registerInteractable({
        id: `doc-${ds.id}`,
        kind: 'document',
        label: DOCUMENT_BY_ID.get(ds.id)!.title,
        hint: 'Read',
        hitTargets: [mesh],
        onHoverChange: (h) => this.setOutline(mesh, h ? Config.interaction.hoverOutlineColor : 0),
        onClick: () => {
          const def = DOCUMENT_BY_ID.get(ds.id);
          if (!def) return false;
          this.audio.sfx.button();
          this.docView.open(def);
          // Discover associated clue, if any
          if (def.clueId) this.clues.discover(def.clueId);
          // Reading the maintenance note also registers the "read maintenance" step
          return true;
        },
      });
    }

    // ESC from focus goes back to overview. Returning true consumes the key
    // before the global pause shortcut can also fire.
    this.inputOffs.push(this.input.onKey('Escape', () => {
      if (this.docView.isOpen) return true; // doc handles its own capture listener
      if (this.codePanel.isOpen) return true; // keypad handles its own capture listener
      if (this.focus.focusId) {
        this.audio.sfx.knob();
        this.focus.unfocus();
        this.deckHud.setOpen(false);
        return true;
      }
      return false;
    }));
  }

  private findDocMesh(docId: string): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    this.sceneGroup.traverse((n) => {
      if (!found && n.userData && n.userData['docId'] === docId) found = n;
    });
    return found;
  }

  private registerInteractable(it: Interactable): void {
    this.registry.register(it);
  }

  /** Highlight outline helper (we use emissive on the main mesh's material). */
  private readonly outlineCache = new WeakMap<THREE.Material, THREE.Color>();
  private setOutline(group: THREE.Object3D, color: number): void {
    group.traverse((n) => {
      const m = (n as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !('emissive' in m)) return;
      if (!this.outlineCache.has(m)) this.outlineCache.set(m, m.emissive.clone());
      if (color === 0) {
        const orig = this.outlineCache.get(m)!;
        m.emissive.copy(orig);
      } else {
        m.emissive.setHex(color);
        m.emissive.multiplyScalar(0.35);
      }
    });
  }

  // ---------- per-frame ----------

  update(dt: number, now: number): void {
    this.audio.deck.tick();
    this.focus.update(dt, now, this.reducedMotion);

    const focusingDeck = this.focus.focusId === 'tapeDeck';
    this.deckHud.setOpen(focusingDeck);

    // While we're inside a modal, disable raycast so underlying objects
    // don't receive hover changes.
    this.interaction.setEnabled(
      !this.docView.isOpen && !this.codePanel.isOpen &&
      !this.endingActiveBlocking()
    );
    this.interaction.update();

    // Animate reels during tape playback
    const playing = this.audio.deck.isPlaying;
    if (playing) {
      const dir = this.audio.deck.reversed ? -1 : 1;
      const spin = dt * 6 * dir * this.audio.deck.rate;
      this.reelL.rotation.z -= spin;
      this.reelR.rotation.z -= spin;
      (this.playLed.material as THREE.MeshBasicMaterial).color = new THREE.Color(0x3be08a);
    } else {
      (this.playLed.material as THREE.MeshBasicMaterial).color = new THREE.Color(0xe04b4b);
    }

    // Oscilloscope
    this.oscilloscope.update(dt);

    // Lamp flicker. As the investigation escalates, discovered tape clues and
    // wrong keypad attempts briefly make the room feel like it is reacting.
    if (!this.reducedMotion) {
      this.horrorPulse = Math.max(0, this.horrorPulse - dt * 0.45);
      const tension = Math.min(1, this.horrorTension / 6);
      const fl =
        1
        + Math.sin(now * (11.0 + tension * 4)) * (0.008 + tension * 0.018)
        + (Math.random() - 0.5) * (0.015 + tension * 0.025)
        - this.horrorPulse * (0.25 + tension * 0.12);
      const blackout = this.horrorPulse > 0.8 && Math.random() < 0.03 + tension * 0.03;
      this.lampLight.intensity = blackout ? 0 : Math.max(0.05, 2.2 * fl);
      (this.lampBulb.material as THREE.MeshBasicMaterial).color = new THREE.Color().setHSL(0.1, 0.7, Math.max(0.08, 0.7 * fl));

      for (const c of this.cassetteMeshes) {
        const jitter = this.horrorPulse > 0
          ? Math.sin(now * 18 + c.origin.x * 17) * 0.004 * this.horrorPulse
          : 0;
        c.mesh.position.y = c.origin.y + jitter;
      }
    }

    // Puzzle logic tick
    this.puzzle.tick(dt);

    // Ending animation driver
    if (this.endingTriggered) this.updateEndingAnim(dt);

    // Debug overlay
    this.debug.update(dt);
  }

  private endingActiveBlocking(): boolean {
    return this.endingTriggered && this.endingClock > 4.0; // block interaction near end
  }

  /** Start the ending sequence. */
  private startEnding(): void {
    if (this.endingTriggered) return;
    this.endingTriggered = true;
    this.endingClock = 0;
    this.oscilloscope.markFinalReveal(true);
    this.audio.sfx.stinger();
  }

  private updateEndingAnim(dt: number): void {
    this.endingClock += dt;
    const t = this.endingClock;
    // Lights dim, lamp flickers hard
    const dim = Math.max(0.05, 1 - t * 0.15);
    this.lampLight.intensity = 2.2 * dim * (0.5 + 0.5 * Math.sin(t * 18));
    // Random brief blackouts
    if (t > 2 && Math.random() < 0.02) this.lampLight.intensity = 0;
    // After ~8s, stop the deck automatically (as if by itself)
    if (t > 8 && this.audio.deck.isPlaying) this.audio.deck.stop();
    // After 10s, fade to black via ui-level fade then ending screen
    if (t > 10 && !this.fadedOut) {
      this.fadedOut = true;
      Events.emit('ending:complete', {}); // app listens to present EndingScreen
    }
  }
  private fadedOut = false;

  private applyDrawerUnlockedVisuals(): void {
    if (this.drawerLedMat) this.drawerLedMat.color = new THREE.Color(0x3be08a);
    if (!this.drawerOpenedVisual) {
      this.drawerGroup.position.z += 0.08;
      this.drawerOpenedVisual = true;
    }
    this.deckHud.markFinalAvailable(true);
  }

  setReducedMotion(flag: boolean): void { this.reducedMotion = flag; }

  /** Returns clue/puzzle systems for save. */
  getClueSystem(): ClueSystem { return this.clues; }
  getPuzzleSystem(): PuzzleSystem { return this.puzzle; }

  /** Restore from save data. */
  restore(data: {
    clues: readonly string[];
    steps: readonly string[];
    drawerUnlocked: boolean;
    endingStarted: boolean;
    readDocuments?: readonly string[];
    insertedTape: string | null;
    tapePositions: Record<string, number>;
  }): void {
    this.clues.restore(data.clues);
    this.readDocuments.clear();
    for (const id of data.readDocuments ?? []) this.readDocuments.add(id);
    this.puzzle.restore({
      steps: data.steps,
      drawerUnlocked: data.drawerUnlocked,
      endingStarted: data.endingStarted,
    });
    this.hud.setObjective(this.puzzle.currentObjective());
    if (data.drawerUnlocked) this.applyDrawerUnlockedVisuals();
    if (data.insertedTape) {
      const def = [...TAPES, FINAL_TAPE].find(t => t.id === data.insertedTape);
      if (def) {
        const isFinal = def.id === FINAL_TAPE.id;
        this.audio.insertTape(def, isFinal);
        const pos = data.tapePositions[def.id];
        if (typeof pos === 'number') this.audio.deck.restorePosition(pos);
      }
    }
  }

  applySettings(s: Settings): void {
    this.reducedMotion = s.reducedMotion;
    this.audio.graph.setMasterVolume(s.master);
    this.audio.graph.setSfxVolume(s.sfx);
    this.audio.graph.setMusicVolume(s.music);
  }

  /** Dispose GPU + DOM resources (used when returning to main menu). */
  dispose(): void {
    for (const off of this.offs.splice(0)) off();
    for (const off of this.inputOffs.splice(0)) off();
    this.puzzle.dispose();
    this.codePanel.dispose();
    this.docView.dispose();
    this.deckHud.dispose();
    this.notebook.dispose();
    this.hud.dispose();
    this.debug.dispose();
    this.app.scene.remove(this.sceneGroup);
    this.registry.clear();
  }

  /** Used by GameApp to know whether to show the ending screen. */
  isEndingComplete(): boolean { return this.fadedOut; }

  /** Serialize full scene state for save. */
  snapshot(): {
    clues: string[]; steps: string[]; drawerUnlocked: boolean; endingStarted: boolean;
    readDocuments: string[]; objective: string; insertedTape: string | null; tapePositions: Record<string, number>;
  } {
    const p = this.puzzle.serialize();
    const positions: Record<string, number> = {};
    const id = this.audio.deck.insertedTapeId;
    if (id) positions[id] = this.audio.deck.time;
    return {
      clues: this.clues.serialize(),
      steps: p.steps,
      drawerUnlocked: p.drawerUnlocked,
      endingStarted: p.endingStarted,
      readDocuments: Array.from(this.readDocuments),
      objective: p.objective,
      insertedTape: id,
      tapePositions: positions,
    };
  }
}
