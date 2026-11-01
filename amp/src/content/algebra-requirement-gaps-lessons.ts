import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const sequenceFunctionMethod: ProblemMethod = {
  goal: "Treat a sequence rule as a function of the position $n$: name its domain, evaluate $a(n)$, and decide which inputs have a term.",
  intuition:
    "A sequence is a list with a first term, a second term and so on. Writing $a(n)$ for the term in position $n$ turns the list into a function: the input is the position and the output is the term. Positions are counting numbers, so there is no term at position 2.5, 0 or −3.",
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
  method: [
    "Read $n$ as a position. Only whole-number positions from the first one on are inputs.",
    "To find $a(k)$, substitute $n=k$ into the rule and evaluate the exponent or multiple $n-1$ first.",
    "An input that is not a position (a fraction, 0 or a negative number) has no term, so $a$ is undefined there.",
    "To test whether a value is a term, compute terms around it. It is a term only if some whole-number position produces it.",
  ],
  watch:
    "A formula can be evaluated at 2.5, but the sequence has no 2.5th term. The domain is the whole numbers from the first position, so the graph is separate points, never a connected line or curve.",
};

const sequenceFunctionPrinciple =
  "A sequence is a function whose domain is a set of consecutive integers, usually $\\{1,2,3,\\ldots\\}$. Its graph is the set of points $(n,a(n))$ for those integers only. An arithmetic rule $a(n)=a_1+d(n-1)$ gives points on a line; a geometric rule $a(n)=a_1r^{n-1}$ gives points with constant ratio.";

