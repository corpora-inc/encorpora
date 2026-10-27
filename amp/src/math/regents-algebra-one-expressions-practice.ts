import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import { quad, sgn } from "./regents-algebra-one-kit";

type R = (lo: number, hi: number) => number;
const meta = (
  m: Omit<TemplateMetadata, "version" | "gradeBand">,
): TemplateMetadata => ({ version: 1, gradeBand: "9–12", ...m });
const fail = () => {
  throw new Error("Need three retries");
};

export const rateUnitChainTemplate = meta({
  id: "rate-unit-chain",
  title: "Name the unit of a rate after a chain of conversion factors",
  skillId: "units-and-precision",
  difficultyOffset: 0.3,
  requiredResponseCapability: "single-choice-v1",
  description:
    "A rate such as miles per hour is multiplied by two conversion factors written as fractions. Cancel matching units and choose the unit the product has.",
});
export const negativeMonomialPowerTemplate = meta({
  id: "negative-monomial-power",
  title: "Raise a monomial with a negative coefficient to a power",
  skillId: "exponent-laws",
  difficultyOffset: 0.35,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Simplify $(-cx^m)^k$ for an even or odd power $k$, keeping the sign, raising the coefficient to the power and multiplying the exponents.",
});
export const combineUnlikeRadicalsTemplate = meta({
  id: "combine-unlike-radicals",
  title: "Combine square roots when some radicands match after simplifying",
  skillId: "rational-exponents",
  difficultyOffset: 0.4,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Simplify one square root so it matches another radicand, add the like radicals, and keep the unlike radical as a separate term.",
});
export const completeSquareEquationTemplate = meta({
  id: "complete-square-equation",
  title: "Choose the completed-square equation with the same solutions",
  skillId: "complete-square",
  difficultyOffset: 0.45,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Complete the square on a monic quadratic equation with an even middle coefficient, adding the same number to both sides, and choose the equivalent equation.",
});
export const completeSquareStepPropertyTemplate = meta({
  id: "complete-square-step-property",
  title: "Name the property that justifies a step of completing the square",
  skillId: "equation-reasoning",
  difficultyOffset: 0.35,
  requiredResponseCapability: "single-choice-v1",
  description:
    "A step in solving a quadratic by completing the square adds a number to both sides, moves the constant, or divides by the leading coefficient. Choose the property of equality that justifies it.",
});
export const polynomialStructureTemplate = meta({
  id: "polynomial-structure",
  title:
    "Choose the polynomial with a stated degree, leading coefficient and constant",
  skillId: "polynomial-arithmetic",
  difficultyOffset: 0.3,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Read the degree, leading coefficient and constant term of polynomials whose terms are written out of order, and choose the one that matches all three.",
});

