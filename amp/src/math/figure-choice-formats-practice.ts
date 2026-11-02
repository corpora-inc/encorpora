import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import { f as fn, graph, lineTable, scene as sceneOf } from "./scene/author";
import { CARD, problemOf, type Candidate } from "./figure-choice-practice";
import { axisRecord, chooseAxes, defineAxis } from "./variation/axes";

/** Families answered by choosing one of several drawn graphs
 * (figure-choice-v1) whose options are SETS OF POINTS or SHIFTED COPIES of a
 * shown graph: the graph of a table or relationship, the grid point of a
 * signed pair, and the graph of a translated function. Every distractor is
 * one named misconception drawn from the same model as the correct figure. */
const figures = {
  requiredResponseCapability: "figure-choice-v1" as const,
  requiredFigureCapability: "scenes-v1" as const,
};
export const figureChoiceFormatsTemplates: readonly TemplateMetadata[] = [
  {
    id: "graph-of-paired-values",
    version: 1,
    title: "Choose the graph of paired values",
    skillId: "coordinate-first-quadrant",
    gradeBand: "3–5",
    ...figures,
    description:
      "Choose the first-quadrant graph whose points are every pair of a table, or the pairs of a stated relationship (a multiple with a decimal multiplier, or a number more or less than $x$), among graphs with the coordinates swapped, a pair left out or the wrong operation applied.",
  },
  {
    id: "point-on-signed-grid",
    version: 1,
    title: "Choose the graph of a signed point",
    skillId: "coordinate-four-quadrants",
    gradeBand: "6–8",
    ...figures,
    description:
      "Choose the graph that shows one point given as an ordered pair of signed numbers or as distances from the axes, among points with a sign flipped or the coordinates swapped.",
  },
  {
    id: "graph-after-shift",
    version: 1,
    title: "Choose the graph of a shifted graph",
    skillId: "function-transformations",
    gradeBand: "9–12",
    ...figures,
    description:
      "From the graph of $f$, choose the graph of $f(x) + k$, $f(x - h)$ or both, or of $f$ moved up, down, left or right, for a line, an absolute-value graph, a parabola or a zigzag, among graphs moved the wrong way or only partly.",
  },
];

type Pt = [number, number];
const signed = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const point = ([x, y]: Pt) => `(${signed(x)}, ${signed(y)})`;
const num = (n: number) => `${Number(n.toFixed(4))}`;
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const sample = <T>(r: Random, items: readonly T[], count: number) =>
  shuffle(r, [...items]).slice(0, count);
const list = (items: readonly string[]) =>
  items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const unitsOf = (n: number) => `${n} ${n === 1 ? "unit" : "units"}`;

/** Three or four distinct distractors from a pool, redrawing on a short pool. */
function chooseDistractors(
  r: Random,
  pool: readonly (Candidate & { key: string })[],
  exclude: readonly string[],
  count = 3,
): Candidate[] {
  const seen = new Set(exclude);
  const unique = shuffle(r, [...pool]).filter(
    (c) => !seen.has(c.key) && seen.add(c.key),
  );
  if (unique.length < count) throw new Error("Need three distractors");
  return unique.slice(0, count);
}

/* ---------- graphs of paired values ---------- */
const WINDOW = 12;
export const pairedAxes = {
  "pairs-source": defineAxis("pairs-source", [
    "table",
    "times-rule",
    "shift-rule",
  ]),
} as const;
const TIMES_CONTEXTS = [
  {
    x: "Bags",
    y: "Dollars",
    xd: "the number of bags",
    yd: "the cost in dollars",
  },
  {
    x: "Hours",
    y: "Miles",
    xd: "the number of hours",
    yd: "the distance in miles",
  },
  {
    x: "Weeks",
    y: "Books",
    xd: "the number of weeks",
    yd: "the number of books",
  },
  {
    x: "Days",
    y: "Pages",
    xd: "the number of days",
    yd: "the number of pages",
  },
  {
    x: "Boxes",
    y: "Pencils",
    xd: "the number of boxes",
    yd: "the number of pencils",
  },
] as const;
const SHIFT_CONTEXTS = [
  {
    x: "Before",
    y: "After",
    xd: "the price before the coupon",
    yd: "the price after the coupon",
    less: true,
  },
  {
    x: "Before",
    y: "After",
    xd: "the score before the penalty",
    yd: "the score after the penalty",
    less: true,
  },
  {
    x: "Mia",
    y: "Ben",
    xd: "the number of stickers Mia has",
    yd: "the number of stickers Ben has",
    less: false,
  },
  {
    x: "Last year",
    y: "This year",
    xd: "the number of students last year",
    yd: "the number of students this year",
    less: false,
  },
] as const;

