import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
type Q = { n: number; d: number };
type Random = (lo: number, hi: number) => number;
function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
}
function q(n: number, d = 1): Q {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Invalid rational");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const neg = (a: Q) => q(-a.n, a.d);
const same = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
const fmt = (a: Q) =>
  `${a.n < 0 ? "−" : ""}${Math.abs(a.n)}${a.d === 1 ? "" : `/${a.d}`}`;
const operand = (a: Q) => (a.n < 0 ? `(${fmt(a)})` : fmt(a));
const constant = (b: number) =>
  b === 0 ? "" : ` ${b < 0 ? "−" : "+"} ${Math.abs(b)}`;
const term = (a: number) => (a === 1 ? "x" : a === -1 ? "−x" : `${fmt(q(a))}x`);
const inner = (a: number, b: number) => term(a) + constant(b);
const factor = (k: number) => (k === 1 ? "" : k === -1 ? "−" : fmt(q(k)));
const roots = (a: number, b: number, c: Q) =>
  [mul(add(c, q(-b)), q(1, a)), mul(add(neg(c), q(-b)), q(1, a))].sort(
    (u, v) => u.n * v.d - v.n * u.d,
  );
const label = (values: Q[]) => values.map((v) => `x = ${fmt(v)}`).join(" or ");
const nz = (r: Random, max: number) => r(1, max) * (r(0, 1) ? 1 : -1);
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
function shuffle<T>(values: T[], r: Random): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = r(0, i);
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  return values;
}
export const absoluteValueTemplates: readonly TemplateMetadata[] = [
  {
    id: "absolute-value-direct-equation",
    title: "Solve an absolute-value equation",
    description:
      "Find every real number at a given distance from zero, including zero and impossible negative distances.",
  },
  {
    id: "absolute-value-affine-equation",
    title: "Solve an absolute-value equation with a linear expression",
    description:
      "Use both sign branches and exact rational arithmetic to find a complete solution set.",
  },
  {
    id: "absolute-value-transformed-equation",
    title: "Isolate and solve an absolute-value expression",
    description:
      "Undo outside addition and scaling, solve both branches, and classify constant equations.",
  },
].map((t) => ({
  ...t,
  version: 1,
  skillId: "absolute-value-equations",
  gradeBand: "9–12",
  requiredResponseCapability: "single-choice-v1",
}));
function generateCase(
  templateId: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[] } {
  const metadata = absoluteValueTemplates.find((t) => t.id === templateId);
  if (!metadata)
    throw new Error(`Unknown absolute-value template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed),
    direct = templateId === "absolute-value-direct-equation",
    transformed = templateId === "absolute-value-transformed-equation";
  let a = direct ? 1 : nz(r, 6),
    b = direct ? 0 : nz(r, 12),
    k = transformed ? nz(r, 4) : 1,
    d = transformed ? nz(r, 12) : 0;
  const draw = r(0, 19);
  let kind =
    transformed && draw >= 16
      ? draw < 18
        ? "constant-interior"
        : "zero-factor"
      : "positive";
  const tags: string[] = [];
  let c = q(r(1, 12), r(1, 4)),
    e: Q,
    correct: string,
    candidates: string[];
  const explanation: string[] = [];
  if (kind === "constant-interior" || kind === "zero-factor") {
    if (kind === "constant-interior") a = 0;
    else k = 0;
    const total = k * Math.abs(b) + d,
      truth = r(0, 1) === 1;
    e = q(total + (truth ? 0 : nz(r, 6)));
    correct = truth ? "All real numbers" : "No real solutions";
    candidates = ["All real numbers", "No real solutions"];
    tags.push(truth ? "true" : "false");
    explanation.push(
      kind === "constant-interior"
        ? `For every real x, 0x = 0, so |${inner(a, b)}| = |${fmt(q(b))}| = ${Math.abs(b)}.`
        : `For every real x, multiplying |${inner(a, b)}| by 0 gives 0.`,
      `The left side is ${kind === "constant-interior" ? `${fmt(q(k))} × ${Math.abs(b)}${constant(d)}` : `0${constant(d)}`} = ${fmt(q(total))}. The equation therefore says ${fmt(q(total))} = ${fmt(e)}.`,
      `This numerical statement is ${truth ? "true" : "false"} and does not depend on x. ${truth ? "Every real number satisfies the original equation." : "No real number satisfies the original equation."}`,
    );
  } else {
    let other: Q;
    do {
      other = q(r(1, 12), r(1, 4));
    } while (same(c, other));
    let distances = [c, other];
    let pairs = distances.map((value) => roots(a, b, value));
    let singles: Q[];
    if (direct) singles = [q(0)];
    else {
      let b1: number, b2: number;
      do {
        b1 = nz(r, 12);
      } while (b1 === b);
      do {
        b2 = nz(r, 12);
      } while (b2 === b || b2 === b1);
      singles = [q(-b1, a), q(-b2, a)];
    }
    // Direct equations have only one possible singleton solution, zero.
    // Affine equations vary the layout; every offered set is equally likely
    // to be selected before the prompt is constructed from that set.
    if (!direct && r(0, 1) === 0) {
      singles = [singles[r(0, 1)]!];
    } else if (!direct) {
      const keep = r(0, 1);
      distances = [distances[keep]!];
      pairs = [pairs[keep]!];
    }
    candidates = [
      ...pairs.map(label),
      ...singles.map((v) => label([v])),
      "No real solutions",
    ];
    const chosen = r(0, candidates.length - 1);
    correct = candidates[chosen]!;
    if (chosen < pairs.length) {
      kind = "positive";
      c = distances[chosen]!;
    } else if (chosen < pairs.length + singles.length) {
      kind = "zero";
      const singleton = singles[chosen - pairs.length]!;
      b = direct ? 0 : (-singleton.n * a) / singleton.d;
      c = q(0);
    } else {
      kind = "negative";
      c = neg(c);
    }
    e = add(mul(q(k), c), q(d));
    if (transformed) {
      const remaining = add(e, q(-d));
      explanation.push(
        `${d < 0 ? "Add" : "Subtract"} ${Math.abs(d)} ${d < 0 ? "to" : "from"} both sides: ${factor(k)}|${inner(a, b)}| = ${fmt(e)} ${d < 0 ? "+" : "−"} ${Math.abs(d)} = ${fmt(remaining)}.`,
        `Divide both sides by ${fmt(q(k))}: |${inner(a, b)}| = ${operand(remaining)} ÷ ${operand(q(k))} = ${fmt(c)}.`,
      );
    }
    if (c.n < 0)
      explanation.push(
        `An absolute value is a distance from zero and cannot be negative. Therefore |${inner(a, b)}| = ${fmt(c)} has no real solutions.`,
      );
    else {
      const targets = c.n === 0 ? [q(0)] : [c, neg(c)];
      explanation.push(
        c.n === 0
          ? `Only 0 has distance 0 from zero, so ${inner(a, b)} = 0.`
          : `The two numbers at distance ${fmt(c)} from zero are ${fmt(c)} and ${fmt(neg(c))}. Therefore ${inner(a, b)} = ${fmt(c)} or ${inner(a, b)} = ${fmt(neg(c))}.`,
      );
      for (const target of targets) {
        const remaining = add(target, q(-b)),
          solution = mul(remaining, q(1, a));
        if (b !== 0)
          explanation.push(
            `For ${inner(a, b)} = ${fmt(target)}, ${b < 0 ? "add" : "subtract"} ${Math.abs(b)} ${b < 0 ? "to" : "from"} both sides: ${term(a)} = ${fmt(target)} ${b < 0 ? "+" : "−"} ${Math.abs(b)} = ${fmt(remaining)}.`,
          );
        if (a !== 1)
          explanation.push(
            `Divide both sides by ${fmt(q(a))}: x = ${operand(remaining)} ÷ ${operand(q(a))} = ${fmt(solution)}.`,
          );
        const product = mul(q(a), solution),
          inside = add(product, q(b)),
          magnitude = q(Math.abs(inside.n), inside.d),
          scaled = mul(q(k), magnitude);
        explanation.push(
          `Check x = ${fmt(solution)} in the original equation: ${direct ? "" : `${fmt(q(a))} × ${operand(solution)}${constant(b)} = ${b === 0 ? "" : `${fmt(product)}${constant(b)} = `}${fmt(inside)}, so `}|${fmt(inside)}| = ${fmt(magnitude)}.${transformed ? ` The left side is ${fmt(q(k))} × ${operand(magnitude)}${constant(d)} = ${fmt(scaled)}${constant(d)} = ${fmt(e)}, which equals the right side.` : ` This equals the required distance ${fmt(e)}.`}`,
        );
      }
      explanation.push(
        `The complete solution set is ${correct}. ${c.n === 0 ? "The two sign branches coincide at zero, so there is only one solution." : "These two branches include every possible value of the expression inside the bars."}`,
      );
    }
    tags.push(
      c.d === 1 ? "integer-target" : "fraction-target",
      a < 0 ? "negative-interior" : "positive-interior",
      k < 0 ? "negative-factor" : "positive-factor",
    );
  }
  tags.push(kind);
  const equation = `${transformed ? factor(k) : ""}|${inner(a, b)}|${transformed ? constant(d) : ""} = ${fmt(e)}`;
  const options = shuffle(candidates, r).map((text, i) => ({
    id: `option-${"abcd"[i]}`,
    label: text,
  }));
  if (
    new Set(candidates).size !== candidates.length ||
    candidates.filter((v) => v === correct).length !== 1
  )
    throw new Error("Ambiguous absolute-value choices");
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
        prompt: `Solve ${equation}. Choose the complete set of real solutions.`,
        response: {
          kind: "choice",
          label: "Choose the complete solution set",
          options,
        },
      },
      answer: options.find((v) => v.label === correct)!.id,
      hint: transformed
        ? "Isolate the absolute value before deciding whether its target is positive, zero, or negative. Check for a zero coefficient before dividing. A positive target gives two equations for the expression inside the bars."
        : "Absolute value is distance from zero. A positive distance has two possible signs; distance zero has one value, and a negative distance is impossible. Solve every resulting equation.",
      explanation,
      choiceFeedback: Object.fromEntries(
        options
          .filter((v) => v.label !== correct)
          .map((v) => [
            v.id,
            "Check the isolated distance and include every sign branch that is possible. Substitute each proposed value into the original equation; a complete solution set must include all solutions and no extra values.",
          ]),
      ),
    },
  };
}
export function generateAbsoluteValueProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  return generateCase(templateId, seed).problem;
}
/** Authoring tags select representative worksheets; they are never public payload fields. */
export const absoluteValuePrintCase = generateCase;
