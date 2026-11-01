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
import { par } from "./regents-kit";
import { radicalTex, radical, type R } from "./regents-geometry-kit";

const meta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  choice = true,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  ...(choice
    ? { requiredResponseCapability: "single-choice-v1" as const }
    : {}),
  description,
});

export const altitudeHypotenuseTemplate = meta(
  "geo-altitude-hypotenuse",
  "Leg or altitude from the altitude to the hypotenuse",
  "similarity-theorems",
  0.55,
  "Use the segments the altitude cuts on the hypotenuse of a right triangle to find a leg or the altitude, written as an integer or a simplified radical.",
);
export const centroidMedianTemplate = meta(
  "geo-centroid-median",
  "The centroid divides each median 2 to 1",
  "triangle-circles",
  0.4,
  "Choose the true statement about the two parts of a median cut by the centroid, or the length of one part from the whole median.",
);
export const polygonRotationTemplate = meta(
  "geo-polygon-rotation",
  "Regular polygon that maps onto itself under given rotations",
  "polygon-symmetries",
  0.45,
  "Work backward from one or two rotation angles to the regular polygon that maps onto itself, using that its rotation angles are multiples of 360 divided by the number of sides.",
);
export const isoscelesExteriorTemplate = meta(
  "geo-isosceles-exterior-angle",
  "Exterior angle of an isosceles triangle with algebraic base angles",
  "triangle-angle-theorems",
  0.5,
  "Set the two algebraic base angles of an isosceles triangle equal, solve for the variable, then find the exterior angle at the apex or at a base vertex.",
  false,
);
export const complementaryChoiceTemplate = meta(
  "geo-complementary-trig-choice",
  "Sine equals cosine of acute angles",
  "complementary-trigonometry",
  0.45,
  "Choose the equation that follows from the sine of one acute angle equaling the cosine of another, or solve it for the smallest angle of the triangle.",
);
export const parallelSegmentTemplate = meta(
  "geo-parallel-segment-length",
  "Side lengths of a triangle cut by a parallel segment",
  "similarity-theorems",
  0.5,
  "Use the equal ratios of the parts a segment parallel to one side cuts from the other two sides, to find a whole side or the length that makes the segment parallel.",
  false,
);
export const areaChangingTemplate = meta(
  "geo-area-changing-transformation",
  "Which transformation changes or keeps the area of a rectangle",
  "transformation-invariants",
  0.45,
  "Decide from coordinate rules which of four transformations changes the area of a rectangle, or which one keeps area without keeping the figure congruent.",
);
export const sectionImpossibleTemplate = meta(
  "geo-section-impossible",
  "Shape that cannot be a plane section of a solid",
  "solid-cross-sections",
  0.4,
  "Choose the shape that cannot be the cross section of a rectangular prism, a cylinder or a cone cut by a plane.",
);
export const parallelogramSpecialTemplate = meta(
  "geo-parallelogram-sufficient",
  "Condition that makes a parallelogram a rhombus or a rectangle",
  "parallelogram-proofs",
  0.4,
  "Choose the added condition that is enough to make a parallelogram a rhombus or a rectangle, rejecting conditions that every parallelogram already has.",
);

const tex = (s: string | number) => `$${s}$`;

