import { createHash } from "node:crypto";
import { z } from "zod";
import type { Allocation, GradeCurve } from "./grade-curve.js";

/**
 * The suggested grade: a range from four components, with fixed defaults. The
 * teacher decides the grade; this explains what the evidence supports.
 *
 * Percent correct is the wrong grade, because AMP serves harder work as students
 * succeed. So this file reads levels, objectives, time and review outcomes, and
 * never reads a count of attempts or how many were right outside spaced review.
 * On-screen practice is measured in active minutes; a problem counts only where
 * no time could be measured (paper), so answering faster or more often can't
 * move a suggestion.
 */
const points = z.number().finite().min(0).max(100);
const positive = z.number().finite().positive().max(10_000);
const share = z.number().finite().min(0).max(1);
const count = z.number().int().min(0).max(100_000);

export const gradePolicySchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    version: z.string().min(1).max(100),
    weights: z.strictObject({
      course: points,
      growth: points,
      practice: points,
      retention: points,
    }),
    course: z.strictObject({
      /** The score for a strand exactly where the calendar says it should be. */
      onPaceScore: points,
      /** How many grades ahead reaches 100. */
      aheadFullGrades: positive,
      /** Points lost per grade behind. */
      behindPerGrade: positive,
      floor: points,
    }),
    growth: z.strictObject({
      gradesPerYear: positive,
      onPaceScore: points,
      /** How many times the pace reaches 100. */
      fullAtPace: positive,
      floor: points,
      /** Roughly how many of the catalog's objectives make up one grade. */
      objectivesPerGrade: positive,
      /** Levels gained against objectives gained; the rest is objectives. */
      levelShare: share,
      /** Direct, independent successes on a skill that demonstrate it. */
      demonstratedSuccesses: z.number().int().min(1).max(20),
      /** An objective below this far under the term-start level is ground
       * already held, however late it was first shown. */
      objectiveReach: z.number().finite().min(0).max(13),
      /** A few days' noise in a level estimate mustn't read as a huge multiple
       * of the pace, so the pace is capped and, until there are this many days
       * of it, held toward on-pace. */
      maximumPace: positive,
      steadyDays: positive,
      fallbackYearDays: positive,
    }),
    practice: z.strictObject({
      /** Credit for a problem on a day with no measured time. */
      minutesPerUnmeasuredProblem: positive,
      /** Used only when no target is set and no one in the class has worked. */
      fallbackWeeklyMinutes: positive,
    }),
    retention: z.strictObject({
      /** Pulls a few reviews toward a typical result rather than 0 or 100. */
      priorShare: share,
      priorReviews: count,
      /** Below this many reviews a share is noise, so it doesn't count. */
      minimumReviews: count,
    }),
    evidence: z.strictObject({
      minimumActiveDays: count,
      minimumMinutes: count,
      /** Past these the range stops narrowing for more work. */
      fullActiveDays: positive,
      fullMinutes: positive,
    }),
    range: z.strictObject({
      minimumHalfWidth: points,
      /** Points per grade of uncertainty in the level estimates. */
      sdWeight: z.number().finite().min(0).max(100),
      /** Points added when there is as little evidence as allowed. */
      evidenceWeight: points,
      maximumHalfWidth: points,
    }),
    letters: z
      .array(z.strictObject({ letter: z.string().min(1).max(4), min: points }))
      .min(2)
      .max(20),
    today: z.strictObject({
      maximumTodos: z.number().int().min(1).max(20),
      maximumSharedGaps: z.number().int().min(1).max(10),
      maximumStuck: z.number().int().min(1).max(10),
      /** How far back a miss still counts as the current state. */
      recentDays: z.number().int().min(1).max(120),
      sharedGapStudents: z.number().int().min(2).max(100),
      sharedGapMisses: z.number().int().min(1).max(5),
      stuckMisses: z.number().int().min(1).max(5),
      readyMinimumReviews: count,
      readyReviewShare: share,
      /** How many grades past the course counts as past it. */
      readyMargin: z.number().finite().min(0).max(5),
      goodDayShare: share,
      goodDayStudents: z.number().int().min(1).max(100),
    }),
  })
  .superRefine((policy, ctx) => {
    const { course, growth, practice, retention } = policy.weights;
    if (course + growth + practice + retention !== 100)
      ctx.addIssue({
        code: "custom",
        path: ["weights"],
        message: "Weights must add up to 100",
      });
    if (policy.letters.at(-1)?.min !== 0)
      ctx.addIssue({
        code: "custom",
        path: ["letters"],
        message: "The last letter must start at 0",
      });
    if (
      policy.letters.some(
        (entry, index, all) => index > 0 && entry.min >= all[index - 1]!.min,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["letters"],
        message: "Letters run from highest to lowest",
      });
    if (policy.range.minimumHalfWidth > policy.range.maximumHalfWidth)
      ctx.addIssue({
        code: "custom",
        path: ["range"],
        message: "The narrowest range exceeds the widest",
      });
    if (policy.growth.fullAtPace <= 1)
      ctx.addIssue({
        code: "custom",
        path: ["growth", "fullAtPace"],
        message: "Full growth must be past the pace",
      });
  });
