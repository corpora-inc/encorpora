import { z } from "zod";
import { gradingKinds } from "../contracts.js";

/** The one shape every roster source produces and the reconciler reads: a
 * person, once, with the classes they belong to. Sources are pure functions
 * from a file to these rows; they know nothing about the database. */
export const rosterRoles = ["student", "teacher", "aide"] as const;
const name = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value));
const id = z.string().trim().min(1).max(200);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const rosterSession = z.strictObject({
  sourcedId: id,
  name,
  kind: z.enum(gradingKinds),
  startsOn: isoDate,
  endsOn: isoDate,
});
const rosterClass = z.strictObject({
  sourcedId: id,
  name,
  courseBands: z.array(z.string().trim().min(1).max(40)).max(20),
  gradingKind: z.enum(gradingKinds).optional(),
  session: rosterSession.optional(),
  year: rosterSession.optional(),
});
export const rosterRowSchema = z.strictObject({
  /** Where this came from in the file, so an error can point at it. */
  line: z.number().int().min(1),
  role: z.enum(rosterRoles),
  sourcedId: id,
  givenName: name,
  familyName: name.optional(),
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email())
    .transform((value) => value.toLowerCase())
    .optional(),
  identifier: z.string().trim().min(1).max(100).optional(),
  gradeLevel: z.number().int().min(0).max(13).optional(),
  classes: z.array(rosterClass).max(40),
});
export type RosterRow = z.infer<typeof rosterRowSchema>;
export type RosterClass = z.infer<typeof rosterClass>;
export type RosterSession = z.infer<typeof rosterSession>;

/** A row the source could read but not fully use. `missing_name` rows aren't in
 * `rows` until fixed; the others are, without the bad value. */
export type RosterIssue = {
  line: number;
  code: "missing_name" | "name_too_long" | "unknown_grade" | "invalid_email";
  /** What the file said. */
  value: string;
  /** Everything else usable on the row, so a fix can complete it. */
  row: Omit<RosterRow, "givenName"> & { givenName?: string };
};
export type SourceResult = {
  rows: RosterRow[];
  issues: RosterIssue[];
  /** People in the file AMP doesn't roster: parents, guardians, admins. */
  skipped: number;
  /** Rows marked for deletion, or otherwise not current. */
  inactive: number;
};

/* Reading names. Pure and forgiving: files are typed by people. */
const collapse = (value: string) =>
  value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export const cleanCell = collapse;
/** The same name however it was typed: case, accents and spacing don't count. */
export const nameKey = (value: string) =>
  collapse(value).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const PARTICLES = new Set([
  "al",
  "bin",
  "da",
  "de",
  "del",
  "der",
  "di",
  "dos",
  "du",
  "el",
  "la",
  "le",
  "st",
  "ter",
  "van",
  "von",
]);
/** "Last, First" and "First Last", and a student who goes by one name. A name
 * with a title stays whole: "Ms. Okafor" is what the class calls her. */
export function splitName(raw: string): {
  givenName: string;
  familyName?: string;
} {
  const value = collapse(raw);
  if (value.includes(",")) {
    const [family, ...given] = value.split(",");
    const first = collapse(given.join(" "));
    if (first && family?.trim())
      return { givenName: first, familyName: family.trim() };
    return { givenName: collapse(value.replace(/,/g, " ")) };
  }
  const words = value.split(" ");
  if (words.length === 1) return { givenName: value };
  if (/^(mr|mrs|ms|mx|dr|prof|coach)\.?$/i.test(words[0]!))
    return { givenName: value };
  let cut = words.length - 1;
  while (cut > 1 && PARTICLES.has(words[cut - 1]!.toLowerCase())) cut--;
  return {
    givenName: words.slice(0, cut).join(" "),
    familyName: words.slice(cut).join(" "),
  };
}

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  freshman: 9,
  sophomore: 10,
  junior: 11,
  senior: 12,
};
/** K is 0. Returns null when the value isn't a grade this product models. */
export function parseGrade(raw: string): number | null {
  const value = collapse(raw)
    .toLowerCase()
    .replace(/[.\-_]/g, "")
    .replace(/\bgrade\b|\bgr\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return null;
  if (
    /^(k|kg|kdg|kinder|kindergarten|tk|pk|prek|pre k|ps|pre ?school)$/.test(
      value,
    )
  )
    return 0;
  const word = ORDINALS[value];
  if (word !== undefined) return word;
  const match = /^g?0*(\d{1,2})(st|nd|rd|th)?$/.exec(value);
  if (!match) return null;
  const grade = Number(match[1]);
  return grade >= 0 && grade <= 13 ? grade : null;
}

/** What a course's grades mean as the curriculum's own bands. */
export function courseBandsFor(
  grades: readonly string[],
  title = "",
): string[] {
  const named = title.toLowerCase();
  const high = /algebra\s*(ii|2)/.test(named)
    ? "algebra-2"
    : /algebra/.test(named)
      ? "algebra-1"
      : /geometry/.test(named)
        ? "geometry"
        : /pre-?\s?calc/.test(named)
          ? "precalculus"
          : null;
  const bands = new Set<string>();
  for (const code of grades) {
    const grade = parseGrade(code);
    if (grade === null) continue;
    if (grade === 0) bands.add("K");
    else if (grade <= 8) bands.add(String(grade));
    else
      bands.add(
        high ??
          { 9: "algebra-1", 10: "geometry", 11: "algebra-2" }[grade] ??
          "precalculus",
      );
  }
  return [...bands];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const looksLikeEmail = (value: string) =>
  value.length <= 254 && EMAIL.test(value);
