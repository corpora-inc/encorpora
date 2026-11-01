import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  constText,
  linearText,
  n,
  pick,
  seeded,
  termText,
} from "./algebra-one-kit";

export const rationalExpressionTemplates: readonly TemplateMetadata[] = [
  {
    id: "rational-expression-domain",
    title: "Find excluded inputs",
    skillId: "rational-expression-domain",
    difficultyOffset: 0.5,
    description:
      "Find the excluded inputs of a fraction with a factored denominator, including repeated and cancelled factors.",
  },
  {
    id: "rational-expression-simplify",
    title: "Simplify and keep the exclusions",
    skillId: "rational-expressions",
    difficultyOffset: -0.5,
    description:
      "Factor two quadratics, divide out one common linear factor, and retain the original excluded inputs.",
  },
].map((t) => ({
  ...t,
  version: 1,
  gradeBand: "9–12",
  requiredResponseCapability: "single-choice-v1",
}));

const roots = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
const setText = (values: number[]) =>
  `$\\left\\{${unique(values).map(n).join(", ")}\\right\\}$`;
const polynomial = (a: number, b: number, c: number) =>
  `${termText(a, "x^2")}${termText(b, "x", false)}${constText(c)}`;
const factor = (root: number) => `(${linearText(1, -root)})`;
const quotient = (num: string, den: string) => `$\\dfrac{${num}}{${den}}$`;
const option = (num: string, den: string, excluded: number[]) =>
  `${quotient(num, den)}; excluded values: ${setText(excluded)}`;

export function rationalExpressionCase(id: string, seed: string) {
  const meta = rationalExpressionTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown rational-expression template");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed),
    domain = id === "rational-expression-domain";
  const cancelled = pick(r, roots);
  const pole =
    domain && r(0, 3) === 0
      ? cancelled
      : pick(
          r,
          roots.filter((v) => v !== cancelled),
        );
  const zero = domain
    ? pick(r, roots)
    : pick(
        r,
        roots.filter((v) => v !== cancelled && v !== pole),
      );
  const excluded = unique([cancelled, pole]);
  const a = domain ? 1 : pick(r, [-2, -1, 1, 2, 3]);
  const numerator = domain
    ? linearText(1, -zero)
    : polynomial(a, -a * (cancelled + zero), a * cancelled * zero);
  const denominator = domain
    ? `${factor(cancelled)}${factor(pole)}`
    : polynomial(1, -cancelled - pole, cancelled * pole);
  const original = quotient(numerator, denominator);
  const factoredNumerator = `${a === 1 ? "" : n(a)}${factor(cancelled)}${factor(zero)}`;
  const factoredDenominator = `${factor(cancelled)}${factor(pole)}`;
  const simplifiedNum = linearText(a, -a * zero),
    simplifiedDen = linearText(1, -pole);
  const tags = [
    domain ? "domain" : "simplify",
    excluded.length === 1 ? "repeated-root" : "distinct-roots",
    excluded.includes(0) ? "zero-excluded" : "nonzero-exclusions",
    a < 0 ? "negative-scale" : "positive-scale",
  ];
  const falseSets: number[][] = [];
  for (const candidate of [
    [cancelled],
    [pole],
    [zero],
    [cancelled, pole, zero],
    [cancelled + 1, pole + 1],
    [cancelled + 7],
    [cancelled, pole, cancelled + 7],
  ]) {
    const values = unique(candidate);
    if (
      setText(values) !== setText(excluded) &&
      !falseSets.some((v) => setText(v) === setText(values))
    )
      falseSets.push(values);
  }
  if (falseSets.length < 3)
    throw new Error("Not enough distinct excluded-value distractors");
  const choices = domain
    ? [
        {
          label: setText(excluded),
          correct: true as const,
        },
        ...falseSets.slice(0, 3).map((values) => ({
          label: setText(values),
          feedback:
            values.length === 1 &&
            values[0] === zero &&
            !excluded.includes(zero)
              ? `This uses the numerator. A zero numerator just makes the value 0, which is allowed. Excluded values come from the denominator only.`
              : values.length > excluded.length && values.includes(zero)
                ? `This also excludes where the numerator is 0. That is allowed: only a zero denominator makes the expression undefined.`
                : `This misses or misplaces a zero of the denominator. Set each denominator factor equal to 0, even a factor that cancels.`,
        })),
      ]
    : [
        {
          label: option(simplifiedNum, simplifiedDen, excluded),
          correct: true as const,
        },
        {
          label: option(simplifiedNum, simplifiedDen, [pole]),
          feedback: `This forgets the value from the cancelled factor. The original denominator is 0 at $x = ${n(cancelled)}$, so it stays excluded after cancelling.`,
        },
        {
          label: option(
            linearText(a, -a * (zero + 1)),
            simplifiedDen,
            excluded,
          ),
          feedback: `This has a factoring slip in the numerator. Factoring it gives $${factoredNumerator}$. Then divide out only the shared factor $${factor(cancelled)}$.`,
        },
        {
          label: option(simplifiedDen, simplifiedNum, [cancelled, pole, zero]),
          feedback:
            "This flips the fraction upside down. Dividing out a common factor leaves the rest of the fraction the right way up. Also, a zero numerator is allowed when the denominator is not zero.",
        },
      ];
  return assemble(
    meta,
    seed,
    {
      prompt: domain
        ? `For the expression ${original}, which real values of $x$ are excluded from its domain?`
        : `Simplify ${original} and retain every exclusion from the original expression.`,
      choices,
      explanation: domain
        ? [
            `The domain is every $x$ the expression can use. Dividing by 0 is undefined, so the denominator, the bottom $${denominator}$, cannot be 0.`,
            `A product is 0 when either factor is 0. $${factor(cancelled)}$ is 0 at $x = ${n(cancelled)}$, and $${factor(pole)}$ is 0 at $x = ${n(pole)}$.`,
            excluded.length === 1
              ? `Both factors give the same value, so it is listed once.`
              : `Both values make the bottom 0, so both are excluded.`,
            `The numerator, the top, can be 0: that only makes the value 0. So it adds no excluded values.`,
            `The excluded values are ${setText(excluded)}.`,
          ]
        : [
            `Factor the top and the bottom, writing each as a product: ${original} becomes ${quotient(factoredNumerator, factoredDenominator)}.`,
            `Dividing by 0 is undefined. The original bottom is 0 at $x = ${n(cancelled)}$ and $x = ${n(pole)}$, so exclude ${setText(excluded)} before simplifying.`,
            `$${factor(cancelled)}$ is a factor of both the top and the bottom. For allowed inputs it is not 0, so dividing both by it keeps the value the same: ${quotient(simplifiedNum, simplifiedDen)}.`,
            `Cancelling does not make $x = ${n(cancelled)}$ allowed again. The original expression was undefined there, so it stays excluded.`,
            `The simplified form is ${option(simplifiedNum, simplifiedDen, excluded)}.`,
          ],
      hint: domain
        ? `Start with the denominator $${denominator}$. Set each of its factors equal to 0; the numerator $${numerator}$ does not determine the excluded inputs.`
        : `Factor $${numerator}$ and $${denominator}$ before dividing out a common factor. Keep a record of which inputs make the original denominator 0.`,
      tags,
    },
    r,
    domain ? "Excluded inputs" : "Equivalent expression and excluded inputs",
  );
}
export function generateRationalExpressionProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return rationalExpressionCase(id, seed).problem;
}
