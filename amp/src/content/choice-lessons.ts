import type { Lesson } from "./lessons.js";
/** Bounded interpretation lessons. Selecting an answer does not assess a learner's own proof. */
export const choiceLessons: Lesson[] = [
  {
    id: "fraction-renaming",
    title: "Cut the pieces, keep the amount",
    summary:
      "The same shaded amount can have different fraction names when every part is cut equally.",
    templateIds: ["fraction-equivalence-choice"],
    objectives: [
      "Recognize equivalent fractions by scaling both counts.",
      "Explain why adding to both counts does not preserve an amount.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Cut each piece without changing the shade",
        paragraphs: [
          "Shade two thirds of one rectangle. If every third is cut into two equal pieces, the same shaded region now has four pieces and the whole has six. Only the pieces' names and counts changed.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Equivalent fraction names",
        paragraphs: [
          "Multiplying a fraction's numerator and positive denominator by the same nonzero whole number subdivides every part equally, so the fraction's value is unchanged. Conversely, dividing both by a common positive factor groups equal small parts into larger ones.",
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
    title: "When the variable terms disappear",
    summary:
      "An equation says two amounts are equal. It has two sides: the amounts left and right of its equals sign. A variable is a letter, such as $x$, that stands for an unknown number, and $5x$ means 5 times $x$. A solution is a value of $x$ that makes the two sides equal. A linear equation is one where $x$ is only multiplied by numbers and added to them. It can have one solution, no solution, or every number as a solution.",
    senses: { side: "side-of-equation", sides: "side-of-equation" },
    noLink: [
      "impossible",
      "multiple",
      "fourth",
      "mean",
      "changes",
      "parts",
      "part",
      "terms",
    ],
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
          "Some linear equations are true for exactly one number. Some are never true. Some are true for every number. Simplifying both sides, by combining the $x$ parts and the plain numbers, shows which kind you have.",
        ],
      },
      {
        title: "What counts as a solution?",
        paragraphs: [
          "In $2x + 3 = 3x + 7$, subtract $2x$ from both sides: $3 = x + 7$. Subtract 7 from both sides: $-4 = x$. Only $x = -4$ works. Check in the original: $2(-4) + 3 = -5$ and $3(-4) + 7 = -5$, so both sides are $-5$.",
          "Each step must keep the two sides equal, and subtracting the same amount from both sides does this. So keep watching what the two sides say. Do not assume every equation must end with $x$ equal to one number.",
        ],
      },
      {
        title: "Cancellation can tell two different stories",
        paragraphs: [
          "For $4x + 3 = 4x + 8$, subtract $4x$ from both sides. You get $3 = 8$, which is never true, whatever $x$ is. So there is no solution, and $x = 0$ does not rescue it.",
          "For $4x + 3 = 4x + 3$, the same subtraction gives $3 = 3$, which is always true. Real numbers are all the numbers on the number line. The two sides are exactly the same, so every real number works. There are infinitely many solutions, not just 0.",
        ],
      },
      {
        title: "A quick test is not a proof",
        paragraphs: [
          "Trying $x = 0$ can show that not every number works. It cannot show that no number works, because some other number might. A proof is a reason that works in every case. Simplifying gives one, because it finds all the solutions at once.",
          "When all the $x$ parts cancel, read what is left. A false number statement, like $3 = 8$, means no solution. A true one, like $3 = 3$, means every real $x$ works. To isolate means to get $x$ alone on one side. If some $x$ part other than $0x$ remains, isolate $x$ to find exactly one solution.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Possible numbers of solutions",
        paragraphs: [
          "For real numbers $a$, $b$, $c$ and $d$, the linear equation $ax+b=cx+d$ becomes $(a-c)x=d-b$ after subtracting $cx$ and $b$ from both sides. If $a-c\\neq0$ ($a-c$ is not 0), exactly one real $x$ works. If $a-c=0$ and $d-b\\neq0$, none works. If both are 0, every real $x$ works. The solution set is the collection of all the solutions.",
        ],
      },
    ],
    workedExample: {
      prompt: "How many real-number solutions does $5x + 2 = 5x + 9$ have?",
      steps: [
        "Subtract $5x$ from both sides: $2 = 9$.",
        "That statement is false whatever $x$ is, so no value works. There is no solution.",
      ],
      answer: "No solution",
    },
    pitfalls: [
      "$0x = 7$ has no solution: 0 times any number is 0, never 7. It does not mean $x = 0$.",
      "$0x = 0$ is true for every real $x$. Do not divide both sides by zero.",
    ],
    parentGuide:
      "Write three equations: $2x + 1 = 3x + 5$, $2x + 1 = 2x + 5$ and $2x + 1 = 2x + 1$. Ask what changes between them and why that changes the solutions. Have the learner make up a fourth example of each kind.",
  },
  {
    id: "graph-to-equation",
    title: "A starting height and a steady climb",
    summary:
      "A point is written $(x, y)$: $x$ across and $y$ up. The input is the number you choose, $x$, and the output is the number the rule gives, $y$. A line's rule is an equation that gives $y$ from $x$. It uses two facts: the output at $x = 0$, and the slope, the rise for each step of 1 to the right.",
    senses: {
      rule: "rule",
      rules: "rule",
      change: "change",
      changes: "change",
      unit: "unit",
      units: "unit",
      square: "square-shape",
      squares: "square-shape",
      decreasing: "decreasing",
    },
    noLink: ["term", "part"],
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
          "A line can cross the up-and-down axis at 5 and rise 2 for each step to the right. The crossing tells its output when the input is 0. The rise tells how its output changes after that. Together the crossing and the rise describe the line.",
        ],
      },
      {
        title: "Start where the input is zero",
        paragraphs: [
          "The up-and-down axis is the set of points with $x = 0$. If a line crosses it at $(0, 5)$, the rule must give $y = 5$ when $x = 0$. In $y = mx + b$, the part $mx$ becomes 0 there, leaving $b$. The $y$-intercept is the value $b$ where the line crosses this axis.",
          "The height of a point is its $y$-coordinate, the up-down number. The intercept is a height. It is not a distance between two points. A line can cross high on the axis and climb slowly, or cross low and climb steeply. The rate of change is how fast the output changes, here the rise for each step right. The starting height and the rate of change do different jobs.",
        ],
      },
      {
        title: "Count change in coordinate units",
        paragraphs: [
          "Suppose a second point is $(2, 9)$. Moving from $(0, 5)$ to $(2, 9)$ changes $x$ by 2 and $y$ by 4. The slope is the rise for each step of 1 to the right: $4 \\div 2 = 2$.",
          "Read the numbers on both axes. A grid square is not always one unit, and the two axes may be stretched differently. Slope comes from the changes in the coordinates, not from how steep the line looks on the screen.",
        ],
      },
      {
        title: "Put the two facts together",
        paragraphs: [
          "A slope of 2 and an intercept of 5 give $y = 2x + 5$. At $x = 2$ this gives $2(2) + 5 = 9$, matching the second point. Testing a second point catches a rule with the right start but the wrong slope.",
          "Swapping the numbers gives $y = 5x + 2$, which starts at the wrong height. Dropping the 5 gives $y = 2x$, which passes through $(0, 0)$. A number less than 0 in front of $x$ would make $y$ fall as $x$ increases. Each choice makes a different claim you can check.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Slope and intercept determine a line",
        paragraphs: [
          "A line that is not vertical, with slope $m$, crossing the vertical axis at $(0,b)$, has the equation $y=mx+b$. This is called slope-intercept form. A vertical line has an equation $x=c$ and cannot be written in slope-intercept form.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Which rule passes through $(0, 5)$ and $(2, 9)$: $y = 2x + 5$ or $y = 5x + 2$?",
      steps: [
        "At $x = 0$, $y = 5$, so the number added at the end must be 5.",
        "The slope is the change in $y$ over the change in $x$: $\\frac{9 - 5}{2 - 0} = \\frac{4}{2} = 2$.",
        "Choose $y = 2x + 5$. Check: at $x = 2$ it gives $2(2) + 5 = 9$.",
      ],
      answer: "y = 2x + 5",
    },
    pitfalls: [
      "Use rise divided by run: the change in $y$ over the change in $x$, not the other way round.",
      "Check the axis labels before counting grid squares; how steep the line looks on screen does not decide the slope.",
    ],
    parentGuide:
      "Draw two points on paper with labeled axes and ask the learner to describe the starting height and change before writing an equation. Then change only the intercept, and ask which features of the line stay the same. Include falling lines in the discussion as a stretch.",
  },
];