/* ----------------------------------------------------- altitude to hypotenuse */
const altAxes = {
  ask: defineAxis("ask", ["leg", "altitude", "other-leg"] as const),
};
export const altitudeHypotenuse = chainFamily({
  template: altitudeHypotenuseTemplate,
  axes: altAxes,
  model: (r: R) => ({ p: r(1, 12), q: r(1, 12) }),
  variant: (m) =>
    Number.isInteger(Math.sqrt(m.p * m.q))
      ? "integer-altitude"
      : "radical-altitude",
  render: (m, a, r) => {
    const { p, q } = m;
    const h = p + q;
    const ask = a.ask;
    const target = ask === "leg" ? p * h : ask === "other-leg" ? q * h : p * q;
    const name = ask === "altitude" ? "CD" : ask === "leg" ? "AC" : "BC";
    const lab = (n: number) => tex(radicalTex(n));
    const pool: [number, string][] =
      ask === "altitude"
        ? [
            [
              p * h,
              "This is leg $AC$, which uses the whole hypotenuse. The altitude uses only the two pieces: altitude² $=AD\\cdot DB$.",
            ],
            [
              q * h,
              "This is leg $BC$: a piece times the whole hypotenuse. The altitude uses the two pieces instead: altitude² $=AD\\cdot DB$.",
            ],
            [
              h * h,
              "This is the whole hypotenuse, $AD+DB$. The altitude is shorter than every side of the big triangle.",
            ],
            [
              p * p + q * q,
              "This adds the squares of the two pieces, as if they were legs. They are not legs. The altitude is $\\sqrt{AD\\cdot DB}$, using their product.",
            ],
          ]
        : [
            [
              p * q,
              "This is the altitude, $\\sqrt{AD\\cdot DB}$. A leg uses the whole hypotenuse times the piece of it next to that leg.",
            ],
            [
              ask === "leg" ? q * h : p * h,
              "This is the other leg. It uses the piece of the hypotenuse on the far side, not the piece next to this leg.",
            ],
            [
              h * h,
              "This is the whole hypotenuse. A leg is always shorter than the hypotenuse, the side across from the right angle.",
            ],
            [
              p * p + q * q,
              "This adds the squares of the two pieces of the hypotenuse, as if they were legs. They are pieces of the hypotenuse, not legs.",
            ],
          ];
    const part = ask === "other-leg" ? q : p;
    void part;
    return choiceSurface(r, {
      prompt: `In right triangle $ABC$ the right angle is at $C$. The altitude from $C$ meets hypotenuse $\\overline{AB}$ at $D$, with $AD=${p}$ and $DB=${q}$. What is the length of $\\overline{${name}}$?`,
      options: [
        { label: lab(target), correct: true },
        ...pool.map(([n, feedback]) => ({ label: lab(n), feedback })),
      ],
      hint:
        ask === "altitude"
          ? `The altitude splits the triangle into two smaller triangles, $ACD$ and $CBD$, with the same shape. So $CD$ is in proportion to both pieces, $AD=${p}$ and $DB=${q}$. Write that proportion.`
          : `Triangle $${ask === "leg" ? "ACD" : "BCD"}$ has the same shape as the whole triangle $ABC$. Match $${name}$ with the piece of the hypotenuse beside it, ${ask === "leg" ? p : q}, and with the whole hypotenuse $AB=${p}+${q}$.`,
      explanation: [
        `The altitude $\\overline{CD}$ is the segment from the right angle $C$ that meets the hypotenuse $\\overline{AB}$ at a right angle. The hypotenuse is the side across from the right angle.`,
        `It splits triangle $ABC$ into two smaller right triangles. All three share the same angles, so they are similar: the same shape, different sizes.`,
        ...(ask === "altitude"
          ? [
              `In similar triangles, matching sides are in the same ratio. Matching short leg to long leg in $ACD$ and $CBD$ gives $\\frac{AD}{CD}=\\frac{CD}{DB}$.`,
              `Cross-multiply, multiplying each side by both denominators: $CD^2=AD\\cdot DB=${p}\\cdot${q}=${p * q}$.`,
              `Take the square root and simplify: $CD=\\sqrt{${p * q}}=${radicalTex(p * q)}$.`,
              `The altitude $\\overline{CD}$ has length $${radicalTex(p * q)}$.`,
            ]
          : [
              `The whole hypotenuse is the two pieces together: $AB=${p}+${q}=${h}$.`,
              `Triangle $${ask === "leg" ? "ACD" : "BCD"}$ matches triangle $ABC$. In each, compare the hypotenuse with the side along $\\overline{AB}$: $\\frac{AB}{${name}}=\\frac{${name}}{${ask === "leg" ? "AD" : "DB"}}$, so $\\frac{${h}}{${name}}=\\frac{${name}}{${ask === "leg" ? p : q}}$.`,
              `Cross-multiply, multiplying each side by both denominators: $${name}^2=${ask === "leg" ? p : q}\\cdot${h}=${target}$.`,
              `Take the square root and simplify: $${name}=\\sqrt{${target}}=${radicalTex(target)}$.`,
              `The length of $\\overline{${name}}$ is $${radicalTex(target)}$.`,
            ]),
      ],
    });
  },
});
void radical;

/* ---------------------------------------------------------- centroid */
const centroidAxes = {
  ask: defineAxis("ask", ["true-statement", "segment-length"] as const),
};
const medianNames = [
  ["A", "D", "BC"],
  ["B", "E", "AC"],
  ["C", "F", "AB"],
] as const;
export const centroidMedian = chainFamily({
  template: centroidMedianTemplate,
  axes: centroidAxes,
  model: (r: R) => ({ which: r(0, 2), t: r(1, 9), asksFar: r(0, 1) === 1 }),
  variant: (m) => medianNames[m.which]![0].toLowerCase() + "-median",
  render: (m, a, r) => {
    const [V, M, side] = medianNames[m.which]!;
    const vg = `${V}G`;
    const gm = `G${M}`;
    const vm = `${V}${M}`;
    const intro = `In $\\triangle ABC$, $G$ is the centroid and $\\overline{${vm}}$ is the median to $\\overline{${side}}$, so $G$ lies on $\\overline{${vm}}$.`;
    if (a.ask === "true-statement") {
      const truths: [string, string][] = [
        [
          `${vg}=2(${gm})`,
          `The centroid is twice as far from the vertex as from the midpoint.`,
        ],
        [
          `${vg}=\\frac23(${vm})`,
          `The part from the vertex is two thirds of the median.`,
        ],
        [
          `${gm}=\\frac13(${vm})`,
          `The part from the midpoint is one third of the median.`,
        ],
        [`${vm}=3(${gm})`, `The whole median is three times the short part.`],
      ];
      const falses: [string, string][] = [
        [
          `${vg}=${gm}`,
          "Equal parts would put $G$ at the middle of the median. The centroid sits two thirds of the way from the vertex, so the parts are 2 to 1.",
        ],
        [
          `${gm}=2(${vg})`,
          "This reverses the 2 to 1 split. The longer part is the one next to the vertex, not the one next to the midpoint.",
        ],
        [
          `${vg}=\\frac12(${vm})`,
          "Half of the median would put $G$ at its middle. The centroid is two thirds of the way from the vertex.",
        ],
        [
          `${vm}=2(${gm})`,
          "The median has 3 equal sections and the short part is 1 of them. So the whole median is three times the short part, not twice.",
        ],
        [
          `${gm}=\\frac12(${vm})`,
          "The median has 3 equal sections and the short part is 1 of them, so it is one third of the median, not one half.",
        ],
        [
          `${vg}=3(${gm})`,
          "The vertex part is 2 of the 3 sections and the short part is 1, so the vertex part is twice the short part, not three times.",
        ],
      ];
      const [good, why] = pick(r, truths);
      const wrong = shuffle(r, falses).slice(0, 3);
      return choiceSurface(r, {
        prompt: `${intro} Which statement is always true?`,
        options: [
          { label: tex(good), correct: true },
          ...wrong.map(([l, f]) => ({ label: tex(l), feedback: f })),
        ],
        hint: `The centroid is where the medians meet. It splits $\\overline{${vm}}$ into two unequal pieces, $${vg}$ next to the vertex $${V}$ and $${gm}$ next to the midpoint $${M}$. Decide which piece is longer, and by what ratio.`,
        explanation: [
          `A median of a triangle is a segment from a corner (vertex) to the midpoint of the opposite side. Here $\\overline{${vm}}$ runs from $${V}$ to the midpoint $${M}$.`,
          `The three medians always cross at one point, the centroid, $G$. It is the triangle's balance point.`,
          `The centroid splits each median in the ratio 2 to 1: the piece next to the vertex is twice the piece next to the midpoint.`,
          `So $${vg}:${gm}=2:1$. Think of $\\overline{${vm}}$ as 3 equal sections: $${vg}$ is 2 of them and $${gm}$ is 1.`,
          `${why}`,
          `So the statement that is always true is $${good}$.`,
        ],
      });
    }
    const whole = 6 * m.t;
    const asked = m.asksFar ? vg : gm;
    const target = m.asksFar ? 4 * m.t : 2 * m.t;
    return choiceSurface(r, {
      prompt: `${intro} The median $\\overline{${vm}}$ has length $${whole}$. What is the length of $\\overline{${asked}}$?`,
      options: [
        { label: tex(target), correct: true },
        {
          label: tex(m.asksFar ? 2 * m.t : 4 * m.t),
          feedback: `This is the other piece. The part next to the vertex is the longer one, 2 of the 3 sections; the part next to the midpoint is 1 section.`,
        },
        {
          label: tex(3 * m.t),
          feedback:
            "This is half the median, which would put $G$ at its middle. The centroid splits the median 2 to 1, into 3 equal sections.",
        },
        {
          label: tex(whole),
          feedback:
            "This is the whole median. $G$ cuts it into two pieces, and the question asks for one of them.",
        },
      ],
      hint: `The whole median $\\overline{${vm}}$ is ${whole}. The centroid cuts it into 3 equal sections, and $${vg}$ takes 2 of them while $${gm}$ takes 1. Find the length of one section.`,
      explanation: [
        `A median runs from a corner (vertex) to the midpoint of the opposite side. The three medians cross at the centroid, $G$.`,
        `The centroid splits each median in the ratio 2 to 1, with the longer piece next to the vertex $${V}$.`,
        `A 2 to 1 split makes $2+1=3$ equal sections. Each is $${whole}\\div3=${2 * m.t}$ long.`,
        `$${vg}$ is 2 sections: $${2 * m.t}\\cdot2=${4 * m.t}$. $${gm}$ is 1 section: $${2 * m.t}$.`,
        `The length of $\\overline{${asked}}$ is ${target}.`,
      ],
    });
  },
});

