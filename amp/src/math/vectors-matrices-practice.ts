import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { assemble, random, shuffle } from "./distribution-practice";
import type { Draft, Random } from "./distribution-practice";
import { graph } from "./scene/author";

/** Vectors and matrices (HSN.VM, HSA.REI.C.8–9): one choice template per skill.
 * Every instance is built from an exact private model (integers or reduced
 * fractions); only the prompt and shuffled choices are public. */

const base = {
  version: 1 as const,
  gradeBand: "9–12" as const,
  requiredResponseCapability: "single-choice-v1" as const,
};
export const vectorComponentsTemplate: TemplateMetadata = {
  ...base,
  id: "vector-components",
  title: "Vectors from points and components",
  skillId: "vectors",
  difficultyOffset: 0.4,
  requiredFigureCapability: "scenes-v1",
  description:
    "Find components from initial and terminal points or an arrow drawn on a grid, a magnitude, and sums, differences and scalar multiples of vectors.",
};
export const vectorResultantTemplate: TemplateMetadata = {
  ...base,
  id: "vector-resultant",
  title: "Resultant of perpendicular velocities or forces",
  skillId: "vector-modeling",
  difficultyOffset: 0.6,
  description:
    "Combine two perpendicular velocities or forces: resultant magnitude, direction angle by arctangent, or a missing component.",
};
export const matrixDataTemplate: TemplateMetadata = {
  ...base,
  id: "matrix-data-reading",
  title: "Read a matrix of data",
  skillId: "matrix-data",
  difficultyOffset: 0.2,
  description:
    "Read an entry, row total or column total of an inventory matrix, name its dimensions, and say what an entry means.",
};
export const matrixOperationTemplate: TemplateMetadata = {
  ...base,
  id: "matrix-operations",
  title: "Add, scale and multiply matrices",
  skillId: "matrices",
  difficultyOffset: 0.5,
  description:
    "Add, scale and multiply small matrices exactly, and decide from dimensions whether a product is defined.",
};
export const matrixLawsTemplate: TemplateMetadata = {
  ...base,
  id: "matrix-laws",
  title: "Matrix products and laws",
  skillId: "matrix-properties",
  difficultyOffset: 0.7,
  description:
    "Compute products in both orders, recognize the identity matrix, and tell which algebra laws hold for matrices.",
};
export const matrixInverseTemplate: TemplateMetadata = {
  ...base,
  id: "matrix-inverse-determinant",
  title: "Determinants and 2×2 inverses",
  skillId: "matrix-inverses",
  difficultyOffset: 0.8,
  description:
    "Find a 2×2 determinant, decide whether an inverse exists, and compute an inverse with integer or fraction entries.",
};
export const matrixTransformTemplate: TemplateMetadata = {
  ...base,
  id: "matrix-transformation",
  title: "Matrices as transformations",
  skillId: "matrix-transformations",
  difficultyOffset: 0.8,
  description:
    "Apply a 2×2 matrix to a point, match rotation, reflection and dilation matrices, and use the absolute determinant as the area scale factor.",
};
export const matrixSystemTemplate: TemplateMetadata = {
  ...base,
  id: "matrix-linear-system",
  title: "Linear systems as matrix equations",
  skillId: "matrix-systems",
  difficultyOffset: 0.9,
  description:
    "Write a 2×2 linear system as $AX=B$, solve it with the inverse, and recognize a zero determinant.",
};
export const vectorMatrixTemplates: readonly TemplateMetadata[] = [
  vectorComponentsTemplate,
  vectorResultantTemplate,
  matrixDataTemplate,
  matrixOperationTemplate,
  matrixLawsTemplate,
  matrixInverseTemplate,
  matrixTransformTemplate,
  matrixSystemTemplate,
];

// ---------------------------------------------------------------- exact math
type Fr = { n: number; d: number };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const fr = (n: number, d = 1): Fr => {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
const fadd = (a: Fr, b: Fr) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const fmul = (a: Fr, b: Fr) => fr(a.n * b.n, a.d * b.d);
const fneg = (a: Fr) => fr(-a.n, a.d);
const feq = (a: Fr, b: Fr) => a.n === b.n && a.d === b.d;
const tex = (f: Fr) =>
  f.d === 1
    ? `${f.n}`
    : `${f.n < 0 ? "-" : ""}\\frac{${Math.abs(f.n)}}{${f.d}}`;
type Mat = Fr[][];
const mat = (rows: number[][]): Mat => rows.map((row) => row.map((x) => fr(x)));
const mmul = (a: Mat, b: Mat): Mat =>
  a.map((row, i) =>
    b[0]!.map((_, j) =>
      row.reduce((s, x, k) => fadd(s, fmul(x, b[k]![j]!)), fr(0)),
    ),
  );
const mmap = (a: Mat, f: (x: Fr, i: number, j: number) => Fr): Mat =>
  a.map((row, i) => row.map((x, j) => f(x, i, j)));
const madd = (a: Mat, b: Mat, sign = 1) =>
  mmap(a, (x, i, j) => fadd(x, sign === 1 ? b[i]![j]! : fneg(b[i]![j]!)));
const mscale = (k: Fr, a: Mat) => mmap(a, (x) => fmul(k, x));
const mT = (a: Mat): Mat => a[0]!.map((_, j) => a.map((row) => row[j]!));
const meq = (a: Mat, b: Mat) =>
  a.length === b.length &&
  a.every((row, i) => row.every((x, j) => feq(x, b[i]![j]!)));
const bm = (a: Mat) =>
  `\\begin{bmatrix}${a.map((row) => row.map((x) => tex(x).replace("\\frac", "\\dfrac")).join("&")).join("\\\\")}\\end{bmatrix}`;
const det2 = (a: Mat) =>
  fadd(fmul(a[0]![0]!, a[1]![1]!), fneg(fmul(a[0]![1]!, a[1]![0]!)));
const adj2 = (a: Mat): Mat => [
  [a[1]![1]!, fneg(a[0]![1]!)],
  [fneg(a[1]![0]!), a[0]![0]!],
];
const inv2 = (a: Mat) => mscale(fr(det2(a).d, det2(a).n), adj2(a));
const vec = (a: number, b: number) => `\\langle ${a}, ${b}\\rangle`;
const pt = (a: Fr, b: Fr) => `(${tex(a)}, ${tex(b)})`;
const col = (a: Fr, b: Fr) => bm([[a], [b]]);
const dollar = (s: string) => `$${s}$`;
const sign = (n: number) => (n < 0 ? "-" : "+");
/** k√m in simplest radical form, or an integer. */
function radical(n: number): string {
  let outside = 1;
  let inside = n;
  for (let f = 2; f * f <= inside; f++)
    while (inside % (f * f) === 0) {
      inside /= f * f;
      outside *= f;
    }
  if (inside === 1) return `${outside}`;
  return `${outside === 1 ? "" : outside}\\sqrt{${inside}}`;
}
const eqn = (a: number, b: number, e: number) => {
  const term = (c: number, v: string, first: boolean) =>
    `${first ? (c < 0 ? "-" : "") : c < 0 ? " - " : " + "}${Math.abs(c) === 1 ? "" : Math.abs(c)}${v}`;
  return `${term(a, "x", true)}${term(b, "y", false)} = ${e}`;
};

type Alt = { label: string; feedback: string };
/** One correct label plus the first three distinct, different wrong labels. */
function finish(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  draft: {
    prompt: string;
    hint: string;
    explanation: string[];
    correct: string;
    alts: Alt[];
    figure?: Draft["figure"];
  },
): GeneratedProblem {
  const seen = new Set([draft.correct]);
  const wrong = draft.alts.filter((alt) => {
    if (seen.has(alt.label)) return false;
    seen.add(alt.label);
    return true;
  });
  if (wrong.length < 3)
    throw new Error(
      `Insufficient distinct choices for ${meta.id}: ${draft.prompt.slice(0, 110)}`,
    );
  return assemble(meta, seed, r, {
    prompt: draft.prompt,
    ...(draft.figure ? { figure: draft.figure } : {}),
    answer: "",
    hint: draft.hint,
    explanation: draft.explanation,
    choices: [{ label: draft.correct, correct: true }, ...wrong.slice(0, 3)],
  });
}
function start(
  meta: TemplateMetadata,
  seed: string,
  variants: number,
  attempt: number,
) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  // A rare instance whose wrong answers collide is redrawn deterministically.
  const r = random(meta.id, attempt ? `${seed}~${attempt}` : seed);
  return { r, variant: r(0, variants - 1) };
}
function retry<T>(attempt: (n: number) => T): T {
  for (let n = 0; ; n++)
    try {
      return attempt(n);
    } catch (error) {
      if (n >= 40 || !String(error).includes("Insufficient distinct choices"))
        throw error;
    }
}
const nz = (r: Random, max: number) => r(1, max) * (r(0, 1) ? 1 : -1);
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const words = (list: string[]) =>
  list.length === 2
    ? `${list[0]} and ${list[1]}`
    : `${list.slice(0, -1).join(", ")}, and ${list.at(-1)}`;

// ------------------------------------------------------------------- vectors
export const vectorComponentsCase = (seed: string) =>
  retry((attempt) => vectorComponentsOnce(seed, attempt));