function pairsPlot(names: readonly [string, string]) {
  return graph({
    x: [0, WINDOW],
    y: [0, WINDOW],
    grid: 1,
    tick: 2,
    aspect: 1,
    axisNames: [names[0], names[1]],
  });
}
const pairsKey = (pairs: readonly Pt[]) =>
  JSON.stringify([...pairs].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
function pairsCandidate(
  pairs: readonly Pt[],
  names: readonly [string, string],
  feedback?: (name: string) => string,
): Candidate & { key: string } {
  let plot = pairsPlot(names);
  for (const [x, y] of pairs)
    plot = plot.point(x, y, undefined, { color: "accent" });
  return {
    key: pairsKey(pairs),
    description: `Points at ${list(pairs.map(point))}.`,
    scene: sceneOf(plot).build(CARD),
    ...(feedback ? { feedback } : {}),
  };
}
const inPairsWindow = (pairs: readonly Pt[]) =>
  pairs.every(([x, y]) => x >= 0 && y >= 0 && x <= WINDOW && y <= WINDOW);

function graphOfPairedValues(seed: string, salt: string): GeneratedProblem {
  const meta = figureChoiceFormatsTemplates[0]!;
  const r = random(meta.id, salt);
  const axes = chooseAxes(meta.id, seed, pairedAxes);
  const source = axes["pairs-source"];
  let ctx: { x: string; y: string; xd: string; yd: string };
  let pairs: Pt[] = [];
  let prompt: string;
  let figure: SemanticFigure | undefined;
  let hint: string;
  let steps: string[];
  // Built into candidates once the axis names are known.
  type Plan = {
    name: string;
    make: (n: [string, string]) => Candidate & { key: string };
  };
  const plans: Plan[] = [];
  if (source === "table") {
    ctx = pick(r, TIMES_CONTEXTS);
    const count = pick(r, [3, 3, 4, 5, 6, 7]);
    const xs = sample(r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], count).sort(
      (a, b) => a - b,
    );
    let ys: number[];
    do ys = xs.map(() => r(1, 10));
    while (ys.filter((y, i) => y !== xs[i]).length < 2 || new Set(ys).size < 2);
    pairs = xs.map((x, i) => [x, ys[i]!] as Pt);
    figure = {
      kind: "scene",
      scene: lineTable(
        [
          ["x", ...xs.map(String)],
          ["y", ...ys.map(String)],
        ],
        { header: "column" },
      ).scene({ title: "Table of x and y values" }),
    };
    prompt = `The table shows $x$, ${ctx.xd}, and $y$, ${ctx.yd}. Which graph plots every pair in the table?`;
    hint = `Plot each pair as $(x, y)$: the first number says how far to the right and the second how far up. Start with $x = ${xs[0]}$ and read the $y$ below it in the table.`;
    steps = pairs.map(
      ([x, y]) =>
        `For $x = ${x}$ the table gives $y = ${y}$: the point ${point([x, y])}.`,
    );
    plans.push(
      {
        name: "swapped",
        make: (n: [string, string]) =>
          pairsCandidate(
            pairs.map(([x, y]) => [y, x] as Pt),
            n,
            (name) =>
              `${name} swaps the coordinates: it plots ${point([pairs[0]![1], pairs[0]![0]])} where the table gives ${point(pairs[0]!)}. The first number of a pair is the $x$-value.`,
          ),
      },
      {
        name: "shifted-rows",
        make: (n: [string, string]) =>
          pairsCandidate(
            pairs.map(([x], i) => [x, pairs[(i + 1) % pairs.length]![1]] as Pt),
            n,
            (name) =>
              `${name} pairs each $x$ with the $y$ from the next column. Each $y$ belongs to the $x$ above it in the same column.`,
          ),
      },
      {
        name: "left-out",
        make: (n: [string, string]) =>
          pairsCandidate(
            pairs.slice(0, -1),
            n,
            (name) =>
              `${name} leaves out the last pair, ${point(pairs.at(-1)!)}. Every column of the table is a point.`,
          ),
      },
      {
        name: "reversed-ys",
        make: (n: [string, string]) =>
          pairsCandidate(
            pairs.map(([x], i) => [x, pairs[pairs.length - 1 - i]![1]] as Pt),
            n,
            (name) =>
              `${name} reads the $y$-row from right to left, so the $y$-values land under the wrong $x$-values.`,
          ),
      },
    );
  } else if (source === "times-rule") {
    ctx = pick(r, TIMES_CONTEXTS);
    const c = pick(r, [1.5, 1.5, 2, 3, 4, 0.5]);
    const xChoices =
      c === 1.5 || c === 0.5
        ? [2, 4, 6, 8]
        : c === 2
          ? [1, 2, 3, 4, 5, 6]
          : [1, 2, 3];
    const xs = sample(r, xChoices, 3).sort((a, b) => a - b);
    pairs = xs.map((x) => [x, c * x] as Pt);
    // Adding c agrees with multiplying at one x (x = 2 when c = 2): name an x where they differ.
    const differing = xs.find((x) => x + c !== c * x) ?? xs[0]!;
    prompt = `${cap(ctx.yd)}, $y$, is ${num(c)} times ${ctx.xd}, $x$. Which graph shows the pairs for ${list(xs.map((x) => `$x = ${x}$`))}?`;
    hint = `For each $x$, multiply it by ${num(c)} to get $y$. Start with $x = ${xs[0]}$, then plot the pair: right ${xs[0]}, up by the $y$ you found.`;
    steps = [
      `Each $y$ is ${num(c)} times $x$.`,
      ...pairs.map(
        ([x, y]) =>
          `$${num(c)} \\cdot ${x} = ${num(y)}$, so $x = ${x}$ gives the point ${point([x, y])}.`,
      ),
    ];
    plans.push(
      {
        name: "swapped",
        make: (n: [string, string]) =>
          pairsCandidate(
            pairs.map(([x, y]) => [y, x] as Pt),
            n,
            (name) =>
              `${name} swaps the coordinates: for $x = ${xs[0]}$ it plots the point ${point([pairs[0]![1], xs[0]!])}. Put $x$ first.`,
          ),
      },
      ...(Number.isInteger(c)
        ? [
            {
              name: "adds",
              make: (n: [string, string]) =>
                pairsCandidate(
                  xs.map((x) => [x, x + c] as Pt),
                  n,
                  (name) =>
                    `${name} adds ${num(c)} to $x$ instead of multiplying by ${num(c)}: for $x = ${differing}$ it shows $y = ${num(differing + c)}$, not ${num(c * differing)}.`,
                ),
            },
            {
              name: "constant",
              make: (n: [string, string]) =>
                pairsCandidate(
                  xs.map((x) => [x, c] as Pt),
                  n,
                  (name) =>
                    `${name} plots $y = ${c}$ for every pair: it uses the multiplier ${c} itself as the second coordinate instead of multiplying $x$ by it.`,
                ),
            },
          ]
        : []),
      {
        name: "left-out",
        make: (n: [string, string]) =>
          pairsCandidate(
            pairs.slice(0, -1),
            n,
            (name) =>
              `${name} leaves out the pair for $x = ${xs.at(-1)}$. The graph shows every pair asked for.`,
          ),
      },
    );
    if (!Number.isInteger(c)) {
      plans.push(
        ...(Math.floor(c) >= 1
          ? [
              {
                name: "drops-decimal",
                make: (n: [string, string]) =>
                  pairsCandidate(
                    xs.map((x) => [x, Math.floor(c) * x] as Pt),
                    n,
                    (name) =>
                      `${name} uses ${Math.floor(c)} for the multiplier ${num(c)}: for $x = ${xs[0]}$ it shows $y = ${num(Math.floor(c) * xs[0]!)}$, not ${num(c * xs[0]!)}.`,
                  ),
              },
            ]
          : []),
        {
          name: "rounds-up",
          make: (n: [string, string]) =>
            pairsCandidate(
              xs.map((x) => [x, Math.ceil(c) * x] as Pt),
              n,
              (name) =>
                `${name} rounds the multiplier ${num(c)} up to ${Math.ceil(c)}: for $x = ${xs[0]}$ it shows $y = ${num(Math.ceil(c) * xs[0]!)}$, not ${num(c * xs[0]!)}.`,
            ),
        },
      );
    }
  } else {
    const context = pick(r, SHIFT_CONTEXTS);
    ctx = context;
    const n = r(2, 5);
    const less = context.less;
    const lo = less ? n + 1 : 1;
    const hi = less ? WINDOW : WINDOW - n;
    const xs = sample(
      r,
      Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
      3,
    ).sort((a, b) => a - b);
    const sign = less ? -1 : 1;
    pairs = xs.map((x) => [x, x + sign * n] as Pt);
    prompt = `${cap(ctx.yd)}, $y$, is ${n} ${less ? "less" : "more"} than ${ctx.xd}, $x$. Which graph shows the pairs for ${list(xs.map((x) => `$x = ${x}$`))}?`;
    hint = `For each $x$, ${less ? "take away" : "add"} ${n} to get $y$. Start with $x = ${xs[0]}$, then plot the pair: right ${xs[0]}, up by the $y$ you found.`;
    steps = [
      `Each $y$ is ${n} ${less ? "less" : "more"} than $x$: $y = x ${less ? "-" : "+"} ${n}$.`,
      ...pairs.map(
        ([x, y]) =>
          `$${x} ${less ? "-" : "+"} ${n} = ${y}$, so $x = ${x}$ gives the point ${point([x, y])}.`,
      ),
    ];
    plans.push(
      {
        name: "swapped",
        make: (nm: [string, string]) =>
          pairsCandidate(
            pairs.map(([x, y]) => [y, x] as Pt),
            nm,
            (name) =>
              `${name} swaps the coordinates: for $x = ${xs[0]}$ it plots ${point([pairs[0]![1], xs[0]!])}. Put $x$ first.`,
          ),
      },
      {
        name: "wrong-direction",
        make: (nm: [string, string]) =>
          pairsCandidate(
            xs.map((x) => [x, x - sign * n] as Pt),
            nm,
            (name) =>
              `${name} ${less ? "adds" : "subtracts"} ${n} instead of ${less ? "subtracting" : "adding"} it: for $x = ${xs[0]}$ it shows $y = ${xs[0]! - sign * n}$, not ${xs[0]! + sign * n}.`,
          ),
      },
      {
        name: "left-out",
        make: (nm: [string, string]) =>
          pairsCandidate(
            pairs.slice(0, -1),
            nm,
            (name) =>
              `${name} leaves out the pair for $x = ${xs.at(-1)}$. The graph shows every pair asked for.`,
          ),
      },
      {
        name: "constant",
        make: (nm: [string, string]) =>
          pairsCandidate(
            xs.map((x) => [x, n] as Pt),
            nm,
            (name) =>
              `${name} plots $y = ${n}$ for every pair: it uses the number ${n} itself as the second coordinate instead of ${less ? "subtracting" : "adding"} it from $x$.`,
          ),
      },
    );
  }
  const names = [ctx.x, ctx.y] as const;
  const correct = pairsCandidate(pairs, names);
  const pool = plans
    .map((p) => p.make([names[0], names[1]]))
    .filter((c) => inPairsWindow(JSON.parse(c.key) as Pt[]));
  const distractors = chooseDistractors(r, pool, [correct.key]);
  return problemOf(meta, seed, r, {
    prompt,
    label: "Choose the graph",
    noun: "Graph",
    ...(figure ? { figure } : {}),
    correct,
    distractors,
    hint,
    explanation: (name) => [
      ...steps,
      `${name} plots ${list(pairs.map(point))}.`,
    ],
    walkthrough: sceneOf(
      pairs.reduce(
        (plot, [x, y]) => plot.point(x, y, undefined, { color: "accent" }),
        pairsPlot(names),
      ),
    ).build({ title: "The pairs plotted", width: 300, maxHeight: 300 }),
  });
}

