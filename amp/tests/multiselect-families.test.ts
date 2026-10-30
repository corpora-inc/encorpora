import test from "node:test";
import assert from "node:assert/strict";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import {
  generateProblem,
  generateProblemFor,
  templates,
} from "../src/math/engine";
import { parseSelection } from "../src/math/selection-response";
import { multiselectNumberTemplates } from "../src/math/multiselect-number-practice";
import { multiselectExpressionTemplates } from "../src/math/multiselect-expression-practice";
import { multiselectFigureTemplates } from "../src/math/multiselect-figure-practice";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { lessons } from "../src/content/lessons";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { templateArchetypes } from "../src/curriculum/template-archetypes";
import { releasedItems } from "../src/curriculum/released-items/index";

const mine = [
  ...multiselectNumberTemplates,
  ...multiselectExpressionTemplates,
  ...multiselectFigureTemplates,
];
const SEEDS = 400;
const seedList = Array.from({ length: SEEDS }, (_, i) => `ms:${i}`);
const cache = new Map<string, GeneratedProblem[]>();
const all = (id: string) => {
  if (!cache.has(id))
    cache.set(
      id,
      seedList.map((s) => generateProblem(id, s)),
    );
  return cache.get(id)!;
};

/* ----------------------------------------------- displayed statements */

interface Shown {
  label: string;
  /** What the learner's selection says about it. */
  truth: boolean;
}
/** The statements a problem displays and the verdict its answer gives each,
 * decoded from the public response alone, whatever the answer format. */
function shown(p: GeneratedProblem): Shown[] {
  const r = p.public.response;
  assert.equal(r.kind, "multi-select");
  if (r.kind !== "multi-select") return [];
  const picked = new Set(parseSelection(p.answer));
  const pair = r.options.every((o) => / is (true|false)\.$/.test(o.label));
  if (!pair)
    return r.options.map((o) => ({ label: o.label, truth: picked.has(o.id) }));
  const out: Shown[] = [];
  for (let i = 0; i < r.options.length; i += 2) {
    const yes = r.options[i]!;
    out.push({
      label: yes.label.replace(/ is true\.$/, ""),
      truth: picked.has(yes.id),
    });
  }
  return out;
}

/* ------------------------------------------------------------- helpers */

const strip = (s: string) => s.replace(/\{,\}/g, "").replace(/\$/g, "");
const nums = (s: string) =>
  (strip(s).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
/** Evaluate a TeX arithmetic expression of numbers, + - \times \div and
 * parentheses (implicit products after a number or bracket, and x). */
function evalTex(tex: string, x?: number): number {
  let e = strip(tex)
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\^2/g, "**2")
    .replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "($1/$2)")
    .replace(/(\d)\s*x/g, "$1*x")
    .replace(/(\d|\))\s*\(/g, "$1*(")
    .replace(/\)\s*x/g, ")*x")
    .replace(/x\s*\(/g, "x*(");
  if (!/^[0-9+\-*/().x\s]*$/.test(e)) throw new Error(`Cannot evaluate ${tex}`);
  if (x === undefined && /x/.test(e)) throw new Error(`x in ${tex}`);
  // eslint-disable-next-line no-new-func
  return Function("x", `return (${e});`)(x) as number;
}
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const wordsToNumber = (text: string): number => {
  const small: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  };
  let total = 0;
  let cur = 0;
  for (const w of text.replace(/,/g, "").split(/[\s-]+/)) {
    if (w === "hundred") cur *= 100;
    else if (w === "thousand") {
      total += cur * 1000;
      cur = 0;
    } else if (w in small) cur += small[w]!;
    else throw new Error(`Unknown word ${w}`);
  }
  return total + cur;
};
const pointsOf = (p: GeneratedProblem) => {
  const fig = p.public.figure;
  assert.equal(fig?.kind, "scene");
  return fig && fig.kind === "scene" ? fig.scene.elements : [];
};
type El = ReturnType<typeof pointsOf>[number];
/** Elements of a lettered-panel scene grouped by panel: the label text of each
 * panel sits at its bottom centre, so an element belongs to the panel whose
 * column and row contain it. */
