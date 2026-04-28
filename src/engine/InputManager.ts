import { Events } from '../core/Events';

/**
 * InputManager centralises keyboard & mouse events and rebroadcasts them
 * through the global event bus or dedicated observer APIs. Pointer position
 * is tracked in normalized device coordinates for raycasting.
 */
export class InputManager {
  readonly pointer = { x: 0, y: 0, overCanvas: false };
  readonly buttons = { left: false, right: false };

  private readonly keys = new Set<string>();
  private readonly canvas: HTMLCanvasElement;
  private readonly keyHandlers = new Map<string, Set<() => boolean | void>>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener('keydown',  this.onKeyDown);
    window.addEventListener('keyup',    this.onKeyUp);
    window.addEventListener('blur',     this.onBlur);

    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup',   this.onPointerUp);
    canvas.addEventListener('pointerleave',this.onPointerLeave);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  isKeyDown(code: string): boolean { return this.keys.has(code); }

  /**
   * Register a keydown handler for a specific KeyboardEvent.code.
   * Return true from the handler to consume the key before global shortcuts
   * such as ESC→pause are processed.
   */
  onKey(code: string, handler: () => boolean | void): () => void {
    let bucket = this.keyHandlers.get(code);
    if (!bucket) { bucket = new Set(); this.keyHandlers.set(code, bucket); }
    bucket.add(handler);
    return () => bucket!.delete(handler);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup',   this.onKeyUp);
    window.removeEventListener('blur',    this.onBlur);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup',   this.onPointerUp);
    this.canvas.removeEventListener('pointerleave',this.onPointerLeave);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.keyHandlers.clear();
    this.keys.clear();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Ignore when typing in text inputs (future-proof for any inputs)
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    this.keys.add(e.code);

    // Local/context handlers get first refusal. This prevents ESC from both
    // closing a device/document and opening the pause menu in the same press.
    const bucket = this.keyHandlers.get(e.code);
    if (bucket) {
      for (const h of Array.from(bucket)) {
        if (h() === true) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // Global shortcuts
    if (e.code === 'Escape')      { Events.emit('ui:pauseToggle', {}); e.preventDefault(); }
    else if (e.code === 'Tab')    { Events.emit('ui:notebookToggle', {}); e.preventDefault(); }
    else if (e.code === 'F1' || e.code === 'Backquote') {
      Events.emit('ui:debugToggle', {}); e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.buttons.left = this.buttons.right = false;
  };

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointer.overCanvas = true;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button === 0) this.buttons.left = true;
    if (e.button === 2) this.buttons.right = true;
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.button === 0) this.buttons.left = false;
    if (e.button === 2) this.buttons.right = false;
  };

  private onPointerLeave = (): void => {
    this.pointer.overCanvas = false;
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };
}
