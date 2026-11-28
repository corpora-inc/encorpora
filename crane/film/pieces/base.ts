/**
 * Stability: why a crane tips, and why its capacity falls as the radius grows.
 *
 * Side view (default): a crane on outriggers seen from the side, the load out
 * over the front. It tips about the float nearest the load: the tipping axis,
 * drawn as a fulcrum. Two weights act: the crane's own, down through its
 * centre of gravity behind the axis, and the load's, down through the hook.
 * Each has a lever arm measured from the axis, and the panel under the picture
 * compares the two moments (weight × arm) with bars drawn to one scale. The
 * crane tips when the load's moment passes the crane's:
 *   tipping load = craneWeight × (cg + axis) / (radius − axis);
 *   rated = 85% of tipping (a part shown when `rated` is true).
 *
 *   { "base": { "craneWeight": 60000, "cg": 3, "axis": 12, "radius": 30, "load": 20000, "rated": true } }
 *
 * Plan view (`"view": "plan"`): the crane from above, its four floats, and the
 * four candidate tipping axes (the lines through two floats). The boom points
 * at `base.swing` degrees (0 over the front, to the right; 90 over the left
 * side, up; 180 over the rear); the axis it crosses is the live one, and a
 * dimension measures along the boom from the centre of rotation to it.
 *
 *   { "base": { "view": "plan", "axis": 12, "front": 12, "rear": 12, "swing": 90, "radius": 30 } }
 *
 * Values (`set`): base.radius (ft from the centre of rotation to the hook),
 * base.load (lb), base.axis (side: ft from the centre of rotation to the
 * tipping axis; plan: ft from the centreline to the side floats), base.tilt
 * (degrees the crane leans over the float; 0 = standing), base.swing (plan).
 *
 * Parts, side: base.crane, base.boom, base.outriggers, base.center (the centre
 * of rotation, hidden until a `show`), base.axis,
 * base.cg, base.rigging, base.load, base.armCrane, base.armLoad, base.moments,
 * base.moments.crane, base.moments.load, base.tipping, base.rated.
 * Parts, plan: base.crane, base.boom, base.load, base.center, base.outriggers,
 * base.float.<fl|fr|rl|rr> (front/rear, left/right), base.axis,
 * base.axis.<front|rear|left|right>, base.axisDim.
 */
import { arrowHead, el, fade, lb, pts, roundRect, set, text, textWidth, type Pt } from "../draw";
import type { CraneTimeline } from "../timeline";
import { known, num, str, strs, type Piece, type PieceInit, type Spec } from "./piece";

const FIELDS = ["view", "craneWeight", "cg", "radius", "load", "axis", "tilt", "swing", "front", "rear", "rated", "hidden"] as const;

const W = 880, MAX_H = 880, GAP = 34;
/** Side view, in feet: the load hangs with its bottom LOAD_Y above the ground. */
const LOAD_W = 6, LOAD_H = 4, LOAD_Y = 8;
const FOOT: Pt = [0, 8.6];
const CG_Y = 5.2;
/** Pixels drawn under the ground line: fulcrum, arm dimensions and their labels. */
const BELOW = 132;

/** Set a part's light on its group: the CSS mixes every lit-aware paint under it toward amber. */
export const glow = (node: SVGElement, em: number) => node.style.setProperty("--lit", em <= 0.001 ? "0" : em.toFixed(3));
/** 15 reads 15; 14.63 reads 14.6. */
export const ft = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
/** Width of a label in px: measured once fonts are in, estimated before. */
const widthOf = (t: SVGTextElement, size: number) => textWidth(t) || (t.textContent ?? "").length * size * 0.5;

/** A text on a pill that turns amber when its part is lit. */
export function pill(parent: Element, cls = "cfb-pill") {
  const g = el("g", parent);
  const bg = el("path", g, {}, cls);
  const t = text(g, 0, 0, "", "cfb-dim-text", "middle");
  return {
    g,
    put(s: string, cx: number, cy: number) {
      t.textContent = s;
      const w = widthOf(t, 40) + 34;
      set(bg, { d: roundRect(cx - w / 2, cy - 26, w, 52, 26) });
      set(t, { x: cx, y: cy + 14 });
      return w;
    },
  };
}

/** A two-headed dimension line between two screen points. */
export function dimension(parent: Element) {
  const line = el("line", parent, {}, "cfb-dim");
  const a = el("path", parent, {}, "cfb-dim-head");
  const b = el("path", parent, {}, "cfb-dim-head");
  return (p: Pt, q: Pt) => {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const ux = (q[0] - p[0]) / d, uy = (q[1] - p[1]) / d;
    set(line, { x1: p[0] + ux * 6, y1: p[1] + uy * 6, x2: q[0] - ux * 6, y2: q[1] - uy * 6 });
    set(a, { d: arrowHead(p, q, Math.min(18, d / 2.5)) });
    set(b, { d: arrowHead(q, p, Math.min(18, d / 2.5)) });
  };
}

/**
 * A crane on outriggers seen from above, in feet around its centre of
 * rotation (x toward the front, y toward the left side): the carrier and its
 * floats on `low`, the turning house, boom and hook load on `high`.
 * Shared with the clearance piece.
 */
