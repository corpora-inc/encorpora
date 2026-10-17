import {
  algebraTemplates,
  generateAlgebraProblem,
} from "./algebra-practice.js";
import { choiceTemplates, generateChoiceProblem } from "./choice.js";
import {
  equalGroupsTemplates,
  generateEqualGroupsProblem,
} from "./equal-groups-practice.js";
import {
  fractionPracticeTemplates,
  generateFractionPracticeProblem,
} from "./fraction-practice";
import { elementaryTemplates, generateElementaryProblem } from "./elementary";
import { graphicalTemplates, generateGraphicalProblem } from "./graphical";
import { extendedTemplates, generateExtendedProblem } from "./extended";
import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  PublicProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
export type {
  GeneratedProblem,
  PublicProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";

export const baseTemplates: readonly TemplateMetadata[] = [
  {
    id: "count-objects",
    version: 1,
    title: "Count objects",
    skillId: "count-to-20",
    gradeBand: "K–2",
    description: "Count up to ten objects.",
  },
  {
    id: "add-within-20",
    version: 1,
    title: "Add within twenty",
    skillId: "addition-within-20",
    gradeBand: "K–2",
    description: "Add two nonnegative whole numbers with a sum at most twenty.",
  },
  {
    id: "subtract-within-20",
    version: 1,
    title: "Subtract within twenty",
    skillId: "subtraction-within-20",
    gradeBand: "K–2",
    description: "Subtract without a negative result.",
  },
  {
    id: "multiply-facts",
    version: 1,
    title: "Multiplication facts",
    skillId: "multiplication-facts",
    gradeBand: "3–5",
    description: "Multiply whole numbers from two through twelve.",
  },
  {
    id: "fraction-model",
    version: 1,
    title: "Read a fraction",
    skillId: "fraction-model",
    gradeBand: "3–5",
    description: "Express a shaded part of one whole as a fraction.",
  },
  {
    id: "add-fractions",
    version: 1,
    title: "Add fractions",
    skillId: "fraction-addition",
    gradeBand: "3–5",
    description:
      "Add two positive fractions with possibly different denominators.",
  },
  {
    id: "rectangle-area",
    version: 1,
    title: "Rectangle area",
    skillId: "rectangle-area",
    gradeBand: "3–5",
    description: "Find area from perpendicular side lengths.",
  },
  {
    id: "linear-equation",
    version: 1,
    title: "Solve a linear equation",
    skillId: "linear-equations",
    gradeBand: "6–8",
    description: "Solve an equation with an integer solution.",
  },
  {
    id: "mean-data",
    version: 1,
    title: "Mean of a dataset",
    skillId: "statistics-mean",
    gradeBand: "6–8",
    description: "Compute an exact mean of five observations.",
  },
  {
    id: "right-triangle",
    version: 1,
    title: "Pythagorean theorem",
    skillId: "pythagorean-theorem",
    gradeBand: "6–8",
    description: "Find a hypotenuse from a scaled integer right triangle.",
  },
  {
    id: "quadratic-vertex",
    version: 1,
    title: "Quadratic minimum",
    skillId: "quadratic-minimum",
    gradeBand: "9–12",
    description: "Find the minimum value of a quadratic in vertex form.",
  },
  {
    id: "geometric-sequence",
    version: 1,
    title: "Geometric sequences",
    skillId: "geometric-sequences",
    gradeBand: "9–12",
    description:
      "Find a term of a geometric sequence from its first term and ratio.",
  },
  {
    id: "logarithm-integer",
    version: 1,
    title: "Logarithms",
    skillId: "logarithms",
    gradeBand: "9–12",
    description:
      "Evaluate a logarithm whose argument is an integer power of its base.",
  },
];

export const templates: readonly TemplateMetadata[] = [
  ...baseTemplates,
  ...extendedTemplates,
  ...graphicalTemplates,
  ...elementaryTemplates,
  ...fractionPracticeTemplates,
  ...algebraTemplates,
  ...choiceTemplates,
  ...equalGroupsTemplates,
];

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}
function rational(n: bigint, d: bigint = 1n): string {
  if (!d) throw new Error("Zero denominator");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  return d === 1n ? `${n}` : `${n}/${d}`;
}
/** Bounded exact literals only: no expressions, exponents, infinity or float tolerance. */
export function normalizeAnswer(input: string): string | null {
  if (typeof input !== "string" || input.length > 100) return null;
  const s = input
    .trim()
    .replaceAll("−", "-")
    .replace(/^([+-]?)\./, "$10.");
  const f = /^([+-]?\d{1,18})\s*\/\s*([+-]?\d{1,18})$/.exec(s);
  if (f)
    return BigInt(f[2]!) === 0n ? null : rational(BigInt(f[1]!), BigInt(f[2]!));
  const m = /^([+-]?)(\d{1,18})(?:\.(\d{1,18}))?$/.exec(s);
  if (!m) return null;
  const decimals = m[3] ?? "";
  return rational(
    BigInt(`${m[1] === "-" ? "-" : ""}${m[2]}${decimals}`),
    10n ** BigInt(decimals.length),
  );
}
export function isValidResponse(
  problem: PublicProblem,
  response: string,
): boolean {
  return problem.response.kind === "choice"
    ? problem.response.options.some((option) => option.id === response)
    : normalizeAnswer(response) !== null;
}
export function gradeAnswer(
  problem: GeneratedProblem,
  response: string,
): boolean {
  if (problem.public.response.kind === "choice")
    return (
      isValidResponse(problem.public, response) && response === problem.answer
    );
  const answer = normalizeAnswer(response);
  return answer !== null && answer === normalizeAnswer(problem.answer);
}

