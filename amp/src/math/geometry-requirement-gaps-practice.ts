import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import {
  assemble,
  random,
  shuffle,
  type Random,
} from "./distribution-practice";
import { MAX_STACK, stackHeights } from "./data-display-models";
import { graph } from "./scene/author";
import type { Scene } from "./scene/spec";

/** Eight single-choice families that close standard facets whose own skill had
 * no assessing template: radian and sector derivations, the geometry of complex
 * arithmetic, everyday conditional probability, congruence and similarity by
 * transformation, conic foci, and choosing a plot for raw data. Every answer is
 * exact; only the prompt, optional figure and shuffled choices reach the
 * learner, and each wrong choice is a checked, specific misconception. */
const meta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  gradeBand: TemplateMetadata["gradeBand"] = "9–12",
  figure?: NonNullable<TemplateMetadata["requiredFigureCapability"]>,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand,
  difficultyOffset,
  requiredResponseCapability: "single-choice-v1",
  ...(figure ? { requiredFigureCapability: figure } : {}),
  description,
});

export const arcSectorDerivationTemplate = meta(
  "arc-sector-derivation",
  "Arc length, radians and sector area from proportion",
  "arc-sector-measure",
  0.3,
  "Use similar circles to show arc length is proportional to radius, define radian measure as arc over radius, and find sector area as a fraction of the disk.",
);
export const complexPlaneOperationsTemplate = meta(
  "complex-plane-operations",
  "Complex arithmetic in the plane",
  "complex-plane",
  0.4,
  "Interpret sums, differences, conjugates, multiplication by i, and multiplication by a modulus and argument as moves in the complex plane.",
  "9–12",
  "scenes-v1",
);
export const conditionalEverydayTemplate = meta(
  "conditional-everyday-reasoning",
  "Conditional probability and independence in everyday situations",
  "conditional-probability",
  0.3,
  "Distinguish P(A given B) from P(B given A), read conditional statements in words, and decide independence from described rates.",
);
export const congruenceRigidMotionTemplate = meta(
  "congruence-by-rigid-motion",
  "Congruence by rigid motions",
  "congruence-criteria",
  0.3,
  "Choose or predict the rigid motions that carry one triangle onto another, decide congruence by whether such a sequence exists, and match corresponding parts.",
  "9–12",
  "scenes-v1",
);
export const conicFociTemplate = meta(
  "conic-foci",
  "Foci of ellipses and hyperbolas",
  "conic-sections",
  0.45,
  "Find foci from an equation with c² = a² − b² or c² = a² + b², and find the equation from foci and a constant sum or difference of distances.",
);
export const choosePlotTemplate = meta(
  "choose-the-plot",
  "Match raw data to its dot plot, histogram or box plot",
  "distribution-plots",
  0.25,
  "Choose the data set a dot plot, histogram or box plot displays, and choose the bar heights or five-number summary a data set produces.",
  "6–8",
  "data-displays-v1",
);
export const similarityTransformationTemplate = meta(
  "similarity-by-transformation",
  "Similarity by dilation and rigid motion",
  "similarity-proofs",
  0.35,
  "Choose the dilation and rigid motions that map one triangle onto another, and decide similarity from whether such a sequence exists.",
  "9–12",
  "scenes-v1",
);
export const aaSimilarityTemplate = meta(
  "aa-similarity",
  "Angle-angle similarity and correspondence",
  "similarity-proofs",
  0.3,
  "Decide similarity of two triangles by AA from stated angles, name the correspondence, and write the matching proportion of sides.",
);
export const geometryRequirementGapTemplates: readonly TemplateMetadata[] = [
  arcSectorDerivationTemplate,
  complexPlaneOperationsTemplate,
  conditionalEverydayTemplate,
  congruenceRigidMotionTemplate,
  conicFociTemplate,
  choosePlotTemplate,
  similarityTransformationTemplate,
  aaSimilarityTemplate,
];

type Wrong = { label: string; feedback: string };
type Built = {
  variant: string;
  prompt: string;
  figure?: SemanticFigure;
  hint: string;
  explanation: string[];
  correct: string;
  wrong: Wrong[];
};

const M = (s: string) => `$${s}$`;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const sceneFigure = (scene: Scene): SemanticFigure => ({
  kind: "scene",
  scene,
});
/** Reduced fraction n/d in LaTeX. */
function frac(n: number, d = 1): string {
  const g = gcd(n, d) || 1;
  let a = n / g;
  let b = d / g;
  if (b < 0) {
    a = -a;
    b = -b;
  }
  if (b === 1) return `${a}`;
  return a < 0 ? `-\\frac{${-a}}{${b}}` : `\\frac{${a}}{${b}}`;
}
/** (n/d)·π in LaTeX. */
function piMul(n: number, d = 1): string {
  const g = gcd(n, d) || 1;
  const a = n / g;
  const b = d / g;
  if (b === 1) return a === 1 ? "\\pi" : `${a}\\pi`;
  return a === 1 ? `\\frac{\\pi}{${b}}` : `\\frac{${a}\\pi}{${b}}`;
}
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const nonzero = (r: Random, max: number) => r(1, max) * (r(0, 1) ? 1 : -1);

/** Three distinct wrong choices, shuffled by the seeded generator. */
function pickWrong(r: Random, correct: string, wrong: Wrong[]): Wrong[] {
  const seen = new Set([correct]);
  const unique = wrong.filter((w) => {
    if (seen.has(w.label)) return false;
    seen.add(w.label);
    return true;
  });
  if (unique.length < 3)
    throw new Error(
      `Insufficient distinct choices: ${correct} / ${wrong.map((w) => w.label).join(" | ")}`,
    );
  return shuffle(r, unique).slice(0, 3);
}

// ------------------------------------------------------- arc-sector-derivation
function arcSectorDerivation(r: Random): Built {
  const variant = [
    "arc-proportional",
    "similar-circles-equation",
    "radian-from-arc",
    "arc-from-radian",
    "sector-fraction",
    "sector-simplify",
  ][r(0, 5)]!;
  if (variant === "arc-proportional") {
    const g = r(1, 3);
    const a = r(1, 6);
    let b = r(1, 6);
    if (b === a) b = a === 6 ? 5 : a + 1;
    const m = r(2, 5);
    const angle = pick(r, [40, 50, 70, 80, 100, 120]);
    const r1 = a * g;
    const r2 = b * g;
    const s1 = a * m;
    const s2 = b * m;
    const cm = (t: string) => `${M(t)} cm`;
    const correct = cm(`${s2}`);
    return {
      variant,
      prompt: `Any two circles are similar. In a circle of radius ${r1} cm, a central angle of ${angle}° cuts off an arc ${s1} cm long. How long is the arc cut off by a central angle of ${angle}° in a circle of radius ${r2} cm?`,
      hint: `Both circles are scaled copies of each other, so lengths scale with the radius. Find the ratio of arc length to radius in the first circle (${s1} to ${r1}) and keep that ratio.`,
      explanation: [
        `The circles are similar, so every length in one is the same multiple of the matching length in the other. The central angle is the same, so the arcs correspond.`,
        `The scale factor from the first circle to the second is $${frac(r2, r1)}$, so the arc scales by $${frac(r2, r1)}$ too.`,
        `$${s1}\\times${frac(r2, r1)}=${s2}$. The arc is ${s2} cm long.`,
      ],
      correct,
      wrong: [
        {
          label: cm(`${s1 + r2 - r1}`),
          feedback: `Adding the difference of the radii is not scaling. Lengths in similar figures are multiplied by the same factor, ${frac(r2, r1)} here.`,
        },
        {
          label: cm(frac(s1 * r1, r2)),
          feedback:
            "That uses the inverse of the scale factor. The second circle has the larger radius exactly when its arc is longer.",
        },
        {
          label: cm(`${r2}`),
          feedback:
            "That is the radius of the second circle, not the length of the arc.",
        },
        {
          label: cm(`${s1}`),
          feedback:
            "The angle is the same, but the arc is longer or shorter because the radius changed. Arc length is proportional to radius.",
        },
        {
          label: cm(frac(s2 * r2, r1)),
          feedback:
            "That scales by the square of the ratio, which is how areas change. Arc length is a length and scales by the ratio itself.",
        },
      ],
    };
  }
  if (variant === "similar-circles-equation") {
    const r1 = r(2, 9);
    let r2 = r(3, 12);
    if (r2 === r1) r2 += 1;
    const s1 = r(3, 11);
    const x = "x";
    return {
      variant,
      prompt: `Two circles have the same central angle. In the circle of radius ${r1} the angle cuts off an arc of length ${s1}. In the circle of radius ${r2} it cuts off an arc of length $x$. Because circles are similar, arc length is proportional to radius. Which equation finds $x$?`,
      hint: `Proportional means arc length divided by radius is the same number in both circles. Write that ratio for the circle of radius ${r1}, then for the circle of radius ${r2}, and set them equal.`,
      explanation: [
        `In similar circles the ratio of arc length to radius does not depend on the circle for a fixed angle.`,
        `Circle 1 has ratio $\\frac{${s1}}{${r1}}$ and circle 2 has ratio $\\frac{${x}}{${r2}}$.`,
        `Setting them equal gives $\\frac{${s1}}{${r1}}=\\frac{${x}}{${r2}}$.`,
      ],
      correct: M(`\\frac{${s1}}{${r1}}=\\frac{${x}}{${r2}}`),
      wrong: [
        {
          label: M(`\\frac{${s1}}{${r2}}=\\frac{${x}}{${r1}}`),
          feedback:
            "This pairs an arc with the other circle's radius. Each ratio must compare an arc with its own radius.",
        },
        {
          label: M(`${s1}\\cdot${r1}=${x}\\cdot${r2}`),
          feedback:
            "Equal products describe inverse variation. A larger radius gives a longer arc, so the ratios, not the products, are equal.",
        },
        {
          label: M(`${s1}+${r1}=${x}+${r2}`),
          feedback:
            "Equal sums would mean the arcs differ by the same amount as the radii. Similar circles scale, they do not shift.",
        },
      ],
    };
  }
  if (variant === "radian-from-arc") {
    const rad = r(2, 9);
    let s = r(1, 20);
    if (s === rad) s += 1;
    const correct = M(frac(s, rad));
    return {
      variant,
      prompt: `A central angle of a circle with radius ${rad} cm cuts off an arc ${s} cm long. What is the measure of the angle in radians?`,
      hint: `Radian measure counts how many radius lengths fit along the arc. Compare the arc length ${s} cm with the radius ${rad} cm.`,
      explanation: [
        `Radian measure is the arc length divided by the radius, because it is the fixed ratio of arc to radius for that angle.`,
        `$\\theta=\\frac{s}{r}=\\frac{${s}}{${rad}}=${frac(s, rad)}$.`,
        `The angle measures ${correct} radians.`,
      ],
      correct,
      wrong: [
        {
          label: M(frac(rad, s)),
          feedback: "That divides the radius by the arc. Divide arc by radius.",
        },
        {
          label: M(`${s * rad}`),
          feedback:
            "Multiplying arc and radius does not give an angle. Radian measure is their ratio.",
        },
        {
          label: M(`\\frac{${s}}{${piMul(2 * rad)}}`),
          feedback: `That is the fraction of the whole circumference, which is the angle in turns, not radians. One turn is $2\\pi$ radians.`,
        },
        {
          label: M(`${s - rad}`),
          feedback:
            "Subtracting compares the lengths by difference. Radian measure uses their ratio.",
        },
      ],
    };
  }
  if (variant === "arc-from-radian") {
    const q = pick(r, [1, 2, 3, 4]);
    let p = r(1, 9);
    if (p === q) p += 1;
    const k = r(1, 4) + (q === 1 ? 1 : 0);
    const rad = q * k;
    const s = p * k;
    const cm = (t: string) => `${M(t)} cm`;
    return {
      variant,
      prompt: `A central angle measures $${frac(p, q)}$ radians in a circle of radius ${rad} cm. What is the length of the arc it cuts off?`,
      hint: `One radian cuts off an arc exactly one radius long. Think about how many radius lengths the angle $${frac(p, q)}$ covers.`,
      explanation: [
        `By the definition of radian measure, $\\theta=\\frac{s}{r}$, so $s=\\theta r$.`,
        `$s=${frac(p, q)}\\times${rad}=${s}$.`,
        `The arc is ${s} cm long.`,
      ],
      correct: cm(`${s}`),
      wrong: [
        {
          label: cm(frac(p, q * rad)),
          feedback:
            "That divides the angle by the radius. Arc length is angle times radius.",
        },
        {
          label: cm(frac(q * rad, p)),
          feedback: "That divides the radius by the angle. Multiply them.",
        },
        {
          label: cm(`${frac(p * rad * rad, q)}`),
          feedback:
            "The radius appears once: $s=\\theta r$, not $\\theta r^2$.",
        },
        {
          label: cm(`\\frac{${s}\\pi}{180}`),
          feedback:
            "That converts as though the angle were in degrees. A radian measure is already the ratio of arc to radius.",
        },
      ],
    };
  }
  if (variant === "sector-fraction") {
    const [p, q] = pick(r, [
      [1, 3],
      [2, 3],
      [1, 2],
      [3, 4],
      [1, 4],
      [3, 2],
      [5, 6],
      [1, 6],
    ] as const);
    const rad = r(2, 9);
    const area = (t: string) => `${M(t)} cm$^2$`;
    const correct = area(piMul(p * rad * rad, 2 * q));
    return {
      variant,
      prompt: `A sector has central angle $${piMul(p, q)}$ radians in a circle of radius ${rad} cm. One full turn is $2\\pi$ radians. What is the area of the sector?`,
      hint: `The sector is the same fraction of the disk as its angle is of a full turn, $2\\pi$ radians. Find that fraction first, then multiply by the area of the whole disk, $\\pi\\cdot${rad}^2$.`,
      explanation: [
        `The sector is a fraction of the disk: $\\frac{\\theta}{2\\pi}=\\frac{${piMul(p, q)}}{2\\pi}=${frac(p, 2 * q)}$.`,
        `The disk has area $\\pi r^2=${rad * rad}\\pi$.`,
        `$${frac(p, 2 * q)}\\times${rad * rad}\\pi=${piMul(p * rad * rad, 2 * q)}$ square centimeters.`,
      ],
      correct,
      wrong: [
        {
          label: area(piMul(p * rad * rad, q)),
          feedback:
            "That treats the angle as a fraction of a half turn. A full turn is $2\\pi$ radians, so the fraction is half as large.",
        },
        {
          label: area(piMul(p * rad, 2 * q)),
          feedback: "Area uses $r^2$, not $r$. The disk's area is $\\pi r^2$.",
        },
        {
          label: area(piMul(p * rad, q)),
          feedback:
            "That is the arc length $\\theta r$, a length. A sector's area also uses the square of the radius.",
        },
        {
          label: area(`\\frac{${p * rad * rad}\\pi^2}{${360 * q}}`),
          feedback:
            "The 360 belongs to degree measure. This angle is in radians, so divide by $2\\pi$.",
        },
      ],
    };
  }
  // sector-simplify: area = (θ/2π)·πr² = ½θr² for θ in radians.
  const theta2 = pick(r, [1, 2, 3, 4, 5, 6]); // θ = theta2 / 2 radians
  const rad = r(2, 10);
  const thetaText = `${theta2 / 2}`;
  const quarters = (v: number) => `${v / 4}`; // exact: v is a count of quarters
  const area = (t: string) => `${M(t)} cm$^2$`;
  const correctQ = theta2 * rad * rad;
  return {
    variant,
    prompt: `A sector has central angle ${thetaText} radians in a circle of radius ${rad} cm. The sector is the fraction $\\frac{\\theta}{2\\pi}$ of the disk of area $\\pi r^2$. What is its area?`,
    hint: `Write the area as $\\frac{\\theta}{2\\pi}\\cdot\\pi r^2$ with $\\theta=${thetaText}$ and $r=${rad}$. Look at what happens to the two factors of $\\pi$.`,
    explanation: [
      `Area $=\\frac{\\theta}{2\\pi}\\cdot\\pi r^2=\\frac{1}{2}\\theta r^2$, because the $\\pi$ in the numerator cancels the $\\pi$ in the denominator.`,
      `$\\frac{1}{2}\\times${thetaText}\\times${rad}^2=${quarters(correctQ)}$.`,
      `The sector's area is ${quarters(correctQ)} square centimeters.`,
    ],
    correct: area(quarters(correctQ)),
    wrong: [
      {
        label: area(quarters(2 * correctQ)),
        feedback:
          "Remember the $\\frac{1}{2}$: dividing by $2\\pi$ leaves a factor of $\\frac12$.",
      },
      {
        label: area(quarters(theta2 * rad)),
        feedback:
          "That is $\\frac12\\theta r$ with $r$ not squared. Area has square units, so use $r^2$.",
      },
      {
        label: area(`${quarters(correctQ)}\\pi`),
        feedback:
          "The $\\pi$ cancels: the $\\pi$ below in $\\theta/(2\\pi)$ cancels the $\\pi$ in $\\pi r^2$.",
      },
      {
        label: area(quarters(2 * theta2 * rad)),
        feedback:
          "That is the arc length $\\theta r$. A sector's area uses $r^2$ and the factor $\\frac12$.",
      },
    ],
  };
}

