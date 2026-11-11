import { withArticle } from "./agreement";
import type { GeneratedProblem, SemanticFigure } from "./contracts";
import { graph, scene } from "./scene/author";
import type { Element } from "./scene/spec";
import {
  choice,
  numericField,
  pick,
  problem,
  shuffle,
  work,
  type Context,
  type Row,
  type Teaching,
} from "./clause-support";
import type { WorkBank } from "./structured-work";

export const transformationClauseFamilies: Record<string, readonly string[]> = {
  "identify-rigid-motion": ["two-step-sequence", "congruent-or-not"],
  "transformation-image": ["translation-image"],
  "similarity-by-transformation": ["grade-8-origin", "what-similarity-means"],
  "transformation-rule-slots": ["function-notation"],
  "place-transformed-image": ["geometry-draw"],
  "dilation-measure": ["verify-on-coordinates"],
  "similarity-proof-aa": ["converse-parallel", "pythagorean-by-similarity"],
  "two-column-congruence-proof": ["cpctc-relationship"],
};
export type Pt = [number, number];
export type Motion =
  | { kind: "translate"; dx: number; dy: number }
  | { kind: "rotate"; degrees: 90 | 180 | 270; center: Pt }
  | {
      kind: "reflect";
      line: "x" | "y" | "diagonal" | "negative-diagonal";
      offset: number;
    };
const add = ([x, y]: Pt, [a, b]: Pt): Pt => [x + a, y + b];
/** a + b, with a negative b folded into the operator. */
const signedSum = (a: number, b: number) =>
  b < 0 ? `${a} − ${-b}` : `${a} + ${b}`;
const scale = ([x, y]: Pt, k: number): Pt => [x * k, y * k];
const sub = ([x, y]: Pt, [a, b]: Pt): Pt => [x - a, y - b];
const clean = ([x, y]: Pt): Pt => [x === 0 ? 0 : x, y === 0 ? 0 : y];
export function applyClauseMotion(m: Motion, p: Pt): Pt {
  const [x, y] = p;
  if (m.kind === "translate") return [x + m.dx, y + m.dy];
  if (m.kind === "reflect")
    return clean(
      m.line === "x"
        ? [x, 2 * m.offset - y]
        : m.line === "y"
          ? [2 * m.offset - x, y]
          : m.line === "diagonal"
            ? [y, x]
            : [-y, -x],
    );
  const [a, b] = sub(p, m.center);
  return clean(
    add(
      m.degrees === 90 ? [-b, a] : m.degrees === 270 ? [b, -a] : [-a, -b],
      m.center,
    ),
  );
}
export const applySequence = (points: Pt[], motions: Motion[]) =>
  points.map((p) => motions.reduce((q, m) => applyClauseMotion(m, q), p));
const point = (p: Pt) => `(${p.join(", ")})`;
const named = (points: Pt[], names = ["A", "B", "C"]) =>
  points.map((p, i) => `$${names[i]}${point(p)}$`).join(", ");
const lengths = (p: Pt[]) =>
  p.map((v, i) => {
    const [x, y] = sub(v, p[(i + 1) % 3]!);
    return x * x + y * y;
  });
const samePoints = (a: Pt[], b: Pt[]) =>
  a.every((p, i) => p[0] === b[i]![0] && p[1] === b[i]![1]);
const bounded = (points: Pt[], limit: number) =>
  points.every((p) =>
    p.every((x) => Math.abs(x) <= limit && Number.isInteger(x)),
  );
const labels = ["A", "B", "C"],
  primes = ["A′", "B′", "C′"];
const mtext = (m: Motion): string =>
  m.kind === "translate"
    ? `translate by $\\langle ${m.dx},${m.dy}\\rangle$`
    : m.kind === "rotate"
      ? `rotate ${m.degrees === 270 ? "90° clockwise" : `${m.degrees}° counterclockwise`} about $${point(m.center)}$`
      : `reflect over ${m.line === "diagonal" ? "$y=x$" : m.line === "negative-diagonal" ? "$y=-x$" : m.line === "x" ? (m.offset ? `$y=${m.offset}$` : "the $x$-axis") : m.offset ? `$x=${m.offset}$` : "the $y$-axis"}`;
const seqtext = (ms: Motion[]) => ms.map(mtext).join(", then ");

function plane(
  original: Pt[],
  image?: Pt[],
  extra?: {
    center?: Pt;
    motion?: Motion;
    names?: string[];
    imageNames?: string[];
    centerName?: string;
  },
): SemanticFigure {
  const all = [
    ...original,
    ...(image ?? []),
    ...(extra?.center ? [extra.center] : []),
  ];
  const bound = Math.max(6, ...all.flat().map(Math.abs)) + 1;
  const g = graph({
    x: [-bound, bound],
    y: [-bound, bound],
    grid: bound > 10 ? 2 : 1,
  });
  const draw = (pts: Pt[], names: string[], color: "accent" | "warm") => {
    pts.forEach((p, i) => {
      g.point(...p, names[i], { color });
      if (pts.length > 1) g.segment(p, pts[(i + 1) % pts.length]!, { color });
    });
  };
  draw(original, extra?.names ?? labels, "accent");
  if (image) draw(image, extra?.imageNames ?? primes, "warm");
  if (extra?.center && !original.some((p) => samePoints([p], [extra.center!])))
    g.point(...extra.center, extra.centerName ?? "O", { color: "gold" });
  const m = extra?.motion;
  if (m?.kind === "reflect") {
    const e = bound;
    const ends: [Pt, Pt] =
      m.line === "x"
        ? [
            [-e, m.offset],
            [e, m.offset],
          ]
        : m.line === "y"
          ? [
              [m.offset, -e],
              [m.offset, e],
            ]
          : m.line === "diagonal"
            ? [
                [-e, -e],
                [e, e],
              ]
            : [
                [-e, e],
                [e, -e],
              ];
    g.segment(...ends, { color: "gold", dash: "dash" });
  }
  return { kind: "scene", scene: g.scene({ width: 360, maxHeight: 360 }) };
}

