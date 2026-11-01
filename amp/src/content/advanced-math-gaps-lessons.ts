import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const amgSenses = {
  term: "term-sequence",
  terms: "term-sequence",
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  products: "product-multiply",
  square: "square-number",
  squares: "square-number",
  difference: "difference-subtract",
  differences: "difference-subtract",
  root: "root-radical",
  roots: "root-radical",
  balance: "balance-account",
  side: "side-of-equation",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};
const amgNoLink = [
  "part",
  "parts",
  "whole",
  "more than",
  "cube",
  "cubes",
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
];
const compoundSenses = {
  ...amgSenses,
  factor: "growth-factor",
  factors: "growth-factor",
};
const patternSenses = {
  ...amgSenses,
  term: "term-expression",
  terms: "term-expression",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
  balance: "balance-account",
};

export const advancedMathGapMethods: Record<string, ProblemMethod> = {
  "series-recursion": {
    goal: "Add up an arithmetic series, switch between step-by-step and direct rules, or find a term from a table or a step rule.",
    intuition:
      "A sequence is a list of numbers in order, and each number is a term. We write $a_1$ for the first term and $a_n$ for the term in position $n$. In an arithmetic sequence, the same number, called the common difference $d$, is added at every step: 5, 8, 11, 14 adds 3. A recursive rule gives the first term and how to get each term from the one before. An explicit rule gives term $n$ directly from $n$. A series is the sum of the terms.",
    terms: ["recursive-rule", "explicit-rule", "series"],
    senses: amgSenses,
    noLink: amgNoLink,
    method: [
      "Find the first term and the common difference. From two table entries, divide the change in value by the number of steps between them.",
      "To jump to term $n$, count $n - 1$ steps from the first term: $a_n = a_1 + (n - 1)d$. To check a rule you converted, put in $n = 1$.",
      "For a sum, pair each term with its partner from the other end. The sum of $n$ terms is $n$ times the average of the first and last terms. For a step rule that is not arithmetic, work one term at a time.",
    ],
    watch:
      "Count steps, not terms: term $n$ is $n - 1$ steps after term 1. In a table, divide the change in value by the number of steps.",
  },
  "compound-growth": {
    goal: "Find a balance with compound interest, or switch between a yearly growth rate and the rate for one shorter period.",
    intuition:
      "Interest is money a bank adds to a balance. Compound interest means interest already added earns interest too. A growth factor is the number the balance is multiplied by each period: 5% interest multiplies by 1.05. Compounding $n$ times a year splits the yearly rate $r$ (as a decimal) into $n$ equal parts, $\\frac{r}{n}$. Each period then multiplies the balance by $1 + \\frac{r}{n}$. So after $t$ years, $A = P\\left(1 + \\frac{r}{n}\\right)^{nt}$, where $P$ is the starting amount.",
    terms: [
      [
        "compound-interest",
        "The compounding period is the time between interest additions, such as a month or a quarter.",
      ],
      [
        "growth-factor",
        "For a $100p$% increase it is $1+p$; for a $100p$% decrease it is $1-p$.",
      ],
      [
        "compound-interest",
        "Compounding more and more often approaches continuous compounding, $A=Pe^{rt}$, with the rate $r$ as a decimal.",
      ],
    ],
    senses: compoundSenses,
    noLink: amgNoLink,
    method: [
      "Write the yearly rate as a decimal. For $n$ compoundings a year, use $A = P\\left(1 + \\frac{r}{n}\\right)^{nt}$. For continuous compounding, use $A = Pe^{rt}$.",
      "To change time units, keep the same total growth. A yearly factor $F$ becomes $F^{1/12}$ per month, and a monthly factor $G$ becomes $G^{12}$ per year.",
      "Round only at the end, as the problem says. To turn a yearly factor into a percent change, subtract 1.",
    ],
    watch:
      "To match growth over a different time step, use powers and roots (which undo powers) of the growth factor. Dividing a yearly growth factor by 12 does not give the monthly one.",
  },
  "polynomial-factoring-patterns": {
    goal: "Choose the complete factorization of a polynomial with an $x^3$ or $x^4$ term, using whole-number coefficients.",
    intuition:
      "Factoring writes an expression as factors, the parts multiplied together. Some expressions follow a pattern that factors them. A cube is something times itself three times: $8x^3 = (2x)^3$. A cube sum or cube difference, like $x^3 + 8$ or $x^3 - 8$, factors into a two-term bracket times a three-term bracket. The parts joined by $+$ or $-$ are called terms. Four terms can often be split into two pairs that share a bracket. An expression with only $x^4$, $x^2$ and a number acts like a quadratic in $x^2$. The factoring is complete when no factor can be split again using integers, which are the numbers 0, 1, 2, 3, … and their negatives.",
    terms: [
      "sum-or-difference-of-cubes",
      "factoring-by-grouping",
      [
        "quadratic",
        "$x^4 - 5x^2 + 4$ is quadratic in form: with $u = x^2$, it becomes $u^2 - 5u + 4$.",
      ],
    ],
    senses: patternSenses,
    noLink: amgNoLink,
    method: [
      "Take out any shared factor first. Then count terms. Two terms suggest cubes or a difference of squares. Four terms suggest grouping. Only $x^4$, $x^2$ and a number suggest writing $u = x^2$.",
      "Use the pattern: $u^3 + v^3 = (u + v)(u^2 - uv + v^2)$ and $u^3 - v^3 = (u - v)(u^2 + uv + v^2)$. Or group in pairs, or factor the quadratic in $u$ and put $x^2$ back.",
      "Test every factor again. A difference of squares $x^2 - c^2$ splits further. A sum $x^2 + c$ with $c > 0$ does not, and the three-term bracket from a cube pattern in $x$, like $x^2 - 2x + 4$, does not either.",
    ],
    watch:
      "Stopping at $(x^2 - 4)(x^2 - 9)$ is not complete, because each bracket is a difference of squares. In a cube pattern, the middle term is $uv$, not $2uv$, with the opposite sign.",
  },
  "residual-function-fit": {
    goal: "Use a residual plot or a table to choose a model type, or find and explain a residual from a curved model.",
    intuition:
      "A model is a rule that predicts a value, like $\\hat{y} = 3 \\times 2^x$ (the hat on $y$ marks a prediction). A residual is how far off one prediction is: the observed value minus the predicted value. A positive residual means the real point is above the model. A negative residual means it is below. A residual plot graphs the residuals. If the model fits well, the residuals scatter above and below 0 with no pattern. A curve in the residuals shows a bend the model missed.",
    terms: [
      "residual",
      "residual-plot",
      [
        "linear-function",
        "Linear data show equal differences, quadratic data equal second differences, and exponential data multiply by the same number each step.",
      ],
      "quadratic",
      "exponential-function",
    ],
    senses: amgSenses,
    noLink: amgNoLink,
    method: [
      "For a residual plot, read from left to right. Random scatter close to 0 means the model type fits. Positive, then negative, then positive means the data bend upward away from the line. Negative, positive, negative means they bend downward.",
      "For a table with equally spaced inputs, find the differences between neighbouring values, then the differences of those, called second differences, then the ratios (one value divided by the one before). Equal first differences mean linear, equal second differences (not 0) mean quadratic, and equal positive ratios mean exponential.",
      "For a residual, work out the model's prediction at the input, then subtract: observed minus predicted. Negative means the model predicted too high. Positive means it predicted too low.",
    ],
    watch:
      "Residuals of both signs are normal. The shape of the pattern, not the signs, is the clue that the model type may be wrong. Always subtract observed minus predicted.",
  },
  "function-graph-features": {
    goal: "Read the intercept, asymptote, domain, range or end behavior of an exponential or logarithmic function from its equation or graph.",
    intuition:
      "An exponential function $a\\cdot b^x+k$ levels off at the height $k$ in one direction and grows or falls without bound in the other. A logarithmic function $a\\log_b(x-h)+k$ is built from the inverse of an exponential function: it lives to the right of a vertical line $x=h$ and climbs or falls slowly.",
    terms: ["horizontal-asymptote", "vertical-asymptote", "end-behavior"],
    method: [
      "For $a\\cdot b^x+k$: the horizontal asymptote is $y=k$; the $y$-intercept is $a+k$; the range is above $k$ when $a>0$ and below $k$ when $a<0$. It is increasing when $a>0,b>1$ or $a<0,b<1$.",
      "For $a\\log_b(x-h)+k$: the input must be positive, so the domain is $x>h$ and the vertical asymptote is $x=h$. When $k=0$ the $x$-intercept is $(h+1,0)$.",
      "For end behavior, decide which direction makes $b^x$ grow and which makes it approach 0. Apply the sign of $a$ and the shift $k$. On a graph, read each feature from the grid.",
    ],
    watch:
      "The asymptote is set by the added constant, not by the $y$-intercept. In $\\log_b(x+3)$ the shift moves the asymptote to $x=-3$, the opposite sign of the number written.",
  },
};

