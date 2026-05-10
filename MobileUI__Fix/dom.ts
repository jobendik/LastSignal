// Tiny DOM helpers used by the mobile UI module.
// Kept self-contained to avoid clashing with any existing src/ui/dom.ts helper.
// If the project already exposes `el` and `clear` from "../dom", delete this file
// and update the three mobile UI files to import from "../dom" instead.

type ElAttrs = Partial<{
  class: string;
  text: string;
  id: string;
  title: string;
  type: string;
  href: string;
  src: string;
  alt: string;
  role: string;
  ariaLabel: string;
}>;

/** Tiny helper: create an HTMLElement of `tag` with attributes and child nodes. */
export function el(
  tag: keyof HTMLElementTagNameMap,
  attrs: ElAttrs = {},
  children: (Node | string)[] = [],
): HTMLElement {
  const node = document.createElement(tag);
  if (attrs.class) node.className = attrs.class;
  if (attrs.id) node.id = attrs.id;
  if (attrs.text !== undefined) node.textContent = attrs.text;
  if (attrs.title) node.title = attrs.title;
  if (attrs.type) (node as HTMLInputElement | HTMLButtonElement).type = attrs.type as never;
  if (attrs.href) (node as HTMLAnchorElement).href = attrs.href;
  if (attrs.src) (node as HTMLImageElement).src = attrs.src;
  if (attrs.alt) (node as HTMLImageElement).alt = attrs.alt;
  if (attrs.role) node.setAttribute("role", attrs.role);
  if (attrs.ariaLabel) node.setAttribute("aria-label", attrs.ariaLabel);
  for (const c of children) node.append(c);
  return node;
}

/** Remove all children of `host`. */
export function clear(host: HTMLElement): void {
  while (host.firstChild) host.removeChild(host.firstChild);
}
