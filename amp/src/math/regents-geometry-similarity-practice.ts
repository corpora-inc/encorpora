import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  numberSurface,
  pick,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import { table } from "./scene/author";
import { roundText } from "./regents-kit";
import { clearOfTie, retry, tanD, type R } from "./regents-geometry-kit";

const choiceMeta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  requiredResponseCapability: "single-choice-v1",
  description,
});
const numMeta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  description,
});

export const altitudeRatioTemplate = choiceMeta(
  "geo-altitude-ratio",
  "Choose the trigonometric ratio that uses the altitude's triangle",
  "right-triangle-trigonometry",
  0.5,
  "In a right triangle with the altitude to the hypotenuse drawn, choose the one true equation for a sine, cosine or tangent of an acute angle, written with sides of the smaller right triangles.",
);
export const parallelPerimeterTemplate = numMeta(
  "geo-parallel-perimeter",
  "Perimeter of a triangle from a segment parallel to a side",
  "similarity-theorems",
  0.5,
  "A segment parallel to one side of a triangle cuts two sides. Use the similar small triangle, given from lengths of the cut sides, to find the perimeter of the whole triangle.",
);
export const parallelStatementTemplate = choiceMeta(
  "geo-parallel-statement",
  "Choose the statement that is not always true for triangles made by parallel segments",
  "similarity-theorems",
  0.4,
  "For two triangles formed by parallel segments, nested or crossing, choose the one statement that does not always hold, among similarity, angle congruences and a proportion.",
);
export const equalLegsTemplate = choiceMeta(
  "geo-equal-legs-radical",
  "Side of a similar isosceles right triangle with a radical",
  "special-right-triangles",
  0.45,
  "A right triangle has equal legs. A similar triangle gives a leg or the hypotenuse, and the other side is a whole number or a multiple of a square root of 2.",
);
export const elevationDepressionTemplate = numMeta(
  "geo-elevation-depression",
  "Height from an angle of elevation and an angle of depression",
  "right-triangle-trigonometry",
  0.55,
  "From a point at a stated horizontal distance, an angle of elevation to the top and an angle of depression to the base give two right triangles whose heights add, rounded to the stated place.",
);
export const densityRankTemplate = {
  ...choiceMeta(
    "geo-density-rank",
    "Rank regions by population density",
    "density-modeling",
    0.4,
    "From a table of populations and land areas of four regions, rank them by density, populations per square mile, among rankings by population, by area or in reverse order.",
  ),
  requiredFigureCapability: "scenes-v1" as const,
};

/* ------------------------------------------------------ altitude ratio */
type Seg = "AC" | "BC" | "AB" | "CD" | "AD" | "BD";
const segs: Seg[] = ["AC", "BC", "AB", "CD", "AD", "BD"];
const sub: Seg[] = ["CD", "AD", "BD"];
function lengths(p: number, q: number): Record<Seg, number> {
  const ab = Math.hypot(p, q);
  return {
    AC: p,
    BC: q,
    AB: ab,
    CD: (p * q) / ab,
    AD: (p * p) / ab,
    BD: (q * q) / ab,
  };
}
const trig = (fn: string, angle: "A" | "B", L: Record<Seg, number>) => {
  const opp = angle === "A" ? L.BC : L.AC;
  const adj = angle === "A" ? L.AC : L.BC;
  return fn === "sin" ? opp / L.AB : fn === "cos" ? adj / L.AB : opp / adj;
};
/** The three right triangles of the figure, read from angle A or angle B:
 * the angle itself, or the equal angle at C in the other small triangle. */
