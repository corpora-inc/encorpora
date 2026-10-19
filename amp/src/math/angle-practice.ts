import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { centroid, place, type Pt } from "./shape-figures.js";
import { angle, protractor, scene } from "./scene/author.js";
import type { Element } from "./scene/spec.js";
import { pick, random, shuffle, type Rand } from "./shape-practice.js";

const definitions: [string, string, string, string, boolean][] = [
  [
    "protractor-reading",
    "Read a protractor",
    "angle-measure",
    "Measure an angle with a protractor, choosing the scale that starts at 0 on one ray.",
    false,
  ],
  [
    "adjacent-angles",
    "Angles that add",
    "angle-measure",
    "Find a whole angle or a missing part when two angles do not overlap.",
    false,
  ],
  [
    "turn-degrees",
    "Degrees in a turn",
    "angle-measure",
    "Find an angle's measure as a fraction of the 360° in a full turn.",
    false,
  ],
  [
    "angle-classify",
    "Acute, right or obtuse",
    "lines-symmetry",
    "Classify an angle as acute, right, obtuse or straight.",
    true,
  ],
  [
    "line-ray-segment",
    "Lines, rays and segments",
    "lines-symmetry",
    "Name a line, a ray or a line segment from its ends.",
    true,
  ],
  [
    "line-relationship",
    "Parallel or perpendicular",
    "lines-symmetry",
    "Tell parallel, perpendicular and other intersecting lines on a dot grid.",
    true,
  ],
  [
    "classify-triangle-angles",
    "Triangles by their angles",
    "lines-symmetry",
    "Classify a triangle as acute, right or obtuse.",
    true,
  ],
  [
    "symmetry-line-count",
    "Count lines of symmetry",
    "lines-symmetry",
    "Count every line of symmetry of a shape.",
    false,
  ],
  [
    "symmetry-line-check",
    "Find the line of symmetry",
    "lines-symmetry",
    "Choose the dashed line that is a line of symmetry.",
    true,
  ],
];
export const angleTemplates: readonly TemplateMetadata[] = definitions.map(
  ([id, title, skillId, description, choice]) => ({
    id,
    title,
    skillId,
    description,
    version: 1,
    gradeBand: "3–5",
    requiredFigureCapability: "scenes-v1",
    ...(choice
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
  }),
);

type Choice = { label: string; correct?: true; feedback?: string };
const deg = Math.PI / 180;
const norm = (d: number) => ((d % 360) + 360) % 360;
const letters = [
  ["A", "B", "C", "D"],
  ["P", "Q", "R", "S"],
  ["J", "K", "L", "M"],
  ["W", "X", "Y", "Z"],
] as const;
const lines = (n: number) => `${n} ${n === 1 ? "line" : "lines"}`;
/** Where a ray points, in words. */
function heading(d: number) {
  const names = [
    "right",
    "up and to the right",
    "up",
    "up and to the left",
    "left",
    "down and to the left",
    "down",
    "down and to the right",
  ];
  return names[Math.round(norm(d) / 45) % 8]!;
}

/** Triangle with base angles a and b (degrees), base on the x-axis. */
function triangle(a: number, b: number, base = 3): Pt[] {
  const c = 180 - a - b;
  const side = (base * Math.sin(b * deg)) / Math.sin(c * deg);
  return [
    [0, 0],
    [base, 0],
    [side * Math.cos(a * deg), side * Math.sin(a * deg)],
  ];
}

/** Shapes with a known number of lines of symmetry. */
function symmetric(r: Rand): {
  name: string;
  points: Pt[];
  axes: number;
  axis: number;
} {
  // Pick a symmetry family first, so no one count dominates.
  const kind = pick(r, [
    pick(r, [
      "isosceles",
      "trapezoid",
      "kite",
      "house",
      "arrow",
      "tee",
    ] as const),
    pick(r, [
      "isosceles",
      "trapezoid",
      "kite",
      "house",
      "arrow",
      "tee",
    ] as const),
    "regular",
    "regular",
    "rectangle",
    "rhombus",
    "square",
    "plus",
    "parallelogram",
    "scalene",
  ] as const);
  const regular = (n: number, start: number): Pt[] =>
    Array.from({ length: n }, (_, i) => {
      const t = (start + (360 * i) / n) * deg;
      return [1.5 * Math.cos(t), 1.5 * Math.sin(t)] as Pt;
    });
  switch (kind) {
    case "regular": {
      const n = r(3, 8);
      return {
        name: {
          3: "equilateral triangle",
          4: "square",
          5: "regular pentagon",
          6: "regular hexagon",
          7: "regular 7-sided shape",
          8: "regular octagon",
        }[n]!,
        points: regular(n, 90),
        axes: n,
        axis: 90,
      };
    }
    case "rectangle":
      return {
        name: "rectangle",
        points: [
          [-1.6, -0.8],
          [1.6, -0.8],
          [1.6, 0.8],
          [-1.6, 0.8],
        ],
        axes: 2,
        axis: 90,
      };
    case "square":
      return {
        name: "square",
        points: [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ],
        axes: 4,
        axis: 90,
      };
    case "rhombus":
      return {
        name: "rhombus",
        points: [
          [0, -1.6],
          [1, 0],
          [0, 1.6],
          [-1, 0],
        ],
        axes: 2,
        axis: 90,
      };
    case "isosceles":
      return {
        name: "isosceles triangle",
        points: [
          [-1, 0],
          [1, 0],
          [0, pick(r, [2.4, 2.8])],
        ],
        axes: 1,
        axis: 90,
      };
    case "trapezoid":
      return {
        name: "trapezoid",
        points: [
          [-1.8, 0],
          [1.8, 0],
          [0.9, 1.4],
          [-0.9, 1.4],
        ],
        axes: 1,
        axis: 90,
      };
    case "kite":
      return {
        name: "kite",
        points: [
          [0, -1],
          [1.1, 0.3],
          [0, 2.2],
          [-1.1, 0.3],
        ],
        axes: 1,
        axis: 90,
      };
    case "parallelogram":
      return {
        name: "parallelogram",
        points: [
          [0, 0],
          [2.6, 0],
          [3.4, 1.4],
          [0.8, 1.4],
        ],
        axes: 0,
        axis: 90,
      };
    case "scalene":
      return {
        name: "triangle with three different sides",
        points: [
          [0, 0],
          [3, 0],
          [0.8, 1.9],
        ],
        axes: 0,
        axis: 90,
      };
    case "house":
      return {
        name: "house shape",
        points: [
          [-1.2, 0],
          [1.2, 0],
          [1.2, 1.4],
          [0, 2.5],
          [-1.2, 1.4],
        ],
        axes: 1,
        axis: 90,
      };
    case "arrow":
      return {
        name: "arrow",
        points: [
          [-0.5, -1.8],
          [0.5, -1.8],
          [0.5, 0.2],
          [1.3, 0.2],
          [0, 1.8],
          [-1.3, 0.2],
          [-0.5, 0.2],
        ],
        axes: 1,
        axis: 90,
      };
    case "plus": {
      const a = 0.5,
        b = 1.5;
      return {
        name: "plus sign",
        points: [
          [-a, -b],
          [a, -b],
          [a, -a],
          [b, -a],
          [b, a],
          [a, a],
          [a, b],
          [-a, b],
          [-a, a],
          [-b, a],
          [-b, -a],
          [-a, -a],
        ],
        axes: 4,
        axis: 90,
      };
    }
    case "tee":
      return {
        name: "T shape",
        points: [
          [-0.45, -1.6],
          [0.45, -1.6],
          [0.45, 0.6],
          [1.6, 0.6],
          [1.6, 1.4],
          [-1.6, 1.4],
          [-1.6, 0.6],
          [-0.45, 0.6],
        ],
        axes: 1,
        axis: 90,
      };
  }
}
/** Reflect across the line through c at angle t (degrees). */
function reflect(p: Pt, c: Pt, t: number): Pt {
  const ux = Math.cos(t * deg),
    uy = Math.sin(t * deg);
  const dx = p[0] - c[0],
    dy = p[1] - c[1];
  const along = dx * ux + dy * uy;
  return [c[0] + 2 * along * ux - dx, c[1] + 2 * along * uy - dy];
}
function mirrors(points: Pt[], c: Pt, t: number) {
  return points.every((p) => {
    const q = reflect(p, c, t);
    return points.some(
      (s) => Math.abs(s[0] - q[0]) < 1e-3 && Math.abs(s[1] - q[1]) < 1e-3,
    );
  });
}

/** For each dashed line, the end its letter goes past: the upper end (the
 * right end of a level line), so parallel lines' letters sit side by side,
 * unless another letter is already close there. Returns the end and the
 * outward unit direction. */
function labelEnds(lines: { a: Pt; b: Pt }[]) {
  const chosen: Pt[] = [];
  return lines.map(({ a, b }) => {
    const upper =
      b[1] - a[1] > 1e-6 || (Math.abs(b[1] - a[1]) <= 1e-6 && b[0] > a[0]);
    let [end, from] = upper ? [b, a] : [a, b];
    const crowded = (p: Pt) =>
      chosen.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.35);
    if (crowded(end)) [end, from] = [from, end];
    chosen.push(end);
    const len = Math.hypot(end[0] - from[0], end[1] - from[1]);
    return [
      end,
      [(end[0] - from[0]) / len, (end[1] - from[1]) / len] as Pt,
    ] as const;
  });
}

