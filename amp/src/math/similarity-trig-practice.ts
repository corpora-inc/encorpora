import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { act, graph, scene, step, triangle } from "./scene/author";
import type { Point, Scene } from "./scene/spec";
import type { Action } from "./scene/timeline";

/** Geometry similarity and right-triangle trigonometry (G-SRT): dilations,
 * similar triangles, special right triangles, trigonometric ratios and
 * complementary angles. Figures are exact triangle and coordinate scenes. */
type Random = (low: number, high: number) => number;
type Rational = { n: number; d: number };
type Case = {
  prompt: string;
  answer: Rational;
  explanation: string[];
  hint: string;
  tags: string[];
  figure?: Scene;
  label: string;
};

const scenes = { requiredFigureCapability: "scenes-v1" } as const;
export const similarityTrigTemplates: readonly TemplateMetadata[] = [
  {
    id: "dilation-measure",
    version: 1,
    title: "Dilations: lengths, centers and what is kept",
    skillId: "dilation-properties",
    gradeBand: "9–12",
    description:
      "Use a dilation's scale factor and center: image lengths, the scale factor from two lengths, an image point about a center other than the origin, and the slopes and angles a dilation keeps.",
    ...scenes,
  },
  {
    id: "similar-triangle-side",
    version: 1,
    title: "Similar triangles: a missing side",
    skillId: "similarity-proofs",
    gradeBand: "9–12",
    description:
      "Find a missing length from similar triangles: matching sides, a segment parallel to a side, shadows, and the square of the scale factor for areas.",
    ...scenes,
  },
  {
    id: "special-right-triangle",
    version: 1,
    title: "45-45-90 and 30-60-90 triangles",
    skillId: "special-right-triangles",
    gradeBand: "9–12",
    description:
      "Use the side ratios 1 : 1 : √2 and 1 : √3 : 2 to find a side of a special right triangle from any other side.",
    ...scenes,
  },
  {
    id: "trig-ratio",
    version: 1,
    title: "Sine, cosine and tangent",
    skillId: "right-triangle-trigonometry",
    gradeBand: "9–12",
    description:
      "Write sin, cos and tan of an acute angle as exact ratios of sides, finding a third side when needed, and find a side from a given ratio.",
    ...scenes,
  },
  {
    id: "complementary-trig",
    version: 1,
    title: "Sine and cosine of complementary angles",
    skillId: "complementary-trigonometry",
    gradeBand: "9–12",
    description:
      "Use $\\sin x° = \\cos(90 - x)°$ to find an angle, to solve for a variable, and to read $\\cos B$ from $\\sin A$ in a right triangle.",
    ...scenes,
  },
];

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
function q(n: number, d = 1): Rational {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Expected exact rational arithmetic");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const mul = (a: Rational, b: Rational) => q(a.n * b.n, a.d * b.d);
const div = (a: Rational, b: Rational) => q(a.n * b.d, a.d * b.n);
const add = (a: Rational, b: Rational) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rational, b: Rational) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const value = (v: Rational) => v.n / v.d;
/** "15/2", "−3/4" or a whole number. */
const frac = (v: Rational) =>
  `${v.n < 0 ? "−" : ""}${Math.abs(v.n)}${v.d === 1 ? "" : `/${v.d}`}`;
const answerText = (v: Rational) => `${v.n}${v.d === 1 ? "" : `/${v.d}`}`;
/** A ratio of two written lengths, then reduced when it reduces. */
const ratio = (a: number, b: number) => {
  const v = q(a, b);
  return v.d === b || (v.n === a && v.d === b)
    ? `${a}/${b}`
    : `${a}/${b} = ${frac(v)}`;
};
/** A trigonometric statement as TeX: $\sin A = \frac{3}{5}$. */
const math = (plain: string) =>
  `$${plain
    .replace(/(\d+)\/(\d+)/g, "\\frac{$1}{$2}")
    .replace(/−/g, "-")
    .replace(/×/g, "\\times")
    .replace(/÷/g, "\\div")
    .replace(/√(\d+)/g, "\\sqrt{$1}")
    .replace(/\b(sin|cos|tan)\b/g, "\\$1")
    .replace(/°/g, "^\\circ")
    .replace(/θ/g, "\\theta")}$`;

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let v: number;
    do
      v = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (v >= limit);
    return low + (v % span);
  };
}
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;

/** A triangle with sides AB = c, BC = a, CA = b, drawn from A at the origin. */
function placed(
  c: number,
  a: number,
  b: number,
  at: Point = [0, 0],
  s = 1,
): [Point, Point, Point] {
  const cx = (b * b + c * c - a * a) / (2 * c);
  const cy = Math.sqrt(Math.max(0, b * b - cx * cx));
  return [
    [at[0], at[1]],
    [at[0] + c * s, at[1]],
    [at[0] + cx * s, at[1] + cy * s],
  ];
}
/** (3, −2), with typographic minus signs. */
const pt = ([x, y]: Point) =>
  `(${String(x).replace("-", "−")}, ${String(y).replace("-", "−")})`;
const light = (target: string, ink: "accent" | "warm" | "gold"): Action => ({
  do: "fill",
  target,
  ink,
});
const scales: readonly Rational[] = [
  q(3, 2),
  q(2),
  q(5, 2),
  q(3),
  q(4, 3),
  q(1, 2),
];

