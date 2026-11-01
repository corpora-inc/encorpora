import { article } from "./agreement";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { table } from "./scene/author";
import {
  altitudeFigure,
  obliqueFigure,
  sceneFigure,
  sidesFromAngles,
} from "./geometry-teaching-figures";
import {
  assemble,
  random,
  shuffle,
  type Draft,
  type Random,
} from "./distribution-practice";

const choice = { requiredResponseCapability: "single-choice-v1" } as const;
const scenes = { requiredFigureCapability: "scenes-v1" } as const;

export const remainingGapTemplates: readonly TemplateMetadata[] = [
  {
    id: "triangle-law-reasoning",
    version: 1,
    ...choice,
    title: "Derive and choose a triangle law",
    skillId: "triangle-law-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    ...scenes,
    description:
      "Select the altitude relations behind the laws of sines and cosines, the law that starts a triangle with given measurements, and the number of triangles an ambiguous side-side-angle case allows.",
  },
  {
    id: "model-quantity-roles",
    version: 1,
    ...choice,
    title: "Define the quantities in a model",
    skillId: "model-quantities",
    gradeBand: "9–12",
    difficultyOffset: 0,
    description:
      "Choose variable definitions with units, the rate quantity, a unit that matches the rate, and which quantities vary in a modeling situation.",
  },
  {
    id: "stem-leaf-read",
    version: 1,
    ...choice,
    ...scenes,
    title: "Read a stem-and-leaf plot",
    skillId: "mean-median",
    gradeBand: "6–8",
    difficultyOffset: -0.5,
    description:
      "Use the key of a whole-number or one-decimal stem-and-leaf plot to read a value, extremes, range, median, mode, a count above a value or a difference of ordered values.",
  },
  {
    id: "budget-category-balance",
    version: 1,
    ...choice,
    ...scenes,
    title: "Balance a budget",
    skillId: "decimal-arithmetic",
    gradeBand: "3–5",
    difficultyOffset: 0.2,
    description:
      "Subtract categorized expenses with cents from income to find a missing category, a surplus or deficit, or the change that balances a budget.",
  },
  {
    id: "gross-net-pay",
    version: 1,
    ...choice,
    ...scenes,
    title: "Gross pay and net pay",
    skillId: "decimal-arithmetic",
    gradeBand: "3–5",
    difficultyOffset: 0.3,
    description:
      "Use gross pay, listed deductions and net pay with amounts in dollars and cents: find net pay, gross pay or a missing deduction, or identify the take-home amount on a pay stub.",
  },
];