/* ----------------------------------------------------- polygon rotation */
const polyNames: Record<number, string> = {
  3: "Equilateral triangle",
  4: "Square",
  5: "Regular pentagon",
  6: "Regular hexagon",
  8: "Regular octagon",
  9: "Regular nonagon",
  10: "Regular decagon",
  12: "Regular dodecagon",
};
const polyAxes = {
  count: defineAxis("count", ["one-rotation", "two-rotations"] as const),
};
export const polygonRotation = chainFamily({
  template: polygonRotationTemplate,
  axes: polyAxes,
  model: (r: R, a) => {
    const n = pick(r, [3, 4, 5, 6, 8, 9, 10, 12] as const);
    const step = 360 / n;
    const js = shuffle(
      r,
      Array.from({ length: n - 1 }, (_, i) => i + 1),
    );
    const angles = (
      a.count === "one-rotation" ? js.slice(0, 1) : js.slice(0, 2)
    )
      .map((j) => j * step)
      .sort((x, y) => x - y);
    return { n, angles };
  },
  variant: (m) => `${m.angles.length}-angle-${m.n}-gon`,
  render: (m, _a, r) => {
    const works = (k: number) => m.angles.every((t) => (t * k) % 360 === 0);
    const others = shuffle(
      r,
      [3, 4, 5, 6, 8, 9, 10, 12].filter((k) => k !== m.n && !works(k)),
    );
    if (others.length < 3) return null;
    const listed = m.angles.map((t) => `$${t}^\\circ$`).join(" and ");
    const options = [
      { label: polyName(m.n), correct: true as const },
      ...others.slice(0, 3).map((k) => {
        const bad = m.angles.find((t) => (t * k) % 360 !== 0)!;
        return {
          label: polyName(k),
          feedback: `A ${polyName(k).toLowerCase()} has ${k} equal sides, so its smallest self-matching turn is $360^\\circ\\div${k}=${360 / k}^\\circ$. $${bad}^\\circ$ is not a whole number of those turns, so it does not land on itself.`,
        };
      }),
    ];
    return choiceSurface(r, {
      prompt: `Which polygon maps onto itself when it is rotated ${listed} about its center?${m.angles.length === 1 ? "" : " It must map onto itself under each of the rotations."}`,
      options,
      hint: `A regular polygon with $n$ equal sides lands on itself after turns of $360^\\circ\\div n$, or whole multiples of that. For each polygon, check whether ${m.angles.map((t) => `$${t}^\\circ$`).join(" and ")} ${m.angles.length === 1 ? "is" : "are"} such a multiple.`,
      explanation: [
        `A regular polygon has all sides equal and all angles equal. "Maps onto itself" means after the turn it covers exactly the same spot.`,
        `A regular polygon with $n$ sides does this after a turn of $\\frac{360^\\circ}{n}$, one full turn shared among its $n$ corners. Any whole multiple of that turn also works.`,
        `For a ${polyName(m.n).toLowerCase()}, $\\frac{360^\\circ}{${m.n}}=${360 / m.n}^\\circ$. Then ${m.angles.map((t) => `$${t}^\\circ=${t / (360 / m.n)}\\cdot${360 / m.n}^\\circ$`).join(" and ")}, a whole number of those turns.`,
        `Each other polygon listed has a smallest turn that does not divide ${m.angles.length === 1 ? "the angle" : "both angles"} evenly.`,
        `The polygon that maps onto itself is the ${polyName(m.n).toLowerCase()}.`,
      ],
    });
  },
});
function polyName(n: number) {
  return polyNames[n]!;
}