type Role = { tri: string; at: string; opp: Seg; adj: Seg; hyp: Seg };
const roles: Record<"A" | "B", Role[]> = {
  A: [
    { tri: "ABC", at: "A", opp: "BC", adj: "AC", hyp: "AB" },
    { tri: "ACD", at: "A", opp: "CD", adj: "AD", hyp: "AC" },
    { tri: "BCD", at: "BCD", opp: "BD", adj: "CD", hyp: "BC" },
  ],
  B: [
    { tri: "ABC", at: "B", opp: "AC", adj: "BC", hyp: "AB" },
    { tri: "BCD", at: "B", opp: "CD", adj: "BD", hyp: "BC" },
    { tri: "ACD", at: "ACD", opp: "AD", adj: "CD", hyp: "AC" },
  ],
};
const ratioParts = {
  sin: ["opp", "hyp"],
  cos: ["adj", "hyp"],
  tan: ["opp", "adj"],
} as const;
const fnName = { sin: "sine", cos: "cosine", tan: "tangent" } as const;
const ratioWords = {
  sin: "opposite ÷ hypotenuse",
  cos: "adjacent ÷ hypotenuse",
  tan: "opposite ÷ adjacent",
} as const;
/** The triangle and trig function a side ratio is, from angle A or B. */
function readRatio(angle: "A" | "B", pr: [Seg, Seg]) {
  for (const role of roles[angle])
    for (const fn of ["sin", "cos", "tan"] as const) {
      const [top, bottom] = ratioParts[fn];
      if (role[top] === pr[0] && role[bottom] === pr[1])
        return { role, fn, flipped: false };
      if (role[top] === pr[1] && role[bottom] === pr[0])
        return { role, fn, flipped: true };
    }
  return null;
}
const angleTex = (role: Role) =>
  role.at.length === 1 ? `$${role.at}$` : `$\\angle ${role.at}$`;
export const altitudeRatio = chainFamily({
  template: altitudeRatioTemplate,
  axes: {
    fn: defineAxis("fn", ["sin", "cos", "tan"] as const),
    angle: defineAxis("angle", ["a", "b"] as const),
  },
  model: (r: R, ax) => {
    const p = r(3, 12);
    const q = r(3, 12);
    if (p === q) retry();
    return {
      p,
      q,
      fn: ax.fn,
      angle: ax.angle === "a" ? ("A" as const) : ("B" as const),
    };
  },
  variant: (m) => `${m.fn}-${m.angle.toLowerCase()}`,
  render: (m, _ax, r) => {
    const L = lengths(m.p, m.q);
    const target = trig(m.fn, m.angle, L);
    const pairs: Array<[Seg, Seg]> = [];
    for (const u of segs) for (const v of segs) if (u !== v) pairs.push([u, v]);
    const uses = (pr: [Seg, Seg]) => sub.includes(pr[0]) || sub.includes(pr[1]);
    const isTrue = (pr: [Seg, Seg]) =>
      Math.abs(L[pr[0]] / L[pr[1]] - target) < 1e-9;
    const trues = pairs.filter((pr) => isTrue(pr) && uses(pr));
    const falses = pairs.filter(
      (pr) => Math.abs(L[pr[0]] / L[pr[1]] - target) > 1e-6 && uses(pr),
    );
    if (!trues.length) retry();
    const good = pick(r, trues);
    const bad = shuffle(r, [...falses]).slice(0, 3);
    const tex = (pr: [Seg, Seg]) =>
      `$\\${m.fn} ${m.angle} = \\frac{${pr[0]}}{${pr[1]}}$`;
    const fnWord =
      m.fn === "sin" ? "sine" : m.fn === "cos" ? "cosine" : "tangent";
    return choiceSurface(r, {
      prompt: `In right triangle $ABC$, the right angle is at $C$, $AC=${m.p}$ and $BC=${m.q}$. Altitude $\\overline{CD}$ is drawn to hypotenuse $\\overline{AB}$. Which equation is true?`,
      label: "Choose the equation",
      options: [
        { label: tex(good), correct: true },
        ...bad.map((pr) => {
          const read = readRatio(m.angle, pr);
          const why = !read
            ? `$${pr[0]}$ and $${pr[1]}$ are not two sides of one right triangle with an angle equal to angle $${m.angle}$, so this is not a trig ratio of angle $${m.angle}$.`
            : read.flipped
              ? `This is upside down: in triangle $${read.role.tri}$ it is the ${fnName[read.fn]} ratio flipped over. The ${fnWord} is ${ratioWords[m.fn]}.`
              : read.fn !== m.fn
                ? `In triangle $${read.role.tri}$ this is ${ratioWords[read.fn]}, the ${fnName[read.fn]}, not the ${fnWord}. The ${fnWord} is ${ratioWords[m.fn]}.`
                : `This uses the wrong sides for the ${fnWord} of angle $${m.angle}$.`;
          return {
            label: tex(pr),
            feedback: `${why} Check: $\\frac{${pr[0]}}{${pr[1]}}\\approx${roundText(L[pr[0]] / L[pr[1]], 3)}$, but $\\${m.fn} ${m.angle}\\approx${roundText(target, 3)}$.`,
          };
        }),
      ],
      hint: `With $AC=${m.p}$ and $BC=${m.q}$, angle $${m.angle}$ is an angle of the whole triangle and of a small triangle made by the altitude. In a triangle that holds angle $${m.angle}$, mark the side opposite angle $${m.angle}$ (across from it), the side adjacent to it (touching it) and the hypotenuse (across from the right angle).`,
      explanation: (() => {
        const read = readRatio(m.angle, good)!;
        const role = read.role;
        const [top, bottom] = ratioParts[m.fn];
        const word = { opp: "opposite", adj: "adjacent", hyp: "hypotenuse" };
        return [
          `The altitude $\\overline{CD}$ is the segment from $C$ that meets the hypotenuse $\\overline{AB}$ at a right angle. It splits triangle $ABC$ into two smaller right triangles, $ACD$ and $BCD$.`,
          `All three triangles have the same three angles, so they are similar: the same shape, different sizes. ${role.at.length > 1 ? `In triangle $${role.tri}$, ${angleTex(role)} equals angle $${m.angle}$.` : `Angle $${m.angle}$ is a corner of triangle $${role.tri}$.`}`,
          `In right triangle $${role.tri}$, look from ${angleTex(role)}. The opposite side, across from it, is $${role.opp}$. The adjacent side, touching it, is $${role.adj}$. The hypotenuse, across from the right angle, is $${role.hyp}$.`,
          `The ${fnWord} of an angle, written $\\${m.fn}$, is ${ratioWords[m.fn]}. Here that is ${word[top]} $${role[top]}$ over ${word[bottom]} $${role[bottom]}$.`,
          `The equation that is true is ${tex(good)}.`,
        ];
      })(),
    });
  },
});

