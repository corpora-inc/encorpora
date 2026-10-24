import { satCompletionFacetMappings } from "./sat-completion-coverage";
import { satGeometryDataFacetMappings } from "./sat-geometry-data-coverage";
import { congruenceFacetMappings } from "./congruence-coverage";
import { assessmentGapFacetMappings } from "./assessment-gap-coverage";
import { areaVolumeFacetMappings } from "./area-volume-coverage";
import { transformationFacetMappings } from "./transformation-coverage";
import { completingSquareFacetMappings } from "./completing-square-coverage";
import { factoringFacetMappings } from "./factoring-coverage";
import { numberSystemFacetMappings } from "./number-system-coverage";
import { patternFunctionFacetMappings } from "./pattern-function-coverage";
import { linearFunctionFacetMappings } from "./linear-function-coverage";
import { quadraticStructureFacetMappings } from "./quadratic-structure-coverage";
import { functionToolkitFacetMappings } from "./function-toolkit-coverage";
import { twoVariableFacetMappings } from "./two-variable-coverage";
import { equationFacetMappings } from "./equation-coverage";
import { decimalFacetMappings } from "./decimal-coverage";
import { timeMoneyFacetMappings } from "./time-money-coverage";
import { attributeFacetMappings } from "./attribute-coverage";
import { volumeCoordinateFacetMappings } from "./volume-coordinate-coverage";
import { shapeFacetMappings } from "./shape-coverage";
import { angleFacetMappings } from "./angle-coverage";
import { polygonFacetMappings } from "./polygon-coverage";
import { exponentialFacetMappings } from "./exponential-coverage";
import { probabilityRulesFacetMappings } from "./probability-rules-coverage";
import { similarityTrigFacetMappings } from "./similarity-trig-coverage";
import { coordinateCircleFacetMappings } from "./coordinate-circle-coverage";
import { algebraStatisticsFacetMappings } from "./algebra-statistics-coverage";
import { powerFacetMappings } from "./power-coverage";
import { distributionFacetMappings } from "./distribution-coverage";
import { ratioRateFacetMappings } from "./ratio-rate-coverage";
import { inferenceFacetMappings } from "./inference-coverage";
import { bivariateFacetMappings } from "./bivariate-coverage";
import { partWholeFacetMappings } from "./part-whole-coverage";
import { linePlotFacetMappings } from "./line-plot-coverage";
import { earlyDataFacetMappings } from "./early-data-coverage";
import { combinatoricsFacetMappings } from "./combinatorics-coverage";
import { angleTriangleFacetMappings } from "./angle-triangle-coverage";
import { realNumberFacetMappings } from "./real-number-coverage";
import { radicalFacetMappings } from "./radical-coverage";
import { comparisonFacetMappings } from "./comparison-coverage";
import { numberSenseFacetMappings } from "./number-sense-coverage";
import { multiplyDivideFacetMappings } from "./multiply-divide-coverage";
import { addSubtractFacetMappings } from "./add-subtract-coverage";
import { factsFacetMappings } from "./facts-coverage";
import { factArrayFacetMappings } from "./fact-arrays-coverage";
import { rationalFacetMappings } from "./rational-coverage";
import { circleMeasurementFacetMappings } from "./circle-measurement-coverage";
import { integerExponentFacetMappings } from "./integer-exponent-coverage";
import { descriptiveStatisticsFacetMappings } from "./descriptive-statistics-coverage";
import { percentChangeFacetMappings } from "./percent-change-coverage";
import type { FacetMapping } from "./coverage";
import { inequalityFacetMappings } from "./inequality-coverage";
import { linearSystemFacetMappings } from "./linear-system-coverage";
import { rightTriangleFacetMappings } from "./right-triangle-coverage";
import { absoluteValueFacetMappings } from "./absolute-value-coverage";

