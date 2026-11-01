import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const sequenceSenses = {
  term: "term-sequence",
  terms: "term-sequence",
  product: "product-multiply",
  factor: "factor-number",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};

const sequenceFunctionMethod: ProblemMethod = {
  goal: "Treat a sequence rule as a function of the position $n$: name its inputs, find $a(n)$, and decide which inputs have a term.",
  intuition:
    "A sequence is a list of numbers in order. Each number in it is called a term, and its place in the list is its position: first, second, third and so on. We write $a(n)$, read “$a$ of $n$”, for the term in position $n$. This makes the list a function: a rule that gives one result for each allowed starting number. The starting number is called the input, and the result is called the output. The input is the position and the output is the term. The allowed inputs are called the domain. Whole numbers are 0, 1, 2, 3 and so on. Positions are the whole numbers from 1 up, so there is no term at position 2.5, 0 or $-3$.",
  terms: [
    [
      "domain",
      "For a sequence starting at position 1, it is the positive integers 1, 2, 3, …",
    ],
    [
      "term-sequence",
      "Written $a(n)$ and read “$a$ of $n$”, it is the term in position $n$.",
    ],
    "discrete-graph",
  ],
  senses: sequenceSenses,
  noLink: [
    "part",
    "parts",
    "whole",
    "change",
    "changes",
    "leaves",
    "key",
    "jumps",
    "jump",
    "third",
    "mean",
    "means",
    "sort",
    "image",
    "images",
    "solid",
    "scales",
    "net",
    "inverse",
    "population",
    "more than",
    "period",
    "periods",
    "quarter",
    "quarters",
    "one quarter",
    "mirror image",
    "rule",
    "rules",
    "opposite",
    "opposites",
    "unit",
    "units",
    "average",
    "decreasing",
    "increasing",
    "model",
    "models",
    "pattern",
    "patterns",
  ],
  method: [
    "Read $n$ as a position. Only counting numbers from the first position on can be inputs.",
    "To find $a(k)$, put $k$ in place of $n$ in the rule. Work out $n - 1$ first, then the multiplying or the power.",
    "A number that is not a position, such as 2.5, 0 or $-3$, has no term, so $a$ is undefined there.",
    "To test whether a value is a term, work out the terms just before and just after it. It is a term only if some counting-number position gives it.",
  ],
  watch:
    "You can put 2.5 into the formula, but the list has no 2.5th term. So the graph is separate points, never a joined line or curve.",
};

const sequenceFunctionPrinciple =
  "A sequence is a function whose domain is a run of consecutive integers (numbers like 1, 2, 3 with no gaps), usually $1, 2, 3, \\ldots$. Its graph is the points $(n, a(n))$ for those integers only. An arithmetic rule $a(n) = a_1 + d(n - 1)$ gives points on a line. A geometric rule $a(n) = a_1 r^{n-1}$ gives terms that are multiplied by the same number $r$, called the ratio, at each step.";

