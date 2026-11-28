/**
 * Parts of line: the boom-tip sheaves above and the hook block below, seen
 * from the front, with one continuous hoist rope reeved between them. The
 * lead line comes over the first tip sheave from the drum; every run of rope
 * between the tip and the block is a part of line holding the block; the
 * rope's end is dead-ended at the tip (an even number of parts) or at the
 * block (an odd number). Each part carries the same tension T, so the load
 * per part is the load over the parts, and the rope can lift parts × its
 * permissible line pull.
 *
 *   { "reeving": { "parts": 4, "load": 40000, "linePull": 10000, "deadEnd": "tip",
 *                  "readouts": ["parts", "perpart", "capacity", "check"] } }
 *
 * Spec: parts (1-10), load (lb under the block, the block included), linePull
 * (lb, the rope's permissible single-part pull; ht-50's is 10,000), deadEnd
 * ("tip" | "block", optional: it must agree with the count, even = tip),
 * readouts, hidden.
 *
 * Values (`set`): reeving.parts (a whole number: on a re-reeve the old reeving
 * fades out, then the new one fades in; the dead end moves with the count), reeving.load (lb).
 * Parts: reeving.tip, reeving.block (with its hook), reeving.part.<1..n>,
 * reeving.tension (every T label), reeving.lead, reeving.rope (the turns over
 * the sheaves), reeving.deadend, reeving.load, reeving.readout.<parts|perpart|capacity|check>.
 */
import { arrowHead, el, fade, lb, roundRect, set, text, type Pt } from "../draw";
import type { CraneTimeline } from "../timeline";
import { known, num, str, strs, type Piece, type PieceInit, type Spec } from "./piece";

const FIELDS = ["parts", "load", "linePull", "deadEnd", "readouts", "hidden"] as const;
const READOUTS = ["parts", "perpart", "capacity", "check"] as const;
type Readout = (typeof READOUTS)[number];
const CAPTION: Record<Exclude<Readout, "check">, string> = { parts: "Parts of line", perpart: "Load per part", capacity: "Line capacity" };
const MAX_PARTS = 10;

/** Natural size: the stage fits it to the card, shrinking only. */
const W = 880, H_MAX = 880;
/** Room left of the first sheave for the lead line and its label, and right of the last part for the dead end's. */
const LEFT = 200, RIGHT = 186;
/** Below the block: hook, slings, load. The instrument strip: a row of cells and the check row. */
const CELLS = 150, CHECK = 64, GAP = 34;
const SOCKET = 38;

const mix = (base: string, lit: string, em: number) => (em <= 0.001 ? base : `color-mix(in srgb, ${lit} ${Math.round(em * 100)}%, ${base})`);

type Reeve = {
  n: number;
  g: SVGGElement;
  tip: SVGGElement; tipBox: SVGPathElement; tipSheaves: SVGCircleElement[];
  block: SVGGElement; blockBox: SVGPathElement; blockSheaves: SVGCircleElement[];
  rope: SVGPathElement;
  lead: SVGGElement; leadRope: SVGElement[]; leadHead: SVGPathElement;
  parts: SVGLineElement[];
  pills: { g: SVGGElement; bg: SVGPathElement; t: SVGTextElement }[];
  tension: SVGGElement;
  dead: SVGGElement; socket: SVGPathElement;
};

export class ReevingPiece implements Piece {
  readonly w = W;
  readonly h: number;
  readonly parts: string[];
  readonly initial: Record<string, number>;
  readonly hidden: string[];
  private pull: number;
  private readouts: Readout[];
  private s: number;
  private r: number;
  private rf: number;
  private c: number;
  private yt: number;
  private yb: number;
  private reeves = new Map<number, Reeve>();
  private layer: SVGGElement;
  private common: {
    hook: SVGPathElement; blockCap: SVGTextElement; load: SVGGElement; loadBody: SVGPathElement; loadText: SVGTextElement; slings: SVGPathElement;
    cells: Map<Readout, { g: SVGGElement; bg: SVGPathElement; value: SVGTextElement; num: SVGTSpanElement; unit: SVGTSpanElement; cap?: SVGTextElement }>;
    check?: { g: SVGGElement; bg: SVGPathElement; t: SVGTextElement; load: SVGTSpanElement; sign: SVGTSpanElement; cap: SVGTSpanElement };
  };
  private changes?: { tl: CraneTimeline; list: { t: number; from: number; to: number }[] };

