import type { Surface } from "./variation/compose";
import type { Random } from "./variation/axes";
import type { ChoiceOption } from "./chain-kit";

/**
 * Small helpers shared by the grades 3 to 5 gap families. `choiceSurface`
 * shuffles its options; lettered figures (Triangle A to D, Point A to D) must
 * keep their letters in order, so `orderedChoiceSurface` keeps the order given.
 */
export function orderedChoiceSurface(s: {
  prompt: string;
  options: ChoiceOption[];
  hint: string;
  explanation: string[];
  label?: string;
}): Surface | null {
  const labels = new Set(s.options.map((o) => o.label));
  if (
    s.options.length !== 4 ||
    labels.size !== 4 ||
    s.options.filter((o) => o.correct).length !== 1
  )
    return null;
  const choiceFeedback: Record<string, string> = {};
  let answer = "";
  const options = s.options.map((o, i) => {
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

/** Draw `count` distinct items from a pool, without replacement. */
export function draw<T>(r: Random, pool: readonly T[], count: number): T[] {
  const rest = [...pool];
  const out: T[] = [];
  while (out.length < count && rest.length)
    out.push(rest.splice(r(0, rest.length - 1), 1)[0]!);
  return out;
}

/** Fisher-Yates over a copy, so a model's pool is never reordered. */
export function shuffled<T>(r: Random, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const letters = ["A", "B", "C", "D"] as const;
export const an = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
