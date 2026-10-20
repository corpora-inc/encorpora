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
              feedback: `x = ${n(-h)} is b/(2a) without its minus sign; the vertex is at x = −b/(2a).`,
            },
            {
              label: pt(h, c),
              feedback: `${n(c)} is the $y$-intercept, the value at x = 0, not at the vertex.`,
            },
            {
              label: pt(-h, k),
              feedback: "Check the sign of x: −b/(2a) is the vertex.",
            },
            { label: pt(k, h), feedback: "The coordinates are reversed." },
          ]
        : [
            {
              label: pt(-h, k),
              feedback: `In ${vertexForm(a, h, k)} the factor ${factor(h)} is 0 at x = ${n(h)}, not ${n(-h)}.`,
            },
            {
              label: pt(k, h),
              feedback: "The $x$- and $y$-coordinates are reversed.",
            },
            {
              label: pt(h, -k),
              feedback: `Check the sign of the $y$-coordinate: ${n(k)}.`,
            },
            {
              label: pt(-h, -k),
              feedback: "Both signs are reversed.",
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
          `The parabola opens ${a > 0 ? "up" : "down"}, so its vertex is its ${turn} point.`,
          `That point is ${correct}: x = ${n(h)} on the $x$-axis and y = ${n(k)} on the $y$-axis.`,
          `The graph is y = ${vertexForm(a, h, k)}, symmetric about the line x = ${n(h)}.`,
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
          "In y = a(x − h)² + k the squared term is 0 at x = h and has one sign everywhere else, so $y$ is " +
            (a > 0 ? "least" : "greatest") +
            " there: the vertex is $(h, k)$.",
          `${factor(h)} is 0 when x = ${n(h)}; then y = ${n(k)}.`,
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
        `The vertex is on the axis of symmetry, x = −b/(2a) = ${quotient(-b, 2 * a)}.`,
        `Substitute: y = ${quadAtText(a, b, c, h)} = ${n(k)}.`,
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
        "A parabola y = ax² + bx + c is symmetric about the line x = −b/(2a).",
        `Here a = ${n(a)} and b = ${n(b)}: x = −b/(2a) = ${quotient(-b, 2 * a)}.`,
        `So k = ${qt(axis)}.`,
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
    "A parabola is symmetric about a vertical line, so two points at the same height are mirror images across it.",
    `The axis is halfway between x = ${n(lo)} and x = ${n(hi)}: ${mid}.`,
    `So k = ${qt(axis)}.`,
  ];
  const tags = [frame, axis.d === 1 ? "integer" : "fraction"];
  if (frame === "factored") {
    const a = pick(r, [1, -1, 2, -3]);
    const form = `${lead(a)}${factor(lo)}${factor(hi)}`;
    return {
      prompt: `The graph of y = ${form} is a parabola. Its axis of symmetry is the line x = k. What is $k$?`,
      answer: axis,
      explanation: [
        `y = 0 when a factor is 0: at x = ${n(lo)} and x = ${n(hi)}. Both zeros are on the $x$-axis, at height 0.`,
        ...explain.slice(1),
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
      ...explain.slice(1),
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
          feedback: `(x − h)² moves the graph $h$ to the right: ${factor(h)} gives h = ${n(h)}.`,
        },
        {
          label: `It moves ${moves(h, -k)}.`,
          feedback: `Adding ${n(k)} outside the square changes every $y$-value by ${n(k)}.`,
        },
        {
          label: `It moves ${moves(k, h)}.`,
          feedback:
            "The number inside the parentheses moves the graph sideways; the number outside moves it up or down.",
        },
        {
          label: `It moves ${moves(-h, -k)}.`,
          feedback: "Both directions are reversed.",
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `How does the graph of ${eq(h, k)} compare with the graph of y = x²?`,
        choices,
        explanation: [
          "In y = (x − h)² + k every point of y = x² moves $h$ across and $k$ up: the vertex (0, 0) goes to $(h, k)$.",
          `Here ${factor(h)} gives h = ${n(h)}, and the constant outside the square gives k = ${n(k)}.`,
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
        feedback: `A move ${h > 0 ? "right" : "left"} by ${Math.abs(h)} subtracts ${n(h)} from x: x − (${n(h)}).`,
      },
      {
        label: eq(k, h),
        feedback: "The horizontal and vertical moves are swapped.",
      },
      {
        label: eq(h, -k),
        feedback: `The vertical move is ${n(k)}: add ${n(k)} outside the square.`,
      },
      { label: eq(-h, -k), feedback: "Both signs are reversed." },
    ]);
    if (!choices) continue;
    if (frame === "words")
      return {
        prompt: `The graph of y = x² is moved ${moves(h, k)}. Which equation describes the new graph?`,
        choices,
        explanation: [
          `Moving ${Math.abs(h)} ${h > 0 ? "right" : "left"} replaces $x$ with ${factor(h).slice(1, -1)}; moving ${Math.abs(k)} ${k > 0 ? "up" : "down"} adds ${n(k)}.`,
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
        `The vertex moved from (0, 0) to ${pt(h, k)}: ${moves(h, k)}.`,
        `Moving $h$ across and $k$ up gives y = (x − h)² + k, so the equation is ${eq(h, k)}.`,
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
        feedback: `This leaves out the two $x$-regions, $${termText(a * u, "x")}$ and $${termText(b * s, "x")}$.`,
      },
      {
        label: polyText([a * b, a * u - b * s, s * u]),
        feedback: `One $x$-region has the wrong sign: ${termText(a, "x")} × ${p(u)} and ${n(s)} × ${termText(b, "x")}.`,
      },
      {
        label: polyText([a * b, mid, -s * u]),
        feedback: `${n(s)} × ${p(u)} = ${n(s * u)}.`,
      },
      {
        label: polyText([a * b, s + u, s * u]),
        feedback:
          "Each $x$-region is a coefficient times the other side's constant.",
      },
    ]);
    if (!choices) continue;
    const explanation = [
      `Each term of ${left} multiplies each term of ${right}: four regions.`,
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
              ? `At t = 1, h = −16 + ${v} + ${s} = ${-16 + v + s}, not one term alone.`
              : label === labels.top
                ? `The greatest height is at the vertex, t = ${v}/32, not a coefficient.`
                : "Set t = 0 to see which term is the release height.",
        })),
      ],
      explanation: [
        `At release, t = 0: h = −16(0)² + ${v}(0) + ${s} = ${s}. The constant term is the starting height.`,
        `The term ${v}t grows by ${v} feet each second at first: ${v} is the upward speed at release, in feet per second. −16t² is gravity slowing the ball.`,
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
              ? `One ${job[1]} costs ${fee} + ${rate} = ${fee + rate} dollars in all.`
              : "Ask which number changes the cost when the count changes.",
        })),
      ],
      explanation: [
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
            ? "The exponent $t$ means repeated multiplication, not repeated addition."
            : label === labels.after
              ? `After one year P = ${start} × ${factorText}, a product of both numbers.`
              : "Put t = 0, then t = 1, and compare.",
      })),
    ],
    explanation: [
      `At t = 0, ${factorText}⁰ = 1, so P = ${start}: the starting population.`,
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
          feedback: `(x² − ${sq})² = x⁴ − ${2 * sq}x² + ${sq * sq}: it has a middle term.`,
        },
        {
          label: `(x − ${sq})(x + ${sq})`,
          feedback: `(x − ${sq})(x + ${sq}) = x² − ${sq * sq}, a square of $x$, not x⁴.`,
        },
        {
          label: `(x² − ${m})(x² + ${m})`,
          feedback: `(x² − ${m})(x² + ${m}) = x⁴ − ${sq}.`,
        },
        {
          label: `(x⁴ − ${sq})(x⁴ + ${sq})`,
          feedback: "x⁴ is (x²)², so each factor holds x², not x⁴.",
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `Write x⁴ − ${sq * sq} as a difference of two squares. Which product is equal to it?`,
        choices,
        explanation: [
          `x⁴ = (x²)² and ${sq * sq} = ${sq}², so x⁴ − ${sq * sq} = (x²)² − ${sq}².`,
          `A² − B² = (A − B)(A + B) with A = x² and B = ${sq}.`,
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
          feedback: `Expanding gives x² ${-2 * pp < 0 ? "−" : "+"} ${Math.abs(2 * pp)}x ${pp * pp - q * q < 0 ? "−" : "+"} ${Math.abs(pp * pp - q * q)}: the signs are reversed.`,
        },
        {
          label: label(pp - q * q, pp + q * q),
          feedback: `${q * q} is ${q}²: $B$ is ${q}, not ${q * q}.`,
        },
        {
          label: `${fac(pp - q)}²`,
          feedback: "A difference of squares has two different factors.",
        },
        {
          label: label(q - pp, q + pp),
          feedback: `$A = x ${pp < 0 ? "−" : "+"} ${Math.abs(pp)}$: keep its sign.`,
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `Treat ${inner} as a single quantity. Which product equals ${inner}² − ${q * q}?`,
        choices,
        explanation: [
          `Let $A = x${constText(pp)}$. Then ${inner}² − ${q * q} = A² − ${q}².`,
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
        feedback: `(${termText(m * m, "x")}${constText(k * k)})² starts with ${m ** 4}x².`,
      },
      {
        label: sq(m, -k),
        feedback: `The middle term's sign is the sign of the constant inside: ${n(2 * m * k)}x.`,
      },
      {
        label: sq(m * m, k),
        feedback: `${m * m}x² is (${m}x)², so the first term inside is ${m}x.`,
      },
      {
        label: sq(m, k * k),
        feedback: `${k * k} is (${n(k)})², so the constant inside is ${n(k)}.`,
      },
    ]);
    if (!choices) continue;
    return {
      prompt: `Which square is equal to ${expr}?`,
      choices,
      explanation: [
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
          feedback: `${factor(sorted[0]!)} is 0 when x = ${n(sorted[0]!)}, the opposite of the number shown.`,
        },
        {
          label: set([sorted[0]!, sorted[1]!, -sorted[2]!]),
          feedback: `Check ${factor(sorted[2]!)}: it is 0 at x = ${n(sorted[2]!)}.`,
        },
        {
          label: set([-sorted[0]!, sorted[1]!, sorted[2]!]),
          feedback: `Check ${factor(sorted[0]!)}: it is 0 at x = ${n(sorted[0]!)}.`,
        },
        {
          label: set([sorted[0]!, -sorted[1]!, sorted[2]!]),
          feedback: `Check ${factor(sorted[1]!)}: it is 0 at x = ${n(sorted[1]!)}.`,
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `What are the zeros of ${form(roots).replace("y = ", "y = ")}?`,
        choices,
        explanation: [
          "A product is 0 exactly when one of its factors is 0.",
          sorted.map((z) => `${factor(z)} = 0 when x = ${n(z)}`).join("; ") +
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
          feedback: `This is 0 at ${set(sorted.map((z) => -z))}.`,
        },
        {
          label: form([sorted[0]!, sorted[1]!, -sorted[2]!]),
          feedback: `This is 0 at x = ${n(-sorted[2]!)}, not ${n(sorted[2]!)}.`,
        },
        {
          label: form([-sorted[0]!, sorted[1]!, sorted[2]!]),
          feedback: `This is 0 at x = ${n(-sorted[0]!)}, not ${n(sorted[0]!)}.`,
        },
        {
          label: form([sorted[0]!, -sorted[1]!, sorted[2]!]),
          feedback: `This is 0 at x = ${n(-sorted[1]!)}, not ${n(sorted[1]!)}.`,
        },
      ]);
      if (!choices) continue;
      return {
        prompt: `Which polynomial has zeros at ${sorted.map((z) => `x = ${n(z)}`).join(", ")} and nowhere else?`,
        choices,
        explanation: [
          "A zero at x = r comes from the factor (x − r), which is 0 exactly at $r$.",
          sorted
            .map((z) => `the factor for x = ${n(z)} is ${factor(z)}`)
            .join("; ") + ".",
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
          "Each factor (x − r) is 0 at $r$; these factors are 0 at the opposite numbers.",
      },
      {
        label: form(sorted, -lc),
        feedback: `The graph ${lc > 0 ? "rises" : "falls"} to the right, so the leading coefficient is ${lc > 0 ? "positive" : "negative"}.`,
      },
      {
        label: form([sorted[0]!, sorted[1]!, sorted[2]! + 1]),
        feedback: `This is 0 at x = ${n(sorted[2]! + 1)}; the graph crosses at x = ${n(sorted[2]!)}.`,
      },
      {
        label: form([sorted[0]! - 1, sorted[1]!, sorted[2]!]),
        feedback: `This is 0 at x = ${n(sorted[0]! - 1)}; the graph crosses at x = ${n(sorted[0]!)}.`,
      },
    ]);
    if (!choices) continue;
    return {
      prompt: "Which equation could the graph show?",
      choices,
      scene: zerosGraph(lc, sorted),
      explanation: [
        `The graph crosses the $x$-axis at ${sorted.map(n).join(", ")}: each needs a factor (x − r).`,
        `It ${lc > 0 ? "rises" : "falls"} to the right, so the leading coefficient is ${lc > 0 ? "positive" : "negative"}.`,
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
            feedback: `The squared factor is ${factor(d)}²: the touching zero is x = ${n(d)}.`,
          },
          {
            label: `The graph crosses the $x$-axis at x = ${n(d)} and at x = ${n(s)}.`,
            feedback: `${factor(d)}² does not change sign at x = ${n(d)}.`,
          },
          {
            label: `The graph touches the $x$-axis at x = ${n(d)} and at x = ${n(s)}.`,
            feedback: `$${factor(s)}$ changes sign at $x = ${n(s)}$.`,
          },
        ].concat([
          {
            label: desc([-d], [-s]),
            feedback: "Each factor (x − r) is 0 at $r$, not at −r.",
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
          feedback: `This touches at $x = ${n(s)}$ and crosses at $x = ${n(d)}$.`,
        },
        {
          label: `y = ${factor(d)}${factor(s)}`,
          feedback: "With no squared factor the graph crosses at both zeros.",
        },
        {
          label: form(-d, -s, 1),
          feedback: "Each factor (x − r) is 0 at $r$, not at −r.",
        },
        {
          label: `y = ${factor(d)}${factor(s)}²`,
          feedback: `This touches at $x = ${n(s)}$.`,
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
        feedback: `The graph touches at $x = ${n(d)}$: that factor is the squared one.`,
      },
      {
        label: `y = ${lead(lc)}${factor(d)}${factor(s)}`,
        feedback: `A parabola would cross at x = ${n(d)}; this graph only touches there.`,
      },
      {
        label: form(d, s, -lc),
        feedback: `Check the right end: the graph ${lc > 0 ? "rises" : "falls"}.`,
      },
      {
        label: form(-d, -s),
        feedback: "Each factor (x − r) is 0 at $r$, not at −r.",
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
          `x − a is a factor exactly when $p(a) = 0$ (the factor theorem). Here a = ${n(a)}.`,
          `$p(${n(a)}) = ${p(a)}³${b ? ` ${b < 0 ? "−" : "+"} ${Math.abs(b)} × ${p(a)}²` : ""} + k × ${p(a)}${constText(d)} = ${n(a ** 3 + b * a * a + d)} ${a < 0 ? "−" : "+"} ${Math.abs(a)}k$.`,
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
    `The remainder of p(x) ÷ (x − a) is $p(a)$ (the remainder theorem). Here a = ${n(a)}.`,
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
        feedback: `Dividing by ${div} uses ${n(a)}, the zero of the divisor, not ${n(-a)}.`,
      },
      {
        label: label(noShift, desc[3]!),
        feedback:
          "These are p's own first coefficients: multiply and add across before reading the bottom row.",
      },
      {
        label: label(q, -rem),
        feedback: `The remainder is p(${n(a)}) = ${n(rem)}.`,
      },
      {
        label: label([q[0]!, q[1]!, -q[2]!], rem),
        feedback:
          "Check the last coefficient of the quotient: add each column.",
      },
    ]);
    if (!choices) continue;
    const shown = polyText(desc);
    const explanation = [
      `To divide by ${div}, use ${n(a)} in synthetic division: bring down ${n(desc[0]!)}, then multiply by ${n(a)} and add down each column.`,
      `The bottom row is ${sums.map(n).join(", ")}. The first three are the quotient's coefficients and the last is the remainder.`,
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
          ...explanation.slice(0, 2),
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