/* ---------- the graph of one signed point ---------- */
export const signedAxes = {
  "pair-form": defineAxis("pair-form", ["ordered-pair", "distances"]),
} as const;
function signedPlot() {
  return graph({
    x: [-6, 6],
    y: [-6, 6],
    grid: 1,
    tick: 2,
    aspect: 1,
    axisNames: ["x", "y"],
  });
}
function pointCandidate(
  p: Pt,
  feedback?: (name: string) => string,
): Candidate & { key: string } {
  return {
    key: point(p),
    description: `A single point at ${point(p)}.`,
    scene: sceneOf(
      signedPlot().point(p[0], p[1], undefined, { color: "accent" }),
    ).build(CARD),
    ...(feedback ? { feedback } : {}),
  };
}
function pointOnSignedGrid(seed: string, salt: string): GeneratedProblem {
  const meta = figureChoiceFormatsTemplates[1]!;
  const r = random(meta.id, salt);
  const form = chooseAxes(meta.id, seed, signedAxes)["pair-form"];
  const a = r(1, 6);
  let b = r(1, 5);
  if (b >= a) b++;
  const [sx, sy] = [r(0, 1) ? 1 : -1, r(0, 1) ? 1 : -1];
  // Mostly signed in both coordinates, which is where signs go wrong.
  const p: Pt = [sx * a, sy * b];
  const side = (n: number, neg: string, pos: string, axis: string) =>
    `${unitsOf(Math.abs(n))} ${n < 0 ? neg : pos} the ${axis}`;
  const prompt =
    form === "ordered-pair"
      ? `Which graph shows the point $(${p[0]}, ${p[1]})$?`
      : `Which graph shows the point that is ${side(p[0], "to the left of", "to the right of", "$y$-axis")} and ${side(p[1], "below", "above", "$x$-axis")}?`;
  const flipX: Pt = [-p[0], p[1]];
  const flipY: Pt = [p[0], -p[1]];
  const both: Pt = [-p[0], -p[1]];
  const swapped: Pt = [p[1], p[0]];
  const where = (q: Pt) => point(q);
  const pool = [
    pointCandidate(
      flipX,
      (name) =>
        `${name} shows ${where(flipX)}: the $x$-coordinate has the wrong sign. ${p[0] < 0 ? "A negative $x$ is to the left of the $y$-axis" : "A positive $x$ is to the right of the $y$-axis"}.`,
    ),
    pointCandidate(
      flipY,
      (name) =>
        `${name} shows ${where(flipY)}: the $y$-coordinate has the wrong sign. ${p[1] < 0 ? "A negative $y$ is below the $x$-axis" : "A positive $y$ is above the $x$-axis"}.`,
    ),
    pointCandidate(
      swapped,
      (name) =>
        `${name} shows ${where(swapped)}: the coordinates are swapped. The first number is $x$, the distance across, and the second is $y$, the distance up or down.`,
    ),
    pointCandidate(
      both,
      (name) =>
        `${name} shows ${where(both)}: both signs are reversed, so the point is in the opposite quadrant.`,
    ),
  ];
  const correct = pointCandidate(p);
  const distractors = chooseDistractors(r, pool, [correct.key]);
  return problemOf(meta, seed, r, {
    prompt,
    label: "Choose the graph",
    noun: "Graph",
    correct,
    distractors,
    hint:
      form === "ordered-pair"
        ? `In $(${p[0]}, ${p[1]})$ the first number, ${signed(p[0])}, tells how far to move across from the origin, and the second, ${signed(p[1])}, how far up or down. A negative number means left or down.`
        : `Start at the origin. The ${unitsOf(Math.abs(p[0]))} from the $y$-axis is a move across and the ${unitsOf(Math.abs(p[1]))} from the $x$-axis is a move up or down: decide the direction of each.`,
    explanation: (name) => [
      form === "ordered-pair"
        ? `The first coordinate, ${signed(p[0])}, is the move ${p[0] < 0 ? "left" : "right"} from the origin; the second, ${signed(p[1])}, is the move ${p[1] < 0 ? "down" : "up"}.`
        : `${unitsOf(Math.abs(p[0]))} ${p[0] < 0 ? "left of" : "right of"} the $y$-axis makes $x = ${p[0]}$; ${unitsOf(Math.abs(p[1]))} ${p[1] < 0 ? "below" : "above"} the $x$-axis makes $y = ${p[1]}$.`,
      `The point is $(${p[0]}, ${p[1]})$, in the ${p[0] > 0 ? (p[1] > 0 ? "first" : "fourth") : p[1] > 0 ? "second" : "third"} quadrant.`,
      `${name} shows the single point ${point(p)}.`,
    ],
    walkthrough: sceneOf(
      signedPlot().point(p[0], p[1], point(p), { color: "accent" }),
    ).build({ title: "The point on the grid", width: 300, maxHeight: 300 }),
  });
}