function vectorComponentsOnce(seed: string, attempt: number) {
  const meta = vectorComponentsTemplate;
  const { r, variant } = start(meta, seed, 6, attempt);
  const finishV = (d: Parameters<typeof finish>[3]) => ({
    variant,
    problem: finish(meta, seed, r, d),
  });
  if (variant === 0) {
    const [x1, y1] = [r(-6, 6), r(-6, 6)];
    let [dx, dy] = [r(-7, 7), r(-7, 7)];
    if (dx === 0 && dy === 0) dx = nz(r, 5);
    const [x2, y2] = [x1 + dx, y1 + dy];
    return finishV({
      prompt: `Vector $\\overrightarrow{AB}$ starts at the initial point $A(${x1}, ${y1})$ and ends at the terminal point $B(${x2}, ${y2})$. What are its components?`,
      hint: `The components are how far the vector moves right or left and up or down. Subtract the coordinates of $A(${x1}, ${y1})$ from those of $B(${x2}, ${y2})$ in the order terminal minus initial.`,
      explanation: [
        `Components are terminal minus initial: $x$: $${x2}-(${x1})=${dx}$ and $y$: $${y2}-(${y1})=${dy}$.`,
        `The vector is $${vec(dx, dy)}$.`,
      ],
      correct: dollar(vec(dx, dy)),
      alts: [
        {
          label: dollar(vec(-dx, -dy)),
          feedback:
            "Subtract in the order terminal minus initial. This is the vector from $B$ to $A$.",
        },
        {
          label: dollar(vec(x1 + x2, y1 + y2)),
          feedback:
            "Components come from subtracting the coordinates, not adding them.",
        },
        {
          label: dollar(vec(dy, dx)),
          feedback:
            "Keep the order: the first component is the change in $x$, the second the change in $y$.",
        },
        {
          label: dollar(vec(x2, y2)),
          feedback:
            "That is the position of $B$. Subtract the position of $A$ to get the change.",
        },
        {
          label: dollar(vec(dx, -dy)),
          feedback:
            "Subtract each coordinate in the same order; both signs follow from terminal minus initial.",
        },
      ],
    });
  }
  if (variant === 1) {
    const triples = [
      [3, 4],
      [5, 12],
      [8, 15],
      [6, 8],
      [7, 24],
    ];
    const useTriple = r(0, 1) === 1;
    let [a, b] = useTriple ? pick(r, triples) : [r(1, 7), r(1, 7)];
    if (!useTriple && a === b) b += 1;
    if (r(0, 1)) [a, b] = [b, a];
    a *= r(0, 1) ? 1 : -1;
    b *= r(0, 1) ? 1 : -1;
    const sq = a * a + b * b;
    return finishV({
      prompt: `Find the magnitude of $\\mathbf{v}=${vec(a, b)}$. Give the exact value in simplest radical form if it is not a whole number.`,
      hint: `The magnitude is the length of the arrow, the hypotenuse of a right triangle with legs $|${a}|$ and $|${b}|$. Square each component and add before taking the root.`,
      explanation: [
        `$|\\mathbf{v}|=\\sqrt{(${a})^2+(${b})^2}=\\sqrt{${a * a}+${b * b}}=\\sqrt{${sq}}$.`,
        `In simplest form this is $${radical(sq)}$.`,
      ],
      correct: dollar(radical(sq)),
      alts: [
        {
          label: dollar(`${Math.abs(a) + Math.abs(b)}`),
          feedback:
            "Adding the absolute values of the components gives the path along both legs, not the length of the arrow.",
        },
        {
          label: dollar(`${sq}`),
          feedback:
            "That is $a^2+b^2$. The magnitude is the square root of it.",
        },
        {
          label: dollar(`${a + b}`),
          feedback:
            "Components are added only when combining vectors. Length comes from the Pythagorean theorem.",
        },
        {
          label: dollar(radical(Math.abs(a) + Math.abs(b))),
          feedback:
            "Square each component before adding; the root applies to the sum of squares, not the sum of components.",
        },
      ],
    });
  }
  if (variant === 2) {
    const [a, b, c, d] = [nz(r, 5), nz(r, 5), nz(r, 5), nz(r, 5)];
    const k = pick(r, [1, 2, 3, -1, -2]);
    const minus = r(0, 1) === 1;
    const s = minus ? -1 : 1;
    const kt = k === 1 ? "" : k === -1 ? "-" : `${k}`;
    const expr = `${kt}\\mathbf{u}${minus ? "-" : "+"}\\mathbf{v}`;
    const ans: [number, number] = [k * a + s * c, k * b + s * d];
    return finishV({
      prompt: `Let $\\mathbf{u}=${vec(a, b)}$ and $\\mathbf{v}=${vec(c, d)}$. Find $${expr}$.`,
      hint: `Work one component at a time. Multiply $\\mathbf{u}=${vec(a, b)}$ by ${k} first if there is a scalar, then ${minus ? "subtract" : "add"} the matching components of $\\mathbf{v}=${vec(c, d)}$.`,
      explanation: [
        `Scale: $${k}\\mathbf{u}=${vec(k * a, k * b)}$.`,
        `Combine matching components: $x$: $${k * a}${minus ? "-" : "+"}(${c})=${ans[0]}$ and $y$: $${k * b}${minus ? "-" : "+"}(${d})=${ans[1]}$.`,
        `$${expr}=${vec(ans[0], ans[1])}$.`,
      ],
      correct: dollar(vec(ans[0], ans[1])),
      alts: [
        {
          label: dollar(vec(k * a - s * c, k * b - s * d)),
          feedback: `The operation is ${minus ? "subtraction" : "addition"}; apply it to matching components of the scaled $\\mathbf{u}$ and $\\mathbf{v}$.`,
        },
        {
          label: dollar(vec(a + s * c, b + s * d)),
          feedback: "Multiply $\\mathbf{u}$ by the scalar before combining.",
        },
        {
          label: dollar(vec(k * a + s * c, b + s * d)),
          feedback: "A scalar multiplies both components, not just the first.",
        },
        {
          label: dollar(vec(ans[1], ans[0])),
          feedback:
            "Keep the order: the first component is the horizontal one.",
        },
        {
          label: dollar(vec(ans[0], -ans[1])),
          feedback:
            "Check the sign of the second component; combine the second components with the same operation.",
        },
        {
          label: dollar(vec(-(k * a + s * c), -(k * b + s * d))),
          feedback: "Check each sign; this is the opposite vector.",
        },
        {
          label: dollar(vec(a + s * k * c, b + s * k * d)),
          feedback: "The scalar multiplies $\\mathbf{u}$, not $\\mathbf{v}$.",
        },
      ],
    });
  }
  const W = 8;
  if (variant === 3) {
    let [dx, dy] = [nz(r, 6), r(-6, 6)];
    if (r(0, 1)) [dx, dy] = [dy || 3, dx];
    // Keep both P and Q strictly inside the plotted axes so the arrow is fully visible.
    const inside = (d: number) =>
      [Math.max(-4, -(W - 1) - Math.min(0, d)), Math.min(4, W - 1 - Math.max(0, d))] as const;
    const [xlo, xhi] = inside(dx);
    const [ylo, yhi] = inside(dy);
    const px = r(xlo, xhi);
    const py = r(ylo, yhi);
    const [qx, qy] = [px + dx, py + dy];
    const figure = graph({ x: [-W, W], y: [-W, W], tick: 1 })
      .id("g")
      .point(px, py, "P")
      .point(qx, qy, "Q")
      .segment([px, py], [qx, qy], { arrow: true })
      .scene({ title: "Vector from P to Q" });
    return finishV({
      figure: { kind: "scene", scene: figure },
      prompt: `The graph shows vector $\\overrightarrow{PQ}$ from its tail $P$ to its tip $Q$. What are its components?`,
      hint: `Start at the tail $P$ and count the grid steps right or left, then up or down, to reach the tip $Q$. Right and up are positive.`,
      explanation: [
        `From $P(${px}, ${py})$ to $Q(${qx}, ${qy})$ the horizontal change is $${qx}-(${px})=${dx}$ and the vertical change is $${qy}-(${py})=${dy}$.`,
        `The vector is $${vec(dx, dy)}$.`,
      ],
      correct: dollar(vec(dx, dy)),
      alts: [
        {
          label: dollar(vec(-dx, -dy)),
          feedback:
            "This is $\\overrightarrow{QP}$. Move from the tail to the tip.",
        },
        {
          label: dollar(vec(dy, dx)),
          feedback:
            "Give the horizontal change first, then the vertical change.",
        },
        {
          label: dollar(vec(qx, qy)),
          feedback:
            "Those are the coordinates of $Q$. Components measure the change from $P$ to $Q$.",
        },
        {
          label: dollar(vec(dx, -dy)),
          feedback:
            "Up is positive and down is negative; check the vertical direction.",
        },
        {
          label: dollar(vec(-dx, dy)),
          feedback:
            "Right is positive and left is negative; check the horizontal direction.",
        },
      ],
    });
  }
  if (variant === 4) {
    const [a, b, c, d] = [nz(r, 4), nz(r, 4), nz(r, 4), nz(r, 4)];
    const figure = graph({ x: [-W, W], y: [-W, W], tick: 1 })
      .id("g")
      .point(0, 0, "O")
      .point(a, b, "P")
      .point(a + c, b + d, "Q")
      .segment([0, 0], [a, b], { arrow: true })
      .segment([a, b], [a + c, b + d], { arrow: true, color: "warm" })
      .scene({ title: "Vector u from O to P, then v from P to Q" });
    return finishV({
      figure: { kind: "scene", scene: figure },
      prompt: `The graph shows $\\mathbf{u}=\\overrightarrow{OP}$ and $\\mathbf{v}=\\overrightarrow{PQ}$ placed tip to tail. What are the components of $\\mathbf{u}+\\mathbf{v}$?`,
      hint: `Placed tip to tail, $\\mathbf{u}+\\mathbf{v}$ runs from the start of $\\mathbf{u}$ at $O$ to the end of $\\mathbf{v}$ at $Q$. Read the components of each arrow, or read where $Q$ is.`,
      explanation: [
        `$\\mathbf{u}=${vec(a, b)}$ and $\\mathbf{v}=${vec(c, d)}$.`,
        `Add matching components: $${a}+(${c})=${a + c}$ and $${b}+(${d})=${b + d}$.`,
        `The sum is $${vec(a + c, b + d)}$, the vector from $O$ to $Q$.`,
      ],
      correct: dollar(vec(a + c, b + d)),
      alts: [
        {
          label: dollar(vec(a - c, b - d)),
          feedback:
            "That is $\\mathbf{u}-\\mathbf{v}$. Tip to tail adds the vectors.",
        },
        {
          label: dollar(vec(c, d)),
          feedback:
            "That is only $\\mathbf{v}$. The sum goes all the way from $O$ to $Q$.",
        },
        {
          label: dollar(vec(a, b)),
          feedback: "That is only $\\mathbf{u}$. Include the second arrow.",
        },
        {
          label: dollar(vec(a + c, b - d)),
          feedback: "Add both pairs of components with their signs.",
        },
        {
          label: dollar(vec(b + d, a + c)),
          feedback: "Keep the order: horizontal component first.",
        },
      ],
    });
  }
  const triples: [number, number][] = [
    [3, 4],
    [5, 12],
    [8, 6],
    [12, 5],
  ];
  let [a, b] = pick(r, triples);
  a *= r(0, 1) ? 1 : -1;
  b *= r(0, 1) ? 1 : -1;
  const half = r(0, 3) === 0;
  if (half) [a, b] = [a * 2, b * 2];
  const k = half ? fr(-1, 2) : fr(pick(r, [-3, -2, 2, 3]));
  const length = Math.sqrt(a * a + b * b);
  const result = fmul(fr(Math.abs(k.n), k.d), fr(length));
  const kv = [fmul(k, fr(a)), fmul(k, fr(b))];
  return finishV({
    prompt: `Let $\\mathbf{v}=${vec(a, b)}$. What is the magnitude $|${tex(k)}\\mathbf{v}|$?`,
    hint: `Multiplying by ${tex(k)} stretches or flips the arrow but never makes a length negative. First find $|\\mathbf{v}|$ for $\\mathbf{v}=${vec(a, b)}$.`,
    explanation: [
      `$|\\mathbf{v}|=\\sqrt{(${a})^2+(${b})^2}=${length}$.`,
      `Scaling multiplies the length by $|${tex(k)}|=${tex(fr(Math.abs(k.n), k.d))}$.`,
      `$|${tex(k)}\\mathbf{v}|=${tex(fr(Math.abs(k.n), k.d))}\\cdot${length}=${tex(result)}$. Check with components: ${tex(kv[0]!)} and ${tex(kv[1]!)} give $\\sqrt{${tex(fmul(kv[0]!, kv[0]!))}+${tex(fmul(kv[1]!, kv[1]!))}}=${tex(result)}$.`,
    ],
    correct: dollar(tex(result)),
    alts: [
      {
        label: dollar(tex(fneg(result))),
        feedback:
          "A magnitude is a length and cannot be negative; use the absolute value of the scalar.",
      },
      {
        label: dollar(`${length}`),
        feedback:
          "Include the scalar: scaling by $k$ multiplies the length by $|k|$.",
      },
      {
        label: dollar(tex(fadd(fr(Math.abs(k.n), k.d), fr(length)))),
        feedback: "Multiply the length by $|k|$; do not add the scalar.",
      },
      {
        label: dollar(
          tex(fmul(fr(Math.abs(k.n), k.d), fr(Math.abs(a) + Math.abs(b)))),
        ),
        feedback:
          "Find the length with the Pythagorean theorem, not by adding absolute values of components.",
      },
    ],
  });
}

// ----------------------------------------------------------- vector modeling
type Mode = {
  setup: (s: number, c: number) => string;
  mag: string;
  unit: string;
  angle: string;
  angleOther: string;
  reverse: (R: number, c: number) => string;
  reverseAsk: string;
};
const modes: Mode[] = [
  {
    setup: (s, c) =>
      `A boat heads straight across a river at ${s} mph relative to the water. The current flows downstream at ${c} mph, perpendicular to the boat's heading.`,
    mag: "What is the boat's speed relative to the shore?",
    unit: "mph",
    angle:
      "The boat's actual path makes an angle $\\theta$ with its heading (straight across). Find $\\theta$.",
    angleOther:
      "The boat's actual path makes an angle $\\theta$ with the downstream direction. Find $\\theta$.",
    reverse: (R, c) =>
      `A boat heads straight across a river. The current flows downstream at ${c} mph, perpendicular to the boat's heading, and the boat's speed relative to the shore is ${R} mph.`,
    reverseAsk: "What is the boat's speed relative to the water?",
  },
  {
    setup: (s, c) =>
      `A plane flies due north at ${s} mph relative to the air. A wind blows due east at ${c} mph.`,
    mag: "What is the plane's speed relative to the ground?",
    unit: "mph",
    angle:
      "The plane's ground path points $\\theta$ degrees east of north. Find $\\theta$.",
    angleOther:
      "The plane's ground path points $\\theta$ degrees north of east. Find $\\theta$.",
    reverse: (R, c) =>
      `A plane heads due north through the air. A wind blows due east at ${c} mph, perpendicular to the plane's heading, and the plane's ground speed is ${R} mph.`,
    reverseAsk: "What is the plane's air speed?",
  },
  {
    setup: (s, c) =>
      `Two forces pull on a ring at right angles: ${s} newtons due east and ${c} newtons due north.`,
    mag: "What is the magnitude of the resultant force?",
    unit: "newtons",
    angle:
      "The resultant points $\\theta$ degrees north of east. Find $\\theta$.",
    angleOther:
      "The resultant points $\\theta$ degrees east of north. Find $\\theta$.",
    reverse: (R, c) =>
      `Two forces act on a ring at right angles. One force is ${c} newtons and the magnitude of the resultant is ${R} newtons.`,
    reverseAsk: "What is the magnitude of the other force?",
  },
];
export const vectorResultantCase = (seed: string) =>
  retry((attempt) => vectorResultantOnce(seed, attempt));
