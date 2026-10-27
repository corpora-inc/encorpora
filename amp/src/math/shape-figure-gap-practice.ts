import type { TemplateMetadata } from "./contracts";
import { triangle } from "./scene/author";
import { place, type Pt, type ShapeItem } from "./shape-figures";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import {
  an,
  draw,
  letters,
  orderedChoiceSurface,
  shuffled,
} from "./elementary-gap-kit";

const scenes = { requiredFigureCapability: "scenes-v1" } as const;
export const congruentFiguresTemplate: TemplateMetadata = {
  id: "congruent-figure-pair",
  version: 1,
  ...scenes,
  requiredResponseCapability: "single-choice-v1",
  title: "Which two figures match exactly?",
  skillId: "polygon-properties",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Among four figures drawn at one scale, pick the pair that is congruent, one turned or flipped copy of the other, against a figure of the same shape but another size and one with a changed corner.",
};
export const triangleSidesTemplate: TemplateMetadata = {
  id: "classify-triangle-by-sides",
  version: 1,
  ...scenes,
  requiredResponseCapability: "single-choice-v1",
  title: "Scalene, isosceles or equilateral",
  skillId: "shape-hierarchy",
  gradeBand: "3–5",
  difficultyOffset: -0.1,
  description:
    "Name a triangle from its three side lengths, or pick the drawn triangle with no equal sides, exactly two equal sides or three equal sides.",
};
export const cutShapeTemplate: TemplateMetadata = {
  id: "name-cut-shape-pieces",
  version: 1,
  ...scenes,
  requiredResponseCapability: "single-choice-v1",
  title: "Name the pieces of a cut figure",
  skillId: "polygon-properties",
  gradeBand: "3–5",
  difficultyOffset: 0,
  description:
    "A flat figure is cut along straight lines into triangles, rectangles, squares or trapezoids; choose the names of all the pieces.",
};

/* ----------------------------------------------------------- geometry */
const SIZE = 1.6;
const cross = (a: Pt, b: Pt, c: Pt) =>
  (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round = (n: number) => Math.round(n * 1e4) / 1e4 || 0;
const centered = (pts: Pt[]): Pt[] => {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [round(x - cx), round(y - cy)] as Pt);
};
/** A convex polygon whose every turn is clearly visible. */
function convexPolygon(r: (lo: number, hi: number) => number, n: number): Pt[] {
  const pts: Pt[] = Array.from({ length: n }, (_, i) => {
    const t = ((360 * i) / n + r(-14, 14)) * (Math.PI / 180);
    const radius = (SIZE * r(78, 100)) / 100;
    return [radius * Math.cos(t), radius * Math.sin(t)] as Pt;
  });
  const sign = Math.sign(cross(pts[0]!, pts[1]!, pts[2]!));
  const ok = pts.every((p, i) => {
    const c = cross(p, pts[(i + 1) % n]!, pts[(i + 2) % n]!);
    return Math.sign(c) === sign && Math.abs(c) > 0.55;
  });
  if (!ok) throw new Error("Need three retries");
  return centered(pts);
}
const turned = (pts: Pt[], degrees: number) => place(pts, degrees);
const flipped = (pts: Pt[], degrees: number) =>
  place(
    pts.map(([x, y]) => [-x, y] as Pt),
    degrees,
  );
/** Move one corner outward so the figure is no longer a copy. */
function withMovedCorner(pts: Pt[], index: number): Pt[] {
  const out = pts.map((p) => [...p] as Pt);
  out[index] = [round(out[index]![0] * 1.55), round(out[index]![1] * 1.55)];
  return out;
}
const isConvex = (pts: Pt[]) => {
  const s = Math.sign(cross(pts[0]!, pts[1]!, pts[2]!));
  return pts.every(
    (p, i) =>
      Math.sign(
        cross(p, pts[(i + 1) % pts.length]!, pts[(i + 2) % pts.length]!),
      ) === s,
  );
};
/** Side lengths sorted, rounded, to compare two outlines exactly enough. */
export const sideProfile = (pts: Pt[]) =>
  pts
    .map((p, i) => round(dist(p, pts[(i + 1) % pts.length]!)))
    .sort((a, b) => a - b);
const area2 = (pts: Pt[]) =>
  Math.abs(
    pts.reduce(
      (s, p, i) =>
        s +
        p[0] * pts[(i + 1) % pts.length]![1] -
        pts[(i + 1) % pts.length]![0] * p[1],
      0,
    ),
  );

