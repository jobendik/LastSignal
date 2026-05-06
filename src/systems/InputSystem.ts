import type { Game } from "../core/Game";
import { CellKind, type TowerType } from "../core/Types";
import { towerOrder } from "../data/towers";
import { TILE_SIZE, VIEW_WIDTH, VIEW_HEIGHT } from "../core/Config";

export class InputSystem {
  mouseX = 0;
  mouseY = 0;
  overCell: { c: number; r: number } | null = null;
  selectedTowerType: TowerType | null = null;
  hoverTowerType: TowerType | null = null;
  showPlacementPreview = false;
  placementSnapTimer = 0;
  placementInvalidTimer = 0;
  private lastPreviewKey = "";
  private lastInvalidSoundTime = -Infinity;
  private touchLongPress: ReturnType<typeof window.setTimeout> | null = null;
  private gamepadCursor = { c: 12, r: 10 };
  private gamepadButtons = new Set<number>();
  private placementGuideSeen = new Set<TowerType>();
  /** Middle-mouse drag state for panning. */
  private panDrag = false;
  private panDragStartX = 0;
  private panDragStartY = 0;
  /** Keys currently held (for continuous pan). */
  private heldKeys = new Set<string>();

  constructor(private readonly game: Game) {}

  attach(): void {
    const canvas = this.game.canvas;
    canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    canvas.addEventListener("mouseleave", () => {
      this.overCell = null;
      this.showPlacementPreview = false;
      this.lastPreviewKey = "";
      // Stop edge-scroll when mouse leaves.
      this.game.camera.edgePanX = 0;
      this.game.camera.edgePanY = 0;
    });
    canvas.addEventListener("click", (e) => this.onPrimaryButton(e));
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.onSecondaryButton(e);
    });
    // Zoom with mouse wheel.
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const worldPos = this.worldFromClient(e.clientX, e.clientY);
      this.game.camera.zoomAt(-Math.sign(e.deltaY), worldPos.x, worldPos.y);
    }, { passive: false });
    // Middle-mouse drag for panning.
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 1) { this.panDrag = true; this.panDragStartX = e.clientX; this.panDragStartY = e.clientY; e.preventDefault(); }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 1) this.panDrag = false;
    });
    canvas.addEventListener("touchstart", (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener("touchmove", (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener("touchend", () => this.onTouchEnd(), { passive: false });
    window.addEventListener("keydown", (e) => { this.heldKeys.add(e.code); this.onKey(e); });
    window.addEventListener("keyup", (e) => { this.heldKeys.delete(e.code); });
  }

  update(dt: number): void {
    if (this.placementSnapTimer > 0) this.placementSnapTimer = Math.max(0, this.placementSnapTimer - dt);
    if (this.placementInvalidTimer > 0) this.placementInvalidTimer = Math.max(0, this.placementInvalidTimer - dt);
    // Continuous WASD / arrow key panning.
    const cam = this.game.camera;
    cam.panLeft = this.heldKeys.has("KeyA") || this.heldKeys.has("ArrowLeft");
    cam.panRight = this.heldKeys.has("KeyD") || this.heldKeys.has("ArrowRight");
    cam.panUp = this.heldKeys.has("KeyW") || this.heldKeys.has("ArrowUp");
    cam.panDown = this.heldKeys.has("KeyS") || this.heldKeys.has("ArrowDown");
    this.updateGamepad(dt);
  }

  /** Convert client (screen pixel) coords to world coordinates via camera. */
  private worldFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = this.game.canvas.width / rect.width;
    const scaleY = this.game.canvas.height / rect.height;
    const dpr = this.game.render.dpr;
    const sx = (clientX - rect.left) * scaleX / dpr;
    const sy = (clientY - rect.top) * scaleY / dpr;
    return this.game.camera.screenToWorld(sx, sy);
  }

  private cellFromEvent(e: MouseEvent): { c: number; r: number } {
    return this.cellFromClient(e.clientX, e.clientY);
  }

  private cellFromClient(clientX: number, clientY: number): { c: number; r: number } {
    const world = this.worldFromClient(clientX, clientY);
    this.mouseX = world.x;
    this.mouseY = world.y;
    return this.game.grid.worldToCell(world.x, world.y);
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 0) return;
    e.preventDefault();
    const t = e.touches[0]!;
    this.overCell = this.cellFromClient(t.clientX, t.clientY);
    this.showPlacementPreview = Boolean(this.placementTowerType) && this.isBuildingState();
    this.touchLongPress = window.setTimeout(() => {
      if (!this.overCell) return;
      const tower = this.game.towers.findTowerAt(this.overCell.c, this.overCell.r);
      if (tower) {
        this.game.towers.selected = tower;
        this.game.bus.emit("tower:selected", tower);
      }
    }, 450);
  }

  private onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 0) return;
    e.preventDefault();
    const t = e.touches[0]!;
    this.overCell = this.cellFromClient(t.clientX, t.clientY);
    this.showPlacementPreview = Boolean(this.placementTowerType) && this.isBuildingState();
    this.updatePlacementFeedback();
  }

  private onTouchEnd(): void {
    if (this.touchLongPress) window.clearTimeout(this.touchLongPress);
    this.touchLongPress = null;
    if (!this.overCell) return;
    if (this.game.core.killZoneMode) {
      const px = (this.overCell.c + 0.5) * TILE_SIZE;
      const py = (this.overCell.r + 0.5) * TILE_SIZE;
      this.game.core.killZone = { ...this.overCell };
      this.game.core.killZoneMode = false;
      this.game.particles.spawnFloatingText(px, py - 20, "KILL ZONE SET", "#ff9800", 1.2, 12);
      this.game.particles.spawnRing(px, py, 28, "#ff9800");
      this.game.bus.emit("killzone:set", this.game.core.killZone);
    } else if (this.game.core.coreDeployMode) {
      if (this.game.deployRelayCore(this.overCell.c, this.overCell.r)) {
        this.game.core.coreDeployMode = false;
      }
    } else if (this.selectedTowerType) {
      this.tryBuild(this.overCell, false);
    } else {
      const tower = this.game.towers.findTowerAt(this.overCell.c, this.overCell.r);
      this.game.towers.selected = tower;
      this.game.bus.emit("tower:selected", tower);
    }
  }

  private onMouseMove(e: MouseEvent): void {
    // Middle-mouse pan.
    if (this.panDrag) {
      const rect = this.game.canvas.getBoundingClientRect();
      const scaleX = this.game.canvas.width / rect.width;
      const dpr = this.game.render.dpr;
      const dx = (e.clientX - this.panDragStartX) * scaleX / dpr;
      const dy = (e.clientY - this.panDragStartY) * scaleX / dpr;
      const cam = this.game.camera;
      cam.targetX -= dx / cam.zoom;
      cam.targetY -= dy / cam.zoom;
      this.panDragStartX = e.clientX;
      this.panDragStartY = e.clientY;
    }
    this.overCell = this.cellFromEvent(e);
    this.showPlacementPreview = Boolean(this.placementTowerType) && this.isBuildingState();
    this.updatePlacementFeedback();
    // Edge scrolling.
    const rect = this.game.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cam = this.game.camera;
    const band = cam.edgeBand;
    cam.edgePanX = mx < band ? -1 : mx > rect.width - band ? 1 : 0;
    cam.edgePanY = my < band ? -1 : my > rect.height - band ? 1 : 0;
  }

  private onPrimaryButton(e: MouseEvent): void {
    if (this.game.core.settings.mouseButtonSwap) {
      this.handleSecondaryAction(e);
    } else {
      this.handlePrimaryAction(e);
    }
  }

  private onSecondaryButton(e: MouseEvent): void {
    if (this.game.core.settings.mouseButtonSwap) {
      this.handlePrimaryAction(e);
    } else {
      this.handleSecondaryAction(e);
    }
  }

  private handlePrimaryAction(e: MouseEvent): void {
    if (!this.isBuildingState()) return;
    const cell = this.cellFromEvent(e);

    // Salvage collection: click within 22px of a pickup to collect it.
    if (this.game.core.salvagePickups.length > 0) {
      const mx = this.mouseX, my = this.mouseY;
      let collected = false;
      this.game.core.salvagePickups = this.game.core.salvagePickups.filter((s) => {
        const dx = mx - s.x, dy = my - s.y;
        if (dx * dx + dy * dy < 22 * 22) {
          this.game.addCredits(s.value);
          this.game.particles.spawnFloatingText(s.x, s.y - 16, `+${s.value}CR`, "#ffd54f", 1.2, 11);
          this.game.particles.spawnBurst(s.x, s.y, "#ffd54f", 6, { speed: 60, life: 0.4, size: 2 });
          collected = true;
          return false; // remove
        }
        return true;
      });
      if (collected) return;
    }

    // Kill zone designation: set the clicked cell as the kill zone.
    if (this.game.core.killZoneMode) {
      this.game.core.killZone = { c: cell.c, r: cell.r };
      this.game.core.killZoneMode = false;
      const px = (cell.c + 0.5) * TILE_SIZE;
      const py = (cell.r + 0.5) * TILE_SIZE;
      this.game.particles.spawnFloatingText(px, py - 20, "KILL ZONE SET", "#ff9800", 1.2, 12);
      this.game.particles.spawnRing(px, py, 28, "#ff9800");
      this.game.bus.emit("killzone:set", this.game.core.killZone);
      return;
    }
    if (this.game.core.coreDeployMode) {
      this.game.deployRelayCore(cell.c, cell.r);
      return;
    }

    if (this.selectedTowerType) {
      this.tryBuild(cell, e.shiftKey);
      return;
    }
    // Otherwise — select tower at cell.
    const i = this.game.grid.idx(cell.c, cell.r);
    if (this.game.grid.cells[i] === CellKind.Core) {
      this.game.activateCoreAbility();
      return;
    }
    const tower = this.game.towers.findTowerAt(cell.c, cell.r);
    this.game.towers.selected = tower;
    this.game.bus.emit("tower:selected", tower);
  }

  private handleSecondaryAction(e: MouseEvent): void {
    if (this.isBuildingState()) {
      const cell = this.cellFromEvent(e);
      const tower = this.game.towers.findTowerAt(cell.c, cell.r);
      if (tower) {
        this.selectedTowerType = null;
        this.showPlacementPreview = false;
        this.game.towers.selected = tower;
        this.game.towers.manualFire(tower);
        this.game.bus.emit("tower:selected", tower);
        return;
      }
    }
    this.clearSelection();
  }

  private tryBuild(cell: { c: number; r: number }, keepSelected: boolean): void {
    const type = this.selectedTowerType!;
    this.game.recordReplayEvent("build_attempt", { type, cell });
    const res = this.game.towers.place(type, cell.c, cell.r);
    if (!res) {
      // Invalid — play a small rejection sound.
      this.game.audio.sfxShoot(0.5, 0.08);
      this.placementInvalidTimer = 0.22;
      return;
    }
    if (!keepSelected) {
      this.selectedTowerType = null;
      this.showPlacementPreview = false;
      this.game.bus.emit("build:tool", this.selectedTowerType);
    }
  }

  setBuildTool(type: TowerType | null): void {
    if (this.selectedTowerType === type) {
      this.selectedTowerType = null;
    } else {
      this.selectedTowerType = type;
    }
    this.showPlacementPreview = Boolean(this.selectedTowerType);
    this.updatePlacementFeedback(true);
    if (this.selectedTowerType && !this.placementGuideSeen.has(this.selectedTowerType)) {
      this.placementGuideSeen.add(this.selectedTowerType);
      const def = this.selectedTowerType ? this.game.towers.buildCost(this.selectedTowerType) : 0;
      this.game.particles.spawnFloatingText(
        this.game.width / 2,
        this.game.height - 42,
        `${this.selectedTowerType.toUpperCase()} / RANGE PREVIEW / ${def}CR`,
        "#66fcf1",
        2.2,
        11
      );
    }
    this.game.bus.emit("build:tool", this.selectedTowerType);
    this.game.recordReplayEvent("build_tool", { type: this.selectedTowerType });
  }

  setHoverBuildTool(type: TowerType | null): void {
    this.hoverTowerType = type;
    this.showPlacementPreview = Boolean(this.placementTowerType) && this.isBuildingState();
    this.updatePlacementFeedback(true);
  }

  clearSelection(): void {
    this.selectedTowerType = null;
    this.hoverTowerType = null;
    this.showPlacementPreview = false;
    this.game.towers.selected = null;
    this.game.bus.emit("ui:cleared");
  }

  private updatePlacementFeedback(force = false): void {
    const type = this.placementTowerType;
    if (!type || !this.overCell || !this.isBuildingState()) {
      this.lastPreviewKey = "";
      return;
    }

    const key = `${type}:${this.overCell.c}:${this.overCell.r}`;
    if (!force && key === this.lastPreviewKey) return;
    this.lastPreviewKey = key;

    const valid = this.game.towers.canPlace(type, this.overCell.c, this.overCell.r).ok;
    if (valid) {
      this.placementSnapTimer = 0.18;
      return;
    }

    this.placementInvalidTimer = 0.22;
    const now = this.game.time.elapsed;
    if (this.selectedTowerType && now - this.lastInvalidSoundTime > 0.28) {
      this.game.audio.sfxShoot(0.45, 0.06);
      this.lastInvalidSoundTime = now;
    }
  }

  private isBuildingState(): boolean {
    return this.game.state === "PLANNING" || this.game.state === "WAVE_ACTIVE";
  }

  private onKey(e: KeyboardEvent): void {
    const key = e.key;
    const code = e.code;
    const bindings = this.game.core.settings.keyBindings;
    const isBound = (action: string) => code === bindings[action];

    for (let i = 0; i < towerOrder.length; i++) {
      if (!isBound(`build${i + 1}`)) continue;
      const type = towerOrder[i];
      if (type) {
        this.setBuildTool(type);
        e.preventDefault();
        return;
      }
    }

    if (isBound("drone")) {
      this.game.drones.buy("hunter");
    } else if (isBound("upgrade")) {
      if (this.game.towers.selected) this.game.towers.upgrade(this.game.towers.selected);
    } else if (isBound("sell")) {
      if (this.game.towers.selected) this.game.towers.sell(this.game.towers.selected);
    } else if (isBound("pause")) {
      this.game.togglePause();
      this.game.recordReplayEvent("pause");
    } else if (isBound("speedUp")) {
      this.game.cycleSpeed(1);
      this.game.recordReplayEvent("speed", { delta: 1 });
    } else if (isBound("speedDown")) {
      this.game.cycleSpeed(-1);
      this.game.recordReplayEvent("speed", { delta: -1 });
    } else if (isBound("start")) {
      this.onSpace();
      this.game.recordReplayEvent("confirm");
      e.preventDefault();
    }

    switch (code) {
      case "Escape":
        this.clearSelection();
        this.game.core.coreDeployMode = false;
        this.game.core.killZoneMode = false;
        this.game.bus.emit("ui:esc");
        break;
      case bindings.wavePreview:
        this.game.bus.emit("ui:toggleWavePreview");
        e.preventDefault();
        break;
      case "F1":
        this.game.core.debug.show = !this.game.core.debug.show;
        e.preventDefault();
        break;
      case "F2":
        this.game.core.debug.showFlow = !this.game.core.debug.showFlow;
        e.preventDefault();
        break;
      case "F3":
        this.game.core.debug.showPaths = !this.game.core.debug.showPaths;
        e.preventDefault();
        break;
      case "F4":
        this.game.addCredits(200);
        e.preventDefault();
        break;
      case "F5":
        this.game.damageCore(10);
        e.preventDefault();
        break;
      case "KeyH":
        this.game.core.showHeatmap = !this.game.core.showHeatmap;
        e.preventDefault();
        break;
      case bindings.killZone:
        if (this.isBuildingState()) {
          this.game.core.killZoneMode = !this.game.core.killZoneMode;
          e.preventDefault();
        }
        break;
      case bindings.tacticalPause:
        if (this.game.state === "WAVE_ACTIVE" && this.game.core.upgrades.tacticalPause && this.game.core.tacticalPauseCharges > 0) {
          this.game.core.tacticalPauseCharges--;
          this.game.core.slowMoScale = 0.28;
          this.game.core.slowMo = 3.0;
          this.game.particles.spawnScreenFlash("#b3e5fc", 0.22, 0.35);
          this.game.particles.spawnFloatingText(this.game.grid.corePos.x, this.game.grid.corePos.y - 30, "TACTICAL PAUSE", "#b3e5fc", 1.8, 12);
          e.preventDefault();
        }
        break;
      case "KeyR":
        if (this.game.canDeployRelayCore()) {
          this.game.core.coreDeployMode = !this.game.core.coreDeployMode;
          this.selectedTowerType = null;
          e.preventDefault();
        }
        break;
      case "KeyY":
        if (this.game.canUpgradeCommandTier()) {
          this.game.upgradeCommandTier();
          e.preventDefault();
        }
        break;
    }
  }

  private onSpace(): void {
    if (this.game.state === "PLANNING" && this.game.waves.hasMoreWaves) {
      this.game.waves.startWave(true);
    } else if (this.game.state === "WAVE_COMPLETE") {
      this.game.waves.goToNextOrVictory();
    } else if (this.game.state === "MAIN_MENU") {
      this.game.bus.emit("ui:mainMenuConfirm");
    } else if (this.game.state === "GAME_OVER" || this.game.state === "VICTORY") {
      this.game.returnToMenu();
    }
  }

  private updateGamepad(_dt: number): void {
    if (!this.game.core.settings.gamepadEnabled || typeof navigator.getGamepads !== "function") return;
    const pad = Array.from(navigator.getGamepads()).find(Boolean);
    if (!pad) return;

    const axisX = pad.axes[0] ?? 0;
    const axisY = pad.axes[1] ?? 0;
    if (Math.abs(axisX) > 0.6) this.gamepadCursor.c = Math.max(0, Math.min(this.game.grid.cols - 1, this.gamepadCursor.c + Math.sign(axisX)));
    if (Math.abs(axisY) > 0.6) this.gamepadCursor.r = Math.max(0, Math.min(this.game.grid.rows - 1, this.gamepadCursor.r + Math.sign(axisY)));
    this.overCell = { ...this.gamepadCursor };
    this.mouseX = (this.gamepadCursor.c + 0.5) * TILE_SIZE;
    this.mouseY = (this.gamepadCursor.r + 0.5) * TILE_SIZE;

    const pressed = (idx: number) => Boolean(pad.buttons[idx]?.pressed);
    const once = (idx: number, action: () => void) => {
      if (pressed(idx)) {
        if (!this.gamepadButtons.has(idx)) action();
        this.gamepadButtons.add(idx);
      } else {
        this.gamepadButtons.delete(idx);
      }
    };

    once(0, () => {
      if (this.selectedTowerType) this.tryBuild(this.gamepadCursor, false);
      else {
        const tower = this.game.towers.findTowerAt(this.gamepadCursor.c, this.gamepadCursor.r);
        this.game.towers.selected = tower;
        this.game.bus.emit("tower:selected", tower);
      }
    });
    once(1, () => this.clearSelection());
    once(6, () => this.game.cycleSpeed(-1));
    once(7, () => this.game.cycleSpeed(1));
  }

  get hoverCell(): { c: number; r: number } | null {
    return this.overCell;
  }

  get placementTowerType(): TowerType | null {
    return this.selectedTowerType ?? this.hoverTowerType;
  }

  get hoverWorld(): { x: number; y: number } | null {
    if (!this.overCell) return null;
    return { x: this.overCell.c * TILE_SIZE + TILE_SIZE / 2, y: this.overCell.r * TILE_SIZE + TILE_SIZE / 2 };
  }
}
