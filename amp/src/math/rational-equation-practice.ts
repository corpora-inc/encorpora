import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  linearText,
  n,
  nonzero,
  rat,
  seeded,
  type Rational,
} from "./algebra-one-kit";

export const rationalEquationTemplates: readonly TemplateMetadata[] = [
  {
    id: "rational-equation-one-denominator",
    title: "Solve with one variable denominator",
    skillId: "rational-equation-one-denominator",
    difficultyOffset: -0.5,
    description:
      "Clear one linear denominator and construct an exact rational solution.",
  },
  {
    id: "rational-equation-check",
    title: "Check the original domain",
    skillId: "rational-equations",
    difficultyOffset: 0.25,
    requiredResponseCapability: "single-choice-v1" as const,
    description:
      "Distinguish a valid solution, an excluded candidate, a contradiction and an identity on the original domain.",
  },
].map((t) => ({ ...t, version: 1, gradeBand: "9–12" }));

const tex = (q: Rational) =>
  q.d === 1 ? n(q.n) : `${q.n < 0 ? "−" : ""}\\frac{${Math.abs(q.n)}}{${q.d}}`;

export function rationalEquationCase(id: string, seed: string) {
  const meta = rationalEquationTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown rational-equation template");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed),
    h = r(-6, 6),
    c = nonzero(r, -5, 5);
  const den = linearText(1, -h);
  if (id === "rational-equation-one-denominator") {
    const a = nonzero(r, -9, 9),
      answer = rat(h * c + a, c);
    return assemble(
      meta,
      seed,
      {
        prompt: `Solve $\\dfrac{${n(a)}}{${den}} = ${n(c)}$ for $x$.`,
        answer,
        hint: `Start with the denominator $${den}$ in $\\dfrac{${n(a)}}{${den}} = ${n(c)}$. Record where it is zero, then multiply both sides by that denominator on the allowed domain.`,
        explanation: [
          `The denominator is the bottom of the fraction, $${den}$. Dividing by zero is undefined, so $${den}$ cannot be 0. That rules out $x = ${n(h)}$.`,
          `To clear the fraction, multiply both sides by $${den}$: $${n(a)} = ${n(c)}(${den})$.`,
          `Divide both sides by ${n(c)}: $${den} = ${tex(rat(a, c))}$.`,
          `${h === 0 ? "So" : `${h > 0 ? "Add" : "Subtract"} ${Math.abs(h)} ${h > 0 ? "to" : "from"} both sides:`} $x = ${tex(answer)}$.`,
          `Check: the denominator is then $${tex(rat(a, c))}$, not 0. And $${n(a)} \\div \\left(${tex(rat(a, c))}\\right) = ${n(c)}$, as required.`,
          `The solution is $x = ${tex(answer)}$.`,
        ],
        tags: [
          "one-denominator",
          answer.d === 1 ? "integer-answer" : "fraction-answer",
          c < 0 ? "negative-right-side" : "positive-right-side",
        ],
      },
      r,
      "x",
      "fraction",
    );
  }
  const mode = r(0, 3);
  const coefficient = mode < 2 ? nonzero(r, -4, 4) : 0;
  let constant =
    mode === 1 ? coefficient * h : mode === 3 ? nonzero(r, -8, 8) : 0;
  if (mode === 0)
    do {
      constant = r(-8, 8);
    } while (constant === coefficient * h);
  const a = c + coefficient,
    b = -c * h - constant;
  const answer = mode === 0 ? rat(constant, coefficient) : rat(h + 1);
  const num = linearText(a, b),
    reduced = `$${linearText(coefficient, 0)} = ${n(constant)}$`;
  const outcome =
    mode === 0
      ? `This gives $x = ${tex(answer)}$, which differs from the excluded input ${n(h)}. It is the unique solution of the original equation.`
      : mode === 1
        ? `The reduced equation gives $x = ${n(h)}$. This makes the original denominator zero, so discard it. There are no real solutions.`
        : mode === 2
          ? `The reduced equation is $0 = 0$, true for every input. Keep the original restriction: every real number except ${n(h)} is a solution.`
          : `The reduced equation is $0 = ${n(constant)}$, which is false. There are no real solutions.`;
  const labels = [
    `$x = ${tex(answer)}$`,
    `$x = ${n(h)}$`,
    "There are no real solutions.",
    `Every real number with $x \\ne ${n(h)}$ is a solution.`,
  ];
  const correct = mode === 0 ? 0 : mode === 2 ? 3 : 2;
  return assemble(
    meta,
    seed,
    {
      prompt: `Solve $\\dfrac{${num}}{${den}} = ${n(c)}$ over the real numbers. Which statement describes all solutions?`,
      choices: labels.map((label, i) => ({
        label,
        ...(i === correct
          ? { correct: true as const }
          : {
              feedback:
                i === 1
                  ? `This picks the value that makes the denominator $${den}$ zero. Dividing by zero is undefined, so $x = ${n(h)}$ can never be a solution.`
                  : `This misreads the equation after clearing the fraction. For $x \\ne ${n(h)}$, multiplying by $${den}$ gives ${reduced}. ${outcome}`,
            }),
      })),
      hint: `In $\\dfrac{${num}}{${den}} = ${n(c)}$, first exclude the zero of $${den}$. Multiply both sides by $${den}$ only for allowed inputs; keep that restriction when interpreting the result.`,
      explanation: [
        `The denominator is the bottom of the fraction, $${den}$. Dividing by zero is undefined, so $x = ${n(h)}$ is not allowed. The allowed inputs are the domain.`,
        `To clear the fraction, multiply both sides by $${den}$: $${num} = ${n(c)}(${den})$.`,
        `Multiply out the right side. Collect the $x$ terms on the left and the numbers on the right. This gives ${reduced}.`,
        outcome,
      ],
      tags: [
        ["unique", "excluded-candidate", "identity-on-domain", "contradiction"][
          mode
        ]!,
        answer.d === 1 ? "integer-candidate" : "fraction-candidate",
      ],
    },
    r,
    "Solution set",
  );
}

export function generateRationalEquationProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return rationalEquationCase(id, seed).problem;
}
