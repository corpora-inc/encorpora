import { defineLedger } from "./types";

/** Every mathematics item of the January 2026 Algebra I Regents Examination
 * (Next Generation Learning Standards), labeled once. Standards are the
 * cluster codes stated in the rating guide's map to the learning standards. */
export const regentsAlgebra1January2026 = defineLedger(
  {
    id: "regents-2026-01-algebra1",
    test: "New York Regents Algebra I",
    form: "January 2026 administration",
    url: "https://www.nysedregents.org/algebraone/126/algone-12026-exam.pdf",
    edition:
      "January 2026 Regents Examination in Algebra I, Next Generation Learning Standards form",
    retrievedAt: "2026-10-26",
    sha256: "6e46d54e11c27faa873a187fe132f3579669d41dcf055b855bc62a3c48206a6f",
    supplements: [
      {
        role: "scoring key",
        url: "https://www.nysedregents.org/algebraone/126/algone-12026-sk.pdf",
        sha256:
          "11e60fd3210f7bc9a6840c58d4cb07f24c5c0e6fda88734f37e519c43b4bc4b3",
      },
      {
        role: "rating guide with map to the learning standards",
        url: "https://www.nysedregents.org/algebraone/126/algone-12026-rg.pdf",
        sha256:
          "cb5fa80b9018a326783763fc23958b41f7c85858a73a112280b5949ac6cb8973",
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
      standards: ["F-IF.C"],
      archetypeIds: ["nonlinear.features"],
      demand:
        "Read the axis of symmetry and the vertex of a graphed parabola and choose the pair that names both",
      status: "partial",
      templateIds: ["parabola-vertex", "parabola-axis"],
      limitations:
        "The vertex family reads a graphed vertex and the axis family finds the line from points or intercepts, but each answers one feature. A choice of an axis equation and vertex pair, with the wrong-axis options x = k versus y = k, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "2",
        page: "printed p.2; PDF p.2; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["N-RN.B"],
      archetypeIds: ["number.rational-irrational"],
      demand:
        "Decide what kind of number the product of a rational number and a square root is",
      status: "covered",
      templateIds: ["number-system-closure-classify", "classify-real-number"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "3",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-REI.D"],
      archetypeIds: ["nonlinear.absolute", "equation.graphical-solution"],
      demand:
        "Find the input where an absolute-value function and a linear function are equal",
      status: "partial",
      templateIds: [
        "absolute-value-affine-equation",
        "graphical-solution-table",
      ],
      limitations:
        "Absolute-value equations are solved with one absolute value against a constant, and graphical solutions come from a table of two functions. Equating an absolute-value expression with a linear expression and reading the crossing is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "4",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-SSE.A"],
      archetypeIds: ["expression.factor"],
      demand:
        "Factor a monic trinomial with a negative middle term and a large negative constant",
      status: "partial",
      templateIds: ["monic-quadratic-factorization"],
      limitations:
        "Sampled trinomials have small constants such as 36. A constant of -120 with factors 20 and 6 needs a longer search than the family asks.",
    },
    {
      section: "Part I",
      item: {
        number: "5",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["N-RN.B"],
      archetypeIds: ["expression.radical-simplify"],
      demand:
        "Combine square-root terms with unlike radicands and like radicands into one expression",
      status: "partial",
      templateIds: ["combine-square-roots"],
      limitations:
        "The family simplifies one square root into a coefficient times a root before combining. Collecting like radicals while an unlike radical stays separate is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "6",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-SSE.A"],
      archetypeIds: ["expression.polynomial-structure"],
      demand:
        "Choose the polynomial that has a stated degree, leading coefficient and constant term when terms are out of order",
      status: "missing",
      templateIds: [],
      limitations:
        "No family names the degree, leading coefficient or constant term of a polynomial written out of order.",
    },
    {
      section: "Part I",
      item: {
        number: "7",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-IF.A"],
      archetypeIds: ["function.identify"],
      demand: "Choose which of four graphs represents a function",
      status: "partial",
      templateIds: ["function-relation-test", "relation-function-choice"],
      limitations:
        "The families test equations, ordered pairs and tables. The vertical-line test on a drawn graph, including a sideways curve and a circle, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "8",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-LE.B"],
      archetypeIds: ["exponential.context"],
      demand:
        "Read the starting value of an exponential growth model written as a rule",
      status: "partial",
      templateIds: ["structure-meaning", "exponential-model-rule"],
      limitations:
        "The meaning family asks what a coefficient represents and the rule family builds a rule from a context or graph. Choosing the starting value of a given growth rule as a number, ignoring the 1.08 factor, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "9",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-CED.A"],
      archetypeIds: ["nonlinear.literal"],
      demand: "Solve the surface-area formula of a cylinder for its height",
      status: "partial",
      templateIds: ["nonlinear-formula-isolate", "formula-isolate"],
      limitations:
        "The families isolate one variable in a product or a power. Moving a two-term sum before dividing by a variable that appears in only one of two terms is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "10",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-REI.C"],
      archetypeIds: ["system.solve"],
      demand:
        "Choose the equation that results from substituting one equation into another",
      status: "partial",
      templateIds: ["linear-system-pair", "elimination-equivalent"],
      limitations:
        "The families check a solution pair and form combinations by elimination. Solving one equation for a variable with a coefficient of -1 and substituting it, with the sign of the substituted expression as the distractor, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "11",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-REI.B"],
      archetypeIds: ["inequality.solve", "inequality.number-line"],
      demand:
        "Solve an inequality with the variable on both sides and choose its graph on a number line",
      status: "partial",
      templateIds: [
        "grouped-linear-inequality",
        "inequality-number-line-choice",
      ],
      limitations:
        "The inequality family solves with the variable on both sides and the number-line family matches a single inequality with its graph. Choosing the graph of a fractional endpoint from a two-sided solve is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "12",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-REI.A"],
      archetypeIds: ["linear.step-justification"],
      demand:
        "Name the property that justifies adding a constant to both sides in one solving step",
      status: "covered",
      templateIds: ["equation-step-property"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "13",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-LE.A"],
      archetypeIds: ["bivariate.growth"],
      demand: "Choose the table of values that shows exponential decay",
      status: "partial",
      templateIds: ["linear-or-exponential"],
      limitations:
        "The family classifies a table as linear or exponential. Telling decay from growth and from other nonlinear tables with a repeating ratio less than 1 is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "14",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-IF.A"],
      archetypeIds: ["nonlinear.input-output"],
      demand: "Evaluate a square-root function at a given input",
      status: "partial",
      templateIds: ["function-evaluation"],
      limitations:
        "Function evaluation is practiced with quadratic rules. A radical rule with a translated radicand is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "15",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-BF.B"],
      archetypeIds: ["nonlinear.transform"],
      demand:
        "Write the rule of a parabola shifted left from a rule already written in vertex form",
      status: "partial",
      templateIds: ["parabola-shift", "transform-equation"],
      limitations:
        "The families shift the basic parabola or a basic function. Shifting a function that already has a horizontal and a vertical shift and combining the new shift with the old one is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "16",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-IF.C"],
      archetypeIds: ["nonlinear.polynomial-zeros"],
      demand: "Find the zeros of a product of x and a difference of squares",
      status: "partial",
      templateIds: ["zeros-from-factors"],
      limitations:
        "The family reads zeros from linear factors. Factoring x squared minus 36 first, and counting x = 0 among the zeros, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "17",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-REI.D"],
      archetypeIds: ["nonlinear.input-output"],
      demand:
        "Find the inputs that put a point with a given negative output on a parabola",
      status: "partial",
      templateIds: ["solve-square-cube-equation", "function-evaluation"],
      limitations:
        "Square equations are solved only for pure squares and functions are evaluated forward. Setting a quadratic equal to a negative output and solving the resulting trinomial is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "18",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["S-ID.B"],
      archetypeIds: ["probability.conditional"],
      demand:
        "Find the share of all purchases that fall in one cell of a two-way frequency table",
      status: "partial",
      templateIds: ["relative-frequency-percent", "two-way-missing"],
      limitations:
        "The families give a conditional share within a row or column or find a missing count. The joint relative frequency of one cell over the grand total is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "19",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["N-Q.A"],
      archetypeIds: ["ratio.units"],
      demand:
        "Name the unit of a rate after a chain of conversion factors is multiplied",
      status: "partial",
      templateIds: ["unit-chain-conversion", "compound-unit-conversion"],
      limitations:
        "The families compute the converted number. Reading the resulting unit from the cancelled chain, here feet per second, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "20",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-SSE.B"],
      archetypeIds: ["expression.exponent-rules"],
      demand:
        "Simplify a negative monomial with a coefficient raised to a power",
      status: "partial",
      templateIds: ["power-of-power-exponent"],
      limitations:
        "The family raises powers with exponent rules and entry of an exponent. A negative coefficient cubed together with a squared variable and a sign choice is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "21",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-IF.B"],
      archetypeIds: ["function.average-rate-change"],
      demand:
        "Find the average rate of change of a table of decaying values over an interval to the nearest tenth",
      status: "partial",
      templateIds: ["average-rate-formula", "average-rate-display"],
      limitations:
        "The families use function values from a rule and read a displayed rate. A table with uneven years and a decimal result is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "22",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-APR.A"],
      archetypeIds: ["expression.polynomial"],
      demand: "Subtract one quadratic trinomial from another",
      status: "covered",
      templateIds: ["polynomial-subtraction"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "23",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-REI.B"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Choose the equation in completed-square form that has the same solutions as a quadratic equation",
      status: "partial",
      templateIds: ["complete-square-monic"],
      limitations:
        "The family rewrites an expression in completed-square form. Completing the square on both sides of an equation and keeping the constant balanced is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "24",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-IF.A"],
      archetypeIds: ["sequence.geometric"],
      demand:
        "Find the fourth term of a geometric sequence with a negative first term and a negative ratio",
      status: "partial",
      templateIds: ["geometric-sequence", "geometric-sequence-rule"],
      limitations:
        "Sampled first terms and ratios are positive. A negative ratio that alternates the sign of terms is not practiced.",
    },
    {
      section: "Part II",
      item: {
        number: "25",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.13",
      },
      responseFormat: "numeric",
      standards: ["A-REI.B"],
      archetypeIds: ["linear.solve"],
      demand:
        "Solve a linear equation with a grouped term and a variable term on each side",
      status: "partial",
      templateIds: ["grouped-linear-equation", "both-sides-linear-equation"],
      limitations:
        "Grouped terms and variables on both sides are practiced separately. Distributing a factor, combining the variable terms on one side and then solving for a fraction is not. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part II",
      item: {
        number: "26",
        page: "printed p.11; PDF p.11; standard map rating guide PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["F-IF.C"],
      archetypeIds: ["exponential.graph", "graph.draw-nonlinear"],
      demand: "Graph an exponential function over a stated interval of inputs",
      status: "partial",
      templateIds: ["exponential-model-value"],
      limitations:
        "Only values of an exponential rule are practiced, by entry. Plotting the points on an interval and drawing the curve has no protocol, and point plotting accepts only lines.",
    },
    {
      section: "Part II",
      item: {
        number: "27",
        page: "printed p.12; PDF p.12; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-APR.A"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Multiply a binomial and a trinomial and write the product in standard form",
      status: "partial",
      templateIds: ["polynomial-multiplication"],
      limitations:
        "The family multiplies a monomial and a binomial or two binomials and takes a choice. Entering a written cubic polynomial has no protocol.",
    },
    {
      section: "Part II",
      item: {
        number: "28",
        page: "printed p.13; PDF p.13; standard map rating guide PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["S-ID.A"],
      archetypeIds: ["univariate.displays", "univariate.quartiles"],
      demand:
        "Find the five-number summary of a listed data set and construct its box plot",
      status: "partial",
      templateIds: ["box-plot-read", "interquartile-range-data"],
      limitations:
        "The families read a drawn box plot and compute the interquartile range. Finding the quartiles of thirteen values and drawing the box and whiskers has no protocol.",
    },
    {
      section: "Part II",
      item: {
        number: "29",
        page: "printed p.14; PDF p.14; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-REI.D"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Write a line in slope-intercept form from a fractional slope and a point",
      status: "partial",
      templateIds: ["linear-model-equation"],
      limitations:
        "The family chooses an equation for a context or graph. Entering the written equation y = mx + b with a fractional slope has no protocol.",
    },
    {
      section: "Part II",
      item: {
        number: "30",
        page: "printed p.15; PDF p.15; standard map rating guide PDF p.13",
      },
      responseFormat: "numeric",
      standards: ["A-CED.A"],
      archetypeIds: ["inequality.context"],
      demand:
        "Find the greatest whole number of items that fit a budget after a fixed expense",
      status: "partial",
      templateIds: ["first-cheaper-whole-input", "inequality-from-context"],
      limitations:
        "The families find a whole-number threshold between two plans and choose an inequality for a context. Writing and solving the budget inequality and rounding down a decimal bound is not practiced, and the guide credits shown work.",
    },
    {
      section: "Part III",
      item: {
        number: "31",
        page: "printed p.16; PDF p.16; standard map rating guide PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["F-IF.B"],
      archetypeIds: [
        "quadratic.context",
        "graph.draw-nonlinear",
        "nonlinear.features",
      ],
      demand:
        "Sketch a projectile height model and state the time and height of its maximum",
      status: "partial",
      templateIds: ["quadratic-context-model", "parabola-vertex"],
      limitations:
        "The families give the maximum height and a vertex from a rule. Sketching the parabola on a scaled grid has no protocol and the time of the maximum is not asked.",
    },
    {
      section: "Part III",
      item: {
        number: "32",
        page: "printed p.17; PDF p.17; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-REI.B"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Solve a quadratic equation with the quadratic formula and leave the roots in simplest radical form",
      status: "partial",
      templateIds: ["quadratic-irrational-solutions"],
      limitations:
        "The family chooses from lists of exact roots. Entering a written pair of simplified radical expressions has no protocol.",
    },
    {
      section: "Part III",
      item: {
        number: "33",
        page: "printed p.18; PDF p.18; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["S-ID.C"],
      archetypeIds: [
        "bivariate.regression-compute",
        "bivariate.correlation-coefficient",
        "bivariate.interpret",
      ],
      demand:
        "Compute a regression line and its correlation coefficient from a table and say what the coefficient shows",
      status: "partial",
      templateIds: [
        "regression-line-predict",
        "regression-coefficient-meaning",
        "correlation-choice",
      ],
      limitations:
        "The families use a given regression line and interpret a coefficient or its strength. Computing the line and r from seven data pairs by calculator and writing the fit in words has no protocol.",
    },
    {
      section: "Part III",
      item: {
        number: "34",
        page: "printed p.19; PDF p.19; standard map rating guide PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["A-REI.D"],
      archetypeIds: ["inequality.graph-region", "inequality.graph"],
      demand:
        "Graph the solution of a system of two linear inequalities and decide whether a point is in the region",
      status: "partial",
      templateIds: ["half-plane-inequality", "inequality-solution-point"],
      limitations:
        "The families match a shaded region with its inequalities and test a point. Drawing the dashed and solid boundaries and shading the overlap has no protocol, and the written explanation is not scored.",
    },
    {
      section: "Part IV",
      item: {
        number: "35",
        page: "printed p.20; PDF p.20; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-CED.A"],
      archetypeIds: ["system.context", "system.solve"],
      demand:
        "Write a system for two purchases, test a claimed solution and solve the system algebraically",
      status: "partial",
      templateIds: ["system-model-value", "linear-system-x"],
      limitations:
        "The families solve a system by entry for a count or a variable. Writing the two equations, justifying that the claimed prices fail the first equation and showing an elimination are not scored and have no protocol.",
    },
  ],
);
