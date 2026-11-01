import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

type Q = { n: number; d: number };
type Random = (low: number, high: number) => number;
type Case = {
  prompt: string;
  value: Q;
  explanation: string[];
  /** One step for this instance: its own numbers and the first move. */
  hint: string;
  tags: string[];
  key: string;
};
/** Plain text for a fraction or a TeX fragment: 3/4, −5/6, (3/4 + 2). */
const plain = (x: Q | string) =>
  (typeof x === "string"
    ? x
        .replace(/\\d?frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
        .replace(/\\left\(|\\right\)/g, (m) => (m.includes("left") ? "(" : ")"))
    : x.d === 1
      ? `${x.n}`
      : `${x.n}/${x.d}`
  ).replace(/-/g, "−");
const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
function q(n: number, d = 1): Q {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Expected exact rational arithmetic");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const negate = (a: Q) => q(-a.n, a.d);
const multiply = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const reciprocal = (a: Q) => q(a.d, a.n);
const same = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
/** Lowest-terms answer accepted by the fraction response protocol. */
const answer = (a: Q) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);
/** TeX for a value; a leading minus belongs to the whole fraction. */
function tex(a: Q): string {
  const magnitude =
    a.d === 1 ? String(Math.abs(a.n)) : `\\frac{${Math.abs(a.n)}}{${a.d}}`;
  return (a.n < 0 ? "-" : "") + magnitude;
}
/** A negative value after an operator keeps its own parentheses. */
const operand = (a: Q) => (a.n < 0 ? `\\left(${tex(a)}\\right)` : tex(a));
const unsafeDenominator = (a: Q) => [10, 100, 1000].includes(a.d);
function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return low + (value % span);
  };
}
const denominators = [2, 3, 4, 5, 6, 8, 9, 12];
/** A positive fraction n/d in lowest terms with 1 <= n < 2d and d > 1. */
function positiveFraction(r: Random, list = denominators): Q {
  const d = list[r(0, list.length - 1)]!;
  let n: number;
  do n = r(1, 2 * d - 1);
  while (gcd(n, d) !== 1);
  return q(n, d);
}
const signed = (r: Random, value: Q) => (r(0, 1) ? value : negate(value));

const descriptions = [
  [
    "signed-fraction-sum",
    "Add and subtract signed fractions",
    "signed-addition",
    "6–8",
    "Add or subtract two signed fractions with different denominators.",
  ],
  [
    "signed-fraction-product",
    "Multiply and divide signed fractions",
    "signed-multiplication",
    "6–8",
    "Multiply or divide two signed fractions and reduce the result.",
  ],
  [
    "complex-fraction",
    "Simplify a complex fraction",
    "complex-fractions",
    "6–8",
    "Simplify a fraction whose numerator and denominator contain fractions.",
  ],
  [
    "rational-power",
    "Evaluate a fractional power",
    "rational-exponents",
    "9–12",
    "Evaluate a positive rational base raised to a fractional exponent.",
  ],
] as const;
export const rationalTemplates: readonly TemplateMetadata[] = descriptions.map(
  ([id, title, skillId, gradeBand, description]) => ({
    id,
    title,
    description,
    skillId,
    gradeBand,
    version: 1,
  }),
);
const suffix = " Give an exact fraction or integer.";

/** Rename a + b over the least common denominator, add numerators, reduce. */
function sumSteps(a: Q, b: Q): string {
  const total = add(a, b),
    l = lcm(a.d, b.d),
    an = a.n * (l / a.d),
    bn = b.n * (l / b.d),
    s = an + bn;
  if (!same(q(s, l), total)) throw new Error("Inconsistent sum");
  const op = (n: number) => (n < 0 ? "-" : "+");
  const chain = [`${tex(a)} ${op(b.n)} ${tex(q(Math.abs(b.n), b.d))}`];
  if (a.d !== l || b.d !== l)
    chain.push(
      `${an < 0 ? "-" : ""}\\frac{${Math.abs(an)}}{${l}} ${op(bn)} \\frac{${Math.abs(bn)}}{${l}}`,
    );
  chain.push(`\\frac{${an} ${op(bn)} ${Math.abs(bn)}}{${l}}`);
  chain.push(`${s < 0 ? "-" : ""}\\frac{${Math.abs(s)}}{${l}}`);
  if (gcd(s, l) !== 1) chain.push(tex(total));
  return chain.join(" = ");
}