/* ------------------------------------------------------ parallel perimeter */
export const parallelPerimeter = chainFamily({
  template: parallelPerimeterTemplate,
  axes: { given: defineAxis("given", ["cut-part", "whole-side"] as const) },
  model: (r: R) => {
    const [mm, nn] = pick(r, [
      [2, 5],
      [3, 5],
      [3, 4],
      [2, 3],
      [4, 5],
      [3, 7],
      [4, 7],
      [5, 7],
    ] as Array<[number, number]>);
    return { m: mm, n: nn, u: r(1, 4), v: r(1, 4), w: r(1, 4) };
  },
  variant: (m) => `ratio-${m.m}-${m.n}`,
  render: (m, ax) => {
    const { m: mm, n: nn, u, v, w } = m;
    const AD = mm * u;
    const AB = nn * u;
    const DB = AB - AD;
    const DE = mm * w;
    const BC = nn * w;
    const AE = mm * v;
    const AC = nn * v;
    const perimeter = AB + BC + AC;
    const len = (name: string, n: number) => `$${name}=${n}\\ \\text{cm}$`;
    const given =
      ax.given === "cut-part"
        ? `${len("AD", AD)}, ${len("DB", DB)}`
        : `${len("AD", AD)} and ${len("AB", AB)}`;
    const scale = `\\frac{${AB}}{${AD}}`;
    return numberSurface({
      prompt: `In triangle $ABC$, point $D$ is on $\\overline{AB}$ and point $E$ is on $\\overline{AC}$, with $\\overline{DE}\\parallel\\overline{BC}$. ${given.replace(" and ", ", ")}, ${len("DE", DE)} and ${len("AE", AE)}. What is the perimeter of triangle $ABC$ in centimeters?`,
      answer: String(perimeter),
      label: "Perimeter in centimeters",
      hint: `Since $\\overline{DE}\\parallel\\overline{BC}$, triangle $ADE$ is a smaller copy of triangle $ABC$. ${ax.given === "cut-part" ? `First find the whole side $AB$ from $AD=${AD}$ and $DB=${DB}$, then compare` : `Compare`} $AB$ with $AD=${AD}$ to find how many times bigger the large triangle is.`,
      explanation: [
        `The symbol $\\parallel$ means parallel: the lines never meet. Parallel lines cut by $\\overline{AB}$ make equal corresponding angles, angles in matching positions, so $\\angle ADE=\\angle ABC$.`,
        `Angle $A$ is in both triangles. Two pairs of equal angles make the triangles similar: the same shape, with every side scaled by one number.`,
        ax.given === "cut-part"
          ? `The whole side is the two pieces together: $AB=${AD}+${DB}=${AB}$ cm.`
          : `The whole side $AB$ is given: $AB=${AB}$ cm.`,
        `The scale factor is how many times longer each side of $ABC$ is than the matching side of $ADE$: $\\frac{AB}{AD}=${scale}$.`,
        `Multiply the small triangle's sides by it. $BC=${DE}\\cdot${scale}=${BC}$ cm and $AC=${AE}\\cdot${scale}=${AC}$ cm.`,
        `The perimeter is the distance around: $AB+BC+AC=${AB}+${BC}+${AC}=${perimeter}$.`,
        `The perimeter of triangle $ABC$ is ${perimeter} cm.`,
      ],
    });
  },
});

