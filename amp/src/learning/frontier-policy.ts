import { z } from "zod";

const variance = z.number().finite().min(0).max(10);
const drift = z
  .object({
    perAnswer: variance,
    perDay: variance,
    surpriseCorrect: variance,
    surpriseIncorrect: variance,
  })
  .strict();
const response = z
  .object({
    typedGuess: z.number().finite().min(0).max(0.2),
    slip: z.number().finite().min(0.01).max(0.3),
    atLevelSuccess: z.number().finite().min(0.3).max(0.9),
    discrimination: z.number().finite().min(0.1).max(5),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.atLevelSuccess <= value.typedGuess ||
      value.atLevelSuccess >= 1 - value.slip
    )
      ctx.addIssue({
        code: "custom",
        path: ["atLevelSuccess"],
        message:
          "At-level success must lie between the guess floor and slip ceiling",
      });
  });

/** Editorial grade-estimate parameters, separate from practice exposure weights.
 * Bounds protect computation. These are not population-calibrated norms: item
 * difficulties are not fitted to real students, and there is no external norm.
 * Reported uncertainty is a separate scale on the posterior sd
 * (`frontier-report.ts`), fit to a misspecified synthetic learner. */
export const frontierPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    version: z.string().min(1).max(100),
    prior: z
      .object({
        overallSd: z.number().finite().min(0.1).max(10),
        strandSd: z.number().finite().min(0.1).max(10),
        /** The overall prior sd for a start set by age (a birth year), by
         * starting grade: `[start, sd]` in rising start order, linearly
         * interpolated, held flat past either end. It sets the overall
         * readout's prior only; selection's pooled estimate keeps
         * `overallSd`. A start someone chose (an adult's start, a family
         * band, a restarted area) keeps `overallSd`, and so does every start
         * when this is absent. */
        sdByStart: z
          .array(
            z
              .tuple([
                z.number().finite().min(-1).max(13),
                z.number().finite().min(0.1).max(10),
              ])
              .readonly(),
          )
          .min(1)
          .max(20)
          .refine(
            (knots) =>
              knots.every((k, i) => i === 0 || k[0] > knots[i - 1]![0]),
            "Starts must rise",
          )
          .readonly()
          .optional(),
      })
      .strict(),
    response,
    strandResponse: response,
    overall: drift,
    strand: drift,
    surpriseThreshold: z.number().finite().min(0.5).max(1),
    maxDriftDays: z.number().finite().min(0).max(365),
    assisted: z
      .object({
        treatAsFailure: z.boolean(),
        correctWeight: z.number().finite().min(0).max(1),
        incorrectWeight: z.number().finite().min(0).max(1),
      })
      .strict(),
    confirmation: z
      .object({
        enabled: z.boolean(),
        /** How far working practice may reach: above the start, at least;
         * above the highest grade shown once placed; and above it while still
         * climbing (`Frontier.climbing`). */
        startRise: z.number().finite().min(0).max(4),
        placedRise: z.number().finite().min(0).max(4),
        climbRise: z.number().finite().min(0).max(4),
        /** Successes that show a grade, in `distinctFamilies` families. */
        independentSuccesses: z.number().int().min(1).max(20),
        evidenceWindow: z.number().int().min(4).max(100),
        minimumSuccessRate: z.number().min(0.5).max(1),
        gradeTolerance: z.number().min(0).max(2),
        foundationReach: z.number().min(0).max(2),
        /** How far below the highest grade shown a foundation check sits
         * once the learner has climbed past the start. */
        foundationDepth: z.number().min(0).max(6),
        singleFamilySuccessMultiplier: z.number().int().min(1).max(10),
        distinctFamilies: z.number().int().min(1).max(10),
        /** Recent misses at or above the highest grade shown that end the
         * climb (`Frontier.climbing`). */
        placedAfterMisses: z.number().int().min(1).max(20),
      })
      .strict()
      .default({
        enabled: false,
        startRise: 1,
        placedRise: 0,
        climbRise: 2,
        independentSuccesses: 2,
        evidenceWindow: 12,
        minimumSuccessRate: 0.75,
        gradeTolerance: 0.5,
        foundationReach: 1,
        foundationDepth: 2,
        singleFamilySuccessMultiplier: 2,
        distinctFamilies: 2,
        placedAfterMisses: 2,
      }),
    /** How the shown levels of a learner whose start came from their age are
     * held while the evidence is thin (`frontier-report.ts`). The overall
     * level may leave the band of `ageBand` grades around the age-expected
     * grade by answered / `startingAnswers` of the way to its estimate. An
     * area is shown at the overall shown level plus its own answers /
     * `areaAnswers` of its difference from the overall estimate. Display
     * only; the estimates and selection never read it. Absent: shown as
     * estimated. */
    display: z
      .object({
        ageBand: z.number().finite().min(0).max(2),
        startingAnswers: z.number().int().min(1).max(100),
        areaAnswers: z.number().int().min(1).max(100),
      })
      .strict()
      .optional(),
    overallUncertainty: z
      .object({
        rareMissThreshold: z.number().finite().min(0.5).max(1),
        rareMissVariance: variance,
        retentionPerAnswer: z.number().finite().min(0).max(0.99),
        maxVariance: variance,
      })
      .strict(),
  })
  .strict();
export type FrontierParameters = z.infer<typeof frontierPolicySchema>;
type Frozen<T> = T extends object
  ? { readonly [K in keyof T]: Frozen<T[K]> }
  : T;
