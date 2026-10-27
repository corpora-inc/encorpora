import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  defineGenerate,
  entry,
  frac,
  grouped,
  inlineSentence,
  multiPartCapability,
  multiPartProblem,
  need,
  pick,
  plain,
  shuffle,
  slotOf,
  type Slot,
} from "./multi-part-support";

/** Other forms of one number or relation, chosen piece by piece
 * (multi-part-choice-v1): a fraction as a decimal and a percent, a decimal as
 * a mixed number, the solution of an inequality, a proportion, the meaning of
 * the parts of an exponential model, and an estimate of $\pi$. */
export const formBlanksTemplates: readonly TemplateMetadata[] = [
  {
    id: "fraction-forms-blanks",
    version: 1,
    title: "A fraction as a decimal and a percent",
    skillId: "percentages",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Write a fraction with denominator 4, 5, 8, 20 or 25 as a decimal and as a percent by choosing both, with place-shift and digit-copy errors as distractors.",
  },
  {
    id: "decimal-mixed-number-blanks",
    version: 1,
    title: "A decimal as a mixed number",
    skillId: "decimal-fractions",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Write a decimal with a whole part and tenths or hundredths as a mixed number by choosing the whole number, the numerator and the denominator of ten or one hundred.",
  },
  {
    id: "inequality-solution-blanks",
    version: 1,
    title: "Solve two inequalities with a negative coefficient",
    skillId: "linear-inequalities",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Choose the solution of each of two inequalities whose coefficient of the variable is negative; distractors keep the sign, flip it with the wrong number, or ignore the constant.",
  },
  {
    id: "conversion-proportion-blanks",
    version: 1,
    title: "Set up a unit conversion proportion",
    skillId: "ratios",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Complete the proportion that converts a number of yards to meters from the conversion factor by choosing each of its four parts from the factor, the amount and the unknown.",
  },
  {
    id: "exponential-parameters-blanks",
    version: 1,
    title: "Read the parts of an exponential model",
    skillId: "exponential-models",
    gradeBand: "9–12",
    ...multiPartCapability,
    description:
      "For $y = a \\cdot b^t$ with a growth or decay factor, choose the initial value, whether the quantity increases or decreases, and the percent rate each period.",
  },
  {
    id: "circle-estimate-blanks",
    version: 1,
    title: "Estimate a circle with 3.14",
    skillId: "circle-measurement",
    gradeBand: "6–8",
    ...multiPartCapability,
    description:
      "Find the area of a circle from its diameter using 3.14, choosing the radius and the area, or choose which measurements to divide to estimate $\\pi$ and the quotient.",
  },
];

/* ---------- a fraction as a decimal and a percent ---------- */
export const fractionFormsAxes = {
  denominator: defineAxis("denominator", [
    "eighths",
    "fifths-and-twentieths",
    "quarters-and-twenty-fifths",
  ] as const),
} as const;
const FRACTIONS: Record<
  (typeof fractionFormsAxes.denominator.values)[number],
  readonly (readonly [number, number])[]
> = {
  eighths: [
    [1, 8],
    [3, 8],
    [5, 8],
    [7, 8],
  ],
  "fifths-and-twentieths": [
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
    [1, 20],
    [3, 20],
    [7, 20],
    [9, 20],
    [11, 20],
    [13, 20],
    [17, 20],
    [19, 20],
  ],
  "quarters-and-twenty-fifths": [
    [1, 4],
    [3, 4],
    [3, 25],
    [7, 25],
    [9, 25],
    [11, 25],
    [12, 25],
    [18, 25],
    [21, 25],
    [24, 25],
  ],
} as const;

/* ---------- a decimal as a mixed number ---------- */
export const mixedNumberAxes = {
  places: defineAxis("places", ["tenths", "hundredths"] as const),
} as const;

/* ---------- inequalities ---------- */
export const inequalityAxes = {
  relations: defineAxis("relations", ["strict", "with-equal"] as const),
} as const;

