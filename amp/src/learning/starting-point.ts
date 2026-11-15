/** A family preference for initial probes; it is not assessment evidence. */
export const startingBands = ["K–2", "3–5", "6–8", "9–12"] as const;
export type StartingBand = (typeof startingBands)[number];
/** Where an adult chooses to begin. An adult has no birth year, so this is
 * their whole starting estimate; practice adapts from the first answer. */
export const adultStarts = [
  "counting",
  "elementary",
  "middle-school",
  "algebra-1",
  "geometry",
  "algebra-2",
  "precalculus",
] as const;
export type AdultStart = (typeof adultStarts)[number];
/** An adult with no chosen start begins at late middle school (pre-algebra). */
export const UNCHOSEN_ADULT_START: AdultStart = "middle-school";
export const adultStartOrDefault = (start: unknown): AdultStart =>
  adultStarts.find((choice) => choice === start) ?? UNCHOSEN_ADULT_START;
/** Where an adult's own practice starts, in words. */
export const adultStartNames: Record<AdultStart, string> = {
  counting: "Counting",
  elementary: "Elementary",
  "middle-school": "Middle school",
  "algebra-1": "Algebra",
  geometry: "Geometry",
  "algebra-2": "Algebra 2",
  precalculus: "Precalculus",
};
/** The same start as an adult reads it in a sentence: the mathematics they
 * began with, never a grade they were placed in ("Began with middle-school
 * math", not "Starts at Middle school"). */
export const adultStartPhrases: Record<AdultStart, string> = {
  counting: "counting",
  elementary: "elementary math",
  "middle-school": "middle-school math",
  "algebra-1": "algebra",
  geometry: "geometry",
  "algebra-2": "Algebra 2",
  precalculus: "precalculus",
};
export type StartingChoice = StartingBand | AdultStart;
/** The youngest age at which an account holder practices as themselves;
 * anyone younger starts with a parent. A birth year alone can't rule out a
 * birthday still to come this year, so the year must make them this old
 * already on January 1. */
export const OWN_PRACTICE_MIN_AGE = 13;
export const ownPracticeAllowed = (birthYear: number, thisYear: number) =>
  thisYear - birthYear - 1 >= OWN_PRACTICE_MIN_AGE;

/** Grades a learner born in `birthYear` should have completed by `now`.
 * US school years begin in August; a child starts kindergarten the fall after
 * turning five, so someone born in 2016 has finished grade 3 by October 2026. */
export function completedGrade(birthYear: number, now = Date.now()): number {
  const date = new Date(now);
  const schoolYear = date.getUTCFullYear() - (date.getUTCMonth() < 7 ? 1 : 0);
  return schoolYear - birthYear - 7;
}
/** Whether a birth year is past high school by `now` (12 grades completed).
 * Age then says almost nothing about where someone's math is, so an adult
 * chooses where to begin (`adultStarts`) instead of starting from the year. */
export const pastSchoolAge = (birthYear: number, now = Date.now()) =>
  completedGrade(birthYear, now) >= 12;
/** The grade-axis level each starting choice opens at (`gradeNumber`: K = 0,
 * Algebra 1 = 9, Precalculus = 12). */
export const startingLevels: Record<StartingChoice, number> = {
  "K–2": 1,
  "3–5": 4,
  "6–8": 7,
  "9–12": 10,
  counting: 0,
  elementary: 3,
  "middle-school": 7,
  "algebra-1": 9,
  geometry: 10,
  "algebra-2": 11,
  precalculus: 12,
};
export type StartingPoint = {
  band: StartingChoice | null;
  policyVersion: 1 | null;
};

/** Server-owned enrollment snapshot; saved only on the first preference choice. */
export type PracticeStartingPoint = StartingPoint & {
  excludedStrands: string[];
};
