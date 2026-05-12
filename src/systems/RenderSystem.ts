import type { Game } from "../core/Game";
import { CellKind } from "../core/Types";
import type { Enemy } from "../entities/Enemy";
import { Tower } from "../entities/Tower";
import type { Drone } from "../entities/Drone";
import type { Projectile } from "../entities/Projectile";
import type { Squad } from "../entities/Squad";
import { ABANDONED_TURRET_RANGE, HARDENED_RELAY_SIGNAL_RADIUS_CELLS, TILE_SIZE } from "../core/Config";
import { towerDefinitions } from "../data/towers";
import type { TowerType, StrategicPointState, StrategicPointType } from "../core/Types";
import type { StrategicPoint } from "../entities/StrategicPoint";
import { paletteColor } from "../data/accessibilityPalettes";

/** Canvas 2D render pipeline with ordered layers. */
export class RenderSystem {
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private previousFrameCanvas: HTMLCanvasElement;
  private previousFrameCtx: CanvasRenderingContext2D;
  private noiseCanvas: HTMLCanvasElement;
  // Intermediate canvas for barrel distortion source.
  private distortionCanvas: HTMLCanvasElement;
  private distortionCtx: CanvasRenderingContext2D;
  // Pre-baked static terrain (rocks + AO shadows): rebuilt on sector start.
  private terrainCache: HTMLCanvasElement;
  private terrainCacheDirty = true;
  // Pre-built star field (static, generated once).
  private stars: { x: number; y: number; r: number; a: number }[] = [];
  // Ambient ghost silhouettes for main menu background animation.
  private menuGhosts: { x: number; y: number; vx: number; vy: number; r: number; color: string; trail: { x: number; y: number }[] }[] = [];
  private dirtyRects: { x: number; y: number; w: number; h: number }[] = [];
  /** Cached device pixel ratio — updated by notifyResize() when the window resizes. */
  dpr = window.devicePixelRatio || 1;

  /** Logical viewport width (canvas CSS pixels = camera viewport). */
  private get vw(): number { return this.game.camera.viewW; }
  /** Logical viewport height (canvas CSS pixels = camera viewport). */
  private get vh(): number { return this.game.camera.viewH; }

  /**
   * Call when the canvas backing dimensions change (e.g. portrait ↔ landscape on mobile).
   * Resizes all offscreen canvases to match the new logical viewport and re-generates
   * the star field.  Camera.resizeViewport() should be called first so this.vw/vh are
   * already updated.
   */
  resizeViewport(): void {
    const w = this.vw;
    const h = this.vh;
    this.lightCanvas.width = w;
    this.lightCanvas.height = h;
    this.previousFrameCanvas.width = w;
    this.previousFrameCanvas.height = h;
    this.distortionCanvas.width = w;
    this.distortionCanvas.height = h;
    // terrainCache is sized per-map, not per-viewport — leave it alone.
    this.generateStars(w, h);
    this.terrainCacheDirty = true;
  }

  constructor(private readonly game: Game) {
    this.lightCanvas = document.createElement("canvas");
    this.lightCanvas.width  = this.vw;
    this.lightCanvas.height = this.vh;
    this.lightCtx = this.lightCanvas.getContext("2d")!;
    this.previousFrameCanvas = document.createElement("canvas");
    this.previousFrameCanvas.width = this.vw;
    this.previousFrameCanvas.height = this.vh;
    this.previousFrameCtx = this.previousFrameCanvas.getContext("2d")!;
    this.noiseCanvas = document.createElement("canvas");
    this.noiseCanvas.width = 256;
    this.noiseCanvas.height = 256;
    this.distortionCanvas = document.createElement("canvas");
    this.distortionCanvas.width = this.vw;
    this.distortionCanvas.height = this.vh;
    this.distortionCtx = this.distortionCanvas.getContext("2d")!;
    this.terrainCache = document.createElement("canvas");
    this.terrainCache.width = this.vw;
    this.terrainCache.height = this.vh;
    this.generateNoiseTexture();
    this.generateStars(this.vw, this.vh);
    this.game.bus.on("tower:built", (t: unknown) => this.markEntityDirty(t));
    this.game.bus.on("tower:sold", (t: unknown) => this.markEntityDirty(t));
    this.game.bus.on("credits:changed", () => this.markDirty(0, 0, this.vw, 80));
  }

  /** Call when a new sector loads to force terrain re-bake next frame. */
  invalidateTerrainCache(): void {
    this.terrainCacheDirty = true;
    this.markDirty(0, 0, this.vw, this.vh);
  }

  private markDirty(x: number, y: number, w: number, h: number): void {
    if (this.dirtyRects.length > 64) this.dirtyRects.length = 0;
    this.dirtyRects.push({ x, y, w, h });
  }

  private markEntityDirty(entity: unknown): void {
    const maybe = entity as { pos?: { x: number; y: number } } | null;
    if (!maybe?.pos) return;
    this.markDirty(maybe.pos.x - 90, maybe.pos.y - 90, 180, 180);
  }

