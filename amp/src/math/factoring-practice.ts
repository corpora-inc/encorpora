import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

export const factoringTemplates: readonly TemplateMetadata[] = [
  {
    id: "greatest-monomial-factor",
    title: "Extract the greatest common factor",
    description:
      "Extract the positive coefficient GCF and the variable power common to every term.",
  },
  {
    id: "monic-quadratic-factorization",
    title: "Factor a monic quadratic",
    description:
      "Rewrite a quadratic with leading coefficient one as a product of integer linear factors.",
  },
  {
    id: "nonmonic-quadratic-factorization",
    title: "Factor a nonmonic quadratic",
    description:
      "Extract signed numerical content and factor a quadratic with a leading coefficient other than one.",
  },
].map((t) => ({
  ...t,
  skillId: "factor-quadratics",
  version: 1,
  gradeBand: "9–12",
  requiredResponseCapability: "single-choice-v1",
}));

type Poly = number[];
type Item = {
  p: Poly;
  left: Poly;
  right: Poly;
  scalar: number;
  label: string;
  tags: string[];
  gcf?: [number, number];
};
const power = (n: number) => ["", "x", "x²", "x³"][n]!;
const signed = (n: number) => String(n).replace("-", "−");
const operand = (n: number) => (n < 0 ? `(${signed(n)})` : String(n));
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
function term(c: number, k: number) {
  return `${Math.abs(c) === 1 && k ? "" : Math.abs(c)}${power(k)}`;
}
function terms(values: [number, number][]) {
  return (
    values
      .filter(([c]) => c !== 0)
      .map(
        ([c, k], i) =>
          `${i ? (c < 0 ? " − " : " + ") : c < 0 ? "−" : ""}${term(c, k)}`,
      )
      .join("") || "0"
  );
}
function format(p: Poly) {
  return terms(p.map((c, k) => [c, k] as [number, number]).reverse());
}
function product(a: Poly, b: Poly) {
  const p = Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((c, i) =>
    b.forEach((d, j) => {
      p[i + j]! += c * d;
    }),
  );
  return p;
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
function shuffle<T>(values: T[], r: ReturnType<typeof random>) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = r(0, i);
    [values[i], values[j]] = [values[j]!, values[i]!];
  }
  return values;
}

