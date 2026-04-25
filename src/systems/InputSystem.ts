import type { Game } from "../core/Game";
import { CellKind, type TowerType } from "../core/Types";
import { towerOrder } from "../data/towers";
import { TILE_SIZE } from "../core/Config";

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

  constructor(private readonly game: Game) {}

  attach(): void {
    const canvas = this.game.canvas;
    canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    canvas.addEventListener("mouseleave", () => {
      this.overCell = null;
      this.showPlacementPreview = false;
      this.lastPreviewKey = "";
    });
    canvas.addEventListener("click", (e) => this.onPrimaryButton(e));
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.onSecondaryButton(e);
    });
    window.addEventListener("keydown", (e) => this.onKey(e));
  }

  update(dt: number): void {
    if (this.placementSnapTimer > 0) this.placementSnapTimer = Math.max(0, this.placementSnapTimer - dt);
    if (this.placementInvalidTimer > 0) this.placementInvalidTimer = Math.max(0, this.placementInvalidTimer - dt);
  }

  private cellFromEvent(e: MouseEvent): { c: number; r: number } {
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = this.game.canvas.width / rect.width;
    const scaleY = this.game.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    this.mouseX = x;
    this.mouseY = y;
    return this.game.grid.worldToCell(x, y);
  }

  private onMouseMove(e: MouseEvent): void {
    this.overCell = this.cellFromEvent(e);
    this.showPlacementPreview = Boolean(this.placementTowerType) && this.isBuildingState();
    this.updatePlacementFeedback();
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
    this.game.bus.emit("build:tool", this.selectedTowerType);
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

    // Hotkeys 1-6 = tower types (by definition order).
    if (key >= "1" && key <= "9") {
      const idx = parseInt(key, 10) - 1;
      const type = towerOrder[idx];
      if (type) {
        this.setBuildTool(type);
        e.preventDefault();
        return;
      }
    }

    switch (key.toUpperCase()) {
      case "D":
        this.game.drones.buy("hunter");
        break;
      case "U":
        if (this.game.towers.selected) this.game.towers.upgrade(this.game.towers.selected);
        break;
      case "S":
        if (this.game.towers.selected) this.game.towers.sell(this.game.towers.selected);
        break;
      case "P":
        this.game.togglePause();
        break;
      case "+": case "=":
        this.game.cycleSpeed(1);
        break;
      case "-":
        this.game.cycleSpeed(-1);
        break;
      case " ":
        this.onSpace();
        e.preventDefault();
        break;
    }

    switch (code) {
      case "Escape":
        this.clearSelection();
        this.game.bus.emit("ui:esc");
        break;
      case "Tab":
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
      case "KeyK":
        if (this.isBuildingState()) {
          this.game.core.killZoneMode = !this.game.core.killZoneMode;
          e.preventDefault();
        }
        break;
      case "KeyT":
        if (this.game.state === "WAVE_ACTIVE" && this.game.core.upgrades.tacticalPause && this.game.core.tacticalPauseCharges > 0) {
          this.game.core.tacticalPauseCharges--;
          this.game.core.slowMoScale = 0.28;
          this.game.core.slowMo = 3.0;
          this.game.particles.spawnScreenFlash("#b3e5fc", 0.22, 0.35);
          this.game.particles.spawnFloatingText(this.game.grid.corePos.x, this.game.grid.corePos.y - 30, "TACTICAL PAUSE", "#b3e5fc", 1.8, 12);
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