export type GradeParameters = z.infer<typeof gradePolicySchema>;
type Frozen<T> = T extends object
  ? { readonly [K in keyof T]: Frozen<T[K]> }
  : T;
export type GradePolicy = Frozen<GradeParameters> & {
  readonly fingerprint: string;
};
const compiled = new WeakSet<object>();
function freeze<T>(value: T): Frozen<T> {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as Frozen<T>;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, canonical(child)]),
    );
  return value;
}
/** Compile once per service, never mutate the defaults. A closed term stores
 * this policy's version beside its inputs. */
export function createGradePolicy(input: unknown): GradePolicy {
  const parameters = gradePolicySchema.parse(input);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(canonical(parameters)))
    .digest("hex");
  const policy = freeze({ ...parameters, fingerprint });
  compiled.add(policy);
  return policy;
}
export function assertGradePolicy(policy: GradePolicy): void {
  if (!compiled.has(policy))
    throw new Error("Use createGradePolicy to validate grade parameters");
}

export const DEFAULT_GRADE_POLICY = createGradePolicy({
  schemaVersion: 1,
  version: "school-grades-v4",
  weights: { course: 40, growth: 30, practice: 20, retention: 10 },
  course: {
    onPaceScore: 84,
    aheadFullGrades: 1,
    behindPerGrade: 17.5,
    floor: 40,
  },
  growth: {
    gradesPerYear: 1,
    onPaceScore: 84,
    fullAtPace: 1.35,
    floor: 30,
    objectivesPerGrade: 22,
    levelShare: 0.5,
    demonstratedSuccesses: 2,
    objectiveReach: 1,
    maximumPace: 2,
    steadyDays: 30,
    fallbackYearDays: 304,
  },
  practice: { minutesPerUnmeasuredProblem: 1, fallbackWeeklyMinutes: 60 },
  retention: { priorShare: 0.8, priorReviews: 3, minimumReviews: 10 },
  evidence: {
    minimumActiveDays: 2,
    minimumMinutes: 20,
    fullActiveDays: 12,
    fullMinutes: 240,
  },
  range: {
    minimumHalfWidth: 1.5,
    sdWeight: 3,
    evidenceWeight: 5,
    maximumHalfWidth: 10,
  },
  letters: [
    { letter: "A+", min: 97 },
    { letter: "A", min: 93 },
    { letter: "A−", min: 90 },
    { letter: "B+", min: 87 },
    { letter: "B", min: 83 },
    { letter: "B−", min: 80 },
    { letter: "C+", min: 77 },
    { letter: "C", min: 73 },
    { letter: "C−", min: 70 },
    { letter: "D+", min: 67 },
    { letter: "D", min: 63 },
    { letter: "D−", min: 60 },
    { letter: "F", min: 0 },
  ],
  today: {
    maximumTodos: 5,
    maximumSharedGaps: 2,
    maximumStuck: 1,
    recentDays: 14,
    sharedGapStudents: 3,
    sharedGapMisses: 2,
    stuckMisses: 3,
    readyMinimumReviews: 3,
    readyReviewShare: 0.8,
    readyMargin: 0,
    goodDayShare: 0.5,
    goodDayStudents: 3,
  },
} satisfies GradeParameters);

