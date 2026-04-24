import type { Game } from "../core/Game";
import type { TowerType } from "../core/Types";
import { towerOrder } from "../data/towers";
import { TILE_SIZE } from "../core/Config";

export class InputSystem {
  mouseX = 0;
  mouseY = 0;
  overCell: { c: number; r: number } | null = null;
  selectedTowerType: TowerType | null = null;
  showPlacementPreview = false;

  constructor(private readonly game: Game) {}

  attach(): void {
    const canvas = this.game.canvas;
    canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    canvas.addEventListener("mouseleave", () => {
      this.overCell = null;
      this.showPlacementPreview = false;
    });
    canvas.addEventListener("click", (e) => this.onClick(e));
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.clearSelection();
    });
    window.addEventListener("keydown", (e) => this.onKey(e));
  }

  update(_dt: number): void {
    // Reserved for polling-style behaviors.
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
    this.showPlacementPreview = Boolean(this.selectedTowerType) && this.isBuildingState();
  }

  private onClick(e: MouseEvent): void {
    if (!this.isBuildingState()) return;
    const cell = this.cellFromEvent(e);
    if (this.selectedTowerType) {
      this.tryBuild(cell);
      return;
    }
    // Otherwise — select tower at cell.
    const tower = this.game.towers.findTowerAt(cell.c, cell.r);
    this.game.towers.selected = tower;
    this.game.bus.emit("tower:selected", tower);
  }

  private tryBuild(cell: { c: number; r: number }): void {
    const type = this.selectedTowerType!;
    const res = this.game.towers.place(type, cell.c, cell.r);
    if (!res) {
      // Invalid — play a small rejection sound.
      this.game.audio.sfxShoot(0.5, 0.08);
    }
  }

  setBuildTool(type: TowerType | null): void {
    if (this.selectedTowerType === type) {
      this.selectedTowerType = null;
    } else {
      this.selectedTowerType = type;
    }
    this.showPlacementPreview = Boolean(this.selectedTowerType);
    this.game.bus.emit("build:tool", this.selectedTowerType);
  }

  clearSelection(): void {
    this.selectedTowerType = null;
    this.showPlacementPreview = false;
    this.game.towers.selected = null;
    this.game.bus.emit("ui:cleared");
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

  get hoverWorld(): { x: number; y: number } | null {
    if (!this.overCell) return null;
    return { x: this.overCell.c * TILE_SIZE + TILE_SIZE / 2, y: this.overCell.r * TILE_SIZE + TILE_SIZE / 2 };
  }
}
