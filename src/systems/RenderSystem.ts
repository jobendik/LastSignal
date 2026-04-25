import type { Game } from "../core/Game";
import { CellKind } from "../core/Types";
import type { Enemy } from "../entities/Enemy";
import type { Tower } from "../entities/Tower";
import type { Drone } from "../entities/Drone";
import type { Projectile } from "../entities/Projectile";
import { COLS, ROWS, TILE_SIZE, VIEW_HEIGHT, VIEW_WIDTH } from "../core/Config";
import { towerDefinitions } from "../data/towers";
import type { TowerType } from "../core/Types";

/** Canvas 2D render pipeline with ordered layers. */
export class RenderSystem {
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private previousFrameCanvas: HTMLCanvasElement;
  private previousFrameCtx: CanvasRenderingContext2D;
  private noiseCanvas: HTMLCanvasElement;
  // Pre-built star field (static, generated once).
  private stars: { x: number; y: number; r: number; a: number }[] = [];

  constructor(private readonly game: Game) {
    this.lightCanvas = document.createElement("canvas");
    this.lightCanvas.width  = VIEW_WIDTH;
    this.lightCanvas.height = VIEW_HEIGHT;
    this.lightCtx = this.lightCanvas.getContext("2d")!;
    this.previousFrameCanvas = document.createElement("canvas");
    this.previousFrameCanvas.width = VIEW_WIDTH;
    this.previousFrameCanvas.height = VIEW_HEIGHT;
    this.previousFrameCtx = this.previousFrameCanvas.getContext("2d")!;
    this.noiseCanvas = document.createElement("canvas");
    this.noiseCanvas.width = 256;
    this.noiseCanvas.height = 256;
    this.generateNoiseTexture();
    this.generateStars();
  }

