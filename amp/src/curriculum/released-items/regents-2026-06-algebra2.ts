import { defineLedger } from "./types";

/** Every mathematics item of the June 2026 Algebra II Regents Examination
 * (Next Generation Learning Standards), labeled once. Standards are the
 * cluster codes stated in the rating guide's map to the learning standards. */
export const regentsAlgebra2June2026 = defineLedger(
  {
    id: "regents-2026-06-algebra2",
    test: "New York Regents Algebra II",
    form: "June 2026 administration",
    url: "https://www.nysedregents.org/algebratwo/626/algtwo-62026-exam.pdf",
    edition:
      "June 2026 Regents Examination in Algebra II, Next Generation Learning Standards form",
    retrievedAt: "2026-10-26",
    sha256: "41d68c673226ef370a9ca557b042df6fab7e2681db94107fc925c87e4813f413",
    supplements: [
      {
        role: "scoring key",
        url: "https://www.nysedregents.org/algebratwo/626/algtwo-62026-sk.pdf",
        sha256:
          "47fe66c933a4ceca937efff376434c2476ad43f3b363e1a6612eb757aa291387",
      },
      {
        role: "rating guide with map to the learning standards",
        url: "https://www.nysedregents.org/algebratwo/626/algtwo-62026-rg.pdf",
        sha256:
          "1268456ff0bc9debea9f234e8aa2ae52436c344ca96c557a98a4e1b61b859c5e",
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
      standards: ["A-APR.B"],
      archetypeIds: ["nonlinear.polynomial-zeros", "expression.factor"],
      demand:
        "Find a zero of a cubic given in expanded form by factoring by grouping",
      status: "covered",
      templateIds: [
        "zeros-from-factors",
        "polynomial-factoring-patterns",
        "rg-polynomial-zeros-forms",
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
      standards: ["S-CP.A"],
      archetypeIds: ["probability.event-sets"],
      demand: "Write the complement of a set of candidates as a set",
      status: "partial",
      templateIds: ["event-set-count"],
      limitations:
        "The family counts outcomes in unions, intersections and complements; listing the members of a complement is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "3",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-CED.A"],
      archetypeIds: ["inequality.context"],
      demand:
        "Choose the inequality for a fixed cost plus an hourly rate within a budget",
      status: "partial",
      templateIds: ["inequality-from-context"],
      limitations:
        "The family chooses a single bound such as x < c; a rate and fixed cost combined into one inequality is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "4",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-APR.D"],
      archetypeIds: ["expression.polynomial-division"],
      demand:
        "Divide a cubic by x + 1 and write the quotient with the remainder as a fraction",
      status: "partial",
      templateIds: ["polynomial-quotient"],
      limitations:
        "Division is practiced with the quotient and remainder as a pair; the combined quotient plus remainder over the divisor is not.",
    },
    {
      section: "Part I",
      item: {
        number: "5",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["N-RN.A"],
      archetypeIds: ["expression.radical", "expression.exponent-rules"],
      demand:
        "Rewrite a product of a cube root and a coefficient power with a rational exponent",
      status: "partial",
      templateIds: ["symbolic-rational-exponent", "rg-rational-exponent-forms"],
      limitations:
        "The families multiply a coefficient by a power and add exponents; taking the cube root of a perfect-cube coefficient inside the radical, writing a radicand power as a fractional exponent, and adding it to an integer power of the same base is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "6",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-BF.B"],
      archetypeIds: ["nonlinear.transform"],
      demand:
        "Choose the graph of a function after a left shift and a downward shift",
      status: "partial",
      templateIds: ["transform-equation"],
      limitations:
        "The family matches rules to graphs of named parents; selecting among graphs for a generic plotted f is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "7",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-LE.B"],
      archetypeIds: ["exponential.form"],
      demand: "Read the growth rate from an exponential model's base",
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
        number: "8",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-REI.C"],
      archetypeIds: ["nonlinear.system"],
      demand: "Solve a system of a circle equation and a line",
      status: "partial",
      templateIds: ["nonlinear-system-solve"],
      limitations:
        "The system family uses a line and a parabola with integer intersections; a circle is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "9",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-BF.A"],
      archetypeIds: ["sequence.series-sum"],
      demand:
        "Find the sum of the first five terms of a geometric sequence with ratio three fourths",
      status: "partial",
      templateIds: ["geometric-series-sum"],
      limitations:
        "Sampled sums use ratios 2, 3 and one half with integer sums; a fractional ratio with a non-integer sum is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "10",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["S-ID.A"],
      archetypeIds: ["distribution.normal"],
      demand:
        "Estimate a count above a value using a normal model and a calculator",
      status: "partial",
      templateIds: ["normal-model-rule"],
      limitations:
        "The family uses the 68-95-99.7 rule at whole standard deviations; areas at other z-scores need technology.",
    },
    {
      section: "Part I",
      item: {
        number: "11",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-REI.A"],
      archetypeIds: ["nonlinear.rational-radical"],
      demand:
        "Solve a rational equation with two denominators and reject an excluded value",
      status: "partial",
      templateIds: ["rational-extraneous-single", "rational-equation-check"],
      limitations:
        "Families have one variable denominator; combining two denominators with a candidate check is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "12",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-IF.B"],
      archetypeIds: ["nonlinear.features"],
      demand:
        "Pick the true statement about a graphed cubic's end behavior, root multiplicity and intervals",
      status: "partial",
      templateIds: ["polynomial-behavior-description"],
      limitations:
        "The family reads end behavior and crossings from a factored rule; reading them from a graph with intervals of increase is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "13",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-TF.A"],
      archetypeIds: ["circle.angle-units", "circle.unit-trig"],
      demand:
        "Choose the radian measure of an angle shown in standard position",
      status: "partial",
      templateIds: ["unit-circle-coordinate", "degree-radian-conversion"],
      limitations:
        "Families convert angle units and read coordinates; naming the radian measure of a drawn angle in its quadrant is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "14",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-IF.C"],
      archetypeIds: ["trig.sinusoid-features"],
      demand:
        "Compare a graphed sinusoid with a sine rule by maximum and frequency",
      status: "partial",
      templateIds: ["sinusoid-parameters"],
      limitations:
        "The family reads parameters from one rule; comparing a graph with a rule is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "15",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["N-RN.A"],
      archetypeIds: ["expression.exponent-rules", "expression.radical"],
      demand:
        "Rewrite a power of a fraction with a negative exponent in radical form",
      status: "covered",
      templateIds: ["symbolic-rational-exponent", "rg-rational-exponent-forms"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "16",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-SSE.A"],
      archetypeIds: ["expression.factor"],
      demand:
        "Factor a two-variable binomial completely using a common factor and a difference of squares",
      status: "covered",
      templateIds: [
        "greatest-monomial-factor",
        "polynomial-factoring-patterns",
        "rg-factor-completely",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "17",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-BF.A"],
      archetypeIds: ["expression.polynomial"],
      demand: "Multiply two trinomials and combine like terms",
      status: "partial",
      templateIds: ["polynomial-multiplication"],
      limitations:
        "Sampled products reach a binomial times a trinomial; a trinomial times a trinomial is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "18",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["S-IC.B"],
      archetypeIds: ["study.scope"],
      demand:
        "Decide whether a study with random assignment of treatments is observational",
      status: "covered",
      templateIds: ["study-design-choice"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "19",
        page: "printed p.11; PDF p.11; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-BF.B"],
      archetypeIds: ["function.inverse"],
      demand: "Write the inverse of an exponential function",
      status: "partial",
      templateIds: ["inverse-expression", "log-exponential-form"],
      limitations:
        "Inverses are practiced for linear and restricted quadratic functions, and logarithms are translated separately; the inverse of 3^x is not.",
    },
    {
      section: "Part I",
      item: {
        number: "20",
        page: "printed p.11; PDF p.11; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-REI.D"],
      archetypeIds: ["nonlinear.absolute"],
      demand:
        "Find the solutions where an absolute-value function equals a second function",
      status: "partial",
      templateIds: [
        "absolute-value-affine-equation",
        "absolute-value-transformed-equation",
      ],
      limitations:
        "Equations isolate one absolute-value expression with a constant; solving against a second function with several solution sets is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "21",
        page: "printed p.11; PDF p.11; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["N-CN.A"],
      archetypeIds: ["complex.arithmetic"],
      demand:
        "Simplify a sum of terms with variable coefficients and powers of i",
      status: "partial",
      templateIds: ["complex-parts"],
      limitations:
        "The family simplifies single powers of i and writes a+bi; combining several terms with symbolic coefficients is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "22",
        page: "printed p.12; PDF p.12; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-BF.B"],
      archetypeIds: ["function.parity"],
      demand: "Choose the parameters that make a sine function odd",
      status: "partial",
      templateIds: ["fl-even-odd-classify"],
      limitations:
        "The family classifies polynomial functions as even, odd or neither by substituting -x; sine with a parameter in the argument and a vertical shift, and choosing parameters that make it odd, are not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "23",
        page: "printed p.12; PDF p.12; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["F-LE.A"],
      archetypeIds: ["logarithm.solve"],
      demand:
        "Solve a base-10 exponential equation with a coefficient parameter for the variable",
      status: "partial",
      templateIds: ["exponential-log-solution"],
      limitations:
        "The family chooses the logarithmic solution of equations with base e and numeric constants; a symbolic coefficient divided out first is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "24",
        page: "printed p.12; PDF p.12; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["A-SSE.B"],
      archetypeIds: ["exponential.context", "exponential.form"],
      demand: "Choose the decay model from a half-life in hours",
      status: "partial",
      templateIds: [
        "exponential-model-rule",
        "exponential-time-scale",
        "rg-exponential-base-rate",
      ],
      limitations:
        "The number-domain axis (decimal-periods) converts a decimal period such as t/12.4 to one yearly factor rounded to four places and chooses among decimal bases; the half-life is not yet worded in a context with hours.",
    },
    {
      section: "Part II",
      item: {
        number: "25",
        page: "printed p.13; PDF p.13; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["F-IF.A"],
      archetypeIds: ["sequence.recursive"],
      demand:
        "Find the third term of a sequence defined by a nonlinear recursive rule",
      status: "partial",
      templateIds: ["series-recursion", "geometric-sequence-rule"],
      limitations:
        "Families compute terms from linear recursion or are choice-only; a recursion that squares the prior term and adds a constant is not practiced. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part II",
      item: {
        number: "26",
        page: "printed p.14; PDF p.14; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["S-ID.B"],
      archetypeIds: ["bivariate.regression-compute", "bivariate.nonlinear-fit"],
      demand: "Write an exponential regression equation from a data table",
      status: "partial",
      templateIds: ["nonlinear-data-model"],
      limitations:
        "The family chooses a fitting model type; computing the regression equation with technology, rounded to thousandths, is not supported. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part II",
      item: {
        number: "27",
        page: "printed p.15; PDF p.15; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["A-APR.B"],
      archetypeIds: ["expression.polynomial-division"],
      demand: "Find the remainder when a cubic is divided by x - 2",
      status: "covered",
      templateIds: ["remainder-theorem"],
      limitations: "",
    },
    {
      section: "Part II",
      item: {
        number: "28",
        page: "printed p.16; PDF p.16; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["S-ID.A"],
      archetypeIds: ["distribution.normal"],
      demand:
        "Label the mean and three deviations on both sides of a normal curve and state the 68 percent interval",
      status: "partial",
      templateIds: ["normal-model-rule"],
      limitations:
        "The family chooses intervals by the empirical rule; labeling the scale of a normal curve is not supported. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part II",
      item: {
        number: "29",
        page: "printed p.17; PDF p.17; standard map rating guide PDF p.12",
      },
      responseFormat: "graph/drag",
      standards: ["F-IF.B"],
      archetypeIds: ["graph.draw-nonlinear", "nonlinear.polynomial-zeros"],
      demand: "Sketch a cubic from its three zeros and a relative maximum",
      status: "partial",
      templateIds: ["zeros-from-factors", "polynomial-behavior-description"],
      limitations:
        "Families connect zeros and behavior to rules or graphs by choice; sketching the curve is not supported.",
    },
    {
      section: "Part II",
      item: {
        number: "30",
        page: "printed p.18; PDF p.18; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["F-TF.C"],
      archetypeIds: ["circle.unit-trig"],
      demand: "Find tan of an angle from its cosine and the sign of its sine",
      status: "partial",
      templateIds: ["trig-identity-value"],
      limitations:
        "The family finds sine from cosine and a quadrant as a choice; an exact tangent written as a radical expression is not supported. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part II",
      item: {
        number: "31",
        page: "printed p.19; PDF p.19; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["A-REI.B"],
      archetypeIds: ["complex.quadratic"],
      demand: "Find the nonreal roots of a quadratic after collecting terms",
      status: "partial",
      templateIds: ["complex-quadratic-solve"],
      limitations:
        "The family chooses complex solutions; typing roots in simplest a+bi form is not supported. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part II",
      item: {
        number: "32",
        page: "printed p.20; PDF p.20; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["A-SSE.A"],
      archetypeIds: ["expression.rational", "expression.factor"],
      demand:
        "Simplify a rational expression whose numerator is a sum of cubes",
      status: "partial",
      templateIds: [
        "rational-expression-simplify",
        "polynomial-factoring-patterns",
      ],
      limitations:
        "Simplification and cube factoring are practiced separately by choice; typing the simplified expression is not supported. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part III",
      item: {
        number: "33",
        page: "printed p.21; PDF p.21; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["S-CP.A"],
      archetypeIds: ["probability.conditional", "probability.independent"],
      demand:
        "Find a joint and a conditional probability from a two-way table and justify independence",
      status: "partial",
      templateIds: ["conditional-probability-value", "independence-test"],
      limitations:
        "Probabilities and independence are practiced separately; writing the justification is not supported. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part III",
      item: {
        number: "34",
        page: "printed p.22; PDF p.22; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["F-BF.A"],
      archetypeIds: ["exponential.context", "logarithm.solve"],
      demand:
        "Write a monthly-compounding growth function and solve it for time with logarithms",
      status: "partial",
      templateIds: ["exponential-model-value", "compound-growth"],
      limitations:
        "Values and compounding choices are practiced; writing the function and solving for time algebraically are not supported. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part III",
      item: {
        number: "35",
        page: "printed p.23; PDF p.23; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["A-REI.A"],
      archetypeIds: ["nonlinear.rational-radical"],
      demand:
        "Solve an equation with two square-root terms and reject any extraneous value",
      status: "partial",
      templateIds: ["sat-entry-radical-equation", "radical-equation-shifted"],
      limitations:
        "Families solve equations with one radical; two radicals need isolating and squaring twice. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part IV",
      item: {
        number: "36",
        page: "printed p.24; PDF p.24; standard map rating guide PDF p.12",
      },
      responseFormat: "graph/drag",
      standards: ["F-IF.B"],
      archetypeIds: [
        "trig.sinusoid-features",
        "graph.draw-nonlinear",
        "function.average-rate-change",
      ],
      demand:
        "Graph a periodic lung capacity model, find a time for a value and an average rate with its meaning",
      status: "partial",
      templateIds: ["sinusoid-model", "average-rate-formula"],
      limitations:
        "Families choose periodic models and enter average rates; graphing the curve, solving for a time and writing the meaning are not supported.",
    },
  ],
);
