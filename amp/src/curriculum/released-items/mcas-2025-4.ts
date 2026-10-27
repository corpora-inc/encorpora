import { defineLedger } from "./types";

/** Every released mathematics item (20 of the 40 operational items) of the Spring 2025 MCAS Grade 4 paper-based test, labeled once from the form and its released-item table. The Department states each item's standard, item type and, for selected-response and short-answer items, the answer. */
export const mcasGrade4 = defineLedger(
  {
    id: "mcas-2025-4",
    test: "MCAS grade 4 mathematics",
    form: "Spring 2025 released items",
    url: "https://www.doe.mass.edu/mcas/2025/release/g4-math.pdf",
    edition:
      "Spring 2025 paper-based test, released operational items 1-20 of 40; standards, item types and answers as printed in the released-item table (Massachusetts Curriculum Framework for Mathematics, 2017)",
    retrievedAt: "2026-10-26",
    sha256: "e6af1e153f0aef4ed330cccd7f5aaf1ae90d7087e079f42e8bb4a38c36a31778",
    complete: true,
  },
  { labeledBy: "agent:mcas-first-pass", labeledAt: "2026-10-26" },
  [
    {
      section: "Session 1",
      item: { number: "1", page: "printed p.4; PDF p.6" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["4.NF.A.2"],
      archetypeIds: ["fractions.compare"],
      demand:
        "Choose the fraction that makes a comparison with a whole number true",
      status: "partial",
      templateIds: ["compare-fractions"],
      limitations:
        "compare-fractions picks the greater of two fractions by entry; choosing a fraction that exceeds a stated whole number among four candidates is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "2", page: "printed p.4; PDF p.6" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["4.OA.B.4"],
      archetypeIds: ["number.prime-composite"],
      demand: "Select the two prime numbers among five whole numbers",
      status: "covered",
      templateIds: ["prime-composite-sort", "mcas-prime-factor-select"],
      limitations:
        "Two primes of five whole numbers below 100 are selected by multiple selection; prime factorization is not assessed here.",
    },
    {
      section: "Session 1",
      item: { number: "3", page: "printed pp.5–6; PDF pp.7–8" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["4.NF.B.3"],
      archetypeIds: [
        "fractions.add-subtract-like",
        "number.fraction-sum-expression",
      ],
      demand:
        "Write and justify a sum of like fractions, find the remaining fraction of a whole and subtract mixed numbers in a bakery story",
      status: "partial",
      templateIds: [
        "like-fraction-difference",
        "mixed-fraction-difference",
        "like-fraction-missing-part",
      ],
      limitations:
        "Constructed response in four parts with a choice, written justification and shown work. Like-denominator and mixed-number subtraction are practiced by entry; choosing or judging the equation for a fraction story and explaining the work are not.",
    },
    {
      section: "Session 1",
      item: { number: "4", page: "printed p.7; PDF p.9" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["4.MD.A.3"],
      archetypeIds: ["measure.area", "measure.area-vs-perimeter"],
      demand:
        "Find a rectangle's perimeter and choose its unit of length rather than area",
      status: "partial",
      templateIds: ["rectangle-border-length", "border-or-cover-unit"],
      limitations:
        "rectangle-border-length finds a perimeter by entry and border-or-cover-unit chooses the unit of a border; a choice that pairs the value with its unit, with square-unit distractors, is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "5", page: "printed p.7; PDF p.9" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["4.G.A.1"],
      archetypeIds: ["shape.parallel-perpendicular-sides", "line.terms"],
      demand:
        "Select the three drawn shapes that have a pair of parallel sides",
      status: "partial",
      templateIds: ["line-relationship"],
      limitations:
        "line-relationship tells parallel from intersecting lines; finding parallel sides inside polygons and selecting several shapes are not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "6", page: "printed p.8; PDF p.10" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["4.NBT.A.3"],
      archetypeIds: ["number.round-whole"],
      demand: "Round a six-digit whole number to the nearest thousand",
      status: "covered",
      templateIds: ["round-large"],
      limitations:
        "The family rounds numbers up to six digits to the ten, hundred, thousand or ten thousand; the item's choices are plain numbers.",
    },
    {
      section: "Session 1",
      item: { number: "7", page: "printed p.9; PDF p.11" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["4.NBT.A.2"],
      archetypeIds: [
        "number.expanded-form-whole",
        "number.number-word-form",
        "place.compare-whole",
        "place.digit-value",
      ],
      demand:
        "Match expanded forms to word forms and decide which word-form comparisons with a standard numeral are true, each with three selections",
      status: "partial",
      templateIds: ["expanded-form-missing", "compare-multidigit"],
      limitations:
        "expanded-form-missing completes an expanded form and compare-multidigit picks the lesser of two numerals; reading and writing number words and selecting several true statements are not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "8", page: "printed p.10; PDF p.12" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["4.OA.A.2"],
      archetypeIds: [
        "whole.multiplicative-comparison",
        "whole.multiplicative-stories",
      ],
      demand:
        "Select the three equations that find the number of students when a quantity is four times another",
      status: "covered",
      templateIds: [
        "comparison-amount",
        "comparison-factor",
        "mcas-comparison-equations-select",
      ],
      limitations:
        "Three of six equations for a times-as-many or more-than story are selected; the unknown axis makes either the larger or the smaller quantity the unknown, so the division direction from a given larger total is practiced.",
    },
    {
      section: "Session 1",
      item: { number: "9", page: "printed p.10; PDF p.12" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["4.MD.C.5"],
      archetypeIds: ["angle.measure"],
      demand: "Give the degrees of an angle that is a quarter of a circle",
      status: "covered",
      templateIds: ["turn-degrees"],
      limitations:
        "turn-degrees with turn-form=fraction-of-circle states the shaded angle as a fraction of the full circle, such as one fourth, and asks its degrees.",
    },
    {
      section: "Session 1",
      item: { number: "10", page: "printed p.11; PDF p.13" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["4.G.A.3"],
      archetypeIds: ["shape.symmetry"],
      demand: "Select the two figures whose drawn line is a line of symmetry",
      status: "partial",
      templateIds: ["symmetry-line-check"],
      limitations:
        "symmetry-line-check chooses one dashed line of symmetry among options; judging each of five figures by multiple selection is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "11", page: "printed p.14; PDF p.16" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["4.NF.B.4"],
      archetypeIds: ["fractions.multiply-whole"],
      demand: "Multiply a whole number of jugs by a fraction of a gallon each",
      status: "covered",
      templateIds: ["whole-times-fraction"],
      limitations:
        "The family finds the total of equal fractional portions; the item's choices are fractions and mixed numbers that numeric entry accepts.",
    },
    {
      section: "Session 2",
      item: { number: "12", page: "printed p.14; PDF p.16" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["4.NBT.B.4"],
      archetypeIds: ["whole.add-subtract-multidigit"],
      demand: "Subtract a four-digit number from a five-digit number",
      status: "covered",
      templateIds: ["subtract-multidigit"],
      limitations:
        "The family subtracts multidigit whole numbers of four to six digits; the item's choices are plain numbers.",
    },
    {
      section: "Session 2",
      item: { number: "13", page: "printed p.15; PDF p.17" },
      responseFormat: "numeric",
      calculator: "not-permitted",
      standards: ["4.NF.C.7"],
      archetypeIds: ["number.decimal-expanded-compare", "decimal.read-model"],
      demand:
        "Write any decimal that is less than the decimal a shaded model shows",
      status: "partial",
      templateIds: ["decimal-grid-read", "compare-decimals-hundredths"],
      limitations:
        "decimal-grid-read names a shaded decimal and compare-decimals-hundredths picks the greater of two decimals; writing any decimal below a modeled value is an open set of correct answers that the numeric protocol does not grade.",
    },
    {
      section: "Session 2",
      item: { number: "14", page: "printed pp.16–17; PDF pp.18–19" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["4.MD.A.1"],
      archetypeIds: [
        "measure.read-scale",
        "measure.metric-mass-capacity",
        "time.rename-units",
      ],
      demand:
        "Read a liquid amount, convert liters to milliliters and hours with minutes to minutes, and fit a bag mass between kilograms and grams",
      status: "partial",
      templateIds: ["read-liquid-volume"],
      limitations:
        "Constructed response in four parts. read-liquid-volume reads a liquid level; metric capacity and mass conversion, renaming hours as minutes and choosing a value between two masses in different units are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "15", page: "printed p.18; PDF p.20" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["4.MD.C.6"],
      archetypeIds: ["angle.measure"],
      demand: "Select the true measures of two angles read on one protractor",
      status: "partial",
      templateIds: ["protractor-reading"],
      limitations:
        "protractor-reading reads one angle by entry; reading two angles that share a ray and choosing two true statements are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "16", page: "printed p.19; PDF p.21" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["4.OA.B.4"],
      archetypeIds: [
        "number.factors-identify",
        "number.factor-pairs",
        "number.divisibility",
      ],
      demand: "Select the three factors of sixty-four among six numbers",
      status: "covered",
      templateIds: [
        "factor-partner",
        "divisibility-rule-check",
        "mcas-prime-factor-select",
      ],
      limitations:
        "Three factors of a number up to 96 among six candidates that include multiples are selected by multiple selection; listing all factors by entry is not assessed.",
    },
    {
      section: "Session 2",
      item: { number: "17", page: "printed p.20; PDF p.22" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["4.NF.C.6"],
      archetypeIds: [
        "number.decimal-fraction-equivalent",
        "decimal.read-model",
      ],
      demand: "Choose the fraction equal to a decimal in hundredths",
      status: "partial",
      templateIds: ["tenths-as-hundredths"],
      limitations:
        "tenths-as-hundredths renames tenths and sums of tenths and hundredths over 100; choosing the fraction of a two-digit hundredths decimal is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "18", page: "printed p.20; PDF p.22" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["4.NBT.B.6"],
      archetypeIds: ["whole.divide-one-digit"],
      demand: "Divide a four-digit number by one digit",
      status: "covered",
      templateIds: ["divide-by-one-digit"],
      limitations:
        "The family divides multidigit dividends by one digit; the item's choices are plain numbers.",
    },
    {
      section: "Session 2",
      item: { number: "19", page: "printed p.21; PDF p.23" },
      responseFormat: "numeric",
      calculator: "not-permitted",
      standards: ["4.OA.C.5"],
      archetypeIds: ["pattern.rule"],
      demand:
        "Find the next number of a decreasing pattern whose rule is not stated",
      status: "partial",
      templateIds: ["rule-pattern-term"],
      limitations:
        "rule-pattern-term applies a stated rule; inferring the rule from the first four terms is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "20", page: "printed p.21; PDF p.23" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["4.NBT.B.5"],
      archetypeIds: ["equation.truth", "whole.multiply-one-digit"],
      demand:
        "Select the three correct statements about whether three products of a three-digit and a one-digit number are right",
      status: "covered",
      templateIds: ["multiply-by-one-digit", "mcas-true-product-equations"],
      limitations:
        "Stated products of a three-digit and a one-digit number are judged as a select-all list or, through the answer-format axis, as three products each paired with an 'is true' and an 'is false' statement, choosing the correct one of each pair.",
    },
  ],
);
