import {
  sceneSchema,
  type AreaModel,
  type Bars,
  type Clock,
  type Element,
  type Fn,
  type FractionBar,
  type Graph,
  type InkRole,
  type LineSpec,
  type NumberLine,
  type Point,
  type Scene,
  type Table,
  type TableCell,
  type TenFrame,
} from "./spec";

/**
 * Author API: chainable builders that produce plain scene data.
 *
 *   numberLine({ min: 0, max: 20 }).hop(8, 5).scene()
 *   areaModel(34, 6).scene()
 *   graph({ x: [-5, 5], y: [-5, 5] }).curve(f.poly(1, 0, -4), { features: ["vertex", "zeros"] }).scene()
 *
 * Builders never compute answers; derived values (a hop's landing, a region's
 * product) stay masked as "?" unless a lesson renders the scene revealed.
 */
type Built = { element(): Element };
type SceneOptions = {
  title?: string;
  note?: string;
  width?: number;
  maxHeight?: number;
};

/** Several elements in one scene. */
export function scene(...parts: (Element | Built)[]) {
  const elements = parts.map((p) =>
    "element" in p && typeof p.element === "function"
      ? p.element()
      : (p as Element),
  );
  return {
    build(options: SceneOptions = {}): Scene {
      return sceneSchema.parse({ v: 1, ...options, elements });
    },
  };
}

abstract class Builder<T extends Element> implements Built {
  constructor(protected spec: T) {}
  id(id: string) {
    this.spec = { ...this.spec, id };
    return this;
  }
  element(): T {
    return structuredClone(this.spec);
  }
  /** This element alone, as a validated scene. */
  scene(options: SceneOptions = {}): Scene {
    return scene(this).build(options);
  }
}

class NumberLineBuilder extends Builder<NumberLine> {
  private last: number | undefined;
  mark(
    at: number,
    options: Omit<NonNullable<NumberLine["marks"]>[number], "at"> = {},
  ) {
    this.spec.marks = [
      ...(this.spec.marks ?? []),
      { at, label: true, ...options },
    ];
    return this;
  }
  /** A jump of `by` from `from`; its landing is masked unless `landing: "shown"`. */
  hop(
    from: number,
    by: number,
    options: Omit<NonNullable<NumberLine["hops"]>[number], "from" | "by"> = {},
  ) {
    this.spec.hops = [...(this.spec.hops ?? []), { from, by, ...options }];
    this.last = from + by;
    return this;
  }
  /** Another jump from where the last one landed. */
  then(
    by: number,
    options: Omit<NonNullable<NumberLine["hops"]>[number], "from" | "by"> = {},
  ) {
    if (this.last === undefined) throw new Error("then() follows a hop()");
    return this.hop(this.last, by, options);
  }
  interval(
    from: number | null,
    to: number | null,
    open: [boolean, boolean] = [false, false],
  ) {
    this.spec.intervals = [...(this.spec.intervals ?? []), { from, to, open }];
    return this;
  }
}
export const numberLine = (spec: Omit<NumberLine, "type">) =>
  new NumberLineBuilder({ type: "numberLine", ...spec } as NumberLine);

