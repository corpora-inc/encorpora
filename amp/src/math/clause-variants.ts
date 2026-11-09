import type {
  GeneratedProblem,
  ResponseCapability,
  TemplateMetadata,
} from "./contracts";
import { chooseAxes, defineAxis } from "./variation/axes";
import { finish, rng } from "./clause-kit";
import { signedClause } from "./clause-signed-variants";
import { realClause } from "./clause-real-variants";
import { geometryClause } from "./clause-geometry-variants";
import { legacySurfacesOnly } from "./number-domain-axes";
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

/** A versioned task axis leaves the existing generator and its random stream
 * untouched for legacy draws and saved versions. Weights are exposure, not
 * difficulty. Each entry lists every additional response protocol it uses. */
type Entry = {
  /** Fixed catalog revision that first introduced these tasks. */
  introducedVersion: number;
  values: string[];
  weights: number[];
  responses: ResponseCapability[];
  group: "signed" | "real" | "geometry";
  description: string;
};
const entry = (
  group: Entry["group"],
  values: string[],
  weights: number[],
  responses: ResponseCapability[],
  description: string,
): Entry => ({
  introducedVersion: 2,
  group,
  values: ["legacy", ...values],
  weights,
  responses,
  description,
});
const sc = "single-choice-v1",
  mp = "multi-part-choice-v1",
  ms = "multi-select-v1",
  fc = "figure-choice-v1",
  sw = "structured-work-v1";
export const clauseEntries: Record<string, Entry> = {
  "signed-quantity": entry(
    "signed",
    ["zero-meaning"],
    [2, 1],
    [sc, mp],
    "Interpret zero as the reference in signed contexts.",
  ),
  "opposite-on-line": entry(
    "signed",
    ["zero-opposite"],
    [7, 3],
    [sc],
    "Recognize that zero is its own opposite.",
  ),
  "number-line-distance": entry(
    "signed",
    ["absolute-distance", "rational-distance"],
    [2, 1, 1],
    [ms],
    "Relate absolute value to distance from zero and between rational endpoints.",
  ),
  "signed-context-order": entry(
    "signed",
    ["write-order", "position-inequality"],
    [2, 1, 1],
    [sc],
    "Write inequalities, interpret signed order in context, and read relative positions on a number line.",
  ),
  "signed-story": entry(
    "signed",
    ["mixed-forms", "estimate-check"],
    [2, 1, 1],
    [sc, sw],
    "Combine fractions and decimals in stories and check answers by estimation.",
  ),
  "signed-jumps": entry(
    "signed",
    ["represent-jumps"],
    [1, 1],
    [fc],
    "Choose horizontal or vertical number-line representations of signed operations.",
  ),
  "signed-changes-sum": entry(
    "signed",
    ["make-zero", "pair-first"],
    [2, 1, 1],
    [sc, ms],
    "Identify cancelling changes and regroup signed sums strategically.",
  ),
  "integer-addition": entry(
    "signed",
    ["additive-inverse"],
    [17, 3],
    [sc],
    "Add opposites and find additive inverses.",
  ),
  "signed-fraction-sum": entry(
    "signed",
    ["additive-inverse", "rewrite-subtraction"],
    [12, 3, 5],
    [sc],
    "Add rational opposites and rewrite subtraction as addition of an opposite.",
  ),
  "fl-integer-multiply-divide": entry(
    "signed",
    ["sign-rule", "match-situation", "undefined-divisor"],
    [3, 1, 1, 1],
    [sc, mp],
    "Explain signed multiplication, match signed operations to contexts, and distinguish zero dividends from zero divisors.",
  ),
  "signed-fraction-product": entry(
    "signed",
    ["product-strategy"],
    [1, 1],
    [sc],
    "Distribute and regroup signed rational products.",
  ),
  "solve-square-cube-equation": entry(
    "real",
    ["positive-rational-powers"],
    [1, 2],
    [sc],
    "Solve square and cube equations with positive rational right sides.",
  ),
  "root-between-integers": entry(
    "real",
    ["exact-root"],
    [1, 1],
    [],
    "Evaluate exact square and cube roots, including fractions and decimals.",
  ),
  "classify-real-number": entry(
    "real",
    ["sqrt-two", "decimal-expansion", "decimal-remainder-reason"],
    [2, 2, 1, 1],
    [sc, mp],
    "Recognize the irrationality of the square root of two and classify decimal expansions.",
  ),
  "root-approximation-select": entry(
    "real",
    ["locate-root"],
    [1, 1],
    [fc],
    "Choose the number-line point nearest a square or cube root.",
  ),
  "root-nearest-tenth": entry(
    "real",
    ["narrow-interval"],
    [1, 1],
    [sc, mp],
    "Refine root bounds through whole numbers, tenths and hundredths.",
  ),
  "number-system-closure-classify": entry(
    "real",
    ["explain-closure", "undo-argument"],
    [2, 1, 1],
    [sc],
    "Justify rational closure and the irrationality of sums and nonzero rational multiples.",
  ),
  "turn-degrees": entry(
    "geometry",
    ["one-degree-count"],
    [1, 1],
    [sc],
    "Count one-degree angles and relate them to 360 equal parts of a turn.",
  ),
  "angle-equation": entry(
    "geometry",
    ["complementary-split", "vertical-then-adjacent"],
    [2, 1, 1],
    [],
    "Solve complementary-angle equations and follow vertical angles to an adjacent unknown.",
  ),
  "angle-pair-measure": entry(
    "geometry",
    ["complementary-split"],
    [3, 1],
    [],
    "Find a missing part of a right angle.",
  ),
  "adjacent-angle-equation": entry(
    "geometry",
    ["whole-unknown"],
    [1, 1],
    [sc],
    "Choose an addition equation when the whole angle is unknown.",
  ),
  "right-triangle": entry(
    "geometry",
    ["story"],
    [1, 1],
    [sc],
    "Apply the Pythagorean theorem to ladders, screens, parks, ramps and wires, including distance saved.",
  ),
  "right-triangle-missing-leg": entry(
    "geometry",
    ["story"],
    [1, 1],
    [sc],
    "Find a missing real-world leg, exactly or rounded once to the nearest tenth.",
  ),
  "circle-equation": entry(
    "geometry",
    ["derive-from-center-radius"],
    [1, 1],
    [sc, mp],
    "Build a circle equation from coordinate differences and a radius using the Pythagorean theorem.",
  ),
};
export function withClauseMetadata(meta: TemplateMetadata): TemplateMetadata {
  const e = clauseEntries[meta.id];
  if (!e) return meta;
  return {
    ...meta,
    version: Math.max(meta.version, e.introducedVersion),
    reprintsFrom: Math.min(
      meta.reprintsFrom ?? meta.version,
      e.introducedVersion - 1,
    ),
    description: `${meta.description} ${e.description}`,
    requiredResponseCapabilities: [
      ...new Set([
        ...(meta.requiredResponseCapabilities ?? []),
        ...e.responses,
      ]),
    ],
  };
}
export function generateClauseVariant(
  meta: TemplateMetadata | undefined,
  seed: string,
  force?: string,
): GeneratedProblem | undefined {
  if (!meta) return;
  const e = clauseEntries[meta.id];
  if (!e)
    return (
      statisticsClause(meta, seed, force) ??
      vectorMatrixClause(meta, seed, force) ??
      trigonometryClause(meta, seed, force) ??
      undefined
    );
  if (legacySurfacesOnly()) return;
  const needs = Object.fromEntries(
    e.values
      .filter((v) => v !== "legacy")
      .map((v) => [
        v,
        meta.id === "signed-context-order" && v === "write-order"
          ? ("scenes-v2" as const)
          : ("scenes-v1" as const),
      ]),
  );
  const axis = defineAxis("clause", e.values, {
    legacy: "legacy",
    weights: e.weights,
    silentLegacy: true,
    since: e.introducedVersion,
    needs,
  });
  const variant = force ?? chooseAxes(meta.id, seed, { clause: axis }).clause;
  if (variant === "legacy") return;
  const r = rng(meta.id, seed),
    generator =
      e.group === "signed"
        ? signedClause
        : e.group === "real"
          ? realClause
          : geometryClause;
  // Catalog revisions added by the base family must not change the IDs of
  // tasks issued by this fixed clause revision.
  return finish(
    { ...meta, version: e.introducedVersion },
    seed,
    variant,
    generator(meta.id, variant, r),
  );
}