const nonzero = (c: Context, limit = 4) =>
  pick(
    c.r,
    Array.from({ length: limit * 2 }, (_, i) =>
      i < limit ? i - limit : i - limit + 1,
    ),
  );
function originMotion(c: Context): Motion {
  return pick(c.r, [
    { kind: "reflect", line: "x", offset: 0 },
    { kind: "reflect", line: "y", offset: 0 },
    { kind: "rotate", degrees: 90, center: [0, 0] },
    { kind: "rotate", degrees: 270, center: [0, 0] },
    { kind: "rotate", degrees: 180, center: [0, 0] },
  ] as Motion[]);
}
function otherMotion(m: Motion): Motion {
  if (m.kind === "reflect") return { ...m, line: m.line === "x" ? "y" : "x" };
  if (m.kind === "rotate")
    return { ...m, degrees: m.degrees === 90 ? 270 : 90 };
  return { ...m, dx: -m.dx, dy: -m.dy };
}
function triangle(c: Context, even = false): Pt[] {
  if (even)
    return [
      [-2, -2],
      [2, -2],
      [-2, 0],
    ];
  const x = pick(c.r, [-4, -3, 1, 2]),
    y = pick(c.r, [-4, -3, 1, 2]);
  return [
    [x, y],
    [x + 3, y],
    [x, y + 2],
  ];
}

export function generateTransformationClause(c: Context): GeneratedProblem {
  switch (c.family) {
    case "two-step-sequence":
      return twoStep(c);
    case "congruent-or-not":
      return congruent(c);
    case "translation-image": {
      const p: Pt = [c.r(-5, 5), c.r(-5, 5)],
        dx = nonzero(c),
        dy = nonzero(c),
        q = add(p, [dx, dy]);
      return choice(
        c,
        {
          prompt: `Translate $P${point(p)}$ by $\\langle ${dx},${dy}\\rangle$. What are the coordinates of $P'$?`,
          hint: `Add ${dx} to the first coordinate of $P${point(p)}$ and ${dy} to the second.`,
          explanation: [
            `A translation adds the same displacement to every point.`,
            `$P'${point(q)}$ comes from $(${signedSum(p[0], dx)}, ${signedSum(p[1], dy)})$.`,
          ],
          figure: plane([p], undefined, { names: ["P"] }),
        },
        `$${point(q)}$`,
        [
          sub(p, [dx, dy]),
          add(p, [dy, dx]),
          [p[0] + dx, p[1]] as Pt,
          [p[0], p[1] + dy] as Pt,
        ]
          .filter((v) => !samePoints([v], [q]))
          .map((v) => `$${point(v)}$`)
          .slice(0, 3),
      );
    }
    case "grade-8-origin":
      return similar(c);
    case "what-similarity-means":
      return similarityMeaning(c);
    case "function-notation":
      return functionNotation(c);
    case "geometry-draw":
      return geometryDraw(c);
    case "verify-on-coordinates":
      return verifyDilation(c);
    case "converse-parallel":
      return converse(c);
    case "pythagorean-by-similarity":
      return pythagoras(c);
    case "cpctc-relationship":
      return cpctc(c);
    default:
      throw new Error(`Unknown transformation clause ${c.family}`);
  }
}

function twoStep(c: Context): GeneratedProblem {
  for (let attempt = 0; attempt < 200; attempt++) {
    const a = triangle(c);
    if (a.some((p) => p.includes(0))) continue;
    const motion = originMotion(c),
      translation: Motion = {
        kind: "translate",
        dx: nonzero(c, 5),
        dy: nonzero(c, 5),
      };
    const firstTranslation = c.r(0, 9) < 4,
      sequence = firstTranslation
        ? [translation, motion]
        : [motion, translation],
      image = applySequence(a, sequence);
    if (!bounded(image, 9)) continue;
    const wrong: Motion[][] = [
      [...sequence].reverse(),
      firstTranslation
        ? [translation, otherMotion(motion)]
        : [otherMotion(motion), translation],
      [
        {
          kind: "translate",
          dx: image[0]![0] - a[0]![0],
          dy: image[0]![1] - a[0]![1],
        },
      ],
    ];
    if (wrong.some((seq) => samePoints(image, applySequence(a, seq)))) continue;
    const ghost = applySequence(a, [sequence[0]!]);
    const p = choice(
      c,
      {
        prompt: `Triangle $ABC$: ${named(a)}. Its image: ${named(image, ["A'", "B'", "C'"])}. Which sequence maps every vertex onto its image?`,
        hint: `Apply the first proposed step to $A${point(a[0]!)}$, then the second, and compare with $A'${point(image[0]!)}$, $B'${point(image[1]!)}$ and $C'${point(image[2]!)}$.`,
        explanation: [
          `First ${mtext(sequence[0]!)}: ${named(ghost)}.`,
          `Then ${mtext(sequence[1]!)}: ${named(image, ["A'", "B'", "C'"])}.`,
          `Reversing the order sends $A$ to $${point(applySequence(a, wrong[0]!)[0]!)}$, so order matters.`,
        ],
        figure: plane(a, image),
      },
      seqtext(sequence),
      wrong.map(seqtext),
    );
    p.walkthrough =
      plane(ghost, image).kind === "scene"
        ? (plane(ghost, image) as Extract<SemanticFigure, { kind: "scene" }>)
            .scene
        : undefined;
    return p;
  }
  throw new Error("Could not construct a distinct two-step motion");
}

