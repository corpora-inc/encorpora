import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const entry =
  "Type a whole number, a negative number, a fraction such as 7/2, or a decimal such as 3.5; equivalent exact forms are accepted.";

type Entry = {
  id: string;
  title: string;
  summary: string;
  objectives: [string, string];
  intuition: string;
  terms: [string, string][];
  method: string[];
  watch: string;
  principle: string;
  example: { prompt: string; steps: string[]; answer: string };
  methodTitle: string;
  methodText: string[];
  formal: string;
  pitfalls: string[];
  parentGuide: string;
};

const entries: Entry[] = [
  {
    id: "sat-fn-linear-notation",
    title: "Linear functions in function notation",
    summary:
      "Read f(a) as the output for input a, then substitute to evaluate, or set f(x) equal to a value and solve for the input.",
    objectives: [
      "Evaluate a linear function written as f(x) at a given input, including a negative or fractional input.",
      "Find the input for a stated output, or the constant term, by writing and solving an equation.",
    ],
    intuition:
      "A function is a rule that gives exactly one output for each input. The symbol $f(x)$ names the output for input $x$, so $f(5)$ is the output when the input is 5. In a context the rule often has a fixed amount plus a rate times the input, such as a fee plus a charge per hour.",
    terms: [
      ["input", "The number you put into the rule; here the value of $x$."],
      [
        "output",
        "The number the rule produces; $f(x)$ is the output for input $x$.",
      ],
      [
        "constant term",
        "The part of a linear rule that does not change with the input.",
      ],
    ],
    method: [
      "To evaluate $f(a)$, replace every $x$ in the rule with $a$ and simplify, putting a negative input in parentheses.",
      "To find the input for an output $v$, write $f(x)=v$ and solve the equation for $x$.",
      "To find a constant term, substitute the known input and output and solve for the constant. " +
        entry,
    ],
    watch:
      "$f(x)=v$ is an equation to solve for $x$, but $f(a)=v$ is a fact about one input and one output, which you can substitute into the rule.",
    principle:
      "For a function $f$ and a number $a$ in its domain, $f(a)$ is the single output assigned to $a$. $f(a)=v$ holds exactly when substituting $a$ for $x$ in the rule gives $v$.",
    example: {
      prompt:
        "The function $g$ is defined by $g(x)=-3x+8$. For what value of $x$ is $g(x)=-13$?",
      steps: [
        "Set the output equal to $-13$: $-3x+8=-13$.",
        "Subtract 8 from both sides: $-3x=-21$.",
        "Divide both sides by $-3$: $x=7$.",
        "Check: $g(7)=-3\\cdot 7+8=-13$.",
      ],
      answer: "$7$",
    },
    methodTitle: "Substitute, or set equal and solve",
    methodText: [
      "Evaluation goes from an input to an output: replace $x$ and simplify. Finding an input goes the other way: the output is known, so you solve an equation.",
      "With a fractional input or coefficient, multiply first and cancel the denominator before adding the constant. " +
        entry,
    ],
    formal:
      "For $f(x)=mx+b$, $f(a)=ma+b$. The input for output $v$ is $x=\\frac{v-b}{m}$ when $m\\ne0$. For $f(x)=px+c$ with unknown $c$ and $f(a)=v$, $c=v-pa$.",
    pitfalls: [
      "Do not multiply $f$ by the input: $f(5)$ is not $f\\cdot 5$.",
      "Keep a negative input in parentheses so the sign is multiplied too.",
    ],
    parentGuide:
      "Ask your learner to say in words what $f(5)=20$ means: when the input is 5, the output is 20.",
  },
  {
    id: "sat-fn-line-equation-choice",
    title: "Choose a line's equation from its slope and a point",
    summary:
      "Use y = mx + b: the slope is m, and substituting any point on the line gives the constant b.",
    objectives: [
      "Write the slope-intercept equation of a line from its slope and a point, including a fractional or negative slope.",
      "Translate a constant rate and one later value in context into an equation.",
    ],
    intuition:
      "A line is the graph of $y=mx+b$. The slope $m$ is the change in $y$ for each increase of 1 in $x$, and $b$ is the value of $y$ when $x=0$. If a point is not on the $y$-axis, its coordinates still make the equation true, which determines $b$.",
    terms: [
      ["slope", "The constant change in $y$ per 1 unit increase in $x$."],
      [
        "$y$-intercept",
        "The value of $y$ when $x=0$; the point where the line crosses the $y$-axis.",
      ],
    ],
    method: [
      "Write $y=mx+b$ with the given slope $m$.",
      "If the point is $(0,b)$, read $b$ directly. Otherwise substitute the point's $x$ and $y$ and solve $y=mx+b$ for $b$.",
      "In a context, the rate per unit is the slope, and $x$ is the number of units. Check the equation against the given point.",
    ],
    watch:
      "A point such as $(4,9)$ is not the intercept unless its $x$-coordinate is 0. Compute $b=y-mx$ and keep the sign of $m$.",
    principle:
      "A nonvertical line with slope $m$ through $(x_0,y_0)$ has equation $y=mx+(y_0-mx_0)$, because the point satisfies it and the slope is $m$.",
    example: {
      prompt:
        "A line has slope $-\\frac{2}{3}$ and passes through $(6,1)$. What is its equation?",
      steps: [
        "Write $y=-\\frac{2}{3}x+b$.",
        "Substitute $(6,1)$: $1=-\\frac{2}{3}\\cdot 6+b=-4+b$.",
        "So $b=5$.",
        "The equation is $y=-\\frac{2}{3}x+5$.",
      ],
      answer: "$y=-\\frac{2}{3}x+5$",
    },
    methodTitle: "Find b from the point",
    methodText: [
      "Rearranged, $b=y-mx$. For a point $(x_0,y_0)$ this is $y_0-mx_0$: subtract the slope term from the $y$-value.",
      "Test the finished equation: substituting the given point should make both sides equal.",
    ],
    formal:
      "If $(x_0,y_0)$ lies on $y=mx+b$ then $y_0=mx_0+b$, so $b=y_0-mx_0$. Two lines with the same slope and a common point are the same line.",
    pitfalls: [
      "Do not use the point's $y$-value as $b$ unless its $x$-value is 0.",
      "Do not swap the slope and the intercept.",
    ],
    parentGuide:
      "Ask your learner to substitute the point back into their equation to check it.",
  },
  {
    id: "sat-fn-constraint-choice",
    title: "Choose a two-variable equation for a total",
    summary:
      "Multiply each count by its own rate or price, add the products, and set the sum equal to the total.",
    objectives: [
      "Write ax + by = c for a total made of two kinds of items, trips or scores.",
      "Choose the equation of a full load from its two extreme cases by testing points.",
    ],
    intuition:
      "A total is built by adding contributions. If each small item costs $a$ and you buy $x$ of them, they contribute $ax$. Two kinds of items contribute $ax$ and $by$, and together they make the total $c$. Distance works the same way: speed times time.",
    terms: [
      [
        "rate",
        "An amount per one unit, such as dollars per item or kilometers per hour.",
      ],
      [
        "two-variable equation",
        "An equation with two unknowns, such as $ax+by=c$.",
      ],
    ],
    method: [
      "Name the two counts or times as $x$ and $y$.",
      "Write each contribution as rate times count, and add them to equal the total.",
      "If the situation gives only extreme cases, test each choice at those two points; the equation must hold at both.",
    ],
    watch:
      "Each rate multiplies its own count. Dividing a count by a rate answers a different question: how many units the rate covers.",
    principle:
      "A total is the sum of the contributions of its parts. With rates $a$ and $b$ and counts $x$ and $y$, the total is $ax+by$.",
    example: {
      prompt:
        "A bakery sells muffins for 3 dollars and loaves for 7 dollars. Sales were 91 dollars from $x$ muffins and $y$ loaves. Which equation fits?",
      steps: [
        "Muffins contribute $3x$ dollars and loaves $7y$ dollars.",
        "The contributions add to the total: $3x+7y=91$.",
      ],
      answer: "$3x+7y=91$",
    },
    methodTitle: "Rate times count, then add",
    methodText: [
      "Check units: a price in dollars per item times a count of items gives dollars, the unit of the total.",
      "For a full load described by two extreme cases, the equation $qx+py=pq$ holds at $(p,0)$ and $(0,q)$, and a line through two points is unique.",
    ],
    formal:
      "The line through $(p,0)$ and $(0,q)$ has equation $\\frac{x}{p}+\\frac{y}{q}=1$, which is $qx+py=pq$ after multiplying by $pq$.",
    pitfalls: [
      "Match each rate to its own variable.",
      "Add the contributions; do not multiply the two rates together.",
    ],
    parentGuide:
      "Ask your learner what the unit of each term is and whether the terms can be added.",
  },
  {
    id: "sat-fn-exponential-choice",
    title: "Choose an exponential model",
    summary:
      "Find the factor the quantity is multiplied by in each unit of time, then write start times factor to the power of time.",
    objectives: [
      "Convert a percent increase, a period of several years, or a later value into the correct growth factor.",
      "Write the model so that its exponent counts the right number of multiplications.",
    ],
    intuition:
      "An exponential model multiplies by the same factor each step. If a quantity grows by 20% each hour, it becomes 120% of itself, so the factor is 1.2. If it doubles every 3 years, the factor 2 is used once per 3 years, so after $t$ years it is used $\\frac{t}{3}$ times.",
    terms: [
      [
        "growth factor",
        "The number each value is multiplied by to get the next value.",
      ],
      ["period", "The length of time over which the factor is applied once."],
    ],
    method: [
      "Convert the change to a factor: increase by $p$% gives $1+\\frac{p}{100}$.",
      "If the factor applies over a period of $k$ units, use the exponent $\\frac{t}{k}$.",
      "If a later value is given, divide it by the start and take the root that matches the number of steps. Then test the model at the given values.",
    ],
    watch:
      "Test the model at $t=0$ and at one given value. An exponent that is off by one, or a base that is only the rate, fails at once.",
    principle:
      "If $y_0$ is multiplied by $b$ for each unit of time, then after $t$ units it is $y_0b^{t}$. If $b$ applies once per $k$ units, the value is $y_0b^{t/k}$.",
    example: {
      prompt:
        "A population starts at 400 and increases by 150% each year. Which function gives it after $t$ years?",
      steps: [
        "The increase is 150% of the current amount, so the new amount is 100% + 150% = 250% of the old.",
        "The factor is 2.5.",
        "$P(t)=400\\cdot 2.5^{t}$.",
      ],
      answer: "$P(t)=400\\cdot 2.5^{t}$",
    },
    methodTitle: "Factor, period, exponent",
    methodText: [
      "Decide the factor first, then the exponent. A factor greater than 1 means growth; a factor between 0 and 1 means decay.",
      "When the start is not the value at $t=0$, as for rounds numbered from 1, shift the exponent so that the first value comes out right.",
    ],
    formal:
      "If values at consecutive integers have a constant ratio $b$, then $f(x)=f(0)b^{x}$. If $f(n)=y_0b^{n}$, then $b=\\left(\\frac{f(n)}{y_0}\\right)^{1/n}$ for $b>0$.",
    pitfalls: [
      "A 150% increase is a factor of 2.5, not 1.5.",
      "Doubling every 3 years is not doubling every year.",
    ],
    parentGuide:
      "Ask your learner to compute the first two values from their function and compare them with the story.",
  },
  {
    id: "sat-fn-exponential-numeric",
    title: "Enter an exponential value",
    summary:
      "Undo repeated multiplication by dividing, or find the base with a root, then use the same factor once more.",
    objectives: [
      "Find a starting amount from a later amount after several doubling or tripling periods.",
      "Recover a base from one output and use it to find the next output.",
    ],
    intuition:
      "If an amount doubles every 3 years, then after 12 years it has doubled 4 times, so it is 16 times the start. Going back to the start means dividing by 16. If $f(x)=a\\cdot b^{x}$, moving the input up by 1 multiplies the output by $b$.",
    terms: [
      [
        "base",
        "The number $b$ in $a\\cdot b^{x}$ that multiplies the output for each increase of 1 in $x$.",
      ],
    ],
    method: [
      "Count the periods: elapsed time divided by the period length.",
      "Divide the later amount by the factor raised to the number of periods to get the start.",
      "To find a base, divide the output by $a$ and take the matching root; the next output is the known output times $b$. " +
        entry,
    ],
    watch: "Divide by the factor once for each period, not once per year.",
    principle:
      "If an amount is multiplied by $b$ in each of $m$ periods, then later $=$ start $\\times b^{m}$, so start $=$ later $\\div\\, b^{m}$.",
    example: {
      prompt: "For $f(x)=2\\cdot b^{x}$ with $b>0$, $f(3)=54$. What is $f(4)$?",
      steps: [
        "$2b^{3}=54$, so $b^{3}=27$ and $b=3$.",
        "Increasing the input by 1 multiplies the output by $b$.",
        "$f(4)=54\\cdot 3=162$.",
      ],
      answer: "$162$",
    },
    methodTitle: "Periods and powers",
    methodText: [
      "Write the relationship as an equation with one unknown: start times $b^{m}$ equals later. Then divide.",
      "You never need a calculator: the numbers are chosen so each root and power is a small whole number.",
    ],
    formal:
      "For $f(x)=ab^{x}$ with $b>0$, $f(x+1)=bf(x)$. From $f(n)=v$, $b=\\left(\\frac{v}{a}\\right)^{1/n}$ and $f(n+1)=vb$.",
    pitfalls: [
      "Do not multiply when you are asked for the earlier amount.",
      "A cube root, not a square root, matches three steps.",
    ],
    parentGuide:
      "Ask your learner how many times the amount doubled and how they know.",
  },
  {
    id: "sat-fn-related-value",
    title: "Enter the value of a related expression",
    summary:
      "Look for the asked expression inside the equation, as a factor, a multiple or a group, and find its value without solving for each variable.",
    objectives: [
      "Rewrite an equation so that the requested expression appears, then read its value.",
      "Treat a repeated group as one unknown, or scale a whole equation, instead of solving for the variable.",
    ],
    intuition:
      "A question may ask for $x-4$ when the equation is $5x-20=35$. Since $5x-20=5(x-4)$, the equation already says $5(x-4)=35$, so $x-4=7$ without finding $x$. Equations stay true when both sides are multiplied or divided by the same nonzero number.",
    terms: [
      [
        "related expression",
        "A combination of the variables, such as $x-4$ or $3x+4y$, whose value the question asks for.",
      ],
      [
        "group",
        "An expression in parentheses that is treated as one quantity.",
      ],
    ],
    method: [
      "Compare the asked expression with the equation. Factor a common number out of the equation, or scale the whole equation, so the asked expression appears.",
      "If a group appears on both sides, name it $u$, solve for $u$, and stop.",
      "For a ratio $\\frac{x}{y}$, the ratio $\\frac{y}{x}$ is its reciprocal. " +
        entry,
    ],
    watch:
      "Scale the right-hand side by the same number as the left. The asked expression may equal a half or a negative multiple of the equation.",
    principle:
      "If $A=B$ and $k\\ne0$, then $kA=kB$ and $\\frac{A}{k}=\\frac{B}{k}$. If $A$ is a multiple of an expression $E$, say $A=kE$, then $E=\\frac{B}{k}$.",
    example: {
      prompt: "If $6x+8y=22$, what is the value of $3x+4y$?",
      steps: [
        "Each term of $3x+4y$ is half of the same term in $6x+8y$.",
        "So $3x+4y=\\frac{1}{2}(6x+8y)$.",
        "Half of 22 is 11, so $3x+4y=11$.",
      ],
      answer: "$11$",
    },
    methodTitle: "Match the expression, then scale",
    methodText: [
      "Write the asked expression beside the equation and find the multiplier that turns one into the other.",
      "If you solved for each variable and got the right value, the structural way is the same result with fewer steps. Use it to check.",
    ],
    formal:
      "If $L=R$ and $L=kE$ with $k\\ne0$, then $E=\\frac{R}{k}$. For $\\frac{x}{y}=c$ with $c\\ne0$, $\\frac{y}{x}=\\frac{1}{c}$.",
    pitfalls: [
      "Do not solve for $x$ if the asked expression is already in the equation.",
      "Divide the right side too when you divide the left side.",
    ],
    parentGuide:
      "Ask your learner which part of the equation looks like the thing being asked for.",
  },
];

const stripFormat = (e: Entry): ProblemMethod => ({
  goal: e.summary,
  intuition: e.intuition,
  terms: e.terms,
  method: e.method,
  watch: e.watch,
});

export const satFunctionFormsMethods: Record<string, ProblemMethod> =
  Object.fromEntries(entries.map((e) => [e.id, stripFormat(e)]));

export const satFunctionFormsPrinciples: Record<string, string> =
  Object.fromEntries(entries.map((e) => [e.id, e.principle]));

export const satFunctionFormsLessons: Lesson[] = entries.map((e) => ({
  id: e.id,
  title: e.title,
  summary: e.summary,
  templateIds: [e.id],
  objectives: [...e.objectives],
  sections: [
    {
      stage: "intuition",
      title: "What the question asks",
      paragraphs: [e.intuition],
    },
  ],
  workedExample: e.example,
  closingSections: [
    { stage: "method", title: e.methodTitle, paragraphs: e.methodText },
    { stage: "formal", title: "Why the method works", paragraphs: [e.formal] },
  ],
  pitfalls: e.pitfalls,
  parentGuide: e.parentGuide,
}));