/* ---------- the graph of a shifted graph ---------- */
type Shape = "line" | "v-shape" | "parabola" | "zigzag" | "reciprocal";
export const shiftAxes = {
  "base-shape": defineAxis("base-shape", [
    "line",
    "v-shape",
    "parabola",
    "zigzag",
  ] as const),
  "shift-kind": defineAxis("shift-kind", [
    "vertical",
    "horizontal",
    "both",
  ] as const),
  phrasing: defineAxis("phrasing", ["words", "notation"] as const),
} as const;
type Base =
  | { shape: "line"; m: number; b: number }
  | { shape: "v-shape"; a: number; x: number; y: number }
  | { shape: "parabola"; a: number; x: number; y: number }
  | { shape: "zigzag"; verts: Pt[] }
  | { shape: "reciprocal"; a: number; x: number; y: number };
const LIM = 6;

/** The graph moved h to the right and k up. */
function moved(base: Base, h: number, k: number): Base {
  switch (base.shape) {
    case "line":
      return { ...base, b: base.b + k - base.m * h };
    case "zigzag":
      return {
        shape: "zigzag",
        verts: base.verts.map(([x, y]) => [x + h, y + k] as Pt),
      };
    default:
      return { ...base, x: base.x + h, y: base.y + k };
  }
}
function valueAt(base: Base, x: number): number | null {
  switch (base.shape) {
    case "line":
      return base.m * x + base.b;
    case "v-shape":
      return base.a * Math.abs(x - base.x) + base.y;
    case "parabola":
      return base.a * (x - base.x) ** 2 + base.y;
    case "reciprocal":
      return x === base.x ? null : base.a / (x - base.x) + base.y;
    case "zigzag": {
      const v = base.verts;
      if (x < v[0]![0] || x > v.at(-1)![0]) return null;
      for (let i = 0; i + 1 < v.length; i++) {
        const [p, q] = [v[i]!, v[i + 1]!];
        if (x >= p[0] && x <= q[0])
          return p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0]);
      }
      return null;
    }
  }
}
/** Two bases are the same drawing when every half-integer reads the same. */
function shapeKey(base: Base): string {
  const out: string[] = [];
  for (let i = -2 * LIM; i <= 2 * LIM; i++) {
    const v = valueAt(base, i / 2);
    out.push(v === null || Math.abs(v) > 40 ? "-" : v.toFixed(4));
  }
  return out.join(",");
}
function drawBase(
  plot: ReturnType<typeof graph>,
  base: Base,
  color: "accent" | "ink" = "accent",
  dash: "solid" | "dash" = "solid",
) {
  switch (base.shape) {
    case "line":
      return plot.line({ m: base.m, b: base.b }, { color, dash });
    case "v-shape":
      return plot.curve(fn.abs(base.a, base.x, base.y), { color, dash });
    case "parabola":
      return plot.curve(fn.vertex(base.a, base.x, base.y), { color, dash });
    case "reciprocal":
      return plot.curve(
        fn.rational([base.y, base.a - base.y * base.x], [1, -base.x]),
        { color, dash },
      );
    case "zigzag": {
      let out = plot;
      base.verts.forEach((v, i) => {
        if (i) out = out.segment(base.verts[i - 1]!, v, { color, dash });
      });
      for (const [x, y] of base.verts)
        out = out.point(x, y, undefined, { color });
      return out;
    }
  }
}
/** Lattice points of a line inside the window, left to right. */
function latticeOfLine(m: number, b: number): Pt[] {
  const out: Pt[] = [];
  for (let x = -LIM; x <= LIM; x++) {
    const y = m * x + b;
    if (Number.isInteger(y) && Math.abs(y) <= LIM) out.push([x, y]);
  }
  return out;
}
function describeBase(base: Base): string {
  switch (base.shape) {
    case "line": {
      const pts = latticeOfLine(base.m, base.b);
      if (pts.length < 2)
        throw new Error("Need a line with two lattice points");
      return `A straight line through ${point(pts[0]!)} and ${point(pts.at(-1)!)}, ${base.m > 0 ? "rising" : "falling"} from left to right.`;
    }
    case "v-shape":
      return `A V-shaped graph opening ${base.a > 0 ? "up" : "down"} with its vertex at ${point([base.x, base.y])}.`;
    case "parabola":
      return `A parabola opening ${base.a > 0 ? "up" : "down"} with its vertex at ${point([base.x, base.y])}.`;
    case "reciprocal":
      return `A curve with two branches and asymptotes at x = ${signed(base.x)} and y = ${signed(base.y)}, in the ${base.a > 0 ? "upper right and lower left" : "upper left and lower right"}.`;
    case "zigzag":
      return `A zigzag through the points ${list(base.verts.map(point))}.`;
  }
}
/** A landmark of the graph, and where it sits after a move. */
function landmark(base: Base): { text: string; at: Pt } {
  switch (base.shape) {
    case "line":
      return { text: "its $y$-intercept", at: [0, base.b] };
    case "v-shape":
    case "parabola":
      return { text: "its vertex", at: [base.x, base.y] };
    case "reciprocal":
      return {
        text: "the point where its asymptotes cross",
        at: [base.x, base.y],
      };
    case "zigzag":
      return { text: "its leftmost point", at: base.verts[0]! };
  }
}
function randomBase(r: Random, shape: Shape, h: number): Base {
  switch (shape) {
    case "line": {
      const m = pick(r, [1, -1, 2, -2, 0.5, -0.5]);
      // A half slope needs an even horizontal move to keep integer points.
      void h;
      return { shape, m, b: r(-2, 2) };
    }
    case "v-shape":
      return { shape, a: pick(r, [1, -1, 2, -2]), x: r(-2, 2), y: r(-2, 2) };
    case "parabola":
      return { shape, a: pick(r, [1, -1]), x: r(-2, 2), y: r(-2, 2) };
    case "reciprocal":
      return { shape, a: pick(r, [1, -1]), x: r(-1, 1), y: r(-1, 1) };
    case "zigzag": {
      const xs = [-2, -1, 1, 2];
      let ys: number[];
      do ys = xs.map(() => r(-2, 2));
      while (
        ys.some((y, i) => i && y === ys[i - 1]) ||
        // not a straight line: slopes must change
        new Set(ys.slice(1).map((y, i) => y - ys[i]!)).size < 2
      );
      return { shape, verts: xs.map((x, i) => [x, ys[i]!] as Pt) };
    }
  }
}
const sideWord = (n: number, pos: string, negWord: string) =>
  `${unitsOf(Math.abs(n))} ${n > 0 ? pos : negWord}`;
