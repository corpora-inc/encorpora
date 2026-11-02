import type { GeneratedProblem } from "./contracts";
import { dispatch, gcd, pick } from "./chain-kit";
import { numberLine } from "./scene/author";
import type { Random } from "./variation/axes";
import { orientationAxis } from "./variation/orientation";
import {
  sample,
  selectFamily,
  selectModel,
  selectTemplate,
  st,
  tex,
} from "./select-kit";
import type { Statement } from "./variation/statement-set";

/**
 * Select-every-true-statement families for numbers: place-value forms,
 * equivalent fractions and ratios, rounding, comparison with π and
 * multiplication facts. Every statement's truth is computed from the numbers
 * it states.
 */

/* ------------------------------------------------------- place value forms */

export const placeValueFormsTemplate = selectTemplate({
  id: "place-value-forms-select",
  title: "Select the forms equal to a number",
  skillId: "large-place-value",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Select every expanded sum, place-value sum or word-form comparison that is true for a four-, five- or six-digit number, including numbers with a zero digit.",
});

const placeValues = [100000, 10000, 1000, 100, 10, 1];
const smallWords = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const tensWords = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const below100 = (n: number) =>
  n < 20
    ? smallWords[n]!
    : `${tensWords[Math.floor(n / 10)]}${n % 10 ? `-${smallWords[n % 10]}` : ""}`;
const below1000 = (n: number) =>
  [
    n >= 100 ? `${smallWords[Math.floor(n / 100)]} hundred` : "",
    n % 100 ? below100(n % 100) : "",
  ]
    .filter(Boolean)
    .join(" ");
