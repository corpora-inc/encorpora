import type { Element, Scene } from "./scene/spec";
import { scene as sceneOf } from "./scene/author";
import type { Random } from "./variation/axes";

/**
 * Shared exact pieces of the unit-circle reasoning families (HSF.TF.A.2,
 * HSF.TF.A.4): the real numbers a problem may use, their TeX and spoken
 * forms, and the unit-circle figure drawn from scene primitives (axes, the
 * circle, a travelled path that coils past one turn, labeled points, angle
 * arcs and guide segments). Every figure shows only what the prompt states.
 */

export const TAU = 2 * Math.PI;
/** A direction reduced to [0, 2π). */
export const norm = (a: number) => ((a % TAU) + TAU) % TAU;
/** The angle between two directions, in [0, π]. */
export function angularGap(a: number, b: number): number {
  const d = norm(a - b);
  return Math.min(d, TAU - d);
}
/** Distance from a direction to the nearest axis direction. */
export const axisGap = (a: number) => {
  const d = norm(a) % (Math.PI / 2);
  return Math.min(d, Math.PI / 2 - d);
};
/** Quadrant 1–4 of a direction that is not on an axis. */
export const quadrantOf = (a: number) =>
  Math.floor(norm(a) / (Math.PI / 2)) + 1;
export const roman = ["", "I", "II", "III", "IV"] as const;
export const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
export function shuffled<T>(r: Random, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
export const gcd = (a: number, b: number): number =>
  b ? gcd(b, a % b) : Math.abs(a);

/* ---------------------------------------------------------- π multiples */

/** p·π/q in TeX, reduced: "\\frac{5\\pi}{7}", "-\\pi", "2\\pi", "0". */
export function piTex(p: number, q = 1): string {
  if (p === 0) return "0";
  const g = gcd(p, q);
  const n = p / g,
    d = q / g;
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  const top = a === 1 ? "\\pi" : `${a}\\pi`;
  return d === 1 ? `${sign}${top}` : `${sign}\\frac{${top}}{${d}}`;
}
/** n/d in TeX, reduced: "\\frac{5}{14}", "-\\frac{3}{10}", "2". */
export function ratioTex(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  const a = n / g,
    b = d / g;
  if (b === 1) return String(a);
  return `${a < 0 ? "-" : ""}\\frac{${Math.abs(a)}}{${b}}`;
}
/** p·π/q as plain text for figures and spoken descriptions: "5π/7", "−π". */
export function piPlain(p: number, q = 1): string {
  if (p === 0) return "0";
  const g = gcd(p, q);
  const n = p / g,
    d = q / g;
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  const top = a === 1 ? "π" : `${a}π`;
  return d === 1 ? `${sign}${top}` : `${sign}${top}/${d}`;
}

/* ------------------------------------------- exact special-angle values */

const SIN_REF: Record<number, string> = {
  0: "0",
  2: "\\frac{1}{2}",
  3: "\\frac{\\sqrt{2}}{2}",
  4: "\\frac{\\sqrt{3}}{2}",
  6: "1",
};
/** sin(kπ/12) exactly, for k a multiple of 2 or 3. */
export function sinTwelfths(k: number): { value: number; tex: string } {
  const m = ((k % 24) + 24) % 24;
  const lower = m > 12;
  const half = lower ? m - 12 : m;
  const ref = half > 6 ? 12 - half : half;
  const tex = SIN_REF[ref];
  if (tex === undefined) throw new Error(`No exact sine for ${k}π/12`);
  return {
    value: Math.sin((k * Math.PI) / 12),
    tex: lower && tex !== "0" ? `-${tex}` : tex,
  };
}
/** cos(kπ/12) exactly, for k a multiple of 2 or 3. */
export const cosTwelfths = (k: number) => sinTwelfths(k + 6);
/** kπ/12 in TeX, reduced. */
export const twelfthsTex = (k: number) => piTex(k, 12);
export const twelfthsPlain = (k: number) => piPlain(k, 12);

/* ------------------------------------------------------ the real set T */

export type RealKind = "positive" | "negative" | "winding" | "pi-form";
export interface RealT {
  kind: RealKind;
  value: number;
  /** TeX of t: "3.8", "-2.4", "\\frac{5\\pi}{7}". */
  tex: string;
  /** TeX of |t|. */
  absTex: string;
  /** Plain text of t for figure titles: "3.8", "−2.4", "5π/7". */
  plain: string;
  /** Plain text of |t| for figure labels: "3.8", "5π/7". */
  absPlain: string;
  /** p and q of a π-form t = pπ/q. */
  pi?: { p: number; q: number };
}

/** Positive reals of one turn, each at least 0.3 from every axis direction. */
export const ONE_TURN = [
  0.4, 0.6, 0.8, 1.0, 1.2, 1.9, 2.1, 2.4, 2.7, 3.6, 3.8, 4.0, 4.3, 5.3, 5.6,
  5.9,
] as const;
export const WINDING = [7.0, 7.5, 8.5, 9.0, 10, 10.5, 12, 13] as const;
/** p·π/q with q in {5, 7, 9, 10, 12}, 1 ≤ |p| ≤ 2q, gcd(p, q) = 1, at least
 * 0.3 from every axis direction. Every twelfth p/12 in lowest terms sits
 * within 0.27 of an axis, so q = 12 contributes nothing. */
export const PI_FORMS: readonly { p: number; q: number }[] = [5, 7, 9, 10, 12]
  .flatMap((q) =>
    Array.from({ length: 4 * q + 1 }, (_, i) => i - 2 * q)
      .filter((p) => p !== 0 && gcd(p, q) === 1)
      .map((p) => ({ p, q })),
  )
  .filter(({ p, q }) => axisGap((p * Math.PI) / q) >= 0.3);

/** One decimal place below 10 (1.0, 4.0, 7.0, as listed), so "1.0 units"
 * reads as a measurement; 10, 12 and 13 stay whole. */
const decimalText = (v: number) =>
  Number.isInteger(v) && Math.abs(v) < 10 ? v.toFixed(1) : String(v);
const decimalTex = (v: number) => decimalText(v);
const decimalPlain = (v: number) => decimalText(Math.abs(v));
export function decimalReal(value: number, kind: RealKind): RealT {
  return {
    kind,
    value,
    tex: decimalTex(value),
    absTex: decimalTex(Math.abs(value)),
    plain: value < 0 ? `−${decimalText(-value)}` : decimalText(value),
    absPlain: decimalPlain(value),
  };
}
export function piReal(p: number, q: number): RealT {
  return {
    kind: "pi-form",
    value: (p * Math.PI) / q,
    tex: piTex(p, q),
    absTex: piTex(Math.abs(p), q),
    plain: piPlain(p, q),
    absPlain: piPlain(Math.abs(p), q),
    pi: { p, q },
  };
}
/** Every real of a kind, in a fixed order. */
export function realsOf(kind: RealKind): RealT[] {
  switch (kind) {
    case "positive":
      return ONE_TURN.map((v) => decimalReal(v, "positive"));
    case "negative":
      return ONE_TURN.map((v) => decimalReal(-v, "negative"));
    case "winding":
      return WINDING.flatMap((v) => [
        decimalReal(v, "winding"),
        decimalReal(-v, "winding"),
      ]);
    case "pi-form":
      return PI_FORMS.map(({ p, q }) => piReal(p, q));
  }
}
export const ALL_REALS: readonly RealT[] = (
  ["positive", "negative", "winding", "pi-form"] as const
).flatMap(realsOf);

/** The argument of a function in TeX: "\\cos 3.8", "\\cos(-2.4)",
 * "\\cos\\frac{5\\pi}{7}". */
export function fnAt(fn: "sin" | "cos" | "tan", t: RealT): string {
  if (t.value < 0) return `\\${fn}\\left(${t.tex}\\right)`;
  return t.pi ? `\\${fn}${t.tex}` : `\\${fn} ${t.tex}`;
}
/** Whole turns in |t| and what is left over, to two decimal places. */
export function turnsOf(t: RealT) {
  const abs = Math.abs(t.value);
  const turns = Math.floor(abs / TAU);
  const rest = abs - turns * TAU;
  return { turns, rest, restText: rest.toFixed(2) };
}
/** Whole degrees of t, for "about d°" context. */
export const degreesOf = (t: RealT) => Math.round((t.value * 180) / Math.PI);
/** "counterclockwise" for positive t, "clockwise" for negative. */
export const directionOf = (t: RealT) =>
  t.value > 0 ? "counterclockwise" : "clockwise";
/** How far a point is from each axis, in words a screen reader can use. */
export function nearWords(angle: number): string {
  const a = norm(angle) % (Math.PI / 2);
  if (a < Math.PI / 8) return "near the $x$-axis";
  if (a > (3 * Math.PI) / 8) return "near the $y$-axis";
  return "midway between the axes";
}

/* --------------------------------------------------- unit-circle figure */

type Ink = "ink" | "accent" | "warm" | "gold" | "muted";
export interface CirclePoint {
  id: string;
  angle: number;
  /** Bold math label beside the point; omitted when absent. */
  label?: string;
  color?: Ink;
}
export interface CircleArc {
  id: string;
  /** Signed angle in radians: positive turns counterclockwise. */
  to: number;
  /** Radius of the arc mark, in circle units (well inside the circle). */
  r: number;
  label: string;
  dash?: boolean;
  color?: Ink;
}
export interface UnitCircleOptions {
  /** Signed distance travelled from (1, 0); coils outward past one turn. */
  travel?: number;
  /** Angle the travelled path starts from, when not (1, 0). */
  travelFrom?: number;
  /** Label beside the travelled path (plain text). */
  travelLabel?: string;
  points?: CirclePoint[];
  arcs?: CircleArc[];
  /** Point ids joined to the origin by a dashed radius. */
  radii?: string[];
  /** Point id with a dashed perpendicular to the x-axis. */
  drop?: string;
  /** Label the start (1, 0); default true. */
  startLabel?: boolean;
  /** Label the origin O. */
  origin?: boolean;
  width?: number;
  maxHeight?: number;
  title?: string;
  note?: string;
}
const unitAt = (a: number, r = 1): [number, number] => [
  r * Math.cos(a),
  r * Math.sin(a),
];
const side = (v: number): -1 | 0 | 1 => (v > 0.3 ? -1 : v < -0.3 ? 1 : 0);
/** Label placements pointing away from the origin along `angle`. */
function outward(
  angle: number,
  d = 9,
): [number, number, -1 | 0 | 1, -1 | 0 | 1][] {
  const spot = (
    a: number,
    k: number,
  ): [number, number, -1 | 0 | 1, -1 | 0 | 1] => [
    Math.round(Math.cos(a) * k),
    Math.round(-Math.sin(a) * k),
    side(Math.cos(a)),
    -side(Math.sin(a)) as -1 | 0 | 1,
  ];
  return [
    spot(angle, d),
    spot(angle + 0.5, d),
    spot(angle - 0.5, d),
    spot(angle, d + 12),
    spot(angle + 1, d + 6),
    spot(angle - 1, d + 6),
  ];
}
/** Points along a path from (1, 0) travelling a signed distance t, on a
 * radius that grows a little each turn so later turns sit outside earlier
 * ones. */
export function travelPath(t: number, from = 0): [number, number][] {
  const steps = Math.max(8, Math.ceil(Math.abs(t) / 0.04));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const s = (Math.abs(t) * i) / steps;
    const rho = 1.13 + (0.1 * s) / TAU;
    return unitAt(from + Math.sign(t) * s, rho);
  });
}
const round = (p: [number, number]): [number, number] => [
  Math.round(p[0] * 1e6) / 1e6,
  Math.round(p[1] * 1e6) / 1e6,
];

