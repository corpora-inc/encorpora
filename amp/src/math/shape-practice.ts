import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import {
  bounds,
  centroid,
  place,
  signedArea,
  type FlatShape,
  type Pt,
  type ShapeItem,
  type Solid,
} from "./shape-figures.js";

const definitions: [string, string, string, string, boolean][] = [
  [
    "name-flat-shape",
    "Name a flat shape",
    "name-shapes",
    "Name a circle, triangle, square, rectangle or hexagon in any orientation or size.",
    true,
  ],
  [
    "find-named-shape",
    "Find the named shape",
    "name-shapes",
    "Choose the one shape of a named kind among near misses.",
    true,
  ],
  [
    "name-solid-shape",
    "Name a solid shape",
    "name-shapes",
    "Name a cube, cone, cylinder or sphere, and tell it from a flat shape.",
    true,
  ],
  [
    "compose-shape-name",
    "Shapes put together",
    "compose-shapes",
    "Name the larger shape that smaller shapes make together.",
    true,
  ],
  [
    "complete-the-shape",
    "Complete the shape",
    "compose-shapes",
    "Choose the piece that fills the gap in a larger shape; pieces may be turned.",
    true,
  ],
  [
    "count-sides-corners",
    "Count sides and corners",
    "shape-attributes",
    "Count the sides or the corners of a closed straight-sided shape.",
    false,
  ],
  [
    "defining-attribute",
    "Defining attributes",
    "shape-attributes",
    "Tell a defining attribute of a shape from size, direction and proportion.",
    true,
  ],
];
export const shapeTemplates: readonly TemplateMetadata[] = definitions.map(
  ([id, title, skillId, description, choice]) => ({
    id,
    title,
    skillId,
    description,
    version: 1,
    gradeBand: "K–2",
    requiredFigureCapability: "shape-figures-v1",
    ...(choice
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
  }),
);

function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return lo + (value % span);
  };
}
type Rand = ReturnType<typeof random>;
const pick = <T>(r: Rand, list: readonly T[]) => list[r(0, list.length - 1)]!;
function shuffle<T>(r: Rand, list: T[]) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = r(0, i);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}
const SQRT3 = Math.sqrt(3);
const regular = (n: number, radius: number, start = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const t = ((start + (360 * i) / n) * Math.PI) / 180;
    return [radius * Math.cos(t), radius * Math.sin(t)] as Pt;
  });
/** Center a polygon on its vertex centroid, rotate and scale it. */
function posed(points: Pt[], degrees: number, scale = 1): FlatShape {
  const [cx, cy] = centroid(points);
  return {
    type: "polygon",
    points: place(
      points.map(([x, y]) => [(x - cx) * scale, (y - cy) * scale] as Pt),
      degrees,
    ),
  };
}
const circle = (radius: number): FlatShape => ({
  type: "ellipse",
  center: [0, 0],
  radii: [radius, radius],
  angle: 0,
});

type FlatName =
  | "circle"
  | "triangle"
  | "square"
  | "rectangle"
  | "hexagon"
  | "pentagon"
  | "octagon"
  | "rhombus"
  | "trapezoid"
  | "oval";
