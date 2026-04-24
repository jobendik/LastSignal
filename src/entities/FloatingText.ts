import { Vector2 } from "../core/Vector2";

export class FloatingText {
  pos: Vector2;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  active = true;
  vy = -30;
  size: number;

  constructor(x: number, y: number, text: string | number, color: string, life = 1, size = 14) {
    this.pos = new Vector2(x, y);
    this.text = String(text);
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
  }
}