function congruent(c: Context): GeneratedProblem {
  const a = triangle(c, true),
    kind = c.r(0, 9),
    m: Motion =
      c.r(0, 2) === 0
        ? { kind: "translate", dx: nonzero(c), dy: nonzero(c) }
        : originMotion(c);
  const k = pick(c.r, [2, 0.5]);
  const image =
    kind < 5
      ? applySequence(a, [m])
      : a.map(([x, y]): Pt => (kind < 8 ? scale([x, y], k) : [x, y * 2]));
  const no = "No rigid motion maps the triangles, so they are not congruent.";
  const candidates: Motion[] = [
    m,
    otherMotion(m),
    {
      kind: "translate",
      dx: image[0]![0] - a[0]![0],
      dy: image[0]![1] - a[0]![1],
    },
    { kind: "reflect", line: "diagonal", offset: 0 },
    { kind: "rotate", degrees: 180, center: [0, 0] },
  ];
  const good = kind < 5 ? mtext(m) : no,
    wrong = [
      ...new Set(
        candidates
          .filter((x) => !samePoints(applySequence(a, [x]), image))
          .map(mtext),
      ),
    ];
  if (kind < 5) wrong.unshift(no);
  const l = lengths(a),
    q = lengths(image);
  return choice(
    c,
    {
      prompt: `Triangle $ABC$: ${named(a)}. Triangle $DEF$: ${named(image, ["D", "E", "F"])}. Which rigid motion maps $ABC$ onto $DEF$, or are they not congruent?`,
      hint: `Compare the side from $A${point(a[0]!)}$ to $B${point(a[1]!)}$ with the side from $D${point(image[0]!)}$ to $E${point(image[1]!)}$.`,
      explanation: [
        `Corresponding squared side lengths are $${l.join(", ")}$ and $${q.join(", ")}$.`,
        kind < 5
          ? `The motion ${mtext(m)} maps all three vertices exactly and keeps every length.`
          : "At least one corresponding side changes length. Slides, flips and turns keep lengths, so no sequence of rigid motions can do this.",
      ],
      figure: plane(a, image, { imageNames: ["D", "E", "F"] }),
    },
    good,
    wrong.slice(0, 3),
  );
}

function similar(c: Context): GeneratedProblem {
  const a = triangle(c, true),
    k = pick(c.r, [2, 3, 0.5]),
    yes = c.r(0, 3) !== 0;
  const m: Motion =
    c.r(0, 2) === 0
      ? { kind: "translate", dx: nonzero(c, 3), dy: nonzero(c, 3) }
      : originMotion(c);
  const image = yes
    ? applySequence(
        a.map((p) => scale(p, k)),
        [m],
      )
    : c.r(0, 1)
      ? a.map(([x, y]): Pt => [2 * x, 3 * y])
      : a.map((p, i): Pt => add(scale(p, 2), [i === 2 ? 1 : 0, 0]));
  const no = "No: the side lengths are not all multiplied by the same factor.",
    kt = k === 0.5 ? "1/2" : String(k),
    describe = (scale: string, motion: Motion) =>
      `Yes: dilate by $${scale}$ about the origin, then ${mtext(motion)}.`;
  return choice(
    c,
    {
      prompt: `Triangle $ABC$: ${named(a)}. Triangle $A'B'C'$: ${named(image, ["A'", "B'", "C'"])}. Are they similar? Choose a sequence that proves it, or the reason they are not.`,
      hint:
        c.meta.id === "similarity-by-transformation-grade-8"
          ? `Compare $AB$, from $A${point(a[0]!)}$ to $B${point(a[1]!)}$, with $A'${point(image[0]!)}$ and $C'${point(image[2]!)}$. If one scale factor fits a second pair as well, the map is a dilation about the origin followed by a rigid motion.`
          : `Compare $AB$, from $A${point(a[0]!)}$ to $B${point(a[1]!)}$, with $A'${point(image[0]!)}$ and $C'${point(image[2]!)}$. A single scale factor must work for both pairs before you name the dilation and the rigid motion.`,
      explanation: [
        `Original squared side lengths: $${lengths(a).join(", ")}$.`,
        `Image squared side lengths: $${lengths(image).join(", ")}$.`,
        yes
          ? `Each squared length is multiplied by $${k * k}$, so each length is multiplied by $${kt}$. ${describe(kt, m)}`
          : "The squared-length ratios differ. There is no one length scale factor, so the triangles are not similar.",
      ],
      figure: plane(a, image),
    },
    yes ? describe(kt, m) : no,
    yes
      ? [
          describe(k === 0.5 ? "2" : `1/${k}`, m),
          describe(kt, otherMotion(m)),
          "No: a dilation changes size, so figures cannot be similar.",
        ]
      : [describe("2", m), describe("3", otherMotion(m)), describe("1/2", m)],
  );
}

