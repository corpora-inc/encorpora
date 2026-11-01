import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  constText,
  n,
  nonzero,
  p,
  pick,
  qt,
  quotient,
  rat,
  seeded,
  shuffle,
  termText,
  type Case,
  type Choice,
  type Random,
} from "./algebra-one-kit";
import { act, polyArea, step } from "./scene/author";
import {
  fromRoots,
  parabolaOnGrid,
  shiftWalkthrough,
  shiftedParabola,
  syntheticTableau,
  zeroSlide,
  zerosGraph,
} from "./polynomial-scenes";
import { vertexGraph } from "./quadratic-scenes";
import { factorTiles } from "./tile-walkthroughs";

/** Quadratic and polynomial structure (HSF.IF.C.7–8, HSA.SSE.A, HSA.APR.B):
 * parabolas and their features, expressions read by their structure,
 * polynomial zeros, and division by x − a. Every figure is a scene. */
const choice = { requiredResponseCapability: "single-choice-v1" as const };
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const hs = { version: 1 as const, gradeBand: "9–12" as const };

export const quadraticStructureTemplates: readonly TemplateMetadata[] = [
  {
    ...hs,
    id: "parabola-vertex",
    title: "The vertex of a parabola",
    skillId: "quadratic-graphs",
    description:
      "Find a parabola's vertex from vertex form, from standard form, or from its graph.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "parabola-axis",
    title: "The axis of symmetry",
    skillId: "quadratic-graphs",
    description:
      "Find a parabola's axis of symmetry from its zeros, from two points at the same height, or from standard form.",
    ...scenes,
  },
  {
    ...hs,
    id: "parabola-shift",
    title: "Translating a parabola",
    skillId: "quadratic-graphs",
    description:
      "Connect a translation of y = x² to the equation y = (x − h)² + k, in words, on a graph and in reverse.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "binomial-area-product",
    title: "A product as an area",
    skillId: "expression-structure",
    description:
      "Expand a product of two binomials, reading each term as one region of an area model.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "structure-meaning",
    title: "What a part of a formula means",
    skillId: "expression-structure",
    description:
      "Interpret a term, coefficient or factor of a formula in its context: a launch height, a fixed fee, a growth factor.",
    ...choice,
  },
  {
    ...hs,
    id: "structure-rewrite",
    title: "Rewrite by structure",
    skillId: "expression-structure",
    description:
      "See a difference of squares or a perfect square inside an expression and rewrite it as a product.",
    ...choice,
  },
  {
    ...hs,
    id: "zeros-from-factors",
    title: "Zeros from factors",
    skillId: "polynomial-zeros",
    description:
      "Connect each linear factor of a polynomial to a zero, from factored form, from a graph, or from the zeros to the polynomial.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "zero-multiplicity",
    title: "Crossing or touching at a zero",
    skillId: "polynomial-zeros",
    description:
      "Use a factor's exponent to tell whether the graph crosses or touches the $x$-axis at that zero.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "remainder-theorem",
    title: "The remainder theorem",
    skillId: "polynomial-division",
    description:
      "Find the remainder of p(x) ÷ (x − a) as $p(a)$, or the coefficient that makes $x - a a$ factor.",
    ...scenes,
  },
  {
    ...hs,
    id: "polynomial-quotient",
    title: "Divide by a linear factor",
    skillId: "polynomial-division",
    description:
      "Divide a cubic by x − a and write the quotient and remainder, with or without the synthetic-division layout.",
    ...choice,
    ...scenes,
  },
];

// ------------------------------------------------------------------ display
const SUP = ["", "", "²", "³", "⁴"];
/** A polynomial from coefficients, highest power first: "2x³ − x + 5". */
export function polyText(desc: number[], v = "x") {
  const deg = desc.length - 1;
  const parts = desc
    .map((c, i) => [c, deg - i] as const)
    .filter(([c]) => c !== 0);
  if (!parts.length) return "0";
  return parts
    .map(([c, k], i) =>
      k === 0
        ? i === 0
          ? n(c)
          : constText(c)
        : termText(c, `${v}${SUP[k]}`, i === 0),
    )
    .join("");
}
/** "(x − 3)", "(x + 2)", "x" for the zero r; "(2x − 3)" for a·x − b. */
export const factor = (r: number) =>
  r === 0 ? "x" : `(x ${r < 0 ? "+" : "−"} ${Math.abs(r)})`;
const linFactor = (a: number, b: number) =>
  `(${termText(a, "x")}${constText(b)})`;
const pt = (x: number, y: number) => `(${n(x)}, ${n(y)})`;
const lead = (a: number) => (a === 1 ? "" : a === -1 ? "−" : n(a));
/** y = a(x − h)² + k as written. */
export const vertexForm = (a: number, h: number, k: number) =>
  `${lead(a)}${h === 0 ? "x²" : `${factor(h)}²`}${constText(k)}`;
/** The TeX of the same, for captions. */
const vertexTex = (a: number, h: number, k: number) =>
  vertexForm(a, h, k).replaceAll("²", "^2").replaceAll("−", "-");

/** Three wrong options, distinct from the correct one and from each other. */
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

