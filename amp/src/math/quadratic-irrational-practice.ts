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
      feedback: `This uses $b$ instead of $-b$, a sign error. The formula starts with the opposite of $b = ${b}$.`,
    },
    {
      roots: reduced(roots.p, roots.q * 2, s, roots.d),
      feedback: `The number outside the root is doubled, so this changes the value of $\\sqrt{${D}}$. When you pull out a square factor, only its square root comes outside.`,
    },
    {
      roots: reduced(roots.p, roots.q, s, roots.d * 2),
      feedback: `The bottom is doubled, as if $2a$ were divided by 2 only in part or applied twice. The whole top is divided by $2a = ${2 * a}$, once.`,
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
        `Read the coefficients, the numbers in front of each term, with their signs. In $ax^2 + bx + c = 0$: $a = ${a}$, $b = ${b}$, and $c = ${c}$.`,
        `The discriminant $D$ is the part under the square root in the quadratic formula: $D = b^2 - 4ac$.`,
        `$D = (${b})^2 - 4(${a})(${c}) = ${b * b} - (${4 * a * c}) = ${D}$. It is positive, so there are two real solutions.`,
        `${D} is not a perfect square (a whole number times itself), so its root is irrational: a decimal that never ends or repeats. Keep it exact as a root.`,
        `The quadratic formula is $x = \\frac{-b \\pm \\sqrt{D}}{2a}$. The sign $\\pm$ means "plus or minus", one solution each. Here $x = \\frac{${-b} \\pm \\sqrt{${D}}}{${2 * a}}$.`,
        q === 1
          ? `Simplified radical form pulls any square factor out of the root. ${D} has no square factor greater than 1, so $\\sqrt{${D}}$ stays as it is.`
          : `Simplified radical form pulls any square factor out of the root. $${D} = ${q * q} \\cdot ${s}$, and $\\sqrt{${q * q}} = ${q}$, so $\\sqrt{${D}} = ${q}\\sqrt{${s}}$.`,
        `Divide out only a factor shared by every part of the top and the bottom, and keep the bottom positive.`,
        `Check: the two solutions should add to $-\\frac{b}{a} = \\frac{${-b}}{${a}}$ and multiply to $\\frac{c}{a} = \\frac{${c}}{${a}}$. They do.`,
        `The complete set of real solutions is $x = ${result}$.`,
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
