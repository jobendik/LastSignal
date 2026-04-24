import { Vector2 } from "../core/Vector2";
import { rnd } from "../core/Random";

export class Particle {
  pos: Vector2;
  vel: Vector2;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  active = true;
  gravity = 0;

  constructor(x: number, y: number, color: string, opts: Partial<{
    speed: number; life: number; size: number; gravity: number; angle: number;
  }> = {}) {
    const speed = opts.speed ?? rnd(40, 120);
    const angle = opts.angle ?? rnd(0, Math.PI * 2);
    this.pos = new Vector2(x, y);
    this.vel = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.color = color;
    this.life = opts.life ?? rnd(0.3, 0.8);
    this.maxLife = this.life;
    this.size = opts.size ?? rnd(1.5, 3);
    this.gravity = opts.gravity ?? 0;
  }
}
