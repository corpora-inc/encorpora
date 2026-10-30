import { defineLedger } from "./types";

/** Every released mathematics item (20 of the 40 operational items) of the Spring 2025 MCAS Grade 3 paper-based test, labeled once from the form and its released-item table. The Department states each item's standard, item type and, for selected-response and short-answer items, the answer. */
export const mcasGrade3 = defineLedger(
  {
    id: "mcas-2025-3",
    test: "MCAS grade 3 mathematics",
    form: "Spring 2025 released items",
    url: "https://www.doe.mass.edu/mcas/2025/release/g3-math.pdf",
    edition:
      "Spring 2025 paper-based test, released operational items 1-20 of 40; standards, item types and answers as printed in the released-item table (Massachusetts Curriculum Framework for Mathematics, 2017)",
    retrievedAt: "2026-10-26",
    sha256: "d675f6fc76a8d7c5fb0b842ebaad2861ff528eed3e59712602766efafcb6eb08",
    complete: true,
  },
  { labeledBy: "agent:mcas-first-pass", labeledAt: "2026-10-26" },
  [
    {
      section: "Session 1",
      item: { number: "1", page: "printed p.4; PDF p.6" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.OA.A.1"],
      archetypeIds: ["whole.expression-story", "whole.multiplicative-stories"],
      demand:
        "Choose the word problem that a multiplication expression of two single digits represents",
      status: "covered",
      templateIds: ["operation-sentence-choice", "story-operation-choice"],
      limitations:
        "operation-sentence-choice story-for-expression gives a product of two single digits and offers one equal-groups story among addition, subtraction and division stories.",
    },
    {
      section: "Session 1",
      item: { number: "2", page: "printed p.4; PDF p.6" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.NBT.A.1"],
      archetypeIds: ["number.estimate"],
      demand:
        "Choose the sum of rounded addends that best estimates the total of two parking lots",
      status: "partial",
      templateIds: ["compatible-number-estimate", "estimate-reasonableness"],
      limitations:
        "Related families estimate with a stated rounding or compatible numbers and choose a number; choosing the expression of rounded addends is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "3", page: "printed p.4; PDF p.6" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.OA.B.6"],
      archetypeIds: [
        "whole.related-equation",
        "whole.division-facts",
        "whole.missing-factor",
      ],
      demand:
        "Choose the multiplication equation that helps solve a division equation by a multiple of ten",
      status: "covered",
      templateIds: [
        "related-division-sentence",
        "divide-facts",
        "missing-factor-fact",
      ],
      limitations:
        "related-division-sentence division-by-ten-multiple gives a division sentence by a multiple of ten and offers one multiplication sentence with the divisor and unknown among rearrangements that change the numbers or the operation.",
    },
    {
      section: "Session 1",
      item: { number: "4", page: "printed pp.5–6; PDF pp.7–8" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["3.MD.D.8"],
      archetypeIds: ["measure.area", "measure.rectangle-constraints"],
      demand:
        "Find the area and perimeter of a labeled rectangle and give other sides with the same perimeter and a different area, showing the work",
      status: "partial",
      templateIds: [
        "rectangle-area",
        "rectangle-border-length",
        "rectangle-two-constraints-choice",
      ],
      limitations:
        "Constructed response in three parts with shown work and a free-choice answer. Area and perimeter are practiced separately by entry, and a rectangle-existence family chooses rectangles meeting two conditions; producing a rectangle for a stated perimeter with a different area and explaining the work have no protocol.",
    },
    {
      section: "Session 1",
      item: { number: "5", page: "printed p.7; PDF p.9" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.MD.A.2"],
      archetypeIds: ["measure.mass-volume-story", "measure.read-scale"],
      demand:
        "Read a mass from a scale picture and choose the picture that shows the mass after adding a stated amount",
      status: "partial",
      templateIds: ["mass-volume-story", "balance-mass"],
      limitations:
        "mass-volume-story adds or subtracts stated masses and balance-mass reads a balance; reading a spring scale and choosing among scale pictures are not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "6", page: "printed p.8; PDF p.10" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["3.NBT.A.1"],
      archetypeIds: ["number.inverse-round-whole", "number.round-whole"],
      demand: "Select the two prices that round to a stated hundred",
      status: "covered",
      templateIds: ["round-to-hundred", "mcas-round-hundred-select"],
      limitations:
        "Two of five prices or counts that round to a stated hundred, with values at and just past the halfway point, are selected by multiple selection; rounding to other places is not assessed here.",
    },
    {
      section: "Session 1",
      item: { number: "7", page: "printed pp.9–10; PDF pp.11–12" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["3.NF.A.2"],
      archetypeIds: ["fractions.number-line", "fractions.compare"],
      demand:
        "Locate a unit fraction on a partitioned number line, name a marked fraction and decide whether an improper fraction exceeds a whole number, explaining the choices",
      status: "partial",
      templateIds: ["fraction-line-position", "compare-fractions"],
      limitations:
        "Constructed response in three parts. fraction-line-position reads a number at a point and compare-fractions picks the greater of two fractions; placing a stated fraction, comparing an improper fraction with a whole number and written explanations are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "8", page: "printed p.11; PDF p.13" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.G.A.2"],
      archetypeIds: ["fractions.partition-area"],
      demand:
        "Name the fraction of a figure's area that one of six equal parts is",
      status: "covered",
      templateIds: ["equal-area-fraction", "equal-area-part-size"],
      limitations:
        "The family names the fraction of a rectangle cut into equal-area parts; the choices of the item are fractions that numeric entry accepts.",
    },
    {
      section: "Session 2",
      item: { number: "9", page: "printed p.11; PDF p.13" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.NF.A.3"],
      archetypeIds: ["fractions.equivalent"],
      demand: "Choose the fraction equal to the whole number two",
      status: "partial",
      templateIds: ["fraction-whole-as-parts"],
      limitations:
        "fraction-whole-as-parts writes a whole number over a stated denominator by entry; choosing among equation statements whose denominators are 1 and 2 is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "10", page: "printed p.12; PDF p.14" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.MD.B.3"],
      archetypeIds: ["data.picture-graph"],
      demand:
        "Compare two categories of a scaled picture graph to find how many fewer chose one",
      status: "partial",
      templateIds: ["scaled-picture-graph", "picture-graph-questions"],
      limitations:
        "scaled-picture-graph reads one category of a scaled graph and picture-graph-questions compares categories of unscaled graphs; a difference on a graph whose key is 3 is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "11", page: "printed p.15; PDF p.17" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.OA.C.7"],
      archetypeIds: ["whole.division-facts"],
      demand: "Divide a two-digit dividend by a one-digit divisor",
      status: "covered",
      templateIds: ["divide-facts"],
      limitations:
        "The family divides within 100 by recalling the related multiplication fact; the item's choices are plain numbers.",
    },
    {
      section: "Session 2",
      item: { number: "12", page: "printed p.15; PDF p.17" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.NF.A.1"],
      archetypeIds: ["fractions.choose-model", "fractions.model"],
      demand:
        "Choose the fraction model that shades a stated number of equal parts of a whole",
      status: "partial",
      templateIds: ["fraction-model"],
      limitations:
        "fraction-model names a shaded fraction by entry; choosing among drawn models for a stated fraction is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "13", page: "printed p.16; PDF p.18" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.MD.A.1"],
      archetypeIds: ["time.elapsed"],
      demand:
        "Choose the table of end times for two start times and a stated lesson length",
      status: "partial",
      templateIds: ["clock-elapsed-minutes"],
      limitations:
        "clock-elapsed-minutes finds minutes between two times; finding two end times that cross an hour and choosing a table are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "14", page: "printed p.17; PDF p.19" },
      responseFormat: "numeric",
      calculator: "not-permitted",
      standards: ["3.G.A.1"],
      archetypeIds: ["shape.attribute-classify", "angle.classify"],
      demand: "Count how many figures in a group show a right angle",
      status: "partial",
      templateIds: ["angle-classify"],
      limitations:
        "angle-classify decides whether one angle is right; counting right-angle figures among a displayed group is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "15", page: "printed p.18; PDF p.20" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["3.OA.A.4"],
      archetypeIds: ["equation.truth"],
      demand:
        "Select the three true multiplication and division equations among six",
      status: "covered",
      templateIds: [
        "multiplication-division-equation-truth",
        "fact-equation-truth-select",
        "equal-factor-truth-select",
      ],
      limitations:
        "equal-factor-truth-select selects the true multiplication and division equations among six, including a number times itself such as 64 = 8 times 8 and its division fact, written with the result first or last.",
    },
    {
      section: "Session 2",
      item: { number: "16", page: "printed p.18; PDF p.20" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.OA.D.9"],
      archetypeIds: ["pattern.rule"],
      demand:
        "Choose the list that follows a subtract-fourteen rule from an even start",
      status: "partial",
      templateIds: ["rule-pattern-term", "rule-pattern-feature"],
      limitations:
        "rule-pattern-term finds a later term by entry and rule-pattern-feature judges a statement about one pattern; testing four candidate lists against a rule and a start condition is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "17", page: "printed p.19; PDF p.21" },
      responseFormat: "numeric",
      calculator: "not-permitted",
      standards: ["3.NBT.A.3"],
      archetypeIds: ["whole.multiply-one-digit"],
      demand:
        "Multiply a one-digit number by a multiple of ten in a rows story",
      status: "covered",
      templateIds: ["multiply-by-tens"],
      limitations:
        "The family multiplies a one-digit number by a multiple of ten; the story wrapper does not change the task.",
    },
    {
      section: "Session 2",
      item: { number: "18", page: "printed p.20; PDF p.22" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.MD.C.7"],
      archetypeIds: ["measure.area-distributive"],
      demand:
        "Choose the expression that finds a tiled rectangle's area by the distributive property",
      status: "covered",
      templateIds: ["area-tiling-distributive"],
      limitations:
        "The family chooses number sentences that split a tiled rectangle into two parts to find its area.",
    },
    {
      section: "Session 2",
      item: { number: "19", page: "printed p.21; PDF p.23" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["3.G.A.1"],
      archetypeIds: ["shape.attributes"],
      demand:
        "Select the two named shapes that have as many sides as a pictured shape",
      status: "covered",
      templateIds: [
        "count-sides-corners",
        "name-polygon",
        "polygon-sides-select",
      ],
      limitations:
        "polygon-sides-select draws one polygon with four, five, six or eight sides and selects the two or three of five named shapes or descriptions by corners or angles that have as many sides.",
    },
    {
      section: "Session 2",
      item: { number: "20", page: "printed p.22; PDF p.24" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["3.OA.D.8"],
      archetypeIds: ["expression.multistep-equations", "early.two-step-story"],
      demand:
        "Choose the pair of equations that finds the remaining minutes of a two-step time story",
      status: "covered",
      templateIds: ["two-step-change", "linked-time-equations"],
      limitations:
        "linked-time-equations chooses the linked pair, or the combined equation, that finds the minutes left after two periods within 100 minutes.",
    },
  ],
);
