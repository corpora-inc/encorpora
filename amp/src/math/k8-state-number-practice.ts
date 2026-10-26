import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, type Random } from "./distribution-practice";

/* State-specific number sense, money, estimation and customary measurement
 * (TEKS, Florida B.E.S.T. and Virginia SOL requirements beyond the common
 * core). Every template attaches to an existing skill; each draws one private
 * exact model and derives the givens, choices and worked steps from it. */

type Choice = { label: string; correct?: true; feedback?: string };
type Draft = {
  prompt: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  answer?: string;
  responseLabel?: string;
  choices?: Choice[];
  /** Choices are in display order because their labels name figure positions. */
  ordered?: boolean;
  /** Skip the answer-in-prompt check when the answer is a digit shown in the prompt. */
  noLeakCheck?: boolean;
};
type Built = Draft & { variant: string };

const metadata = (
  id: string,
  title: string,
  skillId: string,
  gradeBand: "3–5" | "6–8",
  difficultyOffset: number,
  choice: boolean,
  description: string,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand,
  difficultyOffset,
  ...(choice
    ? { requiredResponseCapability: "single-choice-v1" as const }
    : {}),
  description,
});

export const k8StateNumberTemplates: readonly TemplateMetadata[] = [
  metadata(
    "divisibility-rule-check",
    "Use divisibility rules",
    "factors-multiples",
    "3–5",
    0.1,
    true,
    "Apply the divisibility rules for 2, 3, 4, 5, 6, 9 and 10 to choose which number is divisible by a given number, and find the digit that completes a number so that it is divisible.",
  ),
  metadata(
    "prime-composite-sort",
    "Prime, composite or neither",
    "factors-multiples",
    "3–5",
    0.2,
    true,
    "Choose the prime number, the composite number, or the number that is neither, among whole numbers to 144, using factor pairs.",
  ),
  metadata(
    "prime-factorization-exponents",
    "Write a prime factorization",
    "factors-multiples",
    "3–5",
    0.4,
    true,
    "Choose the complete prime factorization of a composite number to 144, written with exponents for repeated factors, including from the first split of a factor tree.",
  ),
  metadata(
    "prime-factorization-value",
    "Use a prime factorization",
    "factors-multiples",
    "3–5",
    0.45,
    false,
    "Evaluate a prime factorization written with exponents, count the prime factors of a number, or find its greatest prime factor.",
  ),
  metadata(
    "decimal-money-change",
    "Change and cost in dollars and cents",
    "money-values",
    "3–5",
    0.5,
    false,
    "Find change, the total of several purchases, an amount still needed, or an unknown cost using decimal dollar amounts.",
  ),
  metadata(
    "fewest-coins-change",
    "Make change with the fewest coins",
    "money-values",
    "3–5",
    0.4,
    false,
    "Find the fewest bills and coins that make a given amount of change, using the largest piece that fits at each step.",
  ),
  metadata(
    "compare-money-sets",
    "Compare sets of bills and coins",
    "money-values",
    "3–5",
    0.3,
    true,
    "Read three drawn sets of one-dollar bills and coins and choose the set worth the most, the least, or an exact amount in dollars and cents.",
  ),
  metadata(
    "customary-unit-rename",
    "Rename customary units as smaller units",
    "unit-conversion",
    "3–5",
    0.3,
    false,
    "Rename a length, weight or capacity in a larger customary unit as a smaller unit, in a statement, a story, or a comparison of two measures.",
  ),
  metadata(
    "customary-unit-reverse",
    "Rename customary units as larger units",
    "measurement-conversions",
    "3–5",
    0.4,
    false,
    "Rename a customary measure as a larger unit, find the whole larger units in a smaller measure, or convert across two customary steps.",
  ),
  metadata(
    "customary-mixed-units",
    "Mixed customary units",
    "measurement-conversions",
    "3–5",
    0.6,
    true,
    "Rename a mixed measure such as 3 ft 8 in as one unit and back, and add or subtract mixed customary measures with regrouping.",
  ),
  metadata(
    "customary-unit-choice",
    "Choose a reasonable customary unit",
    "unit-conversion",
    "3–5",
    0.1,
    true,
    "Choose the customary unit that makes a measure reasonable for an everyday object, with the other units too large or too small.",
  ),
  metadata(
    "compatible-number-estimate",
    "Estimate with compatible and front-end numbers",
    "multistep-whole-stories",
    "3–5",
    0.5,
    true,
    "Estimate a quotient or product by changing a number to a compatible number as directed, and estimate a sum by its front-end digits.",
  ),
  metadata(
    "benchmark-percent-estimate",
    "Estimate a percent with benchmarks",
    "percentages",
    "6–8",
    0.4,
    true,
    "Round a price, then use 10%, 5% and 25% benchmarks to estimate a tip, sales tax, discount or sale price.",
  ),
];
export const k8StateNumberTemplateIds = k8StateNumberTemplates.map((t) => t.id);

/* ---------------------------------------------------------------------- */
/* Helpers                                                                 */
/* ---------------------------------------------------------------------- */