/** Axes, the unit circle, (1, 0), and whatever the options add. */
export function unitCircleScene(o: UnitCircleOptions): Scene {
  const els: Element[] = [
    {
      type: "segment",
      id: "xaxis",
      from: [-1.42, 0],
      to: [1.42, 0],
      arrow: "both",
      stroke: "ink",
      width: 1.5,
    },
    {
      type: "segment",
      id: "yaxis",
      from: [0, -1.42],
      to: [0, 1.42],
      arrow: "both",
      stroke: "ink",
      width: 1.5,
    },
    {
      type: "text",
      id: "xname",
      at: [1.42, 0],
      text: "x",
      font: "math",
      offset: [6, 0],
      align: [-1, 0],
    },
    {
      type: "text",
      id: "yname",
      at: [0, 1.42],
      text: "y",
      font: "math",
      offset: [0, -6],
      align: [0, 1],
    },
    {
      type: "circle",
      id: "circle",
      center: [0, 0],
      r: 1,
      stroke: "accent",
      width: 2.25,
    },
    { type: "point", id: "start", at: [1, 0], r: 3.5, color: "ink" },
  ];
  if (o.startLabel !== false)
    els.push({
      type: "text",
      id: "startname",
      at: [1, 0],
      text: "(1, 0)",
      font: "math",
      size: "sm",
      halo: true,
      place: [
        [6, 7, -1, -1],
        [6, -7, -1, 1],
        [-6, 7, 1, -1],
      ],
    });
  if (o.origin)
    els.push({
      type: "text",
      id: "origin",
      at: [0, 0],
      text: "O",
      font: "math",
      size: "sm",
      place: [
        [-5, 5, 1, -1],
        [5, 5, -1, -1],
        [-5, -5, 1, 1],
      ],
    });
  const points = o.points ?? [];
  const byId = new Map(points.map((p) => [p.id, p]));
  for (const id of o.radii ?? []) {
    const p = byId.get(id)!;
    els.push({
      type: "segment",
      id: `${id}radius`,
      from: [0, 0],
      to: round(unitAt(p.angle)),
      stroke: "muted",
      width: 1.5,
      dash: "dash",
    });
  }
  if (o.drop) {
    const p = byId.get(o.drop)!;
    const [x, y] = round(unitAt(p.angle));
    els.push({
      type: "segment",
      id: "drop",
      from: [x, y],
      to: [x, 0],
      stroke: "muted",
      width: 1.5,
      dash: "dash",
    });
  }
  for (const a of o.arcs ?? []) {
    const color = a.color ?? "gold";
    els.push({
      type: "arc",
      id: a.id,
      center: [0, 0],
      r: a.r,
      from: 0,
      to: Math.round(((a.to * 180) / Math.PI) * 1000) / 1000,
      stroke: color,
      width: 1.75,
      arrow: "end",
      ...(a.dash ? { dash: "dash" as const } : {}),
    });
    const mid = a.to / 2;
    els.push({
      type: "text",
      id: `${a.id}name`,
      at: round(unitAt(mid, a.r)),
      text: a.label,
      font: "math",
      size: "sm",
      color,
      halo: true,
      place: outward(mid, 7),
    });
  }
  if (o.travel !== undefined && o.travel !== 0) {
    const from = o.travelFrom ?? 0;
    const path = travelPath(o.travel, from).map(round);
    els.push({
      type: "polyline",
      id: "travel",
      points: path,
      stroke: "warm",
      width: 2.5,
    });
    els.push({
      type: "segment",
      id: "travelhead",
      from: path[path.length - 3]!,
      to: path[path.length - 1]!,
      stroke: "warm",
      width: 2.5,
      arrow: "end",
    });
    if (o.travelLabel) {
      const abs = Math.abs(o.travel);
      const last = Math.min(abs, TAU);
      const s = abs - last / 2;
      const angle = from + Math.sign(o.travel) * s;
      els.push({
        type: "text",
        id: "travelname",
        at: round(unitAt(angle, 1.13 + (0.1 * s) / TAU)),
        text: o.travelLabel,
        font: "sans",
        size: "sm",
        color: "warm",
        halo: true,
        place: outward(angle, 8),
      });
    }
  }
  for (const p of points) {
    els.push({
      type: "point",
      id: p.id,
      at: round(unitAt(p.angle)),
      r: 5,
      color: p.color ?? "warm",
    });
    if (p.label)
      els.push({
        type: "text",
        id: `${p.id}name`,
        at: round(unitAt(p.angle)),
        text: p.label,
        font: "math",
        bold: true,
        color: p.color ?? "warm",
        halo: true,
        place: outward(p.angle, 9),
      });
  }
  return sceneOf(...els).build({
    width: o.width ?? 330,
    maxHeight: o.maxHeight ?? 330,
    ...(o.title ? { title: o.title } : {}),
    ...(o.note ? { note: o.note } : {}),
  });
}