const sequenceFunctionLesson: Lesson = {
  id: "sequence-as-function",
  title: "A sequence is a function of position",
  summary:
    "A sequence is a list of numbers in order, like 5, 8, 11, 14. Each number is called a term. Its place in the list, first, second, third and so on, is its position. We write $a(n)$, read “$a$ of $n$”, for the term in position $n$, so $a(1) = 5$ and $a(2) = 8$. Positions are counting numbers, so a list has no term at position 2.5.",
  templateIds: [
    "arithmetic-sequence-as-function",
    "geometric-sequence-as-function",
  ],
  senses: sequenceSenses,
  noLink: [
    "part",
    "parts",
    "whole",
    "change",
    "changes",
    "leaves",
    "key",
    "jumps",
    "jump",
    "third",
    "mean",
    "means",
    "sort",
    "image",
    "images",
    "solid",
    "scales",
    "net",
    "inverse",
    "population",
    "more than",
    "period",
    "periods",
    "quarter",
    "quarters",
    "one quarter",
    "mirror image",
    "rule",
    "rules",
    "opposite",
    "opposites",
    "unit",
    "units",
    "average",
    "decreasing",
    "increasing",
    "model",
    "models",
    "pattern",
    "patterns",
  ],
  objectives: [
    "Say which inputs a sequence allows, and explain why $a(2.5)$ is undefined.",
    "Find a term $a(n)$ from a rule written with $a(n)$.",
    "Describe the graph of a sequence as separate points, and decide whether a value is a term.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "A list is a function",
      paragraphs: [
        "In the list 5, 8, 11, 14, the number 5 is in position 1, 8 is in position 2, and 11 is in position 3. Write $a(n)$ for the term in position $n$. Then $a(1) = 5$ and $a(3) = 11$. The letter $n$ stands for a position.",
        "A function is a rule that gives exactly one result for each allowed starting number. The starting number is called the input, and the result is called the output. Here the input is the position and the output is the term in that position. So a sequence is a function.",
        "The allowed inputs are called the domain. If the list keeps going, its domain is the counting numbers $1, 2, 3, \\ldots$ (the three dots mean the list keeps going). There is no “2.5th” term, so $a(2.5)$ has no meaning. Positions 0 and $-3$ do not exist either.",
        "A rule can give any term directly. In $a(n) = 5 + 3(n - 1)$, the start is 5 and each step adds 3. The bracket $(n - 1)$ counts the steps taken since the first term, and $3(n - 1)$ means 3 times that count.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A sequence is defined by $a(n)=5+3(n-1)$ for $n=1,2,3,\\ldots$. Find $a(4)$, decide whether $a(2.5)$ is defined, and decide whether 10 is a term.",
    steps: [
      "Put 4 in place of $n$. First $n - 1 = 3$, so $a(4) = 5 + 3 \\times 3 = 5 + 9 = 14$.",
      "The domain is the counting numbers $1, 2, 3, \\ldots$. Since 2.5 is not a position, $a(2.5)$ is undefined, even though you could work out the formula.",
      "List the first terms: 5, 8, 11, 14. The value 10 falls between $a(2) = 8$ and $a(3) = 11$. The terms only go up, by 3 each step, so no later term can come back to 10.",
      "No counting number lies between positions 2 and 3, so 10 is not a term.",
    ],
    answer: "$a(4)=14$; $a(2.5)$ is undefined; 10 is not a term",
  },
  closingSections: [
    {
      stage: "method",
      title: "The graph is separate points",
      paragraphs: [
        "To graph a sequence, plot the points $(n, a(n))$: the position goes across and the term goes up. For the example the points are $(1, 5)$, $(2, 8)$, $(3, 11)$, $(4, 14)$ and so on.",
        "Only counting numbers are inputs, so there are no points between them. Do not join the points with a line. A graph made of separate points like this is called a discrete graph.",
        "In an arithmetic sequence, each step adds the same number, so the separate points lie along one straight line. In a geometric sequence, each step multiplies by the same number, called the ratio, so the points do not lie on one slanted line. With a positive ratio other than 1 they curve, and with a negative ratio they zigzag.",
      ],
    },
    {
      stage: "formal",
      title: "Sequences as functions on the integers",
      paragraphs: [
        "Integers are the whole numbers and their negatives. A sequence is a function $a$ whose domain is a run of consecutive integers, usually the positive integers $1, 2, 3, \\ldots$. The notation $a_n$ (the small $n$ is a subscript, a label) means the same as $a(n)$.",
        "A rule such as $a(n) = a_1 + d(n - 1)$ or $a(n) = a_1 r^{n-1}$ gives the output for every integer in the domain. Here $a_1$ is the first term, $d$ is the number added each step, and $r$ is the number multiplied each step. A number outside the domain is not an input. Putting it into the formula does not create a term.",
      ],
    },
  ],
  pitfalls: [
    "A sequence has terms only at counting-number positions. Do not treat its formula as working for every number.",
    "Work out $n - 1$ first. For $a(4)$, $n - 1 = 3$, not 4.",
    "Do not join the points of the graph with a line or curve.",
  ],
  parentGuide:
    "Ask whether the list has a term between the second and the third. Then use that answer to explain why the graph is separate points.",
};

const geometricSenses = {
  term: "term-sequence",
  terms: "term-sequence",
  product: "product-multiply",
  factor: "factor-number",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};

const geometricRuleFormsMethod: ProblemMethod = {
  goal: "Write a geometric sequence's step-by-step rule and its direct formula, from a rule, a description or two terms in a row.",
  intuition:
    "A sequence is a list of numbers in order, and each number is a term. In a geometric sequence, each term is the one before times the same number, called the common ratio $r$. We write $a_n$ for the term in position $n$, so $a_1$ is the first term. A recursive rule gives the first term and the step: $a_{n+1} = r a_n$ means the next term is $r$ times this one. An explicit rule, $a_n = a_1 r^{n-1}$, jumps straight to any position. Here $r^{n-1}$ means $n - 1$ copies of $r$ multiplied together, and $r^0 = 1$ when $r \\ne 0$.",
  terms: ["common-ratio", "recursive-rule", "explicit-rule"],
  senses: geometricSenses,
  noLink: [
    "part",
    "parts",
    "change",
    "changes",
    "leaves",
    "key",
    "jumps",
    "jump",
    "third",
    "mean",
    "means",
    "sort",
    "image",
    "images",
    "solid",
    "scales",
    "net",
    "inverse",
    "population",
    "whole",
    "more than",
    "period",
    "periods",
    "quarter",
    "quarters",
    "one quarter",
    "mirror image",
    "rule",
    "rules",
    "opposite",
    "opposites",
    "unit",
    "units",
    "average",
    "decreasing",
    "increasing",
    "model",
    "models",
    "pattern",
    "patterns",
  ],
  method: [
    "Find the first term $a_1$ and the common ratio $r$. From two terms in a row, $r$ is the later term divided by the earlier one (which must not be 0). Divide by $r$ to step back toward $a_1$.",
    "Recursive rule: state $a_1$, then $a_{n+1} = r a_n$.",
    "Explicit rule: $a_n = a_1 r^{n-1}$. The power is $n - 1$ because the first term has not been multiplied yet.",
    "Check by putting $n = 1$ and $n = 2$ into the rule you wrote.",
  ],
  watch:
    "The power is $n - 1$, not $n$. A term from the middle of the list is not $a_1$ unless it is said to be the first.",
};

const geometricRuleFormsPrinciple =
  "For a geometric sequence with first term $a_1$ and common ratio $r \\ne 0$ ($r$ not equal to 0), the recursive rule ($a_1$ given, $a_{n+1} = r a_n$) and the explicit rule $a_n = a_1 r^{n-1}$ give the same list for every position $n = 1, 2, 3, \\ldots$.";

const geometricRuleFormsLesson: Lesson = {
  id: "geometric-rule-forms",
  title: "Recursive and explicit rules for a geometric sequence",
  summary:
    "In the list 2, 6, 18, 54, each number is 3 times the one before. A list like this is called a geometric sequence, and the 3 is its common ratio. You can describe it step by step: start at 2 and multiply by 3 each time. Or you can give a formula that jumps straight to any position. Both descriptions come from the first number and the common ratio.",
  templateIds: ["geometric-rule-forms"],
  senses: geometricSenses,
  noLink: [
    "part",
    "parts",
    "change",
    "changes",
    "leaves",
    "key",
    "jumps",
    "jump",
    "third",
    "mean",
    "means",
    "sort",
    "image",
    "images",
    "solid",
    "scales",
    "net",
    "inverse",
    "population",
    "whole",
    "more than",
    "period",
    "periods",
    "quarter",
    "quarters",
    "one quarter",
    "mirror image",
    "rule",
    "rules",
    "opposite",
    "opposites",
    "unit",
    "units",
    "average",
    "decreasing",
    "increasing",
    "model",
    "models",
    "pattern",
    "patterns",
  ],
  objectives: [
    "Turn a step-by-step (recursive) rule into a direct (explicit) formula, and back again.",
    "Build either rule from a description, or from two terms that sit next to each other in the list.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Two ways to describe the same list",
      paragraphs: [
        "A sequence is a list of numbers in order. Each number in it is called a term. In 2, 6, 18, 54, each term is 3 times the one before. A sequence that multiplies by the same number each time is called geometric. That number, here 3, is called the common ratio.",
        "We name terms by position with a small label written low, called a subscript. $a_1$ is the first term, $a_2$ the second, and $a_n$ the term in position $n$. So $a_1 = 2$ and $a_3 = 18$.",
        "One description gives the start and the step: “start at 2 and multiply by 3 each time.” In symbols, $a_1 = 2$ and $a_{n+1} = 3a_n$. Here $a_{n+1}$ is the term right after $a_n$, and $3a_n$ means 3 times $a_n$. A rule that builds each term from the one before is called recursive.",
        "The other description jumps straight to any position: $a_n = 2 \\times 3^{n-1}$. The raised $n - 1$ is a power: it means $n - 1$ threes multiplied together. For $n = 3$: $2 \\times 3^2 = 2 \\times 9 = 18$. A rule that gives any term directly from its position is called explicit.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A geometric sequence has $a_2=12$ and $a_3=36$. Write its explicit rule and its recursive rule.",
    steps: [
      "Find the common ratio. Each term is $r$ times the one before, so divide the later term by the earlier one: $r = 36 \\div 12 = 3$.",
      "Find the first term. Going from $a_1$ to $a_2$ multiplied by 3, so divide by 3 to go back: $a_1 = 12 \\div 3 = 4$.",
      "Explicit rule: $a_n = 4 \\times 3^{n-1}$. Check: $a_2 = 4 \\times 3 = 12$ and $a_3 = 4 \\times 9 = 36$.",
      "Recursive rule: start at $a_1 = 4$, and each next term is 3 times the one before, so $a_{n+1} = 3a_n$.",
    ],
    answer: "$a_n=4\\cdot 3^{n-1}$; $a_1=4,\\ a_{n+1}=3a_n$",
  },
  closingSections: [
    {
      stage: "method",
      title: "Why the power is one less than the position",
      paragraphs: [
        "Going from $a_1$ to $a_2$ multiplies by $r$ once. Going to $a_3$ multiplies twice, and going to $a_n$ multiplies $n - 1$ times. So $a_n = a_1 r^{n-1}$.",
        "You can read it backward too. In $a_n = 5 \\times 2^{n-1}$, put $n = 1$: $5 \\times 2^0 = 5 \\times 1 = 5$, since any number other than 0 to the power 0 is 1. So the first term is 5, and the ratio is 2.",
        "The ratio can be a fraction or negative. $a_n = 8 \\left(\\tfrac{1}{2}\\right)^{n-1}$ halves each time: 8, 4, 2, 1. $a_n = 3(-2)^{n-1}$ switches sign each time: 3, $-6$, 12, $-24$.",
      ],
    },
    {
      stage: "formal",
      title: "Equivalence of the two rules",
      paragraphs: [
        "Suppose $a_{n+1} = r a_n$ for every $n \\ge 1$ ($\\ge$ means greater than or equal to). Then $a_2 = r a_1$, $a_3 = r^2 a_1$, and continuing step by step, $a_n = r^{n-1} a_1$.",
        "In the other direction, if $a_n = a_1 r^{n-1}$, then $a_{n+1} = a_1 r^n = r \\times a_1 r^{n-1} = r a_n$. So both rules give the same list.",
      ],
    },
  ],
  pitfalls: [
    "Use $n - 1$ as the power, so that $n = 1$ gives the first term.",
    "A term from the middle of the list is not $a_1$. Divide by the ratio (which is not 0) once for each step back to the first term.",
    "Adding the same number each step makes an arithmetic sequence. Multiplying by the same number makes a geometric one.",
  ],
  parentGuide:
    "Ask for the first three terms of $a_n = 4 \\times 3^{n-1}$ (they are 4, 12 and 36). Then ask what each one is multiplied by to get the next.",
};

const completeSquareSenses = {
  square: "square-number",
  squares: "square-number",
  squared: "square-number",
  side: "side-of-equation",
  sides: "side-of-equation",
  root: "root-radical",
  roots: "root-radical",
  term: "term-expression",
  terms: "term-expression",
  factor: "factor-number",
  product: "product-multiply",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};

const solveByCompletingSquareMethod: ProblemMethod = {
  goal: "Solve a quadratic equation by making one side a perfect square, then give the exact solutions.",
  intuition:
    "A quadratic equation has an $x^2$ part ($x$ times $x$) and no higher power, like $x^2 + 6x - 7 = 0$. The $6x$ part makes it hard to undo directly. A perfect square is something times itself, like $(x + 3)^2 = (x + 3)(x + 3) = x^2 + 6x + 9$. If one side is a perfect square, a square root undoes it. A square root of a number is a number that times itself gives it. A positive number has two: $3 \\times 3 = 9$ and $(-3) \\times (-3) = 9$, so $x^2 = 9$ gives $x = \\pm 3$. The sign $\\pm$ stands for “plus or minus”.",
  terms: [
    "completing-the-square",
    [
      "plus-or-minus",
      "A positive number has two square roots, one of each sign: $x^2 = 9$ gives $x = \\pm 3$.",
    ],
  ],
  senses: completeSquareSenses,
  noLink: [
    "part",
    "parts",
    "whole",
    "change",
    "changes",
    "leaves",
    "key",
    "jumps",
    "jump",
    "third",
    "mean",
    "means",
    "sort",
    "image",
    "images",
    "solid",
    "scales",
    "net",
    "inverse",
    "population",
    "more than",
    "period",
    "periods",
    "quarter",
    "quarters",
    "one quarter",
    "mirror image",
    "rule",
    "rules",
    "opposite",
    "opposites",
    "unit",
    "units",
    "average",
    "decreasing",
    "increasing",
    "model",
    "models",
    "pattern",
    "patterns",
  ],
  method: [
    "If the number in front of $x^2$ is not 1, divide every term, each part joined by $+$ or $-$, by it. Then move the constant to the right side: $x^2 + bx = -c$.",
    "Add $\\left(\\frac{b}{2}\\right)^2$ to both sides. That is half of $b$, squared, meaning times itself. The left side becomes $\\left(x + \\frac{b}{2}\\right)^2$.",
    "If the right side is positive, take both square roots, $+$ and $-$. If it is 0, the only square root is 0. If it is negative, no number on the number line squared equals it. Keep the $\\sqrt{\\ }$ sign if the number is not a perfect square.",
    "Subtract $\\frac{b}{2}$ from both sides to get $x$ alone. Then check each answer in the original equation.",
  ],
  watch:
    "Add the square to both sides, not just the left. Take both roots ($\\pm$), then subtract $\\frac{b}{2}$, so the answers sit on either side of $-\\frac{b}{2}$.",
};

const solveByCompletingSquarePrinciple =
  "Real numbers are the numbers on the number line. For real numbers $b$ and $c$, $x^2 + bx + c = 0$ has the same solutions (the values of $x$ that make it true) as $\\left(x + \\frac{b}{2}\\right)^2 = \\frac{b^2}{4} - c$. If the right side is positive, $x = -\\frac{b}{2} \\pm \\sqrt{\\frac{b^2}{4} - c}$. If it is 0 there is one solution, and if it is negative there are no real solutions.";

const solveByCompletingSquareLesson: Lesson = {
  id: "solve-by-completing-square",
  title: "Solve a quadratic by completing the square",
  summary:
    "An equation has two sides: the parts left and right of the equals sign. An equation like $(x + 3)^2 = 16$ is easy to solve: $x + 3$ must be 4 or $-4$, because both of those times themselves make 16. So $x = 1$ or $x = -7$. Completing the square turns a harder equation, like $x^2 + 6x - 7 = 0$, into that easy shape. You add the same number to both sides so that one side becomes something times itself. Then you undo the squaring, which means you take a square root.",
  templateIds: ["solve-by-completing-square"],
  senses: completeSquareSenses,
  noLink: [
    "part",
    "parts",
    "whole",
    "change",
    "changes",
    "leaves",
    "key",
    "jumps",
    "jump",
    "third",
    "mean",
    "means",
    "sort",
    "image",
    "images",
    "solid",
    "scales",
    "net",
    "inverse",
    "population",
    "more than",
    "period",
    "periods",
    "quarter",
    "quarters",
    "one quarter",
    "mirror image",
    "rule",
    "rules",
    "opposite",
    "opposites",
    "unit",
    "units",
    "average",
    "decreasing",
    "increasing",
    "model",
    "models",
    "pattern",
    "patterns",
  ],
  objectives: [
    "Add the same number to both sides of an equation so the left side becomes a perfect square, then write it as a square.",
    "Solve for $x$ using both square roots, including answers that keep a root sign.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Make one side a perfect square",
      paragraphs: [
        "In $x^2 + 6x - 7 = 0$, the small raised 2 means $x$ times $x$. An equation with an $x^2$ part and no higher power is called a quadratic. Something times itself, like $(x + 3)^2$, is called a perfect square. Here $(x + 3)^2$ means $(x + 3)(x + 3)$.",
        "A square root of a number is a number that times itself gives it. Every positive number has two: 4 and $-4$ are both square roots of 16. So $(x + 3)^2 = 16$ means $x + 3 = 4$ or $x + 3 = -4$. We write this as $x + 3 = \\pm 4$. The sign $\\pm$ stands for “plus or minus”.",
        "The expression $x^2 + 6x$ is not a perfect square yet. Multiplying out $(x + 3)(x + 3)$ gives $x^2 + 3x + 3x + 9 = x^2 + 6x + 9$. So adding 9 turns $x^2 + 6x$ into $(x + 3)^2$. When the number in front of $x^2$ is 1, the number to add is half the number in front of $x$, squared: half of 6 is 3, and $3^2 = 9$.",
        "An equation stays true when you add the same number to both sides. So if you add 9 on the left, add 9 on the right too.",
      ],
    },
  ],
  workedExample: {
    prompt: "Solve $x^2+6x-7=0$ by completing the square.",
    steps: [
      "Add 7 to both sides to move the constant, the number with no $x$, away from the $x$ terms: $x^2 + 6x = 7$.",
      "Half of 6 is 3, and $3^2 = 9$. Add 9 to both sides to keep them equal: $x^2 + 6x + 9 = 16$.",
      "The left side is now a perfect square: $(x + 3)^2 = 16$.",
      "Undo the square with both square roots of 16: $x + 3 = 4$ or $x + 3 = -4$. We write $x + 3 = \\pm 4$.",
      "Subtract 3 from both sides: $x = -3 + 4 = 1$ or $x = -3 - 4 = -7$. Check $x = 1$: $1 + 6 - 7 = 0$. Check $x = -7$: $49 - 42 - 7 = 0$.",
    ],
    answer: "$x=1$ or $x=-7$",
  },
  closingSections: [
    {
      stage: "method",
      title: "Irrational solutions and other coefficients",
      paragraphs: [
        "If the right side is a number like 5, keep the $\\sqrt{\\ }$ sign, because no fraction equals $\\sqrt{5}$ exactly, and its digits after the point never end. For $x^2 + 4x - 1 = 0$: add 1 to both sides, then add 4, to get $(x + 2)^2 = 5$. So $x + 2 = \\pm\\sqrt{5}$ and $x = -2 \\pm \\sqrt{5}$. Here $\\sqrt{5}$ is the positive number that times itself makes 5. These answers are exact. Writing $\\sqrt{5}$ as about 2.24 would not be.",
        "If the number in front of $x^2$ is not 1, divide every term by it first. Dividing both sides by a number other than 0 keeps the same solutions, the values of $x$ that make the equation true. So $2x^2 + 12x + 10 = 0$ becomes $x^2 + 6x + 5 = 0$.",
        "When the number in front of $x$ is odd, half of it is a fraction. For $x^2 + 3x - 1 = 0$: move the 1, then add $\\left(\\tfrac{3}{2}\\right)^2 = \\tfrac{9}{4}$ to both sides. That gives $\\left(x + \\tfrac{3}{2}\\right)^2 = \\tfrac{13}{4}$, so $x = \\frac{-3 \\pm \\sqrt{13}}{2}$.",
      ],
    },
    {
      stage: "formal",
      title: "Why the method works",
      paragraphs: [
        "Multiplying out gives $\\left(x + \\frac{b}{2}\\right)^2 = x^2 + bx + \\frac{b^2}{4}$. So adding $\\frac{b^2}{4}$ to both sides of $x^2 + bx = -c$ gives $\\left(x + \\frac{b}{2}\\right)^2 = \\frac{b^2}{4} - c$.",
        "A square equals a number $s$ that is 0 or more exactly when the thing being squared is $\\sqrt{s}$ or $-\\sqrt{s}$. If $s$ is negative, no real number (a number on the number line) squared equals it, so there are no real solutions.",
      ],
    },
  ],
  pitfalls: [
    "Add the square to both sides of the equation, not just one.",
    "Use half of the number in front of $x$, then square it. Do not square the entire number in front of $x$.",
    "Take both square roots, then subtract the shift: $(x + 3)^2 = 16$ gives $x = -3 \\pm 4$, not $x = 3 \\pm 4$.",
  ],
  parentGuide:
    "Ask which number must be added to $x^2 + 6x$ to make a perfect square (9), and why it has to be added to both sides of the equation.",
};

const complexQuadraticSolveMethod: ProblemMethod = {
  goal: "Solve a quadratic equation with real coefficients whose solutions are not real, or write such an equation from its solutions.",
  intuition:
    "Squaring a real number never gives a negative result, so $x^2=-9$ has no real solution. The number $i$ is defined by $i^2=-1$, which gives $x^2=-9$ the solutions $3i$ and $-3i$. A quadratic with real coefficients can have such solutions.",
  terms: ["imaginary-unit", "complex-number", "complex-conjugate"],
  method: [
    "If the leading coefficient is not 1, divide by it.",
    "Complete the square: $(x+h)^2=h^2-q$ where the equation is $x^2+2hx+q=0$. The right side is negative.",
    "Write the negative number $-m$ as $m\\cdot i^2$ and take both roots: $x+h=\\pm\\sqrt{m}\\,i$.",
    "Subtract $h$. To go backward from $x=-h\\pm ki$, the equation is $x^2+2hx+(h^2+k^2)=0$.",
  ],
  watch:
    "The real part of the solutions is $-h$ (half of the middle coefficient, with its sign flipped), and the imaginary part is $\\sqrt m$, not $m$. Both $+$ and $-$ appear.",
};

const complexQuadraticSolvePrinciple =
  "A quadratic $ax^2+bx+c=0$ with real coefficients and $b^2-4ac<0$ has no real solutions and exactly two nonreal solutions $x=\\frac{-b\\pm i\\sqrt{4ac-b^2}}{2a}$, which are complex conjugates. The sum of the solutions is $-\\frac ba$ and their product is $\\frac ca$.";

const complexQuadraticSolveLesson: Lesson = {
  id: "complex-quadratic-solve",
  title: "Quadratics with nonreal solutions",
  summary:
    "When completing the square leaves a negative number on the right, use $i^2=-1$ to take its square root. The solutions come as a conjugate pair.",
  templateIds: ["complex-quadratic-solve"],
  objectives: [
    "Solve $x^2+px+q=0$ with solutions $a\\pm bi$ by completing the square.",
    "Write a real-coefficient quadratic with given conjugate solutions.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "A negative number on the right",
      paragraphs: [
        "In the real numbers, the square of every number is zero or positive, so $x^2=-4$ has no real solution. The number $i$ is defined by $i^2=-1$. Then $(2i)^2=4i^2=-4$ and $(-2i)^2=-4$, so $x^2=-4$ has the solutions $x=2i$ and $x=-2i$.",
        "A complex number has the form $a+bi$ with real numbers $a$ and $b$; $a$ is its real part and $b$ is its imaginary part.",
      ],
    },
  ],
  workedExample: {
    prompt: "Solve $x^2+4x+13=0$ over the complex numbers.",
    steps: [
      "Move the constant: $x^2+4x=-13$.",
      "Half of 4 is 2. Add $2^2=4$ to both sides: $(x+2)^2=-9$.",
      "No real number squares to −9. Using $i^2=-1$, the square roots of −9 are $\\pm3i$, so $x+2=\\pm3i$.",
      "Subtract 2: $x=-2\\pm3i$. Check $x=-2+3i$: $(x+2)^2=(3i)^2=-9$.",
    ],
    answer: "$x=-2\\pm3i$",
  },
  closingSections: [
    {
      stage: "method",
      title: "Going backward",
      paragraphs: [
        "If the solutions are $-2\\pm3i$, then $x+2=\\pm3i$. Squaring gives $(x+2)^2=-9$, so $x^2+4x+4+9=0$, that is $x^2+4x+13=0$. The constant is the square of the real part plus the square of the imaginary part: $2^2+3^2=13$.",
        "If the right side is not a perfect square, keep the radical: $(x+1)^2=-5$ gives $x=-1\\pm\\sqrt5\\,i$.",
      ],
    },
    {
      stage: "formal",
      title: "The discriminant and conjugates",
      paragraphs: [
        "For real $a\\ne0$, $b$, $c$, the quantity $b^2-4ac$ is the discriminant. If it is negative, completing the square gives $\\left(x+\\frac b{2a}\\right)^2=\\frac{b^2-4ac}{4a^2}<0$, so there are no real solutions and the two complex solutions are $\\frac{-b}{2a}\\pm\\frac{\\sqrt{4ac-b^2}}{2a}i$. They differ only in the sign of the imaginary part.",
      ],
    },
  ],
  pitfalls: [
    "Do not write real roots such as $-2\\pm3$ when the right side is negative.",
    "Take the square root of the number, not the number itself: $\\sqrt{5}\\,i$, not $5i$, for $(x+1)^2=-5$.",
    "The real part is $-h$ for $(x+h)^2$; do not change its sign again.",
  ],
  parentGuide:
    "Ask why $x^2=-9$ has no real solution and what number squares to −9 when $i^2=-1$.",
};

