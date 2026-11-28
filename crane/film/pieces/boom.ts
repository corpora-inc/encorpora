/**
 * The crane at radius: a truck crane on outriggers seen from the side, its
 * telescopic boom raised so the hook hangs at `radius` from the center of
 * rotation, with a dimension under it and an instrument strip that reads the
 * boom length, the radius and the gross capacity the load chart gives there.
 *
 *   { "boom": { "chart": "ht-50", "config": "outriggers-full-360", "length": 74, "radius": 30,
 *               "load": 18000, "jib": true, "readouts": ["boom", "radius", "capacity"] } }
 *
 * Values (`set`): boom.radius, boom.length (feet). The boom's angle follows from
 * the chart's own geometry (boom foot behind the center pin), so the picture is
 * to scale. Parts: boom.crane, boom.sections, boom.axis, boom.radius, boom.line,
 * boom.block, boom.slings, boom.load, boom.jib, boom.readout.<boom|radius|angle|capacity>.
 */
import { capacityAt, getChart, getConfiguration, type Chart } from "../../content/tools/loadcharts/index.ts";
import { arrowHead, el, fade, lb, pts, roundRect, set, text, type Pt } from "../draw";
import type { CraneTimeline } from "../timeline";
import { known, num, str, strs, type Piece, type PieceInit, type Spec } from "./piece";

const FIELDS = ["chart", "config", "length", "radius", "load", "jib", "rigging", "readouts", "hidden"] as const;
const READOUTS = ["boom", "radius", "angle", "capacity"] as const;
type Readout = (typeof READOUTS)[number];
const CAPTION: Record<Readout, string> = { boom: "Boom", radius: "Radius", angle: "Boom angle", capacity: "Gross capacity" };

/** Natural size: the stage fits it to the card, shrinking only. */
const W = 880, STRIP = 150, GAP = 34;
/** Ground and carrier, in feet. The boom foot is the chart's own (pivotOffsetFt, pivotHeightFt). */
const DECK: [number, number] = [3.2, 5.6];
const BLOCK_Y = 15;
const LOAD_W = 8, LOAD_H = 4, LOAD_LIFT = 2.2;

/** A paint that leans toward the light as `em` rises: color-mix keeps it one smooth change. */
const mix = (base: string, lit: string, em: number) => (em <= 0.001 ? base : `color-mix(in srgb, ${lit} ${Math.round(em * 100)}%, ${base})`);

export class BoomPiece implements Piece {
  readonly w: number;
  readonly h: number;
  readonly parts: string[];
  readonly initial: Record<string, number>;
  readonly hidden: string[];
  private chart: Chart;
  private config: string;
  private readouts: Readout[];
  private k: number;
  private x0: number;
  private yTop: number;
  private g: {
    sections: SVGGElement; secs: SVGPolygonElement[]; head: SVGPathElement; sheave: SVGCircleElement; cyl: SVGLineElement;
    jib: SVGGElement; jibBody: SVGPolygonElement; jibLattice: SVGPathElement;
    line: SVGLineElement; block: SVGGElement; blockBody: SVGPathElement; hook: SVGPathElement;
    slings: SVGGElement; slingL: SVGLineElement; slingR: SVGLineElement;
    load: SVGGElement; loadBody: SVGPathElement; loadText: SVGTextElement;
    axis: SVGGElement; radius: SVGGElement; dimLine: SVGLineElement; dimA: SVGPathElement; dimB: SVGPathElement; extR: SVGLineElement;
    dimPill: SVGPathElement; dimText: SVGTextElement; crane: SVGGElement;
    cells: Map<Readout, { g: SVGGElement; bg: SVGPathElement; value: SVGTextElement; cap: SVGTextElement }>;
  };
  private loadLb: number | undefined;

