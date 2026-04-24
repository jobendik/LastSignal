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
  constructor(private readonly game: Game) {}

  render(): void {
    const ctx = this.game.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Screen shake.
    const shake = this.game.core.shake;
    const sx = shake > 0.01 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0.01 ? (Math.random() - 0.5) * shake : 0;
    ctx.translate(sx, sy);

    this.drawBackground(ctx);
    this.drawTerrain(ctx);
    if (this.game.core.debug.showFlow) this.drawFlowDebug(ctx);
    this.drawPathPreview(ctx);
    this.drawCore(ctx);
    this.drawDamageZones(ctx);
    this.drawRings(ctx);
    this.drawTowers(ctx);
    this.drawEnemies(ctx);
    this.drawDrones(ctx);
    this.drawProjectiles(ctx);
    this.drawBeams(ctx);
    this.drawLightning(ctx);
    this.drawParticles(ctx);
    this.drawFloatingText(ctx);
    this.drawPlacementPreview(ctx);
    this.drawSelectionHighlights(ctx);
    if (this.game.core.debug.show) this.drawDebugOverlay(ctx);
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
    ctx.strokeStyle = "rgba(102, 252, 241, 0.07)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE_SIZE, 0);
      ctx.lineTo(c * TILE_SIZE, VIEW_HEIGHT);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
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

    // Spawners.
    for (const s of grid.spawners) {
      const cx = s.c * TILE_SIZE + TILE_SIZE / 2;
      const cy = s.r * TILE_SIZE + TILE_SIZE / 2;
      ctx.save();
      ctx.strokeStyle = "rgba(244, 67, 54, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, 12 + Math.sin(this.game.time.elapsed * 3) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawCore(ctx: CanvasRenderingContext2D): void {
    const grid = this.game.grid;
    const pct = this.game.core.coreIntegrity / this.game.core.coreMax;
    const cx = grid.corePos.x;
    const cy = grid.corePos.y;

    // Base.
    ctx.save();
    ctx.fillStyle = "rgba(10, 14, 20, 0.8)";
    for (const i of grid.coreCells) {
      const { c, r } = grid.coords(i);
      ctx.fillRect(c * TILE_SIZE + 2, r * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }
    // Pulsing core.
    const pulse = 0.7 + Math.sin(this.game.time.elapsed * 2) * 0.15;
    ctx.shadowBlur = 40 * pulse;
    ctx.shadowColor = pct < 0.3 ? "#f44336" : "#66fcf1";
    ctx.strokeStyle = pct < 0.3 ? "#f44336" : "#66fcf1";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(102, 252, 241, ${0.2 * pulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    // HP ring.
    ctx.strokeStyle = pct < 0.3 ? "#f44336" : pct < 0.6 ? "#ffb300" : "#4caf50";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();
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
    const ang = Math.atan2(
      (this.findTargetForDraw(t)?.pos.y ?? t.pos.y) - t.pos.y,
      (this.findTargetForDraw(t)?.pos.x ?? t.pos.x + 1) - t.pos.x
    );
    if (!t.isEco) ctx.rotate(ang);
    ctx.shadowBlur = 8;
    ctx.shadowColor = t.def.color;
    ctx.fillStyle = t.def.color;
    if (t.type === "mortar") {
      ctx.fillRect(-6, -10, 12, 20);
    } else if (t.type === "harvester") {
      ctx.beginPath();
      ctx.arc(0, 0, 10 + Math.sin(this.game.time.elapsed * 3) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (t.type === "tesla") {
      ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-2, -2, 4, 4);
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

    ctx.restore();
    void stats;
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
      case "scout":
        ctx.beginPath();
        ctx.moveTo(e.size, 0);
        ctx.lineTo(-e.size, -e.size * 0.6);
        ctx.lineTo(-e.size, e.size * 0.6);
        ctx.closePath();
        ctx.fill();
        break;
      case "grunt":
        ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
        break;
      case "brute":
        ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(-e.size + 2, -e.size + 2, e.size * 2 - 4, e.size * 2 - 4);
        break;
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
      case "phantom":
        ctx.beginPath();
        ctx.arc(0, 0, e.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.beginPath();
        ctx.arc(0, 0, e.size + 2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "carrier":
        ctx.fillRect(-e.size, -e.size * 0.7, e.size * 2, e.size * 1.4);
        ctx.fillStyle = "#ff8a65";
        ctx.fillRect(-4, -4, 8, 8);
        break;
      case "leviathan":
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
    ctx.shadowBlur = 6;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    const size = p.kind === "mortar" ? 5 : 3;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, size, 0, Math.PI * 2);
    ctx.fill();
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
      ctx.save();
      ctx.strokeStyle = l.color;
      ctx.lineWidth = (l.life / l.maxLife) * 8;
      ctx.shadowBlur = 16;
      ctx.shadowColor = l.color;
      ctx.beginPath();
      ctx.moveTo(l.points[0]!.x, l.points[0]!.y);
      for (let i = 1; i < l.points.length; i++) ctx.lineTo(l.points[i]!.x, l.points[i]!.y);
      ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = (l.life / l.maxLife) * 3;
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
