import { VIEW_WIDTH, VIEW_HEIGHT, TILE_SIZE } from "./Config";

/**
 * 2D camera with smooth pan + zoom.
 * All game-world rendering goes through worldToScreen();
 * all input coordinates go through screenToWorld().
 */
export class Camera {
  /** World-space center of the viewport. */
  x = 0;
  y = 0;

  /** Target position for smooth interpolation. */
  targetX = 0;
  targetY = 0;

  /** Current zoom (1 = 100%, 0.4 = zoomed out, 2.0 = zoomed in). */
  zoom = 1.0;
  targetZoom = 1.0;

  /** World dimensions in pixels (set when sector loads). */
  mapW = 0;
  mapH = 0;

  /** Viewport logical size (the canvas logical dimensions). */
  readonly viewW = VIEW_WIDTH;
  readonly viewH = VIEW_HEIGHT;

  /** Pan speed in px/s at zoom 1. */
  panSpeed = 600;
  /** Edge-scroll band in pixels from screen edge. */
  edgeBand = 24;
  /** Zoom limits. */
  readonly minZoom = 0.35;
  readonly maxZoom = 2.5;
  /** Interpolation speed (higher = snappier). */
  lerpSpeed = 8;

  /** True when the map is small enough to fit entirely on screen. */
  private autoFit = false;

  // ---- Panning input state (set by InputSystem) ----
  panLeft = false;
  panRight = false;
  panUp = false;
  panDown = false;
  /** Edge-scroll direction from mouse position. */
  edgePanX = 0;
  edgePanY = 0;

  /** Initialise camera for a new sector. */
  init(mapW: number, mapH: number, focusX: number, focusY: number): void {
    this.mapW = mapW;
    this.mapH = mapH;
    this.autoFit = false;

    // Check if the map fits on one screen.
    const zoomToFitW = this.viewW / mapW;
    const zoomToFitH = this.viewH / mapH;
    const fitZoom = Math.min(zoomToFitW, zoomToFitH);

    if (fitZoom >= 1.0) {
      // Map fits at 1:1 — center it, no panning needed.
      this.autoFit = true;
      this.zoom = 1.0;
      this.targetZoom = 1.0;
      this.x = mapW / 2;
      this.y = mapH / 2;
      this.targetX = this.x;
      this.targetY = this.y;
    } else {
      // Large map — start zoomed out to show most of the map, centered on focus point.
      this.zoom = Math.max(this.minZoom, Math.min(1.0, fitZoom * 1.1));
      this.targetZoom = this.zoom;
      this.x = focusX;
      this.y = focusY;
      this.targetX = this.x;
      this.targetY = this.y;
    }
  }

  /** Smoothly move toward target position/zoom each frame. */
  update(dt: number): void {
    // Apply panning from keyboard / edge scroll.
    const speed = this.panSpeed / this.zoom; // faster pan when zoomed out
    const pd = speed * dt;
    if (this.panLeft || this.edgePanX < 0) this.targetX -= pd;
    if (this.panRight || this.edgePanX > 0) this.targetX += pd;
    if (this.panUp || this.edgePanY < 0) this.targetY -= pd;
    if (this.panDown || this.edgePanY > 0) this.targetY += pd;

    // Clamp target to map bounds (with small margin).
    this.clampTarget();

    // Smooth interpolation.
    const t = 1 - Math.exp(-this.lerpSpeed * dt);
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;
    this.zoom += (this.targetZoom - this.zoom) * t;
  }

  /** Zoom toward/away from a world-space point (usually mouse position). */
  zoomAt(delta: number, worldX: number, worldY: number): void {
    if (this.autoFit) this.autoFit = false; // first zoom unlocks the camera
    const oldZoom = this.targetZoom;
    this.targetZoom = clamp(this.targetZoom * (1 + delta * 0.12), this.minZoom, this.maxZoom);
    // Adjust target position to zoom toward the cursor.
    const ratio = 1 - oldZoom / this.targetZoom;
    this.targetX += (worldX - this.targetX) * ratio;
    this.targetY += (worldY - this.targetY) * ratio;
    this.clampTarget();
  }

  /** Set zoom directly (e.g., from HUD buttons). */
  setZoom(z: number): void {
    if (this.autoFit) this.autoFit = false;
    this.targetZoom = clamp(z, this.minZoom, this.maxZoom);
  }

  /** Jump camera to a world position. */
  jumpTo(wx: number, wy: number): void {
    this.targetX = wx;
    this.targetY = wy;
    this.clampTarget();
  }

  /** Instantly snap to target (no interpolation). */
  snap(): void {
    this.x = this.targetX;
    this.y = this.targetY;
    this.zoom = this.targetZoom;
  }

  /** Convert world → screen coordinates. */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + this.viewW / 2,
      y: (wy - this.y) * this.zoom + this.viewH / 2,
    };
  }

  /** Convert screen → world coordinates. */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewW / 2) / this.zoom + this.x,
      y: (sy - this.viewH / 2) / this.zoom + this.y,
    };
  }

  /** Test if a world-space circle is visible on screen. */
  isVisible(wx: number, wy: number, radius: number): boolean {
    const s = this.worldToScreen(wx, wy);
    const r = radius * this.zoom;
    return (
      s.x + r > 0 &&
      s.x - r < this.viewW &&
      s.y + r > 0 &&
      s.y - r < this.viewH
    );
  }

  /** Get the visible world-space bounding rectangle. */
  getVisibleBounds(): { x: number; y: number; w: number; h: number } {
    const hw = (this.viewW / 2) / this.zoom;
    const hh = (this.viewH / 2) / this.zoom;
    return {
      x: this.x - hw,
      y: this.y - hh,
      w: hw * 2,
      h: hh * 2,
    };
  }

  /** Visible tile range (clamped to grid bounds). */
  getVisibleTileRange(cols: number, rows: number): { cMin: number; cMax: number; rMin: number; rMax: number } {
    const b = this.getVisibleBounds();
    return {
      cMin: Math.max(0, Math.floor(b.x / TILE_SIZE) - 1),
      cMax: Math.min(cols - 1, Math.ceil((b.x + b.w) / TILE_SIZE) + 1),
      rMin: Math.max(0, Math.floor(b.y / TILE_SIZE) - 1),
      rMax: Math.min(rows - 1, Math.ceil((b.y + b.h) / TILE_SIZE) + 1),
    };
  }

  /** Whether this camera is in auto-fit mode (small map, no user panning). */
  get isAutoFit(): boolean {
    return this.autoFit;
  }

  /** The screen-space offset to apply as ctx.translate before drawing. */
  get offsetX(): number {
    return this.viewW / 2 - this.x * this.zoom;
  }
  get offsetY(): number {
    return this.viewH / 2 - this.y * this.zoom;
  }

  private clampTarget(): void {
    // Allow the viewport center to range so the full map can be seen.
    const hw = (this.viewW / 2) / this.targetZoom;
    const hh = (this.viewH / 2) / this.targetZoom;
    if (this.mapW <= hw * 2) {
      this.targetX = this.mapW / 2;
    } else {
      this.targetX = clamp(this.targetX, hw, this.mapW - hw);
    }
    if (this.mapH <= hh * 2) {
      this.targetY = this.mapH / 2;
    } else {
      this.targetY = clamp(this.targetY, hh, this.mapH - hh);
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