/** Words for 1 to 999,999: "forty-six thousand, two hundred twelve". */
export function wordsOf(n: number): string {
  const thousands = Math.floor(n / 1000);
  return [
    thousands ? `${below1000(thousands)} thousand` : "",
    n % 1000 ? below1000(n % 1000) : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function digitsOf(value: number, width: number): number[] {
  return String(value).padStart(width, "0").split("").map(Number);
}

function placeValueModel(r: Random, variant: string) {
  if (variant === "word-comparison") {
    // A six-digit number against close numbers written in words.
    const n = r(100, 899) * 1000 + r(1, 999);
    const near: number[] = [
      n + r(1, 9) * 1000,
      n - r(1, 9) * 1000,
      n + r(1, 9),
      n - r(1, 9),
      n + r(1, 9) * 100,
      n - r(1, 9) * 100,
      n,
    ];
    const digits = digitsOf(n, 6);
    const swapped = [...digits];
    [swapped[2], swapped[3]] = [swapped[3]!, swapped[2]!];
    near.push(Number(swapped.join("")));
    const pool: Statement[] = [];
    for (const m of near) {
      if (m < 100000 || m > 999999) continue;
      for (const rel of [">", "<", "="] as const) {
        if (rel === "=" && m !== n) continue;
        const holds = rel === ">" ? n > m : rel === "<" ? n < m : n === m;
        const word =
          rel === ">" ? "greater than" : rel === "<" ? "less than" : "equal to";
        pool.push(
          st(
            `$${tex(n)}$ is ${word} ${wordsOf(m)}`,
            holds,
            `${wordsOf(m)} is $${tex(m)}$, and $${tex(n)}$ is ${holds ? word : n > m ? "greater than" : n < m ? "less than" : "equal to"} $${tex(m)}$.`,
          ),
        );
      }
    }
    const total = 5;
    return {
      ...selectModel({
        variant,
        pool,
        total,
        k: r(2, 3),
        context: `The number is $${tex(n)}$.`,
        ask: (k) => `Select the ${k} true comparisons.`,
        one: "comparison",
        hint: () =>
          `Write each word form as a numeral, thousands group first, then compare it with $${tex(n)}$ one place at a time from the greatest place.`,
      }),
      lead: [
        "To compare numbers, write each one in digits. Then compare place by place, starting from the greatest place.",
      ],
      tail: [
        `The comparisons marked true state the correct order of the numbers.`,
      ],
    };
  }
  const zero = variant === "inner-zero";
  let n = 0;
  for (let g = 0; g < 100; g++) {
    const ds = Array.from({ length: 5 }, () => r(1, 9));
    ds[0] = r(1, 9);
    if (zero) ds[r(1, 3)] = 0;
    n = Number(ds.join(""));
    if (ds.includes(0) === zero) break;
  }
  const ds = digitsOf(n, 5);
  const ps = placeValues.slice(1);
  const parts = ds.map((d, i) => ({ d, p: ps[i]! })).filter((x) => x.d);
  const sum = (xs: { d: number; p: number }[]) =>
    xs.reduce((s, x) => s + x.d * x.p, 0);
  const plain = (xs: { d: number; p: number }[]) =>
    `$${xs.map((x) => tex(x.d * x.p)).join("+")}$`;
  const product = (xs: { d: number; p: number }[]) =>
    `$${xs.map((x) => `${x.d}\\times${tex(x.p)}`).join("+")}$`;
  const pool: Statement[] = [];
  const add = (label: string, value: number, truth: string, bad: string) =>
    pool.push(st(label, value === n, value === n ? truth : bad));
  const explain = (label: string, value: number) =>
    `The parts add to $${tex(value)}$, which is ${value === n ? "equal to" : "not equal to"} $${tex(n)}$.`;
  const forms: { label: string; value: number }[] = [
    { label: plain(parts), value: sum(parts) },
    { label: product(parts), value: sum(parts) },
  ];
  // Grouped forms: thousands as a count, then the rest.
  const th = Math.floor(n / 1000);
  forms.push({
    label: `$${th}\\times1{,}000+${tex(n % 1000)}$`,
    value: th * 1000 + (n % 1000),
  });
  forms.push({
    label: `$${tex(th * 1000)}+${tex(n % 1000)}$`,
    value: th * 1000 + (n % 1000),
  });
  const hu = Math.floor(n / 100);
  forms.push({
    label: `$${hu}\\times100+${n % 100}$`,
    value: hu * 100 + (n % 100),
  });
  // Place errors: one term one place too small or too large, a term left
  // out, or two terms' places exchanged.
  parts.forEach((x, i) => {
    const shifted = parts.map((y, j) =>
      j === i ? { d: y.d, p: y.p === 1 ? 10 : y.p / 10 } : y,
    );
    if (x.p > 1 && !parts.some((y, j) => j !== i && y.p === x.p / 10))
      forms.push({ label: plain(shifted), value: sum(shifted) });
    const bigger = parts.map((y, j) => (j === i ? { d: y.d, p: y.p * 10 } : y));
    if (x.p < 10000 && !parts.some((y, j) => j !== i && y.p === x.p * 10))
      forms.push({ label: plain(bigger), value: sum(bigger) });
    const left = parts.filter((_, j) => j !== i);
    if (left.length >= 2) forms.push({ label: plain(left), value: sum(left) });
  });
  forms.push({
    label: `$${th}\\times100+${tex(n % 1000)}$`,
    value: th * 100 + (n % 1000),
  });
  forms.push({
    label: `$${hu}\\times10+${n % 100}$`,
    value: hu * 10 + (n % 100),
  });
  forms.push({
    label: `$${th + 1}\\times1{,}000+${tex(n % 1000)}$`,
    value: (th + 1) * 1000 + (n % 1000),
  });
  const seen = new Set<string>();
  for (const f of forms) {
    if (seen.has(f.label)) continue;
    seen.add(f.label);
    add(f.label, f.value, explain(f.label, f.value), explain(f.label, f.value));
  }
  return {
    ...selectModel({
      variant,
      pool,
      total: 5,
      k: r(2, 3),
      context: `The number is $${tex(n)}$.`,
      ask: (k) => `Select the ${k} expressions that are equal to it.`,
      one: "expression",
      hint: () =>
        `Find the value of each digit of $${tex(n)}$ by its place: the ${ds[0]} is in the ten-thousands place. Work out what each expression adds up to and compare it with $${tex(n)}$.`,
    }),
    lead: [
      "Each digit's value depends on its place: ones, tens, hundreds, thousands and ten-thousands.",
      `To test an expression, work out what it adds up to and compare that with $${tex(n)}$.`,
    ],
    tail: [
      `The expressions marked true are the ones whose value is exactly $${tex(n)}$.`,
    ],
  };
}

/* ------------------------------------------------- equivalent fractions */

export const equivalentFractionsTemplate = selectTemplate({
  id: "equivalent-fractions-select",
  title: "Select the equivalent fractions",
  skillId: "fraction-equivalence",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Select every fraction equivalent to a given fraction among fractions made by multiplying both parts, changing only one part or adding to both parts.",
});

const fr = (n: number, d: number) => `\\frac{${n}}{${d}}`;
function equivalentFractions(r: Random) {
  const pairs: [number, number][] = [
    [1, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [2, 5],
    [3, 5],
    [1, 4],
    [3, 8],
    [5, 6],
    [4, 5],
    [1, 6],
    [5, 8],
    [3, 10],
    [7, 10],
  ];
  const [a, b] = pick(r, pairs);
  const pool: Statement[] = [];
  // Two wrong fractions of one value would be one distractor shown twice.
  const wrongValues = new Set<string>();
  const cand = (n: number, d: number, note: string) => {
    if (n < 1 || d < 2 || d > 30 || (n === a && d === b)) return;
    const holds = n * b === a * d;
    if (!holds) {
      const value = `${n / gcd(n, d)}/${d / gcd(n, d)}`;
      if (wrongValues.has(value)) return;
      wrongValues.add(value);
    }
    pool.push(
      st(
        `$${fr(n, d)}$`,
        holds,
        holds
          ? n >= a
            ? `$${fr(n, d)}$ is equivalent: multiply the top and bottom of $${fr(a, b)}$ by $${n / a}$ to get $${fr(n, d)}$.`
            : `$${fr(n, d)}$ is equivalent: divide the top and bottom of $${fr(a, b)}$ by $${a / n}$ to get $${fr(n, d)}$.`
          : `$${fr(n, d)}$ is not equal to $${fr(a, b)}$: ${note}`,
      ),
    );
  };
  for (let k = 2; k <= 8; k++) cand(a * k, b * k, "");
  const g = gcd(a, b);
  if (g > 1) cand(a / g, b / g, "");
  for (const k of [2, 3, 4]) {
    cand(a * k, b, `only the numerator was multiplied by $${k}$.`);
    cand(a, b * k, `only the denominator was multiplied by $${k}$.`);
  }
  for (const j of [1, 2, 3]) {
    cand(
      a + j,
      b + j,
      `adding $${j}$ to both parts does not keep the same size.`,
    );
    cand(b, a, "the numerator and denominator were exchanged.");
  }
  cand(a + 1, b * 2, "the parts were not scaled by the same factor.");
  cand(a * 2 + 1, b * 2, "the parts were not scaled by the same factor.");
  return {
    ...selectModel({
      variant: b % 2 === 0 ? "even-denominator" : "odd-denominator",
      pool,
      total: 5,
      k: r(2, 3),
      context: `Look at the fraction $${fr(a, b)}$.`,
      ask: (k) => `Select the ${k} fractions that are equivalent to it.`,
      one: "fraction",
      hint: () =>
        `Equivalent fractions come from multiplying the numerator and the denominator of $${fr(a, b)}$ by the same number. For each choice, ask whether one number multiplies $${a}$ to give its numerator and $${b}$ to give its denominator.`,
    }),
    lead: [
      "Equivalent fractions name the same amount. Multiply the top (the numerator) and the bottom (the denominator) by the same number to make one.",
      "Changing only one part, or adding the same number to both parts, changes the amount.",
    ],
    tail: [`The fractions marked true are equivalent to $${fr(a, b)}$.`],
  };
}

/* ---------------------------------------- fractions on a number line */

export const fractionLineNamesTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "fraction-line-names-select",
  title: "Select the fractions that name a point",
  skillId: "fractions-number-line",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Read a point on a zero-to-one number line cut into equal parts and select every fraction that names it, in the ticks' unit and in an equivalent form.",
});

function fractionLineNames(r: Random) {
  const lines: { d: number; p: number }[] = [
    { d: 6, p: 2 },
    { d: 6, p: 3 },
    { d: 6, p: 4 },
    { d: 8, p: 2 },
    { d: 8, p: 4 },
    { d: 8, p: 6 },
    { d: 9, p: 3 },
    { d: 9, p: 6 },
    { d: 10, p: 4 },
    { d: 10, p: 5 },
    { d: 12, p: 3 },
    { d: 12, p: 6 },
    { d: 12, p: 8 },
  ];
  const { d, p } = pick(r, lines);
  const pool: Statement[] = [];
  const seen = new Set<string>();
  const cand = (n: number, m: number, note: string) => {
    const key = `${n}/${m}`;
    if (n < 1 || m < 2 || m > 24 || seen.has(key) || n >= m) return;
    seen.add(key);
    const holds = n * d === p * m;
    pool.push(
      st(
        `$${fr(n, m)}$`,
        holds,
        holds
          ? `$${fr(n, m)}$ is the same size as $${fr(p, d)}$, the point's position.`
          : `$${fr(n, m)}$ is not the point's position, $${fr(p, d)}$: ${note}`,
      ),
    );
  };
  for (let k = 1; k <= 4; k++) cand(p * k, d * k, "");
  const g = gcd(p, d);
  if (g > 1) cand(p / g, d / g, "");
  cand(p, d, "");
  cand(p + 1, d, `it is at $${p + 1}$ parts from $0$, not $${p}$.`);
  cand(
    p - 1,
    d,
    `it is at ${p - 1 === 1 ? "$1$ part" : `$${p - 1}$ parts`} from $0$, not $${p}$.`,
  );
  cand(p, d + 1, "its parts are a different size.");
  cand(d - p, d, "it counts from the other end.");
  cand(p + 1, d + 1, "it adds to both parts.");
  cand(1, d, "it counts only one part.");
  cand(p, d * 2, "its parts are half the size.");
  const ticks = `${d} equal parts`;
  const scene = numberLine({ min: 0, max: 1, denominator: d })
    .mark(p / d, { label: "P" })
    .scene();
  return {
    ...selectModel({
      variant: `${d % 2 === 0 ? "even" : "odd"}-parts`,
      pool,
      total: 5,
      k: r(2, 3),
      context: `The number line from $0$ to $1$ is cut into ${ticks}. Point $P$ is marked on it.`,
      ask: (k) => `Select the ${k} fractions that name point $P$.`,
      one: "fraction",
      hint: () =>
        `Count the parts from $0$ to $P$ on the line cut into ${ticks}, and write that count over ${d}. Then look for fractions that are equal to it.`,
      figure: { kind: "scene", scene },
    }),
    lead: [
      `The line from 0 to 1 is cut into ${d} equal parts, so each part is $${fr(1, d)}$. Point $P$ is ${p} parts from 0, at $${fr(p, d)}$.`,
      `Any fraction equivalent to $${fr(p, d)}$ (the same amount) also names point $P$.`,
    ],
    tail: ["The fractions marked true all name point $P$."],
  };
}

/* ------------------------------------------------------ equivalent ratios */

export const equivalentRatiosTemplate = selectTemplate({
  id: "equivalent-ratios-select",
  title: "Select the groups that keep a ratio",
  skillId: "ratios",
  gradeBand: "6–8",
  difficultyOffset: 0.1,
  description:
    "Select every pair of quantities that keeps a stated ratio, among scaled pairs, pairs that add the same amount to both parts, and pairs with the parts swapped.",
});

const ratioContexts = [
  { a: "students", b: "adults", frame: "Volunteer groups need" },
  { a: "cups of nuts", b: "cups of raisins", frame: "A trail mix needs" },
  { a: "red beads", b: "blue beads", frame: "A bracelet pattern uses" },
  {
    a: "parts blue paint",
    b: "parts yellow paint",
    frame: "A green paint mixes",
  },
];
function equivalentRatios(r: Random) {
  const ratios: [number, number][] = [
    [5, 2],
    [3, 4],
    [2, 5],
    [4, 3],
    [7, 2],
    [3, 5],
    [5, 4],
    [2, 3],
    [5, 3],
  ];
  const [a, b] = pick(r, ratios);
  const c = pick(r, ratioContexts);
  const pool: Statement[] = [];
  const seen = new Set<string>();
  const cand = (x: number, y: number, note: string) => {
    const key = `${x}:${y}`;
    if (x < 1 || y < 1 || seen.has(key) || (x === a && y === b)) return;
    seen.add(key);
    const holds = x * b === y * a;
    pool.push(
      st(
        `$${x}$ ${c.a} and $${y}$ ${c.b}`,
        holds,
        holds
          ? `$${x}:${y}$ is $${a}:${b}$ scaled by $${x / a}$.`
          : `$${x}:${y}$ is not equivalent to $${a}:${b}$: ${note}`,
      ),
    );
  };
  for (let k = 2; k <= 8; k++) cand(a * k, b * k, "");
  for (const j of [1, 2, 3, 4]) {
    cand(a + j, b + j, `adding $${j}$ to both parts is not scaling.`);
    cand(a * 2 + j, b * 2, "the parts were not scaled by the same factor.");
    cand(a * 3, b * 3 + j, "the parts were not scaled by the same factor.");
  }
  cand(b * 2, a * 2, "the order of the two parts is reversed.");
  cand(b, a, "the order of the two parts is reversed.");
  cand(a * 4, b * 4 - 1, "the parts were not scaled by the same factor.");
  cand(a * 5 + 1, b * 5, "the parts were not scaled by the same factor.");
  return {
    ...selectModel({
      variant: a > b ? "first-part-greater" : "second-part-greater",
      pool,
      total: 5,
      k: r(2, 3),
      context: `${c.frame} $${a}$ ${c.a} for every $${b}$ ${c.b}.`,
      ask: (k) => `Select the ${k} groups that keep this ratio.`,
      one: "group",
      hint: () =>
        `The ratio is $${a}:${b}$. A group keeps it when both amounts are the same multiple of $${a}$ and $${b}$. Find what $${a}$ is multiplied by to give each group's first amount, then check the second.`,
    }),
    lead: [
      `A ratio such as $${a}:${b}$ compares two amounts. An equivalent ratio multiplies both amounts by the same number.`,
      "Adding the same number to both amounts does not keep the ratio.",
    ],
    tail: [`The groups marked true keep the ratio $${a}:${b}$.`],
  };
}

/* ------------------------------------------------------- inverse rounding */

export const roundsToTemplate = selectTemplate({
  id: "rounds-to-select",
  title: "Select the numbers that round to a value",
  skillId: "decimal-place-value",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Select every decimal that rounds to a stated value at the nearest whole number, tenth or hundredth, including numbers with a hundreds place and numbers that sit exactly on a rounding boundary.",
});

const places = {
  whole: { p: 0, name: "whole number" },
  tenth: { p: 1, name: "tenth" },
  hundredth: { p: 2, name: "hundredth" },
} as const;
function roundsTo(r: Random) {
  const variant = pick(r, ["whole", "tenth", "hundredth"] as const);
  const { p, name } = places[variant];
  // Integers in units of 10^-(p+2): the digits two places beyond the target.
  const unit = 100;
  const lead = r(100, 480);
  const targetUnits = lead * 10 ** p + r(1, 9); // value at the target place
  const target = targetUnits * unit; // in the finest unit
  const toText = (v: number) => {
    const digits = p + 2;
    const whole = Math.floor(v / 10 ** digits);
    const frac = String(v % 10 ** digits).padStart(digits, "0");
    return `${whole}.${frac}`.replace(/0+$/, "").replace(/\.$/, "");
  };
  const roundHalfUp = (v: number) => Math.floor((v + 50) / unit);
  const pool: Statement[] = [];
  const seen = new Set<number>();
  const cand = (v: number, note: string) => {
    if (v <= 0 || seen.has(v) || v % 10 === 0 || v === target) return;
    seen.add(v);
    const rounded = roundHalfUp(v);
    const holds = rounded === targetUnits;
    const rtext = toText(rounded * unit) || "0";
    pool.push(
      st(
        `$${toText(v)}$`,
        holds,
        holds
          ? `$${toText(v)}$ is within half a ${name} of $${toText(target)}$, so it rounds to $${toText(target)}$.`
          : `$${toText(v)}$ rounds to $${rtext}$, not $${toText(target)}$${note}`,
      ),
    );
  };
  for (const off of [-49, -41, -33, -26, -12, -3, 3, 7, 18, 29, 36, 44, 49])
    cand(target + off, ".");
  for (const off of [-51, -58, -64, -77, 51, 56, 68, 82, 95])
    cand(target + off, ".");
  cand(
    target - 50,
    ": a value halfway between two roundings rounds up, to the greater one.",
  );
  cand(
    target + 50,
    ": a value halfway between two roundings rounds up, to the greater one.",
  );
  const unitText = `$${toText(target)}$`;
  return {
    ...selectModel({
      variant: `${variant}-place`,
      pool,
      total: 5,
      k: r(2, 3),
      context: "",
      ask: (k) =>
        `Select the ${k} numbers that round to ${unitText} at the nearest ${name}.`,
      one: "number",
      hint: () =>
        `A number rounds to ${unitText} at the nearest ${name} when it is at least $${toText(target - 50)}$ and less than $${toText(target + 50)}$. Compare each number with those two boundaries, digit by digit.`,
    }),
    lead: [
      `Rounding to the nearest ${name} means replacing a number with the closest ${name} value.`,
      `A number rounds to ${unitText} when it is less than half a ${name} away from it. A number exactly halfway rounds up.`,
    ],
    tail: [`The numbers marked true round to ${unitText}.`],
  };
}

/* --------------------------------------------------- compare with π or √ */

export const compareToPiTemplate = selectTemplate({
  id: "compare-to-pi-select",
  title: "Select the numbers greater or less than a value",
  skillId: "approximate-roots",
  gradeBand: "6–8",
  difficultyOffset: 0.3,
  description:
    "Select every number that is greater than or less than $\\pi$ or a square root, among decimals, fractions and square roots written close to it.",
});

interface Real {
  tex: string;
  value: number;
}
function compareToPi(r: Random) {
  const variant = pick(r, ["pi-greater", "pi-less", "root-greater"] as const);
  const greater = variant !== "pi-less";
  let refTex = "\\pi";
  let ref = Math.PI;
  const cands: Real[] = [];
  if (variant === "root-greater") {
    const n = pick(r, [20, 23, 28, 35, 40, 45, 52, 60, 70]);
    refTex = `\\sqrt{${n}}`;
    ref = Math.sqrt(n);
    const base = Math.floor(ref * 10) / 10;
    for (const d of [-0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.5, 1]) {
      const v = Math.round((base + d) * 100) / 100;
      cands.push({ tex: String(v), value: v });
      const w = Math.round((base + d) * 10) / 10;
      cands.push({ tex: String(w), value: w });
    }
    for (const m of [n - 7, n - 3, n - 1, n + 1, n + 3, n + 8])
      cands.push({ tex: `\\sqrt{${m}}`, value: Math.sqrt(m) });
    for (const q of [3, 4, 5, 7]) {
      const p = Math.round(ref * q);
      cands.push({ tex: fr(p, q), value: p / q });
      cands.push({ tex: fr(p + 1, q), value: (p + 1) / q });
    }
  } else {
    for (const v of [
      3.1, 3.14, 3.15, 3.2, 3.13, 3.141, 3.142, 3.1416, 3.1415, 3.16, 3.12,
    ])
      cands.push({ tex: String(v), value: v });
    cands.push({ tex: fr(22, 7), value: 22 / 7 });
    cands.push({ tex: fr(355, 113), value: 355 / 113 });
    cands.push({ tex: fr(157, 50), value: 157 / 50 });
    cands.push({ tex: fr(25, 8), value: 25 / 8 });
    cands.push({ tex: fr(63, 20), value: 63 / 20 });
    for (const m of [9, 10, 11, 12, 8])
      cands.push({ tex: `\\sqrt{${m}}`, value: Math.sqrt(m) });
  }
  const pool: Statement[] = [];
  const seen = new Set<string>();
  for (const c of cands) {
    // One value is one statement: 6 and 30/5 must not both be offered.
    const key = c.value.toFixed(9);
    if (seen.has(key) || Math.abs(c.value - ref) < 1e-7) continue;
    seen.add(key);
    const holds = greater ? c.value > ref : c.value < ref;
    const rel = c.value > ref ? "greater than" : "less than";
    pool.push(
      st(
        `$${c.tex}$`,
        holds,
        /^[0-9.]+$/.test(c.tex)
          ? `$${c.tex}$ is ${rel} $${refTex}\\approx${ref.toFixed(5)}$.`
          : `$${c.tex}\\approx${c.value.toFixed(5).replace(/0+$/, "")}$ and $${refTex}\\approx${ref.toFixed(5)}$, so $${c.tex}$ is ${rel} $${refTex}$.`,
      ),
    );
  }
  return {
    ...selectModel({
      variant,
      pool,
      total: 5,
      k: r(2, 3),
      context: "",
      ask: (k) =>
        `Select the ${k} numbers that are ${greater ? "greater" : "less"} than $${refTex}$.`,
      one: "number",
      hint: (shown) =>
        variant === "root-greater"
          ? `Find $\\sqrt{${Math.round(ref * ref)}}$ to the nearest hundredth by squaring: it lies between two tenths. Write each choice as a decimal to the same place before comparing.`
          : `Use $\\pi\\approx3.14159$. Write each choice as a decimal to at least four places, then compare it digit by digit with $\\pi$ as $3.14159\\ldots$. The question asks for ${shown.filter((x) => x.holds).length} numbers.`,
    }),
    lead: [
      variant === "root-greater"
        ? `$${refTex}$ is the positive number that times itself makes ${refTex.slice(6, -1)}. It is about ${ref.toFixed(5).replace(/0+$/, "")}.`
        : "$\\pi$ is the distance around any circle divided by the distance across it. It is about 3.14159.",
      "Write each choice as a decimal, then compare place by place from the left.",
    ],
    tail: [
      `The numbers marked true are ${greater ? "greater" : "less"} than $${refTex}$.`,
    ],
  };
}

/* ----------------------------------------------- multiplication fact grid */

export const factGridTemplate = selectTemplate({
  id: "multiplication-fact-grid-select",
  title: "Select every fact with a product",
  skillId: "multiplication-facts",
  gradeBand: "3–5",
  difficultyOffset: 0.1,
  description:
    "Select every multiplication fact in a grid of six that has a stated product, among facts made by changing one factor by one.",
});

function factGrid(r: Random) {
  const prods = [12, 16, 18, 24, 30, 36, 40, 48, 54, 60, 72];
  const P = pick(r, prods);
  const pool: Statement[] = [];
  const seenPairs = new Set<string>();
  const cand = (x: number, y: number) => {
    if (x < 2 || y < 2 || x > 12 || y > 12) return;
    const key = `${Math.min(x, y)}x${Math.max(x, y)}`;
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    const holds = x * y === P;
    pool.push(
      st(
        `$${x}\\times${y}$`,
        holds,
        `$${x}\\times${y}=${x * y}$, which is ${holds ? "equal to" : "not equal to"} $${P}$.`,
      ),
    );
  };
  for (let x = 2; x <= 12; x++)
    if (P % x === 0)
      cand(...(r(0, 1) ? ([x, P / x] as const) : ([P / x, x] as const)));
  for (let x = 2; x <= 12; x++)
    if (P % x === 0) {
      const y = P / x;
      cand(x, y + 1);
      cand(x + 1, y);
      cand(x, y - 1);
      cand(x - 1, y);
      cand(x + 2, y);
    }
  return {
    ...selectModel({
      variant: P <= 36 ? "small-product" : "large-product",
      pool,
      total: 6,
      k: r(2, 3),
      context: "",
      ask: (k) =>
        `Select the ${k} multiplication facts that have a product of $${P}$.`,
      one: "fact",
      hint: () =>
        `Ask which numbers from $2$ to $12$ divide $${P}$ evenly: each one has a partner that makes a fact with product $${P}$. Then find the product of every fact in the grid and compare it with $${P}$.`,
    }),
    lead: [
      `A multiplication fact such as $3\\times4=12$ multiplies two numbers. Find the answer of each fact and compare it with $${P}$.`,
    ],
    tail: [`The facts marked true multiply to $${P}$.`],
  };
}

/* ------------------------------------------- equations with equal factors */

export const equalFactorTemplate = selectTemplate({
  id: "equal-factor-truth-select",
  title: "Select the true equations with squares",
  skillId: "multiplication-division-equality",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Select every true multiplication or division equation, including a number times itself and a number divided by itself, written with the operation or the result first.",
});
export const historicalEqualFactorTemplate = {
  ...equalFactorTemplate,
  id: "equal-factor-equations-select",
  skillId: "missing-factor",
};

function equalFactor(r: Random) {
  const pool: Statement[] = [];
  const seen = new Set<string>();
  const add = (
    operation: string,
    result: string,
    holds: boolean,
    why: string,
  ) => {
    const key = `${operation}=${result}`;
    if (seen.has(key)) return;
    seen.add(key);
    pool.push({
      label: `$${operation}=${result}$`,
      holds,
      why,
      equation: { operation, result },
    });
  };
  const ns = sample(r, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 6);
  ns.forEach((n, i) => {
    const sq = n * n;
    const wrongs = [sq + n, sq - n, sq + 2, sq - 2, sq + 10].filter(
      (v) => v > 0 && v !== sq,
    );
    const w = wrongs[r(0, wrongs.length - 1)]!;
    if (i % 3 === 0) {
      add(`${n}\\times${n}`, String(sq), true, `$${n}\\times${n}=${sq}$.`);
      add(
        `${n}\\times${n}`,
        String(w),
        false,
        `$${n}\\times${n}=${sq}$, not $${w}$.`,
      );
    } else if (i % 3 === 1) {
      add(
        `${sq}\\div${n}`,
        String(n),
        true,
        `$${n}\\times${n}=${sq}$, so $${sq}\\div${n}=${n}$.`,
      );
      add(
        `${sq}\\div${n}`,
        String(n + 1),
        false,
        `$${sq}\\div${n}=${n}$ because $${n}\\times${n}=${sq}$, not $${n + 1}$.`,
      );
    } else {
      const m = n + r(1, 3);
      add(
        `${n}\\times${m}`,
        String(n * m),
        true,
        `$${n}\\times${m}=${n * m}$.`,
      );
      add(
        `${n}\\times${m}`,
        String(n * m + n),
        false,
        `$${n}\\times${m}=${n * m}$, not $${n * m + n}$.`,
      );
      add(
        `${n * m}\\div${n}`,
        String(m - 1),
        false,
        `$${n}\\times${m}=${n * m}$, so $${n * m}\\div${n}=${m}$, not $${m - 1}$.`,
      );
    }
    add(
      `${sq}\\div${n}`,
      String(n),
      true,
      `$${n}\\times${n}=${sq}$, so $${sq}\\div${n}=${n}$.`,
    );
  });
  const n0 = ns[0]!;
  return {
    ...selectModel({
      variant: "equal-factors",
      pool,
      total: 6,
      k: r(2, 4),
      context: "",
      ask: (k) => `Select the ${k} equations that are true.`,
      hint: (shown, format) =>
        `${format === "select-all" ? `Exactly ${shown.filter((x) => x.holds).length} of the equations are true.` : `Decide each of the ${shown.length} statements separately.`} Check one equation at a time. For a number times itself, such as $${n0}\\times${n0}$, find the product first; for a division, ask what number times the divisor gives the number you start with.`,
    }),
  };
}

/* ------------------------------------------------------------ registry */

const equalFactorFamily = selectFamily(
  equalFactorTemplate,
  (r) => equalFactor(r),
  {
    orientation: orientationAxis,
  },
  "both",
);
export const historicalEqualFactorFamily = selectFamily(
  historicalEqualFactorTemplate,
  (r) => equalFactor(r),
  { orientation: orientationAxis },
  "both",
);
const placeValueFamily = selectFamily(placeValueFormsTemplate, (r) =>
  placeValueModel(r, pick(r, ["five-digit", "inner-zero", "word-comparison"])),
);
const families = {
  "place-value-forms-select": placeValueFamily,
  "equivalent-fractions-select": selectFamily(
    equivalentFractionsTemplate,
    equivalentFractions,
  ),
  "fraction-line-names-select": selectFamily(
    fractionLineNamesTemplate,
    fractionLineNames,
  ),
  "equivalent-ratios-select": selectFamily(
    equivalentRatiosTemplate,
    equivalentRatios,
  ),
  "rounds-to-select": selectFamily(roundsToTemplate, roundsTo),
  "compare-to-pi-select": selectFamily(compareToPiTemplate, compareToPi),
  "multiplication-fact-grid-select": selectFamily(factGridTemplate, factGrid),
  "equal-factor-truth-select": equalFactorFamily,
};
export const multiselectNumberFamilies = families;
export const multiselectNumberTemplates = [
  placeValueFormsTemplate,
  equivalentFractionsTemplate,
  fractionLineNamesTemplate,
  equivalentRatiosTemplate,
  roundsToTemplate,
  compareToPiTemplate,
  factGridTemplate,
  equalFactorTemplate,
] as const;
export const multiselectNumberGenerate = dispatch(
  multiselectNumberTemplates,
  Object.fromEntries(
    Object.entries(families).map(([id, f]) => [
      id,
      (seed: string): GeneratedProblem =>
        (
          f as { generate: (s: string) => { problem: GeneratedProblem } }
        ).generate(seed).problem,
    ]),
  ),
);
