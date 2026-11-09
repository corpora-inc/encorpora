import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Why addition and subtraction strategies work (2.NBT.B.9): choose the
 * reason a step keeps the same amount, find the step that breaks it, and read
 * a carry or borrow mark as the trade it records.
 */
const noLink = ["line", "lines", "change"];

export const strategyReasonsMethods: Record<string, ProblemMethod> = {
  "strategy-step-reason": {
    goal: "Choose the reason a step of an addition or subtraction strategy keeps the same amount.",
    intuition:
      "A strategy is a way to add or subtract by changing the numbers into friendlier ones. A step works only if the amount stays the same. For example, 38 is 30 and 8, so adding 30 and then 8 still adds 38. A good reason says why the amount did not change. “It is easier” says why someone wanted the step, not why the answer stays right.",
    noLink,
    terms: ["place-value", "addend", "sum"],
    method: [
      "Read the step and say what changed: a number split into tens and ones, numbers added in a new order, or a tens number used in place of a nearby number.",
      "Ask whether the amount stayed the same. Splitting a number or adding in another order keeps it. Using 40 in place of 38 adds 2 too many, so 2 must come off.",
      "Choose the reason that says why the amount stays the same. Leave out reasons about which number is bigger, which step is easier, or a rule to follow.",
    ],
    watch:
      "A true fact is not always a reason. Check that the reason says why the amount stays the same, not why the step is easier.",
  },
  "strategy-flaw": {
    goal: "Find the line of a student's strategy that changes the amount, and choose what went wrong.",
    intuition:
      "Every line of a strategy must keep the same amount as the problem. A line can change a number on purpose, like using 40 in place of 38, if a later line fixes the extra 2. A line that adds or takes away the wrong amount, and is never fixed, makes the answer wrong. Find that line, then say whether it made too much or too little and which way the amount must go back.",
    noLink,
    terms: ["place-value", "sum"],
    method: [
      "Check each line in order: is its arithmetic true, and does it keep the same amount as the problem?",
      "The first line that adds or takes away the wrong amount is the wrong line. A line with true arithmetic can still be the wrong step.",
      "Choose the reason that names the extra or missing amount and the way it must go back. Check the fixed answer with the opposite operation.",
    ],
    watch:
      "Do not blame a line just because it changes a number. Using 40 for 38 is fine when the extra 2 is taken back later.",
  },
  "written-method-meaning": {
    goal: "Choose the base-ten blocks that show what a carried 1 or a crossed-out digit means.",
    intuition:
      "Base-ten blocks show place value, how much a digit is worth in its place. A cube is 1, a rod is 10 cubes, and a flat is 100 cubes. In column adding, 10 ones are traded for 1 ten, and that ten is written as a small 1 above the tens column. In column subtracting, 1 ten can be traded for 10 ones when there are too few ones. A trade changes how the amount looks, not how much it is.",
    noLink,
    terms: ["base-ten-blocks", "place-value", "digit", "regroup"],
    method: [
      "Find the column the mark sits in. A small 1 above the tens column is 1 ten; above the hundreds column it is 1 hundred.",
      "For crossed-out digits, read the new numbers: 1 fewer of the bigger place and 10 more of the smaller place.",
      "Choose the blocks that match the marks and still show the same amount as the number before the trade.",
    ],
    watch:
      "A 1 is not always a one. It is 1 of whatever its column holds: 1 ten in the tens column, 1 hundred in the hundreds column.",
  },
  "written-method-reason": {
    goal: "Choose why each digit goes under the digit of the same place in column adding.",
    intuition:
      "Each digit is worth an amount set by its place: ones, tens or hundreds. This is called place value. Column adding adds ones to ones, tens to tens and hundreds to hundreds. So the numbers line up on the right, where the ones are. A digit under the wrong place would count 10 times too much or too little.",
    noLink,
    terms: ["place-value", "digit", "sum"],
    method: [
      "Say what each digit is worth: in 345, the 3 is 3 hundreds, the 4 is 4 tens and the 5 is 5 ones.",
      "Put each digit of the other number under the digit worth the same kind: ones under ones, tens under tens.",
      "Choose the reason that names the place, not a habit about the right side or a true fact such as $5 + 7 = 12$.",
    ],
    watch:
      "Adding in any order is fine, but a digit cannot move to another place. A 7 under the tens would count as 70.",
  },
};

export const strategyReasonsPrinciples: Record<string, string> = {
  "strategy-step-reason":
    "A strategy step is correct when it keeps the same amount. Splitting a number into its tens and ones, and adding numbers in another order or grouping, keep a sum the same. Using a nearby tens number adds or takes away too much, so the difference must be undone the other way. Moving an amount from one addend to the other keeps a sum. Moving both numbers of a subtraction up or down by the same amount keeps the difference.",
  "strategy-flaw":
    "A strategy is wrong at the first line that adds or takes away an amount and never undoes it. True arithmetic in that line does not make it right. The fix puts back what was added or taken, and the opposite operation checks the answer: $a + b = s$ means $s - b = a$.",
  "written-method-meaning":
    "In column adding, 10 ones make 1 ten and 10 tens make 1 hundred; a carried 1 is one unit of the column it is written in. In column subtracting, 1 ten is traded for 10 ones and 1 hundred for 10 tens. Each trade keeps the amount the same, so 5 tens and 12 ones are still 62.",
  "written-method-reason":
    "A digit's value is the digit times the value of its place. Column adding adds digits of the same place, so the numbers are lined up by their ones digits. A digit written under another place would be counted at that place's value.",
};