export const advancedMathGapPrinciples: Record<string, string> = {
  "series-recursion":
    "For an arithmetic sequence with first term $a_1$ and common difference $d$, the step rule $a_{n+1} = a_n + d$ gives the same list as $a_n = a_1 + (n - 1)d$. The sum of the first $n$ terms is $S_n = \\tfrac{n}{2}(a_1 + a_n)$. A term of any step-by-step sequence is found by applying its rule from the first term.",
  "compound-growth":
    "With yearly rate $r$ (a decimal) compounded $n$ times a year for $t$ years, a deposit $P$ grows to $A = P\\left(1 + \\frac{r}{n}\\right)^{nt}$. Continuous compounding gives $A = Pe^{rt}$. A yearly factor $F$ equals a factor $F^{1/n}$ for each of $n$ equal periods, and a period factor $G$ equals $G^n$ per year.",
  "polynomial-factoring-patterns":
    "$u^3 + v^3 = (u + v)(u^2 - uv + v^2)$ and $u^3 - v^3 = (u - v)(u^2 + uv + v^2)$. If two pairs of terms share a bracket, it factors out. $x^4 + bx^2 + c$ equals $u^2 + bu + c$ with $u = x^2$. Using integers, $x^2 - c^2$ factors and $x^2 + c$ with $c > 0$ does not.",
  "residual-function-fit":
    "For a model $\\hat{y} = f(x)$ and a data point $(x, y)$, the residual is $y - f(x)$, observed minus predicted. Equally spaced exact data are linear when first differences are equal, quadratic when second differences are equal and not 0, and exponential when neighbouring ratios are equal and positive, not 1. A pattern in the residuals shows the model type misses something in the data.",
  "function-graph-features":
    "For $f(x)=a\\,b^x+k$ with $a\\ne0$, $b>0$, $b\\ne1$, the line $y=k$ is a horizontal asymptote and the range is $y>k$ if $a>0$, $y<k$ if $a<0$. For $g(x)=a\\log_b(x-h)+k$, the domain is $x>h$ and $x=h$ is a vertical asymptote.",
};

