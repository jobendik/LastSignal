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
  // Pre-built star field (static, generated once).
  private stars: { x: number; y: number; r: number; a: number }[] = [];

  constructor(private readonly game: Game) {
    this.lightCanvas = document.createElement("canvas");
    this.lightCanvas.width  = VIEW_WIDTH;
    this.lightCanvas.height = VIEW_HEIGHT;
    this.lightCtx = this.lightCanvas.getContext("2d")!;
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

  render(): void {
    const ctx = this.game.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Screen shake: directional bias toward impact + rotational component.
    const shake = this.game.core.shake;
    const shakeRot = this.game.core.shakeRot;
    if (shake > 0.01 || shakeRot > 0.001) {
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
    this.drawTerrain(ctx);
    if (this.game.core.debug.showFlow) this.drawFlowDebug(ctx);
    this.drawPathPreview(ctx);
    if (this.game.core.showHeatmap) this.drawHeatmap(ctx);
    this.drawCore(ctx);
    this.drawDamageZones(ctx);
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
    this.drawPlacementPreview(ctx);
    this.drawSelectionHighlights(ctx);
    if (this.game.core.debug.show) this.drawDebugOverlay(ctx);

    // Dynamic light layer — additive compositing.
    this.buildLightLayer();
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.55;
    ctx.drawImage(this.lightCanvas, 0, 0);
    ctx.restore();

    // Reset shake before CRT so the overlay sits fixed on screen.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.game.core.settings.reducedFlashing) this.drawCRTOverlay(ctx);
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
      addLight(t.pos.x, t.pos.y, 28, hexToRgb(t.def.color), 0.15);
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
          ctx.fillStyle = "#232a33";
          ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
          ctx.strokeStyle = "#0e1216";
          ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        } else if (k === CellKind.Crystal) {
          ctx.save();
          ctx.fillStyle = "#00e676";
          ctx.globalAlpha = 0.7;
          ctx.shadowBlur = 12;
          ctx.shadowColor = "#00e676";
          ctx.beginPath();
          const cx = x + TILE_SIZE / 2;
          const cy = y + TILE_SIZE / 2;
          ctx.moveTo(cx, cy - 8);
          ctx.lineTo(cx + 6, cy);
          ctx.lineTo(cx, cy + 8);
          ctx.lineTo(cx - 6, cy);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
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
    const disabled = this.game.towers["disabled"].has(t);
    ctx.globalAlpha = disabled ? 0.4 : 1;

    // Base plate.
    ctx.fillStyle = "#141a22";
    ctx.strokeStyle = "#2b3542";
    ctx.fillRect(t.c * TILE_SIZE + 3, t.r * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    ctx.strokeRect(t.c * TILE_SIZE + 3, t.r * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);

    // Turret.
    ctx.translate(t.pos.x, t.pos.y);
    const stats = (t.statBlock());
    const elapsed = this.game.time.elapsed;
    const target = this.findTargetForDraw(t);
    const ang = Math.atan2(
      (target?.pos.y ?? t.pos.y) - t.pos.y,
      (target?.pos.x ?? t.pos.x + 1) - t.pos.x
    );

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

    if (!t.isEco) ctx.rotate(ang);

    // Fire glow: shadowBlur spikes when recoil is active (just fired).
    const fireBurst = t.recoil / 4;
    ctx.shadowBlur = 8 + fireBurst * 20;
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
    } else {
      ctx.fillRect(-3 - (t.recoil || 0), -7, 14, 14);
    }

    // Level pips.
    ctx.rotate(-ang);
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

    // Cooldown arc — drawn around the base plate after all rotation resets.
    this.drawCooldownArc(ctx, t);

    ctx.restore();
    void stats;
  }

  private drawCooldownArc(ctx: CanvasRenderingContext2D, t: Tower): void {
    if (t.isEco) {
      // Harvester: green income arc.
      const stats = t.statBlock();
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
    const stats = t.statBlock();
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
  }

  private findTargetForDraw(t: Tower): Enemy | null {
    // Display-only — cheap nearest in range.
    let best: Enemy | null = null;
    let bd = Infinity;
    const range = t.statBlock().range;
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

    if (e.isPhased) ctx.globalAlpha = 0.25 + Math.sin(e.timer * 12) * 0.1;

    ctx.shadowBlur = e.isBoss ? 18 : 8;
    ctx.shadowColor = e.color;
    ctx.fillStyle = e.color;

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
      case "weaver":
        ctx.beginPath();
        ctx.arc(0, 0, e.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ff80ab";
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(0, 0, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
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
      case "carrier":
        ctx.fillRect(-e.size, -e.size * 0.7, e.size * 2, e.size * 1.4);
        ctx.fillStyle = "#ff8a65";
        ctx.fillRect(-4, -4, 8, 8);
        break;
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
      ctx.strokeStyle = "#9c27b0";
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, e.size + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
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
    ctx.translate(d.pos.x, d.pos.y);
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

    // Head.
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
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
    ctx.restore();
  }

  private drawBeams(ctx: CanvasRenderingContext2D): void {
    for (const b of this.game.particles.beams) {
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2 + (b.life / b.maxLife) * 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = b.color;
      ctx.beginPath();
      ctx.moveTo(b.fromX, b.fromY);
      ctx.lineTo(b.toX, b.toY);
      ctx.stroke();
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

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.game.particles.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.pos.x - p.size / 2, p.pos.y - p.size / 2, p.size, p.size);
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

  private drawPlacementPreview(ctx: CanvasRenderingContext2D): void {
    const input = this.game.input;
    if (!input.showPlacementPreview || !input.selectedTowerType || !input.hoverCell) return;
    const t = input.selectedTowerType;
    const { c, r } = input.hoverCell;
    const check = this.game.towers.canPlace(t, c, r);
    const ok = check.ok;

    const x = c * TILE_SIZE;
    const y = r * TILE_SIZE;
    ctx.save();
    ctx.strokeStyle = ok ? "#4caf50" : "#f44336";
    ctx.fillStyle = ok ? "rgba(76, 175, 80, 0.2)" : "rgba(244, 67, 54, 0.2)";
    ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Range ring.
    if (ok) {
      const def = (this.game.towers as unknown as { __unused?: unknown });
      void def;
      const range = this.previewRange(t);
      ctx.strokeStyle = "rgba(102, 252, 241, 0.5)";
      ctx.beginPath();
      ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, range, 0, Math.PI * 2);
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
