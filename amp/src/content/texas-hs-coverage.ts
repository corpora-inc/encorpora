import type { FacetMapping } from "./coverage";

const partial = (
  templateId: string,
  skill: string,
  rationale: string,
): FacetMapping => ({
  templateId,
  facetId: `${skill}.core`,
  extent: "partial",
  rationale,
});

/** Texas high-school requirement gaps; each rationale states what is and is not assessed. */
export const texasHsFacetMappings: readonly FacetMapping[] = [
  partial(
    "line-equation-forms",
    "linear-equation-modeling",
    "Select a line's equation in point-slope, slope-intercept or standard form from a point and an integer slope, from two points with an integer slope, or by converting slope-intercept form with a fractional slope to standard form. Does not assess writing an equation without choices, graphing, or contextual interpretation.",
  ),
  partial(
    "line-relationship-equations",
    "linear-equation-modeling",
    "Select the equation of the line through a point parallel or perpendicular to a line given in slope-intercept or standard form, horizontal and vertical lines through a point, their slopes (zero and undefined), and lines parallel or perpendicular to an axis-parallel line. Does not assess proofs of the slope criteria, written justification or general-position coordinate proofs.",
  ),
  partial(
    "system-equation-choice",
    "systems-modeling",
    "Select the system of two linear equations matching a description of two plans, a total-and-value story, tables of two quantities or a graph of two lines. Does not assess solving the system, three-variable systems, inequalities or writing equations without choices.",
  ),
  partial(
    "graph-estimate-system-solution",
    "linear-systems",
    "Estimate the crossing point of two plotted lines in a cost or savings situation, on grid lines or halfway between them, and choose its ordered pair. Does not assess solving algebraically, exactness beyond one-half units, or nonlinear graphs.",
  ),
  partial(
    "exponential-domain-range",
    "exponential-models",
    "Choose the domain and range as inequalities for shifted and reflected exponential functions and for growth or decay models restricted to t ≥ 0. Does not assess graphing, logarithmic functions or domains restricted by other contexts.",
  ),
  partial(
    "absolute-value-equation-formulate",
    "absolute-value-equations",
    "Select the absolute value equation for numbers a given distance from a center, for two given solutions, or for a measurement that differs from a target by a fixed amount. Does not assess solving the equation, inequalities or written explanation.",
  ),
  partial(
    "rational-equation-formulate",
    "rational-equations",
    "Select the rational equation modeling a work-together, current-speed or two-speed travel situation. Does not assess solving, checking for extraneous solutions, or writing the equation without choices.",
  ),
  partial(
    "rational-exponent-equation",
    "rational-exponents",
    "Solve x^(p/q) = k with small integer exponents, including even numerators (two solutions), even denominators (nonnegative domain) and negative right sides with odd roots. Does not assess equations with several terms, variable bases or radical notation conversion alone.",
  ),
  partial(
    "transformation-composition-image",
    "rigid-motions",
    "Find the image of a single point under a translation, axis or y = x reflection, or a 90° or 180° rotation about the origin together with a dilation about a center other than the origin, in either order. Does not assess figures with several vertices, rotations about other centers, describing a sequence that maps one figure to another or proofs of congruence or similarity.",
  ),
  partial(
    "counterexample-choice",
    "geometric-proof",
    "Choose the counterexample to a conjecture about quadrilaterals, triangle area, rectangle perimeter, side-side-angle triangles or diagonals. Does not assess constructing a counterexample, writing proofs or two-column justification.",
  ),
  partial(
    "spherical-geometry-compare",
    "geometric-definitions",
    "Factual comparison of Euclidean and spherical geometry: parallel lines, triangle angle sums, right angles in triangles and shortest paths, with a line defined as a great circle. Does not assess calculations on a sphere or hyperbolic geometry beyond naming it as different.",
  ),
  partial(
    "regular-polygon-area",
    "geometric-modeling",
    "Find the area of a regular polygon from side and apothem (rounded decimals, a square from its apothem, an equilateral triangle, a hexagon from its side) and find a regular hexagon's apothem or a missing side from area and apothem. Does not assess central-angle derivations, non-special polygons without a given apothem, or composite figures.",
  ),
  partial(
    "curved-solid-surface-area",
    "geometric-modeling",
    "Find the surface area, in terms of π, of a closed cone (given slant height or height), a cylinder with a hemisphere, a cylinder with a cone, and a cone with a hemisphere, counting only exposed faces. Does not assess spheres alone, prisms and pyramids, rounded numerical answers or net drawing.",
  ),
  partial(
    "area-probability",
    "conditional-probability",
    "Find the probability that a random point lands in a circle within a square, a rectangle within a rectangle, a ring or a triangle within a rectangle, or outside a circle, as an exact ratio of areas. Does not assess conditional probability, probabilities by length or volume, or simulation.",
  ),
  partial(
    "composition-order-choice",
    "function-composition",
    "Compare f(g(x)) and g(f(x)) for linear and linear-quadratic pairs that do not commute and for scalings and shifts that do commute, choosing the correct statement. Does not assess domain restrictions, inverse pairs or composition from tables and graphs.",
  ),
  partial(
    "one-sided-behavior-choice",
    "rational-function-behavior",
    "Choose left- and right-sided behavior at a vertical asymptote of a rational function with a simple or squared factor, at a hole, and at a jump of a piecewise linear function. Does not assess limit notation beyond x → c⁻ and x → c⁺, end behavior or graphing.",
  ),
  partial(
    "parametric-rectangular-convert",
    "parametric-models",
    "Eliminate the parameter from linear, parabolic (x = t + p, y = t² + q) and circular parametric equations, and choose parametric equations for a line with a given x. Does not assess restricted parameter intervals, orientation or graphing.",
  ),
  partial(
    "angular-velocity-problem",
    "radians-unit-circle",
    "Find angular speed from revolutions per minute, linear speed of a rim point, angular speed from linear speed, arc distance in a given time and revolutions per minute converted to radians per second. Does not assess variable radius or non-circular motion.",
  ),
  partial(
    "reference-angle-standard-position",
    "radians-unit-circle",
    "Find the reference angle or quadrant of an angle in standard position, in degrees or radians, including negative angles and angles beyond one turn, and the coterminal degree angle in [0°, 360°). Does not assess angles on an axis or evaluating trigonometric functions.",
  ),
  partial(
    "bearing-trig-problem",
    "right-triangle-trigonometry",
    "Resolve a trip on a three-digit or compass bearing of 30° or 60° from a coordinate direction into exact north-south or east-west components, and find a three-digit bearing from two perpendicular legs. Does not assess non-special angles, two-leg trips with a non-right angle or the laws of sines and cosines.",
  ),
  partial(
    "sigma-notation-represent",
    "sequence-sums",
    "Choose sigma notation, with an index starting at 0 or 1, for an arithmetic or geometric series given by its first terms, last term and number of terms. Does not assess evaluating sums, recursive notation or writing without choices.",
  ),
  partial(
    "infinite-geometric-sum",
    "sequence-sums",
    "Find the sum of an infinite geometric series with a rational ratio, listed or in sigma notation starting at index 0 or 1, recognize ratios with absolute value at least 1, and total a bouncing-ball distance. Does not assess finite sums, repeating decimals or convergence proofs.",
  ),
  partial(
    "polynomial-inequality-solve",
    "polynomial-zeros",
    "Choose the interval-notation solution of a polynomial inequality of degree two or three given in factored form (with a possible squared factor and negative leading sign) or as x³ − c²x. Does not assess factoring harder polynomials, inequalities from graphs or context.",
  ),
  partial(
    "rational-inequality-solve",
    "rational-expressions",
    "Choose the interval-notation solution of a rational inequality with one or two numerator and denominator factors, including a squared denominator and non-strict inequalities. Does not assess rewriting a single fraction from several, or inequalities from a context.",
  ),
];
