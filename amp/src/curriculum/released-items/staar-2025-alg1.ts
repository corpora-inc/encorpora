import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2025 STAAR Algebra I mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2025 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staarAlgebra1 = defineLedger(
  {
    id: "staar-2025-alg1",
    test: "STAAR Algebra I mathematics",
    form: "Spring 2025 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-algebra-1-rationale.pdf",
    edition:
      "Spring 2025 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "a499d62c6b536ce43915e614a46651790679de3f578e21febd4f436f5fd7ae99",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-algebra-1-answer-key.pdf",
        sha256:
          "21121440fcca19e12eef013b786787a4aa24ca564397d79e4cce70f9da0e3e6a",
      },
    ],
    complete: true,
  },
  {
    labeledBy: "agent:staar-first-pass",
    labeledAt: "2026-10-26",
    section: "Test form",
  },
  [
    {
      item: {
        number: "1",
        page: "rationale PDF p.1",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.1.10.D"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Distribute decimal multipliers over two binomials in two variables and combine like terms",
      status: "partial",
      templateIds: ["polynomial-subtraction", "polynomial-addition"],
      limitations:
        "The coefficients axis (tenths) adds and subtracts polynomials with decimal coefficients; distributing a decimal multiplier over binomials and two variables are not yet practiced.",
    },
    {
      item: {
        number: "2",
        page: "rationale PDF p.2",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.5.9.D"],
      archetypeIds: ["exponential.graph-features"],
      demand:
        "Choose the true statement about where an exponential graph crosses the y-axis",
      status: "covered",
      templateIds: ["function-graph-features"],
      limitations:
        "The family reads the y-intercept, direction and asymptote of an exponential graph.",
    },
    {
      item: {
        number: "3",
        page: "rationale PDF p.3",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.1.11.A"],
      archetypeIds: ["expression.radical-simplify"],
      demand: "Simplify the square root of fifty",
      status: "covered",
      templateIds: ["simplify-square-root"],
      limitations:
        "The family simplifies square roots of composite numbers into a whole factor times a root.",
    },
    {
      item: {
        number: "4",
        page: "rationale PDF p.4",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.2.I"],
      archetypeIds: ["system.from-graph"],
      demand: "Choose the system of equations that matches two graphed lines",
      status: "covered",
      templateIds: [
        "graph-equation-choice",
        "linear-system-pair",
        "system-equation-choice",
      ],
      limitations:
        "system-equation-choice (single-choice-v1) draws two lines on a grid and asks which system of equations is graphed, with slopes and intercepts of either sign among the four systems, so reading two lines to choose a system is practiced.",
      labeledBy: "agent:stale-shown-work-relabel",
      labeledAt: "2026-10-27",
    },
    {
      item: {
        number: "5",
        page: "rationale PDF p.6",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.4.6.A"],
      archetypeIds: ["function.domain-range"],
      demand:
        "Choose the quadratic whose range is all values at least negative one",
      status: "partial",
      templateIds: ["parabola-vertex", "quadratic-form-conversion"],
      limitations:
        "Related families find a vertex or choose the form showing a minimum; deciding the range of four given quadratics is not practiced.",
    },
    {
      item: {
        number: "6",
        page: "rationale PDF p.7",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.A1.3.2.C"],
      archetypeIds: ["function.rule"],
      demand:
        "Complete a linear function in slope-intercept form from a table by dragging the slope and intercept",
      status: "covered",
      templateIds: [
        "inline-linear-features",
        "linear-model-equation",
        "unequal-step-rate",
      ],
      limitations:
        "STAAR interaction: drag and drop, 2 points. inline-linear-features completes the slope and intercept of y = mx + b from a table of evenly spaced values; the drag-and-drop tiles are offered as one picker per blank.",
    },
    {
      item: {
        number: "7",
        page: "rationale PDF p.8",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.2.4.A"],
      archetypeIds: ["bivariate.correlation"],
      demand:
        "Name the type of linear association between months and a remaining balance from a computed correlation coefficient",
      status: "partial",
      templateIds: ["correlation-choice"],
      limitations:
        "correlation-choice compares given correlation coefficients; computing r with regression tools and interpreting its sign and strength are not practiced.",
    },
    {
      item: {
        number: "8",
        page: "rationale PDF p.9",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.2.B"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Write a line in slope-intercept form from a fractional slope and one point",
      status: "covered",
      templateIds: [
        "staar-line-from-points",
        "linear-model-equation",
        "recover-linear-intercept",
      ],
      limitations:
        "staar-line-from-points chooses the slope-intercept equation from a fractional slope, positive or negative, and one point.",
    },
    {
      item: {
        number: "9",
        page: "rationale PDF p.10",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.4.7.B"],
      archetypeIds: ["nonlinear.polynomial-zeros"],
      demand:
        "Choose the true statement about the zeros of a function written as a product of two linear factors",
      status: "covered",
      templateIds: ["zeros-from-factors"],
      limitations:
        "The family finds the zeros of a function written in factored form.",
    },
    {
      item: {
        number: "10",
        page: "rationale PDF p.11",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.2.3.D"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Choose the graph that shows the solution set of a two-variable inequality in standard form",
      status: "partial",
      templateIds: ["half-plane-inequality"],
      limitations:
        "half-plane-inequality names the inequality for a shaded region; the inverse, choosing a graph for an inequality with a solid boundary, is not practiced.",
    },
    {
      item: {
        number: "11",
        page: "rationale PDF p.13",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.5.C"],
      archetypeIds: ["system.solve"],
      demand:
        "Solve a system with one equation already solved for y by substitution and give the value of x",
      status: "partial",
      templateIds: ["linear-system-x", "linear-system-pair"],
      limitations:
        "linear-system-x checked samples have whole-number solutions and linear-system-pair chooses an ordered pair; the item's fractional x value with a substitution setup is not practiced as a single value.",
    },
    {
      item: {
        number: "12",
        page: "rationale PDF p.15",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.4.7.C"],
      archetypeIds: ["nonlinear.transform"],
      demand: "Find the vertex of g(x) = f(x + 8.7) for f(x) = x squared",
      status: "partial",
      templateIds: ["parabola-shift"],
      limitations:
        "parabola-shift gives equations or comparisons for integer shifts; finding the vertex after a decimal shift in function notation is not practiced.",
    },
    {
      item: {
        number: "13",
        page: "rationale PDF p.16",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.2.3.B"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Find the rate of change of y from a linear equation in standard form",
      status: "covered",
      templateIds: ["staar-line-from-points", "formula-isolate", "line-slope"],
      limitations:
        "staar-line-from-points chooses the rate of change of y from an equation in standard form.",
    },
    {
      item: {
        number: "14",
        page: "rationale PDF p.17",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.2.H"],
      archetypeIds: ["inequality.context"],
      demand:
        "Choose the two-variable inequality for a budget of two ingredients with different prices per pound",
      status: "partial",
      templateIds: ["constraint-feasible", "inequality-from-context"],
      limitations:
        "Related families choose a one-variable inequality or test points of a stated region; writing a two-variable cost inequality is not practiced.",
    },
    {
      item: {
        number: "15",
        page: "rationale PDF p.18",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.A1.4.7.A"],
      archetypeIds: ["nonlinear.features"],
      demand: "Mark the y-intercept of a quadratic function on its graph",
      status: "partial",
      templateIds: ["parabola-vertex", "coordinate-point-reading"],
      limitations:
        "STAAR interaction: hot spot, 1 point. parabola-vertex reads a vertex and coordinate-point-reading reads one coordinate of a labeled point; marking a location on a graph (hot spot) has no response protocol.",
    },
    {
      item: {
        number: "16",
        page: "rationale PDF p.19",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.2.A"],
      archetypeIds: ["function.domain-range"],
      demand:
        "Choose the range of a discrete linear cost function whose inputs are whole numbers of tickets",
      status: "partial",
      templateIds: ["context-domain-range"],
      limitations:
        "context-domain-range chooses a domain for a context function; the discrete range of cost values is not practiced.",
    },
    {
      item: {
        number: "17",
        page: "rationale PDF p.20",
      },
      responseFormat: "numeric",
      standards: ["TEKS.A1.1.12.B"],
      archetypeIds: ["nonlinear.input-output"],
      demand: "Evaluate a quadratic written in vertex form at a negative input",
      status: "partial",
      templateIds: ["function-evaluation"],
      limitations:
        "STAAR interaction: equation editor, 1 point. function-evaluation substitutes into standard-form quadratics in checked samples; vertex form with a squared binomial is not practiced.",
    },
    {
      item: {
        number: "18",
        page: "rationale PDF p.21",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.5.9.C"],
      archetypeIds: ["exponential.context"],
      demand: "Choose the exponential function that fits a table of values",
      status: "covered",
      templateIds: ["exponential-model-rule"],
      limitations:
        "The family chooses y = a times b to the x from a table, a graph or a growth or decay story.",
    },
    {
      item: {
        number: "19",
        page: "rationale PDF p.22",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.2.3.C"],
      archetypeIds: ["function.intercepts"],
      demand:
        "Choose the zero of a linear function from the point where its graph crosses the x-axis",
      status: "covered",
      templateIds: ["intercept-point-choice"],
      limitations:
        "intercept-point-choice's zero variant shows a graphed line and asks for the zero of the function, the x-value where the graph meets the x-axis; it also gives rules.",
    },
    {
      item: {
        number: "20",
        page: "rationale PDF p.23",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.1.10.E"],
      archetypeIds: ["expression.factor"],
      demand:
        "Choose a factor of a trinomial whose terms share a common factor",
      status: "covered",
      templateIds: ["nonmonic-quadratic-factorization"],
      limitations:
        "The family factors a nonmonic trinomial completely, taking out a greatest common factor first; the item asks for one factor of the complete factorization.",
    },
    {
      item: {
        number: "21",
        page: "rationale PDF p.24",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.4.7.A"],
      archetypeIds: ["nonlinear.features"],
      demand:
        "Choose the equation of a parabola's axis of symmetry from its graph with a labeled vertex",
      status: "covered",
      templateIds: [
        "parabola-vertex",
        "parabola-axis",
        "parabola-axis-vertex-graph",
      ],
      limitations:
        "parabola-axis-vertex-graph (single-choice-v1) draws a parabola opening up or down with its vertex left or right of the y-axis and asks for the equation of the axis of symmetry together with the vertex, reading the axis from the graph; the item asks only for the axis.",
      labeledBy: "agent:stale-shown-work-relabel",
      labeledAt: "2026-10-27",
    },
    {
      item: {
        number: "22",
        page: "rationale PDF p.25",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.A1.3.2.E"],
      archetypeIds: ["line.parallel-perpendicular"],
      demand:
        "Complete the equation of a line parallel to a graphed line through a point by dragging the slope and intercept",
      status: "partial",
      templateIds: ["perpendicular-slopes"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. perpendicular-slopes finds slopes and a missing coordinate by entry; the full parallel line equation and drag and drop are not practiced.",
    },
    {
      item: {
        number: "23",
        page: "rationale PDF p.26",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.1.10.B"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Multiply two binomials with a squared term and a second variable",
      status: "partial",
      templateIds: ["polynomial-multiplication"],
      limitations:
        "polynomial-multiplication expands products in one variable x; two variables are not practiced.",
    },
    {
      item: {
        number: "24",
        page: "rationale PDF p.27",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.5.C"],
      archetypeIds: ["system.classify"],
      demand:
        "Decide from a substitution result that a system has infinitely many solutions",
      status: "covered",
      templateIds: ["linear-system-solution-count"],
      limitations:
        "The family distinguishes one, no and infinitely many solutions of a linear system.",
    },
    {
      item: {
        number: "25",
        page: "rationale PDF p.28",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.A1.2.4.C"],
      archetypeIds: ["bivariate.linear-fit"],
      demand:
        "Mark every true prediction made from a line of best fit found by regression",
      status: "partial",
      templateIds: ["regression-line-predict"],
      limitations:
        "STAAR interaction: multiselect, 2 points. regression-line-predict predicts one value from a stated fitted line; computing the line with technology and picking two true predictions have no response protocol.",
    },
    {
      item: {
        number: "26",
        page: "rationale PDF p.30",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.4.8.A"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Write and solve a quadratic from a deck area and choose the positive width",
      status: "partial",
      templateIds: ["quadratic-expanded-solutions", "quadratic-context-model"],
      limitations:
        "Related families solve a stated quadratic by factoring or use a quadratic model; setting a product equal to an area and choosing the valid root are not practiced.",
    },
    {
      item: {
        number: "27",
        page: "rationale PDF p.32",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.2.3.A"],
      archetypeIds: ["function.average-rate-change"],
      demand: "Find the slope of a line from three points in a table",
      status: "covered",
      templateIds: ["average-rate-display"],
      limitations:
        "The family finds a rate of change from a table of values; the item's table is linear with a fractional slope.",
    },
    {
      item: {
        number: "28",
        page: "rationale PDF p.33",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.A1.1.11.B"],
      archetypeIds: ["expression.exponent-rules"],
      demand:
        "Complete an equivalent form of a quotient with a negative exponent by dragging the coefficient and exponent",
      status: "covered",
      templateIds: [
        "exponent-quotient-slots",
        "quotient-of-powers-exponent",
        "product-of-powers-exponent",
      ],
      limitations:
        "exponent-quotient-slots chooses the coefficient and exponent of a quotient of terms with the same base, including a negative exponent. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: {
        number: "29",
        page: "rationale PDF p.34",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.5.A"],
      archetypeIds: ["linear.solve"],
      demand:
        "Solve an equation with fractional coefficients and a parenthesized term on one side",
      status: "covered",
      templateIds: [
        "staar-multistep-equations",
        "rational-coefficient-equation",
        "grouped-linear-equation",
      ],
      limitations:
        "staar-multistep-equations solves an equation with fractional coefficients and a parenthesized term with variables on both sides, by entry.",
    },
    {
      item: {
        number: "30",
        page: "rationale PDF p.35",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.A1.2.3.D"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Graph a dashed boundary line and shade the half-plane for y greater than a linear expression",
      status: "partial",
      templateIds: ["graph-linear-equation"],
      limitations:
        "STAAR interaction: graphing, 2 points. graph-linear-equation places lattice points of a line; dashed or solid boundary choice and region shading have no response protocol.",
    },
    {
      item: {
        number: "31",
        page: "rationale PDF p.36",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.1.12.E"],
      archetypeIds: ["linear.literal"],
      demand: "Rewrite 5x minus 8y equals 40 as an equation for y",
      status: "covered",
      templateIds: ["formula-isolate"],
      limitations:
        "The family chooses the rearranged formula for a named variable, including standard-form lines.",
    },
    {
      item: {
        number: "32",
        page: "rationale PDF p.37",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.4.6.A"],
      archetypeIds: ["function.domain-range"],
      demand:
        "Choose the domain of the part of a quadratic function shown on a graph",
      status: "covered",
      templateIds: ["graph-domain-range"],
      limitations:
        "The family reads domain and range, with open or closed ends, from a graph.",
    },
    {
      item: {
        number: "33",
        page: "rationale PDF p.38",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.A1.5.9.D"],
      archetypeIds: ["exponential.graph"],
      demand:
        "Graph an exponential function with a base of one third and an asymptote",
      status: "partial",
      templateIds: [
        "graph-exponential-points",
        "function-graph-features",
        "exponential-model-value",
      ],
      limitations:
        "STAAR interaction: graphing, 1 point. graph-exponential-points places three lattice points of y = a times b to the x for bases 2, 3, one half and one third, graded as exact solutions of the equation; base one third gives only a few whole-number outputs, and the asymptote and the drawn curve are not part of the response.",
    },
    {
      item: {
        number: "34",
        page: "rationale PDF p.39",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.2.I"],
      archetypeIds: ["system.context"],
      demand:
        "Choose the system of equations for a rectangular garden from a perimeter and a length-to-width relationship",
      status: "partial",
      templateIds: ["system-model-value", "rate-combination-model"],
      limitations:
        "Related families solve a system story by entry; writing the equations for a geometric story is not practiced.",
    },
    {
      item: {
        number: "35",
        page: "rationale PDF p.40",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.2.3.C"],
      archetypeIds: ["function.representations"],
      demand:
        "Choose the graph of a line with a given fractional slope and y-intercept",
      status: "covered",
      templateIds: [
        "graph-of-linear-rule",
        "graph-equation-choice",
        "graph-linear-equation",
      ],
      limitations:
        "graph-of-linear-rule chooses among four drawn lines for a slope, including 2/3, and a y-intercept stated in words, with the item's distractors: the slope's sign flipped and the intercept placed on the x-axis.",
    },
    {
      item: {
        number: "36",
        page: "rationale PDF p.41",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.A1.4.8.A"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Solve a squared binomial equal to 25 and place both solutions by drag and drop",
      status: "covered",
      templateIds: [
        "square-root-solutions-slots",
        "quadratic-expanded-solutions",
        "solve-by-completing-square",
      ],
      limitations:
        "square-root-solutions-slots chooses the lesser and the greater solution of a squared binomial equal to a perfect square. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: {
        number: "37",
        page: "rationale PDF p.42",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.2.A"],
      archetypeIds: ["function.domain-range"],
      demand: "Choose the domain of a context function from its graph",
      status: "covered",
      templateIds: ["graph-domain-range"],
      limitations:
        "The family reads the domain, with open or closed ends, from a graph into inequality choices; the real-world labels of the item are not separately practiced.",
    },
    {
      item: {
        number: "38",
        page: "rationale PDF p.43",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.2.3.H"],
      archetypeIds: ["inequality.graph"],
      demand:
        "Choose the graph that shows a system of two linear inequalities with one dashed and one solid boundary",
      status: "partial",
      templateIds: ["half-plane-inequality"],
      limitations:
        "half-plane-inequality names the inequality of one shaded region; choosing the graph of a system is not practiced.",
    },
    {
      item: {
        number: "39",
        page: "rationale PDF p.45",
      },
      responseFormat: "other",
      standards: ["TEKS.A1.4.7.C"],
      archetypeIds: ["nonlinear.transform"],
      demand:
        "Complete a sentence that describes g(x) = f(x − 6) + 2 as a shift right and up, with dropdown blanks",
      status: "covered",
      templateIds: ["function-shift-sentence", "parabola-shift"],
      limitations:
        "function-shift-sentence completes the sentence describing g(x) = f(x -/+ h) +/- k as a horizontal and a vertical shift. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: {
        number: "40",
        page: "rationale PDF p.46",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.1.12.C"],
      archetypeIds: ["sequence.geometric"],
      demand:
        "Choose the first four terms generated by a recursive rule that multiplies by 1.1",
      status: "partial",
      templateIds: ["geometric-sequence-rule", "geometric-rule-forms"],
      limitations:
        "The number-domain axis (decimal-ratios) finds a term from a recursive rule with a decimal ratio and lists its terms in the explanation; choosing the first four generated terms is not yet an answer format.",
    },
    {
      item: {
        number: "41",
        page: "rationale PDF p.47",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.4.6.B"],
      archetypeIds: ["nonlinear.quadratic-from-data"],
      demand:
        "Write a quadratic in standard form from its vertex and a point on it",
      status: "partial",
      templateIds: ["quadratic-from-data", "quadratic-form-conversion"],
      limitations:
        "quadratic-from-data chooses a factored or standard equation from zeros or points and quadratic-form-conversion rewrites into vertex form; going from a vertex and a point to standard form is not practiced.",
    },
    {
      item: {
        number: "42",
        page: "rationale PDF p.49",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.2.C"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Choose the equation of a line from two points on its graph with a fractional slope",
      status: "partial",
      templateIds: ["graph-equation-choice"],
      limitations:
        "graph-equation-choice handles positive integer slope and intercept; a fractional slope read from two points is not practiced.",
    },
    {
      item: {
        number: "43",
        page: "rationale PDF p.51",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.5.9.E"],
      archetypeIds: ["bivariate.nonlinear-fit"],
      demand:
        "Choose the exponential function that models data found by exponential regression",
      status: "partial",
      templateIds: ["nonlinear-data-model", "exponential-model-rule"],
      limitations:
        "nonlinear-data-model picks a model by residuals and exponential-model-rule picks a rule from a table; regression with technology is not practiced.",
    },
    {
      item: {
        number: "44",
        page: "rationale PDF p.52",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.A1.1.10.E"],
      archetypeIds: ["expression.factor"],
      demand:
        "Mark both expressions equivalent to a trinomial among factored and distributed forms",
      status: "partial",
      templateIds: [
        "greatest-monomial-factor",
        "nonmonic-quadratic-factorization",
      ],
      limitations:
        "STAAR interaction: multiselect, 2 points. Related families choose one complete factorization; recognizing two equivalent forms with multiple selection has no response protocol.",
    },
    {
      item: {
        number: "45",
        page: "rationale PDF p.53",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.2.3.F"],
      archetypeIds: ["system.classify"],
      demand:
        "Decide which statement is true about a system given in two linear equations",
      status: "covered",
      templateIds: ["linear-system-solution-count"],
      limitations:
        "The family distinguishes one, no and infinitely many solutions of a linear system.",
    },
    {
      item: {
        number: "46",
        page: "rationale PDF p.54",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.3.5.A"],
      archetypeIds: ["nonlinear.rational-radical"],
      demand:
        "Solve an equation that sets two fractions with variable denominators equal",
      status: "partial",
      templateIds: ["rational-equation-one-denominator"],
      limitations:
        "rational-equation-one-denominator clears one variable denominator; two variable denominators and cross-multiplication are not practiced.",
    },
    {
      item: {
        number: "47",
        page: "rationale PDF p.55",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.5.9.C"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the exponential function for an account balance that grows by a stated rate each year",
      status: "covered",
      templateIds: ["exponential-model-rule"],
      limitations:
        "The family chooses y = a times b to the x from a growth or decay story.",
    },
    {
      item: {
        number: "48",
        page: "rationale PDF p.56",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.1.11.B"],
      archetypeIds: ["expression.exponent-rules"],
      demand:
        "Simplify an expression with a negative exponent, a power of a product and a product of powers",
      status: "partial",
      templateIds: ["power-of-power-exponent", "product-of-powers-exponent"],
      limitations:
        "Related families find the exponent of one power rule at a time; combining three rules with coefficients is not practiced.",
    },
    {
      item: {
        number: "49",
        page: "rationale PDF p.57",
      },
      responseFormat: "other",
      standards: ["TEKS.A1.5.9.B"],
      archetypeIds: ["exponential.form"],
      demand:
        "Complete two sentences that interpret the initial value and the percent decrease of an exponential model",
      status: "covered",
      templateIds: [
        "exponential-parameters-blanks",
        "exponential-time-scale",
        "compound-growth",
      ],
      limitations:
        "exponential-parameters-blanks chooses the initial value, the direction and the percent rate of an exponential model. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: {
        number: "50",
        page: "rationale PDF p.58",
      },
      responseFormat: "choice",
      standards: ["TEKS.A1.2.3.B"],
      archetypeIds: ["function.average-rate-change"],
      demand: "Find the rate of change of distance from home from a graph",
      status: "covered",
      templateIds: ["average-rate-display"],
      limitations:
        "The family finds an average rate of change from a graph or table, including negative rates.",
    },
  ],
);