const complexPartsMethod: ProblemMethod = {
  goal: "Name the real and imaginary parts of a complex number, simplify powers of $i$, and write a root of a negative number as $a+bi$.",
  intuition:
    "Every complex number is written $a+bi$: a real number $a$ plus a real multiple $b$ of $i$, where $i^2=-1$. The two real numbers $a$ and $b$ tell you everything about it.",
  terms: [
    "real-part",
    "imaginary-part",
    [
      "imaginary-unit",
      "Its powers repeat in a cycle of four: $i$, −1, $-i$, 1.",
    ],
  ],
  method: [
    "For $a+bi$: the real part is the term without $i$ and the imaginary part is the number multiplying $i$. A missing term counts as 0.",
    "For $i^n$: divide $n$ by 4 and use the remainder. Remainder 0, 1, 2, 3 gives $1$, $i$, $-1$, $-i$.",
    "For $\\sqrt{-m}$ with $m>0$: $\\sqrt{-m}=\\sqrt m\\,i$. Write the sum as real part plus imaginary multiple of $i$.",
  ],
  watch:
    "The imaginary part is the real number $b$, not $bi$. A number is real exactly when its imaginary part is 0, so $i^2=-1$ and $i^4=1$ are real while $i^3=-i$ is not.",
};

const complexPartsPrinciple =
  "Every complex number can be written uniquely as $a+bi$ with real $a$ and $b$, where $i^2=-1$. Powers of $i$ satisfy $i^{n+4}=i^n$. For real $m>0$, $\\sqrt{-m}=\\sqrt m\\,i$ is the principal square root of $-m$.";