/** A serializable mutable copy for deriving another version. */
export function gradeParameters(
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): GradeParameters {
  assertGradePolicy(policy);
  const { fingerprint: _, ...parameters } = policy;
  return structuredClone(parameters) as GradeParameters;
}

const DAY = 86_400_000;
const time = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** Whole days from `from` through `to`, counting both. */
export const daysIn = ({ from, to }: { from: string; to: string }) =>
  Math.max(0, Math.round((time(to) - time(from)) / DAY) + 1);
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

export type Estimate = { level: number; sd: number };
export type StudentLevel = {
  overall: Estimate;
  strands: Record<string, Estimate>;
};
export type CourseBand = { from: number; to: number };

/** What happened in the enrolled days. A rollup's `problems`, `correct` and
 * `independent` are here so a test can prove they change nothing: no score
 * reads them, and evidence sentences show `problems` only as a fact. */
export type GradeActivity = {
  activeMinutes: number;
  /** Problems on days with no measured time. */
  unmeasuredProblems: number;
  daysActive: number;
  review: number;
  reviewIndependent: number;
  problems: number;
  correct: number;
  independent: number;
};
export type GradeInput = {
  /** One child alone, or a class of one with no target: nothing to measure a
   * letter against, so the facts show without one. */
  factsOnly?: boolean;
  /** The school year the term sits in. Pace runs across it. */
  year: { from: string; to: string };
  /** The term's enrolled days up to today: all that ever counts. */
  enrolled: { from: string; to: string };
  /** The course on the level axis. Null grades against the student's own level. */
  course: CourseBand | null;
  gradeLevel: number | null;
  /** The level on the first settled day, and the latest within the term. */
  start: StudentLevel | null;
  end: StudentLevel | null;
  /**
   * Growth from `termGrowth` (`growth.ts`). Null means the estimate has not
   * settled, so there is no level gain. Absent only for a caller that still
   * passes two levels and wants their difference.
   */
  termGrowth?: { mu: number; sd: number } | null;
  objectivesGained: number;
  activity: GradeActivity;
  weeklyTargetMinutes: number | null;
  classMedianWeeklyMinutes: number | null;
};

export const gradeComponentIds = [
  "course",
  "growth",
  "practice",
  "retention",
] as const;
export type GradeComponentId = (typeof gradeComponentIds)[number];
export type GradeComponent =
  | {
      id: "course";
      weight: number;
      score: number | null;
      /** Where the strands are on the whole, and where the calendar says. */
      workingLevel: number | null;
      expectedLevel: number | null;
      ownGrade: boolean;
    }
  | {
      id: "growth";
      weight: number;
      score: number | null;
      objectivesGained: number;
      levelsGained: number | null;
    }
  | {
      id: "practice";
      weight: number;
      score: number | null;
      weeklyMinutes: number;
      targetMinutes: number;
      against: "target" | "class" | "typical";
      problems: number;
    }
  | {
      id: "retention";
      weight: number;
      score: number | null;
      /** Null below the policy's minimum of reviews. */
      reviewShare: number | null;
      reviews: number;
      reviewsRight: number;
    };
/** What a teacher's curve made of a suggestion (`curve-grades.ts`), frozen with
 * it when the term closes. */