  constructor(spec: Spec, init: PieceInit) {
    const where = "crane.reeving";
    const { issues, root } = init;
    known(spec, FIELDS, issues, where);
    let parts = num(spec, "parts", 4, issues, where);
    if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS) {
      issues.push(`${where}.parts must be a whole number from 1 to ${MAX_PARTS}.`);
      parts = Math.min(MAX_PARTS, Math.max(1, Math.round(parts)));
    }
    const load = num(spec, "load", 40000, issues, where);
    if (load < 0) issues.push(`${where}.load cannot be negative.`);
    this.pull = num(spec, "linePull", 10000, issues, where);
    if (this.pull <= 0) { issues.push(`${where}.linePull must be more than zero.`); this.pull = 10000; }
    const dead = str(spec, "deadEnd", parts % 2 === 0 ? "tip" : "block", issues, where);
    if (dead !== "tip" && dead !== "block") issues.push(`${where}.deadEnd is "tip" or "block".`);
    else if ((dead === "tip") !== (parts % 2 === 0))
      issues.push(`${where}: ${parts} parts dead-end at the ${parts % 2 === 0 ? "tip" : "block"} (an even count ends at the tip, an odd one at the block). Change deadEnd or the parts.`);
    this.initial = { "reeving.parts": parts, "reeving.load": load };
    const ro = spec.readouts === undefined ? [...READOUTS] : strs(spec, "readouts", issues, where);
    this.readouts = ro.filter((r): r is Readout => {
      if ((READOUTS as readonly string[]).includes(r)) return true;
      issues.push(`${where}.readouts: "${r}" is not a readout (${READOUTS.join(", ")}).`);
      return false;
    });
    this.hidden = strs(spec, "hidden", issues, where);

    const [lo, hi] = init.range("reeving.parts", parts);
    if (lo < 1 || hi > MAX_PARTS) issues.push(`${where}: reeving.parts is set outside 1 to ${MAX_PARTS}.`);
    const nMin = Math.max(1, Math.round(lo)), nMax = Math.min(MAX_PARTS, Math.round(hi));

    // one spacing for every reeving in the shot, so the hook never moves
    this.s = Math.min(72, Math.floor((W - LEFT - RIGHT) / nMax));
    this.r = this.s / 2;
    this.rf = this.r - 3; // the rope rides on the sheave's rim
    const contentW = LEFT + nMax * this.s + RIGHT;
    this.c = (W - contentW) / 2 + LEFT + ((nMax + 1) / 2) * this.s;
    this.yt = this.rf + 72;
    const rope = 352 - 2 * this.rf;
    this.yb = this.yt + rope;

    const strip = this.readouts.length ? GAP + (this.readouts.some((r) => r !== "check") ? CELLS : 0) + (this.readouts.includes("check") ? CHECK : 0) : 0;
    const blockBottom = this.yb + this.rf + 16;
    const hookTop = blockBottom, hookNeck = hookTop + 20, bowl = hookNeck + 50;
    const loadTop = bowl + 42, loadH = 76;
    this.h = loadTop + loadH + strip;
    if (this.h > H_MAX) issues.push(`${where}: the figure is ${Math.round(this.h)} px tall, over ${H_MAX}.`);

    this.layer = el("g", root);
    for (let n = nMin; n <= nMax; n++) this.reeves.set(n, this.build(n));

