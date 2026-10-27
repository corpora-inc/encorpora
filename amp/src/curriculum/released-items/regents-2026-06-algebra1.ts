import { defineLedger } from "./types";

/** Every mathematics item of the June 2026 Algebra I Regents Examination
 * (Next Generation Learning Standards), labeled once. Standards are the
 * cluster codes stated in the rating guide's map to the learning standards. */
export const regentsAlgebra1June2026 = defineLedger(
  {
    id: "regents-2026-06-algebra1",
    test: "New York Regents Algebra I",
    form: "June 2026 administration",
    url: "https://www.nysedregents.org/algebraone/626/algone-62026-exam.pdf",
    edition:
      "June 2026 Regents Examination in Algebra I, Next Generation Learning Standards form",
    retrievedAt: "2026-10-26",
    sha256: "01a277f5baa931069ffb94b81e62d108f26383ff06578384575c1dea708391c5",
    supplements: [
      {
        role: "scoring key",
        url: "https://www.nysedregents.org/algebraone/626/algone-62026-sk.pdf",
        sha256:
          "b0459a60c0dd647358aede9ba3a2cbc6827191eec9eac979be62ce46660dc739",
      },
      {
        role: "rating guide with map to the learning standards",
        url: "https://www.nysedregents.org/algebraone/626/algone-62026-rg.pdf",
        sha256:
          "2c103d821318fb1a6f6dab0694d8f8c2e654c01409d4998e2e9e34d5305fbd22",
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
        page: "printed p.2; PDF p.2; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-IF.A"],
      archetypeIds: ["sequence.arithmetic"],
      demand:
        "Find a distant term of an arithmetic sequence given its first four terms",
      status: "covered",
      templateIds: [
        "arithmetic-term",
        "arithmetic-sequence-as-function",
        "arithmetic-distant-term",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "2",
        page: "printed p.2; PDF p.2; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-REI.B"],
      archetypeIds: ["linear.solve"],
      demand:
        "Solve a linear equation with a decimal coefficient and the variable on both sides",
      status: "covered",
      templateIds: [
        "both-sides-linear-equation",
        "rational-coefficient-equation",
        "decimal-both-sides-equation",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "3",
        page: "printed p.2; PDF p.2; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-SSE.A"],
      archetypeIds: ["expression.factor"],
      demand:
        "Factor a difference of two squares whose first square has a coefficient greater than one",
      status: "covered",
      templateIds: ["polynomial-factoring-patterns", "rg-factor-completely"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "4",
        page: "printed p.2; PDF p.2; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-IF.A"],
      archetypeIds: ["function.identify"],
      demand:
        "Choose the missing input that keeps a set of ordered pairs a function",
      status: "covered",
      templateIds: [
        "relation-function-choice",
        "relation-point-removal",
        "function-missing-input",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "5",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-SSE.B"],
      archetypeIds: ["expression.exponent-rules"],
      demand:
        "Simplify a product of variables with a coefficient raised to the third power",
      status: "covered",
      templateIds: [
        "power-of-power-exponent",
        "product-of-powers-exponent",
        "rg-exponent-monomial-power",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "6",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-SSE.A"],
      archetypeIds: ["expression.polynomial-structure"],
      demand:
        "Write a polynomial from its degree, number of terms, leading coefficient and constant term",
      status: "covered",
      templateIds: ["rg-polynomial-build"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "7",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-IF.A"],
      archetypeIds: ["sequence.rule-forms"],
      demand:
        "Choose the explicit rule for a sequence given three terms with a fractional common ratio",
      status: "covered",
      templateIds: ["geometric-rule-forms"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "8",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["S-ID.C"],
      archetypeIds: ["bivariate.scatter", "study.scope"],
      demand:
        "Classify the correlation sign and causal status of a described relationship",
      status: "covered",
      templateIds: [
        "scatter-association-choice",
        "causal-claim-choice",
        "correlation-causation-choice",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "9",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-CED.A"],
      archetypeIds: ["linear.context", "system.context"],
      demand:
        "Choose the one-variable equation for two unknowns with a known total and a known cost",
      status: "covered",
      templateIds: [
        "two-step-equation-model",
        "system-model-value",
        "total-and-cost-equation",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "10",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-IF.A"],
      archetypeIds: ["nonlinear.input-output"],
      demand: "Evaluate a quadratic function at a negative input",
      status: "covered",
      templateIds: ["function-evaluation"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "11",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-APR.B"],
      archetypeIds: ["nonlinear.polynomial-zeros"],
      demand:
        "Find the zeros of a product of a variable and two linear factors, one with a coefficient and a fraction zero",
      status: "covered",
      templateIds: ["zeros-from-factors", "rg-polynomial-zeros-forms"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "12",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-LE.A"],
      archetypeIds: ["exponential.compare-linear"],
      demand:
        "Find the first whole input at which an exponential function exceeds a linear one given both rules",
      status: "covered",
      templateIds: ["exponential-overtakes", "exponential-passes-linear"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "13",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-REI.D"],
      archetypeIds: ["function.rule", "line.slope-equation"],
      demand: "Choose the point-slope equation of the line through two points",
      status: "covered",
      templateIds: [
        "linear-model-equation",
        "graph-equation-choice",
        "point-slope-two-points",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "14",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["S-ID.B"],
      archetypeIds: ["probability.conditional"],
      demand:
        "Find a conditional percent from a two-way table, rounded to the nearest percent",
      status: "covered",
      templateIds: [
        "relative-frequency-percent",
        "two-way-row-percent",
        "two-way-share",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "15",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-REI.B"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Choose the completed-square equation with the same solutions as a quadratic",
      status: "covered",
      templateIds: ["solve-by-completing-square"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "16",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-BF.B"],
      archetypeIds: ["nonlinear.transform"],
      demand:
        "Write the transformed function after a shift right and a shift up, in function notation",
      status: "covered",
      templateIds: ["transform-equation", "shift-function-notation"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "17",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-REI.A"],
      archetypeIds: ["linear.step-justification"],
      demand:
        "Name the property that justifies adding the same value to both sides while completing the square",
      status: "covered",
      templateIds: ["equation-step-property", "complete-square-step-property"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "18",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["S-ID.A"],
      archetypeIds: ["univariate.quartiles"],
      demand: "Find the upper quartile of a listed data set of ten values",
      status: "covered",
      templateIds: [
        "interquartile-range-data",
        "dot-plot-iqr",
        "quartile-list",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "19",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-APR.A"],
      archetypeIds: ["expression.polynomial"],
      demand: "Subtract one quadratic polynomial from another",
      status: "covered",
      templateIds: ["polynomial-subtraction"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "20",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-LE.B"],
      archetypeIds: ["exponential.form"],
      demand:
        "Read the yearly percent increase from an exponential model's base",
      status: "covered",
      templateIds: [
        "compound-growth",
        "structure-meaning",
        "rg-exponential-base-rate",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "21",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["N-Q.A"],
      archetypeIds: ["ratio.units"],
      demand: "Convert rods to inches through yards and feet",
      status: "covered",
      templateIds: ["unit-chain-conversion", "conversion-chain-story"],
      limitations:
        "conversion-chain-story (length-recalled) converts rods through yards and feet to inches, with the 3 feet per yard and 12 inches per foot recalled by the learner; choices are plain numbers, so numeric entry fits.",
    },
    {
      section: "Part I",
      item: {
        number: "22",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["A-REI.B"],
      archetypeIds: ["nonlinear.quadratic"],
      demand:
        "Choose the quadratic-formula solutions of a quadratic with a positive leading coefficient",
      status: "covered",
      templateIds: [
        "quadratic-irrational-solutions",
        "quadratic-formula-positive",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "23",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["F-IF.C"],
      archetypeIds: ["nonlinear.features"],
      demand:
        "Pick the quadratic function whose axis of symmetry is x = -4 from four rules",
      status: "covered",
      templateIds: ["parabola-axis", "parabola-axis-rule"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "24",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.13",
      },
      responseFormat: "choice",
      standards: ["N-RN.B"],
      archetypeIds: ["expression.radical-simplify"],
      demand:
        "Multiply two radicals with whole-number coefficients and write the product in simplest radical form",
      status: "covered",
      templateIds: ["multiply-square-roots"],
      limitations: "",
    },
    {
      section: "Part II",
      item: {
        number: "25",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-APR.A"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Multiply two binomials and write the product as a polynomial in standard form",
      status: "covered",
      templateIds: ["polynomial-multiplication", "polynomial-product-steps"],
      limitations:
        "polynomial-product-steps (structured-work-v1), binomials and squared-binomial forms: the learner types the first, outer and inner products, then enters the coefficients of the product from the highest power down, so standard form is graded exactly and an unexpanded product earns no credit. The partial products are the shown work the rating guide credits.",
    },
    {
      section: "Part II",
      item: {
        number: "26",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["F-IF.C"],
      archetypeIds: ["graph.draw-nonlinear"],
      demand: "Graph an absolute-value function over a stated domain",
      status: "partial",
      templateIds: ["graph-absolute-value-points"],
      limitations:
        "graph-absolute-value-points places three lattice points of an absolute-value function and accepts any three. It does not require the endpoints of a stated domain or the whole V drawn between them, which the rating guide credits.",
    },
    {
      section: "Part II",
      item: {
        number: "27",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-REI.B"],
      archetypeIds: ["inequality.solve"],
      demand:
        "Solve a linear inequality with grouped terms and state the solution",
      status: "covered",
      templateIds: ["solve-justify-inequality", "grouped-linear-inequality"],
      limitations:
        "solve-justify-inequality (structured-work-v1), grouped-right form: the variable on both sides with a product and like terms on the right, solved line by line with the property of inequality for each line, any valid path accepted, ending with the reversed sign after dividing by a negative coefficient. The typed lines are the shown work the rating guide credits.",
    },
    {
      section: "Part II",
      item: {
        number: "28",
        page: "printed p.11; PDF p.11; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-CED.A"],
      archetypeIds: ["linear.literal"],
      demand: "Solve the triangle area formula for its height",
      status: "covered",
      templateIds: ["solve-justify-formula", "formula-isolate"],
      limitations:
        "solve-justify-formula (structured-work-v1) solves A = (1/2)bh for h (or b) line by line, multiplying by 2 and dividing by the positive base, with the property for each line; the final formula is graded by exact symbolic equivalence. The typed lines are the shown work the rating guide credits.",
    },
    {
      section: "Part II",
      item: {
        number: "29",
        page: "printed p.12; PDF p.12; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["F-IF.B"],
      archetypeIds: ["function.average-rate-change"],
      demand:
        "Find the average rate of change of a population table over four decades, rounded to a whole number",
      status: "covered",
      templateIds: [
        "average-rate-display",
        "average-rate-table-rounded",
        "average-rate-steps",
      ],
      limitations:
        "average-rate-steps (structured-work-v1) enters the work as labeled exact steps from a table of five values at equal year steps: the change in the quantity between two years, the change in years and the average rate rounded to the nearest integer. The steps are the shown work the rating guide credits. The item is a two-credit constructed response, labeled constructed because its credit depends on the work.",
    },
    {
      section: "Part II",
      item: {
        number: "30",
        page: "printed p.13; PDF p.13; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["N-RN.B"],
      archetypeIds: ["expression.radical-simplify"],
      demand:
        "Rewrite a fraction with a square-root denominator using a rational denominator",
      status: "partial",
      templateIds: ["rationalize-radical-denominator"],
      limitations:
        "Rationalizing is practiced by choosing the simplified fraction; typing a radical expression is not supported. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part III",
      item: {
        number: "31",
        page: "printed p.14; PDF p.14; standard map rating guide PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["F-IF.B"],
      archetypeIds: ["quadratic.context", "graph.draw-nonlinear"],
      demand:
        "Graph a projectile height function, then state its maximum and the time it lands",
      status: "partial",
      templateIds: ["sat-entry-quadratic-context"],
      limitations:
        "Maximum and landing time are practiced by entry; drawing the parabola is not supported.",
    },
    {
      section: "Part III",
      item: {
        number: "32",
        page: "printed p.15; PDF p.15; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["A-REI.C"],
      archetypeIds: ["nonlinear.system"],
      demand:
        "Solve a system of a line and a parabola algebraically and state both solutions",
      status: "partial",
      templateIds: ["nonlinear-system-solve"],
      limitations:
        "The family asks one coordinate of two integer intersections by entry; stating both ordered pairs is not supported. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part III",
      item: {
        number: "33",
        page: "printed p.16; PDF p.16; standard map rating guide PDF p.13",
      },
      responseFormat: "constructed",
      standards: ["S-ID.C"],
      archetypeIds: [
        "bivariate.regression-compute",
        "bivariate.correlation-coefficient",
      ],
      demand:
        "Find a linear regression and correlation coefficient from a table and say what the coefficient shows",
      status: "partial",
      templateIds: ["correlation-choice"],
      limitations:
        "Correlation strength is read from plots; computing a regression equation or coefficient from data, and writing an interpretation, are not practiced. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part III",
      item: {
        number: "34",
        page: "printed p.17; PDF p.17; standard map rating guide PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["A-REI.D"],
      archetypeIds: ["inequality.graph-region"],
      demand:
        "Graph the region of a system of two linear inequalities and give a point in it",
      status: "partial",
      templateIds: ["half-plane-inequality", "inequality-solution-point"],
      limitations:
        "Families read a shaded region or test points; drawing boundaries and shading is not supported, and the justification is written.",
    },
    {
      section: "Part IV",
      item: {
        number: "35",
        page: "printed p.18; PDF p.18; standard map rating guide PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["A-CED.A"],
      archetypeIds: ["system.context", "system.graph", "line.graph-equation"],
      demand:
        "Write and graph a system for a purchase situation, give the intersection and explain it",
      status: "partial",
      templateIds: ["system-model-value", "graph-linear-equation"],
      limitations:
        "Systems are solved by entry and lines are graphed from equations; writing the system, a graph scaled to the context and a written meaning of the intersection are not practiced.",
    },
  ],
);
