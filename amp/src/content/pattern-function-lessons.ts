import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const patternWords: Lesson["sections"][number] = {
  title: "Patterns, terms and rules",
  paragraphs: [
    "This lesson uses addition, subtraction and multiplication of whole numbers. A number pattern is a list of numbers made by following a rule. Each number in the list is called a term. The pattern begins with a starting number, which is the 1st term.",
    "The rule says how to get each term from the one before it. For the pattern that starts at 3 with the rule “add 4”, the 1st term is 3, the 2nd is 3 + 4 = 7, the 3rd is 7 + 4 = 11, and so on: 3, 7, 11, 15, 19, … The three dots mean the pattern continues by the same rule.",
  ],
};
/** Glossary readings for the grade 6 and 8 function lessons and methods. */
const functionSenses = {
  side: "side-of-equation",
  sides: "side-of-equation",
  term: "term-expression",
  terms: "term-expression",
  rule: "rule",
  rules: "rule",
  "more than": "more-than",
  squares: "square-shape",
  squared: "square-number",
  unit: "unit",
  units: "unit",
} as const;
const functionNoLink = [
  "whole",
  "part",
  "parts",
  "change",
  "changes",
  "opposite",
  "leaves",
  "mean",
  "means",
];

const variableWords: Lesson["sections"][number] = {
  title: "Variables that depend on each other",
  paragraphs: [
    "This lesson uses multiplication, division and the coordinate grid, a grid of squares with numbered lines across and up. A variable is a letter that stands for an amount that can change, such as $t$ for a number of hours or $d$ for a distance in miles.",
    "Often one amount depends on the other. The amount that is chosen or changed freely, like hours spent driving, is called the independent variable. The amount that results, like the distance driven, is called the dependent variable, because it depends on the first. So $t$ is independent and $d$ is dependent, even when you happen to know the distance first.",
    "A table lists matching values, one pair of them in each row (or column) of the table: a value of the independent variable and the dependent value that goes with it. A graph shows each pair as a point: go across to the independent value, then up to the dependent value.",
    "An equation such as $d = 65t$ states the relationship for every pair at once. Here $65t$ means 65 times $t$. The dependent variable stands alone on one side, so the equation reads “$d$ equals 65 times $t$”.",
  ],
};
const functionWords: Lesson["sections"][number] = {
  title: "Rate of change and initial value",
  paragraphs: [
    "This lesson uses positive and negative numbers, fractions and the coordinate grid. A point $(2, 5)$ means 2 across and 5 up. A function is a rule that gives exactly one output $y$ for each input $x$.",
    "The rate of change of a function is how much $y$ changes each time $x$ goes up by 1. Between two points, it is the change in $y$ divided by the change in $x$. From $(2, 5)$ to $(4, 9)$, $y$ goes up 4 while $x$ goes up 2. So the rate is $(9 − 5) ÷ (4 − 2) = 2$.",
    "The initial value is the output when $x = 0$. On a graph, it is where the line crosses the up-and-down axis. It is the starting amount.",
    "A function is called linear when its rate of change is the same between every pair of points. Then its graph is a straight line. Its rule can be written $y = mx + b$, where $mx$ means $m$ times $x$. Here $m$ is the rate of change and $b$ is the initial value. In $y = 2x + 1$, the rate of change is 2 and the initial value is 1.",
  ],
};

