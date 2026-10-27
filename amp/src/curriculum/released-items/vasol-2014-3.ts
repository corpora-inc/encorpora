import { defineLedger } from "./types";

/** Every mathematics item of the Virginia SOL Grade 3 mathematics released
 * test (spring 2014, 2009 Mathematics Standards of Learning), labeled once
 * from the released test PDF. The PDF carries each item as a picture and an
 * answer key that states the item type (multiple choice or
 * technology-enhanced), the correct answer and one of four reporting
 * categories; it states no standard. Standards are classified here against the
 * 2009 Grade 3 Standards of Learning, numbered as in VDOE's 2009 to 2016
 * crosswalk. This is the newest complete released form: VDOE publishes no
 * Grade 3 form for the 2016 or 2023 standards. */
export const vasolGrade3 = defineLedger(
  {
    id: "vasol-2014-3",
    test: "Virginia SOL Grade 3 mathematics",
    form: "Spring 2014 released test",
    url: "https://www.doe.virginia.gov/home/showpublisheddocument/20909/638043645503730000",
    edition:
      "Released spring 2014; assesses the 2009 Mathematics Standards of Learning (not the 2016 or 2023 revisions). Retrieved from the Internet Archive capture of the VDOE URL, taken 2026-01-09, because doe.virginia.gov refused automated requests. Reporting categories are those printed in the answer key; standard codes are classified against the 2009 standards, numbered as in the 2016 crosswalk.",
    retrievedAt: "2026-10-27",
    sha256: "b4f09c3ded3bc1ad387519f0409a03efc1b685e3a61c6ec6edd62aa944d13446",
    supplements: [
      {
        role: "2009 to 2016 Grade 3 standards crosswalk (2009 standard numbering and wording)",
        url: "https://www.doe.virginia.gov/home/showpublisheddocument/2956/637982463751000000",
        sha256:
          "d391021fb5c6004c86ff76c7253bf1a9aa7d8069657befffa1aa2d32ab0ae685",
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
      standards: ["SOL.2009.3.2"],
      archetypeIds: ["early.subtract-within-20"],
      demand:
        "Choose the subtraction sentence that a stated addition fact helps solve",
      status: "partial",
      templateIds: ["related-subtraction"],
      limitations:
        "related-subtraction computes a bare subtraction by thinking of the related addition; choosing the sentence in a fact family among subtraction, multiplication, division and addition distractors is not practiced.",
    },
    {
      item: { number: "2", page: "PDF p.6" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.3c"],
      archetypeIds: ["fractions.compare", "fractions.model"],
      demand:
        "Compare the fractions of circles shaded in two drawn sets of eleven",
      status: "partial",
      templateIds: ["compare-like-denominators", "fraction-model"],
      limitations:
        "compare-like-denominators picks the larger of two stated like fractions; counting the shaded circles in two drawn sets and choosing the comparison statement with a symbol is not practiced.",
    },
    {
      item: { number: "3", page: "PDF p.7" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.1a"],
      archetypeIds: ["place.base-ten-model"],
      demand:
        "Name the number shown by a base-ten model of thousands cubes, a flat, rods and units",
      status: "partial",
      templateIds: ["hundreds-model", "tens-ones-model"],
      limitations:
        "hundreds-model composes numbers up to 999; a model that includes thousands cubes is not practiced.",
    },
    {
      item: { number: "4", page: "PDF p.8" },
      responseFormat: "graph/drag",
      standards: ["SOL.2009.3.1b"],
      archetypeIds: ["number.round-whole"],
      demand:
        "Drag the roundings of one four-digit number to the thousand, hundred and ten into a table",
      status: "covered",
      templateIds: [
        "round-place-blanks",
        "round-to-ten",
        "round-to-hundred",
        "round-large",
      ],
      limitations:
        "round-place-blanks rounds one four-digit number to the thousand, hundred and ten, as slots or a three-gap sentence. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "5", page: "PDF p.9" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.3c"],
      archetypeIds: ["fractions.compare", "fractions.model"],
      demand:
        "Compare the fractions of eggs in two drawn cartons of twelve places",
      status: "partial",
      templateIds: ["compare-like-denominators", "fraction-model"],
      limitations:
        "compare-like-denominators picks the larger of two stated like fractions; reading each carton as a fraction and choosing the comparison statement with a symbol is not practiced.",
    },
    {
      item: { number: "6", page: "PDF p.10" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.1a"],
      archetypeIds: ["number.number-word-form"],
      demand: "Choose the word form of a five-digit numeral",
      status: "partial",
      templateIds: ["staar-number-word-form"],
      limitations:
        "staar-number-word-form chooses a number from counts of place values; reading a five-digit numeral into words among choices that swap thousands and hundreds is not practiced.",
    },
    {
      item: { number: "7", page: "PDF p.11" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.3a"],
      archetypeIds: ["fractions.mixed-improper", "fractions.model"],
      demand:
        "Name the mixed number shaded across several drawn wholes cut in halves",
      status: "partial",
      templateIds: ["improper-whole-part", "fraction-unit-count"],
      limitations:
        "fraction-unit-count counts shaded equal pieces and improper-whole-part counts the wholes in an improper fraction; naming the mixed number from a drawn model of several wholes is not practiced.",
    },
    {
      item: { number: "8", page: "PDF p.12" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.2"],
      archetypeIds: ["whole.related-equation", "whole.division-facts"],
      demand:
        "Choose the division sentence that a multiplication fact helps solve",
      status: "partial",
      templateIds: ["divide-facts"],
      limitations:
        "divide-facts divides within 100 by recalling the related multiplication fact; choosing the sentence in a fact family among division, multiplication and addition distractors is not practiced.",
    },
    {
      item: { number: "9", page: "PDF p.13" },
      responseFormat: "graph/drag",
      standards: ["SOL.2009.3.1c"],
      archetypeIds: ["place.compare-whole"],
      demand:
        "Drag a comparison symbol into each of two sentences comparing whole numbers",
      status: "covered",
      templateIds: [
        "compare-symbol-blanks",
        "compare-multidigit",
        "three-digit-symbol",
      ],
      limitations:
        "compare-symbol-blanks chooses less than, equal to or greater than for two comparisons, one of them an equal pair written in expanded form. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "10", page: "PDF p.14" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.3a"],
      archetypeIds: ["fractions.choose-model", "fractions.model"],
      demand: "Choose the group of shapes in which three eighths are circles",
      status: "partial",
      templateIds: ["fraction-model"],
      limitations:
        "fraction-model names the shaded fraction of one whole by entry; choosing among drawn groups for a stated fraction of a set is not practiced.",
    },
    {
      item: { number: "11", page: "PDF p.15" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.5"],
      archetypeIds: ["whole.missing-factor"],
      demand:
        "Find the divisor that makes a division sentence with quotient nine true",
      status: "covered",
      templateIds: ["missing-factor-fact"],
      limitations:
        "missing-factor-fact takes an equation with an unknown divisor within 100; numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "12", page: "PDF p.16" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.7"],
      archetypeIds: ["fractions.add-subtract-like", "fractions.model"],
      demand:
        "Add the two fractions shaded in two strip models of seven equal parts",
      status: "partial",
      templateIds: ["like-fraction-missing-part", "fraction-unit-count"],
      limitations:
        "like-fraction-missing-part finds a missing addend from stated fractions; reading two shaded strips and adding their fractions is not practiced.",
    },
    {
      item: { number: "13", page: "PDF p.17" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.6"],
      archetypeIds: ["whole.multiplicative-stories"],
      demand:
        "Choose the number sentence that fits a drawn set of four equal boxes of flowers",
      status: "partial",
      templateIds: ["story-operation-choice", "multiplication-division-story"],
      limitations:
        "story-operation-choice picks an equation for a worded story; choosing the sentence for a drawn set of equal groups is not practiced.",
    },
    {
      item: { number: "14", page: "PDF p.18" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.4"],
      archetypeIds: ["number.add-subtract-story"],
      demand:
        "Subtract a sold amount from a store total and then add a delivery",
      status: "covered",
      templateIds: ["bag-totals-chain"],
      limitations:
        "bag-totals-chain adds two parts and subtracts a third, the same two operations in the other order; numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "15", page: "PDF p.19" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.7"],
      archetypeIds: ["fractions.add-subtract-like", "fractions.model"],
      demand:
        "Find the difference of two fractions shaded in two drawn models of one whole",
      status: "partial",
      templateIds: ["like-fraction-difference", "fraction-unit-count"],
      limitations:
        "like-fraction-difference subtracts stated like fractions; reading the fractions from two shaded models and choosing among answers written in eighths and sixteenths is not practiced.",
    },
    {
      item: { number: "16", page: "PDF p.20" },
      responseFormat: "numeric",
      standards: ["SOL.2009.3.6"],
      archetypeIds: ["whole.multiply-one-digit"],
      demand: "Multiply a two-digit number of packages by five pieces in each",
      status: "covered",
      templateIds: ["multiply-by-one-digit"],
      limitations:
        "multiply-by-one-digit takes a two-digit by one-digit product; the packages story is a single multiplication.",
    },
    {
      item: { number: "17", page: "PDF p.21" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.7"],
      archetypeIds: ["fractions.add-subtract-like", "fractions.model"],
      demand:
        "Add three fourths and one fourth shown with shaded triangle models",
      status: "partial",
      templateIds: ["like-fraction-missing-part", "fraction-model"],
      limitations:
        "like-fraction-missing-part finds a missing addend from stated fractions; adding two like fractions with models and choosing among a mixed number, a whole and eighths is not practiced.",
    },
    {
      item: { number: "18", page: "PDF p.22" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.4"],
      archetypeIds: ["whole.add-subtract-multidigit"],
      demand: "Subtract a three-digit number from 3,000",
      status: "covered",
      templateIds: ["subtract-multidigit"],
      limitations:
        "subtract-multidigit takes four-digit subtraction across zeros; numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "19", page: "PDF p.23" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.6"],
      archetypeIds: ["early.number-line-hops"],
      demand:
        "Choose the sentence for four equal jumps of six drawn on a number line to 24",
      status: "partial",
      templateIds: ["number-line-hops"],
      limitations:
        "number-line-hops adds or subtracts a tens hop and a ones hop by entry; choosing a multiplication or addition sentence for equal jumps drawn on a number line is not practiced.",
    },
    {
      item: { number: "20", page: "PDF p.24" },
      responseFormat: "multi-select",
      standards: ["SOL.2009.3.5"],
      archetypeIds: ["whole.multiplication-facts"],
      demand:
        "Select every multiplication fact in a grid of six that equals 48",
      status: "partial",
      templateIds: ["multiply-facts"],
      limitations:
        "multiply-facts finds one product by entry; selecting all facts that share a product has no template on the multi-select protocol.",
    },
    {
      item: { number: "21", page: "PDF p.27" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.12"],
      archetypeIds: ["time.rename-units"],
      demand: "Rename five hours as minutes",
      status: "covered",
      templateIds: ["rename-time-units"],
      limitations:
        "rename-time-units renames whole numbers of hours as minutes, and minutes, days, weeks and years in the other directions; numeric entry serves the plain-number choices.",
    },
    {
      item: { number: "22", page: "PDF p.28" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.14"],
      archetypeIds: ["shape.attributes"],
      demand:
        "Name the kind of figure that makes up a drawn picture of gray pieces around a dark piece",
      status: "partial",
      templateIds: ["name-flat-shape"],
      limitations:
        "name-flat-shape names one shape in any size or orientation; naming the figure that repeats in a picture made of many shapes is not practiced.",
    },
    {
      item: { number: "23", page: "PDF p.29" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.9a"],
      archetypeIds: ["measure.unit-choice"],
      demand:
        "Choose the reasonable length of a bed among feet, inches, meters and centimeters",
      status: "covered",
      templateIds: ["reasonable-measure-choice"],
      limitations:
        "reasonable-measure-choice picks the reasonable length of an everyday object among customary and metric units that are far apart in size.",
    },
    {
      item: { number: "24", page: "PDF p.30" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.11a"],
      archetypeIds: ["time.read-clock"],
      demand: "Choose the time closest to an analog clock reading",
      status: "covered",
      templateIds: ["read-clock-five-minutes"],
      limitations:
        "read-clock-five-minutes chooses the time of an analog clock in five-minute steps with hand-swap distractors.",
    },
    {
      item: { number: "25", page: "PDF p.31" },
      responseFormat: "numeric",
      standards: ["SOL.2009.3.13"],
      archetypeIds: ["measure.read-scale"],
      demand: "Type the temperature a Fahrenheit thermometer shows",
      status: "covered",
      templateIds: ["read-thermometer"],
      limitations:
        "read-thermometer (display: thermometer) reads a Fahrenheit or Celsius temperature at the top of the liquid in a drawn bulb-and-tube thermometer, with small marks every 2 or 5 degrees and numbers every 10, by entry. Clients without scenes-v2 see the bar-scale surface instead.",
      labeledBy: "agent:scene-components",
      labeledAt: "2026-10-27",
    },
    {
      item: { number: "26", page: "PDF p.32" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.16"],
      archetypeIds: ["shape.congruent-figures"],
      demand: "Choose the tower of blocks congruent to a drawn tower",
      status: "partial",
      templateIds: ["congruent-figure-pair"],
      limitations:
        "congruent-figure-pair picks the congruent pair among four drawn convex figures; choosing the tower of blocks congruent to a drawn tower is not practiced.",
    },
    {
      item: { number: "27", page: "PDF p.33" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.11b"],
      archetypeIds: ["time.elapsed", "time.read-clock"],
      demand:
        "Find the finish time three hours after the time on an analog clock",
      status: "partial",
      templateIds: ["clock-elapsed-minutes", "read-clock-five-minutes"],
      limitations:
        "clock-elapsed-minutes finds minutes between two times by entry; adding whole hours to a clock reading and choosing the written time with A.M. is not practiced.",
    },
    {
      item: { number: "28", page: "PDF p.34" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.10a"],
      archetypeIds: ["measure.area"],
      demand: "Find the perimeter of an irregular shaded figure on a unit grid",
      status: "partial",
      templateIds: ["rectangle-border-length"],
      limitations:
        "rectangle-border-length finds the perimeter of a rectangle; counting the boundary units of an irregular figure on a grid is not practiced.",
    },
    {
      item: { number: "29", page: "PDF p.35" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.8"],
      archetypeIds: ["money.count-coins"],
      demand: "Find the total of two dollar bills and a drawn set of coins",
      status: "covered",
      templateIds: ["money-total-dollars"],
      limitations:
        "money-total-dollars totals dollar bills with drawn coins in dollars; numeric entry serves the plain-dollar choices.",
    },
    {
      item: { number: "30", page: "PDF p.36" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.15"],
      archetypeIds: ["line.terms"],
      demand: "Choose the drawing that shows two rays and a line segment",
      status: "partial",
      templateIds: ["line-ray-segment"],
      limitations:
        "line-ray-segment names one drawn figure; choosing among four drawings of rays, lines and segments for a stated set is not practiced.",
    },
    {
      item: { number: "31", page: "PDF p.37" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.10a"],
      archetypeIds: ["measure.area", "measure.equal-units"],
      demand:
        "Estimate the perimeter of an equal-sided pentagon from a scale key",
      status: "partial",
      templateIds: ["rectangle-border-length", "measure-with-units"],
      limitations:
        "rectangle-border-length finds the perimeter of a rectangle with labeled sides and measure-with-units counts laid units; estimating a perimeter of a regular figure from a key is not practiced.",
    },
    {
      item: { number: "32", page: "PDF p.38" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.18"],
      archetypeIds: ["probability.counting-principle"],
      demand:
        "Choose the drawn list that shows every pairing of two toy types with four colors",
      status: "partial",
      templateIds: ["counting-principle"],
      limitations:
        "counting-principle counts combinations by multiplying, by entry; recognizing the complete list of drawn outcomes is not practiced.",
    },
    {
      item: { number: "33", page: "PDF p.39" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.19"],
      archetypeIds: ["pattern.repeating-unit"],
      demand:
        "Find the two circles removed from a repeating pattern of shaded and half-shaded circles",
      status: "partial",
      templateIds: ["repeating-shape-pattern"],
      limitations:
        "repeating-shape-pattern fills two empty boxes in a repeating pattern of circles, squares and triangles; the item repeats shaded and half-shaded circles, a pattern in shading that is not drawn.",
    },
    {
      item: { number: "34", page: "PDF p.40" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.17b"],
      archetypeIds: ["data.graph-error"],
      demand:
        "Choose the chart that could show the favorite foods of 14 surveyed students",
      status: "partial",
      templateIds: ["table-fits-description"],
      limitations:
        "table-fits-description checks tables written as text lists against a survey total and the number of choices; drawn charts are not shown.",
    },
    {
      item: { number: "35", page: "PDF p.41" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.19"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Choose the expression that finds the minutes for ten laps from a table of laps and minutes",
      status: "partial",
      templateIds: ["staar-table-rule-choice", "table-rule-sentence"],
      limitations:
        "staar-table-rule-choice chooses a table for a stated rule and table-rule-sentence completes a rule sentence; extending a rate pattern to a new input and choosing among additive and multiplicative expressions is not practiced.",
    },
    {
      item: { number: "36", page: "PDF p.42" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.17"],
      archetypeIds: ["data.table-to-graph", "data.picture-graph"],
      demand:
        "Choose the bar graph that shows the same data as a picture graph with a key of two inches",
      status: "partial",
      templateIds: ["graph-of-paired-values", "picture-graph-questions"],
      limitations:
        "picture-graph-questions reads a picture graph and graph-of-paired-values chooses a plot for a table; converting a scaled picture graph into a bar graph is not practiced.",
    },
    {
      item: { number: "37", page: "PDF p.43" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.20b"],
      archetypeIds: ["whole.property-identify"],
      demand:
        "Choose the sentence that shows the identity property of multiplication",
      status: "covered",
      templateIds: ["operation-property-identify"],
      limitations:
        "operation-property-identify picks the equation that shows a named property, with the identity property of multiplication one of seven properties of addition and multiplication.",
    },
    {
      item: { number: "38", page: "PDF p.44" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.19"],
      archetypeIds: ["pattern.rule"],
      demand: "Choose the rule that generates 1, 3, 9, 27, 81",
      status: "covered",
      templateIds: ["pattern-rule-choice"],
      limitations:
        "pattern-rule-choice picks the rule, including multiply by a number, that makes a five-term pattern; the terms of the item are 1, 3, 9, 27 and 81.",
    },
    {
      item: { number: "39", page: "PDF p.45" },
      responseFormat: "choice",
      standards: ["SOL.2009.3.17c"],
      archetypeIds: ["data.fraction-line-plot", "data.graph-read"],
      demand:
        "Find the total points scored from a line plot of whole-number team points",
      status: "partial",
      templateIds: ["fraction-line-plot"],
      limitations:
        "fraction-line-plot counts measurements at or beyond a mark on a half-unit line plot; totaling the values by multiplying each mark by its count on a whole-number line plot is not practiced.",
    },
    {
      item: { number: "40", page: "PDF p.46" },
      responseFormat: "graph/drag",
      standards: ["SOL.2009.3.18"],
      archetypeIds: ["probability.likelihood-design"],
      demand:
        "Drag eight cards into a bag so that stars and hearts are equally likely",
      status: "partial",
      templateIds: ["equal-chance-choice"],
      limitations:
        "equal-chance-choice chooses among given bags and spinners for equal, greatest or least chance; building the set by dragging eight cards into a bag is not practiced.",
    },
  ],
);
