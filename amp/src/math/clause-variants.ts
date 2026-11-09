import type { GeneratedProblem, TemplateMetadata } from "./contracts";
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

/** The new axis is gated at catalog version 2; version 1 still follows its
 * original generator, content stream, answer format and lesson example. */
export function clauseMetadata(meta: TemplateMetadata): TemplateMetadata {
  return clauseVariants[meta.id]
    ? {
        ...meta,
        version: 2,
        reprintsFrom: 1,
        description: descriptions[meta.id]!,
        ...(meta.id === "vector-resultant"
          ? { title: "Resultants of velocities and forces" }
          : {}),
      }
    : meta;
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
