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

export const exponentialLessons: Lesson[] = [
  {
    id: "exponential-models",
    title: "Growth by a constant factor",
    summary:
      "If each equal input step multiplies the output by the same factor, the quantity follows an exponential pattern. Its starting value and factor determine later values.",
    templateIds: ["exponential-model-value", "exponential-model-rule"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the starting value $a$ and the growth factor $b$ from a table, a graph or a story.",
      "Turn a percent change into a factor: growing by $p$% multiplies by 1 + p/100; losing $p$% multiplies by 1 − p/100.",
      "Evaluate an exponential model at a later time.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Adding against multiplying",
        paragraphs: [
          "Over equal steps in $x$, a linear function adds the same amount and an exponential function multiplies by the same factor. In the table, $3x + 2$ adds 3 each step; $2(3^x)$ multiplies by 3.",
          "In $y = a \\cdot b^x$, $a$ is the value at $x = 0$ and $b$ is the factor for each step. Read $a$ from the row where $x = 0$, and $b$ by dividing any value by the one before it.",
        ],
        illustration: "ratio-difference-table",
      },
      {
        title: "Percent change is a factor",
        paragraphs: [
          "Growing by 20% keeps the whole amount and adds a fifth: the factor is $1.2$. Losing 20% keeps 80%: the factor is $0.8$. A half-life halves the amount each period: the factor is $\\frac{1}{2}$.",
          "Multiplying by the same factor gives larger and larger jumps when $b > 1$, so doubling soon passes any fixed amount added each step.",
        ],
        illustration: "doubling-race-bars",
      },
    ],
    workedExample: {
      prompt:
        "A town of 2,000 people grows by 10% each year. How many people will it have after 3 years?",
      steps: [
        "Growing by 10% multiplies by $1.1$ each year.",
        "$2000 \\times 1.1^3 = 2000 \\times 1.331$.",
        "$= 2662$.",
      ],
      answer: "2662",
      answerUnit: "people",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a real starting value $a$ and positive factor $b$, the exponential model $y=a\\cdot b^t$ multiplies $a$ by $b$ once per unit of $t$.",
          "In $y=a\\cdot b^x$ with $b>0$, $a$ is the value at $x=0$. When $a\\ne0$, $b$ is the ratio between values one step apart.",
        ],
      },
    ],
    pitfalls: [
      "Adding 10% of the starting amount every year is linear growth; exponential growth takes 10% of the current amount.",
      "A loss of 20% is a factor of 0.8, not 0.2.",
    ],
    parentGuide:
      "Fold a sheet of paper in half again and again, counting the layers: 1, 2, 4, 8. Compare with adding one sheet each time. Ask which pile wins after 10 steps.",
  },
  {
    id: "growth-comparison",
    title: "Exponential growth overtakes linear growth",
    summary:
      "A pattern can grow by adding or by multiplying. Linear growth adds the same amount each step, like 10, 20, 30, 40. Exponential growth multiplies by the same number each step, like 1, 2, 4, 8. If the multiplying pattern starts above 0 and multiplies by more than 1, it passes the adding pattern in the end, however far behind it starts.",
    senses: {
      difference: "difference-subtract",
      change: "change",
      rule: "rule",
    },
    noLink: ["more than", "whole"],
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
          "A difference is the result of a subtraction. A ratio, here, is one value divided by the value before it. To test a table, first check that the inputs, the $x$-values, go up in equal steps, such as 0, 1, 2, 3.",
          "Then subtract each output, each $y$-value, from the next one. If every difference is the same, the pattern is linear: it adds a fixed amount each step. For outputs 5, 8, 11, 14, every difference is 3, so the pattern is linear.",
          "If the differences change, divide each output by the one before it. If every ratio is the same, the pattern is exponential: it multiplies by a fixed number each step. For outputs 3, 6, 12, 24, every ratio is 2, so the pattern is exponential. If neither the differences nor the ratios stay the same, the pattern is neither.",
          "Stories work the same way. “Adds 5 each week” is a fixed difference, so it is linear. Percent (%) means out of 100, so 5% of an amount is 0.05 times it. “Grows by 5% each week” keeps the whole amount and adds 0.05 of it, which multiplies by 1.05 each week: a fixed ratio, so it is exponential. “Adds one more each week than the week before” has neither.",
          "A function is a rule that gives one output for each input. We write $f(x)$, read “$f$ of $x$”, for the output of $f$ when the input is $x$. So $f(x) = 10x + 10$ means: multiply the input by 10, then add 10. In $g(x) = 2^x$, the small raised $x$ is an exponent: it says how many 2s to multiply together, so $2^3 = 2 \\times 2 \\times 2 = 8$, and $2^0 = 1$. The sign $>$ means is greater than, as in $8 > 5$.",
        ],
      },
      {
        title: "The crossing",
        paragraphs: [
          "Compare the line $y = 10x + 10$ with $y = 2^x$, which doubles each step. The line starts ahead: at $x = 0$ it is 10, while $2^0$ is only 1. The line adds 10 each step, and the exponential doubles.",
          "At $x = 6$ the line is still ahead, because 70 is greater than 64. At $x = 7$ the exponential passes it, because 128 is greater than 80. After that, each doubling adds at least 128, while the line adds only 10. So the exponential's lead keeps growing.",
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
          "Over equal steps of the input, a linear function $y = mx + c$ has equal differences, and an exponential function $y = a \\cdot b^x$ has equal ratios. Here $m$, $c$, $a$ and $b$ are fixed numbers, and the dot $\\cdot$ means times.",
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
      "In $2^x = 8$, the 2 is called the base and the unknown $x$ is the exponent: the small raised number that says how many 2s are multiplied together. A base with an exponent, like $2^3$, is called a power. Since $2 \\times 2 \\times 2 = 8$, the answer is $x = 3$. When both sides can be written as powers of the same base, set the exponents equal. When they cannot, a logarithm names the missing exponent.",
    senses: {
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
          "Often the bases look different at first. $4^x = 32$ has no whole-number answer, but 4 is $2^2$ and 32 is $2^5$. A power of a power multiplies the exponents: $(2^2)^x = 2^{2x}$, because $x$ copies of $2 \\times 2$ make $2x$ twos. So $4^x = 32$ becomes $2^{2x} = 2^5$, and $x = \\tfrac{5}{2}$.",
          "A fraction like $\\tfrac{1}{8}$ is also a power of 2. A negative exponent means one divided by the power: $2^{-3} = \\tfrac{1}{2^3} = \\tfrac{1}{8}$.",
        ],
      },
      {
        title: "When the bases do not match",
        paragraphs: [
          "In $3 \\cdot 10^x = 21$, the dot means times, and 21 is not a power of 10. First get the power alone. Divide both sides by 3 to get $10^x = 7$. Dividing both sides by the same number, other than 0, keeps them equal.",
          "Now ask: 10 to what power gives 7? That exponent is called a logarithm. It is written $\\log_{10} 7$ and read “log base 10 of 7”. So $x = \\log_{10} 7$, which is about 0.845. With no base written, $\\log$ means base 10. The natural logarithm $\\ln$ means base $e$, a special number about 2.718.",
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
        "Multiply out the bracket: $3x + 3 = 4x$. Subtract $3x$ from both sides to collect the $x$ terms on one side: $3 = x$.",
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
      "An answer that makes any logarithm's argument zero or negative is not a solution. Check every answer in the original equation.",
    ],
    parentGuide:
      "Start with 1 and ask how many doublings it takes to pass 1,000. Count together: 2, 4, 8, … After 10 doublings the amount is 1,024. Explain that the number of doublings is an exponent, and a logarithm is the tool that finds it.",
  },
  {
    id: "sequence-sums",
    title: "Adding a geometric sequence",
    summary:
      "A geometric sequence is a list of numbers where each one is the one before it times the same number, like 3, 6, 12, 24 (times 2 each time). That number is called the common ratio. Adding up the terms, the numbers in the list, gives a geometric series. Instead of adding them one by one, use a shortcut: multiply the sum by the ratio and subtract the original sum. Almost every term cancels.",
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
          "Write the sum of $n$ terms: $S_n = a_1 + a_1 r + a_1 r^2 + \\cdots + a_1 r^{n-1}$. The dots $\\cdots$ mean the pattern continues.",
          "Multiply every term by $r$: $r S_n = a_1 r + a_1 r^2 + \\cdots + a_1 r^{n}$. The two lists share every term except the first term of $S_n$ and the last term of $r S_n$.",
          "Subtract $S_n$ from $r S_n$. All the shared terms cancel, which leaves $r S_n - S_n = a_1 r^n - a_1$. Take out the common factor on each side: $S_n(r - 1) = a_1(r^n - 1)$.",
          "If $r$ is not 1, divide both sides by $r - 1$: $S_n = \\tfrac{a_1(r^n - 1)}{r - 1}$. When $r$ is between 0 and 1, the same value can be written $\\tfrac{a_1(1 - r^n)}{1 - r}$, which keeps the top and the bottom positive.",
        ],
      },
      {
        title: "Count the terms",
        paragraphs: [
          "In $3 + 6 + 12 + \\cdots + 96$, the last term is term $n$, so $3 \\cdot 2^{n-1} = 96$. The dot means times. Divide both sides by 3: $2^{n-1} = 32$. Since $32 = 2^5$, $n - 1 = 5$, and $n = 6$. There are six terms: 3, 6, 12, 24, 48 and 96.",
          "Sigma notation writes a sum with one symbol. In $\\sum_{k=1}^{6} 3 \\cdot 2^{k-1}$, the capital Greek letter $\\Sigma$ (sigma) means add up. The counter $k$ takes each whole number from 1, written below the sigma, to 6, written above it. So there are six terms, starting with $3 \\cdot 2^0 = 3$, because any number other than 0 raised to the power 0 is 1.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the sum $3 + 6 + 12 + \\cdots + 96$.",
      steps: [
        "Find the first term and the ratio. The first term is $a_1 = 3$. Each term is double the one before, so the ratio is $r = 2$. Check: $6 \\div 3 = 2$.",
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
          "For first term $a_1$, ratio $r \\neq 1$ ($\\neq$ means is not equal to) and a whole number of terms $n$ that is at least 1, the finite geometric sum is $S_n = \\tfrac{a_1(r^n - 1)}{r - 1}$. If $r = 1$, every term is $a_1$, so $S_n = n a_1$.",
        ],
      },
    ],
    pitfalls: [
      "$n$ counts terms, not the exponent of the last term. In 1, 2, 4, …, the term $2^5 = 32$ is the sixth term, because the first term is $2^0$.",
      "Use $r^n$ in the sum formula, not $r^{n-1}$. The formula needs the term just after the last one.",
    ],
    parentGuide:
      "Put 1 coin in a jar on day 1, 2 coins on day 2 and 4 on day 3, doubling each day. Before adding up the week, ask the learner to predict the total from the next day's amount: it is one less. Then add the coins to check.",
  },
  {
    id: "logarithm-properties",
    title: "Logarithm rules",
    summary:
      "A logarithm answers one question: what exponent turns the base into this number? The exponent is the small raised number in a power like $2^3$, which means three 2s multiplied together. So $\\log_2 8 = 3$, because $2^3 = 8$. Because logarithms are exponents, they follow the exponent rules. Multiplying numbers adds their logarithms, dividing subtracts them, and raising to a power multiplies the logarithm.",
    senses: {
      base: "base-exponent",
      rule: "rule",
      product: "product-multiply",
      argument: "argument",
      difference: "difference-subtract",
      multiple: "multiple",
      factor: "factor-number",
    },
    noLink: ["change"],
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
          "The product rule: $\\log_b(mn) = \\log_b m + \\log_b n$, where $mn$ means $m$ times $n$. The quotient rule: $\\log_b \\tfrac{m}{n} = \\log_b m - \\log_b n$, because dividing powers subtracts their exponents. A quotient is the result of a division. Both rules need $m$ and $n$ to be positive.",
          "The power rule: $\\log_b(m^p) = p \\log_b m$. Raising $m$ to the power $p$ multiplies $p$ copies of $m$, so the logarithm of $m$ is added $p$ times.",
          "These rules can combine logarithms that are not whole numbers on their own. $\\log_6 4$ and $\\log_6 9$ are not whole numbers, but $\\log_6 4 + \\log_6 9 = \\log_6 36 = 2$, because $6^2 = 36$.",
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
          "For a base $b > 0$ with $b \\neq 1$ ($\\neq$ means is not equal to), and positive numbers $m$ and $n$: $\\log_b(mn) = \\log_b m + \\log_b n$ and $\\log_b \\tfrac{m}{n} = \\log_b m - \\log_b n$. For any real number $p$, $\\log_b(m^p) = p \\log_b m$.",
          "Logarithms turn products into sums, quotients into differences, and powers into multiples.",
          "Change of base: for $N > 0$ and bases $b > 0$ and $c > 0$ with $b \\neq 1$ and $c \\neq 1$, $\\log_b N = \\tfrac{\\log_c N}{\\log_c b}$.",
        ],
      },
    ],
    pitfalls: [
      "$\\log(m + n)$ is not $\\log m + \\log n$. The rules turn a product into a sum, not a sum into a sum.",
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
      "A sequence is geometric when each term comes from multiplying the previous term by the same number.",
    templateIds: ["geometric-sequence", "geometric-sequence-rule"],
    objectives: [
      "Build terms by repeated multiplication.",
      "Use aₙ = a₁r^(n − 1) with first-term indexing.",
      "Find the ratio from consecutive terms, including negative and fractional ratios.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use the same ratio each step",
        paragraphs: [
          "Starting with three and multiplying by two produces 3, 6, 12, 24, 48. The common ratio is two because each term is twice the one before.",
          "Divide any term by the one before it to find the ratio. It can be negative, as in 2, −6, 18 with ratio −3, or a fraction, as in 48, 24, 12 with ratio $\\frac{1}{2}$.",
        ],
        illustration: "geometric-ratio-table",
      },
      {
        title: "Count the steps, not the term number",
        paragraphs: [
          "From term 1 to term 5 there are four multiplication steps. Thus term $n$ is a₁ × r^(n − 1).",
          "A recursive rule such as $a_n = 3a_{n-1}$ gives the same sequence one step at a time. Between two known terms, the ratio is applied once per step: from $a_2$ to $a_5$ is three steps, so $\\frac{a_5}{a_2} = r^3$.",
        ],
      },
    ],
    workedExample: {
      prompt: "The first term is 3 and the common ratio is 2. What is term 5?",
      steps: [
        "There are 5 − 1 = 4 steps after the first term.",
        "Multiply by 2 four times: 3, 6, 12, 24, 48.",
        "Equivalently, 3 × 2⁴ = 48.",
      ],
      answer: "48",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For positive whole-number positions $n$, a geometric sequence satisfies $a_n=a_1r^{n-1}$. If $r\\ne0$ and $a_k\\ne0$, then $a_m/a_k=r^{m-k}$ for positive positions $m,k$.",
        ],
      },
    ],
    pitfalls: [
      "Using exponent $n$ instead of n − 1 advances one term too far.",
      "Adding the common ratio does not generate a geometric sequence.",
    ],
    parentGuide:
      "Label each term with its position. Draw an arrow marked ×2 between terms and count the arrows to prevent indexing errors.",
  },
  {
    id: "logarithms",
    title: "Ask for the exponent",
    summary:
      "A power like $3^4 = 81$ has three parts. The base is 3. The exponent is 4, the small raised number: it means four 3s multiplied together. The result is 81. A logarithm asks for the exponent when you know the base and the result. $\\log_3 81$, read “log base 3 of 81”, asks: 3 to what power gives 81? The answer is 4.",
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
          "In $3^4 = 81$, 3 is the base, 4 is the exponent, and 81 is the result. The exponent counts how many times the base is multiplied: $3 \\times 3 \\times 3 \\times 3 = 81$. A logarithm asks for the exponent when the base and the result are known.",
          "The statement $\\log_3 81 = 4$ means exactly the same as $3^4 = 81$. It does not mean 81 divided by 3. The base must be positive and not 1. The number inside the logarithm, called the argument, must be positive.",
        ],
      },
      {
        title: "Negative and fractional logarithms",
        paragraphs: [
          "On the graph of $y = \\log_2 x$, each doubling of $x$ adds 1 to $y$: $\\log_2 2 = 1$, $\\log_2 4 = 2$ and $\\log_2 8 = 3$. The curve passes through the point $(1, 0)$, because $2^0 = 1$.",
          "Halving $x$ takes 1 away from $y$. So $\\log_2 \\tfrac{1}{2} = -1$, because $2^{-1} = \\tfrac{1}{2}$. A negative exponent means one divided by the power.",
          "Roots are fractional exponents. A square root is the power $\\tfrac{1}{2}$, so $\\sqrt{8} = 8^{1/2} = (2^3)^{1/2} = 2^{3/2}$. That gives $\\log_2 \\sqrt{8} = \\tfrac{3}{2}$.",
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
          "$\\log_b b^k = k$ for every real number $k$, including negative numbers and fractions.",
        ],
      },
    ],
    pitfalls: [
      "A logarithm asks for an exponent, not a division. $\\log_3 81$ is 4, not $81 \\div 3$.",
      "Count how many times the base is multiplied, not the multiplication signs. $3 \\times 3 \\times 3 \\times 3$ has four 3s but only three signs.",
      "The logarithm of a fraction like $\\tfrac{1}{8}$ is negative: $\\log_2 \\tfrac{1}{8} = -3$, not $\\tfrac{1}{3}$.",
    ],
    parentGuide:
      "Write a familiar power, like $2^5 = 32$, and cover the exponent. Ask what it must be. Then write the same fact as a logarithm, $\\log_2 32 = 5$, and read it aloud together: “2 to what power gives 32?”",
  },
];