export class PlanCrane {
  readonly carrier: SVGGElement;
  readonly outriggers: SVGGElement;
  readonly floats: Record<"fl" | "fr" | "rl" | "rr", SVGGElement>;
  readonly upper: SVGGElement;
  readonly boom: SVGGElement;
  readonly load: SVGGElement;
  readonly center: SVGGElement;
  private beams: SVGPathElement[];
  private floatBody: Record<"fl" | "fr" | "rl" | "rr", SVGPathElement>;
  private table: SVGCircleElement;
  private house: SVGPolygonElement;
  private cw: SVGPolygonElement;
  private cab: SVGPolygonElement;
  private glass: SVGPolygonElement;
  private boomBody: SVGPolygonElement;
  private head: SVGCircleElement;
  private loadBody: SVGPolygonElement;

  constructor(low: Element, high: Element, private P: (x: number, y: number) => Pt, private k: number) {
    const rect = (parent: Element, x: number, y: number, w: number, h: number, r: number, cls: string) => {
      const [px, py] = P(x, y + h);
      return el("path", parent, { d: roundRect(px, py, w * k, h * k, r * k) }, cls);
    };
    this.carrier = el("g", low);
    this.outriggers = el("g", low);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) rect(this.carrier, sx * 8.6 - 2.3, sy * 5.1 - 0.95, 4.8, 1.9, 0.5, "cfb-tire");
    rect(this.carrier, -13, -4.2, 26, 8.4, 0.9, "cfb-steel-dark");
    this.beams = [el("path", this.outriggers, {}, "cfb-steel-dark"), el("path", this.outriggers, {}, "cfb-steel-dark")];
    const fg = (): SVGGElement => el("g", this.outriggers);
    this.floats = { fl: fg(), fr: fg(), rl: fg(), rr: fg() };
    this.floatBody = {
      fl: el("path", this.floats.fl, {}, "cfb-float"), fr: el("path", this.floats.fr, {}, "cfb-float"),
      rl: el("path", this.floats.rl, {}, "cfb-float"), rr: el("path", this.floats.rr, {}, "cfb-float"),
    };
    this.upper = el("g", high);
    this.table = el("circle", this.upper, { r: 4.6 * k }, "cfb-steel-dark");
    this.house = el("polygon", this.upper, {}, "cfb-steel");
    this.cw = el("polygon", this.upper, {}, "cfb-cw");
    this.cab = el("polygon", this.upper, {}, "cfb-steel");
    this.glass = el("polygon", this.upper, {}, "cfb-glass");
    this.boom = el("g", high);
    this.boomBody = el("polygon", this.boom, {}, "cfb-boom");
    this.head = el("circle", this.boom, { r: 1.25 * k }, "cfb-head");
    this.load = el("g", high);
    this.loadBody = el("polygon", this.load, {}, "cfb-load");
    this.center = el("g", high);
    const [cx, cy] = P(0, 0);
    el("circle", this.center, { cx, cy, r: 9 }, "cfb-center-dot");
  }

  /** spread: centreline to the side floats; front/rear: centre to the float rows; swing in degrees; reach to the hook. */
  update(spread: number, front: number, rear: number, swing: number, reach: number) {
    const { P, k } = this;
    const rect = (x: number, y: number, w: number, h: number, r: number) => {
      const [px, py] = P(x, y + h);
      return roundRect(px, py, w * k, h * k, r * k);
    };
    set(this.beams[0]!, { d: rect(front - 0.8, -spread, 1.6, 2 * spread, 0.3) });
    set(this.beams[1]!, { d: rect(-rear - 0.8, -spread, 1.6, 2 * spread, 0.3) });
    const F = 2.8;
    const at: Record<"fl" | "fr" | "rl" | "rr", Pt> = { fl: [front, spread], fr: [front, -spread], rl: [-rear, spread], rr: [-rear, -spread] };
    for (const key of Object.keys(at) as (keyof typeof at)[]) {
      const [x, y] = at[key];
      set(this.floatBody[key], { d: rect(x - F / 2, y - F / 2, F, F, 0.4) });
    }
    const a = (swing * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const R = (u: number, v: number): Pt => P(u * c - v * s, u * s + v * c);
    const poly = (list: Pt[]) => pts(list.map(([u, v]) => R(u, v)));
    const [cx, cy] = P(0, 0);
    set(this.table, { cx, cy });
    set(this.house, { points: poly([[-8, -4.2], [3.4, -4.2], [3.4, 4.2], [-8, 4.2]]) });
    set(this.cw, { points: poly([[-10.6, -4.6], [-7.4, -4.6], [-7.4, 4.6], [-10.6, 4.6]]) });
    set(this.cab, { points: poly([[-0.6, 4.4], [4.6, 4.4], [4.6, 7.6], [-0.6, 7.6]]) });
    set(this.glass, { points: poly([[2.6, 4.9], [4.0, 4.9], [4.0, 7.1], [2.6, 7.1]]) });
    const r = Math.max(reach, 6);
    set(this.boomBody, { points: poly([[-1.6, -1.35], [r, -0.9], [r, 0.9], [-1.6, 1.35]]) });
    const [hx, hy] = R(r, 0);
    set(this.head, { cx: hx, cy: hy });
    set(this.loadBody, { points: poly([[r - 2.6, -2.6], [r + 2.6, -2.6], [r + 2.6, 2.6], [r - 2.6, 2.6]]) });
    void k;
  }
}