function vectorResultantOnce(seed: string, attempt: number) {
  const meta = vectorResultantTemplate;
  const { r, variant } = start(meta, seed, 5, attempt);
  const mode = pick(r, modes);
  const forces = mode === modes[2];
  const trip = pick(r, [
    [3, 4, 5],
    [5, 12, 13],
    [8, 15, 17],
    [7, 24, 25],
  ]);
  const scale = forces ? r(1, 6) : mode === modes[1] ? r(6, 14) : r(1, 4);
  // s is the larger perpendicular component, c the smaller.
  let s = trip[1]! * scale;
  let c = trip[0]! * scale;
  let R = trip[2]! * scale;
  let triple = true;
  if (variant === 1 || variant === 2 || variant === 3) {
    do {
      s = forces ? r(20, 90) : mode === modes[1] ? r(150, 450) : r(10, 40);
      c = r(Math.ceil(s * 0.35), Math.floor(s * 0.9));
    } while (
      s <= c ||
      Number.isInteger(Math.sqrt(s * s + c * c)) ||
      (variant === 1
        ? Math.abs(
            Math.sqrt(s * s + c * c) * 10 -
              Math.floor(Math.sqrt(s * s + c * c) * 10) -
              0.5,
          ) < 0.03
        : [Math.atan(c / s), Math.atan(s / c)].some(
            (t) =>
              Math.abs(
                (t * 180) / Math.PI - Math.floor((t * 180) / Math.PI) - 0.5,
              ) < 0.03,
          ))
    );
    R = Math.sqrt(s * s + c * c);
    triple = false;
  }
  const u = mode.unit;
  const lab = (x: number, digits = 0) =>
    dollar(`${x.toFixed(digits)}\\text{ ${u}}`);
  const deg = (x: number) => dollar(`${Math.round(x)}^\\circ`);
  const rad = (x: number) => (x * 180) / Math.PI;
  const finishV = (d: Parameters<typeof finish>[3]) => ({
    variant,
    problem: finish(meta, seed, r, d),
  });
  if (variant === 0 || variant === 1) {
    const rounded = variant === 1;
    const val = rounded ? Math.round(R * 10) / 10 : R;
    const digits = rounded ? 1 : 0;
    return finishV({
      prompt: `${mode.setup(s, c)} ${mode.mag}${rounded ? " Round to the nearest tenth." : ""}`,
      hint: `The two given quantities, ${s} and ${c}, are perpendicular, so they are the legs of a right triangle and the resultant is its hypotenuse. Square both and add.`,
      explanation: [
        `The perpendicular quantities ${s} ${u} and ${c} ${u} are the legs of a right triangle, and the resultant is the hypotenuse.`,
        `$\\sqrt{${s}^2+${c}^2}=\\sqrt{${s * s}+${c * c}}=\\sqrt{${s * s + c * c}}$${triple ? `$=${R}$` : `$\\approx${R.toFixed(3)}$, which rounds to ${val.toFixed(1)}`}.`,
        `The answer is ${val.toFixed(digits)} ${u}.`,
      ],
      correct: lab(val, digits),
      alts: [
        {
          label: lab(s + c),
          feedback:
            "Perpendicular quantities do not add directly; the resultant is shorter than the sum of the legs. Use the Pythagorean theorem.",
        },
        {
          label: lab(s - c),
          feedback:
            "Subtracting applies to opposite directions. These quantities are perpendicular, so use the Pythagorean theorem.",
        },
        {
          label: lab(s * s + c * c),
          feedback: "That is the sum of squares. Take its square root.",
        },
        {
          label: lab(Math.sqrt(s * s - c * c), digits),
          feedback:
            "The squares are added for a right triangle's hypotenuse, not subtracted.",
        },
        {
          label: lab(Math.max(s, c), digits),
          feedback: "The resultant is longer than either leg.",
        },
      ],
    });
  }
  if (variant === 2 || variant === 3) {
    const other = variant === 3;
    const theta = other ? rad(Math.atan(s / c)) : rad(Math.atan(c / s));
    const near = other ? c : s;
    const opp = other ? s : c;
    const t = Math.round(theta);
    return finishV({
      prompt: `${mode.setup(s, c)} ${other ? mode.angleOther : mode.angle} Round to the nearest degree.`,
      hint: `In the right triangle with legs ${s} and ${c}, $\\theta$ sits between the resultant and one leg. Decide which leg is opposite $\\theta$ and which is adjacent, then use the tangent ratio.`,
      explanation: [
        `Draw the right triangle: the legs are ${s} ${u} and ${c} ${u}. Here the leg opposite $\\theta$ is ${opp} and the adjacent leg is ${near}.`,
        `$\\tan\\theta=\\dfrac{${opp}}{${near}}$, so $\\theta=\\arctan\\left(\\dfrac{${opp}}{${near}}\\right)\\approx${theta.toFixed(1)}^\\circ$.`,
        `Rounded to the nearest degree, $\\theta=${t}^\\circ$.`,
      ],
      correct: deg(theta),
      alts: [
        {
          label: deg(90 - theta),
          feedback:
            "That is the other acute angle of the triangle. Check which leg is opposite $\\theta$.",
        },
        {
          label: deg(rad(Math.atan(opp / R))),
          feedback:
            "The tangent compares the two legs, opposite over adjacent, not a leg over the hypotenuse.",
        },
        {
          label: deg(rad(Math.atan(near / R))),
          feedback:
            "The tangent compares the two legs, opposite over adjacent, not a leg over the hypotenuse.",
        },
        {
          label: deg(rad(Math.atan(R / near))),
          feedback:
            "The tangent uses the legs; the resultant is the hypotenuse.",
        },
        ...[Math.asin(opp / near), Math.acos(opp / near)]
          .filter((t) => Number.isFinite(t))
          .map((t) => ({
            label: deg(rad(t)),
            feedback:
              "Sine and cosine compare a leg with the hypotenuse. The two legs are known, so use the tangent.",
          })),
        {
          label: deg(rad(Math.atan(R / opp))),
          feedback:
            "The tangent uses the legs; the resultant is the hypotenuse.",
        },
      ],
    });
  }
  return finishV({
    prompt: `${mode.reverse(R, c)} ${mode.reverseAsk}`,
    hint: `The resultant ${R} is the hypotenuse and ${c} is one leg. Rearrange $a^2+b^2=h^2$ to find the other leg.`,
    explanation: [
      `The resultant is the hypotenuse, so $${c}^2+x^2=${R}^2$.`,
      `$x^2=${R * R}-${c * c}=${R * R - c * c}$, so $x=${s}$.`,
      `The answer is ${s} ${u}.`,
    ],
    correct: lab(s),
    alts: [
      {
        label: lab(R - c),
        feedback:
          "Lengths along perpendicular directions do not subtract. Use $x^2=h^2-c^2$.",
      },
      {
        label: lab(Math.sqrt(R * R + c * c), 1),
        feedback:
          "The resultant is the hypotenuse, so the missing leg is shorter. Subtract the squares.",
      },
      {
        label: lab(R * R - c * c),
        feedback: "That is $x^2$. Take its square root.",
      },
      {
        label: lab(R + c),
        feedback: "The missing leg is shorter than the resultant.",
      },
    ],
  });
}

// --------------------------------------------------------------- matrix data
const storeNames = ["Eastside", "Westside", "Lakeview", "Hillcrest"];
const itemNames = ["backpacks", "lunch boxes", "water bottles", "notebooks"];
export const matrixDataCase = (seed: string) =>
  retry((attempt) => matrixDataOnce(seed, attempt));
