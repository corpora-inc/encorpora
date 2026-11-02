import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const numberLineGapMethods: Record<string, ProblemMethod> = {
  "number-line-between-hundreds": {
    goal: "Read the whole number a point names on a number line between two neighboring hundreds, where each step between tick marks is 10.",
    intuition:
      "A number line is a line with numbers in order, evenly spaced. Short lines called tick marks cross it. Here the line runs from one hundred to the next, such as 900 to 1,000. It is cut into 10 equal steps, so each step from one tick mark to the next adds 10. The halfway mark is the tick mark exactly in the middle, 50 past the left end.",
    senses: { "more than": "more-than" },
    terms: ["tick-mark", "halfway-point"],
    method: [
      "Find what one step is worth. The ends are 100 apart and there are 10 equal steps, so each step adds 10.",
      "Count the steps from the left end to the point. Do not count the left end itself. Each step adds 10.",
      "Add that many tens to the left end. Check with the halfway mark: a point past it is more than 50 past the left end.",
    ],
    watch:
      "Count steps from the left end, not from the right. 7 steps is 70 more, not 7 more.",
  },
  "number-line-jump-story": {
    goal: "Match a number line with one jump left and one jump right to the story with the same actions and amounts, in the same order.",
    intuition:
      "A number line is a line with numbers in order, evenly spaced, getting bigger to the right. A jump is a curved arrow that shows a move along it. A jump to the right adds, and a jump to the left takes away. The length of a jump is how many numbers it moves. That is the amount added or taken away.",
    senses: { jump: "jump", jumps: "jump" },
    terms: [
      "jump",
      ["number-line", "The start is the number where the first jump begins."],
    ],
    method: [
      "Read the start. Then read each jump, in order: which way it goes and how long it is.",
      "A jump to the left is taking away or spending. A jump to the right is adding or earning.",
      "Choose the story with the same start and the same two actions. Check the amounts and the order too.",
    ],
    watch:
      "Two stories can use the same numbers in a different order, or with the amounts swapped. Check the order, and which amount goes with which way.",
  },
};

export const numberLineGapPrinciples: Record<string, string> = {
  "number-line-between-hundreds":
    "A number line from one hundred to the next has a tick mark every 10. Count the steps from the left end. Each step adds 10. The halfway mark is 50 past the left end, so a point past it is more than 5 steps along.",
  "number-line-jump-story":
    "A jump to the right adds its length, and a jump to the left takes its length away. Two jumps from a start happen in order. So the story must do the same two actions, with the same amounts, in the same order.",
};

