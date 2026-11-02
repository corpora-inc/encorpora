import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const factsLessons: Lesson[] = [
  {
    id: "facts-to-five",
    title: "Facts to five",
    summary:
      "A part is a piece of a group of things. You can split 5 counters into two parts, such as 2 and 3. Put the parts back together and you have all 5 again. Putting parts together is called addition. Taking one part away is called subtraction. Then the other part is left.",
    senses: { part: "part", parts: "part", whole: "whole" },
    noLink: ["leaves"],
    templateIds: ["facts-to-five"],
    objectives: [
      "Add and take away with numbers up to 5, using two parts you know.",
      "Use the same two parts for an adding fact and a take-away fact.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Split a small group",
        paragraphs: [
          "A counter is a small chip you can move. Put 5 counters in a row. Slide them into two groups: 2 and 3. Push them back together. You have 5 again.",
          "We write this as 2 + 3 = 5. The sign + means add, or put together. The sign = means is the same as.",
          "The same parts help you take away. Start with 5 and take away the 2. The 3 are left. We write 5 − 2 = 3. The sign − means take away.",
        ],
      },
      {
        title: "Parts that make five",
        paragraphs: [
          "Look at the five-frame. It is a row of 5 boxes, with room for one counter in each box. 3 counters are filled in and 2 are open. So 3 and 2 make 5.",
          "You can split 5 in other ways too: 0 and 5, 1 and 4, or 2 and 3. A fact is a short adding or take-away sentence you know by heart, like 1 + 4 = 5. Knowing these pairs means knowing the facts to five.",
          "The order of the parts does not matter. 3 + 2 = 5, and 2 + 3 = 5 too.",
        ],
        illustration: "five-frame-facts",
      },
      {
        title: "Take away with the same parts",
        paragraphs: [
          "3 and 2 make 5. So if you take 2 away from 5, 3 are left: 5 − 2 = 3. If you take 3 away from 5, 2 are left: 5 − 3 = 2.",
          "Taking away 0 takes nothing, so the number stays the same: 4 − 0 = 4. Taking away all of them leaves none: 4 − 4 = 0.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Adding and take-away facts",
        paragraphs: [
          "The whole is all of the counters together. Split the whole into two parts that share no counters. The two parts add up to the whole: 3 + 2 = 5.",
          "Take one part away from the whole, and the other part is left: 5 − 2 = 3 and 5 − 3 = 2. So two different parts give two adding facts and two take-away facts.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 5 − 2?",
      steps: [
        "5 − 2 means start with 5 and take away 2.",
        "Think of two parts that make 5. 2 and 3 make 5.",
        "Take away the part that is 2. The other part is left, so 5 − 2 = 3.",
      ],
      answer: "3",
    },
    pitfalls: [
      "Use a pair you know instead of counting every counter again. 2 and 3 make 5, so 5 − 2 = 3.",
      "Taking away 0 takes nothing away. So 4 − 0 = 4, not 3.",
    ],
    parentGuide:
      "Put 5 small objects on the table. Hide some under a cup and show the rest. Ask how many are hidden. Then say the fact both ways: 3 and 2 make 5, and 5 take away 2 is 3.",
  },
  {
    id: "counting-arithmetic",
    title: "Counting on adds; counting back subtracts",
    summary:
      "Counting on is a way to add. Start at the number you have, then count forward. Counting back is a way to take away: count backward instead. Each number you say is one step. The number you start at is not a step.",
    templateIds: ["count-on-back", "counted-steps"],
    objectives: [
      "Add a small number by counting on, and take away by counting back.",
      "Find how much was added or taken away by counting the numbers said after the start.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Begin at the number you already have",
        paragraphs: [
          "To add 3 to 8, start at 8. You already have 8, so do not count it. Now count three more: 9, 10, 11. You land on 11, so 8 + 3 = 11. The sign + means add.",
          "To take away, count back instead. Start at 7 and count back 2: say 6, then 5. You land on 5, so 7 − 2 = 5. The sign − means take away.",
        ],
      },
      {
        title: "Start, then step",
        paragraphs: [
          "A number line is a line with numbers in order, evenly spaced. Look at the number line in the picture. A dot marks 8. Each hop moves to the next number: 9, then 10, then 11. Three hops land on 11, so 8 + 3 = 11.",
          "A hop to the right adds 1. A hop to the left takes away 1. So three hops to the left from 8 land on 5: 8 − 3 = 5.",
        ],
        illustration: "count-on-hops",
      },
      {
        title: "Count the steps, not the start",
        paragraphs: [
          "Sometimes you know where the counting started and stopped. Then you can find how much was added. Count on from 9 to 13: say 10, 11, 12, 13. That is four numbers, so 4 was added: 9 + 4 = 13.",
          "Do not say the start number as a step. Saying 9 again adds a step that never happened. Then your count is 5, which is one too many.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "One step per count",
        paragraphs: [
          "A whole number is one of the numbers 0, 1, 2, 3 and so on. Let the letter $n$ stand for the starting number, and $k$ for the number of steps. Counting on $k$ steps lands on $n + k$. Counting back $k$ steps lands on $n - k$, when $k$ is not bigger than $n$.",
          "The starting number is never one of the steps.",
        ],
      },
    ],
    workedExample: {
      prompt: "Start at 12. Count back 4. What number do you land on?",
      steps: [
        "Start at 12. Do not count it, because you are already there.",
        "Count back four numbers, one for each step: 11, 10, 9, 8.",
        "The last number you said is 8. So 12 − 4 = 8.",
      ],
      answer: "8",
    },
    pitfalls: [
      "Do not count the start as the first step. Counting on 3 from 8 is 9, 10, 11.",
      "Keep track with your fingers. Hold up one finger for each number you say.",
    ],
    parentGuide:
      "Walk along a row of tiles or stairs. Stand on one and say its number. Take three steps forward and name where you land. Ask what adding sentence the walk shows, such as 4 + 3 = 7.",
  },
  {
    id: "make-ten-facts",
    title: "Make ten to add and subtract within twenty",
    summary:
      "A ten-frame is a frame of 10 boxes, in 2 rows of 5. One counter fits in each box. A full ten-frame shows 10, and adding to 10 is easy. So fill the ten first, then add what is left. This way of adding is called making a ten.",
    templateIds: ["make-ten-fact", "related-subtraction"],
    objectives: [
      "Add two numbers below 10 by making a ten first.",
      "Take away within 20 by finding the missing number in an adding fact.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Fill the ten before counting on",
        paragraphs: [
          "Think of 8 + 5. Put 8 counters in a ten-frame. 2 boxes are still empty. Take 2 of the 5 counters to fill them. Now the frame is full: that is 10. The 5 counters were split into 2 and 3, so 3 are left over. 10 and 3 make 13. So 8 + 5 = 13.",
          "The sign + means add. The sign = means is the same as.",
        ],
      },
      {
        title: "Fill the frame",
        paragraphs: [
          "Look at the two ten-frames. The first has 8 counters and 2 empty boxes. The second has 5 counters. Move 2 of the 5 into the empty boxes. The first frame is a full ten, and 3 counters are left.",
          "Moving counters does not add any or lose any. You split 5 into 2 and 3, so 8 + 5 is the same as 10 + 3.",
        ],
        illustration: "make-ten-frames",
      },
      {
        title: "Subtract by thinking addition",
        paragraphs: [
          "Subtraction means taking away, and we write it with −. 15 − 8 asks: 8 and what make 15? Count up from 8 to 10. That is 2 more. Count up from 10 to 15. That is 5 more. 2 and 5 make 7, so 15 − 8 = 7.",
          "Every take-away fact has a partner adding fact. 8 + 7 = 15 and 15 − 8 = 7 use the same three numbers.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Making a ten",
        paragraphs: [
          "A number you add is called an addend. You can split an addend into two smaller numbers, and its value stays the same: 5 = 2 + 3. Use one of them to fill up to 10. Then add the other one to 10: 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13.",
          "To take a number below 10 away from a number from 11 to 20, count up from the smaller number to 10. Then count up from 10 to the bigger number. The two counts together are the answer.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 7 + 6?",
      steps: [
        "7 needs 3 more to make 10, because 7 + 3 = 10.",
        "Split 6 into 3 and 3, because 3 + 3 = 6. Use the first 3 to fill the ten.",
        "10 and the other 3 make 13. So 7 + 6 = 13.",
      ],
      answer: "13",
    },
    pitfalls: [
      "Move only as many counters as there are empty boxes. 8 needs just 2 to make 10.",
      "In 15 − 8, take the 8 from all of 15. Do not take 5 from 8 instead. 15 − 8 is 7, not 13.",
    ],
    parentGuide:
      "Cut an egg carton down to 10 cups. Fill it from two piles of small objects, such as 8 and 5. Ask how many are left over once the carton is full. Then ask the take-away question that undoes it: 13 take away 5 is how many?",
  },
  {
    id: "mental-ten-hundred",
    title: "Ten or one hundred more or less",
    summary:
      "Numbers are built from hundreds, tens and ones. 470 is 4 hundreds, 7 tens and 0 ones. Adding 10 adds one more ten: 470 + 10 = 480. Adding 100 adds one more hundred: 470 + 100 = 570. The ones stay the same.",
    noLink: ["change", "changes"],
    templateIds: ["mental-ten-hundred"],
    objectives: [
      "Add or take away 10 or 100 in your head, for numbers from 100 to 900.",
      "Trade 10 tens for 1 hundred when the tens go past 9: 396 + 10 = 406.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Change a bundle",
        paragraphs: [
          "A ten is a bundle of 10 ones. A hundred is a bundle of 10 tens. 47 is 4 tens and 7 ones. Add one more ten and you have 5 tens and 7 ones. That is 57. The 7 ones did not change. Adding a hundred works the same way with hundreds.",
          "Sometimes there are 10 bundles of one kind. Then trade the 10 for 1 bigger bundle. 10 tens trade for 1 hundred. To take away, you can trade the other way: 1 hundred for 10 tens.",
        ],
      },
      {
        title: "Change one place",
        paragraphs: [
          "A digit is one of the symbols 0 to 9 we use to write numbers. Where a digit sits tells what it is worth: hundreds, tens or ones. In 470, the 4 means 4 hundreds.",
          "Look at the picture. The digit that changes is marked in each fact. 470 + 100 = 570 changes only the hundreds digit, from 4 to 5. 470 + 10 = 480 changes only the tens digit, from 7 to 8.",
          "You do not need to count by ones. Most of the time, only one digit changes.",
        ],
        illustration: "ten-hundred-digits",
      },
      {
        title: "When the tens pass 9",
        paragraphs: [
          "396 has 9 tens. One more ten makes 10 tens. 10 tens is the same as 1 hundred, so trade them for 1 hundred. Now there are 4 hundreds, 0 tens and 6 ones. That is 406.",
          "Trading 10 of one place for 1 of the next place is called regrouping. It also works the other way, 1 for 10.",
          "Taking 10 away can need a trade too. 503 has 0 tens, so there is no ten to take. Trade 1 hundred for 10 tens. Then take 1 ten away. 4 hundreds, 9 tens and 3 ones is 493.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "What each place is worth",
        paragraphs: [
          "Ten ones make one ten. Ten tens make one hundred. Adding 10 or 100 makes the number exactly that much bigger. Taking 10 or 100 away makes it that much smaller.",
          "Usually only one digit changes. If a place would go past 9 or below 0, regroup with the next place. The number keeps its value.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 708 − 10?",
      steps: [
        "708 has 0 tens, so there is no ten to take away yet.",
        "Trade 1 hundred for 10 tens: 6 hundreds, 10 tens and 8 ones. It is still 708.",
        "Now take away 1 ten: 6 hundreds, 9 tens and 8 ones. That is 698, so 708 − 10 = 698.",
      ],
      answer: "698",
    },
    pitfalls: [
      "When you add 10, leave the ones digit alone. 470 + 10 = 480.",
      "When the tens pass 9, the hundreds go up by 1. 396 + 10 = 406, not 3,106 or 306.",
    ],
    parentGuide:
      "Say a three-digit number, such as a house number. Ask for ten more, then one hundred less. Ask which digit changed and why.",
  },
];

export const factsMethods: Record<string, ProblemMethod> = {
  "facts-to-five": {
    goal: "Add or take away with numbers up to 5, and give the answer.",
    intuition:
      "A part is a piece of a group. The whole is all of the group. A group can be split into two parts. Put the parts together and you get the whole back. The sign + means add, or put together. The sign − means take away. When you take one part away, the other part is left.",
    senses: { part: "part", parts: "part", whole: "whole" },
    noLink: ["changes", "leaves"],
    method: [
      "To add, the two numbers are the parts. Put them together: in 2 + 3, 2 and 3 make 5.",
      "To take away, the first number is the whole. Think of two parts that make it: 2 and 3 make 5. Take one part away, and the other part is the answer: 5 − 2 = 3.",
    ],
    watch:
      "Adding 0 or taking away 0 changes nothing: 4 + 0 = 4 and 4 − 0 = 4.",
  },
  "count-on-back": {
    goal: "Start at a number on the number line, count on or back, and name where you land.",
    intuition:
      "A number line is a line with numbers in order, evenly spaced. Counting on means counting forward, to the right. It adds. Counting back means counting backward, to the left. It takes away. Each number you say is one step.",
    senses: { jump: "jump", jumps: "jump" },
    method: [
      "Put your finger on the start. Do not count it, because you are already there.",
      "Say one number for each step: to the right to count on, to the left to count back.",
      "The last number you say is where you land.",
    ],
    watch:
      "The starting number is not a step. Start counting with the next number.",
  },
  "counted-steps": {
    goal: "You see a count on or a count back. Find how many were added or taken away.",
    intuition:
      "Counting on means counting forward from a number. Each number you say after the start is 1 more. So the count of numbers you said tells how many were added. Counting back works the same way for taking away.",
    method: [
      "Look at the numbers said after the start. Leave out the start itself.",
      "Count those numbers. That is how many were added, or taken away for a count back.",
    ],
    watch: "Leave the start number out of your count.",
  },
  "make-ten-fact": {
    goal: "Add two numbers below 10 whose total is more than 10, by filling a ten first.",
    intuition:
      "A ten-frame is a frame of 10 boxes, in 2 rows of 5. One counter fits in each box. Making a ten means filling the frame first. Then add what is left over to 10. For 8 + 5, 2 counters fill the ten and 3 are left: 10 + 3 = 13.",
    senses: { "more than": "more-than" },
    terms: ["make-ten"],
    method: [
      "Find how many the first number needs to make 10. 8 needs 2.",
      "Take that many from the second number. 5 is 2 and 3.",
      "Add what is left to 10: 10 + 3 = 13.",
    ],
    watch: "Move only as many as there are empty boxes in the ten-frame.",
  },
  "related-subtraction": {
    goal: "Take one number away from another within 20, and find what is left.",
    intuition:
      "Taking away is the same as finding what is missing. 15 − 8 asks: 8 and what make 15? Count up from 8 to 10, then from 10 to 15. The two counts together are the answer.",
    senses: { difference: "difference-subtract", whole: "whole" },
    method: [
      "Turn it into adding. 15 − 8 asks what joins 8 to make 15.",
      "Count up from 8 to 10: that is 2. Then count from 10 to 15: that is 5.",
      "Add the two counts: 2 + 5 = 7. So 15 − 8 = 7.",
    ],
    watch:
      "Take the 8 away from all of 15, not from the 5. 15 − 8 is 7, not 13.",
  },
  "mental-ten-hundred": {
    goal: "Add or take away 10 or 100 in your head, starting from a number from 100 to 900.",
    intuition:
      "A digit is one of the symbols 0 to 9. Its place tells what it counts: hundreds, tens or ones. In 470, the 4 means 4 hundreds, the 7 means 7 tens and the 0 means 0 ones. Adding 10 adds one ten, so the tens digit goes up by 1. If the tens digit is 9, the 10 tens make 1 more hundred: 396 + 10 = 406. Adding 100 adds one hundred, so the hundreds digit goes up by 1. From 900 up, 10 hundreds make 1 thousand: 950 + 100 = 1,050.",
    noLink: ["change", "changes", "leaves"],
    method: [
      "For 10, change the tens digit by 1. For 100, change the hundreds digit by 1.",
      "If the tens go past 9 or below 0, trade with the hundreds. 10 tens make 1 hundred.",
      "The ones digit stays the same.",
    ],
    watch:
      "396 + 10 = 406. The 9 tens and 1 more ten make 10 tens, and 10 tens is 1 more hundred.",
  },
};

export const factsPrinciples: Record<string, string> = {
  "facts-to-five":
    "Adding and taking away undo each other. If 3 + 2 = 5, then 5 − 2 = 3 and 5 − 3 = 2.",
  "count-on-back":
    "Each step is 1. So counting on 3 steps adds 3, and counting back 3 steps takes away 3.",
  "counted-steps":
    "The number added or taken away is how many numbers were said after the start.",
  "make-ten-fact":
    "You can split a number you add into two smaller numbers and add them one at a time. The curved marks show what to add first: $8 + 5 = 8 + (2 + 3) = (8 + 2) + 3 = 13$.",
  "related-subtraction":
    "A box, □, stands for a missing number. 15 − 8 is the missing number in 8 + □ = 15: the number that joins 8 to make 15.",
  "mental-ten-hundred":
    "Each place is worth 10 of the place to its right. Adding 10 adds 1 ten, and adding 100 adds 1 hundred. Ten of one place trade for 1 of the next.",
};
