import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { random, shuffle, type Random } from "./distribution-practice";
import { f as fn, graph, numberLine, scene as sceneOf } from "./scene/author";
import { CARD, problemOf, type Candidate } from "./figure-choice-practice";
import { linear } from "./regents-kit";

type R = (lo: number, hi: number) => number;
const fail = () => {
  throw new Error("Need three retries");
};
const figures = {
  requiredResponseCapability: "figure-choice-v1" as const,
  requiredFigureCapability: "scenes-v1" as const,
};

export const parabolaAxisVertexGraphTemplate: TemplateMetadata = {
  id: "parabola-axis-vertex-graph",
  version: 1,
  title: "Read the axis of symmetry and the vertex of a graphed parabola",
  skillId: "quadratic-graphs",
  gradeBand: "9–12",
  difficultyOffset: 0.35,
  requiredResponseCapability: "single-choice-v1",
  requiredFigureCapability: "scenes-v1",
  description:
    "From a drawn parabola opening up or down, choose the pair that gives the equation of its axis of symmetry and the coordinates of its vertex, among horizontal-axis, swapped-coordinate and sign choices.",
};
export const graphIsFunctionTemplate: TemplateMetadata = {
  id: "graph-is-function",
  version: 1,
  title: "Choose which drawn graph represents a function",
  skillId: "function-domain-range",
  gradeBand: "9–12",
  difficultyOffset: 0.3,
  ...figures,
  description:
    "Use the vertical line test to choose the one graph among four that represents a function, with a circle, a vertical line, a sideways corner or a sideways parabola as the graphs that fail.",
};
export const inequalityBothSidesLineTemplate: TemplateMetadata = {
  id: "inequality-both-sides-number-line",
  version: 1,
  title:
    "Solve an inequality with the variable on both sides and choose its number line",
  skillId: "linear-inequalities",
  gradeBand: "9–12",
  difficultyOffset: 0.5,
  ...figures,
  description:
    "Collect the variable terms on one side of an inequality, divide by a positive or negative coefficient, and choose the number line whose boundary is a halfway value, among graphs with the direction not reversed, the circle open or closed wrongly, or the boundary sign lost.",
};

/* ------------------------------------------------ parabola axis and vertex */
const GRID = { x: [-6, 6] as [number, number], y: [-6, 6] as [number, number] };
const plane = () =>
  graph({ ...GRID, grid: 1, tick: 2, aspect: 1, axisNames: ["x", "y"] });
const sg = (v: number) => (v < 0 ? `-${-v}` : `${v}`);
export const parabolaAxisVertexGraph = chainFamily({
  template: parabolaAxisVertexGraphTemplate,
  axes: { opens: defineAxis("opens", ["up", "down"] as const) },
  model: (r: R, ax) => {
    const h = r(-4, 4);
    const k = ax.opens === "up" ? r(-5, 1) : r(-1, 5);
    if (h === 0 && k === 0) fail();
    if (Math.abs(h) === Math.abs(k) || h === 0 || k === 0) fail();
    return { h, k, a: ax.opens === "up" ? 1 : -1 };
  },
  variant: (m) => `${m.a > 0 ? "up" : "down"}-${m.h < 0 ? "left" : "right"}`,
  render: (m, _ax, r) => {
    const { h, k } = m;
    const label = (axis: string, vx: number, vy: number) =>
      `$${axis}$ and vertex $(${sg(vx)}, ${sg(vy)})$`;
    const surface = choiceSurface(r, {
      prompt:
        "The graph of a parabola is shown. Which choice gives the equation of its axis of symmetry and the coordinates of its vertex?",
      label: "Choose the axis and vertex",
      options: [
        { label: label(`x = ${h}`, h, k), correct: true },
        {
          label: label(`y = ${k}`, h, k),
          feedback: `The axis of symmetry of a parabola that opens ${m.a > 0 ? "up" : "down"} is a vertical line, written $x = c$. A horizontal line $y = ${k}$ passes through the vertex but does not split the parabola into mirror images.`,
        },
        {
          label: label(`x = ${k}`, k, h),
          feedback:
            "The vertex is written $(x, y)$: the first coordinate is read across and the second is read up or down. This choice swaps them.",
        },
        {
          label: label(`x = ${h}`, k, h),
          feedback: `The axis $x = ${h}$ is right, but the vertex is written $(x, y)$: its first coordinate is how far across to go, ${h}, and the second is how far up or down, ${k}. This choice has them in the wrong order.`,
        },
        {
          label: label(`x = ${-h}`, -h, k),
          feedback:
            "Read the sign of the $x$-coordinate from which side of the $y$-axis the vertex is on, not from the opposite side.",
        },
      ],
      hint: `The axis of symmetry is the vertical line through the vertex. This parabola opens ${m.a > 0 ? "up" : "down"}, so its vertex is its ${m.a > 0 ? "lowest" : "highest"} point: read its coordinates: across from the $y$-axis first, then up or down from the $x$-axis.`,
      explanation: [
        `A parabola is the U-shaped graph of a quadratic. Its vertex is the point where it turns: here ${m.a > 0 ? "its lowest point, since it opens up" : "its highest point, since it opens down"}.`,
        `Read the vertex from the grid: ${sg(h)} across from the $y$-axis, then ${sg(k)} up or down. As an ordered pair $(x, y)$ it is $(${sg(h)}, ${sg(k)})$.`,
        `The axis of symmetry is the vertical line through the vertex that splits the parabola into mirror halves.`,
        `Every point on a vertical line has the same $x$-coordinate, so its equation is $x = ${h}$, not a $y =$ equation.`,
        `The axis of symmetry is $x = ${h}$ and the vertex is $(${sg(h)}, ${sg(k)})$.`,
      ],
    });
    if (!surface) return null;
    const plot = plane().curve(fn.vertex(m.a, h, k), { color: "accent" });
    return {
      ...surface,
      figure: { kind: "scene" as const, scene: sceneOf(plot).build(CARD) },
    };
  },
});