const pick = <T>(r: Random, xs: readonly T[]): T => xs[r(0, xs.length - 1)]!;
function shuffle<T>(r: Random, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = r(0, i);
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}
const commas = (n: number) => n.toLocaleString("en-US");
const NAMES = ["Ava", "Ben", "Carla", "Dev", "Ella", "Finn", "Gia", "Hugo"];
const dl = (cents: number) => (cents / 100).toFixed(2);
/** A dollar amount for prose: whole dollars stay whole. */
const dollarsText = (cents: number) =>
  cents % 100 === 0 ? `${cents / 100}` : dl(cents);
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Four distinct choices: the correct one plus three distinct wrong labels. */
function choicesFrom(
  correct: string,
  wrong: { label: string; feedback: string }[],
): Choice[] {
  const seen = new Set([correct]);
  const out: Choice[] = [{ label: correct, correct: true }];
  for (const w of wrong) {
    if (seen.has(w.label)) continue;
    seen.add(w.label);
    out.push(w);
    if (out.length === 4) return out;
  }
  throw new Error("Need three distinct wrong choices");
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function leaks(draft: Draft): boolean {
  if (draft.noLeakCheck) return false;
  const text = `${draft.prompt}\n${draft.hint}`;
  const correct = draft.choices
    ? draft.choices.find((c) => c.correct)!.label
    : draft.answer!;
  if (/^[\d,.]+$/.test(correct))
    return new RegExp(
      `(?<![\\d.,])${escapeRegex(correct)}(?![\\d]|[.,]\\d)`,
    ).test(text);
  return text.includes(correct);
}

/* ---------------------------------------------------------------------- */
/* Number theory                                                           */
/* ---------------------------------------------------------------------- */

export const isPrime = (n: number): boolean => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
/** Prime factors with multiplicity, ascending. */
export function primeFactors(n: number): number[] {
  const out: number[] = [];
  for (let d = 2, m = n; m > 1; d++)
    while (m % d === 0) {
      out.push(d);
      m /= d;
    }
  return out;
}
type Power = [base: number, exponent: number];
function powers(n: number): Power[] {
  const out: Power[] = [];
  for (const p of primeFactors(n)) {
    const last = out[out.length - 1];
    if (last && last[0] === p) last[1]++;
    else out.push([p, 1]);
  }
  return out;
}
const factorLabel = (ps: Power[]) =>
  `$${ps.map(([b, e]) => (e === 1 ? `${b}` : `${b}^{${e}}`)).join("\\times ")}$`;
const productOf = (ps: Power[]) => ps.reduce((a, [b, e]) => a * b ** e, 1);
const plainProduct = (ps: Power[]) =>
  ps.map(([b, e]) => (e === 1 ? `${b}` : `${b}^${e}`)).join(" × ");
const digitsOf = (n: number) => String(n).split("").map(Number);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Why n is or is not divisible by d, as a statement a learner can check. */
function divisibilityReason(
  n: number,
  d: number,
): { ok: boolean; why: string } {
  const ok = n % d === 0;
  const ds = digitsOf(n);
  const s = sum(ds);
  const sumText = `${ds.join(" + ")} = ${s}`;
  const last2 = n % 100;
  switch (d) {
    case 2:
      return {
        ok,
        why: `its last digit is ${n % 10}, which is ${ok ? "even" : "odd"}`,
      };
    case 3:
    case 9:
      return {
        ok,
        why: `its digits add to ${sumText}, and ${s} ${ok ? "is" : "is not"} a multiple of ${d}`,
      };
    case 4:
      return {
        ok,
        why: `its last two digits make ${last2}, and ${last2} ${ok ? "is" : "is not"} a multiple of 4`,
      };
    case 5:
      return {
        ok,
        why: `its last digit is ${n % 10}, and a multiple of 5 ends in 0 or 5`,
      };
    case 6: {
      const even = n % 2 === 0,
        three = s % 3 === 0;
      return {
        ok,
        why: `${even ? "it is even" : `its last digit ${n % 10} is odd, so it is not even`}, and its digits add to ${sumText}, which ${three ? "is" : "is not"} a multiple of 3`,
      };
    }
    default:
      return {
        ok,
        why: `its last digit is ${n % 10}, and a multiple of 10 ends in 0`,
      };
  }
}
const RULE_TEXT: Record<number, string> = {
  2: "A number is divisible by 2 when its last digit is 0, 2, 4, 6 or 8.",
  3: "A number is divisible by 3 when the sum of its digits is divisible by 3.",
  4: "A number is divisible by 4 when the number made by its last two digits is divisible by 4.",
  5: "A number is divisible by 5 when its last digit is 0 or 5.",
  6: "A number is divisible by 6 when it is divisible by both 2 and 3: it is even and its digits add to a multiple of 3.",
  9: "A number is divisible by 9 when the sum of its digits is divisible by 9.",
  10: "A number is divisible by 10 when its last digit is 0.",
};
/** A weaker rule that the near-miss numbers satisfy. */
const NEAR_MISS: Record<number, (n: number) => boolean> = {
  3: (n) => [3, 6, 9].includes(n % 10),
  4: (n) => n % 2 === 0,
  5: (n) => n % 10 === 2 || n % 10 === 7 || n % 10 === 4,
  6: (n) => n % 2 === 0 || n % 3 === 0,
  9: (n) => n % 3 === 0,
  10: (n) => n % 5 === 0,
  2: (n) => n % 2 === 1,
};

function divisibilityRuleCheck(r: Random): Built {
  const variant = pick(r, [
    "pick-two-rules",
    "pick-digit-sum",
    "pick-last-digits",
    "missing-digit-sum",
    "missing-digit-even",
  ]);
  if (variant === "missing-digit-sum" || variant === "missing-digit-even") {
    const d = variant === "missing-digit-sum" ? pick(r, [3, 9]) : 6;
    const length = r(3, 4);
    const digits = Array.from({ length }, (_, i) => r(i === 0 ? 1 : 0, 9));
    const blank =
      variant === "missing-digit-even" ? length - 1 : r(0, length - 1);
    const make = (x: number) => {
      const copy = [...digits];
      copy[blank] = x;
      return Number(copy.join(""));
    };
    const allowed = Array.from({ length: 10 }, (_, x) => x).filter(
      (x) => blank > 0 || x > 0,
    );
    const good = allowed.filter((x) => make(x) % d === 0);
    const bad = allowed.filter((x) => make(x) % d !== 0);
    if (good.length === 0 || bad.length < 3) throw new Error("Need three");
    const right = pick(r, good);
    const wrong = shuffle(r, [...bad]).slice(0, 3);
    const shown = digits
      .map((x, i) => (i === blank ? "▢" : String(x)))
      .join("");
    const known = sum(digits.filter((_, i) => i !== blank));
    const stable = digits.filter((_, i) => i !== blank).join(" + ");
    const hint =
      d === 6
        ? `${RULE_TEXT[6]} The last digit decides whether the number is even. The digits shown add to ${known}; the missing digit must also make the total a multiple of 3.`
        : `${RULE_TEXT[d]} The digits shown add to ${known}. Decide which total near ${known} is a multiple of ${d}, and what the missing digit must add.`;
    return {
      variant,
      noLeakCheck: true,
      prompt: `One digit is hidden: ${shown}. Which digit can replace ▢ so that the number is divisible by ${d}?`,
      answer: "",
      hint,
      explanation: [
        RULE_TEXT[d]!,
        `The digits shown add to ${stable} = ${known}.`,
        `With ${right}, the number is ${make(right)}: ${divisibilityReason(make(right), d).why}, so it is divisible by ${d}.`,
        `Each other choice fails: ${wrong
          .map((x) => `${make(x)} (${divisibilityReason(make(x), d).why})`)
          .join("; ")}.`,
      ],
      choices: [
        { label: `${right}`, correct: true },
        ...wrong.map((x) => ({
          label: `${x}`,
          feedback: `With ${x}, the number is ${make(x)}, and ${divisibilityReason(make(x), d).why}. So it is not divisible by ${d}.`,
        })),
      ],
    };
  }
  const d =
    variant === "pick-two-rules"
      ? pick(r, [2, 5, 10])
      : variant === "pick-digit-sum"
        ? pick(r, [3, 9, 6])
        : 4;
  const length = d === 2 || d === 5 || d === 10 ? 3 : r(3, 4);
  const lo = 10 ** (length - 1),
    hi = 10 ** length - 1;
  const draw = (want: (n: number) => boolean) => {
    for (let i = 0; i < 400; i++) {
      const n = r(lo, hi);
      if (want(n)) return n;
    }
    throw new Error("Need three");
  };
  const right = draw((n) => n % d === 0 && (d > 2 || n % 10 !== 0));
  const near = NEAR_MISS[d]!;
  const wrongs: number[] = [];
  const chooseWrong = (want: (n: number) => boolean) => {
    let n = draw(want);
    for (let i = 0; i < 50 && (wrongs.includes(n) || n === right); i++)
      n = draw(want);
    if (wrongs.includes(n) || n === right) throw new Error("Need three");
    wrongs.push(n);
  };
  chooseWrong((n) => n % d !== 0 && near(n));
  chooseWrong((n) => n % d !== 0 && near(n));
  chooseWrong((n) => n % d !== 0);
  const numbers = [right, ...wrongs];
  return {
    variant,
    prompt: `Which number is divisible by ${d}?`,
    answer: "",
    hint: `${RULE_TEXT[d]} Check each number with that rule; the number that passes is the one.`,
    explanation: [
      RULE_TEXT[d]!,
      ...numbers.map((n) => {
        const t = divisibilityReason(n, d);
        return `${n}: ${t.why}. ${t.ok ? "Divisible by" : "Not divisible by"} ${d}.`;
      }),
      `${right} is the number divisible by ${d}.`,
    ],
    choices: [
      { label: commas(right), correct: true },
      ...wrongs.map((n) => ({
        label: commas(n),
        feedback: `${n}: ${divisibilityReason(n, d).why}. So it is not divisible by ${d}.`,
      })),
    ],
  };
}

const smallestFactor = (n: number) => {
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return d;
  return n;
};
const compositeWhy = (n: number) => {
  const f = smallestFactor(n);
  return `${n} = ${f} × ${n / f}, so it has a factor pair besides 1 and ${n}`;
};

function primeCompositeSort(r: Random): Built {
  const variant = pick(r, [
    "pick-prime-to-100",
    "pick-prime-to-144",
    "pick-composite",
    "neither",
  ]);
  const max = variant === "pick-prime-to-144" ? 144 : 100;
  const primes = Array.from({ length: max - 1 }, (_, i) => i + 2).filter(
    isPrime,
  );
  const composites = Array.from({ length: max - 3 }, (_, i) => i + 4).filter(
    (n) => !isPrime(n),
  );
  // Odd composites with no factor 3 or 5 look prime; they are the useful traps.
  const lookPrime = composites.filter(
    (n) => n % 2 === 1 && n % 3 !== 0 && n % 5 !== 0,
  );
  const sample = <T>(xs: readonly T[], k: number, avoid: number[] = []) => {
    const pool = xs.filter((x) => !avoid.includes(x as unknown as number));
    return shuffle(r, [...pool]).slice(0, k);
  };
  const primeFeedback = (n: number) =>
    `${n} is prime: its only factors are 1 and ${n}.`;
  if (variant.startsWith("pick-prime")) {
    const right = pick(
      r,
      primes.filter((p) => p > 10),
    );
    const traps = sample(lookPrime, 2);
    const other = sample(
      composites.filter((n) => !traps.includes(n)),
      1,
    );
    const wrong = [...traps, ...other];
    return {
      variant,
      prompt: `Which number is prime?`,
      answer: "",
      hint: `A prime number has exactly two factors, 1 and itself. Look for a factor pair other than 1 and the number; a number that has one is not prime.`,
      explanation: [
        ...wrong.map((n) => `${compositeWhy(n)}, so it is composite.`),
        `${primeFeedback(right)} It is the prime number.`,
      ],
      choices: [
        { label: `${right}`, correct: true },
        ...wrong.map((n) => ({
          label: `${n}`,
          feedback: `${compositeWhy(n)}, so ${n} is composite, not prime.`,
        })),
      ],
    };
  }
  if (variant === "pick-composite") {
    const right = pick(r, lookPrime);
    const wrong = sample(
      primes.filter((p) => p > 10),
      3,
    );
    return {
      variant,
      prompt: `Which number is composite?`,
      answer: "",
      hint: `A composite number has a factor pair other than 1 and itself. Try dividing each number by 2, 3, 5 and 7 until one divides evenly.`,
      explanation: [
        ...wrong.map((n) => primeFeedback(n)),
        `${compositeWhy(right)}, so ${right} is composite.`,
      ],
      choices: [
        { label: `${right}`, correct: true },
        ...wrong.map((n) => ({
          label: `${n}`,
          feedback: `${primeFeedback(n)} A composite number has another factor pair.`,
        })),
      ],
    };
  }
  const prime = pick(r, primes);
  const [c1, c2] = sample(lookPrime, 2) as [number, number];
  return {
    variant,
    prompt: `Which number is neither prime nor composite?`,
    answer: "",
    hint: `A prime has exactly two factors. A composite has more than two. Count the factors of each number; only one has just one factor.`,
    explanation: [
      `${primeFeedback(prime)}`,
      `${compositeWhy(c1)}; ${compositeWhy(c2)}. Both are composite.`,
      `1 has only one factor, itself, so it is neither prime nor composite.`,
    ],
    choices: [
      { label: "1", correct: true },
      { label: `${prime}`, feedback: primeFeedback(prime) },
      {
        label: `${c1}`,
        feedback: `${compositeWhy(c1)}, so ${c1} is composite.`,
      },
      {
        label: `${c2}`,
        feedback: `${compositeWhy(c2)}, so ${c2} is composite.`,
      },
    ],
  };
}

function primeFactorizationExponents(r: Random): Built {
  const variant = pick(r, ["direct-to-100", "direct-to-144", "tree-start"]);
  const max = variant === "direct-to-100" ? 100 : 144;
  const pool = Array.from({ length: max - 5 }, (_, i) => i + 6).filter(
    (n) => primeFactors(n).length >= 3,
  );
  const n = pick(r, pool);
  const ps = powers(n);
  const correct = factorLabel(ps);
  const wrong: { label: string; feedback: string }[] = [];
  // A split that still contains a composite factor.
  const splits: [number, number][] = [];
  for (let a = 2; a * a <= n; a++)
    if (n % a === 0 && (!isPrime(a) || !isPrime(n / a)))
      splits.push([a, n / a]);
  const start = pick(r, splits);
  {
    const [a, b] = pick(r, splits);
    wrong.push({
      label: `$${a}\\times ${b}$`,
      feedback: `The product is ${n}, but ${isPrime(a) ? b : a} is not prime. Keep splitting it until every factor is prime.`,
    });
  }
  const repeated = ps.findIndex(([, e]) => e >= 2);
  if (repeated >= 0) {
    const down = ps.map(([b, e], i): Power => [b, i === repeated ? e - 1 : e]);
    wrong.push({
      label: factorLabel(down),
      feedback: `That product is ${productOf(down)}, not ${n}. Count how many times each prime appears as a factor.`,
    });
    const asTimes = ps.map(([b, e]) => (e === 1 ? b : b * e));
    const [rb, re] = ps[repeated]!;
    if (asTimes.reduce((x, y) => x * y, 1) !== n)
      wrong.push({
        label: `$${asTimes.join("\\times ")}$`,
        feedback: `An exponent counts equal factors: ${rb}^${re} means ${Array(re).fill(rb).join(" × ")}, not ${rb} × ${re}.`,
      });
    const swapped = ps.map(([b, e], i): Power =>
      i === repeated ? [e, b] : [b, e],
    );
    if (productOf(swapped) !== n && swapped.every(([, e]) => e >= 1))
      wrong.push({
        label: factorLabel(swapped),
        feedback: `The base is the repeated factor and the exponent counts it. That product is ${productOf(swapped)}, not ${n}.`,
      });
  } else {
    const dropped = ps.slice(0, -1);
    wrong.push({
      label: factorLabel(dropped),
      feedback: `That product is ${productOf(dropped)}, not ${n}. A prime factor is missing.`,
    });
    const extra: Power[] = [...ps.slice(0, -1), [ps[ps.length - 1]![0], 2]];
    wrong.push({
      label: factorLabel(extra),
      feedback: `That product is ${productOf(extra)}, not ${n}. The last prime appears only once.`,
    });
  }
  const bumped: Power[] = ps.map(([b, e], i) => [b, i === 0 ? e + 1 : e]);
  wrong.push({
    label: factorLabel(bumped),
    feedback: `That product is ${productOf(bumped)}, not ${n}. Check the exponent on ${ps[0]![0]}.`,
  });
  const treeText = `${n} = ${start[0]} × ${start[1]}`;
  const prompt =
    variant === "tree-start"
      ? `A factor tree for ${n} starts with ${treeText}. Which is the complete prime factorization of ${n}, written with exponents for repeated factors?`
      : `Which is the prime factorization of ${n}, written with exponents for repeated factors?`;
  return {
    variant,
    prompt,
    answer: "",
    hint:
      variant === "tree-start"
        ? `Keep splitting ${isPrime(start[0]) ? start[1] : start[0]}${isPrime(start[0]) || isPrime(start[1]) ? "" : " and the other factor"} into smaller factors until every branch ends in a prime. Then count how many times each prime appears.`
        : `Split ${n} into two factors, then keep splitting any factor that is not prime. Stop when every branch ends in a prime, then count how many times each prime appears.`,
    explanation: [
      `Split ${n} until every factor is prime: ${n} = ${primeFactors(n).join(" × ")}.`,
      `Group equal primes: ${ps.map(([b, e]) => `${b} appears ${e === 1 ? "once" : `${e} times`}`).join("; ")}.`,
      `The prime factorization is ${correct}. Check: ${plainProduct(ps)} = ${n}.`,
    ],
    choices: choicesFrom(correct, wrong),
  };
}

function primeFactorizationValue(r: Random): Built {
  const variant = pick(r, ["evaluate", "greatest-prime", "count-factors"]);
  if (variant === "evaluate") {
    const bases = shuffle(r, [2, 3, 5, 7])
      .slice(0, r(2, 3))
      .sort((a, b) => a - b);
    const ps: Power[] = bases.map((b) => [
      b,
      r(1, b === 2 ? 4 : b === 3 ? 3 : 2),
    ]);
    if (ps.every(([, e]) => e === 1)) ps[0]![1] = 2;
    const n = productOf(ps);
    const label = factorLabel(ps);
    return {
      variant,
      prompt: `What number has the prime factorization ${label}?`,
      answer: `${n}`,
      responseLabel: "The number",
      hint: `Work out each power first: an exponent tells how many times its base is a factor. Then multiply the results.`,
      explanation: [
        ...ps
          .filter(([, e]) => e > 1)
          .map(
            ([b, e]) =>
              `${b}^${e} = ${Array(e).fill(b).join(" × ")} = ${b ** e}.`,
          ),
        `Multiply: ${ps.map(([b, e]) => b ** e).join(" × ")} = ${n}.`,
      ],
    };
  }
  const pool = Array.from({ length: 95 }, (_, i) => i + 6).filter(
    (n) => primeFactors(n).length >= 3 && !isPrime(n),
  );
  const n = pick(r, pool);
  const ps = powers(n);
  if (variant === "greatest-prime") {
    const g = ps[ps.length - 1]![0];
    return {
      variant,
      prompt: `What is the greatest prime factor of ${n}?`,
      answer: `${g}`,
      responseLabel: "The prime",
      hint: `Split ${n} into factors, and keep splitting until every factor is prime. Then compare the primes you found.`,
      explanation: [
        `${n} = ${primeFactors(n).join(" × ")}.`,
        `The different primes are ${ps.map(([b]) => b).join(", ")}. The greatest is ${g}.`,
      ],
    };
  }
  const count = primeFactors(n).length;
  return {
    variant,
    prompt: `Write ${n} as a product of primes, repeating a prime each time it is a factor. How many primes are in the product?`,
    answer: `${count}`,
    responseLabel: "Number of primes",
    hint: `Split ${n} until every factor is prime. Count every prime in the product, including repeats.`,
    explanation: [
      `${n} = ${primeFactors(n).join(" × ")}.`,
      `The product has ${count} primes, counting each repeat.`,
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* Money                                                                   */
/* ---------------------------------------------------------------------- */

const THINGS = [
  ["notebook", "a notebook"],
  ["sticker book", "a sticker book"],
  ["toy car", "a toy car"],
  ["snack", "a snack"],
  ["juice", "a juice"],
  ["ruler", "a ruler"],
  ["puzzle", "a puzzle"],
  ["kite", "a kite"],
] as const;

/** Count up from the price to the bill: next whole dollar, then dollars. */
function countUp(price: number, paid: number): string {
  const whole = Math.ceil(price / 100) * 100;
  const first = whole - price;
  const parts: string[] = [];
  let at = price;
  if (first > 0) {
    parts.push(`${dl(at)} + ${dl(first)} = ${dl(whole)}`);
    at = whole;
  }
  if (paid > at) parts.push(`${dl(at)} + ${dl(paid - at)} = ${dl(paid)}`);
  return `Count up from the price to the amount paid: ${parts.join(", then ")}.`;
}

function decimalMoneyChange(r: Random): Built {
  const variant = pick(r, [
    "change-one-item",
    "change-two-items",
    "more-needed",
    "unknown-cost",
    "equal-groups",
  ]);
  const name = pick(r, NAMES);
  const unit = "Enter the amount in dollars and cents, such as 2.35.";
  const label = "Dollars";
  if (variant === "change-one-item") {
    const price = r(105, 1895);
    const bill = pick(
      r,
      [500, 1000, 2000].filter((b) => b > price + 50),
    );
    const thing = pick(r, THINGS)[1];
    return {
      variant,
      prompt: `${name} buys ${thing} for ${dl(price)} dollars and pays with a ${bill / 100}-dollar bill. How much change should ${name} get? ${unit}`,
      answer: dl(bill - price),
      responseLabel: label,
      hint: `Change is what is left of the ${bill / 100} dollars after paying ${dl(price)} dollars. Subtract, or count up from ${dl(price)} to ${bill / 100}.00. Keep the cents in line with the cents.`,
      explanation: [
        `Change = amount paid − price = ${dl(bill)} − ${dl(price)}.`,
        countUp(price, bill),
        `The change is ${dl(bill - price)} dollars.`,
      ],
    };
  }
  if (variant === "change-two-items") {
    const a = r(60, 899),
      b = r(60, 899);
    const total = a + b;
    const bill = pick(
      r,
      [1000, 2000].filter((x) => x > total + 50),
    );
    const [x, y] = shuffle(r, [...THINGS]).slice(0, 2) as [
      (typeof THINGS)[number],
      (typeof THINGS)[number],
    ];
    return {
      variant,
      prompt: `${name} buys ${x[1]} for ${dl(a)} dollars and ${y[1]} for ${dl(b)} dollars, and pays with a ${bill / 100}-dollar bill. How much change should ${name} get? ${unit}`,
      answer: dl(bill - total),
      responseLabel: label,
      hint: `First find the total cost of both items by adding ${dl(a)} and ${dl(b)}. Then find the change from ${bill / 100} dollars.`,
      explanation: [
        `Total cost: ${dl(a)} + ${dl(b)} = ${dl(total)} dollars.`,
        `Change: ${dl(bill)} − ${dl(total)}. ${countUp(total, bill)}`,
        `The change is ${dl(bill - total)} dollars.`,
      ],
    };
  }
  if (variant === "more-needed") {
    const cost = r(600, 2400);
    const have = r(150, cost - 55);
    const thing = pick(r, THINGS)[1];
    return {
      variant,
      prompt: `${name} has ${dl(have)} dollars. ${thing[0]!.toUpperCase()}${thing.slice(1)} costs ${dl(cost)} dollars. How much more money does ${name} need? ${unit}`,
      answer: dl(cost - have),
      responseLabel: label,
      hint: `Compare what ${name} has with the cost. The amount still needed is the difference, so subtract the smaller amount from the larger.`,
      explanation: [
        `${name} needs the cost minus what ${name} has: ${dl(cost)} − ${dl(have)}.`,
        countUp(have, cost),
        `${name} needs ${dl(cost - have)} dollars more.`,
      ],
    };
  }
  if (variant === "unknown-cost") {
    const price = r(105, 1895);
    const bill = pick(
      r,
      [500, 1000, 2000].filter((b) => b > price + 50),
    );
    const thing = pick(r, THINGS)[0];
    return {
      variant,
      prompt: `${name} pays for a ${thing} with a ${bill / 100}-dollar bill and gets ${dl(bill - price)} dollars in change. How many dollars did the ${thing} cost? ${unit}`,
      answer: dl(price),
      responseLabel: label,
      hint: `The price and the change together make the amount paid. To find the missing price, take the change away from the ${bill / 100} dollars paid.`,
      explanation: [
        `price + change = amount paid, so price = amount paid − change.`,
        `${dl(bill)} − ${dl(bill - price)} = ${dl(price)}.`,
        `The ${thing} cost ${dl(price)} dollars. Check: ${dl(price)} + ${dl(bill - price)} = ${dl(bill)}.`,
      ],
    };
  }
  const q = r(2, 5);
  const unitPrice = 5 * r(5, 39);
  const extra = r(40, 300);
  const total = q * unitPrice + extra;
  const bill = pick(
    r,
    [1000, 2000].filter((x) => x > total + 50),
  );
  const thing = pick(r, ["pencils", "stickers", "erasers", "marbles"]);
  return {
    variant,
    prompt: `${name} buys ${q} ${thing} at ${dl(unitPrice)} dollars each and a folder for ${dl(extra)} dollars. ${name} pays with a ${bill / 100}-dollar bill. How much change does ${name} get? ${unit}`,
    answer: dl(bill - total),
    responseLabel: label,
    hint: `Find what the ${q} ${thing} cost together by multiplying ${dl(unitPrice)} by ${q}. Add the folder, then subtract the total from ${bill / 100} dollars.`,
    explanation: [
      `${q} ${thing}: ${q} × ${dl(unitPrice)} = ${dl(q * unitPrice)} dollars.`,
      `Total: ${dl(q * unitPrice)} + ${dl(extra)} = ${dl(total)} dollars.`,
      `Change: ${dl(bill)} − ${dl(total)} = ${dl(bill - total)} dollars.`,
    ],
  };
}

const PIECES = [
  [100, "1-dollar bill", "1-dollar bills"],
  [25, "quarter", "quarters"],
  [10, "dime", "dimes"],
  [5, "nickel", "nickels"],
  [1, "penny", "pennies"],
] as const;
export function fewestPieces(cents: number): { value: number; n: number }[] {
  const out: { value: number; n: number }[] = [];
  let left = cents;
  for (const [value] of PIECES) {
    const n = Math.floor(left / value);
    if (n > 0) out.push({ value, n });
    left -= n * value;
  }
  return out;
}
const pieceName = (value: number, n: number) => {
  const p = PIECES.find(([v]) => v === value)!;
  return `${n} ${n === 1 ? p[1] : p[2]}`;
};

function fewestCoinsChange(r: Random): Built {
  const variant = pick(r, ["coins-only", "bills-and-coins", "from-a-payment"]);
  let change: number;
  let prompt: string;
  let allowed: string;
  if (variant === "coins-only") {
    change = r(31, 99);
    allowed = "quarters, dimes, nickels and pennies";
    prompt = `A cashier owes ${change} cents in change. Using quarters, dimes, nickels and pennies, what is the fewest number of coins the cashier can give?`;
  } else if (variant === "bills-and-coins") {
    change = 100 * r(1, 4) + r(11, 99);
    allowed = "1-dollar bills, quarters, dimes, nickels and pennies";
    prompt = `A cashier owes ${dl(change)} dollars in change. Using 1-dollar bills, quarters, dimes, nickels and pennies, what is the fewest number of bills and coins the cashier can give?`;
  } else {
    const price = r(101, 489);
    change = 500 - price;
    allowed = "1-dollar bills, quarters, dimes, nickels and pennies";
    prompt = `A pack of markers costs ${dl(price)} dollars. ${pick(r, NAMES)} pays with a 5-dollar bill. The cashier gives change using 1-dollar bills, quarters, dimes, nickels and pennies. What is the fewest number of bills and coins the cashier can give?`;
  }
  const used = fewestPieces(change);
  const total = used.reduce((a, p) => a + p.n, 0);
  const worked = used.map((p) => pieceName(p.value, p.n));
  return {
    variant,
    prompt,
    answer: `${total}`,
    responseLabel: "Bills and coins",
    hint: `Use as much as you can of the largest piece that fits, then the largest piece that fits in what is left, and keep going down to pennies. Work out the change first${variant === "from-a-payment" ? " by subtracting the price from 5.00" : ""}.`,
    explanation: [
      ...(variant === "from-a-payment"
        ? [`Change: ${dl(500)} − ${dl(500 - change)} = ${dl(change)} dollars.`]
        : []),
      `Using ${allowed}, take the largest piece that fits, then the largest that fits in what is left, down to pennies.`,
      ...used.map((p, i) => {
        const before =
          change - used.slice(0, i).reduce((a, q) => a + q.n * q.value, 0);
        return `${before} cents left: ${pieceName(p.value, p.n)} = ${p.n * p.value} cents.`;
      }),
      `The pieces are ${worked.join(", ")}: ${total} in all.`,
    ],
  };
}

type Pieces = Record<
  "dollar" | "quarter" | "dime" | "nickel" | "penny",
  number
>;
const PIECE_VALUE: Pieces = {
  dollar: 100,
  quarter: 25,
  dime: 10,
  nickel: 5,
  penny: 1,
};
const PIECE_NAMES: Record<keyof Pieces, [string, string]> = {
  dollar: ["1-dollar bill", "1-dollar bills"],
  quarter: ["quarter", "quarters"],
  dime: ["dime", "dimes"],
  nickel: ["nickel", "nickels"],
  penny: ["penny", "pennies"],
};
const setValue = (s: Pieces) =>
  (Object.keys(s) as (keyof Pieces)[]).reduce(
    (a, k) => a + s[k] * PIECE_VALUE[k],
    0,
  );
const setCount = (s: Pieces) => Object.values(s).reduce((a, b) => a + b, 0);
const setItems = (s: Pieces) =>
  (Object.keys(PIECE_VALUE) as (keyof Pieces)[]).flatMap((k) =>
    Array<typeof k>(s[k]).fill(k),
  );
const setText = (s: Pieces) =>
  (Object.keys(PIECE_VALUE) as (keyof Pieces)[])
    .filter((k) => s[k] > 0)
    .map((k) => `${s[k]} ${PIECE_NAMES[k][s[k] === 1 ? 0 : 1]}`)
    .join(", ");
function randomSet(r: Random): Pieces {
  for (;;) {
    const s: Pieces = {
      dollar: r(0, 3),
      quarter: r(0, 4),
      dime: r(0, 4),
      nickel: r(0, 3),
      penny: r(0, 4),
    };
    const n = setCount(s);
    if (n >= 3 && n <= 10 && setValue(s) <= 500) return s;
  }
}

function compareMoneySets(r: Random): Built {
  const variant = pick(r, ["most", "least", "exact-amount"]);
  const labels = ["A", "B", "C"] as const;
  let sets: Pieces[] = [];
  let winner = 0;
  for (let attempt = 0; attempt < 200; attempt++) {
    sets = [randomSet(r), randomSet(r), randomSet(r)];
    const values = sets.map(setValue);
    if (new Set(values).size < 3) continue;
    winner =
      variant === "most"
        ? values.indexOf(Math.max(...values))
        : variant === "least"
          ? values.indexOf(Math.min(...values))
          : r(0, 2);
    // Trap: the set with the most pieces is not the answer.
    const counts = sets.map(setCount);
    if (
      variant !== "exact-amount" &&
      counts[winner] === Math.max(...counts) &&
      attempt < 150
    )
      continue;
    break;
  }
  const values = sets.map(setValue);
  const target = values[winner]!;
  const prompt =
    variant === "most"
      ? "Which set of bills and coins is worth the most money?"
      : variant === "least"
        ? "Which set of bills and coins is worth the least money?"
        : `Which set of bills and coins is worth exactly ${dl(target)} dollars?`;
  const word = variant === "most" ? "most" : "least";
  return {
    variant,
    prompt,
    answer: "",
    ordered: true,
    figure: {
      kind: "money-sets",
      sets: sets.map((s, i) => ({ items: setItems(s), label: labels[i]! })),
    },
    hint: `Find each set's value on its own. Count the 1-dollar bills first, then the coins from the largest coin to the smallest. A set with more pieces is not always worth more.`,
    explanation: [
      ...sets.map(
        (s, i) =>
          `Set ${labels[i]}: ${setText(s)} = ${dl(values[i]!)} dollars.`,
      ),
      variant === "exact-amount"
        ? `Only Set ${labels[winner]} is worth ${dl(target)} dollars.`
        : `Set ${labels[winner]} is worth the ${word}: ${dl(target)} dollars.`,
    ],
    choices: sets.map((_, i) =>
      i === winner
        ? { label: `Set ${labels[i]}`, correct: true }
        : {
            label: `Set ${labels[i]}`,
            feedback:
              variant === "exact-amount"
                ? `Set ${labels[i]} is worth ${dl(values[i]!)} dollars, not ${dl(target)} dollars.`
                : `Set ${labels[i]} is worth ${dl(values[i]!)} dollars, which is not the ${word}. Count each piece's value, not the number of pieces.`,
          },
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* Customary units                                                         */
/* ---------------------------------------------------------------------- */

type Unit = { one: string; many: string };
const U = {
  in: { one: "inch", many: "inches" },
  ft: { one: "foot", many: "feet" },
  yd: { one: "yard", many: "yards" },
  mi: { one: "mile", many: "miles" },
  oz: { one: "ounce", many: "ounces" },
  lb: { one: "pound", many: "pounds" },
  ton: { one: "ton", many: "tons" },
  floz: { one: "fluid ounce", many: "fluid ounces" },
  cup: { one: "cup", many: "cups" },
  pt: { one: "pint", many: "pints" },
  qt: { one: "quart", many: "quarts" },
  gal: { one: "gallon", many: "gallons" },
} satisfies Record<string, Unit>;
type UnitKey = keyof typeof U;
const nameOf = (u: UnitKey, n: number) => `${n === 1 ? U[u].one : U[u].many}`;
const withUnit = (n: number, u: UnitKey) => `${commas(n)} ${nameOf(u, n)}`;

/** Larger unit, smaller unit, how many smaller units make one larger. */
const RENAMES: { big: UnitKey; small: UnitKey; per: number; max: number }[] = [
  { big: "ft", small: "in", per: 12, max: 12 },
  { big: "yd", small: "ft", per: 3, max: 25 },
  { big: "yd", small: "in", per: 36, max: 9 },
  { big: "mi", small: "ft", per: 5280, max: 6 },
  { big: "mi", small: "yd", per: 1760, max: 6 },
  { big: "lb", small: "oz", per: 16, max: 12 },
  { big: "ton", small: "lb", per: 2000, max: 9 },
  { big: "cup", small: "floz", per: 8, max: 12 },
  { big: "pt", small: "cup", per: 2, max: 15 },
  { big: "qt", small: "pt", per: 2, max: 15 },
  { big: "gal", small: "qt", per: 4, max: 12 },
  { big: "qt", small: "cup", per: 4, max: 12 },
  { big: "gal", small: "pt", per: 8, max: 9 },
  { big: "gal", small: "cup", per: 16, max: 9 },
];
const FACT: Record<string, string> = {
  "ft/in": "1 foot = 12 inches",
  "yd/ft": "1 yard = 3 feet",
  "yd/in": "1 yard = 36 inches",
  "mi/ft": "1 mile = 5,280 feet",
  "mi/yd": "1 mile = 1,760 yards",
  "lb/oz": "1 pound = 16 ounces",
  "ton/lb": "1 ton = 2,000 pounds",
  "cup/floz": "1 cup = 8 fluid ounces",
  "pt/cup": "1 pint = 2 cups",
  "qt/pt": "1 quart = 2 pints",
  "gal/qt": "1 gallon = 4 quarts",
  "qt/cup": "1 quart = 4 cups",
  "gal/pt": "1 gallon = 8 pints",
  "gal/cup": "1 gallon = 16 cups",
};
const factOf = (big: UnitKey, small: UnitKey) => FACT[`${big}/${small}`]!;
const measureWord: Record<string, string> = {
  in: "length",
  ft: "length",
  yd: "length",
  mi: "length",
  oz: "weight",
  lb: "weight",
  ton: "weight",
};

function customaryUnitRename(r: Random): Built {
  const variant = pick(r, ["rename", "story", "compare"]);
  const c = pick(r, RENAMES);
  const n = r(2, c.max);
  const fact = factOf(c.big, c.small);
  if (variant === "rename") {
    return {
      variant,
      prompt: `${n === 1 ? 1 : n} ${nameOf(c.big, n)} is how many ${U[c.small].many}? Use ${fact}.`,
      answer: `${n * c.per}`,
      responseLabel:
        U[c.small].many[0]!.toUpperCase() + U[c.small].many.slice(1),
      hint: `${fact}. Each ${U[c.big].one} is ${c.per} ${U[c.small].many}, so the number of ${U[c.small].many} is ${n} groups of ${c.per}. Multiply.`,
      explanation: [
        `${fact}, so each of the ${n} ${U[c.big].many} is ${c.per} ${U[c.small].many}.`,
        `${n} × ${commas(c.per)} = ${commas(n * c.per)}.`,
        `${withUnit(n, c.big)} = ${withUnit(n * c.per, c.small)}.`,
      ],
    };
  }
  if (variant === "story") {
    const kind = measureWord[c.big] ?? "capacity";
    const text =
      kind === "weight"
        ? `A box weighs ${n} ${nameOf(c.big, n)}. How many ${U[c.small].many} does it weigh?`
        : kind === "length"
          ? `A rope is ${n} ${nameOf(c.big, n)} long. How many ${U[c.small].many} long is it?`
          : `A tank holds ${n} ${nameOf(c.big, n)} of water. How many ${U[c.small].many} of water does it hold?`;
    return {
      variant,
      prompt: `${text} ${fact[0]!.toUpperCase()}${fact.slice(1)}.`,
      answer: `${n * c.per}`,
      responseLabel:
        U[c.small].many[0]!.toUpperCase() + U[c.small].many.slice(1),
      hint: `${fact}. The measure is ${n} of the larger unit, so rename it as ${U[c.small].many} by multiplying ${n} by the number of ${U[c.small].many} in one ${U[c.big].one}.`,
      explanation: [
        `${fact}, so one ${U[c.big].one} is ${commas(c.per)} ${U[c.small].many}.`,
        `${n} × ${commas(c.per)} = ${commas(n * c.per)}.`,
        `The answer is ${withUnit(n * c.per, c.small)}.`,
      ],
    };
  }
  // Compare: a measure in the larger unit against a measure in the smaller.
  const big = n * c.per;
  const less = r(1, Math.max(2, Math.floor(c.per / 2)));
  const small = big - less;
  const subject =
    measureWord[c.big] === "weight"
      ? "heavier"
      : measureWord[c.big] === "length"
        ? "longer"
        : "larger";
  return {
    variant,
    prompt: `One amount is ${n} ${nameOf(c.big, n)} and another is ${commas(small)} ${U[c.small].many}. How many ${U[c.small].many} ${subject} is the first amount than the second? ${fact[0]!.toUpperCase()}${fact.slice(1)}.`,
    answer: `${less}`,
    responseLabel: U[c.small].many[0]!.toUpperCase() + U[c.small].many.slice(1),
    hint: `Compare in the same unit. Rename ${n} ${U[c.big].many} as ${U[c.small].many} first, then subtract.`,
    explanation: [
      `${fact}, so ${n} ${U[c.big].many} = ${n} × ${commas(c.per)} = ${commas(big)} ${U[c.small].many}.`,
      `${commas(big)} − ${commas(small)} = ${commas(less)}.`,
      `The first amount is ${withUnit(less, c.small)} ${subject}.`,
    ],
  };
}

function customaryUnitReverse(r: Random): Built {
  const variant = pick(r, ["rename-up", "whole-units", "two-steps"]);
  if (variant === "two-steps") {
    const chains: {
      big: UnitKey;
      mid: UnitKey;
      small: UnitKey;
      a: number;
      b: number;
      max: number;
    }[] = [
      { big: "gal", mid: "qt", small: "cup", a: 4, b: 4, max: 6 },
      { big: "yd", mid: "ft", small: "in", a: 3, b: 12, max: 8 },
      { big: "ton", mid: "lb", small: "oz", a: 2000, b: 16, max: 4 },
      { big: "qt", mid: "pt", small: "cup", a: 2, b: 2, max: 12 },
    ];
    const c = pick(r, chains);
    const n = r(2, c.max);
    const mid = n * c.a;
    return {
      variant,
      prompt: `How many ${U[c.small].many} are in ${n} ${nameOf(c.big, n)}? Use ${factOf(c.big, c.mid)} and ${factOf(c.mid, c.small)}.`,
      answer: `${mid * c.b}`,
      responseLabel:
        U[c.small].many[0]!.toUpperCase() + U[c.small].many.slice(1),
      hint: `Rename in two steps. First rename ${n} ${U[c.big].many} as ${U[c.mid].many}. Then rename that number of ${U[c.mid].many} as ${U[c.small].many}.`,
      explanation: [
        `${n} ${U[c.big].many} = ${n} × ${commas(c.a)} = ${commas(mid)} ${U[c.mid].many}.`,
        `${commas(mid)} ${U[c.mid].many} = ${commas(mid)} × ${c.b} = ${commas(mid * c.b)} ${U[c.small].many}.`,
        `${withUnit(n, c.big)} = ${withUnit(mid * c.b, c.small)}.`,
      ],
    };
  }
  const c = pick(
    r,
    RENAMES.filter((x) => x.per <= 36),
  );
  const n = r(2, Math.min(c.max, 12));
  if (variant === "rename-up") {
    const small = n * c.per;
    return {
      variant,
      prompt: `${commas(small)} ${U[c.small].many} is how many ${U[c.big].many}? Use ${factOf(c.big, c.small)}.`,
      answer: `${n}`,
      responseLabel: U[c.big].many[0]!.toUpperCase() + U[c.big].many.slice(1),
      hint: `${factOf(c.big, c.small)}. Find how many groups of ${c.per} ${U[c.small].many} fit in ${commas(small)} ${U[c.small].many}. Divide.`,
      explanation: [
        `${factOf(c.big, c.small)}, so ${c.per} ${U[c.small].many} make one ${U[c.big].one}.`,
        `${commas(small)} ÷ ${c.per} = ${n}.`,
        `${withUnit(small, c.small)} = ${withUnit(n, c.big)}.`,
      ],
    };
  }
  const extra = r(1, c.per - 1);
  const small = n * c.per + extra;
  return {
    variant,
    prompt: `How many whole ${U[c.big].many} can be made from ${commas(small)} ${U[c.small].many}? Use ${factOf(c.big, c.small)}.`,
    answer: `${n}`,
    responseLabel: `Whole ${U[c.big].many}`,
    hint: `${factOf(c.big, c.small)}. Find how many full groups of ${c.per} ${U[c.small].many} fit in ${commas(small)} ${U[c.small].many}. Ignore any ${U[c.small].many} left over.`,
    explanation: [
      `${commas(small)} ÷ ${c.per} = ${n} with ${extra} left over.`,
      `${n} × ${c.per} = ${commas(n * c.per)}, and ${commas(small)} − ${commas(n * c.per)} = ${extra}.`,
      `${withUnit(n, c.big)} are whole, with ${withUnit(extra, c.small)} left over.`,
    ],
  };
}

const MIXED: {
  big: UnitKey;
  small: UnitKey;
  per: number;
  abbr: [string, string];
  words: string;
}[] = [
  {
    big: "ft",
    small: "in",
    per: 12,
    abbr: ["ft", "in"],
    words: "feet and inches",
  },
  {
    big: "yd",
    small: "ft",
    per: 3,
    abbr: ["yd", "ft"],
    words: "yards and feet",
  },
  {
    big: "lb",
    small: "oz",
    per: 16,
    abbr: ["lb", "oz"],
    words: "pounds and ounces",
  },
  {
    big: "gal",
    small: "qt",
    per: 4,
    abbr: ["gal", "qt"],
    words: "gallons and quarts",
  },
  {
    big: "cup",
    small: "floz",
    per: 8,
    abbr: ["c", "fl oz"],
    words: "cups and fluid ounces",
  },
];
type Mixed = (typeof MIXED)[number];
const mixedText = (m: Mixed, big: number, small: number) =>
  `${big} ${m.abbr[0]} ${small} ${m.abbr[1]}`;

function customaryMixedUnits(r: Random): Built {
  const variant = pick(r, [
    "to-single-unit",
    "to-mixed",
    "add-regroup",
    "subtract-regroup",
  ]);
  const m = pick(r, MIXED);
  const per = m.per;
  const fact = factOf(m.big, m.small);
  const unitName = (u: UnitKey) => U[u].many;
  if (variant === "to-single-unit") {
    const b = r(2, per === 3 ? 9 : 7),
      s = r(1, per - 1);
    const total = b * per + s;
    const text = mixedText(m, b, s);
    const single = (x: number) => `${commas(x)} ${m.abbr[1]}`;
    return {
      variant,
      prompt: `Write ${text} as ${unitName(m.small)} only. ${fact[0]!.toUpperCase()}${fact.slice(1)}.`,
      answer: "",
      hint: `Rename the ${unitName(m.big)} part as ${unitName(m.small)}: multiply ${b} by ${per}. Then add the ${s} ${unitName(m.small)} that are already there.`,
      explanation: [
        `${fact}, so ${b} ${unitName(m.big)} = ${b} × ${per} = ${b * per} ${unitName(m.small)}.`,
        `${b * per} + ${s} = ${total}.`,
        `${text} = ${single(total)}.`,
      ],
      choices: choicesFrom(single(total), [
        {
          label: single(b + s),
          feedback: `This adds ${b} and ${s} as if both were ${unitName(m.small)}. Each ${U[m.big].one} is ${per} ${unitName(m.small)}, so rename the ${unitName(m.big)} first.`,
        },
        {
          label: single(b * per),
          feedback: `This renames the ${unitName(m.big)} but leaves out the ${s} ${unitName(m.small)} that were already there.`,
        },
        {
          label: single(Number(`${b}${s}`)),
          feedback: `This writes the two numbers side by side. Multiply ${b} by ${per} and add ${s}.`,
        },
        {
          label: single(b * per - s),
          feedback: `The ${s} ${unitName(m.small)} are added to the renamed part, not taken away.`,
        },
      ]),
    };
  }
  if (variant === "to-mixed") {
    const b = r(2, 7),
      s = r(1, per - 1);
    const total = b * per + s;
    const cand = (x: number, y: number) => mixedText(m, x, y);
    return {
      variant,
      prompt: `Write ${commas(total)} ${unitName(m.small)} as ${m.words}, with fewer than ${per} ${unitName(m.small)} left over. ${fact[0]!.toUpperCase()}${fact.slice(1)}.`,
      answer: "",
      hint: `Find how many full ${unitName(m.big)} fit in ${total} ${unitName(m.small)} by dividing by ${per}. The remainder is the ${unitName(m.small)} left over.`,
      explanation: [
        `${fact}. Divide: ${total} ÷ ${per} = ${b} with ${s} left over.`,
        `${b} × ${per} = ${b * per}, and ${total} − ${b * per} = ${s}.`,
        `${total} ${unitName(m.small)} = ${cand(b, s)}.`,
      ],
      choices: choicesFrom(cand(b, s), [
        {
          label: cand(s, b),
          feedback: `The number of full ${unitName(m.big)} is the quotient ${b}, and the leftover ${unitName(m.small)} is the remainder ${s}. These are swapped.`,
        },
        {
          label: cand(Math.floor(total / 10), total % 10),
          feedback: `This divides by 10. One ${U[m.big].one} is ${per} ${unitName(m.small)}, so divide by ${per}.`,
        },
        {
          label: cand(b - 1, s),
          feedback: `${b} full ${unitName(m.big)} fit in ${total} ${unitName(m.small)}, not ${b - 1}.`,
        },
        {
          label: cand(b, per - s),
          feedback: `The leftover is the remainder, ${s}, not what is needed to reach the next ${U[m.big].one}.`,
        },
      ]),
    };
  }
  const lowNeeded = variant === "add-regroup";
  if (lowNeeded) {
    const b1 = r(1, 6),
      b2 = r(1, 6),
      s1 = r(Math.ceil(per / 2), per - 1),
      s2 = r(per - s1, per - 1);
    const t = s1 + s2;
    const carry = Math.floor(t / per);
    const rest = t % per;
    const bigT = b1 + b2 + carry;
    const cand = (x: number, y: number) => mixedText(m, x, y);
    return {
      variant,
      prompt: `Add ${mixedText(m, b1, s1)} and ${mixedText(m, b2, s2)}. Write the sum with fewer than ${per} ${unitName(m.small)}. ${fact[0]!.toUpperCase()}${fact.slice(1)}.`,
      answer: "",
      hint: `Add the ${unitName(m.small)} first, then the ${unitName(m.big)}. If the ${unitName(m.small)} total is ${per} or more, rename ${per} of them as 1 ${U[m.big].one} and add it to the ${unitName(m.big)}.`,
      explanation: [
        `${unitName(m.small)}: ${s1} + ${s2} = ${t}. ${fact}, so ${t} ${unitName(m.small)} = ${carry} ${carry === 1 ? U[m.big].one : unitName(m.big)} ${rest} ${unitName(m.small)}.`,
        `${unitName(m.big)}: ${b1} + ${b2} + ${carry} = ${bigT}.`,
        `The sum is ${cand(bigT, rest)}.`,
      ],
      choices: choicesFrom(cand(bigT, rest), [
        {
          label: cand(b1 + b2, rest),
          feedback: `The ${t} ${unitName(m.small)} include ${carry} full ${carry === 1 ? U[m.big].one : unitName(m.big)}. Add that to the ${unitName(m.big)}.`,
        },
        {
          label: cand(bigT, t % 10),
          feedback: `Regroup ${per} ${unitName(m.small)} as 1 ${U[m.big].one}, not 10.`,
        },
        {
          label: cand(bigT + carry, rest),
          feedback: `Add the regrouped ${U[m.big].one} only once.`,
        },
        {
          label: cand(b1 + b2, t),
          feedback: `${t} ${unitName(m.small)} is ${per} or more, so rename ${per} of them as ${U[m.big].one}. The sum should have fewer than ${per} ${unitName(m.small)}.`,
        },
      ]),
    };
  }
  const b2 = r(1, 4),
    s2 = r(Math.ceil(per / 2), per - 1);
  const b1 = b2 + r(1, 4),
    s1 = r(1, s2 - 1);
  const totalA = b1 * per + s1,
    totalB = b2 * per + s2;
  const d = totalA - totalB;
  const eb = Math.floor(d / per),
    es = d % per;
  const cand = (x: number, y: number) => mixedText(m, x, y);
  return {
    variant,
    prompt: `Subtract ${mixedText(m, b2, s2)} from ${mixedText(m, b1, s1)}. Write the difference with fewer than ${per} ${unitName(m.small)}. ${fact[0]!.toUpperCase()}${fact.slice(1)}.`,
    answer: "",
    hint: `${s1} ${unitName(m.small)} is less than ${s2}, so you cannot subtract the ${unitName(m.small)} yet. Rename 1 ${U[m.big].one} from the larger measure as ${per} ${unitName(m.small)}, then subtract.`,
    explanation: [
      `${s1} < ${s2}, so regroup: ${b1} ${unitName(m.big)} ${s1} ${unitName(m.small)} = ${b1 - 1} ${unitName(m.big)} ${s1 + per} ${unitName(m.small)}.`,
      `${unitName(m.small)}: ${s1 + per} − ${s2} = ${s1 + per - s2}. ${unitName(m.big)}: ${b1 - 1} − ${b2} = ${b1 - 1 - b2}.`,
      `The difference is ${cand(eb, es)}.`,
    ],
    choices: choicesFrom(cand(eb, es), [
      {
        label: cand(b1 - b2, s2 - s1),
        feedback: `Always subtract the smaller ${unitName(m.small)} amount from the larger. Here ${s1} is less than ${s2}, so regroup 1 ${U[m.big].one} as ${per} ${unitName(m.small)}.`,
      },
      {
        label: cand(b1 - b2, s1 + per - s2),
        feedback: `After regrouping, the ${unitName(m.big)} drop by 1 because one ${U[m.big].one} was renamed.`,
      },
      {
        label: cand(eb, Math.max(0, s1 + 10 - s2)),
        feedback: `Regroup 1 ${U[m.big].one} as ${per} ${unitName(m.small)}, not 10.`,
      },
      {
        label: cand(eb + 1, es),
        feedback: `Check the ${unitName(m.big)}: after regrouping, ${b1 - 1} − ${b2} = ${b1 - 1 - b2}.`,
      },
    ]),
  };
}

type SizeFamily = "length" | "weight" | "capacity";
const SIZE: Record<SizeFamily, UnitKey[]> = {
  length: ["in", "ft", "yd", "mi"],
  weight: ["oz", "lb", "ton"],
  capacity: ["floz", "cup", "gal"],
};
const FOREIGN: Record<SizeFamily, UnitKey> = {
  length: "gal",
  weight: "gal",
  capacity: "in",
};
const OBJECTS: {
  family: SizeFamily;
  text: string;
  n: number;
  unit: UnitKey;
}[] = [
  { family: "length", text: "the length of a pencil", n: 7, unit: "in" },
  { family: "length", text: "the length of a crayon", n: 3, unit: "in" },
  {
    family: "length",
    text: "the height of a classroom door",
    n: 7,
    unit: "ft",
  },
  { family: "length", text: "the length of a school bus", n: 40, unit: "ft" },
  {
    family: "length",
    text: "the length of a football field",
    n: 100,
    unit: "yd",
  },
  {
    family: "length",
    text: "the drive from one town to the next",
    n: 12,
    unit: "mi",
  },
  {
    family: "weight",
    text: "the weight of a slice of bread",
    n: 1,
    unit: "oz",
  },
  { family: "weight", text: "the weight of an apple", n: 6, unit: "oz" },
  { family: "weight", text: "the weight of a backpack", n: 8, unit: "lb" },
  { family: "weight", text: "the weight of a bowling ball", n: 12, unit: "lb" },
  { family: "weight", text: "the weight of a car", n: 2, unit: "ton" },
  { family: "capacity", text: "the amount in a juice box", n: 6, unit: "floz" },
  {
    family: "capacity",
    text: "the amount in a glass of milk",
    n: 1,
    unit: "cup",
  },
  {
    family: "capacity",
    text: "the amount in a bathtub of water",
    n: 40,
    unit: "gal",
  },
  {
    family: "capacity",
    text: "the amount in a cooler of water",
    n: 5,
    unit: "gal",
  },
];

function customaryUnitChoice(r: Random): Built {
  const o = pick(r, OBJECTS);
  const variant = o.family;
  const units = SIZE[o.family];
  const order = units.indexOf(o.unit);
  const wrong = units
    .filter((u) => u !== o.unit)
    .map((u) => {
      const tooBig = units.indexOf(u) > order;
      return {
        label: withUnit(o.n, u),
        feedback: `${withUnit(o.n, u)} is far too ${tooBig ? "large" : "small"} for ${o.text}.${tooBig ? ` A ${U[u].one} is much bigger than a ${U[o.unit].one}.` : ` A ${U[u].one} is much smaller than a ${U[o.unit].one}.`}`,
      };
    });
  const foreign = FOREIGN[o.family];
  wrong.push({
    label: withUnit(o.n, foreign),
    feedback: `${U[foreign].many[0]!.toUpperCase()}${U[foreign].many.slice(1)} ${foreign === "gal" ? "measure how much a container holds" : "measure length"}, not ${o.family}.`,
  });
  const correct = withUnit(o.n, o.unit);
  return {
    variant,
    prompt: `Which measure is most reasonable for ${o.text}?`,
    answer: "",
    hint: `Picture ${o.text}. Think of something you know that is about that big, such as a hand, a door, a bag of flour or a milk jug, and choose the unit that fits it.`,
    explanation: [
      `Compare each unit with something you know. ${o.text[0]!.toUpperCase()}${o.text.slice(1)} fits ${correct}.`,
      ...wrong.slice(0, 3).map((w) => w.feedback),
    ],
    choices: choicesFrom(correct, wrong),
  };
}

/* ---------------------------------------------------------------------- */
/* Estimation                                                              */
/* ---------------------------------------------------------------------- */

const nearestMultiple = (x: number, step: number) =>
  Math.round(x / step) * step;

function compatibleNumberEstimate(r: Random): Built {
  const variant = pick(r, [
    "divide",
    "multiply-five",
    "multiply-25",
    "front-end",
  ]);
  if (variant === "divide") {
    const d = r(3, 9);
    let D = 0;
    do D = r(120, 980);
    while (D % (10 * d) === 5 * d || D % (10 * d) === 0);
    const m = nearestMultiple(D, 10 * d);
    const q = m / d;
    const far = m > D ? m - 10 * d : m + 10 * d;
    const hundred = nearestMultiple(D, 100);
    return {
      variant,
      prompt: `Estimate ${D} ÷ ${d} with compatible numbers. Change ${D} to the closest multiple of ${10 * d}, then divide by ${d}.`,
      answer: "",
      hint: `Compatible numbers are close to the real numbers and easy to divide. List the multiples of ${10 * d} near ${D}, pick the closest, then divide it by ${d}.`,
      explanation: [
        `The multiples of ${10 * d} near ${D} are ${Math.min(m, far)} and ${Math.max(m, far)}. ${m} is closer to ${D}.`,
        `${m} ÷ ${d} = ${q}, since ${d} × ${q} = ${m}.`,
        `${D} ÷ ${d} is about ${q}.`,
      ],
      choices: choicesFrom(`${commas(q)}`, [
        {
          label: commas(far / d),
          feedback: `${far} is also a multiple of ${10 * d}, but it is farther from ${D} than ${m} is.`,
        },
        {
          label: commas(q * 10),
          feedback: `Check the place value: ${d} × ${q * 10} = ${commas(d * q * 10)}, which is much larger than ${D}.`,
        },
        {
          label: commas(q / 10),
          feedback: `Check the place value: ${d} × ${q / 10} = ${(d * q) / 10}, which is much smaller than ${D}.`,
        },
        {
          label: commas(Math.round(hundred / d)),
          feedback: `${hundred} is the nearest hundred, but the directions use the closest multiple of ${10 * d}.`,
        },
      ]),
    };
  }
  if (variant === "multiply-five" || variant === "multiply-25") {
    const k = variant === "multiply-five" ? 5 : 25;
    const step = variant === "multiply-five" ? 20 : 4;
    let x = 0;
    do x = r(21, 97);
    while (x % step === step / 2 || x % step === 0);
    const m = nearestMultiple(x, step);
    const far = m > x ? m - step : m + step;
    const ten = nearestMultiple(x, 10);
    const est = m * k;
    return {
      variant,
      prompt: `Estimate ${x} × ${k} with compatible numbers. Change ${x} to the closest multiple of ${step}, then multiply by ${k}.`,
      answer: "",
      hint: `Compatible numbers are close to the real numbers and easy to multiply. Multiples of ${step} times ${k} make ${step * k}, a number that is easy to scale. List the multiples of ${step} near ${x} and pick the closest.`,
      explanation: [
        `The multiples of ${step} near ${x} are ${Math.min(m, far)} and ${Math.max(m, far)}. ${m} is closer to ${x}.`,
        `${m} × ${k} = ${commas(est)}.`,
        `${x} × ${k} is about ${commas(est)}.`,
      ],
      choices: choicesFrom(commas(est), [
        {
          label: commas(far * k),
          feedback: `${far} is a multiple of ${step} too, but it is farther from ${x} than ${m} is.`,
        },
        {
          label: commas(ten * k),
          feedback: `${ten} is the nearest ten, but the directions ask for the closest multiple of ${step}.`,
        },
        {
          label: commas(est * 10),
          feedback: `Check the place value: ${m} × ${k} has one fewer zero.`,
        },
        {
          label: commas(est / 10),
          feedback: `Check the place value: ${m} × ${k} is ${commas(est)}, ten times as much.`,
        },
      ]),
    };
  }
  const digits = r(3, 4);
  const count = r(2, 3);
  const nums = Array.from({ length: count }, () =>
    r(10 ** (digits - 1) + 1, 10 ** digits - 1),
  );
  const lead = (n: number) => Number(String(n)[0]) * 10 ** (digits - 1);
  const front = sum(nums.map(lead));
  const rounded = sum(nums.map((n) => nearestMultiple(n, 10 ** (digits - 1))));
  const exact = sum(nums);
  return {
    variant,
    prompt: `Use front-end estimation to estimate ${nums.map(commas).join(" + ")}. Add only the first digit of each number, keeping its place value.`,
    answer: "",
    hint: `Keep the first digit of each number and replace every other digit with a zero. Then add the new numbers.`,
    explanation: [
      `Keep the first digit of each number: ${nums.map((n) => `${commas(n)} → ${commas(lead(n))}`).join("; ")}.`,
      `Add: ${nums.map((n) => commas(lead(n))).join(" + ")} = ${commas(front)}.`,
      `The front-end estimate is ${commas(front)}.`,
    ],
    choices: choicesFrom(commas(front), [
      {
        label: commas(rounded),
        feedback: `This rounds each number. Front-end estimation keeps only the first digit and sets the rest to zero.`,
      },
      {
        label: commas(exact),
        feedback: `This is the exact sum, not an estimate. Replace every digit after the first with a zero.`,
      },
      {
        label: `${front / 10 ** (digits - 1)}`,
        feedback: `The first digits add to ${front / 10 ** (digits - 1)}, but each first digit stands for ${commas(10 ** (digits - 1))}s. Keep the place value.`,
      },
      {
        label: commas(front * 10),
        feedback: `Check the place value: each number has ${digits} digits, so the estimate has the same size as the numbers.`,
      },
    ]),
  };
}

const money = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(2));
function benchmarkPercentEstimate(r: Random): Built {
  const variant = pick(r, ["tip", "sales-tax", "discount", "sale-price"]);
  const name = pick(r, NAMES);
  const roundTo = (x: number, step: number) => nearestMultiple(x, step);
  if (variant === "tip" || variant === "sales-tax") {
    const pct = variant === "tip" ? pick(r, [10, 15, 20]) : pick(r, [5, 10]);
    const price =
      r(1, 8) * 10 + pick(r, [1, 2, 3, 4, 6, 7, 8, 9]) + r(0, 99) / 100;
    const base = roundTo(price, 10);
    const ten = base / 10;
    const est = (base * pct) / 100;
    const what = variant === "tip" ? "tip" : "sales tax";
    const wrong = [
      {
        label: `about ${money(est * 10)} dollars`,
        feedback: `Check the decimal point: ${pct}% of ${base} dollars is much less than ${money(est * 10)} dollars.`,
      },
      {
        label: `about ${money(est / 10)} dollars`,
        feedback: `Check the decimal point: ${pct}% of ${base} dollars is more than ${money(est / 10)} dollars. 10% of ${base} is ${money(ten)}.`,
      },
      {
        label: `about ${pct} dollars`,
        feedback: `${pct}% means ${pct} out of every 100, not ${pct} dollars.`,
      },
      pct === 15
        ? {
            label: `about ${money(ten)} dollars`,
            feedback: `That is only 10%. 15% is 10% plus 5%, and 5% is half of 10%.`,
          }
        : pct === 20
          ? {
              label: `about ${money(ten)} dollars`,
              feedback: `That is only 10%. 20% is twice 10%.`,
            }
          : pct === 10
            ? {
                label: `about ${money(ten / 2)} dollars`,
                feedback: `That is 5%. 10% of ${base} dollars is ${money(ten)}.`,
              }
            : {
                label: `about ${money(ten)} dollars`,
                feedback: `That is 10%. 5% is half of 10%.`,
              },
    ];
    return {
      variant,
      prompt: `${name}'s ${variant === "tip" ? "meal" : "purchase"} costs ${dl(Math.round(price * 100))} dollars. Round the cost to the nearest 10 dollars, then use benchmarks to estimate the ${what} at ${pct}%.`,
      answer: "",
      hint: `Round ${dl(Math.round(price * 100))} to the nearest 10 dollars first. 10% of a number is one tenth of it; ${pct === 15 ? "5% is half of that, and 15% is 10% plus 5%" : pct === 20 ? "20% is twice 10%" : pct === 5 ? "5% is half of 10%" : "move the decimal point one place left"}.`,
      explanation: [
        `${dl(Math.round(price * 100))} dollars rounds to ${base} dollars.`,
        `10% of ${base} is ${base} ÷ 10 = ${money(ten)}.`,
        pct === 10
          ? `So the ${what} is about ${money(est)} dollars.`
          : pct === 15
            ? `5% is half of 10%: ${money(ten)} ÷ 2 = ${money(ten / 2)}. 15% is ${money(ten)} + ${money(ten / 2)} = ${money(est)}.`
            : pct === 20
              ? `20% is twice 10%: 2 × ${money(ten)} = ${money(est)}.`
              : `5% is half of 10%: ${money(ten)} ÷ 2 = ${money(est)}.`,
        `The ${what} is about ${money(est)} dollars.`,
      ],
      choices: choicesFrom(`about ${money(est)} dollars`, wrong),
    };
  }
  const pct = pick(r, [10, 25, 50]);
  const step = pct === 25 ? 20 : 10;
  const price =
    r(1, 9) * step + pick(r, [-4, -3, -2, -1, 1, 2, 3, 4]) + r(0, 99) / 100;
  const base = roundTo(price, step);
  const discount = (base * pct) / 100;
  const sale = base - discount;
  const shown = dl(Math.round(price * 100));
  const benchmark =
    pct === 10 ? "one tenth" : pct === 25 ? "one fourth" : "one half";
  if (variant === "discount") {
    return {
      variant,
      prompt: `A jacket costs ${shown} dollars and is ${pct}% off. Round the cost to the nearest ${step} dollars, then estimate the amount of the discount.`,
      answer: "",
      hint: `${pct}% is ${benchmark}. Round ${shown} to the nearest ${step} dollars first, then take ${benchmark} of the rounded cost.`,
      explanation: [
        `${shown} dollars rounds to ${base} dollars.`,
        `${pct}% is ${benchmark}: ${base} ÷ ${100 / pct} = ${money(discount)}.`,
        `The discount is about ${money(discount)} dollars.`,
      ],
      choices: choicesFrom(`about ${money(discount)} dollars`, [
        {
          label: `about ${money(sale)} dollars`,
          feedback: `That is the sale price, the amount left to pay. The question asks for the discount.`,
        },
        {
          label: `about ${money(discount * 10)} dollars`,
          feedback: `Check the decimal point: ${pct}% of ${base} dollars is less than ${base} dollars.`,
        },
        {
          label: `about ${pct} dollars`,
          feedback: `${pct}% means ${pct} out of every 100, not ${pct} dollars.`,
        },
        {
          label: `about ${money(base - pct)} dollars`,
          feedback: `The discount is a percent of the cost, not ${pct} dollars taken off.`,
        },
      ]),
    };
  }
  return {
    variant,
    prompt: `A jacket costs ${shown} dollars and is ${pct}% off. Round the cost to the nearest ${step} dollars, then estimate the sale price.`,
    answer: "",
    hint: `${pct}% is ${benchmark}. Round ${shown} to the nearest ${step} dollars, find the discount, then take it away from the rounded cost.`,
    explanation: [
      `${shown} dollars rounds to ${base} dollars.`,
      `${pct}% is ${benchmark}: the discount is ${base} ÷ ${100 / pct} = ${money(discount)}.`,
      `Sale price: ${base} − ${money(discount)} = ${money(sale)}. The sale price is about ${money(sale)} dollars.`,
    ],
    choices: choicesFrom(`about ${money(sale)} dollars`, [
      {
        label: `about ${money(discount)} dollars`,
        feedback: `That is the discount. The sale price is what is left after taking it off the cost.`,
      },
      {
        label: `about ${money(base + discount)} dollars`,
        feedback: `A discount lowers the price. Subtract it from the cost; do not add.`,
      },
      {
        label: `about ${money(base - pct)} dollars`,
        feedback: `${pct}% off takes off ${pct} out of every 100 parts, not ${pct} dollars.`,
      },
      {
        label: `about ${money(base * (1 - pct / 100) * 10)} dollars`,
        feedback: `Check the decimal point: the sale price is less than the rounded cost of ${base} dollars.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* Assembly                                                                */
/* ---------------------------------------------------------------------- */

const builders: Record<string, (r: Random) => Built> = {
  "divisibility-rule-check": divisibilityRuleCheck,
  "prime-composite-sort": primeCompositeSort,
  "prime-factorization-exponents": primeFactorizationExponents,
  "prime-factorization-value": primeFactorizationValue,
  "decimal-money-change": decimalMoneyChange,
  "fewest-coins-change": fewestCoinsChange,
  "compare-money-sets": compareMoneySets,
  "customary-unit-rename": customaryUnitRename,
  "customary-unit-reverse": customaryUnitReverse,
  "customary-mixed-units": customaryMixedUnits,
  "customary-unit-choice": customaryUnitChoice,
  "compatible-number-estimate": compatibleNumberEstimate,
  "benchmark-percent-estimate": benchmarkPercentEstimate,
};

function toProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  d: Draft,
): GeneratedProblem {
  const base = {
    id: createHash("sha256")
      .update(JSON.stringify([meta.id, 1, seed]))
      .digest("hex"),
    templateId: meta.id,
    templateVersion: 1 as const,
    seed,
    prompt: d.prompt,
    skillId: meta.skillId,
    ...(d.figure ? { figure: d.figure } : {}),
  };
  if (!d.choices)
    return {
      public: {
        ...base,
        response: { kind: "number", label: d.responseLabel ?? "Answer" },
      },
      answer: d.answer!,
      explanation: d.explanation,
      hint: d.hint,
    };
  const choices = d.ordered ? d.choices : shuffle(r, [...d.choices]);
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = choices.map((c, i) => {
    const id = `option-${"abcd"[i]}`;
    if (c.correct) answer = id;
    else choiceFeedback[id] = c.feedback!;
    return { id, label: c.label };
  });
  return {
    public: {
      ...base,
      response: { kind: "choice", label: "Choose one answer", options },
    },
    answer,
    explanation: d.explanation,
    hint: d.hint,
    choiceFeedback,
  };
}

/** Private model: the variant is for tests; only the public problem is served. */
export function k8StateNumberCase(templateId: string, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = k8StateNumberTemplates.find((t) => t.id === templateId);
  const build = builders[templateId];
  if (!meta || !build) throw new Error(`Unknown template ${templateId}`);
  const r = random(meta.id, seed);
  for (let attempt = 0; attempt < 80; attempt++) {
    let draft: Built;
    try {
      draft = build(r);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Need three"))
        continue;
      throw error;
    }
    if (leaks(draft)) continue;
    return { variant: draft.variant, problem: toProblem(meta, seed, r, draft) };
  }
  throw new Error("Could not generate a problem without leaking the answer");
}

export function generateK8StateNumberProblem(templateId: string, seed: string) {
  return k8StateNumberCase(templateId, seed).problem;
}