// ---------------------------------------------------------- parabola-vertex
function parabolaVertex(r: Random): Case {
  const frame = pick(r, ["vertex-form", "standard", "graph"] as const);
  for (;;) {
    const a = pick(
      r,
      frame === "graph" ? [1, -1, 2, -2] : [1, -1, 2, -2, 3, -3],
    );
    const h = nonzero(
      r,
      frame === "graph" ? -4 : -6,
      frame === "graph" ? 4 : 6,
    );
    const k = nonzero(
      r,
      frame === "graph" ? -6 : -9,
      frame === "graph" ? 6 : 9,
    );
    const b = -2 * a * h,
      c = a * h * h + k;
    const std = polyText([a, b, c]);
    const at = (x: number) => a * x * x + b * x + c;
    const correct = pt(h, k);
    const wrong: Choice[] =
      frame === "standard"
        ? [
            {
              label: pt(-h, at(-h)),
              feedback: `This drops the minus sign: x = ${n(-h)} is b/(2a). The vertex is at x = −b/(2a).`,
            },
            {
              label: pt(h, c),
              feedback: `This uses the constant term. ${n(c)} is the $y$-intercept, the value of $y$ at x = 0, not at the vertex.`,
            },
            {
              label: pt(-h, k),
              feedback:
                "This has the wrong sign on the $x$-coordinate. The vertex is at x = −b/(2a); keep both minus signs.",
            },
            {
              label: pt(k, h),
              feedback:
                "This swaps the coordinates. A point is written ($x$, $y$): across first, then up.",
            },
          ]
        : [
            {
              label: pt(-h, k),
              feedback: `This takes the sign inside the brackets as it looks. In ${vertexForm(a, h, k)} the bracket ${factor(h)} is 0 at x = ${n(h)}, not ${n(-h)}.`,
            },
            {
              label: pt(k, h),
              feedback:
                "This swaps the coordinates. A point is written ($x$, $y$): across first, then up.",
            },
            {
              label: pt(h, -k),
              feedback: `This flips the sign of the $y$-coordinate. The number added outside the square is ${n(k)}, and that is the $y$-coordinate.`,
            },
            {
              label: pt(-h, -k),
              feedback:
                "This flips both signs. Only the number inside the brackets changes sign; the number outside keeps its sign.",
            },
          ];
    const choices = options(correct, wrong);
    if (!choices) continue;
    const turn = a > 0 ? "lowest" : "highest";
    if (frame === "graph")
      return {
        prompt: "The graph shows a parabola. What is its vertex?",
        choices,
        scene: parabolaOnGrid(a, h, k),
        explanation: [
          `A parabola is the U-shaped graph of a quadratic. Its vertex is the turning point, where it changes direction.`,
          `This parabola opens ${a > 0 ? "up" : "down"}, so its vertex is its ${turn} point.`,
          `Read straight down to the $x$-axis: x = ${n(h)}. Read across to the $y$-axis: y = ${n(k)}.`,
          `The graph is y = ${vertexForm(a, h, k)}. It is symmetric, a mirror image, about the line x = ${n(h)}.`,
          `The vertex is ${correct}.`,
        ],
        hint: `This parabola opens ${a > 0 ? "up" : "down"}: find its ${turn} point, read straight down to the $x$-axis for $x$ and across to the $y$-axis for $y$.`,
        hintCue: [
          step(
            `The ${turn} point of the curve is the vertex.`,
            act.highlight("g.curve.0.vertex"),
          ),
        ],
        tags: [frame, a > 0 ? "up" : "down"],
      };
    if (frame === "vertex-form")
      return {
        prompt: `What is the vertex of the graph of y = ${vertexForm(a, h, k)}?`,
        choices,
        explanation: [
          "The vertex is the turning point of a parabola, its highest or lowest point. The form y = a(x − h)² + k, called vertex form, shows it directly.",
          "A square is never negative. So the squared term is 0 at x = h and has one sign everywhere else. That makes $y$ " +
            (a > 0 ? "least" : "greatest") +
            " at x = h, so the vertex is $(h, k)$.",
          `Here ${factor(h)} is 0 when x = ${n(h)}. Then the squared term is 0, so y = ${n(k)}.`,
          `The vertex is ${correct}.`,
        ],
        hint: `Match y = ${vertexForm(a, h, k)} to y = a(x − h)² + k. Ask which $x$ makes ${factor(h)} zero, then what $y$ is there.`,
        walkthrough: vertexGraph(
          a,
          b,
          c,
          polyTex([a, b, c]),
          vertexTex(a, h, k),
        ),
        tags: [frame, a > 0 ? "up" : "down"],
      };
    return {
      prompt: `What is the vertex of the graph of y = ${std}?`,
      choices,
      explanation: [
        `The vertex is the turning point of the parabola. It sits on the axis of symmetry, the vertical mirror line of the graph.`,
        `For y = ax² + bx + c, the axis is x = −b/(2a). Here a = ${n(a)} and b = ${n(b)}, the numbers multiplying $x^2$ and $x$.`,
        `So x = −b/(2a) = ${quotient(-b, 2 * a)}.`,
        `Substitute that $x$ to find the height: y = ${quadAtText(a, b, c, h)} = ${n(k)}.`,
        `The vertex is ${correct}. Check: ${std} is the expanded form of ${vertexForm(a, h, k)}.`,
      ],
      hint: `For y = ${std}, the vertex lies on x = −b/(2a) with a = ${n(a)} and b = ${n(b)}. Find that $x$, then substitute it.`,
      walkthrough: vertexGraph(a, b, c, polyTex([a, b, c]), vertexTex(a, h, k)),
      tags: [frame, a > 0 ? "up" : "down"],
    };
  }
}
const polyTex = (desc: number[]) =>
  polyText(desc)
    .replaceAll("²", "^2")
    .replaceAll("³", "^3")
    .replaceAll("−", "-");
function quadAtText(a: number, b: number, c: number, x: number) {
  const sq = x < 0 ? `(${n(x)})²` : `${x}²`;
  const first = a === 1 ? sq : a === -1 ? `−${sq}` : `${n(a)} × ${sq}`;
  const mid = b === 0 ? "" : `${b < 0 ? " − " : " + "}${Math.abs(b)} × ${p(x)}`;
  return first + mid + constText(c);
}

// ------------------------------------------------------------ parabola-axis
function parabolaAxis(r: Random): Case {
  const frame = pick(r, ["factored", "points", "graph", "standard"] as const);
  if (frame === "standard") {
    const a = pick(r, [1, -1, 2, -2, 3, -3, 4]),
      b = nonzero(r, -12, 12),
      c = r(-9, 9);
    const axis = rat(-b, 2 * a);
    const std = polyText([a, b, c]);
    return {
      prompt: `The graph of y = ${std} is a parabola. Its axis of symmetry is the line x = k. What is $k$?`,
      answer: axis,
      explanation: [
        "The axis of symmetry is the vertical line that splits a parabola into two mirror halves. It passes through the vertex, the turning point.",
        "For y = ax² + bx + c, the axis is the line x = −b/(2a). Here $a$ is the number multiplying x², and $b$ is the number multiplying $x$.",
        `In this equation a = ${n(a)} and b = ${n(b)}. So x = −b/(2a) = ${quotient(-b, 2 * a)}.`,
        `The axis is the line x = ${qt(axis)}, so k = ${qt(axis)}.`,
      ],
      hint: `In y = ${std}, a = ${n(a)} and b = ${n(b)}. The axis is x = −b/(2a): mind the minus sign.`,
      tags: [frame, axis.d === 1 ? "integer" : "fraction"],
    };
  }
  const p1 = r(-6, 5);
  let q1 = r(-5, 6);
  while (q1 === p1) q1 = r(-5, 6);
  const [lo, hi] = [Math.min(p1, q1), Math.max(p1, q1)];
  const axis = rat(lo + hi, 2);
  const mid = `(${n(lo)} + ${p(hi)}) ÷ 2 = ${qt(axis)}`;
  const explain = [
    "The axis of symmetry is the vertical line that splits a parabola into two mirror halves. Two points at the same height are mirror images across it.",
    `So the axis is halfway between x = ${n(lo)} and x = ${n(hi)}. Halfway is the average, the sum divided by 2: ${mid}.`,
    `The axis is the line x = ${qt(axis)}, so k = ${qt(axis)}.`,
  ];
  const tags = [frame, axis.d === 1 ? "integer" : "fraction"];
  if (frame === "factored") {
    const a = pick(r, [1, -1, 2, -3]);
    const form = `${lead(a)}${factor(lo)}${factor(hi)}`;
    return {
      prompt: `The graph of y = ${form} is a parabola. Its axis of symmetry is the line x = k. What is $k$?`,
      answer: axis,
      explanation: [
        `A product is 0 when one of its factors is 0. So y = 0 at x = ${n(lo)} and x = ${n(hi)}. These zeros are on the $x$-axis, both at height 0.`,
        ...explain,
      ],
      hint: `Find the two zeros of $y = ${form}$ (each factor equal to 0), then the number halfway between them.`,
      walkthrough: vertexGraph(
        a,
        -a * (lo + hi),
        a * lo * hi,
        polyTex([a, -a * (lo + hi), a * lo * hi]),
        `${lead(a).replace("−", "-")}${factor(lo).replace("−", "-")}${factor(hi).replace("−", "-")}`,
      ),
      tags,
    };
  }
  if (frame === "points") {
    const y = r(-12, 12);
    return {
      prompt: `The points ${pt(lo, y)} and ${pt(hi, y)} lie on a parabola. Its axis of symmetry is the line x = k. What is $k$?`,
      answer: axis,
      explanation: explain,
      hint: `${pt(lo, y)} and ${pt(hi, y)} are at the same height, so they mirror each other across the axis. Find the $x$ halfway between ${n(lo)} and ${n(hi)}.`,
      tags,
    };
  }
  const a = pick(r, [1, -1]);
  return {
    prompt:
      "The graph shows a parabola and the points where it crosses the $x$-axis. Its axis of symmetry is the line x = k. What is $k$?",
    answer: axis,
    scene: zerosGraph(a, [lo, hi]),
    explanation: [
      `The parabola crosses the $x$-axis at x = ${n(lo)} and x = ${n(hi)}, two points at height 0.`,
      ...explain,
    ],
    hint: `Read the two $x$-intercepts on the $x$-axis. The axis of symmetry is halfway between them.`,
    hintCue: [
      step(
        "The two $x$-intercepts are mirror images.",
        act.highlight("g.point"),
      ),
    ],
    tags,
  };
}