function panelsOf(p: GeneratedProblem) {
  const els = pointsOf(p);
  const labels = els.filter(
    (e) => e.type === "text" && /^label[A-F]$/.test(e.id ?? ""),
  ) as Extract<El, { type: "text" }>[];
  const xs = [...new Set(labels.map((l) => l.at[0]))].sort((a, b) => a - b);
  const ys = [...new Set(labels.map((l) => l.at[1]))].sort((a, b) => a - b);
  const cw = xs.length > 1 ? xs[1]! - xs[0]! : 2 * xs[0]!;
  const ch = ys.length > 1 ? ys[1]! - ys[0]! : 1e9;
  return labels.map((l) => {
    const cx = l.at[0];
    const cy = ch > 1e8 ? 0.15 : l.at[1] - 0.15 + ch / 2;
    const inside = (pt: readonly [number, number]) =>
      Math.abs(pt[0] - cx) < cw / 2 && Math.abs(pt[1] - cy) < ch / 2;
    const members = els.filter((e) => {
      if (e === l) return false;
      if (e.type === "polygon" || e.type === "polyline")
        return e.points.every(inside);
      if (e.type === "segment") return inside(e.from) && inside(e.to);
      if (e.type === "isoSolid" || e.type === "solid")
        return inside((e.at ?? [0, 0]) as [number, number]);
      if (e.type === "text" && !/^label/.test(e.id ?? "")) return inside(e.at);
      return false;
    });
    return { letter: l.text, cx, cy, members };
  });
}
const cross = (a: readonly number[], b: readonly number[]) =>
  a[0]! * b[1]! - a[1]! * b[0]!;
const dot = (a: readonly number[], b: readonly number[]) =>
  a[0]! * b[0]! + a[1]! * b[1]!;
const sideVecs = (pts: readonly (readonly [number, number])[]) =>
  pts.map((q, i) => {
    const n = pts[(i + 1) % pts.length]!;
    return [n[0] - q[0], n[1] - q[1]] as const;
  });
const eps = 1e-9;
function parallelSides(pts: readonly (readonly [number, number])[]) {
  const v = sideVecs(pts);
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++)
      if (Math.abs(cross(v[i]!, v[j]!)) < eps) {
        const d = [pts[j]![0] - pts[i]![0], pts[j]![1] - pts[i]![1]];
        if (Math.abs(cross(v[i]!, d)) > eps) return true;
      }
  return false;
}
function perpendicularSides(pts: readonly (readonly [number, number])[]) {
  const v = sideVecs(pts);
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++)
      if (Math.abs(dot(v[i]!, v[j]!)) < eps) return true;
  return false;
}
const decimalToScaled = (text: string, places: number): bigint => {
  const [w, f = ""] = strip(text).split(".");
  return BigInt(w! + f.padEnd(places, "0").slice(0, places));
};

/* ------------------------------------------------------------ oracles */

