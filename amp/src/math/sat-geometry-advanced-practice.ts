import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  type Draft,
  type Random,
} from "./distribution-practice";

/**
 * SAT geometry and advanced-math problem types that the neighbouring skills
 * did not yet practise in the SAT's form: corresponding angles through a
 * written similarity or congruence statement, multi-step angle chains with
 * parallel lines, bound reasoning about angles, equal radii as triangle sides,
 * translations of polynomial rules, radical side lengths, special triangles
 * inside figures, and similar triangles formed by crossing segments.
 * Each template's variants differ in representation and unknown, not only size.
 */
type Meta = Omit<TemplateMetadata, "version" | "gradeBand">;
const choiceMeta = (meta: Meta): TemplateMetadata => ({
  ...meta,
  version: 1,
  gradeBand: "9–12",
  requiredResponseCapability: "single-choice-v1",
});
const numberMeta = (meta: Meta): TemplateMetadata => ({
  ...meta,
  version: 1,
  gradeBand: "9–12",
});

export const satGeometryAdvancedTemplates: readonly TemplateMetadata[] = [
  choiceMeta({
    id: "corresponding-angle-transfer",
    title: "Corresponding angles from a similarity or congruence statement",
    skillId: "similarity-proofs",
    description:
      "Match vertices through the order of letters in a similarity or congruence statement, then choose a corresponding angle directly, after a side scale factor, or after finding a third angle.",
    difficultyOffset: 0.3,
  }),
  numberMeta({
    id: "crossing-segment-similarity",
    title: "Similar triangles formed by crossing segments",
    skillId: "similarity-proofs",
    description:
      "Two segments cross; vertical angles and parallel segments or equal angles give similar triangles. Use equal ratios of corresponding sides to find a missing length.",
    difficultyOffset: 0.35,
  }),
  numberMeta({
    id: "angle-chase-chain",
    title: "Angle chains with parallel lines and triangles",
    skillId: "triangle-angle-theorems",
    description:
      "Solve for a variable from vertical-angle expressions and then use same-side interior angles, or chain a triangle angle sum with the angles made by a segment parallel to a side.",
    difficultyOffset: 0.4,
  }),
  choiceMeta({
    id: "angle-claim-reasoning",
    title: "Which angle statement must hold",
    skillId: "angle-relationships",
    description:
      "Use the triangle angle sum as a bound, compare vertical and adjacent angles, or decide which expression cannot be a sum of two angles formed by intersecting lines.",
    difficultyOffset: 0.35,
  }),
  numberMeta({
    id: "circle-radii-triangle",
    title: "Equal radii as sides of a triangle",
    skillId: "circle-theorems",
    description:
      "Two radii and a chord form an isosceles triangle. Find a base angle or a central angle from the others, or the chord or radius from the triangle's perimeter.",
    difficultyOffset: 0.3,
  }),
  numberMeta({
    id: "shifted-polynomial-features",
    title: "Features of a shifted polynomial",
    skillId: "function-transformations",
    description:
      "Find where a horizontally shifted quadratic reaches its extreme value, the sum of the $x$-intercepts of a shifted factored cubic, or a value of a vertically shifted factored cubic.",
    difficultyOffset: 0.4,
  }),
  numberMeta({
    id: "radical-side-entry",
    title: "Radical and decimal sides of right triangles",
    skillId: "pythagorean-theorem",
    description:
      "Enter the radicand or coefficient of a simplified hypotenuse from two legs, or find a missing leg when the sides are decimals.",
    difficultyOffset: 0.35,
  }),
  numberMeta({
    id: "special-triangle-in-figure",
    title: "Special triangles inside other figures",
    skillId: "special-right-triangles",
    description:
      "Recognize 45-degree and 30-60-90 triangles from side relations, and use them in an equilateral triangle's altitude or circumradius and in a square inscribed in a circle.",
    difficultyOffset: 0.4,
  }),
];

export type SatGeometryAdvancedCase = { draft: Draft; tag: string };
type Option = [label: string, feedback: string];

/** Exactly four distinct labels, the first correct; undefined when a draw
 * cannot supply three distinct wrong choices (the caller draws again). */
