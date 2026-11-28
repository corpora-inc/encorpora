/** SVG helpers for the crane pieces. Everything is painted with the theme's roles (theme.css), never a color literal. */

export const SVG_NS = "http://www.w3.org/2000/svg";
export type Pt = [number, number];

export function el<K extends keyof SVGElementTagNameMap>(tag: K, parent: Element, attrs: Record<string, string | number> = {}, cls?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  if (cls) node.setAttribute("class", cls);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.appendChild(node);
  return node;
}

export const set = (node: Element, attrs: Record<string, string | number>) => {
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
};

/** A text element; `anchor` start, middle or end. */
export function text(parent: Element, x: number, y: number, s: string, cls: string, anchor: "start" | "middle" | "end" = "start") {
  const t = el("text", parent, { x, y, "text-anchor": anchor }, cls);
  t.textContent = s;
  return t;
}

export const pts = (list: readonly Pt[]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

/** 18000 reads 18,000. */
export const lb = (n: number) => Math.round(n).toLocaleString("en-US");

export function roundRect(x: number, y: number, w: number, h: number, r: number) {
  const q = Math.min(r, w / 2, h / 2);
  return `M${x + q},${y}h${w - 2 * q}a${q},${q} 0 0 1 ${q},${q}v${h - 2 * q}a${q},${q} 0 0 1 ${-q},${q}h${-(w - 2 * q)}a${q},${q} 0 0 1 ${-q},${-q}v${-(h - 2 * q)}a${q},${q} 0 0 1 ${q},${-q}z`;
}

/** An arrowhead at `tip`, pointing from `from`, `size` px long. */
export function arrowHead(tip: Pt, from: Pt, size: number): string {
  const dx = tip[0] - from[0], dy = tip[1] - from[1];
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const bx = tip[0] - ux * size, by = tip[1] - uy * size;
  const w = size * 0.42;
  return `M${tip[0]},${tip[1]}L${bx - uy * w},${by + ux * w}L${bx + uy * w},${by - ux * w}z`;
}

/** Opacity and visibility together: a part at 0 takes no paint and no ink box. */
export function fade(node: SVGElement, o: number) {
  node.style.opacity = o >= 0.999 ? "" : String(Math.max(0, o));
  node.style.visibility = o <= 0.002 ? "hidden" : "";
}

/** Width of an SVG text at its current font, in px (0 before fonts are ready). */
export function textWidth(t: SVGTextElement): number {
  try {
    return t.getComputedTextLength();
  } catch {
    return 0;
  }
}