export const strategyReasonsLessons: Lesson[] = [
  chainLesson({
    id: "strategy-reasons-lesson",
    title: "Why addition and subtraction strategies work",
    summary:
      "A strategy changes numbers into friendlier ones. It works when every step keeps the same amount. Explain a step, find the step that breaks it, and read a carry or borrow mark as a trade of ten.",
    noLink,
    templateIds: [
      "strategy-step-reason",
      "strategy-flaw",
      "written-method-meaning",
      "written-method-reason",
    ],
    objectives: [
      "Choose the place-value or order reason that makes a step keep the same amount.",
      "Find the line that adds or takes away the wrong amount, and say which way to fix it.",
      "Read a carried 1 or a crossed-out digit as a trade that keeps the amount the same.",
    ],
    openingTitle: "Same amount, friendlier numbers",
    opening: [
      "To add $38 + 25$, Noor can use 40 in place of 38. 40 is a tens number, so $40 + 25 = 65$ is quick. But 40 is 2 more than 38, so 65 is 2 too many. Taking 2 away gives 63. Each step kept track of the amount.",
      "A good reason says why the amount stays the same. “40 is easier” says why Noor wanted 40. It does not say why 63 is right.",
      "Column marks are trades. Ten ones make 1 ten, so a small 1 above the tens column is 1 ten. Opening 1 ten gives 10 ones, so 6 tens and 2 ones can become 5 tens and 12 ones. Both are still 62.",
    ],
    example: {
      prompt:
        "Leo adds $38 + 25$ like this. Line 1: $38 + 2 = 40$. Line 2: $40 + 25 = 65$. Line 3: $65 - 2 = 63$. Why does Leo take 2 away in line 3?",
      steps: [
        "Line 2 adds 40, not 38. 40 is 2 more than 38.",
        "So 65 is 2 more than $38 + 25$. Line 3 takes those 2 back off.",
        "Check: $63 - 25 = 38$, so $38 + 25 = 63$.",
      ],
      answer: "He added 40, not 38. That is 2 too many.",
    },
    methodTitle: "Follow the amount",
    method: [
      "Say what each line changed. Splitting a number, or adding in another order, keeps the amount.",
      "If a line used a nearby tens number, ask: too much or too little? The fix goes the other way.",
      "A carried or borrowed 1 is 1 of whatever its column holds: 1 ten in the tens column, 1 hundred in the hundreds column.",
    ],
    formalTitle: "What keeps the amount the same",
    formal: [
      "Breaking a number into hundreds, tens and ones never changes it. Adding numbers in any order or grouping gives the same sum.",
      "Moving an amount from one addend to the other keeps the sum. Adding the same amount to both numbers of a subtraction keeps the difference.",
      "Ten of one place make 1 of the next place. A trade between places changes the digits, not the amount.",
    ],
    pitfalls: [
      "Giving a reason about which number is bigger or which step is easier, instead of why the amount stays the same.",
      "Fixing a tens number the wrong way: adding 2 back after using 40 for 38.",
      "Reading a carried 1 as 1 one instead of 1 ten or 1 hundred.",
    ],
    parentGuide:
      "When your learner explains a step, ask “Did the amount change?” A reason should say why it stayed the same, not why the step was easier.",
  }),
];

export const strategyReasonsFacetMappings: FacetMapping[] = [
  {
    templateId: "strategy-step-reason",
    facetId: "explain-strategies.core",
    extent: "partial",
    rationale:
      "Choosing the place-value or order-and-grouping reason that a step of ten addition and subtraction strategies keeps the same amount, against size, rule, benefit and incomplete-fact reasons. It does not grade an explanation the learner writes or says.",
  },
  {
    templateId: "strategy-flaw",
    facetId: "explain-strategies.core",
    extent: "partial",
    rationale:
      "Finding the one line of a three-line strategy that breaks the same amount and choosing what went wrong, across nine documented errors. Both parts must be right. It does not grade a written correction.",
  },
  {
    templateId: "written-method-meaning",
    facetId: "explain-strategies.core",
    extent: "partial",
    rationale:
      "Choosing the base-ten blocks that show a carried 1 (a ten or a hundred) or the traded state after a borrow, including a borrow across a zero. This relates the written method to place value; it does not ask the learner to compute or to write the method.",
  },
  {
    templateId: "written-method-reason",
    facetId: "explain-strategies.core",
    extent: "partial",
    rationale:
      "Choosing why a one- or two-digit number is lined up under a three-digit number by place. It does not ask the learner to write the column method.",
  },
];