/** Authored task-domain associations; evidence controls tested, reviewed and published states. */
export const actualFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "proportional-graph",
    facetId: "proportional-relationships.core",
    extent: "partial",
    rationale:
      "Read a graph of a proportional or non-proportional relationship in context: the unit rate from a labeled point with whole-number rate 2 to 5, the meaning of a point, of (0, 0) and of a nonzero starting value, the equation y = rx, and whether a graph is a straight line through the origin. Does not assess drawing graphs, tables, fractional or decimal rates, or comparing two relationships.",
  },
  {
    templateId: "story-graph-match",
    facetId: "qualitative-graphs.core",
    extent: "partial",
    rationale:
      "Match a story to a graph with no scale, or describe the graph, using increasing, constant and decreasing pieces in order (three pieces), find the single piece of four that is increasing, decreasing or constant, and the piece that changes fastest or slowest over equal times. Does not assess sketching graphs, curved graphs, linear versus nonlinear classification, or values read from a scale.",
  },
  {
    templateId: "coordinate-context-points",
    facetId: "coordinate-first-quadrant.ordered-pairs",
    extent: "partial",
    rationale:
      "Interpret a whole-number first-quadrant point in a plant, savings, map or game context, choose the labeled point or ordered pair that matches a situation, and find the vertical gap between two points with the same first coordinate. Does not assess plotting points, scale other than 1, signed coordinates or distances along other lines.",
  },
  {
    templateId: "pattern-pair-relationship",
    facetId: "related-patterns.paired-terms",
    extent: "partial",
    rationale:
      "Build matching terms from two add-rules with starts 0 to 4, write the nth ordered pair, and use a constant-difference or constant-multiple relationship (including a later term). Does not assess generating the patterns as a table by hand, plotting the pairs, or rules that multiply.",
  },
  {
    templateId: "triangle-uniqueness",
    facetId: "triangle-construction.determining-conditions",
    extent: "partial",
    rationale:
      "Decide whether two sides and a non-included angle (30 degrees, or a right or obtuse angle) give no triangle, one or two, and choose the one set of measures among SAS, ASA, SSS, AAA, SSA and impossible sets that fixes exactly one triangle. Does not assess drawing or constructing the triangle, trigonometry, or SSA with other acute angles.",
  },
  {
    templateId: "percent-applications",
    facetId: "percent-change.core",
    extent: "partial",
    rationale:
      "Exact one-step applications with whole-dollar or whole-number data: sales tax, tip, commission with base pay, markup, markdown price and rate, simple interest amount, balance and rate, and percent error. Does not assess rounding, compound interest, multi-step discounts, successive changes or constructed explanations.",
  },
  {
    templateId: "compound-event-simulation",
    facetId: "compound-probability.core",
    extent: "partial",
    rationale:
      "Probability of a compound event by listing a sample space of 8 to 16 equally likely outcomes (two dice, coin and die, three flips, two spinners), an estimate from 20 given random-digit trials, and comparison of experimental with theoretical probability. Does not assess drawing a tree or table, running a simulation, probabilities of unequal outcomes or dependent events.",
  },
  {
    templateId: "triangle-law-reasoning",
    facetId: "triangle-law-proofs.core",
    extent: "partial",
    rationale:
      "Select the altitude relations that derive the law of sines, the altitude and Pythagorean steps that derive the law of cosines, the law that starts a triangle given SAS, SSS, ASA or AAS measurements, and the number of triangles in an acute-angle side-side-angle case. Does not assess writing a proof, the obtuse-foot case, or computing side and angle values.",
  },
  {
    templateId: "triangle-law-reasoning",
    facetId: "triangle-law-proofs.HSG.SRT.D.10",
    extent: "partial",
    rationale:
      "Select the altitude relations that derive the law of sines, the altitude and Pythagorean steps that derive the law of cosines, the law that starts a triangle given SAS, SSS, ASA or AAS measurements, and the number of triangles in an acute-angle side-side-angle case. Does not assess writing a proof, the obtuse-foot case, or computing side and angle values.",
  },
  {
    templateId: "model-quantity-roles",
    facetId: "model-quantities.core",
    extent: "partial",
    rationale:
      "Select variable definitions with units for the independent and dependent quantities, the rate with its units, a unit that matches the rate after conversion, and which quantities vary in a linear situation. Does not assess writing the model equation, graphing, nonlinear relationships or open-ended justification of a modeling choice.",
  },
  {
    templateId: "model-quantity-roles",
    facetId: "model-quantities.HSN.Q.A.2",
    extent: "partial",
    rationale:
      "Select variable definitions with units for the independent and dependent quantities, the rate with its units, a unit that matches the rate after conversion, and which quantities vary in a linear situation. Does not assess writing the model equation, graphing, nonlinear relationships or open-ended justification of a modeling choice.",
  },
  {
    templateId: "stem-leaf-read",
    facetId: "mean-median.core",
    extent: "partial",
    rationale:
      "Read a whole-number or one-decimal stem-and-leaf plot through its key to find a value, least, greatest, range, median, mode, a count of values above a given value, and the difference of the greatest and second least values, by selecting from choices. Does not assess constructing a plot, keys with hundredths or fractions, plots with split stems or back-to-back plots, or the mean.",
  },
  {
    templateId: "budget-category-balance",
    facetId: "decimal-arithmetic.core",
    extent: "partial",
    rationale:
      "Select a missing expense category, a surplus or deficit with its name, and the change that balances a budget, using dollars and cents with one to five categories. Does not assess building a budget, percent allocation, saving goals, written explanation of a deficit or other personal-finance topics.",
  },
  {
    templateId: "gross-net-pay",
    facetId: "decimal-arithmetic.core",
    extent: "partial",
    rationale:
      "Select net pay from gross pay and listed deductions, net pay from hours and an hourly rate, gross pay from net pay, a missing deduction, and the take-home amount on a pay stub, using dollars and cents. Does not assess defining the terms in words, percent-based taxes, tax forms or other payroll topics.",
  },
  {
    templateId: "vector-components",
    facetId: "vectors.core",
    extent: "partial",
    rationale:
      "Select components from initial and terminal points or a drawn arrow, a magnitude, and a sum, difference or scalar multiple of two-dimensional vectors with small integer components, including tip-to-tail sums read from a grid. Does not assess drawing vectors, three-dimensional vectors, unit vectors, direction angles of general vectors or proofs.",
  },
  {
    templateId: "vector-components",
    facetId: "vectors.HSN.VM.A.1",
    extent: "partial",
    rationale:
      "Select components from initial and terminal points or a drawn arrow, a magnitude, and a sum, difference or scalar multiple of two-dimensional vectors with small integer components, including tip-to-tail sums read from a grid. Does not assess drawing vectors, three-dimensional vectors, unit vectors, direction angles of general vectors or proofs.",
  },
  {
    templateId: "vector-components",
    facetId: "vectors.HSN.VM.A.2",
    extent: "partial",
    rationale:
      "Select components from initial and terminal points or a drawn arrow, a magnitude, and a sum, difference or scalar multiple of two-dimensional vectors with small integer components, including tip-to-tail sums read from a grid. Does not assess drawing vectors, three-dimensional vectors, unit vectors, direction angles of general vectors or proofs.",
  },
  {
    templateId: "vector-components",
    facetId: "vectors.HSN.VM.B.4",
    extent: "partial",
    rationale:
      "Select components from initial and terminal points or a drawn arrow, a magnitude, and a sum, difference or scalar multiple of two-dimensional vectors with small integer components, including tip-to-tail sums read from a grid. Does not assess drawing vectors, three-dimensional vectors, unit vectors, direction angles of general vectors or proofs.",
  },
  {
    templateId: "vector-components",
    facetId: "vectors.HSN.VM.B.5",
    extent: "partial",
    rationale:
      "Select components from initial and terminal points or a drawn arrow, a magnitude, and a sum, difference or scalar multiple of two-dimensional vectors with small integer components, including tip-to-tail sums read from a grid. Does not assess drawing vectors, three-dimensional vectors, unit vectors, direction angles of general vectors or proofs.",
  },
  {
    templateId: "vector-resultant",
    facetId: "vector-modeling.core",
    extent: "partial",
    rationale:
      "Select the magnitude, direction angle by arctangent (stated rounding) or a missing leg for the resultant of two perpendicular velocities or forces. Does not assess non-perpendicular vectors, component resolution at an arbitrary angle, bearings, or constructing a model from an open-ended situation.",
  },
  {
    templateId: "vector-resultant",
    facetId: "vector-modeling.HSN.VM.A.3",
    extent: "partial",
    rationale:
      "Select the magnitude, direction angle by arctangent (stated rounding) or a missing leg for the resultant of two perpendicular velocities or forces. Does not assess non-perpendicular vectors, component resolution at an arbitrary angle, bearings, or constructing a model from an open-ended situation.",
  },
  {
    templateId: "matrix-data-reading",
    facetId: "matrix-data.core",
    extent: "partial",
    rationale:
      "Read an entry, row total or column total of a small data matrix, name its dimensions, and interpret an entry in context. Does not assess constructing a matrix from a situation, or matrices as models of networks or payoffs.",
  },
  {
    templateId: "matrix-data-reading",
    facetId: "matrix-data.HSN.VM.C.6",
    extent: "partial",
    rationale:
      "Read an entry, row total or column total of a small data matrix, name its dimensions, and interpret an entry in context. Does not assess constructing a matrix from a situation, or matrices as models of networks or payoffs.",
  },
  {
    templateId: "matrix-operations",
    facetId: "matrices.core",
    extent: "partial",
    rationale:
      "Select the exact sum, scalar multiple, linear combination or product of small integer matrices (including 2x3 times 3x2), and decide from dimensions whether a product is defined. Does not assess matrices larger than 3x3 in products, matrix equations with unknown matrices, or the zero matrix and identity as a standalone skill.",
  },
  {
    templateId: "matrix-operations",
    facetId: "matrices.HSN.VM.C.7",
    extent: "partial",
    rationale:
      "Select the exact sum, scalar multiple, linear combination or product of small integer matrices (including 2x3 times 3x2), and decide from dimensions whether a product is defined. Does not assess matrices larger than 3x3 in products, matrix equations with unknown matrices, or the zero matrix and identity as a standalone skill.",
  },
  {
    templateId: "matrix-operations",
    facetId: "matrices.HSN.VM.C.8",
    extent: "partial",
    rationale:
      "Select the exact sum, scalar multiple, linear combination or product of small integer matrices (including 2x3 times 3x2), and decide from dimensions whether a product is defined. Does not assess matrices larger than 3x3 in products, matrix equations with unknown matrices, or the zero matrix and identity as a standalone skill.",
  },
  {
    templateId: "matrix-laws",
    facetId: "matrix-properties.core",
    extent: "partial",
    rationale:
      "Compute products in both orders, identify the identity matrix, and choose which laws always hold or fail for 2x2 matrices. Does not assess written proofs or counterexample construction, nor determinants of products.",
  },
  {
    templateId: "matrix-laws",
    facetId: "matrix-properties.HSN.VM.C.9",
    extent: "partial",
    rationale:
      "Compute products in both orders, identify the identity matrix, and choose which laws always hold or fail for 2x2 matrices. Does not assess written proofs or counterexample construction, nor determinants of products.",
  },
  {
    templateId: "matrix-inverse-determinant",
    facetId: "matrix-inverses.core",
    extent: "partial",
    rationale:
      "Find a 2x2 determinant, decide invertibility, compute an inverse with integer or fraction entries, and find the parameter that makes a 2x2 matrix singular. Does not assess inverses of larger matrices, row reduction, or proofs that the determinant formula works.",
  },
  {
    templateId: "matrix-inverse-determinant",
    facetId: "matrix-inverses.HSN.VM.C.10",
    extent: "partial",
    rationale:
      "Find a 2x2 determinant, decide invertibility, compute an inverse with integer or fraction entries, and find the parameter that makes a 2x2 matrix singular. Does not assess inverses of larger matrices, row reduction, or proofs that the determinant formula works.",
  },
  {
    templateId: "matrix-transformation",
    facetId: "matrix-transformations.core",
    extent: "partial",
    rationale:
      "Apply a 2x2 matrix to a point, match rotation, reflection and dilation matrices with their descriptions, and use the absolute determinant as the area scale factor, including a determinant of 0. Does not assess rotations other than multiples of 90 degrees, composition of transformations, or deriving the area claim.",
  },
  {
    templateId: "matrix-transformation",
    facetId: "matrix-transformations.HSN.VM.C.11",
    extent: "partial",
    rationale:
      "Apply a 2x2 matrix to a point, match rotation, reflection and dilation matrices with their descriptions, and use the absolute determinant as the area scale factor, including a determinant of 0. Does not assess rotations other than multiples of 90 degrees, composition of transformations, or deriving the area claim.",
  },
  {
    templateId: "matrix-transformation",
    facetId: "matrix-transformations.HSN.VM.C.12",
    extent: "partial",
    rationale:
      "Apply a 2x2 matrix to a point, match rotation, reflection and dilation matrices with their descriptions, and use the absolute determinant as the area scale factor, including a determinant of 0. Does not assess rotations other than multiples of 90 degrees, composition of transformations, or deriving the area claim.",
  },
  {
    templateId: "matrix-linear-system",
    facetId: "matrix-systems.core",
    extent: "partial",
    rationale:
      "Identify the coefficient or constant matrix of a 2x2 system, solve AX = B with the inverse (exact fractions), and recognize that a zero determinant leaves no unique solution. Does not assess systems with three or more variables, technology-based inverses of larger matrices, or classifying no-solution versus infinitely many solutions.",
  },
  {
    templateId: "matrix-linear-system",
    facetId: "matrix-systems.HSA.REI.C.8",
    extent: "partial",
    rationale:
      "Identify the coefficient or constant matrix of a 2x2 system, solve AX = B with the inverse (exact fractions), and recognize that a zero determinant leaves no unique solution. Does not assess systems with three or more variables, technology-based inverses of larger matrices, or classifying no-solution versus infinitely many solutions.",
  },
  {
    templateId: "matrix-linear-system",
    facetId: "matrix-systems.HSA.REI.C.9",
    extent: "partial",
    rationale:
      "Identify the coefficient or constant matrix of a 2x2 system, solve AX = B with the inverse (exact fractions), and recognize that a zero determinant leaves no unique solution. Does not assess systems with three or more variables, technology-based inverses of larger matrices, or classifying no-solution versus infinitely many solutions.",
  },
  {
    templateId: "normal-model-rule",
    facetId: "normal-distributions.core",
    extent: "partial",
    rationale:
      "Select the percent between, above or below mean ± k standard deviations by the 68–95–99.7 rule, the interval for a stated percent, the larger z-score across two data sets, and the data set a normal model suits. Does not assess table or calculator normal probabilities, non-integer z-scores, checking fit with normal probability plots or sampling distributions.",
  },
  {
    templateId: "normal-model-rule",
    facetId: "normal-distributions.HSS.ID.A.4",
    extent: "partial",
    rationale:
      "Select the percent between, above or below mean ± k standard deviations by the 68–95–99.7 rule, the interval for a stated percent, the larger z-score across two data sets, and the data set a normal model suits. Does not assess table or calculator normal probabilities, non-integer z-scores, checking fit with normal probability plots or sampling distributions.",
  },
  {
    templateId: "random-variable-distribution",
    facetId: "random-variables.core",
    extent: "partial",
    rationale:
      "Define a numerical random variable, find P(X = k) and tail probabilities from counted outcomes or a bar chart, and complete a distribution whose probabilities sum to 1. Does not assess drawing the bar chart, continuous random variables or variance.",
  },
  {
    templateId: "random-variable-distribution",
    facetId: "random-variables.HSS.MD.A.1",
    extent: "partial",
    rationale:
      "Define a numerical random variable, find P(X = k) and tail probabilities from counted outcomes or a bar chart, and complete a distribution whose probabilities sum to 1. Does not assess drawing the bar chart, continuous random variables or variance.",
  },
  {
    templateId: "theoretical-distribution-expectation",
    facetId: "theoretical-distributions.core",
    extent: "partial",
    rationale:
      "Build a distribution from two fair dice or three independent trials and compute probabilities and an exact expected value for a payoff game. Does not assess binomial distributions beyond three trials, variance or continuous models.",
  },
  {
    templateId: "theoretical-distribution-expectation",
    facetId: "theoretical-distributions.HSS.MD.A.3",
    extent: "partial",
    rationale:
      "Build a distribution from two fair dice or three independent trials and compute probabilities and an exact expected value for a payoff game. Does not assess binomial distributions beyond three trials, variance or continuous models.",
  },
  {
    templateId: "empirical-distribution-expectation",
    facetId: "empirical-distributions.core",
    extent: "partial",
    rationale:
      "From an observed frequency bar chart, find a relative frequency, the expected value per trial and the expected total for a larger group. Does not assess comparing the empirical distribution with a theoretical model or its sampling variability.",
  },
  {
    templateId: "empirical-distribution-expectation",
    facetId: "empirical-distributions.HSS.MD.A.4",
    extent: "partial",
    rationale:
      "From an observed frequency bar chart, find a relative frequency, the expected value per trial and the expected total for a larger group. Does not assess comparing the empirical distribution with a theoretical model or its sampling variability.",
  },
  {
    templateId: "strategy-expected-value",
    facetId: "decision-strategies.core",
    extent: "partial",
    rationale:
      "Select the strategy with the greatest expected net gain or least expected cost among games, a warranty, or a sure amount and a gamble, with exact arithmetic. Does not assess risk preference, decision trees with several stages or evaluating estimated probabilities.",
  },
  {
    templateId: "strategy-expected-value",
    facetId: "decision-strategies.HSS.MD.B.7",
    extent: "partial",
    rationale:
      "Select the strategy with the greatest expected net gain or least expected cost among games, a warranty, or a sure amount and a gamble, with exact arithmetic. Does not assess risk preference, decision trees with several stages or evaluating estimated probabilities.",
  },
  {
    templateId: "fair-selection-procedure",
    facetId: "fair-random-decisions.core",
    extent: "partial",
    rationale:
      "Select a random procedure that gives each of several people equal chance and compute a person's probability under two-dice, remainder and re-roll procedures. Does not assess designing a new procedure or carrying out a random selection.",
  },
  {
    templateId: "fair-selection-procedure",
    facetId: "fair-random-decisions.HSS.MD.B.6",
    extent: "partial",
    rationale:
      "Select a random procedure that gives each of several people equal chance and compute a person's probability under two-dice, remainder and re-roll procedures. Does not assess designing a new procedure or carrying out a random selection.",
  },
  {
    templateId: "simulation-consistency-check",
    facetId: "simulation-model-checks.core",
    extent: "partial",
    rationale:
      "From a bar chart of 100 simulated results, find the number at least as extreme as an observed result (one or two-sided) and decide consistency at a stated cutoff. Does not assess running a simulation or designing one for a model.",
  },
  {
    templateId: "simulation-consistency-check",
    facetId: "simulation-model-checks.HSS.IC.A.2",
    extent: "partial",
    rationale:
      "From a bar chart of 100 simulated results, find the number at least as extreme as an observed result (one or two-sided) and decide consistency at a stated cutoff. Does not assess running a simulation or designing one for a model.",
  },
  {
    templateId: "randomization-test-decision",
    facetId: "randomization-tests.core",
    extent: "partial",
    rationale:
      "From a chart of 200 re-randomized differences, find the proportion as or more extreme than an observed treatment difference and decide significance at a stated cutoff. Does not assess carrying out the reshuffles or writing the conclusion in context.",
  },
  {
    templateId: "randomization-test-decision",
    facetId: "randomization-tests.HSS.IC.B.5",
    extent: "partial",
    rationale:
      "From a chart of 200 re-randomized differences, find the proportion as or more extreme than an observed treatment difference and decide significance at a stated cutoff. Does not assess carrying out the reshuffles or writing the conclusion in context.",
  },
  {
    templateId: "report-flaw-critique",
    facetId: "statistical-report-critique.core",
    extent: "partial",
    rationale:
      "Identify voluntary response, a convenience sample, a too-small sample, a missing margin of error or a truncated axis, including reports with two flaws. Does not assess causal claims from observational studies (assessed by the causal-claim family), or free-response critique.",
  },
  {
    templateId: "report-flaw-critique",
    facetId: "statistical-report-critique.HSS.IC.B.6",
    extent: "partial",
    rationale:
      "Identify voluntary response, a convenience sample, a too-small sample, a missing margin of error or a truncated axis, including reports with two flaws. Does not assess causal claims from observational studies (assessed by the causal-claim family), or free-response critique.",
  },
  {
    templateId: "model-residual-conclusion",
    facetId: "model-validation.core",
    extent: "partial",
    rationale:
      "Choose the conclusion supported by a residual table: curved pattern, no pattern, extrapolation, or which of two models has the smaller sum of squared residuals. Does not assess computing a regression line, graphing residual plots or writing the limitation in words.",
  },
  {
    templateId: "complex-plane-forms",
    facetId: "complex-plane.core",
    extent: "partial",
    rationale:
      "Read a complex number from a plotted point, find an exact modulus, add two plotted numbers, and convert between a+bi and r(cos θ + i sin θ) at special angles with exact values, by selecting among written forms. Does not assess plotting points, geometric multiplication or powers of complex numbers, or angles beyond the multiples of π/6 and π/4.",
  },
  {
    templateId: "complex-conjugate-division",
    facetId: "complex-conjugates.core",
    extent: "partial",
    rationale:
      "Find a conjugate, evaluate z·z̄, and divide two integer-coefficient complex numbers into exact standard form with fractional parts, by selecting among written results. Does not assess moduli of quotients, conjugate properties of sums and products, or proofs.",
  },
  {
    templateId: "complex-distance-midpoint",
    facetId: "complex-distance.core",
    extent: "partial",
    rationale:
      "Find the exact distance |z − w|, the midpoint, a missing endpoint of a segment, and the center and radius of |z − w| = r, with integer-coefficient numbers and selected answers. Does not assess perpendicular bisectors, loci other than circles, or written justification.",
  },
  {
    templateId: "complex-quadratic-factors",
    facetId: "complex-factorization.core",
    extent: "partial",
    rationale:
      "Factor x² + k² into complex linear factors, solve monic quadratics with negative discriminant in exact a ± bi form (including radicals and halves), and select the quadratic with given conjugate roots. Does not assess factoring higher-degree polynomials or non-monic quadratics.",
  },
  {
    templateId: "polynomial-root-count",
    facetId: "fundamental-theorem-algebra.core",
    extent: "partial",
    rationale:
      "Count complex roots with multiplicity from a degree or factored form, name the conjugate root forced by real coefficients, and bound or classify the number of real roots of a real polynomial. Does not assess finding roots, the theorem's proof, or polynomials with nonreal coefficients.",
  },
  {
    templateId: "polar-cartesian-conversion",
    facetId: "polar-coordinates.core",
    extent: "partial",
    rationale:
      "Convert polar to Cartesian and Cartesian to polar at special angles, including negative r and axis angles, and select equivalent polar names. Does not assess graphing polar curves, polar equations or converting equations.",
  },
  {
    templateId: "parametric-linear-motion",
    facetId: "parametric-models.core",
    extent: "partial",
    rationale:
      "Evaluate position, eliminate the parameter, find speed, solve for a time and read direction for linear parametric motion. Does not assess nonlinear or projectile motion, graphing a parametric curve or deriving a model from a context.",
  },
  {
    templateId: "conic-standard-form",
    facetId: "conic-sections.core",
    extent: "partial",
    rationale:
      "Identify a circle, ellipse, parabola or hyperbola from an equation, read an ellipse's center and longer-axis ends, and complete the square for a circle or an ellipse in general form. Does not assess graphing, hyperbola vertices and asymptotes, eccentricity or rotated conics.",
  },
  {
    templateId: "parabola-focus-directrix",
    facetId: "parabola-locus.core",
    extent: "partial",
    rationale:
      "Find the vertex, equation, focus and directrix of a parabola from a focus and directrix or from an equation, in vertical and horizontal orientations. Does not assess deriving the equation from the distance condition or graphing.",
  },
  {
    templateId: "special-angle-exact-value",
    facetId: "special-angle-values.HSF.TF.A.3",
    extent: "partial",
    rationale:
      "Choose the exact sine, cosine, tangent or unit-circle point of a special angle in any quadrant, in degrees or radians, including coterminal angles and axis angles where tangent is undefined. Does not assess deriving the values from triangles or constructing the unit circle.",
  },
  {
    templateId: "trig-symmetry-value",
    facetId: "trigonometric-symmetry.HSF.TF.A.4",
    extent: "partial",
    rationale:
      "Choose a value of sine, cosine or tangent at -θ, π±θ or θ plus whole turns from one given value, with the other coordinate found by the Pythagorean identity for acute θ. Does not assess written explanations of symmetry or periodicity.",
  },
  {
    templateId: "sinusoid-parameters",
    facetId: "trigonometric-graphs.HSF.IF.C.7",
    extent: "partial",
    rationale:
      "Read amplitude, period, midline, extreme values and horizontal shift from y = A sin(B(x − h)) + k, and choose the sine equation of a plotted graph with no horizontal shift. Does not assess sketching graphs by hand, cosine or tangent graphs, or graphs with phase shift.",
  },
  {
    templateId: "inverse-trig-value",
    facetId: "inverse-trigonometry.HSF.TF.B.6",
    extent: "partial",
    rationale:
      "Evaluate arcsin, arccos and arctan at special values with their restricted ranges, arcsin(sin x) type compositions outside the range, and sine, cosine or tangent of an inverse value. Does not assess justifying the restrictions or graphing inverse functions.",
  },
  {
    templateId: "trig-equation-solutions",
    facetId: "trigonometric-equations.HSF.TF.B.7",
    extent: "partial",
    rationale:
      "List or count the solutions of simple sine, cosine and tangent equations on one turn in degrees or radians, including double-angle counts and endpoint cases. Does not assess equations needing identities, quadratic forms, general solutions or contextual modeling.",
  },
  {
    templateId: "trig-identity-value",
    facetId: "trigonometric-identities.HSF.TF.C.8",
    extent: "partial",
    rationale:
      "Use sin²θ + cos²θ = 1 with a quadrant to choose a missing sine, cosine or tangent value. Does not assess proving the identity.",
  },
  {
    templateId: "trig-identity-value",
    facetId: "trigonometric-identities.HSF.TF.C.9",
    extent: "partial",
    rationale:
      "Choose exact values at 15°, 75° and 105° with angle-sum and difference formulas, and apply the cofunction relation in radians. Does not assess deriving or proving the formulas or simplifying symbolic expressions.",
  },
  {
    templateId: "oblique-triangle-solve",
    facetId: "oblique-triangles.HSG.SRT.D.11",
    extent: "partial",
    rationale:
      "Choose a side or angle found by the law of sines or cosines, rounded as stated, and the number of triangles in the ambiguous SSA case. Does not assess multi-step triangle solving, applications with bearings or proving the laws.",
  },
  {
    templateId: "trig-triangle-area",
    facetId: "trigonometric-area.HSG.SRT.D.9",
    extent: "partial",
    rationale:
      "Find exact or rounded area from two sides and the included angle, a missing side from the area, and compare areas of supplementary included angles. Does not assess deriving the formula.",
  },
  {
    templateId: "sinusoid-model",
    facetId: "periodic-modeling.HSF.TF.B.5",
    extent: "partial",
    rationale:
      "Choose the sine or cosine model from a maximum, minimum, period and starting position, find one parameter, or evaluate the model at a time. Does not assess fitting models to data or constructing graphs.",
  },
  {
    templateId: "solid-volume-context",
    facetId: "solid-volume-models.core",
    extent: "partial",
    rationale:
      "Select the volume, in terms of π or rounded as stated, of a cylinder, cone, pyramid, sphere or cylinder-and-hemisphere silo in a story: a tank capacity in liters, the number of cones that fill a cylinder, a missing cone height, a pyramid and a rounded paint-can volume. Does not assess surface-area contexts, derivations of the formulas, frustums, or open-response work.",
  },
  {
    templateId: "solid-volume-context",
    facetId: "solid-volume-models.HSG.GMD.A.3",
    extent: "partial",
    rationale:
      "Select the volume, in terms of π or rounded as stated, of a cylinder, cone, pyramid, sphere or cylinder-and-hemisphere silo in a story: a tank capacity in liters, the number of cones that fill a cylinder, a missing cone height, a pyramid and a rounded paint-can volume. Does not assess surface-area contexts, derivations of the formulas, frustums, or open-response work.",
  },
  {
    templateId: "density-context",
    facetId: "density-modeling.core",
    extent: "partial",
    rationale:
      "Select a population density, a mass or a volume from a density with consistent units, a density found from a rectangle's area, a cylinder's mass in terms of π, and the denser of two blocks. Does not assess density of non-uniform objects, derived units beyond g/cm³ and people/km², or written modeling.",
  },
  {
    templateId: "density-context",
    facetId: "density-modeling.HSG.MG.A.2",
    extent: "partial",
    rationale:
      "Select a population density, a mass or a volume from a density with consistent units, a density found from a rectangle's area, a cylinder's mass in terms of π, and the denser of two blocks. Does not assess density of non-uniform objects, derived units beyond g/cm³ and people/km², or written modeling.",
  },
  {
    templateId: "geometric-model-choice",
    facetId: "geometric-modeling.core",
    extent: "partial",
    rationale:
      "Select the solid that models an object, the measure (area, perimeter, surface area or volume) a task needs, a cylinder's label area, a triangular-prism tent volume and a sphere's surface area. Does not assess building or justifying a model from an unlabeled object, or open-ended modeling choices.",
  },
  {
    templateId: "geometric-model-choice",
    facetId: "geometric-modeling.HSG.MG.A.1",
    extent: "partial",
    rationale:
      "Select the solid that models an object, the measure (area, perimeter, surface area or volume) a task needs, a cylinder's label area, a triangular-prism tent volume and a sphere's surface area. Does not assess building or justifying a model from an unlabeled object, or open-ended modeling choices.",
  },
  {
    templateId: "geometric-design-constraint",
    facetId: "geometric-design.core",
    extent: "partial",
    rationale:
      "Select the greatest-area rectangle for a fixed perimeter, the least-material box for a fixed volume, the best three-sided garden among given widths, and a paint cost from areas and a rate. Does not assess searching an unrestricted design space, calculus or quadratic optimization by algebra, or drawing a design.",
  },
  {
    templateId: "geometric-design-constraint",
    facetId: "geometric-design.HSG.MG.A.3",
    extent: "partial",
    rationale:
      "Select the greatest-area rectangle for a fixed perimeter, the least-material box for a fixed volume, the best three-sided garden among given widths, and a paint cost from areas and a rate. Does not assess searching an unrestricted design space, calculus or quadratic optimization by algebra, or drawing a design.",
  },
  {
    templateId: "cavalieri-volume-reasoning",
    facetId: "cavalieri-principle.core",
    extent: "partial",
    rationale:
      "Select the volume of an oblique cylinder or leaning stack from the perpendicular height, the pair of solids Cavalieri's principle guarantees equal, and a volume scaled by a ratio of cross-sectional areas. Does not assess written arguments or derivation of the sphere's volume formula.",
  },
  {
    templateId: "cavalieri-volume-reasoning",
    facetId: "cavalieri-principle.HSG.GMD.A.2",
    extent: "partial",
    rationale:
      "Select the volume of an oblique cylinder or leaning stack from the perpendicular height, the pair of solids Cavalieri's principle guarantees equal, and a volume scaled by a ratio of cross-sectional areas. Does not assess written arguments or derivation of the sphere's volume formula.",
  },
  {
    templateId: "section-revolution-solid",
    facetId: "sections-and-revolutions.core",
    extent: "partial",
    rationale:
      "Select the cross-section of a cylinder, cone or sphere cut by a plane, the solid from rotating a rectangle or right triangle about a side, its volume, and the volume of a sphere from a rotated semicircle. Does not assess sections of other solids (see solid cross-sections), rotation about lines not containing a side, or sketching the solid.",
  },
  {
    templateId: "section-revolution-solid",
    facetId: "sections-and-revolutions.HSG.GMD.B.4",
    extent: "partial",
    rationale:
      "Select the cross-section of a cylinder, cone or sphere cut by a plane, the solid from rotating a rectangle or right triangle about a side, its volume, and the volume of a sphere from a rotated semicircle. Does not assess sections of other solids (see solid cross-sections), rotation about lines not containing a side, or sketching the solid.",
  },
  {
    templateId: "similarity-theorem-length",
    facetId: "similarity-theorems.core",
    extent: "partial",
    rationale:
      "Select a length using the side-splitter theorem or the geometric-mean relations for the altitude to the hypotenuse of a right triangle with integer data. Does not assess written proofs of the theorems, the converse of the side-splitter theorem, or the Pythagorean theorem proof.",
  },
  {
    templateId: "similarity-theorem-length",
    facetId: "similarity-theorems.HSG.SRT.B.4",
    extent: "partial",
    rationale:
      "Select a length using the side-splitter theorem or the geometric-mean relations for the altitude to the hypotenuse of a right triangle with integer data. Does not assess written proofs of the theorems, the converse of the side-splitter theorem, or the Pythagorean theorem proof.",
  },
  {
    templateId: "slope-triangle-statements",
    facetId: "slope.similar-triangle-reasoning",
    extent: "partial",
    rationale:
      "Select true statements about corresponding angles, similarity, congruence, lengths and equal slopes for two right triangles on one nonvertical line. Includes positive and negative slopes and congruent translated or scaled noncongruent pairs. Constructed proofs, arbitrary triangle orientations, horizontal or vertical degeneracies and general line-equation derivation are not assessed.",
  },
  {
    templateId: "whole-sharing-fraction",
    facetId: "fraction-as-division.core",
    extent: "partial",
    rationale:
      "Find the numeric share when 1–3 whole liters are shared among 2–6 people. This does not assess recognizing a written fraction as an expression, constructing a model, or estimating the quotient.",
  },
  {
    templateId: "fraction-division-expression",
    facetId: "fraction-as-division.core",
    extent: "partial",
    rationale:
      "Choose the matching whole-number division expression for bounded unit, proper, and improper fractions. This does not assess constructing a quotient expression, solving a story, or explaining a sharing model.",
  },
  {
    templateId: "complex-multiplication",
    facetId: "complex-numbers.core",
    extent: "partial",
    rationale:
      "Select the exact product of two small integer-coefficient complex numbers in simplified standard form using distributivity and i² = −1, including signed, zero-real-part and cancellation cases. Does not assess addition, subtraction, nonreal quadratic roots, conjugates, division or geometric representation.",
  },
  {
    templateId: "polynomial-behavior-description",
    facetId: "polynomial-behavior.core",
    extent: "partial",
    rationale:
      "Choose the end behavior, the cross-or-touch description at every zero, or the greatest number of turning points from a factored polynomial or a list of terms, with degrees up to 7. Does not assess sketching or reading a graph, factoring an expanded polynomial, finding zeros of an unfactored polynomial, or inequalities.",
  },
  {
    templateId: "rational-function-features",
    facetId: "rational-function-behavior.core",
    extent: "partial",
    rationale:
      "Choose vertical asymptotes, a hole, the horizontal asymptote, intercepts or the domain of a rational function with small linear factors, including a canceled common factor. Does not assess slant asymptotes, sketching, factoring quadratics in the function, or solving rational equations.",
  },
  {
    templateId: "graphical-solution-table",
    facetId: "graphical-equation-solving.core",
    extent: "partial",
    rationale:
      "Read an exact solution, bracket a solution between consecutive integers, or choose the nearest tenth from a table for a quadratic or exponential against a linear function. Does not assess reading a graph, producing a table or graph, or functions other than these.",
  },
  {
    templateId: "polynomial-identity-use",
    facetId: "polynomial-identities.core",
    extent: "partial",
    rationale:
      "Use (a+b)², (a−b)², a²−b² and (x²+y²)² = (x²−y²)² + (2xy)² to compute, build a Pythagorean triple or choose the true equation among near-miss equations. Does not assess written proof of an identity or polynomial identities of higher degree.",
  },
  {
    templateId: "binomial-coefficient",
    facetId: "binomial-theorem.core",
    extent: "partial",
    rationale:
      "Choose a coefficient, the constant term or the leading term of (ax+b)ⁿ with n up to 7 and possibly negative b, or the row of Pascal's triangle. Does not assess writing the full expansion, the summation notation, or general terms with symbolic n.",
  },
  {
    templateId: "number-system-closure-classify",
    facetId: "number-system-closure.core",
    extent: "partial",
    rationale:
      "Classify sums and products of rational and irrational numbers, including the zero exception and irrational pairs with a rational result, and choose a counterexample. Does not assess constructing a written proof or proving a particular number irrational.",
  },
  {
    templateId: "quadratic-irrational-solutions",
    facetId: "quadratic-formula.core",
    extent: "partial",
    rationale:
      "Recognize both distinct irrational real roots of bounded integer-coefficient quadratics in simplified radical form, including signed nonmonic coefficients. Does not assess constructing symbolic responses, formula derivation, rational coefficients, repeated roots or complex solutions.",
  },
  ...assessmentGapFacetMappings,
  ...satCompletionFacetMappings,
  ...satGeometryDataFacetMappings,
  {
    templateId: "radical-equation-isolated",
    facetId: "square-root-equations.isolated-linear-radicand",
    extent: "partial",
    rationale:
      "Exact numeric solutions for bounded linear radicands and nonnegative integer root values; variable right sides and negative isolated constants require separate cases.",
  },
  {
    templateId: "radical-equation-shifted",
    facetId: "square-root-equations.outside-constant",
    extent: "partial",
    rationale:
      "Undo an outside integer constant before squaring; nonnegative isolated root values only, with exact rational answers.",
  },
  {
    templateId: "radical-equation-check",
    facetId: "radical-equations.linear-right-side-check",
    extent: "partial",
    rationale:
      "Select the full solution set from two distinct integer candidates, checking sign and original equality. Includes zero, one or two solutions. Does not assess constructing symbolic solution sets, repeated or irrational candidates, or multiple radicals.",
  },
  {
    templateId: "geometry-proof-step",
    facetId: "geometric-proof.angle-step-reasons",
    extent: "partial",
    rationale:
      "Recognize a justified angle statement in four configurations; constructed and multistep proofs require separate assessment.",
  },
  {
    templateId: "line-angle-proof-reasons",
    facetId: "line-angle-proofs.core",
    extent: "partial",
    rationale:
      "Select the reason for a vertical-angle, alternate-interior-angle or perpendicular-bisector step (including the converse direction), or the equation a vertical-angle step gives with a linear unknown. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "triangle-theorem-consequences",
    facetId: "triangle-proofs.core",
    extent: "partial",
    rationale:
      "Apply isosceles base angles, the midsegment theorem and the 2:1 median ratio to find a measure with a numeric or linear unknown, and select the reason that completes an angle-sum proof step. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "parallelogram-property-consequences",
    facetId: "parallelogram-proofs.core",
    extent: "partial",
    rationale:
      "Select the reason for an opposite-side, opposite-angle, bisecting-diagonal or rectangle-diagonal step, and solve linear-unknown diagonal and consecutive-angle consequences. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "precise-geometric-definitions",
    facetId: "geometric-definitions.core",
    extent: "partial",
    rationale:
      "Choose the precise definition of a circle, parallel lines or an angle and identify the one flawed definition among four (missing plane, interior included, ray versus segment). Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "transformation-invariant-claims",
    facetId: "transformation-invariants.core",
    extent: "partial",
    rationale:
      "Identify which transformations preserve distance and angle, decide from triangle image coordinates whether a map is rigid, a dilation or neither, and apply dilation and rotation definitions. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "polygon-symmetry-counts",
    facetId: "polygon-symmetries.core",
    extent: "partial",
    rationale:
      "Find the smallest rotation, the number of rotations, the lines of reflection and the rotation angles that carry regular polygons, non-square rectangles, parallelograms and isosceles trapezoids onto themselves. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "transformation-sequence-mapping",
    facetId: "transformation-constructions.core",
    extent: "partial",
    rationale:
      "From coordinates of a triangle and its image, choose the single transformation or ordered reflection, rotation, translation or dilation sequence that maps one onto the other. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "compass-straightedge-reasoning",
    facetId: "geometric-constructions.core",
    extent: "partial",
    rationale:
      "Choose the next step, the order of steps or the justification for a perpendicular bisector, angle bisector, perpendicular and parallel-line construction. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "inscribed-polygon-reasoning",
    facetId: "inscribed-polygons.core",
    extent: "partial",
    rationale:
      "Choose why a hexagon side equals the radius, the hexagon perimeter, the central angle of an inscribed regular polygon and the construction method for an inscribed triangle, square or hexagon. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "triangle-circle-centers",
    facetId: "triangle-circles.core",
    extent: "partial",
    rationale:
      "Choose the construction for a circumcenter or incenter and compute opposite angles of an inscribed quadrilateral (with a linear unknown) and the circumradius of a right triangle. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "tangent-circle-computation",
    facetId: "tangent-construction.core",
    extent: "partial",
    rationale:
      "Use the right angle between tangent and radius and equal tangent segments to find tangent lengths, radii, angles and linear unknowns. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "circle-dilation-scaling",
    facetId: "circle-similarity.core",
    extent: "partial",
    rationale:
      "Find the scale factor between two circles, the area and circumference factors, and choose the translation and dilation that map one circle onto another. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "coordinate-quadrilateral-claims",
    facetId: "coordinate-proofs.core",
    extent: "partial",
    rationale:
      "From vertex coordinates, use slopes, distances and dot products to choose the most specific quadrilateral classification proved (square, rectangle, rhombus, parallelogram, trapezoid). Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "measurement-formula-justifications",
    facetId: "measurement-formula-proofs.core",
    extent: "partial",
    rationale:
      "Compute from a sector-rearrangement, cube-into-pyramids or cone-cylinder comparison and choose the justification of the circumference and sector-limit arguments. Written proofs and physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "rational-equation-one-denominator",
    facetId: "rational-equation-one-denominator.constant-numerator",
    extent: "partial",
    rationale:
      "Construct an exact numeric solution with one linear denominator; general rational equations require more families.",
  },
  {
    templateId: "rational-equation-check",
    facetId: "rational-equations.linear-domain-check",
    extent: "partial",
    rationale:
      "Choose all solutions of a bounded linear-over-linear equation; higher-degree and multiple denominators require separate assessment.",
  },
  {
    templateId: "rational-expression-domain",
    facetId: "rational-expression-domain.factored-denominator",
    extent: "partial",
    rationale:
      "Choose excluded integer inputs for a denominator given as two monic linear factors, including a repeated factor. Does not assess expanded or higher-degree denominators, noninteger exclusions or constructed domain statements.",
  },
  {
    templateId: "rational-expression-simplify",
    facetId: "rational-expressions.cancel-common-linear-factor",
    extent: "partial",
    rationale:
      "Choose an equivalent linear-over-linear expression and complete original integer exclusions after factoring bounded quadratics with one shared factor. Recognition only; general rational operations and constructed symbolic responses require separate assessment.",
  },
  ...[
    "nonlinear-system-read",
    "nonlinear-system-solve",
    "nonlinear-system-count",
  ].map((templateId): FacetMapping => ({
    templateId,
    facetId:
      templateId === "nonlinear-system-read"
        ? "nonlinear-intersection-reading.core"
        : templateId === "nonlinear-system-count"
          ? "nonlinear-intersection-count.core"
          : "nonlinear-systems.core",
    extent: "partial",
    rationale:
      "Bounded line–parabola systems: read intersections, find a requested coordinate for distinct integer roots, or count real intersections. Does not assess complete constructed solution sets, other nonlinear pairs, fractional coordinates, contextual modeling or symbolic parameter conditions.",
  })),
  ...factoringFacetMappings,
  ...volumeCoordinateFacetMappings,
  ...shapeFacetMappings,
  ...angleFacetMappings,
  ...polygonFacetMappings,
  ...exponentialFacetMappings,
  ...probabilityRulesFacetMappings,
  ...similarityTrigFacetMappings,
  ...congruenceFacetMappings,
  ...coordinateCircleFacetMappings,
  ...algebraStatisticsFacetMappings,
  ...powerFacetMappings,
  ...distributionFacetMappings,
  ...inferenceFacetMappings,
  ...bivariateFacetMappings,
  ...linePlotFacetMappings,
  ...earlyDataFacetMappings,
  ...radicalFacetMappings,
  ...partWholeFacetMappings,
  ...decimalFacetMappings,
  ...timeMoneyFacetMappings,
  ...attributeFacetMappings,
  ...comparisonFacetMappings,
  ...numberSenseFacetMappings,
  ...multiplyDivideFacetMappings,
  ...addSubtractFacetMappings,
  ...factsFacetMappings,
  ...factArrayFacetMappings,
  ...combinatoricsFacetMappings,
  ...areaVolumeFacetMappings,
  ...transformationFacetMappings,
  ...angleTriangleFacetMappings,
  ...realNumberFacetMappings,
  ...numberSystemFacetMappings,
  ...ratioRateFacetMappings,
  ...patternFunctionFacetMappings,
  ...linearFunctionFacetMappings,
  ...quadraticStructureFacetMappings,
  ...functionToolkitFacetMappings,
  ...twoVariableFacetMappings,
  ...equationFacetMappings,
  ...rationalFacetMappings,
  ...circleMeasurementFacetMappings,
  ...completingSquareFacetMappings,
  ...integerExponentFacetMappings,
  ...descriptiveStatisticsFacetMappings,
  ...percentChangeFacetMappings,
  ...rightTriangleFacetMappings,
  ...absoluteValueFacetMappings,
  ...inequalityFacetMappings,
  ...linearSystemFacetMappings,
];
