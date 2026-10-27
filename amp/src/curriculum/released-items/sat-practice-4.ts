import { defineLedger } from "./types";

/** Every Math item of the nonadaptive Practice Test 4 form, labeled once.
 * SAT skills are classified against the Assessment Framework; the answer
 * explanations do not state them. */
export const satPractice4 = defineLedger(
  {
    id: "sat-practice-4",
    test: "SAT",
    form: "Practice Test 4",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-4-digital.pdf",
    edition:
      "Nonadaptive linear form of the digital SAT; test PDF modified 2024-09-27, answer explanations modified 2022-10-03",
    retrievedAt: "2026-10-26",
    sha256: "5d4a55e241f46beec90c6f273c346be6b6d5231127d73068083d881aa2a37d7a",
    supplements: [
      {
        role: "answer explanations",
        url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-4-answers-digital.pdf",
        sha256:
          "ee2ed6b3a5d77994b6e6ad460137f6959c5b142695ae20e0bb28089171649b56",
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
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["data.graph-read"],
      demand:
        "Read one category's count from a bar graph when the bar ends between gridlines",
      status: "partial",
      templateIds: ["scaled-bar-graph"],
      limitations:
        "scaled-bar-graph (grade 3–5, numeric) asks totals and differences of bars on exact or halfway scale values; it never asks a single bar's value estimated between gridlines.",
    },
    {
      section: "Math module 1",
      item: { number: "2", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.of"],
      demand: "Find what percent one whole number is of another",
      status: "partial",
      templateIds: ["percent-of", "percent-applications"],
      limitations:
        "percent-of only asks the forward task (p% of N); percent-applications finds a rate only inside interest, tax or error contexts. No bare 'what percent of B is A' practice.",
    },
    {
      section: "Math module 1",
      item: { number: "3", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Solve an equation of the form x²/k = c by clearing the denominator and taking square roots",
      status: "partial",
      templateIds: [
        "solve-square-cube-equation",
        "sat-entry-quadratic-solution",
      ],
      limitations:
        "solve-square-cube-equation only generates x² = c (no coefficient or denominator to clear); sat-entry-quadratic-solution factors trinomials. The clear-then-root step is not practiced.",
    },
    {
      section: "Math module 1",
      item: { number: "4", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["expression.verbal"],
      demand:
        "Translate 'a constant more than a multiple of a number equals a value' into a linear equation",
      status: "covered",
      templateIds: ["two-step-equation-model"],
      limitations:
        "Checked samples: chooses px + q = r against swapped, product and grouped distractors from a verbal description. Template phrasing is a story rather than a bare 'number', same structure.",
    },
    {
      section: "Math module 1",
      item: { number: "5", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["linear.meaning"],
      demand:
        "Interpret the rate coefficient of a linear function modeling a balance after repeated deposits",
      status: "covered",
      templateIds: ["interpret-linear-parameters"],
      limitations:
        "Checked samples: interprets the rate of a linear model with units against initial-value and after-one-period distractors.",
    },
    {
      section: "Math module 1",
      item: { number: "6", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.proportion"],
      demand: "Find the quantity bought from a total cost and a unit price",
      status: "covered",
      templateIds: ["dependent-variable-value"],
      limitations:
        "Checked samples: divides a total by a stated unit price (c = kn, find n) with numeric entry. Template states the equation explicitly; item gives it in words.",
    },
    {
      section: "Math module 1",
      item: { number: "7", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.context"],
      demand:
        "Find a unit price from a count, a flat discount and the discounted total",
      status: "covered",
      templateIds: ["two-step-word-problem"],
      limitations:
        "Checked samples: story leading to px + q = r or p(x + q) = r, including a flat amount off, numeric entry.",
    },
    {
      section: "Math module 1",
      item: { number: "8", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Choose the linear function rule that matches a table including the input 0",
      status: "covered",
      templateIds: ["linear-model-equation"],
      limitations:
        "Checked samples: includes table-to-equation choices with swapped rate and intercept distractors; template uses context variable names rather than f(x).",
    },
    {
      section: "Math module 1",
      item: { number: "9", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["triangle.relationships", "angle.relationships"],
      demand:
        "Use corresponding angles of similar right triangles and the angle sum to find an angle",
      status: "covered",
      templateIds: ["corresponding-angle-transfer"],
      limitations:
        "Similar right triangles and the third-angle variants transfer an acute angle or the 90-degree complement through a stated correspondence. The released item's figure is replaced by a written statement.",
    },
    {
      section: "Math module 1",
      item: { number: "10", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["bivariate.linear-fit"],
      demand:
        "Choose the linear model y = a + bx for a scatterplot from the slope's sign and the intercept",
      status: "partial",
      templateIds: ["nonlinear-data-model", "trend-line-predict"],
      limitations:
        "nonlinear-data-model compares linear, quadratic and exponential candidates by squared residuals from listed pairs; trend-line-predict computes a prediction. Neither matches a plotted cloud to a linear equation by intercept and slope sign.",
    },
    {
      section: "Math module 1",
      item: { number: "11", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Substitute one variable's value into a two-variable linear constraint in context and solve for the other",
      status: "covered",
      templateIds: ["solution-coordinate"],
      limitations:
        "Checked samples: substitute a known coordinate into a two-variable linear equation and solve, numeric entry (choices are plain numbers). Template is abstract with integer coefficients; item adds context labels and a decimal coefficient.",
    },
    {
      section: "Math module 1",
      item: { number: "12", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Choose the equation of a graphed line with negative slope and negative y-intercept",
      status: "partial",
      templateIds: ["graph-equation-choice"],
      limitations:
        "graph-equation-choice only generates increasing lines with positive integer slope and intercept; negative slopes and intercepts never appear.",
    },
    {
      section: "Math module 1",
      item: { number: "13", page: "printed p.34; PDF p.36" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.structure"],
      demand: "Given x/k = c, find the value of the reciprocal ratio k/x",
      status: "covered",
      templateIds: ["sat-entry-fn-related-value", "one-step-equation"],
      limitations:
        "reciprocal-ratio gives a ratio of two nonzero variables and asks for the reciprocal ratio, with numeric entry.",
    },
    {
      section: "Math module 1",
      item: { number: "14", page: "printed p.34; PDF p.36" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand: "Solve a 2×2 linear system and enter one variable",
      status: "covered",
      templateIds: ["sat-entry-system-solve"],
      limitations:
        "Checked samples: numeric entry of x or y from a 2×2 system with integer or fractional results.",
    },
    {
      section: "Math module 1",
      item: { number: "15", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Choose the slope-intercept equation of a line from a negative fractional slope and a point",
      status: "covered",
      templateIds: [
        "sat-fn-line-equation-choice",
        "recover-linear-intercept",
        "perpendicular-slopes",
      ],
      limitations:
        "slope-point gives a fractional or negative slope and a point off the y-axis and asks for the equation by choice, with the same intercept and sign distractors.",
    },
    {
      section: "Math module 1",
      item: { number: "16", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["function.value-meaning"],
      demand:
        "Interpret a statement f(a) ≈ b about an exponential model whose input counts years after a base year",
      status: "partial",
      templateIds: ["coordinate-context-points"],
      limitations:
        "coordinate-context-points (grade 3–5) interprets a plotted first-quadrant point in a situation; no template interprets function notation f(a) = b, converts years-after-a-base-year to a calendar year, or uses an exponential model.",
    },
    {
      section: "Math module 1",
      item: { number: "17", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Find how one dimension must change to keep a ratio when the other grows by a given amount",
      status: "partial",
      templateIds: ["ratio-missing"],
      limitations:
        "ratio-missing scales a ratio to find a missing whole quantity (numeric); item asks the change in one quantity, with increase/decrease statements as choices and a decimal result.",
    },
    {
      section: "Math module 1",
      item: { number: "18", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["quadratic.context"],
      demand:
        "Write the area function of a square whose perimeter exceeds another square's by a constant",
      status: "partial",
      templateIds: ["quadratic-context-model"],
      limitations:
        "quadratic-context-model builds rectangle-area and height models internally but asks for a solved value; item asks to choose the function definition (x + k)² from a perimeter relation.",
    },
    {
      section: "Math module 1",
      item: { number: "19", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["nonlinear.literal"],
      demand:
        "Solve an equation with a variable inside a square root for that variable in terms of two others",
      status: "partial",
      templateIds: ["nonlinear-formula-isolate"],
      limitations:
        "nonlinear-formula-isolate isolates a squared quantity by taking a root; item requires simplifying a ratio, then squaring to remove a radical.",
    },
    {
      section: "Math module 1",
      item: { number: "20", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.parts"],
      demand:
        "Give a central angle's measure from the degree measure of its arc",
      status: "partial",
      templateIds: ["circle-angles"],
      limitations:
        "circle-angles relates inscribed and central angles, semicircles and tangents; it never asks the arc-measure-equals-central-angle relation itself.",
    },
    {
      section: "Math module 1",
      item: { number: "21", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.radical", "expression.exponent-rules"],
      demand:
        "Rewrite a product of radicals of powers as a single power a·x^b and combine the constants",
      status: "partial",
      templateIds: ["symbolic-rational-exponent", "product-of-powers-exponent"],
      limitations:
        "symbolic-rational-exponent is single-choice with one radical and coefficient 1; product-of-powers-exponent adds integer exponents. No numeric practice combining radical coefficients with fractional exponents.",
    },
    {
      section: "Math module 1",
      item: { number: "22", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.area"],
      demand:
        "Find a right triangle's area when its sides are radicals, identifying the legs as the two shorter sides",
      status: "partial",
      templateIds: ["triangle-area-base-height", "multiply-square-roots"],
      limitations:
        "triangle-area-base-height uses labeled integer base and height; multiply-square-roots practices the radical product only. No template combines them, and item choices include radical expressions.",
    },
    {
      section: "Math module 1",
      item: { number: "23", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.coefficient-match"],
      demand:
        "Match constant terms of a quadratic and an integer-constant factorization to decide which ratio must be an integer",
      status: "missing",
      templateIds: [],
      limitations:
        "No template matches coefficients against unknown integer constants; nonmonic-quadratic-factorization factors concrete trinomials only (related skill, not the core reasoning).",
    },
    {
      section: "Math module 1",
      item: { number: "24", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.system", "nonlinear.root-count"],
      demand:
        "Use a zero discriminant for a line with unknown intercept tangent to a parabola and find the tangency x-coordinate",
      status: "partial",
      templateIds: ["nonlinear-system-count", "quadratic-parameter-root"],
      limitations:
        "nonlinear-system-count counts intersections for fixed lines; quadratic-parameter-root finds c for one root. Neither puts the parameter in the line or asks for the tangency point.",
    },
    {
      section: "Math module 1",
      item: { number: "25", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.special"],
      demand:
        "Find the perimeter of an isosceles right triangle from an integer hypotenuse",
      status: "partial",
      templateIds: ["special-right-triangle"],
      limitations:
        "special-right-triangle (numeric) finds a leg from a hypotenuse given as k√2, giving integer legs; item's legs are radicals and choices are radical perimeter expressions.",
    },
    {
      section: "Math module 1",
      item: { number: "26", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.quadratic-from-data"],
      demand:
        "Expand a vertex-form parabola with an unknown leading coefficient and find a possible a + b + c using the x-intercept condition",
      status: "partial",
      templateIds: ["quadratic-from-data"],
      limitations:
        "quadratic-from-data fixes the leading coefficient from a given point and selects the equation; item leaves it free (sign forced by two x-intercepts) and asks a possible coefficient sum.",
    },
    {
      section: "Math module 1",
      item: { number: "27", page: "printed p.37; PDF p.39" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context", "nonlinear.transform"],
      demand:
        "Find an exponential function's parameters from the y-intercept of a vertically shifted graph and a product condition",
      status: "partial",
      templateIds: ["exponential-model-rule", "transform-point"],
      limitations:
        "exponential-model-rule (choice) recovers a·bˣ from unshifted points; transform-point tracks one point through a transformation. Neither handles a reflected, shifted exponential with a product constraint.",
    },
    {
      section: "Math module 2",
      item: { number: "1", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["data.graph-read"],
      demand: "Identify the time with the greatest value on a line graph",
      status: "covered",
      templateIds: ["line-graph-reader"],
      limitations:
        "line-graph-reader draws a line graph over days, weeks or hours and asks on which time the value is greatest or least, with the largest-rise interval as a distractor.",
    },
    {
      section: "Math module 2",
      item: { number: "2", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.units"],
      demand:
        "Convert a length from yards to miles with a stated conversion factor",
      status: "covered",
      templateIds: ["compound-unit-conversion"],
      limitations:
        "Checked samples: converts with stated factors, numeric entry (choices are plain numbers). Template is mostly metric and compound units with exact results; item is one customary factor rounded to tenths.",
    },
    {
      section: "Math module 2",
      item: { number: "3", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.polynomial"],
      demand: "Subtract like cubic monomial terms",
      status: "covered",
      templateIds: ["polynomial-subtraction"],
      limitations:
        "Checked samples: combines like terms including cubic terms after subtraction, with coefficient and exponent distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "4", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand:
        "Solve a linear system in which one equation gives x in terms of y and choose the ordered pair",
      status: "covered",
      templateIds: ["linear-system-pair"],
      limitations:
        "Checked samples: choose the exact ordered pair satisfying two linear equations, including axis-aligned and simple substitution forms.",
    },
    {
      section: "Math module 2",
      item: { number: "5", page: "printed p.41; PDF p.43" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Decide which quadrant-defining system of inequalities a given point satisfies",
      status: "partial",
      templateIds: ["inequality-solution-point"],
      limitations:
        "inequality-solution-point picks which of four points satisfies one inequality; item reverses the direction (one point, four systems of sign conditions).",
    },
    {
      section: "Math module 2",
      item: { number: "6", page: "printed p.41; PDF p.43" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.absolute"],
      demand: "Solve a simple absolute-value equation and enter one solution",
      status: "covered",
      templateIds: ["sat-entry-absolute-equation"],
      limitations:
        "Checked samples: numeric absolute-value equations of the form |x − a| = b, plus harder variants.",
    },
    {
      section: "Math module 2",
      item: { number: "7", page: "printed p.41; PDF p.43" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand: "Evaluate a linear function in context at a given input",
      status: "covered",
      templateIds: [
        "sat-entry-fn-linear-notation",
        "substitute-linear-expression",
      ],
      limitations:
        "evaluate-contextual states a fee- or start-plus-rate model in function notation and asks for its value at a stated input, the same task with numeric entry.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 2",
      item: { number: "8", page: "printed p.41; PDF p.43" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.representations"],
      demand:
        "Choose the table of values that matches a quadratic function rule",
      status: "partial",
      templateIds: ["quadratic-from-data", "function-evaluation"],
      limitations:
        "quadratic-from-data goes table to rule (reverse direction); function-evaluation computes one value numerically. No rule-to-table choice.",
    },
    {
      section: "Math module 2",
      item: { number: "9", page: "printed p.41; PDF p.43" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand: "Evaluate an exponential function at input zero",
      status: "covered",
      templateIds: ["exponential-model-value"],
      limitations:
        "Checked samples: evaluates a·bˣ from a formula with numeric entry (choices are plain numbers); the zero input is an easier special case.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 2",
      item: { number: "10", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.psda.inference-margin-of-error"],
      archetypeIds: ["inference.margin"],
      demand:
        "Draw the plausible interval for a population proportion from an estimate and margin of error",
      status: "covered",
      templateIds: ["margin-of-error-interval"],
      limitations:
        "Checked samples: choose the interval centered on the estimate with the stated margin, against shifted and halved intervals.",
    },
    {
      section: "Math module 2",
      item: { number: "11", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.context"],
      demand:
        "Find the greatest whole number of items under a fixed-plus-per-item weight limit",
      status: "covered",
      templateIds: ["linear-model-value"],
      limitations:
        "Checked samples: includes fee-plus-rate budgets asking the greatest whole number of items; numeric entry for plain-number choices.",
    },
    {
      section: "Math module 2",
      item: { number: "12", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Find the positive solution of a nonmonic quadratic after moving all terms to one side",
      status: "covered",
      templateIds: ["quadratic-expanded-solutions"],
      limitations:
        "Checked samples: factors expanded nonmonic quadratics including negative leading coefficients and fractional roots; item first needs the constant moved across.",
    },
    {
      section: "Math module 2",
      item: { number: "13", page: "printed p.42; PDF p.44" },
      responseFormat: "numeric",
      standards: ["sat.psda.probability"],
      archetypeIds: ["probability.direct"],
      demand:
        "Find the probability of a category from the totals of a two-way table",
      status: "partial",
      templateIds: ["simple-probability", "relative-frequency-percent"],
      limitations:
        "simple-probability states counts directly; relative-frequency-percent reads a marginal from a two-way table but answers as a percent. No unconditional probability (fraction or decimal) from a two-way table.",
    },
    {
      section: "Math module 2",
      item: { number: "14", page: "printed p.42; PDF p.44" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.parallel-perpendicular"],
      demand:
        "Give the slope of a line parallel to the graph of a linear function",
      status: "covered",
      templateIds: ["perpendicular-slopes"],
      limitations:
        "Checked samples: equal slopes for parallel lines, numeric; template defines lines through points rather than by f(x) = mx + b.",
    },
    {
      section: "Math module 2",
      item: { number: "15", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.context"],
      demand:
        "Combine a 'times as many' statement with a 'more than' difference to find the smaller count",
      status: "covered",
      templateIds: [
        "system-model-value",
        "two-step-word-problem",
        "count-relation-chain",
      ],
      limitations:
        "count-relation-chain (times-as-many) turns 'times as many' and 'more than' into one equation and finds the smaller count, the larger count or their total; choices are plain numbers, so numeric entry fits.",
    },
    {
      section: "Math module 2",
      item: { number: "16", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Equate vertical-angle expressions to find a parameter, then use same-side interior angles of parallel lines",
      status: "covered",
      templateIds: ["angle-chase-chain"],
      limitations:
        "Vertical-angle expressions give the variable, then a same-side interior angle at the second parallel line, entered numerically. The released figure is replaced by a written description.",
    },
    {
      section: "Math module 2",
      item: { number: "17", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.parameters"],
      demand:
        "Find the parameter that gives a linear equation with a parametric x-coefficient no solution",
      status: "covered",
      templateIds: ["parameter-solution-count"],
      limitations:
        "Checked samples: no-solution and infinitely-many parameters for linear equations and systems, numeric (choices are plain numbers). Item's parameter sits inside a product term with a fractional answer.",
    },
    {
      section: "Math module 2",
      item: { number: "18", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.features"],
      demand: "Find the input where a factored quadratic reaches its minimum",
      status: "covered",
      templateIds: ["parabola-axis"],
      limitations:
        "Checked samples: axis of symmetry from factored form, standard form or zeros, numeric fraction entry matching plain-number choices.",
    },
    {
      section: "Math module 2",
      item: { number: "19", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["quadratic.context"],
      demand:
        "Interpret the vertex of a vertex-form quadratic height model as a minimum height",
      status: "partial",
      templateIds: ["quadratic-context-model", "structure-meaning"],
      limitations:
        "quadratic-context-model asks maximum or zero values with number choices; structure-meaning interprets a term of a launch model. Neither interprets a vertex as a minimum with statement choices.",
    },
    {
      section: "Math module 2",
      item: { number: "20", page: "printed p.44; PDF p.46" },
      responseFormat: "numeric",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.trig-ratio", "triangle.complement"],
      demand:
        "Given one acute angle's cosine as an unreduced ratio, find the other acute angle's cosine",
      status: "partial",
      templateIds: ["trig-ratio", "complementary-trig"],
      limitations:
        "trig-ratio gives sides and sometimes a missing side; complementary-trig maps sin A to cos(90° − A) without a missing side. No template switches angles from a given ratio while finding the third side.",
    },
    {
      section: "Math module 2",
      item: { number: "21", page: "printed p.44; PDF p.46" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.root-count"],
      demand:
        "Find the greatest integer coefficient for which a quadratic has no real solutions",
      status: "partial",
      templateIds: [
        "quadratic-real-solution-count",
        "quadratic-parameter-root",
      ],
      limitations:
        "quadratic-real-solution-count classifies fixed equations; quadratic-parameter-root solves discriminant = 0. Neither solves a discriminant inequality for an extreme integer.",
    },
    {
      section: "Math module 2",
      item: { number: "22", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.graph", "system.classify"],
      demand:
        "Decide how many solutions a graphed two-line system has after adding a third linear equation",
      status: "partial",
      templateIds: ["linear-system-solution-count"],
      limitations:
        "linear-system-solution-count classifies two-equation systems algebraically; no graph reading and no third-equation check of the intersection point.",
    },
    {
      section: "Math module 2",
      item: { number: "23", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.form"],
      demand:
        "Convert a decay model with a monthly exponent into an annual percent decrease",
      status: "partial",
      templateIds: ["exponential-time-scale", "compound-growth"],
      limitations:
        "exponential-time-scale phrases t/k exponents as 'multiplied by b every k units' with simple factors; compound-growth reads percent rates from compounding formulas. Neither asks the percent decrease 100(1 − b) for a decimal decay factor over x/12.",
    },
    {
      section: "Math module 2",
      item: { number: "24", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.spread", "univariate.center"],
      demand:
        "Compare medians and ranges after adding a constant to every value in a dot plot",
      status: "partial",
      templateIds: ["standard-deviation-compare"],
      limitations:
        "standard-deviation-compare covers the translation effect on standard deviation only; no median or range comparison and no dot plot.",
    },
    {
      section: "Math module 2",
      item: { number: "25", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.coordinate"],
      demand: "Choose the equation of a circle translated vertically",
      status: "partial",
      templateIds: ["circle-equation", "transform-equation"],
      limitations:
        "circle-equation reads center or radius numerically; transform-equation shifts function graphs. No template translates a circle and chooses its equation.",
    },
    {
      section: "Math module 2",
      item: { number: "26", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.surface"],
      demand:
        "Relate surface areas of two identical square-based prisms and the prism formed by joining them to find the base side",
      status: "partial",
      templateIds: ["net-surface-area"],
      limitations:
        "net-surface-area sums face areas from a net with given dimensions; item needs an algebraic surface-area relation with an unknown base side.",
    },
    {
      section: "Math module 2",
      item: { number: "27", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.change"],
      demand:
        "Find the percent increase from a value to one several times larger (above 500%)",
      status: "partial",
      templateIds: ["percent-change-rate"],
      limitations:
        "Same task and numeric entry, but sampled increases stay at or below 200%; item's increase is 600%.",
    },
  ],
);
