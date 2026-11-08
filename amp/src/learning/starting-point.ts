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
