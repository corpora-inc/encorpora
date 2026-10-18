import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

export const quadraticTemplates: readonly TemplateMetadata[] = [
  {
    id: "quadratic-factored-solutions",
    title: "Solve a factored quadratic",
    skillId: "quadratic-equations",
    description:
      "Find every real solution of a quadratic written as a product of linear factors.",
    version: 1,
    gradeBand: "9–12",
    requiredResponseCapability: "single-choice-v1",
  },
  {
    id: "quadratic-expanded-solutions",
    title: "Solve a quadratic by factoring",
    skillId: "quadratic-equations",
    description:
      "Factor an expanded quadratic and identify its complete real solution set.",
    version: 1,
    gradeBand: "9–12",
    requiredResponseCapability: "single-choice-v1",
  },
  {
    id: "quadratic-real-solution-count",
    title: "Count real quadratic solutions",
    skillId: "quadratic-formula",
    description:
      "Use the discriminant to count distinct real solutions without calculating the roots.",
    version: 1,
    gradeBand: "9–12",
  },
];

function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1;
    const limit = Math.floor(0x100000000 / span) * span;
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
function fraction(n: number, d: number): string {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  let a = Math.abs(n),
    b = d;
  while (b) [a, b] = [b, a % b];
  return d === a ? String(n / a) : `${n / a}/${d / a}`;
}
function polynomial(a: number, b: number, c: number) {
  const terms: string[] = [];
  for (const [coefficient, variable] of [
    [a, "x²"],
    [b, "x"],
    [c, ""],
  ] as const) {
    if (!coefficient) continue;
    const magnitude = `${Math.abs(coefficient) === 1 && variable ? "" : Math.abs(coefficient)}${variable}`;
    terms.push(
      `${terms.length ? (coefficient < 0 ? " − " : " + ") : coefficient < 0 ? "−" : ""}${magnitude}`,
    );
  }
  return terms.join("") || "0";
}
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
const minus = (text: string) => text.replace(/-(?=\d)/g, "−");
function solveFactor(a: number, b: number): string {
  const equation = `${polynomial(0, a, b)} = 0`;
  if (b === 0)
    return a === 1
      ? "The factor x is zero exactly when x = 0."
      : `Divide both sides of ${equation} by (${a}): x = 0.`;
  const operation = b < 0 ? `add ${-b} to` : `subtract ${b} from`;
  return `In ${equation}, ${operation} both sides${a === 1 ? "" : `, then divide both sides by (${a})`}: x = ${fraction(-b, a)}.`;
}

type Root = { n: number; d: number };
function rootSet(roots: Root[]): string {
  const sorted = roots
    .map(({ n, d }) => (d < 0 ? { n: -n, d: -d } : { n, d }))
    .sort((a, b) => a.n * b.d - b.n * a.d);
  return [...new Set(sorted.map(({ n, d }) => fraction(n, d)))]
    .map((value) => `x = ${value}`)
    .join(" or ");
}