export type CurveResult = {
  /** The curve as the teacher set it. */
  teacher: GradeCurve;
  /** Students ranked: those with enough work. */
  ranked: number;
  /** The 80% interval of this student's place, 1 the highest composite. */
  rankLow: number;
  rankHigh: number;
  /** The share of draws that gave each letter. */
  letters: Allocation;
  /** The range on the standard scale, which the curve replaced. */
  standard: { low: number; high: number };
};
export type GradeSuggestion = {
  /** "facts-only": enough work, and no letter (`GradeInput.factsOnly`). */
  status: "ready" | "not-enough-work" | "facts-only";
  low: number | null;
  high: number | null;
  letterLow: string | null;
  letterHigh: string | null;
  components: GradeComponent[];
  /** Every number the result came from, so a frozen grade explains itself. */
  inputs: Omit<GradeInput, "activity" | "start" | "end"> & {
    activeMinutes: number;
    unmeasuredProblems: number;
    daysActive: number;
    review: number;
    reviewIndependent: number;
    startLevel: Estimate | null;
    endLevel: Estimate | null;
  };
  policyVersion: string;
  /** Present when the teacher's curve set the range. */
  curve?: CurveResult;
};

export function letterFor(
  score: number,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): string {
  return policy.letters.find((entry) => score >= entry.min)!.letter;
}

/** Minutes a week across the enrolled days. This is what practice compares,
 * and what a class median is taken over. */
export function weeklyMinutes(
  input: Pick<GradeInput, "enrolled" | "activity">,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): number {
  const weeks = Math.max(1, daysIn(input.enrolled) / 7);
  const minutes =
    input.activity.activeMinutes +
    input.activity.unmeasuredProblems *
      policy.practice.minutesPerUnmeasuredProblem;
  return minutes / weeks;
}

/** Where the calendar puts a course on a day: its low edge when the year
 * opens, its high edge when it closes. */
export function expectedLevel(
  year: GradeInput["year"],
  on: string,
  course: CourseBand,
): number {
  const total = Math.max(1, daysIn(year) - 1);
  const elapsed = clamp(daysIn({ from: year.from, to: on }) - 1, 0, total);
  return course.from + (course.to - course.from) * (elapsed / total);
}

/** Which ground this student is graded against: the class's course, else their
 * own grade. */
const referenceFor = (input: GradeInput): CourseBand | null =>
  input.course ??
  (input.gradeLevel === null
    ? null
    : { from: input.gradeLevel - 0.5, to: input.gradeLevel + 0.5 });

function courseScore(
  input: GradeInput,
  end: StudentLevel,
  policy: GradePolicy,
): { score: number; working: number; expected: number } {
  const { onPaceScore, aheadFullGrades, behindPerGrade, floor } = policy.course;
  const reference = referenceFor(input);
  const expected = reference
    ? expectedLevel(input.year, input.enrolled.to, reference)
    : (input.start ?? end).overall.level;
  const strands = Object.values(end.strands);
  const estimates = strands.length ? strands : [end.overall];
  // A strand with few answers still has a wide estimate, so it weighs little.
  const precision = (estimate: Estimate) => 1 / Math.max(estimate.sd, 0.1) ** 2;
  let total = 0,
    scored = 0,
    working = 0;
  for (const estimate of estimates) {
    const gap = estimate.level - expected;
    const score =
      gap >= 0
        ? Math.min(
            100,
            onPaceScore + ((100 - onPaceScore) * gap) / aheadFullGrades,
          )
        : Math.max(floor, onPaceScore + gap * behindPerGrade);
    const weight = precision(estimate);
    total += weight;
    scored += weight * score;
    working += weight * estimate.level;
  }
  return { score: scored / total, working: working / total, expected };
}

function growthScore(input: GradeInput, policy: GradePolicy) {
  const { growth } = policy;
  const yearDays = daysIn(input.year) || growth.fallbackYearDays;
  const days = daysIn(input.enrolled);
  const expected = Math.max(0.001, (growth.gradesPerYear * days) / yearDays);
  // Shown as it is, either sign; a level lower than at the start scores as no
  // gain, never below it, since two estimates a term apart carry noise.
  const levelsGained =
    input.termGrowth !== undefined
      ? (input.termGrowth?.mu ?? null)
      : input.start && input.end
        ? input.end.overall.level - input.start.overall.level
        : null;
  const capped = (pace: number) => Math.min(growth.maximumPace, pace);
  const observed =
    growth.levelShare * capped(Math.max(0, levelsGained ?? 0) / expected) +
    (1 - growth.levelShare) *
      capped(input.objectivesGained / (growth.objectivesPerGrade * expected));
  const pace =
    (observed * days + growth.steadyDays) / (days + growth.steadyDays);
  const score =
    pace <= 1
      ? growth.floor + (growth.onPaceScore - growth.floor) * pace
      : Math.min(
          100,
          growth.onPaceScore +
            ((100 - growth.onPaceScore) * (pace - 1)) / (growth.fullAtPace - 1),
        );
  return { score, levelsGained };
}

