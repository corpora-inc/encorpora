import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  f as fn,
  graph,
  lineTable,
  numberLine,
  scene as sceneOf,
} from "./scene/author";
import type { Scene } from "./scene/spec";
import { axisRecord, chooseAxes, defineAxis, isLegacy } from "./variation/axes";
import {
  figureOptionIds,
  figureOptionLetters,
  type FigureChoiceNoun,
  type FigureChoiceResponse,
} from "./figure-choice";

/** Families answered by choosing one of several drawn figures
 * (figure-choice-v1): the graph of a linear rule, of a proportional rate,
 * of a quadratic or exponential rule, and the number line of an inequality.
 * Every distractor is a specific misconception, drawn from the same model as
 * the correct figure and described in the same words. */
const figures = {
  requiredResponseCapability: "figure-choice-v1" as const,
  requiredFigureCapability: "scenes-v1" as const,
};
export const figureChoiceTemplates: readonly TemplateMetadata[] = [
  {
    id: "graph-of-linear-rule",
    version: 1,
    title: "Choose the graph of a linear rule",
    skillId: "linear-models",
    gradeBand: "6–8",
    ...figures,
    description:
      "Choose the graph of a line given by $y = mx + b$, by its slope and $y$-intercept, by a table of values or by an equation in standard form, among lines with the slope's sign flipped, slope and intercept confused, or the intercept placed on the $x$-axis.",
  },
  {
    id: "graph-of-proportional-rate",
    version: 1,
    title: "Choose the graph of a rate",
    skillId: "proportional-relationships",
    gradeBand: "6–8",
    ...figures,
    description:
      "Choose the graph of a proportional relationship given by a rate in context, among lines that do not start at zero, use the total as the rate or turn the rate upside down.",
  },
  {
    id: "graph-of-inequality-number-line",
    version: 1,
    title: "Choose the number line of an inequality",
    skillId: "linear-inequalities",
    gradeBand: "6–8",
    ...figures,
    description:
      "Solve a one- or two-step inequality and choose its number line, among graphs with the wrong endpoint, the wrong direction or a boundary from a sign or inverse-operation slip.",
  },
  {
    id: "graph-of-quadratic-or-exponential",
    version: 1,
    title: "Choose the graph of a quadratic or exponential rule",
    skillId: "function-transformations",
    gradeBand: "9–12",
    ...figures,
    description:
      "Choose the graph of $y = a(x - h)^2 + k$, of $y = a \\cdot b^x$, or of a shifted parabola $y = f(x - h) + k$, among graphs shifted the wrong way, reflected, swapped between growth and decay, or drawn as a line.",
  },
];

/* ---------- exact rationals and text ---------- */
type Q = { n: number; d: number };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
function q(n: number, d = 1): Q {
  const g = gcd(n, d) || 1,
    s = d < 0 ? -1 : 1;
  return { n: (s * n) / g + 0, d: (s * d) / g };
}
const value = (v: Q) => v.n / v.d;
const same = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
const neg = (v: Q) => q(-v.n, v.d);
const inv = (v: Q) => q(v.d, v.n);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
/** A number in prose with a true minus sign: "−3", "1/2" as TeX. */
const signed = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const tex = (v: Q) =>
  v.d === 1
    ? `${v.n}`
    : `${v.n < 0 ? "-" : ""}\\frac{${Math.abs(v.n)}}{${v.d}}`;
/** A rational in prose: a whole number as text, a fraction in TeX. */
const prose = (v: Q) => (v.d === 1 ? signed(v.n) : `$${tex(v)}$`);
/** A rational in a spoken description: "−1/2". */
const plain = (v: Q) =>
  v.d === 1 ? signed(v.n) : `${v.n < 0 ? "−" : ""}${Math.abs(v.n)}/${v.d}`;
type Pt = [number, number];
const point = ([x, y]: Pt) => `(${signed(x)}, ${signed(y)})`;
const coef = (m: Q) =>
  m.d === 1 && m.n === 1 ? "" : m.d === 1 && m.n === -1 ? "-" : tex(m);
const plusTerm = (b: Q) =>
  b.n === 0 ? "" : b.n < 0 ? ` - ${tex(neg(b))}` : ` + ${tex(b)}`;
/** "y = 2x - 3" in TeX. */
const lineTex = (m: Q, b: Q) => `y = ${coef(m)}x${plusTerm(b)}`;
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const nonzero = (r: Random, lo: number, hi: number) =>
  (r(0, 1) ? 1 : -1) * r(lo, hi);

/* ---------- assembling a problem ---------- */
export type Candidate = {
  /** Plain-text description of the figure, from the same model. */
  description: string;
  scene: Scene;
  /** Absent on the correct option; names the misconception otherwise. */
  feedback?: (name: string) => string;
};
export type Parts = {
  prompt: string;
  label: string;
  noun: FigureChoiceNoun;
  figure?: SemanticFigure;
  correct: Candidate;
  distractors: Candidate[];
  hint: string;
  /** Steps of the solution; the last names the correct figure. */
  explanation: (name: string) => string[];
  /** The correct figure worked for a lesson: may show the answer. */
  walkthrough: Scene;
};
/** Every option is a different figure with a different description. */
const distinct = (all: readonly Candidate[]) =>
  new Set(all.map((c) => JSON.stringify(c.scene.elements))).size ===
    all.length && new Set(all.map((c) => c.description)).size === all.length;
export function problemOf(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  parts: Parts,
): GeneratedProblem {
  const all = [parts.correct, ...parts.distractors];
  if (!distinct(all))
    throw new Error(`${meta.id}: options must be distinct figures`);
  // Shuffle, then letter by position: ids say nothing about correctness.
  const order = shuffle(r, [...all]);
  const id = (c: Candidate) => figureOptionIds[order.indexOf(c)]!;
  const name = (c: Candidate) =>
    `${parts.noun} ${figureOptionLetters[order.indexOf(c)]!}`;
  const response: FigureChoiceResponse = {
    kind: "figure-choice",
    label: parts.label,
    noun: parts.noun,
    options: order.map((c) => ({
      id: id(c),
      label: c.description,
      scene: c.scene,
    })),
  };
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: parts.prompt,
      skillId: meta.skillId,
      response,
      ...(parts.figure ? { figure: parts.figure } : {}),
    },
    answer: id(parts.correct),
    explanation: parts.explanation(name(parts.correct)),
    hint: parts.hint,
    choiceFeedback: Object.fromEntries(
      parts.distractors.map((c) => [id(c), c.feedback!(name(c))]),
    ),
    walkthrough: parts.walkthrough,
  };
}
/** Card size: the figure is drawn at this width, so its labels keep their
 * typeset 15 px wherever a card is at least 80% as wide. */
export const CARD = { width: 264, maxHeight: 280 } as const;
const STRIP = { width: 260, maxHeight: 110 } as const;

/* ---------- lines on a four-quadrant grid ---------- */
const LIMIT = 6;
type Line = { m: Q; b: Q };
const yAt = (l: Line, x: number) => add(mul(l.m, q(x)), l.b);
/** Lattice points of the line inside the −6…6 window, left to right. */
function latticeOf(l: Line): Pt[] {
  const out: Pt[] = [];
  for (let x = -LIMIT; x <= LIMIT; x++) {
    const y = yAt(l, x);
    if (y.d === 1 && Math.abs(y.n) <= LIMIT) out.push([x, y.n]);
  }
  return out;
}
/** Two lattice points that name the line: its y-intercept when that is a
 * visible lattice point, and the visible lattice point nearest the y-axis. */
