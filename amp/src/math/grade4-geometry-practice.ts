import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { geometryScene } from "./geometry-scenes.js";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
} from "./multi-part-choice.js";
import { quad } from "./polygon-practice.js";
import { angle, protractor, scene } from "./scene/author.js";
import type { Element } from "./scene/spec.js";
import { selectFamily, selectModel, selectTemplate, st } from "./select-kit.js";
import { posed, pick, random, shuffle, type Rand } from "./shape-practice.js";
import type { Pt } from "./shape-figures.js";
import type { Random } from "./variation/axes.js";

/**
 * Grade-4 geometry practice (GE-1, GE-2, GE-3, GE-6, GE-7, GE-8, and
 * quadrilaterals named from parallel sides, right angles and equal sides).
 * Triangle-by-angle alone already exists as `classify-triangle-angles`.
 */

const choice = { requiredResponseCapability: "single-choice-v1" as const };
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const parts = { requiredResponseCapability: "multi-part-choice-v1" as const };
const band = "3–5" as const;

export const grade4GeometryTemplates: readonly TemplateMetadata[] = [
  {
    id: "protractor-ray-choice",
    version: 1,
    title: "Choose the ray at a given angle",
    skillId: "angle-measure",
    gradeBand: band,
    description:
      "On a protractor, choose which drawn ray makes a given whole-degree angle with the baseline ray. One choice sits where the other scale reads that number. Choosing a ray stands in for sketching the angle.",
    ...choice,
    ...scenes,
  },
  {
    id: "adjacent-angle-equation",
    version: 1,
    title: "Equation for an unknown angle",
    skillId: "angle-measure",
    gradeBand: band,
    description:
      "Two adjacent angles make a whole angle. Choose the equation that uses a symbol for the unknown angle measure.",
    ...choice,
    ...scenes,
  },
  {
    id: "angle-benchmark-estimate",
    version: 1,
    title: "Estimate an angle by a benchmark",
    skillId: "angle-measure",
    gradeBand: band,
    description:
      "Estimate a drawn angle by the nearest benchmark: 30°, 45°, 60°, 90° or 180°. The true measure stays within 10° of that benchmark and is not a tie.",
    ...choice,
    ...scenes,
  },
  {
    id: "triangle-sides-angles-blanks",
    version: 1,
    title: "Classify a triangle by sides and angles",
    skillId: "lines-symmetry",
    gradeBand: band,
    description:
      "Name one triangle twice: scalene, isosceles or equilateral from its side lengths, and acute, right or obtuse from its angles. A right isosceles triangle is included.",
    ...parts,
    ...scenes,
  },
  {
    id: "quadrilateral-attributes",
    version: 1,
    title: "Name a quadrilateral from its marks",
    skillId: "lines-symmetry",
    gradeBand: band,
    description:
      "Give the most exact name of a trapezoid, parallelogram, rectangle, rhombus or square from its parallel sides, right angles and equal sides.",
    ...choice,
    ...scenes,
  },
  {
    id: "composite-rectangle-measure",
    version: 1,
    title: "Area or perimeter of joined rectangles",
    skillId: "area-perimeter-models",
    gradeBand: band,
    description:
      "Find the area or the perimeter of a figure made of two rectangles. Every outer side is labeled, and the perimeter is asked on most items.",
  },
  selectTemplate({
    figure: "measurement-models-v1",
    id: "rectangle-formula-select",
    title: "Choose the rectangle formulas",
    skillId: "area-perimeter-models",
    gradeBand: band,
    description:
      "Select every expression that equals the perimeter of a labeled rectangle, including the sum of all four sides, twice the length plus twice the width, and twice the sum of the length and the width, or every expression that equals its area.",
  }),
];

const metaOf = (id: string) =>
  grade4GeometryTemplates.find((t) => t.id === id)!;
const letters = [
  ["A", "B", "C", "D"],
  ["P", "Q", "R", "S"],
  ["J", "K", "L", "M"],
  ["W", "X", "Y", "Z"],
] as const;
const TURNS = [0, 10, 20, 30, 45, 60, 90, 120, 150, 200, 250, 300];
const BENCHMARKS = [30, 45, 60, 90, 180] as const;