function sumCase(r: Random): Case {
  let a: Q, b: Q, subtract: boolean, value: Q;
  do {
    a = signed(r, positiveFraction(r));
    b = signed(r, positiveFraction(r));
    subtract = r(0, 1) === 1;
    value = add(a, subtract ? negate(b) : b);
  } while (a.d === b.d || unsafeDenominator(value));
  const prompt = `${tex(a)} ${subtract ? "-" : "+"} ${operand(b)}`;
  const addend = subtract ? negate(b) : b;
  const l = lcm(a.d, b.d),
    raw = a.n * (l / a.d) + addend.n * (l / addend.d);
  const explanation = [
    subtract
      ? `Subtracting a number is adding its opposite: $${prompt} = ${tex(a)} + ${operand(addend)}$.`
      : `The expression is a sum: $${prompt}$. Each fraction keeps its own sign, + or −.`,
    `Fractions add only when their pieces are the same size. The bottom number, the denominator, sets the piece size.`,
    `The least common denominator of ${a.d} and ${b.d} is ${l}: the smallest number that both ${a.d} and ${b.d} divide into evenly.`,
    `Rename both fractions with denominator ${l}. Add the top numbers, the numerators, keeping their signs. Then reduce, dividing top and bottom by any shared factor: $${sumSteps(a, addend)}$.`,
    `Check: $${tex(value)} - ${operand(addend)} = ${tex(a)}$.`,
  ];
  return {
    prompt: `Calculate $${prompt}$.${suffix}`,
    value,
    explanation,
    hint: `${subtract ? `Subtracting ${plain(b)} is adding its opposite, ${plain(addend)}. ` : ""}The least common denominator of ${a.d} and ${b.d} is ${l}: rename both fractions with it, then add the signed numerators.`,
    tags: [
      subtract ? "subtraction" : "addition",
      value.n < 0 ? "negative-result" : "positive-result",
      ...(subtract && b.n < 0 ? ["subtract-negative"] : []),
      ...(a.n < 0 && addend.n < 0 ? ["both-negative"] : []),
      ...(gcd(raw, l) > 1 ? ["reduce-result"] : []),
      gcd(a.d, b.d) === 1 ? "coprime-denominators" : "shared-factor",
      ...(Math.abs(value.n) > value.d ? ["improper-result"] : []),
    ],
    key: JSON.stringify([a, subtract, b]),
  };
}

function productCase(r: Random): Case {
  let a: Q, b: Q, divide: boolean, value: Q;
  do {
    a = signed(r, positiveFraction(r));
    b = signed(r, positiveFraction(r));
    divide = r(0, 1) === 1;
    value = multiply(a, divide ? reciprocal(b) : b);
  } while (unsafeDenominator(value) || Math.abs(value.n) > 144);
  const factor = divide ? reciprocal(b) : b,
    prompt = `${tex(a)} ${divide ? "\\div" : "\\times"} ${operand(b)}`,
    numerator = Math.abs(a.n) * Math.abs(factor.n),
    denominator = a.d * factor.d,
    sign = value.n < 0 ? "-" : "";
  const explanation = [
    divide
      ? `Dividing by a fraction is multiplying by its reciprocal, the fraction flipped upside down: $${prompt} = ${tex(a)} \\times ${operand(factor)}$.`
      : `Multiply the two signed fractions: $${prompt}$. Signed means each keeps its + or − sign.`,
    a.n < 0 === b.n < 0
      ? "Find the sign first. The two numbers have the same sign, so the result is positive."
      : "Find the sign first. The two numbers have opposite signs, so the result is negative.",
    `Multiply the top numbers, the numerators, together. Multiply the bottom numbers, the denominators, together${gcd(numerator, denominator) > 1 ? ". Then reduce: divide top and bottom by their shared factor" : ". The result is already in lowest terms"}: $${tex(a)} \\times ${operand(factor)} = ${sign}\\frac{${Math.abs(a.n)} \\times ${Math.abs(factor.n)}}{${a.d} \\times ${factor.d}} = ${sign}\\frac{${numerator}}{${denominator}}${gcd(numerator, denominator) > 1 ? ` = ${tex(value)}` : ""}$.`,
    divide
      ? `Check by multiplying the quotient by the divisor: $${tex(value)} \\times ${operand(b)} = ${tex(a)}$.`
      : `Check by dividing the product by one factor: $${tex(value)} \\div ${operand(b)} = ${tex(a)}$.`,
  ];
  return {
    prompt: `Calculate $${prompt}$.${suffix}`,
    value,
    explanation,
    hint: `${divide ? `Dividing by ${plain(b)} is multiplying by its reciprocal, ${plain(factor)}. ` : ""}The signs ${a.n < 0 === b.n < 0 ? "match, so the result is positive" : "differ, so the result is negative"}. Multiply ${plain(q(Math.abs(a.n), a.d))} by ${plain(q(Math.abs(factor.n), factor.d))}, cancelling common factors first.`,
    tags: [
      divide ? "division" : "multiplication",
      value.n < 0 ? "negative-result" : "positive-result",
      ...(a.n < 0 && b.n < 0 ? ["two-negatives"] : []),
      ...(gcd(numerator, denominator) > 1 ? ["reduce-result"] : []),
      ...(value.d === 1 ? ["integer-result"] : []),
    ],
    key: JSON.stringify([a, divide, b]),
  };
}

