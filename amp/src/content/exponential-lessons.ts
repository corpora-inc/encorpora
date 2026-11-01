import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms = {
  exponential: "exponential-function" as MethodTerm,
  logarithm: [
    "logarithm",
    "$\\log$ with no base means base 10, and $\\ln$ means base $e$.",
  ] as MethodTerm,
  ratio: "common-ratio" as MethodTerm,
};

const exponentialSenses: Lesson["senses"] = {
  term: "term-sequence",
  terms: "term-sequence",
  factor: "growth-factor",
  factors: "growth-factor",
  product: "product-multiply",
  rule: "rule",
  rules: "rule",
  model: "model",
  models: "model",
  square: "square-number",
  unit: "unit",
  units: "unit",
  average: "mean-average",
  base: "base-exponent",
  bases: "base-exponent",
  opposite: "opposite-number",
  opposites: "opposite-number",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  decreasing: "decreasing",
  increasing: "increasing",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
  balance: "balance-account",
};

export const exponentialLessons: Lesson[] = [
  {
    id: "exponential-models",
    title: "Growth by a constant factor",
    summary:
      "Some amounts grow by multiplying, not adding. A town of 1,000 people that grows by 10% each year has 1,100 after one year, then 1,210, then 1,331. Each year multiplies the number by the same amount, 1.1. A pattern where each equal step multiplies by the same number is called exponential. Knowing the starting amount and that multiplier lets you find any later value.",
    templateIds: ["exponential-model-value", "exponential-model-rule"],
    includeGeneratedRepresentation: false,
    senses: exponentialSenses,
    noLink: [
      "part",
      "parts",
      "whole",
      "more than",
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
    ],
    objectives: [
      "Find the starting value $a$ and the growth factor $b$ (the number each step multiplies by) from a table, a graph or a story.",
      "Turn a percent change into a growth factor: growing by $p$% multiplies by $1 + \\frac{p}{100}$, and losing $p$% multiplies by $1 - \\frac{p}{100}$.",
      "Find the value of an exponential model at a later time.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Adding against multiplying",
        paragraphs: [
          "Compare two patterns over equal steps of $x$. The rule $3x + 2$ gives 2, 5, 8, 11 for $x = 0, 1, 2, 3$: it adds 3 each step. A rule that adds the same amount each step is called linear. The rule $2 \\times 3^x$ gives 2, 6, 18, 54: it multiplies by 3 each step. A rule that multiplies by the same number each step is called exponential.",
          "In $3^x$, the raised $x$ is an exponent: it says how many times to multiply by 3. So $3^2 = 3 \\times 3 = 9$, and $3^0 = 1$, because no multiplying has happened yet.",
          "Every exponential rule can be written $y = a \\times b^x$. The number $a$ is the starting value, the value of $y$ when $x = 0$. The number $b$ is the growth factor, the number each step multiplies by. Read $a$ from the row where $x = 0$. Find $b$ by dividing any value by the one just before it.",
        ],
        illustration: "ratio-difference-table",
      },
      {
        title: "Percent change is a factor",
        paragraphs: [
          "Percent means out of 100, so 20% is $\\frac{20}{100} = 0.2$. Growing by 20% keeps the whole amount (1) and adds 0.2 of it. So the growth factor is $1 + 0.2 = 1.2$.",
          "Losing 20% keeps $1 - 0.2 = 0.8$ of the amount, so the factor is 0.8. A half-life is the time it takes for an amount to halve, so each half-life multiplies by $\\frac{1}{2}$.",
          "When the factor is more than 1, multiplying gives bigger and bigger jumps: 1, 2, 4, 8, 16, 32. So doubling soon passes any pattern that adds a fixed amount each step.",
        ],
        illustration: "doubling-race-bars",
      },
    ],
    workedExample: {
      prompt:
        "A town of 2,000 people grows by 10% each year. How many people will it have after 3 years?",
      steps: [
        "Turn the percent into a growth factor. Growing by 10% keeps the whole (1) and adds 0.1 of it, so each year multiplies by $1 + 0.1 = 1.1$.",
        "Three years means multiplying by 1.1 three times: $2000 \\times 1.1 \\times 1.1 \\times 1.1 = 2000 \\times 1.1^3$. Work out $1.1^3 = 1.331$.",
        "Multiply: $2000 \\times 1.331 = 2662$. Year by year, that is 2,200, then 2,420, then 2,662.",
      ],
      answer: "2662",
      answerUnit: "people",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a starting value $a$ and a positive growth factor $b$, the exponential model $y = a \\times b^t$ multiplies $a$ by $b$ once for each 1 added to $t$.",
          "In $y = a \\times b^x$ with $b > 0$ ($>$ means greater than), $a$ is the value at $x = 0$. When $a \\ne 0$ ($\\ne$ means is not equal to), $b$ is any value divided by the value one step before it.",
        ],
      },
    ],
    pitfalls: [
      "Adding 10% of the starting amount every year is linear growth. Exponential growth takes 10% of the current amount each year.",
      "A loss of 20% is a factor of 0.8, not 0.2, because 80% is left.",
    ],
    parentGuide:
      "Fold a sheet of paper in half again and again, counting the layers: 1, 2, 4, 8. Compare with adding one sheet each time. Ask which pile is bigger after 10 steps.",
  },
  {
    id: "growth-comparison",
    title: "Exponential growth overtakes linear growth",
    summary:
      "Equal differences mean linear; equal ratios mean exponential. With a positive start and a multiplying factor greater than 1, exponential growth eventually passes any linear function.",
    templateIds: ["linear-or-exponential", "exponential-overtakes"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Classify a table or story as linear, exponential or neither.",
      "Find the first whole input at which an exponential exceeds a linear function.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Differences or ratios",
        paragraphs: [
          "For equal steps in $x$, find the differences between consecutive $y$-values. If they are equal, the function is linear. If not, find the ratios; equal ratios mean exponential. If neither is constant, it is neither.",
          "In a story, 'adds 5 each week' is a constant difference and 'grows by 5% each week' is a constant ratio. 'Adds one more each week than the week before' has neither.",
        ],
      },
      {
        title: "The crossing",
        paragraphs: [
          "$y=10x+10$ starts ahead of $y=2^x$. The line adds 10 each step while the exponential doubles. At $x=6$, the line is still ahead ($70>64$); at $x=7$, the exponential passes it ($128>80$). For later whole inputs, each exponential increase is at least 128 while the line adds only 10, so the lead grows.",
          "To find the first whole $x$ where the exponential is greater, compare the two values one step at a time.",
        ],
        illustration: "overtake-graph",
      },
    ],
    workedExample: {
      prompt:
        "For $f(x) = 10x + 10$ and $g(x) = 2^x$, what is the least whole number $x$ with $g(x) > f(x)$?",
      steps: [
        "For $x=0,1,2,3,4$, the pairs $(f(x),g(x))$ are $(10,1)$, $(20,2)$, $(30,4)$, $(40,8)$, and $(50,16)$; $g$ is smaller each time.",
        "$x = 5$: $f = 60$, $g = 32$.",
        "$x = 6$: $f = 70$, $g = 64$; $f$ is still greater.",
        "$x = 7$: $f = 80$, $g = 128$; $g$ is greater for the first time.",
      ],
      answer: "7",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Over equal steps, linear functions have equal differences and exponential functions have equal ratios.",
          "For $a>0$ and $b>1$, the function $ab^x$ eventually exceeds every linear function $mx+c$ as $x$ increases.",
        ],
      },
    ],
    pitfalls: [
      "A larger start or a steeper early slope does not decide who wins in the long run.",
      "Check that the steps in $x$ are equal before comparing differences.",
    ],
    parentGuide:
      "Offer a choice: 100 coins a day, or 1 coin doubled each day. Make a table together until the doubling plan wins, and count the days it took.",
  },
  {
    id: "exponential-equations",
    title: "Solving for an exponent",
    summary:
      "An unknown exponent tells how many equal multiplication steps reach a target. Match powers of one base when possible; otherwise use a logarithm.",
    templateIds: [
      "same-base-equation",
      "exponential-log-solution",
      "log-equation",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Solve exponential equations by rewriting with a common base.",
      "Write the exact solution of $a \\cdot b^x = c$ as a logarithm.",
      "Solve logarithmic equations and reject candidates outside the domain.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Match the exponents",
        paragraphs: [
          "$4^x = 32$ has no whole-number solution, but $4 = 2^2$ and $32 = 2^5$. So $2^{2x} = 2^5$, and equal powers of the same base have equal exponents: $2x = 5$, $x = \\frac{5}{2}$.",
          "When the numbers are not powers of one base, isolate the power and name the exponent with a logarithm: $3 \\cdot 10^x = 21$ gives $10^x = 7$, so $x = \\log 7$.",
        ],
      },
      {
        title: "A logarithm undoes a power",
        paragraphs: [
          "$y = \\log_2 x$ is $y = 2^x$ reflected in the line $y = x$: the point $(3, 8)$ on one is $(8, 3)$ on the other. So $\\log_b(x + c) = n$ means $x + c = b^n$.",
          "A logarithm is defined only for positive arguments. After combining logs, check every candidate in the original equation: $\\log_2 x + \\log_2(x + 7) = 3$ gives $x = 1$ or $x = -8$, and $-8$ is rejected.",
        ],
        illustration: "exp-log-reflection",
      },
    ],
    workedExample: {
      prompt: "Solve $8^{x + 1} = 16^x$.",
      steps: [
        "$8 = 2^3$ and $16 = 2^4$, so $2^{3(x + 1)} = 2^{4x}$.",
        "Match the exponents: $3x + 3 = 4x$.",
        "$x = 3$. Check: $8^4 = 4096 = 16^3$.",
      ],
      answer: "3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "If $b > 0$ and $b \\neq 1$, then $b^m = b^n$ exactly when $m = n$.",
          "$b^x = k$ exactly when $x = \\log_b k$, for $b > 0$, $b \\neq 1$ and $k > 0$.",
          "$\\log_b A = n$ means $A = b^n$, and only positive arguments have logarithms.",
        ],
      },
    ],
    pitfalls: [
      "Divide by the coefficient before taking a logarithm: in $3 \\cdot 2^x = 24$, first $2^x = 8$.",
      "A solution that makes any logarithm's argument zero or negative is not a solution.",
    ],
    parentGuide:
      "Start with 1 and ask how many doublings pass 1,000. Count powers of 2: after 10 doublings the amount is 1,024. Connect that step count to a logarithm.",
  },
  {
    id: "sequence-sums",
    title: "Adding a geometric sequence",
    summary:
      "To add many terms that multiply by the same ratio, compare the sum with one copy shifted by a step. Most terms cancel.",
    templateIds: ["geometric-series-sum"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Count the terms of a listed or sigma-notation sum.",
      "Find a finite geometric sum exactly, including ratios between 0 and 1.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A growing total",
        paragraphs: [
          "In $1+2+4+8+16$, each term doubles the one before it. The running totals are 1, 3, 7, 15, and 31, each one less than the next doubled term. A sequence made by repeatedly multiplying by one number is geometric. Its first term is $a_1$, its common multiplier is the ratio $r$, and $n$ counts its terms.",
        ],
        illustration: "series-running-total",
      },
      {
        title: "Why the sum formula works",
        paragraphs: [
          "For $n$ terms, write $S_n=a_1+a_1r+\\cdots+a_1r^{n-1}$. Multiply by $r$ and subtract the original sum; all middle terms cancel: $rS_n-S_n=a_1r^n-a_1$.",
          "For $r\\ne1$, divide by $r-1$ to get $S_n=a_1(r^n-1)/(r-1)$. If $0<r<1$, the equivalent form $a_1(1-r^n)/(1-r)$ may be easier to read.",
        ],
      },
      {
        title: "Count the terms",
        paragraphs: [
          "In $3 + 6 + 12 + \\cdots + 96$, the last term is $3 \\cdot 2^{n-1} = 96$, so $2^{n-1} = 32$ and $n = 6$.",
          "In $\\sum_{k=1}^{6} 3 \\cdot 2^{k-1}$, $k$ runs from 1 to 6: six terms, starting with $3 \\cdot 2^0 = 3$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the sum $3 + 6 + 12 + \\cdots + 96$.",
      steps: [
        "$a_1 = 3$, $r = 2$, and $96 = 3 \\cdot 2^5$, so $n = 6$.",
        "$S_6 = \\frac{3(2^6 - 1)}{2 - 1} = 3 \\times 63$.",
        "$= 189$.",
      ],
      answer: "189",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For first term $a_1$, ratio $r\\ne1$, and positive whole-number term count $n$, the finite geometric sum is $S_n=a_1(r^n-1)/(r-1)$. If $r=1$, every term is $a_1$ and $S_n=na_1$.",
        ],
      },
    ],
    pitfalls: [
      "$n$ counts terms, not the exponent of the last term: $2^5$ is the sixth term of $1, 2, 4, \\dots$",
      "Use $r^n$, not $r^{n-1}$, in the sum formula.",
    ],
    parentGuide:
      "Put 1 coin in a jar on day 1, 2 on day 2, 4 on day 3. Before adding up a week, predict the total from the next day's amount.",
  },
  {
    id: "logarithm-properties",
    title: "Logarithm rules",
    summary:
      "A logarithm asks which exponent produces a number. Products, quotients, and powers turn into operations on those exponents.",
    templateIds: ["log-rules-evaluate", "log-expand", "change-of-base"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use the product, quotient and power rules to evaluate and rewrite logarithms.",
      "Change the base of a logarithm.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Multiplying outputs adds inputs",
        paragraphs: [
          "A logarithm names an exponent: $\\log_2 8=3$ means $2^3=8$. The number 2 is the base, 8 is the positive number produced, and 3 is the exponent. A real logarithm uses a positive base other than 1 and a positive input.",
          "Multiplying powers of one base adds their exponents: $4\\times8=32$ corresponds to $2+3=5$. Therefore the exponent for a product comes from adding the exponents for its factors.",
        ],
        illustration: "powers-product-table",
      },
      {
        title: "Product, quotient, and power",
        paragraphs: [
          "For positive $m,n$ and valid base $b$, $\\log_b(mn)=\\log_b m+\\log_b n$ and $\\log_b(m/n)=\\log_b m-\\log_b n$. The power rule gives $\\log_b(m^p)=p\\log_b m$ for real $p$.",
          "For example, $\\log_6 4+\\log_6 9=\\log_6 36=2$, although neither term is a whole number.",
        ],
      },
      {
        title: "Change of base",
        paragraphs: [
          "For $N>0$ and bases $b,c>0$ with neither base equal to 1, $\\log_b N=\\frac{\\log_c N}{\\log_c b}$. With $c=2$: $\\log_8 32=\\frac{\\log_2 32}{\\log_2 8}=\\frac{5}{3}$. Check: $8^{5/3}=2^5=32$.",
          "Read backward, a quotient of logs in one base is a single logarithm: $\\frac{\\log 81}{\\log 3} = \\log_3 81 = 4$.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is $2\\log_3 6 - \\log_3 4$?",
      steps: [
        "Power rule: $2\\log_3 6 = \\log_3 36$.",
        "Quotient rule: $\\log_3 36 - \\log_3 4 = \\log_3 9$.",
        "$9 = 3^2$, so the value is 2.",
      ],
      answer: "2",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For $b>0$, $b\\ne1$, and $m,n>0$, $\\log_b(mn)=\\log_b m+\\log_b n$ and $\\log_b(m/n)=\\log_b m-\\log_b n$. For real $p$, also $\\log_b(m^p)=p\\log_b m$.",
          "Logarithms turn products into sums, quotients into differences and powers into multiples.",
          "For $N>0$ and bases $b,c>0$ with $b,c\\ne1$, change of base gives $\\log_b N=\\frac{\\log_c N}{\\log_c b}$.",
        ],
      },
    ],
    pitfalls: [
      "$\\log(m + n)$ is not $\\log m + \\log n$; the rules turn products into sums, not sums into sums.",
      "$\\frac{\\log m}{\\log n}$ is a change of base, not $\\log \\frac{m}{n}$.",
    ],
    parentGuide:
      "On a calculator, check that log 2 + log 5 equals log 10, which is 1. Then try a pair whose product is 100.",
  },
  {
    id: "geometric-sequences",
    title: "Repeated multiplication",
    summary:
      "Start with 3 and keep multiplying by 2: 3, 6, 12, 24, 48. A list of numbers in order is called a sequence, and each number in it is a term. When each term is the one before times the same number, the sequence is called geometric. That same number, here 2, is called the common ratio.",
    templateIds: ["geometric-sequence", "geometric-sequence-rule"],
    senses: exponentialSenses,
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
    ],
    objectives: [
      "Build the terms of a sequence by multiplying by the same number again and again.",
      "Use the rule $a_n = a_1 r^{n-1}$, where $a_1$ is the first term.",
      "Find the common ratio from terms next to each other, including negative and fraction ratios.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use the same ratio each step",
        paragraphs: [
          "A sequence is a list of numbers in order, and each number is a term. Start with 3 and multiply by 2 each time: 3, 6, 12, 24, 48. Each term is twice the one before. A sequence like this is called geometric, and the number you multiply by is called the common ratio. Here it is 2.",
          "To find the common ratio, divide any term by the one just before it: $12 \\div 6 = 2$. The ratio can be negative: in 2, $-6$, 18, it is $-3$, so the signs switch back and forth. It can be a fraction: in 48, 24, 12, it is $\\frac{1}{2}$, so each term is half the one before.",
        ],
        illustration: "geometric-ratio-table",
      },
      {
        title: "Count the steps, not the term number",
        paragraphs: [
          "We label terms by position with a small number written low, called a subscript. $a_1$ is the first term, $a_2$ the second, and $a_n$ the term in position $n$. The letter $r$ stands for the common ratio.",
          "Going from term 1 to term 5 takes four multiplications, not five. In general, reaching term $n$ takes $n - 1$ steps. So $a_n = a_1 \\times r^{n-1}$, where the raised $n - 1$ means multiply by $r$ that many times.",
          "A rule like $a_n = 3a_{n-1}$ builds the same kind of list one step at a time: each term is 3 times the term before it, $a_{n-1}$. This is called a recursive rule.",
          "Between any two known terms, the ratio is used once per step. From $a_2$ to $a_5$ is three steps, so $a_5 \\div a_2 = r^3$.",
        ],
      },
    ],
    workedExample: {
      prompt: "The first term is 3 and the common ratio is 2. What is term 5?",
      steps: [
        "Count the steps. Term 5 is $5 - 1 = 4$ steps after the first term.",
        "Multiply by 2 four times, starting from 3: 3, 6, 12, 24, 48.",
        "The rule gives the same answer in one line: $a_5 = 3 \\times 2^4 = 3 \\times 16 = 48$.",
      ],
      answer: "48",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For positions $n = 1, 2, 3, \\ldots$, a geometric sequence with first term $a_1$ and common ratio $r$ has $a_n = a_1 r^{n-1}$. If $r \\ne 0$ and $a_k \\ne 0$ ($\\ne$ means is not equal to), then $\\frac{a_m}{a_k} = r^{m-k}$ for any positions $m$ and $k$.",
        ],
      },
    ],
    pitfalls: [
      "Using the power $n$ instead of $n - 1$ goes one term too far.",
      "Adding the common ratio each time does not make a geometric sequence. You must multiply.",
    ],
    parentGuide:
      "Write each term with its position underneath. Draw an arrow marked “times 2” between neighbouring terms, and count the arrows to see why term 5 needs only four of them.",
  },
  {
    id: "logarithms",
    title: "Ask for the exponent",
    summary:
      "A logarithm tells which power of a base produces a target number.",
    templateIds: [
      "logarithm-integer",
      "logarithm-value",
      "log-exponential-form",
    ],
    objectives: [
      "Translate between logarithmic and exponential statements.",
      "Evaluate logarithms of integer, negative and fractional powers.",
      "Place a logarithm between consecutive whole numbers.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Three parts of a power",
        paragraphs: [
          "In 3⁴ = 81, three is the base, four is the exponent, and eighty-one is the result. A logarithm asks for the exponent when the base and result are known.",
          "The statement log base 3 of 81 = 4 means exactly 3⁴ = 81. It does not mean 81 divided by 3. For real logarithms, the base must be positive and different from one, and the argument must be positive.",
        ],
      },
      {
        title: "Negative and fractional logarithms",
        paragraphs: [
          "On the graph of $y = \\log_2 x$, each doubling of $x$ adds 1 to $y$. Halving subtracts 1, so $\\log_2 \\frac{1}{2} = -1$, and the curve passes through $(1, 0)$ because $2^0 = 1$.",
          "Roots are fractional powers: $\\sqrt{8} = 2^{3/2}$, so $\\log_2 \\sqrt{8} = \\frac{3}{2}$. A number between two powers has a logarithm between their exponents: $8 < 10 < 16$, so $\\log_2 10$ is between 3 and 4.",
        ],
        illustration: "log-graph-points",
      },
    ],
    workedExample: {
      prompt: "What is log base 3 of 81?",
      steps: [
        "Find $p$ such that 3^p = 81.",
        "3 × 3 × 3 × 3 = 81.",
        "There are four factors, so p = 4.",
      ],
      answer: "4",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "$\\log_b b^k = k$ for every real $k$, including negative and fractional exponents.",
          "$\\log_b N = p$ and $b^p = N$ are the same statement.",
        ],
      },
    ],
    pitfalls: [
      "A logarithm asks for an exponent, not a quotient.",
      "Count the number of factors of the base, not just the multiplication symbols.",
    ],
    parentGuide:
      "Cover the exponent in a familiar power equation and ask what it must be. Then write the equivalent logarithm statement.",
  },
];

