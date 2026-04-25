import type { Game } from "../core/Game";
import { Particle } from "../entities/Particle";
import { FloatingText } from "../entities/FloatingText";
import { DamageZone } from "../entities/DamageZone";
import { FLOATING_TEXT_CAP, PARTICLE_CAP } from "../core/Config";
import { rnd } from "../core/Random";

export interface LightningFX {
  points: { x: number; y: number }[];
  color: string;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface BlastRingFX {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface BeamFX {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  life: number;
  maxLife: number;
  active: boolean;
  kind: "standard" | "railgun";
  width: number;
}

export interface MuzzleFlashFX {
  x: number;
  y: number;
  angle: number;
  color: string;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface ScorchDecalFX {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface ScreenFlashFX {
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface CreditOrbFX {
  x: number;
  y: number;
  /** Horizontal speed (px/s). */
  vx: number;
  /** Initial upward speed (px/s). */
  vy: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ParticleSystem {
  particles: Particle[] = [];
  floatingText: FloatingText[] = [];
  zones: DamageZone[] = [];
  lightning: LightningFX[] = [];
  rings: BlastRingFX[] = [];
  beams: BeamFX[] = [];
  muzzleFlashes: MuzzleFlashFX[] = [];
  scorchDecals: ScorchDecalFX[] = [];
  screenFlashes: ScreenFlashFX[] = [];
  creditOrbs: CreditOrbFX[] = [];

  constructor(private readonly game: Game) {}

  reset(): void {
    this.particles.length = 0;
    this.floatingText.length = 0;
    this.zones.length = 0;
    this.lightning.length = 0;
    this.rings.length = 0;
    this.beams.length = 0;
    this.muzzleFlashes.length = 0;
    this.scorchDecals.length = 0;
    this.screenFlashes.length = 0;
    this.creditOrbs.length = 0;
  }

  spawnCreditOrbs(x: number, y: number, count = 2): void {
    if (this.game.core.settings.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.55;
      const speed = rnd(50, 80);
      this.creditOrbs.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rnd(0.65, 0.9),
        maxLife: 0.9,
        active: true,
      });
    }
  }

  spawnMuzzleFlash(x: number, y: number, angle: number, color: string): void {
    this.muzzleFlashes.push({ x, y, angle, color, life: 0.08, maxLife: 0.08, active: true });
  }

  spawnBurst(
    x: number,
    y: number,
    color: string,
    count: number,
    opts: { speed?: number; life?: number; size?: number; gravity?: number; angle?: number } = {}
  ): void {
    if (this.particles.length > PARTICLE_CAP) return;
    const finalCount = Math.max(1, Math.ceil(count * this.effectBudgetFactor()));
    for (let i = 0; i < finalCount; i++) {
      if (this.particles.length >= PARTICLE_CAP) break;
      this.particles.push(new Particle(x, y, color, {
        speed: opts.speed ?? rnd(60, 180),
        life: opts.life ?? rnd(0.3, 0.9),
        size: opts.size ?? rnd(1.5, 3),
        gravity: opts.gravity ?? 0,
        angle: opts.angle,
      }));
    }
  }

  spawnFloatingText(x: number, y: number, text: string | number, color: string, life = 0.9, size = 13): void {
    if (!this.game.core.settings.showDamageNumbers && typeof text === "number") return;
    if (this.floatingText.length >= FLOATING_TEXT_CAP) this.floatingText.shift();
    this.floatingText.push(new FloatingText(x, y, text, color, life, size));
  }

  spawnRing(x: number, y: number, radius: number, color: string, life = 0.3): void {
    this.rings.push({ x, y, radius: 0, maxRadius: radius, color, life, maxLife: life, active: true });
  }

  spawnBeam(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    life = 0.18,
    opts: { kind?: "standard" | "railgun"; width?: number } = {}
  ): void {
    this.beams.push({
      fromX: x1,
      fromY: y1,
      toX: x2,
      toY: y2,
      color,
      life,
      maxLife: life,
      active: true,
      kind: opts.kind ?? "standard",
      width: opts.width ?? 4,
    });
  }

  spawnImpactBurst(x: number, y: number, angle: number, color: string, intensity = 1): void {
    if (this.particles.length > PARTICLE_CAP) return;
    const reduced = this.game.core.settings.reducedFlashing || this.game.core.settings.reducedMotion;
    const count = reduced ? 2 : Math.max(3, Math.round(5 * intensity * this.effectBudgetFactor()));
    const palette = [color, "#ffffff", "#ffeb3b"];
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= PARTICLE_CAP) break;
      const sparkAngle = angle + rnd(-0.75, 0.75);
      const spark = new Particle(x, y, palette[i % palette.length]!, {
        angle: sparkAngle,
        speed: rnd(90, 220) * Math.max(0.6, intensity),
        life: rnd(0.1, 0.24),
        size: rnd(1, 2.2),
        gravity: 35,
      });
      this.particles.push(spark);
    }
  }

  spawnMortarExplosion(x: number, y: number, radius: number, color: string): void {
    const reduced = this.game.core.settings.reducedFlashing || this.game.core.settings.reducedMotion;
    this.spawnRing(x, y, radius * 0.55, "#ffffff", reduced ? 0.18 : 0.14);
    if (!reduced) {
      this.spawnRing(x, y, radius * 0.9, color, 0.26);
      this.spawnRing(x, y, radius * 1.18, "#ffb300", 0.4);
    }

    const count = reduced ? 6 : Math.ceil(18 * this.effectBudgetFactor());
    const palette = [color, "#ffb300", "#6d4c41", "#ffffff"];
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= PARTICLE_CAP) break;
      const debris = new Particle(x, y, palette[i % palette.length]!, {
        angle: rnd(0, Math.PI * 2),
        speed: rnd(80, 260),
        life: rnd(0.35, 0.85),
        size: rnd(1.5, 3.5),
        gravity: rnd(180, 360),
      });
      this.particles.push(debris);
    }

    this.scorchDecals.push({
      x,
      y,
      radius: Math.max(12, radius * 0.62),
      color: "rgba(45, 29, 20, 1)",
      life: 6,
      maxLife: 6,
      active: true,
    });
  }

