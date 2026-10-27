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
              "This is a leg. The altitude squared equals the product of the two parts of the hypotenuse, $AD\\cdot DB$.",
            ],
            [
              q * h,
              "This is the other leg. The altitude squared equals $AD\\cdot DB$, not a part times the whole hypotenuse.",
            ],
            [
              h * h,
              "This is the whole hypotenuse. The altitude is shorter than both legs and the hypotenuse.",
            ],
            [
              p * p + q * q,
              "The altitude is the geometric mean of the two parts, $\\sqrt{AD\\cdot DB}$, so it uses their product, not the sum of their squares.",
            ],
          ]
        : [
            [
              p * q,
              "This is the altitude. A leg is the geometric mean of the whole hypotenuse and the part of it next to that leg.",
            ],
            [
              ask === "leg" ? q * h : p * h,
              "This is the other leg: it uses the part of the hypotenuse on the opposite side.",
            ],
            [
              h * h,
              "This is the length of the hypotenuse; each leg is shorter than the hypotenuse.",
            ],
            [
              p * p + q * q,
              "The two parts of the hypotenuse are not the legs, so $p^2+q^2$ is not a leg squared.",
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
          ? `Triangles $ACD$ and $CBD$ are similar, so $CD$ is in proportion to both $AD=${p}$ and $DB=${q}$. Write that proportion and cross-multiply.`
          : `Triangle $${ask === "leg" ? "ACD" : "BCD"}$ is similar to the whole triangle $ABC$. Match $${name}$ with the part of the hypotenuse beside it, ${ask === "leg" ? p : q}, and with the whole hypotenuse $AB=${h}$.`,
      explanation:
        ask === "altitude"
          ? [
              `Triangles $ACD$ and $CBD$ are similar, so $\\frac{AD}{CD}=\\frac{CD}{DB}$.`,
              `$CD^2=AD\\cdot DB=${p}\\cdot${q}=${p * q}$.`,
              `$CD=\\sqrt{${p * q}}=${radicalTex(p * q)}$.`,
            ]
          : [
              `The hypotenuse is $AB=${p}+${q}=${h}$. Triangle $${ask === "leg" ? "ACD" : "BCD"}$ is similar to triangle $ABC$, so $\\frac{${name}}{${h}}=\\frac{${ask === "leg" ? p : q}}{${name}}$.`,
              `$${name}^2=${ask === "leg" ? p : q}\\cdot${h}=${target}$.`,
              `$${name}=\\sqrt{${target}}=${radicalTex(target)}$.`,
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
  variant: (m) => medianNames[m.which]![0] + "-median",
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
          "The parts are not equal; that would put $G$ at the midpoint of the median.",
        ],
        [
          `${gm}=2(${vg})`,
          "The longer part is the one next to the vertex, so this reverses the 2 to 1 split.",
        ],
        [
          `${vg}=\\frac12(${vm})`,
          "Half of the median would mean the midpoint; the centroid is two thirds of the way from the vertex.",
        ],
        [
          `${vm}=2(${gm})`,
          "The whole median is three times the short part, not twice.",
        ],
        [
          `${gm}=\\frac12(${vm})`,
          "The short part is one third of the median, not one half.",
        ],
        [
          `${vg}=3(${gm})`,
          "The vertex part is twice the short part, not three times.",
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
          `The three medians of a triangle meet at the centroid, and the centroid divides each median in the ratio 2 to 1, with the longer part next to the vertex.`,
          `So $${vg}:${gm}=2:1$, and $${vm}=${vg}+${gm}$ is 3 equal parts of which $${vg}$ is 2.`,
          `${why}`,
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
          feedback: `This is the other piece. The part next to the vertex is the longer one, twice the part next to the midpoint.`,
        },
        {
          label: tex(3 * m.t),
          feedback:
            "Half of the median would put $G$ at the midpoint; the centroid divides the median 2 to 1.",
        },
        {
          label: tex(whole),
          feedback: "This is the whole median; $G$ divides it into two parts.",
        },
      ],
      hint: `The whole median $\\overline{${vm}}$ is ${whole}. The centroid cuts it into 3 equal sections, and $${vg}$ takes 2 of them while $${gm}$ takes 1. Find the length of one section.`,
      explanation: [
        `The centroid divides $\\overline{${vm}}$ in the ratio 2:1, so there are $2+1=3$ equal sections of length $${whole}\\div3=${2 * m.t}$.`,
        `$${vg}$ is 2 sections, $${2 * m.t}\\cdot2=${4 * m.t}$, and $${gm}$ is 1 section, $${2 * m.t}$.`,
        `$${asked}=${target}$.`,
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
          feedback: `A ${polyName(k).toLowerCase()} maps onto itself only for rotations that are multiples of $360^\\circ\\div${k}=${360 / k}^\\circ$, and $${bad}^\\circ$ is not one.`,
        };
      }),
    ];
    return choiceSurface(r, {
      prompt: `Which polygon maps onto itself when it is rotated ${listed} about its center?${m.angles.length === 1 ? "" : " It must map onto itself under each of the rotations."}`,
      options,
      hint: `A regular polygon with $n$ sides maps onto itself under rotations that are multiples of $360^\\circ\\div n$. Test whether ${m.angles.map((t) => `$${t}^\\circ$`).join(" and ")} ${m.angles.length === 1 ? "is" : "are"} such multiples for each polygon.`,
      explanation: [
        `A regular $n$-gon maps onto itself under a rotation about its center exactly when the angle is a multiple of $\\frac{360^\\circ}{n}$.`,
        `For a ${polyName(m.n).toLowerCase()}, $\\frac{360^\\circ}{${m.n}}=${360 / m.n}^\\circ$, and ${m.angles.map((t) => `$${t}^\\circ=${t / (360 / m.n)}\\cdot${360 / m.n}^\\circ$`).join(" and ")}.`,
        `The other polygons listed fail at least one of the rotations, so the answer is the ${polyName(m.n).toLowerCase()}.`,
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
        `The base angles of an isosceles triangle are equal: $${expr(m.a, m.b)}=${expr(m.c, m.d)}$.`,
        `Subtract: $${m.a - m.c}x=${m.d - m.b}$, so $x=${m.x}$, and each base angle is $${m.a}(${m.x})${m.b < 0 ? "-" : "+"}${Math.abs(m.b)}=${m.base}^\\circ$.`,
        apex
          ? `An exterior angle equals the sum of the two remote interior angles: $${m.base}+${m.base}=${answer}$.`
          : `An exterior angle is supplementary to the interior angle at $B$: $180-${m.base}=${answer}$.`,
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
              "Equal angles have equal sines, but here the sine of one angle equals the cosine of the other, so the angles are not equal in general.",
          },
          {
            label: tex(`(${P})+(${Q})=180`),
            feedback:
              "Angles with equal sine and cosine in this way add to $90^\\circ$ (complementary), not $180^\\circ$ (supplementary).",
          },
          {
            label: tex(`(${P})-(${Q})=90`),
            feedback:
              "The cofunction identity $\\sin\\theta=\\cos(90^\\circ-\\theta)$ adds the angles to $90^\\circ$; it does not subtract them.",
          },
        ],
        hint: `Use the cofunction identity: the sine of an acute angle equals the cosine of its complement. Decide what the sum of $(${P})^\\circ$ and $(${Q})^\\circ$ must be.`,
        explanation: [
          "For acute angles, $\\sin A=\\cos B$ exactly when $A$ and $B$ are complementary.",
          `So the two angle expressions add to $90^\\circ$: $(${P})+(${Q})=90$.`,
          `Solving gives $x=${m.x}$, which makes the angles $${m.A}^\\circ$ and $${m.B}^\\circ$.`,
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
            "This is the larger acute angle; the question asks for the smallest angle.",
        },
        {
          label: tex(`${m.x}^\\circ`),
          feedback:
            "This is the value of $x$, not an angle. Substitute it into the expressions.",
        },
        {
          label: tex("90^\\circ"),
          feedback:
            "The triangle has a right angle, but it is its largest angle, not the smallest.",
        },
      ],
      hint: `Since $\\sin A=\\cos B$ for acute angles, $(${P})^\\circ$ and $(${Q})^\\circ$ must add to $90^\\circ$. Write that equation and solve for $x$, then find both angles.`,
      explanation: [
        `$\\sin A=\\cos B$ with acute angles means $A+B=90^\\circ$: $(${P})+(${Q})=90$.`,
        `$${m.a + m.c}x${m.b + m.d < 0 ? "-" : "+"}${Math.abs(m.b + m.d)}=90$ gives $x=${m.x}$.`,
        `$A=${m.A}^\\circ$ and $B=${m.B}^\\circ$, and the third angle is $90^\\circ$, so the smallest angle is $${small}^\\circ$.`,
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
          `Because $\\overline{DE}\\parallel\\overline{BC}$, $\\frac{AD}{DB}=\\frac{AE}{EC}$, so $\\frac{${m.a}}{${m.b}}=\\frac{${c}}{EC}$.`,
          `$EC=\\frac{${m.b}\\cdot${c}}{${m.a}}=${ec}$.`,
          `$AC=AE+EC=${c}+${ec}=${c + ec}$.`,
        ],
        label: "Length of AC",
      });
    }
    return numberSurface({
      prompt: `${base} What must the length of $\\overline{EC}$ be so that $\\overline{DE}\\parallel\\overline{BC}$?`,
      answer: String(ec),
      hint: `$\\overline{DE}\\parallel\\overline{BC}$ exactly when $\\overline{DE}$ cuts the two sides in the same ratio. Compare $AD:DB=${m.a}:${m.b}$ with $AE:EC=${c}:EC$.`,
      explanation: [
        `The segment is parallel to $\\overline{BC}$ exactly when $\\frac{AD}{DB}=\\frac{AE}{EC}$.`,
        `$\\frac{${m.a}}{${m.b}}=\\frac{${c}}{EC}$, so $EC=\\frac{${m.b}\\cdot${c}}{${m.a}}=${ec}$.`,
        `With $EC=${ec}$ the ratios match, so $\\overline{DE}\\parallel\\overline{BC}$.`,
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
            feedback: `This is ${k.factor}, so the area stays the same.`,
          })),
        ],
        hint: `Check what each rule does to a side of the rectangle. For example, test $${keeps[0]!.label}$: do the coordinates of the corners keep their distances from each other? A rule that multiplies a coordinate by a number other than $1$ or $-1$ changes a length.`,
        explanation: [
          "Translations, reflections and rotations are rigid motions: they preserve length, so the image is congruent to the rectangle and has the same area.",
          `$${bad.label}$ is ${bad.factor}.`,
          "So this is the transformation that changes the area.",
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
            ? `This is ${w.factor}, so the image is always congruent to the rectangle.`
            : `This is ${w.factor}, so the area changes.`,
        })),
      ],
      hint: `Two things must hold: the area factor is $1$, and some side length changes. Test the rule $${wrongs[0]!.label}$: find how it changes the width and the height, and multiply those factors.`,
      explanation: [
        `A rule that only translates, reflects or rotates keeps all lengths, so the image is congruent.`,
        `A rule that does not multiply the area by exactly one fails the first condition.`,
        `$${keeper.label}$ is ${keeper.factor}.`,
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
            "A prism is bounded by flat faces, so no cross section has a curved edge.",
          ],
          [
            "a heptagon",
            "A prism has six faces, and a plane section has at most one side on each face, so at most six sides.",
          ],
          [
            "an octagon",
            "A prism has six faces, and a plane section has at most one side on each face, so at most six sides.",
          ],
          [
            "an ellipse",
            "A prism is bounded by flat faces, so no cross section has a curved edge.",
          ],
        ],
        why: "A plane meets each of the six flat faces of a prism in at most one segment, so the section is a polygon with at most six sides.",
      },
      cylinder: {
        name: "a cylinder",
        ok: ["a circle", "an ellipse", "a rectangle"],
        bad: [
          [
            "a triangle",
            "A plane section of a cylinder is a circle, an ellipse or a rectangle (or a region with curved ends); it has no three straight sides.",
          ],
          [
            "a pentagon",
            "A cylinder has only two flat faces, so a section cannot have five straight sides.",
          ],
          [
            "a hexagon",
            "A cylinder has only two flat faces, so a section cannot have six straight sides.",
          ],
        ],
        why: "A plane parallel to the bases gives a circle, a tilted plane across the side gives an ellipse, and a plane parallel to the axis gives a rectangle. No cut gives a straight-sided polygon with three or more extra sides.",
      },
      cone: {
        name: "a cone",
        ok: ["a circle", "an ellipse", "a triangle"],
        bad: [
          [
            "a rectangle",
            "A cone narrows to a point, so no plane section is a rectangle.",
          ],
          [
            "a square",
            "A cone narrows to a point, so no plane section is a square.",
          ],
          [
            "a pentagon",
            "A cone has one flat face and a curved side, so a section cannot have five straight sides.",
          ],
        ],
        why: "A plane parallel to the base gives a circle, a tilted plane gives an ellipse, and a plane through the apex gives a triangle. A cone has no parallel straight edges to produce a rectangle.",
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
          feedback: `${o.replace(/^an? /, "").replace(/^./, (c) => c.toUpperCase())} can be a cross section of ${s.name} for a suitable position and tilt of the plane.`,
        })),
      ],
      hint: `Think about the faces of ${s.name}: how many flat faces and curved surfaces does it have? Each flat face contributes at most one straight side to a section. Start by asking how ${ok[0]} could be cut out of it.`,
      explanation: [
        s.why,
        why,
        `So ${bad} is the shape that cannot be a cross section.`,
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
        "Every parallelogram has congruent opposite sides, so this adds nothing.",
      ],
      [
        "its opposite angles are congruent",
        "Every parallelogram has congruent opposite angles, so this adds nothing.",
      ],
      [
        "its diagonals bisect each other",
        "The diagonals of every parallelogram bisect each other, so this adds nothing.",
      ],
      [
        "its consecutive angles are supplementary",
        "Consecutive angles of every parallelogram are supplementary, so this adds nothing.",
      ],
    ];
    const rhombus = a.target === "rhombus";
    const good: [string, string][] = rhombus
      ? [
          [
            "its diagonals are perpendicular",
            "Perpendicular diagonals make the four small triangles congruent right triangles, so all four sides are equal.",
          ],
          [
            "two consecutive sides are congruent",
            "A parallelogram has congruent opposite sides, so two congruent consecutive sides make all four sides equal.",
          ],
          [
            "a diagonal bisects an angle of the parallelogram",
            "A bisected angle with parallel sides makes an isosceles triangle, so two consecutive sides are equal.",
          ],
        ]
      : [
          [
            "it has a right angle",
            "Consecutive angles are supplementary, so one right angle makes all four angles right angles.",
          ],
          [
            "its diagonals are congruent",
            "Congruent diagonals make the triangles on each side congruent, so the angles at the base are equal and supplementary, hence right angles.",
          ],
        ];
    const bad: [string, string][] = rhombus
      ? [
          [
            "its diagonals are congruent",
            "Congruent diagonals make a parallelogram a rectangle, not necessarily a rhombus.",
          ],
          [
            "it has a right angle",
            "A right angle makes a parallelogram a rectangle, not necessarily a rhombus.",
          ],
          ...common,
        ]
      : [
          [
            "its diagonals are perpendicular",
            "Perpendicular diagonals make a parallelogram a rhombus, not necessarily a rectangle.",
          ],
          [
            "two consecutive sides are congruent",
            "Congruent consecutive sides make a parallelogram a rhombus, not necessarily a rectangle.",
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
      hint: `A ${a.target} is a parallelogram with an extra property. Remove any option that every parallelogram already has; for example, ask whether "${wrongs[0]![0]}" is already true of every parallelogram. Then check what remains against the definition of a ${a.target}.`,
      explanation: [
        rhombus
          ? "A rhombus is a parallelogram with four congruent sides."
          : "A rectangle is a parallelogram with four right angles.",
        `${cap(g)}. ${why}`,
        "The other conditions are either true of every parallelogram or lead to the other special parallelogram.",
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