// ------------------------------------------------------ complex-plane-operations
type Pt = [number, number];
const cx = (a: number, b: number): string => {
  const mag = Math.abs(b) === 1 ? "" : `${Math.abs(b)}`;
  if (b === 0) return `${a}`;
  if (a === 0) return `${b < 0 ? "-" : ""}${mag}i`;
  return `${a}${b < 0 ? "-" : "+"}${mag}i`;
};
const same = (p: Pt, q: Pt) => p[0] === q[0] && p[1] === q[1];
const key = (p: Pt) => `${p[0]},${p[1]}`;
/** A square coordinate window around the origin that holds every value. */
function planeWindow(values: number[]) {
  const L = Math.max(...values.map(Math.abs)) + 2;
  return graph({ x: [-L, L], y: [-L, L], tick: L > 9 ? 2 : 1 });
}
const PLANE_NOTE =
  "The horizontal axis shows real parts and the vertical axis shows imaginary parts.";
const LETTERS = ["A", "B", "C", "D"] as const;

/** Four lettered candidate points; the letter that names the correct one is the answer. */
function letterChoices(
  r: Random,
  candidates: { at: Pt; correct?: boolean; feedback: string }[],
): {
  order: typeof candidates;
  letter: string;
  correct: string;
  wrong: Wrong[];
} {
  const order = shuffle(r, [...candidates]);
  const label = (i: number) => `Point $${LETTERS[i]}$`;
  if (new Set(order.map((c) => key(c.at))).size !== order.length)
    throw new Error("Candidate points coincide");
  return {
    order,
    letter: LETTERS[order.findIndex((c) => c.correct)]!,
    correct: label(order.findIndex((c) => c.correct)),
    wrong: order.flatMap((c, i) =>
      c.correct ? [] : [{ label: label(i), feedback: c.feedback }],
    ),
  };
}

function complexPlaneOperations(r: Random): Built {
  const variant = [
    "parallelogram",
    "subtract",
    "conjugate-reflection",
    "i-rotation",
    "rotation-angle",
    "scale-rotate",
    "modulus-argument",
  ][r(0, 6)]!;
  if (variant === "parallelogram" || variant === "subtract") {
    let a: number, b: number, c: number, d: number;
    do {
      a = nonzero(r, 4);
      b = nonzero(r, 4);
      c = nonzero(r, 4);
      d = nonzero(r, 4);
    } while (
      a * d - b * c === 0 ||
      a + c === 0 ||
      b + d === 0 ||
      a === c ||
      b === d ||
      [
        [a + c, b + d],
        [a - c, b - d],
        [c - a, d - b],
        [-a - c, -b - d],
      ].some((p) => same(p as Pt, [a, b]) || same(p as Pt, [c, d])) ||
      new Set(
        [
          [a + c, b + d],
          [a - c, b - d],
          [c - a, d - b],
          [-a - c, -b - d],
        ].map((p) => key(p as Pt)),
      ).size < 4
    );
    if (variant === "parallelogram") {
      const picked = letterChoices(r, [
        {
          at: [a + c, b + d],
          correct: true,
          feedback: "",
        },
        {
          at: [a - c, b - d],
          feedback:
            "That point is $z-w$. Together with $O$, $P$ and $Q$ it makes a parallelogram, but $O$ is not opposite it.",
        },
        {
          at: [c - a, d - b],
          feedback:
            "That point is $w-z$. It makes a parallelogram with $O$, $P$ and $Q$, but $O$ is not opposite it.",
        },
        {
          at: [-a - c, -b - d],
          feedback:
            "That point is $-(z+w)$, on the other side of $O$. It is not a vertex of a parallelogram with $O$, $P$ and $Q$ where $O$ is opposite.",
        },
      ]);
      const g = planeWindow([
        a,
        b,
        c,
        d,
        a + c,
        b + d,
        a - c,
        b - d,
        c - a,
        d - b,
      ])
        .id("plane")
        .point(0, 0, "O", { color: "ink" })
        .point(a, b, "P")
        .point(c, d, "Q")
        .segment([0, 0], [a, b])
        .segment([0, 0], [c, d]);
      picked.order.forEach((p, i) =>
        g.point(p.at[0], p.at[1], LETTERS[i]!, { color: "warm" }),
      );
      return {
        variant,
        prompt: `${PLANE_NOTE} $P$ represents $z$ and $Q$ represents $w$. The points $O$, $P$, $Q$ and a fourth point $X$ are the vertices of a parallelogram, with $O$ opposite $X$. Which lettered point is $X$?`,
        figure: sceneFigure(
          g.scene({ title: "Points O, P, Q and four candidates for X" }),
        ),
        hint: `In a parallelogram, opposite sides are parallel and equal. Moving from $P$ by the same step that takes $O$ to $Q$, which is the step $w=${cx(c, d)}$, lands on $X$. Start from $P$ at $${cx(a, b)}$.`,
        explanation: [
          `$P$ is $z=${cx(a, b)}$ and $Q$ is $w=${cx(c, d)}$.`,
          `The side from $P$ to $X$ is parallel and equal to the side from $O$ to $Q$, so $X=z+w$.`,
          `$z+w=${cx(a + c, b + d)}$, which is point $${picked.letter}$.`,
        ],
        correct: picked.correct,
        wrong: picked.wrong,
      };
    }
    const label = (re: number, im: number) => M(cx(re, im));
    const g = planeWindow([a, b, c, d])
      .id("plane")
      .point(a, b, "P")
      .point(c, d, "Q")
      .segment([c, d], [a, b], { arrow: true });
    return {
      variant,
      prompt: `${PLANE_NOTE} $P$ represents $z$ and $Q$ represents $w$. The arrow from $Q$ to $P$ shows the step that takes $w$ to $z$. Which complex number is that step?`,
      figure: sceneFigure(
        g.scene({ title: "Arrow from Q to P in the complex plane" }),
      ),
      hint: `Read $z$ from $P$ and $w$ from $Q$. A step from $Q$ to $P$ changes the real part from ${c} to ${a} and the imaginary part from ${d} to ${b}. Find those two changes.`,
      explanation: [
        `$P$ is $z=${cx(a, b)}$ and $Q$ is $w=${cx(c, d)}$.`,
        `The step from $Q$ to $P$ is what must be added to $w$ to get $z$, so it is $z-w$.`,
        `Real part: $${a}-(${c})=${a - c}$. Imaginary part: $${b}-(${d})=${b - d}$. The step is $${cx(a - c, b - d)}$.`,
      ],
      correct: label(a - c, b - d),
      wrong: [
        {
          label: label(c - a, d - b),
          feedback:
            "That is $w-z$, the arrow from $P$ to $Q$. The arrow here runs from $Q$ to $P$.",
        },
        {
          label: label(a + c, b + d),
          feedback:
            "That is $z+w$, the far corner of the parallelogram. The arrow from $Q$ to $P$ is a difference.",
        },
        {
          label: label(a - c, b + d),
          feedback:
            "Subtract the imaginary parts as well as the real parts: both parts of $w$ are subtracted.",
        },
      ],
    };
  }
  if (
    variant === "conjugate-reflection" ||
    variant === "i-rotation" ||
    variant === "scale-rotate"
  ) {
    let a: number, b: number;
    do {
      a = nonzero(r, 2);
      b = nonzero(r, 2);
    } while (Math.abs(a) === Math.abs(b));
    if (variant === "conjugate-reflection") {
      const picked = letterChoices(r, [
        { at: [a, -b], correct: true, feedback: "" },
        {
          at: [-a, -b],
          feedback:
            "That point is $-z$, the reflection through the origin. The conjugate changes only the sign of the imaginary part.",
        },
        {
          at: [-a, b],
          feedback:
            "That point is the reflection of $P$ in the vertical axis, $-\\overline{z}$. The conjugate keeps the real part.",
        },
        {
          at: [b, a],
          feedback:
            "That point swaps the real and imaginary parts. The conjugate keeps the real part and flips only the imaginary part.",
        },
      ]);
      const g = planeWindow([a, b])
        .id("plane")
        .point(a, b, "P")
        .segment([0, 0], [a, b]);
      picked.order.forEach((p, i) =>
        g.point(p.at[0], p.at[1], LETTERS[i]!, { color: "warm" }),
      );
      return {
        variant,
        prompt: `${PLANE_NOTE} $P$ represents $z$. The conjugate $\\overline{z}$ of $a+bi$ is $a-bi$. Which lettered point represents $\\overline{z}$?`,
        figure: sceneFigure(
          g.scene({ title: "Point P and four candidates for the conjugate" }),
        ),
        hint: `Here $z=${cx(a, b)}$, so $\\overline{z}$ keeps the real part ${a} and changes the sign of the imaginary part. Which line is $P$ reflected across when only the vertical coordinate changes sign?`,
        explanation: [
          `$z=${cx(a, b)}$, so $\\overline{z}=${cx(a, -b)}$.`,
          `The real part stays ${a} and the imaginary part changes from ${b} to ${-b}. That reflects $P$ across the real (horizontal) axis.`,
          `The point at $(${a},${-b})$ is point $${picked.letter}$.`,
        ],
        correct: picked.correct,
        wrong: picked.wrong,
      };
    }
    if (variant === "i-rotation") {
      const picked = letterChoices(r, [
        { at: [-b, a], correct: true, feedback: "" },
        {
          at: [b, -a],
          feedback:
            "That point is $-iz$, a quarter turn clockwise. Multiplying by $i$ turns the point counterclockwise.",
        },
        {
          at: [-a, -b],
          feedback:
            "That point is $-z$, a half turn. Multiplying by $i$ is a quarter turn.",
        },
        {
          at: [a, -b],
          feedback:
            "That point is the conjugate, a reflection. Multiplying by $i$ is a rotation, not a reflection.",
        },
      ]);
      const g = planeWindow([a, b])
        .id("plane")
        .point(a, b, "P")
        .segment([0, 0], [a, b]);
      picked.order.forEach((p, i) =>
        g.point(p.at[0], p.at[1], LETTERS[i]!, { color: "warm" }),
      );
      return {
        variant,
        prompt: `${PLANE_NOTE} $P$ represents $z$. Which lettered point represents $iz$?`,
        figure: sceneFigure(
          g.scene({ title: "Point P and four candidates for iz" }),
        ),
        hint: `Test the rule on the number $1$: $i\\cdot1=i$ moves the point $(1,0)$ to $(0,1)$. Decide what turn does that, then apply the same turn about $O$ to $P$ at $(${a},${b})$.`,
        explanation: [
          `$z=${cx(a, b)}$, so $iz=${a}i+(${b})i^2=${cx(-b, a)}$ because $i^2=-1$.`,
          `Multiplying by $i$ turns every point a quarter turn ($90^\\circ$) counterclockwise about $O$: $(a,b)\\to(-b,a)$.`,
          `The point at $(${-b},${a})$ is point $${picked.letter}$.`,
        ],
        correct: picked.correct,
        wrong: picked.wrong,
      };
    }
    const m = pick(r, [2, 3]);
    const theta = pick(r, [90, 270]);
    // R_90 (a,b) = (-b,a); R_270 (a,b) = (b,-a)
    const rot = (x: number, y: number, t: number): Pt =>
      t === 90 ? [-y, x] : [y, -x];
    const turned = rot(a, b, theta);
    const other = rot(a, b, theta === 90 ? 270 : 90);
    const picked = letterChoices(r, [
      { at: [m * turned[0], m * turned[1]], correct: true, feedback: "" },
      {
        at: turned,
        feedback: `That point is rotated correctly but not scaled. The modulus ${m} also stretches the distance from $O$ by a factor of ${m}.`,
      },
      {
        at: [m * a, m * b],
        feedback: `That point is stretched by ${m} but not rotated. The argument ${theta}° also turns the point.`,
      },
      {
        at: [m * other[0], m * other[1]],
        feedback: `That point is stretched by ${m} but turned the wrong way. A positive argument turns counterclockwise.`,
      },
    ]);
    const g = planeWindow([m * a, m * b, m * turned[0], m * turned[1]])
      .id("plane")
      .point(a, b, "P")
      .segment([0, 0], [a, b]);
    picked.order.forEach((p, i) =>
      g.point(p.at[0], p.at[1], LETTERS[i]!, { color: "warm" }),
    );
    return {
      variant,
      prompt: `${PLANE_NOTE} $P$ represents $z$, and $w=${m}(\\cos ${theta}^\\circ+i\\sin ${theta}^\\circ)$. Which lettered point represents $zw$?`,
      figure: sceneFigure(
        g.scene({ title: "Point P and four candidates for zw" }),
      ),
      hint: `The number $w$ has distance ${m} from $O$ and direction ${theta}°. Multiplying by $w$ multiplies the distance of $P$ from $O$ by ${m} and adds ${theta}° to its direction.`,
      explanation: [
        `Multiplying by $w=r(\\cos\\theta+i\\sin\\theta)$ scales every distance from $O$ by $r=${m}$ and rotates counterclockwise by $\\theta=${theta}^\\circ$.`,
        `Rotating $(${a},${b})$ by ${theta}° gives $(${turned[0]},${turned[1]})$. Scaling by ${m} gives $(${m * turned[0]},${m * turned[1]})$.`,
        `That point is point $${picked.letter}$, so $zw=${cx(m * turned[0], m * turned[1])}$.`,
      ],
      correct: picked.correct,
      wrong: picked.wrong,
    };
  }
  if (variant === "rotation-angle") {
    const k = pick(r, [2, 3, 5, 6, 7, 9, 10, 11]);
    const turn = (90 * k) % 360;
    const lab = (deg: number) =>
      deg === 0 ? "No rotation ($0^\\circ$)" : M(`${deg}^\\circ`);
    return {
      variant,
      prompt: `Multiplying a complex number by $i$ rotates its point about the origin by a fixed angle. By what angle, counterclockwise, does multiplying by $i^{${k}}$ rotate a point? Give the smallest angle from $0^\\circ$ up to $360^\\circ$.`,
      hint: `Multiplying by $i$ is a quarter turn counterclockwise. Multiplying by $i^{${k}}$ repeats that quarter turn ${k} times. Subtract full turns of $360^\\circ$ from the total.`,
      explanation: [
        `Each factor of $i$ turns the point $90^\\circ$ counterclockwise, so $i^{${k}}$ turns it $${k}\\times90^\\circ=${90 * k}^\\circ$.`,
        `Remove full turns of $360^\\circ$: $${90 * k}^\\circ$ is the same as $${turn}^\\circ$.`,
        `Check: the powers of $i$ cycle $i,-1,-i,1$ and $i^{${k}}=i^{${k % 4}}$.`,
      ],
      correct: lab(turn),
      wrong: [0, 90, 180, 270]
        .filter((deg) => deg !== turn)
        .map((deg) => ({
          label: lab(deg),
          feedback: `That would be the rotation for $i^{${deg / 90}}$. Count ${k} quarter turns, then remove full turns of $360^\\circ$.`,
        })),
    };
  }
  // modulus-argument
  let r1: number, r2: number, al: number, be: number;
  do {
    r1 = r(1, 4);
    r2 = r(2, 4);
    al = pick(r, [15, 30, 45, 60, 75, 90, 120]);
    be = pick(r, [15, 30, 45, 60, 75, 90, 105]);
  } while (r1 + r2 === r1 * r2 || al === be);
  const lab = (mod: number, arg: number) =>
    M(`|zw|=${mod},\\ \\arg(zw)=${arg}^\\circ`);
  return {
    variant,
    prompt: `The complex number $z$ has modulus ${r1} and argument ${al}°, and $w$ has modulus ${r2} and argument ${be}°. The modulus is the distance from the origin and the argument is the counterclockwise angle from the positive real axis. What are the modulus and argument of $zw$?`,
    hint: `Multiplying complex numbers combines their distances from the origin by one operation and their angles by another. Think of $w$ as a stretch by ${r2} followed by a turn of ${be}°.`,
    explanation: [
      `Multiplication by $w$ stretches by the modulus of $w$ and rotates by its argument, so moduli multiply and arguments add.`,
      `Modulus: $${r1}\\times${r2}=${r1 * r2}$. Argument: $${al}^\\circ+${be}^\\circ=${al + be}^\\circ$.`,
      `So $|zw|=${r1 * r2}$ and $\\arg(zw)=${al + be}^\\circ$.`,
    ],
    correct: lab(r1 * r2, al + be),
    wrong: [
      {
        label: lab(r1 + r2, al + be),
        feedback:
          "Moduli multiply: the stretch factors compound. Only the angles add.",
      },
      {
        label: lab(r1 * r2, Math.abs(al - be)),
        feedback:
          "Arguments add when numbers are multiplied. Subtracting is for division.",
      },
      {
        label: lab(r1 * r2, (al * be) % 360),
        feedback: "Angles add under multiplication; they are not multiplied.",
      },
      {
        label: lab(r1 + r2, Math.abs(al - be)),
        feedback:
          "Moduli multiply and arguments add. Here both were combined the opposite way.",
      },
      {
        label: lab(r1 * r2, al),
        feedback: `Multiplying by $w$ also turns the point by the argument of $w$, ${be}°. The argument of the product includes both angles.`,
      },
      {
        label: lab(r1 * r2, be),
        feedback: `The argument of the product includes the argument of $z$, ${al}°, as well as the argument of $w$.`,
      },
    ],
  };
}

