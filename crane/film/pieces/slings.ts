/**
 * Sling angle and load per leg: a load lifted from the hook by a two-leg
 * bridle, drawn to scale. Each leg's angle from the horizontal is an arc with
 * its degrees; the height H from the hook down to the attachment level and the
 * leg length L are dimensioned; the strip reads the angle, the angle factor
 * L ÷ H and the tension in each leg, (load ÷ legs) × (L ÷ H).
 *
 *   { "slings": { "load": 4000, "leg": 10, "angle": 30,
 *                 "readouts": ["angle", "factor", "tension"] } }
 *
 * The pick points on the load stay where they are; the angle is the value that
 * moves. Raising the angle raises the hook, so the legs grow longer (a longer
 * sling), H grows faster than L, and the tension falls. Spec: load (lb), legs
 * (2), angle (degrees from horizontal at the start, 15-80), and the spacing of
 * the pick points, either `spread` (ft between them) or `leg` (ft, each leg's
 * length at the starting angle: spread = 2 × leg × cos angle). With leg 10 at
 * 30°, H is 5 ft; at 60° the same pick points give H 15 ft and L 17.32 ft.
 *
 * Value (`set`): slings.angle (degrees; H = half-spread × tan angle and L =
 * half-spread ÷ cos angle follow). Parts: slings.hook, slings.legs,
 * slings.leg.1 (left), slings.leg.2 (right), slings.angle, slings.height,
 * slings.length, slings.load, slings.pull (faint arrows on the load: each leg's
 * inward pull, to scale with it; hidden until shown),
 * slings.readout.<angle|factor|tension>.
 */
import { arrowHead, el, fade, lb, roundRect, set, text, textWidth, type Pt } from "../draw";
import type { CraneTimeline } from "../timeline";
import { known, num, strs, type Piece, type PieceInit, type Spec } from "./piece";

const FIELDS = ["load", "legs", "angle", "spread", "leg", "readouts", "hidden"] as const;
const READOUTS = ["angle", "factor", "tension"] as const;
type Readout = (typeof READOUTS)[number];
const CAPTION: Record<Readout, string> = { angle: "Sling angle", factor: "Factor L ÷ H", tension: "Tension per leg" };

const W = 880, H_MAX = 880;
/** Above the hook (the hoist line) and the hook itself, in px; the strip. */
const LINE_MIN = 40, HOOK = 118, STRIP = 150, GAP = 34;
/** Room each side of the load for the dimensions, in px. */
const SIDE = 150;
const ARC = 78;
const rad = (d: number) => (d * Math.PI) / 180;
const mix = (base: string, lit: string, em: number) => (em <= 0.001 ? base : `color-mix(in srgb, ${lit} ${Math.round(em * 100)}%, ${base})`);
/** 8.66 reads 8.66, 5.0 reads 5. */
const ft = (x: number) => `${Number(x.toFixed(2))}`;

type Dim = { g: SVGGElement; line: SVGLineElement; a: SVGPathElement; b: SVGPathElement; e1: SVGLineElement; e2: SVGLineElement; pill: SVGPathElement; t: SVGTextElement };

export class SlingsPiece implements Piece {
  readonly w = W;
  readonly h: number;
  readonly parts: string[];
  readonly initial: Record<string, number>;
  readonly hidden: string[];
  private load: number;
  private legs: number;
  private a: number;
  private k: number;
  private cx: number;
  private y0: number;
  private readouts: Readout[];
  private g: {
    line: SVGLineElement; hook: SVGGElement; swivel: SVGPathElement; hookPath: SVGPathElement;
    legs: SVGLineElement[]; arcs: SVGPathElement[]; angleTexts: SVGTextElement[]; angle: SVGGElement;
    height: Dim; length: Dim; loadG: SVGGElement; loadBody: SVGPathElement; loadText: SVGTextElement;
    pull: SVGGElement; pulls: { line: SVGLineElement; head: SVGPathElement }[];
    cells: Map<Readout, { g: SVGGElement; bg: SVGPathElement; value: SVGTextElement; num: SVGTSpanElement; unit: SVGTSpanElement; cap: SVGTextElement }>;
  };
  private loadTopPx: number;
  private pullScale: number;

