import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  n,
  nonzero,
  pick,
  rat,
  seeded,
  type Case,
  type Choice,
  type Random,
  type Rational,
} from "./algebra-one-kit";
import { act, f, graph, step } from "./scene/author";
import type { Fn, Scene } from "./scene/spec";
import { layoutScene } from "./scene/layout";
import { missingTargets } from "./scene/timeline";
import {
  inPiece,
  machineScene,
  parentFn,
  pieceAt,
  piecewiseGraph,
  piecewiseWindow,
  piecewiseWalkthrough,
  reflectPointsScene,
  reflectionScene,
  transformGraph,
  transformWalkthrough,
  transformWindow,
  valueTable,
  compareScene,
  type Parent,
  type Piece,
} from "./function-toolkit-scenes";

/** The function toolkit (HSF.IF.C.7b, HSF.BF.A.1c, HSF.BF.B.3–4,
 * HSF.IF.C.9): piecewise functions, transformations, composition, inverses,
 * and comparing functions given in different representations. Every
 * expression is set in TeX; every figure is a scene. */
const choice = { requiredResponseCapability: "single-choice-v1" as const };
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const hs = { version: 1 as const, gradeBand: "9–12" as const };

export const functionToolkitTemplates: readonly TemplateMetadata[] = [
  {
    ...hs,
    id: "piecewise-evaluate",
    title: "Evaluate a piecewise function",
    skillId: "piecewise-functions",
    description:
      "Evaluate a function defined in pieces from its rule, at a boundary, from its graph with open and closed endpoints, or in a pricing story.",
    ...scenes,
  },
  {
    ...hs,
    id: "piecewise-reading",
    title: "Read a piecewise function",
    skillId: "piecewise-functions",
    description:
      "Write an absolute-value function as two linear pieces, read a piece's rule from a graph, or count the solutions of an equation on a piecewise graph.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "transform-equation",
    title: "Equations of transformed graphs",
    skillId: "function-transformations",
    description:
      "Match a shifted, stretched or reflected parent graph with its equation, from words or a graph, and describe what a change to the rule does to the graph.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "transform-point",
    title: "Where a point goes",
    skillId: "function-transformations",
    description:
      "Follow one point of a graph through a shift, stretch or reflection, and use even and odd symmetry.",
    ...scenes,
  },
  {
    ...hs,
    id: "composition-value",
    title: "Evaluate a composition",
    skillId: "function-composition",
    description:
      "Evaluate a composition from formulas, a table or graphs, and find the input excluded from a composition's domain.",
    ...scenes,
  },
  {
    ...hs,
    id: "composition-expression",
    title: "Compose and decompose functions",
    skillId: "function-composition",
    description:
      "Choose the expression for a composition in either order, or split a function into an outer and an inner function.",
    ...choice,
  },
  {
    ...hs,
    id: "inverse-value",
    title: "Values of an inverse",
    skillId: "inverse-functions",
    description:
      "Find a value of an inverse function from a formula, a table or a graph.",
    ...scenes,
  },
  {
    ...hs,
    id: "inverse-expression",
    title: "Find and restrict inverses",
    skillId: "inverse-functions",
    description:
      "Choose the inverse of a linear function or of a quadratic on half its domain, the point that mirrors in the line of symmetry, or a domain on which a quadratic has an inverse.",
    ...choice,
  },
  {
    ...hs,
    id: "compare-representations",
    title: "Compare functions across representations",
    skillId: "cross-representation-comparison",
    description:
      "Compare the maximum, minimum, intercept or average rate of change of a function given by a formula with one given by a graph or a table.",
    ...choice,
    ...scenes,
  },
];

// ------------------------------------------------------------------ TeX text
const M = (t: string) => `$${t}$`;
/** A number in TeX: ASCII minus. */
const tn = (v: number) => (v < 0 ? `-${-v}` : `${v}`);
/** A number substituted into TeX, parenthesized when negative. */
const tp = (v: number) => (v < 0 ? `(-${-v})` : `${v}`);
/** A rational in TeX. */
const tq = (v: Rational) =>
  v.d === 1 ? tn(v.n) : `${v.n < 0 ? "-" : ""}\\frac{${Math.abs(v.n)}}{${v.d}}`;
/** " + 4", " - 4", "" for 0. */
const plus = (c: number) => (c === 0 ? "" : c < 0 ? ` - ${-c}` : ` + ${c}`);
/** A leading coefficient: "", "-", "3". */
const coef = (c: number) => (c === 1 ? "" : c === -1 ? "-" : tn(c));
/** mx + b in TeX. */
export function linTex(m: number, b: number, v = "x") {
  if (m === 0) return tn(b);
  return `${coef(m)}${v}${plus(b)}`;
}
/** A polynomial from coefficients, highest power first. */
export function polyTex(desc: number[], v = "x") {
  const deg = desc.length - 1;
  const parts: string[] = [];
  desc.forEach((c, i) => {
    const k = deg - i;
    if (c === 0) return;
    const power = k === 0 ? "" : k === 1 ? v : `${v}^${k}`;
    const mag = Math.abs(c) === 1 && k > 0 ? "" : String(Math.abs(c));
    if (!parts.length) parts.push(`${c < 0 ? "-" : ""}${mag}${power}`);
    else parts.push(` ${c < 0 ? "-" : "+"} ${mag}${power}`);
  });
  return parts.length ? parts.join("") : "0";
}
/** "x - 3", "x + 2" or "x". */
const shifted = (h: number, v = "x") =>
  h === 0 ? v : `${v} ${h > 0 ? "-" : "+"} ${Math.abs(h)}`;
/** A number in prose: a negative one is set as math for its minus sign. */
const mn = (v: number) => (v < 0 ? M(tn(v)) : String(v));
const units = (v: number) =>
  `${Math.abs(v)} ${Math.abs(v) === 1 ? "unit" : "units"}`;
const pt = (x: number, y: number) => `(${tn(x)}, ${tn(y)})`;

/** Three wrong options, distinct from the correct one and each other. */
function options(correct: string, wrong: Choice[]): Choice[] | null {
  const seen = new Set([correct]);
  const out: Choice[] = [];
  for (const w of wrong)
    if (!seen.has(w.label) && out.length < 3) {
      seen.add(w.label);
      out.push(w);
    }
  return out.length === 3 ? [{ label: correct, correct: true }, ...out] : null;
}
/** Keep the wrong options whose functions differ from the correct one and
 * from each other on the sample inputs. */