/* ---------------------------------------------------------- congruent */
const congruentAxes = {
  move: defineAxis("move", ["turn", "flip"] as const),
};
type Role = "target" | "copy" | "bigger" | "changed";
interface CongruentModel {
  move: "turn" | "flip";
  sides: number;
  /** Role at each lettered position A to D. */
  roles: Role[];
  shapes: Record<Role, Pt[]>;
  /** Whether the other-size figure is larger. */
  larger: boolean;
}
function congruentModel(
  r: (lo: number, hi: number) => number,
  a: { move: "turn" | "flip" },
): CongruentModel {
  const n = pick(r, [3, 4, 5, 5]);
  const base = convexPolygon(r, n);
  const larger = r(0, 1) === 1;
  const scale = larger ? 1.4 : 0.7;
  const moved = withMovedCorner(base, r(0, n - 1));
  if (!isConvex(moved)) throw new Error("Need three retries");
  // The moved-corner figure must differ in area and sides from the target.
  if (Math.abs(area2(moved) - area2(base)) < 0.5)
    throw new Error("Need three retries");
  const shapes: Record<Role, Pt[]> = {
    target: turned(base, r(0, 359)),
    copy:
      a.move === "turn" ? turned(base, r(0, 359)) : flipped(base, r(0, 359)),
    bigger: turned(
      base.map(([x, y]) => [round(x * scale), round(y * scale)] as Pt),
      r(0, 359),
    ),
    changed: turned(moved, r(0, 359)),
  };
  return {
    move: a.move,
    sides: n,
    roles: shuffled(r, ["target", "copy", "bigger", "changed"] as Role[]),
    shapes,
    larger,
  };
}
const pairLabel = (i: number, j: number) =>
  `${letters[Math.min(i, j)]} and ${letters[Math.max(i, j)]}`;

export const congruentFigures = chainFamily({
  template: congruentFiguresTemplate,
  axes: congruentAxes,
  model: congruentModel,
  variant: (m) => m.move,
  render: (m, _a, r) => {
    const at = (role: Role) => m.roles.indexOf(role);
    const items: ShapeItem[] = m.roles.map((role, i) => ({
      label: letters[i]!,
      pieces: [{ type: "polygon", points: m.shapes[role] }],
    }));
    const key = pairLabel(at("target"), at("copy"));
    const options = [] as {
      label: string;
      correct?: true;
      feedback?: string;
    }[];
    options.push({ label: key, correct: true });
    const wrongPairs: { i: number; j: number; why: string }[] = [];
    const size = m.larger ? "larger" : "smaller";
    for (const x of ["target", "copy"] as const)
      wrongPairs.push({
        i: at(x),
        j: at("bigger"),
        why: `Figure ${letters[at("bigger")]} has the same shape but is ${size}. Congruent figures match in size as well as shape.`,
      });
    for (const x of ["target", "copy"] as const)
      wrongPairs.push({
        i: at(x),
        j: at("changed"),
        why: `Figure ${letters[at("changed")]} has a corner in a different place, so it would not fit exactly on the other figure.`,
      });
    wrongPairs.push({
      i: at("bigger"),
      j: at("changed"),
      why: "These two figures differ in size and in the position of a corner, so they would not fit on each other.",
    });
    // One pair with the other-size figure, one with the changed corner, and
    // one more from the remaining near misses.
    const first = r(0, 1);
    const second = 2 + r(0, 1);
    const chosen = [
      wrongPairs[first]!,
      wrongPairs[second]!,
      ...draw(
        r,
        wrongPairs.filter((_, k) => k !== first && k !== second),
        1,
      ),
    ];
    for (const w of chosen)
      options.push({ label: pairLabel(w.i, w.j), feedback: w.why });
    const sorted = options.sort((x, y) => x.label.localeCompare(y.label));
    if (new Set(sorted.map((o) => o.label)).size !== 4) return null;
    return {
      ...orderedChoiceSurface({
        prompt:
          "Four figures are drawn at the same scale. Which two figures are congruent?",
        options: sorted,
        hint: `Congruent figures have exactly the same size and shape, so one would fit on the other after a ${m.move === "turn" ? "turn" : "flip or turn"}. Each figure has ${m.sides} sides, and one figure is clearly ${m.larger ? "larger" : "smaller"} than the others. Compare side lengths, and see which figure has a corner in a different place.`,
        explanation: [
          `Congruent figures can be matched exactly by ${m.move === "turn" ? "turning" : "flipping and turning"} one of them: same side lengths, same angles.`,
          `Figures ${letters[at("target")]} and ${letters[at("copy")]} match exactly; one is a ${m.move === "turn" ? "turn" : "flip"} of the other.`,
          `Figure ${letters[at("bigger")]} has the same shape but is ${size}, and figure ${letters[at("changed")]} has a corner moved, so neither is congruent to the others.`,
        ],
      })!,
      figure: { kind: "plane-shapes" as const, items },
    };
  },
});
/* ----------------------------------------------------------- triangles */
type TriType = "scalene" | "isosceles" | "equilateral";
const typeName: Record<TriType, string> = {
  scalene: "Scalene (no sides equal)",
  isosceles: "Isosceles (exactly two sides equal)",
  equilateral: "Equilateral (all three sides equal)",
};
const typeRule: Record<TriType, string> = {
  scalene: "no two sides equal",
  isosceles: "exactly two equal sides",
  equilateral: "three equal sides",
};