function similarityMeaning(c: Context): GeneratedProblem {
  const [num, den] = pick(c.r, [
      [2, 1],
      [3, 1],
      [1, 2],
      [3, 2],
      [2, 3],
    ] as const),
    k = num / den,
    kt = den === 1 ? String(num) : `${num}/${den}`;
  if (c.r(0, 1)) {
    const correct = `Dilate by $${kt}$ to match all three sides. SSS then gives congruence, so a rigid motion maps the result onto $DEF$.`;
    return choice(
      c,
      {
        prompt: `Triangles $ABC$ and $DEF$ have all corresponding angles equal and $DE/AB=EF/BC=FD/CA=${kt}$. Why does a similarity transformation map $ABC$ onto $DEF$?`,
        hint: `Use the common side ratio $${kt}$ to make the side lengths match first.`,
        explanation: [
          `A dilation multiplies every side length by $${kt}$ and preserves angles.`,
          "Once all three side lengths match, SSS (side-side-side) proves congruence. A rigid motion then places the triangle on its partner.",
        ],
      },
      correct,
      [
        "Equal angles mean a translation alone maps the triangles.",
        `The dilation multiplies every angle by $${kt}$ to match them.`,
        "The dilation must be centered at $A$, or the side lengths will not match.",
      ],
    );
  }
  const ab = c.r(Math.ceil(4 / den), Math.floor(12 / den)) * den,
    bc = ab + den,
    angle = c.r(25, 80),
    imageSide = ab * k;
  const correct = [
      `$DE=${imageSide}$`,
      `$\\angle D=${angle}^\\circ$`,
      "$DE/AB=EF/BC=FD/CA$",
    ],
    falseLabels = [
      `$\\angle D=${angle * k}^\\circ$`,
      `$DE=${ab + k}$`,
      `$EF=${imageSide}$`,
      "$\\triangle DEF\\cong\\triangle ABC$",
    ];
  const opts = shuffle(c.r, [...correct, ...falseLabels]);
  const p = problem(
    c,
    {
      prompt: `A dilation with scale factor $${kt}$ followed by ${withArticle(pick(c.r, ["translation", "rotation", "reflection"]))} maps $A$ to $D$, $B$ to $E$, and $C$ to $F$. $AB=${ab}$, $BC=${bc}$ and $\\angle A=${angle}^\\circ$. Select every statement that must be true.`,
      hint: `Apply the scale factor $${kt}$ to side lengths, such as $AB=${ab}$. Decide separately what happens to angles.`,
      explanation: [
        `Dilation multiplies lengths by $${kt}$, so $DE=${imageSide}$ and $EF=${bc * k}$.`,
        `Angles do not change: $\\angle D=${angle}^\\circ$. The rigid motion preserves both lengths and angles.`,
        "All corresponding side ratios are equal. The scale factor differs from one, so these triangles are not congruent.",
      ],
    },
    "",
  );
  p.public.response = {
    kind: "multi-select",
    label: "Select all true statements",
    selectionCount: 3,
    options: opts.map((label, i) => ({ id: `option-${"abcdefg"[i]}`, label })),
  };
  p.answer = JSON.stringify(
    opts.flatMap((s, i) =>
      correct.includes(s) ? [`option-${"abcdefg"[i]}`] : [],
    ),
  );
  return p;
}

function functionNotation(c: Context): GeneratedProblem {
  const a = nonzero(c, 6),
    b = nonzero(c, 6),
    i = c.r(0, 8),
    input: Pt = [c.r(-2, 2), c.r(-2, 2)],
    preimage: Pt = [nonzero(c, 2), nonzero(c, 2)];
  const rules = [
    `x${a < 0 ? "" : "+"}${a},y${b < 0 ? "" : "+"}${b}`,
    `-x,y${b < 0 ? "" : "+"}${b}`,
    `x${a < 0 ? "" : "+"}${a},-y`,
    "-y,x",
    "y,-x",
    "-x,-y",
    "y,x",
    "2x,2y",
    "x,3y",
  ];
  const apply = ([x, y]: Pt): Pt =>
    [
      [x + a, y + b],
      [-x, y + b],
      [x + a, -y],
      [-y, x],
      [y, -x],
      [-x, -y],
      [y, x],
      [2 * x, 2 * y],
      [x, 3 * y],
    ][i] as Pt;
  const names = [
    "A translation only",
    "Reflection over the $y$-axis, then translation",
    "Reflection over the $x$-axis, then translation",
    "A 90° counterclockwise rotation",
    "A 90° clockwise rotation",
    "A 180° rotation",
    "A reflection over $y=x$",
    "Not a rigid motion",
    "Not a rigid motion",
  ];
  const classification = names[i]!,
    options = shuffle(c.r, [
      ...new Set([
        classification,
        "A translation only",
        "Reflection over the $x$-axis, then translation",
        "Reflection over the $y$-axis, then translation",
        i >= 7 ? "A rigid motion" : "Not a rigid motion",
      ]),
    ]).map((label, j) => ({ id: String(j), label }));
  const output = apply(preimage),
    answer = apply(input),
    bank: WorkBank = { id: "classify", label: "Transformation", options };
  return work(
    c,
    {
      prompt: `$T(x,y)=(${rules[i]})$. Find $T${point(input)}$. Then find $P$ if $T(P)=${point(output)}$. Finally classify $T$.`,
      hint: `Substitute ${input[0]} for $x$ and ${input[1]} for $y$ to find $T${point(input)}$. Then undo the rule to find the input whose image is ${point(output)}.`,
      explanation: [
        `Substitution gives $T${point(input)}=${point(answer)}$.`,
        `Undoing each coordinate operation gives $P${point(preimage)}$; substituting it returns $${point(output)}$.`,
        i >= 7
          ? "The rule changes some lengths, so it is not a rigid motion."
          : `${classification}. The rule preserves distances.`,
      ],
      figure: plane([input], undefined, { names: ["P"] }),
    },
    [
      {
        label: `$T${point(input)}$`,
        fields: [
          numericField("Output x-coordinate", answer[0]),
          numericField("Output y-coordinate", answer[1]),
        ],
      },
      {
        label: "The input $P$",
        fields: [
          numericField("Input x-coordinate", preimage[0]),
          numericField("Input y-coordinate", preimage[1]),
        ],
      },
      {
        label: "Classify the rule",
        fields: [
          {
            field: {
              kind: "choice",
              bank: "classify",
              label: "Transformation",
            },
            value: options.find((o) => o.label === classification)!.id,
          },
        ],
      },
    ],
    [bank],
  );
}

