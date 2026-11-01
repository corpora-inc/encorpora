import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const entry =
  "Type a whole number, a negative number, a fraction such as 7/2, or a decimal such as 3.5; equivalent exact forms are accepted.";

type Entry = {
  id: string;
  title: string;
  /** The practice task, when the summary is longer than a goal line. */
  goal?: string;
  summary: string;
  objectives: [string, string];
  intuition: string;
  terms: MethodTerm[];
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
    id: "sat-entry-fn-linear-notation",
    title: "Linear functions in function notation",
    goal: "Read $f(a)$ as the output for input $a$: put $a$ in to find it, or set $f(x)$ equal to a value and solve for the input.",
    summary:
      "A function is a rule that turns each input (the number you put in) into exactly one output (the number you get back). We write $f(x)$, read “$f$ of $x$”, for the output when the input is $x$. So $f(5)$ is the output for the input 5. To find it, put 5 in place of $x$. To find which input gives a certain output, set the rule equal to that output and find the value of $x$ that makes it true.",
    objectives: [
      "Find the output of a straight-line function written as $f(x)$, including for a negative or fraction input.",
      "Find the input for a given output, or a missing plain number in the rule, by writing and solving an equation.",
    ],
    intuition:
      "A function is a rule that gives exactly one output for each input. The symbol $f(x)$, read “$f$ of $x$”, names the output for input $x$. It does not mean $f$ times $x$. So $f(5)$ is the output when the input is 5. In a real situation, the rule is often a fixed amount plus a rate times the input, such as a fee plus a charge for each hour. That kind of rule, like $f(x) = 3x + 8$, makes a straight-line graph, so it is called linear.",
    terms: ["input", "output", "constant-term"],
    method: [
      "To find $f(a)$, replace every $x$ in the rule with $a$ and work it out. Put a negative input in parentheses.",
      "To find the input for an output $v$, write $f(x) = v$ and solve the equation for $x$.",
      "To find a missing plain number in the rule, put in the known input and output and solve for that number. " +
        entry,
    ],
    watch:
      "Know which number is unknown. If the output is given and the input is not, solve for the input. If both an input and its output are given, put both into the rule to find a missing number in it.",
    principle:
      "For a function $f$ and an allowed input $a$, $f(a)$ is the one output given to $a$. $f(a) = v$ is true exactly when putting $a$ in place of $x$ in the rule gives $v$.",
    example: {
      prompt:
        "The function $g$ is defined by $g(x)=-3x+8$. For what value of $x$ is $g(x)=-13$?",
      steps: [
        "The question gives the output, $-13$, and asks for the input. So set the rule equal to $-13$: $-3x+8=-13$.",
        "Subtract 8 from both sides to undo the $+ 8$: $-3x=-21$.",
        "Divide both sides by $-3$ to undo the multiplying: $x=7$.",
        "Check by putting 7 back into the rule: $g(7)=-3\\cdot 7+8=-21+8=-13$.",
      ],
      answer: "$7$",
    },
    methodTitle: "Substitute, or set equal and solve",
    methodText: [
      "Finding $f(a)$ goes from an input to an output: replace $x$ and work it out. Finding an input goes the other way: the output is known, so you solve an equation.",
      "With a fraction input or a fraction in the rule, multiply first, cancelling the bottom number when you can, then add the plain number. " +
        entry,
    ],
    formal:
      "For $f(x) = mx + b$, $f(a) = ma + b$. The input for output $v$ is $x = \\frac{v - b}{m}$ when $m \\ne 0$. For $f(x) = px + c$ with unknown $c$ and $f(a) = v$, $c = v - pa$.",
    pitfalls: [
      "Do not multiply $f$ by the input. $f(5)$ is not $f$ times 5; it is the output for the input 5.",
      "Keep a negative input in parentheses so its sign is multiplied too.",
    ],
    parentGuide:
      "Ask your learner to say in words what $f(5)=20$ means: when the input is 5, the output is 20.",
  },
  {
    id: "sat-fn-line-equation-choice",
    title: "Choose a line's equation from its slope and a point",
    goal: "Choose the equation $y = mx + b$ of a line from its slope $m$ and one point on it.",
    summary:
      "A point $(x, y)$ is $x$ across and $y$ up. A straight line that is not vertical can be written $y = mx + b$, like $y = 2x + 3$. The slope $m$ (here 2) says how steep it is: how much $y$ changes when $x$ goes up by 1. The number $b$ (here 3) is where the line crosses the up-and-down $y$-axis. If you know the slope and one point on the line, put the point's numbers into the equation to find $b$.",
    objectives: [
      "Write the equation $y = mx + b$ of a line from its slope and a point, including a fraction or negative slope.",
      "Turn a steady rate and one later value in a real situation into an equation.",
    ],
    intuition:
      "A point is written $(x, y)$: across, then up. A line that is not vertical is the graph of $y = mx + b$, where $mx$ means $m$ times $x$. The slope $m$ is the change in $y$ for each increase of 1 in $x$. The number $b$ is the value of $y$ when $x = 0$, where the line crosses the $y$-axis; it is called the $y$-intercept. Any point on the line makes the equation true, even one not on the $y$-axis. So its numbers let you find $b$.",
    terms: ["slope", "y-intercept"],
    method: [
      "Write $y = mx + b$ with the given slope $m$.",
      "If the point is $(0, b)$, read $b$ directly. Otherwise put in the point's $x$ and $y$, and solve $y = mx + b$ for $b$.",
      "In a real situation, the rate for each unit is the slope, and $x$ is the number of units. Check the equation with the given point.",
    ],
    watch:
      "A point such as $(4, 9)$ is not where the line crosses the $y$-axis unless its $x$ is 0. Work out $b = y - mx$, keeping the sign of $m$.",
    principle:
      "A line that is not vertical, with slope $m$, through the point $(x_0, y_0)$, has equation $y = mx + (y_0 - mx_0)$. The point makes it true, and its slope is $m$.",
    example: {
      prompt:
        "A line has slope $-\\frac{2}{3}$ and passes through $(6,1)$. What is its equation?",
      steps: [
        "The slope is given, so write $y=-\\frac{2}{3}x+b$. Only $b$ is unknown.",
        "The point $(6,1)$ is on the line, so its numbers make the equation true. Put $x = 6$ and $y = 1$ in: $1=-\\frac{2}{3}\\cdot 6+b=-4+b$.",
        "Add 4 to both sides to get $b$ alone: $b=5$.",
        "Put $b$ back in. The equation is $y=-\\frac{2}{3}x+5$.",
      ],
      answer: "$y=-\\frac{2}{3}x+5$",
    },
    methodTitle: "Find the constant from the point",
    methodText: [
      "Rearranged, $b = y - mx$. For a point $(x_0, y_0)$ this is $y_0 - mx_0$: subtract the slope times $x$ from the $y$ value.",
      "Test the finished equation: putting in the given point should make both sides equal.",
    ],
    formal:
      "If $(x_0, y_0)$ lies on $y = mx + b$, then $y_0 = mx_0 + b$, so $b = y_0 - mx_0$. Two lines with the same slope and a shared point are the same line.",
    pitfalls: [
      "Do not use the point's $y$ value as $b$ unless its $x$ value is 0.",
      "Do not swap the slope and $b$: the slope multiplies $x$.",
    ],
    parentGuide:
      "Ask your learner to substitute the point back into their equation to check it.",
  },
  {
    id: "sat-fn-constraint-choice",
    title: "Choose a two-variable equation for a total",
    goal: "Choose an equation like $3x + 7y = 91$ for a total made of two kinds of items: rate times count for each, added up.",
    summary:
      "Many totals come from two kinds of things, like muffins at 3 dollars and loaves at 7 dollars. Call the counts $x$ and $y$. Each kind adds its price times its count: $3x$ and $7y$, where $3x$ means 3 times $x$. Add them and set the result equal to the total: $3x + 7y = 91$.",
    objectives: [
      "Write $ax + by = c$ for a total made of two kinds of items, trips or scores.",
      "Choose the equation of a full load from its two extreme cases, by testing points.",
    ],
    intuition:
      "A total is built by adding parts. If each small item costs $a$ dollars and you buy $x$ of them, they add $ax$ dollars, meaning $a$ times $x$. Two kinds of items add $ax$ and $by$, and together they make the total $c$: $ax + by = c$. An equation like this, with two unknown letters, is called a two-variable equation. Distance works the same way: speed times time for each part of a trip.",
    terms: [
      "rate",
      [
        "equation",
        "A two-variable equation, such as $ax + by = c$, has two unknowns.",
      ],
    ],
    method: [
      "Name the two counts or times $x$ and $y$.",
      "Write each part as rate times count, and add the parts to equal the total.",
      "If the story gives only the two extreme cases (all of one kind, or all of the other), test each choice at those two points. Of the straight-line choices, the right one is true at both.",
    ],
    watch:
      "Each rate multiplies its own count. Dividing a count by a rate answers a different question.",
    principle:
      "A total is the sum of the amounts from its parts. With rates $a$ and $b$ and counts $x$ and $y$, the total is $ax + by$.",
    example: {
      prompt:
        "A bakery sells muffins for 3 dollars and loaves for 7 dollars. Sales were 91 dollars from $x$ muffins and $y$ loaves. Which equation fits?",
      steps: [
        "Each kind adds its price times its count. Muffins add $3x$ dollars, and loaves add $7y$ dollars.",
        "The two parts add up to the total sales, so $3x+7y=91$.",
      ],
      answer: "$3x+7y=91$",
    },
    methodTitle: "Rate times count, then add",
    methodText: [
      "Check units: a price in dollars per item times a number of items gives dollars, the unit of the total.",
      "Say a full load is $p$ items of one kind alone, or $q$ items of the other kind alone. Then $qx + py = pq$ is true at $(p, 0)$ and at $(0, q)$. Only one line passes through two points, so that is the equation.",
    ],
    formal:
      "The line through $(p, 0)$ and $(0, q)$, with $p$ and $q$ not 0, has equation $\\frac{x}{p} + \\frac{y}{q} = 1$. Multiplying both sides by $pq$ gives $qx + py = pq$.",
    pitfalls: [
      "Match each rate to its own letter.",
      "Add the parts; do not multiply the two rates together.",
    ],
    parentGuide:
      "Ask your learner what the unit of each term is and whether the terms can be added.",
  },
  {
    id: "sat-fn-exponential-choice",
    title: "Choose an exponential model",
    goal: "Choose an exponential model: find the number the amount is multiplied by each time, then write start times that number to a power.",
    summary:
      "Some amounts grow by multiplying, not adding. A percent is a number out of 100. If a population grows by 20% each year, it keeps its 100% and adds 20%, so each year it is 120%, or 1.2 times, the year before. The number it is multiplied by, here 1.2, is called the growth factor. After $t$ whole years the amount is the start times $1.2^t$, which means 1.2 multiplied by itself $t$ times.",
    objectives: [
      "Turn a percent increase, a period of several years, or a later value into the right growth factor.",
      "Write the model so its exponent (the small raised number) counts the right number of multiplications.",
    ],
    intuition:
      "A model is an equation that describes a real situation. An exponential model multiplies by the same number, called the growth factor, at each step. In $b^t$, the small raised $t$ is the exponent: it says how many times to multiply by $b$. If an amount grows by 20% each hour, it becomes 120% of itself, so the factor is 1.2. If it doubles every 3 years, the factor 2 is used once per 3 years. So after $t$ years it is used $\\frac{t}{3}$ times.",
    terms: [
      "growth-factor",
      [
        "growth-factor",
        "Here a period is the length of time over which the factor is applied once.",
      ],
    ],
    method: [
      "Turn the change into a factor: an increase of $p$% gives $1 + \\frac{p}{100}$.",
      "If the factor applies once every $k$ units of time, use the exponent $\\frac{t}{k}$.",
      "If a later value is given, divide it by the start and take the root that matches the number of steps. Then test the model at the given values.",
    ],
    watch:
      "Test the model at $t = 0$ and at one given value. An exponent that is off by one, or a factor that leaves out the 1 (like 0.2 for a 20% rise), fails right away.",
    principle:
      "If a starting amount $y_0$ is multiplied by $b$ in each unit of time, then after $t$ units it is $y_0b^{t}$. If $b$ applies once every $k$ units, the amount is $y_0b^{t/k}$.",
    example: {
      prompt:
        "A population starts at 400 and increases by 150% each year. Which function gives it after $t$ years?",
      steps: [
        "An increase of 150% adds 150% of the current amount to the 100% already there. So the new amount is 100% + 150% = 250% of the old.",
        "250% means 250 hundredths, which is 2.5, so each year the population is multiplied by the factor 2.5.",
        "Start at 400 and multiply by 2.5 once for each year, so after $t$ years: $P(t)=400\\cdot 2.5^{t}$.",
      ],
      answer: "$P(t)=400\\cdot 2.5^{t}$",
    },
    methodTitle: "Factor, period, exponent",
    methodText: [
      "Decide the factor first, then the exponent. A factor greater than 1 means growth. A factor between 0 and 1 means decay, a shrinking amount.",
      "When the first value is not at $t = 0$, as for rounds numbered from 1, shift the exponent so the first value comes out right.",
    ],
    formal:
      "Say the inputs are 0, 1, 2 and so on, and each output (the result) is $b$ times the one before. Then $f(x) = f(0)b^{x}$ for each of them. If $f(n) = y_0b^{n}$ with $b > 0$, $y_0 \\ne 0$ and $n > 0$, then $b = \\left(\\frac{f(n)}{y_0}\\right)^{1/n}$.",
    pitfalls: [
      "A 150% increase is a factor of 2.5, not 1.5.",
      "Doubling every 3 years is not doubling every year.",
    ],
    parentGuide:
      "Ask your learner to compute the first two values from their function and compare them with the story.",
  },
  {
    id: "sat-entry-fn-exponential",
    title: "Enter an exponential value",
    goal: "Undo repeated multiplying by dividing, or find the growth factor with a root, then use it once more.",
    summary:
      "Say an amount doubles every 3 years. Each 3 years is one period, and each period multiplies the amount by the same number, here 2. After 12 years there are 4 periods, so it is $2 \\times 2 \\times 2 \\times 2 = 16$ times the start. To go back to the start, divide by 16. To go one period forward, multiply by 2 once more. Amounts that change like this are called exponential.",
    objectives: [
      "Find a starting amount from a later amount after several doubling or tripling periods.",
      "Find the growth factor from one output, and use it to find the next output.",
    ],
    intuition:
      "In $b^x$, the small raised $x$ is the exponent: $3^2 = 3 \\times 3 = 9$. A function, a rule that gives one output for each input, written $f(x) = a \\cdot b^x$ is called exponential. Each time the input goes up by 1, the output is multiplied by $b$, called the base. If an amount doubles every 3 years, then after 12 years it has doubled 4 times, so it is 16 times the start. Going back to the start means dividing by 16.",
    terms: [
      [
        "base-exponent",
        "In $a \\cdot b^{x}$, the base $b$ multiplies the output each time $x$ increases by 1.",
      ],
    ],
    method: [
      "Count the periods: the time that passed divided by the length of one period.",
      "Divide the later amount by the factor multiplied by itself once per period. That gives the start.",
      "To find the base, divide the output by $a$ and take the matching root. The next output is the known output times $b$. " +
        entry,
    ],
    watch: "Divide by the factor once for each period, not once per year.",
    principle:
      "If an amount is multiplied by $b$ in each of $m$ periods, then later $=$ start $\\times b^{m}$. So start $=$ later $\\div\\, b^{m}$.",
    example: {
      prompt: "For $f(x)=2\\cdot b^{x}$ with $b>0$, $f(3)=54$. What is $f(4)$?",
      steps: [
        "Put in the known output: $2b^{3}=54$. Divide both sides by 2: $b^{3}=27$. The number that times itself 3 times is 27 is 3, so $b=3$.",
        "Going from input 3 to input 4 raises the input by 1, which multiplies the output by $b$ once more.",
        "So $f(4)=54\\cdot 3=162$.",
      ],
      answer: "$162$",
    },
    methodTitle: "Periods and powers",
    methodText: [
      "Write the relationship as an equation with one unknown: start times $b^{m}$ equals later. Then divide.",
      "You do not need a calculator: the numbers are chosen to work out to small, easy numbers.",
    ],
    formal:
      "For $f(x) = ab^{x}$ with $b > 0$, $f(x + 1) = bf(x)$. From $f(n) = v$ with $a \\ne 0$ and $n > 0$, $b = \\left(\\frac{v}{a}\\right)^{1/n}$ and $f(n + 1) = vb$.",
    pitfalls: [
      "Do not multiply when you are asked for the earlier amount.",
      "Three steps need a cube root (the number that times itself 3 times gives the value), not a square root.",
    ],
    parentGuide:
      "Ask your learner how many times the amount doubled and how they know.",
  },
  {
    id: "sat-entry-fn-related-value",
    title: "Enter the value of a related expression",
    goal: "Find the value of an expression like $3x + 4y$ by spotting it inside the equation, without solving for each letter.",
    summary:
      "An expression is a math phrase made of numbers, letters and signs such as + and −, like $3x + 4y$. Sometimes a question asks for the value of a whole expression, not of $x$ or $y$. Look for it inside the equation you are given. If $6x + 8y = 22$, then $3x + 4y$ is exactly half of the left side. So it equals half of 22, which is 11.",
    objectives: [
      "Rewrite an equation so the asked-for expression appears, then read its value.",
      "Treat a repeated group as one unknown, or multiply a whole equation by a number, instead of solving for each letter.",
    ],
    intuition:
      "An expression is a math phrase made of numbers, letters and operations, such as $x - 4$. A question may ask for $x - 4$ when the equation is $5x - 20 = 35$. Since $5x - 20 = 5(x - 4)$, the equation already says $5(x - 4) = 35$. So $x - 4 = 7$, without finding $x$. This works because an equation stays true when both sides are multiplied or divided by the same number other than 0.",
    terms: [
      [
        "expression",
        "Here, a combination of the variables, such as $3x + 4y$, whose value the question asks for.",
      ],
      "parentheses",
    ],
    method: [
      "Compare the asked-for expression with the equation. Take a common number out of the equation, or multiply the whole equation, so the expression appears.",
      "If a group in parentheses (the curved brackets) appears on both sides, call it $u$, solve for $u$, and stop.",
      "For a ratio $\\frac{x}{y}$ with $x$ and $y$ not 0, the ratio $\\frac{y}{x}$ is its reciprocal, the fraction flipped over. " +
        entry,
    ],
    watch:
      "Multiply or divide the right side by the same number as the left. The asked-for expression may be a half, or a negative multiple, of one side.",
    principle:
      "If $A = B$ and $k \\ne 0$, then $kA = kB$ and $\\frac{A}{k} = \\frac{B}{k}$. If $A$ is a multiple of an expression $E$, say $A = kE$, then $E = \\frac{B}{k}$.",
    example: {
      prompt: "If $6x+8y=22$, what is the value of $3x+4y$?",
      steps: [
        "Compare the two expressions term by term. $3x$ is half of $6x$, and $4y$ is half of $8y$.",
        "So the whole expression is half of the left side: $3x+4y=\\frac{1}{2}(6x+8y)$.",
        "The left side equals 22, so half of it is half of 22: $3x+4y=11$.",
      ],
      answer: "$11$",
    },
    methodTitle: "Match the expression, then scale",
    methodText: [
      "Write the asked-for expression beside the equation, and find the number that turns one into the other.",
      "When you also know each letter's value, putting them in is a good check.",
    ],
    formal:
      "If $L = R$ and $L = kE$ with $k \\ne 0$, then $E = \\frac{R}{k}$. For $\\frac{x}{y} = c$ with $c \\ne 0$, $\\frac{y}{x} = \\frac{1}{c}$.",
    pitfalls: [
      "Do not solve for $x$ if the asked-for expression is already in the equation.",
      "Divide the right side too when you divide the left side.",
    ],
    parentGuide:
      "Ask your learner which part of the equation looks like the thing being asked for.",
  },
];

/** How every SAT function lesson and method reads ambiguous glossary words. */
const senses = {
  base: "base-exponent",
  root: "root-radical",
  roots: "root-radical",
  unit: "unit",
  units: "unit",
  multiple: "multiple",
  ratio: "ratio",
  balance: "balance-account",
  model: "model",
} as const;
const noLink = [
  "whole",
  "part",
  "parts",
  "change",
  "changes",
  "opposite",
  "mean",
  "means",
  "rule",
  "rules",
  "leaves",
  "kind",
  "kinds",
  "factor",
  "period",
  "periods",
  "population",
  "certain",
  "side",
  "sides",
  "left side",
  "right side",
  "term",
  "terms",
];

const stripFormat = (e: Entry): ProblemMethod => ({
  goal: e.goal ?? e.summary,
  senses,
  noLink,
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
  senses,
  noLink,
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