const complexPartsLesson: Lesson = {
  id: "complex-parts",
  title: "Parts of a complex number and its powers",
  summary:
    "A complex number $a+bi$ has real part $a$ and imaginary part $b$. Powers of $i$ repeat every four steps.",
  templateIds: ["complex-parts"],
  objectives: [
    "State the real and imaginary parts of $a+bi$, including when a part is 0.",
    "Simplify $i^n$ and $c\\,i^n$ with the cycle of four.",
    "Write $a+\\sqrt{-m}$ in the form $a+bi$.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Two real numbers and one new number",
      paragraphs: [
        "The number $i$ is defined by $i^2=-1$. A complex number is $a+bi$ with real $a$ and $b$. For $3-5i$ the real part is 3 and the imaginary part is $-5$. The number $-5i$ has real part 0, and the number 4 has imaginary part 0, since $4=4+0i$.",
        "Multiplying by $i$ again and again gives a cycle: $i^1=i$, $i^2=-1$, $i^3=i^2\\cdot i=-i$, $i^4=(i^2)^2=1$, then $i^5=i$ and the cycle repeats.",
      ],
    },
  ],
  workedExample: {
    prompt: "Simplify $i^{27}$, and write $5-\\sqrt{-16}$ in the form $a+bi$.",
    steps: [
      "The powers of $i$ repeat every 4. Divide 27 by 4: $27=4\\cdot6+3$, remainder 3.",
      "So $i^{27}=(i^4)^6\\cdot i^3=1\\cdot(-i)=-i$.",
      "For the second number, $\\sqrt{-16}=\\sqrt{16}\\,i=4i$.",
      "Keep the minus sign in front: $5-4i$. Its real part is 5 and its imaginary part is $-4$.",
    ],
    answer: "$i^{27}=-i$; $5-\\sqrt{-16}=5-4i$",
  },
  closingSections: [
    {
      stage: "method",
      title: "Real or not",
      paragraphs: [
        "A complex number is real when its imaginary part is 0. A power $i^n$ is real when $n$ is even: remainders 0 and 2 give $1$ and $-1$. Odd exponents give $i$ or $-i$, which are not real.",
        "To simplify $3i^{6}$, reduce the exponent: 6 leaves remainder 2, so $i^6=-1$ and $3i^6=-3$.",
      ],
    },
    {
      stage: "formal",
      title: "Why the cycle has length four",
      paragraphs: [
        "Since $i^4=(i^2)^2=(-1)^2=1$, $i^{n+4}=i^n\\cdot i^4=i^n$. So only the remainder of $n$ divided by 4 matters. For $m>0$, $\\sqrt{-m}=\\sqrt m\\,i$ because $(\\sqrt m\\,i)^2=m\\cdot i^2=-m$.",
      ],
    },
  ],
  pitfalls: [
    "The imaginary part of $3-5i$ is $-5$, not $-5i$.",
    "Do not square the root: $\\sqrt{-16}=4i$, not $16i$.",
    "Reduce the exponent by 4 before simplifying a power of $i$.",
  ],
  parentGuide:
    "Ask what $i^2$ and $i^4$ are, then ask how that tells you where $i^{27}$ lands in the cycle.",
};