function matrixDataOnce(seed: string, attempt: number) {
  const meta = matrixDataTemplate;
  const { r, variant } = start(meta, seed, 6, attempt);
  let m = r(2, 4);
  let n = r(2, 4);
  if (n === m) n = n === 4 ? 2 : n + 1;
  const pool = shuffle(
    r,
    Array.from({ length: 45 }, (_, i) => i + 5),
  );
  const A: number[][] = Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) => pool[i * n + j]!),
  );
  const stores = storeNames.slice(0, m);
  const items = itemNames.slice(0, n);
  const i = r(0, m - 1);
  const j = r(0, n - 1);
  const i2 = (i + r(1, m - 1)) % m;
  const j2 = (j + r(1, n - 1)) % n;
  const M = mat(A);
  const rowSum = (k: number) => A[k]!.reduce((s, x) => s + x, 0);
  const colSum = (k: number) => A.reduce((s, row) => s + row[k]!, 0);
  const total = A.flat().reduce((s, x) => s + x, 0);
  const setup = `Matrix $A=${bm(M)}$ lists the stock of ${words(items)} (columns, in that order) at ${words(stores)} (rows, in that order).`;
  const finishV = (d: Parameters<typeof finish>[3]) => ({
    variant,
    problem: finish(meta, seed, r, d),
  });
  const num = (x: number) => dollar(`${x}`);
  const ent = (a: number, b: number) => `a_{${a + 1}${b + 1}}`;
  if (variant === 0)
    return finishV({
      prompt: `${setup} How many ${items[j]} does ${stores[i]} have?`,
      hint: `${stores[i]} is row ${i + 1} and ${items[j]} is column ${j + 1}. Start at the first entry, ${A[0]![0]}, in row 1 and column 1, and move to where that row and that column cross.`,
      explanation: [
        `Row ${i + 1} is ${stores[i]} and column ${j + 1} is ${items[j]}.`,
        `The entry in row ${i + 1}, column ${j + 1} is ${A[i]![j]}.`,
      ],
      correct: num(A[i]![j]!),
      alts: [
        {
          label: num(A[i]![j2]!),
          feedback: `That is ${items[j2]} at ${stores[i]}. Use the column for ${items[j]}.`,
        },
        {
          label: num(A[i2]![j]!),
          feedback: `That is ${items[j]} at ${stores[i2]}. Use the row for ${stores[i]}.`,
        },
        {
          label: num(A[i2]![j2]!),
          feedback: "Check both the row and the column.",
        },
        {
          label: num(rowSum(i)),
          feedback: `That is the total of every item at ${stores[i]}, not one item.`,
        },
      ],
    });
  if (variant === 1)
    return finishV({
      prompt: `${setup} What are the dimensions of $A$, written rows $\\times$ columns?`,
      hint: `Each store is a row and each item is a column. Row 1 reads ${A[0]!.join(", ")}; count its entries for the columns, then count the rows. Dimensions are always written with the number of rows first.`,
      explanation: [
        `$A$ has ${m} rows, one for each of ${m} stores, and ${n} columns, one for each of ${n} items.`,
        `Its dimensions are $${m}\\times${n}$.`,
      ],
      correct: dollar(`${m}\\times${n}`),
      alts: [
        {
          label: dollar(`${n}\\times${m}`),
          feedback: "Rows come first. Count the rows, then the columns.",
        },
        {
          label: dollar(`${m}\\times${m}`),
          feedback: "The second number counts columns, which are the items.",
        },
        {
          label: dollar(`${n}\\times${n}`),
          feedback: "The first number counts rows, which are the stores.",
        },
        {
          label: dollar(`${m * n}`),
          feedback:
            "That is the number of entries. Dimensions give rows and columns separately.",
        },
      ],
    });
  if (variant === 2)
    return finishV({
      prompt: `${setup} Which statement describes the entry ${dollar(ent(i, j))}, in row ${i + 1} and column ${j + 1}?`,
      hint: `The first subscript, ${i + 1}, picks the row and the second, ${j + 1}, picks the column. Row 1 reads ${A[0]!.join(", ")}. Say what the row and the column stand for.`,
      explanation: [
        `Row ${i + 1} is ${stores[i]}; column ${j + 1} is ${items[j]}.`,
        `The entry is the number of ${items[j]} at ${stores[i]}, here ${A[i]![j]}.`,
      ],
      correct: `The number of ${items[j]} at ${stores[i]}`,
      alts: [
        {
          label: `The number of ${items[j2]} at ${stores[i]}`,
          feedback: "The second subscript picks the item (column).",
        },
        {
          label: `The number of ${items[j]} at ${stores[i2]}`,
          feedback: "The first subscript picks the store (row).",
        },
        {
          label: `The total ${items[j]} at all stores`,
          feedback: "An entry is one cell, not a column total.",
        },
        {
          label: `The total of all items at ${stores[i]}`,
          feedback: "An entry is one cell, not a row total.",
        },
      ],
    });
  if (variant === 3)
    return finishV({
      prompt: `${setup} How many items of all kinds does ${stores[i]} have in stock?`,
      hint: `${stores[i]} is row ${i + 1}. Add every entry in that row: ${A[i]!.join(", ")}.`,
      explanation: [
        `Row ${i + 1} is ${A[i]!.join(", ")}.`,
        `Their sum is ${A[i]!.join(" + ")} = ${rowSum(i)}.`,
      ],
      correct: num(rowSum(i)),
      alts: [
        {
          label: num(colSum(j)),
          feedback: `That adds a column, the total of ${items[j]} over all stores.`,
        },
        {
          label: num(total),
          feedback: "That adds every entry in the matrix. Add one row.",
        },
        {
          label: num(Math.max(...A[i]!)),
          feedback:
            "That is the largest single entry. Add all entries in the row.",
        },
        {
          label: num(rowSum(i2)),
          feedback: `That is the total for ${stores[i2]}. Use the row for ${stores[i]}.`,
        },
      ],
    });
  if (variant === 4)
    return finishV({
      prompt: `${setup} How many ${items[j]} are in stock at all the stores combined?`,
      hint: `${items[j]} is column ${j + 1}. Add every entry in that column: ${A.map((row) => row[j]).join(", ")}.`,
      explanation: [
        `Column ${j + 1} is ${A.map((row) => row[j]).join(", ")}.`,
        `Their sum is ${A.map((row) => row[j]).join(" + ")} = ${colSum(j)}.`,
      ],
      correct: num(colSum(j)),
      alts: [
        {
          label: num(rowSum(i)),
          feedback: "That adds a row, the total of every item at one store.",
        },
        {
          label: num(total),
          feedback: "That adds every entry. Add only the column for this item.",
        },
        {
          label: num(colSum(j2)),
          feedback: `That is the total of ${items[j2]}. Use the column for ${items[j]}.`,
        },
        {
          label: num(Math.max(...A.map((row) => row[j]!))),
          feedback:
            "That is the largest single entry. Add all entries in the column.",
        },
      ],
    });
  const wrongSwap = j < m && i < n;
  return finishV({
    prompt: `${setup} Which entry gives the number of ${items[j]} at ${stores[i]}?`,
    hint: `Write the row number of ${stores[i]} first, then the column number of ${items[j]}. An entry $a_{rc}$ is in row $r$ and column $c$. Row 1 reads ${A[0]!.join(", ")}.`,
    explanation: [
      `${stores[i]} is row ${i + 1} and ${items[j]} is column ${j + 1}.`,
      `The entry is $${ent(i, j)}$.`,
    ],
    correct: dollar(ent(i, j)),
    alts: [
      ...(wrongSwap
        ? [
            {
              label: dollar(ent(j, i)),
              feedback:
                "The row number comes first. The row is the store and the column is the item.",
            },
          ]
        : []),
      {
        label: dollar(ent(i, j2)),
        feedback: `That is ${items[j2]} at ${stores[i]}.`,
      },
      {
        label: dollar(ent(i2, j)),
        feedback: `That is ${items[j]} at ${stores[i2]}.`,
      },
      {
        label: dollar(ent(i2, j2)),
        feedback:
          "Both subscripts are wrong; match the store to the row and the item to the column.",
      },
    ],
  });
}

// ---------------------------------------------------------- matrix operations
export const matrixOperationCase = (seed: string) =>
  retry((attempt) => matrixOperationOnce(seed, attempt));
function matrixOperationOnce(seed: string, attempt: number) {
  const meta = matrixOperationTemplate;
  const { r, variant } = start(meta, seed, 6, attempt);
  const rand = (rows: number, cols: number, max = 5): number[][] =>
    Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => r(-max, max)),
    );
  const finishV = (d: Parameters<typeof finish>[3]) => ({
    variant,
    problem: finish(meta, seed, r, d),
  });
  const lbl = (a: Mat) => dollar(bm(a));
  const bump = (a: Mat) =>
    mmap(a, (x, i, j) => (i === 0 && j === 0 ? fadd(x, fr(1)) : x));
  const hadamard = (a: Mat, b: Mat) => mmap(a, (x, i, j) => fmul(x, b[i]![j]!));
  if (variant <= 2) {
    const rows = r(2, 3);
    const cols = r(2, 3);
    const A = mat(rand(rows, cols));
    const B = mat(rand(rows, cols));
    if (variant === 0) {
      const S = madd(A, B);
      return finishV({
        prompt: `Let $A=${bm(A)}$ and $B=${bm(B)}$. Find $A+B$.`,
        hint: `Both matrices are $${rows}\\times${cols}$, so add the entries in matching positions: row 1, column 1 of $A$ with row 1, column 1 of $B$, and so on.`,
        explanation: [
          `Add entries in the same position of $A$ and $B$.`,
          `$A+B=${bm(S)}$.`,
        ],
        correct: lbl(S),
        alts: [
          {
            label: lbl(madd(A, B, -1)),
            feedback: "That is $A-B$. Add matching entries.",
          },
          {
            label: lbl(hadamard(A, B)),
            feedback: "Matching entries are added, not multiplied.",
          },
          {
            label: lbl(
              mmap(S, (x, i, j) =>
                i === 0 && j === 0 ? fadd(A[0]![0]!, fneg(B[0]![0]!)) : x,
              ),
            ),
            feedback: "Check the sign of every sum, including the first entry.",
          },
          {
            label: lbl(bump(S)),
            feedback: "Recheck the arithmetic in the first entry.",
          },
        ],
      });
    }
    const k = pick(r, [-3, -2, 2, 3, 4]);
    if (variant === 1) {
      const P = mscale(fr(k), A);
      return finishV({
        prompt: `Let $A=${bm(A)}$. Find $${k}A$.`,
        hint: `A scalar multiple multiplies every entry. Multiply each of the ${rows * cols} entries of $A$ by ${k}.`,
        explanation: [
          `Multiply every entry of $A$ by ${k}.`,
          `$${k}A=${bm(P)}$.`,
        ],
        correct: lbl(P),
        alts: [
          {
            label: lbl(
              mmap(A, (x, i, j) => (i === 0 && j === 0 ? fmul(fr(k), x) : x)),
            ),
            feedback: "A scalar multiplies every entry, not just the first.",
          },
          {
            label: lbl(mmap(A, (x) => fadd(x, fr(k)))),
            feedback: "Multiply each entry by the scalar; do not add it.",
          },
          {
            label: lbl(mscale(fr(Math.abs(k)), A)),
            feedback: `Multiplying by ${k} also changes the sign of each entry.`,
          },
          {
            label: lbl(mscale(fr(-k), A)),
            feedback: `Check the sign: each entry is multiplied by ${k}, not ${-k}.`,
          },
        ],
      });
    }
    const minus = r(0, 1) === 1;
    const s = minus ? -1 : 1;
    const R = madd(mscale(fr(k), A), B, s);
    return finishV({
      prompt: `Let $A=${bm(A)}$ and $B=${bm(B)}$. Find $${k}A${minus ? "-" : "+"}B$.`,
      hint: `Do the scalar multiple first: multiply every entry of $A$ by ${k}. Then ${minus ? "subtract" : "add"} the matching entries of $B$.`,
      explanation: [
        `$${k}A=${bm(mscale(fr(k), A))}$.`,
        `Now ${minus ? "subtract" : "add"} $B$ entry by entry: $${k}A${minus ? "-" : "+"}B=${bm(R)}$.`,
      ],
      correct: lbl(R),
      alts: [
        {
          label: lbl(madd(mscale(fr(k), A), B, -s)),
          feedback: `The operation between the terms is ${minus ? "subtraction" : "addition"}.`,
        },
        {
          label: lbl(madd(A, B, s)),
          feedback: `Multiply $A$ by ${k} before combining.`,
        },
        {
          label: lbl(madd(A, mscale(fr(k), B), s)),
          feedback: `The scalar ${k} multiplies $A$, not $B$.`,
        },
        {
          label: lbl(mscale(fr(k), madd(A, B, s))),
          feedback: `The scalar multiplies only $A$, not the whole result.`,
        },
      ],
    });
  }
  if (variant === 3) {
    let A: Mat;
    let B: Mat;
    do {
      A = mat(rand(2, 2, 4));
      B = mat(rand(2, 2, 4));
    } while (
      meq(mmul(A, B), mmul(B, A)) ||
      meq(mmul(A, B), mT(mmul(A, B))) ||
      meq(mmul(A, mT(B)), mmul(A, B))
    );
    const P = mmul(A, B);
    return finishV({
      prompt: `Let $A=${bm(A)}$ and $B=${bm(B)}$. Find $AB$.`,
      hint: `Each entry of $AB$ is a row of $A$ times a column of $B$. For row 1, column 1 use $(${A[0]![0]!.n})(${B[0]![0]!.n})+(${A[0]![1]!.n})(${B[1]![0]!.n})$ and continue.`,
      explanation: [
        `Entry (1,1): $(${A[0]![0]!.n})(${B[0]![0]!.n})+(${A[0]![1]!.n})(${B[1]![0]!.n})=${P[0]![0]!.n}$. Entry (1,2): $(${A[0]![0]!.n})(${B[0]![1]!.n})+(${A[0]![1]!.n})(${B[1]![1]!.n})=${P[0]![1]!.n}$.`,
        `Entry (2,1): $(${A[1]![0]!.n})(${B[0]![0]!.n})+(${A[1]![1]!.n})(${B[1]![0]!.n})=${P[1]![0]!.n}$. Entry (2,2): $(${A[1]![0]!.n})(${B[0]![1]!.n})+(${A[1]![1]!.n})(${B[1]![1]!.n})=${P[1]![1]!.n}$.`,
        `$AB=${bm(P)}$.`,
      ],
      correct: lbl(P),
      alts: [
        {
          label: lbl(mmul(B, A)),
          feedback:
            "That is $BA$. In $AB$ the rows come from $A$ and the columns from $B$.",
        },
        {
          label: lbl(hadamard(A, B)),
          feedback:
            "Matrix multiplication is row times column, with products added, not entry times entry.",
        },
        {
          label: lbl(mmul(A, mT(B))),
          feedback:
            "Use columns of $B$, not rows, when pairing with rows of $A$.",
        },
        {
          label: lbl(mT(P)),
          feedback:
            "The rows of $AB$ come from the rows of $A$. Check which entries go where.",
        },
        {
          label: lbl(madd(A, B)),
          feedback: "That is $A+B$. A product multiplies rows by columns.",
        },
      ],
    });
  }
  if (variant === 4) {
    const A = mat(rand(2, 3, 3));
    const B = mat(rand(3, 2, 3));
    const P = mmul(A, B);
    const dropLast = mmap(P, (_, i, j) =>
      fadd(fmul(A[i]![0]!, B[0]![j]!), fmul(A[i]![1]!, B[1]![j]!)),
    );
    return finishV({
      prompt: `Let $A=${bm(A)}$ and $B=${bm(B)}$. Find $AB$.`,
      hint: `$A$ is $2\\times3$ and $B$ is $3\\times2$, so $AB$ is $2\\times2$. Each entry pairs a row of $A$ with a column of $B$ and adds three products; for row 1, column 1: $(${A[0]![0]!.n})(${B[0]![0]!.n})+(${A[0]![1]!.n})(${B[1]![0]!.n})+(${A[0]![2]!.n})(${B[2]![0]!.n})$.`,
      explanation: [
        `The inner dimensions match (3 and 3), and the product is $2\\times2$.`,
        `Each entry is a row of $A$ times a column of $B$: for example entry (1,1) is $(${A[0]![0]!.n})(${B[0]![0]!.n})+(${A[0]![1]!.n})(${B[1]![0]!.n})+(${A[0]![2]!.n})(${B[2]![0]!.n})=${P[0]![0]!.n}$.`,
        `$AB=${bm(P)}$.`,
      ],
      correct: lbl(P),
      alts: [
        {
          label: lbl(mmul(B, A)),
          feedback:
            "That is $BA$, a $3\\times3$ matrix. $AB$ has the rows of $A$ and the columns of $B$: $2\\times2$.",
        },
        {
          label: lbl(dropLast),
          feedback:
            "Each entry adds three products, one for each of the three columns of $A$.",
        },
        {
          label: lbl(mT(P)),
          feedback:
            "Rows of $AB$ come from rows of $A$; check which entry goes where.",
        },
        {
          label: lbl(mscale(fr(-1), P)),
          feedback: "Recheck the signs of the products.",
        },
        {
          label: lbl(bump(P)),
          feedback: "Recheck the arithmetic in the first entry.",
        },
      ],
    });
  }
  const askBA = r(0, 1) === 1;
  let lx = 2;
  let ly = 2;
  let ry = 2;
  let rx = 2;
  do {
    [lx, ly, ry] = [r(2, 4), r(2, 4), r(2, 4)];
    rx = ly;
    if (r(0, 1) === 1) {
      do rx = r(2, 4);
      while (rx === ly);
    }
  } while (lx === ry || (rx === ly && (ly === lx || ly === ry)));
  const defined = ly === rx;
  const [L, Rt] = askBA ? ["B", "A"] : ["A", "B"];
  const [p, q, rr, s] = askBA ? [rx, ry, lx, ly] : [lx, ly, rx, ry];
  const name = `${L}${Rt}`;
  const correct = defined
    ? `$${name}$ is defined and is $${lx}\\times${ry}$`
    : `$${name}$ is not defined: $${L}$ has ${ly} columns but $${Rt}$ has ${rx} rows`;
  return finishV({
    prompt: `Matrix $A$ is $${p}\\times${q}$ and matrix $B$ is $${rr}\\times${s}$. Which statement about the product $${name}$ is true?`,
    hint: `Read the dimensions $${p}\\times${q}$ and $${rr}\\times${s}$. Compare the number of columns of the left factor $${L}$ with the number of rows of the right factor $${Rt}$. A product exists only when they are equal; then the result has the rows of $${L}$ and the columns of $${Rt}$.`,
    explanation: defined
      ? [
          `$${L}$ has ${ly} columns and $${Rt}$ has ${rx} rows; they match, so the product is defined.`,
          `The product has the rows of $${L}$ and the columns of $${Rt}$: $${lx}\\times${ry}$.`,
        ]
      : [
          `$${L}$ has ${ly} columns and $${Rt}$ has ${rx} rows.`,
          `They are different, so the product $${name}$ is not defined.`,
        ],
    correct,
    alts: [
      {
        label: `$${name}$ is defined and is $${lx}\\times${ry}$`,
        feedback: `The columns of $${L}$ (${ly}) must equal the rows of $${Rt}$ (${rx}).`,
      },
      {
        label: `$${name}$ is defined and is $${ry}\\times${lx}$`,
        feedback: `A product has the rows of the left factor and the columns of the right factor.`,
      },
      {
        label: `$${name}$ is defined and is $${ly}\\times${rx}$`,
        feedback: `Use the rows of the left factor and the columns of the right factor; the inner numbers must match.`,
      },
      {
        label: `$${name}$ is defined and is $${lx}\\times${rx}$`,
        feedback: `The second dimension is the number of columns of the right factor.`,
      },
      {
        label: `$${name}$ is not defined: $${L}$ has ${ly} columns but $${Rt}$ has ${rx} rows`,
        feedback: `The columns of $${L}$ (${ly}) must equal the rows of $${Rt}$ (${rx}); here they do.`,
      },
      // When the product is undefined, rows-versus-columns facts are true but
      // irrelevant, which would make this a second defensible answer.
      ...(defined
        ? [
            {
              label: `$${name}$ is not defined: $${L}$ has ${lx} rows but $${Rt}$ has ${ry} columns`,
              feedback:
                "The inner dimensions, columns of the left and rows of the right, decide whether a product exists.",
            },
          ]
        : []),
    ],
  });
}