function namingPoints(l: Line): [Pt, Pt] | null {
  const pts = latticeOf(l);
  if (pts.length < 2) return null;
  const byAxis = [...pts].sort(
    (a, b) => Math.abs(a[0]) - Math.abs(b[0]) || b[0] - a[0],
  );
  const [first, second] = byAxis as [Pt, Pt];
  return first[0] < second[0] ? [first, second] : [second, first];
}
const direction = (m: Q) =>
  m.n > 0 ? "rising from left to right" : "falling from left to right";
function lineCandidate(
  l: Line,
  feedback?: (name: string) => string,
): Candidate | null {
  const pts = namingPoints(l);
  if (!pts) return null;
  let plot = graph({
    x: [-LIMIT, LIMIT],
    y: [-LIMIT, LIMIT],
    grid: 1,
    tick: 2,
    aspect: 1,
    axisNames: ["x", "y"],
  }).line({ through: [pts[0], pts[1]] }, { color: "accent" });
  for (const p of pts)
    plot = plot.point(p[0], p[1], undefined, { color: "accent" });
  return {
    description: `A line through ${point(pts[0])} and ${point(pts[1])}, ${direction(l.m)}.`,
    scene: sceneOf(plot).build(CARD),
    ...(feedback ? { feedback } : {}),
  };
}
const SLOPES: readonly Q[] = [
  q(1),
  q(2),
  q(3),
  q(-1),
  q(-2),
  q(-3),
  q(1, 2),
  q(-1, 2),
  q(1, 3),
  q(-1, 3),
  q(2, 3),
  q(-2, 3),
  q(3, 2),
  q(-3, 2),
];

function linearRule(seed: string): GeneratedProblem {
  const meta = figureChoiceTemplates[0]!;
  const r = random(meta.id, seed);
  const variant = r(0, 3);
  for (let attempt = 0; attempt < 200; attempt++) {
    // Tables and standard form use whole-number slopes; words and equations
    // also use fractions.
    const whole = variant === 2 || variant === 3;
    const m = pick(
      r,
      SLOPES.filter((s) => !whole || s.d === 1),
    );
    const b = q(nonzero(r, 1, 4));
    const line = { m, b };
    const eq = `$${lineTex(m, b)}$`;
    const slopeIs = `slope ${prose(m)}`;
    // Slope and intercept confused: for a whole slope its roles swap; for a
    // fraction, rise and run trade places.
    const swapped: Line = m.d === 1 ? { m: b, b: m } : { m: inv(m), b };
    const candidates = [
      lineCandidate(line),
      lineCandidate(
        { m: neg(m), b },
        (name) =>
          `${name} has slope ${prose(neg(m))}: the sign of the slope is flipped, so it ${m.n > 0 ? "falls" : "rises"} where the line ${m.n > 0 ? "rises" : "falls"}.`,
      ),
      lineCandidate(swapped, (name) =>
        m.d === 1
          ? `${name} is $${lineTex(swapped.m, swapped.b)}$: it uses the $y$-intercept ${signed(b.n)} as the slope and the slope ${signed(m.n)} as the intercept.`
          : `${name} has slope ${prose(swapped.m)}: rise and run are swapped. A slope of ${prose(m)} means a change of ${signed(m.n)} in $y$ for each ${m.d} to the right.`,
      ),
      lineCandidate(
        { m, b: mul(neg(m), b) },
        (name) =>
          `${name} crosses the $x$-axis at ${point([b.n, 0])}. The $y$-intercept ${signed(b.n)} belongs on the $y$-axis, at ${point([0, b.n])}.`,
      ),
    ];
    if (
      candidates.some((c) => c === null) ||
      !distinct(candidates as Candidate[])
    )
      continue;
    const [correct, ...distractors] = candidates as Candidate[];
    // The correct line is read at its y-intercept, so that must be drawn.
    if (!latticeOf(line).some(([x]) => x === 0)) continue;
    const step = m.d;
    const next: Pt = [step, b.n + m.n];
    if (Math.abs(next[1]) > LIMIT) continue;
    let prompt: string, figure: SemanticFigure | undefined, given: string;
    if (variant === 0) {
      prompt = `Which graph shows ${eq}?`;
      given = `In ${eq}, the slope is ${prose(m)} and the $y$-intercept is ${signed(b.n)}`;
    } else if (variant === 1) {
      prompt = `Which graph shows the line with ${slopeIs} and $y$-intercept ${signed(b.n)}?`;
      given = `The line has ${slopeIs} and $y$-intercept ${signed(b.n)}`;
    } else if (variant === 2) {
      const start = r(0, 1) ? -1 : r(0, 1);
      const xs = [0, 1, 2, 3].map((i) => start + i);
      const ys = xs.map((x) => yAt(line, x).n);
      if (ys.some((y) => Math.abs(y) > 15)) continue;
      figure = {
        kind: "scene",
        scene: lineTable(
          [
            ["x", ...xs.map(signed)],
            ["y", ...ys.map(signed)],
          ],
          { header: "column" },
        ).scene({ title: "Table of x and y values" }),
      };
      prompt =
        "The table shows a linear relationship between $x$ and $y$. Which graph shows it?";
      given = `In the table, $y$ changes by ${signed(m.n)} each time $x$ increases by 1, so the slope is ${signed(m.n)}${xs.includes(0) ? `, and at $x = 0$, $y = ${b.n}$` : `. Step back to $x = 0$ to find the $y$-intercept, ${signed(b.n)}`}`;
    } else {
      // a·x + y = c, so y = −a·x + c.
      prompt = `Which graph shows $${left(m)} = ${b.n}$?`;
      given = `Solve for $y$: ${eq}, so the slope is ${signed(m.n)} and the $y$-intercept is ${signed(b.n)}`;
    }
    return problemOf(meta, seed, r, {
      prompt,
      label: "Choose the graph",
      noun: "Graph",
      ...(figure ? { figure } : {}),
      correct,
      distractors,
      hint:
        variant === 2
          ? `Find how much $y$ changes each time $x$ increases by 1 in the table; that is the slope. Then find the value of $y$ when $x = 0$.`
          : variant === 3
            ? `Rewrite $${left(m)} = ${b.n}$ as $y = mx + b$ by moving the $x$-term to the other side. Then look for the graph that crosses the $y$-axis at $b$.`
            : `Start with the $y$-intercept ${signed(b.n)}: rule out every graph that does not cross the $y$-axis at ${point([0, b.n])}. Then compare the slopes, ${prose(m)}.`,
      explanation: (name) => [
        `In $y = mx + b$, the slope $m$ is how much $y$ changes for each 1 step right, and the $y$-intercept $b$ is where the line crosses the $y$-axis.`,
        `${given}.`,
        `So the line crosses the $y$-axis at ${point([0, b.n])} and, from there, ${m.n > 0 ? "rises" : "falls"} ${Math.abs(m.n)} for each ${step} to the right, reaching ${point(next)}.`,
        `${name} is the line through ${point([0, b.n])} and ${point(next)}.`,
      ],
      walkthrough: sceneOf(
        graph({
          x: [-LIMIT, LIMIT],
          y: [-LIMIT, LIMIT],
          grid: 1,
          tick: 2,
          aspect: 1,
          axisNames: ["x", "y"],
        })
          .line({ through: [[0, b.n], next] }, { color: "accent" })
          .slope([0, b.n], next, "shown")
          .point(0, b.n, undefined, { color: "accent" }),
      ).build({
        title: `The graph of ${lineTex(m, b).replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "$1/$2")}`,
        width: 300,
        maxHeight: 300,
      }),
    });
  }
  throw new Error(`${meta.id}: no instance for ${seed}`);
}
/** The standard-form left side for slope m: a·x + y with a = −m. */
function left(m: Q) {
  const a = -m.n;
  return `${a === 1 ? "" : a === -1 ? "-" : a}x + y`;
}