const interpretLinearParametersMethod: ProblemMethod = {
  goal: "A linear model describes a real situation. Say what its slope and its initial value mean there, with units.",
  senses: {
    balance: "balance-account",
    change: "change",
    term: "term-expression",
  },
  noLink: [
    "mean",
    "population",
    "rule",
    "rules",
    "opposite",
    "opposites",
    "unit",
    "units",
    "average",
    "decreasing",
    "increasing",
    "model",
    "models",
    "pattern",
    "patterns",
  ],
  intuition:
    "A linear model is a rule in which each extra 1 of input changes the output by the same amount, like $C = 39h + 63$. In general it is written $y = mx + b$. You choose the input $x$, and the rule gives the output $y$. The slope $m$, the number multiplying $x$, says how much $y$ changes each time $x$ goes up by 1. The initial value $b$, the number standing alone, is the output when $x$ is 0. That 0 may stand for a starting moment, such as the year 2018 or the moment a drain opens.",
  terms: [
    [
      "rate-of-change",
      "Here it is the slope $m$, in units of output per unit of input.",
    ],
    [
      "initial-value",
      "Here it is the constant $b$. If the input counts from a start, such as years after 2018, 0 means that start.",
    ],
  ],
  method: [
    "Name the input and the output, and the unit of each: what it counts or measures, such as dollars, hours or liters.",
    "Slope: as the input goes up, a positive $m$ (greater than 0) means the output goes up, and a negative $m$ means it goes down. If $m$ is 0, the output stays the same. Give the size without the sign, in output units per input unit.",
    "Initial value: put 0 in for the input. Give the output at that starting point, in the output's units.",
    "Check the units: the slope is output units per input unit, and the initial value is in output units.",
  ],
  watch:
    "The slope is the change for each 1 of input. It is not the output after one unit, which is $m + b$. An input of 0 means the starting point the problem names, such as the moment a drain opens or the year 2018.",
};

const interpretLinearParametersPrinciple =
  "In the linear model $y = mx + b$, each increase of 1 in $x$ changes $y$ by exactly $m$, the slope. When $x = 0$, $y = b$, the initial value. These meanings hold only for inputs that make sense in the situation, and both numbers carry the situation's units.";