  constructor(spec: Spec, private init: PieceInit) {
    const where = "crane.boom";
    const { issues } = init;
    known(spec, FIELDS, issues, where);
    const chartId = str(spec, "chart", "ht-50", issues, where);
    try {
      this.chart = getChart(chartId);
    } catch {
      issues.push(`${where}.chart "${chartId}" is not one of our charts (crane/content/tools/loadcharts).`);
      this.chart = getChart("ht-50");
    }
    this.config = str(spec, "config", this.chart.configurations[0]!.id, issues, where);
    try {
      getConfiguration(this.chart, this.config);
    } catch {
      issues.push(`${where}.config "${this.config}" is not a configuration of ${this.chart.id}.`);
      this.config = this.chart.configurations[0]!.id;
    }
    const length = num(spec, "length", 74, issues, where);
    const radius = num(spec, "radius", 30, issues, where);
    this.initial = { "boom.length": length, "boom.radius": radius };
    const ro = spec.readouts === undefined ? ["boom", "radius", "capacity"] : strs(spec, "readouts", issues, where);
    this.readouts = ro.filter((r): r is Readout => {
      if ((READOUTS as readonly string[]).includes(r)) return true;
      issues.push(`${where}.readouts: "${r}" is not a readout (${READOUTS.join(", ")}).`);
      return false;
    });
    this.loadLb = spec.load === undefined ? undefined : num(spec, "load", 0, issues, where);
    const jib = spec.jib === true;
    const rigging = spec.rigging !== false;
    this.hidden = strs(spec, "hidden", issues, where);

    // The frame holds every position this shot takes the boom to.
    const [lMin, lMax] = init.range("boom.length", length);
    const [rMin, rMax] = init.range("boom.radius", radius);
    if (!this.chart.geometry) issues.push(`${where}: chart ${this.chart.id} has no boom geometry to draw a boom from.`);
    const g0 = this.geo;
    for (const [l, r] of [[lMin, rMin], [lMin, rMax], [lMax, rMin], [lMax, rMax]] as const)
      if (r - g0.pivotOffsetFt > l) issues.push(`${where}: a ${l} ft boom cannot reach a ${r} ft radius.`);
    const tipMax = g0.pivotHeightFt + Math.sqrt(Math.max(0, lMax * lMax - (rMin - g0.pivotOffsetFt) ** 2));
    this.x0 = -26;
    const x1 = Math.max(rMax + LOAD_W / 2 + (spec.load === undefined ? 3 : 19), 24);
    this.yTop = tipMax + 4;
    const yBottom = -8;
    const drawH = 880 - STRIP - GAP;
    this.k = Math.min(W / (x1 - this.x0), drawH / (this.yTop - yBottom));
    this.w = W;
    const drawnH = (this.yTop - yBottom) * this.k;
    this.h = drawnH + (this.readouts.length ? GAP + STRIP : 0);

    const root = init.root;
    const P = (x: number, y: number): Pt => [(x - this.x0) * this.k + (W - (x1 - this.x0) * this.k) / 2, (this.yTop - y) * this.k];
    this.P = P;
    const k = this.k;

    // ground
    const gl = P(this.x0 + 0.5, 0), gr = P(x1 - 0.5, 0);
    el("rect", root, { x: gl[0], y: gl[1], width: gr[0] - gl[0], height: 1.1 * k }, "cf-ground");
    el("line", root, { x1: gl[0], y1: gl[1], x2: gr[0], y2: gr[1] }, "cf-ground-line");

    // the carrier on its outriggers, and the upper works that turn on it
    const crane = el("g", root);
    const poly = (list: Pt[], cls: string, parent: Element = crane) => el("polygon", parent, { points: pts(list.map(([x, y]) => P(x, y))) }, cls);
    const rect = (x: number, y: number, w: number, h: number, cls: string, r = 0.35, parent: Element = crane) => {
      const [px, py] = P(x, y + h);
      return el("path", parent, { d: roundRect(px, py, w * k, h * k, r * k) }, cls);
    };
    for (const jx of [-16.5, 8.5]) {
      rect(jx - 0.45, 0.6, 0.9, DECK[0] - 0.6 + 0.2, "cf-steel-dark", 0.1);
      rect(jx - 1.6, 0, 3.2, 0.6, "cf-steel-dark", 0.15);
    }
    for (const wx of [-13.5, -9.8, 2.2, 5.9]) {
      const [cx, cy] = P(wx, 2.25);
      el("circle", crane, { cx, cy, r: 1.75 * k }, "cf-tire");
      el("circle", crane, { cx, cy, r: 0.8 * k }, "cf-hub");
    }
    rect(-18, DECK[0], 28, DECK[1] - DECK[0], "cf-steel-dark", 0.3);
    poly([[6, DECK[1]], [10.4, DECK[1]], [10.4, 9.4], [9.2, 10.6], [6, 10.6]], "cf-steel");
    poly([[8.6, 9.6], [9.9, 9.6], [9.9, 7.4], [8.6, 7.4]], "cf-glass");
    rect(-3.2, DECK[1], 6.4, 0.9, "cf-steel-dark", 0.15);
    rect(-12, 6.5, 14, 4.2, "cf-steel", 0.5);
    rect(-15.6, 6.5, 5, 4.6, "cf-counterweight", 0.4);
    poly([[-0.4, 7.2], [2.4, 7.2], [2.4, 10.2], [0.6, 10.2]], "cf-glass");
    // boom foot pin
    const [fx, fy] = P(g0.pivotOffsetFt, g0.pivotHeightFt);
    el("circle", crane, { cx: fx, cy: fy, r: 0.75 * k }, "cf-pin");

    // the axis of rotation: the line the radius is measured from
    const axis = el("g", root);
    const [ax0, ay0] = P(0, -4.6), [, ay1] = P(0, 22);
    el("line", axis, { x1: ax0, y1: ay0, x2: ax0, y2: ay1 }, "cf-centerline");

    // the boom: base section and four telescoping sections, drawn tip first so each sits inside the one before
    const sections = el("g", root);
    const cyl = el("line", sections, {}, "cf-cylinder");
    const secs: SVGPolygonElement[] = [];
    for (let i = 0; i < 5; i++) secs.unshift(el("polygon", sections, {}, i === 4 ? "cf-boom cf-boom-base" : "cf-boom"));
    const head = el("path", sections, {}, "cf-boom-head");
    const sheave = el("circle", sections, {}, "cf-sheave");

    // the extension stowed along the base section: part of the load the chart deducts
    const jibG = el("g", root);
    const jibBody = el("polygon", jibG, {}, "cf-jib");
    const jibLattice = el("path", jibG, {}, "cf-jib-lattice");
    if (!jib) jibG.style.display = "none";

    // the hoist line, block, slings and load
    const line = el("line", root, {}, "cf-rope");
    const slings = el("g", root);
    const slingL = el("line", slings, {}, "cf-sling");
    const slingR = el("line", slings, {}, "cf-sling");
    const block = el("g", root);
    const blockBody = el("path", block, {}, "cf-block");
    const hook = el("path", block, {}, "cf-hook");
    const load = el("g", root);
    const loadBody = el("path", load, {}, "cf-load");
    const loadText = text(load, 0, 0, this.loadLb === undefined ? "" : `${lb(this.loadLb)} lb`, "cf-load-text", "start");
    if (!rigging) { slings.style.display = "none"; block.style.display = "none"; }
    if (this.loadLb === undefined && !rigging) load.style.display = "none";

    // the radius: from the axis of rotation to the hoist line, on the ground
    const radiusG = el("g", root);
    const dimLine = el("line", radiusG, {}, "cf-dim");
    const dimA = el("path", radiusG, {}, "cf-dim-head");
    const dimB = el("path", radiusG, {}, "cf-dim-head");
    const extR = el("line", radiusG, {}, "cf-dim-ext");
    const [, ey0] = P(0, -1), [, ey1] = P(0, -5.2);
    el("line", radiusG, { x1: ax0, y1: ey0, x2: ax0, y2: ey1 }, "cf-dim-ext");
    const dimPill = el("path", radiusG, {}, "cf-dim-pill");
    const dimText = text(radiusG, 0, 0, "", "cf-dim-text", "middle");

    // the instrument strip: what the crane's capacity display would read
    const cells = new Map<Readout, { g: SVGGElement; bg: SVGPathElement; value: SVGTextElement; cap: SVGTextElement }>();
    if (this.readouts.length) {
      const top = drawnH + GAP;
      const strip = el("g", root);
      el("path", strip, { d: roundRect(0, top, W, STRIP, 22) }, "cf-panel");
      const n = this.readouts.length, pad = 14;
      const cw = (W - pad * (n + 1)) / n;
      this.readouts.forEach((r, i) => {
        const g = el("g", strip);
        const x = pad + i * (cw + pad);
        const bg = el("path", g, { d: roundRect(x, top + pad, cw, STRIP - 2 * pad, 14) }, "cf-panel-cell");
        const cap = text(g, x + cw / 2, top + pad + 40, CAPTION[r].toUpperCase(), "cf-panel-cap", "middle");
        const value = text(g, x + cw / 2, top + STRIP - pad - 24, "", r === "capacity" ? "cf-panel-value cf-panel-capacity" : "cf-panel-value", "middle");
        cells.set(r, { g, bg, value, cap });
      });
    }

    this.g = { sections, secs, head, sheave, cyl, jib: jibG, jibBody, jibLattice, line, block, blockBody, hook, slings, slingL, slingR, load, loadBody, loadText, axis, radius: radiusG, dimLine, dimA, dimB, extR, dimPill, dimText, crane, cells };
    this.parts = ["boom", "boom.crane", "boom.sections", "boom.axis", "boom.radius", "boom.line", "boom.block", "boom.slings", "boom.load", "boom.jib", "boom.readout", ...this.readouts.map((r) => `boom.readout.${r}`)];
  }
  private P: (x: number, y: number) => Pt;
  /** The chart's boom foot (behind and above the center pin); a chart without one draws with the HT-50's. */
  private get geo() {
    return this.chart.geometry ?? { pivotOffsetFt: -4, pivotHeightFt: 8 };
  }