  constructor(spec: Spec, init: PieceInit) {
    const where = "crane.slings";
    const { issues, root } = init;
    known(spec, FIELDS, issues, where);
    this.load = num(spec, "load", 4000, issues, where);
    if (this.load <= 0) issues.push(`${where}.load must be more than zero.`);
    this.legs = num(spec, "legs", 2, issues, where);
    if (this.legs !== 2) { issues.push(`${where}.legs: only a two-leg bridle is drawn.`); this.legs = 2; }
    const angle = num(spec, "angle", 30, issues, where);
    if (spec.spread !== undefined && spec.leg !== undefined) issues.push(`${where}: give spread or leg, not both.`);
    const leg = num(spec, "leg", 10, issues, where);
    const spread = spec.spread !== undefined ? num(spec, "spread", 17.32, issues, where) : 2 * leg * Math.cos(rad(angle));
    if (!(spread > 0)) issues.push(`${where}: the pick points need a spread more than zero.`);
    this.a = Math.max(0.5, spread / 2);
    this.initial = { "slings.angle": angle };
    const ro = spec.readouts === undefined ? [...READOUTS] : strs(spec, "readouts", issues, where);
    this.readouts = ro.filter((r): r is Readout => {
      if ((READOUTS as readonly string[]).includes(r)) return true;
      issues.push(`${where}.readouts: "${r}" is not a readout (${READOUTS.join(", ")}).`);
      return false;
    });
    this.hidden = ["slings.pull", ...strs(spec, "hidden", issues, where)];

    const [lo, hi] = init.range("slings.angle", angle);
    if (lo < 15 || hi > 80) issues.push(`${where}: slings.angle runs from 15 to 80 degrees here (it is ${lo}..${hi}).`);
    const hiA = Math.min(80, Math.max(15, hi)), loA = Math.min(80, Math.max(15, lo));
    const a = this.a;
    const hMax = a * Math.tan(rad(hiA));
    // the load: wider than its pick points, its height in proportion
    const boxW = 2 * a + 3.2, boxH = Math.min(4.5, Math.max(2.4, 0.22 * 2 * a));
    const strip = this.readouts.length ? GAP + STRIP : 0;
    const top = LINE_MIN + HOOK;
    this.k = Math.min((H_MAX - top - strip) / (hMax + boxH), (W - 2 * SIDE) / boxW);
    const k = this.k;
    this.cx = W / 2;
    this.y0 = top + hMax * k;
    const loadBottom = this.y0 + boxH * k;
    this.h = loadBottom + strip;
    // the longest inward pull (the flattest angle) spans most of the way to the middle
    const pullMax = (this.load / this.legs) / Math.tan(rad(loA));
    this.pullScale = (a * k * 0.72) / pullMax;

    const cx = this.cx, y0 = this.y0;
    // hoist line and hook
    const line = el("line", root, { x1: cx, y1: 0, x2: cx, y2: 0 }, "cf-sl-rope");
    const hook = el("g", root);
    const swivel = el("path", hook, {}, "cf-sl-swivel");
    const hookPath = el("path", hook, {}, "cf-sl-hook");

    // the load and its pick points
    const loadG = el("g", root);
    this.loadTopPx = y0;
    const loadBody = el("path", loadG, { d: roundRect(cx - (boxW / 2) * k, y0, boxW * k, boxH * k, 10) }, "cf-load");
    for (const s of [-1, 1]) {
      const x = cx + s * a * k;
      el("path", loadG, { d: `M${x - 13},${y0}A13,13 0 0 1 ${x + 13},${y0}z` }, "cf-sl-lug");
    }
    const loadText = text(loadG, cx, y0 + boxH * k * 0.62 + 14, `${lb(this.load)} lb`, "cf-sl-load-text", "middle");

    // the inward pull on the load
    const pull = el("g", root);
    const pulls = [-1, 1].map(() => ({ line: el("line", pull, {}, "cf-sl-pull"), head: el("path", pull, {}, "cf-sl-pull-head") }));

    // legs, drawn over the lugs
    const legs = [el("line", root, {}, "cf-sl-leg"), el("line", root, {}, "cf-sl-leg")];

    // the angle at each pick point
    const angleG = el("g", root);
    const arcs = [el("path", angleG, {}, "cf-sl-arc"), el("path", angleG, {}, "cf-sl-arc")];
    const angleTexts = [text(angleG, 0, 0, "", "cf-sl-angle-text", "middle"), text(angleG, 0, 0, "", "cf-sl-angle-text", "middle")];

    const dim = (): Dim => {
      const g = el("g", root);
      const e1 = el("line", g, {}, "cf-dim-ext"), e2 = el("line", g, {}, "cf-dim-ext");
      const ln = el("line", g, {}, "cf-dim");
      const da = el("path", g, {}, "cf-dim-head"), db = el("path", g, {}, "cf-dim-head");
      const pill = el("path", g, {}, "cf-dim-pill");
      const t = text(g, 0, 0, "", "cf-sl-dim-text", "middle");
      return { g, line: ln, a: da, b: db, e1, e2, pill, t };
    };
    const height = dim(), length = dim();

    // the strip
    const cells = new Map<Readout, { g: SVGGElement; bg: SVGPathElement; value: SVGTextElement; num: SVGTSpanElement; unit: SVGTSpanElement; cap: SVGTextElement }>();
    if (this.readouts.length) {
      const st = loadBottom + GAP;
      const sg = el("g", root);
      el("path", sg, { d: roundRect(0, st, W, STRIP, 22) }, "cf-panel");
      const n = this.readouts.length, pad = 14;
      const cw = (W - pad * (n + 1)) / n;
      this.readouts.forEach((r, i) => {
        const g = el("g", sg);
        const x = pad + i * (cw + pad);
        const bg = el("path", g, { d: roundRect(x, st + pad, cw, STRIP - 2 * pad, 14) }, "cf-panel-cell");
        const cap = text(g, x + cw / 2, st + pad + 38, CAPTION[r].toUpperCase(), "cf-panel-cap", "middle");
        const value = text(g, x + cw / 2, st + STRIP - pad - 22, "", r === "tension" ? "cf-panel-value cf-panel-capacity" : "cf-panel-value", "middle");
        const numT = el("tspan", value);
        const unit = el("tspan", value, {}, "cf-sl-unit");
        cells.set(r, { g, bg, value, num: numT, unit, cap });
      });
    }

    this.g = { line, hook, swivel, hookPath, legs, arcs, angleTexts, angle: angleG, height, length, loadG, loadBody, loadText, pull, pulls, cells };
    this.parts = [
      "slings", "slings.hook", "slings.legs", "slings.leg.1", "slings.leg.2", "slings.angle", "slings.height", "slings.length", "slings.load", "slings.pull",
      "slings.readout", ...this.readouts.map((r) => `slings.readout.${r}`),
    ];
  }