/** Interior angles, in degrees. A clockwise copy still reports the shape's
 * own interior, because the turn is corrected by the polygon's orientation. */
function interiors(pts: readonly Pt[]): number[] {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const q = pts[(i + 1) % n]!;
    area += pts[i]![0] * q[1] - q[0]! * pts[i]![1];
  }
  const orient = area >= 0 ? 1 : -1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n]!;
    const b = pts[i]!;
    const c = pts[(i + 1) % n]!;
    const ix = b[0] - a[0],
      iy = b[1] - a[1];
    const ox = c[0] - b[0],
      oy = c[1] - b[1];
    const turn = Math.atan2(orient * (ix * oy - iy * ox), ix * ox + iy * oy);
    out.push(180 - (turn * 180) / Math.PI);
  }
  return out;
}
function sideLengths(pts: readonly Pt[]): number[] {
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
}
/** Pairs of sides parallel within a thousandth of a sine. */
function parallelPairs(pts: readonly Pt[]): number {
  const dirs = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    const n = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [(q[0] - p[0]) / n, (q[1] - p[1]) / n] as const;
  });
  let pairs = 0;
  for (let i = 0; i < dirs.length; i++)
    for (let j = i + 1; j < dirs.length; j++) {
      const [ax, ay] = dirs[i]!;
      const [bx, by] = dirs[j]!;
      if (Math.abs(ax * by - ay * bx) < 1e-3) pairs++;
    }
  return pairs;
}

type Choice = { label: string; correct?: true; feedback?: string };
function finish(
  id: string,
  seed: string,
  r: Rand,
  built: {
    prompt: string;
    answer: string;
    hint: string;
    explanation: string[];
    figure: SemanticFigure;
    label?: string;
    choices?: Choice[];
    keepOrder?: boolean;
    response?: GeneratedProblem["public"]["response"];
  },
): GeneratedProblem {
  const meta = metaOf(id);
  let answer = built.answer;
  let choiceFeedback: Record<string, string> | undefined;
  let response = built.response;
  if (built.choices) {
    const choices = built.choices;
    if (
      choices.filter((c) => c.correct).length !== 1 ||
      new Set(choices.map((c) => c.label)).size !== choices.length
    )
      throw new Error(`${id}: ambiguous choices`);
    if (!built.keepOrder) shuffle(r, choices);
    choiceFeedback = {};
    response = {
      kind: "choice",
      label: built.label ?? "Choose one answer",
      options: choices.map((c, i) => {
        const optionId = `option-${"abcd"[i]}`;
        if (c.correct) answer = optionId;
        else choiceFeedback![optionId] = c.feedback!;
        return { id: optionId, label: c.label };
      }),
    };
  }
  if (!response) response = { kind: "number", label: built.label ?? "Answer" };
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response,
      figure: built.figure,
    },
    answer,
    hint: built.hint,
    explanation: built.explanation,
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
}

/** Whole degrees 5, 10, …, 175 except 90, where the wrong scale lands on the
 * same ray as the right scale. Multiples of 5 keep the rays on protractor marks. */
const PROTRACTOR_DEGREES = Array.from(
  { length: 35 },
  (_, i) => (i + 1) * 5,
).filter((k) => k !== 90);