const moveWords = (h: number, k: number) =>
  list([
    ...(h ? [sideWord(h, "to the right", "to the left")] : []),
    ...(k ? [sideWord(k, "up", "down")] : []),
  ]);
const notation = (h: number, k: number) => {
  const inner = h === 0 ? "x" : `x ${h > 0 ? "-" : "+"} ${Math.abs(h)}`;
  const outer = k === 0 ? "" : ` ${k > 0 ? "+" : "-"} ${Math.abs(k)}`;
  return `f(${inner})${outer}`;
};
function graphAfterShift(seed: string, salt: string): GeneratedProblem {
  const meta = figureChoiceFormatsTemplates[2]!;
  const r = random(meta.id, salt);
  const axes = chooseAxes(meta.id, seed, shiftAxes);
  const kind = axes["shift-kind"];
  const shape = axes["base-shape"];
  const amount = () => (r(0, 1) ? 1 : -1) * r(1, kind === "both" ? 2 : 3);
  let h = kind === "vertical" ? 0 : amount();
  const k = kind === "horizontal" ? 0 : amount();
  const base0 = randomBase(r, shape, h);
  // A half slope keeps integer points only for an even horizontal move.
  if (base0.shape === "line" && !Number.isInteger(base0.m * h)) h *= 2;
  const base = base0;
  const place = (hh: number, kk: number) => moved(base, hh, kk);
  const candidate = (
    hh: number,
    kk: number,
    feedback?: (name: string) => string,
  ): Candidate & { key: string } => {
    const g = place(hh, kk);
    return {
      key: shapeKey(g),
      description: describeBase(g),
      scene: sceneOf(drawBase(plotWindow(), g)).build(CARD),
      ...(feedback ? { feedback } : {}),
    };
  };
  const correct = candidate(h, k);
  const mark = landmark(base);
  const newMark: Pt = [mark.at[0] + h, mark.at[1] + k];
  const moves = (hh: number, kk: number) => moveWords(hh, kk) || "nowhere";
  const pool: (Candidate & { key: string })[] = [];
  const flipped = (what: string, hh: number, kk: number) => (name: string) =>
    `${name} is the graph moved ${moves(hh, kk)}: ${what}. The correct move is ${moves(h, k)}.`;
  if (k !== 0)
    pool.push(
      candidate(h, -k, flipped("the vertical move goes the wrong way", h, -k)),
    );
  if (h !== 0)
    pool.push(
      candidate(
        -h,
        k,
        flipped(
          axes.phrasing === "notation"
            ? "inside the parentheses $f(x - h)$ moves the graph to the right and $f(x + h)$ to the left, the opposite of what the sign suggests"
            : "the horizontal move goes the wrong way",
          -h,
          k,
        ),
      ),
    );
  if (h !== 0 && k !== 0) {
    pool.push(
      candidate(
        h,
        0,
        flipped(
          "it makes only the horizontal move and misses the vertical one",
          h,
          0,
        ),
      ),
      candidate(
        0,
        k,
        flipped(
          "it makes only the vertical move and misses the horizontal one",
          0,
          k,
        ),
      ),
      candidate(
        k,
        h,
        flipped(
          "it swaps the two moves: the horizontal amount is used vertically and the vertical amount horizontally",
          k,
          h,
        ),
      ),
    );
  } else if (h === 0) {
    pool.push(
      candidate(
        k,
        0,
        flipped("it moves the graph sideways instead of up or down", k, 0),
      ),
      candidate(
        -k,
        0,
        flipped("it moves the graph sideways instead of up or down", -k, 0),
      ),
    );
  } else {
    pool.push(
      candidate(
        0,
        h,
        flipped("it moves the graph up or down instead of sideways", 0, h),
      ),
      candidate(
        0,
        -h,
        flipped("it moves the graph up or down instead of sideways", 0, -h),
      ),
    );
  }
  const distractors = chooseDistractors(r, pool, [correct.key]);
  const rule = notation(h, k);
  const prompt =
    axes.phrasing === "notation"
      ? `The graph of $y = f(x)$ is shown. Which graph shows $y = ${rule}$?`
      : `The graph of $y = f(x)$ is shown. Which graph shows the graph of $f$ moved ${moves(h, k)}?`;
  const originalFigure: SemanticFigure = {
    kind: "scene",
    scene: sceneOf(drawBase(plotWindow(), base, "ink")).build({
      title: "The graph of y = f(x)",
      width: 230,
      maxHeight: 230,
    }),
  };
  return problemOf(meta, seed, r, {
    prompt,
    label: "Choose the graph",
    noun: "Graph",
    figure: originalFigure,
    correct,
    distractors,
    hint:
      axes.phrasing === "notation"
        ? `For $${rule}$, follow ${mark.text}, ${point(mark.at)}, of the original graph. Outside the function, $+$ moves up and $-$ moves down; inside the parentheses, $x - h$ moves right and $x + h$ moves left. Decide where ${point(mark.at)} goes.`
        : `Follow ${mark.text}, ${point(mark.at)}, of the original graph. Move it ${moves(h, k)} and find the graph that passes through its new position.`,
    explanation: (name) => [
      "Shifting a graph slides every point the same distance in the same direction. The shape does not change.",
      ...(axes.phrasing === "notation" && h !== 0
        ? [
            `Inside the parentheses the move is opposite to the sign: $f(x ${h > 0 ? "-" : "+"} ${Math.abs(h)})$ gives at $x = ${h}$ what $f$ gave at $x = 0$. So every point moves ${unitsOf(Math.abs(h))} to the ${h > 0 ? "right" : "left"}.`,
          ]
        : []),
      axes.phrasing === "notation"
        ? `In $${rule}$, ${[
            ...(h !== 0
              ? [
                  `$x ${h > 0 ? "-" : "+"} ${Math.abs(h)}$ inside the parentheses moves the graph ${unitsOf(Math.abs(h))} to the ${h > 0 ? "right" : "left"}`,
                ]
              : []),
            ...(k !== 0
              ? [
                  `${k > 0 ? "adding" : "subtracting"} ${Math.abs(k)} outside moves it ${unitsOf(Math.abs(k))} ${k > 0 ? "up" : "down"}`,
                ]
              : []),
          ].join(" and ")}.`
        : `The whole graph moves ${moves(h, k)}.`,
      `So ${[
        ...(h !== 0
          ? [
              `${h > 0 ? "add" : "subtract"} ${Math.abs(h)} ${h > 0 ? "to" : "from"} every $x$-coordinate`,
            ]
          : []),
        ...(k !== 0
          ? [
              `${k > 0 ? "add" : "subtract"} ${Math.abs(k)} ${k > 0 ? "to" : "from"} every $y$-coordinate`,
            ]
          : []),
      ].join(" and ")}.`,
      `${cap(mark.text)}, ${point(mark.at)}, moves to ${point(newMark)}.`,
      `${name} is the graph moved ${moves(h, k)}: ${describeBase(place(h, k)).replace(/^A /, "a ").replace(/\.$/, "")}.`,
    ],
    walkthrough: sceneOf(
      drawBase(drawBase(plotWindow(), base, "ink", "dash"), place(h, k)),
    ).build({
      title: "The graph and its moved copy",
      width: 300,
      maxHeight: 300,
    }),
  });
}
function plotWindow() {
  return graph({
    x: [-LIM, LIM],
    y: [-LIM, LIM],
    grid: 1,
    tick: 2,
    aspect: 1,
    axisNames: ["x", "y"],
  });
}

