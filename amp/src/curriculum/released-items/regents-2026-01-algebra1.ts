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
      status: "covered",
      templateIds: [
        "parabola-vertex",
        "parabola-axis",
        "parabola-axis-vertex-graph",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "absolute-value-affine-equation",
        "graphical-solution-table",
        "abs-equals-linear-unique",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: ["monic-quadratic-factorization", "factor-large-trinomial"],
      limitations: "",
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
      status: "covered",
      templateIds: ["combine-square-roots", "combine-unlike-radicals"],
      limitations: "",
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
      status: "covered",
      templateIds: ["polynomial-structure"],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "function-relation-test",
        "relation-function-choice",
        "graph-is-function",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "structure-meaning",
        "exponential-model-rule",
        "exponential-initial-value",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "nonlinear-formula-isolate",
        "formula-isolate",
        "isolate-two-term-formula",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "linear-system-pair",
        "elimination-equivalent",
        "substitute-into-equation",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "grouped-linear-inequality",
        "inequality-number-line-choice",
        "inequality-both-sides-number-line",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: ["linear-or-exponential", "exponential-decay-table"],
      limitations: "",
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
      status: "covered",
      templateIds: ["function-evaluation", "radical-function-value"],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "parabola-shift",
        "transform-equation",
        "shift-function-notation",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: ["zeros-from-factors", "zeros-of-factored-product"],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "solve-square-cube-equation",
        "function-evaluation",
        "quadratic-negative-output",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "relative-frequency-percent",
        "two-way-missing",
        "two-way-share",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "unit-chain-conversion",
        "compound-unit-conversion",
        "rate-unit-chain",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: ["power-of-power-exponent", "negative-monomial-power"],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "average-rate-formula",
        "average-rate-display",
        "average-rate-table-rounded",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: ["complete-square-monic", "complete-square-equation"],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "geometric-sequence",
        "geometric-sequence-rule",
        "geometric-signed-term",
      ],
      limitations: "",
    },
    {
      section: "Part II",
      item: {
        number: "25",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-REI.B"],
      archetypeIds: ["linear.solve"],
      demand:
        "Solve a linear equation with a grouped term and a variable term on each side",
      status: "covered",
      templateIds: [
        "grouped-linear-equation",
        "both-sides-linear-equation",
        "grouped-both-sides-solve",
        "grouped-both-sides-steps",
      ],
      limitations:
        "grouped-both-sides-steps (structured-work-v1) enters the grouped side with the parentheses removed and like terms combined as a typed expression, the coefficient of the variable and the number after collecting terms, and the solution, as exact steps. The steps are the shown work the rating guide credits. The item is a two-credit constructed response, labeled constructed because its credit depends on the work.",
      labeledBy: "agent:stale-shown-work-relabel",
      labeledAt: "2026-10-27",
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
      templateIds: ["exponential-model-value", "graph-exponential-points"],
      limitations:
        "exponential-model-value gives values by entry and graph-exponential-points places three lattice points of an exponential function with base 2, 3, one half or one third. A stated interval of inputs with a decimal or fractional base, and the drawn curve between the points, are not required.",
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
      status: "covered",
      templateIds: ["polynomial-multiplication", "polynomial-product-steps"],
      limitations:
        "polynomial-product-steps (structured-work-v1), binomial times trinomial form: the learner types the binomial's first term and then its second term times the whole trinomial, then enters the four coefficients of the cubic product from the highest power down, so standard form is graded exactly. The two partial products are the algebraic work the rating guide credits.",
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
      status: "covered",
      templateIds: ["linear-model-equation", "line-from-point-steps"],
      limitations:
        "line-from-point-steps (structured-work-v1), slope-and-point form: a fractional slope and an integer point, entering the slope times x, the y-intercept (the step the rating guide credits on its own) and the typed equation, graded as the same relation so y must stand alone, which is the slope-intercept form the rating guide requires.",
    },
    {
      section: "Part II",
      item: {
        number: "30",
        page: "printed p.15; PDF p.15; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-CED.A"],
      archetypeIds: ["inequality.context"],
      demand:
        "Find the greatest whole number of items that fit a budget after a fixed expense",
      status: "covered",
      templateIds: [
        "first-cheaper-whole-input",
        "inequality-context-bound",
        "budget-whole-items",
        "budget-items-steps",
      ],
      limitations:
        "budget-items-steps (structured-work-v1) enters the inequality for a fixed amount plus a price per item (graded as the same relation with its terms or sides in either order, so an inequality already reduced to the price times n alone is not accepted as this step), the money left and the greatest whole number as steps, the algebraic work the rating guide credits. The item is a two-credit constructed response, labeled constructed because its credit depends on the work.",
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