/* ---------- proportional rates in the first quadrant ---------- */
const CONTEXTS = [
  {
    doer: "A printer",
    verb: "prints",
    unit: "pages",
    one: "page",
    per: "minute",
    pers: "minutes",
    x: "Minutes",
    y: "Pages",
  },
  {
    doer: "A typist",
    verb: "types",
    unit: "lines",
    one: "line",
    per: "minute",
    pers: "minutes",
    x: "Minutes",
    y: "Lines",
  },
  {
    doer: "A cyclist",
    verb: "rides",
    unit: "miles",
    one: "mile",
    per: "hour",
    pers: "hours",
    x: "Hours",
    y: "Miles",
  },
  {
    doer: "A reader",
    verb: "reads",
    unit: "books",
    one: "book",
    per: "week",
    pers: "weeks",
    x: "Weeks",
    y: "Books",
  },
  {
    doer: "A pump",
    verb: "fills",
    unit: "liters",
    one: "liter",
    per: "minute",
    pers: "minutes",
    x: "Minutes",
    y: "Liters",
  },
  {
    doer: "A baker",
    verb: "bakes",
    unit: "loaves",
    one: "loaf",
    per: "hour",
    pers: "hours",
    x: "Hours",
    y: "Loaves",
  },
  {
    doer: "A gardener",
    verb: "plants",
    unit: "seedlings",
    one: "seedling",
    per: "hour",
    pers: "hours",
    x: "Hours",
    y: "Seedlings",
  },
  {
    doer: "A machine",
    verb: "packs",
    unit: "boxes",
    one: "box",
    per: "minute",
    pers: "minutes",
    x: "Minutes",
    y: "Boxes",
  },
  {
    doer: "A hiker",
    verb: "walks",
    unit: "kilometers",
    one: "kilometer",
    per: "hour",
    pers: "hours",
    x: "Hours",
    y: "Kilometers",
  },
  {
    doer: "A student",
    verb: "solves",
    unit: "problems",
    one: "problem",
    per: "day",
    pers: "days",
    x: "Days",
    y: "Problems",
  },
] as const;
const RATE_LIMIT = 12;
/** Where the ray from `start` through `through` leaves the 0–12 window. */
function rayEnd(start: Pt, through: Pt): Pt {
  const slope = q(through[1] - start[1], through[0] - start[0]);
  const atTop = add(q(start[0]), mul(q(RATE_LIMIT - start[1]), inv(slope)));
  const x = Math.min(RATE_LIMIT, value(atTop));
  const y = value(add(q(start[1]), mul(slope, q(x - start[0], 1))));
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return [round(x), round(Math.min(RATE_LIMIT, y))];
}
function rateCandidate(
  start: Pt,
  through: Pt,
  axes: readonly [string, string],
  feedback?: (name: string) => string,
): Candidate {
  const plot = graph({
    x: [0, RATE_LIMIT],
    y: [0, RATE_LIMIT],
    grid: 1,
    tick: 2,
    aspect: 1,
    axisNames: [axes[0], axes[1]],
  })
    // A context graph starts at its first point: a ray to the window's edge.
    .segment(start, rayEnd(start, through), { arrow: true, color: "accent" })
    .point(start[0], start[1], undefined, { color: "accent" })
    .point(through[0], through[1], undefined, { color: "accent" });
  return {
    description: `A line starting at ${point(start)} and passing through ${point(through)}.`,
    scene: sceneOf(plot).build(CARD),
    ...(feedback ? { feedback } : {}),
  };
}
function proportionalRate(seed: string): GeneratedProblem {
  const meta = figureChoiceTemplates[1]!;
  const r = random(meta.id, seed);
  const c = pick(r, CONTEXTS);
  const axes = [c.x, c.y] as const;
  const k = r(2, 4);
  const stated = r(0, 2) > 0;
  if (stated) {
    // "6 pages in 2 minutes": the unit rate must be found first. Half the
    // rates are whole numbers; the rest are fractions such as 12/5.
    const whole = r(0, 1) === 0;
    const t = whole ? (k === 4 ? r(2, 3) : r(2, 4)) : r(2, 5);
    const total = whole
      ? k * t
      : pick(
          r,
          Array.from({ length: 12 - t }, (_, i) => t + 1 + i).filter(
            (n) => n % t !== 0,
          ),
        );
    const rate = q(total, t);
    const correct = rateCandidate([0, 0], [t, total], axes);
    const distractors = [
      rateCandidate(
        [0, 0],
        [1, total],
        axes,
        (name) =>
          `${name} rises ${total} for each ${c.per}: it uses the total, ${total} ${c.unit}, as the rate. Those ${total} ${c.unit} take ${t} ${c.pers}.`,
      ),
      rateCandidate(
        [0, 0],
        [total, t],
        axes,
        (name) =>
          `${name} passes through ${point([total, t])}: the rate is upside down, ${c.pers} per ${c.one}. Put ${c.unit} on the vertical axis: ${total} ${c.unit} after ${t} ${c.pers} is the point ${point([t, total])}.`,
      ),
      rateCandidate(
        [0, total - t],
        [t, total],
        axes,
        (name) =>
          `${name} passes through ${point([t, total])} but starts at ${point([0, total - t])}. In 0 ${c.pers}, 0 ${c.unit}: a proportional graph starts at the origin.`,
      ),
    ];
    return problemOf(meta, seed, r, {
      prompt: `${c.doer} ${c.verb} ${total} ${c.unit} every ${t} ${c.pers} at a constant rate. Which graph shows the number of ${c.unit}, $y$, after $x$ ${c.pers}?`,
      label: "Choose the graph",
      noun: "Graph",
      correct,
      distractors,
      hint: `Divide to find ${c.unit} per ${c.per}: ${total} ${c.unit} ÷ ${t} ${c.pers}. A proportional graph starts at (0, 0) and rises by that amount for each ${c.per}.`,
      explanation: (name) => [
        `The unit rate is ${total} ÷ ${t} = ${prose(rate)} ${c.unit} per ${c.per}, so $y = ${tex(rate)}x$.`,
        `In 0 ${c.pers}, 0 ${c.unit}: the graph starts at the origin, and it passes through ${rate.d === 1 ? `${point([1, rate.n])} and ` : ""}${point([t, total])}.`,
        `${name} is the line from ${point([0, 0])} through ${point([t, total])}.`,
      ],
      walkthrough: rateWalkthrough([t, total], axes),
    });
  }
  // "3 pages per minute": the unit rate is given.
  const correct = rateCandidate([0, 0], [2, 2 * k], axes);
  const distractors = [
    rateCandidate(
      [0, 0],
      [k, 1],
      axes,
      (name) =>
        `${name} passes through ${point([k, 1])}: the rate is upside down, 1 ${c.one} every ${k} ${c.pers}. The rate is ${k} ${c.unit} each ${c.per}.`,
    ),
    rateCandidate(
      [0, k],
      [2, k + 2],
      axes,
      (name) =>
        `${name} is $y = x + ${k}$: it adds ${k} once instead of ${k} for every ${c.per}. After 2 ${c.pers} it shows ${k + 2} ${c.unit}, not ${2 * k}.`,
    ),
    rateCandidate(
      [0, k],
      [2, 3 * k],
      axes,
      (name) =>
        `${name} rises ${k} each ${c.per} but starts at ${point([0, k])}. In 0 ${c.pers}, 0 ${c.unit}: a proportional graph starts at the origin.`,
    ),
  ];
  return problemOf(meta, seed, r, {
    prompt: `${c.doer} ${c.verb} ${k} ${c.unit} per ${c.per}. Which graph shows the number of ${c.unit}, $y$, after $x$ ${c.pers}?`,
    label: "Choose the graph",
    noun: "Graph",
    correct,
    distractors,
    hint: `In 0 ${c.pers}, how many ${c.unit}? Then each ${c.per} adds ${k} more: find the graph that starts there and rises ${k} for every 1 to the right.`,
    explanation: (name) => [
      `${k} ${c.unit} per ${c.per} gives $y = ${k}x$: proportional, with constant of proportionality ${k}.`,
      `In 0 ${c.pers}, 0 ${c.unit}, so the graph starts at the origin; after 2 ${c.pers}, ${2 * k} ${c.unit}, the point ${point([2, 2 * k])}.`,
      `${name} is the line from ${point([0, 0])} through ${point([2, 2 * k])}.`,
    ],
    walkthrough: rateWalkthrough([2, 2 * k], axes),
  });
}
/* ---------- rates with decimals and scaled vertical axes ---------- */
/** Surface axes of the rate graph. `whole-or-fraction` with `unit` is the
 * family as it was before axes: every other pair re-expresses the same
 * proportional model with a decimal rate, a decimal time or a vertical axis
 * that counts in fives, tens or twenties. */
