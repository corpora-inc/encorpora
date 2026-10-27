import { defineLedger } from "./types";

/** Every Math item of the nonadaptive Practice Test 5 form, labeled once.
 * SAT skills are classified against the Assessment Framework; the answer
 * explanations do not state them. */
export const satPractice5 = defineLedger(
  {
    id: "sat-practice-5",
    test: "SAT",
    form: "Practice Test 5",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-5-digital.pdf",
    edition:
      "Nonadaptive linear form of the digital SAT; test PDF modified 2024-09-27, answer explanations modified 2023-11-17",
    retrievedAt: "2026-10-26",
    sha256: "1dc2a1f5cbae120433b84417306d68b4f1917f5a0283838f95aad145a86d269f",
    supplements: [
      {
        role: "answer explanations",
        url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-5-answers-digital.pdf",
        sha256:
          "5d2c03b2b32713c7aad5e209947b48eee9e0e012297f178df8ce01058fb1f006",
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
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.system"],
      demand:
        "Read the solution of a linear and nonlinear system from its graph as an ordered pair",
      status: "partial",
      templateIds: ["nonlinear-system-read"],
      limitations:
        "nonlinear-system-read enters one coordinate of a line–parabola intersection with equations shown; item shows only the graph and asks for the ordered pair.",
    },
    {
      section: "Math module 1",
      item: { number: "2", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Find a quantity after several periods of constant growth from a starting amount in context",
      status: "covered",
      templateIds: [
        "sat-entry-fn-linear-notation",
        "arithmetic-term",
        "linear-model-value",
      ],
      limitations:
        "growth-words gives a starting amount and a constant gain per period and asks for the amount after several periods in a context. Choices are plain numbers, so exact numeric entry practices the same answer.",
    },
    {
      section: "Math module 1",
      item: { number: "3", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Read the y-intercept of a graphed decreasing linear function as a point",
      status: "partial",
      templateIds: ["coordinate-point-reading", "graph-equation-choice"],
      limitations:
        "coordinate-point-reading reads one coordinate of a labeled point; graph-equation-choice uses intercepts of increasing lines only. No y-intercept identification with point choices.",
    },
    {
      section: "Math module 1",
      item: { number: "4", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand:
        "Substitute a given value into a linear system and choose the ordered pair in the stated variable order",
      status: "covered",
      templateIds: ["linear-system-pair"],
      limitations:
        "Checked samples: includes systems with an axis-aligned equation; item adds a nonstandard (r, s) order.",
    },
    {
      section: "Math module 1",
      item: { number: "5", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["bivariate.growth"],
      demand:
        "Classify a function given by a table as increasing or decreasing, linear or exponential",
      status: "partial",
      templateIds: ["linear-or-exponential"],
      limitations:
        "linear-or-exponential offers only linear, exponential or neither; it never asks increasing versus decreasing.",
    },
    {
      section: "Math module 1",
      item: { number: "6", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.graph"],
      demand: "Read the x-coordinate of the intersection of two graphed lines",
      status: "partial",
      templateIds: ["nonlinear-system-read"],
      limitations:
        "nonlinear-system-read reads a line–parabola intersection with equations given; no template reads a two-line system from its graph alone.",
    },
    {
      section: "Math module 1",
      item: { number: "7", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.spread"],
      demand: "Find the range of a short list of scores",
      status: "covered",
      templateIds: ["range-data"],
      limitations:
        "Checked samples: range of a finite list, numeric (template adds signed decimals).",
    },
    {
      section: "Math module 1",
      item: { number: "8", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Use vertical angles to decide how an unknown angle compares with a given angle",
      status: "covered",
      templateIds: ["angle-claim-reasoning"],
      limitations:
        "Single-choice items compare vertical angles (equal) and adjacent angles on a line, with a cannot-be-determined distractor. The released figure is replaced by a written description.",
    },
    {
      section: "Math module 1",
      item: { number: "9", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Substitute a known value into a two-variable sum constraint in context to find the other quantity",
      status: "covered",
      templateIds: ["solution-coordinate"],
      limitations:
        "Checked samples: substitute a known coordinate into a two-variable linear equation, numeric (choices are plain numbers); template is abstract, item adds context labels.",
    },
    {
      section: "Math module 1",
      item: { number: "10", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.psda.inference-margin-of-error"],
      archetypeIds: ["inference.estimate"],
      demand: "Scale a random-sample proportion up to a population count",
      status: "covered",
      templateIds: ["sample-proportion-estimate"],
      limitations:
        "Checked samples: same scaling of a sample fraction to a population, numeric (choices are plain numbers).",
    },
    {
      section: "Math module 1",
      item: { number: "11", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.structure"],
      demand:
        "Find the value of x − c from a linear equation by dividing through by a common factor",
      status: "covered",
      templateIds: ["sat-entry-fn-related-value", "two-step-equation"],
      limitations:
        "common-factor asks for x - c from an equation whose left side is a multiple of x - c, solved by dividing through, with numeric entry; choices are plain numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "12", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.context"],
      demand:
        "Write a compound inequality for a quantity bounded by a recorded minimum and maximum",
      status: "partial",
      templateIds: ["inequality-from-context", "absolute-compound-inequality"],
      limitations:
        "inequality-from-context writes single-bound inequalities only; absolute-compound-inequality solves given compound inequalities, not from a context.",
    },
    {
      section: "Math module 1",
      item: { number: "13", page: "printed p.35; PDF p.37" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.system"],
      demand:
        "Solve a line-and-parabola system by substitution and enter the positive x-coordinate",
      status: "covered",
      templateIds: ["nonlinear-system-solve"],
      limitations:
        "Checked samples: substitute a line into a quadratic with integer intersections and enter a coordinate chosen by a size condition.",
    },
    {
      section: "Math module 1",
      item: { number: "14", page: "printed p.35; PDF p.37" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Identify the per-item price in a two-product total-sales equation and enter it",
      status: "partial",
      templateIds: ["interpret-linear-parameters", "structure-meaning"],
      limitations:
        "Both are single-choice interpretations of a slope or term in y = mx + b forms; item asks to enter the coefficient's value from an ax + by = c model.",
    },
    {
      section: "Math module 1",
      item: { number: "15", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.volume"],
      demand:
        "Find a cylinder's volume as a multiple of π from its diameter and height",
      status: "covered",
      templateIds: ["cylinder-volume"],
      limitations:
        "Checked samples: includes diameter inputs and the aπ form; the coefficient answer matches kπ choices.",
    },
    {
      section: "Math module 1",
      item: { number: "16", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.transform"],
      demand:
        "Choose the graph of f(x) + k given the graph of a rational function",
      status: "partial",
      templateIds: ["transform-equation", "transform-point"],
      limitations:
        "graph-after-shift chooses shifted graphs of lines, absolute-value graphs, parabolas and zigzags; the graph of a rational function shifted vertically is not drawn, because its asymptote labels crowd the axis labels.",
    },
    {
      section: "Math module 1",
      item: { number: "17", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Write an expression for one quantity in a part-to-part ratio given the other as a variable",
      status: "partial",
      templateIds: ["variation-constant"],
      limitations:
        "variation-constant chooses y = kx models from a stated pair in direct or inverse variation; no template turns a stated ratio into an expression in a variable.",
    },
    {
      section: "Math module 1",
      item: { number: "18", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["linear.meaning"],
      demand:
        "Interpret the constant of a linear equation written as y − mx = c as an excess quantity",
      status: "partial",
      templateIds: ["interpret-linear-parameters"],
      limitations:
        "Template models are y = mx + b with initial-value interpretations; item needs rearranging and reads the constant as amount bought beyond amount used.",
    },
    {
      section: "Math module 1",
      item: { number: "19", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["circle.unit-trig"],
      demand: "Find the tangent of a radian angle many turns past 2π",
      status: "covered",
      templateIds: ["special-angle-exact-value"],
      limitations:
        "Checked samples: radian and degree angles several turns past one revolution, including tangent values with radical answers.",
    },
    {
      section: "Math module 1",
      item: { number: "20", page: "printed p.37; PDF p.39" },
      responseFormat: "numeric",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.trig-ratio"],
      demand:
        "Write the cosine of an acute angle in a labeled right triangle as a fraction",
      status: "covered",
      templateIds: ["trig-ratio"],
      limitations:
        "Checked samples: exact sin, cos or tan as side ratios with fraction entry; template states sides in text while item labels a figure.",
    },
    {
      section: "Math module 1",
      item: { number: "21", page: "printed p.38; PDF p.40" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.polynomial-zeros", "nonlinear.input-output"],
      demand:
        "Use a known zero to find an unknown constant in a factored quadratic, then evaluate it at 0",
      status: "partial",
      templateIds: ["zeros-from-factors", "function-evaluation"],
      limitations:
        "zeros-from-factors links fixed factors to zeros (choice); function-evaluation evaluates a given quadratic. No template recovers a constant from a zero and then evaluates.",
    },
    {
      section: "Math module 1",
      item: { number: "22", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.coordinate"],
      demand:
        "Use a circle's center and radius to bound the possible x-coordinates of its points",
      status: "partial",
      templateIds: ["circle-equation"],
      limitations:
        "circle-equation reads center or radius numerically; it never asks the extent of x-values on the circle.",
    },
    {
      section: "Math module 1",
      item: { number: "23", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["quadratic.context"],
      demand:
        "Write a volume function for a prism whose base length exceeds its width by a constant",
      status: "partial",
      templateIds: ["quadratic-context-model"],
      limitations:
        "quadratic-context-model builds area models internally and asks a solved value; item asks to choose the function definition.",
    },
    {
      section: "Math module 1",
      item: { number: "24", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.features"],
      demand:
        "Decide whether given decreasing exponential functions attain a minimum value",
      status: "partial",
      templateIds: ["function-graph-features"],
      limitations:
        "function-graph-features is not SAT-profile eligible; it reads asymptotes, range and direction, not extreme values with I/II statement choices.",
    },
    {
      section: "Math module 1",
      item: { number: "25", page: "printed p.39; PDF p.41" },
      responseFormat: "choice",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.change"],
      demand:
        "Find the original value after a percent increase of several hundred percent",
      status: "partial",
      templateIds: ["percent-change-original"],
      limitations:
        "Same task with numeric entry for plain-number choices, but sampled increases stop at 200%; item uses 400%.",
    },
    {
      section: "Math module 1",
      item: { number: "26", page: "printed p.39; PDF p.41" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.quadratic-from-data"],
      demand:
        "From two zeros and an integer leading coefficient, find a possible value of a + b",
      status: "partial",
      templateIds: ["quadratic-from-data"],
      limitations:
        "quadratic-from-data fixes the leading coefficient from a point and chooses the equation; item leaves it as a constrained integer and asks a coefficient sum.",
    },
    {
      section: "Math module 1",
      item: { number: "27", page: "printed p.39; PDF p.41" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.polynomial-zeros"],
      demand:
        "Find the sum of all w that make a factored polynomial evaluated at (c − w) equal zero",
      status: "partial",
      templateIds: ["sat-entry-polynomial-zeros"],
      limitations:
        "sat-entry-polynomial-zeros enters zeros or their distinct sum directly; item composes with an input shift (c − w) over a repeated factor.",
    },
    {
      section: "Math module 2",
      item: { number: "1", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.of"],
      demand: "Find a whole-number percent of a whole number",
      status: "covered",
      templateIds: ["percent-of"],
      limitations:
        "Checked samples: p% of N with exact numeric entry; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "2", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["data.graph-read"],
      demand:
        "Read the output of a graphed relationship at a given input on scaled axes",
      status: "partial",
      templateIds: ["coordinate-point-reading"],
      limitations:
        "coordinate-point-reading reads a labeled lattice point on a unit grid; item reads a curve's value at an input on scaled context axes.",
    },
    {
      section: "Math module 2",
      item: { number: "3", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand: "Evaluate a linear function at an integer input",
      status: "covered",
      templateIds: [
        "sat-entry-fn-linear-notation",
        "substitute-linear-expression",
      ],
      limitations:
        "evaluate-integer states the rule in function notation with signed integer coefficients and asks for f(a) at an integer. Choices are plain numbers, so exact numeric entry practices the same answer.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 2",
      item: { number: "4", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.factor"],
      demand:
        "Factor the greatest common monomial from a two-variable binomial",
      status: "partial",
      templateIds: ["greatest-monomial-factor"],
      limitations:
        "greatest-monomial-factor uses single-variable polynomials only; item's common factor contains two variables.",
    },
    {
      section: "Math module 2",
      item: { number: "5", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Choose the linear equation for a per-unit rate plus a fixed amount in context",
      status: "covered",
      templateIds: ["linear-model-equation"],
      limitations:
        "Checked samples: chooses y = mx + b from a starting amount and rate in words, with swapped-rate and summed distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "6", page: "printed p.43; PDF p.45" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.structure"],
      demand: "Solve a one-step equation and evaluate a related expression",
      status: "covered",
      templateIds: ["sat-entry-fn-related-value", "one-step-equation"],
      limitations:
        "scaled-term gives a one-step equation, with an integer or fractional coefficient, and asks for a multiple of the variable.",
    },
    {
      section: "Math module 2",
      item: { number: "7", page: "printed p.43; PDF p.45" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Solve a factored difference-of-squares equation after cancelling equal constants",
      status: "partial",
      templateIds: [
        "quadratic-factored-solutions",
        "sat-entry-quadratic-solution",
      ],
      limitations:
        "quadratic-factored-solutions solves product-of-factors equations but is single-choice; sat-entry-quadratic-solution is numeric but starts from expanded form. No numeric factored-form item with a constant to cancel.",
    },
    {
      section: "Math module 2",
      item: { number: "8", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Choose the slope-intercept equation of a line from its slope and its y-intercept point",
      status: "covered",
      templateIds: ["sat-fn-line-equation-choice", "linear-model-equation"],
      limitations:
        "slope-intercept-point gives the slope and the point (0, b) and offers swapped, sign-reversed and inverted-slope distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "9", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["function.graph-context"],
      demand:
        "Interpret the x-intercept of a curved height-versus-time graph in context",
      status: "partial",
      templateIds: ["quadratic-context-model", "distance-graph-meaning"],
      limitations:
        "quadratic-context-model finds a landing time from a formula; distance-graph-meaning interprets linear segments. No x-intercept interpretation of a curved graph with statement choices.",
    },
    {
      section: "Math module 2",
      item: { number: "10", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["function.value-meaning"],
      demand:
        "Interpret a statement f(a) = b for a quadratic physics model in context",
      status: "partial",
      templateIds: ["coordinate-context-points"],
      limitations:
        "coordinate-context-points (grade 3–5) interprets a plotted point in a situation; no template interprets function notation f(a) = b for a formula model.",
    },
    {
      section: "Math module 2",
      item: { number: "11", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["bivariate.linear-fit"],
      demand:
        "Count data points whose actual value exceeds the value predicted by a line of best fit",
      status: "partial",
      templateIds: ["residual-value"],
      limitations:
        "residual-value computes one residual from a given equation; no counting of points above a drawn line on a scatterplot.",
    },
    {
      section: "Math module 2",
      item: { number: "12", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.psda.probability"],
      archetypeIds: ["probability.inverse"],
      demand:
        "Find the count in the remaining category from a total and the probabilities of the other categories",
      status: "partial",
      templateIds: ["probability-missing-count"],
      limitations:
        "probability-missing-count recovers a count from a probability and the complementary count in two categories; item has three categories, decimal probabilities and a known total.",
    },
    {
      section: "Math module 2",
      item: { number: "13", page: "printed p.45; PDF p.47" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Find the slope of a line whose equation has a scaled grouped term plus another x-term",
      status: "partial",
      templateIds: ["combine-like-coefficient"],
      limitations:
        "combine-like-coefficient combines integer x-coefficients without distribution; item distributes a fraction and frames the coefficient as a slope.",
    },
    {
      section: "Math module 2",
      item: { number: "14", page: "printed p.45; PDF p.47" },
      responseFormat: "numeric",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.surface"],
      demand: "Find the exterior surface area of an open cube-shaped box",
      status: "partial",
      templateIds: ["net-surface-area"],
      limitations:
        "net-surface-area covers closed prisms drawn as nets; item omits one face and gives no net.",
    },
    {
      section: "Math module 2",
      item: { number: "15", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.outliers"],
      demand:
        "Compare means after adding a value smaller than every existing value",
      status: "covered",
      templateIds: ["frequency-table-center"],
      limitations:
        "Checked samples: includes adding a value and choosing the direction of the mean and median change; item lists the data in a small table.",
    },
    {
      section: "Math module 2",
      item: { number: "16", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Use the triangle angle sum to decide which measure is possible for a second angle",
      status: "covered",
      templateIds: ["angle-claim-reasoning"],
      limitations:
        "Single-choice triangle-bound items decide which second-angle measure is possible or impossible from one obtuse angle, with the exact remaining sum as a distractor.",
    },
    {
      section: "Math module 2",
      item: { number: "17", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.polynomial"],
      demand: "Subtract two binomials with cubic and constant terms",
      status: "covered",
      templateIds: ["polynomial-subtraction"],
      limitations:
        "Checked samples: distributes the subtraction sign and combines like terms, with sign-error distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "18", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.rational-radical", "linear.structure"],
      demand:
        "Solve a scaled square-root equation and evaluate a multiple of the variable",
      status: "partial",
      templateIds: ["radical-equation-isolated"],
      limitations:
        "radical-equation-isolated solves an isolated √(ax + b) = c for x; item has a coefficient on the radical and asks a multiple of x.",
    },
    {
      section: "Math module 2",
      item: { number: "19", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Choose the table whose every (x, y) pair satisfies a two-variable linear inequality",
      status: "partial",
      templateIds: ["inequality-solution-point"],
      limitations:
        "inequality-solution-point tests single points against a graphed inequality; item tests three-row tables with large x-values and no graph.",
    },
    {
      section: "Math module 2",
      item: { number: "20", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.expression"],
      demand:
        "Add two linear equations to eliminate one variable and enter a multiple of the other",
      status: "covered",
      templateIds: ["sat-entry-system-expression"],
      limitations:
        "Checked samples: combine equations to enter an expression's value without solving each variable, including single-variable multiples.",
    },
    {
      section: "Math module 2",
      item: { number: "21", page: "printed p.47; PDF p.49" },
      responseFormat: "numeric",
      standards: ["sat.geo.circles"],
      archetypeIds: ["triangle.special", "circle.parts"],
      demand:
        "Use a 30-60-90 rectangle inscribed in a circle and its area to find the diameter",
      status: "partial",
      templateIds: ["special-right-triangle"],
      limitations:
        "special-right-triangle finds sides from one side of a named special triangle; item must infer the ratio from a length condition, solve from an area with √3 and use diagonal = diameter.",
    },
    {
      section: "Math module 2",
      item: { number: "22", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.scale"],
      demand: "Find the area of a similar figure from the side scale factor",
      status: "covered",
      templateIds: ["similar-triangle-side"],
      limitations:
        "Checked samples: includes area from the squared scale factor (triangles, numeric; choices are plain numbers); item uses rectangles.",
    },
    {
      section: "Math module 2",
      item: { number: "23", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.rational"],
      demand:
        "Add a rational term and a monomial with letter coefficients and factor the numerator",
      status: "partial",
      templateIds: ["rational-expression-operation"],
      limitations:
        "rational-expression-operation adds numeric-numerator fractions in x; item uses parameters a and k, adds a non-fraction term and factors the result.",
    },
    {
      section: "Math module 2",
      item: { number: "24", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.root-count"],
      demand:
        "Identify which of several quadratic equations has no real solutions",
      status: "partial",
      templateIds: ["quadratic-real-solution-count"],
      limitations:
        "quadratic-real-solution-count enters a count for one equation; item chooses among four equations (equation choices).",
    },
    {
      section: "Math module 2",
      item: { number: "25", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.form"],
      demand:
        "Find the period in months over which an exponential model grows by its base rate when the exponent is a fractional multiple of t",
      status: "partial",
      templateIds: ["exponential-time-scale"],
      limitations:
        "exponential-time-scale uses integer periods t/k in years; item has exponent (6/4)t and asks the period in months.",
    },
    {
      section: "Math module 2",
      item: { number: "26", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.parts", "line.parallel-perpendicular"],
      demand:
        "Use the perpendicular radius at a point of tangency to find the tangent line and test points on it",
      status: "partial",
      templateIds: ["circle-segment-lengths"],
      limitations:
        "circle-segment-lengths asks only the tangent line's slope; item continues to test which point lies on the tangent line.",
    },
    {
      section: "Math module 2",
      item: { number: "27", page: "printed p.48; PDF p.50" },
      responseFormat: "numeric",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.scale"],
      demand:
        "Split a total proportional to area between two squares with a 3:1 side ratio",
      status: "partial",
      templateIds: ["similar-triangle-side"],
      limitations:
        "similar-triangle-side uses the squared scale factor for similar areas; item partitions a total over two adjacent squares inside a product formula.",
    },
  ],
);