type Oracle = (p: GeneratedProblem, s: Shown) => boolean;
const oracles: Record<string, Oracle> = {
  "place-value-forms-select": (p, s) => {
    const given = nums(
      p.public.prompt.match(/The number is (\$[^$]+\$)/)![1]!,
    )[0]!;
    const cmp = s.label.match(
      /^\$([^$]+)\$ is (greater than|less than|equal to) (.+)$/,
    );
    if (cmp) {
      const n = Number(strip(cmp[1]!));
      const m = wordsToNumber(cmp[3]!);
      return cmp[2] === "greater than"
        ? n > m
        : cmp[2] === "less than"
          ? n < m
          : n === m;
    }
    return evalTex(s.label) === given;
  },
  "equivalent-fractions-select": (p, s) => {
    const [a, b] = nums(
      p.public.prompt.replace(/\\frac\{(\d+)\}\{(\d+)\}/, "$1 $2"),
    );
    const [n, d] = nums(s.label.replace(/\\frac\{(\d+)\}\{(\d+)\}/, "$1 $2"));
    return n! * b! === a! * d!;
  },
  "fraction-line-names-select": (p, s) => {
    const line = pointsOf(p).find((e) => e.type === "numberLine") as Extract<
      El,
      { type: "numberLine" }
    >;
    const at = line.marks![0]!.at;
    const [n, d] = nums(s.label.replace(/\\frac\{(\d+)\}\{(\d+)\}/, "$1 $2"));
    return close(n! / d!, at);
  },
  "equivalent-ratios-select": (p, s) => {
    const [a, b] = nums(p.public.prompt);
    const [x, y] = nums(s.label);
    return x! * b! === y! * a!;
  },
  "rounds-to-select": (p, s) => {
    const m = p.public.prompt.match(
      /round to (\$[^$]+\$) at the nearest (whole number|tenth|hundredth)/,
    )!;
    const places = m[2] === "whole number" ? 0 : m[2] === "tenth" ? 1 : 2;
    const target = decimalToScaled(m[1]!, places);
    const v = decimalToScaled(s.label, places + 4);
    const unit = 10n ** 4n;
    // round half up at the target place
    const rounded = (v + unit / 2n) / unit;
    return rounded === target;
  },
  "compare-to-pi-select": (p, s) => {
    const m = p.public.prompt.match(/(greater|less) than \$(.+)\$\./)!;
    const ref =
      m[2] === "\\pi" ? Math.PI : Math.sqrt(Number(m[2]!.match(/\d+/)![0]));
    const t = strip(s.label);
    const v = t.startsWith("\\sqrt")
      ? Math.sqrt(Number(t.match(/\d+/)![0]))
      : t.startsWith("\\frac")
        ? evalTex(t)
        : Number(t);
    return m[1] === "greater" ? v > ref : v < ref;
  },
  "multiplication-fact-grid-select": (p, s) => {
    const P = nums(p.public.prompt.match(/product of (\$[^$]+\$)/)![1]!)[0]!;
    return evalTex(s.label) === P;
  },
  "equal-factor-truth-select": (_p, s) => {
    const [l, r] = strip(s.label).split("=");
    return close(evalTex(l!), evalTex(r!));
  },
  "story-expression-select": (p, s) => {
    const n = [...p.public.prompt.matchAll(/\$(\d+)\$/g)].map((m) =>
      Number(m[1]),
    );
    if (s.label.includes("\\square")) {
      const [T, known] = n;
      const [l, r] = strip(s.label).split("=");
      const side = (t: string, v: number) =>
        evalTex(t.replace(/\\square/g, `(${v})`));
      for (let v = -1000; v <= 1000; v++)
        if (close(side(l!, v), side(r!, v))) return v === T! - known!;
      return false;
    }
    const [T, a, b] = n;
    return close(evalTex(s.label), T! - a! - b!);
  },
  "equal-expression-select": (p, s) => {
    const given = p.public.prompt.match(/expression (\$[^$]+\$)/)![1]!;
    return close(evalTex(s.label), evalTex(given));
  },
  "customary-equivalent-select": (p, s) => {
    const size: Record<string, number> = {
      yard: 36,
      yards: 36,
      foot: 12,
      feet: 12,
      inch: 1,
      inches: 1,
      gallon: 16,
      gallons: 16,
      quart: 4,
      quarts: 4,
      pint: 2,
      pints: 2,
      cup: 1,
      cups: 1,
      pound: 16,
      pounds: 16,
      ounce: 1,
      ounces: 1,
    };
    const total = (t: string) =>
      [...strip(t).matchAll(/(\d+) ([a-z]+)/g)].reduce(
        (sum, m) => sum + Number(m[1]) * size[m[2]!]!,
        0,
      );
    const target = p.public.prompt.match(/equal to (.+)\.$/)![1]!;
    return total(s.label) === total(target);
  },
  "additive-multiplicative-select": (p, s) => {
    const m = Number(p.public.prompt.match(/y=(\d+)x/)![1]);
    const c = Number(p.public.prompt.match(/y=x\+(\d+)/)![1]);
    const fn = (name: string) =>
      name.includes("x+") ? (x: number) => x + c : (x: number) => m * x;
    const xs = [1, 2, 3, 4, 5, 6];
    const label = s.label;
    const rule = label.match(/y=[^$]+/)![0];
    const f = fn(rule);
    let g = label.match(/is a multiplicative rule/);
    if (g)
      return xs.every((x) => f(x) % x === 0 && f(x) / x === f(1)) && f(1) >= 2;
    g = label.match(/is an additive rule/);
    if (g) return xs.every((x) => f(x) - x === f(1) - 1);
    const t = label.match(/y\$ is always \$(\d+)\$ times \$x/);
    if (t) return xs.every((x) => f(x) === Number(t[1]) * x);
    const mo = label.match(/y\$ is always \$(\d+)\$ more than \$x/);
    if (mo) return xs.every((x) => f(x) === x + Number(mo[1]));
    const at = label.match(/when \$x=(\d+)\$, \$y=(\d+)\$/)!;
    return f(Number(at[1])) === Number(at[2]);
  },
  "equivalent-trinomial-select": (p, s) => {
    const given = p.public.prompt.match(
      /(?:trinomial|product) (\$[^$]+\$)/,
    )![1]!;
    return [-3, -1, 2, 5, 7].every((x) =>
      close(evalTex(s.label, x), evalTex(given, x)),
    );
  },
  "regression-prediction-select": (p, s) => {
    const eq = p.public.prompt.match(/\\hat\{y\}=(-?[\d.]+)x\+([\d.]+)/)!;
    const slope = Number(eq[1]);
    const icpt = Number(eq[2]);
    const pred = (x: number) => Math.round((slope * x + icpt) * 10) / 10;
    const l = s.label;
    let m = l.match(/predicts \$(-?[\d.]+)\$ .* for \$(\d+)\$/);
    if (m) return close(Number(m[1]), pred(Number(m[2])));
    m = l.match(/changes the predicted .* by \$(-?[\d.]+)\$/);
    if (m) return close(Number(m[1]), slope);
    m = l.match(/For \$0\$ .*, the predicted .* is \$(-?[\d.]+)\$/);
    if (m) return close(Number(m[1]), icpt);
    m = l.match(/is greater for \$(\d+)\$ .* than for \$(\d+)\$/)!;
    return pred(Number(m[1])) > pred(Number(m[2]));
  },
  "function-pair-select": (p, s) => {
    const g = pointsOf(p).find((e) => e.type === "graph") as Extract<
      El,
      { type: "graph" }
    >;
    const [x, y] = nums(s.label);
    const clash = g.points!.some((q) => q.x === x && q.y !== y);
    return !clash;
  },
  "root-approximation-select": (p, s) => {
    const line = pointsOf(p).find((e) => e.type === "numberLine") as Extract<
      El,
      { type: "numberLine" }
    >;
    const m = s.label.match(/Point \$([A-D])\$ is about \$([\d.]+)\$/)!;
    const mark = line.marks!.find((q) => q.label === m[1])!;
    return close(Math.round(mark.at * 10) / 10, Number(m[2]));
  },
  "dot-plot-statement-select": (p, s) => {
    const plot = pointsOf(p).find((e) => e.type === "dotPlot") as Extract<
      El,
      { type: "dotPlot" }
    >;
    const values = plot.groups[0]!.values;
    const n = values.length;
    const count = (v: number) => values.filter((x) => x === v).length;
    const l = s.label;
    let m = l.match(/Exactly \$(\d+)\$ turns? scored \$(\d+)\$/);
    if (m) return count(Number(m[2])) === Number(m[1]);
    m = l.match(/\$(\d+)\$ turns? scored at least \$(\d+)\$/);
    if (m)
      return values.filter((x) => x >= Number(m![2])).length === Number(m[1]);
    m = l.match(/most common score was \$(\d+)\$/);
    if (m) {
      const top = Math.max(...values.map(count));
      return count(Number(m[1])) === top;
    }
    m = l.match(/half of the turns scored \$(\d+)\$ or less/);
    if (m) return values.filter((x) => x <= Number(m![1])).length > n / 2;
    m = l.match(/More turns scored \$(\d+)\$ than scored \$(\d+)\$/);
    if (m) return count(Number(m[1])) > count(Number(m[2]));
    m = l.match(/greatest score was \$(\d+)\$/);
    if (m) return Math.max(...values) === Number(m[1]);
    m = l.match(/least score was \$(\d+)\$/)!;
    return Math.min(...values) === Number(m[1]);
  },
  "shape-sides-select": (p, s) => {
    const letter = s.label.match(/\$([A-F])\$/)![1]!;
    const panel = panelsOf(p).find((q) => q.letter === letter)!;
    const poly = panel.members.find((e) => e.type === "polygon") as Extract<
      El,
      { type: "polygon" }
    >;
    const pts = poly.points as [number, number][];
    return /parallel/.test(p.public.prompt)
      ? parallelSides(pts)
      : perpendicularSides(pts);
  },
  "polygon-sides-select": (p, s) => {
    const poly = pointsOf(p).find((e) => e.type === "polygon") as Extract<
      El,
      { type: "polygon" }
    >;
    const n = poly.points.length;
    const table: Record<string, number> = {
      triangle: 3,
      rectangle: 4,
      square: 4,
      rhombus: 4,
      trapezoid: 4,
      parallelogram: 4,
      pentagon: 5,
      hexagon: 6,
      octagon: 8,
    };
    const m = strip(s.label).match(/^an? shape with (\d+) (corners|angles)$/);
    if (m) return Number(m[1]) === n;
    return table[strip(s.label).replace(/^an? /, "")] === n;
  },
  "line-pair-select": (p, s) => {
    const panels = panelsOf(p);
    const dir = (letter: string) => {
      const seg = panels
        .find((q) => q.letter === letter)!
        .members.find((e) => e.type === "segment") as Extract<
        El,
        { type: "segment" }
      >;
      return [seg.to[0] - seg.from[0], seg.to[1] - seg.from[1]] as const;
    };
    const parallel = /parallel/.test(p.public.prompt);
    const mine = s.label.match(/\$([A-E])\$/)![1]!;
    return panels.some((q) => {
      if (q.letter === mine) return false;
      const a = dir(mine);
      const b = dir(q.letter);
      return parallel
        ? Math.abs(cross(a, b)) < 1e-6
        : Math.abs(dot(a, b)) < 1e-6;
    });
  },
  "angle-kind-select": (p, s) => {
    const letter = s.label.match(/\$([A-F])\$/)![1]!;
    const line = panelsOf(p)
      .find((q) => q.letter === letter)!
      .members.find((e) => e.type === "polyline") as Extract<
      El,
      { type: "polyline" }
    >;
    const [a, v, b] = line.points as [number, number][];
    const ua = [a![0] - v![0], a![1] - v![1]];
    const ub = [b![0] - v![0], b![1] - v![1]];
    const deg =
      (Math.acos(
        dot(ua, ub) /
          Math.hypot(...(ua as [number, number])) /
          Math.hypot(...(ub as [number, number])),
      ) *
        180) /
      Math.PI;
    const kind = /acute/.test(p.public.prompt.split("Select")[1]!)
      ? "acute"
      : /right/.test(p.public.prompt.split("Select")[1]!)
        ? "right"
        : "obtuse";
    return kind === "acute"
      ? deg < 89.9
      : kind === "right"
        ? Math.abs(deg - 90) < 0.1
        : deg > 90.1;
  },
  "symmetry-lines-select": (p, s) => {
    const letter = s.label.match(/\$([A-E])\$/)![1]!;
    const panel = panelsOf(p).find((q) => q.letter === letter)!;
    const poly = panel.members.find((e) => e.type === "polygon") as Extract<
      El,
      { type: "polygon" }
    >;
    const lines = panel.members.filter((e) => e.type === "segment") as Extract<
      El,
      { type: "segment" }
    >[];
    const key = (q: readonly number[]) =>
      `${q[0]!.toFixed(5)},${q[1]!.toFixed(5)}`;
    const verts = poly.points as [number, number][];
    const set = new Set(verts.map(key));
    const edges = new Set(
      verts.map((q, i) =>
        [key(q), key(verts[(i + 1) % verts.length]!)].sort().join("|"),
      ),
    );
    const reflect = (
      q: readonly number[],
      a: readonly number[],
      b: readonly number[],
    ) => {
      const d = [b[0]! - a[0]!, b[1]! - a[1]!];
      const t =
        ((q[0]! - a[0]!) * d[0]! + (q[1]! - a[1]!) * d[1]!) /
        (d[0]! ** 2 + d[1]! ** 2);
      const f = [a[0]! + t * d[0]!, a[1]! + t * d[1]!];
      return [2 * f[0]! - q[0]!, 2 * f[1]! - q[1]!];
    };
    return lines.every((l) => {
      const img = verts.map((q) => reflect(q, l.from, l.to));
      if (!img.every((q) => set.has(key(q)))) return false;
      return img.every((q, i) =>
        edges.has([key(q), key(img[(i + 1) % img.length]!)].sort().join("|")),
      );
    });
  },
  "protractor-angles-select": (p, s) => {
    const els = pointsOf(p);
    const prot = els.find((e) => e.type === "protractor") as Extract<
      El,
      { type: "protractor" }
    >;
    const rays: number[] = [...prot.rays];
    for (const e of els)
      if (e.type === "segment")
        rays.push(Math.round((Math.atan2(e.to[1], e.to[0]) * 180) / Math.PI));
    const at = (name: string) => rays["ABCD".indexOf(name)]!;
    const m = s.label.match(/\\angle ([A-D])O([A-D])=(\d+)\^\\circ/);
    if (m) return Math.abs(at(m[2]!) - at(m[1]!)) === Number(m[3]);
    const w = s.label.match(/\\angle ([A-D])O([A-D])/)!;
    const measure = Number(p.public.prompt.match(/not \$(\d+)\^\\circ\$/)![1]);
    return Math.abs(at(w[2]!) - at(w[1]!)) !== measure;
  },
  "prism-volume-select": (p, s) => {
    const letter = s.label.match(/\$([A-F])\$/)![1]!;
    const edges = (
      panelsOf(p)
        .find((q) => q.letter === letter)!
        .members.filter((e) => e.type === "text") as Extract<
        El,
        { type: "text" }
      >[]
    ).map((t) => Number(t.text.replace(" cm", "")));
    assert.equal(edges.length, 3);
    const vol = edges[0]! * edges[1]! * edges[2]!;
    return vol === Number(p.public.prompt.match(/volume of \$(\d+)\$/)![1]);
  },
  "solid-figure-select": (p, s) => {
    const letter = s.label.match(/\$([A-F])\$/)![1]!;
    const sol = panelsOf(p)
      .find((q) => q.letter === letter)!
      .members.find((e) => e.type === "solid") as Extract<
      El,
      { type: "solid" }
    >;
    const d = sol.solid;
    const curved =
      d.type === "sphere" || ("base" in d && d.base.type === "ellipse");
    const n =
      "base" in d && d.base.type === "polygon" ? d.base.points.length : 0;
    const prism = d.type === "prism";
    const pyramid = d.type === "pyramid";
    const ask = p.public.prompt.replace(/^.* have /, "").replace(/\.$/, "");
    switch (ask) {
      case "two congruent parallel faces":
        return prism;
      case "a curved surface":
        return curved;
      case "only flat surfaces":
        return !curved;
      case "at least one triangular face":
        return (pyramid && !curved) || (prism && n === 3);
      case "6 or more flat faces":
        return !curved && (prism ? n + 2 >= 6 : n + 1 >= 6);
      default:
        throw new Error(ask);
    }
  },
  "stem-leaf-match-select": (p, s) => {
    const letter = s.label.match(/\$([A-D])\$/)![1]!;
    const data = nums(p.public.prompt.split("In each plot")[0]!).sort(
      (a, b) => a - b,
    );
    const panel = panelsOf(p).find((q) => q.letter === letter)!;
    const values = (
      panel.members.filter((e) => e.type === "text") as Extract<
        El,
        { type: "text" }
      >[]
    )
      .flatMap((t) => {
        const [stem, rest = ""] = t.text.split("|");
        return rest.trim()
          ? rest
              .trim()
              .split(/\s+/)
              .map((l) => Number(stem) * 10 + Number(l))
          : [];
      })
      .sort((a, b) => a - b);
    return (
      values.length === data.length && values.every((v, i) => v === data[i])
    );
  },
};

