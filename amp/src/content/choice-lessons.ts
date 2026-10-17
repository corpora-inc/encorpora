import type { Lesson } from "./lessons.js";
/** Bounded interpretation lessons. Selecting an answer does not assess a learner's own proof. */
export const choiceLessons: Lesson[] = [
  {
    id: "fraction-renaming",
    title: "Cut the pieces, keep the amount",
    summary:
      "A fraction names an amount using a chosen unit. Smaller pieces change both counts, without changing what is shaded.",
    templateIds: ["fraction-equivalence-choice"],
    objectives: [
      "Recognize equivalent fractions by scaling both counts.",
      "Explain why adding to both counts does not preserve an amount.",
    ],
    sections: [
      {
        title: "One picture, two names",
        paragraphs: [
          "Shade two of three equal strips in one rectangle. The amount is two thirds. Cut every strip in half, including the unshaded strip. You have not moved the outside edge or shaded anything new.",
          "The whole has six small pieces and the shaded part has four. Two thirds and four sixths name the same area. The denominator counts all the equal pieces in one whole; the numerator counts the pieces you have.",
        ],
      },
      {
        title: "Both counts must scale",
        paragraphs: [
          "If every piece splits into three, there are three times as many pieces in the whole and three times as many in the shaded part. Multiplying only the numerator takes more pieces of the old size. Multiplying only the denominator makes the pieces smaller without taking enough of them.",
          "Adding the same number to numerator and denominator does something different. Two thirds becomes four fifths if you add two. Four fifths leaves only one fifth unshaded, while two thirds leaves one third. Those gaps are different, so the amounts cannot match.",
        ],
      },
      {
        title: "Read choices as claims",
        paragraphs: [
          "For each proposed fraction, ask what happened to the piece size and the shaded count. Look for a common scale factor. You can also sketch equal-length bars; keep the whole the same size in each sketch.",
          "Once you choose, explain the change in units aloud. Recognizing a printed fraction is useful practice; drawing a new representation and explaining why it works are separate skills to practice too.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which names the same amount as 2/3: 4/6, 4/5, 4/3, or 2/6?",
      steps: [
        "Split each third into two sixths.",
        "Two shaded thirds become four shaded sixths, while the whole has six sixths.",
        "Choose 4/6. Both counts doubled, and the area stayed fixed.",
      ],
      answer: "4/6",
    },
    pitfalls: [
      "Equal fractions must refer to the same-sized whole when comparing physical amounts.",
      "Adding the same number to both counts is not the same as scaling both counts.",
    ],
    parentGuide:
      "Use one paper rectangle. Fold it into thirds and shade two. Fold each third in half and have the learner explain both names before looking at the answer choices. Ask for another equivalent name without offering choices.",
  },
  {
    id: "equation-solution-sets",
    title: "When the x-terms disappear",
    summary:
      "An equation can pick out one number, reject every number, or be true for every real number. Simplification reveals which story it tells.",
    templateIds: ["equation-solution-count"],
    objectives: [
      "Distinguish one solution, no solution, and infinitely many solutions.",
      "Interpret a true or false equality after the variable terms cancel.",
    ],
    sections: [
      {
        title: "What counts as a solution?",
        paragraphs: [
          "A solution is a value that makes the original left and right sides equal. In 2x + 3 = 3x + 7, subtracting 2x and then 7 gives −4 = x. Only x = −4 works. Substitute it into the original: both sides are −5.",
          "The operations must preserve equality. Subtracting the same expression from both sides does this. Keep checking the relationship between the sides instead of assuming every equation must end with x equal to a number.",
        ],
      },
      {
        title: "Cancellation can tell two different stories",
        paragraphs: [
          "For 4x + 3 = 4x + 8, subtract 4x from both sides. You get 3 = 8. That statement is never true, whatever x was. There is no solution; x = 0 does not rescue it.",
          "For 4x + 3 = 4x + 3, the same subtraction gives 3 = 3. Every real number works because the two expressions are identical. There are infinitely many solutions, not just the value zero.",
        ],
      },
      {
        title: "A quick test is not a proof",
        paragraphs: [
          "Trying x = 0 can disprove a claim that every number works. It cannot by itself prove that no number works: the equation might have a different solution. Simplifying the equation explains the entire solution set.",
          "When all variable terms cancel, read the remaining equality. A false number statement means no solution; a true number statement means every real x works. If a nonzero multiple of x remains, isolate x to obtain exactly one solution.",
        ],
      },
    ],
    workedExample: {
      prompt: "How many real-number solutions does 5x + 2 = 5x + 9 have?",
      steps: [
        "Subtract 5x from both sides: 2 = 9.",
        "The equality is false regardless of x. There is no solution.",
      ],
      answer: "No solution",
    },
    pitfalls: [
      "0x = 7 is impossible; it does not mean x = 0.",
      "0x = 0 is true for every real x. Do not divide both sides by zero.",
    ],
    parentGuide:
      "Write three equations: 2x + 1 = 3x + 5, 2x + 1 = 2x + 5, and 2x + 1 = 2x + 1. Ask what changes between them and why that changes the solution set. Have the learner construct a fourth example of each kind.",
  },
  {
    id: "graph-to-equation",
    title: "A starting height and a steady climb",
    summary:
      "An intercept locates a line and a slope describes its change. Together they determine the rule y = mx + b.",
    templateIds: ["graph-equation-choice"],
    objectives: [
      "Read a y-intercept and a rate of change from two labeled points.",
      "Check a proposed linear equation against the graph.",
    ],
    sections: [
      {
        title: "Start where x is zero",
        paragraphs: [
          "The vertical axis is the set of points with x = 0. If a line crosses it at (0, 5), then the rule must give y = 5 when x = 0. In y = mx + b, the term mx becomes zero there, leaving b.",
          "The intercept is a y-coordinate, not the distance between two points. A line can cross high on the axis and climb slowly, or cross low and climb steeply. Starting height and rate of change do different jobs.",
        ],
      },
      {
        title: "Count change in coordinate units",
        paragraphs: [
          "Suppose a second point is (2, 9). Moving from (0, 5) to (2, 9) changes x by 2 and y by 4. The slope is 4 divided by 2, or 2 units up for each unit to the right.",
          "Read the numbers on both axes. A grid square is not always one unit, and the drawing may stretch the two axes differently. Slope comes from coordinate changes, not the visual angle of the line on the screen.",
        ],
      },
      {
        title: "Put the two facts together",
        paragraphs: [
          "A slope of 2 and intercept of 5 give y = 2x + 5. At x = 2, this predicts 9, matching the second point. Testing a second point catches a rule with the correct starting height but the wrong slope.",
          "Swapping the numbers gives y = 5x + 2, which starts at the wrong height. Dropping the constant gives y = 2x, which passes through the origin. A negative coefficient would make y fall as x increases. Each choice makes a different claim you can check.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Which rule passes through (0, 5) and (2, 9): y = 2x + 5 or y = 5x + 2?",
      steps: [
        "At x = 0, y = 5, so the constant must be 5.",
        "The slope is (9 − 5)/(2 − 0) = 2.",
        "Choose y = 2x + 5. It gives 9 when x = 2.",
      ],
      answer: "y = 2x + 5",
    },
    pitfalls: [
      "Use rise divided by run, not run divided by rise.",
      "Check the axis labels before counting grid squares; screen angles do not determine slope.",
    ],
    parentGuide:
      "Draw two points on paper with labeled axes and ask the learner to describe the starting height and change before writing an equation. Then change only the intercept, and ask which features of the line stay the same. Include decreasing lines in discussion as a transfer task.",
  },
];