function protractorRay(r: Rand, seed: string): GeneratedProblem {
  const k = pick(r, PROTRACTOR_DEGREES);
  const right = r(0, 1) === 1;
  const base = right ? 0 : 180;
  const correctDir = right ? k : 180 - k;
  const wrongDir = 180 - correctDir;
  const used = new Set([correctDir, wrongDir]);
  const pool: number[] = [];
  for (let d = 15; d <= 165; d += 5) {
    if (used.has(d)) continue;
    if (Math.min(Math.abs(d - correctDir), Math.abs(d - wrongDir)) < 12)
      continue;
    pool.push(d);
  }
  shuffle(r, pool);
  const extra: number[] = [];
  for (const d of pool) {
    if (extra.every((e) => Math.abs(e - d) >= 12)) extra.push(d);
    if (extra.length === 2) break;
  }
  if (extra.length < 2) throw new Error("protractor-ray-choice: distractors");
  const dirs = shuffle(r, [correctDir, wrongDir, extra[0]!, extra[1]!]);
  const names = ["C", "D", "E", "F"] as const;
  const rays = names.map((letter, i) => ({ letter, dir: dirs[i]! }));
  const onScale = rays[r(0, rays.length - 1)]!;
  const extras = rays.filter((ray) => ray !== onScale);
  const elements: Element[] = [
    protractor([base, onScale.dir], ["A", "B", onScale.letter])
      .id("p")
      .element(),
    ...extras.flatMap((ray): Element[] => {
      const t = (ray.dir * Math.PI) / 180;
      return [
        {
          type: "segment",
          id: `ray${ray.letter}`,
          from: [0, 0],
          to: [1.15 * Math.cos(t), 1.15 * Math.sin(t)],
          stroke: "ink",
          width: 2,
          arrow: "end",
        },
        {
          type: "text",
          id: `name${ray.letter}`,
          at: [1.25 * Math.cos(t), 1.25 * Math.sin(t)],
          text: ray.letter,
          font: "sans",
          size: "md",
          bold: true,
          halo: true,
          align: [0, 0] as const,
        },
      ];
    }),
  ];
  const scale = right ? "inner" : "outer";
  const correct = rays.find((ray) => ray.dir === correctDir)!;
  return finish("protractor-ray-choice", seed, r, {
    prompt: `Ray $BA$ lies on the baseline. Which other ray makes a $${k}^\\circ$ angle with ray $BA$?`,
    answer: "",
    hint: `Ray $BA$ is on the ${right ? "right" : "left"}, where the ${scale} scale reads 0. Follow that scale to $${k}^\\circ$.`,
    explanation: [
      `The ${scale} scale is the row that reads 0 on ray $BA$.`,
      `The other row reads ${180 - k} on the ray that is really at $${k}^\\circ$, so that row is the wrong scale here.`,
      `Follow the ${scale} scale from 0 to $${k}^\\circ$. That ray is ray $B${correct.letter}$.`,
    ],
    figure: {
      kind: "scene",
      scene: scene(...elements).build({ width: 340, maxHeight: 280 }),
    },
    choices: rays.map((ray) =>
      ray.dir === correctDir
        ? { label: `$${ray.letter}$`, correct: true }
        : {
            label: `$${ray.letter}$`,
            feedback:
              ray.dir === wrongDir
                ? `Ray $B${ray.letter}$ is where the other scale reads ${k}. Use the scale that starts at 0 on ray $BA$.`
                : `The angle between ray $BA$ and ray $B${ray.letter}$ is not ${k}°.`,
          },
    ),
  });
}

