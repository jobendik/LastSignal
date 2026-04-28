/** Shared helpers for UI components. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: Partial<{ class: string; text: string; html: string; attrs: Record<string, string> }> = {},
  children?: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (opts.class) e.className = opts.class;
  if (opts.text != null) e.textContent = opts.text;
  if (opts.html != null) e.innerHTML = opts.html;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) e.setAttribute(k, v);
  if (children) for (const c of children) e.append(c as Node | string);
  return e;
}

export function clear(e: HTMLElement): void {
  while (e.firstChild) e.removeChild(e.firstChild);
}