export const exponentialMethods: Record<string, ProblemMethod> = {
  "exponential-model-value": {
    goal: "Given an exponential model as a table, a percent rate, a half-life or a formula, find its value at a later time.",
    terms: [terms.exponential],
    method: [
      "Find the starting value $a$ and the factor $b$ for one step: a percent increase $p$% gives b = 1 + p/100, a halving gives b = 1/2.",
      "Count the steps to the requested time.",
      "Multiply $a$ by $b$ once per step: $y = a \\cdot b^{\\text{steps}}$.",
    ],
    watch:
      "Multiply by the factor each step; adding the same percent of the start every step is linear, not exponential.",
  },
  "exponential-model-rule": {
    goal: "Given a table, a graph or a story, choose the equation $y = a·b$ˣ that fits it.",
    terms: [terms.exponential],
    method: [
      "$a$ is the value at x = 0: read it from the table or graph, or the story's starting amount.",
      "$b$ is the factor per step: divide a value by the one before it, or turn the percent change into 1 ± p/100.",
      "Check the chosen equation at another point.",
    ],
    watch:
      "The starting value multiplies the power; the factor is the base. Do not swap them.",
  },
  "linear-or-exponential": {
    goal: "Given a table or a story, decide whether the change is linear, exponential or neither.",
    senses: {
      factor: "factor-number",
      difference: "difference-subtract",
      change: "change",
    },
    noLink: ["model", "balance", "whole"],
    intuition:
      "A linear pattern adds the same amount each step, like 5, 8, 11, 14 (add 3 each time). An exponential pattern multiplies by the same number each step, like 3, 6, 12, 24 (times 2 each time). A pattern that does neither is called neither.",
    method: [
      "Check that the inputs, the $x$-values, go up in equal steps, such as 0, 1, 2, 3.",
      "Find the differences: subtract each output from the next one. If they are all equal, the pattern is linear.",
      "If not, find the ratios: divide each output by the one before it. If they are all equal, the pattern is exponential.",
      "If neither the differences nor the ratios stay the same, the pattern is neither.",
    ],
    watch:
      "“Grows by 5 each week” adds a fixed amount, so it is linear. “Grows by 5% each week” multiplies by 1.05 each week, so it is exponential.",
  },
  "exponential-overtakes": {
    goal: "Given a linear and an exponential function, find the first whole number input where the exponential is greater.",
    noLink: ["whole", "jumps"],
    intuition:
      "A linear function adds the same amount each step. An exponential function multiplies by the same number each step, so its jumps keep getting bigger. We write $f(x)$, read “$f$ of $x$”, for the output of $f$ when the input is $x$. The sign $>$ means is greater than.",
    method: [
      "Work out both functions at the whole numbers $x = 0, 1, 2, \\dots$, or continue both patterns one step at a time.",
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
      "An exponential equation has the unknown $x$ in an exponent, the small raised number, as in $4^x = 32$. Two powers of the same base (the number being raised) are equal only when their exponents are equal, as long as the base is positive and not 1. So write both sides as powers of one base, then set the exponents equal.",
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
      "In $3 \\cdot 10^x = 21$, the dot means times, the unknown $x$ is an exponent, and 21 is not a power of 10. A logarithm names the missing exponent: $\\log_b k$, read “log base $b$ of $k$”, is the power of $b$ that gives $k$. So $10^x = 7$ means $x = \\log_{10} 7$.",
    terms: [terms.logarithm],
    method: [
      "Get the power alone. If a number is added to it, subtract that number from both sides. Then divide both sides by the number multiplying it, which is never 0 here.",
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
      "$\\log_b A = n$, read “log base $b$ of $A$ equals $n$”, means $b^n = A$: the logarithm is the exponent. The number $A$ inside the logarithm is called its argument. A logarithm exists only when its argument is positive.",
    terms: [terms.logarithm],
    method: [
      "If two logarithms with the same base are added, combine them into one by multiplying their arguments. If one is subtracted, divide by its argument instead.",
      "Rewrite $\\log_b A = n$ as $A = b^n$, then solve that equation.",
      "Put each answer back into every original logarithm. Reject any answer that makes an argument zero or negative.",
    ],
    watch:
      "Check each answer in the original logarithms. A zero or negative argument has no logarithm, so that answer is not a solution.",
  },
  "geometric-series-sum": {
    goal: "Given a finite geometric series, find its sum.",
    senses: { term: "term-sequence" },
    intuition:
      "A geometric series adds a list where each term is the one before it times the same number, the common ratio $r$, as in $3 + 6 + 12 + 24$ (times 2 each time). $a_1$, read “$a$ sub 1”, is the first term, and $n$ is the number of terms. A shortcut formula avoids adding them one by one.",
    terms: [terms.ratio],
    method: [
      "Find the first term $a_1$. Find the ratio $r$ by dividing a term by the one before it (a term that is not 0).",
      "Count the terms $n$. Term $n$ is $a_1 r^{n-1}$: its exponent is one less than its position. With sigma ($\\Sigma$, meaning add up), count the whole numbers from the bottom limit to the top one.",
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
      multiple: "multiple",
      argument: "argument",
    },
    intuition:
      "A logarithm is an exponent: $\\log_b m$, read “log base $b$ of $m$”, is the power of $b$ that gives $m$. Adding logarithms with the same base multiplies their arguments, the numbers inside. Subtracting divides them. A number in front, as in $2\\log_3 6$, can move inside as an exponent.",
    terms: [terms.logarithm],
    method: [
      "Move any number in front inside as an exponent: $p \\log_b m = \\log_b m^p$.",
      "Combine into one logarithm: a sum multiplies the arguments, and a difference divides them.",
      "Write the single argument as a power of the base. Its exponent is the value: $\\log_3 9 = 2$ because $3^2 = 9$.",
    ],
    watch:
      "The rules need one base, and they combine products and quotients. $\\log(m + n)$ cannot be split into two logarithms.",
  },
  "log-expand": {
    goal: "Given a logarithm of a product, quotient or root, or a combination of logarithms, choose the equivalent form.",
    senses: {
      product: "product-multiply",
      factor: "factor-number",
      difference: "difference-subtract",
      rule: "rule",
      root: "root-radical",
      multiple: "multiple",
      base: "base-exponent",
    },
    noLink: ["combination"],
    intuition:
      "A logarithm is an exponent, so it follows the exponent rules. The logarithm of a product (a multiplication) is a sum of logarithms, and the logarithm of a quotient (a division) is a difference. The logarithm of a power is a multiple: $\\log(x^3) = 3\\log x$. A square root is the power $\\tfrac{1}{2}$, so $\\log\\sqrt{x} = \\tfrac{1}{2}\\log x$.",
    terms: [terms.logarithm],
    method: [
      "A product becomes a sum of logarithms. A quotient becomes a difference: the top's logarithm minus the bottom's.",
      "Each exponent becomes a number in front of its own logarithm, including the $\\tfrac{1}{2}$ of a square root.",
      "To condense, or combine into one logarithm, reverse the steps: numbers in front become exponents, then sums multiply and differences divide.",
    ],
    watch:
      "An exponent multiplies only the logarithm of its own factor, and the bottom's logarithm is subtracted.",
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
      "$\\log_8 32$, read “log base 8 of 32”, asks: 8 to what power gives 32? That is hard to see directly. The change-of-base rule rewrites it in an easier base: $\\log_8 32 = \\tfrac{\\log_2 32}{\\log_2 8} = \\tfrac{5}{3}$, because $32 = 2^5$ and $8 = 2^3$.",
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
      "$\\log_b N$, read “log base $b$ of $N$”, is the exponent that turns the base $b$ into $N$. One over a power has a negative exponent: $\\tfrac{1}{8} = \\tfrac{1}{2^3} = 2^{-3}$. A root has a fractional exponent: $\\sqrt{2} = 2^{1/2}$.",
    terms: [terms.logarithm],
    method: [
      "Write the number inside the logarithm as a power of the base. One over $b^k$ is $b^{-k}$, and a square root of $b^k$ is $b^{k/2}$.",
      "The logarithm is that exponent.",
    ],
    watch:
      "$\\log_b \\tfrac{1}{b^k}$ is $-k$, not $\\tfrac{1}{k}$: one over a power makes its exponent negative.",
  },
  "log-exponential-form": {
    goal: "Given a logarithmic or exponential statement, choose its other form, or place a logarithm between whole numbers.",
    senses: { base: "base-exponent", side: "side-of-equation" },
    noLink: ["part"],
    intuition:
      "A logarithm statement and a power statement can say the same thing. $\\log_2 8 = 3$, read “log base 2 of 8 equals 3”, means $2^3 = 8$: the logarithm is the exponent, the small raised number.",
    terms: [terms.logarithm],
    method: [
      "$\\log_b N = p$ and $b^p = N$ say the same thing. The base stays the base, the logarithm's value is the exponent, and $N$ is the result.",
      "To place $\\log_b N$ between whole numbers, list powers of $b$ until one passes $N$. The logarithm is between the two exponents on either side.",
    ],
    watch:
      "The result $N$ goes inside the logarithm, and the exponent is the logarithm's value.",
  },
  "geometric-sequence-rule": {
    goal: "Given terms or a rule of a geometric sequence, find the ratio, a missing term or another term.",
    terms: [terms.ratio],
    method: [
      "The ratio $r$ is any term divided by the term before it.",
      "Between terms $k$ steps apart, the quotient is rᵏ.",
      "Multiply by $r$ once per step forward, or divide once per step back.",
    ],
    watch:
      "Keep the sign: a ratio can be negative, so terms may alternate in sign.",
  },
};

export const exponentialPrinciples: Record<string, string> = {
  "exponential-model-value":
    "For a real starting value $a$ and positive factor $b$, the exponential model $y=a\\cdot b^t$ multiplies $a$ by $b$ once per unit of $t$.",
  "exponential-model-rule":
    "In $y=a\\cdot b^x$ with $b>0$, $a$ is the value at $x=0$. When $a\\ne0$, $b$ is the ratio between values one step apart.",
  "linear-or-exponential":
    "Over equal steps, linear functions have equal differences and exponential functions have equal ratios.",
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
    "For a base $b > 0$ other than 1, $\\log_b b^k = k$ for every real number $k$, including negative and fractional exponents.",
  "log-exponential-form":
    "For a base $b > 0$ other than 1 and a number $N > 0$, $\\log_b N = p$ and $b^p = N$ are the same statement.",
  "geometric-sequence-rule":
    "For positive whole-number positions $n$, a geometric sequence satisfies $a_n=a_1r^{n-1}$. If $r\\ne0$ and $a_k\\ne0$, then $a_m/a_k=r^{m-k}$ for positive positions $m,k$.",
};
