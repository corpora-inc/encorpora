import { defineLedger } from "./types";

/** Every released mathematics item (all 42 operational items) of the Spring 2025 MCAS Grade 10 paper-based test, labeled once from the form and its released-item table. The Department states each item's standard, item type and, for selected-response and short-answer items, the answer. The earlier purposive sample of items 2, 3, 10, 25 and 27 is folded into this complete record. */
export const mcasGrade10 = defineLedger(
  {
    id: "mcas-2025-10",
    test: "MCAS grade 10 mathematics",
    form: "Spring 2025 released items",
    url: "https://www.doe.mass.edu/mcas/2025/release/g10-math.pdf",
    edition:
      "Spring 2025 paper-based test, released operational items 1-42 (all operational items); standards, item types and answers as printed in the released-item table (Massachusetts Curriculum Framework for Mathematics, 2017). Calculator permitted in Session 2 only. Replaces the earlier five-item purposive sample of the same form.",
    retrievedAt: "2026-10-26",
    sha256: "01b4fa2c071b3fa5e9641a8ec7f241a78dc0de8a018b95d1d5229d8530442554",
    complete: true,
  },
  { labeledBy: "agent:mcas-first-pass", labeledAt: "2026-10-26" },
  [
    {
      section: "Session 1",
      item: { number: "1", page: "printed p.4; PDF p.6" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["A-REI.B.3"],
      archetypeIds: ["inequality.solve"],
      demand:
        "Find the least value of x that satisfies a one-variable inequality",
      status: "partial",
      templateIds: ["affine-linear-inequality"],
      limitations:
        "affine-linear-inequality chooses the solution set of an inequality; naming the minimum value that satisfies it is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "2", page: "printed p.4; PDF p.6" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["G-C.B.5"],
      archetypeIds: ["circle.arc-sector"],
      demand:
        "Choose the expression for a sector's area from the radius and the unshaded central angle",
      status: "partial",
      templateIds: ["sector-area-coefficient"],
      limitations:
        "Numeric coefficient exists; expression selection and complementary-angle reasoning need explicit cases.",
    },
    {
      section: "Session 1",
      item: { number: "3", page: "printed p.5; PDF p.7" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["A-REI.A.1"],
      archetypeIds: ["linear.step-justification"],
      demand:
        "Choose the table that names the property justifying each step of a linear equation's solution",
      status: "partial",
      templateIds: ["equation-step-property"],
      limitations:
        "Single-step reason practice does not establish a complete multi-step justification.",
    },
    {
      section: "Session 1",
      item: { number: "4", page: "printed p.6; PDF p.8" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["N-RN.A.2"],
      archetypeIds: ["expression.radical"],
      demand: "Evaluate a radical expression using laws of exponents",
      status: "partial",
      templateIds: ["rational-power"],
      limitations:
        "rational-power evaluates a power with a fractional exponent by entry; a radical written with an index and the laws of exponents that combine it are not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "5", page: "printed p.6; PDF p.8" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["A-SSE.B.3"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Select the two values of x that make a quadratic expression zero",
      status: "partial",
      templateIds: [
        "quadratic-factored-solutions",
        "quadratic-expanded-solutions",
      ],
      limitations:
        "Both families choose the complete solution set of a stated quadratic; selecting each solution by multiple selection is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "6", page: "printed pp.7–8; PDF pp.9–10" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["S-ID.B.6"],
      archetypeIds: ["bivariate.scatter", "bivariate.linear-fit"],
      demand:
        "Plot minutes against points, describe the correlation, predict a value and write a linear equation for the data",
      status: "partial",
      templateIds: ["correlation-choice", "regression-line-predict"],
      limitations:
        "Constructed response in four parts. Reading association and predicting from a stated line are practiced; drawing a scatter plot, interpolating without a given line and writing a model equation have no protocol.",
    },
    {
      section: "Session 1",
      item: { number: "7", page: "printed p.9; PDF p.11" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["G-SRT.C.7"],
      archetypeIds: ["triangle.complement"],
      demand:
        "Choose the cosine that equals the sine of an acute angle of a right triangle",
      status: "covered",
      templateIds: ["complementary-trig"],
      limitations:
        "The family uses the sine and cosine relationship of complementary angles.",
    },
    {
      section: "Session 1",
      item: { number: "8", page: "printed p.9; PDF p.11" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["A-REI.D.11"],
      archetypeIds: ["system.solve"],
      demand:
        "Find the x-coordinate where two lines written as y equals expressions intersect",
      status: "partial",
      templateIds: ["linear-system-x"],
      limitations:
        "linear-system-x solves standard-form systems for x; lines written in slope-intercept form are not verified in the checked samples.",
    },
    {
      section: "Session 1",
      item: { number: "9", page: "printed p.10; PDF p.12" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["F-BF.A.2"],
      archetypeIds: ["sequence.rule-forms", "sequence.geometric"],
      demand:
        "Choose the expression for the nth term of a geometric sequence from its first four terms",
      status: "partial",
      templateIds: ["geometric-sequence-rule", "geometric-rule-forms"],
      limitations:
        "geometric-rule-forms builds the explicit rule from a story or a recursive rule; reading the rule from four listed terms is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "10", page: "printed p.10; PDF p.12" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["G-CO.B.7"],
      archetypeIds: ["triangle.congruence-correspondence"],
      demand:
        "Select the three true statements of corresponding sides and angles from a triangle congruence statement",
      status: "missing",
      templateIds: [],
      limitations:
        "Congruence correspondence and selecting all parts need direct practice.",
    },
    {
      section: "Session 1",
      item: { number: "11", page: "printed p.11; PDF p.13" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["A-APR.A.1"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Multiply a monomial by a binomial and count the terms of a binomial times trinomial product, in two linked parts",
      status: "partial",
      templateIds: ["polynomial-multiplication"],
      limitations:
        "polynomial-multiplication expands products of two binomials; a binomial by trinomial product, term counting and linked two-part scoring are not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "12", page: "printed p.12; PDF p.14" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["F-BF.B.3"],
      archetypeIds: ["nonlinear.transform"],
      demand: "Choose the graph of a linear function shifted down two units",
      status: "partial",
      templateIds: ["parabola-shift"],
      limitations:
        "parabola-shift relates vertical shifts of parabolas to equations; choosing the drawn graph of a shifted line is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "13", page: "printed pp.13–14; PDF pp.15–16" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["N-RN.A.1"],
      archetypeIds: ["expression.radical"],
      demand:
        "Evaluate radical and rational-exponent expressions, rewrite a power as a radical and find the value that makes a radical equal four",
      status: "partial",
      templateIds: ["rational-power", "symbolic-rational-exponent"],
      limitations:
        "Constructed response in four parts. Evaluating a fractional power and choosing an equivalent radical are practiced; solving for the unknown in a radical and written work are not.",
    },
    {
      section: "Session 1",
      item: { number: "14", page: "printed p.15; PDF p.17" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["G-CO.C.11"],
      archetypeIds: ["proof.parallelogram"],
      demand:
        "Judge a statement false about a parallelogram's sides and diagonals and find x from angle expressions at the diagonals, in two parts",
      status: "partial",
      templateIds: ["parallelogram-property-consequences"],
      limitations:
        "The family finds measures from parallelogram properties; the false-statement choice, angle expressions meeting at the diagonals and linked scoring are not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "15", page: "printed p.16; PDF p.18" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["A-CED.A.2"],
      archetypeIds: ["line.slope-equation"],
      demand: "Choose the equation of a graphed line with a negative slope",
      status: "partial",
      templateIds: ["graph-equation-choice"],
      limitations:
        "graph-equation-choice matches a line with a positive integer slope and intercept to its equation; a negative slope and intercept are not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "16", page: "printed p.16; PDF p.18" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["N-RN.B.3"],
      archetypeIds: ["number.rational-irrational"],
      demand:
        "Select the two expressions with rational values among sums and products with pi and roots",
      status: "partial",
      templateIds: ["number-system-closure-classify", "classify-real-number"],
      limitations:
        "The families decide one rational or irrational result by choice; selecting two of five expressions by multiple selection is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "17", page: "printed p.17; PDF p.19" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["A-REI.D.12"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Choose the graph of the solution set of a two-variable inequality",
      status: "partial",
      templateIds: ["half-plane-inequality"],
      limitations:
        "half-plane-inequality names the inequality of a shaded region; the inverse, choosing the graph for a stated inequality, is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "18", page: "printed pp.18–19; PDF pp.20–21" },
      responseFormat: "numeric",
      calculator: "not-permitted",
      standards: ["F-IF.C.7"],
      archetypeIds: ["nonlinear.features", "quadratic.context"],
      demand:
        "Read the time of maximum height from a graph and the interval above a stated height, in two parts",
      status: "partial",
      templateIds: ["parabola-vertex", "quadratic-context-model"],
      limitations:
        "parabola-vertex finds a vertex from a rule and quadratic-context-model interprets a quadratic model; reading a maximum and an interval above a height from a graph is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "19", page: "printed p.20; PDF p.22" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["S-ID.A.3"],
      archetypeIds: ["univariate.outliers"],
      demand:
        "Decide how removing an outlier changes the mean and the median of a list",
      status: "covered",
      templateIds: ["outlier-center-shift"],
      limitations:
        "The family decides how adding or removing an outlier changes the mean and the median; the item's data are listed as numbers rather than drawn as a dot plot.",
    },
    {
      section: "Session 1",
      item: { number: "20", page: "printed p.20; PDF p.22" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["G-GPE.A.1"],
      archetypeIds: ["circle.coordinate"],
      demand:
        "Select the two true statements about a circle's center and radius from its equation",
      status: "partial",
      templateIds: ["circle-equation"],
      limitations:
        "circle-equation finds one coordinate or the squared radius by entry; selecting true statements about center and radius by multiple selection is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "21", page: "printed p.21; PDF p.23" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["F-LE.A.1"],
      archetypeIds: ["bivariate.growth"],
      demand:
        "Choose the table that shows a linear relationship between a car's price and its deposit",
      status: "partial",
      templateIds: ["linear-or-exponential"],
      limitations:
        "linear-or-exponential names the kind of function from a description; testing four tables for a constant rate is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "22", page: "printed p.24; PDF p.26" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["G-C.A.2"],
      archetypeIds: ["circle.parts"],
      demand: "Find a central angle from the measure of a major arc",
      status: "partial",
      templateIds: ["circle-angles"],
      limitations:
        "circle-angles uses inscribed angles and diameters; a central angle from the measure of its major arc is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "23", page: "printed p.24; PDF p.26" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["A-SSE.A.1"],
      archetypeIds: ["expression.parts-names"],
      demand:
        "Choose the table that names the coefficient, constant, exponent and variable of a quadratic expression",
      status: "missing",
      templateIds: [],
      limitations: "No family names the parts of an expression.",
    },
    {
      section: "Session 2",
      item: { number: "24", page: "printed p.25; PDF p.27" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["G-CO.A.3"],
      archetypeIds: ["shape.rotational-symmetry"],
      demand: "Choose the figure that has rotational symmetry",
      status: "missing",
      templateIds: [],
      limitations: "No family decides rotational symmetry.",
    },
    {
      section: "Session 2",
      item: { number: "25", page: "printed p.25; PDF p.27" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["N-Q.A.3"],
      archetypeIds: ["number.measurement-error-bound"],
      demand:
        "Find the possible actual height when a claimed height has a four percent error",
      status: "partial",
      templateIds: ["measurement-error-bound"],
      limitations:
        "Explicit absolute and relative bounds are implemented by entry; heights in feet and inches and choice of one possible actual height are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "26", page: "printed p.26; PDF p.28" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["G-GPE.B.4"],
      archetypeIds: ["coordinate.distance-midpoint", "circle.coordinate"],
      demand:
        "Decide whether a plotted point lies inside, on or outside a circle by comparing distances",
      status: "partial",
      templateIds: ["coordinate-distance-exact", "circle-equation"],
      limitations:
        "coordinate-distance-exact finds a distance and circle-equation finds a radius; comparing a point's distance with the radius to place the point is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "27", page: "printed pp.27–28; PDF pp.29–30" },
      responseFormat: "constructed",
      calculator: "permitted",
      standards: ["F-IF.A.2"],
      archetypeIds: ["quadratic.context", "nonlinear.input-output"],
      demand:
        "Evaluate a contextual quadratic at four inputs and interpret the values",
      status: "partial",
      templateIds: ["function-evaluation"],
      limitations:
        "Evaluation component exists; contextual domain restrictions, multipart reasoning and written interpretation remain distinct.",
    },
    {
      section: "Session 2",
      item: { number: "28", page: "printed p.29; PDF p.31" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["S-CP.A.4"],
      archetypeIds: ["probability.direct"],
      demand:
        "Find the probability that a desk chosen from a two-way table is brown",
      status: "partial",
      templateIds: ["relative-frequency-percent", "simple-probability"],
      limitations:
        "relative-frequency-percent finds a percent of a two-way total and simple-probability counts equally likely outcomes; the probability as a fraction of a two-way table margin is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "29", page: "printed p.29; PDF p.31" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["F-LE.B.5"],
      archetypeIds: ["exponential.form"],
      demand:
        "Choose the true statement about the starting value and growth rate of an exponential value model",
      status: "covered",
      templateIds: ["compound-growth", "exponential-time-scale"],
      limitations:
        "The families choose the statement that describes an exponential model written with a per-period growth factor, including a factor of 1.015; the item's model has an exponent in years.",
    },
    {
      section: "Session 2",
      item: { number: "30", page: "printed p.30; PDF p.32" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["G-SRT.A.2"],
      archetypeIds: ["triangle.relationships"],
      demand:
        "Choose the side lengths that could belong to two similar triangles that share a vertex",
      status: "partial",
      templateIds: ["similar-triangles-side"],
      limitations:
        "similar-triangles-side finds one side by proportion; testing four sets of lengths for proportionality is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "31", page: "printed p.30; PDF p.32" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["G-GPE.B.5"],
      archetypeIds: ["line.parallel-perpendicular"],
      demand: "Choose the slopes that two perpendicular lines could have",
      status: "partial",
      templateIds: ["perpendicular-slopes"],
      limitations:
        "perpendicular-slopes finds a slope or intercept by entry for nonvertical lines; the horizontal and vertical pair is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "32", page: "printed p.31; PDF p.33" },
      responseFormat: "numeric",
      calculator: "permitted",
      standards: ["N-Q.A.2"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Use a rate of 160 umbrellas in two and a half hours to estimate output in eight hours and the hours for 1100, in two parts",
      status: "partial",
      templateIds: ["unit-rate", "ratio-missing"],
      limitations:
        "Related families find a unit rate or a missing term by entry; a rate with a time in hours and minutes, rounding and linked two-part scoring are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "33", page: "printed p.32; PDF p.34" },
      responseFormat: "multi-select",
      calculator: "permitted",
      standards: ["G-GMD.A.3"],
      archetypeIds: ["measure.scale", "measure.volume"],
      demand:
        "Select the two true statements about how a cylinder's volume changes when its radius or its height is multiplied",
      status: "partial",
      templateIds: ["cylinder-volume"],
      limitations:
        "cylinder-volume finds a volume or a dimension; reasoning about scaling one dimension at a time and selecting two statements are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "34", page: "printed pp.33–34; PDF pp.35–36" },
      responseFormat: "constructed",
      calculator: "permitted",
      standards: ["G-SRT.B.5"],
      archetypeIds: ["triangle.relationships", "angle.relationships"],
      demand:
        "Find an angle, the scale factor and two side lengths of similar triangles from a diagram, showing the work",
      status: "partial",
      templateIds: ["similar-triangles-side"],
      limitations:
        "Constructed response in four parts. similar-triangles-side finds one side by entry; the angle, scale factor and explanations are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "35", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["S-ID.C.8"],
      archetypeIds: ["bivariate.correlation", "bivariate.scatter"],
      demand:
        "Describe the association from a correlation coefficient and the sign of the best-fit line's slope, in two parts",
      status: "partial",
      templateIds: ["correlation-choice"],
      limitations:
        "correlation-choice compares given coefficients; stating the strength and direction of one coefficient and linking its sign to the slope are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "36", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["S-CP.B.6"],
      archetypeIds: ["probability.conditional"],
      demand:
        "Find the conditional probability that a chicken lays eggs from two percentages",
      status: "partial",
      templateIds: ["conditional-probability-value"],
      limitations:
        "conditional-probability-value uses tables and Venn diagrams; a conditional probability from two stated percentages is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "37", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["G-CO.D.13"],
      archetypeIds: ["construction.compass-straightedge"],
      demand:
        "Name the figure that a described six-arc compass construction completes",
      status: "partial",
      templateIds: ["compass-straightedge-reasoning"],
      limitations:
        "compass-straightedge-reasoning orders or justifies the steps of bisector constructions; identifying an inscribed hexagon from its steps is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "38", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["G-CO.A.5"],
      archetypeIds: ["transformation.identify"],
      demand:
        "Choose the reflection and translation that map one graphed pentagon onto another",
      status: "partial",
      templateIds: ["transformation-sequence-mapping"],
      limitations:
        "transformation-sequence-mapping maps triangles given by listed vertices; reading graphed pentagons is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "39", page: "printed pp.39–40; PDF pp.41–42" },
      responseFormat: "numeric",
      calculator: "permitted",
      standards: ["G-GMD.A.1"],
      archetypeIds: ["measure.volume", "measure.cavalieri"],
      demand:
        "Find a right cylinder's volume and compare it with an oblique cylinder of the same base and height, in two parts",
      status: "partial",
      templateIds: ["cylinder-volume", "cavalieri-volume-reasoning"],
      limitations:
        "cylinder-volume gives a volume in terms of pi and cavalieri-volume-reasoning finds an oblique solid's volume; a rounded decimal volume and the stated comparison of the two cylinders are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "40", page: "printed p.41; PDF p.43" },
      responseFormat: "numeric",
      calculator: "permitted",
      standards: ["A-REI.C.5"],
      archetypeIds: ["system.solve"],
      demand:
        "Find the coefficient that makes an equivalent system for elimination",
      status: "partial",
      templateIds: ["elimination-equivalent"],
      limitations:
        "elimination-equivalent chooses the equation after a stated multiplication and addition; finding the unknown coefficient by entry is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "41", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["G-SRT.A.1"],
      archetypeIds: ["transformation.dilation", "measure.scale"],
      demand:
        "Find the scale factor of a dilation about a plotted point that is not the origin",
      status: "partial",
      templateIds: ["dilation-scale-factor"],
      limitations:
        "dilation-scale-factor uses vertex coordinates and a center at the origin; a plotted center and image are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "42", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["F-IF.B.4"],
      archetypeIds: ["line.slope-sign"],
      demand:
        "Decide the sign of a linear function's slope when its output falls as its input rises",
      status: "missing",
      templateIds: [],
      limitations:
        "No family decides the sign of a slope from a description of how the variables change.",
    },
  ],
);
