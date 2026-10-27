import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2024 STAAR Grade 4 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2024 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staar2024Grade4 = defineLedger(
  {
    id: "staar-2024-4",
    test: "STAAR Grade 4 mathematics",
    form: "Spring 2024 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-4-math-rationale.pdf",
    edition:
      "Spring 2024 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "11d35c4bf3993f50fc985e5dde3dd3e199bed1a033ce151d546cd6c2f683e76f",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-4-math-answer-key.pdf",
        sha256:
          "f8bf2b89d26473125cce5931a36e4312ebae54a3c4c9c1225c7bb8cd05ae39e9",
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
      standards: ["TEKS.4.4.9.A"],
      archetypeIds: ["univariate.displays"],
      demand:
        "Choose the dot plot that matches a listed set of fractional measurements",
      status: "partial",
      templateIds: ["line-plot-whole", "staar-dot-plot-threshold"],
      limitations:
        "line-plot-whole and staar-dot-plot-threshold read counts from a dot plot; no family chooses the plot that matches a data list, and the values include halves.",
    },
    {
      item: { number: "2", page: "rationale PDF p.2" },
      responseFormat: "graph/drag",
      standards: ["TEKS.4.1.2.A"],
      archetypeIds: ["number.place-value-ratio"],
      demand:
        "Mark every number in which the circled digit is worth ten times the underlined digit",
      status: "partial",
      templateIds: ["digit-value-ratio"],
      limitations:
        "STAAR interaction: hot spot, 2 points. digit-value-ratio finds the factor between two places of one number; selecting the matching numbers from a set by hot spot has no response protocol.",
    },
    {
      item: { number: "3", page: "rationale PDF p.3" },
      responseFormat: "choice",
      standards: ["TEKS.4.3.8.C"],
      archetypeIds: ["money.count-coins", "money.change"],
      demand:
        "Add the value of three kinds of coins pictured to a jar's starting amount",
      status: "partial",
      templateIds: ["coin-total", "decimal-money-change"],
      limitations:
        "coin-total counts at most eight coins and decimal-money-change adds and subtracts amounts; no family counts thirteen mixed coins and adds a starting amount.",
    },
    {
      item: { number: "4", page: "rationale PDF p.4" },
      responseFormat: "choice",
      standards: ["TEKS.4.2.4.H"],
      archetypeIds: ["whole.multi-step-stories"],
      demand:
        "Divide ribbons into bows and bows into boxes to find the number of boxes",
      status: "covered",
      templateIds: ["staar-multistep-stories"],
      limitations:
        "staar-multistep-stories solves share-then-regroup stories with whole numbers; the choices are plain numbers.",
    },
    {
      item: { number: "5", page: "rationale PDF p.5" },
      responseFormat: "choice",
      standards: ["TEKS.4.1.2.G"],
      archetypeIds: ["number.decimal-fraction-equivalent"],
      demand: "Rename a fraction of tenths greater than one as a decimal",
      status: "covered",
      templateIds: ["staar-rename-percent-fraction-decimal"],
      limitations:
        "staar-rename-percent-fraction-decimal chooses the decimal for a fraction greater than one.",
    },
    {
      item: { number: "6", page: "rationale PDF p.6" },
      responseFormat: "graph/drag",
      standards: ["TEKS.4.3.6.A"],
      archetypeIds: ["line.terms"],
      demand:
        "Drag labels to name a figure with one endpoint a ray and a figure with an arrow on each end a line",
      status: "partial",
      templateIds: ["line-ray-segment"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. line-ray-segment names a line, ray or segment from its ends; matching two named figures by drag and drop has no multi-part family.",
    },
    {
      item: { number: "7", page: "rationale PDF p.7" },
      responseFormat: "choice",
      standards: ["TEKS.4.2.5.A"],
      archetypeIds: ["number.strip-diagram"],
      demand:
        "Choose the strip diagram that shows a total split into a used part and two equal remaining shares",
      status: "partial",
      templateIds: ["strip-diagram-match"],
      limitations:
        "strip-diagram-match reads a drawn strip diagram of a used part and equal shares and chooses the story or equation; choosing the strip diagram for a story is not practiced.",
    },
    {
      item: { number: "8", page: "rationale PDF p.9" },
      responseFormat: "choice",
      standards: ["TEKS.4.1.3.D"],
      archetypeIds: ["fractions.compare"],
      demand:
        "Choose the fraction greater than a given fraction from four choices",
      status: "covered",
      templateIds: ["fraction-choice-compare"],
      limitations:
        "fraction-choice-compare picks the one of four fractions with denominators 3 to 12 that is greater or less than a stated proper fraction.",
    },
    {
      item: { number: "9", page: "rationale PDF p.10" },
      responseFormat: "choice",
      standards: ["TEKS.4.3.5.D"],
      archetypeIds: ["measure.area"],
      demand: "Find a square's area from its perimeter",
      status: "covered",
      templateIds: [
        "staar-measure-chains",
        "rectangle-area",
        "perimeter-area-chain",
      ],
      limitations:
        "perimeter-area-chain finds a square's side from its perimeter and then its area, and the reverse; choices are plain numbers, so numeric entry fits.",
    },
    {
      item: { number: "10", page: "rationale PDF p.11" },
      responseFormat: "choice",
      standards: ["TEKS.4.2.5.B"],
      archetypeIds: ["pattern.paired"],
      demand: "Choose the table that follows a subtract-four rule",
      status: "covered",
      templateIds: ["staar-table-rule-choice"],
      limitations:
        "staar-table-rule-choice with rule=subtract offers four tables for a stated rule y = x - k (k from 1 to 6); one table follows the rule in every column.",
    },
    {
      item: { number: "11", page: "rationale PDF p.12" },
      responseFormat: "graph/drag",
      standards: ["TEKS.4.1.2.B"],
      archetypeIds: ["number.expanded-form-whole"],
      demand:
        "Drag place values to write a decimal with thousands and tenths as an expanded sum",
      status: "covered",
      templateIds: ["expanded-decimal-slots", "expanded-decimal"],
      limitations:
        "expanded-decimal-slots builds the sum of the values of the nonzero digits of a decimal with thousands to hundredths. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "12", page: "rationale PDF p.13" },
      responseFormat: "choice",
      standards: ["TEKS.4.2.4.B"],
      archetypeIds: ["place.powers-of-ten"],
      demand: "Multiply a six-digit number by 100",
      status: "covered",
      templateIds: ["multiply-power-of-ten"],
      limitations:
        "multiply-power-of-ten multiplies a whole number by 10, 100 or 1,000; the choices are plain numbers.",
    },
    {
      item: { number: "13", page: "rationale PDF p.14" },
      responseFormat: "choice",
      standards: ["TEKS.4.3.7.C"],
      archetypeIds: ["angle.measure"],
      demand:
        "Choose the drawn angle that measures ninety-five degrees on a protractor",
      status: "partial",
      templateIds: ["protractor-reading"],
      limitations:
        "protractor-reading reads one angle by entry; choosing among four drawn angles on two scales is not practiced.",
    },
    {
      item: { number: "14", page: "rationale PDF p.15" },
      responseFormat: "numeric",
      standards: ["TEKS.4.2.3.E"],
      archetypeIds: ["fractions.model"],
      demand:
        "Enter the fraction of a pictured group of shirts that are in two of its three kinds",
      status: "partial",
      templateIds: ["fraction-model", "fraction-unit-count"],
      limitations:
        "STAAR interaction: equation editor. fraction-model and fraction-unit-count express shaded parts of one whole; no family forms a fraction from the counts of a pictured group with several kinds.",
    },
    {
      item: { number: "15", page: "rationale PDF p.16" },
      responseFormat: "choice",
      standards: ["TEKS.4.4.9.B"],
      archetypeIds: ["data.stem-leaf-read", "univariate.displays"],
      demand:
        "Find the difference between the greatest and least values of a one-decimal stem-and-leaf plot",
      status: "covered",
      templateIds: ["stem-leaf-read"],
      limitations:
        "stem-leaf-read reads extremes and the range of a one-decimal stem-and-leaf plot by choice.",
    },
    {
      item: { number: "16", page: "rationale PDF p.17" },
      responseFormat: "numeric",
      standards: ["TEKS.4.3.8.C"],
      archetypeIds: ["money.count-coins", "money.change"],
      demand:
        "Count tens, fives, quarters and dimes and subtract a price to find the cost of a snack",
      status: "partial",
      templateIds: ["money-total-dollars", "decimal-money-change"],
      limitations:
        "STAAR interaction: equation editor, 1 point. money-total-dollars counts one-dollar and five-dollar bills with coins and decimal-money-change subtracts; ten-dollar bills with coins and a change comparison are not practiced together.",
    },
    {
      item: { number: "17", page: "rationale PDF p.18" },
      responseFormat: "choice",
      standards: ["TEKS.4.1.3.C"],
      archetypeIds: ["fractions.number-line", "fractions.equivalent"],
      demand:
        "Choose the two fractions that name a point two thirds along a zero-to-one number line",
      status: "partial",
      templateIds: ["fraction-line-position", "fraction-equivalence-choice"],
      limitations:
        "fraction-line-position reads one fraction at a point; naming it also as an equivalent fraction in sixths is not practiced.",
    },
    {
      item: { number: "18", page: "rationale PDF p.19" },
      responseFormat: "other",
      standards: ["TEKS.4.3.7.D"],
      archetypeIds: ["angle.measure"],
      demand:
        "Choose the point the second ray must pass through to draw an eighty-five degree angle",
      status: "partial",
      templateIds: ["protractor-reading"],
      limitations:
        "STAAR interaction: inline choice, 2 points. protractor-reading reads an angle; constructing one by choosing a point on the inner scale has no family, and the answer is two dropdown blanks.",
    },
    {
      item: { number: "19", page: "rationale PDF p.20" },
      responseFormat: "choice",
      standards: ["TEKS.4.2.4.A"],
      archetypeIds: ["decimal.add-subtract"],
      demand: "Add two prices and subtract a coupon",
      status: "covered",
      templateIds: [
        "multidigit-decimal-sum",
        "staar-decimal-operations",
        "wallet-purchase-chain",
      ],
      limitations:
        "wallet-purchase-chain (prices-then-coupon) adds two prices and subtracts a coupon, in dollars and cents; choices are plain amounts, so numeric entry fits.",
    },
    {
      item: { number: "20", page: "rationale PDF p.21" },
      responseFormat: "choice",
      standards: ["TEKS.4.1.2.C"],
      archetypeIds: ["place.compare-whole"],
      demand: "Choose the true comparison of three nine-digit numbers",
      status: "covered",
      templateIds: ["true-comparison-statement"],
      limitations:
        "true-comparison-statement orders three numbers of seven to nine digits that share leading digits and picks the true statement.",
    },
    {
      item: { number: "21", page: "rationale PDF p.22" },
      responseFormat: "choice",
      standards: ["TEKS.4.4.10.B"],
      archetypeIds: ["money.budget"],
      demand:
        "Find the profit from reselling a chair after paying for the chair and the paint",
      status: "partial",
      templateIds: ["budget-category-balance"],
      limitations:
        "budget-category-balance subtracts listed expenses from income; the profit from a sale after buying and repairing an item is not practiced.",
    },
    {
      item: { number: "22", page: "rationale PDF p.23" },
      responseFormat: "choice",
      standards: ["TEKS.4.1.3.D"],
      archetypeIds: ["fractions.compare"],
      demand:
        "Choose the true comparison of improper fractions in a table by changing them to mixed numbers",
      status: "partial",
      templateIds: ["fraction-choice-compare", "compare-unlike-fractions"],
      limitations:
        "fraction-choice-compare compares four fractions with a stated fraction or whole number; changing improper fractions in a table to mixed numbers to compare them is not practiced.",
    },
    {
      item: { number: "23", page: "rationale PDF p.25" },
      responseFormat: "other",
      standards: ["TEKS.4.2.5.A"],
      archetypeIds: ["expression.verbal"],
      demand:
        "Complete an equation with the operations that find the tulips left after adding two shops and removing a number",
      status: "covered",
      templateIds: [
        "delivery-operations-slots",
        "story-operation-choice",
        "delivery-then-use",
      ],
      limitations:
        "delivery-operations-slots chooses three operations for a start amount with arrivals and removals; one choice gives the amount left. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "24", page: "rationale PDF p.26" },
      responseFormat: "choice",
      standards: ["TEKS.4.3.5.D"],
      archetypeIds: ["measure.area"],
      demand: "Find the area of an L-shaped floor split into two rectangles",
      status: "covered",
      templateIds: ["composite-area"],
      limitations:
        "composite-area finds the area of an L-shaped figure from labeled sides; the choices are plain numbers.",
    },
    {
      item: { number: "25", page: "rationale PDF p.27" },
      responseFormat: "graph/drag",
      standards: ["TEKS.4.2.4.E"],
      archetypeIds: ["whole.related-equation"],
      demand:
        "Drag numbers to complete a division equation that fits a twelve by seven array",
      status: "covered",
      templateIds: ["array-division-slots", "divide-facts"],
      limitations:
        "array-division-slots completes the division equation for an array, finding the rows or the number in each row. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "26", page: "rationale PDF p.28" },
      responseFormat: "choice",
      standards: ["TEKS.4.1.2.B"],
      archetypeIds: ["number.expanded-form-whole"],
      demand: "Choose the expanded notation of a decimal given in words",
      status: "covered",
      templateIds: ["standard-to-expanded-choice"],
      limitations:
        "standard-to-expanded-choice picks the expanded form of a decimal given in words or in digits, against a digit in the wrong place, swapped digits and a missing zero place.",
    },
    {
      item: { number: "27", page: "rationale PDF p.29" },
      responseFormat: "choice",
      standards: ["TEKS.4.2.4.F"],
      archetypeIds: ["whole.divide-one-digit"],
      demand: "Divide a four-digit mileage by four days",
      status: "covered",
      templateIds: ["divide-by-one-digit"],
      limitations:
        "divide-by-one-digit divides a four-digit number by one digit with numeric entry; the choices are plain numbers.",
    },
    {
      item: { number: "28", page: "rationale PDF p.30" },
      responseFormat: "multi-select",
      standards: ["TEKS.4.3.6.D"],
      archetypeIds: ["shape.parallel-perpendicular-sides"],
      demand:
        "Select every figure with at least one pair of perpendicular sides",
      status: "covered",
      templateIds: ["line-relationship", "shape-sides-select"],
      limitations:
        "shape-sides-select (perpendicular-sides variant) draws six polygons turned in any direction and selects the two to four that have at least one pair of perpendicular sides.",
    },
    {
      item: { number: "29", page: "rationale PDF p.31" },
      responseFormat: "choice",
      standards: ["TEKS.4.1.2.G"],
      archetypeIds: ["number.decimal-fraction-equivalent"],
      demand:
        "Choose the equation that shows a mixed decimal equal to a fraction with denominator ten",
      status: "covered",
      templateIds: ["staar-rename-percent-fraction-decimal"],
      limitations:
        "staar-rename-percent-fraction-decimal chooses true equalities between a decimal and a fraction.",
    },
    {
      item: { number: "30", page: "rationale PDF p.32" },
      responseFormat: "multi-select",
      standards: ["TEKS.4.4.9.A"],
      archetypeIds: ["data.stem-leaf-read"],
      demand: "Select the stem-and-leaf plots that show a listed data set",
      status: "covered",
      templateIds: ["stem-leaf-read", "stem-leaf-match-select"],
      limitations:
        "stem-leaf-match-select gives a list of nine to twelve two-digit values and four stem-and-leaf plots and selects the two plots that show exactly that data.",
    },
    {
      item: { number: "31", page: "rationale PDF p.33" },
      responseFormat: "choice",
      standards: ["TEKS.4.3.6.C"],
      archetypeIds: ["angle.classify"],
      demand:
        "Name the triangle by its angles when one angle is greater than ninety degrees",
      status: "covered",
      templateIds: ["classify-triangle-angles"],
      limitations:
        "classify-triangle-angles classifies a triangle by its angles by choice.",
    },
    {
      item: { number: "32", page: "rationale PDF p.34" },
      responseFormat: "choice",
      standards: ["TEKS.4.2.5.B"],
      archetypeIds: ["pattern.paired"],
      demand: "Choose the table that follows a plus-seven rule",
      status: "covered",
      templateIds: ["staar-table-rule-choice"],
      limitations:
        "staar-table-rule-choice chooses the table whose pairs all follow an add rule.",
    },
  ],
);
