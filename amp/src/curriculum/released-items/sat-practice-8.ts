import { defineLedger } from "./types";

/** Every Math item of the nonadaptive Practice Test 8 form, labeled once.
 * SAT skills are classified against the Assessment Framework; the answer
 * explanations do not state them. */
export const satPractice8 = defineLedger(
  {
    id: "sat-practice-8",
    test: "SAT",
    form: "Practice Test 8",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-8-digital.pdf",
    edition:
      "Nonadaptive linear form of the digital SAT; test PDF modified 2024-12-05, answer explanations modified 2024-12-04",
    retrievedAt: "2026-10-26",
    sha256: "b1599121d38fd6f1f3207774c4bad4d73aceac43dd46ad3dd95f08c60f145b63",
    supplements: [
      {
        role: "answer explanations",
        url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-8-answers-digital.pdf",
        sha256:
          "bdfd870bbf13da9d01bffcf2f6a0738e6c9c397193ae8733087ca57e2f1401cc",
      },
    ],
    complete: true,
  },
  {
    labeledBy: "agent:sat-first-pass",
    labeledAt: "2026-10-26",
    calculator: "permitted",
  },
  [
    {
      section: "Math module 1",
      item: { number: "1", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Evaluate a proportional distance-time equation at a given time in context",
      status: "covered",
      templateIds: ["dependent-variable-value"],
      limitations:
        "Samples give the same d = kt style equation in context and ask for one variable from the other; answer choices are plain numbers, so numeric entry fits.",
    },
    {
      section: "Math module 1",
      item: { number: "2", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.psda.probability"],
      archetypeIds: ["probability.direct"],
      demand:
        "Find the probability of a random selection having a property from a stated rate per hundred",
      status: "covered",
      templateIds: ["simple-probability"],
      limitations:
        "Samples compute favorable over total for equally likely objects; choices are plain fractions the learner would produce.",
    },
    {
      section: "Math module 1",
      item: { number: "3", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Read the y-intercept of a graphed line and report it as a coordinate point",
      status: "partial",
      templateIds: ["graph-equation-choice"],
      limitations:
        "graph-equation-choice reads the intercept only implicitly while matching an equation to a graphed line; no template asks for the y-intercept itself as an ordered pair or offers axis-swap distractors.",
    },
    {
      section: "Math module 1",
      item: { number: "4", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.polynomial"],
      demand: "Add two quadratic trinomials by combining like terms",
      status: "covered",
      templateIds: ["polynomial-addition"],
      limitations:
        "Samples add polynomials of degree up to 3 with signed coefficients and choice of the sum.",
    },
    {
      section: "Math module 1",
      item: { number: "5", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.psda.inference-margin-of-error"],
      archetypeIds: ["inference.margin"],
      demand:
        "Choose the plausible range for a population mean from a sample estimate and its margin of error",
      status: "covered",
      templateIds: ["margin-of-error-interval"],
      limitations:
        "Samples include a sample mean with a margin of error in units and choose the centered interval; item phrases choices as statements about the interval, same task.",
    },
    {
      section: "Math module 1",
      item: { number: "6", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.solve"],
      demand: "Solve a one-step addition equation with decimal values",
      status: "covered",
      templateIds: ["one-step-equation"],
      limitations: "Samples include x + p = q with decimals and numeric entry.",
    },
    {
      section: "Math module 1",
      item: { number: "7", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.of"],
      demand: "Find a given percent of a whole-number quantity in context",
      status: "covered",
      templateIds: ["percent-of"],
      limitations:
        "Samples ask for p% of a whole number with numeric entry; item adds a one-line context only.",
    },
    {
      section: "Math module 1",
      item: { number: "8", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Find the constant term of a linear function from its slope and one function value",
      status: "covered",
      templateIds: ["sat-entry-fn-linear-notation", "recover-linear-intercept"],
      limitations:
        "constant-term gives the coefficient of x and one input-output pair in function notation and asks for the constant. Choices are plain numbers, so exact numeric entry practices the same answer.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 1",
      item: { number: "9", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["triangle.relationships"],
      demand:
        "Use a similarity correspondence to state the measure of a corresponding angle",
      status: "covered",
      templateIds: ["corresponding-angle-transfer"],
      limitations:
        "Original single-choice items match vertices through a similarity statement and ask a corresponding angle, with other-vertex, supplement and complement distractors. Proving similarity and the released item's own figure are not reproduced.",
    },
    {
      section: "Math module 1",
      item: { number: "10", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.parallel-perpendicular"],
      demand:
        "Choose the slope-intercept equation of a line through a given intercept parallel to a given line",
      status: "partial",
      templateIds: ["perpendicular-slopes"],
      limitations:
        "perpendicular-slopes is numeric (enter b or a slope) and emphasizes perpendicular lines; the item chooses a whole equation among swapped slope/intercept distractors.",
    },
    {
      section: "Math module 1",
      item: { number: "11", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["bivariate.linear-fit"],
      demand:
        "Choose the linear model equation for a scatterplot by the signs of its slope and intercept",
      status: "partial",
      templateIds: ["nonlinear-data-model", "trend-line-predict"],
      limitations:
        "nonlinear-data-model chooses among model types by squared residuals from listed points; trend-line-predict is numeric prediction from a drawn line. Neither asks to pick an equation by sign of slope and intercept from an unlabeled scatterplot.",
    },
    {
      section: "Math module 1",
      item: { number: "12", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the exponential equation for a quantity growing by a fixed percent per year from an initial value",
      status: "covered",
      templateIds: ["exponential-model-rule"],
      limitations:
        "Samples include percent-change stories choosing a·b^x with distractors that swap the factor (e.g. 1 − r vs 1 + r); growth and decay stories both appear.",
    },
    {
      section: "Math module 1",
      item: { number: "13", page: "printed p.34; PDF p.36" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand:
        "Solve a two-equation linear system by elimination and enter one variable",
      status: "covered",
      templateIds: ["sat-entry-system-solve"],
      limitations:
        "Samples are standard-form 2×2 systems with numeric entry of x or y; item numbers are larger but elimination is the same.",
    },
    {
      section: "Math module 1",
      item: { number: "14", page: "printed p.34; PDF p.36" },
      responseFormat: "numeric",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.coefficient-match"],
      demand:
        "Find the constant multiplier that makes a factored form equal a two-term polynomial with a common monomial factor",
      status: "partial",
      templateIds: ["greatest-monomial-factor"],
      limitations:
        "greatest-monomial-factor is choice-only and asks for the full GCF factorization; the item is numeric entry of a constant found by matching coefficients with a non-GCF inner binomial.",
    },
    {
      section: "Math module 1",
      item: { number: "15", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.features"],
      demand: "Count the real zeros of a cubic function from its graph",
      status: "partial",
      templateIds: ["zeros-from-factors", "polynomial-behavior-description"],
      limitations:
        "zeros-from-factors matches a graph to a factored equation and polynomial-behavior-description reasons from factored rules; neither asks to count x-intercepts read from a graph of an unfactored cubic.",
    },
    {
      section: "Math module 1",
      item: { number: "16", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["expression.context-meaning"],
      demand:
        "Identify which factor of a product-form area expression represents a named dimension",
      status: "partial",
      templateIds: ["structure-meaning"],
      limitations:
        "structure-meaning interprets terms/coefficients of height, population and fee formulas; samples do not include factors of an area product or choices that are expressions.",
    },
    {
      section: "Math module 1",
      item: { number: "17", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["nonlinear.literal"],
      demand:
        "Rearrange a rational formula to isolate a grouped denominator expression in terms of the other variables",
      status: "covered",
      templateIds: ["formula-isolate"],
      limitations:
        "Samples isolate a variable in product and quotient formulas (e.g. divide by a grouped factor) with symbolic choices; item isolates a grouped expression, same multiply/divide structure.",
    },
    {
      section: "Math module 1",
      item: { number: "18", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.scale"],
      demand:
        "Compare areas of two circles whose radii are given as multiples of a common parameter",
      status: "partial",
      templateIds: ["circle-dilation-scaling"],
      limitations:
        "circle-dilation-scaling gives the scale factor and asks how area scales; the item first forms the radius ratio from parameter multiples and has a large squared factor.",
    },
    {
      section: "Math module 1",
      item: { number: "19", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.angle-units"],
      demand:
        "Add two angle measures given in radians and convert the sum to degrees",
      status: "partial",
      templateIds: ["degree-radian-conversion"],
      limitations:
        "degree-radian-conversion converts a single radian measure; it does not practice adding radian fractions with unlike denominators before converting.",
    },
    {
      section: "Math module 1",
      item: { number: "20", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.features"],
      demand:
        "Find the input at which a standard-form quadratic reaches its minimum",
      status: "covered",
      templateIds: ["parabola-axis"],
      limitations:
        "Samples include standard-form quadratics asking for the axis of symmetry x = k with numeric entry, the same value as the minimizing input.",
    },
    {
      section: "Math module 1",
      item: { number: "21", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.context"],
      demand:
        "Use a budget inequality and a minimum-count inequality together to find the greatest whole number of the pricier item",
      status: "partial",
      templateIds: ["linear-model-value", "constraint-feasible"],
      limitations:
        "linear-model-value handles one budget inequality with a fee and rate; constraint-feasible is choice-only point testing. No template optimizes a whole-number quantity under two simultaneous constraints with numeric entry.",
    },
    {
      section: "Math module 1",
      item: { number: "22", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Choose the point that satisfies both inequalities of a two-inequality system",
      status: "partial",
      templateIds: ["inequality-solution-point", "constraint-feasible"],
      limitations:
        "inequality-solution-point tests points against one inequality with its graph; constraint-feasible tests a contextual two-inequality system with a shaded region. The item is an abstract system with no graph.",
    },
    {
      section: "Math module 1",
      item: { number: "23", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.outliers"],
      demand:
        "Decide how adding an extreme value to a frequency-table data set changes its mean and median",
      status: "covered",
      templateIds: ["frequency-table-center"],
      limitations:
        "Samples show a frequency table, add one new value, and choose how the mean and median change.",
    },
    {
      section: "Math module 1",
      item: { number: "24", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Find all solutions of an equation equating a linear factor to a product containing that factor and a parameter",
      status: "partial",
      templateIds: ["quadratic-factored-solutions"],
      limitations:
        "quadratic-factored-solutions solves a numeric product of linear factors set to zero; the item requires moving terms and factoring out a shared binomial with a symbolic parameter, avoiding division by the factor, in a Roman-numeral format.",
    },
    {
      section: "Math module 1",
      item: { number: "25", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.system", "nonlinear.features"],
      demand:
        "Find the horizontal line meeting a downward parabola exactly once by locating its vertex value",
      status: "partial",
      templateIds: ["nonlinear-system-count", "parabola-vertex"],
      limitations:
        "nonlinear-system-count only counts intersections numerically; parabola-vertex finds integer vertices. No template solves for the constant giving a single intersection, and fractional vertex values are not shown.",
    },
    {
      section: "Math module 1",
      item: { number: "26", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.features"],
      demand:
        "Decide which of two exponential function forms on a nonnegative domain shows its maximum value as a constant or coefficient",
      status: "partial",
      templateIds: ["structure-meaning", "function-graph-features"],
      limitations:
        "structure-meaning interprets an exponential coefficient as the initial value but not maxima; function-graph-features reads exponential features but is not SAT-eligible. Neither covers growth-vs-decay maximum reasoning with a vertical shift in Roman-numeral format.",
    },
    {
      section: "Math module 1",
      item: { number: "27", page: "printed p.38; PDF p.40" },
      responseFormat: "numeric",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.special", "circle.parts"],
      demand:
        "Find the circumradius of an equilateral triangle from its perimeter and enter the coefficient of a square-root radius",
      status: "covered",
      templateIds: ["special-triangle-in-figure"],
      limitations:
        "An equilateral triangle's perimeter gives its side and numeric entry asks the coefficient of the square root in the circumradius, using 30-60-90 triangles.",
    },
    {
      section: "Math module 2",
      item: { number: "1", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Read the y-intercept of a graphed line and report it as a coordinate point",
      status: "partial",
      templateIds: ["graph-equation-choice"],
      limitations:
        "graph-equation-choice reads the intercept only implicitly while matching an equation; no template asks for the intercept point itself.",
    },
    {
      section: "Math module 2",
      item: { number: "2", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["data.graph-read"],
      demand:
        "Find the difference between two values read from a category table",
      status: "partial",
      templateIds: ["scaled-bar-graph", "bar-chart-difference"],
      limitations:
        "Templates read differences from bar or picture graphs with small elementary numbers; the item reads three-digit values from a table.",
    },
    {
      section: "Math module 2",
      item: { number: "3", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Find an angle formed by a transversal across parallel lines from a given angle",
      status: "covered",
      templateIds: ["parallel-lines-angle"],
      limitations:
        "Samples include a parallel-transversal figure with one marked angle and equal or supplementary pairs; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "4", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["function.rule"],
      demand:
        "Choose the linear cost equation for a per-day rate plus a one-time fee",
      status: "covered",
      templateIds: ["linear-model-equation"],
      limitations:
        "Samples include word stories with a starting fee plus a rate, choosing among swapped rate/fee distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "5", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.pythagorean"],
      demand:
        "Choose the radical expression for a hypotenuse from two given legs",
      status: "partial",
      templateIds: ["right-triangle"],
      limitations:
        "right-triangle is numeric (computes a hypotenuse from integer triples); the item chooses the unevaluated square-root expression against sum/product distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "6", page: "printed p.43; PDF p.45" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Find the input of a proportional linear function that gives a stated output",
      status: "covered",
      templateIds: ["sat-entry-fn-linear-notation", "dependent-variable-value"],
      limitations:
        "input-proportional solves f(x) = kx = v in function notation, with numeric entry.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 2",
      item: { number: "7", page: "printed p.43; PDF p.45" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.input-output"],
      demand: "Evaluate a cubic function at an integer input",
      status: "partial",
      templateIds: ["function-evaluation"],
      limitations:
        "function-evaluation evaluates quadratics only; the item evaluates a cubic term.",
    },
    {
      section: "Math module 2",
      item: { number: "8", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.intercepts"],
      demand:
        "Find the y-intercept point of a linear function with a fractional slope",
      status: "partial",
      templateIds: ["recover-linear-intercept"],
      limitations:
        "recover-linear-intercept finds the output at zero from a rate and another point; no template asks for the y-intercept as an ordered pair from a rule, with axis-swap distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "9", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Choose the two-variable linear equation for a total built from two item sizes",
      status: "covered",
      templateIds: ["sat-fn-constraint-choice", "system-model-value"],
      limitations:
        "sales and points choose ax + by = c for a total from two prices or values, with swapped, reciprocal and product distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "10", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.transform"],
      demand: "Choose the rule for a cubic graph shifted vertically",
      status: "covered",
      templateIds: ["transform-equation"],
      limitations:
        "Samples include cubic parent graphs with shifts and choose the transformed equation; up/down sign distractors appear.",
    },
    {
      section: "Math module 2",
      item: { number: "11", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand:
        "Solve a linear system by substitution and select one variable's value",
      status: "covered",
      templateIds: ["sat-entry-system-solve", "linear-system-pair"],
      limitations:
        "Templates solve 2×2 systems for one variable (numeric) or the pair (choice); choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "12", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.trig-ratio"],
      demand:
        "Write the sine of an acute angle as opposite over hypotenuse from labeled sides",
      status: "covered",
      templateIds: ["trig-ratio"],
      limitations:
        "Samples write exact sin/cos ratios from labeled right-triangle sides; choices are plain fractions.",
    },
    {
      section: "Math module 2",
      item: { number: "13", page: "printed p.44; PDF p.46" },
      responseFormat: "numeric",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.area"],
      demand: "Find the area of a rectangle from its length and width",
      status: "covered",
      templateIds: ["rectangle-area"],
      limitations:
        "Same rectangle-area task with numeric entry; the item's larger two-digit sides are calculator work.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 2",
      item: { number: "14", page: "printed p.45; PDF p.47" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.structure"],
      demand:
        "Use a known ratio of two variables to find an unknown constant in a related rational expression",
      status: "missing",
      templateIds: [],
      limitations:
        "No template substitutes a known ratio into a related expression to solve for a constant; linear.structure hints (equation-step-property, literal-equation-solve) practice neither this nor any value-of-expression task.",
    },
    {
      section: "Math module 2",
      item: { number: "15", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.context"],
      demand:
        "Find elapsed time for a quantity decreasing at a constant slow rate from a start to an end amount",
      status: "partial",
      templateIds: ["two-step-word-problem", "linear-model-value"],
      limitations:
        "Templates use whole-number per-unit rates (e.g. liters per minute); the item gives the rate as one unit per several days, which requires inverting the rate.",
    },
    {
      section: "Math module 2",
      item: { number: "16", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.structure"],
      demand:
        "Find the value of a repeated grouped expression in a linear equation by treating it as a single unknown",
      status: "covered",
      templateIds: ["sat-entry-fn-related-value", "grouped-linear-equation"],
      limitations:
        "grouped-unit treats a group repeated on both sides as one unknown and asks for its value; the numeric answer is the group's value, so a distractor equal to x is not needed.",
    },
    {
      section: "Math module 2",
      item: { number: "17", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Interpret a coefficient-variable product in a two-variable linear equation modeling a total over two regions",
      status: "partial",
      templateIds: ["interpret-linear-parameters"],
      limitations:
        "interpret-linear-parameters interprets slope and intercept of y = mx + b models; the item interprets a variable in standard form ax + by = c as a per-unit rate.",
    },
    {
      section: "Math module 2",
      item: { number: "18", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.radical"],
      demand:
        "Choose the radical form equivalent to a rational-exponent power when the radical is written with an unreduced index and power",
      status: "partial",
      templateIds: ["symbolic-rational-exponent"],
      limitations:
        "symbolic-rational-exponent converts between a reduced radical and its rational exponent; the item's correct choice uses a scaled-up index and power that must be reduced to match.",
    },
    {
      section: "Math module 2",
      item: { number: "19", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.spread", "univariate.center"],
      demand:
        "Compare medians and standard deviations of two symmetric dot plots that differ only in their extreme frequencies",
      status: "partial",
      templateIds: ["standard-deviation-compare", "frequency-table-center"],
      limitations:
        "standard-deviation-compare uses short value lists (translation/scaling/spread changes), not dot plots; median comparison and the Roman-numeral format are not combined.",
    },
    {
      section: "Math module 2",
      item: { number: "20", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.parts", "angle.relationships"],
      demand:
        "Find a base angle of an isosceles triangle formed by two radii and a chord from the central angle",
      status: "covered",
      templateIds: ["circle-radii-triangle"],
      limitations:
        "Numeric entry of a base angle from a central angle or minor arc through equal radii. The released item's figure is replaced by a written setup.",
    },
    {
      section: "Math module 2",
      item: { number: "21", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.change"],
      demand:
        "Apply a percent decrease to a price, then recover an earlier cost from a percent increase to that result",
      status: "partial",
      templateIds: ["percent-change-final", "percent-change-original"],
      limitations:
        "Each template practices one step (apply a change, or undo a change); no template chains a forward change with a reverse change on a different base.",
    },
    {
      section: "Math module 2",
      item: { number: "22", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.volume"],
      demand:
        "Find the volume left inside a cube after removing an inscribed sphere, rounded",
      status: "partial",
      templateIds: ["cone-sphere-volume", "solid-volume-context"],
      limitations:
        "Templates find sphere volume or composite sums; none subtracts an inscribed sphere from a cube or links the sphere radius to the cube edge.",
    },
    {
      section: "Math module 2",
      item: { number: "23", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.classify"],
      demand:
        "Choose a second linear equation that makes a system with a given line have no solution",
      status: "partial",
      templateIds: ["linear-system-solution-count", "parameter-solution-count"],
      limitations:
        "linear-system-solution-count classifies a given system; parameter-solution-count enters a parameter. Neither asks to choose an equation (parallel and distinct) among rearranged standard-form candidates.",
    },
    {
      section: "Math module 2",
      item: { number: "24", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["triangle.relationships"],
      demand:
        "Use coordinates of two right triangles sharing a vertex to relate an angle of one to an angle of the other",
      status: "partial",
      templateIds: ["dilation-measure"],
      limitations:
        "dilation-measure states that dilations keep angles; no template recognizes isosceles right triangles from coordinates with a parameter or expresses one angle in terms of another.",
    },
    {
      section: "Math module 2",
      item: { number: "25", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.classify"],
      demand:
        "Recognize equivalent linear equations and choose a parametric point that lies on both for every value of a parameter",
      status: "partial",
      templateIds: ["linear-system-solution-count"],
      limitations:
        "linear-system-solution-count identifies infinitely many solutions but never asks to describe the solution set with a parameter.",
    },
    {
      section: "Math module 2",
      item: { number: "26", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.rational-radical"],
      demand:
        "Solve an equation with a shared radical denominator and a parameter, choosing one solution expressed in the parameter",
      status: "partial",
      templateIds: ["radical-equation-check", "rational-equation-check"],
      limitations:
        "Templates solve numeric radical or rational equations; none combines a radical in a denominator, a symbolic parameter, and symbolic answer choices.",
    },
    {
      section: "Math module 2",
      item: { number: "27", page: "printed p.48; PDF p.50" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.quadratic-from-data", "quadratic.context"],
      demand:
        "Build a quadratic model from its vertex and a zero in context and evaluate it at another input, rounded",
      status: "partial",
      templateIds: ["quadratic-from-data", "sat-entry-quadratic-context"],
      limitations:
        "quadratic-from-data chooses an equation from a vertex and a point; sat-entry-quadratic-context reads values from a given height model. No numeric template builds the model from context and then evaluates it.",
    },
  ],
);