/** The smallest interior angle in degrees, from the three side lengths. */
function smallestAngle(s: number[]): number {
  const [a, b, c] = s as [number, number, number];
  const angle = (x: number, y: number, z: number) =>
    (Math.acos((y * y + z * z - x * x) / (2 * y * z)) * 180) / Math.PI;
  return Math.min(angle(a, b, c), angle(b, a, c), angle(c, a, b));
}
/** Side lengths of a triangle of the given kind, in whole units, with no
 * sliver: every angle is at least 25 degrees so the drawing reads clearly. */
function sidesOf(
  r: (lo: number, hi: number) => number,
  kind: TriType,
): number[] {
  const s = rawSides(r, kind);
  if (smallestAngle(s) < 25) throw new Error("Need three retries");
  return s;
}
function rawSides(
  r: (lo: number, hi: number) => number,
  kind: TriType,
): number[] {
  if (kind === "equilateral") return Array(3).fill(r(5, 9)) as number[];
  if (kind === "isosceles") {
    const s = r(5, 9);
    const t = r(3, 2 * s - 3);
    if (Math.abs(t - s) < 2) throw new Error("Need three retries");
    return [s, s, t];
  }
  const a = r(4, 7);
  const b = r(a + 2, 9);
  const c = r(b + 2, 12);
  if (a + b < c + 2) throw new Error("Need three retries");
  return [a, b, c];
}
export const classifyOf = (s: number[]): TriType => {
  const eq =
    (s[0] === s[1] ? 1 : 0) + (s[1] === s[2] ? 1 : 0) + (s[0] === s[2] ? 1 : 0);
  return eq === 0 ? "scalene" : eq === 1 ? "isosceles" : "equilateral";
};
/** Vertices for sides [a, b, c]: side 0 from P0 to P1 has length c. */
export function trianglePoints(s: number[], degrees = 0): [Pt, Pt, Pt] {
  const [a, b, c] = s as [number, number, number];
  const x = (b * b + c * c - a * a) / (2 * c);
  const y = Math.sqrt(Math.max(0, b * b - x * x));
  return place(
    [
      [0, 0],
      [c, 0],
      [x, y],
    ],
    degrees,
  ) as [Pt, Pt, Pt];
}