export const exponentialMethods: Record<string, ProblemMethod> = {
  "exponential-model-value": {
    goal: "Find the value of an exponential model at a later time, from a table, a percent rate, a half-life or a formula.",
    intuition:
      "An exponential model multiplies by the same number each step. That number is called the growth factor. Growing by 10% each year multiplies by $1 + 0.1 = 1.1$, because the whole amount stays and 0.1 of it is added. Losing 20% multiplies by 0.8, because 80% is left. A half-life, the time for an amount to halve, multiplies by $\\frac{1}{2}$. In $y = a \\times b^t$, $a$ is the starting value, $b$ is the growth factor, and the raised $t$ means multiply by $b$ that many times.",
    terms: [terms.exponential],
    senses: exponentialSenses,
    noLink: [
      "part",
      "parts",
      "whole",
      "more than",
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
    ],
    method: [
      "Find the starting value $a$ and the growth factor $b$ for one step. A percent increase of $p$% gives $b = 1 + \\frac{p}{100}$, and a halving gives $b = \\frac{1}{2}$.",
      "Count how many steps there are until the time asked for.",
      "Multiply $a$ by $b$ once for each step: $y = a \\times b^{\\text{steps}}$.",
    ],
    watch:
      "Multiply by the factor each step. Adding the same percent of the start every step is linear growth, not exponential.",
  },
  "exponential-model-rule": {
    goal: "Choose the equation $y = a \\times b^x$ that fits a table, a graph or a story.",
    intuition:
      "An exponential rule multiplies by the same number for each step of $x$. It can be written $y = a \\times b^x$, where the raised $x$ means multiply by $b$ that many times. The number $a$ is the starting value, the value of $y$ when $x = 0$, because $b^0 = 1$. The number $b$ is the growth factor, the number each step multiplies by. Divide any value by the one just before it to find $b$.",
    terms: [terms.exponential],
    senses: exponentialSenses,
    noLink: [
      "part",
      "parts",
      "whole",
      "more than",
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
    ],
    method: [
      "Find $a$, the value at $x = 0$. Read it from the table or graph, or take the starting amount in the story.",
      "Find $b$, the growth factor for each step. Divide a value by the one before it, or turn a percent change into $1 + \\frac{p}{100}$ or $1 - \\frac{p}{100}$.",
      "Check the equation you chose at another point.",
    ],
    watch:
      "The starting value $a$ multiplies the power. The growth factor $b$ is the number being raised to the power. Do not swap them.",
  },
  "linear-or-exponential": {
    goal: "Given a table or a story, decide whether the change is linear, exponential or neither.",
    method: [
      "Make sure the steps in $x$ are equal.",
      "Equal differences between consecutive outputs mean linear; equal ratios mean exponential.",
      "If neither the differences nor the ratios are constant, it is neither.",
    ],
    watch:
      "'Grows by 5 each week' is a difference; 'grows by 5% each week' is a ratio.",
  },
  "exponential-overtakes": {
    goal: "Given a linear and an exponential function, find the first whole input where the exponential is greater.",
    method: [
      "Write both functions (or continue both patterns) at x = 0, 1, 2, ….",
      "Compare their values one step at a time.",
      "Check whole inputs from the allowed start until the exponential first exceeds the linear value; an early exceedance alone does not prove it stays ahead at every later input.",
    ],
    watch:
      "The function that starts larger does not stay larger; keep comparing until the order changes.",
  },
  "same-base-equation": {
    goal: "Given an exponential equation whose sides are powers of one base, find $x$ exactly.",
    method: [
      "Write each side as a power of the same base, including reciprocals as negative powers.",
      "Multiply out any power of a power.",
      "Set the exponents equal and solve the linear equation.",
    ],
    watch:
      "Rewrite the bases before comparing exponents: 4ˣ = 8 does not mean x = 8 ÷ 4.",
  },
  "exponential-log-solution": {
    goal: "Given an exponential equation with no common base, choose its exact logarithmic solution.",
    terms: [terms.logarithm],
    method: [
      "Isolate the power: divide away any coefficient, and set aside any shift in the exponent.",
      "Name the exponent with a logarithm whose base is the base of the power: bˣ = $k$ gives x = log_b k.",
      "Undo any remaining shift or coefficient on $x$.",
    ],
    watch:
      "Divide by the coefficient before taking the logarithm; the base of the power is the base of the log.",
  },
  "log-equation": {
    goal: "Given a logarithmic equation, find the solution that keeps every logarithm defined.",
    terms: [terms.logarithm],
    method: [
      "Combine logs with the same base into one, using the product or quotient rule.",
      "Rewrite $\\log_b(\\text{stuff}) = n$ as $\\text{stuff} = b^n$ and solve.",
      "Reject any candidate that makes a logarithm's argument zero or negative.",
    ],
    watch:
      "Check each candidate in the original logs: a negative argument has no real logarithm.",
  },
  "geometric-series-sum": {
    goal: "Given a finite geometric series, find its sum.",
    terms: [terms.ratio],
    method: [
      "Identify the first term a₁ and the ratio $r$.",
      "Count the terms $n$.",
      "Sₙ = a₁(rⁿ − 1)/(r − 1), or a₁(1 − rⁿ)/(1 − r) when r < 1.",
    ],
    watch:
      "$n$ is the number of terms; the last term is a₁·rⁿ⁻¹, so its exponent is n − 1.",
  },
  "log-rules-evaluate": {
    goal: "Given a sum, difference or multiple of logarithms with one base, find its value.",
    terms: [terms.logarithm],
    method: [
      "Move any coefficient inside as an exponent: $p\\cdot \\log_{b} m = \\log_{b} m^{p}$.",
      "Combine: a sum multiplies the arguments, a difference divides them.",
      "Write the single argument as a power of the base; its exponent is the value.",
    ],
    watch:
      "The rules need one base, and they combine products and quotients: $\\log(m + n)$ cannot be split.",
  },
  "log-expand": {
    goal: "Given a logarithm of a product, quotient or root, or a combination of logarithms, choose the equivalent form.",
    terms: [terms.logarithm],
    method: [
      "A quotient becomes a difference and a product becomes a sum.",
      "Each exponent, including the 1/2 of a square root, becomes a coefficient in front of its own log.",
      "To condense, reverse the steps: coefficients become exponents, then sums multiply and differences divide.",
    ],
    watch:
      "An exponent multiplies only the log of its own factor, and a denominator's log is subtracted.",
  },
  "change-of-base": {
    goal: "Given a logarithm in an awkward base, or a product or quotient of logs, find its value.",
    terms: [terms.logarithm],
    method: [
      "For positive $N$ and bases $b,c>0$ other than 1, use $\\log_b N=\\log_c N/\\log_c b$.",
      "Choose $c$ so both logs are easy: often the prime that $b$ and $N$ are powers of.",
      "Divide, or cancel the common logs.",
    ],
    watch:
      "log_b N is $\\log N \\div  \\log b$, with the base in the denominator.",
  },
  "logarithm-value": {
    goal: "Given a logarithm of a reciprocal, root, decimal or a point on its graph, find its exact value.",
    terms: [terms.logarithm],
    method: [
      "Write the argument as a power of the base: a reciprocal has a negative exponent, a root a fractional one.",
      "The logarithm is that exponent.",
    ],
    watch: "log_b(1/bᵏ) is −k, not 1/k: a reciprocal negates the exponent.",
  },
  "log-exponential-form": {
    goal: "Given a logarithmic or exponential statement, choose its other form, or place a logarithm between whole numbers.",
    terms: [terms.logarithm],
    method: [
      "log_b N = p and bᵖ = N say the same thing: the base stays the base, and the logarithm is the exponent.",
      "To place log_b N, list powers of $b$ until one passes $N$; the logarithm is between the exponents on either side.",
    ],
    watch:
      "The result $N$ goes inside the logarithm; the exponent is the logarithm's value.",
  },
  "geometric-sequence-rule": {
    goal: "Find the common ratio, a missing term or a later term of a geometric sequence, from some of its terms or its rule.",
    intuition:
      "A sequence is a list of numbers in order, and each number is a term. In a geometric sequence, each term is the one before times the same number, called the common ratio $r$. For example, 3, 6, 12, 24 has $r = 2$. To find $r$, divide any term by the one just before it. Going forward one step multiplies by $r$, and going back one step divides by $r$. Two terms that are $k$ steps apart differ by a factor of $r^k$, meaning $r$ multiplied by itself $k$ times.",
    terms: [terms.ratio],
    senses: exponentialSenses,
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
    ],
    method: [
      "Find the ratio $r$: divide any term by the term just before it.",
      "For two terms $k$ steps apart, the later one divided by the earlier one is $r^k$.",
      "Multiply by $r$ once for each step forward, or divide by $r$ once for each step back.",
    ],
    watch:
      "Keep the sign. A ratio can be negative, so the terms may switch between positive and negative.",
  },
};