function adjacentEquation(r: Rand, seed: string): GeneratedProblem {
  let known: number, missing: number;
  do {
    known = 5 * r(3, 20);
    missing = 5 * r(3, 20);
  } while (known + missing > 180 || known === missing);
  const whole = known + missing;
  const unknownFirst = r(0, 1) === 1;
  const [A, B, C, D] = pick(r, letters);
  const d0 = 5 * r(0, 71);
  const first = unknownFirst ? missing : known;
  const figure: SemanticFigure = {
    kind: "scene",
    scene: scene(
      angle({
        rays: [d0, d0 + first, d0 + whole],
        labels: { vertex: B, ends: [A, C, D] },
        marks: [
          { from: 0, to: 1, measure: true, derived: unknownFirst },
          { from: 1, to: 2, measure: true, derived: !unknownFirst },
        ],
      }).element(),
    ).build({ width: 340, maxHeight: 280 }),
  };
  const knownName = unknownFirst ? `$${C}${B}${D}$` : `$${A}${B}${C}$`;
  const missingName = unknownFirst ? `$${A}${B}${C}$` : `$${C}${B}${D}$`;
  const difference = r(0, 1) === 1;
  const key = difference
    ? `$${whole} - ${known} = x$`
    : `$x + ${known} = ${whole}$`;
  return finish("adjacent-angle-equation", seed, r, {
    prompt: `Angle $${A}${B}${D}$ measures ${whole}°. Angle ${knownName} measures ${known}°. The measure of angle ${missingName} is $x$ degrees. Which equation is true?`,
    answer: "",
    hint: `The two angles fill the ${whole}° angle and do not overlap. The known part is ${known}°. Write an equation for $x$ that uses both of those numbers.`,
    explanation: [
      `Angles ${knownName} and ${missingName} sit side by side and do not overlap, so together they make the ${whole}° angle.`,
      difference
        ? `The whole minus the known part is the unknown: $${whole} - ${known} = x$.`
        : `The unknown plus the known part is the whole: $x + ${known} = ${whole}$.`,
      `$${whole} + ${known} = x$ adds the whole and the part, so $x$ would be larger than the whole angle.`,
      `${missingName.replaceAll("$", "")} measures ${missing}°, and the true equation is ${key}.`,
    ],
    figure,
    choices: [
      { label: key, correct: true },
      {
        label: `$${whole} + ${known} = x$`,
        feedback: `That adds the whole angle and the known part. The parts add to the whole, so $x$ is smaller than ${whole}.`,
      },
      {
        label: `$${known} - ${whole} = x$`,
        feedback: `Subtracting a larger number from a smaller one gives a negative measure. An angle measure here is positive.`,
      },
      {
        label: `$x = ${whole}$`,
        feedback: `$x$ is one part of the ${whole}° angle, not the whole angle.`,
      },
    ],
  });
}

/** Degrees whose nearest benchmark is unique and at most 10° away, and at
 * least 3° away so the item stays an estimate. */
const BENCHMARK_ZONES: Record<(typeof BENCHMARKS)[number], readonly number[]> =
  {
    30: [20, 21, 22, 23, 24, 25, 26, 27, 33, 34],
    45: [41, 42, 48, 49],
    60: [56, 57, 63, 64, 65, 66, 67, 68, 69, 70],
    90: [80, 81, 82, 83, 84, 85, 86, 87, 93, 94, 95, 96, 97, 98, 99, 100],
    180: [170, 171, 172, 173, 174, 175, 176, 177],
  };

function benchmarkEstimate(r: Rand, seed: string): GeneratedProblem {
  const keyed = pick(r, BENCHMARKS);
  const measure = pick(r, BENCHMARK_ZONES[keyed]);
  const d0 = 5 * r(0, 71);
  const others = BENCHMARKS.filter((b) => b !== keyed);
  const omitted = others[r(0, others.length - 1)]!;
  const shown = BENCHMARKS.filter((b) => b !== omitted);
  const words = shown.map((b) => `${b} degrees`).join(", ");
  return finish("angle-benchmark-estimate", seed, r, {
    prompt: "Which benchmark is this angle nearest?",
    answer: "",
    hint: `The choices are ${words}. Pick the benchmark this opening is nearest, within 10 degrees.`,
    explanation: [
      `The benchmarks are 30°, 45°, 60°, 90° and 180°.`,
      `This opening is nearest $${keyed}^\\circ$, and it is within 10° of that benchmark.`,
      `It is more than 10° from each of the other benchmarks, so the nearest one is clear.`,
      `The nearest benchmark is $${keyed}^\\circ$.`,
    ],
    figure: {
      kind: "scene",
      scene: scene(
        angle({
          rays: [d0, d0 + measure],
          arrows: true,
          marks: [{ from: 0, to: 1, color: "warm" }],
        }).element(),
      ).build({ width: 340, maxHeight: 280 }),
    },
    keepOrder: true,
    choices: shown.map((b) =>
      b === keyed
        ? { label: `$${b}^\\circ$`, correct: true }
        : {
            label: `$${b}^\\circ$`,
            feedback: `This opening is more than 10° away from ${b}°. Compare it with the benchmark it nearly matches.`,
          },
    ),
  });
}

