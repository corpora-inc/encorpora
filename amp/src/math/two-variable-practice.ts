import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { act, graph, lessonStep, lineTable, step } from "./scene/author";
import type { LineTable as Table } from "./scene/spec";
import {
  assemble,
  constText,
  n,
  nonzero,
  pick,
  quotient,
  rat,
  seeded,
  shuffle,
  termText,
  twoTerm,
  type Case,
  type Choice,
  type Random,
} from "./algebra-one-kit";

/** Algebra 1: equations, inequalities and systems in two variables — models
 * with two unknowns and with constraints, half-plane regions, literal
 * equations, the reason for each equation step, and why elimination keeps a
 * system's solutions (HSA.CED.A.3, HSA.REI.A.1, B.3, C.5, C.6, D.12). */
/** Money in words: "$" would open a math span in MathText. */
const usd = (v: number) => (v === 1 ? "1 dollar" : `${v} dollars`);
const choice = { requiredResponseCapability: "single-choice-v1" as const };
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const hs = { version: 1 as const, gradeBand: "9–12" as const };

export const twoVariableTemplates: readonly TemplateMetadata[] = [
  {
    ...hs,
    id: "system-model-value",
    title: "Solve a two-variable model",
    skillId: "systems-modeling",
    description:
      "Write two equations for a situation with two unknown amounts (tickets, flowers, test questions, coins) and solve for the one asked.",
  },
  {
    ...hs,
    id: "constraint-feasible",
    title: "Meet every constraint",
    skillId: "systems-modeling",
    description:
      "Read a situation's limits as a system of inequalities and choose the combination that meets all of them, with the feasible region shaded.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "half-plane-inequality",
    title: "Which inequality is graphed?",
    skillId: "inequality-regions",
    description:
      "Read a shaded half-plane, or the overlap of two: the boundary line, solid or dashed, and the side that is shaded.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "inequality-solution-point",
    title: "Test points against an inequality",
    skillId: "inequality-regions",
    description:
      "Decide which point solves a two-variable inequality by substituting it, including points on a solid or a dashed boundary.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "literal-equation-solve",
    title: "Solve with a letter for a number",
    skillId: "symbolic-linear-constraints",
    description:
      "Solve a linear equation or inequality with a letter as a coefficient, using the stated condition $(k \\neq  3, k < 0)$ that each step needs.",
    ...choice,
  },
  {
    ...hs,
    id: "parameter-solution-count",
    title: "No solution or infinitely many",
    skillId: "symbolic-linear-constraints",
    description:
      "Find the value of a parameter that gives a linear equation or system no solution or infinitely many.",
  },
  {
    ...hs,
    id: "equation-step-property",
    title: "Justify each step",
    skillId: "equation-reasoning",
    description:
      "Name the property that justifies a step in solving a linear equation, or find the step that breaks the equality.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "elimination-equivalent",
    title: "Why elimination works",
    skillId: "elimination-proof",
    description:
      "Add two equations, or a multiple of one to the other, and recognize the equivalent system and the reason it keeps every solution.",
    ...choice,
    ...scenes,
  },
];

const pair = (x: number, y: number) => `(${n(x)}, ${n(y)})`;
/** Up to three distinct wrong options, never equal to the correct one. */
function distinct(correct: string, candidates: Choice[]) {
  const seen = new Set([correct]);
  const out: Choice[] = [];
  for (const c of candidates)
    if (!seen.has(c.label) && out.length < 3) {
      seen.add(c.label);
      out.push(c);
    }
  if (out.length < 3) throw new Error(`Too few distractors for ${correct}`);
  return out;
}

