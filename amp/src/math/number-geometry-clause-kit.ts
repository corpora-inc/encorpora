import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import type { Random } from "./variation/axes";
import { numberLine } from "./scene/author";
import type { Scene } from "./scene/spec";

export type Rng = Random;
export const rng = (id: string, seed: string): Rng => {
  let counter = 0;
  return (lo, hi) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let n: number;
    do
      n = createHash("sha256")
        .update(JSON.stringify([id, seed, "clauses-v1", counter++]))
        .digest()
        .readUInt32BE(0);
    while (n >= limit);
    return lo + (n % span);
  };
};
export const pick = <T>(r: Rng, xs: readonly T[]): T =>
  xs[r(0, xs.length - 1)]!;
export function shuffled<T>(r: Rng, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
export const clean = (n: number) => Number(n.toFixed(10));
export const show = (n: number) => String(clean(n)).replace("-", "−");
export const math = (s: string) => `$${s}$`;
export function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
}
export function fraction(n: number, d = 1): string {
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  return d === 1 ? String(n) : `${n}/${d}`;
}
export function fracTex(n: number, d = 1): string {
  const s = fraction(n, d);
  return s.includes("/")
    ? `${n < 0 ? "-" : ""}\\frac{${Math.abs(n) / gcd(n, d)}}{${d / gcd(n, d)}}`
    : s;
}
export type Item = Pick<GeneratedProblem, "answer" | "hint" | "explanation"> &
  Partial<
    Pick<GeneratedProblem, "choiceFeedback" | "pointGrading" | "workGrading">
  > & {
    prompt: string;
    response: ProblemResponse;
    figure?: SemanticFigure;
  };
export type Option = { label: string; feedback: string };
export function choice(
  r: Rng,
  correct: string,
  wrong: (string | Option)[],
): Pick<Item, "response" | "answer" | "choiceFeedback"> {
  const xs = [
    { label: correct, feedback: "", correct: true },
    ...shuffled(r, wrong)
      .slice(0, 3)
      .map((w) => ({
        ...(typeof w === "string"
          ? {
              label: w,
              feedback: "Check the stated quantities and the operation.",
            }
          : w),
        correct: false,
      })),
  ];
  if (new Set(xs.map((x) => x.label)).size !== xs.length)
    throw new Error("Duplicate clause choices");
  const options = shuffled(r, xs).map((x, i) => ({
    ...x,
    id: `option-${String.fromCharCode(97 + i)}`,
  }));
  return {
    response: {
      kind: "choice",
      label: "Choose one answer",
      options: options.map(({ id, label }) => ({ id, label })),
    },
    answer: options.find((x) => x.correct)!.id,
    choiceFeedback: Object.fromEntries(
      options.filter((x) => !x.correct).map((x) => [x.id, x.feedback]),
    ),
  };
}
export function multi(
  r: Rng,
  labels: string[],
  correct: number[],
): Pick<Item, "response" | "answer"> {
  const options = shuffled(
    r,
    labels.map((label, i) => ({ label, correct: correct.includes(i) })),
  ).map((x, i) => ({ ...x, id: `option-${String.fromCharCode(97 + i)}` }));
  return {
    response: {
      kind: "multi-select",
      label: `Select ${correct.length} answers`,
      selectionCount: correct.length,
      options: options.map(({ id, label }) => ({ id, label })),
    },
    answer: JSON.stringify(
      options
        .filter((x) => x.correct)
        .map((x) => x.id)
        .sort(),
    ),
  };
}
export function parts(
  r: Rng,
  rows: { label: string; correct: string; wrong: string[] }[],
): Pick<Item, "response" | "answer"> {
  const answer: Record<string, string> = {};
  const blanks = rows.map((row, i) => {
    const id = `part${i + 1}`;
    const values = [row.correct, ...row.wrong];
    if (new Set(values).size !== values.length)
      throw new Error("Duplicate part choices");
    const options = shuffled(
      r,
      values.map((label, j) => ({ label, correct: j === 0 })),
    ).map((x, j) => ({ ...x, id: String.fromCharCode(97 + j) }));
    answer[id] = options.find((x) => x.correct)!.id;
    return {
      id,
      label: row.label,
      options: options.map(({ id, label }) => ({ id, label })),
    };
  });
  return {
    response: {
      kind: "multi-part-choice",
      label: "Complete each part",
      layout: "slots",
      blanks,
    },
    answer: JSON.stringify(answer),
  };
}
export function figures(
  r: Rng,
  correct: { label: string; scene: Scene },
  wrong: { label: string; scene: Scene }[],
): Pick<Item, "response" | "answer"> {
  const options = shuffled(
    r,
    [correct, ...wrong].map((x, i) => ({ ...x, correct: i === 0 })),
  ).map((x, i) => ({ ...x, id: `option-${String.fromCharCode(97 + i)}` }));
  return {
    response: {
      kind: "figure-choice",
      label: "Choose the picture",
      noun: "Picture",
      options: options.map(({ id, label, scene }) => ({ id, label, scene })),
    },
    answer: options.find((x) => x.correct)!.id,
  };
}
export const numeric = (
  n: number | string,
  label = "Answer",
): Pick<Item, "answer" | "response"> => ({
  answer: String(n),
  response: { kind: "fraction", label },
});
export function line(
  points: { at: number; label: string }[],
  step = 1,
): SemanticFigure {
  const values = [0, ...points.map((p) => p.at)];
  return {
    kind: "scene",
    scene: numberLine({
      min: Math.floor(Math.min(...values)) - 1,
      max: Math.ceil(Math.max(...values)) + 1,
      step,
      marks: points,
    }).scene(),
  };
}
export function finish(
  meta: TemplateMetadata,
  seed: string,
  variant: string,
  c: Item,
): GeneratedProblem {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const { prompt, response, figure, ...privatePart } = c;
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      skillId: meta.skillId,
      seed,
      prompt,
      response,
      ...(figure ? { figure } : {}),
    },
    ...privatePart,
    variant: { id: variant, axes: { clause: variant } },
  };
}