export type FrontierPolicy = Frozen<FrontierParameters>;
const compiled = new WeakSet<object>();
function freeze<T>(value: T): Frozen<T> {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as Frozen<T>;
}
/** Compile once per service/experiment. Save the source JSON with comparisons. */
export function createFrontierPolicy(input: unknown): FrontierPolicy {
  const policy = freeze(frontierPolicySchema.parse(input));
  compiled.add(policy);
  return policy;
}
export function assertFrontierPolicy(policy: FrontierPolicy): void {
  if (!compiled.has(policy))
    throw new Error("Use createFrontierPolicy to validate frontier parameters");
}

const legacyResponse = {
  typedGuess: 0.04,
  slip: 0.04,
  atLevelSuccess: 0.04 + 0.92 / (1 + Math.exp(-0.85)),
  discrimination: 1.7,
};

/** Reproduces the prior production likelihood and recency for paired replays. */
export const LEGACY_FRONTIER_POLICY = createFrontierPolicy({
  schemaVersion: 1,
  version: "grade-frontier-v1",
  prior: { overallSd: 2.5, strandSd: 1.75 },
  response: legacyResponse,
  strandResponse: legacyResponse,
  overall: {
    perAnswer: 0.03,
    perDay: 0.02,
    surpriseCorrect: 0.3,
    surpriseIncorrect: 0.3,
  },
  strand: {
    perAnswer: 0.03,
    perDay: 0.02,
    surpriseCorrect: 0.3,
    surpriseIncorrect: 0.3,
  },
  surpriseThreshold: 0.75,
  maxDriftDays: 30,
  assisted: { treatAsFailure: true, correctWeight: 0, incorrectWeight: 1 },
  overallUncertainty: {
    rareMissThreshold: 0.75,
    rareMissVariance: 0,
    retentionPerAnswer: 0.7,
    maxVariance: 1,
  },
});

/** The production policy until 2026-11-13, kept for paired replays. Working
 * grade, not mastery or a norm-referenced percentile. Overall evidence
 * accumulates steadily; strand estimates can react faster to local gaps.
 * A surprising miss does not make the next overall answer count extra. */
export const PREVIOUS_FRONTIER_POLICY = createFrontierPolicy({
  ...LEGACY_FRONTIER_POLICY,
  version: "grade-frontier-v4-evidence-anchored-climb",
  // The start is a guess: the ceiling stands on what the learner has shown
  // anywhere, so a wrong start costs a few problems (founder, 2026-11-10).
  confirmation: {
    enabled: true,
    startRise: 1,
    placedRise: 0,
    climbRise: 2,
    independentSuccesses: 2,
    evidenceWindow: 12,
    minimumSuccessRate: 0.75,
    gradeTolerance: 0.5,
    foundationReach: 1,
    foundationDepth: 2,
    singleFamilySuccessMultiplier: 2,
    distinctFamilies: 2,
    placedAfterMisses: 2,
  },
  response: {
    typedGuess: 0.04,
    slip: 0.08,
    atLevelSuccess: 0.6,
    discrimination: 1.7,
  },
  overall: {
    perAnswer: 0.003,
    perDay: 0.02,
    surpriseCorrect: 0.3,
    surpriseIncorrect: 0,
  },
  assisted: { treatAsFailure: false, correctWeight: 0, incorrectWeight: 0 },
  overallUncertainty: {
    rareMissThreshold: 0.7,
    rareMissVariance: 0.36,
    retentionPerAnswer: 0.7,
    maxVariance: 1,
  },
});

/** Overall prior sd for a start set by age, by that grade, in grade-years:
 * the within-grade spread of mathematics achievement from national norms
 * (NWEA 2020 true-score SDs and Bloom/Hill annual gains, the "AMP prior sd"
 * column of docs/engine/norms-prior.md), capped at the former flat 2.5 from
 * grade 6 up so no start moves faster than it did. A provisional prior: it
 * is not fitted to AMP learners, and a national spread on another vertical
 * scale is only an approximation to the spread on AMP's. */
export const NORMS_PRIOR_SD: readonly (readonly [start: number, sd: number])[] =
  [
    [0, 0.7],
    [1, 0.8],
    [2, 1.0],
    [3, 1.1],
    [4, 1.6],
    [5, 1.9],
    [6, 2.5],
  ];

/** Working grade, not mastery or a norm-referenced percentile.
 *
 * - The overall readout of a learner whose start came from a birth year has
 *   a prior as wide as that age is spread nationally (`NORMS_PRIOR_SD`), not
 *   a flat 2.5. A chosen start (an adult's, a family band) keeps 2.5.
 * - For such a learner, the shown overall level leaves the age band over the
 *   first ten answers, a tenth of the way per answer, and an area with few
 *   answers of its own is shown near the overall level (`display`): a
 *   ten-year-old's first three right answers move them to the edge of their
 *   grade, not two grades up. From ten answers on, the overall level shown
 *   is the estimate. Chosen starts show as estimated, as before.
 * - Selection is unchanged: its pooled estimate, the areas, the climb and
 *   the response curves are v4's, for every learner. */
export const DEFAULT_FRONTIER_POLICY = createFrontierPolicy({
  ...PREVIOUS_FRONTIER_POLICY,
  version: "grade-frontier-v5-age-anchored",
  prior: {
    ...PREVIOUS_FRONTIER_POLICY.prior,
    sdByStart: NORMS_PRIOR_SD,
  },
  display: { ageBand: 0.5, startingAnswers: 10, areaAnswers: 10 },
});