type SideClass = "scalene" | "isosceles" | "equilateral";
type AngleClass = "acute" | "right" | "obtuse";
const TRIANGLES: { points: Pt[]; sides: SideClass; angles: AngleClass }[] = [
  {
    points: [
      [0, 0],
      [4, 0],
      [2, 2 * Math.sqrt(3)],
    ],
    sides: "equilateral",
    angles: "acute",
  },
  {
    points: [
      [0, 0],
      [4, 0],
      [0, 4],
    ],
    sides: "isosceles",
    angles: "right",
  },
  {
    points: [
      [0, 0],
      [6, 0],
      [3, 4],
    ],
    sides: "isosceles",
    angles: "acute",
  },
  {
    points: [
      [0, 0],
      [4, 0],
      [-2, 2 * Math.sqrt(3)],
    ],
    sides: "isosceles",
    angles: "obtuse",
  },
  {
    points: [
      [0, 0],
      [6, 0],
      [0, 3],
    ],
    sides: "scalene",
    angles: "right",
  },
  {
    points: [
      [0, 0],
      [6, 0],
      [2, 4],
    ],
    sides: "scalene",
    angles: "acute",
  },
  {
    points: [
      [0, 0],
      [5, 0],
      [-1, 2],
    ],
    sides: "scalene",
    angles: "obtuse",
  },
];

function classesOf(pts: readonly Pt[]): {
  sides: SideClass;
  angles: AngleClass;
} {
  const lengths = sideLengths(pts);
  const close = (a: number, b: number) =>
    Math.abs(a - b) / Math.max(a, b) < 0.02;
  const equalPairs = [
    close(lengths[0]!, lengths[1]!),
    close(lengths[1]!, lengths[2]!),
    close(lengths[0]!, lengths[2]!),
  ].filter(Boolean).length;
  const sides: SideClass =
    equalPairs === 3
      ? "equilateral"
      : equalPairs === 1
        ? "isosceles"
        : "scalene";
  if (equalPairs === 2) throw new Error("triangle: side classes overlap");
  const angles = interiors(pts);
  const largest = Math.max(...angles);
  const right = angles.some((a) => Math.abs(a - 90) <= 0.5);
  if (!right && angles.some((a) => Math.abs(a - 90) < 15))
    throw new Error("triangle: angle too close to a right angle to name");
  const kind: AngleClass = right
    ? "right"
    : largest > 90.5
      ? "obtuse"
      : "acute";
  return { sides, angles: kind };
}

function triangleBlanks(r: Rand, seed: string): GeneratedProblem {
  const built = pick(r, TRIANGLES);
  const shape = posed(built.points, pick(r, TURNS));
  if (shape.type !== "polygon") throw new Error("triangle: expected a polygon");
  const points = shape.points;
  const found = classesOf(points);
  if (found.sides !== built.sides || found.angles !== built.angles)
    throw new Error("triangle-sides-angles-blanks: classification drifted");
  const sideOptions = [
    { id: "a", label: "scalene" },
    { id: "b", label: "isosceles" },
    { id: "c", label: "equilateral" },
  ];
  const angleOptions = [
    { id: "a", label: "acute" },
    { id: "b", label: "right" },
    { id: "c", label: "obtuse" },
  ];
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose an option for each blank",
    layout: "inline",
    blanks: [
      { id: "sides", label: "Sides", options: sideOptions },
      { id: "angles", label: "Angles", options: angleOptions },
    ],
    sentence: [
      { text: "By its sides this triangle is " },
      { blank: "sides" },
      { text: ", and by its angles it is " },
      { blank: "angles" },
      { text: "." },
    ],
  };
  const lengths = sideLengths(points)
    .map((n) => (Math.round(n * 10) / 10).toFixed(1))
    .join(", ");
  const sideWhy = {
    equilateral: "all 3 sides are equal",
    isosceles: "exactly 2 sides are equal",
    scalene: "no 2 sides are equal",
  }[found.sides];
  const angleWhy = {
    right: "one corner is a square corner",
    obtuse: "the largest corner is wider than a square corner",
    acute: "every corner is narrower than a square corner",
  }[found.angles];
  return finish("triangle-sides-angles-blanks", seed, r, {
    prompt:
      "The triangle is marked with tick marks for equal sides and a square for a right angle. Fill in the two blanks.",
    answer: serializeMultiPart(response, {
      sides: sideOptions.find((o) => o.label === found.sides)!.id,
      angles: angleOptions.find((o) => o.label === found.angles)!.id,
    }),
    hint: `The side lengths, rounded to the nearest tenth, are ${lengths}. Count how many match. Then compare the largest corner with the corner of a page.`,
    explanation: [
      `Tick marks show equal sides. Here ${sideWhy}, so by its sides the triangle is ${found.sides}.`,
      `A square mark shows a right angle. Here ${angleWhy}, so by its angles the triangle is ${found.angles}.`,
      `In this lesson, isosceles means exactly 2 equal sides, so an equilateral triangle is named equilateral.`,
    ],
    figure: geometryScene({
      kind: "plane-shapes",
      items: [{ pieces: [{ type: "polygon", points }], marks: "sides-angles" }],
    }),
    response,
  });
}

