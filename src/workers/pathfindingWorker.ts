import { CellKind } from "../core/Types";

interface PathRequest {
  cells: number[];
  coreCells: number[];
  cols: number;
  rows: number;
}

self.onmessage = (event: MessageEvent<PathRequest>) => {
  const { cells, coreCells, cols, rows } = event.data;
  const len = cols * rows;
  const flow = new Int32Array(len);
  const dist = new Float32Array(len);
  flow.fill(-1);
  dist.fill(Infinity);
  const queue: number[] = [];
  let head = 0;

  const neighbors = (i: number): number[] => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const out: number[] = [];
    if (c > 0) out.push(i - 1);
    if (c < cols - 1) out.push(i + 1);
    if (r > 0) out.push(i - cols);
    if (r < rows - 1) out.push(i + cols);
    return out;
  };
  const walkable = (i: number) => {
    const k = cells[i];
    return k === CellKind.Empty || k === CellKind.Core || k === CellKind.Crystal;
  };

  for (const core of coreCells) {
    dist[core] = 0;
    queue.push(core);
  }
  while (head < queue.length) {
    const cur = queue[head++]!;
    const d = dist[cur]!;
    for (const n of neighbors(cur)) {
      if (!walkable(n)) continue;
      const nd = d + 1;
      if (nd < dist[n]!) {
        dist[n] = nd;
        flow[n] = cur;
        queue.push(n);
      }
    }
  }
  self.postMessage({ flow: Array.from(flow), dist: Array.from(dist) });
};