/* --------------------------------------------------------------- tests */

test("every select-all template is registered, deterministic and reachable", () => {
  assert.equal(mine.length, 26);
  for (const t of mine) {
    assert.ok(
      templates.some((x) => x.id === t.id),
      `${t.id} registered`,
    );
    assert.equal(t.requiredResponseCapability, "multi-select-v1");
    const a = generateProblem(t.id, "det:1");
    const b = generateProblem(t.id, "det:1");
    assert.deepEqual(a, b, `${t.id} deterministic`);
    const caps = t.requiredFigureCapability
      ? ["scenes-v1", "scenes-v2", "data-displays-v1"]
      : [];
    const via = generateProblemFor(t.id, "det:1", caps);
    assert.equal(via.public.templateId, t.id);
  }
});

test("every instance satisfies the public contract and has one exact key", () => {
  for (const t of mine) {
    for (const p of all(t.id)) {
      generatedProblemSchema.parse(p);
      const r = p.public.response;
      assert.equal(r.kind, "multi-select");
      if (r.kind !== "multi-select") continue;
      const ids = r.options.map((o) => o.id);
      assert.equal(new Set(ids).size, ids.length, `${t.id} ids distinct`);
      assert.equal(
        new Set(r.options.map((o) => o.label)).size,
        r.options.length,
        `${t.id} labels distinct: ${r.options.map((o) => o.label).join(" / ")}`,
      );
      const key = parseSelection(p.answer)!;
      assert.equal(key.length, r.selectionCount, `${t.id} count stated`);
      assert.ok(key.every((id) => ids.includes(id)));
      assert.ok(
        r.label.includes(String(r.selectionCount)),
        `${t.id} label says how many`,
      );
      assert.ok(r.options.every((o) => o.label.length <= 120));
      assert.match(p.variant!.id, /^[a-z0-9][a-z0-9-]{0,63}$/);
    }
  }
});

