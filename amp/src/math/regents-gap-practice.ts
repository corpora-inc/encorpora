import type { TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  type Draft,
  type Random,
} from "./distribution-practice";

/**
 * Round-2 problem types for New York Regents (Algebra I, Geometry, Algebra II)
 * released items whose task is not yet practiced. Every template is new and
 * attached to an existing skill; no existing template changes.
 */
export const regentsGapTemplates: readonly TemplateMetadata[] = [
  {
    id: "rg-exponential-base-rate",
    version: 1,
    title: "Read a rate from an exponential base",
    skillId: "exponential-models",
    gradeBand: "9–12",
    difficultyOffset: 0.35,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the percent increase or decrease per period shown by the base of an exponential model, including an exponent that divides the time by a period, or the model for a stated half-life.",
  },
  {
    id: "rg-factor-completely",
    version: 1,
    title: "Factor completely with a common factor or a nonmonic square",
    skillId: "factor-quadratics",
    gradeBand: "9–12",
    difficultyOffset: 0.5,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the complete factorization of a difference of squares whose first term has a coefficient, of a binomial that needs a common factor first, or of a two-variable binomial with a common factor and a difference of squares.",
  },
  {
    id: "rg-polynomial-zeros-forms",
    version: 1,
    title: "Zeros of a nonmonic product or a cubic by grouping",
    skillId: "polynomial-zeros",
    gradeBand: "9–12",
    difficultyOffset: 0.35,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the zeros of a product of a variable and two linear factors with one nonmonic factor, or a zero of an expanded cubic found by factoring by grouping.",
  },
  {
    id: "rg-exponent-monomial-power",
    version: 1,
    title: "Raise a monomial with a coefficient to a power",
    skillId: "exponent-laws",
    gradeBand: "9–12",
    difficultyOffset: 0.3,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the simplified form of a monomial with a coefficient and two variables raised to a power, alone or multiplied by another monomial.",
  },
  {
    id: "rg-rational-exponent-forms",
    version: 1,
    title: "Combine rational exponents and write radical forms",
    skillId: "rational-exponents",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the single power equal to a product of a radical and a rational power with coefficients, the radical form of a fraction with a negative rational exponent, or the value of a numeric fraction raised to a negative rational exponent.",
  },
  {
    id: "rg-polynomial-build",
    version: 1,
    title: "Build or describe a polynomial from its structure",
    skillId: "polynomial-arithmetic",
    gradeBand: "9–12",
    difficultyOffset: -0.05,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the polynomial with a stated degree, number of terms, leading coefficient and constant term, or the statement that gives the degree, leading coefficient and constant term of a polynomial written out of order.",
  },
  {
    id: "rg-solid-density",
    version: 1,
    title: "Volume, density and unit chains",
    skillId: "solid-volume-models",
    gradeBand: "9–12",
    difficultyOffset: 0.45,
    description:
      "Find the weight of a cylindrical log from its diameter, height and density, how many pyramids a mass of clay can make, or the liters of water in a rectangular tank, with stated rounding.",
  },
  {
    id: "rg-quadrilateral-choice",
    version: 1,
    title: "Quadrilateral conditions and trapezoid angles",
    skillId: "parallelogram-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.15,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the fact that makes a parallelogram a rhombus or a rectangle, or find an angle of a trapezoid whose two angles on a leg are given by linear expressions.",
  },
  {
    id: "rg-parallelogram-perpendicular",
    version: 1,
    title: "Angles in a parallelogram with a perpendicular",
    skillId: "parallelogram-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.2,
    description:
      "Find an angle formed by a side of a parallelogram and a perpendicular drawn from a vertex, using the parallelogram's angle relationships and a right triangle.",
  },
  {
    id: "rg-segment-property-choice",
    version: 1,
    title: "Perpendicular bisector and midsegment properties",
    skillId: "triangle-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.15,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the statement that must be true for a point on a perpendicular bisector or for a triangle's midsegment, or use the property with algebraic lengths.",
  },
  {
    id: "rg-isosceles-right-decimal",
    version: 1,
    title: "Isosceles right triangle lengths as decimals",
    skillId: "special-right-triangles",
    gradeBand: "9–12",
    difficultyOffset: 0.2,
    description:
      "Find a leg or the hypotenuse of an isosceles right triangle, or the side of a square from its diagonal, rounded to the nearest tenth.",
  },
  {
    id: "rg-triangle-area-sas",
    version: 1,
    title: "Area from two sides and the included angle",
    skillId: "trigonometric-area",
    gradeBand: "9–12",
    difficultyOffset: 0.35,
    description:
      "Enter the area of a triangle from two sides and the angle between them, acute or obtuse, in a figure or a land story, rounded to the nearest tenth.",
  },
  {
    id: "rg-triangle-third-side-test",
    version: 1,
    title: "Test a third side with the triangle inequality",
    skillId: "triangle-construction",
    gradeBand: "9–12",
    difficultyOffset: 0.1,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the length that could be, or the one that could not be, the third side of a triangle with two stated sides.",
  },
  {
    id: "rg-altitude-segment",
    version: 1,
    title: "Segments made by the altitude to the hypotenuse",
    skillId: "similarity-theorems",
    gradeBand: "9–12",
    difficultyOffset: 0.35,
    description:
      "Find the other segment of the hypotenuse, rounded to the nearest tenth, from a leg of a right triangle and the hypotenuse segment next to it.",
  },
];

type Wrong = { label: string; feedback: string };
type Built = Draft & { variant: string };

function choicesFrom(r: Random, correct: string, wrongs: Wrong[]) {
  const seen = new Set([correct]);
  const pool = wrongs.filter((w) => {
    if (seen.has(w.label)) return false;
    seen.add(w.label);
    return true;
  });
  if (pool.length < 3) throw new Error("Need three distinct wrong choices");
  const chosen: Wrong[] = [];
  while (chosen.length < 3)
    chosen.push(pool.splice(r(0, pool.length - 1), 1)[0]!);
  return [{ label: correct, correct: true as const }, ...chosen];
}
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const tex = (s: string) => `$${s}$`;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** Signed constant for appending to an expression: +5 or -5. */
const sg = (n: number) => (n < 0 ? `-${-n}` : `+${n}`);
/** A coefficient that is dropped when it is 1. */
const co = (n: number) => (n === 1 ? "" : n === -1 ? "-" : String(n));
/** A product of a coefficient and a value, without parentheses. */
const mul = (c: number, v: number) => (c === 1 ? String(v) : `${c}\\cdot ${v}`);
const sign = (r: Random) => (r(0, 1) ? 1 : -1);
const oneDecimal = (v: number) => v.toFixed(1);
/** True when rounding v to `places` decimals is not a near-tie. */
function safeRound(v: number, places: number) {
  const scaled = v * 10 ** places;
  const frac = scaled - Math.floor(scaled);
  return Math.abs(frac - 0.5) > 0.03;
}

/* ---------------------------------------------------------------------- */
/* Exponential base                                                        */
/* ---------------------------------------------------------------------- */

type Ctx = { noun: string; letter: string; unit: [string, string] };
const growthContexts: Ctx[] = [
  { noun: "population of a town", letter: "P", unit: ["year", "years"] },
  {
    noun: "value of a savings account in dollars",
    letter: "V",
    unit: ["year", "years"],
  },
  { noun: "number of app users", letter: "N", unit: ["month", "months"] },
];
const decayContexts: Ctx[] = [
  {
    noun: "value of a delivery van in dollars",
    letter: "V",
    unit: ["year", "years"],
  },
  {
    noun: "mass of a radioactive sample in grams",
    letter: "M",
    unit: ["day", "days"],
  },
  {
    noun: "amount of a medicine in the blood in milligrams",
    letter: "A",
    unit: ["hour", "hours"],
  },
];
const startValues = [800, 1200, 2500, 4000, 6500, 9000];

