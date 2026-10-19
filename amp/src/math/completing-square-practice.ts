import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
export const completingSquareTemplates: readonly TemplateMetadata[] = [
  [
    "complete-square-term",
    "Find the term that completes a square",
    "Find the exact constant that turns a monic quadratic into a squared binomial.",
  ],
  [
    "complete-square-monic",
    "Complete the square with leading coefficient one",
    "Rewrite a monic quadratic as a squared binomial plus an exact constant.",
  ],
  [
    "complete-square-nonmonic",
    "Complete the square with any leading coefficient",
    "Factor the leading coefficient and complete the square with exact rational numbers.",
  ],
].map(([id, title, description]) => ({
  id: id!,
  title: title!,
  description: description!,
  version: 1,
  skillId: "complete-square",
  gradeBand: "9–12",
  ...(id === "complete-square-term"
    ? {}
    : { requiredResponseCapability: "single-choice-v1" as const }),
}));
type Rational = { n: number; d: number };
function q(n: number, d = 1): Rational {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || !d)
    throw new Error("Invalid exact rational");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  let a = Math.abs(n),
    b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
const mul = (a: Rational, b: Rational) => q(a.n * b.n, a.d * b.d);
const sub = (a: Rational, b: Rational) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const tex = (v: Rational): string =>
  v.d === 1
    ? String(v.n)
    : `${v.n < 0 ? "-" : ""}\\frac{${Math.abs(v.n)}}{${v.d}}`;
const magnitude = (v: Rational) => tex({ ...v, n: Math.abs(v.n) });
const operand = (v: Rational) => (v.n < 0 ? `(${tex(v)})` : tex(v));
const tail = (v: Rational, suffix = "") =>
  v.n
    ? ` ${v.n < 0 ? "-" : "+"} ${suffix && Math.abs(v.n) === v.d ? "" : magnitude(v)}${suffix}`
    : "";
const expanded = (a: number, b: number, c: number) =>
  `${a === 1 ? "" : a === -1 ? "-" : a}x^2${tail(q(b), "x")}${tail(q(c))}`;
const shifted = (h: Rational) => (h.n ? `(x${tail(h)})^2` : "x^2");
const completed = (a: number, h: Rational, k: Rational) =>
  `${a === 1 ? "" : a === -1 ? "-" : a}${shifted(h)}${tail(k)}`;