  /** A dimension from p to q, offset by `off` (px, along n), its label in a pill at the middle. */
  private dim(d: Dim, p: Pt, q: Pt, n: Pt, off: number, label: string, ext: [number, number]) {
    const P: Pt = [p[0] + n[0] * off, p[1] + n[1] * off], Q: Pt = [q[0] + n[0] * off, q[1] + n[1] * off];
    set(d.line, { x1: P[0], y1: P[1], x2: Q[0], y2: Q[1] });
    set(d.a, { d: arrowHead(P, Q, 20) });
    set(d.b, { d: arrowHead(Q, P, 20) });
    set(d.e1, { x1: p[0] + n[0] * ext[0], y1: p[1] + n[1] * ext[0], x2: P[0] + n[0] * 12, y2: P[1] + n[1] * 12 });
    set(d.e2, { x1: q[0] + n[0] * ext[1], y1: q[1] + n[1] * ext[1], x2: Q[0] + n[0] * 12, y2: Q[1] + n[1] * 12 });
    d.t.textContent = label;
    const tw = (textWidth(d.t) || 19 * label.length) + 40;
    const m: Pt = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
    set(d.pill, { d: roundRect(m[0] - tw / 2, m[1] - 26, tw, 52, 26) });
    set(d.t, { x: m[0], y: m[1] + 14 });
    return tw;
  }