type QuadName =
  "square" | "rectangle" | "rhombus" | "parallelogram" | "trapezoid";
const QUAD_WRONG: Record<QuadName, readonly string[]> = {
  square: ["rectangle", "rhombus", "parallelogram"],
  rectangle: ["square", "rhombus", "parallelogram"],
  rhombus: ["square", "rectangle", "parallelogram"],
  parallelogram: ["rectangle", "rhombus", "trapezoid"],
  trapezoid: ["parallelogram", "rectangle", "square"],
};

function classifyQuad(pts: readonly Pt[]): QuadName | null {
  const angles = interiors(pts);
  const lengths = sideLengths(pts);
  const rights = angles.filter((a) => Math.abs(a - 90) < 0.5).length;
  const ratio = Math.max(...lengths) / Math.min(...lengths);
  const equal = ratio < 1.02;
  const pairs = parallelPairs(pts);
  if (rights === 4 && equal) return "square";
  if (rights === 4) return "rectangle";
  if (equal && rights === 0 && pairs >= 2) return "rhombus";
  if (pairs >= 2 && rights === 0 && !equal) return "parallelogram";
  if (pairs === 1) return "trapezoid";
  return null;
}

function quadrilateralAttributes(r: Rand, seed: string): GeneratedProblem {
  const kind = pick(r, [
    "square",
    "rectangle",
    "rhombus",
    "parallelogram",
    "trapezoid",
  ] as const);
  let points: Pt[] | null = null;
  for (let attempt = 0; attempt < 8 && !points; attempt++) {
    const shape = posed(quad(r, kind), pick(r, TURNS));
    if (shape.type !== "polygon") continue;
    const drawn = shape.points;
    if (classifyQuad(drawn) === kind) points = drawn;
  }
  if (!points)
    throw new Error(`quadrilateral-attributes: ${kind} did not classify`);
  const pairs = parallelPairs(points);
  const rights = interiors(points).filter((a) => Math.abs(a - 90) < 0.5).length;
  const lengths = sideLengths(points);
  const equal = Math.max(...lengths) / Math.min(...lengths) < 1.02;
  const pairWords = pairs === 1 ? "1 pair" : `${pairs} pairs`;
  return finish("quadrilateral-attributes", seed, r, {
    prompt: "What is the most exact name for this quadrilateral?",
    answer: "",
    hint: `The choices are ${[kind, ...QUAD_WRONG[kind]].join(", ")}. Count the pairs of matching arrows, the square corners, and the tick marks, then pick the most exact name.`,
    explanation: [
      `Matching arrows show parallel sides. This shape has ${pairWords} of parallel sides.`,
      rights === 4
        ? "Every corner is a right angle, marked with a small square."
        : "No corner is a right angle.",
      equal
        ? "All 4 sides are equal, shown by matching tick marks."
        : "The 4 sides are not all equal.",
      `The most exact name is ${kind}.`,
    ],
    figure: geometryScene({
      kind: "plane-shapes",
      items: [{ pieces: [{ type: "polygon", points }], marks: "parallel" }],
    }),
    choices: [
      { label: kind, correct: true },
      ...QUAD_WRONG[kind].map((name) => ({
        label: name,
        feedback:
          name === "square"
            ? "A square needs 4 right angles and 4 equal sides. This shape does not have both."
            : name === "rectangle"
              ? "A rectangle needs 4 right angles. Use that name only when it is the most exact one."
              : name === "rhombus"
                ? "A rhombus needs 4 equal sides and no right angle. Check both."
                : name === "parallelogram"
                  ? "A parallelogram needs 2 pairs of parallel sides. A more exact name may fit."
                  : "A trapezoid has exactly 1 pair of parallel sides.",
      })),
    ],
  });
}