function distinctBy<T>(
  correct: T,
  wrong: (T & { feedback: string })[],
  values: (t: T) => number[],
): (T & { feedback: string })[] {
  const key = (t: T) =>
    values(t)
      .map((v) => (Number.isFinite(v) ? v.toFixed(9) : "–"))
      .join("|");
  const seen = new Set([key(correct)]);
  return wrong.filter((w) => {
    const k = key(w);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ------------------------------------------------------------------ pieces
const condTex = (p: Piece, v = "x") => {
  if (p.lo === null) return `${v} ${p.hiIn ? "\\le" : "<"} ${tn(p.hi!)}`;
  if (p.hi === null) return `${v} ${p.loIn ? "\\ge" : ">"} ${tn(p.lo)}`;
  return `${tn(p.lo)} ${p.loIn ? "\\le" : "<"} ${v} ${p.hiIn ? "\\le" : "<"} ${tn(p.hi)}`;
};
const ruleTex = (p: Piece) => linTex(p.m, p.b);
export const casesTex = (pieces: Piece[]) =>
  `\\begin{cases} ${pieces.map((p) => `${ruleTex(p)} & ${condTex(p)}`).join(" \\\\ ")} \\end{cases}`;
/** The value of mx + b at x, worked: "2(3) + 1 = 7". */
function worked(m: number, b: number, x: number) {
  const value = m * x + b;
  if (m === 0) return tn(b);
  const term =
    m === 1 ? tp(x) : m === -1 ? `-${tp(x)}` : `${tn(m)} \\cdot ${tp(x)}`;
  const written = `${term}${plus(b)}`;
  return written === tn(value) ? written : `${written} = ${tn(value)}`;
}

function twoPieces(r: Random, slopes: number[], c: number): Piece[] {
  const leftIn = r(0, 1) === 1;
  return [
    {
      m: pick(r, slopes),
      b: r(-5, 5),
      lo: null,
      hi: c,
      loIn: false,
      hiIn: leftIn,
    },
    {
      m: pick(r, slopes),
      b: r(-5, 5),
      lo: c,
      hi: null,
      loIn: !leftIn,
      hiIn: false,
    },
  ];
}
function threePieces(r: Random, slopes: number[]): Piece[] {
  const c1 = r(-4, 0),
    c2 = c1 + r(2, 4);
  const a = r(0, 1) === 1,
    b = r(0, 1) === 1;
  return [
    { m: pick(r, slopes), b: r(-5, 5), lo: null, hi: c1, loIn: false, hiIn: a },
    { m: pick(r, slopes), b: r(-5, 5), lo: c1, hi: c2, loIn: !a, hiIn: b },
    {
      m: pick(r, slopes),
      b: r(-5, 5),
      lo: c2,
      hi: null,
      loIn: !b,
      hiIn: false,
    },
  ];
}
const pieceOf = (pieces: Piece[], x: number) =>
  pieces.findIndex((p) => inPiece(p, x));
const boundaries = (pieces: Piece[]) => pieces.slice(1).map((p) => p.lo!);
/** Distinct neighbours: adjacent pieces differ in rule. */
const distinctRules = (pieces: Piece[]) =>
  pieces.every(
    (p, i) => i === 0 || p.m !== pieces[i - 1]!.m || p.b !== pieces[i - 1]!.b,
  );
/** A walkthrough only when every step finds its target: a piece entirely
 * outside the window has nothing to light up. */
function playable(scene: Scene | undefined): Scene | undefined {
  if (!scene?.steps) return scene;
  return missingTargets(layoutScene(scene, { reveal: true }), scene.steps)
    .length
    ? undefined
    : scene;
}
function pieceWalk(pieces: Piece[], a?: number) {
  return playable(
    piecewiseWalkthrough(
      pieces,
      pieces.map(ruleTex),
      pieces.map((p) => condTex(p)),
      a,
    ),
  );
}

// ------------------------------------------------------- piecewise-evaluate
const STORIES = [
  {
    v: "w",
    prompt: (cases: string, w: number) =>
      `A courier charges $C(w)$ dollars to ship a parcel of $w$ kilograms, where $C(w) = ${cases}$. What does a parcel of ${w} kilograms cost to ship, in dollars?`,
    close: (w: number, cost: number) =>
      `A parcel of ${w} kilograms costs ${cost} dollars to ship.`,
  },
  {
    v: "g",
    prompt: (cases: string, g: number) =>
      `A phone plan costs $C(g)$ dollars for a month in which $g$ gigabytes of data are used, where $C(g) = ${cases}$. What does a month with ${g} gigabytes cost, in dollars?`,
    close: (g: number, cost: number) =>
      `A month with ${g} gigabytes costs ${cost} dollars.`,
  },
];
function piecewiseStory(r: Random): Case {
  const story = pick(r, STORIES);
  const base = r(6, 15),
    limit = r(2, 5),
    rate = r(2, 4);
  const amount = r(0, 4) === 0 ? r(2, limit) : r(limit + 1, limit + 6);
  const v = story.v;
  const cases = `\\begin{cases} ${base} & 0 < ${v} \\le ${limit} \\\\ ${base} + ${rate}(${v} - ${limit}) & ${v} > ${limit} \\end{cases}`;
  const over = amount > limit;
  const cost = over ? base + rate * (amount - limit) : base;
  return {
    prompt: story.prompt(cases, amount),
    answer: rat(cost),
    explanation: over
      ? [
          `This is a piecewise function: it has a different rule for each range of ${M(v)}. The condition beside each rule says when to use it.`,
          `${M(`${amount} > ${limit}`)}, so use the second rule, ${M(`C(${v}) = ${base} + ${rate}(${v} - ${limit})`)}. It charges ${rate} more for each unit past ${limit}.`,
          `${M(`C(${amount}) = ${base} + ${rate}(${amount} - ${limit}) = ${base} + ${rate * (amount - limit)} = ${cost}`)}.`,
          story.close(amount, cost),
        ]
      : [
          `This is a piecewise function: it has a different rule for each range of ${M(v)}. The condition beside each rule says when to use it.`,
          `${M(`0 < ${amount} \\le ${limit}`)}, so the first rule applies: the flat charge.`,
          `${M(`C(${amount}) = ${base}`)}.`,
          story.close(amount, cost),
        ],
    hint: `Check which condition ${M(`${v} = ${amount}`)} meets, ${M(`0 < ${v} \\le ${limit}`)} or ${M(`${v} > ${limit}`)}, then use only that rule.`,
    tags: ["story", over ? "second-piece" : "first-piece"],
  };
}
function piecewiseEvaluate(r: Random): Case {
  const frame = pick(r, ["formula", "boundary", "graph", "story"] as const);
  if (frame === "story") return piecewiseStory(r);
  for (;;) {
    const graphFrame = frame === "graph";
    const slopes = graphFrame ? [-2, -1, 0, 1, 2] : [-3, -2, -1, 0, 1, 2, 3];
    const pieces =
      !graphFrame && r(0, 2) === 0
        ? threePieces(r, slopes)
        : twoPieces(r, slopes, r(-3, 3));
    if (!distinctRules(pieces)) continue;
    const cuts = boundaries(pieces);
    const atCut = frame === "boundary" || (graphFrame && r(0, 4) < 3);
    const a = atCut ? pick(r, cuts) : r(-5, 5);
    if (!atCut && cuts.includes(a)) continue;
    const i = pieceOf(pieces, a);
    const p = pieces[i]!;
    const value = pieceAt(p, a);
    // The other piece at a gives a different value, so a wrong choice of
    // piece shows.
    const neighbour = pieces[i === 0 ? 1 : i - 1]!;
    if (pieceAt(neighbour, a) === value) continue;
    if (graphFrame) {
      if (Math.abs(value) > 8) continue;
      if (pieces.some((q) => Math.abs(pieceAt(q, q.lo ?? q.hi!)) > 8)) continue;
    }
    const fx = `f(${tn(a)})`;
    const why = `${M(condTex(p, tn(a)))}, so ${M(`x = ${tn(a)}`)} uses the rule ${M(`f(x) = ${ruleTex(p)}`)}.`;
    const walkthrough = pieceWalk(pieces, a);
    if (graphFrame) {
      const scene = piecewiseGraph(pieces);
      const ends = atCut
        ? `At ${M(`x = ${tn(a)}`)} one piece ends in an open circle and the other has a filled dot; only the filled dot is on the graph.`
        : `Above or below ${M(`x = ${tn(a)}`)} there is exactly one point of the graph.`;
      return {
        prompt: `The graph shows ${M("y = f(x)")}. What is ${M(fx)}?`,
        answer: rat(value),
        scene,
        explanation: [
          `${M(fx)}, read "${M("f")} of ${n(a)}", is the height of the graph above or below ${M(`x = ${tn(a)}`)}.`,
          ends,
          `That point is ${M(pt(a, value))}, so ${M(`${fx} = ${tn(value)}`)}.`,
        ],
        hint: `Find ${M(`x = ${tn(a)}`)} on the ${M("x")}-axis and go straight up or down to the graph.${atCut ? " An open circle is not on the graph; use the filled dot." : ""}`,
        hintCue: [
          step(
            `Only this piece is defined at $x = ${tn(a)}$.`,
            act.highlight(`g.curve.${i}`),
          ),
        ],
        walkthrough,
        tags: ["graph", atCut ? "endpoint" : "interior"],
      };
    }
    const prompt =
      frame === "boundary" || r(0, 1)
        ? `Let ${M(`f(x) = ${casesTex(pieces)}`)}. What is ${M(fx)}?`
        : `A function is defined by ${M(`f(x) = ${casesTex(pieces)}`)}. Find ${M(fx)}.`;
    return {
      prompt,
      answer: rat(value),
      explanation: [
        `This is a piecewise function: a different rule for each range of ${M("x")}. ${M(fx)} means the output when ${M(`x = ${tn(a)}`)}.`,
        `First find which condition ${n(a)} meets. ${why}`,
        `Substitute ${n(a)} into that rule only: ${M(`${fx} = ${worked(p.m, p.b, a)}`)}.`,
        `So ${M(`${fx} = ${tn(value)}`)}.`,
      ],
      hint:
        frame === "boundary"
          ? `${M(`x = ${tn(a)}`)} is where the rule changes. Only one condition includes ${n(a)} itself: look for ${M("\\le")} or ${M("\\ge")} beside ${n(a)}.`
          : `Find the condition that ${M(`x = ${tn(a)}`)} satisfies, then substitute into that piece's rule only.`,
      walkthrough,
      tags: [frame, pieces.length === 3 ? "three-pieces" : "two-pieces"],
    };
  }
}

// -------------------------------------------------------- piecewise-reading
function absRule(r: Random): Case {
  for (;;) {
    const a = pick(r, [1, -1, 2, -2, 3, -3]),
      h = nonzero(r, -5, 5),
      k = r(-6, 6);
    const left = r(0, 1) === 1;
    const L = { m: -a, b: k + a * h },
      R = { m: a, b: k - a * h };
    const C = left ? L : R,
      O = left ? R : L;
    const cond = left ? `x < ${tn(h)}` : `x \\ge ${tn(h)}`;
    const absTex = `${coef(a)}|${shifted(h)}|${plus(k)}`;
    const wrong = distinctBy(
      C,
      [
        {
          ...O,
          feedback: `This is the rule for the other side of ${M(`x = ${tn(h)}`)}, where the inside of the absolute value has the opposite sign.`,
        },
        {
          m: C.m,
          b: left ? k - a * h : k + a * h,
          feedback: `This has a sign error with ${n(h)}. Expand ${M(`${left ? coef(-a) : coef(a)}(${shifted(h)})`)} carefully, multiplying both terms.`,
        },
        {
          m: -C.m,
          b: C.b,
          feedback: `This has the wrong slope sign. For ${M(cond)} the slope, the change in ${M("y")} per step in ${M("x")}, is ${n(C.m)}, not ${n(-C.m)}.`,
        },
        {
          m: C.m,
          b: left ? h + k : k - h,
          feedback: `This multiplies only the first term inside the brackets. Multiply both terms by ${n(C.m)}.`,
        },
        {
          m: C.m,
          b: -C.b,
          feedback: `This has the wrong sign on the constant term. Test it: substitute a value of ${M("x")} into both the original and this rule.`,
        },
      ],
      (t) => [0, 1, 2].map((x) => t.m * x + t.b),
    );
    const choices = options(
      M(linTex(C.m, C.b)),
      wrong.map((w) => ({ label: M(linTex(w.m, w.b)), feedback: w.feedback })),
    );
    if (!choices) continue;
    const pieces: Piece[] = [
      { m: L.m, b: L.b, lo: null, hi: h, loIn: false, hiIn: false },
      { m: R.m, b: R.b, lo: h, hi: null, loIn: true, hiIn: false },
    ];
    const inside = left ? `-(${shifted(h)})` : `(${shifted(h)})`;
    return {
      prompt: `Let ${M(`f(x) = ${absTex}`)}. Which expression equals ${M("f(x)")} for ${M(cond)}?`,
      choices,
      explanation: [
        `The absolute value ${M("|u|")} is the distance of ${M("u")} from 0. It equals ${M("u")} when ${M("u")} is 0 or positive, and ${M("-u")}, the opposite, when ${M("u")} is negative.`,
        `For ${M(cond)}, ${M(`${shifted(h)} ${left ? "<" : "\\ge"} 0`)}, so ${M(`|${shifted(h)}| = ${inside}`)}.`,
        `${M(`f(x) = ${left ? coef(-a) : coef(a)}(${shifted(h)})${plus(k)} = ${linTex(C.m, C.b)}`)}.`,
        `So ${M(`f(x) = ${linTex(C.m, C.b)}`)} for ${M(cond)}.`,
      ],
      hint: `For ${M(cond)}, the inside ${M(shifted(h))} is ${left ? "negative" : "zero or positive"}, so ${M(`|${shifted(h)}| = ${inside}`)}. Substitute that and simplify.`,
      walkthrough: pieceWalk(pieces),
      tags: ["abs-rule", left ? "left" : "right"],
    };
  }
}
function graphRule(r: Random): Case {
  for (;;) {
    const pieces = twoPieces(r, [-2, -1, 1, 2], r(-2, 2));
    if (!distinctRules(pieces)) continue;
    if (
      pieces.some(
        (q) => Math.abs(pieceAt(q, q.lo ?? q.hi!)) > 7 || Math.abs(q.b) > 4,
      )
    )
      continue;
    const q = r(0, 1);
    const p = pieces[q]!,
      other = pieces[1 - q]!;
    const c = p.lo ?? p.hi!;
    const xs = q === 0 ? [c - 3, c - 1] : [c + 1, c + 3];
    const ys = xs.map((x) => pieceAt(p, x));
    if (ys.some((y) => Math.abs(y) > 8)) continue;
    const cond = condTex(p);
    const end = pieceAt(p, c);
    const wrong = distinctBy(
      p as { m: number; b: number },
      [
        {
          m: other.m,
          b: other.b,
          feedback: `This reads the other piece, the one beyond ${M(`x = ${tn(c)}`)}. Use only the piece drawn for ${M(cond)}.`,
        },
        {
          m: -p.m,
          b: p.b,
          feedback: `This has the wrong slope sign. The piece ${p.m > 0 ? "rises" : "falls"} from left to right, so its slope is ${p.m > 0 ? "positive" : "negative"}.`,
        },
        {
          m: p.m,
          b: end,
          feedback: `This uses the height at the endpoint. ${n(end)} is the height at ${M(`x = ${tn(c)}`)}, but the constant term is the height at ${M("x = 0")}.`,
        },
        {
          m: p.m,
          b: -p.b,
          feedback: `This has the wrong sign on the constant term. Extend the piece to ${M("x = 0")} and read the height there.`,
        },
        {
          m: 2 * p.m,
          b: p.b,
          feedback:
            "This doubles the slope. Find the slope as rise over run, the change in height divided by the change across, between two points of the piece.",
        },
      ],
      (t) => [0, 1, 2].map((x) => t.m * x + t.b),
    );
    const choices = options(
      M(linTex(p.m, p.b)),
      wrong.map((w) => ({ label: M(linTex(w.m, w.b)), feedback: w.feedback })),
    );
    if (!choices) continue;
    return {
      prompt: `The graph of ${M("y = f(x)")} is made of two pieces. Which rule gives ${M("f(x)")} for ${M(cond)}?`,
      choices,
      scene: piecewiseGraph(pieces),
      explanation: [
        `Each piece is part of a straight line ${M("y = mx + b")}. Here ${M("m")} is the slope, the rise per step across, and ${M("b")} is the height at ${M("x = 0")}.`,
        `The piece for ${M(cond)} passes through ${M(pt(xs[0]!, ys[0]!))} and ${M(pt(xs[1]!, ys[1]!))}.`,
        `Its slope is the change in height over the change across: ${M(`\\frac{${tn(ys[1]!)} - ${tp(ys[0]!)}}{${tn(xs[1]!)} - ${tp(xs[0]!)}} = ${tn(p.m)}`)}.`,
        `Extend the piece to ${M("x = 0")}: its height there is ${n(p.b)}.`,
        `So ${M(`f(x) = ${linTex(p.m, p.b)}`)} for ${M(cond)}.`,
      ],
      hint: `Use only the piece drawn for ${M(cond)}: read two points on it, find its slope, then its height at ${M("x = 0")}.`,
      hintCue: [
        step(`This is the piece for $${cond}$.`, act.highlight(`g.curve.${q}`)),
      ],
      walkthrough: pieceWalk(pieces),
      tags: ["graph-rule", q === 0 ? "left" : "right"],
    };
  }
}
const COUNT = ["None", "Exactly one", "Exactly two", "Exactly three"];
function solutionCount(r: Random): Case {
  for (;;) {
    const pieces =
      r(0, 1) === 1
        ? threePieces(r, [-2, -1, 0, 1, 2])
        : twoPieces(r, [-2, -1, 0, 1, 2], r(-3, 3));
    if (!distinctRules(pieces)) continue;
    if (pieces.some((q) => Math.abs(pieceAt(q, q.lo ?? q.hi!)) > 7)) continue;
    const level = r(-5, 6);
    const view = piecewiseWindow(pieces);
    if (level <= view.y[0] || level >= view.y[1]) continue;
    if (pieces.some((p) => p.m === 0 && p.b === level)) continue;
    const hits: Rational[] = [];
    let openHit: number | null = null,
      ok = true;
    for (const p of pieces) {
      if (p.m === 0) continue;
      const x = rat(level - p.b, p.m);
      const xv = x.n / x.d;
      for (const e of [p.lo, p.hi])
        if (e !== null && xv !== e && Math.abs(xv - e) < 0.4) ok = false;
      if (Math.abs(xv) > 5.5) {
        // A crossing outside the window would be invisible.
        if (inPiece(p, xv)) ok = false;
        continue;
      }
      if (inPiece(p, xv)) hits.push(x);
      else if ((xv === p.lo || xv === p.hi) && !inPiece(p, xv)) openHit = xv;
    }
    if (!ok) continue;
    // An open circle covered by another piece's filled dot is a solution.
    if (openHit !== null && hits.some((x) => x.n / x.d === openHit))
      openHit = null;
    const count = hits.length;
    if (count > 3) continue;
    // Prefer interesting counts: an open circle on the line, or two or more.
    if (count < 2 && openHit === null && r(0, 2) > 0) continue;
    const label = COUNT[count]!;
    const wrong: Choice[] = COUNT.filter((_, i) => i !== count).map((l) => ({
      label: l,
      feedback:
        openHit !== null && COUNT.indexOf(l) === count + 1
          ? `This counts an open circle. At ${M(`x = ${tn(openHit)}`)} the line meets an open circle, which is not a point of the graph.`
          : `This miscounts the crossings. Follow the line ${M(`y = ${tn(level)}`)} across the whole window and count every point where it meets the graph.`,
    }));
    const list = hits
      .slice()
      .sort((u, v) => u.n / u.d - v.n / v.d)
      .map((x) => M(`x = ${tq(x)}`));
    const meets = list.length
      ? `The line ${M(`y = ${tn(level)}`)} meets the graph at ${list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`}.`
      : `The line ${M(`y = ${tn(level)}`)} does not meet the graph.`;
    const words = [
      "no solutions",
      "exactly one solution",
      "exactly two solutions",
      "exactly three solutions",
    ][count]!;
    return {
      prompt: `The graph shows ${M("y = f(x)")} and the dashed line ${M(`y = ${tn(level)}`)}. How many solutions does ${M(`f(x) = ${tn(level)}`)} have?`,
      choices: [{ label, correct: true }, ...wrong],
      scene: piecewiseGraph(pieces, { level }),
      explanation: [
        `A solution of ${M(`f(x) = ${tn(level)}`)} is an ${M("x")} where the graph has height ${n(level)}. Those are the points where the dashed line meets the graph.`,
        meets,
        ...(openHit !== null
          ? [
              `At ${M(`x = ${tn(openHit)}`)} it reaches an open circle, which is not on the graph.`,
            ]
          : []),
        `So ${M(`f(x) = ${tn(level)}`)} has ${words}.`,
      ],
      hint: `Follow the dashed line ${M(`y = ${tn(level)}`)} across and count the points where it meets the graph. A filled dot on it counts; an open circle does not.`,
      hintCue: [
        step(
          `Count where $y = ${tn(level)}$ meets the graph.`,
          act.highlight("g.line.0"),
        ),
      ],
      walkthrough: pieceWalk(pieces),
      tags: [
        "solutions",
        `count-${count}`,
        ...(openHit !== null ? ["open-on-line"] : []),
      ],
    };
  }
}
function piecewiseReading(r: Random): Case {
  const frame = pick(r, ["abs-rule", "graph-rule", "solutions"] as const);
  return frame === "abs-rule"
    ? absRule(r)
    : frame === "graph-rule"
      ? graphRule(r)
      : solutionCount(r);
}

// ------------------------------------------------------ transform-equation
const PARENTS: Parent[] = ["square", "abs", "sqrt", "cube"];
/** p(x − h) in TeX. */
export function parentTex(p: Parent, h: number) {
  const inner = shifted(h);
  const group = h === 0 ? "x" : `(${inner})`;
  switch (p) {
    case "square":
      return `${group}^2`;
    case "abs":
      return `|${inner}|`;
    case "sqrt":
      return `\\sqrt{${inner}}`;
    case "cube":
      return `${group}^3`;
  }
}
const formTex = (p: Parent, a: number, h: number, k: number) =>
  `${coef(a)}${parentTex(p, h)}${plus(k)}`;
export function parentAt(p: Parent, x: number) {
  return p === "square"
    ? x * x
    : p === "abs"
      ? Math.abs(x)
      : p === "sqrt"
        ? x < 0
          ? NaN
          : Math.sqrt(x)
        : x * x * x;
}
type Form = { a: number; h: number; k: number };
const formAt = (p: Parent, t: Form, x: number) =>
  t.a * parentAt(p, x - t.h) + t.k;
const formValues = (p: Parent, center: number) => (t: Form) =>
  [0, 1, 2, 4, 9].map((d) => formAt(p, t, center + d));

function transformEquation(r: Random): Case {
  const frame = pick(r, ["words", "graph", "describe"] as const);
  if (frame === "describe") return transformDescribe(r);
  for (;;) {
    const p = pick(r, PARENTS);
    const a =
      frame === "graph" ? pick(r, [1, -1, 2, -2]) : pick(r, [2, 3, -1, -2, -3]);
    const h = frame === "graph" ? r(-3, 3) : nonzero(r, -5, 5),
      k = frame === "graph" ? r(-4, 4) : nonzero(r, -6, 6);
    if (frame === "graph" && h === 0 && k === 0) continue;
    if (frame === "graph") {
      const w = transformWindow(p, a, h, k);
      if (k + a < w.y[0] || k + a > w.y[1] || k < w.y[0] || k > w.y[1])
        continue;
    }
    const C = { a, h, k };
    const wrongForms = distinctBy(
      C,
      [
        {
          a,
          h: -h,
          k,
          feedback: `This shifts the wrong way sideways. A shift of ${units(h)} ${h > 0 ? "right" : "left"} replaces ${M("x")} with ${M(shifted(h))}: inside, the sign is opposite to the direction.`,
        },
        {
          a,
          h,
          k: a * k,
          feedback: `This multiplies the vertical shift by ${n(a)}. The shift of ${units(k)} comes after the stretch, so it is added on its own.`,
        },
        {
          a: -a,
          h,
          k,
          feedback:
            a < 0
              ? "This drops the reflection. The graph is flipped across the $x$-axis, so the multiplier is negative."
              : "This adds a reflection that is not there. The graph is not flipped, so the multiplier is positive.",
        },
        {
          a,
          h: k,
          k: h,
          feedback: `This swaps the two shifts. The sideways shift goes inside, with ${M("x")}; the up-down shift is added outside.`,
        },
        {
          a,
          h,
          k: -k,
          feedback: `This moves the graph the wrong way vertically. A shift ${k > 0 ? "up" : "down"} ${k > 0 ? "adds" : "subtracts"} ${units(k)} outside.`,
        },
      ],
      formValues(p, h),
    );
    const choices = options(
      M(`y = ${formTex(p, a, h, k)}`),
      wrongForms.map((w) => ({
        label: M(`y = ${formTex(p, w.a, w.h, w.k)}`),
        feedback: w.feedback,
      })),
    );
    if (!choices) continue;
    const base = parentTex(p, 0);
    const walkthrough = transformWalkthrough(
      p,
      a,
      h,
      k,
      base,
      formTex(p, a, h, k),
    );
    const explain = [
      ...(h !== 0
        ? [
            `Shifting ${units(h)} ${h > 0 ? "right" : "left"} replaces ${M("x")} with ${M(shifted(h))}: ${M(`y = ${parentTex(p, h)}`)}.`,
          ]
        : []),
      ...(a !== 1
        ? [
            `${a < 0 ? (a === -1 ? "Reflecting across the $x$-axis" : `Reflecting across the $x$-axis and stretching by ${Math.abs(a)}`) : `Stretching vertically by ${a}`} multiplies every output by ${mn(a)}: ${M(`y = ${formTex(p, a, h, 0)}`)}.`,
          ]
        : []),
      ...(k !== 0
        ? [
            `Shifting ${units(k)} ${k > 0 ? "up" : "down"} adds ${mn(k)} to every output: ${M(`y = ${formTex(p, a, h, k)}`)}.`,
          ]
        : []),
    ];
    if (frame === "graph")
      return {
        prompt: `The dashed curve is ${M(`y = ${base}`)}. Which equation describes the solid curve?`,
        choices,
        scene: transformGraph(p, a, h, k),
        explanation: [
          `A transformation moves or stretches a graph. In ${M("y = a\\,f(x - h) + k")}, ${M("h")} shifts it sideways, ${M("k")} shifts it up or down, and ${M("a")} stretches or flips it.`,
          `The key point of ${M(`y = ${base}`)} moved from ${M("(0, 0)")} to ${M(pt(h, k))}. That gives ${M(`h = ${tn(h)}`)} and ${M(`k = ${tn(k)}`)}.`,
          `One unit right of its key point, ${M(`y = ${base}`)} rises 1 unit and the solid curve ${a > 0 ? "rises" : "falls"} ${units(a)}. So every height is multiplied by ${mn(a)}${a < 0 ? ", and the negative sign flips it" : ""}.`,
          `So the solid curve is ${M(`y = ${formTex(p, a, h, k)}`)}.`,
        ],
        hint: `The dashed curve ${M(`y = ${base}`)} has its key point at ${M("(0, 0)")}. See where the marked point moved, then compare heights 1 unit to its right.`,
        hintCue: [
          step("The key point moved here.", act.highlight("g.point.0")),
          step(
            "Compare the solid curve with the dashed one.",
            act.highlight("g.curve.1"),
          ),
        ],
        walkthrough,
        tags: ["graph", p],
      };
    const parts = [
      ...(h !== 0 ? [`shifted ${units(h)} ${h > 0 ? "right" : "left"}`] : []),
      ...(a < 0 ? ["reflected across the $x$-axis"] : []),
      ...(Math.abs(a) > 1
        ? [`stretched vertically by a factor of ${Math.abs(a)}`]
        : []),
      ...(k !== 0 ? [`shifted ${units(k)} ${k > 0 ? "up" : "down"}`] : []),
    ];
    const said =
      parts.length === 1
        ? parts[0]!
        : `${parts.slice(0, -1).join(", ")}, and then ${parts.at(-1)}`;
    return {
      prompt: `The graph of ${M(`y = ${base}`)} is ${said}. Which equation describes the new graph?`,
      choices,
      explanation: [
        `A transformation moves or stretches a graph. Apply the changes one at a time, in the order given.`,
        ...explain,
        `So the new graph is ${M(`y = ${formTex(p, a, h, k)}`)}.`,
      ],
      hint: `Work in the order given. The shift of ${units(h)} ${h > 0 ? "right" : "left"} changes ${M("x")} to ${M(shifted(h))}; then multiply the output by ${mn(a)} before adding ${mn(k)}.`,
      walkthrough,
      tags: ["words", p],
    };
  }
}

type Move = (p: [number, number]) => [number, number];
function transformDescribe(r: Random): Case {
  const kind = pick(r, ["shift-x", "shift-y", "reflect", "scale"] as const);
  const c = r(2, 6);
  const s = pick(r, [2, 3, 4]);
  type Opt = { label: string; move: Move };
  const translations: Opt[] = [
    { label: `Shift ${units(c)} left`, move: ([x, y]) => [x - c, y] },
    { label: `Shift ${units(c)} right`, move: ([x, y]) => [x + c, y] },
    { label: `Shift ${units(c)} up`, move: ([x, y]) => [x, y + c] },
    { label: `Shift ${units(c)} down`, move: ([x, y]) => [x, y - c] },
  ];
  const reflections: Opt[] = [
    { label: `Reflect across the ${M("x")}-axis`, move: ([x, y]) => [x, -y] },
    { label: `Reflect across the ${M("y")}-axis`, move: ([x, y]) => [-x, y] },
    {
      label: `Reflect across the line ${M("y = x")}`,
      move: ([x, y]) => [y, x],
    },
    { label: "Turn a half turn about the origin", move: ([x, y]) => [-x, -y] },
  ];
  const scales: Opt[] = [
    {
      label: `Multiply every ${M("y")}-coordinate by ${s}`,
      move: ([x, y]) => [x, s * y],
    },
    {
      label: `Divide every ${M("y")}-coordinate by ${s}`,
      move: ([x, y]) => [x, y / s],
    },
    {
      label: `Multiply every ${M("x")}-coordinate by ${s}`,
      move: ([x, y]) => [s * x, y],
    },
    {
      label: `Divide every ${M("x")}-coordinate by ${s}`,
      move: ([x, y]) => [x / s, y],
    },
  ];
  let g: string,
    set: Opt[],
    correct: number,
    hint: string,
    sample: [number, number];
  if (kind === "shift-x") {
    const left = r(0, 1) === 1;
    g = `f(${shifted(left ? -c : c)})`;
    set = translations;
    correct = left ? 0 : 1;
    sample = [0, 5];
    hint = `Take a point ${M("(0, 5)")} of ${M("y = f(x)")}. Which ${M("x")} makes the input ${M(shifted(left ? -c : c))} equal 0?`;
  } else if (kind === "shift-y") {
    const up = r(0, 1) === 1;
    g = `f(x)${plus(up ? c : -c)}`;
    set = translations;
    correct = up ? 2 : 3;
    sample = [2, 5];
    hint = `Take a point ${M("(2, 5)")} of ${M("y = f(x)")}. What is the height of ${M(`y = ${g}`)} at ${M("x = 2")}?`;
  } else if (kind === "reflect") {
    const which = r(0, 1);
    g = which === 0 ? "-f(x)" : "f(-x)";
    set = reflections;
    correct = which;
    sample = [2, 5];
    hint =
      which === 0
        ? `Take a point ${M("(2, 5)")} of ${M("y = f(x)")}. What is the height of ${M("y = -f(x)")} at ${M("x = 2")}?`
        : `Take a point ${M("(2, 5)")} of ${M("y = f(x)")}. Which ${M("x")} makes the input ${M("-x")} equal 2?`;
  } else {
    const outside = r(0, 1) === 1;
    g = outside ? `${s}f(x)` : `f(${s}x)`;
    set = scales;
    correct = outside ? 0 : 3;
    sample = [4, 6];
    hint = outside
      ? `Take a point ${M("(4, 6)")} of ${M("y = f(x)")}. What is the height of ${M(`y = ${g}`)} at ${M("x = 4")}?`
      : `Take a point ${M("(4, 6)")} of ${M("y = f(x)")}. Which ${M("x")} makes the input ${M(`${s}x`)} equal 4?`;
  }
  const moved = set[correct]!.move(sample);
  const fmt = (v: number) => tq(rat(Math.round(v * s * 6), s * 6));
  const choices: Choice[] = set.map((o, i) =>
    i === correct
      ? { label: o.label, correct: true }
      : {
          label: o.label,
          feedback: `${kind === "shift-x" || kind === "scale" ? "A change inside the brackets acts on $x$ the opposite way to how it looks. " : ""}Test the point ${M(pt(...sample))}: on ${M(`y = ${g}`)} it goes to ${M(`(${fmt(moved[0])}, ${fmt(moved[1])})`)}, not ${M(`(${fmt(o.move(sample)[0])}, ${fmt(o.move(sample)[1])})`)}.`,
        },
  );
  return {
    prompt: `How does the graph of ${M(`y = ${g}`)} compare with the graph of ${M("y = f(x)")}?`,
    choices,
    explanation: [
      `To see how a graph changes, follow one point. A change outside ${M("f")} acts on heights. A change inside the brackets acts on ${M("x")}, and it works backward.`,
      `The point ${M(pt(...sample))} of ${M("y = f(x)")} goes to ${M(`(${fmt(moved[0])}, ${fmt(moved[1])})`)} on ${M(`y = ${g}`)}.`,
      `Every point of the graph moves this way. So the answer is: ${set[correct]!.label.charAt(0).toLowerCase()}${set[correct]!.label.slice(1)}.`,
    ],
    hint,
    tags: ["describe", kind],
  };
}

// --------------------------------------------------------- transform-point
function transformPoint(r: Random): Case {
  const frame = pick(r, [
    "vertical",
    "horizontal",
    "reflection",
    "symmetry",
  ] as const);
  if (frame === "vertical")
    for (;;) {
      const p = pick(r, ["square", "abs"] as Parent[]);
      const a0 = pick(r, [1, -1]),
        h0 = r(-2, 2),
        k0 = r(-3, 3);
      const x = h0 + r(-2, 2);
      const y = a0 * parentAt(p, x - h0) + k0;
      if (Math.abs(y) > 6) continue;
      const A = pick(r, [2, 3, -1, -2]),
        K = nonzero(r, -5, 5);
      const answer = A * y + K;
      const gTex = `${coef(A)}f(x)${plus(K)}`;
      const w = {
        x: [-6, 6] as [number, number],
        y: [-8, 8] as [number, number],
      };
      const scene = graph({ id: "g", x: w.x, y: w.y, grid: 1, tick: 2 })
        .curve(parentFn(p, a0, h0, k0), { label: "y = f(x)" })
        .scene({ title: "The graph of a function f" });
      const product = A === -1 ? `-${tp(y)}` : `${tn(A)} \\cdot ${tp(y)}`;
      return {
        prompt: `The graph shows ${M("y = f(x)")}. Let ${M(`g(x) = ${gTex}`)}. What is ${M(`g(${tn(x)})`)}?`,
        answer: rat(answer),
        scene,
        explanation: [
          `${M(`g(${tn(x)})`)} uses ${M(`f(${tn(x)})`)}, the height of the graph of ${M("f")} at ${M(`x = ${tn(x)}`)}. So read that first.`,
          `From the graph, ${M(`f(${tn(x)}) = ${tn(y)}`)}.`,
          `Now put it into ${M(`g(x) = ${gTex}`)}: multiply by ${n(A)}, then add ${n(K)}.`,
          `${M(`g(${tn(x)}) = ${product}${plus(K)} = ${tn(answer)}`)}.`,
          `So ${M(`g(${tn(x)}) = ${tn(answer)}`)}.`,
        ],
        hint: `Read ${M(`f(${tn(x)})`)} from the graph first, then substitute it into ${M(`g(x) = ${gTex}`)}.`,
        hintCue: [
          step(
            `Find $x = ${tn(x)}$ on this graph.`,
            act.highlight("g.curve.0"),
          ),
        ],
        tags: ["vertical"],
      };
    }
  const x0 = nonzero(r, -6, 6),
    y0 = nonzero(r, -6, 6);
  const given = `The point ${M(pt(x0, y0))} is on the graph of ${M("y = f(x)")}.`;
  if (frame === "horizontal") {
    const kind = pick(r, ["shift", "shift", "compress", "stretch"] as const);
    let inner: string, p: Rational, solve: string;
    if (kind === "shift") {
      const h = nonzero(r, -5, 5);
      inner = shifted(h);
      p = rat(x0 + h);
      solve = `${M(`${inner} = ${tn(x0)}`)} gives ${M(`x = ${tn(x0)}${plus(h)} = ${tn(x0 + h)}`)}`;
    } else if (kind === "compress") {
      const b = pick(r, [2, 3, 4]);
      inner = `${b}x`;
      p = rat(x0, b);
      solve = `${M(`${b}x = ${tn(x0)}`)} gives ${M(`x = ${tq(p)}`)}`;
    } else {
      const b = pick(r, [2, 3]);
      inner = `\\frac{1}{${b}}x`;
      p = rat(x0 * b);
      solve = `${M(`\\frac{1}{${b}}x = ${tn(x0)}`)} gives ${M(`x = ${b} \\cdot ${tp(x0)} = ${tn(x0 * b)}`)}`;
    }
    return {
      prompt: `${given} The graph of ${M(`y = f(${inner})`)} passes through ${M(`\\left(p, ${tn(y0)}\\right)`)}. What is ${M("p")}?`,
      answer: p,
      explanation: [
        `The given point says ${M(`f(${tn(x0)}) = ${tn(y0)}`)}: when ${M("f")} gets the input ${n(x0)}, it gives ${n(y0)}.`,
        `${M(`y = f(${inner})`)} feeds ${M(inner)} into ${M("f")}. So it has height ${n(y0)} where ${M(inner)} is ${n(x0)}.`,
        `${solve}.`,
        `So ${M(`p = ${tq(p)}`)}.`,
      ],
      hint: `On the new graph the input to ${M("f")} is ${M(inner)}. Find the ${M("x")} that makes ${M(`${inner} = ${tn(x0)}`)}.`,
      tags: ["horizontal", kind],
    };
  }
  if (frame === "reflection") {
    const kind = pick(r, ["-f(x)", "f(-x)", "-f(-x)"] as const);
    const askY = kind === "-f(x)";
    const target: [string, string] =
      kind === "-f(x)"
        ? [tn(x0), "q"]
        : kind === "f(-x)"
          ? ["p", tn(y0)]
          : ["p", tn(-y0)];
    const answer = askY ? rat(-y0) : rat(-x0);
    const unknown = askY ? "q" : "p";
    return {
      prompt: `${given} The graph of ${M(`y = ${kind}`)} passes through ${M(`\\left(${target[0]}, ${target[1]}\\right)`)}. What is ${M(unknown)}?`,
      answer,
      explanation: [
        `The given point says ${M(`f(${tn(x0)}) = ${tn(y0)}`)}: input ${n(x0)} gives output ${n(y0)}.`,
        kind === "-f(x)"
          ? `${M("y = -f(x)")} has the opposite height at every ${M("x")}: a reflection across the ${M("x")}-axis.`
          : kind === "f(-x)"
            ? `${M("y = f(-x)")} has at ${M("x")} the height ${M("f")} has at ${M("-x")}: a reflection across the ${M("y")}-axis.`
            : `${M("y = -f(-x)")} reflects across both axes: ${M(pt(x0, y0))} goes to ${M(pt(-x0, -y0))}.`,
        askY
          ? `At ${M(`x = ${tn(x0)}`)} the height is ${M(`-f(${tn(x0)}) = ${y0 < 0 ? `-${tp(y0)} = ` : ""}${tn(-y0)}`)}.`
          : `The input ${M("-x")} equals ${n(x0)} when ${M(`x = ${tn(-x0)}`)}.`,
        `So ${M(`${unknown} = ${tq(answer)}`)}.`,
      ],
      hint: askY
        ? `At ${M(`x = ${tn(x0)}`)}, ${M("y = -f(x)")} takes the value of ${M(`f(${tn(x0)})`)} and changes its sign.`
        : `On ${M(`y = ${kind}`)} the input to ${M("f")} is ${M("-x")}. Which ${M("x")} makes ${M(`-x = ${tn(x0)}`)}?`,
      tags: ["reflection", kind],
    };
  }
  const even = r(0, 1) === 1;
  const x = Math.abs(x0);
  const sign = r(0, 1) ? 1 : -1;
  const answer = even ? y0 : -y0;
  return {
    prompt: `${M("f")} is an ${even ? "even" : "odd"} function and ${M(`f(${tn(sign * x)}) = ${tn(y0)}`)}. What is ${M(`f(${tn(-sign * x)})`)}?`,
    answer: rat(answer),
    explanation: [
      even
        ? `An even function gives the same output for ${M("x")} and its opposite: ${M("f(-x) = f(x)")}. Its graph is a mirror image across the ${M("y")}-axis.`
        : `An odd function gives opposite outputs for ${M("x")} and its opposite: ${M("f(-x) = -f(x)")}. Its graph looks the same after a half turn about the origin.`,
      `Here ${n(-sign * x)} is the opposite of ${n(sign * x)}, so use that rule.`,
      even
        ? `So ${M(`f(${tn(-sign * x)}) = f(${tn(sign * x)}) = ${tn(y0)}`)}.`
        : `So ${M(`f(${tn(-sign * x)}) = -f(${tn(sign * x)}) = ${y0 < 0 ? `-${tp(y0)} = ` : ""}${tn(-y0)}`)}.`,
    ],
    hint: even
      ? `An even function's graph mirrors in the ${M("y")}-axis: compare ${M(`f(${tn(-sign * x)})`)} with ${M(`f(${tn(sign * x)})`)}.`
      : `An odd function's graph turns a half turn about the origin: compare ${M(`f(${tn(-sign * x)})`)} with ${M(`f(${tn(sign * x)})`)}.`,
    tags: ["symmetry", even ? "even" : "odd"],
  };
}

// ---------------------------------------------------------- composition
type Fx = {
  tex: string;
  at: (x: number) => number;
  sub: (x: number) => string;
  desc?: number[];
};
const linear = (m: number, b: number): Fx => ({
  tex: linTex(m, b),
  at: (x) => m * x + b,
  sub: (x) =>
    `${m === 1 ? tp(x) : m === -1 ? `-${tp(x)}` : `${tn(m)} \\cdot ${tp(x)}`}${plus(b)}`,
  desc: [m, b],
});
const square = (s: number, c: number): Fx => ({
  tex: `${coef(s)}x^2${plus(c)}`,
  at: (x) => s * x * x + c,
  sub: (x) =>
    `${s === 1 ? "" : s === -1 ? "-" : `${tn(s)} \\cdot `}${tp(x)}^2${plus(c)}`,
  desc: [s, 0, c],
});
const absolute = (h: number): Fx => ({
  tex: `|${shifted(h)}|`,
  at: (x) => Math.abs(x - h),
  sub: (x) => `|${tn(x)}${plus(-h)}|`,
});
/** "sub = value", without repeating a value that is already plain. */
const evaluated = (fx: Fx, x: number) => {
  const s = fx.sub(x),
    v = tn(fx.at(x));
  return s === v ? v : `${s} = ${v}`;
};
function randomFx(r: Random, kind: "linear" | "nonlinear"): Fx {
  if (kind === "linear") return linear(pick(r, [-3, -2, -1, 2, 3]), r(-5, 5));
  return pick(r, [0, 1, 2]) === 2
    ? absolute(nonzero(r, -4, 4))
    : square(pick(r, [1, 1, -1, 2]), r(-5, 5));
}
function compositionValue(r: Random): Case {
  const frame = pick(r, ["formula", "table", "graph", "domain"] as const);
  if (frame === "domain")
    for (;;) {
      const num = pick(r, [1, 2, 3, 5]),
        c = nonzero(r, -6, 6),
        m = pick(r, [2, 3, 4, -2, -1]),
        x = r(-5, 5);
      const b = c - m * x;
      if (b === 0 || Math.abs(b) > 14) continue;
      return {
        prompt: `Let ${M(`f(x) = \\frac{${num}}{${shifted(c)}}`)} and ${M(`g(x) = ${linTex(m, b)}`)}. Which value of ${M("x")} is not in the domain of ${M("f(g(x))")}?`,
        answer: rat(x),
        explanation: [
          `${M("f(g(x))")} is a composition: first ${M("g")} acts on ${M("x")}, then ${M("f")} acts on the result. The domain is every ${M("x")} that works the whole way through.`,
          `Dividing by 0 is undefined, so ${M("f")} fails when its denominator, the bottom of the fraction, is 0. That happens at the input ${n(c)}.`,
          `${M("f(g(x))")} is undefined where ${M(`g(x) = ${tn(c)}`)}: ${M(`${linTex(m, b)} = ${tn(c)}`)}, so ${M(`${linTex(m, 0)} = ${tn(c - b)}`)}.`,
          `So ${M(`x = ${tn(x)}`)} is not in the domain of ${M("f(g(x))")}.`,
        ],
        hint: `${M("f")} is undefined when its input is ${n(c)}. Find the ${M("x")} that makes ${M(`g(x) = ${tn(c)}`)}.`,
        tags: ["domain"],
      };
    }
  const fOuter = r(0, 1) === 1;
  const [inner, outer] = fOuter ? ["g", "f"] : ["f", "g"];
  const expr = r(0, 1)
    ? `${outer}(${inner}(A))`
    : `(${outer} \\circ ${inner})(A)`;
  if (frame === "table")
    for (;;) {
      const start = r(-2, 1);
      const xs = [0, 1, 2, 3, 4].map((i) => start + i);
      const vals: Record<string, number[]> = {
        f: xs.map(() => r(-4, 8)),
        g: xs.map(() => r(-4, 8)),
      };
      const j = r(0, 4),
        a = xs[j]!;
      const mid = vals[inner]![j]!;
      const k = xs.indexOf(mid);
      if (k < 0) continue;
      const answer = vals[outer]![k]!;
      if (answer === vals[outer]![j] || answer === mid) continue;
      const row = inner === "f" ? 1 : 2;
      const e = expr.replace("A", tn(a));
      return {
        prompt: `The table gives values of ${M("f")} and ${M("g")}. What is ${M(e)}?`,
        answer: rat(answer),
        scene: valueTable([
          ["x", ...xs],
          ["f(x)", ...vals.f!],
          ["g(x)", ...vals.g!],
        ]),
        explanation: [
          `${M(e)} is a composition: apply ${M(inner)} first, then feed its output into ${M(outer)}. Work from the inside out.`,
          `From the table, ${M(`${inner}(${tn(a)}) = ${tn(mid)}`)}.`,
          `Then ${M(`${outer}(${tn(mid)}) = ${tn(answer)}`)}, from the column ${M(`x = ${tn(mid)}`)}.`,
          `So ${M(`${e} = ${tn(answer)}`)}.`,
        ],
        hint: `Find ${M(`${inner}(${tn(a)})`)} in the table first, then look up ${M(outer)} at that value of ${M("x")}.`,
        hintCue: [
          step(
            `Start here: $${inner}(${tn(a)})$.`,
            act.highlight(`t.cell.0.${j + 1}`),
            act.highlight(`t.cell.${row}.${j + 1}`),
          ),
        ],
        tags: ["table", `${outer}-of-${inner}`],
      };
    }
  if (frame === "graph")
    for (;;) {
      const lin = { m: pick(r, [-2, -1, 1, 2]), b: r(-3, 3) };
      const bent = { s: pick(r, [1, -1]), h: r(-2, 2), k: r(-3, 3) };
      const fns: Record<string, (x: number) => number> = {};
      const fnSpec: Record<string, Fn> = {};
      // f is the line and g the V, or the other way round.
      const fLine = r(0, 1) === 1;
      const line = (x: number) => lin.m * x + lin.b,
        vee = (x: number) => bent.s * Math.abs(x - bent.h) + bent.k;
      fns.f = fLine ? line : vee;
      fns.g = fLine ? vee : line;
      fnSpec.f = fLine ? f.poly(lin.m, lin.b) : f.abs(bent.s, bent.h, bent.k);
      fnSpec.g = fLine ? f.abs(bent.s, bent.h, bent.k) : f.poly(lin.m, lin.b);
      const a = r(-4, 4);
      const mid = fns[inner]!(a);
      const answer = fns[outer]!(mid);
      if (Math.abs(mid) > 5 || Math.abs(answer) > 6) continue;
      if (answer === fns[inner]!(fns[outer]!(a)) || answer === mid) continue;
      const e = expr.replace("A", tn(a));
      const index = inner === "f" ? 0 : 1;
      const scene = graph({ id: "g", x: [-6, 6], y: [-7, 7], grid: 1, tick: 2 })
        .curve(fnSpec.f!, { label: "y = f(x)" })
        .curve(fnSpec.g!, { label: "y = g(x)", color: "warm" })
        .scene({ title: "The graphs of two functions f and g" });
      return {
        prompt: `The graphs show ${M("y = f(x)")} and ${M("y = g(x)")}. What is ${M(e)}?`,
        answer: rat(answer),
        scene,
        explanation: [
          `${M(e)} is a composition: apply ${M(inner)} first, then feed its output into ${M(outer)}. Work from the inside out.`,
          `The graph of ${M(inner)} passes through ${M(pt(a, mid))}, so ${M(`${inner}(${tn(a)}) = ${tn(mid)}`)}.`,
          `The graph of ${M(outer)} passes through ${M(pt(mid, answer))}, so ${M(`${outer}(${tn(mid)}) = ${tn(answer)}`)}.`,
          `So ${M(`${e} = ${tn(answer)}`)}.`,
        ],
        hint: `Read ${M(`${inner}(${tn(a)})`)} from the graph of ${M(inner)} first; then find ${M(outer)} at that ${M("x")}-value.`,
        hintCue: [
          step(
            `Start on the graph of $${inner}$.`,
            act.highlight(`g.curve.${index}`),
          ),
        ],
        tags: ["graph", `${outer}-of-${inner}`],
      };
    }
  for (;;) {
    const lin = randomFx(r, "linear"),
      bent = randomFx(r, "nonlinear");
    const linIsF = r(0, 1) === 1;
    const fx = linIsF ? lin : bent,
      gx = linIsF ? bent : lin;
    const by: Record<string, Fx> = { f: fx, g: gx };
    const a = r(-3, 3);
    const mid = by[inner]!.at(a);
    const answer = by[outer]!.at(mid);
    if (
      Math.abs(answer) > 99 ||
      answer === mid ||
      answer === by[inner]!.at(by[outer]!.at(a))
    )
      continue;
    const e = expr.replace("A", tn(a));
    const values: [string, string, string] = [tn(a), tn(mid), tn(answer)];
    const machine = (walk: boolean) =>
      machineScene(
        { name: inner, rule: `${inner}(x) = ${by[inner]!.tex}` },
        { name: outer, rule: `${outer}(x) = ${by[outer]!.tex}` },
        walk ? values : [tn(a), null, null],
        walk,
      );
    return {
      prompt: `Let ${M(`f(x) = ${fx.tex}`)} and ${M(`g(x) = ${gx.tex}`)}. What is ${M(e)}?`,
      answer: rat(answer),
      scene: machine(false),
      explanation: [
        `${M(e)} is a composition: apply ${M(inner)} first, then feed its output into ${M(outer)}. Like nested brackets, work from the inside out.`,
        `Inside first: ${M(`${inner}(${tn(a)}) = ${evaluated(by[inner]!, a)}`)}.`,
        `That output, ${n(mid)}, is the input to ${M(outer)}: ${M(`${outer}(${tn(mid)}) = ${evaluated(by[outer]!, mid)}`)}.`,
        `So ${M(`${e} = ${tn(answer)}`)}.`,
      ],
      hint: `Work from the inside out: find ${M(`${inner}(${tn(a)})`)} first, then use that value as the input of ${M(outer)}.`,
      hintCue: [
        step(
          `The input $${tn(a)}$ goes into $${inner}$ first.`,
          act.highlight("in"),
          act.highlight("inner"),
        ),
      ],
      walkthrough: machine(true),
      tags: ["formula", `${outer}-of-${inner}`],
    };
  }
}

// ------------------------------------------------------ composition-expression
/** Polynomials as coefficient arrays, highest power first. */
const padTo = (p: number[], len: number) => [
  ...Array(Math.max(0, len - p.length)).fill(0),
  ...p,
];
const polyAdd = (p: number[], q: number[]) => {
  const len = Math.max(p.length, q.length);
  const a = padTo(p, len),
    b = padTo(q, len);
  return trimLead(a.map((v, i) => v + b[i]!));
};
const polyMul = (p: number[], q: number[]) => {
  const out = Array(p.length + q.length - 1).fill(0);
  p.forEach((a, i) => q.forEach((b, j) => (out[i + j] += a * b)));
  return trimLead(out);
};
const trimLead = (p: number[]) => {
  const out = [...p];
  while (out.length > 1 && out[0] === 0) out.shift();
  return out;
};
/** p(q(x)) for coefficient arrays. */
const polyCompose = (p: number[], q: number[]) =>
  p.reduce((acc, c) => polyAdd(polyMul(acc, q), [c]), [0] as number[]);
const polyKey = (p: number[]) => trimLead(p).join(",");

function compositionExpression(r: Random): Case {
  const frame = pick(r, ["f-of-g", "g-of-f", "decompose"] as const);
  if (frame === "decompose") return decompose(r);
  for (;;) {
    const fm = pick(r, [2, 3, -2, 4, -1]),
      fb = nonzero(r, -5, 5);
    const F = [fm, fb];
    const G = r(0, 2)
      ? [1, 0, nonzero(r, -5, 5)]
      : [pick(r, [2, 3, -3]), nonzero(r, -5, 5)];
    const fg = polyCompose(F, G),
      gf = polyCompose(G, F);
    const correct = frame === "f-of-g" ? fg : gf;
    const other = frame === "f-of-g" ? gf : fg;
    const outerName = frame === "f-of-g" ? "f" : "g";
    const wrong = [
      {
        p: other,
        feedback: `This composes in the wrong order: it is ${M(frame === "f-of-g" ? "g(f(x))" : "f(g(x))")}. The inner function is the one written inside the brackets.`,
      },
      {
        p: polyMul(F, G),
        feedback: `This multiplies the two functions: ${M("f(x)g(x)")}. A composition puts one function inside the other instead.`,
      },
      {
        p: polyAdd(F, G),
        feedback: `This adds the two functions: ${M("f(x) + g(x)")}. A composition puts one function inside the other instead.`,
      },
      frame === "f-of-g"
        ? {
            // m·g(x) + b with only g's leading part multiplied by m.
            p: polyAdd(polyMul([fm], [...G.slice(0, -1), 0]), [G.at(-1)! + fb]),
            feedback: `This multiplies only the first term of ${M("g(x)")} by ${n(fm)}. Distribute to every term, the constant included.`,
          }
        : G.length === 3
          ? {
              // (mx + b)² + c with the square taken term by term.
              p: [fm * fm, 0, fb * fb + G[2]!],
              feedback: `This squares each term separately. Square the whole of ${M(`(${polyTex(F)})`)}: the square of a sum has a middle term.`,
            }
          : {
              // p(mx + b) + q with only mx multiplied by p.
              p: [G[0]! * fm, fb + G[1]!],
              feedback: `This multiplies only the first term of ${M("f(x)")} by ${n(G[0]!)}. Distribute to every term, the constant included.`,
            },
    ];
    const seen = new Set([polyKey(correct)]);
    const picked: Choice[] = [];
    for (const w of wrong)
      if (!seen.has(polyKey(w.p)) && picked.length < 3) {
        seen.add(polyKey(w.p));
        picked.push({ label: M(polyTex(w.p)), feedback: w.feedback });
      }
    if (picked.length < 3) continue;
    const Ftex = polyTex(F),
      Gtex = polyTex(G);
    const innerTex = frame === "f-of-g" ? Gtex : Ftex;
    const outerP = frame === "f-of-g" ? F : G;
    const substituted =
      outerP.length === 2
        ? `${coef(outerP[0]!)}(${innerTex})${plus(outerP[1]!)}`
        : `(${innerTex})^2${plus(outerP[2]!)}`;
    const name = frame === "f-of-g" ? "f(g(x))" : "g(f(x))";
    return {
      prompt: `Let ${M(`f(x) = ${Ftex}`)} and ${M(`g(x) = ${Gtex}`)}. Which expression equals ${M(name)}?`,
      choices: [{ label: M(polyTex(correct)), correct: true }, ...picked],
      explanation: [
        `${M(name)} is a composition: the inner function's output becomes the outer function's input.`,
        `So replace every ${M("x")} in ${M(`${outerName}(x)`)} with the whole of ${M(`${frame === "f-of-g" ? "g" : "f"}(x) = ${innerTex}`)}, in brackets.`,
        `Then multiply out and combine like terms: ${M(`${name} = ${substituted} = ${polyTex(correct)}`)}.`,
        `So ${M(`${name} = ${polyTex(correct)}`)}.`,
      ],
      hint: `Replace ${M("x")} in ${M(`${outerName}(x) = ${polyTex(outerP)}`)} with the whole expression ${M(`(${innerTex})`)}, then simplify.`,
      tags: [frame, G.length === 3 ? "quadratic" : "linear"],
    };
  }
}
/** "4 is added" or "3 is subtracted"; active: "adds 4", "subtracts 3". */
const addWords = (c: number, active = false) =>
  active
    ? `${c > 0 ? "adds" : "subtracts"} ${Math.abs(c)}`
    : `${Math.abs(c)} is ${c > 0 ? "added" : "subtracted"}`;
function decompose(r: Random): Case {
  for (;;) {
    const p = pick(r, [2, 3, 4, -2]),
      q = nonzero(r, -5, 5),
      c = nonzero(r, -6, 6);
    const inner = linTex(p, q);
    const h = `(${inner})^2${plus(c)}`;
    const findOuter = r(0, 1) === 1;
    if (findOuter) {
      const choices = options(M(`x^2${plus(c)}`), [
        {
          label: M(h),
          feedback: `This is ${M("h(x)")} itself. ${M("f")} acts on the output of ${M("g")}, so it does only the outer steps.`,
        },
        {
          label: M(`${tn(p)}x^2${plus(c)}`),
          feedback: `This moves part of ${M("g")} into ${M("f")}. Then ${M("f(g(x))")} would be ${M(`${tn(p)}(${inner})^2${plus(c)}`)}, not ${M("h(x)")}.`,
        },
        {
          label: M(`x^2${plus(q + c)}`),
          feedback: `This takes ${n(q)} out of the square. ${n(q)} is inside the square, as part of ${M("g(x)")}.`,
        },
        {
          label: M(`(${shifted(-q)})^2${plus(c)}`),
          feedback: `This repeats part of ${M("g")}. ${M("g")} already supplies ${M(inner)}; ${M("f")} only squares and then ${addWords(c, true)}.`,
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `${M(`h(x) = ${h}`)} can be written as ${M("h(x) = f(g(x))")} with ${M(`g(x) = ${inner}`)}. Which is ${M("f(x)")}?`,
        choices,
        explanation: [
          `${M("h(x) = f(g(x))")} means ${M("g")} acts first and ${M("f")} acts on its output. So ${M("g")} is the inside step and ${M("f")} is the outside steps.`,
          `In ${M(`h(x) = ${h}`)}, the quantity ${M(inner)} is squared, and then ${addWords(c)}.`,
          `${M(`g(x) = ${inner}`)} is that quantity, so ${M("f")} squares its input and then ${addWords(c, true)}.`,
          `So ${M(`f(x) = x^2${plus(c)}`)}.`,
        ],
        hint: `${M(`g(x) = ${inner}`)} is the inside of ${M("h")}. What does ${M("h")} do to that quantity?`,
        tags: ["decompose", "outer"],
      };
    }
    const choices = options(M(inner), [
      {
        label: M(`(${inner})^2`),
        feedback: `This squares twice. ${M("f")} already squares, so ${M("g")} is only the quantity being squared.`,
      },
      {
        label: M(shifted(-q)),
        feedback: `This drops the coefficient of ${M("x")}, the number multiplying it. ${M(`h`)} squares ${M(inner)}.`,
      },
      {
        label: M(linTex(p, 0)),
        feedback: `This leaves out the constant. ${n(q)} is inside the square too.`,
      },
      {
        label: M(linTex(p, -q)),
        feedback: `This has a sign error: check the sign of the constant inside the square.`,
      },
    ]);
    if (!choices) continue;
    return {
      prompt: `${M(`h(x) = ${h}`)} can be written as ${M("h(x) = f(g(x))")} with ${M(`f(x) = x^2${plus(c)}`)}. Which is ${M("g(x)")}?`,
      choices,
      explanation: [
        `${M("h(x) = f(g(x))")} means ${M("g")} acts first and ${M("f")} acts on its output. So ${M("g(x)")} is whatever ${M("f")} receives.`,
        `${M(`f(x) = x^2${plus(c)}`)} squares its input and then ${addWords(c, true)}.`,
        `In ${M(`h(x) = ${h}`)}, the input being squared is ${M(inner)}.`,
        `So ${M(`g(x) = ${inner}`)}.`,
      ],
      hint: `${M(`f(x) = x^2${plus(c)}`)} squares its input and then ${addWords(c, true)}. Which quantity does ${M("h")} square?`,
      tags: ["decompose", "inner"],
    };
  }
}

// ------------------------------------------------------------ inverse-value
const squareWindow = (...vals: number[]) => {
  const lo = Math.min(-1, ...vals) - 1,
    hi = Math.max(1, ...vals) + 1;
  return [lo, hi] as [number, number];
};
function inverseValue(r: Random): Case {
  const frame = pick(r, ["formula", "table", "graph"] as const);
  if (frame === "table")
    for (;;) {
      const start = r(-2, 1);
      const xs = [0, 1, 2, 3, 4].map((i) => start + i);
      const rising = r(0, 1) === 1;
      const ys: number[] = [];
      let v = r(-6, 2);
      for (let i = 0; i < 5; i++) {
        ys.push(v);
        v += r(1, 4);
      }
      if (!rising) ys.reverse();
      const j = r(0, 4);
      const x = xs[j]!,
        y = ys[j]!;
      // The learner must read the table backwards: the asked value is not
      // the x of the same column read forwards.
      if (xs.includes(y) && ys[xs.indexOf(y)] === x) continue;
      const pts = xs.map((u, i) => [u, ys[i]!] as [number, number]);
      const lim = Math.max(...pts.flat().map(Math.abs));
      return {
        prompt: `The table shows values of the one-to-one function ${M("f")}. What is ${M(`f^{-1}(${tn(y)})`)}?`,
        answer: rat(x),
        scene: valueTable([
          ["x", ...xs],
          ["f(x)", ...ys],
        ]),
        explanation: [
          `${M(`f^{-1}(${tn(y)})`)} is the input that ${M("f")} sends to ${n(y)}.`,
          `The table has ${M(`f(${tn(x)}) = ${tn(y)}`)}, so ${M(`f^{-1}(${tn(y)}) = ${tn(x)}`)}.`,
        ],
        hint: `Find ${n(y)} in the ${M("f(x)")} row, then read the ${M("x")} above it.`,
        hintCue: [
          step("Search this row for the output.", act.highlight("t.cell.1")),
        ],
        ...(lim <= 9
          ? {
              walkthrough: reflectPointsScene(pts, squareWindow(...pts.flat())),
            }
          : {}),
        tags: ["table", rising ? "increasing" : "decreasing"],
      };
    }
  if (frame === "graph")
    for (;;) {
      const kind = pick(r, ["line", "line", "sqrt", "exp"] as const);
      let fn: Fn,
        inv: Fn,
        at: (x: number) => number,
        x: number,
        fDom: [number, number],
        iDom: [number, number];
      if (kind === "line") {
        const m = pick(r, [1, 2, -1, -2, 3]),
          b = r(-3, 3);
        fn = f.poly(m, b);
        inv = f.poly(1 / m, -b / m);
        at = (u) => m * u + b;
        x = r(-3, 3);
        fDom = [-6, 6];
        iDom = [-6, 6];
      } else if (kind === "sqrt") {
        const h = r(-4, 0),
          k = r(-3, 1);
        fn = f.sqrt(1, h, k);
        inv = f.vertex(1, k, h);
        at = (u) => Math.sqrt(u - h) + k;
        x = h + pick(r, [1, 4, 9]);
        fDom = [h, h + 9];
        iDom = [k, k + 3];
      } else {
        const c = r(-3, 1);
        fn = f.exp(1, 2, { k: c });
        inv = f.log(1, 2, { h: c });
        at = (u) => 2 ** u + c;
        x = r(-1, 2);
        fDom = [-6, 3];
        iDom = [c + 0.02, 8 + c];
      }
      const y = at(x);
      // x = 0 would only read the y-intercept back.
      if (
        !Number.isInteger(y) ||
        Math.abs(y) > 6 ||
        Math.abs(x) > 6 ||
        x === y ||
        x === 0
      )
        continue;
      const window: [number, number] = [-7, 7];
      const scene = graph({ id: "g", x: window, y: window, grid: 1, tick: 2 })
        .curve(fn, {
          domain: fDom,
          ends: kind === "sqrt" ? ["closed", "arrow"] : ["arrow", "arrow"],
          label: "y = f(x)",
        })
        .scene({ title: "The graph of a one-to-one function f" });
      return {
        prompt: `The graph shows the one-to-one function ${M("y = f(x)")}. What is ${M(`f^{-1}(${tn(y)})`)}?`,
        answer: rat(x),
        scene,
        explanation: [
          `${M(`f^{-1}(${tn(y)})`)} is the input whose output is ${n(y)}.`,
          `The graph passes through ${M(pt(x, y))}, so ${M(`f(${tn(x)}) = ${tn(y)}`)} and ${M(`f^{-1}(${tn(y)}) = ${tn(x)}`)}.`,
        ],
        hint: `Go across from ${n(y)} on the ${M("y")}-axis to the graph, then straight down or up to the ${M("x")}-axis.`,
        hintCue: [
          step(
            `Find the height $${tn(y)}$ on this graph.`,
            act.highlight("g.curve.0"),
          ),
        ],
        walkthrough: reflectionScene(fn, fDom, inv, iDom, [x, y], window, [
          "y = f(x)",
          "y = f^{-1}(x)",
        ]),
        tags: ["graph", kind],
      };
    }
  for (;;) {
    const kind = pick(r, ["linear", "linear", "fraction", "exp"] as const);
    let F: string,
      x: number,
      y: number,
      solve: string,
      fn: Fn | null = null,
      inv: Fn | null = null,
      shift = 0;
    if (kind === "linear") {
      const m = pick(r, [2, 3, 4, 5, -2, -3]),
        b = nonzero(r, -9, 9);
      x = r(-6, 6);
      y = m * x + b;
      F = linTex(m, b);
      solve = `${M(`${F} = ${tn(y)}`)}, so ${M(`${linTex(m, 0)} = ${tn(y - b)}`)} and ${M(`x = ${tn(x)}`)}`;
      fn = f.poly(m, b);
      inv = f.poly(1 / m, -b / m);
    } else if (kind === "fraction") {
      const p = pick(r, [2, 3, 4]),
        q = nonzero(r, -6, 6);
      y = r(-5, 5);
      x = p * y - q;
      F = `\\frac{${shifted(-q)}}{${p}}`;
      solve = `${M(`${F} = ${tn(y)}`)}, so ${M(`${shifted(-q)} = ${tn(p * y)}`)} and ${M(`x = ${tn(x)}`)}`;
    } else {
      const c = r(-5, 5);
      x = r(0, 5);
      y = 2 ** x + c;
      F = `2^x${plus(c)}`;
      solve = `${M(`${F} = ${tn(y)}`)}, so ${M(`2^x = ${tn(y - c)}`)} and ${M(`x = ${tn(x)}`)}`;
      fn = f.exp(1, 2, { k: c });
      inv = f.log(1, 2, { h: c });
      shift = c;
    }
    if (x === y || x === 0) continue;
    const lim = Math.max(Math.abs(x), Math.abs(y));
    const window: [number, number] = [
      -Math.max(6, lim + 1),
      Math.max(6, lim + 1),
    ];
    const walk =
      fn && inv && lim <= 8
        ? reflectionScene(
            fn,
            kind === "exp" ? [window[0], Math.log2(window[1] - shift)] : window,
            inv,
            kind === "exp" ? [shift + 0.02, window[1]] : window,
            [x, y],
            window,
            ["y = f(x)", "y = f^{-1}(x)"],
          )
        : undefined;
    return {
      prompt: `Let ${M(`f(x) = ${F}`)}. What is ${M(`f^{-1}(${tn(y)})`)}?`,
      answer: rat(x),
      explanation: [
        `${M(`f^{-1}(${tn(y)})`)} is the ${M("x")} with ${M(`f(x) = ${tn(y)}`)}.`,
        `${solve}.`,
        `So ${M(`f^{-1}(${tn(y)}) = ${tn(x)}`)}. Check: ${M(`f(${tn(x)}) = ${tn(y)}`)}.`,
      ],
      hint: `${M(`f^{-1}(${tn(y)})`)} is the input that ${M("f")} sends to ${n(y)}: solve ${M(`${F} = ${tn(y)}`)}.`,
      ...(walk ? { walkthrough: walk } : {}),
      tags: ["formula", kind],
    };
  }
}

// ------------------------------------------------------- inverse-expression
function inverseExpression(r: Random): Case {
  const frame = pick(r, ["linear", "restricted", "point", "domain"] as const);
  if (frame === "linear")
    for (;;) {
      const direct = r(0, 1) === 1;
      const p = pick(r, [2, 3, 4, 5]),
        q = nonzero(r, -9, 9);
      // f(x) = px + q, or f(x) = (x + q)/p.
      const F = direct ? linTex(p, q) : `\\frac{${shifted(-q)}}{${p}}`;
      const fAt = (x: number) => (direct ? p * x + q : (x + q) / p);
      type E = { tex: string; at: (x: number) => number };
      const correct: E = direct
        ? { tex: `\\frac{${shifted(q)}}{${p}}`, at: (x) => (x - q) / p }
        : { tex: linTex(p, -q), at: (x) => p * x - q };
      const wrong: (E & { feedback: string })[] = direct
        ? [
            {
              tex: `\\frac{${shifted(-q)}}{${p}}`,
              at: (x) => (x + q) / p,
              feedback: `Undo ${M(plus(q).trim())} by doing the opposite.`,
            },
            {
              tex: `\\frac{x}{${p}}${plus(-q)}`,
              at: (x) => x / p - q,
              feedback: `Undo the steps in reverse order: first undo the ${M(plus(q).trim())}, then divide by ${p}.`,
            },
            {
              tex: linTex(p, -q),
              at: (x) => p * x - q,
              feedback: `Multiplying by ${p} is undone by dividing by ${p}.`,
            },
            {
              tex: `\\frac{1}{${F}}`,
              at: (x) => 1 / (p * x + q),
              feedback: `${M("f^{-1}")} undoes ${M("f")}; it is not the reciprocal ${M("\\frac{1}{f(x)}")}.`,
            },
          ]
        : [
            {
              tex: linTex(p, q),
              at: (x) => p * x + q,
              feedback: `Undo ${M(plus(q).trim())} by doing the opposite.`,
            },
            {
              tex: `\\frac{${shifted(q)}}{${p}}`,
              at: (x) => (x - q) / p,
              feedback: `Dividing by ${p} is undone by multiplying by ${p}.`,
            },
            {
              tex: `${p}(${shifted(q)})`,
              at: (x) => p * (x - q),
              feedback: `Undo the steps in reverse order: first multiply by ${p}, then undo the ${M(plus(q).trim())}.`,
            },
            {
              tex: `\\frac{${p}}{${shifted(-q)}}`,
              at: (x) => p / (x + q),
              feedback: `${M("f^{-1}")} undoes ${M("f")}; it is not the reciprocal ${M("\\frac{1}{f(x)}")}.`,
            },
          ];
      const kept = distinctBy(correct, wrong, (e) =>
        [0.5, 1.5, 2.5, 7].map(e.at),
      );
      const choices = options(
        M(correct.tex),
        kept.map((w) => ({ label: M(w.tex), feedback: w.feedback })),
      );
      if (!choices) continue;
      const swapped = direct
        ? `x = ${linTex(p, q, "y")}`
        : `x = \\frac{${shifted(-q, "y")}}{${p}}`;
      const solved = direct
        ? `${linTex(p, 0, "y")} = ${shifted(q)}`
        : `${p}x = ${shifted(-q, "y")}`;
      void fAt;
      return {
        prompt: `Let ${M(`f(x) = ${F}`)}. Which expression is ${M("f^{-1}(x)")}?`,
        choices,
        explanation: [
          `Write ${M(`y = ${F}`)} and swap ${M("x")} and ${M("y")}: ${M(swapped)}.`,
          `Solve for ${M("y")}: ${M(solved)}, so ${M(`y = ${correct.tex}`)}.`,
          `So ${M(`f^{-1}(x) = ${correct.tex}`)}.`,
        ],
        hint: `Write ${M(`y = ${F}`)}, swap ${M("x")} and ${M("y")}, and solve for ${M("y")}.`,
        tags: ["linear", direct ? "multiply-add" : "add-divide"],
      };
    }
  if (frame === "restricted")
    for (;;) {
      const h = nonzero(r, -5, 5),
        k = nonzero(r, -5, 5);
      if (Math.abs(h) === Math.abs(k)) continue;
      const right = r(0, 1) === 1;
      const F = `(${shifted(h)})^2${plus(k)}`;
      const dom = right ? `x \\ge ${tn(h)}` : `x \\le ${tn(h)}`;
      const root = (sign: number, inner: number, add: number) =>
        `${sign < 0 ? "-" : ""}\\sqrt{${shifted(inner)}}${plus(add)}`;
      const correct = root(right ? 1 : -1, k, h);
      const choices = options(M(correct), [
        {
          label: M(root(right ? -1 : 1, k, h)),
          feedback: `The inverse's outputs are the inputs of ${M("f")}, so they satisfy ${M(dom.replace("x", "y"))}.`,
        },
        {
          label: M(root(right ? 1 : -1, h, k)),
          feedback: `After swapping, ${M("x")} pairs with ${n(k)} and ${M("y")} with ${n(h)}.`,
        },
        {
          label: M(root(right ? 1 : -1, -k, -h)),
          feedback: `Undo each step of ${M("f")} with its opposite, in reverse order.`,
        },
        {
          label: M(`\\sqrt{x}${plus(h - k)}`),
          feedback: `Undo the ${M(plus(k).trim())} before taking the square root.`,
        },
      ]);
      if (!choices) continue;
      const lo = Math.min(h - 2, k) - 1,
        hi = Math.max(h + 2, k + 4) + 1;
      const window: [number, number] = [Math.min(lo, -1), Math.max(hi, 1)];
      const px = right ? h + 1 : h - 1;
      return {
        prompt: `The function ${M(`f(x) = ${F}`)} with domain ${M(dom)} is one-to-one. Which expression is ${M("f^{-1}(x)")}?`,
        choices,
        explanation: [
          `Swap ${M("x")} and ${M("y")}: ${M(`x = (${shifted(h, "y")})^2${plus(k)}`)}, so ${M(`(${shifted(h, "y")})^2 = ${shifted(k)}`)}.`,
          `Then ${M(`${shifted(h, "y")} = \\pm\\sqrt{${shifted(k)}}`)}. The outputs of ${M("f^{-1}")} are the inputs of ${M("f")}, so ${M(dom.replace("x", "y"))}: take the ${right ? "positive" : "negative"} root.`,
          `So ${M(`f^{-1}(x) = ${correct}`)}.`,
        ],
        hint: `Swap ${M("x")} and ${M("y")} in ${M(`y = ${F}`)} and solve for ${M("y")}; keep the root whose values satisfy ${M(dom.replace("x", "y"))}.`,
        walkthrough: reflectionScene(
          f.vertex(1, h, k),
          right ? [h, h + 2] : [h - 2, h],
          f.sqrt(right ? 1 : -1, k, h),
          [k, k + 4],
          [px, k + 1],
          window,
          ["y = f(x)", "y = f^{-1}(x)"],
        ),
        tags: ["restricted", right ? "right-half" : "left-half"],
      };
    }
  if (frame === "point")
    for (;;) {
      const x0 = nonzero(r, -6, 6),
        y0 = nonzero(r, -6, 6);
      if (Math.abs(x0) === Math.abs(y0) || Math.abs(y0) < 2) continue;
      const recip = `${y0 < 0 ? "-" : ""}\\frac{1}{${Math.abs(y0)}}`;
      const choices = options(
        M(pt(y0, x0)),
        [
          {
            label: M(pt(-x0, -y0)),
            feedback:
              "The inverse swaps the coordinates; it does not change their signs.",
          },
          {
            label: M(`(${tn(x0)}, ${recip})`),
            feedback: `${M("f^{-1}")} undoes ${M("f")}; it is not the reciprocal of ${M("f")}.`,
          },
          {
            label: M(pt(-y0, -x0)),
            feedback: `Swap the coordinates without changing their signs: the mirror is the line ${M("y = x")}.`,
          },
        ].concat([
          {
            label: M(pt(x0, -y0)),
            feedback: "The inverse swaps the coordinates.",
          },
        ]),
      );
      if (!choices) continue;
      const lim = Math.max(Math.abs(x0), Math.abs(y0)) + 1;
      return {
        prompt: `The graph of ${M("y = f(x)")} passes through ${M(pt(x0, y0))}, and ${M("f")} has an inverse. Which point is on the graph of ${M("y = f^{-1}(x)")}?`,
        choices,
        explanation: [
          `${M(pt(x0, y0))} on the graph of ${M("f")} means ${M(`f(${tn(x0)}) = ${tn(y0)}`)}.`,
          `The inverse sends ${n(y0)} back: ${M(`f^{-1}(${tn(y0)}) = ${tn(x0)}`)}, so ${M(pt(y0, x0))} is on the graph of ${M("f^{-1}")}, the mirror image in ${M("y = x")}.`,
        ],
        hint: `The inverse undoes ${M("f")}: if ${M("f")} sends ${n(x0)} to ${n(y0)}, where does ${M("f^{-1}")} send ${n(y0)}?`,
        walkthrough: reflectPointsScene([[x0, y0]], [-lim, lim]),
        tags: ["point"],
      };
    }
  for (;;) {
    const h = nonzero(r, -5, 5),
      k = r(-4, 4);
    const right = r(0, 1) === 1;
    const F = `(${shifted(h)})^2${plus(k)}`;
    const correct = right ? `x \\ge ${tn(h)}` : `x \\le ${tn(h)}`;
    const d = r(1, 3);
    const wrong: Choice[] = [
      {
        label: M(`x \\ge ${tn(h - d)}`),
        feedback: `That domain includes ${M(`x = ${tn(h - d)}`)} and ${M(`x = ${tn(h + d)}`)}, which give the same output.`,
      },
      {
        label: M(`x \\le ${tn(h + d)}`),
        feedback: `That domain includes ${M(`x = ${tn(h - d)}`)} and ${M(`x = ${tn(h + d)}`)}, which give the same output.`,
      },
      {
        label: "All real numbers",
        feedback: `${M(`f(${tn(h - 1)}) = f(${tn(h + 1)})`)}: two inputs share an output.`,
      },
      ...(-h < h
        ? [
            {
              label: M(`x \\ge ${tn(-h)}`),
              feedback: `The turn is at ${M(`x = ${tn(h)}`)}, where ${M(shifted(h))} is 0.`,
            },
          ]
        : [
            {
              label: M(`x \\le ${tn(-h)}`),
              feedback: `The turn is at ${M(`x = ${tn(h)}`)}, where ${M(shifted(h))} is 0.`,
            },
          ]),
    ];
    const pickWrong = [wrong[r(0, 1)]!, wrong[2]!, wrong[3]!];
    const choices = options(M(correct), pickWrong);
    if (!choices) continue;
    return {
      prompt: `The function ${M(`f(x) = ${F}`)} is not one-to-one. On which domain does it have an inverse function?`,
      choices,
      explanation: [
        `The graph of ${M("f")} is a parabola with its vertex at ${M(`x = ${tn(h)}`)}: it falls on one side of the vertex and rises on the other.`,
        `Inputs the same distance either side of ${M(`x = ${tn(h)}`)} give the same output, so a domain on both sides is not one-to-one.`,
        `On ${M(correct)} the graph only ${right ? "rises" : "falls"}, so each output comes from one input: ${M(correct)}.`,
      ],
      hint: `${M("f")} turns at its vertex, where ${M(`${shifted(h)} = 0`)}. An inverse needs a domain that stays on one side of that turn.`,
      tags: ["domain", right ? "right-half" : "left-half"],
    };
  }
}

// --------------------------------------------------- compare-representations
type Feature = "maximum" | "minimum" | "intercept" | "rate";
const featureText: Record<Feature, string> = {
  maximum: "maximum value",
  minimum: "minimum value",
  intercept: `${M("y")}-intercept`,
  rate: `average rate of change from ${M("x = 0")} to ${M("x = 2")}`,
};
function compareRepresentations(r: Random): Case {
  for (;;) {
    const feature = pick(r, [
      "maximum",
      "minimum",
      "intercept",
      "rate",
    ] as const);
    const rep = pick(r, ["graph", "table"] as const);
    // f, from its formula.
    let fDesc: number[] | null = null,
      fTex: string,
      fAt: (x: number) => number,
      fValue: Rational,
      fWork: string;
    // g, from a graph or a table: a quadratic or a line on integer points.
    const quadG =
      feature === "maximum" || feature === "minimum" || r(0, 1) === 1;
    const sign = feature === "maximum" ? -1 : 1;
    if (feature === "maximum" || feature === "minimum") {
      const a = sign * pick(r, [1, 2]),
        h = r(-3, 3),
        k = r(-5, 6);
      fDesc = [a, -2 * a * h, a * h * h + k];
      const vertexForm = r(0, 1) === 1;
      fTex = vertexForm
        ? `${coef(a)}(${shifted(h)})^2${plus(k)}`
        : polyTex(fDesc);
      fAt = (x) => a * (x - h) ** 2 + k;
      fValue = rat(k);
      fWork = vertexForm
        ? `${M(`f(x) = ${fTex}`)} has its vertex at ${M(pt(h, k))}, so its ${featureText[feature]} is ${n(k)}.`
        : `The vertex of ${M("f")} is at ${M(`x = -\\frac{${tn(fDesc[1]!)}}{2 \\cdot ${tp(a)}} = ${tn(h)}`)}, and ${M(`f(${tn(h)}) = ${tn(k)}`)}, so its ${featureText[feature]} is ${n(k)}.`;
    } else if (r(0, 1) === 1) {
      const a = pick(r, [1, 2, 3]),
        c = r(-4, 4);
      fTex = `${a === 1 ? "" : `${a} \\cdot `}2^x${plus(c)}`;
      fAt = (x) => a * 2 ** x + c;
      fValue = feature === "intercept" ? rat(a + c) : rat(fAt(2) - fAt(0), 2);
      fWork =
        feature === "intercept"
          ? `${M(`f(0) = ${a === 1 ? "" : `${a} \\cdot `}2^0${plus(c)} = ${tn(a + c)}`)}, so the ${M("y")}-intercept of ${M("f")} is ${n(a + c)}.`
          : `${M(`f(0) = ${tn(fAt(0))}`)} and ${M(`f(2) = ${tn(fAt(2))}`)}, so ${M("f")} changes at ${M(`\\frac{${tn(fAt(2))} - ${tp(fAt(0))}}{2} = ${tq(fValue)}`)} per unit.`;
    } else {
      const a = pick(r, [1, -1, 2]),
        b = r(-4, 4),
        c = r(-5, 5);
      fDesc = [a, b, c];
      fTex = polyTex(fDesc);
      fAt = (x) => a * x * x + b * x + c;
      fValue = feature === "intercept" ? rat(c) : rat(fAt(2) - fAt(0), 2);
      fWork =
        feature === "intercept"
          ? `${M(`f(0) = ${tn(c)}`)}, so the ${M("y")}-intercept of ${M("f")} is ${n(c)}.`
          : `${M(`f(0) = ${tn(fAt(0))}`)} and ${M(`f(2) = ${tn(fAt(2))}`)}, so ${M("f")} changes at ${M(`\\frac{${tn(fAt(2))} - ${tp(fAt(0))}}{2} = ${tq(fValue)}`)} per unit.`;
    }
    // g.
    let gAt: (x: number) => number, gFn: Fn, gValue: Rational, gWork: string;
    if (quadG) {
      const a =
          (feature === "maximum"
            ? -1
            : feature === "minimum"
              ? 1
              : pick(r, [1, -1])) * 1,
        h = r(-2, 2);
      const kTarget =
        feature === "maximum" || feature === "minimum"
          ? r(0, 3) === 0
            ? fValue.n
            : fValue.n + nonzero(r, -3, 3)
          : r(-4, 4);
      gAt = (x) => a * (x - h) ** 2 + kTarget;
      gFn = f.vertex(a, h, kTarget);
      gValue =
        feature === "maximum" || feature === "minimum"
          ? rat(kTarget)
          : feature === "intercept"
            ? rat(gAt(0))
            : rat(gAt(2) - gAt(0), 2);
    } else {
      const m = pick(r, [-2, -1, 1, 2, 3]),
        b = r(-4, 4);
      gAt = (x) => m * x + b;
      gFn = f.poly(m, b);
      gValue = feature === "intercept" ? rat(b) : rat(m);
    }
    if (Math.abs(fValue.n / fValue.d) > 12) continue;
    const xs =
      feature === "maximum" || feature === "minimum"
        ? (() => {
            const g = gFn as { c: number[] };
            const hv = -g.c[1]! / (2 * g.c[2]!);
            return [-2, -1, 0, 1, 2].map((d) => hv + d);
          })()
        : [-1, 0, 1, 2, 3];
    const gys = xs.map(gAt);
    if (gys.some((y) => Math.abs(y) > 9)) continue;
    if (rep === "graph" && xs.some((x) => Math.abs(x) > 5)) continue;
    gWork =
      feature === "maximum" || feature === "minimum"
        ? rep === "graph"
          ? `The ${feature === "maximum" ? "highest" : "lowest"} point of the graph of ${M("g")} is at height ${n(gValue.n)}, so its ${featureText[feature]} is ${n(gValue.n)}.`
          : `The table is symmetric about ${M(`x = ${tn(xs[2]!)}`)}, so the vertex of ${M("g")} is ${M(pt(xs[2]!, gys[2]!))}: its ${featureText[feature]} is ${n(gValue.n)}.`
        : feature === "intercept"
          ? `From the ${rep}, ${M(`g(0) = ${tn(gAt(0))}`)}, so the ${M("y")}-intercept of ${M("g")} is ${n(gAt(0))}.`
          : `From the ${rep}, ${M(`g(0) = ${tn(gAt(0))}`)} and ${M(`g(2) = ${tn(gAt(2))}`)}, so ${M("g")} changes at ${M(`\\frac{${tn(gAt(2))} - ${tp(gAt(0))}}{2} = ${tq(gValue)}`)} per unit.`;
    const fv = fValue.n / fValue.d,
      gv = gValue.n / gValue.d;
    const truth = fv > gv ? 0 : fv < gv ? 1 : 2;
    // A false equation between the two at an integer both show.
    const unequal = xs.filter((x) => Number.isInteger(x) && fAt(x) !== gAt(x));
    if (!unequal.length) continue;
    const c = pick(r, unequal);
    const ft = featureText[feature];
    const statements = [
      `${M("f")} has the greater ${ft}`,
      `${M("g")} has the greater ${ft}`,
      `${M("f")} and ${M("g")} have the same ${ft}`,
      M(`f(${tn(c)}) = g(${tn(c)})`),
    ];
    const feedback = [
      `The ${ft} of ${M("f")} is ${tqProse(fValue)} and that of ${M("g")} is ${tqProse(gValue)}.`,
      `${M(`f(${tn(c)}) = ${tn(fAt(c))}`)} but ${M(`g(${tn(c)}) = ${tn(gAt(c))}`)}.`,
    ];
    const choices: Choice[] = statements.map((s, i) =>
      i === truth
        ? { label: s, correct: true }
        : { label: s, feedback: i === 3 ? feedback[1]! : feedback[0]! },
    );
    const gIntro =
      rep === "graph"
        ? `The graph shows ${quadG && feature !== "intercept" && feature !== "rate" ? "the quadratic function " : ""}${M("y = g(x)")}.`
        : `The table shows values of ${feature === "maximum" || feature === "minimum" ? "the quadratic function " : ""}${M("g")}.`;
    const scene =
      rep === "graph"
        ? graph({
            id: "g",
            x: [-6, 6],
            y: [-10, 10],
            grid: [1, 2],
            tick: [2, 2],
          })
            .curve(gFn, {
              label: "y = g(x)",
              color: "warm",
              ...(quadG ? { features: ["vertex" as const] } : {}),
            })
            .scene({ title: "The graph of a function g" })
        : valueTable([
            ["x", ...xs],
            ["g(x)", ...gys],
          ]);
    const conclusion = [
      "So $f$ has the greater " + ft + ".",
      "So $g$ has the greater " + ft + ".",
      "So $f$ and $g$ have the same " + ft + ".",
    ][truth]!;
    const pts = xs.map((x, i) => [x, gys[i]!] as [number, number]);
    const allY = [...gys, ...xs.map(fAt)];
    const walk =
      rep === "table" &&
      fDesc &&
      (feature === "maximum" || feature === "minimum") &&
      allY.every((y) => Math.abs(y) <= 10) &&
      xs.every((x) => Math.abs(x) <= 5)
        ? compareScene(f.poly(...fDesc), pts, {
            x: [-6, 6],
            y: [-10, 10],
            grid: 2,
          })
        : undefined;
    return {
      prompt: `The function ${M("f")} is defined by ${M(`f(x) = ${fTex}`)}. ${gIntro} Which statement is true?`,
      choices,
      scene,
      explanation: [fWork, gWork, conclusion],
      hint: `Find the ${ft} of ${M(`f(x) = ${fTex}`)} from its formula, then the ${ft} of ${M("g")} from the ${rep}, and compare.`,
      hintCue: [
        step(
          `Read $g$'s ${feature === "rate" ? "values at $x = 0$ and $x = 2$" : feature === "intercept" ? "value at $x = 0$" : feature + " here"}.`,
          act.highlight(
            rep === "graph"
              ? quadG && (feature === "maximum" || feature === "minimum")
                ? "g.curve.0.vertex"
                : "g.curve.0"
              : "t.cell.1",
          ),
        ),
      ],
      ...(walk ? { walkthrough: walk } : {}),
      tags: [feature, rep, ["f-greater", "g-greater", "equal"][truth]!],
    };
  }
}
/** A rational for prose (outside TeX): −3, 5/2 in math. */
const tqProse = (v: Rational) => (v.d === 1 ? n(v.n) : M(tq(v)));

// ------------------------------------------------------------------ assembly
const builders: Record<string, (r: Random) => Case> = {
  "piecewise-evaluate": piecewiseEvaluate,
  "piecewise-reading": piecewiseReading,
  "transform-equation": transformEquation,
  "transform-point": transformPoint,
  "composition-value": compositionValue,
  "composition-expression": compositionExpression,
  "inverse-value": inverseValue,
  "inverse-expression": inverseExpression,
  "compare-representations": compareRepresentations,
};
const labels: Record<string, string> = {
  "piecewise-evaluate": "Value",
  "piecewise-reading": "Choose one",
  "transform-equation": "Choose one",
  "transform-point": "Value",
  "composition-value": "Value",
  "composition-expression": "Choose the expression",
  "inverse-value": "Value",
  "inverse-expression": "Choose one",
  "compare-representations": "Choose the true statement",
};
const fractionItems = new Set(["transform-point"]);

export function functionToolkitPrintCase(id: string, seed: string) {
  const meta = functionToolkitTemplates.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown function-toolkit template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed);
  const c = builders[id]!(r);
  const walkthrough = playable(c.walkthrough);
  if (walkthrough) c.walkthrough = walkthrough;
  else delete c.walkthrough;
  return assemble(
    meta,
    seed,
    c,
    r,
    labels[id]!,
    fractionItems.has(id) ? "fraction" : "number",
  );
}
export const generateFunctionToolkitProblem = (
  id: string,
  seed: string,
): GeneratedProblem => functionToolkitPrintCase(id, seed).problem;
export type { Scene };
