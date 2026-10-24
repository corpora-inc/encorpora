import { satCompletionFacetMappings } from "./sat-completion-coverage";
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