// ------------------------------------------------------------- similarity
function similarCase(r: Random): Case {
  const mode = r(0, 3);
  if (mode === 0) {
    let a: number, b: number, c: number;
    do {
      [a, b, c] = [r(3, 9), r(3, 9), r(4, 10)];
    } while (a + b <= c + 1 || a + c <= b + 1 || b + c <= a + 1);
    // A scale factor that keeps every side a whole or half number.
    let k = pick(r, scales);
    while ([a, b, c].some((x) => mul(q(x), k).d > 2)) k = pick(r, scales);
    const reverse = r(0, 1) === 1;
    // Ask for a side in the second triangle from the first, or the reverse.
    const sides = [c, a, b];
    const known = r(0, 2);
    let asked = r(0, 1);
    if (asked >= known) asked++;
    const names = [
      ["AB", "BC", "CA"],
      ["DE", "EF", "FD"],
    ] as const;
    const second = sides.map((x) => mul(q(x), k));
    // The learner knows: all three sides of the triangle given in full, and
    // the matching side in the other.
    const [full, part] = reverse ? [1, 0] : [0, 1];
    const len = (t: number, i: number) => (t === 0 ? q(sides[i]!) : second[i]!);
    const answer = len(part, asked);
    const figureSides = (t: number) =>
      [0, 1, 2].map((i) =>
        t === full
          ? { label: frac(len(t, i)) }
          : i === known
            ? { label: frac(len(t, i)) }
            : i === asked
              ? { label: null }
              : {},
      );
    const draw = (t: number, at: Point, s: number) => {
      let tri = triangle(placed(c, a, b, at, s)).names(
        ...((t === 0 ? ["A", "B", "C"] : ["D", "E", "F"]) as [
          string,
          string,
          string,
        ]),
      );
      for (const [i, spec] of figureSides(t).entries())
        tri = tri.side(i as 0 | 1 | 2, spec as { label?: string | null });
      return tri
        .angle(0, { mark: "arc" })
        .angle(1, { mark: "arc", arcs: 2 })
        .id(t === 0 ? "t1" : "t2");
    };
    const kv = value(k);
    const first = draw(0, [0, 0], 1),
      other = draw(1, [c + 1.2 + 0.25 * Math.max(c, c * kv), 0], kv);
    const kText = reverse ? frac(q(k.d, k.n)) : frac(k);
    const prompt = `Triangle $ABC$ is similar to triangle $DEF$, with $A$, $B$ and $C$ matching $D$, $E$ and $F$. ${
      reverse
        ? `$DE = ${frac(second[0]!)}$, $EF = ${frac(second[1]!)}$, $FD = ${frac(second[2]!)}$ and $${names[0][known]}$ = ${frac(q(sides[known]!))}. What is $${names[0][asked]}$?`
        : `$AB = ${c}$, $BC = ${a}$, $CA = ${b}$ and $${names[1][known]}$ = ${frac(second[known]!)}. What is $${names[1][asked]}$?`
    }`;
    const [kn, kd] = reverse
      ? [frac(q(sides[known]!)), frac(second[known]!)]
      : [frac(second[known]!), frac(q(sides[known]!))];
    return {
      prompt,
      answer,
      explanation: [
        `Similar triangles have the same shape: matching angles are equal, and every side is multiplied by the same number, the scale factor.`,
        `The order of the letters tells which sides match: $A$, $B$, $C$ go with $D$, $E$, $F$. So $${names[0][known]}$ matches $${names[1][known]}$.`,
        `The scale factor from triangle ${reverse ? "$DEF$ to $ABC$" : "$ABC$ to $DEF$"} is one matching length divided by the other: ${kn} ÷ ${kd} = ${kText}.`,
        `$${names[reverse ? 0 : 1][asked]}$ matches $${names[reverse ? 1 : 0][asked]}$, which is ${frac(len(full, asked))}. Multiply it by the scale factor.`,
        `$${names[reverse ? 0 : 1][asked]}$ = ${frac(len(full, asked))} × ${kText} = ${frac(answer)}.`,
      ],
      hint: `$${names[0][known]}$ and $${names[1][known]}$ are matching sides: divide ${kn} by ${kd} for the scale factor, then apply it to the side that matches $${names[reverse ? 0 : 1][asked]}$.`,
      tags: ["pair", reverse ? "to-smaller" : "to-larger"],
      figure: scene(first, other).build({
        title: "Similar triangles ABC and DEF",
        steps: [
          step(
            `$${names[0][known]}$ and $${names[1][known]}$ match: their ratio is the scale factor.`,
            light(`t1.side.${known}`, "accent"),
            light(`t2.side.${known}`, "accent"),
          ),
          step(
            `$${names[reverse ? 0 : 1][asked]}$ matches $${names[reverse ? 1 : 0][asked]}$: multiply it by the same factor.`,
            light(`t1.side.${asked}`, "warm"),
            light(`t2.side.${asked}`, "warm"),
          ),
        ],
      }),
      label: "Length",
    };
  }
  if (mode === 1) {
    // Side splitter: DE ∥ BC with D on AB and E on AC; triangle ADE ~ ABC.
    const ad = r(2, 8),
      db = r(2, 8),
      ab = ad + db;
    const askBC = r(0, 1) === 1;
    const de = r(2, 9);
    const bcValue = q(de * ab, ad);
    const bc = askBC ? bcValue : q(r(4, 14));
    const deValue = askBC ? q(de) : mul(bc, q(ad, ab));
    const answer = askBC ? bcValue : deValue;
    // Draw A at the top, B and C on the base, D and E on the sides.
    const width = value(bc) * 0.9 + 2,
      height = 5;
    const A: Point = [width * 0.4, height],
      B: Point = [0, 0],
      C: Point = [width, 0];
    const t = ad / ab;
    const D: Point = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
    const E: Point = [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t];
    const tri = triangle([A, B, C])
      .names("A", "B", "C")
      .side(1, { label: askBC ? null : frac(bc) })
      .id("t");
    const figure = scene(
      tri,
      {
        type: "segment",
        id: "de",
        from: D,
        to: E,
        stroke: "accent",
        width: 2.5,
      },
      { type: "point", id: "d", at: D, r: 4 },
      { type: "point", id: "e", at: E, r: 4 },
      {
        type: "text",
        id: "dName",
        at: D,
        text: "D",
        font: "math",
        bold: true,
        align: [1, 0],
        offset: [-8, 0],
      },
      {
        type: "text",
        id: "eName",
        at: E,
        text: "E",
        font: "math",
        bold: true,
        align: [-1, 0],
        offset: [8, 0],
      },
      {
        type: "text",
        id: "deLabel",
        at: [(D[0] + E[0]) / 2, D[1]],
        text: askBC ? String(de) : "?",
        derived: !askBC,
        color: "accent",
        bold: true,
        align: [0, 1],
        offset: [0, -6],
        halo: true,
      },
    ).build({
      title: "Triangle ABC with DE parallel to BC",
      steps: [
        step(
          "$DE$ ∥ $BC$, so triangle $ADE$ has the same angles as triangle $ABC$: they are similar.",
          act.highlight("de"),
          light("t.side.1", "accent"),
        ),
        step(
          "$AD$ matches the whole side $AB = AD + DB$, not the piece $DB$.",
          light("t.side.0", "warm"),
        ),
      ],
    });
    return {
      prompt: `In triangle $ABC$, $D$ is on $AB$ and $E$ is on $AC$, with $DE$ parallel to $BC$. $AD = ${ad}$ and $DB = ${db}$. ${
        askBC
          ? `$DE = ${de}$. What is $BC$?`
          : `$BC = ${frac(bc)}$. What is $DE$?`
      }`,
      answer,
      explanation: [
        "The symbol ∥ means parallel: the segments never meet. Where $AB$ crosses the parallel segments, the corresponding angles (in matching positions) at $D$ and $B$ are equal. So are the angles at $E$ and $C$.",
        "Angle $A$ is in both triangles too. Equal angles make triangle $ADE$ similar to triangle $ABC$: a smaller copy with the same shape.",
        `Match the small triangle's side $AD$ with the big triangle's whole side $AB$, not the piece $DB$. $AB = AD + DB = ${ad} + ${db} = ${ab}$.`,
        `The scale factor from $ABC$ down to $ADE$ is ${ad} ÷ ${ab} = ${frac(q(ad, ab))}. Every side of $ADE$ is that fraction of the matching side of $ABC$.`,
        askBC
          ? `$DE = BC × ${frac(q(ad, ab))}$, so undo the multiplication by dividing: $BC = ${de} ÷ ${frac(q(ad, ab))} = ${frac(answer)}$.`
          : `$DE = ${frac(bc)} × ${frac(q(ad, ab))} = ${frac(answer)}$.`,
        askBC ? `So $BC$ is ${frac(answer)}.` : `So $DE$ is ${frac(answer)}.`,
      ],
      hint: `Triangle $ADE$ is the small copy of $ABC$. Its side $AD = ${ad}$ matches the whole side $AB = ${ad} + ${db}$, not $DB$.`,
      tags: ["splitter", askBC ? "ask-base" : "ask-part"],
      figure,
      label: "Length",
    };
  }
  if (mode === 2) {
    const h = pick(r, [5, 6]),
      s = pick(r, [2, 3, 4, 8]),
      S = r(3, 12) * pick(r, [2, 3, 4]);
    const answer = q(h * S, s);
    const k = q(S, s);
    const draw = (
      height: number,
      shadow: number,
      at: Point,
      id: string,
      labels: [string | null, string],
    ) =>
      triangle([at, [at[0] + shadow, at[1]], [at[0], at[1] + height]])
        .side(0, { label: labels[1] })
        .side(2, { label: labels[0] })
        .angle(0, { mark: "right" })
        .angle(1, { mark: "arc" })
        .id(id);
    const unit = Math.max(h, s) / 4;
    const scaleTree = 5 / Math.max(value(answer), S);
    return {
      prompt: `At the same time of day, a person ${h} feet tall casts a shadow ${s} feet long, and a tree casts a shadow ${S} feet long. How tall is the tree, in feet?`,
      answer,
      explanation: [
        "The person and the tree each make a right triangle: height up, shadow along the ground, and a sun ray as the slanted side.",
        "At the same moment the sun's rays hit the ground at the same angle, and both stand straight up. Two matching angles make the triangles similar: the same shape.",
        "In similar triangles, every side is scaled by the same number. Shadow matches shadow and height matches height.",
        `The tree's shadow is ${S} ÷ ${s} = ${frac(k)} times the person's, so its triangle is ${frac(k)} times as large.`,
        `Tree height = ${h} × ${frac(k)} = ${frac(answer)}. The tree is ${frac(answer)} feet tall.`,
      ],
      hint: `The person's height and shadow, ${h} and ${s}, are in the same ratio as the tree's height and its ${S}-foot shadow.`,
      tags: ["shadow"],
      figure: scene(
        draw(h / unit, s / unit, [0, 0], "p", [String(h), String(s)]),
        draw(
          value(answer) * scaleTree,
          S * scaleTree,
          [s / unit + 1.5, 0],
          "tree",
          [null, String(S)],
        ),
      ).build({
        title: "A person and a tree with their shadows",
        steps: [
          step(
            "Shadow matches shadow.",
            light("p.side.0", "accent"),
            light("tree.side.0", "accent"),
          ),
          step(
            "Height matches height.",
            light("p.side.2", "warm"),
            light("tree.side.2", "warm"),
          ),
        ],
      }),
      label: "Height in feet",
    };
  }
  const small = r(2, 9),
    big = small + r(1, 8);
  const areaKind = r(0, 1) === 1;
  const known = r(2, 12) * (areaKind ? small * small : small);
  const k = q(big, small);
  const answer = areaKind ? mul(q(known), mul(k, k)) : mul(q(known), k);
  return {
    prompt: `Two similar triangles have matching sides of length ${small} and ${big}. The smaller triangle has ${areaKind ? "an area" : "a perimeter"} of ${known}. What is the ${areaKind ? "area" : "perimeter"} of the larger triangle?`,
    answer,
    explanation: [
      "Similar triangles have the same shape, with every side multiplied by one number, the scale factor.",
      `The scale factor from the smaller triangle to the larger is ${big} ÷ ${small} = ${frac(k)}.`,
      areaKind
        ? `Area is length times length. Both lengths grow by ${frac(k)}, so area grows by ${frac(k)} × ${frac(k)} = ${frac(mul(k, k))}, the scale factor squared.`
        : "A perimeter is the distance around, a sum of side lengths. Each side grows by the scale factor, so the sum does too.",
      `${areaKind ? "Area" : "Perimeter"}: ${known} × ${frac(areaKind ? mul(k, k) : k)} = ${frac(answer)}.`,
      `The larger triangle's ${areaKind ? "area" : "perimeter"} is ${frac(answer)}.`,
    ],
    hint: areaKind
      ? `The sides scale by ${big} ÷ ${small}. Area scales by that factor squared, not by the factor itself.`
      : `The sides scale by ${big} ÷ ${small}. A perimeter is a sum of sides, so it scales by the same factor.`,
    tags: [areaKind ? "area" : "perimeter"],
    label: areaKind ? "Area" : "Perimeter",
  };
}