    // the hook under the block, the load on its slings: the same for every reeving
    const c = this.c;
    const R = 25;
    el("path", root, { d: roundRect(c - 16, hookTop - 2, 32, 16, 5) }, "cf-rv-swivel");
    const hook = el("path", root, { d: `M${c},${hookTop}V${hookNeck}C${c + R * 1.5},${hookNeck + R * 0.35} ${c + R * 1.35},${bowl} ${c},${bowl}C${c - R},${bowl} ${c - R * 1.25},${bowl - R * 0.9} ${c - R},${bowl - R * 1.45}` }, "cf-rv-hook");
    const blockCap = text(root, 0, this.yb + 10, "HOOK BLOCK", "cf-rv-cap", "end");
    const loadG = el("g", root);
    const LW = 300;
    const slings = el("path", loadG, { d: `M${c - LW / 2 + 40},${loadTop}L${c},${bowl}L${c + LW / 2 - 40},${loadTop}` }, "cf-rv-sling");
    const loadBody = el("path", loadG, { d: roundRect(c - LW / 2, loadTop, LW, loadH, 10) }, "cf-load");
    const loadText = text(loadG, c, loadTop + loadH / 2 + 14, "", "cf-rv-load-text", "middle");

    // the instrument strip
    const cells = new Map<Readout, { g: SVGGElement; bg: SVGPathElement; value: SVGTextElement; num: SVGTSpanElement; unit: SVGTSpanElement; cap?: SVGTextElement }>();
    let check: ReevingPiece["common"]["check"];
    if (this.readouts.length) {
      const top = loadTop + loadH + GAP;
      const g = el("g", root);
      const tall = strip - GAP;
      el("path", g, { d: roundRect(0, top, W, tall, 22) }, "cf-panel");
      const row = this.readouts.filter((r): r is Exclude<Readout, "check"> => r !== "check");
      const pad = 14;
      const cw = row.length ? (W - pad * (row.length + 1)) / row.length : 0;
      row.forEach((r, i) => {
        const cg = el("g", g);
        const x = pad + i * (cw + pad);
        const bg = el("path", cg, { d: roundRect(x, top + pad, cw, CELLS - 2 * pad, 14) }, "cf-panel-cell");
        const cap = text(cg, x + cw / 2, top + pad + 38, CAPTION[r].toUpperCase(), "cf-panel-cap", "middle");
        const value = text(cg, x + cw / 2, top + CELLS - pad - 22, "", r === "capacity" ? "cf-panel-value cf-panel-capacity" : "cf-panel-value", "middle");
        const numT = el("tspan", value);
        const unit = el("tspan", value, {}, "cf-rv-unit");
        cells.set(r, { g: cg, bg, value, num: numT, unit, cap });
      });
      if (this.readouts.includes("check")) {
        const y = top + (row.length ? CELLS : pad);
        const cg = el("g", g);
        const bg = el("path", cg, { d: roundRect(pad, y, W - 2 * pad, CHECK - pad, 12) }, "cf-panel-cell");
        const t = text(cg, W / 2, y + (CHECK - pad) / 2 + 12, "", "cf-rv-check", "middle");
        const loadS = el("tspan", t);
        const sign = el("tspan", t, {}, "cf-rv-sign");
        const cap = el("tspan", t);
        check = { g: cg, bg, t, load: loadS, sign, cap };
      }
    }
    this.common = { hook, blockCap, load: loadG, loadBody, loadText, slings, cells, check };