/* ------------------------------------------------ graph is a function */
const point = ([x, y]: [number, number]) => `(${sg(x)}, ${sg(y)})`;
type Shape = {
  description: string;
  plot: ReturnType<typeof plane>;
  failsAt?: string;
};
function functionShape(r: Random): Shape {
  const kind = r(0, 3);
  if (kind === 0) {
    const h = r(-2, 2);
    const k = r(-3, 3);
    const a = r(0, 1) ? 1 : -1;
    return {
      description: `A parabola opening ${a > 0 ? "up" : "down"} with its vertex at ${point([h, k])}.`,
      plot: plane().curve(fn.vertex(a, h, k), { color: "accent" }),
    };
  }
  if (kind === 1) {
    const b = r(-3, 3);
    const m = pick(r, [1, 2, -1, -2] as const);
    return {
      description: `A line through ${point([0, b])} and ${point([1, b + m])}, ${m > 0 ? "rising" : "falling"} from left to right.`,
      plot: plane().line(
        {
          through: [
            [0, b],
            [1, b + m],
          ],
        },
        { color: "accent" },
      ),
    };
  }
  if (kind === 2) {
    const h = r(-2, 2);
    const k = r(-3, 1);
    return {
      description: `A graph of two straight rays meeting at ${point([h, k])} and opening up.`,
      plot: plane()
        .segment([h, k], [h + 4, k + 4], { color: "accent" })
        .segment([h, k], [h - 4, k + 4], { color: "accent" }),
    };
  }
  return {
    description:
      "An S-shaped curve through the origin: it rises, dips near the middle and rises again.",
    plot: plane().curve(fn.poly(0.25, 0, -1, 0), { color: "accent" }),
  };
}
function nonFunctionShapes(r: Random): Shape[] {
  const circleCx = r(-2, 2);
  const circleCy = r(-2, 2);
  const radius = r(2, 3);
  const vertical = r(-4, 4);
  const sidewaysV = r(-4, -1);
  const sidewaysP = r(-4, 0);
  const pool: Shape[] = [
    {
      description: `A circle with its center at ${point([circleCx, circleCy])} and radius ${radius}.`,
      plot: plane().circle([circleCx, circleCy], radius),
      failsAt: `the vertical line $x = ${circleCx}$ crosses the circle at $(${sg(circleCx)}, ${sg(circleCy + radius)})$ and $(${sg(circleCx)}, ${sg(circleCy - radius)})$`,
    },
    {
      description: `A vertical line through ${point([vertical, 0])}.`,
      plot: plane().segment([vertical, -6], [vertical, 6], { color: "accent" }),
      failsAt: `the line $x = ${vertical}$ is a vertical line, so it meets the graph at every point $(${sg(vertical)}, y)$`,
    },
    {
      description: `A graph of two straight rays meeting at ${point([sidewaysV, 0])} and opening to the right.`,
      plot: plane()
        .segment([sidewaysV, 0], [sidewaysV + 5, 5], { color: "accent" })
        .segment([sidewaysV, 0], [sidewaysV + 5, -5], { color: "accent" }),
      failsAt: `the vertical line $x = ${sidewaysV + 3}$ crosses it at $(${sg(sidewaysV + 3)}, 3)$ and $(${sg(sidewaysV + 3)}, -3)$`,
    },
    {
      description: `A parabola opening to the right with its vertex at ${point([sidewaysP, 0])}.`,
      plot: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4].reduce(
        (g, y) =>
          g.segment(
            [sidewaysP + (y * y) / 5, y],
            [sidewaysP + ((y + 1) * (y + 1)) / 5, y + 1],
            { color: "accent" },
          ),
        plane(),
      ),
      failsAt: `the vertical line $x = ${sidewaysP + 5}$ crosses it at $(${sg(sidewaysP + 5)}, 5)$ and $(${sg(sidewaysP + 5)}, -5)$`,
    },
  ];
  return shuffle(r, pool).slice(0, 3);
}
function graphIsFunction(seed: string): GeneratedProblem {
  const meta = graphIsFunctionTemplate;
  const r = random(meta.id, seed);
  const probe = r(-4, 4);
  const good = functionShape(r);
  const bad = nonFunctionShapes(r);
  const toCandidate = (
    s: Shape,
    feedback?: (name: string) => string,
  ): Candidate => ({
    description: s.description,
    scene: sceneOf(s.plot).build(CARD),
    ...(feedback ? { feedback } : {}),
  });
  return problemOf(meta, seed, r, {
    prompt: "Which graph represents a function?",
    label: "Choose the graph",
    noun: "Graph",
    correct: toCandidate(good),
    distractors: bad.map((s) =>
      toCandidate(
        s,
        (name) =>
          `${name} is not a function: ${s.failsAt}, so one input has two outputs.`,
      ),
    ),
    hint: `A graph represents a function when each input $x$ has exactly one output $y$. Picture the vertical line $x = ${probe}$ on each graph, then slide it left and right: it must never touch the graph in more than one place.`,
    explanation: (name) => [
      "A function gives exactly one output $y$ for each input $x$.",
      "Every point on a vertical line has the same input $x$. If a vertical line crosses a graph twice, that input has two outputs.",
      "So a graph is a function when no vertical line crosses it more than once. This is the vertical line test.",
      "Each of the other three graphs has a vertical line that crosses it in two or more points.",
      `${name} passes the vertical line test, so it represents a function.`,
    ],
    walkthrough: sceneOf(good.plot).build({
      title: "A graph that passes the vertical line test",
      width: 300,
      maxHeight: 300,
    }),
  });
}