function practiceScore(input: GradeInput, policy: GradePolicy) {
  const weekly = weeklyMinutes(input, policy);
  const target = input.weeklyTargetMinutes ?? input.classMedianWeeklyMinutes;
  const against: "target" | "class" | "typical" = input.weeklyTargetMinutes
    ? "target"
    : input.classMedianWeeklyMinutes
      ? "class"
      : "typical";
  const targetMinutes = target || policy.practice.fallbackWeeklyMinutes;
  return {
    score: Math.min(100, (100 * weekly) / targetMinutes),
    weekly,
    targetMinutes,
    against,
  };
}

function retentionScore(input: GradeInput, policy: GradePolicy) {
  const { review, reviewIndependent } = input.activity;
  const { priorShare, priorReviews, minimumReviews } = policy.retention;
  if (review === 0 || review < minimumReviews)
    return { score: null, share: null };
  return {
    score:
      (100 * (reviewIndependent + priorShare * priorReviews)) /
      (review + priorReviews),
    share: reviewIndependent / review,
  };
}

const hasEnoughWork = (input: GradeInput, policy: GradePolicy) => {
  const { minimumActiveDays, minimumMinutes } = policy.evidence;
  const { activity } = input;
  return (
    input.end !== null &&
    activity.daysActive >= minimumActiveDays &&
    activity.activeMinutes +
      activity.unmeasuredProblems *
        policy.practice.minutesPerUnmeasuredProblem >=
      minimumMinutes
  );
};

/** The share of spaced reviews right on its own, as a Beta distribution over
 * what the student would get right: the same prior the retention score uses,
 * so its mean is that score. Null where reviews don't count yet. */
export function retentionPosterior(
  input: Pick<GradeInput, "activity">,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): { right: number; wrong: number } | null {
  const { review, reviewIndependent } = input.activity;
  const { priorShare, priorReviews, minimumReviews } = policy.retention;
  if (review === 0 || review < minimumReviews) return null;
  return {
    right: reviewIndependent + priorShare * priorReviews,
    wrong: review - reviewIndependent + (1 - priorShare) * priorReviews,
  };
}

/** One draw of what a suggestion is uncertain about: the levels, and the share
 * of reviews right. Everything else is counted, not estimated. */
export type CompositeDraw = {
  start: StudentLevel | null;
  end: StudentLevel;
  /** Null where reviews don't count, as in the suggestion. */
  retentionShare: number | null;
};
/** One student's composite as a function of the estimates alone, with the
 * calendar, counts and weights worked out once: the suggestion's own scorers,
 * fast enough to run a thousand times a student. */