function compositeRectangle(r: Rand, seed: string): GeneratedProblem {
  const W = r(6, 12);
  const H = r(6, 12);
  const w1 = r(2, W - 2);
  const h1 = r(2, H - 2);
  const unit = pick(r, ["cm", "m"] as const);
  const perimeter = r(0, 2) !== 0;
  const vertices: [number, number][] = [
    [0, 0],
    [W, 0],
    [W, h1],
    [w1, h1],
    [w1, H],
    [0, H],
  ];
  const sides = [W, h1, W - w1, H - h1, w1, H];
  const noun = unit === "cm" ? "centimeters" : "meters";
  const areaNoun = unit === "cm" ? "square centimeters" : "square meters";
  const bottom = W * h1;
  const top = w1 * (H - h1);
  const area = bottom + top;
  const around = sides.reduce((sum, side) => sum + side, 0);
  // The inner corner is a 270° reflex angle, and the schema allows only four
  // right-angle marks, so the fifth right angle (the step at the top of the
  // tall rectangle's right side) stays unmarked. The prompt names the marks
  // that are drawn.
  const figure: SemanticFigure = {
    kind: "measured-polygon",
    unit,
    vertices,
    sides,
    heights: [{ from: [w1, h1], to: [0, h1], value: w1 }],
    guides: [],
    rightAngles: [0, 1, 4, 5],
  };
  return finish("composite-rectangle-measure", seed, r, {
    prompt: perimeter
      ? `A dashed line splits this figure into two rectangles. Every outer side is labeled in ${noun}, and the marked corners are right angles. The dashed line is inside the figure. What is the perimeter, in ${noun}?`
      : `A dashed line splits this figure into two rectangles. Every outer side is labeled in ${noun}, and the marked corners are right angles. What is the area, in ${areaNoun}?`,
    answer: String(perimeter ? around : area),
    label: perimeter
      ? unit === "cm"
        ? "Centimeters"
        : "Meters"
      : areaNoun[0]!.toUpperCase() + areaNoun.slice(1),
    hint: perimeter
      ? `The bottom side is ${W} ${noun} and the left side is ${H} ${noun}. The dashed line is inside the figure, so it is not part of the perimeter. Add every outer side once.`
      : `The bottom side is ${W} ${noun} and the left side is ${H} ${noun}. Split the figure along the dashed line into two rectangles, find each area, and add. The dashed line is not an outer side.`,
    explanation: perimeter
      ? [
          `The dashed line is inside the figure, so leave it out of the perimeter.`,
          `The outer sides are ${sides.join(", ")} ${noun}.`,
          `Add them: ${sides.join(" + ")} = ${around}.`,
          `The opposite way: the figure is as wide as the bottom, ${W}, and as tall as the left side, ${H}, so the perimeter is $2 \\times (${W} + ${H}) = ${around}$.`,
        ]
      : [
          `The dashed line splits the figure into two rectangles that do not share any squares.`,
          `The bottom rectangle is ${W} by ${h1}: $${W} \\times ${h1} = ${bottom}$.`,
          `The top rectangle is ${w1} by ${H - h1}: $${w1} \\times ${H - h1} = ${top}$.`,
          `Add the areas: ${bottom} + ${top} = ${area} ${areaNoun}.`,
        ],
    figure,
  });
}