function choose(
  correct: string,
  wrong: Option[],
): Draft["choices"] | undefined {
  const seen = new Set([correct]);
  const out: NonNullable<Draft["choices"]> = [
    { label: correct, correct: true },
  ];
  for (const [label, feedback] of wrong) {
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, feedback });
    if (out.length === 4) return out;
  }
  return undefined;
}
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
function permute<T>(r: Random, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
const deg = (n: number) => `${n}°`;
const angle = (v: string) => `$\\angle ${v}$`;
const sgn = (n: number) => (n < 0 ? `-${-n}` : String(n));
/** ax + b as TeX, with unit coefficients and zero constants omitted. */
function lin(a: number, b: number) {
  const head = a === 1 ? "x" : a === -1 ? "-x" : `${a}x`;
  return b === 0 ? head : `${head}${b < 0 ? "-" : "+"}${Math.abs(b)}`;
}
/** (x + p) style factor for a zero at z. */
const factor = (z: number) =>
  z === 0 ? "x" : `(x${z < 0 ? "+" : "-"}${Math.abs(z)})`;
const wrongAngles = (correct: number, items: [number, string][]): Option[] =>
  items
    .filter(([v]) => v > 0 && v < 180 && v !== correct)
    .map(([v, f]) => [deg(v), f]);

const firstNames = ["ABC", "PQR", "JKL", "XYZ"];
const secondNames = ["DEF", "STU", "MNO", "GHI"];

/* ------------------------------------------------ corresponding angles */
const correspondingVariants = [
  "similar-scale",
  "similar-third",
  "similar-right",
  "congruent-direct",
  "congruent-right",
] as const;
function correspondingCase(r: Random): SatGeometryAdvancedCase {
  for (;;) {
    const tag = correspondingVariants[r(0, 4)]!;
    const first = [...pick(r, firstNames)];
    const second = permute(r, [...pick(r, secondNames)]);
    const similar = tag.startsWith("similar");
    const sym = similar ? "\\sim" : "\\cong";
    const statement = `$\\triangle ${first.join("")} ${sym} \\triangle ${second.join("")}$`;
    const word = similar ? "similar" : "congruent";
    const match = (i: number) => `$${first[i]}$ corresponds to $${second[i]}$`;
    const angles: number[] = [];
    let ask = 0;
    let setup = "";
    let correct = 0;
    let wrong: Option[] = [];
    let steps: string[] = [];
    let known = "";
    if (tag === "similar-scale") {
      const t = r(22, 59);
      const k = r(2, 3);
      const i = r(0, 2);
      ask = i;
      correct = t;
      known = `${angle(first[i]!)} measures ${deg(t)}`;
      setup = `Triangle $${first.join("")}$ is similar to triangle $${second.join("")}$ under the statement ${statement}, and every side of triangle $${second.join("")}$ is ${k} times as long as the corresponding side of triangle $${first.join("")}$. The measure of ${angle(first[i]!)} is ${deg(t)}.`;
      wrong = wrongAngles(correct, [
        [
          t * k,
          `Scaling multiplies side lengths by ${k}. It does not change angle measures.`,
        ],
        [
          180 - t,
          "This subtracts from $180^\\circ$, as if the angles made a straight line. Matching angles of similar triangles are equal, so nothing is subtracted.",
        ],
        [
          90 - t,
          "This subtracts from $90^\\circ$. That works for the two sharp angles of one right triangle, not for a matching pair in two triangles.",
        ],
        [
          180 - 2 * t,
          "This uses the triangle's angle sum. Here the angle you want matches a known angle, so it is simply equal to it.",
        ],
      ]);
      steps = [
        `The symbol $\\sim$ means similar: the same shape, possibly a different size. The order of the letters tells which corners match.`,
        `In ${statement}, the letters match in order: ${match(i)}.`,
        `Matching (corresponding) angles of similar triangles are equal. Growing a shape makes its sides longer but does not open or close its corners.`,
        `So the scale factor ${k} changes only the side lengths. ${angle(second[i]!)} has the same measure as ${angle(first[i]!)}.`,
        `${angle(second[i]!)} measures ${deg(t)}.`,
      ];
    } else if (tag === "similar-third" || tag === "congruent-direct") {
      let a = r(30, 80);
      let b = r(30, 80);
      if (a + b > 150 || a + b < 70 || a === b) {
        a = 47;
        b = 63;
      }
      const c = 180 - a - b;
      angles.push(a, b, c);
      const direct = tag === "congruent-direct";
      const i = direct ? r(0, 1) : 2;
      ask = i;
      correct = angles[i]!;
      known = `${angle(first[0]!)} measures ${deg(a)} and ${angle(first[1]!)} measures ${deg(b)}`;
      setup = `Triangle $${first.join("")}$ is ${word} to triangle $${second.join("")}$ under the statement ${statement}. In triangle $${first.join("")}$, ${angle(first[0]!)} measures ${deg(a)} and ${angle(first[1]!)} measures ${deg(b)}.`;
      const other = direct ? 1 - i : 0;
      wrong = wrongAngles(correct, [
        [
          angles[other]!,
          `This is the angle at $${first[other]}$, which matches $${second[other]}$, not $${second[i]}$. Read the matching from the order of the letters.`,
        ],
        [
          direct ? c : a + b,
          direct
            ? "This is the third angle of the triangle, a different corner. Use the angle at the corner that matches the one named."
            : "This adds the two given angles. The third angle is what is left of 180° after subtracting both.",
        ],
        [
          180 - correct,
          "This subtracts from 180°, as if the angles made a straight line. Matching angles of the two triangles are equal.",
        ],
        [
          direct ? 90 - correct : angles[1]!,
          "This matches the wrong corners. The first letter matches the first letter, the second the second, and the third the third.",
        ],
      ]);
      const symWords = similar
        ? "The symbol $\\sim$ means similar: the same shape, possibly a different size."
        : "The symbol $\\cong$ means congruent: the same size and shape.";
      steps = direct
        ? [
            `${symWords} The order of the letters tells which corners match.`,
            `In ${statement}, the letters match in order: ${match(i)}.`,
            `Matching (corresponding) angles of ${word} triangles are equal, so ${angle(second[i]!)} has the same measure as ${angle(first[i]!)}.`,
            `${angle(second[i]!)} measures ${deg(correct)}.`,
          ]
        : [
            `${symWords} The order of the letters tells which corners match.`,
            `In ${statement}, the letters match in order: ${match(2)}.`,
            `The three angles of any triangle add to 180°. So ${angle(first[2]!)} measures $180-${a}-${b}=${c}$ degrees.`,
            `Matching (corresponding) angles are equal, so ${angle(second[2]!)} has that same measure.`,
            `${angle(second[2]!)} measures ${deg(correct)}.`,
          ];
    } else {
      const a = r(25, 65);
      const rightAt = r(0, 2);
      const rest = [0, 1, 2].filter((v) => v !== rightAt);
      const givenAt = rest[r(0, 1)]!;
      const askAt = rest.find((v) => v !== givenAt)!;
      ask = askAt;
      correct = 90 - a;
      known = `${angle(first[rightAt]!)} is a right angle and ${angle(first[givenAt]!)} measures ${deg(a)}`;
      setup = `Triangle $${first.join("")}$ is ${word} to triangle $${second.join("")}$ under the statement ${statement}. In triangle $${first.join("")}$, ${angle(first[rightAt]!)} is a right angle and ${angle(first[givenAt]!)} measures ${deg(a)}.`;
      wrong = wrongAngles(correct, [
        [
          a,
          `This is the angle at $${first[givenAt]}$, which matches $${second[givenAt]}$, a different corner. Find the angle that matches the one named.`,
        ],
        [
          90 + a,
          "This adds instead of subtracting. The two sharp (acute) angles of a right triangle add to 90°, so subtract the given angle from 90°.",
        ],
        [
          180 - a,
          "This subtracts from 180°. The right angle already uses 90°, so the two sharp angles share the other 90°. Subtract from 90°.",
        ],
        [
          90 - a + 10,
          "This is 10° too big, an arithmetic slip. Subtract the given angle from 90° carefully.",
        ],
      ]);
      steps = [
        `${similar ? "The symbol $\\sim$ means similar: the same shape, possibly a different size." : "The symbol $\\cong$ means congruent: the same size and shape."} The order of the letters tells which corners match.`,
        `In ${statement}, the letters match in order, so ${angle(second[askAt]!)} matches ${angle(first[askAt]!)}.`,
        `A right angle is 90°, and a triangle's angles add to 180°. So the other two angles of triangle $${first.join("")}$ share the remaining 90°.`,
        `${angle(first[askAt]!)} measures $90-${a}=${correct}$ degrees.`,
        `Matching angles are equal, so ${angle(second[askAt]!)} measures ${deg(correct)}.`,
      ];
    }
    const label = deg(correct);
    const choices = choose(label, wrong);
    if (!choices) continue;
    const askVertex = second[ask]!;
    const hintLead =
      tag === "similar-scale"
        ? "A side scale factor changes lengths only."
        : "Corresponding vertices are listed in the same order in the statement.";
    return {
      tag,
      draft: {
        prompt: `${setup} What is the measure of ${angle(askVertex)}?`,
        answer: "",
        hint: `${hintLead} Find the corner of triangle $${first.join("")}$ in the same position as $${askVertex}$ in ${statement}. Then use what you know (${known}) to find that angle.`,
        explanation: steps,
        choices,
      },
    };
  }
}

/* ---------------------------------------------- crossing segments */
const crossingVariants = [
  "crossing-side",
  "crossing-near",
  "crossing-base",
] as const;
function crossingCase(r: Random): SatGeometryAdvancedCase {
  const tag = crossingVariants[r(0, 2)]!;
  const p = r(2, 5);
  let q = r(2, 6);
  if (q === p) q = p + 1;
  const m = r(1, 4);
  const n = r(1, 4);
  const t = r(1, 3);
  const AE = p * m,
    BE = q * m,
    CE = p * n,
    DE = q * n,
    AC = p * t,
    BD = q * t;
  const premise = r(0, 1)
    ? "Segment $AC$ is parallel to segment $BD$."
    : "$\\angle CAE$ and $\\angle DBE$ have equal measures.";
  const reason = premise.includes("parallel")
    ? "Because $AC \\parallel BD$, the alternate interior angles at $A$ and $B$ are equal"
    : "The stated equal angles at $A$ and $B$ are one pair of equal angles";
  const head = `Segments $AB$ and $CD$ intersect at point $E$. ${premise}`;
  let given: string;
  let ask: string;
  let answer: number;
  let ratioLine: string;
  let hintAsk: string;
  if (tag === "crossing-side") {
    given = `$AE=${AE}$, $BE=${BE}$ and $CE=${CE}$`;
    ask = "$DE$";
    answer = DE;
    ratioLine = `$\\dfrac{AE}{BE}=\\dfrac{CE}{DE}$, so $\\dfrac{${AE}}{${BE}}=\\dfrac{${CE}}{DE}$.`;
    hintAsk =
      "$DE$ is the side of triangle $BED$ that matches $CE$ in triangle $AEC$";
  } else if (tag === "crossing-near") {
    given = `$AE=${AE}$, $CE=${CE}$ and $DE=${DE}$`;
    ask = "$BE$";
    answer = BE;
    ratioLine = `$\\dfrac{AE}{BE}=\\dfrac{CE}{DE}$, so $\\dfrac{${AE}}{BE}=\\dfrac{${CE}}{${DE}}$.`;
    hintAsk =
      "$BE$ is the side of triangle $BED$ that matches $AE$ in triangle $AEC$";
  } else {
    given = `$AE=${AE}$, $BE=${BE}$ and $AC=${AC}$`;
    ask = "$BD$";
    answer = BD;
    ratioLine = `$\\dfrac{AE}{BE}=\\dfrac{AC}{BD}$, so $\\dfrac{${AE}}{${BE}}=\\dfrac{${AC}}{BD}$.`;
    hintAsk =
      "$BD$ is the side of triangle $BED$ that matches $AC$ in triangle $AEC$";
  }
  return {
    tag,
    draft: {
      prompt: `${head} Given ${given}. What is the length of segment ${ask}? Enter the length as a number.`,
      answer: String(answer),
      hint: `Look for triangles $AEC$ and $BED$. The angles at $E$ are vertical angles, so they are equal, and the premise supplies a second equal pair. Match the vertices in order, $A$ with $B$, $E$ with $E$, $C$ with $D$; ${hintAsk}. Put ${given} into the ratio of matching sides.`,
      explanation: [
        `Where the segments cross at $E$, $\\angle AEC$ and $\\angle BED$ are vertical angles, the opposite angles at a crossing. Vertical angles are always equal.`,
        premise.includes("parallel")
          ? `${reason}. Alternate interior angles sit between the parallel segments, on opposite sides of the crossing line.`
          : `${reason}.`,
        `Two pairs of equal angles make the triangles similar: the same shape, different sizes. Triangle $AEC$ matches triangle $BED$, with $A\\leftrightarrow B$, $E\\leftrightarrow E$ and $C\\leftrightarrow D$.`,
        `In similar triangles every side is scaled by the same number, so matching sides form equal ratios: ${ratioLine}`,
        `Cross-multiply, multiplying each side by both denominators, then divide to get the unknown alone.`,
        `The length of segment ${ask} is ${answer}.`,
      ],
    },
  };
}

/* ------------------------------------------------------ angle chains */
const chainVariants = [
  "vertical-sameside",
  "triangle-parallel",
  "right-parallel",
] as const;
function chainCase(r: Random): SatGeometryAdvancedCase {
  for (;;) {
    const tag = chainVariants[r(0, 2)]!;
    if (tag === "vertical-sameside") {
      const x = r(5, 30);
      const p = r(2, 5);
      let s = r(1, p - 1);
      if (s === p) s = 1;
      const q = r(-10, 25);
      const d = (p - s) * x;
      const u = q + d; // second constant makes the two expressions equal at x
      const value = p * x + q;
      if (value < 30 || value > 150 || value === 90 || u === 0) continue;
      const c1 = lin(p, q);
      const c2 = lin(s, u);
      return {
        tag,
        draft: {
          prompt: `Lines $\\ell$ and $m$ are parallel and are cut by transversal $t$. At the point where $t$ meets $\\ell$, two vertical angles measure $(${c1})^\\circ$ and $(${c2})^\\circ$. The first angle lies between $\\ell$ and $m$. What is the measure, in degrees, of the angle between $\\ell$ and $m$ on the same side of $t$ as the first angle, at the point where $t$ meets $m$?`,
          answer: String(180 - value),
          hint: `Vertical angles, the opposite angles where two lines cross, are equal. So set $${c1}=${c2}$ and solve for $x$ first.`,
          explanation: [
            `A transversal is a line that crosses two other lines, here $t$ crossing $\\ell$ and $m$. Vertical angles are the opposite angles where two lines cross, and they are equal.`,
            `So set the two expressions equal: $${c1}=${c2}$.`,
            `Subtract $${s === 1 ? "" : s}x$ and ${q < 0 ? "add" : "subtract"} ${Math.abs(q)} on both sides: $${p - s === 1 ? "" : p - s}x=${u - q}$, so $x=${x}$.`,
            `The first angle measures $${p}\\cdot ${x}${q < 0 ? "-" : "+"}${Math.abs(q)}=${value}$ degrees.`,
            `The angle you want is a same-side interior angle: between the parallel lines, on the same side of $t$. Such a pair adds to 180°.`,
            `So subtract: $180-${value}=${180 - value}$. The angle measures ${180 - value} degrees.`,
          ],
        },
      };
    }
    const right = tag === "right-parallel";
    const a = r(25, 70);
    const b = right ? 90 : r(25, 80);
    if (!right && (a + b <= 95 || a + b >= 150)) continue;
    const c = 180 - a - b;
    const answer = 180 - c;
    const givenB = right
      ? "$\\angle B$ is a right angle"
      : `$\\angle B$ measures ${deg(b)}`;
    return {
      tag,
      draft: {
        prompt: `In triangle $ABC$, $\\angle A$ measures ${deg(a)} and ${givenB}. Point $D$ lies on $\\overline{AB}$ and point $E$ lies on $\\overline{BC}$, and $\\overline{DE}$ is parallel to $\\overline{AC}$. What is the measure, in degrees, of the obtuse angle $\\angle DEC$?`,
        answer: String(answer),
        hint: `Find $\\angle C$ from the triangle angle sum, using ${deg(a)} and ${right ? "the right angle" : deg(b)}. Because $\\overline{DE}\\parallel\\overline{AC}$, the angle at $E$ inside triangle $DBE$ matches $\\angle C$. Then $\\angle DEC$ and that angle form a straight line.`,
        explanation: [
          `The three angles of any triangle add to 180°. So $\\angle C=180-${a}-${b}=${c}$ degrees.`,
          `$\\overline{DE}$ is parallel to $\\overline{AC}$, and $\\overline{BC}$ crosses both. Corresponding angles, in matching positions at each crossing, are equal.`,
          `So $\\angle DEB$ matches $\\angle ACB$: $\\angle DEB=${c}$ degrees.`,
          `$\\angle DEB$ and $\\angle DEC$ sit side by side on the straight line $\\overline{BC}$, so they add to 180°: $180-${c}=${answer}$.`,
          `$\\angle DEC$ measures ${answer} degrees, more than 90°, so it is the obtuse angle.`,
        ],
      },
    };
  }
}

/* -------------------------------------------------- angle claims */
const claimVariants = [
  "triangle-possible",
  "triangle-impossible",
  "compare-adjacent",
  "compare-vertical",
  "sum-impossible",
] as const;
function claimCase(r: Random): SatGeometryAdvancedCase {
  for (;;) {
    const tag = claimVariants[r(0, 4)]!;
    if (tag === "triangle-possible" || tag === "triangle-impossible") {
      const a = r(96, 140);
      const bound = 180 - a;
      const below = r(4, bound - 4);
      const above = [
        bound,
        bound + r(2, 9),
        bound + r(10, 30),
        bound + r(31, 50),
      ];
      const possible = tag === "triangle-possible";
      const correct = possible ? below : above[r(0, 3)]!;
      const pool: number[] = possible
        ? above
        : [
            below,
            r(2, Math.max(3, Math.floor(bound / 2))),
            r(Math.floor(bound / 2) + 1, bound - 1),
            1,
          ];
      const wrong: Option[] = pool.map((v) => [
        deg(v),
        possible
          ? `This is too big. $\\angle B$ and $\\angle C$ share ${bound}°, and $\\angle C$ needs some of it, so $\\angle B$ must be less than ${bound}°. ${v}° is not.`
          : `This is possible: ${v}° leaves ${bound - v}° for $\\angle C$, and every angle just needs to be more than 0°.`,
      ]);
      const choices = choose(deg(correct), wrong);
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: `In triangle $ABC$, $\\angle A$ measures ${deg(a)}. Which of the following ${possible ? "could be" : "cannot be"} the measure of $\\angle B$?`,
          answer: "",
          hint: `The three angles add to 180°, and every angle is more than 0°. Start with ${deg(a)}: find what $\\angle B$ and $\\angle C$ must add to.`,
          explanation: [
            `The three angles of any triangle add to 180°. So $\\angle B+\\angle C=180-${a}=${bound}$ degrees.`,
            `Every angle of a triangle is more than 0°. So $\\angle C$ takes some of the ${bound}°, and $\\angle B$ must be less than ${bound}°.`,
            possible
              ? `Only ${correct}° is less than ${bound}°. It leaves ${bound - correct}° for $\\angle C$, which works.`
              : `${correct}° is not less than ${bound}°, so it would leave nothing (or less than nothing) for $\\angle C$.`,
            possible
              ? `So ${correct}° could be the measure of $\\angle B$.`
              : `So ${correct}° cannot be the measure of $\\angle B$.`,
          ],
          choices,
        },
      };
    }
    if (tag === "compare-adjacent" || tag === "compare-vertical") {
      const d = r(35, 145);
      if (d === 90) continue;
      const vertical = tag === "compare-vertical";
      const rel = vertical ? "equal" : d > 90 ? "less" : "greater";
      const names: Record<string, string> = {
        equal: "$\\angle X$ and $\\angle Y$ have equal measures",
        greater: "$\\angle X$ has the greater measure",
        less: "$\\angle Y$ has the greater measure",
        unknown:
          "The comparison cannot be determined from the information given",
      };
      const choices = choose(
        names[rel]!,
        (["equal", "greater", "less", "unknown"] as const)
          .filter((k) => k !== rel)
          .map((k): Option => [
            names[k]!,
            k === "unknown"
              ? "It can be determined. When two lines cross, knowing one angle fixes all four, and $\\angle Y$ is given."
              : vertical
                ? "Vertical angles, the opposite angles at a crossing, are always equal. Neither one is greater."
                : k === "equal"
                  ? "Angles that make a straight line add to 180°. They are equal only when each is 90°, and $\\angle Y$ is not 90°."
                  : "Find $\\angle X$ first: it is 180° minus $\\angle Y$. Then compare the two numbers.",
          ]),
      );
      if (!choices) continue;
      return {
        tag,
        draft: {
          prompt: vertical
            ? `Two lines intersect, forming $\\angle X$ and $\\angle Y$ as vertical angles. $\\angle Y$ measures ${deg(d)}. Which statement is true?`
            : `Two lines intersect, forming $\\angle X$ and $\\angle Y$ as adjacent angles that together make a straight line. $\\angle Y$ measures ${deg(d)}. Which statement is true?`,
          answer: "",
          hint: vertical
            ? `Think about which angles are across the intersection from each other and what is always true about them, then compare $\\angle X$ with the ${deg(d)} angle $\\angle Y$.`
            : `Adjacent angles on a straight line add to 180°. Find $\\angle X$ from the ${deg(d)} angle $\\angle Y$ and compare the two.`,
          explanation: vertical
            ? [
                "Vertical angles are the angles opposite each other where two lines cross.",
                "Each one makes a straight line with the same neighbor angle, so they are always equal.",
                `So $\\angle X$ measures ${deg(d)}, the same as $\\angle Y$.`,
                "The true statement: $\\angle X$ and $\\angle Y$ have equal measures.",
              ]
            : [
                "Adjacent angles share a side. These two together make a straight line, which is 180°.",
                `So $\\angle X=180-${d}=${180 - d}$ degrees.`,
                `Compare: ${180 - d}° and ${d}°.`,
                d > 90
                  ? "The true statement: $\\angle Y$ has the greater measure."
                  : "The true statement: $\\angle X$ has the greater measure.",
              ],
          choices,
        },
      };
    }
    // sum-impossible
    const a = r(1, 3);
    const b = r(-12, 30) || 5;
    const e = lin(a, b);
    const doubled = lin(2 * a, 2 * b);
    const supp = lin(-2 * a, 360 - 2 * b);
    const fakes = [
      lin(a, b + 90),
      lin(-a, 180 - b),
      lin(a, b + 180),
      lin(3 * a, 3 * b),
    ];
    const correctExpr = fakes[r(0, 3)]!;
    const allowed = [
      [
        doubled,
        `This sum is possible. Choose the angle and its vertical twin, the equal angle across the crossing: $2(${e})=${doubled}$.`,
      ],
      [
        "180",
        "This sum is possible. Two neighboring angles make a straight line, which is always 180°.",
      ],
      [
        supp,
        `This sum is possible. Choose the two other angles, each $180-(${e})$: $2(180-(${e}))=${supp}$.`,
      ],
    ] as const;
    const choices = choose(
      `$${correctExpr}$`,
      allowed.map(([expr, why]): Option => [
        expr === "180" ? "$180$" : `$${expr}$`,
        why,
      ]),
    );
    if (!choices) continue;
    return {
      tag,
      draft: {
        prompt: `Two lines intersect, forming four angles. One of the angles measures $(${e})^\\circ$. Two of the four angles are chosen. Which of the following cannot be the sum of the measures of the two chosen angles, in degrees?`,
        answer: "",
        hint: `Two crossing lines make two pairs of equal opposite angles, and neighbors add to 180°. Starting from $(${e})^\\circ$, list every way to choose two of the four angles.`,
        explanation: [
          "Where two lines cross, opposite angles (vertical angles) are equal. Neighboring angles make a straight line, so they add to 180°.",
          `So the four angles are $${e}$, its opposite twin $${e}$, and two angles of $180-(${e})$ each. The second kind is the supplement, what makes 180° with it.`,
          `Two of the given kind add to $${doubled}$. One of each kind adds to 180. Two supplements add to $${supp}$.`,
          `Those are the only three possible sums. $${correctExpr}$ is not one of them.`,
          `So $${correctExpr}$ cannot be the sum of the two chosen angles.`,
        ],
        choices,
      },
    };
  }
}