const interpretLinearParametersLesson: Lesson = {
  id: "interpret-linear-parameters",
  title: "What the slope and starting value mean",
  summary:
    "A linear model is a rule, like $C = 39h + 63$, in which each extra 1 of input changes the output by the same amount. Here the input $h$ is hours worked, and the output $C$ is the charge in dollars. The 39 is the slope: each extra hour adds 39 dollars. The 63 is the starting value: the charge when $h = 0$. Always say what each number means, with its units, such as dollars or hours.",
  templateIds: ["interpret-linear-parameters"],
  senses: {
    balance: "balance-account",
    change: "change",
  },
  noLink: [
    "mean",
    "parts",
    "whole",
    "rule",
    "rules",
    "opposite",
    "opposites",
    "unit",
    "units",
    "average",
    "decreasing",
    "increasing",
    "model",
    "models",
    "pattern",
    "patterns",
  ],
  objectives: [
    "Explain the slope as the change in the output for each increase of 1 in the input, with units, including a decrease.",
    "Explain the starting value as the output when the input is 0, including when 0 stands for a starting year.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "A rate and a starting amount",
      paragraphs: [
        "A plumber charges a fee just for coming, plus the same amount for each hour of work. A model is a rule, written as an equation, that describes a real situation. The model $C = 39h + 63$ gives the total charge $C$, in dollars, for $h$ hours of work. Here $39h$ means 39 times $h$.",
        "The input is the number you choose: here, the hours $h$. The output is the result the rule gives: here, the charge $C$. Try a few inputs. For 1 hour, $C = 39 \\times 1 + 63 = 102$. For 2 hours, $C = 39 \\times 2 + 63 = 141$. For 3 hours, $C = 39 \\times 3 + 63 = 180$. Each extra hour adds the same 39 dollars.",
        "That steady change for each extra 1 of input is called the rate of change. A model like this is called linear: equal steps in the input give equal steps in the output. Its graph, a picture of the input and output pairs as points, is a straight line. In a linear model the rate of change is the slope, the number multiplying the input. Its units are output units per input unit: 39 dollars per hour.",
        "Now try 0 hours: $C = 39 \\times 0 + 63 = 63$. So 63 dollars is the charge before any work, just for coming. The output when the input is 0 is called the initial value, or starting value. It has the output's units: 63 dollars.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "The balance on a gift card is modeled by $B=150-12w$, where $B$ is in dollars and $w$ is the number of weeks after purchase. What do 12 and 150 mean?",
    steps: [
      "Name the input and the output. The input $w$ is the number of weeks after purchase. The output $B$ is the balance, the money left on the card, in dollars.",
      "Find the change for one more week. At $w = 1$, $B = 150 - 12 \\times 1 = 138$. At $w = 2$, $B = 150 - 12 \\times 2 = 126$. The balance drops by 12 dollars from one week to the next.",
      "So the slope is $-12$. The minus sign means a decrease: the balance goes down 12 dollars per week.",
      "Put in $w = 0$, the moment of purchase: $B = 150 - 12 \\times 0 = 150$. The initial value is 150 dollars, the balance when the card is bought.",
      "So 12 is how much the balance falls each week, and 150 dollars is the starting balance. After one week the balance is 138 dollars, not 12.",
    ],
    answer:
      "The balance decreases by 12 dollars each week; it starts at 150 dollars",
  },
  closingSections: [
    {
      stage: "method",
      title: "When 0 is not the beginning of time",
      paragraphs: [
        "Sometimes the input counts from a chosen starting point. In $N = 1200 + 85t$, $N$ is the number of subscribers and $t$ is the number of years after 2018. Then $t = 0$ means the year 2018 itself. So 1200 is the number of subscribers in 2018. The 85 means 85 more subscribers each year.",
        "A model that goes down has a negative slope. In $D = 240 - 55t$, $D$ is the distance left to drive, in miles, and $t$ is the number of hours driven. The slope is $-55$: the distance left shrinks by 55 miles for each hour driven. The initial value, 240 miles, is the distance left at the start of the trip.",
        "If the slope is 0, the output never changes. For example, $C = 0h + 63$ is always 63 dollars, however long the job takes.",
      ],
    },
    {
      stage: "formal",
      title: "Slope and intercept as changes and values",
      paragraphs: [
        "Mathematicians often name the output $f(x)$, read “$f$ of $x$”: the output when the input is $x$. So $f(0)$ means the output when the input is 0. It does not mean $f$ times 0. With this name, a linear model is written $f(x) = mx + b$.",
        "Increase the input by 1. The new output is $f(x + 1) = m(x + 1) + b$. Here $m(x + 1)$ means $m$ times the whole of $x + 1$, which is $mx + m$. So $f(x + 1) = mx + m + b$. The change is the new output minus the old one: $(mx + m + b) - (mx + b)$. The $mx$ and $b$ parts cancel, leaving $m$. So the output changes by exactly $m$ whenever the input goes up by 1. For the plumber, $m = 39$.",
        "Also $f(0) = m \\times 0 + b = b$, the initial value. On a graph, the vertical axis is the up-and-down number line where the input is 0. The line crosses it at the point $(0, b)$, so $b$ is also called the $y$-intercept. A rate of change has the output's units divided by the input's units.",
      ],
    },
  ],
  pitfalls: [
    "The slope is the change for each 1 of input, not the output after one unit. In $C = 39h + 63$, the output after 1 hour is 39 + 63 = 102 dollars, not 39.",
    "A positive slope (greater than 0) means the output goes up as the input goes up. A negative slope (less than 0) means the output goes down as the input goes up. Say which, and give the size without the sign: decreases by 12 dollars per week.",
    "Give the units of both numbers. When the input counts from a starting point, such as years after 2018, say what an input of 0 means.",
  ],
  parentGuide:
    "Ask what the charge is for a 0-hour job, and how much it grows with each extra hour. Then connect those answers to the 63 and the 39 in $C = 39h + 63$.",
};

const formConversionSenses = {
  vertex: "vertex-parabola",
  square: "square-number",
  squared: "square-number",
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  term: "term-expression",
  terms: "term-expression",
  "standard form": "standard-form-polynomial",
  side: "side-of-equation",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};

const quadraticFormConversionMethod: ProblemMethod = {
  goal: "Rewrite a quadratic in factored or vertex form and read its zeros, line of symmetry, vertex or lowest or highest value.",
  intuition:
    "A quadratic function, like $y = x^2 - 6x + 5$, has an $x^2$ part and no higher power. Its graph is a U-shaped curve called a parabola. The same function can be written in different forms that give the same $y$ for every $x$. Factored form, $(x - 1)(x - 5)$, shows the zeros: the $x$-values where $y = 0$. The vertex is the turning point of the curve. Vertex form, $(x - 3)^2 - 4$, shows the vertex $(3, -4)$, and so the lowest or highest value. The vertical line through the vertex, here $x = 3$, is the axis of symmetry: it splits the curve into mirror halves.",
  terms: ["zero-of-a-function", "vertex-form", "axis-of-symmetry"],
  senses: formConversionSenses,
  noLink: [
    "part",
    "parts",
    "whole",
    "change",
    "changes",
    "leaves",
    "key",
    "jumps",
    "jump",
    "third",
    "mean",
    "means",
    "sort",
    "image",
    "images",
    "solid",
    "scales",
    "net",
    "inverse",
    "population",
    "more than",
    "period",
    "periods",
    "quarter",
    "quarters",
    "one quarter",
    "mirror image",
    "rule",
    "rules",
    "opposite",
    "opposites",
    "unit",
    "units",
    "average",
    "decreasing",
    "increasing",
    "model",
    "models",
    "pattern",
    "patterns",
  ],
  method: [
    "For the zeros: write it as parts multiplied together, called factors. Then set each factor equal to 0. If there are two zeros, the axis of symmetry is halfway between them.",
    "For the vertex: complete the square. Take $a$ out of the two terms, the parts that contain $x$. Add and subtract the square, the number times itself, that is needed, and remember that $a$ multiplies what you add inside.",
    "Read the vertex $(h, k)$ from $a(x - h)^2 + k$. The value $k$ is the lowest value if $a > 0$ and the highest value if $a < 0$.",
  ],
  watch:
    "In $a(x - h)^2 + k$, the vertex has $x = h$, the opposite sign of the number inside the bracket. The zeros are $x$-values, while the lowest or highest value is a $y$-value. Do not mix them up.",
};

const quadraticFormConversionPrinciple =
  "A quadratic function $y = ax^2 + bx + c$ with $a \\ne 0$ equals $a(x - h)^2 + k$, where $h = -\\frac{b}{2a}$ and $k$ is the value of $y$ at $x = h$. When it has zeros $p$ and $q$, it also equals $a(x - p)(x - q)$. The axis of symmetry is $x = h = \\frac{p + q}{2}$, and $k$ is the lowest value if $a > 0$ or the highest if $a < 0$.";

const quadraticFormConversionLesson: Lesson = {
  id: "quadratic-form-conversion",
  title: "Choose the form that shows a feature",
  summary:
    "The same calculation can be written in different ways. For example, $x^2 - 6x + 5$, $(x - 1)(x - 5)$ and $(x - 3)^2 - 4$ give the same answer for every $x$. The second way shows at a glance where the answer is 0: at $x = 1$ and $x = 5$. The third shows the smallest the answer can be: $-4$, reached at $x = 3$. Pick the way of writing it that shows what you need.",
  templateIds: ["quadratic-form-conversion"],
  senses: formConversionSenses,
  noLink: [
    "part",
    "parts",
    "whole",
    "change",
    "changes",
    "leaves",
    "key",
    "jumps",
    "jump",
    "third",
    "mean",
    "means",
    "sort",
    "image",
    "images",
    "solid",
    "scales",
    "net",
    "inverse",
    "population",
    "more than",
    "period",
    "periods",
    "quarter",
    "quarters",
    "one quarter",
    "mirror image",
    "rule",
    "rules",
    "opposite",
    "opposites",
    "unit",
    "units",
    "average",
    "decreasing",
    "increasing",
    "model",
    "models",
    "pattern",
    "patterns",
  ],
  objectives: [
    "Rewrite a quadratic in vertex form and read its turning point (the vertex) and its lowest or highest value.",
    "Factor a quadratic to find its zeros, and use them to find the line of symmetry.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "One function, different views",
      paragraphs: [
        "A function is a rule that turns each input $x$ into one output $y$. In $y = x^2 - 6x + 5$, the raised 2 means $x$ times $x$. A function with an $x^2$ part and no higher power is called a quadratic. Its graph is a U-shaped curve called a parabola.",
        "Writing it as $x^2 - 6x + 5$, from the highest power down, is called standard form. The same function can also be written as $(x - 1)(x - 5)$ (factored form) or $(x - 3)^2 - 4$ (vertex form). Two brackets written next to each other are multiplied. Multiplying out either of the last two gives back the first, so all three give the same $y$ for every $x$.",
        "Factored form shows the zeros, the $x$-values that make $y = 0$. A product, the result of multiplying, is 0 when one of its factors (the parts being multiplied) is 0. So $y = 0$ when $x - 1 = 0$ or $x - 5 = 0$, which means $x = 1$ or $x = 5$.",
        "The vertex is the turning point of the curve, and vertex form shows it. Squared means times itself, and a number squared is never negative. So $(x - 3)^2$ is 0 or more, which makes $y$ equal to $-4$ or more. It equals $-4$ exactly when $x - 3 = 0$, at $x = 3$. So the vertex is $(3, -4)$ and the lowest value is $-4$.",
        "A vertical line is a straight up-and-down line. The one through the vertex, here $x = 3$, splits the parabola into two mirror-image halves. It is called the axis of symmetry. It sits exactly halfway between the zeros: 3 is halfway between 1 and 5.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "For $y=x^2-6x+5$, find the zeros, the axis of symmetry, and the minimum value.",
    steps: [
      "Factor. Look for two numbers that multiply to 5 and add to $-6$: they are $-1$ and $-5$. So $y = (x - 1)(x - 5)$.",
      "The product is 0 when one factor is 0. $x - 1 = 0$ gives $x = 1$, and $x - 5 = 0$ gives $x = 5$. These are the zeros.",
      "The axis of symmetry is halfway between the zeros: $\\frac{1 + 5}{2} = 3$. So it is the line $x = 3$.",
      "Complete the square to find the lowest value. Half of $-6$ is $-3$, and $(-3)^2 = 9$. Add and subtract 9, which adds 0: $y = (x^2 - 6x + 9) + 5 - 9 = (x - 3)^2 - 4$.",
      "Since $(x - 3)^2$ is never negative, the minimum (lowest) value is $-4$, reached at $x = 3$. Check in the original: $3^2 - 6 \\times 3 + 5 = 9 - 18 + 5 = -4$.",
    ],
    answer: "zeros 1 and 5; axis $x=3$; minimum $-4$",
  },
  closingSections: [
    {
      stage: "method",
      title: "A leading coefficient and a maximum",
      paragraphs: [
        "When the number in front of $x^2$ is not 1, take it out of the $x$ terms (the parts that contain $x$) first. For $y = -2x^2 + 8x + 1$: $y = -2(x^2 - 4x) + 1$. Half of $-4$ is $-2$, and $(-2)^2 = 4$. Adding 4 inside the bracket really adds $-2 \\times 4 = -8$, so add 8 outside to make up for it: $y = -2(x - 2)^2 + 9$.",
        "Now $-2(x - 2)^2$ is a negative number times something that is never negative, so it is at most 0. That makes $y$ at most 9. The maximum (highest) value is 9, at $x = 2$, and the parabola opens downward.",
        "Standard form $ax^2 + bx + c$ shows the $y$-intercept, where the curve crosses the $y$-axis. It is $c$, the value of $y$ when $x = 0$. Choose the form that shows the feature you need.",
      ],
    },
    {
      stage: "formal",
      title: "Forms and features",
      paragraphs: [
        "Multiplying out $a(x - h)^2 + k$ gives $ax^2 - 2ahx + ah^2 + k$. Matching this to $ax^2 + bx + c$ gives $b = -2ah$, so $h = -\\frac{b}{2a}$ (with $a \\ne 0$), and $k = c - ah^2$.",
        "Multiplying out $a(x - p)(x - q)$ gives $ax^2 - a(p + q)x + apq$. So $b = -a(p + q)$, and the axis is $x = h = \\frac{p + q}{2}$, halfway between the zeros $p$ and $q$.",
      ],
    },
  ],
  pitfalls: [
    "The vertex of $(x - 3)^2 - 4$ is $(3, -4)$. The number inside the bracket has the opposite sign of the $x$-value.",
    "When the number in front of $x^2$ is not 1, it multiplies what you add inside the bracket. Make up for that amount outside.",
    "The zeros are inputs ($x$-values). The lowest or highest value is an output (a $y$-value).",
  ],
  parentGuide:
    "Ask which form of $y = x^2 - 6x + 5$ shows its zeros most directly, and which form shows its lowest point. Then ask why $(x - 3)^2 - 4$ can never be less than $-4$.",
};

const rationalExtraneousSingleMethod: ProblemMethod = {
  goal: "Solve a rational equation with one variable denominator, check whether the candidate is allowed, and explain a disallowed one.",
  intuition:
    "To clear a fraction you multiply both sides by its denominator. That step assumes the denominator is not zero. A candidate that makes the original denominator zero is not a solution; it only appears because the multiplication ignored that condition.",
  terms: ["excluded-value", "extraneous-solution"],
  method: [
    "Find the excluded value: set the denominator equal to 0 and solve.",
    "Multiply both sides by the denominator and solve the resulting equation.",
    "Compare each candidate with the excluded value. If it equals the excluded value, reject it; if every candidate is rejected, there is no solution.",
    "Substitute any remaining candidate into the original equation to confirm.",
  ],
  watch:
    "Reject a candidate only when it makes a denominator zero, not because it looks unusual. A difference of squares over a matching linear factor simplifies only for inputs other than that factor's zero.",
};

const rationalExtraneousSinglePrinciple =
  "Multiplying both sides of an equation by an expression $D(x)$ gives an equation that has every solution of the original with $D(x)\\ne0$, and also any $x$ where $D(x)=0$ and both cleared sides agree. A solution of the original equation must be in its domain, so every candidate is checked against the excluded values.";

const rationalExtraneousSingleLesson: Lesson = {
  id: "rational-extraneous-single",
  title: "When the answer makes the denominator zero",
  summary:
    "Clearing a denominator can produce a candidate that the original equation does not allow. Compare every candidate with the excluded value.",
  templateIds: ["rational-extraneous-single"],
  objectives: [
    "Solve a rational equation with one linear denominator and test the candidate against the excluded value.",
    "Explain why multiplying by the denominator can introduce an extraneous candidate.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Multiplying by zero loses information",
      paragraphs: [
        "A fraction like $\\frac{3}{x-2}$ is not defined at $x=2$ because division by zero has no value. When we multiply both sides of an equation by $x-2$, we implicitly assume it is not zero. At $x=2$ the multiplier is zero and the cleared equation can be true even though the original is undefined.",
        "So after solving, every candidate is checked against the excluded value.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "Solve $\\dfrac{x+1}{x-3}=2+\\dfrac{4}{x-3}$ over the real numbers.",
    steps: [
      "The denominator is zero at $x=3$, so $x\\ne3$.",
      "Multiply both sides by $x-3$: $x+1=2(x-3)+4$.",
      "Simplify: $x+1=2x-2$, so $x=3$.",
      "The only candidate, $x=3$, is the excluded value. It makes the original denominators zero, so it is extraneous.",
    ],
    answer: "No solution",
  },
  closingSections: [
    {
      stage: "method",
      title: "A second shape",
      paragraphs: [
        "The same idea appears when a numerator factors with the denominator: $\\frac{x^2-9}{x-3}=6$. For $x\\ne3$ the fraction equals $x+3$, so $x+3=6$ gives the candidate $x=3$, which is excluded: no solution. With target 5 instead of 6 the candidate is $x=2$, which is allowed, so it is a solution.",
      ],
    },
    {
      stage: "formal",
      title: "Equivalence only on the domain",
      paragraphs: [
        "For $D(x)\\ne0$, the equation $\\frac{A}{D}=B$ is equivalent to $A=BD$. The equation $A=BD$ may have additional solutions where $D(x)=0$. These are not solutions of $\\frac AD=B$, which is undefined there.",
      ],
    },
  ],
  pitfalls: [
    "Write the excluded value before solving, not after.",
    "A candidate is extraneous only if it makes a denominator zero. Otherwise it is a solution.",
    "If the only candidate is rejected, the answer is no solution, not “$x$ equals the candidate.”",
  ],
  parentGuide:
    "Ask what happens to $\\frac3{x-2}$ at $x=2$ and why a candidate of 2 cannot be an answer.",
};

const squareRootExtraneousMethod: ProblemMethod = {
  goal: "Solve a square-root equation by squaring, identify the extraneous candidate, and explain why squaring creates it.",
  intuition:
    "A principal square root is never negative. Squaring both sides also keeps the case where the right side is the negative of the square root, so the squared equation can have a candidate that the original equation does not.",
  terms: ["principal-square-root", "extraneous-solution"],
  method: [
    "Isolate the square root on one side.",
    "Square both sides, then solve the resulting equation. Quadratics give up to two candidates.",
    "Substitute each candidate into the original equation. Keep it only if the two sides agree; a candidate that makes the isolated right side negative must be rejected.",
    "To explain why: squaring turns $A=B$ and $A=-B$ into the same equation $A^2=B^2$, so a candidate of the second equation also appears.",
  ],
  watch:
    "A correct algebraic candidate can still fail. Check in the original equation, not in the squared one.",
};

const squareRootExtraneousPrinciple =
  "If $\\sqrt{A}=B$ then $A=B^2$ and $B\\ge0$. Conversely $A=B^2$ gives $\\sqrt A=|B|$, so a solution of $A=B^2$ solves $\\sqrt A=B$ exactly when $B\\ge0$. A candidate with $B<0$ solves $\\sqrt A=-B$ and is extraneous.";

const squareRootExtraneousLesson: Lesson = {
  id: "square-root-extraneous",
  title: "Why squaring adds a candidate",
  summary:
    "Squaring both sides can add a candidate that satisfies $\\sqrt A=-B$ instead of $\\sqrt A=B$. Check each candidate in the original equation.",
  templateIds: ["square-root-extraneous"],
  objectives: [
    "Solve a square-root equation with a linear right side and keep only the valid candidates.",
    "Explain from the sign of the right side why a candidate is extraneous.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "A square root is not negative",
      paragraphs: [
        "The symbol $\\sqrt{25}$ means 5, the nonnegative number whose square is 25. So an equation such as $\\sqrt{x+2}=x$ can be true only when $x\\ge0$. Squaring both sides gives $x+2=x^2$, which has no such restriction: it treats $x$ and $-x$ alike because $(-x)^2=x^2$.",
        "So squaring can produce candidates that the original equation rejects.",
      ],
    },
  ],
  workedExample: {
    prompt: "Solve $\\sqrt{x+2}=x$ over the real numbers.",
    steps: [
      "Square both sides: $x+2=x^2$, so $0=x^2-x-2=(x-2)(x+1)$. The candidates are $x=2$ and $x=-1$.",
      "Check $x=2$: $\\sqrt{4}=2$ and the right side is 2. They agree.",
      "Check $x=-1$: $\\sqrt{1}=1$ but the right side is −1. They disagree.",
      "At $x=-1$ the right side is negative, which no principal square root can equal. It solves $\\sqrt{x+2}=-x$ instead, so it is extraneous.",
    ],
    answer: "$x=2$ only",
  },
  closingSections: [
    {
      stage: "method",
      title: "Isolate first, and a zero boundary",
      paragraphs: [
        "In $\\sqrt{x+6}+2=x+2$, isolate the root first: $\\sqrt{x+6}=x$. Squaring gives $x+6=x^2$, so $(x-3)(x+2)=0$. Check $x=3$: $\\sqrt9=3$, which agrees. Check $x=-2$: $\\sqrt4=2$ but the isolated right side is $-2$, so $x=-2$ is extraneous. Always check against the isolated form, where the right side must not be negative.",
        "A right side equal to 0 is allowed: $\\sqrt0=0$. A candidate that makes the isolated right side exactly 0 is valid, and one that makes it negative is extraneous.",
      ],
    },
    {
      stage: "formal",
      title: "Why the squared equation has more solutions",
      paragraphs: [
        "For real $A\\ge0$, $A^2=B^2$ holds exactly when $A=B$ or $A=-B$. The original equation $\\sqrt{R}=B$ asks for $\\sqrt R=B$. The squared equation $R=B^2$ also holds when $\\sqrt R=-B$. These two cases agree only when $B\\ge0$.",
      ],
    },
  ],
  pitfalls: [
    "Substitute into the original equation, not the squared one.",
    "A candidate that makes the isolated right side negative is extraneous.",
    "Isolate the square root before squaring; squaring $\\sqrt{x}+2$ does not remove the root.",
  ],
  parentGuide:
    "Ask what $\\sqrt{1}$ equals and why it cannot equal −1, then check both candidates of $\\sqrt{x+2}=x$.",
};

export const algebraRequirementGapMethods: Record<string, ProblemMethod> = {
  "arithmetic-sequence-as-function": sequenceFunctionMethod,
  "geometric-sequence-as-function": sequenceFunctionMethod,
  "geometric-rule-forms": geometricRuleFormsMethod,
  "solve-by-completing-square": solveByCompletingSquareMethod,
  "complex-quadratic-solve": complexQuadraticSolveMethod,
  "complex-parts": complexPartsMethod,
  "interpret-linear-parameters": interpretLinearParametersMethod,
  "quadratic-form-conversion": quadraticFormConversionMethod,
  "rational-extraneous-single": rationalExtraneousSingleMethod,
  "square-root-extraneous": squareRootExtraneousMethod,
};

export const algebraRequirementGapPrinciples: Record<string, string> = {
  "arithmetic-sequence-as-function": sequenceFunctionPrinciple,
  "geometric-sequence-as-function": sequenceFunctionPrinciple,
  "geometric-rule-forms": geometricRuleFormsPrinciple,
  "solve-by-completing-square": solveByCompletingSquarePrinciple,
  "complex-quadratic-solve": complexQuadraticSolvePrinciple,
  "complex-parts": complexPartsPrinciple,
  "interpret-linear-parameters": interpretLinearParametersPrinciple,
  "quadratic-form-conversion": quadraticFormConversionPrinciple,
  "rational-extraneous-single": rationalExtraneousSinglePrinciple,
  "square-root-extraneous": squareRootExtraneousPrinciple,
};

export const algebraRequirementGapLessons: Lesson[] = [
  sequenceFunctionLesson,
  geometricRuleFormsLesson,
  solveByCompletingSquareLesson,
  complexQuadraticSolveLesson,
  complexPartsLesson,
  interpretLinearParametersLesson,
  quadraticFormConversionLesson,
  rationalExtraneousSingleLesson,
  squareRootExtraneousLesson,
];