/* ------------------------------------------------------ parallel statement */
const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
export const parallelStatement = chainFamily({
  template: parallelStatementTemplate,
  axes: { figure: defineAxis("figure", ["crossing", "nested"] as const) },
  model: (r: R) => ({ names: shuffle(r, [...letters]).slice(0, 5) }),
  // Point letters are surface; the figure axis records the structural case.
  variant: () => "parallel-statement",
  render: (m, ax, r) => {
    const [a, b, c, d, e] = m.names as [string, string, string, string, string];
    if (ax.figure === "crossing") {
      // Segments AB and CD cross at E; AC is parallel to BD.
      const tri1 = `${a}${e}${c}`;
      const tri2 = `${b}${e}${d}`;
      return choiceSurface(r, {
        prompt: `Segments $\\overline{${a}${b}}$ and $\\overline{${c}${d}}$ intersect at $${e}$, and $\\overline{${a}${c}}\\parallel\\overline{${b}${d}}$. Which statement is not always true?`,
        label: "Choose the statement",
        options: [
          {
            label: `$\\triangle ${tri1}\\cong\\triangle ${tri2}$`,
            correct: true,
          },
          {
            label: `$\\triangle ${tri1}\\sim\\triangle ${tri2}$`,
            feedback: `This is always true. The parallel lines give $\\angle ${c}${a}${e}\\cong\\angle ${d}${b}${e}$, and the vertical angles at $${e}$ are equal. Two pairs of equal angles (AA) make triangles similar, the same shape.`,
          },
          {
            label: `$\\angle ${c}${a}${e}\\cong\\angle ${d}${b}${e}$`,
            feedback: `This is always true. These are alternate interior angles: between parallel lines $\\overline{${a}${c}}$ and $\\overline{${b}${d}}$, on opposite sides of $\\overline{${a}${b}}$. Such angles are equal.`,
          },
          {
            label: `$\\angle ${a}${e}${c}\\cong\\angle ${b}${e}${d}$`,
            feedback: `This is always true. These are vertical angles, the opposite angles where two lines cross, and vertical angles are always equal.`,
          },
        ],
        hint: `Parallel lines $\\overline{${a}${c}}$ and $\\overline{${b}${d}}$ give equal alternate interior angles, and angles at $${e}$ across from each other are equal. Ask which statement needs the sides to be equal as well, not only the angles.`,
        explanation: [
          `Alternate interior angles sit between the parallel lines on opposite sides of the crossing line. They are equal, so $\\angle ${c}${a}${e}\\cong\\angle ${d}${b}${e}$. The symbol $\\cong$ means congruent: exactly the same size.`,
          `Vertical angles are the opposite angles where two lines cross, here at $${e}$. They are always equal.`,
          `Two pairs of equal angles make the triangles similar, written $\\triangle ${tri1}\\sim\\triangle ${tri2}$: the same shape, possibly different sizes.`,
          `Congruent triangles must also be the same size. Nothing says any pair of matching sides is equal, so the triangles can be different sizes.`,
          `So the statement that is not always true is $\\triangle ${tri1}\\cong\\triangle ${tri2}$.`,
        ],
      });
    }
    // D on AB, E on AC (renamed): DE is parallel to BC.
    const tri1 = `${a}${d}${e}`;
    const tri2 = `${a}${b}${c}`;
    return choiceSurface(r, {
      prompt: `In triangle $${a}${b}${c}$, point $${d}$ is on $\\overline{${a}${b}}$ and point $${e}$ is on $\\overline{${a}${c}}$, with $\\overline{${d}${e}}\\parallel\\overline{${b}${c}}$. Which statement is not always true?`,
      label: "Choose the statement",
      options: [
        { label: `$${d}${e}=${b}${c}$`, correct: true },
        {
          label: `$\\triangle ${tri1}\\sim\\triangle ${tri2}$`,
          feedback: `This is always true. Angle $${a}$ is in both triangles, and the parallel lines give $\\angle ${a}${d}${e}\\cong\\angle ${a}${b}${c}$. Two pairs of equal angles make the triangles similar, the same shape.`,
        },
        {
          label: `$\\angle ${a}${d}${e}\\cong\\angle ${a}${b}${c}$`,
          feedback: `This is always true. These are corresponding angles, in matching positions where $\\overline{${a}${b}}$ crosses the parallel lines $\\overline{${d}${e}}$ and $\\overline{${b}${c}}$. Such angles are equal.`,
        },
        {
          label: `$\\frac{${a}${d}}{${a}${b}}=\\frac{${a}${e}}{${a}${c}}$`,
          feedback: `This is always true. In similar triangles, matching sides all grow by the same factor, so their ratios are equal.`,
        },
      ],
      hint: `Because $\\overline{${d}${e}}\\parallel\\overline{${b}${c}}$, the angles at $${d}$ and $${b}$ are corresponding angles and angle $${a}$ is shared. Ask which statement says the two triangles have the same size, rather than the same shape.`,
      explanation: [
        `Corresponding angles sit in matching positions where one line crosses two parallel lines. They are equal, so $\\angle ${a}${d}${e}\\cong\\angle ${a}${b}${c}$. The symbol $\\cong$ means congruent: the same size.`,
        `Angle $${a}$ is in both triangles. Two pairs of equal angles make the triangles similar, written $\\triangle ${tri1}\\sim\\triangle ${tri2}$: the same shape.`,
        `Similar triangles have proportional sides: every side of one is the matching side of the other times the same number. So the ratio statement is always true.`,
        `The small triangle sits inside the large one, so $\\overline{${d}${e}}$ is shorter than $\\overline{${b}${c}}$. They could be equal only if they were the same segment.`,
        `So the statement that is not always true is $${d}${e}=${b}${c}$.`,
      ],
    });
  },
});

