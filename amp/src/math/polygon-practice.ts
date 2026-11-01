import { createHash } from "node:crypto";
import { geometryScene } from "./geometry-scenes.js";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { place, type Pt, type ShapeItem, type Solid } from "./shape-figures.js";
import {
  irregularPolygon,
  pick,
  posed,
  random,
  shuffle,
  type Rand,
} from "./shape-practice.js";

const definitions: [string, string, string, string, boolean][] = [
  [
    "name-polygon",
    "Name a polygon",
    "polygon-properties",
    "Name a triangle, quadrilateral, pentagon, hexagon or octagon by its sides, however irregular.",
    true,
  ],
  [
    "polygon-with-angles",
    "Find a number of angles",
    "polygon-properties",
    "Choose the polygon with a given number of angles.",
    true,
  ],
  [
    "solid-parts",
    "Faces, edges and vertices",
    "polygon-properties",
    "Count the faces, edges or vertices of a prism or pyramid, hidden ones included.",
    false,
  ],
  [
    "classify-quadrilateral",
    "The exact name of a quadrilateral",
    "quadrilateral-categories",
    "Choose the most exact name for a quadrilateral from its marked sides and angles.",
    true,
  ],
  [
    "find-quadrilateral",
    "Find the quadrilateral",
    "quadrilateral-categories",
    "Choose the square, rectangle or rhombus among near misses, or the quadrilateral that is none of them.",
    true,
  ],
  [
    "quadrilateral-names",
    "Every name for a shape",
    "shape-hierarchy",
    "Choose the list of every category a marked quadrilateral belongs to.",
    true,
  ],
  [
    "hierarchy-statement",
    "Shape categories",
    "shape-hierarchy",
    "Tell which statement about quadrilateral categories is always true.",
    true,
  ],
  [
    "inherited-property",
    "Properties pass down",
    "shape-hierarchy",
    "Use that a subcategory has every property of its category.",
    true,
  ],
];
export const polygonTemplates: readonly TemplateMetadata[] = definitions.map(
  ([id, title, skillId, description, choice]) => ({
    id,
    title,
    skillId,
    description,
    version: 1,
    gradeBand: skillId === "polygon-properties" ? "K–2" : "3–5",
    requiredFigureCapability: "scenes-v1",
    ...(choice
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
  }),
);

const polygonNames: Record<number, string> = {
  3: "triangle",
  4: "quadrilateral",
  5: "pentagon",
  6: "hexagon",
  8: "octagon",
};
const prefix: Record<number, string> = {
  3: "tri- means 3",
  4: "quadri- means 4",
  5: "penta- means 5",
  6: "hexa- means 6",
  8: "octa- means 8",
};
const series = (items: string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const An = (word: string) => `${/^[aeiou]/.test(word) ? "An" : "A"} ${word}`;
const an = (word: string) => `${/^[aeiou]/.test(word) ? "an" : "a"} ${word}`;

export type Quad =
  | "square"
  | "rectangle"
  | "rhombus"
  | "parallelogram"
  | "trapezoid"
  | "kite"
  | "irregular";
const deg = Math.PI / 180;
/** One quadrilateral of a kind, varied in proportion and angle. */
export function quad(r: Rand, kind: Quad, size = 2.4): Pt[] {
  switch (kind) {
    case "square": {
      const s = size * 0.78;
      return [
        [0, 0],
        [s, 0],
        [s, s],
        [0, s],
      ];
    }
    case "rectangle": {
      const h = size * pick(r, [0.45, 0.52, 0.6]);
      return [
        [0, 0],
        [size, 0],
        [size, h],
        [0, h],
      ];
    }
    case "rhombus": {
      const s = size * 0.72,
        t = pick(r, [55, 60, 65, 70]) * deg;
      return [
        [0, 0],
        [s, 0],
        [s + s * Math.cos(t), s * Math.sin(t)],
        [s * Math.cos(t), s * Math.sin(t)],
      ];
    }
    case "parallelogram": {
      const a = size * 0.8,
        b = size * pick(r, [0.42, 0.5]),
        t = pick(r, [55, 60, 65, 70]) * deg;
      return [
        [0, 0],
        [a, 0],
        [a + b * Math.cos(t), b * Math.sin(t)],
        [b * Math.cos(t), b * Math.sin(t)],
      ];
    }
    case "trapezoid": {
      const top = size * pick(r, [0.4, 0.5]),
        h = size * pick(r, [0.45, 0.55]),
        off = size * pick(r, [0.12, 0.2, 0.3]);
      return [
        [0, 0],
        [size, 0],
        [off + top, h],
        [off, h],
      ];
    }
    case "kite": {
      const a = size * 0.4,
        top = size * pick(r, [0.75, 0.85]),
        bottom = size * pick(r, [0.3, 0.36]);
      return [
        [0, -bottom],
        [a, 0],
        [0, top],
        [-a, 0],
      ];
    }
    case "irregular":
      for (;;) {
        const p = Array.from({ length: 4 }, (_, i) => {
          const t = (90 * i + r(-20, 20)) * deg,
            radius = size * (r(38, 55) / 100);
          return [radius * Math.cos(t), radius * Math.sin(t)] as Pt;
        });
        const side = (i: number) => {
          const a = p[i]!,
            b = p[(i + 1) % 4]!;
          return [b[0] - a[0], b[1] - a[1]] as const;
        };
        const len = (i: number) => Math.hypot(...side(i));
        const angle = (i: number, j: number) => {
          const [ax, ay] = side(i),
            [bx, by] = side(j);
          return (
            Math.acos(
              Math.max(
                -1,
                Math.min(1, (ax * bx + ay * by) / (len(i) * len(j))),
              ),
            ) / deg
          );
        };
        const lengths = [0, 1, 2, 3].map(len).sort((x, y) => x - y);
        const distinct = lengths.every(
          (l, i) => i === 0 || l > lengths[i - 1]! * 1.12,
        );
        const noParallel = [0, 1].every((i) => {
          const a = angle(i, i + 2);
          return a > 12 && a < 168;
        });
        const noRight = [0, 1, 2, 3].every(
          (i) => Math.abs(angle(i, (i + 1) % 4) - 90) > 10,
        );
        if (distinct && noParallel && noRight) return p;
      }
  }
}

/** Every category a quadrilateral belongs to, most exact first. */
export const quadNames: Record<Quad, string[]> = {
  square: ["square", "rectangle", "rhombus", "parallelogram", "quadrilateral"],
  rectangle: ["rectangle", "parallelogram", "quadrilateral"],
  rhombus: ["rhombus", "parallelogram", "quadrilateral"],
  parallelogram: ["parallelogram", "quadrilateral"],
  trapezoid: ["quadrilateral"],
  kite: ["quadrilateral"],
  irregular: ["quadrilateral"],
};
const describeQuad: Record<Quad, string> = {
  square: "4 right angles and 4 equal sides",
  rectangle: "4 right angles, but its sides are not all equal",
  rhombus: "4 equal sides, but no right angles",
  parallelogram:
    "2 pairs of parallel sides, but no right angles and sides not all equal",
  trapezoid: "only 1 pair of parallel sides",
  kite: "2 pairs of equal sides next to each other, and no parallel sides",
  irregular: "no equal sides, no parallel sides and no right angles",
};
/** What the grade 3 marks (right angles and equal sides) show. */
const markedQuad = (kind: Quad) =>
  kind === "square" || kind === "rectangle" || kind === "rhombus"
    ? describeQuad[kind]
    : "no right angles, and its 4 sides are not all equal";
const needs: Record<"square" | "rectangle" | "rhombus", string> = {
  square: "4 right angles and 4 equal sides",
  rectangle: "4 right angles",
  rhombus: "4 equal sides",
};

type Choice = { label: string; correct?: true; feedback?: string };
const turns = [0, 10, 20, 30, 45, 60, 90, 120, 150, 200, 250, 300];

/** Representative shapes for category statements: a statement "every X is
 * a Y" is false exactly when one of these is an X but not a Y. */
const categoryOf: Record<string, Quad[]> = {
  square: ["square"],
  rectangle: ["square", "rectangle"],
  rhombus: ["square", "rhombus"],
  parallelogram: ["square", "rectangle", "rhombus", "parallelogram"],
  quadrilateral: [
    "square",
    "rectangle",
    "rhombus",
    "parallelogram",
    "trapezoid",
    "kite",
    "irregular",
  ],
};
const every = (x: string, y: string) =>
  categoryOf[x]!.every((q) => categoryOf[y]!.includes(q));

export function generatePolygonProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = polygonTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown polygon template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = "",
    hint = "",
    label = "Answer",
    explanation: string[] = [],
    figure: SemanticFigure | undefined,
    choices: Choice[] | undefined,
    keepOrder = false;
  switch (templateId) {
    case "name-polygon": {
      const n = pick(r, [3, 4, 5, 6, 8]);
      const points = irregularPolygon(r, n);
      figure = {
        kind: "plane-shapes",
        items: [{ pieces: [{ type: "polygon", points }] }],
      };
      const others = shuffle(
        r,
        [3, 4, 5, 6, 8].filter((k) => k !== n),
      ).slice(0, 3);
      const shown = [n, ...others].sort((a, b) => a - b);
      prompt = "What kind of polygon is this?";
      hint = `Count the sides once around, starting from the highest corner. Then match the count: ${shown.map((k) => prefix[k]).join(", ")}.`;
      explanation = [
        `A polygon is a flat, closed shape made of straight sides. It is named by how many sides it has.`,
        `Going around once, the polygon has ${n} straight sides and ${n} angles.`,
        `A polygon with ${n} sides is ${an(polygonNames[n]!)}, even when its sides and angles are not equal.`,
      ];
      choices = [
        { label: polygonNames[n]!, correct: true },
        ...others.map((k) => ({
          label: polygonNames[k]!,
          feedback: `${An(polygonNames[k]!)} has ${k} sides. This polygon has ${n}: count once around from one corner.`,
        })),
      ];
      break;
    }
    case "polygon-with-angles": {
      const counts = shuffle(r, [3, 4, 5, 6, 7, 8]).slice(0, 4);
      const target = counts[r(0, 3)]!;
      const labels = ["A", "B", "C", "D"] as const;
      const items: ShapeItem[] = counts.map((n, i) => ({
        label: labels[i],
        pieces: [{ type: "polygon", points: irregularPolygon(r, n) }],
      }));
      figure = { kind: "plane-shapes", items };
      const right = labels[counts.indexOf(target)]!;
      prompt = `Which shape has exactly ${target} angles?`;
      hint = `An angle is where two sides meet. Count each shape's angles once around, and look for exactly ${target}.`;
      explanation = [
        `An angle is the corner where two sides meet, so a shape has as many angles as corners.`,
        `Counting the angles: ${counts.map((n, i) => `${labels[i]} has ${n}`).join(", ")}.`,
        `Shape ${right} has exactly ${target} angles.`,
      ];
      keepOrder = true;
      choices = counts.map((n, i) =>
        n === target
          ? { label: labels[i]!, correct: true }
          : {
              label: labels[i]!,
              feedback: `Shape ${labels[i]} has ${n} angles, not ${target}. Count each corner once as you go around.`,
            },
      );
      break;
    }
    case "solid-parts": {
      const kind = pick(r, [
        "cube",
        "rectangular prism",
        "triangular prism",
        "square pyramid",
      ] as const);
      const part = pick(r, ["faces", "edges", "vertices"] as const);
      const azimuth = pick(r, [20, 25, 30, 35, 40]);
      let solid: Solid, n: number;
      if (kind === "triangular prism") {
        n = 3;
        const base = place(
          [
            [-1.1, -0.65],
            [1.1, -0.65],
            [0, 1.25],
          ],
          azimuth + 180,
        );
        solid = {
          type: "prism",
          base: { type: "polygon", points: base },
          height: pick(r, [1.6, 2]),
        };
      } else {
        n = 4;
        const [l, w] =
          kind === "rectangular prism"
            ? [pick(r, [2.6, 3]), pick(r, [1.4, 1.6])]
            : [2, 2];
        const base = place(
          [
            [-l / 2, -w / 2],
            [l / 2, -w / 2],
            [l / 2, w / 2],
            [-l / 2, w / 2],
          ],
          azimuth,
        );
        solid = {
          type: kind === "square pyramid" ? "pyramid" : "prism",
          base: { type: "polygon", points: base },
          height:
            kind === "cube"
              ? 2
              : kind === "square pyramid"
                ? 2.2
                : pick(r, [1.4, 1.8]),
        };
      }
      figure = { kind: "solid-shape", solid };
      const pyramid = kind === "square pyramid";
      const count = pyramid
        ? { faces: n + 1, edges: 2 * n, vertices: n + 1 }[part]
        : { faces: n + 2, edges: 3 * n, vertices: 2 * n }[part];
      answer = String(count);
      label = `Number of ${part}`;
      prompt = `How many ${part} does this solid have? Dashed lines show edges hidden at the back.`;
      hint = {
        faces: pyramid
          ? "Count the flat base on the bottom, then the triangles that rise to the point, the hidden ones too."
          : "Count the 2 matching ends, then the flat sides that join them, the hidden ones too.",
        edges: pyramid
          ? "Count the edges around the base, then the edges that run up to the point, dashed ones included."
          : "Count the edges around the top, around the bottom, then the ones joining them, dashed ones included.",
        vertices: pyramid
          ? "Count the corners of the base, dashed ones included, then the point at the top."
          : "Count the corners of the top, then the corners of the bottom, dashed ones included.",
      }[part];
      const base =
        n === 3 ? "triangle" : kind === "cube" ? "square" : "rectangle";
      explanation = pyramid
        ? {
            faces: [
              `The base is a square: 1 face. Each of its ${n} edges has a triangle rising to the point: ${n} faces.`,
              `$1 + ${n} = ${count}$ faces.`,
            ],
            edges: [
              `${n} edges go around the base, and ${n} more run up to the point.`,
              `$${n} + ${n} = ${count}$ edges.`,
            ],
            vertices: [
              `The base has ${n} corners, and the point at the top is 1 more.`,
              `$${n} + 1 = ${count}$ vertices.`,
            ],
          }[part]
        : {
            faces: [
              `The top and bottom are matching ${base}s: 2 faces. Each of the ${n} edges of the base has a flat side above it: ${n} faces.`,
              `$2 + ${n} = ${count}$ faces.`,
            ],
            edges: [
              `${n} edges go around the top and ${n} around the bottom; ${n} more join them.`,
              `$${n} + ${n} + ${n} = ${count}$ edges.`,
            ],
            vertices: [
              `The top has ${n} corners and the bottom has ${n}.`,
              `$${n} + ${n} = ${count}$ vertices.`,
            ],
          }[part];
      explanation.unshift(
        {
          faces: "A face is a flat surface of the solid.",
          edges: "An edge is a line where two faces meet.",
          vertices:
            "A vertex is a corner, a point where edges meet. Vertices means more than one vertex.",
        }[part],
      );
      explanation.push(`The ${kind} has ${count} ${part}.`);
      break;
    }
    case "classify-quadrilateral": {
      const kind = pick(r, [
        "square",
        "square",
        "rectangle",
        "rectangle",
        "rhombus",
        "rhombus",
        "parallelogram",
        "trapezoid",
        "kite",
        "irregular",
      ] as const);
      const points = posed(quad(r, kind), pick(r, turns));
      figure = {
        kind: "plane-shapes",
        items: [{ pieces: [points], marks: "sides-angles" }],
      };
      const exact =
        quadNames[kind][0] === "parallelogram"
          ? "quadrilateral"
          : quadNames[kind][0]!;
      const rights = kind === "square" || kind === "rectangle" ? 4 : 0;
      prompt = "Which is the most exact name for this shape?";
      hint = `${rights === 4 ? "All 4 corners have right-angle marks" : "No corner has a right-angle mark"}. Now check the tick marks: are all 4 sides marked equal?`;
      explanation = [
        `A small square mark shows a right angle (a square corner). Matching tick marks show sides of equal length.`,
        `The marks show ${markedQuad(kind)}.`,
        exact === "square"
          ? "4 right angles make it a rectangle, and 4 equal sides make it a rhombus. A shape that is both is a square, the most exact name."
          : exact === "quadrilateral"
            ? "It is not a rectangle (no 4 right angles) and not a rhombus (sides not all equal), so the most exact of these names is quadrilateral."
            : exact === "rectangle"
              ? "4 right angles make it a rectangle. Its sides are not all equal, so it is not a square."
              : "4 equal sides make it a rhombus. Its angles are not right angles, so it is not a square.",
      ];
      const feedback: Record<string, string> = {
        square:
          kind === "rectangle"
            ? "A square needs 4 equal sides too. Here two sides are longer than the other two."
            : "A square needs 4 right angles and 4 equal sides. The marks do not show both.",
        rectangle:
          kind === "square"
            ? "This is a rectangle, but its 4 sides are also equal, so square is more exact."
            : "A rectangle needs 4 right angles. This shape has no right-angle marks.",
        rhombus:
          kind === "square"
            ? "This is a rhombus, but it also has 4 right angles, so square is more exact."
            : "A rhombus needs 4 equal sides. The tick marks do not show 4 equal sides.",
        quadrilateral:
          "It is a quadrilateral, but a more exact name fits: check the marks again.",
      };
      choices = ["square", "rectangle", "rhombus", "quadrilateral"].map((n) =>
        n === exact
          ? { label: n, correct: true }
          : { label: n, feedback: feedback[n]! },
      );
      break;
    }
    case "find-quadrilateral": {
      const target = pick(r, [
        "square",
        "rectangle",
        "rhombus",
        "none",
      ] as const);
      const kinds: Quad[] =
        target === "square"
          ? [
              "square",
              "rectangle",
              "rhombus",
              pick(r, ["parallelogram", "kite", "trapezoid"] as const),
            ]
          : target === "rectangle"
            ? [
                "rectangle",
                "rhombus",
                "parallelogram",
                pick(r, ["trapezoid", "kite"] as const),
              ]
            : target === "rhombus"
              ? ["rhombus", "rectangle", "parallelogram", "kite"]
              : [
                  pick(r, [
                    "parallelogram",
                    "trapezoid",
                    "kite",
                    "irregular",
                  ] as const),
                  "square",
                  "rectangle",
                  "rhombus",
                ];
      const goal = kinds[0]!;
      shuffle(r, kinds);
      const labels = ["A", "B", "C", "D"] as const;
      figure = {
        kind: "plane-shapes",
        items: kinds.map((k, i) => ({
          label: labels[i],
          pieces: [posed(quad(r, k, pick(r, [2.2, 2.6])), pick(r, turns))],
          marks: "sides-angles",
        })),
      };
      const right = labels[kinds.indexOf(goal)]!;
      if (target === "none") {
        prompt =
          "Which quadrilateral is not a square, a rectangle or a rhombus?";
        hint =
          "Cross out each shape with 4 right-angle marks or with all 4 sides marked equal. One shape is left.";
        explanation = [
          "A small square mark shows a right angle. Matching tick marks show equal sides.",
          "A rectangle has 4 right angles; a rhombus has 4 equal sides; a square has both.",
          `Shape ${right} has ${markedQuad(goal)}, so it is none of them. It is still a quadrilateral.`,
        ];
      } else {
        prompt = `Which shape is ${an(target)}?`;
        hint = `${An(target)} needs ${needs[target]}. Check each shape's marks for exactly that.`;
        explanation = [
          "A small square mark shows a right angle. Matching tick marks show equal sides.",
          `${An(target)} has ${needs[target]}.`,
          `Shape ${right} has ${markedQuad(goal)}, so it is the ${target}.`,
        ];
      }
      keepOrder = true;
      choices = kinds.map((k, i) =>
        k === goal
          ? { label: labels[i]!, correct: true }
          : {
              label: labels[i]!,
              feedback:
                target === "none"
                  ? `Shape ${labels[i]} is ${an(k)}: it has ${markedQuad(k)}.`
                  : `Shape ${labels[i]} has ${markedQuad(k)}. ${An(target)} needs ${needs[target]}.`,
            },
      );
      break;
    }
    case "quadrilateral-names": {
      const kind = pick(r, [
        "square",
        "rectangle",
        "rhombus",
        "parallelogram",
        "kite",
      ] as const);
      figure = {
        kind: "plane-shapes",
        items: [
          { pieces: [posed(quad(r, kind), pick(r, turns))], marks: "parallel" },
        ],
      };
      const order = [
        "square",
        "rectangle",
        "rhombus",
        "parallelogram",
        "quadrilateral",
      ];
      const list = (names: string[]) =>
        order.filter((n) => names.includes(n)).join(", ");
      const truth = quadNames[kind];
      const candidates: { names: string[]; why: string }[] = [];
      if (truth.length > 1)
        candidates.push({
          names: [truth[0]!],
          why: `${An(truth[0]!)} is also ${series(truth.slice(1).map(an))}: every name that fits belongs in the list.`,
        });
      for (const missing of truth.slice(1, -1))
        candidates.push({
          names: truth.filter((n) => n !== missing),
          why: `This list leaves out ${missing}. Every ${truth[0]} is ${an(missing)}.`,
        });
      for (const extra of order.filter((n) => !truth.includes(n)))
        candidates.push({
          names: [...truth, extra],
          why:
            extra === "square"
              ? "A square needs 4 right angles and 4 equal sides; this shape does not have both."
              : extra === "rectangle"
                ? "A rectangle needs 4 right angles; this shape has none."
                : extra === "rhombus"
                  ? "A rhombus needs 4 equal sides; this shape's sides are not all equal."
                  : "A parallelogram needs 2 pairs of parallel sides; this shape has none.",
        });
      const wrong = shuffle(r, candidates).slice(0, 3);
      const pairs = kind === "kite" ? 0 : 2;
      prompt = "Which list gives every name that fits this shape?";
      hint = `${pairs === 2 ? "2 pairs of parallel sides are marked, so start from parallelogram" : "No parallel sides are marked, so it is not a parallelogram"}. Then check the right-angle and tick marks for the more exact names.`;
      explanation = [
        `A shape can have more than one name: each name is a group, and a shape belongs to every group whose rules it meets.`,
        `The marks show ${describeQuad[kind]}.`,
        kind === "square"
          ? "4 right angles: a rectangle. 4 equal sides: a rhombus. Both: a square. Rectangles and rhombuses are parallelograms, and every parallelogram is a quadrilateral."
          : kind === "kite"
            ? "With no parallel sides it is not a parallelogram, so it is not a rectangle, rhombus or square either. It is a quadrilateral."
            : `${An(truth[0]!)} is a parallelogram, and every parallelogram is a quadrilateral.`,
        `Every name that fits: ${list(truth)}.`,
      ];
      choices = [
        { label: list(truth), correct: true },
        ...wrong.map((w) => ({ label: list(w.names), feedback: w.why })),
      ];
      break;
    }
    case "hierarchy-statement": {
      const names = [
        "square",
        "rectangle",
        "rhombus",
        "parallelogram",
        "quadrilateral",
      ];
      const pairs = names.flatMap((x) =>
        names.filter((y) => y !== x).map((y) => [x, y] as const),
      );
      const trueOnes = pairs.filter(([x, y]) => every(x, y));
      const falseOnes = pairs.filter(([x, y]) => !every(x, y) && every(y, x));
      const [tx, ty] = pick(r, trueOnes);
      const wrong = shuffle(
        r,
        falseOnes.filter(([x, y]) => !(x === ty && y === tx)),
      ).slice(0, 2);
      const converse = falseOnes.find(([x, y]) => x === ty && y === tx)!;
      const statements = [converse, ...wrong];
      prompt = "Which statement is always true?";
      const [cx, cy] = wrong[0]!;
      hint = `For each statement, try to picture ${an(cx)} that is not ${an(cy)}. If you can, that statement is false.`;
      explanation = [
        `Each shape name is a group with rules. One group sits inside another when its shapes always meet the bigger group's rules.`,
        `Every ${tx} has all the properties a ${ty} needs, so every ${tx} is ${an(ty)}.`,
        `The reverse is not true: not every ${ty} is ${an(tx)}.`,
        `The true statement: every ${tx} is ${an(ty)}.`,
      ];
      const counter = (x: string, y: string) => {
        const example = categoryOf[x]!.find(
          (q) => !categoryOf[y]!.includes(q),
        )!;
        const picture: Record<Quad, string> = {
          square: "a square",
          rectangle: "a long, thin rectangle",
          rhombus: "a slanted rhombus",
          parallelogram: "a slanted parallelogram with unequal sides",
          trapezoid: "a trapezoid",
          kite: "a kite",
          irregular: "a quadrilateral with no equal or parallel sides",
        };
        return `Not every ${x} is ${an(y)}: ${picture[example]} is ${an(x)} but not ${an(y)}.`;
      };
      choices = [
        { label: `Every ${tx} is ${an(ty)}.`, correct: true },
        ...statements.map(([x, y]) => ({
          label: `Every ${x} is ${an(y)}.`,
          feedback: counter(x, y),
        })),
      ];
      break;
    }
    case "inherited-property": {
      const rows = [
        {
          category: "parallelogram",
          property: "2 pairs of parallel sides",
          subs: ["rectangle", "rhombus", "square"],
          non: ["trapezoid", "kite", "quadrilateral"],
        },
        {
          category: "parallelogram",
          property: "opposite sides of equal length",
          subs: ["rectangle", "rhombus", "square"],
          non: ["trapezoid", "kite", "quadrilateral"],
        },
        {
          category: "rectangle",
          property: "4 right angles",
          subs: ["square"],
          non: ["rhombus", "parallelogram", "kite", "trapezoid"],
        },
        {
          category: "rhombus",
          property: "4 sides of equal length",
          subs: ["square"],
          non: ["rectangle", "parallelogram", "kite"],
        },
      ];
      const row = pick(r, rows);
      const sub = pick(r, row.subs);
      const non = shuffle(r, [...row.non]).slice(0, 3);
      prompt = `Every ${row.category} has ${row.property}. Which shape must also have ${row.property}?`;
      hint = `Any shape that is always ${an(row.category)} must have ${row.property}. Which choice is always ${an(row.category)}?`;
      explanation = [
        `A shape that always belongs to a group gets every property of that group.`,
        `Every ${sub} is ${an(row.category)}.`,
        `So every ${sub} has every property of ${an(row.category)}, including ${row.property}.`,
        `The shape that must have ${row.property} is the ${sub}.`,
      ];
      const why: Record<string, string> = {
        trapezoid:
          "A trapezoid can have just 1 pair of parallel sides, so it is not always a parallelogram.",
        kite: "A kite's equal sides are next to each other, not opposite, so it need not have this property.",
        quadrilateral:
          "A quadrilateral can be any 4-sided shape, so it need not have this property.",
        rhombus:
          "A rhombus need not have right angles, so it is not always a rectangle.",
        parallelogram: `A parallelogram can be slanted with unequal sides, so it is not always ${an(row.category)}.`,
        rectangle:
          "A rectangle can have two long sides and two short ones, so it is not always a rhombus.",
      };
      choices = [
        { label: sub, correct: true },
        ...non.map((n) => ({ label: n, feedback: why[n]! })),
      ];
      break;
    }
    default:
      throw new Error(`Missing polygon generator: ${templateId}`);
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
      ...(figure ? { figure: geometryScene(figure) } : {}),
    },
    answer,
    hint,
    explanation,
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
}
