import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2024 STAAR Grade 8 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2024 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staar2024Grade8 = defineLedger(
  {
    id: "staar-2024-8",
    test: "STAAR Grade 8 mathematics",
    form: "Spring 2024 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-8-math-rationale.pdf",
    edition:
      "Spring 2024 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "9e6dcbbb7cbe79be61a2eaf0222c052ecbec456f4d42e6905aa5cd5c42732170",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-8-math-answer-key.pdf",
        sha256:
          "8a59842fe9693ea3bcd40f277b58babc63c0bc162251389482e6eb4255688f15",
      },
    ],
    complete: true,
  },
  {
    labeledBy: "agent:staar-2024-first-pass",
    labeledAt: "2026-10-26",
    section: "Test form",
  },
  [
    {
      item: { number: "1", page: "rationale PDF p.1" },
      responseFormat: "choice",
      standards: ["TEKS.8.3.7.A"],
      archetypeIds: ["measure.volume"],
      demand:
        "Find the volume in cubic millimeters of a marble from its diameter",
      status: "partial",
      templateIds: ["cone-sphere-volume"],
      limitations:
        "cone-sphere-volume in its approximate mode takes pi as 3.14 and gives the volume as a decimal from a sphere's radius or even diameter; the item's odd diameter of 13 mm, a radius of 6.5, and a closest-value choice are not practiced.",
    },
    {
      item: { number: "2", page: "rationale PDF p.2" },
      responseFormat: "choice",
      standards: ["TEKS.8.1.2.D"],
      archetypeIds: ["number.real-order"],
      demand: "Order a root, a fraction and a decimal from greatest to least",
      status: "covered",
      templateIds: ["staar-order-mixed-forms", "compare-irrational-values"],
      limitations:
        "staar-order-mixed-forms and compare-irrational-values order roots, fractions and decimals by choice.",
    },
    {
      item: { number: "3", page: "rationale PDF p.3" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.G"],
      archetypeIds: ["function.identify"],
      demand: "Choose the graph that does not show y as a function of x",
      status: "partial",
      templateIds: ["relation-function-choice"],
      limitations:
        "relation-function-choice identifies a relation given by pairs; a graph with one input matched to two outputs is not practiced.",
    },
    {
      item: { number: "4", page: "rationale PDF p.4" },
      responseFormat: "choice",
      standards: ["TEKS.8.4.5.D"],
      archetypeIds: ["bivariate.linear-fit"],
      demand:
        "Predict the minutes to read a ninety-page report from a scatterplot",
      status: "partial",
      templateIds: ["trend-line-predict"],
      limitations:
        "trend-line-predict finds a trend line's slope from two marked points to predict; drawing a line of best fit through a scatterplot is not practiced.",
    },
    {
      item: { number: "5", page: "rationale PDF p.5" },
      responseFormat: "graph/drag",
      standards: ["TEKS.8.2.5.I"],
      archetypeIds: ["line.slope-equation", "function.rule"],
      demand:
        "Drag the slope and intercept to write the line through two points",
      status: "covered",
      templateIds: ["inline-linear-features", "line-slope"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. inline-linear-features completes slope and intercept choices for a line from two points in a multi-part choice that accepts drag-into-slot responses.",
    },
    {
      item: { number: "6", page: "rationale PDF p.6" },
      responseFormat: "choice",
      standards: ["TEKS.8.3.3.A"],
      archetypeIds: ["measure.scale", "triangle.relationships"],
      demand: "Choose the true proportion for two similar quadrilaterals",
      status: "partial",
      templateIds: ["similar-triangles-side"],
      limitations:
        "similar-triangles-side finds a side of a similar triangle by entry; choosing the proportion for similar quadrilaterals is not practiced.",
    },
    {
      item: { number: "7", page: "rationale PDF p.7" },
      responseFormat: "choice",
      standards: ["TEKS.8.4.12.C"],
      archetypeIds: ["exponential.context"],
      demand:
        "Choose the statement about each year's ending balance with two percent interest and a yearly deposit",
      status: "partial",
      templateIds: ["compound-growth"],
      limitations:
        "compound-growth uses periodic compounding; a balance with a repeated deposit is not practiced.",
    },
    {
      item: { number: "8", page: "rationale PDF p.8" },
      responseFormat: "choice",
      standards: ["TEKS.8.3.7.B"],
      archetypeIds: ["measure.surface"],
      demand:
        "Find the surface area of a triangular prism from its drawn dimensions",
      status: "partial",
      templateIds: ["net-surface-area"],
      limitations:
        "net-surface-area adds the face areas of a net; applying a surface-area formula to a prism drawn with its base triangle is not practiced.",
    },
    {
      item: { number: "9", page: "rationale PDF p.9" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.8.A"],
      archetypeIds: ["inequality.context"],
      demand:
        "Choose the inequality for when a draining tank holds more water than a filling pool",
      status: "partial",
      templateIds: ["inequality-context-bound", "first-cheaper-whole-input"],
      limitations:
        "inequality-context-bound chooses a one-sided inequality for a stated condition; comparing two changing amounts is not practiced.",
    },
    {
      item: { number: "10", page: "rationale PDF p.10" },
      responseFormat: "graph/drag",
      standards: ["TEKS.8.3.3.C"],
      archetypeIds: ["transform.rule"],
      demand:
        "Drag terms to write the coordinate rule of a dilation from a vertex and its image",
      status: "covered",
      templateIds: ["dilation-rule-slots", "dilation-image"],
      limitations:
        "dilation-rule-slots completes the rule (x, y) to (kx, ky) of a dilation about the origin from a vertex and its image. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "11", page: "rationale PDF p.11" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.4.B"],
      archetypeIds: ["function.representations"],
      demand:
        "Choose the graph whose slope shows ounces of ink used per minute",
      status: "covered",
      templateIds: [
        "proportional-graph",
        "graph-linear-equation",
        "graph-of-proportional-rate",
      ],
      limitations:
        "graph-of-proportional-rate chooses the graph whose slope is a stated rate in context, among lines that start above zero, invert the rate or use the total as the rate.",
    },
    {
      item: { number: "12", page: "rationale PDF p.12" },
      responseFormat: "choice",
      standards: ["TEKS.8.3.6.A"],
      archetypeIds: ["measure.volume"],
      demand:
        "Choose the equation that gives the volume of a swimming pool shaped like a cylinder",
      status: "partial",
      templateIds: ["cylinder-volume"],
      limitations:
        "cylinder-volume finds a volume in terms of pi by entry; the choices here are equations with a substituted radius and height.",
    },
    {
      item: { number: "13", page: "rationale PDF p.13" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.F"],
      archetypeIds: ["function.proportional-identify"],
      demand:
        "Choose the representation that describes a proportional relationship from a graph through the origin with slope three and a half",
      status: "partial",
      templateIds: ["proportional-graph", "proportional-rule-choice"],
      limitations:
        "proportional-graph reads a unit rate from a graph and proportional-rule-choice recognizes rules; deciding from a graph with a decimal slope among several representations is not practiced.",
    },
    {
      item: { number: "14", page: "rationale PDF p.14" },
      responseFormat: "graph/drag",
      standards: ["TEKS.8.3.8.D"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Drag values for three angles of a figure made from triangles and a straight line",
      status: "partial",
      templateIds: ["triangle-angle-sum", "angle-pair-measure"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. triangle-angle-sum and angle-pair-measure find single angles by entry; placing three related angles by drag and drop has no multi-part family.",
    },
    {
      item: { number: "15", page: "rationale PDF p.15" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.4.C"],
      archetypeIds: ["line.slope-equation", "function.rule"],
      demand: "Find the starting number of bottles from two observations",
      status: "covered",
      templateIds: ["staar-line-from-points"],
      limitations:
        "staar-line-from-points chooses the slope and y-intercept of the line through two points.",
    },
    {
      item: { number: "16", page: "rationale PDF p.16" },
      responseFormat: "choice",
      standards: ["TEKS.8.4.12.D"],
      archetypeIds: ["finance.simple-interest"],
      demand:
        "Find the difference between the balances of two accounts after four years",
      status: "partial",
      templateIds: ["percent-applications", "compound-growth"],
      limitations:
        "percent-applications finds one simple-interest rate or amount and compound-growth compounds periodically; combining the balances of a simple and a second account is not practiced.",
    },
    {
      item: { number: "17", page: "rationale PDF p.17" },
      responseFormat: "other",
      standards: ["TEKS.8.3.10.B"],
      archetypeIds: ["transformation.invariants"],
      demand:
        "Mark which transformations preserve congruence for a table of rules",
      status: "covered",
      templateIds: [
        "congruence-claims-table",
        "transformation-invariant-claims",
      ],
      limitations:
        "congruence-claims-table marks four or five coordinate rules as preserving congruence or not. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "18", page: "rationale PDF p.18" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.8.C"],
      archetypeIds: ["linear.solve"],
      demand:
        "Solve the equation shown by algebra tiles with variable tiles on both sides",
      status: "partial",
      templateIds: ["both-sides-linear-equation"],
      limitations:
        "both-sides-linear-equation solves a written equation; reading the equation from drawn tiles and a fractional solution are not practiced.",
    },
    {
      item: { number: "19", page: "rationale PDF p.19" },
      responseFormat: "choice",
      standards: ["TEKS.8.3.7.C"],
      archetypeIds: ["triangle.pythagorean"],
      demand:
        "Find the length of a roof as the hypotenuse of a right triangle to the nearest foot",
      status: "covered",
      templateIds: ["right-triangle"],
      limitations:
        "right-triangle with hypotenuse=nearest-whole gives two legs whose hypotenuse is irrational and asks for it to the nearest whole number; the roof setting is not stated.",
    },
    {
      item: { number: "20", page: "rationale PDF p.20" },
      responseFormat: "choice",
      standards: ["TEKS.8.3.10.C"],
      archetypeIds: ["transform.rule"],
      demand:
        "Choose the coordinate rule for a three-unit translation to the right",
      status: "partial",
      templateIds: ["transformation-image", "identify-rigid-motion"],
      limitations:
        "transformation-image and identify-rigid-motion find an image and name a motion; writing the coordinate rule of a translation is not practiced.",
    },
    {
      item: { number: "21", page: "rationale PDF p.21" },
      responseFormat: "multi-select",
      standards: ["TEKS.8.2.5.G"],
      archetypeIds: ["function.identify"],
      demand:
        "Select the ordered pairs that can be added to keep a graph a function",
      status: "covered",
      templateIds: ["relation-function-choice", "function-pair-select"],
      limitations:
        "function-pair-select graphs a relation that is a function and selects the two or three ordered pairs, among five, that can be added so that the graph is still a function.",
    },
    {
      item: { number: "22", page: "rationale PDF p.22" },
      responseFormat: "choice",
      standards: ["TEKS.8.3.7.D"],
      archetypeIds: ["coordinate.distance-midpoint"],
      demand:
        "Find the distance between two plotted points whose legs are five and five",
      status: "covered",
      templateIds: ["coordinate-distance", "coordinate-distance-exact"],
      limitations:
        "coordinate-distance-exact with answer-form=nearest-tenth or nearest-hundredth asks the distance between two plotted points as a rounded decimal chosen among decimal lengths; equal legs such as 5 and 5 occur.",
    },
    {
      item: { number: "23", page: "rationale PDF p.23" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.E"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Find y when x is two and three quarters from a direct variation with fractional values",
      status: "covered",
      templateIds: ["variation-constant"],
      limitations:
        "variation-constant with values=fractional gives a direct variation with mixed-number inputs and a fractional constant and asks for the value at a new mixed-number input.",
    },
    {
      item: { number: "24", page: "rationale PDF p.24" },
      responseFormat: "choice",
      standards: ["TEKS.8.4.12.D"],
      archetypeIds: ["finance.simple-interest", "percent.of"],
      demand:
        "Find the closest account balance after two years of simple interest",
      status: "covered",
      templateIds: ["percent-applications"],
      limitations:
        "percent-applications asks how much is in an account after 2 to 5 years of simple interest on the amount deposited, so the balance is the principal plus the interest. The template is linked to the percent archetype, which this row now also lists.",
      labeledBy: "agent:stale-shown-work-relabel",
      labeledAt: "2026-10-27",
    },
    {
      item: { number: "25", page: "rationale PDF p.25" },
      responseFormat: "numeric",
      standards: ["TEKS.8.3.7.B"],
      archetypeIds: ["measure.surface"],
      demand:
        "Find the surface area of a toy box using the perimeter and area of its rectangular base",
      status: "partial",
      templateIds: ["net-surface-area"],
      limitations:
        "STAAR interaction: equation editor. net-surface-area adds face areas from a net; applying the prism formula with the base perimeter has no family.",
    },
    {
      item: { number: "26", page: "rationale PDF p.26" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.H"],
      archetypeIds: ["function.linear-test"],
      demand: "Choose the equation that describes a proportional relationship",
      status: "covered",
      templateIds: ["proportional-rule-choice"],
      limitations:
        "proportional-rule-choice recognizes a rule of the form y equals kx among affine rules, including fractional constants.",
    },
    {
      item: { number: "27", page: "rationale PDF p.27" },
      responseFormat: "choice",
      standards: ["TEKS.8.1.2.C"],
      archetypeIds: ["number.scientific-notation"],
      demand: "Write 15,300 in scientific notation",
      status: "covered",
      templateIds: ["standard-to-scientific"],
      limitations:
        "standard-to-scientific writes a large or small number in scientific notation by choice.",
    },
    {
      item: { number: "28", page: "rationale PDF p.28" },
      responseFormat: "choice",
      standards: ["TEKS.8.3.3.C"],
      archetypeIds: ["transform.rule"],
      demand:
        "Choose the rule that describes a dilation centered at the origin",
      status: "partial",
      templateIds: ["dilation-image", "dilation-scale-factor"],
      limitations:
        "dilation-image and dilation-scale-factor find an image and the scale factor; writing the coordinate rule of a dilation is not practiced.",
    },
    {
      item: { number: "29", page: "rationale PDF p.29" },
      responseFormat: "other",
      standards: ["TEKS.8.2.4.C"],
      archetypeIds: ["line.slope-equation", "function.rule"],
      demand:
        "Complete the slope and y-intercept of a linear relationship given as a table",
      status: "covered",
      templateIds: ["inline-linear-features"],
      limitations:
        "STAAR interaction: inline choice. inline-linear-features completes slope and intercept dropdowns from a table, graph or two points.",
    },
    {
      item: { number: "30", page: "rationale PDF p.30" },
      responseFormat: "choice",
      standards: ["TEKS.8.3.7.A"],
      archetypeIds: ["measure.volume"],
      demand:
        "Find the volume of a cone with radius twelve and height eighteen",
      status: "covered",
      templateIds: ["cone-sphere-volume"],
      limitations:
        "cone-sphere-volume gives a cone's volume in terms of pi from its radius or diameter and height.",
    },
    {
      item: { number: "31", page: "rationale PDF p.31" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.I"],
      archetypeIds: ["function.rule", "line.slope-equation"],
      demand:
        "Choose the equation for the total charge of a delivery with a fee and a cost per cookie",
      status: "covered",
      templateIds: ["linear-model-equation"],
      limitations:
        "linear-model-equation chooses the equation for a situation told in words, a graph or a table with a starting amount.",
    },
    {
      item: { number: "32", page: "rationale PDF p.32" },
      responseFormat: "choice",
      standards: ["TEKS.8.4.5.C"],
      archetypeIds: ["bivariate.scatter"],
      demand: "Choose the scatterplot that shows a nonlinear relationship",
      status: "partial",
      templateIds: ["scatter-association-choice"],
      limitations:
        "scatter-association-choice classifies the pattern of a given scatterplot; choosing the plot with a stated pattern is not practiced.",
    },
    {
      item: { number: "33", page: "rationale PDF p.33" },
      responseFormat: "graph/drag",
      standards: ["TEKS.8.3.7.C"],
      archetypeIds: ["triangle.pythagorean"],
      demand:
        "Drag each set of side lengths to right triangle or not a right triangle",
      status: "covered",
      templateIds: ["pythagorean-sort-table", "pythagorean-converse"],
      limitations:
        "pythagorean-sort-table marks four or five sets of side lengths as a right triangle or not, with scaled triples and near misses. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "34", page: "rationale PDF p.34" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.5.A"],
      archetypeIds: [
        "function.proportional-identify",
        "pattern.graph-relationship",
      ],
      demand: "Choose the graph or table showing y equals negative two x",
      status: "partial",
      templateIds: ["proportional-graph", "graph-linear-equation"],
      limitations:
        "proportional-graph reads a graph and graph-linear-equation places points; choosing the representation of a rule with a negative constant is not practiced.",
    },
    {
      item: { number: "35", page: "rationale PDF p.35" },
      responseFormat: "choice",
      standards: ["TEKS.8.3.10.C"],
      archetypeIds: ["transform.rule"],
      demand:
        "Choose the coordinate rule of a 270 degree rotation about the origin",
      status: "partial",
      templateIds: ["identify-rigid-motion", "transformation-image"],
      limitations:
        "identify-rigid-motion and transformation-image name a motion or find an image; writing the coordinate rule of a rotation is not practiced.",
    },
    {
      item: { number: "36", page: "rationale PDF p.36" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.4.A"],
      archetypeIds: ["line.slope-points"],
      demand:
        "Find a point on a line through a vertex using the slope of two given points",
      status: "partial",
      templateIds: ["line-slope", "graphed-line-slope"],
      limitations:
        "line-slope and graphed-line-slope find a slope; using it to locate another point on a line is not practiced.",
    },
    {
      item: { number: "37", page: "rationale PDF p.37" },
      responseFormat: "multi-select",
      standards: ["TEKS.8.1.2.D"],
      archetypeIds: ["number.real-order"],
      demand: "Select the numbers greater than pi",
      status: "covered",
      templateIds: [
        "compare-irrational-values",
        "staar-order-mixed-forms",
        "compare-to-pi-select",
      ],
      limitations:
        "compare-to-pi-select selects the two or three of five numbers, among decimals, fractions and square roots, that are greater than pi, or less than pi or than a square root.",
    },
    {
      item: { number: "38", page: "rationale PDF p.38" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.8.C"],
      archetypeIds: ["linear.solve"],
      demand:
        "Solve an equation with like terms to combine and the variable on both sides",
      status: "covered",
      templateIds: ["both-sides-linear-equation", "staar-multistep-equations"],
      limitations:
        "both-sides-linear-equation and staar-multistep-equations solve equations with variables on both sides; the choices are plain numbers.",
    },
    {
      item: { number: "39", page: "rationale PDF p.39" },
      responseFormat: "choice",
      standards: ["TEKS.8.4.5.D"],
      archetypeIds: ["bivariate.linear-fit"],
      demand:
        "Predict the cookies eaten for forty-five guests from a scatterplot",
      status: "partial",
      templateIds: ["trend-line-predict"],
      limitations:
        "trend-line-predict finds a trend line's slope from two marked points to predict; drawing a line through a scatterplot is not practiced.",
    },
    {
      item: { number: "40", page: "rationale PDF p.40" },
      responseFormat: "choice",
      standards: ["TEKS.8.2.4.B"],
      archetypeIds: ["function.representations"],
      demand: "Choose the graph whose slope shows cabinets painted per hour",
      status: "covered",
      templateIds: [
        "proportional-graph",
        "graph-linear-equation",
        "graph-of-proportional-rate",
      ],
      limitations:
        "graph-of-proportional-rate chooses the graph whose slope is a stated rate in context, among lines that start above zero, invert the rate or use the total as the rate.",
    },
  ],
);