// -------------------------------------------------------------- matrix laws
const lawsTrue = [
  [
    "A(B+C)=AB+AC",
    "Matrix multiplication distributes over addition on the left.",
  ],
  [
    "(A+B)C=AC+BC",
    "Matrix multiplication distributes over addition on the right.",
  ],
  ["(AB)C=A(BC)", "Matrix multiplication is associative."],
  ["AI=IA=A", "The identity matrix leaves a square matrix unchanged."],
] as const;
const lawsFalse = [
  [
    "AB=BA",
    "Matrix multiplication is not commutative: the two orders usually differ.",
  ],
  [
    "(A+B)^2=A^2+2AB+B^2",
    "Expanding gives $A^2+AB+BA+B^2$, and $AB$ need not equal $BA$.",
  ],
  [
    "(AB)^2=A^2B^2",
    "$(AB)^2=ABAB$, and $B$ cannot be moved past $A$ in general.",
  ],
  [
    "(A+B)(A-B)=A^2-B^2",
    "Expanding gives $A^2-AB+BA-B^2$, and $AB$ need not equal $BA$.",
  ],
  [
    "AB=AC\\text{ implies }B=C",
    "Matrices without inverses cannot be cancelled this way.",
  ],
] as const;
export const matrixLawsCase = (seed: string) =>
  retry((attempt) => matrixLawsOnce(seed, attempt));
function matrixLawsOnce(seed: string, attempt: number) {
  const meta = matrixLawsTemplate;
  const { r, variant } = start(meta, seed, 6, attempt);
  const finishV = (d: Parameters<typeof finish>[3]) => ({
    variant,
    problem: finish(meta, seed, r, d),
  });
  const rand = (max = 3) =>
    mat([
      [r(-max, max), r(-max, max)],
      [r(-max, max), r(-max, max)],
    ]);
  const lbl = (a: Mat) => dollar(bm(a));
  const pair = () => {
    let A: Mat;
    let B: Mat;
    do {
      A = rand();
      B = rand();
    } while (meq(mmul(A, B), mmul(B, A)));
    return [A, B] as const;
  };
  if (variant === 0) {
    let A: Mat;
    let B: Mat;
    do [A, B] = pair();
    while (
      new Set(
        [
          mmul(A, B),
          mmap(A, (x, i, j) => fmul(x, B[i]![j]!)),
          mT(mmul(B, A)),
          mmul(B, mT(A)),
        ].map(bm),
      ).size < 4 ||
      [mmul(A, B), mT(mmul(B, A)), mmul(B, mT(A))].some((m) =>
        meq(m, mmul(B, A)),
      )
    );
    const AB = mmul(A, B);
    const BA = mmul(B, A);
    return finishV({
      prompt: `Let $A=${bm(A)}$ and $B=${bm(B)}$. Find $BA$.`,
      hint: `In $BA$ the left factor is $B$: each entry pairs a row of $B$ with a column of $A$. For row 1, column 1: $(${B[0]![0]!.n})(${A[0]![0]!.n})+(${B[0]![1]!.n})(${A[1]![0]!.n})$. For row 2, column 2: $(${B[1]![0]!.n})(${A[0]![1]!.n})+(${B[1]![1]!.n})(${A[1]![1]!.n})$.`,
      explanation: [
        `Row of $B$ times column of $A$: entry (1,1) is $(${B[0]![0]!.n})(${A[0]![0]!.n})+(${B[0]![1]!.n})(${A[1]![0]!.n})=${BA[0]![0]!.n}$.`,
        `$BA=${bm(BA)}$. For comparison, $AB=${bm(AB)}$, which is different.`,
      ],
      correct: lbl(BA),
      alts: [
        {
          label: lbl(AB),
          feedback:
            "That is $AB$. In $BA$, $B$ is the left factor and gives the rows.",
        },
        {
          label: lbl(mmap(A, (x, i, j) => fmul(x, B[i]![j]!))),
          feedback:
            "Multiply rows by columns and add; do not multiply entries in matching positions.",
        },
        {
          label: lbl(mT(BA)),
          feedback: "The rows of $BA$ come from the rows of $B$.",
        },
        {
          label: lbl(mmul(B, mT(A))),
          feedback: "Pair rows of $B$ with columns of $A$.",
        },
      ],
    });
  }
  const showEntry = (i: number, j: number, P: Mat, Q: Mat) => ({
    i,
    j,
    p: P[i]![j]!.n,
    q: Q[i]![j]!.n,
  });
  if (variant === 1 || variant === 2) {
    let A: Mat;
    let B: Mat;
    if (variant === 1) [A, B] = pair();
    else {
      do A = rand(2);
      while (
        feq(A[0]![1]!, fr(0)) &&
        feq(A[1]![0]!, fr(0)) &&
        feq(A[0]![0]!, A[1]![1]!)
      );
      const x = nz(r, 3);
      const y = r(-3, 3);
      B = madd(
        mscale(fr(x), A),
        mscale(
          fr(y),
          mat([
            [1, 0],
            [0, 1],
          ]),
        ),
      );
    }
    const AB = mmul(A, B);
    const BA = mmul(B, A);
    const commute = meq(AB, BA);
    let [ei, ej] = [0, 1];
    if (!commute)
      for (const [i, j] of [
        [0, 1],
        [1, 0],
        [0, 0],
        [1, 1],
      ] as const)
        if (!feq(AB[i]![j]!, BA[i]![j]!)) {
          [ei, ej] = [i, j];
          break;
        }
    const e = showEntry(ei, ej, AB, BA);
    const where = `row ${e.i + 1}, column ${e.j + 1}`;
    const had = fmul(A[e.i]![e.j]!, B[e.i]![e.j]!).n;
    const differs = (p: number, q: number) =>
      `$AB\\ne BA$: the entry in ${where} is $${p}$ in $AB$ and $${q}$ in $BA$`;
    const same = (p: number) =>
      `$AB=BA$: the entry in ${where} is $${p}$ in both`;
    const prompt = `Let $A=${bm(A)}$ and $B=${bm(B)}$. Which statement is true?`;
    const hint = `Compute both products, $AB$ and $BA$, at least for the entry in ${where}: pair row ${e.i + 1} of the left factor with column ${e.j + 1} of the right factor, once with $A$ on the left and once with $B$ on the left.`;
    const explanation = [
      `$AB=${bm(AB)}$ and $BA=${bm(BA)}$.`,
      commute
        ? `The two products are equal, so $AB=BA$ for this pair; the entry in ${where} is ${e.p} in both.`
        : `The products differ, so $AB\\ne BA$; the entry in ${where} is ${e.p} in $AB$ and ${e.q} in $BA$.`,
    ];
    if (!commute)
      return finishV({
        prompt,
        hint,
        explanation,
        correct: differs(e.p, e.q),
        alts: [
          {
            label: differs(e.q, e.p),
            feedback:
              "The orders are swapped: in $AB$, $A$ is the left factor and supplies the rows.",
          },
          {
            label: same(e.p),
            feedback: "Compute $BA$ too. These two matrices do not commute.",
          },
          {
            label: same(e.q),
            feedback:
              "Compute both orders; the products are different matrices.",
          },
          {
            label: differs(e.p, had === e.p ? e.p + 1 : had),
            feedback:
              "Recompute $BA$ with row-by-column products, not entry-by-entry products.",
          },
          {
            label: differs(had === e.q ? e.q + 1 : had, e.q),
            feedback:
              "Recompute $AB$ with row-by-column products, not entry-by-entry products.",
          },
        ],
      });
    return finishV({
      prompt,
      hint,
      explanation,
      correct: same(e.p),
      alts: [
        {
          label: `$AB\\ne BA$ because matrices never commute`,
          feedback:
            "Some pairs do commute. Matrix multiplication is only not commutative in general; compute both products.",
        },
        {
          label: differs(e.p, had === e.p ? e.p + 1 : had),
          feedback:
            "Recompute $BA$ with row-by-column products; the two orders agree for this pair.",
        },
        {
          label: `$AB=BA$ only if one of them is the identity matrix`,
          feedback:
            "Other pairs commute too. Compute both products and compare.",
        },
        {
          label: differs(e.p + 1, e.p),
          feedback: "Recompute $AB$; the two products agree.",
        },
      ],
    });
  }
  if (variant === 3) {
    const I = mat([
      [1, 0],
      [0, 1],
    ]);
    const A = rand(4);
    const pool = [
      [
        mat([
          [0, 1],
          [1, 0],
        ]),
        "That matrix swaps the rows of the matrix it multiplies; it does not leave it unchanged.",
      ],
      [
        mat([
          [1, 1],
          [1, 1],
        ]),
        "Multiplying by a matrix of ones adds rows or columns together.",
      ],
      [
        mat([
          [0, 0],
          [0, 0],
        ]),
        "Multiplying by the zero matrix gives the zero matrix.",
      ],
      [
        mat([
          [1, 0],
          [0, -1],
        ]),
        "The $-1$ changes signs in one row or column.",
      ],
      [
        mat([
          [0, 1],
          [0, 1],
        ]),
        "That matrix collapses the other matrix instead of leaving it unchanged.",
      ],
    ] as const;
    const wrong = shuffle(r, [...pool]).slice(0, 3);
    return finishV({
      prompt: `Which $2\\times2$ matrix $I$ satisfies $IA=A$ and $AI=A$ for every $2\\times2$ matrix $A$?`,
      hint: `Test each choice on a simple matrix such as $A=${bm(A)}$: multiplying by the right matrix must return $A$ itself, with ones on the main diagonal playing the role of the number 1.`,
      explanation: [
        `The identity matrix has ones on the main diagonal and zeros elsewhere.`,
        `For $A=${bm(A)}$: $IA=${bm(mmul(I, A))}$ and $AI=${bm(mmul(A, I))}$, both equal $A$.`,
      ],
      correct: lbl(I),
      alts: wrong.map(([m, feedback]) => ({ label: lbl(m), feedback })),
    });
  }
  const trueLaw = pick(r, lawsTrue);
  const falseLaws = shuffle(r, [...lawsFalse]);
  if (variant === 4)
    return finishV({
      prompt: `$A$, $B$ and $C$ are $2\\times2$ matrices, and $I$ is the $2\\times2$ identity. Which equation holds for all such matrices?`,
      hint: `Test the tempting equations on a small pair such as $A=${bm(
        mat([
          [1, 1],
          [0, 1],
        ]),
      )}$, $B=${bm(
        mat([
          [1, 0],
          [1, 1],
        ]),
      )}$. Only a law that always holds can be correct; remember the order of factors matters.`,
      explanation: [
        trueLaw[1],
        `The other equations fail for some matrices; for example, in general $AB\\ne BA$.`,
        `The equation that holds for all matrices is $${trueLaw[0]}$.`,
      ],
      correct: dollar(trueLaw[0]),
      alts: falseLaws.map(([l, feedback]) => ({ label: dollar(l), feedback })),
    });
  const [badLaw, why] = falseLaws[0]!;
  const goodLaws = shuffle(r, [...lawsTrue]);
  return finishV({
    prompt: `$A$, $B$ and $C$ are $2\\times2$ matrices, and $I$ is the $2\\times2$ identity. Which equation does NOT hold for all such matrices?`,
    hint: `Three of the choices are laws that always hold. Look for the one that treats matrices like numbers by changing the order of factors or cancelling.`,
    explanation: [why, `So $${badLaw}$ is not true for all matrices.`],
    correct: dollar(badLaw),
    alts: goodLaws.map(([l, feedback]) => ({
      label: dollar(l),
      feedback: `${feedback} This law always holds.`,
    })),
  });
}