/* ------------------------------------------------ isosceles exterior angle */
const isoExtAxes = {
  exterior: defineAxis("exterior", ["apex", "base-vertex"] as const),
};
export const isoscelesExterior = chainFamily({
  template: isoscelesExteriorTemplate,
  axes: isoExtAxes,
  model: (r: R) => {
    for (;;) {
      const a = r(2, 6);
      const c = r(1, 5);
      if (a === c) continue;
      const x = r(4, 20);
      const b = r(-15, 15);
      const base = a * x + b;
      const d = base - c * x;
      if (base < 25 || base > 75 || Math.abs(d) > 30 || d === 0 || b === 0)
        continue;
      return { a, b, c, d, x, base };
    }
  },
  variant: (m) => (m.base > 50 ? "large-base-angle" : "small-base-angle"),
  render: (m, a) => {
    const expr = (k: number, c0: number) =>
      `${k === 1 ? "" : k}x ${c0 < 0 ? "-" : "+"} ${Math.abs(c0)}`;
    const apex = a.exterior === "apex";
    const answer = apex ? 2 * m.base : 180 - m.base;
    const name = apex
      ? "the exterior angle at $A$, formed by extending $\\overline{BA}$ beyond $A$"
      : "the exterior angle at $B$, formed by extending $\\overline{AB}$ beyond $B$";
    return numberSurface({
      prompt: `In isosceles triangle $ABC$, $AB=AC$. The base angles are $m\\angle B=(${expr(m.a, m.b)})^\\circ$ and $m\\angle C=(${expr(m.c, m.d)})^\\circ$. Find the measure, in degrees, of ${name}.`,
      answer: String(answer),
      hint: `Since $AB=AC$, the base angles $(${expr(m.a, m.b)})^\\circ$ and $(${expr(m.c, m.d)})^\\circ$ are equal. Set the two expressions equal and solve for $x$ first.`,
      explanation: [
        `An isosceles triangle has two equal sides, here $AB=AC$. The angles across from those sides, the base angles $B$ and $C$, are equal too.`,
        `So set the two base angles equal: $${expr(m.a, m.b)}=${expr(m.c, m.d)}$.`,
        `Subtract $${m.c === 1 ? "" : m.c}x$ and ${m.b < 0 ? "add" : "subtract"} ${Math.abs(m.b)} on both sides to gather $x$ on one side: $${m.a - m.c === 1 ? "" : m.a - m.c === -1 ? "-" : m.a - m.c}x=${m.d - m.b}$, so $x=${m.x}$.`,
        `Substitute to get a base angle: $${m.a}(${m.x})${m.b < 0 ? "-" : "+"}${Math.abs(m.b)}=${m.base}^\\circ$.`,
        apex
          ? `An exterior angle is made by extending one side past a corner. It equals the sum of the two interior angles not touching it, here both base angles: $${m.base}+${m.base}=${answer}$.`
          : `An exterior angle is made by extending one side past a corner. It and the inside angle at $B$ form a straight line, so they add to $180^\\circ$: $180-${m.base}=${answer}$.`,
        `The exterior angle at $${apex ? "A" : "B"}$ measures ${answer} degrees.`,
      ],
      label: "Angle (degrees)",
    });
  },
});

