import { z } from "zod";

export const counterThings = [
  "apple",
  "duck",
  "frog",
  "bird",
  "dog",
  "cup",
] as const;
export const counterBuilderResponseSchema = z
  .object({
    kind: z.literal("counter-builder"),
    label: z.string().trim().min(1).max(100),
    board: z.enum(["two-groups", "row", "frame"]),
    max: z.literal(10),
    canRemove: z.boolean(),
    thing: z.enum(counterThings),
  })
  .strict()
  .refine(
    (r) => r.canRemove === (r.board === "row"),
    "Only a take-away row crosses out counters",
  );
export type CounterBuilderResponse = z.infer<
  typeof counterBuilderResponseSchema
>;
const count = z.number().int().min(0).max(10);
const draftSchema = z
  .object({
    groups: z.array(count).min(1).max(2),
    removed: count,
    sentence: z.tuple([
      count.nullable(),
      z.enum(["+", "-"]).nullable(),
      count.nullable(),
      count.nullable(),
    ]),
  })
  .strict();
export type CounterBuilderDraft = z.infer<typeof draftSchema>;
export type CounterBuilderAnswer = Omit<CounterBuilderDraft, "sentence"> & {
  sentence: [number, "+" | "-", number, number];
};
export function emptyCounterBuilder(
  r: CounterBuilderResponse,
): CounterBuilderDraft {
  return {
    groups: r.board === "row" ? [0] : [0, 0],
    removed: 0,
    sentence: [null, null, null, null],
  };
}
/** Wrong mathematical models are valid attempts. Reject only malformed or
 * unreachable boards; never repair a count or fill a sentence for the child. */
export function parseCounterBuilder(
  r: CounterBuilderResponse,
  raw: string,
): CounterBuilderDraft | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const a = parsed.data,
      total = a.groups.reduce((s, n) => s + n, 0);
    if (
      a.groups.length !== (r.board === "row" ? 1 : 2) ||
      total > r.max ||
      a.removed > total ||
      (!r.canRemove && a.removed !== 0)
    )
      return null;
    return a;
  } catch {
    return null;
  }
}
/** Normalize transport keys, preserving the child's chosen group and tile order. */
export function normalizeCounterBuilder(
  r: CounterBuilderResponse,
  raw: string,
): string | null {
  const a = parseCounterBuilder(r, raw);
  if (!a || a.sentence.some((v) => v === null)) return null;
  return JSON.stringify(a);
}
export function gradeCounterBuilder(
  r: CounterBuilderResponse,
  key: string,
  raw: string,
): boolean {
  const answer = normalizeCounterBuilder(r, raw);
  const expected = normalizeCounterBuilder(r, key);
  if (answer === null || expected === null) return false;
  const canonical = (raw: string) => {
    const a = JSON.parse(raw) as CounterBuilderAnswer;
    a.groups.sort((x, y) => x - y);
    if (a.sentence[1] === "+" && a.sentence[0] > a.sentence[2])
      [a.sentence[0], a.sentence[2]] = [a.sentence[2], a.sentence[0]];
    return JSON.stringify(a);
  };
  return canonical(answer) === canonical(expected);
}
/** Validate the private key against the model as well as its arithmetic. */
export function counterBuilderKeyFits(
  r: CounterBuilderResponse,
  key: string,
): boolean {
  const normalized = normalizeCounterBuilder(r, key);
  if (normalized === null || normalized !== key) return false;
  const a = JSON.parse(normalized) as CounterBuilderAnswer;
  const [x, sign, y, result] = a.sentence;
  if (x < 1 || y < 1 || result < 1) return false;
  return r.canRemove
    ? sign === "-" && a.groups[0] === x && a.removed === y && x - y === result
    : sign === "+" &&
        [...a.groups].sort((a, b) => a - b).join() ===
          [x, y].sort((a, b) => a - b).join() &&
        a.removed === 0 &&
        x + y === result;
}
export function counterBuilderAnswerText(
  r: CounterBuilderResponse,
  raw: string,
): string {
  const a = parseCounterBuilder(r, raw);
  if (!a) return "No counters or sentence entered";
  const [x, sign, y, result] = a.sentence;
  const model = r.canRemove
    ? `${a.groups[0]} at the start; ${a.removed} crossed out; ${a.groups[0]! - a.removed} left`
    : `${a.groups[0]} in one group; ${a.groups[1]} in the other; ${a.groups[0]! + a.groups[1]!} in all`;
  return `${model}. ${x ?? "blank"} ${sign === "+" ? "plus" : sign === "-" ? "take away" : "blank"} ${y ?? "blank"} equals ${result ?? "blank"}.`;
}
/** Uniform independent choices of labelled group counts and sentence tiles.
 * There are 66 boards: ordered pairs with sum at most 10, or (start, removed)
 * with removed <= start. Each of three number slots has 11 choices and the
 * sign has two. A join can accept two color orders and two addend orders.
 * The public-only estimate uses that upper bound; it never assumes free input. */
export function counterBuilderGuessChance(
  r: CounterBuilderResponse,
  key?: string,
): number {
  const a = key === undefined ? null : parseCounterBuilder(r, key);
  const accepted = r.canRemove ? 1 : a && a.groups[0] === a.groups[1] ? 1 : 4;
  return accepted / (66 * 2 * 11 ** 3);
}

export function counterBuilderFeedback(
  r: CounterBuilderResponse,
  key: string,
  raw: string,
): string[] {
  if (gradeCounterBuilder(r, key, raw)) return [];
  const a = parseCounterBuilder(r, raw),
    expected = parseCounterBuilder(r, key);
  if (!a || !expected) return [];
  const [x, , y, result] =
    expected.sentence as CounterBuilderAnswer["sentence"];
  if (r.canRemove && a.groups[0] !== x)
    return [
      `Start with all ${x} ${r.thing}s. Keep each object visible when you cross it out.`,
    ];
  if (r.canRemove && a.removed !== y)
    return [
      `Cross out ${y}, the number going away. ${result} is the number left.`,
    ];
  if (
    !r.canRemove &&
    [...a.groups].sort((x, y) => x - y).join() !==
      [...expected.groups].sort((x, y) => x - y).join()
  )
    return [
      `Show both groups: ${x} and ${y}. A single group of ${result} shows only the total.`,
    ];
  return [
    r.canRemove
      ? `Your counters show the story. Build the sentence with ${x} at the start, minus ${y}, equals ${result}.`
      : `Your counters show the two groups. Join them with plus, then put ${result} after equals.`,
  ];
}
