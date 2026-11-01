import type { TemplateMetadata } from "./contracts";
import { assemble, random } from "./distribution-practice";

export const complexMultiplicationTemplate: TemplateMetadata = {
  id: "complex-multiplication",
  version: 1,
  title: "Multiply complex numbers",
  skillId: "complex-numbers",
  gradeBand: "9–12",
  difficultyOffset: 0.35,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Multiply two small integer-coefficient complex numbers and select the exact product in simplified standard form.",
};

type Complex = { real: number; imaginary: number };
const fullForm = ({ real, imaginary }: Complex) =>
  `${real} ${imaginary < 0 ? "-" : "+"} ${Math.abs(imaginary)}i`;
function simpleForm({ real, imaginary }: Complex): string {
  if (imaginary === 0) return `${real}`;
  const magnitude = Math.abs(imaginary) === 1 ? "" : Math.abs(imaginary);
  if (real === 0) return `${imaginary < 0 ? "-" : ""}${magnitude}i`;
  return `${real} ${imaginary < 0 ? "-" : "+"} ${magnitude}i`;
}
const label = (value: Complex) => `$${simpleForm(value)}$`;

/** Private exact model; only the prompt and shuffled choices reach the learner. */
export function complexMultiplicationCase(seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = complexMultiplicationTemplate;
  const r = random(meta.id, seed);
  const nonzero = () => r(1, 5) * (r(0, 1) ? 1 : -1);
  // General products dominate; special cases keep the edges visible.
  const variant = r(0, 9);
  let a = nonzero();
  let b = nonzero();
  let c = nonzero();
  let d = nonzero();
  if (variant === 0) a = 0; // One purely imaginary factor.
  if (variant === 1) c = 0;
  if (variant === 2) {
    c = a;
    d = -b; // Cross terms cancel.
  }
  if (variant === 3) {
    b = a;
    d = c; // Real terms cancel.
  }
  const ac = a * c;
  const ad = a * d;
  const bc = b * c;
  const bd = b * d;
  const correct = { real: ac - bd, imaginary: ad + bc };
  const alternatives: { value: Complex; feedback: string }[] = [
    {
      value: { real: ac + bd, imaginary: ad + bc },
      feedback:
        "This treats $i^2$ as $+1$. In fact $i^2=-1$, so the product of the two $i$ terms is subtracted from the real part.",
    },
    {
      value: { real: ac - bd, imaginary: ad - bc },
      feedback:
        "This subtracts one cross product. The $i$ part is the sum of both cross products, each with its own sign.",
    },
    {
      value: { real: ac, imaginary: ad + bc },
      feedback:
        "This drops the product of the two $i$ terms. It does not vanish: it becomes a real number, because $i^2=-1$.",
    },
    {
      value: { real: ac - bd, imaginary: ad },
      feedback:
        "This misses a cross product: the $i$ term of the first factor must also multiply the real term of the second.",
    },
    {
      value: { real: ac - bd, imaginary: bc },
      feedback:
        "This misses a cross product: the real term of the first factor must also multiply the $i$ term of the second.",
    },
  ];
  const key = ({ real, imaginary }: Complex) => `${real},${imaginary}`;
  const seen = new Set([key(correct)]);
  const wrong = alternatives.filter(({ value }) => {
    const candidate = key(value);
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
  if (wrong.length < 3)
    throw new Error("Insufficient distinct complex choices");
  const first = fullForm({ real: a, imaginary: b });
  const second = fullForm({ real: c, imaginary: d });
  return {
    a,
    b,
    c,
    d,
    variant,
    product: correct,
    problem: assemble(meta, seed, r, {
      prompt: `Multiply $(${first})(${second})$ using $i^2=-1$. Choose the exact product.`,
      answer: "",
      hint: `For $(${first})(${second})$, multiply each term in the first parentheses by each term in the second. Keep the $i^2$ term until you use $i^2=-1$.`,
      explanation: [
        `A complex number has a real part and an imaginary part, a multiple of $i$. The number $i$ is defined by $i^2=-1$.`,
        `Multiply like two binomials: each term of the first factor times each term of the second. That gives four products.`,
        `Multiply the real terms: $(${a})(${c})=${ac}$.`,
        `Multiply the cross terms: $(${a})(${d}i)=${ad}i$ and $(${b}i)(${c})=${bc}i$.`,
        `Multiply the imaginary terms: $(${b}i)(${d}i)=${bd}i^2=${-bd}$ because $i^2=-1$.`,
        `Add the real numbers: $${ac}+(${-bd})=${correct.real}$. Add the $i$ terms: $${ad}i+(${bc}i)=${correct.imaginary}i$.`,
        `The exact product is ${label(correct)}.`,
      ],
      choices: [
        { label: label(correct), correct: true },
        ...wrong.slice(0, 3).map(({ value, feedback }) => ({
          label: label(value),
          feedback,
        })),
      ],
    }),
  };
}