// ----------------------------------------------------------- matrix inverses
export const matrixInverseCase = (seed: string) =>
  retry((attempt) => matrixInverseOnce(seed, attempt));
function matrixInverseOnce(seed: string, attempt: number) {
  const meta = matrixInverseTemplate;
  const { r, variant } = start(meta, seed, 5, attempt);
  const finishV = (d: Parameters<typeof finish>[3]) => ({
    variant,
    problem: finish(meta, seed, r, d),
  });
  const lbl = (a: Mat) => dollar(bm(a));
  const rnd = (max: number) => r(-max, max);
  if (variant === 0) {
    const [a, b, c, d] = [nz(r, 6), nz(r, 6), nz(r, 6), nz(r, 6)];
    const D = a * d - b * c;
    return finishV({
      prompt: `Find the determinant of $A=${bm(
        mat([
          [a, b],
          [c, d],
        ]),
      )}$.`,
      hint: `For $\\begin{bmatrix}p&q\\\\s&t\\end{bmatrix}$ the determinant is $pt-qs$: multiply the main diagonal, then subtract the product of the other diagonal. Here the diagonals are ${a}, ${d} and ${b}, ${c}.`,
      explanation: [
        `$\\det A=ad-bc=(${a})(${d})-(${b})(${c})=${a * d}-(${b * c})=${D}$.`,
      ],
      correct: dollar(`${D}`),
      alts: [
        {
          label: dollar(`${a * d + b * c}`),
          feedback:
            "Subtract the product of the off-diagonal entries; do not add.",
        },
        {
          label: dollar(`${-D}`),
          feedback:
            "The main-diagonal product comes first: $ad-bc$, not $bc-ad$.",
        },
        {
          label: dollar(`${a * b - c * d}`),
          feedback:
            "Multiply down the diagonals: $a$ with $d$, and $b$ with $c$.",
        },
        { label: dollar(`${a * d}`), feedback: "Subtract $bc$ too." },
        {
          label: dollar(`${-(a * d + b * c)}`),
          feedback: "Multiply along each diagonal and subtract: $ad-bc$.",
        },
        {
          label: dollar(`${a + d - b - c}`),
          feedback:
            "The determinant uses products of diagonal entries, not sums.",
        },
      ],
    });
  }
  if (variant === 1) {
    const a = nz(r, 4);
    const b = nz(r, 4);
    const k = pick(r, [-3, -2, 2, 3]);
    const S = mat([
      [a, b],
      [k * a, k * b],
    ]);
    const near = (di: number, dj: number): Mat => {
      const rows = [
        [a, b],
        [k * a, k * b],
      ];
      rows[di]![dj]! += r(0, 1) ? 1 : -1;
      return mat(rows);
    };
    const others = [near(0, 0), near(0, 1), near(1, 0), near(1, 1)].filter(
      (m) => !feq(det2(m), fr(0)),
    );
    return finishV({
      prompt: `Exactly one of these $2\\times2$ matrices has no inverse. Which one?`,
      hint: `A $2\\times2$ matrix has no inverse exactly when its determinant $ad-bc$ is 0. Compute $ad-bc$ for each choice; a zero determinant happens when one row is a multiple of the other.`,
      explanation: [
        `A $2\\times2$ matrix is invertible exactly when $\\det\\ne0$.`,
        `For $${bm(S)}$: $\\det=(${a})(${k * b})-(${b})(${k * a})=${a * k * b}-(${b * k * a})=0$, since the second row is ${k} times the first.`,
        `Each other choice has a nonzero determinant, so it has an inverse.`,
      ],
      correct: lbl(S),
      alts: others.slice(0, 3).map((m) => ({
        label: lbl(m),
        feedback: `Its determinant is ${det2(m).n}, which is not 0, so this matrix has an inverse.`,
      })),
    });
  }
  if (variant === 2) {
    let [a, b, c] = [0, 0, 0];
    do [a, b, c] = [nz(r, 5), nz(r, 5), nz(r, 4)];
    while (
      new Set(
        [
          fr(a * b, c),
          fr(a * b, 1),
          fr(-a * b, c),
          fr(b * c, a),
          fr(c, a * b),
          fr(a * c, b),
          fr(a + b, c),
        ].map(tex),
      ).size < 6
    );
    const k = fr(a * b, c);
    const f = (n: number, d: number) => dollar(tex(fr(n, d)));
    return finishV({
      prompt: `For which value of $k$ does $\\begin{bmatrix}k&${a}\\\\${b}&${c}\\end{bmatrix}$ have no inverse?`,
      hint: `A matrix has no inverse when $\\det=0$. Write the determinant $kc-${a}\\cdot${b}$ with the numbers from the matrix, set it equal to 0 and solve for $k$.`,
      explanation: [
        `$\\det=k\\cdot${c}-(${a})(${b})=${c}k-${a * b}$.`,
        `Set $${c}k-${a * b}=0$, so $k=\\dfrac{${a * b}}{${c}}=${tex(k)}$.`,
      ],
      correct: dollar(tex(k)),
      alts: [
        {
          label: f(a * b, 1),
          feedback: `Divide by the coefficient ${c} of $k$ after setting the determinant to 0.`,
        },
        {
          label: f(-a * b, c),
          feedback: "Check the sign when moving the term across the equation.",
        },
        {
          label: f(b * c, a),
          feedback:
            "The determinant is $kc-ab$; $k$ is multiplied by the opposite corner entry.",
        },
        {
          label: f(c, a * b),
          feedback: "Solve $kc=ab$ for $k$ by dividing by $c$.",
        },
        {
          label: f(a * c, b),
          feedback:
            "In $\\det=kc-ab$, $k$ is multiplied by $c$; divide $ab$ by $c$.",
        },
        {
          label: f(a + b, c),
          feedback:
            "Set the determinant $kc-ab$ to 0 and solve; do not add the entries.",
        },
      ],
    });
  }
  const unit = variant === 3;
  const wrongInverses = (A: Mat): [Mat, string][] => {
    const D = det2(A).n;
    const rat = (x: number) => fr(x, D);
    const adj = adj2(A);
    return [
      [
        adj,
        `Divide every entry of the swapped matrix by the determinant, ${D}.`,
      ],
      [
        mscale(rat(1), [
          [A[0]![0]!, adj[0]![1]!],
          [adj[1]![0]!, A[1]![1]!],
        ]),
        "The main-diagonal entries swap places; they are not kept in place.",
      ],
      [
        mscale(rat(1), [
          [adj[0]![0]!, A[0]![1]!],
          [A[1]![0]!, adj[1]![1]!],
        ]),
        "Change the signs of the off-diagonal entries; do not leave them.",
      ],
      [
        mscale(rat(-1), adj),
        "Only the off-diagonal signs change; the swapped diagonal entries keep their signs.",
      ],
      [
        mT(mscale(rat(1), A)),
        "A transpose is not an inverse. Use the swap-and-negate rule and divide by the determinant.",
      ],
    ];
  };
  let [a, b, c, d] = [0, 0, 0, 0];
  do {
    [a, b, c, d] = [nz(r, 4), nz(r, 4), nz(r, 4), nz(r, 4)];
  } while (
    (unit
      ? Math.abs(a * d - b * c) !== 1
      : [0, 1, -1].includes(a * d - b * c) || Math.abs(a * d - b * c) > 6) ||
    new Set(
      [
        inv2(
          mat([
            [a, b],
            [c, d],
          ]),
        ),
        ...wrongInverses(
          mat([
            [a, b],
            [c, d],
          ]),
        ).map(([m]) => m),
      ].map(bm),
    ).size < 4
  );
  const A = mat([
    [a, b],
    [c, d],
  ]);
  const D = a * d - b * c;
  const I = inv2(A);
  const adj = adj2(A);
  return finishV({
    prompt: `Find the inverse of $A=${bm(A)}$.`,
    hint: `For $\\begin{bmatrix}p&q\\\\s&t\\end{bmatrix}$ the inverse is $\\frac{1}{pt-qs}\\begin{bmatrix}t&-q\\\\-s&p\\end{bmatrix}$. Swap the main-diagonal entries, change the signs of the other two, and divide everything by the determinant. First find $\\det A$ for $A=${bm(A)}$.`,
    explanation: [
      `$\\det A=(${a})(${d})-(${b})(${c})=${D}$, which is not 0, so $A^{-1}$ exists.`,
      `Swap $${a}$ and $${d}$, change the signs of $${b}$ and $${c}$: $${bm(adj)}$.`,
      `Divide by the determinant ${D}: $A^{-1}=${bm(I)}$. Check: $AA^{-1}=${bm(mmul(A, I))}$.`,
    ],
    correct: lbl(I),
    alts: wrongInverses(A).map(([m, feedback]) => ({
      label: lbl(m),
      feedback,
    })),
  });
}

