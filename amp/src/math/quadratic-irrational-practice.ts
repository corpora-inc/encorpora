import type { TemplateMetadata } from "./contracts";
import { assemble, random } from "./distribution-practice";

export const quadraticIrrationalTemplate: TemplateMetadata = {
  id: "quadratic-irrational-solutions",
  version: 1,
  title: "Exact irrational quadratic solutions",
  skillId: "quadratic-formula",
  gradeBand: "9–12",
  difficultyOffset: 0.5,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Use the quadratic formula to recognize both irrational real roots in simplified radical form, including signed nonmonic coefficients.",
};
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
type Pair = { p: number; q: number; s: number; d: number };
function reduced(p: number, q: number, s: number, d: number): Pair {
  if (d < 0) {
    p = -p;
    d = -d;
  }
  const common = gcd(p, gcd(q, d));
  return { p: p / common, q: q / common, s, d: d / common };
}
function pairTex({ p, q, s, d }: Pair): string {
  const numerator = `${p} \\pm ${q === 1 ? "" : q}\\sqrt{${s}}`;
  return d === 1 ? numerator : `\\frac{${numerator}}{${d}}`;
}
function polynomial(a: number, b: number, c: number) {
  const lead = a === 1 ? "" : a === -1 ? "-" : `${a}`;
  return `${lead}x^2 ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}x ${c < 0 ? "-" : "+"} ${Math.abs(c)}`;
}
/** Private exact model; public choices carry no answer marker. */
export function quadraticIrrationalCase(seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = quadraticIrrationalTemplate,
    r = random(meta.id, seed);
  const nonzero = (max: number) => r(1, max) * (r(0, 1) ? 1 : -1);
  let a: number, b: number, c: number, D: number;
  do {
    a = nonzero(6);
    b = nonzero(12);
    c = nonzero(12);
    D = b * b - 4 * a * c;
  } while (D <= 0 || Number.isInteger(Math.sqrt(D)));
  let q = 1;
  for (let factor = 2; factor * factor <= D; factor++)
    if (D % (factor * factor) === 0) q = factor;
  const s = D / (q * q),
    roots = reduced(-b, q, s, 2 * a);
  const result = pairTex(roots);
  const wrong = [
    {
      roots: reduced(-roots.p, roots.q, s, roots.d),
      feedback: `Use the opposite of the signed coefficient $b = ${b}$ in the numerator. The numerator begins with $-b$.`,
    },
    {
      roots: reduced(roots.p, roots.q * 2, s, roots.d),
      feedback: `Extract square factors without changing the value of $\\sqrt{${D}}$. Check the coefficient outside the radical.`,
    },
    {
      roots: reduced(roots.p, roots.q, s, roots.d * 2),
      feedback: `The quadratic formula divides the entire numerator by $2a = ${2 * a}$. Reducing the result must preserve that fraction's value.`,
    },
  ];
  const equation = polynomial(a, b, c);
  return {
    a,
    b,
    c,
    D,
    roots,
    problem: assemble(meta, seed, r, {
      prompt: `Solve $${equation} = 0$. Choose the complete set of real solutions in exact simplified radical form.`,
      answer: "",
      hint: `For $${equation} = 0$, first record $a = ${a}$, $b = ${b}$, and $c = ${c}$ with their signs. Substitute them into $b^2 - 4ac$ before taking a square root.`,
      explanation: [
        `In $ax^2 + bx + c = 0$, the signed coefficients are $a = ${a}$, $b = ${b}$, and $c = ${c}$.`,
        `The discriminant is $D = (${b})^2 - 4(${a})(${c}) = ${b * b} - (${4 * a * c}) = ${D}$. It is positive and not a perfect square, so there are two distinct irrational real solutions.`,
        `Apply the formula: $x = \\frac{-b \\pm \\sqrt{D}}{2a} = \\frac{${-b} \\pm \\sqrt{${D}}}{${2 * a}}$. The symbol $\\pm$ means use both plus and minus.`,
        q === 1
          ? `$\\sqrt{${D}}$ has no square factor greater than 1 to extract.`
          : `Since $${D} = ${q * q} \\cdot ${s}$, $\\sqrt{${D}} = ${q}\\sqrt{${s}}$.`,
        `Keep both solutions, make the denominator positive, and cancel only factors common to the entire numerator and denominator: $x = ${result}$.`,
        `Check the pair: its sum is $-b/a = \\frac{${-b}}{${a}}$ and its product is $c/a = \\frac{${c}}{${a}}$, as required by the original quadratic.`,
      ],
      choices: [
        { label: `$x = ${result}$`, correct: true },
        ...wrong.map(({ roots, feedback }) => ({
          label: `$x = ${pairTex(roots)}$`,
          feedback,
        })),
      ],
    }),
  };
}
