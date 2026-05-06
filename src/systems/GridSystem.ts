import { Vector2 } from "../core/Vector2";
import { CellKind } from "../core/Types";
import type { SectorDefinition, SpawnerDefinition, TowerType } from "../core/Types";
import { DEFAULT_COLS, DEFAULT_ROWS, MAX_COLS, MAX_ROWS, TILE_SIZE } from "../core/Config";
import { clamp } from "../core/Random";

/** Grid + BFS flow-field. Recomputes flow only when the walkable map changes. */
export class GridSystem {
  /** Active grid dimensions (set per-sector). */
  cols = DEFAULT_COLS;
  rows = DEFAULT_ROWS;

  cells: Uint8Array = new Uint8Array(MAX_COLS * MAX_ROWS);
  flow: Int32Array = new Int32Array(MAX_COLS * MAX_ROWS); // next-cell index, -1 if none
  dist: Float32Array = new Float32Array(MAX_COLS * MAX_ROWS);
  coreCells: number[] = [];
  crystalCells: number[] = [];
  corePos = new Vector2();
  spawners: SpawnerDefinition[] = [];

  /** World-pixel dimensions of the current map. */
  get worldW(): number { return this.cols * TILE_SIZE; }
  get worldH(): number { return this.rows * TILE_SIZE; }

  /** Cache "can place tower here?" by cell index. Invalidated on map change. */
  private placementCacheDirty = true;
  private placementCache = new Map<number, boolean>();
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
    return r * this.cols + c;
  }
  coords(i: number): { c: number; r: number } {
    return { c: i % this.cols, r: Math.floor(i / this.cols) };
  }

  worldToCell(x: number, y: number): { c: number; r: number } {
    const c = clamp(Math.floor(x / TILE_SIZE), 0, this.cols - 1);
    const r = clamp(Math.floor(y / TILE_SIZE), 0, this.rows - 1);
    return { c, r };
  }

  reset(): void {
    this.cols = DEFAULT_COLS;
    this.rows = DEFAULT_ROWS;
    const len = this.cols * this.rows;
    this.cells.fill(CellKind.Empty, 0, len);
    this.flow.fill(-1, 0, len);
    for (let i = 0; i < len; i++) this.dist[i] = Infinity;
    this.coreCells = [];
    this.crystalCells = [];
    this.spawners = [];
    this.placementCacheDirty = true;
    this.placementCache.clear();
  }

  loadSector(sector: SectorDefinition): void {
    // Set grid dimensions from sector (or use defaults for legacy sectors).
    this.cols = sector.cols ?? DEFAULT_COLS;
    this.rows = sector.rows ?? DEFAULT_ROWS;

    const len = this.cols * this.rows;
    this.cells.fill(CellKind.Empty, 0, len);
    this.flow.fill(-1, 0, len);
    for (let i = 0; i < len; i++) this.dist[i] = Infinity;
    this.coreCells = [];
    this.crystalCells = [];
    this.spawners = sector.spawners.slice();
    this.placementCacheDirty = true;
    this.placementCache.clear();

    // Decode layout.
    for (let r = 0; r < this.rows; r++) {
      const row = sector.layout[r] ?? "";
      for (let c = 0; c < this.cols; c++) {
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
      const cx = Math.floor(this.cols / 2);
      const cy = Math.floor(this.rows / 2);
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
    this.recalcCorePos();
    this.rebuildFlow();
  }

  isInside(c: number, r: number): boolean {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
  }

  isWalkable(i: number): boolean {
    const k = this.cells[i];
    return k === CellKind.Empty || k === CellKind.Core || k === CellKind.Crystal;
  }

  neighborsOrthogonal(i: number): number[] {
    const { c, r } = this.coords(i);
    const out: number[] = [];
    if (c > 0) out.push(this.idx(c - 1, r));
    if (c < this.cols - 1) out.push(this.idx(c + 1, r));
    if (r > 0) out.push(this.idx(c, r - 1));
    if (r < this.rows - 1) out.push(this.idx(c, r + 1));
    return out;
  }

  /** BFS outward from core cells. Cost = 1 per step. */
  rebuildFlow(skipCacheClear = false): void {
    if (!skipCacheClear) {
      this.placementCache.clear();
      this.placementCacheDirty = true;
    }
    const len = this.cols * this.rows;
    this.flow.fill(-1, 0, len);
    for (let i = 0; i < len; i++) this.dist[i] = Infinity;
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
    this.pathWorker?.postMessage({
      cells: Array.from(this.cells.subarray(0, len)),
      coreCells: this.coreCells,
      cols: this.cols,
      rows: this.rows,
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

    if (this.placementCache.has(i)) {
      return this.placementCache.get(i)!;
    }

    // Temporarily block & re-BFS; revert.
    this.cells[i] = CellKind.Tower;
    this.rebuildFlow(true);
    const ok = this.spawners.every((s) => this.dist[this.idx(s.c, s.r)] !== Infinity);
    this.cells[i] = CellKind.Empty;
    this.rebuildFlow(true);

    this.placementCache.set(i, ok);
    return ok;
  }

  placeTower(c: number, r: number, _kind: TowerType, isEco: boolean): void {
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
    this.placementCache.clear();
  }
  get isPlacementCacheDirty(): boolean {
    return this.placementCacheDirty;
  }
  clearPlacementCacheDirty(): void {
    this.placementCacheDirty = false;
  }

  canPlaceCoreCluster(c: number, r: number): boolean {
    // 2x2 relay core footprint.
    if (!this.isInside(c, r) || !this.isInside(c + 1, r + 1)) return false;
    const cells = [
      this.idx(c, r),
      this.idx(c + 1, r),
      this.idx(c, r + 1),
      this.idx(c + 1, r + 1),
    ];
    if (cells.some((i) => this.cells[i] !== CellKind.Empty)) return false;
    // Keep spawners and existing core perimeter clear for readability.
    const nearSpawner = this.spawners.some((s) => Math.abs(s.c - c) <= 1 && Math.abs(s.r - r) <= 1);
    if (nearSpawner) return false;
    return true;
  }

  placeCoreCluster(c: number, r: number): void {
    const cells = [
      this.idx(c, r),
      this.idx(c + 1, r),
      this.idx(c, r + 1),
      this.idx(c + 1, r + 1),
    ];
    for (const i of cells) {
      this.cells[i] = CellKind.Core;
      if (!this.coreCells.includes(i)) this.coreCells.push(i);
    }
    this.recalcCorePos();
    this.rebuildFlow();
  }

  private recalcCorePos(): void {
    const cs = this.coreCells.map((i) => this.coords(i));
    const avgC = cs.reduce((s, { c }) => s + c, 0) / Math.max(1, cs.length) + 0.5;
    const avgR = cs.reduce((s, { r }) => s + r, 0) / Math.max(1, cs.length) + 0.5;
    this.corePos = new Vector2(avgC * TILE_SIZE, avgR * TILE_SIZE);
  }
}

