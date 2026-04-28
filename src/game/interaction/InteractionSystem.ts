import * as THREE from 'three';
import { Events } from '../../core/Events';
import { Config } from '../../app/config';
import type { InputManager } from '../../engine/InputManager';
import type { Interactable, ObjectRegistry } from './ObjectRegistry';

/**
 * InteractionSystem — per-frame raycasting + click dispatching.
 *
 * The system is click-to-interact only: hover surfaces a reticle highlight
 * and label, a primary click invokes Interactable.onClick. When the game
 * is paused, in a focus mode, or reading a document, the system can be
 * globally disabled via `setEnabled`.
 */
export class InteractionSystem {
  private readonly raycaster = new THREE.Raycaster();
  private hovered: Interactable | null = null;
  private prevLeft = false;
  private enabled = true;

  constructor(
    private readonly camera: THREE.Camera,
    private readonly input: InputManager,
    private readonly registry: ObjectRegistry,
  ) {
    this.raycaster.far = Config.interaction.maxRayDistance;
  }

  setEnabled(flag: boolean): void {
    this.enabled = flag;
    if (!flag) this.setHovered(null);
  }

  update(): void {
    if (!this.enabled) return;

    const targets = this.registry.raycastTargets();
    let nextHovered: Interactable | null = null;

    if (this.input.pointer.overCanvas && targets.length > 0) {
      this.raycaster.setFromCamera(
        new THREE.Vector2(this.input.pointer.x, this.input.pointer.y),
        this.camera,
      );
      const hits = this.raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        const it = this.registry.resolve(hits[0]!.object);
        if (it) nextHovered = it;
      }
    }

    this.setHovered(nextHovered);

    // Click edge detection — act on the transition down→up of left button
    // (click completes on release; pre-release cancels gracefully if pointer leaves).
    const left = this.input.buttons.left;
    if (!left && this.prevLeft && nextHovered) {
      try { nextHovered.onClick?.(); }
      catch (err) { console.error('[InteractionSystem] onClick threw', err); }
    }
    this.prevLeft = left;
  }

  private setHovered(next: Interactable | null): void {
    if (this.hovered === next) return;
    if (this.hovered) this.hovered.onHoverChange?.(false);
    this.hovered = next;
    if (this.hovered) this.hovered.onHoverChange?.(true);
    Events.emit('hover:changed', next
      ? {
          id: next.id,
          label: typeof next.label === 'function' ? next.label() : next.label,
          hint: typeof next.hint === 'function' ? next.hint() : next.hint,
        }
      : { id: null }
    );
  }

  currentHoverId(): string | null { return this.hovered?.id ?? null; }
}
