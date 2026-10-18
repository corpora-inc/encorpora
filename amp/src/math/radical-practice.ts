import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

type Q = { n: number; d: number };
type Expression = Map<number, Q>;
type Random = (low: number, high: number) => number;
type Case = {
  prompt: string;
  value: Expression;
  explanation: string[];
  tags: string[];
  key: string;
};
const gcd = (a: number, b: number): number => {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
};
function q(n: number, d = 1): Q {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Expected exact rational arithmetic");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const number = (a: Q) => (a.d === 1 ? String(a.n) : `\\frac{${a.n}}{${a.d}}`);
/** Prime exponents split into pairs outside the root and single factors inside. */
function root(n: number): [number, number] {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("Expected a nonnegative integer radicand");
  if (n === 0) return [0, 1];
  let outside = 1,
    inside = 1,
    remaining = n;
  for (let p = 2; p * p <= remaining; p++) {
    let exponent = 0;
    while (remaining % p === 0) {
      remaining /= p;
      exponent++;
    }
    outside *= p ** Math.floor(exponent / 2);
    if (exponent % 2) inside *= p;
  }
  return [outside, inside * remaining];
}
function term(coefficient: Q, radicand: number): Expression {
  const [outside, inside] = root(radicand);
  return coefficient.n === 0 || outside === 0
    ? new Map()
    : new Map([[inside, q(coefficient.n * outside, coefficient.d)]]);
}
function sum(a: Expression, b: Expression): Expression {
  const result = new Map(a);
  for (const [r, c] of b) {
    const value = add(result.get(r) ?? q(0), c);
    if (value.n) result.set(r, value);
    else result.delete(r);
  }
  return result;
}
function text(value: Expression): string {
  const terms = [...value].sort(([a], [b]) => a - b);
  if (!terms.length) return "0";
  return terms
    .map(([r, c], i) => {
      const sign = c.n < 0 ? (i ? " - " : "-") : i ? " + " : "";
      const magnitude = q(Math.abs(c.n), c.d);
      const coefficient =
        r !== 1 && magnitude.n === magnitude.d ? "" : number(magnitude);
      return sign + coefficient + (r === 1 ? "" : `\\sqrt{${r}}`);
    })
    .join("");
}
const rawTerm = (a: number, n: number) =>
  `${a === 1 ? "" : a === -1 ? "-" : a}\\sqrt{${n}}`;
const nonzero = (r: Random, maximum: number) => {
  const n = r(1, maximum);
  return r(0, 1) ? n : -n;
};
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
const descriptions = [
  [
    "simplify-square-root",
    "Simplify a square root",
    "Extract square factors and give an exact square-root expression.",
  ],
  [
    "combine-square-roots",
    "Add and subtract square roots",
    "Simplify radical terms, then combine terms with the same radical part.",
  ],
  [
    "multiply-square-roots",
    "Multiply square roots",
    "Multiply signed coefficients and nonnegative radicands, then simplify.",
  ],
  [
    "rationalize-radical-denominator",
    "Rationalize a denominator",
    "Remove a square root from a single-term denominator using an equivalent fraction.",
  ],
] as const;
export const radicalTemplates: readonly TemplateMetadata[] = descriptions.map(
  ([id, title, description]) => ({
    id,
    title,
    description,
    skillId: "rational-exponents",
    gradeBand: "9–12",
    requiredResponseCapability: "single-choice-v1",
    version: 1,
  }),
);
const hints: Record<string, string> = {
  "simplify-square-root":
    "A square root is the nonnegative number whose square is the radicand. Find a square factor of the radicand and take its square root outside the radical sign.",
  "combine-square-roots":
    "Simplify each square root first. Terms with the same remaining square root have like radical parts: add or subtract their coefficients, keeping that root. Unlike radical parts remain separate.",
  "multiply-square-roots":
    "Multiply the coefficients, including their signs. For nonnegative radicands, multiply the numbers under the roots. Extract every square factor from the resulting radicand.",
  "rationalize-radical-denominator":
    "Simplify the denominator's square root first. Multiply the numerator and denominator by its remaining square root. Their quotient stays unchanged because the multiplying fraction equals 1.",
};
function simplifyCase(r: Random, zero = false): Case {
  const n = zero ? 0 : r(0, 400),
    [a, b] = root(n),
    value = term(q(1), n),
    answer = text(value);
  const explanation =
    n === 0
      ? [
          "The square root means the nonnegative number whose square is the radicand.",
          "$0 \\times 0 = 0$, so $\\sqrt{0} = 0$.",
        ]
      : a === 1
        ? [
            `The positive integer ${n} has no square factor greater than 1.`,
            n === 1
              ? "$\\sqrt{1} = 1$ because $1 \\times 1 = 1$."
              : `$\\sqrt{${n}}$ is already in simplest radical form.`,
            `Check: $${answer} \\times ${answer} = ${n}$. The root is nonnegative.`,
          ]
        : [
            `Factor the radicand using its largest square factor: $${n} = ${a * a} \\times ${b}$.`,
            `For nonnegative numbers, the square root of a product is the product of their square roots: $\\sqrt{${n}} = \\sqrt{${a * a}}\\sqrt{${b}} = ${answer}$.`,
            `Check: $${answer} \\times ${answer} = ${n}$. The root is nonnegative.`,
          ];
  return {
    prompt: `Simplify $\\sqrt{${n}}$.`,
    value,
    explanation,
    tags: [
      n === 0
        ? "zero"
        : b === 1
          ? "perfect-square"
          : a === 1
            ? "square-free"
            : "extract-square",
      ...(a >= 3 && b !== 1 ? ["larger-square-factor"] : []),
    ],
    key: String(n),
  };
}
const bases = [1, 2, 3, 5, 6, 7, 10, 11];
function combineCase(r: Random, cancellation = false): Case {
  const mode = cancellation ? 0 : r(0, 3);
  let a: number, b: number, m: number, n: number;
  if (mode <= 1) {
    const base = bases[r(0, bases.length - 1)]!,
      maximum = Math.floor(Math.sqrt(200 / base));
    const u = r(1, Math.min(6, maximum)),
      v = r(1, Math.min(6, maximum));
    m = base * u * u;
    n = base * v * v;
    a = nonzero(r, 6);
    b = nonzero(r, 6);
    if (cancellation) {
      a = v / gcd(u, v);
      b = -u / gcd(u, v);
    }
  } else {
    a = nonzero(r, 6);
    b = nonzero(r, 6);
    m = r(1, 200);
    n = r(1, 200);
  }
  const first = term(q(a), m),
    second = term(q(b), n),
    value = sum(first, second);
  const [um, rm] = root(m),
    [un, rn] = root(n);
  const opening = `${rawTerm(a, m)} ${b < 0 ? "-" : "+"} ${rawTerm(Math.abs(b), n)}`;
  const explanation = [
    `Extract square factors from the first term: $${rawTerm(a, m)} = ${text(first)}$.`,
    `Extract square factors from the second signed term: $${rawTerm(b, n)} = ${text(second)}$.`,
    rm === rn
      ? `The radical parts match. Add the signed coefficients: $${a * um} ${b * un < 0 ? "-" : "+"} ${Math.abs(b * un)} = ${a * um + b * un}$. Thus $${opening} = ${text(value)}$.`
      : `The simplified terms have different radical parts, so they remain separate: $${opening} = ${text(value)}$.`,
    value.size === 0
      ? "Equal terms with opposite signs cancel. Their sum is 0."
      : rm === rn
        ? rm === 1
          ? "Both simplified terms are whole numbers."
          : `The coefficient counts copies of $\\sqrt{${rm}}$; the radicand stays ${rm}.`
        : "Addition and subtraction do not combine different numbers under a square-root sign.",
  ];
  return {
    prompt: `Simplify $${opening}$.`,
    value,
    explanation,
    tags: [
      rm === rn ? "like-roots" : "unlike-roots",
      ...(value.size === 0 ? ["zero"] : []),
      ...(value.size === 1 && value.has(1) ? ["rational-result"] : []),
      ...(rm === 1 || rn === 1 ? ["perfect-square-term"] : []),
      ...(um > 1 || un > 1 ? ["extract-first"] : []),
      b < 0 ? "subtraction" : "addition",
      ...(a < 0 ? ["negative-leading"] : []),
    ],
    key: JSON.stringify([a, m, b, n]),
  };
}
function multiplyCase(r: Random): Case {
  const a = nonzero(r, 6),
    b = nonzero(r, 6),
    m = r(1, 100),
    n = r(1, 100),
    product = a * b;
  const [factor, remaining] = root(m * n),
    value = term(q(product), m * n),
    source = `(${rawTerm(a, m)})(${rawTerm(b, n)})`;
  const explanation = [
    `Multiply the signed coefficients: $${a < 0 ? `(${a})` : a} \\times ${b < 0 ? `(${b})` : b} = ${product}$.`,
    `The radicands are nonnegative, so $\\sqrt{${m}}\\sqrt{${n}} = \\sqrt{${m * n}}$.`,
    `Factor the new radicand: $${m * n} = ${factor * factor} \\times ${remaining}$. Therefore $${rawTerm(product, m * n)} = ${text(value)}$.`,
    `The simplified product is $${source} = ${text(value)}$.`,
  ];
  return {
    prompt: `Simplify $${source}$.`,
    value,
    explanation,
    tags: [
      product < 0 ? "negative-product" : "positive-product",
      remaining === 1 ? "rational-product" : "irrational-product",
      ...(factor > 1 ? ["extract-product"] : []),
      ...(a < 0 && b < 0 ? ["two-negatives"] : []),
    ],
    key: JSON.stringify([a, m, b, n]),
  };
}
function rationalizeCase(r: Random): Case {
  const a = nonzero(r, 12),
    b = r(1, 6);
  let n: number, factor: number, remaining: number;
  do {
    n = r(2, 100);
    [factor, remaining] = root(n);
  } while (remaining === 1);
  const denominatorCoefficient = b * factor,
    value = term(q(a, denominatorCoefficient * remaining), remaining);
  const denominator = rawTerm(b, n),
    simplifiedDenominator = rawTerm(denominatorCoefficient, remaining);
  const source = `\\frac{${a}}{${denominator}}`;
  const coefficient = q(a, denominatorCoefficient * remaining);
  const explanation = [
    `Simplify the root in the denominator: $\\sqrt{${n}} = ${text(term(q(1), n))}$. The denominator is $${denominator} = ${simplifiedDenominator}$.`,
    `Multiply numerator and denominator by $\\sqrt{${remaining}}$. This multiplies the fraction by $\\frac{\\sqrt{${remaining}}}{\\sqrt{${remaining}}} = 1$, because the square root is nonzero.`,
    `$${source} = \\frac{${rawTerm(a, remaining)}}{${denominatorCoefficient * remaining}} = ${text(value)}$. The denominator is rational and the coefficient is reduced.`,
    `Check by multiplying by the original denominator: $(${text(value)})(${denominator}) = ${a}$.`,
  ];
  return {
    prompt: `Rationalize the denominator and simplify $${source}$.`,
    value,
    explanation,
    tags: [
      a < 0 ? "negative-numerator" : "positive-numerator",
      factor > 1 ? "simplify-denominator" : "square-free-denominator",
      coefficient.d === 1 ? "integer-coefficient" : "fraction-coefficient",
      ...(gcd(Math.abs(a), denominatorCoefficient * remaining) > 1
        ? ["reduce-fraction"]
        : []),
    ],
    key: JSON.stringify([a, b, n]),
  };
}
function shuffle<T>(values: T[], r: Random): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = r(0, i);
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  return values;
}
export function radicalPrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = radicalTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown radical template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  const create = (zero = false): Case =>
    id === "simplify-square-root"
      ? simplifyCase(r, zero)
      : id === "combine-square-roots"
        ? combineCase(r, zero)
        : id === "multiply-square-roots"
          ? multiplyCase(r)
          : rationalizeCase(r);
  const candidates: Case[] = [];
  const zeroCohort =
    (id === "simplify-square-root" || id === "combine-square-roots") &&
    r(0, 3) === 0;
  if (zeroCohort) candidates.push(create(true));
  for (let attempts = 0; candidates.length < 4 && attempts < 256; attempts++) {
    const candidate = create();
    if (candidates.every((c) => text(c.value) !== text(candidate.value)))
      candidates.push(candidate);
  }
  if (candidates.length !== 4)
    throw new Error("Could not form distinct exact radical choices");
  // Select only after the entire answer cohort is fixed: every candidate is equally likely.
  const target = candidates[r(0, 3)]!,
    correct = text(target.value);
  const choices = shuffle(
    candidates.map((c) => text(c.value)),
    r,
  ).map((value, i) => ({
    id: `option-${"abcd"[i]}`,
    label: /^-?\d+$/.test(value) ? value : `$${value}$`,
  }));
  const answer = choices.find(
    (c) => c.label === (/^-?\d+$/.test(correct) ? correct : `$${correct}$`),
  )!.id;
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: metadata.skillId,
      prompt: target.prompt,
      response: {
        kind: "choice",
        label: "Simplified expression",
        options: choices,
      },
    },
    answer,
    hint: hints[id]!,
    explanation: target.explanation,
    choiceFeedback: Object.fromEntries(
      choices
        .filter((c) => c.id !== answer)
        .map((c) => [
          c.id,
          `${hints[id]} For these givens, the exact simplified expression is $${correct}$.`,
        ]),
    ),
  };
  return {
    problem,
    tags: [
      ...target.tags,
      ...(candidates.some((c) => c.value.size === 0) ? ["zero-option"] : []),
    ],
    caseKey: target.key,
  };
}
export function generateRadicalProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return radicalPrintCase(id, seed).problem;
}
