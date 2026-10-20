import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Algebra 1: functions and their domains, average rate of change, linear
 * models, formulas, and graphs as solution sets. */
export const linearFunctionLessons: Lesson[] = [
  {
    id: "domain-and-range",
    title: "Functions, domain and range",
    summary:
      "A function gives each input exactly one output. Its domain is the inputs it accepts; its range is the outputs it produces.",
    templateIds: [
      "graph-domain-range",
      "context-domain-range",
      "function-relation-test",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Decide whether a relation is a function by checking that no input has two outputs.",
      "Read a function's domain and range from its graph, with filled and open endpoints.",
      "State the domain and range that make sense in a situation: whole-number counts or continuous quantities, with their limits.",
    ],
    sections: [
      {
        title: "One output for each input",
        paragraphs: [
          "A relation pairs inputs $x$ with outputs $y$. It is a function when each input has exactly one output. In the table, the input 2 is paired with both 3 and 7, so the relation is not a function. The output 4 appears twice, for the inputs 1 and 5; that is allowed, because each of those inputs still has one output.",
          "An equation defines $y$ as a function of $x$ when every $x$ gives one y. y = x² + 1 does: each $x$ has one square. x = y² does not: x = 4 is true for y = 2 and for y = −2.",
        ],
        illustration: "relation-repeated-input",
      },
      {
        title: "Domain and range on a graph",
        paragraphs: [
          "The domain is every $x$-value that has a point on the graph: read it along the $x$-axis, from the left end to the right end. The range is every $y$-value the graph reaches: read it up the $y$-axis, from the lowest point to the highest.",
          "A filled dot includes its endpoint; an open dot leaves it out. The graph shown starts at (−3, 6) with a filled dot and ends at (4, 2.5) with an open dot, so its domain is −3 ≤ x < 4. Its lowest point is the turning point (1, −2) and its highest is (−3, 6), so its range is −2 ≤ y ≤ 6. The range of a curve is not always set by its ends.",
        ],
        illustration: "domain-range-axes",
      },
      {
        title: "Domain and range in a situation",
        paragraphs: [
          "A formula may accept every real number while the situation does not. If a van carries at most 12 passengers who pay 5 dollars each, the fares are F(p) = 5p for p = 0, 1, 2, …, 12: the domain is the whole numbers from 0 to 12, and the range is the multiples of 5 from 0 to 60.",
          "A quantity that changes continuously, such as time or volume, takes every value in between. A 600-liter tank that drains at 25 liters per minute has W(t) = 600 − 25t, which reaches 0 when t = 600 ÷ 25 = 24. Its domain is 0 ≤ t ≤ 24 and its range is 0 ≤ W ≤ 600.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A 300-liter tank drains at 15 liters per minute. W(t) = 300 − 15t gives the water left after $t$ minutes, until the tank is empty. What is the domain of $W$?",
      steps: [
        "The tank is empty when W(t) = 0: 300 − 15t = 0, so t = 300 ÷ 15 = 20.",
        "Time is continuous and starts at 0, so $t$ takes every value from 0 to 20.",
      ],
      answer: "0 ≤ t ≤ 20",
    },
    pitfalls: [
      "Do not reject a relation because an output repeats: only a repeated input with different outputs breaks a function.",
      "Do not read the range from the ends alone; a turning point can be lower or higher than both ends.",
      "Do not use every real number when the input counts objects: it must be a whole number.",
    ],
    parentGuide:
      "Point to an everyday function, such as the price of $n$ identical tickets, and ask which inputs make sense (can $n$ be 2.5? 1,000?) and which outputs can occur. Then trace a graph with a finger from its left end to its right end, and from its lowest point to its highest, saying the domain and range aloud.",
  },
  {
    id: "average-rate-of-change",
    title: "Average rate of change",
    summary:
      "The average rate of change of $f$ from x = a to x = b is (f(b) − f(a)) ÷ (b − a): the slope of the secant line through the two points.",
    templateIds: ["average-rate-formula", "average-rate-display"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Compute an average rate of change from a formula, a table or a graph.",
      "Interpret it as the slope of a secant line, with units such as feet per second.",
    ],
    sections: [
      {
        title: "Change in output over change in input",
        paragraphs: [
          "A line changes at one constant rate, its slope. A curve does not, so we measure its average rate over an interval: the change in $f$ divided by the change in x, (f(b) − f(a)) ÷ (b − a). Only the two ends of the interval enter; what $f$ does in between does not.",
          "For f(x) = x² − 2x − 1 from x = 1 to x = 4: f(4) = 16 − 8 − 1 = 7 and f(1) = 1 − 2 − 1 = −2, so the average rate is (7 − (−2)) ÷ (4 − 1) = 9 ÷ 3 = 3.",
        ],
      },
      {
        title: "The secant line",
        paragraphs: [
          "Draw the line through $A = (1, -2)$ and $B = (4, 7)$. This secant line rises 9 over a run of 3, so its slope is 3: the same number as the average rate. A secant is the straight path that gets from $A$ to $B$ at one steady rate.",
          "Units follow the quotient. If $h(t)$ is a height in feet after $t$ seconds, the average rate is in feet per second. If $P$ is a population in thousands and $x$ is a year, it is thousands per year. A negative average rate means the output fell over the interval.",
        ],
        illustration: "average-rate-secant",
      },
    ],
    workedExample: {
      prompt:
        "For f(x) = x² − 2x − 1, what is the average rate of change of $f$ from x = 1 to x = 4?",
      steps: [
        "f(4) = 16 − 8 − 1 = 7 and f(1) = 1 − 2 − 1 = −2.",
        "Average rate of change = (7 − (−2)) ÷ (4 − 1) = 9/3 = 3.",
      ],
      answer: "3",
    },
    pitfalls: [
      "Subtract in the same order on top and bottom: (f(b) − f(a)) ÷ (b − a), not (f(b) − f(a)) ÷ (a − b).",
      "Divide by the change in $x$, not by $b$ alone.",
      "Use the function's values, not the $x$-values: the rate from x = 1 to x = 4 is not (4 − 1) ÷ something.",
    ],
    parentGuide:
      "Use a car trip: 120 miles in 3 hours is an average of 40 miles per hour even if the car stopped for gas. Then ask for the average rate between two rows of any table you meet, such as temperatures through a day.",
  },
  {
    id: "linear-models",
    title: "Build linear models",
    summary:
      "A quantity that starts at $b$ and changes by $m$ for each unit of $x$ is modeled by y = mx + b; set it equal to a known total, or compare it with a limit, and solve.",
    templateIds: ["linear-model-value", "linear-model-equation"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Write a linear equation or inequality for a situation, naming what the variable counts.",
      "Tell the starting amount from the rate in words, tables and graphs, and solve the model.",
    ],
    sections: [
      {
        title: "Starting amount and rate",
        paragraphs: [
          "A taxi charges 3 dollars plus 2 dollars per mile. The 3 dollars is paid once, whatever the distance: it is the starting amount, the fare when d = 0. The 2 dollars is paid once for each mile: it is the rate, and it multiplies $d$. So F = 2d + 3.",
          "On the graph, the starting amount is where the line meets the $F$-axis, (0, 3), and the rate is the rise for each step of 1 to the right: 2. In a table, the rate is the change from one column to the next when $d$ goes up by 1, and the starting amount is found by working back to d = 0.",
        ],
        illustration: "linear-model-graph",
      },
      {
        title: "Solve the model",
        paragraphs: [
          "To answer a question, write the equation the question states. If the fare was 19 dollars: 2d + 3 = 19, so 2d = 16 and d = 8 miles. If two plans cost 30 + 12m and 6 + 18m dollars, they cost the same when 30 + 12m = 6 + 18m: 24 = 6m, so m = 4 months.",
          "Words such as “at most” and “no more than” give an inequality. With 25 dollars for the taxi: 2d + 3 ≤ 25, so d ≤ 11. When the variable counts whole things, the answer is the greatest whole number that fits.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A gym charges a joining fee of 40 dollars plus 25 dollars per month. Maya has paid 315 dollars in all. For how many months has she been a member?",
      steps: [
        "Let $m$ be the number of months: 40 + 25m = 315.",
        "Subtract 40: 25m = 275. Divide by 25: m = 11.",
        "Check: 40 + 25 × 11 = 315.",
      ],
      answer: "11",
    },
    pitfalls: [
      "Do not multiply the one-time amount by the variable: the fee is paid once, the rate is paid for each unit.",
      "Do not add the fee and the rate into one rate: 3 dollars plus 2 dollars per mile is not 5 dollars per mile.",
      "For “at most”, round down to a whole number that still fits; check it and the next one.",
    ],
    parentGuide:
      "Find a real price with a fixed part and a per-unit part (a phone plan, a delivery fee) and ask your learner to write the cost for $n$ units, then to find $n$ for a given bill. Ask what the graph would look like and where it would start.",
  },
  {
    id: "rearrange-formulas",
    title: "Rearrange formulas",
    summary:
      "To solve a formula for one variable, treat every other letter as a known number and undo the operations on that variable in reverse order, on both sides.",
    templateIds: ["formula-isolate", "formula-value"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Solve a formula for a named variable with inverse operations.",
      "Use the rearranged formula to find the variable's value from the others.",
    ],
    sections: [
      {
        title: "Undo in reverse order",
        paragraphs: [
          "In $A$ = bh/2, $h$ is multiplied by $b$ and divided by 2. Undo both on both sides, the last first: multiply by 2 to get 2A = bh, then divide by $b$ to get h = 2A/b. Each step keeps the two sides equal, so the new formula is true whenever the old one is.",
          "When a term is added, undo it first. In $v$ = $u$ + at, $a$ is multiplied by $t$ and then $u$ is added. So subtract $u$, then divide by $t: a = (v - u)/t$. The parentheses matter: all of v − u is divided by $t$.",
        ],
        illustration: "formula-isolate-steps",
      },
      {
        title: "Rearrange, then substitute",
        paragraphs: [
          "With P = 2l + 2w, P = 46 and l = 15: w = (P − 2l)/2 = (46 − 30)/2 = 8. Substituting first also works: 46 = 30 + 2w, so 2w = 16 and w = 8.",
          "Rearranging first gives a formula to reuse. A thermometer table needs C = 5(F − 32)/9 once, then each $F$ gives its $C$ directly: F = 86 gives C = 5 × 54/9 = 30.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle's perimeter is P = 2l + 2w. Find the width $w$ when P = 46 and the length l = 15.",
      steps: [
        "Solve for $w$: subtract 2l, then divide by 2, so w = (P − 2l)/2.",
        "Substitute: w = (46 − 30)/2 = 16/2 = 8.",
      ],
      answer: "8",
    },
    pitfalls: [
      "Divide every term by the coefficient: (P − 2l)/2 is P/2 − l, not P/2 − 2l.",
      "Undo an added term before dividing; subtract 32 from $F$ before multiplying by 5/9.",
      "Keep the division the right way up: from d = rt, t = d/r, not r/d.",
    ],
    parentGuide:
      "Take a formula your learner already uses, such as distance = rate × time, and ask how long a 150-mile trip at 50 mph takes. Then ask for a formula that gives time directly, and check it with the same numbers.",
  },
  {
    id: "graphs-as-solution-sets",
    title: "Graphs as solution sets",
    summary:
      "The graph of an equation in $x$ and $y$ is the set of all points whose coordinates make it true: a point is on the graph exactly when it solves the equation.",
    templateIds: ["solution-point-choice", "solution-coordinate"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Decide whether a point is on a graph by substituting its coordinates.",
      "Find the missing coordinate of a point on a graph by solving a one-variable equation.",
    ],
    sections: [
      {
        title: "On the graph means makes it true",
        paragraphs: [
          "Every point on the line 2x + 3y = 12 is a solution: (0, 4) gives 0 + 12 = 12, (3, 2) gives 6 + 6 = 12 and (6, 0) gives 12 + 0 = 12. A point off the line, such as (4, 4), gives 8 + 12 = 20, not 12, so it is not a solution.",
          "The same holds for any equation. The graph of y = x² − 3 contains (2, 1) because 2² − 3 = 1, and does not contain (1, 2) because 1² − 3 = −2. Always substitute $x$ first and $y$ second.",
        ],
        illustration: "solution-set-line",
      },
      {
        title: "Find a missing coordinate",
        paragraphs: [
          "If (4, $k$) is on the graph of 2x + 3y = 17, its coordinates make the equation true: 2(4) + 3k = 17, so 3k = 9 and k = 3. The vertical line x = 4 crosses the graph at exactly that point.",
          "A line can cross at a point that is not on the grid. For 2x + 5y = 14 and x = −2: −4 + 5k = 14, so k = 18/5. Reading a graph estimates; substituting gives the exact value.",
        ],
      },
    ],
    workedExample: {
      prompt: "The point (4, $k$) is on the graph of 2x + 3y = 17. What is $k$?",
      steps: [
        "Substitute x = 4: 2(4) + 3k = 17, so 8 + 3k = 17.",
        "Subtract 8: 3k = 9. Divide by 3: k = 3.",
      ],
      answer: "3",
    },
    pitfalls: [
      "Substitute the first coordinate for $x$ and the second for $y$; (3, 2) and (2, 3) are different points.",
      "Check every point by substitution: a point that looks close to a line may miss it.",
      "Square the whole substituted value: (−2)² = 4, while −2² = −4.",
    ],
    parentGuide:
      "Write an equation such as x + y = 10 and take turns naming points on its graph and points off it. Then plot the points you named and see the line appear.",
  },
];

export const linearFunctionMethods: Record<string, ProblemMethod> = {
  "graph-domain-range": {
    goal: "Read the domain or range of a function from its whole graph.",
    terms: [
      ["domain", "Every $x$-value that has a point on the graph."],
      ["range", "Every $y$-value the graph reaches."],
    ],
    method: [
      "For the domain, read along the $x$-axis from the graph's left end to its right end.",
      "For the range, read up the $y$-axis from the lowest point to the highest, checking any turning point as well as the ends.",
      "Use ≤ at a filled dot and < at an open dot.",
    ],
    watch:
      "Attach each dot to its own value: on a falling line the right end gives the lowest $y$-value.",
  },
  "context-domain-range": {
    goal: "Choose the inputs or outputs that make sense for a function describing a situation.",
    terms: [
      ["domain", "The inputs the situation allows."],
      ["range", "The outputs those inputs produce."],
    ],
    method: [
      "Ask what the input measures: a count of whole things, or a continuous quantity such as time.",
      "Find the limits: a stated maximum, or when the quantity runs out (solve the function equal to 0).",
      "Apply the rule to the allowed inputs to describe the outputs.",
    ],
    watch:
      "A count takes only whole numbers, and a function that stops when something runs out has an upper limit on time.",
  },
  "function-relation-test": {
    goal: "Decide which relation assigns exactly one output to each input.",
    terms: [
      ["function", "A relation in which each input has exactly one output."],
    ],
    method: [
      "For ordered pairs, list the inputs and look for one that appears with two different outputs.",
      "For an equation, try an $x$-value and count the $y$-values that make it true; $y$ and −y together mean two outputs.",
    ],
    watch:
      "A repeated output is allowed; only a repeated input with different outputs breaks a function.",
  },
  "average-rate-formula": {
    goal: "Find the average rate of change of a function over an interval from its formula or two of its values.",
    terms: [
      [
        "average rate of change",
        "(f(b) − f(a)) ÷ (b − a), the slope of the secant through the two points.",
      ],
    ],
    method: [
      "Evaluate the function at both ends of the interval.",
      "Subtract the values in the same order as the inputs: f(b) − f(a) over b − a.",
      "Divide and simplify; attach units of output per unit of input in a context.",
    ],
    watch:
      "Divide by the change in $x$, b − a, keeping the same order on top and bottom.",
  },
  "average-rate-display": {
    goal: "Find the average rate of change over an interval from a graph or a table.",
    method: [
      "Read the output at each end of the interval: the marked points on the graph, or the shaded columns of the table.",
      "Divide the change in output by the change in input, in the same order.",
    ],
    watch:
      "Ignore the values between the ends: an average rate uses only the two ends of the interval.",
  },
  "linear-model-value": {
    goal: "Write a linear equation or inequality for a situation and solve it.",
    terms: [
      [
        "starting amount",
        "The value paid or present once, when the variable is 0.",
      ],
      [
        "rate",
        "The change for each unit of the variable; it multiplies the variable.",
      ],
    ],
    method: [
      "Name the variable: what it counts and its units.",
      "Write starting amount + rate × variable, and set it equal to the total (or ≤ a limit, or equal to a second expression).",
      "Solve with inverse operations and check the answer in the story; for a limit, take the greatest whole number that fits.",
    ],
    watch:
      "The one-time amount is added once; only the per-unit amount is multiplied by the variable.",
  },
  "linear-model-equation": {
    goal: "Choose the equation that models a situation given in words, a graph or a table.",
    method: [
      "Find the starting amount: the value when the input is 0 (where the graph meets the vertical axis).",
      "Find the rate: the change in output for each increase of 1 in the input, negative if the output falls.",
      "Write output = rate × input + starting amount and match it to an option.",
    ],
    watch:
      "Do not swap the two numbers: the rate multiplies the variable and the starting amount stands alone.",
  },
  "formula-isolate": {
    goal: "Solve a formula for a named variable.",
    method: [
      "Treat every other letter as a known number and list what is done to the chosen variable.",
      "Undo those operations in reverse order, doing the same to both sides each time.",
      "Check by substituting simple numbers into the old and new formulas.",
    ],
    watch:
      "Undo an added term before dividing, and divide every term on the other side by the coefficient.",
  },
  "formula-value": {
    goal: "Find one variable of a formula from the values of the others.",
    method: [
      "Substitute the known values into the formula.",
      "Undo the operations on the unknown in reverse order, on both sides, until it stands alone.",
    ],
    watch:
      "Undo addition or subtraction before multiplication or division: subtract 32 from $F$ before multiplying by 5/9.",
  },
  "solution-point-choice": {
    goal: "Choose the point that lies on the graph of an equation.",
    method: [
      "Substitute each pair into the equation, the first number for $x$ and the second for $y$.",
      "Keep the pair that makes the equation true; the graph is exactly the set of such points.",
    ],
    watch: "$(a, b)$ and $(b, a)$ are different points: keep $x$ first.",
  },
  "solution-coordinate": {
    goal: "Find the missing coordinate of a point on the graph of an equation.",
    method: [
      "Substitute the known coordinate into the equation.",
      "Solve the resulting one-variable equation for the unknown coordinate.",
    ],
    watch: "Square the whole substituted value, sign included: (−2)² = 4.",
  },
};

export const linearFunctionPrinciples: Record<string, string> = {
  "graph-domain-range":
    "The domain is the projection of the graph onto the $x$-axis and the range is its projection onto the $y$-axis; a filled endpoint belongs to the graph and an open one does not.",
  "context-domain-range":
    "A situation restricts a function to the inputs that are meaningful, and the range is the set of outputs of exactly those inputs.",
  "function-relation-test":
    "A relation is a function exactly when no input is paired with two different outputs.",
  "average-rate-formula":
    "The average rate of change of $f$ on [$a$, $b$] is (f(b) − f(a)) ÷ (b − a), the slope of the line through $(a, f(a))$ and $(b, f(b))$.",
  "average-rate-display":
    "An average rate of change depends only on the function's values at the two ends of the interval.",
  "linear-model-value":
    "A quantity that starts at $b$ and changes by $m$ per unit is mx + b, and a stated total or limit turns it into an equation or inequality to solve.",
  "linear-model-equation":
    "In y = mx + b, $b$ is the value when x = 0 and $m$ is the change in $y$ for each increase of 1 in $x$, in every representation.",
  "formula-isolate":
    "Applying the same inverse operation to both sides keeps a formula true, so undoing the operations on one variable in reverse order isolates it.",
  "formula-value":
    "Substituting known values leaves one unknown, which inverse operations isolate.",
  "solution-point-choice":
    "The graph of an equation is the set of all points whose coordinates make the equation true.",
  "solution-coordinate":
    "A point lies on a graph exactly when its coordinates satisfy the equation, so one known coordinate determines the other.",
};
