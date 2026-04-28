/**
 * Small seeded PRNG (mulberry32). Used for deterministic placeholder asset
 * generation — procedural tape audio, noise textures, dust positions —
 * so that the investigation experience is reproducible across sessions.
 */
export class RNG {
  private state: number;

  constructor(seed: number = 0xC0FFEE) {
    this.state = seed >>> 0;
  }

  next(): number {
    // mulberry32
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)]!;
  }
}