/* ------------------------------------------------- circle radii */
const radiiVariants = [
  "base-angle",
  "base-angle-arc",
  "central-from-base",
  "chord-perimeter",
  "radius-perimeter",
] as const;
function radiiCase(r: Random): SatGeometryAdvancedCase {
  const tag = radiiVariants[r(0, 4)]!;
  if (
    tag === "base-angle" ||
    tag === "base-angle-arc" ||
    tag === "central-from-base"
  ) {
    const theta = 2 * r(20, 70);
    const base = (180 - theta) / 2;
    if (tag === "central-from-base")
      return {
        tag,
        draft: {
          prompt: `Points $A$ and $B$ lie on a circle with center $O$, and $\\overline{AB}$ is a chord. $\\angle OAB$ measures ${deg(base)}. What is the measure, in degrees, of $\\angle AOB$?`,
          answer: String(theta),
          hint: `$\\overline{OA}$ and $\\overline{OB}$ are both radii. What does that say about the angles opposite them in triangle $OAB$? Then use the angle sum with the ${deg(base)} base angle.`,
          explanation: [
            `A radius is a segment from the center to the circle. $OA$ and $OB$ are both radii, so they are equal.`,
            `A triangle with two equal sides is isosceles. The angles across from the equal sides are equal: $\\angle OBA=\\angle OAB=${base}$ degrees.`,
            `The three angles of a triangle add to 180°: $\\angle AOB=180-${base}-${base}=${theta}$.`,
            `$\\angle AOB$ measures ${theta} degrees.`,
          ],
        },
      };
    const arc = tag === "base-angle-arc";
    return {
      tag,
      draft: {
        prompt: arc
          ? `Points $A$ and $B$ lie on a circle with center $O$. Minor arc $AB$ measures ${deg(theta)}. What is the measure, in degrees, of $\\angle OAB$?`
          : `Points $A$ and $B$ lie on a circle with center $O$, and $\\overline{AB}$ is a chord. $\\angle AOB$ measures ${deg(theta)}. What is the measure, in degrees, of $\\angle OAB$?`,
        answer: String(base),
        hint: arc
          ? `A minor arc has the same measure as its central angle, here ${deg(theta)}. Then notice that $\\overline{OA}$ and $\\overline{OB}$ are both radii, which makes triangle $OAB$ isosceles.`
          : `$\\overline{OA}$ and $\\overline{OB}$ are both radii, which makes triangle $OAB$ isosceles. Use the angle sum with the ${deg(theta)} central angle and the two equal base angles.`,
        explanation: [
          ...(arc
            ? [
                `A central angle has its corner at the center. It measures the same as the arc it cuts off, so $\\angle AOB=${theta}$ degrees.`,
              ]
            : []),
          `A radius is a segment from the center to the circle. $OA$ and $OB$ are both radii, so they are equal.`,
          `A triangle with two equal sides is isosceles, and the angles across from those sides are equal. So $\\angle OAB=\\angle OBA$.`,
          `The three angles add to 180°, so the two equal angles share $180-${theta}=${180 - theta}$ degrees.`,
          `Each gets half: $\\angle OAB=${180 - theta}\\div 2=${base}$. So $\\angle OAB$ measures ${base} degrees.`,
        ],
      },
    };
  }
  const rad = r(5, 16);
  const chord = r(3, Math.min(2 * rad - 1, 20));
  const per = 2 * rad + chord;
  if (tag === "chord-perimeter")
    return {
      tag,
      draft: {
        prompt: `Points $A$ and $B$ lie on a circle with center $O$ and radius ${rad}. The perimeter of triangle $OAB$ is ${per}. What is the length of chord $\\overline{AB}$?`,
        answer: String(chord),
        hint: `Two sides of triangle $OAB$ are radii of the circle. Subtract their lengths (${rad} each) from the perimeter ${per}.`,
        explanation: [
          `A radius runs from the center to the circle. $OA$ and $OB$ are both radii, so each is ${rad} long.`,
          `A chord is a segment joining two points on the circle, here $\\overline{AB}$.`,
          `The perimeter is the distance around the triangle: $OA+OB+AB=${per}$.`,
          `Subtract the two radii: $AB=${per}-${rad}-${rad}=${chord}$.`,
          `Chord $\\overline{AB}$ has length ${chord}.`,
        ],
      },
    };
  return {
    tag,
    draft: {
      prompt: `Points $A$ and $B$ lie on a circle with center $O$, and chord $\\overline{AB}$ has length ${chord}. The perimeter of triangle $OAB$ is ${per}. What is the radius of the circle?`,
      answer: String(rad),
      hint: `$OA$ and $OB$ are radii, so they have the same length. Write the perimeter ${per} using one unknown for that length and the chord ${chord}.`,
      explanation: [
        `A radius runs from the center to the circle, so $OA$ and $OB$ are both radii and have the same length. Call it $r$.`,
        `The perimeter is the distance around: $r+r+${chord}=${per}$.`,
        `Subtract the chord: $2r=${per}-${chord}=${per - chord}$.`,
        `Divide by 2: $r=${rad}$. The radius of the circle is ${rad}.`,
      ],
    },
  };
}

