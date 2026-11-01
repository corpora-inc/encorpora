import { satCompletionMethods } from "./sat-completion-lessons";
import { satGeometryDataMethods } from "./sat-geometry-data-lessons";
import { satGeometryAdvancedMethods } from "./sat-geometry-advanced-lessons";
import { congruenceMethods } from "./congruence-lessons";
import { assessmentGapMethods } from "./assessment-gap-lessons";
import { radicalEquationMethods } from "./radical-equation-lessons";
import { rationalEquationMethods } from "./rational-equation-lessons";
import { geometryProofMethods } from "./geometry-proof-lessons";
import { geometryProofFamilyMethods } from "./geometry-proof-family-lessons";
import { k8RepresentationMethods } from "./k8-representations-lessons";
import { rationalExpressionMethods } from "./rational-expression-lessons";
import { nonlinearSystemMethods } from "./nonlinear-system-lessons";
import { areaVolumeMethods } from "./area-volume-lessons";
import { transformationMethods } from "./transformation-lessons";
import { completingSquareMethods } from "./completing-square-lessons";
import { factoringMethods } from "./factoring-lessons";
import { numberSystemMethods } from "./number-system-lessons";
import { ratioRateMethods } from "./ratio-rate-lessons";
import { patternFunctionMethods } from "./pattern-function-lessons";
import { linearFunctionMethods } from "./linear-function-lessons";
import { quadraticStructureMethods } from "./quadratic-structure-lessons";
import { functionToolkitMethods } from "./function-toolkit-lessons";
import { twoVariableMethods } from "./two-variable-lessons";
import { equationMethods } from "./equation-lessons";
import { volumeCoordinateMethods } from "./volume-coordinate-lessons";
import { shapeMethods } from "./shape-lessons";
import { angleMethods } from "./angle-lessons";
import { polygonMethods } from "./polygon-lessons";
import { exponentialMethods } from "./exponential-lessons";
import { probabilityRulesMethods } from "./probability-rules-lessons";
import { similarityTrigMethods } from "./similarity-trig-lessons";
import { coordinateCircleMethods } from "./coordinate-circle-lessons";
import { algebraStatisticsMethods } from "./algebra-statistics-lessons";
import { powerMethods } from "./power-lessons";
import { distributionMethods } from "./distribution-lessons";
import { inferenceMethods } from "./inference-lessons";
import { bivariateMethods } from "./bivariate-lessons";
import { partWholeMethods } from "./part-whole-lessons";
import { decimalMethods } from "./decimal-lessons";
import { timeMoneyMethods } from "./time-money-lessons";
import { attributeMethods } from "./attribute-lessons";
import { linePlotMethods } from "./line-plot-lessons";
import { earlyDataMethods } from "./early-data-lessons";
import { combinatoricsMethods } from "./combinatorics-lessons";
import { angleTriangleMethods } from "./angle-triangle-lessons";
import { realNumberMethods } from "./real-number-lessons";
import { radicalMethods } from "./radical-lessons";
import { comparisonMethods } from "./comparison-lessons";
import { numberSenseMethods } from "./number-sense-lessons";
import { multiplyDivideMethods } from "./multiply-divide-lessons";
import { addSubtractMethods } from "./add-subtract-lessons";
import { factsMethods } from "./facts-lessons";
import { factArrayMethods } from "./fact-arrays-lessons";
import { rationalMethods } from "./rational-lessons";
import { circleMeasurementMethods } from "./circle-measurement-lessons";
import { integerExponentMethods } from "./integer-exponent-lessons";
import { descriptiveStatisticsMethods } from "./descriptive-statistics-lessons";
import { percentChangeMethods } from "./percent-change-lessons";
import { successivePercentChangeMethod } from "./successive-percent-change-lesson";
import { slopeTriangleStatementsMethod } from "./slope-triangle-statements-lesson";
import { inequalityMethods } from "./inequality-lessons";
import { linearSystemMethods } from "./linear-system-lessons";
import { rightTriangleMethods } from "./right-triangle-lessons";
import { polynomialMethods } from "./polynomial-lessons";
import { quadraticMethods } from "./quadratic-lessons";
import { complexMethods } from "./complex-lessons";
import { financeCreditMethods } from "./finance-credit-lessons";
import { hsStateGapMethods } from "./hs-state-gaps-lessons";
import { financeIncomeMethods } from "./finance-income-lessons";
import { texasHsMethods } from "./texas-hs-lessons";
import { k8StateNumberMethods } from "./k8-state-number-lessons";
import { texas38Methods } from "./texas-38-lessons";
import { satNumericEntryMethods } from "./sat-numeric-entry-lessons";
import { satFunctionFormsMethods } from "./sat-function-forms-lessons";
import { pointPlotMethods } from "./point-plot-lessons";
import { multiPartChoiceMethods } from "./multi-part-choice-lessons";
import { algebraRequirementGapMethods } from "./algebra-requirement-gaps-lessons";
import { advancedMathGapMethods } from "./advanced-math-gaps-lessons";
import { numberMeasurementGapMethods } from "./number-measurement-gaps-lessons";
import { floridaGapMethods } from "./florida-gaps-lessons";
import { regentsGapMethods } from "./regents-gap-lessons";
import { mcasGapMethods } from "./mcas-gap-lessons";
import { staarGapMethods } from "./staar-gap-lessons";
import { texasK2Methods } from "./texas-k2-lessons";
import { satAlgebraStructureMethods } from "./sat-algebra-structure-lessons";
import { remainingGapMethods } from "./remaining-gap-lessons";
import { dataDisplayStateMethods } from "./data-display-state-lessons";
import { vectorMatrixMethods } from "./vectors-matrices-lessons";
import { statisticsProbabilityMethods } from "./statistics-probability-lessons";
import { complexConicsMethods } from "./complex-conics-lessons";
import { trigonometryMethods } from "./trigonometry-lessons";
import { geometryModelingMethods } from "./geometry-modeling-lessons";
import { geometryRequirementGapMethods } from "./geometry-requirement-gaps-lessons";
import { functionBehaviorMethods } from "./function-behavior-lessons";
import { absoluteValueMethods } from "./absolute-value-lessons";
import type { ProblemMethod } from "./problem-lessons";
import { familyRegistry } from "../families/registry";
import { withFamilyEntries } from "../families/registry/aggregate";

/** Authored methods, keyed by template id. Keep each one short and complete:
 * state what is given and what to find, define terms before using them, and
 * give steps that solve every instance of the template. */
