import { defineLedger } from "./types";

/** Every Math item of the nonadaptive Practice Test 6 form, labeled once.
 * SAT skills are classified against the Assessment Framework; the answer
 * explanations do not state them. */
export const satPractice6 = defineLedger(
  {
    id: "sat-practice-6",
    test: "SAT",
    form: "Practice Test 6",
    url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-6-digital.pdf",
    edition:
      "Nonadaptive linear form of the digital SAT; test PDF modified 2024-09-27, answer explanations modified 2025-05-23",
    retrievedAt: "2026-10-26",
    sha256: "8875ed0d09ae88a42aa7464897c10adc1ac5a1d90eb3f72c59de7d9926860cb4",
    supplements: [
      {
        role: "answer explanations",
        url: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-6-answers-digital.pdf",
        sha256:
          "23d75907303981196f06d0abb22f46388271d4f163cd84fa54898e10855c7806",
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
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.solve"],
      demand:
        "Solve a one-variable linear equation with a grouped sum and unit coefficient whose solution is negative",
      status: "covered",
      templateIds: ["two-step-equation"],
      limitations:
        "Samples solve px+q=r and p(x+q)=r with signed integer results; item is a simpler case and its choices are plain numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "2", page: "printed p.33; PDF p.35" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["bivariate.nonlinear-fit"],
      demand:
        "Choose the graph whose drawn model best fits a curved, increasing scatterplot",
      status: "partial",
      templateIds: ["nonlinear-data-model"],
      limitations:
        "Template lists the data as ordered pairs and the candidate models as equations compared by squared residuals; item compares model curves drawn over a scatterplot and judges by trend shape and points on both sides.",
    },
    {
      section: "Math module 1",
      item: { number: "3", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand: "Isolate a squared variable and take the positive square root",
      status: "covered",
      templateIds: [
        "sat-entry-quadratic-solution",
        "solve-square-cube-equation",
      ],
      limitations:
        "Samples ask for the positive solution of a quadratic and solve x^2 = c with both roots; choices are plain numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "4", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.context"],
      demand:
        "Write the compound inequality for a quantity bounded below and above in a context",
      status: "partial",
      templateIds: ["inequality-from-context", "absolute-compound-inequality"],
      limitations:
        "inequality-from-context only writes one-sided x>c/x<=c conditions; absolute-compound-inequality handles compound sets but without a context to translate. No template translates a 'between a and b' context into a <= x <= b.",
    },
    {
      section: "Math module 1",
      item: { number: "5", page: "printed p.34; PDF p.36" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["function.graph-context"],
      demand:
        "Identify an input interval on which a projectile-height graph is increasing throughout",
      status: "covered",
      templateIds: ["story-graph-match"],
      limitations:
        "Sample asks on which part of a height-over-time graph the height increases; item names the parts by x-intervals on a scaled curve instead of labeled points.",
    },
    {
      section: "Math module 1",
      item: { number: "6", page: "printed p.34; PDF p.36" },
      responseFormat: "numeric",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.units"],
      demand:
        "Convert a length to a larger customary unit using a stated conversion factor",
      status: "covered",
      templateIds: ["unit-chain-conversion"],
      limitations:
        "Template multiplies/divides through stated factors (often several, mostly metric); a single stated customary factor is a sub-case; numeric entry.",
    },
    {
      section: "Math module 1",
      item: { number: "7", page: "printed p.35; PDF p.37" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Find the input of a fee-plus-rate linear cost function that gives a stated total",
      status: "covered",
      templateIds: [
        "sat-entry-fn-linear-notation",
        "two-step-word-problem",
        "linear-model-value",
      ],
      limitations:
        "input-contextual states C(h) = fee + rate*h and asks for the input giving a stated total, with numeric entry.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 1",
      item: { number: "8", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Find the constant term of a linear function from its value at input zero",
      status: "covered",
      templateIds: ["sat-entry-fn-linear-notation", "recover-linear-intercept"],
      limitations:
        "constant-term asks for the constant of f(x) = mx + c from a stated output, including the input 0, in function notation. Choices are plain numbers, so exact numeric entry practices the same answer.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 1",
      item: { number: "9", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["function.value-meaning"],
      demand:
        "Interpret the value of an exponential population model at time zero",
      status: "partial",
      templateIds: ["structure-meaning"],
      limitations:
        "structure-meaning interprets the leading coefficient of an exponential model as the starting amount; no template interprets a function-notation statement P(0) = b in context.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 1",
      item: { number: "10", page: "printed p.35; PDF p.37" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.context"],
      demand:
        "Solve a decreasing-supply linear model for the time at which a target amount remains",
      status: "covered",
      templateIds: ["two-step-word-problem", "two-step-equation-model"],
      limitations:
        "Samples include a draining tank (start minus rate times time = target) to model and solve; choices are plain numbers.",
    },
    {
      section: "Math module 1",
      item: { number: "11", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-inequalities"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Choose the table whose every ordered pair satisfies a two-variable linear inequality",
      status: "partial",
      templateIds: ["inequality-solution-point"],
      limitations:
        "Template tests single points against an inequality with the boundary graphed; item tests three pairs per table with no graph.",
    },
    {
      section: "Math module 1",
      item: { number: "12", page: "printed p.36; PDF p.38" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Expand the square of a binomial in x^2 plus a difference-of-squares product and combine like terms",
      status: "covered",
      templateIds: ["polynomial-multiplication", "polynomial-identity-use"],
      limitations:
        "Templates expand polynomial products and use the (a+b)^2 and a^2-b^2 identities with expression choices; adding the two expansions is a routine extra combine step.",
    },
    {
      section: "Math module 1",
      item: { number: "13", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.input-output"],
      demand:
        "Evaluate a rational function at an integer input to get a fractional value",
      status: "partial",
      templateIds: ["function-evaluation", "rational-function-representation"],
      limitations:
        "function-evaluation only evaluates quadratics with integer outputs; rational-function-representation is single-choice (table matching, solving for an input), so it cannot take a numeric entry.",
    },
    {
      section: "Math module 1",
      item: { number: "14", page: "printed p.36; PDF p.38" },
      responseFormat: "numeric",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.area"],
      demand:
        "Find a right triangle's area from its two labeled legs, with a non-integer result",
      status: "covered",
      templateIds: ["triangle-area-base-height"],
      limitations:
        "Same figure-based base-height task; samples give whole-number areas, item's half-integer area is a minor variation entered as a fraction or decimal.",
    },
    {
      section: "Math module 1",
      item: { number: "15", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.graph-context"],
      demand: "Read the modeled value at input zero from a context line graph",
      status: "partial",
      templateIds: ["coordinate-point-reading"],
      limitations:
        "Template reads a coordinate of a labeled point on a bare grid; item requires locating the y-intercept of a context graph and mapping input 0 to the stated start time.",
    },
    {
      section: "Math module 1",
      item: { number: "16", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Write a linear equation from a constant rate and one point that is not the intercept",
      status: "covered",
      templateIds: [
        "sat-fn-line-equation-choice",
        "recover-linear-intercept",
        "linear-model-equation",
      ],
      limitations:
        "rate-point gives a constant rate in a context and the value after several units and asks for the equation by choice, with start-level and sign distractors.",
    },
    {
      section: "Math module 1",
      item: { number: "17", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["linear.literal"],
      demand:
        "Solve a product-of-difference formula for a variable inside the grouping",
      status: "covered",
      templateIds: ["formula-isolate"],
      limitations:
        "Sample solves y - k = m(x - h) for x by dividing then shifting, with expression choices; same structure here with the target variable subtracted.",
    },
    {
      section: "Math module 1",
      item: { number: "18", page: "printed p.37; PDF p.39" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Solve a monic quadratic with irrational roots by completing the square and pick one root",
      status: "covered",
      templateIds: [
        "solve-by-completing-square",
        "quadratic-irrational-solutions",
      ],
      limitations:
        "Templates give exact radical solution sets as choices; item lists single roots, an easier recognition.",
    },
    {
      section: "Math module 1",
      item: { number: "19", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.grouped-bounds"],
      demand:
        "Locate the interval containing the median from a grouped frequency table and choose a possible value",
      status: "partial",
      templateIds: ["frequency-table-center"],
      limitations:
        "Template finds medians from frequency tables of exact values; no template bins data into ranges and asks which value the median could be.",
    },
    {
      section: "Math module 1",
      item: { number: "20", page: "printed p.38; PDF p.40" },
      responseFormat: "numeric",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["function.intercepts"],
      demand:
        "Find the y-intercept of a two-variable linear equation with fractional coefficients",
      status: "partial",
      templateIds: ["rational-coefficient-equation"],
      limitations:
        "Only the sub-step of solving a fractional-coefficient equation is practiced; no template asks for an intercept of an equation not in slope-intercept form.",
    },
    {
      section: "Math module 1",
      item: { number: "21", page: "printed p.38; PDF p.40" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.quadratic-from-data"],
      demand:
        "Use two marked points on a parabola with known leading coefficient to find the other coefficients and their product",
      status: "partial",
      templateIds: ["quadratic-from-data"],
      limitations:
        "Template is single-choice (choose the equation through given points); item is numeric and reads the points from a graph.",
    },
    {
      section: "Math module 1",
      item: { number: "22", page: "printed p.38; PDF p.40" },
      responseFormat: "choice",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.successive"],
      demand:
        "Find the overall multiplier from two successive percent increases",
      status: "partial",
      templateIds: ["successive-percent-change"],
      limitations:
        "Template applies two changes to a dollar price and asks the final price; item asks for the combined growth factor itself.",
    },
    {
      section: "Math module 1",
      item: { number: "23", page: "printed p.39; PDF p.41" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.coordinate"],
      demand:
        "Write the equation of a graphed circle after translating it and scaling its radius",
      status: "partial",
      templateIds: ["circle-equation", "circle-dilation-scaling"],
      limitations:
        "circle-equation is numeric (center coordinate, radius, r^2) and cannot choose an equation; circle-dilation-scaling chooses scale factors or transformation sequences, never the image circle's equation.",
    },
    {
      section: "Math module 1",
      item: { number: "24", page: "printed p.39; PDF p.41" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.trig-ratio", "triangle.special"],
      demand:
        "Find the tangent of an acute angle in a 30-60-90 right triangle given the hypotenuse",
      status: "partial",
      templateIds: ["trig-ratio", "special-right-triangle"],
      limitations:
        "trig-ratio uses rational side triples and numeric fraction entry; special-right-triangle finds sides only. No exact radical trig value (sqrt 3) and both are numeric while the item's choices are radicals.",
    },
    {
      section: "Math module 1",
      item: { number: "25", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the exponential model for an increase of more than 100% per period from a starting amount",
      status: "covered",
      templateIds: ["sat-fn-exponential-choice", "exponential-model-rule"],
      limitations:
        "percent-over-100 converts a percent increase above 100% into the factor 1 + p/100 and offers the p/100 and percent-as-whole-number traps.",
    },
    {
      section: "Math module 1",
      item: { number: "26", page: "printed p.40; PDF p.42" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.rule"],
      demand:
        "Recover a linear function's y-intercept from a table of a quotient function built from it",
      status: "partial",
      templateIds: ["unequal-step-rate", "recover-linear-intercept"],
      limitations:
        "Templates find a rate and intercept from given linear points; item first must undo g(x) = f(x)/(x+3) to get points of f, and answers as a point choice.",
    },
    {
      section: "Math module 1",
      item: { number: "27", page: "printed p.40; PDF p.42" },
      responseFormat: "numeric",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["triangle.relationships"],
      demand:
        "Use a segment parallel to one side and a given part ratio to find a side of the smaller similar triangle",
      status: "covered",
      templateIds: ["similar-triangle-side"],
      limitations:
        "Samples include DE parallel to BC with given part lengths and numeric entry; item gives the ratio of the parts instead of lengths.",
    },
    {
      section: "Math module 2",
      item: { number: "1", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.input-output"],
      demand:
        "Find the input of a proportional linear function that gives a stated output",
      status: "covered",
      templateIds: ["sat-entry-fn-linear-notation", "dependent-variable-value"],
      limitations:
        "input-proportional solves f(x) = kx = v in function notation, with integer and fractional k. Choices are plain numbers, so exact numeric entry practices the same answer.",
      labeledBy: "agent:sat-first-pass+review",
    },
    {
      section: "Math module 2",
      item: { number: "2", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.geo.lines-angles-triangles"],
      archetypeIds: ["angle.relationships"],
      demand: "Use equal vertical angles to find an angle measure",
      status: "covered",
      templateIds: ["angle-pair-measure"],
      limitations:
        "Samples include vertical angles at crossing lines; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "3", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.psda.probability"],
      archetypeIds: ["probability.direct"],
      demand:
        "Find a single-draw probability from counts of equally likely objects",
      status: "covered",
      templateIds: ["simple-probability"],
      limitations:
        "Same count/total task with fraction entry; choices are plain fractions.",
    },
    {
      section: "Math module 2",
      item: { number: "4", page: "printed p.44; PDF p.46" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["bivariate.growth"],
      demand:
        "Classify a graphed function as increasing or decreasing and linear or exponential",
      status: "partial",
      templateIds: ["linear-or-exponential"],
      limitations:
        "Template classifies linear vs exponential from tables or stories only, and never asks increasing vs decreasing or reads a graph.",
    },
    {
      section: "Math module 2",
      item: { number: "5", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["function.intercepts"],
      demand: "Read the y-intercept of a function's graph",
      status: "partial",
      templateIds: ["coordinate-point-reading"],
      limitations:
        "Template reads one coordinate of a labeled point; item locates the unlabeled axis crossing and chooses an ordered pair.",
    },
    {
      section: "Math module 2",
      item: { number: "6", page: "printed p.45; PDF p.47" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.solve"],
      demand: "Solve a linear system where one equation fixes x, entering y",
      status: "covered",
      templateIds: ["sat-entry-system-solve"],
      limitations:
        "Same solve-and-enter task; the vertical-line equation is a simpler substitution case.",
    },
    {
      section: "Math module 2",
      item: { number: "7", page: "printed p.45; PDF p.47" },
      responseFormat: "numeric",
      standards: ["sat.psda.percentages"],
      archetypeIds: ["percent.of"],
      demand: "Find a percent of a whole-number amount in context",
      status: "covered",
      templateIds: ["percent-of"],
      limitations:
        "Same task with numeric entry; template is bare, item adds a light context.",
    },
    {
      section: "Math module 2",
      item: { number: "8", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.factor"],
      demand:
        "Factor the greatest common monomial power out of a cubic-and-higher trinomial",
      status: "covered",
      templateIds: ["greatest-monomial-factor"],
      limitations:
        "Samples include x^2 and x factors of cubic trinomials with expression choices.",
    },
    {
      section: "Math module 2",
      item: { number: "9", page: "printed p.45; PDF p.47" },
      responseFormat: "choice",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.proportion"],
      demand: "Use a part-to-part length ratio to find the smaller length",
      status: "covered",
      templateIds: ["ratio-missing"],
      limitations: "Same scale-a-ratio task; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "10", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-one-variable"],
      archetypeIds: ["linear.structure"],
      demand:
        "Identify an equation with the same solution by dividing both sides of a grouped equation by its factor",
      status: "partial",
      templateIds: ["equation-step-property"],
      limitations:
        "Template names the property behind a step or finds a broken step; it does not ask which transformed equation is equivalent.",
    },
    {
      section: "Math module 2",
      item: { number: "11", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-functions"],
      archetypeIds: ["linear.meaning"],
      demand:
        "Interpret the constant term of a linear growth function in context",
      status: "covered",
      templateIds: [
        "linear-initial-value-meaning",
        "interpret-linear-parameters",
      ],
      limitations:
        "Samples interpret the constant of a stated linear model as the amount at input zero, with rate distractors.",
    },
    {
      section: "Math module 2",
      item: { number: "12", page: "printed p.46; PDF p.48" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.polynomial-zeros"],
      demand:
        "Find the positive solution of a cubic given as a product of linear factors",
      status: "covered",
      templateIds: ["sat-entry-polynomial-zeros", "zeros-from-factors"],
      limitations:
        "Samples ask for the positive zero of a factored cubic; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "13", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.psda.ratios-rates-units"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Take a fraction of a periodic amount and scale it over several periods",
      status: "partial",
      templateIds: ["fraction-of-quantity", "unit-price"],
      limitations:
        "Each template covers one step (fraction of a small whole amount; constant rate times count); none chains them with multi-digit amounts.",
    },
    {
      section: "Math module 2",
      item: { number: "14", page: "printed p.46; PDF p.48" },
      responseFormat: "numeric",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["quadratic.context"],
      demand:
        "Model a rectangle's area with a length given in terms of width and solve the quadratic for the positive width",
      status: "partial",
      templateIds: ["quadratic-context-model", "sat-entry-quadratic-solution"],
      limitations:
        "quadratic-context-model has this exact area set-up but is single-choice; sat-entry-quadratic-solution is numeric but bare. No numeric template asks the learner to build the area model.",
    },
    {
      section: "Math module 2",
      item: { number: "15", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.psda.one-variable-data"],
      archetypeIds: ["univariate.center"],
      demand: "Find the median of an unordered even-size data list",
      status: "covered",
      templateIds: ["median-data"],
      limitations:
        "Samples include even-size lists with equal middle values; choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "16", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.geo.area-volume"],
      archetypeIds: ["measure.volume"],
      demand: "Find a cylinder's height from its volume and base area",
      status: "covered",
      templateIds: ["cylinder-volume"],
      limitations:
        "Template finds height from volume and radius; item gives the base area directly, a strict sub-case. Choices are plain numbers.",
    },
    {
      section: "Math module 2",
      item: { number: "17", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-equations-systems"],
      archetypeIds: ["nonlinear.root-count"],
      demand:
        "Count real solutions of a squared variable equal to a negative number",
      status: "covered",
      templateIds: ["quadratic-real-solution-count"],
      limitations:
        "Template asks how many distinct real solutions; the item's choices are counts the learner would produce.",
    },
    {
      section: "Math module 2",
      item: { number: "18", page: "printed p.47; PDF p.49" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["line.parallel-perpendicular"],
      demand:
        "Find the slope of a line perpendicular to a line given in slope-intercept form",
      status: "partial",
      templateIds: ["perpendicular-slopes"],
      limitations:
        "Template defines the given line by two plotted points; reading the slope from a y = mx + b equation is never practiced there.",
    },
    {
      section: "Math module 2",
      item: { number: "19", page: "printed p.48; PDF p.50" },
      responseFormat: "choice",
      standards: ["sat.alg.linear-equations-two-variables"],
      archetypeIds: ["function.rule"],
      demand:
        "Write a linear relationship from a table with unequal input steps and choose it in standard form",
      status: "partial",
      templateIds: ["linear-model-equation", "unequal-step-rate"],
      limitations:
        "linear-model-equation answers in slope-intercept form with simple tables; unequal-step-rate gives the rate numerically. No template asks for an equivalent standard-form equation.",
    },
    {
      section: "Math module 2",
      item: { number: "20", page: "printed p.48; PDF p.50" },
      responseFormat: "numeric",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["expression.radical"],
      demand:
        "Rewrite a root of a power as a rational exponent and equate exponents of a common base",
      status: "partial",
      templateIds: ["symbolic-rational-exponent", "same-base-equation"],
      limitations:
        "symbolic-rational-exponent is single-choice recognition; same-base-equation uses integer powers only, with no radical side.",
    },
    {
      section: "Math module 2",
      item: { number: "21", page: "printed p.48; PDF p.50" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.expression"],
      demand:
        "Add two equations in grouped expressions to find a multiple of one group",
      status: "covered",
      templateIds: ["sat-entry-system-expression"],
      limitations:
        "Same combine-equations-for-an-expression task with numeric entry; item's variables appear as shifted groups.",
    },
    {
      section: "Math module 2",
      item: { number: "22", page: "printed p.49; PDF p.51" },
      responseFormat: "choice",
      standards: ["sat.geo.right-triangles-trigonometry"],
      archetypeIds: ["triangle.pythagorean"],
      demand: "Find a hypotenuse when both legs share a common radical factor",
      status: "partial",
      templateIds: ["right-triangle"],
      limitations:
        "Template uses scaled integer triples with whole-number entry; item's legs carry a radical factor and choices are radical expressions.",
    },
    {
      section: "Math module 2",
      item: { number: "23", page: "printed p.49; PDF p.51" },
      responseFormat: "choice",
      standards: ["sat.adv.equivalent-expressions"],
      archetypeIds: ["exponential.form"],
      demand:
        "Rewrite an exponential with a fractional time exponent as a per-unit factor and read the percent rate",
      status: "partial",
      templateIds: ["exponential-time-scale"],
      limitations:
        "Template chooses the equivalent model form symbolically; item requires computing the per-unit factor numerically and converting it to a percent rate.",
    },
    {
      section: "Math module 2",
      item: { number: "24", page: "printed p.49; PDF p.51" },
      responseFormat: "choice",
      standards: ["sat.adv.nonlinear-functions"],
      archetypeIds: ["nonlinear.parameter-conditions"],
      demand:
        "Deduce the sign of a coefficient and the shift constant of a square-root function from an intercept and an output sign",
      status: "missing",
      templateIds: [],
      limitations:
        "No template reasons about unknown constants of a radical function from a point and an inequality on outputs.",
    },
    {
      section: "Math module 2",
      item: { number: "25", page: "printed p.49; PDF p.51" },
      responseFormat: "choice",
      standards: ["sat.geo.circles"],
      archetypeIds: ["circle.parts", "coordinate.distance-midpoint"],
      demand:
        "Use the distance formula for a radius, then a right central angle, to find a chord length",
      status: "partial",
      templateIds: ["coordinate-distance-exact"],
      limitations:
        "Template finds exact distances between numeric points; item uses symbolic center coordinates and then the right isosceles triangle formed by two radii.",
    },
    {
      section: "Math module 2",
      item: { number: "26", page: "printed p.50; PDF p.52" },
      responseFormat: "choice",
      standards: ["sat.psda.two-variable-data"],
      archetypeIds: ["bivariate.linear-fit"],
      demand:
        "Predict the line of best fit after every y-value is multiplied by a constant",
      status: "missing",
      templateIds: [],
      limitations:
        "No template transforms data and asks how the fitted line's slope and intercept change; reading a fit line's intercept and slope alone is not the task.",
    },
    {
      section: "Math module 2",
      item: { number: "27", page: "printed p.50; PDF p.52" },
      responseFormat: "numeric",
      standards: ["sat.alg.systems-linear-equations"],
      archetypeIds: ["system.classify"],
      demand:
        "Find the parameter that makes a linear system with fractional coefficients have no solution",
      status: "covered",
      templateIds: ["parameter-solution-count"],
      limitations:
        "Samples find k for no solution in a system; item needs the equations rearranged to standard form first.",
    },
  ],
);
