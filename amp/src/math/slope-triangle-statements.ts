import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { random, shuffle } from "./distribution-practice";
import { serializeSelection } from "./selection-response";
import { graph } from "./scene/author";
import type { Point } from "./scene/spec";

export const slopeTriangleStatementsTemplate: TemplateMetadata = {
  id: "slope-triangle-statements",
  version: 1,
  title: "Compare two slope triangles",
  skillId: "slope",
  gradeBand: "6–8",
  requiredFigureCapability: "scenes-v1",
  requiredResponseCapability: "multi-select-v1",
  description:
    "Choose three true geometric statements about two separated right triangles whose hypotenuses lie on one line, including matching angles, similarity, congruence, slope and length ratios.",
};

type Triangle = {
  names: readonly [string, string, string];
  points: readonly [Point, Point, Point];
};
type Statement = { label: string; reason: string; trueFromGeometry: boolean };
const abs = (n: bigint) => (n < 0n ? -n : n);
function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return abs(a);
}
function fraction(n: bigint, d: bigint): string {
  if (d === 0n) throw new Error("Undefined ratio");
  if (d < 0n) [n, d] = [-n, -d];
  const divisor = gcd(abs(n), d);
  n /= divisor;
  d /= divisor;
  return d === 1n ? `${n}` : `${n < 0n ? "-" : ""}\\frac{${abs(n)}}{${d}}`;
}
const pointText = ([x, y]: Point) => `(${x}, ${y})`;
const leg = (a: string, b: string) => `$${a}${b}$`;
const mathValue = (value: string) =>
  value.includes("\\frac") ? `$${value}$` : value;
const triangleName = (t: Triangle) => `$${t.names.join("")}$`;
const coord = (name: string, point: Point) => `$${name}${pointText(point)}$`;
function angleEqual(
  first: Triangle,
  atFirst: number,
  second: Triangle,
  atSecond: number,
): boolean {
  const signature = ({ points }: Triangle, at: number) => {
    const vertex = points[at]!;
    const other = [0, 1, 2]
      .filter((index) => index !== at)
      .map((index) => points[index]!);
    const ax = BigInt(other[0]![0] - vertex[0]);
    const ay = BigInt(other[0]![1] - vertex[1]);
    const bx = BigInt(other[1]![0] - vertex[0]);
    const by = BigInt(other[1]![1] - vertex[1]);
    return { cross: abs(ax * by - ay * bx), dot: ax * bx + ay * by };
  };
  const a = signature(first, atFirst),
    b = signature(second, atSecond);
  if (a.dot === 0n || b.dot === 0n) return a.dot === 0n && b.dot === 0n;
  if (a.dot < 0n !== b.dot < 0n) return false;
  return a.cross * b.dot === b.cross * a.dot;
}