type Part = { text: string; value: Q; step?: string; tags: string[] };
/** A positive fraction, possibly paired by + or − with a fraction or whole number. */
function part(r: Random, pair: boolean): Part {
  const first = positiveFraction(r);
  if (!pair) return { text: tex(first), value: first, tags: [] };
  let second: Q;
  do second = r(0, 3) === 0 ? q(r(1, 3)) : positiveFraction(r);
  while (second.d === first.d);
  const whole = second.d === 1,
    swap = whole && r(0, 1) === 1,
    [x, y] = swap ? [second, first] : [first, second],
    subtract = r(0, 1) === 1,
    addend = subtract ? negate(y) : y,
    value = add(x, addend),
    text = `${tex(x)} ${subtract ? "-" : "+"} ${tex(y)}`;
  return {
    text,
    value,
    step: sumSteps(x, addend),
    tags: [
      ...(whole ? ["whole-number-term"] : []),
      ...(value.n < 0 ? ["negative-part"] : []),
    ],
  };
}

function complexCase(r: Random): Case {
  for (;;) {
    const mode = r(0, 3);
    let top = part(r, mode === 1 || mode === 3);
    const bottom = part(r, mode === 2 || mode === 3);
    if (mode === 0 && r(0, 1)) {
      const negative = negate(top.value);
      top = { text: tex(negative), value: negative, tags: ["negative-part"] };
    }
    if (!top.value.n || !bottom.value.n || same(top.value, bottom.value))
      continue;
    const value = multiply(top.value, reciprocal(bottom.value));
    if (unsafeDenominator(value) || Math.max(Math.abs(value.n), value.d) > 144)
      continue;
    return complexExplanation(mode, top, bottom, value);
  }
}
/** A part in parentheses only when it is a sum or negative. */
const group = (p: Part) =>
  p.step || p.value.n < 0 ? `(${plain(p.text)})` : plain(p.text);
function complexExplanation(
  mode: number,
  top: Part,
  bottom: Part,
  value: Q,
): Case {
  const flip = reciprocal(bottom.value),
    numerator = top.value.n * flip.n,
    denominator = top.value.d * flip.d,
    sign = numerator < 0 ? "-" : "";
  const source = `\\dfrac{${top.text}}{${bottom.text}}`;
  const explanation = [
    `The main fraction bar, the longest one, means division: $${source} = ${top.step ? `\\left(${top.text}\\right)` : top.text} \\div ${bottom.step || bottom.value.n < 0 ? `\\left(${bottom.text}\\right)` : bottom.text}$.`,
    top.step
      ? `Simplify the numerator: $${top.step}$.`
      : `The numerator is already a single fraction: $${tex(top.value)}$.`,
    bottom.step
      ? `Simplify the denominator: $${bottom.step}$.`
      : `The denominator is already a single fraction: $${tex(bottom.value)}$.`,
    `Dividing by a fraction is multiplying by its reciprocal, the fraction flipped upside down: $${tex(top.value)} \\div ${operand(bottom.value)} = ${tex(top.value)} \\times ${operand(flip)} = ${sign}\\frac{${Math.abs(numerator)}}{${denominator}}${gcd(numerator, denominator) > 1 ? ` = ${tex(value)}` : ""}$.`,
    `Check: $${tex(value)} \\times ${operand(bottom.value)} = ${tex(top.value)}$.`,
  ];
  return {
    prompt: `Simplify $${source}$.${suffix}`,
    value,
    explanation,
    hint: `The main fraction bar means divide: ${group(top)} ÷ ${group(bottom)}. ${top.step || bottom.step ? `Simplify the ${top.step && bottom.step ? "numerator and the denominator" : top.step ? "numerator" : "denominator"} to a single fraction first, then` : "So"} multiply by the reciprocal of the denominator.`,
    tags: [
      [
        "single-over-single",
        "sum-over-single",
        "single-over-sum",
        "sum-over-sum",
      ][mode]!,
      value.n < 0 ? "negative-result" : "positive-result",
      ...Array.from(new Set([...top.tags, ...bottom.tags])),
      ...(value.d === 1 ? ["integer-result"] : []),
      ...(gcd(numerator, denominator) > 1 ? ["reduce-result"] : []),
    ],
    key: source,
  };
}

