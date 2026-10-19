import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const patternWords: Lesson["sections"][number] = {
  title: "Patterns, terms and rules",
  paragraphs: [
    "This lesson uses addition, subtraction and multiplication of whole numbers. A number pattern is a list of numbers made by following a rule. Each number in the list is called a term. The pattern begins with a starting number, which is the 1st term.",
    "The rule says how to get each term from the one before it. For the pattern that starts at 3 with the rule “add 4”, the 1st term is 3, the 2nd is 3 + 4 = 7, the 3rd is 7 + 4 = 11, and so on: 3, 7, 11, 15, 19, … The three dots mean the pattern continues by the same rule.",
  ],
};
const variableWords: Lesson["sections"][number] = {
  title: "Variables that depend on each other",
  paragraphs: [
    "This lesson uses multiplication, division and the coordinate grid. A variable is a letter that stands for a quantity that can change, such as t for a number of hours or d for a distance in miles. When one quantity is found from the other, the one you choose or know first is the independent variable, and the one that results is the dependent variable. Distance depends on time, so t is independent and d is dependent.",
    "A table lists matching values: each column pairs a value of the independent variable with the value of the dependent variable that goes with it. A graph shows each pair as a point: move across to the independent value on the horizontal axis, then up to the dependent value on the vertical axis. An equation such as d = 65t states the relationship for every pair at once. The dependent variable stands alone on one side, so the equation reads “d equals 65 times t”.",
  ],
};
const functionWords: Lesson["sections"][number] = {
  title: "Rate of change and initial value",
  paragraphs: [
    "This lesson uses signed numbers, fractions and the coordinate grid. A function is a rule that gives exactly one output y for each input x. The rate of change of a function is how much y changes for each increase of 1 in x. Between two points it is the change in y divided by the change in x: from (2, 5) to (4, 9), the rate is (9 − 5) ÷ (4 − 2) = 2.",
    "The initial value is the output when x = 0, where the graph crosses the vertical axis. A function is linear when its rate of change is the same between every pair of points; then its graph is a straight line and its rule can be written $y = mx + b$, where m is the rate of change and b is the initial value. In y = 2x + 1, the rate of change is 2 and the initial value is 1.",
  ],
};

