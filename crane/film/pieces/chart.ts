/**
 * A page of a load chart: one configuration's gross capacities, boom lengths
 * across the top and radii down the side, an excerpt of our own fictional
 * chart (crane/content/tools/loadcharts). Shaded cells are limited by
 * strength, white ones by tipping; a bold line runs between them. A blank cell
 * shows a dash. Optional pointers show a radius or a boom length that falls
 * between two listed ones, and the notes printed under the chart can be shown
 * one at a time.
 *
 *   { "chart": { "chart": "ht-50", "config": "outriggers-full-360",
 *                "booms": [38, 50, 62, 74, 86], "radii": [20, 25, 30, 35, 40, 45],
 *                "marks": true, "notes": ["radius", "boom", "blank", "shaded"] } }
 *
 * Values (`set`): chart.rmark (a radius in feet: the pointer sits between the
 * rows it falls between), chart.bmark (a boom length). Parts: chart.title,
 * chart.grid, chart.booms (the header row), chart.radii (the radius column), chart.col.<boom>, chart.row.<radius>, chart.cell.<radius>.<boom>,
 * chart.shade (the strength region and its line), chart.rmark, chart.bmark,
 * chart.notes, chart.note.<key>.
 */
import { getChart, getConfiguration, type Chart } from "../../content/tools/loadcharts/index.ts";
import { el, fade, lb, roundRect, set, text, textWidth } from "../draw";
import type { CraneTimeline } from "../timeline";
import { known, nums, str, type Piece, type PieceInit, type Spec } from "./piece";

const FIELDS = ["chart", "config", "booms", "radii", "marks", "notes", "hidden", "title"] as const;
/** The chart's notes, said plainly. Each is the chart's own rule (charts/<id>.json `notes`). */
export const NOTES: Record<string, string> = {
  gross: "Capacities are gross: rigging is part of the load.",
  radius: "Radius between rows: the next longer radius.",
  boom: "Boom between lengths: the next longer boom.",
  blank: "Dash or blank: no load may be lifted.",
  shaded: "Shaded: limited by strength, not tipping.",
  stowed: "Extension stowed on the boom: deduct it.",
};
const TITLES: Record<string, string> = {
  "outriggers-full-360": "Outriggers fully extended, 360°",
  "outriggers-mid-360": "Outriggers at mid extension, 360°",
};

const mix = (base: string, lit: string, em: number) => (em <= 0.001 ? base : `color-mix(in srgb, ${lit} ${Math.round(em * 100)}%, ${base})`);

const COL = 152, RCOL = 132, HEAD = 84, ROW = 80, TITLE = 128, CAPROW = 54, UNITS = 66, MARK_W = 136, MARK_H = 78, NOTE = 66;

export class ChartPiece implements Piece {
  readonly w: number;
  readonly h: number;
  readonly parts: string[];
  readonly initial: Record<string, number>;
  readonly hidden: string[];
  private booms: number[];
  private radii: number[];
  private cells: { key: string; r: number; b: number; bg: SVGPathElement; t: SVGTextElement; value: number | null; structural: boolean }[] = [];
  private bands: { key: string; rect: SVGPathElement }[] = [];
  private parts_: Map<string, SVGGElement> = new Map();
  private rmark?: { g: SVGGElement; text: SVGTextElement; y: (r: number) => number };
  private bmark?: { g: SVGGElement; text: SVGTextElement; x: (b: number) => number };
  private noteEls: { key: string; g: SVGGElement; bg: SVGPathElement }[] = [];
  private gridX: number;
  private titleBand!: SVGPathElement;
  private gridY: number;