function exponentialBase(r: Random): Built {
  const variant = (["growth", "decay", "per-period", "half-life"] as const)[
    r(0, 3)
  ]!;
  if (variant === "growth" || variant === "decay") {
    const growth = variant === "growth";
    const ctx = pick(r, growth ? growthContexts : decayContexts);
    const pT = growth ? r(12, 95) : r(20, 300); // tenths of a percent
    const base = ((growth ? 1000 + pT : 1000 - pT) / 1000).toString();
    const pct = String(pT / 10);
    const dir = growth ? "increase" : "decrease";
    const correct = `It ${dir}s by ${pct}% each ${ctx.unit[0]}.`;
    const wrong = (text: string, feedback: string): Wrong => ({
      label: `It ${text} each ${ctx.unit[0]}.`,
      feedback,
    });
    const wrongs: Wrong[] = growth
      ? [
          wrong(
            `increases by ${base}%`,
            "The base 1.0 something is a multiplier, not a percent. Subtract the 1 that stands for the whole amount, then write the rest as a percent.",
          ),
          wrong(
            `increases by ${(1000 + pT) / 10}%`,
            "The multiplier is the whole amount plus the increase. 100% of the amount stays, so the increase is the multiplier minus 1.",
          ),
          wrong(
            `increases by ${pT / 100}%`,
            "Moving the decimal point two places gives the percent: 0.038 is 3.8%, not 0.38%.",
          ),
          wrong(
            `increases by ${pT}%`,
            "Moving the decimal point two places turns 0.038 into 3.8%, not 38%.",
          ),
          wrong(
            `decreases by ${pct}%`,
            "A base greater than 1 multiplies the amount by more than 1, so it grows.",
          ),
        ]
      : [
          wrong(
            `decreases by ${(1000 - pT) / 10}%`,
            "The base is the part that remains. The decrease is what is taken away: 1 minus the base.",
          ),
          wrong(
            `decreases by ${base}%`,
            "The base 0.85 is a multiplier, not a percent. The change is 1 minus the base, written as a percent.",
          ),
          wrong(
            `increases by ${pct}%`,
            "A base less than 1 multiplies the amount by less than 1, so it shrinks.",
          ),
          wrong(
            `decreases by ${pT / 100}%`,
            "Moving the decimal point two places turns 0.15 into 15%, not 0.15%.",
          ),
          wrong(
            `increases by ${(1000 - pT) / 10}%`,
            "The base is less than 1, so the amount shrinks, and the percent that remains is not the percent of change.",
          ),
        ];
    const choices = choicesFrom(r, correct, wrongs);
    const P0 = pick(r, startValues);
    return {
      variant,
      prompt: `The ${ctx.noun} is modeled by ${tex(`${ctx.letter}(t)=${P0}(${base})^{t}`)}, where ${tex("t")} is time in ${ctx.unit[1]}. Which statement describes how it changes each ${ctx.unit[0]}?`,
      answer: "",
      hint: `Each ${ctx.unit[0]} the amount is multiplied by the base. Compare the base ${base} with 1, which stands for 100% of the amount, and write the difference as a percent.`,
      explanation: growth
        ? [
            `The base is ${base}, which is 1 + ${(pT / 1000).toString()}.`,
            `Each ${ctx.unit[0]} the amount is multiplied by ${base}: it keeps 100% and gains ${(pT / 1000).toString()}, which is ${pct}%.`,
            `The ${ctx.noun} increases by ${pct}% each ${ctx.unit[0]}.`,
          ]
        : [
            `The base is ${base}, which is 1 − ${(pT / 1000).toString()}.`,
            `Each ${ctx.unit[0]} the amount is multiplied by ${base}: ${(1000 - pT) / 10}% remains, so ${pct}% is lost.`,
            `The ${ctx.noun} decreases by ${pct}% each ${ctx.unit[0]}.`,
          ],
      choices,
    };
  }
  if (variant === "per-period") {
    const growth = r(0, 1) === 1;
    const p = pick(r, [2, 3, 4, 5, 6, 8, 12, 15, 20]);
    const k = pick(r, [2, 3, 4, 5, 6, 10]);
    const unit = pick(r, [
      ["year", "years"],
      ["day", "days"],
      ["month", "months"],
    ] as const);
    const base = String((growth ? 100 + p : 100 - p) / 100);
    const dir = growth ? "increases" : "decreases";
    const other = growth ? "decreases" : "increases";
    const period = (n: number) => `every ${n} ${unit[1]}`;
    const correct = `It ${dir} by ${p}% ${period(k)}.`;
    const choices = choicesFrom(r, correct, [
      {
        label: `It ${dir} by ${p}% each ${unit[0]}.`,
        feedback: `The exponent is ${tex("t")} divided by ${k}, so the multiplier is applied once per ${k} ${unit[1]}, not once per ${unit[0]}.`,
      },
      {
        label: `It ${dir} by ${p * k}% ${period(k)}.`,
        feedback:
          "The percent is read from the base alone. The exponent sets how often it happens; it does not multiply the percent.",
      },
      {
        label: `It ${other} by ${p}% ${period(k)}.`,
        feedback: growth
          ? "A base greater than 1 makes the amount grow."
          : "A base less than 1 makes the amount shrink.",
      },
      {
        label: `It ${dir} by ${p * k}% each ${unit[0]}.`,
        feedback:
          "Neither the percent nor the time between changes comes from multiplying by the divisor in the exponent.",
      },
    ]);
    const P0 = pick(r, startValues);
    return {
      variant,
      prompt: `A quantity is modeled by ${tex(`Q(t)=${P0}(${base})^{t/${k}}`)}, where ${tex("t")} is time in ${unit[1]}. Which statement is true?`,
      answer: "",
      hint: `Read the percent from the base ${base}. Then use the exponent: ${tex(`t/${k}`)} counts how many groups of ${k} ${unit[1]} have passed, and the multiplier is applied once per group.`,
      explanation: [
        `The base ${base} is ${growth ? "1 + " : "1 − "}${p / 100}, so each time it is applied the quantity changes by ${p}%.`,
        `The exponent ${tex(`t/${k}`)} increases by 1 every ${k} ${unit[1]}, so the multiplier is applied once ${period(k)}.`,
        `The quantity ${dir} by ${p}% ${period(k)}.`,
      ],
      choices,
    };
  }
  // half-life
  const D = pick(r, [200, 400, 500, 800]);
  const h = pick(r, [2, 3, 4, 6, 8]);
  const model = (inner: string, b = "0.5") => `A(t)=${D}(${b})^{${inner}}`;
  const correct = tex(model(`t/${h}`));
  const choices = choicesFrom(r, correct, [
    {
      label: tex(model(`${h}t`)),
      feedback: `That halves the amount ${h} times every hour. The amount should halve once every ${h} hours, so ${tex("t")} is divided by ${h}.`,
    },
    {
      label: tex(model("t")),
      feedback: `That halves the amount every hour, which is a half-life of 1 hour, not ${h} hours.`,
    },
    {
      label: tex(model(`t/${h}`, "2")),
      feedback:
        "A base of 2 doubles the amount. Decay by half uses the base 0.5.",
    },
    {
      label: tex(model(`t-${h}`)),
      feedback:
        `Subtracting from the exponent shifts the curve. The number of half-lives is ${tex("t")} divided by the half-life of ${h} hours.`,
    },
  ]);
  return {
    variant,
    prompt: `A medicine has a half-life of ${h} hours: the amount in the body is cut in half every ${h} hours. A patient takes ${D} mg. Which function models the amount ${tex("A(t)")} in mg remaining ${tex("t")} hours after the dose?`,
    answer: "",
    hint: `Over one half-life the amount is multiplied by 0.5 once. With a half-life of ${h} hours, ask how many half-lives have passed after ${tex("t")} hours.`,
    explanation: [
      `In ${h} hours the amount is multiplied by 0.5 once.`,
      `After ${tex("t")} hours, ${tex(`t/${h}`)} half-lives have passed, so the factor 0.5 is applied ${tex(`t/${h}`)} times.`,
      `The model is ${correct}.`,
    ],
    choices,
  };
}

/* ---------------------------------------------------------------------- */
/* Factor completely                                                       */
/* ---------------------------------------------------------------------- */