/* ------------------------------------------------ shifted polynomials */
const shiftVariants = [
  "quad-extreme",
  "cubic-zero-sum",
  "cubic-vertical-value",
] as const;
function shiftCase(r: Random): SatGeometryAdvancedCase {
  for (;;) {
    const tag = shiftVariants[r(0, 2)]!;
    if (tag === "quad-extreme") {
      const a = r(0, 3) === 0 ? -1 : r(1, 2);
      const h = r(-6, 8);
      const k = r(-9, 12);
      const s = r(1, 7) * (r(0, 1) ? 1 : -1);
      if (h === 0) continue;
      const b = -2 * a * h;
      const c = a * h * h + k;
      if (c === 0) continue;
      const lead = a === 1 ? "x^2" : a === -1 ? "-x^2" : `${a}x^2`;
      const rule = `${lead}${b < 0 ? "-" : "+"}${Math.abs(b)}x${c < 0 ? "-" : "+"}${Math.abs(c)}`;
      const inner = `x${s < 0 ? "-" : "+"}${Math.abs(s)}`;
      const answer = h - s;
      const kind = a > 0 ? "minimum" : "maximum";
      return {
        tag,
        draft: {
          prompt: `The function $f$ is defined by $f(x)=${rule}$, and the function $g$ is defined by $g(x)=f(${inner})$. At what value of $x$ does the graph of $g$ reach its ${kind}? Enter the $x$-value.`,
          answer: String(answer),
          hint: `First find where the graph of $f$ reaches its ${kind}. Its turning point, the vertex, is at $x=-\\dfrac{b}{2a}$, where $a$ and $b$ are the numbers in front of $x^2$ and $x$.`,
          explanation: [
            `The graph of $f$ is a parabola, a U-shaped curve. Its ${kind}, the ${a > 0 ? "lowest" : "highest"} point, is at the vertex, its turning point.`,
            `For $ax^2+bx+c$ the vertex is at $x=-\\dfrac{b}{2a}$. Here $a=${a}$ and $b=${b}$, so $x=-\\dfrac{${b < 0 ? `(${b})` : b}}{${2 * a}}=${h}$.`,
            `$g(x)=f(${inner})$ means: to get $g$ at some $x$, put $${inner}$ into $f$. So $g$ hits the ${kind} when $${inner}$ equals ${h}.`,
            `Solve $${inner}=${h}$: $x=${h}${s < 0 ? "+" : "-"}${Math.abs(s)}=${answer}$. The graph of $g$ is the graph of $f$ shifted ${Math.abs(s)} ${Math.abs(s) === 1 ? "unit" : "units"} ${s < 0 ? "right" : "left"}.`,
            `The graph of $g$ reaches its ${kind} at $x=${answer}$.`,
          ],
        },
      };
    }
    const zs = new Set<number>();
    while (zs.size < 3) zs.add(r(-6, 6));
    const [p, q, z] = [...zs] as [number, number, number];
    const rule = `${factor(p)}${factor(q)}${factor(z)}`;
    if (tag === "cubic-zero-sum") {
      const s = r(1, 6) * (r(0, 1) ? 1 : -1);
      const inner = `x${s < 0 ? "+" : "-"}${Math.abs(s)}`;
      // g(x) = f(x - s) has zeros at p + s, q + s, z + s.
      const answer = p + q + z + 3 * s;
      return {
        tag,
        draft: {
          prompt: `The function $f$ is defined by $f(x)=${rule}$, and the function $g$ is defined by $g(x)=f(${inner})$. What is the sum of the $x$-intercepts of the graph of $g$ in the $xy$-plane?`,
          answer: String(answer),
          hint: `The $x$-intercepts of $f$, where its graph crosses the $x$-axis, are the values that make a factor of $${rule}$ zero. Find those first, then decide which way $${inner}$ slides them.`,
          explanation: [
            `An $x$-intercept is where a graph crosses the $x$-axis, so the output is 0. A product is 0 exactly when one factor is 0.`,
            `So the $x$-intercepts of $f$ are the values that make each factor 0: ${[p, q, z].join(", ")}.`,
            `$g(x)=f(${inner})$ is 0 when $${inner}$ equals one of those values. Solve each: $x$ is that value ${s > 0 ? "plus" : "minus"} ${Math.abs(s)}.`,
            `So the intercepts of $g$ are ${[p, q, z].map((v) => v + s).join(", ")}: the graph slid ${Math.abs(s)} ${Math.abs(s) === 1 ? "unit" : "units"} ${s > 0 ? "right" : "left"}.`,
            `Add them: $${p + s}+${q + s < 0 ? `(${q + s})` : q + s}+${z + s < 0 ? `(${z + s})` : z + s}=${answer}$.`,
            `The sum of the $x$-intercepts of $g$ is ${answer}.`,
          ],
        },
      };
    }
    if (p === 0 || q === 0 || z === 0) continue;
    const k = r(1, 9) * (r(0, 1) ? 1 : -1);
    const f0 = -p * q * z;
    const answer = f0 + k;
    return {
      tag,
      draft: {
        prompt: `The function $f$ is defined by $f(x)=${rule}$, and the function $g$ is defined by $g(x)=f(x)${k < 0 ? "-" : "+"}${Math.abs(k)}$. What is the value of $g(0)$?`,
        answer: String(answer),
        hint: `$g(0)$, read "$g$ of 0", is the output of $g$ when $x=0$, and $g$ ${k < 0 ? `subtracts ${-k} from` : `adds ${k} to`} $f$. Find $f(0)$ first by putting 0 in for $x$ in each factor of $${rule}$.`,
        explanation: [
          `$f(0)$, read "$f$ of 0", is the output of $f$ when the input $x$ is 0.`,
          `Put 0 in for $x$ in each factor and multiply: $f(0)=${[p, q, z].map((v) => (-v < 0 ? `(${-v})` : String(-v))).join("\\cdot")}=${f0}$.`,
          `$g$ is $f$ with ${Math.abs(k)} ${k < 0 ? "subtracted" : "added"}, which moves the graph ${Math.abs(k)} ${Math.abs(k) === 1 ? "unit" : "units"} ${k < 0 ? "down" : "up"}. So $g(0)=f(0)${k < 0 ? "-" : "+"}${Math.abs(k)}$.`,
          `$g(0)=${f0}${k < 0 ? "-" : "+"}${Math.abs(k)}=${answer}$.`,
          `The value of $g(0)$ is ${answer}.`,
        ],
      },
    };
  }
}

