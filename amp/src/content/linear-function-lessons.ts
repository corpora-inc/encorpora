import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Glossary readings shared by the Algebra 1 function lessons and methods. */
const senses = {
  side: "side-of-equation",
  sides: "side-of-equation",
  term: "term-expression",
  terms: "term-expression",
  rule: "rule",
  rules: "rule",
  range: "range-function",
  ranges: "range-function",
  unit: "unit",
  units: "unit",
  squared: "square-number",
  square: "square-number",
  multiple: "multiple",
  multiples: "multiple",
  model: "model",
  degrees: "degree-temperature",
  interval: "interval",
  product: "product-multiply",
} as const;
const noLink = [
  "whole",
  "part",
  "parts",
  "change",
  "changes",
  "opposite",
  "leaves",
  "mean",
  "means",
  "more than",
  "difference",
  "jumps",
  "cube",
  "average",
  "population",
  "base",
  "bases",
];

/** What a function, an input and an output are, said on every screen that
 * needs them. */
const functionWords =
  "A function is a rule that gives exactly one output for each input. The input is the number you put in, and the output is the number the rule gives back. We often call the input $x$ and the output $y$. We also write $f(x)$, read “$f$ of $x$”: it means the output of the function $f$ when the input is $x$.";

/** Algebra 1: functions and their domains, average rate of change, linear
 * models, formulas, and graphs as solution sets. */