const sequenceFunctionLesson: Lesson = {
  id: "sequence-as-function",
  title: "A sequence is a function of position",
  summary:
    "The input is the position $n$, a counting number, and the output is the term $a(n)$. Inputs between the positions do not exist.",
  templateIds: [
    "arithmetic-sequence-as-function",
    "geometric-sequence-as-function",
  ],
  objectives: [
    "Name the domain of a sequence and say why $a(2.5)$ is undefined.",
    "Evaluate $a(n)$ from a rule written in function notation.",
    "Describe the graph of a sequence as separate points and decide whether a value is a term.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "A list is a function",
      paragraphs: [
        "A sequence is an ordered list of numbers, such as 5, 8, 11, 14. Each term has a position: 5 is in position 1, 8 is in position 2. Write $a(n)$ for the term in position $n$. Then $a(1)=5$ and $a(3)=11$.",
        "A function assigns one output to each allowed input. Here the input is the position and the output is the term. The allowed inputs, the domain, are the positions that exist: $1,2,3,\\ldots$. There is no “2.5th” term in a list, so $a(2.5)$ has no meaning.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A sequence is defined by $a(n)=5+3(n-1)$ for $n=1,2,3,\\ldots$. Find $a(4)$, decide whether $a(2.5)$ is defined, and decide whether 10 is a term.",
    steps: [
      "Substitute $n=4$: $a(4)=5+3(3)=14$.",
      "The domain is the positive integers. Since 2.5 is not a position, $a(2.5)$ is undefined, even though the formula could be computed.",
      "The terms are 5, 8, 11, 14. The value 10 falls between $a(2)=8$ and $a(3)=11$, and the sequence increases by 3 each step, so no other term equals 10.",
      "No whole-number position lies between 2 and 3, so 10 is not a term.",
    ],
    answer: "$a(4)=14$; $a(2.5)$ is undefined; 10 is not a term",
  },
  closingSections: [
    {
      stage: "method",
      title: "The graph is separate points",
      paragraphs: [
        "Graph the points $(n,a(n))$ with $n$ across and the term up. For the example they are $(1,5)$, $(2,8)$, $(3,11)$, $(4,14)$, and so on. Only whole-number inputs belong to the domain, so there are no points between them and the points are not joined.",
        "For an arithmetic sequence, equal steps in $n$ change the output by equal amounts, so the separate points lie on one line. For a geometric sequence, equal steps in $n$ multiply the output by the same ratio, so the points do not lie on a line.",
      ],
    },
    {
      stage: "formal",
      title: "Sequences as functions on the integers",
      paragraphs: [
        "A sequence is a function $a$ whose domain is a set of consecutive integers, usually the positive integers. The notation $a_n$ means the same as $a(n)$. A rule such as $a(n)=a_1+d(n-1)$ or $a(n)=a_1r^{n-1}$ describes the output for every integer in the domain.",
        "A real number outside the domain is not an input of the function. Substituting it into the formula does not create a term.",
      ],
    },
  ],
  pitfalls: [
    "Do not treat the formula as defined for every real number: a sequence has terms only at whole-number positions.",
    "Evaluate $n-1$ before using it. $a(4)$ uses $n-1=3$, not 4.",
    "Do not join the graph's points with a line or curve.",
  ],
  parentGuide:
    "Ask whether the list has a term between the second and the third, then use that answer to explain why the graph is separate points.",
};

const geometricRuleFormsMethod: ProblemMethod = {
  goal: "Translate a geometric sequence between its recursive rule and its explicit rule, from a rule, a description or two consecutive terms.",
  intuition:
    "In a geometric sequence each term is the previous term times the same number, the common ratio. A recursive rule says where the list starts and how to get from one term to the next. An explicit rule jumps straight to any term from its position.",
  terms: ["common-ratio", "recursive-rule", "explicit-rule"],
  method: [
    "Find the first term $a_1$ and the common ratio $r$. From two consecutive terms, $r$ is the later term divided by the earlier one; undo one multiplication to get $a_1$.",
    "Recursive form: $a_1$ and $a_{n+1}=r\\,a_n$.",
    "Explicit form: $a_n=a_1\\,r^{\\,n-1}$. The exponent is $n-1$ because $a_1$ has had no multiplications.",
    "Check by evaluating $n=1$ and $n=2$ in the form you wrote.",
  ],
  watch:
    "The exponent is $n-1$, not $n$. Also, a term you are given in the middle of the list is not $a_1$ unless it is stated to be the first.",
};

const geometricRuleFormsPrinciple =
  "For a geometric sequence with first term $a_1$ and common ratio $r\\ne 0$, the recursive rule $a_1$, $a_{n+1}=r\\,a_n$ and the explicit rule $a_n=a_1r^{n-1}$ define the same sequence for every positive integer $n$.";

const geometricRuleFormsLesson: Lesson = {
  id: "geometric-rule-forms",
  title: "Recursive and explicit rules for a geometric sequence",
  summary:
    "A recursive rule steps from one term to the next; an explicit rule jumps to any position. Both come from the first term and the common ratio.",
  templateIds: ["geometric-rule-forms"],
  objectives: [
    "Write the explicit rule from a recursive rule and the recursive rule from an explicit one.",
    "Build either rule from a description, or from two consecutive terms.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Two ways to describe the same list",
      paragraphs: [
        "In 2, 6, 18, 54 each term is 3 times the one before. The number 3 is the common ratio. You can describe the list by its start and its step, “start at 2 and multiply by 3 each time,” or by a formula that gives the term in any position directly.",
        "The first description is recursive: $a_1=2$ and $a_{n+1}=3a_n$. The second is explicit: $a_n=2\\cdot 3^{n-1}$.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "A geometric sequence has $a_2=12$ and $a_3=36$. Write its explicit rule and its recursive rule.",
    steps: [
      "The common ratio is $a_3\\div a_2=36\\div 12=3$.",
      "Undo one multiplication to find the first term: $a_1=a_2\\div 3=4$.",
      "Explicit rule: $a_n=4\\cdot 3^{n-1}$. Check: $a_2=4\\cdot 3=12$ and $a_3=4\\cdot 9=36$.",
      "Recursive rule: $a_1=4$ and $a_{n+1}=3a_n$.",
    ],
    answer: "$a_n=4\\cdot 3^{n-1}$; $a_1=4,\\ a_{n+1}=3a_n$",
  },
  closingSections: [
    {
      stage: "method",
      title: "Why the exponent is one less than the position",
      paragraphs: [
        "Going from $a_1$ to $a_2$ multiplies once; to $a_3$, twice; to $a_n$, $n-1$ times. So $a_n=a_1r^{n-1}$. The same reading works backward: in $a_n=5\\cdot 2^{n-1}$ the first term is 5 (put $n=1$) and the ratio is 2.",
        "The ratio can be negative or a fraction: $a_n=8\\left(\\frac12\\right)^{n-1}$ halves each term, and $a_n=3(-2)^{n-1}$ alternates signs.",
      ],
    },
    {
      stage: "formal",
      title: "Equivalence of the two rules",
      paragraphs: [
        "If $a_{n+1}=r\\,a_n$ for every $n\\ge1$, then $a_2=ra_1$, $a_3=r^2a_1$, and by induction $a_n=r^{n-1}a_1$. Conversely, if $a_n=a_1r^{n-1}$ then $a_{n+1}=a_1r^n=r\\cdot a_1r^{n-1}=r\\,a_n$.",
      ],
    },
  ],
  pitfalls: [
    "Use $n-1$ as the exponent so that $n=1$ gives the first term.",
    "A term given in the middle of the list is not $a_1$; divide by the ratio to get back to the first term.",
    "Adding the ratio each step describes an arithmetic sequence, not a geometric one.",
  ],
  parentGuide:
    "Ask for the first three terms of $a_n=4\\cdot3^{n-1}$ and ask what each one is multiplied by to get the next.",
};

const solveByCompletingSquareMethod: ProblemMethod = {
  goal: "Solve a quadratic equation by completing the square and give the exact solutions.",
  intuition:
    "A quadratic with an $x$ term is hard to undo directly. Rewriting one side as a perfect square, $(x+h)^2$, lets you undo it with a square root.",
  terms: [
    "completing-the-square",
    [
      "plus-or-minus",
      "A positive number has two square roots, one of each sign: $x^2 = 9$ gives $x = \\pm 3$.",
    ],
  ],
  method: [
    "If the leading coefficient is not 1, divide every term by it.",
    "Move the constant to the right side: $x^2+bx=-c$.",
    "Add $\\left(\\frac b2\\right)^2$ to both sides and factor the left side: $\\left(x+\\frac b2\\right)^2=\\left(\\frac b2\\right)^2-c$.",
    "Take both square roots, then subtract $\\frac b2$. Keep a radical when the right side is not a perfect square.",
  ],
  watch:
    "Add the square to both sides, not just the left. Take both roots ($\\pm$), and subtract the shift: the solutions are centered at $-\\frac b2$.",
};

const solveByCompletingSquarePrinciple =
  "For real $b$ and $c$, $x^2+bx+c=0$ is equivalent to $\\left(x+\\frac b2\\right)^2=\\frac{b^2}{4}-c$. If the right side is positive, the real solutions are $x=-\\frac b2\\pm\\sqrt{\\frac{b^2}{4}-c}$; if it is 0 there is one solution, and if it is negative there are no real solutions.";

const solveByCompletingSquareLesson: Lesson = {
  id: "solve-by-completing-square",
  title: "Solve a quadratic by completing the square",
  summary:
    "Add the right number to both sides so one side is a perfect square, then undo the square with $\\pm$ square roots.",
  templateIds: ["solve-by-completing-square"],
  objectives: [
    "Complete the square on both sides of an equation and factor the left side.",
    "Solve for $x$ with both roots, including solutions that contain a radical.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "Make one side a perfect square",
      paragraphs: [
        "A perfect square such as $(x+3)^2$ can be undone by a square root: $x+3=\\pm5$. The expression $x^2+6x$ is not yet a square, but it becomes one after adding 9: $x^2+6x+9=(x+3)^2$. The number to add is the square of half the coefficient of $x$.",
        "An equation stays true if you add the same number to both sides, so adding 9 on the left means adding 9 on the right too.",
      ],
    },
  ],
  workedExample: {
    prompt: "Solve $x^2+6x-7=0$ by completing the square.",
    steps: [
      "Move the constant: $x^2+6x=7$.",
      "Half of 6 is 3, and $3^2=9$. Add 9 to both sides: $x^2+6x+9=16$.",
      "Factor the left side: $(x+3)^2=16$.",
      "Take both square roots: $x+3=\\pm4$, so $x=-3\\pm4$.",
      "The solutions are $x=1$ and $x=-7$. Check $x=1$: $1+6-7=0$.",
    ],
    answer: "$x=1$ or $x=-7$",
  },
  closingSections: [
    {
      stage: "method",
      title: "Irrational solutions and other coefficients",
      paragraphs: [
        "If the right side is not a perfect square, keep the root. For $x^2+4x-1=0$: $x^2+4x+4=5$, so $(x+2)^2=5$ and $x=-2\\pm\\sqrt5$. These are the exact solutions.",
        "If the leading coefficient is not 1, divide first: $2x^2+12x+10=0$ becomes $x^2+6x+5=0$. When $b$ is odd, half of it is a fraction: for $x^2+3x-1=0$ add $\\frac94$ to get $\\left(x+\\frac32\\right)^2=\\frac{13}4$, so $x=\\frac{-3\\pm\\sqrt{13}}{2}$.",
      ],
    },
    {
      stage: "formal",
      title: "Why the method works",
      paragraphs: [
        "Expanding gives $\\left(x+\\frac b2\\right)^2=x^2+bx+\\frac{b^2}{4}$. Adding $\\frac{b^2}{4}$ to both sides of $x^2+bx=-c$ therefore gives $\\left(x+\\frac b2\\right)^2=\\frac{b^2}{4}-c$. A square equals a nonnegative number $s$ exactly when the base is $\\sqrt s$ or $-\\sqrt s$.",
      ],
    },
  ],
  pitfalls: [
    "Add the square to both sides of the equation.",
    "Use half of the coefficient of $x$, not the whole coefficient.",
    "Take $\\pm$ the square root and then subtract the shift: $(x+3)^2=16$ gives $x=-3\\pm4$, not $x=3\\pm4$.",
  ],
  parentGuide:
    "Ask which number must be added to $x^2+6x$ to make a perfect square, and why it has to be added to both sides.",
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
  goal: "Say what the slope and the initial value of a linear model mean in its context, with units.",
  intuition:
    "In a linear model $y=mx+b$, the number $m$ says how much $y$ changes for each one-unit increase in $x$. The number $b$ is the value of $y$ when $x$ is 0, where the model starts.",
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
    "Identify the input and output with their units.",
    "Slope: say that the output increases (positive $m$) or decreases (negative $m$) by $|m|$ output units for each additional input unit.",
    "Initial value: substitute input 0. State the output at that starting input, with units.",
    "Check that the units of the slope are output per input and that the initial value has the output’s units.",
  ],
  watch:
    "The slope is the change per unit, not the value after one unit; the value after one unit is $m+b$. The initial value is the value at input 0, which is not always at year 0 or time 0 of the calendar.",
};

