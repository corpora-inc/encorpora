import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

export const polynomialTemplates: readonly TemplateMetadata[] = [
  {
    id: "polynomial-addition",
    title: "Add polynomials",
    description: "Combine like terms in a sum of polynomials.",
  },
  {
    id: "polynomial-subtraction",
    title: "Subtract polynomials",
    description: "Distribute a subtraction sign and combine like terms.",
  },
  {
    id: "polynomial-multiplication",
    title: "Multiply polynomials",
    description:
      "Distribute every term and combine like terms in a polynomial product.",
  },
].map((template) => ({
  ...template,
  skillId: "polynomial-arithmetic",
  version: 1,
  gradeBand: "9–12",
  requiredResponseCapability: "single-choice-v1",
}));

// Coefficients are indexed by exponent: [constant, x, x², ...].
type Polynomial = number[];
const power = (degree: number) => ["", "x", "x²", "x³"][degree]!;
const signed = (value: number) =>
  value < 0 ? `(${String(value).replace("-", "−")})` : String(value);
function format(p: Polynomial): string {
  const terms: string[] = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const c = p[k]!;
    if (!c) continue;
    const magnitude = `${Math.abs(c) === 1 && k ? "" : Math.abs(c)}${power(k)}`;
    terms.push(
      `${terms.length ? (c < 0 ? " − " : " + ") : c < 0 ? "−" : ""}${magnitude}`,
    );
  }
  return terms.join("") || "0";
}
function combine(a: Polynomial, b: Polynomial, sign = 1): Polynomial {
  return Array.from(
    { length: Math.max(a.length, b.length) },
    (_, k) => (a[k] ?? 0) + sign * (b[k] ?? 0),
  );
}
function product(a: Polynomial, b: Polynomial): Polynomial {
  const result = Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((c, i) =>
    b.forEach((d, j) => {
      result[i + j]! += c * d;
    }),
  );
  return result;
}
function combineSteps(
  a: Polynomial,
  b: Polynomial,
  source = "polynomial",
): string[] {
  const steps: string[] = [];
  for (let k = Math.max(a.length, b.length) - 1; k >= 0; k--) {
    const c = a[k] ?? 0,
      d = b[k] ?? 0;
    if (!c && !d) continue;
    if (!c || !d) {
      const term = Array<number>(k + 1).fill(0);
      term[k] = c + d;
      steps.push(
        `Keep ${format(term)}; the other ${source} has no ${k ? `${power(k)} term` : "constant term"}.`,
      );
      continue;
    }
    steps.push(
      `${k ? `Coefficient of ${power(k)}` : "Constant term"}: ${signed(c)} + ${signed(d)} = ${String(c + d).replace("-", "−")}.${c + d === 0 ? " These terms cancel." : ""}`,
    );
  }
  return steps;
}
function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return lo + (value % span);
  };
}

type Pair = { left: Polynomial; right: Polynomial; result: Polynomial };
type Random = (lo: number, hi: number) => number;
function shuffle<T>(values: T[], r: Random): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = r(0, i);
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  return values;
}
function problemGroup(templateId: string, r: Random): Pair[] {
  const nz = (max: number) => r(1, max) * (r(0, 1) ? 1 : -1);
  const make = (degree: number, max: number): Polynomial =>
    Array.from({ length: degree + 1 }, (_, k) =>
      k === degree ? nz(max) : r(-max, max),
    );
  const multiply = templateId === "polynomial-multiplication";
  const subtract = templateId === "polynomial-subtraction";
  const left = make(multiply ? 1 : r(1, 3), multiply ? 4 : 8);
  let right = make(multiply ? r(1, 2) : r(1, 3), multiply ? 4 : 8);
  const variant = r(0, 5);
  if (multiply && right.length === 2 && variant === 0) right = [...left];
  if (multiply && right.length === 2 && variant === 1)
    right = [-left[0]!, left[1]!];
  if (!multiply && variant === 0) right = left.map((c) => (subtract ? c : -c));
  if (!multiply && variant === 1) {
    right = [...left];
    right[0]! += nz(3);
  }
  const pair = (a: Polynomial, b: Polynomial): Pair => ({
    left: a,
    right: b,
    result: multiply ? product(a, b) : combine(a, b, subtract ? -1 : 1),
  });

  if (multiply && right.length === 2) {
    // Common leading and constant coefficients require the learner to calculate
    // cross products. Include squares, conjugate factors, and missing constants.
    const leading = left[1]! * right[1]!,
      constant = left[0]! * right[0]!;
    const byMiddle = new Map<number, Pair[]>();
    for (let a = -4; a <= 4; a++) {
      if (!a || leading % a !== 0) continue;
      const c = leading / a;
      if (!c || Math.abs(c) > 4) continue;
      for (let b = -8; b <= 8; b++) {
        const constants =
          b === 0
            ? constant === 0
              ? Array.from({ length: 17 }, (_, i) => i - 8)
              : []
            : constant % b === 0 && Math.abs(constant / b) <= 8
              ? [constant / b]
              : [];
        for (const d of constants) {
          const item = pair([b, a], [d, c]),
            middle = item.result[1]!;
          const choices = byMiddle.get(middle) ?? [];
          choices.push(item);
          byMiddle.set(middle, choices);
        }
      }
    }
    if (byMiddle.size >= 2)
      return shuffle(
        [...byMiddle.values()].map(
          (choices) => choices[r(0, choices.length - 1)]!,
        ),
        r,
      ).slice(0, 4);
  }
  // Vary two coefficients before choosing which question to ask. In a cubic
  // product, keep the leading coefficient fixed and vary the other factor's
  // linear term and constant, so the outer terms cannot determine the answer.
  const length = Math.max(left.length, right.length);
  const padded = Array.from({ length }, (_, k) => right[k] ?? 0);
  const powers = multiply
    ? [0, 1]
    : shuffle(
        Array.from({ length }, (_, k) => k),
        r,
      ).slice(0, 2);
  const changes = powers.map((k) => {
    let delta: number;
    do {
      delta = nz(5);
    } while (k > 0 && padded[k] !== 0 && padded[k]! + delta === 0);
    return { k, delta };
  });
  return Array.from({ length: 4 }, (_, mask) => {
    const b = [...padded];
    changes.forEach(({ k, delta }, i) => {
      if (mask & (1 << i)) b[k]! += delta;
    });
    return pair(left, b);
  });
}