export const linearFunctionLessons: Lesson[] = [
  {
    id: "domain-and-range",
    title: "Functions, domain and range",
    summary:
      "A function is a rule that gives each input exactly one output. The input is what you put in; the output is what comes out. Think of a vending machine: each button (input) gives one snack (output). The domain is every input the function accepts. The range is every output it can give. On a graph, a picture of all the input-output pairs, read the domain across and the range up and down.",
    templateIds: [
      "graph-domain-range",
      "context-domain-range",
      "function-relation-test",
    ],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Decide whether a set of pairs is a function by checking that no input has two different outputs.",
      "Read a function's domain and range from its graph, paying attention to filled and open end dots.",
      "Give the domain and range that make sense in a real situation: whole-number counts or amounts that can take any value, with their limits.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One output for each input",
        paragraphs: [
          "A relation is any set of pairs that matches inputs $x$ with outputs $y$. It is called a function when each input has exactly one output.",
          "In the table, the input 2 is paired with both 3 and 7. So this relation is not a function. The output 4 appears twice, for the inputs 1 and 5. That is allowed, because each of those inputs still has only one output.",
          "An equation makes $y$ a function of $x$ when every $x$ gives just one $y$. Take $y = x^2 + 1$. Here $x^2$ is read “$x$ squared”, which means $x$ times $x$. Each $x$ has one square, so each $x$ gives one $y$: it is a function. But $x = y^2$ is not: $x = 4$ is true for $y = 2$ and also for $y = -2$.",
        ],
        illustration: "relation-repeated-input",
      },
      {
        title: "Domain and range on a graph",
        paragraphs: [
          "The domain is every $x$ value that has a point on the graph. Read it along the across axis (the $x$-axis), from the left end of the graph to the right end. The range is every $y$ value the graph reaches. Read it along the up-and-down axis (the $y$-axis), from the lowest point to the highest.",
          "A filled dot at an end means that end point is included. An open dot means it is left out. The sign $\\le$ means “less than or equal to”, and $<$ means “less than”.",
          "A point $(-3, 6)$ means 3 left of $(0, 0)$ and 6 up. The graph shown starts at $(-3, 6)$ with a filled dot and ends at $(4, 2.5)$ with an open dot. So its domain is $-3 \\le x < 4$. Its lowest point is the turning point $(1, -2)$, where the graph stops going down and starts going up. Its highest point is $(-3, 6)$. So its range is $-2 \\le y \\le 6$. The range of a curve is not always set by its ends.",
        ],
        illustration: "domain-range-axes",
      },
      {
        title: "Domain and range in a situation",
        paragraphs: [
          "A formula may accept every number while the real situation does not. Say a van carries at most 12 passengers, who pay 5 dollars each. The fare for $p$ passengers is $F(p) = 5p$, for $p = 0, 1, 2$ and so on up to 12. The domain is the whole numbers (0, 1, 2, 3 and so on) from 0 to 12, because you cannot have half a passenger. The range is 0, 5, 10 and so on up to 60.",
          "An amount that changes smoothly, such as time or volume, takes every value in between. A 600-liter tank drains at 25 liters per minute, so the water left is $W(t) = 600 - 25t$. It reaches 0 when $t = 600 ÷ 25 = 24$. Its domain is $0 \\le t \\le 24$ and its range is $0 \\le W \\le 600$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A 300-liter tank drains at 15 liters per minute. W(t) = 300 − 15t gives the water left after $t$ minutes, until the tank is empty. What is the domain of $W$?",
      steps: [
        "The time stops when the tank is empty, so find when the water left is 0: $W(t) = 0$. That is $300 - 15t = 0$, so $15t = 300$ and $t = 300 ÷ 15 = 20$.",
        "Time starts at 0 and passes smoothly, not in jumps, so $t$ takes every value from 0 to 20, both ends included.",
      ],
      answer: "0 ≤ t ≤ 20",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The domain is every $x$ value of a point on the graph, and the range is every $y$ value. A filled end dot belongs to the graph, and an open one does not.",
          "A situation limits a function to the inputs that make sense. The range is then the outputs of exactly those inputs.",
          "A relation is a function exactly when no input is paired with two different outputs.",
        ],
      },
    ],
    pitfalls: [
      "Do not reject a relation because an output repeats. Only an input with two different outputs breaks a function.",
      "Do not read the range from the ends alone. A turning point can be lower or higher than both ends.",
      "Do not allow every number when the input counts objects. A count must be a whole number.",
    ],
    parentGuide:
      "Point to an everyday function, such as the price of $n$ identical tickets. Ask which inputs make sense (can $n$ be 2.5? 1,000?) and which outputs can happen. Then trace a graph with a finger from its left end to its right end, and from its lowest point to its highest, saying the domain and range aloud.",
  },
  {
    id: "average-rate-of-change",
    title: "Average rate of change",
    summary:
      "A rate of change tells how fast one amount changes compared with another, like miles per hour. On a curved graph (a picture of how one amount depends on another), the change is faster in some places and slower in others. Between two points, the average rate of change is the change in output (the result) divided by the change in input (what you put in). Drive 120 miles in 3 hours and your average is $120 ÷ 3 = 40$ miles per hour, even if you stopped on the way.",
    templateIds: ["average-rate-formula", "average-rate-display"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Find an average rate of change from a formula, a table or a graph.",
      "Explain it as the slope of the straight line through two points of the graph, with units such as feet per second.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Change in output over change in input",
        paragraphs: [
          `${functionWords} A straight line changes by the same amount for every step, and that amount is called its slope. A curve can get steeper or flatter as you go.`,
          "So pick two different inputs, $a$ and $b$. Then $f(a)$ is the output at $a$, and $f(b)$ is the output at $b$. The average rate of change from $a$ to $b$ is the change in output divided by the change in input: $\\frac{f(b) - f(a)}{b - a}$. Only the two end points count; what happens between them does not.",
          "For example, if an output goes up 9 while its input goes up 3, the average rate of change is $9 ÷ 3 = 3$. That is 3 output units for each 1 input unit. It depends only on the two end points, even when the graph curves between them.",
        ],
      },
      {
        title: "The secant line",
        paragraphs: [
          "Draw the straight line through $A = (1, -2)$ and $B = (4, 7)$. A line like this, through two points of a curve, is called a secant line. It rises 9 while it runs 3 to the right, so its slope is $9 ÷ 3 = 3$. That is the same number as the average rate of change. The secant is the straight path from $A$ to $B$ that rises by the same amount for every step.",
          "The units come from dividing. If $h(t)$ is a height in feet after $t$ seconds, the average rate of change is in feet per second. If $P$ is a population in thousands and $x$ is a year, it is thousands per year. Going from the smaller input to the larger, a negative average rate of change means the output went down overall.",
        ],
        illustration: "average-rate-secant",
      },
    ],
    workedExample: {
      prompt:
        "For f(x) = x² − 2x − 1, what is the average rate of change of $f$ from x = 1 to x = 4?",
      steps: [
        "Find the output at each end by putting the input into the rule. $f(4) = 16 - 8 - 1 = 7$, and $f(1) = 1 - 2 - 1 = -2$.",
        "Divide the change in output by the change in input, subtracting in the same order on top and bottom: $(7 - (-2)) ÷ (4 - 1) = \\frac{9}{3} = 3$.",
      ],
      answer: "3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "If $f(a)$ and $f(b)$ both exist and $a \\ne b$ ($a$ is not equal to $b$), the average rate of change from $a$ to $b$ is $\\frac{f(b) - f(a)}{b - a}$. It is the slope of the line through $(a, f(a))$ and $(b, f(b))$.",
          "An average rate of change depends only on the function's values at the two ends of the stretch.",
        ],
      },
    ],
    pitfalls: [
      "Subtract in the same order on top and bottom: $(f(b) - f(a)) ÷ (b - a)$, not $(f(b) - f(a)) ÷ (a - b)$.",
      "Divide by the change in $x$, not by $b$ alone.",
      "Use the outputs on top, not the inputs. From $x = 1$ to $x = 4$, the top is $f(4) - f(1)$, not $4 - 1$.",
    ],
    parentGuide:
      "Use a car trip: 120 miles in 3 hours is an average of 40 miles per hour, even if the car stopped for gas. Then ask for the average rate between two rows of any table you meet, such as temperatures through a day.",
  },
  {
    id: "linear-models",
    title: "Build linear models",
    summary:
      "Many real costs have two parts: an amount paid once, and an amount paid again for each mile, month or item. The once-only part is the starting amount. The amount for each step is the rate. Together they make an equation like fare $= 2 \\times$ miles $+ 3$. An equation like this is called a linear model. Use it to predict a total, or work backward from a total.",
    templateIds: [
      "linear-model-value",
      "linear-model-equation",
      "linear-initial-value-meaning",
    ],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Write an equation or inequality for a real situation, saying what the letter counts.",
      "Tell the starting amount from the rate in words, tables and graphs, and solve the model.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Starting amount and rate",
        paragraphs: [
          "A taxi charges 3 dollars plus 2 dollars per mile. Let $d$ be the miles traveled and $F$ the fare in dollars. The 3 dollars is paid once, whatever the distance. It is the starting amount: the fare when $d=0$, before any miles.",
          "The 2 dollars is paid once for each mile. It is the rate, so it multiplies $d$. That gives $F=2d+3$, where $2d$ means 2 times $d$.",
          "In general, a linear model is written $y=mx+b$. The input is $x$ and the output is $y$. The starting amount $b$ is the output when $x=0$. The rate $m$ is how much the output changes each time $x$ goes up by 1.",
          "On a graph, the starting amount is where the line meets the up-and-down $F$-axis, at $\\left(0,3\\right)$. The rate is how far the line rises for each step of 1 to the right: 2 dollars per mile. In a table, the rate is the change from one column to the next when $d$ goes up by 1. Find the starting amount by working back to $d=0$.",
        ],
        illustration: "linear-model-graph",
      },
      {
        title: "Solve the model",
        paragraphs: [
          "To answer a question, write the equation it describes. If the fare was 19 dollars, then $2d + 3 = 19$. Subtract 3 from both sides: $2d = 16$. Divide both sides by 2: $d = 8$ miles.",
          "Two phone plans cost $30 + 12m$ and $6 + 18m$ dollars after $m$ months. They cost the same when $30 + 12m = 6 + 18m$. Subtract $12m$ and 6 from both sides: $24 = 6m$, so $m = 4$ months.",
          "Words such as “at most” and “no more than” give an inequality, which uses $\\le$, meaning “less than or equal to”. With 25 dollars for the taxi, $2d + 3 \\le 25$, so $2d \\le 22$ and $d \\le 11$. If the question asks for the greatest number of whole things under an “at most” limit, the answer is the greatest whole number that fits.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A gym charges a joining fee of 40 dollars plus 25 dollars per month. Maya has paid 315 dollars in all. For how many months has she been a member?",
      steps: [
        "Let $m$ be the number of months. The 40 dollars is paid once, and 25 dollars is paid each month, so the total is $40 + 25m = 315$.",
        "Subtract 40 from both sides to undo the one-time fee: $25m = 275$. Divide both sides by 25 to undo the multiplying: $m = 11$.",
        "Check: $40 + 25 × 11 = 40 + 275 = 315$. It matches the total paid.",
      ],
      answer: "11",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An amount that starts at $b$ and changes by $m$ for each input unit has output $y=mx+b$ after $x$ input units. A stated total or limit turns this into an equation or inequality to solve.",
          "In a linear model $y=mx+b$, $x$ is the input and $y$ is the output. The number $b$ is the output when $x=0$, if the situation allows 0. The number $m$ is the change in output for each increase of 1 in $x$, in output units per input unit. On a graph, the line meets the up-and-down axis at $(0,b)$.",
        ],
      },
    ],
    pitfalls: [
      "Do not multiply the one-time amount by the letter. The fee is paid once; the rate is paid for each unit.",
      "Do not add the fee and the rate into one rate. 3 dollars plus 2 dollars per mile is not 5 dollars per mile.",
      "With a spending limit and a cost for each item, round the number of items down. Check that one more would go over the limit.",
    ],
    parentGuide:
      "Find a real price with a fixed part and a per-unit part, such as a phone plan or a delivery fee. Ask your learner to write the cost for $n$ units, then to find $n$ for a given bill. Ask what the graph would look like and where it would start.",
  },
  {
    id: "rearrange-formulas",
    title: "Rearrange formulas",
    summary:
      "A formula is an equation that links several amounts with letters. For example, a rectangle's perimeter, the distance around it, is $P = 2l + 2w$, with length $l$ and width $w$. Sometimes you need a different letter alone on one side. Treat every other letter as a known number. Then undo what was done to your letter, last step first, doing the same thing to both sides.",
    templateIds: ["formula-isolate", "formula-value"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Solve a formula for a named letter by undoing its operations in reverse order.",
      "Use the rearranged formula to find that letter's value from the others.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Undo in reverse order",
        paragraphs: [
          "A triangle's area, the amount of flat space inside it, is $A=\\frac{bh}{2}$. Here $b$ is the base, the side it stands on. The height is the shortest distance from the line of the base to the opposite corner, written $h$. Both are more than 0, and $bh$ means $b$ times $h$. To find $h$ from the others, undo what was done to it. First $h$ was multiplied by $b$, then divided by 2.",
          "Undo the last step first: multiply both sides by 2 to get $2A=bh$. Then divide both sides by $b$, which is not 0: $h=\\frac{2A}{b}$. Each step can be reversed, so the formula stays true.",
          "In $v=u+at$, $u$ is the starting speed, $v$ is the final speed, $a$ is the change in speed per unit of time, and $t$ is the time that passed. To find $a$ when $t$ is not 0, subtract $u$ from both sides, then divide both sides by $t$: $a=\\frac{v-u}{t}$. The whole difference $v-u$ is divided by $t$, so it goes on top together.",
        ],
        illustration: "formula-isolate-steps",
      },
      {
        title: "Rearrange, then substitute",
        paragraphs: [
          "A rectangle's perimeter (the distance around it) is $P = 2l + 2w$, with length $l$ and width $w$. If $P = 46$ and $l = 15$, then $w = \\frac{P - 2l}{2} = \\frac{46 - 30}{2} = 8$. Putting the numbers in first also works: $46 = 30 + 2w$, so $2w = 16$ and $w = 8$.",
          "Rearranging first gives a formula you can reuse. To turn Fahrenheit into Celsius, write $C = \\frac{5(F - 32)}{9}$ once. Then each $F$ gives its $C$ directly: $F = 86$ gives $C = \\frac{5 × 54}{9} = 30$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle's perimeter is P = 2l + 2w. Find the width $w$ when P = 46 and the length l = 15.",
      steps: [
        "Get $w$ alone. $w$ was multiplied by 2 and then $2l$ was added, so undo in reverse order: subtract $2l$ from both sides, then divide both sides by 2. That gives $w = \\frac{P - 2l}{2}$.",
        "Put in the known numbers: $w = \\frac{46 - 30}{2} = \\frac{16}{2} = 8$.",
      ],
      answer: "8",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Doing the same reversible operation to both sides keeps a formula true. So undoing the operations on one letter in reverse order gets it alone. Divide only by an amount that cannot be 0.",
          "Putting in the known values leaves one unknown, which the same undoing steps find.",
        ],
      },
    ],
    pitfalls: [
      "Divide every term (each part joined by + or −) by the number: $\\frac{P - 2l}{2}$ is $\\frac{P}{2} - l$, not $\\frac{P}{2} - 2l$.",
      "Undo the steps in reverse order. In $C = \\frac{5(F - 32)}{9}$, 32 was subtracted first, so to find $F$ you multiply both sides by $\\tfrac{9}{5}$ first and add 32 last.",
      "Keep the division the right way up. From $d = rt$ with $r \\ne 0$, $t = \\frac{d}{r}$, not $\\frac{r}{d}$.",
    ],
    parentGuide:
      "Take a formula your learner already uses, such as distance equals rate times time. Ask how long a 150-mile trip at 50 miles per hour takes. Then ask for a formula that gives the time directly, and check it with the same numbers.",
  },
  {
    id: "graphs-as-solution-sets",
    title: "Graphs as solution sets",
    summary:
      "An equation with $x$ and $y$, like $2x + 3y = 12$, is true for some pairs of numbers and false for others. Each pair is a point on a grid, such as $(3, 2)$: start where the two number lines cross, at $(0, 0)$, go 3 to the right, then 2 up. The graph of the equation is every point that makes it true. So a point is on the graph exactly when its numbers make the equation true.",
    templateIds: ["solution-point-choice", "solution-coordinate"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Decide whether a point is on a graph by putting its numbers into the equation.",
      "Find the missing number of a point on a graph by solving an equation with one letter.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "On the graph means makes it true",
        paragraphs: [
          "A point $(3, 2)$ has two coordinates: the first, 3, is $x$, and the second, 2, is $y$. Every point on the line $2x + 3y = 12$ makes the equation true. $(0, 4)$ gives $0 + 12 = 12$. $(3, 2)$ gives $6 + 6 = 12$. $(6, 0)$ gives $12 + 0 = 12$.",
          "A point off the line, such as $(4, 4)$, gives $8 + 12 = 20$, not 12. So it is not a solution, a pair that makes the equation true.",
          "The same holds for any equation. Take $y = x^2 - 3$, where $x^2$ means $x$ times $x$. Its graph contains $(2, 1)$, because $2^2 - 3 = 1$. It does not contain $(1, 2)$, because $1^2 - 3 = -2$. Always put the first number in for $x$ and the second for $y$.",
        ],
        illustration: "solution-set-line",
      },
      {
        title: "Find a missing coordinate",
        paragraphs: [
          "Say $(4, k)$ is on the graph of $2x + 3y = 17$, where $k$ is an unknown number. Its numbers make the equation true: $2(4) + 3k = 17$. So $3k = 9$ and $k = 3$. The up-and-down line $x = 4$ crosses the graph at exactly that point.",
          "A line can cross at a point that is not on a grid corner. For $2x + 5y = 14$ and $x = -2$: $-4 + 5k = 14$, so $5k = 18$ and $k = \\frac{18}{5}$. Reading a graph gives an estimate; putting the numbers in gives the exact value.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The point (4, $k$) is on the graph of 2x + 3y = 17. What is $k$?",
      steps: [
        "The point is on the graph, so its numbers make the equation true. Put $x = 4$ and $y = k$ in: $2(4) + 3k = 17$, so $8 + 3k = 17$.",
        "Subtract 8 from both sides: $3k = 9$. Divide both sides by 3 to get $k$ alone: $k = 3$.",
      ],
      answer: "3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The graph of an equation is the set of all points whose coordinates make the equation true.",
          "A point lies on a graph exactly when its coordinates make the equation true. For a line $ax+by=c$ with both $a$ and $b$ not 0, either known coordinate gives exactly one value for the other. That is not true for every graph.",
        ],
      },
    ],
    pitfalls: [
      "Put the first number in for $x$ and the second for $y$. $(3, 2)$ and $(2, 3)$ are different points.",
      "Check every point by putting its numbers in. A point that looks close to a line may miss it.",
      "Multiply the entire number you put in by itself, sign included. Squaring means multiplying a number by itself: $(-2)^2 = (-2) \\times (-2) = 4$, while $-2^2$ means $-(2 \\times 2) = -4$.",
    ],
    parentGuide:
      "Write an equation such as $x + y = 10$. Take turns naming points on its graph and points off it. Then plot the points you named and watch the line appear.",
  },
];