/** One shape of a kind, varied in proportion, at a chosen turn and size. */
function flat(r: Rand, name: FlatName, degrees: number, size: number) {
  const s = size;
  switch (name) {
    case "circle":
      return circle(s * 0.55);
    case "oval":
      return {
        type: "ellipse",
        center: [0, 0],
        radii: [s * 0.62, s * pick(r, [0.34, 0.38, 0.42])],
        angle: degrees % 180,
      } satisfies FlatShape;
    case "triangle": {
      const form = r(0, 3);
      const points: Pt[] =
        form === 0
          ? regular(3, s * 0.58, 90)
          : form === 1
            ? [
                [0, 0],
                [s, 0],
                [0, s * pick(r, [0.55, 0.7, 0.8])],
              ]
            : form === 2
              ? [
                  [0, 0],
                  [s * 0.7, 0],
                  [s * 0.35, s * pick(r, [0.95, 1.05])],
                ]
              : [
                  [0, 0],
                  [s, 0],
                  [s * pick(r, [0.2, 0.7]), s * 0.62],
                ];
      return posed(points, degrees);
    }
    case "square":
      return posed(
        [
          [0, 0],
          [s * 0.8, 0],
          [s * 0.8, s * 0.8],
          [0, s * 0.8],
        ],
        degrees,
      );
    case "rectangle": {
      const h = s * pick(r, [0.4, 0.45, 0.55]);
      return posed(
        [
          [0, 0],
          [s, 0],
          [s, h],
          [0, h],
        ],
        degrees,
      );
    }
    case "hexagon":
    case "pentagon":
    case "octagon": {
      const n = name === "hexagon" ? 6 : name === "pentagon" ? 5 : 8;
      // A pentagon stands on a side; hexagons and octagons have a flat bottom.
      return posed(
        regular(n, s * 0.55, n === 5 ? 90 : n === 6 ? 0 : 22.5),
        degrees,
      );
    }
    case "rhombus": {
      const a = s * 0.55,
        b = s * pick(r, [0.3, 0.34]);
      return posed(
        [
          [a, 0],
          [0, b],
          [-a, 0],
          [0, -b],
        ],
        degrees,
      );
    }
    case "trapezoid": {
      const top = s * pick(r, [0.4, 0.5]);
      return posed(
        [
          [0, 0],
          [s, 0],
          [(s + top) / 2, s * 0.5],
          [(s - top) / 2, s * 0.5],
        ],
        degrees,
      );
    }
  }
}
const turns = [0, 15, 20, 30, 45, 60, 75, 90, 105, 135, 150, 165, 180, 200];
const article = (word: string) => (/^[aeiou]/.test(word) ? "an" : "a");
/** "A square", "An oval": the sentence-initial article and noun. */
const An = (word: string) => `${/^[aeiou]/.test(word) ? "An" : "A"} ${word}`;
const sides: Record<FlatName, string> = {
  circle: "one curved edge and no corners",
  oval: "one curved edge and no corners",
  triangle: "3 straight sides and 3 corners",
  square: "4 equal straight sides and 4 square corners",
  rectangle: "4 straight sides and 4 square corners",
  hexagon: "6 straight sides and 6 corners",
  pentagon: "5 straight sides and 5 corners",
  octagon: "8 straight sides and 8 corners",
  rhombus: "4 equal straight sides",
  trapezoid: "4 straight sides",
};

