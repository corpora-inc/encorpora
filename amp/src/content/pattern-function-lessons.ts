import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const patternWords: Lesson["sections"][number] = {
  title: "Patterns, terms and rules",
  paragraphs: [
    "A number pattern is a list of numbers made by following a rule. A rule tells how to get each number from the one before it. Each number in the list is called a term. The first term is the starting number.",
    "Say a pattern starts at 3 and the rule is “add 4.” The 1st term is 3. The 2nd term is 3 + 4 = 7. The 3rd term is 7 + 4 = 11. So the pattern is 3, 7, 11, 15, 19, … The three dots mean the pattern keeps going by the same rule.",
    "We write 1st, 2nd, 3rd and so on to say where a term is in the list. That place is called its position.",
  ],
};
const variableWords: Lesson["sections"][number] = {
  title: "Variables that depend on each other",
  paragraphs: [
    "This lesson uses multiplication, division and the coordinate grid. A variable is a letter that stands for a quantity that can change, such as $t$ for a number of hours or $d$ for a distance in miles. When one quantity is found from the other, the one you choose or know first is the independent variable, and the one that results is the dependent variable. Distance depends on time, so $t$ is independent and $d$ is dependent.",
    "A table lists matching values: each column pairs a value of the independent variable with the value of the dependent variable that goes with it. A graph shows each pair as a point: move across to the independent value on the horizontal axis, then up to the dependent value on the vertical axis. An equation such as d = 65t states the relationship for every pair at once. The dependent variable stands alone on one side, so the equation reads “$d$ equals 65 times $t$”.",
  ],
};
const functionWords: Lesson["sections"][number] = {
  title: "Rate of change and initial value",
  paragraphs: [
    "This lesson uses signed numbers, fractions and the coordinate grid. A function is a rule that gives exactly one output $y$ for each input $x$. The rate of change of a function is how much $y$ changes for each increase of 1 in $x$. Between two points it is the change in $y$ divided by the change in $x$: from (2, 5) to (4, 9), the rate is (9 − 5) ÷ (4 − 2) = 2.",
    "The initial value is the output when x = 0, where the graph crosses the vertical axis. A function is linear when its rate of change is the same between every pair of points; then its graph is a straight line and its rule can be written $y = mx + b$, where $m$ is the rate of change and $b$ is the initial value. In y = 2x + 1, the rate of change is 2 and the initial value is 1.",
  ],
};

