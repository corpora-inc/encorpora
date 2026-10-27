import { defineLedger } from "./types";

/** Every Math item of the nonadaptive Practice Test 11 form, labeled once.
 * SAT skills are classified against the Assessment Framework; the answer
 * explanations do not state them. */
export const satPractice11 = defineLedger(
  {
    id: "sat-practice-11",
    test: "SAT",
    form: "Practice Test 11",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-11-digital.pdf",
    edition:
      "Nonadaptive linear form of the digital SAT; test PDF modified 2025-10-14, answer explanations modified 2025-09-24",
    retrievedAt: "2026-10-26",
    sha256: "c5376d25a691f6774fa328a83516c068c226b33e3683055a0873e2fb7b0bd428",
    supplements: [
      {
        role: "answer explanations",
        url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-11-answers-digital.pdf",
        sha256:
          "049ecb1ea0fe13557964803a724b279f58243bd8ada18c0d794654c54a86ea4d",
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
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Find a triangle's third angle from the other two in an isosceles triangle",
      status: "covered",
      templateIds: ["triangle-angle-sum"],
      limitations:
        "Same angle-sum task with two given angles; choices are numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "2", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.solve"],
      demand:
        "Choose the equation produced by one inverse-operation step on a two-step linear equation",
      status: "partial",
      templateIds: ["two-step-equation", "equation-step-property"],
      limitations:
        "Templates solve or audit solution steps; none selects the equivalent equation after one step.",
    },
    {
      section: "Math module 1",
      item: { number: "3", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Choose a linear function's rule from its slope and its y-intercept point",
      status: "covered",
      templateIds: [
        "sat-fn-line-equation-choice",
        "linear-model-equation",
        "graph-equation-choice",
      ],
      limitations:
        "slope-intercept-point includes a function-notation version, f(x) = mx + b from the slope and the point (0, b).",
    },
    {
      section: "Math module 1",
      item: { number: "4", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Isolate the squared term of a quadratic without a linear term and take the positive root",
      status: "covered",
      templateIds: [
        "sat-entry-quadratic-solution",
        "solve-square-cube-equation",
      ],
      limitations:
        "Positive-solution entry by factoring and solving x squared = k both practiced; choices are numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "5", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.psda.probability"],
      archetypeIds: ["probability.direct"],
      demand:
        "Find a probability from a one-way frequency table of several categories",
      status: "partial",
      templateIds: ["simple-probability"],
      limitations:
        "Two category counts stated in text; the item reads one of several categories from a table.",
    },
    {
      section: "Math module 1",
      item: { number: "6", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.of"],
      demand: "Find a whole-number percent of a quantity in context",
      status: "partial",
      templateIds: ["percent-of", "percent-applications"],
      limitations:
        "percent-of is bare 'p% of n' without context; percent-applications has contexts but is choice-only while the item is numeric entry.",
    },
    {
      section: "Math module 1",
      item: { number: "7", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand:
        "Solve a system by substituting a repeated sum from one equation into the other",
      status: "covered",
      templateIds: ["sat-entry-system-solve"],
      limitations: "Numeric entry of one variable from a 2x2 system.",
    },
    {
      section: "Math module 1",
      item: { number: "8", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Choose the two-variable linear equation for a total of points earned at two rates",
      status: "covered",
      templateIds: [
        "sat-fn-constraint-choice",
        "system-model-value",
        "two-step-equation-model",
      ],
      limitations:
        "points chooses ax + by = c for a total score from two point values, with swapped, reciprocal and product distractors.",
    },
    {
      section: "Math module 1",
      item: { number: "9", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.input-output"],
      demand: "Evaluate a square-root function at a perfect-square input",
      status: "partial",
      templateIds: ["function-evaluation"],
      limitations:
        "Evaluates quadratics only; the item evaluates a radical function.",
    },
    {
      section: "Math module 1",
      item: { number: "10", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.psda.inference-margin-of-error"],
      archetypeIds: ["inference.estimate"],
      demand: "Scale a random-sample proportion to estimate a population count",
      status: "covered",
      templateIds: ["sample-proportion-estimate"],
      limitations: "Same task; choices are numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "11", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.factor"],
      demand:
        "Factor the greatest common monomial from a two-variable binomial",
      status: "partial",
      templateIds: ["greatest-monomial-factor"],
      limitations:
        "One-variable GCF extraction; the item factors powers of two variables.",
    },
    {
      section: "Math module 1",
      item: { number: "12", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.system"],
      demand: "Find the intersection point of a vertical line and a parabola",
      status: "partial",
      templateIds: ["nonlinear-system-solve"],
      limitations:
        "Numeric entry of one coordinate for slanted lines; the item selects an ordered pair.",
    },
    {
      section: "Math module 1",
      item: { number: "13", page: "printed p.34; PDF p.36" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Substitute a known count into a two-variable value equation in context and solve for the other count",
      status: "partial",
      templateIds: ["solution-coordinate", "two-step-word-problem"],
      limitations:
        "solution-coordinate substitutes into context-free equations; two-step-word-problem writes its own equation; no given two-variable model in context.",
    },
    {
      section: "Math module 1",
      item: { number: "14", page: "printed p.35; PDF p.37" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Find an initial population from a later value when it doubles over a fixed multi-year period",
      status: "covered",
      templateIds: ["sat-entry-fn-exponential", "exponential-model-value"],
      limitations:
        "initial-from-later divides a later count by the growth factor once per multi-year period to find the start.",
    },
    {
      section: "Math module 1",
      item: { number: "15", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["bivariate.linear-fit"],
      demand: "Estimate the slope of a drawn line of best fit on a scatterplot",
      status: "partial",
      templateIds: ["trend-line-predict"],
      limitations:
        "Slope from two marked points, then a numeric prediction; the item estimates the slope of an unmarked best-fit line.",
    },
    {
      section: "Math module 1",
      item: { number: "16", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.root-count"],
      demand:
        "Choose which squared-binomial equation has exactly one distinct real solution",
      status: "partial",
      templateIds: [
        "quadratic-real-solution-count",
        "solve-square-cube-equation",
      ],
      limitations:
        "Counts roots of one given equation numerically; the item compares equations with zero, negative and positive right sides.",
    },
    {
      section: "Math module 1",
      item: { number: "17", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.context"],
      demand:
        "Choose the equation for a flat charge covering initial hours plus an hourly rate for the extra hours",
      status: "partial",
      templateIds: ["two-step-equation-model", "piecewise-evaluate"],
      limitations:
        "Fee-plus-rate equations use the full input; the 'extra hours beyond the first' structure appears only in numeric piecewise evaluation.",
    },
    {
      section: "Math module 1",
      item: { number: "18", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.graph"],
      demand:
        "Choose the graph of a contextual system of two standard-form linear equations",
      status: "partial",
      templateIds: ["graph-equation-choice"],
      limitations:
        "Matches one graphed line to its equation; no choosing a graph of two standard-form lines for a system.",
    },
    {
      section: "Math module 1",
      item: { number: "19", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.trig-ratio"],
      demand:
        "Express the hypotenuse of a right triangle in terms of a known leg and the sine of an angle",
      status: "partial",
      templateIds: ["trig-ratio", "trig-context-triangle"],
      limitations:
        "Numeric ratios or sides with given angle measures; no symbolic side expression in sine or cosine.",
    },
    {
      section: "Math module 1",
      item: { number: "20", page: "printed p.37; PDF p.39" },
      responseFormat: "numeric",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.coordinate"],
      demand:
        "Find the squared radius of a concentric circle whose radius is a multiple of a given circle's",
      status: "partial",
      templateIds: ["circle-equation", "circle-dilation-scaling"],
      limitations:
        "Reading r squared and scaling circles appear separately; no numeric r squared after multiplying a radius.",
    },
    {
      section: "Math module 1",
      item: { number: "21", page: "printed p.37; PDF p.39" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Use the quadratic formula to identify the discriminant in a given form of one solution",
      status: "partial",
      templateIds: ["quadratic-irrational-solutions"],
      limitations:
        "Choice-only radical solutions; the item needs numeric entry of the discriminant.",
    },
    {
      section: "Math module 1",
      item: { number: "22", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.center"],
      demand:
        "Find the combined mean of two groups of different sizes from their means",
      status: "covered",
      templateIds: ["frequency-table-center"],
      limitations:
        "Samples combine two class means weighted by size with numeric choices.",
    },
    {
      section: "Math module 1",
      item: { number: "23", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.transform"],
      demand:
        "Recover an exponential function's constant from the graph of its vertical translation",
      status: "partial",
      templateIds: ["transform-equation"],
      limitations:
        "Parents are absolute value, cube, square root and similar, applied forward; no exponential parent and no recovering f from the graph of f(x) + c.",
    },
    {
      section: "Math module 1",
      item: { number: "24", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Decide which expression cannot be the sum of two angles formed by intersecting lines given one angle as an expression",
      status: "covered",
      templateIds: ["angle-claim-reasoning"],
      limitations:
        "The expression-sum variant gives one angle as a linear expression and asks which candidate cannot be the sum of two of the four angles, using the three possible sums and one impossible expression.",
    },
    {
      section: "Math module 1",
      item: { number: "25", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.classify"],
      demand:
        "Decide which candidate second equations give a linear system at least one solution",
      status: "partial",
      templateIds: ["linear-system-solution-count"],
      limitations:
        "Classifies one given system; the item tests two candidate equations with decimal coefficients in Roman-numeral format.",
    },
    {
      section: "Math module 1",
      item: { number: "26", page: "printed p.39; PDF p.41" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.surface"],
      demand:
        "Write the surface area of a rectangular prism as an expression when its base area contains a parameter",
      status: "partial",
      templateIds: ["net-surface-area", "composite-face-prism-surface-area"],
      limitations:
        "Numeric surface areas from nets or figures; the item derives a width from a base area and expresses the total in a parameter.",
    },
    {
      section: "Math module 1",
      item: { number: "27", page: "printed p.39; PDF p.41" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Find the shift constant in a linear rule written in point form from a point where the output equals the added constant",
      status: "partial",
      templateIds: ["recover-linear-intercept"],
      limitations:
        "Recovers the zero-input output from a rate and a point; no unknown horizontal shift inside a point-form rule.",
    },
    {
      section: "Math module 2",
      item: { number: "1", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Combine like terms in a linear expression containing an unlike term in a second variable",
      status: "partial",
      templateIds: ["equivalent-expressions-check", "polynomial-addition"],
      limitations: "Like terms are combined only in one-variable expressions.",
    },
    {
      section: "Math module 2",
      item: { number: "2", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.displays"],
      demand: "Read the number of data values at one value of a dot plot",
      status: "covered",
      templateIds: ["line-plot-whole"],
      limitations:
        "SAT-eligible line plot family asks the count at one value; choices are numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "3", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.area"],
      demand: "Find the area of a rectangle from its length and width",
      status: "covered",
      templateIds: ["rectangle-area"],
      limitations: "Same task; the item's two-digit sides are calculator work.",
    },
    {
      section: "Math module 2",
      item: { number: "4", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand: "Solve a system where one equation gives x directly, then find y",
      status: "covered",
      templateIds: ["sat-entry-system-solve"],
      limitations:
        "Numeric 2x2 systems cover this simpler structure; choices are numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "5", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Find the input of a grouped linear function that gives a stated output",
      status: "covered",
      templateIds: ["sat-entry-fn-linear-notation", "two-step-equation"],
      limitations:
        "input-grouped solves f(x) = p(x + c) = v for x in function notation. Choices are plain numbers, so exact numeric entry practices the same answer.",
    },
    {
      section: "Math module 2",
      item: { number: "6", page: "printed p.43; PDF p.45" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.solve"],
      demand: "Solve a one-step multiplication equation with a decimal answer",
      status: "covered",
      templateIds: ["one-step-equation"],
      limitations: "Same one-step task with decimal results and numeric entry.",
    },
    {
      section: "Math module 2",
      item: { number: "7", page: "printed p.43; PDF p.45" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Find the initial value of an exponential model with an unknown base",
      status: "partial",
      templateIds: ["structure-meaning"],
      limitations:
        "structure-meaning interprets the coefficient as the starting amount but is choice-only; the item is numeric entry.",
    },
    {
      section: "Math module 2",
      item: { number: "8", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.context"],
      demand:
        "Choose the two-variable budget inequality for buying two items at decimal prices",
      status: "partial",
      templateIds: ["constraint-feasible"],
      limitations:
        "Chooses a point meeting given inequalities; no selecting the budget inequality itself.",
    },
    {
      section: "Math module 2",
      item: { number: "9", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.representations"],
      demand:
        "Classify a graphed function as increasing or decreasing and linear or exponential",
      status: "partial",
      templateIds: ["linear-or-exponential", "exponential-model-rule"],
      limitations:
        "Linear/exponential decisions come from tables and stories without direction; no classifying a curve from its graph.",
    },
    {
      section: "Math module 2",
      item: { number: "10", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Choose the inequality for a region shaded above a horizontal boundary line",
      status: "covered",
      templateIds: ["half-plane-inequality"],
      limitations:
        "Samples include axis-parallel boundaries with x/y and direction distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "11", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the exponential model for counts that halve each round when the coefficient is not the first-round value",
      status: "covered",
      templateIds: ["sat-fn-exponential-choice", "exponential-model-rule"],
      limitations:
        "first-round-coefficient models a count that is multiplied by a fraction each round when round 1 is the first value, so the exponent is x - 1.",
    },
    {
      section: "Math module 2",
      item: { number: "12", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.parallel-perpendicular"],
      demand:
        "Choose the equation of a line parallel to a given line through its y-intercept point",
      status: "partial",
      templateIds: ["perpendicular-slopes"],
      limitations:
        "Numeric slope or intercept from two points; the item selects an equation from a slope-intercept line.",
    },
    {
      section: "Math module 2",
      item: { number: "13", page: "printed p.45; PDF p.47" },
      responseFormat: "numeric",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["triangle.special"],
      demand: "Find an acute angle of a right triangle with equal legs",
      status: "covered",
      templateIds: ["special-triangle-in-figure"],
      limitations:
        "The acute-angle variant gives equal legs and asks the acute angle; related variants use 1:sqrt3 legs or a leg half the hypotenuse. Figure reading is replaced by written side lengths.",
    },
    {
      section: "Math module 2",
      item: { number: "14", page: "printed p.45; PDF p.47" },
      responseFormat: "numeric",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.coordinate"],
      demand: "Read the radius of a circle from its standard-form equation",
      status: "covered",
      templateIds: ["circle-equation"],
      limitations:
        "Reads center and radius from circle equations with numeric entry.",
    },
    {
      section: "Math module 2",
      item: { number: "15", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["function.graph-context"],
      demand:
        "Interpret a decimal point on a curved context graph as an input and its output",
      status: "partial",
      templateIds: ["coordinate-context-points"],
      limitations:
        "Grade 3-5 whole-number points; the item reads a decimal point on a curve with maximum and minimum distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "16", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.polynomial-zeros"],
      demand: "Identify a factor of a polynomial from its x-intercepts",
      status: "covered",
      templateIds: ["zeros-from-factors"],
      limitations:
        "Samples link listed zeros to linear factors with choices; the item gives zeros as points.",
    },
    {
      section: "Math module 2",
      item: { number: "17", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Find the y-intercept of a decreasing linear function from a table starting at input 1",
      status: "covered",
      templateIds: ["linear-model-equation"],
      limitations:
        "Table variants include decreasing tables starting above input 0; the item asks only for the constant.",
    },
    {
      section: "Math module 2",
      item: { number: "18", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.quadratic-from-data"],
      demand:
        "Choose a quadratic's rule from a table with two equal outputs and unequal input steps",
      status: "partial",
      templateIds: ["quadratic-from-data"],
      limitations:
        "Tables have equal steps and standard-form answers; the item uses symmetric equal outputs and shifted factored forms.",
    },
    {
      section: "Math module 2",
      item: { number: "19", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Read the x-intercept of a two-variable mass constraint graph and divide the total by it",
      status: "partial",
      templateIds: ["linear-initial-value-meaning", "solution-coordinate"],
      limitations:
        "No reading an intercept of a constraint graph as the all-of-one-type case to find a unit amount.",
    },
    {
      section: "Math module 2",
      item: { number: "20", page: "printed p.47; PDF p.49" },
      responseFormat: "numeric",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.radical"],
      demand:
        "Rewrite radicals as rational exponents and equate exponents to solve for a parameter in a power",
      status: "partial",
      templateIds: ["symbolic-rational-exponent", "same-base-equation"],
      limitations:
        "Single radical-to-exponent conversions and equating exponents of numeric bases exist; no two-variable radical relation solved for an exponent parameter.",
    },
    {
      section: "Math module 2",
      item: { number: "21", page: "printed p.47; PDF p.49" },
      responseFormat: "numeric",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.successive"],
      demand:
        "Apply a percent increase over 300% and then a percent decrease to a number",
      status: "partial",
      templateIds: ["successive-percent-change"],
      limitations:
        "Two moderate percent changes to a price with cent rounding; the item has a very large increase.",
    },
    {
      section: "Math module 2",
      item: { number: "22", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["nonlinear.features"],
      demand:
        "Choose the equivalent quadratic form that displays the maximum value",
      status: "covered",
      templateIds: ["quadratic-form-conversion"],
      limitations:
        "Samples ask which of several equivalent forms shows the maximum directly, as in the item.",
    },
    {
      section: "Math module 2",
      item: { number: "23", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["triangle.relationships"],
      demand:
        "Use similar triangles formed by intersecting segments to find a side",
      status: "covered",
      templateIds: ["crossing-segment-similarity"],
      limitations:
        "Two crossing segments with a parallel pair or a stated equal angle form similar triangles; numeric entry finds a missing side by equal ratios. The released figure is replaced by a written setup.",
    },
    {
      section: "Math module 2",
      item: { number: "24", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.polynomial-zeros"],
      demand:
        "Count distinct real solutions of a product of a sum of cubes and a difference of fourth powers",
      status: "partial",
      templateIds: [
        "polynomial-factoring-patterns",
        "quadratic-real-solution-count",
      ],
      limitations:
        "Factoring cubes and counting quadratic roots appear separately; no counting distinct real zeros of a product of higher-degree factors.",
    },
    {
      section: "Math module 2",
      item: { number: "25", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.outliers"],
      demand:
        "Decide how the mean and median change when a value below all others is added to histogram data",
      status: "partial",
      templateIds: ["outlier-center-shift", "frequency-table-center"],
      limitations:
        "Center changes are judged from dot plots or frequency tables with exact values; the item uses binned histogram data and Roman-numeral statements.",
    },
    {
      section: "Math module 2",
      item: { number: "26", page: "printed p.49; PDF p.51" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.trig-ratio", "triangle.relationships"],
      demand:
        "Find the tangent of an angle using the altitude to the hypotenuse and similar sub-triangles",
      status: "partial",
      templateIds: ["trig-ratio", "similarity-theorem-length"],
      limitations:
        "Ratios come from the angle's own triangle and altitude relations give lengths; no transferring a ratio to a similar sub-triangle.",
    },
    {
      section: "Math module 2",
      item: { number: "27", page: "printed p.49; PDF p.51" },
      responseFormat: "numeric",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.units"],
      demand:
        "Convert an area between square units with a decimal length factor and round",
      status: "covered",
      templateIds: ["compound-unit-conversion"],
      limitations:
        "Squared-unit conversion with a stated factor; decimal factor and rounding are calculator work.",
    },
  ],
);
