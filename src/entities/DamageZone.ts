import { Vector2 } from "../core/Vector2";

/** Short-lived burning ground / corruption field that deals damage over time. */
export class DamageZone {
  pos: Vector2;
  radius: number;
  dps: number;
  life: number;
  maxLife: number;
  color: string;
  active = true;
  tickTimer = 0;
  tickInterval = 0.25;

  constructor(x: number, y: number, radius: number, dps: number, life: number, color = "#ff8a00") {
    this.pos = new Vector2(x, y);
    this.radius = radius;
    this.dps = dps;
    this.life = life;
    this.maxLife = life;
    this.color = color;
  }
}