export const linearFunctionMethods: Record<string, ProblemMethod> = {
  "graph-domain-range": {
    goal: "Read the domain (all inputs) or the range (all outputs) of a function from its whole graph.",
    senses,
    noLink,
    intuition: `${functionWords} The domain is every input $x$ that has a point on the graph. The range is every output $y$ the graph reaches. A filled end dot is included; an open end dot is left out. The sign $\\le$ means “less than or equal to” and $<$ means “less than”.`,
    terms: ["domain", "range-function"],
    method: [
      "For the domain, read along the across axis from the graph's left end to its right end.",
      "For the range, read along the up-and-down axis from the lowest point to the highest. Check any turning point as well as the ends.",
      "At an end of the graph, use $\\le$ for a filled dot and $<$ for an open dot. For the range, an open dot's $y$ value still counts if another point of the graph reaches it.",
    ],
    watch:
      "Match each dot to its own value. On a line that falls to the right, the right end gives the lowest $y$ value.",
  },
  "context-domain-range": {
    goal: "Choose the inputs or outputs that make sense for a function that describes a real situation.",
    senses,
    noLink,
    intuition: `${functionWords} The domain is every input that makes sense, and the range is every output those inputs give. A count of things, like people, can only be a whole number. An amount like time or water can take any value in between.`,
    terms: ["domain", "range-function"],
    method: [
      "Ask what the input measures: a count of whole things, or an amount like time that changes smoothly.",
      "Find the limits: a stated largest number, or the moment something runs out (set the function equal to 0 and solve).",
      "Put the allowed inputs into the rule to describe the outputs.",
    ],
    watch:
      "A count takes only whole numbers. A function that stops when something runs out has a largest time.",
  },
  "function-relation-test": {
    goal: "Decide which relation gives exactly one output for each input.",
    senses,
    noLink,
    intuition:
      "A relation is a set of pairs that matches inputs $x$ with outputs $y$, such as $(1, 4)$ and $(2, 3)$. It is called a function when each input has exactly one output. An output may repeat. But if one input comes with two different outputs, it is not a function.",
    terms: ["function"],
    method: [
      "For a list of pairs, look at the inputs (the first numbers). Find any input that appears with two different outputs.",
      "For an equation, try one $x$ value and count the $y$ values that make it true. If two different $y$ values work, such as 2 and $-2$, that $x$ has two outputs.",
    ],
    watch:
      "A repeated output is allowed. Only an input with two different outputs breaks a function.",
  },
  "average-rate-formula": {
    goal: "Find the average rate of change of a function between two inputs, from its rule or two of its values.",
    senses,
    noLink,
    intuition: `${functionWords} From input $a$ to input $b$, the average rate of change is the change in output divided by the change in input: $\\frac{f(b) - f(a)}{b - a}$. It tells how much the output changes, on average, for each step of 1 in the input.`,
    terms: ["average-rate-of-change"],
    method: [
      "Find the output at each end: put $a$ and then $b$ into the rule.",
      "Subtract the outputs in the same order as the inputs: $f(b) - f(a)$ on top, $b - a$ on the bottom.",
      "Divide and simplify. In a real situation, give units of output per unit of input.",
    ],
    watch:
      "Divide by the change in $x$, $b - a$, and subtract in the same order on top and bottom.",
  },
  "average-rate-display": {
    goal: "Find the average rate of change between two inputs, from a graph or a table.",
    senses,
    noLink,
    intuition: `${functionWords} The average rate of change between two inputs is the change in output divided by the change in input. It uses only the two end points, not the values between them.`,
    method: [
      "Read the output at each end: the marked points on the graph, or the shaded columns of the table.",
      "Divide the change in output by the change in input, subtracting in the same order on top and bottom.",
    ],
    watch:
      "Ignore the values between the two ends. An average rate uses only the ends.",
  },
  "linear-model-value": {
    goal: "Write an equation or inequality for a real situation, then solve it.",
    senses,
    noLink,
    intuition:
      "Many real totals have two parts. The starting amount is paid once, such as a 3-dollar taxi fee. The rate is paid for each unit, such as 2 dollars per mile, so it multiplies the letter. Together they give a linear model: total $= 2d + 3$, where $2d$ means 2 times $d$. “At most” gives an inequality with $\\le$, meaning “less than or equal to”.",
    terms: ["initial-value", "rate"],
    method: [
      "Name the letter: what it counts, and its units.",
      "Write starting amount + rate $\\times$ letter. Set it equal to the total, or $\\le$ a limit, or equal to a second expression.",
      "Solve by undoing the steps on both sides, and check the answer in the story. If the question asks for the greatest (or least) whole number that fits a limit, round down (or up) to it.",
    ],
    watch:
      "Add the one-time amount once. Only the amount per unit multiplies the letter.",
  },
  "linear-model-equation": {
    goal: "Choose the equation that matches a situation given in words, a graph or a table.",
    senses,
    noLink,
    intuition:
      "The rate is how much the output changes each time the input goes up by 1. A linear model is written output $=$ rate $\\times$ input $+$ starting amount, like $y = 2x + 3$. The starting amount is the output when the input is 0. On a graph, it is where the line meets the up-and-down axis.",
    method: [
      "Find the starting amount: the output when the input is 0, where the graph meets the up-and-down axis.",
      "Find the rate: the change in output for each increase of 1 in the input. It is negative if the output goes down.",
      "Write output $=$ rate $\\times$ input $+$ starting amount, and find the matching choice.",
    ],
    watch:
      "Do not swap the two numbers. The rate multiplies the letter; the starting amount stands alone.",
  },
  "formula-isolate": {
    goal: "Rearrange a formula so a named letter stands alone on one side.",
    senses,
    noLink,
    intuition:
      "A formula is an equation that links amounts with letters. For a triangle, $A = \\frac{bh}{2}$, where $bh$ means $b$ times $h$. The area is the amount of flat space inside the triangle, written $A$. The base $b$ is the side it stands on. The height is the shortest distance from the line of the base to the opposite corner, written $h$. To get one letter alone, treat every other letter as a known number. Then undo what was done to your letter, last step first, doing the same to both sides.",
    method: [
      "Treat every other letter as a known number. List what is done to the chosen letter, in order.",
      "Undo those steps in reverse order, doing the same thing to both sides each time.",
      "Check by putting simple numbers into the old formula and the new one.",
    ],
    watch:
      "Undo the last step first. When you divide, divide every term on the other side, not just one: $\\frac{P - 2l}{2}$ is $\\frac{P}{2} - l$.",
  },
  "formula-value": {
    goal: "Find one letter of a formula from the values of the others.",
    senses,
    noLink,
    intuition:
      "A formula is an equation that links amounts with letters. The perimeter is the distance around a shape. For a rectangle it is $P = 2l + 2w$, with length $l$ and width $w$. If you know every letter but one, put in the known numbers. Then undo what was done to the unknown, last step first, doing the same to both sides.",
    method: [
      "Put the known values into the formula in place of their letters.",
      "Undo the steps on the unknown in reverse order, on both sides, until it stands alone.",
    ],
    watch:
      "Undo the last step first. To find $F$ from $C = \\frac{5(F - 32)}{9}$, multiply both sides by $\\tfrac{9}{5}$ before adding 32.",
  },
  "solution-point-choice": {
    goal: "Choose the point that lies on the graph of an equation.",
    senses,
    noLink,
    intuition:
      "A point $(x, y)$ is a pair of numbers: start at $(0, 0)$, go across $x$ (right if positive, left if negative), then up $y$ (down if negative). The graph of an equation is every point whose numbers make the equation true. So test each point: put its first number in for $x$ and its second for $y$.",
    method: [
      "Put each pair into the equation, the first number for $x$ and the second for $y$.",
      "Keep the pair that makes the equation true. The graph is exactly the set of such points.",
    ],
    watch:
      "Keep $x$ first. $(3, 2)$ and $(2, 3)$ are different points, so a swapped pair can fail the equation.",
  },
  "solution-coordinate": {
    goal: "Find the missing number of a point that lies on the graph of an equation.",
    senses,
    noLink,
    intuition:
      "A point $(x, y)$ is a pair of numbers, called coordinates: start at $(0, 0)$, go across $x$ (right if positive, left if negative), then up $y$ (down if negative). A point is on the graph of an equation exactly when its numbers make the equation true. So put in the number you know, and solve for the one you do not.",
    method: [
      "Put the known coordinate into the equation in place of its letter.",
      "Solve the one-letter equation that is left for the missing coordinate.",
    ],
    watch:
      "Multiply the entire number you put in by itself, sign included: $(-2)^2 = 4$.",
  },
};