/* ------------------------------------------------------ equal legs */
export const equalLegs = chainFamily({
  template: equalLegsTemplate,
  axes: { ask: defineAxis("ask", ["find-hypotenuse", "find-leg"] as const) },
  model: (r: R, ax) => {
    const a = r(2, 9);
    const b = ax.ask === "find-hypotenuse" ? r(3, 15) : 2 * r(2, 8);
    if (ax.ask === "find-hypotenuse" && b === a) retry();
    return { a, b };
  },
  variant: (m) => (m.b > m.a ? "enlargement" : "reduction"),
  render: (m, ax, r) => {
    const rad = (k: number) => `${k === 1 ? "" : k}\\sqrt{2}`;
    if (ax.ask === "find-hypotenuse") {
      return choiceSurface(r, {
        prompt: `In right triangle $ABC$, $AC=BC=${m.a}$ and the right angle is at $C$. Triangle $DEF$ is similar to triangle $ABC$, with the right angle at $F$ and $DF=${m.b}$. What is the length of $\\overline{DE}$?`,
        label: "Choose the length",
        options: [
          { label: `$${rad(m.b)}$`, correct: true },
          {
            label: `$${m.b}$`,
            feedback:
              "The side $\\overline{DE}$ is the hypotenuse, which is longer than a leg. It is not equal to the leg $DF$.",
          },
          {
            label: `$${2 * m.b}$`,
            feedback:
              "The hypotenuse of a right triangle with equal legs is the leg times $\\sqrt{2}$, not twice the leg.",
          },
          {
            label: `$${m.b}\\sqrt{3}$`,
            feedback:
              "The factor $\\sqrt{3}$ belongs to a 30-60-90 triangle. Equal legs make a 45-45-90 triangle, with hypotenuse leg times $\\sqrt{2}$.",
          },
          {
            label: `$${rad(m.a)}$`,
            feedback: `This is the hypotenuse $AB$ of the first triangle. $\\overline{DE}$ is in the larger or smaller similar triangle, with $DF=${m.b}$.`,
          },
        ],
        hint: `Triangle $DEF$ has the same shape as $ABC$, so its legs are equal too: $DF=${m.b}$. The Pythagorean theorem says leg squared plus leg squared equals hypotenuse squared: $${m.b}^2+${m.b}^2$.`,
        explanation: [
          `The legs are the two sides that form the right angle. In triangle $ABC$ they are equal: $AC=BC=${m.a}$.`,
          `Similar triangles have the same shape, so triangle $DEF$ also has equal legs: $DF=EF=${m.b}$.`,
          `$\\overline{DE}$ is across from the right angle at $F$, so it is the hypotenuse, the longest side.`,
          `The Pythagorean theorem says leg² + leg² = hypotenuse² in any right triangle. So $DE^2=${m.b}^2+${m.b}^2=${2 * m.b * m.b}$.`,
          `Take the square root and pull out the perfect square: $DE=\\sqrt{${2 * m.b * m.b}}=\\sqrt{${m.b * m.b}\\cdot2}=${m.b}\\sqrt{2}$.`,
          `This matches the 45-45-90 pattern: the hypotenuse is a leg times $\\sqrt{2}$. The length of $\\overline{DE}$ is $${rad(m.b)}$.`,
        ],
      });
    }
    const e = m.b / 2;
    return choiceSurface(r, {
      prompt: `In right triangle $ABC$, $AC=BC=${m.a}$ and the right angle is at $C$. Triangle $DEF$ is similar to triangle $ABC$, with the right angle at $F$ and $DE=${m.b}$. What is the length of $\\overline{DF}$?`,
      label: "Choose the length",
      options: [
        { label: `$${rad(e)}$`, correct: true },
        {
          label: `$${rad(m.b)}$`,
          feedback: `That multiplies the hypotenuse by $\\sqrt{2}$. A leg is shorter than the hypotenuse, so divide by $\\sqrt{2}$.`,
        },
        {
          label: `$${e}$`,
          feedback:
            "A leg is not half of the hypotenuse in a 45-45-90 triangle. That is true for a 30-60-90 triangle.",
        },
        {
          label: `$${m.b}$`,
          feedback:
            "The leg $DF$ is shorter than the hypotenuse $DE$, so it cannot equal it.",
        },
        {
          label: `$${m.a}$`,
          feedback: `$${m.a}$ is a leg of the first triangle. $DF$ is a leg of the similar triangle with hypotenuse $${m.b}$.`,
        },
      ],
      hint: `Triangle $DEF$ has equal legs too, so leg² + leg² = hypotenuse² becomes $2\\cdot DF^2=DE^2$ with $DE=${m.b}$. Solve for $DF$.`,
      explanation: [
        `The legs are the two sides that form the right angle. In triangle $ABC$ they are equal, $AC=BC$.`,
        `Similar triangles have the same shape, so triangle $DEF$ also has equal legs: $DF=EF$.`,
        `$\\overline{DE}$ is across from the right angle at $F$, so it is the hypotenuse, the longest side: $DE=${m.b}$.`,
        `The Pythagorean theorem says leg² + leg² = hypotenuse². With equal legs that is $DF^2+DF^2=2\\cdot DF^2=${m.b}^2=${m.b * m.b}$.`,
        `Divide by 2: $DF^2=${(m.b * m.b) / 2}$. Take the square root and pull out the perfect square: $DF=\\sqrt{${(m.b * m.b) / 2}}=${rad(e)}$.`,
        `This matches the 45-45-90 pattern: a leg is the hypotenuse divided by $\\sqrt{2}$. The length of $\\overline{DF}$ is $${rad(e)}$.`,
      ],
    });
  },
});