/* ------------------------------------------------------- complementary */
const compAxes = {
  ask: defineAxis("ask", ["equation", "smallest-angle"] as const),
};
export const complementaryChoice = chainFamily({
  template: complementaryChoiceTemplate,
  axes: compAxes,
  model: (r: R) => {
    for (;;) {
      const a = r(1, 5);
      const c = r(1, 5);
      const x = r(4, 12);
      const A = r(15, 60);
      const b = A - a * x;
      const B = 90 - A;
      const d = B - c * x;
      if (Math.abs(b) > 30 || Math.abs(d) > 30 || b === 0 || d === 0 || A === B)
        continue;
      return { a, b, c, d, x, A, B };
    }
  },
  variant: (m) => (m.A < m.B ? "first-smaller" : "second-smaller"),
  render: (m, a, r) => {
    const e = (k: number, v: number) =>
      `${k === 1 ? "" : k}x ${v < 0 ? "-" : "+"} ${Math.abs(v)}`;
    const P = e(m.a, m.b);
    const Q = e(m.c, m.d);
    const setup = `Angles $A$ and $B$ are acute, with $m\\angle A=(${P})^\\circ$ and $m\\angle B=(${Q})^\\circ$, and $\\sin A=\\cos B$.`;
    if (a.ask === "equation") {
      return choiceSurface(r, {
        prompt: `${setup} Which equation can be used to solve for $x$?`,
        options: [
          { label: tex(`(${P})+(${Q})=90`), correct: true },
          {
            label: tex(`${P}=${Q}`),
            feedback:
              "This sets the angles equal. That would fit $\\sin A=\\sin B$. Here a sine equals a cosine, which happens when the angles add to $90^\\circ$.",
          },
          {
            label: tex(`(${P})+(${Q})=180`),
            feedback:
              "This uses $180^\\circ$, the sum for supplementary angles, which make a straight line. A sine equals a cosine when the angles are complementary, adding to $90^\\circ$.",
          },
          {
            label: tex(`(${P})-(${Q})=90`),
            feedback:
              "This subtracts the angles. The rule is $\\sin\\theta=\\cos(90^\\circ-\\theta)$: the two angles add to $90^\\circ$.",
          },
        ],
        hint: `The sine of an acute angle equals the cosine of its complement, the angle that adds with it to $90^\\circ$. Decide what $(${P})^\\circ$ and $(${Q})^\\circ$ must add to.`,
        explanation: [
          "In a right triangle, the sine of an angle is opposite ÷ hypotenuse, and the cosine is adjacent ÷ hypotenuse.",
          "The side opposite one acute angle is adjacent to the other. So the sine of one acute angle equals the cosine of the other.",
          "The two acute angles of a right triangle add to $90^\\circ$; they are complementary. So $\\sin A=\\cos B$ means $A+B=90^\\circ$.",
          `Write that with the expressions: $(${P})+(${Q})=90$.`,
          `Check: solving gives $x=${m.x}$, so the angles are $${m.A}^\\circ$ and $${m.B}^\\circ$, which add to $90^\\circ$.`,
          `The equation to use is $(${P})+(${Q})=90$.`,
        ],
      });
    }
    const small = Math.min(m.A, m.B);
    return choiceSurface(r, {
      prompt: `${setup} What is the measure of the smallest angle of triangle $ABC$?`,
      options: [
        { label: tex(`${small}^\\circ`), correct: true },
        {
          label: tex(`${Math.max(m.A, m.B)}^\\circ`),
          feedback:
            "This is the larger of the two acute angles. The question asks for the smallest angle of the triangle.",
        },
        {
          label: tex(`${m.x}^\\circ`),
          feedback:
            "This is the value of $x$, not an angle. Put it back into each angle expression to get the angles.",
        },
        {
          label: tex("90^\\circ"),
          feedback:
            "The triangle does have a $90^\\circ$ angle, but a right angle is always the largest angle, not the smallest.",
        },
      ],
      hint: `Since $\\sin A=\\cos B$ for acute angles, $(${P})^\\circ$ and $(${Q})^\\circ$ must add to $90^\\circ$. Write that equation and solve for $x$, then find both angles.`,
      explanation: [
        "In a right triangle, the side opposite one acute angle is adjacent to the other. So the sine of one equals the cosine of the other.",
        "That is why $\\sin A=\\cos B$ means the angles are complementary: they add to $90^\\circ$.",
        `Write the equation: $(${P})+(${Q})=90$. Combine like terms: $${m.a + m.c}x${m.b + m.d < 0 ? "-" : "+"}${Math.abs(m.b + m.d)}=90$.`,
        `${m.b + m.d < 0 ? "Add" : "Subtract"} ${Math.abs(m.b + m.d)} on both sides, then divide by ${m.a + m.c}: $x=${m.x}$.`,
        `Substitute: $A=${m.A}^\\circ$ and $B=${m.B}^\\circ$. The angles of a triangle add to $180^\\circ$, so the third angle is $90^\\circ$.`,
        `The smallest angle of triangle $ABC$ measures $${small}^\\circ$.`,
      ],
    });
  },
});

/* --------------------------------------------------- parallel segment */
const parAxes = {
  ask: defineAxis("ask", ["whole-side", "parallel-length"] as const),
};
export const parallelSegment = chainFamily({
  template: parallelSegmentTemplate,
  axes: parAxes,
  model: (r: R) => {
    const a = r(2, 8);
    const b = r(2, 9);
    return { a, b, k: r(2, 5) };
  },
  variant: (m) => (m.a < m.b ? "short-top" : "long-top"),
  render: (m, a) => {
    const c = m.a * m.k;
    const ec = m.b * m.k;
    const base = `In triangle $ABC$, point $D$ is on $\\overline{AB}$ and point $E$ is on $\\overline{AC}$, with $AD=${m.a}$, $DB=${m.b}$ and $AE=${c}$.`;
    if (a.ask === "whole-side") {
      return numberSurface({
        prompt: `${base} $\\overline{DE}\\parallel\\overline{BC}$. Find the length of $\\overline{AC}$.`,
        answer: String(c + ec),
        hint: `A segment parallel to $\\overline{BC}$ cuts $\\overline{AB}$ and $\\overline{AC}$ in the same ratio. Use $AD:DB=${m.a}:${m.b}$ to find $EC$ from $AE=${c}$, then add the two pieces of $\\overline{AC}$.`,
        explanation: [
          `The symbol $\\parallel$ means parallel: the segments never meet. A segment parallel to one side of a triangle cuts the other two sides in the same ratio.`,
          `So the pieces of $\\overline{AB}$ and of $\\overline{AC}$ compare the same way: $\\frac{AD}{DB}=\\frac{AE}{EC}$, which is $\\frac{${m.a}}{${m.b}}=\\frac{${c}}{EC}$.`,
          `Cross-multiply, multiplying both sides by both denominators: $${m.a}\\cdot EC=${m.b}\\cdot${c}$, so $EC=\\frac{${m.b}\\cdot${c}}{${m.a}}=${ec}$.`,
          `$\\overline{AC}$ is made of the two pieces: $AC=AE+EC=${c}+${ec}=${c + ec}$.`,
          `The length of $\\overline{AC}$ is ${c + ec}.`,
        ],
        label: "Length of AC",
      });
    }
    return numberSurface({
      prompt: `${base} What must the length of $\\overline{EC}$ be so that $\\overline{DE}\\parallel\\overline{BC}$?`,
      answer: String(ec),
      hint: `$\\overline{DE}\\parallel\\overline{BC}$ exactly when $\\overline{DE}$ cuts the two sides in the same ratio. Compare $AD:DB=${m.a}:${m.b}$ with $AE:EC=${c}:EC$.`,
      explanation: [
        `The symbol $\\parallel$ means parallel: the segments never meet. A segment is parallel to one side of a triangle exactly when it cuts the other two sides in the same ratio.`,
        `So we need $\\frac{AD}{DB}=\\frac{AE}{EC}$, which is $\\frac{${m.a}}{${m.b}}=\\frac{${c}}{EC}$.`,
        `Cross-multiply, multiplying both sides by both denominators: $${m.a}\\cdot EC=${m.b}\\cdot${c}$, so $EC=\\frac{${m.b}\\cdot${c}}{${m.a}}=${ec}$.`,
        `Check: $\\frac{${c}}{${ec}}$ simplifies to $\\frac{${m.a}}{${m.b}}$, so the ratios match.`,
        `$\\overline{EC}$ must be ${ec} long for $\\overline{DE}$ to be parallel to $\\overline{BC}$.`,
      ],
      label: "Length of EC",
    });
  },
});