type SideEls = {
  crane: SVGGElement; boom: SVGGElement; boomBody: SVGPolygonElement; head: SVGCircleElement; cyl: SVGLineElement;
  outriggers: SVGGElement; beams: SVGPathElement[]; jacks: SVGPathElement[]; floats: SVGPathElement[];
  center: SVGGElement; axis: SVGGElement; fulcrum: SVGPathElement; axisExt: SVGLineElement;
  cg: SVGGElement; cgHalo: SVGLineElement; cgShaft: SVGLineElement; cgHead: SVGPathElement; cgRing: SVGCircleElement; cgQ: SVGPathElement; cgText: SVGTextElement;
  rigging: SVGGElement; rope: SVGLineElement; block: SVGPathElement; hook: SVGPathElement; slingL: SVGLineElement; slingR: SVGLineElement;
  load: SVGGElement; loadBody: SVGPathElement; loadShaft: SVGLineElement; loadHead: SVGPathElement; loadText: SVGTextElement;
  armCrane: SVGGElement; armCraneDim: (p: Pt, q: Pt) => void; armCraneExt: SVGLineElement; armCranePill: ReturnType<typeof pill>;
  armLoad: SVGGElement; armLoadDim: (p: Pt, q: Pt) => void; armLoadExt: SVGLineElement; armLoadPill: ReturnType<typeof pill>;
  moments?: {
    g: SVGGElement;
    rows: { key: string; g: SVGGElement; cell: SVGPathElement; cap: SVGTextElement; value: SVGTextElement; bar: SVGPathElement; x: number; y: number }[];
    balance: SVGLineElement[]; barW: number; scale: number; top: number;
  };
  rated?: { key: string; g: SVGGElement; cell: SVGPathElement; cap: SVGTextElement; value: SVGTextElement }[];
};

type PlanEls = {
  crane: PlanCrane; axisG: SVGGElement;
  lines: Record<"front" | "rear" | "left" | "right", { g: SVGGElement; line: SVGLineElement }>;
  dimG: SVGGElement; dim: (p: Pt, q: Pt) => void; cross: SVGCircleElement; dimPill: ReturnType<typeof pill>;
};

export class BasePiece implements Piece {
  w = 0;
  h = 0;
  parts: string[] = [];
  readonly initial: Record<string, number>;
  readonly hidden: string[];
  private view: "side" | "plan";
  private weight: number;
  private cg: number;
  private front: number;
  private rear: number;
  private k = 1;
  private P: (x: number, y: number) => Pt = (x, y) => [x, y];
  private tipH = 30;
  private side?: SideEls;
  private plan?: PlanEls;

  constructor(spec: Spec, init: PieceInit) {
    const where = "crane.base";
    const { issues } = init;
    known(spec, FIELDS, issues, where);
    const view = str(spec, "view", "side", issues, where);
    if (view !== "side" && view !== "plan") issues.push(`${where}.view is "side" or "plan", not "${view}".`);
    this.view = view === "plan" ? "plan" : "side";
    this.weight = num(spec, "craneWeight", 60000, issues, where);
    this.cg = num(spec, "cg", 3, issues, where);
    this.front = num(spec, "front", 12, issues, where);
    this.rear = num(spec, "rear", 12, issues, where);
    const radius = num(spec, "radius", 30, issues, where);
    const load = num(spec, "load", 20000, issues, where);
    const axis = num(spec, "axis", 12, issues, where);
    const tilt = num(spec, "tilt", 0, issues, where);
    const swing = num(spec, "swing", 90, issues, where);
    if (spec.rated !== undefined && typeof spec.rated !== "boolean") issues.push(`${where}.rated is true or false.`);
    const rated = spec.rated === true;
    // the centre of rotation is for a film that measures from it: shown on request
    this.hidden = [...(this.view === "side" ? ["base.center"] : []), ...strs(spec, "hidden", issues, where)];
    this.initial = { "base.radius": radius, "base.load": load, "base.axis": axis, "base.tilt": tilt, "base.swing": swing };
    if (this.weight <= 0) issues.push(`${where}.craneWeight must be more than 0 lb.`);
    if (this.view === "side") this.buildSide(init, rated, where);
    else this.buildPlan(init, where);
  }

  // ------------------------------------------------------------ side view

