import type { Fn, LineSpec, Point } from "./spec";
import { clean } from "./components/format";

/** Exact function families: evaluation, natural domain, and the features a
 * lesson names (zeros, vertex, intercepts, asymptotes, holes), computed from
 * the formula rather than from samples. */

const horner = (c: readonly number[], x: number) =>
  c.reduceRight((acc, a) => acc * x + a, 0);
const trim = (c: readonly number[]) => {
  const out = [...c];
  while (out.length > 1 && out.at(-1) === 0) out.pop();
  return out;
};
const derivative = (c: readonly number[]) =>
  c.slice(1).map((a, i) => a * (i + 1));

export function evaluate(fn: Fn, x: number): number {
  switch (fn.f) {
    case "poly":
      return horner(fn.c, x);
    case "rational": {
      const d = horner(fn.den, x);
      return d === 0 ? NaN : horner(fn.num, x) / d;
    }
    case "exp":
      return fn.a * fn.b ** (x - (fn.h ?? 0)) + (fn.k ?? 0);
    case "log": {
      const u = x - (fn.h ?? 0);
      return u <= 0
        ? NaN
        : (fn.a * Math.log(u)) / Math.log(fn.base) + (fn.k ?? 0);
    }
    case "sin":
    case "cos":
    case "tan": {
      const u = fn.b * (x - (fn.h ?? 0));
      const v =
        fn.f === "sin"
          ? Math.sin(u)
          : fn.f === "cos"
            ? Math.cos(u)
            : Math.tan(u);
      return fn.a * v + (fn.k ?? 0);
    }
    case "abs":
      return fn.a * Math.abs(x - (fn.h ?? 0)) + (fn.k ?? 0);
    case "sqrt": {
      const u = x - (fn.h ?? 0);
      return u < 0 ? NaN : fn.a * Math.sqrt(u) + (fn.k ?? 0);
    }
  }
}

/** Real roots of a polynomial in [lo, hi]: closed form to degree 2, then
 * bracketing between critical points (which finds every simple and
 * even-multiplicity root). */
