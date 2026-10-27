import { defineLedger } from "./types";

/** Every mathematics item of the Virginia SOL Grade 4 mathematics released
 * test (spring 2014, 2009 Mathematics Standards of Learning), labeled once
 * from the released test PDF. The PDF carries each item as a picture and an
 * answer key that states the item type (multiple choice or
 * technology-enhanced), the correct answer and one of four reporting
 * categories; it states no standard. Standards are classified here against the
 * 2009 Grade 4 Standards of Learning, numbered as in VDOE's 2009 to 2016
 * crosswalk. This is the newest complete released form: VDOE publishes no
 * Grade 4 form for the 2016 or 2023 standards. */
export const vasolGrade4 = defineLedger(
  {
    id: "vasol-2014-4",
    test: "Virginia SOL Grade 4 mathematics",
    form: "Spring 2014 released test",
    url: "https://www.doe.virginia.gov/home/showpublisheddocument/20911/638043645513400000",
    edition:
      "Released spring 2014; assesses the 2009 Mathematics Standards of Learning (not the 2016 or 2023 revisions). Retrieved from the Internet Archive capture of the VDOE URL, taken 2026-01-09, because doe.virginia.gov refused automated requests. Reporting categories are those printed in the answer key; standard codes are classified against the 2009 standards, numbered as in the 2016 crosswalk.",
    retrievedAt: "2026-10-27",
    sha256: "3048b5b21e624f4095357305bc7ad4d4d68f12511c5299e8eb8c64e211e84091",
    supplements: [
      {
        role: "2009 to 2016 Grade 4 standards crosswalk (2009 standard numbering and wording)",
        url: "https://www.doe.virginia.gov/home/showpublisheddocument/2968/637982463786470000",
        sha256:
          "0a08827161d6b91ddc9140e2bbb43f33758d86cd54f9d964976d36f3ec1e2e3f",
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
      standards: ["SOL.2009.4.5b"],
      archetypeIds: ["fractions.add-subtract-unlike"],
      demand: "Add fractions with denominators five and ten",
      status: "covered",
      templateIds: ["add-fractions"],
      limitations:
        "add-fractions adds two fractions with unlike denominators; fraction entry serves the plain-fraction choices.",
    },
    {
      item: { number: "2", page: "PDF p.6" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.5c"],
      archetypeIds: ["decimal.add-subtract"],
      demand:
        "Find how much more one decimal amount is than another, one with thousandths",
      status: "covered",
      templateIds: ["multidigit-decimal-sum"],
      limitations:
        "multidigit-decimal-sum subtracts decimals to thousandths; numeric entry serves the plain-decimal choices.",
    },
    {
      item: { number: "3", page: "PDF p.7" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.5a"],
      archetypeIds: ["number.lcm"],
      demand: "Find the least common multiple of eight and twelve",
      status: "covered",
      templateIds: ["least-common-multiple"],
      limitations:
        "least-common-multiple takes two whole numbers; numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "4", page: "PDF p.8" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.4b"],
      archetypeIds: ["number.multidigit-multiply-context"],
      demand: "Multiply two two-digit whole numbers",
      status: "covered",
      templateIds: ["multiply-multidigit"],
      limitations:
        "multiply-multidigit takes a two- or three-digit number by a two-digit number; the item is a bare product and numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "5", page: "PDF p.9" },
      responseFormat: "numeric",
      standards: ["SOL.2009.4.4d"],
      archetypeIds: ["whole.multiply-one-digit"],
      demand: "Multiply the ounces per glass by a count of nineteen glasses",
      status: "covered",
      templateIds: ["multiply-by-one-digit"],
      limitations:
        "multiply-by-one-digit takes a two-digit by one-digit product; the pouring story is a single multiplication.",
    },
    {
      item: { number: "6", page: "PDF p.10" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.4a"],
      archetypeIds: ["number.estimate"],
      demand:
        "Choose the best estimate of the cost of seventy-two items at twenty-eight dollars each",
      status: "covered",
      templateIds: ["estimate-reasonableness"],
      limitations:
        "estimate-reasonableness chooses the best estimate of a product by rounding the factors.",
    },
    {
      item: { number: "7", page: "PDF p.11" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.4d"],
      archetypeIds: ["whole.multiply-one-digit"],
      demand: "Multiply a three-digit ticket count by a nine-dollar price",
      status: "covered",
      templateIds: ["multiply-by-one-digit"],
      limitations:
        "multiply-by-one-digit takes a three-digit by one-digit product; numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "8", page: "PDF p.12" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.5c"],
      archetypeIds: ["decimal.read-model", "decimal.add-subtract"],
      demand: "Add the decimals shown by two sets of hundredths grids",
      status: "partial",
      templateIds: ["decimal-grid-read", "multidigit-decimal-sum"],
      limitations:
        "decimal-grid-read names the shaded part of one tenths strip or hundredths grid and multidigit-decimal-sum adds stated decimals; reading several grids with partly shaded last grids and then adding is not practiced.",
    },
    {
      item: { number: "9", page: "PDF p.13" },
      responseFormat: "numeric",
      standards: ["SOL.2009.4.4b"],
      archetypeIds: ["whole.add-subtract-multidigit"],
      demand: "Find the difference between 3,240 and 578",
      status: "covered",
      templateIds: ["subtract-multidigit"],
      limitations:
        "subtract-multidigit takes four-digit subtraction with regrouping across a zero.",
    },
    {
      item: { number: "10", page: "PDF p.14" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.4a"],
      archetypeIds: ["number.estimate"],
      demand: "Estimate the minutes run per day from a seven-day total",
      status: "covered",
      templateIds: ["estimate-reasonableness"],
      limitations:
        "estimate-reasonableness chooses the best estimate of a quotient by rounding.",
    },
    {
      item: { number: "11", page: "PDF p.15" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.5b"],
      archetypeIds: ["fractions.add-subtract-unlike"],
      demand: "Subtract one fourth from five twelfths",
      status: "covered",
      templateIds: ["unlike-fraction-difference"],
      limitations:
        "unlike-fraction-difference subtracts fractions with different denominators; fraction entry serves the plain-fraction choices.",
    },
    {
      item: { number: "12", page: "PDF p.16" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.4d"],
      archetypeIds: ["whole.distributive-parts"],
      demand: "Multiply a daily count by three sets and seven days",
      status: "partial",
      templateIds: ["nested-bag-total"],
      limitations:
        "nested-bag-total multiplies small counts of crates, bags and items; a two-digit count carried through two multiplications is not practiced.",
    },
    {
      item: { number: "13", page: "PDF p.17" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.5a"],
      archetypeIds: ["number.gcf"],
      demand: "Choose the common factor of three numbers",
      status: "partial",
      templateIds: ["greatest-common-factor"],
      limitations:
        "greatest-common-factor finds the greatest common factor of two numbers by entry; a common factor of three numbers among distractors is not practiced.",
    },
    {
      item: { number: "14", page: "PDF p.20" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.3a"],
      archetypeIds: ["place.digit-value"],
      demand:
        "Name the digit in the tenths place of a decimal with thousandths",
      status: "partial",
      templateIds: ["decimal-digit-value"],
      limitations:
        "decimal-digit-value names the value of a given digit; naming the digit in a stated place is the reverse direction and is not practiced.",
    },
    {
      item: { number: "15", page: "PDF p.21" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.2c"],
      archetypeIds: ["number.fraction-as-division"],
      demand: "Choose the division statement for three eighths",
      status: "covered",
      templateIds: ["fraction-division-expression"],
      limitations:
        "fraction-division-expression chooses the division expression named by a fraction.",
    },
    {
      item: { number: "16", page: "PDF p.22" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.2a"],
      archetypeIds: ["fractions.number-line"],
      demand: "Name the fraction at a point on a number line cut in twelfths",
      status: "partial",
      templateIds: ["fraction-line-position"],
      limitations:
        "fraction-line-position reads a point on a number line whose wholes have two to eight equal steps; twelfths are not practiced.",
    },
    {
      item: { number: "17", page: "PDF p.23" },
      responseFormat: "graph/drag",
      standards: ["SOL.2009.4.1a"],
      archetypeIds: ["place.digit-value"],
      demand:
        "Drag the place name of each digit of a six-digit number into a table",
      status: "partial",
      templateIds: ["place-value-digit", "multidigit-digit-value"],
      limitations:
        "place-value-digit and multidigit-digit-value name one digit's value by entry; matching six digits to place names by drag has no protocol beyond a multi-part choice.",
    },
    {
      item: { number: "18", page: "PDF p.24" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.3c"],
      archetypeIds: ["number.decimal-expanded-compare"],
      demand:
        "Choose the true comparison from a table of four race times in hundredths",
      status: "partial",
      templateIds: ["compare-decimals-hundredths"],
      limitations:
        "compare-decimals-hundredths picks the greater or lesser of two decimals by entry; judging four comparison statements from a table is not practiced.",
    },
    {
      item: { number: "19", page: "PDF p.25" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.1b"],
      archetypeIds: ["place.compare-whole"],
      demand:
        "Choose the true comparison among four pairs of numbers of five to seven digits",
      status: "partial",
      templateIds: ["compare-multidigit"],
      limitations:
        "compare-multidigit picks the greater or lesser of two numbers up to 999,999; judging comparison statements with seven-digit numbers is not practiced.",
    },
    {
      item: { number: "20", page: "PDF p.26" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.3a"],
      archetypeIds: ["number.number-word-form"],
      demand: "Choose how a decimal in hundredths is written in words",
      status: "partial",
      templateIds: ["staar-number-word-form"],
      limitations:
        "staar-number-word-form chooses a number named by place-value counts; reading a decimal into words among place-name distractors is not practiced.",
    },
    {
      item: { number: "21", page: "PDF p.27" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.1c"],
      archetypeIds: ["number.round-whole"],
      demand: "Round a seven-digit number to the nearest ten thousand",
      status: "partial",
      templateIds: ["round-large"],
      limitations:
        "round-large rounds numbers up to 999,999; seven-digit numbers are not practiced.",
    },
    {
      item: { number: "22", page: "PDF p.28" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.2b"],
      archetypeIds: ["fractions.equivalent", "fractions.model"],
      demand:
        "Choose the drawn group of arrows that shades a fraction equivalent to a shaded group of triangles",
      status: "partial",
      templateIds: ["fraction-equivalence-choice", "fraction-model"],
      limitations:
        "fraction-equivalence-choice picks an equivalent fraction name; reading the shaded fraction of a drawn group and choosing among other drawn groups is not practiced.",
    },
    {
      item: { number: "23", page: "PDF p.29" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.3a"],
      archetypeIds: ["decimal.read-model"],
      demand: "Name the decimal shaded in a circle cut into ten equal parts",
      status: "partial",
      templateIds: ["decimal-grid-read"],
      limitations:
        "decimal-grid-read names a shaded tenths strip or hundredths grid; a circle cut in tenths is not practiced.",
    },
    {
      item: { number: "24", page: "PDF p.30" },
      responseFormat: "graph/drag",
      standards: ["SOL.2009.4.2a"],
      archetypeIds: ["fractions.compare"],
      demand: "Drag three fractions into order from greatest to least",
      status: "partial",
      templateIds: ["compare-fractions"],
      limitations:
        "compare-fractions picks the larger of two fractions by entry; ordering three by drag has no protocol beyond a multi-part choice.",
    },
    {
      item: { number: "25", page: "PDF p.31" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.3b"],
      archetypeIds: ["number.inverse-rounding"],
      demand: "Choose the decimal that rounds to 7.59 at the hundredths place",
      status: "covered",
      templateIds: ["inverse-round-decimal"],
      limitations:
        "inverse-round-decimal chooses a decimal that rounds to a given hundredth.",
    },
    {
      item: { number: "26", page: "PDF p.32" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.12b"],
      archetypeIds: ["shape.attributes"],
      demand: "Choose the figure that has fewer than four angles",
      status: "partial",
      templateIds: ["count-sides-corners", "defining-attribute"],
      limitations:
        "count-sides-corners counts sides and corners of a drawn figure; choosing among four named quadrilaterals and a triangle by angle count is not practiced.",
    },
    {
      item: { number: "27", page: "PDF p.33" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.7a"],
      archetypeIds: ["measure.ruler"],
      demand: "Measure a drawn hair comb to the nearest eighth of an inch",
      status: "partial",
      templateIds: ["fractional-ruler-length"],
      limitations:
        "fractional-ruler-length reads an exact half or quarter unit; choices that include eighths and a measure chosen as closest are not practiced.",
    },
    {
      item: { number: "28", page: "PDF p.34" },
      responseFormat: "multi-select",
      standards: ["SOL.2009.4.10b"],
      archetypeIds: ["line.terms"],
      demand:
        "Select the two lines that appear parallel among five drawn lines",
      status: "partial",
      templateIds: ["line-relationship"],
      limitations:
        "line-relationship names the relation of one pair of lines; finding the parallel pair among five lines by selection has no template on the multi-select protocol.",
    },
    {
      item: { number: "29", page: "PDF p.35" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.6b"],
      archetypeIds: ["measure.customary-units"],
      demand: "Rename six pounds as ounces",
      status: "covered",
      templateIds: ["customary-unit-rename"],
      limitations:
        "customary-unit-rename renames a larger customary weight as a smaller unit.",
    },
    {
      item: { number: "30", page: "PDF p.36" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.11a"],
      archetypeIds: ["shape.congruent-figures"],
      demand: "Choose the pair of drawn figures that appear congruent",
      status: "missing",
      templateIds: [],
      limitations: "No family tells congruent figures from near copies.",
    },
    {
      item: { number: "31", page: "PDF p.37" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.8b"],
      archetypeIds: ["measure.customary-units"],
      demand: "Rename three gallons as pints",
      status: "covered",
      templateIds: ["customary-unit-rename"],
      limitations:
        "customary-unit-rename renames a larger customary capacity as a smaller unit.",
    },
    {
      item: { number: "32", page: "PDF p.38" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.9"],
      archetypeIds: ["time.elapsed"],
      demand:
        "Find the elapsed time between two afternoon times in hours and minutes",
      status: "partial",
      templateIds: ["clock-elapsed-minutes"],
      limitations:
        "clock-elapsed-minutes finds minutes up to two hours between times on one morning; a span across the hour that is written as hours and minutes is not practiced.",
    },
    {
      item: { number: "33", page: "PDF p.39" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.6a"],
      archetypeIds: ["measure.unit-choice"],
      demand: "Choose the object with a mass closest to one kilogram",
      status: "partial",
      templateIds: ["customary-unit-choice"],
      limitations:
        "customary-unit-choice chooses a customary unit for an object; choosing the object for a metric mass is not practiced.",
    },
    {
      item: { number: "34", page: "PDF p.40" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.11b"],
      archetypeIds: ["transformation.image"],
      demand: "Choose the picture that shows a single reflection across a line",
      status: "partial",
      templateIds: ["transformation-image"],
      limitations:
        "transformation-image finds the image of a point or figure on a coordinate grid; choosing the drawn reflection of a figure across a line with no grid is not practiced.",
    },
    {
      item: { number: "35", page: "PDF p.41" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.12b"],
      archetypeIds: ["shape.attributes"],
      demand: "Choose the set of drawn figures that are all octagons",
      status: "partial",
      templateIds: ["name-polygon", "count-sides-corners"],
      limitations:
        "name-polygon names one polygon; picking the set whose every figure has eight sides is not practiced.",
    },
    {
      item: { number: "36", page: "PDF p.42" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.7b"],
      archetypeIds: ["measure.metric-length"],
      demand: "Rename two meters as millimeters",
      status: "covered",
      templateIds: ["metric-length-rename"],
      limitations:
        "metric-length-rename converts a count of a larger metric unit to a smaller one.",
    },
    {
      item: { number: "37", page: "PDF p.43" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.10a"],
      archetypeIds: ["line.terms"],
      demand: "Choose the drawing that represents ray KL",
      status: "partial",
      templateIds: ["line-ray-segment"],
      limitations:
        "line-ray-segment names one drawn figure; choosing the drawing of a named ray among four labeled drawings is not practiced.",
    },
    {
      item: { number: "38", page: "PDF p.44" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.8a"],
      archetypeIds: ["measure.unit-choice"],
      demand: "Choose the pictured container that holds one pint",
      status: "partial",
      templateIds: ["customary-unit-choice"],
      limitations:
        "customary-unit-choice chooses a customary unit for an object; choosing the drawn container for a capacity is not practiced.",
    },
    {
      item: { number: "39", page: "PDF p.45" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.13a"],
      archetypeIds: ["probability.likelihood-design"],
      demand:
        "Choose the spinner with four equal spaces that gives equally likely outcomes",
      status: "missing",
      templateIds: [],
      limitations:
        "No family builds or chooses a device that meets a stated likelihood.",
    },
    {
      item: { number: "40", page: "PDF p.46" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.16a"],
      archetypeIds: ["equation.truth"],
      demand:
        "Choose the true equation among products equal to sums and differences",
      status: "partial",
      templateIds: ["mcas-true-fact-equations"],
      limitations:
        "mcas-true-fact-equations judges multiplication and division facts by select-all; a product set equal to a sum or difference in a single choice is not practiced.",
    },
    {
      item: { number: "41", page: "PDF p.47" },
      responseFormat: "graph/drag",
      standards: ["SOL.2009.4.14"],
      archetypeIds: ["data.table-to-graph"],
      demand:
        "Click the top of each bar to build a bar graph from a table of milk prices",
      status: "partial",
      templateIds: ["graph-of-paired-values"],
      limitations:
        "graph-of-paired-values chooses among drawn graphs; setting the heights of bars by click has no protocol.",
    },
    {
      item: { number: "42", page: "PDF p.48" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.15"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Continue a table of teams and players in the same way to find a missing count",
      status: "partial",
      templateIds: ["staar-table-rule-choice", "table-rule-sentence"],
      limitations:
        "The templates choose a table for a stated rule or complete a rule sentence; extending a ratio table to a new input to find a missing value is not practiced.",
    },
    {
      item: { number: "43", page: "PDF p.49" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.13b"],
      archetypeIds: ["probability.likelihood-scale"],
      demand:
        "Choose the point on a zero to one number line for the chance of tails on one coin flip",
      status: "missing",
      templateIds: [],
      limitations:
        "No family places a probability on a number line from zero to one.",
    },
    {
      item: { number: "44", page: "PDF p.50" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.14"],
      archetypeIds: ["data.graph-read"],
      demand:
        "Find the day whose temperature on a line graph is closest to a given temperature",
      status: "partial",
      templateIds: ["coordinate-point-reading"],
      limitations:
        "The graph-read templates read bar graphs and plotted points; choosing the nearest value on a line graph is not practiced.",
    },
    {
      item: { number: "45", page: "PDF p.51" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.13a"],
      archetypeIds: ["probability.likelihood-scale"],
      demand:
        "Name the likelihood of drawing a color that is not in a set of folders",
      status: "missing",
      templateIds: [],
      limitations:
        "No family names certain, likely, unlikely or impossible for an event.",
    },
    {
      item: { number: "46", page: "PDF p.52" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.16a"],
      archetypeIds: ["equation.truth"],
      demand: "Choose the true equation comparing products of three factors",
      status: "partial",
      templateIds: ["mcas-true-fact-equations"],
      limitations:
        "mcas-true-fact-equations judges facts with one product or quotient; products of three factors on both sides are not practiced.",
    },
    {
      item: { number: "47", page: "PDF p.53" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.16b"],
      archetypeIds: ["whole.property-identify"],
      demand:
        "Choose the equation that shows the associative property of multiplication",
      status: "missing",
      templateIds: [],
      limitations: "No family names or identifies a property of operations.",
    },
    {
      item: { number: "48", page: "PDF p.54" },
      responseFormat: "graph/drag",
      standards: ["SOL.2009.4.13b"],
      archetypeIds: ["probability.likelihood-scale"],
      demand:
        "Place a point on a number line at the probability of rolling a two on a number cube",
      status: "missing",
      templateIds: [],
      limitations:
        "No family places a probability on a number line from zero to one.",
    },
    {
      item: { number: "49", page: "PDF p.55" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.14"],
      archetypeIds: ["data.frequency-table-read"],
      demand:
        "Choose the two-way table that shows counts of boys and girls in two grades",
      status: "missing",
      templateIds: [],
      limitations:
        "No family builds or checks a two-way table of counts against a description.",
    },
    {
      item: { number: "50", page: "PDF p.56" },
      responseFormat: "choice",
      standards: ["SOL.2009.4.15"],
      archetypeIds: ["pattern.rule"],
      demand:
        "Choose the pattern that adds the same amount as 5, 14, 23, 32, 41",
      status: "partial",
      templateIds: ["rule-pattern-term", "rule-pattern-feature"],
      limitations:
        "The templates start from a stated rule; recognizing the same rule across listed patterns of different starts is not practiced.",
    },
  ],
);