export const linearFunctionPrinciples: Record<string, string> = {
  "graph-domain-range":
    "The domain is every $x$ value of a point on the graph, and the range is every $y$ value. A filled end dot belongs to the graph, and an open one does not.",
  "context-domain-range":
    "A situation limits a function to the inputs that make sense. The range is then the outputs of exactly those inputs.",
  "function-relation-test":
    "A relation is a function exactly when no input is paired with two different outputs.",
  "average-rate-formula":
    "For outputs $f(a)$ and $f(b)$ at different inputs ($a \\ne b$), the average rate of change is $\\frac{f(b) - f(a)}{b - a}$. It is the slope of the line through those two points of the graph.",
  "average-rate-display":
    "An average rate of change depends only on the function's values at the two ends of the stretch.",
  "linear-model-value":
    "An amount that starts at $b$ and changes by $m$ for each unit is $mx + b$ after $x$ units. A stated total or limit turns it into an equation or inequality to solve.",
  "linear-model-equation":
    "In $y = mx + b$, $b$ is the value when $x = 0$, and $m$ is the change in $y$ for each increase of 1 in $x$. This holds whether the model is shown in words, a table or a graph.",
  "formula-isolate":
    "Doing the same reversible operation to both sides keeps a formula's solutions. Divide only by amounts that cannot be 0 in that formula.",
  "formula-value":
    "Putting in the known values leaves one unknown, which undoing the operations in reverse order finds.",
  "solution-point-choice":
    "The graph of an equation is the set of all points whose coordinates make the equation true.",
  "solution-coordinate":
    "A point lies on a graph exactly when its coordinates make the equation true. For $ax + by = c$ with $a$ and $b$ not 0, either known coordinate gives exactly one value for the other.",
};
