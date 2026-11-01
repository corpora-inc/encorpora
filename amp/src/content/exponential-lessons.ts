import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms = {
  exponential: "exponential-function" as MethodTerm,
  logarithm: [
    "logarithm",
    "The base is positive and not 1, and the number inside is positive. $\\log$ with no base means base 10, and $\\ln$ means base $e$, a number about 2.718.",
  ] as MethodTerm,
  ratio: "common-ratio" as MethodTerm,
};

const exponentialSenses: Lesson["senses"] = {
  term: "term-sequence",
  terms: "term-sequence",
  factor: "growth-factor",
  factors: "growth-factor",
  product: "product-multiply",
  square: "square-number",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
  balance: "balance-account",
};

export const exponentialLessons: Lesson[] = [
  {
    id: "exponential-models",
    title: "Growth by a constant factor",
    summary:
      "Some amounts grow by multiplying, not adding. A town of 1,000 people that grows by 10% each year has 1,100 after one year, then 1,210, then 1,331. Each year multiplies the number by the same amount, 1.1. A pattern where each equal step multiplies by the same positive number (other than 1) is called exponential. That multiplier, the number each step multiplies by, and the starting amount let you find any later value.",
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
          "Every exponential rule can be written $y = a \\times b^x$. The number $a$ is the starting value, the value of $y$ when $x = 0$. The number $b$ is the growth factor, the number each step multiplies by. Read $a$ from the row where $x = 0$. Find $b$ by dividing a value by the one just before it. These values are never 0.",
        ],
        illustration: "ratio-difference-table",
      },
      {
        title: "Percent change is a factor",
        paragraphs: [
          "Percent means out of 100, so 20% is $\\frac{20}{100} = 0.2$. Growing by 20% keeps the whole amount (1) and adds 0.2 of it. So the growth factor is $1 + 0.2 = 1.2$.",
          "Losing 20% keeps $1 - 0.2 = 0.8$ of the amount, so the factor is 0.8. A half-life is the time it takes for an amount to halve, so each half-life multiplies by $\\frac{1}{2}$.",
          "When the factor is more than 1 and the start is positive, multiplying gives bigger and bigger jumps: 1, 2, 4, 8, 16, 32. So doubling soon passes any pattern that adds a fixed amount each step.",
        ],
        illustration: "doubling-race-bars",
      },
    ],
    workedExample: {
      prompt:
        "A town of 2,000 people grows by 10% each year. How many people will it have after 3 years?",
      steps: [
        "Percent means out of 100, so 10% is 0.1. Growing by 10% keeps the whole (1) and adds 0.1 of it, so each year multiplies by $1 + 0.1 = 1.1$. That is the growth factor.",
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
      "A pattern, a list of numbers made by repeating one step, can grow by adding or by multiplying. Linear growth adds the same amount each step, like 10, 20, 30, 40. Exponential growth multiplies by the same number each step, like 1, 2, 4, 8. If the multiplying pattern starts above 0 and multiplies by more than 1, it passes the adding pattern in the end, however far behind it starts.",
    senses: {
      difference: "difference-subtract",

      rule: "rule",
    },
    noLink: ["change", "changes", "more than", "whole"],
    templateIds: ["linear-or-exponential", "exponential-overtakes"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Decide whether a table or a story grows linearly (adds the same amount each step), exponentially (multiplies by the same number each step) or neither.",
      "Find the first whole number (0, 1, 2, 3, …) at which an exponential function is greater than a linear one.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Differences or ratios",
        paragraphs: [
          "A difference is the result of a subtraction. Here a ratio is one value divided by the value before it. To test a table, first check that the inputs, the $x$-values, go up in equal steps, such as 0, 1, 2, 3.",
          "Then subtract each output, each $y$-value, from the next one. If every difference is the same, the pattern is linear: it adds a fixed amount each step. For outputs 5, 8, 11, 14, every difference is 3, so the pattern is linear.",
          "If the differences change, divide each output by the one before it (none of the outputs is 0 here). If every ratio is the same positive number, the pattern is exponential: it multiplies by a fixed number each step. For outputs 3, 6, 12, 24, every ratio is 2, so the pattern is exponential. If neither the differences nor the ratios stay the same, the pattern is neither.",
          "Stories work the same way. “Adds 5 each week” is a fixed difference, so it is linear. Percent means out of 100, and its sign is %. So 5% of an amount is 0.05 times it. “Grows by 5% each week” keeps the whole amount and adds 0.05 of it, which multiplies by 1.05 each week: a fixed ratio, so it is exponential. “Adds one more each week than the week before” has neither.",
          "A function is a rule that gives one output for each input. We write $f(x)$, read “$f$ of $x$”, for the output of $f$ when the input is $x$. So $f(x) = 10x + 10$ means: multiply the input by 10, then add 10. In $g(x) = 2^x$, the small raised $x$ is an exponent: it says how many 2s to multiply together, so $2^3 = 2 \\times 2 \\times 2 = 8$, and $2^0 = 1$. The sign $>$ means is greater than, as in $8 > 5$.",
        ],
      },
      {
        title: "The crossing",
        paragraphs: [
          "Compare the line $y = 10x + 10$ with $y = 2^x$, which doubles each step. The line starts ahead: at $x = 0$ it is 10, while $2^0$ is only 1. The line adds 10 each step, and the exponential doubles.",
          "At $x = 6$ the line is still ahead, because 70 is greater than 64. At $x = 7$ the exponential passes it, because 128 is greater than 80. After that, each doubling adds 128 or more, while the line adds only 10. So the exponential's lead keeps growing.",
          "To find the first whole number $x$ where the exponential is greater, work out both values at $x = 0, 1, 2, \\dots$ and compare them one step at a time. Stop at the first $x$ where the exponential is bigger.",
        ],
        illustration: "overtake-graph",
      },
    ],
    workedExample: {
      prompt:
        "For $f(x) = 10x + 10$ and $g(x) = 2^x$, what is the least whole number $x$ with $g(x) > f(x)$?",
      steps: [
        "Work out both functions at each whole number, starting at 0. The question asks for the first $x$ where $g(x)$ is greater, so compare at every step.",
        "For $x = 0, 1, 2, 3, 4$, $f$ gives 10, 20, 30, 40, 50, and $g$ gives 1, 2, 4, 8, 16. Each time $g$ is smaller.",
        "At $x = 5$: $f(5) = 10 \\times 5 + 10 = 60$, and $g(5) = 2^5 = 32$. $g$ is still smaller.",
        "At $x = 6$: $f(6) = 70$, and $g(6) = 64$. $f$ is still greater, but the gap is now small.",
        "At $x = 7$: $f(7) = 80$, and $g(7) = 128$. Now $g$ is greater for the first time, so the answer is 7.",
      ],
      answer: "7",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A linear function is one of the form $y = mx + c$, and an exponential function is one of the form $y = a \\cdot b^x$, with $a \\neq 0$, $b > 0$ and $b \\neq 1$ ($\\neq$ means is not equal to). Here $m$, $c$, $a$ and $b$ are fixed numbers, and the dot $\\cdot$ means times. Over equal steps of the input, the linear function has the same difference every step, and the exponential function has the same ratio every step.",
          "If $a > 0$ and $b > 1$, then $a \\cdot b^x$ eventually becomes greater than every linear function $mx + c$ as $x$ grows, and stays greater.",
        ],
      },
    ],
    pitfalls: [
      "Starting bigger, or rising faster at first, does not decide which pattern wins in the long run. Keep comparing until the order changes.",
      "Check that the inputs go up in equal steps before you compare differences or ratios.",
    ],
    parentGuide:
      "Offer a choice: 100 coins a day, or 1 coin on day 1 that doubles each day. Make a table together until the doubling plan's daily amount is bigger, and count the days. Ask why adding the same amount (a linear pattern) loses in the end to doubling (an exponential pattern).",
  },
  {
    id: "exponential-equations",
    title: "Solving for an exponent",
    summary:
      "In $2^x = 8$, the 2 is called the base and the unknown $x$ is the exponent: the small raised number that says how many 2s are multiplied together. A base with an exponent, like $2^3$, is called a power. Since $2 \\times 2 \\times 2 = 8$, the answer is $x = 3$. When both sides, meaning the left and the right of the equals sign, can be written as powers of the same base, set the exponents equal. This works when the base is positive and not 1. When they cannot, a logarithm names the missing exponent.",
    senses: {
      rule: "rule",
      base: "base-exponent",
      side: "side-of-equation",
      argument: "argument",
      term: "term-expression",
    },
    noLink: ["images", "mean"],
    templateIds: [
      "same-base-equation",
      "exponential-log-solution",
      "log-equation",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Solve an exponential equation (one with the unknown in an exponent) by writing both sides as powers of the same base.",
      "Write the exact solution of an equation like $3 \\cdot 10^x = 21$ as a logarithm, the exponent that turns a base into a given number.",
      "Solve logarithm equations, and reject any answer that makes a logarithm undefined.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Match the exponents",
        paragraphs: [
          "Two powers of the same base are equal only when their exponents are equal. So if $2^{2x} = 2^5$, then $2x = 5$, and $x = \\tfrac{5}{2}$. This works for any base that is positive and not 1. A base of 1 fails, because $1^2$ and $1^5$ are both 1.",
          "Often the bases look different at first. $4^x = 32$ has no whole-number answer, but 4 is $2^2$ and 32 is $2^5$. A power of a power multiplies the exponents: $(2^2)^x = 2^{2x}$. For $x = 1, 2, 3$ and so on, you can see why: $x$ copies of $2 \\times 2$ make $2x$ twos. The same holds for every exponent. So $4^x = 32$ becomes $2^{2x} = 2^5$, and $x = \\tfrac{5}{2}$.",
          "A fraction like $\\tfrac{1}{8}$ is also a power of 2. A negative exponent means one divided by the power: $2^{-3} = \\tfrac{1}{2^3} = \\tfrac{1}{8}$.",
        ],
      },
      {
        title: "When the bases do not match",
        paragraphs: [
          "In $3 \\cdot 10^x = 21$, the dot means times, and you cannot get 21 by multiplying 10s together. First get the power alone. Divide both sides by 3 to get $10^x = 7$. Dividing both sides by the same number, other than 0, keeps them equal.",
          "Now ask: 10 to what power gives 7? That exponent is called a logarithm. It is written $\\log_{10} 7$ and read “log base 10 of 7”. So $x = \\log_{10} 7$, which is about 0.845. With no base written, $\\log$ means base 10. $\\ln$ stands for the natural logarithm, the logarithm with base $e$, a special number about 2.718.",
          "In general, $b^x = k$ means $x = \\log_b k$. The base of the power becomes the base of the logarithm. This needs the base $b$ to be positive and not 1, and $k$ to be positive.",
        ],
      },
      {
        title: "A logarithm undoes a power",
        paragraphs: [
          "The graphs of $y = 2^x$ and $y = \\log_2 x$ are mirror images of each other across the line $y = x$. The point $(3, 8)$ is on the first graph, because $2^3 = 8$. The point $(8, 3)$ is on the second, because $\\log_2 8 = 3$. Each one undoes the other.",
          "So an equation like $\\log_2(x + 1) = 3$ can be rewritten as a power: $x + 1 = 2^3 = 8$, so $x = 7$. The number inside a logarithm, here $x + 1$, is called its argument.",
          "A logarithm exists only for a positive argument, because a positive base raised to any power gives a positive number. So check every answer in the original equation. In $\\log_2 x + \\log_2(x + 7) = 3$, adding two logarithms with the same base multiplies their arguments: $\\log_2(x(x + 7)) = 3$. So $x(x + 7) = 2^3 = 8$, which gives $x = 1$ or $x = -8$. Reject $-8$, because $\\log_2(-8)$ does not exist. The answer is $x = 1$.",
        ],
        illustration: "exp-log-reflection",
      },
    ],
    workedExample: {
      prompt: "Solve $8^{x + 1} = 16^x$.",
      steps: [
        "Write both bases as powers of 2, since $8 = 2^3$ and $16 = 2^4$. A power of a power multiplies the exponents, so $8^{x + 1} = 2^{3(x + 1)}$ and $16^x = 2^{4x}$.",
        "Now both sides are powers of 2, so their exponents must be equal: $3(x + 1) = 4x$.",
        "Multiply out the bracket: $3x + 3 = 4x$. Subtract $3x$ from both sides to collect everything with $x$ on one side: $3 = x$.",
        "Check in the original equation: $8^{3 + 1} = 8^4 = 4096$, and $16^3 = 4096$. Both sides match, so $x = 3$.",
      ],
      answer: "3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a base $b > 0$ with $b \\neq 1$ ($\\neq$ means is not equal to): $b^m = b^n$ exactly when $m = n$.",
          "For $b > 0$, $b \\neq 1$ and $k > 0$: $b^x = k$ exactly when $x = \\log_b k$.",
          "$\\log_b A = n$ means $A = b^n$. Only a positive argument $A$ has a logarithm.",
        ],
      },
    ],
    pitfalls: [
      "Divide away the number multiplying the power before you take a logarithm. In $3 \\cdot 2^x = 24$, first get $2^x = 8$, so $x = 3$.",
      "Write both sides with the same base before you compare exponents. $4^x = 8$ does not mean $x = 8 \\div 4$. It means $2^{2x} = 2^3$, so $x = \\tfrac{3}{2}$.",
      "An answer that makes any logarithm's argument zero or negative is not a solution, a value that makes the equation true. Check every answer in the original equation.",
    ],
    parentGuide:
      "Start with 1 and ask how many doublings it takes to pass 1,000. Count together: 2, 4, 8, … After 10 doublings the amount is 1,024. Explain that the number of doublings is an exponent, and a logarithm is the tool that finds it.",
  },
  {
    id: "sequence-sums",
    title: "Adding a geometric sequence",
    summary:
      "A geometric sequence is a list of numbers where each one is the one before it times the same number, like 3, 6, 12, 24 (times 2 each time). That number is called the common ratio. The sum of the terms, the numbers in the list, is called a geometric series. Instead of adding them one by one, use a shortcut: multiply the sum by the common ratio and subtract the original sum. Almost every term cancels.",
    senses: { term: "term-sequence", side: "side-of-equation" },
    noLink: ["mean", "leaves"],
    templateIds: ["geometric-series-sum"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Count the terms of a sum that is written out, or written with sigma ($\\Sigma$), the symbol that means add up.",
      "Find the exact total of a geometric series that stops after some number of terms, including when the ratio is between 0 and 1.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A growing total",
        paragraphs: [
          "In $1 + 2 + 4 + 8 + 16$, each term is double the one before it. The running totals are 1, 3, 7, 15 and 31. Each total is one less than the next term would be: 31 is one less than 32.",
          "A list made by multiplying by the same number each time is called a geometric sequence. Its first term is written $a_1$, read “$a$ sub 1”: the small 1 is a label for position 1. The common ratio $r$ is the number each term is multiplied by. The letter $n$ counts the terms. The total is called a geometric series, written $S_n$ for the sum of $n$ terms.",
          "Each term is the first term times $r$ some number of times. Term 1 is $a_1$, term 2 is $a_1 r$, and term 3 is $a_1 r^2$, where $r^2$ means $r \\times r$. Term $n$ is $a_1 r^{n-1}$. Its exponent, the small raised number, is one less than its position, because term 1 has not been multiplied by $r$ yet.",
        ],
        illustration: "series-running-total",
      },
      {
        stage: "intuition",
        title: "Why the sum formula works",
        paragraphs: [
          "Write the sum of $n$ terms: $S_n = a_1 + a_1 r + a_1 r^2 + \\cdots + a_1 r^{n-1}$. The dots $\\cdots$ mean the list goes on in the same way.",
          "Multiply every term by $r$: $r S_n = a_1 r + a_1 r^2 + \\cdots + a_1 r^{n}$. The two lists share every term except the first term of $S_n$ and the last term of $r S_n$.",
          "Subtract $S_n$ from $r S_n$. All the shared terms cancel, which leaves $r S_n - S_n = a_1 r^n - a_1$. Pull $S_n$ out on the left and $a_1$ out on the right: $S_n(r - 1) = a_1(r^n - 1)$.",
          "If $r$ is not 1, divide both sides, meaning the left and the right of the equals sign, by $r - 1$: $S_n = \\tfrac{a_1(r^n - 1)}{r - 1}$. When $r$ is between 0 and 1, the same value can be written $\\tfrac{a_1(1 - r^n)}{1 - r}$, whose bottom, $1 - r$, is then positive.",
        ],
      },
      {
        title: "Count the terms",
        paragraphs: [
          "In $3 + 6 + 12 + \\cdots + 96$, the last term is term $n$, so $3 \\cdot 2^{n-1} = 96$. The dot means times. Divide both sides by 3: $2^{n-1} = 32$. Since $32 = 2^5$, $n - 1 = 5$, and $n = 6$. There are six terms: 3, 6, 12, 24, 48 and 96.",
          "Sigma notation is a way to write a sum with one symbol. In $\\sum_{k=1}^{6} 3 \\cdot 2^{k-1}$, the capital Greek letter $\\Sigma$ (sigma) means add up. The counter $k$ takes the values 1, 2, 3 and so on, from 1, written below the sigma, to 6, written above it. So there are six terms, starting with $3 \\cdot 2^0 = 3$, because any number other than 0 raised to the power 0 is 1.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the sum $3 + 6 + 12 + \\cdots + 96$.",
      steps: [
        "Find the first term and the common ratio. The first term is $a_1 = 3$. Each term is double the one before, so the common ratio is $r = 2$. Check: $6 \\div 3 = 2$.",
        "Count the terms. The last term is $96 = 3 \\times 32 = 3 \\cdot 2^5$. A term's exponent is one less than its position, so 96 is term 6, and $n = 6$.",
        "Use the sum formula: $S_6 = \\tfrac{3(2^6 - 1)}{2 - 1} = \\tfrac{3 \\times 63}{1}$.",
        "So $S_6 = 189$. Check by adding: $3 + 6 + 12 + 24 + 48 + 96 = 189$.",
      ],
      answer: "189",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For first term $a_1$, common ratio $r \\neq 1$ ($\\neq$ means is not equal to) and a number of terms $n$ that is 1 or more, the finite geometric sum is $S_n = \\tfrac{a_1(r^n - 1)}{r - 1}$. If $r = 1$, every term is $a_1$, so $S_n = n a_1$.",
        ],
      },
    ],
    pitfalls: [
      "$n$ counts terms, not the exponent of the last term. In 1, 2, 4, …, the term $2^5 = 32$ is the sixth term, because the first term is $2^0$.",
      "Use $r^n$ in the sum formula, not $r^{n-1}$, because $a_1 r^n$ is the term just after the last one.",
    ],
    parentGuide:
      "Put 1 coin in a jar on day 1, 2 coins on day 2 and 4 on day 3, doubling each day. Before adding up the week, ask the learner to predict the total from the next day's amount: it is one less. Then add the coins to check.",
  },
  {
    id: "logarithm-properties",
    title: "Logarithm rules",
    summary:
      "In a power like $2^3$, the base is the number being multiplied, 2, and the exponent is the small raised number, 3: it means three 2s multiplied together. A logarithm is the answer to one question: what exponent turns the base into this number? So $\\log_2 8 = 3$, because $2^3 = 8$. Because logarithms are exponents, they follow the same laws as exponents. Multiplying numbers adds their logarithms, dividing subtracts them, and raising to a power multiplies the logarithm.",
    senses: {
      base: "base-exponent",
      rule: "rule",
      product: "product-multiply",
      argument: "argument",
      difference: "difference-subtract",

      factor: "factor-number",
    },
    noLink: ["multiple", "multiples", "change"],
    templateIds: ["log-rules-evaluate", "log-expand", "change-of-base"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use the product, quotient and power rules (for multiplying, dividing and raising to a power) to work out and rewrite logarithms.",
      "Change the base of a logarithm to one that is easier to work with.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Multiplying numbers adds exponents",
        paragraphs: [
          "A logarithm names an exponent. $\\log_2 8 = 3$, read “log base 2 of 8 equals 3”, means $2^3 = 8$. The 2 is the base, 8 is the number inside, called the argument, and 3 is the exponent. A logarithm needs a positive base other than 1 and a positive argument.",
          "Multiplying powers of the same base adds their exponents: $2^2 \\times 2^3 = 2^5$, because two 2s times three 2s makes five 2s. In numbers, $4 \\times 8 = 32$ matches $2 + 3 = 5$. So the logarithm of a product (the result of a multiplication) is the sum of the logarithms: $\\log_2(4 \\times 8) = \\log_2 4 + \\log_2 8 = 2 + 3 = 5$.",
        ],
        illustration: "powers-product-table",
      },
      {
        stage: "intuition",
        title: "Product, quotient and power",
        paragraphs: [
          "The product rule: $\\log_b(mn) = \\log_b m + \\log_b n$, where $mn$ means $m$ times $n$. A quotient is the result of dividing one number by another. The quotient rule: $\\log_b \\tfrac{m}{n} = \\log_b m - \\log_b n$, because dividing powers subtracts their exponents. Both rules need $m$ and $n$ to be positive.",
          "The power rule: $\\log_b(m^p) = p \\log_b m$. For $p = 1, 2, 3$ and so on, you can see why: $m^p$ multiplies $p$ copies of $m$, so the logarithm of $m$ is added $p$ times. The rule holds for every number $p$.",
          "These rules can combine logarithms that are not whole numbers, meaning 0, 1, 2 and so on, on their own. $\\log_6 4$ and $\\log_6 9$ are not whole numbers, but $\\log_6 4 + \\log_6 9 = \\log_6 36 = 2$, because $6^2 = 36$.",
        ],
      },
      {
        title: "Change of base",
        paragraphs: [
          "Sometimes the base is awkward. $\\log_8 32$ asks: 8 to what power gives 32? Write both numbers as powers of 2: $8 = 2^3$ and $32 = 2^5$. Then $\\log_8 32 = \\tfrac{\\log_2 32}{\\log_2 8} = \\tfrac{5}{3}$. Check: $8^{5/3} = (2^3)^{5/3} = 2^5 = 32$.",
          "The change-of-base rule is $\\log_b N = \\tfrac{\\log_c N}{\\log_c b}$, for any new base $c$ that is positive and not 1. The old base goes on the bottom.",
          "Read backward, a fraction of two logarithms in one base is a single logarithm: $\\tfrac{\\log 81}{\\log 3} = \\log_3 81 = 4$. Here $\\log$ with no base written means base 10.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is $2\\log_3 6 - \\log_3 4$?",
      steps: [
        "Use the power rule to move the 2 in front inside as an exponent: $2\\log_3 6 = \\log_3 6^2 = \\log_3 36$.",
        "Use the quotient rule. A difference of logarithms with the same base divides their arguments: $\\log_3 36 - \\log_3 4 = \\log_3 \\tfrac{36}{4} = \\log_3 9$.",
        "Ask: 3 to what power gives 9? Since $3^2 = 9$, the value is 2.",
      ],
      answer: "2",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a base $b > 0$ with $b \\neq 1$ ($\\neq$ means is not equal to), and positive numbers $m$ and $n$: $\\log_b(mn) = \\log_b m + \\log_b n$ and $\\log_b \\tfrac{m}{n} = \\log_b m - \\log_b n$. For any number $p$ on the number line, $\\log_b(m^p) = p \\log_b m$.",
          "Logarithms turn products into sums, quotients into differences, and powers into a number times the logarithm.",
          "Change of base: for $N > 0$ and bases $b > 0$ and $c > 0$ with $b \\neq 1$ and $c \\neq 1$, $\\log_b N = \\tfrac{\\log_c N}{\\log_c b}$.",
        ],
      },
    ],
    pitfalls: [
      "In general, $\\log(m + n)$ is not $\\log m + \\log n$. The rules turn a product into a sum, not a sum into a sum.",
      "$\\tfrac{\\log m}{\\log n}$ is a change of base, equal to $\\log_n m$. It is not $\\log \\tfrac{m}{n}$.",
      "An exponent multiplies only the logarithm of its own factor: $\\log(2x^3) = \\log 2 + 3\\log x$, not $3\\log(2x)$.",
    ],
    parentGuide:
      "On a calculator, check that log 2 + log 5 equals log 10, which is 1. Then ask the learner for another pair of numbers whose logarithms add to 2, and why their product must be 100.",
  },
  {
    id: "geometric-sequences",
    title: "Repeated multiplication",
    summary:
      "Start with 3 and keep multiplying by 2: 3, 6, 12, 24, 48. A list of numbers in order is called a sequence, and each number in it is a term. When each term is the one before times the same number, the sequence is called geometric. That same number, here 2, is called the common ratio. Each copy of it that gets multiplied in is called a factor.",
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
          "To find the common ratio, divide a term by the one just before it, as long as that one is not 0: $12 \\div 6 = 2$. The ratio can be negative: in 2, $-6$, 18, it is $-3$, so the signs switch back and forth. It can be a fraction: in 48, 24, 12, it is $\\frac{1}{2}$, so each term is half the one before.",
        ],
        illustration: "geometric-ratio-table",
      },
      {
        title: "Count the steps, not the term number",
        paragraphs: [
          "We label terms by position with a small number written low, called a subscript. $a_1$ is the first term, $a_2$ the second, and $a_n$ the term in position $n$. The letter $r$ stands for the common ratio.",
          "Going from term 1 to term 5 takes four multiplications, not five. In general, reaching term $n$ takes $n - 1$ steps. So $a_n = a_1 \\times r^{n-1}$, where the raised $n - 1$ means multiply by $r$ that many times.",
          "A rule like $a_n = 3a_{n-1}$ builds the same kind of list one step at a time: each term is 3 times the term before it, $a_{n-1}$. This is called a recursive rule.",
          "Between any two known terms, the ratio is used once per step. From $a_2$ to $a_5$ is three steps, so $a_5 = a_2 \\times r^3$.",
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
          "For positions $n = 1, 2, 3, \\ldots$, a geometric sequence with first term $a_1$ and common ratio $r \\ne 0$ has $a_n = a_1 r^{n-1}$, where $r^0 = 1$. If $r \\ne 0$ and $a_k \\ne 0$ ($\\ne$ means is not equal to), then $\\frac{a_m}{a_k} = r^{m-k}$ for any positions $m$ and $k$.",
        ],
      },
    ],
    pitfalls: [
      "Using the power $n$ instead of $n - 1$ goes one term too far.",
      "Each step multiplies by the common ratio. Adding it instead gives a different list.",
    ],
    parentGuide:
      "Write each term with its position underneath. Draw an arrow marked “times 2” between neighbouring terms, and count the arrows to see why term 5 needs only four of them.",
  },
  {
    id: "logarithms",
    title: "Ask for the exponent",
    summary:
      "A power like $3^4 = 81$ has three parts. The base is the number being multiplied, 3. The exponent is the small raised number, 4: it means four 3s multiplied together. The result is 81. A logarithm is the exponent you are looking for when you know the base and the result. $\\log_3 81$, read “log base 3 of 81”, asks: 3 to what power gives 81? The answer is 4.",
    senses: {
      base: "base-exponent",
      argument: "argument",
      root: "root-radical",
    },
    noLink: ["parts", "mean"],
    templateIds: [
      "logarithm-integer",
      "logarithm-value",
      "log-exponential-form",
    ],
    objectives: [
      "Switch between a logarithm statement, like $\\log_3 81 = 4$, and the power statement it means, $3^4 = 81$.",
      "Find logarithms that are whole numbers, negative numbers or fractions.",
      "Place a logarithm between two whole numbers that are next to each other.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Three parts of a power",
        paragraphs: [
          "In $3^4 = 81$, 3 is the base, 4 is the exponent, and 81 is the result. The exponent counts how many copies of the base are multiplied together: $3 \\times 3 \\times 3 \\times 3 = 81$. A logarithm asks for the exponent when the base and the result are known.",
          "The statement $\\log_3 81 = 4$ means exactly the same as $3^4 = 81$. It does not mean 81 divided by 3. The base must be positive and different from one. The number inside the logarithm, called the argument, must be positive.",
        ],
      },
      {
        title: "Negative and fractional logarithms",
        paragraphs: [
          "On the graph of $y = \\log_2 x$, each doubling of $x$ adds 1 to $y$: $\\log_2 2 = 1$, $\\log_2 4 = 2$ and $\\log_2 8 = 3$. The curve passes through the point $(1, 0)$, because $2^0 = 1$.",
          "Halving $x$ takes 1 away from $y$. So $\\log_2 \\tfrac{1}{2} = -1$, because $2^{-1} = \\tfrac{1}{2}$. A negative exponent means one divided by the power.",
          "A root is the number that undoes a power: 3 is a root of 9, because $3^2 = 9$. A fractional exponent, an exponent that is a fraction, means a root. The exponent $\\tfrac{1}{2}$ means the square root, the positive number that, multiplied by itself, gives the number inside. The exponent $\\tfrac{1}{3}$ means the cube root, the number whose three copies multiply to give the number inside. A square root is the power $\\tfrac{1}{2}$, so $\\sqrt{8} = 8^{1/2} = (2^3)^{1/2} = 2^{3/2}$. That gives $\\log_2 \\sqrt{8} = \\tfrac{3}{2}$.",
          "A number between two powers has a logarithm between their exponents. The sign $<$ means is less than. Since $8 < 10 < 16$, that is $2^3 < 10 < 2^4$, $\\log_2 10$ is between 3 and 4.",
        ],
        illustration: "log-graph-points",
      },
    ],
    workedExample: {
      prompt: "What is log base 3 of 81?",
      steps: [
        "The question asks: 3 to what power gives 81? Call that power $p$, so we need $3^p = 81$.",
        "Multiply 3s until you reach 81: $3 \\times 3 = 9$, then $9 \\times 3 = 27$, then $27 \\times 3 = 81$.",
        "That took four 3s multiplied together, so $3^4 = 81$ and $p = 4$.",
      ],
      answer: "4",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a base $b > 0$ with $b \\neq 1$ ($\\neq$ means is not equal to) and a number $N > 0$, the statements $\\log_b N = p$ and $b^p = N$ say the same thing.",
          "$\\log_b b^k = k$ for every number $k$ on the number line, including numbers below 0 and fractions.",
        ],
      },
    ],
    pitfalls: [
      "A logarithm asks for an exponent. It is not $81 \\div 3$: $\\log_3 81$ is 4.",
      "Count how many 3s are multiplied together, not the $\\times$ signs. $3 \\times 3 \\times 3 \\times 3$ has four 3s but only three signs.",
      "With a base greater than 1, the logarithm of a fraction between 0 and 1 is negative: $\\log_2 \\tfrac{1}{8} = -3$, not $\\tfrac{1}{3}$.",
    ],
    parentGuide:
      "Write a familiar power, like $2^5 = 32$, and cover the exponent. Ask what it must be. Then write the same fact as a logarithm, $\\log_2 32 = 5$, and read it aloud together: “2 to what power gives 32?”",
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
      "An exponential rule multiplies by the same number for each step of $x$. It can be written $y = a \\times b^x$, where the raised $x$ means multiply by $b$ that many times. The number $a$ is the starting value, the value of $y$ when $x = 0$, because $b^0 = 1$. The number $b$ is the growth factor, the number each step multiplies by. Divide a value by the one just before it to find $b$. These values are never 0.",
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
      "Find $a$, the value at $x = 0$. Read it from the table or graph, or take the starting amount in the story.",
      "Find $b$, the growth factor for each step. Divide a value by the one before it, or turn a percent change into $1 + \\frac{p}{100}$ or $1 - \\frac{p}{100}$.",
      "Check the equation you chose at another point.",
    ],
    watch:
      "The starting value $a$ multiplies the power. The growth factor $b$ is the number being raised to the power. Do not swap them.",
  },
  "linear-or-exponential": {
    goal: "Given a table or a story, decide whether the change is linear, exponential or neither.",
    senses: {
      factor: "factor-number",
      difference: "difference-subtract",
    },
    noLink: ["changes", "change", "model", "balance", "whole"],
    intuition:
      "An input is a number you start with, and an output is the number you get from it. A linear relationship adds the same amount to the output each step, like 5, 8, 11, 14 (add 3 each time). An exponential relationship multiplies the output by the same number each step, like 3, 6, 12, 24 (times 2 each time). One that does neither is called neither.",
    method: [
      "Check that the inputs, the $x$-values, go up in equal steps, such as 0, 1, 2, 3.",
      "Find the differences: subtract each output from the next one. If they are all equal, the relationship is linear.",
      "If not, find the ratios: divide each output by the one before it (none of the outputs is 0 here). If they are all the same positive number, the relationship is exponential.",
      "If neither the differences nor the ratios stay the same, the relationship is neither.",
    ],
    watch:
      "“Grows by 5 each week” adds a fixed amount, so it is linear. “Grows by 5% each week” multiplies by 1.05 each week, so it is exponential.",
  },
  "exponential-overtakes": {
    goal: "Given a linear and an exponential function, find the first whole number input where the exponential is greater.",
    senses: { rule: "rule" },
    noLink: ["whole", "jumps"],
    intuition:
      "An input is a number you start with, and an output is the number you get. A function is a rule that turns each input into exactly one output. We write $f(x)$, read “$f$ of $x$”, for the output when the input is $x$. A linear function is one that adds the same amount each step. An exponential function is one that multiplies by the same number each step, so when its starting output is above 0 and that number is greater than 1, its jumps keep getting bigger. The sign $>$ means is greater than.",
    method: [
      "Work out both functions at the whole numbers, meaning 0, 1, 2 and so on, or continue both lists of values one step at a time.",
      "Compare the two values at each step.",
      "The answer is the first whole number where the exponential's value is greater than the linear one.",
    ],
    watch:
      "Keep comparing step by step. When the linear function starts ahead, it can stay ahead for several steps before the exponential passes it.",
  },
  "same-base-equation": {
    goal: "Given an exponential equation whose sides are powers of one base, find $x$ exactly.",
    senses: { base: "base-exponent", side: "side-of-equation" },
    noLink: ["mean"],
    intuition:
      "An exponential equation has the unknown $x$ in an exponent, the small raised number, as in $4^x = 32$. Two powers of the same base (the number being raised) are equal only when their exponents are equal, as long as the base is positive and not 1. So write both sides, meaning the left and the right of the equals sign, as powers of one base, then set the exponents equal.",
    method: [
      "Write each side as a power of the same base. For example, 4 is $2^2$ and 32 is $2^5$. A fraction like $\\tfrac{1}{8}$ is $2^{-3}$, because a negative exponent means one divided by the power.",
      "A power of a power multiplies the exponents: $(2^2)^x = 2^{2x}$.",
      "Set the two exponents equal, and solve that equation for $x$.",
    ],
    watch:
      "Rewrite the bases first. $4^x = 8$ does not mean $x = 8 \\div 4$. It means $2^{2x} = 2^3$, so $x = \\tfrac{3}{2}$.",
  },
  "exponential-log-solution": {
    goal: "Given an exponential equation with no common base, choose its exact logarithmic solution.",
    senses: { side: "side-of-equation", base: "base-exponent" },
    noLink: ["balance", "whole", "more than"],
    intuition:
      "In $3 \\cdot 10^x = 21$, the dot means times, the unknown $x$ is an exponent, and you cannot get 21 by multiplying 10s together. The base is the number being raised to a power. A logarithm is the missing exponent: $\\log_b k$, read “log base $b$ of $k$”, is the power of $b$ that gives $k$. So $10^x = 7$ means $x = \\log_{10} 7$.",
    terms: [terms.logarithm],
    method: [
      "Get the power alone. If a number is added to it, subtract that number from both sides, meaning the left and the right of the equals sign. Then divide both sides by the number multiplying it, which is never 0 here.",
      "Name the exponent with a logarithm in the same base: $b^x = k$ gives $x = \\log_b k$.",
      "If the exponent is more than just $x$, such as $x + 2$, set it equal to that logarithm and solve for $x$.",
    ],
    watch:
      "Divide by the number in front before you take the logarithm. The base of the power is the base of the logarithm.",
  },
  "log-equation": {
    goal: "Given a logarithmic equation, find the solution that keeps every logarithm defined.",
    senses: {
      base: "base-exponent",
      side: "side-of-equation",
      term: "term-expression",
      product: "product-multiply",
      factor: "factor-number",
      argument: "argument",
    },
    intuition:
      "The base is the number being raised to a power, and a logarithm is an exponent. $\\log_b A = n$, read “log base $b$ of $A$ equals $n$”, means $b^n = A$. The number $A$ inside the logarithm is called its argument. A logarithm exists only when its argument is positive.",
    terms: [terms.logarithm],
    method: [
      "If two logarithms with the same base are added, combine them into one by multiplying their arguments. If one is subtracted, divide by its argument instead.",
      "Rewrite $\\log_b A = n$ as $A = b^n$, then solve that equation.",
      "Put each answer back into every original logarithm. Reject any answer that makes an argument zero or negative.",
    ],
    watch:
      "Check each answer in the original logarithms. A zero or negative argument has no logarithm, so that answer is not a solution, a value that makes the equation true.",
  },
  "geometric-series-sum": {
    goal: "Given a finite geometric series, find its sum.",
    senses: { term: "term-sequence" },
    intuition:
      "A geometric sequence is a list where each term is the one before it times the same number. That number is called the common ratio, $r$. A geometric series is the sum of the terms of a geometric sequence, as in $3 + 6 + 12 + 24$ (times 2 each time). $a_1$, read “$a$ sub 1”, is the first term, and $n$ is the number of terms. A shortcut formula avoids adding them one by one.",
    terms: [terms.ratio],
    method: [
      "Find the first term $a_1$. Find the ratio, the number each term is multiplied by, by dividing a term by the one before it (a term that is not 0).",
      "Count the terms $n$. Term $n$ is $a_1 r^{n-1}$: its exponent is one less than its position. With sigma ($\\Sigma$, meaning add up), count the values of the counter from the number below the sigma to the number above it, including both.",
      "If $r$ is not 1, use $S_n = \\tfrac{a_1(r^n - 1)}{r - 1}$. When $r$ is between 0 and 1, the same value is $\\tfrac{a_1(1 - r^n)}{1 - r}$. If $r = 1$, every term is $a_1$, so the sum is $n a_1$.",
    ],
    watch:
      "$n$ is the number of terms. The last term is $a_1 r^{n-1}$, so its exponent is $n - 1$, not $n$.",
  },
  "log-rules-evaluate": {
    goal: "Given a sum, difference or multiple of logarithms with one base, find its value.",
    senses: {
      difference: "difference-subtract",
      base: "base-exponent",
      rule: "rule",
      product: "product-multiply",

      argument: "argument",
    },
    noLink: ["multiple"],
    intuition:
      "A logarithm is an exponent, and the base is the number being raised to a power. $\\log_b m$, read “log base $b$ of $m$”, is the power of $b$ that gives $m$. Adding logarithms with the same base multiplies their arguments, the numbers inside. Subtracting divides them. A number in front, as in $2\\log_3 6$, can move inside as an exponent.",
    terms: [terms.logarithm],
    method: [
      "Move any number in front inside as an exponent: $p \\log_b m = \\log_b m^p$.",
      "Combine into one logarithm: a sum multiplies the arguments, and a difference divides them.",
      "Write the single argument, the number inside the logarithm, as a power of the base. Its exponent is the value: $\\log_3 9 = 2$ because $3^2 = 9$.",
    ],
    watch:
      "These laws need one base. They combine products, the results of multiplying, and quotients, the results of dividing. $\\log(m + n)$ cannot be split into two logarithms.",
  },
  "log-expand": {
    goal: "Given a logarithm of a product, quotient or root, or a combination of logarithms, choose the equivalent form.",
    senses: {
      product: "product-multiply",
      factor: "factor-number",
      difference: "difference-subtract",
      rule: "rule",
      root: "root-radical",

      base: "base-exponent",
    },
    noLink: ["multiple", "multiples", "part", "combination"],
    intuition:
      "A logarithm is an exponent, so it follows the same laws as exponents. The base is the number being raised to a power. The logarithm of a product (a multiplication) is a sum of logarithms, and the logarithm of a quotient (a division) is a difference. The logarithm of a power is a multiple: $\\log(x^3) = 3\\log x$. A square root is the power $\\tfrac{1}{2}$, so $\\log\\sqrt{x} = \\tfrac{1}{2}\\log x$.",
    terms: [terms.logarithm],
    method: [
      "A product becomes a sum of logarithms. A quotient becomes a difference: the top's logarithm minus the bottom's.",
      "Each exponent becomes a number in front of its own logarithm, including the $\\tfrac{1}{2}$ of a square root.",
      "To condense, or combine into one logarithm, reverse the steps: numbers in front become exponents, then sums multiply and differences divide.",
    ],
    watch:
      "An exponent multiplies only the logarithm of its own factor, the part it is attached to, and the bottom's logarithm is subtracted.",
  },
  "change-of-base": {
    goal: "Given a logarithm in an awkward base, or a product or quotient of logs, find its value.",
    senses: {
      base: "base-exponent",
      rule: "rule",
      factor: "factor-number",
      product: "product-multiply",
    },
    noLink: ["change", "leaves"],
    intuition:
      "A logarithm is a missing exponent, and the base is the number being raised to a power. So $\\log_8 32$, read “log base 8 of 32”, asks: 8 to what power gives 32? That is hard to see directly. The change-of-base formula, a way to switch to an easier base, rewrites it: $\\log_8 32 = \\tfrac{\\log_2 32}{\\log_2 8} = \\tfrac{5}{3}$, because $32 = 2^5$ and $8 = 2^3$.",
    terms: [terms.logarithm],
    method: [
      "Use $\\log_b N = \\tfrac{\\log_c N}{\\log_c b}$, where $N$ is positive and both bases $b$ and $c$ are positive and not 1. The old base goes on the bottom.",
      "Choose a new base $c$ that makes both logarithms easy, often a number that $b$ and $N$ are both powers of.",
      "Work out both logarithms and divide, or cancel logarithms that appear on the top and the bottom.",
    ],
    watch:
      "$\\log_b N$ is $\\log N \\div \\log b$. The base goes on the bottom, not the top.",
  },
  "logarithm-value": {
    goal: "Given a logarithm of a reciprocal, root, decimal or a point on its graph, find its exact value.",
    senses: {
      root: "root-radical",
      factor: "factor-number",
      base: "base-exponent",
    },
    intuition:
      "The base is the number being raised to a power. A logarithm is an exponent: $\\log_b N$, read “log base $b$ of $N$”, is the exponent that turns the base $b$ into $N$. One over a power flips the sign of its exponent: $\\tfrac{1}{8} = \\tfrac{1}{2^3} = 2^{-3}$. A square root is the positive number that, multiplied by itself, gives what is inside. It has a fractional exponent: $\\sqrt{2} = 2^{1/2}$.",
    terms: [terms.logarithm],
    method: [
      "Write the number inside the logarithm as a power of the base. One over $b^k$ is $b^{-k}$, and a square root of $b^k$ is $b^{k/2}$.",
      "The logarithm is that exponent.",
    ],
    watch:
      "$\\log_b \\tfrac{1}{b^k}$ is $-k$, not $\\tfrac{1}{k}$: one over a power flips the sign of its exponent.",
  },
  "log-exponential-form": {
    goal: "Given a logarithmic or exponential statement, choose its other form, or place a logarithm between whole numbers.",
    senses: { base: "base-exponent", side: "side-of-equation" },
    noLink: ["part"],
    intuition:
      "A logarithm is an exponent, and the base is the number being raised to a power. A logarithm statement and a power statement can say the same thing. $\\log_2 8 = 3$, read “log base 2 of 8 equals 3”, means $2^3 = 8$: the logarithm is the exponent, the small raised number.",
    terms: [terms.logarithm],
    method: [
      "$\\log_b N = p$ and $b^p = N$ say the same thing. The base stays the base, the logarithm's value is the exponent, and $N$ is the result.",
      "To place $\\log_b N$ between whole numbers, meaning 0, 1, 2 and so on, take a base greater than 1 and $N$ greater than 1. List the powers $b^0 = 1, b^1, b^2, \\dots$ until one passes $N$. If one equals $N$, its exponent is the logarithm exactly. Otherwise the logarithm is between the exponents of the powers just below and just above $N$.",
    ],
    watch:
      "The result $N$ goes inside the logarithm, and the exponent is the logarithm's value.",
  },
  "geometric-sequence-rule": {
    goal: "Find the common ratio, a missing term or a later term of a geometric sequence, from some of its terms or its rule.",
    intuition:
      "A sequence is a list of numbers in order, and each number is a term. In a geometric sequence, each term is the one before times the same number, called the common ratio $r$. For example, 3, 6, 12, 24 has $r = 2$. To find $r$, divide a term by the one just before it (which must not be 0). Going forward one step multiplies by $r$, and going back one step divides by $r$, when $r$ is not 0. For two terms $k$ steps apart, the later one is the earlier one times $r^k$, meaning $k$ copies of $r$ multiplied together.",
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
      "Find the ratio $r$: divide a term by the term just before it (which is not 0).",
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
    "Over equal steps, linear functions have equal differences, and exponential functions have ratios that are all the same.",
  "exponential-overtakes":
    "For $a>0$ and $b>1$, $ab^x$ eventually exceeds every linear function of $x$ as $x$ increases.",
  "same-base-equation":
    "If $b > 0$ and $b \\neq 1$ ($\\neq$ means is not equal to), then $b^m = b^n$ exactly when $m = n$.",
  "exponential-log-solution":
    "$b^x = k$ exactly when $x = \\log_b k$, for $b > 0$, $b \\neq 1$ ($\\neq$ means is not equal to) and $k > 0$.",
  "log-equation":
    "$\\log_b A = n$ means $A = b^n$, and only positive arguments have logarithms.",
  "geometric-series-sum":
    "Finite geometric sum: $S_n = \\frac{a_1(r^n - 1)}{r - 1}$ for $r \\neq 1$ ($\\neq$ means is not equal to). If $r = 1$, every term is $a_1$ and $S_n = n a_1$.",
  "log-rules-evaluate":
    "For $b>0$, $b\\ne1$, and $m,n>0$, $\\log_b(mn)=\\log_b m+\\log_b n$ and $\\log_b(m/n)=\\log_b m-\\log_b n$. For real $p$, $\\log_b(m^p)=p\\log_b m$.",
  "log-expand":
    "For positive arguments and a positive base other than 1, logarithms turn products into sums, quotients into differences and powers into multiples.",
  "change-of-base":
    "For $N>0$ and bases $b,c>0$ with $b,c\\ne1$, change of base gives $\\log_b N=\\frac{\\log_c N}{\\log_c b}$.",
  "logarithm-value":
    "For a base $b > 0$ other than 1, $\\log_b b^k = k$ for every number $k$ on the number line, including negative and fractional exponents.",
  "log-exponential-form":
    "For a base $b > 0$ other than 1 and a number $N > 0$, $\\log_b N = p$ and $b^p = N$ are the same statement.",
  "geometric-sequence-rule":
    "For positions $n = 1, 2, 3, \\ldots$, a geometric sequence has $a_n = a_1 r^{n-1}$ (with $r \\ne 0$ and $r^0 = 1$), where $a_1$ is the first term and $r$ the common ratio. If $r \\ne 0$ and $a_k \\ne 0$, then $\\frac{a_m}{a_k} = r^{m-k}$.",
};
