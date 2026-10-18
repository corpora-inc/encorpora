import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

type Rational = { n: number; d: number };
type Relation = "<" | "≤" | ">" | "≥";
type Random = (lo: number, hi: number) => number;
const relations: Relation[] = ["<", "≤", ">", "≥"];
const reverse: Record<Relation, Relation> = {
  "<": ">",
  "≤": "≥",
  ">": "<",
  "≥": "≤",
};
function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
}
function q(n: number, d = 1): Rational {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Expected a finite exact rational");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const add = (a: Rational, b: Rational) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const neg = (a: Rational) => q(-a.n, a.d);
const sub = (a: Rational, b: Rational) => add(a, neg(b));
const mul = (a: Rational, b: Rational) => q(a.n * b.n, a.d * b.d);
const equal = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;
const number = (a: Rational): string =>
  `${a.n < 0 ? "−" : ""}${Math.abs(a.n)}${a.d === 1 ? "" : `/${a.d}`}`;
const operand = (a: Rational): string =>
  a.n < 0 ? `(${number(a)})` : number(a);
function term(a: Rational): string {
  if (a.n === 0) return "0";
  if (a.d === 1) return a.n === 1 ? "x" : a.n === -1 ? "−x" : `${number(a)}x`;
  return `${number(a)} × x`;
}
function constant(b: Rational): string {
  return b.n === 0
    ? ""
    : ` ${b.n < 0 ? "−" : "+"} ${number(q(Math.abs(b.n), b.d))}`;
}
function linear(a: Rational, b: Rational): string {
  return a.n === 0 ? number(b) : term(a) + constant(b);
}
function random(id: string, seed: string): Random {
  let counter = 0;
  return (lo, hi) => {
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
function shuffle<T>(items: T[], r: Random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = r(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
const nz = (r: Random, max: number) => r(1, max) * (r(0, 1) ? 1 : -1);
/** Both candidate boundaries have the same sampling role; neither is generated as an afterthought distractor. */
function boundaries(r: Random): [Rational, Rational] {
  if (r(0, 3) === 0) return [q(0), q(nz(r, 12))];
  const d = r(1, 6);
  const numerators = Array.from({ length: 25 }, (_, i) => i - 12).filter(
    (n) => gcd(n, d) === 1,
  );
  const first = r(0, numerators.length - 1);
  let second = r(0, numerators.length - 2);
  if (second >= first) second++;
  return [q(numerators[first]!, d), q(numerators[second]!, d)];
}
// Check both potential answers before choosing the target, so arithmetic limits
// cannot make one of the displayed boundaries more likely to be correct.
function manageable(
  pair: Rational[],
  coefficient: Rational,
  constantTerm: Rational,
): boolean {
  if (coefficient.n === 0 || Math.abs(coefficient.n) > 48) return false;
  return pair.every((boundary) => {
    const product = mul(coefficient, boundary),
      total = add(product, constantTerm);
    const commonDenominator =
      (total.d * constantTerm.d) / gcd(total.d, constantTerm.d);
    return (
      Math.abs(product.n) <= 96 &&
      product.d <= 24 &&
      Math.abs(total.n) <= 96 &&
      total.d <= 24 &&
      commonDenominator <= 24
    );
  });
}
const remove = (value: Rational, variable = false) =>
  `${value.n < 0 ? "Add" : "Subtract"} ${variable ? term(q(Math.abs(value.n), value.d)) : number(q(Math.abs(value.n), value.d))}`;
const difference = (a: Rational, b: Rational) =>
  `${number(a)} ${b.n < 0 ? "+" : "−"} ${number(q(Math.abs(b.n), b.d))}`;

export const inequalityTemplates: readonly TemplateMetadata[] = [
  {
    id: "affine-linear-inequality",
    title: "Solve a linear inequality",
    description:
      "Find an exact half-line solution set with signed rational coefficients and all four comparison signs.",
  },
  {
    id: "grouped-linear-inequality",
    title: "Solve an inequality with grouped terms",
    description:
      "Distribute, collect variable terms on both sides, and solve an inequality with an exact rational boundary.",
  },
  {
    id: "cancelled-linear-inequality",
    title: "Classify an inequality after cancellation",
    description:
      "Determine whether an inequality with cancelling variable terms holds for every real number or none.",
  },
].map((t) => ({
  ...t,
  version: 1,
  skillId: "linear-inequalities",
  gradeBand: "6–8",
  requiredResponseCapability: "single-choice-v1",
}));

function generateInequalityCase(
  templateId: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[] } {
  const metadata = inequalityTemplates.find((t) => t.id === templateId);
  if (!metadata) throw new Error(`Unknown inequality template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed),
    op = relations[r(0, 3)]!;
  const tags = [`operator:${op}`];
  let left: string, right: string, hint: string;
  const explanation: string[] = [];
  let candidates: { label: string; correct: boolean; feedback?: string }[];
  let feedback: string;
  if (templateId === "cancelled-linear-inequality") {
    const factor = r(2, 4) * (r(0, 1) ? 1 : -1);
    const a = nz(r, 6),
      b = nz(r, 6),
      d = r(-6, 6);
    const coefficient = factor * a,
      lhs = factor * b + d;
    const truth = r(0, 1) === 1;
    const inclusive = op === "≤" || op === "≥";
    const equalityAllowed = truth === inclusive;
    const equality = equalityAllowed && r(0, 1) === 0;
    const increasing = op === "<" || op === "≤";
    const delta = equality ? 0 : (increasing === truth ? 1 : -1) * r(1, 8);
    const rhs = lhs + delta;
    tags.push(equality ? "equal" : "unequal", truth ? "true" : "false");
    left = `${number(q(factor))}(${linear(q(a), q(b))})${constant(q(d))}`;
    right = linear(q(coefficient), q(rhs));
    hint =
      "Distribute first, then subtract the matching variable terms from both sides. Decide whether the remaining numerical comparison is true or false; it no longer depends on x.";
    explanation.push(
      `Distribute ${number(q(factor))} across the parentheses: ${linear(q(coefficient), q(factor * b))}${constant(q(d))} ${op} ${right}.`,
      ...(d === 0
        ? []
        : [
            `Combine the constants: ${linear(q(coefficient), q(lhs))} ${op} ${right}.`,
          ]),
      `${remove(q(coefficient), true)} from both sides: ${lhs < 0 ? number(q(lhs)) : lhs} ${op} ${number(q(rhs))}.`,
      `This comparison is ${truth ? "true" : "false"}. No x remains, so ${truth ? "every real value of x makes the original inequality true" : "no real value of x makes the original inequality true"}.`,
    );
    const correct = truth ? "All real numbers" : "No real numbers";
    candidates = ["All real numbers", "No real numbers"].map((label) => ({
      label,
      correct: label === correct,
    }));
    feedback = `After the variable terms cancel, ${number(q(lhs))} ${op} ${number(q(rhs))} is ${truth ? "true" : "false"}. Therefore ${truth ? "every real number" : "no real number"} satisfies the original inequality.`;
  } else {
    const pair = boundaries(r);
    let target: Rational;
    let coefficient: Rational, lhsConstant: Rational, rhsConstant: Rational;
    if (templateId === "affine-linear-inequality") {
      do {
        coefficient = q(nz(r, 9), r(1, 6));
        lhsConstant = q(r(-12, 12), r(1, 6));
      } while (!manageable(pair, coefficient, lhsConstant));
      target = pair[r(0, 1)]!;
      rhsConstant = add(mul(coefficient, target), lhsConstant);
      left = linear(coefficient, lhsConstant);
      right = number(rhsConstant);
    } else {
      let k: number, a: number, b: number, d: number, other: Rational;
      do {
        k = r(2, 4) * (r(0, 1) ? 1 : -1);
        a = nz(r, 6);
        b = nz(r, 6);
        d = r(-6, 6);
        other = q(nz(r, 12), r(1, 4));
        coefficient = sub(q(k * a), other);
        lhsConstant = q(k * b + d);
      } while (!manageable(pair, coefficient, lhsConstant));
      target = pair[r(0, 1)]!;
      rhsConstant = add(lhsConstant, mul(coefficient, target));
      left = `${number(q(k))}(${linear(q(a), q(b))})${constant(q(d))}`;
      right = linear(other, rhsConstant);
      explanation.push(
        `Distribute ${number(q(k))} across the parentheses: ${linear(q(k * a), q(k * b))}${constant(q(d))} ${op} ${right}.`,
        ...(d === 0
          ? []
          : [
              `Combine the constants: ${linear(q(k * a), lhsConstant)} ${op} ${right}.`,
            ]),
        `${remove(other, true)} from both sides. The x coefficient becomes ${difference(q(k * a), other)} = ${number(coefficient)}, giving ${linear(coefficient, lhsConstant)} ${op} ${number(rhsConstant)}.`,
      );
    }
    const remaining = sub(rhsConstant, lhsConstant);
    const solvedOp = coefficient.n < 0 ? reverse[op] : op;
    tags.push(
      coefficient.n < 0 ? "negative" : "positive",
      target.n === 0 ? "zero" : "nonzero",
      target.d === 1 ? "integer-boundary" : "fraction-boundary",
      coefficient.d === 1 ? "integer-coefficient" : "fraction-coefficient",
    );
    if (lhsConstant.n !== 0)
      explanation.push(
        `${remove(lhsConstant)} from both sides: ${term(coefficient)} ${op} ${difference(rhsConstant, lhsConstant)} = ${number(remaining)}.`,
      );
    else
      explanation.push(
        `The variable term is already isolated: ${term(coefficient)} ${op} ${number(remaining)}.`,
      );
    if (!equal(coefficient, q(1)))
      explanation.push(
        `Divide both sides by ${number(coefficient)}. ${coefficient.n < 0 ? "This number is negative, so reverse the comparison sign" : "This number is positive, so keep the comparison sign"}. Multiply by the reciprocal, ${number(q(coefficient.d, coefficient.n))}: ${operand(remaining)} × ${operand(q(coefficient.d, coefficient.n))} = ${number(target)}. Therefore x ${solvedOp} ${number(target)}.`,
      );
    explanation.push(
      `The solution is x ${solvedOp} ${number(target)}: all numbers ${{ "<": "less than", "≤": "less than or equal to", ">": "greater than", "≥": "greater than or equal to" }[solvedOp]} ${number(target)}.`,
    );
    const pointsLeft = solvedOp === "<" || solvedOp === "≤";
    // Use zero when it is strictly inside; otherwise choose the nearest interior
    // multiple of the coefficient denominator, so the check product is an integer.
    const zeroInside = pointsLeft ? target.n > 0 : target.n < 0;
    const boundaryInMultiples = target.n / (target.d * coefficient.d);
    const test = q(
      zeroInside
        ? 0
        : coefficient.d *
            (pointsLeft
              ? Math.ceil(boundaryInMultiples) - 1
              : Math.floor(boundaryInMultiples) + 1),
    );
    explanation.push(
      `Check the boundary: ${operand(coefficient)} × ${operand(target)} = ${number(remaining)}, so equality occurs there. For the equivalent inequality ${term(coefficient)} ${op} ${number(remaining)}, substitute the interior value x = ${number(test)}. The left side is ${operand(coefficient)} × ${operand(test)} = ${number(mul(coefficient, test))}; the comparison ${number(mul(coefficient, test))} ${op} ${number(remaining)} is true.`,
    );
    const low: Relation = op === "<" || op === ">" ? "<" : "≤";
    const high = reverse[low];
    candidates = pair.flatMap((boundary) =>
      [low, high].map((direction) => ({
        label: `x ${direction} ${number(boundary)}`,
        correct: equal(boundary, target) && direction === solvedOp,
        feedback: equal(boundary, target)
          ? `The boundary ${number(target)} is correct, but the direction is reversed. ${coefficient.n < 0 ? "Dividing by the negative coefficient reverses the original comparison" : "Dividing by the positive coefficient keeps the original comparison"}, giving x ${solvedOp} ${number(target)}.`
          : direction === solvedOp
            ? `The direction is correct, but the boundary is not. Divide ${number(remaining)} by ${number(coefficient)} to obtain ${number(target)}.`
            : `Check both the boundary and the direction. Dividing ${number(remaining)} by ${number(coefficient)} gives ${number(target)}; ${coefficient.n < 0 ? "the negative divisor reverses" : "the positive divisor preserves"} the comparison, giving x ${solvedOp} ${number(target)}.`,
      })),
    );
    hint =
      "Isolate the variable term using the same addition or subtraction on both sides. When dividing by its coefficient, reverse the comparison sign if that coefficient is negative. Keep track of whether equality is included.";
    if (templateId === "grouped-linear-inequality")
      hint =
        "Distribute the outside factor to every term in the parentheses. Collect variable terms on one side and constants on the other, then divide; a negative divisor reverses the comparison sign.";
    feedback =
      "Both the boundary and the direction must be correct. Isolate x with exact arithmetic, and reverse the comparison when dividing by a negative number.";
  }
  const options = shuffle(candidates, r).map((c, i) => ({
    id: `option-${"abcd"[i]}`,
    ...c,
  }));
  if (options.filter((o) => o.correct).length !== 1)
    throw new Error("Expected exactly one correct solution set");
  const answer = options.find((o) => o.correct)!.id;
  return {
    tags,
    problem: {
      public: {
        id: createHash("sha256")
          .update(JSON.stringify([templateId, 1, seed]))
          .digest("hex"),
        templateId,
        templateVersion: 1,
        seed,
        skillId: metadata.skillId,
        prompt: `Solve for real x: ${left} ${op} ${right}.`,
        response: {
          kind: "choice",
          label: "Choose the complete solution set",
          options: options.map(({ id, label }) => ({ id, label })),
        },
      },
      answer,
      hint,
      explanation,
      choiceFeedback: Object.fromEntries(
        options
          .filter((o) => !o.correct)
          .map((o) => [o.id, o.feedback ?? feedback]),
      ),
    },
  };
}

export function generateInequalityProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  return generateInequalityCase(templateId, seed).problem;
}

/** Private authoring information for representative worksheets; never part of a public problem. */
export function inequalityPrintCase(templateId: string, seed: string) {
  return generateInequalityCase(templateId, seed);
}