export function generateQuadraticProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = quadraticTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown quadratic template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const nz = (max: number) => r(1, max) * (r(0, 1) ? 1 : -1);
  let prompt: string, answer: string, hint: string, explanation: string[];
  let response: GeneratedProblem["public"]["response"];
  let choiceFeedback: Record<string, string> | undefined;
  if (templateId === "quadratic-real-solution-count") {
    const category = r(0, 2);
    let a = nz(5),
      b: number,
      c: number;
    if (category === 1) {
      const h = r(-5, 5);
      b = -2 * a * h;
      c = a * h * h;
    } else {
      do {
        a = nz(5);
        b = r(-12, 12);
        c = r(-12, 12);
      } while (
        (b * b - 4 * a * c > 0 ? 2 : b * b - 4 * a * c < 0 ? 0 : 1) !== category
      );
    }
    const discriminant = b * b - 4 * a * c;
    prompt = `How many distinct real solutions does ${polynomial(a, b, c)} = 0 have?`;
    answer = String(category);
    response = { kind: "number", label: "Number of distinct real solutions" };
    hint =
      "For ax² + bx + c = 0, calculate the discriminant b² − 4ac. Its sign tells whether there are two, one, or no distinct real solutions.";
    explanation = [
      `The coefficients are a = ${a}, b = ${b}, and c = ${c}.`,
      `The discriminant is (${b})² − 4 × (${a}) × (${c}) = ${b * b} − (${4 * a * c}) = ${discriminant}.`,
      discriminant > 0
        ? "A positive discriminant gives two different square-root branches in the quadratic formula, so there are 2 distinct real solutions."
        : discriminant === 0
          ? "A zero discriminant makes the two branches of the quadratic formula equal, so there is 1 distinct real solution: a repeated root."
          : "A negative discriminant has no real square root, so there are 0 real solutions.",
    ];
  } else {
    const a = nz(4),
      b = r(-8, 8);
    const repeated = r(0, 4) === 0;
    const c = repeated ? a : nz(4),
      d = repeated ? b : r(-8, 8);
    const left = polynomial(0, a, b),
      right = polynomial(0, c, d);
    const expanded = polynomial(a * c, a * d + b * c, b * d);
    const roots: Root[] = [
      { n: -b, d: a },
      { n: -d, d: c },
    ];
    const correct = rootSet(roots);
    prompt = `Solve ${templateId === "quadratic-factored-solutions" ? `(${left})(${right})` : expanded} = 0. Choose the complete set of real solutions.`;
    let la = a,
      lb = b,
      ra = c,
      rb = d;
    const factoring: string[] = [];
    hint =
      "A product equals zero exactly when at least one factor equals zero. Solve each linear equation and keep each distinct solution.";
    if (templateId === "quadratic-expanded-solutions") {
      const A = a * c,
        B = a * d + b * c,
        C = b * d;
      if (C === 0) {
        la = 1;
        lb = 0;
        ra = A;
        rb = B;
        hint =
          "Factor out x, then set each factor equal to zero. Keep the solution from the factor x.";
        factoring.push(
          `Factor out x: ${expanded} = x(${polynomial(0, A, B)}) = 0.`,
        );
      } else {
        // Remove numerical content, then extract greatest common factors from
        // the two groups. The displayed method does not depend on hidden factors.
        const common = Math.sign(A) * gcd(A, gcd(B, C));
        const aa = A / common,
          bb = B / common,
          cc = C / common;
        const m = (a * d) / common,
          n = (b * c) / common;
        la = gcd(aa, m);
        ra = aa / la;
        rb = m / la;
        lb = n / ra;
        const reduced = polynomial(aa, bb, cc);
        const commonBinomial = polynomial(0, ra, rb);
        hint = `${common === 1 ? "" : `Divide both sides by (${common}). `}Find two integers with product ${aa * cc} and sum ${bb}. Use them to ${bb === 0 ? "introduce opposite linear terms" : "split the linear term"}, then factor by grouping.`;
        if (common !== 1)
          factoring.push(
            `Divide both sides by the nonzero common factor ${common}: ${reduced} = 0.`,
          );
        factoring.push(
          `Use ${m} and ${n}: their sum is ${bb} and their product is ${aa * cc}, the leading coefficient times the constant term.`,
          `${bb === 0 ? "Insert cancelling linear terms" : "Split the linear term"}: ${reduced} = (${polynomial(aa, m, 0)}) + (${polynomial(0, n, cc)}).`,
          `Factor each group by the distributive property: ${polynomial(0, la, 0)}(${commonBinomial}) + (${lb})(${commonBinomial}) = (${polynomial(0, la, lb)})(${commonBinomial}) = 0.`,
        );
      }
    }
    const solvedLeft = polynomial(0, la, lb),
      solvedRight = polynomial(0, ra, rb);
    explanation = [
      ...factoring,
      `By the zero-product property, ${solvedLeft} = 0${solvedLeft === solvedRight ? "" : ` or ${solvedRight} = 0`}.`,
      solveFactor(la, lb),
      ...(solvedLeft === solvedRight ? [] : [solveFactor(ra, rb)]),
      `${correct}. ${fraction(-b, a) === fraction(-d, c) ? "Both factors give the same root, so list it once." : "Each root makes one factor zero; both belong in the solution set."}`,
    ];
    const options = [{ label: correct, feedback: "" }];
    // Exact shifts preserve distinctness and avoid equivalent duplicate choices.
    const candidates = [
      ...[0, 1].map((index) => ({
        roots: roots.map((root, i) =>
          i === index ? { n: root.n + root.d, d: root.d } : root,
        ),
        feedback:
          "Check every listed value. One correct root is not enough: the choice must contain every root and no extra values.",
      })),
      {
        roots: roots.map(({ n, d }) => ({ n: -n, d })),
        feedback:
          "Solving ax + b = 0 requires subtracting b before dividing by a. Check the sign of each root.",
      },
      ...[1, -1, 2, -2].map((shift) => ({
        roots: roots.map(({ n, d }) => ({ n: n + shift * d, d })),
        feedback:
          "Substitute each proposed root into the original equation. Every listed value must make a factor zero, and every root must be included.",
      })),
    ];
    for (const candidate of candidates) {
      const label = rootSet(candidate.roots);
      if (!options.some((o) => o.label === label))
        options.push({ label, feedback: candidate.feedback });
      if (options.length === 4) break;
    }
    for (let i = options.length - 1; i > 0; i--) {
      const j = r(0, i);
      [options[i], options[j]] = [options[j]!, options[i]!];
    }
    answer = "";
    choiceFeedback = {};
    response = {
      kind: "choice",
      label: "Choose one solution set",
      options: options.map((option, i) => {
        const id = `option-${"abcd"[i]}`;
        if (option.label === correct) answer = id;
        else choiceFeedback![id] = option.feedback;
        return { id, label: minus(option.label) };
      }),
    };
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt: minus(prompt),
      skillId: meta.skillId,
      response,
    },
    answer,
    hint: minus(hint),
    explanation: explanation.map(minus),
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
}