/* ------------------------------------------------- area-changing rule */
const areaAxes = {
  ask: defineAxis("ask", ["changes-area", "keeps-area-not-congruent"] as const),
};
interface Rule {
  label: string;
  factor: string;
  rigid: boolean;
  area: boolean;
}
const rigidRules = (r: R): Rule[] => [
  {
    label: `(x,\\ y)\\to(x+${r(2, 6)},\\ y-${r(1, 5)})`,
    factor: "a translation; it slides the rectangle without changing its size",
    rigid: true,
    area: true,
  },
  {
    label: "(x,\\ y)\\to(x,\\ -y)",
    factor:
      "a reflection over the $x$-axis; it flips the rectangle without changing its size",
    rigid: true,
    area: true,
  },
  {
    label: "(x,\\ y)\\to(-y,\\ x)",
    factor:
      "a rotation of $90^\\circ$ about the origin; it turns the rectangle without changing its size",
    rigid: true,
    area: true,
  },
  {
    label: "(x,\\ y)\\to(-x,\\ y)",
    factor:
      "a reflection over the $y$-axis; it flips the rectangle without changing its size",
    rigid: true,
    area: true,
  },
];
const changing = (r: R): Rule[] => {
  const k = pick(r, [2, 3, 4] as const);
  return [
    {
      label: `(x,\\ y)\\to(x,\\ ${k}y)`,
      factor: `a vertical stretch that multiplies the height by ${k}, so the area is multiplied by ${k}`,
      rigid: false,
      area: false,
    },
    {
      label: `(x,\\ y)\\to(${k}x,\\ y)`,
      factor: `a horizontal stretch that multiplies the width by ${k}, so the area is multiplied by ${k}`,
      rigid: false,
      area: false,
    },
    {
      label: `(x,\\ y)\\to(${k}x,\\ ${k}y)`,
      factor: `a dilation about the origin that multiplies both dimensions by ${k}, so the area is multiplied by ${k * k}`,
      rigid: false,
      area: false,
    },
  ];
};
export const areaChanging = chainFamily({
  template: areaChangingTemplate,
  axes: areaAxes,
  model: (r: R) => ({
    seedPick: r(0, 5),
    rigid: rigidRules(r),
    change: changing(r),
    stretch: pick(r, [2, 3, 4] as const),
    shear: r(0, 1) === 1,
  }),
  variant: (m) => (m.shear ? "shear" : "reciprocal-stretch"),
  render: (m, a, r) => {
    if (a.ask === "changes-area") {
      const bad = pick(r, m.change);
      const keeps = shuffle(r, m.rigid).slice(0, 3);
      return choiceSurface(r, {
        prompt:
          "A rectangle in the coordinate plane is transformed. Which transformation changes the area of the rectangle?",
        options: [
          { label: `$${bad.label}$`, correct: true },
          ...keeps.map((k) => ({
            label: `$${k.label}$`,
            feedback: `This is ${k.factor}. Same size means the same area, so this rule does not change it.`,
          })),
        ],
        hint: `Check what each rule does to a side of the rectangle. For example, test $${keeps[0]!.label}$: do the corners stay the same distance apart? A rule that multiplies a coordinate by a number other than $1$ or $-1$ changes a length.`,
        explanation: [
          "The arrow rule says where each point $(x,\\ y)$ goes. Multiplying a coordinate by a number stretches the figure in that direction.",
          "A translation (slide), a reflection (flip) or a rotation (turn) is a rigid motion. It keeps every length, so the image is congruent, the same size and shape, and the area stays the same.",
          "Adding a number, or changing a sign, or swapping $x$ and $y$ keeps lengths. Multiplying by 2, 3 or 4 does not.",
          `$${bad.label}$ is ${bad.factor}.`,
          `The transformation that changes the area is $${bad.label}$.`,
        ],
      });
    }
    const k = m.stretch;
    const keeper: Rule = m.shear
      ? {
          label: `(x,\\ y)\\to(x+${k}y,\\ y)`,
          factor: `a shear; it slides each horizontal row sideways, which keeps the base and the height, so the area is unchanged, but the rectangle becomes a slanted parallelogram`,
          rigid: false,
          area: true,
        }
      : {
          label: `(x,\\ y)\\to(${k}x,\\ \\frac{y}{${k}})`,
          factor: `a stretch by ${k} in one direction and a shrink by $\\frac1${k}$ in the other, so the area is multiplied by $${k}\\cdot\\frac{1}{${k}}=1$ while the side lengths change`,
          rigid: false,
          area: true,
        };
    const wrongs = shuffle(r, [...m.rigid.slice(0, 2), ...m.change]).slice(
      0,
      3,
    );
    return choiceSurface(r, {
      prompt:
        "A rectangle in the coordinate plane is transformed. Which transformation keeps the area of the rectangle the same but does not always produce a figure congruent to the rectangle?",
      options: [
        { label: `$${keeper.label}$`, correct: true },
        ...wrongs.map((w) => ({
          label: `$${w.label}$`,
          feedback: w.rigid
            ? `This is ${w.factor}. Its image is always congruent to the rectangle, so it fails the "not congruent" part.`
            : `This is ${w.factor}. The area changes, so it fails the "same area" part.`,
        })),
      ],
      hint: `Two things must hold: the area stays the same, and some side length changes. Test the rule $${wrongs[0]!.label}$: find how it changes the width and the height, and multiply those factors.`,
      explanation: [
        "The arrow rule says where each point $(x,\\ y)$ goes. Two things must hold: the area is unchanged, and the image is not congruent (not the same size and shape).",
        "A translation (slide), reflection (flip) or rotation (turn) keeps every length. Its image is always congruent, so it fails the second part.",
        "A stretch multiplies the area by its factor. Unless the factors multiply to 1, the area changes, so it fails the first part.",
        `$${keeper.label}$ is ${keeper.factor}.`,
        `The transformation that keeps the area but not the shape is $${keeper.label}$.`,
      ],
    });
  },
});