// ------------------------------------------------------ matrix transformations
const transforms: { name: string; m: number[][] }[] = [
  {
    name: "Rotates points $90^\\circ$ counterclockwise about the origin",
    m: [
      [0, -1],
      [1, 0],
    ],
  },
  {
    name: "Rotates points $90^\\circ$ clockwise about the origin",
    m: [
      [0, 1],
      [-1, 0],
    ],
  },
  {
    name: "Rotates points $180^\\circ$ about the origin",
    m: [
      [-1, 0],
      [0, -1],
    ],
  },
  {
    name: "Reflects points across the $x$-axis",
    m: [
      [1, 0],
      [0, -1],
    ],
  },
  {
    name: "Reflects points across the $y$-axis",
    m: [
      [-1, 0],
      [0, 1],
    ],
  },
  {
    name: "Reflects points across the line $y=x$",
    m: [
      [0, 1],
      [1, 0],
    ],
  },
  {
    name: "Dilates points by a factor of 2 from the origin",
    m: [
      [2, 0],
      [0, 2],
    ],
  },
  {
    name: "Dilates points by a factor of 3 from the origin",
    m: [
      [3, 0],
      [0, 3],
    ],
  },
];
export const matrixTransformCase = (seed: string) =>
  retry((attempt) => matrixTransformOnce(seed, attempt));
function matrixTransformOnce(seed: string, attempt: number) {
  const meta = matrixTransformTemplate;
  const { r, variant } = start(meta, seed, 6, attempt);
  const finishV = (d: Parameters<typeof finish>[3]) => ({
    variant,
    problem: finish(meta, seed, r, d),
  });
  const lbl = (a: Mat) => dollar(bm(a));
  const apply = (M: Mat, x: number, y: number) => mmul(M, [[fr(x)], [fr(y)]]);
  const ptl = (v: Mat) => dollar(pt(v[0]![0]!, v[1]![0]!));
  const ptWork = (M: Mat, x: number, y: number) => {
    const v = apply(M, x, y);
    return `$M\\begin{bmatrix}${x}\\\\${y}\\end{bmatrix}=\\begin{bmatrix}(${M[0]![0]!.n})(${x})+(${M[0]![1]!.n})(${y})\\\\(${M[1]![0]!.n})(${x})+(${M[1]![1]!.n})(${y})\\end{bmatrix}=${bm(v)}$`;
  };
  if (variant === 0) {
    let M: Mat;
    let x: number;
    let y: number;
    do {
      M = mat([
        [r(-3, 3), r(-3, 3)],
        [r(-3, 3), r(-3, 3)],
      ]);
      [x, y] = [r(-4, 4), r(-4, 4)];
    } while (
      meq(M, mT(M)) ||
      (x === 0 && y === 0) ||
      x === y ||
      (apply(M, x, y)[0]![0]!.n === x && apply(M, x, y)[1]![0]!.n === y) ||
      new Set(
        [
          apply(M, x, y),
          apply(mT(M), x, y),
          [[apply(M, x, y)[1]![0]!], [apply(M, x, y)[0]![0]!]],
          [[fmul(M[0]![0]!, fr(x))], [fmul(M[1]![1]!, fr(y))]],
          mscale(fr(-1), apply(M, x, y)),
        ].map(bm),
      ).size < 4
    );
    const v = apply(M, x, y);
    const mt = apply(mT(M), x, y);
    const diag = [[fmul(M[0]![0]!, fr(x))], [fmul(M[1]![1]!, fr(y))]];
    return finishV({
      prompt: `The matrix $M=${bm(M)}$ transforms each point $(x,y)$ to the point given by $M\\begin{bmatrix}x\\\\y\\end{bmatrix}$. Where does $M$ send $(${x}, ${y})$?`,
      hint: `Write the point as the column $\\begin{bmatrix}${x}\\\\${y}\\end{bmatrix}$. The new $x$ is row 1 of $M$ times the column and the new $y$ is row 2 times the column.`,
      explanation: [
        ptWork(M, x, y) + ".",
        `The image is $${pt(v[0]![0]!, v[1]![0]!)}$.`,
      ],
      correct: ptl(v),
      alts: [
        {
          label: ptl([[v[1]![0]!], [v[0]![0]!]]),
          feedback:
            "The first row gives the new $x$ and the second row the new $y$.",
        },
        {
          label: ptl(mt),
          feedback:
            "Use the rows of $M$ with the column, not the columns of $M$.",
        },
        {
          label: ptl(diag),
          feedback:
            "Each new coordinate combines both $x$ and $y$: a row times the column.",
        },
        {
          label: ptl(mscale(fr(-1), v)),
          feedback: "Recheck the signs of the products.",
        },
      ],
    });
  }
  if (variant === 1 || variant === 2) {
    const target = pick(r, transforms);
    const rest = shuffle(
      r,
      transforms.filter((t) => t !== target),
    ).slice(0, 3);
    if (variant === 1)
      return finishV({
        prompt: `Which matrix ${target.name.replace(/^./, (c) => c.toLowerCase())}, when it multiplies the column $\\begin{bmatrix}x\\\\y\\end{bmatrix}$?`,
        hint: `Follow the points $(1,0)$ and $(0,1)$ under the matrix that ${target.name.replace(/^./, (c) => c.toLowerCase())}. The first column of the matrix is where $(1,0)$ lands and the second column is where $(0,1)$ lands.`,
        explanation: [
          `Find where $(1,0)$ and $(0,1)$ go; these images are the columns of the matrix.`,
          `The matrix is $${bm(mat(target.m))}$.`,
        ],
        correct: lbl(mat(target.m)),
        alts: rest.map((t) => ({
          label: lbl(mat(t.m)),
          feedback: `That matrix ${t.name.replace(/^./, (c) => c.toLowerCase())}.`,
        })),
      });
    return finishV({
      prompt: `Multiplying the column $\\begin{bmatrix}x\\\\y\\end{bmatrix}$ by $M=${bm(mat(target.m))}$ transforms points. What does it do?`,
      hint: `The entries of $M$ are ${target.m.flat().join(", ")}. Test the points $(1,0)$ and $(0,1)$: the columns of $M$ are their images. Decide where each point lands.`,
      explanation: [
        `The first column of $M$ is the image of $(1,0)$ and the second column is the image of $(0,1)$.`,
        `$(1,0)\\to(${target.m[0]![0]}, ${target.m[1]![0]})$ and $(0,1)\\to(${target.m[0]![1]}, ${target.m[1]![1]})$. ${target.name}.`,
      ],
      correct: target.name,
      alts: rest.map((t) => ({
        label: t.name,
        feedback: `That transformation has matrix $${bm(mat(t.m))}$.`,
      })),
    });
  }
  if (variant === 3 || variant === 4) {
    let M: Mat;
    let area = 1;
    const collapse = variant === 4 && r(0, 3) === 0;
    do {
      M = mat([
        [r(-4, 4), r(-4, 4)],
        [r(-4, 4), r(-4, 4)],
      ]);
    } while (
      collapse
        ? det2(M).n !== 0 || M.flat().some((x) => x.n === 0)
        : Math.abs(det2(M).n) < 2
    );
    const D = det2(M).n;
    if (variant === 3) area = r(2, 9);
    const result = Math.abs(D) * area;
    const a = M[0]![0]!.n;
    const b = M[0]![1]!.n;
    const c = M[1]![0]!.n;
    const d = M[1]![1]!.n;
    const unitSq = variant === 4;
    return finishV({
      prompt: unitSq
        ? `The unit square (area 1) is transformed by $M=${bm(M)}$. What is the area of its image?`
        : `A triangle with area ${area} square units is transformed by $M=${bm(M)}$. What is the area of the image?`,
      hint: `The area changes by the factor $|\\det M|$, where $\\det M=ad-bc$ for the entries of $M=${bm(M)}$. Compute the determinant first.`,
      explanation: [
        `$\\det M=(${a})(${d})-(${b})(${c})=${D}$.`,
        `The area scale factor is $|\\det M|=${Math.abs(D)}$.`,
        collapse
          ? `A determinant of 0 flattens the square onto a line or point, so the image has area 0.`
          : `New area $=${Math.abs(D)}\\cdot${area}=${result}$ square units.`,
      ],
      correct: dollar(`${result}`),
      alts: [
        {
          label: dollar(`${D * area}`),
          feedback:
            "Area cannot be negative: use the absolute value of the determinant.",
        },
        {
          label: dollar(`${Math.abs(D) + area}`),
          feedback:
            "The determinant is a scale factor: multiply the area by it.",
        },
        {
          label: dollar(`${Math.abs(a * d) * area}`),
          feedback: "The determinant is $ad-bc$, not only $ad$.",
        },
        {
          label: dollar(`${Math.abs(D) * Math.abs(D) * area}`),
          feedback: "Areas are scaled by $|\\det|$ once, not squared.",
        },
        {
          label: dollar(`${area}`),
          feedback: "The area changes by the factor $|\\det M|$.",
        },
        {
          label: dollar(Math.abs(D) === 0 ? "1" : tex(fr(area, Math.abs(D)))),
          feedback: "Multiply the original area by $|\\det M|$; do not divide.",
        },
        {
          label: dollar(`${Math.abs(a) + Math.abs(d)}`),
          feedback:
            "The determinant multiplies along diagonals; it does not add entries.",
        },
        {
          label: dollar(`${Math.abs(b * c)}`),
          feedback: "The determinant is $ad-bc$, not only $bc$.",
        },
        {
          label: dollar(`${Math.abs(a * d) + Math.abs(b * c)}`),
          feedback: "Subtract the products before taking the absolute value.",
        },
      ],
    });
  }
  const target = pick(r, transforms);
  let [x, y] = [nz(r, 5), nz(r, 5)];
  while (x === y) [x, y] = [nz(r, 5), nz(r, 5)];
  const M = mat(target.m);
  const v = apply(M, x, y);
  const others = transforms.filter((t) => t !== target);
  return finishV({
    prompt: `The matrix $${bm(M)}$ ${target.name.replace(/^./, (c) => c.toLowerCase())}. Where does it send $(${x}, ${y})$?`,
    hint: `Write $(${x}, ${y})$ as the column $\\begin{bmatrix}${x}\\\\${y}\\end{bmatrix}$ and multiply by the matrix: each row gives one new coordinate.`,
    explanation: [
      ptWork(M, x, y) + ".",
      `The image is $${pt(v[0]![0]!, v[1]![0]!)}$.`,
    ],
    correct: ptl(v),
    alts: shuffle(r, others).map((t) => ({
      label: ptl(apply(mat(t.m), x, y)),
      feedback: `That is the image under a different transformation: it ${t.name.replace(/^./, (c) => c.toLowerCase()).replace(/^rotates points/, "rotates points")}.`,
    })),
  });
}

// ------------------------------------------------------------- matrix systems
/** A linear form in the given variable order, such as "3x - y". */
function form(coefs: [number, number], vars: [string, string]) {
  const pairs = [0, 1].map((k) => [coefs[k]!, vars[k]!] as const);
  return pairs
    .map(([c, v], k) => {
      const mag = Math.abs(c) === 1 ? "" : `${Math.abs(c)}`;
      return `${k === 0 ? (c < 0 ? "-" : "") : c < 0 ? " - " : " + "}${mag}${v}`;
    })
    .join("");
}
export const matrixSystemCase = (seed: string) =>
  retry((attempt) => matrixSystemOnce(seed, attempt));