function quadraticGroups(monic: boolean): Item[][] {
  const groups = new Map<string, Map<number, Item>>();
  for (const k of monic ? [1] : [-3, -2, -1, 1, 2, 3])
    for (let r = 1; r <= (monic ? 1 : 6); r++)
      for (let t = r; t <= (monic ? 1 : 6); t++) {
        if (r * t > 12 || (!monic && k * r * t === 1)) continue;
        for (let s = -9; s <= 9; s++)
          for (let u = -9; u <= 9; u++) {
            if (
              !s ||
              !u ||
              Math.abs(s * u) > 36 ||
              gcd(r, s) !== 1 ||
              gcd(t, u) !== 1 ||
              (r === t && s > u)
            )
              continue;
            const left = [s, r],
              right = [u, t],
              p = product(left, right).map((c) => c * k);
            const repeated = r === t && s === u;
            const label = `${k === 1 ? "" : k === -1 ? "−" : signed(k)}(${format(left)})${repeated ? "²" : `(${format(right)})`}`;
            const tags = [
              repeated ? "square" : "distinct-factors",
              p[1] === 0 ? "conjugate" : "middle-present",
              p[1]! < 0 ? "negative-middle" : "nonnegative-middle",
              p[0]! < 0 ? "negative-constant" : "positive-constant",
              s < 0 && u < 0 ? "both-negative" : "other-signs",
              k < 0 ? "negative-leading" : "positive-leading",
              Math.abs(k) > 1 ? "content" : "primitive",
              r * t === 1 ? "inner-monic" : "inner-nonmonic",
              Math.abs(k) > 1 && r * t === 1
                ? "monic-content"
                : "other-content",
              Math.abs(k) === 1 && r * t > 1
                ? "primitive-nonmonic"
                : "other-leading",
            ];
            const key = JSON.stringify([k, r * t, s * u]);
            if (!groups.has(key)) groups.set(key, new Map());
            groups
              .get(key)!
              .set(p[1]!, { p, left, right, scalar: k, label, tags });
          }
      }
  return [...groups.values()]
    .filter((g) => g.size >= 2)
    .map((g) => [...g.values()]);
}
function monomialGroups(): Item[][] {
  const groups: Item[][] = [];
  for (let degree = 1; degree <= 3; degree++)
    for (let lowest = 0; lowest < degree; lowest++)
      for (const leading of [
        -36, -30, -24, -18, -12, -6, 6, 12, 18, 24, 30, 36,
      ]) {
        const group: Item[] = [];
        for (let g = 1; g <= 12; g++) {
          if (leading % g || (g === 1 && lowest === 0)) continue;
          for (let c = -9; c <= 9; c++)
            for (const middle of degree - lowest > 1
              ? [-2, -1, 0, 1, 2]
              : [0]) {
              if (
                !c ||
                Math.abs(g * c) > 72 ||
                gcd(gcd(leading / g, c), middle) !== 1
              )
                continue;
              const q = Array<number>(degree - lowest + 1).fill(0);
              q[0] = c;
              q[q.length - 1] = leading / g;
              if (middle) q[1] = middle;
              const factor = Array<number>(lowest + 1).fill(0);
              factor[lowest] = g;
              const p = product(factor, q);
              group.push({
                p,
                left: factor,
                right: q,
                scalar: 1,
                label: `${format(factor)}(${format(q)})`,
                gcf: [g, lowest],
                tags: [
                  `degree-${degree}`,
                  lowest === 0
                    ? "coefficient-only"
                    : g === 1
                      ? "variable-only"
                      : "combined",
                  leading < 0 ? "negative-leading" : "positive-leading",
                  middle ? "three-terms" : "two-terms",
                ],
              });
            }
        }
        const unique = [
          ...new Map(group.map((item) => [item.p.join(","), item])).values(),
        ];
        if (unique.length >= 2) groups.push(unique);
      }
  return groups;
}
const groups = {
  gcf: monomialGroups(),
  monic: quadraticGroups(true),
  nonmonic: quadraticGroups(false),
};