// ------------------------------------------------- conditional-everyday-reasoning
type Situation = {
  /** Event descriptions: "a student is in the band". */
  a: string;
  b: string;
  /** Plural groups for "of all ...": "students". */
  group: string;
  /** "Among students who are in the band, p% ..." fragments. */
  aWho: string;
  bWho: string;
  /** Relative pronoun for the group: "who" or "that". */
  rel: string;
};
const situations: readonly Situation[] = [
  {
    a: "a student plays in the band",
    b: "a student takes the bus",
    group: "students",
    rel: "who",
    aWho: "play in the band",
    bWho: "take the bus",
  },
  {
    a: "a day is rainy",
    b: "a day has a frost warning",
    group: "days",
    rel: "that",
    aWho: "are rainy",
    bWho: "have a frost warning",
  },
  {
    a: "a customer buys a drink",
    b: "a customer buys a sandwich",
    group: "customers",
    rel: "who",
    aWho: "buy a drink",
    bWho: "buy a sandwich",
  },
  {
    a: "a patient tests positive",
    b: "a patient has the flu",
    group: "patients",
    rel: "who",
    aWho: "test positive",
    bWho: "have the flu",
  },
  {
    a: "a commuter arrives late",
    b: "a commuter takes the train",
    group: "commuters",
    rel: "who",
    aWho: "arrive late",
    bWho: "take the train",
  },
];
const dec = (percent: number) => (percent / 100).toString();
const pct = (n: number) => `${n}%`;

function conditionalEveryday(r: Random): Built {
  const variant = [
    "words-to-notation",
    "notation-to-words",
    "compare-directions",
    "independent-product",
    "dependent-product",
    "rates-independent",
    "rates-more",
    "rates-less",
  ][r(0, 7)]!;
  const s = pick(r, situations);
  const events = `Let $A$ be the event that ${s.a}, and $B$ the event that ${s.b}.`;
  if (variant === "words-to-notation" || variant === "notation-to-words") {
    const p = r(2, 18) * 5;
    const kind = pick(r, ["a-given-b", "b-given-a", "both", "a"] as const);
    const notation = {
      "a-given-b": `P(A\\mid B)`,
      "b-given-a": `P(B\\mid A)`,
      both: `P(A\\cap B)`,
      a: `P(A)`,
    };
    const sentence = {
      "a-given-b": `Among ${s.group} ${s.rel} ${s.bWho}, ${pct(p)} ${s.aWho}.`,
      "b-given-a": `Among ${s.group} ${s.rel} ${s.aWho}, ${pct(p)} ${s.bWho}.`,
      both: `Of all ${s.group}, ${pct(p)} both ${s.aWho} and ${s.bWho}.`,
      a: `Of all ${s.group}, ${pct(p)} ${s.aWho}.`,
    };
    const exprFeedback = {
      "a-given-b":
        "$P(A\\mid B)$ is the share with $A$ among those who have $B$. The statement describes a different quantity.",
      "b-given-a":
        "$P(B\\mid A)$ is the share with $B$ among those who have $A$. The statement describes a different quantity.",
      both: "$P(A\\cap B)$ is the share of everyone who has both $A$ and $B$. The statement describes a different quantity.",
      a: "$P(A)$ is the share of everyone who has $A$. The statement describes a different quantity.",
    };
    const wordFeedback = {
      "a-given-b":
        "That sentence is about the share with $A$ among those who have $B$, which is $P(A\\mid B)$, not the given probability.",
      "b-given-a":
        "That sentence is about the share with $B$ among those who have $A$, which is $P(B\\mid A)$, not the given probability.",
      both: "That sentence is about the share of everyone who has both, which is $P(A\\cap B)$, not the given probability.",
      a: "That sentence is about the share of everyone who has $A$, which is $P(A)$, not the given probability.",
    };
    const kinds = ["a-given-b", "b-given-a", "both", "a"] as const;
    if (variant === "words-to-notation") {
      const label = (k: (typeof kinds)[number]) =>
        M(`${notation[k]}=${dec(p)}`);
      return {
        variant,
        prompt: `${events} Which expression states: "${sentence[kind]}"`,
        hint: `Decide which group the percentage is taken of: everyone, only those ${s.rel} ${s.aWho}, or only those ${s.rel} ${s.bWho}. The event that defines the group goes after the vertical bar in $P(\\cdot\\mid\\cdot)$.`,
        explanation: [
          `The statement gives ${pct(p)} as a proportion of ${kind === "a-given-b" ? `those ${s.rel} ${s.bWho}` : kind === "b-given-a" ? `those ${s.rel} ${s.aWho}` : "all " + s.group}.`,
          kind === "a-given-b" || kind === "b-given-a"
            ? `A probability within a group is conditional: the group is the condition and goes after the bar.`
            : kind === "both"
              ? "A share of everyone who has both is the probability of the intersection."
              : "A share of everyone with one feature is the plain probability of that event.",
          `So the statement is ${label(kind)}.`,
        ],
        correct: label(kind),
        wrong: kinds
          .filter((k) => k !== kind)
          .map((k) => ({ label: label(k), feedback: exprFeedback[k] })),
      };
    }
    const wordsOf = (k: (typeof kinds)[number]) => sentence[k];
    return {
      variant,
      prompt: `${events} If $${notation[kind]}=${dec(p)}$, which statement is true?`,
      hint: `In $P(X\\mid Y)$ the event after the bar, $Y$, names the group you restrict to. Read the given probability as "among ... , the share that ...".`,
      explanation: [
        `The probability $${notation[kind]}$ is read ${kind === "a-given-b" ? "within the group where $B$ happens" : kind === "b-given-a" ? "within the group where $A$ happens" : kind === "both" ? "over everyone, for both events together" : "over everyone, for event $A$"}.`,
        `With the value ${dec(p)}, the share is ${pct(p)}.`,
        `The matching statement is: "${wordsOf(kind)}"`,
      ],
      correct: wordsOf(kind),
      wrong: kinds
        .filter((k) => k !== kind)
        .map((k) => ({ label: wordsOf(k), feedback: wordFeedback[k] })),
    };
  }
  if (variant === "compare-directions") {
    let total: number, nA: number, nB: number, both: number;
    do {
      total = pick(r, [100, 200, 400]);
      nA = r(2, 9) * (total / 10);
      nB = r(2, 9) * (total / 10);
      both = r(1, 5) * (total / 20);
    } while (nA === nB || both >= Math.min(nA, nB));
    const aGivenB = frac(both, nB);
    const bGivenA = frac(both, nA);
    const joint = frac(both, total);
    const label = (x: string, y: string) =>
      M(`P(A\\mid B)=${x},\\ P(B\\mid A)=${y}`);
    return {
      variant,
      prompt: `${events} Of ${total} ${s.group}, ${nA} ${s.aWho}, ${nB} ${s.bWho}, and ${both} do both. Which pair of probabilities is correct?`,
      hint: `$P(A\\mid B)$ looks only at the ${nB} ${s.group} ${s.rel} ${s.bWho}; $P(B\\mid A)$ looks only at the ${nA} ${s.rel} ${s.aWho}. Use ${both} as the count in both, over the right group size.`,
      explanation: [
        `For $P(A\\mid B)$ restrict to the ${nB} ${s.group} for whom $B$ happened: ${both} of them have $A$, so $${aGivenB}$.`,
        `For $P(B\\mid A)$ restrict to the ${nA} for whom $A$ happened: ${both} of them have $B$, so $${bGivenA}$.`,
        `The two differ because the groups differ: ${nB} is not ${nA}.`,
      ],
      correct: label(aGivenB, bGivenA),
      wrong: [
        {
          label: label(bGivenA, aGivenB),
          feedback:
            "These are swapped. $P(A\\mid B)$ divides by the size of the group where $B$ happened.",
        },
        {
          label: label(joint, joint),
          feedback: `That divides by all ${total}. A conditional probability divides by the size of the condition group.`,
        },
        {
          label: label(frac(nA, total), frac(nB, total)),
          feedback:
            "Those are the overall probabilities $P(A)$ and $P(B)$. A conditional probability restricts to the condition group first.",
        },
        {
          label: label(frac(both, nA + nB), frac(both, nA + nB)),
          feedback:
            "The two events overlap, and a conditional probability divides by one group's size, not by a sum of both.",
        },
      ],
    };
  }
  if (variant === "independent-product" || variant === "dependent-product") {
    const dependent = variant === "dependent-product";
    let pa: number, pb: number;
    do {
      pa = r(2, 9) * 10;
      pb = r(2, 9) * 10;
    } while (pa * pb === 0);
    const product = (pa * pb) / 100;
    let joint = product;
    if (dependent) {
      const ok = [-10, -5, 5, 10]
        .map((delta) => product + delta)
        .filter((v) => v > 0 && v <= Math.min(pa, pb) && v >= pa + pb - 100);
      joint = pick(r, ok);
    }
    const d = dec;
    const stated = `$P(A)=${d(pa)}$, $P(B)=${d(pb)}$ and $P(A\\cap B)=${d(joint)}$`;
    const prodText = `${d(pa)}\\times${d(pb)}=${d(product)}`;
    return {
      variant,
      prompt: `${events} Suppose ${stated}. Are $A$ and $B$ independent?`,
      hint: `Independent events satisfy $P(A\\cap B)=P(A)\\,P(B)$. Multiply $P(A)=${d(pa)}$ by $P(B)=${d(pb)}$ and compare with the given $P(A\\cap B)$.`,
      explanation: [
        `Independence means $P(A\\cap B)=P(A)P(B)$, which is the same as $P(A\\mid B)=P(A)$.`,
        `$P(A)P(B)=${prodText}$.`,
        dependent
          ? `The given $P(A\\cap B)=${d(joint)}$ is not ${d(product)}, so $A$ and $B$ are not independent.`
          : `The given $P(A\\cap B)=${d(joint)}$ equals ${d(product)}, so $A$ and $B$ are independent.`,
      ],
      correct: dependent
        ? `Not independent, because $P(A)P(B)=${d(product)}$ but $P(A\\cap B)=${d(joint)}$`
        : `Independent, because $P(A)P(B)=${d(product)}=P(A\\cap B)$`,
      wrong: dependent
        ? [
            {
              label: `Independent, because $P(A\\cap B)=${d(joint)}$ is positive`,
              feedback:
                "A positive overlap does not make events independent. Compare $P(A\\cap B)$ with the product $P(A)P(B)$.",
            },
            {
              label: `Independent, because $P(A\\cap B)<P(A)$ and $P(A\\cap B)<P(B)$`,
              feedback:
                "The intersection is always smaller than each event. That does not test independence.",
            },
            {
              label: `Independent, because $P(A\\cap B)<P(A)+P(B)$`,
              feedback:
                "The overlap is always less than the sum. Independence needs $P(A\\cap B)$ to equal the product $P(A)P(B)$.",
            },
          ]
        : [
            {
              label: `Not independent, because $P(A)+P(B)\\neq P(A\\cap B)$`,
              feedback:
                "Independence compares the intersection with the product, not the sum.",
            },
            {
              label: `Not independent, because the events can happen together`,
              feedback:
                "Independent events can occur together. Mutually exclusive events with positive probabilities are the ones that are not independent.",
            },
            {
              label: `Not independent, because $P(A\\cap B)$ is less than both $P(A)$ and $P(B)$`,
              feedback:
                "The intersection is always at most each probability. Independence is about the product.",
            },
          ],
    };
  }
  // rates-independent / rates-more / rates-less
  const p = r(3, 14) * 5;
  const delta = pick(r, [10, 15, 20]);
  const q =
    variant === "rates-independent"
      ? p
      : variant === "rates-more"
        ? Math.min(p + delta, 95)
        : Math.max(p - delta, 5);
  const fixed = [
    "Independent, because knowing $B$ does not change the chance of $A$",
    "Not independent, because $B$ makes $A$ more likely",
    "Not independent, because $B$ makes $A$ less likely",
    "Cannot be decided without also knowing $P(B)$",
  ];
  const right = q === p ? 0 : q > p ? 1 : 2;
  const fb = [
    "The rates differ, so knowing $B$ does change the chance of $A$.",
    `The rate among those with $B$, ${pct(q)}, is not higher than the overall rate, ${pct(p)}.`,
    `The rate among those with $B$, ${pct(q)}, is not lower than the overall rate, ${pct(p)}.`,
    "Independence only asks whether $P(A\\mid B)$ equals $P(A)$. Both rates are given, so that can be decided.",
  ];
  return {
    variant,
    prompt: `Overall, ${pct(p)} of ${s.group} ${s.aWho}. Among ${s.group} ${s.rel} ${s.bWho}, ${pct(q)} ${s.aWho}. Are the events "${s.a}" and "${s.b}" independent, and if not, how does the second change the chance of the first?`,
    hint: `Compare the overall rate ${pct(p)} with the rate ${pct(q)} among those ${s.rel} ${s.bWho}. Independence means these are equal; if they differ, the direction of the difference tells how the condition shifts the chance.`,
    explanation: [
      `Independence means $P(A\\mid B)=P(A)$. Here $P(A)=${dec(p)}$ and $P(A\\mid B)=${dec(q)}$.`,
      q === p
        ? "They are equal, so the events are independent."
        : q > p
          ? `$P(A\\mid B)$ is larger than $P(A)$, so the events are not independent and $B$ makes $A$ more likely.`
          : `$P(A\\mid B)$ is smaller than $P(A)$, so the events are not independent and $B$ makes $A$ less likely.`,
    ],
    correct: fixed[right]!,
    wrong: fixed
      .map((label, i) => ({ label, feedback: fb[i]! }))
      .filter((_, i) => i !== right),
  };
}