  private buildSide(init: PieceInit, rated: boolean, where: string) {
    const { issues, root } = init;
    const [rMin, rMax] = init.range("base.radius", this.initial["base.radius"]!);
    const [aMin, aMax] = init.range("base.axis", this.initial["base.axis"]!);
    const [tMin, tMax] = init.range("base.tilt", this.initial["base.tilt"]!);
    const [lMin, lMax] = init.range("base.load", this.initial["base.load"]!);
    if (aMin < 6 || aMax > 20) issues.push(`${where}: the tipping axis sits 6 to 20 ft from the centre of rotation (full outriggers about 12, mid about 7), not ${aMin < 6 ? aMin : aMax}.`);
    if (rMin - aMax < 5) issues.push(`${where}: the hook must hang at least 5 ft beyond the tipping axis (radius ${rMin} ft, axis ${aMax} ft).`);
    if (this.cg < 1.5 || this.cg > 9) issues.push(`${where}.cg is 1.5 to 9 ft behind the centre of rotation, not ${this.cg}.`);
    if (tMin < 0 || tMax > 12) issues.push(`${where}: base.tilt is 0 to 12 degrees.`);
    if (lMin < 0) issues.push(`${where}: base.load cannot be negative.`);
    void lMax;

    this.tipH = Math.max(26, 9 + 0.47 * (rMax + 2));
    const tipAt = (r: number, a: number, tilt: number) => rotAbout([r, this.tipH], a, tilt);
    const x0 = Math.min(-aMax - 2.4, -12.6, -this.cg - 9.5);
    const x1 = Math.max(rMax, tipAt(rMax, aMin, tMax)[0]) + LOAD_W / 2 + 1.2;
    const yTop = this.tipH + 1.6;
    const panelH = 14 + 104 + 12 + 104 + 14 + (rated ? 12 + 76 : 0);
    const drawH = MAX_H - panelH - GAP;
    const k = Math.min(W / (x1 - x0), (drawH - BELOW) / yTop);
    this.k = k;
    const offX = (W - (x1 - x0) * k) / 2;
    const P = (x: number, y: number): Pt => [(x - x0) * k + offX, (yTop - y) * k];
    this.P = P;
    const G = yTop * k;
    this.w = W;
    this.h = G + BELOW + GAP + panelH;

    // ground
    el("rect", root, { x: P(x0 + 0.4, 0)[0], y: G, width: (x1 - x0 - 0.8) * k, height: 12 }, "cfb-ground");
    el("line", root, { x1: P(x0 + 0.4, 0)[0], y1: G, x2: P(x1 - 0.4, 0)[0], y2: G }, "cfb-ground-line");

    // the crane: everything that leans with it when it tips
    const crane = el("g", root);
    const body = el("g", crane);
    const rect = (parent: Element, x: number, y: number, w: number, h: number, r: number, cls: string) => {
      const [px, py] = P(x, y + h);
      return el("path", parent, { d: roundRect(px, py, w * k, h * k, r * k) }, cls);
    };
    const outriggers = el("g", crane);
    const beams = [el("path", outriggers, {}, "cfb-steel-dark"), el("path", outriggers, {}, "cfb-steel-dark")];
    const jacks = [el("path", outriggers, {}, "cfb-steel-dark"), el("path", outriggers, {}, "cfb-steel-dark")];
    const floats = [el("path", outriggers, {}, "cfb-float"), el("path", outriggers, {}, "cfb-float")];
    crane.insertBefore(outriggers, body);
    // tires clear the ground: the floats carry the crane
    for (const wx of [-3.7, 3.7]) {
      const [cx, cy] = P(wx, 2.15);
      el("circle", body, { cx, cy, r: 1.8 * k }, "cfb-tire");
      el("circle", body, { cx, cy, r: 0.8 * k }, "cfb-hub");
    }
    rect(body, -6.4, 2.6, 12.8, 2.0, 0.3, "cfb-steel-dark");
    rect(body, -2.6, 4.6, 5.2, 0.8, 0.15, "cfb-steel-dark");
    rect(body, -8.2, 5.4, 11.4, 3.8, 0.5, "cfb-steel");
    rect(body, -10.6, 5.2, 3.2, 4.4, 0.4, "cfb-cw");
    el("polygon", body, { points: pts([[0.8, 5.4], [4.6, 5.4], [4.6, 8.8], [3.8, 9.8], [0.8, 9.8]].map(([x, y]) => P(x, y))) }, "cfb-steel");
    el("polygon", body, { points: pts([[2.6, 7.2], [4.0, 7.2], [4.0, 8.9], [3.5, 9.4], [2.6, 9.4]].map(([x, y]) => P(x, y))) }, "cfb-glass");
    const boom = el("g", crane);
    const cyl = el("line", boom, {}, "cfb-cyl");
    const boomBody = el("polygon", boom, {}, "cfb-boom");
    const head = el("circle", boom, { r: 1.0 * k }, "cfb-head");
    const [fx, fy] = P(...FOOT);
    el("circle", boom, { cx: fx, cy: fy, r: Math.max(6, 0.6 * k) }, "cfb-pin");
    const center = el("g", crane);
    const [c0x, c0y] = P(0, -0.2), [, c1y] = P(0, 11.6);
    el("line", center, { x1: c0x, y1: c0y, x2: c0x, y2: c1y }, "cfb-center");

    // rigging and load: they hang plumb under the boom tip whatever the crane does
    const rigging = el("g", root);
    const slingL = el("line", rigging, {}, "cfb-sling");
    const slingR = el("line", rigging, {}, "cfb-sling");
    const rope = el("line", rigging, {}, "cfb-rope");
    const block = el("path", rigging, {}, "cfb-block");
    const hook = el("path", rigging, {}, "cfb-hook");
    const load = el("g", root);
    const loadBody = el("path", load, {}, "cfb-load");
    const loadShaft = el("line", load, {}, "cfb-force");
    const loadHead = el("path", load, {}, "cfb-force-head");
    const loadText = text(load, 0, 0, "", "cfb-weight-text", "end");

    // the crane's weight, down through its centre of gravity
    const cg = el("g", root);
    const cgHalo = el("line", cg, {}, "cfb-halo");
    const cgShaft = el("line", cg, {}, "cfb-force");
    const cgHead = el("path", cg, {}, "cfb-force-head");
    const cgRing = el("circle", cg, { r: 17 }, "cfb-cg-ring");
    const cgQ = el("path", cg, {}, "cfb-cg-q");
    const cgText = text(cg, 0, 0, lb(this.weight) + " lb", "cfb-weight-text", "middle");

    // the tipping axis: a fulcrum under the float nearest the load
    const axis = el("g", root);
    const fulcrum = el("path", axis, {}, "cfb-fulcrum");
    const axisExt = el("line", axis, {}, "cfb-dim-ext");

    // lever arms, measured from the axis
    const armCrane = el("g", root);
    const armCraneExt = el("line", armCrane, {}, "cfb-dim-ext");
    const armCraneDim = dimension(armCrane);
    const armCranePill = pill(armCrane);
    const armLoad = el("g", root);
    const armLoadExt = el("line", armLoad, {}, "cfb-dim-ext");
    const armLoadDim = dimension(armLoad);
    const armLoadPill = pill(armLoad);

    this.side = {
      crane, boom, boomBody, head, cyl, outriggers, beams, jacks, floats, center, axis, fulcrum, axisExt,
      cg, cgHalo, cgShaft, cgHead, cgRing, cgQ, cgText, rigging, rope, block, hook, slingL, slingR,
      load, loadBody, loadShaft, loadHead, loadText,
      armCrane, armCraneDim, armCraneExt, armCranePill, armLoad, armLoadDim, armLoadExt, armLoadPill,
    };

    // the balance: each moment as a bar, both to one scale, and where they balance
    const top = G + BELOW + GAP;
    const mg = el("g", root);
    el("path", mg, { d: roundRect(0, top, W, panelH, 22) }, "cf-panel");
    const pad = 14, cw = W - 2 * pad, inner = 22;
    const barW = cw - 2 * inner;
    const craneMax = this.weight * (this.cg + aMax);
    const loadMax = lMax * (rMax - aMin) * (tMax > 0 ? 1.12 : 1);
    const scale = Math.max(craneMax, loadMax) * 1.04 || 1;
    const rows: NonNullable<SideEls["moments"]>["rows"] = [];
    [["base.moments.crane", "CRANE × ARM", "cfb-bar-crane"], ["base.moments.load", "LOAD × ARM", "cfb-bar-load"]].forEach(([key, cap, barCls], i) => {
      const y = top + pad + i * (104 + 12);
      const g = el("g", mg);
      const cell = el("path", g, { d: roundRect(pad, y, cw, 104, 14) }, "cf-panel-cell");
      const capT = text(g, pad + inner, y + 46, cap!, "cf-panel-cap");
      const value = text(g, pad + cw - inner, y + 48, "", "cfb-moment-value", "end");
      el("path", g, { d: roundRect(pad + inner, y + 64, barW, 22, 11) }, "cfb-track");
      const bar = el("path", g, {}, barCls!);
      rows.push({ key: key!, g, cell, cap: capT, value, bar, x: pad + inner, y: y + 64 });
    });
    const balance = [el("line", mg, {}, "cfb-balance"), el("line", mg, {}, "cfb-balance")];
    this.side.moments = { g: mg, rows, balance, barW, scale, top };
    if (rated) {
      const y = top + pad + 2 * (104 + 12);
      const half = (cw - 12) / 2;
      this.side.rated = [["base.tipping", "TIPPING LOAD"], ["base.rated", "RATED, 85%"]].map(([key, cap], i) => {
        const x = pad + i * (half + 12);
        const g = el("g", mg);
        const cell = el("path", g, { d: roundRect(x, y, half, 76, 14) }, "cf-panel-cell");
        const capT = text(g, x + inner, y + 48, cap!, "cf-panel-cap");
        const value = text(g, x + half - inner, y + 52, "", i === 1 ? "cfb-moment-value cfb-rated-value" : "cfb-moment-value", "end");
        return { key: key!, g, cell, cap: capT, value };
      });
    }

    this.parts = [
      "base", "base.crane", "base.boom", "base.outriggers", "base.center", "base.axis", "base.cg", "base.rigging", "base.load",
      "base.armCrane", "base.armLoad", "base.moments", "base.moments.crane", "base.moments.load",
      ...(rated ? ["base.tipping", "base.rated"] : []),
    ];
  }

