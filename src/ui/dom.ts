/**
 * Small helpers for building DOM nodes fluently and safely.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs?: Partial<Record<string, string>> & { class?: string }, children?: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class')     e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) {
        (e as unknown as Record<string, unknown>)[k] = v;
      } else {
        e.setAttribute(k, v);
      }
    }
  }
  if (children) {
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
  }
  return e;
}

export function clearChildren(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