function geometryDraw(c: Context): GeneratedProblem {
  for (let attempt = 0; attempt < 200; attempt++) {
    const a: Pt[] =
      c.seed === "geometry-draw-example"
        ? [
            [1, 1],
            [4, 1],
            [4, 3],
          ]
        : triangle(c);
    const any = (): Motion => {
      const kind = c.r(0, 2);
      return kind === 0
        ? {
            kind: "rotate",
            degrees: pick(c.r, [90, 180, 270]),
            center: c.r(0, 1) ? pick(c.r, a) : [c.r(-2, 2), c.r(-2, 2)],
          }
        : kind === 1
          ? {
              kind: "reflect",
              line: pick(c.r, ["x", "y", "diagonal", "negative-diagonal"]),
              offset: c.r(-4, 4),
            }
          : { kind: "translate", dx: nonzero(c), dy: nonzero(c) };
    };
    const motions: Motion[] =
      c.seed === "geometry-draw-example"
        ? [{ kind: "rotate", degrees: 270, center: [4, 1] }]
        : Array.from({ length: c.r(0, 2) === 0 ? 2 : 1 }, any);
    const image = applySequence(a, motions);
    if (!bounded(image, 9) || !bounded(applySequence(a, [motions[0]!]), 9))
      continue;
    const centerMotion = motions.find((m) => m.kind === "rotate"),
      reflect = motions.find((m) => m.kind === "reflect");
    const p = problem(
      c,
      {
        prompt: `Triangle $ABC$ has vertices ${named(a)}. ${seqtext(motions)}. Place $A'$, $B'$ and $C'$ in that order.`,
        hint: `For $A${point(a[0]!)}$, follow the stated center or mirror line. Apply steps in the order given.`,
        explanation: motions
          .map(
            (m, i) =>
              `Step ${i + 1}: ${mtext(m)} gives ${named(applySequence(a, motions.slice(0, i + 1)), ["A'", "B'", "C'"])}.`,
          )
          .concat([
            "A turn uses the displacement from its center. A reflection over $x=a$ uses $x'=2a-x$; over $y=b$, $y'=2b-y$. Reversing two steps can change the image.",
          ]),
        figure: plane(a, undefined, {
          ...(centerMotion?.kind === "rotate"
            ? { center: centerMotion.center }
            : {}),
          ...(reflect ? { motion: reflect } : {}),
        }),
      },
      JSON.stringify(image),
    );
    p.public.response = {
      kind: "point-plot",
      label: "Place the image vertices",
      grid: {
        xMin: -10,
        xMax: 10,
        yMin: -10,
        yMax: 10,
        step: 1,
        xLabel: "x",
        yLabel: "y",
      },
      pointCount: 3,
      ordered: true,
      pointLabels: primes,
      connect: "polygon",
      given: {
        vertices: a.map(([x, y], i) => ({ x, y, label: labels[i]! })),
        closed: true,
      },
    };
    p.pointGrading = { mode: "exact" };
    const walkthrough = plane(a, image);
    if (walkthrough.kind === "scene") {
      const g = walkthrough.scene.elements[0];
      if (g?.type === "graph" && motions.length === 2) {
        const ghost = applySequence(a, [motions[0]!]);
        ghost.forEach((p, i) =>
          g.segments!.push({
            from: p,
            to: ghost[(i + 1) % 3]!,
            color: "gold",
            dash: "dash",
          }),
        );
      }
      p.walkthrough = walkthrough.scene;
    }
    return p;
  }
  throw new Error("No bounded geometry image");
}

function verifyDilation(c: Context): GeneratedProblem {
  for (let attempt = 0; attempt < 300; attempt++) {
    const center: Pt = [nonzero(c, 3), c.r(-3, 3)],
      k = pick(c.r, [2, 3, 0.5]);
    const v: Pt = [pick(c.r, [-2, 2]), pick(c.r, [-2, 2])];
    const delta: Pt = pick(
      c.r,
      k === 0.5
        ? ([
            [6, 8],
            [8, 6],
            [0, 10],
            [10, 0],
          ] as Pt[])
        : ([
            [3, 4],
            [4, 3],
            [0, 5],
            [5, 0],
          ] as Pt[]),
    );
    if (v[0] * delta[1] === v[1] * delta[0]) continue;
    const a = add(center, v),
      b = add(a, delta),
      p = add(center, scale(v, 2));
    const ap = add(center, scale(v, k)),
      bp = add(center, scale(add(v, delta), k)),
      pp = add(center, scale(v, 2 * k));
    if (!bounded([a, b, p, ap, bp, pp], 14)) continue;
    const slope =
      delta[0] === 0
        ? "Undefined (vertical line)"
        : delta[1] === 0
          ? "0"
          : `${delta[1]}/${delta[0]}`;
    const slopeOptions = shuffle(
      c.r,
      [...new Set([slope, "Undefined (vertical line)", "0", "1", "-1"])].slice(
        0,
        5,
      ),
    ).map((label, i) => ({ id: String(i), label }));
    const result = work(
      c,
      {
        prompt: `A dilation has center $C${point(center)}$ and scale factor $${k}$. $A${point(a)}$, $B${point(b)}$ and $P${point(p)}$ are given. Find the images, the length ratio and the image line's slope.`,
        hint: `Subtract the center coordinates ${point(center)} first, multiply by ${k}, then add the center back.`,
        explanation: [
          `$A'${point(ap)}$, $B'${point(bp)}$, $P'${point(pp)}$. Each displacement from $C$ is multiplied by $${k}$.`,
          `The length ratio $A'B'/AB=${k}$. The slope of $AB$ is ${slope}, and the slope of $A'B'$ is ${slope}. Equal slopes show parallel lines.`,
          "$P'$ stays on line $CA$, which passes through the center. Multiplying absolute coordinates would use the wrong center.",
        ],
        figure: plane([a, b, p], undefined, {
          center,
          names: ["A", "B", "P"],
          centerName: "C",
        }),
      },
      [
        {
          label: "Image $A'$",
          fields: [
            numericField("x-coordinate", ap[0]),
            numericField("y-coordinate", ap[1]),
          ],
        },
        {
          label: "Image $B'$",
          fields: [
            numericField("x-coordinate", bp[0]),
            numericField("y-coordinate", bp[1]),
          ],
        },
        {
          label: "Compare the lengths",
          fields: [numericField("A′B′ divided by AB", k)],
        },
        {
          label: "Slope of $A'B'$",
          fields: [
            {
              field: { kind: "choice", bank: "slope", label: "Slope" },
              value: slopeOptions.find((o) => o.label === slope)!.id,
            },
          ],
        },
        {
          label: "Image $P'$",
          fields: [
            numericField("x-coordinate", pp[0]),
            numericField("y-coordinate", pp[1]),
          ],
        },
      ],
      [{ id: "slope", label: "Slope", options: slopeOptions }],
    );
    const picture = plane([a, b, p], [ap, bp, pp], {
      center,
      names: ["A", "B", "P"],
      imageNames: ["A′", "B′", "P′"],
      centerName: "C",
    });
    if (picture.kind === "scene") {
      const g = picture.scene.elements[0];
      if (g?.type === "graph") {
        [ap, bp, pp].forEach((q) =>
          g.segments!.push({
            from: center,
            to: q,
            color: "gold",
            dash: "dash",
          }),
        );
        [a, ap].forEach((q) => {
          const corner: Pt = [q[0], center[1]];
          g.segments!.push(
            { from: center, to: corner, color: "gold" },
            { from: corner, to: q, color: "gold" },
          );
        });
      }
      result.walkthrough = picture.scene;
    }
    return result;
  }
  throw new Error("No bounded dilation");
}

