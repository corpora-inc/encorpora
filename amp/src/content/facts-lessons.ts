import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const factsLessons: Lesson[] = [
  {
    id: "facts-to-five",
    title: "Facts to five",
    summary:
      "Every pair of parts that makes a number up to five gives one addition fact and one subtraction fact.",
    templateIds: ["facts-to-five"],
    objectives: [
      "Add and subtract within five without counting from one.",
      "Connect each subtraction to the addition with the same parts.",
    ],
    sections: [
      {
        title: "Parts that make five",
        paragraphs: [
          "Five counters in a row can be split into two parts: 0 and 5, 1 and 4, 2 and 3. Knowing these pairs is knowing the facts.",
          "The order of the parts does not matter: 3 + 2 and 2 + 3 both make 5.",
        ],
        illustration: "five-frame-facts",
      },
      {
        title: "Take away with the same parts",
        paragraphs: [
          "If 3 and 2 make 5, then taking 2 from 5 leaves 3, and taking 3 from 5 leaves 2.",
          "Taking away 0 leaves the number unchanged; taking away all of it leaves 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 5 − 2?",
      steps: ["2 and 3 make 5.", "So taking 2 from 5 leaves 3."],
      answer: "3",
    },
    pitfalls: [
      "Counting all the objects again instead of using a known pair.",
      "Treating 0 as one: 4 − 0 = 4.",
    ],
    parentGuide:
      "Hide some of five small objects under a cup. Show the rest and ask how many are hidden. Then say the fact both ways: 3 and 2 make 5; 5 take away 2 is 3.",
  },
  {
    id: "counting-arithmetic",
    title: "Counting on adds; counting back subtracts",
    summary:
      "Each number said after the start is one step, so counting on 3 adds 3 and counting back 3 subtracts 3.",
    templateIds: ["count-on-back", "counted-steps"],
    objectives: [
      "Add or subtract a small number by counting on or back from the start.",
      "Name the number added or subtracted by counting the steps said.",
    ],
    sections: [
      {
        title: "Start, then step",
        paragraphs: [
          "To find 8 + 3, start at 8 without counting it. Say three more numbers: 9, 10, 11. You land on 11.",
          "Each step on the number line is one. Three hops right add 3; three hops left subtract 3.",
        ],
        illustration: "count-on-hops",
      },
      {
        title: "Count the steps, not the start",
        paragraphs: [
          "Counting on from 9 by saying 10, 11, 12, 13 says four numbers, so 4 was added: 9 + 4 = 13.",
          "Saying the starting number again adds a step that never happened, which gives an answer one too many.",
        ],
      },
    ],
    workedExample: {
      prompt: "Start at 12. Count back 4. What number do you land on?",
      steps: ["Say four numbers back from 12: 11, 10, 9, 8.", "12 − 4 = 8."],
      answer: "8",
    },
    pitfalls: [
      "Counting the starting number as the first step.",
      "Losing track of how many numbers have been said; tap one finger for each.",
    ],
    parentGuide:
      "Walk along a row of tiles or stairs. Stand on one, say the number, then take three steps and name where you land. Ask what addition the walk shows.",
  },
  {
    id: "make-ten-facts",
    title: "Make ten to add and subtract within twenty",
    summary:
      "Ten is a stopping place: fill a ten first, then add or take away the rest.",
    templateIds: ["make-ten-fact", "related-subtraction"],
    objectives: [
      "Add two one-digit numbers by completing a ten.",
      "Subtract within twenty by finding the missing part of the related addition.",
    ],
    sections: [
      {
        title: "Fill the frame",
        paragraphs: [
          "For 8 + 5, the first frame has 8 counters and 2 empty places. Move 2 of the 5 counters to fill it. One full ten and 3 more make 13.",
          "Splitting 5 into 2 and 3 keeps all five counters, so the total does not change: 8 + 5 = 10 + 3.",
        ],
        illustration: "make-ten-frames",
      },
      {
        title: "Subtract by thinking addition",
        paragraphs: [
          "15 − 8 asks what joins 8 to make 15. From 8, 2 more makes 10; from 10, 5 more makes 15. That is 7 in all, so 15 − 8 = 7.",
          "Every subtraction fact has a partner addition: 8 + 7 = 15 and 15 − 8 = 7 use the same three numbers.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 7 + 6?",
      steps: [
        "7 needs 3 more to make 10.",
        "Split 6 into 3 and 3.",
        "10 + 3 = 13.",
      ],
      answer: "13",
    },
    pitfalls: [
      "Moving more counters than the empty places: 8 needs only 2 to make ten.",
      "Subtracting the smaller ones digit from the larger: 15 − 8 is not 13.",
    ],
    parentGuide:
      "Use an egg carton cut to ten cups. Fill it from two piles and ask how many are left over. Then ask the subtraction that undoes it.",
  },
  {
    id: "mental-ten-hundred",
    title: "Ten or one hundred more or less",
    summary:
      "Adding or subtracting 10 changes the tens digit; 100 changes the hundreds digit; the other digits stay.",
    templateIds: ["mental-ten-hundred"],
    objectives: [
      "Add or subtract 10 or 100 mentally for numbers from 100 to 900.",
      "Regroup when the tens pass a hundred: 396 + 10 = 406.",
    ],
    sections: [
      {
        title: "Change one place",
        paragraphs: [
          "470 is 4 hundreds, 7 tens and 0 ones. One more hundred is 5 hundreds, 7 tens and 0 ones: 570. One more ten is 4 hundreds, 8 tens: 480.",
          "No counting by ones is needed; only one digit changes.",
        ],
        illustration: "ten-hundred-digits",
      },
      {
        title: "When the tens pass a hundred",
        paragraphs: [
          "396 has 9 tens. One more ten makes 10 tens, which is 1 hundred: 4 hundreds, 0 tens, 6 ones = 406.",
          "503 has 0 tens. To take a ten, trade 1 hundred for 10 tens and take 1: 4 hundreds, 9 tens, 3 ones = 493.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 708 − 10?",
      steps: [
        "708 has 0 tens, so trade 1 hundred for 10 tens: 6 hundreds, 10 tens, 8 ones.",
        "Take 1 ten: 6 hundreds, 9 tens, 8 ones.",
        "708 − 10 = 698.",
      ],
      answer: "698",
    },
    pitfalls: [
      "Changing the ones digit when adding 10.",
      "Leaving the hundreds unchanged when the tens pass 9 or 0: 396 + 10 is not 3,106 or 306.",
    ],
    parentGuide:
      "Say a three-digit number, such as a house number, and ask for ten more, then one hundred less. Ask which digit changed and why.",
  },
];

export const factsMethods: Record<string, ProblemMethod> = {
  "facts-to-five": {
    goal: "Given an addition or subtraction with numbers to five, find the result.",
    method: [
      "Find the two parts that make the whole.",
      "Adding joins the parts; taking one part away leaves the other.",
    ],
    watch: "Adding or taking away 0 leaves the number the same.",
  },
  "count-on-back": {
    goal: "Given a start on the number line, count on or back and name where you land.",
    method: [
      "Put your finger on the start; do not count it.",
      "Say one number for each step, right for on, left for back.",
      "The last number said is the answer.",
    ],
    watch: "The starting number is not a step.",
  },
  "counted-steps": {
    goal: "Given a count on or back, find how many were added or subtracted.",
    method: [
      "List the numbers said after the start.",
      "Count them: that many were added or subtracted.",
    ],
    watch: "Do not include the start in the count of steps.",
  },
  "make-ten-fact": {
    goal: "Given two one-digit numbers with a sum over ten, find the sum.",
    terms: [["Make ten", "Move counters to fill one ten-frame exactly."]],
    method: [
      "Find how many the first number needs to make 10.",
      "Take that many from the second number.",
      "Add the rest to 10.",
    ],
    watch: "Move only as many as there are empty places.",
  },
  "related-subtraction": {
    goal: "Given a subtraction within twenty, find the difference.",
    method: [
      "Rewrite it as addition: what added to the number taken away makes the whole?",
      "Count up to 10, then up to the whole.",
      "Add the two jumps: that is the difference.",
    ],
    watch: "15 − 8 is not 13: the 8 is taken from the whole 15, not from 5.",
  },
  "mental-ten-hundred": {
    goal: "Given a number from 100 to 900, add or subtract 10 or 100 mentally.",
    method: [
      "For 10, change the tens digit by one; for 100, the hundreds digit.",
      "If the tens pass 9 or go below 0, regroup with the hundreds.",
      "The ones never change.",
    ],
    watch: "396 + 10 = 406: ten tens make one more hundred.",
  },
};

export const factsPrinciples: Record<string, string> = {
  "facts-to-five":
    "Addition and subtraction are inverses: if a + b = c, then c − b = a.",
  "count-on-back":
    "Counting on $n$ steps adds $n$ and counting back $n$ steps subtracts $n$, because each step is one.",
  "counted-steps":
    "The number added or subtracted equals the number of counts said after the start.",
  "make-ten-fact":
    "Associativity lets an addend be split to make a ten: $8 + 5 = 8 + (2 + 3) = (8 + 2) + 3 = 13$.",
  "related-subtraction": "c − b is the missing addend in b + □ = c.",
  "mental-ten-hundred":
    "Place value: adding 10 or 100 adds one unit to the tens or hundreds place, regrouping ten of a place into one of the next.",
};