// -------------------------------------------- rigid motions and similarity on a grid
type Op = { text: string; apply: (p: Pt) => Pt };
const reflectX: Op = {
  text: "reflect over the $x$-axis",
  apply: ([x, y]) => [x, -y],
};
const reflectY: Op = {
  text: "reflect over the $y$-axis",
  apply: ([x, y]) => [-x, y],
};
const turn90: Op = {
  text: "rotate $90^\\circ$ counterclockwise about the origin",
  apply: ([x, y]) => [-y, x],
};
const turn180: Op = {
  text: "rotate $180^\\circ$ about the origin",
  apply: ([x, y]) => [-x, -y],
};
const turn270: Op = {
  text: "rotate $270^\\circ$ counterclockwise about the origin",
  apply: ([x, y]) => [y, -x],
};
const rigidOps: readonly Op[] = [reflectX, reflectY, turn90, turn180, turn270];
const shiftText = (n: number, v: string) =>
  n === 0 ? v : `${v}${n < 0 ? "-" : "+"}${Math.abs(n)}`;
const translate = (dx: number, dy: number): Op => ({
  text: `translate $(x,y)\\to(${shiftText(dx, "x")},${shiftText(dy, "y")})$`,
  apply: ([x, y]) => [x + dx, y + dy],
});
const dilate = (num: number, den = 1): Op => ({
  text: `dilate by a factor of $${frac(num, den)}$ about the origin`,
  apply: ([x, y]) => [(x * num) / den, (y * num) / den],
});
const run = (ops: Op[], p: Pt): Pt => ops.reduce((q, op) => op.apply(q), p);
const lc = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const sequenceText = (ops: Op[]) => {
  const text = ops.map((op) => op.text).join(", then ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const maps = (ops: Op[], from: Pt[], to: Pt[]) =>
  from.every((p, i) => {
    const image = run(ops, p);
    return (
      Math.abs(image[0] - to[i]![0]) < 1e-9 &&
      Math.abs(image[1] - to[i]![1]) < 1e-9
    );
  });
const dist2 = (p: Pt, q: Pt) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
const sides2 = (t: Pt[]) => [
  dist2(t[0]!, t[1]!),
  dist2(t[1]!, t[2]!),
  dist2(t[2]!, t[0]!),
];
const cross = (t: Pt[]) =>
  (t[1]![0] - t[0]![0]) * (t[2]![1] - t[0]![1]) -
  (t[1]![1] - t[0]![1]) * (t[2]![0] - t[0]![0]);
/** A scalene, nondegenerate triangle with small whole-number vertices. */
function scalene(r: Random, span: number, step = 1): Pt[] {
  for (;;) {
    const t: Pt[] = [0, 1, 2].map(
      () => [r(-span, span) * step, r(-span, span) * step] as Pt,
    );
    const s = sides2(t);
    // Reject thin triangles: the altitude to the longest side stays readable.
    const thin = cross(t) ** 2 < 2 * step * step * Math.max(...s);
    if (
      !thin &&
      cross(t) !== 0 &&
      new Set(s).size === 3 &&
      new Set(t.map(key)).size === 3
    )
      return t;
  }
}
const NAMES_1 = ["A", "B", "C"] as const;
const NAMES_2 = ["D", "E", "F"] as const;
/** Two labelled triangles on a coordinate grid. */
export function trianglePair(
  from: Pt[],
  to: Pt[],
  title: string,
): SemanticFigure {
  const all = [...from, ...to].flat();
  const L = Math.max(...all.map(Math.abs)) + 1;
  const g = graph({ x: [-L, L], y: [-L, L], tick: L > 9 ? 2 : 1 }).id("grid");
  const draw = (
    t: Pt[],
    names: readonly string[],
    color: "accent" | "warm",
  ) => {
    for (let i = 0; i < 3; i++) g.segment(t[i]!, t[(i + 1) % 3]!, { color });
    t.forEach((p, i) => g.point(p[0], p[1], names[i]!, { color }));
  };
  draw(from, NAMES_1, "accent");
  draw(to, NAMES_2, "warm");
  return sceneFigure(g.scene({ title }));
}
/** Choose wrong sequences that really fail to map `from` onto `to`. */
function failingSequences(
  pool: Op[][],
  correct: Op[],
  from: Pt[],
  to: Pt[],
  feedback: (ops: Op[]) => string,
): Wrong[] {
  const seen = new Set([sequenceText(correct)]);
  const out: Wrong[] = [];
  for (const ops of pool) {
    const label = sequenceText(ops);
    if (seen.has(label) || maps(ops, from, to)) continue;
    seen.add(label);
    out.push({ label, feedback: feedback(ops) });
  }
  return out;
}
const ptText = (p: Pt) => `(${p[0]},${p[1]})`;
/** A translation that is not the zero vector. */
function shift(r: Random, max: number): Op {
  let dx: number, dy: number;
  do {
    dx = r(-max, max);
    dy = r(-max, max);
  } while (dx === 0 && dy === 0);
  return translate(dx, dy);
}
const vector = (op: Op) => run([op], [0, 0]);
const negate = (op: Op) => {
  const v = vector(op);
  return translate(-v[0], -v[1]);
};
const swapped = (op: Op) => {
  const v = vector(op);
  return translate(v[1], v[0]);
};

// ---------------------------------------------------- congruence-by-rigid-motion
type Form = "translation" | "motion" | "two-step";
function sequenceFor(r: Random, form: Form): Op[] {
  const motion = pick(r, rigidOps);
  const move = shift(r, 5);
  return form === "translation"
    ? [move]
    : form === "motion"
      ? [motion]
      : [motion, move];
}
/** Wrong sequences built from the true motion and translation. */
function sequencePool(r: Random, ops: Op[]): Op[][] {
  const motion = ops.length === 2 || !isTranslation(ops[0]!) ? ops[0]! : null;
  const move =
    ops.length === 2 ? ops[1]! : isTranslation(ops[0]!) ? ops[0]! : null;
  const pool: Op[][] = [];
  for (const m of rigidOps) {
    pool.push([m]);
    if (move) pool.push([m, move], [move, m]);
  }
  if (move) {
    pool.push([negate(move)], [swapped(move)]);
    if (motion) pool.push([motion, negate(move)], [motion, swapped(move)]);
  } else {
    const other = shift(r, 5);
    pool.push([other], [motion!, other]);
  }
  return shuffle(r, pool);
}
const isTranslation = (op: Op) => {
  const o = op.apply([0, 0]);
  const p = op.apply([1, 2]);
  return p[0] - o[0] === 1 && p[1] - o[1] === 2;
};

function congruenceRigidMotion(r: Random): Built {
  const variant = [
    "congruent-translation",
    "congruent-motion",
    "congruent-two-step",
    "predict-image",
    "decide-congruent",
    "decide-scaled",
    "corresponding-parts",
  ][r(0, 6)]!;
  if (variant === "corresponding-parts") {
    const sideIdx = r(0, 2);
    const vertexIdx = r(0, 2);
    const sideName = ["AB", "BC", "CA"];
    const sideImage = ["DE", "EF", "FD"];
    const length = r(5, 15);
    const angle = r(30, 80);
    const wrongSide = [0, 1, 2].filter((i) => i !== sideIdx);
    const wrongVertex = [0, 1, 2].filter((i) => i !== vertexIdx);
    const label = (si: number, vi: number) =>
      `$${sideImage[si]}=${length}$ cm and $\\angle ${NAMES_2[vi]}=${angle}^\\circ$`;
    return {
      variant,
      prompt: `A sequence of rigid motions maps triangle $ABC$ onto triangle $DEF$, with $A\\to D$, $B\\to E$ and $C\\to F$. In triangle $ABC$, $${sideName[sideIdx]}=${length}$ cm and $\\angle ${NAMES_1[vertexIdx]}=${angle}^\\circ$. Which statement must be true?`,
      hint: `A rigid motion carries each vertex to its image and keeps every length and angle. Use the arrows $A\\to D$, $B\\to E$, $C\\to F$ to find the images of the two endpoints of $${sideName[sideIdx]}$ and of vertex ${NAMES_1[vertexIdx]}.`,
      explanation: [
        `Rigid motions preserve length and angle measure, so corresponding parts are equal.`,
        `Side $${sideName[sideIdx]}$ goes to side $${sideImage[sideIdx]}$, and angle ${NAMES_1[vertexIdx]} goes to angle ${NAMES_2[vertexIdx]}.`,
        `So $${sideImage[sideIdx]}=${length}$ cm and $\\angle ${NAMES_2[vertexIdx]}=${angle}^\\circ$.`,
      ],
      correct: label(sideIdx, vertexIdx),
      wrong: [
        {
          label: label(wrongSide[0]!, vertexIdx),
          feedback: `Side $${sideName[sideIdx]}$ goes to the side joining the images of its endpoints, which is $${sideImage[sideIdx]}$, not $${sideImage[wrongSide[0]!]}$.`,
        },
        {
          label: label(sideIdx, wrongVertex[0]!),
          feedback: `Angle ${NAMES_1[vertexIdx]} goes to the angle at the image of ${NAMES_1[vertexIdx]}, which is angle ${NAMES_2[vertexIdx]}, not angle ${NAMES_2[wrongVertex[0]!]}.`,
        },
        {
          label: label(wrongSide[1]!, wrongVertex[1]!),
          feedback:
            "Match parts by the arrows between vertices, not by their order in the alphabet.",
        },
      ],
    };
  }
  if (variant === "decide-scaled") {
    const base = scalene(r, 2);
    const k = pick(r, [2, 3]);
    const scaled = base.map((p) => [p[0] * k, p[1] * k] as Pt);
    let move: Op;
    let image: Pt[];
    do {
      move = shift(r, 4);
      image = scaled.map((p) => run([move], p));
    } while (
      Math.max(...image.flat().map(Math.abs)) > 9 ||
      new Set([...base, ...image].map(key)).size < 6
    );
    const dx = base[1]![0] - base[0]![0];
    const dy = base[1]![1] - base[0]![1];
    return {
      variant,
      prompt: `Triangles $ABC$ and $DEF$ are shown, with $A\\to D$, $B\\to E$, $C\\to F$. Is there a sequence of rigid motions that maps $ABC$ onto $DEF$?`,
      figure: trianglePair(base, image, "Triangles ABC and DEF on a grid"),
      hint: `Count the horizontal and vertical steps from $A$ to $B$, then from $D$ to $E$. A rigid motion cannot change a length.`,
      explanation: [
        `From $A$ to $B$ the steps are $(${dx},${dy})$; from $D$ to $E$ they are $(${k * dx},${k * dy})$. So $DE$ is ${k} times as long as $AB$, and the other sides scale the same way.`,
        `Rigid motions preserve length, so no sequence of them can enlarge a triangle.`,
        `The triangles have the same shape but different sizes, so they are not congruent.`,
      ],
      correct: `No: every side of $DEF$ is ${k} times as long as the matching side of $ABC$, and rigid motions preserve length`,
      wrong: [
        {
          label: `Yes: ${lc(sequenceText([move]))}`,
          feedback:
            "A translation keeps the size of the triangle. $DEF$ is larger, so translating $ABC$ cannot reach it.",
        },
        {
          label: `Yes: the angles of the two triangles are equal, so a rigid motion exists`,
          feedback:
            "Equal angles give the same shape, not the same size. Rigid motions also need equal side lengths.",
        },
        {
          label: `No: $DEF$ is in a different position from $ABC$, and rigid motions cannot change position`,
          feedback:
            "Translations and rotations change position. Congruence depends on size and shape, not location.",
        },
      ],
    };
  }
  const form: Form =
    variant === "congruent-translation"
      ? "translation"
      : variant === "congruent-motion"
        ? "motion"
        : variant === "decide-congruent"
          ? pick(r, ["translation", "motion", "two-step"] as const)
          : "two-step";
  let from: Pt[];
  let ops: Op[];
  let to: Pt[];
  for (;;) {
    from = scalene(r, 4);
    ops = sequenceFor(r, form);
    to = from.map((p) => run(ops, p));
    if (
      Math.max(...[...from, ...to].flat().map(Math.abs)) <= 9 &&
      new Set([...from, ...to].map(key)).size === 6
    )
      break;
  }
  const pool = sequencePool(r, ops);
  const orientation =
    cross(from) > 0 === cross(to) > 0
      ? "both triangles run the same way around"
      : "the order A, B, C runs the opposite way around from D, E, F";
  if (variant === "predict-image") {
    const which = r(0, 2);
    const original = from[which]!;
    const [motion, move] = ops as [Op, Op];
    const L = Math.max(...from.flat().map(Math.abs)) + 2;
    const drawn = graph({ x: [-L, L], y: [-L, L], tick: 1 }).id("grid");
    for (let i = 0; i < 3; i++)
      drawn.segment(from[i]!, from[(i + 1) % 3]!, { color: "accent" });
    from.forEach((p, i) =>
      drawn.point(p[0], p[1], NAMES_1[i]!, { color: "accent" }),
    );
    const label = (p: Pt) => M(ptText(p));
    const next = rigidOps[(rigidOps.indexOf(motion) + 1) % rigidOps.length]!;
    const wrongImages: [Pt, string][] = [
      [
        run([move], original),
        "That applies only the translation. Do the reflection or rotation first as well.",
      ],
      [
        run([motion], original),
        "That applies only the reflection or rotation. The translation moves the point afterward.",
      ],
      [
        run([move, motion], original),
        "The motions happen in the stated order. Reversing the order gives a different point.",
      ],
      [
        run([next, move], original),
        "That uses a different reflection or rotation from the one stated.",
      ],
      [
        run([motion, negate(move)], original),
        "The translation goes in the stated direction, not the opposite one.",
      ],
      [
        run([motion, swapped(move)], original),
        "The translation moves $x$ and $y$ by the amounts stated, in that order.",
      ],
      [
        run(
          [rigidOps[(rigidOps.indexOf(motion) + 2) % rigidOps.length]!, move],
          original,
        ),
        "That uses a different reflection or rotation from the one stated.",
      ],
      [
        run([negate(move), motion], original),
        "Do the reflection or rotation first, then translate. The order matters.",
      ],
    ];
    const correct = label(to[which]!);
    // Symmetric starting points can make several wrong images coincide; draw again.
    if (
      new Set(wrongImages.map(([p]) => label(p)).filter((l) => l !== correct))
        .size < 3
    )
      return congruenceRigidMotion(r);
    return {
      variant,
      prompt: `Triangle $ABC$ is shown. A sequence of rigid motions maps it onto triangle $DEF$ with $A\\to D$, $B\\to E$, $C\\to F$: ${lc(sequenceText(ops))}. What are the coordinates of ${NAMES_2[which]}?`,
      figure: sceneFigure(
        drawn.scene({ title: "Triangle ABC on a coordinate grid" }),
      ),
      hint: `Apply the first motion alone to $${NAMES_1[which]}${ptText(original)}$ and write the new coordinates. Then apply the second motion to that point. A reflection or rotation about the origin only changes signs or swaps the coordinates.`,
      explanation: [
        `Start from $${NAMES_1[which]}${ptText(original)}$.`,
        `After the first motion: $${ptText(run([motion], original))}$.`,
        `After the second motion: $${ptText(to[which]!)}$. So ${NAMES_2[which]} is at $${ptText(to[which]!)}$, and since rigid motions preserve length and angle, $DEF\\cong ABC$.`,
      ],
      correct,
      wrong: wrongImages.map(([p, feedback]) => ({
        label: label(p),
        feedback,
      })),
    };
  }
  const fig = trianglePair(from, to, "Triangles ABC and DEF on a grid");
  const correct = sequenceText(ops);
  const wrongSeq = failingSequences(
    pool,
    ops,
    from,
    to,
    (candidate) =>
      `Apply this to $A$ at $${ptText(from[0]!)}$: it ends at $${ptText(run(candidate, from[0]!))}$, but $D$ is at $${ptText(to[0]!)}$.`,
  );
  if (variant === "decide-congruent") {
    const falseYes = wrongSeq[0];
    if (!falseYes) throw new Error("No failing sequence");
    return {
      variant,
      prompt: `Triangles $ABC$ and $DEF$ are shown, with $A\\to D$, $B\\to E$, $C\\to F$. Two figures are congruent exactly when some sequence of rigid motions maps one onto the other. Are $ABC$ and $DEF$ congruent, and why?`,
      figure: fig,
      hint: `Compare the grid steps along matching sides, then compare how the vertices run around each triangle: ${orientation}. A reflection reverses that direction and is still a rigid motion.`,
      explanation: [
        `Counting grid steps shows the matching sides have equal lengths and the angles match.`,
        `A sequence of rigid motions exists: ${lc(sequenceText(ops))}. It carries $A$, $B$, $C$ to $D$, $E$, $F$.`,
        `Because a sequence of rigid motions maps $ABC$ onto $DEF$, the triangles are congruent.`,
      ],
      correct: `Yes: ${lc(correct)}`,
      wrong: [
        { label: `Yes: ${lc(falseYes.label)}`, feedback: falseYes.feedback },
        {
          label: `No: $DEF$ is in a different position from $ABC$, and rigid motions cannot change position`,
          feedback:
            "Translations and rotations change position. Congruence depends on size and shape, not location.",
        },
        {
          label: `No: $DEF$ runs the opposite way around, so no rigid motion can map $ABC$ onto it`,
          feedback:
            "A reflection is a rigid motion that reverses direction, so a mirror image is still congruent.",
        },
      ],
    };
  }
  return {
    variant,
    prompt: `Triangle $ABC$ is congruent to triangle $DEF$, with $A\\to D$, $B\\to E$, $C\\to F$. Which sequence of rigid motions maps $ABC$ onto $DEF$?`,
    figure: fig,
    hint: `Follow vertex $A$ at $${ptText(from[0]!)}$ to $D$ at $${ptText(to[0]!)}$. Then check how $A$, $B$, $C$ run around the triangle compared with $D$, $E$, $F$: ${orientation}.`,
    explanation: [
      `Track $A$ at $${ptText(from[0]!)}$ to $D$ at $${ptText(to[0]!)}$ and $B$ at $${ptText(from[1]!)}$ to $E$ at $${ptText(to[1]!)}$.`,
      `${correct} sends each vertex to its image, including $C$ at $${ptText(from[2]!)}$ to $F$ at $${ptText(to[2]!)}$.`,
      `A sequence of rigid motions maps $ABC$ onto $DEF$, so the triangles are congruent.`,
    ],
    correct,
    wrong: wrongSeq,
  };
}

// -------------------------------------------------- similarity-by-transformation
/** "Follow A: first ... to reach (x,y), then ..." through every step. */
function trace(ops: Op[], start: Pt): string {
  return ops
    .map(
      (op, i) =>
        `${i === 0 ? "first " : "then "}${lc(op.text)} to reach $${ptText(run(ops.slice(0, i + 1), start))}$`,
    )
    .join(", ");
}

function similarityTransformation(r: Random): Built {
  const variant = [
    "dilate-translate",
    "dilate-motion",
    "decide-similar",
    "not-similar",
  ][r(0, 3)]!;
  if (variant === "not-similar") {
    // Right triangles with horizontal and vertical legs, stretched unequally.
    const p = r(1, 3);
    const q = r(1, 3);
    const ax = pick(r, [2, 3] as const);
    const ay = ax === 2 ? 3 : 2;
    const x0 = r(-3, -1);
    const y0 = r(-3, -1);
    const gx = r(1, 3);
    const gy = r(1, 3);
    const from: Pt[] = [
      [x0, y0],
      [x0 + p, y0],
      [x0, y0 + q],
    ];
    const to: Pt[] = [
      [gx, gy],
      [gx + ax * p, gy],
      [gx, gy + ay * q],
    ];
    const wrongSeq = (k: number) =>
      `Yes: ${lc(sequenceText([dilate(k), translate(gx - x0 * k, gy - y0 * k)]))}`;
    return {
      variant,
      prompt: `Triangles $ABC$ and $DEF$ are shown, with $A\\to D$, $B\\to E$, $C\\to F$. Two figures are similar exactly when some sequence of dilations and rigid motions maps one onto the other. Are $ABC$ and $DEF$ similar?`,
      figure: trianglePair(from, to, "Triangles ABC and DEF on a grid"),
      hint: `Compare the horizontal leg $AB$ with $DE$ and the vertical leg $AC$ with $DF$ by counting grid units. A dilation multiplies every length by the same factor.`,
      explanation: [
        `The horizontal leg grows from ${p} to ${ax * p}, a factor of ${ax}. The vertical leg grows from ${q} to ${ay * q}, a factor of ${ay}.`,
        `A dilation multiplies every length by one factor, and rigid motions keep lengths. These two legs scale by different factors, so no sequence of dilations and rigid motions maps $ABC$ onto $DEF$.`,
        `The triangles are not similar.`,
      ],
      correct: `No: the horizontal legs scale by ${ax} but the vertical legs scale by ${ay}, and a dilation scales all lengths by one factor`,
      wrong: [
        {
          label: wrongSeq(ax),
          feedback: `Dilating by ${ax} stretches both legs by ${ax}. The vertical leg of $DEF$ is ${ay} times that of $ABC$, so the image does not match.`,
        },
        {
          label: wrongSeq(ay),
          feedback: `Dilating by ${ay} stretches both legs by ${ay}. The horizontal leg of $DEF$ is ${ax} times that of $ABC$, so the image does not match.`,
        },
        {
          label: `Yes: both triangles are right triangles, so they are similar`,
          feedback:
            "Right triangles need not be similar. Their legs must be in the same ratio, which is what a dilation preserves.",
        },
      ],
    };
  }
  let from: Pt[];
  let k: [number, number];
  let ops: Op[];
  let to: Pt[];
  for (;;) {
    k = pick(r, [
      [2, 1],
      [3, 1],
      [1, 2],
    ] as const) as [number, number];
    from = scalene(r, k[1] === 2 ? 3 : 2, k[1] === 2 ? 2 : 1);
    const move = shift(r, 3);
    const motion =
      variant === "dilate-translate"
        ? null
        : pick(r, [reflectX, reflectY, turn180]);
    ops = [dilate(k[0], k[1]), ...(motion ? [motion] : []), move];
    to = from.map((p) => run(ops, p));
    if (
      Math.max(...[...from, ...to].flat().map(Math.abs)) <= 9 &&
      new Set([...from, ...to].map(key)).size === 6
    )
      break;
  }
  const dilation = ops[0]!;
  const middle = ops.slice(1, ops.length - 1);
  const moveOf = ops[ops.length - 1]!;
  const kText = frac(k[0], k[1]);
  const factors: [number, number][] = [
    [k[1], k[0]],
    [k[0] + 1, k[1]],
    [k[0] === 2 && k[1] === 1 ? 3 : 2, 1],
  ];
  const pool: Op[][] = [
    ...factors.map(([n, d]) => [dilate(n, d), ...middle, moveOf]),
    [moveOf, dilation, ...middle],
    [dilation, ...middle],
    [dilation, ...middle, negate(moveOf)],
    [dilation, ...middle, swapped(moveOf)],
    ...rigidOps.map((m) => [dilation, m, moveOf]),
    ...rigidOps.map((m) => [dilation, m]),
  ];
  const wrongSeq = failingSequences(
    shuffle(r, pool),
    ops,
    from,
    to,
    (candidate) =>
      `Apply this to $A$ at $${ptText(from[0]!)}$: it ends at $${ptText(run(candidate, from[0]!))}$, but $D$ is at $${ptText(to[0]!)}$.`,
  );
  if (wrongSeq.length < 3) throw new Error("Insufficient distinct sequences");
  const fig = trianglePair(from, to, "Triangles ABC and DEF on a grid");
  const correct = sequenceText(ops);
  if (variant === "decide-similar") {
    const falseYes = wrongSeq[0]!;
    return {
      variant,
      prompt: `Triangles $ABC$ and $DEF$ are shown, with $A\\to D$, $B\\to E$, $C\\to F$. Two figures are similar exactly when some sequence of dilations and rigid motions maps one onto the other. Are $ABC$ and $DEF$ similar, and why?`,
      figure: fig,
      hint: `Compare the grid steps along $AB$ and $DE$, then along $BC$ and $EF$. If every side of $DEF$ is the same multiple of the matching side of $ABC$, a dilation by that multiple, followed by rigid motions, can match them.`,
      explanation: [
        `Every side of $DEF$ is $${kText}$ times the matching side of $ABC$, and the angles are equal.`,
        `A sequence exists: ${lc(correct)}. Following $A$: ${trace(ops, from[0]!)}.`,
        `Because a dilation and rigid motions map $ABC$ onto $DEF$, the triangles are similar.`,
      ],
      correct: `Yes: ${lc(correct)}`,
      wrong: [
        { label: `Yes: ${lc(falseYes.label)}`, feedback: falseYes.feedback },
        {
          label: `No: the triangles have different sizes, and similar triangles must have equal sizes`,
          feedback:
            "Equal size is congruence. Similar triangles can differ in size because a dilation changes size.",
        },
        {
          label: `No: $DEF$ is in a different position, so no sequence of transformations maps $ABC$ onto it`,
          feedback:
            "Translations, reflections and rotations change position. Position does not decide similarity.",
        },
      ],
    };
  }
  return {
    variant,
    prompt: `Triangle $DEF$ is similar to triangle $ABC$, with $A\\to D$, $B\\to E$, $C\\to F$. Which sequence of a dilation and rigid motions maps $ABC$ onto $DEF$? Dilations are about the origin, and the steps happen in the order listed.`,
    figure: fig,
    hint: `Compare the length of $AB$ with $DE$ by counting grid steps to find the dilation factor. Then follow where the dilated copy of $A$ must be moved to reach $D$ at $${ptText(to[0]!)}$.`,
    explanation: [
      `Matching sides of $DEF$ are $${kText}$ times as long as those of $ABC$, so the dilation factor is $${kText}$.`,
      `Following $A$ at $${ptText(from[0]!)}$: ${trace(ops, from[0]!)}. That is $D$.`,
      `${correct}. The same steps send $B$ and $C$ to $E$ and $F$, so the triangles are similar.`,
    ],
    correct,
    wrong: wrongSeq,
  };
}

// --------------------------------------------------------------------- aa-similarity
const PERMS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
/** The triangle named by listing vertices of DEF in the given order. */
const defName = (order: readonly number[]) =>
  `\\triangle ${order.map((i) => NAMES_2[i]).join("")}`;
const abcName = "\\triangle ABC";

function aaSimilarity(r: Random): Built {
  const variant = [
    "aa-similar",
    "aa-not-similar",
    "aa-find-angle",
    "aa-proportion",
  ][r(0, 3)]!;
  if (variant === "aa-find-angle") {
    const x = r(30, 80);
    let y = r(30, 80);
    if (y === x) y += 5;
    const third = 180 - x - y;
    const order = pick(r, PERMS);
    const deg = (n: number) => M(`${n}^\\circ`);
    const target = NAMES_2[order[2]]!;
    return {
      variant,
      prompt: `Triangle $ABC$ has $\\angle A=${x}^\\circ$ and $\\angle B=${y}^\\circ$. In triangle $DEF$, $\\angle ${NAMES_2[order[0]]}=${x}^\\circ$ and $\\angle ${NAMES_2[order[1]]}=${y}^\\circ$. The triangles are similar by AA. What is $\\angle ${target}$?`,
      hint: `The angles of a triangle add to $180^\\circ$. Use the two angles given for $DEF$ to find the third angle of that triangle.`,
      explanation: [
        `In $DEF$ the two known angles are ${x}° and ${y}°, so the third is $180^\\circ-${x}^\\circ-${y}^\\circ=${third}^\\circ$.`,
        `The unknown angle is the remaining vertex, $${target}$, so $\\angle ${target}=${third}^\\circ$.`,
        `It equals $\\angle C$ in $ABC$, which is also $180^\\circ-${x}^\\circ-${y}^\\circ$.`,
      ],
      correct: deg(third),
      wrong: [
        {
          label: deg(x),
          feedback: `${x}° is already used for another angle of $DEF$. The third angle is what remains of $180^\\circ$.`,
        },
        {
          label: deg(180 - y),
          feedback:
            "That subtracts only one angle. The three angles add to 180°, so subtract both known angles.",
        },
        {
          label: deg(180 - x),
          feedback:
            "That subtracts only one angle. The three angles add to 180°, so subtract both known angles.",
        },
        {
          label: deg(360 - x - y),
          feedback: "The angles of a triangle add to 180°, not 360°.",
        },
      ],
    };
  }
  if (variant === "aa-proportion") {
    const order = pick(
      r,
      PERMS.filter((p) => p[0] !== 0 || p[1] !== 1),
    );
    const image = order.map((i) => NAMES_2[i]!);
    const ratio = (a: number, b: number) =>
      `\\frac{${NAMES_1[a]}${NAMES_1[b]}}{${image[a]}${image[b]}}`;
    return {
      variant,
      prompt: `Triangles satisfy $${abcName}\\sim ${defName(order)}$, which lists matching vertices in the same order. Which proportion of corresponding sides is true?`,
      hint: `In the similarity statement the first letters match, the second letters match, and the third letters match. Side $AB$ joins the first two vertices of $ABC$; find the side that joins their matches in the other triangle.`,
      explanation: [
        `The statement matches $A\\leftrightarrow ${image[0]}$, $B\\leftrightarrow ${image[1]}$ and $C\\leftrightarrow ${image[2]}$.`,
        `So side $AB$ matches $${image[0]}${image[1]}$ and side $BC$ matches $${image[1]}${image[2]}$.`,
        `Corresponding sides of similar triangles are proportional: $${ratio(0, 1)}=${ratio(1, 2)}$.`,
      ],
      correct: M(`${ratio(0, 1)}=${ratio(1, 2)}`),
      wrong: [
        {
          label: M(`\\frac{AB}{DE}=\\frac{BC}{EF}`),
          feedback: `That pairs sides by alphabet position. The statement pairs $AB$ with $${image[0]}${image[1]}$.`,
        },
        {
          label: M(`${ratio(0, 1)}=\\frac{BC}{${image[0]}${image[2]}}`),
          feedback: `The second ratio should pair $BC$ with the side joining the matches of $B$ and $C$, which is $${image[1]}${image[2]}$.`,
        },
        {
          label: M(
            `\\frac{AB}{${image[1]}${image[2]}}=\\frac{BC}{${image[0]}${image[1]}}`,
          ),
          feedback:
            "That pairs each side of $ABC$ with the wrong side of $DEF$. Follow the vertex matches to each side's endpoints.",
        },
        {
          label: M(
            `\\frac{AB}{BC}=\\frac{${image[1]}${image[2]}}{${image[0]}${image[1]}}`,
          ),
          feedback:
            "The ratio on the right should keep the same order as on the left: $AB$ first and its match first.",
        },
      ],
    };
  }
  // aa-similar / aa-not-similar: decide from two stated angles of each triangle.
  const x = r(35, 75);
  let y = r(35, 75);
  while (y === x || x + y >= 150 || 180 - x - y === x || 180 - x - y === y)
    y = r(35, 75);
  const z = 180 - x - y;
  const abc = [x, y, z];
  const similar = variant === "aa-similar";
  const order = pick(
    r,
    PERMS.filter((p) => p[0] !== 0 || p[1] !== 1),
  );
  // order[i] is the vertex of DEF whose angle equals angle i of ABC.
  const def: number[] = [0, 0, 0];
  let kept = 0;
  if (similar) {
    order.forEach((vertex, i) => (def[vertex] = abc[i]!));
  } else {
    kept = pick(r, abc);
    let b = r(30, 85);
    let c = 180 - kept - b;
    while (c < 20 || abc.includes(b) || abc.includes(c) || b === c) {
      b = r(30, 85);
      c = 180 - kept - b;
    }
    const placed = shuffle(r, [kept, b, c]);
    placed.forEach((v, i) => (def[i] = v));
  }
  const shownABC = pick(r, [
    [0, 1],
    [0, 2],
    [1, 2],
  ] as const);
  const shownDEF = pick(r, [
    [0, 1],
    [0, 2],
    [1, 2],
  ] as const);
  const angles = (
    t: number[],
    names: readonly string[],
    idx: readonly number[],
  ) => idx.map((i) => `$\\angle ${names[i]}=${t[i]}^\\circ$`).join(" and ");
  const prompt = `Triangle $ABC$ has ${angles(abc, NAMES_1, shownABC)}. Triangle $DEF$ has ${angles(def, NAMES_2, shownDEF)}. Are the triangles similar by AA?`;
  const thirdOf = (t: number[], idx: readonly number[]) =>
    180 - idx.reduce((s, i) => s + t[i]!, 0);
  const missABC = [0, 1, 2].find((i) => !shownABC.includes(i as never))!;
  const missDEF = [0, 1, 2].find((i) => !shownDEF.includes(i as never))!;
  const fb3 =
    "A triangle's angles add to 180°, so two angles determine the third. Both triangles' angles are known.";
  const hint = `Find the third angle of each triangle: the angles of a triangle add to $180^\\circ$. Then compare the three angles of $ABC$ with the three angles of $DEF$.`;
  const explainThirds = `The missing angle of $ABC$ is $\\angle ${NAMES_1[missABC]}=${thirdOf(abc, shownABC)}^\\circ$, and the missing angle of $DEF$ is $\\angle ${NAMES_2[missDEF]}=${thirdOf(def, shownDEF)}^\\circ$.`;
  if (similar) {
    const imageFor = (i: number) => def.indexOf(abc[i]!);
    const correctOrder = [imageFor(0), imageFor(1), imageFor(2)];
    const label = (o: readonly number[]) =>
      `Similar by AA: $${abcName}\\sim ${defName(o)}$`;
    const wrongOrders = PERMS.filter((p) => p.join() !== correctOrder.join());
    return {
      variant,
      prompt: `${prompt} If so, name the correspondence.`,
      hint,
      explanation: [
        explainThirds,
        `The angles of $ABC$ are ${x}°, ${y}°, ${z}° and the angles of $DEF$ are ${def[0]}°, ${def[1]}°, ${def[2]}°: the same three values, so two angles match and the triangles are similar by AA.`,
        `Match equal angles: $A\\leftrightarrow ${NAMES_2[correctOrder[0]!]}$, $B\\leftrightarrow ${NAMES_2[correctOrder[1]!]}$, $C\\leftrightarrow ${NAMES_2[correctOrder[2]!]}$, so $${abcName}\\sim ${defName(correctOrder)}$.`,
      ],
      correct: label(correctOrder),
      wrong: [
        ...wrongOrders.map((o) => ({
          label: label(o),
          feedback:
            o.join() === "0,1,2"
              ? "Name the correspondence by equal angles, not by the order of the letters. The equal angles are not at the same letters."
              : "The order of the letters must pair vertices with equal angles. Check each pair of equal angles.",
        })),
        {
          label: "Not similar: only two angles of each triangle are given",
          feedback: fb3,
        },
      ],
    };
  }
  const label = (text: string) => text;
  return {
    variant,
    prompt,
    hint,
    explanation: [
      explainThirds,
      `The angles of $ABC$ are ${x}°, ${y}°, ${z}° and the angles of $DEF$ are ${def[0]}°, ${def[1]}°, ${def[2]}°.`,
      `Only the ${kept}° angle appears in both. AA needs two pairs of equal angles, so the triangles are not similar.`,
    ],
    correct: label(
      `Not similar: only one pair of angles is equal (${kept}°), and AA needs two pairs`,
    ),
    wrong: [
      {
        label: `Similar by AA: both triangles have a ${kept}° angle`,
        feedback:
          "One pair of equal angles is not enough. AA needs two pairs of equal angles.",
      },
      {
        label: `Similar by AA: $${abcName}\\sim ${defName([0, 1, 2])}$`,
        feedback:
          "Check all three angles of each triangle. They are not the same three values, so the triangles are not similar.",
      },
      {
        label: "Not similar: only two angles of each triangle are given",
        feedback: fb3,
      },
    ],
  };
}

// ------------------------------------------------------------------------ conic-foci
/** Positive root of n in simplest radical form, in LaTeX. */
function sqrtTex(n: number): string {
  let k = 1;
  let m = n;
  for (let f = 2; f * f <= m; f++)
    while (m % (f * f) === 0) {
      m /= f * f;
      k *= f;
    }
  if (m === 1) return `${k}`;
  return k === 1 ? `\\sqrt{${m}}` : `${k}\\sqrt{${m}}`;
}
const fociAt = (c: string, vertical: boolean) =>
  M(vertical ? `(0,\\pm ${c})` : `(\\pm ${c},0)`);
const denom = (n: number) => `${n}`;
const conicEq = (
  first: number,
  second: number,
  sign: "+" | "-",
  vertical: boolean,
) =>
  vertical
    ? `\\frac{y^2}{${denom(first)}}${sign}\\frac{x^2}{${denom(second)}}=1`
    : `\\frac{x^2}{${denom(first)}}${sign}\\frac{y^2}{${denom(second)}}=1`;

function conicFoci(r: Random): Built {
  const variant = [
    "ellipse-foci-h",
    "ellipse-foci-v",
    "hyperbola-foci-h",
    "hyperbola-foci-v",
    "ellipse-equation",
    "hyperbola-equation",
    "distance-sum",
  ][r(0, 6)]!;
  if (variant === "ellipse-foci-h" || variant === "ellipse-foci-v") {
    const vertical = variant === "ellipse-foci-v";
    const triples = [
      [5, 4],
      [5, 3],
      [13, 12],
      [13, 5],
      [10, 8],
      [10, 6],
      [17, 15],
      [4, 3],
      [6, 4],
      [7, 5],
      [3, 2],
      [8, 6],
    ] as const;
    const [a, b] = pick(r, triples);
    const c2 = a * a - b * b;
    const c = sqrtTex(c2);
    const eq = conicEq(a * a, b * b, "+", vertical);
    // Larger denominator under the variable of the major axis.
    return {
      variant,
      prompt: `Find the foci of the ellipse $${eq}$.`,
      hint: `The larger denominator, ${a * a}, is $a^2$ and the smaller, ${b * b}, is $b^2$. For an ellipse the focal distance $c$ from the center satisfies a relation with $a^2$ and $b^2$; the foci lie on the longer axis.`,
      explanation: [
        `The larger denominator is under ${vertical ? "$y^2$" : "$x^2$"}, so the major axis is ${vertical ? "vertical" : "horizontal"}, with $a^2=${a * a}$ and $b^2=${b * b}$.`,
        `For an ellipse $c^2=a^2-b^2=${a * a}-${b * b}=${c2}$, so $c=${c}$.`,
        `The foci are on the major axis, a distance $c$ from the center: ${fociAt(c, vertical)}.`,
      ],
      correct: fociAt(c, vertical),
      wrong: [
        {
          label: fociAt(sqrtTex(a * a + b * b), vertical),
          feedback:
            "For an ellipse subtract: $c^2=a^2-b^2$. The sum is for a hyperbola.",
        },
        {
          label: fociAt(`${a - b}`, vertical),
          feedback:
            "The focal distance comes from $c^2=a^2-b^2$, not from subtracting $a-b$.",
        },
        {
          label: fociAt(`${a}`, !vertical),
          feedback:
            "That uses $a$ as the focal distance, which is the vertex, and puts the foci on the minor axis.",
        },
        {
          label: fociAt(c, !vertical),
          feedback:
            "The value of $c$ is right, but the foci lie on the major axis, the axis with the larger denominator.",
        },
      ],
    };
  }
  if (variant === "hyperbola-foci-h" || variant === "hyperbola-foci-v") {
    const vertical = variant === "hyperbola-foci-v";
    const pairs = [
      [3, 4],
      [5, 12],
      [8, 6],
      [2, 3],
      [4, 3],
      [6, 8],
      [5, 2],
      [3, 2],
      [12, 5],
      [7, 3],
    ] as const;
    const [a, b] = pick(r, pairs);
    const c2 = a * a + b * b;
    const c = sqrtTex(c2);
    const eq = conicEq(a * a, b * b, "-", vertical);
    return {
      variant,
      prompt: `Find the foci of the hyperbola $${eq}$.`,
      hint: `The denominator of the positive term, ${a * a}, is $a^2$, and the other denominator, ${b * b}, is $b^2$. Find the focal distance $c$ from a relation among $a^2$, $b^2$ and $c^2$; the foci lie on the axis of the positive term.`,
      explanation: [
        `The positive term has ${vertical ? "$y^2$" : "$x^2$"}, so the transverse axis is ${vertical ? "vertical" : "horizontal"}, with $a^2=${a * a}$ and $b^2=${b * b}$.`,
        `For a hyperbola $c^2=a^2+b^2=${a * a}+${b * b}=${c2}$, so $c=${c}$.`,
        `The foci are on the transverse axis, a distance $c$ from the center: ${fociAt(c, vertical)}.`,
      ],
      correct: fociAt(c, vertical),
      wrong: [
        {
          label: fociAt(
            a * a > b * b ? sqrtTex(a * a - b * b) : `${Math.abs(a - b)}`,
            vertical,
          ),
          feedback:
            "For a hyperbola add: $c^2=a^2+b^2$. The difference is for an ellipse.",
        },
        {
          label: fociAt(`${a + b}`, vertical),
          feedback:
            "The focal distance is the square root of $a^2+b^2$, not $a+b$.",
        },
        {
          label: fociAt(`${a}`, vertical),
          feedback:
            "That is the vertex distance $a$. The foci are farther out, at $c$ with $c^2=a^2+b^2$.",
        },
        {
          label: fociAt(c, !vertical),
          feedback:
            "The value of $c$ is right, but the foci lie on the transverse axis, the axis of the positive term.",
        },
      ],
    };
  }
  if (variant === "ellipse-equation") {
    const vertical = r(0, 1) === 1;
    const [c, a] = pick(r, [
      [3, 5],
      [4, 5],
      [3, 6],
      [5, 7],
      [4, 6],
      [6, 8],
      [2, 4],
      [5, 9],
      [3, 7],
      [2, 5],
    ] as const);
    const b2 = a * a - c * c;
    const fociText = vertical ? `$(0,\\pm${c})$` : `$(\\pm${c},0)$`;
    const eq = (first: number, second: number) =>
      M(conicEq(first, second, "+", vertical));
    return {
      variant,
      prompt: `An ellipse centered at the origin has foci ${fociText}. For every point on it, the sum of the distances to the two foci is ${2 * a}. Which equation describes the ellipse?`,
      hint: `The constant sum of the distances equals $2a$, the length of the major axis, so you can find $a$. Then use the relation among $a$, $b$ and $c$ for an ellipse to find $b^2$. The major axis lies along the line through the foci.`,
      explanation: [
        `The sum of distances is $2a=${2 * a}$, so $a=${a}$ and $a^2=${a * a}$. The foci give $c=${c}$.`,
        `For an ellipse $c^2=a^2-b^2$, so $b^2=a^2-c^2=${a * a}-${c * c}=${b2}$.`,
        `The major axis is ${vertical ? "vertical" : "horizontal"}, so $a^2=${a * a}$ goes under ${vertical ? "$y^2$" : "$x^2$"}: ${eq(a * a, b2)}.`,
      ],
      correct: eq(a * a, b2),
      wrong: [
        {
          label: eq(b2, a * a),
          feedback:
            "The larger denominator $a^2$ goes under the variable along the foci's axis.",
        },
        {
          label: eq(a * a, a * a + c * c),
          feedback:
            "For an ellipse $b^2=a^2-c^2$, so $b^2$ is smaller than $a^2$. Adding $c^2$ is for a hyperbola.",
        },
        {
          label: eq(4 * a * a, 4 * a * a - c * c),
          feedback: `The sum ${2 * a} is the whole major axis, so $a$ is half of it. Do not use the sum itself as $a$.`,
        },
        {
          label: eq(a * a, c * c),
          feedback:
            "The denominator under the minor-axis variable is $b^2=a^2-c^2$, not $c^2$.",
        },
      ],
    };
  }
  if (variant === "hyperbola-equation") {
    const vertical = r(0, 1) === 1;
    const [c, a] = pick(r, [
      [5, 3],
      [5, 4],
      [13, 5],
      [10, 6],
      [5, 2],
      [4, 2],
      [6, 3],
      [7, 4],
      [8, 5],
      [10, 8],
    ] as const);
    const b2 = c * c - a * a;
    const fociText = vertical ? `$(0,\\pm${c})$` : `$(\\pm${c},0)$`;
    const eq = (first: number, second: number, sign: "+" | "-" = "-") =>
      M(conicEq(first, second, sign, vertical));
    return {
      variant,
      prompt: `A hyperbola centered at the origin has foci ${fociText}. For every point on it, the difference of the distances to the two foci is ${2 * a} in absolute value. Which equation describes the hyperbola?`,
      hint: `The constant difference of the distances equals $2a$, so you can find $a$. Then use the relation among $a$, $b$ and $c$ for a hyperbola to find $b^2$. The positive term goes with the axis that contains the foci.`,
      explanation: [
        `The difference of distances is $2a=${2 * a}$, so $a=${a}$ and $a^2=${a * a}$. The foci give $c=${c}$.`,
        `For a hyperbola $c^2=a^2+b^2$, so $b^2=c^2-a^2=${c * c}-${a * a}=${b2}$.`,
        `The foci are on the ${vertical ? "vertical" : "horizontal"} axis, so the ${vertical ? "$y^2$" : "$x^2$"} term is positive and has $a^2=${a * a}$: ${eq(a * a, b2)}.`,
      ],
      correct: eq(a * a, b2),
      wrong: [
        {
          label: eq(a * a, b2, "+"),
          feedback:
            "A plus sign gives an ellipse. A hyperbola has a difference of the squared terms.",
        },
        {
          label: eq(b2, a * a),
          feedback:
            "The positive term belongs to the axis through the foci, and its denominator is $a^2$.",
        },
        {
          label: eq(a * a, c * c + a * a),
          feedback:
            "For a hyperbola $b^2=c^2-a^2$. Adding $c^2$ to $a^2$ reverses the relation $c^2=a^2+b^2$.",
        },
        {
          label: eq(a * a, c * c),
          feedback:
            "That puts $c^2$ where $b^2$ belongs. For a hyperbola $b^2=c^2-a^2$.",
        },
      ],
    };
  }
  // distance-sum
  const [c, b, a] = pick(r, [
    [3, 4, 5],
    [4, 3, 5],
    [5, 12, 13],
    [12, 5, 13],
    [6, 8, 10],
    [8, 6, 10],
    [8, 15, 17],
    [15, 8, 17],
  ] as const);
  const vertical = r(0, 1) === 1;
  const foci = vertical ? `$(0,\\pm${c})$` : `$(\\pm${c},0)$`;
  const through = vertical ? `$(${b},0)$` : `$(0,${b})$`;
  const num = (n: number) => M(`${n}`);
  return {
    variant,
    prompt: `An ellipse centered at the origin has foci ${foci} and passes through ${through}. What is the constant sum of the distances from a point on the ellipse to the two foci?`,
    hint: `The sum is the same for every point of the ellipse, so use the given point. Find its distance to each focus: they form two congruent right triangles with legs ${c} and ${b}.`,
    explanation: [
      `Point ${through} is ${b} from the center along the minor axis, and each focus is ${c} from the center along the major axis, so each distance is $\\sqrt{${c}^2+${b}^2}=${a}$.`,
      `The sum of the distances is $${a}+${a}=${2 * a}$, which is $2a$ with $a=${a}$.`,
      `The constant sum is ${2 * a}.`,
    ],
    correct: num(2 * a),
    wrong: [
      {
        label: num(a),
        feedback:
          "That is one distance, or $a$. The sum of the two distances is $2a$.",
      },
      {
        label: num(2 * b),
        feedback: "That is the minor axis length. Add the two focal distances.",
      },
      {
        label: num(2 * (b + c)),
        feedback:
          "Each distance to a focus is the hypotenuse $\\sqrt{b^2+c^2}$, not the sum $b+c$ of the legs.",
      },
      {
        label: num(2 * c),
        feedback:
          "That is the distance between the foci, not the sum of distances from a point on the ellipse.",
      },
    ],
  };
}

// ------------------------------------------------------------------ choose-the-plot
const sortedAsc = (values: readonly number[]) =>
  [...values].sort((a, b) => a - b);
/** Plain text, so long lists wrap between numbers. */
const listLabel = (values: readonly number[]) => values.join(", ");
const fmt = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
const median = (sorted: readonly number[]) => {
  const n = sorted.length;
  return n % 2
    ? sorted[(n - 1) / 2]!
    : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
};
/** Minimum, lower quartile, median, upper quartile, maximum: halves exclude the median of odd-sized data. */
function fiveNumber(
  sorted: readonly number[],
): [number, number, number, number, number] {
  const n = sorted.length;
  const half = Math.floor(n / 2);
  const lower = sorted.slice(0, half);
  const upper = sorted.slice(n % 2 ? half + 1 : half);
  return [
    sorted[0]!,
    median(lower),
    median(sorted),
    median(upper),
    sorted[n - 1]!,
  ];
}
const statNames = [
  "minimum",
  "lower quartile",
  "median",
  "upper quartile",
  "maximum",
] as const;

const dotSettings = [
  {
    what: "the number of goals a team scored in each game",
    unit: "goals",
    lo: 0,
    hi: 6,
  },
  {
    what: "the number of books each student read last month",
    unit: "books",
    lo: 0,
    hi: 7,
  },
  {
    what: "the number of hours each student slept last night",
    unit: "hours",
    lo: 5,
    hi: 10,
  },
  { what: "the number of pets each student has", unit: "pets", lo: 0, hi: 5 },
] as const;
const histogramSettings = [
  { what: "the minutes each student spent on homework", unit: "minutes" },
  {
    what: "the points scored by each player in a game",
    unit: "points",
  },
  { what: "the ages of the people at a family event", unit: "years" },
] as const;
const boxSettings = [
  {
    what: "the scores of students on a test",
    unit: "points",
    start: 40,
    end: 100,
    step: 5,
  },
  {
    what: "the minutes students take to get to school",
    unit: "minutes",
    start: 0,
    end: 60,
    step: 5,
  },
  {
    what: "the heights of players in a league, in inches",
    unit: "inches",
    start: 52,
    end: 76,
    step: 2,
  },
] as const;

function choosePlot(r: Random): Built {
  const variant = [
    "dot-plot-to-data",
    "histogram-to-data",
    "box-plot-to-data",
    "data-to-bar-heights",
    "data-to-five-numbers",
  ][r(0, 4)]!;
  if (variant === "dot-plot-to-data") {
    const s = pick(r, dotSettings);
    let values: number[];
    do {
      values = Array.from({ length: r(8, 12) }, () => r(s.lo, s.hi));
    } while (
      new Set(values).size < 4 ||
      Math.max(...stackHeights(values).values()) > MAX_STACK
    );
    const counts = (vs: number[]) => {
      const m = new Map<number, number>();
      for (const v of vs) m.set(v, (m.get(v) ?? 0) + 1);
      return m;
    };
    const right = counts(values);
    const mutations: Wrong[] = [];
    const seen = new Set([sortedAsc(values).join()]);
    for (let attempt = 0; attempt < 400 && mutations.length < 4; attempt++) {
      const copy = [...values];
      for (let t = r(1, 2); t > 0; t--) {
        const i = r(0, copy.length - 1);
        const v = copy[i]! + (r(0, 1) ? 1 : -1) * r(1, 2);
        if (v >= s.lo && v <= s.hi) copy[i] = v;
      }
      const label = sortedAsc(copy).join();
      if (seen.has(label)) continue;
      seen.add(label);
      const wrong = counts(copy);
      let diff: number | undefined;
      for (let v = s.lo; v <= s.hi && diff === undefined; v++)
        if ((wrong.get(v) ?? 0) !== (right.get(v) ?? 0)) diff = v;
      const have = wrong.get(diff!) ?? 0;
      const shown = right.get(diff!) ?? 0;
      mutations.push({
        label: listLabel(sortedAsc(copy)),
        feedback: `This list has ${have} value${have === 1 ? "" : "s"} equal to ${diff}, but the plot shows ${shown} dot${shown === 1 ? "" : "s"} above ${diff}.`,
      });
    }
    return {
      variant,
      prompt: `The dot plot shows ${s.what}. Each dot is one value. Which list of values produced the dot plot?`,
      figure: {
        kind: "line-plot",
        denominator: 1,
        start: Math.max(0, s.lo - 1),
        end: s.hi + 1,
        values,
        mark: "dot",
        unit: s.unit,
      },
      hint: `Count the dots above each value on the number line, from the left. Each correct list must have exactly that many copies of each value, and ${values.length} values in all.`,
      explanation: [
        `Read the number of dots above each value: ${[...right.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([v, c]) => `${c} at ${v}`)
          .join(", ")}.`,
        `That gives ${values.length} values in all: ${sortedAsc(values).join(", ")}.`,
        `The list that repeats each value as many times as its stack of dots is the correct one.`,
      ],
      correct: listLabel(sortedAsc(values)),
      wrong: mutations,
    };
  }
  if (variant === "histogram-to-data") {
    const s = pick(r, histogramSettings);
    const width = pick(r, [5, 10] as const);
    const bins = r(4, 6);
    const counts = Array.from({ length: bins }, () => r(1, 3));
    const binOf = (v: number) => Math.floor(v / width);
    const tally = (vs: number[]) => {
      const out = new Array<number>(bins).fill(0);
      for (const v of vs) out[Math.min(bins - 1, Math.max(0, binOf(v)))]!++;
      return out;
    };
    const values: number[] = [];
    counts.forEach((c, i) => {
      for (let k = 0; k < c; k++)
        values.push(
          i * width + (k === 0 && r(0, 1) === 1 ? 0 : r(0, width - 1)),
        );
    });
    const right = tally(values);
    const wrong: Wrong[] = [];
    const seenVectors = new Set([right.join()]);
    const range = bins * width;
    for (let attempt = 0; attempt < 500 && wrong.length < 4; attempt++) {
      const copy = [...values];
      for (let t = r(1, 2); t > 0; t--) {
        const i = r(0, copy.length - 1);
        const edgeShift = r(0, 2) === 0 ? width : 1;
        const v = copy[i]! + (r(0, 1) ? 1 : -1) * edgeShift;
        if (v >= 0 && v < range) copy[i] = v;
      }
      const vector = tally(copy);
      if (seenVectors.has(vector.join())) continue;
      seenVectors.add(vector.join());
      const bar = vector.findIndex((c, i) => c !== right[i]);
      const lo = bar * width;
      wrong.push({
        label: listLabel(sortedAsc(copy)),
        feedback: `In this list ${vector[bar]} value${vector[bar] === 1 ? "" : "s"} fall from ${lo} up to ${lo + width - 1}, but that bar is ${right[bar]} tall.`,
      });
    }
    return {
      variant,
      prompt: `The histogram shows ${s.what}, in intervals ${width} wide. A value equal to the left end of an interval is counted in that interval. Which list of values produced the histogram?`,
      figure: {
        kind: "histogram",
        start: 0,
        width,
        counts: right,
        unit: s.unit,
      },
      hint: `Read each bar's height: it is how many values fall in that interval. Sort a candidate list into the intervals ${width} wide, starting at 0, and compare the counts bar by bar.`,
      explanation: [
        `The bar heights from left to right are ${right.join(", ")}, so there are ${right.reduce((a, b) => a + b, 0)} values in all.`,
        `Sorting the correct list into intervals ${width} wide gives exactly those counts; the other lists put a different number of values in at least one interval.`,
        `The correct list is ${sortedAsc(values).join(", ")}.`,
      ],
      correct: listLabel(sortedAsc(values)),
      wrong,
    };
  }
  if (variant === "box-plot-to-data") {
    const s = pick(r, boxSettings);
    const n = pick(r, [7, 11] as const);
    const slots = (s.end - s.start) / s.step;
    let sorted: number[];
    let summary: ReturnType<typeof fiveNumber>;
    do {
      sorted = sortedAsc(
        Array.from({ length: n }, () => s.start + r(0, slots) * s.step),
      );
      summary = fiveNumber(sorted);
    } while (summary.some((v, i) => i > 0 && v <= summary[i - 1]!));
    const half = (n - 1) / 2;
    const positions = [0, (half - 1) / 2, half, n - 1 - (half - 1) / 2, n - 1];
    const wrong: Wrong[] = [];
    const seenSummaries = new Set([summary.join()]);
    for (let attempt = 0; attempt < 500 && wrong.length < 4; attempt++) {
      const copy = [...sorted];
      const which = r(0, 4);
      const v =
        copy[positions[which]!]! + (r(0, 1) ? 1 : -1) * r(1, 2) * s.step;
      if (v < s.start || v > s.end) continue;
      copy[positions[which]!] = v;
      const next = sortedAsc(copy);
      const shape = fiveNumber(next);
      if (seenSummaries.has(shape.join())) continue;
      seenSummaries.add(shape.join());
      const stat = shape.findIndex((x, i) => x !== summary[i]);
      wrong.push({
        label: listLabel(next),
        feedback: `This list has ${statNames[stat]} ${shape[stat]}, but the plot shows ${summary[stat]}.`,
      });
    }
    return {
      variant,
      prompt: `The box plot shows ${s.what}. Quartiles are the medians of the lower and upper halves of the ordered data, not counting the overall median. Which list of ${n} values produced the box plot?`,
      figure: {
        kind: "box-plot",
        start: s.start,
        end: s.end,
        step: s.step,
        summary,
        unit: s.unit,
      },
      hint: `Read the five marks of the plot: minimum, lower quartile, median, upper quartile, maximum. For each list, order the values and find those five numbers the same way, then compare.`,
      explanation: [
        `The plot marks the minimum ${summary[0]}, lower quartile ${summary[1]}, median ${summary[2]}, upper quartile ${summary[3]} and maximum ${summary[4]}.`,
        `Order each list. The median is the middle value; the quartiles are the middle values of the lower and upper halves.`,
        `Only ${sorted.join(", ")} gives all five numbers.`,
      ],
      correct: listLabel(sorted),
      wrong,
    };
  }
  if (variant === "data-to-bar-heights") {
    const s = pick(r, histogramSettings);
    const width = 5;
    const bins = r(4, 6);
    let values: number[];
    let correct: number[];
    let pool: number[][];
    const leftTally = (vs: number[]) => {
      const out = new Array<number>(bins).fill(0);
      for (const v of vs) out[Math.floor(v / width)]!++;
      return out;
    };
    const rightTally = (vs: number[]) => {
      const out = new Array<number>(bins).fill(0);
      for (const v of vs) out[Math.ceil(v / width) - 1]!++;
      return out;
    };
    for (;;) {
      values = Array.from({ length: r(12, 16) }, () => r(1, bins * width - 1));
      const edges = values.filter((v) => v % width === 0).length;
      correct = leftTally(values);
      const distinctPerBar = new Array<number>(bins).fill(0);
      for (let i = 0; i < bins; i++)
        distinctPerBar[i] = new Set(
          values.filter((v) => Math.floor(v / width) === i),
        ).size;
      const wide: number[] = [];
      for (let i = 0; i < bins; i += 2)
        wide.push(correct[i]! + (correct[i + 1] ?? 0));
      pool = [rightTally(values), [...correct].reverse(), distinctPerBar, wide];
      const unique = new Set([correct.join(), ...pool.map((p) => p.join())]);
      if (edges >= 2 && unique.size === 5) break;
    }
    const names = [
      "counts each edge value in the interval that ends at it, not the one that starts at it",
      "lists the bars from right to left",
      "counts each different value once instead of counting repeats",
      "uses intervals twice as wide",
    ];
    const shuffled = shuffle(r, [...values]);
    return {
      variant,
      prompt: `The data are ${s.what}: ${shuffled.join(", ")}. A histogram has bars for the intervals ${Array.from({ length: bins }, (_, i) => `$${i * width}\\le x<${(i + 1) * width}$`).join(", ")}. Which list gives the bar heights from left to right?`,
      hint: `Sort the values into the intervals one at a time. A value equal to the left end of an interval belongs to that interval. Tally each interval, then read the tallies from left to right.`,
      explanation: [
        `Place each value in the interval that contains it, using $a\\le x<b$: the left end belongs to the interval.`,
        `The tallies from left to right are ${correct.join(", ")}.`,
        `These are the bar heights; they add to ${values.length}, the number of values.`,
      ],
      correct: listLabel(correct),
      wrong: pool.map((p, i) => ({
        label: listLabel(p),
        feedback: `That list ${names[i]}.`,
      })),
    };
  }
  // data-to-five-numbers
  const n = pick(r, [7, 11] as const);
  const s = pick(r, boxSettings);
  const stat = (summary: readonly number[]) => summary.map(fmt).join(", ");
  let values: number[];
  let summary: ReturnType<typeof fiveNumber>;
  let sorted: number[];
  let pool: { values: number[]; why: string }[];
  for (;;) {
    values = Array.from({ length: n }, () => r(20, 99));
    if (new Set(values).size !== n) continue;
    sorted = sortedAsc(values);
    summary = fiveNumber(sorted);
    const half = Math.floor(n / 2);
    const includeLow = median(sorted.slice(0, half + 1));
    const includeHigh = median(sorted.slice(half));
    const mean = Math.round((values.reduce((a, b) => a + b, 0) / n) * 10) / 10;
    pool = [
      {
        values: [summary[0], includeLow, summary[2], includeHigh, summary[4]],
        why: "includes the median in both halves when finding the quartiles",
      },
      {
        values: [summary[0], summary[1], mean, summary[3], summary[4]],
        why: "uses the mean in place of the median",
      },
      {
        values: [
          summary[0],
          summary[1],
          summary[2],
          summary[3],
          summary[4] - summary[0],
        ],
        why: "gives the range in place of the maximum",
      },
      {
        values: [summary[0], summary[1], values[half]!, summary[3], summary[4]],
        why: "takes the middle of the list as written without ordering it first",
      },
    ];
    const distinct = new Set([
      summary.join(),
      ...pool.map((p) => p.values.join()),
    ]);
    if (distinct.size === 5) break;
  }
  void s;
  return {
    variant,
    prompt: `A box plot is drawn for these ${n} values, listed in the order they were recorded: ${values.join(", ")}. Quartiles are the medians of the lower and upper halves of the ordered data, not counting the overall median. Which list gives the minimum, lower quartile, median, upper quartile and maximum, in that order?`,
    hint: `Put the values in order from least to greatest first. The median is the middle value; the quartiles are the middle values of the lower and upper halves.`,
    explanation: [
      `In order: ${sorted.join(", ")}.`,
      `The median is the middle value, ${summary[2]}. The lower half is ${sorted.slice(0, (n - 1) / 2).join(", ")}, with median ${summary[1]}. The upper half is ${sorted.slice((n + 1) / 2).join(", ")}, with median ${summary[3]}.`,
      `The five numbers are ${summary.join(", ")}.`,
    ],
    correct: stat(summary),
    wrong: pool.map((p) => ({
      label: stat(p.values),
      feedback: `That list ${p.why}.`,
    })),
  };
}

// ------------------------------------------------------------------------ dispatch
const builders: Record<string, (r: Random) => Built> = {
  "arc-sector-derivation": arcSectorDerivation,
  "complex-plane-operations": complexPlaneOperations,
  "conditional-everyday-reasoning": conditionalEveryday,
  "congruence-by-rigid-motion": congruenceRigidMotion,
  "conic-foci": conicFoci,
  "choose-the-plot": choosePlot,
  "similarity-by-transformation": similarityTransformation,
  "aa-similarity": aaSimilarity,
};

/** Private exact model; the variant name is kept for tests only. */
export function geometryRequirementGapCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; variant: string; correctLabel: string } {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const template = geometryRequirementGapTemplates.find((t) => t.id === id);
  const build = builders[id];
  if (!template || !build) throw new Error(`Unknown template ${id}`);
  const r = random(id, seed);
  // A plain-text list can coincide with numbers quoted in the prompt; draw again.
  let built = build(r);
  for (
    let attempt = 0;
    attempt < 20 && (built.prompt + built.hint).includes(built.correct);
    attempt++
  )
    built = build(r);
  const wrong = pickWrong(r, built.correct, built.wrong);
  return {
    variant: built.variant,
    correctLabel: built.correct,
    problem: assemble(template, seed, r, {
      prompt: built.prompt,
      ...(built.figure ? { figure: built.figure } : {}),
      answer: "",
      hint: built.hint,
      explanation: built.explanation,
      choices: [
        { label: built.correct, correct: true },
        ...wrong.map((w) => ({ label: w.label, feedback: w.feedback })),
      ],
    }),
  };
}
export function generateGeometryRequirementGapProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return geometryRequirementGapCase(id, seed).problem;
}
