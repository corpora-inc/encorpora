import type { TemplateMetadata, GeneratedProblem } from "./contracts";
import { shuffle } from "./distribution-practice";
import type { AxisSet, AxisValues, Random } from "./variation/axes";
import {
  defineVariedFamily,
  generateVaried,
  type Surface,
  type VariedFamily,
} from "./variation/compose";

/**
 * Shared pieces of the multi-step chain families. Each chain family composes
 * two or more steps that AMP already practices one at a time, so a family file
 * holds one exact model (the givens and every intermediate value) and renders
 * prompt, hint and explanation from it.
 */
export const gcd = (a: number, b: number): number =>
  b ? gcd(b, a % b) : Math.abs(a);

/** An exact decimal text for the ratio n/d, which must terminate. */
export function decimalText(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  const num = n / g;
  const den = d / g;
  let rest = den;
  let twos = 0;
  let fives = 0;
  while (rest % 2 === 0) ((rest /= 2), twos++);
  while (rest % 5 === 0) ((rest /= 5), fives++);
  if (rest !== 1) throw new Error(`${n}/${d} does not terminate`);
  const places = Math.max(twos, fives);
  const digits = String(Math.abs(num) * (10 ** places / den)).padStart(
    places + 1,
    "0",
  );
  const whole = digits.slice(0, digits.length - places);
  const frac = digits.slice(digits.length - places);
  return `${num < 0 ? "-" : ""}${whole}${places ? `.${frac}` : ""}`;
}

/** Cents as dollars with two places: 1250 -> "12.50". */
export const dollars = (cents: number) =>
  `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
/** Cents as the shortest exact decimal: 1250 -> "12.5", 1200 -> "12". */
export const dollarsShort = (cents: number) => decimalText(cents, 100);
/** A dollar amount in prose, written with the word "dollars": a literal
 * dollar sign would pair with another one and be read as TeX. */
export const money = (cents: number) =>
  cents === 100
    ? "1 dollar"
    : `${cents % 100 === 0 ? cents / 100 : dollars(cents)} dollars`;

export const mixedTex = (whole: number, n: number, d: number) =>
  n === 0 ? `${whole}` : `${whole}\\frac{${n}}{${d}}`;

export const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;

export function numberSurface(s: {
  prompt: string;
  answer: string;
  hint: string;
  explanation: string[];
  fraction?: boolean;
  label?: string;
}): Surface {
  return {
    prompt: s.prompt,
    response: s.fraction
      ? {
          kind: "fraction",
          label: s.label ?? "Answer (fraction, decimal, or whole number)",
        }
      : { kind: "number", label: s.label ?? "Answer" },
    answer: s.answer,
    hint: s.hint,
    explanation: s.explanation,
  };
}

export interface ChoiceOption {
  label: string;
  correct?: true;
  feedback?: string;
}
/** Single choice: the correct option plus distinct wrong options, each with
 * feedback naming the slip. Returns null when fewer than three distinct wrong
 * options exist so the model can redraw. */
export function choiceSurface(
  r: Random,
  s: {
    prompt: string;
    options: ChoiceOption[];
    hint: string;
    explanation: string[];
    label?: string;
  },
): Surface | null {
  const correct = s.options.find((o) => o.correct)!;
  const seen = new Set([correct.label]);
  const wrong = s.options.filter((o) => {
    if (o.correct || seen.has(o.label)) return false;
    seen.add(o.label);
    return true;
  });
  if (wrong.length < 3) return null;
  const chosen = shuffle(r, [correct, ...wrong.slice(0, 3)]);
  const choiceFeedback: Record<string, string> = {};
  let answer = "";
  const options = chosen.map((o, i) => {
    const id = `option-${"abcd"[i]}`;
    if (o.correct) answer = id;
    else choiceFeedback[id] = o.feedback!;
    return { id, label: o.label };
  });
  return {
    prompt: s.prompt,
    response: {
      kind: "choice",
      label: s.label ?? "Choose one answer",
      options,
    },
    answer,
    hint: s.hint,
    explanation: s.explanation,
    choiceFeedback,
  };
}

/** Define a family and its `generate(seed)` in one step. */
export function chainFamily<A extends AxisSet, M>(family: VariedFamily<A, M>) {
  const defined = defineVariedFamily(family);
  return {
    family: defined,
    generate: (seed: string, force: Partial<AxisValues<A>> = {}) =>
      generateVaried(defined, seed, force),
  };
}

export type ChainGenerators = Record<
  string,
  (seed: string) => GeneratedProblem
>;
/** Build the `generate(templateId, seed)` function a ContentFamily needs. */
export function dispatch(
  templates: readonly TemplateMetadata[],
  generators: Record<string, (seed: string) => GeneratedProblem>,
) {
  return (templateId: string, seed: string): GeneratedProblem => {
    const g = generators[templateId];
    if (!g || !templates.some((t) => t.id === templateId))
      throw new Error(`Unknown chain template ${templateId}`);
    return g(seed);
  };
}
