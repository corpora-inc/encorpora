import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2025 STAAR Grade 8 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2025 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staarGrade8 = defineLedger(
  {
    id: "staar-2025-8",
    test: "STAAR Grade 8 mathematics",
    form: "Spring 2025 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-8-rationale.pdf",
    edition:
      "Spring 2025 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "47763fcf5bc7f6828967bef0695de081e77f169e2f3d64941fd48d9b0d4673f1",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-8-answer-key.pdf",
        sha256:
          "c10f2e553d23423e3de1979f35bc453eb753c082715dd3f3c80851c68f43436d",
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
      standards: ["TEKS.8.2.4.B"],
      archetypeIds: ["function.representations"],
      demand:
        "Choose the graph whose slope equals a rate of books read per weeks",
      status: "partial",
      templateIds: ["proportional-graph", "graph-linear-equation"],
      limitations:
        "proportional-graph reads a unit rate from one graph; graph-linear-equation places points by plotting. Choosing among drawn graphs for a stated rate is not practiced.",
    },
    {
      item: {
        number: "2",
        page: "rationale PDF p.2",
      },
      responseFormat: "other",
      standards: ["TEKS.8.4.12.D"],
      archetypeIds: ["finance.simple-interest"],
      demand:
        "Find the simple interest earned over five years and the total, completing two dropdown blanks",
      status: "partial",
      templateIds: ["percent-applications"],
      limitations:
        "STAAR interaction: inline choice, 2 points. percent-applications includes simple interest as a choice question; dropdown blanks and a two-quantity answer have no response protocol.",
    },
    {
      item: {
        number: "3",
        page: "rationale PDF p.3",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.G"],
      archetypeIds: ["function.identify"],
      demand:
        "Choose the set of ordered pairs in which each input has exactly one output",
      status: "covered",
      templateIds: ["relation-function-choice"],
      limitations:
        "The family chooses a list of input-output pairs that is a function.",
    },
    {
      item: {
        number: "4",
        page: "rationale PDF p.4",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.1.2.D"],
      archetypeIds: ["number.real-order"],
      demand:
        "Choose the true inequality among numbers written as signed decimals, fractions and roots",
      status: "covered",
      templateIds: [
        "staar-order-mixed-forms",
        "compare-irrational-values",
        "signed-context-order",
      ],
      limitations:
        "staar-order-mixed-forms chooses the true comparison among signed decimals, fractions and square roots.",
    },
    {
      item: {
        number: "5",
        page: "rationale PDF p.5",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.2.4.C"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Choose both the slope and the y-intercept of the line through two stated points",
      status: "covered",
      templateIds: [
        "staar-line-from-points",
        "line-slope",
        "graphed-line-slope",
      ],
      limitations:
        "staar-line-from-points chooses the slope and y-intercept of the line through two integer points.",
    },
    {
      item: {
        number: "6",
        page: "rationale PDF p.6",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.10.C"],
      archetypeIds: ["transform.rule"],
      demand:
        "Choose the coordinate rule that describes a translation shown on a grid",
      status: "partial",
      templateIds: ["transformation-image", "identify-rigid-motion"],
      limitations:
        "transformation-image finds the image of a vertex and identify-rigid-motion names a motion; writing the (x, y) rule for a translation is not practiced.",
    },
    {
      item: {
        number: "7",
        page: "rationale PDF p.7",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.8.2.5.A"],
      archetypeIds: ["line.graph-equation"],
      demand:
        "Graph a proportional relationship by placing two points, given one point other than the origin",
      status: "covered",
      templateIds: ["graph-linear-equation"],
      limitations:
        "STAAR interaction: graphing, 1 point. The point-plot family graphs a proportional relationship from a given point; STAAR Graphing response is a plotted line.",
    },
    {
      item: {
        number: "8",
        page: "rationale PDF p.8",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.4.5.D"],
      archetypeIds: ["bivariate.linear-fit"],
      demand:
        "Predict weekly revenue for a stated advertising amount from a scatterplot",
      status: "partial",
      templateIds: ["trend-line-predict"],
      limitations:
        "trend-line-predict marks a trend line through two stated points; estimating the line of best fit from the scatter itself is not practiced.",
    },
    {
      item: {
        number: "9",
        page: "rationale PDF p.9",
      },
      responseFormat: "numeric",
      standards: ["TEKS.8.3.7.B"],
      archetypeIds: ["measure.surface"],
      demand:
        "Find a prism's height from its lateral surface area and the perimeter of a triangular base",
      status: "partial",
      templateIds: ["formula-value"],
      limitations:
        "STAAR interaction: equation editor, 1 point. formula-value substitutes into a rearranged formula; finding the base perimeter from a triangle's sides first is not practiced.",
    },
    {
      item: {
        number: "10",
        page: "rationale PDF p.10",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.2.8.C"],
      archetypeIds: ["linear.solve"],
      demand:
        "Solve an equation with a distributed negative coefficient and variables on both sides",
      status: "covered",
      templateIds: [
        "staar-multistep-equations",
        "both-sides-linear-equation",
        "grouped-linear-equation",
      ],
      limitations:
        "staar-multistep-equations solves an equation with a negative factor distributed over a group and variables on both sides, by entry.",
    },
    {
      item: {
        number: "11",
        page: "rationale PDF p.11",
      },
      responseFormat: "other",
      standards: ["TEKS.8.3.10.D"],
      archetypeIds: ["measure.scale"],
      demand:
        "Complete two sentences about how area and perimeter change under a scale factor",
      status: "partial",
      templateIds: ["dilation-scale-factor", "scale-drawing"],
      limitations:
        "STAAR interaction: inline choice, 2 points. Related families find a scale factor or actual lengths; squaring the factor for area and the factor for perimeter through dropdown blanks are not practiced.",
    },
    {
      item: {
        number: "12",
        page: "rationale PDF p.12",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.H"],
      archetypeIds: ["function.proportional-identify"],
      demand:
        "Choose the real situation that describes a proportional relationship",
      status: "partial",
      templateIds: ["proportional-rule-choice", "proportional-graph"],
      limitations:
        "Related families recognize proportional rules or read graphs; identifying a proportional relationship from a situation is not practiced.",
    },
    {
      item: {
        number: "13",
        page: "rationale PDF p.13",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.3.B"],
      archetypeIds: ["measure.scale"],
      demand:
        "Choose the true statement about a dilated triangle and its image from their side lengths",
      status: "partial",
      templateIds: ["dilation-scale-factor"],
      limitations:
        "dilation-scale-factor finds the scale factor by entry; choosing a statement relating image and original lengths is not practiced.",
    },
    {
      item: {
        number: "14",
        page: "rationale PDF p.14",
      },
      responseFormat: "constructed",
      standards: ["TEKS.8.2.8.A"],
      archetypeIds: ["inequality.context"],
      demand:
        "Write the inequality that compares two rental plans with a fixed fee and a per-mile charge",
      status: "partial",
      templateIds: ["inequality-from-context"],
      limitations:
        "STAAR interaction: equation editor, 1 point. inequality-from-context chooses a one-step inequality; typing a two-sided inequality from a story has no response protocol.",
    },
    {
      item: {
        number: "15",
        page: "rationale PDF p.15",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.7.D"],
      archetypeIds: ["coordinate.distance-midpoint"],
      demand:
        "Choose the length of a segment between two plotted points, nearest of several decimal lengths",
      status: "partial",
      templateIds: ["coordinate-distance-exact"],
      limitations:
        "coordinate-distance-exact chooses an exact distance; estimating the nearest decimal length is not practiced.",
    },
    {
      item: {
        number: "16",
        page: "rationale PDF p.16",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.8.2.5.I"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Complete y = mx + b from two points by dragging the slope and intercept",
      status: "partial",
      templateIds: ["line-slope"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. line-slope finds the slope by entry; finding the intercept and placing both by drag and drop have no response protocol.",
    },
    {
      item: {
        number: "17",
        page: "rationale PDF p.17",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.3.C"],
      archetypeIds: ["transform.rule"],
      demand: "Choose the coordinate rule of a dilation centered at the origin",
      status: "partial",
      templateIds: ["dilation-image", "dilation-scale-factor"],
      limitations:
        "Related families find an image or a scale factor; writing the rule (x, y) to (kx, ky) is not practiced.",
    },
    {
      item: {
        number: "18",
        page: "rationale PDF p.18",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.4.5.C"],
      archetypeIds: ["bivariate.scatter"],
      demand:
        "Choose the pair of points that, added to a scatterplot, keep a positive linear pattern",
      status: "partial",
      templateIds: ["scatter-association-choice"],
      limitations:
        "scatter-association-choice names the association shown; extending a plot with points that fit the pattern is not practiced.",
    },
    {
      item: {
        number: "19",
        page: "rationale PDF p.19",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.7.C"],
      archetypeIds: ["triangle.pythagorean"],
      demand:
        "Find the missing leg of a right triangle with a decimal hypotenuse and give the nearest length",
      status: "partial",
      templateIds: ["right-triangle-missing-leg"],
      limitations:
        "right-triangle-missing-leg uses integer right triangles; decimal sides and a nearest-value choice are not practiced.",
    },
    {
      item: {
        number: "20",
        page: "rationale PDF p.20",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.E"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Use a rate of lawns per hours to predict the lawns mowed in a longer time",
      status: "covered",
      templateIds: ["variation-constant"],
      limitations:
        "The family finds the constant of variation and predicts a value.",
    },
    {
      item: {
        number: "21",
        page: "rationale PDF p.21",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.7.A"],
      archetypeIds: ["measure.volume"],
      demand: "Find a sphere's volume in terms of pi from its diameter",
      status: "covered",
      templateIds: ["cone-sphere-volume"],
      limitations: "The family finds sphere volume as a multiple of pi.",
    },
    {
      item: {
        number: "22",
        page: "rationale PDF p.22",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.2.8.C"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Solve for x when two angle measures with fractional coefficients are equal",
      status: "partial",
      templateIds: ["angle-equation"],
      limitations:
        "angle-equation writes and solves angle equations; fractional coefficients of x on both sides are not practiced.",
    },
    {
      item: {
        number: "23",
        page: "rationale PDF p.23",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.8.3.7.C"],
      archetypeIds: ["triangle.pythagorean"],
      demand:
        "Find two missing lengths of a composite right-triangle figure and place them by drag and drop",
      status: "partial",
      templateIds: ["right-triangle-missing-leg"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. right-triangle-missing-leg finds one leg by entry; chaining two missing lengths and dragging values are not practiced.",
    },
    {
      item: {
        number: "24",
        page: "rationale PDF p.24",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.1.2.C"],
      archetypeIds: ["number.scientific-notation"],
      demand: "Write 27 million in scientific notation",
      status: "covered",
      templateIds: ["standard-to-scientific"],
      limitations:
        "The family writes large and small numbers in scientific notation.",
    },
    {
      item: {
        number: "25",
        page: "rationale PDF p.25",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.8.3.6.A"],
      archetypeIds: ["measure.volume"],
      demand:
        "Complete the cylinder-volume equation for a pool by dragging a radius and a depth",
      status: "partial",
      templateIds: ["cylinder-volume"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. cylinder-volume finds volume or height by entry; assembling the volume equation from parts by drag and drop has no response protocol.",
    },
    {
      item: {
        number: "26",
        page: "rationale PDF p.26",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.4.12.D"],
      archetypeIds: ["finance.simple-interest"],
      demand:
        "Find how much more interest compound earns than simple at the same rate",
      status: "partial",
      templateIds: ["percent-applications", "compound-growth"],
      limitations:
        "percent-applications covers simple interest and compound-growth covers growth models; the difference between simple and compound interest at one rate is not practiced.",
    },
    {
      item: {
        number: "27",
        page: "rationale PDF p.27",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.6.C"],
      archetypeIds: ["triangle.pythagorean"],
      demand:
        "Find the side of the square on the hypotenuse of a right triangle whose two other sides carry squares",
      status: "partial",
      templateIds: ["right-triangle", "right-triangle-missing-leg"],
      limitations:
        "Related families find a side of a right triangle; relating squares drawn on the sides is not practiced.",
    },
    {
      item: {
        number: "28",
        page: "rationale PDF p.28",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.2.4.B"],
      archetypeIds: ["function.representations"],
      demand: "Choose the line whose slope is a stated speed in miles per hour",
      status: "partial",
      templateIds: ["proportional-graph", "graph-linear-equation"],
      limitations:
        "proportional-graph reads a unit rate from one graph; choosing among drawn lines for a stated speed is not practiced.",
    },
    {
      item: {
        number: "29",
        page: "rationale PDF p.29",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.3.C"],
      archetypeIds: ["transform.rule"],
      demand: "Choose the coordinate rule of a dilation shown on a grid",
      status: "partial",
      templateIds: ["dilation-image", "dilation-scale-factor"],
      limitations:
        "Related families find an image or a scale factor; writing the rule (x, y) to (kx, ky) is not practiced.",
    },
    {
      item: {
        number: "30",
        page: "rationale PDF p.30",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.8.2.4.C"],
      archetypeIds: ["function.rule"],
      demand:
        "Find an hourly wage and a uniform cost from a table of pay and hours and place both by drag and drop",
      status: "partial",
      templateIds: ["unequal-step-rate", "recover-linear-intercept"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. Related families find a rate from unequal steps and the output at zero; a table with a negative initial amount and drag and drop have no response protocol.",
    },
    {
      item: {
        number: "31",
        page: "rationale PDF p.31",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.4.5.D"],
      archetypeIds: ["bivariate.linear-fit"],
      demand: "Predict a value of y at x = 10 from a scatterplot",
      status: "partial",
      templateIds: ["trend-line-predict"],
      limitations:
        "trend-line-predict marks a trend line through two stated points; estimating the line of best fit from the scatter itself is not practiced.",
    },
    {
      item: {
        number: "32",
        page: "rationale PDF p.32",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.8.3.10.C"],
      archetypeIds: ["transform.rule"],
      demand:
        "Match each transformation in a table to its coordinate rule (a reflection and a rotation) by drag and drop",
      status: "partial",
      templateIds: ["transformation-image", "identify-rigid-motion"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. Related families find images or name motions; writing the (x, y) rule of a reflection or rotation and drag and drop are not practiced.",
    },
    {
      item: {
        number: "33",
        page: "rationale PDF p.33",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.G"],
      archetypeIds: ["function.identify"],
      demand: "Choose the statement that a graph shows y as a function of x",
      status: "partial",
      templateIds: ["relation-function-choice"],
      limitations:
        "relation-function-choice uses lists of pairs; reading a graph for the vertical line test is not practiced.",
    },
    {
      item: {
        number: "34",
        page: "rationale PDF p.34",
      },
      responseFormat: "other",
      standards: ["TEKS.8.4.12.A"],
      archetypeIds: ["finance.simple-interest"],
      demand:
        "Compare simple interest on two loan offers and say which bank costs less and by how much, with dropdown blanks",
      status: "partial",
      templateIds: ["percent-applications"],
      limitations:
        "STAAR interaction: inline choice, 2 points. percent-applications includes simple interest; comparing two offers and dropdown blanks are not practiced.",
    },
    {
      item: {
        number: "35",
        page: "rationale PDF p.35",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.7.A"],
      archetypeIds: ["measure.volume"],
      demand: "Find a cone's base diameter from its volume and height",
      status: "partial",
      templateIds: ["cone-sphere-volume"],
      limitations:
        "cone-sphere-volume finds volume from dimensions; the inverse, a diameter from a volume, is not practiced.",
    },
    {
      item: {
        number: "36",
        page: "rationale PDF p.36",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.F"],
      archetypeIds: ["function.proportional-identify"],
      demand:
        "Choose the true statement that an equation with an intercept is not proportional",
      status: "partial",
      templateIds: ["proportional-rule-choice"],
      limitations:
        "proportional-rule-choice selects the proportional rule; judging statements about one equation is not practiced.",
    },
    {
      item: {
        number: "37",
        page: "rationale PDF p.37",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.7.B"],
      archetypeIds: ["measure.surface"],
      demand:
        "Find the total surface area of a rectangular prism from its dimensions using the perimeter formula",
      status: "partial",
      templateIds: ["net-surface-area"],
      limitations:
        "net-surface-area adds the faces of a net; computing from a labeled prism with the formula S = Ph + 2B is not practiced.",
    },
    {
      item: {
        number: "38",
        page: "rationale PDF p.38",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.1.2.D"],
      archetypeIds: ["number.real-order"],
      demand:
        "Choose the list of a fraction, a percent, a decimal and a root in order from least to greatest",
      status: "covered",
      templateIds: ["staar-order-mixed-forms", "compare-irrational-values"],
      limitations:
        "staar-order-mixed-forms orders a fraction, a percent, a decimal and a square root from least to greatest by choice.",
    },
    {
      item: {
        number: "39",
        page: "rationale PDF p.39",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.3.10.B"],
      archetypeIds: ["transformation.invariants"],
      demand: "Choose the transformation that does not preserve congruence",
      status: "covered",
      templateIds: ["transformation-invariant-claims"],
      limitations:
        "The family decides which transformations preserve distance and angle measure.",
    },
    {
      item: {
        number: "40",
        page: "rationale PDF p.40",
      },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.I"],
      archetypeIds: ["function.rule"],
      demand:
        "Choose the function for total cost from a fixed cost and a per-product rate",
      status: "covered",
      templateIds: ["linear-model-equation"],
      limitations:
        "The family chooses the equation separating a starting amount from a rate.",
    },
  ],
);