export type Wrong = { label: string; feedback: string };
/** Correct choice plus three distinct wrong ones; fewer distinct wrong choices is a content bug. */
export function options(
  correct: string,
  wrong: Wrong[],
): NonNullable<Draft["choices"]> {
  const seen = new Set([correct]);
  const kept = wrong.filter(({ label }) => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  if (kept.length < 3)
    throw new Error(
      `Insufficient distinct choices for ${correct}: ${kept.map((w) => w.label).join(" | ")}`,
    );
  return [
    { label: correct, correct: true },
    ...kept.slice(0, 3).map(({ label, feedback }) => ({ label, feedback })),
  ];
}
export function checkSeed(seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
}
const byId = (id: string) => remainingGapTemplates.find((t) => t.id === id)!;

/* ------------------------------------------------------------------ */
/* Triangle laws: derivation and applicability                         */
/* ------------------------------------------------------------------ */

const vertexSets = [
  ["A", "B", "C"],
  ["P", "Q", "R"],
  ["X", "Y", "Z"],
] as const;

export function triangleLawCase(seed: string) {
  checkSeed(seed);
  const meta = byId("triangle-law-reasoning");
  const r = random(meta.id, seed);
  const variant = r(0, 5);
  const [A, B, C] = vertexSets[r(0, 2)]!;
  const a = A.toLowerCase();
  const b = B.toLowerCase();
  const c = C.toLowerCase();
  const sides = `side $${a}$ is opposite angle $${A}$, side $${b}$ is opposite angle $${B}$, and side $${c}$ is opposite angle $${C}$`;
  let draft: Draft;
  let figure: SemanticFigure | undefined;
  if (variant === 0) {
    figure = sceneFigure(
      altitudeFigure({
        names: [A, B, C],
        sides: [6, 7, 8],
        from: 2,
        hLabel: "h",
        sideLabels: [c, a, b],
      }),
    );
    const ok = `$h=${b}\\sin ${A}$ and $h=${a}\\sin ${B}$`;
    draft = {
      prompt: `In triangle $${A}${B}${C}$, ${sides}. The altitude from $${C}$ meets side $${A}${B}$ at $D$, between $${A}$ and $${B}$, and has length $h$. Which pair of equations gives $h$ in right triangles $${A}D${C}$ and $${B}D${C}$?`,
      answer: "",
      hint: `In right triangle $${A}D${C}$ the hypotenuse is $${A}${C}=${b}$ and $h$ is the leg opposite angle $${A}$. Write $\\sin ${A}$ as opposite over hypotenuse, then repeat in $${B}D${C}$.`,
      explanation: [
        `In right triangle $${A}D${C}$, the hypotenuse is $${A}${C}=${b}$ and $h$ is opposite angle $${A}$, so $\\sin ${A}=\\frac{h}{${b}}$ and $h=${b}\\sin ${A}$.`,
        `In right triangle $${B}D${C}$, the hypotenuse is $${B}${C}=${a}$ and $h$ is opposite angle $${B}$, so $h=${a}\\sin ${B}$.`,
        `The pair is ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: `$h=${b}\\cos ${A}$ and $h=${a}\\cos ${B}$`,
          feedback: `Cosine is adjacent over hypotenuse. The altitude $h$ is opposite angle $${A}$ and angle $${B}$, so use sine.`,
        },
        {
          label: `$h=${a}\\sin ${A}$ and $h=${b}\\sin ${B}$`,
          feedback: `The hypotenuse of $${A}D${C}$ is $${b}$, not $${a}$. Multiply the sine of the angle by the hypotenuse of the same right triangle.`,
        },
        {
          label: `$h=${b}\\tan ${A}$ and $h=${a}\\tan ${B}$`,
          feedback: `Tangent compares the opposite leg with the adjacent leg. Here $h$ and the hypotenuse are known, which is a sine relationship.`,
        },
      ]),
    };
  } else if (variant === 1) {
    figure = sceneFigure(
      altitudeFigure({
        names: [A, B, C],
        sides: [6, 7, 8],
        from: 0,
        sideLabels: [c, a, b],
        footLabels: [`${a}-u`, "u"],
      }),
    );
    const ok = `$u=${b}\\cos ${C}$`;
    draft = {
      prompt: `In triangle $${A}${B}${C}$, ${sides}. The altitude from $${A}$ meets side $${B}${C}$ at $D$, between $${B}$ and $${C}$. Let $u=${C}D$, so $${B}D=${a}-u$. Which expression gives $u$ from right triangle $${A}D${C}$?`,
      answer: "",
      hint: `In right triangle $${A}D${C}$ the hypotenuse is $${A}${C}=${b}$ and $u$ is the leg that touches angle $${C}$. Ask which ratio of sides uses the adjacent leg and the hypotenuse.`,
      explanation: [
        `In right triangle $${A}D${C}$, the hypotenuse is $${A}${C}=${b}$ and $u=${C}D$ is the leg adjacent to angle $${C}$.`,
        `Cosine is adjacent over hypotenuse, so $\\cos ${C}=\\frac{u}{${b}}$.`,
        `Therefore ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: `$u=${b}\\sin ${C}$`,
          feedback: `$${b}\\sin ${C}$ is the opposite leg $${A}D$. The leg $u$ touches angle $${C}$, so it is adjacent.`,
        },
        {
          label: `$u=\\frac{${b}}{\\cos ${C}}$`,
          feedback: `Cosine equals $u$ divided by $${b}$. Multiply both sides by $${b}$ rather than dividing.`,
        },
        {
          label: `$u=${a}\\cos ${C}$`,
          feedback: `The hypotenuse of $${A}D${C}$ is $${b}$. Side $${a}$ is the whole base $${B}${C}$, not a hypotenuse of this right triangle.`,
        },
      ]),
    };
  } else if (variant === 2) {
    figure = sceneFigure(
      altitudeFigure({
        names: [A, B, C],
        sides: [6, 7, 8],
        from: 0,
        hLabel: "h",
        sideLabels: [c, a, b],
        footLabels: [`${a}-u`, "u"],
      }),
    );
    const law = (angle: string) =>
      `$${c}^2=${a}^2+${b}^2-2${a}${b}\\cos ${angle}$`;
    const ok = law(C);
    draft = {
      prompt: `For the altitude $h$ from $${A}$ to side $${B}${C}$ with $u=${C}D$, triangle $${A}D${C}$ gives $h^2=${b}^2-u^2$ and triangle $${A}D${B}$ gives $h^2=${c}^2-(${a}-u)^2$. Also $u=${b}\\cos ${C}$. Which equation follows from setting the two expressions for $h^2$ equal and simplifying?`,
      answer: "",
      hint: `Expand $(${a}-u)^2$ in $${b}^2-u^2=${c}^2-(${a}-u)^2$. The $u^2$ terms cancel, leaving $${c}^2$ in terms of $${a}$, $${b}$ and $u$. Then replace $u$.`,
      explanation: [
        `Set the expressions equal: $${b}^2-u^2=${c}^2-(${a}-u)^2$.`,
        `Expand: $(${a}-u)^2=${a}^2-2${a}u+u^2$, so $${b}^2-u^2=${c}^2-${a}^2+2${a}u-u^2$.`,
        `The $u^2$ terms cancel, so $${c}^2=${a}^2+${b}^2-2${a}u$.`,
        `Replace $u$ by $${b}\\cos ${C}$: ${ok}.`,
      ],
      choices: options(
        ok,
        shuffle(r, [
          {
            label: `$${c}^2=${a}^2+${b}^2+2${a}${b}\\cos ${C}$`,
            feedback: `Expanding $-(${a}-u)^2$ gives $+2${a}u$ on the right of $${b}^2-u^2=\\dots$, which moves to $-2${a}u$ when isolating $${c}^2$. The cosine term is subtracted.`,
          },
          {
            label: `$${c}^2=${a}^2+${b}^2-${a}${b}\\cos ${C}$`,
            feedback: `The cross term of $(${a}-u)^2$ is $-2${a}u$, so the factor is $2${a}u=2${a}${b}\\cos ${C}$, not $${a}${b}\\cos ${C}$.`,
          },
          {
            label: law(A),
            feedback: `The projection $u$ lies along $${C}$, between $${C}$ and the foot $D$, so the angle in the formula is $${C}$, the angle opposite $${c}$.`,
          },
          {
            label: `$${c}^2=${a}^2+${b}^2$`,
            feedback: `That is the Pythagorean theorem, which holds only when angle $${C}$ is a right angle ($\\cos ${C}=0$). Keep the cosine term.`,
          },
        ]),
      ),
    };
  } else if (variant === 3) {
    const kind = (["SAS", "SSS", "ASA", "AAS"] as const)[r(0, 3)]!;
    const side = () => r(5, 15);
    const cosinesNote = `The law of cosines starts from three sides or from two sides and the angle between them.`;
    const setup = {
      SAS: () => {
        const s1 = side(),
          s2 = side(),
          ang = r(35, 120);
        const given = `$${a}=${s1}$, $${b}=${s2}$ and the angle between them, $${C}=${ang}^\\circ$`;
        const third = Math.sqrt(
          s1 * s1 + s2 * s2 - 2 * s1 * s2 * Math.cos((ang * Math.PI) / 180),
        );
        return {
          fig: obliqueFigure({
            names: [A, B, C],
            sides: [s1, s2, third],
            shown: { a: String(s1), b: String(s2), c: null },
            angles: { C: `${ang}°` },
          }),
          given,
          target: `side $${c}$`,
          ok: `Law of cosines, because the known angle lies between the two known sides`,
          wrong: `Law of sines, because it connects each side with its opposite angle`,
          wrongWhy: `The law of sines needs a known side and the known angle opposite it. The known angle $${C}$ is opposite the unknown side $${c}$, and no other side-angle pair is known.`,
          steps: [
            `The known angle $${C}$ lies between sides $${a}$ and $${b}$, and the unknown side $${c}$ is opposite it.`,
            `That matches $${c}^2=${a}^2+${b}^2-2${a}${b}\\cos ${C}$, which has one unknown.`,
          ],
          first: `ask whether any known angle has its opposite side known`,
        };
      },
      SSS: () => {
        const s1 = side();
        const s2 = side();
        const s3 = r(Math.abs(s1 - s2) + 1, s1 + s2 - 1);
        return {
          fig: obliqueFigure({
            names: [A, B, C],
            sides: [s1, s2, s3],
            shown: { a: String(s1), b: String(s2), c: String(s3) },
            angles: { C: null },
          }),
          given: `$${a}=${s1}$, $${b}=${s2}$ and $${c}=${s3}$`,
          target: `angle $${C}$`,
          ok: `Law of cosines, because all three sides are known and no angle is`,
          wrong: `Law of sines, because it connects each side with its opposite angle`,
          wrongWhy: `The law of sines needs one known angle with its opposite side. With only sides known, no such pair exists. The law of cosines connects three sides to one angle.`,
          steps: [
            `All three sides are known and no angle is, so no side has a known opposite angle.`,
            `The law of cosines $${c}^2=${a}^2+${b}^2-2${a}${b}\\cos ${C}$ has one unknown, $\\cos ${C}$.`,
          ],
          first: `ask whether any known angle has its opposite side known`,
        };
      },
      ASA: () => {
        const angA = r(30, 80),
          angB = r(30, 80),
          sc = side();
        const sa =
          (sc * Math.sin((angA * Math.PI) / 180)) /
          Math.sin(((180 - angA - angB) * Math.PI) / 180);
        const sd = sidesFromAngles(angA, angB, sa);
        return {
          fig: obliqueFigure({
            names: [A, B, C],
            sides: [sd.a, sd.b, sd.c],
            shown: { c: String(sc), a: null },
            angles: { A: `${angA}°`, B: `${angB}°` },
          }),
          given: `$${A}=${angA}^\\circ$, $${B}=${angB}^\\circ$ and the side between them, $${c}=${sc}$`,
          target: `side $${a}$`,
          ok: `Law of sines, because the third angle $180^\\circ-${A}-${B}$ gives side $${c}$ a known opposite angle`,
          wrong: `Law of cosines, because it applies to every triangle`,
          wrongWhy: `${cosinesNote} Only one side is known here. Find the third angle, then use the law of sines.`,
          steps: [
            `The angle sum gives $${C}=180^\\circ-${A}-${B}$, which is opposite the known side $${c}$.`,
            `Now $\\frac{${a}}{\\sin ${A}}=\\frac{${c}}{\\sin ${C}}$ has one unknown, $${a}$.`,
          ],
          first: `ask which known side has its opposite angle known`,
        };
      },
      AAS: () => {
        const angA = r(30, 80),
          angB = r(30, 80),
          sa = side();
        const sd = sidesFromAngles(angA, angB, sa);
        return {
          fig: obliqueFigure({
            names: [A, B, C],
            sides: [sd.a, sd.b, sd.c],
            shown: { a: String(sa), b: null },
            angles: { A: `${angA}°`, B: `${angB}°` },
          }),
          given: `$${A}=${angA}^\\circ$, $${B}=${angB}^\\circ$ and side $${a}=${sa}$ (opposite $${A}$)`,
          target: `side $${b}$`,
          ok: `Law of sines, because side $${a}$ and its opposite angle $${A}$ are both known`,
          wrong: `Law of cosines, because it applies to every triangle`,
          wrongWhy: `${cosinesNote} Only one side is known here. The known pair $${a}$ and $${A}$ fits the law of sines.`,
          steps: [
            `Side $${a}$ and its opposite angle $${A}$ are both known, and angle $${B}$ is opposite the wanted side $${b}$.`,
            `$\\frac{${b}}{\\sin ${B}}=\\frac{${a}}{\\sin ${A}}$ has one unknown, $${b}$.`,
          ],
          first: `ask which known side has its opposite angle known`,
        };
      },
    }[kind]();
    figure = sceneFigure(setup.fig);
    draft = {
      prompt: `A triangle $${A}${B}${C}$ has ${setup.given}. You want ${setup.target}. Which law starts the solution, and why?`,
      answer: "",
      hint: `Sort the givens (${setup.given}): ${setup.first}. The law of sines needs such a pair; the law of cosines needs three sides or two sides and the angle between them.`,
      explanation: [
        `The givens are ${setup.given}.`,
        ...setup.steps,
        `${setup.ok}.`,
      ],
      choices: options(setup.ok, [
        { label: setup.wrong, feedback: setup.wrongWhy },
        {
          label:
            "Pythagorean theorem, because every triangle satisfies $x^2+y^2=z^2$",
          feedback:
            "The relation $x^2+y^2=z^2$ holds only when the angle opposite $z$ is a right angle. No right angle is given.",
        },
        {
          label:
            "Neither law, because three measurements cannot determine a triangle",
          feedback:
            "These three measurements fix the triangle's size and shape, so one of the two laws starts the solution.",
        },
      ]),
    };
  } else {
    // Side-side-angle with angle A acute: compare a with the height b sin A and with b.
    const target = (["none", "right", "two", "one"] as const)[r(0, 3)]!;
    // An exact right-triangle boundary needs sin A = 1/2, so only 30° can produce it.
    const angle = target === "right" ? 30 : ([30, 45, 60] as const)[r(0, 2)]!;
    let aLen = 0;
    let bLen = 0;
    const classify = (x: number, y: number) => {
      // Compare x² with y² sin²A exactly: sin² is 1/4, 1/2, 3/4.
      const num = angle === 60 ? 3 : 1;
      const den = angle === 30 ? 4 : angle === 45 ? 2 : 4;
      const lhs = x * x * den;
      const rhs = y * y * num;
      if (x >= y) return "one" as const;
      if (lhs < rhs) return "none" as const;
      if (lhs === rhs) return "right" as const;
      return "two" as const;
    };
    for (let guard = 0; guard < 400; guard++) {
      bLen = r(4, 14);
      aLen = r(2, bLen + 2);
      if (classify(aLen, bLen) === target) break;
      if (guard === 399) throw new Error("No ambiguous-case data found");
    }
    const actual = classify(aLen, bLen);
    const height =
      angle === 30
        ? `\\frac{${bLen}}{2}=${bLen / 2}`
        : angle === 45
          ? `\\frac{${bLen}\\sqrt2}{2}\\approx ${((bLen * Math.SQRT2) / 2).toFixed(2)}`
          : `\\frac{${bLen}\\sqrt3}{2}\\approx ${((bLen * Math.sqrt(3)) / 2).toFixed(2)}`;
    const labels = {
      none: `No triangle, because $${a}$ is shorter than the height $${b}\\sin ${A}$`,
      right: `One triangle, because $${a}$ equals the height $${b}\\sin ${A}$ and side $${a}$ just reaches the base`,
      two: `Two triangles, because $${a}$ is longer than the height $${b}\\sin ${A}$ but shorter than $${b}$`,
      one: `One triangle, because $${a}$ is at least as long as $${b}$`,
    } as const;
    const why = {
      none: `Side $${a}$ is too short to reach the line along the base, so no triangle exists.`,
      right: `Side $${a}$ touches the base at exactly one point, forming a right angle there.`,
      two: `Side $${a}$ can reach the base at two different points, one on each side of the foot of the altitude.`,
      one: `The second point where side $${a}$ meets the base line falls behind angle $${A}$, on the opposite side of the vertex, so it does not form a triangle with angle $${A}$.`,
    } as const;
    const feedback = (k: keyof typeof labels) =>
      k === "none"
        ? `Compare $${a}$ with the height $${b}\\sin ${A}$ first. A shorter side cannot reach the base; $${a}$ is not shorter here.`
        : k === "right"
          ? `A single right-triangle case needs $${a}$ to equal $${b}\\sin ${A}$ exactly; that is not the comparison here.`
          : k === "two"
            ? `Two triangles need $${a}$ strictly between $${b}\\sin ${A}$ and $${b}$. That is not the comparison here.`
            : `One triangle from $${a}\\ge ${b}$ needs $${a}$ at least as long as $${b}$. That is not the comparison here.`;
    const order = ["none", "right", "two", "one"] as const;
    draft = {
      prompt: `In triangle $${A}${B}${C}$, angle $${A}=${angle}^\\circ$ is opposite side $${a}=${aLen}$, and side $${b}=${bLen}$ runs from $${A}$ to $${C}$. How many triangles have these measurements?`,
      answer: "",
      hint: `Place side $${b}=${bLen}$ along a ray from angle $${A}$. The height from its end to the other ray is $${b}\\sin ${A}$. Compare $${a}=${aLen}$ with that height and with $${b}$.`,
      explanation: [
        `The height is $${b}\\sin ${A}=${bLen}\\sin ${angle}^\\circ=${height}$.`,
        `Compare $${a}=${aLen}$ with the height and with $${b}=${bLen}$: ${actual === "none" ? `$${aLen}$ is less than the height` : actual === "right" ? `$${aLen}$ equals the height` : actual === "two" ? `$${aLen}$ is greater than the height and less than $${bLen}$` : `$${aLen}\\ge ${bLen}$`}.`,
        why[actual],
        `${labels[actual]}.`,
      ],
      choices: options(
        labels[actual],
        order
          .filter((k) => k !== actual)
          .map((k) => ({ label: labels[k], feedback: feedback(k) })),
      ),
    };
  }
  return {
    variant,
    problem: assemble(meta, seed, r, {
      ...draft,
      ...(figure ? { figure } : {}),
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Defining quantities for a model                                     */
/* ------------------------------------------------------------------ */

const cap = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;
type QuantityContext = {
  scene: (rate: number, fixed: number) => string;
  xSym: string;
  xAsk: string;
  xUnit: string;
  yAsk: string;
  yUnit: string;
  ySym: string;
  rate: string;
  rateReversed: string;
  fixedName: string;
  /** Time quantities: [amount in another unit, same amount in xUnit, its bare number]. */
  converted?: [string, string, string][];
  convertedUnit?: string;
};
const quantityContexts: QuantityContext[] = [
  {
    scene: (rate, fixed) =>
      `A bike shop charges ${rate} dollars for each hour a bike is rented, plus ${article(fixed)} ${fixed}-dollar helmet fee`,
    xSym: "h",
    xAsk: "the time a bike is rented",
    xUnit: "hours",
    ySym: "C",
    yAsk: "the total rental cost",
    yUnit: "dollars",
    rate: "dollars per hour",
    rateReversed: "hours per dollar",
    fixedName: "the helmet fee",
    converted: [
      ["90 minutes", "1.5 hours", "90"],
      ["30 minutes", "0.5 hours", "30"],
      ["150 minutes", "2.5 hours", "150"],
    ],
    convertedUnit: "minutes",
  },
  {
    scene: (rate, fixed) =>
      `A taxi charges ${rate} dollars for each mile driven, plus ${article(fixed)} ${fixed}-dollar pickup fee`,
    xSym: "d",
    xAsk: "the distance the taxi drives",
    xUnit: "miles",
    ySym: "F",
    yAsk: "the fare",
    yUnit: "dollars",
    rate: "dollars per mile",
    rateReversed: "miles per dollar",
    fixedName: "the pickup fee",
  },
  {
    scene: (rate, fixed) =>
      `A tank holding ${fixed * 10} liters drains at ${rate} liters each minute`,
    xSym: "t",
    xAsk: "the time the tank has been draining",
    xUnit: "minutes",
    ySym: "V",
    yAsk: "the volume left in the tank",
    yUnit: "liters",
    rate: "liters per minute",
    rateReversed: "minutes per liter",
    fixedName: "the starting volume",
    converted: [
      ["2 hours", "120 minutes", "2"],
      ["1 hour", "60 minutes", "1"],
      ["half an hour", "30 minutes", "0.5"],
    ],
    convertedUnit: "hours",
  },
  {
    scene: (rate, fixed) =>
      `A phone plan costs ${fixed} dollars a month plus ${rate} dollars for each gigabyte of data used`,
    xSym: "g",
    xAsk: "the data used in a month",
    xUnit: "gigabytes",
    ySym: "B",
    yAsk: "the monthly bill",
    yUnit: "dollars",
    rate: "dollars per gigabyte",
    rateReversed: "gigabytes per dollar",
    fixedName: "the monthly base fee",
  },
  {
    scene: (rate, fixed) =>
      `A seedling is ${fixed} centimeters tall and grows ${rate} centimeters each week`,
    xSym: "w",
    xAsk: "the time the seedling has been growing",
    xUnit: "weeks",
    ySym: "H",
    yAsk: "the seedling's height",
    yUnit: "centimeters",
    rate: "centimeters per week",
    rateReversed: "weeks per centimeter",
    fixedName: "the starting height",
    converted: [
      ["14 days", "2 weeks", "14"],
      ["21 days", "3 weeks", "21"],
      ["35 days", "5 weeks", "35"],
    ],
    convertedUnit: "days",
  },
  {
    scene: (rate, fixed) =>
      `A gym charges ${article(fixed)} ${fixed}-dollar joining fee plus ${rate} dollars each month`,
    xSym: "m",
    xAsk: "the number of months a member has belonged",
    xUnit: "months",
    ySym: "T",
    yAsk: "the total paid",
    yUnit: "dollars",
    rate: "dollars per month",
    rateReversed: "months per dollar",
    fixedName: "the joining fee",
  },
];

export function modelQuantityCase(seed: string) {
  checkSeed(seed);
  const meta = byId("model-quantity-roles");
  const r = random(meta.id, seed);
  const variant = r(0, 3);
  const ctx = quantityContexts[r(0, quantityContexts.length - 1)]!;
  const rate = r(2, 9);
  const fixed = [3, 4, 5, 6, 7, 9, 10, 12][r(0, 7)]!;
  const scene = ctx.scene(rate, fixed);
  // The tank scene prints its starting volume as ten times the base number.
  const fixedShown = scene.includes("holding") ? fixed * 10 : fixed;
  const x = `$${ctx.xSym}$`;
  const y = `$${ctx.ySym}$`;
  let draft: Draft;
  if (variant === 0) {
    const ok = `${x} = ${ctx.xAsk}, in ${ctx.xUnit}; ${y} = ${ctx.yAsk}, in ${ctx.yUnit}`;
    draft = {
      prompt: `${scene}. You want a model that predicts ${ctx.yAsk} from ${ctx.xAsk}. Which definition of the variables is clearest?`,
      answer: "",
      hint: `The model predicts ${ctx.yAsk}, so that quantity depends on the other one. The numbers ${rate} and ${fixedShown} are fixed by the situation, not variables. Name what each letter measures and the unit it is measured in.`,
      explanation: [
        `The quantity you choose or change is ${ctx.xAsk}. It is the independent quantity, measured in ${ctx.xUnit}.`,
        `The quantity that responds is ${ctx.yAsk}. It is the dependent quantity, measured in ${ctx.yUnit}.`,
        `A complete definition names both and gives units: ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: `${x} = ${ctx.yAsk}, in ${ctx.yUnit}; ${y} = ${ctx.xAsk}, in ${ctx.xUnit}`,
          feedback: `The roles are reversed. The model predicts ${ctx.yAsk}, so it is the dependent quantity, and ${ctx.xAsk} is the quantity you vary.`,
        },
        {
          label: `${x} = ${ctx.xAsk}; ${y} = ${ctx.yAsk}`,
          feedback: `The roles are right, but no units are given. A reader cannot tell how ${ctx.xAsk} is counted. Name the unit of each variable.`,
        },
        {
          label: `${x} = ${ctx.xAsk}, in ${ctx.xUnit}; ${y} = ${ctx.rate}`,
          feedback: `${cap(ctx.rate)} is a fixed rate in this situation, not the quantity being predicted. The dependent quantity is ${ctx.yAsk}.`,
        },
      ]),
    };
  } else if (variant === 1) {
    const ok = ctx.rate;
    draft = {
      prompt: `${scene}. In a model of ${ctx.yAsk} against ${ctx.xAsk}, which quantity, with its units, is the constant rate of change?`,
      answer: "",
      hint: `A rate compares how much ${ctx.yUnit} change for each one ${ctx.xUnit.replace(/s$/, "")}. The situation gives ${rate} and ${fixedShown}; find the one that goes with "each" or "per".`,
      explanation: [
        `The rate is the amount ${ctx.yAsk} changes for each one-unit change in ${ctx.xAsk}.`,
        `That is ${ctx.yUnit} for each ${ctx.xUnit.replace(/s$/, "")}, written ${ctx.rate}.`,
        `The rate is ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: ctx.rateReversed,
          feedback: `This inverts the comparison. The rate puts the dependent unit (${ctx.yUnit}) over the independent unit (${ctx.xUnit}).`,
        },
        {
          label: `${ctx.yUnit}, as ${ctx.yAsk}`,
          feedback: `That total is the dependent quantity, which changes. A rate is a ratio of two units, not a total.`,
        },
        {
          label: `${ctx.yUnit}, as ${ctx.fixedName}`,
          feedback: `${cap(ctx.fixedName)} is a starting amount that does not change as ${ctx.xAsk} changes. It is not a rate.`,
        },
      ]),
    };
  } else if (variant === 2) {
    const timed = quantityContexts.filter((q) => q.converted);
    const t = ctx.converted ? ctx : timed[r(0, timed.length - 1)]!;
    const [given, inUnit, bare] = t.converted![r(0, t.converted!.length - 1)]!;
    const ok = `$${t.xSym}$ = ${t.xAsk}, in ${t.xUnit} (${given} is ${inUnit})`;
    draft = {
      prompt: `${t.scene(rate, fixed)}. A question asks about ${given}. Which definition of $${t.xSym}$ keeps the model in the units of the rate?`,
      answer: "",
      hint: `The rate is ${t.rate}, so the quantity multiplied by ${rate} must be counted in ${t.xUnit}. Convert ${given} before substituting.`,
      explanation: [
        `The rate is ${t.rate}, so $${t.xSym}$ must be counted in ${t.xUnit}.`,
        `Convert the amount in the question: ${given} is ${inUnit}.`,
        `${ok}.`,
      ],
      choices: options(ok, [
        {
          label: `$${t.xSym}$ = ${t.xAsk}, in ${t.convertedUnit} (counting ${given} as ${bare})`,
          feedback: `The rate is ${t.rate}, so multiplying it by an amount counted in ${t.convertedUnit} mixes units. Convert to ${t.xUnit} first.`,
        },
        {
          label: `$${t.xSym}$ = ${t.yAsk}, in ${t.yUnit}`,
          feedback: `That is the dependent quantity, which the model predicts. The variable here is ${t.xAsk}.`,
        },
        {
          label: `$${t.xSym}$ = the rate, in ${t.rate}`,
          feedback: `The rate is a fixed number in the situation. A variable stands for a quantity that changes, here ${t.xAsk}.`,
        },
      ]),
    };
  } else {
    const pair = (p: string, q: string) => `${p} and ${q}`;
    const ok = pair(ctx.xAsk, ctx.yAsk);
    draft = {
      prompt: `${scene}. When ${ctx.xAsk} changes, which two quantities change?`,
      answer: "",
      hint: `A quantity stays constant if the situation gives it as one fixed number, like ${rate} and ${fixedShown} here. Sort the four quantities: ${ctx.xAsk}, ${ctx.yAsk}, ${ctx.rate} and ${ctx.fixedName}.`,
      explanation: [
        `${cap(ctx.rate)} and ${ctx.fixedName} are single fixed numbers in the situation.`,
        `${cap(ctx.xAsk)} is the quantity you vary, and ${ctx.yAsk} responds to it.`,
        `The two quantities that change are ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: pair(ctx.rate, ctx.fixedName),
          feedback: `Both of these are given as fixed numbers. Neither changes when ${ctx.xAsk} changes.`,
        },
        {
          label: pair(ctx.yAsk, ctx.rate),
          feedback: `${cap(ctx.yAsk)} changes, but ${ctx.rate} is a fixed rate. The quantity you vary is missing.`,
        },
        {
          label: pair(ctx.xAsk, ctx.fixedName),
          feedback: `${cap(ctx.xAsk)} changes, but ${ctx.fixedName} stays the same. The quantity that responds is missing.`,
        },
      ]),
    };
  }
  return { variant, problem: assemble(meta, seed, r, draft) };
}

/* ------------------------------------------------------------------ */
/* Stem-and-leaf plots                                                 */
/* ------------------------------------------------------------------ */

const wholeContexts = [
  ["points scored by each of {n} students on a quiz", "points"],
  ["minutes {n} students spent on homework last night", "minutes"],
  ["ages of {n} people at a family reunion", "years"],
] as const;
const decimalContexts = [
  ["lengths of {n} leaves collected on a nature walk", "centimeters"],
  ["distances {n} students walk to school", "miles"],
  ["masses of {n} apples picked from one tree", "hundreds of grams"],
  ["times {n} runners took in a sprint", "seconds"],
] as const;

/** Plain decimal text; decimal plots keep a tenths digit, e.g. 3.0. */
function plain(x: number, decimal: boolean) {
  let s = String(Number(x.toFixed(2)));
  if (decimal && !s.includes(".")) s += ".0";
  return s;
}

export function stemLeafCase(seed: string) {
  checkSeed(seed);
  const meta = byId("stem-leaf-read");
  const r = random(meta.id, seed);
  const variant = r(0, 6);
  const decimal = r(0, 1) === 1;
  const unit = decimal ? 10 : 1;
  const counts = (v: number[]) => {
    const m = new Map<number, number>();
    for (const x of v) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const uniqueMode = (v: number[]) => {
    const m = counts(v);
    const top = Math.max(...m.values());
    const modes = [...m].filter(([, k]) => k === top);
    return top >= 2 && modes.length === 1 ? modes[0]![0] : undefined;
  };
  // Values are stored as stem*10+leaf; decimal plots divide by 10 for display.
  let values: number[] = [];
  for (let guard = 0; ; guard++) {
    if (guard === 500) throw new Error("No stem-and-leaf data found");
    const stems = r(3, 4);
    const first = r(1, 9 - stems);
    values = [];
    for (let s = 0; s < stems; s++)
      for (let k = r(2, 5); k > 0; k--) values.push((first + s) * 10 + r(0, 9));
    values.sort((p, q) => p - q);
    const n = values.length;
    if (
      n >= 9 &&
      n <= 15 &&
      new Set(values).size >= 6 &&
      values[1]! > values[0]! &&
      values[n - 1]! > values[n - 2]! &&
      (variant !== 4 || uniqueMode(values) !== undefined)
    )
      break;
  }
  const n = values.length;
  const show = (v: number) => plain(v / unit, decimal);
  const stemOf = (v: number) => Math.floor(v / 10);
  const leafOf = (v: number) => v % 10;
  const rows = [...new Set(values.map(stemOf))].map((s) => ({
    stem: s,
    leaves: values.filter((v) => stemOf(v) === s).map(leafOf),
  }));
  const [contextText, contextUnit] = (
    decimal
      ? decimalContexts[r(0, decimalContexts.length - 1)]
      : wholeContexts[r(0, wholeContexts.length - 1)]
  )!;
  const unitText = ` ${contextUnit}`;
  const min = values[0]!;
  const max = values[n - 1]!;
  const twiceMedian =
    n % 2 ? 2 * values[(n - 1) / 2]! : values[n / 2 - 1]! + values[n / 2]!;
  const median = plain(twiceMedian / 2 / unit, decimal);
  const meanText = plain(values.reduce((p, q) => p + q, 0) / n / unit, decimal);
  const leafValue = (leaf: number) => plain(leaf / unit, decimal);
  /** The same digits read as if the key had no decimal point (or as if it had one). */
  const misscaled = (v: number) => plain(decimal ? v : v / 10, false);
  const scaleNote = decimal
    ? "The key puts the decimal point between the stem and the leaf, so each leaf counts tenths."
    : "The key reads stem and leaf as digits of one number, so each stem counts tens.";
  const keyFor = (v: number) =>
    `Key: $${stemOf(v)}\\mid ${leafOf(v)}$ means $${show(v)}$${unitText}.`;
  const figure: SemanticFigure = {
    kind: "scene",
    scene: table({
      id: "plot",
      corner: "Stem",
      columns: ["Leaf"],
      rows: rows.map((row) => ({
        label: String(row.stem),
        cells: [row.leaves.join(" ")],
      })),
    }).scene(),
  };
  let question: string;
  let answer: string;
  let hint: string;
  let explanation: string[];
  let wrong: Wrong[];
  let notKey: (v: number) => boolean; // a key example must not state the answer
  if (variant === 0) {
    const target = max;
    question = `Which value does the last leaf in the bottom row represent?`;
    answer = show(target);
    hint = `The bottom row has stem ${stemOf(target)}. Read its last leaf as the key shows. ${scaleNote}`;
    explanation = [
      scaleNote,
      `The bottom row has stem ${stemOf(target)} and its last leaf is ${leafOf(target)}.`,
      `Stem ${stemOf(target)} with leaf ${leafOf(target)} represents ${answer}${unitText}.`,
    ];
    wrong = [
      {
        label: misscaled(target),
        feedback: `This ignores the key. ${scaleNote}`,
      },
      {
        label: String(stemOf(target) + leafOf(target)),
        feedback: `A leaf is a digit of the value, not a number to add to the stem.`,
      },
      {
        label: leafValue(leafOf(target)),
        feedback: `The leaf is only the last digit. Combine it with its stem as the key shows.`,
      },
      {
        label: plain(stemOf(target) * (decimal ? 1 : 10), decimal),
        feedback: `The stem is only the leading digit or digits. The leaf adds the last digit.`,
      },
    ];
    notKey = (v) => v !== target;
  } else if (variant === 1) {
    const lowest = r(0, 1) === 0;
    const target = lowest ? min : max;
    const side = lowest ? "least" : "greatest";
    const other = lowest ? "greatest" : "least";
    question = `What is the ${side} value in the plot?`;
    answer = show(target);
    hint = `Values increase down the plot and from left to right within a row. The ${side} value is in the ${lowest ? "top" : "bottom"} row at the ${lowest ? "left" : "right"} end. Read it with the key.`;
    explanation = [
      scaleNote,
      `The ${side} value is in the ${lowest ? "first" : "last"} row, at its ${lowest ? "first" : "last"} leaf: stem ${stemOf(target)}, leaf ${leafOf(target)}.`,
      `It is ${answer}${unitText}.`,
    ];
    wrong = [
      {
        label: show(lowest ? max : min),
        feedback: `This is the ${other} value. Values increase down the plot and from left to right.`,
      },
      {
        label: misscaled(target),
        feedback: `This ignores the key. ${scaleNote}`,
      },
      {
        label: show(lowest ? values[1]! : values[n - 2]!),
        feedback: `This is the ${lowest ? "second least" : "second greatest"} value, not the ${side}.`,
      },
      {
        label: leafValue(leafOf(target)),
        feedback: `A leaf alone is only the last digit. Include the stem.`,
      },
    ];
    notKey = (v) => v !== target;
  } else if (variant === 2) {
    const range = max - min;
    question = `What is the range of the data?`;
    answer = show(range);
    const leaves = rows.flatMap((x) => x.leaves);
    hint = `The range is the greatest value minus the least value. Read the first leaf of the top row and the last leaf of the bottom row, each with the key.`;
    explanation = [
      scaleNote,
      `The greatest value is ${show(max)} and the least value is ${show(min)}.`,
      `Range = ${show(max)} − ${show(min)} = ${answer}${unitText}.`,
    ];
    wrong = [
      {
        label: show(max),
        feedback: `This is the greatest value. The range subtracts the least value from it.`,
      },
      {
        label: misscaled(range),
        feedback: `This ignores the key. ${scaleNote}`,
      },
      {
        label: leafValue(Math.max(...leaves) - Math.min(...leaves)),
        feedback: `This subtracts leaf digits only. Compare complete values, stem and leaf together.`,
      },
      {
        label: show(max - values[1]!),
        feedback: `This subtracts the second least value. The range uses the least value.`,
      },
    ];
    notKey = (v) => show(v) !== answer;
  } else if (variant === 3) {
    question = `What is the median of the data?`;
    answer = median;
    hint = `There are ${n} values in order from the top of the plot. The median is the middle value${n % 2 ? "" : ", or the mean of the two middle values when the count is even"}. Count leaves, not rows.`;
    explanation = [
      scaleNote,
      n % 2
        ? `There are ${n} values, already in order. The middle value is number ${(n + 1) / 2}: ${answer}.`
        : `There are ${n} values, already in order. The middle values are numbers ${n / 2} and ${n / 2 + 1}: ${show(values[n / 2 - 1]!)} and ${show(values[n / 2]!)}. Their mean is ${answer}.`,
      `The median is ${answer}${unitText}.`,
    ];
    const near = n % 2 ? "one position" : "only one of the two middle values";
    wrong = [
      {
        label: show(n % 2 ? values[(n + 1) / 2]! : values[n / 2 - 1]!),
        feedback:
          n % 2
            ? `This is one position past the middle. With ${n} values the middle is number ${(n + 1) / 2}.`
            : `This is ${near}. With an even count, average the two middle values.`,
      },
      {
        label: show(n % 2 ? values[(n - 3) / 2]! : values[n / 2]!),
        feedback:
          n % 2
            ? `This is one position before the middle. With ${n} values the middle is number ${(n + 1) / 2}.`
            : `This is ${near}. With an even count, average the two middle values.`,
      },
      {
        label: meanText,
        feedback: `This is the mean, found by adding all values and dividing by ${n}. The median is the middle value of the ordered list.`,
      },
      {
        label: plain(
          rows[Math.floor(rows.length / 2)]!.stem * (decimal ? 1 : 10),
          decimal,
        ),
        feedback: `The middle stem is not the middle value. Count the individual leaves, not the rows.`,
      },
      {
        label: plain((min + max) / 2 / unit, decimal),
        feedback: `This is halfway between the least and greatest values. The median is the middle of the ordered list of values.`,
      },
      {
        label: show(values[n % 2 ? (n + 3) / 2 : n / 2 + 1]!),
        feedback: `This is two positions past the middle. Count to the middle position again.`,
      },
    ];
    notKey = (v) => show(v) !== answer;
  } else if (variant === 4) {
    const mode = uniqueMode(values)!;
    const longest = rows.reduce((p, q) =>
      q.leaves.length > p.leaves.length ? q : p,
    );
    question = `Which value appears most often?`;
    answer = show(mode);
    hint = `A value repeats only when both its stem and its leaf match. Look within each row for a leaf that appears more than once.`;
    explanation = [
      scaleNote,
      `Count repeats within each row. Stem ${stemOf(mode)} has leaf ${leafOf(mode)} ${counts(values).get(mode)} times, more than any other value.`,
      `The mode is ${answer}${unitText}.`,
    ];
    wrong = [
      {
        label: leafValue(leafOf(mode)),
        feedback: `This is only the repeated leaf. Combine it with its stem to write the value.`,
      },
      {
        label: plain(longest.stem * (decimal ? 1 : 10), decimal),
        feedback: `The row with the most leaves holds the most values, but its stem alone is not a repeated value.`,
      },
      {
        label: median,
        feedback: `This is the median. The mode is the value that occurs most often.`,
      },
      {
        label: show(max),
        feedback: `This is the greatest value, which need not repeat.`,
      },
    ];
    notKey = (v) => v !== mode;
  } else if (variant === 5) {
    const candidates = [...new Set(values)].filter(
      (v) => v !== min && v !== max,
    );
    const threshold = candidates[r(0, candidates.length - 1)]!;
    const above = values.filter((v) => v > threshold).length;
    const atLeast = values.filter((v) => v >= threshold).length;
    const below = values.filter((v) => v < threshold).length;
    const laterRows = values.filter(
      (v) => stemOf(v) > stemOf(threshold),
    ).length;
    question = `How many values are greater than ${show(threshold)}?`;
    answer = String(above);
    hint = `Find ${show(threshold)} in the plot: stem ${stemOf(threshold)}, leaf ${leafOf(threshold)}. Count the leaves in that row that are larger than leaf ${leafOf(threshold)} (a repeat of ${show(threshold)} is not greater) and every leaf in the rows below it.`;
    explanation = [
      scaleNote,
      `${show(threshold)} is stem ${stemOf(threshold)}, leaf ${leafOf(threshold)}.`,
      `Count leaves greater than it: the larger leaves in the same row (repeats of ${show(threshold)} do not count), and all leaves in later rows. That is ${above} values.`,
    ];
    wrong = [
      {
        label: String(atLeast),
        feedback: `This also counts values equal to ${show(threshold)}. "Greater than" leaves them out.`,
      },
      {
        label: String(below),
        feedback: `This counts values less than ${show(threshold)}, not greater.`,
      },
      {
        label: String(laterRows),
        feedback: `This counts only the rows after stem ${stemOf(threshold)}. Larger leaves in its own row also count.`,
      },
      ...[above + 1, above - 1, above + 2]
        .filter((x) => x >= 0)
        .map((x) => ({
          label: String(x),
          feedback: `Count each qualifying leaf once. Recount the larger leaves in its own row and the leaves in later rows.`,
        })),
    ];
    notKey = (v) => v !== threshold && String(v) !== answer;
  } else {
    const diff = max - values[1]!;
    question = `What is the greatest value minus the second least value?`;
    answer = show(diff);
    hint = `The least value is the first leaf of the top row. The second least is the next value after it. The greatest value is the last leaf of the bottom row.`;
    explanation = [
      scaleNote,
      `The greatest value is ${show(max)}. The second least value is ${show(values[1]!)}.`,
      `${show(max)} − ${show(values[1]!)} = ${answer}${unitText}.`,
    ];
    wrong = [
      {
        label: show(max - min),
        feedback: `This subtracts the least value. The question asks for the second least value.`,
      },
      {
        label: show(max - values[2]!),
        feedback: `This subtracts the third least value. Count in order: the second least is the one after the least.`,
      },
      {
        label: show(values[n - 2]! - values[1]!),
        feedback: `This starts from the second greatest value. The question asks for the greatest.`,
      },
      {
        label: misscaled(diff),
        feedback: `This ignores the key. ${scaleNote}`,
      },
    ];
    notKey = (v) => show(v) !== answer;
  }
  // Near misses fill the choices when the specific misconceptions coincide.
  for (const [step, name] of decimal
    ? ([
        [0.1, "leaf"],
        [-0.1, "leaf"],
        [1, "stem"],
        [-1, "stem"],
      ] as const)
    : ([
        [1, "leaf"],
        [-1, "leaf"],
        [10, "stem"],
        [-10, "stem"],
      ] as const)) {
    const near = Number(answer) + step;
    if (near > 0)
      wrong.push({
        label: plain(near, decimal),
        feedback: `This is off by one ${name}. Read the stem and the leaf again with the key and recount.`,
      });
  }
  const keyChoices = values.filter(notKey);
  const keyValue = (keyChoices.length ? keyChoices : values)[
    r(0, (keyChoices.length ? keyChoices : values).length - 1)
  ]!;
  const draft: Draft = {
    prompt: `The stem-and-leaf plot shows the ${contextText.replace("{n}", String(n))}. ${keyFor(keyValue)} ${question}`,
    answer: "",
    figure,
    hint: `Use the key: stem ${stemOf(keyValue)} with leaf ${leafOf(keyValue)} is ${show(keyValue)}. ${hint}`,
    explanation,
    choices: options(answer, wrong),
  };
  return { variant, decimal, problem: assemble(meta, seed, r, draft) };
}

/* ------------------------------------------------------------------ */
/* Budgets and pay                                                     */
/* ------------------------------------------------------------------ */

export const dollars = (cents: number) =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
const money = (cents: number) => `${dollars(cents)} dollars`;
/** Cents: whole dollars in [lo, hi] plus a small set of cent parts, never 0 cents for every row. */
const amount = (r: Random, lo: number, hi: number) =>
  r(lo, hi) * 100 + [0, 25, 50, 75, 10, 40, 5, 95][r(0, 7)]!;
function moneyFigure(rows: [string, number][]): SemanticFigure {
  return {
    kind: "scene",
    scene: table({
      id: "amounts",
      corner: "Category",
      columns: ["Dollars"],
      rows: rows.map(([label, cents]) => ({ label, cells: [dollars(cents)] })),
    }).scene(),
  };
}
const sumOf = (rows: [string, number][]) => rows.reduce((p, [, c]) => p + c, 0);
const plus = (rows: [string, number][]) =>
  rows.map(([, c]) => dollars(c)).join(" + ");

export function budgetCase(seed: string) {
  checkSeed(seed);
  const meta = byId("budget-category-balance");
  const r = random(meta.id, seed);
  const variant = r(0, 2);
  const known: [string, number][] = [
    ["Rent", amount(r, 280, 520)],
    ["Food", amount(r, 120, 260)],
    ["Transport", amount(r, 40, 130)],
    ["Phone", amount(r, 25, 75)],
  ];
  if (r(0, 1)) known.push(["Savings", amount(r, 50, 140)]);
  const knownTotal = sumOf(known);
  const open = "Fun";
  let draft: Draft;
  if (variant === 0) {
    const missing = amount(r, 30, 160);
    const income = knownTotal + missing;
    const ok = money(missing);
    draft = {
      prompt: `A monthly budget has income of ${money(income)}. The planned expenses are in the table, and the whole income is to be spent. How much can be planned for ${open}?`,
      figure: moneyFigure(known),
      answer: "",
      hint: `Add the ${known.length} listed expenses first. The ${open} amount is what remains of ${money(income)} after that total.`,
      explanation: [
        `Add the listed expenses: ${plus(known)} = ${dollars(knownTotal)}.`,
        `Subtract from the income: ${dollars(income)} − ${dollars(knownTotal)} = ${dollars(missing)}.`,
        `${open} can be ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: money(knownTotal),
          feedback: `This is the total of the listed expenses. Subtract that total from the income to find what is left.`,
        },
        {
          label: money(missing + known[0]![1]),
          feedback: `This leaves out ${known[0]![0]}. Subtract every listed category from the income.`,
        },
        {
          label: money(missing + 1000),
          feedback: `Line up the decimal points and subtract place by place; this is 10 dollars too much.`,
        },
        {
          label: money(missing + 100),
          feedback: `Check the regrouping when you subtract the cents. The planned expenses plus ${open} must equal the income.`,
        },
      ]),
    };
  } else {
    const fun = amount(r, 40, 120);
    const all: [string, number][] = [...known, [open, fun]];
    const total = knownTotal + fun;
    const gap = amount(r, 4, 35);
    if (variant === 1) {
      const deficit = r(0, 1) === 1;
      const income = deficit ? total - gap : total + gap;
      const name = deficit ? "Deficit" : "Surplus";
      const reversed = deficit ? "Surplus" : "Deficit";
      const ok = `${name} of ${money(gap)}`;
      const short = income - (total - known[1]![1]);
      const omitted =
        short >= 0
          ? `Surplus of ${money(short)}`
          : `Deficit of ${money(-short)}`;
      draft = {
        prompt: `A budget has monthly income of ${money(income)} and the planned expenses in the table. Compare the income with the total expenses. What is the result?`,
        figure: moneyFigure(all),
        answer: "",
        hint: `Add all ${all.length} expenses to get the total spending. Then compare ${money(income)} with that total: spending more than the income is a deficit; spending less is a surplus.`,
        explanation: [
          `Total expenses: ${plus(all)} = ${dollars(total)}.`,
          `Income is ${dollars(income)}, which is ${deficit ? "less" : "more"} than the expenses.`,
          `${dollars(Math.max(income, total))} − ${dollars(Math.min(income, total))} = ${dollars(gap)}, so the budget has a ${name.toLowerCase()} of ${money(gap)}.`,
        ],
        choices: options(ok, [
          {
            label: `${reversed} of ${money(gap)}`,
            feedback: `The amount is right, but the name is reversed. A deficit means expenses exceed income; a surplus means income exceeds expenses.`,
          },
          {
            label: omitted,
            feedback: `This leaves out the ${known[1]![0]} expense, which changes the difference. Include every category in the total.`,
          },
          {
            label: `${name} of ${money(gap + 1000)}`,
            feedback: `Subtract with the decimal points aligned; this is 10 dollars off.`,
          },
          {
            label: `${name} of ${money(total)}`,
            feedback: `This is the total of the expenses. The result compares that total with the income.`,
          },
        ]),
      };
    } else {
      const income = total - gap;
      const ok = `Reduce ${open} by ${money(gap)}`;
      draft = {
        prompt: `A budget has monthly income of ${money(income)} and the planned expenses in the table. The budget must balance exactly. Which change works?`,
        figure: moneyFigure(all),
        answer: "",
        hint: `Find the total of the ${all.length} expenses and compare it with ${money(income)}. The change must remove exactly the amount by which expenses exceed income.`,
        explanation: [
          `Total expenses: ${plus(all)} = ${dollars(total)}. Income: ${dollars(income)}.`,
          `Expenses exceed income by ${dollars(total)} − ${dollars(income)} = ${dollars(gap)}.`,
          `${open} is planned at ${dollars(fun)}. Reducing it by ${money(gap)} removes exactly the excess, so the budget balances: ${ok}.`,
        ],
        choices: options(ok, [
          {
            label: `Increase ${open} by ${money(gap)}`,
            feedback: `Increasing an expense makes the deficit larger. To balance, expenses must go down by the deficit.`,
          },
          {
            label: `Reduce ${open} by ${money(gap + 500)}`,
            feedback: `This removes 5 dollars more than needed and leaves a surplus. Reduce by exactly the deficit.`,
          },
          {
            label: `Reduce ${open} by ${money(Math.max(5, Math.round(gap / 10)))}`,
            feedback: `Check the decimal places: the deficit is ${money(gap)}, and this amount is far smaller, so a deficit remains.`,
          },
          {
            label: `Reduce ${open} by ${money(income)}`,
            feedback: `This is the income, not the deficit. Reduce by the amount expenses exceed income.`,
          },
        ]),
      };
    }
  }
  return { variant, problem: assemble(meta, seed, r, draft) };
}