  spawnInwardBurst(x: number, y: number, color: string, count = 10, radius = 18): void {
    if (this.particles.length > PARTICLE_CAP) return;
    const finalCount = Math.max(2, Math.ceil(count * this.effectBudgetFactor()));
    for (let i = 0; i < finalCount; i++) {
      if (this.particles.length >= PARTICLE_CAP) break;
      const angle = (i / count) * Math.PI * 2 + rnd(-0.18, 0.18);
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      this.particles.push(new Particle(px, py, color, {
        angle: angle + Math.PI + rnd(-0.2, 0.2),
        speed: rnd(80, 160),
        life: rnd(0.16, 0.3),
        size: rnd(1.5, 2.8),
      }));
    }
  }

  spawnScreenFlash(color = "#ffffff", life = 0.28, alpha = 0.65): void {
    const reduce = this.game.core.settings.reducedFlashing || this.game.core.settings.reducedMotion;
    const finalAlpha = reduce ? Math.min(alpha, 0.12) : alpha;
    this.screenFlashes.push({ color, alpha: finalAlpha, life, maxLife: life, active: true });
  }

  private effectBudgetFactor(): number {
    if (this.game.core.settings.reducedMotion) return 0.35;
    switch (this.game.core.settings.graphicsQuality) {
      case "low": return 0.35;
      case "medium": return 0.65;
      default: return 1;
    }
  }

  spawnLightning(points: { x: number; y: number }[], color: string): void {
    const subdivide = (pts: { x: number; y: number }[], disp: number): { x: number; y: number }[] => {
      const out: { x: number; y: number }[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        out.push({ x: a.x, y: a.y });
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const segs = Math.max(3, Math.floor(dist / 8));
        for (let j = 1; j < segs; j++) {
          const t = j / segs;
          out.push({
            x: a.x + (b.x - a.x) * t + rnd(-disp, disp),
            y: a.y + (b.y - a.y) * t + rnd(-disp, disp),
          });
        }
      }
      out.push(pts[pts.length - 1]!);
      return out;
    };

    // Two-pass subdivision for finer jaggedness.
    const pass1 = subdivide(points, 8);
    const jagged = subdivide(pass1, 4);

    // Optional branch from a midpoint.
    const branches: { x: number; y: number }[][] = [];
    if (jagged.length > 4 && Math.random() < 0.55) {
      const midIdx = Math.floor(jagged.length * rnd(0.3, 0.6));
      const mid = jagged[midIdx]!;
      const end = jagged[jagged.length - 1]!;
      const bx = mid.x + rnd(-12, 12);
      const by = mid.y + rnd(-12, 12);
      branches.push(subdivide([mid, { x: (mid.x + end.x) / 2 + bx * 0.4, y: (mid.y + end.y) / 2 + by * 0.4 }], 5));
    }

    this.lightning.push({ points: jagged, color, life: 0.2, maxLife: 0.2, active: true });
    for (const b of branches) {
      this.lightning.push({ points: b, color, life: 0.15, maxLife: 0.15, active: true });
    }
  }