export const exponentialPrinciples: Record<string, string> = {
  "exponential-model-value":
    "For a starting value $a$ and a positive growth factor $b$, the model $y = a \\times b^t$ multiplies $a$ by $b$ once for each 1 added to $t$.",
  "exponential-model-rule":
    "In $y = a \\times b^x$ with $b > 0$, $a$ is the value at $x = 0$, because $b^0 = 1$. When $a \\ne 0$, $b$ is any value divided by the value one step before it.",
  "linear-or-exponential":
    "Over equal steps, linear functions have equal differences and exponential functions have equal ratios.",
  "exponential-overtakes":
    "For $a>0$ and $b>1$, $ab^x$ eventually exceeds every linear function of $x$ as $x$ increases.",
  "same-base-equation":
    "If $b > 0$ and $b \\neq 1$, then $b^m = b^n$ exactly when $m = n$.",
  "exponential-log-solution":
    "$b^x = k$ exactly when $x = \\log_b k$, for $b > 0$, $b \\neq 1$ and $k > 0$.",
  "log-equation":
    "$\\log_b A = n$ means $A = b^n$, and only positive arguments have logarithms.",
  "geometric-series-sum":
    "Finite geometric sum: $S_n = \\frac{a_1(r^n - 1)}{r - 1}$ for $r \\neq 1$.",
  "log-rules-evaluate":
    "For $b>0$, $b\\ne1$, and $m,n>0$, $\\log_b(mn)=\\log_b m+\\log_b n$ and $\\log_b(m/n)=\\log_b m-\\log_b n$. For real $p$, $\\log_b(m^p)=p\\log_b m$.",
  "log-expand":
    "For positive arguments and a positive base other than 1, logarithms turn products into sums, quotients into differences and powers into multiples.",
  "change-of-base":
    "For $N>0$ and bases $b,c>0$ with $b,c\\ne1$, change of base gives $\\log_b N=\\frac{\\log_c N}{\\log_c b}$.",
  "logarithm-value":
    "$\\log_b b^k = k$ for every real $k$, including negative and fractional exponents.",
  "log-exponential-form":
    "$\\log_b N = p$ and $b^p = N$ are the same statement.",
  "geometric-sequence-rule":
    "For positions $n = 1, 2, 3, \\ldots$, a geometric sequence has $a_n = a_1 r^{n-1}$, where $a_1$ is the first term and $r$ the common ratio. If $r \\ne 0$ and $a_k \\ne 0$, then $\\frac{a_m}{a_k} = r^{m-k}$.",
};