  private generateStars(): void {
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * VIEW_WIDTH,
        y: Math.random() * VIEW_HEIGHT,
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
    const quality = this.game.core.settings.graphicsQuality;
    const reducedMotion = this.game.core.settings.reducedMotion;
    this.previousFrameCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.previousFrameCtx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.previousFrameCtx.drawImage(ctx.canvas, 0, 0);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Screen shake: directional bias toward impact + rotational component.
    const shake = this.game.core.shake;
    const shakeRot = this.game.core.shakeRot;
    if (this.game.core.settings.screenShake && !reducedMotion && (shake > 0.01 || shakeRot > 0.001)) {
      const dir = this.game.core.shakeDir;
      const rand = (Math.random() - 0.5);
      // 60% directional, 40% random perpendicular
      const sx = dir.x * shake * 0.6 * rand + (Math.random() - 0.5) * shake * 0.4;
      const sy = dir.y * shake * 0.6 * rand + (Math.random() - 0.5) * shake * 0.4;
      const rot = (Math.random() - 0.5) * shakeRot * 2;
      ctx.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
      ctx.rotate(rot);
      ctx.translate(-VIEW_WIDTH / 2 + sx, -VIEW_HEIGHT / 2 + sy);
    }

    this.drawBackground(ctx);
    if (quality === "high" && !this.game.core.settings.reducedFlashing && !reducedMotion) {
      this.drawPhosphorPersistence(ctx);
    }
    this.drawTerrain(ctx);
    if (this.game.core.debug.showFlow) this.drawFlowDebug(ctx);
    this.drawPathPreview(ctx);
    if (this.game.core.showHeatmap) this.drawHeatmap(ctx);
    this.drawKillZone(ctx);
    this.drawCore(ctx);
    this.drawDamageZones(ctx);
    this.drawScorchDecals(ctx);
    this.drawRings(ctx);
    this.drawTowers(ctx);
    this.drawEnemies(ctx);
    this.drawDrones(ctx);
    this.drawProjectiles(ctx);
    this.drawBeams(ctx);
    this.drawLightning(ctx);
    this.drawMuzzleFlashes(ctx);
    this.drawParticles(ctx);
    this.drawFloatingText(ctx);
    this.drawBuildSynergyHighlights(ctx);
    this.drawPlacementPreview(ctx);
    this.drawSelectionHighlights(ctx);
    if (this.game.core.debug.show) this.drawDebugOverlay(ctx);

    // Dynamic light layer — additive compositing.
    if (quality !== "low") {
      this.buildLightLayer();
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = quality === "medium" ? 0.36 : 0.55;
      ctx.drawImage(this.lightCanvas, 0, 0);
      ctx.restore();
    }

    // Reset shake before CRT so the overlay sits fixed on screen.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (quality !== "low" && !this.game.core.settings.reducedFlashing && !reducedMotion) {
      this.drawCRTOverlay(ctx);
    }
    if (quality === "high" && !this.game.core.settings.reducedFlashing && !reducedMotion) {
      this.drawChromaticAberration(ctx);
    }
    this.drawScreenFlashes(ctx);
    this.drawPlanningTimerArc(ctx);
  }

  private buildLightLayer(): void {
    const lc = this.lightCtx;
    lc.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
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

    // Core ambient glow.
    const core = this.game.grid.corePos;
    const corePct = this.game.core.coreIntegrity / this.game.core.coreMax;
    const corePulse = 0.6 + Math.sin(this.game.time.elapsed * 2) * 0.2;
    const coreColor = corePct < 0.3 ? "rgb(244, 67, 54)" : "rgb(102, 252, 241)";
    addLight(core.x, core.y, 80 * corePulse, coreColor, 0.5);

    // Tower ambient glow (dim, always-on).
    for (const t of this.game.towers.list) {
      const fireGlow = Math.max(0, Math.min(1, t.recoil / 4));
      addLight(
        t.pos.x,
        t.pos.y,
        28 + fireGlow * 34,
        hexToRgb(t.def.color),
        0.15 + fireGlow * 0.32
      );
    }

    // Projectile glow (brightest light source).
    for (const p of this.game.projectiles.list) {
      const radius = p.kind === "mortar" ? 18 : 12;
      addLight(p.pos.x, p.pos.y, radius, hexToRgb(p.color), 0.6);
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

    // Scanlines: alternating dark rows with slight brightness variation.
    ctx.fillStyle = "#000";
    for (let y = 0; y < VIEW_HEIGHT; y += 3) {
      ctx.globalAlpha = 0.08 + Math.sin(y * 0.1 + t * 0.3) * 0.015;
      ctx.fillRect(0, y, VIEW_WIDTH, 1);
    }

    // Vignette: deepens slightly toward screen edges.
    ctx.globalAlpha = 1;
    const vigIntensity = 0.5 + (this.game.core.coreIntegrity / this.game.core.coreMax < 0.3 ? Math.sin(t * 3) * 0.08 : 0);
    const vg = ctx.createRadialGradient(
      VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH * 0.3,
      VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH * 0.78
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,0,0,${vigIntensity.toFixed(2)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Phosphor persistence band: slow vertical drift with soft glow.
    const bandY = (Math.sin(t * 0.55) * 0.5 + 0.5) * (VIEW_HEIGHT - 40);
    const grd = ctx.createLinearGradient(0, bandY - 12, 0, bandY + 40);
    grd.addColorStop(0,   "rgba(102, 252, 241, 0)");
    grd.addColorStop(0.3, "rgba(102, 252, 241, 0.05)");
    grd.addColorStop(0.6, "rgba(102, 252, 241, 0.03)");
    grd.addColorStop(1,   "rgba(102, 252, 241, 0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = grd;
    ctx.fillRect(0, bandY - 12, VIEW_WIDTH, 52);

    // Occasional random flicker.
    if (Math.random() < 0.015) {
      ctx.globalAlpha = Math.random() * 0.04;
      ctx.fillStyle = "#66fcf1";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }

    if (this.game.core.settings.graphicsQuality === "high") this.drawFilmGrain(ctx);

    ctx.restore();
  }

  private drawPhosphorPersistence(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = 0.11;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(this.previousFrameCanvas, 0, 0);
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
    ctx.fillRect(0, 0, VIEW_WIDTH + this.noiseCanvas.width, VIEW_HEIGHT + this.noiseCanvas.height);
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
    ctx.drawImage(this.previousFrameCanvas, -offset, 0);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.045;
    ctx.drawImage(this.previousFrameCanvas, offset, 0);
    ctx.restore();
  }

  private drawMuzzleFlashes(ctx: CanvasRenderingContext2D): void {
    for (const m of this.game.particles.muzzleFlashes) {
      const a = m.life / m.maxLife;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      ctx.globalAlpha = a;
      ctx.shadowBlur = 14;
      ctx.shadowColor = m.color;
      ctx.fillStyle = m.color;
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
    const g = ctx.createRadialGradient(
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      100,
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      VIEW_WIDTH / 1.2
    );
    g.addColorStop(0, "rgba(12, 18, 26, 1)");
    g.addColorStop(1, "rgba(4, 5, 8, 1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Twinkling star field.
    const elapsed = this.game.time.elapsed;
    ctx.shadowBlur = 0;
    for (const s of this.stars) {
      const twinkle = s.a * (0.75 + Math.sin(elapsed * 1.3 + s.x * 0.07) * 0.25);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = "#c8e6ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Animated grid: base glow with a slow pulse wave traveling across columns.
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      const wave = 0.04 + Math.sin(elapsed * 1.6 - c * 0.3) * 0.025;
      ctx.strokeStyle = `rgba(102, 252, 241, ${wave.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(c * TILE_SIZE, 0);
      ctx.lineTo(c * TILE_SIZE, VIEW_HEIGHT);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      const wave = 0.04 + Math.sin(elapsed * 1.6 - r * 0.3) * 0.025;
      ctx.strokeStyle = `rgba(102, 252, 241, ${wave.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(0, r * TILE_SIZE);
      ctx.lineTo(VIEW_WIDTH, r * TILE_SIZE);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTerrain(ctx: CanvasRenderingContext2D): void {
    const grid = this.game.grid;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = grid.idx(c, r);
        const k = grid.cells[i];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        if (k === CellKind.Rock) {
          // Deterministic varied polygon per tile.
          const rng = (n: number) => Math.abs(Math.sin((c * 31 + r * 17) * 13.7 + n * 7.3));
          const cx = x + TILE_SIZE / 2;
          const cy = y + TILE_SIZE / 2;
          const pts = 7;
          ctx.beginPath();
          for (let i = 0; i < pts; i++) {
            const ang = (i / pts) * Math.PI * 2 - Math.PI / 2 + rng(i + 20) * 0.3;
            const rad = 8 + rng(i) * 5;
            const px = cx + Math.cos(ang) * rad;
            const py = cy + Math.sin(ang) * rad;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = "#232a33";
          ctx.fill();
          ctx.strokeStyle = "#0e1216";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Highlight edge.
          ctx.beginPath();
          for (let i = 0; i < 2; i++) {
            const ang = (i / pts) * Math.PI * 2 - Math.PI / 2 + rng(i + 20) * 0.3;
            const rad = 8 + rng(i) * 5;
            const px = cx + Math.cos(ang) * rad;
            const py = cy + Math.sin(ang) * rad;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.strokeStyle = "rgba(70, 90, 110, 0.5)";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (k === CellKind.Crystal) {
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
          // Inner bright core.
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
    }

    // Ambient occlusion: dark shadow on tiles adjacent to rocks.
    const AO_DEPTH = 12;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const k = grid.cells[grid.idx(c, r)];
        if (k !== CellKind.Rock && k !== CellKind.Crystal) continue;
        // For each neighbor open tile, paint a shadow gradient at the shared edge.
        const checks = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
        for (const [dc, dr] of checks) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
          const nk = grid.cells[grid.idx(nc, nr)];
          if (nk === CellKind.Rock || nk === CellKind.Crystal) continue;
          const nx = nc * TILE_SIZE;
          const ny = nr * TILE_SIZE;
          // Shadow source (at the shared edge, facing into the open tile).
          const sx = nx + (dc === -1 ? TILE_SIZE : 0);
          const sy = ny + (dr === -1 ? TILE_SIZE : 0);
          const ex = sx + dc * -AO_DEPTH;
          const ey = sy + dr * -AO_DEPTH;
          const aoGrd = ctx.createLinearGradient(sx, sy, ex, ey);
          aoGrd.addColorStop(0, "rgba(0,0,0,0.4)");
          aoGrd.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = aoGrd;
          ctx.fillRect(nx, ny, TILE_SIZE, TILE_SIZE);
        }
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

    ctx.restore();
  }

  private drawTowers(ctx: CanvasRenderingContext2D): void {
    for (const t of this.game.towers.list) this.drawTower(ctx, t);
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

    const disabled = this.game.towers["disabled"].has(t);
    // Check jammer aura — show yellow interference halo.
    const jammed = !disabled && this.game.enemies.list.some(
      (e) => e.active && e.type === "jammer" && e.pos.dist(t.pos) < 80
    );
    ctx.globalAlpha = disabled ? 0.4 : 1;

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
      ctx.fillStyle = t.def.color;
      ctx.font = "bold 7px Courier New";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${Math.round(ampBoost * 100)}%`, 0, 0);
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
    if (t.overcharge >= 5 && !t.isEco) {
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ffeb3b";
      ctx.beginPath();
      ctx.arc(0, 0, 18 + Math.sin(elapsed * 6) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
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

    // Jammer interference halo.
    if (jammed) {
      const pulse = 0.5 + Math.sin(this.game.time.elapsed * 14) * 0.35;
      ctx.save();
      ctx.globalAlpha = pulse * 0.75;
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#ffeb3b";
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = this.game.time.elapsed * -30;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.restore();
    void stats;
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

  private findTargetForDraw(t: Tower): Enemy | null {
    // Display-only — cheap nearest in range.
    let best: Enemy | null = null;
    let bd = Infinity;
    const range = this.game.towers.effectiveStats(t).range;
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      const d = e.pos.dist(t.pos);
      if (d < range && d < bd) { bd = d; best = e; }
    }
    return best;
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
    const bodyColor = frozen ? "#d8fbff" : e.color;
    ctx.shadowBlur = e.isBoss ? 18 : 8;
    ctx.shadowColor = frozen ? "#80d8ff" : e.color;
    ctx.fillStyle = bodyColor;

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
          grad.addColorStop(0, e.color);
          grad.addColorStop(1, "transparent");
          ctx.save();
          ctx.globalAlpha = 0.55;
          ctx.strokeStyle = grad;
          ctx.lineWidth = e.size * 0.9;
          ctx.lineCap = "round";
          ctx.shadowBlur = 6;
          ctx.shadowColor = e.color;
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
          ctx.strokeStyle = ri === 0 ? "#ffffff" : ri === 1 ? e.color : "#b39ddb";
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
        // Multi-segment rotating rings.
        const ringData = [
          { r: e.size * 1.85, speed: 0.7, segs: 6, gap: 0.22, color: e.color },
          { r: e.size * 2.4, speed: -0.45, segs: 4, gap: 0.35, color: "#ffffff" },
          { r: e.size * 3.0, speed: 0.3, segs: 8, gap: 0.18, color: e.color },
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
      ctx.strokeStyle = frozen ? "#b3f5ff" : "#9c27b0";
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
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(`PHASE ${Math.max(1, e.bossPhase)}`, 0, -e.size - 14);
    }

    // Colorblind helper: letter marker.
    if (this.game.core.settings.colorblind) {
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
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
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
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 4;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.moveTo(p.trail[i - 1]!.x, p.trail[i - 1]!.y);
        ctx.lineTo(p.trail[i]!.x, p.trail[i]!.y);
        ctx.stroke();
      }
    }

    // Head. Bullet classes get distinct silhouettes for quick readability.
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;

    if (p.ownerType === "blaster") {
      const ang = Math.atan2(p.lastDir.y, p.lastDir.x);
      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate(ang);
      ctx.fillStyle = p.color;
      ctx.fillRect(-5, -1.6, 10, 3.2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(2, -0.8, 4, 1.6);
      ctx.restore();
    } else if (p.ownerType === "pulse") {
      const progress = p.maxLife > 0 ? 1 - p.life / p.maxLife : 0;
      const ringRadius = 3 + (progress % 0.28) * 18;
      ctx.strokeStyle = p.color;
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
      ctx.fillStyle = p.color;
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
      if (b.kind === "railgun") {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.width * 1.9;
        ctx.shadowBlur = 26;
        ctx.shadowColor = b.color;
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
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2 + a * 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.color;
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
      ctx.save();
      ctx.globalAlpha = progress * flicker;

      // Outer glow pass.
      ctx.strokeStyle = l.color;
      ctx.lineWidth = progress * 6;
      ctx.shadowBlur = 18;
      ctx.shadowColor = l.color;
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
      ctx.save();
      ctx.strokeStyle = r.color;
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

  private drawScreenFlashes(ctx: CanvasRenderingContext2D): void {
    for (const f of this.game.particles.screenFlashes) {
      const a = (f.life / f.maxLife) * f.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.restore();
    }
  }

  private drawPlanningTimerArc(ctx: CanvasRenderingContext2D): void {
    if (this.game.state !== "PLANNING") return;
    const w = this.game.waves;
    if (w.planningCountdown <= 0 || !w.hasMoreWaves) return;

    const pct = Math.max(0, Math.min(1, w.planningCountdown / w.planningDuration));
    const secs = Math.ceil(w.planningCountdown);
    const cx = VIEW_WIDTH / 2;
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

  private drawPlacementPreview(ctx: CanvasRenderingContext2D): void {
    const input = this.game.input;
    const t = input.placementTowerType;
    if (!input.showPlacementPreview || !t || !input.hoverCell) return;
    const { c, r } = input.hoverCell;
    const check = this.game.towers.canPlace(t, c, r);
    const ok = check.ok;

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
        ctx.fillText("KILL ZONE [K]", VIEW_WIDTH / 2, VIEW_HEIGHT - 8);
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

  private drawHeatmap(ctx: CanvasRenderingContext2D): void {
    const grid = this.game.grid;
    // Accumulate enemy presence into a per-tile heat map.
    const heat = new Float32Array(COLS * ROWS);
    for (const e of this.game.enemies.list) {
      if (!e.active) continue;
      const c = Math.floor(e.pos.x / TILE_SIZE);
      const r = Math.floor(e.pos.y / TILE_SIZE);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      heat[r * COLS + c] += 1;
      // Spread to neighbors for a softer look.
      const neighbors = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dc, dr] of neighbors) {
        const nc = c + dc!, nr = r + dr!;
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) heat[nr * COLS + nc] += 0.4;
      }
    }
    // Also add flow-field convergence weight: tiles many paths pass through get a base tint.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = grid.idx(c, r);
        const dist = grid.flow[i];
        if (dist != null && dist >= 0) {
          // Closer to core = higher base heat (paths converge).
          const d = this.game.grid.getDistAtWorld(c * TILE_SIZE + 16, r * TILE_SIZE + 16);
          heat[r * COLS + c] += Math.max(0, (40 - d) / 40) * 0.6;
        }
      }
    }
    // Find max for normalisation.
    let maxH = 0;
    for (let i = 0; i < heat.length; i++) if (heat[i]! > maxH) maxH = heat[i]!;
    if (maxH < 0.1) maxH = 1;

    ctx.save();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const h = (heat[r * COLS + c]! / maxH);
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
    ctx.fillText("THREAT MAP [H]", 8, VIEW_HEIGHT - 8);
    ctx.restore();
  }

  private drawFlowDebug(ctx: CanvasRenderingContext2D): void {
    const grid = this.game.grid;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 235, 59, 0.4)";
    ctx.fillStyle = "rgba(255, 235, 59, 0.4)";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
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
}
