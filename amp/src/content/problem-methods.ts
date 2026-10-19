import { patternFunctionMethods } from "./pattern-function-lessons";
import { equationMethods } from "./equation-lessons";
import { volumeCoordinateMethods } from "./volume-coordinate-lessons";
import { distributionMethods } from "./distribution-lessons";
import { partWholeMethods } from "./part-whole-lessons";
import { decimalMethods } from "./decimal-lessons";
import { timeMoneyMethods } from "./time-money-lessons";
import { linePlotMethods } from "./line-plot-lessons";
import { earlyDataMethods } from "./early-data-lessons";
import { combinatoricsMethods } from "./combinatorics-lessons";
import { radicalMethods } from "./radical-lessons";
import { comparisonMethods } from "./comparison-lessons";
import { addSubtractMethods } from "./add-subtract-lessons";
import { factsMethods } from "./facts-lessons";
import { rationalMethods } from "./rational-lessons";
import { circleMeasurementMethods } from "./circle-measurement-lessons";
import { integerExponentMethods } from "./integer-exponent-lessons";
import { descriptiveStatisticsMethods } from "./descriptive-statistics-lessons";
import { percentChangeMethods } from "./percent-change-lessons";
import { inequalityMethods } from "./inequality-lessons";
import { linearSystemMethods } from "./linear-system-lessons";
import { rightTriangleMethods } from "./right-triangle-lessons";
import { polynomialMethods } from "./polynomial-lessons";
import { quadraticMethods } from "./quadratic-lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Authored methods, keyed by template id. Keep each one short and complete:
 * state what is given and what to find, define terms before using them, and
 * give steps that solve every instance of the template. */
