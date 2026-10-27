import { defineLedger } from "./types";

/** Every mathematics item of the Virginia SOL Grade 5 mathematics released
 * test (spring 2014, 2009 Mathematics Standards of Learning), labeled once
 * from the released test PDF. The PDF carries each item as a picture and an
 * answer key that states the item type (multiple choice or
 * technology-enhanced), the correct answer and one of four reporting
 * categories; it states no standard. Standards are classified here against the
 * 2009 Grade 5 Standards of Learning, numbered as in VDOE's 2009 to 2016
 * crosswalk. This is the newest complete released form: VDOE publishes no
 * Grade 5 form for the 2016 or 2023 standards. */
export const vasolGrade5 = defineLedger(
  {
    id: "vasol-2014-5",
    test: "Virginia SOL Grade 5 mathematics",
    form: "Spring 2014 released test",
    url: "https://www.doe.virginia.gov/home/showpublisheddocument/20913/638043645523270000",
    edition:
      "Released spring 2014; assesses the 2009 Mathematics Standards of Learning (not the 2016 or 2023 revisions). Retrieved from the Internet Archive capture of the VDOE URL, taken 2026-01-09, because doe.virginia.gov refused automated requests. Reporting categories are those printed in the answer key; standard codes are classified against the 2009 standards, numbered as in the 2016 crosswalk.",
    retrievedAt: "2026-10-27",
    sha256: "7ba9c0302abdd4bbd22f858b87e9b1c9a707b3928d5d31bd9a64ea3863f12767",
    supplements: [
      {
        role: "2009 to 2016 Grade 5 standards crosswalk (2009 standard numbering and wording)",
        url: "https://www.doe.virginia.gov/home/showpublisheddocument/2980/637982463831370000",
        sha256:
          "3a0876946f566b58a80d03f63e4ae4bc367f6c61930ba8e7526c17c0190dde83",
      },
    ],
    complete: true,
  },
  {
    labeledBy: "agent:vasol-first-pass",
    labeledAt: "2026-10-27",
    section: "Test form",
  },
  [
    {
      item: { number: "1", page: "PDF p.5" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.5a"],
      archetypeIds: ["decimal.add-subtract"],
      demand: "Add a decimal in thousandths and a decimal in tenths",
      status: "covered",
      templateIds: ["multidigit-decimal-sum"],
      limitations:
        "multidigit-decimal-sum adds and subtracts decimals to thousandths; numeric entry serves the plain-decimal choices.",
    },
    {
      item: { number: "2", page: "PDF p.6" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.2a"],
      archetypeIds: [
        "number.decimal-fraction-equivalent",
        "number.percent-fraction-decimal",
      ],
      demand: "Choose the decimal equal to three fifths",
      status: "partial",
      templateIds: ["staar-rename-percent-fraction-decimal"],
      limitations:
        "staar-rename-percent-fraction-decimal renames a fraction greater than one, a percent or a decimal and mixed number; a proper fraction renamed as a decimal is not practiced.",
    },
    {
      item: { number: "3", page: "PDF p.7" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.4"],
      archetypeIds: ["number.multidigit-multiply-context"],
      demand: "Multiply twelve levels by eighty-six parking spaces",
      status: "covered",
      templateIds: ["multiply-multidigit"],
      limitations:
        "multiply-multidigit takes a two-digit by two-digit product; the garage story is a single multiplication.",
    },
    {
      item: { number: "4", page: "PDF p.8" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.7"],
      archetypeIds: ["expression.order-of-operations"],
      demand:
        "Evaluate an expression with a product of a number and a parenthesized difference added to a whole number",
      status: "covered",
      templateIds: ["operation-order"],
      limitations:
        "operation-order evaluates an expression with parentheses, multiplication and addition; numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "5", page: "PDF p.9" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.2b"],
      archetypeIds: ["number.real-order"],
      demand:
        "Choose the list that orders two fractions and two decimals from least to greatest",
      status: "covered",
      templateIds: ["staar-order-mixed-forms"],
      limitations:
        "staar-order-mixed-forms chooses the list that orders fractions, decimals, percents and roots.",
    },
    {
      item: { number: "6", page: "PDF p.10" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.7"],
      archetypeIds: ["expression.order-of-operations"],
      demand:
        "Choose the expression that results from the first step of the order of operations",
      status: "covered",
      templateIds: [
        "expression-after-first-step",
        "staar-nested-grouping",
        "operation-order",
      ],
      limitations:
        "expression-after-first-step first-step-result gives an expression with a bracketed product and offers the expression after only the first step; the numbers are decimals in tenths or whole numbers.",
    },
    {
      item: { number: "7", page: "PDF p.11" },
      responseFormat: "numeric",
      standards: ["SOL.2009.5.5b"],
      archetypeIds: ["decimal.add-subtract"],
      demand: "Add two decimal weights from a table and subtract a third",
      status: "covered",
      templateIds: ["decimal-rename-chain", "multidigit-decimal-sum"],
      limitations:
        "decimal-rename-chain table-add-subtract shows three decimal weights to hundredths in a table, adds the first two and subtracts the third, with numeric entry.",
    },
    {
      item: { number: "8", page: "PDF p.12" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.4"],
      archetypeIds: ["whole.divide-two-digit"],
      demand: "Find how many cartons of twelve eggs 216 eggs fill",
      status: "covered",
      templateIds: ["divide-by-two-digit"],
      limitations:
        "divide-by-two-digit divides a three-digit number by a two-digit divisor; numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "9", page: "PDF p.13" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.5a"],
      archetypeIds: ["decimal.multiply"],
      demand: "Multiply 5.06 and 2.1",
      status: "covered",
      templateIds: ["multidigit-decimal-product"],
      limitations:
        "multidigit-decimal-product multiplies decimals with one or two places; numeric entry serves the plain-decimal choices.",
    },
    {
      item: { number: "10", page: "PDF p.14" },
      responseFormat: "numeric",
      standards: ["SOL.2009.5.5a"],
      archetypeIds: ["decimal.divide"],
      demand: "Divide a decimal in hundredths by seven",
      status: "covered",
      templateIds: ["staar-decimal-operations"],
      limitations:
        "staar-decimal-operations divides decimals by whole numbers; the item is a bare division with a terminating quotient.",
    },
    {
      item: { number: "11", page: "PDF p.15" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.5b"],
      archetypeIds: [
        "decimal.multiply",
        "decimal.add-subtract",
        "money.change",
      ],
      demand: "Find the total cost of a ticket and a drink for thirteen people",
      status: "covered",
      templateIds: [
        "price-count-chain",
        "decimal-multiplication",
        "wallet-purchase-chain",
      ],
      limitations:
        "price-count-chain adds two prices in dollars and cents and multiplies the sum by 12 to 24 people, or multiplies each price by its own count; choices are plain amounts, so numeric entry practices the same answer.",
    },
    {
      item: { number: "12", page: "PDF p.16" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.2b"],
      archetypeIds: ["fractions.compare"],
      demand:
        "Choose the greatest of four heights written as mixed numbers with sixths, fourths, twelfths and thirds",
      status: "covered",
      templateIds: ["fraction-choice-compare"],
      limitations:
        "fraction-choice-compare picks the greatest of four mixed numbers with the same whole part and fractions with denominators 3, 4, 6 and 12.",
    },
    {
      item: { number: "13", page: "PDF p.17" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.6"],
      archetypeIds: ["fractions.add-subtract-unlike"],
      demand:
        "Subtract three mixed-number amounts of pie served from a total of ten",
      status: "covered",
      templateIds: ["fraction-term-chain", "fraction-total-minus-parts"],
      limitations:
        "fraction-term-chain whole-minus-three shows a whole-number total of 8 to 12 and three mixed-number amounts with unlike denominators in a table; numeric entry accepts the exact value, so the choices are practiced as an entered fraction.",
    },
    {
      item: { number: "14", page: "PDF p.18" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.4"],
      archetypeIds: ["whole.add-subtract-multidigit"],
      demand: "Subtract a four-digit area from a five-digit area",
      status: "covered",
      templateIds: ["subtract-multidigit"],
      limitations:
        "subtract-multidigit takes whole numbers of four to six digits with regrouping.",
    },
    {
      item: { number: "15", page: "PDF p.19" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.5b"],
      archetypeIds: ["decimal.add-subtract"],
      demand:
        "Find the unknown weight in a table when a total and two other weights are known",
      status: "covered",
      templateIds: [
        "decimal-rename-chain",
        "multidigit-decimal-sum",
        "wallet-purchase-chain",
      ],
      limitations:
        "decimal-rename-chain table-missing-weight gives a decimal total and two decimal weights in a table and asks for the third; choices are plain decimals, so numeric entry practices the same answer.",
    },
    {
      item: { number: "16", page: "PDF p.20" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.6"],
      archetypeIds: ["fractions.add-subtract-unlike"],
      demand:
        "Add three mixed-number distances with different denominators from a table",
      status: "covered",
      templateIds: [
        "fraction-term-chain",
        "add-fractions",
        "fraction-total-minus-parts",
      ],
      limitations:
        "fraction-term-chain sum-of-three adds three mixed numbers with different denominators read from a table, answered as an exact fraction or decimal.",
    },
    {
      item: { number: "17", page: "PDF p.23" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.3b"],
      archetypeIds: ["early.odd-even"],
      demand: "Choose the three numbers that could all be odd jersey numbers",
      status: "partial",
      templateIds: ["pairing-leftover"],
      limitations:
        "pairing-leftover finds the leftover of counters paired through twenty; classifying two-digit numbers as odd or even is not practiced.",
    },
    {
      item: { number: "18", page: "PDF p.24" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.3b"],
      archetypeIds: ["early.odd-even"],
      demand:
        "Choose the list of all odd numbers shown on five drawn helicopters",
      status: "partial",
      templateIds: ["pairing-leftover"],
      limitations:
        "pairing-leftover finds the leftover of counters paired through twenty; picking every odd number from a picture is not practiced.",
    },
    {
      item: { number: "19", page: "PDF p.25" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.3b"],
      archetypeIds: ["number.divisibility"],
      demand:
        "Choose the digit that could be in the ones place of a number divisible by two",
      status: "partial",
      templateIds: ["divisibility-rule-check"],
      limitations:
        "divisibility-rule-check chooses a number divisible by a given number or a completing digit; naming a possible ones digit from the rule is not practiced.",
    },
    {
      item: { number: "20", page: "PDF p.26" },
      responseFormat: "numeric",
      standards: ["SOL.2009.5.1"],
      archetypeIds: ["number.round-decimal"],
      demand: "Round 7,459.82 to the nearest whole number",
      status: "covered",
      templateIds: ["round-decimal"],
      limitations:
        "round-decimal rounds a decimal with up to three places to a whole number.",
    },
    {
      item: { number: "21", page: "PDF p.27" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.8c"],
      archetypeIds: ["measure.metric-mass-capacity", "measure.metric-length"],
      demand: "Rename 530 milliliters as liters",
      status: "covered",
      templateIds: ["metric-length-reverse"],
      limitations:
        "metric-length-reverse's capacity variant renames a count of milliliters as liters (and grams as kilograms in its mass variant) by dividing by 1000.",
    },
    {
      item: { number: "22", page: "PDF p.28" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.11"],
      archetypeIds: ["angle.measure", "angle.classify"],
      demand:
        "Choose the measure closest to a drawn obtuse angle with no protractor",
      status: "partial",
      templateIds: ["protractor-reading", "angle-classify"],
      limitations:
        "protractor-reading measures an angle against a drawn protractor and angle-classify names its kind; estimating a measure among choices is not practiced.",
    },
    {
      item: { number: "23", page: "PDF p.29" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.13a"],
      archetypeIds: ["shape.quadrilateral-hierarchy"],
      demand:
        "Name the figure with four congruent sides, two pairs of parallel sides and no right angles",
      status: "partial",
      templateIds: ["classify-quadrilateral", "find-quadrilateral"],
      limitations:
        "classify-quadrilateral names a drawn quadrilateral from marked sides and angles; naming one from a list of its properties among a triangle, rectangle and trapezoid is not practiced.",
    },
    {
      item: { number: "24", page: "PDF p.30" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.10"],
      archetypeIds: ["time.elapsed", "time.read-clock"],
      demand:
        "Find the end time of a movie of two hours and twenty-five minutes from a start clock",
      status: "covered",
      templateIds: ["elapsed-time-hm"],
      limitations:
        "elapsed-time-hm's end-time variant reads the start on an analog clock, adds hours and then minutes, and chooses the written end time.",
    },
    {
      item: { number: "25", page: "PDF p.31" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.8b"],
      archetypeIds: ["measure.model-choice"],
      demand: "Choose the measure that tells how much a bag of peanuts holds",
      status: "covered",
      templateIds: ["geometric-model-choice"],
      limitations:
        "geometric-model-choice picks the measure a task needs among area, perimeter, length and volume.",
    },
    {
      item: { number: "26", page: "PDF p.32" },
      responseFormat: "graph/drag",
      standards: ["SOL.2009.5.13b"],
      archetypeIds: ["shape.subdivide-name"],
      demand:
        "Drag the names of the three figures formed by cutting a flat figure along dashed segments",
      status: "partial",
      templateIds: ["name-cut-shape-pieces"],
      limitations:
        "name-cut-shape-pieces chooses the names of the pieces from a list for a rectangle or square cut along straight lines; dragging names onto three drawn figures is not practiced.",
    },
    {
      item: { number: "27", page: "PDF p.33" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.9"],
      archetypeIds: ["circle.parts"],
      demand:
        "Choose the segment that is a radius of a drawn circle with center S",
      status: "partial",
      templateIds: ["mcas-circle-radius-distance"],
      limitations:
        "mcas-circle-radius-distance gives the distance from the center to a circle point from stated lengths; picking the radius among chord and diameter segments of a labeled drawing is not practiced.",
    },
    {
      item: { number: "28", page: "PDF p.34" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.8d"],
      archetypeIds: ["measure.unit-choice"],
      demand:
        "Choose the likely length of a basketball court among inches, feet, centimeters and kilometers",
      status: "partial",
      templateIds: ["reasonable-measure-choice"],
      limitations:
        "reasonable-measure-choice picks the reasonable length of a named object among customary and metric units; the item shows a pictured basketball court, which is not drawn.",
    },
    {
      item: { number: "29", page: "PDF p.35" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.12b"],
      archetypeIds: ["triangle.classify-sides"],
      demand: "Choose the drawn triangle that appears scalene",
      status: "covered",
      templateIds: ["classify-triangle-by-sides"],
      limitations:
        "classify-triangle-by-sides picks the scalene, isosceles or equilateral triangle among four drawn triangles whose equal sides carry tick marks.",
    },
    {
      item: { number: "30", page: "PDF p.36" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.8b"],
      archetypeIds: ["measure.area-vs-perimeter"],
      demand: "Choose the situation that perimeter is used to find",
      status: "partial",
      templateIds: ["border-or-cover-unit"],
      limitations:
        "border-or-cover-unit tells boundary from coverage by unit; choosing among distance, coverage and boundary situations is not practiced.",
    },
    {
      item: { number: "31", page: "PDF p.37" },
      responseFormat: "multi-select",
      standards: ["SOL.2009.5.12a"],
      archetypeIds: ["angle.classify"],
      demand: "Select every drawn angle that appears acute among six angles",
      status: "covered",
      templateIds: ["angle-classify", "angle-kind-select"],
      limitations:
        "angle-kind-select draws six angles turned in any direction and selects the two or three that appear acute, right or obtuse.",
    },
    {
      item: { number: "32", page: "PDF p.38" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.8a"],
      archetypeIds: ["measure.area"],
      demand: "Find the area of a right triangle from its base and height",
      status: "covered",
      templateIds: ["triangle-area-base-height"],
      limitations:
        "triangle-area-base-height finds a triangle's area from a base and height; numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "33", page: "PDF p.39" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.14"],
      archetypeIds: ["probability.counting-principle"],
      demand:
        "Choose the list of every outfit of one shirt, one pair of pants and one pair of shoes",
      status: "partial",
      templateIds: ["counting-principle"],
      limitations:
        "counting-principle counts combinations by multiplying, by entry; recognizing the complete drawn list of outcomes is not practiced.",
    },
    {
      item: { number: "34", page: "PDF p.40" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.16b"],
      archetypeIds: ["univariate.measure-meaning"],
      demand:
        "Name the measure that is the fair share of fish among seven aquariums",
      status: "covered",
      templateIds: ["measure-meaning-choice"],
      limitations:
        "measure-meaning-choice names the mean, median, mode or range from its description, including the fair share of a total among equal groups.",
    },
    {
      item: { number: "35", page: "PDF p.41" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.15"],
      archetypeIds: ["data.graph-read"],
      demand:
        "Judge statements about the greatest increase and decrease on a line graph of daily temperatures",
      status: "covered",
      templateIds: ["line-graph-reader"],
      limitations:
        "line-graph-reader's statement variant asks which statement about the graph is true; statements cover the greatest increase, the greatest decrease, comparisons and extremes.",
    },
    {
      item: { number: "36", page: "PDF p.42" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.14"],
      archetypeIds: ["probability.counting-principle"],
      demand:
        "Choose the list of all pairings of one block from each of two bags",
      status: "partial",
      templateIds: ["counting-principle"],
      limitations:
        "counting-principle counts combinations by multiplying, by entry; recognizing the complete drawn list of outcomes is not practiced.",
    },
    {
      item: { number: "37", page: "PDF p.43" },
      responseFormat: "numeric",
      standards: ["SOL.2009.5.16c"],
      archetypeIds: ["univariate.center"],
      demand: "Type the mode of a list of nine numbers",
      status: "covered",
      templateIds: ["mode-of-data"],
      limitations:
        "mode-of-data takes a list of 8 to 14 whole numbers or a table of counts and has one mode.",
    },
    {
      item: { number: "38", page: "PDF p.44" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.17"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Choose the rule that changes the inputs of a number machine table into its outputs",
      status: "partial",
      templateIds: ["table-rule-sentence", "staar-table-rule-choice"],
      limitations:
        "The templates choose a table for a stated rule or complete a rule sentence; finding a division rule from a four-row input and output table among additive choices is not practiced.",
    },
    {
      item: { number: "39", page: "PDF p.45" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.15"],
      archetypeIds: ["data.graph-read"],
      demand:
        "Judge statements comparing weekly counts on a line graph of soup boxes",
      status: "covered",
      templateIds: ["line-graph-reader"],
      limitations:
        "line-graph-reader's statement variant asks which statement about a graph of boxes sold each week is true; statements compare weeks, give differences and name extremes.",
    },
    {
      item: { number: "40", page: "PDF p.46" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.18c"],
      archetypeIds: ["number.strip-diagram"],
      demand:
        "Choose the tile model that shows the equation one plus n equals six",
      status: "partial",
      templateIds: ["strip-diagram-match"],
      limitations:
        "strip-diagram-match shows a strip diagram and chooses the equation or story it shows; choosing the tile model for a given equation is not practiced.",
    },
    {
      item: { number: "41", page: "PDF p.47" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.17"],
      archetypeIds: ["pattern.rule"],
      demand:
        "Choose the rule that finds the next number in an increasing pattern whose differences grow by one",
      status: "covered",
      templateIds: ["pattern-rule-choice"],
      limitations:
        "pattern-rule-choice picks the rule for a pattern whose added amount grows by one each time, among add, multiply and growing rules.",
    },
    {
      item: { number: "42", page: "PDF p.48" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.18b"],
      archetypeIds: ["linear.context", "expression.verbal"],
      demand:
        "Choose the equation that finds the miles walked so far when six more reach a goal of twenty-one",
      status: "covered",
      templateIds: [
        "story-equation-choice",
        "one-step-equation-story",
        "staar-story-model-choice",
      ],
      limitations:
        "story-equation-choice sets a one-step addition or subtraction story with an unknown start, change or result within 1,000 and offers equations with the letter, such as n + 6 = 21, among equations that change the operation or order.",
    },
    {
      item: { number: "43", page: "PDF p.49" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.16d"],
      archetypeIds: ["univariate.measure-meaning"],
      demand: "Choose the description of the range of five game scores",
      status: "covered",
      templateIds: ["measure-meaning-choice"],
      limitations:
        "measure-meaning-choice chooses the sentence that describes a named measure, including the range, for 5 or 7 whole numbers.",
    },
    {
      item: { number: "44", page: "PDF p.50" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.15"],
      archetypeIds: ["data.stem-leaf-read"],
      demand:
        "Judge statements about the greatest and least values in a stem-and-leaf plot with a key",
      status: "partial",
      templateIds: ["staar-stem-leaf-combine"],
      limitations:
        "staar-stem-leaf-combine adds or subtracts the greatest and least values read from a plot with a key by entry, and stem-leaf-read asks the median, mode, range and differences by choice; judging statements about the extreme values, a true-or-false choice, is not asked.",
      labeledBy: "agent:stale-shown-work-relabel",
      labeledAt: "2026-10-27",
    },
    {
      item: { number: "45", page: "PDF p.51" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.14"],
      archetypeIds: ["probability.direct", "probability.compound-event"],
      demand:
        "Find the probability of one pairing from a listed sample space of six main dish and drink pairs",
      status: "partial",
      templateIds: ["simple-probability", "staar-experiment-probability"],
      limitations:
        "simple-probability finds a probability from equally likely objects and staar-experiment-probability from a frequency table; reading a listed sample space for one pairing is not practiced.",
    },
    {
      item: { number: "46", page: "PDF p.52" },
      responseFormat: "numeric",
      standards: ["SOL.2009.5.17"],
      archetypeIds: ["pattern.rule"],
      demand:
        "Type the seventh term of a decreasing pattern whose differences shrink by one",
      status: "covered",
      templateIds: ["pattern-term-unknown-rule"],
      limitations:
        "pattern-term-unknown-rule takes the first five terms of a decreasing pattern whose differences shrink by one and asks for the seventh term by numeric entry.",
    },
    {
      item: { number: "47", page: "PDF p.53" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.16c"],
      archetypeIds: ["univariate.spread"],
      demand: "Find the range of five page counts",
      status: "covered",
      templateIds: ["range-data"],
      limitations:
        "range-data finds the distance between the greatest and least values; numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "48", page: "PDF p.54" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.18d"],
      archetypeIds: ["whole.expression-story"],
      demand:
        "Choose the situation that an open sentence of a subtraction with an unknown result represents",
      status: "covered",
      templateIds: ["story-for-subtraction-sentence"],
      limitations:
        "story-for-subtraction-sentence chooses the story for a subtraction sentence with the result, the amount taken away or the start unknown.",
    },
    {
      item: { number: "49", page: "PDF p.55" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.19"],
      archetypeIds: ["whole.property-identify"],
      demand: "Choose the equation that shows the distributive property",
      status: "covered",
      templateIds: ["operation-property-identify"],
      limitations:
        "operation-property-identify picks the equation that shows a named property, with the distributive property of multiplication over addition one of seven properties.",
    },
    {
      item: { number: "50", page: "PDF p.56" },
      responseFormat: "choice",
      standards: ["SOL.2009.5.18a"],
      archetypeIds: ["equation.variable-identify"],
      demand:
        "Choose the quantity in a sharing situation that can change and so is a variable",
      status: "covered",
      templateIds: ["variable-in-situation"],
      limitations:
        "variable-in-situation chooses the one quantity that can change, or the one that stays the same, in a short situation that includes sharing a total equally.",
    },
  ],
);