// ----------------------------------------------------------- parabola-shift
const moves = (h: number, k: number) =>
  `${Math.abs(h)} ${Math.abs(h) === 1 ? "unit" : "units"} ${h > 0 ? "right" : "left"} and ${Math.abs(k)} ${Math.abs(k) === 1 ? "unit" : "units"} ${k > 0 ? "up" : "down"}`;
function parabolaShift(r: Random): Case {
  const frame = pick(r, ["words", "graph", "describe"] as const);
  for (;;) {
    const h = nonzero(r, -4, 4),
      k = nonzero(r, -5, 5);
    const eq = (hh: number, kk: number) => `y = ${vertexForm(1, hh, kk)}`;
    const walkthrough = shiftWalkthrough(h, k, vertexTex(1, h, k));
    if (frame === "describe") {
      const choices = options(`It moves ${moves(h, k)}.`, [
        {
          label: `It moves ${moves(-h, k)}.`,
          feedback: `This reads the sideways move backward. (x − h)² moves the graph $h$ to the right, so ${factor(h)} gives h = ${n(h)}.`,
        },
        {
          label: `It moves ${moves(h, -k)}.`,
          feedback: `This reverses the up-down move. Adding ${n(k)} outside the square changes every $y$-value by ${n(k)}.`,
        },
        {
          label: `It moves ${moves(k, h)}.`,
          feedback:
            "This swaps the two moves. The number inside the brackets moves the graph sideways, and the number outside moves it up or down.",
        },
        {
          label: `It moves ${moves(-h, -k)}.`,
          feedback:
            "This reverses both moves. Only the number inside the brackets acts opposite to its sign; the number outside keeps its sign.",
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `How does the graph of ${eq(h, k)} compare with the graph of y = x²?`,
        choices,
        explanation: [
          "In y = (x − h)² + k, every point of y = x² moves $h$ across and $k$ up. The vertex, the turning point (0, 0), goes to $(h, k)$.",
          "The inside number acts opposite to its sign: x − h is 0 at x = h, so the graph moves to $h$.",
          `Here ${factor(h)} gives h = ${n(h)}, and the number outside the square gives k = ${n(k)}.`,
          `So the graph moves ${moves(h, k)}, with its vertex at ${pt(h, k)}.`,
        ],
        hint: `Find where the vertex (0, 0) of y = x² goes: which $x$ makes ${factor(h)} zero, and what is added outside?`,
        walkthrough,
        tags: [frame],
      };
    }
    const choices = options(eq(h, k), [
      {
        label: eq(-h, k),
        feedback: `This moves the graph the wrong way sideways. For a move ${h > 0 ? "right" : "left"} of ${Math.abs(h)}: subtract ${n(h)} from $x$ inside the square.`,
      },
      {
        label: eq(k, h),
        feedback:
          "This swaps the moves. The sideways move goes inside the square with $x$; the up-down move is added outside.",
      },
      {
        label: eq(h, -k),
        feedback: `This reverses the up-down move. The vertical move is ${n(k)}, so add ${n(k)} outside the square.`,
      },
      {
        label: eq(-h, -k),
        feedback:
          "This reverses both moves. Right means subtract inside the square, and up means add outside.",
      },
    ]);
    if (!choices) continue;
    if (frame === "words")
      return {
        prompt: `The graph of y = x² is moved ${moves(h, k)}. Which equation describes the new graph?`,
        choices,
        explanation: [
          `Start from the vertex, the turning point, of y = x²: (0, 0). Moving the graph moves the vertex to ${pt(h, k)}.`,
          `A sideways move goes inside the square and acts opposite to its sign. Moving ${Math.abs(h)} ${h > 0 ? "right" : "left"} replaces $x$ with ${factor(h).slice(1, -1)}, which is 0 at x = ${n(h)}.`,
          `An up-down move is added outside. Moving ${Math.abs(k)} ${k > 0 ? "up" : "down"} adds ${n(k)} to every $y$.`,
          `The new vertex is ${pt(h, k)}, so the equation is ${eq(h, k)}.`,
          `Check: at x = ${n(h)}, $y = 0² ${constText(k).trim()} = ${n(k)}$, the moved vertex.`,
        ],
        hint: `The vertex (0, 0) moves to ${pt(h, k)}. Which equation has its vertex there?`,
        walkthrough,
        tags: [frame],
      };
    return {
      prompt:
        "The solid parabola is the dashed graph of y = x² moved without turning or stretching. Which equation describes the solid parabola?",
      choices,
      scene: shiftedParabola(h, k),
      explanation: [
        `The vertex is the turning point. It moved from (0, 0) to ${pt(h, k)}: ${moves(h, k)}.`,
        `Moving $h$ across and $k$ up gives y = (x − h)² + k. The sideways move goes inside the square with its sign flipped; the up-down move is added outside.`,
        `So the equation is ${eq(h, k)}.`,
        `Check: the point (${n(h + 1)}, ${n(k + 1)}) on the solid curve is (1, 1) on y = x², moved the same way.`,
      ],
      hint: `Read the solid curve's vertex and compare it with (0, 0): how far across and how far up did it move?`,
      hintCue: [
        step("Where did the vertex move?", act.highlight("g.curve.1.vertex")),
      ],
      walkthrough,
      tags: [frame],
    };
  }
}

// ------------------------------------------------------- binomial-area-product
function areaModelProduct(r: Random): Case {
  const frame = pick(r, ["tiles", "product", "garden"] as const);
  for (;;) {
    const a = pick(r, [1, 1, 2, 3]),
      b = pick(r, [1, 1, 2]);
    const s = nonzero(r, frame === "garden" ? -3 : -6, 6),
      u = nonzero(r, frame === "garden" ? 1 : -6, frame === "garden" ? 9 : 6);
    const left = linFactor(a, s),
      right = linFactor(b, u);
    const mid = a * u + b * s;
    const right1 = polyText([a * b, mid, s * u]);
    const choices = options(right1, [
      {
        label: polyText([a * b, 0, s * u]),
        feedback: `This multiplies only first with first and last with last. It leaves out the two $x$-regions, $${termText(a * u, "x")}$ and $${termText(b * s, "x")}$.`,
      },
      {
        label: polyText([a * b, a * u - b * s, s * u]),
        feedback: `This has a sign error in one $x$-region. Recheck ${termText(a, "x")} × ${p(u)} and ${n(s)} × ${termText(b, "x")}: a negative times a positive is negative.`,
      },
      {
        label: polyText([a * b, mid, -s * u]),
        feedback: `This has the wrong sign on the constant. ${n(s)} × ${p(u)} = ${n(s * u)}.`,
      },
      {
        label: polyText([a * b, s + u, s * u]),
        feedback:
          "This adds the two constants for the $x$ term. Each $x$-region is an $x$ term times the other side's constant, so multiply before adding.",
      },
    ]);
    if (!choices) continue;
    const explanation = [
      `The area of a rectangle is length times width. Split each side into its terms, and the rectangle splits into four regions.`,
      `Each term of ${left} multiplies each term of ${right}. This is the distributive property: every term meets every other term once.`,
      `${termText(a, "x")} × ${termText(b, "x")} = ${termText(a * b, "x²")}; ${termText(a, "x")} × ${p(u)} = ${termText(a * u, "x")}; ${n(s)} × ${termText(b, "x")} = ${termText(b * s, "x")}; ${n(s)} × ${p(u)} = ${n(s * u)}.`,
      `Combine the $x$-regions: ${termText(a * u, "x")}${termText(b * s, "x", false)} = ${mid === 0 ? "0" : termText(mid, "x")}. The product is ${right1}.`,
    ];
    const walkthrough = factorTiles([s, a], [u, b]);
    if (frame === "tiles")
      return {
        prompt: `The algebra tiles form a rectangle with sides ${left.slice(1, -1)} and ${right.slice(1, -1)}. Which expression is its area?`,
        choices,
        scene: polyArea(
          [
            [a, 1],
            [s, 0],
          ],
          [
            [b, 1],
            [u, 0],
          ],
        )
          .id("t")
          .scene({ title: "An algebra-tile rectangle" }),
        explanation,
        hint: `The rectangle has four regions. Multiply the side next to each one: start with ${termText(a, "x")} × ${termText(b, "x")} in the corner, then ${n(s)} × ${p(u)} opposite it.`,
        hintCue: [
          step(
            "The corner region is $x$ times $x$.",
            act.highlight("t.region.0.0"),
          ),
          step(
            "The opposite corner is the two constants.",
            act.highlight("t.region.1.1"),
          ),
          step(
            "The other two regions are the $x$-terms.",
            act.highlight("t.region.1.0"),
            act.highlight("t.region.0.1"),
          ),
        ],
        walkthrough,
        tags: [frame, s < 0 || u < 0 ? "negative" : "positive"],
      };
    if (frame === "garden")
      return {
        prompt: `A rectangular garden has length ${left.slice(1, -1)} and width ${right.slice(1, -1)}, both in meters. Which expression gives its area in square meters?`,
        choices,
        explanation,
        hint: `Area is length times width: multiply every term of ${left} by every term of ${right}, then add like terms.`,
        walkthrough,
        tags: [frame, s < 0 ? "negative" : "positive"],
      };
    return {
      prompt: `Which expression is equivalent to ${left}${right}?`,
      choices,
      explanation,
      hint: `Multiply each term of ${left} by each term of ${right}: four products. Then combine the two $x$-terms.`,
      walkthrough,
      tags: [frame, s < 0 || u < 0 ? "negative" : "positive"],
    };
  }
}

// --------------------------------------------------------- structure-meaning
function structureMeaning(r: Random): Case {
  const frame = pick(r, ["projectile", "fee", "growth"] as const);
  if (frame === "projectile") {
    const v = pick(r, [24, 32, 40, 48, 56, 64]);
    let s = r(3, 40);
    // The asked number must name one part only.
    while (s === v || s === 16) s = r(3, 40);
    const askHeight = r(0, 1) === 0;
    const rule = `h = −16t² + ${v}t + ${s}`;
    const labels = {
      start: "The height, in feet, when the ball is released",
      speed: "The upward speed, in feet per second, at release",
      one: "The height, in feet, after 1 second",
      top: "The greatest height the ball reaches",
    };
    const correct = askHeight ? labels.start : labels.speed;
    return {
      prompt: `A ball is thrown upward. Its height, in feet, $t$ seconds later is ${rule}. What does ${askHeight ? s : v} represent?`,
      choices: [
        { label: correct, correct: true },
        ...(askHeight
          ? [labels.speed, labels.one, labels.top]
          : [labels.start, labels.one, labels.top]
        ).map((label) => ({
          label,
          feedback:
            label === labels.one
              ? `This mixes up one term with the whole height. At t = 1, h = −16 + ${v} + ${s} = ${-16 + v + s}, which uses every term.`
              : label === labels.top
                ? `This confuses a number in the rule with the peak. The greatest height is at the vertex, the turning point, when t = ${v}/32.`
                : "This mixes up the two numbers. Set t = 0: the term left over is the release height, and the number multiplying $t$ is the starting speed.",
        })),
      ],
      explanation: [
        `Each term of the rule has a meaning. The constant term is the number with no $t$. The coefficient of $t$ is the number multiplying $t$.`,
        `At release, t = 0: h = −16(0)² + ${v}(0) + ${s} = ${s}. So the constant term is the starting height, in feet.`,
        `The term ${v}t grows by ${v} feet each second at first. So ${v} is the upward speed at release, in feet per second. The term −16t² is gravity slowing the ball.`,
        `So ${askHeight ? s : v} is ${correct.toLowerCase()}.`,
      ],
      hint: `Put t = 0 into ${rule}: which term is left? Then ask what the term with $t$ alone adds each second.`,
      tags: [frame, askHeight ? "constant" : "coefficient"],
    };
  }
  if (frame === "fee") {
    const job = pick(r, [
      ["A plumber", "hour", "h", "hours"],
      ["A moving van", "mile", "m", "miles"],
      ["A tutor", "session", "s", "sessions"],
    ] as const);
    const fee = pick(r, [25, 30, 40, 45, 50, 60, 75]),
      rate = pick(r, [12, 15, 20, 35, 55, 65, 80]);
    const askFee = r(0, 1) === 0;
    const rule = `C = ${fee} + ${rate}${job[2]}`;
    const labels = {
      fee: `A fixed charge paid whatever the number of ${job[3]}`,
      rate: `The cost of each ${job[1]}`,
      first: `The total cost for one ${job[1]}`,
      count: `The number of ${job[3]}`,
    };
    const correct = askFee ? labels.fee : labels.rate;
    return {
      prompt: `${job[0]} charges $C$ dollars for $${job[2]}$ ${job[3]}, where $${rule}$. What does ${askFee ? fee : rate} represent?`,
      choices: [
        { label: correct, correct: true },
        ...(askFee
          ? [labels.rate, labels.first, labels.count]
          : [labels.fee, labels.first, labels.count]
        ).map((label) => ({
          label,
          feedback:
            label === labels.first
              ? `This adds the two numbers. That is the total for one ${job[1]}: ${fee} + ${rate} = ${fee + rate} dollars. Each number alone has its own meaning.`
              : "This mixes up the parts. The fixed charge is paid even at zero; the number multiplying the count is added for each one.",
        })),
      ],
      explanation: [
        `In a rule like this, the constant term is paid no matter what. The coefficient, the number multiplying $${job[2]}$, is the cost of each one.`,
        `When ${job[2]} = 0, C = ${fee}: ${fee} dollars is charged before any ${job[3]}.`,
        `Each extra ${job[1]} adds ${rate} dollars, since $${rate}${job[2]}$ grows by ${rate} when $${job[2]}$ grows by 1.`,
        `So ${askFee ? fee : rate} is ${correct.toLowerCase()}.`,
      ],
      hint: `Compare $C$ for $${job[2]} = 0$ and $${job[2]} = 1$ in $${rule}$. Which number is paid anyway, and which is added per ${job[1]}?`,
      tags: [frame, askFee ? "constant" : "coefficient"],
    };
  }
  const start = pick(r, [800, 1200, 2400, 3500, 5000]),
    pct = pick(r, [2, 3, 4, 5, 6, 8]);
  const factorText = `1.0${pct}`;
  const askFactor = r(0, 1) === 0;
  const rule = `P = ${start}(${factorText})^t`;
  const labels = {
    factor: `Each year the population is multiplied by ${factorText}: it grows ${pct}% a year`,
    start: "The population at the start, when t = 0",
    add: `The population grows by ${factorText} people each year`,
    after: "The population after one year",
  };
  const correct = askFactor ? labels.factor : labels.start;
  return {
    prompt: `A town's population $t$ years from now is modeled by ${rule}. What does ${askFactor ? factorText : start} represent?`,
    choices: [
      { label: correct, correct: true },
      ...(askFactor
        ? [labels.start, labels.add, labels.after]
        : [labels.factor, labels.add, labels.after]
      ).map((label) => ({
        label,
        feedback:
          label === labels.add
            ? "This treats the factor as an amount added. The exponent $t$ means repeated multiplication, not repeated addition."
            : label === labels.after
              ? `This confuses one number with the value after a year. After one year P = ${start} × ${factorText}, a product of both numbers.`
              : "This mixes up the start and the factor. Put t = 0, then t = 1, and compare: the start appears alone at t = 0.",
      })),
    ],
    explanation: [
      `In P = a(b)^t, the number in front, $a$, is the starting amount. The base $b$, the number raised to the power $t$, is the yearly growth factor.`,
      `At t = 0, ${factorText}⁰ = 1, because any number to the power 0 is 1. So P = ${start}: the starting population.`,
      `Each added year multiplies $P$ by ${factorText} once more. ${factorText} = 1 + 0.0${pct}, an increase of ${pct}% a year.`,
      `So ${askFactor ? factorText : start} is ${correct[0]!.toLowerCase()}${correct.slice(1)}.`,
    ],
    hint: `Find $P$ at t = 0 and at t = 1 in ${rule}. What stays the same, and what multiplies $P$ each year?`,
    tags: [frame, askFactor ? "factor" : "start"],
  };
}

// --------------------------------------------------------- structure-rewrite
function structureRewrite(r: Random): Case {
  const frame = pick(r, [
    "fourth-power",
    "shifted-square",
    "perfect-square",
  ] as const);
  for (;;) {
    if (frame === "fourth-power") {
      const m = r(2, 9),
        sq = m * m;
      const choices = options(`(x² − ${sq})(x² + ${sq})`, [
        {
          label: `(x² − ${sq})²`,
          feedback: `This squares one factor instead of using two. (x² − ${sq})² = x⁴ − ${2 * sq}x² + ${sq * sq}, which has a middle term.`,
        },
        {
          label: `(x − ${sq})(x + ${sq})`,
          feedback: `This uses $x$ where x² belongs. (x − ${sq})(x + ${sq}) = x² − ${sq * sq}, not x⁴ − ${sq * sq}.`,
        },
        {
          label: `(x² − ${m})(x² + ${m})`,
          feedback: `This takes one square root too many. (x² − ${m})(x² + ${m}) = x⁴ − ${sq}, but the number is ${sq * sq} = ${sq}².`,
        },
        {
          label: `(x⁴ − ${sq})(x⁴ + ${sq})`,
          feedback:
            "This keeps x⁴ in each factor. x⁴ is (x²)², so each factor holds x², the thing being squared.",
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `Write x⁴ − ${sq * sq} as a difference of two squares. Which product is equal to it?`,
        choices,
        explanation: [
          `A difference of two squares is one square minus another. It always factors: A² − B² = (A − B)(A + B). Multiplying back, the middle terms cancel.`,
          `x⁴ = (x²)² and ${sq * sq} = ${sq}², so x⁴ − ${sq * sq} = (x²)² − ${sq}².`,
          `Use the pattern with A = x² and B = ${sq}.`,
          `So x⁴ − ${sq * sq} = (x² − ${sq})(x² + ${sq}). The first factor is itself (x − ${m})(x + ${m}).`,
        ],
        hint: `Look at x⁴ − ${sq * sq} as (something)² − (something)²: x⁴ is the square of what, and ${sq * sq} is the square of what?`,
        tags: [frame],
      };
    }
    if (frame === "shifted-square") {
      const pp = nonzero(r, -6, 6),
        q = r(1, 7);
      if (q === Math.abs(pp)) continue;
      const lo = pp - q,
        hi = pp + q;
      const inner = `(x ${pp < 0 ? "−" : "+"} ${Math.abs(pp)})`;
      const fac = (c: number) => (c === 0 ? "x" : `(x${constText(c)})`);
      const label = (u: number, v: number) =>
        `${fac(Math.min(u, v))}${fac(Math.max(u, v))}`;
      const choices = options(label(lo, hi), [
        {
          label: label(-lo, -hi),
          feedback: `This reverses the signs of the constants. Expanding gives x² ${-2 * pp < 0 ? "−" : "+"} ${Math.abs(2 * pp)}x ${pp * pp - q * q < 0 ? "−" : "+"} ${Math.abs(pp * pp - q * q)}, a different expression.`,
        },
        {
          label: label(pp - q * q, pp + q * q),
          feedback: `This forgets to take the square root of ${q * q}. ${q * q} is ${q}², so $B$ is ${q}, not ${q * q}.`,
        },
        {
          label: `${fac(pp - q)}²`,
          feedback:
            "This writes a perfect square. A difference of squares factors into two different factors: one with minus and one with plus.",
        },
        {
          label: label(q - pp, q + pp),
          feedback: `This flips the sign of the number inside the group. $A = x ${pp < 0 ? "−" : "+"} ${Math.abs(pp)}$: keep its sign.`,
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `Treat ${inner} as a single quantity. Which product equals ${inner}² − ${q * q}?`,
        choices,
        explanation: [
          `A difference of two squares is one square minus another. It factors: A² − B² = (A − B)(A + B).`,
          `The group ${inner} acts like one number. Call it $A = x${constText(pp)}$. Then ${inner}² − ${q * q} = A² − ${q}², since ${q * q} = ${q}².`,
          `$A² − ${q}² = (A − ${q})(A + ${q}) = (x${constText(pp)} − ${q})(x${constText(pp)} + ${q})$.`,
          `Combine the constants: ${label(lo, hi)}.`,
        ],
        hint: `${q * q} is ${q}². Write ${inner}² − ${q}² as (A − ${q})(A + ${q}) with $A = x${constText(pp)}$, then simplify each factor.`,
        tags: [frame],
      };
    }
    const m = r(2, 6),
      k = nonzero(r, -9, 9);
    if (Math.abs(k) === m) continue;
    const expr = polyText([m * m, 2 * m * k, k * k]);
    const sq = (u: number, v: number) =>
      `(${termText(u, "x")}${constText(v)})²`;
    const choices = options(sq(m, k), [
      {
        label: sq(m * m, k * k),
        feedback: `This forgets the square roots. (${termText(m * m, "x")}${constText(k * k)})² starts with ${m ** 4}x², not ${m * m}x².`,
      },
      {
        label: sq(m, -k),
        feedback: `This has the wrong sign inside. The middle term's sign matches the sign of the constant inside, and here it is ${n(2 * m * k)}x.`,
      },
      {
        label: sq(m * m, k),
        feedback: `This forgets the square root of ${m * m}x². It is (${m}x)², so the first term inside is ${m}x.`,
      },
      {
        label: sq(m, k * k),
        feedback: `This forgets the square root of ${k * k}. It is (${n(k)})², so the constant inside is ${n(k)}.`,
      },
    ]);
    if (!choices) continue;
    return {
      prompt: `Which square is equal to ${expr}?`,
      choices,
      explanation: [
        `A perfect square trinomial is what you get by squaring a binomial, a two-term expression. Look for squares at both ends.`,
        `${m * m}x² = (${m}x)² and ${k * k} = ${p(k)}².`,
        `A perfect square (A + B)² = A² + 2AB + B². With A = ${m}x and B = ${n(k)}, 2AB = 2 × ${m}x × ${p(k)} = ${termText(2 * m * k, "x")}, the middle term.`,
        `So ${expr} = ${sq(m, k)}.`,
      ],
      hint: `${m * m}x² is a square and so is ${k * k}. Find what is squared in each, then check that twice their product gives the middle term ${termText(2 * m * k, "x")}.`,
      tags: [frame, k < 0 ? "negative" : "positive"],
    };
  }
}

// -------------------------------------------------------- zeros-from-factors
const set = (zs: number[]) =>
  `x = ${[...zs]
    .sort((u, v) => u - v)
    .map(n)
    .join(", ")}`;
function zerosFromFactors(r: Random): Case {
  const frame = pick(r, ["factored", "graph", "build"] as const);
  for (;;) {
    const roots = shuffle(r, [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]).slice(
      0,
      3,
    );
    if (frame === "graph" && Math.max(...roots) - Math.min(...roots) > 7)
      continue;
    const sorted = [...roots].sort((u, v) => u - v);
    const lc = frame === "graph" ? pick(r, [1, -1]) : 1;
    const form = (zs: number[], a = lc) =>
      `y = ${lead(a)}${[...zs]
        .sort((u, v) => u - v)
        .map(factor)
        .join("")}`;
    // The last zero slides in from two units away, on the side that does
    // not pass through the other zeros.
    const [z0, z1, z2] = sorted as [number, number, number];
    const path = [
      [z2 - 2, z2 - 1, z2],
      [z2 + 2, z2 + 1, z2],
    ]
      .map((p) => p.filter((z, i) => i === 2 || (z !== z0 && z !== z1)))
      .sort((u, v) => v.length - u.length)[0]!;
    const walkthrough = zeroSlide(lc, [z0, z1], path, (z) =>
      `${lead(lc)}${[z0, z1, z].map(factor).join("")}`.replaceAll("−", "-"),
    );
    if (frame === "factored") {
      const choices = options(set(sorted), [
        {
          label: set(sorted.map((z) => -z)),
          feedback: `This takes the numbers in the factors as they look. ${factor(sorted[0]!)} is 0 when x = ${n(sorted[0]!)}, the opposite of the number shown.`,
        },
        {
          label: set([sorted[0]!, sorted[1]!, -sorted[2]!]),
          feedback: `This has a sign error for one factor. ${factor(sorted[2]!)} is 0 at x = ${n(sorted[2]!)}.`,
        },
        {
          label: set([-sorted[0]!, sorted[1]!, sorted[2]!]),
          feedback: `This has a sign error for one factor. ${factor(sorted[0]!)} is 0 at x = ${n(sorted[0]!)}.`,
        },
        {
          label: set([sorted[0]!, -sorted[1]!, sorted[2]!]),
          feedback: `This has a sign error for one factor. ${factor(sorted[1]!)} is 0 at x = ${n(sorted[1]!)}.`,
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `What are the zeros of ${form(roots).replace("y = ", "y = ")}?`,
        choices,
        explanation: [
          "A zero of a function is an $x$ where $y$ is 0, where the graph meets the $x$-axis.",
          "A product is 0 exactly when one of its factors is 0. So set each factor equal to 0.",
          sorted.map((z) => `${factor(z)} = 0 when x = ${n(z)}`).join(". ") +
            ".",
          `The zeros are ${set(sorted)}.`,
        ],
        hint: `Set each factor of ${form(roots)} equal to 0 separately and solve.`,
        walkthrough,
        tags: [frame, sorted.includes(0) ? "zero-root" : "nonzero-roots"],
      };
    }
    if (frame === "build") {
      const choices = options(form(sorted), [
        {
          label: form(sorted.map((z) => -z)),
          feedback: `This flips every sign. It is 0 at ${set(sorted.map((z) => -z))}. A zero at $r$ needs the factor (x − r).`,
        },
        {
          label: form([sorted[0]!, sorted[1]!, -sorted[2]!]),
          feedback: `This has a sign error in one factor: it is 0 at x = ${n(-sorted[2]!)}, not ${n(sorted[2]!)}.`,
        },
        {
          label: form([-sorted[0]!, sorted[1]!, sorted[2]!]),
          feedback: `This has a sign error in one factor: it is 0 at x = ${n(-sorted[0]!)}, not ${n(sorted[0]!)}.`,
        },
        {
          label: form([sorted[0]!, -sorted[1]!, sorted[2]!]),
          feedback: `This has a sign error in one factor: it is 0 at x = ${n(-sorted[1]!)}, not ${n(sorted[1]!)}.`,
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `Which polynomial has zeros at ${sorted.map((z) => `x = ${n(z)}`).join(", ")} and nowhere else?`,
        choices,
        explanation: [
          "A zero of a polynomial is an $x$ where its value is 0. A product is 0 exactly when one factor is 0.",
          "So a zero at x = r comes from the factor (x − r), which is 0 exactly at $r$. Note the sign flips: a zero at −2 gives (x + 2).",
          sorted
            .map((z) => `The factor for x = ${n(z)} is ${factor(z)}`)
            .join(". ") + ".",
          `So the polynomial is ${form(sorted)}.`,
        ],
        hint: `Each zero $r$ needs a factor (x − r). Write the factor for x = ${n(sorted[0]!)} first: watch its sign.`,
        walkthrough,
        tags: [frame, sorted.includes(0) ? "zero-root" : "nonzero-roots"],
      };
    }
    const choices = options(form(sorted), [
      {
        label: form(sorted.map((z) => -z)),
        feedback:
          "This flips every sign. Each factor (x − r) is 0 at $r$, but these factors are 0 at the opposite numbers.",
      },
      {
        label: form(sorted, -lc),
        feedback: `This has the wrong leading sign. The graph ${lc > 0 ? "rises" : "falls"} to the right, so the leading coefficient, the number in front, is ${lc > 0 ? "positive" : "negative"}.`,
      },
      {
        label: form([sorted[0]!, sorted[1]!, sorted[2]! + 1]),
        feedback: `This misreads one intercept by 1. It is 0 at x = ${n(sorted[2]! + 1)}, but the graph crosses at x = ${n(sorted[2]!)}.`,
      },
      {
        label: form([sorted[0]! - 1, sorted[1]!, sorted[2]!]),
        feedback: `This misreads one intercept by 1. It is 0 at x = ${n(sorted[0]! - 1)}, but the graph crosses at x = ${n(sorted[0]!)}.`,
      },
    ]);
    if (!choices) continue;
    return {
      prompt: "Which equation could the graph show?",
      choices,
      scene: zerosGraph(lc, sorted),
      explanation: [
        `Each $x$-intercept, where the graph crosses the $x$-axis, is a zero: there $y$ is 0. A zero at $r$ comes from a factor (x − r).`,
        `The graph crosses at ${sorted.map(n).join(", ")}, so each of these needs its own factor (x − r).`,
        `It ${lc > 0 ? "rises" : "falls"} to the right. For a cubic that means the leading coefficient, the number in front, is ${lc > 0 ? "positive" : "negative"}.`,
        `So the equation is ${form(sorted)}.`,
      ],
      hint: "Read the three $x$-intercepts and turn each into a factor (x − r). Then check whether the graph rises or falls on the right.",
      hintCue: [
        step("Each $x$-intercept is a zero.", act.highlight("g.point")),
      ],
      walkthrough,
      tags: [frame, lc > 0 ? "up" : "down"],
    };
  }
}

// --------------------------------------------------------- zero-multiplicity
function zeroMultiplicity(r: Random): Case {
  const frame = pick(r, ["factored", "graph", "describe"] as const);
  for (;;) {
    const [d, s] = shuffle(r, [-4, -3, -2, -1, 0, 1, 2, 3, 4]).slice(0, 2) as [
      number,
      number,
    ];
    if (Math.abs(d - s) > 6) continue;
    const lc = frame === "graph" ? pick(r, [1, -1]) : 1;
    const form = (sq: number, single: number, a = lc) =>
      `$y = ${lead(a)}${factor(sq)}²${factor(single)}$`;
    const how = (touchAt: number[], crossAt: number[]) =>
      [
        ...touchAt.map((z) => `touches the $x$-axis at x = ${n(z)}`),
        ...crossAt.map((z) => `crosses it at x = ${n(z)}`),
      ].join(" and ");
    const desc = (t: number[], c: number[]) => `The graph ${how(t, c)}.`;
    const explanation = [
      "A zero is an $x$ where the graph meets the $x$-axis. How it meets the axis depends on the power of its factor.",
      "Near a zero from a squared factor, (x − r)² is never negative, so $y$ keeps one sign on both sides: the graph touches the axis and turns back.",
      "A factor to the first power changes sign at its zero, so the graph crosses there.",
      `In ${form(d, s)}: $${factor(d)}^2$ touches at $x = ${n(d)}$; $${factor(s)}$ crosses at $x = ${n(s)}$.`,
    ];
    if (frame === "factored") {
      const choices = options(
        desc([d], [s]),
        [
          {
            label: desc([s], [d]),
            feedback: `This swaps touch and cross. The squared factor is ${factor(d)}², so the touching zero is x = ${n(d)}.`,
          },
          {
            label: `The graph crosses the $x$-axis at x = ${n(d)} and at x = ${n(s)}.`,
            feedback: `This ignores the square. ${factor(d)}² is never negative, so it does not change sign at x = ${n(d)}: the graph touches there.`,
          },
          {
            label: `The graph touches the $x$-axis at x = ${n(d)} and at x = ${n(s)}.`,
            feedback: `This treats the single factor as squared. $${factor(s)}$ changes sign at $x = ${n(s)}$, so the graph crosses there.`,
          },
        ].concat([
          {
            label: desc([-d], [-s]),
            feedback:
              "This flips the signs of the zeros. Each factor (x − r) is 0 at $r$, not at −r.",
          },
        ]),
      );
      if (!choices) continue;
      return {
        prompt: `How does the graph of ${form(d, s)} meet the $x$-axis?`,
        choices,
        explanation,
        hint: `In ${form(d, s)}, which factor is squared? A squared factor keeps its sign on both sides of its zero.`,
        tags: [frame],
      };
    }
    if (frame === "describe") {
      const choices = options(form(d, s, 1), [
        {
          label: form(s, d, 1),
          feedback: `This squares the wrong factor. It touches at $x = ${n(s)}$ and crosses at $x = ${n(d)}$.`,
        },
        {
          label: `y = ${factor(d)}${factor(s)}`,
          feedback:
            "This has no squared factor, so the graph would cross at both zeros. Touching needs a squared factor.",
        },
        {
          label: form(-d, -s, 1),
          feedback:
            "This flips the signs of the zeros. Each factor (x − r) is 0 at $r$, not at −r.",
        },
        {
          label: `y = ${factor(d)}${factor(s)}²`,
          feedback: `This squares the wrong factor, so it touches at $x = ${n(s)}$ instead.`,
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `A cubic graph touches the $x$-axis at x = ${n(d)} and crosses it at x = ${n(s)}, and nowhere else. Which equation could it have?`,
        choices,
        explanation,
        hint: `Touching the axis needs a squared factor and crossing it a single one. The graph touches at $x = ${n(d)}$ and crosses at $x = ${n(s)}$.`,
        tags: [frame],
      };
    }
    const choices = options(form(d, s), [
      {
        label: form(s, d),
        feedback: `This squares the wrong factor. The graph touches at $x = ${n(d)}$, so that factor is the squared one.`,
      },
      {
        label: `y = ${lead(lc)}${factor(d)}${factor(s)}`,
        feedback: `This has no squared factor. That parabola would cross at x = ${n(d)}, but this graph only touches there.`,
      },
      {
        label: form(d, s, -lc),
        feedback: `This has the wrong leading sign. Check the right end: the graph ${lc > 0 ? "rises" : "falls"}.`,
      },
      {
        label: form(-d, -s),
        feedback:
          "This flips the signs of the zeros. Each factor (x − r) is 0 at $r$, not at −r.",
      },
    ]);
    if (!choices) continue;
    return {
      prompt: "Which equation could the graph show?",
      choices,
      scene: zerosGraph(lc, [d, d, s]),
      explanation: [
        `The graph touches the $x$-axis at x = ${n(d)} and crosses at $x = ${n(s)}$.`,
        ...explanation.slice(0, 2),
        `It ${lc > 0 ? "rises" : "falls"} on the right, so the equation is ${form(d, s)}.`,
      ],
      hint: "At which $x$-intercept does the graph only touch the axis? That zero needs a squared factor.",
      hintCue: [step("Touch or cross?", act.highlight("g.point"))],
      tags: [frame, lc > 0 ? "up" : "down"],
    };
  }
}

// -------------------------------------------------------- remainder-theorem
const evalDesc = (desc: number[], x: number) =>
  desc.reduce((acc, c) => acc * x + c, 0);
function substituted(desc: number[], a: number) {
  const deg = desc.length - 1;
  return desc
    .map((c, i) => [c, deg - i] as const)
    .filter(([c]) => c !== 0)
    .map(([c, k], i) => {
      const pow = k === 0 ? "" : k === 1 ? p(a) : `${p(a)}${SUP[k]}`;
      const mag = Math.abs(c);
      const body = k === 0 ? String(mag) : mag === 1 ? pow : `${mag} × ${pow}`;
      return i === 0
        ? `${c < 0 ? "−" : ""}${body}`
        : ` ${c < 0 ? "−" : "+"} ${body}`;
    })
    .join("");
}
function remainderTheorem(r: Random): Case {
  const frame = pick(r, ["remainder", "factor-k", "tableau"] as const);
  const a = nonzero(r, -4, 4);
  const div = `x ${a < 0 ? "+" : "−"} ${Math.abs(a)}`;
  if (frame === "factor-k") {
    for (;;) {
      const b = r(-6, 6),
        k = nonzero(r, -20, 20);
      const d = -(a ** 3 + b * a * a + k * a);
      if (Math.abs(d) > 60 || d === 0) continue;
      const shown = `x³${b ? termText(b, "x²", false) : ""} + kx${constText(d)}`;
      return {
        prompt: `For which number $k$ is $${div}$ a factor of $p(x) = ${shown}$?`,
        answer: rat(k),
        explanation: [
          `A factor divides a polynomial with remainder 0. The factor theorem says x − a is a factor exactly when $p(a) = 0$. Here a = ${n(a)}, the value that makes ${div} zero.`,
          `$p(${n(a)}) = ${p(a)}³${b ? ` ${b < 0 ? "−" : "+"} ${Math.abs(b)} × ${p(a)}²` : ""} + k × ${p(a)}${constText(d)} = ${n(a ** 3 + b * a * a + d)} ${a < 0 ? "−" : "+"} ${Math.abs(a) === 1 ? "" : Math.abs(a)}k$.`,
          `Set it to 0: ${Math.abs(a) === 1 ? "" : Math.abs(a)}k = ${n(a < 0 ? a ** 3 + b * a * a + d : -(a ** 3 + b * a * a + d))}, so k = ${n(k)}.`,
        ],
        hint: `${div} is a factor when p(${n(a)}) = 0. Substitute x = ${n(a)} into ${shown} and solve for $k$.`,
        tags: [frame],
      };
    }
  }
  const desc = [nonzero(r, -3, 3), r(-6, 6), r(-9, 9), r(-12, 12)];
  const rem = evalDesc(desc, a);
  const shown = polyText(desc);
  const steps = [
    `$p(x)$, read "$p$ of $x$", names the polynomial. The remainder theorem says dividing $p(x)$ by x − a leaves remainder $p(a)$, its value at $a$. Here a = ${n(a)}, since ${div} is zero there.`,
    `p(${n(a)}) = ${substituted(desc, a)} = ${n(rem)}.`,
    `The remainder is ${n(rem)}${rem === 0 ? `, so ${div} is a factor` : ""}.`,
  ];
  if (frame === "tableau") {
    const t = syntheticTableau(a, desc, "blank");
    return {
      prompt: `The layout is set up to divide p(x) = ${shown} by ${div}. What is the remainder?`,
      answer: rat(rem),
      scene: t.scene,
      explanation: [
        `Synthetic division divides by ${div} using its zero, ${n(a)}, the value that makes it 0. The top row holds the coefficients, the numbers in front of each power.`,
        `Bring down ${n(desc[0]!)}. Then repeatedly multiply by ${n(a)} and add down each column: the bottom row is ${t.sums.map(n).join(", ")}.`,
        `The last number, ${n(rem)}, is the remainder. Check with the remainder theorem: ${steps[1]}`,
      ],
      hint: `Bring down ${n(desc[0]!)}, multiply it by ${n(a)} and add to ${n(desc[1]!)}; repeat across. The last sum is the remainder.`,
      walkthrough: syntheticTableau(a, desc, "filled").scene,
      tags: [frame, rem === 0 ? "factor" : "remainder"],
    };
  }
  return {
    prompt: `What is the remainder when p(x) = ${shown} is divided by ${div}?`,
    answer: rat(rem),
    explanation: steps,
    hint: `You need not divide: the remainder of p(x) ÷ (${div}) is $p(${n(a)})$. Substitute x = ${n(a)} into ${shown}.`,
    walkthrough: syntheticTableau(a, desc, "filled").scene,
    tags: [frame, rem === 0 ? "factor" : "remainder"],
  };
}

// ------------------------------------------------------ polynomial-quotient
function polynomialQuotient(r: Random): Case {
  const frame = pick(r, ["words", "tableau", "identity"] as const);
  for (;;) {
    const a = nonzero(r, -4, 4);
    const div = `x ${a < 0 ? "+" : "−"} ${Math.abs(a)}`;
    const desc = [pick(r, [1, 1, 2, -1]), r(-6, 6), r(-9, 9), r(-12, 12)];
    const { sums } = syntheticTableau(a, desc, "blank");
    const q = sums.slice(0, 3),
      rem = sums[3]!;
    const label = (qq: number[], rr: number) =>
      `${polyText(qq)}, remainder ${n(rr)}`;
    const neg = syntheticTableau(-a, desc, "blank").sums;
    const noShift = desc.slice(0, 3);
    const choices = options(label(q, rem), [
      {
        label: label(neg.slice(0, 3), neg[3]!),
        feedback: `This uses the wrong sign in synthetic division. For ${div}, use ${n(a)}, the zero of the divisor, not ${n(-a)}.`,
      },
      {
        label: label(noShift, desc[3]!),
        feedback:
          "This copies the top row. Those are the polynomial's own coefficients; multiply and add across before reading the bottom row.",
      },
      {
        label: label(q, -rem),
        feedback: `This flips the remainder's sign. The remainder is p(${n(a)}) = ${n(rem)}.`,
      },
      {
        label: label([q[0]!, q[1]!, -q[2]!], rem),
        feedback:
          "This has a sign slip in the quotient's last coefficient. Add each column, keeping signs.",
      },
    ]);
    if (!choices) continue;
    const shown = polyText(desc);
    const explanation = [
      `Dividing gives a quotient, the main result, and a remainder, what is left over. Synthetic division is a short way to divide by ${div}.`,
      `It uses ${n(a)}, the zero of the divisor, the value that makes ${div} zero. Bring down ${n(desc[0]!)}, then multiply by ${n(a)} and add down each column.`,
      `The bottom row is ${sums.map(n).join(", ")}. The first three are the quotient's coefficients, one power lower than $p$'s. The last is the remainder.`,
      `So ${shown} = (${div})(${polyText(q)})${constText(rem)}: quotient ${polyText(q)}, remainder ${n(rem)}.`,
    ];
    const walkthrough = syntheticTableau(a, desc, "filled").scene;
    if (frame === "tableau")
      return {
        prompt: `Use the layout to divide p(x) = ${shown} by ${div}. What are the quotient and remainder?`,
        choices,
        scene: syntheticTableau(a, desc, "blank").scene,
        explanation,
        hint: `Bring down ${n(desc[0]!)}, multiply by ${n(a)} and add to ${n(desc[1]!)}; repeat across the row.`,
        walkthrough,
        tags: [frame, rem === 0 ? "exact" : "remainder"],
      };
    if (frame === "identity")
      return {
        prompt: `${shown} = (${div})q(x) + R for a quadratic $q(x)$ and a number $R$. What are $q(x)$ and $R$?`,
        choices,
        explanation: [
          `R = p(${n(a)}) by the remainder theorem: ${substituted(desc, a)} = ${n(rem)}.`,
          ...explanation.slice(0, 3),
          `So q(x) = ${polyText(q)} and R = ${n(rem)}.`,
        ],
        hint: `$R$ is the value of ${shown} at x = ${n(a)}. For $q(x)$, divide by ${div} with ${n(a)} in the synthetic layout.`,
        walkthrough,
        tags: [frame, rem === 0 ? "exact" : "remainder"],
      };
    return {
      prompt: `Divide ${shown} by ${div}. What are the quotient and remainder?`,
      choices,
      explanation,
      hint: `The divisor ${div} is 0 at x = ${n(a)}: divide using ${n(a)}, starting with the leading coefficient ${n(desc[0]!)}.`,
      walkthrough,
      tags: [frame, rem === 0 ? "exact" : "remainder"],
    };
  }
}

const builders: Record<string, (r: Random) => Case> = {
  "parabola-vertex": parabolaVertex,
  "parabola-axis": parabolaAxis,
  "parabola-shift": parabolaShift,
  "binomial-area-product": areaModelProduct,
  "structure-meaning": structureMeaning,
  "structure-rewrite": structureRewrite,
  "zeros-from-factors": zerosFromFactors,
  "zero-multiplicity": zeroMultiplicity,
  "remainder-theorem": remainderTheorem,
  "polynomial-quotient": polynomialQuotient,
};
const labels: Record<string, string> = {
  "parabola-vertex": "Choose the vertex",
  "parabola-axis": "k",
  "parabola-shift": "Choose one",
  "binomial-area-product": "Choose the expression",
  "structure-meaning": "Choose the meaning",
  "structure-rewrite": "Choose the form",
  "zeros-from-factors": "Choose one",
  "zero-multiplicity": "Choose one",
  "remainder-theorem": "Answer",
  "polynomial-quotient": "Choose the quotient and remainder",
};
const fractionItems = new Set(["parabola-axis"]);

export function quadraticStructurePrintCase(id: string, seed: string) {
  const meta = quadraticStructureTemplates.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown quadratic-structure template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed);
  return assemble(
    meta,
    seed,
    builders[id]!(r),
    r,
    labels[id]!,
    fractionItems.has(id) ? "fraction" : "number",
  );
}
export const generateQuadraticStructureProblem = (
  id: string,
  seed: string,
): GeneratedProblem => quadraticStructurePrintCase(id, seed).problem;

export { fromRoots };