export const methods: Record<string, ProblemMethod> = {
  ...volumeCoordinateMethods,
  ...integerExponentMethods,
  ...descriptiveStatisticsMethods,
  ...quadraticMethods,
  ...polynomialMethods,
  ...earlyDataMethods,
  ...linePlotMethods,
  ...distributionMethods,
  ...radicalMethods,
  ...partWholeMethods,
  ...decimalMethods,
  ...timeMoneyMethods,
  ...comparisonMethods,
  ...addSubtractMethods,
  ...factsMethods,
  ...combinatoricsMethods,
  ...patternFunctionMethods,
  ...equationMethods,
  ...rationalMethods,
  ...circleMeasurementMethods,
  ...percentChangeMethods,
  ...inequalityMethods,
  ...linearSystemMethods,
  // Counting and early operations
  "count-objects": {
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
    terms: [["part", "One of the amounts that join to make the whole."]],
    method: [
      "Start at the known part.",
      "Count up to the whole.",
      "How many you counted is the missing part.",
    ],
    watch: "Check: the part you found plus the known part must make the whole.",
  },
  "ten-frame-complement": {
    goal: "Given a ten-frame with some counters, find how many more fill it.",
    terms: [["ten-frame", "A grid of 10 places, 2 rows of 5."]],
    method: [
      "A ten-frame has 10 places, in two rows of 5.",
      "Count the empty places; each one needs one counter.",
      "Check: counters plus empty places make 10.",
    ],
    watch: "Count the empty places, not the counters.",
  },
  "teen-frame-compose": {
    goal: "Given one full ten-frame and some extra counters, find the total.",
    method: [
      "A full ten-frame is 10. Do not count it one by one.",
      "Count on from 10 through the extra counters.",
    ],
    watch: "A teen number is 10 and some ones: 10 and 4 is 14.",
  },
  "add-within-20": {
    goal: "Given two numbers, find their sum.",
    terms: [["sum", "The result of adding."]],
    method: [
      "If the sum is 10 or less, count on from the larger number.",
      "If the sum passes 10, first move enough from one number to make the other a 10.",
      "Then add what is left to 10.",
    ],
    watch: "8 + 5: 8 needs 2 to make 10, leaving 3. So 10 + 3 = 13.",
  },
  "subtract-within-20": {
    goal: "Given two numbers, find what remains when the second is taken from the first.",
    terms: [["difference", "The result of subtracting."]],
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
    goal: "Given a starting amount and the amount after more were added, find how many were added.",
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
    terms: [
      [
        "=",
        "Both sides have the same value. It does not mean “write the answer next.”",
      ],
    ],
    method: [
      "Find the value of the complete side.",
      "On the other side, find what the box must add to the known number to reach that value.",
    ],
    watch: "5 + 5 = □ + 7: the left is 10, so □ = 3, not 10.",
  },
  // Place value
  "continue-count-to-120": {
    goal: "Given a counting sequence, find the next number.",
    method: [
      "Each next number is one more.",
      "After a 9 in the ones place, the ones become 0 and the tens go up by one.",
    ],
    watch: "After 109 comes 110, not 1010.",
  },
  "tens-ones-model": {
    goal: "Given rods and small cubes, find the number shown.",
    terms: [
      ["rod", "A ten: ten ones joined together."],
      ["cube", "A one."],
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
      ["flat", "A hundred: ten rods."],
      ["rod", "A ten."],
      ["cube", "A one."],
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
    terms: [
      [
        "place value",
        "What a digit is worth because of its position: ones, tens, hundreds…",
      ],
    ],
    method: [
      "Find the digit in the named place.",
      "Multiply it by that place: tens × 10, hundreds × 100.",
    ],
    watch: "In 472 the 7 is worth 70, not 7.",
  },
  "expanded-form-missing": {
    goal: "Given a number written as hundreds + □ + ones, find the missing value.",
    terms: [
      [
        "expanded form",
        "A number written as the sum of its place values: 916 = 900 + 10 + 6.",
      ],
    ],
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
    goal: "Given a counting pattern, find the next number.",
    method: [
      "Find the step: subtract one number from the next.",
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
    goal: "Given an array of squares, find how many there are.",
    terms: [["array", "Objects arranged in equal rows."]],
    method: [
      "Count the squares in one row.",
      "Multiply by the number of rows; every row has the same number of squares.",
    ],
    watch:
      "Multiply rows by columns; adding them counts only the edge squares.",
  },
  "pairing-leftover": {
    goal: "Given a number of counters, find how many are left without a partner.",
    method: [
      "Each pair uses 2 counters, so pair them off two at a time.",
      "An even number leaves 0 unpaired; an odd number leaves 1.",
    ],
    watch: "A number is even when its ones digit is 0, 2, 4, 6 or 8.",
  },
  "multiply-facts": {
    goal: "Given two factors, find their product.",
    terms: [
      ["factor", "A number being multiplied."],
      ["product", "The result of multiplying."],
    ],
    method: [
      "a × b means a groups of b.",
      "Use a fact you know: double a 2s fact for 4s, add one group to a 5s fact for 6s.",
      "Swapping the factors gives the same product.",
    ],
    watch: "7 × 8 = 7 × 4 doubled: 28 + 28 = 56.",
  },
  "divide-facts": {
    goal: "Given a division, find the quotient.",
    terms: [
      ["dividend", "The number being divided."],
      ["divisor", "The number you divide by."],
      ["quotient", "The result of dividing."],
    ],
    method: [
      "Read 56 ÷ 7 as: how many groups of 7 make 56?",
      "Find the missing factor in 7 × ? = 56 from a fact you know.",
      "The missing factor is the quotient.",
    ],
    watch: "Check by multiplying: quotient × divisor must give the dividend.",
  },
  "equal-tray-total": {
    goal: "Given a number of trays and how many are on each, find the total.",
    method: [
      "Multiply the number of trays by the number on each tray.",
      "Or skip-count by the amount on one tray, once for each tray.",
    ],
    watch: "Multiply, do not add: 4 trays of 6 is 24, not 10.",
  },
  "share-whole-items": {
    goal: "Given a total and a number of trays, find how many go on each tray.",
    method: [
      "Divide the total by the number of trays.",
      "Or deal the items out one per tray until none are left.",
    ],
    watch: "Check: trays × each = total.",
  },
  "measure-whole-pieces": {
    goal: "Given a length and the size of each piece, find how many pieces.",
    method: [
      "Divide the full length by the length of one piece.",
      "Check: pieces × piece length = full length.",
    ],
    watch:
      "Divide by the piece length; the answer counts pieces, not centimeters.",
  },
  "unknown-group-size": {
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
    goal: "Given ? ÷ a = b, find the number being divided.",
    method: [
      "? ÷ a = b means ? splits into a groups of b.",
      "Multiply: a × b gives the missing number.",
    ],
    watch: "Multiply to undo division; dividing again gives a smaller number.",
  },
  "split-array-part": {
    goal: "Given an array split into regions, find the squares in one region.",
    method: [
      "Count the rows in the named region.",
      "Multiply by the number of squares in each row.",
    ],
    watch: "Count only the named region's rows, not the whole array.",
  },
  "nested-bag-total": {
    goal: "Given groups inside groups, find the total number of items.",
    method: [
      "Multiply the outer count by the middle count to get the number of bags.",
      "Multiply by the number in each bag.",
    ],
    watch: "Multiply all three counts; adding any of them undercounts.",
  },
  "zero-one-groups": {
    goal: "Given a product with 0 or 1, find the total.",
    method: [
      "Any number × 0 is 0: no groups, or empty groups.",
      "Any number × 1 is that number: one group.",
    ],
    watch: "0 groups of 7 is 0, not 7; 1 group of 7 is 7, not 1.",
  },
  "neighbor-product-change": {
    goal: "Given an array that gains one row, find how many squares were added.",
    method: [
      "Growing by one row adds one more group.",
      "The squares added equal the squares in one row: 8 × 2 is 7 × 2 plus 2.",
    ],
    watch: "The change is one row, not the whole new array.",
  },
  "factor-partner": {
    goal: "Given a product and one factor, find the other factor.",
    method: [
      "Divide the product by the known factor.",
      "Check by multiplying: factor × partner = product.",
    ],
    watch: "The partner multiplies to the product; it does not add to it.",
  },
  "tens-contribution": {
    goal: "Given a product split by place value, find the tens partial product.",
    terms: [["partial product", "The product of one part of a factor."]],
    method: [
      "Take the tens part of the split number: in 91 that is 90.",
      "Multiply it by the other factor.",
    ],
    watch: "Use 90, not 9.",
  },
  "comparison-amount": {
    goal: "Given one amount and “n times as many,” find the other amount.",
    method: [
      "“n times as many” means n copies of the amount.",
      "Multiply the amount by n: 4 times as many as 9 is 4 × 9.",
    ],
    watch: "Do not add n. 4 times as many as 9 is 36, not 13.",
  },
  "comparison-factor": {
    goal: "Given two amounts, find how many times as many one is as the other.",
    method: [
      "Ask how many copies of the smaller amount make the larger.",
      "Divide the larger amount by the smaller.",
    ],
    watch: "Divide, do not subtract: 12 is 3 times 4, not 8 times.",
  },
  "full-kits": {
    goal: "Given a supply and the amount each kit needs, find how many complete kits.",
    method: [
      "Divide the supply by the amount per kit.",
      "Keep only the whole number; ignore the remainder.",
    ],
    watch: "A kit with too few beads is not a kit: never round up.",
  },
  "seats-needed": {
    goal: "Given a number of people and seats per van, find the fewest vans.",
    method: [
      "Divide people by seats per van.",
      "If there is any remainder, add one more van for the people left.",
    ],
    watch: "Everyone needs a seat, so round up.",
  },
  "kit-leftovers": {
    goal: "Given a supply and the amount per kit, find how many are left after making full kits.",
    method: [
      "Find the most full kits: divide and keep the whole number.",
      "Subtract kits × amount per kit from the supply.",
    ],
    watch: "The answer is the remainder, not the number of kits.",
  },
  "delivery-then-use": {
    goal: "Given a delivery of equal boxes and an amount used, find what remains.",
    method: [
      "Multiply boxes by items per box to get the delivery.",
      "Subtract the amount used from that total.",
    ],
    watch:
      "Find the whole delivery before subtracting; do not subtract from one box.",
  },
  "purchase-change": {
    goal: "Given a number of items, their price, and the payment, find the change.",
    method: [
      "Multiply to find the cost: items × price.",
      "Subtract the cost from the payment.",
      "Check: cost + change = payment.",
    ],
    watch: "Subtract the total cost, not the price of one item.",
  },
  "two-step-change": {
    goal: "Given a starting amount, an amount added, and an amount removed, find what remains.",
    method: [
      "Start with the first amount.",
      "Add the amount that was added.",
      "Take the amount removed away from that new total.",
    ],
    watch:
      "Do the changes in the order they happen: add first, then subtract from the new total.",
  },
  // Measurement, perimeter, area
  "shifted-ruler-length": {
    goal: "Given an object on a ruler that does not start at 0, find its length.",
    method: ["Read the mark at each end.", "Subtract: end mark − start mark."],
    watch: "Count the spaces between marks, not the marks.",
  },
  "fractional-ruler-length": {
    goal: "Given an object on a ruler marked in fractions, find its length.",
    method: [
      "Find the size of one small space.",
      "Count the spaces from one end to the other.",
      "Length = spaces × size of one space.",
    ],
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
    terms: [["metric lengths", "1 km = 1000 m; 1 m = 100 cm; 1 cm = 10 mm."]],
    method: [
      "Find how many small units make one large unit.",
      "Multiply. A smaller unit needs a larger count.",
    ],
  },
  "metric-length-reverse": {
    goal: "Given a length in a smaller unit, write it in a larger unit.",
    method: [
      "Find how many small units make one large unit.",
      "Divide. A larger unit needs a smaller count.",
    ],
  },
  "mixed-length-total": {
    goal: "Given lengths in two units, find the total in the smaller unit.",
    method: ["Convert the larger-unit length to the smaller unit.", "Add."],
    watch: "3 m + 31 cm is 331 cm, not 34.",
  },
  "mixed-unit-border": {
    goal: "Given a rectangle with sides in two units, find its perimeter in one unit.",
    method: [
      "Convert both sides to the same unit.",
      "Perimeter = 2 × (length + width).",
    ],
  },
  "rectangle-border-length": {
    goal: "Given a rectangle's side lengths, find its perimeter.",
    terms: [["perimeter", "The total length around a shape."]],
    method: [
      "A rectangle has two sides of each length.",
      "Perimeter = 2 × (length + width).",
    ],
  },
  "rectangle-missing-border-side": {
    goal: "Given a rectangle's perimeter and one side, find the other side.",
    method: [
      "Half the perimeter is length + width.",
      "Subtract the known side from that half.",
    ],
  },
  "rectangle-area": {
    goal: "Given a rectangle's width and height, find its area.",
    terms: [["area", "The number of unit squares that cover a shape."]],
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
    method: ["Area = side × side.", "Divide the area by the known side."],
  },
  "border-or-cover-unit": {
    goal: "Given a situation, choose the unit that measures it.",
    method: [
      "Along a path or edge: a length unit (cm).",
      "Covering a surface: an area unit (square cm).",
      "Filling a space: a volume unit (cubic cm).",
    ],
  },
  "same-area-border-choice": {
    goal: "Given rectangles with equal area, find which has the shorter perimeter.",
    method: [
      "Find each perimeter: 2 × (length + width).",
      "Compare the perimeters.",
    ],
    watch:
      "Equal area does not mean equal perimeter. Long, thin rectangles have longer borders.",
  },
  "same-border-area-choice": {
    goal: "Given rectangles with equal perimeter, find which covers more area.",
    method: ["Find each area: length × width.", "Compare the areas."],
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
  },
  "rectangle-existence-choice": {
    goal: "Given an area and a perimeter, decide which rectangle has both, if any.",
    method: [
      "List every whole-number pair of sides whose product is the area.",
      "Find the perimeter of each pair.",
      "A pair with the given perimeter works; if none does, no such rectangle exists.",
    ],
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
    goal: "Given a list of numbers, find their mean.",
    terms: [
      ["mean", "The sum of the values divided by how many values there are."],
    ],
    method: [
      "Add all the values to get the total.",
      "Count the values.",
      "Mean = total ÷ count: the size each value would be if the total were shared equally.",
    ],
    watch:
      "Divide by how many values there are, counting repeated values each time.",
  },
  "simple-probability": {
    goal: "Given counts of each color in a bag, find the probability of drawing one color.",
    terms: [
      [
        "probability",
        "Favorable outcomes ÷ total equally likely outcomes, from 0 to 1.",
      ],
    ],
    method: [
      "Count the favorable items: the color asked for.",
      "Count all items in the bag.",
      "Probability = favorable ÷ total, simplified.",
    ],
    watch: "Divide by the total, not by the other color.",
  },
  // Fractions
  "unit-piece-size": {
    goal: "Given a whole cut into equal pieces, find the fraction one piece is.",
    terms: [
      [
        "denominator",
        "The bottom number: how many equal pieces make one whole.",
      ],
    ],
    method: [
      "Count the equal pieces in the whole.",
      "One piece is 1 over that number: a whole in 6 equal pieces has pieces of 1/6.",
    ],
    watch:
      "The bottom number counts all the pieces in the whole, not the pieces left over.",
  },
  "fraction-model": {
    goal: "Given a shaded shape, find the fraction shaded.",
    terms: [
      [
        "denominator",
        "The bottom number: how many equal parts make the whole.",
      ],
      ["numerator", "The top number: how many of those parts are counted."],
    ],
    method: [
      "Count all equal parts. That is the denominator.",
      "Count the shaded parts. That is the numerator.",
    ],
    watch: "The parts must be equal in size.",
  },
  "fraction-unit-count": {
    goal: "Given strips cut into equal pieces, find how many pieces are shaded.",
    method: [
      "Each strip is one whole cut into the same number of pieces.",
      "Count the shaded pieces across all the strips, without restarting at a new strip.",
    ],
    watch: "Pieces past the first whole are the same size; keep counting.",
  },
  "fraction-line-position": {
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
    goal: "Given a fraction and a new denominator, find the matching numerator.",
    terms: [["equivalent fractions", "Fractions that name the same amount."]],
    method: [
      "Find what the denominator was multiplied by.",
      "Multiply the numerator by the same number.",
    ],
    watch:
      "Multiply the numerator by the same number as the denominator; adding the same number changes the amount.",
  },
  "equivalent-denominator": {
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
    goal: "Given two fractions with the same denominator, find their difference.",
    method: [
      "Both fractions count the same size of piece.",
      "Subtract the numerators and keep the denominator.",
      "Simplify.",
    ],
    watch: "Do not subtract the denominators: the piece size stays the same.",
  },
  "mixed-to-improper-numerator": {
    goal: "Given a mixed number, find the numerator of the equal improper fraction.",
    terms: [
      ["mixed number", "A whole number and a fraction: 2 1/3."],
      ["improper fraction", "A fraction with numerator ≥ denominator: 7/3."],
    ],
    method: [
      "Each whole holds denominator-many pieces: 2 wholes in fifths are 10 fifths.",
      "Multiply the whole number by the denominator.",
      "Add the numerator: 2 3/5 = (10 + 3)/5 = 13/5.",
    ],
    watch:
      "Multiply the whole by the denominator before adding: 2 3/5 is 13/5, not 5/5.",
  },
  "improper-whole-part": {
    goal: "Given an improper fraction, find how many complete wholes it contains.",
    method: [
      "The denominator says how many pieces make one whole.",
      "Group the pieces into wholes: divide the numerator by the denominator.",
      "The number of complete groups is the answer; leftover pieces do not make a whole.",
    ],
    watch: "Count only complete wholes: 22/8 holds 2 wholes, not 3.",
  },
  "improper-fractional-part": {
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
    method: [
      "Rename both with a common denominator.",
      "Add the numerators. Keep the denominator.",
      "Simplify.",
    ],
    watch: "Never add the denominators.",
  },
  "unlike-fraction-difference": {
    goal: "Given two fractions with different denominators, find their difference.",
    method: [
      "Rename both with a common denominator.",
      "Subtract the numerators. Keep the denominator.",
      "Simplify.",
    ],
    watch: "Subtract only after the denominators match; 3/4 − 1/2 is not 2/2.",
  },
  "fraction-distance-gap": {
    goal: "Given two points on a fraction number line, find the distance between them.",
    method: [
      "Write both positions with the same denominator.",
      "Subtract the smaller from the larger.",
    ],
    watch:
      "Count the steps between the points, not from 0 to each point added together.",
  },
  "whole-times-fraction": {
    goal: "Given several groups of the same fraction, find the total.",
    method: [
      "n groups of a/b are n × a pieces of size 1/b.",
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
    goal: "Given a whole amount and a fraction of it, find that part.",
    method: [
      "Divide the amount by the denominator to get one share.",
      "Multiply by the numerator.",
    ],
    watch:
      "Use the whole amount as the whole: 3/4 of 8 liters is 6 liters, not 3/4 liter.",
  },
  "whole-sharing-fraction": {
    goal: "Given whole amounts shared equally, find each share.",
    method: [
      "Each share = total ÷ number of people.",
      "Write that division as a fraction: total over people.",
      "Simplify.",
    ],
    watch: "2 shared by 6 is 2/6 = 1/3.",
  },
  "unit-fraction-share": {
    goal: "Given a unit fraction shared equally, find each share.",
    method: [
      "Cut the 1/a into b equal parts.",
      "Each part is 1/b of 1/a, so dividing 1/a among b people gives 1/(a × b).",
    ],
    watch:
      "Sharing makes each part smaller: multiply the denominator by the number of people.",
  },
  "fraction-share-amount": {
    goal: "Given a fraction shared equally, find each share.",
    method: [
      "Dividing a/b among n people gives each a/(b × n).",
      "If n divides the numerator, share the pieces instead: 6/8 among 3 is 2/8 each.",
      "Simplify.",
    ],
    watch: "5/6 ÷ 3 = 5/18.",
  },
  "whole-unit-groups": {
    goal: "Given a whole amount and a unit fraction, find how many units fit.",
    method: [
      "Each whole holds denominator-many units: one liter fills 4 containers of 1/4 liter.",
      "Multiply wholes × denominator.",
    ],
    watch:
      "Multiply by the denominator; dividing the wholes by it gives a fraction, not a count.",
  },
  "fraction-group-count": {
    goal: "Given a total and a container size, both fractions, find how many containers.",
    method: [
      "Write both with the same denominator.",
      "Divide the numerators: total pieces ÷ pieces per container.",
    ],
    watch:
      "The answer counts containers, not liters; a part container is a fraction of one container.",
  },
  "divide-fractions": {
    goal: "Given a fraction divided by a fraction, find the quotient.",
    terms: [
      ["reciprocal", "A fraction flipped: the reciprocal of 3/4 is 4/3."],
    ],
    method: [
      "Keep the first fraction.",
      "Change ÷ to × and flip the second fraction to its reciprocal: 3/4 becomes 4/3.",
      "Multiply, then simplify.",
    ],
    watch: "Flip only the divisor, the second fraction, never the first.",
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
    goal: "Given a ratio and one new amount, find the matching amount.",
    terms: [
      [
        "ratio",
        "A fixed comparison between two amounts, like 4 blue for every 3 white.",
      ],
    ],
    method: [
      "Find the scale factor: new amount ÷ its ratio number.",
      "Multiply the other ratio number by the same factor.",
    ],
    watch:
      "Multiply both parts by the same factor; adding the same amount to both breaks the ratio.",
  },
  "unit-price": {
    goal: "Given the cost of several items, find the cost of a different number.",
    terms: [["unit price", "The cost of one item."]],
    method: [
      "Unit price = total cost ÷ number of items.",
      "Multiply the unit price by the new number of items.",
      "Check: more items must cost more.",
    ],
    watch:
      "Find the price of one item first; the given total is for a different number of items.",
  },
  "percent-of": {
    goal: "Given a percent and an amount, find that percent of the amount.",
    terms: [["percent", "Per hundred: 19% = 19/100."]],
    method: [
      "Write the percent as a fraction over 100: 35% = 35/100.",
      "Multiply that fraction by the amount.",
      "Shortcut: 10% is the amount ÷ 10, and 50% is half.",
    ],
    watch:
      "Find the percent of the stated amount; do not just write the percent as the answer.",
  },
  "proportional-rule-choice": {
    goal: "Given several rules, choose the proportional one.",
    terms: [["proportional", "y = kx for a constant k: doubling x doubles y."]],
    method: [
      "A proportional rule has no added constant.",
      "It gives y = 0 when x = 0.",
    ],
  },
  // Integers, expressions, equations
  "integer-addition": {
    goal: "Given two signed numbers, find their sum.",
    method: [
      "Same signs: add the sizes, keep the sign.",
      "Different signs: subtract the smaller size from the larger, keep the sign of the larger.",
    ],
    watch:
      "With different signs, the answer takes the sign of the number farther from 0: −8 + 3 = −5.",
  },
  "number-line-distance": {
    goal: "Given two points on a number line, find the distance between them.",
    method: [
      "Subtract the smaller number from the larger: from −7 to 6 is 6 − (−7).",
      "When the points are on both sides of 0, add their distances from 0.",
      "Distance is never negative.",
    ],
    watch: "From −7 to 6 is 6 − (−7) = 13, not 6 − 7.",
  },
  "integer-power": {
    goal: "Given a base and an exponent, find the power.",
    terms: [
      ["base", "The number being multiplied."],
      ["exponent", "How many copies of the base are multiplied."],
    ],
    method: [
      "Multiply exponent-many copies of the base.",
      "Any nonzero base to the power 0 is 1.",
    ],
    watch: "8⁴ = 8 × 8 × 8 × 8, not 8 × 4.",
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
    goal: "Given an expression and a value of x, find the expression's value.",
    method: [
      "Replace x with the value in parentheses, sign included.",
      "Multiply before adding.",
    ],
  },
  "distributive-expression-choice": {
    goal: "Given a number times a sum in parentheses, choose the equal expression.",
    method: [
      "Multiply the outside number by every term inside.",
      "Keep each sign: −2(x + 4) = −2x − 8.",
    ],
  },
  "combine-like-coefficient": {
    goal: "Given an expression, find the coefficient of x after combining like terms.",
    terms: [
      ["coefficient", "The number multiplying x."],
      ["like terms", "Terms with the same variable part, like −2x and −6x."],
    ],
    method: [
      "Add the coefficients of the x terms, with their signs.",
      "Ignore the constants.",
    ],
  },
  "linear-equation": {
    goal: "Given an equation like ax + b = c, find x.",
    method: [
      "Undo the addition first: subtract b from both sides, leaving ax = c − b.",
      "Undo the multiplication: divide both sides by a.",
      "Check by putting x back into ax + b.",
    ],
    watch:
      "Subtract b from both sides before dividing. Dividing first means b must be divided too.",
  },
  "negative-coefficient-equation": {
    goal: "Given an equation where x is multiplied by a negative number, find x.",
    method: [
      "Undo the added or subtracted constant on both sides.",
      "Divide both sides by the coefficient, sign included.",
    ],
  },
  "rational-coefficient-equation": {
    goal: "Given an equation where x is multiplied by a fraction, find x.",
    method: [
      "Undo the added constant on both sides.",
      "Multiply both sides by the reciprocal of the fraction.",
    ],
  },
  "grouped-linear-equation": {
    goal: "Given an equation like a(x + b) = c, find x.",
    method: ["Divide both sides by a.", "Undo the + b inside."],
  },
  "both-sides-linear-equation": {
    goal: "Given an equation with x on both sides, find x.",
    method: [
      "Subtract one x term from both sides so x is on one side.",
      "Move the constants to the other side.",
      "Divide by the coefficient.",
    ],
  },
  "check-equation-candidate": {
    goal: "Given an equation and a proposed value, decide whether it is a solution.",
    method: [
      "Substitute the value into the left side and evaluate.",
      "Evaluate the right side.",
      "It is a solution only if the two sides are equal.",
    ],
  },
  "equation-solution-count": {
    goal: "Given a linear equation, decide whether it has one, no, or infinitely many solutions.",
    method: [
      "Move all x terms to one side and constants to the other.",
      "x remains: exactly one solution.",
      "x cancels and the statement is false (0 = 5): no solution.",
      "x cancels and the statement is true (0 = 0): every number is a solution.",
    ],
  },
  "linear-system-x": {
    goal: "Given two equations in x and y, find x.",
    method: [
      "Multiply the equations so the y coefficients match.",
      "Subtract one equation from the other to remove y.",
      "Solve for x.",
    ],
    watch:
      "Multiply every term of an equation, including the number on the right side.",
  },
  // Lines and functions
  "coordinate-point-reading": {
    goal: "Given a point on a grid, find one of its coordinates.",
    terms: [
      [
        "coordinates (x, y)",
        "x is the distance across from the y-axis; y is the distance up from the x-axis.",
      ],
    ],
    method: [
      "For x, count across from the vertical axis.",
      "For y, count up or down from the horizontal axis.",
    ],
    watch: "x is the across distance and comes first; do not swap it with y.",
  },
  "line-slope": {
    goal: "Given two points, find the slope of the line through them.",
    terms: [["slope", "Change in y divided by change in x."]],
    method: [
      "Subtract the y-values: y₂ − y₁.",
      "Subtract the x-values in the same order: x₂ − x₁.",
      "Divide.",
    ],
    watch:
      "Use the same point first in both subtractions; mixing the order flips the sign.",
  },
  "graphed-line-slope": {
    goal: "Given a line on a grid through two marked points, find its slope.",
    method: [
      "Read both points' coordinates.",
      "Slope = (change in y) ÷ (change in x), same order for both.",
    ],
    watch: "A line falling to the right has negative slope.",
  },
  "unequal-step-rate": {
    goal: "Given points from a linear rule, find the rate of change.",
    method: ["Pick two points.", "Rate = output change ÷ input change."],
    watch:
      "The input steps may differ in size; always divide by the input change.",
  },
  "recover-linear-intercept": {
    goal: "Given the rate of a linear rule and one point, find the output at input 0.",
    terms: [["intercept b", "The output when the input is 0 in y = mx + b."]],
    method: ["Substitute the point into y = mx + b.", "Solve for b."],
  },
  "predict-linear-output": {
    goal: "Given two points on a line, find the output at a new input.",
    method: [
      "Rate = output change ÷ input change.",
      "From a known point, add rate × input change to reach the new input.",
    ],
  },
  "graph-equation-choice": {
    goal: "Given a line on a grid, choose its equation.",
    method: [
      "Read b, the y-value where the line crosses the y-axis.",
      "Find the slope m from two points.",
      "The equation is y = mx + b.",
    ],
  },
  "relation-function-choice": {
    goal: "Given lists of input-output pairs, choose the one that is a function.",
    terms: [
      ["function", "A rule that gives exactly one output for each input."],
    ],
    method: [
      "Look for an input that appears with two different outputs.",
      "If none does, it is a function.",
    ],
    watch: "Different inputs may share an output.",
  },
  "distance-graph-meaning": {
    goal: "Given a distance–time graph, describe how distance changes between two points.",
    method: [
      "Rising: distance from home increases.",
      "Falling: distance decreases.",
      "Level: distance stays the same.",
    ],
  },
  "shared-plan-input": {
    goal: "Given two cost rules, find the input where they cost the same.",
    method: ["Set the two expressions equal.", "Solve for x."],
  },
  "first-cheaper-whole-input": {
    goal: "Given two cost rules, find the first whole input where one is strictly cheaper.",
    method: [
      "Set the costs equal and solve for the tie.",
      "Strictly cheaper starts after the tie: the next whole number above it.",
    ],
  },
  "function-evaluation": {
    goal: "Given f(x) and an input, find the output.",
    method: [
      "Replace every x with the input, in parentheses.",
      "Powers first, then multiplication, then addition.",
    ],
    watch:
      "Square the input before multiplying by its coefficient, and keep the parentheses: (−3)² = 9.",
  },
  "arithmetic-term": {
    goal: "Given the first term and common difference, find term n.",
    terms: [["arithmetic sequence", "Each term adds the same difference d."]],
    method: [
      "Each term adds the common difference d to the term before.",
      "Term n is n − 1 steps after term 1.",
      "Term n = first term + (n − 1) × d.",
    ],
    watch: "Use n − 1 steps, not n: term 1 has no steps added.",
  },
  "geometric-sequence": {
    goal: "Given the first term and common ratio, find term n.",
    terms: [
      ["geometric sequence", "Each term multiplies by the same ratio r."],
    ],
    method: [
      "Each term is the term before it times the ratio r.",
      "From term 1 to term n there are n − 1 steps, so multiply by r that many times.",
      "Term n = first term × r^(n − 1).",
    ],
    watch: "Use n − 1 factors of r, not n: term 1 has no factor of r.",
  },
  "quadratic-vertex": {
    goal: "Given f(x) = a(x − h)² + k with a > 0, find its minimum value.",
    method: [
      "A square is never negative and is 0 at x = h.",
      "With a > 0, the smallest value of f is k.",
    ],
    watch:
      "The minimum value is k, the value of f. The number h is where it happens, not the minimum.",
  },
  "logarithm-integer": {
    goal: "Given log base b of N, find its value.",
    terms: [["logarithm", "log_b N is the exponent p with b^p = N."]],
    method: [
      "log_b N asks: b to what power is N?",
      "Multiply b by itself, counting the factors: b, b², b³, …",
      "The number of factors that reaches N is the logarithm.",
    ],
    watch:
      "The logarithm is the exponent, not N ÷ b: log base 2 of 8 is 3, not 4.",
  },
  ...rightTriangleMethods,
};
