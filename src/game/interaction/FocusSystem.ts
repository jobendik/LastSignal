import * as THREE from 'three';
import { Events } from '../../core/Events';
import { Config } from '../../app/config';
import { clamp, smoothstep } from '../../core/Math';

export interface FocusPose {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

/**
 * FocusSystem — smoothly animates the camera between discrete "focus poses"
 * (overview of the desk vs. close-up of a device) and emits focus events
 * so that the UI and interaction systems can respond.
 *
 * This is intentionally a finite-state animation (not a continuous orbit).
 * It keeps the experience polished and controlled, matching the
 * "fixed-camera hybrid" design direction from the brief.
 */
export class FocusSystem {
  private readonly overview: FocusPose;
  private currentFocusId: string | null = null;

  private startPos = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private startLook = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private transitionStart = 0;
  private transitionEnd = 0;
  private animating = false;

  private readonly tmpLook = new THREE.Vector3();
  private idleTime = 0;

  constructor(private readonly camera: THREE.Camera) {
    this.overview = {
      position: new THREE.Vector3(...Config.camera.overview.position),
      lookAt:   new THREE.Vector3(...Config.camera.overview.lookAt),
    };
    this.camera.position.copy(this.overview.position);
    this.camera.lookAt(this.overview.lookAt);
    this.targetPos.copy(this.overview.position);
    this.targetLook.copy(this.overview.lookAt);
  }

  get focusId(): string | null { return this.currentFocusId; }
  get isAnimating(): boolean { return this.animating; }

  focus(id: string, pose: FocusPose): void {
    if (this.currentFocusId === id) return;
    const prev = this.currentFocusId;
    if (prev) Events.emit('focus:exited', { id: prev });
    this.currentFocusId = id;
    this.setTarget(pose.position, pose.lookAt);
    Events.emit('focus:entered', { id });
  }

  unfocus(): void {
    if (!this.currentFocusId) return;
    const id = this.currentFocusId;
    this.currentFocusId = null;
    this.setTarget(this.overview.position, this.overview.lookAt);
    Events.emit('focus:exited', { id });
  }

  update(dt: number, now: number, reducedMotion: boolean): void {
    if (this.animating) {
      const span = this.transitionEnd - this.transitionStart;
      const t = span <= 0 ? 1 : clamp((now - this.transitionStart) / span, 0, 1);
      const e = smoothstep(0, 1, t);
      this.camera.position.lerpVectors(this.startPos, this.targetPos, e);
      this.tmpLook.lerpVectors(this.startLook, this.targetLook, e);
      this.camera.lookAt(this.tmpLook);
      if (t >= 1) this.animating = false;
    } else if (!this.currentFocusId && !reducedMotion) {
      // Gentle breathing sway when idle at overview
      this.idleTime += dt;
      const amp = Config.camera.idleSwayAmp;
      const sp = Config.camera.idleSwaySpeed;
      const sx = Math.sin(this.idleTime * sp) * amp;
      const sy = Math.sin(this.idleTime * sp * 1.3 + 1.1) * amp * 0.8;
      this.camera.position.x = this.targetPos.x + sx;
      this.camera.position.y = this.targetPos.y + sy;
      this.camera.lookAt(this.targetLook);
    }
  }

  private setTarget(pos: THREE.Vector3, look: THREE.Vector3): void {
    this.startPos.copy(this.camera.position);
    this.startLook.copy(this.targetLook); // continue from last lookAt
    this.targetPos.copy(pos);
    this.targetLook.copy(look);
    this.transitionStart = performance.now() / 1000;
    this.transitionEnd = this.transitionStart + Config.camera.focusDurationSec;
    this.animating = true;
  }
}
