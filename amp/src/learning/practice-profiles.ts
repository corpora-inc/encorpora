import { z } from "zod";

/**
 * Practice profiles (docs/families.md): an adult practices as someone else.
 * A profile is a grade and a pace, or a student's levels, turned into one
 * starting level per strand on the grade axis (`gradeNumber`: K = 0,
 * Algebra 1 = 9, Precalculus = 12). Practice adapts from there, as for any
 * learner. Shared by the server and the screens.
 */
export const MAX_PROFILE_LEVEL = 12;

/** Every strand a profile sets, in curriculum order: the elementary strands
 * first, so a young profile reads from the top. */
export const profileStrands = [
  "number",
  "operations",
  "measurement",
  "data",
  "geometry",
  "fractions",
  "decimals",
  "ratio",
  "algebra",
  "modeling",
  "probability",
  "functions",
  "reasoning",
  "trigonometry",
] as const;
export type ProfileStrand = (typeof profileStrands)[number];

export const profilePaces = ["behind", "on-level", "ahead"] as const;
export type ProfilePace = (typeof profilePaces)[number];
export const paceNames: Record<ProfilePace, string> = {
  behind: "Behind",
  "on-level": "On level",
  ahead: "Ahead",
};

/** Grades K to 12, as their numbers on the grade axis. */
export const profileGrades = Array.from(
  { length: MAX_PROFILE_LEVEL + 1 },
  (_, grade) => grade,
);

const ordinal = (n: number) =>
  `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
/** "Kindergarten", "4th grade", "9th grade". */
export function gradeTitle(grade: number) {
  return grade === 0 ? "Kindergarten" : `${ordinal(grade)} grade`;
}
/** The short form on a grade's button: "K", "4", "12". */
export const gradeShort = (grade: number) =>
  grade === 0 ? "K" : String(grade);
/** The course a high-school grade practices on the grade axis. */
export const gradeCourse = (grade: number): string | null =>
  ["Algebra 1", "Geometry", "Algebra 2", "Precalculus"][grade - 9] ?? null;

/** A level on the grade axis, as a strand's stepper reads it. */
export function levelName(level: number) {
  const at = Math.round(level);
  if (at <= 0) return "K";
  if (at <= 8) return `Grade ${at}`;
  return gradeCourse(at) ?? "Precalculus";
}

/** One grade's starting level at a pace: on level is the grade itself, and
 * behind or ahead is one grade lower or higher, within K to 12. */
export function paceLevel(grade: number, pace: ProfilePace) {
  const shift = pace === "behind" ? -1 : pace === "ahead" ? 1 : 0;
  return Math.max(0, Math.min(MAX_PROFILE_LEVEL, grade + shift));
}

export type ProfileLevels = Record<ProfileStrand, number>;
/** Every strand at one level. */
export function uniformLevels(level: number): ProfileLevels {
  return Object.fromEntries(
    profileStrands.map((strand) => [strand, level]),
  ) as ProfileLevels;
}
/** Where a profile's strands start, in a few words: "Grade 3", or "Grade 2
 * to Algebra 1" when they differ. */
export function levelsRange(levels: ProfileLevels) {
  const values = Object.values(levels);
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high
    ? levelName(low)
    : `${levelName(low)} to ${levelName(high)}`;
}
/** A grade and pace, filled into every strand. */
export const presetLevels = (grade: number, pace: ProfilePace) =>
  uniformLevels(paceLevel(grade, pace));
/** The name a grade and pace suggests: "4th grade · behind". */
export const presetLabel = (grade: number, pace: ProfilePace) =>
  `${gradeTitle(grade)} · ${paceNames[pace].toLowerCase()}`;

/** A whole level for each strand from fractional estimates: a strand with no
 * estimate of its own takes the overall level. */
export function roundedLevels(
  overall: number,
  strands: Partial<Record<string, number>>,
): ProfileLevels {
  const clamp = (level: number) =>
    Math.max(0, Math.min(MAX_PROFILE_LEVEL, Math.round(level)));
  return Object.fromEntries(
    profileStrands.map((strand) => [strand, clamp(strands[strand] ?? overall)]),
  ) as ProfileLevels;
}

export const PROFILE_LABEL_MAX = 60;
export const profileLabelSchema = z
  .string()
  .transform((value) => value.replace(/[\u0000-\u001f\u007f]/g, "").trim())
  .pipe(z.string().min(1).max(PROFILE_LABEL_MAX));
export const profileLevelsSchema = z.strictObject(
  Object.fromEntries(
    profileStrands.map((strand) => [
      strand,
      z.number().int().min(0).max(MAX_PROFILE_LEVEL),
    ]),
  ) as Record<ProfileStrand, z.ZodNumber>,
);

/** A saved profile as `/me` lists it: its label and its starting levels. */
export const practiceProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  levels: profileLevelsSchema,
});
export type PracticeProfile = z.infer<typeof practiceProfileSchema>;

/** `POST /api/v1/me/profiles`: a label and the starting levels. */
export const createProfileSchema = z.strictObject({
  label: profileLabelSchema,
  levels: profileLevelsSchema,
});
/** `PATCH /api/v1/me/profiles/:id`: a new label, new levels, or both. Only
 * the strands whose level changes start again. */
export const updateProfileSchema = z
  .strictObject({
    label: profileLabelSchema.optional(),
    levels: profileLevelsSchema.optional(),
  })
  .refine((value) => value.label !== undefined || value.levels !== undefined);