const triangleAxes = {
  ask: defineAxis("ask", ["name-type", "find-type"] as const),
};
interface TriangleModel {
  ask: "name-type" | "find-type";
  target: TriType;
  /** name-type: the three side lengths. find-type: four triangles A to D. */
  sides: number[][];
  correct: number;
}
function triangleModel(
  r: (lo: number, hi: number) => number,
  a: { ask: "name-type" | "find-type" },
): TriangleModel {
  const target = pick(r, ["scalene", "isosceles", "equilateral"] as const);
  if (a.ask === "name-type") {
    const sides = sidesOf(r, target);
    // "Right triangle" is a choice: sides such as 6, 8, 10 would make it correct too.
    const [x, y, z] = [...sides].sort((p, q) => p - q) as [
      number,
      number,
      number,
    ];
    if (x * x + y * y === z * z) throw new Error("Need three retries");
    return { ask: a.ask, target, sides: [sides], correct: 0 };
  }
  const others: TriType[] =
    target === "scalene"
      ? ["isosceles", "equilateral"]
      : target === "isosceles"
        ? ["scalene"]
        : ["scalene", "isosceles"];
  const kinds = shuffled(r, [target, ...[0, 1, 2].map(() => pick(r, others))]);
  const sides = kinds.map((k) => sidesOf(r, k));
  // Distinct drawings, and every triangle fits the same drawing scale.
  const keys = new Set(sides.map((s) => s.join(",")));
  if (keys.size < 4) throw new Error("Need three retries");
  // One drawing scale for all four: none may be a speck beside the others.
  const longest = Math.max(...sides.flat());
  if (sides.some((t) => Math.max(...t) * 2 < longest))
    throw new Error("Need three retries");
  return { ask: a.ask, target, sides, correct: kinds.indexOf(target) };
}
export const classifyTriangle = chainFamily({
  template: triangleSidesTemplate,
  axes: triangleAxes,
  model: triangleModel,
  variant: (m) => `${m.ask}-${m.target}`,
  render: (m, _a, r) => {
    if (m.ask === "name-type") {
      const s = m.sides[0]!;
      const pts = trianglePoints(s, r(0, 359));
      const fig = triangle(pts);
      // Side i runs from vertex i to vertex i + 1: lengths c, a, b.
      fig.side(0, { label: `${s[2]} cm` });
      fig.side(1, { label: `${s[0]} cm` });
      fig.side(2, { label: `${s[1]} cm` });
      const options = (
        ["scalene", "isosceles", "equilateral"] as TriType[]
      ).map((k) =>
        k === m.target
          ? { label: typeName[k], correct: true as const }
          : {
              label: typeName[k],
              feedback: `A ${k} triangle has ${typeRule[k]}. This triangle has sides ${s[0]}, ${s[1]} and ${s[2]} cm, so it does not match.`,
            },
      );
      options.push({
        label: "Right triangle (one square corner)",
        feedback:
          "A right triangle is named by its angle. The lengths of the sides decide whether a triangle is scalene, isosceles or equilateral.",
      } as never);
      const surface = orderedChoiceSurface({
        prompt: `A triangle has sides of ${s[0]} cm, ${s[1]} cm and ${s[2]} cm. What kind of triangle is it?`,
        options: shuffled(r, options),
        hint: `Compare the three lengths ${s[0]}, ${s[1]} and ${s[2]}. Count how many of them are equal to each other.`,
        explanation: [
          `The sides are ${s[0]}, ${s[1]} and ${s[2]} centimeters.`,
          m.target === "scalene"
            ? "No two of the lengths are equal."
            : m.target === "isosceles"
              ? `Exactly two lengths are equal (${s.find((v, i) => s.indexOf(v) !== i)} and ${s.find((v, i) => s.indexOf(v) !== i)}), and the third is different.`
              : "All three lengths are equal.",
          `A triangle with ${typeRule[m.target]} is ${an(m.target)} ${m.target} triangle.`,
        ],
      });
      return (
        surface && {
          ...surface,
          figure: { kind: "scene" as const, scene: fig.scene() },
        }
      );
    }
    const items: ShapeItem[] = m.sides.map((s, i) => ({
      label: letters[i]!,
      pieces: [{ type: "polygon", points: trianglePoints(s, r(0, 359)) }],
      marks: "sides-angles",
    }));
    const kinds = m.sides.map(classifyOf);
    const matching = kinds.filter((k) => k !== "scalene").length;
    const options = items.map((_, i) =>
      i === m.correct
        ? { label: `Triangle $${letters[i]}$`, correct: true as const }
        : {
            label: `Triangle $${letters[i]}$`,
            feedback: `Triangle $${letters[i]}$ has ${typeRule[kinds[i]!]}, so it is ${an(kinds[i]!)} ${kinds[i]} triangle, not ${an(m.target)} ${m.target} one.`,
          },
    );
    const surface = orderedChoiceSurface({
      prompt: `Matching tick marks show sides of equal length. Which triangle is ${m.target} (${typeRule[m.target]})?`,
      options,
      hint: `Count the tick marks on the sides of each triangle: sides with the same number of ticks are equal. Here ${matching} of the 4 triangles ${matching === 1 ? "shows" : "show"} matching sides. A ${m.target} triangle has ${typeRule[m.target]}.`,
      explanation: [
        `A ${m.target} triangle has ${typeRule[m.target]}. Matching ticks mark equal sides.`,
        kinds
          .map((k, i) => `Triangle $${letters[i]}$ has ${typeRule[k]}`)
          .join("; ") + ".",
        `Triangle $${letters[m.correct]}$ is the ${m.target} triangle.`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "plane-shapes" as const, items },
      }
    );
  },
});

