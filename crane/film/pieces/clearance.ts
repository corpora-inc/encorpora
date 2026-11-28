/**
 * Power-line clearance, seen from above. The crane sits at the centre of its
 * work zone: the circle of its maximum working radius, all the way round. A
 * straight power line runs past at `line` feet from the centre, with its
 * clearance band on the near side. Where the circle reaches into the band,
 * the overlap is lit as danger. Readouts: the gap from the circle's edge to
 * the line, and the clearance it must keep.
 *
 *   { "clearance": { "maxRadius": 60, "line": 85, "clearance": 20, "voltage": "13.8 kV", "swing": 25 } }
 *   { "clearance": { "maxRadius": 60, "line": 75, "kv": 345 } }      // Table A: over 200 to 350 kV → 20 ft
 *
 * `clearance` is the band's width in feet: 20 for the 29 CFR 1926.1408(a)(2)
 * work-zone check (the default). Given `kv` instead, the band is Table A's
 * minimum clearance distance for that voltage (crane/content/tools/powerline),
 * and the voltage label reads "<kv> kV" unless `voltage` says otherwise.
 *
 * Values (`set`): clearance.reach (ft from the centre to the boom tip),
 * clearance.swing (degrees: 0 points at the line, 90 up), clearance.line (ft
 * from the centre to the nearest wire). Parts: clearance.crane, clearance.zone
 * (the circle), clearance.radius (its radius dimension), clearance.boom,
 * clearance.line, clearance.voltage, clearance.band (with its width),
 * clearance.overlap, clearance.gap (dimension and readout), clearance.limit
 * (the clearance readout).
 */
import { lookup, TABLE_A } from "../../content/tools/powerline/clearance.ts";
import { el, fade, roundRect, set, text, type Pt } from "../draw";
import type { CraneTimeline } from "../timeline";
import { dimension, ft, glow, litCell, pill, PlanCrane } from "./base";
import { known, num, str, type Piece, type PieceInit, type Spec } from "./piece";

const FIELDS = ["maxRadius", "line", "clearance", "kv", "voltage", "swing", "reach", "readouts", "hidden"] as const;
const W = 880, MAX_H = 880, STRIP = 150, GAP = 34;
/** The three wires, 2.5 ft apart, run away from the crane from `line`. */
const WIRES = [0, 2.5, 5];
/** Px reserved right of the far wire for the voltage tag's half width. */
const TAG = 104;

export class ClearancePiece implements Piece {
  readonly w: number;
  readonly h: number;
  readonly parts: string[];
  readonly initial: Record<string, number>;
  readonly hidden: string[];
  private R: number;
  private clear: number;
  private k: number;
  private P: (x: number, y: number) => Pt;
  private yEnd: number;
  private crane: PlanCrane;
  private g: {
    zone: SVGGElement; zoneC: SVGCircleElement; radius: SVGGElement; radiusDim: (p: Pt, q: Pt) => void; radiusPill: ReturnType<typeof pill>;
    band: SVGGElement; bandRect: SVGRectElement; bandEdge: SVGLineElement; bandDim: (p: Pt, q: Pt) => void; bandPill: ReturnType<typeof pill>;
    overlap: SVGGElement; overlapPath: SVGPathElement;
    line: SVGGElement; wires: SVGLineElement[]; arms: SVGPathElement[]; armYs: number[];
    voltage: SVGGElement; tagBg: SVGPathElement; tagText: SVGTextElement;
    gap: SVGGElement; gapDim: (p: Pt, q: Pt) => void; gapPill: ReturnType<typeof pill>; gapDimG: SVGGElement;
    cells?: { gap: Cell; limit: Cell };
  };

