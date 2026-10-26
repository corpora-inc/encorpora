import type { SemanticFigure, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  type Draft,
  type Random,
} from "./distribution-practice";

/**
 * Round-2 problem types inside existing number, expression, area, estimation,
 * unit and fraction skills. Each template is new; no existing template changes.
 */
export const numberMeasurementGapTemplates: readonly TemplateMetadata[] = [
  {
    id: "signed-context-order",
    version: 1,
    title: "Order and absolute value in context",
    skillId: "absolute-value",
    gradeBand: "6–8",
    difficultyOffset: 0.15,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Use absolute value as a size (debt, distance from sea level), order signed fractions and decimals, and choose the correct statement of order for temperatures.",
  },
  {
    id: "equivalent-expressions-check",
    version: 1,
    title: "Decide which expressions are equivalent",
    skillId: "expression-properties",
    gradeBand: "6–8",
    difficultyOffset: 0.3,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Find the expression that is not equivalent, test equivalence by substitution, combine like terms after distributing, and factor a common number out of a linear expression.",
  },
  {
    id: "area-tiling-distributive",
    version: 1,
    title: "Area by splitting a rectangle",
    skillId: "rectangle-area",
    gradeBand: "3–5",
    difficultyOffset: 0.25,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Split a tiled rectangle into two parts to show a × (b + c) = a × b + a × c, and find the area of an L-shaped figure by splitting it into two rectangles.",
  },
  {
    id: "estimate-reasonableness",
    version: 1,
    title: "Estimate and check reasonableness",
    skillId: "multistep-whole-stories",
    gradeBand: "3–5",
    difficultyOffset: 0.3,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Round to choose the best estimate of a product, quotient or two-step total, and judge by rounding whether a computed product is reasonable.",
  },
  {
    id: "unit-chain-conversion",
    version: 1,
    title: "Convert through a chain of units",
    skillId: "units-and-precision",
    gradeBand: "9–12",
    difficultyOffset: 0.35,
    description:
      "Multiply through a chain of stated unit factors: a dose per kilogram per day, density and mass or volume, speed and distance, flow and volume, area and tile counts, and cubic meters to liters.",
  },
  {
    id: "fraction-of-set",
    version: 1,
    title: "A fraction of a set",
    skillId: "fraction-times-whole",
    gradeBand: "3–5",
    difficultyOffset: 0.1,
    description:
      "Find a fraction of a set of objects by splitting it into equal groups: the part, the remainder, and a multiple of a known unit-fraction part.",
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
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const commas = (n: number) => n.toLocaleString("en-US");
const sgn = (n: number) => (n < 0 ? "-" : "+");
const round10 = (n: number) => Math.round(n / 10) * 10;
const round100 = (n: number) => Math.round(n / 100) * 100;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** Coefficient text for a first term: 1x -> x, -1x -> -x. */
const term = (m: number, v = "x") =>
  m === 1 ? v : m === -1 ? `-${v}` : `${m}${v}`;
/** m x + k in standard order, dropping zero parts. */
function lin(m: number, k: number): string {
  if (m === 0) return String(k);
  return k === 0 ? term(m) : `${term(m)} ${sgn(k)} ${Math.abs(k)}`;
}
const tex = (s: string) => `$${s}$`;

/* ---------------------------------------------------------------------- */
/* signed-context-order                                                    */
/* ---------------------------------------------------------------------- */

const hundredths = (h: number, asFraction: boolean): string => {
  const sign = h < 0 ? "-" : "";
  const a = Math.abs(h);
  if (a % 100 === 0) return `${sign}${a / 100}`;
  if (asFraction) {
    const g = gcd(a, 100);
    return `${sign}\\frac{${a / g}}{${100 / g}}`;
  }
  return `${sign}${(a / 100).toFixed(2).replace(/0$/, "").replace(/\.$/, "")}`;
};

function signedContextOrder(r: Random): Built {
  const variant = ["debt", "sea-level", "order-list", "temperature"][r(0, 3)]!;
  if (variant === "debt") {
    const names = pick(r, [
      ["Ari", "Bo"],
      ["Dana", "Eli"],
      ["Mei", "Sam"],
      ["Noor", "Luis"],
    ] as const);
    const cents = r(0, 1) === 1;
    let x = r(5, 60) * 100 + (cents ? r(1, 3) * 25 : 0);
    let y = x + r(1, 40) * 100 + (cents ? r(0, 3) * 25 : 0);
    if (y === x) y += 100;
    const flip = r(0, 1) === 1;
    const [small, big] = flip ? [names[1], names[0]] : [names[0], names[1]];
    const fmt = (c: number) =>
      c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2);
    const first = flip ? y : x;
    const second = flip ? x : y;
    return {
      variant,
      prompt: `${names[0]}'s account balance is ${tex(`-${fmt(first)}`)} dollars and ${names[1]}'s is ${tex(`-${fmt(second)}`)} dollars. Which statement is correct?`,
      answer: "",
      hint: `A negative balance is a debt. The size of the debt is the distance of the balance from 0, which is its absolute value. Compare ${fmt(x)} and ${fmt(y)}, not the order of the negative numbers.`,
      explanation: [
        `The debts are the absolute values: ${tex(`|-${fmt(first)}|=${fmt(first)}`)} dollars and ${tex(`|-${fmt(second)}|=${fmt(second)}`)} dollars.`,
        `${fmt(y)} is greater than ${fmt(x)}, so ${big} owes more.`,
        `On the number line ${tex(`-${fmt(y)}`)} is to the left of ${tex(`-${fmt(x)}`)}, so ${big}'s balance is the lesser number. The lesser balance is the greater debt.`,
      ],
      choices: choicesFrom(
        r,
        `${big} owes more, because ${tex(`|-${fmt(y)}|=${fmt(y)}`)} is greater than ${tex(`|-${fmt(x)}|=${fmt(x)}`)}.`,
        [
          {
            label: `${big} has the greater balance, because ${fmt(y)} is greater than ${fmt(x)}.`,
            feedback: `${tex(`-${fmt(y)}`)} is farther left on the number line than ${tex(`-${fmt(x)}`)}, so it is the lesser balance. The size ${fmt(y)} measures debt, not balance.`,
          },
          {
            label: `${small} owes more, because ${tex(`-${fmt(x)}`)} is greater than ${tex(`-${fmt(y)}`)}.`,
            feedback: `${tex(`-${fmt(x)}`)} is the greater number, but debt is the amount owed, the absolute value. Compare ${fmt(x)} and ${fmt(y)}.`,
          },
          {
            label:
              "They owe the same amount, because both balances are negative.",
            feedback:
              "Both balances are debts, but the amounts differ. Compare the absolute values to compare the debts.",
          },
        ],
      ),
    };
  }
  if (variant === "sea-level") {
    const [below, above] = pick(r, [
      ["a submarine", "a gull"],
      ["a diver", "a kite"],
      ["a mine shaft entrance", "a hilltop"],
      ["a cave floor", "a bridge"],
    ] as const);
    const low = r(4, 60) * 5; // meters below sea level
    let high = r(4, 60) * 5;
    if (high === low) high += 5;
    const farBelow = low > high;
    const far = farBelow ? below : above;
    const near = farBelow ? above : below;
    const farV = farBelow ? -low : high;
    const nearV = farBelow ? high : -low;
    const farM = Math.abs(farV);
    const nearM = Math.abs(nearV);
    return {
      variant,
      prompt: `Height above sea level is positive and depth below sea level is negative. ${cap(below)} is at ${tex(`-${low}`)} meters and ${above} is at ${tex(String(high))} meters. Which statement is correct about distance from sea level?`,
      answer: "",
      hint: `Distance from sea level is the distance from 0 on the number line, no matter which side of 0 the position is on. Find the absolute values of ${tex(`-${low}`)} and ${tex(String(high))}.`,
      explanation: [
        `The distances are ${tex(`|-${low}|=${low}`)} meters and ${tex(`|${high}|=${high}`)} meters.`,
        `${Math.max(low, high)} is greater than ${Math.min(low, high)}, so ${far} is farther from sea level.`,
        `Comparing ${tex(String(nearV))} and ${tex(String(farV))} as ordered numbers answers which is higher, not which is farther.`,
      ],
      choices: choicesFrom(
        r,
        `${cap(far)} is farther, because ${tex(`|${farV}|=${farM}`)} is greater than ${tex(`|${nearV}|=${nearM}`)}.`,
        [
          {
            label: `${cap(near)} is farther, because ${tex(String(nearV))} is ${nearV > farV ? "greater" : "less"} than ${tex(String(farV))}.`,
            feedback:
              "That compares order on the number line, which tells which position is higher. Distance from sea level is the absolute value.",
          },
          {
            label:
              "They are the same distance, because one is above and one is below sea level.",
            feedback:
              "Opposite sides of 0 do not make equal distances. Only opposite numbers, such as 20 and -20, are the same distance from 0.",
          },
          {
            label: "They cannot be compared, because one number is negative.",
            feedback:
              "Absolute value turns each position into a distance, and distances can always be compared.",
          },
        ],
      ),
    };
  }
  if (variant === "order-list") {
    let vals: number[];
    for (;;) {
      const grid = pick(r, [10, 20, 25] as const);
      vals = Array.from({ length: 4 }, () => r(-9, 9) * grid);
      const abs = vals.map(Math.abs);
      if (
        new Set(vals).size === 4 &&
        new Set(abs).size === 4 &&
        vals.filter((v) => v < 0).length >= 2 &&
        vals.some((v) => v > 0) &&
        vals.every((v) => Math.abs(v) <= 300)
      )
        break;
    }
    const shown = new Map(
      vals.map((v) => [v, hundredths(v, r(0, 1) === 1)] as const),
    );
    const asc = r(0, 1) === 1;
    const sorted = [...vals].sort((a, b) => (asc ? a - b : b - a));
    const list = (xs: number[]) =>
      tex(xs.map((v) => shown.get(v)).join(",\\ "));
    const byMagnitude = [...vals].sort((a, b) =>
      asc ? Math.abs(a) - Math.abs(b) : Math.abs(b) - Math.abs(a),
    );
    const reversed = [...sorted].reverse();
    const swapped = [sorted[1]!, sorted[0]!, ...sorted.slice(2)];
    const rotated = [...sorted.slice(1), sorted[0]!];
    const label = list(sorted);
    const scrambled = [vals[2]!, vals[0]!, vals[3]!, vals[1]!];
    return {
      variant,
      prompt: `Order ${tex(scrambled.map((v) => shown.get(v)).join(",\\ "))} from ${asc ? "least to greatest" : "greatest to least"}. Which list is in the correct order?`,
      answer: "",
      hint: `Put the negative numbers to the left of 0 on a number line. Of two negative numbers, the one with the larger absolute value is farther left, so it is the lesser number. Write every number as a decimal to compare them.`,
      explanation: [
        `As decimals: ${vals.map((v) => hundredths(v, false)).join(", ")} (each written as a decimal).`,
        `Negative numbers are less than positive numbers. Among negatives, more distance below 0 means lesser.`,
        `From ${asc ? "least to greatest" : "greatest to least"}: ${sorted.map((v) => hundredths(v, false)).join(", ")}.`,
      ],
      choices: choicesFrom(r, label, [
        {
          label: list(byMagnitude),
          feedback:
            "That orders by absolute value, the distance from 0. For negative numbers the greater absolute value is the lesser number.",
        },
        {
          label: list(reversed),
          feedback: `This list runs ${asc ? "greatest to least" : "least to greatest"}. Check which way the question asks.`,
        },
        {
          label: list(swapped),
          feedback:
            "The first two numbers are in the wrong order. Compare them on a number line.",
        },
        {
          label: list(rotated),
          feedback:
            "One number is out of place. Compare each number with the next one.",
        },
      ]),
    };
  }
  // temperature
  const places = pick(r, [
    ["the east town", "the west town"],
    ["the lake", "the hilltop"],
    ["Monday", "Tuesday"],
    ["the north gauge", "the south gauge"],
  ] as const);
  const decimal = r(0, 3) === 0;
  const cold = -(decimal ? r(12, 150) : r(2, 15));
  const warm = r(0, 1)
    ? cold + r(1, Math.min(decimal ? 40 : 14, -cold - 1))
    : r(1, decimal ? 120 : 12);
  const f = (v: number) => (decimal ? (v / 10).toFixed(1) : String(v));
  const swap = r(0, 1) === 1;
  const [pc, pw] = swap ? [places[1], places[0]] : [places[0], places[1]];
  const [first, second] = swap ? [warm, cold] : [cold, warm];
  return {
    variant: "temperature",
    prompt: `At noon, ${places[0]} is ${tex(f(first))} degrees Celsius and ${places[1]} is ${tex(f(second))} degrees Celsius. Which statement is correct?`,
    answer: "",
    hint: `On a thermometer, the colder reading is lower, so it is the lesser number. Place ${tex(f(cold))} and ${tex(f(warm))} on a vertical number line and see which is lower.`,
    explanation: [
      `${tex(f(cold))} is below ${tex(f(warm))} on the number line, so ${tex(`${f(cold)}<${f(warm)}`)}.`,
      `A lower temperature is colder, so ${pc} is colder than ${pw}.`,
      `Compare the numbers, not their digits: ${tex(f(cold))} has the ${Math.abs(cold) > Math.abs(warm) ? "greater" : "lesser"} digits but is the lesser number.`,
    ],
    choices: choicesFrom(
      r,
      `${cap(pc)} is colder than ${pw}, so ${tex(`${f(cold)}<${f(warm)}`)}.`,
      [
        {
          label: `${cap(pc)} is colder than ${pw}, so ${tex(`${f(cold)}>${f(warm)}`)}.`,
          feedback:
            "The words are right, but the symbol is reversed. The colder reading is the lesser number, so use <.",
        },
        {
          label: `${cap(pw)} is colder than ${pc}, so ${tex(`${f(warm)}<${f(cold)}`)}.`,
          feedback: `${tex(f(warm))} is the greater number, not the lesser. Compare positions on the number line, not the digits alone.`,
        },
        {
          label:
            "Neither is colder, because both readings are measured from 0.",
          feedback:
            "Different readings mean different temperatures. The lower reading is the colder one.",
        },
      ],
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* equivalent-expressions-check                                            */
/* ---------------------------------------------------------------------- */

function equivalentExpressions(r: Random): Built {
  const variant = ["not-equivalent", "one-value-check", "combine", "factor"][
    r(0, 3)
  ]!;
  if (variant === "not-equivalent") {
    const a = r(2, 5);
    const b = r(1, 4);
    const c = r(1, 6) * (r(0, 1) ? 1 : -1);
    let d = r(1, 5) * (r(0, 1) ? 1 : -1);
    if (d === -a * b) d = a * b + 1;
    const m = a * b + d;
    const k = a * c;
    const original = `${a}(${term(b)} ${sgn(c)} ${Math.abs(c)}) ${sgn(d)} ${term(Math.abs(d))}`;
    const equal: Wrong[] = [
      {
        label: lin(m, k),
        feedback: `This is equivalent: distributing gives ${tex(`${a * b}x ${sgn(k)} ${Math.abs(k)}`)} and ${tex(`${d < 0 ? "-" : "+"}${Math.abs(d)}x`)} combines with ${tex(`${a * b}x`)}.`,
      },
      {
        label: `${k} ${sgn(m)} ${term(Math.abs(m))}`,
        feedback:
          "This is equivalent: the same two terms are written in the other order, and adding is order-free.",
      },
      {
        label: `${term(a * b)} ${sgn(d)} ${term(Math.abs(d))} ${sgn(k)} ${Math.abs(k)}`,
        feedback:
          "This is equivalent: it is the original expression after distributing, before the $x$ terms are combined.",
      },
      {
        label: `${k} + ${term(a * b)} ${sgn(d)} ${term(Math.abs(d))}`,
        feedback:
          "This is equivalent: the distributed terms are listed with the constant first.",
      },
    ];
    const bad: { m: number; k: number; feedback: string }[] = [
      {
        m,
        k: c,
        feedback: `Check by substituting $x=1$: the original gives ${a * (b + c) + d} and this expression gives ${m + c}. The ${a} must multiply ${c} too.`,
      },
      {
        m: a + b + d,
        k,
        feedback: `Check by substituting $x=1$: the original gives ${a * (b + c) + d} and this expression gives ${a + b + d + k}. ${tex(`${a}(${term(b)})`)} is ${tex(`${a * b}x`)}, not ${tex(`${a + b}x`)}.`,
      },
      {
        m: a * b - d,
        k,
        feedback: `Check by substituting $x=1$: the original gives ${a * (b + c) + d} and this expression gives ${a * b - d + k}. The ${d < 0 ? "negative" : "positive"} $x$ term must keep its sign.`,
      },
      {
        m: a * b,
        k,
        feedback: `Check by substituting $x=1$: the original gives ${a * (b + c) + d} and this expression gives ${a * b + k}. The ${term(d)} term is missing.`,
      },
      {
        m: b + d,
        k,
        feedback: `Check by substituting $x=1$: the original gives ${a * (b + c) + d} and this expression gives ${b + d + k}. The ${a} must multiply ${term(b)} too.`,
      },
    ].filter((e) => e.m !== m || e.k !== k);
    const wrong = pick(r, bad);
    const eqPool = [...equal];
    const keep: Wrong[] = [];
    while (keep.length < 3)
      keep.push(eqPool.splice(r(0, eqPool.length - 1), 1)[0]!);
    const label = lin(wrong.m, wrong.k);
    return {
      variant,
      prompt: `Which expression is NOT equivalent to ${tex(original)}?`,
      answer: "",
      hint: `Expand ${a}(${term(b)} ${sgn(c)} ${Math.abs(c)}) first, then combine the $x$ terms. An equivalent expression has the same value for every $x$. Check each choice at $x=1$ if you want a quick test.`,
      explanation: [
        `Distribute: ${tex(`${a}(${term(b)} ${sgn(c)} ${Math.abs(c)})=${term(a * b)} ${sgn(c * a)} ${Math.abs(c * a)}`)}.`,
        `Add ${tex(`${d < 0 ? "-" : "+"} ${term(Math.abs(d))}`)} and combine the $x$ terms: ${tex(lin(m, k))}.`,
        `At x = 1 the original is ${a * (b + c) + d}. ${tex(label)} gives ${wrong.m + wrong.k}, so it is the one that is not equivalent.`,
      ],
      choices: choicesFrom(
        r,
        tex(label),
        keep.map((w) => ({ label: tex(w.label), feedback: w.feedback })),
      ),
    };
  }
  if (variant === "one-value-check") {
    const a = r(2, 6);
    const b = r(1, 7);
    return {
      variant,
      prompt: `Sam checks whether ${tex(`${a}(x + ${b})`)} and ${tex(`x + ${a * b}`)} are equivalent by substituting x = 0. Both expressions give ${a * b}. Which conclusion is correct?`,
      answer: "",
      hint: `Equivalent expressions match for every value of $x$. Matching at $x=0$, where both give ${a * b}, does not show that. Try $x=1$ in ${tex(`${a}(x + ${b})`)} and ${tex(`x + ${a * b}`)}.`,
      explanation: [
        `At x = 1 the first expression is ${tex(`${a}(1 + ${b})=${a + a * b}`)}.`,
        `At x = 1 the second expression is ${tex(`1 + ${a * b}=${1 + a * b}`)}.`,
        `The values differ, so the expressions are not equivalent. Distributing gives ${tex(`${a}(x + ${b})=${a}x + ${a * b}`)}, which has ${tex(`${a}x`)}, not $x$.`,
      ],
      choices: choicesFrom(
        r,
        `Not equivalent: at x = 1 the first gives ${a + a * b} and the second gives ${1 + a * b}.`,
        [
          {
            label: "Equivalent, because they give the same value at x = 0.",
            feedback:
              "Matching at one value is not enough. Two different expressions can agree at one value and differ everywhere else.",
          },
          {
            label: `Equivalent, because both contain ${a * b}.`,
            feedback:
              "Sharing a number does not make expressions equivalent. Compare their values at other inputs, or distribute fully.",
          },
          {
            label:
              "Not equivalent, because one expression has parentheses and the other does not.",
            feedback:
              "Expressions written differently can be equivalent. The test is whether the values match for every $x$.",
          },
        ],
      ),
    };
  }
  if (variant === "combine") {
    const a = r(2, 6);
    const b = r(1, 7) * (r(0, 1) ? 1 : -1);
    let c = r(1, 6);
    if (c === a) c += 1;
    const d = r(1, 7);
    const m = a - c;
    const k = a * b + c * d;
    const original = `${a}(x ${sgn(b)} ${Math.abs(b)}) - ${c}(x - ${d})`;
    const candidates: Wrong[] = [
      {
        label: lin(m, a * b - c * d),
        feedback: `The ${c} multiplies -${d}, giving ${c * d} with a plus sign, not a minus sign. A subtracted negative adds.`,
      },
      {
        label: lin(a + c, k),
        feedback: `The minus sign applies to ${tex(`${c}x`)} as well, so the $x$ terms are ${tex(`${a}x - ${c}x`)}.`,
      },
      {
        label: lin(m, b + c * d),
        feedback: `The ${a} multiplies ${b} too, giving ${a * b}.`,
      },
      {
        label: lin(a + c, a * b - c * d),
        feedback: `Two slips: the minus sign applies to ${tex(`${c}x`)} as well, and ${c} multiplies ${tex(`-${d}`)} to give ${tex(`+${c * d}`)}.`,
      },
    ];
    return {
      variant,
      prompt: `Which expression is equivalent to ${tex(original)}?`,
      answer: "",
      hint: `Distribute ${a} across the first parentheses and ${tex(`-${c}`)} across the second, keeping the sign of each product. Then combine the $x$ terms and the numbers separately.`,
      explanation: [
        `${tex(`${a}(x ${sgn(b)} ${Math.abs(b)})=${a}x ${sgn(a * b)} ${Math.abs(a * b)}`)}.`,
        `${tex(`-${c}(x - ${d})=-${c}x + ${c * d}`)}.`,
        `Combine: $x$ terms ${tex(`${a}x - ${c}x=${term(m)}`)}; numbers ${tex(`${a * b}${c * d >= 0 ? " + " : " - "}${c * d}=${k}`)}. The result is ${tex(lin(m, k))}.`,
      ],
      choices: choicesFrom(
        r,
        tex(lin(m, k)),
        candidates.map((w) => ({ label: tex(w.label), feedback: w.feedback })),
      ),
    };
  }
  // factor
  const g = r(2, 6);
  let p = r(1, 5);
  if (p === g) p = g === 5 ? 4 : g + 1;
  const q = r(1, 7) * (r(0, 1) ? 1 : -1);
  const m = g * p;
  const k = g * q;
  const open = (p0: number, q0: number) =>
    `${g}(${term(p0)} ${sgn(q0)} ${Math.abs(q0)})`;
  return {
    variant,
    prompt: `Which expression is equivalent to ${tex(lin(m, k))}?`,
    answer: "",
    hint: `Both ${m} and ${Math.abs(k)} are multiples of ${g}. Take ${g} out of each term, then check the choice by distributing it back.`,
    explanation: [
      `${m} = ${g} × ${p} and ${Math.abs(k)} = ${g} × ${Math.abs(q)}.`,
      `So ${tex(lin(m, k))} = ${tex(open(p, q))}.`,
      `Check by distributing: ${tex(`${g}\\cdot ${term(p)}=${m}x`)} and ${tex(`${g}\\cdot ${q}=${k}`)}.`,
    ],
    choices: choicesFrom(r, tex(open(p, q)), [
      {
        label: tex(open(p, k)),
        feedback: `${g} times ${k} would be ${g * k}, not ${k}. Divide the number term by ${g} too.`,
      },
      {
        label: tex(open(p, g * q)),
        feedback: `Distributing ${g} gives ${g * g * q} for the number term, but the original has ${k}. Divide ${k} by ${g} instead of multiplying.`,
      },
      {
        label: tex(open(p, -q)),
        feedback: `Distributing ${g} gives ${g * -q}, but the original number term is ${k}. Keep the sign.`,
      },
      {
        label: tex(`${g}(${term(g)} ${sgn(q)} ${Math.abs(q)})`),
        feedback: `${tex(`${g}(${term(g)})`)} is ${tex(`${g * g}x`)}, but the $x$ term is ${tex(term(m))}. Divide ${m} by ${g}.`,
      },
      {
        label: tex(`${p === 1 ? "" : p}(${term(g)} ${sgn(q)} ${Math.abs(q)})`),
        feedback: `Distributing ${p} gives ${term(p * g)} ${sgn(q * p)} ${Math.abs(q * p)}, which does not match the number term ${k}.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* area-tiling-distributive                                                */
/* ---------------------------------------------------------------------- */

const unitWords = {
  cm: ["centimeters", "square centimeters"],
  m: ["meters", "square meters"],
  in: ["inches", "square inches"],
  ft: ["feet", "square feet"],
} as const;

function areaTiling(r: Random): Built {
  const variant = ["array-split", "area-model-sum", "l-shape", "not-equal"][
    r(0, 3)
  ]!;
  if (variant === "array-split") {
    const rows = r(4, 9);
    const columns = r(3, 9);
    const split = r(1, rows - 1);
    const figure: SemanticFigure = {
      kind: "unit-array",
      rows,
      columns,
      splitAfterRow: split,
    };
    const total = rows * columns;
    const upper = split;
    const lower = rows - split;
    const options = [
      {
        label: `${upper} × ${columns} + ${lower} × ${columns}`,
        value: total,
        feedback: "",
      },
    ];
    const wrongs: Wrong[] = [];
    const tries: [string, number, string][] = [
      [
        `${upper} × ${columns} + ${lower}`,
        upper * columns + lower,
        "Region B has several rows of squares, so multiply its rows by the squares in a row too.",
      ],
      [
        `${upper} + ${lower} × ${columns}`,
        upper + lower * columns,
        "Region A also has several rows of squares. Multiply its rows by the squares in a row.",
      ],
      [
        `${upper} × ${lower} × ${columns}`,
        upper * lower * columns,
        "The two regions are added, not multiplied. Each region's squares are rows times squares in a row.",
      ],
      [
        `${upper} × ${columns} + ${lower} × ${rows}`,
        upper * columns + lower * rows,
        `Every row has ${columns} squares, including the rows of region B. Use ${columns}, not ${rows}.`,
      ],
      [
        `${upper} × ${rows} + ${lower} × ${columns}`,
        upper * rows + lower * columns,
        `Region A has ${columns} squares in each row, not ${rows}. The number of squares in a row is the width.`,
      ],
      [
        `${rows} × ${columns} + ${columns}`,
        total + columns,
        "The two regions already make up the whole rectangle. Do not count another row.",
      ],
    ];
    for (const [label, value, feedback] of tries)
      if (value !== total) wrongs.push({ label, feedback });
    return {
      variant,
      figure,
      prompt: `A rectangle is tiled with unit squares: ${rows} rows of ${columns} squares. The heavy line splits it into region A and region B. Which number sentence uses the two regions to find the total number of squares?`,
      answer: "",
      hint: `Region A is the top ${upper} ${upper === 1 ? "row" : "rows"} and region B is the rest of the ${rows} rows. Each row has ${columns} squares, so count each region as rows times ${columns}, then add the two regions.`,
      explanation: [
        `Region A has ${upper} ${upper === 1 ? "row" : "rows"} of ${columns} squares: ${upper} × ${columns} = ${upper * columns}.`,
        `Region B has ${lower} ${lower === 1 ? "row" : "rows"} of ${columns} squares: ${lower} × ${columns} = ${lower * columns}.`,
        `Add: ${upper * columns} + ${lower * columns} = ${total}. This equals ${rows} × ${columns} = ${total}, so ${rows} × ${columns} = ${upper} × ${columns} + ${lower} × ${columns}.`,
      ],
      choices: choicesFrom(r, options[0]!.label, wrongs),
    };
  }
  if (variant === "area-model-sum") {
    const height = r(3, 9);
    const left = pick(r, [10, 10, 20, 5, 6]);
    const right = r(2, 5);
    const figure: SemanticFigure = {
      kind: "area-model",
      columns: [left, right],
      rows: [height],
    };
    const part = height * left;
    const total = height * (left + right);
    const tries: [number, string][] = [
      [
        part + right,
        `The right part is ${height} rows of ${right}, so add ${height} × ${right}, not just ${right}.`,
      ],
      [
        part + height,
        `The right part is ${right} columns wide and ${height} tall: add ${height} × ${right}.`,
      ],
      [
        height * right,
        `That is only the right part. The whole rectangle includes the left part, ${part}.`,
      ],
      [part * right, "The two parts are added, not multiplied."],
      [
        part + left + right,
        `Add the area of the right part, ${height} × ${right}, not its width plus the left width.`,
      ],
    ];
    return {
      variant,
      figure,
      prompt: `The rectangle is ${height} units tall. It is split into a left part ${left} units wide and a right part ${right} units wide. The left part has area ${part} square units. What is the area of the whole rectangle, in square units?`,
      answer: "",
      hint: `Find the area of the right part as height times width, then add it to the ${part} square units of the left part.`,
      explanation: [
        `The right part is ${height} tall and ${right} wide: ${height} × ${right} = ${height * right}.`,
        `Add the parts: ${part} + ${height * right} = ${total} square units.`,
        `Check: the whole width is ${left} + ${right} = ${left + right}, and ${height} × ${left + right} = ${total}.`,
      ],
      choices: choicesFrom(
        r,
        String(total),
        tries
          .filter(([v]) => v !== total)
          .map(([v, feedback]) => ({ label: String(v), feedback })),
      ),
    };
  }
  if (variant === "l-shape") {
    const W = r(5, 9);
    const H = r(5, 9);
    const w1 = r(2, W - 2);
    const h1 = r(2, H - 2);
    const u = pick(r, ["cm", "m", "in", "ft"] as const);
    const horizontal = r(0, 1) === 1;
    // Corner notch removed from the upper right: bottom W × h1, top w1 × (H − h1).
    const vertices: [number, number][] = [
      [0, 0],
      [W, 0],
      [W, h1],
      [w1, h1],
      [w1, H],
      [0, H],
    ];
    const sides = [W, h1, W - w1, H - h1, w1, H];
    // A dashed segment is drawn above the fill only as a height, so the split
    // line carries its own length label.
    const split = horizontal
      ? {
          from: [w1, h1] as [number, number],
          to: [0, h1] as [number, number],
          value: w1,
        }
      : {
          from: [w1, h1] as [number, number],
          to: [w1, 0] as [number, number],
          value: h1,
        };
    const parts = horizontal
      ? [W * h1, w1 * (H - h1)]
      : [w1 * H, (W - w1) * h1];
    const total = parts[0]! + parts[1]!;
    const figure: SemanticFigure = {
      kind: "measured-polygon",
      unit: u,
      vertices,
      sides,
      heights: [split],
      guides: [],
      rightAngles: [0, 1, 4, 5],
    };
    const partText = horizontal
      ? [`${W} × ${h1} = ${parts[0]}`, `${w1} × ${H - h1} = ${parts[1]}`]
      : [`${w1} × ${H} = ${parts[0]}`, `${W - w1} × ${h1} = ${parts[1]}`];
    const tries: [number, string][] = [
      [
        W * H,
        "That is the area of the whole rectangle around the figure. The missing corner is not part of the figure.",
      ],
      [
        Math.max(...parts),
        "That is only one of the two rectangles. Add the other rectangle too.",
      ],
      [
        horizontal ? W * h1 + w1 * H : w1 * H + W * h1,
        "That counts the overlap twice. The two rectangles must not share any squares.",
      ],
      [
        sides.reduce((s, v) => s + v, 0),
        "That adds the side lengths, which is the perimeter. Area counts square units inside.",
      ],
    ];
    return {
      variant,
      figure,
      prompt: `All corners of the figure are right angles. The dashed line splits it into two rectangles. Lengths are in ${unitWords[u][0]}. What is the area of the figure, in ${unitWords[u][1]}?`,
      answer: "",
      hint: `Find the length and width of each of the two rectangles made by the dashed line. Some of them are given on the sides of the figure. Multiply for each rectangle, then add the areas.`,
      explanation: [
        horizontal
          ? `The bottom rectangle is ${W} by ${h1}. The top rectangle is ${w1} wide and ${H} − ${h1} = ${H - h1} tall.`
          : `The left rectangle is ${w1} wide and ${H} tall. The right rectangle is ${W} − ${w1} = ${W - w1} wide and ${h1} tall.`,
        `Areas: ${partText.join(" and ")}.`,
        `Add: ${parts[0]} + ${parts[1]} = ${total} ${unitWords[u][1]}.`,
      ],
      choices: choicesFrom(
        r,
        String(total),
        tries
          .filter(([v]) => v !== total)
          .map(([v, feedback]) => ({ label: String(v), feedback })),
      ),
    };
  }
  // not-equal
  const t = pick(r, [10, 10, 20, 5, 6]);
  let u2 = r(2, 6);
  if (u2 === t) u2 += 1;
  let a = r(3, 8);
  if (a === t + u2) a += 1;
  const figure: SemanticFigure = {
    kind: "area-model",
    columns: [t, u2],
    rows: [a],
  };
  const total = a * (t + u2);
  const equalPool: Wrong[] = [
    {
      label: `${a} × ${t} + ${a} × ${u2}`,
      feedback: `This gives ${a * t} + ${a * u2} = ${total}, the area of the rectangle.`,
    },
    {
      label: `${a} × ${t + u2}`,
      feedback: `This is height times the whole width: ${total}, the area of the rectangle.`,
    },
    {
      label: `${a} × ${u2} + ${a} × ${t}`,
      feedback: `The same two parts in the other order: ${a * u2} + ${a * t} = ${total}.`,
    },
    {
      label: `${t + u2} × ${a}`,
      feedback: `Width times height gives the same area, ${total}.`,
    },
  ];
  const wrongSentences: [string, number][] = [
    [`${a} × ${t} + ${u2}`, a * t + u2],
    [`${a} + ${t} × ${u2}`, a + t * u2],
    [`${a} × ${t} × ${u2}`, a * t * u2],
    [`(${a} + ${t}) × ${u2}`, (a + t) * u2],
  ];
  const [badLabel, badValue] = pick(
    r,
    wrongSentences.filter(([, v]) => v !== total),
  );
  const keep: Wrong[] = [];
  while (keep.length < 3)
    keep.push(equalPool.splice(r(0, equalPool.length - 1), 1)[0]!);
  return {
    variant,
    figure,
    prompt: `The rectangle is ${a} units tall and ${t + u2} units wide. It is split into parts ${t} and ${u2} units wide. Which number sentence does NOT give the area of the rectangle?`,
    answer: "",
    hint: `The area is height ${a} times width ${t + u2}. Work out the value of each choice. Three of them equal the area of the rectangle, and one does not.`,
    explanation: [
      `The area of the rectangle is ${a} × ${t + u2} = ${total} square units, and splitting it gives ${a} × ${t} + ${a} × ${u2} = ${a * t} + ${a * u2} = ${total}.`,
      `${badLabel} = ${badValue}, which is not ${total}.`,
      `Each part's area is height times its own width, so both widths must be multiplied by ${a}.`,
    ],
    choices: choicesFrom(r, badLabel, keep),
  };
}

/* ---------------------------------------------------------------------- */
/* estimate-reasonableness                                                 */
/* ---------------------------------------------------------------------- */

const noFive = (r: Random, lo: number, hi: number) => {
  let n: number;
  do n = r(lo, hi);
  while (n % 10 === 5 || n % 10 === 0);
  return n;
};

/** Two-digit numbers within 2 of a multiple of ten, so rounded products stay close. */
const nearTen = (r: Random) => r(2, 9) * 10 + pick(r, [1, 2, 8, 9]);

function estimateReasonableness(r: Random): Built {
  const variant = ["best-product", "verdict", "two-step", "quotient"][r(0, 3)]!;
  if (variant === "best-product") {
    const story = pick(r, [
      ["A school orders", "boxes with", "pencils in each box", "pencils"],
      ["A bakery bakes", "trays with", "rolls on each tray", "rolls"],
      ["A library shelves", "carts with", "books on each cart", "books"],
      ["A farm packs", "crates with", "apples in each crate", "apples"],
    ] as const);
    const a = noFive(r, 12, 98);
    const b = noFive(r, 12, 98);
    const ra = round10(a);
    const rb = round10(b);
    const est = ra * rb;
    return {
      variant,
      prompt: `${story[0]} ${a} ${story[1]} ${b} ${story[2]}. Round each number to the nearest ten. Which is the best estimate of the total number of ${story[3]}?`,
      answer: "",
      hint: `Round ${a} and ${b} to the nearest ten first. Then decide whether the story joins equal groups, which calls for multiplication, or adds amounts.`,
      explanation: [
        `${a} rounds to ${ra} and ${b} rounds to ${rb}.`,
        `Equal groups call for multiplication: ${ra} × ${rb} = ${commas(est)}.`,
        `The best estimate is about ${commas(est)} ${story[3]}.`,
      ],
      choices: choicesFrom(r, commas(est), [
        {
          label: commas(ra + rb),
          feedback: `The story joins ${a} equal groups of ${b}, so multiply the rounded numbers instead of adding them.`,
        },
        {
          label: commas(est * 10),
          feedback: `${ra} × ${rb} has ${String(est).length} digits. Check the number of zeros: the estimate is 10 times too large.`,
        },
        {
          label: commas(est / 10),
          feedback: `Check the number of zeros: ${ra} × ${rb} is 10 times greater than this.`,
        },
        {
          label: commas((ra + rb) * 10),
          feedback: "Equal groups call for multiplication, not addition.",
        },
      ]),
    };
  }
  if (variant === "verdict") {
    const a = nearTen(r);
    const b = nearTen(r);
    const ra = round10(a);
    const rb = round10(b);
    const est = ra * rb;
    const exact = a * b;
    const reasonable = r(0, 1) === 1;
    const claim = reasonable
      ? exact
      : r(0, 1)
        ? exact * 10
        : Math.round(exact / 10);
    const yes = `Reasonable. Rounding gives ${ra} × ${rb} = ${commas(est)}, which is close to ${commas(claim)}.`;
    const no = `Not reasonable. Rounding gives ${ra} × ${rb} = ${commas(est)}, so the answer should be near ${commas(est)}, not ${commas(claim)}.`;
    return {
      variant,
      prompt: `Kai calculated ${a} × ${b} = ${commas(claim)}. Use rounding to the nearest ten to decide whether this answer is reasonable. Which statement is correct?`,
      answer: "",
      hint: `Round ${a} and ${b} to the nearest ten, multiply the rounded numbers, and compare that estimate with Kai's answer. An estimate cannot show the exact digits, but it can show whether the size is right.`,
      explanation: [
        `${a} rounds to ${ra} and ${b} rounds to ${rb}.`,
        `${ra} × ${rb} = ${commas(est)}.`,
        reasonable
          ? `Kai's answer ${commas(claim)} is close to ${commas(est)}, so it is reasonable.`
          : `Kai's answer ${commas(claim)} is far from ${commas(est)}, so it is not reasonable.`,
      ],
      choices: choicesFrom(r, reasonable ? yes : no, [
        {
          label: reasonable ? no : yes,
          feedback: reasonable
            ? `Compare the sizes: ${commas(est)} and ${commas(claim)} are close, so the answer is reasonable.`
            : `${commas(est)} and ${commas(claim)} are not close, so the answer is not reasonable.`,
        },
        {
          label: `Cannot tell without finding the exact product of ${a} and ${b}.`,
          feedback:
            "Rounding gives a quick estimate. If the answer is far from the estimate, the exact work has an error.",
        },
        {
          label: `Reasonable, because ${commas(claim)} is a whole number.`,
          feedback:
            "Whole numbers can be any size. Compare the size of the answer with the estimate.",
        },
      ]),
    };
  }
  if (variant === "two-step") {
    const t1 = r(3, 9);
    let t2 = r(3, 9);
    if (t2 === t1) t2 = t1 === 9 ? 8 : t1 + 1;
    const n1 = noFive(r, 12, 98);
    const n2 = noFive(r, 12, 98);
    const e1 = t1 * round10(n1);
    const e2 = t2 * round10(n2);
    const est = e1 + e2;
    return {
      variant,
      prompt: `A bakery fills ${t1} trays with ${n1} rolls each in the morning and ${t2} trays with ${n2} rolls each in the afternoon. Round the number on each tray to the nearest ten. Which is the best estimate of the total number of rolls?`,
      answer: "",
      hint: `Estimate the ${t1} morning trays and the ${t2} afternoon trays separately: round ${n1} and ${n2} to the nearest ten, multiply by the trays, then combine the two estimates.`,
      explanation: [
        `Morning: ${t1} × ${round10(n1)} = ${commas(e1)}.`,
        `Afternoon: ${t2} × ${round10(n2)} = ${commas(e2)}.`,
        `Together: ${commas(e1)} + ${commas(e2)} = ${commas(est)} rolls.`,
      ],
      choices: choicesFrom(r, commas(est), [
        {
          label: commas(e1),
          feedback:
            "That is only the morning rolls. The afternoon rolls are part of the total too.",
        },
        {
          label: commas(e1 + t2 + round10(n2)),
          feedback: `The afternoon rolls are ${t2} trays of ${round10(n2)}, so multiply before adding.`,
        },
        {
          label: commas((t1 + t2) * (round10(n1) + round10(n2))),
          feedback:
            "Multiply each time period's trays by its own rolls per tray, then add. Do not add the factors first.",
        },
        {
          label: commas(round10(n1) + round10(n2)),
          feedback:
            "That adds the rolls on one tray from each period but ignores how many trays there are.",
        },
      ]),
    };
  }
  // quotient
  const seats = pick(r, [20, 50]);
  const b = seats + pick(r, [-3, -2, -1, 1, 2, 3]);
  let n: number;
  do n = r(250, 849);
  while (n % 100 < 10 || (n % 100 > 40 && n % 100 < 60) || n % 100 > 90);
  const rn = round100(n);
  const est = rn / seats;
  return {
    variant: "quotient",
    prompt: `${n} students ride to a game on buses that each seat ${b}. Round ${n} to the nearest hundred and ${b} to the nearest ten. Which is the best estimate of the number of buses needed?`,
    answer: "",
    hint: `Round ${n} and ${b} as asked. The rounded numbers divide evenly, because the story shares students equally among buses, so divide.`,
    explanation: [
      `${n} rounds to ${rn}, and ${b} rounds to ${seats}.`,
      `Share the students among the buses: ${rn} ÷ ${seats} = ${est}.`,
      `The best estimate is about ${est} buses.`,
    ],
    choices: choicesFrom(r, String(est), [
      {
        label: String(est * 10),
        feedback: `Check the place value: ${rn} ÷ ${seats} is 10 times smaller than this.`,
      },
      {
        label: String(rn - seats),
        feedback:
          "The story shares students among buses, which is division, not subtraction.",
      },
      {
        label: String(rn + seats),
        feedback:
          "The story shares students among buses, which is division, not addition.",
      },
      {
        label: String(rn * seats),
        feedback:
          "Seats and students are related by dividing: each bus holds a part of the students.",
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* unit-chain-conversion                                                   */
/* ---------------------------------------------------------------------- */

function unitChain(r: Random): Built {
  const variant = [
    "dose",
    "tablets",
    "density-mass",
    "density-volume",
    "speed-distance",
    "flow-volume",
    "floor-tiles",
    "tank-liters",
  ][r(0, 7)]!;
  const numeric = (
    prompt: string,
    answer: number,
    hint: string,
    explanation: string[],
  ): Built => ({
    variant,
    prompt,
    answer: String(answer),
    hint,
    explanation,
    fraction: true,
  });
  if (variant === "dose" || variant === "tablets") {
    let W = 0,
      D = 0,
      n = 0,
      T = 0;
    for (;;) {
      W = r(10, 60);
      D = pick(r, [5, 10, 15, 20, 25, 30, 40]);
      n = r(2, 4);
      T = pick(r, [50, 100, 250, 500]);
      const dose = (W * D) / n;
      if (Number.isInteger(dose) && (variant === "dose" || dose % T === 0))
        break;
    }
    const dose = (W * D) / n;
    const base = `A doctor orders ${D} milligrams of a medicine per kilogram of body mass per day. A patient's mass is ${W} kilograms. The daily amount is split into ${n} equal doses`;
    if (variant === "dose")
      return numeric(
        `${base}. How many milligrams are in one dose?`,
        dose,
        `Start from ${D} milligrams per kilogram per day. Multiply by the patient's kilograms to get milligrams per day, then divide by the number of doses.`,
        [
          `Daily amount: ${D} mg/kg/day × ${W} kg = ${W * D} mg per day.`,
          `One dose: ${W * D} mg ÷ ${n} doses = ${dose} mg.`,
        ],
      );
    return numeric(
      `${base}. Each tablet contains ${T} milligrams. How many tablets are in one dose?`,
      dose / T,
      `First find the milligrams in one dose from ${D} milligrams per kilogram per day and ${W} kilograms. Then count how many ${T}-milligram tablets make that dose.`,
      [
        `Daily amount: ${D} × ${W} = ${W * D} mg per day.`,
        `One dose: ${W * D} ÷ ${n} = ${dose} mg.`,
        `Tablets per dose: ${dose} ÷ ${T} = ${dose / T}.`,
      ],
    );
  }
  if (variant === "density-mass" || variant === "density-volume") {
    const d = pick(r, [2, 4, 5, 8, 10]);
    const M = r(2, 30);
    const V = (M * 1000) / d;
    if (variant === "density-mass")
      return numeric(
        `A solid block of metal has volume ${commas(V)} cubic centimeters and density ${d} grams per cubic centimeter. Given 1 kilogram = 1000 grams, what is its mass in kilograms?`,
        M,
        `Multiply the volume by the density to get grams. Then use 1 kilogram = 1000 grams to change the unit.`,
        [
          `Mass in grams: ${commas(V)} cm³ × ${d} g/cm³ = ${commas(V * d)} g.`,
          `In kilograms: ${commas(V * d)} ÷ 1000 = ${M} kg.`,
        ],
      );
    return numeric(
      `A solid block of metal has mass ${M} kilograms and density ${d} grams per cubic centimeter. Given 1 kilogram = 1000 grams, what is its volume in cubic centimeters?`,
      V,
      `Change ${M} kilograms to grams first. Then ask how many cubic centimeters have that mass at ${d} grams per cubic centimeter.`,
      [
        `Mass in grams: ${M} × 1000 = ${commas(M * 1000)} g.`,
        `Volume: ${commas(M * 1000)} g ÷ ${d} g/cm³ = ${commas(V)} cm³.`,
      ],
    );
  }
  if (variant === "speed-distance") {
    let s = 0,
      m = 0;
    do {
      s = pick(r, [12, 15, 18, 21, 24, 30, 36]);
      m = r(1, 9) * 5;
    } while ((s * m) % 3 !== 0);
    const meters = (s * 1000 * m) / 60;
    return numeric(
      `A cyclist rides at a steady ${s} kilometers per hour for ${m} minutes. Given 1 kilometer = 1000 meters and 1 hour = 60 minutes, how many meters does the cyclist ride?`,
      meters,
      `Speed is ${s} kilometers per hour but time is ${m} minutes. Change the minutes to hours (or the speed to meters per minute), then multiply and change kilometers to meters.`,
      [
        `${m} minutes = ${m}/60 hour.`,
        `Distance in kilometers: ${s} × ${m}/60 = ${(s * m) / 60} km.`,
        `In meters: ${(s * m) / 60} × 1000 = ${commas(meters)} m.`,
      ],
    );
  }
  if (variant === "flow-volume") {
    const L = pick(r, [50, 100, 150, 200, 250, 500]);
    const h = r(2, 9);
    const cubic = (L * 60 * h) / 1000;
    return numeric(
      `Water flows from a pipe at ${L} liters per minute. Given 1 hour = 60 minutes and 1 cubic meter = 1000 liters, how many cubic meters of water flow in ${h} hours?`,
      cubic,
      `Change ${h} hours to minutes, multiply by the flow in liters per minute, and then change liters to cubic meters.`,
      [
        `${h} hours = ${h * 60} minutes.`,
        `Liters: ${L} × ${h * 60} = ${commas(L * 60 * h)} L.`,
        `Cubic meters: ${commas(L * 60 * h)} ÷ 1000 = ${cubic} m³.`,
      ],
    );
  }
  if (variant === "floor-tiles") {
    const s = pick(r, [20, 25, 40, 50]);
    const L = s === 40 ? pick(r, [4, 6, 8]) : r(3, 9);
    const W = s === 40 ? pick(r, [4, 6, 8]) : r(3, 9);
    const tiles = ((L * 100) / s) * ((W * 100) / s);
    return numeric(
      `A rectangular floor measures ${L} meters by ${W} meters. It is covered with no gaps or overlaps by square tiles, each ${s} centimeters on a side. Given 1 meter = 100 centimeters, how many tiles are needed?`,
      tiles,
      `Use one unit for both the floor and the tile. Change the floor's sides to centimeters, find how many ${s}-centimeter tiles fit along each side, and multiply.`,
      [
        `Floor in centimeters: ${L * 100} cm by ${W * 100} cm.`,
        `Tiles along the sides: ${(L * 100) / s} and ${(W * 100) / s}.`,
        `Total tiles: ${(L * 100) / s} × ${(W * 100) / s} = ${tiles}.`,
      ],
    );
  }
  const a = r(1, 6);
  const b = r(1, 6);
  const c = r(1, 6);
  const liters = a * b * c * 1000;
  return numeric(
    `A tank is a rectangular box ${a} meters long, ${b} meters wide and ${c} meters high. Given 1 meter = 100 centimeters and 1 liter = 1000 cubic centimeters, how many liters does it hold when full?`,
    liters,
    `Find the volume in cubic meters. A cubic meter is 100 centimeters on each of three edges, so convert to cubic centimeters, then to liters.`,
    [
      `Volume: ${a} × ${b} × ${c} = ${a * b * c} m³.`,
      `1 m³ = 100 × 100 × 100 = 1,000,000 cm³, so the tank holds ${commas(a * b * c * 1000000)} cm³.`,
      `Liters: ${commas(a * b * c * 1000000)} ÷ 1000 = ${commas(liters)} L.`,
    ],
  );
}

/* ---------------------------------------------------------------------- */
/* fraction-of-set                                                         */
/* ---------------------------------------------------------------------- */

function fractionOfSet(r: Random): Built {
  const variant = ["part", "remainder", "from-unit-part"][r(0, 2)]!;
  const things = pick(r, ["marbles", "stickers", "counters", "buttons"]);
  const b = r(2, 6);
  const g = r(2, 8);
  const a = r(1, b - 1);
  const total = b * g;
  const figure: SemanticFigure = {
    kind: "grouped-counters",
    total,
    groupSize: g,
    unit: things,
  };
  const frac = (n: number) => tex(`\\frac{${n}}{${b}}`);
  if (variant === "part")
    return {
      variant,
      figure,
      prompt: `A set has ${total} ${things}. ${frac(a)} of the ${things} are red. How many are red?`,
      answer: String(a * g),
      hint: `The denominator ${b} tells you to split the ${total} ${things} into equal groups. Find how many are in one group, then take the number of groups the numerator names.`,
      explanation: [
        `Split ${total} into ${b} equal groups: ${total} ÷ ${b} = ${g} in each group.`,
        `${frac(a)} means ${a} of the ${b} groups: ${a} × ${g} = ${a * g}.`,
        `So ${a * g} of the ${things} are red.`,
      ],
    };
  if (variant === "remainder")
    return {
      variant,
      figure,
      prompt: `A set has ${total} ${things}. ${frac(a)} of the ${things} are red and the rest are blue. How many are blue?`,
      answer: String((b - a) * g),
      hint: `Split the ${total} ${things} into ${b} equal groups. Decide how many of those groups are not red.`,
      explanation: [
        `Split ${total} into ${b} equal groups: ${g} in each group.`,
        `${a} groups are red, so ${b} − ${a} = ${b - a} groups are blue.`,
        `${b - a} × ${g} = ${(b - a) * g} blue ${things}.`,
      ],
    };
  return {
    variant,
    prompt: `${frac(1)} of the ${things} in a box is ${g} ${things}. How many ${things} are in ${frac(a)} of the box?`,
    answer: String(a * g),
    hint: `${frac(1)} is one of ${b} equal parts, and that part is ${g} ${things}. ${frac(a)} is ${a} of those equal parts.`,
    explanation: [
      `One equal part is ${g} ${things}.`,
      `${frac(a)} is ${a} equal parts: ${a} × ${g} = ${a * g}.`,
      `So ${a * g} ${things} are in ${frac(a)} of the box.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */

const builders: Record<string, (r: Random) => Built> = {
  "signed-context-order": signedContextOrder,
  "equivalent-expressions-check": equivalentExpressions,
  "area-tiling-distributive": areaTiling,
  "estimate-reasonableness": estimateReasonableness,
  "unit-chain-conversion": unitChain,
  "fraction-of-set": fractionOfSet,
};
export const numberMeasurementGapTemplateIds = Object.keys(builders);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function leaks(draft: Draft): boolean {
  const text = `${draft.prompt}\n${draft.hint}`;
  const correct = draft.choices
    ? draft.choices.find((c) => c.correct)!.label
    : draft.answer;
  if (/^-?[\d,.]+$/.test(correct))
    return new RegExp(`(?<![\\d.,])${escape(correct)}(?![\\d]|[.,]\\d)`).test(
      text,
    );
  return text.includes(correct);
}

/** Private model: the variant is for tests; only the public problem is served. */
export function numberMeasurementGapCase(templateId: string, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = numberMeasurementGapTemplates.find((t) => t.id === templateId);
  const build = builders[templateId];
  if (!meta || !build) throw new Error(`Unknown template ${templateId}`);
  const r = random(meta.id, seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    let draft: Built;
    try {
      draft = build(r);
    } catch (error) {
      // Too few distinct wrong choices for these numbers: draw again.
      if (error instanceof Error && error.message.startsWith("Need three"))
        continue;
      throw error;
    }
    if (leaks(draft)) continue;
    return { variant: draft.variant, problem: assemble(meta, seed, r, draft) };
  }
  throw new Error("Could not generate a problem without leaking the answer");
}

export function generateNumberMeasurementGapProblem(
  templateId: string,
  seed: string,
) {
  return numberMeasurementGapCase(templateId, seed).problem;
}