/** A problem figure built with the scene framework. */
const sceneFigure = (...elements: Element[]): SemanticFigure => ({
  kind: "scene",
  scene: scene(...elements).build({ width: 340, maxHeight: 280 }),
});
const toward = (d: number, r: number): Pt => [
  r * Math.cos(d * deg),
  r * Math.sin(d * deg),
];
/** A dot grid with two lines through lattice dots, extended to its edges. */
function linePair(columns: number, rows: number, pair: [[Pt, Pt], [Pt, Pt]]) {
  const elements: Element[] = [];
  for (let x = 0; x < columns; x++)
    for (let y = 0; y < rows; y++)
      elements.push({
        type: "point",
        id: `d${x}-${y}`,
        at: [x, y],
        r: 2.5,
        color: "grid",
      });
  const lo = -0.45,
    hx = columns - 1 + 0.45,
    hy = rows - 1 + 0.45;
  pair.forEach(([p, q], i) => {
    const dx = q[0] - p[0],
      dy = q[1] - p[1];
    const ts = [
      ...(dx ? [(lo - p[0]) / dx, (hx - p[0]) / dx] : []),
      ...(dy ? [(lo - p[1]) / dy, (hy - p[1]) / dy] : []),
    ]
      .map((t) => [p[0] + t * dx, p[1] + t * dy] as Pt)
      .filter(
        ([x, y]) =>
          x >= lo - 1e-9 && x <= hx + 1e-9 && y >= lo - 1e-9 && y <= hy + 1e-9,
      )
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const color = i === 0 ? ("ink" as const) : ("warm" as const);
    elements.push({
      type: "segment",
      id: `line${i}`,
      from: ts[0]!,
      to: ts[ts.length - 1]!,
      stroke: color,
      width: 3,
      arrow: "both",
    });
    elements.push({ type: "point", id: `on${i}a`, at: p, r: 4.5, color });
    elements.push({ type: "point", id: `on${i}b`, at: q, r: 4.5, color });
  });
  return elements;
}
/** A small square in each right angle of a polygon. */
function rightMarks(points: Pt[]): Element[] {
  const size = 0.28;
  return points.flatMap((v, i) => {
    const u = points[(i + points.length - 1) % points.length]!,
      w = points[(i + 1) % points.length]!;
    const a: Pt = [u[0] - v[0], u[1] - v[1]],
      b: Pt = [w[0] - v[0], w[1] - v[1]];
    const la = Math.hypot(...a),
      lb = Math.hypot(...b);
    if (Math.abs(a[0] * b[0] + a[1] * b[1]) > 1e-3 * la * lb) return [];
    const ua: Pt = [(a[0] / la) * size, (a[1] / la) * size],
      ub: Pt = [(b[0] / lb) * size, (b[1] / lb) * size];
    return [
      {
        type: "polyline" as const,
        id: `right${i}`,
        points: [
          [v[0] + ua[0], v[1] + ua[1]],
          [v[0] + ua[0] + ub[0], v[1] + ua[1] + ub[1]],
          [v[0] + ub[0], v[1] + ub[1]],
        ] as Pt[],
        stroke: "ink" as const,
        width: 2,
      },
    ];
  });
}

