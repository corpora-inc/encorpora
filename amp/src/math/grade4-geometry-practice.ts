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
import { angle, protractor, scene, triangle } from "./scene/author.js";
import type { Element } from "./scene/spec.js";
import { selectFamily, selectModel, selectTemplate, st } from "./select-kit.js";
import { posed, pick, random, shuffle, type Rand } from "./shape-practice.js";
import type { Pt } from "./shape-figures.js";
import { generatingVersion, type Random } from "./variation/axes.js";
import {
  adjacentPrompt,
  benchmarkPrompt,
  protractorHint,
  protractorPrompt,
  areaWord,
  compositeJob,
  formulaAsk,
  formulaScene,
  quadrilateralPrompt,
  spreadPick,
  storyNameFor,
  trianglePrompt,
  unitWord,
} from "./story-kit/geometry.js";

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
    version: 2,
    reprintsFrom: 1,
    title: "Classify a triangle by sides and angles",
    skillId: "lines-symmetry",
    gradeBand: band,
    description:
      "Name one triangle twice: scalene, isosceles or equilateral from its tick marks, and acute, right or obtuse from its angles. A square mark shows a right angle. When there is no square mark, the widest angle is labeled. A right isosceles triangle is included.",
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
/** Version 2 labels the widest angle. Version 1 is the saved figure, which
 * asks the learner to compare a corner with the corner of a page. */
function triangleVersion(): 1 | 2 {
  const version =
    generatingVersion() ?? metaOf("triangle-sides-angles-blanks").version;
  return version >= 2 ? 2 : 1;
}
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
      templateVersion:
        id === "triangle-sides-angles-blanks" ? triangleVersion() : 1,
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

/** The protractor's own rays end here. Choice rays stop on that circle so
 * their letters, not a longer ray, are what stick out past the tool. */
const PROTRACTOR_RAY = 1.06;
/** Offsets from a ray tip, in screen pixels (y down), sitting outside the
 * degree numbers. Layout keeps the clear spot that grows the figure least. */