const generators: Record<
  string,
  (seed: string, salt: string) => GeneratedProblem
> = {
  "graph-of-paired-values": graphOfPairedValues,
  "point-on-signed-grid": pointOnSignedGrid,
  "graph-after-shift": graphAfterShift,
};
/** The surface axes of each template, for tests and evidence. */
export const figureChoiceFormatsAxes = {
  "graph-of-paired-values": pairedAxes,
  "point-on-signed-grid": signedAxes,
  "graph-after-shift": shiftAxes,
} as const;
export function generateFigureChoiceFormatsProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate)
    throw new Error(`Unknown figure-choice template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  // A draw that cannot make three distinct distractors is redrawn from a
  // salted stream; the saved seed and the axis values never change.
  let problem: GeneratedProblem | undefined;
  for (let attempt = 0; attempt < 40 && !problem; attempt++)
    try {
      problem = generate(seed, attempt ? `${seed}#${attempt}` : seed);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  if (!problem) throw new Error(`${templateId}: no instance for ${seed}`);
  const axes = chooseAxes(
    templateId,
    seed,
    figureChoiceFormatsAxes[templateId as keyof typeof figureChoiceFormatsAxes],
  );
  return {
    ...problem,
    variant: {
      id: Object.values(axes).join("-"),
      axes: axisRecord(axes as Record<string, string>),
    },
  };
}