export function generatePolynomialProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = polynomialTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown polynomial template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  // The group and all answer values exist before the requested problem is
  // selected uniformly. No statistic of the options alone privileges the key.
  const group = problemGroup(templateId, r);
  const selected = group[r(0, group.length - 1)]!;
  const { left: a, right: b, result: correct } = selected;
  const multiply = templateId === "polynomial-multiplication";
  const subtract = templateId === "polynomial-subtraction";
  const label = format(correct);
  let prompt: string, hint: string, explanation: string[];
  if (multiply) {
    prompt = `Expand and simplify (${format(a)})(${format(b)}).`;
    hint =
      "Distribute every term of the first factor to every term of the second. Multiply coefficients, add exponents on powers of x, then combine like terms.";
    const partials: Polynomial[] = [];
    const singleTermProduct =
      a.filter(Boolean).length === 1 && b.filter(Boolean).length === 1;
    explanation = [
      singleTermProduct
        ? "Multiply the coefficients and add the exponents on x."
        : "Use the distributive property. In each term product, multiply coefficients and add exponents on powers of x.",
    ];
    for (let k = a.length - 1; k >= 0; k--) {
      if (!a[k]) continue;
      const term = Array<number>(k + 1).fill(0);
      term[k] = a[k]!;
      const partial = product(term, b);
      partials.push(partial);
      const termProducts: string[] = [];
      for (let j = b.length - 1; j >= 0; j--) {
        if (!b[j]) continue;
        const other = Array<number>(j + 1).fill(0);
        other[j] = b[j]!;
        const contribution = Array<number>(correct.length).fill(0);
        contribution[k + j] = a[k]! * b[j]!;
        termProducts.push(
          `(${format(term)})(${format(other)}) = ${format(contribution)}`,
        );
      }
      explanation.push(
        singleTermProduct
          ? `(${format(term)})(${format(b)}) = (${signed(a[k]!)} × ${signed(b.at(-1)!)})(${power(k)} × ${power(b.length - 1)}) = ${format(partial)}.`
          : `Products with ${format(term)}: ${termProducts.join("; ")}.`,
      );
      if (!singleTermProduct && termProducts.length > 1)
        explanation.push(`Add these term products: ${format(partial)}.`);
    }
    if (partials.length === 2) {
      explanation.push(
        `Add the partial products: (${format(partials[0]!)}) + (${format(partials[1]!)}).`,
      );
      explanation.push(
        ...combineSteps(partials[0]!, partials[1]!, "partial product"),
      );
    }
  } else {
    prompt = `Simplify (${format(a)}) ${subtract ? "−" : "+"} (${format(b)}).`;
    hint = subtract
      ? "Subtracting a polynomial means adding its opposite: change every sign in the second polynomial. Then combine like terms, which have the same power of x."
      : "Like terms have the same power of x. Add their coefficients, keep the power unchanged, and treat a missing term as having coefficient zero.";
    const signedB = b.map((c) => (subtract ? -c : c));
    explanation = [
      subtract
        ? `Distribute −1 to every term of the second polynomial: −(${format(b)}) = ${format(signedB)}.`
        : "Group like terms: terms with the same power of x. Add their coefficients without changing the power.",
    ];
    if (subtract)
      explanation.push(
        `Rewrite the difference as a sum: (${format(a)}) + (${format(signedB)}).`,
      );
    explanation.push(...combineSteps(a, signedB));
  }
  explanation.push(
    `${label === "0" ? "All terms cancel, so the" : "The"} ${multiply ? "product" : subtract ? "difference" : "sum"} is ${label}.`,
  );
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const response: GeneratedProblem["public"]["response"] = {
    kind: "choice",
    label: "Choose the simplified expression",
    options: shuffle([...group], r).map((item, i) => {
      const id = `option-${"abcd"[i]}`;
      if (item === selected) answer = id;
      else {
        const feedback: string[] = [];
        for (let k = correct.length - 1; k >= 0; k--) {
          if ((item.result[k] ?? 0) === correct[k]) continue;
          feedback.push(
            multiply
              ? k === 0
                ? "The constant term comes from multiplying the two constants."
                : `For the ${power(k)} term, include every term product whose exponents on x add to ${k}. Multiply the signed coefficients, then add the products.`
              : `For ${k ? `the ${power(k)} term` : "the constant term"}, calculate ${signed(a[k] ?? 0)} ${subtract ? "−" : "+"} ${signed(b[k] ?? 0)}.`,
          );
        }
        choiceFeedback[id] = feedback.join(" ");
      }
      return { id, label: format(item.result) };
    }),
  };
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      skillId: meta.skillId,
      prompt,
      response,
    },
    answer,
    hint,
    explanation,
    choiceFeedback,
  };
}