  constructor(spec: Spec, init: PieceInit) {
    const where = "crane.chart";
    const { issues, root } = init;
    known(spec, FIELDS, issues, where);
    const chartId = str(spec, "chart", "ht-50", issues, where);
    let chart: Chart;
    try {
      chart = getChart(chartId);
    } catch {
      issues.push(`${where}.chart "${chartId}" is not one of our charts.`);
      chart = getChart("ht-50");
    }
    const configId = str(spec, "config", chart.configurations[0]!.id, issues, where);
    let cfg = chart.configurations[0]!;
    try {
      cfg = getConfiguration(chart, configId);
    } catch {
      issues.push(`${where}.config "${configId}" is not a configuration of ${chart.id}.`);
    }
    this.booms = nums(spec, "booms", issues, where) ?? cfg.boomLengthsFt.slice(0, 5);
    this.radii = nums(spec, "radii", issues, where) ?? cfg.radiiFt.slice(3, 9);
    for (const b of this.booms) if (!cfg.boomLengthsFt.includes(b)) issues.push(`${where}.booms: ${b} ft is not a boom length of this chart (${cfg.boomLengthsFt.join(", ")}).`);
    for (const r of this.radii) if (!cfg.radiiFt.includes(r)) issues.push(`${where}.radii: ${r} ft is not a radius of this chart (${cfg.radiiFt.join(", ")}).`);
    const marks = spec.marks === true;
    const noteKeys = Array.isArray(spec.notes) ? (spec.notes as unknown[]).map(String) : [];
    for (const n of noteKeys) if (!NOTES[n]) issues.push(`${where}.notes: "${n}" is not a note (${Object.keys(NOTES).join(", ")}).`);
    this.hidden = Array.isArray(spec.hidden) ? (spec.hidden as unknown[]).map(String) : [];
    this.initial = { "chart.rmark": this.radii[0] ?? 0, "chart.bmark": this.booms[0] ?? 0 };

    const left = marks ? MARK_W : 0;
    const top = TITLE;
    // with pointers, a band between the boom caption and the boom lengths holds the boom pointer
    const band = marks ? MARK_H : 0;
    const gridW = RCOL + COL * this.booms.length;
    this.gridX = left;
    this.gridY = top + CAPROW + band;
    this.w = left + gridW + (marks ? 24 : 0);
    const gridH = CAPROW + band + HEAD + ROW * this.radii.length;
    this.h = top + gridH + UNITS + (noteKeys.length ? 18 + NOTE * noteKeys.length : 0);

    // title: which chart and which setup this page is for
    const title = el("g", root);
    // lit, the title sits on an amber band: this page is for this setup
    this.titleBand = el("path", title, { d: roundRect(left - 16, 56, Math.max(560, RCOL + COL * this.booms.length) + 32, 64, 12) }, "cf-band");
    text(title, left, 40, `${chart.id.toUpperCase()} truck crane · fictional chart`.toUpperCase(), "cf-chart-kicker");
    text(title, left, 100, TITLES[cfg.id] ?? cfg.label, "cf-chart-title");
    this.parts_.set("chart.title", title);

    const grid = el("g", root);
    this.parts_.set("chart.grid", grid);
    const x0 = left, y0 = top;
    // the caption over the boom lengths, and the corner
    text(grid, x0 + RCOL + (COL * this.booms.length) / 2, y0 + 38, "MAIN BOOM LENGTH, FT", "cf-chart-cap", "middle");
    text(grid, x0 + RCOL / 2, y0 + CAPROW + band + HEAD / 2 + 12, "RADIUS FT", "cf-chart-corner", "middle");
    const hy = y0 + CAPROW + band;
    // body cells
    const shadeG = el("g", grid);
    this.parts_.set("chart.shade", shadeG);
    this.radii.forEach((r, i) => {
      const ri = cfg.radiiFt.indexOf(r);
      this.booms.forEach((b, j) => {
        const bj = cfg.boomLengthsFt.indexOf(b);
        const value = ri >= 0 && bj >= 0 ? cfg.capacitiesLb[ri]![bj]! : null;
        const structural = ri >= 0 && bj >= 0 ? !!cfg.structural[ri]![bj] && value !== null : false;
        const x = x0 + RCOL + j * COL, y = hy + HEAD + i * ROW;
        const bg = el("path", grid, { d: roundRect(x + 3, y + 3, COL - 6, ROW - 6, 8) }, structural ? "cf-cell cf-cell-structural" : "cf-cell");
        const t = text(grid, x + COL / 2, y + ROW / 2 + 15, value === null ? "—" : lb(value), value === null ? "cf-cell-text cf-cell-blank" : "cf-cell-text", "middle");
        this.cells.push({ key: `chart.cell.${r}.${b}`, r, b, bg, t, value, structural });
      });
    });
    // bands for a lit row or column: drawn over the cells, under the numbers
    const bandG = el("g", grid);
    this.booms.forEach((b, j) => {
      const x = x0 + RCOL + j * COL;
      this.bands.push({ key: `chart.col.${b}`, rect: el("path", bandG, { d: roundRect(x + 1, hy + 2, COL - 2, HEAD + ROW * this.radii.length - 4, 12) }, "cf-band") });
    });
    // the header row and the radius column, lit as "boom lengths across the top, radii down the side"
    this.bands.push({ key: "chart.booms", rect: el("path", bandG, { d: roundRect(x0 + RCOL + 1, hy + 2, COL * this.booms.length - 2, HEAD - 4, 12) }, "cf-band") });
    this.bands.push({ key: "chart.radii", rect: el("path", bandG, { d: roundRect(x0 + 2, hy + HEAD + 1, RCOL - 4, ROW * this.radii.length - 2, 12) }, "cf-band") });
    this.radii.forEach((r, i) => {
      const y = hy + HEAD + i * ROW;
      this.bands.push({ key: `chart.row.${r}`, rect: el("path", bandG, { d: roundRect(x0 + 2, y + 1, gridW - 4, ROW - 2, 12) }, "cf-band") });
    });
    // raise the numbers above the bands
    for (const c of this.cells) grid.appendChild(c.t);
    // header numbers
    this.booms.forEach((b, j) => text(grid, x0 + RCOL + j * COL + COL / 2, hy + HEAD / 2 + 16, String(b), "cf-chart-head", "middle"));
    this.radii.forEach((r, i) => text(grid, x0 + RCOL / 2, hy + HEAD + i * ROW + ROW / 2 + 16, String(r), "cf-chart-head", "middle"));
    // rules: header and radius column, and the bold line between strength and tipping cells
    el("line", grid, { x1: x0, y1: hy + HEAD, x2: x0 + gridW, y2: hy + HEAD }, "cf-chart-rule");
    el("line", grid, { x1: x0 + RCOL, y1: hy, x2: x0 + RCOL, y2: hy + HEAD + ROW * this.radii.length }, "cf-chart-rule");
    const at = (i: number, j: number) => this.cells[i * this.booms.length + j];
    let d = "";
    for (let i = 0; i < this.radii.length; i++)
      for (let j = 0; j < this.booms.length; j++) {
        const c = at(i, j)!;
        const x = x0 + RCOL + j * COL, y = hy + HEAD + i * ROW;
        const right = j + 1 < this.booms.length ? at(i, j + 1)! : null;
        const below = i + 1 < this.radii.length ? at(i + 1, j)! : null;
        if (right && right.value !== null && c.value !== null && right.structural !== c.structural) d += `M${x + COL},${y}v${ROW}`;
        if (below && below.value !== null && c.value !== null && below.structural !== c.structural) d += `M${x},${y + ROW}h${COL}`;
      }
    if (d) el("path", shadeG, { d }, "cf-chart-limit");
    text(grid, x0, hy + HEAD + ROW * this.radii.length + 46, "Gross capacity, pounds. Shaded: strength limit.", "cf-chart-units");

    // pointers for a radius or a boom between the listed ones
    if (marks) {
      const rows = this.radii;
      const yOf = (r: number) => {
        const yc = (i: number) => hy + HEAD + i * ROW + ROW / 2;
        if (r <= rows[0]!) return yc(0);
        for (let i = 0; i + 1 < rows.length; i++) if (r <= rows[i + 1]!) return yc(i) + ((r - rows[i]!) / (rows[i + 1]! - rows[i]!)) * ROW;
        return yc(rows.length - 1);
      };
      const g = el("g", root);
      el("path", g, { d: roundRect(-MARK_W + 12, -30, MARK_W - 36, 60, 30) }, "cf-mark");
      el("path", g, { d: "M-24,-16L-4,0L-24,16z" }, "cf-mark-tip");
      const t = text(g, -MARK_W / 2 - 6, 15, "", "cf-mark-text", "middle");
      this.rmark = { g, text: t, y: yOf };
      const cols = this.booms;
      const xOf = (b: number) => {
        const xc = (j: number) => x0 + RCOL + j * COL + COL / 2;
        if (b <= cols[0]!) return xc(0);
        for (let j = 0; j + 1 < cols.length; j++) if (b <= cols[j + 1]!) return xc(j) + ((b - cols[j]!) / (cols[j + 1]! - cols[j]!)) * COL;
        return xc(cols.length - 1);
      };
      const gb = el("g", root);
      el("path", gb, { d: roundRect(-56, -MARK_H + 4, 112, 56, 28) }, "cf-mark");
      el("path", gb, { d: "M-14,-19L0,-4L14,-19z" }, "cf-mark-tip");
      const tb = text(gb, 0, -MARK_H + 45, "", "cf-mark-text", "middle");
      this.bmark = { g: gb, text: tb, x: xOf };
    }

    // the notes printed under the chart
    if (noteKeys.length) {
      const g = el("g", root);
      this.parts_.set("chart.notes", g);
      let y = top + gridH + UNITS + 18;
      for (const key of noteKeys) {
        const ng = el("g", g);
        const bg = el("path", ng, { d: roundRect(left - 6, y, gridW + 12, NOTE - 8, 12) }, "cf-note-bg");
        el("rect", ng, { x: left + 12, y: y + 20, width: 18, height: 18, rx: 3 }, "cf-note-bullet");
        const t = text(ng, left + 46, y + 43, NOTES[key] ?? key, "cf-note-text");
        if (textWidth(t) > gridW - 50) issues.push(`${where}: the note "${key}" is wider than the chart.`);
        this.noteEls.push({ key: `chart.note.${key}`, g: ng, bg });
        y += NOTE;
      }
    }

    this.parts = [
      "chart", "chart.title", "chart.grid", "chart.shade", "chart.notes", "chart.booms", "chart.radii",
      ...this.booms.map((b) => `chart.col.${b}`), ...this.radii.map((r) => `chart.row.${r}`),
      ...this.cells.map((c) => c.key), ...noteKeys.map((n) => `chart.note.${n}`),
      ...(marks ? ["chart.rmark", "chart.bmark"] : []),
    ];
  }