export const advancedMathGapLessons: Lesson[] = [
  {
    id: "series-recursion",
    title: "Arithmetic series and recursive rules",
    summary:
      "The list 5, 8, 11, 14 adds 3 at every step. You can build it one number at a time, or use a formula that jumps straight to any position. To add up the numbers, pair the first with the last: $5 + 14 = 19$, and $8 + 11 = 19$ too. Two pairs of 19 make 38, so the total is 38.",
    templateIds: ["series-recursion"],
    senses: amgSenses,
    noLink: amgNoLink,
    objectives: [
      "Switch between a step-by-step (recursive) rule and a direct (explicit) rule for an arithmetic sequence.",
      "Find a term from two entries of a table, or from a step rule that is not arithmetic.",
      "Add up an arithmetic series using its first and last terms.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Build a term, or jump to it",
        paragraphs: [
          "A sequence is a list of numbers in order, and each number is a term. We label terms with a small number written low, called a subscript: $a_1$ is the first term and $a_n$ is the term in position $n$. In an arithmetic sequence, the same number is added at every step. That number is called the common difference, $d$.",
          "A recursive rule gives the first term and how to get the next one: $a_1 = 5$ and $a_{n+1} = a_n + 3$. Here $a_{n+1}$ is the term right after $a_n$. An explicit rule gives any term at once from its position: $a_n = 3n + 2$. Both describe the same list, 5, 8, 11, 14 and so on.",
          "A series is the sum of the terms. Write $5 + 8 + 11 + 14$, and below it the same sum backwards, $14 + 11 + 8 + 5$. Each column adds to 19. So two copies of the sum make $4 \\times 19 = 76$, and one copy is $76 \\div 2 = 38$. That pairing works for any arithmetic sum.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find $5+8+11+\\cdots$ with 12 terms.",
      steps: [
        "Read the first term, 5, and the common difference, $8 - 5 = 3$.",
        "Find the last term. Term 12 is $12 - 1 = 11$ steps after term 1, so $a_{12} = 5 + 11 \\times 3 = 38$.",
        "Pair the first and last terms: $5 + 38 = 43$. Every pair from the two ends also adds to 43. Twelve terms make six pairs, so the sum is $6 \\times 43 = 258$.",
        "Check with the average of the first and last terms: $12 \\times \\frac{5 + 38}{2} = 12 \\times 21.5 = 258$.",
      ],
      answer: "$258$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Convert and sum",
        paragraphs: [
          "To turn the recursive rule $a_1 = A$, $a_{n+1} = a_n + d$ into an explicit rule, count $n - 1$ steps: $a_n = A + (n - 1)d$, which is $dn + (A - d)$. Check that $n = 1$ gives $A$. To go back, put $n = 1$ to find $a_1$, and read $d$ as the number multiplying $n$.",
          "From a table with two terms $a_i$ and $a_j$ (terms in positions $i$ and $j$), the common difference is the change in value divided by the number of steps: $d = \\frac{a_j - a_i}{j - i}$.",
          "Some step rules are not arithmetic, such as $a_{n+1} = 2a_n - 1$ starting at $a_1 = 2$: 2, 3, 5, 9. The steps are not equal, so the arithmetic formulas do not apply. Work it one term at a time.",
        ],
      },
      {
        stage: "formal",
        title: "Why the sum formula works",
        paragraphs: [
          "Let $S_n = a_1 + a_2 + \\cdots + a_n$ be the sum of the first $n$ terms. Write the same sum in reverse order below it, and add the two lines column by column.",
          "Each column is $a_k + a_{n+1-k}$, and it equals $a_1 + a_n$. Moving one term forward adds $d$ and moving the other back subtracts $d$, so the column total does not change. There are $n$ columns, so $2S_n = n(a_1 + a_n)$, and $S_n = \\tfrac{n}{2}(a_1 + a_n)$.",
        ],
      },
    ],
    pitfalls: [
      "Term $n$ is $n - 1$ steps after term 1, not $n$ steps.",
      "In a table, divide the change in value by the number of steps between the two entries.",
      "Divide $n(a_1 + a_n)$ by 2, because the pairing counts every term twice.",
    ],
    parentGuide:
      "Ask for the first four terms of $a_n = 3n + 2$, then ask which step rule produces them. Check that $5 + 8 + 11 + 14$ equals $4 \\times \\frac{5 + 14}{2}$.",
  },
  {
    id: "compound-growth",
    title: "Compound interest and growth rates",
    summary:
      "A balance is the amount of money in a bank account. A bank pays interest: extra money added to your balance. With compound interest, the interest already added earns interest too. At 10% a year, 100 dollars becomes 110, then 121, not 120. Each year multiplies the balance by the same number, 1.1. To change the time step, such as from years to months, use powers and roots (the reverse of powers) of that number. Dividing 1.1 by 12 does not give the monthly multiplier, the number each month multiplies by.",
    templateIds: ["compound-growth"],
    senses: compoundSenses,
    noLink: amgNoLink,
    objectives: [
      "Find a balance with interest added a set number of times a year, or continuously, rounded as stated.",
      "Switch between a yearly growth factor and the factor for one month or one quarter.",
      "Read the yearly rate and how often interest is added from a formula.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Interest on interest",
        paragraphs: [
          "Percent means out of 100, so 5% is 0.05. A balance that earns 5% a year keeps the whole amount (1) and adds 0.05 of it. So each year multiplies it by 1.05. The number a balance is multiplied by each period is called the growth factor.",
          "Now take a different plan: 5% a year shared across 12 months. Each month earns $\\frac{5\\%}{12}$, about 0.4167%. That month's interest is added before the next month's is worked out, so later months earn interest on a slightly bigger balance. The monthly plan ends the year with a little more. Adding interest this way is called compounding, and each month is a compounding period.",
          "If interest is added $n$ times a year at a yearly rate $r$ (as a decimal), each period multiplies by $1 + \\frac{r}{n}$. Over $t$ years there are $nt$ periods. So a starting amount $P$ grows to $A = P\\left(1 + \\frac{r}{n}\\right)^{nt}$, where the raised $nt$ means multiply that many times.",
          "Compounding more often gives more money, but each extra step gains less. Compounding more and more often, without end, is called continuous compounding. Its formula uses a special number $e$, about 2.718: $A = Pe^{rt}$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A deposit of 2,000 dollars earns 6% annual interest, compounded monthly. What is the balance after 3 years, to the nearest dollar?",
      steps: [
        "Monthly means 12 periods a year, so $n = 12$. Write 6% as 0.06. The rate per month is $0.06 \\div 12 = 0.005$, so each month multiplies the balance by 1.005.",
        "Count the periods: 3 years of 12 months is $12 \\times 3 = 36$ months.",
        "Multiply 2,000 by 1.005 thirty-six times: $A = 2000 \\times 1.005^{36} \\approx 2000 \\times 1.19668 = 2393.36$. The sign $\\approx$ means approximately equal.",
        "Round at the end: 2,393 dollars. For comparison, a yearly growth factor of 1.06 would give $2000 \\times 1.06^3 \\approx 2382$, so monthly compounding earns more.",
      ],
      answer: "2,393 dollars",
    },
    closingSections: [
      {
        stage: "method",
        title: "Choose the formula, then convert units with powers",
        paragraphs: [
          "Interest added $n$ times a year: $A = P\\left(1 + \\frac{r}{n}\\right)^{nt}$. Continuous: $A = Pe^{rt}$. Always write $r$ as a decimal.",
          "A yearly growth factor $F$ and a monthly growth factor $G$ describe the same growth when $G^{12} = F$, that is, twelve months of $G$ make one year of $F$. So $F = 1.12$ gives a monthly growth factor $1.12^{1/12} \\approx 1.0095$, the 12th root of 1.12. That can be written $V = V_0(1.12)^{m/12}$ for $m$ months.",
          "In the other direction, 2% a month gives a yearly growth factor $1.02^{12} \\approx 1.268$. That is a yearly increase of 26.8%, not $12 \\times 2\\% = 24\\%$.",
          "In a formula such as $B(t) = 4000(1.015)^{4t}$, the $4t$ shows 4 periods a year, and 1.015 shows 1.5% a period. So the yearly rate is $4 \\times 1.5\\% = 6\\%$, compounded quarterly.",
        ],
      },
      {
        stage: "formal",
        title: "Why continuous compounding uses Euler's number",
        paragraphs: [
          "With $n$ periods a year, the yearly growth factor is $\\left(1 + \\frac{r}{n}\\right)^n$. As $n$ grows without end, this gets closer and closer to $e^r$, because $\\left(1 + \\frac{x}{n}\\right)^n$ approaches $e^x$. Over $t$ years the factor is $e^{rt}$, so $A = Pe^{rt}$.",
        ],
      },
    ],
    pitfalls: [
      "Divide the yearly rate by $n$ before compounding, and multiply $n$ by $t$ for the exponent.",
      "Do not divide a yearly growth factor by 12 to get a monthly one. Take its 12th root.",
      "Do not multiply a monthly percent by 12 to get the yearly percent. Raise the monthly growth factor to the 12th power and subtract 1.",
    ],
    parentGuide:
      "Have the learner work out 1,000 dollars at 12% for one year, added once (1,120), and added monthly at 1% (about 1,126.83). Ask them to explain why the two differ.",
  },
  {
    id: "polynomial-factoring-patterns",
    title: "Factoring patterns beyond trinomials",
    summary:
      "An expression is a calculation written with numbers and letters. Factoring means writing an expression as parts multiplied together, called factors. Some longer expressions follow patterns that make them easy to factor. For example, $x^4 - 5x^2 + 4$ acts like $u^2 - 5u + 4$ if you let $u = x^2$. That factors as $(u - 1)(u - 4)$, which is $(x^2 - 1)(x^2 - 4)$. Then keep checking each part until none splits any further.",
    templateIds: ["polynomial-factoring-patterns"],
    senses: patternSenses,
    noLink: amgNoLink,
    objectives: [
      "Factor a sum or difference of cubes, including after taking out a shared factor.",
      "Factor a four-term expression by grouping, then test the result for further factoring.",
      "Factor $x^4 + bx^2 + c$ by writing $u = x^2$, and decide when the factoring is complete.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Match the expression to a pattern",
        paragraphs: [
          "You will need to factor quadratics, such as $u^2 - 5u + 4 = (u - 1)(u - 4)$. A factor is a part being multiplied. A square is a number or expression times itself, like $x^2 = x \\times x$. A difference of squares is one square minus another, and it factors as $A^2 - B^2 = (A - B)(A + B)$.",
          "A cube is something multiplied by itself three times: $8x^3 = 2x \\times 2x \\times 2x = (2x)^3$. A sum of two cubes, $u^3 + v^3$, and a difference, $u^3 - v^3$, each factor into a two-term bracket times a three-term bracket.",
          "The parts of an expression joined by $+$ or $-$ are called terms. An expression with four terms can often be split into two pairs that share the same bracket. Then that bracket can be taken out.",
          "An expression with only $x^4$, $x^2$ and a number is a quadratic in disguise. Since $x^4 = (x^2)^2$, writing $u = x^2$ turns it into an ordinary quadratic in $u$.",
          "Integers are 0, 1, 2, 3, … and their negatives. Factoring is complete when no factor can be split again into smaller factors whose coefficients, the numbers in front of each part, are integers.",
        ],
      },
    ],
    workedExample: {
      prompt: "Factor $x^4-5x^2+4$ completely over the integers.",
      steps: [
        "Notice that $x^4 = (x^2)^2$. Let $u = x^2$. The expression becomes $u^2 - 5u + 4$.",
        "Factor the quadratic. The numbers that multiply to 4 and add to $-5$ are $-1$ and $-4$. So $u^2 - 5u + 4 = (u - 1)(u - 4)$.",
        "Put $x^2$ back in place of $u$: $(x^2 - 1)(x^2 - 4)$.",
        "Check each bracket again. Both are differences of squares: $x^2 - 1 = (x - 1)(x + 1)$ and $x^2 - 4 = (x - 2)(x + 2)$. So the complete factoring is $(x - 1)(x + 1)(x - 2)(x + 2)$.",
      ],
      answer: "$(x-1)(x+1)(x-2)(x+2)$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Patterns and the final check",
        paragraphs: [
          "Cubes: $8x^3 + 27 = (2x)^3 + 3^3 = (2x + 3)(4x^2 - 6x + 9)$. The two-term bracket keeps the sign of the original. The three-term bracket has the opposite sign on its middle term and a plus on its last term. For $2x^3 + 16$, take out the shared 2 first: $2(x^3 + 8)$.",
          "Grouping: $x^3 + 3x^2 - 4x - 12 = x^2(x + 3) - 4(x + 3) = (x + 3)(x^2 - 4) = (x + 3)(x - 2)(x + 2)$. The bracket $x^2 - 4$ splits further.",
          "By contrast, $x^3 + 3x^2 + 4x + 12 = (x + 3)(x^2 + 4)$ is complete. A square is never negative, so $x^2 + 4$ is never 0 and has no factor like $x - c$.",
        ],
      },
      {
        stage: "formal",
        title: "Why the cube pattern works",
        paragraphs: [
          "Multiply out: $(u + v)(u^2 - uv + v^2) = u^3 - u^2v + uv^2 + u^2v - uv^2 + v^3 = u^3 + v^3$. The middle terms cancel in pairs. Putting $-v$ in place of $v$ gives $u^3 - v^3 = (u - v)(u^2 + uv + v^2)$.",
          "As a quadratic in $u$, the bracket $u^2 - uv + v^2$ has discriminant $v^2 - 4v^2 = -3v^2$, which is negative when $v \\ne 0$. So it has no real factors of the form $u - c$.",
        ],
      },
    ],
    pitfalls: [
      "In a cube pattern, the middle term of the three-term bracket is $uv$, not $2uv$, and its sign is opposite to the two-term bracket's sign.",
      "After grouping or writing $u = x^2$, test each bracket for a difference of squares.",
      "A sum of squares $x^2 + c$ with $c > 0$ does not factor. It is never 0, so it has no bracket like $x - r$.",
    ],
    parentGuide:
      "Ask the learner to multiply out $(x + 2)(x^2 - 2x + 4)$ to see the middle terms cancel. Then ask why $(x^2 - 4)(x^2 - 1)$ is not finished.",
  },
  {
    id: "residual-function-fit",
    title: "Residuals and choosing a model type",
    summary:
      "A model is a rule that predicts values, like a line or a curve drawn through data. A residual is how far off one prediction is: the real value minus the predicted value. If a model predicts 48 and the real value is 45, the residual is $45 - 48 = -3$. A pattern in many residuals, or in the gaps between values in a table, gives clues about which kind of model fits: a line, a U-shaped curve or an exponential curve.",
    templateIds: ["residual-function-fit"],
    senses: amgSenses,
    noLink: amgNoLink,
    objectives: [
      "Decide from a residual plot whether to keep a straight-line model or switch to a curved one.",
      "Sort equally spaced data into linear, quadratic or exponential from differences and ratios.",
      "Find a residual from a curved model, and say whether the model predicted too high or too low.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What a model leaves behind",
        paragraphs: [
          "A model is a rule that predicts a result from a starting number. The starting number is called the input, and the predicted result is called the output. We write $\\hat{y}$, read “$y$ hat”, for the predicted value, and $y$ for the observed (real) value.",
          "A residual is the observed value minus the predicted value: $y - \\hat{y}$. If the real point is above the model, the residual is positive. If it is below, the residual is negative.",
          "A graph of every residual against its input is called a residual plot. When a model fits well, the residuals fall above and below 0 at random. When they follow a curve, the data bend in a way the model cannot.",
          "For example, residuals that are positive at both ends and negative in the middle mean the data sit above a line at the ends and below it in the middle. So the data curve upward, and a straight line is the wrong shape.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A model predicts $\\hat y=3\\cdot2^x$. At $x=4$ the observed value is 45. Find the residual and say whether the model overestimates or underestimates.",
      steps: [
        "Find the predicted value by putting $x = 4$ into the model: $3 \\times 2^4 = 3 \\times 16 = 48$.",
        "Subtract in the order observed minus predicted: $45 - 48 = -3$.",
        "The residual is negative, so the real point is below the model. The model predicted 3 too high, which means it overestimates by 3.",
      ],
      answer: "$-3$; the model overestimates by 3",
    },
    closingSections: [
      {
        stage: "method",
        title: "Choosing the type from a table",
        paragraphs: [
          "Take $y$-values at equally spaced $x$-values. The first differences are each value minus the one before. If they are equal, the data are linear (a straight line). If not, find the differences of the differences, called second differences. If those are equal and not 0, the data fit a quadratic (a U-shaped curve, which may open downward).",
          "The ratios are each value divided by the one before. If they are equal and positive, the data fit an exponential model: they multiply by the same number each step.",
          "For the values 2, 6, 18, 54, the differences are 4, 12 and 36, which are not equal. The ratios are all 3, so the data are exponential.",
          "A cubic, such as $x^3 + c$, has equal third differences but not equal first or second differences, so it matches none of these three types.",
        ],
      },
      {
        stage: "formal",
        title: "Why differences identify the type",
        paragraphs: [
          "For a line $y = mx + b$ with input spacing $h$, every first difference is $mh$. For $y = ax^2 + bx + c$, the first differences change by the same amount, $2ah^2$, each step. For $y = a \\times b^x$, each value is $b^h$ times the one before.",
          "These hold exactly for exact data. Measured data only come close, which is why residual plots are used.",
        ],
      },
    ],
    pitfalls: [
      "Subtract in the order observed minus predicted.",
      "Residuals of both signs are normal. Look for a pattern in them.",
      "Check second differences and ratios only after the first differences turn out unequal.",
    ],
    parentGuide:
      "Have the learner plot the points $(1, 1)$, $(2, 4)$, $(3, 9)$, $(4, 16)$ and $(5, 25)$ with a straight line drawn near them. Mark the misses above and below the line, and ask the learner to describe their shape.",
  },
  {
    id: "function-graph-features",
    title: "Features of exponential and logarithmic graphs",
    summary:
      "The constants in $a\\cdot b^x+k$ and $a\\log_b(x-h)+k$ set the asymptote, domain, range, direction and intercepts of their graphs.",
    templateIds: ["function-graph-features"],
    objectives: [
      "Find the horizontal asymptote, range and intercept of an exponential graph or equation.",
      "Find the domain and vertical asymptote of a logarithmic function from its equation or graph.",
      "State end behavior and direction from the base and the sign of the coefficient.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Where the curve flattens, and where it cannot go",
        paragraphs: [
          "You need to read a graph and evaluate a power. The power $b^x$ with $b>1$ is always positive, grows quickly to the right and flattens toward 0 on the left. Adding $k$ lifts the whole graph, so it flattens toward $y=k$. A negative coefficient flips the graph over that level.",
          'A logarithm is the inverse of a power: $\\log_b(x)$ answers "which power of $b$ gives $x$?" It exists only for positive $x$, so its graph hugs a vertical line it never reaches. Shifting the input to $x-h$ moves that line to $x=h$.',
        ],
      },
    ],
    workedExample: {
      prompt:
        "For $f(x)=2\\cdot3^x-4$, find the horizontal asymptote, the range, the $y$-intercept and the end behavior.",
      steps: [
        "The power $3^x$ approaches 0 as $x\\to-\\infty$, so $f$ approaches $-4$. The horizontal asymptote is $y=-4$.",
        "The coefficient 2 is positive, so $f$ stays above $-4$. The range is $y>-4$.",
        "At $x=0$: $f(0)=2\\cdot1-4=-2$. The $y$-intercept is $(0,-2)$.",
        "Since $b=3>1$ and $a>0$, $f\\to\\infty$ as $x\\to\\infty$ and $f\\to-4$ as $x\\to-\\infty$. The function is increasing.",
      ],
      answer: "$y=-4$; range $y>-4$; $(0,-2)$; increasing",
    },
    closingSections: [
      {
        stage: "method",
        title: "Read each feature",
        paragraphs: [
          "Exponential $a\\cdot b^x+k$: asymptote $y=k$; $y$-intercept $a+k$; range above $k$ if $a>0$, below if $a<0$; increasing if $a>0$ with $b>1$, or $a<0$ with $0<b<1$.",
          "Logarithmic $a\\log_b(x-h)+k$: domain $x>h$; vertical asymptote $x=h$. With $k=0$ the graph crosses the $x$-axis at $(h+1,0)$, because $\\log_b(1)=0$. For $\\log_2(x+3)$, $h=-3$: the domain is $x>-3$.",
        ],
      },
      {
        stage: "formal",
        title: "Why the features follow",
        paragraphs: [
          "For $b>1$, $b^x\\to0$ as $x\\to-\\infty$ and $b^x\\to\\infty$ as $x\\to\\infty$; for $0<b<1$ the two ends swap. Multiplying by $a$ and adding $k$ gives $a\\,b^x+k\\to k$ at the flat end. Since $b^x>0$ for every $x$, $a\\,b^x+k$ lies on one side of $k$, above for $a>0$ and below for $a<0$. The logarithm is defined where its input is positive, so $a\\log_b(x-h)+k$ has domain $x>h$, and its values grow without bound in magnitude as $x\\to h^{+}$.",
        ],
      },
    ],
    pitfalls: [
      "The asymptote is the added constant $k$, not the $y$-intercept.",
      "In $\\log_b(x+3)$ the asymptote is $x=-3$, the opposite sign of the 3 written.",
      "A shift outside the logarithm moves the graph up or down and does not change the domain.",
    ],
    parentGuide:
      "Sketch $y=2^x$ and $y=2^x-3$ side by side on the same grid and ask where each flattens out and where each crosses the $y$-axis.",
  },
];