/** The public coordinates and statements are the complete givens; no keys enter the figure. */
export function slopeTriangleStatementsCase(seed: string): {
  problem: GeneratedProblem;
  tags: string[];
  caseKey: string;
} {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = slopeTriangleStatementsTemplate;
  const r = random(meta.id, seed);
  const runUnit = r(2, 4);
  let riseUnit = r(1, 4);
  while (riseUnit === runUnit) riseUnit = r(1, 4);
  riseUnit *= r(0, 1) ? 1 : -1;
  const scale = [1, 2, 3][r(0, 2)]!;
  const gapUnits = r(1, 2);
  const origin: Point = [r(-10, -3), r(-8, 8)];
  const startSecond: Point = [
    origin[0] + runUnit * (1 + gapUnits),
    origin[1] + riseUnit * (1 + gapUnits),
  ];
  const names = [
    [
      ["A", "B", "C"],
      ["D", "E", "F"],
    ],
    [
      ["D", "E", "F"],
      ["A", "B", "C"],
    ],
    [
      ["P", "Q", "R"],
      ["S", "T", "U"],
    ],
    [
      ["S", "T", "U"],
      ["P", "Q", "R"],
    ],
  ] as const;
  const [firstNames, secondNames] = names[r(0, names.length - 1)]!;
  const first: Triangle = {
    names: firstNames,
    points: [
      origin,
      [origin[0] + runUnit, origin[1]],
      [origin[0] + runUnit, origin[1] + riseUnit],
    ],
  };
  const second: Triangle = {
    names: secondNames,
    points: [
      startSecond,
      [startSecond[0] + runUnit * scale, startSecond[1]],
      [startSecond[0] + runUnit * scale, startSecond[1] + riseUnit * scale],
    ],
  };
  const [a, b, c] = first.names;
  const [d, e, f] = second.names;
  const firstRun = BigInt(first.points[1][0] - first.points[0][0]);
  const firstRise = BigInt(first.points[2][1] - first.points[1][1]);
  const secondRun = BigInt(second.points[1][0] - second.points[0][0]);
  const secondRise = BigInt(second.points[2][1] - second.points[1][1]);
  const scaleBig = BigInt(scale);
  const similar = firstRun * abs(secondRise) === secondRun * abs(firstRise);
  const congruent =
    firstRun === secondRun && abs(firstRise) === abs(secondRise);
  const slope = fraction(firstRise, firstRun);
  const legRatio = fraction(abs(firstRise), firstRun);
  const hyp1Square = firstRun * firstRun + firstRise * firstRise;
  const hyp2Square = secondRun * secondRun + secondRise * secondRise;
  const geometryReason =
    `Legs: $${a}${b}=${firstRun}$, $${b}${c}=${abs(firstRise)}$; ` +
    `$${d}${e}=${secondRun}$, $${e}${f}=${abs(secondRise)}$. ` +
    `Both corresponding ratios equal ${scale}, so the triangles are similar${congruent ? " and congruent" : " but not congruent"}.`;
  const relationForms = [
    {
      label: `Triangles ${triangleName(first)} and ${triangleName(second)} are similar.`,
      truth: similar,
    },
    {
      label: `Triangles ${triangleName(first)} and ${triangleName(second)} are congruent.`,
      truth: congruent,
    },
    {
      label: `Triangles ${triangleName(first)} and ${triangleName(second)} are similar but not congruent.`,
      truth: similar && !congruent,
    },
    {
      label: `Triangles ${triangleName(first)} and ${triangleName(second)} are not similar.`,
      truth: !similar,
    },
  ];
  const anglePairs = [
    [0, 0],
    [1, 1],
    [2, 2],
    [0, 2],
    [2, 0],
    [0, 1],
    [1, 0],
  ] as const;
  const angleReason =
    `Right angles are at $${b}$ and $${e}$. The acute pairs $${a}$/$${d}$ and $${c}$/$${f}$ match because their rise-to-run ratios match. ` +
    `The crossed acute pairs differ since $${firstRun}\\ne${abs(firstRise)}$.`;
  const angleForms = anglePairs.map(([left, right]) => ({
    label: `Angles at $${first.names[left]}$ and $${second.names[right]}$ have equal measures.`,
    truth: angleEqual(first, left, second, right),
  }));
  const slopeReason =
    `${leg(a, c)}: signed rise/run $${firstRise}/${firstRun}=${slope}$; ` +
    `${leg(d, f)}: $${secondRise}/${secondRun}=${slope}$. The slopes match.`;
  const slopeForms = [firstRise, -firstRise, firstRun].map(
    (numerator, index) => {
      const denominator = index === 2 ? firstRise : firstRun;
      const value = fraction(numerator, denominator);
      return {
        label: `The slope of line $\\ell$ is ${mathValue(value)}.`,
        truth: numerator * firstRun === firstRise * denominator,
      };
    },
  );
  const segmentSlopesEqual = firstRise * secondRun === secondRise * firstRun;
  slopeForms.push(
    {
      label: `The slopes of ${leg(a, c)} and ${leg(d, f)} are equal.`,
      truth: segmentSlopesEqual,
    },
    {
      label: `The slopes of ${leg(a, c)} and ${leg(d, f)} are unequal.`,
      truth: !segmentSlopesEqual,
    },
  );
  const factorCandidates = [
    ...new Set([scale, scale === 1 ? 2 : scale - 1, scale + 1]),
  ];
  const horizontalReason =
    `Horizontal legs: $${a}${b}=${firstRun}$ and $${d}${e}=${secondRun}$ units; ` +
    `$${d}${e}/${a}${b}=${scale}$.`;
  const horizontalForms = factorCandidates.map((factor) => ({
    label: `The length of ${leg(d, e)} is ${factor} times the length of ${leg(a, b)}.`,
    truth: secondRun === BigInt(factor) * firstRun,
  }));
  const hypotenuseReason =
    `By the Pythagorean theorem, $${a}${c}^2=${hyp1Square}$ and $${d}${f}^2=${hyp2Square}$ square units. ` +
    `Both legs scale by ${scale}, so $${d}${f}=${scale}\\cdot ${a}${c}$.`;
  const hypotenuseForms = factorCandidates.map((factor) => ({
    label: `The length of ${leg(d, f)} is ${factor} times the length of ${leg(a, c)}.`,
    truth: hyp2Square === BigInt(factor) ** 2n * hyp1Square,
  }));
  const ratioReason =
    `Leg lengths: $${b}${c}=${abs(firstRise)}$ and $${a}${b}=${firstRun}$ units; ` +
    `$${b}${c}/${a}${b}=${legRatio}$. Length stays positive even for a negative rise.`;
  const ratioCandidates = [
    { n: abs(firstRise), d: firstRun },
    { n: firstRun, d: abs(firstRise) },
  ];
  const ratioForms = ratioCandidates.map(({ n, d: denominator }) => ({
    label: `The ratio is $${b}${c}/${a}${b}=${fraction(n, denominator)}$.`,
    truth: abs(firstRise) * denominator === n * firstRun,
  }));
  const categories = [
    { forms: relationForms, reason: geometryReason },
    { forms: angleForms, reason: angleReason },
    { forms: slopeForms, reason: slopeReason },
    { forms: horizontalForms, reason: horizontalReason },
    { forms: hypotenuseForms, reason: hypotenuseReason },
    { forms: ratioForms, reason: ratioReason },
  ];
  const trueCategories = new Set(shuffle(r, [0, 1, 2, 3, 4, 5]).slice(0, 3));
  const statements: Statement[] = shuffle(
    r,
    categories.map(({ forms, reason }, index) => {
      const want = trueCategories.has(index);
      const choices = forms.filter(({ truth }) => truth === want);
      if (!choices.length) throw new Error("Missing geometry claim variant");
      const selected = choices[r(0, choices.length - 1)]!;
      return {
        label: selected.label,
        reason,
        trueFromGeometry: selected.truth,
      };
    }),
  );
  const options = statements.map(({ label }, index) => ({
    id: `option-${"abcdef"[index]}`,
    label,
  }));
  const allPoints = [...first.points, ...second.points];
  const xValues = allPoints.map(([x]) => x),
    yValues = allPoints.map(([, y]) => y);
  const xWindow: [number, number] = [
    Math.min(...xValues) - 2,
    Math.max(...xValues) + 2,
  ];
  const yWindow: [number, number] = [
    Math.min(...yValues) - 2,
    Math.max(...yValues) + 2,
  ];
  let picture = graph({
    x: xWindow,
    y: yWindow,
    grid: 1,
    tick: 5,
    aspect: 1,
    axisNames: ["x", "y"],
  })
    .id("triangles")
    .line({ through: [first.points[0], first.points[2]] }, { label: "ℓ" });
  for (const triangle of [first, second])
    for (let index = 0; index < 3; index++)
      picture = picture.point(...triangle.points[index], triangle.names[index]);
  const figure = picture
    .slope(first.points[0], first.points[2], "none")
    .slope(second.points[0], second.points[2], "none")
    .scene({
      title: `Two separated slope triangles on line ℓ`,
      note: "Horizontal and vertical dashed legs form each right triangle; one unit has the same length on both axes.",
      width: 620,
      maxHeight: 440,
    });
  const prompt =
    `On a coordinate grid with equal-length units on both axes, two separate right triangles have hypotenuses on line $\\ell$. ` +
    `Triangle ${triangleName(first)} has ${first.names.map((name, index) => coord(name, first.points[index])).join(", ")}; ` +
    `triangle ${triangleName(second)} has ${second.names.map((name, index) => coord(name, second.points[index])).join(", ")}. ` +
    `The right angles are at $${b}$ and $${e}$. The hypotenuses ${leg(a, c)} and ${leg(d, f)} lie on $\\ell$. ` +
    "Choose exactly 3 true statements.";
  const hint =
    `Start with ${coord(a, first.points[0])} and ${coord(c, first.points[2])}. ` +
    `Subtract their $x$-coordinates to get the horizontal run and their $y$-coordinates to get the signed rise. ` +
    `Compare those changes with the second triangle before checking its lengths and angles.`;
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: meta.version,
      seed,
      skillId: meta.skillId,
      prompt,
      response: {
        kind: "multi-select",
        label: "Choose 3 true statements",
        selectionCount: 3,
        options,
      },
      figure: { kind: "scene", scene: figure },
    },
    answer: serializeSelection(
      options
        .filter((_, index) => statements[index]!.trueFromGeometry)
        .map(({ id }) => id),
    ),
    hint,
    explanation: statements.map(
      (statement) =>
        `“${statement.label}” ${statement.trueFromGeometry ? "True" : "False"}: ${statement.reason}`,
    ),
  };
  return {
    problem,
    tags: [
      firstRise > 0n ? "positive-slope" : "negative-slope",
      scale === 1 ? "translated-congruent" : `similar-scale-${scale}`,
      first.names[0]!,
      [...trueCategories].sort().join(""),
    ],
    caseKey: JSON.stringify([
      first.points,
      second.points,
      first.names,
      second.names,
    ]),
  };
}

export const generateSlopeTriangleStatementsProblem = (seed: string) =>
  slopeTriangleStatementsCase(seed).problem;