  draw(tl: CraneTimeline, t: number) {
    for (const [name, g] of this.parts_) fade(g, tl.opacity(name, t));
    fade(this.titleBand, tl.light("chart.title", t));
    for (const b of this.bands) {
      const em = tl.light(b.key, t);
      fade(b.rect, em * tl.opacity(b.key, t));
    }
    for (const c of this.cells) {
      // lighting the shade lights every strength-limited cell
      const em = Math.max(tl.light(c.key, t), c.structural ? tl.light("chart.shade", t) : 0);
      const base = c.structural ? "var(--cf-structural)" : "var(--cf-paper)";
      c.bg.style.fill = mix(base, "var(--cf-light)", em);
      c.bg.style.stroke = em > 0.01 ? mix("var(--cf-line)", "var(--cf-light-edge)", em) : "";
      c.bg.style.strokeWidth = em > 0.01 ? String(2 + 3 * em) : "";
      c.t.style.fill = em > 0.5 ? "var(--cf-light-ink)" : "";
      fade(c.bg, tl.opacity(c.key, t));
      fade(c.t, tl.opacity(c.key, t));
    }
    if (this.rmark) {
      const r = tl.value("chart.rmark", t);
      set(this.rmark.g, { transform: `translate(${this.gridX},${this.rmark.y(r)})` });
      this.rmark.text.textContent = `${Math.round(r)} ft`;
      fade(this.rmark.g, tl.opacity("chart.rmark", t));
    }
    if (this.bmark) {
      const b = tl.value("chart.bmark", t);
      set(this.bmark.g, { transform: `translate(${this.bmark.x(b)},${this.gridY})` });
      this.bmark.text.textContent = `${Math.round(b)} ft`;
      fade(this.bmark.g, tl.opacity("chart.bmark", t));
    }
    for (const n of this.noteEls) {
      const em = tl.light(n.key, t);
      n.bg.style.fill = mix("var(--cf-paper)", "var(--cf-light-wash)", em);
      n.bg.style.stroke = mix("var(--cf-line)", "var(--cf-light-edge)", em);
      fade(n.g, tl.opacity(n.key, t));
    }
  }
}