  private drawSide(tl: CraneTimeline, t: number) {
    const s = this.side!;
    const { P, k } = this;
    const R = tl.value("base.radius", t), A = tl.value("base.axis", t), T = tl.value("base.tilt", t), Lw = tl.value("base.load", t);
    const op = (n: string) => tl.opacity(n, t);
    const lit = (n: string) => tl.light(n, t);
    const rot = (p: Pt) => rotAbout(p, A, T);
    const rect = (x: number, y: number, w: number, h: number, r: number) => {
      const [px, py] = P(x, y + h);
      return roundRect(px, py, w * k, h * k, r * k);
    };
    const [axPx, G] = P(A, 0);

    // the crane leans about the float
    set(s.crane, { transform: T > 0.001 ? `rotate(${T.toFixed(3)},${axPx.toFixed(2)},${G.toFixed(2)})` : "" });
    for (const [i, sx] of [-1, 1].entries()) {
      set(s.beams[i]!, { d: sx > 0 ? rect(5.6, 3.0, A - 5.6 + 0.5, 1.0, 0.2) : rect(-A - 0.5, 3.0, A - 5.6 + 0.5, 1.0, 0.2) });
      set(s.jacks[i]!, { d: rect(sx * A - 0.45, 0.5, 0.9, 3.5, 0.1) });
      set(s.floats[i]!, { d: rect(sx * A - 1.4, 0, 2.8, 0.5, 0.15) });
    }
    // boom from its foot to the tip over the hook
    const tip: Pt = [R, this.tipH];
    const dx = tip[0] - FOOT[0], dy = tip[1] - FOOT[1];
    const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const along = (d: number, off: number): Pt => [FOOT[0] + ux * d - uy * off, FOOT[1] + uy * d + ux * off];
    set(s.boomBody, { points: pts([along(-0.9, -1.2), along(L, -0.8), along(L, 0.8), along(-0.9, 1.2)].map((p) => P(...p))) });
    const [hx, hy] = P(...tip);
    set(s.head, { cx: hx, cy: hy });
    const c0 = P(2.4, 5.6), c1 = P(...along(L * 0.32, -1.1));
    set(s.cyl, { x1: c0[0], y1: c0[1], x2: c1[0], y2: c1[1] });

    // rigging plumb under the leaning tip
    const tipR = rot(tip);
    const X = tipR[0];
    const topRope = P(X, tipR[1] - 1.0);
    const [, blockTop] = P(X, 18.4);
    set(s.rope, { x1: topRope[0], y1: topRope[1], x2: topRope[0], y2: blockTop });
    set(s.block, { d: rect(X - 1.1, 15.6, 2.2, 2.8, 0.4) });
    const h0 = P(X, 15.6), h1 = P(X, 14.7);
    set(s.hook, { d: `M${h0[0]},${h0[1]}L${h1[0]},${h1[1]}a${0.5 * k},${0.5 * k} 0 1 0 ${1.0 * k},0` });
    const hk = P(X, 14.5), sl = P(X - LOAD_W / 2 + 0.7, LOAD_Y + LOAD_H), sr = P(X + LOAD_W / 2 - 0.7, LOAD_Y + LOAD_H);
    set(s.slingL, { x1: hk[0], y1: hk[1], x2: sl[0], y2: sl[1] });
    set(s.slingR, { x1: hk[0], y1: hk[1], x2: sr[0], y2: sr[1] });
    set(s.loadBody, { d: rect(X - LOAD_W / 2, LOAD_Y, LOAD_W, LOAD_H, 0.35) });

    // the load's weight, down from the load
    const la = P(X, LOAD_Y - 0.4), lbt = P(X, 0.6);
    set(s.loadShaft, { x1: la[0], y1: la[1], x2: lbt[0], y2: lbt[1] - 16 });
    set(s.loadHead, { d: arrowHead(lbt, la, 24) });
    s.loadText.textContent = `${lb(Lw)} lb`;
    set(s.loadText, { x: la[0] - 22, y: (la[1] + lbt[1]) / 2 + 14 });

    // the crane's weight, down onto its centre of gravity
    const cgR = rot([-this.cg, CG_Y]);
    const [gx, gy] = P(...cgR);
    const tail: Pt = [gx, gy - Math.max(78, 6.4 * k)];
    const tipCg: Pt = [gx, gy - 19];
    set(s.cgHalo, { x1: tail[0], y1: tail[1], x2: tipCg[0], y2: tipCg[1] - 6 });
    set(s.cgShaft, { x1: tail[0], y1: tail[1], x2: tipCg[0], y2: tipCg[1] - 16 });
    set(s.cgHead, { d: arrowHead(tipCg, tail, 24) });
    set(s.cgRing, { cx: gx, cy: gy });
    set(s.cgQ, { d: `M${gx},${gy}v-17a17,17 0 0 1 17,17zM${gx},${gy}v17a17,17 0 0 1 -17,-17z` });
    // the label sits over the arrow's tail, slid left clear of the boom
    const lw = widthOf(s.cgText, 40);
    const base = tail[1] - 14;
    const footS = P(...rot(FOOT)), tipS = P(...tipR);
    let cx = gx;
    const yb = base + 8; // label bottom
    if (tipS[1] < yb && footS[1] > yb) {
      const u = (yb - footS[1]) / (tipS[1] - footS[1]);
      const xc = footS[0] + u * (tipS[0] - footS[0]);
      const sinA = Math.abs(tipS[1] - footS[1]) / Math.hypot(tipS[0] - footS[0], tipS[1] - footS[1]);
      const limit = xc - (1.3 * k) / Math.max(0.2, sinA) - 18;
      cx = Math.min(cx, limit - lw / 2);
    }
    set(s.cgText, { x: cx, y: base });

    // fulcrum under the float, and the arms along one line under the ground
    set(s.fulcrum, { d: `M${axPx},${G + 2}L${axPx + 22},${G + 34}L${axPx - 22},${G + 34}z` });
    const dimY = G + 60;
    set(s.axisExt, { x1: axPx, y1: G + 38, x2: axPx, y2: dimY + 16 });
    set(s.armCraneExt, { x1: gx, y1: G + 10, x2: gx, y2: dimY + 16 });
    set(s.armLoadExt, { x1: lbt[0], y1: G + 10, x2: lbt[0], y2: dimY + 16 });
    s.armCraneDim([gx, dimY], [axPx, dimY]);
    s.armLoadDim([axPx, dimY], [lbt[0], dimY]);
    const craneArm = A - cgR[0], loadArm = X - A;
    s.armCranePill.put(`${ft(craneArm)} ft`, (gx + axPx) / 2, dimY + 44);
    s.armLoadPill.put(`${ft(loadArm)} ft`, (axPx + lbt[0]) / 2, dimY + 44);

    // lights and fades
    const parts: [string, SVGGElement][] = [
      ["base.crane", s.crane], ["base.outriggers", s.outriggers], ["base.boom", s.boom], ["base.center", s.center], ["base.axis", s.axis],
      ["base.cg", s.cg], ["base.rigging", s.rigging], ["base.load", s.load], ["base.armCrane", s.armCrane], ["base.armLoad", s.armLoad],
    ];
    for (const [name, g] of parts) {
      glow(g, lit(name));
      fade(g, op(name));
    }

    // the moments
    const m = s.moments!;
    const craneM = this.weight * craneArm, loadM = Lw * loadArm;
    const over = loadM > craneM + 0.5;
    m.rows.forEach((r, i) => {
      const M = i === 0 ? craneM : loadM;
      const wgt = i === 0 ? this.weight : Lw;
      const arm = i === 0 ? craneArm : loadArm;
      // a whole arm gives the exact product; an arm in motion, the product to the nearest thousand
      const whole = Math.abs(arm - Math.round(arm)) < 0.05;
      r.value.textContent = `${lb(wgt)} × ${ft(arm)} = ${lb(whole ? wgt * Math.round(arm) : Math.round(M / 1000) * 1000)} ft-lb`;
      const bw = Math.max(0, Math.min(m.barW, (M / m.scale) * m.barW));
      set(r.bar, { d: bw < 1 ? "" : roundRect(r.x, r.y, bw, 22, 11) });
      if (i === 1) r.bar.classList.toggle("is-over", over);
      litCell(r.cell, r.cap, r.value, lit(r.key));
      fade(r.g, op(r.key));
    });
    const bx = m.rows[0]!.x + Math.min(m.barW, (craneM / m.scale) * m.barW);
    m.balance.forEach((b, i) => {
      set(b, { x1: bx, y1: m.rows[i]!.y - 7, x2: bx, y2: m.rows[i]!.y + 29 });
      fade(b, Math.min(op("base.moments.crane"), op("base.moments.load")));
    });
    fade(m.g, op("base.moments"));
    if (s.rated) {
      const tip0 = (this.weight * (this.cg + A)) / Math.max(0.5, R - A);
      s.rated[0]!.value.textContent = `${lb(tip0)} lb`;
      s.rated[1]!.value.textContent = `${lb(tip0 * 0.85)} lb`;
      for (const c of s.rated) {
        litCell(c.cell, c.cap, c.value, lit(c.key));
        fade(c.g, op(c.key));
      }
    }
  }