test("prompts and hints never quote a true statement", () => {
  for (const t of mine)
    for (const p of all(t.id)) {
      const text = `${p.public.prompt}\n${p.hint}`;
      for (const s of shown(p))
        if (s.truth)
          assert.ok(
            !text.includes(s.label),
            `${t.id}: ${s.label} in prompt or hint`,
          );
    }
});

test("hints name the instance and vary across seeds", () => {
  for (const t of mine) {
    const hints = new Set(all(t.id).map((p) => p.hint));
    assert.ok(hints.size >= 3, `${t.id} hints vary (${hints.size})`);
  }
});

test("the number of true statements varies, and every variant is reached", () => {
  const variants: Record<string, string[]> = {
    "place-value-forms-select": ["five-digit", "inner-zero", "word-comparison"],
    "equivalent-fractions-select": ["even-denominator", "odd-denominator"],
    "fraction-line-names-select": ["even-parts", "odd-parts"],
    "equivalent-ratios-select": ["first-part-greater", "second-part-greater"],
    "rounds-to-select": ["whole-place", "tenth-place", "hundredth-place"],
    "compare-to-pi-select": ["pi-greater", "pi-less", "root-greater"],
    "multiplication-fact-grid-select": ["small-product", "large-product"],
    "equal-factor-truth-select": ["equal-factors"],
    "story-expression-select": ["two-removals", "unknown-part"],
    "equal-expression-select": [
      "multiplied-difference",
      "added-difference",
      "divided-difference",
    ],
    "customary-equivalent-select": ["length", "capacity", "weight"],
    "additive-multiplicative-select": ["different-numbers", "same-number"],
    "equivalent-trinomial-select": ["given-trinomial", "given-factored"],
    "regression-prediction-select": ["positive-slope", "negative-slope"],
    "function-pair-select": ["4-points", "5-points"],
    "root-approximation-select": ["tenths-line"],
    "dot-plot-statement-select": ["short-scale", "medium-scale", "long-scale"],
    "shape-sides-select": ["parallel-sides", "perpendicular-sides"],
    "polygon-sides-select": ["four-sides", "more-sides"],
    "line-pair-select": ["parallel-pair", "perpendicular-pair"],
    "angle-kind-select": ["acute-angles", "right-angles", "obtuse-angles"],
    "symmetry-lines-select": ["one-line", "two-lines"],
    "protractor-angles-select": ["true-measures", "not-the-measure"],
    "prism-volume-select": ["labeled-edges"],
    "solid-figure-select": [
      "parallel-faces-solids",
      "curved-surface-solids",
      "flat-faces-solids",
      "triangle-face-solids",
      "many-faces-solids",
    ],
    "stem-leaf-match-select": ["four-plots"],
  };
  const fixedCount = new Set(["line-pair-select", "stem-leaf-match-select"]);
  for (const t of mine) {
    const ps = all(t.id);
    const got = new Set(ps.map((p) => p.variant!.id));
    assert.deepEqual(
      [...got].sort(),
      [...variants[t.id]!].sort(),
      `${t.id} variants`,
    );
    const counts = new Set(
      ps.map(
        (p) => (p.public.response as { selectionCount: number }).selectionCount,
      ),
    );
    if (!fixedCount.has(t.id))
      assert.ok(
        counts.size >= 2,
        `${t.id} varies its true count: ${[...counts]}`,
      );
  }
});