export const rateAxes = {
  "rate-form": defineAxis(
    "rate-form",
    ["whole-or-fraction", "decimal-rate", "decimal-time"],
    { weights: [2, 1, 1] },
  ),
  "y-scale": defineAxis("y-scale", ["unit", "scaled"], { weights: [2, 1] }),
} as const;
/** Decimal unit rates whose first lattice point (x, y) has x of 2 or 5. */
const DECIMAL_RATES: readonly [number, number][] = [
  [1, 2],
  [3, 2],
  [5, 2],
  [7, 2],
  [9, 2],
  [6, 5],
  [8, 5],
  [9, 5],
  [12, 5],
];
/** Totals over a decimal time: [rate, time, time words]. */
const DECIMAL_TIMES: readonly [number, number][] = [
  [4, 0.5],
  [6, 0.5],
  [2, 1.5],
  [4, 1.5],
  [6, 1.5],
  [2, 2.5],
  [4, 2.5],
];
const EXTRA_CONTEXTS = [
  {
    doer: "A typist",
    verb: "types",
    unit: "words",
    one: "word",
    per: "minute",
    pers: "minutes",
    x: "Minutes",
    y: "Words",
  },
  {
    doer: "A printer",
    verb: "uses",
    unit: "milliliters of ink",
    one: "milliliter of ink",
    per: "minute",
    pers: "minutes",
    x: "Minutes",
    y: "Milliliters of ink",
  },
  {
    doer: "A runner",
    verb: "burns",
    unit: "calories",
    one: "calorie",
    per: "hour",
    pers: "hours",
    x: "Hours",
    y: "Calories",
  },
] as const;
const decimalText = (n: number) => `${Number(n.toFixed(4))}`;
/** A ray from `start` through `through`, to the edge of the 12 by 12S window. */
function rayEndScaled(start: Pt, through: Pt, top: number): Pt {
  const [dx, dy] = [through[0] - start[0], through[1] - start[1]];
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  if (dx === 0) return [start[0], top];
  if (dy === 0) return [RATE_LIMIT, start[1]];
  const t = Math.min((RATE_LIMIT - start[0]) / dx, (top - start[1]) / dy);
  return [round(start[0] + t * dx), round(start[1] + t * dy)];
}
function scaledPlot(axes: readonly [string, string], scale: number) {
  return graph({
    x: [0, RATE_LIMIT],
    y: [0, RATE_LIMIT * scale],
    grid: [1, scale],
    tick: [2, 2 * scale],
    aspect: 1 / scale,
    axisNames: [axes[0], axes[1]],
  });
}
function scaledRateCandidate(
  start: Pt,
  through: Pt,
  axes: readonly [string, string],
  scale: number,
  feedback?: (name: string) => string,
): Candidate {
  const plot = scaledPlot(axes, scale)
    .segment(start, rayEndScaled(start, through, RATE_LIMIT * scale), {
      arrow: true,
      color: "accent",
    })
    .point(start[0], start[1], undefined, { color: "accent" })
    .point(through[0], through[1], undefined, { color: "accent" });
  return {
    description: `A line starting at ${point(start)} and passing through ${point(through)}.`,
    scene: sceneOf(plot).build(CARD),
    ...(feedback ? { feedback } : {}),
  };
}
function variedRate(
  seed: string,
  form: (typeof rateAxes)["rate-form"]["values"][number],
  scaleAxis: (typeof rateAxes)["y-scale"]["values"][number],
): GeneratedProblem {
  const meta = figureChoiceTemplates[1]!;
  const r = random(meta.id, seed);
  const scaled = scaleAxis === "scaled";
  // A scaled decimal rate (n/2 per gridline unit of 5) must still print a
  // decimal, so it uses halves with a scale of 5.
  const S =
    scaled && form === "decimal-rate" ? 5 : scaled ? pick(r, [5, 10, 20]) : 1;
  const c = pick(
    r,
    scaled ? [...EXTRA_CONTEXTS, ...CONTEXTS.slice(0, 4)] : CONTEXTS,
  );
  const axes = [c.x, c.y] as const;
  const amt = (n: number) => `${decimalText(n)} ${n === 1 ? c.one : c.unit}`;
  // The unit rate in graph units, a first lattice point and how it is told.
  let rate: Q;
  let x0: number;
  let told: { prompt: string; hint: string; lead: string };
  let totalForm = false;
  let T = 0;
  let timeNum = 1;
  if (form === "decimal-rate") {
    const [n, d] = pick(
      r,
      scaled ? DECIMAL_RATES.filter(([, den]) => den === 2) : DECIMAL_RATES,
    );
    rate = q(n, d);
    x0 = d;
    const shown = decimalText(value(rate) * S);
    told = {
      prompt: `${c.doer} ${c.verb} ${shown} ${c.unit} per ${c.per}.`,
      hint: `In 0 ${c.pers}, how many ${c.unit}? Then every ${c.per} adds ${shown} more: find the graph that starts there and rises ${shown} for every 1 to the right.`,
      lead: `${shown} ${c.unit} per ${c.per} gives $y = ${shown}x$`,
    };
  } else if (form === "decimal-time") {
    const [k, t] = pick(r, DECIMAL_TIMES);
    rate = q(k);
    x0 = 2;
    totalForm = true;
    timeNum = t;
    T = k * t * S;
    const words = t === 0.5 ? `half ${c.per}` : `${decimalText(t)} ${c.pers}`;
    told = {
      prompt: `${c.doer} ${c.verb} ${amt(T)} every ${words} at a constant rate.`,
      hint: `Divide to find ${c.unit} per ${c.per}: ${amt(T)} ÷ ${decimalText(t)} ${c.pers}. A proportional graph starts at (0, 0) and rises by that amount for each ${c.per}.`,
      lead: `The unit rate is ${decimalText(T)} ÷ ${decimalText(t)} = ${decimalText(k * S)} ${c.unit} per ${c.per}`,
    };
  } else if (r(0, 1)) {
    // A rate told as a total over whole units, as in the family before axes.
    totalForm = true;
    const t = r(2, 4);
    const whole = scaled || r(0, 1) === 0;
    const units = whole
      ? r(2, Math.min(4, Math.floor(RATE_LIMIT / t))) * t
      : pick(
          r,
          Array.from({ length: 12 - t }, (_, i) => t + 1 + i).filter(
            (n) => n % t !== 0,
          ),
        );
    rate = q(units, t);
    x0 = t;
    timeNum = t;
    T = units * S;
    told = {
      prompt: `${c.doer} ${c.verb} ${amt(T)} every ${t} ${c.pers} at a constant rate.`,
      hint: `Divide to find ${c.unit} per ${c.per}: ${amt(T)} ÷ ${t} ${c.pers}. A proportional graph starts at (0, 0) and rises by that amount for each ${c.per}.`,
      lead: `The unit rate is ${T} ÷ ${t} = ${prose(mul(rate, q(S)))} ${c.unit} per ${c.per}`,
    };
  } else {
    const k = r(2, 4);
    rate = q(k);
    x0 = 2;
    told = {
      prompt: `${c.doer} ${c.verb} ${k * S} ${c.unit} per ${c.per}.`,
      hint: `In 0 ${c.pers}, how many ${c.unit}? Then every ${c.per} adds ${k * S} more: find the graph that starts there.`,
      lead: `${k * S} ${c.unit} per ${c.per} gives $y = ${k * S}x$`,
    };
  }
  const R = value(rate) * S; // actual unit rate
  const Y = R * x0; // value at the first lattice point
  const top = RATE_LIMIT * S;
  const here = (a: Pt, b: Pt, f?: (name: string) => string) =>
    scaledRateCandidate(a, b, axes, S, f);
  const correct = here([0, 0], [x0, Y]);
  const pool: Candidate[] = [];
  // Two options that start at the same place with the same slope draw one ray.
  const rayKey = (a: Pt, b: Pt) =>
    `${a}|${b[0] === a[0] ? "up" : (b[1] - a[1]) / (b[0] - a[0])}`;
  const keys = new Map<Candidate, string>();
  const inWindow = (p: Pt) =>
    p[0] >= 0 && p[0] <= RATE_LIMIT && p[1] >= 0 && p[1] <= top;
  const offer = (a: Pt, b: Pt, f: (name: string) => string) => {
    if (!inWindow(a) || !inWindow(b)) return;
    const candidate = here(a, b, f);
    keys.set(candidate, rayKey(a, b));
    pool.push(candidate);
  };
  if (totalForm && x0 > 1)
    offer(
      [0, 0],
      [1, Y],
      (name) =>
        `${name} rises ${decimalText(Y)} for each ${c.per}: it uses the total, ${amt(Y)}, as the rate. Those ${amt(Y)} take ${decimalText(timeNum)} ${c.pers}.`,
    );
  if (!totalForm)
    offer(
      [0, R],
      [1, 1 + R],
      (name) =>
        `${name} is $y = x + ${decimalText(R)}$: it adds ${decimalText(R)} once instead of ${decimalText(R)} for every ${c.per}. After 1 ${c.per} it shows ${decimalText(1 + R)} ${c.unit}, not ${decimalText(R)}.`,
    );
  if (Y <= RATE_LIMIT && x0 !== Y)
    offer(
      [0, 0],
      [Y, x0],
      (name) =>
        `${name} passes through ${point([Y, x0])}: the rate is upside down, ${c.pers} per ${c.one}. Put ${c.unit} on the vertical axis: ${amt(Y)} after ${x0} ${c.pers} is the point ${point([x0, Y])}.`,
    );
  if (R * 2 <= top)
    offer(
      [0, R],
      [1, 2 * R],
      (name) =>
        `${name} rises ${decimalText(R)} each ${c.per} but starts at ${point([0, R])}. In 0 ${c.pers}, 0 ${c.unit}: a proportional graph starts at the origin.`,
    );
  if (totalForm && Y > x0)
    offer(
      [0, Y - x0],
      [x0, Y],
      (name) =>
        `${name} passes through ${point([x0, Y])} but starts at ${point([0, Y - x0])}. In 0 ${c.pers}, 0 ${c.unit}: a proportional graph starts at the origin.`,
    );
  offer(
    [0, Y],
    [x0, Y],
    (name) =>
      `${name} is a horizontal line at ${amt(Y)}: the amount stays the same as ${c.pers} pass, but a constant rate adds ${amt(R)} every ${c.per}.`,
  );
  offer(
    [x0, 0],
    [x0, Y],
    (name) =>
      `${name} is a vertical line at ${decimalText(x0)} ${c.pers}: ${c.unit} would change while no time passes.`,
  );
  if (scaled)
    offer(
      [0, 0],
      [x0, Y / S],
      (name) =>
        `${name} reads each gridline of the vertical axis as 1. The gridlines count ${S}, so ${amt(Y)} after ${x0} ${c.pers} is the point ${point([x0, Y])}, not ${point([x0, Y / S])}.`,
    );
  if (form === "decimal-rate" && !Number.isInteger(R) && R > 1)
    offer(
      [0, 0],
      [1, Math.floor(R)],
      (name) =>
        `${name} rises ${Math.floor(R)} for each ${c.per}: it drops the decimal part of ${decimalText(R)}.`,
    );
  if (form === "decimal-time")
    offer(
      [0, 0],
      [x0, x0 * T * timeNum],
      (name) =>
        `${name} multiplies by ${decimalText(timeNum)} instead of dividing: ${decimalText(T)} × ${decimalText(timeNum)} is not the ${c.unit} in one ${c.per}. Divide ${decimalText(T)} by ${decimalText(timeNum)}.`,
    );
  const seen = new Set<string>([rayKey([0, 0], [x0, Y])]);
  const distractors = shuffle(r, pool)
    .filter((c2) => !seen.has(keys.get(c2)!) && seen.add(keys.get(c2)!))
    .slice(0, 3);
  if (distractors.length < 3) throw new Error("Need three distractors");
  const rateText = decimalText(R);
  return problemOf(meta, seed, r, {
    prompt: `${told.prompt} Which graph shows the number of ${c.unit}, $y$, after $x$ ${c.pers}?`,
    label: "Choose the graph",
    noun: "Graph",
    correct,
    distractors,
    hint: scaled
      ? `${told.hint} Check what one gridline of the vertical axis is worth: its labels count by ${2 * S}.`
      : told.hint,
    explanation: (name) => [
      `${told.lead}: the constant of proportionality is ${rateText}.`,
      `In 0 ${c.pers}, 0 ${c.unit}: the graph starts at the origin, and after ${x0} ${x0 === 1 ? c.per : c.pers} it shows ${amt(Y)}, the point ${point([x0, Y])}.`,
      `${name} is the line from ${point([0, 0])} through ${point([x0, Y])}.`,
    ],
    walkthrough: sceneOf(
      scaledPlot(axes, S)
        .segment([0, 0], rayEndScaled([0, 0], [x0, Y], top), {
          arrow: true,
          color: "accent",
        })
        .point(0, 0, undefined, { color: "accent" })
        .point(x0, Y, undefined, { color: "accent" }),
    ).build({
      title: `The graph of y = ${rateText}x`,
      width: 300,
      maxHeight: 300,
    }),
  });
}
const rateWithAxes = (seed: string): GeneratedProblem => {
  const chosen = chooseAxes(figureChoiceTemplates[1]!.id, seed, rateAxes);
  const problem = isLegacy(rateAxes, chosen)
    ? proportionalRate(seed)
    : variedRate(seed, chosen["rate-form"], chosen["y-scale"]);
  return {
    ...problem,
    variant: {
      id: `${chosen["rate-form"]}-${chosen["y-scale"]}`,
      axes: axisRecord(chosen),
    },
  };
};
function rateWalkthrough(at: Pt, axes: readonly [string, string]) {
  const rate = q(at[1], at[0]);
  return sceneOf(
    graph({
      x: [0, RATE_LIMIT],
      y: [0, RATE_LIMIT],
      grid: 1,
      tick: 2,
      aspect: 1,
      axisNames: [axes[0], axes[1]],
    })
      .segment([0, 0], rayEnd([0, 0], at), { arrow: true, color: "accent" })
      .slope([0, 0], at, "shown")
      .point(0, 0, undefined, { color: "accent" })
      .point(at[0], at[1], undefined, { color: "accent" }),
  ).build({
    title: `The graph of y = ${plain(rate)}x`,
    width: 300,
    maxHeight: 300,
  });
}

