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
export type StartingChoice = StartingBand | AdultStart;
/** The youngest age at which an account holder practices as themselves;
 * anyone younger starts with a parent. A birth year alone can't rule out a
 * birthday still to come this year, so the year must make them this old
 * already on January 1. */
export const OWN_PRACTICE_MIN_AGE = 13;
export const ownPracticeAllowed = (birthYear: number, thisYear: number) =>
  thisYear - birthYear - 1 >= OWN_PRACTICE_MIN_AGE;
/** The grade-axis level each starting choice opens at (`gradeNumber`: K = 0,
 * Algebra 1 = 9, Precalculus = 12). */
export const startingLevels: Record<StartingChoice, number> = {
  "K–2": 1,
  "3–5": 4,
  "6–8": 7,
  "9–12": 10,
  counting: 0,
  elementary: 3,
  "middle-school": 6,
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