export const patternFunctionLessons: Lesson[] = [
  {
    id: "rule-pattern-term",
    title: "Extend a pattern from its rule",
    summary:
      "Start with the first term, then use the rule once for each move to the next term.",
    templateIds: ["rule-pattern-term"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Generate the terms of a pattern from its starting number and rule.",
      "Find a later term and check it by counting how many times the rule is applied.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Start with the first number",
        paragraphs: [
          "If a pattern starts at five and says add six, five is already the first term. One use of the rule gives the second term, and another gives the third. Count the steps needed to reach the requested position.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Term position and steps",
        paragraphs: [
          "For a starting term $a_1$ and a rule $f$ that gives each next term, $a_{n+1}=f(a_n)$ for positive whole $n$. Reaching term $n$ applies the rule exactly $n-1$ times. For an add-$d$ rule, $a_n=a_1+(n-1)d$; for a multiply-by-$r$ rule, $a_n=a_1r^{n-1}$.",
        ],
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
    summary: "Look for a feature the starting number has and every step keeps.",
    templateIds: ["rule-pattern-feature"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Notice features shared by every term of a pattern, such as being odd, being a multiple of a number, or ending in the same digit.",
      "Explain why the feature continues, using what the rule does to odd and even numbers or to multiples.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Notice what never changes",
        paragraphs: [
          "A pattern that starts at an odd number and adds four keeps making odd numbers. Each step adds two more pairs and leaves one unpaired. The starting number and the rule together explain the pattern.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Properties of repeated steps",
        paragraphs: [
          "A feature holds for every term of a pattern when it is true at the start and one application of the rule preserves it. For example, adding an even number preserves whether a whole number is odd or even.",
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
      "Pair terms in the same positions to compare how two patterns grow.",
    templateIds: ["related-patterns-relationship"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Form ordered pairs from matching terms of two patterns and plot them on a coordinate grid.",
      "State and explain the relationship between matching terms, such as each B-term being 3 times its A-term.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Match the same positions",
        paragraphs: [
          "One pattern starts at zero and adds two; another starts at zero and adds six. At each matching position, the second has grown three times as much. Pair the first terms, the second terms, and so on to see the relationship.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Paired terms",
        paragraphs: [
          "If two patterns both start at zero and their constant steps are $a$ and $b$, their terms at the same positive position are $(n-1)a$ and $(n-1)b$. When $b=ka$, the second term is $k$ times the first at every position.",
        ],
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
      "Two amounts can be linked, like the miles a car drives and the hours it drives. A variable is a letter, such as $d$ or $t$, that stands for one of those amounts. A table lists matching pairs. To write the equation, look for what stays the same in every row. Maybe one amount is always 65 times the other, or always 4 more.",
    templateIds: ["dependent-variable-equation"],
    includeGeneratedRepresentation: false,
    senses: functionSenses,
    noLink: functionNoLink,
    objectives: [
      "Tell which amount depends on the other in a real situation.",
      "Write an equation such as $d = 65t$ or $m = b + 4$ that fits every row of a table and every point of a graph.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find what stays the same",
        paragraphs: [
          "Say each notebook costs the same amount. Then the total cost changes by that same amount for each notebook you add. A table of notebooks and costs shows that steady change. Look for it first. Then check whether there was a starting amount before any notebooks were bought.",
        ],
      },
      variableWords,
      {
        title: "Find what is constant",
        paragraphs: [
          "In the figure, a car travels 65, 130, 195 and 260 miles after 1, 2, 3 and 4 hours. Divide each distance by its time: $65 ÷ 1 = 65$, $130 ÷ 2 = 65$, $195 ÷ 3 = 65$ and $260 ÷ 4 = 65$. The answer is the same in every row. So the distance is always 65 times the time: $d = 65t$.",
          "The points lie on a straight line through $(0, 0)$, because no time means no distance.",
          "Some links add instead of multiply. Say Mia is always 4 years older than her brother. Then her age $m$ is her brother's age $b$ plus 4 in every row: $m = b + 4$.",
          "Test a rule on every row before choosing it. For the car, $d = t + 65$ gives $1 + 65 = 66$ in the first row, not 65. So it is not the rule.",
        ],
        illustration: "dependent-variable-graph",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A rule between quantities",
        paragraphs: [
          "An equation for two amounts says how one depends on the other. When the output divided by the input (an input that is not 0) is always the same number $k$, the amounts are called proportional, and the rule is $y = kx$. If a fixed amount $b$ is also added, the rule is $y = kx + b$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A car travels at a constant speed. After 1, 2, 3 and 4 hours it has traveled 65, 130, 195 and 260 miles. Which equation gives the distance $d$, in miles, in terms of the time $t$, in hours?",
      steps: [
        "The distance depends on the time, so $t$ is the independent variable and $d$ is the dependent variable. That means $d$ stands alone on one side.",
        "Look for what stays the same: divide each distance by its time. $65 ÷ 1 = 65$, $130 ÷ 2 = 65$, $195 ÷ 3 = 65$ and $260 ÷ 4 = 65$.",
        "Every row gives 65, so the distance is always 65 times the time: $d = 65t$.",
      ],
      answer: "d = 65t",
    },
    pitfalls: [
      "Put the dependent variable alone on one side. $t = 65d$ would say the time is 65 times the distance.",
      "Check every row, not just one. A rule that adds can match one row of a multiplying table by chance.",
      "When the table skips values, compare each output with its own input, not with the row before. The change from one row to the next is not always the amount for each 1.",
    ],
    parentGuide:
      "Use a real price, such as 3 dollars per notebook. Make a table for 1 to 5 notebooks together. Then ask which amount depends on which, and say the equation in words before using letters.",
  },
  {
    id: "dependent-variable-value",
    title: "Use an equation between two variables",
    summary:
      "An equation like $d = 55t$ links two amounts: here distance $d$ is 55 times the time $t$. If you know $t$, put its number in and multiply. If you know $d$, work backward: undo the multiplying by dividing. Either way, check your answer by putting it back into the equation.",
    templateIds: ["dependent-variable-value"],
    includeGeneratedRepresentation: false,
    senses: functionSenses,
    noLink: functionNoLink,
    objectives: [
      "Put a known number in for one letter in an equation such as $d = 55t$.",
      "Find either missing amount, and check it in the equation.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Follow the rule or work backward",
        paragraphs: [
          "A rule takes an input, does something to it, and gives an output. If you know the input, follow the steps. If you know the output, undo the steps in reverse order to get back to the input.",
        ],
      },
      variableWords,
      {
        title: "Substitute, then undo",
        paragraphs: [
          "To substitute means to replace a letter with its number. If you know $t$ in $d = 55t$, multiply. When $t = 4$, $d = 55 × 4 = 220$. The equation gives the dependent value directly.",
          "If you know $d$ instead, the equation becomes a question about $t$. $330 = 55t$ asks: what number times 55 is 330? Division undoes multiplication, so $t = 330 ÷ 55 = 6$. Check by putting the answer back in: $55 × 6 = 330$.",
          "For an adding rule such as $m = b + 3$, subtraction undoes addition. When $m = 12$, $b = 12 − 3 = 9$.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Use or undo a rule",
        paragraphs: [
          "An equation stays true when an input and its matching output are put in together. For $y = kx + b$ with $k$ not 0, a known input gives $y$ by multiplying and adding. A known output gives $x = (y − b) ÷ k$, by undoing those steps in reverse order.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A car travels at a constant speed, so d = 55t for $d$ miles in $t$ hours. How many hours does it take to travel 330 miles?",
      steps: [
        "330 miles is a distance, so it replaces $d$, the letter for distance: $330 = 55t$.",
        "$t$ is multiplied by 55, so undo that by dividing both sides by 55: $t = 330 ÷ 55 = 6$.",
        "Check by putting 6 back in: $55 × 6 = 330$. It matches.",
      ],
      answer: "6",
      answerUnit: "hours",
    },
    pitfalls: [
      "Put the known number in for the right letter. 330 is a distance, so it replaces $d$, not $t$.",
      "Do not multiply when the unknown is already multiplied. $55 × 330$ answers a different question.",
      "Check the answer in the original equation before writing the unit.",
    ],
    parentGuide:
      "Write a rule from daily life, such as cost equals 4 times the number of muffins. Ask for the cost of 6 muffins, then for how many muffins cost 32. Talk about why the second question uses division.",
  },
  {
    id: "compare-function-rates",
    title: "Compare two functions",
    summary:
      "A function is a rule that turns each input (the number you put in) into one output (the number you get back). We compare functions whose output changes by the same amount for every step of 1 in the input. That change is the rate of change. The output when the input is 0, the starting amount, is the initial value. Find these two numbers for each function, whether it is shown as a table, a graph, an equation or in words.",
    templateIds: ["compare-function-rates"],
    includeGeneratedRepresentation: false,
    senses: functionSenses,
    noLink: functionNoLink,
    objectives: [
      "Find the rate of change and the initial value of a linear function from a table, a graph, an equation or a description.",
      "Compare two functions shown in different ways.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare the same kind of change",
        paragraphs: [
          "A table, a graph and an equation can each show how an output changes as its input grows. In each one, find the change for one step of 1 in the input. Then compare those numbers, in the same units.",
        ],
      },
      functionWords,
      {
        title: "One question, four representations",
        paragraphs: [
          "From an equation $y = mx + b$, read $m$ and $b$ directly.",
          "From a table of a linear function, divide the change in $y$ by the change in $x$ between two rows. If $x = 0$ is not listed, work back from a row: the initial value is $y$ minus $x$ times the rate.",
          "From a graph, the initial value is where the line crosses the up-and-down axis. Find the rate from two marked points.",
          "From a description, the starting amount is the initial value. The change for each 1 of $x$ is the rate.",
          "In the figure, function A is the table $x = 0, 3, 6, 9$ and $y = 1, 7, 13, 19$. Its rate is $(7 − 1) ÷ (3 − 0) = 2$, and its initial value is 1. Function B's line passes through $(0, 6)$ and $(4, 8)$. Its initial value is 6, and its rate is $(8 − 6) ÷ (4 − 0) = \\tfrac{1}{2}$.",
          "So A has the greater rate of change, and B has the greater initial value. Line A is steeper, but it starts lower.",
        ],
        illustration: "compare-functions-graph",
      },
      {
        title: "Negative rates",
        paragraphs: [
          "A negative rate of change means $y$ goes down as $x$ goes up. Any negative rate is less than any positive rate, even when its line looks steeper: $-3 < \\tfrac{1}{2}$. Compare the numbers with their signs, not how steep the lines look.",
          "Compare each feature on its own. One function can have the greater rate of change while the other has the greater initial value. A function that starts higher can be overtaken by one that grows faster.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Compare like features",
        paragraphs: [
          "For a linear function $y = mx + b$, the rate of change $m$ is the change in output divided by the change in input, for any change in input other than 0. The initial value $b$ is the output when the input is 0. A table, graph or equation can show the same two features. Compare their numbers in matching units.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Function A is given by the table x = 0, 3, 6, 9 and y = 1, 7, 13, 19. Function B's graph is a straight line through (0, 6) and (4, 8). Compare their rates of change and initial values.",
      steps: [
        "Function A: from $x = 0$ to $x = 3$, $y$ goes from 1 to 7. Its rate of change is $(7 − 1) ÷ (3 − 0) = 2$. At $x = 0$, $y = 1$, so its initial value is 1.",
        "Function B: its line crosses the up-and-down axis at $(0, 6)$, so its initial value is 6. From $(0, 6)$ to $(4, 8)$, its rate of change is $(8 − 6) ÷ (4 − 0) = \\tfrac{1}{2}$.",
        "Compare each feature on its own: $2 > \\tfrac{1}{2}$ for the rates, and $1 < 6$ for the initial values.",
      ],
      answer:
        "Function A has the greater rate of change; function B has the greater initial value.",
    },
    pitfalls: [
      "Compare numbers with their signs. A rate of $-4$ is less than a rate of 1.",
      "Do not read the initial value from the first row of a table unless that row has $x = 0$.",
      "When table rows are 2 apart in $x$, divide the change in $y$ by 2 to get the change for each 1.",
    ],
    parentGuide:
      "Compare two savings plans. One starts with 20 dollars and adds 2 each week. The other starts with 5 and adds 5. Make a short table for each, and ask which starts higher, which grows faster, and when the second catches up.",
  },
  {
    id: "linear-function-choice",
    title: "Linear or not linear",
    summary:
      "A function is a rule that turns each input (the number you put in) into one output (the number you get back). It is called linear when equal steps in the input always change the output by equal amounts. Then its graph, the picture of all its input and output pairs, is a straight line. For $y = 2x + 1$, the inputs 0, 1, 2, 3 give outputs 1, 3, 5, 7: up 2 each time. For $y = x^2$ ($x$ times $x$), they give 0, 1, 4, 9, which is not steady.",
    templateIds: ["linear-function-choice"],
    includeGeneratedRepresentation: false,
    senses: functionSenses,
    noLink: functionNoLink,
    objectives: [
      "Recognize linear functions written in other ways than $y = mx + b$, such as $y = 7$ and $y = 3(x − 2)$.",
      "Show that a function is not linear by finding unequal changes in $y$ for equal steps in $x$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Look for a steady climb",
        paragraphs: [
          "A function gives one output for each allowed input. In a rule such as $y = 3x + 1$, $x$ is the input and $y$ is the output. If equal steps in the input always change the output by equal amounts, the graph is a straight line. A function like that is called linear.",
        ],
      },
      functionWords,
      {
        title: "Equal input steps, equal output changes",
        paragraphs: [
          "In the figure, $y = 2x + 1$ gives 1, 3, 5, 7 at $x = 0, 1, 2, 3$. Each step adds 2, and the points lie on a straight line.",
          "Now take $y = x^2$, read “$x$ squared”, which means $x$ times $x$. It gives 0, 1, 4, 9. The changes are 1, 3 and 5, and they grow, so the points bend upward. Its rate of change is not the same each step, so it is not linear.",
          "To test a rule, find $y$ at $x = 1$, 2 and 3. Unequal changes prove a rule is not linear. Equal changes are a good sign; then confirm by rewriting the rule as $y = mx + b$. Rules like $y = x \\times x$ and $y = \\frac{12}{x}$ are not linear: equal steps in $x$ give unequal changes in $y$.",
        ],
        illustration: "linear-nonlinear-graph",
      },
      {
        title: "Linear rules in disguise",
        paragraphs: [
          "Multiply out parentheses: $y = 3(x − 2)$ is $y = 3x − 6$. Reorder the parts: $y = 5 − 2x$ is $y = -2x + 5$. Dividing $x$ by a number is multiplying it by a fraction: $y = \\frac{x}{2} − 4$ has rate of change $\\tfrac{1}{2}$. All three are linear.",
          "A rule with no $x$ at all, such as $y = 7$, is linear too. It is $y = 0x + 7$, with rate of change 0, and its graph is a flat, horizontal line. Being linear means the rate of change stays the same. It does not depend on the letter $x$ appearing.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "What makes a function linear",
        paragraphs: [
          "A function with number input $x$ and output $y$ is linear when one fixed rate $m$ and one fixed starting value $b$ give $y = mx + b$ for every allowed input. Then equal changes in input (other than 0) give equal changes in output, and the graph lies on a straight line.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Which of these equations defines a function that is not linear: y = 3(x − 2), y = 7, y = x² + 1 or y = x/2 − 4?",
      steps: [
        "Rewrite each rule to see whether it fits $y = mx + b$. $y = 3(x − 2)$ is $y = 3x − 6$. $y = 7$ is $y = 0x + 7$. $y = \\frac{x}{2} − 4$ has rate of change $\\tfrac{1}{2}$. These three are linear.",
        "$y = x^2 + 1$ gives 2, 5 and 10 at $x = 1$, 2 and 3. The changes, 3 and 5, are not equal, so its rate of change is not steady. It is not linear.",
      ],
      answer: "y = x² + 1",
    },
    pitfalls: [
      "$y = 7$ is linear. A rate of change of 0 still stays the same.",
      "Multiply out before judging. $y = 4(x + 1)$ is linear even though it does not look like $y = mx + b$.",
      "A function that always goes up is not always linear. Check that the increases are equal.",
    ],
    parentGuide:
      "Make a table for $y = 2x + 1$ and for $y = x × x$ together, for $x = 0$ to 4. Compare how much $y$ grows at each step. Plot both on squared paper to see which points line up.",
  },
];

export const patternFunctionMethods: Record<string, ProblemMethod> = {
  "rule-pattern-term": {
    goal: "Find a later term of a number pattern from its start and rule.",
    terms: ["term-sequence", "rule"],
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
    terms: ["even-number", "odd-number"],
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
      "corresponding-terms",
      [
        "ordered-pair",
        "Here the first number is the term of pattern A and the second the term of pattern B.",
      ],
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
    goal: "Choose the equation that gives the dependent variable from the independent one, using a table or graph.",
    senses: functionSenses,
    noLink: functionNoLink,
    intuition:
      "A variable is a letter that stands for an amount, such as $t$ for hours or $d$ for miles. The independent variable is the amount that is chosen or changed freely, like the hours driven. The dependent variable is the one that depends on it, like distance depending on time. In the equation, the dependent variable stands alone on one side, as in $d = 65t$, meaning $d$ is 65 times $t$.",
    terms: ["independent-variable", "dependent-variable"],
    method: [
      "Name the dependent variable: the amount that depends on the other. It stands alone on one side of the equation.",
      "For each pair, divide the dependent value by the independent value (when it is not 0), and also subtract them. Compare each output with its own input.",
      "Use the answer that is the same in every row: a times rule like $d = 65t$, or a plus rule like $m = b + 4$. If neither stays the same, test rules that multiply and add, like $y = 2x + 1$.",
    ],
    watch:
      "Test every row. Divide each output by its own input, not by the step between rows.",
  },
  "dependent-variable-value": {
    goal: "Use an equation that links two variables, such as $d = 55t$, to find one from the other.",
    senses: functionSenses,
    noLink: functionNoLink,
    intuition:
      "A variable is a letter that stands for an amount, such as $t$ for hours or $d$ for miles. An equation like $d = 55t$ links two variables: $d$ is 55 times $t$. To substitute means to put a number in place of a letter. If the unknown is multiplied, divide to undo it. If a number is added to it, subtract.",
    terms: ["substitute"],
    method: [
      "Put the known number in place of its letter.",
      "If the unknown letter is multiplied by a number, divide both sides by that number. If a number is added to it, subtract that number from both sides.",
      "Check by putting your answer back into the original equation.",
    ],
    watch:
      "Put the known number in place of the letter it measures: a distance replaces $d$, a time replaces $t$.",
  },
  "compare-function-rates": {
    goal: "Compare the rates of change and the initial values of two linear functions shown in different ways.",
    senses: functionSenses,
    noLink: functionNoLink,
    intuition:
      "A function is a rule that gives one output $y$ for each input $x$. Its rate of change is how much $y$ changes each time $x$ goes up by 1: the change in $y$ divided by the change in $x$. Its initial value is the output when $x = 0$, the starting amount. A function is linear when its rate stays the same, so its graph is a straight line, $y = mx + b$.",
    terms: ["rate-of-change", "initial-value"],
    method: [
      "For each function, find the rate of change: divide the change in $y$ by the change in $x$ between two points or rows. In $y = mx + b$, it is $m$.",
      "Find each initial value: the $y$ value at $x = 0$. If $x = 0$ is not shown, work back from a known point.",
      "Compare the two rates, then the two initial values, as numbers with their signs.",
    ],
    watch:
      "A negative rate is less than any positive rate, however steep its line looks.",
  },
  "linear-function-choice": {
    goal: "Decide which rules make linear functions: ones whose output changes by the same amount for each step of 1.",
    senses: functionSenses,
    noLink: functionNoLink,
    intuition:
      "A function is a rule that gives one output $y$ for each input $x$. It is called linear when equal steps in $x$ always change $y$ by equal amounts, so its graph is a straight line. Every linear rule can be written $y = mx + b$, where $mx$ means $m$ times $x$. Rules like $y = x^2$ ($x$ times $x$) and $y = \\frac{12}{x}$ are not linear: equal steps in $x$ give unequal changes in $y$.",
    terms: ["linear-function"],
    method: [
      "Rewrite each rule: multiply out parentheses and put the parts in order.",
      "A rule that fits $y = mx + b$ is linear. That includes a rule with no $x$, like $y = 7$, which is $y = 0x + 7$.",
      "To confirm a rule is not linear, find $y$ at $x = 1$, 2 and 3 and show the changes are unequal.",
    ],
    watch: "$y = 7$ is linear. Its rate of change, 0, stays the same.",
  },
};

export const patternFunctionPrinciples: Record<string, string> = {
  "rule-pattern-term":
    "Each term comes from the one before by the rule, so the nth term is reached by applying the rule n − 1 times to the start.",
  "rule-pattern-feature":
    "A feature of the start that the step preserves holds for every term: an even step keeps the start's parity, and a step that is a multiple of $k$ keeps the start's remainder after division by $k$.",
  "related-patterns-relationship":
    "If two patterns start at 0 and B's step is $k$ times A's step, then after any number of steps each B-term is $k$ times its matching A-term, and the pairs lie on a line through (0, 0).",
  "dependent-variable-equation":
    "An equation states the relationship for every pair. The dependent variable equals the same expression in the independent variable in every row of the table and at every point of the graph.",
  "dependent-variable-value":
    "Putting a known number in for one letter turns the equation into a statement about one unknown. Undoing the operations in reverse order (dividing to undo multiplying, subtracting to undo adding) then finds it.",
  "compare-function-rates":
    "A linear function $y = mx + b$ has rate of change $m$ and initial value $b$, however it is shown. So two functions are compared by comparing their $m$ values and their $b$ values.",
  "linear-function-choice":
    "A function is linear exactly when its rate of change stays the same, which means its rule can be written $y = mx + b$.",
};