/* ------------------------------------------------ inequality both sides */
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
const STRIP = { width: 260, maxHeight: 110 } as const;
const half = (v: number) =>
  Number.isInteger(v)
    ? String(v)
    : `${v < 0 ? "-" : ""}\\frac{${Math.abs(v) * 2}}{2}`;
const halfPlain = (v: number) => (v < 0 ? `−${Math.abs(v)}` : String(v));
function rayCard(
  c: number,
  op: Op,
  lo: number,
  hi: number,
  labels: number[],
  feedback?: (name: string) => string,
): Candidate {
  const right = rightward(op);
  const open = !closed(op);
  return {
    description: `${open ? "An open" : "A closed"} circle at ${halfPlain(c)} with the ray shaded to the ${right ? "right" : "left"}.`,
    scene: numberLine({ min: lo, max: hi, step: 1, denominator: 2, labels })
      .interval(right ? c : null, right ? null : c, [
        right && open,
        !right && open,
      ])
      .scene(STRIP),
    ...(feedback ? { feedback } : {}),
  };
}
function inequalityBothSides(seed: string): GeneratedProblem {
  const meta = inequalityBothSidesLineTemplate;
  const r = random(meta.id, seed);
  for (let attempt = 0; attempt < 300; attempt++) {
    const A = pick(r, [2, 4, 6, -2, -4, -6] as const);
    const k = pick(r, [1, 3, 5, 7, -1, -3, -5, -7] as const);
    const x0 = k / 2;
    const D = (k * A) / 2;
    if (!Number.isInteger(D)) continue;
    const c = pick(r, [-4, -3, -2, -1, 1, 2, 3, 4] as const);
    const a = c + A;
    if (a === 0) continue;
    const b = r(-9, 9);
    const d = b + D;
    const op = pick(r, OPS);
    const answerOp = A < 0 ? flip[op] : op;
    const reach = Math.ceil(Math.abs(x0)) + 2;
    const lo = -reach;
    const hi = reach;
    const labels = [
      ...new Set([lo, hi, x0, -x0, ...(Math.abs(x0) > 1 ? [0] : [])]),
    ].sort((p, q) => p - q);
    const statement = `${linear(a, b)} ${texOp[op]} ${linear(c, d)}`;
    const correct = rayCard(x0, answerOp, lo, hi, labels);
    const distractors = [
      rayCard(x0, flip[answerOp], lo, hi, labels, (name) =>
        A < 0
          ? `${name} points the wrong way: dividing both sides by the negative number ${A} reverses the inequality sign, which this graph does not.`
          : `${name} points the wrong way: the solutions are the numbers ${rightward(answerOp) ? "greater" : "less"} than ${halfPlain(x0)}.`,
      ),
      rayCard(
        x0,
        toggle[answerOp],
        lo,
        hi,
        labels,
        (name) =>
          `${name} has ${closed(answerOp) ? "an open" : "a closed"} circle at ${halfPlain(x0)}, but the inequality sign is ${closed(answerOp) ? "“or equal to”, so the endpoint is a solution" : "strict, so the endpoint is not a solution"}.`,
      ),
      rayCard(
        -x0,
        answerOp,
        lo,
        hi,
        labels,
        (name) =>
          `${name} starts at ${halfPlain(-x0)}, the opposite of the boundary. Check the sign of ${D} ÷ ${A} when you divide.`,
      ),
    ];
    const boundaryTex = `x ${texOp[answerOp]} ${half(x0)}`;
    return problemOf(meta, seed, r, {
      prompt: `Which number line shows the solutions of $${statement}$?`,
      label: "Choose the number line",
      noun: "Number line",
      correct,
      distractors,
      hint: `Collect the $x$ terms on one side: subtract $${linear(c, 0)}$ from both sides, and move the constant ${b} across. Then divide by ${A}${A < 0 ? " and reverse the inequality sign, since you divide by a negative number" : ""}.`,
      explanation: (name) => [
        `Solve an inequality like an equation, with one extra rule: dividing or multiplying by a negative number flips the sign.`,
        `Gather the $x$ terms on the left. ${c < 0 ? `Add $${linear(-c, 0)}$ to` : `Subtract $${linear(c, 0)}$ from`} both sides: $${linear(A, b)} ${texOp[op]} ${d}$.`,
        b === 0
          ? `There is no plain number on the left to move: $${linear(A, 0)} ${texOp[op]} ${D}$.`
          : `Move the plain number. ${b < 0 ? `Add ${-b} to` : `Subtract ${b} from`} both sides: $${linear(A, 0)} ${texOp[op]} ${D}$.`,
        A < 0
          ? `Divide both sides by ${A}. It is negative, so the sign flips. For example, 2 < 3 but −2 > −3. That gives $${boundaryTex}$.`
          : `Divide both sides by ${A}. It is positive, so the sign stays: $${boundaryTex}$.`,
        `On a number line, a closed (filled) circle means the endpoint is included, for ≤ or ≥. An open circle means it is not, for < or >.`,
        `${name} shows the solutions: ${closed(answerOp) ? "a closed" : "an open"} circle at ${halfPlain(x0)} with the ray to the ${rightward(answerOp) ? "right" : "left"}.`,
      ],
      walkthrough: numberLine({ min: lo, max: hi, step: 1, denominator: 2 })
        .interval(
          rightward(answerOp) ? x0 : null,
          rightward(answerOp) ? null : x0,
          [
            rightward(answerOp) && !closed(answerOp),
            !rightward(answerOp) && !closed(answerOp),
          ],
        )
        .scene({
          title: `The solutions of x ${answerOp} ${halfPlain(x0)}`,
          width: 320,
          maxHeight: 120,
        }),
    });
  }
  throw new Error(`${meta.id}: no instance for ${seed}`);
}

export const regentsAlgebraOneFigureTemplates = [
  parabolaAxisVertexGraphTemplate,
  graphIsFunctionTemplate,
  inequalityBothSidesLineTemplate,
];
export const regentsAlgebraOneFigureGenerate = dispatch(
  regentsAlgebraOneFigureTemplates,
  {
    "parabola-axis-vertex-graph": (s) =>
      parabolaAxisVertexGraph.generate(s).problem,
    "graph-is-function": graphIsFunction,
    "inequality-both-sides-number-line": inequalityBothSides,
  },
);
