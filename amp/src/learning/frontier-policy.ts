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

/** Working grade, not mastery or a norm-referenced percentile. Overall evidence
 * accumulates steadily; strand estimates can react faster to local gaps.
 * A surprising miss does not make the next overall answer count extra. */
export const DEFAULT_FRONTIER_POLICY = createFrontierPolicy({
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
