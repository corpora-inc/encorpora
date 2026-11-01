import type { Lesson } from "./lessons.js";
/** Bounded interpretation lessons. Selecting an answer does not assess a learner's own proof. */
export const choiceLessons: Lesson[] = [
  {
    id: "fraction-renaming",
    title: "Cut the pieces, keep the amount",
    summary:
      "A fraction names equal parts of a whole. The denominator, the bottom number, says how many equal parts make the whole. The numerator, the top number, counts the parts you have. Cut every part into the same number of smaller equal parts, and the amount stays the same. Equivalent means naming the same amount. Fractions like 2/3 and 4/6 are called equivalent fractions.",
    templateIds: ["fraction-equivalence-choice"],
    senses: {
      whole: "whole",
      part: "part",
      third: "third",
      "more than": "more-than",
    },
    noLink: ["change", "changes", "changed", "leaves"],
    objectives: [
      "Find equivalent fractions by multiplying the top and bottom numbers by the same number.",
      "Explain why adding the same number to the top and bottom usually changes the amount.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Cut each piece without changing the shading",
        paragraphs: [
          "Look at one rectangle cut into 3 equal strips. Shade 2 strips, which means color them in. The shaded amount is two thirds, written 2/3.",
          "Now cut every strip into 2 equal pieces: the shaded strips and the white one too. Nothing new is shaded, and the rectangle is the same size.",
          "Count again. The whole has 6 small pieces, so each piece is a sixth. The shaded part is 4 of them, so it is four sixths, 4/6. The shaded amount did not change. Only the names and the counts changed. So 2/3 = 4/6.",
        ],
      },
      {
        title: "Both numbers must grow the same way",
        paragraphs: [
          "Suppose every piece is cut into 3 equal smaller pieces. Each old piece becomes 3 small pieces. So the number of pieces in the whole is multiplied by 3. The number of shaded pieces is multiplied by 3 too. So multiply both the numerator and the denominator by 3.",
          "If you multiply only the numerator, you take more pieces of the old size, so the amount grows. If you multiply only the denominator, the pieces get smaller but you do not take more of them, so the amount shrinks.",
          "Adding the same number to the top and bottom is different. Add 2 to the top and bottom of 2/3, and you get 4/5. Four fifths leaves 1 fifth white. Two thirds leaves 1 third white. A fifth is smaller than a third, so the white gaps are different sizes. So 2/3 and 4/5 are not the same amount.",
        ],
      },
      {
        title: "Check each choice",
        paragraphs: [
          "For each choice, ask: was every piece cut into the same number of smaller pieces? If so, both numbers were multiplied by the same number, and the choice names the same amount.",
          "You can also go the other way. Group small pieces into bigger ones by dividing both numbers by the same number, other than 0. 4/6 becomes 2/3 when you divide the top and bottom by 2.",
          "You can also draw bars to check. Keep the whole the same size in each drawing.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equivalent fraction names",
        paragraphs: [
          "Pick a number such as 2, 3 or 4. Multiply the numerator and the denominator of a fraction by it. This cuts every part into equal smaller parts, so the amount does not change.",
          "You can also divide the numerator and the denominator by the same number, other than 0, when it divides both of them evenly. This groups small parts into bigger ones, so the amount does not change either.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which names the same amount as 2/3: 4/6, 4/5, 4/3, or 2/6?",
      steps: [
        "Picture 2/3: a whole cut into 3 equal parts, with 2 shaded. Cut each third into 2 equal pieces. The whole now has 6 pieces, so each piece is a sixth.",
        "The 2 shaded thirds become 4 shaded sixths, and the whole is 6 sixths. So 2/3 = 4/6. Both numbers were multiplied by 2.",
        "Check the other choices. 4/5 adds 2 to the top and bottom, which changes the amount. 4/3 is more than a whole. 2/6 is only 2 of the smaller pieces. So the answer is 4/6.",
      ],
      answer: "4/6",
    },
    pitfalls: [
      "To compare real amounts, the fractions must be parts of wholes of the same size.",
      "Adding the same number to the top and bottom usually changes the amount. Multiply or divide both by the same number instead.",
    ],
    parentGuide:
      "Use one paper rectangle. Fold it into thirds and shade two. Fold each third in half. Ask your child to name the shaded part both ways before looking at the choices. Then ask for another name for the same amount, without any choices.",
  },
  {
    id: "equation-solution-sets",
    title: "When the variable terms disappear",
    summary:
      "A letter such as $x$ stands for an unknown number; $5x$ means five copies of it. A linear equation in $x$ may work for one number, none, or every number.",
    templateIds: ["equation-solution-count"],
    objectives: [
      "Distinguish one solution, no solution, and infinitely many solutions.",
      "Interpret a true or false equality after the variable terms cancel.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Ask which numbers make both sides match",
        paragraphs: [
          "Here the unknown appears only as copies of $x$ added to numbers. An equation of this kind is linear. Some linear equations balance for one number, others never balance, and some balance for every number. Simplifying both sides reveals which kind you have.",
        ],
      },
      {
        title: "What counts as a solution?",
        paragraphs: [
          "A solution is a value that makes the original left and right sides equal. In 2x + 3 = 3x + 7, subtracting 2x and then 7 gives −4 = x. Only x = −4 works. Substitute it into the original: both sides are −5.",
          "The operations must preserve equality. Subtracting the same expression from both sides does this. Keep checking the relationship between the sides instead of assuming every equation must end with $x$ equal to a number.",
        ],
      },
      {
        title: "Cancellation can tell two different stories",
        paragraphs: [
          "For 4x + 3 = 4x + 8, subtract 4x from both sides. You get 3 = 8. That statement is never true, whatever $x$ was. There is no solution; x = 0 does not rescue it.",
          "For 4x + 3 = 4x + 3, the same subtraction gives 3 = 3. Every real number works because the two expressions are identical. There are infinitely many solutions, not just the value zero.",
        ],
      },
      {
        title: "A quick test is not a proof",
        paragraphs: [
          "Trying x = 0 can disprove a claim that every number works. It cannot by itself prove that no number works: the equation might have a different solution. Simplifying the equation explains the entire solution set.",
          "When all variable terms cancel, read the remaining equality. A false number statement means no solution; a true number statement means every real $x$ works. If a nonzero multiple of $x$ remains, isolate $x$ to obtain exactly one solution.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Possible numbers of solutions",
        paragraphs: [
          "For real numbers $a,b,c,d$, a linear equation $ax+b=cx+d$ becomes $(a-c)x=d-b$ after subtracting equal amounts from both sides. If $a-c$ is nonzero, exactly one real $x$ works. If $a-c=0$ and $d-b$ is nonzero, none works. If both are zero, every real $x$ works.",
        ],
      },
    ],
    workedExample: {
      prompt: "How many real-number solutions does 5x + 2 = 5x + 9 have?",
      steps: [
        "Subtract 5x from both sides: 2 = 9.",
        "The equality is false regardless of $x$. There is no solution.",
      ],
      answer: "No solution",
    },
    pitfalls: [
      "0x = 7 is impossible; it does not mean x = 0.",
      "0x = 0 is true for every real $x$. Do not divide both sides by zero.",
    ],
    parentGuide:
      "Write three equations: 2x + 1 = 3x + 5, 2x + 1 = 2x + 5, and 2x + 1 = 2x + 1. Ask what changes between them and why that changes the solution set. Have the learner construct a fourth example of each kind.",
  },
  {
    id: "graph-to-equation",
    title: "A starting height and a steady climb",
    summary:
      "In $(x,y)$, $x$ is the horizontal input and $y$ the vertical output. A line's rule uses its output at $x=0$ and its rise for each step right.",
    templateIds: ["graph-equation-choice"],
    objectives: [
      "Read a $y$-intercept and a rate of change from two labeled points.",
      "Check a proposed linear equation against the graph.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A line has a start and a steady change",
        paragraphs: [
          "A line can cross the vertical axis at five and rise two for each step right. The crossing tells its output when the input is zero; the rise tells how its output changes afterward. In a point $(x,y)$, $x$ is the horizontal input and $y$ the vertical output. Together the crossing and rise describe the line.",
        ],
      },
      {
        title: "Start where the input is zero",
        paragraphs: [
          "The vertical axis is the set of points with x = 0. If a line crosses it at (0, 5), then the rule must give y = 5 when x = 0. In y = mx + b, the term mx becomes zero there, leaving $b$.",
          "The intercept is a $y$-coordinate, not the distance between two points. A line can cross high on the axis and climb slowly, or cross low and climb steeply. Starting height and rate of change do different jobs.",
        ],
      },
      {
        title: "Count change in coordinate units",
        paragraphs: [
          "Suppose a second point is (2, 9). Moving from (0, 5) to (2, 9) changes $x$ by 2 and $y$ by 4. The slope is 4 divided by 2, or 2 units up for each unit to the right.",
          "Read the numbers on both axes. A grid square is not always one unit, and the drawing may stretch the two axes differently. Slope comes from coordinate changes, not the visual angle of the line on the screen.",
        ],
      },
      {
        title: "Put the two facts together",
        paragraphs: [
          "A slope of 2 and intercept of 5 give y = 2x + 5. At x = 2, this predicts 9, matching the second point. Testing a second point catches a rule with the correct starting height but the wrong slope.",
          "Swapping the numbers gives y = 5x + 2, which starts at the wrong height. Dropping the constant gives y = 2x, which passes through the origin. A negative coefficient would make $y$ fall as $x$ increases. Each choice makes a different claim you can check.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Slope and intercept determine a line",
        paragraphs: [
          "A nonvertical line with constant slope $m$ crossing the vertical axis at $(0,b)$ has equation $y=mx+b$. A vertical line has equation $x=c$ and cannot be written in this slope-intercept form.",
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