  draw(tl: CraneTimeline, t: number) {
    const { g, k, cx, y0, a } = this;
    const op = (name: string) => tl.opacity(name, t);
    const lit = (name: string) => tl.light(name, t);
    const deg = tl.value("slings.angle", t);
    const th = rad(deg);
    const H = a * Math.tan(th), L = a / Math.cos(th);
    const factor = L / H;
    const tension = (this.load / this.legs) * factor;
    const P: Pt = [cx, y0 - H * k];
    const lugs: Pt[] = [[cx - a * k, y0], [cx + a * k, y0]];

    // hoist line, swivel and hook: the bowl's bottom is where the legs meet
    const R = 24, neck = P[1] - 78;
    set(g.line, { y2: neck - 30 });
    set(g.swivel, { d: roundRect(cx - 17, neck - 32, 34, 34, 7) });
    set(g.hookPath, { d: `M${cx},${neck}V${neck + 22}C${cx - R * 1.5},${neck + 22 + R * 0.35} ${cx - R * 1.35},${P[1]} ${cx},${P[1]}C${cx + R},${P[1]} ${cx + R * 1.25},${P[1] - R * 0.9} ${cx + R},${P[1] - R * 1.45}` });
    const he = lit("slings.hook");
    g.hookPath.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", he);
    g.swivel.style.fill = mix("var(--cf-steel-dark)", "var(--cf-light)", he);
    fade(g.hook, op("slings.hook"));
    fade(g.line, op("slings.hook"));

    // legs
    g.legs.forEach((leg, i) => {
      const lug = lugs[i]!;
      set(leg, { x1: lug[0], y1: lug[1], x2: P[0], y2: P[1] });
      const em = Math.max(lit(`slings.leg.${i + 1}`), lit("slings.legs"));
      leg.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", em);
      leg.style.strokeWidth = String(6 + 4 * em);
      fade(leg, Math.min(op(`slings.leg.${i + 1}`), op("slings.legs")));
    });

    // the angle at each pick point, from the horizontal (toward the middle) up to the leg
    const ae = lit("slings.angle");
    const half = th / 2;
    // far enough along the bisector that the label clears both the leg and the horizontal
    const dLabel = Math.max(ARC + 50, (35 * Math.sin(th) + 15 * Math.cos(th) + 8) / Math.sin(half));
    g.arcs.forEach((arc, i) => {
      const s = i === 0 ? 1 : -1;
      const [lx, ly] = lugs[i]!;
      const from: Pt = [lx + s * ARC, ly], to: Pt = [lx + s * ARC * Math.cos(th), ly - ARC * Math.sin(th)];
      set(arc, { d: `M${lx},${ly}L${from[0]},${from[1]}A${ARC},${ARC} 0 0 ${i === 0 ? 0 : 1} ${to[0]},${to[1]}z` });
      arc.style.fill = mix("var(--cf-steel)", "var(--cf-light)", ae * 0.7);
      arc.style.stroke = mix("var(--cf-ink-2)", "var(--cf-light-edge)", ae);
      const tx = lx + s * dLabel * Math.cos(half), ty = ly - dLabel * Math.sin(half);
      set(g.angleTexts[i]!, { x: tx, y: ty + 14 });
      g.angleTexts[i]!.textContent = `${Math.round(deg)}°`;
    });
    fade(g.angle, op("slings.angle"));

    // H: on the right, from the hook's level down to the pick points' level
    const right = cx + a * k + 1.6 * k;
    const he2 = lit("slings.height");
    this.dim(g.height, [right, P[1]], [right, y0], [1, 0], 56, `H = ${ft(H)} ft`, [-(right - cx) + 30, 12]);
    this.paint(g.height, he2);
    fade(g.height.g, op("slings.height"));

    // L: along the left leg, offset outward far enough that its label clears the leg
    const ux = (P[0] - lugs[0]![0]) / (L * k), uy = (P[1] - lugs[0]![1]) / (L * k);
    const n: Pt = [uy, -ux]; // outward: up and to the left of the left leg
    const label = `L = ${ft(L)} ft`;
    g.length.t.textContent = label;
    const tw = (textWidth(g.length.t) || 19 * label.length) + 40;
    const off = Math.abs(n[0]) * (tw / 2) + Math.abs(n[1]) * 26 + 16;
    this.dim(g.length, lugs[0]!, P, n, off, label, [16, 62]); // the top extension starts clear of the hook
    this.paint(g.length, lit("slings.length"));
    fade(g.length.g, op("slings.length"));

    // the load
    const le = lit("slings.load");
    g.loadBody.style.fill = mix("var(--cf-load)", "var(--cf-light)", le);
    g.loadBody.style.stroke = mix("var(--cf-ink-2)", "var(--cf-light-edge)", le);
    g.loadBody.style.strokeWidth = String(3 + 3 * le);
    fade(g.loadG, op("slings.load"));

    // each leg pulls its pick point in toward the middle: (load ÷ legs) ÷ tan angle
    const inward = (this.load / this.legs) / Math.tan(th);
    const len = inward * this.pullScale;
    const py = this.loadTopPx + 30;
    const pe = lit("slings.pull");
    g.pulls.forEach((p, i) => {
      const s = i === 0 ? 1 : -1;
      const x0 = lugs[i]![0], x1 = x0 + s * len;
      set(p.line, { x1: x0, y1: py, x2: x1 - s * 10, y2: py });
      set(p.head, { d: arrowHead([x1, py], [x0, py], 20) });
      p.line.style.stroke = mix("var(--cf-ink-3)", "var(--cf-light-edge)", pe);
      p.head.style.fill = mix("var(--cf-ink-3)", "var(--cf-light-edge)", pe);
    });
    fade(g.pull, op("slings.pull") * op("slings.load"));

    for (const [r, c] of g.cells) {
      if (r === "angle") { c.num.textContent = `${Math.round(deg)}°`; c.unit.textContent = ""; }
      if (r === "factor") { c.num.textContent = factor.toFixed(3); c.unit.textContent = ""; }
      if (r === "tension") { c.num.textContent = lb(tension); c.unit.textContent = " lb"; }
      const em = lit(`slings.readout.${r}`);
      c.bg.style.fill = mix("var(--cf-panel-cell)", "var(--cf-light)", em);
      c.value.style.fill = em > 0.5 ? "var(--cf-light-ink)" : "";
      c.cap.style.fill = em > 0.5 ? "var(--cf-light-ink)" : "";
      fade(c.g, op(`slings.readout.${r}`));
    }
  }

  private paint(d: Dim, em: number) {
    d.pill.style.fill = mix("var(--cf-paper)", "var(--cf-light)", em);
    d.line.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", em);
    d.line.style.strokeWidth = String(3.5 + 2.5 * em);
    for (const h of [d.a, d.b]) h.style.fill = mix("var(--cf-ink)", "var(--cf-light-edge)", em);
  }
}