function proof(
  c: Context,
  t: Teaching,
  statements: string[],
  reasons: string[],
  distractors: string[],
  coda?: Row,
): GeneratedProblem {
  const bankLabels = shuffle(c.r, [...new Set([...reasons, ...distractors])]);
  const banks: WorkBank[] = [
    {
      id: "reason",
      label: "Reason bank",
      options: bankLabels.map((label, i) => ({ id: i.toString(36), label })),
    },
  ];
  const rows: Row[] = statements.map((label, i) => ({
    label,
    fields: [
      {
        field: { kind: "choice", label: "Reason", bank: "reason" },
        value: banks[0]!.options.find((o) => o.label === reasons[i])!.id,
      },
    ],
  }));
  if (coda) rows.push(coda);
  return work(c, t, rows, banks, "steps");
}
function converse(c: Context): GeneratedProblem {
  const letters = pick(c.r, [
      ["A", "B", "C", "D", "E"],
      ["P", "Q", "R", "S", "T"],
      ["L", "M", "N", "U", "V"],
    ] as const),
    [a, b, cc, d, e] = letters,
    part = c.r(0, 9) < 3;
  const ratio = `${a}${d}/${a}${b}=${a}${e}/${a}${cc}`,
    given = part ? `${a}${d}/${d}${b}=${a}${e}/${e}${cc}` : ratio;
  const statements = [
    ...(part ? [`$${ratio}$`] : []),
    `$\\angle ${a}\\cong\\angle ${a}$`,
    `$\\triangle ${a}${d}${e}\\sim\\triangle ${a}${b}${cc}$`,
    `$\\angle ${a}${d}${e}\\cong\\angle ${a}${b}${cc}$`,
    `$${d}${e}\\parallel ${b}${cc}$`,
  ];
  const reasons = [
    ...(part ? ["Equal part/part ratios give equal part/whole ratios"] : []),
    "Reflexive property",
    "SAS similarity",
    "Corresponding angles of similar triangles are congruent",
    "Equal corresponding angles imply parallel lines",
  ];
  const f = plane([
    [0, 4],
    [-4, 0],
    [4, 0],
  ]);
  if (f.kind === "scene") {
    const g = f.scene.elements[0];
    if (g?.type === "graph") {
      g.points = [
        { x: 0, y: 4, label: a },
        { x: -4, y: 0, label: b },
        { x: 4, y: 0, label: cc },
        { x: -2, y: 2, label: d },
        { x: 2, y: 2, label: e },
      ];
      g.segments?.push({ from: [-2, 2], to: [2, 2], color: "warm" });
    }
  }
  return proof(
    c,
    {
      prompt: `In triangle $${a}${b}${cc}$, $${d}$ lies inside side $${a}${b}$ and $${e}$ lies inside side $${a}${cc}$. Given $${given}$. Prove $${d}${e}\\parallel ${b}${cc}$. Choose each reason.`,
      hint: `The two triangles share angle $${a}$. Use the ratios of the two sides around it.`,
      explanation: [
        part
          ? "Equal part-to-part ratios become equal part-to-whole ratios by adding one to each reciprocal."
          : "The two given side ratios surround the shared angle.",
        "SAS similarity gives equal corresponding angles. The converse of the corresponding-angles theorem forces the lines to be parallel.",
      ],
      figure: f,
    },
    statements,
    reasons,
    [
      "AA similarity",
      "SSS similarity",
      "Corresponding sides of similar triangles are proportional",
      "Parallel lines imply equal corresponding angles",
      "Alternate interior angles are congruent",
    ],
  );
}
function pythagoras(c: Context): GeneratedProblem {
  const [a, b, cc, d] = pick(c.r, [
      ["A", "B", "C", "D"],
      ["P", "Q", "R", "S"],
    ] as const),
    ad = c.r(2, 12),
    db = c.r(2, 12),
    coda = c.r(0, 9) < 3;
  const statements = [
    `$\\triangle ${a}${cc}${d}\\sim\\triangle ${a}${b}${cc}$ and $\\triangle ${cc}${b}${d}\\sim\\triangle ${a}${b}${cc}$`,
    `$${a}${cc}/${a}${b}=${a}${d}/${a}${cc}$; $${b}${cc}/${a}${b}=${d}${b}/${b}${cc}$`,
    `$${a}${cc}^2=${a}${d}\\cdot ${a}${b}$; $${b}${cc}^2=${d}${b}\\cdot ${a}${b}$`,
    `$${a}${cc}^2+${b}${cc}^2=(${a}${d}+${d}${b})${a}${b}$`,
    `$${a}${d}+${d}${b}=${a}${b}$, so $${a}${cc}^2+${b}${cc}^2=${a}${b}^2$`,
  ];
  const t: Teaching = {
    prompt: `Right triangle $${a}${b}${cc}$ has right angle $${cc}$. Altitude $${cc}${d}$ meets hypotenuse $${a}${b}$. Prove $${a}${cc}^2+${b}${cc}^2=${a}${b}^2$. Given: $\\angle ${a}${d}${cc}$ and $\\angle ${cc}${d}${b}$ are right angles; each small triangle shares an acute angle with the large triangle.${coda ? ` Finally use $${a}${d}=${ad}$ and $${d}${b}=${db}$ to find the two leg squares.` : ""}`,
    hint: coda
      ? `Match each small triangle's right angle and shared angle with those of $${a}${b}${cc}$. Then use $${a}${d}=${ad}$ and $${d}${b}=${db}$.`
      : `Match each small triangle's right angle and shared angle with those of $${a}${b}${cc}$.`,
    explanation: [
      "Two equal angle pairs give AA similarity. Corresponding sides then give the two proportions.",
      "Cross-multiply each proportion, add the results, and factor out the hypotenuse.",
      "The two pieces of the hypotenuse add to the whole, giving its square.",
      ...(coda
        ? [
            `The leg squares are ${ad * (ad + db)} and ${db * (ad + db)}; their sum is ${(ad + db) ** 2}.`,
          ]
        : []),
    ],
  };
  const height = Math.sqrt(ad * db),
    legA = Math.sqrt(ad * (ad + db)),
    legB = Math.sqrt(db * (ad + db));
  const g = graph({
    x: [-1, Math.max(ad + db, legA + ad + height + 8) + 1],
    y: [-Math.max(legB, height, db) - 4, Math.ceil(height) + 1],
    grid: false,
    aspect: 1,
  });
  g.point(0, 0, a)
    .point(ad + db, 0, b)
    .point(ad, height, cc)
    .point(ad, 0, d)
    .segment([0, 0], [ad + db, 0])
    .segment([0, 0], [ad, height])
    .segment([ad, height], [ad + db, 0])
    .segment([ad, 0], [ad, height], { color: "warm" });
  const marks: Element[] = [];
  const rightMark = (at: Pt, u: Pt, v: Pt) => {
    const corner = add(add(at, u), v);
    marks.push({
      type: "polyline",
      points: [add(at, u), corner, add(at, v)],
      stroke: "ink",
    });
  };
  rightMark([ad, 0], [0.8, 0], [0, 0.8]);
  rightMark(
    [ad, height],
    scale([-ad, -height], 0.8 / legA),
    scale([db, -height], 0.8 / legB),
  );
  let left = 0;
  for (const [width, h, n1, n2, nr] of [
    [legA, legB, a, b, cc],
    [ad, height, a, cc, d],
    [height, db, cc, b, d],
  ] as [number, number, string, string, string][]) {
    const origin: Pt = [left, -Math.max(legB, height, db) - 3],
      xEnd = add(origin, [width, 0]),
      yEnd = add(origin, [0, h]);
    g.segment(origin, xEnd)
      .segment(xEnd, yEnd)
      .segment(yEnd, origin)
      .point(...origin, nr)
      .point(...xEnd, n1)
      .point(...yEnd, n2);
    rightMark(origin, [0.8, 0], [0, 0.8]);
    left += width + 3;
  }
  t.figure = { kind: "scene", scene: scene(g, ...marks).build() };
  return proof(
    c,
    t,
    statements,
    [
      "AA similarity",
      "Corresponding sides of similar triangles are proportional",
      "Cross products property",
      "Addition of equalities and distributive property",
      "Segment addition, followed by substitution",
    ],
    [
      "Pythagorean Theorem",
      "SAS similarity",
      "Corresponding angles of similar triangles are congruent",
      "Angle addition postulate",
      "Vertical angles",
    ],
    coda
      ? {
          label: "Numeric check: the two leg squares",
          fields: [
            numericField(`${a}${cc} squared`, ad * (ad + db)),
            numericField(`${b}${cc} squared`, db * (ad + db)),
          ],
        }
      : undefined,
  );
}
function cpctc(c: Context): GeneratedProblem {
  const kind = c.r(0, 3);
  const cases = [
    {
      given:
        "$SM\\parallel IL$, $SM\\cong IL$, and segments $SI$ and $ML$ meet at $E$.",
      target: "$E$ is the midpoint of $SI$",
      rows: [
        "$\\angle MSE\\cong\\angle LIE$ and $\\angle SME\\cong\\angle ILE$",
        "$SM\\cong IL$",
        "$\\triangle SME\\cong\\triangle ILE$",
        "$SE\\cong IE$",
        "$E$ is the midpoint of $SI$",
      ],
      reasons: [
        "Alternate interior angles of parallel lines",
        "Given",
        "ASA congruence",
        "CPCTC",
        "Definition of midpoint",
      ],
      pts: [
        [-3, 2],
        [3, 2],
        [0, 0],
        [-3, -2],
        [3, -2],
      ] as Pt[],
      names: ["S", "M", "E", "L", "I"],
      edges: [
        [0, 1],
        [3, 4],
        [0, 4],
        [1, 3],
      ],
    },
    {
      given: "$AB\\cong AC$ and $AD$ bisects $\\angle BAC$, with $D$ on $BC$.",
      target: "$\\angle B\\cong\\angle C$",
      rows: [
        "$AB\\cong AC$",
        "$\\angle BAD\\cong\\angle CAD$",
        "$AD\\cong AD$",
        "$\\triangle BAD\\cong\\triangle CAD$",
        "$\\angle B\\cong\\angle C$",
      ],
      reasons: [
        "Given",
        "Definition of angle bisector",
        "Reflexive property",
        "SAS congruence",
        "CPCTC",
      ],
      pts: [
        [0, 4],
        [-3, 0],
        [3, 0],
        [0, 0],
      ] as Pt[],
      names: ["A", "B", "C", "D"],
      edges: [
        [0, 1],
        [0, 2],
        [1, 2],
        [0, 3],
      ],
    },
    {
      given:
        "$AB\\cong AC$ and $DB\\cong DC$, with $D$ inside $\\angle BAC$ and $B$ and $C$ on opposite sides of $AD$.",
      target: "$AD$ bisects $\\angle BAC$",
      rows: [
        "$AB\\cong AC$ and $DB\\cong DC$",
        "$AD\\cong AD$",
        "$\\triangle BAD\\cong\\triangle CAD$",
        "$\\angle BAD\\cong\\angle CAD$",
        "$AD$ bisects $\\angle BAC$",
      ],
      reasons: [
        "Given",
        "Reflexive property",
        "SSS congruence",
        "CPCTC",
        "Definition of angle bisector",
      ],
      pts: [
        [0, 4],
        [-3, 0],
        [3, 0],
        [0, -2],
      ] as Pt[],
      names: ["A", "B", "C", "D"],
      edges: [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 3],
        [0, 3],
      ],
    },
    {
      given: "$M$ is the midpoint of $AB$, and $CM\\perp AB$.",
      target: "$CA\\cong CB$",
      rows: [
        "$AM\\cong MB$",
        "$\\angle AMC\\cong\\angle BMC$",
        "$CM\\cong CM$",
        "$\\triangle AMC\\cong\\triangle BMC$",
        "$CA\\cong CB$",
      ],
      reasons: [
        "Definition of midpoint",
        "Perpendicular lines form congruent right angles",
        "Reflexive property",
        "SAS congruence",
        "CPCTC",
      ],
      pts: [
        [-3, 0],
        [3, 0],
        [0, 4],
        [0, 0],
      ] as Pt[],
      names: ["A", "B", "C", "M"],
      edges: [
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 3],
      ],
    },
  ];
  const data = cases[kind]!,
    g = graph({ x: [-5, 5], y: [-4, 6], grid: 1 });
  data.pts.forEach((p, i) => g.point(...p, data.names[i]));
  data.edges.forEach(([i, j]) => g.segment(data.pts[i!]!, data.pts[j!]!));
  const reasonLabels = shuffle(c.r, [
    ...new Set([
      ...data.reasons,
      "CPCTC",
      "SSA congruence",
      "AAS congruence",
      "Definition of midpoint",
      "Reflexive property",
    ]),
  ]);
  const statements = shuffle(c.r, [
    ...data.rows,
    ...(kind === 0
      ? ["$SE\\cong IL$", "$SM\\parallel SI$"]
      : ["$AB\\cong BC$", "$AB\\parallel AC$"]),
  ]);
  const banks: WorkBank[] = [
    {
      id: "statement",
      label: "Statement",
      options: statements.map((label, i) => ({ id: i.toString(36), label })),
    },
    {
      id: "reason",
      label: "Reason",
      options: reasonLabels.map((label, i) => ({ id: i.toString(36), label })),
    },
  ];
  const roles = [
    [
      "Angles from parallel lines",
      "The given side pair",
      "Triangle congruence",
      "Corresponding segments",
      "Midpoint conclusion",
    ],
    [
      "The given side pair",
      "The bisected angle",
      "The shared side",
      "Triangle congruence",
      "Corresponding base angles",
    ],
    [
      "The two given side pairs",
      "The shared side",
      "Triangle congruence",
      "Corresponding angles at $A$",
      "Angle-bisector conclusion",
    ],
    [
      "Segments from the midpoint",
      "Angles from perpendicular lines",
      "The shared side",
      "Triangle congruence",
      "Corresponding outer sides",
    ],
  ][kind]!;
  const rows: Row[] = data.rows.map((statement, i) => ({
    label: roles[i]!,
    fields: [
      {
        field: { kind: "choice", bank: "statement", label: "Statement" },
        value: statements.indexOf(statement).toString(36),
      },
      {
        field: { kind: "choice", bank: "reason", label: "Reason" },
        value: reasonLabels.indexOf(data.reasons[i]!).toString(36),
      },
    ],
  }));
  const p = work(
    c,
    {
      prompt: `Given: ${data.given} Prove: ${data.target}. Build each statement and reason in order. CPCTC means corresponding parts of congruent triangles are congruent.`,
      hint: `Use the marked side and angle information to prove the triangles congruent before using corresponding parts.`,
      explanation: data.rows
        .map((s, i) => `${s}: ${data.reasons[i]}.`)
        .concat([
          "Prove congruence before using equal corresponding parts. Then apply the definition of the requested relationship.",
        ]),
      figure: { kind: "scene", scene: g.scene() },
    },
    rows,
    banks,
  );
  if (p.public.response.kind === "structured-work") {
    p.public.response.layout = "proof";
    p.public.response.goal = data.target;
  }
  const statementIds = data.rows.map((s) => statements.indexOf(s).toString(36));
  const dependencies =
    kind === 0 || kind === 2
      ? [[], [], [0, 1], [2], [3]]
      : [[], [], [], [0, 1, 2], [3]];
  p.workGrading = {
    mode: "proof",
    goal: statementIds.at(-1)!,
    claims: Object.fromEntries(
      statementIds.map((id, i) => [
        id,
        {
          [reasonLabels.indexOf(data.reasons[i]!).toString(36)]: [
            dependencies[i]!.map((j) => statementIds[j]!),
          ],
        },
      ]),
    ),
  };
  return p;
}