/* ------------------------------------------------------ elevation and depression */
export const elevationDepression = chainFamily({
  template: elevationDepressionTemplate,
  axes: { place: defineAxis("place", ["whole", "tenth"] as const) },
  model: (r: R) => ({
    up: r(20, 58),
    down: r(15, 48),
    d: 5 * r(12, 60),
    thing: r(0, 2),
  }),
  variant: (m) => (m.up > m.down ? "higher-top" : "deeper-base"),
  render: (m, ax) => {
    const h = m.d * (tanD(m.up) + tanD(m.down));
    const places = ax.place === "whole" ? 0 : 1;
    if (!clearOfTie(h, places)) retry();
    const thing = ["cliff", "tower", "building"][m.thing]!;
    const unit = ax.place === "whole" ? "foot" : "tenth of a foot";
    return numberSurface({
      prompt: `A lookout is $${m.d}$ feet from a ${thing}, measured along level ground. From the lookout, the angle of elevation to the top of the ${thing} is $${m.up}^\\circ$ and the angle of depression to its base is $${m.down}^\\circ$. What is the height of the ${thing}, to the nearest ${unit}?`,
      answer: roundText(h, places),
      label: "Height in feet",
      hint: `Draw a level line from the lookout to the ${thing}. It splits the height into a part above the line and a part below it. Each part is a leg of a right triangle with the ${m.d}-foot distance as the other leg.`,
      explanation: [
        `Draw a level (horizontal) line from the lookout to the ${thing}. It splits the ${thing} into a top part and a bottom part.`,
        `The angle of elevation is how far you look up from level, ${m.up}°. The angle of depression is how far you look down from level, ${m.down}°.`,
        `Each part is a right triangle. The level distance, ${m.d} feet, is the leg adjacent to (touching) the angle. The part of the ${thing} is the leg opposite it.`,
        `Tangent is opposite ÷ adjacent, so opposite = adjacent × tangent. Top part: $${m.d}\\tan ${m.up}^\\circ\\approx${roundText(m.d * tanD(m.up), 2)}$ feet.`,
        `Bottom part: $${m.d}\\tan ${m.down}^\\circ\\approx${roundText(m.d * tanD(m.down), 2)}$ feet.`,
        `Add the two parts for the whole height: $${roundText(m.d * tanD(m.up), 2)}+${roundText(m.d * tanD(m.down), 2)}\\approx${roundText(h, 2)}$ feet.`,
        `The ${thing} is about ${roundText(h, places)} feet tall, to the nearest ${unit}.`,
      ],
    });
  },
});

