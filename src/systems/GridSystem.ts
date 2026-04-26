import { Vector2 } from "../core/Vector2";
import { CellKind } from "../core/Types";
import type { SectorDefinition, SpawnerDefinition, TowerType } from "../core/Types";
import { COLS, ROWS, TILE_SIZE } from "../core/Config";
import { clamp } from "../core/Random";

/** Grid + BFS flow-field. Recomputes flow only when the walkable map changes. */
export class GridSystem {
  cells: Uint8Array = new Uint8Array(COLS * ROWS);
  flow: Int32Array = new Int32Array(COLS * ROWS); // next-cell index, -1 if none
  dist: Float32Array = new Float32Array(COLS * ROWS);
  coreCells: number[] = [];
  crystalCells: number[] = [];
  corePos = new Vector2();
  spawners: SpawnerDefinition[] = [];

  /** Cache "can place tower here?" by cell index. Invalidated on map change. */
  private placementCacheDirty = true;
  private pathWorker: Worker | null = null;

  constructor() {
    this.reset();
    if (typeof Worker !== "undefined") {
      try {
        this.pathWorker = new Worker(new URL("../workers/pathfindingWorker.ts", import.meta.url), { type: "module" });
        this.pathWorker.onmessage = (event: MessageEvent<{ flow: number[]; dist: number[] }>) => {
          this.flow.set(event.data.flow);
          this.dist.set(event.data.dist);
          this.placementCacheDirty = true;
        };
      } catch {
        this.pathWorker = null;
      }
    }
  }

  idx(c: number, r: number): number {
    return r * COLS + c;
  }
  coords(i: number): { c: number; r: number } {
    return { c: i % COLS, r: Math.floor(i / COLS) };
  }

  worldToCell(x: number, y: number): { c: number; r: number } {
    const c = clamp(Math.floor(x / TILE_SIZE), 0, COLS - 1);
    const r = clamp(Math.floor(y / TILE_SIZE), 0, ROWS - 1);
    return { c, r };
  }

  reset(): void {
    this.cells.fill(CellKind.Empty);
    this.flow.fill(-1);
    this.dist.fill(Infinity);
    this.coreCells = [];
    this.crystalCells = [];
    this.spawners = [];
    this.placementCacheDirty = true;
  }

  loadSector(sector: SectorDefinition): void {
    this.reset();
    this.spawners = sector.spawners.slice();

    // Decode layout.
    for (let r = 0; r < ROWS; r++) {
      const row = sector.layout[r] ?? "";
      for (let c = 0; c < COLS; c++) {
        const ch = row.charAt(c) || ".";
        const i = this.idx(c, r);
        switch (ch) {
          case "#":
            this.cells[i] = CellKind.Rock;
            break;
          case "C":
            this.cells[i] = CellKind.Crystal;
            this.crystalCells.push(i);
            break;
          case "X":
            this.cells[i] = CellKind.Core;
            this.coreCells.push(i);
            break;
          default:
            this.cells[i] = CellKind.Empty;
        }
      }
    }

    // Fallback core if the layout didn't specify one.
    if (this.coreCells.length === 0) {
      const cx = Math.floor(COLS / 2);
      const cy = Math.floor(ROWS / 2);
      for (const [dc, dr] of [
        [0, 0],
        [-1, 0],
        [0, -1],
        [-1, -1],
      ] as const) {
        const i = this.idx(cx + dc, cy + dr);
        this.cells[i] = CellKind.Core;
        this.coreCells.push(i);
      }
    }
    // Core center in world coords.
    const cs = this.coreCells.map((i) => this.coords(i));
    const avgC = cs.reduce((s, { c }) => s + c, 0) / cs.length + 0.5;
    const avgR = cs.reduce((s, { r }) => s + r, 0) / cs.length + 0.5;
    this.corePos = new Vector2(avgC * TILE_SIZE, avgR * TILE_SIZE);

    this.rebuildFlow();
  }

  isInside(c: number, r: number): boolean {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  }

  isWalkable(i: number): boolean {
    const k = this.cells[i];
    return k === CellKind.Empty || k === CellKind.Core || k === CellKind.Crystal;
  }