/** distinct(), or null when the candidates collapse (the caller redraws). */
function maybeDistinct(correct: string, candidates: Choice[]) {
  try {
    return distinct(correct, candidates);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ half-planes
type Op = "<" | "<=" | ">" | ">=";
const sym: Record<Op, string> = { "<": "<", "<=": "≤", ">": ">", ">=": "≥" };
const flip: Record<Op, Op> = { "<": ">", "<=": ">=", ">": "<", ">=": "<=" };
const swapStrict: Record<Op, Op> = {
  "<": "<=",
  "<=": "<",
  ">": ">=",
  ">=": ">",
};
const strict = (op: Op) => op === "<" || op === ">";
const holdsOp = (l: number, op: Op, r: number) =>
  op === "<" ? l < r : op === "<=" ? l <= r : op === ">" ? l > r : l >= r;
type Half = {
  /** a·x + b·y (op) c */
  a: number;
  b: number;
  c: number;
  op: Op;
  text: string;
  test: (x: number, y: number) => boolean;
};
function slopeCoef(num: number, den: number) {
  const m = rat(num, den);
  if (m.d === 1) return termText(m.n, "x");
  return `${m.n < 0 ? "−" : ""}${Math.abs(m.n)}/${m.d}x`;
}
/** y (op) (num/den)x + b, stored as −num·x + den·y (op) den·b. */
function slopeHalf(num: number, den: number, b: number, op: Op): Half {
  const mx = slopeCoef(num, den);
  return {
    a: -num,
    b: den,
    c: den * b,
    op,
    text: `y ${sym[op]} ${mx ? `${mx}${constText(b)}` : n(b)}`,
    test: (x, y) => holdsOp(den * y, op, num * x + den * b),
  };
}
function standardHalf(a: number, b: number, c: number, op: Op): Half {
  return {
    a,
    b,
    c,
    op,
    text: `${twoTerm(a, b)} ${sym[op]} ${n(c)}`,
    test: (x, y) => holdsOp(a * x + b * y, op, c),
  };
}
function axisHalf(v: "x" | "y", k: number, op: Op): Half {
  return {
    a: v === "x" ? 1 : 0,
    b: v === "y" ? 1 : 0,
    c: k,
    op,
    text: `${v} ${sym[op]} ${n(k)}`,
    test: (x, y) => holdsOp(v === "x" ? x : y, op, k),
  };
}
const plane = (h: Half) => ({ a: h.a, b: h.b, c: h.c, op: h.op });
const boundaryWords = (h: Half) =>
  strict(h.op)
    ? "a dashed boundary, so points on the line are not included"
    : "a solid boundary, so points on the line are included";

// ------------------------------------------------------------ system-model-value
function systemModelValue(r: Random): Case {
  const kind = pick(r, ["tickets", "flowers", "test", "coins"] as const);
  const [pa, pb] =
    kind === "tickets"
      ? [r(9, 15), r(4, 8)]
      : kind === "flowers"
        ? [r(3, 6), r(1, 2)]
        : kind === "test"
          ? [r(4, 6), r(2, 3)]
          : [25, 10];
  const a = r(3, 18),
    b = r(3, 18);
  const total = a + b,
    value = pa * a + pb * b;
  const askFirst = r(0, 1) === 0;
  const names = {
    tickets: ["adult tickets", "child tickets"],
    flowers: ["roses", "tulips"],
    test: [`${pa}-point questions`, `${pb}-point questions`],
    coins: ["quarters", "dimes"],
  }[kind];
  const story = {
    tickets: `A theater sold ${total} tickets for ${usd(value)}. Adult tickets cost ${usd(pa)} and child tickets cost ${usd(pb)}. How many ${names[askFirst ? 0 : 1]} were sold?`,
    flowers: `A bouquet of ${total} roses and tulips costs ${usd(value)}. Roses cost ${usd(pa)} each and tulips cost ${usd(pb)} each. How many ${names[askFirst ? 0 : 1]} are in it?`,
    test: `A test has ${total} questions, each worth ${pa} points or ${pb} points, for ${value} points in all. How many ${names[askFirst ? 0 : 1]} are on it?`,
    coins: `A jar holds ${total} coins, all quarters and dimes, worth ${value} cents in all. How many ${names[askFirst ? 0 : 1]} are in it?`,
  }[kind];
  const what =
    kind === "test" ? "points" : kind === "coins" ? "cents" : "dollars";
  const ans = askFirst ? a : b;
  return {
    prompt: story,
    answer: rat(ans),
    explanation: [
      `Let a be the number of ${names[0]} and $b$ the number of ${names[1]}. Counting gives a + b = ${total}; the ${what} give ${pa}a + ${pb}b = ${value}.`,
      `Substitute b = ${total} − a into the second equation: ${pa}a + ${pb}(${total} − a) = ${value}, so ${pa - pb}a + ${pb * total} = ${value} and ${pa - pb}a = ${value - pb * total}.`,
      `a = ${quotient(value - pb * total, pa - pb)}, and b = ${total} − ${a} = ${b}.`,
      `Check: ${pa} × ${a} + ${pb} × ${b} = ${value}. So there are ${ans} ${names[askFirst ? 0 : 1]}.`,
    ],
    hint: `Use one equation for the count and one for the ${what}: a + b = ${total} and ${pa}a + ${pb}b = ${value}. Replace $b$ with ${total} − a.`,
    tags: [kind, askFirst ? "first" : "second"],
  };
}

// ------------------------------------------------------------ constraint-feasible
function constraintFeasible(r: Random): Case {
  for (;;) {
    const kind = pick(r, ["bakery", "jobs"] as const);
    const cap = r(8, 14);
    const [p1, p2] =
      kind === "bakery" ? [r(3, 5), r(6, 9)] : [r(12, 18), r(8, 11)];
    const lo = Math.min(p1, p2) * cap,
      hi = Math.max(p1, p2) * cap;
    const goal = r(
      Math.ceil(lo + (hi - lo) * 0.25),
      Math.floor(lo + (hi - lo) * 0.7),
    );
    const capH = standardHalf(1, 1, cap, "<="),
      goalH = standardHalf(p1, p2, goal, ">=");
    const inside: [number, number][] = [],
      tooMany: [number, number][] = [],
      tooLittle: [number, number][] = [];
    for (let x = 0; x <= cap + 2; x++)
      for (let y = 0; y <= cap + 2; y++) {
        const c1 = capH.test(x, y),
          c2 = goalH.test(x, y);
        if (c1 && c2) inside.push([x, y]);
        else if (!c1 && c2 && x + y <= cap + 3) tooMany.push([x, y]);
        else if (c1 && !c2 && x + y >= 2) tooLittle.push([x, y]);
      }
    if (inside.length < 4 || tooMany.length < 2 || tooLittle.length < 2)
      continue;
    const right = pick(r, inside);
    const wrong = [
      ...shuffle(r, tooMany).slice(0, 1),
      ...shuffle(r, tooLittle).slice(0, 1),
      ...shuffle(r, r(0, 1) ? tooMany : tooLittle).slice(0, 2),
    ];
    const labels = [
      ...new Set([pair(...right), ...wrong.map((w) => pair(...w))]),
    ];
    if (labels.length < 4) continue;
    const used = new Set<string>([pair(...right)]);
    const three = wrong
      .filter((w) => !used.has(pair(...w)) && used.add(pair(...w)))
      .slice(0, 3);
    const Y = Math.max(cap, Math.ceil(goal / Math.min(p1, p2))) + 1;
    if (Y > 30) continue;
    const scene = graph({
      id: "g",
      x: [0, cap + 2],
      y: [0, Math.max(Y, cap + 2)],
      grid: 1,
      tick: 2,
    })
      .shade(plane(capH), plane(goalH), "x >= 0", "y >= 0")
      .scene({ title: "Feasible region of the two constraints" });
    const story =
      kind === "bakery"
        ? `A bakery sells $x$ small boxes of muffins at ${usd(p1)} and $y$ large boxes at ${usd(p2)}. It can bake at most ${cap} boxes a day and wants to take in at least ${usd(goal)}.`
        : `Jo tutors for $x$ hours at ${usd(p1)} an hour and works $y$ hours at a store at ${usd(p2)} an hour. Jo can work at most ${cap} hours a week and wants to earn at least ${usd(goal)}.`;
    const fb = ([x, y]: [number, number]) =>
      x + y > cap
        ? `${x} + ${y} = ${x + y}, more than ${cap}: this breaks x + y ≤ ${cap}.`
        : `${p1} × ${x} + ${p2} × ${y} = ${p1 * x + p2 * y}, less than ${goal}: this breaks ${p1}x + ${p2}y ≥ ${goal}.`;
    return {
      prompt: `${story} The shaded region shows x + y ≤ ${cap} and ${p1}x + ${p2}y ≥ ${goal}. Which $(x, y)$ meets both conditions?`,
      choices: [
        { label: pair(...right), correct: true },
        ...three.map((w) => ({ label: pair(...w), feedback: fb(w) })),
      ],
      scene,
      explanation: [
        `A combination works when it makes both inequalities true: it lies in the shaded region or on its solid edges.`,
        `For ${pair(...right)}: ${right[0]} + ${right[1]} = ${right[0] + right[1]} ≤ ${cap}, and ${p1} × ${right[0]} + ${p2} × ${right[1]} = ${p1 * right[0] + p2 * right[1]} ≥ ${goal}.`,
        `Each other option breaks one condition: too many ${kind === "bakery" ? "boxes" : "hours"} in all, or too little money.`,
      ],
      hint: `Test each pair in both inequalities, x + y ≤ ${cap} and ${p1}x + ${p2}y ≥ ${goal}. The answer makes both true.`,
      tags: [kind],
    };
  }
}

// ------------------------------------------------------------ half-plane-inequality
function randomHalf(r: Random, kind: string): Half {
  const op = pick(r, ["<", "<=", ">", ">="] as const);
  if (kind === "slope") {
    const den = pick(r, [1, 1, 2]);
    const num = nonzero(r, -3, 3) * (den === 2 ? 1 : 1);
    return slopeHalf(
      den === 2 && num % 2 === 0 ? num + 1 : num,
      den,
      r(-3, 3),
      op,
    );
  }
  if (kind === "standard") {
    const a = r(1, 4),
      b = r(1, 4),
      t = a === b ? 2 : 1;
    return standardHalf(a, b, a * b * t, op);
  }
  return axisHalf(pick(r, ["x", "y"] as const), nonzero(r, -4, 4), op);
}
function halfDistractors(h: Half, kind: string): Choice[] {
  const out: Choice[] = [
    {
      label: rebuild(h, kind, flip[h.op]),
      feedback: `The boundary is right, but this is the other side. Test a shaded point: it must make the inequality true.`,
    },
    {
      label: rebuild(h, kind, swapStrict[h.op]),
      feedback: strict(h.op)
        ? `The boundary is dashed, so the line itself is not included: use < or >.`
        : `The boundary is solid, so the line itself is included: use ≤ or ≥.`,
    },
    {
      label: rebuild(h, kind, swapStrict[flip[h.op]]),
      feedback: `Check both the side that is shaded and whether the boundary is solid or dashed.`,
    },
  ];
  const other =
    kind === "slope"
      ? {
          ...h,
          text: h.text.replace(
            /(y [<>≤≥] )(−?)/,
            (_, s, minus) => s + (minus ? "" : "−"),
          ),
        }
      : kind === "standard"
        ? { ...h, text: `${twoTerm(h.b, h.a)} ${sym[h.op]} ${n(h.c)}` }
        : {
            ...h,
            text: h.text.replace(/^[xy]/, (v) => (v === "x" ? "y" : "x")),
          };
  out.unshift({
    label: other.text,
    feedback:
      kind === "axis"
        ? `A vertical boundary is a line x = k; a horizontal one is y = k.`
        : `This boundary line is a different line: check two points on the drawn boundary.`,
  });
  return out;
}
function rebuild(h: Half, kind: string, op: Op) {
  return h.text.replace(/[<>≤≥]/, sym[op]);
}
function halfPlaneInequality(r: Random): Case {
  const kind = pick(r, [
    "slope",
    "slope",
    "standard",
    "axis",
    "system",
  ] as const);
  const window: [number, number] = kind === "standard" ? [-2, 9] : [-6, 6];
  if (kind === "system") {
    for (;;) {
      const h1 = randomHalf(r, "slope"),
        h2 = randomHalf(r, "axis");
      const pts: [number, number][] = [];
      for (let x = -5; x <= 5; x++)
        for (let y = -5; y <= 5; y++)
          if (h1.test(x, y) && h2.test(x, y)) pts.push([x, y]);
      if (pts.length < 8 || pts.length > 80) continue;
      const join = (a: string, b: string) => `${a} and ${b}`;
      const correct = join(h1.text, h2.text);
      // A strictness change on a boundary that the other half-plane excludes
      // describes the same set: drop such options.
      const set = (o1: Op, o2: Op) => (x: number, y: number) =>
        holdsOp(h1.a * x + h1.b * y, o1, h1.c) &&
        holdsOp(h2.a * x + h2.b * y, o2, h2.c);
      const differs = (o1: Op, o2: Op) => {
        const f = set(h1.op, h2.op),
          g = set(o1, o2);
        for (let x = -12; x <= 12; x += 0.5)
          for (let y = -12; y <= 12; y += 0.5)
            if (f(x, y) !== g(x, y)) return true;
        return false;
      };
      const ops: [Op, Op][] = [
        [flip[h1.op], h2.op],
        [h1.op, flip[h2.op]],
        [swapStrict[h1.op], h2.op],
        [h1.op, swapStrict[h2.op]],
      ];
      const keep = ops.map(([o1, o2]) => differs(o1, o2));
      const wrong = maybeDistinct(
        correct,
        [
          {
            label: join(rebuild(h1, "slope", flip[h1.op]), h2.text),
            feedback: `Check the side of the slanted boundary that is shaded.`,
          },
          {
            label: join(h1.text, rebuild(h2, "axis", flip[h2.op])),
            feedback: `Check the side of the ${h2.a ? "vertical" : "horizontal"} boundary that is shaded.`,
          },
          {
            label: join(rebuild(h1, "slope", swapStrict[h1.op]), h2.text),
            feedback: `Check whether the slanted boundary is solid (included) or dashed (not included).`,
          },
          {
            label: join(h1.text, rebuild(h2, "axis", swapStrict[h2.op])),
            feedback: `Check whether the ${h2.a ? "vertical" : "horizontal"} boundary is solid or dashed.`,
          },
        ].filter((_, i) => keep[i]),
      );
      if (!wrong) continue;
      const [px, py] = pick(r, pts);
      return {
        prompt: `Which system of inequalities does the shaded region show?`,
        choices: [{ label: correct, correct: true }, ...wrong],
        scene: graph({ id: "g", x: [-6, 6], y: [-6, 6], grid: 1 })
          .shade(plane(h1), plane(h2))
          .scene({ title: "A region bounded by two lines" }),
        explanation: [
          `The region lies on one side of each boundary. The slanted line is ${h1.text.replace(/[<>≤≥]/, "=")}, with ${boundaryWords(h1)}; the other is ${h2.text.replace(/[<>≤≥]/, "=")}, with ${boundaryWords(h2)}.`,
          `Test the shaded point ${pair(px, py)}: it makes both ${h1.text} and ${h2.text} true.`,
          `So the region is ${correct}.`,
        ],
        hint: `Name each boundary line and whether it is solid or dashed, then test a shaded point such as ${pair(px, py)} in each inequality.`,
        tags: [kind],
      };
    }
  }
  for (;;) {
    const h = randomHalf(r, kind);
    const pts: [number, number][] = [];
    for (let x = window[0] + 1; x < window[1]; x++)
      for (let y = window[0] + 1; y < window[1]; y++)
        if (h.a * x + h.b * y !== h.c && h.test(x, y)) pts.push([x, y]);
    if (pts.length < 6) continue;
    const wrong = distinct(h.text, halfDistractors(h, kind));
    const [px, py] = pick(r, pts);
    const line = h.text.replace(/[<>≤≥]/, "=");
    return {
      prompt: `Which inequality does the shaded region show?`,
      choices: [{ label: h.text, correct: true }, ...wrong],
      scene: graph({ id: "g", x: window, y: window, grid: 1 })
        .shade(plane(h))
        .scene({ title: "A shaded half-plane" }),
      explanation: [
        `The boundary is the line ${line}, drawn with ${boundaryWords(h)}.`,
        `Test the shaded point ${pair(px, py)}: substituting it makes ${h.text} true, so the shaded side is the ${sym[h.op]} side.`,
        `So the region is ${h.text}.`,
      ],
      hint: `Find the boundary line from two of its grid points and note whether it is solid or dashed. Then substitute a shaded point, such as ${pair(px, py)}, into each option.`,
      tags: [kind, strict(h.op) ? "strict" : "inclusive"],
    };
  }
}

// ------------------------------------------------------------ inequality-solution-point
function inequalitySolutionPoint(r: Random): Case {
  const kind = pick(r, ["slope", "standard"] as const);
  for (;;) {
    const h = randomHalf(r, kind);
    const lim = kind === "standard" ? [0, 8] : [-5, 5];
    const on: [number, number][] = [],
      yes: [number, number][] = [],
      no: [number, number][] = [];
    for (let x = lim[0]!; x <= lim[1]!; x++)
      for (let y = lim[0]!; y <= lim[1]!; y++) {
        if (h.a * x + h.b * y === h.c) on.push([x, y]);
        else (h.test(x, y) ? yes : no).push([x, y]);
      }
    if (!on.length || yes.length < 2 || no.length < 3) continue;
    const boundary = pick(r, on);
    const [right, ...wrong] = strict(h.op)
      ? [pick(r, yes), boundary, ...shuffle(r, no).slice(0, 2)]
      : r(0, 1)
        ? [boundary, ...shuffle(r, no).slice(0, 3)]
        : [pick(r, yes), ...shuffle(r, no).slice(0, 3)];
    const all = [right!, ...wrong];
    if (new Set(all.map((q) => pair(...q))).size < 4) continue;
    const check = ([x, y]: [number, number]) => {
      const left = h.b === 0 ? x : h.a === 0 ? y : null;
      if (left !== null)
        return `${h.a ? "x" : "y"} = ${n(left)}, and ${n(left)} ${sym[h.op]} ${n(h.c)} is ${h.test(x, y) ? "true" : "false"}`;
      const lhs = h.a * x + h.b * y;
      if (kind === "standard")
        return `${twoTerm(h.a, h.b)
          .replace("x", ` × ${p0(x)}`)
          .replace("y", ` × ${p0(y)}`)
          .replace(/^ × /, "")
          .replace(
            /(^|[−+] )1 × /g,
            "$1",
          )} = ${n(lhs)}, and ${n(lhs)} ${sym[h.op]} ${n(h.c)} is ${h.test(x, y) ? "true" : "false"}`;
      return `y = ${n(y)} against ${h.text.split(/ [<>≤≥] /)[1]!.replace("x", ` × ${p0(x)}`)} = ${qtq(-h.a * x + h.c, h.b)}: ${n(y)} ${sym[h.op]} ${qtq(-h.a * x + h.c, h.b)} is ${h.test(x, y) ? "true" : "false"}`;
    };
    const scene = graph({
      id: "g",
      x: kind === "standard" ? [-1, 9] : [-6, 6],
      y: kind === "standard" ? [-1, 9] : [-6, 6],
      grid: 1,
    }).line(
      h.a === 0
        ? { m: 0, b: h.c / h.b }
        : h.b === 0
          ? { x: h.c / h.a }
          : { a: h.a, b: h.b, c: h.c },
      { dash: strict(h.op) ? "dash" : "solid" },
    );
    for (const q of all) scene.point(q[0], q[1]);
    // A test point off the line and away from the options, then the side it decides.
    const test = (
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
        [1, 1],
      ] as [number, number][]
    ).find(
      ([x, y]) =>
        h.a * x + h.b * y !== h.c && !all.some(([u, v]) => u === x && v === y),
    )!;
    scene.point(test[0], test[1], pair(...test), { open: true });
    scene.shade({ ...plane(h), boundary: false });
    const testTrue = h.test(...test);
    const walk = [
      step(
        `The boundary of ${h.text} is ${strict(h.op) ? "dashed: points on it are not solutions" : "solid: points on it are solutions"}.`,
        act.highlight("g.line.0"),
      ),
      step(
        `Test a point off the line, ${pair(...test)}: ${check(test)}.`,
        act.appear(`g.point.${all.length}`),
      ),
      lessonStep(
        `So the solutions are on the side ${testTrue ? "with" : "away from"} ${pair(...test)}. Shade it, and keep the point that lies there.`,
        act.appear("g.region.0"),
      ),
    ];
    return {
      prompt: `Which point is a solution of ${h.text}? The graph shows the boundary line and the four points.`,
      choices: [
        { label: pair(...right!), correct: true },
        ...wrong.map((q) => ({
          label: pair(...q),
          feedback:
            h.a * q[0] + h.b * q[1] === h.c
              ? `This point is on the dashed boundary. The inequality is strict, so points on the line are not solutions.`
              : `Substituting: ${check(q)}.`,
        })),
      ],
      scene: scene.scene({
        title: `The boundary of ${h.text} and four points`,
        steps: walk,
      }),
      explanation: [
        `A point solves the inequality when its coordinates make it true. The boundary is ${boundaryWords(h)}.`,
        `For ${pair(...right!)}: ${check(right!)}.`,
        `Each other point makes the inequality false${strict(h.op) ? ", including the point on the dashed line" : ""}.`,
      ],
      hint: `Substitute each point into ${h.text}. A point on a solid boundary is a solution; a point on a dashed boundary is not.`,
      tags: [
        kind,
        strict(h.op) ? "strict" : "inclusive",
        h.a * right![0] + h.b * right![1] === h.c ? "on-line" : "inside",
      ],
    };
  }
}
const timesK = (v: number, k: string) =>
  v === 1 ? k : v === -1 ? `−${k}` : `${n(v)}${k}`;
const qtq = (num: number, den: number) => {
  const v = rat(num, den);
  return v.d === 1 ? n(v.n) : `${n(v.n)}/${v.d}`;
};
const p0 = (v: number) => (v < 0 ? `(${n(v)})` : String(v));

// ------------------------------------------------------------ literal-equation-solve
function literalEquationSolve(r: Random): Case {
  const frame = pick(r, [
    "coefficient",
    "both-sides",
    "grouped",
    "inequality-positive",
    "inequality-negative",
  ] as const);
  const k = pick(r, ["k", "a", "m"]);
  if (frame === "coefficient") {
    const b = nonzero(r, -9, 9),
      c = r(-12, 20);
    if (c === b) return literalEquationSolve(r);
    const d = c - b;
    return {
      prompt: `Solve ${k}x${constText(b)} = ${n(c)} for $x$, where ${k} ≠ 0.`,
      choices: [
        { label: `x = ${n(d)}/${k}`, correct: true },
        {
          label: `x = ${n(c + b)}/${k}`,
          feedback: `Undo ${b < 0 ? `− ${-b}` : `+ ${b}`} by ${b < 0 ? "adding" : "subtracting"} ${Math.abs(b)} on both sides: ${n(c)} ${b < 0 ? "+" : "−"} ${Math.abs(b)} = ${n(d)}.`,
        },
        {
          label: `x = ${timesK(d, k)}`,
          feedback: `${k} multiplies $x$, so divide by ${k}; do not multiply.`,
        },
        {
          label: `x = ${n(d)} − ${k}`,
          feedback: `${k} multiplies $x$; undo multiplication by dividing, not subtracting.`,
        },
      ],
      explanation: [
        `Treat ${k} as a fixed nonzero number. ${b < 0 ? `Add ${-b} to` : `Subtract ${b} from`} both sides: ${k}x = ${n(d)}.`,
        `Divide both sides by ${k}, allowed because ${k} ≠ 0: x = ${n(d)}/${k}.`,
      ],
      hint: `Undo the ${b < 0 ? `− ${-b}` : `+ ${b}`} first, so that ${k}x stands alone, then divide by ${k}.`,
      tags: [frame],
    };
  }
  if (frame === "both-sides") {
    const q = r(2, 7),
      b = r(-9, 9),
      d = r(-9, 12);
    if (d === b) return literalEquationSolve(r);
    const top = d - b;
    return {
      prompt: `Solve ${k}x${constText(b)} = ${q}x${constText(d)} for $x$, where ${k} ≠ ${q}.`,
      choices: [
        { label: `x = ${n(top)}/(${k} − ${q})`, correct: true },
        {
          label: `x = ${n(top)}/(${k} + ${q})`,
          feedback: `Subtracting ${q}x from both sides leaves (${k} − ${q})x, not (${k} + ${q})x.`,
        },
        {
          label: `x = ${n(-top)}/(${k} − ${q})`,
          feedback: `Move the constant across with its opposite sign: ${n(d)} ${b < 0 ? "+" : "−"} ${Math.abs(b)} = ${n(top)}.`,
        },
        {
          label: `x = ${n(top)}/(${q} − ${k})`,
          feedback: `Collect $x$ on the left: ${k}x − ${q}x = (${k} − ${q})x. Dividing by ${q} − ${k} changes the sign.`,
        },
      ],
      explanation: [
        `Subtract ${q}x from both sides: (${k} − ${q})x${constText(b)} = ${n(d)}.`,
        `${b < 0 ? `Add ${-b} to` : `Subtract ${b} from`} both sides: (${k} − ${q})x = ${n(top)}.`,
        `Divide by ${k} − ${q}, which is not 0 because ${k} ≠ ${q}: x = ${n(top)}/(${k} − ${q}).`,
      ],
      hint: `Collect the $x$-terms on one side: subtract ${q}x from both sides, so the $x$-term becomes (${k} − ${q})x.`,
      tags: [frame],
    };
  }
  if (frame === "grouped") {
    const h = nonzero(r, -6, 6),
      c = nonzero(r, -12, 12);
    const inner = `x${constText(-h)}`;
    return {
      prompt: `Solve ${k}(${inner}) = ${n(c)} for $x$, where ${k} ≠ 0.`,
      choices: [
        { label: `x = ${n(c)}/${k}${constText(h)}`, correct: true },
        {
          label: `x = ${n(c)}/${k}${constText(-h)}`,
          feedback: `x ${h < 0 ? "+" : "−"} ${Math.abs(h)} = ${n(c)}/${k}, so ${h < 0 ? "subtract" : "add"} ${Math.abs(h)} to undo it.`,
        },
        {
          label: `x = ${n(c - h)}/${k}`,
          feedback: `Divide by ${k} first: all of x${constText(-h)} is multiplied by ${k}.`,
        },
        {
          label: `x = ${timesK(c, k)}${constText(h)}`,
          feedback: `${k} multiplies the group, so divide by ${k}.`,
        },
      ],
      explanation: [
        `${k} multiplies all of ${inner}. Divide both sides by ${k}, allowed because ${k} ≠ 0: ${inner} = ${n(c)}/${k}.`,
        `${h < 0 ? `Subtract ${-h} from` : `Add ${h} to`} both sides: x = ${n(c)}/${k}${constText(h)}.`,
      ],
      hint: `${k} multiplies the whole group ${inner}: divide both sides by ${k} first, then undo the ${h < 0 ? `+ ${-h}` : `− ${h}`}.`,
      tags: [frame],
    };
  }
  const positive = frame === "inequality-positive";
  const op = pick(r, ["<", "<=", ">", ">="] as const);
  const b = nonzero(r, -9, 9),
    c = r(-9, 15);
  if (c === b) return literalEquationSolve(r);
  const d = c - b;
  const res = positive ? op : flip[op];
  return {
    prompt: `If ${k} ${positive ? ">" : "<"} 0, solve ${k}x${constText(b)} ${sym[op]} ${n(c)} for $x$.`,
    choices: [
      { label: `x ${sym[res]} ${n(d)}/${k}`, correct: true },
      {
        label: `x ${sym[positive ? flip[op] : op]} ${n(d)}/${k}`,
        feedback: positive
          ? `${k} is positive, so dividing by ${k} keeps the direction of the inequality.`
          : `${k} is negative: dividing both sides by a negative number reverses the inequality.`,
      },
      {
        label: `x ${sym[res]} ${n(c + b)}/${k}`,
        feedback: `${b < 0 ? "Add" : "Subtract"} ${Math.abs(b)} on both sides first: ${n(c)} ${b < 0 ? "+" : "−"} ${Math.abs(b)} = ${n(d)}.`,
      },
      {
        label: `x ${sym[res]} ${timesK(d, k)}`,
        feedback: `${k} multiplies $x$, so divide by ${k}.`,
      },
    ],
    explanation: [
      `${b < 0 ? `Add ${-b} to` : `Subtract ${b} from`} both sides: ${k}x ${sym[op]} ${n(d)}.`,
      positive
        ? `Divide by ${k}. Because ${k} > 0, the direction stays: x ${sym[res]} ${n(d)}/${k}.`
        : `Divide by ${k}. Because ${k} < 0, the direction reverses: x ${sym[res]} ${n(d)}/${k}.`,
    ],
    hint: `Isolate ${k}x first, then divide by ${k}. Since ${k} ${positive ? ">" : "<"} 0, decide whether the ${sym[op]} sign keeps or reverses its direction.`,
    tags: [frame],
  };
}

// ------------------------------------------------------------ parameter-solution-count
function parameterSolutionCount(r: Random): Case {
  const frame = pick(r, [
    "equation-none",
    "equation-many",
    "coefficient-many",
    "system-none",
  ] as const);
  if (frame === "equation-none") {
    const q = nonzero(r, -6, 7),
      b = r(-9, 9);
    let d = r(-9, 9);
    if (d === b) d += 1;
    return {
      prompt: `For what value of a does the equation ax${constText(b)} = ${termText(q, "x")}${constText(d)} have no solution?`,
      answer: rat(q),
      explanation: [
        `Subtract ${termText(q, "x")} from both sides: $(a − ${q < 0 ? `(${n(q)})` : q})x${constText(b)} = ${n(d)}$.`,
        `If a = ${n(q)}, the $x$-terms cancel and ${n(b)} is left on the left side and ${n(d)} on the right. Their difference is ${n(b)} − ${p1(d)} = ${n(b - d)}, not 0, so no $x$ is a solution.`,
        `For any other $a, x = (${n(d)} − ${b < 0 ? `(${n(b)})` : b}) ÷ (a − ${q < 0 ? `(${n(q)})` : q})$ is a solution. So a = ${n(q)}.`,
      ],
      hint: `Collect the $x$-terms: ax − ${q < 0 ? `(${n(q)})` : q}x. When does that coefficient become 0, and what is left of ${n(b)} and ${n(d)}?`,
      tags: [frame],
    };
  }
  if (frame === "equation-many") {
    const m = r(2, 6),
      h = nonzero(r, -6, 6);
    return {
      prompt: `For what value of $c$ does the equation $${m}(x${constText(h)}) = ${m}x + c$ have infinitely many solutions?`,
      answer: rat(m * h),
      explanation: [
        `Distribute, ${m} × ${p1(h)} = ${n(m * h)}: $${m}x${constText(m * h)} = ${m}x + c$.`,
        `The $x$-terms match on both sides, so subtracting ${m}x leaves ${n(m * h)} = c.`,
        `If c = ${n(m * h)}, the two sides are identical and every $x$ is a solution; otherwise there is none. So c = ${n(m * h)}.`,
      ],
      hint: `Distribute ${m} over (x${constText(h)}) and compare the two sides term by term.`,
      tags: [frame],
    };
  }
  if (frame === "coefficient-many") {
    const m = nonzero(r, -6, 6),
      h = nonzero(r, -6, 6);
    return {
      prompt: `For what value of a does the equation ax${constText(m * h)} = ${m < 0 ? `−${-m}` : m}(x${constText(h)}) have infinitely many solutions?`,
      answer: rat(m),
      explanation: [
        `Distribute on the right, ${n(m)} × ${p1(h)} = ${n(m * h)}: ${m < 0 ? `−${-m}` : m}(x${constText(h)}) = ${termText(m, "x")}${constText(m * h)}.`,
        `The constants already match: ${n(m * h)} on each side. The equation holds for every $x$ exactly when the $x$-coefficients match too.`,
        `So a = ${n(m)}.`,
      ],
      hint: `Distribute the ${n(m)} on the right side over (x${constText(h)}), then compare the coefficient of $x$ and the constant on each side.`,
      tags: [frame],
    };
  }
  for (;;) {
    const a2 = nonzero(r, -5, 5),
      b2 = pick(r, [1, -1, 2, 3]),
      t = nonzero(r, -3, 3);
    const b1 = b2 * t,
      k = a2 * t;
    const c2 = r(-6, 6),
      c1 = r(-12, 12);
    if (c1 === c2 * t) continue;
    return {
      prompt: `For what value of $k$ does the system kx${b1 < 0 ? " − " : " + "}${Math.abs(b1) === 1 ? "" : Math.abs(b1)}y = ${n(c1)} and ${twoTerm(a2, b2)} = ${n(c2)} have no solution?`,
      answer: rat(k),
      explanation: [
        `Two lines have no common point when they are parallel and different: same slope, different intercept. The first equation's $y$-coefficient is ${p1(t)} times the second's, ${n(b2)} × ${p1(t)} = ${n(b1)}, so $k$ must be ${n(a2)} × ${p1(t)} = ${n(k)}.`,
        `Multiply the second equation by ${n(t)}: ${twoTerm(a2 * t, b2 * t)} = ${n(c2 * t)}. Its $y$-coefficient now matches the first equation's.`,
        `With k = ${n(k)}, the left sides are equal but ${n(c1)} ≠ ${n(c2 * t)}, so no $(x, y)$ satisfies both. So k = ${n(k)}.`,
      ],
      hint: `Make the $y$-coefficients match: multiply ${twoTerm(a2, b2)} = ${n(c2)} by the number that turns ${termText(b2, "y")} into ${termText(b1, "y")}.`,
      tags: [frame],
    };
  }
}

// ------------------------------------------------------------ equation-step-property
const PROPS = {
  distribute: "Distributive property",
  add: "Addition property of equality",
  subtract: "Subtraction property of equality",
  multiply: "Multiplication property of equality",
  divide: "Division property of equality",
  combine: "Combining like terms",
} as const;
type Prop = keyof typeof PROPS;
const WHY: Record<Prop, string> = {
  distribute:
    "multiplies the number outside the parentheses by each term inside",
  add: "adds the same number to both sides",
  subtract: "subtracts the same amount from both sides",
  multiply: "multiplies both sides by the same nonzero number",
  divide: "divides both sides by the same nonzero number",
  combine: "adds like terms on one side",
};
const frac = (num: number, den: number) => {
  const v = rat(num, den);
  return v.d === 1 ? n(v.n) : `${n(v.n)}/${v.d}`;
};
const coefX = (k: number) => (k === 1 ? "x" : `${k}x`);
type Path = {
  lines: string[];
  reasons: Prop[];
  did: string[];
  solution: string;
  /** broken[k]: the lines from step k + 1 on when step k + 1 is done wrongly. */
  broken: string[][];
};
const move = (v: number): Prop => (v > 0 ? "subtract" : "add");
const moveWords = (v: number) =>
  v > 0 ? `subtract ${v} from both sides` : `add ${-v} to both sides`;
function path(r: Random, form: string): Path | null {
  const x = nonzero(r, -9, 12);
  if (form === "grouped") {
    const a = r(2, 6),
      b = nonzero(r, -8, 8);
    const c = a * (x + b),
      ab = a * b;
    return {
      lines: [
        `${a}(x${constText(b)}) = ${n(c)}`,
        `${a}x${constText(ab)} = ${n(c)}`,
        `${a}x = ${n(c - ab)}`,
        `x = ${n(x)}`,
      ],
      reasons: ["distribute", move(ab), "divide"],
      did: [
        `multiply ${a} by each term inside the parentheses`,
        moveWords(ab),
        `divide both sides by ${a}`,
      ],
      solution: n(x),
      broken: [
        [
          `${a}x${constText(b)} = ${n(c)}`,
          `${a}x = ${n(c - b)}`,
          `x = ${frac(c - b, a)}`,
        ],
        [`${a}x = ${n(c + ab)}`, `x = ${frac(c + ab, a)}`],
        [`x = ${n(c - ab - a)}`],
      ],
    };
  }
  if (form === "both-sides" || form === "combine") {
    const c = r(1, 4),
      a = c + r(2, 5),
      b = nonzero(r, -9, 9);
    const k = form === "both-sides" ? a - c : a + c;
    const d = k * x + b;
    // both-sides: ax + b = cx + d, so (a − c)x + b = d.
    const start =
      form === "both-sides"
        ? `${a}x${constText(b)} = ${coefX(c)}${constText(d)}`
        : `${a}x${constText(b)} + ${coefX(c)} = ${n(d)}`;
    const wrong1 =
      form === "both-sides"
        ? [
            `${a + c}x${constText(b)} = ${n(d)}`,
            `${a + c}x = ${n(d - b)}`,
            `x = ${frac(d - b, a + c)}`,
          ]
        : [
            `${a}x${constText(b)} = ${n(d)}`,
            `${a}x = ${n(d - b)}`,
            `x = ${frac(d - b, a)}`,
          ];
    return {
      lines: [
        start,
        `${k}x${constText(b)} = ${n(d)}`,
        `${k}x = ${n(d - b)}`,
        `x = ${n(x)}`,
      ],
      reasons: [
        form === "both-sides" ? "subtract" : "combine",
        move(b),
        "divide",
      ],
      did: [
        form === "both-sides"
          ? `subtract ${coefX(c)} from both sides`
          : `add the $x$-terms ${a}x and ${coefX(c)}`,
        moveWords(b),
        `divide both sides by ${k}`,
      ],
      solution: n(x),
      broken: [
        wrong1,
        [`${k}x = ${n(d + b)}`, `x = ${frac(d + b, k)}`],
        [`x = ${n(d - b - k)}`],
      ],
    };
  }
  const a = r(2, 6),
    b = nonzero(r, -9, 9);
  const c = x + b;
  return {
    lines: [
      `x/${a}${constText(b)} = ${n(c)}`,
      `x/${a} = ${n(x)}`,
      `x = ${n(a * x)}`,
    ],
    reasons: [move(b), "multiply"],
    did: [moveWords(b), `multiply both sides by ${a}`],
    solution: n(a * x),
    broken: [
      [`x/${a} = ${n(c + b)}`, `x = ${n(a * (c + b))}`],
      [`x = ${frac(x, a)}`],
    ],
  };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function equationStepProperty(r: Random): Case {
  const form = pick(r, [
    "grouped",
    "both-sides",
    "fraction",
    "combine",
  ] as const);
  const ch = path(r, form)!;
  const frame = pick(r, ["property", "property", "error"] as const);
  if (frame === "property") {
    const i = r(1, ch.reasons.length);
    const right = ch.reasons[i - 1]!;
    const others = shuffle(
      r,
      (Object.keys(PROPS) as Prop[]).filter((k) => k !== right),
    ).slice(0, 3);
    return {
      prompt: `The table solves ${ch.lines[0]} one step at a time. Which reason justifies the step from ${ch.lines[i - 1]} to ${ch.lines[i]}?`,
      choices: [
        { label: PROPS[right], correct: true },
        ...others.map((k) => ({
          label: PROPS[k],
          feedback: `${k === "combine" ? "Combining like terms" : `The ${PROPS[k].charAt(0).toLowerCase()}${PROPS[k].slice(1)}`} ${WHY[k]}; this step does something else. Compare the two lines: what changed, and on which sides?`,
        })),
      ],
      scene: lineTable(
        ch.lines.map((line, j) => [
          line,
          j === 0
            ? "Given"
            : j === i
              ? { text: "?", color: "gold" as const }
              : PROPS[ch.reasons[j - 1]!],
        ]),
        { header: "none", rules: "rows", align: ["left", "left"] },
      ).scene({ title: `Steps solving ${ch.lines[0]}` }),
      explanation: [
        `From ${ch.lines[i - 1]} to ${ch.lines[i]}, the step is to ${ch.did[i - 1]}.`,
        `That is the ${PROPS[right].charAt(0).toLowerCase()}${PROPS[right].slice(1)}: it ${WHY[right]}, so the new equation has the same solutions.`,
        `Every step keeps the equation equivalent, so ${ch.lines[0]} is solved by x = ${ch.solution}.`,
      ],
      hint: `Compare ${ch.lines[i - 1]} with ${ch.lines[i]}: what was done, and was it done to both sides or to one side only?`,
      tags: [frame, form, right],
    };
  }
  const steps = ch.lines.length - 1;
  const bad = r(1, steps);
  const lines = [...ch.lines.slice(0, bad), ...ch.broken[bad - 1]!];
  if (lines.length !== ch.lines.length || lines.at(-1) === ch.lines.at(-1))
    return equationStepProperty(r);
  const labels =
    steps === 3
      ? ["Step 1", "Step 2", "Step 3", "No step has an error"]
      : ["Step 1", "Step 2", "Every step is correct", "No step can be checked"];
  if (steps !== 3) return equationStepProperty(r);
  void labels;
  return {
    prompt: `Each step below should keep ${ch.lines[0]} equivalent: Step $k$ turns the line above it into its own line. Which step contains an error?`,
    choices: ["Step 1", "Step 2", "Step 3", "No step has an error"].map(
      (label, j) =>
        j === bad - 1
          ? { label, correct: true as const }
          : {
              label,
              feedback:
                j === 3
                  ? `Substitute x = ${lines.at(-1)!.slice(4)} into ${ch.lines[0]}: it does not make it true, so some step is wrong.`
                  : `Step ${j + 1} follows correctly from the line above it. Check each step in turn.`,
            },
    ),
    scene: lineTable(
      lines.map((line, j) => [j === 0 ? "Given" : `Step ${j}`, line]),
      { header: "column", rules: "rows", align: ["left", "left"] },
    ).scene({ title: `A solution of ${ch.lines[0]} with one wrong step` }),
    explanation: [
      `Redo each step from the line above it and compare.`,
      `Step ${bad} should ${ch.did[bad - 1]}, which turns ${lines[bad - 1]} into ${ch.lines[bad]}, not ${lines[bad]}.`,
      `Done correctly, the steps end at x = ${ch.solution}.`,
    ],
    hint: `Check the steps in order, starting from ${ch.lines[0]}: redo each move yourself and compare it with the line written.`,
    tags: ["error", form, `step-${bad}`],
  };
}

// ------------------------------------------------------------ elimination-equivalent
const eqText = (a: number, b: number, c: number) =>
  `${twoTerm(a, b)} = ${n(c)}`;
function eliminationEquivalent(r: Random): Case {
  for (;;) {
    const x = r(-5, 6),
      y = r(-5, 6);
    const frame = pick(r, ["add", "scale", "system", "why"] as const);
    const a1 = nonzero(r, -5, 5),
      b1 = nonzero(r, -5, 5),
      a2 = nonzero(r, -5, 5);
    const k = frame === "scale" ? pick(r, [2, 3, -2, -3]) : 1;
    // The second equation's y-term cancels the first's once multiplied by k.
    if (b1 % k !== 0) continue;
    const b2 = -b1 / k;
    if (a1 + k * a2 === 0) continue;
    const c1 = a1 * x + b1 * y,
      c2 = a2 * x + b2 * y;
    const e1 = eqText(a1, b1, c1),
      e2 = eqText(a2, b2, c2);
    const sa = a1 + k * a2,
      sc = c1 + k * c2;
    if (sc === 0 || c1 === 0 || c2 === 0) continue;
    const sum = `${termText(sa, "x")} = ${n(sc)}`;
    const cell = (v: number, s: string, first: boolean) =>
      first ? termText(v, s) : termText(v, s, false).trim();
    const stacked = lineTable(
      [
        ["", cell(a1, "x", true), cell(b1, "y", false), "=", n(c1)],
        [
          k === 1 ? "+" : `+ ${n(k)} ×`,
          cell(a2, "x", true),
          cell(b2, "y", false),
          "=",
          n(c2),
        ],
        ...(frame === "add" || frame === "scale"
          ? [
              [
                "",
                { text: "?", color: "gold" as const },
                "",
                "=",
                { text: "?", color: "gold" as const },
              ],
            ]
          : []),
      ] as Table["rows"],
      {
        header: "none",
        rules: "rows",
        total: frame === "add" || frame === "scale" ? 2 : undefined,
        align: ["center", "right", "left", "center", "right"],
      },
    )
      .id("t")
      .scene({
        title: "The system, one equation above the other",
        steps: [
          step(
            `Line up like terms in columns. The $y$-terms ${termText(b1, "y")} and ${termText(k * b2, "y")}${k === 1 ? "" : " (after multiplying by " + n(k) + ")"} are opposites, so they cancel.`,
            act.highlight("t.text.0.2"),
            act.highlight("t.text.1.2"),
          ),
          step(
            `Then the $x$-terms combine, and the right sides add${k === 1 ? "" : `, the second multiplied by ${n(k)}`}.`,
            act.highlight("t.text.0.1"),
            act.highlight("t.text.1.1"),
            act.highlight("t.text.0.4"),
            act.highlight("t.text.1.4"),
          ),
        ],
      });
    if (frame === "add" || frame === "scale") {
      const verb =
        k === 1
          ? "Add the two equations"
          : `Multiply the second equation by ${n(k)}, then add it to the first`;
      const wrong = maybeDistinct(sum, [
        {
          label: `${termText(sa, "x")} = ${n(c1 + c2)}`,
          feedback: `Multiply every term of the second equation by ${n(k)}, its right side too.`,
        },
        ...(a1 - k * a2 === 0
          ? []
          : [
              {
                label: `${termText(a1 - k * a2, "x")} = ${n(c1 - k * c2)}`,
                feedback: `That subtracts the equations. Adding keeps the $x$-terms ${termText(a1, "x")} and ${termText(k * a2, "x")} together: ${termText(sa, "x")}.`,
              },
            ]),
        {
          label: `${termText(sa, "x")}${termText(2 * b1, "y", false)} = ${n(sc)}`,
          feedback: `The $y$-terms ${termText(b1, "y")} and ${termText(k * b2, "y")} are opposites, so they add to 0.`,
        },
        {
          label: `${termText(sa, "x")} = ${n(-sc)}`,
          feedback: `Add the right sides as they are: ${n(c1)} + ${p1(k * c2)} = ${n(sc)}.`,
        },
      ]);
      if (!wrong) continue;
      return {
        prompt: `${verb}. Which equation results?`,
        choices: [{ label: sum, correct: true }, ...wrong],
        scene: stacked,
        explanation: [
          k === 1
            ? `Add the left sides and the right sides.`
            : `Multiplied by ${n(k)}, the second equation is ${eqText(k * a2, k * b2, k * c2)}.`,
          `The $y$-terms cancel: ${termText(b1, "y")} + ${pt(k * b2, "y")} = 0. The $x$-terms give ${termText(a1, "x")} + ${pt(k * a2, "x")} = ${termText(sa, "x")}, and the right sides give ${n(c1)} + ${p1(k * c2)} = ${n(sc)}.`,
          `So ${sum}. Any $(x, y)$ that makes both equations true makes this one true too.`,
        ],
        hint: `${k === 1 ? "Line up like terms" : `Multiply every term of the second equation by ${n(k)} first`}: ${termText(b1, "y")} and ${termText(k * b2, "y")} cancel. Add the $x$-terms, then add the right sides, ${n(c1)} and ${n(k * c2)}.`,
        tags: [frame],
      };
    }
    if (frame === "system") {
      const correct = `${e1} and ${sum}`;
      const wrong = maybeDistinct(correct, [
        {
          label: `${e1} and ${termText(sa, "x")} = ${n(c1)}`,
          feedback: `Adding equations adds both sides: the right side of the sum is ${n(c1)} + ${p1(c2)}.`,
        },
        {
          label: `${e1} and ${eqText(2 * a2, 2 * b2, c2)}`,
          feedback: `Multiplying an equation by 2 multiplies both sides, its right side too.`,
        },
        {
          label: `${sum} and ${termText(a1 - a2 || 2, "x")} = ${n(c1)}`,
          feedback: `Replacing both equations loses information; keep one original equation beside the sum.`,
        },
        {
          label: `${e1} and ${eqText(a2, b2, c2 + 1)}`,
          feedback: `Changing a constant changes the solutions; only whole-equation operations keep them.`,
        },
      ]);
      if (!wrong) continue;
      return {
        prompt: `Which system has exactly the same solutions as the system shown?`,
        choices: [{ label: correct, correct: true }, ...wrong],
        scene: stacked,
        explanation: [
          `Replacing one equation by the sum of both keeps every solution: a pair that satisfies both equations satisfies their sum, and subtracting the first equation from the sum gives back the second.`,
          `The sum of ${e1} and ${e2} is ${sum}.`,
          `So ${correct} has the same solutions; both systems are solved by ${pair(x, y)}.`,
        ],
        hint: `Add the two equations side by side: ${n(c1)} + ${p1(c2)} on the right. Keep one original equation beside the sum.`,
        tags: [frame],
      };
    }
    const reasons: Choice[] = [
      {
        label: `A solution of both equations solves their sum, and subtracting the first from the sum gives back the second.`,
        correct: true,
      },
      {
        label: `Adding two equations gives an equation that every pair $(x, y)$ satisfies.`,
        feedback: `Test a pair that is not ${pair(x, y)}: the sum is false for most pairs. It is true for the system's solutions.`,
      },
      {
        label: `The sum has fewer variables, so it has fewer solutions, and those are the system's.`,
        feedback: `${sum} alone has infinitely many solutions (any $y$). It is the pair with the first equation that pins down ${pair(x, y)}.`,
      },
      {
        label: `Adding changes the solutions, but the first equation corrects them.`,
        feedback: `Adding does not change the solutions: ${pair(x, y)} satisfies the old system and the new one.`,
      },
    ];
    return {
      prompt: `The system ${e1} and ${e2} is replaced by ${e1} and ${sum}, the sum of the two equations. Why do both systems have the same solutions?`,
      choices: reasons,
      scene: stacked,
      explanation: [
        `If $(x, y)$ makes both equations true, adding equal amounts to equal amounts keeps them equal, so it makes ${sum} true.`,
        `Back the other way: if $(x, y)$ satisfies ${e1} and ${sum}, subtracting the first from the sum gives ${e2}. So no solution is gained or lost.`,
        `Both systems are solved by ${pair(x, y)}.`,
      ],
      hint: `Take the solution of the first system, ${pair(x, y)}, and check it in ${sum}. Then ask how to get ${e2} back from the new system.`,
      tags: [frame],
    };
  }
}
const pt = (v: number, s: string) =>
  v < 0 ? `(${termText(v, s)})` : termText(v, s);
const p1 = (v: number) => (v < 0 ? `(${n(v)})` : n(v));

const builders: Record<string, (r: Random) => Case> = {
  "system-model-value": systemModelValue,
  "constraint-feasible": constraintFeasible,
  "half-plane-inequality": halfPlaneInequality,
  "inequality-solution-point": inequalitySolutionPoint,
  "literal-equation-solve": literalEquationSolve,
  "parameter-solution-count": parameterSolutionCount,
  "equation-step-property": equationStepProperty,
  "elimination-equivalent": eliminationEquivalent,
};
const labels: Record<string, string> = {
  "system-model-value": "Answer",
  "constraint-feasible": "Choose the combination",
  "half-plane-inequality": "Choose the inequality",
  "inequality-solution-point": "Choose the point",
  "literal-equation-solve": "Choose the solution",
  "parameter-solution-count": "Answer",
  "equation-step-property": "Choose one",
  "elimination-equivalent": "Choose one",
};

export function twoVariablePrintCase(id: string, seed: string) {
  const meta = twoVariableTemplates.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown two-variable template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed);
  return assemble(meta, seed, builders[id]!(r), r, labels[id]!);
}
export const generateTwoVariableProblem = (
  id: string,
  seed: string,
): GeneratedProblem => twoVariablePrintCase(id, seed).problem;