// --------------------------------------------------------------- dilations
function dilationCase(r: Random): Case {
  const mode = r(0, 3);
  if (mode <= 1) {
    const k = pick(r, [q(1, 2), q(3, 2), q(2), q(3), q(5, 2)]);
    const [vx, vy] = pick(r, [
      [3, 4],
      [4, 3],
      [0, 5],
      [5, 0],
      [0, 4],
      [3, 0],
    ] as const);
    const L = Math.hypot(vx, vy);
    const A: Point = [r(1, 2), r(1, 2)];
    const B: Point = [A[0] + vx, A[1] + vy];
    const image = mul(q(L), k);
    const kv = value(k);
    // Rays run to a fixed 2.2 times the distance, whatever k is: the drawing
    // never encodes the scale factor.
    const reach = 2.2;
    const top = Math.ceil(Math.max(B[0], B[1]) * reach) + 1;
    const figure = graph({ x: [-1, top], y: [-1, top], tick: top > 12 ? 2 : 1 })
      .id("g")
      .point(0, 0, "O")
      .point(A[0], A[1], "A")
      .point(B[0], B[1], "B")
      .segment(A, B)
      .segment([0, 0], [A[0] * reach, A[1] * reach], { dash: "dash" })
      .segment([0, 0], [B[0] * reach, B[1] * reach], { dash: "dash" })
      .scene({
        title: "Segment AB and a center of dilation O",
        steps: [
          step(
            mode === 0
              ? `Each image point lies on the ray from $O$ through its point, ${frac(k)} times as far from $O$.`
              : "Each image point lies on the ray from $O$ through its point; the scale factor says how many times as far.",
            act.trace("g.segment.1"),
            act.trace("g.segment.2"),
          ),
          step(
            mode === 0
              ? `So every length is multiplied by ${frac(k)}, $AB$ included.`
              : "So every length is multiplied by that same factor, $AB$ included.",
            act.highlight("g.segment.0"),
          ),
        ],
      });
    if (mode === 0)
      return {
        prompt: `A dilation with center $O$ and scale factor ${frac(k)} maps $A$ to $A'$ and $B$ to $B'$. $AB = ${L}$. What is $A'B'$?`,
        answer: image,
        explanation: [
          `A dilation resizes a figure from a fixed point, the center. Every distance in the figure is multiplied by the scale factor.`,
          `So the image segment $A'B'$ is ${frac(k)} times as long as $AB$, wherever the center is.`,
          `$A'B' = ${L} × ${frac(k)} = ${frac(image)}$. The image segment has length ${frac(image)}.`,
        ],
        hint: `Every length in the image is ${frac(k)} times the matching length, whatever the center. Apply that to $AB = ${L}$.`,
        tags: ["image-length", kv < 1 ? "reduction" : "enlargement"],
        figure,
        label: "Length",
      };
    return {
      prompt: `A dilation with center $O$ maps segment $AB$, of length ${L}, to segment $A'B'$, of length ${frac(image)}. What is the scale factor?`,
      answer: k,
      explanation: [
        "A dilation resizes a figure from a fixed point, the center. Every distance in the figure is multiplied by the scale factor.",
        "So the scale factor is the image length divided by the original length.",
        `${frac(image)} ÷ ${L} = ${frac(k)}.`,
        kv < 1
          ? `It is less than 1, so the dilation shrinks the segment. The scale factor is ${frac(k)}.`
          : `It is greater than 1, so the dilation enlarges the segment. The scale factor is ${frac(k)}.`,
      ],
      hint: `Compare the image to the original: how many times ${L} is ${frac(image)}?`,
      tags: ["scale-factor", kv < 1 ? "reduction" : "enlargement"],
      figure,
      label: "Scale factor",
    };
  }
  if (mode === 2) {
    const k = pick(r, [q(2), q(3), q(1, 2), q(3, 2)]);
    let C: Point, P: Point;
    do {
      C = [r(-4, 4), r(-4, 4)];
      P = [C[0] + r(-4, 4) * k.d, C[1] + r(-4, 4) * k.d];
    } while (
      (P[0] === C[0] && P[1] === C[1]) ||
      Math.abs(P[0]) > 8 ||
      Math.abs(P[1]) > 8
    );
    const axis = r(0, 1);
    const image: Point = [
      C[0] + value(k) * (P[0] - C[0]),
      C[1] + value(k) * (P[1] - C[1]),
    ];
    const c = C[axis]!,
      p = P[axis]!,
      answer = add(q(c), mul(k, q(p - c)));
    const name = axis ? "y" : "x";
    const ext = Math.max(9, ...image.map((v) => Math.ceil(Math.abs(v)) + 1));
    return {
      prompt: `A dilation with center $C${pt(C)}$ and scale factor ${frac(k)} maps $P${pt(P)}$ to $P'$. What is the $${name}$-coordinate of $P'$?`,
      answer,
      explanation: [
        `A dilation resizes a figure from a fixed point, the center. Every distance in the figure is multiplied by the scale factor. Each point slides along the line from the center through it.`,
        `So measure from the center, not the origin. The step from $C$ to $P$ is ${pt([P[0] - C[0], P[1] - C[1]])}: across, then up or down.`,
        `Multiply that step by ${frac(k)}: (${frac(mul(k, q(P[0] - C[0])))}, ${frac(mul(k, q(P[1] - C[1])))}).`,
        `Start at $C$ and take the new step: $${frac(q(c))} ${p - c < 0 ? "−" : "+"} ${frac(mul(k, q(Math.abs(p - c))))} = ${frac(answer)}$.`,
        `The $${name}$-coordinate of $P'$ is ${frac(answer)}.`,
      ],
      hint: `Measure the step from the center $C$ to $P$, not from the origin. Multiply that step by ${frac(k)}, then add it to $C$.`,
      tags: ["center", `axis-${name}`],
      figure: graph({ x: [-ext, ext], y: [-ext, ext], tick: 2 })
        .id("g")
        .point(C[0], C[1], "C")
        .point(P[0], P[1], "P")
        .segment(C, P, { arrow: true })
        .scene({
          title: "Center C and point P",
          steps: [
            step(
              "The step from $C$ to $P$ is what the dilation scales.",
              act.trace("g.segment.0"),
            ),
          ],
        }),
      label: `$${name}$-coordinate`,
    };
  }
  const kind = r(0, 1);
  const k = pick(r, [q(1, 2), q(3, 2), q(2), q(3), q(5, 2)]);
  if (kind === 0) {
    const m = q(r(-6, 6) || 1, r(1, 5));
    return {
      prompt: `Line ℓ has slope ${frac(m)} and does not pass through the center of a dilation with scale factor ${frac(k)}. What is the slope of the image of ℓ?`,
      answer: m,
      explanation: [
        "A dilation resizes from a center, multiplying every distance by the scale factor. It changes sizes but not directions.",
        "Slope is rise ÷ run, the steepness of a line. A step along the line has its rise and its run both multiplied by the same factor.",
        `Multiplying the top and bottom of a fraction by ${frac(k)} leaves its value unchanged. So rise ÷ run stays ${frac(m)}.`,
        `The image line is parallel to ℓ, and its slope is ${frac(m)}.`,
      ],
      hint: `Under a dilation by ${frac(k)}, both the rise and the run of any step along ℓ are multiplied by ${frac(k)}. What happens to their ratio?`,
      tags: ["slope"],
      label: "Slope",
    };
  }
  const angle = r(20, 160);
  return {
    prompt: `Triangle $ABC$ has $\\angle B = ${angle}°$. A dilation with scale factor ${frac(k)} maps it to triangle $A'B'C'$. What is the measure of $\\angle B'$, in degrees?`,
    answer: q(angle),
    explanation: [
      "A dilation resizes a figure from a center: lengths are multiplied by the scale factor, but the shape stays the same.",
      "Keeping the shape means keeping every angle. Stretching both sides of an angle by the same factor does not open or close it.",
      `So $\\angle B' = \\angle B = ${angle}°$. Angle $B'$ measures ${angle} degrees.`,
    ],
    hint: `A dilation by ${frac(k)} changes lengths. Does it change the angle between two sides at $B$?`,
    tags: ["angle"],
    label: "Degrees",
  };
}

