import { defineLedger } from "./types";

/** Every Math item of the nonadaptive Practice Test 9 form, labeled once.
 * SAT skills are classified against the Assessment Framework; the answer
 * explanations do not state them. */
export const satPractice9 = defineLedger(
  {
    id: "sat-practice-9",
    test: "SAT",
    form: "Practice Test 9",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-9-digital.pdf",
    edition:
      "Nonadaptive linear form of the digital SAT; test PDF modified 2025-02-12, answer explanations modified 2024-12-04",
    retrievedAt: "2026-10-26",
    sha256: "ff929c946ebfa8d8d7f199e52e1eb12d7cf7d68256b894846725df0da87a6d69",
    supplements: [
      {
        role: "answer explanations",
        url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-9-answers-digital.pdf",
        sha256:
          "5c06af4bd2379763fbaabdae16f9cd03e14cabc7ee041131ba6b2837f5bf4696",
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
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.area"],
      demand:
        "Find a missing side of a triangle from its perimeter and the other two sides",
      status: "partial",
      templateIds: ["rectangle-missing-border-side"],
      limitations:
        "rectangle-missing-border-side recovers a side from a perimeter only for rectangles (elementary band); no template gives a triangle perimeter.",
    },
    {
      section: "Math module 1",
      item: { number: "2", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.solve"],
      demand:
        "Choose the equation produced by one inverse-operation step of a two-step linear equation",
      status: "partial",
      templateIds: ["two-step-equation", "equation-step-property"],
      limitations:
        "two-step-equation is numeric (solves fully); equation-step-property names the property for a step. No template asks to choose the equivalent intermediate equation.",
    },
    {
      section: "Math module 1",
      item: { number: "3", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.context"],
      demand:
        "Find the least whole time meeting a rate-times-time minimum goal",
      status: "covered",
      templateIds: ["linear-model-value"],
      limitations:
        "Samples include budget/limit contexts asking for a greatest or least whole number from a linear inequality; choices are plain numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "4", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.input-output"],
      demand:
        "Find an input of a shifted squaring function that gives a stated output",
      status: "partial",
      templateIds: ["solve-square-cube-equation"],
      limitations:
        "solve-square-cube-equation solves bare x² = c; the item needs function notation and removing a constant first, then picking the listed root.",
    },
    {
      section: "Math module 1",
      item: { number: "5", page: "printed p.32; PDF p.34" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.factor"],
      demand:
        "Factor the greatest common monomial factor out of a two-term quadratic expression",
      status: "covered",
      templateIds: ["greatest-monomial-factor"],
      limitations:
        "Samples factor a GCF including a variable from a quadratic binomial, with distractors that mis-scale terms.",
    },
    {
      section: "Math module 1",
      item: { number: "6", page: "printed p.32; PDF p.34" },
      responseFormat: "numeric",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.center"],
      demand: "Compute the mean of a short list of whole-number measurements",
      status: "covered",
      templateIds: ["mean-data"],
      limitations:
        "Samples compute an exact mean of a listed data set with numeric entry; the item's list is longer (ten values) but the task is identical.",
    },
    {
      section: "Math module 1",
      item: { number: "7", page: "printed p.33; PDF p.35" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Find the input of a linear profit function that yields a target output",
      status: "covered",
      templateIds: ["sat-fn-linear-notation", "linear-model-value"],
      limitations:
        "input-contextual includes a profit function P(n) = mn - f and asks for the input giving a positive target profit, with numeric entry.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 1",
      item: { number: "8", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.constraint"],
      demand:
        "Choose the two-variable equation for total distance from two speeds and two unknown times",
      status: "covered",
      templateIds: ["sat-fn-constraint-choice", "system-model-value"],
      limitations:
        "distance chooses ax + by = D for two speeds and two times, with the reciprocal-rate distractor x/a + y/b = D.",
    },
    {
      section: "Math module 1",
      item: { number: "9", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.context"],
      demand:
        "Choose the equation for a total paid as a down payment plus equal monthly payments",
      status: "covered",
      templateIds: ["two-step-equation-model"],
      limitations:
        "Samples choose px + q = r for fixed-amount-plus-rate stories, with rate/fixed swaps and sign distractors.",
    },
    {
      section: "Math module 1",
      item: { number: "10", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["linear.literal"],
      demand:
        "Rearrange a linear relation to express one variable in terms of the others",
      status: "covered",
      templateIds: ["formula-isolate"],
      limitations:
        "Samples include isolating a term in y = mx + b style formulas with symbolic choices.",
    },
    {
      section: "Math module 1",
      item: { number: "11", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the exponential growth equation from an initial value and the value after many periods",
      status: "covered",
      templateIds: ["sat-fn-exponential-choice", "exponential-model-rule"],
      limitations:
        "factor-from-later-value finds the daily factor from the start and a value several days later by a root and offers a decay base and the total-change base as distractors.",
    },
    {
      section: "Math module 1",
      item: { number: "12", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.arc-sector"],
      demand:
        "Find an arc length when two diameters split a circle into arcs in a given ratio, using vertical-angle arc equality",
      status: "partial",
      templateIds: ["arc-length-coefficient"],
      limitations:
        "arc-length-coefficient gives the central angle in degrees and is numeric; the item derives arc lengths from an arc ratio and vertical-angle congruence, with π-multiple choices.",
    },
    {
      section: "Math module 1",
      item: { number: "13", page: "printed p.34; PDF p.36" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand:
        "Solve a linear system with one equation already solved for y and enter x",
      status: "covered",
      templateIds: ["sat-entry-system-solve"],
      limitations:
        "Samples solve 2×2 linear systems and enter one variable; substitution form is a simpler case.",
    },
    {
      section: "Math module 1",
      item: { number: "14", page: "printed p.34; PDF p.36" },
      responseFormat: "numeric",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.displays"],
      demand:
        "Read the maximum value of a data set from a frequency table that includes a zero-frequency row",
      status: "partial",
      templateIds: ["frequency-table-center"],
      limitations:
        "frequency-table-center reads frequency tables only for mean and median (choice); no template asks for an extreme value or traps a zero frequency, and none takes numeric entry from a frequency table.",
    },
    {
      section: "Math module 1",
      item: { number: "15", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.pythagorean"],
      demand:
        "Find a missing leg of a right triangle from the hypotenuse and one leg given as decimals",
      status: "partial",
      templateIds: ["right-triangle-missing-leg"],
      limitations:
        "right-triangle-missing-leg is the same task but only with integer triples; the item uses decimal side lengths.",
    },
    {
      section: "Math module 1",
      item: { number: "16", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.context"],
      demand:
        "Solve a two-unknown context where a total is split and one part is a multiple of the other plus a constant",
      status: "covered",
      templateIds: ["system-model-value"],
      limitations:
        "Samples write two equations for two unknown amounts from a total and a second relation and solve for the one asked; choices are plain numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "17", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.transform"],
      demand:
        "Choose the table of values for a factored cubic shifted down, evaluated at its zeros",
      status: "partial",
      templateIds: ["transform-point", "zeros-from-factors"],
      limitations:
        "transform-point follows one point through a shift (numeric); zeros-from-factors reads zeros. No template asks to choose a table for a shifted polynomial.",
    },
    {
      section: "Math module 1",
      item: { number: "18", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Scale a rate given with symbolic amount and symbolic time to a new symbolic time",
      status: "partial",
      templateIds: ["ratio-missing", "variation-constant"],
      limitations:
        "ratio-missing is numeric with numeric quantities; variation-constant chooses numeric models. The item keeps both quantities symbolic and chooses an algebraic expression.",
    },
    {
      section: "Math module 1",
      item: { number: "19", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.classify"],
      demand:
        "Find the parameter that makes a linear system with variables on both sides have no solution",
      status: "covered",
      templateIds: ["parameter-solution-count"],
      limitations:
        "Samples include finding k so a 2×2 system has no solution; choices are plain numbers so numeric entry fits. Item first collects y-terms, a small extra rearrangement.",
    },
    {
      section: "Math module 1",
      item: { number: "20", page: "printed p.35; PDF p.37" },
      responseFormat: "numeric",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.of"],
      demand: "Find what percent one quantity is of another",
      status: "partial",
      templateIds: ["percent-of"],
      limitations:
        "percent-of only asks for p% of a quantity; no template solves for the percent itself.",
    },
    {
      section: "Math module 1",
      item: { number: "21", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Expand a squared binomial set equal to a linear expression, solve the quadratic and enter the smaller solution",
      status: "partial",
      templateIds: ["sat-entry-quadratic-solution"],
      limitations:
        "sat-entry-quadratic-solution solves standard-form quadratics and enters the greater, positive or only solution; the item needs expansion and rearrangement first and asks for the smaller (negative) solution.",
    },
    {
      section: "Math module 1",
      item: { number: "22", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.transform", "nonlinear.polynomial-zeros"],
      demand:
        "Find the sum of the x-intercepts of a horizontally shifted factored cubic",
      status: "partial",
      templateIds: ["zeros-from-factors", "transform-point"],
      limitations:
        "Templates read zeros from factors or move one point under a transformation separately; no template shifts a factored polynomial horizontally and works with all its zeros.",
    },
    {
      section: "Math module 1",
      item: { number: "23", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["bivariate.growth"],
      demand:
        "Classify a function defined as a fixed percent of its input as linear or exponential and increasing or decreasing",
      status: "partial",
      templateIds: ["linear-or-exponential"],
      limitations:
        "linear-or-exponential decides linear vs exponential from tables or stories without direction; it does not use a percent-of-input rule whose percent exceeds 100% as a trap.",
    },
    {
      section: "Math module 1",
      item: { number: "24", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.transform", "nonlinear.features"],
      demand:
        "Find where a horizontally shifted standard-form quadratic reaches its minimum",
      status: "partial",
      templateIds: ["parabola-vertex", "transform-point"],
      limitations:
        "parabola-vertex finds the vertex of a given quadratic and transform-point moves one point; no template finds the extremum of f(x + c) from f in standard form.",
    },
    {
      section: "Math module 1",
      item: { number: "25", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Choose the equation for paint needed to cover an area twice at a given coverage rate",
      status: "partial",
      templateIds: ["variation-constant"],
      limitations:
        "variation-constant chooses direct-variation equations from a stated pair; the item builds the constant from a coverage rate and a doubling, with a symbolic area.",
    },
    {
      section: "Math module 1",
      item: { number: "26", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.psda.inference-margin-of-error"],
      archetypeIds: ["inference.estimate"],
      demand:
        "Scale two sample proportions from a random poll to a larger population and find the expected margin between them",
      status: "partial",
      templateIds: ["sample-proportion-estimate"],
      limitations:
        "sample-proportion-estimate scales one sample fraction to a population; the item also takes the difference between two category estimates.",
    },
    {
      section: "Math module 1",
      item: { number: "27", page: "printed p.37; PDF p.39" },
      responseFormat: "numeric",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.scale"],
      demand:
        "Use the surface-area ratio of similar prisms to find the length scale, then the other volume and the total volume",
      status: "partial",
      templateIds: ["similar-solid-volume"],
      limitations:
        "similar-solid-volume connects edge lengths and volumes via the cube; it never starts from a surface-area (squared) ratio or asks for a sum.",
    },
    {
      section: "Math module 2",
      item: { number: "1", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.solve"],
      demand: "Solve a one-step addition equation",
      status: "covered",
      templateIds: ["one-step-equation"],
      limitations: "Samples include x + p = q; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "2", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.polynomial"],
      demand: "Distribute a constant over a binomial",
      status: "covered",
      templateIds: ["distributive-expression-choice"],
      limitations:
        "Samples choose the expansion of k(x + c) with constant-term distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "3", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.psda.probability"],
      archetypeIds: ["probability.direct"],
      demand:
        "Find the probability of a category from row or column totals of a two-way table",
      status: "partial",
      templateIds: [
        "relative-frequency-percent",
        "conditional-probability-value",
      ],
      limitations:
        "relative-frequency-percent finds marginal relative frequencies but enters a percent; conditional-probability-value restricts to a condition. The item is an unconditional probability with fraction choices.",
    },
    {
      section: "Math module 2",
      item: { number: "4", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand:
        "Solve a linear system by adding the equations and select the second variable",
      status: "covered",
      templateIds: ["sat-entry-system-solve"],
      limitations:
        "Samples solve 2×2 systems for one variable; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "5", page: "printed p.41; PDF p.43" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Choose the slope-intercept equation of a line from a fractional slope and its y-intercept",
      status: "covered",
      templateIds: ["sat-fn-line-equation-choice", "graph-equation-choice"],
      limitations:
        "slope-intercept-point gives a fractional or negative slope and the y-intercept, as a point or a stated value, with sign and inverted-slope distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "6", page: "printed p.41; PDF p.43" },
      responseFormat: "numeric",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Find an angle using vertical angles and same-side interior angles at parallel lines",
      status: "covered",
      templateIds: ["parallel-lines-angle"],
      limitations:
        "Samples use equal and supplementary pairs at a parallel transversal with numeric entry.",
    },
    {
      section: "Math module 2",
      item: { number: "7", page: "printed p.41; PDF p.43" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand: "Evaluate a linear function at a fractional input",
      status: "covered",
      templateIds: ["sat-fn-linear-notation", "substitute-linear-expression"],
      limitations:
        "evaluate-fraction-input evaluates f(x) = mx + b at a fractional input whose denominator divides the coefficient, with denominators up to 8.",
    },
    {
      section: "Math module 2",
      item: { number: "8", page: "printed p.41; PDF p.43" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Choose the linear equation that fits a table with a decreasing constant rate",
      status: "covered",
      templateIds: ["linear-model-equation"],
      limitations:
        "Samples include tables/graphs of decreasing linear relations with rate/intercept swap distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "9", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.system"],
      demand:
        "Choose the ordered pair solving a system of a linear equation and a squared expression of it",
      status: "partial",
      templateIds: ["nonlinear-system-solve"],
      limitations:
        "nonlinear-system-solve is numeric (one coordinate of a line-parabola intersection); the item chooses an ordered pair and rewards substituting the shared expression.",
    },
    {
      section: "Math module 2",
      item: { number: "10", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.intercepts"],
      demand: "Find the x-intercept point of a linear function from its rule",
      status: "partial",
      templateIds: ["two-step-equation"],
      limitations:
        "two-step-equation practices solving the zero equation only; no template asks for an x-intercept as an ordered pair from a linear rule.",
    },
    {
      section: "Math module 2",
      item: { number: "11", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the exponential equation in initial-value-times-one-plus-rate form from a table with a small growth rate",
      status: "covered",
      templateIds: ["sat-fn-exponential-choice", "exponential-model-rule"],
      limitations:
        "small-rate-table gives f(0), f(1), f(2) with a small percent rate and offers the rate-as-base, decay and linear-growth distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "12", page: "printed p.42; PDF p.44" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["linear.meaning"],
      demand:
        "Interpret the rate in a linear draining model as the amount lost per unit time",
      status: "covered",
      templateIds: ["interpret-linear-parameters"],
      limitations:
        "Samples interpret a decreasing rate and initial value of a linear model in context.",
    },
    {
      section: "Math module 2",
      item: { number: "13", page: "printed p.43; PDF p.45" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand: "Find the constant of a linear function from its value at zero",
      status: "covered",
      templateIds: ["sat-fn-linear-notation", "recover-linear-intercept"],
      limitations:
        "constant-term includes the input 0 in function notation and asks for the constant.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 2",
      item: { number: "14", page: "printed p.43; PDF p.45" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand: "Solve a factorable monic quadratic and enter either solution",
      status: "covered",
      templateIds: ["sat-entry-quadratic-solution"],
      limitations:
        "Samples solve factorable quadratics with numeric entry of the positive solution, which is accepted for the item.",
    },
    {
      section: "Math module 2",
      item: { number: "15", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.trig-ratio", "triangle.relationships"],
      demand:
        "Use corresponding angles of similar right triangles to state an equal sine ratio",
      status: "partial",
      templateIds: ["trig-ratio"],
      limitations:
        "trig-ratio computes ratios from sides of one triangle; no template uses similarity to transfer a trigonometric ratio.",
    },
    {
      section: "Math module 2",
      item: { number: "16", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.change"],
      demand:
        "Express a percent increase as the multiplier relating new and old amounts",
      status: "partial",
      templateIds: ["percent-change-final"],
      limitations:
        "percent-change-final uses the multiplier internally to compute a value; no template asks for the multiplier itself with rate-only distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "17", page: "printed p.43; PDF p.45" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.spread"],
      demand:
        "Compare standard deviations of two dot plots with the same shape on shifted scales",
      status: "partial",
      templateIds: ["standard-deviation-compare"],
      limitations:
        "standard-deviation-compare practices translation invariance with listed values; the item presents dot plots.",
    },
    {
      section: "Math module 2",
      item: { number: "18", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["function.value-meaning"],
      demand:
        "Interpret a statement that a nonlinear model's output at a given input is approximately a value, in context",
      status: "missing",
      templateIds: [],
      limitations:
        "No template interprets a function-notation statement (input and output with units) in context; structure-meaning interprets coefficients only.",
    },
    {
      section: "Math module 2",
      item: { number: "19", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["triangle.relationships"],
      demand:
        "Use a similarity correspondence to state the measure of a corresponding angle despite a side scale factor",
      status: "partial",
      templateIds: ["similar-triangle-side"],
      limitations:
        "similar-triangle-side uses correspondence for side lengths only; no template asks for a corresponding angle or traps scaling the angle.",
    },
    {
      section: "Math module 2",
      item: { number: "20", page: "printed p.44; PDF p.46" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.form"],
      demand:
        "Find the doubling time of an exponential model whose exponent is time divided by a constant",
      status: "partial",
      templateIds: ["exponential-time-scale"],
      limitations:
        "exponential-time-scale interprets the same structure but is choice-only; the item requires numeric entry.",
    },
    {
      section: "Math module 2",
      item: { number: "21", page: "printed p.44; PDF p.46" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Find the base and vertical shift of a function of the form base-to-the-x plus a constant from its intercept and one point",
      status: "partial",
      templateIds: ["exponential-model-rule", "exponential-model-value"],
      limitations:
        "Templates choose a·b^x or compute later values; none solves for the parameters of b^x + c from two points with numeric entry.",
    },
    {
      section: "Math module 2",
      item: { number: "22", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Choose the table whose every point satisfies a two-variable linear inequality",
      status: "partial",
      templateIds: ["inequality-solution-point"],
      limitations:
        "inequality-solution-point tests single points against an inequality with a graph; the item tests rows of tables with no graph.",
    },
    {
      section: "Math module 2",
      item: { number: "23", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.units"],
      demand:
        "Convert an area from square miles to square yards using a linear conversion factor",
      status: "covered",
      templateIds: ["compound-unit-conversion"],
      limitations:
        "Samples convert squared/cubed units by squaring or cubing the length factor; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "24", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.parts", "triangle.special"],
      demand:
        "Find the side of a square inscribed in a circle from the circle's radical radius",
      status: "partial",
      templateIds: ["special-right-triangle"],
      limitations:
        "special-right-triangle covers the 45-45-90 step; no template links the circle diameter to the square's diagonal.",
    },
    {
      section: "Math module 2",
      item: { number: "25", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.rational"],
      demand:
        "Add two rational expressions in two variables after factoring a denominator to find the common denominator",
      status: "partial",
      templateIds: ["rational-expression-operation"],
      limitations:
        "rational-expression-operation combines one-variable fractions with simple linear denominators; the item has two variables and a factorable cubic-degree denominator.",
    },
    {
      section: "Math module 2",
      item: { number: "26", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.features"],
      demand:
        "Decide which equivalent forms of a scaled exponential sum show the graph's y-intercept as a constant or coefficient",
      status: "partial",
      templateIds: ["structure-meaning", "function-graph-features"],
      limitations:
        "structure-meaning reads the initial value from a·b^t only; function-graph-features reads intercepts but is not SAT-eligible. Neither checks equivalent rewritten forms with parameters.",
    },
    {
      section: "Math module 2",
      item: { number: "27", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.root-count"],
      demand:
        "Find the least integer leading coefficient that makes a quadratic equation have no real solutions",
      status: "partial",
      templateIds: [
        "quadratic-parameter-root",
        "quadratic-real-solution-count",
      ],
      limitations:
        "quadratic-parameter-root finds a coefficient for exactly one root (zero discriminant); quadratic-real-solution-count counts roots. Neither solves a discriminant inequality for a leading-coefficient parameter and takes the least integer.",
    },
  ],
);
