import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  multiPartChoiceResponseSchema,
  serializeMultiPart,
  type MultiPartChoiceResponse,
} from "./multi-part-choice";
import {
  pointPlotScene,
  serializePlot,
  type LatticePoint,
  type PointPlotResponse,
} from "./point-plot";

/**
 * Clause items whose response kind is not the single-choice host:
 * three-part modulus by conjugate, and plotting a real or imaginary number.
 */
const parts = { requiredResponseCapability: "multi-part-choice-v1" as const };
const plot = { requiredResponseCapability: "point-plot-v1" as const };

export const complexClauseItemsTemplates: readonly TemplateMetadata[] = [
  {
    id: "complex-modulus-via-conjugate",
    version: 1,
    title: "Modulus from a conjugate",
    skillId: "complex-conjugates",
    gradeBand: "9–12",
    difficultyOffset: 0.55,
    ...parts,
    glossarySenses: {
      square: "square-number",
      squares: "square-number",
      product: "product-multiply",
      length: "modulus",
    },
    glossaryNoLink: ["part", "parts", "plain", "result"],
    description:
      "Choose the conjugate of a non-real complex number, the product of the number and that conjugate, and the modulus as the square root of that product.",
  },
  {
    id: "complex-axis-number-plot",
    version: 1,
    title: "Plot a real or imaginary number",
    skillId: "complex-plane",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    ...plot,
    glossaryNoLink: ["part", "parts", "plain", "plane"],
    description:
      "Plot a nonzero real number or a nonzero pure imaginary number on the complex plane. The only accepted point is (a, b) for a+bi.",
  },
];

const PYTH = [
  [3, 4],
  [6, 8],
  [5, 12],
  [8, 15],
  [7, 24],
] as const;
const LETTERS = ["a", "b", "c", "d", "e", "f"] as const;

function isSquare(n: number) {
  let s = 0;
  while (s * s < n) s += 1;
  return s * s === n;
}
function simplify(n: number) {
  let k = 1;
  let m = n;
  for (let f = 2; f * f <= m; f += 1)
    while (m % (f * f) === 0) {
      m /= f * f;
      k *= f;
    }
  return { k, m };
}
function radTex(n: number) {
  const { k, m } = simplify(n);
  if (m === 1) return String(k);
  if (k === 1) return `\\sqrt{${m}}`;
  return `${k}\\sqrt{${m}}`;
}
export function cxInt(a: number, b: number) {
  if (b === 0) return String(a);
  const ib = Math.abs(b) === 1 ? "i" : `${Math.abs(b)}i`;
  if (a === 0) return b < 0 ? `-${ib}` : ib;
  return `${a} ${b < 0 ? "-" : "+"} ${ib}`;
}
const math = (body: string) => `$${body}$`;

export type ModulusParts = {
  a: number;
  b: number;
  conjugate: string;
  product: string;
  modulus: string;
  productWrongs: readonly string[];
  modulusWrongs: readonly string[];
  conjugateWrongs: readonly string[];
};

/** Pure builder. a and b are nonzero integers. */
export function modulusParts(a: number, b: number): ModulusParts {
  if (a === 0 || b === 0 || !Number.isInteger(a) || !Number.isInteger(b))
    throw new Error("Modulus item needs two nonzero integers");
  const n = a * a + b * b;
  const root = radTex(n);
  const conjugate = math(cxInt(a, -b));
  const mirror = math(cxInt(-a, b));
  const half = math(cxInt(-a, -b));
  const product = math(String(n));
  const signedSquares = math(String(a * a - b * b));
  const unevaluated = math(`${a * a}-${b * b}i^2`);
  const modulus = math(root);
  const asLength = math(`${root}\\,i`);
  const legs = math(String(Math.abs(a) + Math.abs(b)));
  const conjugateWrongs = [mirror, half];
  const productWrongs = [signedSquares, unevaluated];
  const modulusWrongs = [math(String(n)), asLength, legs];
  for (const group of [conjugateWrongs, productWrongs, modulusWrongs]) {
    const labels =
      group === conjugateWrongs
        ? [conjugate, ...group]
        : group === productWrongs
          ? [product, ...group]
          : [modulus, ...group];
    if (new Set(labels).size !== labels.length)
      throw new Error(`Modulus choices collide for ${a}+${b}i`);
  }
  if (modulus === product || modulus === legs || modulus === asLength)
    throw new Error("Modulus equals a distractor");
  return {
    a,
    b,
    conjugate,
    product,
    modulus,
    conjugateWrongs,
    productWrongs,
    modulusWrongs,
  };
}

function blank(
  id: string,
  label: string,
  correct: string,
  wrong: readonly string[],
  r: Random,
) {
  const labels = shuffle(r, [correct, ...wrong]);
  if (new Set(labels).size !== labels.length)
    throw new Error(`Duplicate options for ${id}`);
  return {
    id,
    label,
    options: labels.map((text, i) => ({ id: LETTERS[i]!, label: text })),
    correct,
  };
}