export const patternFunctionLessons: Lesson[] = [
  {
    id: "rule-pattern-term",
    title: "Extend a pattern from its rule",
    summary:
      "Apply the rule to each term to get the next one; the term asked for is reached after one fewer step than its position.",
    templateIds: ["rule-pattern-term"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Generate the terms of a pattern from its starting number and rule.",
      "Find a later term and check it by counting how many times the rule is applied.",
    ],
    sections: [
      patternWords,
      {
        title: "Count the steps, not the terms",
        paragraphs: [
          "The figure shows the pattern 3, 7, 11, 15, 19, 23. Each arrow applies the rule “add 4” once. Six terms need only five arrows, because the 1st term is the start and needs no step. To reach the 6th term, the rule is applied 6 − 1 = 5 times: 3 + 5 × 4 = 23.",
          "Multiplication rules work the same way. The pattern that starts at 2 with the rule “multiply by 3” is 2, 6, 18, 54, … Its 4th term is reached after 3 steps: 2 × 3 × 3 × 3 = 54. Write the terms in order and count them, so that no step is skipped or added.",
        ],
        illustration: "pattern-rule-steps",
      },
    ],
    workedExample: {
      prompt:
        "A number pattern starts at 5. Its rule is “add 6.” What is the 8th number in the pattern?",
      steps: [
        "The 1st term is the start, 5. Each later term is 6 more than the term before it.",
        "Write the terms: 5, 11, 17, 23, 29, 35, 41, 47. The 8th term is 47.",
        "Check: from the 1st term to the 8th, the rule is applied 8 − 1 = 7 times, and 5 + 7 × 6 = 47.",
      ],
      answer: "47",
    },
    pitfalls: [
      "Do not apply the rule as many times as the term's position: the 8th term needs 7 steps, because the start is already the 1st term.",
      "Do not start counting at the 2nd term. Write the starting number first and number it 1.",
      "For a subtraction rule, each term is smaller than the one before; check that the terms decrease.",
    ],
    parentGuide:
      "Say a start and a rule, such as “start at 4, add 3”, and take turns saying the next term. Then ask for the 10th term and count the steps on fingers before checking by listing.",
  },
  {
    id: "rule-pattern-feature",
    title: "What a pattern rule guarantees",
    summary:
      "A rule can force a feature that it never states, such as every term being odd; the start and the step together decide it.",
    templateIds: ["rule-pattern-feature"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Notice features shared by every term of a pattern, such as being odd, being a multiple of a number, or ending in the same digit.",
      "Explain why the feature continues, using what the rule does to odd and even numbers or to multiples.",
    ],
    sections: [
      patternWords,
      {
        title: "Why every term is odd",
        paragraphs: [
          "An even number can be split into pairs with none left over; an odd number has one left over. Adding an even number adds whole pairs, so it never changes whether a number is odd or even. Adding an odd number adds one extra, so it switches odd to even and even to odd.",
          "The pattern 3, 7, 11, 15, 19, 23 starts at 3, which is odd, and adds 4, which is even. Every step keeps the number odd, so every term is odd, even though the rule “add 4” says nothing about odd numbers. With the rule “add 5”, the terms 3, 8, 13, 18 alternate: odd, even, odd, even.",
        ],
        illustration: "pattern-rule-steps",
      },
      {
        title: "Multiples and last digits",
        paragraphs: [
          "If the start and the step are both multiples of the same number, every term is too. The pattern 6, 15, 24, 33 starts at 6 = 3 × 2 and adds 9 = 3 × 3, so every term is a multiple of 3. The terms are not multiples of 9: the start, 6, is not, and adding 9 keeps the same remainder after dividing by 9.",
          "Adding a multiple of 10 changes only the tens and higher places. The pattern 37, 77, 117, 157 adds 40, so every term ends in 7, the last digit of the start. The step ending in 0 does not make the terms end in 0.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A number pattern starts at 9. Its rule is “add 6.” Is every number in the pattern odd, is every number even, or do the numbers alternate between odd and even?",
      steps: [
        "Write the first terms: 9, 15, 21, 27, 33.",
        "The start, 9, is odd. The step, 6, is even, and adding an even number never changes odd to even.",
        "So every term stays odd, like the start.",
      ],
      answer: "Every number is odd.",
    },
    pitfalls: [
      "Do not judge from the step alone: “add 4” gives odd terms from an odd start and even terms from an even start.",
      "A feature of the step is not a feature of the terms: adding 9 does not make every term a multiple of 9 unless the start is one.",
      "Check a claim against several terms and give a reason that covers every step, not only the terms you wrote.",
    ],
    parentGuide:
      "Pick a start and an even step, list five terms together and ask what they have in common. Then change the start from odd to even, or the step from even to odd, and ask the learner to predict what changes before listing.",
  },
  {
    id: "related-patterns-relationship",
    title: "Relate two patterns",
    summary:
      "Pair the terms of two patterns; when B's step is k times A's step and both start at 0, every B-term is k times its A-term.",
    templateIds: ["related-patterns-relationship"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Form ordered pairs from matching terms of two patterns and plot them on a coordinate grid.",
      "State and explain the relationship between matching terms, such as each B-term being 3 times its A-term.",
    ],
    sections: [
      {
        title: "Matching terms form ordered pairs",
        paragraphs: [
          "This lesson uses multiplication and the first quadrant of the coordinate grid. A number pattern is a list of terms made by a rule. Two patterns are related when their terms are matched in order: the 1st term of A with the 1st term of B, the 2nd with the 2nd, and so on. Each match is written as an ordered pair (A-term, B-term).",
          "Pattern A starts at 0 and adds 2: 0, 2, 4, 6, 8. Pattern B starts at 0 and adds 6: 0, 6, 12, 18, 24. The ordered pairs are (0, 0), (2, 6), (4, 12), (6, 18) and (8, 24). On a grid, (2, 6) means 2 across and 6 up.",
        ],
      },
      {
        title: "Why each B-term is 3 times its A-term",
        paragraphs: [
          "At every step, A grows by 2 and B grows by 6, and 6 = 3 × 2. Both start at 0, so after the same number of steps B has grown 3 times as much as A: after 4 steps, A is 4 × 2 = 8 and B is 4 × 6 = 24 = 3 × 8.",
          "On the graph, each point is 3 times as high as it is far across, so the points lie on one straight line through (0, 0). The table shows the same fact row by row: 6 = 3 × 2, 12 = 3 × 4, 18 = 3 × 6. To find the B-term paired with any A-term, multiply by 3.",
        ],
        illustration: "related-patterns-graph",
      },
    ],
    workedExample: {
      prompt:
        "Pattern A starts at 0 and adds 2 each step. Pattern B starts at 0 and adds 6 each step. Each term of pattern B is how many times the matching term of pattern A?",
      steps: [
        "Pattern A is 0, 2, 4, 6, 8 and pattern B is 0, 6, 12, 18, 24. The pairs are (0, 0), (2, 6), (4, 12), (6, 18) and (8, 24).",
        "B's step is 6 and A's step is 2, and 6 = 3 × 2, so B grows 3 times as fast.",
        "Check two pairs: 12 = 3 × 4 and 24 = 3 × 8. Each B-term is 3 times its A-term.",
      ],
      answer: "3",
    },
    pitfalls: [
      "Compare matching terms, not the steps' difference: 6 − 2 = 4 does not mean each B-term is 4 more than its A-term.",
      "Match terms in order; the 3rd term of A goes with the 3rd term of B.",
      "Plot (A, B) with the A-term across and the B-term up.",
    ],
    parentGuide:
      "Build two towers of blocks side by side, adding 1 block to the first and 3 to the second each turn. After each turn, compare the heights and ask how many times as tall the second tower is.",
  },
  {
    id: "dependent-variable-equation",
    title: "Write the equation from a table and graph",
    summary:
      "Decide which variable depends on the other, then find the fixed multiplier or fixed difference that holds in every row.",
    templateIds: ["dependent-variable-equation"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Identify the independent and dependent variables in a context.",
      "Write an equation such as d = 65t or m = b + 4 that matches every row of a table and every point of a graph.",
    ],
    sections: [
      variableWords,
      {
        title: "Find what is constant",
        paragraphs: [
          "In the figure, a car travels 65, 130, 195 and 260 miles after 1, 2, 3 and 4 hours. Divide each distance by its time: 65 ÷ 1 = 65, 130 ÷ 2 = 65, 195 ÷ 3 = 65, 260 ÷ 4 = 65. The quotient is the same in every row, so the distance is always 65 times the time: d = 65t. The points lie on a straight line through (0, 0), because no time means no distance.",
          "Some relationships add instead of multiply. If Mia is always 4 years older than her brother, then her age m is her brother's age b plus 4 in every row: m = b + 4. Test a rule on every row before choosing it. For the car, d = t + 65 gives 1 + 65 = 66 in the first row, not 65, so it is not the rule.",
        ],
        illustration: "dependent-variable-graph",
      },
    ],
    workedExample: {
      prompt:
        "A car travels at a constant speed. After 1, 2, 3 and 4 hours it has traveled 65, 130, 195 and 260 miles. Which equation gives the distance d, in miles, in terms of the time t, in hours?",
      steps: [
        "The distance depends on the time, so t is the independent variable and d is the dependent variable.",
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
      "Substitute the known value; to find the other variable, undo the multiplication or addition.",
    templateIds: ["dependent-variable-value"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Substitute a value of one variable into an equation such as d = 55t.",
      "Find the dependent or the independent variable and check the result in the equation.",
    ],
    sections: [
      variableWords,
      {
        title: "Substitute, then undo",
        paragraphs: [
          "To use an equation, replace the variable you know with its value. If you know t in d = 55t, multiply: when t = 4, d = 55 × 4 = 220. The equation then gives the dependent value directly.",
          "If you know d instead, the equation becomes a question about t: 330 = 55t asks what number times 55 is 330. Division undoes multiplication, so t = 330 ÷ 55 = 6. For an addition rule such as m = b + 3, subtraction undoes addition: when m = 12, b = 12 − 3 = 9. Check by putting the answer back into the equation: 55 × 6 = 330.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A car travels at a constant speed, so d = 55t for d miles in t hours. How many hours does it take to travel 330 miles?",
      steps: [
        "Distance d depends on time t. Substitute d = 330: 330 = 55t.",
        "Divide both sides by 55: t = 330 ÷ 55 = 6.",
        "Check: 55 × 6 = 330.",
      ],
      answer: "6",
      answerUnit: "hours",
    },
    pitfalls: [
      "Substitute the known value for the right variable: 330 is a distance, so it replaces d, not t.",
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
      "Find each function's rate of change and initial value from its own representation, then compare the numbers, not the pictures.",
    templateIds: ["compare-function-rates"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the rate of change and the initial value of a linear function from a table, a graph, an equation or a description.",
      "Compare two functions given in different representations.",
    ],
    sections: [
      functionWords,
      {
        title: "One question, four representations",
        paragraphs: [
          "From an equation $y = mx + b$, read m and b. From a table, divide the change in y by the change in x between two rows; if x = 0 is not listed, work back from a row: the initial value is y minus x times the rate. From a graph, read the initial value where the line crosses the vertical axis and find the rate from two marked points. From a description, the starting amount is the initial value and the change for each 1 of x is the rate.",
          "In the figure, function A is given by the table x = 0, 3, 6, 9 and y = 1, 7, 13, 19. Its rate is (7 − 1) ÷ (3 − 0) = 2 and its initial value is 1. Function B's line passes through (0, 6) and (4, 8): its initial value is 6 and its rate is (8 − 6) ÷ (4 − 0) = 1/2. A has the greater rate of change, and B has the greater initial value. Line A is steeper, but it starts lower.",
        ],
        illustration: "compare-functions-graph",
      },
      {
        title: "Negative rates",
        paragraphs: [
          "A negative rate of change means y decreases as x increases. Any negative rate is less than any positive rate, even when its line looks steeper: −3 < 1/2. Compare the signed numbers, not the steepness of the lines.",
          "Compare each feature separately. One function can have the greater rate of change while the other has the greater initial value, and a function that starts higher can be overtaken by one that grows faster.",
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
      "When table rows are 2 apart in x, divide the change in y by 2 to get the change for each 1.",
    ],
    parentGuide:
      "Compare two savings plans: one starts with 20 dollars and adds 2 each week, the other starts with 5 and adds 5. Make a short table for each and ask which starts higher, which grows faster, and when the second catches up.",
  },
  {
    id: "linear-function-choice",
    title: "Linear or not linear",
    summary:
      "A function is linear exactly when its rule can be rewritten as $y = mx + b$; then its graph is a straight line.",
    templateIds: ["linear-function-choice"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Recognize linear functions written in forms other than $y = mx + b$, including y = c and y = k(x + h).",
      "Show that a function is not linear by finding unequal changes in y over equal steps in x.",
    ],
    sections: [
      functionWords,
      {
        title: "Equal steps in x, equal changes in y",
        paragraphs: [
          "In the figure, y = 2x + 1 gives 1, 3, 5, 7 at x = 0, 1, 2, 3: each step adds 2, and the points lie on a straight line. The function y = x² gives 0, 1, 4, 9: the changes 1, 3 and 5 grow, and the points bend upward. Its rate of change is not constant, so it is not linear.",
          "To test a rule, find y at x = 1, 2 and 3. Equal changes are necessary for a linear function; then confirm by rewriting the rule. A rule with x squared, x multiplied by itself, or x in a denominator, as in y = 12/x, is not linear.",
        ],
        illustration: "linear-nonlinear-graph",
      },
      {
        title: "Linear rules in disguise",
        paragraphs: [
          "Multiply out parentheses: y = 3(x − 2) is y = 3x − 6. Reorder terms: y = 5 − 2x is y = −2x + 5. Dividing x by a number multiplies it by a fraction: y = x/2 − 4 has rate of change 1/2. All three are linear.",
          "A constant rule such as y = 7 is also linear: it is y = 0x + 7, with rate of change 0, and its graph is a horizontal line. Being linear depends on the rate of change being constant, not on the letter x appearing.",
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
      "Make a table for y = 2x + 1 and for y = x × x together for x = 0 to 4. Compare how much y grows at each step, and plot both on squared paper to see which points line up.",
  },
];

export const patternFunctionMethods: Record<string, ProblemMethod> = {
  "rule-pattern-term": {
    goal: "Find a later term of a number pattern from its start and rule.",
    terms: [
      ["term", "One number in the pattern; the start is the 1st term."],
      ["rule", "How to get each term from the term before it."],
    ],
    method: [
      "Write the start as the 1st term.",
      "Apply the rule to each term to get the next, numbering the terms as you go.",
      "Stop at the term asked for; check that the rule was applied one fewer time than its position.",
    ],
    watch:
      "The 8th term needs 7 steps, because the start is already the 1st term.",
  },
  "rule-pattern-feature": {
    goal: "Find a feature that every term of a rule-generated pattern shares.",
    terms: [
      ["even", "Splits into pairs with none left over."],
      ["odd", "Splits into pairs with one left over."],
    ],
    method: [
      "Write the first five or six terms.",
      "Look for a shared feature: odd or even, a common factor, the same last digit.",
      "Explain why the start and the step guarantee it for every term.",
    ],
    watch:
      "Decide with both the start and the step: adding an even step keeps the start's parity, adding an odd step alternates it.",
  },
  "related-patterns-relationship": {
    goal: "State how the matching terms of two patterns are related.",
    terms: [
      ["matching terms", "Terms in the same position in the two patterns."],
      ["ordered pair", "(A-term, B-term): across A, up B on the grid."],
    ],
    method: [
      "Pair the terms in order and read the pairs in the table.",
      "Compare the steps: B's step divided by A's step.",
      "Check that every B-term is that many times its A-term, then use it.",
    ],
    watch:
      "Compare matching terms by multiplying, not by the difference of the steps.",
  },
  "dependent-variable-equation": {
    goal: "Choose the equation that gives the dependent variable from the independent one.",
    terms: [
      ["independent variable", "The quantity chosen or known first."],
      ["dependent variable", "The quantity that results from it."],
    ],
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
    terms: [["substitute", "Replace a variable with its known value."]],
    method: [
      "Substitute the known value for its variable.",
      "If the unknown is multiplied, divide; if a number is added to it, subtract.",
      "Check the result in the original equation.",
    ],
    watch: "Put the known value in place of the variable it measures.",
  },
  "compare-function-rates": {
    goal: "Compare the rates of change and initial values of two linear functions.",
    terms: [
      ["rate of change", "Change in y divided by change in x."],
      ["initial value", "The value of y when x = 0."],
    ],
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
    terms: [["linear function", "A rule that can be written $y = mx + b$."]],
    method: [
      "Rewrite each rule: multiply out parentheses and reorder terms.",
      "A rule in the form $y = mx + b$, including y = c, is linear.",
      "Confirm a nonlinear rule by finding unequal changes in y at x = 1, 2, 3.",
    ],
    watch: "y = 7 is linear, with rate of change 0.",
  },
};

export const patternFunctionPrinciples: Record<string, string> = {
  "rule-pattern-term":
    "Each term comes from the one before by the rule, so the nth term is reached by applying the rule n − 1 times to the start.",
  "rule-pattern-feature":
    "A feature of the start that the step preserves holds for every term: an even step keeps the start's parity, and a step that is a multiple of k keeps the start's remainder after division by k.",
  "related-patterns-relationship":
    "If two patterns start at 0 and B's step is k times A's step, then after any number of steps each B-term is k times its matching A-term, and the pairs lie on a line through (0, 0).",
  "dependent-variable-equation":
    "An equation states the relationship for every pair: the dependent variable equals the same expression in the independent variable in every row of the table and at every point of the graph.",
  "dependent-variable-value":
    "Substituting a known value turns the equation into a statement about one unknown, which inverse operations solve.",
  "compare-function-rates":
    "A linear function $y = mx + b$ has rate of change m and initial value b in every representation, so two functions are compared by comparing their m values and their b values.",
  "linear-function-choice":
    "A function is linear exactly when its rate of change is constant, that is, when its rule can be written $y = mx + b$.",
};