/* ------------------------------------------------------- cross sections */
const sectionAxes = {
  solid: defineAxis("solid", [
    "rectangular-prism",
    "cylinder",
    "cone",
  ] as const),
};
export const sectionImpossible = chainFamily({
  template: sectionImpossibleTemplate,
  axes: sectionAxes,
  model: (r: R) => ({ roll: r(0, 99) }),
  variant: (m) => `draw-${m.roll % 3}`,
  render: (m, a, r) => {
    const solids = {
      "rectangular-prism": {
        name: "a rectangular prism",
        ok: [
          "a triangle",
          "a rectangle",
          "a parallelogram",
          "a trapezoid",
          "a pentagon",
          "a hexagon",
        ],
        bad: [
          [
            "a circle",
            "A prism has only flat faces, and a flat cut through a flat face makes a straight edge. So no cross section has a curved edge.",
          ],
          [
            "a heptagon",
            "A heptagon has seven sides. A prism has six faces, and the cut makes at most one side on each face, so at most six sides.",
          ],
          [
            "an octagon",
            "An octagon has eight sides. A prism has six faces, and the cut makes at most one side on each face, so at most six sides.",
          ],
          [
            "an ellipse",
            "An ellipse is a curved oval. A prism has only flat faces, so every edge of a cross section is straight.",
          ],
        ],
        why: "A cross section is the flat shape you see where a plane (a flat cut) slices the solid. A rectangular prism is a box with six flat faces. The cut crosses each face in at most one straight segment, so the section is a polygon with at most six straight sides.",
      },
      cylinder: {
        name: "a cylinder",
        ok: ["a circle", "an ellipse", "a rectangle"],
        bad: [
          [
            "a triangle",
            "A cylinder has a curved side and two flat circles. A cut can make a circle, an oval or a rectangle, but never three straight sides meeting at three corners.",
          ],
          [
            "a pentagon",
            "Straight sides come from cutting the flat circles or running along the side's length. A cylinder allows at most four straight sides, a rectangle, so never five.",
          ],
          [
            "a hexagon",
            "Straight sides come from cutting the flat circles or running along the side's length. A cylinder allows at most four straight sides, a rectangle, so never six.",
          ],
        ],
        why: "A cross section is the flat shape where a plane (a flat cut) slices the solid. A cylinder is like a can. A level cut gives a circle, a tilted cut gives an ellipse (an oval), and a straight-down cut gives a rectangle.",
      },
      cone: {
        name: "a cone",
        ok: ["a circle", "an ellipse", "a triangle"],
        bad: [
          [
            "a rectangle",
            "A rectangle needs two pairs of parallel sides. A cone narrows to a point, so its straight edges always meet, never run parallel.",
          ],
          [
            "a square",
            "A square needs two pairs of parallel sides. A cone narrows to a point, so its straight edges always meet, never run parallel.",
          ],
          [
            "a pentagon",
            "A cone has one flat circle and a curved side. A cut can make at most three straight sides, a triangle through the tip, so never five.",
          ],
        ],
        why: "A cross section is the flat shape where a plane (a flat cut) slices the solid. A cone is like an ice cream cone. A level cut gives a circle, a tilted cut gives an ellipse (an oval), and a cut straight down through the tip gives a triangle.",
      },
    } as const;
    const s = solids[a.solid];
    const ok = shuffle(r, [...s.ok]).slice(0, 3);
    const [bad, why] = pick(
      r,
      s.bad as unknown as readonly (readonly [string, string])[],
    );
    void m;
    return choiceSurface(r, {
      prompt: `A plane cuts through ${s.name}. Which shape cannot be the cross section?`,
      options: [
        { label: bad, correct: true },
        ...ok.map((o) => ({
          label: o,
          feedback: `${o.replace(/^an? /, "").replace(/^./, (c) => c.toUpperCase())} is possible: some flat cut through ${s.name} makes that shape. The question asks for a shape no cut can make.`,
        })),
      ],
      hint: `Picture slicing ${s.name} with a flat knife. Count its flat faces and curved surfaces: each flat face gives at most one straight side to the cut. Start by asking how ${ok[0]} could be cut out of it.`,
      explanation: [
        s.why,
        why,
        `So ${bad} is the shape that cannot be a cross section of ${s.name}.`,
      ],
    });
  },
});

