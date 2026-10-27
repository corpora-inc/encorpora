import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2025 STAAR Grade 4 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2025 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staarGrade4 = defineLedger(
  {
    id: "staar-2025-4",
    test: "STAAR Grade 4 mathematics",
    form: "Spring 2025 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-4-rationale.pdf",
    edition:
      "Spring 2025 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "9f71c37066277b4a87d8eb528f9dc2d0386dd04a61a83e97b0c89a1269b79c63",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-4-answer-key.pdf",
        sha256:
          "edc85ff62a76546c04ba11ebd82c5b458a58d5b170134b59450b4d843a0d66cd",
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
      standards: ["TEKS.4.3.8.C"],
      archetypeIds: ["money.change", "money.count-coins"],
      demand:
        "Count mixed bills and coins in a wallet and subtract a purchase price to find money left",
      status: "covered",
      templateIds: [
        "decimal-money-change",
        "coin-total",
        "wallet-purchase-chain",
      ],
      limitations:
        "wallet-purchase-chain (wallet-then-purchase) counts a wallet of five-dollar bills, one-dollar bills, quarters, dimes and nickels and subtracts a price in dollars and cents; choices are plain amounts, so numeric entry fits.",
    },
    {
      item: {
        number: "2",
        page: "rationale PDF p.2",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.4.4.9.A"],
      archetypeIds: ["univariate.displays"],
      demand:
        "Complete a frequency table by counting dots above chosen values of a dot plot",
      status: "partial",
      templateIds: ["line-plot-whole", "fraction-line-plot"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. Related families read counts from a line plot by entry; moving values into table cells (drag and drop) has no response protocol.",
    },
    {
      item: {
        number: "3",
        page: "rationale PDF p.3",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.2.4.B"],
      archetypeIds: ["place.powers-of-ten"],
      demand:
        "Multiply a whole number by 100 to find a total in a packing story",
      status: "covered",
      templateIds: ["multiply-power-of-ten"],
      limitations:
        "The family multiplies bare numbers by 10, 100 or 1,000; the story context is not separately practiced.",
    },
    {
      item: {
        number: "4",
        page: "rationale PDF p.4",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.4.3.7.C"],
      archetypeIds: ["angle.measure"],
      demand:
        "Mark every angle whose protractor reading is not a stated measure",
      status: "partial",
      templateIds: ["protractor-reading"],
      limitations:
        "STAAR interaction: multiselect, 2 points. protractor-reading reads one angle by entry; choosing several angles by their rays (two-answer selection) and finding differences of the two scale readings are not practiced.",
    },
    {
      item: {
        number: "5",
        page: "rationale PDF p.5",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.1.2.B"],
      archetypeIds: ["number.number-word-form"],
      demand: "Write a number in words from its expanded notation",
      status: "covered",
      templateIds: ["staar-number-word-form"],
      limitations:
        "staar-number-word-form chooses the word form of a whole number below one million written in expanded notation.",
    },
    {
      item: {
        number: "6",
        page: "rationale PDF p.6",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.4.3.6.D"],
      archetypeIds: ["shape.parallel-perpendicular-sides"],
      demand:
        "Complete a sentence counting pairs of perpendicular and parallel sides in drawn polygons",
      status: "partial",
      templateIds: ["line-relationship"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. line-relationship tells whether two drawn lines are parallel or perpendicular; counting pairs among sides of a polygon and dragging words into blanks are not practiced.",
    },
    {
      item: {
        number: "7",
        page: "rationale PDF p.7",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.2.4.H"],
      archetypeIds: ["whole.multi-step-stories", "number.remainder-interpret"],
      demand:
        "Multiply pizzas by slices per pizza, then divide by slices per serving and keep only whole servings",
      status: "covered",
      templateIds: [
        "staar-multistep-stories",
        "multiply-by-one-digit",
        "divide-by-one-digit",
        "division-remainder-story",
      ],
      limitations:
        "staar-multistep-stories multiplies pizzas by slices, then divides by slices per serving and keeps whole servings, by entry.",
    },
    {
      item: {
        number: "8",
        page: "rationale PDF p.8",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.4.3.6.B"],
      archetypeIds: ["shape.symmetry"],
      demand: "Mark every shape whose drawn lines of symmetry are all correct",
      status: "partial",
      templateIds: ["symmetry-line-check", "symmetry-line-count"],
      limitations:
        "STAAR interaction: multiselect, 2 points. Related families choose one correct dashed line or count a figure's lines; checking several drawn lines on several figures with a two-answer selection is not practiced.",
    },
    {
      item: {
        number: "9",
        page: "rationale PDF p.9",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.4.9.B"],
      archetypeIds: ["data.stem-leaf-read"],
      demand: "Add the two greatest values read from a stem-and-leaf plot",
      status: "covered",
      templateIds: ["staar-stem-leaf-combine", "stem-leaf-read"],
      limitations:
        "staar-stem-leaf-combine adds the two greatest values of a stem-and-leaf plot with a key.",
    },
    {
      item: {
        number: "10",
        page: "rationale PDF p.10",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.4.1.3.C"],
      archetypeIds: ["fractions.equivalent"],
      demand: "Choose both fractions equivalent to a given fraction",
      status: "partial",
      templateIds: ["fraction-equivalence-choice", "equivalent-numerator"],
      limitations:
        "STAAR interaction: multiselect, 2 points. fraction-equivalence-choice offers one correct equivalent among misconceptions; selecting two correct equivalents has no response protocol.",
    },
    {
      item: {
        number: "11",
        page: "rationale PDF p.11",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.2.5.A"],
      archetypeIds: ["number.strip-diagram"],
      demand:
        "Choose the strip diagram for a story with a start, a small removal, a halving and an unknown remainder",
      status: "partial",
      templateIds: ["strip-diagram-match"],
      limitations:
        "strip-diagram-match reads a drawn strip diagram and chooses the story or equation; choosing the strip diagram for a story is not practiced.",
    },
    {
      item: {
        number: "12",
        page: "rationale PDF p.12",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.1.2.G"],
      archetypeIds: ["number.decimal-fraction-equivalent"],
      demand:
        "Choose the true equality that connects a decimal with its fraction or mixed number",
      status: "covered",
      templateIds: [
        "staar-rename-percent-fraction-decimal",
        "tenths-as-hundredths",
        "decimal-grid-read",
      ],
      limitations:
        "staar-rename-percent-fraction-decimal chooses the true equality between a decimal with a zero in the tenths place and its mixed number over 10 or 100.",
    },
    {
      item: {
        number: "13",
        page: "rationale PDF p.13",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.1.3.D"],
      archetypeIds: ["fractions.compare"],
      demand:
        "Choose the fraction that is less than the amount a shaded model shows",
      status: "partial",
      templateIds: ["compare-unlike-fractions", "compare-fractions"],
      limitations:
        "Related families compare two stated fractions by entry; comparing four choices with a modeled amount is not practiced.",
    },
    {
      item: {
        number: "14",
        page: "rationale PDF p.14",
      },
      responseFormat: "other",
      standards: ["TEKS.4.2.5.B"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Complete a sentence naming the operation and number of an input-output table rule",
      status: "covered",
      templateIds: [
        "rule-pattern-term",
        "pattern-pair-relationship",
        "table-rule-sentence",
      ],
      limitations:
        "table-rule-sentence (multi-part-choice-v1, inline layout): complete a sentence naming the operation and the number of the rule of an input-output table.",
    },
    {
      item: {
        number: "15",
        page: "rationale PDF p.15",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.1.3.G"],
      archetypeIds: ["decimal.read-model"],
      demand:
        "Choose the number line on which a point shows a distance of four tenths from zero",
      status: "partial",
      templateIds: ["decimal-line-point"],
      limitations:
        "decimal-line-point reads a decimal at a point by entry; choosing among several number lines for a stated value is not practiced.",
    },
    {
      item: {
        number: "16",
        page: "rationale PDF p.16",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.3.5.D"],
      archetypeIds: ["measure.area"],
      demand:
        "Find a rectangle's width from its perimeter and length, then compute its area",
      status: "covered",
      templateIds: [
        "staar-measure-chains",
        "rectangle-missing-border-side",
        "rectangle-area",
      ],
      limitations:
        "staar-measure-chains finds a rectangle's width from its perimeter and length, then its area, by entry.",
    },
    {
      item: {
        number: "17",
        page: "rationale PDF p.17",
      },
      responseFormat: "numeric",
      standards: ["TEKS.4.1.2.B"],
      archetypeIds: ["number.expanded-form-whole"],
      demand:
        "Write the standard decimal for a sum of digit-times-place-value products up to thousands",
      status: "partial",
      templateIds: ["expanded-decimal", "multidigit-digit-value"],
      limitations:
        "STAAR interaction: equation editor, 1 point. expanded-decimal writes decimals from ones through thousandths; products with thousands and hundreds are not practiced.",
    },
    {
      item: {
        number: "18",
        page: "rationale PDF p.18",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.2.4.A"],
      archetypeIds: ["decimal.add-subtract"],
      demand:
        "Subtract a tenths decimal from a whole number to compare two amounts of sugar",
      status: "covered",
      templateIds: ["staar-decimal-operations", "multidigit-decimal-sum"],
      limitations:
        "staar-decimal-operations subtracts a tenths decimal from a whole number and compares two amounts, by entry.",
    },
    {
      item: {
        number: "19",
        page: "rationale PDF p.19",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.1.2.A"],
      archetypeIds: ["number.place-value-ratio"],
      demand:
        "Choose the true statement comparing the 3 in 0.03 with the 3 in 0.3",
      status: "partial",
      templateIds: ["digit-value-ratio", "decimal-digit-value"],
      limitations:
        "Related families compare places in whole numbers or name a decimal digit's value; choosing a decimal place-value statement is not practiced.",
    },
    {
      item: {
        number: "20",
        page: "rationale PDF p.20",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.3.8.B"],
      archetypeIds: ["measure.customary-units"],
      demand:
        "Use a given miles-to-feet row to find feet in a multiple of miles",
      status: "covered",
      templateIds: ["staar-multistep-stories", "customary-unit-rename"],
      limitations:
        "staar-multistep-stories finds the amount in a larger number of units from a stated conversion row, by entry.",
    },
    {
      item: {
        number: "21",
        page: "rationale PDF p.21",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.3.8.A"],
      archetypeIds: ["measure.unit-choice"],
      demand: "Choose the weight that is reasonable for a basketball",
      status: "covered",
      templateIds: ["customary-unit-choice"],
      limitations:
        "The family chooses a reasonable customary unit for an everyday object.",
    },
    {
      item: {
        number: "22",
        page: "rationale PDF p.22",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.1.3.D"],
      archetypeIds: ["fractions.compare"],
      demand: "Choose the fraction greater than a given fraction",
      status: "partial",
      templateIds: ["compare-unlike-fractions", "compare-fractions"],
      limitations:
        "Related families compare two stated fractions by entry; comparing four choices with a given fraction is not practiced.",
    },
    {
      item: {
        number: "23",
        page: "rationale PDF p.23",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.4.2.5.A"],
      archetypeIds: ["expression.verbal"],
      demand:
        "Choose both expressions that find an unknown part after two quantities are removed from a total",
      status: "partial",
      templateIds: ["story-operation-choice", "delivery-then-use"],
      limitations:
        "STAAR interaction: multiselect, 2 points. Related families choose one equation for a one-step story or solve a two-step story; selecting two valid representations of a multistep story has no response protocol.",
    },
    {
      item: {
        number: "24",
        page: "rationale PDF p.24",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.4.9.A"],
      archetypeIds: ["univariate.displays"],
      demand:
        "Choose the data set that could produce a frequency table with ranges",
      status: "partial",
      templateIds: ["histogram-read"],
      limitations:
        "histogram-read reads counts from a binned display; deciding which raw data fit a table is not practiced.",
    },
    {
      item: {
        number: "25",
        page: "rationale PDF p.25",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.2.3.F"],
      archetypeIds: ["number.fraction-benchmark-estimate"],
      demand:
        "Estimate with benchmark fractions what fraction remains after sharing portions",
      status: "partial",
      templateIds: ["benchmark-fraction-estimate"],
      limitations:
        "benchmark-fraction-estimate rounds two fractions to 0, one half or 1 and estimates the amount left, a sum or a difference; the fractions and the wording of the item differ.",
    },
    {
      item: {
        number: "26",
        page: "rationale PDF p.26",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.4.3.5.D"],
      archetypeIds: ["measure.area"],
      demand:
        "Find a rectangle's length from its area and width, then its perimeter, and place both values",
      status: "partial",
      templateIds: [
        "rectangle-missing-area-side",
        "rectangle-missing-border-side",
      ],
      limitations:
        "STAAR interaction: drag and drop, 2 points. Both steps are practiced separately; the chain and dragging values into place are not.",
    },
    {
      item: {
        number: "27",
        page: "rationale PDF p.27",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.2.3.E"],
      archetypeIds: ["number.fraction-sum-expression"],
      demand:
        "Choose the sum of three like fractions that gives the shaded squares among thirty",
      status: "partial",
      templateIds: ["add-fractions", "fraction-model"],
      limitations:
        "add-fractions adds two fractions by entry and fraction-model reads one shaded fraction; writing a sum for several shaded groups is not practiced.",
    },
    {
      item: {
        number: "28",
        page: "rationale PDF p.28",
      },
      responseFormat: "other",
      standards: ["TEKS.4.4.10.A"],
      archetypeIds: ["finance.fixed-variable-expense"],
      demand: "Decide which listed expenses vary month to month",
      status: "partial",
      templateIds: ["staar-money-vocabulary"],
      limitations:
        "STAAR interaction: inline choice, 1 point. staar-money-vocabulary tells the variable or fixed expense from three months of amounts by single choice; the item's inline-choice response has no protocol.",
    },
    {
      item: {
        number: "29",
        page: "rationale PDF p.29",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.2.4.E"],
      archetypeIds: ["expression.verbal"],
      demand:
        "Choose the equation that cannot find the number of gallons in each of four equal types",
      status: "covered",
      templateIds: ["staar-story-model-choice", "story-operation-choice"],
      limitations:
        "staar-story-model-choice finds the equation that cannot be used to find the number in each equal group.",
    },
    {
      item: {
        number: "30",
        page: "rationale PDF p.30",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.4.1.2.G"],
      archetypeIds: ["number.decimal-fraction-equivalent"],
      demand:
        "Write a decimal with a whole part as a mixed number with a denominator of ten or one hundred",
      status: "partial",
      templateIds: ["tenths-as-hundredths", "decimal-grid-read"],
      limitations:
        "STAAR interaction: drag and drop, 1 point. Related families rename tenths as hundredths or read grids; mixed-number form of a decimal and dragging parts into the form are not practiced.",
    },
    {
      item: {
        number: "31",
        page: "rationale PDF p.31",
      },
      responseFormat: "choice",
      standards: ["TEKS.4.2.4.D"],
      archetypeIds: ["whole.multiply-one-digit"],
      demand: "Multiply a four-digit ticket count by a dollar price",
      status: "covered",
      templateIds: ["multiply-by-one-digit"],
      limitations:
        "The family multiplies a number of up to four digits by one digit.",
    },
    {
      item: {
        number: "32",
        page: "rationale PDF p.32",
      },
      responseFormat: "other",
      standards: ["TEKS.4.3.8.C"],
      archetypeIds: ["measure.mixed-units"],
      demand:
        "Add three distances in meters and write the total in kilometers and meters",
      status: "partial",
      templateIds: ["mixed-length-total", "metric-length-reverse"],
      limitations:
        "STAAR interaction: inline choice, 1 point. Related families add meters and centimeters or rename metric units; regrouping a long sum of meters into kilometers and meters and dropdown blanks are not practiced.",
    },
  ],
);