export type CompositeModel = {
  /** The estimates the course score reads: each strand, else the overall. */
  strands: readonly Estimate[];
  start: Estimate | null;
  end: Estimate;
  /** Reviews right, as a Beta; null where reviews don't count. */
  retention: { right: number; wrong: number } | null;
  /** Set when the shared pace supplied the growth. Null: not settled. */
  termGrowth?: { mu: number; sd: number } | null;
  score(
    strandLevels: ArrayLike<number>,
    startLevel: number | null,
    endLevel: number,
    retentionShare: number | null,
    /** A draw of the shared pace. Absent: use the two levels. */
    growthGain?: number,
  ): number;
};
export function compositeModel(
  input: GradeInput & { end: StudentLevel },
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): CompositeModel {
  const { weights, course, growth } = policy;
  const strands = Object.values(input.end.strands);
  const estimates = strands.length ? strands : [input.end.overall];
  const precision = estimates.map(
    (estimate) => 1 / Math.max(estimate.sd, 0.1) ** 2,
  );
  const totalPrecision = precision.reduce((sum, value) => sum + value, 0);
  const reference = referenceFor(input);
  const fixedExpected = reference
    ? expectedLevel(input.year, input.enrolled.to, reference)
    : null;
  const yearDays = daysIn(input.year) || growth.fallbackYearDays;
  const days = daysIn(input.enrolled);
  const expectedGain = Math.max(
    0.001,
    (growth.gradesPerYear * days) / yearDays,
  );
  const capped = (pace: number) => Math.min(growth.maximumPace, pace);
  const objectivePace = capped(
    input.objectivesGained / (growth.objectivesPerGrade * expectedGain),
  );
  const practice = practiceScore(input, policy).score;
  return {
    strands: estimates,
    start: input.start?.overall ?? null,
    end: input.end.overall,
    retention: retentionPosterior(input, policy),
    termGrowth: input.termGrowth,
    score(strandLevels, startLevel, endLevel, retentionShare, growthGain) {
      // As courseScore: without a course, the student's own start.
      const expected = fixedExpected ?? startLevel ?? endLevel;
      let scored = 0;
      for (let i = 0; i < estimates.length; i++) {
        const gap = strandLevels[i]! - expected;
        scored +=
          precision[i]! *
          (gap >= 0
            ? Math.min(
                100,
                course.onPaceScore +
                  ((100 - course.onPaceScore) * gap) / course.aheadFullGrades,
              )
            : Math.max(
                course.floor,
                course.onPaceScore + gap * course.behindPerGrade,
              ));
      }
      const courseScore = scored / totalPrecision;
      // As growthScore.
      const gained =
        growthGain !== undefined
          ? Math.max(0, growthGain)
          : startLevel === null
            ? 0
            : Math.max(0, endLevel - startLevel);
      const observed =
        growth.levelShare * capped(gained / expectedGain) +
        (1 - growth.levelShare) * objectivePace;
      const pace =
        (observed * days + growth.steadyDays) / (days + growth.steadyDays);
      const growthScore =
        pace <= 1
          ? growth.floor + (growth.onPaceScore - growth.floor) * pace
          : Math.min(
              100,
              growth.onPaceScore +
                ((100 - growth.onPaceScore) * (pace - 1)) /
                  (growth.fullAtPace - 1),
            );
      let total =
        weights.course * courseScore +
        weights.growth * growthScore +
        weights.practice * practice;
      let carried = weights.course + weights.growth + weights.practice;
      if (retentionShare !== null) {
        total += weights.retention * 100 * retentionShare;
        carried += weights.retention;
      }
      return total / carried;
    },
  };
}
/** The composite for one draw (the model, from whole levels). */
export function compositeScore(
  input: GradeInput,
  draw: CompositeDraw,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): number {
  const model = compositeModel({ ...input, end: draw.end }, policy);
  const strands = Object.values(draw.end.strands);
  return model.score(
    (strands.length ? strands : [draw.end.overall]).map((e) => e.level),
    draw.start?.overall.level ?? null,
    draw.end.overall.level,
    draw.retentionShare,
    input.termGrowth === undefined ? undefined : (input.termGrowth?.mu ?? 0),
  );
}

/** How wide the range is: from how sure the level estimates are, and how much
 * work there is to go on. Neither reads a count of attempts. */
function halfWidth(
  input: GradeInput,
  end: StudentLevel,
  policy: GradePolicy,
): number {
  const { range, evidence, practice } = policy;
  const estimates = [end.overall, ...Object.values(end.strands)];
  // Weighted as the score is, so a strand with few answers doesn't widen a range
  // it hardly moves.
  const precision = (estimate: Estimate) => 1 / Math.max(estimate.sd, 0.1) ** 2;
  const sd = Math.min(
    2,
    estimates.reduce((sum, e) => sum + precision(e) * e.sd, 0) /
      estimates.reduce((sum, e) => sum + precision(e), 0),
  );
  const minutes =
    input.activity.activeMinutes +
    input.activity.unmeasuredProblems * practice.minutesPerUnmeasuredProblem;
  const enough =
    (Math.min(1, input.activity.daysActive / evidence.fullActiveDays) +
      Math.min(1, minutes / evidence.fullMinutes)) /
    2;
  return clamp(
    range.minimumHalfWidth +
      range.sdWeight * sd +
      range.evidenceWeight * (1 - enough),
    range.minimumHalfWidth,
    range.maximumHalfWidth,
  );
}

