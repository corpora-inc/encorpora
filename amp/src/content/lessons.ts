import type { GlossarySenses } from "../glossary/types";
import type { SemanticFigure } from "../math/contracts";
import { satCompletionLessons } from "./sat-completion-lessons";
import { satGeometryDataLessons } from "./sat-geometry-data-lessons";
import { satGeometryAdvancedLessons } from "./sat-geometry-advanced-lessons";
import { congruenceLessons } from "./congruence-lessons";
import { assessmentGapLessons } from "./assessment-gap-lessons";
import { radicalEquationLessons } from "./radical-equation-lessons";
import { rationalEquationLessons } from "./rational-equation-lessons";
import { geometryProofLessons } from "./geometry-proof-lessons";
import { geometryProofFamilyLessons } from "./geometry-proof-family-lessons";
import { k8RepresentationLessons } from "./k8-representations-lessons";
import { rationalExpressionLessons } from "./rational-expression-lessons";
import { nonlinearSystemLessons } from "./nonlinear-system-lessons";
import { areaVolumeLessons } from "./area-volume-lessons";
import { transformationLessons } from "./transformation-lessons";
import { completingSquareLessons } from "./completing-square-lessons";
import { factoringLessons } from "./factoring-lessons";
import { ratioRateLessons } from "./ratio-rate-lessons";
import { patternFunctionLessons } from "./pattern-function-lessons";
import { linearFunctionLessons } from "./linear-function-lessons";
import { quadraticStructureLessons } from "./quadratic-structure-lessons";
import { functionToolkitLessons } from "./function-toolkit-lessons";
import { twoVariableLessons } from "./two-variable-lessons";
import { equationLessons } from "./equation-lessons";
import { distributionLessons } from "./distribution-lessons";
import { inferenceLessons } from "./inference-lessons";
import { bivariateLessons } from "./bivariate-lessons";
import { partWholeLessons } from "./part-whole-lessons";
import { decimalLessons } from "./decimal-lessons";
import { timeMoneyLessons } from "./time-money-lessons";
import { attributeLessons } from "./attribute-lessons";
import type { AttributeIllustrationKind } from "./AttributeIllustration";
import { linePlotLessons } from "./line-plot-lessons";
import { earlyDataLessons } from "./early-data-lessons";
import type { DataIllustration } from "./data-display-illustrations";
import type { SceneIllustration } from "./scene-illustrations";
import { combinatoricsLessons } from "./combinatorics-lessons";
import { angleTriangleLessons } from "./angle-triangle-lessons";
import { realNumberLessons } from "./real-number-lessons";
import { numberSystemLessons } from "./number-system-lessons";
import { radicalLessons } from "./radical-lessons";
import { volumeCoordinateLessons } from "./volume-coordinate-lessons";
import { shapeLessons } from "./shape-lessons";
import type { ShapeIllustrationKind } from "./ShapeIllustration";
import type { AngleIllustrationKind } from "./AngleIllustration";
import { angleLessons } from "./angle-lessons";
import type { PolygonIllustrationKind } from "./PolygonIllustration";
import { probabilityRulesLessons } from "./probability-rules-lessons";
import { similarityTrigLessons } from "./similarity-trig-lessons";
import { coordinateCircleLessons } from "./coordinate-circle-lessons";
import { algebraStatisticsLessons } from "./algebra-statistics-lessons";
import { powerLessons } from "./power-lessons";
import { polygonLessons } from "./polygon-lessons";
import { exponentialLessons } from "./exponential-lessons";
import { comparisonLessons } from "./comparison-lessons";
import { numberSenseLessons } from "./number-sense-lessons";
import { multiplyDivideLessons } from "./multiply-divide-lessons";
import { addSubtractLessons } from "./add-subtract-lessons";
import { factsLessons } from "./facts-lessons";
import { factArrayLessons } from "./fact-arrays-lessons";
import type { FactArrayIllustrationKind } from "./FactArrayIllustration";
import type { EarlyOperationsIllustrationKind } from "./EarlyOperationsIllustration";
import { rationalLessons } from "./rational-lessons";
import { circleMeasurementLessons } from "./circle-measurement-lessons";
import { integerExponentLessons } from "./integer-exponent-lessons";
import { descriptiveStatisticsLessons } from "./descriptive-statistics-lessons";
import { percentChangeLessons } from "./percent-change-lessons";
import { successivePercentChangeLesson } from "./successive-percent-change-lesson";
import { slopeTriangleStatementsLesson } from "./slope-triangle-statements-lesson";
import { inequalityLessons } from "./inequality-lessons";
import { linearSystemLessons } from "./linear-system-lessons";
import { rightTriangleLessons } from "./right-triangle-lessons";
import { fractionAdditionLesson } from "./fraction-addition-lesson";
import { polynomialLessons } from "./polynomial-lessons";
import { quadraticLessons } from "./quadratic-lessons";
import { complexLessons } from "./complex-lessons";
import { financeCreditLessons } from "./finance-credit-lessons";
import { hsStateGapLessons } from "./hs-state-gaps-lessons";
import { financeIncomeLessons } from "./finance-income-lessons";
import { texasHsLessons } from "./texas-hs-lessons";
import { k8StateNumberLessons } from "./k8-state-number-lessons";
import { texas38Lessons } from "./texas-38-lessons";
import { satNumericEntryLessons } from "./sat-numeric-entry-lessons";
import { satFunctionFormsLessons } from "./sat-function-forms-lessons";
import { pointPlotLessons } from "./point-plot-lessons";
import { multiPartChoiceLessons } from "./multi-part-choice-lessons";
import { algebraRequirementGapLessons } from "./algebra-requirement-gaps-lessons";
import { advancedMathGapLessons } from "./advanced-math-gaps-lessons";
import { numberMeasurementGapLessons } from "./number-measurement-gaps-lessons";
import { floridaGapLessons } from "./florida-gaps-lessons";
import { regentsGapLessons } from "./regents-gap-lessons";
import { mcasGapLessons } from "./mcas-gap-lessons";
import { staarGapLessons } from "./staar-gap-lessons";
import { texasK2Lessons } from "./texas-k2-lessons";
import { satAlgebraStructureLessons } from "./sat-algebra-structure-lessons";
import { remainingGapLessons } from "./remaining-gap-lessons";
import { dataDisplayStateLessons } from "./data-display-state-lessons";
import { vectorMatrixLessons } from "./vectors-matrices-lessons";
import { statisticsProbabilityLessons } from "./statistics-probability-lessons";
import { complexConicsLessons } from "./complex-conics-lessons";
import { trigonometryLessons } from "./trigonometry-lessons";
import { geometryModelingLessons } from "./geometry-modeling-lessons";
import { geometryRequirementGapLessons } from "./geometry-requirement-gaps-lessons";
import { functionBehaviorLessons } from "./function-behavior-lessons";
import { absoluteValueLessons } from "./absolute-value-lessons";
import { measurementLessons } from "./measurement-lessons.js";
import { algebraLessons } from "./algebra-lessons.js";
import { choiceLessons } from "./choice-lessons.js";
import { elementaryLessons } from "./elementary-lessons";
import { graphicalLessons } from "./graphical-lessons";
import { extendedLessons } from "./extended-lessons";
import { familyRegistry } from "../families/registry";
/** Original reference lessons for the implemented templates, not a full course. */
export interface Lesson {
  id: string;
  title: string;
  summary: string;
  /** The glossary entry an ambiguous word means in this lesson: lowercase
   * form → term id (`src/glossary/`). */
  senses?: GlossarySenses;
  /** Glossary forms used as ordinary words in this lesson. */
  noLink?: string[];
  templateIds: string[];
  objectives: string[];
  /** Omit a generic practice figure when authored illustrations teach the same representation. */
  includeGeneratedRepresentation?: boolean;
  sections: {
    /** Teaching layer; untagged sections explain the method. */
    stage?: "intuition" | "method" | "formal";
    title: string;
    paragraphs: string[];
    /** Keep a diagram with its explanation when exporting a printed lesson. */
    keepTogetherInPrint?: boolean;
    illustration?:
      | "av-triangle-half"
      | "av-polygon-split"
      | "av-prism-net"
      | "av-cube-packing"
      | "av-composite-split"
      | "av-prism-layers"
      | "av-prism-unrolled"
      | "av-cylinder-stack"
      | "av-cone-sphere-cylinder"
      | "hundred-chart-moves"
      | "teen-ten-frame"
      | "number-line-hop-pair"
      | "rounding-halfway"
      | "power-of-ten-shift"
      | "coordinate-side-lengths"
      | "distance-triangle"
      | "rigid-motions-panels"
      | "dilation-rays"
      | "similar-triangles-marked"
      | "scale-drawing-plan"
      | "complete-square-area"
      | "complete-square-balance"
      | "complete-square-scaled"
      | "angle-pairs"
      | "parallel-angle-pairs"
      | "triangle-sum-line"
      | "exterior-angle"
      | "side-strips"
      | "solid-slices"
      | "factoring-gcf"
      | "factoring-monic"
      | "factoring-nonmonic"
      | "repeating-decimal-shift"
      | "root-zoom"
      | "root-solutions"
      | "decimal-point-shift"
      | "scientific-regroup"
      | "prime-factor-venn"
      | "gcf-area"
      | "multiple-jumps"
      | "long-division"
      | "elevation-line"
      | "opposite-line"
      | "story-jumps"
      | AttributeIllustrationKind
      | "multiply-tens-groups"
      | "area-model-product"
      | "standard-algorithm-product"
      | "partial-quotients"
      | "partial-quotients-two-digit"
      | "rate-double-line"
      | "unit-price-tapes"
      | "ratio-table-scaling"
      | "rate-through-one"
      | "fraction-rate-copies"
      | "story-tapes"
      | FactArrayIllustrationKind
      | EarlyOperationsIllustrationKind
      | ShapeIllustrationKind
      | AngleIllustrationKind
      | PolygonIllustrationKind
      | "pattern-rule-steps"
      | "related-patterns-graph"
      | "dependent-variable-graph"
      | "compare-functions-graph"
      | "linear-nonlinear-graph"
      | "clock-hour-half"
      | "clock-five-minutes"
      | "coin-values"
      | "coin-count-on"
      | "balance-remove"
      | "balance-split"
      | "balance-bags"
      | "undo-chain"
      | "equation-tape"
      | "two-step-tape"
      | "inequality-many-solutions"
      | "decimal-tenths-hundredths"
      | "decimal-compare-chart"
      | "decimal-rounding-line"
      | "inverse-decimal-rounding-line"
      | "decimal-aligned-sum"
      | "column-addition"
      | "base-ten-trade"
      | "column-subtraction-zero"
      | "column-multidigit"
      | "volume-layers"
      | "prism-composite"
      | "ordered-pair-path"
      | "five-frame-facts"
      | "count-on-hops"
      | "make-ten-frames"
      | "ten-hundred-digits"
      | "equal-shares"
      | "same-share-shapes"
      | "equal-area-regions"
      | "compare-same-whole"
      | "comparison-pairing"
      | "comparison-number-path"
      | "comparison-place-chart"
      | "large-place-value-chart"
      | DataIllustration
      | SceneIllustration
      | "counting-tree"
      | "permutation-slots"
      | "combination-orders"
      | "independent-grid"
      | "expected-spinner"
      | "radical-square-grid"
      | "radical-like-lengths"
      | "radical-product-grid"
      | "radical-rationalize"
      | "signed-fraction-number-line"
      | "complex-fraction-scaling"
      | "rational-power-ladder"
      | "integer-exponent-ladder"
      | "descriptive-median"
      | "descriptive-range"
      | "descriptive-iqr"
      | "thirds-and-fourths"
      | "circle-circumference"
      | "circle-area"
      | "circle-arc"
      | "circle-sector"
      | "percent-change-bars"
      | "percent-change-reverse"
      | "inequality-half-lines"
      | "linear-system-intersection"
      | "linear-system-count"
      | "right-triangle-orientation"
      | "absolute-value-distance"
      | "absolute-value-shifted"
      | "pythagorean-rearrangement";
  }[];
  /** Closing material defaults to formal; tag explanatory visuals as method. */
  closingSections?: Lesson["sections"];
  workedExample: {
    prompt: string;
    figure?: SemanticFigure;
    choices?: string[];
    steps: string[];
    answer: string;
    answerUnit?: string;
  };
  pitfalls: string[];
  parentGuide: string;
}
export const baseLessons: Lesson[] = [
  {
    id: "counting",
    title: "One object, one count",
    summary:
      "To count, you say one number for each thing. The counting numbers are 1, 2, 3, 4, 5 and so on. Touch each thing once as you say its number. The last number you say tells how many things there are. That number is called the total.",
    templateIds: ["count-objects"],
    noLink: ["change"],
    objectives: [
      "Count a group by touching each object once and saying one number for it.",
      "Explain that moving the objects around does not change how many there are.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One number for each thing",
        paragraphs: [
          "Put 3 apples in a row. Touch the first apple and say 1. Touch the next apple and say 2. Touch the last apple and say 3.",
          "Each apple got one number, and no apple got two. The last number you said is 3. So there are 3 apples.",
        ],
      },
      {
        stage: "method",
        title: "Keep track",
        paragraphs: [
          "Touch the first object and say 1. Move to the next object and say 2. Keep going until every object has a number.",
          "Some objects can be moved, like blocks on a table. Slide each one aside after you count it. Then you can see which ones are left.",
          "Dots in a picture cannot be moved. Count them in a steady order, such as left to right along each row. That way no dot gets counted twice.",
        ],
      },
      {
        stage: "method",
        title: "The last number tells how many",
        paragraphs: [
          "When you finish, the last number you said is how many there are. If someone asks how many, say that number. You do not need to count again.",
          "Now spread the same objects far apart and count again. They take up more room, but the count is the same. Moving objects does not add any or take any away.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Counting a group",
        paragraphs: [
          "Counting matches each object with exactly one counting number. The numbers are said in order, starting with 1. The last number said is how many objects the group has. This number is called the group’s cardinality. A group with no objects has 0 objects.",
          "Moving the objects, or counting them in a different order, does not change how many there are. This is true as long as no objects are added or taken away.",
        ],
      },
    ],
    workedExample: {
      prompt: "Count these dots: ● ● ● ● ●",
      steps: [
        "Touch the first dot and say one. Then touch each next dot and say the next number: two, three, four, five.",
        "Every dot got exactly one number. So no dot was missed, and none was counted twice.",
        "The last number you said is five. It tells how many dots there are.",
      ],
      answer: "5",
    },
    pitfalls: [
      "Say one number each time you touch one object. Saying numbers faster than you touch can skip an object or count one twice.",
      "A longer row does not always have more objects. Count to find out.",
    ],
    parentGuide:
      "Use five buttons or blocks. Ask the learner to count them, then spread them out or bunch them up. Ask whether the number changed, and why. Touching or moving each object are both good ways to keep track.",
  },
  {
    id: "addition",
    noLink: ["change", "changes", "leaves"],
    title: "Join groups and count on",
    summary:
      "To add means to put groups together and find how many in all. The sign + means add, and = means is the same amount as. The answer is called the sum. In 6 + 3 = 9, the sum is 9. You can count on: start at one number and keep counting. Or make a ten first, because adding to 10 is easy. A number line shows numbers in order, so you can count on by moving right. Adding 0 adds nothing, so the number stays the same.",
    templateIds: ["add-within-20"],
    senses: { part: "part", parts: "part" },
    objectives: [
      "Add by joining two groups.",
      "Add within 20 by counting on or by making a ten.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Put groups together",
        paragraphs: [
          "Put 6 counters on a table. Add 3 more. How many are there in all?",
          "Count them all: 1, 2, 3, up to 9. Or start at 6 and count on 3 more: 7, 8, 9. Either way there are 9.",
        ],
      },
      {
        title: "Join two parts",
        paragraphs: [
          "In 6 + 3, the numbers 6 and 3 are the parts. The sum is how many there are when the parts are together.",
          "To count on, say the first number, 6. Then say one new number for each one you add: 7, 8, 9. Do not count the 6 again.",
        ],
      },
      {
        title: "Make a ten",
        paragraphs: [
          "10 is a handy stop. To find 8 + 5, split 5 into 2 and 3. 8 and 2 make 10. Then 3 more make 13.",
          "Changing the order does not change the sum: 8 + 5 and 5 + 8 both make 13.",
          "Adding 0 adds nothing, so the number stays the same: 16 + 0 = 16.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Addition facts",
        paragraphs: [
          "The sum of two numbers is how many things there are when two groups are put together.",
          "The order does not change the sum: 8 + 5 = 5 + 8. Which pair you add first does not change it either: (8 + 2) + 3 = 8 + (2 + 3). The parentheses ( ) show which numbers to add first.",
          "Adding 0 leaves a number the same: 16 + 0 = 16. These facts are why making a ten works.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 8 + 5?",
      steps: [
        "8 needs 2 more to make 10. So split 5 into 2 and 3.",
        "Add the 2 first: 8 + 2 = 10.",
        "Then add the 3 that is left: 10 + 3 = 13.",
      ],
      answer: "13",
    },
    pitfalls: [
      "When you count on, do not count the start number again. Start with the next number.",
      "When you split a number, the pieces must add back to it: 5 is 2 and 3.",
    ],
    parentGuide:
      "Use two colors of counters. Ask how the learner sees a group of 10. Ask them to explain how they found the sum before asking them to go faster.",
  },
  {
    id: "subtraction",
    noLink: ["leaves"],
    title: "Take away and find the difference",
    summary:
      "To subtract means to take some away and find how many are left. The sign − means take away, and = means is the same amount as. In 9 − 4 = 5, the answer, 5, is called the difference. It also tells how far apart 9 and 4 are. You can take away objects, count back, or count up from the smaller number to the bigger one. Adding checks a take-away.",
    templateIds: ["subtract-within-20"],
    senses: { difference: "difference-subtract" },
    objectives: [
      "Subtract by taking objects away.",
      "Check a subtraction answer by adding.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Take some away",
        paragraphs: [
          "Start with 14 counters. Take 6 away. Count the ones that are left: 8.",
          "Put the 6 back. 8 and 6 make 14 again. That is how adding checks a take-away.",
        ],
      },
      {
        title: "Take away a part",
        paragraphs: [
          "In 14 − 6, start with 14 and take away 6. The difference is what is left.",
          "You can count back 6 from 14: 13, 12, 11, 10, 9, 8. Or go down to 10 first. Take away 4 to reach 10, then 2 more to reach 8.",
        ],
      },
      {
        title: "Find what is missing",
        paragraphs: [
          "You can also think of 14 − 6 as a question: 6 and what make 14?",
          "Count up from 6 to 14: 7, 8, 9, 10, 11, 12, 13, 14. You said 8 numbers, so the difference is 8.",
          "Check by adding. What you took away plus what is left makes the start: 6 + 8 = 14.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Subtraction and its addition check",
        paragraphs: [
          "For 14 − 6, the difference is the number that goes with 6 to make 14. That is why 6 + 8 = 14 checks 14 − 6 = 8.",
          "Taking away 0 leaves a number the same: 9 − 0 = 9. Taking a number away from itself leaves 0: 9 − 9 = 0.",
          "Order matters. Taking 6 from 14 is not the same as taking 14 from 6.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 14 − 6?",
      steps: [
        "Take away 4 first to reach 10, because 10 is easy to take from: 14 − 4 = 10.",
        "You must take away 6 in all, and you took 4. So take away 2 more: 10 − 2 = 8.",
        "Check by adding: 6 + 8 = 14.",
      ],
      answer: "8",
    },
    pitfalls: [
      "Order matters. Taking 6 from 14 is different from taking 14 from 6.",
      "Taking away 0 leaves the number the same.",
    ],
    parentGuide:
      "Give the learner 14 small objects. Ask them to show taking away 6. Then ask them to start with 6 and add objects up to 14, counting how many they add.",
  },
  {
    id: "fractions",
    noLink: ["change", "changes", "mean"],
    title: "Equal parts of one whole",
    summary:
      "A fraction names part of a whole. The whole is one full thing, like one rectangle. Cut it into equal parts, parts that are all the same size. We write a fraction like 3/8, with 3 on top and 8 on the bottom. The bottom number, 8, is the denominator. It counts the equal parts in the whole. The top number, 3, is the numerator. It counts the parts you mean, such as the shaded ones. Two fractions, like 4/8 and 1/2, can name the same amount.",
    templateIds: ["fraction-model"],
    senses: {
      whole: "whole",
      part: "part",
      parts: "part",
      eighth: "eighth",
      eighths: "eighth",
    },
    objectives: [
      "Find the numerator and the denominator in a fraction picture.",
      "Tell when two fractions name the same amount.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Name the whole first",
        paragraphs: [
          "Choose one whole, like one rectangle. Cut it into 8 parts that are all the same size. Shade 3 of them.",
          "The whole has 8 equal parts, so the denominator is 8. 3 parts are shaded, so the numerator is 3. The shaded amount is 3/8, read “three eighths.”",
          "Count the parts that are not shaded too. The denominator counts every equal part in the whole.",
        ],
      },
      {
        title: "Rename without changing the amount",
        paragraphs: [
          "Shade 4 of the 8 equal parts. That covers the same amount as 1 of 2 equal parts of the same whole. So 4/8 = 1/2.",
          "Fractions that name the same amount are called equivalent fractions.",
          "To find a simpler name, divide the top and bottom numbers by the same whole number that goes into both evenly. For 4/8, 4 goes into both: 4 ÷ 4 = 1 and 8 ÷ 4 = 2. So 4/8 = 1/2. The name changes, but the amount stays the same.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Fractions and equivalent names",
        paragraphs: [
          "Cut a whole into equal parts. The denominator is the number of parts, and it is never 0. The fraction 3/8 means 3 of the 8 equal parts, so 3 eighths.",
          "Two fractions are equivalent when they name the same amount of the same whole. Multiplying the top and bottom numbers by the same whole number, not 0, keeps the amount the same. So does dividing both by a whole number that goes into both evenly.",
          "To compare fraction pictures, the wholes must be the same size.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle has eight equal parts. Four are shaded. What fraction is shaded?",
      steps: [
        "Count all the equal parts in the whole: 8. That is the denominator, the bottom number.",
        "Count the shaded parts: 4. That is the numerator, the top number. So the fraction is 4/8.",
        "4 of 8 parts is half of them. Divide the top and bottom by 4: 4 ÷ 4 = 1 and 8 ÷ 4 = 2. So 4/8 = 1/2.",
      ],
      answer: "1/2",
    },
    pitfalls: [
      "Count only equal parts, all the same size. If the parts are different sizes, counting them does not tell the shaded amount.",
      "When you compare fraction pictures, make sure the wholes are the same size.",
    ],
    parentGuide:
      "Fold a sheet of paper in half and shade one half. Then fold it again, and again. Ask why the shaded amount stays the same even though its fraction name changes.",
  },
  fractionAdditionLesson,
  {
    id: "area",
    title: "Cover a rectangle with unit squares",
    summary:
      "Area is how much flat space a shape covers. We measure it with unit squares. A unit square is a square with sides 1 unit long, like 1 centimeter. A centimeter, written cm, is about the width of a fingernail. Cover a rectangle with unit squares, with no gaps and no overlaps. Count the squares in one row, and count the rows. Then multiply: the sign × means times. The area is in square units, like square centimeters.",
    templateIds: ["rectangle-area"],
    senses: {
      square: "square-shape",
      squares: "square-shape",
      unit: "unit",
      side: "side",
      sides: "side",
    },
    objectives: [
      "Explain why the area of a rectangle is width times height, using rows of squares.",
      "Tell square units for area from length units.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count a covering",
        paragraphs: [
          "Draw a rectangle 6 centimeters wide and 4 centimeters high on grid paper. Fill it with unit squares.",
          "Each row has 6 squares, one for each centimeter of width. There are 4 rows, one for each centimeter of height.",
          "4 rows of 6 squares is 4 × 6 = 24 squares. The sign × means times: 4 groups of 6. Multiplying counts every square once.",
        ],
      },
      {
        title: "Width times height",
        paragraphs: [
          "So the area of a rectangle is its width times its height. Width is how wide it is. Height is how tall it is.",
          "Both lengths must use the same unit, like both in centimeters.",
        ],
      },
      {
        title: "Keep the units",
        paragraphs: [
          "Centimeters measure length. Square centimeters measure area. One square centimeter is the space inside a square with sides 1 centimeter long.",
          "Perimeter is the distance all the way around a shape. It is not the number of squares inside. Adding the side lengths gives perimeter, not area.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Area of a rectangle",
        paragraphs: [
          "One square unit is the area of a square with sides 1 unit long. A rectangle 6 units wide and 4 units high has area 6 × 4 = 24 square units.",
          "With letters, a rectangle with width $w$ and height $h$, in the same unit, has area $A = w \\times h$ square units. The letters stand for the numbers. This works for any side lengths, not only whole numbers.",
          "Perimeter measures the length around the outside. Area measures the space inside.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle is 6 cm wide and 4 cm high. What is its area in square centimeters?",
      steps: [
        "Each unit square is 1 cm by 1 cm. The rectangle is 6 cm wide, so each row holds 6 squares.",
        "It is 4 cm high, so there are 4 rows.",
        "4 rows of 6 squares: 6 × 4 = 24. The area is 24 square centimeters.",
      ],
      answer: "24",
    },
    pitfalls: [
      "Adding the side lengths does not give area. Multiply the width by the height.",
      "Write area in square units, like square centimeters, not just centimeters.",
    ],
    parentGuide:
      "Have the learner draw a rectangle on centimeter grid paper and count its squares. Ask them to explain why rows times squares in a row gives the same count.",
  },
  {
    id: "linear-equations",
    title: "Keep an equation balanced",
    summary:
      "An equation says two amounts are equal, like a balanced pan scale. Its two sides are the amounts to the left and right of the equals sign. A variable is a letter, such as $x$, that stands for a missing number, and $3x$ means 3 times that number. To find $x$, undo what was done to it. Make the same change on both sides so they stay equal.",
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      "left side": "side-of-equation",
      "right side": "side-of-equation",
    },
    noLink: ["scale", "change"],
    templateIds: ["linear-equation"],
    objectives: [
      "Solve a two-step linear equation.",
      "Verify a solution by substitution.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Equality is a balance",
        paragraphs: [
          "An equation has two sides: the amounts to the left and right of its equals sign. A solution is a value of $x$ that makes the two sides equal. Subtracting the same amount from both sides keeps them equal. Dividing both sides by the same number also keeps them equal, as long as that number is not 0.",
          "In $3x + 5 = -7$, two things were done to $x$: multiply by 3, then add 5. Undo them in reverse order: subtract 5 first, then divide by 3. The number multiplying $x$, here 3, is called the coefficient.",
        ],
      },
      {
        title: "Check in the original equation",
        paragraphs: [
          "To substitute means to put a number in place of a letter. Substitute your answer for $x$ in the original equation. Work out the left side and compare it with the right side.",
          "Negative solutions are possible. In $3x + 5 = -7$, subtracting 5 gives $-12$, so follow the signs carefully.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equivalent equations",
        paragraphs: [
          "An equation states that two expressions have the same value. A solution is a value of the unknown that makes the original equation true. Adding or subtracting the same quantity on both sides keeps the same solutions. So does multiplying or dividing both sides by the same quantity, as long as it is not 0.",
          "Real numbers are all the numbers on the number line. For real numbers $a$, $b$ and $c$ with $a \\ne 0$, the equation $ax+b=c$ has exactly one solution, $x=\\frac{c-b}{a}$. Here $a$ is the coefficient, the number multiplying the unknown $x$. Substitution checks the solution in the original equation.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $3x + 5 = -7$.",
      steps: [
        "Subtract 5 from both sides to undo the + 5: $3x = -12$.",
        "Divide both sides by 3 to undo the multiplication: $x = -4$.",
        "Check in the original: $3(-4) + 5 = -12 + 5 = -7$. Both sides are $-7$.",
      ],
      answer: "-4",
    },
    pitfalls: [
      "Changing only one side breaks the equality, and the new equation has a different solution.",
      "The coefficient multiplies $x$, so remove it by dividing, not by subtracting.",
    ],
    parentGuide:
      "Ask which operation the learner is undoing and why the same change must happen on both sides. Let substitution settle disagreements.",
  },
  {
    id: "statistics-mean",
    title: "Mean as a fair share",
    summary:
      "The mean is what each group would get if the total were shared equally. Picture several bags holding different numbers of marbles. Add all the marbles together. Then split that total into as many equal shares as there are bags. One share is the mean.",
    senses: { mean: "mean-average", "arithmetic mean": "mean-average" },
    noLink: ["units", "model", "part"],
    templateIds: ["mean-data"],
    objectives: [
      "Compute an arithmetic mean.",
      "Explain why repeated observations and every value count.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find the total and the count",
        paragraphs: [
          "Data is a set of values, and each value is called an observation. Add all the observations, including repeated values. Then divide that total by the number of observations. The result is the mean, also called the arithmetic mean or the average.",
          "Picture sharing the total equally. If five bags hold different numbers of marbles, the mean is how many each bag holds after you even them out. In the calculation, a share can include part of a marble.",
        ],
      },
      {
        title: "Interpret the answer",
        paragraphs: [
          "A mean can be a fraction or a decimal, a number with a decimal point, even when every observation is a whole number. It does not have to be one of the values in the list.",
          "One very large observation pulls the mean up. The median, the middle value when the list is in order, describes something different.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The arithmetic mean",
        paragraphs: [
          "Real numbers are all the numbers on the number line. For a list of one or more real numbers, the arithmetic mean is the sum of all the entries divided by the number of entries. Every occurrence counts, including repeated values. The mean has the same units as the entries.",
          "The mean lies between the smallest and largest entries. It need not be one of the listed values or a whole number. The median is the middle value of the sorted list, or the mean of its two middle values when the list has an even number of entries.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is the mean of 3, 4, 4, 7, 8?",
      steps: [
        "Add every value, including both 4s: $3 + 4 + 4 + 7 + 8 = 26$.",
        "Count the values: there are 5.",
        "Share the total equally: $26 \\div 5 = \\frac{26}{5} = 5.2$.",
      ],
      answer: "26/5",
    },
    pitfalls: [
      "Count every observation, including repeated ones, not just the different values.",
      "Dividing by the largest value, or picking the middle value, does not give the mean.",
    ],
    parentGuide:
      "Use five small piles of counters. Move counters between piles until they are even, to model a fair share. Then discuss why a mean with a fraction makes sense even when counters cannot be split.",
  },
  {
    id: "quadratics",
    title: "Read a quadratic minimum",
    summary:
      "A real number is any number on the number line, including fractions and negative numbers, the numbers less than 0. A number squared is the number multiplied by itself, and it is never negative. The input is the number you put into a rule, and the output is the number you get out. We write $f(x)$, read “$f$ of $x$”, for the output of a rule $f$ at the input $x$. A rule that doubles a square and then adds 5 has a lowest output of 5. That lowest output is called the minimum value.",
    senses: {
      square: "square-number",
      squared: "square-number",
      vertex: "vertex-parabola",
    },
    noLink: ["multiple", "rule", "face", "more than", "part", "side"],
    templateIds: ["quadratic-vertex"],
    objectives: [
      "Interpret a positive multiple of a square.",
      "Distinguish the minimum value from the input where it occurs.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A square cannot be negative",
        paragraphs: [
          "For any real number $x$, $(x-3)^{2}$ means $(x-3)$ times $(x-3)$. A positive times a positive is positive, and a negative times a negative is positive too. At least means equal to or more than. So $(x-3)^{2}$ is at least 0, and we write $(x-3)^{2} \\ge 0$. It equals 0 exactly when $x=3$, because then $x-3=0$.",
          "Multiplying by the positive number 2 keeps this, so $2(x-3)^{2}$ is also at least 0. Adding 5 gives an output of at least 5. The smallest output, 5, happens at $x=3$.",
          "In general, $f(x)=a(x-h)^{2}+k$ with $a$ positive has minimum value $k$, reached at $x=h$. The point $(h,k)$ is called the vertex. Its coordinates are its two numbers: $h$ across and $k$ up.",
        ],
      },
      {
        title: "Input and output are different",
        paragraphs: [
          "The input $h$ tells where the minimum happens. The output $k$ tells the minimum value. Read the question carefully to see which one it asks for.",
          "A negative number in front, $a<0$, turns the curve upside down. Then $k$ is the maximum, the highest output, instead. This lesson’s practice uses positive $a$ and real-number inputs.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Vertex form and extreme values",
        paragraphs: [
          "A function is a rule that gives exactly one output for each input. For real numbers $a$, $h$ and $k$ with $a \\ne 0$, the function $f(x)=a(x-h)^2+k$ is called quadratic. This way of writing it is called vertex form. Its graph is a parabola (a bowl-shaped curve that opens up or down). Its vertex $(h,k)$ is the turning point. Its domain, the set of allowed inputs, is all real numbers.",
          "Because $(x-h)^2 \\ge 0$ for every real $x$, with equality exactly at $x=h$, a positive $a$ gives a minimum output $k$ at input $h$. A negative $a$ gives a maximum output $k$ at the same input. The input where the extreme occurs and the extreme output are different quantities.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "For real $x$, what is the minimum value of $f(x) = 2(x - 3)^2 + 5$?",
      steps: [
        "A square is never negative, so $(x - 3)^2 \\ge 0$. Multiplying by the positive 2 keeps it that way: $2(x - 3)^2 \\ge 0$.",
        "At $x = 3$, $x - 3 = 0$, so the squared part is 0, its smallest possible value.",
        "So the smallest output is $0 + 5 = 5$.",
      ],
      answer: "5",
    },
    pitfalls: [
      "The $x$-coordinate of the vertex is not the minimum output.",
      "The sign of $a$ decides whether the vertex is a minimum or a maximum.",
    ],
    parentGuide:
      "Make a small table for $x$ = 1, 2, 3, 4, 5. Compare the outputs on each side of 3, and tell apart the input 3 from the minimum value 5.",
  },
];

export const lessons: readonly Lesson[] = [
  ...assessmentGapLessons,
  ...satCompletionLessons,
  ...satGeometryDataLessons,
  ...satGeometryAdvancedLessons,
  ...completingSquareLessons,
  ...factoringLessons,
  ...integerExponentLessons,
  ...descriptiveStatisticsLessons,
  ...rightTriangleLessons,
  ...quadraticLessons,
  ...complexLessons,
  ...financeCreditLessons,
  ...hsStateGapLessons,
  ...financeIncomeLessons,
  ...texasHsLessons,
  ...k8StateNumberLessons,
  ...texas38Lessons,
  ...satNumericEntryLessons,
  ...satFunctionFormsLessons,
  ...pointPlotLessons,
  ...multiPartChoiceLessons,
  ...algebraRequirementGapLessons,
  ...advancedMathGapLessons,
  ...numberMeasurementGapLessons,
  ...floridaGapLessons,
  ...regentsGapLessons,
  ...mcasGapLessons,
  ...staarGapLessons,
  ...texasK2Lessons,
  ...satAlgebraStructureLessons,
  ...remainingGapLessons,
  ...dataDisplayStateLessons,
  ...vectorMatrixLessons,
  ...statisticsProbabilityLessons,
  ...complexConicsLessons,
  ...trigonometryLessons,
  ...geometryModelingLessons,
  ...geometryRequirementGapLessons,
  ...functionBehaviorLessons,
  ...absoluteValueLessons,
  ...polynomialLessons,
  ...earlyDataLessons,
  ...linePlotLessons,
  ...distributionLessons,
  ...inferenceLessons,
  ...bivariateLessons,
  ...radicalLessons,
  ...partWholeLessons,
  ...decimalLessons,
  ...timeMoneyLessons,
  ...attributeLessons,
  ...comparisonLessons,
  ...numberSenseLessons,
  ...multiplyDivideLessons,
  ...addSubtractLessons,
  ...factsLessons,
  ...factArrayLessons,
  ...combinatoricsLessons,
  ...areaVolumeLessons,
  ...transformationLessons,
  ...angleTriangleLessons,
  ...realNumberLessons,
  ...numberSystemLessons,
  ...ratioRateLessons,
  ...patternFunctionLessons,
  ...linearFunctionLessons,
  ...quadraticStructureLessons,
  ...functionToolkitLessons,
  ...twoVariableLessons,
  ...equationLessons,
  ...rationalLessons,
  ...circleMeasurementLessons,
  ...volumeCoordinateLessons,
  ...shapeLessons,
  ...angleLessons,
  ...polygonLessons,
  ...exponentialLessons,
  ...probabilityRulesLessons,
  ...similarityTrigLessons,
  ...congruenceLessons,
  ...coordinateCircleLessons,
  ...algebraStatisticsLessons,
  ...powerLessons,
  ...percentChangeLessons,
  successivePercentChangeLesson,
  slopeTriangleStatementsLesson,
  ...inequalityLessons,
  ...linearSystemLessons,
  ...rationalExpressionLessons,
  ...radicalEquationLessons,
  ...rationalEquationLessons,
  ...geometryProofLessons,
  ...geometryProofFamilyLessons,
  ...k8RepresentationLessons,
  ...nonlinearSystemLessons,
  ...baseLessons,
  ...extendedLessons,
  ...graphicalLessons,
  ...elementaryLessons,
  ...algebraLessons,
  ...measurementLessons,
  ...choiceLessons,
  // Frozen legacy list above; families append from src/families/.
  ...familyRegistry.lessons,
];