/* ------------------------------------------------- radical sides */
const radicalVariants = [
  "hyp-radicand",
  "hyp-coefficient",
  "decimal-leg",
] as const;
function simplifyRoot(n: number): [number, number] {
  let outside = 1,
    inside = n;
  for (let f = 2; f * f <= inside; f++)
    while (inside % (f * f) === 0) {
      inside /= f * f;
      outside *= f;
    }
  return [outside, inside];
}
function radicalCase(r: Random): SatGeometryAdvancedCase {
  const tag = radicalVariants[r(0, 2)]!;
  if (tag === "decimal-leg") {
    const triple = pick(r, [
      [3, 4, 5],
      [5, 12, 13],
      [8, 15, 17],
      [7, 24, 25],
      [6, 8, 10],
      [9, 12, 15],
    ] as const);
    const scale = pick(r, [0.1, 0.2, 0.5]);
    const f = (v: number) => String(Number((v * scale).toFixed(2)));
    const cm = (v: number) =>
      `${f(v)} ${f(v) === "1" ? "centimeter" : "centimeters"}`;
    const hyp = triple[2];
    const [la, lb] = r(0, 1) ? [triple[0], triple[1]] : [triple[1], triple[0]];
    return {
      tag,
      draft: {
        prompt: `In a right triangle, the hypotenuse is ${cm(hyp)} and one leg is ${cm(la)}. What is the length of the other leg, in centimeters?`,
        answer: f(lb),
        hint: `The hypotenuse squared is the sum of the two leg squares. Square the hypotenuse ${f(hyp)} and the leg ${f(la)}, subtract the smaller square from the larger, and take the square root. Check that the result is positive.`,
        explanation: [
          `The hypotenuse is the longest side, across from the right angle. The legs are the two sides that form the right angle.`,
          `The Pythagorean theorem says $a^2+b^2=c^2$: the squares of the legs add to the square of the hypotenuse $c$.`,
          `Here $c=${f(hyp)}$ and one leg $a=${f(la)}$. Subtract to get the other leg's square: $b^2=c^2-a^2$.`,
          `$b^2=${f(hyp)}^2-${f(la)}^2=${Number((hyp * hyp * scale * scale).toFixed(4))}-${Number((la * la * scale * scale).toFixed(4))}=${Number((lb * lb * scale * scale).toFixed(4))}$.`,
          `Take the square root: $b=${f(lb)}$. The other leg is ${cm(lb)} long.`,
        ],
      },
    };
  }
  for (;;) {
    const a = r(2, 14);
    const b = r(2, 14);
    const sumSq = a * a + b * b;
    const [m, n] = simplifyRoot(sumSq);
    if (a === b || n === 1 || m === 1) continue;
    const coefficient = tag === "hyp-coefficient";
    return {
      tag,
      draft: {
        prompt: `In right triangle $ABC$, the legs have lengths ${a} and ${b}. The length of the hypotenuse can be written in simplest radical form as $m\\sqrt{n}$, where $m$ and $n$ are positive integers and $n$ has no perfect-square factor other than 1. What is the value of $${coefficient ? "m" : "n"}$?`,
        answer: String(coefficient ? m : n),
        hint: `The legs are the two sides that form the right angle. Add the squares of the legs ${a} and ${b} to find the square of the hypotenuse, then simplify its square root.`,
        explanation: [
          `The legs are the two sides that form the right angle. The hypotenuse $c$ is the longest side, across from it.`,
          `The Pythagorean theorem says leg² + leg² = hypotenuse². So $c^2=${a}^2+${b}^2=${a * a}+${b * b}=${sumSq}$.`,
          `To simplify $\\sqrt{${sumSq}}$, find the largest perfect square (a number like 4, 9 or 16 that is a whole number squared) that divides it: $${sumSq}=${m * m}\\cdot ${n}$.`,
          `The square root of ${m * m} is ${m}, so it comes out front: $c=\\sqrt{${sumSq}}=${m}\\sqrt{${n}}$.`,
          `Simplest radical form means no perfect square is left inside the root, so $m=${m}$ and $n=${n}$. The value of $${coefficient ? "m" : "n"}$ is ${coefficient ? m : n}.`,
        ],
      },
    };
  }
}