/** One student's suggested range for one term. Pure. Below the minimum of
 * evidence the answer is "not enough work", never a low grade. */
export function suggestGrade(
  input: GradeInput,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): GradeSuggestion {
  assertGradePolicy(policy);
  const { weights } = policy;
  const activity = input.activity;
  const practice = practiceScore(input, policy);
  const retention = retentionScore(input, policy);
  const { score: growthRaw, levelsGained } = growthScore(input, policy);
  const inputs: GradeSuggestion["inputs"] = {
    year: input.year,
    enrolled: input.enrolled,
    course: input.course,
    gradeLevel: input.gradeLevel,
    objectivesGained: input.objectivesGained,
    weeklyTargetMinutes: input.weeklyTargetMinutes,
    classMedianWeeklyMinutes: input.classMedianWeeklyMinutes,
    activeMinutes: activity.activeMinutes,
    unmeasuredProblems: activity.unmeasuredProblems,
    daysActive: activity.daysActive,
    review: activity.review,
    reviewIndependent: activity.reviewIndependent,
    startLevel: input.start
      ? { level: input.start.overall.level, sd: input.start.overall.sd }
      : null,
    endLevel: input.end
      ? { level: input.end.overall.level, sd: input.end.overall.sd }
      : null,
  };
  const ready = hasEnoughWork(input, policy);
  const end = input.end;
  const course = ready && end ? courseScore(input, end, policy) : null;
  const shown = (score: number | null) =>
    ready && score !== null ? Math.round(score) : null;
  const components: GradeComponent[] = [
    {
      id: "course",
      weight: weights.course,
      score: shown(course?.score ?? null),
      workingLevel: course ? round1(course.working) : null,
      expectedLevel: course ? round1(course.expected) : null,
      ownGrade: input.course === null,
    },
    {
      id: "growth",
      weight: weights.growth,
      score: shown(growthRaw),
      objectivesGained: input.objectivesGained,
      levelsGained: levelsGained === null ? null : round1(levelsGained),
    },
    {
      id: "practice",
      weight: weights.practice,
      score: shown(practice.score),
      weeklyMinutes: Math.round(practice.weekly),
      targetMinutes: Math.round(practice.targetMinutes),
      against: practice.against,
      problems: activity.problems,
    },
    {
      id: "retention",
      weight: weights.retention,
      score: shown(retention.score),
      reviewShare: retention.share,
      reviews: activity.review,
      reviewsRight: activity.reviewIndependent,
    },
  ];
  if (!ready || !course || !end)
    return {
      status: "not-enough-work",
      low: null,
      high: null,
      letterLow: null,
      letterHigh: null,
      components,
      inputs,
      policyVersion: policy.version,
    };
  // No review has come due: the other three carry the whole range, so a
  // schedule the student doesn't control can't lower it.
  const parts = [
    { weight: weights.course, score: course.score },
    { weight: weights.growth, score: growthRaw },
    { weight: weights.practice, score: practice.score },
    ...(retention.score === null
      ? []
      : [{ weight: weights.retention, score: retention.score }]),
  ];
  const carried = parts.reduce((sum, part) => sum + part.weight, 0);
  const middle =
    parts.reduce((sum, part) => sum + part.weight * part.score, 0) / carried;
  if (input.factsOnly)
    return {
      status: "facts-only",
      low: null,
      high: null,
      letterLow: null,
      letterHigh: null,
      components,
      inputs,
      policyVersion: policy.version,
    };
  const half = halfWidth(input, end, policy);
  const low = clamp(Math.round(middle - half), 0, 100);
  const high = clamp(Math.round(middle + half), 0, 100);
  return {
    status: "ready",
    low,
    high,
    letterLow: letterFor(low, policy),
    letterHigh: letterFor(high, policy),
    components,
    inputs,
    policyVersion: policy.version,
  };
}