const rootLimits: Record<number, number> = { 2: 12, 3: 5, 4: 4, 5: 3 };
function powerCase(r: Random): Case {
  let n: number, m: number, a: number, b: number, value: Q;
  do {
    n = r(2, 5);
    m = r(1, 3) * (r(0, 1) ? 1 : -1);
    a = r(1, rootLimits[n]!);
    b = r(1, rootLimits[n]!);
    const root = q(a, b);
    value = q(root.n ** Math.abs(m), root.d ** Math.abs(m));
    if (m < 0) value = reciprocal(value);
  } while (
    gcd(Math.abs(m), n) !== 1 ||
    gcd(a, b) !== 1 ||
    a === b ||
    unsafeDenominator(value) ||
    Math.max(Math.abs(value.n), value.d) > 1000
  );
  const root = q(a, b),
    base = q(a ** n, b ** n),
    baseText = base.d === 1 ? tex(base) : `\\left(${tex(base)}\\right)`,
    rootText = root.d === 1 ? tex(root) : `\\left(${tex(root)}\\right)`,
    radical = n === 2 ? `\\sqrt{${tex(base)}}` : `\\sqrt[${n}]{${tex(base)}}`,
    rootName = ["square root", "cube root", "fourth root", "fifth root"][
      n - 2
    ]!,
    powered = q(root.n ** Math.abs(m), root.d ** Math.abs(m)),
    source = `${baseText}^{${m}/${n}}`;
  const explanation = [
    `In the exponent $${m < 0 ? "-" : ""}\\frac{${Math.abs(m)}}{${n}}$, the denominator ${n} calls for a ${rootName} and the numerator gives the power, ${Math.abs(m)}${m < 0 ? "; the negative sign calls for a reciprocal" : ""}.`,
    `Take the ${rootName}: $${radical} = ${tex(root)}$, because $${rootText}^{${n}} = ${tex(base)}$.`,
    Math.abs(m) === 1
      ? `The power is 1, so the value stays $${tex(root)}$.`
      : `Raise the root to the power ${Math.abs(m)}: $${rootText}^{${Math.abs(m)}} = ${tex(powered)}$.`,
    m < 0
      ? `Take the reciprocal for the negative exponent: $${source} = ${powered.d === 1 ? "" : `\\dfrac{1}{${tex(powered)}} = `}${tex(value)}$.`
      : `Therefore $${source} = ${tex(value)}$.`,
  ];
  return {
    prompt: `Evaluate $${source}$.${suffix}`,
    value,
    explanation,
    hint: `In the exponent ${m < 0 ? "−" : ""}${Math.abs(m)}/${n}, the ${n} calls for the ${rootName} first${Math.abs(m) > 1 ? `, then the power ${Math.abs(m)}` : ""}${m < 0 ? "; the negative sign calls for a reciprocal" : ""}. What is the ${rootName} of ${plain(base)}?`,
    tags: [
      n === 2 ? "square-root" : "higher-root",
      m < 0 ? "negative-exponent" : "positive-exponent",
      Math.abs(m) === 1 ? "unit-power" : "power-after-root",
      base.d === 1 ? "integer-base" : "fraction-base",
      value.d === 1 ? "integer-result" : "fraction-result",
    ],
    key: JSON.stringify([a, b, m, n]),
  };
}

export function rationalPrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = rationalTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown rational template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  const c =
    id === "signed-fraction-sum"
      ? sumCase(r)
      : id === "signed-fraction-product"
        ? productCase(r)
        : id === "complex-fraction"
          ? complexCase(r)
          : powerCase(r);
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: metadata.skillId,
      prompt: c.prompt,
      response: { kind: "fraction", label: "Exact value" },
    },
    answer: answer(c.value),
    hint: c.hint,
    explanation: c.explanation,
  };
  return { problem, tags: c.tags, caseKey: c.key };
}
export function generateRationalProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return rationalPrintCase(id, seed).problem;
}