const legacyMethods: Record<string, ProblemMethod> = {
  ...assessmentGapMethods,
  ...satCompletionMethods,
  ...satGeometryDataMethods,
  ...satGeometryAdvancedMethods,
  ...completingSquareMethods,
  ...factoringMethods,
  ...volumeCoordinateMethods,
  ...shapeMethods,
  ...angleMethods,
  ...polygonMethods,
  ...exponentialMethods,
  ...probabilityRulesMethods,
  ...similarityTrigMethods,
  ...congruenceMethods,
  ...coordinateCircleMethods,
  ...algebraStatisticsMethods,
  ...powerMethods,
  ...integerExponentMethods,
  ...descriptiveStatisticsMethods,
  ...quadraticMethods,
  ...complexMethods,
  ...financeCreditMethods,
  ...hsStateGapMethods,
  ...financeIncomeMethods,
  ...texasHsMethods,
  ...k8StateNumberMethods,
  ...texas38Methods,
  ...satNumericEntryMethods,
  ...satFunctionFormsMethods,
  ...pointPlotMethods,
  ...multiPartChoiceMethods,
  ...algebraRequirementGapMethods,
  ...advancedMathGapMethods,
  ...numberMeasurementGapMethods,
  ...floridaGapMethods,
  ...regentsGapMethods,
  ...mcasGapMethods,
  ...staarGapMethods,
  ...texasK2Methods,
  ...satAlgebraStructureMethods,
  ...remainingGapMethods,
  ...dataDisplayStateMethods,
  ...vectorMatrixMethods,
  ...statisticsProbabilityMethods,
  ...complexConicsMethods,
  ...trigonometryMethods,
  ...geometryModelingMethods,
  ...geometryRequirementGapMethods,
  ...functionBehaviorMethods,
  ...absoluteValueMethods,
  ...polynomialMethods,
  ...earlyDataMethods,
  ...linePlotMethods,
  ...distributionMethods,
  ...inferenceMethods,
  ...bivariateMethods,
  ...radicalMethods,
  ...partWholeMethods,
  ...decimalMethods,
  ...timeMoneyMethods,
  ...attributeMethods,
  ...comparisonMethods,
  ...numberSenseMethods,
  ...multiplyDivideMethods,
  ...addSubtractMethods,
  ...factsMethods,
  ...factArrayMethods,
  ...combinatoricsMethods,
  ...areaVolumeMethods,
  ...transformationMethods,
  ...angleTriangleMethods,
  ...realNumberMethods,
  ...numberSystemMethods,
  ...ratioRateMethods,
  ...patternFunctionMethods,
  ...linearFunctionMethods,
  ...quadraticStructureMethods,
  ...functionToolkitMethods,
  ...twoVariableMethods,
  ...equationMethods,
  ...rationalMethods,
  ...circleMeasurementMethods,
  ...percentChangeMethods,
  "successive-percent-change": successivePercentChangeMethod,
  "slope-triangle-statements": slopeTriangleStatementsMethod,
  ...inequalityMethods,
  ...linearSystemMethods,
  ...rationalExpressionMethods,
  ...radicalEquationMethods,
  ...rationalEquationMethods,
  ...geometryProofMethods,
  ...geometryProofFamilyMethods,
  ...k8RepresentationMethods,
  ...nonlinearSystemMethods,
  // Counting and early operations
  "count-objects": {
    noLink: ["point"],
    goal: "Given a picture of dots, find how many there are.",
    method: [
      "Touch or point to one dot at a time and say the next number.",
      "Never skip a dot or count one twice.",
      "The last number you say is the total.",
    ],
    watch: "Mark where you started so you know when to stop.",
  },
  "join-within-10": {
    goal: "Given two groups, find how many there are altogether.",
    method: [
      "Count the first group.",
      "Keep counting through the second group without starting over.",
      "The last number is the total.",
    ],
    watch:
      "Keep counting from the first group's last number; do not start again at 1.",
  },
  "take-away-within-10": {
    goal: "Given a group and how many are taken away, find how many are left.",
    method: [
      "Start with the whole group.",
      "Cover or cross out the number taken away.",
      "Count the counters still showing.",
    ],
    watch: "Check: the ones left plus the ones taken make the starting group.",
  },
  "number-bond-missing": {
    goal: "Given a whole and one part, find the other part.",
    terms: ["part"],
    method: [
      "Start at the known part.",
      "Count up to the whole.",
      "How many you counted is the missing part.",
    ],
    watch: "Check: the part you found plus the known part must make the whole.",
  },
  "ten-frame-complement": {
    goal: "Given a ten-frame with some counters, find how many more fill it.",
    terms: ["ten-frame"],
    method: [
      "A ten-frame has 10 places, in two rows of 5.",
      "Count the empty places; each one needs one counter.",
      "Check: counters plus empty places make 10.",
    ],
    watch: "Count the empty places, not the counters.",
  },
  "teen-frame-compose": {
    intuition:
      "A ten-frame is a box with 10 spaces, in two rows of 5. When every space has a counter, it shows 10. To count on means to start at a number and keep counting up from there.",
    goal: "Given one full ten-frame and some extra counters, find the total.",
    method: [
      "A full ten-frame is 10. Do not count it one by one.",
      "Count on from 10 through the extra counters.",
    ],
    watch: "A teen number is 10 and some ones: 10 and 4 is 14.",
  },
  "add-within-20": {
    goal: "Given two numbers, find their sum.",
    terms: ["sum"],
    method: [
      "If the sum is 10 or less, count on from the larger number.",
      "If the sum passes 10, first move enough from one number to make the other a 10.",
      "Then add what is left to 10.",
    ],
    watch: "8 + 5: 8 needs 2 to make 10, leaving 3. So 10 + 3 = 13.",
  },
  "subtract-within-20": {
    goal: "Given two numbers, find what remains when the second is taken from the first.",
    terms: ["difference-subtract"],
    method: [
      "Count up from the smaller number to the larger number.",
      "How many you counted is the difference.",
      "Or take away in two steps: first down to 10, then the rest.",
    ],
    watch: "Check by adding: difference + second number = first number.",
  },
  "three-addend-story": {
    goal: "Given three groups, find the total.",
    method: [
      "Add any two groups first. Pairs that make 10 are easiest.",
      "Add the third group to that result.",
    ],
    watch: "The order of adding does not change the total.",
  },
  "make-ten-remainder": {
    goal: "Given a sum like 8 + 5, find what is left of the second number after making a ten.",
    method: [
      "Find how many the first number needs to reach 10.",
      "Take that many from the second number.",
      "What remains of the second number is the answer.",
    ],
    watch: "The answer is the leftover part, not the final sum.",
  },
  "subtract-through-ten": {
    goal: "Given a subtraction split at 10, find how much more must be taken away.",
    method: [
      "The full amount to remove is the number being subtracted.",
      "Some of it was already removed to reach 10.",
      "Subtract that part from the full amount to remove.",
    ],
    watch: "16 − 9: remove 6 to reach 10, then 3 more. 10 − 3 = 7.",
  },
  "unknown-addend-story": {
    goal: "Given a starting amount and a total, find the missing addend.",
    method: [
      "Write it as start + ? = total.",
      "Count up from the start to the total, or subtract: total − start.",
    ],
    watch: "Check: start + answer = total.",
  },
  "missing-start-story": {
    goal: "Given how many were taken out and how many stayed, find how many there were at first.",
    method: [
      "The start was split into two parts: taken out and stayed.",
      "Join the two parts: taken out + stayed.",
    ],
    watch: "Do not subtract. Both parts were in the box at the start.",
  },
  "balanced-addition": {
    goal: "Given an equation with a box, find the number that makes both sides equal.",
    terms: ["equal-sign"],
    method: [
      "Find the value of the complete side.",
      "On the other side, find what the box must add to the known number to reach that value.",
    ],
    watch: "5 + 5 = □ + 7: the left is 10, so □ = 3, not 10.",
  },
  // Place value
  "continue-count-to-120": {
    intuition:
      "Counting numbers are the numbers 1, 2, 3 and so on. In order, they make a pattern: each one is the one before plus 1. In 37, the 7 is in the ones place, which counts ones. The 3 is in the tens place, which counts tens.",
    goal: "Given a counting sequence, find the next number.",
    method: [
      "Each next number is one more.",
      "After a 9 in the ones place, the ones become 0 and the tens go up by one.",
    ],
    watch: "After 109 comes 110, not 1010.",
  },
  "tens-ones-model": {
    senses: { cube: "cube" },
    intuition:
      "A cube is one small block, and it stands for 1. A rod is ten cubes joined together in a row, so it stands for 10. The number shown is the tens from the rods and the ones from the cubes.",
    goal: "Given rods and small cubes, find the number shown.",
    terms: [
      ["base-ten-blocks", "A rod stands for 10: ten cubes joined together."],
      ["base-ten-blocks", "A cube stands for 1."],
    ],
    method: [
      "Count the rods. That is the tens digit.",
      "Count the cubes. That is the ones digit.",
      "Write tens then ones: 3 rods and 8 cubes is 38.",
    ],
    watch: "A rod is ten, not one: 3 rods and 8 cubes is 38, not 11.",
  },
  "ten-more-or-less": {
    goal: "Given a number, find ten more or ten less.",
    method: [
      "Change only the tens digit: up one for ten more, down one for ten less.",
      "Keep the ones digit the same.",
    ],
    watch:
      "Change the tens digit, not the ones digit: ten more than 47 is 57, not 48.",
  },
  "add-ones-regroup": {
    goal: "Given a two-digit number and some ones to add, find the new total.",
    method: [
      "Add the ones.",
      "If there are 10 or more ones, trade 10 ones for 1 ten.",
      "Write the new tens and the ones left over.",
    ],
    watch: "Add the new ten to the tens: 38 + 5 is 43, not 33.",
  },
  "subtract-whole-tens": {
    goal: "Given a number of tens and some tens to remove, find what is left.",
    method: [
      "Count tens: 50 is 5 tens, 20 is 2 tens.",
      "Subtract the tens: 5 − 2 = 3 tens.",
      "Name the value: 3 tens is 30.",
    ],
    watch:
      "Write the value of the tens left, not their count: 3 tens is 30, not 3.",
  },
  "hundreds-model": {
    goal: "Given flats, rods and cubes, find the number shown.",
    terms: [
      ["base-ten-blocks", "A flat stands for 100: ten rods side by side."],
      ["base-ten-blocks", "A rod stands for 10: ten cubes joined together."],
      ["base-ten-blocks", "A cube stands for 1."],
    ],
    method: [
      "Count flats for the hundreds digit, rods for the tens digit, cubes for the ones digit.",
      "If a kind is missing, its digit is 0.",
    ],
    watch:
      "Write 0 for a place with no blocks: 4 flats and 6 cubes is 406, not 46.",
  },
  "place-value-digit": {
    goal: "Given a number and a place, find the value of the digit in that place.",
    terms: ["place-value"],
    method: [
      "Find the digit in the named place.",
      "Multiply it by that place: tens × 10, hundreds × 100.",
    ],
    watch: "In 472 the 7 is worth 70, not 7.",
  },
  "expanded-form-missing": {
    goal: "Given a number written as hundreds + □ + ones, find the missing value.",
    terms: ["expanded-form"],
    method: [
      "Find the tens digit: the middle digit of a three-digit number.",
      "Its value is the tens digit × 10.",
      "Check: hundreds + tens + ones gives the number.",
    ],
    watch: "The box needs the value (10), not the digit (1).",
  },
  "exchange-base-ten": {
    goal: "Given a model and a trade, find how many of a unit there are after the trade.",
    method: [
      "10 ones trade for 1 ten; 10 tens trade for 1 hundred.",
      "Add one to the larger unit for each trade.",
      "Remove ten of the smaller unit for each trade.",
    ],
    watch: "A trade changes the pieces, never the total value.",
  },
  "skip-count-missing": {
    noLink: ["changes"],
    intuition:
      "A pattern is a list of numbers that changes the same way each time. In a skip-counting pattern, you add the same number each time, called the step. Counting by 5s gives 5, 10, 15, 20.",
    goal: "Given a counting pattern, find the next number.",
    method: [
      "Find the step: how much you add to get from one number to the next. From 5 to 10, the step is 5.",
      "Add the same step to the last number.",
    ],
    watch: "Add the step to the last number shown, not to the first.",
  },
  "add-several-two-digit": {
    goal: "Given several two-digit numbers, find their total.",
    method: [
      "Add all the tens: 47 + 11 + 44 has 40 + 10 + 40 = 90.",
      "Add all the ones: 7 + 1 + 4 = 12.",
      "Combine the two results: 90 + 12 = 102.",
    ],
    watch: "Add the tens as tens (40, not 4), then combine them with the ones.",
  },
  "add-with-regrouping": {
    goal: "Given two three-digit numbers, find their sum.",
    method: [
      "Add the ones. If 10 or more, write the ones digit and carry 1 ten.",
      "Add the tens plus any carry. If 10 or more, write the tens digit and carry 1 hundred.",
      "Add the hundreds plus any carry.",
    ],
    watch:
      "Carry the new ten into the tens column; never write both digits of 13 under the ones.",
  },
  "subtract-with-regrouping": {
    goal: "Given two three-digit numbers, find their difference.",
    method: [
      "Subtract place by place, starting with the ones.",
      "If the top digit is smaller, trade 1 from the next place for 10 of this place.",
      "If the next place is 0, first trade from the hundreds.",
    ],
    watch:
      "Never subtract the top digit from the bottom digit to avoid trading.",
  },
  // Multiplication and division
  "small-array-total": {
    intuition:
      "Equal rows let you count a picture quickly. Count the squares in one row, then count that same amount for every row. Multiplication is a shorter way to combine those equal groups.",
    goal: "Given an array of squares, find how many there are.",
    terms: ["array"],
    method: [
      "Count the squares in one row.",
      "Multiply by the number of rows; every row has the same number of squares.",
    ],
    watch:
      "Multiply rows by columns; adding them counts only the edge squares.",
  },
  "pairing-leftover": {
    intuition:
      "Give each counter a partner. Each pair uses two counters. When you finish, either every counter has a partner or one counter is left on its own.",
    goal: "Given a number of counters, find how many are left without a partner.",
    method: [
      "Each pair uses 2 counters, so pair them off two at a time.",
      "An even number leaves 0 unpaired; an odd number leaves 1.",
    ],
    watch: "A number is even when its ones digit is 0, 2, 4, 6 or 8.",
  },
  "equal-tray-total": {
    intuition:
      "Each tray holds the same number of items. To find the total, count that amount once for every tray. Multiplication combines the equal groups in one calculation.",
    goal: "Given a number of trays and how many are on each, find the total.",
    method: [
      "Multiply the number of trays by the number on each tray.",
      "Or skip-count by the amount on one tray, once for each tray.",
    ],
    watch: "Multiply, do not add: 4 trays of 6 is 24, not 10.",
  },
  "share-whole-items": {
    intuition:
      "Deal the items out so every tray gets the same number. You can give one to each tray and repeat. Dividing the total by the number of trays counts how many each tray receives.",
    goal: "Given a total and a number of trays, find how many go on each tray.",
    method: [
      "Divide the total by the number of trays.",
      "Or deal the items out one per tray until none are left.",
    ],
    watch: "Check: trays × each = total.",
  },
  "measure-whole-pieces": {
    intuition:
      "Imagine laying equal-length pieces end to end along the full length. The question asks how many pieces fit. Dividing the full length by one piece’s length counts the pieces.",
    goal: "Given a length and the size of each piece, find how many pieces.",
    method: [
      "Divide the full length by the length of one piece.",
      "Check: pieces × piece length = full length.",
    ],
    watch:
      "Divide by the piece length; the answer counts pieces, not centimeters.",
  },
  "unknown-group-size": {
    intuition:
      "You know the total and how many equal groups it fills. Share the total across those groups to find how much goes in each one. All the groups together must give back the total.",
    goal: "Given the number of groups and the total, find the size of each group.",
    method: [
      "Write groups × ? = total.",
      "Divide the total by the number of groups.",
      "Check: groups × answer = total.",
    ],
    watch:
      "Divide the total by the number of groups; multiplying them gives a bigger number than the total.",
  },
  "unknown-dividend": {
    intuition:
      "You know how an amount was shared and how much each group received. Put those equal shares back together to find the starting amount. Multiplication reverses the sharing.",
    goal: "Given ? ÷ $a$ = $b$, find the number being divided.",
    method: [
      "? ÷ $a$ = $b$ means ? splits into a groups of $b$.",
      "Multiply: a × b gives the missing number.",
    ],
    watch: "Multiply to undo division; dividing again gives a smaller number.",
  },
  "split-array-part": {
    intuition:
      "The picture is split into smaller regions. Look only at the region named in the question. Its equal rows tell you how many squares that part contains.",
    goal: "Given an array split into regions, find the squares in one region.",
    method: [
      "Count the rows in the named region.",
      "Multiply by the number of squares in each row.",
    ],
    watch: "Count only the named region's rows, not the whole array.",
  },
  "nested-bag-total": {
    intuition:
      "Count groups inside groups one layer at a time. First find how many bags there are altogether. Then count the items in all those bags.",
    goal: "Given groups inside groups, find the total number of items.",
    method: [
      "Multiply the outer count by the middle count to get the number of bags.",
      "Multiply by the number in each bag.",
    ],
    watch: "Multiply all three counts; adding any of them undercounts.",
  },
  "zero-one-groups": {
    intuition:
      "One group contains exactly the amount in that group. Zero groups give a total of zero; any number of empty groups also gives zero. That explains multiplying by one or zero.",
    goal: "Given a product with 0 or 1, find the total.",
    method: [
      "Any number × 0 is 0: no groups, or empty groups.",
      "Any number × 1 is that number: one group.",
    ],
    watch: "0 groups of 7 is 0, not 7; 1 group of 7 is 7, not 1.",
  },
  "neighbor-product-change": {
    intuition:
      "Adding one row to an array adds exactly the squares in that row. You can find the increase without counting the whole picture again. The number of squares in each row stays the same.",
    goal: "Given an array that gains one row, find how many squares were added.",
    method: [
      "Growing by one row adds one more group.",
      "The squares added equal the squares in one row: 8 × 2 is 7 × 2 plus 2.",
    ],
    watch: "The change is one row, not the whole new array.",
  },
  "factor-partner": {
    intuition:
      "Multiplication combines equal groups into a total. If one of the two numbers is missing, divide the total by the known number. Multiplying the pair back together checks your answer.",
    goal: "Given a product and one factor, find the other factor.",
    method: [
      "Divide the product by the known factor.",
      "Check by multiplying: factor × partner = product.",
    ],
    watch: "The partner multiplies to the product; it does not add to it.",
  },
  "tens-contribution": {
    intuition:
      "A two-digit number has a tens part and a ones part. To find the tens contribution to a multiplication, use the value of all the tens. Nine tens means ninety, rather than nine.",
    goal: "Given a product split by place value, find the tens partial product.",
    terms: ["partial-product"],
    method: [
      "Take the tens part of the split number: in 91 that is 90.",
      "Multiply it by the other factor.",
    ],
    watch: "Use 90, not 9.",
  },
  "comparison-amount": {
    intuition:
      "“Times as many” means copies of an amount. Three times as many means three equal copies put together. Multiply to count all the copies.",
    goal: "Given one amount and “$n$ times as many,” find the other amount.",
    method: [
      "“$n$ times as many” means $n$ copies of the amount.",
      "Multiply the amount by $n$: 4 times as many as 9 is 4 × 9.",
    ],
    watch: "Do not add $n$. 4 times as many as 9 is 36, not 13.",
  },
  "comparison-factor": {
    intuition:
      "Ask how many copies of one amount would make the other. For a larger amount compared with a smaller positive amount, divide the larger by the smaller. The answer counts copies, rather than the extra items.",
    goal: "Given two amounts, find how many times as many one is as the other.",
    method: [
      "Ask how many copies of the smaller amount make the larger.",
      "Divide the larger amount by the smaller.",
    ],
    watch: "Divide, do not subtract: 12 is 3 times 4, not 8 times.",
  },
  "full-kits": {
    intuition:
      "Each complete kit needs the same number of items. Keep making full kits until there are too few items for another. Any leftovers are useful items, but they do not count as a finished kit.",
    goal: "Given a supply and the amount each kit needs, find how many complete kits.",
    method: [
      "Divide the supply by the amount per kit.",
      "Keep only the whole number; ignore the remainder.",
    ],
    watch: "A kit with too few beads is not a kit: never round up.",
  },
  "seats-needed": {
    intuition:
      "Every person needs a seat. Fill each van up to its seat limit, and check whether anyone is left waiting. Even one extra person needs another van.",
    goal: "Given a number of people and seats per van, find the fewest vans.",
    method: [
      "Divide people by seats per van.",
      "If there is any remainder, add one more van for the people left.",
    ],
    watch: "Everyone needs a seat, so round up.",
  },
  "kit-leftovers": {
    intuition:
      "Make as many full kits as the supply allows. The items you cannot put into another complete kit are the leftovers. Count those remaining items, rather than the kits you made.",
    goal: "Given a supply and the amount per kit, find how many are left after making full kits.",
    method: [
      "Find the most full kits: divide and keep the whole number.",
      "Subtract kits × amount per kit from the supply.",
    ],
    watch: "The answer is the remainder, not the number of kits.",
  },
  "delivery-then-use": {
    intuition:
      "First count everything that arrived in the equal boxes. Then take away what was used. These are two separate steps: find the delivery total, then what remains.",
    goal: "Given a delivery of equal boxes and an amount used, find what remains.",
    method: [
      "Multiply boxes by items per box to get the delivery.",
      "Subtract the amount used from that total.",
    ],
    watch:
      "Find the whole delivery before subtracting; do not subtract from one box.",
  },
  "purchase-change": {
    intuition:
      "Change is the money left from your payment after the purchase is paid for. Find the cost of all the items first, then subtract that cost from the money handed over.",
    goal: "Given a number of items, their price, and the payment, find the change.",
    method: [
      "Multiply to find the cost: items × price.",
      "Subtract the cost from the payment.",
      "Check: cost + change = payment.",
    ],
    watch: "Subtract the total cost, not the price of one item.",
  },
  "two-step-change": {
    goal: "Given a story with two changes, find the result, the missing change, or the start.",
    method: [
      "Write the changes in order: start, first change, second change, end.",
      "To find the end, apply the first change, then apply the second to that new amount.",
      "To find a missing change or start, work from what you know: undo a change by doing the opposite.",
    ],
    watch:
      "Apply each change to the amount the last change made, never to the original start.",
  },
  // Measurement, perimeter, area
  "shifted-ruler-length": {
    goal: "Given an object on a ruler that does not start at 0, find its length.",
    method: [
      "Read the mark at each end.",
      "Subtract: end mark − start mark. A strip from 3 to 8 is 5 cm long.",
    ],
    watch: "Count the spaces between marks, not the marks.",
  },
  "fractional-ruler-length": {
    goal: "Given an object on a ruler marked in fractions, find its length.",
    method: [
      "Find the size of one small space.",
      "Count the spaces from one end to the other.",
      "Length = spaces × size of one space.",
    ],
    watch:
      "Count spaces, not tick marks, and start from the strip's end, not from 0.",
  },
  "clock-elapsed-minutes": {
    goal: "Given a start time and an end time, find the minutes between them.",
    method: [
      "Count minutes from the start to the next full hour.",
      "Add 60 for each full hour after that.",
      "Add the minutes past the last hour.",
    ],
    watch: "3:25 to 4:50: 35 minutes to 4:00, then 50 more. 85 minutes.",
  },
  "metric-length-rename": {
    goal: "Given a length in a larger unit, write it in a smaller unit.",
    terms: [
      [
        "metric-units",
        "For length: 1 km = 1000 m, 1 m = 100 cm, and 1 cm = 10 mm.",
      ],
    ],
    method: [
      "Find how many small units make one large unit: 1 m = 100 cm, 1 km = 1000 m.",
      "Multiply. A smaller unit needs a larger count.",
    ],
    watch:
      "Multiply when changing to a smaller unit: 3 m is 300 cm, not 3/100 cm.",
  },
  "metric-length-reverse": {
    goal: "Given a length in a smaller unit, write it in a larger unit.",
    method: [
      "Find how many small units make one large unit: 1 m = 100 cm, 1 km = 1000 m.",
      "Divide. A larger unit needs a smaller count.",
    ],
    watch:
      "Divide when changing to a larger unit: 250 cm is 2.5 m, not 25,000 m.",
  },
  "mixed-length-total": {
    goal: "Given lengths in two units, find the total in the smaller unit.",
    method: [
      "Convert the larger-unit length to the smaller unit: 3 m = 300 cm.",
      "Add the lengths, now in the same unit.",
    ],
    watch: "3 m + 31 cm is 331 cm, not 34.",
  },
  "mixed-unit-border": {
    goal: "Given a rectangle with sides in two units, find its perimeter in one unit.",
    method: [
      "Convert both sides to the same unit: 2 m = 200 cm.",
      "Perimeter = 2 × (length + width).",
    ],
    watch: "Convert before adding; 2 m + 50 cm is 250 cm, not 52.",
  },
  "rectangle-border-length": {
    goal: "Given a rectangle's side lengths, find its perimeter.",
    terms: ["perimeter"],
    method: [
      "A rectangle has two sides of each length.",
      "Perimeter = 2 × (length + width): a 5 by 3 rectangle has 2 × 8 = 16.",
    ],
    watch:
      "Add all four sides; adding only the two labeled sides gives half the perimeter.",
  },
  "rectangle-missing-border-side": {
    goal: "Given a rectangle's perimeter and one side, find the other side.",
    method: [
      "Half the perimeter is length + width: half of 20 is 10.",
      "Subtract the known side from that half: 10 − 6 = 4.",
    ],
    watch:
      "Halve the perimeter first; subtracting the known side from the whole perimeter leaves three sides.",
  },
  "rectangle-area": {
    goal: "Given a rectangle's width and height, find its area.",
    terms: ["area"],
    method: [
      "Unit squares fill the rectangle in rows: one row for each unit of height, one square in each row for each unit of width.",
      "Area = width × height, the number of squares.",
      "Write the answer in square units, such as square centimeters.",
    ],
    watch:
      "Multiply the two side lengths. Adding them gives half the perimeter, not the area.",
  },
  "rectangle-missing-area-side": {
    goal: "Given a rectangle's area and one side, find the other side.",
    method: [
      "Area = side × side, so known side × ? = area.",
      "Divide the area by the known side: 24 ÷ 6 = 4.",
    ],
    watch:
      "Divide the area by the side; subtracting it does not undo multiplication.",
  },
  "border-or-cover-unit": {
    goal: "Given a situation, choose the unit that measures it.",
    method: [
      "Along a path or edge: a length unit (cm).",
      "Covering a surface: an area unit (square cm).",
      "Filling a space: a volume unit (cubic cm).",
    ],
    watch:
      "Choose the unit by what is measured: a border is a length, even around a flat card.",
  },
  "same-area-border-choice": {
    goal: "Given rectangles with equal area, find which has the shorter perimeter.",
    method: [
      "Find each perimeter: 2 × (length + width).",
      "Compare the perimeters; the shorter border needs less ribbon.",
    ],
    watch:
      "Equal area does not mean equal perimeter. Long, thin rectangles have longer borders.",
  },
  "same-border-area-choice": {
    goal: "Given rectangles with equal perimeter, find which covers more area.",
    method: [
      "Find each area: length × width.",
      "Compare the areas; the larger product covers more.",
    ],
    watch:
      "Equal perimeter does not mean equal area. Squarer shapes cover more.",
  },
  "rectangle-two-constraints-choice": {
    goal: "Given an area and a perimeter limit, find the rectangle that meets both.",
    method: [
      "List every whole-number pair of sides whose product is the area.",
      "Find the perimeter of each pair.",
      "Pick the pair that meets the perimeter condition.",
    ],
    watch:
      "Check both conditions for each pair; a pair with the right area can still have too long a border.",
  },
  "rectangle-existence-choice": {
    goal: "Given an area and a perimeter, decide which rectangle has both, if any.",
    method: [
      "List every whole-number pair of sides whose product is the area.",
      "Find the perimeter of each pair.",
      "A pair with the given perimeter works; if none does, no such rectangle exists.",
    ],
    watch:
      "Check every factor pair before deciding no rectangle exists; 3 by 4 and 4 by 3 are the same pair.",
  },
  "whole-pack-ribbon-choice": {
    goal: "Given a length needed and two ways to buy it, find which costs less.",
    method: [
      "For whole packs, divide the length needed by the pack length and round up.",
      "Multiply each option's quantity by its price.",
      "Compare the totals.",
    ],
    watch: "You pay for a whole pack even if you use only part of it.",
  },
  // Data
  "bar-chart-total": {
    goal: "Given a bar chart, find the total of all categories.",
    method: [
      "Read each bar's top across to the scale to get its value.",
      "Write the three values down.",
      "Add them.",
    ],
    watch: "Read values from the scale; a grid line may stand for more than 1.",
  },
  "bar-chart-difference": {
    goal: "Given a bar chart, find how many more one category has than another.",
    method: [
      "Read the two named bars against the scale.",
      "Subtract the smaller value from the larger.",
      "Ignore any bar the question does not name.",
    ],
    watch: '"How many more" asks for a difference, not a total.',
  },
  "mean-data": {
    goal: "Find the mean of a list of numbers: the size each would be if the total were shared out equally.",
    terms: ["mean-average"],
    method: [
      "Add all the values to get the total. A value is one number in the list.",
      "Count the values. A repeated value counts each time it appears, so 3, 4, 4 is three values.",
      "Divide the total by the count. The mean is the size each value would be if the total were shared out equally.",
    ],
    watch:
      "Divide by how many values there are, counting repeated values each time. The list 3, 4, 4, 7, 8 has 5 values, not 4.",
  },
  "simple-probability": {
    intuition:
      "Probability means chance: how likely something is to happen. An outcome is one possible result: here, each counter in the bag is one outcome. Equally likely means every outcome has the same chance, as when same-sized counters are mixed and drawn without looking. The event is the result you ask about, such as drawing red. A favorable outcome is an outcome that makes the event happen. With equally likely outcomes, the probability is the number of favorable outcomes divided by the number of all outcomes.",
    goal: "Find the probability (the chance) of drawing one color from a bag, when every item is equally likely to be drawn.",
    senses: { event: "event" },
    terms: ["probability"],
    method: [
      "Count the favorable outcomes: the items of the color asked for. With 5 red and 12 blue, there are 5 red.",
      "Count all the outcomes: every item in the bag, of every color. Here $5 + 12 = 17$.",
      "Divide the favorable count by the total: $\\tfrac{5}{17}$. Simplify the fraction: divide the top and bottom by the same number greater than 1, if both divide by it exactly. Repeat until no such number is left.",
    ],
    watch:
      "Divide by all the items in the bag, not by the other color. With 5 red and 12 blue, the chance of red is $\\tfrac{5}{17}$, not $\\tfrac{5}{12}$.",
  },
  // Fractions
  "unit-piece-size": {
    intuition:
      "A fraction can name just one piece of a whole. If the whole is cut into equal pieces, the bottom number counts all the pieces and the top number counts the one piece you are naming.",
    goal: "Given a whole cut into equal pieces, find the fraction one piece is.",
    terms: ["denominator"],
    method: [
      "Count the equal pieces in the whole.",
      "One piece is 1 over that number: a whole in 6 equal pieces has pieces of 1/6.",
    ],
    watch:
      "The bottom number counts all the pieces in the whole, not the pieces left over.",
  },
  "fraction-model": {
    goal: "Given a shaded shape, find the fraction shaded.",
    terms: ["denominator", "numerator"],
    method: [
      "Count all equal parts. That is the denominator.",
      "Count the shaded parts. That is the numerator.",
    ],
    watch: "The parts must be equal in size.",
  },
  "fraction-unit-count": {
    intuition:
      "Count the shaded pieces one at a time. When several equal-sized strips are cut in the same way, their pieces are the same size, so you can keep counting across strips without starting over.",
    goal: "Given strips cut into equal pieces, find how many pieces are shaded.",
    method: [
      "Each strip is one whole cut into the same number of pieces.",
      "Count the shaded pieces across all the strips, without restarting at a new strip.",
    ],
    watch: "Pieces past the first whole are the same size; keep counting.",
  },
  "fraction-line-position": {
    intuition:
      "A number line measures distance from zero. When each whole is split into equal steps, count the steps to the point. The fraction tells how many steps you took and how many steps make one whole.",
    goal: "Given a number line split into equal steps, find the number at a point.",
    method: [
      "Find the size of one step: 1 ÷ steps per whole.",
      "Count the steps from 0 to the point.",
      "The number is steps over steps per whole.",
    ],
    watch:
      "Count the steps (spaces), not the tick marks, and start counting at 0.",
  },
  "fraction-whole-as-parts": {
    intuition:
      "A whole can be counted in smaller equal pieces. If each whole contains four fourths, three wholes contain twelve fourths. The amount stays the same; you are just counting it with smaller pieces.",
    goal: "Given a number of wholes, write it as a fraction with a given denominator.",
    method: [
      "Each whole is cut into denominator-many equal pieces.",
      "Count the pieces in all the wholes: numerator = wholes × denominator.",
      "Keep the denominator: 3 wholes in fourths is 12/4.",
    ],
    watch:
      "Multiply the wholes by the denominator: 3 wholes are 12/4, not 3/4.",
  },
  "equivalent-numerator": {
    intuition:
      "Cutting every piece into smaller equal pieces does not change the amount you have. It changes how many pieces you count. Both numbers in the fraction grow by the same factor, so it keeps the same value.",
    goal: "Given a fraction and a new denominator, find the matching numerator.",
    terms: ["equivalent-fractions"],
    method: [
      "Find what the denominator was multiplied by.",
      "Multiply the numerator by the same number.",
    ],
    watch:
      "Multiply the numerator by the same number as the denominator; adding the same number changes the amount.",
  },
  "equivalent-denominator": {
    intuition:
      "You can rename a fraction by bundling equal pieces into larger ones. The amount stays the same when you group the selected pieces and all the pieces in the whole in exactly the same way. Both numbers divide by the same factor.",
    goal: "Given a fraction and a new numerator, find the matching denominator.",
    method: [
      "Find what the numerator was divided by.",
      "Divide the denominator by the same number.",
    ],
    watch:
      "Divide the denominator by the same number as the numerator; subtracting the same number changes the amount.",
  },
  "fraction-equivalence-choice": {
    goal: "Given a fraction, choose another fraction that names the same amount.",
    method: [
      "Multiply or divide the numerator and denominator by the same number.",
      "A choice is equivalent if it can be made this way.",
    ],
    watch: "Adding the same number to top and bottom does not keep the amount.",
  },
  "compare-fractions": {
    goal: "Given two fractions, find the larger.",
    method: [
      "Rename both with a common denominator: multiply the two denominators.",
      "Compare the numerators.",
    ],
    watch: "Larger denominator means smaller pieces: 1/8 < 1/5.",
  },
  "like-fraction-missing-part": {
    intuition:
      "Think of the missing fraction as the pieces needed to complete a total. If all the pieces are the same size, subtract the number you already have from the number you need. Their size stays unchanged.",
    goal: "Given a fraction plus a missing fraction equal to a total, find the missing fraction.",
    method: [
      "All pieces have the same denominator.",
      "Subtract the numerators: total − known.",
      "Keep the denominator.",
    ],
    watch:
      "Keep the denominator; the missing part counts the same size of piece.",
  },
  "like-fraction-difference": {
    intuition:
      "When two fractions have the same bottom number, they count the same-sized pieces. Take away the requested number of pieces and count what is left. You do not change the piece size.",
    goal: "Given two fractions with the same denominator, find their difference.",
    method: [
      "Both fractions count the same size of piece.",
      "Subtract the numerators and keep the denominator.",
      "Simplify.",
    ],
    watch: "Do not subtract the denominators: the piece size stays the same.",
  },
  "mixed-to-improper-numerator": {
    intuition:
      "A mixed number counts some whole units and some extra pieces. To write it as one fraction, turn each whole into pieces of that same size, then include the extra pieces. The total amount does not change.",
    goal: "Given a mixed number, find the numerator of the equal improper fraction.",
    terms: ["mixed-number", "improper-fraction"],
    method: [
      "Each whole holds denominator-many pieces: 2 wholes in fifths are 10 fifths.",
      "Multiply the whole number by the denominator.",
      "Add the numerator: 2 3/5 = (10 + 3)/5 = 13/5.",
    ],
    watch:
      "Multiply the whole by the denominator before adding: 2 3/5 is 13/5, not 5/5.",
  },
  "improper-whole-part": {
    intuition:
      "The bottom number of a fraction tells how many equal pieces make a whole. Gather the pieces into complete wholes and count those wholes. A few leftover pieces do not make another whole.",
    goal: "Given an improper fraction, find how many complete wholes it contains.",
    method: [
      "The denominator says how many pieces make one whole.",
      "Group the pieces into wholes: divide the numerator by the denominator.",
      "The number of complete groups is the answer; leftover pieces do not make a whole.",
    ],
    watch: "Count only complete wholes: 22/8 holds 2 wholes, not 3.",
  },
  "improper-fractional-part": {
    intuition:
      "Make as many complete wholes as you can from the pieces. Whatever pieces are left form the fractional part. They keep their original size, so the bottom number of the fraction stays the same.",
    goal: "Given an improper fraction, find the fraction left after removing full wholes.",
    method: [
      "Divide the numerator by the denominator.",
      "The remainder over the denominator is what is left.",
      "Simplify.",
    ],
    watch:
      "Give only the leftover pieces as a fraction of one whole, not the whole-number part.",
  },
  "mixed-fraction-difference": {
    intuition:
      "You can subtract whole units and fractional pieces separately. If you need more pieces to take away, exchange one whole for smaller pieces first. That is like changing one dollar into coins: the amount stays the same.",
    goal: "Given two mixed numbers, find their difference.",
    method: [
      "If the first fraction part is smaller, rename one whole as a fraction: 3 1/3 = 2 4/3.",
      "Subtract the wholes and subtract the fractions.",
    ],
    watch:
      "Rename one whole of the first number before subtracting; never subtract the smaller fraction from the larger one.",
  },
  "add-fractions": {
    goal: "Given two fractions, find their sum.",
    intuition:
      "To add fractions, first make their pieces the same size. The bottom number, called the denominator, tells how many equal pieces make one whole. The top number, called the numerator, counts the pieces you have. Once both fractions use the same-sized pieces, add their counts.",
    terms: ["denominator", "numerator", "common-denominator"],
    method: [
      "Choose a common multiple of the denominators. Multiplying them always gives one; a smaller common multiple can reduce the work.",
      "Rename each fraction with that denominator, multiplying its top and bottom numbers by the same factor so its value stays unchanged.",
      "Add the numerators and keep the shared denominator.",
      "Simplify by dividing both numbers by a common whole-number factor greater than one, until none remains.",
    ],
    watch:
      "Keep the whole the same size. Add the counts of equal-sized pieces, not their denominators.",
  },
  "unlike-fraction-difference": {
    intuition:
      "To take one fraction away from another, first describe both using equal-sized pieces. Then subtract their piece counts. Renaming the fractions changes how you count the amounts, without changing the amounts themselves.",
    goal: "Given two fractions with different denominators, find their difference.",
    method: [
      "Rename both with a common denominator.",
      "Subtract the numerators. Keep the denominator.",
      "Simplify.",
    ],
    watch: "Subtract only after the denominators match; 3/4 − 1/2 is not 2/2.",
  },
  "fraction-distance-gap": {
    intuition:
      "The distance between two points is the length of the gap between them. Express their positions in steps of the same size, then find how many steps lie between the smaller position and the larger one.",
    goal: "Given two points on a fraction number line, find the distance between them.",
    method: [
      "Write both positions with the same denominator.",
      "Subtract the smaller from the larger.",
    ],
    watch:
      "Count the steps between the points, not from 0 to each point added together.",
  },
  "whole-times-fraction": {
    intuition:
      "Several copies of the same fraction add up like several groups of equal pieces. Count all the pieces across the groups. Their size stays the same, even if the total becomes more than one whole.",
    goal: "Given several groups of the same fraction, find the total.",
    method: [
      "$n$ groups of a/b are n × a pieces of size 1/b.",
      "Multiply the number of groups by the numerator and keep the denominator.",
      "Simplify.",
    ],
    watch: "3 × 2/5 = 6/5, not 6/15.",
  },
  "multiply-fractions": {
    goal: "Given two fractions, find their product.",
    method: [
      "Multiply the numerators: that counts the pieces.",
      "Multiply the denominators: that names the piece size.",
      "Simplify; cancelling a common factor first keeps the numbers small.",
    ],
    watch: "No common denominator is needed to multiply.",
  },
  "fraction-of-quantity": {
    intuition:
      "A fraction of an amount tells you how to split that amount and how many shares to keep. The bottom number gives the number of equal shares. The top number gives how many of those shares you want.",
    goal: "Given a whole amount and a fraction of it, find that part.",
    method: [
      "Divide the amount by the denominator to get one share.",
      "Multiply by the numerator.",
    ],
    watch:
      "Use the whole amount as the whole: 3/4 of 8 liters is 6 liters, not 3/4 liter.",
  },
  "whole-sharing-fraction": {
    intuition:
      "Sharing equally means everyone gets the same amount. You can cut whole units into equal pieces when a share is smaller than a whole. The total divided by the number of people tells you each share.",
    goal: "Given whole amounts shared equally, find each share.",
    method: [
      "Each share = total ÷ number of people.",
      "Write that division as a fraction: total over people.",
      "Simplify.",
    ],
    watch: "2 shared by 6 is 2/6 = 1/3.",
  },
  "fraction-division-expression": {
    intuition:
      "A whole is one complete unit. To share whole units equally, cut each whole into equal pieces, one per person. Each person gets one piece from each whole. The fraction's top number (numerator) counts that person's pieces; its bottom number (denominator) says how many equal pieces make one whole.",
    goal: "Given a written fraction, choose an expression with the same value.",
    terms: [
      "whole",
      ["numerator", "In this sharing model, it also counts the wholes shared."],
      ["denominator", "In this sharing model, it also counts the people."],
    ],
    method: [
      "Read the numerator as the total number of whole units being shared.",
      "Read the denominator as the number of equal shares.",
      "Choose the expression that divides the total by the share count.",
    ],
    watch:
      "Keep the order: divide the total by the share count. Reversing the numbers describes a different sharing problem.",
  },
  "unit-fraction-share": {
    intuition:
      "You already have one equal piece of a whole, and you are sharing that piece again. Cutting it into equal smaller pieces makes each share smaller. Count how many of those little pieces would fill the original whole.",
    goal: "Given a unit fraction shared equally, find each share.",
    method: [
      "Cut the 1/a into $b$ equal parts.",
      "Each part is 1/b of 1/a, so dividing 1/a among $b$ people gives 1/(a × b).",
    ],
    watch:
      "Sharing makes each part smaller: multiply the denominator by the number of people.",
  },
  "fraction-share-amount": {
    intuition:
      "A fraction such as $\\tfrac{6}{8}$ names equal pieces of one whole. Its denominator, the bottom number, says how many equal pieces make the whole. Its numerator, the top number, says how many of those pieces you have. Sharing an amount equally among 3 people means dividing it by 3. You can hand out the pieces, or cut every piece into smaller equal pieces.",
    goal: "Share a fraction of an amount equally among a number of people, and find each person's share.",
    senses: { whole: "whole" },
    terms: ["numerator", "denominator"],
    method: [
      "If the pieces can be handed out so everyone gets the same count of them, do that. $\\tfrac{6}{8}$ among 3 people is $\\tfrac{2}{8}$ each, because $6 \\div 3 = 2$.",
      "Otherwise, cut each piece into as many smaller pieces as there are people. Sharing $\\tfrac{5}{6}$ among 3 cuts each $\\tfrac{1}{6}$ piece into 3. Each small piece is $\\tfrac{1}{18}$, because $6 \\times 3 = 18$ of them make the whole.",
      "Each person takes one small piece from every original piece: $\\tfrac{5}{18}$. So $\\tfrac{a}{b}$ shared among $n$ people is $\\tfrac{a}{b \\times n}$ each.",
      "Simplify: divide the top and bottom by the same number greater than 1, if both divide by it exactly. Repeat until no such number is left. The amount stays the same.",
    ],
    watch:
      "When you cut the pieces, multiply the denominator by the number of people and keep the numerator: $\\tfrac{5}{6} \\div 3 = \\tfrac{5}{18}$, not $\\tfrac{15}{6}$.",
  },
  "whole-unit-groups": {
    intuition:
      "Small containers can fit several times into one whole unit. Work out how many fit in one whole, then count across all the wholes. The answer counts containers, rather than measuring the amount in one container.",
    goal: "Given a whole amount and a unit fraction, find how many units fit.",
    method: [
      "Each whole holds denominator-many units: one liter fills 4 containers of 1/4 liter.",
      "Multiply wholes × denominator.",
    ],
    watch:
      "Multiply by the denominator; dividing the wholes by it gives a fraction, not a count.",
  },
  "fraction-group-count": {
    noLink: ["more than"],
    intuition:
      "A fraction such as $\\tfrac{6}{4}$ means 6 equal parts, where 4 of those parts make one whole. Its numerator, the top number, counts the parts. Its denominator, the bottom number, says how many parts make one whole. A liter is an amount of liquid, a little more than a quart. So $\\tfrac{6}{4}$ liters means 6 pieces, each $\\tfrac{1}{4}$ of a liter. When two amounts use pieces of the same size, compare how many pieces each has. Pieces you have divided by pieces one container holds gives the number of containers.",
    goal: "Given a total amount and the amount one container holds, both fractions, find how many containers it fills.",
    senses: { fourth: "fourth", unit: "unit", whole: "whole", part: "part" },
    terms: ["numerator", "denominator"],
    method: [
      "Write both amounts with the same denominator, so both count pieces of the same size.",
      "Divide the numerators: total pieces ÷ pieces in one container. For $\\tfrac{6}{4}$ liters in containers of $\\tfrac{4}{4}$ liter, $6 \\div 4 = \\tfrac{3}{2}$.",
      "A leftover part counts as a fraction of a container: $\\tfrac{3}{2}$ means one full container and half of another.",
    ],
    watch:
      "The answer counts containers, not liters. A part-filled container counts as a fraction of one container, such as $\\tfrac{1}{2}$.",
  },
  "divide-fractions": {
    senses: { whole: "whole", part: "part" },
    noLink: ["change"],
    intuition:
      "A fraction such as $\\tfrac{3}{4}$ means 3 of 4 equal parts of a whole. Its numerator, the top number, counts the parts. Its denominator, the bottom number, says how many equal parts make the whole. Division means finding how many groups of one size fit into an amount. So $\\tfrac{3}{4} \\div \\tfrac{1}{8}$ asks how many pieces of size $\\tfrac{1}{8}$ fit in $\\tfrac{3}{4}$. The answer is 6, because $\\tfrac{3}{4} = \\tfrac{6}{8}$. Multiplication is the quicker way to get it: multiply by the reciprocal, the second fraction flipped upside down.",
    goal: "Divide one fraction by another and find the quotient: the answer to the division.",
    terms: ["reciprocal"],
    method: [
      "Keep the first fraction as it is.",
      "Change the division to multiplication, and flip the second fraction upside down. The flipped fraction is called its reciprocal: $\\tfrac{3}{4}$ becomes $\\tfrac{4}{3}$.",
      "Multiply the tops together and the bottoms together, then simplify: $\\tfrac{1}{2} \\div \\tfrac{10}{12} = \\tfrac{1}{2} \\times \\tfrac{12}{10} = \\tfrac{12}{20} = \\tfrac{3}{5}$.",
    ],
    watch:
      "Flip only the divisor, the second fraction: the one you divide by. Never flip the first fraction.",
  },
  // Decimals, ratio, percent
  "decimal-addition": {
    goal: "Given two decimals, find their sum.",
    method: [
      "Line up the decimal points.",
      "Add as whole numbers, carrying as usual.",
      "Put the decimal point straight below.",
    ],
    watch:
      "Line up the decimal points, not the last digits: 2.5 + 1.25 puts the 5 tenths over the 2 tenths.",
  },
  "decimal-multiplication": {
    goal: "Given two decimals, find their product.",
    method: [
      "Multiply as if there were no decimal points.",
      "Count the digits after the point in both factors.",
      "Put that many digits after the point in the product.",
    ],
    watch:
      "Do not line up the decimal points to multiply; count the decimal places instead.",
  },
  "ratio-missing": {
    noLink: ["whole", "changes", "scale"],
    intuition:
      "A ratio is a comparison of two amounts, such as 3 cups of blue paint for every 5 cups of white. We write it $3 : 5$ and read it “3 to 5”. Multiplying both amounts by the same number makes a bigger or smaller batch of the same color. That number is called the scale factor. Ratios that make the same mix are called equivalent ratios.",
    goal: "A ratio gives a mix, such as 3 cups of blue for every 5 cups of white. Find the matching amount for a new batch.",
    senses: { factor: "scale-factor" },
    terms: ["ratio"],
    method: [
      "Match the new amount to its number in the ratio. In 3 cups of blue for every 5 cups of white, 14 cups of white matches the 5.",
      "Find the scale factor, the number the whole batch is multiplied by: new amount ÷ its ratio number. Here $14 \\div 5 = 2.8$.",
      "Multiply the other ratio number by the same scale factor: $3 \\times 2.8 = 8.4$ cups of blue.",
    ],
    watch:
      "Multiply both amounts by the same number. Adding the same amount to both usually changes the mix: $3 : 5$ and $4 : 6$ make different colors.",
  },
  "unit-price": {
    noLink: ["scale"],
    goal: "Given the cost of some identical items, find the cost of a different number of them.",
    terms: ["unit-price"],
    method: [
      "Find the unit price, the cost of 1 item: total cost ÷ number of items. 10 notebooks for 100 dollars is $100 \\div 10 = 10$ dollars each.",
      "Multiply the unit price by the new number of items: 9 notebooks cost $9 \\times 10 = 90$ dollars.",
      "Check: more items must cost more, and fewer items must cost less.",
    ],
    watch:
      "Find the price of 1 item first. The given total is for a different number of items.",
  },
  "percent-of": {
    goal: "Find a percent of an amount, such as 25% of 80.",
    senses: { fourth: "fourth", whole: "whole", part: "part" },
    terms: ["percent"],
    method: [
      "Percent means per hundred, so write the percent as a fraction with 100 on the bottom: $35\\% = \\tfrac{35}{100}$.",
      "Multiply that fraction by the amount: $\\tfrac{35}{100} \\times 60 = \\tfrac{2100}{100} = 21$.",
      "Shortcuts: 10% is $\\tfrac{10}{100} = \\tfrac{1}{10}$, so divide by 10. 50% is $\\tfrac{1}{2}$, so take half. 25% is $\\tfrac{1}{4}$, so divide by 4.",
    ],
    watch:
      "The answer is a part of the stated amount, not the percent itself. 25% of 7 is $7 \\div 4 = 1.75$, not 25.",
  },
  "proportional-rule-choice": {
    goal: "From several rules, choose the one where the output is always the same number times the input.",
    senses: { rule: "rule" },
    intuition:
      "A rule is a way of turning one number into another. The input is the number you start with, and the output is the number the rule gives. Proportional means that the output $y$ is always the same fixed number times the input $x$, as in $y = 3x$. Here $3x$ means 3 times $x$. That fixed number is called the constant of proportionality. Doubling $x$ then doubles $y$, and $x = 0$ gives $y = 0$.",
    terms: ["proportional-relationship"],
    method: [
      "Look for the form $y = kx$: $x$ times one fixed number $k$, with nothing added or subtracted.",
      "Check $x = 0$. A proportional rule gives $y = 0$ there. The rule $y = 3x + 2$ gives $y = 2$, so it is not proportional.",
      "Check a second input if you are unsure: $y \\div x$ must be the same number $k$ for every input other than 0.",
    ],
    watch:
      "A rule like $y = 3x + 2$, with a number other than 0 added, is not proportional. At $x = 0$ it gives $y = 2$, not 0. So its graph misses the point $(0, 0)$, where both $x$ and $y$ are 0.",
  },
  // Integers, expressions, equations
  "integer-addition": {
    goal: "Add two integers: whole numbers or their negatives, such as 4 or $-9$.",
    senses: { change: "change" },
    noLink: ["more than", "opposite"],
    intuition:
      "An integer is a whole number (0, 1, 2, 3 and so on) or its negative, such as $-4$. A number's sign says whether it is positive (more than 0) or negative (less than 0). On a number line, a line with evenly spaced marks for numbers, adding a positive number moves right and adding a negative number moves left. Moves of the same size in opposite directions cancel.",
    method: [
      "Find the size of each number: its distance from 0, ignoring the sign. The size of $-8$ is 8.",
      "Same signs: both moves go the same way, so add the sizes and keep that sign. $(-4) + (-5) = -9$.",
      "Different signs: the moves partly cancel. Subtract the smaller size from the larger to see what is left, and keep the sign of the number with the larger size. $(-8) + 3 = -5$.",
      "Equal sizes with different signs cancel completely: $(-3) + 3 = 0$.",
    ],
    watch:
      "With different signs, the answer takes the sign of the number farther from 0: $-8 + 3 = -5$, not 5. If both are the same distance from 0, the answer is 0.",
  },
  "number-line-distance": {
    goal: "Find the distance between two points on a number line: how many units apart they are.",
    senses: { unit: "unit" },
    noLink: ["sides", "mean"],
    intuition:
      "A number line is a line with evenly spaced marks, called ticks, for numbers. A positive number is a number greater than 0, to the right of 0. A negative number is a number less than 0, to the left of 0, such as $-7$. The distance between two points is how many units, or equal steps, apart they are. A distance is never negative.",
    method: [
      "Read the number at each marked point.",
      "Subtract the smaller number from the larger: from $-7$ to 6 is $6 - (-7) = 6 + 7 = 13$.",
      "Or count from 0: when the points are on both sides of 0, add their distances from 0. $-7$ is 7 from 0 and 6 is 6 from 0, so $7 + 6 = 13$.",
    ],
    watch:
      "Subtracting a negative number adds its size. From $-7$ to 6 is $6 - (-7) = 13$, not $6 - 7$.",
  },
  "integer-power": {
    goal: "Find the value of a power such as $3^4$: the exponent counts how many copies of the base are multiplied together.",
    senses: {
      base: "base-exponent",
      square: "square-number",
      factor: "factor-number",
    },
    intuition:
      "In $3^4$, the base is the number being multiplied, 3. The exponent is the small raised number, 4: it counts how many copies of the base are multiplied together. So $3^4 = 3 \\cdot 3 \\cdot 3 \\cdot 3 = 81$, where the dot $\\cdot$ means multiply. All of $3^4$ together is called a power.",
    terms: ["base-exponent", "exponent"],
    method: [
      "Write out the factors, the numbers being multiplied: $5^3$ is $5 \\cdot 5 \\cdot 5$.",
      "Multiply step by step. Or split the copies into groups you know: four 3s are two pairs, so $3^4 = 3^2 \\cdot 3^2 = 9 \\cdot 9 = 81$.",
      "Exponent 0 gives 1 for any base other than 0. Each step down in the exponent divides by the base: $7^2 = 49$, $7^1 = 7$, and $7^0 = 7 \\div 7 = 1$.",
    ],
    watch:
      "The exponent counts copies of the base; it does not multiply the base. $8^3 = 8 \\cdot 8 \\cdot 8 = 512$, not $8 \\cdot 3 = 24$.",
  },
  "operation-order": {
    goal: "Given an expression, find its value.",
    method: [
      "Parentheses first.",
      "Then powers.",
      "Then multiplication and division, left to right.",
      "Then addition and subtraction, left to right.",
    ],
    watch: "Multiply before adding: 2 + 3 × 4 is 14, not 20.",
  },
  "substitute-linear-expression": {
    goal: "Find the value of an expression when $x$ is a given number.",
    intuition:
      "An expression, such as $-5x + 2$, is a math phrase that has a value. Here $-5x$ means $-5$ times $x$. To substitute means to replace $x$ with the given number. Put the number in parentheses, the curved brackets ( ), so its sign stays attached. Then do the arithmetic (the multiplying and adding), multiplying before adding.",
    method: [
      "Replace $x$ with the value, in parentheses and with its sign. $3x - 4$ at $x = -2$ becomes $3 \\times (-2) - 4$.",
      "Multiply first, because multiplication comes before addition and subtraction: $3 \\times (-2) = -6$.",
      "Then add or subtract: $-6 - 4 = -10$.",
    ],
    watch:
      "Keep the sign of the value. A positive number times a negative number is negative, so $3 \\times (-2)$ is $-6$, not 6.",
  },
  "distributive-expression-choice": {
    goal: "Choose the expression that equals a number times a group in parentheses, for every value of $x$.",
    senses: { term: "term-expression" },
    noLink: ["part", "parts", "side"],
    intuition:
      "An expression is a math phrase made of numbers, letters and operations, such as $x + 2$. A number written right before parentheses, the curved brackets ( ), multiplies everything inside them. So $3(x + 2)$ means 3 groups of $x + 2$, which is $3x + 6$. The parts joined by + or − are called terms. Multiplying the outside number by each term inside is called distributing. Two expressions are equivalent when they have the same value for every number put in for $x$.",
    method: [
      "Multiply the outside number by every term inside the parentheses.",
      "Keep each sign. Treat subtraction as adding a negative: $-2(x - 4) = (-2) \\times x + (-2) \\times (-4) = -2x + 8$.",
      "Pick the choice that matches both new terms.",
    ],
    watch:
      "Multiply the constant (the term with no letter) too. $3(x + 5)$ is $3x + 15$, not $3x + 5$.",
  },
  "combine-like-coefficient": {
    goal: "Combine like terms in an expression, then find the coefficient of $x$: the number multiplying $x$.",
    senses: { term: "term-expression" },
    noLink: ["change", "part", "parts"],
    intuition:
      "An expression is a math phrase made of numbers, letters (variables) and operations, such as $6x - 8x + 3$. The parts joined by + or − are called terms. Like terms have the same letter part, such as $6x$ and $-8x$. The coefficient is the number multiplying the letter: in $6x$ it is 6. A constant is a term with no letter, such as 3. Think of $x$ as one kind of item: adding 6 of them and subtracting 8 of them is the same as subtracting 2 in all, because $6 - 8 = -2$.",
    terms: ["coefficient", "like-terms"],
    method: [
      "Find the $x$ terms. Each coefficient keeps the sign in front of it: $5x - 2x$ has coefficients 5 and $-2$.",
      "Add those coefficients: $5 + (-2) = 3$, so $5x - 2x = 3x$.",
      "Leave the constants out. They are not numbers of $x$'s, so they do not change the coefficient.",
    ],
    watch:
      "A constant is not an $x$ term. When you combine like terms, leave it out of the coefficient.",
  },
  "linear-equation": {
    noLink: ["change"],
    intuition:
      "An equation has two sides: the amount on the left of the equal sign and the amount on the right. It says they are equal. In $11x + 3 = -63$, the letter $x$ stands for an unknown number, and $11x$ means 11 times $x$. The number that makes the equation true is called the solution. To find it, undo what was done to $x$, last step first. Make the same change on both sides so they stay equal.",
    goal: "Solve an equation like $11x + 3 = -63$: find the number $x$ that makes both sides equal.",
    senses: { side: "side-of-equation" },
    method: [
      "Undo the adding first. Subtract 3 from both sides: $11x = -66$. Both sides stay equal.",
      "Undo the multiplying. Divide both sides by 11, the number multiplying $x$: $x = -6$.",
      "Check by putting $-6$ in place of $x$: $11 \\times (-6) + 3 = -66 + 3 = -63$. It matches.",
    ],
    watch:
      "Subtract the added number from both sides before dividing. If you divide first, you must divide the added number too.",
  },
  "negative-coefficient-equation": {
    goal: "Solve an equation in which $x$ is multiplied by a negative number.",
    senses: { side: "side-of-equation" },
    intuition:
      "An equation has two sides: the amount on the left of the equal sign and the amount on the right. It says they are equal. In $-4x - 8 = -7$, the letter $x$ stands for an unknown number. The number that makes the equation true is called the solution. In $-4x$, the $-4$ is the coefficient: the number multiplying $x$. Here it is a negative number, a number less than 0. To find $x$, undo each step done to it. Do the same thing to both sides so they stay equal.",
    method: [
      "Undo the added or subtracted number. In $-4x - 8 = -7$, add 8 to both sides: $-4x = 1$.",
      "Divide both sides by the coefficient, sign and all: $x = 1 \\div (-4) = -\\tfrac{1}{4}$.",
      "Check by putting the value back into the starting equation: $-4 \\times (-\\tfrac{1}{4}) - 8 = 1 - 8 = -7$.",
    ],
    watch:
      "Divide by the negative coefficient with its sign: $-3x = 12$ gives $x = -4$, not 4.",
  },
  "rational-coefficient-equation": {
    noLink: ["leaves"],
    goal: "Solve an equation in which $x$ is multiplied by a fraction.",
    senses: { side: "side-of-equation" },
    intuition:
      "An equation has two sides: the amount on the left of the equal sign and the amount on the right. It says they are equal. In $\\tfrac{5}{6}x - 7 = 3$, $\\tfrac{5}{6}x$ means $\\tfrac{5}{6}$ times $x$. So the coefficient, the number multiplying $x$, is a fraction. A fraction's reciprocal is the fraction flipped upside down: the reciprocal of $\\tfrac{5}{6}$ is $\\tfrac{6}{5}$. A fraction times its reciprocal is 1.",
    method: [
      "Undo the added or subtracted number on both sides. In $\\tfrac{5}{6}x - 7 = 3$, add 7: $\\tfrac{5}{6}x = 10$.",
      "Multiply both sides by the reciprocal of the fraction. $\\tfrac{6}{5} \\times \\tfrac{5}{6}x = x$, and $\\tfrac{6}{5} \\times 10 = 12$, so $x = 12$.",
      "Check: $\\tfrac{5}{6} \\times 12 - 7 = 10 - 7 = 3$.",
    ],
    watch:
      "Multiply by the reciprocal, not by the fraction itself: $\\tfrac{2}{3}x = 4$ gives $x = 4 \\times \\tfrac{3}{2} = 6$.",
  },
  "grouped-linear-equation": {
    noLink: ["whole"],
    goal: "Solve an equation like $a(x + b) = c$, where a number multiplies a group in parentheses.",
    senses: { side: "side-of-equation" },
    intuition:
      "An equation has two sides: the amount on the left of the equal sign and the amount on the right. It says they are equal. A number written right before parentheses, the curved brackets ( ), multiplies everything inside them. So $3(x + 2)$ means 3 times the whole amount $x + 2$. To find $x$, undo the steps done to it in reverse order. The multiplying happened last, so undo it first.",
    method: [
      "Divide both sides by the number outside the parentheses, which is never 0 here: $3(x + 2) = 15$ becomes $x + 2 = 5$. Both sides stay equal.",
      "Undo the number added inside: subtract 2 from both sides, so $x = 3$.",
      "Check: $3(3 + 2) = 3 \\times 5 = 15$.",
    ],
    watch:
      "Divide the whole right side by the outside number before undoing the number inside. Keep a negative sign: $-1(x + 8) = -9$ gives $x + 8 = 9$.",
  },
  "both-sides-linear-equation": {
    goal: "Solve an equation that has $x$ on both sides.",
    senses: { side: "side-of-equation", term: "term-expression" },
    noLink: ["parts", "whole"],
    intuition:
      "An equation has two sides: the amount on the left of the equal sign and the amount on the right. It says they are equal. The number for $x$ that makes them equal is called the solution. Here $x$ appears on both sides, as in $-2x + 11 = -x - 1$. Terms are the parts joined by + or −, such as $-2x$ and 11. An $x$ term has $x$ in it, and a constant is a number with no $x$. Gather the $x$ terms on one side and the constants on the other.",
    method: [
      "Add or subtract an $x$ term on both sides so $x$ is on one side only. In $-2x + 11 = -x - 1$, add $2x$ to both sides: $11 = x - 1$.",
      "Move the constants to the other side the same way. Add 1 to both sides: $12 = x$.",
      "If a number still multiplies $x$, divide both sides by it. Check in the starting equation: both sides give $-13$.",
    ],
    watch:
      "Do each step to both whole sides, and keep the sign in front of each term: $-x$ means $-1$ times $x$.",
  },
  "check-equation-candidate": {
    noLink: ["whole"],
    goal: "Decide whether a given value of $x$ is a solution of an equation: whether it makes both sides equal.",
    senses: { side: "side-of-equation" },
    intuition:
      "An equation has two sides: the amount on the left of the equal sign and the amount on the right. It says they are equal. A number for $x$ that makes the two sides equal is called a solution. Such a number is said to satisfy the equation. To substitute means to replace $x$ with a number. Put the number in parentheses, the curved brackets ( ), so its sign stays. Then work out each side. You do not need to solve the equation.",
    method: [
      "Replace $x$ with the value on the left side, in parentheses, and work it out: at $x = -3$, $6(-3) + 3 = -18 + 3 = -15$.",
      "Work out the right side the same way.",
      "The value is a solution only if the two sides come out equal.",
    ],
    watch:
      "Work out the whole left side with the value in place, and keep the value's sign. Do not solve the equation instead.",
  },
  "equation-solution-count": {
    goal: "Decide whether an equation in $x$ has one solution, no solution, or infinitely many.",
    senses: { side: "side-of-equation", term: "term-expression" },
    noLink: ["parts", "mean"],
    intuition:
      "An equation has two sides: the amount on the left of the equal sign and the amount on the right. It says they are equal. A solution is a number for $x$ that makes both sides equal. Terms are the parts joined by + or −, such as $2x$ and 9. A linear equation has $x$ terms but nothing like $x^2$ ($x$ times $x$). It can have exactly one solution, no solution, or infinitely many, meaning every number works. Gather the $x$ terms on one side and see what is left.",
    method: [
      "Add or subtract $x$ terms so all of them are on one side. Move the constants, the plain numbers, to the other side.",
      "If some $x$ is left, as in $-4x = 5$, there is exactly one solution.",
      "If the $x$ terms cancel and a false statement is left, such as $0 = 5$, no number works: there is no solution.",
      "If the $x$ terms cancel and a true statement is left, such as $0 = 0$, every number works: there are infinitely many solutions.",
    ],
    watch:
      "When the $x$ terms cancel, look at the numbers left. $0 = 0$ means every number works, not that $x = 0$.",
  },
  "linear-system-x": {
    goal: "Two equations use the same unknowns $x$ and $y$. Find the value of $x$ in the pair that makes both equations true.",
    senses: {
      side: "side-of-equation",
      term: "term-expression",
      difference: "difference-subtract",
    },
    noLink: ["part", "parts", "whole"],
    intuition:
      "A system is two equations about the same unknown numbers. Its solution is the pair that makes both true at once. The coefficient of $y$ is the number multiplying $y$. When both equations have the same coefficient of $y$, subtracting one equation from the other removes $y$. In a system with exactly one solution, the $x$ parts do not also cancel, so an equation in $x$ alone is left.",
    method: [
      "Make the $y$ coefficients match. Multiply each whole equation, every term (each part joined by + or −) on both sides, by a number that is not 0. For $5y$ and $4y$, multiply the first equation by 4 and the second by 5, so both have $20y$.",
      "Subtract one equation from the other, term by term on both sides. The $y$ terms cancel: they subtract to 0.",
      "Solve the equation that is left for $x$.",
    ],
    watch:
      "Multiply every term of an equation, including the number on the right side.",
  },
  // Lines and functions
  "coordinate-point-reading": {
    goal: "Read one coordinate of a point on a grid: how far across, or how far up or down, it is.",
    senses: { unit: "unit" },
    intuition:
      "A coordinate grid has two number lines called axes. The $x$-axis runs across and the $y$-axis runs up and down. They cross at 0. Each point has two coordinates, the numbers that give its position. The first says how far across the point is from the $y$-axis: right is positive, left is negative. The second says how far up (positive) or down (negative) it is from the $x$-axis. Together they are written $(x, y)$, which is called an ordered pair.",
    terms: [
      [
        "coordinate",
        "$x$ is the distance across from the $y$-axis; $y$ is the distance up from the $x$-axis.",
      ],
    ],
    method: [
      "For the $x$-coordinate, count grid steps across from the vertical $y$-axis. Right is positive and left is negative.",
      "For the $y$-coordinate, count grid steps up or down from the horizontal $x$-axis. Up is positive and down is negative.",
      "A point is written $(x, y)$: the across number first, then the up-or-down number.",
    ],
    watch:
      "The $x$-coordinate is the across distance and comes first. Do not swap it with $y$.",
  },
  "line-slope": {
    goal: "Find the slope of the line through two given points.",
    senses: { change: "change" },
    noLink: ["opposite"],
    intuition:
      "A point such as $(3, 0)$ gives two numbers called coordinates. The first, the $x$-coordinate, says how far right of the starting point $(0, 0)$ to go; a negative number means left. The second, the $y$-coordinate, says how far up; a negative number means down. Slope measures how steep a line is: the change in $y$ divided by the change in $x$ between two points on the line.",
    terms: ["slope"],
    method: [
      "Call one point point 1 and the other point 2. In each, the first number is $x$ and the second is $y$.",
      "Change in $y$: subtract point 1's $y$ from point 2's $y$.",
      "Change in $x$: subtract point 1's $x$ from point 2's $x$, in the same order.",
      "Divide the change in $y$ by the change in $x$. Simplify the fraction by dividing its top and bottom by any number that goes into both.",
    ],
    watch:
      "Use the same point first in both subtractions. Mixing the order gives the opposite sign (positive instead of negative, or the reverse) whenever the slope is not 0.",
  },
  "graphed-line-slope": {
    goal: "Find the slope (the steepness) of a line drawn on a grid through two marked points.",
    senses: { change: "change" },
    intuition:
      "Slope means how steep a line is. Each point on the grid has coordinates, the pair $(x, y)$ that says how far across and how far up it is. Pick two points on the line. The rise is the change in $y$: how far up (positive) or down (negative) you go. The run is the change in $x$: how far right (positive) or left (negative) you go. The slope is the rise divided by the run. A line that falls from left to right has a negative slope.",
    method: [
      "Read both points' coordinates $(x, y)$ from the grid.",
      "Change in $y$: the second point's $y$ minus the first point's $y$. Change in $x$: the second point's $x$ minus the first point's $x$, in the same order.",
      "Slope = change in $y$ ÷ change in $x$. Simplify the fraction.",
    ],
    watch:
      "Subtract in the same order both times. A line falling to the right has a negative slope.",
  },
  "unequal-step-rate": {
    noLink: ["jump"],
    goal: "Given points from a straight-line rule, find how much the output changes for each 1 added to the input.",
    senses: { change: "change", rule: "rule", unit: "unit" },
    intuition:
      "A rule is a way of turning one number into another. The input is the number you start with, and the output is the number the rule gives. A pair such as $(3, 11)$ lists the input first, then the output. A linear rule changes its output by the same amount for each increase of 1 in the input. The rate is the amount the output changes for each 1 added to the input. The given inputs may jump by different amounts, so divide the output change by the input change.",
    method: [
      "Pick any two of the given points.",
      "Find the output change and the input change, subtracting in the same order. From $(1, 4)$ to $(4, 10)$, the output change is $10 - 4 = 6$ and the input change is $4 - 1 = 3$.",
      "Rate = output change ÷ input change: $6 \\div 3 = 2$ for each input unit.",
    ],
    watch:
      "The input steps may differ in size. Always divide by the input change; the output change alone is not the rate.",
  },
  "recover-linear-intercept": {
    goal: "Given the rate of a straight-line rule and one point on it, find the output when the input is 0.",
    senses: { change: "change", rule: "rule" },
    intuition:
      "A rule is a way of turning one number into another. The input is the number you start with, and the output is the number the rule gives. A linear rule can be written $y = mx + b$, with input $x$ and output $y$. Here $mx$ means $m$ times $x$. The rate is how much the output changes for each increase of 1 in the input, and we write it $m$. The output when the input is 0 is $b$, because then $mx = 0$. On a graph, $b$ is where the line crosses the $y$-axis.",
    terms: [["y-intercept", "In $y = mx + b$, it is $b$."]],
    method: [
      "Put the point's input and output into $y = mx + b$. Rate 2 through $(1, 8)$ gives $8 = 2 \\times 1 + b$.",
      "Solve for $b$: subtract the rate times the input from the output. $b = 8 - 2 = 6$.",
      "$b$ is the output when the input is 0.",
    ],
    watch:
      "Subtract the rate times the input, not the rate alone. Through $(3, 10)$ with rate 2, $b = 10 - 6 = 4$, not 8.",
  },
  "linear-initial-value-meaning": {
    goal: "Explain the starting amount in a linear model.",
    senses: {
      model: "model",
      term: "term-expression",
      unit: "unit",
      rule: "rule",
      change: "change",
      "more than": "more-than",
    },
    noLink: ["mean", "part"],
    intuition:
      "A model is a rule that links two quantities. The input is the number you put in, such as the time since filling began. The output is the number that comes out, such as the amount of water. In a model such as $V = 3t + 16$, $3t$ means 3 times $t$, so that part grows as time passes. The rate is the number multiplying the input: how much the output changes per input unit. It is negative when the output goes down, as when a candle burns shorter. When the input is 0, the multiplied part is 0. The number left over, 16, is the output at the start.",
    terms: ["input", "output", "initial-value", "rate"],
    method: [
      "Read what the input measures, and what moment input 0 stands for, such as the start of filling.",
      "Set the input to 0. The multiplied part becomes 0, so the output is the number left over, in output units.",
      "Choose the statement about that output at input 0. Reject statements about a change for each unit or about a later amount.",
    ],
    watch:
      "Keep amount and rate units apart. A liter is an amount of liquid, a little more than a quart. A starting amount uses output units, such as liters. A rate uses output units per input unit, such as liters per minute.",
  },
  "predict-linear-output": {
    goal: "Given two points on a straight-line rule, find the output at a new input.",
    senses: { change: "change", rule: "rule" },
    intuition:
      "A rule is a way of turning one number into another. The input is the number you start with, and the output is the number the rule gives. A pair such as $(1, 3)$ lists an input, then its output. A linear rule changes the output by the same amount for each increase of 1 in the input. That amount is called the rate. To predict, start from a known point and add the rate once for every input step to the new input.",
    method: [
      "Rate = output change ÷ input change. Through $(1, 3)$ and $(3, -1)$: $(-1 - 3) \\div (3 - 1) = -4 \\div 2 = -2$.",
      "Find the input change from a known point to the new input: from 3 to 7 is 4.",
      "New output = known output + rate × input change: $-1 + (-2) \\times 4 = -9$.",
    ],
    watch:
      "Multiply the rate by the input change. Adding the rate once moves only one input step.",
  },
  "graph-equation-choice": {
    goal: "Given a line on a grid, choose its equation.",
    senses: { rule: "rule", change: "change" },
    intuition:
      "The equation of a straight line can be written $y = mx + b$, where $mx$ means $m$ times $x$. The slope is how much $y$ changes for each step of 1 to the right, and we write it $m$. Up is positive and down is negative. The $y$-intercept is the $y$-value where the line crosses the $y$-axis, the vertical axis where $x = 0$. We write it $b$.",
    method: [
      "Read $b$: the $y$-value where the line crosses the vertical $y$-axis.",
      "Find the slope $m$ from two points: change in $y$ ÷ change in $x$, subtracting in the same order.",
      "Write $y = mx + b$ and pick the choice that matches both numbers.",
    ],
    watch:
      "Do not swap the slope and the intercept. The line crosses the $y$-axis at $b$, the number added. The slope $m$ multiplies $x$.",
  },
  "relation-function-choice": {
    noLink: ["more than", "rule"],
    goal: "From lists of (input, output) pairs, choose the one that is a function: one output for every input.",
    intuition:
      "A relation is a set of pairs of numbers. In each pair, the input is the first number and the output is the second. A relation is a function when every input has exactly one output. So the same input can never appear with two different outputs. Two different inputs may share the same output.",
    terms: ["function"],
    method: [
      "In each list, look for an input that appears more than once.",
      "If a repeated input has two different outputs, that list is not a function.",
      "Pick the list where every input has only one output.",
    ],
    watch:
      "Different inputs may share an output: $(1, 5)$ and $(2, 5)$ are fine in a function. Only a repeated input with different outputs breaks the rule.",
  },
  "relation-point-removal": {
    goal: "Find every single point whose removal makes a plotted relation a function.",
    noLink: ["leaves", "rule"],
    intuition:
      "Each plotted point is a pair $(x, y)$. The input is the first number, $x$, and the output is the second, $y$. These two numbers are the point's coordinates. A relation is a set of such pairs. It is a function when each input has only one output. Two points straight above each other have the same $x$ and different $y$, so they break this rule. Removing either one of them fixes it.",
    terms: ["function"],
    method: [
      "Find two plotted points with the same $x$-coordinate and different $y$-coordinates.",
      "Test removing each labeled point, one at a time. Keep a removal if every input still on the graph has only one output.",
      "Choose the answer that lists every removal that works.",
    ],
    watch:
      "Test each point separately. With one clashing pair, either of its points can be removed; removing any other point keeps the clash.",
  },
  "distance-graph-meaning": {
    noLink: ["part", "mean"],
    goal: "Given a distance–time graph, describe how the distance from home changes between two points.",
    senses: { change: "change" },
    intuition:
      "A distance–time graph shows time along the horizontal axis, the line across the bottom. It shows distance from home on the vertical axis, the line going up. A rising line means the distance is growing. A falling line means it is shrinking: the person is getting closer to home. A level line means the distance is not changing.",
    method: [
      "Look at the part of the graph from the first point to the second.",
      "Rising to the right: the distance from home increases.",
      "Falling to the right: the distance decreases. Level: the distance stays the same.",
    ],
    watch:
      "The graph shows distance from home, not the path walked. A level part can still mean moving, such as walking in a circle around home.",
  },
  "shared-plan-input": {
    goal: "Given two cost rules, find the input where they cost the same.",
    senses: {
      side: "side-of-equation",
      term: "term-expression",
      rule: "rule",
      unit: "unit",
    },
    noLink: ["mean", "whole"],
    intuition:
      "Each plan's cost is an amount in dollars that depends on $x$. The input is the number $x$, such as a number of hours. In $16 + 2x$, $2x$ means 2 times $x$. The rate is the number multiplying $x$: the cost for each unit of input. An equation has two sides: the amount on the left of the equal sign and the amount on the right. It says they are equal. Set the two costs equal in an equation and solve it for $x$.",
    method: [
      "Set the two costs equal: $20 + 3x = 5x$.",
      "Subtract the smaller amount of $x$ from both sides: $20 = 2x$.",
      "Divide both sides by the number multiplying $x$: $x = 10$. The answer may be a fraction.",
    ],
    watch:
      "Set the whole costs equal. Comparing only the rates, or only the fixed fees (the numbers with no $x$), does not find where the costs match.",
  },
  "first-cheaper-whole-input": {
    goal: "Given two cost rules, find the first whole-number input where one plan costs strictly less.",
    senses: { rule: "rule", unit: "unit" },
    noLink: ["mean", "whole"],
    intuition:
      "Each plan's cost depends on $x$. The input is the number $x$, such as a number of hours. The rate is the number multiplying $x$: the cost for each hour. Strictly cheaper means costing less, not the same. First find the tie, where both cost the same, by setting the costs equal. Then look just past the tie. A whole input is one of 0, 1, 2, 3 and so on.",
    method: [
      "Set the costs equal and solve for the tie: $18 + x = 2x$ gives $x = 18$.",
      "Test a whole input just above the tie to see which plan is cheaper there. At 19, Plan A costs $18 + 19 = 37$ and Plan B costs $2 \\times 19 = 38$.",
      "The answer is the first whole number past the tie where the plan is cheaper. If the tie is a whole number, take the next one.",
    ],
    watch:
      "At the tie the costs are equal, not cheaper. Take the next whole number, even when the tie is a whole number.",
  },
  "function-evaluation": {
    goal: "Given a rule $f(x)$ and an input, find the output.",
    method: [
      "Replace every $x$ in the rule with the input, in parentheses: $f(-3) = 2(-3)^2 + 3(-3) + 5$.",
      "Work out powers first: $(-3)^2$ means $(-3) \\times (-3) = 9$, because a negative times a negative is positive.",
      "Then multiply, then add: $2 \\times 9 + 3 \\times (-3) + 5 = 18 - 9 + 5 = 14$.",
    ],
    watch:
      "Square the input before multiplying by its coefficient, the number in front of it. Keep the parentheses: $(-3)^2 = 9$, but $-3^2 = -9$.",
  },
  "arithmetic-term": {
    intuition:
      "A sequence is a list of numbers in order, and each number in it is called a term. An arithmetic sequence is a sequence where you add the same amount each time to get the next term. That amount is called the common difference. In 4, 7, 10, 13, the common difference is 3. To find a later term, count how many jumps of 3 it takes from the first term.",
    goal: "Given the first term and the common difference of an arithmetic sequence, find term $n$.",
    senses: { term: "term-sequence", jump: "jump" },
    terms: ["arithmetic-sequence"],
    method: [
      "Each term is the term before it plus the common difference $d$.",
      "Term $n$ is $n - 1$ steps after term 1. For example, term 3 is 2 steps after term 1.",
      "So term $n$ is the first term plus $(n - 1) \\times d$. First term 19 and $d = 7$ give term 3: $19 + 2 \\times 7 = 33$.",
    ],
    watch: "Use $n - 1$ steps, not $n$: term 1 itself has no steps added.",
  },
  "geometric-sequence": {
    goal: "Given the first term and the common ratio of a geometric sequence, find term $n$.",
    senses: { term: "term-sequence" },
    intuition:
      "A sequence is a list of numbers in order, and each number in it is called a term. A geometric sequence is a sequence where you multiply by the same number each time to get the next term. That number is called the common ratio. In 1, 3, 9, 27, the common ratio is 3. A sequence can also shrink: dividing by 5 each time is multiplying by the common ratio $\\tfrac{1}{5}$.",
    terms: ["geometric-sequence"],
    method: [
      "Each term is the term before it times the common ratio $r$.",
      "From term 1 to term $n$ there are $n - 1$ steps, so multiply by $r$ that many times.",
      "So term $n$ is the first term times $r^{n - 1}$, which means $r$ multiplied $n - 1$ times. First term 1 and $r = 3$ give term 5: $1 \\times 3^4 = 81$.",
    ],
    watch:
      "Multiply by $r$ only $n - 1$ times, not $n$ times: term 1 is not multiplied by $r$ at all.",
  },
  "quadratic-vertex": {
    noLink: ["part"],
    goal: "Find the minimum value, the smallest output, of $f(x) = a(x - h)^2 + k$ when $a$ is positive.",
    senses: { square: "square-number", vertex: "vertex-parabola" },
    intuition:
      "In $f(x) = 2(x - 6)^2 + 9$, the input is the number put in for $x$. The output is the value $f(x)$, read “$f$ of $x$”, that comes out. Here $x$ can be any real number, which means any number on the number line. Squared means multiplied by itself, so $(x - 6)^2$ means $(x - 6)$ times $(x - 6)$. A squared number is never negative, and $(x - 6)^2$ is 0 when $x = 6$. So the smallest output comes when that part is 0: $f(6) = 9$. That smallest output is called the minimum value.",
    method: [
      "Compare $f(x)$ with the form $f(x) = a(x - h)^2 + k$. In $f(x) = 2(x - 6)^2 + 9$, $a = 2$, $h = 6$ and $k = 9$.",
      "The squared part $(x - h)^2$ is 0 when $x = h$ and positive at every other input. Times a positive $a$, it only adds to $k$.",
      "So the smallest value of $f(x)$ is $k$, reached at $x = h$. Here it is 9, at $x = 6$.",
    ],
    watch:
      "The minimum value is $k$, the smallest output. The number $h$ is the input where it happens, not the minimum.",
  },
  "logarithm-integer": {
    goal: "Given log base $b$ of $N$, find its value.",
    intuition:
      "A power like $2^3 = 8$ has two parts. The base is the number being multiplied, 2, and the exponent is the small raised number, 3, that counts the copies. A logarithm is the exponent you are looking for. $\\log_b N$ is read “log base $b$ of $N$”. In these problems the answer is a whole number, so it counts how many copies of $b$ multiply to give $N$. So $\\log_2 8 = 3$.",
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      product: "product-multiply",
    },
    noLink: ["parts"],
    terms: ["logarithm"],
    method: [
      "$\\log_b N$ asks: $b$ to what power gives $N$?",
      "Multiply copies of $b$ together and keep count: one copy is $b$, two copies make $b^2 = b \\times b$, three make $b^3$, and so on.",
      "The number of copies that multiply to give $N$ is the logarithm.",
    ],
    watch:
      "The logarithm is the exponent, not $N \\div b$. $\\log_2 8$ is 3, because $2^3 = 8$. It is not 4.",
  },
  ...rightTriangleMethods,
};
/** Frozen legacy entries, then families from src/families/. */
export const methods: Record<string, ProblemMethod> = withFamilyEntries(
  "method",
  legacyMethods,
  familyRegistry.methods,
);
