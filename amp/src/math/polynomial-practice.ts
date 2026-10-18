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
function combineSteps(a: Polynomial, b: Polynomial): string[] {
  const steps: string[] = [];
  for (let k = Math.max(a.length, b.length) - 1; k >= 0; k--) {
    const c = a[k] ?? 0,
      d = b[k] ?? 0;
    if (!c || !d) continue;
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

export function generatePolynomialProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = polynomialTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown polynomial template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const nz = (max: number) => r(1, max) * (r(0, 1) ? 1 : -1);
  const make = (degree: number, max: number): Polynomial =>
    Array.from({ length: degree + 1 }, (_, k) =>
      k === degree ? nz(max) : r(-max, max),
    );
  const multiply = templateId === "polynomial-multiplication";
  const subtract = templateId === "polynomial-subtraction";
  const a = make(multiply ? 1 : r(1, 3), multiply ? 4 : 8);
  let b = make(multiply ? r(1, 2) : r(1, 3), multiply ? 4 : 8);
  const variant = r(0, 5);
  if (multiply && variant === 0) b = [...a];
  if (multiply && variant === 1) b = [-a[0]!, a[1]!];
  if (!multiply && variant === 0) b = a.map((c) => (subtract ? c : -c));
  if (!multiply && variant === 1) {
    b = [...a];
    b[0]! += nz(3);
  }
  const correct = multiply ? product(a, b) : combine(a, b, subtract ? -1 : 1);
  const label = format(correct);
  let prompt: string, hint: string, explanation: string[];
  const candidates: { value: Polynomial; feedback: string }[] = [];
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
      explanation.push(
        singleTermProduct
          ? `(${format(term)})(${format(b)}) = (${signed(a[k]!)} × ${signed(b.at(-1)!)})(${power(k)} × ${power(b.length - 1)}) = ${format(partial)}.`
          : `Distribute ${format(term)}: (${format(term)})(${format(b)}) = ${format(partial)}.`,
      );
    }
    if (partials.length === 2) {
      explanation.push(
        `Add the partial products: (${format(partials[0]!)}) + (${format(partials[1]!)}).`,
      );
      explanation.push(...combineSteps(partials[0]!, partials[1]!));
    }
    candidates.push({
      value: partials[0]!,
      feedback:
        "Distribute every nonzero term of the first factor, then add the partial products.",
    });
    const ends = Array<number>(correct.length).fill(0);
    ends[0] = a[0]! * b[0]!;
    ends[ends.length - 1] = a.at(-1)! * b.at(-1)!;
    candidates.push({
      value: ends,
      feedback:
        "Multiplying only the first and last terms omits products. Distribute every term to every term.",
    });
    candidates.push({
      value: combine(a, b),
      feedback:
        "These factors are multiplied. Distribute each term; adding corresponding coefficients computes a sum.",
    });
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
    candidates.push({
      value: combine(a, b, subtract ? 1 : -1),
      feedback: subtract
        ? "The subtraction sign changes every sign in the second polynomial before like terms are combined."
        : "The polynomials are added. Keep each coefficient's sign and add coefficients of like terms.",
    });
    if (subtract) {
      const partialSign = [...b];
      partialSign[partialSign.length - 1]! *= -1;
      candidates.push({
        value: combine(a, partialSign),
        feedback:
          "A minus sign before parentheses negates every term inside, not just the leading term.",
      });
    }
  }
  explanation.push(
    `${label === "0" ? "All terms cancel, so the" : "The"} ${multiply ? "product" : subtract ? "difference" : "sum"} is ${label}.`,
  );
  // Single-coefficient variations require comparing complete expressions.
  for (let k = correct.length - 1; k >= 0; k--) {
    for (const change of [1, -1, 2]) {
      const wrong = [...correct];
      wrong[k]! += change;
      candidates.push({
        value: wrong,
        feedback: `${k ? `Check the coefficient of ${power(k)}` : "Check the constant term"}. ${multiply ? "Include every product contributing to that power." : "Combine only like terms, keeping their signs."}`,
      });
    }
  }
  const options = [{ label, feedback: "" }];
  for (const candidate of candidates) {
    const candidateLabel = format(candidate.value);
    if (!options.some((o) => o.label === candidateLabel))
      options.push({ label: candidateLabel, feedback: candidate.feedback });
    if (options.length === 4) break;
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = r(0, i);
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const response: GeneratedProblem["public"]["response"] = {
    kind: "choice",
    label: "Choose the simplified expression",
    options: options.map((option, i) => {
      const id = `option-${"abcd"[i]}`;
      if (option.label === label) answer = id;
      else choiceFeedback[id] = option.feedback;
      return { id, label: option.label };
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