/* ------------------------------------------------ rate unit chain */
const lengths = [
  { big: ["mile", "miles"], small: ["foot", "feet"], factor: 5280 },
  {
    big: ["kilometer", "kilometers"],
    small: ["meter", "meters"],
    factor: 1000,
  },
  { big: ["yard", "yards"], small: ["foot", "feet"], factor: 3 },
  { big: ["foot", "feet"], small: ["inch", "inches"], factor: 12 },
] as const;
const times = [
  { big: ["hour", "hours"], small: ["second", "seconds"], factor: 3600 },
  { big: ["minute", "minutes"], small: ["second", "seconds"], factor: 60 },
  { big: ["day", "days"], small: ["hour", "hours"], factor: 24 },
  { big: ["hour", "hours"], small: ["minute", "minutes"], factor: 60 },
] as const;
const rateAxes = {
  order: defineAxis("order", ["length-first", "time-first"] as const),
};
export const rateUnitChain = chainFamily({
  template: rateUnitChainTemplate,
  axes: rateAxes,
  model: (r: R) => ({
    len: r(0, lengths.length - 1),
    time: r(0, times.length - 1),
    rate: r(2, 12) * 5,
  }),
  variant: (m) => `length-${m.len}-time-${m.time}`,
  render: (m, a, r) => {
    const L = lengths[m.len]!;
    const T = times[m.time]!;
    const txt = (s: string) => `\\text{${s}}`;
    const lenFactor = `\\frac{${L.factor}\\ ${txt(L.small[1])}}{1\\ ${txt(L.big[0])}}`;
    const timeFactor = `\\frac{1\\ ${txt(T.big[0])}}{${T.factor}\\ ${txt(T.small[1])}}`;
    const start = `\\frac{${m.rate}\\ ${txt(L.big[1])}}{1\\ ${txt(T.big[0])}}`;
    const chain =
      a.order === "length-first"
        ? `${start}\\cdot${lenFactor}\\cdot${timeFactor}`
        : `${start}\\cdot${timeFactor}\\cdot${lenFactor}`;
    const unit = (n: string, d: string) => `$${txt(`${n} per ${d}`)}$`;
    return choiceSurface(r, {
      prompt: `A rate is converted by multiplying $${chain}$. In which unit is the result?`,
      label: "Choose the unit",
      options: [
        { label: unit(L.small[1], T.small[0]), correct: true },
        {
          label: unit(T.small[1], L.small[0]),
          feedback:
            "The rate is a length divided by a time. This unit has the time on top and the length underneath, which turns the rate upside down.",
        },
        {
          label: unit(L.big[1], T.small[0]),
          feedback: `The ${L.big[1]} cancel with the ${L.big[0]} in the length factor, leaving ${L.small[1]}. The length unit changes.`,
        },
        {
          label: unit(L.small[1], T.big[0]),
          feedback: `The ${T.big[0]} in the time factor cancels the ${T.big[0]} in the denominator of the starting rate, leaving ${T.small[1]}. The time unit changes.`,
        },
        {
          label: unit(L.big[1], T.big[0]),
          feedback:
            "Each conversion factor cancels one unit and brings in another, so the units of the starting rate do not remain.",
        },
      ],
      hint: `The chain starts at ${m.rate} ${L.big[1]} per ${T.big[0]} and uses the factors ${L.factor} and ${T.factor}. Cross out matching units, one top against one bottom: the ${L.big[1]} and the ${T.big[0]} each appear once in a numerator and once in a denominator. See which two units are left.`,
      explanation: [
        `The starting rate has ${L.big[1]} on top and ${T.big[0]} underneath.`,
        `The length factor has ${L.small[1]} on top and ${L.big[0]} underneath, so ${L.big[1]} cancel and ${L.small[1]} remain on top.`,
        `The time factor has ${T.big[0]} on top and ${T.small[1]} underneath, so the ${T.big[1]} cancel and ${T.small[1]} remain underneath.`,
        `The unit of the result is ${L.small[1]} per ${T.small[0]}.`,
      ],
    });
  },
});