  // ------------------------------------------------------------ plan view

  private buildPlan(init: PieceInit, where: string) {
    const { issues, root } = init;
    const [rMin, rMax] = init.range("base.radius", this.initial["base.radius"]!);
    const [aMin, aMax] = init.range("base.axis", this.initial["base.axis"]!);
    const [sMin, sMax] = init.range("base.swing", this.initial["base.swing"]!);
    if (aMin < 6 || aMax > 20) issues.push(`${where}: base.axis (the float spread from the centreline) is 6 to 20 ft in plan.`);
    if (this.front < 6 || this.front > 20 || this.rear < 6 || this.rear > 20) issues.push(`${where}.front and .rear are 6 to 20 ft.`);
    const corner = Math.hypot(Math.max(this.front, this.rear), aMax);
    if (rMin < corner + 4) issues.push(`${where}: in plan the hook must reach past the floats (radius at least ${Math.ceil(corner + 4)} ft).`);

    // the frame holds the carrier, the axes and every place the boom swings to
    let bx0 = -(this.rear + 4.5), bx1 = this.front + 4.5, by0 = -(aMax + 4.5), by1 = aMax + 4.5;
    bx0 = Math.min(bx0, -14), bx1 = Math.max(bx1, 14);
    for (let sw = sMin; sw <= sMax + 0.01; sw += Math.max(1, (sMax - sMin) / 60)) {
      const a = (sw * Math.PI) / 180;
      for (const r of [rMin, rMax]) {
        const x = r * Math.cos(a), y = r * Math.sin(a);
        bx0 = Math.min(bx0, x - 4), bx1 = Math.max(bx1, x + 4), by0 = Math.min(by0, y - 4), by1 = Math.max(by1, y + 4);
      }
      // the counterweight swings opposite
      const cx = -11 * Math.cos(a), cy = -11 * Math.sin(a);
      bx0 = Math.min(bx0, cx - 2), bx1 = Math.max(bx1, cx + 2), by0 = Math.min(by0, cy - 2), by1 = Math.max(by1, cy + 2);
    }
    const k = Math.min(W / (bx1 - bx0), (MAX_H - 20) / (by1 - by0));
    this.k = k;
    const P = (x: number, y: number): Pt => [(x - bx0) * k, (by1 - y) * k];
    this.P = P;
    this.w = (bx1 - bx0) * k;
    this.h = (by1 - by0) * k;

    const low = el("g", root);
    const axisG = el("g", root);
    const high = el("g", root);
    const crane = new PlanCrane(low, high, P, k);
    const mk = () => {
      const g = el("g", axisG);
      return { g, line: el("line", g, {}, "cfb-axisline") };
    };
    const lines = { front: mk(), rear: mk(), left: mk(), right: mk() };
    // the axis distance, measured along the boom
    const dimG = el("g", root);
    const dim = dimension(dimG);
    const cross = el("circle", dimG, { r: 10 }, "cfb-cross");
    const dimPill = pill(dimG);
    this.plan = { crane, axisG, lines, dimG, dim, cross, dimPill };

    this.parts = [
      "base", "base.crane", "base.boom", "base.load", "base.center", "base.outriggers",
      "base.float.fl", "base.float.fr", "base.float.rl", "base.float.rr",
      "base.axis", "base.axis.front", "base.axis.rear", "base.axis.left", "base.axis.right", "base.axisDim",
    ];
  }