    this.parts = [
      "reeving", "reeving.tip", "reeving.block", "reeving.rope", "reeving.lead", "reeving.deadend", "reeving.tension", "reeving.load",
      ...Array.from({ length: nMax }, (_, i) => `reeving.part.${i + 1}`),
      "reeving.readout", ...this.readouts.map((r) => `reeving.readout.${r}`),
    ];
  }

  /** The x of part k (k = 0 is the lead sheave's far side) when the block hangs on n parts. */
  private xs(n: number) {
    return Array.from({ length: n + 1 }, (_, k) => this.c + (k - (n + 1) / 2) * this.s);
  }

  /** Half the block's width: its sheaves, or its dead end, with a margin; never too narrow for its hook. */
  private blockHalf(n: number) {
    const span = ((n - 1) * this.s) / 2;
    return Math.max(125, span + (n % 2 === 1 ? 30 : this.rf - this.r + 16));
  }

  private build(n: number): Reeve {
    const { r, rf, yt, yb } = this;
    const xs = this.xs(n);
    const g = el("g", this.layer);
    const tipBottom = yt + rf + 14, blockTop = yb - rf - 14;
    const deadTip = n % 2 === 0;

    // the boom tip: the lead sheave, then a sheave over every second turn
    const tipCs = [(xs[0]! + xs[1]!) / 2];
    for (let k = 2; k + 1 <= n; k += 2) tipCs.push((xs[k]! + xs[k + 1]!) / 2);
    const blockCs: number[] = [];
    for (let k = 1; k + 1 <= n; k += 2) blockCs.push((xs[k]! + xs[k + 1]!) / 2);

    const tip = el("g", g);
    let tl = tipCs[0]! - rf - 16, tr = Math.max(tipCs[tipCs.length - 1]! + rf + 16, deadTip ? xs[n]! + 30 : -Infinity);
    if (tr - tl < 250) { const m = (tl + tr) / 2; tl = m - 125; tr = m + 125; }
    const tipBox = el("path", tip, { d: roundRect(tl, 0, tr - tl, tipBottom, 16) }, "cf-rv-frame");
    text(tip, (tl + tr) / 2, 42, "BOOM TIP", "cf-rv-cap", "middle");
    const tipSheaves = tipCs.map((x) => el("circle", tip, { cx: x, cy: yt, r: rf }, "cf-sheave"));
    for (const x of tipCs) el("circle", tip, { cx: x, cy: yt, r: 7 }, "cf-rv-hub");

    const block = el("g", g);
    const half = this.blockHalf(n);
    const blockBox = el("path", block, { d: roundRect(this.c - half, blockTop, 2 * half, yb + rf + 16 - blockTop, 16) }, "cf-rv-frame");
    const blockSheaves = blockCs.map((x) => el("circle", block, { cx: x, cy: yb, r: rf }, "cf-sheave"));
    for (const x of blockCs) el("circle", block, { cx: x, cy: yb, r: 7 }, "cf-rv-hub");

    // the lead line: over the first tip sheave from the drum, leaving down and to the left
    const a = (35 * Math.PI) / 180;
    const lc = tipCs[0]!;
    const tan: Pt = [lc - r * Math.sin(a), yt - r * Math.cos(a)];
    const end: Pt = [tan[0] - 165 * Math.cos(a), tan[1] + 165 * Math.sin(a)];
    const lead = el("g", g);
    const leadLine = el("line", lead, { x1: tan[0], y1: tan[1], x2: end[0] + 10 * Math.cos(a), y2: end[1] - 10 * Math.sin(a) }, "cf-rv-rope");
    const leadHead = el("path", lead, { d: arrowHead([end[0] - 8 * Math.cos(a), end[1] + 8 * Math.sin(a)], tan, 26) }, "cf-rv-head");
    text(lead, end[0], end[1] + 52, "TO DRUM", "cf-rv-cap", "middle");

    // the turns of rope over the sheaves (the parts are drawn over them, one line each)
    const leadTurn = el("path", lead, { d: `M${tan[0].toFixed(2)},${tan[1].toFixed(2)}A${r},${r} 0 0 1 ${xs[1]},${yt}` }, "cf-rv-rope");
    let d = "";
    for (let k = 1; k + 1 <= n; k++) {
      const y = k % 2 === 1 ? yb : yt;
      d += `M${xs[k]},${y}A${r},${r} 0 0 ${k % 2 === 1 ? 0 : 1} ${xs[k + 1]},${y}`;
    }
    const rope = el("path", g, { d }, "cf-rv-rope");

    // the dead end: a wedge socket pinned to the tip or the block
    const dead = el("g", g);
    const xd = xs[n]!;
    const sock = (yRope: number, yPin: number) => {
      const dir = Math.sign(yPin - yRope);
      return `M${xd - 7},${yRope}L${xd + 7},${yRope}L${xd + 13},${yPin + dir * 8}L${xd - 13},${yPin + dir * 8}z`;
    };
    const yRope = deadTip ? tipBottom + SOCKET : blockTop - SOCKET;
    const yPin = deadTip ? tipBottom - 6 : blockTop + 6;
    const socket = el("path", dead, { d: sock(yRope, yPin) }, "cf-rv-socket");
    el("circle", dead, { cx: xd, cy: yPin, r: 5 }, "cf-rv-pin");
    text(dead, xd + 28, deadTip ? tipBottom + 44 : blockTop - 14, "DEAD END", "cf-rv-cap", "start");

    // the parts of line, each its own line, and a T on each
    const parts: SVGLineElement[] = [];
    const tension = el("g", g);
    const pills: Reeve["pills"] = [];
    const yMid = (tipBottom + blockTop) / 2;
    for (let k = 1; k <= n; k++) {
      const y1 = k === n && deadTip ? yRope : yt;
      const y2 = k === n && !deadTip ? yRope : yb;
      parts.push(el("line", g, { x1: xs[k]!, y1, x2: xs[k]!, y2 }, "cf-rv-rope"));
    }
    g.appendChild(rope); // the turns sit on the sheaves, over the part ends
    g.appendChild(dead);
    g.appendChild(tension);
    for (let k = 1; k <= n; k++) {
      const pg = el("g", tension);
      const pw = 40, ph = 50;
      const bg = el("path", pg, { d: roundRect(xs[k]! - pw / 2, yMid - ph / 2, pw, ph, 12) }, "cf-rv-pill");
      const t = text(pg, xs[k]!, yMid + 14, "T", "cf-rv-t", "middle");
      pills.push({ g: pg, bg, t });
    }
    // the lead goes over everything at the tip
    g.appendChild(lead);
    return { n, g, tip, tipBox, tipSheaves, block, blockBox, blockSheaves, rope, lead, leadRope: [leadLine, leadTurn], leadHead, parts, pills, tension, dead, socket };
  }

  /** The re-reeve under way at t: from one count to another, u of the way there. */
  private transition(tl: CraneTimeline, t: number) {
    const key = "reeving.parts";
    if (!this.changes || this.changes.tl !== tl) {
      const list: { t: number; from: number; to: number }[] = [];
      for (const m of [...new Set(tl.moments())].sort((x, y) => x - y)) {
        const from = tl.target(key, m - 1e-6), to = tl.target(key, m);
        if (from !== to) list.push({ t: m, from: Math.round(from), to: Math.round(to) });
      }
      this.changes = { tl, list };
    }
    const last = [...this.changes.list].reverse().find((ch) => ch.t <= t);
    const to = Math.round(tl.target(key, t));
    const from = last ? last.from : to;
    const v = tl.value(key, t);
    const u = from === to ? 1 : Math.min(1, Math.max(0, (v - from) / (to - from)));
    return { from, to, u };
  }

  draw(tl: CraneTimeline, t: number) {
    const op = (name: string) => tl.opacity(name, t);
    const lit = (name: string) => tl.light(name, t);
    const { from, to, u } = this.transition(tl, t);
    const whole = op("reeving");

    const frameLit = (box: SVGPathElement, sheaves: SVGCircleElement[], em: number) => {
      box.style.fill = mix("var(--cf-steel)", "var(--cf-light)", em * 0.6);
      box.style.stroke = mix("var(--cf-ink-2)", "var(--cf-light-edge)", em);
      box.style.strokeWidth = String(3 + 2 * em);
      for (const sh of sheaves) sh.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", em);
    };
    const tipEm = lit("reeving.tip"), blockEm = lit("reeving.block"), leadEm = lit("reeving.lead"), deadEm = lit("reeving.deadend"), ropeEm = lit("reeving.rope");
    for (const [n, rv] of this.reeves) {
      // the old reeving leaves, then the new one arrives: never two drawn over each other
      const w = from === to ? (n === to ? 1 : 0) : n === from ? Math.max(0, 1 - 2 * u) : n === to ? Math.max(0, 2 * u - 1) : 0;
      fade(rv.g, w * whole);
      if (w <= 0.002) continue;
      frameLit(rv.tipBox, rv.tipSheaves, tipEm);
      frameLit(rv.blockBox, rv.blockSheaves, blockEm);
      fade(rv.tip, op("reeving.tip"));
      fade(rv.block, op("reeving.block"));
      rv.rope.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", ropeEm);
      fade(rv.rope, op("reeving.rope"));
      for (const ln of rv.leadRope) {
        ln.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", leadEm);
        ln.style.strokeWidth = String(6 + 4 * leadEm);
      }
      rv.leadHead.style.fill = mix("var(--cf-ink)", "var(--cf-light-edge)", leadEm);
      fade(rv.lead, op("reeving.lead"));
      rv.socket.style.fill = mix("var(--cf-steel-dark)", "var(--cf-light)", deadEm);
      rv.socket.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", deadEm);
      fade(rv.dead, op("reeving.deadend"));
      const tenEm = lit("reeving.tension");
      rv.parts.forEach((line, i) => {
        const name = `reeving.part.${i + 1}`;
        const em = Math.max(lit(name), ropeEm);
        line.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", em);
        line.style.strokeWidth = String(6 + 4 * em);
        fade(line, op(name));
        const p = rv.pills[i]!;
        const pe = Math.max(lit(name), tenEm);
        p.bg.style.fill = mix("var(--cf-paper)", "var(--cf-light)", pe);
        p.bg.style.stroke = mix("var(--cf-ink-2)", "var(--cf-light-edge)", pe);
        p.t.style.fill = pe > 0.5 ? "var(--cf-light-ink)" : "";
        fade(p.g, Math.min(op(name), op("reeving.tension")));
      });
    }

    // hook and load
    const c = this.common;
    const n = u < 0.5 ? from : to;
    set(c.blockCap, { x: this.c - (this.blockHalf(from) + (this.blockHalf(to) - this.blockHalf(from)) * u) - 22 });
    c.hook.style.stroke = mix("var(--cf-ink)", "var(--cf-light-edge)", blockEm);
    fade(c.hook, op("reeving.block") * whole);
    fade(c.blockCap, op("reeving.block") * whole);
    const load = tl.value("reeving.load", t);
    c.loadText.textContent = `${lb(load)} lb`;
    const le = lit("reeving.load");
    c.loadBody.style.fill = mix("var(--cf-load)", "var(--cf-light)", le);
    c.loadBody.style.stroke = mix("var(--cf-ink-2)", "var(--cf-light-edge)", le);
    c.loadBody.style.strokeWidth = String(3 + 3 * le);
    fade(c.load, op("reeving.load") * whole);

    // the strip
    const perPart = load / n, capacity = n * this.pull;
    for (const [r, cell] of c.cells) {
      if (r === "parts") { cell.num.textContent = String(n); cell.unit.textContent = ""; }
      if (r === "perpart") { cell.num.textContent = lb(perPart); cell.unit.textContent = " lb"; }
      if (r === "capacity") { cell.num.textContent = lb(capacity); cell.unit.textContent = " lb"; }
      const em = lit(`reeving.readout.${r}`);
      cell.bg.style.fill = mix("var(--cf-panel-cell)", "var(--cf-light)", em);
      cell.value.style.fill = em > 0.5 ? "var(--cf-light-ink)" : "";
      if (cell.cap) cell.cap.style.fill = em > 0.5 ? "var(--cf-light-ink)" : "";
      fade(cell.g, op(`reeving.readout.${r}`) * whole);
    }
    if (c.check) {
      const over = Math.round(load) > capacity;
      c.check.load.textContent = `Load ${lb(load)} lb`;
      c.check.sign.textContent = over ? "  >  " : "  ≤  ";
      c.check.cap.textContent = `${lb(capacity)} lb line capacity`;
      const em = lit("reeving.readout.check");
      c.check.g.classList.toggle("cf-rv-over", over);
      // over the capacity the row turns red; a light then rings it in amber instead of hiding the red
      c.check.bg.style.fill = over ? "var(--cf-danger)" : mix("var(--cf-panel-cell)", "var(--cf-light)", em);
      c.check.bg.style.stroke = over && em > 0.01 ? "var(--cf-light)" : "";
      c.check.bg.style.strokeWidth = over && em > 0.01 ? String(5 * em) : "";
      const dark = em > 0.5 && !over;
      c.check.t.style.fill = dark ? "var(--cf-light-ink)" : "";
      c.check.sign.style.fill = dark ? "var(--cf-light-ink)" : "";
      fade(c.check.g, op("reeving.readout.check") * whole);
    }
  }
}