export const patternFunctionLessons: Lesson[] = [
  {
    id: "rule-pattern-term",
    title: "Extend a pattern from its rule",
    summary:
      "A number pattern is a list of numbers made by a rule, like “add 6.” Each number in the list is called a term. Start with the first term. Use the rule once to get each next term. Keep going until you reach the term you need.",
    templateIds: ["rule-pattern-term"],
    includeGeneratedRepresentation: false,
    senses: { term: "term-sequence", rule: "rule" },
    objectives: [
      "Write the terms of a pattern from its starting number and its rule.",
      "Find a later term, and check it by counting how many times the rule was used.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Start with the first number",
        paragraphs: [
          "Say a pattern starts at 5 and the rule is “add 6.” The 5 is already the 1st term. You do not add anything to get it.",
          "Use the rule once to get the 2nd term: 5 + 6 = 11. Use it again to get the 3rd term: 11 + 6 = 17.",
          "So count the steps you need to reach the term you want. Each step is one use of the rule.",
        ],
      },
      patternWords,
      {
        title: "Count the steps, not the terms",
        paragraphs: [
          "Look at the picture: the pattern 3, 7, 11, 15, 19, 23. Each arrow uses the rule “add 4” once.",
          "There are 6 terms but only 5 arrows. The 1st term is the start, so it needs no arrow. To reach the 6th term, use the rule 6 − 1 = 5 times. Five jumps of 4 are 5 × 4 = 20, and 3 + 20 = 23.",
          "Multiplying rules work the same way. A pattern that starts at 2 with the rule “multiply by 3” goes 2, 6, 18, 54, … Its 4th term comes after 3 steps: 2 × 3 × 3 × 3 = 54.",
          "Write the terms in order and number them. Then no step is skipped or added.",
        ],
        illustration: "pattern-rule-steps",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Term position and steps",
        paragraphs: [
          "Each term comes from the one before it by the rule. So the term in position $n$, where $n$ is any counting number, is reached by using the rule $n-1$ times on the start. For an “add $d$” rule, that term is the start $+ (n-1) \\times d$. For a “multiply by $r$” rule, it is the start multiplied by $r$, $n-1$ times.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A number pattern starts at 5. Its rule is “add 6.” What is the 8th number in the pattern?",
      steps: [
        "The 1st term is the start, 5. The rule says each next term is 6 more than the one before it.",
        "Add 6 each time and number the terms: 5, 11, 17, 23, 29, 35, 41, 47. The 8th term is 47.",
        "Check by counting steps. From the 1st term to the 8th, the rule is used 8 − 1 = 7 times. Seven steps of 6 are 7 × 6 = 42, and 5 + 42 = 47.",
      ],
      answer: "47",
    },
    pitfalls: [
      "Do not use the rule as many times as the term's position. The 8th term needs 7 steps, because the start is already the 1st term.",
      "Do not start counting at the 2nd term. Write the starting number first and call it the 1st term.",
      "With a subtracting rule, each term is smaller than the one before. Check that the terms get smaller.",
    ],
    parentGuide:
      "Say a start and a rule, such as “start at 4, add 3.” Take turns saying the next term. Then ask for the 10th term. Count the steps on fingers, then check by listing the terms.",
  },
  {
    id: "rule-pattern-feature",
    title: "What a pattern rule guarantees",
    summary:
      "Some things stay true for every number in a pattern. Each number in a pattern is called a term. If the starting number has a feature and every step keeps it, every term has it too. Start at 3 and add 4: every term is odd.",
    templateIds: ["rule-pattern-feature"],
    includeGeneratedRepresentation: false,
    senses: { term: "term-sequence", rule: "rule", multiple: "multiple" },
    objectives: [
      "Notice features that every term of a pattern shares, such as being odd, being in the times table of a number, or ending in the same digit.",
      "Explain why the feature keeps going, using what the rule does to odd and even numbers or to multiples.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Notice what never changes",
        paragraphs: [
          "An even number can be split into pairs with none left over, like 6. An odd number has one left over, like 7.",
          "Start at 3, which is odd, and add 4 each time: 3, 7, 11, 15. Adding 4 adds two more pairs. The one left over is still there.",
          "So every term stays odd. The starting number and the rule together explain the pattern.",
        ],
      },
      patternWords,
      {
        title: "Why every term is odd",
        paragraphs: [
          "Adding an even number adds whole pairs. So it never changes whether a number is odd or even.",
          "Adding an odd number adds whole pairs and one extra. So it switches odd to even, and even to odd.",
          "Look at the picture: 3, 7, 11, 15, 19, 23. It starts at 3, which is odd, and adds 4, which is even. Every step keeps the number odd, so every term is odd. The rule “add 4” says nothing about odd numbers, but the start and the rule together make it true.",
          "With the rule “add 5,” the terms 3, 8, 13, 18 take turns: odd, even, odd, even.",
        ],
        illustration: "pattern-rule-steps",
      },
      {
        title: "Multiples and last digits",
        paragraphs: [
          "A multiple of 3 is a number in the 3 times table: 3, 6, 9, 12 and so on. If the start and the step are both multiples of the same number, every term is too.",
          "The pattern 6, 15, 24, 33 starts at 6 = 3 × 2 and adds 9 = 3 × 3. So every term is a multiple of 3.",
          "The terms are not multiples of 9. Split 6 into nines: there are none, and 6 is left over. Adding 9 adds one whole nine, so every term has 6 left over. For example, 15 is one 9 and 6 more.",
          "Adding a multiple of 10 changes only the tens and bigger places. The pattern 37, 77, 117, 157 adds 40, so every term ends in 7, the last digit of the start. The step ends in 0, but that does not make the terms end in 0.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Properties of repeated steps",
        paragraphs: [
          "A feature holds for every term of a pattern when two things are true. It is true for the starting number. And using the rule once always keeps it. For example, adding an even number keeps a whole number odd if it was odd, and even if it was even.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A number pattern starts at 9. Its rule is “add 6.” Is every number in the pattern odd, is every number even, or do the numbers alternate between odd and even?",
      steps: [
        "Write the first few terms by adding 6: 9, 15, 21, 27, 33.",
        "The start, 9, is odd. The step, 6, is even. Adding an even number adds whole pairs, so it never changes odd to even.",
        "So every term stays odd, like the start.",
      ],
      answer: "Every number is odd.",
    },
    pitfalls: [
      "Do not judge from the step alone. “Add 4” gives odd terms from an odd start and even terms from an even start.",
      "A feature of the step is not always a feature of the terms. Adding 9 does not make every term a multiple of 9 unless the start is one.",
      "Check a claim on several terms. Then give a reason that works for every step, not only the terms you wrote.",
    ],
    parentGuide:
      "Pick a start and an even step, and list five terms together. Ask what they have in common. Then change the start from odd to even, or the step from even to odd. Ask the learner to predict what changes before listing.",
  },
  {
    id: "related-patterns-relationship",
    title: "Relate two patterns",
    summary:
      "Two number patterns can be compared term by term. A term is one number in a pattern. Pair the 1st terms, then the 2nd terms, and so on. Then see how each pair is related, such as the second number being 3 times the first.",
    templateIds: ["related-patterns-relationship"],
    includeGeneratedRepresentation: false,
    senses: { term: "term-sequence", rule: "rule" },
    objectives: [
      "Pair matching terms of two patterns as ordered pairs, and plot them on a coordinate grid.",
      "State and explain how matching terms are related, such as each B-term being 3 times its A-term.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Match the same positions",
        paragraphs: [
          "Pattern A starts at 0 and adds 2: 0, 2, 4, 6, 8. Pattern B starts at 0 and adds 6: 0, 6, 12, 18, 24.",
          "Match the terms in the same place: 2 with 6, 4 with 12, 6 with 18. Each B-term is 3 times its A-term.",
          "Here is why. At every step, B grows by 6 and A grows by 2, and 6 is 3 times 2.",
        ],
      },
      {
        title: "Matching terms form ordered pairs",
        paragraphs: [
          "A number pattern is a list of numbers made by a rule, and each number is a term. Matching terms are in the same position, or place, in the two lists: 1st with 1st, 2nd with 2nd, and so on.",
          "An ordered pair is two numbers written inside ( ), in a set order. Here the order is (A-term, B-term). The pairs are (0, 0), (2, 6), (4, 12), (6, 18) and (8, 24).",
          "A coordinate grid is a grid of lines with numbers along the bottom and up the left. The point (2, 6) means go 2 across, then 6 up.",
        ],
      },
      {
        title: "Why each B-term is 3 times its A-term",
        paragraphs: [
          "At every step, A grows by 2 and B grows by 6, and 6 = 3 × 2. Both start at 0. So after the same number of steps, B has grown 3 times as much as A.",
          "After 4 steps, A is 4 × 2 = 8 and B is 4 × 6 = 24. And 24 = 3 × 8.",
          "Look at the graph. Each point is 3 times as high as it is far across. So the points lie on one straight line through (0, 0).",
          "The table shows the same fact pair by pair: 6 = 3 × 2, 12 = 3 × 4, 18 = 3 × 6. To find the B-term that goes with any A-term, multiply by 3.",
        ],
        illustration: "related-patterns-graph",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Paired terms",
        paragraphs: [
          "Two patterns start at 0. One adds $a$ each step, and the other adds $b$. After the same number of steps, $s$, their terms are $s \\times a$ and $s \\times b$. If $b = k \\times a$, the second term is always $k$ times the first.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Pattern A starts at 0 and adds 2 each step. Pattern B starts at 0 and adds 6 each step. Each term of pattern B is how many times the matching term of pattern A?",
      steps: [
        "List both patterns: A is 0, 2, 4, 6, 8 and B is 0, 6, 12, 18, 24. Pair the terms in order: (0, 0), (2, 6), (4, 12), (6, 18) and (8, 24).",
        "Compare the steps. B adds 6 and A adds 2, and 6 = 3 × 2. So B grows 3 times as fast.",
        "Check two pairs: 12 = 3 × 4 and 24 = 3 × 8. So each B-term is 3 times its A-term.",
      ],
      answer: "3",
    },
    pitfalls: [
      "Compare matching terms by multiplying. The steps differ by 6 − 2 = 4, but each B-term is not 4 more than its A-term.",
      "Match terms in order. The 3rd term of A goes with the 3rd term of B.",
      "Plot each pair with the A-term across and the B-term up.",
    ],
    parentGuide:
      "Build two towers of blocks next to each other. Each turn, add 1 block to the first tower and 3 to the second. After each turn, ask how many times as tall the second tower is.",
  },
  {
    id: "dependent-variable-equation",
    title: "Write the equation from a table and graph",
    summary:
      "Use the steady change and any starting amount to write a rule from a table.",
    templateIds: ["dependent-variable-equation"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Identify the independent and dependent variables in a context.",
      "Write an equation such as d = 65t or m = b + 4 that matches every row of a table and every point of a graph.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find what stays the same",
        paragraphs: [
          "A table may show how the cost of notebooks changes with the number bought. Each new notebook may add the same cost. Look for that steady change, then see whether there was already a starting amount before any notebooks were bought.",
        ],
      },
      variableWords,
      {
        title: "Find what is constant",
        paragraphs: [
          "In the figure, a car travels 65, 130, 195 and 260 miles after 1, 2, 3 and 4 hours. Divide each distance by its time: 65 ÷ 1 = 65, 130 ÷ 2 = 65, 195 ÷ 3 = 65, 260 ÷ 4 = 65. The quotient is the same in every row, so the distance is always 65 times the time: d = 65t. The points lie on a straight line through (0, 0), because no time means no distance.",
          "Some relationships add instead of multiply. If Mia is always 4 years older than her brother, then her age $m$ is her brother's age $b$ plus 4 in every row: m = b + 4. Test a rule on every row before choosing it. For the car, d = t + 65 gives 1 + 65 = 66 in the first row, not 65, so it is not the rule.",
        ],
        illustration: "dependent-variable-graph",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A rule between quantities",
        paragraphs: [
          "An equation for two quantities names how one depends on the other. In a proportional relationship, output divided by nonzero input is constant and the rule has form $y=kx$. A fixed added amount instead gives a rule of form $y=kx+b$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A car travels at a constant speed. After 1, 2, 3 and 4 hours it has traveled 65, 130, 195 and 260 miles. Which equation gives the distance $d$, in miles, in terms of the time $t$, in hours?",
      steps: [
        "The distance depends on the time, so $t$ is the independent variable and $d$ is the dependent variable.",
        "Divide each distance by its time: 65 ÷ 1 = 65, 130 ÷ 2 = 65, 195 ÷ 3 = 65 and 260 ÷ 4 = 65.",
        "The distance is always 65 times the time, so d = 65t.",
      ],
      answer: "d = 65t",
    },
    pitfalls: [
      "Put the dependent variable alone on one side: t = 65d says the time is 65 times the distance.",
      "Check every row, not one: a rule that adds can match one row of a multiplying table by chance.",
      "When the table skips values, divide each output by its own input; the change from one row to the next is not the amount for each 1.",
    ],
    parentGuide:
      "Use a real price, such as 3 dollars per notebook. Make a table for 1 to 5 notebooks together, then ask which quantity depends on which and write the equation in words before using letters.",
  },
  {
    id: "dependent-variable-value",
    title: "Use an equation between two variables",
    summary:
      "Substitute a known value into the rule, or undo the rule to find a missing value.",
    templateIds: ["dependent-variable-value"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Substitute a value of one variable into an equation such as d = 55t.",
      "Find the dependent or the independent variable and check the result in the equation.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Follow the rule or work backward",
        paragraphs: [
          "A rule takes an input, changes it, and gives an output. If you know the input, follow its steps. If you know the output, undo the steps in reverse order to recover the input.",
        ],
      },
      variableWords,
      {
        title: "Substitute, then undo",
        paragraphs: [
          "To use an equation, replace the variable you know with its value. If you know $t$ in d = 55t, multiply: when t = 4, d = 55 × 4 = 220. The equation then gives the dependent value directly.",
          "If you know $d$ instead, the equation becomes a question about $t$: 330 = 55t asks what number times 55 is 330. Division undoes multiplication, so t = 330 ÷ 55 = 6. For an addition rule such as m = b + 3, subtraction undoes addition: when m = 12, b = 12 − 3 = 9. Check by putting the answer back into the equation: 55 × 6 = 330.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Use or undo a rule",
        paragraphs: [
          "An equation remains true when its input and matching output are substituted together. For $y=kx+b$ with nonzero $k$, a known input gives $y$ by multiplication and addition; a known output gives $x=(y-b)/k$ by undoing those operations.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A car travels at a constant speed, so d = 55t for $d$ miles in $t$ hours. How many hours does it take to travel 330 miles?",
      steps: [
        "Distance $d$ depends on time $t$. Substitute d = 330: 330 = 55t.",
        "Divide both sides by 55: t = 330 ÷ 55 = 6.",
        "Check: 55 × 6 = 330.",
      ],
      answer: "6",
      answerUnit: "hours",
    },
    pitfalls: [
      "Substitute the known value for the right variable: 330 is a distance, so it replaces $d$, not $t$.",
      "Do not multiply when the unknown is already multiplied: 55 × 330 answers a different question.",
      "Check the answer in the original equation before writing the unit.",
    ],
    parentGuide:
      "Write a rule from daily life, such as cost = 4 × number of muffins. Ask for the cost of 6 muffins, then for how many muffins cost 32, and talk about why the second question uses division.",
  },
  {
    id: "compare-function-rates",
    title: "Compare two functions",
    summary:
      "Read each function's change per input step before comparing them.",
    templateIds: ["compare-function-rates"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the rate of change and the initial value of a linear function from a table, a graph, an equation or a description.",
      "Compare two functions given in different representations.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare the same kind of change",
        paragraphs: [
          "A table, a graph, and an equation can each show how an output changes when its input grows. Find the change for one input step in each. Then compare those rates using the same units.",
        ],
      },
      functionWords,
      {
        title: "One question, four representations",
        paragraphs: [
          "From an equation $y = mx + b$, read $m$ and $b$. From a table, divide the change in $y$ by the change in $x$ between two rows; if x = 0 is not listed, work back from a row: the initial value is $y$ minus $x$ times the rate. From a graph, read the initial value where the line crosses the vertical axis and find the rate from two marked points. From a description, the starting amount is the initial value and the change for each 1 of $x$ is the rate.",
          "In the figure, function A is given by the table x = 0, 3, 6, 9 and y = 1, 7, 13, 19. Its rate is (7 − 1) ÷ (3 − 0) = 2 and its initial value is 1. Function B's line passes through (0, 6) and (4, 8): its initial value is 6 and its rate is (8 − 6) ÷ (4 − 0) = 1/2. A has the greater rate of change, and B has the greater initial value. Line A is steeper, but it starts lower.",
        ],
        illustration: "compare-functions-graph",
      },
      {
        title: "Negative rates",
        paragraphs: [
          "A negative rate of change means $y$ decreases as $x$ increases. Any negative rate is less than any positive rate, even when its line looks steeper: −3 < 1/2. Compare the signed numbers, not the steepness of the lines.",
          "Compare each feature separately. One function can have the greater rate of change while the other has the greater initial value, and a function that starts higher can be overtaken by one that grows faster.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Compare like features",
        paragraphs: [
          "For a linear function $y=mx+b$, the rate of change $m$ is the change in output divided by a nonzero change in input, and $b$ is the output when input is zero. A table, graph, or equation can show the same two features; compare their numbers in matching units.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Function A is given by the table x = 0, 3, 6, 9 and y = 1, 7, 13, 19. Function B's graph is a straight line through (0, 6) and (4, 8). Compare their rates of change and initial values.",
      steps: [
        "Function A: its rate of change is (7 − 1) ÷ (3 − 0) = 2, and at x = 0, y = 1, so its initial value is 1.",
        "Function B: its line crosses the vertical axis at (0, 6), so its initial value is 6; its rate of change is (8 − 6) ÷ (4 − 0) = 1/2.",
        "Compare: 2 > 1/2 and 1 < 6.",
      ],
      answer:
        "Function A has the greater rate of change; function B has the greater initial value.",
    },
    pitfalls: [
      "Compare signed values: a rate of −4 is less than a rate of 1.",
      "Do not read the initial value from the first row of a table unless that row has x = 0.",
      "When table rows are 2 apart in $x$, divide the change in $y$ by 2 to get the change for each 1.",
    ],
    parentGuide:
      "Compare two savings plans: one starts with 20 dollars and adds 2 each week, the other starts with 5 and adds 5. Make a short table for each and ask which starts higher, which grows faster, and when the second catches up.",
  },
  {
    id: "linear-function-choice",
    title: "Linear or not linear",
    summary:
      "A function gives one output for each input. It is linear when each equal step in input changes the output by the same amount; its graph is a line.",
    templateIds: ["linear-function-choice"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Recognize linear functions written in forms other than $y = mx + b$, including y = c and y = k(x + h).",
      "Show that a function is not linear by finding unequal changes in $y$ over equal steps in $x$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Look for a steady climb",
        paragraphs: [
          "A function gives one output for each allowed input. If every extra unit of input changes its output by the same amount, its graph is a straight line: a linear function. In a rule such as $y=3x+1$, $x$ is the input and $y$ is the output.",
        ],
      },
      functionWords,
      {
        title: "Equal input steps, equal output changes",
        paragraphs: [
          "In the figure, y = 2x + 1 gives 1, 3, 5, 7 at x = 0, 1, 2, 3: each step adds 2, and the points lie on a straight line. The function y = x² gives 0, 1, 4, 9: the changes 1, 3 and 5 grow, and the points bend upward. Its rate of change is not constant, so it is not linear.",
          "To test a rule, find $y$ at x = 1, 2 and 3. Equal changes are necessary for a linear function; then confirm by rewriting the rule. A rule with $x$ squared, $x$ multiplied by itself, or $x$ in a denominator, as in y = 12/x, is not linear.",
        ],
        illustration: "linear-nonlinear-graph",
      },
      {
        title: "Linear rules in disguise",
        paragraphs: [
          "Multiply out parentheses: y = 3(x − 2) is y = 3x − 6. Reorder terms: y = 5 − 2x is y = −2x + 5. Dividing $x$ by a number multiplies it by a fraction: y = x/2 − 4 has rate of change 1/2. All three are linear.",
          "A constant rule such as y = 7 is also linear: it is y = 0x + 7, with rate of change 0, and its graph is a horizontal line. Being linear depends on the rate of change being constant, not on the letter $x$ appearing.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "What makes a function linear",
        paragraphs: [
          "A function with numerical input $x$ and output $y$ is linear when one fixed rate $m$ and one fixed starting value $b$ give $y=mx+b$ throughout its domain. Equal nonzero input changes then produce equal output changes; its graph lies on a straight line.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Which of these equations defines a function that is not linear: y = 3(x − 2), y = 7, y = x² + 1 or y = x/2 − 4?",
      steps: [
        "y = 3(x − 2) is y = 3x − 6; y = 7 is y = 0x + 7; y = x/2 − 4 has rate of change 1/2. These three are linear.",
        "y = x² + 1 gives 2, 5, 10 at x = 1, 2, 3. The changes 3 and 5 are not equal, so its rate of change is not constant.",
      ],
      answer: "y = x² + 1",
    },
    pitfalls: [
      "y = 7 is linear: a rate of change of 0 is still constant.",
      "Multiply out before judging: y = 4(x + 1) is linear even though it does not look like $y = mx + b$.",
      "A function that always increases is not necessarily linear; check that the increases are equal.",
    ],
    parentGuide:
      "Make a table for y = 2x + 1 and for y = x × x together for x = 0 to 4. Compare how much $y$ grows at each step, and plot both on squared paper to see which points line up.",
  },
];

export const patternFunctionMethods: Record<string, ProblemMethod> = {
  "rule-pattern-term": {
    goal: "Find a later term of a number pattern from its starting number and its rule.",
    intuition:
      "A number pattern is a list of numbers made by following a rule. The rule, like “add 6,” tells how to get each number from the one before. Each number in the list is called a term. The starting number is the 1st term. A term's position is its place in the list: 1st, 2nd, 3rd and so on.",
    terms: ["term-sequence", "rule"],
    senses: { term: "term-sequence", rule: "rule" },
    method: [
      "Write the starting number as the 1st term.",
      "Use the rule on each term to get the next one. Number the terms as you go.",
      "Stop at the term asked for. Check: the rule was used one time fewer than the term's position.",
    ],
    watch:
      "The 8th term needs 7 steps, because the start is already the 1st term.",
  },
  "rule-pattern-feature": {
    goal: "Find a feature that every term of a pattern made by a rule shares.",
    intuition:
      "A number pattern is a list of numbers made by a rule, like “add 4.” Each number in it is called a term. The amount added each time is called the step. An even number can be split into pairs with none left over. An odd number has one left over. A multiple of 3 is a number in the 3 times table. The last digit is the ones digit, like the 7 in 37.",
    terms: ["even-number", "odd-number"],
    senses: { term: "term-sequence", rule: "rule", multiple: "multiple" },
    method: [
      "Write the first five or six terms.",
      "Look for something they all share: all odd or all even, all multiples of one number, or the same last digit.",
      "Explain why the start and the step make it true for every term.",
    ],
    watch:
      "Use both the start and the step. An even step keeps odd terms odd and even terms even. An odd step makes them take turns.",
  },
  "related-patterns-relationship": {
    goal: "State how the matching terms of two number patterns are related.",
    intuition:
      "A number pattern is a list of numbers made by a rule. Each number is called a term, and the amount added each time is the step. Matching terms are in the same place in both lists: 1st with 1st, 2nd with 2nd. An ordered pair writes them together in a set order, like (2, 6): the A-term first, then the B-term. On a coordinate grid, (2, 6) is the point 2 across and 6 up.",
    terms: [
      "corresponding-terms",
      [
        "ordered-pair",
        "Here the first number is the term of pattern A and the second the term of pattern B.",
      ],
    ],
    senses: { term: "term-sequence", rule: "rule" },
    method: [
      "Pair the terms in order and read the pairs in the table.",
      "Compare the steps: divide B's step by A's step.",
      "Check that every B-term is that many times its A-term. Then use it.",
    ],
    watch:
      "Compare matching terms by multiplying, not by subtracting the steps.",
  },
  "dependent-variable-equation": {
    goal: "Choose the equation that gives the dependent variable from the independent one.",
    terms: ["independent-variable", "dependent-variable"],
    method: [
      "Name the dependent variable: it stands alone in the equation.",
      "In each row, divide the dependent value by the independent value, or subtract.",
      "Use the quotient or difference that is the same in every row.",
    ],
    watch:
      "Test every row; divide each output by its own input, not by the step between rows.",
  },
  "dependent-variable-value": {
    goal: "Use an equation between two variables to find one from the other.",
    terms: ["substitute"],
    method: [
      "Substitute the known value for its variable.",
      "If the unknown is multiplied, divide; if a number is added to it, subtract.",
      "Check the result in the original equation.",
    ],
    watch: "Put the known value in place of the variable it measures.",
  },
  "compare-function-rates": {
    goal: "Compare the rates of change and initial values of two linear functions.",
    terms: ["rate-of-change", "initial-value"],
    method: [
      "For each function, find the rate of change from its own representation.",
      "Find each initial value, working back to x = 0 if needed.",
      "Compare the two rates, then the two initial values, as signed numbers.",
    ],
    watch:
      "A negative rate is less than any positive rate, however steep its line.",
  },
  "linear-function-choice": {
    goal: "Decide which rules define linear functions.",
    terms: ["linear-function"],
    method: [
      "Rewrite each rule: multiply out parentheses and reorder terms.",
      "A rule in the form $y = mx + b$, including y = c, is linear.",
      "Confirm a nonlinear rule by finding unequal changes in $y$ at x = 1, 2, 3.",
    ],
    watch: "y = 7 is linear, with rate of change 0.",
  },
};

export const patternFunctionPrinciples: Record<string, string> = {
  "rule-pattern-term":
    "Each term comes from the one before it by the rule. So the 8th term is reached by using the rule 8 − 1 = 7 times on the start. In general, the term in position $n$ needs the rule $n-1$ times.",
  "rule-pattern-feature":
    "If the start has a feature and each step keeps it, every term has it. Adding an even step keeps a number odd or even, as the start was. Adding a step that is a multiple of $k$ keeps the same amount left over when you divide by $k$.",
  "related-patterns-relationship":
    "If A adds 2 and B adds 6, both starting at 0, each B-term is 3 times its A-term. In general, if two patterns start at 0 and B's step is $k$ times A's step, each B-term is $k$ times its matching A-term. The pairs lie on a straight line through (0, 0).",
  "dependent-variable-equation":
    "An equation states the relationship for every pair: the dependent variable equals the same expression in the independent variable in every row of the table and at every point of the graph.",
  "dependent-variable-value":
    "Substituting a known value turns the equation into a statement about one unknown, which inverse operations solve.",
  "compare-function-rates":
    "A linear function $y = mx + b$ has rate of change $m$ and initial value $b$ in every representation, so two functions are compared by comparing their $m$ values and their $b$ values.",
  "linear-function-choice":
    "A function is linear exactly when its rate of change is constant, that is, when its rule can be written $y = mx + b$.",
};
