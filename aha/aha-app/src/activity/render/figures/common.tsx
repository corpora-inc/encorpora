import React, { useLayoutEffect, useRef, useState } from 'react';
import type { ColorToken } from '../../spec';

/** Server/test default; the browser measures the real width so text stays at true pixel size. */
export const DEFAULT_WIDTH = 560;
const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect;

export function useMeasuredWidth<T extends HTMLElement>(fallback = DEFAULT_WIDTH): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => { const w = Math.round(el.getBoundingClientRect().width); if (w > 0) setWidth(w); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Round number tick steps (1, 2, 2.5, 5 × 10^k) targeting ~`target` intervals. */
export function niceStep(span: number, target = 5): number {
  if (!(span > 0)) return 1;
  const raw = span / target, pow = 10 ** Math.floor(Math.log10(raw)), f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}
export function niceAxis(min: number, max: number, target = 5, step?: number) {
  if (max === min) { max = min + 1; }
  const s = step ?? niceStep(max - min, target);
  const lo = Math.floor(min / s + 1e-9) * s, hi = Math.ceil(max / s - 1e-9) * s;
  const ticks: number[] = [];
  for (let v = lo, i = 0; v <= hi + s * 1e-6 && i < 60; v = lo + s * ++i) ticks.push(+v.toPrecision(12));
  return { min: lo, max: hi, step: s, ticks };
}
export const fmt = (n: number) => {
  const r = +n.toPrecision(10);
  return Math.abs(r) >= 10000 ? r.toLocaleString('en-US') : String(r).replace('-', '−');
};

export const series = (c: ColorToken | undefined, i = 0) => `var(--ax-${c && c !== 'plain' ? c : (['teal', 'coral', 'blue', 'gold'] as const)[i % 4]})`;
export const tint = (c: ColorToken | undefined, i = 0) => `var(--ax-${c && c !== 'plain' ? c : (['teal', 'coral', 'blue', 'gold'] as const)[i % 4]}-tint)`;

/** Split a label into at most two lines that fit roughly `maxChars` each. */
export function wrapLabel(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1]!;
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + ' ' + w).length <= maxChars || lines.length === 2) lines[lines.length - 1] = cur + ' ' + w;
    else lines.push(w);
  }
  return lines.map(l => l.length > maxChars + 3 ? l.slice(0, maxChars) + '…' : l);
}

export interface SvgA11y { title: string; desc: string; interactive?: boolean }
let uid = 0;
/** Accessible SVG root: alt text becomes <title>/<desc>; interactive figures become labelled groups. */
export function A11ySvg({ title, desc, interactive, width, height, children, className, ...rest }: SvgA11y & React.SVGProps<SVGSVGElement> & { width: number; height: number }) {
  const [ids] = useState(() => { uid += 1; return { t: `ax-t${uid}`, d: `ax-d${uid}` }; });
  return (
    <svg className={`ax-svg ${className ?? ''}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      role={interactive ? 'group' : 'img'} aria-labelledby={ids.t} aria-describedby={ids.d} {...rest}>
      <title id={ids.t}>{title}</title>
      <desc id={ids.d}>{desc}</desc>
      {children}
    </svg>
  );
}

/** Keyboard + pointer activation for an SVG region. */
export function regionProps(label: string, selected: boolean, onSelect?: () => void) {
  if (!onSelect) return {};
  return {
    role: 'button', tabIndex: 0, 'aria-label': label, 'aria-pressed': selected,
    className: `ax-region${selected ? ' is-selected' : ''}`,
    onClick: onSelect,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } },
  } as const;
}

export interface TapInteraction { kind: 'tap'; selected?: string; onSelect: (region: string) => void }
export interface PlotInteraction { kind: 'plot'; point?: { x: number; y: number }; snap: { x: number; y: number }; onPlot: (p: { x: number; y: number }) => void }
/** Shade parts of a fraction model: the learner toggles parts (numbered across wholes, first to last). */
export interface ShadeInteraction { kind: 'shade'; shaded: readonly number[]; onToggle: (part: number) => void }
/** Put one point on a number line, on tick 0…ticks counted from its minimum. */
export interface PlaceInteraction { kind: 'place'; tick?: number; onPlace: (tick: number) => void }
export type FigureInteraction = TapInteraction | PlotInteraction | ShadeInteraction | PlaceInteraction;