  constructor(spec: Spec, init: PieceInit) {
    const where = "crane.clearance";
    const { issues, root } = init;
    known(spec, FIELDS, issues, where);
    this.R = num(spec, "maxRadius", 60, issues, where);
    const line = num(spec, "line", 85, issues, where);
    const kv = spec.kv === undefined ? undefined : num(spec, "kv", 0, issues, where);
    let tableFt: number | null = null;
    if (kv !== undefined) {
      try {
        tableFt = lookup(TABLE_A, kv).clearance_ft;
        if (tableFt === null) issues.push(`${where}.kv: over 1,000 kV Table A gives no distance (the utility or an engineer sets it); give "clearance" instead.`);
      } catch {
        issues.push(`${where}.kv must be a positive voltage in kV.`);
      }
    }
    this.clear = spec.clearance !== undefined ? num(spec, "clearance", 20, issues, where) : tableFt ?? 20;
    if (this.clear <= 0) issues.push(`${where}.clearance must be more than 0 ft.`);
    const voltage = str(spec, "voltage", kv !== undefined ? `${kv.toLocaleString("en-US")} kV` : "", issues, where);
    const swing = num(spec, "swing", 25, issues, where);
    const reach = num(spec, "reach", this.R, issues, where);
    const readouts = spec.readouts !== false;
    this.hidden = Array.isArray(spec.hidden) ? (spec.hidden as unknown[]).map(String) : [];
    this.initial = { "clearance.reach": reach, "clearance.swing": swing, "clearance.line": line };

    const [, reachMax] = init.range("clearance.reach", reach);
    const [lineMin, lineMax] = init.range("clearance.line", line);
    if (reachMax > this.R + 0.01) issues.push(`${where}: the boom reaches ${reachMax} ft, past the work zone's ${this.R} ft.`);
    if (this.R < 25) issues.push(`${where}.maxRadius is at least 25 ft.`);
    if (lineMin - this.clear < 20) issues.push(`${where}: the band (line ${lineMin} ft, clearance ${this.clear} ft) must start at least 20 ft from the crane.`);
    if (lineMin < this.R - 10) issues.push(`${where}: the line passes more than 10 ft inside the work zone; draw it no closer than ${this.R - 10} ft.`);

    // frame: the whole circle on the left, the line and its tag on the right, the band's width under it
    const R = this.R;
    const x0 = -(R + 2.5);
    const xWire = lineMax + WIRES[WIRES.length - 1]! / 2;
    this.yEnd = R + 5;
    const drawH = MAX_H - (readouts ? STRIP + GAP : 0);
    const UNDER = 96; // px under the line's bottom end: the band's width label
    const kW = (W - TAG) / (xWire - x0);
    const kH = (drawH - UNDER) / (2 * this.yEnd);
    const k = Math.min(kW, kH);
    this.k = k;
    const need = (xWire - x0) * k + TAG;
    const offX = (W - need) / 2;
    const P = (x: number, y: number): Pt => [(x - x0) * k + offX, (this.yEnd - y) * k];
    this.P = P;
    this.w = W;
    const drawnH = 2 * this.yEnd * k + UNDER;
    this.h = drawnH + (readouts ? GAP + STRIP : 0);

    // the band, then the work zone over it, then the overlap where they meet
    const band = el("g", root);
    const bandRect = el("rect", band, {}, "cfc-band");
    const bandEdge = el("line", band, {}, "cfc-band-edge");
    const bandDimG = el("g", band);
    const bandDim = dimension(bandDimG);
    const bandPill = pill(bandDimG);
    const zone = el("g", root);
    const [cx, cy] = P(0, 0);
    const zoneC = el("circle", zone, { cx, cy, r: R * k }, "cfc-zone");
    const overlap = el("g", root);
    const overlapPath = el("path", overlap, {}, "cfc-overlap");

    // the line: three wires and their crossarms
    const lineG = el("g", root);
    const armYs: number[] = [];
    for (let y = -Math.floor(this.yEnd / 40) * 40; y <= this.yEnd - 4; y += 40) if (Math.abs(y) > 6) armYs.push(y);
    const arms = armYs.map(() => el("path", lineG, {}, "cfc-arm"));
    const wires = WIRES.map(() => el("line", lineG, {}, "cfc-wire"));

    // the crane
    const low = el("g", root), high = el("g", root);
    this.crane = new PlanCrane(low, high, P, k);

    // radius of the zone, down and to the left, away from the line
    const radius = el("g", root);
    const radiusDim = dimension(radius);
    const radiusPill = pill(radius);
    {
      const a = (215 * Math.PI) / 180;
      const p0 = P(Math.cos(a) * 17, Math.sin(a) * 17), p1 = P(Math.cos(a) * R, Math.sin(a) * R);
      radiusDim(p0, p1);
      const mid = P(Math.cos(a) * (R * 0.6), Math.sin(a) * (R * 0.6));
      radiusPill.put(`${ft(R)} ft`, mid[0], mid[1]);
    }

    // the gap from the circle's edge to the nearest wire
    const gap = el("g", root);
    const gapDimG = el("g", gap);
    const gapDim = dimension(gapDimG);
    const gapPill = pill(gapDimG);

    // the voltage tag on the line
    const voltageG = el("g", root);
    const tagBg = el("path", voltageG, {}, "cfc-tag");
    const tagText = text(voltageG, 0, 0, voltage, "cfc-tag-text", "middle");
    if (!voltage) voltageG.style.display = "none";

    this.g = {
      zone, zoneC, radius, radiusDim, radiusPill, band, bandRect, bandEdge, bandDim, bandPill, overlap, overlapPath,
      line: lineG, wires, arms, armYs, voltage: voltageG, tagBg, tagText, gap, gapDim, gapPill, gapDimG,
    };

    // the readouts
    if (readouts) {
      const top = drawnH + GAP;
      const strip = el("g", root);
      el("path", strip, { d: roundRect(0, top, W, STRIP, 22) }, "cf-panel");
      const pad = 14, cw = (W - pad * 3) / 2;
      const cell = (i: number, cap: string): Cell => {
        const g = el("g", strip);
        const x = pad + i * (cw + pad);
        const bg = el("path", g, { d: roundRect(x, top + pad, cw, STRIP - 2 * pad, 14) }, "cf-panel-cell");
        const capT = text(g, x + cw / 2, top + pad + 40, cap, "cf-panel-cap", "middle");
        const value = text(g, x + cw / 2, top + STRIP - pad - 24, "", "cf-panel-value", "middle");
        return { g, bg, cap: capT, value };
      };
      this.g.cells = { gap: cell(0, "GAP TO THE LINE"), limit: cell(1, "CLEARANCE") };
      this.g.cells.limit.value.textContent = `${ft(this.clear)} ft`;
    }

    this.parts = [
      "clearance", "clearance.crane", "clearance.zone", "clearance.radius", "clearance.boom", "clearance.line", "clearance.voltage",
      "clearance.band", "clearance.overlap", "clearance.gap", "clearance.limit",
    ];
  }

