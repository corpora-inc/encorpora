import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const numberLineGapMethods: Record<string, ProblemMethod> = {
  "number-line-between-hundreds": {
    goal: "Read the whole number a point names on a number line between two neighboring hundreds by counting tick marks of 10.",
    intuition:
      "A number line between two hundreds is cut into equal steps. Here each tick mark is worth 10, and the halfway mark is 50 more than the left end. To read a point, decide whether it is before or after the halfway mark and then count the tick marks from the left end.",
    terms: ["tick-mark", "halfway-point"],
    method: [
      "Find the value of one tick mark: the distance between the ends divided by the number of steps.",
      "Count the tick marks from the left end to the point and multiply the count by the tick value.",
      "Add this to the left end. Check with the halfway mark: a point past it names a number past the halfway number.",
    ],
    watch:
      "Count from the left end, not from the right. A count of 7 tick marks is 70 more, not 7 more.",
  },
  "number-line-jump-story": {
    goal: "Match a jump to the left and a jump to the right on a number line to a story that takes away and adds the same amounts in the same order.",
    intuition:
      "A jump to the right adds and a jump to the left takes away. A number line with two jumps tells a story in order: it starts at a number, then the first jump happens, then the second. The lengths of the jumps are the amounts.",
    terms: [
      "jump",
      ["number-line", "The start is the number where the first jump begins."],
    ],
    method: [
      "Read the start and the length and direction of each jump, in order.",
      "A jump to the left is taking away or spending. A jump to the right is adding or earning.",
      "Choose the story that starts at the same number and has the same two actions with the same amounts in the same order.",
    ],
    watch:
      "Two stories can use the same numbers in a different order or with the amounts swapped. Check the order and which amount goes with which direction.",
  },
};

export const numberLineGapPrinciples: Record<string, string> = {
  "number-line-between-hundreds":
    "On a number line from $a$ to $a+100$ with ticks every 10, the point $k$ ticks from $a$ names $a+10k$. The halfway mark is $a+50$, and a point past it has $k>5$.",
  "number-line-jump-story":
    "A jump of length $n$ to the right adds $n$ and a jump of length $n$ to the left subtracts $n$. Two jumps from a start $s$ end at $s\\pm n_1\\pm n_2$, and the order of the jumps is the order of the actions in the story.",
};

export const numberLineGapLessons = [
  chainLesson({
    id: "number-line-between-hundreds-lesson",
    title: "Reading a point between two hundreds",
    summary:
      "Use tick marks of 10 and the halfway mark to name the number a point shows.",
    templateIds: ["number-line-between-hundreds"],
    objectives: [
      "Find what one tick mark of a number line is worth.",
      "Count tick marks from the left end to name the number a point shows.",
    ],
    openingTitle: "Count steps of ten from the left end",
    opening: [
      "A number line from 400 to 500 is cut into 10 equal steps, so each tick mark is 10 more than the one before. The halfway mark is 450.",
      "To read a point, count how many tick marks it is from 400 and multiply by 10. A point past the halfway mark has more than 5 tick marks.",
    ],
    example: {
      prompt:
        "On a number line from 400 to 500 with ticks every 10, point $P$ is 7 tick marks above 400. What number is it?",
      steps: [
        "Each tick mark is 10, so 7 tick marks is $7\\times10=70$.",
        "Add to the left end: $400+70=470$.",
        "470 is past the halfway mark 450, which fits a point 7 tick marks along.",
      ],
      answer: "470",
    },
    methodTitle: "Tick value, count, add",
    method: [
      "Tick value: distance between the ends divided by the steps. Count: tick marks from the left end. Number: left end plus count times tick value.",
      "Check with the halfway mark: the left end plus 50.",
    ],
    formalTitle: "Reading a number line",
    formal: [
      "On a line from $a$ to $a+100$ with 10 equal steps, the $k$th tick after $a$ is at $a+10k$.",
      "The midpoint of the line is $a+50$; a point with $k>5$ lies to its right.",
    ],
    pitfalls: [
      "Counting tick marks as ones instead of tens.",
      "Counting from the right end, which gives the mirror number.",
      "Reading a number past the end of the line.",
    ],
    parentGuide:
      "Ask your learner to say the number at each tick mark out loud, counting by tens from the left end.",
  }),
  chainLesson({
    id: "number-line-jump-story-lesson",
    title: "Jumps on a number line tell a story",
    summary:
      "Read two jumps on a number line and choose the story that takes away and adds the same amounts in order.",
    templateIds: ["number-line-jump-story"],
    objectives: [
      "Say what a jump to the left and a jump to the right mean.",
      "Choose the story with the same start, order and amounts as the jumps.",
    ],
    openingTitle: "Left takes away, right adds",
    opening: [
      "On a number line a jump to the right adds and a jump to the left takes away. Two jumps in a row tell a story in order: where it starts, then what happens first, then what happens next.",
      "Stories that use the same numbers can still differ in the order or in which amount goes with which jump. Match the start, then each jump in order.",
    ],
    example: {
      prompt:
        "The jumps start at 50. The first jump is 8 long and goes left. The second is 5 long and goes right. Which story fits: Story 1, a library has 50 books, lends out 8, then gets back 5; or Story 2, a library has 50 books, gets back 8, then lends out 5?",
      steps: [
        "The first jump goes left, so first something is taken away: 8.",
        "The second jump goes right, so next something is added: 5.",
        "Story 1 lends out 8 first and then gets back 5, which matches.",
      ],
      answer: "Story 1",
    },
    methodTitle: "Follow the jumps in order",
    method: [
      "Write the start, then each jump with its direction and length.",
      "Turn left into taking away and right into adding, and keep the order.",
    ],
    formalTitle: "Jumps and operations",
    formal: [
      "A jump of length $n$ to the right represents $+n$ and to the left represents $-n$.",
      "After two jumps from $s$ the number is $s+(\\pm n_1)+(\\pm n_2)$; the story must have the same signs and amounts in the same order.",
    ],
    pitfalls: [
      "Choosing a story with the actions in the opposite order.",
      "Swapping the two amounts.",
      "Choosing a story where both actions go the same way.",
    ],
    parentGuide:
      "Have your learner walk the jumps on a floor number line while saying the story.",
  }),
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