/* ------------------------------------------------------ density rank */
const regionNames = [
  "Alder",
  "Birch",
  "Cedar",
  "Dunes",
  "Elm",
  "Fir",
  "Grove",
  "Heath",
];
export const densityRank = chainFamily({
  template: densityRankTemplate,
  axes: {
    order: defineAxis("order", ["greatest-first", "least-first"] as const),
  },
  model: (r: R) => {
    const names = shuffle(r, [...regionNames]).slice(0, 4);
    const rows = names.map((name) => ({
      name,
      pop: 1000 * r(80, 4800),
      area: 100 * r(40, 600),
    }));
    const dens = rows.map((x) => x.pop / x.area).sort((p, q) => p - q);
    // Densities and also populations and areas are well separated.
    for (let i = 1; i < 4; i++) if (dens[i]! / dens[i - 1]! < 1.12) retry();
    const pops = rows.map((x) => x.pop);
    const areas = rows.map((x) => x.area);
    if (new Set(pops).size < 4 || new Set(areas).size < 4) retry();
    return { rows };
  },
  variant: () => "density-rank",
  render: (m, ax, r) => {
    const byDensity = [...m.rows].sort(
      (p, q) => q.pop / q.area - p.pop / p.area,
    );
    const greatest = ax.order === "greatest-first";
    const dense = greatest ? byDensity : [...byDensity].reverse();
    const text = (list: typeof m.rows) => list.map((x) => x.name).join(", ");
    const byPop = [...m.rows].sort((p, q) =>
      greatest ? q.pop - p.pop : p.pop - q.pop,
    );
    const byArea = [...m.rows].sort((p, q) =>
      greatest ? p.area - q.area : q.area - p.area,
    );
    const reversed = [...dense].reverse();
    const group = (n: number) =>
      String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const scene = table({
      id: "t",
      columns: ["Population", "Area (sq mi)"],
      corner: "County",
      rows: m.rows.map((x) => ({
        label: x.name,
        cells: [group(x.pop), group(x.area)],
      })),
    }).scene({});
    const surface = choiceSurface(r, {
      prompt: `The table shows the population and the land area of four counties. Population density is the number of people per square mile. Which list ranks the counties from ${greatest ? "greatest to least" : "least to greatest"} population density?`,
      label: "Choose the ranking",
      options: [
        { label: text(dense), correct: true },
        {
          label: text(byPop),
          feedback: `This ranks by population alone. Density is people per square mile, population ÷ area, so a large population spread over a large area can be less dense.`,
        },
        {
          label: text(byArea),
          feedback:
            "This ranks by land area alone. Density is population ÷ area, so a small county with few people is not crowded. Divide before you rank.",
        },
        {
          label: text(reversed),
          feedback: `This list is in the right density order but backward. The question asks for ${greatest ? "greatest to least" : "least to greatest"}, so start with the ${greatest ? "most" : "least"} dense county.`,
        },
      ],
      hint: `Population density is people per square mile, so divide each population by its area. For example, divide ${group(m.rows[0]!.pop)} people by ${group(m.rows[0]!.area)} square miles for ${m.rows[0]!.name}.`,
      explanation: [
        `Population density means how crowded a place is: the number of people for each square mile of land.`,
        `To find it, divide the population by the area. A big population on a huge area can still be less crowded.`,
        ...byDensity.map(
          (x) =>
            `${x.name}: ${group(x.pop)} ÷ ${group(x.area)} ≈ ${roundText(x.pop / x.area, 1)} people per square mile.`,
        ),
        `Ordered from ${greatest ? "greatest to least" : "least to greatest"} density, the counties are ${text(dense)}.`,
      ],
    });
    return surface && { ...surface, figure: { kind: "scene" as const, scene } };
  },
});

export const regentsGeometrySimilarityTemplates = [
  altitudeRatioTemplate,
  parallelPerimeterTemplate,
  parallelStatementTemplate,
  equalLegsTemplate,
  elevationDepressionTemplate,
  densityRankTemplate,
];
export const regentsGeometrySimilarityGenerate = dispatch(
  regentsGeometrySimilarityTemplates,
  {
    "geo-altitude-ratio": (s) => altitudeRatio.generate(s).problem,
    "geo-parallel-perimeter": (s) => parallelPerimeter.generate(s).problem,
    "geo-parallel-statement": (s) => parallelStatement.generate(s).problem,
    "geo-equal-legs-radical": (s) => equalLegs.generate(s).problem,
    "geo-elevation-depression": (s) => elevationDepression.generate(s).problem,
    "geo-density-rank": (s) => densityRank.generate(s).problem,
  },
);