function rayLetterPlace(deg: number): [number, number, 0, 0][] {
  const t = (deg * Math.PI) / 180;
  const ux = Math.cos(t);
  const uy = -Math.sin(t);
  const px = -uy;
  const py = ux;
  const spot = (out: number, side: number): [number, number, 0, 0] => [
    Math.round(ux * out + px * side),
    Math.round(uy * out + py * side),
    0,
    0,
  ];
  return [
    spot(20, 0),
    spot(34, 0),
    spot(16, 18),
    spot(16, -18),
    spot(28, 24),
    spot(28, -24),
    spot(12, 34),
    spot(12, -34),
  ];
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
      const tip: [number, number] = [
        PROTRACTOR_RAY * Math.cos(t),
        PROTRACTOR_RAY * Math.sin(t),
      ];
      return [
        {
          type: "segment",
          id: `ray${ray.letter}`,
          from: [0, 0],
          to: tip,
          stroke: "ink",
          width: 2,
          arrow: "end",
        },
        {
          type: "text",
          id: `name${ray.letter}`,
          at: tip,
          text: ray.letter,
          font: "sans",
          size: "md",
          bold: true,
          halo: true,
          align: [0, 0],
          place: rayLetterPlace(ray.dir),
        },
      ];
    }),
  ];
  const scale = right ? "inner" : "outer";
  const correct = rays.find((ray) => ray.dir === correctDir)!;
  return finish("protractor-ray-choice", seed, r, {
    prompt: protractorPrompt(seed, k),
    answer: "",
    hint: protractorHint(seed, k, right),
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
    prompt: adjacentPrompt(
      seed,
      `${A}${B}${D}`,
      knownName.replaceAll("$", ""),
      missingName.replaceAll("$", ""),
      whole,
      known,
    ),
    answer: "",
    hint: `The two parts sit side by side and fill the ${whole}° angle. The known part is ${known}°. Write an equation for $x$ that uses both of those numbers.`,
    explanation: [
      `The two parts sit side by side and do not overlap, so together they make the ${whole}° angle.`,
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
  const farther = shown.filter((b) => b !== keyed);
  return finish("angle-benchmark-estimate", seed, r, {
    prompt: benchmarkPrompt(seed, measure),
    answer: "",
    hint:
      measure < 75
        ? "The opening is narrower than a square corner. Compare it with the benchmarks that are also narrower."
        : measure <= 100
          ? "Compare the opening with a square corner. Pick the nearest benchmark."
          : measure < 160
            ? "The opening is wider than a square corner and not yet a straight line. Pick the nearest benchmark."
            : "Compare the opening with a straight line. Pick the nearest benchmark.",
    explanation: [
      `The choices are ${words}.`,
      `Compare the opening with each choice. It is nearest $${keyed}^\\circ$, and it is within 10° of that benchmark.`,
      `It is more than 10° from ${farther.map((b) => `${b}°`).join(", ")}, so the nearest choice is clear.`,
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

/** Marks as the figure draws them. A hint names those marks and does not
 * name the side class or the quadrilateral. A labeled angle measure is the
 * given that names the angle class. */
const MARK_COUNT = ["no", "one", "two", "three", "four"] as const;
function markCount(n: number): string {
  return MARK_COUNT[n] ?? String(n);
}
function edgeLength(pts: readonly Pt[], i: number): number {
  const a = pts[i]!;
  const b = pts[(i + 1) % pts.length]!;
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
function edgeDir(pts: readonly Pt[], i: number): Pt {
  const a = pts[i]!;
  const b = pts[(i + 1) % pts.length]!;
  const length = edgeLength(pts, i);
  return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
}
function drawnTickCounts(pts: readonly Pt[]): number[] {
  const n = pts.length;
  const group = Array<number>(n).fill(0);
  let groups = 0;
  for (let i = 0; i < n; i++) {
    if (group[i]) continue;
    const length = edgeLength(pts, i);
    const same: number[] = [];
    for (let j = 0; j < n; j++) {
      if (group[j]) continue;
      if (Math.abs(edgeLength(pts, j) - length) <= 1e-3 * length) same.push(j);
    }
    if (same.length < 2) continue;
    groups++;
    for (const j of same) group[j] = groups;
  }
  return group;
}
function vertexIsRight(pts: readonly Pt[], i: number): boolean {
  const n = pts.length;
  const incoming = edgeDir(pts, (i + n - 1) % n);
  const outgoing = edgeDir(pts, i);
  const dot = -incoming[0] * outgoing[0] + -incoming[1] * outgoing[1];
  return Math.abs(dot) <= 1e-3;
}
function drawnRightAngles(pts: readonly Pt[]): number {
  let count = 0;
  for (let i = 0; i < pts.length; i++) if (vertexIsRight(pts, i)) count++;
  return count;
}
/** Parallel pairs that receive matching arrows. Adjacent sides that wrap
 * from the last vertex back to the first are not a pair. */
function drawnArrowPairs(pts: readonly Pt[]): number {
  const n = pts.length;
  let pairs = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const p = edgeDir(pts, i);
      const q = edgeDir(pts, j);
      if (Math.abs(p[0] * q[1] - p[1] * q[0]) > 1e-3) continue;
      pairs++;
    }
  return pairs;
}
function sideMarkSentence(ticks: readonly number[]): string {
  const buckets = new Map<number, number>();
  for (const ticksOnSide of ticks)
    if (ticksOnSide > 0)
      buckets.set(ticksOnSide, (buckets.get(ticksOnSide) ?? 0) + 1);
  if (buckets.size === 0) return "No side has a tick mark.";
  const parts = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([marks, sides]) => {
      const tick =
        marks === 1 ? "one tick mark" : `${markCount(marks)} tick marks`;
      if (sides === ticks.length)
        return `All ${markCount(sides)} sides have ${tick} each`;
      if (sides === 1) return `One side has ${tick}`;
      return `${markCount(sides)} sides have ${tick} each`;
    });
  const [first, ...rest] = parts;
  const head = first!.charAt(0).toUpperCase() + first!.slice(1);
  if (rest.length === 0) return `${head}.`;
  return `${head}, and ${rest.join(", and ")}.`;
}
function triangleFigureHint(pts: readonly Pt[], shown?: number): string {
  const sides = sideMarkSentence(drawnTickCounts(pts)).replace(/\.$/, "");
  const squares = drawnRightAngles(pts);
  if (squares === 1) return `${sides}, and one corner has a square mark.`;
  if (squares > 1)
    return `${sides}, and ${markCount(squares)} corners have a square mark.`;
  if (shown != null) {
    const relation = shown > 90 ? "more than" : "less than";
    const conclusion =
      shown > 90
        ? "so the triangle is obtuse."
        : "so every angle is acute and the triangle is acute.";
    return `${sides}. The widest angle is $${shown}^\\circ$, ${relation} $90^\\circ$, ${conclusion}`;
  }
  return `${sides}. No corner has a square mark. Compare the widest corner with the corner of a page.`;
}
function cornerMarkSentence(squares: number, corners: number): string {
  if (squares === 0) return "No corner has a right-angle mark.";
  if (squares === corners) return "Every corner has a right-angle mark.";
  if (squares === 1) return "One corner has a right-angle mark.";
  const word = markCount(squares);
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} corners have a right-angle mark.`;
}
function quadrilateralFigureHint(pts: readonly Pt[]): string {
  const pairs = drawnArrowPairs(pts);
  const arrows =
    pairs === 1
      ? "This shape has one pair of sides with matching arrow marks."
      : `This shape has ${markCount(pairs)} pairs of sides with matching arrow marks.`;
  return `${arrows} ${sideMarkSentence(drawnTickCounts(pts))} ${cornerMarkSentence(drawnRightAngles(pts), pts.length)}`;
}

/** The widest corner, and the whole-degree label that matches it. */
function widestCorner(pts: readonly Pt[]): {
  at: number;
  degrees: number;
  shown: number;
} {
  const angles = interiors(pts);
  let at = 0;
  for (let i = 1; i < angles.length; i++)
    if (angles[i]! > angles[at]!) at = i;
  const degrees = angles[at]!;
  return { at, degrees, shown: Math.round(degrees) };
}
/** The labeled measure is the angle class: over 90 is obtuse, under 90 is
 * acute, and the number stays clear of 90 and within 1° of the drawing. */
function labelAgrees(
  pts: readonly Pt[],
  kind: AngleClass,
  shown: number,
  at: number,
): boolean {
  const angles = interiors(pts);
  const fromLabel = shown > 90 ? "obtuse" : shown < 90 ? "acute" : "right";
  return (
    Math.abs(angles[at]! - shown) <= 1 &&
    Math.abs(Math.max(...angles) - shown) <= 1 &&
    fromLabel === kind &&
    (kind === "obtuse" ? shown >= 105 : kind === "acute" && shown <= 80)
  );
}
/** Tick marks, a square at each right angle, and the catalog's angle label
 * on the widest corner when the triangle is not right. */
function labelledTriangle(
  points: readonly Pt[],
  label: { at: number; shown: number } | null,
): SemanticFigure {
  const ticks = drawnTickCounts(points);
  const [p0, p1, p2] = points as [Pt, Pt, Pt];
  let drawn = triangle([p0, p1, p2], { fill: "accent-fill" });
  for (const i of [0, 1, 2] as const) {
    const count = ticks[i] ?? 0;
    if (count > 0) drawn = drawn.side(i, { ticks: count });
    if (vertexIsRight(points, i)) drawn = drawn.angle(i, { mark: "right" });
    else if (label && label.at === i)
      drawn = drawn.angle(i, { mark: "arc", label: `${label.shown}°` });
  }
  return { kind: "scene", scene: scene(drawn).build({ width: 320 }) };
}

function triangleBlanks(r: Rand, seed: string): GeneratedProblem {
  const version = triangleVersion();
  const built = spreadPick(seed, "triangle-shape", TRIANGLES);
  const shape = posed(built.points, pick(r, TURNS), pick(r, [0.85, 1, 1.15]));
  if (shape.type !== "polygon") throw new Error("triangle: expected a polygon");
  const points = shape.points;
  const found = classesOf(points);
  const label =
    version >= 2 && found.angles !== "right" ? widestCorner(points) : null;
  if (
    found.sides !== built.sides ||
    found.angles !== built.angles ||
    (label != null &&
      !labelAgrees(points, found.angles, label.shown, label.at)) ||
    (version >= 2 &&
      found.angles === "right" &&
      drawnRightAngles(points) !== 1)
  )
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
  const angleLine = label
    ? label.shown > 90
      ? `The widest angle is $${label.shown}^\\circ$, more than $90^\\circ$, so the triangle is obtuse.`
      : `The widest angle is $${label.shown}^\\circ$, less than $90^\\circ$, so every angle is acute and the triangle is acute.`
    : `A square mark shows a right angle. Here ${angleWhy}, so by its angles the triangle is ${found.angles}.`;
  const closing =
    found.sides === "equilateral"
      ? "In this lesson, isosceles means exactly 2 equal sides, so an equilateral triangle is named equilateral."
      : `Name the sides and the angles separately. This triangle is ${found.sides} by its sides and ${found.angles} by its angles.`;
  return finish("triangle-sides-angles-blanks", seed, r, {
    prompt: trianglePrompt(seed, version),
    answer: serializeMultiPart(response, {
      sides: sideOptions.find((o) => o.label === found.sides)!.id,
      angles: angleOptions.find((o) => o.label === found.angles)!.id,
    }),
    hint: triangleFigureHint(points, label?.shown),
    explanation: [
      `Tick marks show equal sides. Here ${sideWhy}, so by its sides the triangle is ${found.sides}.`,
      angleLine,
      closing,
    ],
    figure:
      version >= 2
        ? labelledTriangle(points, label)
        : geometryScene({
            kind: "plane-shapes",
            items: [
              { pieces: [{ type: "polygon", points }], marks: "sides-angles" },
            ],
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
  const kind = spreadPick(seed, "quad-kind", [
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
    prompt: quadrilateralPrompt(seed),
    answer: "",
    hint: quadrilateralFigureHint(points),
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
  const job = compositeJob(seed);
  const name = storyNameFor(seed, "composite-name");
  const W = r(job.w[0], job.w[1]);
  const H = r(job.h[0], job.h[1]);
  const w1 = r(2, W - 2);
  const h1 = r(2, H - 2);
  const unit = job.unit;
  const perimeter = job.measure === "perimeter";
  const vertices: [number, number][] = [
    [0, 0],
    [W, 0],
    [W, h1],
    [w1, h1],
    [w1, H],
    [0, H],
  ];
  const sides = [W, h1, W - w1, H - h1, w1, H];
  const noun = unitWord(unit, 2);
  const areaNoun = areaWord(unit, 2);
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
  const asked = perimeter ? noun : areaNoun;
  const frame = spreadPick(seed, `composite-frame-${job.id}`, job.frames);
  return finish("composite-rectangle-measure", seed, r, {
    prompt: frame(name, asked),
    answer: String(perimeter ? around : area),
    label: asked[0]!.toUpperCase() + asked.slice(1),
    hint: perimeter
      ? `The dashed line is inside, so leave it out of the perimeter. Add every outer side once. The bottom side is ${W} ${noun} and the left side is ${H} ${noun}.`
      : `${name} can split the figure along the dashed line into two rectangles. Multiply each length by its width, then add. The bottom side is ${W} ${noun} and the left side is ${H} ${noun}.`,
    explanation: perimeter
      ? [
          `The dashed line is inside the figure, so leave it out of the perimeter.`,
          `The outer sides are ${sides.join(", ")} ${noun}.`,
          `Add each outer side once: ${sides.join(" + ")} = ${around}.`,
          `The dashed line is not one of those sides, so leave it out of the sum.`,
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

let rectangleSeed = "";

const rectangleFormula = selectFamily(
  metaOf("rectangle-formula-select"),
  (r) => {
    const seed = rectangleSeed;
    const scene = formulaScene(seed);
    const name = storyNameFor(seed, "formula-name");
    const unitName = scene.unit === "cm" ? "centimeters" : "meters";
    let length = 3;
    let width = 3;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      length = r(scene.length[0], scene.length[1]);
      width = r(scene.width[0], scene.width[1]);
      const area = length * width;
      const around = 2 * (length + width);
      const ratio = length / width;
      if (
        length !== width &&
        area !== around &&
        area !== length + width &&
        ratio <= 3 &&
        ratio >= 1 / 3
      ) {
        ready = true;
        break;
      }
    }
    if (!ready) throw new Error("Need three retry: dimensions");
    const kind = scene.measure;
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
    const lead =
      kind === "perimeter"
        ? [
            "The perimeter is the walk around all four sides.",
            `The length is ${length} ${unitName} and the width is ${width} ${unitName}, as labeled.`,
            "Adding the four sides, adding twice the length and twice the width, and doubling the sum of the length and the width are the same walk.",
          ]
        : [
            "The area is the squares inside.",
            `The length is ${length} ${unitName} and the width is ${width} ${unitName}, as labeled.`,
            "Length times width counts those squares, and so does width times length. Adding or doubling the sides walks around the outside.",
          ];
    return selectModel({
      variant: kind,
      pool,
      total: pool.length,
      k: pool.filter((item) => item.holds).length,
      ordered: true,
      context: scene.lead(name),
      ask: (n) => formulaAsk(seed, n, kind),
      one: "expression",
      lead,
      hint: (shown) => {
        const n = shown.filter((item) => item.holds).length;
        return kind === "perimeter"
          ? `The question asks for ${n} expressions. Walk around all four sides. The length and the width are labeled in ${unitName}.`
          : `The question asks for ${n} expressions. Count the squares inside. The length and the width are labeled in ${unitName}.`;
      },
      figure: {
        kind: "measure-rectangle",
        width: { value: length, unit: scene.unit },
        height: { value: width, unit: scene.unit },
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
      rectangleSeed = seed;
      return rectangleFormula.generate(seed).problem;
    default:
      throw new Error(`Unknown grade-4 geometry template ${templateId}`);
  }
}