/** Edge-to-edge compositions in exact unit coordinates, counterclockwise. */
type Design = { result: FlatName; outline: Pt[]; pieces: Pt[][] };
function designs(): Design[] {
  const h = SQRT3 / 2;
  const hex = regular(6, 1);
  const tri = (a: Pt, b: Pt, c: Pt) => [a, b, c];
  return [
    {
      result: "square",
      outline: [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
      pieces: [tri([0, 0], [2, 0], [2, 2]), tri([0, 0], [2, 2], [0, 2])],
    },
    {
      result: "rectangle",
      outline: [
        [0, 0],
        [3, 0],
        [3, 2],
        [0, 2],
      ],
      pieces: [tri([0, 0], [3, 0], [3, 2]), tri([0, 0], [3, 2], [0, 2])],
    },
    {
      result: "rectangle",
      outline: [
        [0, 0],
        [4, 0],
        [4, 2],
        [0, 2],
      ],
      pieces: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
        [
          [2, 0],
          [4, 0],
          [4, 2],
          [2, 2],
        ],
      ],
    },
    {
      result: "square",
      outline: [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
      pieces: [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([x, y]) => [
        [x!, y!],
        [x! + 1, y!],
        [x! + 1, y! + 1],
        [x!, y! + 1],
      ]),
    },
    {
      result: "square",
      outline: [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
      pieces: [
        tri([0, 0], [2, 0], [1, 1]),
        tri([2, 0], [2, 2], [1, 1]),
        tri([2, 2], [0, 2], [1, 1]),
        tri([0, 2], [0, 0], [1, 1]),
      ],
    },
    {
      result: "triangle",
      outline: [
        [0, 0],
        [2, 0],
        [1, 2 * h],
      ],
      pieces: [
        tri([0, 0], [1, 0], [0.5, h]),
        tri([1, 0], [2, 0], [1.5, h]),
        tri([0.5, h], [1.5, h], [1, 2 * h]),
        tri([1, 0], [1.5, h], [0.5, h]),
      ],
    },
    {
      result: "hexagon",
      outline: hex,
      pieces: hex.map((v, i) => tri([0, 0], v, hex[(i + 1) % 6]!)),
    },
    {
      result: "hexagon",
      outline: hex,
      pieces: [
        [hex[0]!, hex[1]!, hex[2]!, hex[3]!],
        [hex[3]!, hex[4]!, hex[5]!, hex[0]!],
      ],
    },
    {
      result: "hexagon",
      outline: hex,
      pieces: [0, 2, 4].map((i) => [
        [0, 0] as Pt,
        hex[i]!,
        hex[(i + 1) % 6]!,
        hex[(i + 2) % 6]!,
      ]),
    },
    {
      result: "triangle",
      outline: [
        [-1.5, 0],
        [1.5, 0],
        [0, 2],
      ],
      pieces: [tri([-1.5, 0], [0, 0], [0, 2]), tri([0, 0], [1.5, 0], [0, 2])],
    },
    {
      result: "square",
      outline: [
        [0, 0],
        [3, 0],
        [3, 3],
        [0, 3],
      ],
      pieces: [0, 1, 2].map((y) => [
        [0, y],
        [3, y],
        [3, y + 1],
        [0, y + 1],
      ]),
    },
    {
      result: "square",
      outline: [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
      pieces: [
        [
          [0, 0],
          [1, 0],
          [1, 2],
          [0, 2],
        ],
        [
          [1, 0],
          [2, 0],
          [2, 2],
          [1, 2],
        ],
      ],
    },
  ];
}
/** The kind of a single piece, for naming pieces in feedback. */
function pieceName(points: Pt[]): string {
  if (points.length === 3) return "triangle";
  if (points.length === 6) return "hexagon";
  const d = points.map((p, i) => {
    const q = points[(i + 1) % points.length]!;
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  const equal = d.every((x) => Math.abs(x - d[0]!) < 1e-9);
  const [a, b, c] = points as [Pt, Pt, Pt];
  const right =
    Math.abs((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) <
    1e-9;
  return right
    ? equal
      ? "square"
      : "rectangle"
    : equal
      ? "rhombus"
      : "trapezoid";
}
function poseDesign(points: Pt[][], center: Pt, degrees: number): Pt[][] {
  return points.map((piece) =>
    place(
      piece.map(([x, y]) => [x - center[0], y - center[1]] as Pt),
      degrees,
    ),
  );
}
const polygonShape = (points: Pt[]): FlatShape => ({ type: "polygon", points });

/** Congruence by matching cyclic side-and-turn sequences, optionally mirrored. */
function congruent(a: Pt[], b: Pt[], mirror: boolean) {
  if (a.length !== b.length) return false;
  const signature = (p: Pt[]) =>
    p.map((v, i) => {
      const w = p[(i + 1) % p.length]!,
        u = p[(i + p.length - 1) % p.length]!;
      const len = Math.hypot(w[0] - v[0], w[1] - v[1]);
      const turn = Math.atan2(
        (v[0] - u[0]) * (w[1] - v[1]) - (v[1] - u[1]) * (w[0] - v[0]),
        (v[0] - u[0]) * (w[0] - v[0]) + (v[1] - u[1]) * (w[1] - v[1]),
      );
      return [len, turn] as const;
    });
  const sa = signature(a);
  const options = [signature(b)];
  if (mirror)
    options.push(signature([...b].reverse().map(([x, y]) => [-x, y])));
  return options.some((sb) =>
    sb.some((_, k) =>
      sa.every(
        ([l, t], i) =>
          Math.abs(l - sb[(i + k) % sb.length]![0]) < 1e-3 &&
          Math.abs(t - sb[(i + k) % sb.length]![1]) < 1e-3,
      ),
    ),
  );
}

type Choice = { label: string; correct?: true; feedback?: string };
type Attribute = "equal-sides" | "flat-bottom" | "taller" | "wider";
const attributeText: Record<Attribute, string> = {
  "equal-sides": "All of its sides are the same length.",
  "flat-bottom": "It has a side that lies flat along the bottom.",
  taller: "It is taller than it is wide.",
  wider: "It is wider than it is tall.",
};
function holds(attribute: Attribute, points: Pt[]) {
  const b = bounds([polygonShape(points)]);
  const w = b.maxX - b.minX,
    h = b.maxY - b.minY;
  switch (attribute) {
    case "equal-sides": {
      const d = points.map((p, i) => {
        const q = points[(i + 1) % points.length]!;
        return Math.hypot(q[0] - p[0], q[1] - p[1]);
      });
      return d.every((x) => Math.abs(x - d[0]!) < 1e-3);
    }
    case "flat-bottom":
      return points.some((p, i) => {
        const q = points[(i + 1) % points.length]!;
        return Math.abs(p[1] - b.minY) < 1e-3 && Math.abs(q[1] - b.minY) < 1e-3;
      });
    case "taller":
      return h > w;
    case "wider":
      return w > h;
  }
}

export function generateShapeProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = shapeTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown shape template ${templateId}`);
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
    case "name-flat-shape": {
      const names: FlatName[] = [
        "circle",
        "triangle",
        "square",
        "rectangle",
        "hexagon",
      ];
      const target = pick(r, names);
      const shape = flat(r, target, pick(r, turns), 3);
      figure = { kind: "plane-shapes", items: [{ pieces: [shape] }] };
      prompt = "What is the name of this shape?";
      hint = {
        circle:
          "Run your eye along the edge. Is any part of it straight, or is there a corner?",
        triangle:
          "Count the corners. Turning the shape does not change how many there are.",
        square:
          "Compare the 4 sides: are they all the same length? Then check that every corner is like the corner of a page.",
        rectangle:
          "Compare the 4 sides: are two of them longer than the other two? Then check that every corner is like the corner of a page.",
        hexagon:
          "Count the straight sides once around. Turning the shape does not change the count.",
      }[target as "circle" | "triangle" | "square" | "rectangle" | "hexagon"];
      explanation = [
        `The shape has ${sides[target]}.`,
        `A shape with ${sides[target]} is ${article(target)} ${target}, whichever way it is turned.`,
      ];
      // A square is also a rectangle, so a square never offers "rectangle".
      const others = names.filter(
        (n) => n !== target && !(target === "square" && n === "rectangle"),
      );
      choices = [
        { label: target, correct: true },
        ...shuffle(r, others)
          .slice(0, 3)
          .map((n) => ({
            label: n,
            feedback:
              n === "square" && target === "rectangle"
                ? `This shape has 4 square corners, but two of its sides are longer than the other two. A square has 4 equal sides, so this is a rectangle.`
                : `${An(n)} has ${sides[n]}. This shape has ${sides[target]}, so it is ${article(target)} ${target}.`,
          })),
      ];
      break;
    }
    case "find-named-shape": {
      const target = pick(r, [
        "triangle",
        "square",
        "rectangle",
        "hexagon",
        "circle",
      ] as const);
      const nearMisses: Record<typeof target, FlatName[]> = {
        triangle: ["square", "pentagon", "rhombus", "trapezoid", "circle"],
        square: ["rectangle", "rhombus", "trapezoid", "hexagon", "triangle"],
        rectangle: ["rhombus", "trapezoid", "hexagon", "triangle", "oval"],
        hexagon: ["pentagon", "octagon", "rhombus", "triangle"],
        circle: ["oval", "hexagon", "octagon", "square"],
      };
      // The closest near miss always appears; it is the one that teaches.
      const [closest, ...rest] = nearMisses[target];
      const kinds: FlatName[] = shuffle(r, [
        target,
        closest!,
        ...shuffle(r, rest).slice(0, 2),
      ]);
      const labels = ["A", "B", "C", "D"] as const;
      const items: ShapeItem[] = kinds.map((k, i) => ({
        label: labels[i],
        pieces: [flat(r, k, pick(r, turns), pick(r, [2.2, 2.6, 3]))],
      }));
      figure = { kind: "plane-shapes", items };
      const right = labels[kinds.indexOf(target)]!;
      prompt = `Which shape is ${article(target)} ${target}?`;
      hint = `${An(target)} has ${sides[target]}. Check each shape for exactly that.`;
      explanation = [
        `${An(target)} has ${sides[target]}.`,
        `Shape ${right} has ${sides[target]}, so shape ${right} is the ${target}. Its size and the way it is turned do not matter.`,
      ];
      keepOrder = true;
      const why = (k: FlatName, l: string) => {
        if (target === "square" && k === "rectangle")
          return `Shape ${l} has 4 square corners, but two of its sides are longer than the other two. A square's 4 sides are all the same length.`;
        if (target === "square" && k === "rhombus")
          return `Shape ${l} has 4 equal sides, but its corners are not square corners. A square needs both.`;
        if (target === "rectangle" && k === "rhombus")
          return `Shape ${l} has 4 sides, but its corners are not square corners. A rectangle has 4 square corners.`;
        if (target === "circle" && k === "oval")
          return `Shape ${l} is stretched: it is longer one way than the other. A circle is the same distance across every way.`;
        if (
          k === "trapezoid" &&
          (target === "square" || target === "rectangle")
        )
          return `Shape ${l} has 4 sides, but its corners are not square corners. ${target === "square" ? "A square" : "A rectangle"} has 4 square corners.`;
        return `Shape ${l} has ${sides[k]}. ${An(target)} has ${sides[target]}.`;
      };
      choices = kinds.map((k, i) =>
        k === target
          ? { label: labels[i]!, correct: true }
          : { label: labels[i]!, feedback: why(k, labels[i]!) },
      );
      break;
    }
    case "name-solid-shape": {
      const target = pick(r, ["cube", "cone", "cylinder", "sphere"] as const);
      const flatTwin = {
        cube: "square",
        cone: "triangle",
        cylinder: "circle",
        sphere: "circle",
      }[target];
      let solid: Solid;
      if (target === "sphere") solid = { type: "sphere", radius: 1.5 };
      else if (target === "cube") {
        const s = 2;
        const base = place(
          [
            [-s / 2, -s / 2],
            [s / 2, -s / 2],
            [s / 2, s / 2],
            [-s / 2, s / 2],
          ],
          pick(r, [20, 25, 30, 35, 40, 50, 55, 60]),
        );
        solid = {
          type: "prism",
          base: { type: "polygon", points: base },
          height: s,
        };
      } else {
        const radius = pick(r, [0.9, 1, 1.2]),
          height = pick(r, target === "cone" ? [2.2, 2.6, 3] : [1.6, 2.2, 2.8]);
        solid = {
          type: target === "cone" ? "pyramid" : "prism",
          base: {
            type: "ellipse",
            center: [0, 0],
            radii: [radius, radius],
            angle: 0,
          },
          height,
        };
      }
      figure = { kind: "solid-shape", solid };
      const describe = {
        cube: "6 flat square faces, all the same size",
        cone: "a flat circle at the bottom, a curved surface and one point at the top",
        cylinder:
          "two flat circles, one at each end, joined by a curved surface",
        sphere: "one curved surface and no flat faces or corners",
      };
      prompt = "What is the name of this solid shape?";
      hint = {
        cube: "This shape is solid, not flat. Look at its flat faces: what shape is each one, and are they all the same size?",
        cone: "This shape is solid, not flat. Look at the top: does it come to a point? What flat face is at the bottom?",
        cylinder:
          "This shape is solid, not flat. Look at both ends: what flat face is at each end, and is the side flat or curved?",
        sphere:
          "This shape is solid, not flat. Look for a flat face or an edge anywhere on it.",
      }[target];
      explanation = [
        `This shape is solid, not flat. It has ${describe[target]}.`,
        `A solid with ${describe[target]} is ${article(target)} ${target}.`,
      ];
      const otherSolids = (
        ["cube", "cone", "cylinder", "sphere"] as const
      ).filter((s) => s !== target);
      choices = [
        { label: target, correct: true },
        {
          label: flatTwin,
          feedback: `${An(flatTwin)} is flat, like a drawing on paper. This shape is solid, something you can pick up and hold: it is ${article(target)} ${target}.`,
        },
        ...shuffle(r, [...otherSolids])
          .slice(0, 2)
          .map((s) => ({
            label: s,
            feedback: `${An(s)} has ${describe[s]}. This shape has ${describe[target]}, so it is ${article(target)} ${target}.`,
          })),
      ];
      break;
    }
    case "compose-shape-name": {
      const all = designs();
      const design = pick(r, all);
      const center = centroid(design.outline);
      const pieces = poseDesign(
        design.pieces,
        center,
        pick(r, [0, 0, 15, 30, 45, 90]),
      );
      figure = {
        kind: "plane-shapes",
        items: [{ pieces: pieces.map(polygonShape) }],
      };
      const each = pieceName(design.pieces[0]!);
      const same = design.pieces.every((p) => pieceName(p) === each);
      const n = design.pieces.length;
      const known = ["triangle", "square", "rectangle"].includes(each);
      const partWord = same && known ? `${n} ${each}s` : `${n} pieces`;
      const result = design.result;
      prompt = `These ${partWord} are put together with no gaps or overlaps. What shape do they make?`;
      hint = `Trace only the outside edge of all ${n} pieces together, skipping the seams inside. Count its straight sides and corners.`;
      const outside = sides[result];
      explanation = [
        `Ignore the lines inside. Around the outside there are ${outside}.`,
        `So the ${partWord} make ${article(result)} ${result}.`,
      ];
      const names: FlatName[] = ["triangle", "square", "rectangle", "hexagon"];
      choices = names
        .filter((n2) => !(result === "square" && n2 === "rectangle"))
        .map((n2) =>
          n2 === result
            ? { label: n2, correct: true }
            : {
                label: n2,
                feedback:
                  n2 === each
                    ? `Each piece is ${article(each)} ${each}, but together they make a new shape. Trace around the outside: it has ${outside}, so it is ${article(result)} ${result}.`
                    : result === "rectangle" && n2 === "square"
                      ? `The outside has 4 square corners, but two of its sides are longer than the other two. That is a rectangle, not a square.`
                      : `${An(n2)} has ${sides[n2]}. The outside edge has ${outside}: ${article(result)} ${result}.`,
              },
        );
      break;
    }
    case "complete-the-shape": {
      // Long thin pieces would shrink the shared drawing scale; leave them out.
      const all = designs().filter((d) =>
        d.pieces.every((piece) => {
          const b = bounds([polygonShape(piece)]);
          const w = b.maxX - b.minX,
            h = b.maxY - b.minY;
          return Math.max(w, h) / Math.min(w, h) <= 2;
        }),
      );
      const design = pick(r, all);
      const gapIndex = r(0, design.pieces.length - 1);
      const center = centroid(design.outline);
      const turn = pick(r, [0, 0, 30, 90]);
      const [outline] = poseDesign([design.outline], center, turn);
      const posedPieces = poseDesign(design.pieces, center, turn);
      const gap = design.pieces[gapIndex]!;
      const gapCenter = centroid(gap);
      const local = gap.map(
        ([x, y]) => [x - gapCenter[0], y - gapCenter[1]] as Pt,
      );
      const area = Math.abs(signedArea(local));
      const scale = (k: number) => local.map(([x, y]) => [x * k, y * k] as Pt);
      // Stretch along the first side: the same kind of piece, the wrong shape.
      const [p0, p1] = local as [Pt, Pt];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const ux = (p1[0] - p0[0]) / len,
        uy = (p1[1] - p0[1]) / len;
      const stretch = local.map(([x, y]) => {
        const along = x * ux + y * uy;
        return [x + along * 0.5 * ux, y + along * 0.5 * uy] as Pt;
      });
      // A triangle gap is offered a triangle with the wrong corners on the
      // same first side; a four-sided gap is offered half of itself.
      const side = { x: p1[0] - p0[0], y: p1[1] - p0[1] };
      const third = local[2]!;
      const toward =
        side.x * (third[1] - p0[1]) - side.y * (third[0] - p0[0]) > 0 ? 1 : -1;
      const normal = { x: -side.y * toward, y: side.x * toward };
      const equilateral = local.length === 3 && holds("equal-sides", local);
      const other: Pt[] =
        local.length === 3
          ? [
              p0,
              p1,
              equilateral
                ? [p0[0] + normal.x, p0[1] + normal.y]
                : [
                    (p0[0] + p1[0]) / 2 + (normal.x * SQRT3) / 2,
                    (p0[1] + p1[1]) / 2 + (normal.y * SQRT3) / 2,
                  ],
            ]
          : [local[0]!, local[1]!, local[2]!];
      const gapName = pieceName(gap);
      const wrong: [Pt[], string][] = [
        [
          scale(area > 0.9 ? 0.5 : 0.6),
          `is the right kind of piece but the wrong size. The gap needs a piece exactly as big as the empty space.`,
        ],
        [
          stretch,
          `is stretched: its sides do not match the edges of the empty space.`,
        ],
        [
          other,
          local.length === 3
            ? `is a triangle, but its corners do not match the corners of the empty space.`
            : `is only half of the piece the gap needs.`,
        ],
      ];
      // Three candidates: the piece, and two of the three telling errors.
      const pieces = shuffle(r, [
        { points: local, ok: true, note: "" },
        ...shuffle(r, wrong)
          .slice(0, 2)
          .map(([points, note]) => ({ points, ok: false, note })),
      ]);
      for (const p of pieces)
        if (!p.ok && congruent(p.points, local, true))
          throw new Error("A wrong candidate matches the gap");
      const labels = ["A", "B", "C"] as const;
      const candidates: ShapeItem[] = pieces.map((p, i) => ({
        label: labels[i],
        pieces: [
          polygonShape(
            place(
              p.points.map(([x, y]) => [x, y] as Pt),
              p.ok ? pick(r, [90, 180, 270]) : pick(r, [0, 90, 180]),
            ),
          ),
        ],
      }));
      figure = {
        kind: "shape-puzzle",
        outline: outline!,
        placed: posedPieces.filter((_, i) => i !== gapIndex).map(polygonShape),
        candidates,
      };
      const right = labels[pieces.findIndex((p) => p.ok)]!;
      prompt = `Which piece fills the empty space to complete the ${design.result}? A piece may be turned.`;
      hint = `The empty space has ${local.length} sides. Find the piece with ${local.length} sides of the same lengths, then check it is not bigger, smaller or stretched.`;
      explanation = [
        `The empty space is ${article(gapName)} ${gapName}.`,
        `Piece ${right} is the same ${gapName}, turned. It fits the gap exactly and completes the ${design.result}.`,
      ];
      keepOrder = true;
      choices = pieces.map((p, i) =>
        p.ok
          ? { label: labels[i]!, correct: true }
          : { label: labels[i]!, feedback: `Piece ${labels[i]} ${p.note}` },
      );
      break;
    }
    case "count-sides-corners": {
      const n = r(3, 8);
      let points: Pt[];
      for (;;) {
        const concave = n >= 5 && r(0, 2) === 0;
        const raw = Array.from({ length: n }, (_, i) => {
          const t =
            ((360 * i) / n + r(-12, 12) * (n <= 4 ? 1 : 0.6)) * (Math.PI / 180);
          const radius =
            concave && i % 2 === 1 ? r(45, 58) / 100 : r(80, 100) / 100;
          return [1.6 * radius * Math.cos(t), 1.6 * radius * Math.sin(t)] as Pt;
        });
        points = place(raw, r(0, 359));
        // Every corner must turn visibly and every side must be visible.
        const ok = points.every((v, i) => {
          const u = points[(i + n - 1) % n]!,
            w = points[(i + 1) % n]!;
          const a = [v[0] - u[0], v[1] - u[1]],
            b = [w[0] - v[0], w[1] - v[1]];
          const la = Math.hypot(a[0]!, a[1]!),
            lb = Math.hypot(b[0]!, b[1]!);
          const sin = Math.abs(a[0]! * b[1]! - a[1]! * b[0]!) / (la * lb);
          const cos = (a[0]! * b[0]! + a[1]! * b[1]!) / (la * lb);
          return lb > 0.55 && (sin > Math.sin((24 * Math.PI) / 180) || cos < 0);
        });
        if (ok) break;
      }
      figure = {
        kind: "plane-shapes",
        items: [{ pieces: [polygonShape(points)] }],
      };
      const corners = r(0, 1) === 1;
      prompt = corners
        ? "How many corners, or vertices, does this shape have?"
        : "How many sides does this shape have?";
      label = corners ? "Number of corners" : "Number of sides";
      answer = String(n);
      // A shape with a corner pointing inward gets a hint about that corner.
      const inward = points.some((v, i) => {
        const u = points[(i + n - 1) % n]!,
          w = points[(i + 1) % n]!;
        return (
          (v[0] - u[0]) * (w[1] - v[1]) - (v[1] - u[1]) * (w[0] - v[0]) < 0
        );
      });
      hint = `Start at the highest corner and ${corners ? "touch each corner" : "trace each side"} once as you go around; stop when you are back at the start.${inward ? " Corners that point inward count too." : ""}`;
      explanation = [
        `Going around the shape once, there are ${n} straight sides.`,
        `Each side ends at a corner, so a closed shape has as many corners as sides: ${n}.`,
        corners ? `The shape has ${n} corners.` : `The shape has ${n} sides.`,
      ];
      break;
    }
    case "defining-attribute": {
      const category = pick(r, ["triangle", "rectangle", "hexagon"] as const);
      // Turned so that every side is at least 15° from level: no flat bottom.
      const tilt = -pick(r, [20, 25, 30]);
      // Three members that disagree on every non-defining attribute.
      const members: Pt[][] =
        category === "triangle"
          ? [
              regular(3, 1.2, 90),
              [
                [0, 0],
                [2.6, 0],
                [0, pick(r, [1.3, 1.5])],
              ],
              [
                [0, 0],
                [1.4, 0],
                [0.7, pick(r, [2.6, 2.9])],
              ],
            ]
          : category === "rectangle"
            ? [
                [
                  [0, 0],
                  [2.8, 0],
                  [2.8, 1.3],
                  [0, 1.3],
                ],
                [
                  [0, 0],
                  [1.1, 0],
                  [1.1, 2.6],
                  [0, 2.6],
                ],
                [
                  [0, 0],
                  [2.2, 0],
                  [2.2, 0.8],
                  [0, 0.8],
                ],
              ]
            : [
                regular(6, 1.25, 0),
                regular(6, 1.25, 30),
                regular(6, 1.2, 0).map(([x, y]) => [x * 1.45, y * 0.85] as Pt),
              ];
      const shapes = members.map((m, i) =>
        posed(
          m,
          // The second member is turned off every flat position.
          i === 1 && category !== "hexagon" ? tilt : 0,
        ),
      );
      const pts = shapes.map((s) => (s as { points: Pt[] }).points);
      const order = shuffle(r, [0, 1, 2]);
      const labels = ["A", "B", "C"] as const;
      const items: ShapeItem[] = order.map((k, i) => ({
        label: labels[i],
        pieces: [shapes[k]!],
      }));
      figure = { kind: "plane-shapes", items };
      const ordered = order.map((k) => pts[k]!);
      const defining =
        category === "triangle"
          ? "It has exactly 3 straight sides and 3 corners."
          : category === "rectangle"
            ? "It has 4 straight sides and 4 square corners."
            : "It has exactly 6 straight sides and 6 corners.";
      const wrong = shuffle(r, [
        "equal-sides",
        "flat-bottom",
        "taller",
        "wider",
      ] as Attribute[]).slice(0, 3);
      prompt = `Shapes A, B and C are all ${category}s. Which sentence is true for every ${category}?`;
      hint = `Test each sentence on all three shapes. Size, direction and how stretched a shape is can change; what makes it ${article(category)} ${category} cannot.`;
      explanation = [
        `Every one of the three has ${sides[category]}.`,
        `That is what makes a shape ${article(category)} ${category}. Its size, the way it points and how stretched it is can all change.`,
        `So the sentence that is true for every ${category} is: ${defining}`,
      ];
      choices = [
        { label: defining, correct: true },
        ...wrong.map((a) => {
          const counter = ordered.findIndex((p) => !holds(a, p));
          if (counter < 0) throw new Error(`Nothing refutes ${a}`);
          const who = labels[counter]!;
          const what =
            a === "equal-sides"
              ? `has sides of different lengths`
              : a === "flat-bottom"
                ? `is turned so that no side lies flat along the bottom`
                : a === "taller"
                  ? `is wider than it is tall`
                  : `is taller than it is wide`;
          return {
            label: attributeText[a],
            feedback: `Shape ${who} is ${article(category)} ${category} too, and it ${what}. So this is not true of every ${category}.`,
          };
        }),
      ];
      break;
    }
    default:
      throw new Error(`Missing shape generator: ${templateId}`);
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