// --------------------------------------------------- special right triangles
function specialCase(r: Random): Case {
  const kind = r(0, 1) ? "30-60-90" : "45-45-90";
  const a = r(2, 12);
  if (kind === "45-45-90") {
    const mode = r(0, 2);
    // Legs a, a; hypotenuse a√2.
    const P: [Point, Point, Point] = [
      [0, 0],
      [a, 0],
      [0, a],
    ];
    const tri = (given: number, asked: number, text: string) =>
      triangle(P)
        .side(given as 0 | 1 | 2, { label: text })
        .side(asked as 0 | 1 | 2, { label: null })
        .angle(0, { mark: "right" })
        .angle(1, { mark: "arc", label: "45°" })
        .angle(2, { mark: "arc", label: "45°" })
        .id("t");
    if (mode === 0)
      return {
        prompt: `A 45°-45°-90° triangle has legs of length ${a}. Its hypotenuse is c√2. What is $c$?`,
        answer: q(a),
        explanation: [
          "A 45°-45°-90° triangle is a right triangle with two equal legs, the sides that form the right angle. The hypotenuse is the longest side, across from the right angle.",
          `The Pythagorean theorem says leg² + leg² = hypotenuse². Here that is ${a}² + ${a}² = 2 × ${a}².`,
          `Take the square root: the hypotenuse is $\\sqrt{2 \\times ${a}^2} = ${a}\\sqrt{2}$. In every 45°-45°-90° triangle, the hypotenuse is a leg times $\\sqrt{2}$.`,
          `The hypotenuse is ${a}√2, so c = ${a}.`,
        ],
        hint: `With legs ${a} and ${a}, the Pythagorean theorem gives hypotenuse² = ${a}² + ${a}² = 2 × ${a}². Take the square root.`,
        tags: ["45", "leg-to-hypotenuse"],
        figure: tri(0, 1, String(a)).scene({ title: "A 45°-45°-90° triangle" }),
        label: "c",
      };
    if (mode === 1)
      return {
        prompt: `A 45°-45°-90° triangle has a hypotenuse of length ${a}√2. How long is each leg?`,
        answer: q(a),
        explanation: [
          "A 45°-45°-90° triangle is a right triangle with two equal legs. Its hypotenuse, the longest side, is always a leg times √2.",
          `This comes from the Pythagorean theorem: leg² + leg² = 2 × leg², and the square root of that is the leg times $\\sqrt{2}$.`,
          `To go back from the hypotenuse to a leg, divide by √2: ${a}√2 ÷ √2 = ${a}.`,
          `Each leg is ${a}.`,
        ],
        hint: `The hypotenuse is a leg times √2. Undo that multiplication on ${a}√2.`,
        tags: ["45", "hypotenuse-to-leg"],
        figure: tri(1, 0, `${a}√2`).scene({ title: "A 45°-45°-90° triangle" }),
        label: "Leg length",
      };
    const h = 2 * a;
    return {
      prompt: `A 45°-45°-90° triangle has a hypotenuse of length ${h}. Each leg is c√2. What is $c$?`,
      answer: q(a),
      explanation: [
        "A 45°-45°-90° triangle has two equal legs, and its hypotenuse is a leg times √2.",
        `So a leg is the hypotenuse divided by √2: ${h}/√2.`,
        `A root left in the bottom is usually cleared. Multiply the top and bottom by √2, which is the same as multiplying by 1: ${h}√2/2 = ${a}√2.`,
        `Each leg is ${a}√2, so c = ${a}.`,
      ],
      hint: `A leg is ${h} ÷ √2. Rationalize: multiply the top and bottom by √2.`,
      tags: ["45", "rationalize"],
      figure: tri(1, 0, String(h)).scene({ title: "A 45°-45°-90° triangle" }),
      label: "c",
    };
  }
  // Short leg a (opposite 30°), long leg a√3, hypotenuse 2a.
  const P: [Point, Point, Point] = [
    [0, 0],
    [a * Math.sqrt(3), 0],
    [0, a],
  ];
  const mode = r(0, 3);
  const sides: Record<string, 0 | 1 | 2> = { long: 0, hyp: 1, short: 2 };
  const draw = (given: string, text: string, asked: string) =>
    triangle(P)
      .side(sides[given]!, { label: text })
      .side(sides[asked]!, { label: null })
      .angle(0, { mark: "right" })
      .angle(1, { mark: "arc", label: "30°" })
      .angle(2, { mark: "arc", arcs: 2, label: "60°" })
      .id("t")
      .scene({
        title: "A 30°-60°-90° triangle",
        steps: [
          step(
            "The short leg is opposite the 30° angle; the hypotenuse is twice it.",
            light(`t.side.${sides.short}`, "accent"),
            light(`t.side.${sides.hyp}`, "warm"),
          ),
          step(
            "The long leg is the short leg times √3.",
            light(`t.side.${sides.long}`, "gold"),
          ),
        ],
      });
  const forms = [
    {
      prompt: `In a 30°-60°-90° triangle, the shorter leg has length ${a}. How long is the hypotenuse?`,
      answer: q(2 * a),
      explanation: [
        "A 30°-60°-90° triangle is half of an equilateral triangle, a triangle with three equal sides. Cutting it in half makes the shorter leg half a full side.",
        "So the hypotenuse, a full side, is twice the shorter leg. The shorter leg is the one across from the 30° angle.",
        `${a} × 2 = ${2 * a}. The hypotenuse is ${2 * a}.`,
      ],
      hint: `The shorter leg, ${a}, is opposite 30°. Halve an equilateral triangle to see why the hypotenuse is twice it.`,
      tags: ["30", "short-to-hypotenuse"],
      figure: draw("short", String(a), "hyp"),
      label: "Hypotenuse",
    },
    {
      prompt: `In a 30°-60°-90° triangle, the hypotenuse has length ${2 * a}. The longer leg is c√3. What is $c$?`,
      answer: q(a),
      explanation: [
        "A 30°-60°-90° triangle is half of an equilateral triangle. Its sides follow the pattern 1 : √3 : 2 (short leg : long leg : hypotenuse).",
        `The shorter leg is half the hypotenuse: ${2 * a} ÷ 2 = ${a}.`,
        `The longer leg is the shorter leg times √3: ${a}√3, so c = ${a}.`,
      ],
      hint: `Go through the shorter leg: it is half of ${2 * a}. The longer leg is that times √3.`,
      tags: ["30", "hypotenuse-to-long"],
      figure: draw("hyp", String(2 * a), "long"),
      label: "c",
    },
    {
      prompt: `In a 30°-60°-90° triangle, the longer leg has length ${a}√3. How long is the hypotenuse?`,
      answer: q(2 * a),
      explanation: [
        "A 30°-60°-90° triangle is half of an equilateral triangle. Its sides follow the pattern 1 : √3 : 2 (short leg : long leg : hypotenuse).",
        `The longer leg is the shorter leg times √3. The longer leg is ${a}√3, so the shorter leg is ${a}.`,
        `The hypotenuse is twice the shorter leg: ${a} × 2 = ${2 * a}.`,
      ],
      hint: `Divide ${a}√3 by √3 for the shorter leg, then double it.`,
      tags: ["30", "long-to-hypotenuse"],
      figure: draw("long", `${a}√3`, "hyp"),
      label: "Hypotenuse",
    },
    {
      prompt: `In a 30°-60°-90° triangle, the longer leg has length ${3 * a}. The shorter leg is c√3. What is $c$?`,
      answer: q(a),
      explanation: [
        "A 30°-60°-90° triangle is half of an equilateral triangle. Its sides follow the pattern 1 : √3 : 2 (short leg : long leg : hypotenuse).",
        `The shorter leg is the longer leg divided by √3: ${3 * a}/√3.`,
        `Clear the root from the bottom: multiply the top and bottom by √3, which is multiplying by 1. ${3 * a}√3/3 = ${a}√3.`,
        `The shorter leg is ${a}√3, so c = ${a}.`,
      ],
      hint: `The shorter leg is ${3 * a} ÷ √3. Rationalize the denominator.`,
      tags: ["30", "rationalize"],
      figure: draw("long", String(3 * a), "short"),
      label: "c",
    },
  ];
  return forms[mode]!;
}