const rectangleFormula = selectFamily(
  metaOf("rectangle-formula-select"),
  (r) => {
    let length = 3;
    let width = 3;
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      length = r(3, 12);
      width = r(3, 12);
      const area = length * width;
      const around = 2 * (length + width);
      if (area !== around && area !== length + width) {
        ready = true;
        break;
      }
    }
    if (!ready) throw new Error("Need three retry: dimensions");
    const kind = r(0, 1) === 0 ? "perimeter" : "area";
    const around = 2 * (length + width);
    const area = length * width;
    const perimeterPool = [
      st(
        "$l + w + l + w$",
        true,
        `The four sides are $${length} + ${width} + ${length} + ${width} = ${around}$.`,
      ),
      st(
        "$2l + 2w$",
        true,
        `Two lengths and two widths: $2 \\times ${length} + 2 \\times ${width} = ${around}$.`,
      ),
      st(
        "$2(l + w)$",
        true,
        `The length and the width add to ${length + width}, and twice that is ${around}.`,
      ),
      st(
        "$l \\times w$",
        false,
        `$${length} \\times ${width} = ${area}$ is the area, the squares inside, not the walk around the sides.`,
      ),
      st(
        "$l + w$",
        false,
        `$${length} + ${width} = ${length + width}$ is only two sides. The walk visits four sides.`,
      ),
    ];
    const areaPool = [
      st(
        "$l \\times w$",
        true,
        `Area is length times width: $${length} \\times ${width} = ${area}$.`,
      ),
      st(
        "$w \\times l$",
        true,
        `Multiplying in the other order gives the same product: $${width} \\times ${length} = ${area}$.`,
      ),
      st(
        "$l + w + l + w$",
        false,
        `Adding the four sides gives ${around}, which is the perimeter.`,
      ),
      st(
        "$2l + 2w$",
        false,
        `$2 \\times ${length} + 2 \\times ${width} = ${around}$ is the perimeter.`,
      ),
      st(
        "$2(l + w)$",
        false,
        `Two times the sum of the length and the width is ${around}, the perimeter.`,
      ),
    ];
    const pool = kind === "perimeter" ? perimeterPool : areaPool;
    return selectModel({
      variant: kind,
      pool,
      total: pool.length,
      k: pool.filter((item) => item.holds).length,
      ordered: true,
      context:
        "The length $l$ is the horizontal side and the width $w$ is the vertical side.",
      ask: (n) =>
        `Select the ${n} ${n === 1 ? "expression" : "expressions"} that equal the ${kind}.`,
      one: "expression",
      hint: (shown) => {
        const n = shown.filter((item) => item.holds).length;
        return `The question asks for ${n} expressions. The length is ${length} centimeters and the width is ${width} centimeters. The perimeter is the walk around all four sides. The area is the squares inside.`;
      },
      figure: {
        kind: "measure-rectangle",
        width: { value: length, unit: "cm" },
        height: { value: width, unit: "cm" },
      },
    });
  },
);

export function generateGrade4Geometry(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  switch (templateId) {
    case "protractor-ray-choice":
      return protractorRay(r, seed);
    case "adjacent-angle-equation":
      return adjacentEquation(r, seed);
    case "angle-benchmark-estimate":
      return benchmarkEstimate(r, seed);
    case "triangle-sides-angles-blanks":
      return triangleBlanks(r, seed);
    case "quadrilateral-attributes":
      return quadrilateralAttributes(r, seed);
    case "composite-rectangle-measure":
      return compositeRectangle(r, seed);
    case "rectangle-formula-select":
      return rectangleFormula.generate(seed).problem;
    default:
      throw new Error(`Unknown grade-4 geometry template ${templateId}`);
  }
}
