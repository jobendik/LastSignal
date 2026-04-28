import { el } from './dom';
import type { DocumentData } from '../core/Types';
import { Events } from '../core/Events';

/**
 * DocumentView — full-screen paper reader. Created & closed on demand.
 * Marks the document as read when opened.
 */
export class DocumentView {
  private root: HTMLDivElement | null = null;
  private readonly onKey: (e: KeyboardEvent) => void;

  constructor(private readonly mount: HTMLElement) {
    this.onKey = (e: KeyboardEvent) => {
      if (!this.root) return;
      if (e.code === 'Escape' || e.code === 'KeyF' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.close();
      }
    };
  }

  open(doc: DocumentData): void {
    this.close();
    const children: Node[] = [];
    if (doc.stamp) children.push(el('div', { class: 'stamp' }, [doc.stamp]));
    children.push(el('h1', {}, [doc.title]));
    if (doc.meta) children.push(el('div', { class: 'meta' }, [doc.meta]));
    children.push(el('div', { class: 'body' }, [doc.body]));
    if (doc.signature) children.push(el('div', { class: 'signature' }, [doc.signature]));
    children.push(el('div', { class: 'close-hint' }, ['ESC — Close']));

    this.root = el('div', { class: 'doc-view' }, [
      el('div', { class: 'paper' }, children),
    ]);
    this.root.addEventListener('click', (e) => {
      // Click outside paper closes
      if (e.target === this.root) this.close();
    });
    this.mount.appendChild(this.root);
    window.addEventListener('keydown', this.onKey, { capture: true });

    Events.emit('document:read', { id: doc.id });
  }

  close(): void {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
    window.removeEventListener('keydown', this.onKey, { capture: true } as EventListenerOptions);
  }

  dispose(): void { this.close(); }

  get isOpen(): boolean { return this.root !== null; }
}