  spawnDamageZone(x: number, y: number, radius: number, dps: number, life: number, color?: string): void {
    this.zones.push(new DamageZone(x, y, radius, dps, life, color));
  }

  spawnFlameJet(x: number, y: number, angle: number, range: number, coneHalf: number): void {
    if (this.particles.length > PARTICLE_CAP) return;
    const flameColors = ["#ff6e40", "#ff9100", "#ffb300", "#ff3d00", "#ff6e40"];
    const count = 7;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= PARTICLE_CAP) break;
      const spread = rnd(-coneHalf, coneHalf);
      const a = angle + spread;
      const speed = rnd(range * 0.6, range * 1.1);
      const life = rnd(0.06, 0.13);
      const color = flameColors[Math.floor(Math.random() * flameColors.length)]!;
      const p = new Particle(x, y, color, { angle: a, speed, life, size: rnd(3, 6) });
      p.gravity = 20;
      this.particles.push(p);
    }
  }

  update(dt: number): void {
    // Particles
    for (const p of this.particles) {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.vel.y += p.gravity * dt;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
    this.particles = this.particles.filter((p) => p.active);

    // Floating text
    for (const f of this.floatingText) {
      f.pos.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0) f.active = false;
    }
    this.floatingText = this.floatingText.filter((f) => f.active);

    // Zones
    for (const z of this.zones) {
      z.life -= dt;
      z.tickTimer -= dt;
      if (z.tickTimer <= 0) {
        z.tickTimer = z.tickInterval;
        // Damage enemies inside.
        for (const e of this.game.enemies.list) {
          if (!e.active) continue;
          if (e.pos.dist(z.pos) <= z.radius) {
            this.game.enemies.damage(e, z.dps * z.tickInterval, null);
          }
        }
      }
      if (z.life <= 0) z.active = false;
    }
    this.zones = this.zones.filter((z) => z.active);

    // Rings
    for (const r of this.rings) {
      r.life -= dt;
      r.radius = r.maxRadius * (1 - r.life / r.maxLife);
      if (r.life <= 0) r.active = false;
    }
    this.rings = this.rings.filter((r) => r.active);

    // Beams
    for (const b of this.beams) {
      b.life -= dt;
      if (b.life <= 0) b.active = false;
    }
    this.beams = this.beams.filter((b) => b.active);

    // Scorch decals
    for (const s of this.scorchDecals) {
      s.life -= dt;
      if (s.life <= 0) s.active = false;
    }
    this.scorchDecals = this.scorchDecals.filter((s) => s.active);

    // Screen flashes
    for (const f of this.screenFlashes) {
      f.life -= dt;
      if (f.life <= 0) f.active = false;
    }
    this.screenFlashes = this.screenFlashes.filter((f) => f.active);

    // Credit orbs: arc upward with a gentle arc, fade out.
    for (const o of this.creditOrbs) {
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.vy += 55 * dt; // gentle downward pull (softer than gravity)
      o.life -= dt;
      if (o.life <= 0) o.active = false;
    }
    this.creditOrbs = this.creditOrbs.filter((o) => o.active);

    // Lightning jitter
    for (const l of this.lightning) {
      l.life -= dt;
      for (let i = 1; i < l.points.length - 1; i++) {
        l.points[i]!.x += rnd(-1.5, 1.5);
        l.points[i]!.y += rnd(-1.5, 1.5);
      }
      if (l.life <= 0) l.active = false;
    }
    this.lightning = this.lightning.filter((l) => l.active);

    // Muzzle flashes.
    for (const m of this.muzzleFlashes) {
      m.life -= dt;
      if (m.life <= 0) m.active = false;
    }
    this.muzzleFlashes = this.muzzleFlashes.filter((m) => m.active);
  }
}
