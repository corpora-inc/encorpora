import { defineLedger } from "./types";

/** Every Math item of the nonadaptive Practice Test 10 form, labeled once.
 * SAT skills are classified against the Assessment Framework; the answer
 * explanations do not state them. */
export const satPractice10 = defineLedger(
  {
    id: "sat-practice-10",
    test: "SAT",
    form: "Practice Test 10",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-10-digital.pdf",
    edition:
      "Nonadaptive linear form of the digital SAT; test PDF modified 2024-12-05, answer explanations modified 2024-11-19",
    retrievedAt: "2026-10-26",
    sha256: "4dda8203caba0f4a377f6b0ff72b194799483cd39e3145e96f68dfc872d1cc2c",
    supplements: [
      {
        role: "answer explanations",
        url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-10-answers-digital.pdf",
        sha256:
          "50ef64c8c9dd47e63eef7a247ef09f258451dabd68e93ea2f0dca5674f5f2d6f",
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
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["data.graph-read"],
      demand:
        "Read a line graph of percents by category year and name the category with the least value",
      status: "partial",
      templateIds: ["scaled-bar-graph"],
      limitations:
        "Only scaled bar and picture graphs with numeric totals or differences; no line graph and no picking the category where the value is least.",
    },
    {
      section: "Math module 1",
      item: { number: "2", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.graph"],
      demand:
        "Read the solution of a system of two linear equations as the intersection point of their graphed lines",
      status: "partial",
      templateIds: ["nonlinear-system-read", "linear-system-pair"],
      limitations:
        "No template reads the intersection of two graphed lines; nonlinear-system-read reads one coordinate of a line-parabola intersection (numeric) and linear-system-pair solves symbolically.",
    },
    {
      section: "Math module 1",
      item: { number: "3", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.context"],
      demand:
        "Choose the inequality for a one-time fee plus an hourly rate that must stay at or under a budget",
      status: "covered",
      templateIds: [
        "inequality-from-context",
        "two-step-equation-model",
        "linear-model-value",
        "fee-budget-inequality",
      ],
      limitations:
        "fee-budget-inequality (write-inequality) chooses the inequality for a one-time fee plus a per-unit cost that stays at most within a budget, among four inequalities.",
    },
    {
      section: "Math module 1",
      item: { number: "4", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.transform"],
      demand:
        "Choose the graph that results from translating a given V-shaped graph up by a few units",
      status: "partial",
      templateIds: ["transform-equation"],
      limitations:
        "Templates match a transformed graph to an equation or describe the change in words; none offers candidate graphs of a shifted graph to choose from.",
    },
    {
      section: "Math module 1",
      item: { number: "5", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Evaluate a given affine model of a quantity in context at a stated input",
      status: "covered",
      templateIds: [
        "sat-entry-fn-linear-notation",
        "dependent-variable-value",
        "substitute-linear-expression",
      ],
      limitations:
        "evaluate-contextual gives a fee- or start-plus-rate model with a nonzero constant in function notation and asks for its value at a stated input. Choices are plain numbers, so exact numeric entry practices the same answer.",
    },
    {
      section: "Math module 1",
      item: { number: "6", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.input-output"],
      demand:
        "Evaluate a quadratic function with integer coefficients at a small integer input",
      status: "covered",
      templateIds: ["function-evaluation"],
      limitations:
        "Samples evaluate integer-coefficient quadratics at small integer inputs, the same task and format.",
    },
    {
      section: "Math module 1",
      item: { number: "7", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.context"],
      demand:
        "Write a fee-plus-per-person budget inequality and take the greatest whole-number count",
      status: "covered",
      templateIds: ["linear-model-value"],
      limitations:
        "Samples include a fee plus a per-unit rate under a budget asking for the greatest whole count with a non-integer quotient; the item's decimal rate is calculator work only.",
    },
    {
      section: "Math module 1",
      item: { number: "8", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.psda.probability"],
      archetypeIds: ["probability.direct"],
      demand:
        "Find the probability of a category's marginal total from a two-way frequency table",
      status: "partial",
      templateIds: ["simple-probability", "relative-frequency-percent"],
      limitations:
        "simple-probability states two category counts in text; relative-frequency-percent reads a marginal share from a two-way table but answers as a percent, not a probability.",
    },
    {
      section: "Math module 1",
      item: { number: "9", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: [
        "triangle.congruence-correspondence",
        "angle.relationships",
      ],
      demand:
        "Use a congruence correspondence of right triangles and the angle sum to find a corresponding angle",
      status: "covered",
      templateIds: ["corresponding-angle-transfer"],
      limitations:
        "The congruent-right variant transfers an acute angle of a right triangle through a congruence statement using the 90-degree sum. Proofs and the released figure are not reproduced.",
    },
    {
      section: "Math module 1",
      item: { number: "10", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.structure"],
      demand:
        "Find the value of a multiple of a linear expression by scaling the given equation rather than solving",
      status: "covered",
      templateIds: ["sat-entry-fn-related-value", "system-expression-value"],
      limitations:
        "scaled-equation scales a single two-variable equation, by an integer, negative or half multiple, to a target expression and asks for its value. Choices are plain numbers, so exact numeric entry practices the same answer.",
    },
    {
      section: "Math module 1",
      item: { number: "11", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.exponent-rules"],
      demand:
        "Multiply two three-variable monomials with positive and negative exponents and choose the equivalent expression",
      status: "partial",
      templateIds: ["product-of-powers-exponent"],
      limitations:
        "Numeric entry of one exponent for a single base; the item multiplies multi-variable monomials and selects an equivalent expression.",
    },
    {
      section: "Math module 1",
      item: { number: "12", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["bivariate.growth"],
      demand:
        "Classify a constant-rate descent story as decreasing linear rather than exponential or increasing",
      status: "partial",
      templateIds: ["linear-or-exponential"],
      limitations:
        "Choices are only linear/exponential/neither from increasing stories or tables; no decreasing models and no direction of change.",
    },
    {
      section: "Math module 1",
      item: { number: "13", page: "printed p.37; PDF p.39" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand:
        "Solve a two-equation linear system with matching x-terms and enter y",
      status: "covered",
      templateIds: ["sat-entry-system-solve"],
      limitations:
        "Numeric entry of x or y from a 2x2 system; elimination solves the item directly.",
    },
    {
      section: "Math module 1",
      item: { number: "14", page: "printed p.37; PDF p.39" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.transform", "nonlinear.input-output"],
      demand: "Evaluate at zero a factored cubic after a vertical translation",
      status: "covered",
      templateIds: ["shifted-polynomial-features"],
      limitations:
        "Evaluates a vertically shifted factored cubic at zero with numeric entry. The released cubic's graph is replaced by its factored rule.",
    },
    {
      section: "Math module 1",
      item: { number: "15", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["function.value-meaning"],
      demand:
        "Interpret a function-notation statement for an area model as an input-output pair with units",
      status: "partial",
      templateIds: ["coordinate-context-points"],
      limitations:
        "Only grade 3-5 meanings of plotted whole-number points; no function-notation statement interpreted in context with swapped-role distractors.",
    },
    {
      section: "Math module 1",
      item: { number: "16", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the exponential equation for a quantity that doubles each period from a stated start",
      status: "covered",
      templateIds: ["exponential-model-rule"],
      limitations:
        "Samples choose y = a·b^x from doubling, tripling and percent-loss stories with equation choices, as in the item.",
    },
    {
      section: "Math module 1",
      item: { number: "17", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the exponential function fitting a table whose inputs skip by two and whose outputs are rounded decimals",
      status: "partial",
      templateIds: ["exponential-model-rule"],
      limitations:
        "Tables use consecutive inputs with exact values; the item needs a square root of a two-step ratio and rounding to identify the factor.",
    },
    {
      section: "Math module 1",
      item: { number: "18", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.intercepts"],
      demand:
        "Find both intercepts of a linear function from its rule and add the nonzero coordinates",
      status: "partial",
      templateIds: ["solution-coordinate"],
      limitations:
        "Substituting for a missing coordinate on a line is practiced; no template asks for x- and y-intercepts of a linear function.",
    },
    {
      section: "Math module 1",
      item: { number: "19", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Decide which table of three ordered pairs consists entirely of solutions to a strict two-variable inequality",
      status: "partial",
      templateIds: ["inequality-solution-point"],
      limitations:
        "Tests one point at a time with a graph shown; the item checks tables of three pairs without a graph.",
    },
    {
      section: "Math module 1",
      item: { number: "20", page: "printed p.39; PDF p.41" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand:
        "Solve a linear system by substitution and enter the difference of the coordinates",
      status: "covered",
      templateIds: ["sat-entry-system-solve", "sat-entry-system-expression"],
      limitations:
        "Entering x or y after solving, and entering expression values, together match the item's solve-then-subtract work.",
    },
    {
      section: "Math module 1",
      item: { number: "21", page: "printed p.39; PDF p.41" },
      responseFormat: "numeric",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.pythagorean"],
      demand:
        "Find a non-integer hypotenuse from two legs and enter the radicand of its simplified radical form",
      status: "covered",
      templateIds: ["radical-side-entry"],
      limitations:
        "Numeric entry of the radicand, or the coefficient, of a simplified radical hypotenuse from two integer legs.",
    },
    {
      section: "Math module 1",
      item: { number: "22", page: "printed p.39; PDF p.41" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.scale"],
      demand:
        "Find the area of a scale model from the actual area and a fractional linear scale factor",
      status: "partial",
      templateIds: ["scale-drawing", "similar-triangle-side"],
      limitations:
        "scale-drawing converts plan area to actual area with a unit-ratio scale; similar-triangle-side scales triangle areas small to large; the item goes from actual area to model area with a fractional factor.",
    },
    {
      section: "Math module 1",
      item: { number: "23", page: "printed p.39; PDF p.41" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.coordinate"],
      demand:
        "Choose the circle equation whose graph meets the y-axis at exactly one point",
      status: "partial",
      templateIds: ["circle-equation"],
      limitations:
        "Reads center and radius numerically; no relating center and radius to tangency with an axis and no equation choices.",
    },
    {
      section: "Math module 1",
      item: { number: "24", page: "printed p.39; PDF p.41" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["triangle.relationships"],
      demand:
        "Decide which additional fact makes two triangles with two pairs of equal angles congruent",
      status: "partial",
      templateIds: ["triangle-congruence-criteria"],
      limitations:
        "Template names the criterion to complete or classifies stated givens; the item gives two equal angle pairs and asks which added fact suffices, with a one-triangle-only side and an AAA distractor.",
    },
    {
      section: "Math module 1",
      item: { number: "25", page: "printed p.39; PDF p.41" },
      responseFormat: "choice",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.change"],
      demand:
        "Find the original value after a percent increase greater than 1000%",
      status: "partial",
      templateIds: ["percent-change-original"],
      limitations:
        "Samples undo increases up to about 200%; the item undoes an increase over 1000%.",
    },
    {
      section: "Math module 1",
      item: { number: "26", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Recover the extra-hour rate from a flat charge for the first hours and one total, then choose the slope-intercept rule",
      status: "covered",
      templateIds: [
        "linear-model-equation",
        "piecewise-evaluate",
        "fee-rule-choice",
      ],
      limitations:
        "fee-rule-choice (recovered-rate) finds the rate for hours beyond a flat-fee allowance from one total and offers the rule in expanded slope-intercept form among four equations.",
    },
    {
      section: "Math module 1",
      item: { number: "27", page: "printed p.40; PDF p.42" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.root-relations"],
      demand:
        "Expand and collect a quadratic equation written with products on both sides, then enter the sum of its irrational solutions",
      status: "partial",
      templateIds: ["sat-entry-root-relations"],
      limitations:
        "The equation-form axis (both-sides) collects terms from both sides before the coefficients give the sum of the solutions; products that must first be expanded on each side are not yet written.",
    },
    {
      section: "Math module 2",
      item: { number: "1", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.units"],
      demand: "Convert a speed between two length units with a stated factor",
      status: "covered",
      templateIds: ["compound-unit-conversion"],
      limitations:
        "Rate conversions with stated factors include one-factor speed changes; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "2", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["bivariate.linear-fit"],
      demand:
        "Choose the equation of a drawn line of best fit from the signs of its slope and intercept",
      status: "partial",
      templateIds: ["trend-line-predict", "scatter-association-choice"],
      limitations:
        "trend-line-predict computes a slope from marked points and predicts numerically; no choosing a best-fit equation by slope and intercept signs.",
    },
    {
      section: "Math module 2",
      item: { number: "3", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.representations"],
      demand: "Choose the table of values that matches a graphed line",
      status: "partial",
      templateIds: ["linear-model-equation", "compare-function-rates"],
      limitations:
        "Graph-to-equation and table-versus-graph comparisons exist; no choosing the table that matches a graphed line.",
    },
    {
      section: "Math module 2",
      item: { number: "4", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.area"],
      demand: "Find the perimeter of a rectangle from its length and width",
      status: "covered",
      templateIds: ["rectangle-border-length"],
      limitations:
        "SAT-eligible grade 3-5 family gives the same whole-number rectangle perimeter; the item states the sides in words.",
    },
    {
      section: "Math module 2",
      item: { number: "5", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["linear.literal"],
      demand:
        "Isolate one variable in a linear equation relating three positive quantities",
      status: "covered",
      templateIds: ["formula-isolate"],
      limitations:
        "Samples isolate a variable in formulas with expression choices, including division of a grouped side.",
    },
    {
      section: "Math module 2",
      item: { number: "6", page: "printed p.45; PDF p.47" },
      responseFormat: "numeric",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.center"],
      demand: "Find the median of an ordered list with an odd number of values",
      status: "covered",
      templateIds: ["median-data"],
      limitations: "Same task with numeric entry.",
    },
    {
      section: "Math module 2",
      item: { number: "7", page: "printed p.45; PDF p.47" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Find the input of a proportional function written in function notation that gives a stated output",
      status: "covered",
      templateIds: [
        "sat-entry-fn-linear-notation",
        "dependent-variable-value",
        "one-step-equation",
      ],
      limitations:
        "input-proportional solves f(x) = kx = v in function notation, with numeric entry.",
    },
    {
      section: "Math module 2",
      item: { number: "8", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.of"],
      demand: "Find what percent a part is of a large whole",
      status: "partial",
      templateIds: ["percent-of", "relative-frequency-percent"],
      limitations:
        "percent-of finds a percent of a number; relative-frequency-percent finds a share from a table; no bare 'what percent of the whole' with large counts.",
    },
    {
      section: "Math module 2",
      item: { number: "9", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["linear.meaning"],
      demand:
        "Interpret the constant term of a linear growth model as the starting value",
      status: "covered",
      templateIds: [
        "linear-initial-value-meaning",
        "interpret-linear-parameters",
      ],
      limitations:
        "Statement choices interpreting the constant as the value at zero input, with units, as in the item.",
    },
    {
      section: "Math module 2",
      item: { number: "10", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.system"],
      demand:
        "Find a possible x-coordinate where a horizontal line meets a shifted parabola",
      status: "covered",
      templateIds: ["nonlinear-system-solve"],
      limitations:
        "Line-into-quadratic substitution with integer intersections; the item's horizontal line is simpler and its choices are numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "11", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["measure.scale"],
      demand: "Choose a possible scale factor for an enlargement of a triangle",
      status: "partial",
      templateIds: ["dilation-scale-factor"],
      limitations:
        "Finds a scale factor from coordinates; no reasoning that an enlargement needs a factor greater than 1.",
    },
    {
      section: "Math module 2",
      item: { number: "12", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.parameters"],
      demand:
        "Classify a linear equation whose sides are identical as having infinitely many solutions",
      status: "covered",
      templateIds: ["equation-solution-count"],
      limitations:
        "Samples include identical sides with the infinitely-many choice.",
    },
    {
      section: "Math module 2",
      item: { number: "13", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.context"],
      demand:
        "Find an unknown item count from a total cost, a known count and two unit prices",
      status: "covered",
      templateIds: ["two-step-word-problem"],
      limitations:
        "Write and solve px + q = r stories with numeric entry, same structure.",
    },
    {
      section: "Math module 2",
      item: { number: "14", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Recover the base of an exponential function from one output, then evaluate at the next input",
      status: "covered",
      templateIds: ["sat-entry-fn-exponential", "exponential-model-value"],
      limitations:
        "base-then-next-output gives one output of a*b^x, requires the base from a root, and asks for the output at the next input.",
    },
    {
      section: "Math module 2",
      item: { number: "15", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.complement"],
      demand:
        "Use complementary angles in a right triangle to equate one angle's sine with the other's cosine (radical value)",
      status: "partial",
      templateIds: ["complementary-trig"],
      limitations:
        "Numeric entry with rational values or angle measures; the item's value is a radical offered among tangent and reciprocal distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "16", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Choose the standard-form equation of a decreasing line in context from its intercepts",
      status: "covered",
      templateIds: ["sat-fn-constraint-choice", "graph-equation-choice"],
      limitations:
        "capacity-intercepts gives the two extreme full loads of a context and asks for the standard-form equation of the decreasing line through them, with swapped-coefficient distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "17", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.rational"],
      demand:
        "Simplify a rational expression by factoring a common binomial from the numerator and a constant from the denominator",
      status: "partial",
      templateIds: ["rational-expression-simplify"],
      limitations:
        "Template factors two quadratics and tracks exclusions; the item factors by a common binomial over a linear denominator with a stated domain.",
    },
    {
      section: "Math module 2",
      item: { number: "18", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.input-output"],
      demand:
        "Find the y-intercept of a vertically shifted exponential function with a negative coefficient",
      status: "partial",
      templateIds: ["function-graph-features", "exponential-model-value"],
      limitations:
        "function-graph-features reads intercepts of shifted exponentials but is not SAT-eligible; exponential-model-value evaluates unshifted models.",
    },
    {
      section: "Math module 2",
      item: { number: "19", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Interpret a coefficient-times-variable term of a two-variable linear equation in context",
      status: "partial",
      templateIds: ["structure-meaning", "model-quantity-roles"],
      limitations:
        "Interprets single coefficients or constants and rate quantities; no product term of a two-variable constraint.",
    },
    {
      section: "Math module 2",
      item: { number: "20", page: "printed p.48; PDF p.50" },
      responseFormat: "numeric",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.coordinate"],
      demand: "Find a circle's radius from its center and a diameter endpoint",
      status: "covered",
      templateIds: ["circle-equation"],
      limitations:
        "Center-and-point variant asks for r squared; the item asks for r with axis-aligned points.",
    },
    {
      section: "Math module 2",
      item: { number: "21", page: "printed p.48; PDF p.50" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.parallel-perpendicular"],
      demand:
        "Find the slope of a line perpendicular to a line given in standard form",
      status: "covered",
      templateIds: ["perpendicular-slopes"],
      limitations:
        "The line-given axis (standard-form) states the reference line as ax + by = c, so the slope -a/b is read from the equation and the perpendicular slope is entered, often as a fraction.",
    },
    {
      section: "Math module 2",
      item: { number: "22", page: "printed p.49; PDF p.51" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.absolute"],
      demand:
        "Find the sum of the solutions of an absolute-value equation with a linear expression inside",
      status: "covered",
      templateIds: ["sat-entry-absolute-equation"],
      limitations:
        "Samples ask for the sum of solutions of |ax + b| = c with noninteger results; choices are numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "23", page: "printed p.49; PDF p.51" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["exponential.features"],
      demand:
        "Choose the equivalent exponential form whose coefficient equals the value at input 1",
      status: "partial",
      templateIds: ["exponential-time-scale"],
      limitations:
        "Rewrites growth models across time scales; no shifting the reference input so the coefficient shows a later value.",
    },
    {
      section: "Math module 2",
      item: { number: "24", page: "printed p.49; PDF p.51" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.root-count"],
      demand:
        "Find the constant term that gives a quadratic with a negative leading coefficient exactly one solution",
      status: "covered",
      templateIds: ["quadratic-parameter-root"],
      limitations:
        "The leading-sign axis (negative) gives a negative leading coefficient and a negative constant term; the choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "25", page: "printed p.49; PDF p.51" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.factor", "expression.coefficient-match"],
      demand:
        "Decide which quadratic expression has a binomial factor with an integer parameter by matching coefficients",
      status: "partial",
      templateIds: [
        "quadratic-root-relations",
        "nonmonic-quadratic-factorization",
      ],
      limitations:
        "Numeric factoring and a missing coefficient from a known root exist; no parametric factor tested by coefficient matching with an integer condition.",
    },
    {
      section: "Math module 2",
      item: { number: "26", page: "printed p.50; PDF p.52" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.grouped-bounds"],
      demand:
        "Find the least possible difference of two means from histograms of binned integer data",
      status: "missing",
      templateIds: [],
      limitations:
        "histogram-read counts bins and mean templates use exact values; nothing bounds a mean using bin endpoints.",
    },
    {
      section: "Math module 2",
      item: { number: "27", page: "printed p.50; PDF p.52" },
      responseFormat: "numeric",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.special"],
      demand:
        "Find the coefficient of the square-root-3 height of an equilateral triangle from its perimeter",
      status: "covered",
      templateIds: ["special-triangle-in-figure"],
      limitations:
        "An equilateral triangle's perimeter gives its side, and numeric entry asks the coefficient of the square root in the altitude.",
    },
  ],
);
