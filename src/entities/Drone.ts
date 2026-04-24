import { Vector2 } from "../core/Vector2";
import type { DroneDefinition, DroneType } from "../core/Types";
import { droneDefinitions } from "../data/drones";
import { rnd } from "../core/Random";

/** Runtime drone. Behavior runs in DroneSystem. */
export class Drone {
  type: DroneType;
  def: DroneDefinition;
  pos: Vector2;
  vel = new Vector2();
  acc = new Vector2();
  angle = 0;
  maxSpeed: number;
  maxForce = 250;
  range: number;
  damage: number;
  cooldown: number;
  color: string;
  timer = 0;
  wanderAngle = rnd(0, Math.PI * 2);
  active = true;

  // Guardian: orbit angle around core.
  orbit = rnd(0, Math.PI * 2);

  constructor(type: DroneType, x: number, y: number) {
    const def = droneDefinitions[type];
    this.type = type;
    this.def = def;
    this.pos = new Vector2(x, y);
    this.maxSpeed = def.speed;
    this.range = def.range;
    this.damage = def.damage;
    this.cooldown = def.cooldown;
    this.color = def.color;
  }
}
