import type {
  GeneratedProblem,
  ResponseCapability,
  TemplateMetadata,
} from "./contracts";
import {
  generatePlaceClause,
  placeClauseFamilies,
} from "./clause-place-value-practice";
import {
  generateTransformationClause,
  transformationClauseFamilies,
} from "./clause-transformation-practice";
import { chooseAxes, defineAxis, versionGatedAxes } from "./variation/axes";
import { random } from "./clause-support";

import {
  statisticsClause,
  statisticsClauses,
} from "./statistics-clause-variants";
import {
  vectorMatrixClause,
  vectorMatrixClauses,
} from "./vector-matrix-clause-variants";
import {
  trigonometryClause,
  trigonometryClauses,
} from "./trigonometry-clause-variants";

export const clauseVariants = {
  ...statisticsClauses,
  ...vectorMatrixClauses,
  ...trigonometryClauses,
};

const descriptions: Record<string, string> = {
  "representative-sample-choice":
    "Choose representative sampling methods and judge whether samples support population generalizations.",
  "sample-proportion-estimate":
    "Scale sample counts to population estimates and choose appropriately qualified inferences.",
  "sample-estimates-plot":
    "Use simulated sample counts to estimate a population count and gauge variation among estimates.",
  "scatter-association-choice":
    "Construct scatter plots and describe direction, shape, clusters and outliers.",
  "trend-slope-meaning":
    "Interpret the slope and intercept of a trend line in context, including when zero has no practical meaning.",
  "two-way-association-choice":
    "Compare conditional row or column percentages to judge categorical association.",
  "two-way-missing":
    "Find missing counts and construct two-way tables from paired categorical observations.",
  "study-design-classify":
    "Distinguish surveys, experiments and observational comparisons by purpose and the role of randomization.",
  "margin-of-error-interval":
    "Form interval estimates and develop empirical margins from simulated sample proportions or means.",
  "relative-frequency-percent":
    "Construct two-way frequency tables and calculate conditional percentages.",
  "nonlinear-data-model":
    "Construct scatter plots, describe linear, quadratic and exponential patterns, and choose candidate models fitting observations.",
  "residual-function-fit":
    "Plot and interpret residuals, choose a line of fit, and use its equation to predict values.",
  "correlation-choice":
    "Interpret correlation and recover its signed value from regression output containing the slope and squared correlation.",
  "vector-components":
    "Construct and combine directed vectors, compare magnitudes, and interpret scalar multiplication and reversal.",
  "vector-resultant":
    "Combine perpendicular and non-perpendicular velocities or forces and find resultant magnitudes and directions.",
  "matrix-data-reading":
    "Read and construct contextual data matrices, including directed networks and zero-sum payoffs.",
  "matrix-operations":
    "Add, subtract, scale and multiply matrices, checking dimensions and interpreting contextual scaling.",
  "matrix-laws":
    "Compute both product orders and distinguish general matrix laws, commuting examples, and zero and identity roles.",
  "matrix-linear-system":
    "Write systems as matrix equations and solve two- or three-variable systems using supplied inverses.",
  "special-angle-exact-value":
    "Find exact trigonometric values and derive special-angle ratios by cutting squares and equilateral triangles.",
  "trig-identity-value":
    "Use and justify Pythagorean and angle-sum identities, including exact tangent sums and differences.",
  "complementary-trig":
    "Use and explain complementary sine and cosine ratios by identifying the same sides from different acute angles.",
  "oblique-triangle-solve":
    "Use the laws of sines and cosines in triangles, surveying, forces and navigation.",
  "triangle-law-reasoning":
    "Choose justified steps in deriving the laws of sines and cosines and explain their right-triangle reductions.",
};