function factorCompletely(r: Random): Built {
  const variant = (
    ["nonmonic-squares", "common-then-squares", "two-variable"] as const
  )[r(0, 2)]!;
  if (variant === "nonmonic-squares") {
    const m = r(2, 5);
    let n = r(1, 9);
    // gcd(m, n) = 1 keeps both factors primitive, so the keyed answer is complete.
    while (gcd(m, n) !== 1) n = r(1, 9);
    const expr = `${m * m}x^{2}-${n * n}`;
    const correct = tex(`(${m}x-${n})(${m}x+${n})`);
    return {
      variant,
      prompt: `Which expression is ${tex(expr)} written in factored form?`,
      answer: "",
      hint: `In ${tex(expr)} both terms are perfect squares. Ask what ${tex(`${m * m}x^{2}`)} is the square of and what the number is the square of, then use ${tex("a^{2}-b^{2}=(a-b)(a+b)")}.`,
      explanation: [
        `${tex(`${m * m}x^{2}=(${m}x)^{2}`)} and ${tex(`${n * n}=${n}^{2}`)}, so the expression is a difference of squares.`,
        `Apply ${tex("a^{2}-b^{2}=(a-b)(a+b)")} with ${tex("a")} = ${tex(`${m}x`)} and ${tex("b")} = ${n}.`,
        `${correct}. Multiplying back gives ${tex(expr)}.`,
      ],
      choices: choicesFrom(r, correct, [
        {
          label: tex(`${m * m}(x-${n})(x+${n})`),
          feedback: `Factoring out ${m * m} also changes the squares: ${tex(`${m * m}(x-${n})(x+${n})`)} multiplies out to ${tex(`${m * m}x^{2}-${m * m * n * n}`)}.`,
        },
        {
          label: tex(`(${m}x-${n})^{2}`),
          feedback:
            "A square of a binomial has a middle term. A difference of squares has two different signs and no middle term.",
        },
        {
          label: tex(`(${m}x-${n * n})(${m}x+${n * n})`),
          feedback: `The number ${n * n} is the square of ${n}. Use ${n} in each factor, not ${n * n}.`,
        },
        {
          label: tex(`(${m}x+${n})^{2}`),
          feedback:
            "A perfect square trinomial has a middle term; this expression has none.",
        },
      ]),
    };
  }
  if (variant === "common-then-squares") {
    const k = r(2, 5);
    const n = r(2, 9);
    const expr = `${k}x^{2}-${k * n * n}`;
    const correct = tex(`${k}(x-${n})(x+${n})`);
    return {
      variant,
      prompt: `Which expression is ${tex(expr)} factored completely?`,
      answer: "",
      hint: `In ${tex(expr)}, look for a factor common to both terms and pull it out. Then check whether what remains can be factored again.`,
      explanation: [
        `Both terms have the common factor ${k}: ${tex(expr)} = ${tex(`${k}(x^{2}-${n * n})`)}.`,
        `${tex(`x^{2}-${n * n}`)} is a difference of squares: ${tex(`(x-${n})(x+${n})`)}.`,
        `${correct}.`,
      ],
      choices: choicesFrom(r, correct, [
        {
          label: tex(`${k}(x^{2}-${n * n})`),
          feedback: `Factoring is not complete: ${tex(`x^{2}-${n * n}`)} is still a difference of squares.`,
        },
        {
          label: tex(`${k}(x-${n})^{2}`),
          feedback:
            "A difference of squares factors into one minus and one plus factor, not a repeated factor.",
        },
        {
          label: tex(`(${k}x-${n})(${k}x+${n})`),
          feedback: `Multiplying gives ${tex(`${k * k}x^{2}-${n * n}`)}, not the original. The ${k} must stay outside as a common factor.`,
        },
        {
          label: tex(`${k}(x-${n * n})(x+${n * n})`),
          feedback: `The square root of ${n * n} is ${n}, not ${n * n}.`,
        },
      ]),
    };
  }
  const k = pick(r, [2, 3, 5, 6]);
  const m = r(1, 3);
  let n = r(1, 4);
  // gcd(m, n) = 1 so the greatest common factor is exactly kx and each factor is primitive.
  while (gcd(m, n) !== 1) n = r(1, 4);
  const mx = `${co(m)}x`;
  const ny = `${co(n)}y`;
  const expr = `${k * m * m}x^{3}-${k * n * n}xy^{2}`;
  const correct = tex(`${k}x(${mx}-${ny})(${mx}+${ny})`);
  return {
    variant,
    prompt: `Which expression is ${tex(expr)} factored completely?`,
    answer: "",
    hint: `In ${tex(expr)}, find the greatest common factor of both terms, including the variables, and pull it out first. Then see whether the binomial that remains is a difference of squares.`,
    explanation: [
      `The greatest common factor is ${tex(`${k}x`)}: ${tex(expr)} = ${tex(`${k}x(${co(m * m)}x^{2}-${co(n * n)}y^{2})`)}.`,
      `${tex(`${co(m * m)}x^{2}-${co(n * n)}y^{2}`)} = ${tex(`(${mx})^{2}-(${ny})^{2}`)}, a difference of squares, so it is ${tex(`(${mx}-${ny})(${mx}+${ny})`)}.`,
      `${correct}.`,
    ],
    choices: choicesFrom(r, correct, [
      {
        label: tex(`${k}x(${co(m * m)}x^{2}-${co(n * n)}y^{2})`),
        feedback:
          "Factoring is not complete: the binomial in parentheses is still a difference of squares.",
      },
      {
        label: tex(`${k}x(${mx}-${ny})^{2}`),
        feedback:
          "A difference of squares factors into one minus and one plus factor, not a repeated factor.",
      },
      {
        label: tex(`${k}(${mx}-${ny})(${mx}+${ny})`),
        feedback: `The common factor is ${tex(`${k}x`)}, not only ${k}. Multiplying this out leaves the first term with ${tex("x^{2}")}, not ${tex("x^{3}")}.`,
      },
      {
        label: tex(`x(${co(k * m)}x-${ny})(${co(k * m)}x+${ny})`),
        feedback: `Check by multiplying: the ${tex("y^{2}")} term would be ${tex(`-${n * n}xy^{2}`)}, not ${tex(`-${k * n * n}xy^{2}`)}.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* Polynomial zeros                                                        */
/* ---------------------------------------------------------------------- */

type Rat = [number, number];
const ratVal = ([n, d]: Rat) => n / d;
function ratTex([n, d]: Rat) {
  const g = gcd(n, d) * (d < 0 ? -1 : 1);
  const a = n / g;
  const b = d / g;
  if (b === 1) return String(a);
  return `${a < 0 ? "-" : ""}\\frac{${Math.abs(a)}}{${b}}`;
}
const zeroSet = (zs: Rat[]) =>
  tex(
    [...zs]
      .sort((x, y) => ratVal(x) - ratVal(y))
      .map(ratTex)
      .join(",\\ "),
  );

function polynomialZeros(r: Random): Built {
  const variant = (["variable-times-nonmonic", "grouping"] as const)[r(0, 1)]!;
  if (variant === "variable-times-nonmonic") {
    const a = r(2, 4);
    let p = 0;
    do p = sign(r) * r(1, 7);
    while (gcd(a, p) !== 1);
    let q = 0;
    do q = sign(r) * r(1, 7);
    while (q === p || q * p === a || q * p === -a);
    const factors = ["x", `(${a}x${sg(p)})`, `(x${sg(q)})`];
    // Deterministic shuffle from r.
    for (let i = factors.length - 1; i > 0; i--) {
      const j = r(0, i);
      [factors[i], factors[j]] = [factors[j]!, factors[i]!];
    }
    const zeros: Rat[] = [
      [0, 1],
      [-p, a],
      [-q, 1],
    ];
    const correct = zeroSet(zeros);
    const choices = choicesFrom(r, correct, [
      {
        label: zeroSet([
          [0, 1],
          [p, a],
          [q, 1],
        ]),
        feedback:
          "Each factor equals 0 at the opposite of its constant. The signs in the zeros are the opposite of the signs in the factors.",
      },
      {
        label: zeroSet([
          [-p, a],
          [-q, 1],
        ]),
        feedback:
          `The factor ${tex("x")} by itself is also set equal to 0, which gives the zero 0.`,
      },
      {
        label: zeroSet([
          [0, 1],
          [-p, 1],
          [-q, 1],
        ]),
        feedback: `For ${tex(`${a}x${sg(p)}=0`)}, divide by ${a} after moving the constant; the zero is ${tex(ratTex([-p, a]))}, not ${tex(String(-p))}.`,
      },
      {
        label: zeroSet([
          [0, 1],
          [-a, p],
          [-q, 1],
        ]),
        feedback: `Solving ${tex(`${a}x${sg(p)}=0`)} gives ${tex(`x=${ratTex([-p, a])}`)}: the constant goes over the coefficient, not the coefficient over the constant.`,
      },
    ]);
    const fx = factors.join("");
    return {
      variant,
      prompt: `What are the zeros of ${tex(`f(x)=${fx}`)}?`,
      answer: "",
      hint: `A product is 0 when one of its factors is 0. Set each of the three factors equal to 0 and solve each one, including the factor ${tex(`${a}x${sg(p)}`)}.`,
      explanation: [
        `Set each factor to 0: ${tex("x=0")}, ${tex(`${a}x${sg(p)}=0`)} and ${tex(`x${sg(q)}=0`)}.`,
        `${tex(`${a}x=${-p}`)} gives ${tex(`x=${ratTex([-p, a])}`)}, and ${tex(`x${sg(q)}=0`)} gives ${tex(`x=${-q}`)}.`,
        `The zeros are ${correct}.`,
      ],
      choices,
    };
  }
  // grouping: x^3 + a x^2 - n^2 x - a n^2 = (x + a)(x - n)(x + n)
  let a = 0;
  let n = 0;
  do {
    a = sign(r) * r(1, 6);
    n = r(2, 5);
  } while (Math.abs(a) === n);
  const f = (x: number) => x ** 3 + a * x * x - n * n * x - a * n * n;
  const zeroPool = [-a, n, -n];
  const root = pick(r, zeroPool);
  const candidates = [
    a,
    n * n,
    -n * n,
    a * n,
    a + n,
    a - n,
    -a * n,
    2 * n,
    2 * a,
  ];
  const wrongNumbers = [...new Set(candidates)].filter(
    (c) => f(c) !== 0 && c !== root,
  );
  const reason = (c: number) =>
    c === a
      ? `The factor ${tex(`x${sg(a)}`)} equals 0 at ${tex(String(-a))}, the opposite of ${a}, not at ${a}.`
      : "Substitute the value: the cubic does not equal 0 there.";
  const choices = choicesFrom(
    r,
    String(root),
    wrongNumbers.map((c) => ({ label: String(c), feedback: reason(c) })),
  );
  const poly = polyTex([
    { c: 1, e: 3 },
    { c: a, e: 2 },
    { c: -n * n, e: 1 },
    { c: -a * n * n, e: 0 },
  ]);
  return {
    variant,
    prompt: `Which value is a zero of ${tex(`f(x)=${poly}`)}?`,
    answer: "",
    hint: `In ${tex(`f(x)=${poly}`)}, group the first two terms ${tex(`x^{3}${sg(a)}x^{2}`.replace('+1x','+x'))} and the last two terms ${tex(polyTex([{ c: -n * n, e: 1 }, { c: -a * n * n, e: 0 }]))}, and factor each pair. The two pairs should leave the same binomial factor.`,
    explanation: [
      `Group: ${tex(`x^{2}(x${sg(a)})-${n * n}(x${sg(a)})`)}.`,
      `Factor out the common binomial: ${tex(`(x${sg(a)})(x^{2}-${n * n})`)} = ${tex(`(x${sg(a)})(x-${n})(x+${n})`)}.`,
      `The zeros are ${tex(String(-a))}, ${tex(String(n))} and ${tex(String(-n))}. The choice ${tex(String(root))} is one of them.`,
    ],
    choices,
  };
}

/* ---------------------------------------------------------------------- */
/* Exponent rules                                                          */
/* ---------------------------------------------------------------------- */

type Mono = { c: number; a: number; b: number };
function monoTex({ c, a, b }: Mono) {
  const coef = c === 1 ? "" : c === -1 ? "-" : String(c);
  const part = (v: string, e: number) =>
    e === 0 ? "" : e === 1 ? v : `${v}^{${e}}`;
  const body = `${part("x", a)}${part("y", b)}`;
  return tex(`${coef}${body}` || "1");
}
const monoPlain = ({ c, a, b }: Mono) => monoTex({ c, a, b }).slice(1, -1);

function exponentMonomialPower(r: Random): Built {
  const variant = (["power-of-monomial", "power-then-product"] as const)[
    r(0, 1)
  ]!;
  if (variant === "power-of-monomial") {
    const c = pick(r, [2, 3, 4, 5, -2, -3]);
    const n = pick(r, [2, 3, 4]);
    const a = r(1, 4);
    const b = r(1, 4);
    const base = `(${monoPlain({ c, a, b })})^{${n}}`;
    const correct: Mono = { c: c ** n, a: a * n, b: b * n };
    const choices = choicesFrom(r, monoTex(correct), [
      {
        label: monoTex({ c, a: a * n, b: b * n }),
        feedback: `The power applies to the coefficient too: ${c} is multiplied by itself ${n} times.`,
      },
      {
        label: monoTex({ c: c * n, a: a * n, b: b * n }),
        feedback: `A power is repeated multiplication. ${c} to the power ${n} is ${c} multiplied by itself ${n} times, not ${c} times ${n}.`,
      },
      {
        label: monoTex({ c: c ** n, a: a + n, b: b + n }),
        feedback:
          "When a power is raised to a power, multiply the exponents. Adding is for multiplying like bases.",
      },
      {
        label: monoTex({ c: c ** n, a: a * n, b }),
        feedback:
          "Every factor inside the parentheses gets the outer power, including every variable.",
      },
      {
        label: monoTex({ c: c ** n, a: a * n + 1, b: b * n }),
        feedback:
          "Multiply each exponent by the outer power; nothing is added.",
      },
    ]);
    return {
      variant,
      prompt: `Which expression is equivalent to ${tex(base)}?`,
      answer: "",
      hint: `The outer power ${n} applies to every factor inside the parentheses: the coefficient ${c} and each variable. Raise the coefficient to the power and multiply each exponent by ${n}.`,
      explanation: [
        `The power ${n} applies to every factor: the coefficient ${c} is multiplied by itself ${n} times, and each exponent is multiplied by ${n}.`,
        `The coefficient becomes ${c ** n}, the exponent of ${tex("x")} becomes ${a} × ${n} = ${a * n}, and the exponent of ${tex("y")} becomes ${b} × ${n} = ${b * n}.`,
        `${tex(base)} = ${monoTex(correct)}.`,
      ],
      choices,
    };
  }
  const c = pick(r, [2, 3, 4]);
  const n = pick(r, [2, 3]);
  const a = r(1, 3);
  const d = pick(r, [2, 3, 5, -2, -3]);
  const b = r(1, 3);
  const e = r(1, 3);
  const first = `(${c}x${a === 1 ? "" : `^{${a}}`})^{${n}}`;
  const second = monoPlain({ c: d, a: b, b: e });
  const correct: Mono = { c: c ** n * d, a: a * n + b, b: e };
  const choices = choicesFrom(r, monoTex(correct), [
    {
      label: monoTex({ c: c * d, a: a * n + b, b: e }),
      feedback: `The power ${n} applies to the coefficient ${c} as well: ${c} to the power ${n} is ${c ** n}.`,
    },
    {
      label: monoTex({ c: c ** n * d, a: (a + b) * n, b: e }),
      feedback: `Only the first factor is raised to the power ${n}. The exponent of ${tex("x")} in the second factor is not multiplied.`,
    },
    {
      label: monoTex({ c: c ** n * d, a: a * n * b, b: e }),
      feedback:
        "Exponents are multiplied for a power of a power and added for a product of like bases, not multiplied for both.",
    },
    {
      label: monoTex({ c: c * n * d, a: a * n + b, b: e }),
      feedback: `${c} to the power ${n} is ${c} multiplied by itself ${n} times, not ${c} times ${n}.`,
    },
  ]);
  return {
    variant,
    prompt: `Which expression is equivalent to ${tex(`${first}(${second})`)}?`,
    answer: "",
    hint: `In ${tex(`${first}(${second})`)}, simplify the power ${tex(first)} first, raising the coefficient and multiplying the exponent. Then multiply the two monomials: multiply the coefficients and add the exponents of ${tex("x")}.`,
    explanation: [
      `${tex(first)} = ${monoTex({ c: c ** n, a: a * n, b: 0 })}.`,
      `Multiply by ${tex(second)}: the coefficients give ${c ** n * d}, the exponents of ${tex("x")} add to ${a * n + b}, and ${tex("y")} keeps the exponent ${e}.`,
      `The product is ${monoTex(correct)}.`,
    ],
    choices,
  };
}

/* ---------------------------------------------------------------------- */
/* Rational exponents                                                      */
/* ---------------------------------------------------------------------- */

const fracTex = (n: number, d: number) => {
  const g = gcd(n, d);
  const a = n / g;
  const b = d / g;
  return b === 1 ? String(a) : `\\frac{${a}}{${b}}`;
};
const powerTex = (c: number, n: number, d: number) =>
  `${co(c)}x^{${fracTex(n, d)}}`;
const radicalTex = (inside: string, index: number) =>
  index === 2 ? `\\sqrt{${inside}}` : `\\sqrt[${index}]{${inside}}`;

function rationalExponentForms(r: Random): Built {
  const variant = (
    ["combine", "negative-fraction-radical", "negative-fraction-value"] as const
  )[r(0, 2)]!;
  if (variant === "combine") {
    const pairs: [[number, number], [number, number]][] = [
      [
        [1, 3],
        [1, 2],
      ],
      [
        [1, 3],
        [3, 2],
      ],
      [
        [1, 4],
        [1, 2],
      ],
      [
        [1, 4],
        [2, 3],
      ],
      [
        [1, 2],
        [2, 3],
      ],
      [
        [1, 3],
        [1, 4],
      ],
    ];
    const [[a1, b1], [a2, b2]] = pick(r, pairs);
    const c1 = r(2, 6);
    let c2 = r(2, 6);
    if (c2 === c1) c2 = c1 === 6 ? 2 : c1 + 1;
    const sumN = a1 * b2 + a2 * b1;
    const sumD = b1 * b2;
    const radical =
      a1 === 1 ? radicalTex("x", b1) : radicalTex(`x^{${a1}}`, b1);
    const prompt = `Which expression is equivalent to ${tex(`${c1}${radical}\\cdot ${c2}x^{${fracTex(a2, b2)}}`)}, for ${tex("x>0")}?`;
    const correct = tex(powerTex(c1 * c2, sumN, sumD));
    return {
      variant,
      prompt,
      answer: "",
      hint: `Write the radical ${tex(radical)} as a power with a fractional exponent. Then multiply the coefficients ${c1} and ${c2} and add the exponents of ${tex("x")}, using a common denominator.`,
      explanation: [
        `${tex(radical)} = ${tex(`x^{${fracTex(a1, b1)}}`)}, so the product is ${tex(`${c1 * c2}x^{${fracTex(a1, b1)}}\\cdot x^{${fracTex(a2, b2)}}`)}.`,
        `Multiply the coefficients: ${c1} times ${c2} is ${c1 * c2}. Add the exponents: ${tex(`${fracTex(a1, b1)}+${fracTex(a2, b2)}=${fracTex(sumN, sumD)}`)}.`,
        `The product is ${correct}.`,
      ],
      choices: choicesFrom(r, correct, [
        {
          label: tex(powerTex(c1 * c2, a1 + a2, b1 + b2)),
          feedback:
            "Fractions are not added by adding numerators and denominators. Use a common denominator first.",
        },
        {
          label: tex(powerTex(c1 * c2, a1 * a2, b1 * b2)),
          feedback:
            "When multiplying powers with the same base, add the exponents. Multiplying exponents is for a power of a power.",
        },
        {
          label: tex(powerTex(c1 + c2, sumN, sumD)),
          feedback:
            "Coefficients are multiplied, not added, when the terms are multiplied.",
        },
        {
          label: tex(powerTex(c1 * c2, Math.abs(a1 * b2 - a2 * b1), sumD)),
          feedback: "The exponents are added, not subtracted.",
        },
      ]),
    };
  }
  if (variant === "negative-fraction-radical") {
    const [p, q] = pick(r, [
      [3, 2],
      [5, 2],
      [2, 3],
      [4, 3],
      [5, 3],
    ] as const);
    const given = tex(`\\left(\\frac{x}{y}\\right)^{-\\frac{${p}}{${q}}}`);
    const flipped = `\\left(\\frac{y}{x}\\right)^{${p}}`;
    const straight = `\\left(\\frac{x}{y}\\right)^{${p}}`;
    const correct = tex(radicalTex(flipped, q));
    return {
      variant,
      prompt: `Which expression is ${given}, for ${tex("x>0")} and ${tex("y>0")}, written in radical form?`,
      answer: "",
      hint: `A negative exponent means the reciprocal of the base. In the fractional exponent ${tex(`\\frac{${p}}{${q}}`)} the denominator ${q} is the index of the root and the numerator ${p} is the power.`,
      explanation: [
        `A negative exponent takes the reciprocal: ${tex(`\\left(\\frac{x}{y}\\right)^{-\\frac{${p}}{${q}}}=\\left(\\frac{y}{x}\\right)^{\\frac{${p}}{${q}}}`)}.`,
        `In ${tex(`z^{\\frac{${p}}{${q}}}`)} the denominator ${q} is the index of the root and the numerator ${p} is the power.`,
        `The radical form is ${correct}.`,
      ],
      choices: choicesFrom(r, correct, [
        {
          label: tex(radicalTex(straight, q)),
          feedback:
            "The negative sign in the exponent means the reciprocal. The fraction must be flipped.",
        },
        {
          label: tex(`-${radicalTex(straight, q)}`),
          feedback:
            "A negative exponent does not make the value negative. It takes the reciprocal.",
        },
        {
          label: tex(radicalTex(`\\left(\\frac{y}{x}\\right)^{${q}}`, p)),
          feedback:
            "The denominator of the exponent is the index of the root and the numerator is the power, not the other way around.",
        },
        {
          label: tex(`\\frac{1}{${radicalTex("x", q)}}`),
          feedback:
            "The exponent applies to the whole fraction, and the power is the numerator of the exponent.",
        },
      ]),
    };
  }
  const [q, p] = pick(r, [
    [2, 3],
    [3, 2],
    [3, 4],
  ] as const);
  const m = pick(r, [2, 3]);
  let n = pick(r, [3, 4, 5]);
  if (n === m) n += 2;
  const top = m ** q;
  const bottom = n ** q;
  const value = `\\frac{${n ** p}}{${m ** p}}`;
  const given = tex(
    `\\left(\\frac{${top}}{${bottom}}\\right)^{-\\frac{${p}}{${q}}}`,
  );
  return {
    variant,
    prompt: `What is the value of ${given}?`,
    answer: "",
    hint: `A negative exponent means the reciprocal. Take the ${q === 2 ? "square" : q === 3 ? "cube" : q + "th"} root of the numerator and denominator, then apply the power ${p}.`,
    explanation: [
      `Take the reciprocal: ${tex(`\\left(\\frac{${bottom}}{${top}}\\right)^{\\frac{${p}}{${q}}}`)}.`,
      `The root of each part is ${n} over ${m}; then the power ${p} gives ${tex(`\\left(\\frac{${n}}{${m}}\\right)^{${p}}`)}.`,
      `The value is ${tex(value)}.`,
    ],
    choices: choicesFrom(r, tex(value), [
      {
        label: tex(`\\frac{${m ** p}}{${n ** p}}`),
        feedback:
          "The negative exponent means the reciprocal, so the larger number goes on top.",
      },
      {
        label: tex(`-\\frac{${m ** p}}{${n ** p}}`),
        feedback: "A negative exponent does not make the value negative.",
      },
      {
        label: tex(`\\frac{${n * p}}{${m * p}}`),
        feedback: `The power ${p} is repeated multiplication of the fraction, not multiplication of the numerator and denominator by ${p}.`,
      },
      {
        label: tex(`\\frac{${n ** q}}{${m ** q}}`),
        feedback: `The ${q} in the exponent's denominator is the index of the root, not the power.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* Polynomial structure                                                    */
/* ---------------------------------------------------------------------- */

type Term = { c: number; e: number };
function polyTex(terms: Term[], standard = true) {
  const sorted = standard ? [...terms].sort((x, y) => y.e - x.e) : terms;
  return sorted
    .map(({ c, e }, i) => {
      const abs = Math.abs(c);
      const body =
        e === 0
          ? String(abs)
          : `${abs === 1 ? "" : abs}x${e === 1 ? "" : `^{${e}}`}`;
      return i === 0
        ? `${c < 0 ? "-" : ""}${body}`
        : `${c < 0 ? "-" : "+"}${body}`;
    })
    .join("");
}
const termWords = ["", "", "binomial", "trinomial", "four-term polynomial"];

function polynomialBuild(r: Random): Built {
  const variant = (["build", "describe"] as const)[r(0, 1)]!;
  const d = r(3, 5);
  const t = r(2, 4);
  const lead = sign(r) * r(2, 6);
  let konst = 0;
  do konst = sign(r) * r(1, 9);
  while (konst === lead);
  const free = Array.from({ length: d - 1 }, (_, i) => i + 1);
  const midExps: number[] = [];
  while (midExps.length < t - 2)
    midExps.push(free.splice(r(0, free.length - 1), 1)[0]!);
  const mids: Term[] = midExps.map((e) => ({ c: sign(r) * r(1, 9), e }));
  const make = (leadC: number, deg: number, constC: number, extra: Term[]) => [
    { c: leadC, e: deg },
    ...extra,
    { c: constC, e: 0 },
  ];
  const poly = make(lead, d, konst, mids);
  if (variant === "build") {
    const correct = tex(polyTex(poly));
    const unused = free; // exponents not used by middle terms
    const wrongs: Wrong[] = [
      {
        label: tex(polyTex(make(lead, d + 1, konst, mids))),
        feedback: `The degree is the highest exponent. This polynomial has degree ${d + 1}, not ${d}.`,
      },
      {
        label: tex(polyTex(make(konst, d, lead, mids))),
        feedback:
          "The leading coefficient belongs to the term with the highest exponent, and the constant term has no variable. Here they are swapped.",
      },
      {
        label: tex(polyTex(make(lead, d, -konst, mids))),
        feedback: "The constant term must be the stated number, with its sign.",
      },
      {
        label: tex(polyTex(make(-lead, d, konst, mids))),
        feedback:
          "The leading coefficient must be the stated number, with its sign.",
      },
    ];
    if (unused.length)
      wrongs.push({
        label: tex(
          polyTex(make(lead, d, konst, [...mids, { c: 3, e: unused[0]! }])),
        ),
        feedback: `It must have exactly ${t} terms. This one has ${t + 1}.`,
      });
    if (mids.length)
      wrongs.push({
        label: tex(polyTex(make(lead, d, konst, mids.slice(1)))),
        feedback: `It must have exactly ${t} terms. This one has ${t - 1}.`,
      });
    return {
      variant,
      prompt: `Which polynomial is a ${termWords[t]} of degree ${d} with a leading coefficient of ${tex(String(lead))} and a constant term of ${tex(String(konst))}?`,
      answer: "",
      hint: `Check one property at a time. Degree ${d} means the highest exponent is ${d}, the leading coefficient ${lead} multiplies that term, the constant term ${konst} has no variable, and a ${termWords[t]} has ${t} terms added.`,
      explanation: [
        `Degree ${d} means the highest exponent is ${d}, and the leading coefficient ${lead} multiplies ${tex(`x^{${d}}`)}.`,
        `The constant term is ${konst}. A ${termWords[t]} has ${t} terms, so ${t - 2} more ${t - 2 === 1 ? "term sits" : "terms sit"} between them${t === 2 ? "" : ", each with an exponent below " + d}.`,
        `${correct} has all four properties.`,
      ],
      choices: choicesFrom(r, correct, wrongs),
    };
  }
  // describe: show the terms out of order, with the leading term not first
  const shuffled = [...poly];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = r(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  if (shuffled[0]!.e === d)
    [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
  const written = polyTex(shuffled, false);
  const first = shuffled[0]!.c;
  const last = shuffled[shuffled.length - 1]!.c;
  const say = (deg: number, l: number, k: number) =>
    `Degree ${deg}, leading coefficient ${l}, constant term ${k}`;
  const correct = say(d, lead, konst);
  return {
    variant,
    prompt: `The polynomial ${tex(`P(x)=${written}`)} is written out of order. Which statement is true?`,
    answer: "",
    hint: `Rewrite ${tex(`P(x)=${written}`)} with the terms from the highest exponent to the lowest. The first term then shows the degree and leading coefficient, and the term without a variable is the constant term.`,
    explanation: [
      `In standard form the terms run from the highest exponent down: ${tex(`P(x)=${polyTex(poly)}`)}.`,
      `The highest exponent is ${d}, so the degree is ${d} and the leading coefficient is ${lead}.`,
      `The term with no variable is ${konst}, so the constant term is ${konst}. ${correct}.`,
    ],
    choices: choicesFrom(r, correct, [
      {
        label: say(d, first, konst),
        feedback:
          "The leading coefficient belongs to the term with the highest exponent, not the first term written.",
      },
      {
        label: say(t, lead, konst),
        feedback:
          "The degree is the highest exponent, not the number of terms.",
      },
      {
        label: say(d, lead, last),
        feedback:
          "The constant term is the term with no variable, not the last term written.",
      },
      {
        label: say(d, -lead, konst),
        feedback: "Keep the sign of the leading coefficient.",
      },
      {
        label: say(d, lead, -konst),
        feedback: "Keep the sign of the constant term.",
      },
      {
        label: say(d - 1, lead, konst),
        feedback: "The degree is the highest exponent that appears.",
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* Volume, density and unit chains                                         */
/* ---------------------------------------------------------------------- */

const trimNum = (v: number) => String(Math.round(v * 1000) / 1000);

function solidDensity(r: Random): Built {
  const variant = (["log-weight", "clay-pyramids", "tank-liters"] as const)[
    r(0, 2)
  ]!;
  if (variant === "log-weight") {
    for (;;) {
      const d = 2 * r(6, 15); // diameter in inches
      const h = r(6, 14); // height in feet
      const rho = r(35, 60);
      const radiusFt = d / 24;
      const volume = Math.PI * radiusFt * radiusFt * h;
      const weight = volume * rho;
      if (!safeRound(weight, 0)) continue;
      const answer = String(Math.round(weight));
      const radiusText = fracTex(d, 24);
      return {
        variant,
        prompt: `A log is shaped like a cylinder with a diameter of ${d} inches and a height of ${h} feet. The wood weighs ${rho} pounds per cubic foot. Use a calculator and the ${tex("\\pi")} key. To the nearest pound, how much does the log weigh?`,
        answer,
        hint: `The density of ${rho} pounds is per cubic foot, so find the volume in cubic feet. Halve the ${d}-inch diameter to get the radius, and change inches to feet before using ${tex("V=\\pi r^{2}h")}.`,
        explanation: [
          `The radius is ${d} ÷ 2 = ${d / 2} inches, which is ${tex(radiusText)} foot.`,
          `The volume is ${tex(`V=\\pi r^{2}h`)} = ${tex(`\\pi\\left(${radiusText}\\right)^{2}(${h})`)} ≈ ${trimNum(volume)} cubic feet.`,
          `Multiply by the density: ${trimNum(volume)} × ${rho} ≈ ${trimNum(weight)}, which rounds to ${answer} pounds.`,
        ],
      };
    }
  }
  if (variant === "clay-pyramids") {
    for (;;) {
      const mass = pick(r, [20, 25, 30, 40, 45, 50, 60, 75]); // kilograms
      const dT = pick(r, [16, 18, 20, 22, 24]); // tenths of g/cm^3
      const s = pick(r, [6, 8, 10, 12]);
      const h = pick(r, [6, 9, 12, 15]);
      const volume = (s * s * h) / 3;
      const exact = (mass * 10000) / (dT * volume);
      const part = exact % 1;
      if (part < 0.55 || part > 0.95 || exact < 3) continue;
      const answer = String(Math.floor(exact));
      const rho = dT / 10;
      return {
        variant,
        prompt: `A sculptor has ${mass} kilograms of clay. The clay has a density of ${rho} grams per cubic centimeter. Each pyramid has a square base with side ${s} centimeters and a height of ${h} centimeters. How many whole pyramids can be made?`,
        answer,
        hint: `Find the mass of one pyramid in grams: its volume, with base side ${s} centimeters and height ${h} centimeters, times the density of ${rho} grams per cubic centimeter. Change the ${mass} kilograms of clay to grams, then ask how many pyramid masses fit, and decide what to do with a leftover part.`,
        explanation: [
          `One pyramid has volume ${tex(`\\frac{1}{3}(${s})^{2}(${h})`)} = ${volume} cubic centimeters and mass ${volume} × ${rho} = ${trimNum(volume * rho)} grams.`,
          `The clay is ${mass} kilograms = ${mass * 1000} grams, and ${mass * 1000} ÷ ${trimNum(volume * rho)} ≈ ${trimNum(exact)}.`,
          `Only whole pyramids can be made, so round down: ${answer}.`,
        ],
      };
    }
  }
  const len = pick(r, [30, 40, 45, 50, 60, 70, 80]);
  const wid = pick(r, [20, 25, 30, 35, 40, 50]);
  const high = pick(r, [30, 35, 40, 45, 50]);
  const gap = pick(r, [4, 5, 6, 8, 10]);
  const depth = high - gap;
  const cm3 = len * wid * depth;
  const answer = String(cm3 / 1000);
  return {
    variant,
    prompt: `A rectangular tank is ${len} centimeters long, ${wid} centimeters wide and ${high} centimeters high. Water fills the tank to a level ${gap} centimeters below the top. How many liters of water are in the tank?`,
    answer,
    hint: `The water forms a rectangular prism with the ${len} by ${wid} centimeter base of the tank, so first find the depth of the water below the ${high}-centimeter top edge. One liter is 1000 cubic centimeters.`,
    explanation: [
      `The water is ${high} − ${gap} = ${depth} centimeters deep.`,
      `Its volume is ${len} × ${wid} × ${depth} = ${cm3} cubic centimeters.`,
      `Since 1 liter is 1000 cubic centimeters, ${cm3} ÷ 1000 = ${answer} liters.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Quadrilaterals                                                          */
/* ---------------------------------------------------------------------- */

const quadNames = ["ABCD", "PQRS", "JKLM", "WXYZ"];

function quadrilateralChoice(r: Random): Built {
  const variant = (["rhombus", "rectangle", "trapezoid-leg"] as const)[
    r(0, 2)
  ]!;
  if (variant === "rhombus" || variant === "rectangle") {
    const name = pick(r, quadNames);
    const rhombus = variant === "rhombus";
    const good: Wrong[] = rhombus
      ? [
          { label: "Its diagonals are perpendicular.", feedback: "" },
          { label: "Two consecutive sides are congruent.", feedback: "" },
          {
            label: "A diagonal bisects a pair of opposite angles.",
            feedback: "",
          },
        ]
      : [
          { label: "Its diagonals are congruent.", feedback: "" },
          { label: "One of its angles is a right angle.", feedback: "" },
        ];
    const always =
      "That is true of every parallelogram, so it does not single out this shape.";
    const bad: Wrong[] = rhombus
      ? [
          {
            label: "Its diagonals are congruent.",
            feedback:
              "Congruent diagonals make a parallelogram a rectangle, not necessarily a rhombus.",
          },
          {
            label: "One of its angles is a right angle.",
            feedback:
              "A right angle makes a parallelogram a rectangle. A rectangle need not have equal sides.",
          },
          { label: "Its opposite sides are congruent.", feedback: always },
          { label: "Its opposite angles are congruent.", feedback: always },
          { label: "Its diagonals bisect each other.", feedback: always },
        ]
      : [
          {
            label: "Its diagonals are perpendicular.",
            feedback:
              "Perpendicular diagonals make a parallelogram a rhombus, not necessarily a rectangle.",
          },
          {
            label: "Two consecutive sides are congruent.",
            feedback:
              "Equal consecutive sides make a parallelogram a rhombus, not necessarily a rectangle.",
          },
          { label: "Its opposite sides are congruent.", feedback: always },
          { label: "Its opposite angles are congruent.", feedback: always },
          { label: "Its diagonals bisect each other.", feedback: always },
        ];
    const right = pick(r, good);
    const choices = choicesFrom(r, right.label, bad);
    const shape = rhombus ? "rhombus" : "rectangle";
    return {
      variant,
      prompt: `Quadrilateral ${tex(name)} is a parallelogram. Which additional fact is enough to prove that ${tex(name)} is a ${shape}?`,
      answer: "",
      hint: rhombus
        ? `Parallelogram ${tex(name)} is a rhombus when all four sides are equal. Test each fact: does it make the sides equal, or is it already true of every parallelogram?`
        : `Parallelogram ${tex(name)} is a rectangle when it has four right angles. Test each fact: does it force a right angle, or is it already true of every parallelogram?`,
      explanation: [
        rhombus
          ? "Opposite sides, opposite angles and the bisecting diagonals belong to every parallelogram, so they cannot prove a rhombus."
          : "Opposite sides, opposite angles and the bisecting diagonals belong to every parallelogram, so they cannot prove a rectangle.",
        rhombus
          ? "Congruent diagonals or a right angle make a rectangle. Perpendicular diagonals, equal consecutive sides, or a diagonal bisecting an angle force all four sides to be equal."
          : "Perpendicular diagonals or equal consecutive sides make a rhombus. Congruent diagonals or one right angle force all four angles to be right angles.",
        `The fact that proves it is: ${right.label.toLowerCase()}`,
      ],
      choices,
    };
  }
  // trapezoid-leg: angles on one leg are supplementary
  for (;;) {
    const x = r(8, 30);
    const a = r(2, 5);
    const c = r(1, 4);
    const A = r(55, 125);
    const b = A - a * x;
    const D = 180 - A;
    const dd = D - c * x;
    if (Math.abs(b) > 40 || Math.abs(dd) > 40 || A === 90 || a === c) continue;
    const askA = r(0, 1) === 1;
    const ans = askA ? A : D;
    const mk = (v: number) => `${v}°`;
    const equalX = (dd - b) / (a - c);
    const pool: Wrong[] = [
      {
        label: mk(askA ? D : A),
        feedback:
          `That is the other angle. Solve for ${tex("x")}, then substitute into the angle that was asked for.`,
      },
      {
        label: mk(x),
        feedback:
          `That is the value of ${tex("x")}. The question asks for the angle measure.`,
      },
    ];
    if (Number.isInteger(equalX) && equalX > 0)
      pool.push({
        label: mk(askA ? a * equalX + b : c * equalX + dd),
        feedback:
          "The two angles on a leg are supplementary, not equal. Set their sum equal to 180.",
      });
    const sum90 = (90 - b - dd) / (a + c);
    if (Number.isInteger(sum90) && sum90 > 0)
      pool.push({
        label: mk(askA ? a * sum90 + b : c * sum90 + dd),
        feedback: "Angles on one leg add to 180°, not 90°.",
      });
    const sum360 = (360 - b - dd) / (a + c);
    if (Number.isInteger(sum360) && sum360 > 0)
      pool.push({
        label: mk(askA ? a * sum360 + b : c * sum360 + dd),
        feedback: "Angles on one leg of a trapezoid add to 180°, not 360°.",
      });
    const correct = mk(ans);
    let choices;
    try {
      choices = choicesFrom(r, correct, pool);
    } catch {
      continue;
    }
    const exprA = `${co(a)}x${sg(b)}`;
    const exprD = `${co(c)}x${sg(dd)}`;
    return {
      variant,
      prompt: `In trapezoid ${tex("ABCD")}, ${tex("\\overline{AB}\\parallel\\overline{DC}")}. The angles ${tex("\\angle A")} and ${tex("\\angle D")} lie on leg ${tex("\\overline{AD}")}, with ${tex(`m\\angle A=(${exprA})^\\circ`)} and ${tex(`m\\angle D=(${exprD})^\\circ`)}. What is ${tex(`m\\angle ${askA ? "A" : "D"}`)}?`,
      answer: "",
      hint: `${tex("\\overline{AB}")} and ${tex("\\overline{DC}")} are parallel and ${tex("\\overline{AD}")} crosses both, so the angles ${tex(`(${exprA})^\\circ`)} and ${tex(`(${exprD})^\\circ`)} are on the same side of that transversal. Write an equation from how such angles are related, solve for ${tex("x")}, then evaluate.`,
      explanation: [
        `Angles on the same side of a transversal between parallel lines are supplementary: ${tex(`(${exprA})+(${exprD})=180`)}.`,
        `Combine: ${tex(`${co(a + c)}x${sg(b + dd)}=180`)}, so ${tex(`${co(a + c)}x=${180 - b - dd}`)} and ${tex(`x=${x}`)}.`,
        `${tex(`m\\angle ${askA ? "A" : "D"}=${askA ? exprA : exprD}`)} with ${tex(`x=${x}`)} is ${correct}.`,
      ],
      choices,
    };
  }
}

function parallelogramPerpendicular(r: Random): Built {
  const variant = (["obtuse-outside", "acute-inside", "obtuse-at-D"] as const)[
    r(0, 2)
  ]!;
  if (variant === "obtuse-outside") {
    const B = r(100, 155);
    const adjacent = 180 - B;
    const ans = 90 - adjacent;
    return {
      variant,
      prompt: `In parallelogram ${tex("ABCD")}, ${tex(`m\\angle ABC=${B}^\\circ`)}. Point ${tex("E")} is on line ${tex("BC")} so that ${tex("B")} is between ${tex("E")} and ${tex("C")}, and ${tex("\\overline{AE}\\perp\\overline{BC}")}. What is ${tex("m\\angle BAE")} in degrees?`,
      answer: String(ans),
      hint: `With ${tex(`m\\angle ABC=${B}^\\circ`)}, the angles ${tex("\\angle ABC")} and ${tex("\\angle ABE")} are on the straight line ${tex("EBC")}. Find ${tex("\\angle ABE")}, then use the right angle at ${tex("E")} in triangle ${tex("ABE")}.`,
      explanation: [
        `${tex("E")}, ${tex("B")} and ${tex("C")} are on one line, so ${tex("\\angle ABE")} and ${tex("\\angle ABC")} are supplementary: ${tex(`m\\angle ABE=180-${B}=${adjacent}`)}.`,
        `Triangle ${tex("ABE")} has a right angle at ${tex("E")}, so its other two angles add to 90.`,
        `${tex(`m\\angle BAE=90-${adjacent}=${ans}`)}.`,
      ],
    };
  }
  if (variant === "acute-inside") {
    const B = r(40, 80);
    const ans = 90 - B;
    return {
      variant,
      prompt: `In parallelogram ${tex("ABCD")}, ${tex(`m\\angle ABC=${B}^\\circ`)}. Point ${tex("E")} is on side ${tex("BC")} with ${tex("\\overline{AE}\\perp\\overline{BC}")}. What is ${tex("m\\angle BAE")} in degrees?`,
      answer: String(ans),
      hint: `With ${tex(`m\\angle ABC=${B}^\\circ`)}, look at triangle ${tex("ABE")}. It has a right angle at ${tex("E")} and an angle at ${tex("B")}. Remember that the angles of a triangle add to 180.`,
      explanation: [
        `${tex("E")} is on side ${tex("BC")}, so ${tex("\\angle ABE")} is the same angle as ${tex("\\angle ABC")}: ${B} degrees.`,
        `Triangle ${tex("ABE")} has a right angle at ${tex("E")}, so its other two angles add to 90.`,
        `${tex(`m\\angle BAE=90-${B}=${ans}`)}.`,
      ],
    };
  }
  const D = r(100, 155);
  const adjacent = 180 - D;
  const ans = 90 - adjacent;
  return {
    variant,
    prompt: `In parallelogram ${tex("ABCD")}, ${tex(`m\\angle ADC=${D}^\\circ`)}. Point ${tex("E")} is on line ${tex("DC")} so that ${tex("D")} is between ${tex("E")} and ${tex("C")}, and ${tex("\\overline{AE}\\perp\\overline{DC}")}. What is ${tex("m\\angle DAE")} in degrees?`,
    answer: String(ans),
    hint: `With ${tex(`m\\angle ADC=${D}^\\circ`)}, the angles ${tex("\\angle ADC")} and ${tex("\\angle ADE")} are on the straight line ${tex("EDC")}. Find ${tex("\\angle ADE")}, then use the right angle at ${tex("E")} in triangle ${tex("ADE")}.`,
    explanation: [
      `${tex("E")}, ${tex("D")} and ${tex("C")} are on one line, so ${tex("\\angle ADE")} and ${tex("\\angle ADC")} are supplementary: ${tex(`m\\angle ADE=180-${D}=${adjacent}`)}.`,
      `Triangle ${tex("ADE")} has a right angle at ${tex("E")}, so its other two angles add to 90.`,
      `${tex(`m\\angle DAE=90-${adjacent}=${ans}`)}.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Perpendicular bisector and midsegment                                   */
/* ---------------------------------------------------------------------- */

function segmentProperty(r: Random): Built {
  const variant = (
    [
      "bisector-statement",
      "bisector-algebra",
      "midsegment-statement",
      "midsegment-algebra",
    ] as const
  )[r(0, 3)]!;
  if (variant === "bisector-statement") {
    const correct = tex("PA=PB");
    return {
      variant,
      prompt: `In triangle ${tex("ABC")}, line ${tex("\\ell")} is the perpendicular bisector of ${tex("\\overline{AB}")}. Line ${tex("\\ell")} meets ${tex("\\overline{AC}")} at point ${tex("P")}. Which statement must be true?`,
      answer: "",
      hint: `A perpendicular bisector cuts a segment into two equal parts at a right angle. Think about how far any point on it is from the two endpoints of that segment.`,
      explanation: [
        `Every point on the perpendicular bisector of a segment is the same distance from the two endpoints of the segment.`,
        `${tex("P")} is on the perpendicular bisector of ${tex("\\overline{AB}")}, so it is equally far from ${tex("A")} and from ${tex("B")}.`,
        `${correct}.`,
      ],
      choices: choicesFrom(r, correct, [
        {
          label: tex("PA=PC"),
          feedback:
            `${tex("C")} is not an endpoint of the segment that was bisected. Compare the distances to ${tex("A")} and ${tex("B")}.`,
        },
        {
          label: tex("PB=PC"),
          feedback:
            `Nothing makes ${tex("P")} equally far from ${tex("B")} and ${tex("C")}. The bisected segment is ${tex("\\overline{AB}")}.`,
        },
        {
          label: tex("\\angle APB=90^\\circ"),
          feedback:
            `The right angle is where the bisector meets ${tex("\\overline{AB}")}, not the angle at ${tex("P")}.`,
        },
        {
          label: tex("AB=2PA"),
          feedback:
            `${tex("P")} is not on ${tex("\\overline{AB}")}, so ${tex("PA")} is not half of ${tex("AB")}. Only the midpoint of ${tex("\\overline{AB}")} is half of ${tex("AB")} from ${tex("A")}.`,
        },
        {
          label: tex("P\\text{ is the midpoint of }\\overline{AC}"),
          feedback:
            `${tex("P")} is where the bisector of ${tex("\\overline{AB}")} meets ${tex("\\overline{AC}")}. That point need not be the midpoint of ${tex("\\overline{AC}")}.`,
        },
      ]),
    };
  }
  if (variant === "bisector-algebra") {
    for (;;) {
      const x = r(2, 12);
      const a = r(2, 6);
      const c = r(1, 5);
      if (a === c) continue;
      const b = r(1, 9);
      const d = a * x + b - c * x;
      if (Math.abs(d) > 20 || d === 0) continue;
      const pa = a * x + b;
      const choices = choicesFrom(r, String(pa), [
        {
          label: String(x),
          feedback:
            `That is the value of ${tex("x")}. The question asks for the length ${tex("PA")}.`,
        },
        {
          label: String(2 * pa),
          feedback:
            `${tex("PA")} and ${tex("PB")} are equal; their sum is both lengths together, not ${tex("PA")}.`,
        },
        {
          label: String(pa + x),
          feedback:
            `Substitute ${tex("x")} into the expression for ${tex("PA")}; do not add ${tex("x")} to the answer.`,
        },
        {
          label: String(pa - b),
          feedback: "The constant term is part of the length.",
        },
      ]);
      return {
        variant,
        prompt: `Point ${tex("P")} is on the perpendicular bisector of ${tex("\\overline{AB}")}. ${tex(`PA=${a}x${sg(b)}`)} and ${tex(`PB=${co(c)}x${sg(d)}`)}. What is the length ${tex("PA")}?`,
        answer: "",
        hint: `A point on the perpendicular bisector is the same distance from both endpoints. Write an equation that says ${tex(`${a}x${sg(b)}`)} and ${tex(`${co(c)}x${sg(d)}`)} are equal, solve for ${tex("x")}, then find ${tex("PA")}.`,
        explanation: [
          `${tex("P")} is on the perpendicular bisector of ${tex("\\overline{AB}")}, so ${tex("PA=PB")}: ${tex(`${a}x${sg(b)}=${co(c)}x${sg(d)}`)}.`,
          `Subtract ${tex(`${co(c)}x`)} and the constant: ${tex(`${co(a - c)}x=${d - b}`)}, so ${tex(`x=${x}`)}.`,
          `${tex(`PA=${mul(a, x)}${sg(b)}=${pa}`)}.`,
        ],
        choices,
      };
    }
  }
  const letters = pick(r, [
    ["A", "B", "C", "D", "E"],
    ["P", "Q", "R", "S", "T"],
    ["X", "Y", "Z", "M", "N"],
  ]);
  const [A, B, C, D, E] = letters as [string, string, string, string, string];
  if (variant === "midsegment-statement") {
    const correct = tex(
      `\\overline{${D}${E}}\\parallel\\overline{${B}${C}}\\text{ and }${D}${E}=\\frac{1}{2}${B}${C}`,
    );
    return {
      variant,
      prompt: `In triangle ${tex(`${A}${B}${C}`)}, ${tex(D)} is the midpoint of ${tex(`\\overline{${A}${B}}`)} and ${tex(E)} is the midpoint of ${tex(`\\overline{${A}${C}}`)}. Which statement must be true?`,
      answer: "",
      hint: `${tex(`\\overline{${D}${E}}`)} joins the midpoints of two sides of the triangle. Compare its direction and its length with the third side, ${tex(`\\overline{${B}${C}}`)}.`,
      explanation: [
        `A segment that joins the midpoints of two sides of a triangle is called a midsegment.`,
        `The midsegment is parallel to the third side and half as long.`,
        `${correct}.`,
      ],
      choices: choicesFrom(r, correct, [
        {
          label: tex(
            `\\overline{${D}${E}}\\parallel\\overline{${B}${C}}\\text{ and }${D}${E}=${B}${C}`,
          ),
          feedback:
            "The midsegment is parallel to the third side but shorter: it is half as long.",
        },
        {
          label: tex(
            `\\overline{${D}${E}}\\perp\\overline{${B}${C}}\\text{ and }${D}${E}=\\frac{1}{2}${B}${C}`,
          ),
          feedback:
            "The midsegment is parallel to the third side, not perpendicular to it.",
        },
        {
          label: tex(
            `\\overline{${D}${E}}\\parallel\\overline{${B}${C}}\\text{ and }${D}${E}=2${B}${C}`,
          ),
          feedback:
            "The midsegment is shorter than the third side. It is half as long, not twice as long.",
        },
        {
          label: tex(
            `\\overline{${D}${E}}\\parallel\\overline{${A}${B}}\\text{ and }${D}${E}=\\frac{1}{2}${A}${B}`,
          ),
          feedback: `${tex(`${D}${E}`)} meets ${tex(`${A}${B}`)} at ${tex(D)}, so it cannot be parallel to it. The midsegment is parallel to the side it does not touch.`,
        },
      ]),
    };
  }
  for (;;) {
    const x = r(2, 9);
    const a = r(1, 4);
    const b = r(1, 8);
    const c = r(1, 6);
    if (c === 2 * a) continue;
    const dd = 2 * (a * x + b) - c * x;
    if (Math.abs(dd) > 20 || dd === 0) continue;
    const de = a * x + b;
    const bc = 2 * de;
    const choices = choicesFrom(r, String(bc), [
      {
        label: String(de),
        feedback: `That is the length of the midsegment ${tex(`${D}${E}`)}. The question asks for ${tex(`${B}${C}`)}, which is twice as long.`,
      },
      {
        label: String(x),
        feedback: `That is the value of ${tex("x")}. The question asks for a length.`,
      },
      {
        label: String(bc + de),
        feedback: `${tex(`${B}${C}`)} is twice ${tex(`${D}${E}`)}, so it is ${de} + ${de}.`,
      },
      {
        label: String(2 * bc),
        feedback: `${tex(`${B}${C}`)} is twice ${tex(`${D}${E}`)}, not four times.`,
      },
    ]);
    return {
      variant,
      prompt: `In triangle ${tex(`${A}${B}${C}`)}, ${tex(D)} and ${tex(E)} are the midpoints of ${tex(`\\overline{${A}${B}}`)} and ${tex(`\\overline{${A}${C}}`)}. ${tex(`${D}${E}=${co(a)}x${sg(b)}`)} and ${tex(`${B}${C}=${co(c)}x${sg(dd)}`)}. What is the length ${tex(`${B}${C}`)}?`,
      answer: "",
      hint: `The midsegment is half as long as the third side, so ${tex(`${B}${C}`)} is twice ${tex(`${D}${E}`)}. Write an equation that says ${tex(`${co(c)}x${sg(dd)}`)} is twice ${tex(`${co(a)}x${sg(b)}`)}, solve for ${tex("x")}, and then find ${tex(`${B}${C}`)}.`,
      explanation: [
        `${tex(`${D}${E}`)} is a midsegment, so ${tex(`${B}${C}=2\\cdot ${D}${E}`)}. Substituting gives ${tex(`${co(c)}x${sg(dd)}=2(${co(a)}x${sg(b)})`)}.`,
        `Solve: ${tex(`${co(c)}x${sg(dd)}=${2 * a}x${sg(2 * b)}`)}, so ${tex(`x=${x}`)}.`,
        `${tex(`${B}${C}=${mul(c, x)}${sg(dd)}=${bc}`)}.`,
      ],
      choices,
    };
  }
}

/* ---------------------------------------------------------------------- */
/* Triangle lengths and area                                               */
/* ---------------------------------------------------------------------- */

function isoscelesRight(r: Random): Built {
  const variant = (
    ["leg-from-hypotenuse", "hypotenuse-from-leg", "square-side"] as const
  )[r(0, 2)]!;
  for (;;) {
    if (variant === "hypotenuse-from-leg") {
      const leg = r(3, 25);
      const v = leg * Math.SQRT2;
      if (!safeRound(v, 1)) continue;
      return {
        variant,
        prompt: `Each leg of an isosceles right triangle is ${leg} centimeters long. To the nearest tenth of a centimeter, how long is the hypotenuse?`,
        answer: oneDecimal(v),
        hint: `The hypotenuse of a 45-45-90 triangle is the leg times a fixed number. You can also use the Pythagorean theorem with both legs equal to ${leg}.`,
        explanation: [
          `By the Pythagorean theorem, ${tex(`c^{2}=${leg}^{2}+${leg}^{2}=${2 * leg * leg}`)}.`,
          `So ${tex(`c=${leg}\\sqrt{2}`)} ≈ ${leg} × 1.4142 ≈ ${trimNum(v)}.`,
          `To the nearest tenth the hypotenuse is ${oneDecimal(v)} centimeters.`,
        ],
      };
    }
    const h = r(6, 40);
    const v = h / Math.SQRT2;
    if (!safeRound(v, 1)) continue;
    if (variant === "leg-from-hypotenuse")
      return {
        variant,
        prompt: `The hypotenuse of an isosceles right triangle is ${h} inches long. To the nearest tenth of an inch, how long is each leg?`,
        answer: oneDecimal(v),
        hint: `The two legs are equal. Call each leg ${tex("x")} and use the Pythagorean theorem with the hypotenuse ${h} to get an equation, or divide ${h} by the fixed ratio of hypotenuse to leg.`,
        explanation: [
          `Let each leg be ${tex("x")}. Then ${tex(`x^{2}+x^{2}=${h}^{2}`)}, so ${tex(`2x^{2}=${h * h}`)}.`,
          `${tex(`x=\\frac{${h}}{\\sqrt{2}}`)} ≈ ${h} ÷ 1.4142 ≈ ${trimNum(v)}.`,
          `To the nearest tenth each leg is ${oneDecimal(v)} inches.`,
        ],
      };
    return {
      variant,
      prompt: `A square has a diagonal of ${h} feet. To the nearest tenth of a foot, how long is each side?`,
      answer: oneDecimal(v),
      hint: `A diagonal of ${h} feet cuts the square into two isosceles right triangles whose hypotenuse is the diagonal. The side of the square is a leg of that triangle.`,
      explanation: [
        `The diagonal and two sides form a right triangle with equal legs ${tex("s")}: ${tex(`s^{2}+s^{2}=${h}^{2}`)}.`,
        `${tex(`s=\\frac{${h}}{\\sqrt{2}}`)} ≈ ${h} ÷ 1.4142 ≈ ${trimNum(v)}.`,
        `To the nearest tenth each side is ${oneDecimal(v)} feet.`,
      ],
    };
  }
}

function triangleAreaSas(r: Random): Built {
  const variant = (["acute", "obtuse", "land-story"] as const)[r(0, 2)]!;
  for (;;) {
    const a = r(6, 30);
    const b = r(6, 30);
    const angle = variant === "obtuse" ? r(100, 160) : r(20, 80);
    const area = 0.5 * a * b * Math.sin((angle * Math.PI) / 180);
    if (!safeRound(area, 1)) continue;
    const answer = oneDecimal(area);
    const sine = Math.sin((angle * Math.PI) / 180).toFixed(4);
    const explanation = [
      `The angle ${angle}° is between the two given sides, so ${tex("A=\\frac{1}{2}ab\\sin C")} applies.`,
      `${tex(`A=\\frac{1}{2}(${a})(${b})\\sin ${angle}^\\circ`)} ≈ ${trimNum((a * b) / 2)} × ${sine} ≈ ${trimNum(area)}.`,
      `To the nearest tenth the area is ${answer}.`,
    ];
    if (variant === "land-story")
      return {
        variant,
        prompt: `A triangular lot has two sides of ${a} feet and ${b} feet that meet at an angle of ${angle}°. Use a calculator in degree mode. To the nearest tenth, what is the area of the lot in square feet?`,
        answer,
        hint: `The area of a triangle is half the product of two sides times the sine of the angle between them. Check that the ${angle}° angle sits between the ${a}-foot and ${b}-foot sides.`,
        explanation,
      };
    return {
      variant,
      prompt: `In triangle ${tex("ABC")}, ${tex(`AB=${a}`)}, ${tex(`BC=${b}`)} and ${tex(`m\\angle B=${angle}^\\circ`)}. Use a calculator in degree mode. To the nearest tenth, what is the area of the triangle?`,
      answer,
      hint: `The area of a triangle is half the product of two sides times the sine of the angle between them. Which two of ${tex(`AB=${a}`)} and ${tex(`BC=${b}`)} meet at ${tex("\\angle B")}?`,
      explanation,
    };
  }
}

function thirdSideTest(r: Random): Built {
  const variant = (["could", "could-not"] as const)[r(0, 1)]!;
  const a = r(3, 9);
  const b = a + r(1, 12);
  const lo = b - a;
  const hi = a + b;
  const inside = [] as number[];
  for (let v = lo + 1; v < hi; v++) inside.push(v);
  const pickInside = (n: number) => {
    const pool = [...inside];
    const out: number[] = [];
    while (out.length < n) out.push(pool.splice(r(0, pool.length - 1), 1)[0]!);
    return out;
  };
  const outside: Wrong[] = [
    {
      label: String(lo),
      feedback: `A third side of ${lo} makes ${lo} + ${a} = ${lo + a}, which equals ${b}. The sum must be greater than the third side, so the triangle collapses.`,
    },
    {
      label: String(hi),
      feedback: `A third side of ${hi} equals ${a} + ${b}. The two shorter sides must be longer than the third, so the triangle collapses.`,
    },
    {
      label: String(Math.max(1, lo - 1)),
      feedback: `The difference of the two sides is ${lo}, and the third side must be longer than that.`,
    },
    {
      label: String(hi + 1),
      feedback: `The sum of the two sides is ${hi}, and the third side must be shorter than that.`,
    },
  ];
  const sidesText = `${a} and ${b}`;
  if (variant === "could") {
    const right = pickInside(1)[0]!;
    return {
      variant,
      prompt: `Two sides of a triangle have lengths ${sidesText}. Which length could be the third side?`,
      answer: "",
      hint: `With sides ${a} and ${b}, the third side must be shorter than their sum and longer than their difference. Check each choice against both limits.`,
      explanation: [
        `The third side must be greater than ${b} − ${a} = ${lo} and less than ${a} + ${b} = ${hi}.`,
        `Only ${right} lies strictly between ${lo} and ${hi}.`,
        `The length is ${right}.`,
      ],
      choices: choicesFrom(r, String(right), outside),
    };
  }
  const wrongInside = pickInside(3);
  const bad = pick(r, outside);
  return {
    variant,
    prompt: `Two sides of a triangle have lengths ${sidesText}. Which length could not be the third side?`,
    answer: "",
    hint: `With sides ${a} and ${b}, the third side must be shorter than their sum and longer than their difference. Find the choice that breaks one of those limits.`,
    explanation: [
      `The third side must be greater than ${b} − ${a} = ${lo} and less than ${a} + ${b} = ${hi}.`,
      `${wrongInside.join(", ")} are strictly between ${lo} and ${hi}, but ${bad.label} is not.`,
      `The length that could not be a side is ${bad.label}.`,
    ],
    choices: [
      { label: bad.label, correct: true as const },
      ...wrongInside.map((v) => ({
        label: String(v),
        feedback: `${v} is between ${lo} and ${hi}, so it could be the third side. The question asks for the length that could not.`,
      })),
    ],
  };
}

function altitudeSegment(r: Random): Built {
  for (;;) {
    const leg = r(8, 24);
    const m = r(3, leg - 2);
    const hyp = (leg * leg) / m;
    if (hyp <= m + 0.5) continue;
    const db = hyp - m;
    if (!safeRound(db, 1)) continue;
    return {
      variant: "leg-and-adjacent-segment",
      prompt: `In right triangle ${tex("ABC")}, the right angle is at ${tex("C")}. Altitude ${tex("\\overline{CD}")} meets the hypotenuse ${tex("\\overline{AB}")} at ${tex("D")}. ${tex(`AC=${leg}`)} and ${tex(`AD=${m}`)}. To the nearest tenth, what is the length ${tex("DB")}?`,
      answer: oneDecimal(db),
      hint: `The altitude to the hypotenuse makes the leg ${tex("AC")} the mean proportional between the whole hypotenuse ${tex("AB")} and the segment ${tex("AD")} next to that leg. Use ${tex(`AC=${leg}`)} and ${tex(`AD=${m}`)} to find ${tex("AB")} first, then subtract ${tex("AD")}.`,
      explanation: [
        `Triangles ${tex("ACD")} and ${tex("ABC")} are similar, so ${tex("\\frac{AC}{AB}=\\frac{AD}{AC}")}, which gives ${tex("AC^{2}=AB\\cdot AD")}.`,
        `${tex(`${leg}^{2}=AB\\cdot ${m}`)}, so ${tex(`AB=\\frac{${leg * leg}}{${m}}`)} ≈ ${trimNum(hyp)}.`,
        `${tex(`DB=AB-AD`)} ≈ ${trimNum(hyp)} − ${m} ≈ ${trimNum(db)}, which is ${oneDecimal(db)} to the nearest tenth.`,
      ],
    };
  }
}

/* ---------------------------------------------------------------------- */

const builders: Record<string, (r: Random) => Built> = {
  "rg-exponential-base-rate": exponentialBase,
  "rg-factor-completely": factorCompletely,
  "rg-polynomial-zeros-forms": polynomialZeros,
  "rg-exponent-monomial-power": exponentMonomialPower,
  "rg-rational-exponent-forms": rationalExponentForms,
  "rg-polynomial-build": polynomialBuild,
  "rg-solid-density": solidDensity,
  "rg-quadrilateral-choice": quadrilateralChoice,
  "rg-parallelogram-perpendicular": parallelogramPerpendicular,
  "rg-segment-property-choice": segmentProperty,
  "rg-isosceles-right-decimal": isoscelesRight,
  "rg-triangle-area-sas": triangleAreaSas,
  "rg-triangle-third-side-test": thirdSideTest,
  "rg-altitude-segment": altitudeSegment,
};
export const regentsGapTemplateIds = Object.keys(builders);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function leaks(draft: Draft): boolean {
  const text = `${draft.prompt}\n${draft.hint}`;
  const correct = draft.choices
    ? draft.choices.find((c) => c.correct)!.label
    : draft.answer;
  if (correct === "0") return false;
  if (/^-?[\d,.]+$/.test(correct))
    return new RegExp(`(?<![\\d.,])${escape(correct)}(?![\\d]|[.,]\\d)`).test(
      text,
    );
  return text.includes(correct);
}

/** Private model: the variant is for tests; only the public problem is served. */
export function regentsGapCase(templateId: string, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = regentsGapTemplates.find((t) => t.id === templateId);
  const build = builders[templateId];
  if (!meta || !build) throw new Error(`Unknown template ${templateId}`);
  const r = random(meta.id, seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    let draft: Built;
    try {
      draft = build(r);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Need three"))
        continue;
      throw error;
    }
    if (leaks(draft)) continue;
    return { variant: draft.variant, problem: assemble(meta, seed, r, draft) };
  }
  throw new Error("Could not generate a problem without leaking the answer");
}

export function generateRegentsGapProblem(templateId: string, seed: string) {
  return regentsGapCase(templateId, seed).problem;
}