/** SHA-256 counter stream gives stable values across Node versions, with unbiased bounded draws. */
function random(
  templateId: string,
  seed: string,
): (lo: number, hi: number) => number {
  let counter = 0;
  return (lo, hi) => {
    const range = hi - lo + 1;
    const ceiling = Math.floor(0x100000000 / range) * range;
    let n: number;
    do {
      n = createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (n >= ceiling);
    return lo + (n % range);
  };
}
export function generateProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (algebraTemplates.some((t) => t.id === templateId))
    return generateAlgebraProblem(templateId, seed);
  if (choiceTemplates.some((t) => t.id === templateId))
    return generateChoiceProblem(templateId, seed);
  if (equalGroupsTemplates.some((t) => t.id === templateId))
    return generateEqualGroupsProblem(templateId, seed);
  if (fractionPracticeTemplates.some((t) => t.id === templateId))
    return generateFractionPracticeProblem(templateId, seed);
  if (elementaryTemplates.some((t) => t.id === templateId))
    return generateElementaryProblem(templateId, seed);
  if (graphicalTemplates.some((t) => t.id === templateId))
    return generateGraphicalProblem(templateId, seed);
  if (extendedTemplates.some((t) => t.id === templateId))
    return generateExtendedProblem(templateId, seed);
  const meta = templates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = "",
    hint = "";
  let explanation: string[] = [];
  let figure: SemanticFigure | undefined;
  let kind: "number" | "fraction" = "number";
  switch (templateId) {
    case "count-objects": {
      const n = r(1, 10);
      figure = { kind: "collection", count: n };
      prompt = "How many dots are shown?";
      answer = `${n}`;
      hint = "Touch each dot once as you count.";
      explanation = [
        `Count each dot once: ${Array.from({ length: n }, (_, i) => i + 1).join(", ")}.`,
        `There are ${n} dots.`,
      ];
      break;
    }
    case "add-within-20": {
      const a = r(0, 19),
        b = r(0, 20 - a);
      prompt = `What is ${a} + ${b}?`;
      answer = `${a + b}`;
      hint = "Start at the first number and count on.";
      explanation = [
        `Start with ${a} and add ${b} more.`,
        `${a} + ${b} = ${answer}.`,
      ];
      break;
    }
    case "subtract-within-20": {
      const a = r(1, 20),
        b = r(0, a);
      prompt = `What is ${a} − ${b}?`;
      answer = `${a - b}`;
      hint = "Take the second number away from the first.";
      explanation = [
        `Start with ${a}. Remove ${b}.`,
        `${a} − ${b} = ${answer}.`,
      ];
      break;
    }
    case "multiply-facts": {
      const a = r(2, 12),
        b = r(2, 12);
      prompt = `What is ${a} × ${b}?`;
      answer = `${a * b}`;
      hint = "Think of equal groups.";
      explanation = [
        `There are ${a} groups of ${b}.`,
        `${Array(a).fill(b).join(" + ")} = ${answer}.`,
      ];
      break;
    }
    case "fraction-model": {
      const parts = r(2, 12),
        selected = r(1, parts - 1);
      figure = { kind: "fraction", selected, parts };
      kind = "fraction";
      prompt = "What fraction of the whole is shaded?";
      answer = rational(BigInt(selected), BigInt(parts));
      hint =
        "The denominator counts all equal parts. The numerator counts shaded parts.";
      explanation = [
        `${selected} of ${parts} equal parts are shaded.`,
        `The fraction is ${selected}/${parts}, equivalent to ${answer}.`,
      ];
      break;
    }
    case "add-fractions": {
      const b = r(2, 12),
        d = r(2, 12),
        a = r(1, b - 1),
        c = r(1, d - 1);
      prompt = `What is ${a}/${b} + ${c}/${d}?`;
      kind = "fraction";
      answer = rational(BigInt(a * d + c * b), BigInt(b * d));
      hint = "Express both fractions with a common denominator before adding.";
      explanation = [
        `A common denominator is ${b * d}.`,
        `${a}/${b} = ${a * d}/${b * d} and ${c}/${d} = ${c * b}/${b * d}.`,
        `Add the numerators: ${a * d + c * b}/${b * d} = ${answer}.`,
      ];
      break;
    }
    case "rectangle-area": {
      const width = r(2, 15),
        height = r(2, 15);
      figure = { kind: "rectangle", width, height, unit: "cm" };
      prompt = `A rectangle is ${width} cm wide and ${height} cm high. What is its area in square centimeters?`;
      answer = `${width * height}`;
      hint = "Area is width multiplied by height.";
      explanation = [
        "Each row contains one square centimeter per centimeter of width.",
        `${width} × ${height} = ${answer} square centimeters.`,
      ];
      break;
    }
    case "linear-equation": {
      const a = r(2, 12),
        b = r(1, 20),
        x = r(-12, 12),
        c = a * x + b;
      prompt = `Solve for x: ${a}x + ${b} = ${c}.`;
      answer = `${x}`;
      hint =
        "Subtract the constant from both sides, then divide by the coefficient of x.";
      explanation = [
        `Subtract ${b}: ${a}x = ${c - b}.`,
        `Divide by ${a}: x = ${answer}.`,
      ];
      break;
    }
    case "mean-data": {
      const values = Array.from({ length: 5 }, () => r(1, 30));
      const sum = values.reduce((a, b) => a + b, 0);
      figure = { kind: "dataset", values };
      prompt = `What is the mean of ${values.join(", ")}?`;
      answer = rational(BigInt(sum), 5n);
      kind = "fraction";
      hint = "Add all observations, then divide by the number of observations.";
      explanation = [
        `The sum is ${values.join(" + ")} = ${sum}.`,
        `Divide by five: ${sum}/5 = ${answer}.`,
      ];
      break;
    }
    case "right-triangle": {
      const scale = r(1, 6),
        triple = r(0, 1) ? [3, 4, 5] : [5, 12, 13];
      const a = triple[0]! * scale,
        b = triple[1]! * scale,
        c = triple[2]! * scale;
      figure = { kind: "right-triangle", a, b, unit: "cm" };
      prompt = `A right triangle has perpendicular legs ${a} cm and ${b} cm. What is the hypotenuse length in centimeters?`;
      answer = `${c}`;
      hint = "For a right triangle, a² + b² = c², where c is the hypotenuse.";
      explanation = [
        `c² = ${a}² + ${b}² = ${a * a + b * b}.`,
        `Take the positive square root: c = ${c} cm.`,
      ];
      break;
    }
    case "quadratic-vertex": {
      const a = r(1, 5),
        h = r(1, 12),
        k = r(1, 20);
      prompt = `For real x, what is the minimum value of f(x) = ${a}(x − ${h})² + ${k}?`;
      answer = `${k}`;
      hint = "A square is nonnegative and becomes zero at its vertex.";
      explanation = [
        `${a}(x − ${h})² is at least zero because ${a} is positive.`,
        `At x = ${h}, it equals zero, so the minimum is ${k}.`,
      ];
      break;
    }
    case "geometric-sequence": {
      const a = r(1, 9),
        ratio = r(2, 4),
        n = r(3, 7);
      prompt = `A geometric sequence has first term ${a} and common ratio ${ratio}. What is term ${n} (the first term is term 1)?`;
      answer = `${BigInt(a) * BigInt(ratio) ** BigInt(n - 1)}`;
      hint =
        "Multiply the first term by the common ratio once for each step after term 1.";
      explanation = [
        `Term n = first term × ratio^(n − 1).`,
        `Term ${n} = ${a} × ${ratio}^${n - 1} = ${answer}.`,
      ];
      break;
    }
    case "logarithm-integer": {
      const base = r(2, 5),
        power = r(2, 5),
        argument = base ** power;
      prompt = `What is log base ${base} of ${argument}?`;
      answer = `${power}`;
      hint =
        "A logarithm asks which exponent produces the argument from the base.";
      explanation = [
        `Find p such that ${base}^p = ${argument}.`,
        `${base}^${power} = ${argument}, so the logarithm is ${power}.`,
      ];
      break;
    }
    default:
      throw new Error("Template has no generator");
  }
  const id = createHash("sha256")
    .update(JSON.stringify([templateId, meta.version, seed]))
    .digest("hex");
  const publicProblem: PublicProblem = {
    id,
    templateId,
    templateVersion: 1,
    seed,
    prompt,
    skillId: meta.skillId,
    response: {
      kind,
      label:
        kind === "fraction"
          ? "Answer (fraction, decimal, or whole number)"
          : "Answer",
    },
    ...(figure ? { figure } : {}),
  };
  return { public: publicProblem, answer, explanation, hint };
}