/* ---------- inequalities on a number line ---------- */
type Op = "<" | "≤" | ">" | "≥";
const OPS: readonly Op[] = ["<", "≤", ">", "≥"];
const texOp: Record<Op, string> = {
  "<": "<",
  "≤": "\\le",
  ">": ">",
  "≥": "\\ge",
};
const flip: Record<Op, Op> = { "<": ">", "≤": "≥", ">": "<", "≥": "≤" };
const toggle: Record<Op, Op> = { "<": "≤", "≤": "<", ">": "≥", "≥": ">" };
const rightward = (op: Op) => op === ">" || op === "≥";
const closed = (op: Op) => op === "≤" || op === "≥";
type Ray = { c: number; op: Op };
function rayCandidate(
  ray: Ray,
  window: [number, number],
  labels: number[],
  feedback?: (name: string) => string,
): Candidate {
  const right = rightward(ray.op),
    open = !closed(ray.op);
  return {
    description: `${open ? "An open" : "A closed"} circle at ${signed(ray.c)} with the ray shaded to the ${right ? "right" : "left"}.`,
    scene: numberLine({ min: window[0], max: window[1], step: 1, labels })
      .interval(right ? ray.c : null, right ? null : ray.c, [
        right && open,
        !right && open,
      ])
      .scene(STRIP),
    ...(feedback ? { feedback } : {}),
  };
}
const rayTex = (ray: Ray) => `x ${texOp[ray.op]} ${ray.c}`;
const termTex = (a: number) => `${a === 1 ? "" : a === -1 ? "-" : a}x`;
function inequalityNumberLine(seed: string): GeneratedProblem {
  const meta = figureChoiceTemplates[2]!;
  const r = random(meta.id, seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const twoStep = r(0, 2) > 0;
    // A negative coefficient most of the time: dividing by it flips the sign.
    const a = r(0, 3) > 0 ? -r(2, 5) : r(2, 5);
    const solution = nonzero(r, 1, 6);
    const op = pick(r, OPS);
    const b = twoStep ? nonzero(r, 1, 9) : 0;
    const c = a * solution + b;
    // ax + b (op) c  →  x (op′) (c − b)/a, flipped when a < 0.
    const answer: Ray = { c: solution, op: a < 0 ? flip[op] : op };
    const slip: Ray = twoStep
      ? // Inverse operation slip: added b instead of subtracting it.
        { c: (c + b) / a, op: answer.op }
      : // Sign slip: dropped the negative when dividing.
        { c: -solution, op: answer.op };
    // Boundaries two or more apart keep their labels clear of each other.
    if (!Number.isInteger(slip.c) || Math.abs(slip.c - solution) < 2) continue;
    const lo = Math.min(solution, slip.c) - 3,
      hi = Math.max(solution, slip.c) + 3;
    if (hi - lo > 14) continue;
    const window: [number, number] = [lo, hi];
    // Every card labels the same numbers: the window's ends, each card's
    // boundary and 0 when it has room. Ticks mark every integer.
    const boundaries = [solution, slip.c];
    const labels = [
      ...new Set([
        lo,
        hi,
        ...boundaries,
        ...([lo, hi, ...boundaries].every((v) => Math.abs(v) >= 2) ? [0] : []),
      ]),
    ].sort((x, y) => x - y);
    const statement = `${termTex(a)}${b === 0 ? "" : b < 0 ? ` - ${-b}` : ` + ${b}`} ${texOp[op]} ${c}`;
    const correct = rayCandidate(answer, window, labels);
    const reversed: Ray = { c: solution, op: flip[answer.op] };
    const distractors = [
      rayCandidate(reversed, window, labels, (name) =>
        a < 0
          ? `${name} shows $${rayTex(reversed)}$: the inequality sign was not reversed when both sides were divided by ${signed(a)}.`
          : `${name} points the wrong way: $${rayTex(answer)}$ means numbers ${rightward(answer.op) ? "greater" : "less"} than ${signed(solution)}.`,
      ),
      rayCandidate(
        { c: solution, op: toggle[answer.op] },
        window,
        labels,
        (name) =>
          `${name} has ${closed(answer.op) ? "an open" : "a closed"} circle, but ${signed(solution)} ${closed(answer.op) ? "is" : "is not"} a solution: the sign is ${answer.op === "≤" || answer.op === "≥" ? "“or equal to”" : "strict"}.`,
      ),
      rayCandidate(slip, window, labels, (name) =>
        twoStep
          ? `${name} starts at ${signed(slip.c)}: it adds ${signed(b)} to ${signed(c)} instead of subtracting it. Undo $${b < 0 ? `- ${-b}` : `+ ${b}`}$ first: ${signed(c)} ${b < 0 ? "+" : "−"} ${Math.abs(b)} = ${signed(c - b)}.`
          : `${name} starts at ${signed(slip.c)}: the sign was lost in ${signed(c)} ÷ ${signed(a)} = ${signed(solution)}.`,
      ),
    ];
    const steps = [
      ...(twoStep
        ? [
            `${b < 0 ? "Add" : "Subtract"} ${Math.abs(b)} ${b < 0 ? "to" : "from"} both sides: $${termTex(a)} ${texOp[op]} ${c - b}$.`,
          ]
        : []),
      `Divide both sides by ${signed(a)}${a < 0 ? `, and reverse the inequality sign because ${signed(a)} is negative` : ""}: $${rayTex(answer)}$.`,
      `${closed(answer.op) ? `${signed(solution)} is a solution, so its circle is closed` : `${signed(solution)} is not a solution, so its circle is open`}, and the ray points ${rightward(answer.op) ? "right, toward greater numbers" : "left, toward lesser numbers"}.`,
    ];
    return problemOf(meta, seed, r, {
      prompt: `Which number line shows the solutions of $${statement}$?`,
      label: "Choose the number line",
      noun: "Number line",
      correct,
      distractors,
      hint: twoStep
        ? `Undo the ${b < 0 ? `subtraction of ${-b}` : `addition of ${b}`} first, then divide by ${signed(a)}.${a < 0 ? " Dividing by a negative number reverses the inequality sign." : ""}`
        : `Divide both sides by ${signed(a)}.${a < 0 ? " Dividing by a negative number reverses the inequality sign." : ""} Then decide whether the boundary itself is a solution.`,
      explanation: (name) => [...steps, `${name} shows $${rayTex(answer)}$.`],
      walkthrough: numberLine({ min: lo, max: hi, step: 1 })
        .interval(
          rightward(answer.op) ? answer.c : null,
          rightward(answer.op) ? null : answer.c,
          [
            rightward(answer.op) && !closed(answer.op),
            !rightward(answer.op) && !closed(answer.op),
          ],
        )
        .scene({
          title: `The solutions of x ${answer.op} ${signed(solution)}`,
          width: 320,
          maxHeight: 120,
        }),
    });
  }
  throw new Error(`${meta.id}: no instance for ${seed}`);
}