/* ---------- conversion ---------- */
export const conversionAxes = {
  amount: defineAxis("amount", ["tens", "hundreds"] as const),
} as const;

/* ---------- exponential ---------- */
export const exponentialAxes = {
  direction: defineAxis("direction", ["decay", "growth"] as const),
} as const;
const MODEL_CONTEXTS = [
  ["The value of a machine", "V", "dollars"],
  ["The population of a town", "P", "people"],
  ["The balance of an account", "B", "dollars"],
] as const;

/* ---------- circle ---------- */
export const circleEstimateAxes = {
  ask: defineAxis("ask", ["area-with-3-14", "estimate-pi"] as const),
} as const;

export const formBlanksAxes = {
  "fraction-forms-blanks": fractionFormsAxes,
  "decimal-mixed-number-blanks": mixedNumberAxes,
  "inequality-solution-blanks": inequalityAxes,
  "conversion-proportion-blanks": conversionAxes,
  "exponential-parameters-blanks": exponentialAxes,
  "circle-estimate-blanks": circleEstimateAxes,
} as const;

const rel = { "<": "<", ">": ">", "<=": "\\le", ">=": "\\ge" } as const;
type Rel = keyof typeof rel;
const flip = (r: Rel): Rel =>
  r === "<" ? ">" : r === ">" ? "<" : r === "<=" ? ">=" : "<=";
const dec = (n: number) => plain(Math.round(n * 1e6) / 1e6);
const mn = (n: number) => (n < 0 ? `−${-n}` : String(n));