test("equal-factor equations offer both answer formats and orientations", () => {
  const ps = all("equal-factor-truth-select");
  const formats = new Set(ps.map((p) => p.variant!.axes!["answer-format"]));
  assert.deepEqual([...formats].sort(), ["select-all", "true-false-pair"]);
  const orientations = new Set(ps.map((p) => p.variant!.axes!["orientation"]));
  assert.equal(orientations.size, 3);
});

test("an independent oracle agrees with the key on every displayed statement", () => {
  for (const t of mine) {
    const oracle = oracles[t.id];
    assert.ok(oracle, `${t.id} has an oracle`);
    for (const p of all(t.id)) {
      for (const s of shown(p))
        assert.equal(
          oracle(p, s),
          s.truth,
          `${t.id} ${p.public.seed}: ${s.label} (prompt: ${p.public.prompt})`,
        );
    }
  }
});

test("each template has a method, principle, lesson, facet mapping and archetype link", () => {
  for (const t of mine) {
    assert.ok(methods[t.id], `${t.id} method`);
    assert.ok(principles[t.id], `${t.id} principle`);
    assert.ok(
      lessons.some((l) => l.templateIds.includes(t.id)),
      `${t.id} lesson`,
    );
    const maps = Object.values(actualFacetMappings)
      .flat()
      .filter((m) => m.templateId === t.id);
    assert.ok(maps.length >= 1 && maps.every((m) => m.extent === "partial"));
    assert.ok(templateArchetypes[t.id]?.length, `${t.id} archetype`);
  }
});

test("a released item is covered only by a select-all family that does the whole item", () => {
  const ids = new Set(mine.map((t) => t.id));
  for (const item of releasedItems) {
    if (item.responseFormat !== "multi-select" || item.status !== "covered")
      continue;
    const cited = item.templateIds.filter((id) => ids.has(id));
    if (!cited.length) continue;
    const types = item.templateIds.map(
      (id) => templates.find((t) => t.id === id)!.requiredResponseCapability,
    );
    assert.ok(
      types.includes("multi-select-v1"),
      `${item.sourceId} ${item.item.number}`,
    );
  }
});