  private drawPlan(tl: CraneTimeline, t: number) {
    const p = this.plan!;
    const { P, k } = this;
    const A = tl.value("base.axis", t), S = tl.value("base.swing", t), R = tl.value("base.radius", t);
    const op = (n: string) => tl.opacity(n, t);
    const lit = (n: string) => tl.light(n, t);
    const F = this.front, B = this.rear;
    p.crane.update(A, F, B, S, R);

    // which edge of the outrigger box the boom crosses
    const a = (S * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const tx = c > 1e-6 ? F / c : c < -1e-6 ? B / -c : Infinity;
    const ty = Math.abs(s) > 1e-6 ? A / Math.abs(s) : Infinity;
    const d = Math.min(tx, ty);
    const corner = Math.abs(tx - ty) < 0.35;
    const live = {
      front: c > 0 && (tx < ty || corner), rear: c < 0 && (tx < ty || corner),
      left: s > 0 && (ty < tx || corner), right: s < 0 && (ty < tx || corner),
    };
    const E = 4.5;
    const ends: Record<keyof typeof live, [Pt, Pt]> = {
      front: [P(F, -(A + E)), P(F, A + E)], rear: [P(-B, -(A + E)), P(-B, A + E)],
      left: [P(-(B + E), A), P(F + E, A)], right: [P(-(B + E), -A), P(F + E, -A)],
    };
    for (const key of Object.keys(live) as (keyof typeof live)[]) {
      const { g, line } = p.lines[key];
      const [q0, q1] = ends[key];
      set(line, { x1: q0[0], y1: q0[1], x2: q1[0], y2: q1[1] });
      line.classList.toggle("is-live", live[key]);
      glow(g, lit(`base.axis.${key}`));
      fade(g, op(`base.axis.${key}`));
    }
    fade(p.axisG, op("base.axis"));

    // the distance: along the boom, from the centre of rotation to the live axis
    const X: Pt = [d * c, d * s];
    const o = P(0, 0), x = P(...X);
    const len = Math.hypot(x[0] - o[0], x[1] - o[1]) || 1;
    p.dim([o[0] + ((x[0] - o[0]) / len) * 14, o[1] + ((x[1] - o[1]) / len) * 14], x);
    set(p.cross, { cx: x[0], cy: x[1] });
    // its label sits just outside the live axis, on the side the boom leans away from
    const label = `${ft(d)} ft`;
    const pw = p.dimPill.put(label, -999, -999);
    const hx = pw / 2 / k, hy = 26 / k, m = 26 / k;
    let at: Pt;
    if (corner) {
      const qx = s >= 0 ? 1 : -1, qy = c > 0 ? -1 : 1;
      at = [X[0] + qx * (hx + m + 1.4), X[1] + qy * (hy + m + 1.4)];
    } else {
      const n: Pt = live.front ? [1, 0] : live.rear ? [-1, 0] : live.left ? [0, 1] : [0, -1];
      let e: Pt = [-n[1], n[0]];
      const lean = e[0] * c + e[1] * s;
      if (lean > 0.05 || (Math.abs(lean) <= 0.05 && e[0] * s - e[1] * c < 0)) e = [-e[0], -e[1]];
      const clear = 1.3 / Math.max(0.3, Math.abs(n[0] * c + n[1] * s));
      const hN = Math.abs(n[0]) * hx + Math.abs(n[1]) * hy, hE = Math.abs(e[0]) * hx + Math.abs(e[1]) * hy;
      at = [X[0] + n[0] * (hN + m) + e[0] * (hE + m + clear), X[1] + n[1] * (hN + m) + e[1] * (hE + m + clear)];
    }
    const [lx, ly] = P(...at);
    p.dimPill.put(label, lx, ly);
    glow(p.dimG, lit("base.axisDim"));
    fade(p.dimG, op("base.axisDim"));

    const cr = p.crane;
    const crane = (g: SVGGElement, name: string) => {
      glow(g, lit(name));
      fade(g, op(name));
    };
    crane(cr.carrier, "base.crane");
    crane(cr.upper, "base.crane");
    crane(cr.center, "base.center");
    crane(cr.boom, "base.boom");
    crane(cr.load, "base.load");
    glow(cr.outriggers, lit("base.outriggers"));
    fade(cr.outriggers, op("base.outriggers"));
    for (const key of ["fl", "fr", "rl", "rr"] as const) {
      glow(cr.floats[key], Math.max(lit(`base.float.${key}`), lit("base.outriggers")));
      fade(cr.floats[key], op(`base.float.${key}`));
    }
    void k;
  }

  draw(tl: CraneTimeline, t: number) {
    if (this.view === "plan") this.drawPlan(tl, t);
    else this.drawSide(tl, t);
  }
}

/** A point turned clockwise (the crane tipping toward +x) by `deg` about the float at (axis, 0). */
function rotAbout([x, y]: Pt, axis: number, deg: number): Pt {
  if (Math.abs(deg) < 1e-6) return [x, y];
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const dx = x - axis;
  return [axis + dx * c + y * s, -dx * s + y * c];
}

/** A panel cell lit amber: dark text on the light once it is more than half lit. */
export function litCell(cell: SVGPathElement, cap: SVGTextElement, value: SVGTextElement, em: number) {
  cell.style.fill = em <= 0.001 ? "" : `color-mix(in srgb, var(--cf-light) ${Math.round(em * 100)}%, var(--cf-panel-cell))`;
  cap.style.fill = em > 0.5 ? "var(--cf-light-ink)" : "";
  value.style.fill = em > 0.5 ? "var(--cf-light-ink)" : "";
}