export const clauseFamilies = {
  ...placeClauseFamilies,
  ...transformationClauseFamilies,
};
const capabilities: Record<string, ResponseCapability[]> = {
  "tens-ones-model": ["multi-part-choice-v1"],
  "two-digit-symbol": ["multi-part-choice-v1"],
  "ten-more-or-less": ["multi-part-choice-v1"],
  "subtract-whole-tens": ["multi-part-choice-v1"],
  "place-value-digit": ["multi-part-choice-v1"],
  "expanded-form-missing": ["multi-part-choice-v1"],
  "three-digit-symbol": ["multi-part-choice-v1"],
  "measurement-line-fraction-story": ["figure-choice-v1"],
  "compare-decimals-symbol-blanks": [
    "multi-part-choice-v1",
    "single-choice-v1",
  ],
  "multiply-power-of-ten": ["multi-part-choice-v1"],
  "compare-decimals-thousandths": ["multi-part-choice-v1"],
  "decimal-area-model": ["multi-part-choice-v1"],
  "multidigit-decimal-product": ["structured-work-v1"],
  "multidigit-decimal-quotient": ["structured-work-v1"],
  "multidigit-decimal-sum": ["structured-work-v1"],
  "teen-frame-compose": ["single-choice-v1", "multi-part-choice-v1"],
  "similarity-by-transformation": ["single-choice-v1", "multi-select-v1"],
  "transformation-rule-slots": ["multi-part-choice-v1", "structured-work-v1"],
  "dilation-measure": ["structured-work-v1"],
};

/** Catalog revision only. Original generator metadata stays untouched so
 * stored versions reproduce their old bytes and random streams. */
export function clauseMetadata(meta: TemplateMetadata): TemplateMetadata {
  if (clauseVariants[meta.id]) {
    return {
      ...meta,
      version: 2,
      reprintsFrom: 1,
      description: descriptions[meta.id]!,
      ...(meta.id === "vector-resultant"
        ? { title: "Resultants of velocities and forces" }
        : {}),
    };
  }
  if (!clauseFamilies[meta.id]) return meta;
  const needs = [
    ...new Set([
      ...(meta.requiredResponseCapability
        ? [meta.requiredResponseCapability]
        : []),
      ...(capabilities[meta.id] ?? []),
    ]),
  ];
  return {
    ...meta,
    version: meta.version + 1,
    ...(!meta.requiredResponseCapability
      ? { hasNumericVariants: true as const }
      : {}),
    reprintsFrom: meta.reprintsFrom ?? meta.version,
    ...(needs.length
      ? {
          requiredResponseCapability: needs[0],
          requiredResponseCapabilities: needs,
        }
      : {}),
  };
}

export function buildClause(
  meta: TemplateMetadata,
  seed: string,
  family: string,
): GeneratedProblem {
  const c = { meta, seed, family, r: random(`${meta.id}:${family}`, seed) };
  return placeClauseFamilies[meta.id]
    ? generatePlaceClause(c)
    : generateTransformationClause(c);
}

/** Existing entrypoints share the new draw; print-only case functions keep
 * their legacy surfaces. Version-gated axes leave stored problems unchanged. */
export function withClauseVariants(
  templates: readonly TemplateMetadata[],
  legacy: (id: string, seed: string) => GeneratedProblem,
) {
  return (id: string, seed: string): GeneratedProblem => {
    if (typeof seed !== "string" || !seed.length || seed.length > 128)
      throw new Error("Seed must contain 1–128 characters");
    const families = clauseFamilies[id],
      base = templates.find((t) => t.id === id);
    if (!families || !base) return legacy(id, seed);
    const meta = clauseMetadata(base),
      values = ["legacy", ...families.map((s) => s.slice(0, 31))];
    const selected = chooseAxes(id, seed, {
      clause: defineAxis("clause", values, {
        legacy: "legacy",
        weights: [2, ...families.map(() => 3)],
        since: meta.version,
        needs: Object.fromEntries(
          values.slice(1).map((v) => [v, "scenes-v1" as const]),
        ),
      }),
    }).clause;
    const gated = versionGatedAxes().some((a) => a.id === "clause");
    if (gated) return legacy(id, seed);
    const hardened =
      id === "continue-count-to-120" || id === "mental-ten-hundred";
    if (selected === "legacy" && !hardened) {
      return legacy(id, seed);
    }
    return buildClause(
      meta,
      seed,
      hardened ? families[0]! : families[values.indexOf(selected) - 1]!,
    );
  };
}

export function generateClauseVariant(
  meta: TemplateMetadata,
  seed: string,
  force?: string,
): GeneratedProblem | null {
  return (
    statisticsClause(meta, seed, force) ??
    vectorMatrixClause(meta, seed, force) ??
    trigonometryClause(meta, seed, force)
  );
}