// ------------------------------------------------------- trigonometric ratios
const triples: readonly [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];
type Ratio = "sin" | "cos" | "tan";
function trigCase(r: Random): Case {
  const [p, qq, h0] = pick(r, triples);
  const m = r(1, 3);
  const [x, y, hyp] = r(0, 1)
    ? [p * m, qq * m, h0 * m]
    : [qq * m, p * m, h0 * m];
  // Right angle at C. A at the left end of the horizontal leg CA = x; the
  // vertical leg CB = y is opposite A.
  const P: [Point, Point, Point] = [
    [0, 0],
    [x, 0],
    [x, y],
  ];
  const fn = pick(r, ["sin", "cos", "tan"] as const);
  const at = r(0, 1) ? "A" : "B";
  // Opposite and adjacent for the chosen angle.
  const [opp, adj] = at === "A" ? [y, x] : [x, y];
  const exact: Record<Ratio, Rational> = {
    sin: q(opp, hyp),
    cos: q(adj, hyp),
    tan: q(opp, adj),
  };
  const parts: Record<Ratio, [string, string, number, number]> = {
    sin: ["opposite", "hypotenuse", opp, hyp],
    cos: ["adjacent", "hypotenuse", adj, hyp],
    tan: ["opposite", "adjacent", opp, adj],
  };
  // Sides: 0 = AC (x), 1 = CB (y), 2 = BA (hyp).
  const sideOf = (len: number) =>
    len === hyp ? 2 : len === x && len !== y ? 0 : len === y ? 1 : 0;
  const mode = r(0, 3);
  const base = () =>
    triangle(P)
      .names("A", "C", "B")
      .angle(1, { mark: "right" })
      .angle(at === "A" ? 0 : 2, { mark: "arc" })
      .id("t");
  const steps = (f: Ratio) => [
    step(
      `The ${parts[f][0]} side for angle ${at}.`,
      light(
        `t.side.${f === "cos" ? (at === "A" ? 0 : 1) : at === "A" ? 1 : 0}`,
        "accent",
      ),
    ),
    step(
      `The ${parts[f][1]}.`,
      light(`t.side.${f === "tan" ? (at === "A" ? 0 : 1) : 2}`, "warm"),
    ),
  ];
  if (mode <= 1) {
    // All three sides, or two with the third found first.
    const missing = mode === 1 ? pick(r, [0, 1, 2] as const) : -1;
    let tri = base();
    for (const [i, len] of [x, y, hyp].entries())
      tri = tri.side(i as 0 | 1 | 2, {
        label: i === missing ? undefined : String(len),
      });
    const [num, den] = [parts[fn][2], parts[fn][3]];
    const third =
      missing === 2
        ? `First the hypotenuse: √(${x}² + ${y}²) = √${x * x + y * y} = ${hyp}.`
        : missing >= 0
          ? `First the missing leg: √(${hyp}² − ${[x, y][1 - missing]}²) = √${hyp * hyp - [x, y][1 - missing]! ** 2} = ${[x, y][missing]}.`
          : null;
    return {
      prompt: `In right triangle $ABC$, the right angle is at $C$. ${
        missing >= 0
          ? `${["AC", "CB", "AB"]
              .filter((_, i) => i !== missing)
              .map(
                (s, i) =>
                  `$${s} = ${[x, y, hyp].filter((_, j) => j !== missing)[i]}$`,
              )
              .join(" and ")}.`
          : `$AC = ${x}$, $CB = ${y}$ and $AB = ${hyp}$.`
      } Find ${math(`${fn} ${at}`)} as a fraction.`,
      answer: exact[fn],
      explanation: [
        ...(third ? [third] : []),
        "In a right triangle, the side opposite an angle is across from it, the adjacent side touches it, and the hypotenuse is the longest side, across from the right angle.",
        "Sine is opposite ÷ hypotenuse, cosine is adjacent ÷ hypotenuse, and tangent is opposite ÷ adjacent.",
        `For angle $${at}$, the ${parts[fn][0]} side is ${num} and the ${parts[fn][1]} is ${den}.`,
        `$\\${fn} ${at} = \\frac{\\text{${parts[fn][0]}}}{\\text{${parts[fn][1]}}}$ = ${ratio(num, den)}.`,
      ],
      hint:
        missing >= 0
          ? `Two sides are given, ${[x, y, hyp].filter((_, j) => j !== missing).join(" and ")}; the Pythagorean theorem gives the third. Then, standing at angle $${at}$, name the ${parts[fn][0]} side and the ${parts[fn][1]}.`
          : `Stand at angle $${at}$: the side across from it is opposite, the leg touching it is adjacent, and ${hyp} is the hypotenuse. $\\${fn}$ uses the ${parts[fn][0]} and the ${parts[fn][1]}.`,
      tags: [missing >= 0 ? "two-sides" : "three-sides", fn],
      figure: tri.scene({ title: "Right triangle ABC", steps: steps(fn) }),
      label: `$\\${fn} ${at}$`,
    };
  }
  if (mode === 2) {
    // A side from a ratio.
    const f = pick(r, ["sin", "cos"] as const);
    const [num, den] = [parts[f][2], parts[f][3]];
    const ratioV = q(num, den);
    const answer = q(num);
    let tri = base().side(2, { label: String(hyp) });
    const askedSide = sideOf(num);
    tri = tri.side(askedSide as 0 | 1, { label: null });
    return {
      prompt: `In right triangle $ABC$, the right angle is at $C$ and $AB = ${hyp}$. ${math(`${f} ${at} = ${frac(ratioV)}`)}. How long is the side ${f === "sin" ? "opposite" : "adjacent to"} angle $${at}$?`,
      answer,
      explanation: [
        "The hypotenuse is the longest side, across from the right angle. The other two sides are the legs: opposite the angle (across from it) or adjacent (touching it).",
        `${math(`${f} ${at}`)} = ${parts[f][0]} ÷ hypotenuse. Multiply both sides by the hypotenuse: ${parts[f][0]} = hypotenuse × ${math(`${f} ${at}`)}.`,
        `${hyp} × ${frac(ratioV)} = ${num}. The side ${parts[f][0]} to angle $${at}$ is ${num} long.`,
      ],
      hint: `${math(`${f} ${at}`)} compares the ${parts[f][0]} side to the hypotenuse, ${hyp}. Take ${frac(ratioV)} of ${hyp}.`,
      tags: ["side-from-ratio", f],
      figure: tri.scene({ title: "Right triangle ABC", steps: steps(f) }),
      label: "Length",
    };
  }
  // A ladder story.
  const f = pick(r, ["sin", "cos", "tan"] as const);
  // Ground leg x (foot to wall), height y, ladder hyp; angle with the ground at A.
  const v = { sin: q(y, hyp), cos: q(x, hyp), tan: q(y, x) }[f];
  return {
    prompt: `A ${hyp}-foot ladder leans against a vertical wall. Its foot is ${x} feet from the wall, and its top is ${y} feet above the ground. What is ${math(`${f} θ`)}, where θ is the angle between the ladder and the ground?`,
    answer: v,
    explanation: [
      "In a right triangle, the hypotenuse is the longest side, across from the right angle. Sine is opposite ÷ hypotenuse, cosine is adjacent ÷ hypotenuse, and tangent is opposite ÷ adjacent.",
      `The ladder is the slanted side, the hypotenuse: ${hyp}. From θ (theta) at the foot, the height ${y} is opposite and the ground distance ${x} is adjacent.`,
      `${math(`${f} θ`)} = ${f === "sin" ? `${y}/${hyp}` : f === "cos" ? `${x}/${hyp}` : `${y}/${x}`}${frac(v) === (f === "sin" ? `${y}/${hyp}` : f === "cos" ? `${x}/${hyp}` : `${y}/${x}`) ? "" : ` = ${frac(v)}`}.`,
    ],
    hint: `At the foot of the ladder, the wall height ${y} is opposite θ, the ground distance ${x} is adjacent, and the ladder ${hyp} is the hypotenuse.`,
    tags: ["ladder", f],
    figure: triangle(P)
      .side(0, { label: String(x) })
      .side(1, { label: String(y) })
      .side(2, { label: String(hyp) })
      .angle(1, { mark: "right" })
      .angle(0, { mark: "arc", label: "θ" })
      .id("t")
      .scene({ title: "A ladder against a wall" }),
    label: `${f} θ`,
  };
}