const interpretLinearParametersPrinciple =
  "For the linear model $y=mx+b$, equal changes in $x$ give equal changes in $y$: increasing $x$ by 1 changes $y$ by exactly $m$. The value at $x=0$ is $b$. Both interpretations apply within the domain where the model is valid and use the units of the context.";

const interpretLinearParametersLesson: Lesson = {
  id: "interpret-linear-parameters",
  title: "What the slope and starting value mean",
  summary:
    "The slope is the change in the output for each one-unit change in the input; the constant is the output at input 0. State both with units.",
  templateIds: ["interpret-linear-parameters"],
  objectives: [
    "Interpret the slope as a rate of change with units, including a decrease.",
    "Interpret the constant as the value at input 0, including when 0 means a starting year.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "A rate and a starting amount",
      paragraphs: [
        "A plumber charges a fixed fee for coming plus an amount for each hour of work. The model $C=39h+63$ gives the total charge $C$ in dollars for $h$ hours. Each extra hour adds the same 39 dollars: that is the rate of change. Even with 0 hours the charge is $39(0)+63=63$ dollars: that is the starting amount.",
        "Always say what each number means in the situation and attach its units: 39 dollars per hour and 63 dollars.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "The balance on a gift card is modeled by $B=150-12w$, where $B$ is in dollars and $w$ is the number of weeks after purchase. What do 12 and 150 mean?",
    steps: [
      "Compare two inputs one week apart: $B(1)=138$ and $B(2)=126$. The balance drops by 12 dollars each week.",
      "The slope is $-12$: the balance decreases by 12 dollars for each additional week (12 dollars per week).",
      "Put $w=0$: $B=150$. The initial value is the balance at purchase.",
      "So 12 is the weekly decrease and 150 dollars is the starting balance. After one week the balance is 138, not 12.",
    ],
    answer:
      "The balance decreases by 12 dollars each week; it starts at 150 dollars",
  },
  closingSections: [
    {
      stage: "method",
      title: "When 0 is not the beginning of time",
      paragraphs: [
        "In $N=1200+85t$, where $N$ is the number of subscribers and $t$ is the number of years after 2018, the input 0 means 2018. So 1200 is the number of subscribers in 2018, not at the year 0 of the calendar, and 85 is the number of subscribers added per year.",
        "A decreasing model has a negative slope. In $D=240-55t$, where $D$ is the distance remaining in miles and $t$ is the hours driven, the distance remaining shrinks by 55 miles per hour, and 240 miles is the distance at the start of the trip.",
      ],
    },
    {
      stage: "formal",
      title: "Slope and intercept as changes and values",
      paragraphs: [
        "For $f(x)=mx+b$, $f(x+1)-f(x)=m$ for every $x$, so $m$ is the constant rate of change. Also $f(0)=b$. A rate of change has the units of the output divided by the units of the input.",
      ],
    },
  ],
  pitfalls: [
    "The slope is the change per unit of input, not the output after one unit.",
    "Say increase or decrease according to the sign of the slope.",
    "State the units of both numbers, and say what an input of 0 means when the input is measured from a starting point.",
  ],
  parentGuide:
    "Ask what the charge is for a 0-hour job and how much it grows with each extra hour, then connect those answers to 63 and 39.",
};

const quadraticFormConversionMethod: ProblemMethod = {
  goal: "Rewrite a quadratic in factored or vertex form and read its zeros, axis of symmetry, vertex or extreme value.",
  intuition:
    "One quadratic can be written in several equivalent forms. Each form makes a different feature visible: the factored form shows the zeros, the vertex form shows the vertex and the extreme value, and the standard form shows the $y$-intercept.",
  terms: ["zero-of-a-function", "vertex-form", "axis-of-symmetry"],
  method: [
    "To see zeros: factor, then set each factor to 0. The axis of symmetry is halfway between the zeros.",
    "To see the vertex or extreme value: complete the square. Factor out $a$ from the $x$ terms, add and subtract the needed square, remember the added amount is multiplied by $a$.",
    "Read $(h,k)$ from $a(x-h)^2+k$. The extreme value is a minimum if $a>0$, a maximum if $a<0$.",
  ],
  watch:
    "In $a(x-h)^2+k$ the vertex has $x=h$, the opposite sign from what is inside the parentheses. The $y$-intercept and the zeros are not the extreme value.",
};

const quadraticFormConversionPrinciple =
  "A quadratic function $f(x)=ax^2+bx+c$ with $a\\ne0$ equals $a(x-h)^2+k$ with $h=-\\frac{b}{2a}$ and $k=f(h)$, and when $f$ has zeros $p$ and $q$ it equals $a(x-p)(x-q)$. Its axis of symmetry is $x=h=\\frac{p+q}{2}$, and $k$ is its minimum if $a>0$ or its maximum if $a<0$.";

const quadraticFormConversionLesson: Lesson = {
  id: "quadratic-form-conversion",
  title: "Choose the form that shows a feature",
  summary:
    "Factoring shows where a quadratic is zero; completing the square shows its vertex and its minimum or maximum.",
  templateIds: ["quadratic-form-conversion"],
  objectives: [
    "Rewrite a quadratic in vertex form and read its vertex and extreme value.",
    "Factor to find zeros and use them to find the axis of symmetry.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "One function, different views",
      paragraphs: [
        "The function $y=x^2-6x+5$ can also be written $(x-1)(x-5)$ and $(x-3)^2-4$. All three give the same output for every $x$. The factored form shows at a glance that $y=0$ when $x=1$ or $x=5$. The vertex form shows that $(x-3)^2$ is never negative, so $y$ is never less than $-4$, reached at $x=3$.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "For $y=x^2-6x+5$, find the zeros, the axis of symmetry, and the minimum value.",
    steps: [
      "Factor: two numbers with product 5 and sum −6 are −1 and −5, so $y=(x-1)(x-5)$.",
      "Each factor is zero at its own number: the zeros are $x=1$ and $x=5$.",
      "The axis of symmetry is halfway between the zeros: $\\frac{1+5}{2}=3$, so $x=3$.",
      "Complete the square: half of −6 is −3, and $(-3)^2=9$, so $y=(x^2-6x+9)+5-9=(x-3)^2-4$.",
      "The minimum value is $-4$, reached at $x=3$. Check: $3^2-18+5=-4$.",
    ],
    answer: "zeros 1 and 5; axis $x=3$; minimum $-4$",
  },
  closingSections: [
    {
      stage: "method",
      title: "A leading coefficient and a maximum",
      paragraphs: [
        "For $y=-2x^2+8x+1$, factor $-2$ from the $x$ terms: $y=-2(x^2-4x)+1$. Adding 4 inside the parentheses adds $-2\\cdot4=-8$, so add 8 outside: $y=-2(x-2)^2+9$. Since $-2<0$, the squared term is at most 0, so the maximum value is 9 at $x=2$.",
        "Standard form $ax^2+bx+c$ shows the $y$-intercept $c$ directly. Choose the form by the feature you need.",
      ],
    },
    {
      stage: "formal",
      title: "Forms and features",
      paragraphs: [
        "Expanding $a(x-h)^2+k$ gives $ax^2-2ahx+ah^2+k$, so $h=-\\frac b{2a}$ and $k=c-ah^2$. Expanding $a(x-p)(x-q)$ gives $ax^2-a(p+q)x+apq$, so the axis $x=h=\\frac{p+q}2$.",
      ],
    },
  ],
  pitfalls: [
    "The vertex of $(x-3)^2-4$ is $(3,-4)$; the sign inside the parentheses is opposite the $x$-value.",
    "When $a\\ne1$, the number added inside the parentheses is multiplied by $a$ before you subtract it outside.",
    "The zeros are inputs; the extreme value is an output.",
  ],
  parentGuide:
    "Ask which form shows the zeros of $y=x^2-6x+5$ most directly and which form shows its lowest point.",
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
