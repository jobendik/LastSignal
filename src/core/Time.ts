import { MAX_DT } from "./Config";

/**
 * Frame timing helper. Converts clock time to capped delta-time and tracks FPS.
 */
export class Time {
  private last = 0;
  dt = 0;
  scaledDt = 0;
  elapsed = 0;
  fps = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;

  timeScale = 1;

  tick(now: number): void {
    if (this.last === 0) this.last = now;
    const raw = (now - this.last) / 1000;
    this.last = now;
    this.dt = Math.min(MAX_DT, raw);
    this.scaledDt = this.dt * this.timeScale;
    this.elapsed += this.scaledDt;

    this.fpsAccum += raw;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }
  }

  reset(): void {
    this.last = 0;
    this.dt = 0;
    this.scaledDt = 0;
    this.elapsed = 0;
  }
}