export const formBlanksGenerate = defineGenerate(formBlanksTemplates, {
  "fraction-forms-blanks": entry(
    fractionFormsAxes,
    ({ meta, seed, r, axes }) => {
      const [n, d] = pick(r, FRACTIONS[axes.denominator]);
      const value = n / d;
      const percent = value * 100;
      const decimalText = dec(value);
      const percentText = `${dec(percent)}%`;
      const built = inlineSentence([
        `$${frac(n, d)}$ is equal to the decimal `,
        slotOf(
          "decimal",
          "The decimal",
          decimalText,
          [value * 10, value / 10, n / 100, 1 - value].map(dec),
        ),
        " and to the percent ",
        {
          id: "percent",
          label: "The percent",
          correct: percentText,
          wrong: [
            `${dec(percent / 10)}%`,
            `${dec(value)}%`,
            `${Math.round(percent)}%`,
            `${dec(percent * 10)}%`,
            `${dec(percent / 100)}%`,
          ],
          max: 4,
        } as Slot,
        ".",
      ]);
      need(
        Math.round(percent) !== percent || Math.round(percent) === percent,
        "a percent",
      );
      return multiPartProblem(meta, seed, r, {
        prompt: `Write $${frac(n, d)}$ as a decimal and as a percent. Complete the sentence.`,
        layout: "inline",
        label: "Choose a decimal and a percent",
        slots: built.slots,
        sentence: built.sentence,
        hint: `Divide the numerator ${n} by the denominator ${d} to get the decimal. A percent is that decimal multiplied by 100, so move the decimal point two places to the right.`,
        explanation: [
          `Divide: $${n}\\div ${d}=${decimalText}$.`,
          `Multiply by 100 to write it as a percent: $${decimalText}\\times 100=${dec(percent)}$, so ${percentText}.`,
          `Check: ${percentText} means ${dec(percent)} out of 100, which is $${frac(n, d)}$ in lowest terms.`,
        ],
      });
    },
  ),

  "decimal-mixed-number-blanks": entry(
    mixedNumberAxes,
    ({ meta, seed, r, axes }) => {
      const whole = r(1, 9);
      const hundredths = axes.places === "hundredths";
      const frac100 = hundredths ? r(1, 99) : r(1, 9);
      need(!hundredths || frac100 % 10 !== 0, "a decimal with two places");
      const den = hundredths ? 100 : 10;
      const text = hundredths
        ? `${whole}.${String(frac100).padStart(2, "0")}`
        : `${whole}.${frac100}`;
      const built = inlineSentence([
        `${text} is the mixed number `,
        slotOf(
          "whole",
          "The whole number",
          whole,
          [whole + 1, frac100, whole - 1, Number(`${whole}${frac100}`)].filter(
            (x) => x > 0,
          ),
        ),
        " and ",
        slotOf(
          "num",
          "The numerator of the fraction",
          frac100,
          [
            whole,
            Number(`${whole}${frac100}`),
            frac100 + 1,
            hundredths ? Math.floor(frac100 / 10) : frac100 + 2,
          ].filter((x) => x > 0),
        ),
        " over ",
        slotOf(
          "den",
          "The denominator of the fraction",
          den,
          [hundredths ? 10 : 100, 1000, frac100, whole],
          4,
        ),
        ".",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `Write ${text} as a mixed number. Complete the sentence.`,
        layout: "inline",
        label: "Choose a number for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `In ${text}, the digits to the left of the decimal point give the whole number. Count the digits to the right of the point: that count tells whether the fraction part is in tenths or hundredths.`,
        explanation: [
          `The whole part is ${whole}.`,
          `The digits after the decimal point are ${hundredths ? `${String(frac100).padStart(2, "0")}, which is ${frac100} ${frac100 === 1 ? "hundredth" : "hundredths"}` : `${frac100}, which is ${frac100} ${frac100 === 1 ? "tenth" : "tenths"}`}, written as $${frac(frac100, den)}$.`,
          `So ${text} $=${whole}\\frac{${frac100}}{${den}}$.`,
        ],
      });
    },
  ),

  "inequality-solution-blanks": entry(
    inequalityAxes,
    ({ meta, seed, r, axes }) => {
      const rels: Rel[] =
        axes.relations === "strict" ? ["<", ">"] : ["<=", ">="];
      const make = () => {
        const a = -r(2, 6);
        const sol = r(-9, 9);
        need(sol !== 0, "a nonzero boundary");
        const b = pick(r, [0, r(1, 9), -r(1, 9)]);
        const c = a * sol + b;
        const op = pick(r, rels);
        const left = `${a}x${b === 0 ? "" : b > 0 ? `+${b}` : `${b}`}`;
        return { a, b, c, sol, op, text: `${left}${rel[op]}${c}` };
      };
      const first = make();
      const second = make();
      need(
        first.text !== second.text && first.op !== second.op,
        "two different inequalities",
      );
      const label = (x: string, op: Rel, v: number) => `$x${rel[op]}${v}$`;
      const slots = [first, second].map((q, i): Slot => {
        const right = flip(q.op);
        return slotOf(
          `q${i + 1}`,
          `The solution of $${q.text}$`,
          label("x", right, q.sol),
          [
            label("x", q.op, q.sol),
            label("x", right, -q.sol),
            label("x", q.op, -q.sol),
            label("x", right, Math.round(q.c / q.a)),
            label("x", right, q.c * -1),
            label("x", right, Math.round(q.c - q.b)),
          ].filter((x) => x !== label("x", right, q.sol)),
          4,
        );
      });
      const tex = (q: typeof first) => q.text;
      return multiPartProblem(meta, seed, r, {
        prompt: `Choose the solution of each inequality: $${tex(first)}$ and $${tex(second)}$.`,
        layout: "slots",
        label: "Choose the solution of each inequality",
        slots,
        hint: `In $${tex(first)}$ the coefficient of $x$ is ${mn(first.a)}, a negative number. Undo the constant first, then divide both sides by ${mn(first.a)}, and think about what dividing by a negative number does to the direction of the inequality.`,
        explanation: [first, second].map((q) => {
          const moved = q.c - q.b;
          return `$${tex(q)}$: ${q.b === 0 ? "" : `${q.b > 0 ? `subtract ${q.b}` : `add ${-q.b}`} on both sides to get $${q.a}x${rel[q.op]}${moved}$, then `}divide both sides by ${mn(q.a)} and reverse the symbol: $x${rel[flip(q.op)]}${q.sol}$.`;
        }),
      });
    },
  ),

  "conversion-proportion-blanks": entry(
    conversionAxes,
    ({ meta, seed, r, axes }) => {
      const factor = pick(r, [0.9, 0.91]);
      const amount = axes.amount === "tens" ? r(2, 9) * 10 : r(2, 9) * 100;
      const bank = shuffle(r, ["1", dec(factor), String(amount), "$x$"]);
      const slots: Slot[] = [
        {
          id: "a",
          label: "The yards in the conversion factor",
          correct: "1",
          fixed: bank,
        },
        {
          id: "b",
          label: "The meters in the conversion factor",
          correct: dec(factor),
          fixed: bank,
        },
        {
          id: "c",
          label: "The yards to convert",
          correct: String(amount),
          fixed: bank,
        },
        { id: "d", label: "The meters to find", correct: "$x$", fixed: bank },
      ];
      const built = inlineSentence([
        "Yards to meters: ",
        slots[0]!,
        " : ",
        slots[1]!,
        " = ",
        slots[2]!,
        " : ",
        slots[3]!,
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `One yard is about ${dec(factor)} meter. The first ratio in the proportion is the conversion factor, yards to meters. Complete the proportion that finds $x$, the number of meters in ${amount} yards.`,
        layout: "inline",
        label: "Choose a number or $x$ for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `A proportion says two ratios are equal. Both ratios compare yards to meters, so yards go on the left of each colon. The conversion factor is 1 yard to ${dec(factor)} meter; the other ratio uses ${amount} yards and the unknown $x$.`,
        explanation: [
          `The conversion factor is the ratio 1 yard : ${dec(factor)} meter.`,
          `The amount to convert is ${amount} yards : $x$ meters, with yards first in both ratios.`,
          `So the proportion is $1 : ${dec(factor)} = ${amount} : x$, and $x = ${dec(factor * amount)}$ meters.`,
        ],
      });
    },
  ),

  "exponential-parameters-blanks": entry(
    exponentialAxes,
    ({ meta, seed, r, axes }) => {
      const [subject, letter, unit] = pick(r, MODEL_CONTEXTS);
      const initial = pick(
        r,
        [200, 250, 400, 500, 800, 1200, 1500, 2400, 5000, 12000],
      );
      const growth = axes.direction === "growth";
      const pct = pick(r, [4, 5, 6, 8, 12, 15, 20, 25]);
      const base = growth ? 1 + pct / 100 : 1 - pct / 100;
      const baseText = dec(base);
      const built = inlineSentence([
        "The starting amount is ",
        slotOf(
          "start",
          "The starting amount",
          initial,
          [
            Number(baseText),
            initial * base,
            initial + pct,
            (initial * pct) / 100,
            pct,
          ].map((x) => Math.round(x * 100) / 100),
        ),
        ` ${unit}. Each year the amount `,
        {
          id: "dir",
          label: "Whether the amount increases or decreases",
          correct: growth ? "increases" : "decreases",
          fixed: ["increases", "decreases"],
        } as Slot,
        " by ",
        slotOf(
          "pct",
          "The percent change each year",
          pct,
          [
            Math.round(base * 100),
            Number(baseText),
            100 - pct,
            pct / 10,
            100 + pct,
          ].map((x) => dec(x)),
        ),
        " percent.",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `${subject} after $t$ years is modeled by $${letter}(t)=${grouped(initial)}(${baseText})^{t}$. Complete the sentence about the model.`,
        layout: "inline",
        label: "Choose a number or word for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `At $t=0$ the base is raised to the power 0, which equals 1, so see what is left. For the yearly change compare the base ${baseText} with 1: is it greater or less, and by how much?`,
        explanation: [
          `At $t=0$: $${letter}(0)=${grouped(initial)}\\times 1=${grouped(initial)}$, so the starting amount is ${grouped(initial)} ${unit}.`,
          `The base is ${baseText}, which is ${growth ? "greater" : "less"} than 1, so the amount ${growth ? "increases" : "decreases"}.`,
          `The base ${baseText} is $1${growth ? "+" : "-"}${dec(pct / 100)}$, so each year the amount ${growth ? "increases" : "decreases"} by ${pct} percent.`,
        ],
      });
    },
  ),

  "circle-estimate-blanks": entry(
    circleEstimateAxes,
    ({ meta, seed, r, axes }) => {
      if (axes.ask === "area-with-3-14") {
        const radius = r(2, 9);
        const diameter = radius * 2;
        const area = Math.round(3.14 * radius * radius * 100) / 100;
        const built = inlineSentence([
          "The radius is ",
          slotOf("radius", "The radius in feet", radius, [
            diameter,
            radius * radius,
            diameter * diameter,
            radius + 2,
          ]),
          " feet, so the area is about ",
          slotOf(
            "area",
            "The area in square feet",
            dec(area),
            [
              3.14 * diameter * diameter,
              3.14 * diameter,
              3.14 * radius * 2,
              3.14 * radius * radius * 2,
            ].map((x) => dec(Math.round(x * 100) / 100)),
          ),
          " square feet.",
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt: `A circular sign is ${diameter} feet across. Use 3.14 for $\\pi$ to estimate its area. Complete the sentence.`,
          layout: "inline",
          label: "Choose a number for each gap",
          slots: built.slots,
          sentence: built.sentence,
          hint: `The ${diameter} feet is the distance across the circle. Halve it to find the radius, then use the area formula $A=\\pi r^2$ with 3.14 in place of $\\pi$.`,
          explanation: [
            `The radius is half the diameter: $${diameter}\\div 2=${radius}$ feet.`,
            `The area is $A=\\pi r^2\\approx 3.14\\times ${radius}^2=3.14\\times ${radius * radius}=${dec(area)}$ square feet.`,
          ],
        });
      }
      const diameter = r(5, 20);
      const circumference = Math.round(3.14 * diameter * 10) / 10;
      const quotient = dec(Math.round((circumference / diameter) * 100) / 100);
      need(quotient.length >= 3, "a decimal quotient");
      const bank = ["circumference", "diameter", "radius"];
      const built = inlineSentence([
        "To estimate $\\pi$, divide the ",
        {
          id: "top",
          label: "The measurement divided",
          correct: "circumference",
          fixed: bank,
        } as Slot,
        " by the ",
        {
          id: "bottom",
          label: "The measurement divided by",
          correct: "diameter",
          fixed: bank,
        } as Slot,
        "; the quotient is about ",
        slotOf(
          "pi",
          "The quotient",
          quotient,
          [
            circumference / (diameter / 2),
            diameter / circumference,
            circumference * diameter,
            circumference - diameter,
          ].map((x) => dec(Math.round(x * 100) / 100)),
        ),
        ".",
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `A circle has a circumference of ${dec(circumference)} centimeters and a diameter of ${diameter} centimeters. Complete the sentence about estimating $\\pi$.`,
        layout: "inline",
        label: "Choose a measurement or a number for each gap",
        slots: built.slots,
        sentence: built.sentence,
        hint: `The number $\\pi$ is the ratio of two lengths of a circle. Use the measurements ${dec(circumference)} and ${diameter}, decide which goes on top, and divide.`,
        explanation: [
          `$\\pi$ is the ratio of the circumference to the diameter: $\\pi=C\\div d$.`,
          `$${dec(circumference)}\\div ${diameter}=${quotient}$, so $\\pi$ is about ${quotient}.`,
        ],
      });
    },
  ),
});