export const numberLineGapLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "number-line-between-hundreds-lesson",
      title: "Reading a point between two hundreds",
      summary:
        "A number line is a line with numbers in order, evenly spaced. Short lines called tick marks cross it at equal steps. Between 400 and 500 there can be 10 equal steps, each adding 10. The halfway mark is the tick mark exactly in the middle, at 450. To read a point, count the steps from the left end and count by tens.",
      templateIds: ["number-line-between-hundreds"],
      objectives: [
        "Find what one step between tick marks is worth.",
        "Count steps from the left end to name the number a point shows.",
      ],
      openingTitle: "Count steps of ten from the left end",
      opening: [
        "Look at a number line from 400 to 500. The two ends are 100 apart. The line is cut into 10 equal steps, and 10 tens make 100. So each step adds 10: 400, 410, 420, 430 and so on.",
        "The halfway mark is 5 steps from each end. 5 steps of 10 is 50, so the halfway mark is 400 + 50 = 450.",
        "To read a point, count the steps from 400 to the point. Do not count 400 itself. Then count by tens that many times, and add that to 400. A point past the halfway mark is more than 5 steps along.",
      ],
      example: {
        prompt:
          "On a number line from 400 to 500 with tick marks every 10, point $P$ is 7 steps to the right of 400. What number is it?",
        steps: [
          "Each step adds 10. So 7 steps add 7 tens, which is 70.",
          "Moving right makes numbers bigger, so start at the left end and add: 400 + 70 = 470.",
          "Check with the halfway mark, 450. The point is 7 steps along, past the middle at 5 steps. 470 is past 450, so it fits.",
        ],
        answer: "470",
      },
      methodTitle: "Step value, count, add",
      method: [
        "Find what one step is worth. The ends are 100 apart, and 100 split into 10 equal steps is 10 per step.",
        "Count the steps from the left end to the point. Add that many tens to the left end.",
        "Check with the halfway mark, which is the left end plus 50.",
      ],
      formalTitle: "Reading a number line",
      formal: [
        "Let $a$ stand for the number at the left end. The right end is $a + 100$, and there are 10 equal steps of 10.",
        "Let $k$ stand for the number of steps from the left end to the point. Then the point names $a + 10 \\times k$.",
        "The halfway mark is $a + 50$. A point with more than 5 steps lies to its right.",
      ],
      pitfalls: [
        "Each step is worth 10 here, not 1. 7 steps past 400 is 470, not 407.",
        "Count from the left end and add. Counting 7 steps from the right end gives 430 instead.",
        "The point is between the two ends, so your answer must be between them too.",
      ],
      parentGuide:
        "Ask your learner to say the number at each tick mark out loud, counting by tens from the left end: 400, 410, 420 and on to 500.",
    }),
    senses: { "more than": "more-than" },
  },
  {
    ...chainLesson({
      id: "number-line-jump-story-lesson",
      title: "Jumps on a number line tell a story",
      summary:
        "A number line is a line with numbers in order, evenly spaced. Bigger numbers are to the right. A jump is a curved arrow that shows a move along it. A jump to the right adds. A jump to the left takes away. The length of a jump is how far it goes. It is the amount.",
      templateIds: ["number-line-jump-story"],
      objectives: [
        "Say what a jump to the left and a jump to the right mean.",
        "Choose the story with the same start, order and amounts as the jumps.",
      ],
      openingTitle: "Left takes away, right adds",
      opening: [
        "Start at 30 on a number line. A jump of 6 to the left lands on 24. That is like taking 6 away: 30 − 6 = 24.",
        "Then a jump of 4 to the right lands on 28. That is like adding 4: 24 + 4 = 28.",
        "Two jumps in a row tell a story in order. First comes the start. Then the first jump happens. Then the second jump happens.",
        "Two stories can use the same numbers but still be different. One might do things in the other order. One might swap the two amounts. So match the start, then each jump in order.",
      ],
      example: {
        prompt:
          "The jumps start at 50. The first jump is 8 long and goes left. The second is 5 long and goes right. Story 1: a library has 50 books, lends out 8, then gets back 5. Story 2: a library has 50 books, gets back 8, then lends out 5. Which story fits?",
        steps: [
          "The jumps start at 50, and both stories start with 50 books.",
          "The first jump goes left 8, so first 8 are taken away. Lending out 8 books takes 8 away.",
          "The second jump goes right 5, so next 5 are added. Getting back 5 books adds 5.",
          "Story 1 lends out 8, then gets back 5. That matches. Story 2 adds 8 first, so it does not match.",
        ],
        answer: "Story 1",
      },
      methodTitle: "Follow the jumps in order",
      method: [
        "Write the start. Then write each jump: which way it goes and how long it is.",
        "Turn left into taking away and right into adding. Keep them in the same order.",
      ],
      formalTitle: "Jumps, adding and taking away",
      formal: [
        "A jump to the right adds its length. A jump to the left takes its length away.",
        "After two jumps, you land on the start with both jumps made, in order. The story must have the same start, the same actions and the same amounts, in the same order.",
      ],
      pitfalls: [
        "Check the order. A story that does the two actions the other way round does not match.",
        "Check which amount goes with which jump. Swapping the two amounts gives a different story.",
        "One jump goes left and one goes right. So the story must take away once and add once.",
      ],
      parentGuide:
        "Draw a number line on the floor with chalk or tape. Have your learner walk the jumps while telling the story out loud.",
    }),
    senses: { jump: "jump", jumps: "jump" },
    noLink: ["mean"],
  },
];

export const numberLineGapFacetMappings: FacetMapping[] = [
  {
    templateId: "number-line-between-hundreds",
    facetId: "round-whole-numbers.core",
    extent: "partial",
    rationale:
      "Single choice of the whole number a point names on a number line of 10 steps of 10 between two neighboring hundreds, from 100 to 1,000 or from 1,100 to 9,900. Does not assess estimating a point that is between ticks, rounding the number, or number lines with other step sizes.",
  },
  {
    templateId: "number-line-jump-story",
    facetId: "number-line-arithmetic.core",
    extent: "partial",
    rationale:
      "Single choice of the story for a number line with a start and one left and one right jump of 4 to 30 units. Does not assess finding where the jumps end, choosing the diagram for a story, or jumps by amounts that are not whole numbers.",
  },
];