export function polyRoots(
  c: readonly number[],
  lo: number,
  hi: number,
): number[] {
  const p = trim(c);
  const deg = p.length - 1;
  const inside = (r: number) => r >= lo - 1e-9 && r <= hi + 1e-9;
  if (deg <= 0) return [];
  if (deg === 1) return [-p[0]! / p[1]!].filter(inside).map(clean);
  if (deg === 2) {
    const [c0, b, a] = p as [number, number, number];
    const disc = b * b - 4 * a * c0;
    if (disc < -1e-12) return [];
    if (Math.abs(disc) <= 1e-12)
      return [-b / (2 * a)].filter(inside).map(clean);
    const q = -0.5 * (b + Math.sign(b || 1) * Math.sqrt(disc));
    return [q / a, c0 / q]
      .filter(inside)
      .sort((x, y) => x - y)
      .map(clean);
  }
  const critical = polyRoots(derivative(p), lo, hi);
  const knots = [lo, ...critical, hi];
  const roots: number[] = [];
  for (let i = 0; i + 1 < knots.length; i++) {
    const a = knots[i]!,
      b = knots[i + 1]!;
    const fa = horner(p, a),
      fb = horner(p, b);
    if (Math.abs(fa) < 1e-10) roots.push(a);
    if (fa * fb < 0) roots.push(bisect((x) => horner(p, x), a, b));
  }
  if (Math.abs(horner(p, hi)) < 1e-10) roots.push(hi);
  return [...new Set(roots.map(clean))].sort((x, y) => x - y);
}
export function bisect(f: (x: number) => number, a: number, b: number) {
  let fa = f(a);
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2,
      fm = f(m);
    if (fm === 0) return m;
    if (fa * fm < 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

export type Features = {
  zeros: Point[];
  yint: Point | null;
  vertex: Point | null;
  /** Vertical asymptotes x = a, horizontal y = b, slant y = mx + b. */
  vertical: number[];
  horizontal: number | null;
  slant: { m: number; b: number } | null;
  holes: Point[];
  /** Interior breaks where the graph must not be joined. */
  breaks: number[];
  /** The natural domain, intersected with the window. */
  domain: [number, number] | null;
};

/** Divide polynomials: quotient and remainder (for slant asymptotes). */
function divide(n: readonly number[], d: readonly number[]) {
  const num = trim(n),
    den = trim(d);
  const q = new Array(Math.max(1, num.length - den.length + 1)).fill(0);
  const r = [...num];
  for (let i = num.length - den.length; i >= 0; i--) {
    const coef = r[i + den.length - 1]! / den.at(-1)!;
    q[i] = coef;
    for (let j = 0; j < den.length; j++) r[i + j]! -= coef * den[j]!;
  }
  return { q: trim(q), r: trim(r.slice(0, den.length - 1)) };
}

export function features(fn: Fn, x0: number, x1: number): Features {
  const out: Features = {
    zeros: [],
    yint: null,
    vertex: null,
    vertical: [],
    horizontal: null,
    slant: null,
    holes: [],
    breaks: [],
    domain: [x0, x1],
  };
  const h = "h" in fn ? (fn.h ?? 0) : 0,
    k = "k" in fn ? (fn.k ?? 0) : 0;
  switch (fn.f) {
    case "poly": {
      const p = trim(fn.c);
      out.zeros = polyRoots(p, x0, x1).map((x) => [x, 0]);
      if (p.length === 3) {
        const vx = -p[1]! / (2 * p[2]!);
        out.vertex = [clean(vx), clean(horner(p, vx))];
      }
      break;
    }
    case "rational": {
      const denRoots = polyRoots(fn.den, x0, x1);
      for (const r of denRoots) {
        // A shared root cancels: a hole if the reduced function is finite.
        const nv = horner(fn.num, r);
        if (Math.abs(nv) < 1e-9) {
          const e = 1e-6;
          const y = (evaluate(fn, r - e) + evaluate(fn, r + e)) / 2;
          if (Number.isFinite(y) && Math.abs(y) < 1e6)
            out.holes.push([r, clean(y)]);
          else out.vertical.push(r);
        } else out.vertical.push(r);
      }
      out.breaks = denRoots;
      out.zeros = polyRoots(fn.num, x0, x1)
        .filter((r) => !denRoots.some((d) => Math.abs(d - r) < 1e-9))
        .map((x) => [x, 0]);
      const n = trim(fn.num),
        d = trim(fn.den);
      if (n.length < d.length) out.horizontal = 0;
      else if (n.length === d.length)
        out.horizontal = clean(n.at(-1)! / d.at(-1)!);
      else if (n.length === d.length + 1) {
        const { q } = divide(n, d);
        out.slant = { m: clean(q[1] ?? 0), b: clean(q[0] ?? 0) };
      }
      break;
    }
    case "exp": {
      out.horizontal = k;
      // a·b^(x−h) = −k
      const t = -k / fn.a;
      if (t > 0) {
        const x = h + Math.log(t) / Math.log(fn.b);
        if (x >= x0 && x <= x1) out.zeros = [[clean(x), 0]];
      }
      break;
    }
    case "log": {
      out.vertical = h >= x0 && h <= x1 ? [h] : [];
      out.domain = h >= x1 ? null : [Math.max(x0, h), x1];
      const x = h + fn.base ** (-k / fn.a);
      if (x >= x0 && x <= x1) out.zeros = [[clean(x), 0]];
      break;
    }
    case "sqrt": {
      out.domain = h > x1 ? null : [Math.max(x0, h), x1];
      if (h >= x0) out.vertex = [h, k];
      const t = -k / fn.a;
      if (t >= 0 && h + t * t <= x1) out.zeros = [[clean(h + t * t), 0]];
      break;
    }
    case "abs": {
      out.vertex = [h, k];
      out.breaks = [];
      const t = -k / fn.a;
      if (t > 0)
        out.zeros = [h - t, h + t]
          .filter((x) => x >= x0 && x <= x1)
          .map((x) => [clean(x), 0]);
      else if (t === 0) out.zeros = [[h, 0]];
      break;
    }
    case "sin":
    case "cos":
    case "tan": {
      const period = (fn.f === "tan" ? Math.PI : 2 * Math.PI) / Math.abs(fn.b);
      if (fn.f === "tan") {
        // b(x − h) = π/2 + nπ
        const first = Math.ceil(
          ((x0 - h) * Math.abs(fn.b) - Math.PI / 2) / Math.PI,
        );
        for (let n = first; ; n++) {
          const x = h + (Math.PI / 2 + n * Math.PI) / Math.abs(fn.b);
          if (x > x1) break;
          if (x >= x0) out.vertical.push(clean(x));
        }
        out.breaks = out.vertical;
      }
      // Zeros: sign changes, refined, between samples a tenth of a period apart.
      const f = (x: number) => evaluate(fn, x);
      const n = Math.min(4000, Math.ceil(((x1 - x0) / period) * 40) + 2);
      for (let i = 0; i < n; i++) {
        const a = x0 + ((x1 - x0) * i) / n,
          b = x0 + ((x1 - x0) * (i + 1)) / n;
        const fa = f(a),
          fb = f(b);
        if (out.breaks.some((v) => v >= a && v <= b)) continue;
        if (fa === 0) out.zeros.push([clean(a), 0]);
        else if (fa * fb < 0) out.zeros.push([clean(bisect(f, a, b)), 0]);
      }
      break;
    }
  }
  const y0 = evaluate(fn, 0);
  if (0 >= x0 && 0 <= x1 && Number.isFinite(y0)) out.yint = [0, clean(y0)];
  out.vertical.sort((a, b) => a - b);
  return out;
}

/** Sample a curve adaptively in screen space: subdivide wherever the chord
 * misses the midpoint by more than `tolerance` pixels. Returns pieces split
 * at breaks and at any non-finite value. */
export function sample(
  f: (x: number) => number,
  lo: number,
  hi: number,
  toScreen: (x: number, y: number) => [number, number],
  breaks: number[] = [],
  tolerance = 0.25,
): Point[][] {
  const interior = breaks.filter((b) => b > lo && b < hi).sort((a, b) => a - b);
  const edges = [lo, ...interior, hi];
  const eps = 1e-7 * (hi - lo);
  const pieces: Point[][] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    // Stay just clear of a break so a piece approaches it but never joins.
    const a = edges[i]! + (i > 0 ? eps : 0),
      b = edges[i + 1]! - (i + 1 < edges.length - 1 ? eps : 0);
    if (b <= a) continue;
    let current: Point[] = [];
    const n = 48;
    const flush = () => {
      if (current.length > 1) pieces.push(current);
      current = [];
    };
    const refine = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      depth: number,
    ) => {
      const xm = (x1 + x2) / 2,
        ym = f(xm);
      if (
        depth < 14 &&
        Number.isFinite(ym) &&
        Number.isFinite(y1) &&
        Number.isFinite(y2)
      ) {
        const [sx1, sy1] = toScreen(x1, y1),
          [sx2, sy2] = toScreen(x2, y2),
          [sxm, sym] = toScreen(xm, ym);
        const off =
          Math.abs((sx2 - sx1) * (sy1 - sym) - (sx1 - sxm) * (sy2 - sy1)) /
          (Math.hypot(sx2 - sx1, sy2 - sy1) || 1);
        // Steep runs far outside the window still subdivide, to find where they exit.
        if (off > tolerance || Math.abs(sy2 - sy1) > 40) {
          refine(x1, y1, xm, ym, depth + 1);
          refine(xm, ym, x2, y2, depth + 1);
          return;
        }
      }
      if (!Number.isFinite(y2)) flush();
      else current.push([x2, y2]);
    };
    let px = a,
      py = f(a);
    if (Number.isFinite(py)) current.push([px, py]);
    for (let j = 1; j <= n; j++) {
      const x = a + ((b - a) * j) / n,
        y = f(x);
      if (Number.isFinite(py) || Number.isFinite(y)) refine(px, py, x, y, 0);
      if (!Number.isFinite(y)) flush();
      px = x;
      py = y;
    }
    flush();
  }
  return pieces;
}

