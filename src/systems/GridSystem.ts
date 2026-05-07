import { Vector2 } from "../core/Vector2";
import { CellKind } from "../core/Types";
import type { SectorDefinition, SpawnerDefinition, TowerType } from "../core/Types";
import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  MAIN_CORE_SIGNAL_RADIUS_CELLS,
  MAX_COLS,
  MAX_ROWS,
  MIN_RELAY_SPACING_CELLS,
  MIN_RELAY_TO_SPAWNER_CELLS,
  RELAY_CORE_SIGNAL_RADIUS_CELLS,
  RELAY_DEPLOY_RADIUS_CELLS,
  TILE_SIZE,
} from "../core/Config";
import { clamp } from "../core/Random";

/**
 * A cluster of contiguous core cells with a known center. The first cluster
 * loaded by the sector is treated as the "primary" / home core; subsequent
 * clusters are relay cores deployed by the player.
 */
export interface CoreCluster {
  /** Cell indices that make up this cluster. */
  cells: number[];
  /** World-space center. */
  center: Vector2;
  /** Cell-space center column (fractional). */
  centerCol: number;
  /** Cell-space center row (fractional). */
  centerRow: number;
  /** True for the original sector core. */
  isPrimary: boolean;
  /** Build / signal coverage radius in cells. Tunable per-cluster. */
  signalRadiusCells: number;
}

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
  /** Backing field for `corePos`. We never reassign it so external callers
   *  that captured a reference keep getting the live primary position. */
  private _primaryCorePos = new Vector2();
  /** All core clusters (primary first). Relay deployments append here. */
  coreClusters: CoreCluster[] = [];
  spawners: SpawnerDefinition[] = [];

  /** Coverage radius in cells for all relays; tunable at runtime (Command Tier). */
  relaySignalRadiusCells = RELAY_CORE_SIGNAL_RADIUS_CELLS;
  /** Deploy reach in cells from existing network for new relays. */
  relayDeployRadiusCells = RELAY_DEPLOY_RADIUS_CELLS;

  /** World-space primary core center. Stable: relay deployments do NOT shift it. */
  get corePos(): Vector2 {
    return this._primaryCorePos;
  }

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
    this.coreClusters = [];
    this.crystalCells = [];
    this.spawners = [];
    this._primaryCorePos.set(0, 0);
    this.relaySignalRadiusCells = RELAY_CORE_SIGNAL_RADIUS_CELLS;
    this.relayDeployRadiusCells = RELAY_DEPLOY_RADIUS_CELLS;
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
    this.coreClusters = [];
    this.crystalCells = [];
    this.spawners = sector.spawners.slice();
    this.relaySignalRadiusCells = RELAY_CORE_SIGNAL_RADIUS_CELLS;
    this.relayDeployRadiusCells = RELAY_DEPLOY_RADIUS_CELLS;
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
    this.rebuildClustersFromCells(MAIN_CORE_SIGNAL_RADIUS_CELLS);
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
      // Fall back to a direct line toward the nearest core/relay center.
      const target = this.getNearestCoreCenter(x, y);
      return target.sub(new Vector2(x, y)).normalize();
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

  /**
   * Reason returned by canPlaceCoreCluster. The InputSystem / HUD use the reason
   * to display human-readable feedback when relay deployment is invalid.
   */
  canPlaceCoreCluster(c: number, r: number): { ok: boolean; reason?: string } {
    // 2x2 relay core footprint.
    if (!this.isInside(c, r) || !this.isInside(c + 1, r + 1)) {
      return { ok: false, reason: "Invalid location" };
    }
    const cells = [
      this.idx(c, r),
      this.idx(c + 1, r),
      this.idx(c, r + 1),
      this.idx(c + 1, r + 1),
    ];
    if (cells.some((i) => this.cells[i] !== CellKind.Empty)) {
      return { ok: false, reason: "Footprint blocked" };
    }
    // Keep spawners clear so enemies have a fair start.
    const nearSpawner = this.spawners.some(
      (s) => Math.abs(s.c - c) <= MIN_RELAY_TO_SPAWNER_CELLS && Math.abs(s.r - r) <= MIN_RELAY_TO_SPAWNER_CELLS
    );
    if (nearSpawner) return { ok: false, reason: "Too close to enemy gate" };

    // The relay's center (in cell-space) at the middle of its 2x2 footprint.
    const centerCol = c + 1;
    const centerRow = r + 1;
    // Don't bunch relays. Use cluster centers rather than raw cells.
    for (const cluster of this.coreClusters) {
      const dc = centerCol - cluster.centerCol;
      const dr = centerRow - cluster.centerRow;
      if (Math.hypot(dc, dr) < MIN_RELAY_SPACING_CELLS) {
        return { ok: false, reason: "Too close to another core" };
      }
    }

    // Must be reachable from the existing signal network. We check both the
    // 2x2 footprint cells AND the center: any of them being inside relay-deploy
    // range is enough so the player can leapfrog at the edge of coverage.
    if (!this.isCellInRelayDeployRange(centerCol, centerRow)) {
      let touchesNetwork = false;
      for (let dr = 0; dr < 2; dr++) {
        for (let dc = 0; dc < 2; dc++) {
          if (this.isCellInRelayDeployRange(c + dc, r + dr)) {
            touchesNetwork = true;
            break;
          }
        }
        if (touchesNetwork) break;
      }
      if (!touchesNetwork) {
        return { ok: false, reason: "Relay must connect to signal network" };
      }
    }

    // Make sure placing a relay here doesn't permanently strand the spawners.
    // Mirror the canPlaceTower walkability check on each footprint cell.
    for (const i of cells) this.cells[i] = CellKind.Core;
    this.rebuildFlow(true);
    const reachable = this.spawners.every((s) => this.dist[this.idx(s.c, s.r)] !== Infinity);
    for (const i of cells) this.cells[i] = CellKind.Empty;
    this.rebuildFlow(true);
    if (!reachable) return { ok: false, reason: "Blocks enemy path" };

    return { ok: true };
  }

  placeCoreCluster(c: number, r: number): boolean {
    if (!this.canPlaceCoreCluster(c, r).ok) return false;
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
    const centerCol = c + 1;
    const centerRow = r + 1;
    this.coreClusters.push({
      cells: cells.slice(),
      center: new Vector2(centerCol * TILE_SIZE, centerRow * TILE_SIZE),
      centerCol,
      centerRow,
      isPrimary: false,
      signalRadiusCells: this.relaySignalRadiusCells,
    });
    this.rebuildFlow();
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // Cluster / signal coverage helpers
  // ──────────────────────────────────────────────────────────

  /** World-space center of the primary (home) core. */
  getPrimaryCoreCenter(): Vector2 {
    return this._primaryCorePos;
  }

  /** All core/relay cluster centers (world-space). */
  getCoreCenters(): Vector2[] {
    return this.coreClusters.map((c) => c.center);
  }

  getCellCenter(c: number, r: number): { x: number; y: number } {
    return { x: c * TILE_SIZE + TILE_SIZE / 2, y: r * TILE_SIZE + TILE_SIZE / 2 };
  }

  /** Nearest core/relay center to a world-space point. */
  getNearestCoreCenter(x: number, y: number): Vector2 {
    if (this.coreClusters.length === 0) return this._primaryCorePos;
    let best = this.coreClusters[0]!.center;
    let bestSq = (x - best.x) * (x - best.x) + (y - best.y) * (y - best.y);
    for (let i = 1; i < this.coreClusters.length; i++) {
      const c = this.coreClusters[i]!.center;
      const d = (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y);
      if (d < bestSq) {
        bestSq = d;
        best = c;
      }
    }
    return best;
  }

  /** Distance (px) to the nearest core/relay center. */
  getNearestCoreDistance(x: number, y: number): number {
    const c = this.getNearestCoreCenter(x, y);
    return Math.hypot(x - c.x, y - c.y);
  }

  /** True if the given cell is covered by at least one core/relay's signal radius. */
  isCellInSignalCoverage(c: number, r: number): boolean {
    if (!this.isInside(c, r)) return false;
    const cx = c + 0.5;
    const cy = r + 0.5;
    for (const cluster of this.coreClusters) {
      const dc = cx - cluster.centerCol;
      const dr = cy - cluster.centerRow;
      if (Math.hypot(dc, dr) <= cluster.signalRadiusCells) return true;
    }
    return false;
  }

  /** True if the given cell is reachable for a new relay deployment. */
  isCellInRelayDeployRange(c: number, r: number): boolean {
    if (!this.isInside(c, r)) return false;
    const cx = c + 0.5;
    const cy = r + 0.5;
    const reach = this.relayDeployRadiusCells;
    for (const cluster of this.coreClusters) {
      const dc = cx - cluster.centerCol;
      const dr = cy - cluster.centerRow;
      if (Math.hypot(dc, dr) <= reach) return true;
    }
    return false;
  }

  /**
   * Group `coreCells` into connected components and pick the cluster containing
   * the geometric centroid as the "primary". Called only on sector load.
   */
  private rebuildClustersFromCells(primaryRadiusCells: number): void {
    this.coreClusters = [];
    if (this.coreCells.length === 0) {
      this._primaryCorePos.set(0, 0);
      return;
    }

    const seen = new Set<number>();
    const groups: number[][] = [];
    for (const seed of this.coreCells) {
      if (seen.has(seed)) continue;
      const group: number[] = [];
      const stack = [seed];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (seen.has(cur)) continue;
        if (this.cells[cur] !== CellKind.Core) continue;
        seen.add(cur);
        group.push(cur);
        // 4-neighbour flood fill.
        const { c, r } = this.coords(cur);
        if (c > 0) stack.push(this.idx(c - 1, r));
        if (c < this.cols - 1) stack.push(this.idx(c + 1, r));
        if (r > 0) stack.push(this.idx(c, r - 1));
        if (r < this.rows - 1) stack.push(this.idx(c, r + 1));
      }
      if (group.length > 0) groups.push(group);
    }

    // Compute per-group center.
    const built: CoreCluster[] = groups.map((cells) => {
      let sumC = 0;
      let sumR = 0;
      for (const i of cells) {
        const { c, r } = this.coords(i);
        sumC += c;
        sumR += r;
      }
      const centerCol = sumC / cells.length + 0.5;
      const centerRow = sumR / cells.length + 0.5;
      return {
        cells,
        center: new Vector2(centerCol * TILE_SIZE, centerRow * TILE_SIZE),
        centerCol,
        centerRow,
        isPrimary: false,
        signalRadiusCells: primaryRadiusCells,
      };
    });

    // The largest cluster is the primary. (For a normal map this is the only
    // cluster on load; relay cores get added later as separate clusters.)
    built.sort((a, b) => b.cells.length - a.cells.length);
    if (built.length > 0) {
      built[0]!.isPrimary = true;
      this._primaryCorePos.x = built[0]!.center.x;
      this._primaryCorePos.y = built[0]!.center.y;
    }
    this.coreClusters = built;
  }
}