/* ------------------------------------------------ parallelogram conditions */
const paraAxes = {
  target: defineAxis("target", ["rhombus", "rectangle"] as const),
};
export const parallelogramSpecial = chainFamily({
  template: parallelogramSpecialTemplate,
  axes: paraAxes,
  model: (r: R) => ({ roll: r(0, 99) }),
  variant: (m) => `draw-${m.roll % 2}`,
  render: (m, a, r) => {
    void m;
    const common: [string, string][] = [
      [
        "its opposite sides are congruent",
        "Every parallelogram already has congruent (equal) opposite sides. A condition every parallelogram meets cannot prove a special one.",
      ],
      [
        "its opposite angles are congruent",
        "Every parallelogram already has congruent (equal) opposite angles. A condition every parallelogram meets cannot prove a special one.",
      ],
      [
        "its diagonals bisect each other",
        "Every parallelogram's diagonals already bisect each other, cutting each other in half. A condition every parallelogram meets cannot prove a special one.",
      ],
      [
        "its consecutive angles are supplementary",
        "Every parallelogram's neighboring angles already add to $180^\\circ$ (supplementary). A condition every parallelogram meets cannot prove a special one.",
      ],
    ];
    const rhombus = a.target === "rhombus";
    const good: [string, string][] = rhombus
      ? [
          [
            "its diagonals are perpendicular",
            "The diagonals cut each other in half. If they also meet at right angles, the four small triangles are congruent right triangles, so all four sides are equal.",
          ],
          [
            "two consecutive sides are congruent",
            "Opposite sides of a parallelogram are already equal. If two neighboring sides are equal too, all four sides are equal.",
          ],
          [
            "a diagonal bisects an angle of the parallelogram",
            "The diagonal splits the angle into two equal parts. With the parallel sides, that makes an isosceles triangle, so two neighboring sides are equal, and then all four are.",
          ],
        ]
      : [
          [
            "it has a right angle",
            "Neighboring angles of a parallelogram add to $180^\\circ$, and opposite angles are equal. So one $90^\\circ$ angle makes all four angles $90^\\circ$.",
          ],
          [
            "its diagonals are congruent",
            "Equal diagonals make the two triangles on one side congruent. So two neighboring angles are equal, and since they add to $180^\\circ$, each is $90^\\circ$.",
          ],
        ];
    const bad: [string, string][] = rhombus
      ? [
          [
            "its diagonals are congruent",
            "Equal diagonals prove a rectangle, not a rhombus. A long, thin rectangle has equal diagonals but unequal sides.",
          ],
          [
            "it has a right angle",
            "A right angle proves a rectangle, not a rhombus. A long, thin rectangle has right angles but unequal sides.",
          ],
          ...common,
        ]
      : [
          [
            "its diagonals are perpendicular",
            "Perpendicular diagonals prove a rhombus, not a rectangle. A tilted rhombus has perpendicular diagonals but no right angles.",
          ],
          [
            "two consecutive sides are congruent",
            "Equal neighboring sides prove a rhombus, not a rectangle. A tilted rhombus has equal sides but no right angles.",
          ],
          ...common,
        ];
    const [g, why] = pick(r, good);
    const wrongs = shuffle(r, bad).slice(0, 3);
    const cap = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;
    return choiceSurface(r, {
      prompt: `Parallelogram $ABCD$ is given. Which added condition is enough to prove that $ABCD$ is a ${a.target}?`,
      options: [
        { label: `${cap(g)}.`, correct: true },
        ...wrongs.map(([l, f]) => ({ label: `${cap(l)}.`, feedback: f })),
      ],
      hint: `A ${a.target} is a parallelogram with an extra property. Cross out any option that every parallelogram already has; for example, ask whether "${wrongs[0]![0]}" is true of every parallelogram. Check what remains against the definition of a ${a.target}.`,
      explanation: [
        "A parallelogram has two pairs of parallel sides. Its opposite sides are equal, its opposite angles are equal, and its diagonals cut each other in half.",
        rhombus
          ? "A rhombus is a parallelogram with all four sides congruent (equal)."
          : "A rectangle is a parallelogram with four right angles.",
        "A condition true of every parallelogram cannot prove anything special. A condition that proves the other special shape is not enough either.",
        `The condition "${g}" works. ${why}`,
        `So the added condition that proves $ABCD$ is a ${a.target} is: ${g}.`,
      ],
    });
  },
});

export const regentsGeometryFiguresTemplates = [
  altitudeHypotenuseTemplate,
  centroidMedianTemplate,
  polygonRotationTemplate,
  isoscelesExteriorTemplate,
  complementaryChoiceTemplate,
  parallelSegmentTemplate,
  areaChangingTemplate,
  sectionImpossibleTemplate,
  parallelogramSpecialTemplate,
];
export const regentsGeometryFiguresGenerate = dispatch(
  regentsGeometryFiguresTemplates,
  {
    "geo-altitude-hypotenuse": (s) => altitudeHypotenuse.generate(s).problem,
    "geo-centroid-median": (s) => centroidMedian.generate(s).problem,
    "geo-polygon-rotation": (s) => polygonRotation.generate(s).problem,
    "geo-isosceles-exterior-angle": (s) =>
      isoscelesExterior.generate(s).problem,
    "geo-complementary-trig-choice": (s) =>
      complementaryChoice.generate(s).problem,
    "geo-parallel-segment-length": (s) => parallelSegment.generate(s).problem,
    "geo-area-changing-transformation": (s) => areaChanging.generate(s).problem,
    "geo-section-impossible": (s) => sectionImpossible.generate(s).problem,
    "geo-parallelogram-sufficient": (s) =>
      parallelogramSpecial.generate(s).problem,
  },
);
void par;