/* ---------- parabolas and exponentials ---------- */
/** A square plane: unit gridlines and a label every 2 units. */
function curvePlane(x: [number, number], y: [number, number]) {
  return graph({
    x,
    y,
    grid: 1,
    tick: 2,
    aspect: (x[1] - x[0]) / (y[1] - y[0]),
    axisNames: ["x", "y"],
  });
}
const PARABOLA_X: [number, number] = [-6, 6];
const PARABOLA_Y: [number, number] = [-6, 6];
const EXP_X: [number, number] = [-4, 4];
type Parabola = { a: Q; h: number; k: number };
const opens = (p: Parabola) => (p.a.n > 0 ? "opening up" : "opening down");
function parabolaCandidate(
  p: Parabola,
  feedback?: (name: string) => string,
): Candidate {
  const plot = curvePlane(PARABOLA_X, PARABOLA_Y)
    .curve(fn.vertex(value(p.a), p.h, p.k), { color: "accent" })
    .point(p.h, p.k, undefined, { color: "accent" });
  return {
    description: `A parabola ${opens(p)} with its vertex at ${point([p.h, p.k])}.`,
    scene: sceneOf(plot).build(CARD),
    ...(feedback ? { feedback } : {}),
  };
}
const shiftTex = (h: number) => (h < 0 ? `x + ${-h}` : `x - ${h}`);
const vertexTex = (p: Parabola) =>
  `y = ${coef(p.a)}(${shiftTex(p.h)})^2${p.k < 0 ? ` - ${-p.k}` : ` + ${p.k}`}`;