function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return lo + (value % span);
  };
}
function shuffle<T>(values: T[], r: ReturnType<typeof random>): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = r(0, i);
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  return values;
}
function tags(a: number, b: number, c: number, h: Rational, k: Rational) {
  return [
    a < 0 ? "negative-leading" : "positive-leading",
    b < 0 ? "negative-linear" : b > 0 ? "positive-linear" : "zero-linear",
    c === 0 ? "zero-constant" : "nonzero-constant",
    h.d === 1 ? "integer-shift" : "fractional-shift",
    k.d === 1 ? "integer-remainder" : "fractional-remainder",
    k.n < 0
      ? "negative-remainder"
      : k.n > 0
        ? "positive-remainder"
        : "zero-remainder",
  ];
}
export function completingSquarePrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[] } {
  if (!completingSquareTemplates.some((t) => t.id === id))
    throw new Error(`Unknown completing-square template ${id}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  let a = 1,
    b: number,
    c = 0,
    answer: string,
    prompt: string,
    hint: string,
    explanation: string[];
  let response: GeneratedProblem["public"]["response"],
    choiceFeedback: Record<string, string> | undefined;
  if (id === "complete-square-term") {
    b = r(-18, 18);
    const h = q(b, 2),
      square = mul(h, h);
    prompt = `Find $c$ so that $${expanded(1, b, 0)} + c = (x + h)^2$ for some real constant $h$ and every real $x$.`;
    response = { kind: "fraction", label: "Constant c" };
    answer = square.d === 1 ? String(square.n) : `${square.n}/${square.d}`;
    hint =
      "Expand the square: (x + h)(x + h) has two copies of hx. Match their combined coefficient to the given coefficient of x, then square h to find c.";
    explanation = [
      "Multiplying the two identical factors gives $(x + h)^2 = x^2 + 2hx + h^2$.",
      `The coefficients of $x$ must agree: $2h = ${b}$. Divide by 2: $h = \\frac{${b}}{2} = ${tex(h)}$.`,
      `The constant must be $h^2$, so $c = ${h.n < 0 || h.d > 1 ? `(${tex(h)})` : tex(h)}^2 = ${tex(square)}$.`,
      `Check by expanding: $${shifted(h)} = ${expanded(1, b, 0)}${tail(square)}$.`,
    ];
    const problem: GeneratedProblem = {
      public: {
        id: createHash("sha256")
          .update(JSON.stringify([id, 1, seed]))
          .digest("hex"),
        templateId: id,
        templateVersion: 1,
        seed,
        prompt,
        skillId: "complete-square",
        response,
      },
      answer,
      hint,
      explanation,
    };
    return {
      problem,
      tags: [
        ...tags(1, b, 0, h, square),
        b % 2 === 0 ? "even-linear" : "odd-linear",
      ],
    };
  }
  const leading = [-6, -5, -4, -3, -2, -1, 2, 3, 4, 5, 6];
  a = id === "complete-square-monic" ? 1 : leading[r(0, leading.length - 1)]!;
  const bound = a === 1 ? 16 : 18;
  const b1 = r(-bound, bound);
  let b2: number;
  do b2 = r(-bound, bound);
  while (b2 === b1);
  const c1 = r(-24, 24);
  let c2: number;
  do c2 = r(-24, 24);
  while (c2 === c1);
  // Fix all four expressions before choosing the target. Knowing just b or
  // just c leaves two choices; all four target expressions are equiprobable.
  const cohort = [b1, b2].flatMap((linear) =>
    [c1, c2].map((constant) => {
      const h = q(linear, 2 * a),
        k = sub(q(constant), mul(q(a), mul(h, h)));
      return { b: linear, c: constant, h, k, label: `$${completed(a, h, k)}$` };
    }),
  );
  const target = cohort[r(0, 3)]!;
  b = target.b;
  c = target.c;
  const { h, k } = target,
    square = mul(h, h),
    scaled = mul(q(a), square),
    normalized = q(b, a);
  const options = shuffle([...cohort], r).map((item, i) => ({
    id: `option-${"abcd"[i]}`,
    label: item.label,
    item,
  }));
  answer = options.find((o) => o.item === target)!.id;
  response = {
    kind: "choice",
    label: "Completed-square form",
    options: options.map(({ id, label }) => ({ id, label })),
  };
  prompt = `Rewrite $${expanded(a, b, c)}$ in completed-square form.`;
  hint =
    a === 1
      ? "In (x + h)², the coefficient of x is 2h. Halve the given coefficient of x, add and subtract its square, then group the perfect square."
      : "Factor the leading coefficient out of the x² and x terms first. Halve the coefficient of x inside the parentheses. Adding a square inside changes the whole expression by the outside coefficient times that square; subtract the same amount outside.";
  explanation = [];
  if (a !== 1)
    explanation.push(
      `Factor ${a} out of the variable terms: $${expanded(a, b, c)} = ${a}(x^2${tail(normalized, "x")})${tail(q(c))}$.`,
    );
  explanation.push(
    `Inside the square, the two cross-products have combined coefficient $2h$. Thus $h = \\frac{${b}}{${2 * a}} = ${tex(h)}$.`,
  );
  explanation.push(
    `Square that number: $h^2 = ${h.n < 0 || h.d > 1 ? `(${tex(h)})` : tex(h)}^2 = ${tex(square)}$. The outside coefficient scales this addition to $${a} \\times ${operand(square)} = ${tex(scaled)}$.`,
  );
  explanation.push(
    `Keep the original value by subtracting that addition: $k = ${c} - ${operand(scaled)} = ${tex(k)}$.`,
  );
  explanation.push(
    `Group the perfect square: $${expanded(a, b, c)} = ${completed(a, h, k)}$.`,
  );
  explanation.push(
    `Check the expansion: the coefficient of $x$ is $2 \\times ${operand(q(a))} \\times ${operand(h)} = ${b}$; the constant is $${tex(scaled)} + ${operand(k)} = ${c}$. The coefficient of $x^2$ stays ${a}.`,
  );
  choiceFeedback = Object.fromEntries(
    options
      .filter((o) => o.id !== answer)
      .map((o) => [
        o.id,
        `Expanding this choice gives $${expanded(a, o.item.b, o.item.c)}$. ${o.item.b !== b ? `Its coefficient of $x$ is ${o.item.b}; the given coefficient is ${b}.` : `Its constant is ${o.item.c}; the given constant is ${c}.`} Match every coefficient.`,
      ]),
  );
  return {
    problem: {
      public: {
        id: createHash("sha256")
          .update(JSON.stringify([id, 1, seed]))
          .digest("hex"),
        templateId: id,
        templateVersion: 1,
        seed,
        prompt,
        skillId: "complete-square",
        response,
      },
      answer,
      hint,
      explanation,
      choiceFeedback,
    },
    tags: tags(a, b, c, h, k),
  };
}
export function generateCompletingSquareProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return completingSquarePrintCase(id, seed).problem;
}