  draw(tl: CraneTimeline, t: number) {
    const { g, P, k } = this;
    const geo = this.geo;
    const L = tl.value("boom.length", t), R = tl.value("boom.radius", t);
    const cos = Math.min(1, Math.max(-1, (R - geo.pivotOffsetFt) / L));
    const th = Math.acos(cos);
    const ux = Math.cos(th), uy = Math.sin(th);
    const foot: Pt = [geo.pivotOffsetFt, geo.pivotHeightFt];
    const along = (s: number, off = 0): Pt => [foot[0] + ux * s - uy * off, foot[1] + uy * s + ux * off];
    const tip = along(L);
    const op = (name: string) => tl.opacity(name, t);
    const lit = (name: string) => tl.light(name, t);

    // boom sections: base 0..baseLen, each other section shows its run past the one below it
    const base = Math.min(L, this.chart.boom.minLengthFt);
    const ext = (L - base) / 4;
    const widths = [3.1, 2.7, 2.35, 2.05, 1.8];
    let start = 0, end = base;
    for (let i = 0; i < 5; i++) {
      const w = widths[i]! / 2;
      const s0 = i === 0 ? -0.9 : start, s1 = end;
      const quad = [along(s0, w), along(s1, w * 0.97), along(s1, -w * 0.97), along(s0, -w)];
      set(g.secs[i]!, { points: pts(quad.map(([x, y]) => P(x, y))) });
      g.secs[i]!.style.display = s1 - s0 < 0.05 && i > 0 ? "none" : "";
      start = end - 1.2;
      end = end + ext;
    }
    const hw = widths[4]! / 2 + 0.25;
    const headPts = [along(L - 2.2, hw), along(L + 0.6, hw), along(L + 1.4, 0), along(L + 0.6, -hw - 0.5), along(L - 2.2, -hw)].map(([x, y]) => P(x, y));
    set(g.head, { d: `M${headPts.map((p) => p.join(",")).join("L")}z` });
    const sheaveC = along(L + 0.25, -0.15);
    const [scx, scy] = P(sheaveC[0], sheaveC[1]);
    set(g.sheave, { cx: scx, cy: scy, r: 0.95 * k });
    const cylA = P(-1.2, 7.1), cylB = P(...along(base * 0.42, -0.2));
    set(g.cyl, { x1: cylA[0], y1: cylA[1], x2: cylB[0], y2: cylB[1] });
    const boomLit = lit("boom.sections");
    g.sections.style.setProperty("--cf-em", String(boomLit));
    for (const s of g.secs) s.style.fill = mix("var(--cf-boom)", "var(--cf-light)", boomLit * 0.55);
    fade(g.sections, op("boom.sections"));

    // the stowed extension rides under the base section
    const jq = [along(3, -1.65), along(32, -1.65), along(32, -2.75), along(3, -2.75)];
    set(g.jibBody, { points: pts(jq.map(([x, y]) => P(x, y))) });
    let lat = "";
    for (let s = 3; s < 32; s += 2.9) {
      const a = P(...along(s, -1.65)), b = P(...along(s + 1.45, -2.75)), c = P(...along(s + 2.9, -1.65));
      lat += `M${a[0]},${a[1]}L${b[0]},${b[1]}L${c[0]},${c[1]}`;
    }
    set(g.jibLattice, { d: lat });
    const jl = lit("boom.jib");
    g.jibBody.style.fill = mix("var(--cf-steel)", "var(--cf-light)", jl);
    g.jibBody.style.stroke = mix("var(--cf-ink-2)", "var(--cf-light-edge)", jl);
    g.jibBody.style.strokeWidth = String(3 + 3 * jl);
    fade(g.jib, op("boom.jib"));

    // hoist line, block, slings, load: all plumb under the tip
    const tipY = tip[1];
    const blockY = Math.min(BLOCK_Y, tipY - 5);
    const [lx, ly0] = P(R, tipY - 0.9), [, ly1] = P(R, blockY + 1.8);
    set(g.line, { x1: lx, y1: ly0, x2: lx, y2: ly1 });
    fade(g.line, op("boom.line"));
    const [bx, by] = P(R - 1.25, blockY + 1.9);
    set(g.blockBody, { d: roundRect(bx, by, 2.5 * k, 3.4 * k, 0.6 * k) });
    const hookTop = P(R, blockY - 1.5), hookBot = P(R, blockY - 2.6);
    set(g.hook, { d: `M${hookTop[0]},${hookTop[1]}L${hookBot[0]},${hookBot[1]}a${0.55 * k},${0.55 * k} 0 1 0 ${1.1 * k},0` });
    const bl = lit("boom.block");
    g.blockBody.style.fill = mix("var(--cf-steel-dark)", "var(--cf-light)", bl);
    g.blockBody.style.strokeWidth = String(3 + 3 * bl);
    g.blockBody.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", bl);
    fade(g.block, op("boom.block"));
    const hk = P(R, blockY - 2.9);
    const loadTop = LOAD_LIFT + LOAD_H;
    const sl = P(R - LOAD_W / 2 + 0.8, loadTop), sr = P(R + LOAD_W / 2 - 0.8, loadTop);
    set(g.slingL, { x1: hk[0], y1: hk[1], x2: sl[0], y2: sl[1] });
    set(g.slingR, { x1: hk[0], y1: hk[1], x2: sr[0], y2: sr[1] });
    const sg = lit("boom.slings");
    for (const s of [g.slingL, g.slingR]) {
      s.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", sg);
      s.style.strokeWidth = String(5 + 4 * sg);
    }
    fade(g.slings, op("boom.slings"));
    const [ldx, ldy] = P(R - LOAD_W / 2, loadTop);
    set(g.loadBody, { d: roundRect(ldx, ldy, LOAD_W * k, LOAD_H * k, 0.35 * k) });
    const ll = lit("boom.load");
    g.loadBody.style.fill = mix("var(--cf-load)", "var(--cf-light)", ll);
    g.loadBody.style.stroke = mix("var(--cf-ink-2)", "var(--cf-light-edge)", ll);
    g.loadBody.style.strokeWidth = String(3 + 3 * ll);
    // the weight is written beside the load, never squeezed into it
    const [ltx, lty] = P(R + LOAD_W / 2 + 0.8, LOAD_LIFT + LOAD_H / 2);
    set(g.loadText, { x: ltx, y: lty + 0.36 * 36 });
    fade(g.load, op("boom.load"));

    fade(g.crane, op("boom.crane"));
    const axl = lit("boom.axis");
    g.axis.style.setProperty("stroke", mix("var(--cf-ink-3)", "var(--cf-light-edge)", axl));
    fade(g.axis, op("boom.axis"));

    // the radius dimension
    const dy = -3.6;
    const a = P(0, dy), b = P(R, dy);
    set(g.dimLine, { x1: a[0] + 2, y1: a[1], x2: b[0] - 2, y2: b[1] });
    set(g.dimA, { d: arrowHead(a, b, 0.9 * k + 6) });
    set(g.dimB, { d: arrowHead(b, a, 0.9 * k + 6) });
    const e0 = P(R, LOAD_LIFT - 0.4), e1 = P(R, -5.2);
    set(g.extR, { x1: e0[0], y1: e0[1], x2: e1[0], y2: e1[1] });
    const shown = Math.round(tl.value("boom.radius", t));
    g.dimText.textContent = `${shown} ft`;
    const mid = P(R / 2, dy);
    const tw = 30 + 22 * String(shown).length + 40;
    set(g.dimPill, { d: roundRect(mid[0] - tw / 2, mid[1] - 26, tw, 52, 26) });
    set(g.dimText, { x: mid[0], y: mid[1] + 14 });
    const rl = lit("boom.radius");
    g.dimPill.style.fill = mix("var(--cf-paper)", "var(--cf-light)", rl);
    g.dimLine.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", rl);
    g.dimLine.style.strokeWidth = String(3.5 + 2.5 * rl);
    for (const h of [g.dimA, g.dimB]) h.style.fill = mix("var(--cf-ink)", "var(--cf-light-edge)", rl);
    fade(g.radius, op("boom.radius"));

    // the strip
    const deg = (th * 180) / Math.PI;
    for (const [r, c] of g.cells) {
      let v = "";
      if (r === "boom") v = `${Math.round(L)} ft`;
      if (r === "radius") v = `${shown} ft`;
      if (r === "angle") v = `${Math.round(deg)}°`;
      if (r === "capacity") {
        const q = capacityAt(this.chart, { config: this.config, boomLength: Math.round(L), radius: R });
        v = q.permitted ? `${lb(q.grossLb)} lb` : "No rating";
      }
      c.value.textContent = v;
      const em = lit(`boom.readout.${r}`);
      c.bg.style.fill = mix("var(--cf-panel-cell)", "var(--cf-light)", em);
      c.value.style.fill = em > 0.5 ? "var(--cf-light-ink)" : "";
      c.cap.style.fill = em > 0.5 ? "var(--cf-light-ink)" : "";
      fade(c.g, op(`boom.readout.${r}`));
    }
  }
}
