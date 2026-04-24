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

export class ParticleSystem {
  particles: Particle[] = [];
  floatingText: FloatingText[] = [];
  zones: DamageZone[] = [];
  lightning: LightningFX[] = [];
  rings: BlastRingFX[] = [];
  beams: BeamFX[] = [];
  muzzleFlashes: MuzzleFlashFX[] = [];

  constructor(private readonly game: Game) {}

  reset(): void {
    this.particles.length = 0;
    this.floatingText.length = 0;
    this.zones.length = 0;
    this.lightning.length = 0;
    this.rings.length = 0;
    this.beams.length = 0;
    this.muzzleFlashes.length = 0;
  }

  spawnMuzzleFlash(x: number, y: number, angle: number, color: string): void {
    this.muzzleFlashes.push({ x, y, angle, color, life: 0.08, maxLife: 0.08, active: true });
  }

  spawnBurst(x: number, y: number, color: string, count: number, opts: { speed?: number; life?: number; size?: number } = {}): void {
    if (this.particles.length > PARTICLE_CAP) return;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= PARTICLE_CAP) break;
      this.particles.push(new Particle(x, y, color, {
        speed: opts.speed ?? rnd(60, 180),
        life: opts.life ?? rnd(0.3, 0.9),
        size: opts.size ?? rnd(1.5, 3),
      }));
    }
  }

  spawnFloatingText(x: number, y: number, text: string | number, color: string, life = 0.9, size = 13): void {
    if (!this.game.core.settings.showDamageNumbers && typeof text === "number") return;
    if (this.floatingText.length >= FLOATING_TEXT_CAP) this.floatingText.shift();
    this.floatingText.push(new FloatingText(x, y, text, color, life, size));
  }

  spawnRing(x: number, y: number, radius: number, color: string): void {
    this.rings.push({ x, y, radius: 0, maxRadius: radius, color, life: 0.3, maxLife: 0.3, active: true });
  }

  spawnBeam(x1: number, y1: number, x2: number, y2: number, color: string, life = 0.18): void {
    this.beams.push({ fromX: x1, fromY: y1, toX: x2, toY: y2, color, life, maxLife: life, active: true });
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