export function generateAngleProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = angleTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown angle template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = "",
    hint = "",
    label = "Answer",
    explanation: string[] = [],
    figure: SemanticFigure,
    choices: Choice[] | undefined,
    keepOrder = false;
  switch (templateId) {
    case "protractor-reading": {
      const m = 5 * r(2, 34);
      const right = r(0, 1) === 1;
      const [a, b, c] = pick(r, letters);
      figure = sceneFigure(
        protractor(right ? [0, m] : [180, 180 - m], [a, b, c]).element(),
      );
      const scale = right ? "inner" : "outer";
      prompt = `What is the measure of angle ${a}${b}${c}, in degrees?`;
      label = "Degrees";
      answer = String(m);
      hint = `Ray ${b}${a} passes through 0 on the ${right ? "right" : "left"}. Use the scale that starts at 0 there, and follow it to ray ${b}${c}.`;
      explanation = [
        `Ray ${b}${a} lies on 0 of the ${scale} scale.`,
        `Follow the ${scale} scale from 0 to ray ${b}${c}: it reads ${m}.`,
        m === 90
          ? `Both scales read 90 there, so either gives the measure.`
          : `The other scale reads ${180 - m} at ray ${b}${c}, but that scale is at 180, not 0, on ray ${b}${a}.`,
        `Angle ${a}${b}${c} measures ${m}°.`,
      ];
      break;
    }
    case "adjacent-angles": {
      const unknown = pick(r, ["whole", "first", "second"] as const);
      const special = r(0, 3);
      let p: number, q: number;
      if (special === 0 && unknown !== "whole") {
        // A right angle or a straight angle split in two.
        const whole = pick(r, [90, 180]);
        // Unequal parts, so the known part never shows the answer.
        do p = 5 * r(2, whole / 5 - 2);
        while (2 * p === whole);
        q = whole - p;
      } else
        do {
          p = 5 * r(3, 20);
          q = 5 * r(3, 20);
        } while (p + q > 170 || p === q);
      const W = p + q;
      const [A, B, C, D] = pick(r, letters);
      const d0 = 5 * r(0, 71);
      // The whole angle's measure is in the prompt; the drawing marks the
      // two parts, and the unknown part reads "?".
      figure = sceneFigure(
        angle({
          rays: [d0, d0 + p, d0 + W],
          labels: { vertex: B, ends: [A, C, D] },
          marks: [
            { from: 0, to: 1, measure: true, derived: unknown === "first" },
            { from: 1, to: 2, measure: true, derived: unknown === "second" },
          ],
        }).element(),
      );
      label = "Degrees";
      if (unknown === "whole") {
        prompt = `Angle ${A}${B}${C} measures ${p}° and angle ${C}${B}${D} measures ${q}°. They do not overlap. What is the measure of angle ${A}${B}${D}?`;
        answer = String(W);
        hint = `Angle ${A}${B}${D} is made of the two angles side by side, so their measures add: start from ${p}°.`;
        explanation = [
          `Angles ${A}${B}${C} and ${C}${B}${D} share ray ${B}${C} and do not overlap, so together they make angle ${A}${B}${D}.`,
          `$${p} + ${q} = ${W}$, so angle ${A}${B}${D} measures ${W}°.`,
        ];
      } else {
        const known = unknown === "first" ? q : p,
          missing = unknown === "first" ? p : q;
        const [kName, mName] =
          unknown === "first"
            ? [`${C}${B}${D}`, `${A}${B}${C}`]
            : [`${A}${B}${C}`, `${C}${B}${D}`];
        const wholeWords =
          W === 90
            ? " (a right angle)"
            : W === 180
              ? " (a straight angle)"
              : "";
        prompt = `Angle ${A}${B}${D} measures ${W}°${wholeWords}. Angle ${kName} measures ${known}°. What is the measure of angle ${mName}?`;
        answer = String(missing);
        hint = `The two angles fill angle ${A}${B}${D} with no overlap. Subtract the known part, ${known}°, from ${W}°.`;
        explanation = [
          `Angles ${kName} and ${mName} together make angle ${A}${B}${D}, so ${known}° plus the missing angle is ${W}°.`,
          `$${W} - ${known} = ${missing}$, so angle ${mName} measures ${missing}°.`,
        ];
      }
      break;
    }
    case "turn-degrees": {
      const n = pick(r, [4, 6, 8, 10, 12, 36]);
      const k = r(1, n - 1);
      const each = 360 / n,
        total = k * each;
      const start = 5 * r(0, 71);
      figure = sceneFigure(
        {
          type: "arc",
          id: "shaded",
          center: [0, 0],
          r: 1,
          from: start,
          to: start + total,
          fill: "accent-strong",
          stroke: "ink",
          width: 3,
        },
        {
          type: "circle",
          id: "turn",
          center: [0, 0],
          r: 1,
          stroke: "ink",
          width: 2,
        },
        ...Array.from({ length: n }, (_, i) => ({
          type: "segment" as const,
          id: `spoke${i}`,
          from: [0, 0] as Pt,
          to: toward(start + i * each, 1),
          stroke: "ink" as const,
          width: n > 12 ? 1 : 1.5,
        })),
        {
          type: "arc",
          id: "mark",
          center: [0, 0],
          r: 0.24,
          from: start,
          to: start + total,
          stroke: "warm",
          width: 3,
        },
      );
      prompt = `The circle is cut into ${n} equal angles that meet at its center. How many degrees is the shaded angle?`;
      label = "Degrees";
      answer = String(total);
      hint = `A full turn is 360°. Find one of the ${n} equal angles, 360° ÷ ${n}, then count the shaded ones.`;
      explanation = [
        `A full turn around the center is 360°, so each of the ${n} equal angles is $360 \\div ${n} = ${each}$ degrees.`,
        `${k === 1 ? "1 angle is" : `${k} angles are`} shaded: $${k} \\times ${each} = ${total}$.`,
        `The shaded angle measures ${total}°.`,
      ];
      break;
    }
    case "angle-classify": {
      const kind = pick(r, ["acute", "right", "obtuse", "straight"] as const);
      const m =
        kind === "acute"
          ? 5 * r(5, 14)
          : kind === "right"
            ? 90
            : kind === "obtuse"
              ? 5 * r(22, 32)
              : 180;
      const d0 = 5 * r(0, 71);
      figure = sceneFigure(
        angle({
          rays: [d0, d0 + m],
          arrows: true,
          marks: [{ from: 0, to: 1, color: "warm" }],
        }).element(),
      );
      prompt = "What kind of angle is this?";
      hint = `One ray points ${heading(d0)}. Put the corner of a page on the vertex along that ray, and compare the other ray with the page's square corner.`;
      const describe = {
        acute: "smaller than a right angle",
        right: "exactly a square corner",
        obtuse: "wider than a right angle but less than a straight line",
        straight: "a straight line: the two rays point in opposite directions",
      };
      explanation = [
        `The opening is ${describe[kind]}.`,
        `So it is ${kind === "acute" || kind === "obtuse" ? "an" : "a"} ${kind} angle.`,
      ];
      choices = (["acute", "right", "obtuse", "straight"] as const).map((k) =>
        k === kind
          ? { label: k, correct: true }
          : {
              label: k,
              feedback: `${k === "acute" || k === "obtuse" ? "An" : "A"} ${k} angle is ${describe[k]}. This angle is ${describe[kind]}.`,
            },
      );
      keepOrder = true;
      break;
    }
    case "line-ray-segment": {
      const kind = pick(r, ["line", "ray", "segment"] as const);
      const [A, B] = pick(r, letters);
      const t = 5 * r(-6, 6);
      const [p, q] = place(
        [
          [-1.2, 0],
          [1.2, 0],
        ],
        t,
      ) as [Pt, Pt];
      // An arrow end continues past its point; a point end stops there.
      const ends =
        kind === "line"
          ? [true, true]
          : kind === "ray"
            ? [false, true]
            : [false, false];
      const past = (from: Pt, to: Pt): Pt => [
        to[0] + (to[0] - from[0]) * 0.45,
        to[1] + (to[1] - from[1]) * 0.45,
      ];
      figure = sceneFigure(
        {
          type: "segment",
          id: "figure",
          from: ends[0] ? past(q, p) : p,
          to: ends[1] ? past(p, q) : q,
          stroke: "ink",
          width: 3,
          ...(ends[0] && ends[1]
            ? { arrow: "both" as const }
            : ends[1]
              ? { arrow: "end" as const }
              : {}),
        },
        { type: "point", id: "point0", at: p, r: 5, color: "ink" },
        { type: "point", id: "point1", at: q, r: 5, color: "ink" },
        {
          type: "text",
          id: "name0",
          at: p,
          text: A,
          bold: true,
          place: [
            [0, -12, 0, 1],
            [0, 12, 0, -1],
          ],
        },
        {
          type: "text",
          id: "name1",
          at: q,
          text: B,
          bold: true,
          place: [
            [0, -12, 0, 1],
            [0, 12, 0, -1],
          ],
        },
      );
      prompt = "Which name matches this figure?";
      hint = `Look at the end past ${A} and the end past ${B}: does each stop at its point, or keep going with an arrow?`;
      const right =
        kind === "line"
          ? `line ${A}${B}`
          : kind === "ray"
            ? `ray ${A}${B}`
            : `line segment ${A}${B}`;
      explanation = [
        kind === "line"
          ? "Both ends have arrows: it goes on forever both ways."
          : kind === "ray"
            ? `It stops at ${A} and goes on forever past ${B}.`
            : `It stops at both ${A} and ${B}.`,
        `${kind === "line" ? "A line goes on both ways" : kind === "ray" ? "A ray starts at one point and goes on one way; it is named from its starting point" : "A line segment has two endpoints"}, so this is ${right}.`,
      ];
      const options: Choice[] = [
        {
          label: `line ${A}${B}`,
          feedback: "A line has arrows at both ends: it never stops.",
        },
        {
          label: `ray ${A}${B}`,
          feedback: `Ray ${A}${B} starts at ${A} and keeps going through ${B}: one point and one arrow.`,
        },
        {
          label: `line segment ${A}${B}`,
          feedback: `A line segment stops at both endpoints, with no arrows.`,
        },
      ];
      if (kind === "ray")
        options.push({
          label: `ray ${B}${A}`,
          feedback: `Ray ${B}${A} would start at ${B} and go on past ${A}. This ray starts at ${A}; a ray is named from its starting point.`,
        });
      choices = options.map((o) =>
        o.label === right ? { label: o.label, correct: true } : o,
      );
      break;
    }
    case "line-relationship": {
      const kind = pick(r, ["parallel", "perpendicular", "neither"] as const);
      const columns = 7,
        rows = 6;
      const inside = (p: Pt) =>
        p[0] >= 0 && p[0] <= columns - 1 && p[1] >= 0 && p[1] <= rows - 1;
      let pair: [[Pt, Pt], [Pt, Pt]];
      for (;;) {
        const [u, v] =
          kind === "parallel"
            ? (() => {
                const d = pick(r, [
                  [1, 0],
                  [0, 1],
                  [1, 1],
                  [2, 1],
                  [1, 2],
                  [1, -1],
                  [2, -1],
                ] as Pt[]);
                return [d, d] as [Pt, Pt];
              })()
            : kind === "perpendicular"
              ? (() => {
                  const d = pick(r, [
                    [1, 0],
                    [1, 1],
                    [2, 1],
                    [1, 2],
                  ] as Pt[]);
                  return [d, [-d[1], d[0]] as Pt] as [Pt, Pt];
                })()
              : pick(r, [
                  [
                    [1, 0],
                    [1, 1],
                  ],
                  [
                    [0, 1],
                    [1, 1],
                  ],
                  [
                    [1, 0],
                    [1, -1],
                  ],
                  [
                    [0, 1],
                    [1, -1],
                  ],
                  [
                    [1, 0],
                    [1, 2],
                  ],
                  [
                    [0, 1],
                    [2, 1],
                  ],
                ] as [Pt, Pt][]);
        const a: Pt = [r(1, columns - 2), r(1, rows - 2)];
        const b: Pt =
          kind === "parallel" ? [r(0, columns - 1), r(0, rows - 1)] : a;
        const line1: [Pt, Pt] = [
          [a[0] - u[0], a[1] - u[1]],
          [a[0] + u[0], a[1] + u[1]],
        ];
        const line2: [Pt, Pt] = [
          [b[0] - v[0], b[1] - v[1]],
          [b[0] + v[0], b[1] + v[1]],
        ];
        // Parallel lines must be distinct.
        const cross = (b[0] - a[0]) * u[1] - (b[1] - a[1]) * u[0];
        if (kind === "parallel" && cross === 0) continue;
        if ([...line1, ...line2].every(inside)) {
          pair = r(0, 1) ? [line1, line2] : [line2, line1];
          break;
        }
      }
      figure = sceneFigure(...linePair(columns, rows, pair));
      const step = ([p, q]: [Pt, Pt]) => {
        const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
        const k = g(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]));
        const dx = (q[0] - p[0]) / k,
          dy = (q[1] - p[1]) / k;
        if (dy === 0) return "straight across";
        if (dx === 0) return "straight up and down";
        return `across ${Math.abs(dx)} and ${dx * dy > 0 ? "up" : "down"} ${Math.abs(dy)} each step`;
      };
      prompt = "How are these two lines related?";
      hint = `Step along the dots. One line goes ${step(pair[0])}; the other goes ${step(pair[1])}. Lines with the same steps never meet; steps turned a quarter turn cross at a right angle.`;
      const describe = {
        parallel: "parallel: they go the same direction and never meet",
        perpendicular: "perpendicular: they cross at a right angle",
        neither: "neither: they cross, but not at a right angle",
      };
      explanation = [
        `One line goes ${step(pair[0])}; the other goes ${step(pair[1])}.`,
        `So the lines are ${describe[kind]}.`,
      ];
      choices = (["parallel", "perpendicular", "neither"] as const).map((k) =>
        k === kind
          ? { label: k, correct: true }
          : {
              label: k,
              feedback:
                k === "parallel"
                  ? "Parallel lines never meet. These lines go in different directions, so they cross."
                  : k === "perpendicular"
                    ? kind === "parallel"
                      ? "Perpendicular lines cross at a right angle. These lines never cross."
                      : "Perpendicular lines cross at a right angle. Check the corner where these cross with a square corner: it does not fit."
                    : kind === "parallel"
                      ? "These lines take the same steps, so they never meet: they are parallel."
                      : "These lines cross at a right angle: turn one line's steps a quarter turn and you get the other's.",
            },
      );
      keepOrder = true;
      break;
    }
    case "classify-triangle-angles": {
      const kind = pick(r, ["acute", "right", "obtuse"] as const);
      let a: number, b: number;
      if (kind === "right") {
        a = 90;
        b = 5 * r(6, 12);
      } else if (kind === "obtuse") {
        a = 5 * r(22, 28);
        b = 5 * r(4, Math.min(9, (175 - a) / 5 - 3));
      } else
        do {
          a = 5 * r(9, 14);
          b = 5 * r(9, 14);
        } while (180 - a - b > 70 || 180 - a - b < 45);
      const raw = triangle(a, b);
      const c = centroid(raw);
      const points = place(
        raw.map(([x, y]) => [x - c[0], y - c[1]] as Pt),
        5 * r(0, 71),
      );
      figure = sceneFigure(
        {
          type: "polygon",
          id: "triangle",
          points,
          fill: "accent-fill",
          stroke: "ink",
          width: 2.5,
        },
        ...rightMarks(points),
      );
      let longest = 0;
      points.forEach((p, i) => {
        const q = points[(i + 1) % 3]!,
          w = points[longest]!,
          v = points[(longest + 1) % 3]!;
        if (
          Math.hypot(q[0] - p[0], q[1] - p[1]) >
          Math.hypot(v[0] - w[0], v[1] - w[1])
        )
          longest = i;
      });
      const [p0, p1] = [points[longest]!, points[(longest + 1) % 3]!];
      const slope =
        Math.abs(Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) / deg) % 180;
      const runs =
        slope < 25 || slope > 155
          ? "runs mostly across"
          : slope > 65 && slope < 115
            ? "runs mostly up and down"
            : "runs on a slant";
      prompt = "Classify this triangle by its angles.";
      hint = `The largest angle is opposite the longest side, which ${runs}. Compare that angle with a right angle.`;
      explanation = [
        kind === "right"
          ? "The square mark shows one right angle."
          : kind === "obtuse"
            ? "Its largest angle is wider than a square corner."
            : "All three angles are smaller than a square corner.",
        `So it is ${kind === "right" ? "a right" : kind === "obtuse" ? "an obtuse" : "an acute"} triangle.`,
      ];
      choices = (["acute", "right", "obtuse"] as const).map((k) =>
        k === kind
          ? { label: `${k} triangle`, correct: true }
          : {
              label: `${k} triangle`,
              feedback:
                k === "right"
                  ? "A right triangle has one right angle, shown with a square mark. This triangle has none."
                  : k === "obtuse"
                    ? "An obtuse triangle has one angle wider than a right angle. Every angle here is a right angle or smaller."
                    : "An acute triangle has all three angles smaller than a right angle. One angle here is not.",
            },
      );
      keepOrder = true;
      break;
    }
    case "symmetry-line-count": {
      const shape = symmetric(r);
      const points = place(shape.points, pick(r, [0, 0, 15, 30, 45, 90]));
      figure = sceneFigure({
        type: "polygon",
        id: "shape",
        points,
        fill: "accent-fill",
        stroke: "ink",
        width: 2.5,
      });
      const n = points.length;
      prompt = "How many lines of symmetry does this shape have?";
      label = "Lines of symmetry";
      answer = String(shape.axes);
      hint =
        n % 2 === 0
          ? "Try folds through two opposite corners, and folds through the middles of two opposite sides. Count each fold whose halves match exactly."
          : "Try folds from each corner through the middle of the side across from it. Count each fold whose halves match exactly.";
      explanation = [
        shape.axes === 0
          ? `No fold of this ${shape.name} makes the two halves match.`
          : `Folding this ${shape.name} along ${shape.axes === 1 ? "its line" : `each of its ${shape.axes} lines`} of symmetry makes the halves match exactly; every other fold leaves a corner sticking out.`,
        `It has ${lines(shape.axes)} of symmetry.`,
      ];
      break;
    }
    case "symmetry-line-check": {
      let shape: ReturnType<typeof symmetric>;
      do shape = symmetric(r);
      while (shape.axes === 0 || shape.axes > 2);
      const turn = pick(r, [0, 0, 20, 30, 90]);
      const points = place(shape.points, turn);
      const c = centroid(points);
      const axis = shape.axis + turn;
      const xs = points.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]));
      const reach = Math.max(...xs) + 0.5;
      const line = (t: number, offset = 0) => {
        const ux = Math.cos(t * deg),
          uy = Math.sin(t * deg);
        const o: Pt = [c[0] - uy * offset, c[1] + ux * offset];
        return {
          a: [o[0] - ux * reach, o[1] - uy * reach] as Pt,
          b: [o[0] + ux * reach, o[1] + uy * reach] as Pt,
        };
      };
      const wrong = shuffle(
        r,
        [
          axis + 45,
          axis + 90,
          axis + 135,
          axis + 30,
          axis - 30,
          axis + 60,
        ].filter((t) => !mirrors(points, c, t)),
      );
      // A diagonal of a rectangle or rhombus is the classic false fold.
      const corner = points[0]!;
      const diagonal = Math.atan2(corner[1] - c[1], corner[0] - c[0]) / deg;
      const apart = (x: number, y: number) => {
        const d = Math.abs(norm(x) - norm(y)) % 180;
        return Math.min(d, 180 - d) > 8;
      };
      const useDiagonal =
        !mirrors(points, c, diagonal) && apart(diagonal, axis);
      const others = wrong.filter(
        (t) => apart(t, axis) && (!useDiagonal || apart(t, diagonal)),
      );
      const candidates = [
        { ...line(axis), ok: true, why: "" },
        ...(useDiagonal
          ? [
              {
                ...line(diagonal),
                ok: false,
                why: "through a corner and the middle, but the two halves are not mirror images",
              },
            ]
          : []),
        {
          ...line(axis, 0.6),
          ok: false,
          why: "in the right direction but off center: one side is bigger",
        },
        ...others.map((t) => ({
          ...line(t),
          ok: false,
          why: "through the middle, but the halves do not match when folded",
        })),
      ].slice(0, 4);
      const order = shuffle(r, candidates);
      const labels = ["A", "B", "C", "D"] as const;
      figure = sceneFigure(
        {
          type: "polygon",
          id: "shape",
          points,
          fill: "accent-fill",
          stroke: "ink",
          width: 2.5,
        },
        ...order.flatMap((l, i) => [
          {
            type: "segment" as const,
            id: `line${labels[i]}`,
            from: l.a,
            to: l.b,
            stroke: "warm" as const,
            width: 2.5,
            dash: "dash" as const,
          },
        ]),
        ...labelEnds(order).map(([end, out], i) => ({
          type: "text" as const,
          id: `name${labels[i]}`,
          at: end,
          text: labels[i]!,
          bold: true,
          color: "warm" as const,
          halo: true,
          // Beyond the end of the line, then to either side of it.
          place: [
            [
              out[0] * 14,
              -out[1] * 14,
              -Math.sign(Math.round(out[0] * 2)) as -1 | 0 | 1,
              Math.sign(Math.round(out[1] * 2)) as -1 | 0 | 1,
            ],
            [out[1] * 14, out[0] * 14, 0, 0],
            [-out[1] * 14, -out[0] * 14, 0, 0],
          ] as [number, number, -1 | 0 | 1, -1 | 0 | 1][],
        })),
      );
      const right = labels[order.findIndex((l) => l.ok)]!;
      prompt = "Which dashed line is a line of symmetry?";
      hint = `This shape has ${points.length} corners. Folded along a line of symmetry, each corner lands exactly on a corner, or on the fold itself.`;
      explanation = [
        `Fold along line ${right}: every corner lands on a matching corner, so the halves match exactly.`,
        `Line ${right} is a line of symmetry of the ${shape.name}.`,
      ];
      keepOrder = true;
      choices = order.map((l, i) =>
        l.ok
          ? { label: labels[i]!, correct: true }
          : { label: labels[i]!, feedback: `Line ${labels[i]} goes ${l.why}.` },
      );
      break;
    }
    default:
      throw new Error(`Missing angle generator: ${templateId}`);
  }
  let response: GeneratedProblem["public"]["response"] = {
    kind: "number",
    label,
  };
  let choiceFeedback: Record<string, string> | undefined;
  if (choices) {
    if (
      choices.filter((c) => c.correct).length !== 1 ||
      new Set(choices.map((c) => c.label)).size !== choices.length
    )
      throw new Error("Ambiguous choices");
    if (!keepOrder) shuffle(r, choices);
    choiceFeedback = {};
    response = {
      kind: "choice",
      label: "Choose one answer",
      options: choices.map((c, i) => {
        const id = `option-${"abcd"[i]}`;
        if (c.correct) answer = id;
        else choiceFeedback![id] = c.feedback!;
        return { id, label: c.label };
      }),
    };
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt,
      skillId: meta.skillId,
      response,
      figure,
    },
    answer,
    hint,
    explanation,
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
}