  neighborsOrthogonal(i: number): number[] {
    const { c, r } = this.coords(i);
    const out: number[] = [];
    if (c > 0) out.push(this.idx(c - 1, r));
    if (c < COLS - 1) out.push(this.idx(c + 1, r));
    if (r > 0) out.push(this.idx(c, r - 1));
    if (r < ROWS - 1) out.push(this.idx(c, r + 1));
    return out;
  }

  /** BFS outward from core cells. Cost = 1 per step. */
  rebuildFlow(): void {
    this.flow.fill(-1);
    this.dist.fill(Infinity);
    const queue: number[] = [];
    let head = 0;
    for (const core of this.coreCells) {
      this.dist[core] = 0;
      queue.push(core);
    }
    while (head < queue.length) {
      const cur = queue[head++]!;
      const d = this.dist[cur]!;
      for (const n of this.neighborsOrthogonal(cur)) {
        if (!this.isWalkable(n)) continue;
        const nd = d + 1;
        if (nd < this.dist[n]!) {
          this.dist[n] = nd;
          this.flow[n] = cur;
          queue.push(n);
        }
      }
    }
    this.placementCacheDirty = true;
    this.pathWorker?.postMessage({
      cells: Array.from(this.cells),
      coreCells: this.coreCells,
    });
  }

  /** Vector pointing toward the core from a world position. */
  getVector(x: number, y: number): Vector2 {
    const { c, r } = this.worldToCell(x, y);
    const i = this.idx(c, r);
    const next = this.flow[i];
    if (next == null || next < 0) {
      // Fall back to direct core vector.
      return this.corePos.sub(new Vector2(x, y)).normalize();
    }
    const nc = this.coords(next);
    const nx = nc.c * TILE_SIZE + TILE_SIZE / 2;
    const ny = nc.r * TILE_SIZE + TILE_SIZE / 2;
    const dx = nx - x;
    const dy = ny - y;
    const m = Math.hypot(dx, dy);
    if (m === 0) return new Vector2(0, 0);
    return new Vector2(dx / m, dy / m);
  }

  getDistAtWorld(x: number, y: number): number {
    const { c, r } = this.worldToCell(x, y);
    return this.dist[this.idx(c, r)] ?? Infinity;
  }

  /** Test placing a tower without committing. Verifies that all spawners remain reachable. */
  canPlaceTower(c: number, r: number, requiresCrystal: boolean): boolean {
    if (!this.isInside(c, r)) return false;
    const i = this.idx(c, r);
    const cur = this.cells[i];
    if (requiresCrystal) {
      return cur === CellKind.Crystal;
    }
    if (cur !== CellKind.Empty) return false;
    // Temporarily block & re-BFS; revert.
    const saved = new Int32Array(this.dist.length);
    for (let j = 0; j < this.dist.length; j++) saved[j] = this.dist[j] === Infinity ? -1 : this.dist[j]!;
    this.cells[i] = CellKind.Tower;
    this.rebuildFlow();
    const ok = this.spawners.every((s) => this.dist[this.idx(s.c, s.r)] !== Infinity);
    this.cells[i] = CellKind.Empty;
    this.rebuildFlow();
    return ok;
  }

  placeTower(c: number, r: number, kind: TowerType, isEco: boolean): void {
    const i = this.idx(c, r);
    this.cells[i] = isEco ? CellKind.Harvester : CellKind.Tower;
    this.rebuildFlow();
  }

  removeTower(c: number, r: number, wasOnCrystal: boolean): void {
    const i = this.idx(c, r);
    this.cells[i] = wasOnCrystal ? CellKind.Crystal : CellKind.Empty;
    this.rebuildFlow();
  }

  /** Expose dirty flag if future systems want to cache off the grid. */
  markCacheDirty(): void {
    this.placementCacheDirty = true;
  }
  get isPlacementCacheDirty(): boolean {
    return this.placementCacheDirty;
  }
  clearPlacementCacheDirty(): void {
    this.placementCacheDirty = false;
  }
}
