import * as THREE from 'three';
import type { InteractionKind } from '../../core/Types';

/**
 * An Interactable is a registered 3D object that the raycast system can
 * detect. Each one has a kind, a root object (root's userData.interactable
 * = this), hover/click handlers, and metadata for the HUD.
 */
export interface Interactable {
  id: string;
  kind: InteractionKind;
  label: string | (() => string);
  hint?: string | (() => string);
  /** Meshes that count as "hit targets" for raycasting. */
  hitTargets: THREE.Object3D[];
  /** Called when the interactable becomes/stops being hovered. */
  onHoverChange?(hovered: boolean): void;
  /** Called when the player primary-clicks. Return true if the click was handled. */
  onClick?(): boolean;
}

/**
 * ObjectRegistry — owns all interactables in the current scene. The raycast
 * system queries the aggregated hit-target list and resolves back to the
 * owning Interactable via a Map lookup.
 */
export class ObjectRegistry {
  private readonly byId = new Map<string, Interactable>();
  private readonly targetToId = new Map<THREE.Object3D, string>();

  register(it: Interactable): void {
    this.byId.set(it.id, it);
    for (const t of it.hitTargets) {
      this.targetToId.set(t, it.id);
      // Mark descendants too; raycast includes children by default
      t.traverse((child) => this.targetToId.set(child, it.id));
    }
  }

  unregister(id: string): void {
    const it = this.byId.get(id);
    if (!it) return;
    for (const t of it.hitTargets) {
      this.targetToId.delete(t);
      t.traverse((child) => this.targetToId.delete(child));
    }
    this.byId.delete(id);
  }

  resolve(obj: THREE.Object3D): Interactable | undefined {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      const id = this.targetToId.get(cur);
      if (id) return this.byId.get(id);
      cur = cur.parent;
    }
    return undefined;
  }

  get(id: string): Interactable | undefined { return this.byId.get(id); }

  all(): Interactable[] { return Array.from(this.byId.values()); }

  raycastTargets(): THREE.Object3D[] {
    // Return one root per Interactable; raycaster will recurse.
    const seen = new Set<THREE.Object3D>();
    const out: THREE.Object3D[] = [];
    for (const it of this.byId.values()) {
      for (const t of it.hitTargets) {
        if (!seen.has(t)) { seen.add(t); out.push(t); }
      }
    }
    return out;
  }

  clear(): void {
    this.byId.clear();
    this.targetToId.clear();
  }
}