export const clauseVariants = {
  ...statisticsClauses,
  ...vectorMatrixClauses,
  ...trigonometryClauses,
};

const clauseResponses: Record<string, ResponseCapability[]> = {
  "representative-sample-choice": [sc],
  "sample-proportion-estimate": [sc],
  "sample-estimates-plot": [sc, sw],
  "scatter-association-choice": [ms, "point-plot-v1", sc],
  "trend-slope-meaning": [sc],
  "two-way-association-choice": [sc],
  "two-way-missing": [sw],
  "study-design-classify": [mp],
  "margin-of-error-interval": [sw],
  "relative-frequency-percent": [sw],
  "nonlinear-data-model": ["point-plot-v1", sc],
  "residual-function-fit": ["point-plot-v1", sc, sw, fc],
  "correlation-choice": [sc],
  "vector-components": ["point-plot-v1", fc, mp, sc],
  "vector-resultant": [mp],
  "matrix-data-reading": [sc],
  "matrix-operations": [sc, sw],
  "matrix-laws": [sc, mp],
  "matrix-linear-system": [mp],
  "special-angle-exact-value": [mp],
  "trig-identity-value": [mp, sc],
  "complementary-trig": [sc],
  "oblique-triangle-solve": [sc, sw],
  "triangle-law-reasoning": [sc, sw],
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
        requiredResponseCapabilities: [
          ...new Set([
            ...(meta.requiredResponseCapabilities ?? []),
            ...clauseResponses[meta.id]!,
          ]),
        ],
        ...(meta.id === "vector-resultant"
          ? { title: "Resultants of velocities and forces" }
          : {}),
      }
    : meta;
}