  private generateStars(w: number, h: number): void {
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        a: Math.random() * 0.55 + 0.1,
      });
    }
  }

  private generateNoiseTexture(): void {
    const nctx = this.noiseCanvas.getContext("2d")!;
    const img = nctx.createImageData(this.noiseCanvas.width, this.noiseCanvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = Math.floor(Math.random() * 90);
    }
    nctx.putImageData(img, 0, 0);
  }

  render(): void {
    const ctx = this.game.ctx;
    const settings = this.game.core.settings;
    const quality = settings.graphicsQuality;
    const reducedMotion = settings.reduceMotion || settings.reducedMotion;
    if (reducedMotion && (this.game.core.shake > 0 || this.game.core.shakeRot > 0)) {
      this.game.core.shake = 0;
      this.game.core.shakeRot = 0;
      this.game.core.shakeDecay = 30;
    }
    const dpr = this.dpr;
    const cam = this.game.camera;
    this.previousFrameCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.previousFrameCtx.clearRect(0, 0, this.vw, this.vh);
    this.previousFrameCtx.drawImage(ctx.canvas, 0, 0, this.vw, this.vh);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.vw, this.vh);
    this.dirtyRects.length = 0;

    // Screen shake: directional bias toward impact + rotational component.
    const shake = this.game.core.shake;
    const shakeRot = this.game.core.shakeRot;
    let shakeOffX = 0, shakeOffY = 0, shakeRotVal = 0;
    if (settings.screenShake && !reducedMotion && (shake > 0.01 || shakeRot > 0.001)) {
      const dir = this.game.core.shakeDir;
      const rand = (Math.random() - 0.5);
      shakeOffX = dir.x * shake * 0.6 * rand + (Math.random() - 0.5) * shake * 0.4;
      shakeOffY = dir.y * shake * 0.6 * rand + (Math.random() - 0.5) * shake * 0.4;
      shakeRotVal = (Math.random() - 0.5) * shakeRot * 2;
    }

    this.drawBackground(ctx);
    // Skip rendering the game world while the player is on the menu /
    // sector-select screens — otherwise stale terrain/towers/enemies from
    // the previous run leak through the overlay.
    if (this.game.state === "MAIN_MENU" || this.game.state === "SECTOR_SELECT" || !this.game.core.sector) {
      if (this.game.state === "MAIN_MENU" && !reducedMotion) this.drawMainMenuAmbience(ctx);
      this.drawScreenFlashes(ctx);
      return;
    }
    const allowVfx = !settings.reducedFlashing && !reducedMotion;
    if (settings.vfxPhosphor && allowVfx) {
      this.drawPhosphorPersistence(ctx);
    }

    // ---- BEGIN CAMERA TRANSFORM (world-space) ----
    ctx.save();
    // Apply shake in screen-space, then camera.
    ctx.translate(this.vw / 2 + shakeOffX, this.vh / 2 + shakeOffY);
    if (shakeRotVal !== 0) ctx.rotate(shakeRotVal);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this.drawTerrain(ctx);
    if (this.game.core.debug.showFlow) this.drawFlowDebug(ctx);
    this.drawSignalCoverage(ctx);
    this.drawStrategicPointFields(ctx);
    this.drawPathPreview(ctx);
    if (this.game.core.showHeatmap) this.drawHeatmap(ctx);
    this.drawKillZone(ctx);
    this.drawMeteorWarnings(ctx);
    this.drawGravityAnomaly(ctx);
    this.drawSignalInterference(ctx);
    this.drawCore(ctx);
    this.drawStrategicPoints(ctx);
    this.drawDamageZones(ctx);
    this.drawScorchDecals(ctx);
    this.drawRings(ctx);
    this.drawTowers(ctx);
    this.drawSilenceOverlay(ctx);
    this.drawEnemies(ctx);
    this.drawDrones(ctx);
    this.drawSquads(ctx);
    this.drawProjectiles(ctx);
    this.drawBeams(ctx);
    this.drawLightning(ctx);
    this.drawMuzzleFlashes(ctx);
    this.drawParticles(ctx);
    this.drawCreditOrbs(ctx);
    this.drawSalvagePickups(ctx);
    this.drawFloatingText(ctx);
    this.drawBuildSynergyHighlights(ctx);
    this.drawPlacementPreview(ctx);
    this.drawRelayPlacementPreview(ctx);
    this.drawSquadDeployPreview(ctx);
    this.drawSelectionHighlights(ctx);
    if (this.game.core.debug.show) this.drawDebugOverlay(ctx);

    // Dynamic light layer — additive compositing. Now driven by vfxBloom flag.
    if (settings.vfxBloom) {
      this.buildLightLayer();
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const bloomAlpha = quality === "high" ? 0.55 : quality === "medium" ? 0.36 : 0.45;
      ctx.globalAlpha = bloomAlpha;
      // Draw light canvas in world-space — we need to invert the camera to blit screen-sized texture.
      ctx.translate(cam.x, cam.y);
      ctx.scale(1 / cam.zoom, 1 / cam.zoom);
      ctx.translate(-this.vw / 2, -this.vh / 2);
      ctx.drawImage(this.lightCanvas, 0, 0, this.vw, this.vh);
      ctx.restore();
    }
    this.drawDarknessMode(ctx);

    // ---- END CAMERA TRANSFORM ----
    ctx.restore();

    // Reset to screen-space for overlays.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (allowVfx && (settings.vfxScanlines || settings.vfxVignette || settings.vfxFlicker || settings.vfxFilmGrain)) {
      this.drawCRTOverlay(ctx);
    }
    if (allowVfx && settings.vfxChromaticAberration) {
      this.drawChromaticAberration(ctx);
    }
    if (allowVfx && settings.vfxBarrelDistortion) {
      this.applyBarrelDistortion(ctx);
    }
    this.drawScreenFlashes(ctx);
    this.drawPlanningTimerArc(ctx);
    // Minimap (screen-space overlay).
    if (this.game.core.sector && !cam.isAutoFit) {
      this.drawMinimap(ctx);
    }
  }

  private buildLightLayer(): void {
    const lc = this.lightCtx;
    lc.clearRect(0, 0, this.vw, this.vh);
    lc.globalCompositeOperation = "source-over";

    const addLight = (x: number, y: number, radius: number, color: string, alpha: number) => {
      const g = lc.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, color.replace(")", `, ${alpha})`).replace("rgb", "rgba"));
      g.addColorStop(1, color.replace(")", ", 0)").replace("rgb", "rgba"));
      lc.globalAlpha = 1;
      lc.fillStyle = g;
      lc.beginPath();
      lc.arc(x, y, radius, 0, Math.PI * 2);
      lc.fill();
    };

    // Helper to parse a hex/rgb tower color into something addLight can use.
    const hexToRgb = (hex: string): string => {
      if (hex.startsWith("#")) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${r}, ${g}, ${b})`;
      }
      return hex;
    };

    // Core ambient glow — every cluster (primary + relays) emits its own
    // light pool. The primary is brightest because its integrity also reflects
    // run-end risk; relay clusters get a steady soft glow.
    const corePct = this.game.core.coreIntegrity / this.game.core.coreMax;
    const corePulse = 0.6 + Math.sin(this.game.time.elapsed * 2) * 0.2;
    const coreColor = corePct < 0.3 ? "rgb(244, 67, 54)" : "rgb(102, 252, 241)";
    for (const cluster of this.game.grid.coreClusters) {
      const radius = (cluster.isPrimary ? 80 : 56) * corePulse;
      addLight(cluster.center.x, cluster.center.y, radius, coreColor, cluster.isPrimary ? 0.5 : 0.32);
    }

    // Tower ambient glow (dim, always-on).
    for (const t of this.game.towers.list) {
      const fireGlow = Math.max(0, Math.min(1, t.recoil / 4));
      addLight(
        t.pos.x,
        t.pos.y,
        28 + fireGlow * 34,
        hexToRgb(paletteColor(t.type, t.def.color)),
        0.15 + fireGlow * 0.32
      );
    }

    // Projectile glow (brightest light source).
    for (const p of this.game.projectiles.list) {
      const radius = p.kind === "mortar" ? 18 : 12;
      addLight(p.pos.x, p.pos.y, radius, hexToRgb(paletteColor(p.ownerType, p.color)), 0.6);
    }

    // Muzzle flash lights (brief and bright).
    for (const m of this.game.particles.muzzleFlashes) {
      const intensity = m.life / m.maxLife;
      addLight(m.x, m.y, 40 * intensity, "rgb(255, 255, 200)", 0.7 * intensity);
    }

    // Explosion rings — light up nearby area.
    for (const r of this.game.particles.rings) {
      const intensity = r.life / r.maxLife;
      addLight(r.x, r.y, r.radius * 0.8, "rgb(255, 180, 50)", 0.4 * intensity);
    }

    // Enemy glow: bosses and special types.
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      if (e.isBoss) {
        addLight(e.pos.x, e.pos.y, 45, "rgb(244, 67, 54)", 0.3 + Math.sin(e.timer * 3) * 0.1);
      } else if (e.slowTimer > 0) {
        addLight(e.pos.x, e.pos.y, 18, "rgb(156, 39, 176)", 0.25);
      }
    }
  }

  private drawCRTOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const t = this.game.time.elapsed;
    const s = this.game.core.settings;

    // Scanlines: alternating dark rows with slight brightness variation.
    if (s.vfxScanlines) {
      ctx.fillStyle = "#000";
      for (let y = 0; y < this.vh; y += 3) {
        ctx.globalAlpha = 0.08 + Math.sin(y * 0.1 + t * 0.3) * 0.015;
        ctx.fillRect(0, y, this.vw, 1);
      }
    }

    // Vignette: deepens slightly toward screen edges.
    if (s.vfxVignette) {
      ctx.globalAlpha = 1;
      const vigIntensity = 0.5 + (this.game.core.coreIntegrity / this.game.core.coreMax < 0.3 ? Math.sin(t * 3) * 0.08 : 0);
      const vg = ctx.createRadialGradient(
        this.vw / 2, this.vh / 2, this.vw * 0.3,
        this.vw / 2, this.vh / 2, this.vw * 0.78
      );
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, `rgba(0,0,0,${vigIntensity.toFixed(2)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }

    // Phosphor persistence band: slow vertical drift with soft glow.
    if (s.vfxPhosphor) {
      const bandY = (Math.sin(t * 0.55) * 0.5 + 0.5) * (this.vh - 40);
      const grd = ctx.createLinearGradient(0, bandY - 12, 0, bandY + 40);
      grd.addColorStop(0,   "rgba(102, 252, 241, 0)");
      grd.addColorStop(0.3, "rgba(102, 252, 241, 0.05)");
      grd.addColorStop(0.6, "rgba(102, 252, 241, 0.03)");
      grd.addColorStop(1,   "rgba(102, 252, 241, 0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = grd;
      ctx.fillRect(0, bandY - 12, this.vw, 52);
    }

    // Occasional random flicker.
    if (s.vfxFlicker && Math.random() < 0.015) {
      ctx.globalAlpha = Math.random() * 0.04;
      ctx.fillStyle = "#66fcf1";
      ctx.fillRect(0, 0, this.vw, this.vh);
    }

    if (s.vfxFilmGrain) this.drawFilmGrain(ctx);

    ctx.restore();
  }

  private drawDarknessMode(ctx: CanvasRenderingContext2D): void {
    if (!this.game.core.sector?.darkness) return;
    const grid = this.game.grid;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(0, 0, grid.worldW, grid.worldH);
    ctx.globalCompositeOperation = "destination-out";

    const reveal = (x: number, y: number, radius: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, "rgba(0,0,0,0.95)");
      g.addColorStop(0.55, "rgba(0,0,0,0.55)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    // Each core (primary or relay) reveals its own signal radius plus a small
    // ambient fall-off. This is what makes "expansion = exploration" for darkness sectors.
    for (const cluster of grid.coreClusters) {
      const reach = Math.max(140, cluster.signalRadiusCells * TILE_SIZE * 0.95);
      reveal(cluster.center.x, cluster.center.y, reach);
    }
    for (const t of this.game.towers.list) {
      const stats = this.game.towers.effectiveStats(t);
      reveal(t.pos.x, t.pos.y, Math.max(46, Math.min(150, stats.range * 0.75)));
    }
    // Captured radar dishes light up a wide area; captured signal nodes a small
    // pool. Discovered enemy structures gleam slightly so the player can see
    // them through the dark.
    if (this.game.strategicPoints) {
      for (const p of this.game.strategicPoints.list) {
        if (p.state === "captured") {
          if (p.type === "radar_dish") {
            reveal(p.pos.x, p.pos.y, p.radiusCells * TILE_SIZE);
          } else if (p.type === "signal_node") {
            reveal(p.pos.x, p.pos.y, p.radiusCells * TILE_SIZE * 0.9);
          } else {
            reveal(p.pos.x, p.pos.y, 70);
          }
        } else if (p.discovered && (p.state === "enemy" || p.state === "neutral")) {
          reveal(p.pos.x, p.pos.y, 64);
        }
      }
    }
    // Mobile squads contribute their own reveal pool — Recon is the brightest,
    // engineer/strike/shield reveal modest areas around them.
    if (this.game.squads) {
      for (const s of this.game.squads.list) {
        if (!s.active) continue;
        const r = s.def.revealRadius;
        if (r > 0) reveal(s.pos.x, s.pos.y, r);
      }
    }
    ctx.restore();
  }

  private drawPhosphorPersistence(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = 0.11;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(this.previousFrameCanvas, 0, 0, this.vw, this.vh);
    ctx.restore();
  }

  private drawFilmGrain(ctx: CanvasRenderingContext2D): void {
    const pattern = ctx.createPattern(this.noiseCanvas, "repeat");
    if (!pattern) return;
    const ox = Math.floor(Math.random() * this.noiseCanvas.width);
    const oy = Math.floor(Math.random() * this.noiseCanvas.height);
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, this.vw + this.noiseCanvas.width, this.vh + this.noiseCanvas.height);
    ctx.restore();
  }

  private drawChromaticAberration(ctx: CanvasRenderingContext2D): void {
    // Subtle fringe: draw previous frame twice with tiny horizontal offsets at
    // screen blend, creating the illusion of R/B channel separation.
    const lowCore = this.game.core.coreIntegrity / this.game.core.coreMax < 0.3;
    const offset = lowCore ? 2.2 : 1.0;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.055;
    ctx.drawImage(this.previousFrameCanvas, -offset, 0, this.vw, this.vh);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.045;
    ctx.drawImage(this.previousFrameCanvas, offset, 0, this.vw, this.vh);
    ctx.restore();
  }

  private drawMuzzleFlashes(ctx: CanvasRenderingContext2D): void {
    for (const m of this.game.particles.muzzleFlashes) {
      const a = m.life / m.maxLife;
      const color = paletteColor(undefined, m.color);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      ctx.globalAlpha = a;
      ctx.shadowBlur = 14;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(22 * a + 10, -5 * a);
      ctx.lineTo(22 * a + 10, 5 * a);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = a * 0.9;
      ctx.beginPath();
      ctx.arc(6, 0, 4 * a + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Sector-specific theme: tint background and grid to the sector's accent color.
    const accent = this.game.core.sector?.accentColor ?? "#66fcf1";
    const hexToRgbArr = (hex: string): [number, number, number] => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };
    const [ar, ag, ab] = hexToRgbArr(accent);

    // Background gradient: dark center, sector-tinted edge.
    const bg = ctx.createRadialGradient(
      this.vw / 2, this.vh / 2, 80,
      this.vw / 2, this.vh / 2, this.vw / 1.1
    );
    bg.addColorStop(0, "rgba(10, 14, 20, 1)");
    bg.addColorStop(1, `rgba(${Math.round(ar * 0.04)}, ${Math.round(ag * 0.04)}, ${Math.round(ab * 0.06)}, 1)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.vw, this.vh);

    // Twinkling star field — color-tinted per sector.
    const menuMotionPaused =
      this.game.state === "MAIN_MENU" &&
      (this.game.core.settings.reduceMotion || this.game.core.settings.reducedMotion);
    const elapsed = menuMotionPaused ? 0 : this.game.time.elapsed;
    ctx.shadowBlur = 0;
    const starColor = `rgb(${Math.round(180 + ar * 0.25)}, ${Math.round(180 + ag * 0.25)}, ${Math.round(180 + ab * 0.25)})`;
    for (const s of this.stars) {
      const twinkle = s.a * (0.75 + Math.sin(elapsed * 1.3 + s.x * 0.07) * 0.25);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = starColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Animated grid: sector accent color instead of always cyan.
    const COLS = this.game.grid.cols;
    const ROWS = this.game.grid.rows;
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      const wave = 0.04 + Math.sin(elapsed * 1.6 - c * 0.3) * 0.025;
      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${wave.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(c * TILE_SIZE, 0);
      ctx.lineTo(c * TILE_SIZE, ROWS * TILE_SIZE);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      const wave = 0.04 + Math.sin(elapsed * 1.6 - r * 0.3) * 0.025;
      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${wave.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(0, r * TILE_SIZE);
      ctx.lineTo(COLS * TILE_SIZE, r * TILE_SIZE);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Bake static rocks + ambient occlusion into the off-screen cache canvas. */
  private buildTerrainCache(): void {
    const grid = this.game.grid;
    const COLS = grid.cols;
    const ROWS = grid.rows;
    // Resize cache if needed (large maps).
    const cacheW = COLS * TILE_SIZE;
    const cacheH = ROWS * TILE_SIZE;
    if (this.terrainCache.width !== cacheW || this.terrainCache.height !== cacheH) {
      this.terrainCache.width = cacheW;
      this.terrainCache.height = cacheH;
    }
    const tc = this.terrainCache.getContext("2d")!;
    tc.clearRect(0, 0, cacheW, cacheH);

    // Rock polygons.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = grid.idx(c, r);
        if (grid.cells[i] !== CellKind.Rock) continue;
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        const rng = (n: number) => Math.abs(Math.sin((c * 31 + r * 17) * 13.7 + n * 7.3));
        const cx = x + TILE_SIZE / 2;
        const cy = y + TILE_SIZE / 2;
        const pts = 7;
        tc.beginPath();
        for (let j = 0; j < pts; j++) {
          const ang = (j / pts) * Math.PI * 2 - Math.PI / 2 + rng(j + 20) * 0.3;
          const rad = 8 + rng(j) * 5;
          const px = cx + Math.cos(ang) * rad;
          const py = cy + Math.sin(ang) * rad;
          j === 0 ? tc.moveTo(px, py) : tc.lineTo(px, py);
        }
        tc.closePath();
        tc.fillStyle = "#232a33";
        tc.fill();
        tc.strokeStyle = "#0e1216";
        tc.lineWidth = 1.5;
        tc.stroke();
        // Highlight edge.
        tc.beginPath();
        for (let j = 0; j < 2; j++) {
          const ang = (j / pts) * Math.PI * 2 - Math.PI / 2 + rng(j + 20) * 0.3;
          const rad = 8 + rng(j) * 5;
          const px = cx + Math.cos(ang) * rad;
          const py = cy + Math.sin(ang) * rad;
          j === 0 ? tc.moveTo(px, py) : tc.lineTo(px, py);
        }
        tc.strokeStyle = "rgba(70, 90, 110, 0.5)";
        tc.lineWidth = 1;
        tc.stroke();
      }
    }

    // Ambient occlusion: dark gradient on open tiles adjacent to rock/crystal.
    const AO_DEPTH = 12;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const k = grid.cells[grid.idx(c, r)];
        if (k !== CellKind.Rock && k !== CellKind.Crystal) continue;
        const checks = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
        for (const [dc, dr] of checks) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
          const nk = grid.cells[grid.idx(nc, nr)];
          if (nk === CellKind.Rock || nk === CellKind.Crystal) continue;
          const nx = nc * TILE_SIZE;
          const ny = nr * TILE_SIZE;
          const sx = nx + (dc === -1 ? TILE_SIZE : 0);
          const sy = ny + (dr === -1 ? TILE_SIZE : 0);
          const ex = sx + dc * -AO_DEPTH;
          const ey = sy + dr * -AO_DEPTH;
          const aoGrd = tc.createLinearGradient(sx, sy, ex, ey);
          aoGrd.addColorStop(0, "rgba(0,0,0,0.4)");
          aoGrd.addColorStop(1, "rgba(0,0,0,0)");
          tc.fillStyle = aoGrd;
          tc.fillRect(nx, ny, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    this.terrainCacheDirty = false;
  }

  private drawTerrain(ctx: CanvasRenderingContext2D): void {
    // Static rocks + AO — blit from cache (rebuild only when sector changes).
    if (this.terrainCacheDirty) this.buildTerrainCache();
    ctx.drawImage(this.terrainCache, 0, 0);

    const grid = this.game.grid;
    const COLS = grid.cols;
    const ROWS = grid.rows;
    // Crystals: dynamic (rotate each frame).
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = grid.idx(c, r);
        if (grid.cells[i] !== CellKind.Crystal) continue;
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        const cx = x + TILE_SIZE / 2;
        const cy = y + TILE_SIZE / 2;
        const rot = this.game.time.elapsed * 0.45 + (c * 7 + r * 13) * 0.9;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.fillStyle = "#00e676";
        ctx.globalAlpha = 0.72;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#00e676";
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(6, 0);
        ctx.lineTo(0, 8);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(3, 0);
        ctx.lineTo(0, 4);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fillStyle = "#b9f6ca";
        ctx.fill();
        ctx.restore();
      }
    }

    // Spawner portals: animated energy vortex.
    const t = this.game.time.elapsed;
    for (const s of grid.spawners) {
      const cx = s.c * TILE_SIZE + TILE_SIZE / 2;
      const cy = s.r * TILE_SIZE + TILE_SIZE / 2;
      ctx.save();

      // Dark base.
      ctx.fillStyle = "rgba(80, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();

      // Inner glowing core.
      const pulse = 0.65 + Math.sin(t * 4) * 0.25;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9);
      grd.addColorStop(0, `rgba(255, 60, 60, ${pulse.toFixed(2)})`);
      grd.addColorStop(1, "rgba(180, 0, 0, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();

      // Outer rotating ring (2 segments, gaps between).
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#f44336";
      ctx.strokeStyle = "rgba(244, 67, 54, 0.9)";
      ctx.lineWidth = 2;
      const rot = t * 2.2;
      for (let seg = 0; seg < 3; seg++) {
        const startAngle = rot + (seg / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 14 + Math.sin(t * 3) * 1.5, startAngle, startAngle + Math.PI * 0.55);
        ctx.stroke();
      }

      // Energy tendrils (tiny radiating lines).
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 100, 100, 0.5)";
      for (let i = 0; i < 6; i++) {
        const angle = t * 1.5 + (i / 6) * Math.PI * 2;
        const r1 = 5, r2 = 11 + Math.sin(t * 5 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
        ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Telegraph: flash spawner bright when a group is about to spawn.
    if (this.game.state === "WAVE_ACTIVE") {
      for (const sign of this.game.waves.telegraphSigns) {
        ctx.save();
        ctx.globalAlpha = sign.intensity * 0.65;
        ctx.strokeStyle = "#ff5252";
        ctx.lineWidth = 3 + sign.intensity * 3;
        ctx.shadowBlur = 20 + sign.intensity * 20;
        ctx.shadowColor = "#ff1a00";
        ctx.beginPath();
        ctx.arc(sign.x, sign.y, 18 + sign.intensity * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawCore(ctx: CanvasRenderingContext2D): void {
    const grid = this.game.grid;
    const pct = this.game.core.coreIntegrity / this.game.core.coreMax;
    const cx = grid.corePos.x;
    const cy = grid.corePos.y;
    const elapsed = this.game.time.elapsed;
    const pulse = 0.7 + Math.sin(elapsed * 2) * 0.15;
    const accent = pct < 0.3 ? "#f44336" : "#66fcf1";
    const accentRgb = pct < 0.3 ? "244,67,54" : "102,252,241";

    ctx.save();

    // ---- Base plates ----
    ctx.fillStyle = "rgba(8, 12, 18, 0.92)";
    for (const i of grid.coreCells) {
      const { c, r } = grid.coords(i);
      ctx.fillRect(c * TILE_SIZE + 1, r * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }

    // ---- Outer slow-rotating ring (integrity display) ----
    ctx.shadowBlur = 20;
    ctx.shadowColor = accent;
    ctx.strokeStyle = `rgba(${accentRgb}, 0.25)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.stroke();

    if (this.game.hasCoreDeflector()) {
      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#80d8ff";
      ctx.strokeStyle = `rgba(128, 216, 255, ${(0.45 + Math.sin(elapsed * 4) * 0.16).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.lineDashOffset = -elapsed * 18;
      ctx.beginPath();
      ctx.arc(cx, cy, 43, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // HP arc overlay on the outer ring.
    ctx.shadowBlur = 8;
    ctx.strokeStyle = pct < 0.3 ? "#f44336" : pct < 0.6 ? "#ffb300" : "#4caf50";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();

    // Tick marks on the outer ring (10 segments).
    ctx.strokeStyle = `rgba(${accentRgb}, 0.4)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 33, cy + Math.sin(a) * 33);
      ctx.lineTo(cx + Math.cos(a) * 39, cy + Math.sin(a) * 39);
      ctx.stroke();
    }

    // ---- Counter-rotating inner ring ----
    const rot2 = -elapsed * 0.4;
    ctx.shadowBlur = 12;
    ctx.shadowColor = accent;
    ctx.strokeStyle = `rgba(${accentRgb}, 0.55)`;
    ctx.lineWidth = 2;
    for (let seg = 0; seg < 4; seg++) {
      const sa = rot2 + (seg / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 24, sa, sa + Math.PI * 0.35);
      ctx.stroke();
    }

    // ---- Antenna arms (4 radiating lines) ----
    ctx.shadowBlur = 6;
    ctx.strokeStyle = `rgba(${accentRgb}, 0.7)`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + elapsed * 0.2;
      const len = 18 + Math.sin(elapsed * 3 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 12, cy + Math.sin(angle) * 12);
      ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      ctx.stroke();
      // Antenna tip dot.
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Central core orb ----
    ctx.shadowBlur = 40 * pulse;
    ctx.shadowColor = accent;
    // Damaged panels: sections of the orb turn dark as HP drops.
    const brokenSectors = Math.floor((1 - pct) * 8);
    for (let i = 0; i < 8; i++) {
      const sa = (i / 8) * Math.PI * 2;
      const color = i < brokenSectors ? "rgba(40,10,10,0.8)" : `rgba(${accentRgb}, ${0.18 * pulse})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 16, sa, sa + Math.PI * 0.25);
      ctx.closePath();
      ctx.fill();
    }

    // Outer bright ring.
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.stroke();

    // Hot inner glow.
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
    grd.addColorStop(0, `rgba(${accentRgb}, ${(0.7 * pulse).toFixed(2)})`);
    grd.addColorStop(1, `rgba(${accentRgb}, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();

    // Relay clusters: smaller indicator rings + spinning antenna so the player
    // can tell relay positions apart from the primary core at a glance.
    for (const cluster of grid.coreClusters) {
      if (cluster.isPrimary) continue;
      // Synthetic signal-node clusters have no backing cells and are drawn by
      // the strategic-point renderer — skip them here.
      if (cluster.cells.length === 0) continue;
      const rx = cluster.center.x;
      const ry = cluster.center.y;
      const isHardened = cluster.variant === "hardened";
      const relayColor = isHardened ? "#ff9800" : "#66fcf1";
      const relayRgb = isHardened ? "255,152,0" : "102,252,241";

      ctx.save();

      if (cluster.destroyed) {
        // Destroyed relay: dim wreck indicator.
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#f44336";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(rx, ry, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#f44336";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✗", rx, ry);
        ctx.restore();
        continue;
      }

      ctx.shadowBlur = 12;
      ctx.shadowColor = relayColor;
      ctx.strokeStyle = `rgba(${relayRgb}, 0.55)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 22, 0, Math.PI * 2);
      ctx.stroke();
      // Spinning short arms (smaller than the main core).
      ctx.strokeStyle = `rgba(${relayRgb}, 0.85)`;
      ctx.lineWidth = 1.5;
      const armCount = isHardened ? 4 : 3;
      for (let i = 0; i < armCount; i++) {
        const angle = (i / armCount) * Math.PI * 2 + elapsed * (isHardened ? 0.4 : 0.6);
        ctx.beginPath();
        ctx.moveTo(rx + Math.cos(angle) * 8, ry + Math.sin(angle) * 8);
        ctx.lineTo(rx + Math.cos(angle) * 14, ry + Math.sin(angle) * 14);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(${relayRgb}, 0.85)`;
      ctx.beginPath();
      ctx.arc(rx, ry, 3, 0, Math.PI * 2);
      ctx.fill();

      // Relay HP bar (drawn only when HP < max, i.e. has taken damage).
      if (cluster.maxHp > 0 && cluster.hp < cluster.maxHp) {
        const hpPct = cluster.hp / cluster.maxHp;
        const barW = 32;
        const barH = 3;
        const barX = rx - barW / 2;
        const barY = ry + 26;
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(barX, barY, barW, barH);
        const barColor = hpPct < 0.3 ? "#f44336" : hpPct < 0.6 ? "#ffb300" : relayColor;
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, barW * hpPct, barH);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private drawTowers(ctx: CanvasRenderingContext2D): void {
    for (const t of this.game.towers.list) this.drawTower(ctx, t);
    // Dissolving towers: scale down + fade out after sell.
    for (const t of this.game.towers.dissolving) {
      const prog = t.dissolveTimer / Tower.DISSOLVE_MAX; // 1 → 0
      ctx.save();
      ctx.translate(t.pos.x, t.pos.y);
      ctx.globalAlpha = prog * 0.7;
      ctx.scale(prog, prog);
      ctx.shadowBlur = 14 * prog;
      ctx.shadowColor = t.def.color;
      ctx.fillStyle = t.def.color;
      ctx.fillRect(-8, -8, 16, 16);
      // Outward-flying fragments.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const dist = (1 - prog) * 18;
        ctx.globalAlpha = prog * 0.5;
        ctx.fillRect(Math.cos(a) * dist - 2, Math.sin(a) * dist - 2, 4, 4);
      }
      ctx.restore();
    }
  }

  private drawTower(ctx: CanvasRenderingContext2D, t: Tower): void {
    ctx.save();

    // Construction animation: scale in with part-flyby streaks.
    if (t.buildProgress < 1) {
      const prog = t.buildProgress;
      const eased = prog * prog * (3 - 2 * prog); // smoothstep
      ctx.translate(t.pos.x, t.pos.y);
      ctx.scale(eased, eased);
      ctx.globalAlpha = eased;
      ctx.fillStyle = t.def.color;
      ctx.shadowBlur = 16;
      ctx.shadowColor = t.def.color;
      // Flying parts converging to center.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const dist = (1 - prog) * 22;
        ctx.save();
        ctx.globalAlpha = (1 - prog) * 0.7;
        ctx.fillRect(Math.cos(a) * dist - 2, Math.sin(a) * dist - 2, 4, 4);
        ctx.restore();
      }
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
      return;
    }

    const disabled = this.game.towers["disabled"].has(t) || t.disabled;
    // Check jammer aura — covers both jammer enemies AND strategic-point jammer
    // fields so both show the same orange interference halo.
    const jammedByEnemy = this.game.enemies.list.some(
      (e) => e.active && e.type === "jammer" && e.pos.dist(t.pos) < 80
    );
    const jammedByStructure = this.game.strategicPoints?.isWorldPointJammed(t.pos.x, t.pos.y) ?? false;
    const jammed = !disabled && (jammedByEnemy || jammedByStructure);
    const ds = t.durabilityState;
    // Damaged towers darken slightly even when not disabled so the player can
    // read state at a glance. Critical pushes further; disabled pushes hardest.
    let alphaMul = 1;
    if (disabled) alphaMul = 0.45;
    else if (ds === "critical") alphaMul = 0.85;
    else if (ds === "damaged") alphaMul = 0.95;
    if (jammed) alphaMul = Math.min(alphaMul, 0.78);
    ctx.globalAlpha = alphaMul;

    // Base plate.
    ctx.fillStyle = "#141a22";
    ctx.strokeStyle = "#2b3542";
    ctx.fillRect(t.c * TILE_SIZE + 3, t.r * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    ctx.strokeRect(t.c * TILE_SIZE + 3, t.r * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);

    // Turret.
    ctx.translate(t.pos.x, t.pos.y);
    const stats = this.game.towers.effectiveStats(t);
    const elapsed = this.game.time.elapsed;
    const aimAngle = t.isEco ? 0 : t.angle;

    // --- Idle ring animations (drawn in world space before rotation) ---
    if (t.type === "pulse") {
      // Three slow-rotating arcs (visual "antenna scan").
      ctx.save();
      const rot = elapsed * 1.1;
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = t.def.color;
      for (let seg = 0; seg < 3; seg++) {
        const sa = rot + (seg / 3) * Math.PI * 2;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(0, 0, 13, sa, sa + Math.PI * 0.45);
        ctx.stroke();
      }
      ctx.restore();
    } else if (t.type === "stasis") {
      // 4 orbiting ice shards.
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const angle = elapsed * 1.8 + (i / 4) * Math.PI * 2;
        const ox = Math.cos(angle) * 11;
        const oy = Math.sin(angle) * 11;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(angle + Math.PI / 4);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = t.def.color;
        ctx.fillRect(-2, -4, 4, 8);
        ctx.restore();
      }
      ctx.restore();
    } else if (t.type === "barrier") {
      // 6 pulsing shield bars radiating outward.
      ctx.save();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + elapsed * 0.6;
        const pulse = 0.3 + Math.sin(elapsed * 4 + i) * 0.2;
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = t.def.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
        ctx.lineTo(Math.cos(angle) * 13, Math.sin(angle) * 13);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (!t.isEco) ctx.rotate(aimAngle);

    // Fire glow: shadowBlur spikes when recoil is active (just fired).
    const fireBurst = t.recoil / 4;
    const overchargeGlow = t.overcharge >= 5 ? 12 + Math.sin(elapsed * 8) * 3 : 0;
    ctx.shadowBlur = 8 + fireBurst * 20 + overchargeGlow;
    ctx.shadowColor = t.def.color;
    ctx.fillStyle = t.def.color;

    if (t.type === "mortar") {
      // Tube with elevation angle hint.
      ctx.fillRect(-6, -10, 12, 20);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(-2, -8, 4, 8);
    } else if (t.type === "harvester") {
      ctx.beginPath();
      ctx.arc(0, 0, 10 + Math.sin(elapsed * 3) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (t.type === "tesla") {
      ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-2, -2, 4, 4);
      // Idle micro-arcs between corner nodes.
      if (Math.sin(elapsed * 12) > 0.7) {
        ctx.strokeStyle = t.def.color;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(-6, -6);
        ctx.lineTo(0 + (Math.random() - 0.5) * 4, 0 + (Math.random() - 0.5) * 4);
        ctx.lineTo(6, 6);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else if (t.type === "railgun") {
      // Long thin rail with accent hub.
      ctx.fillRect(-3 - (t.recoil || 0), -3, 22, 6);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-2, -6, 6, 12);
      // Charge fill: bright bar growing along barrel based on cooldown progress.
      const chargeProgress = Math.max(0, Math.min(1, 1 - t.timer / stats.cooldown));
      if (chargeProgress > 0.1) {
        ctx.fillStyle = `rgba(255,255,255,${(chargeProgress * 0.8).toFixed(2)})`;
        ctx.fillRect(3, -2, (16 * chargeProgress) | 0, 4);
      }
    } else if (t.type === "flamer") {
      ctx.fillRect(-2 - (t.recoil || 0), -5, 12, 10);
      const flick = 0.6 + Math.sin(elapsed * 24) * 0.25;
      ctx.fillStyle = `rgba(255, 180, 60, ${flick.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(10, 0, 3.5 + fireBurst * 2, 0, Math.PI * 2);
      ctx.fill();
      // Overheat glow: barrel turns red-hot above heat threshold.
      if (t.heatTimer > 2) {
        const heatFrac = Math.min(1, (t.heatTimer - 2) / 6);
        const r = 255;
        const g = Math.round(100 - heatFrac * 80);
        ctx.save();
        ctx.shadowBlur = 18 + heatFrac * 14;
        ctx.shadowColor = `rgb(${r},${g},0)`;
        ctx.globalAlpha = heatFrac * 0.6;
        ctx.fillStyle = `rgb(${r},${g},0)`;
        ctx.fillRect(-2, -5, 12, 10);
        // Barrel tip ember.
        ctx.beginPath();
        ctx.arc(10, 0, 4 + heatFrac * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (t.type === "barrier") {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * 8;
        const y = Math.sin(a) * 8;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = t.def.color;
      ctx.globalAlpha = 0.4 + Math.sin(elapsed * 3) * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (t.type === "amplifier") {
      // Octagonal base.
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
        const rad = 8;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // Three rotating signal rings pulsing outward.
      const ampBoost = t.flags.resonanceCore ? 0.25 : 0.15;
      const ringR = t.flags.resonanceCore ? 2 : 1;
      const ringCount = 3;
      for (let i = 0; i < ringCount; i++) {
        const phase = (elapsed * 1.4 + i * (1 / ringCount)) % 1;
        const r2 = 10 + phase * (ringR === 2 ? 60 : 30);
        const alpha = (1 - phase) * 0.55;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = t.def.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, r2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Center label.
      ctx.shadowBlur = 0;
      ctx.fillStyle = t.def.color;
      ctx.font = "bold 7px Courier New";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${Math.round(ampBoost * 100)}%`, 0, 0);
    } else if (t.type === "reflector") {
      ctx.rotate(-aimAngle);
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 14;
      ctx.shadowColor = t.def.color;
      ctx.beginPath();
      ctx.moveTo(-11, -7);
      ctx.lineTo(11, 7);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, 11, elapsed * 1.4, elapsed * 1.4 + Math.PI * 1.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.rotate(aimAngle);
    } else if (t.type === "snare") {
      ctx.fillRect(-4 - (t.recoil || 0), -5, 15, 10);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const x = 3 + i * 4;
        ctx.beginPath();
        ctx.moveTo(x, -5);
        ctx.lineTo(x + 3, 5);
        ctx.stroke();
      }
    } else if (t.type === "overclock") {
      ctx.rotate(-aimAngle);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + elapsed * 0.7;
        const rad = i % 2 === 0 ? 11 : 7;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(0, 0, 14 + Math.sin(elapsed * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.rotate(aimAngle);
    } else {
      ctx.fillRect(-3 - (t.recoil || 0), -7, 14, 14);
    }

    // Level pips.
    ctx.rotate(-aimAngle);
    ctx.shadowBlur = 0;
    const pips = Math.min(t.level, 5);
    ctx.fillStyle = "#ffeb3b";
    for (let i = 0; i < pips; i++) {
      ctx.fillRect(-9 + i * 4, -14, 3, 3);
    }
    if (t.specId) {
      ctx.fillStyle = "#ff9800";
      ctx.fillRect(-9, -18, 18, 2);
    }

    // Specialization silhouettes: each spec adds a small, readable module to the tower body.
    if (t.specId) {
      ctx.save();
      ctx.strokeStyle = "#ff9800";
      ctx.fillStyle = "#ff9800";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#ff9800";
      ctx.globalAlpha = 0.9;
      if (t.specId.includes("focus_lens")) {
        ctx.beginPath();
        ctx.arc(10, 0, 5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (t.specId.includes("chain_storm")) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + elapsed;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 12, Math.sin(a) * 12, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (t.specId.includes("ricochet") || t.flags.railRicochet) {
        ctx.beginPath();
        ctx.moveTo(-10, 9);
        ctx.lineTo(0, 14);
        ctx.lineTo(10, 9);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 12, elapsed, elapsed + Math.PI * 0.75);
        ctx.stroke();
      }
      if (t.pinnacleId) {
        ctx.strokeStyle = "#ffffff";
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(0, 0, 24, -elapsed * 1.2, -elapsed * 1.2 + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Level-based structural complexity.
    if (t.level >= 2 && !t.isEco) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 4;
      ctx.shadowColor = t.def.color;
      // L2: thin accent ring.
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.stroke();
      if (t.level >= 3) {
        // L3: second outer ring with slight glow.
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (t.level >= 4) {
        // L4: 4 diagonal strut lines from center.
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        for (let si = 0; si < 4; si++) {
          const a = (si / 4) * Math.PI * 2 + Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
          ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    if (t.overcharge >= 5 && !t.isEco) {
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ffeb3b";
      ctx.beginPath();
      ctx.arc(0, 0, 18 + Math.sin(elapsed * 6) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (t.powerSurgeTimer > 0) {
      const pulse = 0.65 + Math.sin(elapsed * 18) * 0.25;
      ctx.strokeStyle = "#64ffda";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#64ffda";
      ctx.globalAlpha = pulse;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -elapsed * 42;
      ctx.beginPath();
      ctx.arc(0, 0, 23 + Math.sin(elapsed * 10) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (this.game.core.settings.colorblind) {
      ctx.shadowBlur = 3;
      ctx.shadowColor = "#000";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px Courier New";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.type.charAt(0).toUpperCase(), 0, 0);
    }

    // Cooldown arc — drawn around the base plate after all rotation resets.
    this.drawCooldownArc(ctx, t);

    // Jammer interference halo + flicker overlay. Distinct orange tint so the
    // player reads "this tower is being suppressed" at a glance, not "it's
    // upgrading or buffed".
    if (jammed) {
      const t2 = this.game.time.elapsed;
      const pulse = 0.55 + Math.sin(t2 * 14) * 0.35;
      ctx.save();
      ctx.globalAlpha = pulse * 0.85;
      ctx.strokeStyle = "#ef6c00";
      ctx.lineWidth = 1.6;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#ef6c00";
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = t2 * -30;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Cross-hatch flicker over the tower body during the brief alpha dips.
      if (Math.sin(t2 * 22) > 0.4) {
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-12, -2 + Math.sin(t2 * 30) * 1.5);
        ctx.lineTo(12, 2 + Math.sin(t2 * 30) * 1.5);
        ctx.stroke();
      }
      // "JAM" tag above the tower so the cause is unambiguous.
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ef6c00";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("JAM", 0, -22);
      ctx.restore();
    }

    // Durability overlays — draw after rotation reset so they sit on the body.
    this.drawTowerDurability(ctx, t, ds, disabled);

    ctx.restore();
    void stats;
  }

  /**
   * Visual feedback for tower durability:
   *  - damaged: small flickering sparks
   *  - critical: stronger flicker + warning border
   *  - disabled: dimmed body with broken icon
   *  - underRepair: green pulse halo
   *  - shielded: cyan outline ring
   *  - damageFlashTimer > 0: brief red flash on hit
   *  - HP bar above the tower when not full HP
   */
  private drawTowerDurability(
    ctx: CanvasRenderingContext2D,
    t: Tower,
    ds: "operational" | "damaged" | "critical" | "disabled" | "destroyed",
    disabled: boolean,
  ): void {
    const elapsed = this.game.time.elapsed;

    // Recent damage flash — short red overlay punch.
    if (t.damageFlashTimer > 0) {
      const k = Math.min(1, t.damageFlashTimer / 0.45);
      ctx.save();
      ctx.globalAlpha = 0.5 * k;
      ctx.fillStyle = "#ff5252";
      ctx.fillRect(-12, -12, 24, 24);
      ctx.restore();
    }

    // Damaged: occasional spark from a random offset around the body.
    if (ds === "damaged" && !disabled) {
      const flicker = Math.sin(elapsed * 13 + t.c * 0.7 + t.r * 0.3);
      if (flicker > 0.85) {
        ctx.save();
        ctx.fillStyle = "#ffd54f";
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#ffd54f";
        const ox = Math.cos(elapsed * 11) * 7;
        const oy = Math.sin(elapsed * 9) * 7;
        ctx.fillRect(ox - 1, oy - 1, 2, 2);
        ctx.restore();
      }
    }

    // Critical: stronger flicker + warning ring.
    if (ds === "critical" && !disabled) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(elapsed * 18) * 0.25;
      ctx.strokeStyle = "#ff8a65";
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ff5252";
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.stroke();
      // Spark spray — 2 sparks per frame at random offsets.
      ctx.fillStyle = "#ffeb3b";
      ctx.shadowColor = "#ffeb3b";
      for (let i = 0; i < 2; i++) {
        const a = elapsed * 7 + i * 2.1 + t.c;
        const ox = Math.cos(a) * 9;
        const oy = Math.sin(a) * 9;
        ctx.fillRect(ox - 1, oy - 1, 2, 2);
      }
      ctx.restore();
    }

    // Disabled: dim cross + offline icon.
    if (disabled) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#ff5252";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#ff5252";
      ctx.beginPath();
      ctx.moveTo(-9, -9);
      ctx.lineTo(9, 9);
      ctx.moveTo(9, -9);
      ctx.lineTo(-9, 9);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ff5252";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("OFFLINE", 0, -22);
      ctx.restore();
    }

    // Under-repair halo: bright green pulse.
    if (t.underRepair && !disabled) {
      ctx.save();
      const pulse = 0.4 + Math.sin(elapsed * 8) * 0.25;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#9be7a7";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#9be7a7";
      ctx.beginPath();
      ctx.arc(0, 0, 21 + Math.sin(elapsed * 6) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (t.underRepair && disabled) {
      // Restoration pulse: rising rings telegraph the revival.
      ctx.save();
      const ph = (elapsed % 1.0) / 1.0;
      ctx.globalAlpha = 0.45 * (1 - ph);
      ctx.strokeStyle = "#9be7a7";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 18 + ph * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Shield outline.
    if (t.shielded && !disabled) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(elapsed * 4) * 0.15;
      ctx.strokeStyle = "#80deea";
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#80deea";
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // HP bar — only render when not full so the field stays clean.
    if (t.hp < t.maxHp && t.maxHp > 0) {
      ctx.save();
      const barW = 22;
      const barH = 3;
      const yOff = -16;
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(-barW / 2 - 1, yOff - 1, barW + 2, barH + 2);
      const pct = Math.max(0, Math.min(1, t.hpPct));
      const color =
        pct > 0.65 ? "#9be7a7" :
        pct > 0.30 ? "#ffd54f" :
        pct > 0    ? "#ff8a65" :
                     "#ff5252";
      ctx.fillStyle = color;
      ctx.fillRect(-barW / 2, yOff, Math.max(0, barW * pct), barH);
      ctx.restore();
    }
  }

  private drawCooldownArc(ctx: CanvasRenderingContext2D, t: Tower): void {
    if (t.isEco) {
      // Harvester: green income arc.
      const stats = this.game.towers.effectiveStats(t);
      const progress = Math.max(0, Math.min(1, 1 - t.timer / stats.cooldown));
      ctx.beginPath();
      ctx.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false);
      ctx.strokeStyle = progress >= 0.98 ? "#00e676" : "rgba(0, 230, 118, 0.45)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = progress >= 0.98 ? 8 : 0;
      ctx.shadowColor = "#00e676";
      ctx.stroke();
      return;
    }
    if (t.type === "barrier" || t.type === "stasis") return; // handled elsewhere
    const stats = this.game.towers.effectiveStats(t);
    const progress = Math.max(0, Math.min(1, 1 - t.timer / stats.cooldown));
    if (progress < 0.02) return; // nothing to draw yet
    const isReady = progress >= 0.98;
    ctx.beginPath();
    ctx.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false);
    ctx.strokeStyle = isReady ? t.def.color : "rgba(255,255,255,0.18)";
    ctx.lineWidth = isReady ? 2 : 1.5;
    ctx.shadowBlur = isReady ? 8 : 0;
    ctx.shadowColor = t.def.color;
    ctx.stroke();

    if (t.manualCooldown > 0) {
      const manualProgress = Math.max(0, Math.min(1, 1 - t.manualCooldown / t.manualCooldownMax));
      ctx.beginPath();
      ctx.arc(0, 0, 18, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * manualProgress, false);
      ctx.strokeStyle = "rgba(255, 235, 59, 0.55)";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.stroke();
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.game.enemies.list) this.drawEnemy(ctx, e);
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);

    // Boss entrance: contracting portal ring (drawn before boss body scale).
    if (e.isBoss && e.bossEntranceTimer > 0) {
      const prog = 1 - e.bossEntranceTimer / e.bossEntranceMax;
      const ringRad = Math.max(2, (1 - prog) * 100);
      const ringAlpha = (1 - prog) * 0.85;
      ctx.save();
      ctx.globalAlpha = ringAlpha;
      ctx.strokeStyle = "#ff2200";
      ctx.lineWidth = 5 - prog * 3;
      ctx.shadowBlur = 40;
      ctx.shadowColor = "#ff2200";
      ctx.beginPath();
      ctx.arc(0, 0, ringRad, 0, Math.PI * 2);
      ctx.stroke();
      // Inner dashed ring rotating inward.
      ctx.globalAlpha = ringAlpha * 0.55;
      ctx.setLineDash([5, 9]);
      ctx.lineDashOffset = e.timer * -60;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, ringRad * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    const elapsed = this.game.time.elapsed;
    let enemyAlpha = 1;
    if (e.isPhased) enemyAlpha = 0.25 + Math.sin(e.timer * 12) * 0.1;
    if (e.spawnFxTimer > 0) {
      const spawnProgress = 1 - e.spawnFxTimer / e.spawnFxMax;
      const scale = 0.25 + spawnProgress * 0.75;
      enemyAlpha *= 0.35 + spawnProgress * 0.65;
      ctx.scale(scale, scale);
    } else if (e.isBoss && e.bossEntranceTimer > 0) {
      // Boss body scales from 0 to 1 over entrance duration.
      const prog = 1 - e.bossEntranceTimer / e.bossEntranceMax;
      const easedScale = prog * prog; // ease-in so it pops at the end
      ctx.scale(easedScale, easedScale);
      enemyAlpha *= easedScale;
    }
    // Tunneler underground: fade body and show dirt ripple.
    if (e.type === "tunneler" && e.tunnelTransitionProg > 0) {
      enemyAlpha *= 1 - e.tunnelTransitionProg;
      if (e.isTunneling) {
        ctx.save();
        ctx.globalAlpha = 0.25 * e.tunnelTransitionProg;
        ctx.strokeStyle = "#8d6e63";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = e.timer * -22;
        ctx.beginPath();
        ctx.arc(0, 0, e.size + 4 + Math.sin(e.timer * 8) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
    ctx.globalAlpha = enemyAlpha;

    const frozen = e.freezeFxTimer > 0;
    const outlineColor = paletteColor(e.type, e.color);
    const bodyColor = frozen ? "#d8fbff" : e.color;
    ctx.shadowBlur = e.isBoss ? 18 : 8;
    ctx.shadowColor = frozen ? "#80d8ff" : outlineColor;
    ctx.fillStyle = bodyColor;

    const lodSimple =
      this.game.core.settings.graphicsQuality === "low" ||
      (!e.isBoss && Math.hypot(e.pos.x - this.vw / 2, e.pos.y - this.vh / 2) > 360);
    if (lodSimple) {
      ctx.beginPath();
      ctx.arc(0, 0, e.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Shape by type.
    switch (e.type) {
      case "scout": {
        // Velocity tail before the body.
        const velLen = Math.hypot(e.vel.x, e.vel.y);
        if (velLen > 0.5) {
          const tailAngle = Math.atan2(-e.vel.y, -e.vel.x);
          const tailLen = e.size * 2.8;
          const tx = Math.cos(tailAngle) * tailLen;
          const ty = Math.sin(tailAngle) * tailLen;
          const grad = ctx.createLinearGradient(0, 0, tx, ty);
          grad.addColorStop(0, outlineColor);
          grad.addColorStop(1, "transparent");
          ctx.save();
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = grad;
          ctx.lineWidth = e.size * 0.9;
          ctx.lineCap = "round";
          ctx.shadowBlur = 6;
          ctx.shadowColor = outlineColor;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.moveTo(e.size, 0);
        ctx.lineTo(-e.size, -e.size * 0.6);
        ctx.lineTo(-e.size, e.size * 0.6);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "grunt":
        ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
        break;
      case "brute": {
        ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(-e.size + 2, -e.size + 2, e.size * 2 - 4, e.size * 2 - 4);
        // Damage cracks appear below 66% HP.
        const hpFrac = e.hp / e.maxHp;
        if (hpFrac < 0.66) {
          const crackAlpha = (0.66 - hpFrac) / 0.66;
          ctx.save();
          ctx.globalAlpha = crackAlpha * 0.8;
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1;
          // Seed crack positions deterministically from maxHp so they don't jump.
          const seed = e.maxHp;
          for (let ci = 0; ci < 4; ci++) {
            const ca = ((seed * (ci + 1) * 137) % 628) / 100;
            const cl = e.size * (0.5 + (ci % 2) * 0.4);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ca) * cl, Math.sin(ca) * cl);
            ctx.stroke();
          }
          ctx.restore();
        }
        break;
      }
      case "weaver": {
        // Pulsing body.
        const weavePulse = 0.85 + Math.sin(e.timer * 3.5) * 0.15;
        ctx.beginPath();
        ctx.arc(0, 0, e.size * weavePulse, 0, Math.PI * 2);
        ctx.fill();
        // Outer glow ring.
        ctx.globalAlpha = 0.3 + Math.sin(e.timer * 2.8) * 0.1;
        ctx.strokeStyle = "#ff80ab";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.size * 1.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // 3 orbiting heal orbs.
        const healPhase = 1 - Math.max(0, e.healCooldown) / 1.35;
        const orbitR = e.size + 7;
        for (let hi = 0; hi < 3; hi++) {
          const baseAng = e.timer * 1.8 + hi * (Math.PI * 2 / 3);
          const orbX = Math.cos(baseAng) * orbitR;
          const orbY = Math.sin(baseAng) * orbitR;
          // Orbs fly outward briefly during heal.
          const flyDist = healPhase > 0.8 ? (healPhase - 0.8) / 0.2 * 30 : 0;
          const flyX = orbX + Math.cos(baseAng) * flyDist;
          const flyY = orbY + Math.sin(baseAng) * flyDist;
          ctx.fillStyle = "#ff80ab";
          ctx.globalAlpha = 0.7 + Math.sin(e.timer * 4 + hi) * 0.15;
          ctx.shadowBlur = 6;
          ctx.shadowColor = "#ff80ab";
          ctx.beginPath();
          ctx.arc(flyX, flyY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        // Heal range indicator (dimmed dashed ring).
        ctx.strokeStyle = "rgba(255,128,171,0.2)";
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "phantom": {
        ctx.beginPath();
        ctx.arc(0, 0, e.size, 0, Math.PI * 2);
        ctx.fill();
        // Phase shimmer: 3 concentric rings rotating at different rates.
        for (let ri = 0; ri < 3; ri++) {
          const rOff = ri * 3;
          const speed = 1.8 + ri * 0.9;
          const phase = e.timer * speed + ri * (Math.PI * 2 / 3);
          const shimR = e.size + 3 + rOff;
          ctx.save();
          ctx.globalAlpha = (e.isPhased ? 0.9 : 0.45) - ri * 0.12;
          ctx.strokeStyle = ri === 0 ? "#ffffff" : ri === 1 ? outlineColor : "#b39ddb";
          ctx.lineWidth = 1.5 - ri * 0.3;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = phase * 8;
          ctx.shadowBlur = ri === 0 ? 8 : 0;
          ctx.shadowColor = "#fff";
          ctx.beginPath();
          ctx.arc(0, 0, shimR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        break;
      }
      case "carrier": {
        // Main body — wide rectangular hull.
        ctx.fillRect(-e.size, -e.size * 0.7, e.size * 2, e.size * 1.4);
        // Hatch: opens as HP drops (wider gap at lower HP).
        const hatchPct = 1 - Math.max(0, e.hp / e.maxHp);
        const hatchOpen = hatchPct * e.size * 0.8;
        ctx.fillStyle = "#ff8a65";
        // Top hatch panel.
        ctx.fillRect(-5, -e.size * 0.7 + 1, 10, e.size * 0.4 - hatchOpen);
        // Bottom hatch panel.
        ctx.fillRect(-5, hatchOpen * 0.5, 10, e.size * 0.4 - hatchOpen * 0.5);
        // Scout dots inside the hatch bay.
        const scoutCount = Math.max(0, Math.round(3 * (1 - hatchPct)));
        for (let si = 0; si < scoutCount; si++) {
          const sy = -e.size * 0.2 + si * 5;
          ctx.fillStyle = "#ff5252";
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(0, sy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "leviathan": {
        for (let si = 0; si < e.leviathanSegments.length; si++) {
          const seg = e.leviathanSegments[si]!;
          if (!seg.active) continue;
          const a = seg.angle + Math.sin(e.timer * 1.4 + si) * 0.35;
          const dist = e.size * (1.25 + si * 0.18);
          const hpA = Math.max(0.25, seg.hp / seg.maxHp);
          ctx.save();
          ctx.globalAlpha = 0.35 + hpA * 0.45;
          ctx.fillStyle = si % 2 === 0 ? outlineColor : "#ff8a80";
          ctx.shadowBlur = 10;
          ctx.shadowColor = ctx.fillStyle as string;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * dist, Math.sin(a) * dist, e.size * 0.42, e.size * 0.24, a, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Multi-segment rotating rings.
        const ringData = [
          { r: e.size * 1.85, speed: 0.7, segs: 6, gap: 0.22, color: outlineColor },
          { r: e.size * 2.4, speed: -0.45, segs: 4, gap: 0.35, color: "#ffffff" },
          { r: e.size * 3.0, speed: 0.3, segs: 8, gap: 0.18, color: outlineColor },
        ];
        for (const ring of ringData) {
          ctx.save();
          ctx.strokeStyle = ring.color;
          ctx.lineWidth = ring.r > e.size * 2.5 ? 1 : 2;
          ctx.shadowBlur = 8;
          ctx.shadowColor = ring.color;
          ctx.globalAlpha = 0.65;
          const segAngle = (Math.PI * 2) / ring.segs;
          for (let si = 0; si < ring.segs; si++) {
            const startA = e.timer * ring.speed + si * segAngle;
            const endA = startA + segAngle * (1 - ring.gap);
            ctx.beginPath();
            ctx.arc(0, 0, ring.r, startA, endA);
            ctx.stroke();
          }
          ctx.restore();
        }
        // Core body.
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r = e.size * (1 + Math.sin(e.timer * 2 + i) * 0.15);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case "harbinger": {
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + Math.sin(e.timer * 1.2) * 0.08;
          const r = e.size * (i % 2 === 0 ? 1.15 : 0.72);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.rotate(e.timer * 0.8);
        ctx.strokeStyle = "#ff8a80";
        ctx.globalAlpha = 0.65;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(e.size * 1.8, 0);
          ctx.stroke();
          ctx.rotate((Math.PI * 2) / 3);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "sprinter":
        // Forward-swept triangle with speed tail.
        ctx.beginPath();
        ctx.moveTo(e.size + 2, 0);
        ctx.lineTo(-e.size, -e.size * 0.45);
        ctx.lineTo(-e.size, e.size * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.fillRect(-e.size - 6, -1, 6, 2);
        ctx.globalAlpha = 1;
        break;
      case "juggernaut":
        ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(-e.size + 3, -e.size + 3, e.size * 2 - 6, e.size * 2 - 6);
        ctx.fillStyle = "#fff";
        ctx.fillRect(-3, -3, 6, 6);
        break;
      case "shielder":
        ctx.beginPath();
        ctx.arc(0, 0, e.size, 0, Math.PI * 2);
        ctx.fill();
        // Surrounding bubble.
        ctx.strokeStyle = "rgba(100, 255, 218, 0.65)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.size + 5 + Math.sin(e.timer * 4) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "splitter":
        ctx.fillRect(-e.size, -e.size * 0.8, e.size * 2, e.size * 1.6);
        ctx.fillStyle = "#fff";
        ctx.fillRect(-2, -e.size * 0.8, 4, e.size * 1.6);
        break;
      case "jammer":
        // Diamond with pulsing halo.
        ctx.beginPath();
        ctx.moveTo(0, -e.size);
        ctx.lineTo(e.size, 0);
        ctx.lineTo(0, e.size);
        ctx.lineTo(-e.size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 235, 59, 0.55)";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, 42 + Math.sin(e.timer * 4) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      case "swarm":
        // Tiny triangle cluster.
        ctx.beginPath();
        ctx.moveTo(e.size, 0);
        ctx.lineTo(-e.size, -e.size);
        ctx.lineTo(-e.size, e.size);
        ctx.closePath();
        ctx.fill();
        break;
      case "overlord":
        // Spiky irregular polygon.
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const r = e.size * (i % 2 === 0 ? 1.1 : 0.75);
          const x = Math.cos(a + e.timer * 0.5) * r;
          const y = Math.sin(a + e.timer * 0.5) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      case "tunneler": {
        // Oval body with burrowing claw marks.
        ctx.save();
        ctx.scale(0.7, 1);
        ctx.beginPath();
        ctx.arc(0, 0, e.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "#a1887f";
        ctx.lineWidth = 1;
        ctx.globalAlpha *= 0.7;
        for (let i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.moveTo(i * 3, -e.size * 0.5);
          ctx.lineTo(i * 3, e.size * 0.5);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case "saboteur": {
        // Jagged asymmetric shape.
        ctx.beginPath();
        ctx.moveTo(e.size, 0);
        ctx.lineTo(e.size * 0.3, -e.size);
        ctx.lineTo(-e.size, -e.size * 0.5);
        ctx.lineTo(-e.size * 0.5, e.size * 0.5);
        ctx.lineTo(e.size * 0.2, e.size);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "cache": {
        // Rotating golden diamond.
        ctx.save();
        ctx.rotate(e.timer * 2.4);
        ctx.beginPath();
        ctx.moveTo(0, -e.size * 1.4);
        ctx.lineTo(e.size * 0.85, 0);
        ctx.lineTo(0, e.size * 1.4);
        ctx.lineTo(-e.size * 0.85, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // Outer sparkle ring.
        const sparkAlpha = 0.4 + Math.sin(e.timer * 7) * 0.2;
        ctx.save();
        ctx.globalAlpha = sparkAlpha;
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 1;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#ffd700";
        ctx.beginPath();
        ctx.arc(0, 0, e.size + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        break;
      }
    }

    ctx.save();
    ctx.globalAlpha = e.isBoss ? 0.92 : 0.72;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = e.isBoss ? 2.6 : 1.4;
    ctx.shadowBlur = 8;
    ctx.shadowColor = outlineColor;
    ctx.beginPath();
    ctx.arc(0, 0, e.size + 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Battle damage marks — persistent visual scars from specific damage types.
    if (e.burnMark) {
      ctx.save();
      const seed = e.maxHp;
      ctx.globalAlpha = 0.55;
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#ff6d00";
      for (let i = 0; i < 5; i++) {
        const a = ((seed * (i + 3) * 53) % 628) / 100;
        const r1 = e.size * 0.2;
        const r2 = e.size * (0.5 + ((seed * (i + 7) * 31) % 100) / 200);
        ctx.strokeStyle = i % 2 === 0 ? "#bf360c" : "#e64a19";
        ctx.lineWidth = 1 + (i % 2);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        ctx.stroke();
      }
      // Char smudge at center.
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#212121";
      ctx.beginPath();
      ctx.arc(0, 0, e.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (e.electricMark) {
      ctx.save();
      const seed = e.maxHp + 1;
      ctx.globalAlpha = 0.5;
      ctx.shadowBlur = 5;
      ctx.shadowColor = "#ffe082";
      ctx.strokeStyle = "#ffe57f";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const startA = ((seed * (i + 2) * 71) % 628) / 100;
        const x0 = Math.cos(startA) * e.size * 0.3;
        const y0 = Math.sin(startA) * e.size * 0.3;
        const endA = startA + 1.3;
        const x3 = Math.cos(endA) * e.size * 0.85;
        const y3 = Math.sin(endA) * e.size * 0.85;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo((x0 + x3) / 2 + ((seed * i * 17) % 10) - 5, (y0 + y3) / 2 + ((seed * i * 23) % 8) - 4);
        ctx.lineTo(x3, y3);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (e.iceMark && !e.freezeFxTimer) {
      ctx.save();
      const seed = e.maxHp + 2;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = "#b3e5fc";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 3;
      ctx.shadowColor = "#81d4fa";
      for (let i = 0; i < 4; i++) {
        const a = ((seed * (i + 5) * 61) % 628) / 100;
        const arm = e.size * 0.65;
        const mx = Math.cos(a) * arm;
        const my = Math.sin(a) * arm;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(mx, my);
        // Two small cross-bars along each arm.
        for (let b = 0; b < 2; b++) {
          const t2 = 0.35 + b * 0.4;
          const bx = mx * t2;
          const by = my * t2;
          const cx2 = Math.cos(a + Math.PI / 2) * arm * 0.22;
          const cy2 = Math.sin(a + Math.PI / 2) * arm * 0.22;
          ctx.moveTo(bx - cx2, by - cy2);
          ctx.lineTo(bx + cx2, by + cy2);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Elite: pulsing golden border.
    if (e.isElite) {
      ctx.save();
      ctx.globalAlpha = 0.7 + Math.sin(e.timer * 3) * 0.2;
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#ffd700";
      ctx.beginPath();
      ctx.arc(0, 0, e.size + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Shield drones: orbiting cyan spheres, one per active drone.
    if (e.shieldDroneCount > 0) {
      const orbitR = e.size + 9;
      const spin = elapsed * 2.2;
      for (let d = 0; d < e.shieldDroneCount; d++) {
        const angle = e.shieldDroneAngles[d]! + spin;
        const dx = Math.cos(angle) * orbitR;
        const dy = Math.sin(angle) * orbitR;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#80d8ff";
        ctx.fillStyle = "#80d8ff";
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      // Thin orbit ring.
      ctx.strokeStyle = "rgba(128, 216, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, orbitR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Mark indicator (signal marker).
    if (e.signalMarked) {
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.size + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Slow halo.
    if (e.slowTimer > 0) {
      ctx.strokeStyle = frozen ? "#b3f5ff" : paletteColor("stasis", "#9c27b0");
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, e.size + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (frozen) {
      const frost = Math.max(0.25, e.freezeFxTimer / e.freezeFxMax);
      ctx.save();
      ctx.globalAlpha = Math.min(0.9, frost);
      ctx.strokeStyle = "#dffcff";
      ctx.fillStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#80d8ff";
      for (let i = 0; i < 7; i++) {
        const a = e.timer * 0.25 + (i / 7) * Math.PI * 2;
        const inner = e.size * 0.58;
        const outer = e.size + 5 + (i % 2) * 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(Math.cos(a) * outer, Math.sin(a) * outer, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.22 * frost;
      ctx.fillStyle = "#d8fbff";
      ctx.beginPath();
      ctx.arc(0, 0, e.size + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // HP bar.
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    const w = e.isBoss ? 56 : 24;
    const h = e.isBoss ? 6 : 3;
    const hpPct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(-w / 2, -e.size - 10, w, h);
    ctx.fillStyle = hpPct < 0.33 ? "#f44336" : hpPct < 0.66 ? "#ffb300" : "#4caf50";
    ctx.fillRect(-w / 2, -e.size - 10, w * hpPct, h);
    if (e.damageTakenThisWave > 0) {
      const dmgPct = Math.max(0, Math.min(1, e.damageTakenThisWave / e.maxHp));
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(-w / 2, -e.size - 15, w, 2);
      ctx.fillStyle = "#ffeb3b";
      ctx.fillRect(-w / 2, -e.size - 15, w * dmgPct, 2);
    }

    if (e.isBoss) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(`PHASE ${Math.max(1, e.bossPhase)}`, 0, -e.size - 14);
    }

    // Colorblind helper: letter marker.
    if (this.game.core.settings.colorblind) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(e.type.charAt(0).toUpperCase(), 0, 3);
    }

    ctx.restore();
  }

  private drawDrones(ctx: CanvasRenderingContext2D): void {
    for (const d of this.game.drones.list) this.drawDrone(ctx, d);
  }

  /** Mobile squad render: center beacon + cosmetic sub-drone formation. */
  private drawSquads(ctx: CanvasRenderingContext2D): void {
    if (!this.game.squads) return;
    for (const s of this.game.squads.list) {
      if (!s.active) continue;
      this.drawSquad(ctx, s);
    }
  }

  private drawSquad(ctx: CanvasRenderingContext2D, s: Squad): void {
    const t = this.game.time.elapsed;
    const spawnPct = 1 - s.spawnTimer / 0.4;
    const alpha = spawnPct < 1 ? Math.max(0.2, spawnPct) : 1;
    const isSelected = this.game.squads?.selected === s;
    const recentlyHit = t - s.lastHitTime < 0.4;

    // Selection ring — thick pulsing ring under the squad center.
    if (isSelected) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(t * 5) * 0.25;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = s.def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Optional path/destination marker for moving squads, selected squads,
    // and acknowledged retasks. Selected squads always show the path so the
    // player can read what they ordered.
    const showPath =
      s.state === "moving" ||
      s.state === "spawning" ||
      s.state === "evacuating" ||
      isSelected ||
      s.ackTimer > 0;
    if (showPath) {
      ctx.save();
      ctx.globalAlpha = (isSelected ? 0.65 : 0.35) + Math.sin(t * 5) * 0.1;
      ctx.strokeStyle = s.evacuating ? "#ffd180" : s.def.color;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.setLineDash(s.evacuating ? [3, 6] : [4, 4]);
      ctx.lineDashOffset = -((t * 24) % 12);
      ctx.beginPath();
      ctx.moveTo(s.pos.x, s.pos.y);
      ctx.lineTo(s.target.x, s.target.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(s.target.x, s.target.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      // X marker for evac destination, target reticle for normal.
      if (s.evacuating) {
        ctx.beginPath();
        ctx.moveTo(s.target.x - 4, s.target.y - 4);
        ctx.lineTo(s.target.x + 4, s.target.y + 4);
        ctx.moveTo(s.target.x - 4, s.target.y + 4);
        ctx.lineTo(s.target.x + 4, s.target.y - 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Behavior-specific field rings.
    ctx.save();
    ctx.globalAlpha = alpha;
    if (s.type === "shield" && s.state === "shielding") {
      const radius = s.def.interactionRadius;
      const grad = ctx.createRadialGradient(s.pos.x, s.pos.y, radius * 0.55, s.pos.x, s.pos.y, radius);
      grad.addColorStop(0, "rgba(128, 222, 234, 0.0)");
      grad.addColorStop(0.7, "rgba(128, 222, 234, 0.10)");
      grad.addColorStop(1, "rgba(128, 222, 234, 0.0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(128, 222, 234, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.type === "recon") {
      // Soft scan halo so darkness sectors visually attribute reveal to recon.
      ctx.strokeStyle = "rgba(128, 216, 255, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, s.def.revealRadius * (0.6 + 0.4 * Math.sin(t * 2)), 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.type === "strike" && s.state === "attacking") {
      ctx.strokeStyle = "rgba(255, 138, 101, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, s.def.interactionRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Center beacon — diamond + glow tinted by squad color.
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(s.pos.x, s.pos.y);
    ctx.shadowBlur = 12;
    ctx.shadowColor = s.def.color;
    ctx.fillStyle = s.def.color;
    const size = 6;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cosmetic sub-drones orbiting around the center.
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < s.satellites.length; i++) {
      const sat = s.satellites[i]!;
      const ang = sat.angle + t * 1.6 + (i / s.satellites.length) * Math.PI * 2;
      const ox = s.pos.x + Math.cos(ang) * sat.orbit;
      const oy = s.pos.y + Math.sin(ang) * sat.orbit;
      ctx.fillStyle = s.def.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = s.def.color;
      ctx.beginPath();
      ctx.arc(ox, oy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Health + duration ring — small arc above the squad center.
    const hpPct = Math.max(0, s.health / s.maxHealth);
    const durPct = Math.max(0, s.duration / s.maxDuration);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    // Background arc
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.arc(s.pos.x, s.pos.y - 14, 10, Math.PI, 2 * Math.PI);
    ctx.stroke();
    // HP arc
    ctx.strokeStyle = hpPct > 0.5 ? "#9be7a7" : hpPct > 0.25 ? "#ffd180" : "#ff5252";
    ctx.beginPath();
    ctx.arc(s.pos.x, s.pos.y - 14, 10, Math.PI, Math.PI + Math.PI * hpPct);
    ctx.stroke();
    // Duration arc (slimmer, below)
    ctx.strokeStyle = "rgba(102, 252, 241, 0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(s.pos.x, s.pos.y + 13, 8, Math.PI, Math.PI + Math.PI * durPct);
    ctx.stroke();
    ctx.restore();

    // State badge above the HP ring — JAMMED / EVAC / DAMAGED. We show the
    // most relevant single label so it's never noisy.
    let badge: { label: string; color: string } | null = null;
    if (s.evacuating) badge = { label: "EVAC", color: "#ffd180" };
    else if (s.jammed) badge = { label: "JAMMED", color: "#ef6c00" };
    else if (recentlyHit && hpPct < 0.6) badge = { label: "DAMAGED", color: "#ff5252" };
    else if (s.inRiftAura) badge = { label: "RIFT", color: "#ff5252" };
    if (badge) {
      ctx.save();
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      const w = ctx.measureText(badge.label).width + 8;
      ctx.fillStyle = "rgba(8, 12, 18, 0.9)";
      ctx.fillRect(s.pos.x - w / 2, s.pos.y - 30, w, 10);
      ctx.strokeStyle = badge.color;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(s.pos.x - w / 2, s.pos.y - 30, w, 10);
      ctx.fillStyle = badge.color;
      ctx.fillText(badge.label, s.pos.x, s.pos.y - 22);
      ctx.restore();
    }

    // Hit flash — a quick bright ring when the squad takes damage.
    if (recentlyHit) {
      const flashAlpha = Math.max(0, 1 - (t - s.lastHitTime) / 0.4);
      ctx.save();
      ctx.globalAlpha = flashAlpha * 0.55;
      ctx.strokeStyle = "#ff5252";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, 14 + (1 - flashAlpha) * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Targeting preview when a squad command is armed (or a retask is staged). */
  private drawSquadDeployPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.game.squads) return;
    const cursor = this.game.input.hoverWorld;
    if (!cursor) return;
    const t = this.game.time.elapsed;

    // Retask mode — draw a "RETASK SELECTED → HERE" preview from the squad
    // to the cursor with the squad's interaction radius hint.
    if (this.game.squads.retaskMode && this.game.squads.selected) {
      const sq = this.game.squads.selected;
      const def = sq.def;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -((t * 28) % 9);
      ctx.beginPath();
      ctx.moveTo(sq.pos.x, sq.pos.y);
      ctx.lineTo(cursor.x, cursor.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const radius = sq.type === "recon" ? def.revealRadius * 0.7 : def.interactionRadius;
      ctx.globalAlpha = 0.4 + Math.sin(t * 5) * 0.1;
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      // Crosshair
      ctx.beginPath();
      ctx.moveTo(cursor.x - 12, cursor.y);
      ctx.lineTo(cursor.x + 12, cursor.y);
      ctx.moveTo(cursor.x, cursor.y - 12);
      ctx.lineTo(cursor.x, cursor.y + 12);
      ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#000000";
      ctx.font = "bold 11px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(`${def.name.toUpperCase()} → RETASK`, cursor.x, cursor.y - radius - 14);
      ctx.restore();
      return;
    }

    const pending = this.game.squads.pendingCommand;
    if (!pending) return;
    const def = this.game.squads.statuses().find((s) => s.type === pending)?.def;
    if (!def) return;

    ctx.save();
    // Origin → cursor line from the nearest core/relay so the player sees the
    // deployment route. Origin is the same the system uses on actual deploy.
    const origin = this.game.grid.getNearestCoreCenter(cursor.x, cursor.y);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -((t * 24) % 12);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(cursor.x, cursor.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Target ring with squad-specific radius hint (interaction radius for
    // capture/strike/shield, reveal radius for recon).
    const radius = pending === "recon" ? def.revealRadius * 0.85 : def.interactionRadius;
    ctx.globalAlpha = 0.45 + Math.sin(t * 5) * 0.1;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    // Crosshair
    ctx.beginPath();
    ctx.moveTo(cursor.x - 12, cursor.y);
    ctx.lineTo(cursor.x + 12, cursor.y);
    ctx.moveTo(cursor.x, cursor.y - 12);
    ctx.lineTo(cursor.x, cursor.y + 12);
    ctx.stroke();
    // Squad name above the cursor.
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = def.color;
    ctx.shadowBlur = 4;
    ctx.shadowColor = "#000000";
    ctx.font = "bold 11px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(`${def.name.toUpperCase()} → CLICK TO DEPLOY`, cursor.x, cursor.y - radius - 14);
    ctx.restore();
  }

  private drawDrone(ctx: CanvasRenderingContext2D, d: Drone): void {
    ctx.save();
    const bob = Math.sin(this.game.time.elapsed * 4.2 + d.bobPhase) * 3;
    ctx.translate(d.pos.x, d.pos.y + bob);
    ctx.rotate(d.angle);
    ctx.shadowBlur = 10;
    ctx.shadowColor = d.color;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, 7);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, -7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.game.projectiles.list) this.drawProjectile(ctx, p);
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
    ctx.save();
    const color = paletteColor(p.ownerType, p.color);

    if (p.kind === "mortar") {
      // Parabolic arc: progress 0→1 over the shell's lifetime.
      const progress = p.maxLife > 0 ? Math.max(0, 1 - p.life / p.maxLife) : 0;
      const arcOffsetY = -Math.sin(progress * Math.PI) * 34;
      const rx = p.pos.x;
      const ry = p.pos.y;
      const ax = rx;
      const ay = ry + arcOffsetY;

      // Ground shadow: grows/shrinks inversely with altitude.
      const shadowScale = 1 - Math.abs(arcOffsetY) / 34;
      const shadowAlpha = 0.25 * shadowScale;
      if (shadowAlpha > 0.02) {
        ctx.globalAlpha = shadowAlpha;
        ctx.fillStyle = "#000000";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(rx, ry + 3, 6 * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Arc-elevated shell with glow.
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 14;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ax, ay, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(ax, ay, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    // Tracer trail: fading line segments from oldest to newest trail point.
    if (p.trail.length > 1) {
      for (let i = 1; i < p.trail.length; i++) {
        const a = (i / p.trail.length) * 0.55;
        ctx.globalAlpha = a;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 4;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(p.trail[i - 1]!.x, p.trail[i - 1]!.y);
        ctx.lineTo(p.trail[i]!.x, p.trail[i]!.y);
        ctx.stroke();
      }
    }

    // Head. Bullet classes get distinct silhouettes for quick readability.
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;

    if (p.ownerType === "blaster") {
      const ang = Math.atan2(p.lastDir.y, p.lastDir.x);
      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate(ang);
      ctx.fillStyle = color;
      ctx.fillRect(-5, -1.6, 10, 3.2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(2, -0.8, 4, 1.6);
      ctx.restore();
    } else if (p.ownerType === "pulse") {
      const progress = p.maxLife > 0 ? 1 - p.life / p.maxLife : 0;
      const ringRadius = 3 + (progress % 0.28) * 18;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (p.kind === "bullet") {
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawBeams(ctx: CanvasRenderingContext2D): void {
    for (const b of this.game.particles.beams) {
      ctx.save();
      const a = b.life / b.maxLife;
      const color = paletteColor(b.paletteId, b.color);
      if (b.kind === "railgun") {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = b.width * 1.9;
        ctx.shadowBlur = 26;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(b.fromX, b.fromY);
        ctx.lineTo(b.toX, b.toY);
        ctx.stroke();

        ctx.globalAlpha = a;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(2, b.width * 0.45);
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(b.fromX, b.fromY);
        ctx.lineTo(b.toX, b.toY);
        ctx.stroke();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 + a * 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(b.fromX, b.fromY);
        ctx.lineTo(b.toX, b.toY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawLightning(ctx: CanvasRenderingContext2D): void {
    for (const l of this.game.particles.lightning) {
      // Flicker: skip ~20% of frames for electric stutter.
      if (Math.random() < 0.2) continue;
      const progress = l.life / l.maxLife;
      const flicker = 0.7 + Math.random() * 0.3;
      const color = paletteColor(undefined, l.color);
      ctx.save();
      ctx.globalAlpha = progress * flicker;

      // Outer glow pass.
      ctx.strokeStyle = color;
      ctx.lineWidth = progress * 6;
      ctx.shadowBlur = 18;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(l.points[0]!.x, l.points[0]!.y);
      for (let i = 1; i < l.points.length; i++) ctx.lineTo(l.points[i]!.x, l.points[i]!.y);
      ctx.stroke();

      // Bright white core pass.
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = progress * 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(l.points[0]!.x, l.points[0]!.y);
      for (let i = 1; i < l.points.length; i++) ctx.lineTo(l.points[i]!.x, l.points[i]!.y);
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawRings(ctx: CanvasRenderingContext2D): void {
    for (const r of this.game.particles.rings) {
      const color = paletteColor(undefined, r.color);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = (r.life / r.maxLife) * 6;
      ctx.globalAlpha = r.life / r.maxLife;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawDamageZones(ctx: CanvasRenderingContext2D): void {
    for (const z of this.game.particles.zones) {
      ctx.save();
      const a = z.life / z.maxLife;
      ctx.fillStyle = z.color;
      ctx.globalAlpha = 0.1 + 0.15 * a;
      ctx.beginPath();
      ctx.arc(z.pos.x, z.pos.y, z.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawScorchDecals(ctx: CanvasRenderingContext2D): void {
    for (const s of this.game.particles.scorchDecals) {
      const a = Math.max(0, s.life / s.maxLife);
      ctx.save();
      ctx.globalAlpha = 0.38 * a;
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
      grad.addColorStop(0, s.color);
      grad.addColorStop(0.55, "rgba(24, 16, 12, 0.7)");
      grad.addColorStop(1, "rgba(24, 16, 12, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.radius * 1.15, s.radius * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    const groups = new Map<string, { x: number; y: number; size: number; alpha: number }[]>();
    for (const p of this.game.particles.particles) {
      const key = p.color;
      const bucket = groups.get(key);
      const item = {
        x: p.pos.x - p.size / 2,
        y: p.pos.y - p.size / 2,
        size: p.size,
        alpha: Math.max(0, p.life / p.maxLife),
      };
      if (bucket) bucket.push(item);
      else groups.set(key, [item]);
    }

    for (const [color, particles] of groups) {
      ctx.save();
      ctx.fillStyle = color;
      const opaque = particles.filter((p) => p.alpha > 0.85);
      if (opaque.length > 0) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        for (const p of opaque) ctx.rect(p.x, p.y, p.size, p.size);
        ctx.fill();
      }
      for (const p of particles) {
        if (p.alpha > 0.85) continue;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.restore();
    }
  }

  private drawFloatingText(ctx: CanvasRenderingContext2D): void {
    for (const f of this.game.particles.floatingText) {
      ctx.save();
      ctx.globalAlpha = f.life / f.maxLife;
      ctx.fillStyle = f.color;
      ctx.font = `bold ${f.size}px Courier New`;
      ctx.textAlign = "center";
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#000";
      ctx.fillText(f.text, f.pos.x, f.pos.y);
      ctx.restore();
    }
  }

  private drawCreditOrbs(ctx: CanvasRenderingContext2D): void {
    for (const o of this.game.particles.creditOrbs) {
      const t = o.life / o.maxLife;
      ctx.save();
      ctx.globalAlpha = t * 0.85;
      ctx.translate(o.x, o.y);
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#00e676";
      ctx.fillStyle = "#00e676";
      ctx.beginPath();
      ctx.moveTo(0, -4 * t);
      ctx.lineTo(3 * t, 0);
      ctx.lineTo(0, 4 * t);
      ctx.lineTo(-3 * t, 0);
      ctx.closePath();
      ctx.fill();
      // Bright center.
      ctx.globalAlpha = t * 0.5;
      ctx.fillStyle = "#b9f6ca";
      ctx.beginPath();
      ctx.arc(0, 0, 1.5 * t, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawScreenFlashes(ctx: CanvasRenderingContext2D): void {
    for (const f of this.game.particles.screenFlashes) {
      const a = (f.life / f.maxLife) * f.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.restore();
    }
  }

  private drawPlanningTimerArc(ctx: CanvasRenderingContext2D): void {
    if (this.game.state !== "PLANNING") return;
    const w = this.game.waves;
    if (w.planningCountdown <= 0 || !w.hasMoreWaves) return;

    const pct = Math.max(0, Math.min(1, w.planningCountdown / w.planningDuration));
    const secs = Math.ceil(w.planningCountdown);
    const cx = this.vw / 2;
    const cy = 28;
    const R = 20;
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * pct;
    const color = pct < 0.25 ? "#f44336" : pct < 0.5 ? "#ffb300" : "#66fcf1";

    ctx.save();

    // Track ring (dimmed).
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Filled arc.
    ctx.beginPath();
    ctx.arc(cx, cy, R, start, end);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.stroke();

    // Center number.
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${secs}`, cx, cy);

    // Label above arc.
    ctx.fillStyle = "rgba(200,230,255,0.55)";
    ctx.font = "8px 'Courier New', monospace";
    ctx.textBaseline = "bottom";
    ctx.fillText("AUTO-START", cx, cy - R - 4);

    ctx.restore();
  }

  private drawBuildSynergyHighlights(ctx: CanvasRenderingContext2D): void {
    const type = this.game.input.selectedTowerType;
    if (!type) return;

    const hover = this.game.input.hoverCell;
    const elapsed = this.game.time.elapsed;
    for (const tower of this.game.towers.list) {
      const maxCells = this.buildSynergyDistance(type, tower);
      if (maxCells <= 0) continue;

      let near = false;
      if (hover) {
        const dc = Math.abs(hover.c - tower.c);
        const dr = Math.abs(hover.r - tower.r);
        near = Math.max(dc, dr) <= maxCells;
      }

      const pulse = 0.55 + Math.sin(elapsed * 7) * 0.18;
      ctx.save();
      ctx.globalAlpha = near ? 0.9 : 0.38;
      ctx.strokeStyle = near ? "#00e676" : "#66fcf1";
      ctx.lineWidth = near ? 2 : 1;
      ctx.shadowBlur = near ? 16 : 8;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -elapsed * 20;
      ctx.beginPath();
      ctx.arc(tower.pos.x, tower.pos.y, 22 + pulse * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (near && hover) {
        const hx = hover.c * TILE_SIZE + TILE_SIZE / 2;
        const hy = hover.r * TILE_SIZE + TILE_SIZE / 2;
        ctx.globalAlpha = 0.32;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tower.pos.x, tower.pos.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private buildSynergyDistance(type: TowerType, tower: Tower): number {
    if ((type === "stasis" && tower.type === "tesla") || (type === "tesla" && tower.type === "stasis")) return 1;
    if ((type === "barrier" && tower.type === "harvester") || (type === "harvester" && tower.type === "barrier")) return 1;
    if (type !== "harvester" && tower.type === "harvester" && tower.flags.relayNode) return 3;
    if (type === "harvester" && !tower.isEco) return 3;
    // Amplifier boosts adjacent towers.
    if (type === "amplifier" && tower.type !== "amplifier" && tower.type !== "harvester") return 1;
    if (tower.type === "amplifier" && type !== "amplifier" && type !== "harvester") return 1;
    return 0;
  }

  /**
   * Subtle blue tint over every cell that's inside the active signal network.
   * During PLANNING / WAVE_COMPLETE the overlay is more opaque to help with
   * build decisions. A very subtle version persists during WAVE_ACTIVE so the
   * player always knows what territory they own at a glance.
   */
  private drawSignalCoverage(ctx: CanvasRenderingContext2D): void {
    const grid = this.game.grid;
    if (grid.coreClusters.length === 0) return;
    const state = this.game.state;
    const isBuilding = Boolean(this.game.input?.placementTowerType) || this.game.core.coreDeployMode;
    const showAlways = state === "PLANNING" || state === "WAVE_COMPLETE";
    const showSubtle = state === "WAVE_ACTIVE";
    if (!showAlways && !isBuilding && !showSubtle) return;

    const elapsed = this.game.time.elapsed;
    const baseAlpha = isBuilding ? 0.16 : showAlways ? 0.07 : 0.025;
    const pulse = baseAlpha + Math.sin(elapsed * 1.6) * (isBuilding ? 0.04 : showAlways ? 0.015 : 0.005);
    ctx.save();
    ctx.fillStyle = `rgba(102, 252, 241, ${pulse.toFixed(3)})`;
    for (const cluster of grid.coreClusters) {
      if (cluster.destroyed) continue;
      const cx = cluster.center.x;
      const cy = cluster.center.y;
      const radius = cluster.signalRadiusCells * TILE_SIZE;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Soft outer rim for each cluster.
    const strokeAlpha = isBuilding ? 0.5 : showAlways ? 0.26 : 0.10;
    ctx.strokeStyle = `rgba(102, 252, 241, ${strokeAlpha.toFixed(2)})`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -elapsed * 12;
    for (const cluster of grid.coreClusters) {
      if (cluster.destroyed) continue;
      ctx.beginPath();
      ctx.arc(cluster.center.x, cluster.center.y, cluster.signalRadiusCells * TILE_SIZE, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // While in relay deploy mode, also render the deploy reach ring so the
    // player understands where they may leapfrog from.
    if (this.game.core.coreDeployMode) {
      ctx.strokeStyle = "rgba(176, 232, 255, 0.45)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      for (const cluster of grid.coreClusters) {
        if (cluster.destroyed) continue;
        ctx.beginPath();
        ctx.arc(cluster.center.x, cluster.center.y, grid.relayDeployRadiusCells * TILE_SIZE, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /**
   * Background-layer rendering for strategic-point influence radii: jammer
   * fields, rift-anchor auras, and hint glows for points the player has
   * discovered but not yet captured. Drawn underneath towers so they read as
   * world geometry rather than UI.
   */
  private drawStrategicPointFields(ctx: CanvasRenderingContext2D): void {
    const sps = this.game.strategicPoints;
    if (!sps || sps.list.length === 0) return;
    const elapsed = this.game.time.elapsed;
    const hovered = this.game.input?.hoverWorld ?? null;
    const hoverPoint = hovered ? sps.pointNearWorld(hovered.x, hovered.y, TILE_SIZE) : null;
    ctx.save();
    for (const p of sps.list) {
      if (p.state === "destroyed" || p.state === "depleted") continue;
      // Active hostile influence: jammer field + rift anchor aura.
      if (p.state === "enemy") {
        const isHovered = p === hoverPoint;
        if (p.type === "jammer") {
          const radiusPx = p.radiusCells * TILE_SIZE;
          const baseFill = 0.10 + Math.sin(elapsed * 2.4) * 0.04;
          const fill = isHovered ? Math.min(0.22, baseFill + 0.1) : baseFill;
          ctx.fillStyle = `rgba(239, 108, 0, ${fill.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, radiusPx, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isHovered ? "rgba(239, 108, 0, 0.85)" : "rgba(239, 108, 0, 0.55)";
          ctx.lineWidth = isHovered ? 1.6 : 1;
          ctx.setLineDash([5, 6]);
          ctx.lineDashOffset = -elapsed * 14;
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, radiusPx, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (p.type === "rift_anchor") {
          const radiusPx = 200; // Mirrors RIFT_ANCHOR_AURA_RADIUS.
          const baseFill = 0.07 + Math.sin(elapsed * 1.8) * 0.03;
          // Intensify the aura tint in the last 2 seconds before a pulse so
          // the field itself reads as a warning, not just the icon overlay.
          const close = p.pulseInterval > 0 && p.effectTimer > 0 && p.effectTimer <= 2
            ? (2 - p.effectTimer) / 2
            : 0;
          const fill = baseFill + close * 0.12 + (isHovered ? 0.05 : 0);
          ctx.fillStyle = `rgba(244, 67, 54, ${fill.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, radiusPx, 0, Math.PI * 2);
          ctx.fill();
          if (close > 0) {
            ctx.strokeStyle = `rgba(255, 82, 82, ${(0.4 + close * 0.5).toFixed(3)})`;
            ctx.lineWidth = 1.4;
            ctx.setLineDash([4, 6]);
            ctx.lineDashOffset = -elapsed * 24;
            ctx.beginPath();
            ctx.arc(p.pos.x, p.pos.y, radiusPx, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
      // Friendly captured signal node: render its added coverage so the player
      // can see the new build territory. When contested by enemies the fill
      // flickers orange to warn the player the node might be lost.
      if (p.state === "captured" && p.type === "signal_node") {
        const radiusPx = p.radiusCells * TILE_SIZE;
        const isContested = p.contested;
        // Contested: flicker between teal and orange to signal danger.
        const flickerPhase = isContested && (elapsed * 4) % 1 < 0.5;
        const fillRgb = (isContested && !flickerPhase) ? "255, 152, 0" : "102, 252, 241";
        const strokeRgba = (isContested && !flickerPhase) ? "rgba(255, 152, 0, 0.65)" : "rgba(102, 252, 241, 0.45)";
        const pulse = isContested
          ? 0.10 + Math.sin(elapsed * 8) * 0.04
          : 0.08 + Math.sin(elapsed * 1.6) * 0.025;
        ctx.fillStyle = `rgba(${fillRgb}, ${pulse.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, radiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = strokeRgba;
        ctx.lineWidth = isContested ? 1.4 : 1;
        ctx.setLineDash([4, 5]);
        ctx.lineDashOffset = -elapsed * (isContested ? 22 : 12);
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, radiusPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (isContested) {
          // Small "CONTESTED" label above the node.
          ctx.shadowBlur = 6;
          ctx.shadowColor = "#ff9800";
          ctx.fillStyle = "#ff9800";
          ctx.font = "9px monospace";
          ctx.textAlign = "center";
          ctx.fillText("CONTESTED", p.pos.x, p.pos.y - radiusPx - 6);
          ctx.shadowBlur = 0;
        }
      }
    }
    ctx.restore();
  }

  /**
   * Foreground rendering for strategic points themselves — icons, capture
   * progress arcs, and structure health bars. Each type has its own glyph so
   * the map reads at a glance.
   */
  private drawStrategicPoints(ctx: CanvasRenderingContext2D): void {
    const sps = this.game.strategicPoints;
    if (!sps || sps.list.length === 0) return;
    const elapsed = this.game.time.elapsed;
    const hovered = this.game.input?.hoverWorld ?? null;
    const hoverPoint = hovered ? sps.pointNearWorld(hovered.x, hovered.y, TILE_SIZE) : null;

    ctx.save();
    for (const p of sps.list) {
      if (p.state === "destroyed") continue;
      const x = p.pos.x;
      const y = p.pos.y;
      const isHostile = p.state === "enemy";
      const isCaptured = p.state === "captured";
      const isDepleted = p.state === "depleted";
      const baseColor = strategicTint(p.type, p.state);
      const flash = p.flashTimer > 0 ? p.flashTimer / 0.6 : 0;

      // Captured abandoned-turret range ring on hover or when it's selected.
      if (isCaptured && p.type === "abandoned_turret" && p === hoverPoint) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 235, 59, 0.55)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -elapsed * 16;
        ctx.beginPath();
        ctx.arc(x, y, ABANDONED_TURRET_RANGE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Drop a base disc so the icon sits on a readable platform.
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowBlur = isCaptured ? 14 : isHostile ? 10 : 6;
      ctx.shadowColor = baseColor;
      ctx.fillStyle = "rgba(8, 12, 18, 0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();

      drawStrategicGlyph(ctx, p.type, p.state, baseColor, elapsed);

      // Capture progress arc — color-shifts based on coverage / contest state
      // so the player can read at a glance why progress is or isn't moving.
      if (p.state === "neutral" && p.captureProgress > 0) {
        let arcColor = "#66fcf1";
        if (!p.inCoverage) arcColor = "rgba(255, 179, 0, 0.85)";
        else if (p.jammed) arcColor = "#ef6c00";
        else if (p.contested) arcColor = "#ff5252";
        ctx.strokeStyle = arcColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.captureProgress);
        ctx.stroke();
      }
      ctx.restore();

      // Health bar above hostile structures (and damaged friendly turrets).
      if (isHostile && p.maxHealth > 0) {
        drawHealthBar(ctx, x, y - 22, p.health / p.maxHealth, p.health <= p.maxHealth * 0.35);
      }

      // Hostile structure pulse-countdown ring + label. Drawn beneath the
      // health bar so the warning is visually grouped with the threat.
      if (isHostile && p.pulseInterval > 0 && p.discovered) {
        drawPulseWarning(ctx, p, elapsed);
      }

      // Neutral capture status badge: a one-word strip under the health bar
      // line so the player can read the blocking condition without hovering.
      if (p.state === "neutral" && p.discovered) {
        let label: string | null = null;
        let labelColor = "#66fcf1";
        if (!p.inCoverage) {
          label = "OUT OF SIGNAL";
          labelColor = "#ffb300";
        } else if (p.jammed) {
          label = "JAMMED";
          labelColor = "#ef6c00";
        } else if (p.contested) {
          label = "CONTESTED";
          labelColor = "#ff5252";
        }
        if (label && (p === hoverPoint || p.captureProgress > 0)) {
          drawTinyBadge(ctx, x, y - 32, label, labelColor);
        }
      }

      // Capture flash ring.
      if (flash > 0) {
        ctx.beginPath();
        ctx.strokeStyle = baseColor;
        ctx.globalAlpha = flash;
        ctx.lineWidth = 3;
        ctx.arc(x, y, 18 + (1 - flash) * 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Faint depleted/destroyed indicator (only depleted survives this point).
      if (isDepleted) {
        ctx.strokeStyle = "rgba(160, 160, 160, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 9, y - 9);
        ctx.lineTo(x + 9, y + 9);
        ctx.moveTo(x + 9, y - 9);
        ctx.lineTo(x - 9, y + 9);
        ctx.stroke();
      }

      // Hover tooltip.
      if (p === hoverPoint) {
        const squadStatus = this.squadStatusForPoint(p);
        drawStrategicTooltip(ctx, p, baseColor, squadStatus);
      }
    }
    ctx.restore();
  }

  /**
   * Inspect active squads and return a short tooltip line describing whether
   * any are currently engaging this point. Returns null if nothing relevant.
   */
  private squadStatusForPoint(p: StrategicPoint): { text: string; color: string } | null {
    if (!this.game.squads) return null;
    for (const s of this.game.squads.list) {
      if (!s.active) continue;
      if (s.type === "engineer" && s.targetPoint === p && s.state === "capturing") {
        return { text: "Engineer boosting capture", color: "#9be7a7" };
      }
      if (s.type === "engineer" && s.targetPoint === p && s.state === "moving") {
        return { text: "Engineer en route", color: "#9be7a7" };
      }
      if (s.type === "strike" && p.state === "enemy") {
        const dx = s.pos.x - p.pos.x;
        const dy = s.pos.y - p.pos.y;
        if (dx * dx + dy * dy <= s.def.interactionRadius * s.def.interactionRadius) {
          return { text: "Under strike squad fire", color: "#ff8a65" };
        }
      }
    }
    return null;
  }

  /**
   * Visual feedback while placing a relay core: a 2x2 footprint preview that
   * turns red on invalid placement and shows the projected signal radius.
   * Hardened relays use an orange tint and show the smaller coverage radius.
   */
  private drawRelayPlacementPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.game.core.coreDeployMode) return;
    const cell = this.game.input.hoverCell;
    if (!cell) return;
    const grid = this.game.grid;
    const variant = this.game.core.relayDeployVariant;
    const isHardened = variant === "hardened";

    const c = cell.c;
    const r = cell.r;
    const placement = this.game.canPlaceRelayAt(c, r);
    const elapsed = this.game.time.elapsed;
    const pulse = 0.65 + Math.sin(elapsed * 4) * 0.2;
    const accentOk = isHardened ? "#ff9800" : "#66fcf1";
    const color = placement.ok ? accentOk : "#ff5252";
    const fillColor = placement.ok
      ? isHardened
        ? `rgba(255, 152, 0, ${(0.18 * pulse).toFixed(2)})`
        : `rgba(102, 252, 241, ${(0.18 * pulse).toFixed(2)})`
      : `rgba(255, 82, 82, ${(0.22 * pulse).toFixed(2)})`;

    ctx.save();
    // Draw 2x2 footprint.
    const x = c * TILE_SIZE;
    const y = r * TILE_SIZE;
    ctx.fillStyle = fillColor;
    ctx.fillRect(x + 2, y + 2, TILE_SIZE * 2 - 4, TILE_SIZE * 2 - 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.strokeRect(x + 2, y + 2, TILE_SIZE * 2 - 4, TILE_SIZE * 2 - 4);
    ctx.shadowBlur = 0;
    // Cross hatching for invalid placement to read at a glance.
    if (!placement.ok) {
      ctx.strokeStyle = "rgba(255, 82, 82, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + TILE_SIZE * 2 - 4, y + TILE_SIZE * 2 - 4);
      ctx.moveTo(x + TILE_SIZE * 2 - 4, y + 4);
      ctx.lineTo(x + 4, y + TILE_SIZE * 2 - 4);
      ctx.stroke();
    }

    // Projected signal/build radius — uses HARDENED_RELAY_SIGNAL_RADIUS_CELLS for hardened variant.
    const px = (c + 1) * TILE_SIZE;
    const py = (r + 1) * TILE_SIZE;
    const radius = isHardened
      ? HARDENED_RELAY_SIGNAL_RADIUS_CELLS * TILE_SIZE
      : grid.relaySignalRadiusCells * TILE_SIZE;
    ctx.strokeStyle = placement.ok
      ? isHardened ? "rgba(255, 152, 0, 0.65)" : "rgba(102, 252, 241, 0.55)"
      : "rgba(255, 82, 82, 0.45)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -elapsed * 14;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (placement.ok) {
      // Semi-transparent fill of projected coverage so additive territory reads.
      const fillAlpha = (0.05 + Math.sin(elapsed * 2) * 0.02).toFixed(3);
      ctx.fillStyle = isHardened
        ? `rgba(255, 152, 0, ${fillAlpha})`
        : `rgba(102, 252, 241, ${fillAlpha})`;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (placement.reason) {
      // Floating reason text above the cursor.
      ctx.fillStyle = "#ff8a80";
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#000000";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(placement.reason.toUpperCase(), px, y - 6);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  private drawPlacementPreview(ctx: CanvasRenderingContext2D): void {
    const input = this.game.input;
    const t = input.placementTowerType;
    if (!input.showPlacementPreview || !t || !input.hoverCell) return;
    const { c, r } = input.hoverCell;
    const check = this.game.towers.canPlace(t, c, r);
    const ok = check.ok;
    if (!ok && check.reason) {
      ctx.save();
      ctx.fillStyle = "#ff8a80";
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#000";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(check.reason.toUpperCase(), c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE - 4);
      ctx.restore();
    }

    const def = towerDefinitions[t];
    const cx = c * TILE_SIZE + TILE_SIZE / 2;
    const cy = r * TILE_SIZE + TILE_SIZE / 2;
    const snap = input.placementSnapTimer > 0 ? input.placementSnapTimer / 0.18 : 0;
    const invalid = input.placementInvalidTimer > 0 ? input.placementInvalidTimer / 0.22 : 0;
    const bounce = ok ? 1 + Math.sin((1 - snap) * Math.PI) * 0.14 : 1;
    const shake = ok ? 0 : Math.sin(invalid * Math.PI * 10) * 3 * invalid;
    const color = ok ? def.color : "#ff5252";

    ctx.save();
    ctx.translate(cx + shake, cy);
    ctx.scale(bounce, bounce);

    ctx.strokeStyle = color;
    ctx.fillStyle = ok ? "rgba(102, 252, 241, 0.12)" : "rgba(255, 82, 82, 0.18)";
    ctx.lineWidth = ok ? 1 : 2;
    ctx.fillRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.strokeRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    ctx.globalAlpha = ok ? 0.52 : 0.42;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = ok ? 0.38 : 0.5;
    if (t === "mortar" || t === "barrier" || t === "amplifier") {
      ctx.strokeRect(-9, -9, 18, 18);
    } else if (t === "tesla" || t === "stasis") {
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(11, 8);
      ctx.lineTo(-11, 8);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-8, 8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, -8);
      ctx.closePath();
      ctx.stroke();
    }

    // Range ring.
    if (ok) {
      const range = this.previewRange(t);
      ctx.scale(1 / bounce, 1 / bounce);
      ctx.strokeStyle = "rgba(102, 252, 241, 0.5)";
      ctx.beginPath();
      ctx.arc(0, 0, range, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private previewRange(type: string): number {
    const def = towerDefinitions[type as TowerType];
    return def?.range ?? 0;
  }

  private drawSelectionHighlights(ctx: CanvasRenderingContext2D): void {
    const sel = this.game.towers.selected;
    if (!sel) return;
    ctx.save();
    ctx.strokeStyle = "#ffeb3b";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(sel.c * TILE_SIZE + 1, sel.r * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    ctx.setLineDash([]);
    // Range.
    const stats = sel.statBlock();
    ctx.strokeStyle = "rgba(255, 235, 59, 0.5)";
    ctx.beginPath();
    ctx.arc(sel.pos.x, sel.pos.y, stats.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawPathPreview(ctx: CanvasRenderingContext2D): void {
    if (this.game.state !== "PLANNING" && !this.game.core.debug.showPaths) return;
    const grid = this.game.grid;
    // Active spawners for the next wave (draw subtle paths).
    const wave = this.game.waves.nextWaveDef;
    if (!wave) return;
    const activeSpawners = new Set(wave.lanes.map((l) => l.spawnerId));
    ctx.save();
    for (const s of grid.spawners) {
      if (!activeSpawners.has(s.id)) continue;
      const alpha = 0.3 + Math.sin(this.game.time.elapsed * 3) * 0.15;
      ctx.strokeStyle = `rgba(102, 252, 241, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      let cur = grid.idx(s.c, s.r);
      let sx = s.c * TILE_SIZE + TILE_SIZE / 2;
      let sy = s.r * TILE_SIZE + TILE_SIZE / 2;
      ctx.moveTo(sx, sy);
      let safety = 0;
      while (safety++ < 500) {
        const nxt = grid.flow[cur];
        if (nxt == null || nxt < 0) break;
        const { c, r } = grid.coords(nxt);
        sx = c * TILE_SIZE + TILE_SIZE / 2;
        sy = r * TILE_SIZE + TILE_SIZE / 2;
        ctx.lineTo(sx, sy);
        cur = nxt;
        if (grid.cells[cur] === CellKind.Core) break;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawGravityAnomaly(ctx: CanvasRenderingContext2D): void {
    const g = this.game.core.gravityAnomaly;
    if (!g) return;
    const t = this.game.time.elapsed;
    const fade = Math.min(1, g.timer / 1.5) * Math.min(1, (g.maxTimer - g.timer + 0.01) / 1.5);
    ctx.save();
    ctx.globalAlpha = fade;

    // Translucent radial fill.
    const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius);
    grad.addColorStop(0, "rgba(179, 157, 219, 0.25)");
    grad.addColorStop(0.6, "rgba(103, 58, 183, 0.12)");
    grad.addColorStop(1, "rgba(103, 58, 183, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
    ctx.fill();

    // Rotating dashed ring.
    const pulse = 0.55 + 0.35 * Math.sin(t * 3);
    ctx.strokeStyle = `rgba(179, 157, 219, ${0.7 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -(t * 30) % 10;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner spiral arms (3 lines rotating outward).
    for (let arm = 0; arm < 3; arm++) {
      const angle = t * 1.6 + (arm * Math.PI * 2) / 3;
      const x2 = g.x + Math.cos(angle) * g.radius * 0.65;
      const y2 = g.y + Math.sin(angle) * g.radius * 0.65;
      ctx.strokeStyle = `rgba(179, 157, 219, ${0.4 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawMeteorWarnings(ctx: CanvasRenderingContext2D): void {
    const strikes = this.game.core.meteorStrikes;
    if (strikes.length === 0) return;
    const t = this.game.time.elapsed;
    ctx.save();
    for (const m of strikes) {
      if (m.timer <= 0) continue;
      const prog = 1 - m.timer / m.maxTimer; // 0 = just appeared, 1 = about to hit
      const px = m.c * TILE_SIZE + TILE_SIZE / 2;
      const py = m.r * TILE_SIZE + TILE_SIZE / 2;
      const pulse = 0.5 + 0.45 * Math.sin(t * (6 + prog * 10));

      // Growing danger fill.
      ctx.fillStyle = `rgba(255, 112, 67, ${0.06 + prog * 0.12})`;
      ctx.beginPath();
      ctx.arc(px, py, TILE_SIZE * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing warning ring — shrinks as strike approaches.
      const ringR = TILE_SIZE * (0.55 + (1 - prog) * 0.55);
      ctx.strokeStyle = `rgba(255, 112, 67, ${0.5 + pulse * 0.45})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // Inner crosshair.
      const cr = TILE_SIZE * 0.3 * (1 - prog * 0.6);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + pulse * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - cr, py); ctx.lineTo(px + cr, py);
      ctx.moveTo(px, py - cr); ctx.lineTo(px, py + cr);
      ctx.stroke();

      // Countdown text (only when > 1s remaining).
      if (m.timer > 0.8) {
        ctx.fillStyle = `rgba(255, 160, 100, ${0.7 + pulse * 0.3})`;
        ctx.font = "bold 9px Courier New";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(m.timer.toFixed(1) + "s", px, py - TILE_SIZE * 0.55);
        ctx.textBaseline = "alphabetic";
      }
    }
    ctx.restore();
  }

  private drawSilenceOverlay(ctx: CanvasRenderingContext2D): void {
    const sTimer = this.game.waves.silenceTimer;
    if (sTimer <= 0) return;
    const t = this.game.time.elapsed;
    const fade = Math.min(1, sTimer / 0.5); // fade-out in last 0.5s
    ctx.save();

    // Dark semi-transparent overlay across the tower zone.
    for (const tower of this.game.towers.list) {
      const px = tower.pos.x;
      const py = tower.pos.y;
      const pulse = 0.55 + 0.35 * Math.sin(t * 5 + px * 0.02);

      // Purple suppression veil per tower.
      ctx.fillStyle = `rgba(60, 20, 90, ${0.45 * fade * pulse})`;
      ctx.beginPath();
      ctx.arc(px, py, TILE_SIZE * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Dashed suppression ring.
      ctx.strokeStyle = `rgba(124, 77, 255, ${0.7 * fade * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = (t * 20) % 6;
      ctx.beginPath();
      ctx.arc(px, py, TILE_SIZE * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Big centered countdown text.
    const cx = this.vw / 2;
    const cy = this.vh / 2 - 30;
    ctx.globalAlpha = 0.88 * fade;
    ctx.fillStyle = "#7c4dff";
    ctx.font = `bold ${14}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#7c4dff";
    ctx.shadowBlur = 18;
    ctx.fillText(`SILENCE: ${sTimer.toFixed(1)}s`, cx, cy);
    ctx.shadowBlur = 0;
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawKillZone(ctx: CanvasRenderingContext2D): void {
    const kz = this.game.core.killZone;
    const kzMode = this.game.core.killZoneMode;
    const t = this.game.time.elapsed;

    if (kzMode) {
      // Show hover cell indicator when in kill zone designation mode.
      const over = this.game.input.overCell;
      if (over) {
        const x = over.c * TILE_SIZE, y = over.r * TILE_SIZE;
        ctx.save();
        const pulse = 0.55 + 0.35 * Math.sin(t * 8);
        ctx.strokeStyle = `rgba(255, 152, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(255, 152, 0, ${pulse * 0.18})`;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "9px Courier New";
        ctx.textAlign = "center";
        ctx.fillText("KILL ZONE [K]", this.vw / 2, this.vh - 8);
        ctx.restore();
      }
      return;
    }

    if (!kz) return;

    const x = kz.c * TILE_SIZE, y = kz.r * TILE_SIZE;
    const pulse = 0.5 + 0.35 * Math.sin(t * 4);
    ctx.save();

    // Fill.
    ctx.fillStyle = `rgba(255, 152, 0, ${0.12 + pulse * 0.08})`;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Animated border.
    ctx.strokeStyle = `rgba(255, 152, 0, ${0.6 + pulse * 0.35})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    // Corner brackets.
    const s = 5;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffb300";
    [[x, y], [x + TILE_SIZE, y], [x, y + TILE_SIZE], [x + TILE_SIZE, y + TILE_SIZE]].forEach(([cx, cy], idx) => {
      const dx = idx % 2 === 0 ? 1 : -1;
      const dy = idx < 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(cx! + dx * s, cy!);
      ctx.lineTo(cx!, cy!);
      ctx.lineTo(cx!, cy! + dy * s);
      ctx.stroke();
    });

    // "+20%" label in center of tile.
    ctx.fillStyle = `rgba(255, 179, 0, ${0.7 + pulse * 0.25})`;
    ctx.font = "bold 9px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+20%", x + TILE_SIZE / 2, y + TILE_SIZE / 2);
    ctx.textBaseline = "alphabetic";

    ctx.restore();
  }

  private drawMainMenuAmbience(ctx: CanvasRenderingContext2D): void {
    const GHOST_COLORS = ["#66fcf1", "#ff5252", "#ffeb3b", "#b39ddb", "#80cbc4"];
    // Lazily populate ghost list.
    if (this.menuGhosts.length === 0) {
      for (let i = 0; i < 7; i++) {
        const angle = Math.PI + (Math.random() - 0.5) * 0.8; // mostly left
        const speed = 18 + Math.random() * 24;
        this.menuGhosts.push({
          x: this.vw + Math.random() * 200,
          y: 60 + Math.random() * (this.vh - 120),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 4 + Math.random() * 6,
          color: GHOST_COLORS[i % GHOST_COLORS.length]!,
          trail: [],
        });
      }
    }

    const dt = this.game.time.dt;
    ctx.save();

    for (const g of this.menuGhosts) {
      // Advance position.
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      // Record trail point (cap at 14 points).
      g.trail.push({ x: g.x, y: g.y });
      if (g.trail.length > 14) g.trail.shift();

      // Wrap around when off-screen.
      if (g.x < -60 || g.y < -60 || g.y > this.vh + 60) {
        g.x = this.vw + 40 + Math.random() * 80;
        g.y = 60 + Math.random() * (this.vh - 120);
        g.trail = [];
      }

      // Draw trail.
      if (g.trail.length > 1) {
        for (let i = 1; i < g.trail.length; i++) {
          const alpha = (i / g.trail.length) * 0.25;
          ctx.strokeStyle = g.color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = g.r * 0.35 * (i / g.trail.length);
          ctx.beginPath();
          ctx.moveTo(g.trail[i - 1]!.x, g.trail[i - 1]!.y);
          ctx.lineTo(g.trail[i]!.x, g.trail[i]!.y);
          ctx.stroke();
        }
      }

      // Draw ghost body.
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = g.color;
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Drift data streams: faint diagonal lines moving from bottom-right to top-left.
    const t = this.game.time.elapsed;
    for (let i = 0; i < 4; i++) {
      const phase = (t * 22 + i * 55) % (this.vw + this.vh);
      const x1 = this.vw - phase;
      const y1 = this.vh;
      const x2 = x1 + this.vh * 0.6;
      const y2 = 0;
      ctx.globalAlpha = 0.06 + 0.04 * Math.sin(t * 2 + i);
      ctx.strokeStyle = "#66fcf1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private applyBarrelDistortion(ctx: CanvasRenderingContext2D): void {
    // Approximate CRT barrel distortion: blit the current canvas to a temp buffer,
    // then redraw it via stepped horizontal strips with per-strip x-offset = barrel curve.
    this.distortionCtx.clearRect(0, 0, this.vw, this.vh);
    this.distortionCtx.drawImage(ctx.canvas, 0, 0, this.vw, this.vh);
    ctx.clearRect(0, 0, this.vw, this.vh);

    const stripH = 4; // pixels per strip — tradeoff between quality and performance
    const strength = 1.8; // max horizontal pixel shift at screen edges
    for (let y = 0; y < this.vh; y += stripH) {
      // Normalized vertical position: -1 at top, +1 at bottom.
      const ny = (y / this.vh) * 2 - 1;
      // Horizontal barrel curve: offset is proportional to ny^2 (parabolic).
      // At center ny=0, no shift; at edges ny=±1, max shift inward.
      const xShift = strength * ny * ny; // always inward (positive = nudge inward from edges)
      const drawWidth = this.vw - xShift * 2;
      ctx.drawImage(
        this.distortionCanvas,
        0, y, this.vw, Math.min(stripH, this.vh - y),
        xShift, y, drawWidth, Math.min(stripH, this.vh - y)
      );
    }
  }

  private drawSignalInterference(ctx: CanvasRenderingContext2D): void {
    const si = this.game.core.signalInterference;
    if (!si) return;
    const t = this.game.time.elapsed;
    const fade = Math.min(1, si.totalTimer / 1.5) * Math.min(1, (si.maxTotalTimer - si.totalTimer + 0.01) / 1.5);
    ctx.save();
    ctx.globalAlpha = fade;

    // Translucent amber radial fill.
    const grad = ctx.createRadialGradient(si.x, si.y, 0, si.x, si.y, si.radius);
    grad.addColorStop(0, "rgba(239, 108, 0, 0.18)");
    grad.addColorStop(0.6, "rgba(255, 152, 0, 0.08)");
    grad.addColorStop(1, "rgba(255, 152, 0, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(si.x, si.y, si.radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer interference ring (dashed, counter-rotating).
    const pulse = 0.5 + 0.45 * Math.sin(t * 4.5);
    ctx.strokeStyle = `rgba(239, 108, 0, ${0.65 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = (t * 35) % 9;
    ctx.beginPath();
    ctx.arc(si.x, si.y, si.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Static interference lines (6 jagged radial scratches).
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + t * 0.8;
      const jitter = (Math.sin(t * 17 + i * 3.1) * 0.3 + 0.7);
      const x2 = si.x + Math.cos(angle) * si.radius * jitter;
      const y2 = si.y + Math.sin(angle) * si.radius * jitter;
      ctx.strokeStyle = `rgba(255, 152, 0, ${0.22 * pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(si.x, si.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Center label.
    ctx.globalAlpha = 0.7 * fade;
    ctx.fillStyle = "#ef6c00";
    ctx.font = "bold 9px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SIGNAL INTERFERENCE", si.x, si.y + si.radius + 10);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawSalvagePickups(ctx: CanvasRenderingContext2D): void {
    const pickups = this.game.core.salvagePickups;
    if (pickups.length === 0) return;
    const t = this.game.time.elapsed;
    ctx.save();
    for (const s of pickups) {
      const fade = Math.min(1, s.timer / 1.5); // fade out in last 1.5s
      const spin = t * 3.2;
      const pulse = 0.7 + 0.25 * Math.sin(t * 5 + s.x * 0.05);
      ctx.globalAlpha = fade;

      // Glow halo.
      const grd = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 14);
      grd.addColorStop(0, "rgba(255, 213, 79, 0.55)");
      grd.addColorStop(1, "rgba(255, 213, 79, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
      ctx.fill();

      // Spinning diamond shape.
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(spin);
      const sz = 6 * pulse;
      ctx.fillStyle = "#ffd54f";
      ctx.shadowColor = "#ffb300";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.lineTo(sz * 0.65, 0);
      ctx.lineTo(0, sz);
      ctx.lineTo(-sz * 0.65, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner bright core.
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Value label.
      ctx.fillStyle = `rgba(255, 213, 79, ${0.85 * fade})`;
      ctx.font = "bold 8px Courier New";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`+${s.value}`, s.x, s.y - 10);
      ctx.textBaseline = "alphabetic";
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawHeatmap(ctx: CanvasRenderingContext2D): void {
    const grid = this.game.grid;
    const cols = grid.cols, rows = grid.rows;
    // Accumulate enemy presence into a per-tile heat map.
    const heat = new Float32Array(cols * rows);
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      const c = Math.floor(e.pos.x / TILE_SIZE);
      const r = Math.floor(e.pos.y / TILE_SIZE);
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      heat[r * cols + c] += 1;
      // Spread to neighbors for a softer look.
      const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dc, dr] of neighbors) {
        const nc = c + dc!, nr = r + dr!;
        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) heat[nr * cols + nc] += 0.4;
      }
    }
    // Also add flow-field convergence weight: tiles many paths pass through get a base tint.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = grid.idx(c, r);
        const dist = grid.flow[i];
        if (dist != null && dist >= 0) {
          // Closer to core = higher base heat (paths converge).
          const d = this.game.grid.getDistAtWorld(c * TILE_SIZE + 16, r * TILE_SIZE + 16);
          heat[r * cols + c] += Math.max(0, (40 - d) / 40) * 0.6;
        }
      }
    }
    // Find max for normalisation.
    let maxH = 0;
    for (let i = 0; i < heat.length; i++) if (heat[i]! > maxH) maxH = heat[i]!;
    if (maxH < 0.1) maxH = 1;

    ctx.save();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const h = (heat[r * cols + c]! / maxH);
        if (h < 0.05) continue;
        const x = c * TILE_SIZE, y = r * TILE_SIZE;
        // Low = blue, mid = yellow, high = red.
        let color: string;
        if (h < 0.33)      color = `rgba(33, 150, 243, ${(h / 0.33 * 0.35).toFixed(2)})`;
        else if (h < 0.66) color = `rgba(255, 193, 7, ${((h - 0.33) / 0.33 * 0.4 + 0.15).toFixed(2)})`;
        else               color = `rgba(244, 67, 54, ${((h - 0.66) / 0.34 * 0.5 + 0.25).toFixed(2)})`;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
    // Label.
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px Courier New";
    ctx.textAlign = "left";
    ctx.fillText("THREAT MAP [H]", 8, this.vh - 8);
    ctx.restore();
  }

  private drawFlowDebug(ctx: CanvasRenderingContext2D): void {
    const grid = this.game.grid;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 235, 59, 0.4)";
    ctx.fillStyle = "rgba(255, 235, 59, 0.4)";
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const i = grid.idx(c, r);
        const next = grid.flow[i];
        if (next == null || next < 0) continue;
        const { c: nc, r: nr } = grid.coords(next);
        const x = c * TILE_SIZE + TILE_SIZE / 2;
        const y = r * TILE_SIZE + TILE_SIZE / 2;
        const nx = nc * TILE_SIZE + TILE_SIZE / 2;
        const ny = nr * TILE_SIZE + TILE_SIZE / 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawDebugOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(4, 4, 230, 110);
    ctx.fillStyle = "#ffeb3b";
    ctx.font = "12px Courier New";
    const g = this.game;
    const lines = [
      `FPS:          ${g.time.fps.toFixed(0)}`,
      `State:        ${g.state}`,
      `Wave:         ${g.core.waveIndex + 1}/${g.waves.totalWaves}`,
      `Enemies:      ${g.enemies.list.length}`,
      `Projectiles:  ${g.projectiles.list.length}`,
      `Particles:    ${g.particles.particles.length}`,
      `Selected:     ${g.towers.selected?.type ?? "-"}`,
      `Cell:         ${g.input.hoverCell ? g.input.hoverCell.c + "," + g.input.hoverCell.r : "-"}`,
    ];
    lines.forEach((l, i) => ctx.fillText(l, 12, 22 + i * 12));
    ctx.restore();
  }

  /** Draw a compact minimap in the bottom-right corner of the screen. */
  private drawMinimap(ctx: CanvasRenderingContext2D): void {
    const grid = this.game.grid;
    const cam = this.game.camera;
    const COLS = grid.cols;
    const ROWS = grid.rows;
    const mapW = 180;
    const mapH = Math.round(mapW * (ROWS / COLS));
    const mx = this.vw - mapW - 8;
    const my = this.vh - mapH - 8;
    const tileW = mapW / COLS;
    const tileH = mapH / ROWS;

    ctx.save();
    // Background.
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "rgba(8, 12, 18, 0.85)";
    ctx.fillRect(mx - 2, my - 2, mapW + 4, mapH + 4);
    ctx.strokeStyle = "rgba(102, 252, 241, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 2, my - 2, mapW + 4, mapH + 4);
    ctx.globalAlpha = 1;

    // Terrain tiles. NB: the case constants here use the runtime CellKind
    // enum so this stays accurate if CellKind values ever change. Previously
    // these were hard-coded to mismatched numeric values.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const kind = grid.cells[grid.idx(c, r)];
        if (kind === CellKind.Empty) continue;
        const tx = mx + c * tileW;
        const ty = my + r * tileH;
        switch (kind) {
          case CellKind.Rock:      ctx.fillStyle = "#232a33"; break;
          case CellKind.Crystal:   ctx.fillStyle = "#00e676"; break;
          case CellKind.Core:      ctx.fillStyle = "#66fcf1"; break;
          case CellKind.Tower:     ctx.fillStyle = "#4caf50"; break;
          case CellKind.Harvester: ctx.fillStyle = "#00e676"; break;
          default: ctx.fillStyle = "#333"; break;
        }
        ctx.fillRect(tx, ty, Math.ceil(tileW), Math.ceil(tileH));
      }
    }

    // Spawners — red dots.
    ctx.fillStyle = "#f44336";
    for (const s of grid.spawners) {
      ctx.beginPath();
      ctx.arc(mx + (s.c + 0.5) * tileW, my + (s.r + 0.5) * tileH, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tower positions — colored dots. Disabled towers get a flashing red ring
    // overlay so the player can locate damaged infrastructure at a glance.
    const blink = Math.sin(this.game.time.elapsed * 8) > 0;
    for (const t of this.game.towers.list) {
      ctx.fillStyle = t.def.color;
      const tc = Math.floor(t.pos.x / TILE_SIZE);
      const tr = Math.floor(t.pos.y / TILE_SIZE);
      const tx = mx + tc * tileW;
      const ty = my + tr * tileH;
      ctx.fillRect(tx, ty, Math.ceil(tileW), Math.ceil(tileH));
      if (t.disabled && blink) {
        ctx.save();
        ctx.strokeStyle = "#ff5252";
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#ff5252";
        ctx.beginPath();
        ctx.arc(tx + tileW / 2, ty + tileH / 2, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (t.hpPct < 0.3 && !t.disabled && blink) {
        // Critical-state ping (subtler than full disabled).
        ctx.save();
        ctx.strokeStyle = "#ff8a65";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(tx + tileW / 2, ty + tileH / 2, 2.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Enemy positions — red dots.
    ctx.fillStyle = "rgba(244, 67, 54, 0.85)";
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      const ex = mx + (e.pos.x / TILE_SIZE) * tileW;
      const ey = my + (e.pos.y / TILE_SIZE) * tileH;
      ctx.fillRect(ex - 0.5, ey - 0.5, 1.5, 1.5);
    }

    // Strategic point markers — distinct shapes per type so the player can
    // read what's important at a glance. Hostile structures pulse so they
    // stay attention-grabbing.
    const sps = this.game.strategicPoints;
    if (sps && sps.list.length > 0) {
      const pulse = 0.7 + Math.sin(this.game.time.elapsed * 4) * 0.3;
      for (const p of sps.list) {
        if (p.state === "destroyed") continue;
        // Hide undiscovered hostile structures in darkness sectors. The
        // captured radar's reveal bonus opts the player into seeing all
        // structures via the system's `discovered` flag set in updateHostile.
        const isDark = Boolean(this.game.core.sector?.darkness);
        if (isDark && !p.discovered && (p.state === "enemy" || p.state === "neutral")) continue;
        const px = mx + (p.c + 0.5) * tileW;
        const py = my + (p.r + 0.5) * tileH;
        const tint = strategicTint(p.type, p.state);
        drawMinimapStrategicMarker(ctx, px, py, p, tint, pulse);
      }
    }

    // Squad markers — drawn on top of structures but under the viewport rect
    // so the camera box stays readable. Each squad type has a distinct shape;
    // the selected squad gets a brighter outer ring and a path line to its
    // current target/destination.
    if (this.game.squads && this.game.squads.list.length > 0) {
      const selected = this.game.squads.selected;
      for (const s of this.game.squads.list) {
        if (!s.active) continue;
        const sx = mx + (s.pos.x / TILE_SIZE) * tileW;
        const sy = my + (s.pos.y / TILE_SIZE) * tileH;
        const sel = s === selected;
        // Path line from squad → target/destination for selected or evac.
        if (sel || s.evacuating) {
          const tx = mx + (s.target.x / TILE_SIZE) * tileW;
          const ty = my + (s.target.y / TILE_SIZE) * tileH;
          ctx.save();
          ctx.globalAlpha = 0.7;
          ctx.strokeStyle = s.evacuating ? "#ffd180" : s.def.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        drawMinimapSquadMarker(ctx, sx, sy, s.type, s.def.color, sel, s.evacuating);
      }
    }

    // Camera viewport rectangle.
    const vb = cam.getVisibleBounds();
    const vx = mx + (vb.x / (COLS * TILE_SIZE)) * mapW;
    const vy = my + (vb.y / (ROWS * TILE_SIZE)) * mapH;
    const vw = (vb.w / (COLS * TILE_SIZE)) * mapW;
    const vh = (vb.h / (ROWS * TILE_SIZE)) * mapH;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    ctx.strokeRect(
      Math.max(mx, vx),
      Math.max(my, vy),
      Math.min(vw, mapW - (vx - mx)),
      Math.min(vh, mapH - (vy - my))
    );

    ctx.restore();
  }
}

// ──────────────────────────────────────────────────────────
// Strategic-point rendering helpers (module-scope so they don't bloat the
// RenderSystem class with one-shot drawing routines).
// ──────────────────────────────────────────────────────────

function strategicTint(type: StrategicPointType, state: StrategicPointState): string {
  if (state === "depleted") return "#9e9e9e";
  if (state === "destroyed") return "#616161";
  if (state === "captured") {
    if (type === "abandoned_turret") return "#ffeb3b";
    if (type === "radar_dish") return "#80d8ff";
    return "#66fcf1";
  }
  if (type === "rift_anchor") return "#ff5252";
  if (type === "jammer") return "#ef6c00";
  if (type === "data_cache") return "#ffd54f";
  if (type === "abandoned_turret") return "#ffeb3b";
  if (type === "radar_dish") return "#80d8ff";
  return "#90a4ae"; // neutral signal_node before capture
}

function drawStrategicGlyph(
  ctx: CanvasRenderingContext2D,
  type: StrategicPointType,
  state: StrategicPointState,
  color: string,
  elapsed: number
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  switch (type) {
    case "signal_node": {
      // Vertical antenna with three concentric arcs.
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.lineTo(0, -7);
      ctx.stroke();
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(0, -7, 3 * i, -Math.PI * 0.7, -Math.PI * 0.3);
        ctx.stroke();
      }
      break;
    }
    case "radar_dish": {
      // Rotating dish silhouette.
      ctx.rotate(elapsed * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, 7, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "data_cache": {
      // Crate icon — pulses when neutral, dims when depleted.
      const pulse = state === "neutral" ? 0.7 + Math.sin(elapsed * 4) * 0.3 : 0.45;
      ctx.globalAlpha = pulse;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = state === "depleted" ? "#888888" : "#000000";
      ctx.strokeRect(-6, -6, 12, 12);
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.stroke();
      break;
    }
    case "abandoned_turret": {
      // Cannon with rotating muzzle when active.
      if (state === "captured") ctx.rotate(elapsed * 0.4);
      ctx.fillStyle = state === "captured" ? color : "#5d6f7a";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(0, -2, 10, 4);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
      ctx.strokeRect(0, -2, 10, 4);
      break;
    }
    case "rift_anchor": {
      // Three-pointed star with a violently pulsing core.
      const pulse = 0.5 + Math.sin(elapsed * 3.4) * 0.4;
      ctx.rotate(elapsed * 0.5);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const x = Math.cos(a) * 9;
        const y = Math.sin(a) * 9;
        ctx.moveTo(0, 0);
        ctx.lineTo(x, y);
      }
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = `rgba(244, 67, 54, ${pulse.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "jammer": {
      // Distorted broadcast cross with sweeping jammer ticks.
      const pulse = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.strokeStyle = "#ef6c00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, -7);
      ctx.lineTo(7, 7);
      ctx.moveTo(7, -7);
      ctx.lineTo(-7, 7);
      ctx.stroke();
      ctx.fillStyle = `rgba(239, 108, 0, ${pulse.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pct: number,
  critical: boolean
): void {
  const w = 30;
  const h = 4;
  ctx.save();
  ctx.translate(x - w / 2, y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(-1, -1, w + 2, h + 2);
  ctx.fillStyle = critical ? "#ff5252" : "#ff9800";
  ctx.fillRect(0, 0, w * Math.max(0, Math.min(1, pct)), h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Pulse-countdown ring shown above hostile structures. Telegraphs the next
 * pulse moment so the player can decide whether to retreat, push, or focus
 * fire. Becomes red and adds a "PULSE" label in the last 2 seconds.
 */
function drawPulseWarning(
  ctx: CanvasRenderingContext2D,
  p: StrategicPoint,
  elapsed: number
): void {
  const remaining = Math.max(0, p.effectTimer);
  const interval = Math.max(0.5, p.pulseInterval);
  const pct = 1 - Math.min(1, remaining / interval); // 0 → just pulsed, 1 → about to pulse
  const urgent = remaining <= 2;
  const color = p.type === "rift_anchor"
    ? (urgent ? "#ff5252" : "#ffb300")
    : (urgent ? "#ff7043" : "#ffa726");
  const pulse = urgent ? 0.6 + Math.sin(elapsed * 14) * 0.4 : 1;

  ctx.save();
  // Background ring.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.pos.x, p.pos.y - 28, 6, 0, Math.PI * 2);
  ctx.stroke();
  // Filled-arc countdown.
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.globalAlpha = pulse;
  ctx.shadowBlur = urgent ? 10 : 4;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.arc(p.pos.x, p.pos.y - 28, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  if (urgent) {
    // Tiny "PULSE" label that pops in the final two seconds.
    ctx.fillStyle = color;
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("PULSE", p.pos.x, p.pos.y - 38);
  }
  ctx.restore();
}

/**
 * Draw a minimap marker for a strategic point. Shapes: diamond for friendly
 * captures, square for neutral capturable, X for hostile structures, dot for
 * depleted. Hostile structures pulse so the player can spot active threats
 * even at minimap scale.
 */
function drawMinimapStrategicMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: StrategicPoint,
  tint: string,
  pulse: number
): void {
  ctx.save();
  ctx.translate(x, y);
  if (p.state === "enemy") {
    // X-shaped hostile structure marker — pulses for attention.
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = tint;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-3, -3);
    ctx.lineTo(3, 3);
    ctx.moveTo(-3, 3);
    ctx.lineTo(3, -3);
    ctx.stroke();
    // Filled center dot for visibility against busy backgrounds.
    ctx.globalAlpha = 1;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.state === "captured") {
    // Filled diamond — stable / friendly. Disabled abandoned turret pulses red.
    const turretBroken = p.type === "abandoned_turret" && p.disabled;
    ctx.fillStyle = turretBroken ? "#ff5252" : tint;
    if (turretBroken) ctx.globalAlpha = 0.4 + pulse * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 4);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    if (turretBroken) {
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#ff5252";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(3, 3);
      ctx.moveTo(-3, 3);
      ctx.lineTo(3, -3);
      ctx.stroke();
    }
  } else if (p.state === "neutral") {
    // Hollow square — capturable.
    ctx.strokeStyle = tint;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-3, -3, 6, 6);
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(-2.5, -2.5, 5, 5);
  } else {
    // Depleted — small grey dot.
    ctx.fillStyle = "rgba(160, 160, 160, 0.6)";
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Small label-strip rendered above a strategic point — used for "JAMMED",
 * "CONTESTED", "OUT OF SIGNAL". Sized to be readable but unobtrusive.
 */
function drawTinyBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string
): void {
  ctx.save();
  ctx.font = "bold 8px monospace";
  ctx.textAlign = "center";
  const w = ctx.measureText(label).width + 10;
  ctx.fillStyle = "rgba(8, 12, 18, 0.85)";
  ctx.fillRect(x - w / 2, y - 8, w, 11);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x - w / 2, y - 8, w, 11);
  ctx.fillStyle = color;
  ctx.fillText(label, x, y);
  ctx.restore();
}

/**
 * A line of tooltip text plus an optional color override. The tooltip renderer
 * uses the color so blocking conditions (jammed / contested) stand out.
 */
interface TooltipLine {
  text: string;
  color?: string;
}

function drawStrategicTooltip(
  ctx: CanvasRenderingContext2D,
  p: StrategicPoint,
  color: string,
  squadStatus: { text: string; color: string } | null = null
): void {
  const lines: TooltipLine[] = [];
  lines.push({ text: p.name.toUpperCase(), color });
  lines.push({ text: typeAndStateLabel(p), color: "#ffffff" });
  if (squadStatus) lines.push({ text: squadStatus.text, color: squadStatus.color });

  if (p.state === "neutral") {
    const pct = Math.round(p.captureProgress * 100);
    lines.push({ text: `Capture: ${pct}%`, color: "rgba(197, 198, 199, 0.9)" });
    if (!p.inCoverage) {
      lines.push({ text: "Outside signal coverage", color: "#ffb300" });
    } else if (p.jammed) {
      lines.push({ text: "JAMMED — capture blocked", color: "#ef6c00" });
    } else if (p.contested) {
      lines.push({ text: "CONTESTED by enemies", color: "#ff5252" });
    } else {
      lines.push({ text: "In signal coverage — capturing", color: "#66fcf1" });
    }
  } else if (p.state === "enemy") {
    lines.push({
      text: `HP ${Math.max(0, Math.ceil(p.health))}/${p.maxHealth}`,
      color: p.health <= p.maxHealth * 0.35 ? "#ff5252" : "#ffffff",
    });
    // Hostile structures: show the impending pulse countdown (rift/jammer).
    if (p.pulseInterval > 0 && p.effectTimer > 0) {
      const remaining = Math.max(0, p.effectTimer);
      const label = p.type === "rift_anchor"
        ? `Pulse in ${remaining.toFixed(1)}s`
        : `Wave in ${remaining.toFixed(1)}s`;
      const urgent = remaining <= 2;
      lines.push({ text: label, color: urgent ? "#ff5252" : "#ffb300" });
    }
  } else if (p.state === "captured") {
    if (p.type === "abandoned_turret") {
      lines.push({ text: "Allied turret online", color: "#ffeb3b" });
    } else {
      lines.push({ text: "Online — friendly", color: "#66fcf1" });
    }
  } else if (p.state === "depleted") {
    lines.push({ text: "Already collected", color: "#9e9e9e" });
  }

  if (p.description) lines.push({ text: p.description, color: "rgba(197, 198, 199, 0.85)" });
  if (p.rewardSummary && p.state !== "destroyed" && p.state !== "depleted") {
    lines.push({ text: p.rewardSummary, color: "rgba(255, 213, 79, 0.9)" });
  }

  const pad = 6;
  const lineH = 12;
  const fontSize = 10;
  ctx.save();
  ctx.font = `${fontSize}px monospace`;
  let maxW = 0;
  for (const l of lines) {
    const w = ctx.measureText(l.text).width;
    if (w > maxW) maxW = w;
  }
  const boxW = maxW + pad * 2;
  const boxH = lines.length * lineH + pad * 2;
  const tx = p.pos.x + 22;
  const ty = p.pos.y - boxH - 14;
  ctx.fillStyle = "rgba(8, 12, 18, 0.92)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.fillRect(tx, ty, boxW, boxH);
  ctx.strokeRect(tx, ty, boxW, boxH);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    ctx.fillStyle = line.color ?? "#ffffff";
    ctx.fillText(line.text, tx + pad, ty + pad + (i + 1) * lineH - 3);
  }
  ctx.restore();
}

function typeAndStateLabel(p: StrategicPoint): string {
  const typeName = displayType(p.type);
  switch (p.state) {
    case "captured": return `${typeName} • CAPTURED`;
    case "enemy": return `${typeName} • HOSTILE`;
    case "neutral": return `${typeName} • CAPTURABLE`;
    case "depleted": return `${typeName} • DEPLETED`;
    case "destroyed": return `${typeName} • DESTROYED`;
  }
}

function displayType(t: StrategicPointType): string {
  switch (t) {
    case "signal_node": return "SIGNAL NODE";
    case "radar_dish": return "RADAR DISH";
    case "data_cache": return "DATA CACHE";
    case "abandoned_turret": return "ABANDONED TURRET";
    case "rift_anchor": return "RIFT ANCHOR";
    case "jammer": return "JAMMER";
  }
}

/**
 * Distinct minimap markers for each squad type. We use small shapes (≤ 4 px)
 * so the minimap stays readable even with several squads. Selected squads
 * get an outer halo; evacuating squads pulse with a warm tint.
 */
function drawMinimapSquadMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: "recon" | "engineer" | "strike" | "shield",
  color: string,
  selected: boolean,
  evacuating: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  if (selected) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = evacuating ? "#ffd180" : color;
  ctx.strokeStyle = "rgba(8, 12, 18, 0.85)";
  ctx.lineWidth = 0.8;
  switch (type) {
    case "recon": {
      // Triangle pointing up.
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(2.6, 2.2);
      ctx.lineTo(-2.6, 2.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "engineer": {
      // Plus / cross.
      ctx.fillRect(-2.6, -0.8, 5.2, 1.6);
      ctx.fillRect(-0.8, -2.6, 1.6, 5.2);
      ctx.strokeRect(-2.6, -0.8, 5.2, 1.6);
      ctx.strokeRect(-0.8, -2.6, 1.6, 5.2);
      break;
    }
    case "strike": {
      // Chevron pointing right.
      ctx.beginPath();
      ctx.moveTo(-2.6, -2.6);
      ctx.lineTo(2.4, 0);
      ctx.lineTo(-2.6, 2.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "shield": {
      // Ring with center dot.
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}