// ------------------------------------------------- complementary trigonometry
function complementaryCase(r: Random): Case {
  const mode = r(0, 3);
  if (mode === 0) {
    const a = r(5, 85);
    const [f, g] = r(0, 1) ? ["sin", "cos"] : ["cos", "sin"];
    return {
      prompt: `${math(`${f} ${a}° = ${g} x°`)}, where $x$ is between 0 and 90. What is $x$?`,
      answer: q(90 - a),
      explanation: [
        "In a right triangle the two acute (sharp) angles add to 90°. Two angles that add to 90° are complements.",
        "The side opposite one acute angle is adjacent to the other. So the sine of an angle equals the cosine of its complement.",
        `${math(`${f} ${a}° = ${g}(90 − ${a})°`)}, so x = 90 − ${a} = ${90 - a}.`,
      ],
      hint: `${f} of an angle equals ${g} of its complement, the angle that adds with ${a}° to 90°.`,
      tags: ["angle"],
      label: "x",
    };
  }
  if (mode === 1) {
    // f(px + b)° = g(sx + c)° with (p + s)x + b + c = 90.
    let p: number, s: number, x: number, b: number, c: number;
    do {
      [p, s, x] = [r(1, 4), r(1, 3), r(4, 20)];
      b = r(-10, 20);
      c = 90 - (p + s) * x - b;
    } while (
      p * x + b <= 0 ||
      s * x + c <= 0 ||
      p * x + b >= 90 ||
      s * x + c >= 90 ||
      Math.abs(c) > 40
    );
    const term = (k: number, t: number) =>
      `${k === 1 ? "" : k}x ${t < 0 ? "−" : "+"} ${Math.abs(t)}`;
    return {
      prompt: `${math(`sin(${term(p, b)})° = cos(${term(s, c)})°`)}, and both angles are acute. What is $x$?`,
      answer: q(x),
      explanation: [
        "In a right triangle, the side opposite one acute angle is adjacent to the other. So for acute angles, the sine of one equals the cosine of the other exactly when the angles add to 90°.",
        `(${term(p, b)}) + (${term(s, c)}) = 90, so ${p + s}x ${b + c < 0 ? "−" : "+"} ${Math.abs(b + c)} = 90.`,
        `${b + c < 0 ? "Add" : "Subtract"} ${Math.abs(b + c)} on both sides: ${p + s}x = ${90 - b - c}. Divide by ${p + s}: x = ${x}.`,
      ],
      hint: `The two angles, ${term(p, b)} and ${term(s, c)}, must be complementary. Set their sum equal to 90.`,
      tags: ["equation"],
      label: "x",
    };
  }
  const [a, b2, h] = pick(r, triples);
  const m = r(1, 3);
  const [x, y, hyp] = [a * m, b2 * m, h * m];
  const P: [Point, Point, Point] = [
    [0, 0],
    [x, 0],
    [x, y],
  ];
  const v = q(y, hyp);
  if (mode === 2) {
    const flip = r(0, 1) === 1;
    const [given, asked] = flip ? ["cos B", "sin A"] : ["sin A", "cos B"];
    return {
      prompt: `In right triangle $ABC$, the right angle is at $C$, and ${math(`${given} = ${frac(v)}`)}. Find ${math(asked)}.`,
      answer: v,
      explanation: [
        "$A$ and $B$ are the two acute (sharp) angles of a right triangle, so A + B = 90°.",
        "Sine is opposite ÷ hypotenuse, and cosine is adjacent ÷ hypotenuse.",
        "The side opposite $A$ is the side adjacent to $B$. Both ratios divide that same side by the hypotenuse, so $\\sin A = \\cos B$ and $\\cos A = \\sin B$.",
        `${math(`${asked} = ${frac(v)}`)}.`,
      ],
      hint: `${math(`${given} = ${frac(v)}`)} compares one leg with the hypotenuse. Find that leg: it is opposite one acute angle and next to the other.`,
      tags: ["triangle", flip ? "from-cos" : "from-sin"],
      figure: triangle(P)
        .names("A", "C", "B")
        .angle(1, { mark: "right" })
        .angle(0, { mark: "arc" })
        .angle(2, { mark: "arc", arcs: 2 })
        .id("t")
        .scene({
          title: "Right triangle ABC",
          steps: [
            step(
              "Opposite $A$ and next to $B$: the same side.",
              light("t.side.1", "accent"),
            ),
            step(
              "Both ratios divide it by the hypotenuse.",
              light("t.side.2", "warm"),
            ),
          ],
        }),
      label: asked,
    };
  }
  const v2 = q(r(1, 9), 10);
  return {
    prompt: `For an acute angle $A$, ${math(`sin A = ${frac(v2)}`)}. Find ${math("cos(90° − A)")}.`,
    answer: v2,
    explanation: [
      "90° − $A$ is the complement of $A$, the angle that adds with it to 90°. In a right triangle with angle $A$, it is the other acute angle.",
      "The side opposite $A$ is adjacent to that other angle. Sine uses the opposite side and cosine uses the adjacent side, both over the hypotenuse.",
      `So the cosine of the complement equals the sine of $A$: ${math(`cos(90° − A) = sin A = ${frac(v2)}`)}.`,
    ],
    hint: `$A$ and 90° − $A$ are the two acute angles of one right triangle. The side opposite $A$, which gives ${math(`sin A = ${frac(v2)}`)}, is adjacent to the other angle.`,
    tags: ["cofunction"],
    label: "cos(90° − $A$)",
  };
}

const builders: Record<string, (r: Random) => Case> = {
  "dilation-measure": dilationCase,
  "similar-triangle-side": similarCase,
  "special-right-triangle": specialCase,
  "trig-ratio": trigCase,
  "complementary-trig": complementaryCase,
};

export function similarityTrigCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = similarityTrigTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown similarity template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const c = builders[id]!(random(id, seed));
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: metadata.skillId,
      prompt: c.prompt,
      response: {
        kind: c.answer.d === 1 ? "number" : "fraction",
        label: c.label,
      },
      ...(c.figure
        ? { figure: { kind: "scene" as const, scene: c.figure } }
        : {}),
    },
    answer: answerText(c.answer),
    explanation: c.explanation,
    hint: c.hint,
  };
  return {
    problem,
    tags: c.tags,
    caseKey: `${c.prompt}${JSON.stringify(c.figure ?? null)}`,
  };
}
export const generateSimilarityTrigProblem = (
  id: string,
  seed: string,
): GeneratedProblem => similarityTrigCase(id, seed).problem;
