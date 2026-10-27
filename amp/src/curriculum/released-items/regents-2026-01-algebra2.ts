import { defineLedger } from "./types";

/** Every mathematics item of the January 2026 Algebra II Regents Examination
 * (Next Generation Learning Standards), labeled once. Standards are the
 * cluster codes stated in the rating guide's map to the learning standards. */
export const regentsAlgebra2January2026 = defineLedger(
  {
    id: "regents-2026-01-algebra2",
    test: "New York Regents Algebra II",
    form: "January 2026 administration",
    url: "https://www.nysedregents.org/algebratwo/126/algtwo-12026-exam.pdf",
    edition:
      "January 2026 Regents Examination in Algebra II, Next Generation Learning Standards form",
    retrievedAt: "2026-10-26",
    sha256: "a207c261c44d20adf6962b964b42a22793575c5e9ee4900efc4d6ba6afe68aed",
    supplements: [
      {
        role: "scoring key",
        url: "https://www.nysedregents.org/algebratwo/126/algtwo-12026-sk.pdf",
        sha256:
          "859835d0661e3c7c210f83ad78a1d9ae4973185cba1729b7753da01d4ff2ec43",
      },
      {
        role: "rating guide with map to the learning standards",
        url: "https://www.nysedregents.org/algebratwo/126/algtwo-12026-rg.pdf",
        sha256:
          "1cacfb112bc8872dc176352681754bf08337596529ebdd683a35a58b33d652c6",
      },
    ],
    complete: true,
  },
  {
    labeledBy: "agent:regents-first-pass",
    labeledAt: "2026-10-26",
    calculator: "permitted",
  },
  [
    {
      section: "Part I",
      item: {
        number: "1",
        page: "printed p.2; PDF p.2; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-LE.A"],
      archetypeIds: ["expression.exponent-rules"],
      demand:
        "Solve an exponential equation whose two sides are powers of different powers of 3",
      status: "partial",
      templateIds: ["same-base-equation"],
      limitations:
        "The family solves equations in which one side is a power of the base and the other a constant. Rewriting both 27 and 9 as powers of 3 and solving the resulting linear equation is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "2",
        page: "printed p.2; PDF p.2; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-SSE.A"],
      archetypeIds: ["expression.factor"],
      demand:
        "Factor a trinomial written in terms of a binomial treated as one quantity",
      status: "partial",
      templateIds: ["structure-rewrite"],
      limitations:
        "The family rewrites perfect squares and a difference of squares in a grouped quantity. Factoring a general trinomial in x minus 4 and expressing the result in x is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "3",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["S-IC.B"],
      archetypeIds: ["study.scope"],
      demand:
        "Decide whether a described study is an experiment or an observational study and give the reason",
      status: "partial",
      templateIds: ["study-design-choice"],
      limitations:
        "The family decides which conclusion a randomized design justifies or which study can show cause. Classifying a described study and choosing the sentence that gives its reason is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "4",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-IF.C"],
      archetypeIds: ["logarithm.graph"],
      demand: "Choose the graph of a logarithm with a base between 0 and 1",
      status: "partial",
      templateIds: ["function-graph-features"],
      limitations:
        "The family reads the domain, asymptote or intercept of a drawn logarithmic graph. Matching a rule whose base is one half with its graph from four graphs, where the curve falls instead of rising, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "5",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-TF.B"],
      archetypeIds: ["trig.sinusoid-model"],
      demand: "Choose the cosine equation of a tide read from its graph",
      status: "partial",
      templateIds: ["sinusoid-model"],
      limitations:
        "The family builds a function from a stated maximum, minimum and period. Reading the maximum, minimum and the 12 hour period from a plotted graph with a vertical shift is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "6",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["N-CN.C"],
      archetypeIds: ["complex.quadratic"],
      demand:
        "Solve a quadratic with nonreal solutions and a leading coefficient of 3",
      status: "partial",
      templateIds: ["complex-quadratic-solve"],
      limitations:
        "Sampled quadratics are monic or have even coefficients that simplify. A non-monic quadratic whose roots are fractions with an imaginary part under a radical is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "7",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-TF.A"],
      archetypeIds: ["circle.unit-trig"],
      demand:
        "Choose the trigonometric value equal to the sine of two thirds of pi",
      status: "partial",
      templateIds: ["trig-symmetry-value", "special-angle-exact-value"],
      limitations:
        "The families evaluate or relate values of one function. Matching a sine of 2 pi over 3 with a cosine or tangent of another special angle is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "8",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-BF.B"],
      archetypeIds: ["function.inverse"],
      demand:
        "Find a function from its inverse, a cube root of a linear expression",
      status: "partial",
      templateIds: ["inverse-expression"],
      limitations:
        "The family inverts quadratics with a restricted domain. Inverting a cube root and reading the original as a cube and a quotient is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "9",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["S-ID.A"],
      archetypeIds: ["distribution.normal"],
      demand:
        "Find the probability that a normally distributed height falls between two values",
      status: "missing",
      templateIds: [],
      limitations:
        "The normal-model family uses the 68-95-99.7 rule and comparison of z-scores. No family finds a probability between two arbitrary values of a normal distribution by calculator.",
    },
    {
      section: "Part I",
      item: {
        number: "10",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-REI.C"],
      archetypeIds: ["nonlinear.system"],
      demand:
        "Classify the solution of a circle and a vertical line as rational, irrational or imaginary",
      status: "partial",
      templateIds: ["nonlinear-system-solve"],
      limitations:
        "The family solves a line and a parabola. Substituting into a circle and classifying the number type of both coordinates is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "11",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-SSE.A"],
      archetypeIds: ["expression.factor"],
      demand:
        "Decide which factored forms equal a quartic binomial with a common factor",
      status: "partial",
      templateIds: ["polynomial-factoring-patterns"],
      limitations:
        "The family chooses a complete factorization of one quartic. Testing four candidate forms, including fractional factors, and selecting the true set is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "12",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-SSE.B"],
      archetypeIds: ["exponential.form"],
      demand:
        "Choose the expression that models monthly growth from an annual growth rate",
      status: "partial",
      templateIds: ["exponential-time-scale"],
      limitations:
        "The family rewrites between time scales with whole-number ratios of bases. A decimal annual factor rewritten with a monthly rate and an exponent of 12t is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "13",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-APR.B"],
      archetypeIds: ["expression.polynomial-division"],
      demand:
        "Choose the graph of a polynomial that leaves remainder zero when divided by x minus 4",
      status: "partial",
      templateIds: ["remainder-theorem"],
      limitations:
        "The family finds a remainder or a constant that makes a binomial a factor, by entry. Reading a zero at x = 4 from a graph is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "14",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["N-RN.A"],
      archetypeIds: ["expression.radical"],
      demand:
        "Rewrite a product and quotient of a cube root and powers of a as one power of a",
      status: "partial",
      templateIds: ["symbolic-rational-exponent", "rational-power"],
      limitations:
        "The families rewrite one radical as a rational exponent or evaluate a numeric power. Combining a root, a product of powers and a quotient into one fractional exponent is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "15",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-IF.B"],
      archetypeIds: ["nonlinear.representations"],
      demand:
        "Choose the polynomial rule that matches a sketch with a leading negative sign and a repeated zero",
      status: "partial",
      templateIds: ["zero-multiplicity", "polynomial-behavior-description"],
      limitations:
        "The families match a graph that touches or crosses with a cubic and describe end behavior. Reading the sign of a nonmonic factor, positive zeros and a negative leading coefficient from a sketch is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "16",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["S-CP.A"],
      archetypeIds: ["probability.conditional"],
      demand:
        "Find the probability of having a job given an average between 90 and 100 from a two-way table",
      status: "covered",
      templateIds: ["conditional-probability-value"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "17",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-APR.D"],
      archetypeIds: ["expression.rational", "expression.polynomial-division"],
      demand:
        "Choose the factored form equivalent to a cubic divided by a linear binomial",
      status: "partial",
      templateIds: ["rational-expression-simplify", "polynomial-quotient"],
      limitations:
        "The families cancel a common factor and divide by x minus a. Dividing a cubic by a binomial with a leading coefficient of 3 and choosing the factored quotient is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "18",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-REI.B"],
      archetypeIds: ["nonlinear.quadratic", "linear.step-justification"],
      demand:
        "Decide which first steps of completing the square on a quadratic equation are correct",
      status: "partial",
      templateIds: ["equation-step-property", "complete-square-monic"],
      limitations:
        "The families give reasons for linear steps and complete the square on an expression. Judging three different first steps, including an invalid zero-product step, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "19",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-BF.A"],
      archetypeIds: ["sequence.rule-forms", "sequence.recursive"],
      demand:
        "Choose the recursive rule for the value of an item that loses a percent of its value each year",
      status: "partial",
      templateIds: ["geometric-rule-forms", "series-recursion"],
      limitations:
        "The families translate between recursive and explicit forms of a geometric sequence. Converting a percent depreciation to a ratio of one minus the rate in a recursive rule is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "20",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GPE.A"],
      archetypeIds: ["conic.parabola"],
      demand:
        "Find a possible vertex of a parabola from its directrix and the distance of its focus",
      status: "partial",
      templateIds: ["parabola-focus-directrix"],
      limitations:
        "The family gives the focus and directrix as coordinates. A focus described only by its distance from the directrix, and a vertex halfway between them, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "21",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-REI.D"],
      archetypeIds: [
        "equation.graphical-solution",
        "nonlinear.rational-radical",
      ],
      demand:
        "Count the solutions of an equation that sets a rational expression equal to an absolute-value expression",
      status: "partial",
      templateIds: ["graphical-solution-table"],
      limitations:
        "The family brackets one solution from a table of a quadratic and a line. Graphing a rational function against an absolute-value function and counting their intersections is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "22",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-TF.C"],
      archetypeIds: ["trig.identity"],
      demand:
        "Find the cosine of an angle in the second quadrant from its tangent",
      status: "partial",
      templateIds: ["trig-identity-value"],
      limitations:
        "The family finds a tangent from a given cosine and a sign. Using the quadrant to give the sign of a cosine from a tangent of minus 6 is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "23",
        page: "printed p.11; PDF p.11; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-SSE.B"],
      archetypeIds: ["sequence.series-sum"],
      demand:
        "Find the total of six annual payments that grow by 8 percent a year",
      status: "partial",
      templateIds: ["geometric-series-sum"],
      limitations:
        "The family sums a series with a whole-number ratio. A decimal ratio of 1.08 read from a percent increase, with a total rounded to the nearest dollar, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "24",
        page: "printed p.11; PDF p.11; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-LE.B"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the true statement about an exponential model fit to three graphed points",
      status: "partial",
      templateIds: ["exponential-model-rule", "exponential-time-scale"],
      limitations:
        "The families build a rule from points and rewrite time scales. Testing the doubling time and the form of a model from decimal points is not practiced.",
    },
    {
      section: "Part II",
      item: {
        number: "25",
        page: "printed p.12; PDF p.12; standard map rating guide PDF p.13",
      },
      responseFormat: "numeric",
      standards: ["A-CED.A"],
      archetypeIds: ["exponential.context", "logarithm.solve"],
      demand:
        "Find the time for an exponential model of a crowd to reach a target to the nearest hundredth",
      status: "partial",
      templateIds: ["exponential-log-solution", "log-equation"],
      limitations:
        "The families give an exact solution of an exponential equation by choice and solve a logarithmic equation by entry. Solving 250 times 1.8 to the t equal to 2000 as a rounded decimal is not practiced.",
    },
    {
      section: "Part II",
      item: {
        number: "26",
        page: "printed p.13; PDF p.13; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["N-Q.A"],
      archetypeIds: ["trig.sinusoid-features", "function.value-meaning"],
      demand:
        "Evaluate a sinusoidal temperature model at a time and say what the value means",
      status: "partial",
      templateIds: ["sinusoid-parameters", "coordinate-context-points"],
      limitations:
        "The families read amplitude and midline and interpret points on a context graph. Evaluating a sine at 6 hours with a phase and explaining the temperature in words has no protocol.",
    },
    {
      section: "Part II",
      item: {
        number: "27",
        page: "printed p.14; PDF p.14; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["N-RN.A"],
      archetypeIds: ["expression.radical"],
      demand:
        "Use properties of exponents to show that a negative number raised to two thirds equals 16",
      status: "partial",
      templateIds: ["rational-power", "symbolic-rational-exponent"],
      limitations:
        "The families evaluate a rational power and rewrite a radical. Writing the justification step by step has no protocol.",
    },
    {
      section: "Part II",
      item: {
        number: "28",
        page: "printed p.15; PDF p.15; standard map rating guide PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["F-IF.C"],
      archetypeIds: ["exponential.graph", "exponential.graph-features"],
      demand:
        "Graph a shifted exponential function and state its horizontal asymptote",
      status: "partial",
      templateIds: ["function-graph-features"],
      limitations:
        "The family reads an intercept or an asymptote from a graph. Drawing the curve with a vertical shift and entering the asymptote have no protocol.",
    },
    {
      section: "Part II",
      item: {
        number: "29",
        page: "printed p.16; PDF p.16; standard map rating guide PDF p.13",
      },
      responseFormat: "numeric",
      standards: ["S-CP.B"],
      archetypeIds: ["probability.addition-rule"],
      demand:
        "Find the percent of students who speak either language from the two percents and the overlap",
      status: "covered",
      templateIds: ["addition-rule-probability"],
      limitations: "",
    },
    {
      section: "Part II",
      item: {
        number: "30",
        page: "printed p.17; PDF p.17; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["S-ID.B"],
      archetypeIds: ["bivariate.regression-compute", "bivariate.nonlinear-fit"],
      demand:
        "Write an exponential regression equation from a table with coefficients rounded to hundredths",
      status: "partial",
      templateIds: ["nonlinear-data-model"],
      limitations:
        "The family chooses the best model for data by residuals. Computing an exponential regression by calculator and writing the equation has no protocol.",
    },
    {
      section: "Part II",
      item: {
        number: "31",
        page: "printed p.18; PDF p.18; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-REI.A"],
      archetypeIds: ["nonlinear.rational-radical"],
      demand:
        "Solve a rational equation with a trinomial denominator and check the solutions",
      status: "partial",
      templateIds: ["rational-equation-check"],
      limitations:
        "The family solves with one denominator and checks for an extraneous value. A common denominator that factors as x(x + 4), two solutions and a written check are not practiced.",
    },
    {
      section: "Part II",
      item: {
        number: "32",
        page: "printed p.19; PDF p.19; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["N-CN.A"],
      archetypeIds: ["complex.arithmetic"],
      demand:
        "Simplify an expression with a product and a squared binomial of complex terms to a plus bi form",
      status: "partial",
      templateIds: ["complex-multiplication"],
      limitations:
        "The family multiplies two complex binomials by choice. Expanding a squared binomial with a variable, subtracting and entering the expression has no protocol.",
    },
    {
      section: "Part III",
      item: {
        number: "33",
        page: "printed p.20; PDF p.20; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["S-IC.B"],
      archetypeIds: ["inference.simulation", "distribution.normal"],
      demand:
        "Find the middle 95 percent of simulated proportions and decide whether fans' claim is supported",
      status: "partial",
      templateIds: ["simulation-consistency-check", "normal-model-rule"],
      limitations:
        "The families judge a result against a simulated chart and use the empirical rule. Computing the interval as two standard deviations of a stated mean and standard deviation and writing the argument has no protocol.",
    },
    {
      section: "Part III",
      item: {
        number: "34",
        page: "printed p.21; PDF p.21; standard map rating guide PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["A-REI.D"],
      archetypeIds: [
        "exponential.context",
        "equation.graphical-solution",
        "graph.draw-nonlinear",
      ],
      demand:
        "Write an exponential decay function, graph it and read where it meets another graphed drug amount",
      status: "partial",
      templateIds: ["exponential-model-rule", "graphical-solution-table"],
      limitations:
        "The families build an exponential rule and bracket a solution from a table. Drawing an exponential decay curve with base e and reading its intersection with a sketch has no protocol.",
    },
    {
      section: "Part III",
      item: {
        number: "35",
        page: "printed p.22; PDF p.22; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["F-IF.B"],
      archetypeIds: ["trig.sinusoid-features", "function.average-rate-change"],
      demand:
        "State the maximum and period of a cosine model and find its average rate of change on an interval",
      status: "partial",
      templateIds: ["sinusoid-parameters", "average-rate-formula"],
      limitations:
        "The families read sinusoid features by choice and find an average rate from function values by entry. A period with a coefficient of 4 pi over 3 and an average rate from the cosine rule have no protocol for the written answers.",
    },
    {
      section: "Part III",
      item: {
        number: "36",
        page: "printed p.23; PDF p.23; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-REI.A"],
      archetypeIds: ["nonlinear.rational-radical"],
      demand:
        "Solve a radical equation with a coefficient on the radical and reject the extraneous solution",
      status: "partial",
      templateIds: ["radical-equation-shifted", "radical-equation-check"],
      limitations:
        "The families solve one radical with a constant shift and choose the statement about extraneous solutions. Squaring with a coefficient, solving the resulting quadratic and rejecting one value are not practiced together.",
    },
    {
      section: "Part IV",
      item: {
        number: "37",
        page: "printed p.24; PDF p.24; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["F-BF.A"],
      archetypeIds: [
        "sequence.arithmetic",
        "sequence.geometric",
        "sequence.rule-forms",
      ],
      demand:
        "Classify two practice plans as arithmetic or geometric, write each rule and compare the 19th day",
      status: "partial",
      templateIds: [
        "arithmetic-sequence-as-function",
        "geometric-sequence-as-function",
        "geometric-sequence",
      ],
      limitations:
        "The families write a sequence as a function and find a term from a first term and ratio. Classifying from a context, writing both explicit rules and justifying the comparison with a 15 percent growth factor has no protocol.",
    },
  ],
);