export function factoringPrintCase(id: string, seed: string) {
  const meta = factoringTemplates.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown factoring template: ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed),
    extraction = id === "greatest-monomial-factor";
  const pool = extraction
    ? groups.gcf
    : id === "monic-quadratic-factorization"
      ? groups.monic
      : groups.nonmonic;
  const mode = r(0, 3),
    special =
      !extraction && mode < 2 ? (mode === 0 ? "square" : "conjugate") : null;
  const eligible = special
    ? pool.filter((g) => g.some((c) => c.tags.includes(special)))
    : pool;
  const source = eligible[r(0, eligible.length - 1)]!;
  let group = shuffle([...source], r);
  if (special) {
    const anchor = group.find((c) => c.tags.includes(special))!;
    group = [anchor, ...group.filter((c) => c !== anchor)];
  }
  group = group.slice(0, 4);
  // All option values exist before a uniformly selected member supplies the prompt.
  const selected = group[r(0, group.length - 1)]!;
  const p = selected.p,
    shown = format(p),
    explanation: string[] = [];
  if (extraction) {
    const [g, k] = selected.gcf!;
    const divisors = Array.from({ length: g }, (_, i) => i + 1).filter((d) =>
      p.every((c) => c % d === 0),
    );
    explanation.push(
      `Common positive coefficient factors: ${divisors.join(", ")}. The greatest is ${g}.`,
      k === 0
        ? "A nonzero constant term has no factor x, so no power of x is common to every term."
        : `The smallest exponent of x among the nonzero terms is ${k}. The common variable factor is ${power(k)}.`,
    );
    explanation.push(
      `The greatest common monomial factor is ${format(selected.left)}. Find each remaining term by multiplication.`,
    );
    for (let j = selected.right.length - 1; j >= 0; j--)
      if (selected.right[j]) {
        const q = selected.right[j]!;
        const single = terms([[q, j]]);
        explanation.push(
          `${format(selected.left)} × ${q < 0 ? `(${single})` : single} = ${terms([[q * g, j + k]])}.`,
        );
      }
    explanation.push(
      `Factorization: ${shown} = ${selected.label}. Multiplication verifies the identity even when x = 0.`,
    );
  } else {
    const [s, a] = selected.left as [number, number],
      [u, b] = selected.right as [number, number],
      k = selected.scalar;
    const inner = product(selected.left, selected.right),
      m = a * u,
      n = b * s;
    if (k !== 1)
      explanation.push(
        `Extract ${signed(k)} so the inside quadratic has a positive leading coefficient: ${shown} = ${signed(k)}(${format(inner)}).`,
      );
    explanation.push(
      `For ${format(inner)}, the leading coefficient is ${a * b}, the middle coefficient is ${signed(m + n)}, and the constant is ${signed(s * u)}.`,
    );
    if (id === "monic-quadratic-factorization")
      explanation.push(
        `Find two integers with product ${signed(s * u)} and sum ${signed(m + n)}: ${operand(s)} × ${operand(u)} = ${signed(s * u)}; ${signed(s)} + ${operand(u)} = ${signed(m + n)}.`,
      );
    else {
      explanation.push(
        `Split the middle coefficient using a product of ${a * b} × ${operand(s * u)} = ${signed(a * b * s * u)}: ${operand(m)} × ${operand(n)} = ${signed(a * b * s * u)}; ${signed(m)} + ${operand(n)} = ${signed(m + n)}.`,
      );
      explanation.push(
        `Split the middle term: ${format(inner)} = ${terms([
          [a * b, 2],
          [m, 1],
          [n, 1],
          [s * u, 0],
        ])}.`,
      );
      const common = `(${format(selected.right)})`;
      const grouped = `${terms([[a, 1]])}${common}${s < 0 ? " − " : " + "}${Math.abs(s) === 1 ? "" : Math.abs(s)}${common}`;
      explanation.push(
        `Group and factor: ${format(inner)} = ${grouped} = (${format(selected.left)})${common}.`,
      );
    }
    explanation.push(
      `Check by multiplying every pair of terms: ${selected.label} = ${terms([
        [k * a * b, 2],
        [k * m, 1],
        [k * n, 1],
        [k * s * u, 0],
      ])} = ${shown}.`,
    );
    explanation.push(
      selected.tags.includes("square")
        ? "The two linear factors are equal; the exponent 2 means their product."
        : selected.tags.includes("conjugate")
          ? "The opposite middle-term products cancel. This is a difference-of-squares factorization, with any outside numerical factor retained."
          : "Each linear factor has integer coefficients with greatest common factor 1, so the expression is completely factored over the integers.",
    );
  }
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = shuffle([...group], r).map((item, i) => {
    const optionId = `option-${"abcd"[i]}`;
    if (item === selected) answer = optionId;
    else
      choiceFeedback[optionId] =
        `This product expands to ${format(item.p)}. Compare its coefficients with ${shown}; a factorization must reproduce every term.`;
    return { id: optionId, label: item.label };
  });
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: meta.skillId,
      prompt: extraction
        ? `Factor out the greatest common monomial factor with positive coefficient: ${shown}.`
        : `Factor completely over the integers: ${shown}.`,
      response: {
        kind: "choice",
        label: "Choose the factored expression",
        options,
      },
    },
    answer,
    explanation,
    choiceFeedback,
    hint: extraction
      ? "Find the positive greatest common factor of the coefficients and the smallest variable exponent present. Choose a product that reproduces every original term."
      : id === "monic-quadratic-factorization"
        ? "Find two integers whose product is the constant term and whose sum is the coefficient of x. Use them in two factors beginning with x."
        : "Extract a numerical common factor, choosing its sign to leave a positive leading coefficient. Split the middle term using the product of the leading and constant coefficients, then factor by grouping.",
  };
  return { problem, tags: selected.tags, caseKey: p.join(",") };
}
export const generateFactoringProblem = (
  id: string,
  seed: string,
): GeneratedProblem => factoringPrintCase(id, seed).problem;