type Growth = { a: number; b: Q };
const at = (g: Growth, x: number) => {
  let v = q(g.a);
  const base = x >= 0 ? g.b : inv(g.b);
  for (let i = 0; i < Math.abs(x); i++) v = mul(v, base);
  return v;
};
const EXP_Y: [number, number] = [-2, 12];
function exponentialCandidate(
  g: Growth,
  feedback?: (name: string) => string,
): Candidate {
  const second = [1, -1, 2, -2]
    .map((x) => [x, at(g, x)] as const)
    .find(([, y]) => y.d === 1 && y.n <= EXP_Y[1])!;
  const pts: [Pt, Pt] = [
    [0, g.a],
    [second[0], second[1].n],
  ].sort((p, s) => p[0]! - s[0]!) as [Pt, Pt];
  const grows = value(g.b) > 1;
  const plot = curvePlane(EXP_X, EXP_Y)
    .curve(fn.exp(g.a, value(g.b)), { color: "accent" })
    .point(pts[0][0], pts[0][1], undefined, { color: "accent" })
    .point(pts[1][0], pts[1][1], undefined, { color: "accent" });
  return {
    description: `A curve through ${point(pts[0])} and ${point(pts[1])}, ${grows ? "rising" : "falling"} from left to right and leveling off toward the x-axis on the ${grows ? "left" : "right"}.`,
    scene: sceneOf(plot).build(CARD),
    ...(feedback ? { feedback } : {}),
  };
}
function straightCandidate(
  from: Pt,
  to: Pt,
  feedback: (name: string) => string,
): Candidate {
  const plot = curvePlane(EXP_X, EXP_Y)
    .line({ through: [from, to] }, { color: "accent" })
    .point(from[0], from[1], undefined, { color: "accent" })
    .point(to[0], to[1], undefined, { color: "accent" });
  return {
    description: `A straight line through ${point(from)} and ${point(to)}, ${to[1] > from[1] ? "rising" : "falling"} from left to right.`,
    scene: sceneOf(plot).build(CARD),
    feedback,
  };
}
const GROWTH: readonly Growth[] = [
  { a: 1, b: q(2) },
  { a: 2, b: q(2) },
  { a: 3, b: q(2) },
  { a: 1, b: q(3) },
  { a: 2, b: q(3) },
  { a: 2, b: q(1, 2) },
  { a: 4, b: q(1, 2) },
  { a: 8, b: q(1, 2) },
  { a: 3, b: q(1, 3) },
  { a: 9, b: q(1, 3) },
];
const expTex = (g: Growth) =>
  `y = ${g.a === 1 ? "" : `${g.a} \\cdot `}${g.b.d === 1 ? g.b.n : `\\left(${tex(g.b)}\\right)`}^x`;