/** Clip a polyline to a rectangle, splitting it where it leaves. */
export function clipPolyline(
  points: Point[],
  [x0, x1]: [number, number],
  [y0, y1]: [number, number],
): Point[][] {
  const out: Point[][] = [];
  let current: Point[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i]!,
      [bx, by] = points[i + 1]!;
    let t0 = 0,
      t1 = 1;
    const dx = bx - ax,
      dy = by - ay;
    let visible = true;
    for (const [p, q] of [
      [-dx, ax - x0],
      [dx, x1 - ax],
      [-dy, ay - y0],
      [dy, y1 - ay],
    ] as const) {
      if (p === 0) {
        if (q < 0) visible = false;
      } else {
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r);
        else t1 = Math.min(t1, r);
      }
    }
    if (!visible || t0 > t1) {
      if (current.length > 1) out.push(current);
      current = [];
      continue;
    }
    const start: Point = [ax + t0 * dx, ay + t0 * dy],
      end: Point = [ax + t1 * dx, ay + t1 * dy];
    if (!current.length) current.push(start);
    current.push(end);
    if (t1 < 1) {
      out.push(current);
      current = [];
    }
  }
  if (current.length > 1) out.push(current);
  return out;
}

/** Sutherland–Hodgman: clip a convex or concave polygon to a half-plane
 * a·x + b·y ≤ c. */
