import { createHash } from "node:crypto";
import { z } from "zod";
import { skills } from "../curriculum/catalog.js";
import { templates } from "../math/engine.js";
import {
  selectionObjectives,
  skillEmphasis,
  familyEmphasis,
} from "../curriculum/selection.js";

// Bounds below protect computation/configuration. They are not learning targets.
const points = z.number().finite().min(0).max(10000);
const grades = z.number().finite().min(0).max(20);
const count = z.number().int().min(0).max(1000);
const weight = z.number().finite().positive().max(100);
const weights = z.record(z.string().min(1).max(200), weight);
const supportScore = z.object({ floor: points, bonus: points }).strict();
/** JSON-compatible experiment inputs. Unknown fields fail instead of silently
 * running the wrong hypothesis. Evidence's retained history is five outcomes. */
export const practicePolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    version: z.string().min(1).max(100),
    sampling: z
      .object({
        utilityWindow: points,
        temperature: z.number().finite().min(0.01).max(10000),
      })
      .strict(),
    target: z
      .object({
        levelOffset: z.number().finite().min(-20).max(20),
        uncertaintyWeight: grades,
        clampToAvailable: z.boolean(),
      })
      .strict(),
    placement: z
      .object({ assessmentOnlyAttempts: count, scriptedOpeners: z.boolean() })
      .strict(),
    support: z
      .object({
        reserveSlot: z.boolean(),
        alternate: z.boolean(),
        minimumSkillGap: count,
        demonstratedSuccesses: z.number().int().min(1).max(5),
        errorWindow: z.number().int().min(1).max(5),
        errorsToRepair: z.number().int().min(1).max(5),
        prerequisiteReach: grades,
        revisitReach: grades,
        reviewReach: grades,
      })
      .strict(),
    scoring: z
      .object({
        base: points,
        distancePenalty: points,
        harderBoundary: grades,
        harderPenalty: points,
        easierBoundary: grades,
        easierPenalty: points,
        prerequisite: supportScore,
        revisit: supportScore,
        review: supportScore,
        notDuePenalty: points,
        nearbyRadius: grades,
        unseenBonus: points,
        uncertaintyWeight: points,
        ageGapWeight: points,
        ageGapCap: grades,
        sameStrandPenalty: points,
        batchSkillPenalty: points,
        batchStrandPenalty: points,
        poolReach: grades,
      })
      .strict(),
    variety: z
      .object({
        enforceFreshness: z.boolean(),
        templateWindow: z.number().int().min(1).max(1000),
        templateMax: z.number().int().min(1).max(1000),
        minimumTemplateGap: count,
        templateFade: z.number().int().min(1).max(1000),
        templatePenalty: points,
        skillPenalty: z.array(points).min(1).max(1001),
        strandWindow: count,
        strandPenalty: points,
        sessionMs: z
          .number()
          .int()
          .positive()
          .max(365 * 86400000),
        excludeSkipped: z.boolean(),
        skipPenalty: points,
        skipEase: grades,
        skipEaseWeight: points,
        skipEaseProblems: count,
        skipReturnAfter: count,
      })
      .strict(),
    weights: z
      .object({ objectives: weights, skills: weights, families: weights })
      .strict(),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (policy.support.errorsToRepair > policy.support.errorWindow)
      ctx.addIssue({
        code: "custom",
        path: ["support", "errorsToRepair"],
        message: "Repair threshold exceeds available error window",
      });
  });
export type PracticeParameters = z.infer<typeof practicePolicySchema>;
type Frozen<T> = T extends object
  ? { readonly [K in keyof T]: Frozen<T[K]> }
  : T;
export type PracticePolicy = Frozen<PracticeParameters> & {
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
/** Compile once per experiment/service, never mutate global defaults. Persist the
 * source JSON alongside results: a fingerprint identifies, but cannot replay it. */
export type PolicyCatalog = Readonly<
  Record<"objectives" | "skills" | "families", readonly string[]>
>;
const defaultCatalog: PolicyCatalog = {
  objectives: selectionObjectives.map((o) => o.id),
  skills: skills.map((s) => s.id),
  families: templates.map((t) => t.id),
};
export function createPracticePolicy(
  input: unknown,
  catalog: PolicyCatalog = defaultCatalog,
): PracticePolicy {
  const parameters = practicePolicySchema.parse(input);
  for (const kind of ["objectives", "skills", "families"] as const) {
    const known = new Set(catalog[kind]);
    for (const id of Object.keys(parameters.weights[kind]))
      if (!known.has(id)) throw new Error(`Unknown ${kind} weight: ${id}`);
  }
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(canonical(parameters)))
    .digest("hex");
  const policy = freeze({ ...parameters, fingerprint });
  compiled.add(policy);
  return policy;
}
export function assertPracticePolicy(policy: PracticePolicy): void {
  if (!compiled.has(policy))
    throw new Error("Use createPracticePolicy to validate practice parameters");
}

/** Current editorial behavior, expressed as an explicit reproducible parameter
 * set. Changing hypotheses requires a new object, not a global mutation. */
export const DEFAULT_PRACTICE_POLICY = createPracticePolicy({
  schemaVersion: 1,
  version: "pathways-budget-v1",
  sampling: { utilityWindow: 24, temperature: 12 },
  target: { levelOffset: -0.5, uncertaintyWeight: 0.3, clampToAvailable: true },
  placement: { assessmentOnlyAttempts: 20, scriptedOpeners: true },
  support: {
    reserveSlot: true,
    alternate: true,
    minimumSkillGap: 2,
    demonstratedSuccesses: 2,
    errorWindow: 2,
    errorsToRepair: 2,
    prerequisiteReach: 1,
    revisitReach: 0.25,
    reviewReach: 0.5,
  },
  scoring: {
    base: 100,
    distancePenalty: 30,
    harderBoundary: 1,
    harderPenalty: 120,
    easierBoundary: 1.5,
    easierPenalty: 40,
    prerequisite: { floor: 85, bonus: 20 },
    revisit: { floor: 70, bonus: 15 },
    review: { floor: 60, bonus: 10 },
    notDuePenalty: 60,
    nearbyRadius: 1,
    unseenBonus: 12,
    uncertaintyWeight: 14,
    ageGapWeight: 10,
    ageGapCap: 2,
    sameStrandPenalty: 45,
    batchSkillPenalty: 150,
    batchStrandPenalty: 120,
    poolReach: 1,
  },
  variety: {
    enforceFreshness: true,
    templateWindow: 10,
    templateMax: 2,
    minimumTemplateGap: 1,
    templateFade: 12,
    templatePenalty: 60,
    skillPenalty: [0, 200, 90, 60, 40, 25, 12],
    strandWindow: 4,
    strandPenalty: 20,
    sessionMs: 3 * 3600000,
    excludeSkipped: true,
    skipPenalty: 150,
    skipEase: 0.75,
    skipEaseWeight: 90,
    skipEaseProblems: 2,
    skipReturnAfter: 4,
  },
  weights: {
    objectives: Object.fromEntries(
      selectionObjectives.map((o) => [o.id, o.importance]),
    ),
    skills: { ...skillEmphasis },
    families: { ...familyEmphasis },
  },
} satisfies PracticeParameters);

/** A serializable mutable copy for deriving another experiment. */
export function practiceParameters(
  policy: PracticePolicy = DEFAULT_PRACTICE_POLICY,
): PracticeParameters {
  assertPracticePolicy(policy);
  const { fingerprint: _, ...parameters } = policy;
  return structuredClone(parameters) as PracticeParameters;
}