/* ------------------------------------------------ special triangles */
const specialVariants = [
  "acute-angle",
  "equilateral-altitude",
  "square-in-circle",
  "equilateral-circumradius",
] as const;
function specialCase(r: Random): SatGeometryAdvancedCase {
  const tag = specialVariants[r(0, 3)]!;
  if (tag === "acute-angle") {
    const kind = r(0, 3);
    const n = r(3, 15);
    const names = permuteLetters(r);
    const [A, B, C] = names;
    let prompt: string;
    let answer: number;
    let steps: string[];
    if (kind === 0) {
      answer = 45;
      prompt = `In triangle $${A}${B}${C}$, $\\angle ${B}$ is a right angle and $${A}${B}=${B}${C}=${n}$. What is the measure, in degrees, of $\\angle ${A}$?`;
      steps = [
        `The legs are the two sides that form the right angle at $${B}$: $${A}${B}$ and $${B}${C}$. They are equal.`,
        `A triangle with two equal sides is isosceles, so the angles across from those sides, at $${C}$ and $${A}$, are equal.`,
        `The three angles add to 180°, and the right angle takes 90°. The other two share $180-90=90$ degrees.`,
        `Equal shares: $90\\div 2=45$. So $\\angle ${A}$ measures 45 degrees.`,
      ];
    } else if (kind === 1) {
      answer = 30;
      prompt = `In triangle $${A}${B}${C}$, $\\angle ${B}$ is a right angle, $${A}${B}=${n}$ and $${B}${C}=${n}\\sqrt{3}$. What is the measure, in degrees, of $\\angle ${C}$?`;
      steps = [
        `The legs are the two sides that form the right angle at $${B}$: $${A}${B}=${n}$ and $${B}${C}=${n}\\sqrt{3}$.`,
        `Their ratio is $1:\\sqrt{3}$. That is the side pattern of a 30-60-90 triangle, a right triangle with angles 30°, 60° and 90°.`,
        `In any triangle, the shorter side is across from the smaller angle. The shorter leg, $${A}${B}$, is across from $\\angle ${C}$.`,
        `So $\\angle ${C}$ is the 30° angle. It measures 30 degrees.`,
      ];
    } else if (kind === 2) {
      answer = 60;
      prompt = `In triangle $${A}${B}${C}$, $\\angle ${B}$ is a right angle, $${A}${B}=${n}$ and $${B}${C}=${n}\\sqrt{3}$. What is the measure, in degrees, of $\\angle ${A}$?`;
      steps = [
        `The legs are the two sides that form the right angle at $${B}$: $${A}${B}=${n}$ and $${B}${C}=${n}\\sqrt{3}$.`,
        `Their ratio is $1:\\sqrt{3}$. That is the side pattern of a 30-60-90 triangle, a right triangle with angles 30°, 60° and 90°.`,
        `In any triangle, the longer side is across from the larger angle. The longer leg, $${B}${C}$, is across from $\\angle ${A}$.`,
        `So $\\angle ${A}$ is the 60° angle. It measures 60 degrees.`,
      ];
    } else {
      answer = 30;
      prompt = `In triangle $${A}${B}${C}$, $\\angle ${B}$ is a right angle, the hypotenuse $${A}${C}=${2 * n}$ and $${B}${C}=${n}$. What is the measure, in degrees, of $\\angle ${A}$?`;
      steps = [
        `The hypotenuse is the longest side, across from the right angle: $${A}${C}=${2 * n}$. The leg $${B}${C}=${n}$ is exactly half of it.`,
        `In a 30-60-90 triangle, the leg across from the 30° angle is half the hypotenuse. No other right triangle has a leg exactly half the hypotenuse.`,
        `$${B}${C}$ is across from $\\angle ${A}$, so $\\angle ${A}$ is the 30° angle.`,
        `$\\angle ${A}$ measures 30 degrees.`,
      ];
    }
    return {
      tag,
      draft: {
        prompt,
        answer: String(answer),
        hint: `Compare the given sides, starting with ${n}. Equal legs, legs in the ratio $1:\\sqrt{3}$, or a leg half the hypotenuse each mark a special right triangle. The smaller angle is always across from the shorter side.`,
        explanation: steps,
      },
    };
  }
  if (tag === "equilateral-altitude") {
    const k = r(2, 15);
    const per = 6 * k;
    return {
      tag,
      draft: {
        prompt: `An equilateral triangle has a perimeter of ${per}. The altitude from one vertex to the opposite side has length $c\\sqrt{3}$. What is the value of $c$?`,
        answer: String(k),
        hint: `Find one side from the perimeter ${per}. The altitude splits the triangle into two 30-60-90 right triangles, and the altitude is the longer leg.`,
        explanation: [
          `An equilateral triangle has three equal sides and three 60° angles. The perimeter is the distance around, so each side is $${per}\\div 3=${2 * k}$.`,
          `The altitude is the height line from a corner straight down to the opposite side, meeting it at a right angle. It cuts that side in half: two pieces of ${k}.`,
          `That makes a 30-60-90 triangle: hypotenuse ${2 * k} (a full side), short leg ${k} (half a side), and the altitude as the long leg.`,
          `In a 30-60-90 triangle the long leg is the short leg times $\\sqrt{3}$. So the altitude is $${k}\\sqrt{3}$.`,
          `So $c=${k}$.`,
        ],
      },
    };
  }
  if (tag === "square-in-circle") {
    const k = r(2, 14);
    const byDiameter = r(0, 1) === 1;
    return {
      tag,
      draft: {
        prompt: byDiameter
          ? `A square is inscribed in a circle, so all four vertices lie on the circle. The circle has diameter $${2 * k}\\sqrt{2}$ units. What is the side length of the square, in units?`
          : `A square is inscribed in a circle, so all four vertices lie on the circle. The circle has radius $${k}\\sqrt{2}$ units. What is the side length of the square, in units?`,
        answer: String(2 * k),
        hint: `A diagonal of the square passes through the center, so it is a diameter: ${byDiameter ? `here $${2 * k}\\sqrt{2}$` : `twice the radius $${k}\\sqrt{2}$`}. A diagonal splits the square into two 45-45-90 triangles whose legs are the sides.`,
        explanation: [
          `Inscribed means the square sits inside the circle with all four corners on it. A diagonal joins opposite corners and passes through the center.`,
          `A segment through the center from one side of a circle to the other is a diameter, twice the radius. So the diagonal is ${byDiameter ? `$${2 * k}\\sqrt{2}$` : `$2\\cdot ${k}\\sqrt{2}=${2 * k}\\sqrt{2}$`}.`,
          `The diagonal cuts the square into two 45-45-90 triangles. Two sides of the square are the legs, and the diagonal is the hypotenuse.`,
          `In a 45-45-90 triangle the hypotenuse is a leg times $\\sqrt{2}$. So divide: side $=${2 * k}\\sqrt{2}\\div\\sqrt{2}=${2 * k}$.`,
          `The side length of the square is ${2 * k} units.`,
        ],
      },
    };
  }
  const k = r(2, 12);
  return {
    tag,
    draft: {
      prompt: `An equilateral triangle with perimeter ${9 * k} is inscribed in a circle, so all three vertices lie on the circle. The radius of the circle is $c\\sqrt{3}$. What is the value of $c$?`,
      answer: String(k),
      hint: `Find a side from the perimeter ${9 * k}. The center of the circle is also the center of the triangle, and joining it to each vertex and dropping a perpendicular to a side makes 30-60-90 triangles.`,
      explanation: [
        `An equilateral triangle has three equal sides and three 60° angles. Each side is $${9 * k}\\div 3=${3 * k}$.`,
        `Inscribed means all three corners lie on the circle. The radius runs from the center to a corner.`,
        `Join the center to a vertex and drop a perpendicular from the center to a side. The perpendicular bisects the side, and the radius to the vertex bisects the 60° vertex angle, giving a 30-60-90 triangle. Its longer leg is half a side, ${(3 * k) / 2}.`,
        `The longer leg is the shorter leg times $\\sqrt{3}$, so the shorter leg is $\\dfrac{${(3 * k) / 2}}{\\sqrt{3}}=\\dfrac{${k}\\sqrt{3}}{2}$.`,
        `The radius is the hypotenuse, twice the shorter leg: $${k}\\sqrt{3}$. So $c=${k}$.`,
      ],
    },
  };
}
function permuteLetters(r: Random): [string, string, string] {
  const [a, b, c] = permute(
    r,
    pick(r, ["ABC", "PQR", "XYZ", "DEF", "JKL"]).split(""),
  );
  return [a!, b!, c!];
}

const builders: Record<string, (r: Random) => SatGeometryAdvancedCase> = {
  "corresponding-angle-transfer": correspondingCase,
  "crossing-segment-similarity": crossingCase,
  "angle-chase-chain": chainCase,
  "angle-claim-reasoning": claimCase,
  "circle-radii-triangle": radiiCase,
  "shifted-polynomial-features": shiftCase,
  "radical-side-entry": radicalCase,
  "special-triangle-in-figure": specialCase,
};

export function satGeometryAdvancedCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tag: string } {
  const meta = satGeometryAdvancedTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown SAT geometry advanced family");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  const built = builders[id]!(r);
  return { problem: assemble(meta, seed, r, built.draft), tag: built.tag };
}
export function generateSatGeometryAdvancedProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return satGeometryAdvancedCase(id, seed).problem;
}