/* ------------------------------------------------ negative monomial power */
const powerAxes = {
  power: defineAxis("power", ["odd", "even"] as const),
  letter: defineAxis("letter", ["x", "y", "a", "n"] as const),
};
export const negativeMonomialPower = chainFamily({
  template: negativeMonomialPowerTemplate,
  axes: powerAxes,
  model: (r: R, ax) => ({
    c: r(2, 4),
    m: r(2, 5),
    k: ax.power === "odd" ? pick(r, [3, 5] as const) : pick(r, [2, 4] as const),
  }),
  variant: (m) => (m.k % 2 ? "odd-power" : "even-power"),
  render: (m, ax, r) => {
    const v = ax.letter;
    const coef = m.c ** m.k;
    const sign = m.k % 2 ? -1 : 1;
    const term = (cf: number, e: number) =>
      `${cf < 0 ? "-" : ""}${Math.abs(cf)}${v}^{${e}}`;
    return choiceSurface(r, {
      prompt: `Which expression is equivalent to $(-${m.c}${v}^{${m.m}})^{${m.k}}$?`,
      label: "Choose the expression",
      options: [
        { label: `$${term(sign * coef, m.m * m.k)}$`, correct: true },
        {
          label: `$${term(-sign * coef, m.m * m.k)}$`,
          feedback: `Raising $-${m.c}$ to the power ${m.k} gives ${sign < 0 ? "a negative" : "a positive"} number: ${m.k} negative factors multiply to ${sign < 0 ? "a negative" : "a positive"} product.`,
        },
        {
          label: `$${term(sign * m.c, m.m * m.k)}$`,
          feedback: `The coefficient $-${m.c}$ is raised to the power too: $(-${m.c})^{${m.k}}=${sign * coef}$.`,
        },
        {
          label: `$${term(sign * coef, m.m + m.k)}$`,
          feedback: `A power of a power multiplies the exponents: $${m.m}\\cdot${m.k}=${m.m * m.k}$. Adding them is the rule for multiplying like bases.`,
        },
        {
          label: `$${term(sign * m.c * m.k, m.m * m.k)}$`,
          feedback: `The coefficient is raised to the power ${m.k}, not multiplied by ${m.k}.`,
        },
      ],
      hint: `Everything inside the parentheses is raised to the power ${m.k}: the sign, the number ${m.c} and $${v}^{${m.m}}$. Decide the sign from the power, then raise ${m.c} to the power and multiply the exponents.`,
      explanation: [
        `Raise each factor to the power ${m.k}: $(-${m.c})^{${m.k}}\\cdot(${v}^{${m.m}})^{${m.k}}$.`,
        `$(-${m.c})^{${m.k}}=${sign * coef}$, because ${m.k} is ${m.k % 2 ? "odd" : "even"} and so the sign is ${sign < 0 ? "negative" : "positive"}.`,
        `$(${v}^{${m.m}})^{${m.k}}=${v}^{${m.m * m.k}}$.`,
        `The result is $${term(sign * coef, m.m * m.k)}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ combine radicals */
const radicalBase = [2, 3, 5, 6, 7, 10, 11] as const;
export const combineUnlikeRadicals = chainFamily({
  template: combineUnlikeRadicalsTemplate,
  axes: { order: defineAxis("order", ["like-first", "unlike-first"] as const) },
  model: (r: R) => {
    const p = pick(r, radicalBase);
    const q = pick(r, radicalBase);
    if (p === q) fail();
    return {
      p,
      q,
      a: r(1, 5),
      b: r(1, 5),
      c: r(1, 3),
      s: pick(r, [2, 3, 4, 5] as const),
    };
  },
  variant: (m) => `s-${m.s}`,
  render: (m, ax, r) => {
    const rad = (n: number) => `\\sqrt{${n}}`;
    const coefText = (n: number) => (n === 1 ? "" : String(n));
    const third = `${coefText(m.c)}${rad(m.p * m.s * m.s)}`;
    const first = `${coefText(m.a)}${rad(m.p)}`;
    const mid = `${coefText(m.b)}${rad(m.q)}`;
    const expr =
      ax.order === "like-first"
        ? `${first} + ${mid} + ${third}`
        : `${mid} + ${first} + ${third}`;
    const like = m.a + m.c * m.s;
    const label = (lk: number, pp: number, other: number, qq: number) =>
      `$${coefText(lk)}${rad(pp)} + ${coefText(other)}${rad(qq)}$`;
    return choiceSurface(r, {
      prompt: `Which expression is equivalent to $${expr}$?`,
      label: "Choose the expression",
      options: [
        { label: label(like, m.p, m.b, m.q), correct: true },
        {
          label: label(m.a + m.c, m.p, m.b, m.q),
          feedback: `The radical $${rad(m.p * m.s * m.s)}$ simplifies to $${m.s}${rad(m.p)}$ before it can be added to $${rad(m.p)}$ terms; its coefficient is ${m.c * m.s}, not ${m.c}.`,
        },
        {
          label: `$${coefText(like + m.b)}${rad(m.p)}$`,
          feedback: `$${rad(m.p)}$ and $${rad(m.q)}$ are different radicals, so their coefficients cannot be added.`,
        },
        {
          label: `$${coefText(like + m.b)}${rad(m.p + m.q)}$`,
          feedback:
            "Square roots with different radicands cannot be combined by adding the numbers under the root.",
        },
        {
          label: `$${m.a + m.b + m.c}${rad(m.p + m.q + m.p * m.s * m.s)}$`,
          feedback:
            "Only terms with the same radical can be added, and the radicands themselves are never added.",
        },
      ],
      hint: `Look for a perfect square factor in ${m.p * m.s * m.s}: simplify $${rad(m.p * m.s * m.s)}$ so it has the same radicand as another term, then add only the like radicals.`,
      explanation: [
        m.c === 1
          ? `Simplify: $${rad(m.p * m.s * m.s)} = ${m.s}${rad(m.p)}$.`
          : `Simplify: $${rad(m.p * m.s * m.s)} = ${m.s}${rad(m.p)}$, so $${third} = ${m.c * m.s}${rad(m.p)}$.`,
        `The like radicals are $${first}$ and $${m.c * m.s}${rad(m.p)}$. Add the coefficients: ${m.a} + ${m.c * m.s} = ${like}.`,
        `The radical $${mid}$ is different, so it stays as a separate term: $${label(like, m.p, m.b, m.q).slice(1, -1)}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ complete the square */
const csAxes = {
  form: defineAxis("form", ["zero-form", "constant-on-right"] as const),
};
interface CsModel {
  h: number; // half the middle coefficient with sign: x^2 + 2h x
  c: number;
}
export const completeSquareEquation = chainFamily({
  template: completeSquareEquationTemplate,
  axes: csAxes,
  model: (r: R): CsModel => {
    const h = r(1, 6) * (r(0, 1) ? 1 : -1);
    const c = r(-12, 12);
    if (c === 0) fail();
    return { h, c };
  },
  variant: (m) => (m.h < 0 ? "negative-middle" : "positive-middle"),
  render: (m, ax, r) => {
    const b = 2 * m.h;
    const rhs = m.h * m.h - m.c;
    const sq = (hh: number, k: number) =>
      `$(x ${sgn(hh)} ${Math.abs(hh)})^2 = ${k}$`;
    const eq =
      ax.form === "zero-form"
        ? `${quad(1, b, m.c)} = 0`
        : `${quad(1, b, 0)} = ${-m.c}`;
    return choiceSurface(r, {
      prompt: `Which equation has the same solutions as $${eq}$?`,
      label: "Choose the equation",
      options: [
        { label: sq(m.h, rhs), correct: true },
        {
          label: sq(m.h, -m.c),
          feedback: `The number ${m.h * m.h} added to the left side to complete the square must be added to the right side too.`,
        },
        {
          label: sq(-m.h, rhs),
          feedback: `The binomial takes the sign of the middle coefficient: half of ${b} is ${m.h}, so the factor is $(x ${sgn(m.h)} ${Math.abs(m.h)})$.`,
        },
        {
          label: sq(b, -m.c + b * b),
          feedback: `Half of the middle coefficient is ${m.h}, not ${b}. The square is $(x ${sgn(m.h)} ${Math.abs(m.h)})^2$.`,
        },
        {
          label: sq(m.h, -m.c - m.h * m.h),
          feedback: `On the right side the number ${m.h * m.h} is added to ${-m.c}, not subtracted from it.`,
        },
      ],
      hint: `Half of the middle coefficient ${b} is ${m.h}, and its square is ${m.h * m.h}. ${ax.form === "zero-form" ? `Move the constant ${m.c} to the right side first` : `The constant ${-m.c} is already on the right side`}, then add ${m.h * m.h} to both sides.`,
      explanation: [
        ax.form === "zero-form"
          ? `Move the constant: $${quad(1, b, 0)} = ${-m.c}$.`
          : `The constant is already on the right: $${quad(1, b, 0)} = ${-m.c}$.`,
        `Half of ${b} is ${m.h}, and $${m.h}^2 = ${m.h * m.h}$. Add ${m.h * m.h} to both sides: $${quad(1, b, m.h * m.h)} = ${-m.c + m.h * m.h}$.`,
        `The left side is a perfect square: $(x ${sgn(m.h)} ${Math.abs(m.h)})^2 = ${rhs}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ step property */
const properties = [
  "addition property of equality",
  "multiplication property of equality",
  "distributive property",
  "commutative property of addition",
  "substitution property of equality",
] as const;
const stepAxes = {
  step: defineAxis("step", [
    "add-square",
    "move-constant",
    "divide-leading",
  ] as const),
};
export const completeSquareStepProperty = chainFamily({
  template: completeSquareStepPropertyTemplate,
  axes: stepAxes,
  model: (r: R) => ({ h: r(1, 6), c: r(1, 15), a: r(2, 5), k: r(1, 9) }),
  variant: (m) => `h-${m.h}`,
  render: (m, ax, r) => {
    const b = 2 * m.h;
    let correct: (typeof properties)[number];
    let stepText: string;
    let explain: string;
    let hint: string;
    if (ax.step === "add-square") {
      correct = "addition property of equality";
      stepText = `$x^2 + ${b}x = ${m.c}$ becomes $x^2 + ${b}x + ${m.h * m.h} = ${m.c} + ${m.h * m.h}$`;
      explain = `The same number, ${m.h * m.h}, is added to both sides.`;
      hint = `Compare $x^2 + ${b}x = ${m.c}$ with the new equation: the same number, ${m.h * m.h}, is written on both sides. Which operation with ${m.h * m.h} was applied to each side?`;
    } else if (ax.step === "move-constant") {
      correct = "addition property of equality";
      stepText = `$x^2 + ${b}x + ${m.c} = 0$ becomes $x^2 + ${b}x = -${m.c}$`;
      explain = `Subtracting ${m.c} from both sides is adding the opposite, $-${m.c}$, to both sides.`;
      hint = `Compare the two equations: the constant ${m.c} is gone from the left side of $x^2 + ${b}x + ${m.c} = 0$. What operation with ${m.c} on both sides produces that?`;
    } else {
      correct = "multiplication property of equality";
      stepText = `$${m.a}x^2 + ${m.a * b}x = ${m.a * m.c}$ becomes $x^2 + ${b}x = ${m.c}$`;
      explain = `Dividing both sides by ${m.a} is multiplying both sides by $\\frac{1}{${m.a}}$.`;
      hint = `Every term of $${m.a}x^2 + ${m.a * b}x = ${m.a * m.c}$ was divided by ${m.a}. Dividing both sides by the same nonzero number uses which property?`;
    }
    const wrong: Record<string, string> = {
      "addition property of equality":
        "The step does not add or subtract a number on both sides; it multiplies or divides every term.",
      "multiplication property of equality":
        "The step adds or subtracts the same number on both sides; it does not multiply or divide them.",
      "distributive property":
        "The distributive property rewrites a product over a sum, $a(b+c)=ab+ac$. No such rewriting is the reason for this step.",
      "commutative property of addition":
        "The commutative property changes the order of addends, $a+b=b+a$. The step changes the equation itself.",
      "substitution property of equality":
        "The substitution property replaces a quantity by an equal one. This step changes both sides of the equation.",
    };
    const others = shuffle(
      r,
      properties.filter(
        (p) =>
          p !== correct &&
          !(ax.step === "divide-leading" && p === "distributive property"),
      ),
    ).slice(0, 4);
    return choiceSurface(r, {
      prompt: `A student solves a quadratic equation by completing the square. In one step, ${stepText}. Which property of equality justifies this step?`,
      label: "Choose the property",
      options: [
        { label: correct[0]!.toUpperCase() + correct.slice(1), correct: true },
        ...others.map((p) => ({
          label: p[0]!.toUpperCase() + p.slice(1),
          feedback: wrong[p]!,
        })),
      ],
      hint,
      explanation: [
        explain,
        `This is the ${correct}: doing the same thing to both sides keeps the equation balanced.`,
      ],
    });
  },
});

/* ------------------------------------------------ polynomial structure */
interface PolyModel {
  d: number;
  lead: number;
  c: number;
  mids: Array<[number, number]>;
}
const termText = (coef: number, exp: number, first: boolean) => {
  const mag = Math.abs(coef);
  const body =
    exp === 0
      ? String(mag)
      : `${mag === 1 ? "" : mag}x${exp === 1 ? "" : `^${exp}`}`;
  return first
    ? `${coef < 0 ? "-" : ""}${body}`
    : ` ${coef < 0 ? "-" : "+"} ${body}`;
};
const polyText = (terms: Array<[number, number]>) =>
  `$${terms.map(([cf, e], i) => termText(cf, e, i === 0)).join("")}$`;
export const polynomialStructure = chainFamily({
  template: polynomialStructureTemplate,
  axes: {
    ask: defineAxis("ask", ["three-features", "degree-and-constant"] as const),
  },
  model: (r: R): PolyModel => {
    const d = r(3, 5);
    const lead = pick(r, [2, 3, 4, -2, -3] as const);
    const c = (r(0, 1) ? 1 : -1) * r(1, 9);
    const exps = shuffle(
      r,
      Array.from({ length: d - 1 }, (_, i) => i + 1),
    ).slice(0, r(1, 2));
    return {
      d,
      lead,
      c,
      mids: exps.map(
        (e) => [(r(0, 1) ? 1 : -1) * r(1, 6), e] as [number, number],
      ),
    };
  },
  variant: (m) => `degree-${m.d}`,
  render: (m, ax, r) => {
    const build = (
      d: number,
      lead: number,
      c: number | null,
      mids: Array<[number, number]>,
    ) =>
      shuffle(r, [
        [lead, d],
        ...(c === null ? [] : [[c, 0]]),
        ...mids.filter(([, e]) => e < d),
      ] as Array<[number, number]>);
    const swapDegree =
      Math.abs(m.lead) >= 2 && Math.abs(m.lead) <= 5 && m.lead > 0
        ? m.lead
        : null;
    const features =
      ax.ask === "three-features"
        ? `a degree of ${m.d}, a leading coefficient of ${m.lead}, and a constant term of ${m.c}`
        : `a degree of ${m.d} and a constant term of ${m.c}`;
    const base = build(m.d, m.lead, m.c, m.mids);
    const options: ChoiceOption[] = [
      { label: polyText(base), correct: true },
      {
        label: polyText(build(m.d, m.lead, -m.c, m.mids)),
        feedback: `The constant term is the term without $x$. Here it should be ${m.c}, not ${-m.c}.`,
      },
      {
        label: polyText(build(m.d - 1, m.lead, m.c, m.mids)),
        feedback: `The degree is the largest exponent, which should be ${m.d}. This polynomial's largest exponent is ${m.d - 1}.`,
      },
      {
        label: polyText(
          build(m.d, m.lead, null, [
            ...m.mids.filter(([, e]) => e !== 1),
            [m.c, 1],
          ]),
        ),
        feedback: `${m.c} is the constant term only if it has no $x$. Here it multiplies $x$, so it is a coefficient.`,
      },
    ];
    if (swapDegree && swapDegree !== m.d) {
      options.push({
        label: polyText(build(swapDegree, m.d, m.c, m.mids)),
        feedback: `The degree and the leading coefficient are swapped: the degree is the exponent ${m.d}, and ${m.lead} is the coefficient of that term.`,
      });
    }
    if (ax.ask === "three-features") {
      options.push({
        label: polyText(
          build(m.d, m.mids[0]![0], m.c, [
            [m.lead, m.mids[0]![1]],
            ...m.mids.slice(1),
          ]),
        ),
        feedback: `The leading coefficient is the coefficient of the term with the highest exponent, ${m.d}, wherever that term is written.`,
      });
    }
    return choiceSurface(r, {
      prompt: `Which polynomial has ${features}?`,
      label: "Choose the polynomial",
      options,
      hint:
        ax.ask === "three-features"
          ? `The terms are not in order. Look for the term with exponent ${m.d}: its coefficient must be ${m.lead}. Then find the term with no $x$, which must be ${m.c}.`
          : `The terms are not in order. Look for the largest exponent, which must be ${m.d}, and the term with no $x$, which must be ${m.c}.`,
      explanation: [
        `Find the term with the highest exponent: $x^{${m.d}}$ has coefficient ${m.lead}, so the degree is ${m.d} and the leading coefficient is ${m.lead}.`,
        `The term with no $x$ is the constant term, ${m.c}.`,
        `The polynomial is ${polyText(base)}.`,
      ],
    });
  },
});

export const regentsAlgebraOneExpressionTemplates = [
  rateUnitChainTemplate,
  negativeMonomialPowerTemplate,
  combineUnlikeRadicalsTemplate,
  completeSquareEquationTemplate,
  completeSquareStepPropertyTemplate,
  polynomialStructureTemplate,
];
export const regentsAlgebraOneExpressionGenerate = dispatch(
  regentsAlgebraOneExpressionTemplates,
  {
    "rate-unit-chain": (s) => rateUnitChain.generate(s).problem,
    "negative-monomial-power": (s) => negativeMonomialPower.generate(s).problem,
    "combine-unlike-radicals": (s) => combineUnlikeRadicals.generate(s).problem,
    "complete-square-equation": (s) =>
      completeSquareEquation.generate(s).problem,
    "complete-square-step-property": (s) =>
      completeSquareStepProperty.generate(s).problem,
    "polynomial-structure": (s) => polynomialStructure.generate(s).problem,
  },
);