export function buildModulusViaConjugate(
  a: number,
  b: number,
  seed = `modulus:${a}:${b}`,
): GeneratedProblem {
  const meta = complexClauseItemsTemplates[0]!;
  const item = modulusParts(a, b);
  const r = random(meta.id, seed);
  const built = [
    blank("conj", "Conjugate of z", item.conjugate, item.conjugateWrongs, r),
    blank(
      "prod",
      "Product of z and its conjugate",
      item.product,
      item.productWrongs,
      r,
    ),
    blank("mod", "Modulus of z", item.modulus, item.modulusWrongs, r),
  ];
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose one answer for each part",
    layout: "slots",
    blanks: built.map(({ id, label, options }) => ({ id, label, options })),
  };
  multiPartChoiceResponseSchema.parse(response);
  const key = Object.fromEntries(
    built.map((part) => [
      part.id,
      part.options.find((option) => option.label === part.correct)!.id,
    ]),
  );
  const n = a * a + b * b;
  const root = radTex(n);
  // From this z's own givens, never its conjugate, product or length.
  const hint = `For $z=${cxInt(a, b)}$, the conjugate keeps the real part, $${a}$, and flips only the sign of the imaginary part. When you multiply, the cross terms cancel, and the $i^2$ corner is the one to watch. The product is the square of the length, so the length is its square root.`;
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, 1, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: `Let $z=${cxInt(a, b)}$. (a) Write $\\bar z$. (b) Compute $z\\bar z$. (c) Use the result to find $|z|$.`,
      skillId: meta.skillId,
      response,
    },
    answer: serializeMultiPart(response, key),
    hint,
    explanation: [
      `The conjugate keeps the real part and flips the sign of the imaginary part: ${item.conjugate}.`,
      `Multiply $(${cxInt(a, b)})(${cxInt(a, -b)})$. The two middle terms are opposites, so they cancel.`,
      `The last terms bring $i^2$. Because $i^2=-1$, that corner adds $${b * b}$. So $z\\bar z=${n}$.`,
      `For any complex number $z$, $z\\bar z=|z|^2$, so $|z|=\\sqrt{z\\bar z}=\\sqrt{${n}}=${root}$.`,
      n === 169
        ? "Check: $\\sqrt{169}=13$. The 5-12-13 triangle sits under the arrow from 0 to $z$."
        : `Check: $\\sqrt{${n}}=${root}$.`,
    ],
  };
}

const SPAN = 10;
function axisPlotPoint(kind: 0 | 1 | 2 | 3, radius: number): LatticePoint {
  if (kind === 0) return [radius, 0];
  if (kind === 1) return [-radius, 0];
  if (kind === 2) return [0, radius];
  return [0, -radius];
}

export function buildAxisNumberPlot(
  a: number,
  b: number,
  seed = `plot:${a}:${b}`,
): GeneratedProblem {
  if ((a === 0) === (b === 0) || !Number.isInteger(a) || !Number.isInteger(b))
    throw new Error("Plot a nonzero real or pure imaginary number");
  if (Math.abs(a) > 9 || Math.abs(b) > 9)
    throw new Error("Plot radius is 1 through 9");
  const meta = complexClauseItemsTemplates[1]!;
  const point: LatticePoint = [a, b];
  const response: PointPlotResponse = {
    kind: "point-plot",
    label: "Plot the number on the complex plane",
    grid: {
      xMin: -SPAN,
      xMax: SPAN,
      yMin: -SPAN,
      yMax: SPAN,
      step: 1,
      xLabel: "real",
      yLabel: "imaginary",
    },
    pointCount: 1,
    ordered: false,
    connect: "none",
  };
  const place =
    b === 0
      ? a > 0
        ? "on the positive real axis, to the right of 0"
        : "on the negative real axis, to the left of 0"
      : b > 0
        ? "on the positive imaginary axis, above 0"
        : "on the negative imaginary axis, below 0";
  const explanation = [
    "On the complex plane, the real part is the across coordinate and the imaginary part is the up coordinate.",
    `$${cxInt(a, b)}$ has real part ${a} and imaginary part ${b}.`,
    `The point sits ${place}.`,
    `Plot the single point (${a}, ${b}). Swapping the coordinates lands on the other axis.`,
  ];
  if (explanation.some((line) => line.toLowerCase().includes("tan")))
    throw new Error("Axis plot explanation contains tan");
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, 1, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: `Plot $${cxInt(a, b)}$ on the complex plane. Across is the real part and up is the imaginary part.`,
      skillId: meta.skillId,
      response,
    },
    answer: serializePlot([point], false),
    explanation,
    hint: `The number is $${cxInt(a, b)}$. A real number sits on the across axis. A number that is only an imaginary part sits on the up axis. The sign chooses the direction.`,
    pointGrading: { mode: "exact" },
    walkthrough: pointPlotScene(response, {
      answer: [point],
      title: "The plotted number",
    }),
  };
}

function drawModulus(r: Random) {
  if (r(1, 5) <= 3) {
    const [p, q] = PYTH[r(0, PYTH.length - 1)]!;
    return {
      a: p * (r(0, 1) ? 1 : -1),
      b: q * (r(0, 1) ? 1 : -1),
    };
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const a = r(1, 9) * (r(0, 1) ? 1 : -1);
    const b = r(1, 9) * (r(0, 1) ? 1 : -1);
    const n = a * a + b * b;
    if (isSquare(n)) continue;
    if (n === Math.abs(a) + Math.abs(b)) continue;
    return { a, b };
  }
  throw new Error("No non-square pair");
}

export function generateComplexClauseItems(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  if (templateId === "complex-modulus-via-conjugate") {
    const { a, b } = drawModulus(r);
    return buildModulusViaConjugate(a, b, seed);
  }
  if (templateId === "complex-axis-number-plot") {
    const radius = r(1, 9);
    const point = axisPlotPoint(r(0, 3) as 0 | 1 | 2 | 3, radius);
    return buildAxisNumberPlot(point[0], point[1], seed);
  }
  throw new Error(`Unknown template ${templateId}`);
}