/** Function families, with polynomial coefficients written highest power first. */
export const f = {
  /** f.poly(2, -3, 1) is 2x² − 3x + 1. */
  poly: (...descending: number[]): Fn => ({
    f: "poly",
    c: [...descending].reverse(),
  }),
  /** a(x − h)² + k */
  vertex: (a: number, h: number, k: number): Fn => ({
    f: "poly",
    c: [a * h * h + k, -2 * a * h, a],
  }),
  rational: (num: number[], den: number[]): Fn => ({
    f: "rational",
    num: [...num].reverse(),
    den: [...den].reverse(),
  }),
  exp: (a: number, b: number, shift: { h?: number; k?: number } = {}): Fn => ({
    f: "exp",
    a,
    b,
    ...shift,
  }),
  log: (
    a: number,
    base: number,
    shift: { h?: number; k?: number } = {},
  ): Fn => ({ f: "log", a, base, ...shift }),
  sin: (a: number, b: number, shift: { h?: number; k?: number } = {}): Fn => ({
    f: "sin",
    a,
    b,
    ...shift,
  }),
  cos: (a: number, b: number, shift: { h?: number; k?: number } = {}): Fn => ({
    f: "cos",
    a,
    b,
    ...shift,
  }),
  tan: (a: number, b: number, shift: { h?: number; k?: number } = {}): Fn => ({
    f: "tan",
    a,
    b,
    ...shift,
  }),
  abs: (a: number, h = 0, k = 0): Fn => ({ f: "abs", a, h, k }),
  sqrt: (a: number, h = 0, k = 0): Fn => ({ f: "sqrt", a, h, k }),
};
type Curve = NonNullable<Graph["curves"]>[number];
type HalfPlane = NonNullable<Graph["regions"]>[number]["halfPlanes"][number];
/** Parse "2x + 3y <= 12", "y > 2x - 1", "x >= 0" into a half-plane. */
export function halfPlane(text: string): HalfPlane {
  const m = /^(.*?)(<=|>=|≤|≥|<|>)(.*)$/.exec(
    text.replace(/\s+/g, "").replace(/−/g, "-"),
  );
  if (!m) throw new Error(`Not an inequality: ${text}`);
  const ops = {
    "<": "<",
    ">": ">",
    "<=": "<=",
    ">=": ">=",
    "≤": "<=",
    "≥": ">=",
  } as const;
  const side = (e: string) => {
    let a = 0,
      b = 0,
      c = 0;
    for (const t of e.replace(/-/g, "+-").split("+").filter(Boolean)) {
      const v = /^(-?\d*\.?\d*)(x|y)?$/.exec(t);
      if (!v) throw new Error(`Unsupported term ${t} in ${text}`);
      const k = v[1] === "" ? 1 : v[1] === "-" ? -1 : Number(v[1]);
      if (v[2] === "x") a += k;
      else if (v[2] === "y") b += k;
      else c += k;
    }
    return { a, b, c };
  };
  const l = side(m[1]!),
    r = side(m[3]!);
  return {
    a: l.a - r.a,
    b: l.b - r.b,
    c: r.c - l.c,
    op: ops[m[2] as keyof typeof ops],
  };
}
class GraphBuilder extends Builder<Graph> {
  private push<K extends keyof Graph>(
    key: K,
    value: NonNullable<Graph[K]> extends (infer U)[] ? U : never,
  ) {
    (this.spec as Record<string, unknown>)[key] = [
      ...((this.spec[key] as unknown[]) ?? []),
      value,
    ];
    return this;
  }
  point(
    x: number,
    y: number,
    label?: string,
    options: { open?: boolean; derived?: boolean } = {},
  ) {
    return this.push("points", { x, y, label, ...options });
  }
  line(
    line: LineSpec,
    options: { dash?: "solid" | "dash" | "dot"; label?: string } = {},
  ) {
    return this.push("lines", { line, ...options });
  }
  curve(fn: Fn, options: Omit<Curve, "fn"> = {}) {
    return this.push("curves", { fn, ...options });
  }
  /** Shade where every inequality holds: graph(...).shade("y > 2x - 1", "x >= 0"). */
  shade(...inequalities: (string | HalfPlane)[]) {
    return this.push("regions", {
      halfPlanes: inequalities.map((i) =>
        typeof i === "string" ? halfPlane(i) : i,
      ),
    });
  }
  shadeCurve(curve: number, side: "above" | "below") {
    return this.push("curveRegions", { curve, side });
  }
  circle(
    center: Point,
    r: number,
    options: { showCenter?: boolean; radius?: boolean } = {},
  ) {
    return this.push("circles", { center, r, ...options });
  }
  segment(
    from: Point,
    to: Point,
    options: { dash?: "solid" | "dash" | "dot"; arrow?: boolean } = {},
  ) {
    return this.push("segments", { from, to, ...options });
  }
  slope(
    from: Point,
    to: Point,
    labels: "shown" | "derived" | "none" = "shown",
  ) {
    return this.push("slopeTriangles", { from, to, labels });
  }
  secant(curve: number, x1: number, x2: number) {
    return this.push("secants", { curve, x: [x1, x2] });
  }
  scatter(points: Point[], fit?: { m: number; b: number }, residuals = false) {
    this.spec.scatter = { points, fit, residuals };
    return this;
  }
}
export const graph = (spec: Omit<Graph, "type">) =>
  new GraphBuilder({ type: "graph", ...spec } as Graph);