function quadraticOrExponential(seed: string): GeneratedProblem {
  const meta = figureChoiceTemplates[3]!;
  const r = random(meta.id, seed);
  const variant = r(0, 2);
  if (variant === 0) {
    const a = pick(r, [q(1), q(-1), q(2), q(-2), q(1, 2), q(-1, 2)]);
    const h = nonzero(r, 1, 3),
      k = nonzero(r, 1, 4);
    const p: Parabola = { a, h, k };
    const rule = `$${vertexTex(p)}$`;
    return problemOf(meta, seed, r, {
      prompt: `Which graph shows ${rule}?`,
      label: "Choose the graph",
      noun: "Graph",
      correct: parabolaCandidate(p),
      distractors: [
        parabolaCandidate(
          { a, h: -h, k },
          (name) =>
            `${name} has its vertex at ${point([-h, k])}: the horizontal shift goes the wrong way. In $(${shiftTex(h)})^2$ the vertex is where $${shiftTex(h)} = 0$, at $x = ${h}$.`,
        ),
        parabolaCandidate(
          { a: neg(a), h, k },
          (name) =>
            `${name} opens ${a.n > 0 ? "down" : "up"}, but $a = ${tex(a)}$ is ${a.n > 0 ? "positive" : "negative"}, so the parabola opens ${a.n > 0 ? "up" : "down"}.`,
        ),
        parabolaCandidate(
          { a, h, k: -k },
          (name) =>
            `${name} has its vertex at ${point([h, -k])}: the vertical shift goes the wrong way. ${k < 0 ? `$- ${-k}$` : `$+ ${k}$`} moves the graph ${k > 0 ? "up" : "down"} ${Math.abs(k)}.`,
        ),
      ],
      hint: `In $y = a(x - h)^2 + k$ the vertex is $(h, k)$ and the sign of $a$ says which way it opens. Read $h$, $k$ and $a$ from ${rule}, watching the signs.`,
      explanation: (name) => [
        `${rule} has the form $y = a(x - h)^2 + k$ with $a = ${tex(a)}$, $h = ${h}$ and $k = ${k}$.`,
        `The vertex is ${point([h, k])}, and since $a$ is ${a.n > 0 ? "positive" : "negative"} the parabola opens ${a.n > 0 ? "up" : "down"}.`,
        `${name} is the parabola ${opens(p)} with its vertex at ${point([h, k])}.`,
      ],
      walkthrough: sceneOf(
        curvePlane(PARABOLA_X, PARABOLA_Y).curve(fn.vertex(value(a), h, k), {
          color: "accent",
          features: ["vertex"],
          featureLabels: "shown",
        }),
      ).build({
        title: "The parabola and its vertex",
        width: 300,
        maxHeight: 300,
      }),
    });
  }
  if (variant === 1) {
    const g = pick(r, GROWTH);
    const rule = `$${expTex(g)}$`;
    const grows = value(g.b) > 1;
    const ab = at(g, 1);
    return problemOf(meta, seed, r, {
      prompt: `Which graph shows ${rule}?`,
      label: "Choose the graph",
      noun: "Graph",
      correct: exponentialCandidate(g),
      distractors: [
        exponentialCandidate(
          { a: g.a, b: inv(g.b) },
          (name) =>
            `${name} ${grows ? "falls" : "rises"} from left to right, so its factor is ${plain(inv(g.b))}. A factor of ${plain(g.b)} is ${grows ? "greater" : "less"} than 1: the graph ${grows ? "rises (growth)" : "falls (decay)"}.`,
        ),
        exponentialCandidate(
          { a: ab.n, b: g.b },
          (name) =>
            `${name} crosses the $y$-axis at ${point([0, ab.n])}, the value at $x = 1$. The $y$-intercept is the value at $x = 0$: $${g.a === 1 ? "" : `${g.a} \\cdot `}(${tex(g.b)})^0 = ${g.a}$.`,
        ),
        straightCandidate(
          [0, g.a],
          [1, ab.n],
          (name) =>
            `${name} is a straight line: it changes by the same amount each step. An exponential function multiplies by ${plain(g.b)} each step, so its graph curves.`,
        ),
      ],
      hint: `Find the $y$-intercept of ${rule} by putting $x = 0$, then decide whether multiplying by ${plain(g.b)} each step makes the graph rise or fall.`,
      explanation: (name) => [
        `At $x = 0$, $y = ${g.a}$, so the graph crosses the $y$-axis at ${point([0, g.a])}.`,
        `Each step to the right multiplies $y$ by ${plain(g.b)}, so at $x = 1$, $y = ${plain(ab)}$. Since ${plain(g.b)} is ${grows ? "greater" : "less"} than 1, the graph ${grows ? "rises ever faster to the right and levels off toward the $x$-axis on the left" : "falls toward the $x$-axis on the right"}.`,
        `${name} is that curve, through ${point([0, g.a])} and ${point([1, ab.n])}.`,
      ],
      walkthrough: sceneOf(
        curvePlane(EXP_X, EXP_Y)
          .curve(fn.exp(g.a, value(g.b)), { color: "accent" })
          .point(0, g.a, undefined, { color: "accent" })
          .point(1, ab.n, undefined, { color: "accent" }),
      ).build({ title: "The exponential graph", width: 300, maxHeight: 300 }),
    });
  }
  // The graph of f(x) = x² is given; choose the graph of f(x − h) + k.
  for (let attempt = 0; attempt < 50; attempt++) {
    const h = nonzero(r, 1, 3),
      k = nonzero(r, 1, 3);
    if (Math.abs(h) === Math.abs(k)) continue;
    const one = q(1);
    const shifted = `$y = f(${shiftTex(h)})${k < 0 ? ` - ${-k}` : ` + ${k}`}$`;
    return problemOf(meta, seed, r, {
      prompt: `The graph of $y = f(x)$, with $f(x) = x^2$, is shown. Which graph shows ${shifted}?`,
      label: "Choose the graph",
      noun: "Graph",
      figure: {
        kind: "scene",
        scene: sceneOf(
          curvePlane(PARABOLA_X, PARABOLA_Y)
            .curve(fn.vertex(1, 0, 0), { color: "ink", label: "f" })
            .point(0, 0, undefined, { color: "ink" }),
        ).build({ title: "The graph of y = f(x)", width: 300, maxHeight: 260 }),
      },
      correct: parabolaCandidate({ a: one, h, k }),
      distractors: [
        parabolaCandidate(
          { a: one, h: -h, k },
          (name) =>
            `${name} moves the graph ${h > 0 ? "left" : "right"} ${Math.abs(h)}. Replacing $x$ by $${shiftTex(h)}$ moves it ${h > 0 ? "right" : "left"}: the vertex is where $${shiftTex(h)} = 0$.`,
        ),
        parabolaCandidate(
          { a: one, h, k: -k },
          (name) =>
            `${name} moves the graph ${k > 0 ? "down" : "up"} ${Math.abs(k)}. ${k > 0 ? `Adding ${k}` : `Subtracting ${-k}`} outside $f$ moves every output ${k > 0 ? "up" : "down"} ${Math.abs(k)}.`,
        ),
        parabolaCandidate(
          { a: one, h: k, k: h },
          (name) =>
            `${name} swaps the shifts: it moves ${Math.abs(k)} ${k > 0 ? "right" : "left"} and ${Math.abs(h)} ${h > 0 ? "up" : "down"}. The change inside $f$ is horizontal; the change outside is vertical.`,
        ),
      ],
      hint: `The change inside $f$, $${shiftTex(h)}$, moves the graph horizontally; the change outside, ${k < 0 ? `$- ${-k}$` : `$+ ${k}$`}, moves it vertically. Follow the vertex ${point([0, 0])}.`,
      explanation: (name) => [
        `Replacing $x$ by $${shiftTex(h)}$ moves the graph ${Math.abs(h)} ${h > 0 ? "right" : "left"}; ${k > 0 ? `adding ${k}` : `subtracting ${-k}`} outside $f$ shifts it ${k > 0 ? "up" : "down"} by ${Math.abs(k)}.`,
        `The vertex moves from ${point([0, 0])} to ${point([h, k])}, and the parabola still opens up.`,
        `${name} is the parabola with its vertex at ${point([h, k])}.`,
      ],
      walkthrough: sceneOf(
        curvePlane(PARABOLA_X, PARABOLA_Y)
          .curve(fn.vertex(1, 0, 0), { color: "ink", dash: "dash" })
          .curve(fn.vertex(1, h, k), { color: "accent" })
          .segment([0, 0], [h, k], { arrow: true, color: "warm" }),
      ).build({ title: "The shifted parabola", width: 300, maxHeight: 300 }),
    });
  }
  throw new Error(`${meta.id}: no instance for ${seed}`);
}

const generators: Record<string, (seed: string) => GeneratedProblem> = {
  "graph-of-linear-rule": linearRule,
  "graph-of-proportional-rate": rateWithAxes,
  "graph-of-inequality-number-line": inequalityNumberLine,
  "graph-of-quadratic-or-exponential": quadraticOrExponential,
};
export function generateFigureChoiceProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate)
    throw new Error(`Unknown figure-choice template ${templateId}`);
  return generate(seed);
}