/* ------------------------------------------------------ cut shapes */
export type PieceName = "triangle" | "rectangle" | "square" | "trapezoid";
/** Name a piece from its coordinates: the independent reading of the figure. */
export function pieceName(pts: Pt[]): PieceName {
  if (pts.length === 3) return "triangle";
  const side = (i: number) => dist(pts[i]!, pts[(i + 1) % 4]!);
  const rightAt = (i: number) =>
    Math.abs(cross(pts[i]!, pts[(i + 1) % 4]!, pts[(i + 2) % 4]!)) /
      (side(i) * side((i + 1) % 4)) >
    0.999;
  const allRight = [0, 1, 2, 3].every(rightAt);
  if (allRight)
    return Math.abs(side(0) - side(1)) < 1e-6 ? "square" : "rectangle";
  return "trapezoid";
}
const plural: Record<PieceName, string> = {
  triangle: "triangles",
  rectangle: "rectangles",
  square: "squares",
  trapezoid: "trapezoids",
};
/** "2 triangles", "a triangle and a trapezoid", "2 triangles and a rectangle". */
export function describePieces(names: PieceName[]): string {
  const counts = new Map<PieceName, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const words = (
    ["triangle", "square", "rectangle", "trapezoid"] as PieceName[]
  )
    .filter((n) => counts.has(n))
    .map((n) => {
      const c = counts.get(n)!;
      return c === 1 ? `a ${n}` : `${c} ${plural[n]}`;
    });
  return words.join(" and ");
}
interface Layout {
  id: string;
  pieces: (w: number, h: number) => Pt[][];
}
const layouts: Layout[] = [
  {
    id: "diagonal",
    pieces: (w, h) => [
      [
        [0, 0],
        [w, 0],
        [w, h],
      ],
      [
        [0, 0],
        [w, h],
        [0, h],
      ],
    ],
  },
  {
    id: "corner-cut",
    pieces: (w, h) => [
      [
        [0, 0],
        [w * 0.6, 0],
        [w, h],
        [0, h],
      ],
      [
        [w * 0.6, 0],
        [w, 0],
        [w, h],
      ],
    ],
  },
  {
    id: "both-diagonals",
    pieces: (w, h) => [
      [
        [0, 0],
        [w, 0],
        [w / 2, h / 2],
      ],
      [
        [w, 0],
        [w, h],
        [w / 2, h / 2],
      ],
      [
        [w, h],
        [0, h],
        [w / 2, h / 2],
      ],
      [
        [0, h],
        [0, 0],
        [w / 2, h / 2],
      ],
    ],
  },
  {
    id: "side-triangles",
    pieces: (w, h) => [
      [
        [0, 0],
        [w * 0.25, 0],
        [w * 0.25, h],
      ],
      [
        [w * 0.25, 0],
        [w * 0.75, 0],
        [w * 0.75, h],
        [w * 0.25, h],
      ],
      [
        [w * 0.75, 0],
        [w, 0],
        [w * 0.75, h],
      ],
    ],
  },
  {
    id: "thirds",
    pieces: (w, h) => [
      [
        [0, 0],
        [w / 3, 0],
        [w / 3, h],
        [0, h],
      ],
      [
        [w / 3, 0],
        [(2 * w) / 3, 0],
        [(2 * w) / 3, h],
        [w / 3, h],
      ],
      [
        [(2 * w) / 3, 0],
        [w, 0],
        [w, h],
        [(2 * w) / 3, h],
      ],
    ],
  },
  {
    id: "house",
    pieces: (_w, h) => [
      [
        [0, 0],
        [h, 0],
        [h, h],
        [0, h],
      ],
      [
        [0, h],
        [h, h],
        [h / 2, h * 1.5],
      ],
    ],
  },
  {
    id: "split",
    pieces: (w, h) => [
      [
        [0, 0],
        [h, 0],
        [h, h],
        [0, h],
      ],
      [
        [h, 0],
        [w, 0],
        [w, h],
        [h, h],
      ],
    ],
  },
];
interface CutModel {
  layout: Layout;
  w: number;
  h: number;
  pieces: Pt[][];
  names: PieceName[];
}
function cutModel(r: (lo: number, hi: number) => number): CutModel {
  const layout = pick(r, layouts);
  const h = r(3, 4) * 0.8;
  // A square for the four triangles; a split piece beside the square is a
  // rectangle that is not a square (2.5 or 1.5 times the height).
  const w =
    layout.id === "both-diagonals"
      ? h
      : layout.id === "split"
        ? h * (r(0, 1) ? 2.5 : 1.5)
        : layout.id === "thirds"
          ? h * 2.4
          : h * r(2, 3);
  const pieces = layout
    .pieces(w, h)
    .map((p) => p.map(([x, y]) => [round(x), round(y)] as Pt));
  return { layout, w, h, pieces, names: pieces.map(pieceName) };
}
const cutNames: string[] = [
  "2 triangles",
  "4 triangles",
  "a triangle and a trapezoid",
  "a square and a rectangle",
  "2 triangles and a rectangle",
  "2 squares",
  "3 triangles",
  "3 rectangles",
  "a square and a triangle",
];
export const cutShape = chainFamily({
  template: cutShapeTemplate,
  axes: {} as Record<string, never>,
  model: (r) => cutModel(r),
  variant: (m) => m.layout.id,
  render: (m, _a, r) => {
    const items: ShapeItem[] = [
      {
        pieces: m.pieces.map((p) => ({ type: "polygon" as const, points: p })),
      },
    ];
    const answer = describePieces(m.names);
    // A square is a rectangle, and the order of the words does not matter, so a
    // distractor that names the same kinds of pieces would also be correct.
    const kinds = (name: string) =>
      [...name.matchAll(/(a|\d) (triangle|square|rectangle|trapezoid)s?/g)]
        .flatMap(([, n, kind]) =>
          Array<string>(n === "a" ? 1 : Number(n)).fill(
            kind === "square" ? "rectangle" : kind!,
          ),
        )
        .sort()
        .join();
    const pool = cutNames.filter((n) => kinds(n) !== kinds(answer));
    const wrong = draw(r, pool, 3);
    return {
      ...choiceFrom(
        r,
        answer,
        wrong,
        m.names,
        m.pieces.map((p) => p.length),
      ),
      figure: { kind: "plane-shapes" as const, items },
    };
  },
});
function choiceFrom(
  r: (lo: number, hi: number) => number,
  answer: string,
  wrong: string[],
  names: PieceName[],
  sides: number[],
) {
  const pieces = names.length;
  const s = choiceSurface(r, {
    prompt:
      "A flat figure is cut along straight lines into pieces. The pieces are shown in different colors. What are the pieces?",
    options: [
      { label: answer, correct: true },
      ...wrong.map((w) => ({
        label: w,
        feedback: `Count the pieces and their corners. The figure has ${pieces} ${pieces === 1 ? "piece" : "pieces"}, and each piece is named by its number of sides and its square corners, so ${w} does not match.`,
      })),
    ],
    hint: `Count the pieces first: there are ${pieces}. Then count the sides of each piece, and look for square corners.`,
    explanation: [
      `There are ${pieces} pieces.`,
      names
        .map(
          (n, i) =>
            `Piece ${i + 1} has ${sides[i]} sides${n === "triangle" ? "" : n === "trapezoid" ? " and just one pair of parallel sides" : n === "square" ? ", 4 square corners and 4 equal sides" : " and 4 square corners"}: it is ${an(n)} ${n}.`,
        )
        .join(" "),
      `So the pieces are ${answer}.`,
    ],
  });
  if (!s) throw new Error("Need three retries");
  return s;
}

export const shapeFigureGapTemplates = [
  congruentFiguresTemplate,
  triangleSidesTemplate,
  cutShapeTemplate,
] as const;
export const shapeFigureGapGenerate = dispatch(shapeFigureGapTemplates, {
  "congruent-figure-pair": (seed) => congruentFigures.generate(seed).problem,
  "classify-triangle-by-sides": (seed) =>
    classifyTriangle.generate(seed).problem,
  "name-cut-shape-pieces": (seed) => cutShape.generate(seed).problem,
});