function matrixSystemOnce(seed: string, attempt: number) {
  const meta = matrixSystemTemplate;
  const { r, variant } = start(meta, seed, 6, attempt);
  const finishV = (d: Parameters<typeof finish>[3]) => ({
    variant,
    problem: finish(meta, seed, r, d),
  });
  const lbl = (a: Mat) => dollar(bm(a));
  const nonsingular = (max: number, minDet = 1) => {
    let a: number[][];
    do
      a = [
        [nz(r, max), nz(r, max)],
        [nz(r, max), nz(r, max)],
      ];
    while (Math.abs(a[0]![0]! * a[1]![1]! - a[0]![1]! * a[1]![0]!) < minDet);
    return a;
  };
  const ask = (v: Mat) => dollar(`(x, y)=${pt(v[0]![0]!, v[1]![0]!)}`);
  const col2 = (a: number, b: number): Mat => [[fr(a)], [fr(b)]];
  if (variant === 0 || variant === 4) {
    const A = nonsingular(5);
    const [e1, e2] = [nz(r, 9), nz(r, 9)];
    const reorder = r(0, 1) === 1; // second equation lists y before x
    const moved = variant === 4; // constant written on the left side
    const side = (row: number[], e: number, flip: boolean) => {
      const lhs = flip
        ? form([row[1]!, row[0]!], ["y", "x"])
        : form([row[0]!, row[1]!], ["x", "y"]);
      return moved
        ? `${lhs} ${e < 0 ? "+" : "-"} ${Math.abs(e)} = 0`
        : `${lhs} = ${e}`;
    };
    const sys = `$${side(A[0]!, e1, false)}$ and $${side(A[1]!, e2, reorder)}$`;
    const Am = mat(A);
    const Bm = col2(e1, e2);
    const rewritten = [
      form([A[0]![0]!, A[0]![1]!], ["x", "y"]),
      form([A[1]![0]!, A[1]![1]!], ["x", "y"]),
    ];
    if (variant === 0)
      return finishV({
        prompt: `Write the system ${sys} as $AX=B$ with $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$. What is the coefficient matrix $A$?`,
        hint: `Each row of $A$ holds the coefficients of $x$ and then $y$ from one equation, in the order the equations are listed. In ${sys}, write each equation with $x$ first before reading its coefficients.`,
        explanation: [
          `Write each equation with $x$ first: $${rewritten[0]}$ and $${rewritten[1]}$ (the constants move to the right side).`,
          `The coefficient rows are $(${A[0]!.join(", ")})$ and $(${A[1]!.join(", ")})$, so $A=${bm(Am)}$.`,
        ],
        correct: lbl(Am),
        alts: [
          {
            label: lbl(mT(Am)),
            feedback:
              "Each row of $A$ comes from one equation, not each column.",
          },
          {
            label: lbl(mmap(Am, (_, i, j) => Am[i]![1 - j]!)),
            feedback:
              "The first column holds the $x$ coefficients and the second column holds the $y$ coefficients.",
          },
          {
            label: lbl([
              [Am[0]![0]!, fr(e1)],
              [Am[1]![0]!, fr(e2)],
            ]),
            feedback: "The constants belong in $B$, not in $A$.",
          },
          {
            label: lbl(
              mmap(Am, (x, i, j) => (i === 1 && j === 1 ? fneg(x) : x)),
            ),
            feedback:
              "Keep each coefficient with the sign written in the equation.",
          },
        ],
      });
    return finishV({
      prompt: `Write the system ${sys} as $AX=B$ with $X=\\begin{bmatrix}x\\\\y\\end{bmatrix}$. What is the constant matrix $B$?`,
      hint: `In ${sys}, move each constant term to the right side of its equation so that each equation reads (terms in $x$ and $y$) = (constant). Then list the right sides in the order the equations are given.`,
      explanation: [
        `Moving the constants gives $${rewritten[0]} = ${e1}$ and $${rewritten[1]} = ${e2}$.`,
        `The right sides are ${e1} and ${e2}, so $B=${bm(Bm)}$.`,
      ],
      correct: lbl(Bm),
      alts: [
        {
          label: lbl(col2(-e1, -e2)),
          feedback:
            "Moving a constant across the equals sign changes its sign.",
        },
        {
          label: lbl(col2(e2, e1)),
          feedback: "List the constants in the order of the equations.",
        },
        {
          label: lbl(col2(-e1, e2)),
          feedback:
            "Both constants change sign when they move to the right side.",
        },
        {
          label: lbl(col2(e1, -e2)),
          feedback:
            "Both constants change sign when they move to the right side.",
        },
      ],
    });
  }
  if (variant === 1) {
    const A = nonsingular(4);
    const B = [r(-9, 9), r(-9, 9)] as [number, number];
    const Am = mat(A);
    const D = det2(Am);
    const Bm = col2(...B);
    const Sol = mmul(inv2(Am), Bm);
    return finishV({
      prompt: `The system $${form(A[0] as [number, number], ["x", "y"])} = ${B[0]}$, $${form(A[1] as [number, number], ["x", "y"])} = ${B[1]}$ is $AX=B$ with $A=${bm(Am)}$ and $B=${bm(Bm)}$. Solve it using $X=A^{-1}B$.`,
      hint: `First find $\\det A=ad-bc$ for $A=${bm(Am)}$. Then form $A^{-1}=\\frac{1}{\\det A}\\begin{bmatrix}d&-b\\\\-c&a\\end{bmatrix}$ and multiply it by $B$ on the left.`,
      explanation: [
        `$\\det A=(${A[0]![0]})(${A[1]![1]})-(${A[0]![1]})(${A[1]![0]})=${D.n}$, so $A^{-1}$ exists.`,
        `$A^{-1}=${bm(inv2(Am))}$.`,
        `$X=A^{-1}B=${bm(Sol)}$, so $x=${tex(Sol[0]![0]!)}$ and $y=${tex(Sol[1]![0]!)}$.`,
      ],
      correct: ask(Sol),
      alts: [
        {
          label: ask([[Sol[1]![0]!], [Sol[0]![0]!]]),
          feedback: "The first entry of $X$ is $x$ and the second is $y$.",
        },
        {
          label: ask(mmul(adj2(Am), Bm)),
          feedback:
            "Divide the swapped matrix by the determinant to get $A^{-1}$.",
        },
        {
          label: ask(mmul(inv2(mT(Am)), Bm)),
          feedback:
            "Use $A^{-1}$ itself; the inverse of the transpose belongs to a different system.",
        },
        {
          label: ask(mscale(fr(-1), Sol)),
          feedback: "Recheck the signs in $A^{-1}$ and in the products.",
        },
      ],
    });
  }
  if (variant === 2 || variant === 5) {
    const sing = variant === 5;
    let [a, b, c, d] = [nz(r, 5), nz(r, 5), nz(r, 5), nz(r, 5)];
    if (sing) {
      const k = pick(r, [-3, -2, 2, 3]);
      [c, d] = [k * a, k * b];
    } else {
      const A = nonsingular(5);
      [a, b, c, d] = [A[0]![0]!, A[0]![1]!, A[1]![0]!, A[1]![1]!];
    }
    const [e1, e2] = [r(-9, 9), r(-9, 9)];
    const D = a * d - b * c;
    const yes = (dd: number) => `Yes: $\\det A=${dd}$, so $A^{-1}$ exists`;
    const no = (dd: number) =>
      `No: $\\det A=${dd}$, so $A^{-1}$ does not exist`;
    const A = mat([
      [a, b],
      [c, d],
    ]);
    return finishV({
      prompt: `The system $${form([a, b], ["x", "y"])} = ${e1}$, $${form([c, d], ["x", "y"])} = ${e2}$ is written $AX=B$ with $A=${bm(A)}$. Can it be solved as $X=A^{-1}B$?`,
      hint: `$A^{-1}$ exists only when $\\det A=ad-bc$ is not 0. Compute $ad-bc$ for $A=${bm(A)}$.`,
      explanation: [
        `$\\det A=(${a})(${d})-(${b})(${c})=${D}$.`,
        sing
          ? `The determinant is 0, so $A$ has no inverse. The rows of $A$ are proportional, so the system does not have one unique solution.`
          : `The determinant is not 0, so $A^{-1}$ exists and $X=A^{-1}B$ is the unique solution.`,
      ],
      correct: sing ? no(0) : yes(D),
      alts: sing
        ? [
            {
              label: yes(a * d + b * c),
              feedback:
                "A determinant is $ad-bc$; subtract the products. Subtracting gives 0.",
            },
            {
              label: yes(a * d),
              feedback: "Subtract $bc$ as well. The determinant is $ad-bc$.",
            },
            {
              label: yes(0),
              feedback: "A zero determinant means the inverse does NOT exist.",
            },
            {
              label: no(a * d + b * c),
              feedback:
                "Compute $ad-bc$; this value comes from adding the products.",
            },
          ]
        : [
            { label: no(0), feedback: `Compute $ad-bc$: it is ${D}, not 0.` },
            {
              label: yes(a * d + b * c),
              feedback:
                "The determinant is $ad-bc$; subtract the off-diagonal product.",
            },
            {
              label: yes(b * c - a * d),
              feedback: "Take the main diagonal first: $ad-bc$.",
            },
            { label: yes(a * d), feedback: "Subtract the product $bc$ too." },
          ],
    });
  }
  let Am: Mat;
  let Bm: Mat;
  const solutionAlts = (Am: Mat, Bm: Mat) => [
    mmul(inv2(Am), Bm),
    mmul(adj2(Am), Bm),
    mmul(inv2(Am), Bm).reverse(),
    mscale(fr(-1), mmul(inv2(Am), Bm)),
    mscale(fr(1, det2(Am).n), mmul(mT(adj2(Am)), Bm)),
  ];
  do {
    Am = mat(nonsingular(3, 2));
    Bm = col2(nz(r, 6), nz(r, 6));
  } while (new Set(solutionAlts(Am, Bm).map(bm)).size < 5);
  const D = det2(Am).n;
  const adj = adj2(Am);
  const Sol = mmul(inv2(Am), Bm);
  const unscaled = mmul(adj, Bm);
  const factor = tex(fr(1, D));
  return finishV({
    prompt: `For $AX=B$, the inverse is $A^{-1}=${factor}${bm(adj)}$ and $B=${bm(Bm)}$. Find $(x, y)$ from $X=A^{-1}B$.`,
    hint: `Multiply the matrix $${bm(adj)}$ by the column $B$ (each row of the matrix times the column), then multiply the result by the scalar $${factor}$.`,
    explanation: [
      `$${bm(adj)}${bm(Bm)}=${bm(unscaled)}$.`,
      `Multiply by $${factor}$: $X=${bm(Sol)}$, so $x=${tex(Sol[0]![0]!)}$ and $y=${tex(Sol[1]![0]!)}$.`,
    ],
    correct: ask(Sol),
    alts: [
      {
        label: ask(unscaled),
        feedback: `Multiply the product by the scalar $${factor}$ as well.`,
      },
      {
        label: ask([[Sol[1]![0]!], [Sol[0]![0]!]]),
        feedback: "The first entry of $X$ is $x$ and the second is $y$.",
      },
      {
        label: ask(mscale(fr(-1), Sol)),
        feedback: "Recheck the signs in the row-times-column sums.",
      },
      {
        label: ask(mscale(fr(1, D), mmul(mT(adj), Bm))),
        feedback:
          "Pair rows of the matrix with the column $B$, not its columns.",
      },
    ],
  });
}

export function generateVectorMatrixProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  switch (templateId) {
    case vectorComponentsTemplate.id:
      return vectorComponentsCase(seed).problem;
    case vectorResultantTemplate.id:
      return vectorResultantCase(seed).problem;
    case matrixDataTemplate.id:
      return matrixDataCase(seed).problem;
    case matrixOperationTemplate.id:
      return matrixOperationCase(seed).problem;
    case matrixLawsTemplate.id:
      return matrixLawsCase(seed).problem;
    case matrixInverseTemplate.id:
      return matrixInverseCase(seed).problem;
    case matrixTransformTemplate.id:
      return matrixTransformCase(seed).problem;
    case matrixSystemTemplate.id:
      return matrixSystemCase(seed).problem;
    default:
      throw new Error(`Unknown vector or matrix template: ${templateId}`);
  }
}
