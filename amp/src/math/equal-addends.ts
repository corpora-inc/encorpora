import { z } from "zod";
import { counterThings } from "./counter-builder";

const dimension = z.number().int().min(1).max(5);
/** Uniform UI choices: 5 addend values times 5 addend counts,
 * times 100 possible totals, times 25 boards when the array is built.
 * This conservative public bound includes both permitted orientations.
 * It is not a claim about how children choose their answers. */
export function equalAddendsGuessChance(r: {
  mode: "build" | "given";
  orientation: "rows" | "columns" | "either";
  rows?: number;
  columns?: number;
}): number {
  const accepted =
    r.orientation === "either" && (r.mode === "build" || r.rows !== r.columns)
      ? 2
      : 1;
  return accepted / (25 * 100 * (r.mode === "build" ? 25 : 1));
}
export const equalAddendsResponseSchema = z
  .object({
    kind: z.literal("equal-addends"),
    label: z.string().trim().min(1).max(100),
    mode: z.enum(["build", "given"]),
    orientation: z.enum(["rows", "columns", "either"]),
    thing: z.enum(counterThings),
    rows: dimension.optional(),
    columns: dimension.optional(),
    maxAddends: z.literal(5),
    guessChance: z.number().positive().max(1),
  })
  .strict()
  .refine(
    (r) =>
      (r.mode === "given"
        ? r.rows !== undefined && r.columns !== undefined
        : r.rows === undefined && r.columns === undefined) &&
      r.guessChance === equalAddendsGuessChance(r),
    "Only a given array includes dimensions; declare its guessing bound",
  );
export type EqualAddendsResponse = z.infer<typeof equalAddendsResponseSchema>;
const draftSchema = z
  .object({
    rows: dimension,
    columns: dimension,
    addends: z.array(dimension.nullable()).min(1).max(5),
    total: z.number().int().min(0).max(99).nullable(),
  })
  .strict();
export type EqualAddendsDraft = z.infer<typeof draftSchema>;
export type EqualAddendsAnswer = Omit<
  EqualAddendsDraft,
  "addends" | "total"
> & {
  addends: number[];
  total: number;
};
export function emptyEqualAddends(r: EqualAddendsResponse): EqualAddendsDraft {
  return {
    rows: r.rows ?? 1,
    columns: r.columns ?? 1,
    addends: [null, null],
    total: null,
  };
}
export function parseEqualAddends(
  r: EqualAddendsResponse,
  raw: string,
): EqualAddendsDraft | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const a = parsed.data;
    if (r.mode === "given" && (a.rows !== r.rows || a.columns !== r.columns))
      return null;
    return a;
  } catch {
    return null;
  }
}
/** Preserve mixed addends and arithmetic mistakes as valid first attempts. */
export function normalizeEqualAddends(
  r: EqualAddendsResponse,
  raw: string,
): string | null {
  const a = parseEqualAddends(r, raw);
  return !a || a.total === null || a.addends.includes(null)
    ? null
    : JSON.stringify(a);
}
export function equalAddendsFits(
  r: EqualAddendsResponse,
  a: EqualAddendsDraft,
): boolean {
  const rows =
    a.addends.length === a.rows && a.addends.every((n) => n === a.columns);
  const columns =
    a.addends.length === a.columns && a.addends.every((n) => n === a.rows);
  return (
    a.total === a.rows * a.columns &&
    ((r.orientation !== "columns" && rows) ||
      (r.orientation !== "rows" && columns))
  );
}
export function equalAddendsKeyFits(
  r: EqualAddendsResponse,
  key: string,
): boolean {
  const a = parseEqualAddends(r, key);
  return !!a && normalizeEqualAddends(r, key) === key && equalAddendsFits(r, a);
}
export function gradeEqualAddends(
  r: EqualAddendsResponse,
  key: string,
  raw: string,
): boolean {
  const a = parseEqualAddends(r, raw),
    expected = parseEqualAddends(r, key);
  return (
    !!a &&
    !!expected &&
    a.rows === expected.rows &&
    a.columns === expected.columns &&
    equalAddendsFits(r, a)
  );
}
export function equalAddendsAnswerText(
  r: EqualAddendsResponse,
  raw: string,
): string {
  const a = parseEqualAddends(r, raw) ?? emptyEqualAddends(r);
  return `${a.rows} ${a.rows === 1 ? "row" : "rows"} of ${a.columns}. ${a.addends.map((n) => n ?? "blank").join(" plus ")} equals ${a.total ?? "blank"}.`;
}
export function equalAddendsFeedback(
  r: EqualAddendsResponse,
  key: string,
  raw: string,
): string[] {
  if (gradeEqualAddends(r, key, raw)) return [];
  const a = parseEqualAddends(r, raw),
    expected = parseEqualAddends(r, key);
  if (!a || !expected) return [];
  if (a.rows !== expected.rows || a.columns !== expected.columns)
    return [
      `Build ${expected.rows} rows of ${expected.columns} to match the story.`,
    ];
  const columns =
    r.orientation === "columns" ||
    (r.orientation === "either" &&
      a.addends[0] === a.rows &&
      a.rows !== a.columns);
  const unit = columns ? "column" : "row",
    n = columns ? a.rows : a.columns,
    count = columns ? a.columns : a.rows;
  if (a.addends.some((v) => v !== n))
    return [`Each ${unit} has ${n}, so each addend is ${n}.`];
  if (a.addends.length !== count)
    return [`There are ${count} ${unit}s, so use ${count} addends.`];
  return [
    `Add one ${unit} at a time: ${Array.from({ length: count }, (_, i) => (i + 1) * n).join(", ")}.`,
  ];
}