/** Components as a screen or export shows them: a suggestion with no letter
 * shows its facts and no scores. */
export function shownComponents(
  suggestion: Pick<GradeSuggestion, "status" | "components">,
): GradeComponent[] {
  return suggestion.status === "facts-only"
    ? suggestion.components.map((component) => ({ ...component, score: null }))
    : suggestion.components;
}

/** The range in words: "B to A−", or one letter when both ends agree. */
export function rangeLetters(
  suggestion: Pick<GradeSuggestion, "letterLow" | "letterHigh">,
): string | null {
  const { letterLow, letterHigh } = suggestion;
  if (!letterLow || !letterHigh) return null;
  return letterLow === letterHigh ? letterLow : `${letterLow} to ${letterHigh}`;
}

/** A level in a teacher's words. */
function levelWords(level: number): string {
  if (level < 1) return "kindergarten level";
  return level < 9 ? `grade ${level.toFixed(1)}` : `level ${level.toFixed(1)}`;
}
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
/** A count of problems is a fact worth stating only once it isn't a small one. */
const PROBLEMS_WORTH_STATING = 100;
const timesWords = (count: number) =>
  count === 1 ? "once" : count === 2 ? "twice" : `${count} times`;
/** What a grade counts as an objective, as it is: "6 skills shown twice on
 * their own". */
export function skillsShownWords(
  count: number,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): string {
  return `${plural(count, "skill")} shown ${timesWords(policy.growth.demonstratedSuccesses)} on ${count === 1 ? "its" : "their"} own`;
}
/** A signed change of level: "0.3 grades gained", "0.2 grades lower". */
export function levelChangeWords(change: number): string {
  const size = Math.abs(change).toFixed(1);
  return change <= -0.05
    ? `a level ${size} grades lower than at the start`
    : `${size} grades gained`;
}

/** Each component in one sentence, for the evidence sheet and report cards. */
export function componentSentence(component: GradeComponent): string {
  if (component.score === null && component.id !== "retention")
    return "Not enough work yet to say.";
  switch (component.id) {
    case "course": {
      const { workingLevel, expectedLevel: expected, ownGrade } = component;
      return `Working around ${levelWords(workingLevel!)}, against ${levelWords(expected!)} for this point in ${ownGrade ? "their own grade" : "the course"}.`;
    }
    case "growth": {
      const { objectivesGained, levelsGained } = component;
      const objectives = skillsShownWords(objectivesGained);
      return levelsGained === null
        ? `${objectives} this term. The level has not settled yet.`
        : `${objectives}, and ${levelChangeWords(levelsGained)}, this term.`;
    }
    case "practice": {
      const { weeklyMinutes: minutes, targetMinutes, against } = component;
      const measure =
        against === "target"
          ? `${minutes} active minutes a week, against a target of ${targetMinutes}`
          : against === "class"
            ? `${minutes} active minutes a week, against a class median of ${targetMinutes}`
            : `${minutes} active minutes a week`;
      return component.problems >= PROBLEMS_WORTH_STATING
        ? `${measure}, ${component.problems.toLocaleString("en-US")} problems so far.`
        : `${measure}.`;
    }
    case "retention": {
      const { reviews, reviewsRight, reviewShare } = component;
      // A term closed before counts were kept says what it said then.
      if (reviews === undefined)
        return reviewShare === null
          ? "No spaced review has come due yet, so this doesn’t count toward the range."
          : `${Math.round(reviewShare * 100)}% of spaced reviews right without help.`;
      if (reviews === 0)
        return "No spaced review has come due yet, so this doesn’t count toward the range.";
      const counted = `${reviewsRight} of ${plural(reviews, "spaced review")} right without help`;
      return reviewShare === null
        ? `${counted}: too few yet to count toward the range.`
        : `${counted} (${Math.round(reviewShare * 100)}%).`;
    }
  }
}