  draw(tl: CraneTimeline, t: number) {
    const { g, P, k, R } = this;
    const op = (n: string) => tl.opacity(n, t);
    const lit = (n: string) => tl.light(n, t);
    const L = tl.value("clearance.line", t), S = tl.value("clearance.swing", t), reach = tl.value("clearance.reach", t);
    const a = L - this.clear; // where the band starts
    const yT = this.yEnd, yB = -this.yEnd;

    this.crane.update(12, 12, 12, S, reach);

    // band
    const [bx, by] = P(a, yT), [bx1, by1] = P(L, yB);
    set(g.bandRect, { x: bx, y: by, width: bx1 - bx, height: by1 - by });
    set(g.bandEdge, { x1: bx, y1: by, x2: bx, y2: by1 });
    const dimY = by1 + 30;
    g.bandDim([bx, dimY], [bx1, dimY]);
    const label = `${ft(this.clear)} ft`;
    const pw = g.bandPill.put(label, -999, -999);
    // under the band when it fits there, else to the band's left
    if (bx1 - bx >= pw + 12) g.bandPill.put(label, (bx + bx1) / 2, dimY + 34);
    else g.bandPill.put(label, bx - 14 - pw / 2, dimY);

    // overlap: the part of the circle past the band's near edge
    if (R > a + 0.01) {
      const h = Math.sqrt(R * R - a * a);
      const [ax, ay] = P(a, h), [, ay1] = P(a, -h);
      g.overlapPath.setAttribute("d", `M${ax},${ay}A${R * k},${R * k} 0 ${a < 0 ? 1 : 0} 1 ${ax},${ay1}Z`);
    } else g.overlapPath.setAttribute("d", "");

    // wires and crossarms
    WIRES.forEach((dx, i) => {
      const [wx, wy] = P(L + dx, yT), [, wy1] = P(L + dx, yB);
      set(g.wires[i]!, { x1: wx, y1: wy, x2: wx, y2: wy1 });
    });
    g.armYs.forEach((y, i) => {
      const [x, yy] = P(L - 1.2, y + 0.5);
      set(g.arms[i]!, { d: roundRect(x, yy, (WIRES[WIRES.length - 1]! + 2.4) * k, Math.max(6, 1.0 * k), 3) });
    });

    // voltage tag over the wires near the top
    if (g.tagText.textContent) {
      const [tx, ty] = P(L + WIRES[WIRES.length - 1]! / 2, R - 2);
      const tw = (g.tagText.getComputedTextLength?.() || g.tagText.textContent.length * 20) + 36;
      set(g.tagBg, { d: roundRect(tx - tw / 2, ty - 28, tw, 56, 28) });
      set(g.tagText, { x: tx, y: ty + 14 });
    }

    // the gap, edge of circle to nearest wire, on the line through the centre
    const gapFt = L - R;
    const [gx0, gy] = P(R, 0), [gx1] = P(L, 0);
    if (gapFt > 0.5) {
      g.gapDim([gx0, gy], [gx1, gy]);
      const lab = `${ft(gapFt)} ft`;
      const w = g.gapPill.put(lab, -999, -999);
      // on the dimension when it fits; else just inside the circle, under the boom's line
      if (gx1 - gx0 >= w + 24) g.gapPill.put(lab, (gx0 + gx1) / 2, gy);
      else g.gapPill.put(lab, Math.min(gx0, P(L - this.clear, 0)[0]) - 16 - w / 2, gy + 48);
      g.gapDimG.style.display = "";
    } else g.gapDimG.style.display = "none";
    const inside = gapFt < this.clear;

    // lights and fades
    const pairs: [string, SVGGElement][] = [
      ["clearance.zone", g.zone], ["clearance.radius", g.radius], ["clearance.band", g.band], ["clearance.overlap", g.overlap],
      ["clearance.line", g.line], ["clearance.voltage", g.voltage], ["clearance.gap", g.gapDimG],
      ["clearance.crane", this.crane.carrier], ["clearance.crane", this.crane.outriggers], ["clearance.crane", this.crane.upper],
      ["clearance.crane", this.crane.center], ["clearance.boom", this.crane.boom],
    ];
    for (const [name, node] of pairs) {
      glow(node, lit(name));
      fade(node, op(name));
    }
    this.crane.load.style.display = "none";
    for (const f of Object.values(this.crane.floats)) glow(f, lit("clearance.crane"));
    if (g.cells) {
      const { gap, limit } = g.cells;
      gap.value.textContent = gapFt <= 0 ? "Over the line" : `${ft(gapFt)} ft`;
      gap.g.classList.toggle("is-inside", inside);
      litCell(gap.bg, gap.cap, gap.value, lit("clearance.gap"));
      fade(gap.g, op("clearance.gap"));
      litCell(limit.bg, limit.cap, limit.value, lit("clearance.limit"));
      fade(limit.g, op("clearance.limit"));
    }
  }
}

type Cell = { g: SVGGElement; bg: SVGPathElement; cap: SVGTextElement; value: SVGTextElement };
