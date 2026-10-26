import { defineLedger } from "./types";

/** Every Math item of the nonadaptive Practice Test 7 form, labeled once.
 * SAT skills are classified against the Assessment Framework; the answer
 * explanations do not state them. */
export const satPractice7 = defineLedger(
  {
    id: "sat-practice-7",
    test: "SAT",
    form: "Practice Test 7",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-7-digital.pdf",
    edition:
      "Nonadaptive linear form of the digital SAT; test PDF modified 2024-12-05, answer explanations modified 2024-12-03",
    retrievedAt: "2026-10-26",
    sha256: "143e32c84c0ab481e21d5736763b6504fadbb4067fcb381520816c179c9257a0",
    supplements: [
      {
        role: "answer explanations",
        url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-7-answers-digital.pdf",
        sha256:
          "8e3ab9aae3020e98efecbc74e192c861eb4ef95b81255f83996d3113bf6f317d",
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
      archetypeIds: ["bivariate.linear-fit"],
      demand:
        "Read the value predicted by a drawn line of best fit at a given input",
      status: "covered",
      templateIds: ["trend-line-predict"],
      limitations:
        "Template predicts from a trend line on a scatterplot (via its slope); item reads the line directly. Choices are plain numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "2", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.area"],
      demand:
        "Find the remaining area after removing a smaller region of known area",
      status: "covered",
      templateIds: ["composite-area"],
      limitations:
        "Template combines and subtracts part areas from a dimensioned figure; item gives the areas, a strict sub-case.",
    },
    {
      section: "Math module 1",
      item: { number: "3", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.absolute"],
      demand:
        "Solve an absolute-value equation after undoing an added constant",
      status: "covered",
      templateIds: [
        "absolute-value-transformed-equation",
        "sat-entry-absolute-equation",
      ],
      limitations:
        "Samples undo outside addition and solve both branches; choices are plain numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "4", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.context"],
      demand:
        "Choose the equation for a fixed cost plus a per-unit price that sums to a total",
      status: "covered",
      templateIds: ["two-step-equation-model"],
      limitations:
        "Samples choose px + q = r for fee-plus-rate stories against swapped and subtracted forms.",
    },
    {
      section: "Math module 1",
      item: { number: "5", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["data.graph-read"],
      demand: "Read a frequency from one bar of a bar graph",
      status: "covered",
      templateIds: ["scaled-bar-graph"],
      limitations:
        "Same read-a-bar-height task; template bars are categories on a scaled axis, item's bars are numeric values. Choices are plain numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "6", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Identify the slope coefficient in a slope-intercept equation from a stated slope",
      status: "partial",
      templateIds: ["graph-equation-choice"],
      limitations:
        "Template matches a graphed line to its slope-intercept equation by choice; no numeric template identifies a coefficient of y = mx + b.",
    },
    {
      section: "Math module 1",
      item: { number: "7", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.polynomial-zeros"],
      demand: "Give one x-intercept of a cubic in factored form",
      status: "covered",
      templateIds: ["sat-entry-polynomial-zeros"],
      limitations: "Same read-a-zero-from-factors task with numeric entry.",
    },
    {
      section: "Math module 1",
      item: { number: "8", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["function.graph-context"],
      demand: "Interpret the y-intercept of a decreasing value-over-time graph",
      status: "partial",
      templateIds: ["proportional-graph"],
      limitations:
        "Template interprets a labeled (0, b) point on a linear cost graph; item reads an unlabeled intercept on a curved decay graph with time-based distractors.",
    },
    {
      section: "Math module 1",
      item: { number: "9", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["triangle.congruence-correspondence"],
      demand: "Use a congruence correspondence to find a matching angle",
      status: "missing",
      templateIds: [],
      limitations:
        "No template reads corresponding parts from a congruence statement; triangle-congruence-criteria covers sufficiency criteria only.",
    },
    {
      section: "Math module 1",
      item: { number: "10", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Evaluate a linear function with a fractional coefficient at an integer",
      status: "partial",
      templateIds: ["substitute-linear-expression"],
      limitations:
        "Same evaluation task; choices are plain numbers. Linear families state rules as equations such as y = mx + b, never in function notation, so reading f(a) or solving f(x) = value for a linear rule is not practiced.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 1",
      item: { number: "11", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.system"],
      demand:
        "Choose the intersection of a graphed absolute-value function and line",
      status: "partial",
      templateIds: ["nonlinear-system-read"],
      limitations:
        "Template reads integer intersection coordinates of a line and a parabola with equations; item has an absolute-value graph without equations and a non-lattice intersection chosen by location.",
    },
    {
      section: "Math module 1",
      item: { number: "12", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.classify"],
      demand:
        "Choose a second equation that makes a linear system have infinitely many solutions",
      status: "partial",
      templateIds: ["linear-system-solution-count"],
      limitations:
        "Template classifies a given pair; item reverses it, choosing the equivalent equation among near misses.",
    },
    {
      section: "Math module 1",
      item: { number: "13", page: "printed p.35; PDF p.37" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.structure"],
      demand:
        "Find a multiple of the variable from a linear equation with a fractional coefficient",
      status: "partial",
      templateIds: ["rational-coefficient-equation"],
      limitations:
        "Template solves for the variable itself; no template asks for a related expression's value.",
    },
    {
      section: "Math module 1",
      item: { number: "14", page: "printed p.35; PDF p.37" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand: "Solve a linear system by substitution and enter one variable",
      status: "covered",
      templateIds: ["sat-entry-system-solve"],
      limitations: "Same task and entry format.",
    },
    {
      section: "Math module 1",
      item: { number: "15", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.coordinate"],
      demand:
        "Read the center and radius from a standard-form circle equation with a symbolic coordinate",
      status: "partial",
      templateIds: ["circle-equation"],
      limitations:
        "Template reads centers and radii numerically; item's choices are center-and-radius statements, including a radius-squared trap and a symbolic coordinate.",
    },
    {
      section: "Math module 1",
      item: { number: "16", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.absolute"],
      demand:
        "Evaluate an absolute-value function and solve the resulting absolute-value equation for an input",
      status: "partial",
      templateIds: ["absolute-value-transformed-equation"],
      limitations:
        "Template solves a stated absolute-value equation; item first sets it up from function notation and a difference of outputs.",
    },
    {
      section: "Math module 1",
      item: { number: "17", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.form"],
      demand:
        "Choose which equivalent exponential form shows the value at zero as its coefficient",
      status: "partial",
      templateIds: ["structure-meaning", "exponential-time-scale"],
      limitations:
        "Templates interpret the coefficient of a standard form or rewrite time scales; none evaluates horizontally shifted exponents to compare forms.",
    },
    {
      section: "Math module 1",
      item: { number: "18", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.form"],
      demand:
        "Find the doubling time from an exponential model with a fractional exponent",
      status: "covered",
      templateIds: ["exponential-time-scale"],
      limitations:
        "Sample interprets a(b)^(t/k) as multiplying by b every k units of time.",
    },
    {
      section: "Math module 1",
      item: { number: "19", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["nonlinear.literal"],
      demand: "Solve an equation of reciprocals for one variable",
      status: "partial",
      templateIds: ["formula-isolate", "nonlinear-formula-isolate"],
      limitations:
        "Templates isolate variables in linear formulas or squared quantities; no formula with variables in denominators.",
    },
    {
      section: "Math module 1",
      item: { number: "20", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["function.graph-context"],
      demand:
        "Find an average rate of change between two inputs read from a scatterplot",
      status: "covered",
      templateIds: ["average-rate-display"],
      limitations:
        "Template reads two points from a graph or table and enters the rate with units; item's points are scatterplot dots.",
    },
    {
      section: "Math module 1",
      item: { number: "21", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.context"],
      demand:
        "Solve for a quantity when another is a multiple plus a constant and their total is given",
      status: "covered",
      templateIds: ["linear-model-value"],
      limitations:
        "Sample: length is a multiple of width plus a constant with a given perimeter; same build-and-solve with numeric entry.",
    },
    {
      section: "Math module 1",
      item: { number: "22", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.parts"],
      demand:
        "Use equal radii as two sides of a triangle to find the third side from its perimeter",
      status: "missing",
      templateIds: [],
      limitations:
        "No template uses the equality of radii to find a chord or triangle side; circle templates cover angles, tangents, arc and area.",
    },
    {
      section: "Math module 1",
      item: { number: "23", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["expression.verbal", "inequality.context"],
      demand:
        "Translate a verbal comparison of consecutive odd integers into a linear inequality",
      status: "partial",
      templateIds: ["inequality-from-context"],
      limitations:
        "Template translates one-sided verbal limits into x < c forms; no template builds consecutive-integer expressions or translates 'at most k less than'.",
    },
    {
      section: "Math module 1",
      item: { number: "24", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["function.rule"],
      demand:
        "Write a linear relationship from a table whose inputs involve a symbolic constant",
      status: "partial",
      templateIds: ["linear-model-equation", "unequal-step-rate"],
      limitations:
        "Templates use numeric tables; none carries a parameter through the slope and the equation.",
    },
    {
      section: "Math module 1",
      item: { number: "25", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.complement"],
      demand:
        "Rewrite a trigonometric expression using the sine-cosine complement relationship",
      status: "partial",
      templateIds: ["complementary-trig"],
      limitations:
        "Template is numeric (values and angles); item chooses an equivalent expression.",
    },
    {
      section: "Math module 1",
      item: { number: "26", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Write a linear cost function when the first unit has a different price than each additional unit",
      status: "partial",
      templateIds: ["linear-model-equation"],
      limitations:
        "Template states a separate starting amount; the first-unit-priced-differently structure (n - 1 additional units) is not practiced.",
    },
    {
      section: "Math module 1",
      item: { number: "27", page: "printed p.38; PDF p.40" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.features"],
      demand:
        "Find the input where a quadratic in factored form reaches its minimum",
      status: "covered",
      templateIds: ["parabola-axis"],
      limitations:
        "Samples find the axis of symmetry from a factored form; the minimum's input is that axis. Numeric fraction entry.",
    },
    {
      section: "Math module 2",
      item: { number: "1", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.context"],
      demand: "Find a missing part from a total and the other part in context",
      status: "covered",
      templateIds: ["one-step-equation-story"],
      limitations:
        "Same one-step part-whole story; template choices pair equation and solution, item's are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "2", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.of"],
      demand: "Find a percent of a whole-number count in context",
      status: "covered",
      templateIds: ["percent-of"],
      limitations: "Same task; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "3", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.features"],
      demand: "Read the vertex of a parabola from its graph",
      status: "covered",
      templateIds: ["parabola-vertex"],
      limitations:
        "Samples include reading the vertex from a graph with ordered-pair choices.",
    },
    {
      section: "Math module 2",
      item: { number: "4", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.proportion"],
      demand: "Compute a population density from a count and an area",
      status: "covered",
      templateIds: ["density-context"],
      limitations:
        "Sample computes people per square kilometer with plain-number choices.",
    },
    {
      section: "Math module 2",
      item: { number: "5", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.psda.probability"],
      archetypeIds: ["probability.direct"],
      demand:
        "Find the probability of selecting a positive value from a small data set",
      status: "covered",
      templateIds: ["simple-probability"],
      limitations: "Same favorable/total task; choices are plain fractions.",
    },
    {
      section: "Math module 2",
      item: { number: "6", page: "printed p.43; PDF p.45" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand: "Evaluate a fee-plus-rate linear function in context",
      status: "partial",
      templateIds: ["substitute-linear-expression", "dependent-variable-value"],
      limitations:
        "Same evaluation; numeric entry. Linear families state rules as equations such as y = mx + b, never in function notation, so reading f(a) or solving f(x) = value for a linear rule is not practiced.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 2",
      item: { number: "7", page: "printed p.43; PDF p.45" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.input-output"],
      demand: "Evaluate a vertex-form quadratic at a fractional input",
      status: "partial",
      templateIds: ["function-evaluation"],
      limitations:
        "Template evaluates standard-form quadratics at integer inputs only.",
    },
    {
      section: "Math module 2",
      item: { number: "8", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.structure"],
      demand:
        "Find a multiple of the variable from a one-step linear equation by scaling",
      status: "partial",
      templateIds: ["one-step-equation"],
      limitations:
        "Template solves for the variable; no template asks for the value of a scaled expression.",
    },
    {
      section: "Math module 2",
      item: { number: "9", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.factor"],
      demand: "Factor a common variable out of a cubic trinomial",
      status: "covered",
      templateIds: ["greatest-monomial-factor"],
      limitations:
        "Samples factor x or x^2 out of cubic trinomials with expression choices.",
    },
    {
      section: "Math module 2",
      item: { number: "10", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.polynomial"],
      demand: "Add two cubic polynomials and combine like terms",
      status: "covered",
      templateIds: ["polynomial-addition"],
      limitations: "Same task with expression choices.",
    },
    {
      section: "Math module 2",
      item: { number: "11", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Interpret the coefficients of a two-variable points equation to compare per-item values",
      status: "partial",
      templateIds: ["interpret-linear-parameters", "structure-meaning"],
      limitations:
        "Templates interpret rate and intercept of one-input models; no template reads per-item values from both coefficients of ax + by = c.",
    },
    {
      section: "Math module 2",
      item: { number: "12", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["bivariate.linear-fit"],
      demand: "Estimate the slope of a drawn line of best fit",
      status: "partial",
      templateIds: ["trend-line-predict"],
      limitations:
        "Template computes slope from two marked points only as a step to a prediction; item asks the slope itself with no marked points.",
    },
    {
      section: "Math module 2",
      item: { number: "13", page: "printed p.44; PDF p.46" },
      responseFormat: "numeric",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.parts"],
      demand:
        "Find the coefficient of pi in a circle's area from a decimal radius",
      status: "covered",
      templateIds: ["circle-area-coefficient"],
      limitations:
        "Same coefficient-of-pi task; samples use whole radii, item squares a decimal.",
    },
    {
      section: "Math module 2",
      item: { number: "14", page: "printed p.45; PDF p.47" },
      responseFormat: "numeric",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Chain a right-triangle angle sum and parallel-segment angles to find an obtuse angle",
      status: "partial",
      templateIds: ["triangle-angle-sum", "parallel-lines-angle"],
      limitations:
        "Each step is practiced separately; no template chains them inside a triangle cut by a parallel segment.",
    },
    {
      section: "Math module 2",
      item: { number: "15", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the model for an amount that doubles every fixed multi-year period",
      status: "partial",
      templateIds: ["exponential-model-rule", "exponential-time-scale"],
      limitations:
        "exponential-model-rule builds rules with one-unit periods; exponential-time-scale interprets t/k exponents but does not build them from a story.",
    },
    {
      section: "Math module 2",
      item: { number: "16", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Choose the table whose every pair satisfies a system of two linear inequalities",
      status: "partial",
      templateIds: ["inequality-solution-point"],
      limitations:
        "Template tests single points against one inequality with a graph; item tests tables against a system.",
    },
    {
      section: "Math module 2",
      item: { number: "17", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.exponent-rules"],
      demand:
        "Simplify a quotient of two-variable monomials with positive and negative exponent results",
      status: "partial",
      templateIds: ["quotient-of-powers-exponent"],
      limitations:
        "Template is numeric, one variable, asking only the exponent; item chooses the simplified two-variable expression with a negative exponent rewritten as a denominator.",
    },
    {
      section: "Math module 2",
      item: { number: "18", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.expression"],
      demand:
        "Add two equations to eliminate a variable and find a multiple of the other",
      status: "covered",
      templateIds: ["system-expression-value"],
      limitations: "Same combine-equations task with plain-number choices.",
    },
    {
      section: "Math module 2",
      item: { number: "19", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["quadratic.context"],
      demand:
        "Find the landing time of a dropped object after setting the constant of its height model from the initial height",
      status: "partial",
      templateIds: ["sat-entry-quadratic-context"],
      limitations:
        "Template gives the full height model; item first sets the constant from the drop height, then solves a pure-square equation.",
    },
    {
      section: "Math module 2",
      item: { number: "20", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Use the quadratic formula to find the radicand in a given form of a solution",
      status: "partial",
      templateIds: ["quadratic-irrational-solutions"],
      limitations:
        "Template is single-choice and recognizes simplified radical solution sets; item is numeric and asks the unsimplified radicand.",
    },
    {
      section: "Math module 2",
      item: { number: "21", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Express a sum of transversal angles symbolically and match it to find a constant",
      status: "partial",
      templateIds: ["parallel-lines-angle", "angle-equation"],
      limitations:
        "Templates solve for x from equal or supplementary pairs; none sums several angles symbolically and matches coefficients.",
    },
    {
      section: "Math module 2",
      item: { number: "22", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Find a linear function from a table with fractional inputs and apply a vertical shift",
      status: "partial",
      templateIds: ["linear-model-equation", "unequal-step-rate"],
      limitations:
        "Templates use whole-number tables and no shifted function; item has fractional inputs and h(x) = f(x) - c.",
    },
    {
      section: "Math module 2",
      item: { number: "23", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Express a linear function's constant in terms of another constant from a symbolic input-output pair",
      status: "partial",
      templateIds: ["literal-equation-solve"],
      limitations:
        "Template solves letter-coefficient equations for x; item substitutes a symbolic input into a function and solves for the constant term.",
    },
    {
      section: "Math module 2",
      item: { number: "24", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.trig-ratio"],
      demand:
        "Use a tangent ratio and one leg to find the other sides and the perimeter",
      status: "covered",
      templateIds: ["trig-ratio"],
      limitations:
        "Samples find a side from a given ratio and a third side; adding the perimeter is a routine step. Choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "25", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.coordinate"],
      demand:
        "Complete the square in a general circle equation to find a non-integer radius",
      status: "partial",
      templateIds: ["circle-equation"],
      limitations:
        "Same complete-the-square task, but template radii are whole numbers entered numerically; item's radius is a square root chosen from radical choices.",
    },
    {
      section: "Math module 2",
      item: { number: "26", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.units"],
      demand: "Convert an acceleration between units with a squared time unit",
      status: "partial",
      templateIds: ["compound-unit-conversion"],
      limitations:
        "Template converts rates, area, density and energy; none has a squared unit in a rate's denominator.",
    },
    {
      section: "Math module 2",
      item: { number: "27", page: "printed p.48; PDF p.50" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.system", "nonlinear.root-count"],
      demand:
        "Find the least integer constant for which a horizontal line and a parabola do not intersect",
      status: "partial",
      templateIds: ["nonlinear-system-count", "quadratic-parameter-root"],
      limitations:
        "Templates count intersections for given constants or find the constant for exactly one root; none solves a discriminant inequality for a least integer.",
    },
  ],
);