export function clipHalfPlane(
  poly: Point[],
  a: number,
  b: number,
  c: number,
): Point[] {
  const out: Point[] = [];
  const inside = (p: Point) => a * p[0] + b * p[1] <= c + 1e-12;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!,
      q = poly[(i + 1) % poly.length]!;
    const pin = inside(p),
      qin = inside(q);
    if (pin) out.push(p);
    if (pin !== qin) {
      const fp = a * p[0] + b * p[1] - c,
        fq = a * q[0] + b * q[1] - c;
      const t = fp / (fp - fq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

/** Any line spec as a·x + b·y = c. */
export function lineCoefficients(l: LineSpec): {
  a: number;
  b: number;
  c: number;
} {
  if ("m" in l) return { a: -l.m, b: 1, c: l.b };
  if ("x" in l) return { a: 1, b: 0, c: l.x };
  if ("through" in l) {
    const [[x1, y1], [x2, y2]] = l.through;
    return { a: y2 - y1, b: x1 - x2, c: (y2 - y1) * x1 + (x1 - x2) * y1 };
  }
  return l;
}
/** The visible piece of a line inside a window, or null. */
export function lineInWindow(
  l: LineSpec,
  xr: [number, number],
  yr: [number, number],
): [Point, Point] | null {
  const { a, b, c } = lineCoefficients(l);
  const far = 1e4 * (xr[1] - xr[0] + yr[1] - yr[0]);
  const p: Point[] =
    Math.abs(b) > 1e-12
      ? [
          [xr[0] - far, (c - a * (xr[0] - far)) / b],
          [xr[1] + far, (c - a * (xr[1] + far)) / b],
        ]
      : [
          [c / a, yr[0] - far],
          [c / a, yr[1] + far],
        ];
  const clipped = clipPolyline(p, xr, yr);
  return clipped[0] ? [clipped[0][0]!, clipped[0].at(-1)!] : null;
}