const deductionNames: [string, number, number][] = [
  ["Federal tax", 20, 90],
  ["State tax", 8, 40],
  ["Social Security", 25, 60],
  ["Health plan", 12, 45],
];

export function grossNetCase(seed: string) {
  checkSeed(seed);
  const meta = byId("gross-net-pay");
  const r = random(meta.id, seed);
  const variant = r(0, 4);
  const deductions = deductionNames.map(
    ([name, lo, hi]) => [name, amount(r, lo, hi)] as [string, number],
  );
  const totalDeductions = sumOf(deductions);
  const grossPay = amount(r, 320, 680);
  const netPay = grossPay - totalDeductions;
  const off = (cents: number) => money(cents + 1000);
  let draft: Draft;
  if (variant === 0) {
    const ok = money(netPay);
    draft = {
      prompt: `A pay stub lists gross pay of ${money(grossPay)} and the deductions in the table. What is the net pay?`,
      figure: moneyFigure(deductions),
      answer: "",
      hint: `Net pay is what remains of gross pay after the deductions. Add the ${deductions.length} deductions into one total, then subtract it from ${money(grossPay)}.`,
      explanation: [
        `Total deductions: ${plus(deductions)} = ${dollars(totalDeductions)}.`,
        `Net pay = gross pay − deductions = ${dollars(grossPay)} − ${dollars(totalDeductions)} = ${dollars(netPay)}.`,
        `The net pay is ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: money(grossPay + totalDeductions),
          feedback: `Deductions are taken out of gross pay, so net pay is smaller than gross pay. Subtract the deductions.`,
        },
        {
          label: money(netPay + deductions[3]![1]),
          feedback: `This leaves out the ${deductions[3]![0]} deduction. Every listed deduction comes out of gross pay.`,
        },
        {
          label: money(totalDeductions),
          feedback: `This is the total withheld. Net pay is what remains of gross pay after it.`,
        },
        {
          label: off(netPay),
          feedback: `Line up the decimal points when subtracting; this is 10 dollars too large.`,
        },
      ]),
    };
  } else if (variant === 1) {
    const hours = r(18, 40);
    const rate = r(11, 19) * 100 + [0, 25, 50, 75][r(0, 3)]!;
    const gross = hours * rate;
    const ded = deductions.slice(0, 3);
    const dedTotal = sumOf(ded);
    const net = gross - dedTotal;
    const ok = money(net);
    draft = {
      prompt: `A worker earns ${money(rate)} per hour and worked ${hours} hours this week. The deductions are in the table. What is the net pay?`,
      figure: moneyFigure(ded),
      answer: "",
      hint: `First find gross pay: ${hours} hours at ${money(rate)} each. Then subtract the ${ded.length} deductions to get net pay.`,
      explanation: [
        `Gross pay = ${hours} × ${dollars(rate)} = ${dollars(gross)}.`,
        `Total deductions: ${plus(ded)} = ${dollars(dedTotal)}.`,
        `Net pay = ${dollars(gross)} − ${dollars(dedTotal)} = ${dollars(net)}. The net pay is ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: money(gross),
          feedback: `This is gross pay, the amount earned before deductions. Subtract the deductions.`,
        },
        {
          label: money(net + ded[2]![1]),
          feedback: `This leaves out the ${ded[2]![0]} deduction. Subtract every listed deduction.`,
        },
        {
          label: off(net),
          feedback: `Line up the decimal points when subtracting; this is 10 dollars too large.`,
        },
        {
          label: money(gross + dedTotal),
          feedback: `Deductions reduce pay. Subtract them from gross pay.`,
        },
      ]),
    };
  } else if (variant === 2) {
    const [missName, missAmount] = deductions[1]!;
    const others = deductions.filter((_, i) => i !== 1);
    const othersTotal = sumOf(others);
    const ok = money(missAmount);
    draft = {
      prompt: `A worker's gross pay is ${money(grossPay)} and net pay is ${money(netPay)}. The table shows three of the four deductions. How much was taken out for ${missName}?`,
      figure: moneyFigure(others),
      answer: "",
      hint: `Gross pay minus net pay, ${money(grossPay)} minus ${money(netPay)}, is the total of all the deductions. Subtract the three known deductions from that total.`,
      explanation: [
        `Total deductions = gross pay − net pay = ${dollars(grossPay)} − ${dollars(netPay)} = ${dollars(totalDeductions)}.`,
        `The known deductions total ${dollars(othersTotal)}.`,
        `${missName} = ${dollars(totalDeductions)} − ${dollars(othersTotal)} = ${dollars(missAmount)}. It was ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: money(totalDeductions),
          feedback: `This is the total of all four deductions. Subtract the three known ones to find ${missName}.`,
        },
        {
          label: money(missAmount + others[0]![1]),
          feedback: `This forgets to subtract ${others[0]![0]}. Subtract every known deduction.`,
        },
        {
          label: money(grossPay - othersTotal),
          feedback: `This is gross pay less only the known deductions, which still includes net pay. Start from gross pay minus net pay.`,
        },
        {
          label: off(missAmount),
          feedback: `Line up the decimal points when subtracting; this is 10 dollars too large.`,
        },
      ]),
    };
  } else if (variant === 3) {
    const ok = money(netPay);
    draft = {
      prompt: `A pay stub shows gross pay of ${money(grossPay)} and the deductions in the table. The worker's paycheck is the take-home pay after all deductions. Which amount is the paycheck?`,
      figure: moneyFigure(deductions),
      answer: "",
      hint: `Gross pay is the amount before deductions, and each deduction is one amount withheld. Take-home pay is gross pay, ${money(grossPay)}, minus all ${deductions.length} deductions.`,
      explanation: [
        `Gross pay is ${dollars(grossPay)}. The deductions total ${plus(deductions)} = ${dollars(totalDeductions)}.`,
        `Take-home (net) pay = ${dollars(grossPay)} − ${dollars(totalDeductions)} = ${dollars(netPay)}.`,
        `The paycheck is ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: money(grossPay),
          feedback: `Gross pay is the amount earned before deductions. Take-home pay is smaller.`,
        },
        {
          label: money(totalDeductions),
          feedback: `This is the total withheld, not what the worker keeps.`,
        },
        {
          label: money(deductions[0]![1]),
          feedback: `This is one deduction (${deductions[0]![0]}). Take-home pay is what remains after all of them.`,
        },
      ]),
    };
  } else {
    const ok = money(grossPay);
    draft = {
      prompt: `A worker's net pay is ${money(netPay)} after the deductions in the table. What was the gross pay?`,
      figure: moneyFigure(deductions),
      answer: "",
      hint: `Gross pay is the amount before the deductions were taken out. Add the ${deductions.length} deductions into one total, then add that total to ${money(netPay)}.`,
      explanation: [
        `Total deductions: ${plus(deductions)} = ${dollars(totalDeductions)}.`,
        `Gross pay = net pay + deductions = ${dollars(netPay)} + ${dollars(totalDeductions)} = ${dollars(grossPay)}.`,
        `The gross pay was ${ok}.`,
      ],
      choices: options(ok, [
        {
          label: money(Math.abs(netPay - totalDeductions)),
          feedback: `Deductions were already removed to reach net pay. Add them back to find gross pay.`,
        },
        {
          label: money(grossPay - deductions[2]![1]),
          feedback: `This leaves out the ${deductions[2]![0]} deduction when adding back. Include every deduction.`,
        },
        {
          label: money(totalDeductions),
          feedback: `This is only the total withheld. Gross pay is net pay plus that total.`,
        },
        {
          label: off(grossPay),
          feedback: `Line up the decimal points when adding; this is 10 dollars too large.`,
        },
      ]),
    };
  }
  return { variant, problem: assemble(meta, seed, r, draft) };
}

export function generateRemainingGapProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  switch (templateId) {
    case "triangle-law-reasoning":
      return triangleLawCase(seed).problem;
    case "model-quantity-roles":
      return modelQuantityCase(seed).problem;
    case "stem-leaf-read":
      return stemLeafCase(seed).problem;
    case "budget-category-balance":
      return budgetCase(seed).problem;
    case "gross-net-pay":
      return grossNetCase(seed).problem;
  }
  throw new Error(`Unknown remaining-gap template ${templateId}`);
}