/** Place-value parts of a whole number: 345 → [300, 40, 5]. */
export function placeValueParts(n: number) {
  const digits = String(Math.trunc(Math.abs(n))).split("");
  const parts = digits
    .map((d, i) => Number(d) * 10 ** (digits.length - 1 - i))
    .filter((v) => v > 0);
  return parts.length ? parts : [0];
}
class AreaBuilder extends Builder<AreaModel> {
  products(mode: "shown" | "derived" | "none") {
    this.spec.products = mode;
    return this;
  }
  unitGrid() {
    this.spec.unitGrid = true;
    return this;
  }
}
/** areaModel(34, 6) splits each factor by place value; arrays give the parts. */
export const areaModel = (
  across: number | number[],
  down: number | number[],
  options: Partial<Omit<AreaModel, "type" | "across" | "down">> = {},
) =>
  new AreaBuilder({
    type: "areaModel",
    across: Array.isArray(across) ? across : placeValueParts(across),
    down: Array.isArray(down) ? down : placeValueParts(down),
    ...options,
  } as AreaModel);

class Simple<T extends Element> extends Builder<T> {}
export const array = (
  rows: number,
  columns: number,
  options: {
    shape?: "square" | "dot";
    splitAfterRow?: number;
    splitAfterColumn?: number;
  } = {},
) => new Simple({ type: "array", rows, columns, ...options });
export const tenFrame = (...counts: number[]) =>
  new Simple<TenFrame>({
    type: "tenFrame",
    frames: counts.reduce((a, b) => a + b, 0) > 10 ? 2 : 1,
    groups: counts.map((count) => ({ count })),
  });
export const baseTen = (n: number) =>
  new Simple({
    type: "baseTen",
    hundreds: Math.floor(n / 100),
    tens: Math.floor((n % 100) / 10),
    ones: n % 10,
  });
export const fractionBar = (
  ...bars: {
    shaded: number;
    parts: number;
    wholes?: number;
    label?: string | false;
  }[]
) => new Simple<FractionBar>({ type: "fractionBar", bars });
export const clock = (hour: number, minute: number) =>
  new Simple<Clock>({ type: "clock", hour, minute });

class TableBuilder extends Builder<Table> {
  /** Label the change between consecutive rows of a column: +3, ×2. */
  steps(column: number, labels: (string | false)[], color?: InkRole) {
    this.spec.steps = [
      ...(this.spec.steps ?? []),
      { column, labels, ...(color ? { color } : {}) },
    ];
    return this;
  }
  highlightRows(rows: number[], color?: "accent" | "warm" | "gold") {
    this.spec.highlight = {
      ...this.spec.highlight,
      rows,
      ...(color ? { color } : {}),
    };
    return this;
  }
  highlightColumns(columns: number[], color?: "accent" | "warm" | "gold") {
    this.spec.highlight = {
      ...this.spec.highlight,
      columns,
      ...(color ? { color } : {}),
    };
    return this;
  }
}
/** table(["x", "y"], [[0, 3], [1, 6]]): numbers become math cells. */
export const table = (
  header: TableCell[],
  rows: (TableCell | number)[][],
  options: Partial<Omit<Table, "type" | "header" | "rows">> = {},
) =>
  new TableBuilder({
    type: "table",
    header,
    rows: rows.map((r) =>
      r.map((c) => (typeof c === "number" ? String(c).replace("-", "−") : c)),
    ),
    ...options,
  } as Table);
/** bars(["0", "1", "2"], [1, 2, 4]) or two series side by side. */
export const bars = (
  categories: (string | number)[],
  ...series: Bars["series"]
) =>
  new Simple<Bars>({
    type: "bars",
    categories: categories.map(String),
    series,
  });
