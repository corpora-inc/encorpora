import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const exponentSenses = {
  base: "base-exponent",
  factor: "factor-number",
  product: "product-multiply",
  squared: "square-number",
  opposite: "opposite-number",
  difference: "difference-subtract",
} as const;

const foundations: Lesson["sections"] = [
  {
    stage: "intuition",
    title: "Read a power",
    paragraphs: [
      "A factor is a number being multiplied, and the product is the answer when you multiply. A power is a short way to write the same factor multiplied again and again: $2^3 = 2 \\times 2 \\times 2 = 8$. The big number 2 is called the base: it is the factor that repeats. The small raised 3 is called the exponent. A positive exponent counts how many times the base is used as a factor.",
      "A letter such as $x$ can stand for a number. In these lessons the base is never 0. It can be any real number, meaning any number on the number line, except zero. That includes negative numbers, which are less than 0, and fractions. You will multiply and divide negative numbers, so remember: a negative times a negative is positive, and a negative times a positive is negative.",
    ],
  },
  {
    stage: "intuition",
    title: "Zero powers and reciprocals",
    paragraphs: [
      "Keep the base 2 and lower the exponent one step at a time. Each step down divides the value by 2: $2^3 = 8$, $2^2 = 4$, $2^1 = 2$, $2^0 = 1$, and then $2^{-1} = \\tfrac{1}{2}$. The pattern carries on past zero into negative exponents. An integer is a whole number or its negative (… −2, −1, 0, 1, 2 …), and an integer exponent can be positive, zero or negative.",
      "A fraction $\\tfrac{a}{b}$ means $a$ divided by $b$. The top number $a$ is the numerator, and the bottom number $b$ is the denominator, which is never 0. The reciprocal of a number is what you multiply it by to get 1. For a fraction, flip it: swap the numerator and denominator. The reciprocal of 2 is $\\tfrac{1}{2}$, and the reciprocal of $-\\tfrac{2}{3}$ is $-\\tfrac{3}{2}$, because $\\left(-\\tfrac{2}{3}\\right) \\times \\left(-\\tfrac{3}{2}\\right) = 1$.",
      "A negative exponent means “take the reciprocal”. It does not change the sign: $2^{-1} = \\tfrac{1}{2}$, and $(-2)^{-1} = -\\tfrac{1}{2}$. Zero has no reciprocal, because zero times any number is zero, never 1. Dividing by zero has no answer, so the base is never 0.",
    ],
  },
];

export const integerExponentLessons: Lesson[] = [
  {
    id: "negative-integer-power",
    title: "Understand and evaluate negative powers",
    summary:
      "In $2^3$, three 2s are multiplied: $2 \\times 2 \\times 2$. The repeated number is called the base, and the small raised 3 is called the exponent. Each step down in the exponent divides by the base: $2^2 = 4$, $2^1 = 2$, $2^0 = 1$. Keep going past zero: $2^{-1} = \\tfrac{1}{2}$ and $2^{-2} = \\tfrac{1}{4}$. A negative exponent means: use the matching positive exponent, then take the reciprocal, the number that multiplies with the result to make 1. It does not change the sign of the base.",
    templateIds: ["negative-integer-power"],
    includeGeneratedRepresentation: false,
    senses: exponentSenses,
    noLink: ["change", "changes", "whole", "third", "fourth", "rule", "rules"],
    objectives: [
      "Explain zero and negative exponents by dividing by the base one step at a time.",
      "Find the exact value of a negative power of a fraction or a negative number.",
    ],
    sections: [
      ...foundations,
      {
        stage: "method",
        title: "Follow the pattern through zero",
        paragraphs: [
          "In the table, the base stays 2. Moving down one row lowers the exponent by 1 and divides the value by 2.",
          "The values stay positive even when the exponents become negative: $2^{-3} = \\tfrac{1}{8}$, not −8.",
        ],
        illustration: "integer-exponent-ladder",
      },
      {
        stage: "method",
        title: "A fractional or negative base",
        paragraphs: [
          "For a fraction that is not 0, flip it to get its reciprocal. Then raise the reciprocal to the matching positive exponent: $\\left(\\tfrac{2}{3}\\right)^{-2} = \\left(\\tfrac{3}{2}\\right)^{2} = \\tfrac{9}{4}$.",
          "Parentheses show the whole base. In $(-2)^2$, both factors are −2, so the result is $(-2) \\times (-2) = 4$. In $-2^2$, the exponent applies only to the 2, and the minus sign in front is applied after: $-(2 \\times 2) = -4$.",
          "A negative base with an even exponent (2, 4, 6, …) gives a positive result, because the negatives pair up. With an odd exponent (1, 3, 5, …) the result is negative. Taking a reciprocal does not change the sign.",
          "To raise a fraction to a positive exponent, raise its numerator and its denominator to that exponent: $\\left(\\tfrac{3}{2}\\right)^{2} = \\tfrac{3 \\times 3}{2 \\times 2} = \\tfrac{9}{4}$. Keep the answer as a fraction instead of a rounded decimal.",
        ],
      },
    ],
    workedExample: {
      prompt: "Evaluate $\\left(-\\tfrac{2}{3}\\right)^{-3}$.",
      steps: [
        "The base is $-\\tfrac{2}{3}$. Flip it to get its reciprocal, $-\\tfrac{3}{2}$. Check: $\\left(-\\tfrac{2}{3}\\right) \\times \\left(-\\tfrac{3}{2}\\right) = 1$.",
        "The negative exponent means use the reciprocal with the positive exponent: $\\left(-\\tfrac{2}{3}\\right)^{-3} = \\left(-\\tfrac{3}{2}\\right)^{3}$.",
        "Multiply three copies, numerators together and denominators together: $\\left(-\\tfrac{3}{2}\\right)^{3} = \\tfrac{(-3) \\times (-3) \\times (-3)}{2 \\times 2 \\times 2}$.",
        "Three negatives multiply to a negative, so the numerator is −27. The denominator is 8. The value is $-\\tfrac{27}{8}$.",
        "Check: the original base to the positive third power is $\\left(-\\tfrac{2}{3}\\right)^{3} = -\\tfrac{8}{27}$. Multiplying it by $-\\tfrac{27}{8}$ gives 1, as reciprocals must.",
      ],
      answer: "−27/8",
    },
    closingSections: [
      {
        stage: "formal",
        title: "The precise rule",
        paragraphs: [
          "For a real base $x$ that is not 0 and a positive integer $n$, $x^{-n} = \\tfrac{1}{x^{n}}$. Also $x^0 = 1$. The base cannot be 0, because $\\tfrac{1}{0}$ is undefined: it has no value.",
          "If the base is a fraction $\\tfrac{a}{b}$ with $a$ and $b$ both not 0, then $\\left(\\tfrac{a}{b}\\right)^{-n} = \\left(\\tfrac{b}{a}\\right)^{n}$. Parentheses make the whole signed fraction the base.",
        ],
      },
    ],
    pitfalls: [
      "A negative exponent does not flip the sign of the base. It means take the reciprocal: $2^{-1} = \\tfrac{1}{2}$, not −2.",
      "Flip the whole fraction first, then apply the positive exponent to both its numerator and its denominator.",
      "Zero has no reciprocal, so a negative power of zero has no value.",
    ],
    parentGuide:
      "Ask why $2^{-3}$ is positive but $(-2)^{-3}$ is negative. Have the learner multiply each result by the matching positive third power, $2^3$ or $(-2)^3$, and check that the product is 1.",
  },
  {
    id: "product-of-powers-exponent",
    title: "Multiply powers with the same base",
    summary:
      "In $x^2$, two $x$s are multiplied: $x \\times x$. The repeated number is called the base, and the small raised 2 is called the exponent. So $x^2 \\times x^3$ is two $x$s times three more $x$s. That is five $x$s in all, or $x^5$. When two powers have the same base, multiplying them adds their exponents.",
    templateIds: ["product-of-powers-exponent"],
    includeGeneratedRepresentation: false,
    senses: exponentSenses,
    noLink: ["change", "changes", "whole", "third", "fourth", "rule", "rules"],
    objectives: [
      "Explain, by counting factors, why multiplying powers with the same base adds their exponents.",
      "Combine powers with positive, zero and negative integer exponents.",
    ],
    sections: [
      ...foundations,
      {
        title: "Join the factors",
        paragraphs: [
          "A product is the answer when you multiply. In $x^2 \\times x^3$, the first power gives two factors of $x$ and the second gives three. Together there are five: $(x \\times x) \\times (x \\times x \\times x) = x^5$. The base stays $x$. Only the count of factors changes, and the counts add: 2 + 3 = 5.",
          "In letters: for any $x$ other than 0 and integer exponents $m$ and $n$, $x^{m} \\times x^{n} = x^{m + n}$. The bases must be the same. In $2^3 \\times 5^2$ the factors are 2s and 5s. Adding the exponents does not work here, because $2^5$ and $5^5$ are both wrong answers.",
        ],
      },
      {
        title: "Reciprocals make the rule work for negative exponents",
        paragraphs: [
          "In $x^3 \\times x^{-2}$, the negative power means a reciprocal: $x^{-2} = \\tfrac{1}{x^2}$. So the product is $\\tfrac{x \\times x \\times x}{x \\times x}$. Each $x$ on top cancels one $x$ below, because $\\tfrac{x}{x} = 1$. One $x$ is left, which matches 3 + (−2) = 1.",
          "If both exponents are negative, both powers are reciprocals, and their denominators join: $x^{-2} \\times x^{-3} = \\tfrac{1}{x^5} = x^{-5}$. If the exponents add to zero, the product is $x^0 = 1$. Multiplying by $x^0$ changes nothing, because it is multiplying by 1.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "For every real number $x$ other than 0, $x^{-3} \\times x^5 = x^k$. What is $k$?",
      steps: [
        "Both powers have the same base, $x$, so multiplying them adds the exponents: −3 + 5 = 2.",
        "So $x^{-3} \\times x^5 = x^2$, and $k = 2$.",
        "Check why: $x^{-3} = \\tfrac{1}{x^3}$, so the product is $\\tfrac{x^5}{x^3}$. Three $x$s on top cancel the three below, since $x$ is not 0. Two $x$s are left.",
      ],
      answer: "2",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a real number $x$ other than 0 and integer exponents $m$ and $n$, $x^{m} \\times x^{n} = x^{m + n}$. The factors join, and each factor paired with its reciprocal cancels to 1.",
        ],
      },
    ],
    pitfalls: [
      "Multiply the powers, but add their exponents: $x^2 \\times x^3 = x^5$, not $x^6$. Multiplying the exponents is the rule for a power of a power.",
      "Keep each exponent's sign when adding: 4 + (−6) = −2.",
      "The answer $k$ is the exponent, not the value of the power.",
    ],
    parentGuide:
      "Ask the learner to explain why $x^4 \\times x^{-4} = 1$ when $x$ is not 0. Then ask why $x^4 + x^{-4}$ cannot use the same rule: it adds the powers instead of multiplying them.",
  },
  {
    id: "quotient-of-powers-exponent",
    title: "Divide powers with the same base",
    summary:
      "In $x^5$, five $x$s are multiplied. The repeated number is called the base, and the small raised 5 is called the exponent. Dividing $x^5$ by $x^2$ cancels two $x$s on top with the two below, because $\\tfrac{x}{x} = 1$. Three $x$s are left, so the answer is $x^3$. When two powers have the same base (not 0), dividing subtracts the bottom exponent from the top one: 5 − 2 = 3.",
    templateIds: ["quotient-of-powers-exponent"],
    includeGeneratedRepresentation: false,
    senses: exponentSenses,
    noLink: ["change", "changes", "whole", "third", "fourth", "rule", "rules"],
    objectives: [
      "Explain, by cancelling factors, why dividing powers with the same base subtracts their exponents.",
      "Subtract signed exponents in the correct order.",
    ],
    sections: [
      ...foundations,
      {
        title: "Cancel matching factors",
        paragraphs: [
          "A quotient is the answer to a division. In $\\tfrac{x^5}{x^2}$, the numerator (top) has five factors of $x$ and the denominator (bottom) has two. Each $x$ on top paired with an $x$ below makes $\\tfrac{x}{x} = 1$. Three $x$s are left on top, so the quotient is $x^3$.",
          "If the denominator has more factors, the leftover factors stay below the fraction bar. For example, $\\tfrac{x^2}{x^5} = \\tfrac{1}{x^3} = x^{-3}$. The exponents give the same answer: 2 − 5 = −3.",
        ],
      },
      {
        title: "Subtract the denominator's exponent",
        paragraphs: [
          "In letters: for $x$ other than 0 and integers $m$ and $n$, $x^{m} \\div x^{n} = x^{m - n}$. Here is why. Dividing by $x^n$ is the same as multiplying by its reciprocal, $x^{-n}$. Multiplying powers adds exponents, so the exponent is $m + (-n) = m - n$.",
          "The order is the top exponent minus the bottom exponent. Subtracting a negative number adds its opposite, the same size with the other sign: 2 − (−3) = 2 + 3 = 5. If the exponents match, the quotient is $x^0 = 1$. The base is never 0, so every division here has an answer.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "For every real number $x$ other than 0, $x^{-2} \\div x^{-5} = x^k$. What is $k$?",
      steps: [
        "Both powers have the same base, so subtract the bottom exponent from the top exponent: $k = -2 - (-5)$.",
        "Subtracting −5 is the same as adding 5: −2 + 5 = 3. So $k = 3$.",
        "Check with reciprocals: $x^{-2} \\div x^{-5} = \\tfrac{1}{x^2} \\div \\tfrac{1}{x^5}$. Dividing by $\\tfrac{1}{x^5}$ multiplies by $x^5$, giving $\\tfrac{x^5}{x^2} = x^3$.",
      ],
      answer: "3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a real number $x$ other than 0 and integer exponents $m$ and $n$, $x^{m} \\div x^{n} = x^{m - n}$, because dividing by $x^n$ multiplies by its reciprocal $x^{-n}$.",
        ],
      },
    ],
    pitfalls: [
      "Subtract the exponents; do not divide them: $\\tfrac{x^6}{x^2} = x^4$, not $x^3$.",
      "Reversing the subtraction flips the exponent's sign: 2 − 5 = −3, but 5 − 2 = 3.",
      "Keep parentheses around a negative bottom exponent until you subtract: $3 - (-4) = 7$.",
    ],
    parentGuide:
      "Compare $\\tfrac{x^2}{x^5}$ with $\\tfrac{x^5}{x^2}$. Ask why the two results are reciprocals of each other and why their exponents are opposites, −3 and 3.",
  },
  {
    id: "power-of-power-exponent",
    title: "Raise a power to another power",
    summary:
      "In $x^2$, two $x$s are multiplied. The repeated number is called the base, and the small raised 2 is called the exponent. Then $(x^2)^3$ means three copies of $x^2$ multiplied: $x^2 \\times x^2 \\times x^2$. That is three groups of two $x$s, or six $x$s, so $(x^2)^3 = x^6$. Raising a power to another power multiplies the exponents: 2 × 3 = 6.",
    templateIds: ["power-of-power-exponent"],
    includeGeneratedRepresentation: false,
    senses: exponentSenses,
    noLink: ["change", "changes", "whole", "third", "fourth", "rule", "rules"],
    objectives: [
      "Tell a product of powers, such as $x^2 \\times x^3$, from a power of a power, such as $(x^2)^3$.",
      "Combine nested powers with positive, zero and negative integer exponents.",
    ],
    sections: [
      ...foundations,
      {
        title: "Count groups of factors",
        paragraphs: [
          "Parentheses show what the outer exponent acts on. In $(x^2)^3$, the outer exponent 3 asks for three copies of $x^2$: $x^2 \\times x^2 \\times x^2$. Each copy holds two factors of $x$. Three groups of two make six factors, so $(x^2)^3 = x^6$.",
          "In letters: for $x$ other than 0 and integer exponents $m$ and $n$, $(x^{m})^{n} = x^{m \\times n}$. Multiply the inner exponent by the outer one. Compare $(x^2)^3$ with $x^2 \\times x^3$. The first has exponent 2 × 3 = 6. The second has exponent 2 + 3 = 5.",
        ],
      },
      {
        title: "A negative or zero outer exponent",
        paragraphs: [
          "A negative outer exponent means: form the positive power, then take its reciprocal. For example, $(x^2)^{-3} = \\tfrac{1}{(x^2)^3} = \\tfrac{1}{x^6} = x^{-6}$. If the inner exponent is negative too, the reciprocal flips its sign again, which matches a negative times a negative being positive.",
          "A zero outer exponent gives 1, because the inner power is not 0. A zero inner exponent also gives 1: the inner power is $x^0 = 1$, and 1 to any integer power is 1. Both cases match multiplying the exponents to get 0, since $x^0 = 1$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "For every real number $x$ other than 0, $(x^{-2})^{-3} = x^k$. What is $k$?",
      steps: [
        "The inner exponent is −2 and the outer exponent is −3. A power of a power multiplies the exponents: (−2) × (−3) = 6, since a negative times a negative is positive.",
        "So $(x^{-2})^{-3} = x^6$, and $k = 6$.",
        "Check the meaning: $x^{-2} = \\tfrac{1}{x^2}$. Three copies of $\\tfrac{1}{x^2}$ multiply to $\\tfrac{1}{x^6}$. The negative outer exponent takes the reciprocal of that, which is $x^6$.",
      ],
      answer: "6",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a real number $x$ other than 0 and integer exponents $m$ and $n$, $(x^{m})^{n} = x^{m \\times n}$. The outer exponent repeats whole groups of factors, and a negative exponent takes a reciprocal.",
        ],
      },
    ],
    pitfalls: [
      "Add exponents when multiplying powers with the same base, $x^2 \\times x^3 = x^5$. Multiply exponents for a power of a power, $(x^2)^3 = x^6$.",
      "A negative outer exponent takes a reciprocal; it does not just flip a sign.",
      "In this lesson the exponents are integers and the base is not 0. Do not use these rules on expressions that have no value, such as $0^{-2}$.",
    ],
    parentGuide:
      "Ask the learner to write $(x^3)^2$ as separate factors of $x$ and compare it with $x^3 \\times x^2$. Then ask why a zero in either exponent of a power of a power gives 1.",
  },
];

const exponentTerms: ProblemMethod["terms"] = [
  "base-exponent",
  [
    "exponent",
    "A positive exponent counts factors, and a zero exponent gives 1 for a base other than 0.",
  ],
  "negative-exponent",
];
const exponentIntuition =
  "A power such as $x^3$ means $x \\times x \\times x$. The number that repeats is called the base, and the small raised 3 is called the exponent. A factor is a number being multiplied, and a positive exponent counts the factors. A negative exponent means take the reciprocal: $x^{-2} = \\tfrac{1}{x^2}$. The base is never 0.";

export const integerExponentMethods: Record<string, ProblemMethod> = {
  "negative-integer-power": {
    goal: "Find the exact value of a negative power: flip the base to its reciprocal, then raise it to the positive exponent.",
    terms: exponentTerms,
    senses: exponentSenses,
    noLink: ["change", "whole", "third", "fourth", "rule", "rules"],
    intuition:
      "In $2^3 = 2 \\times 2 \\times 2$, the number that repeats is called the base, and the small raised 3 is called the exponent. A factor is a number being multiplied, and a positive exponent counts the factors. A negative exponent means: use the matching positive exponent, then take the reciprocal, the number that multiplies with the result to make 1. For a fraction, swap the top and bottom: $\\left(\\tfrac{2}{3}\\right)^{-2} = \\left(\\tfrac{3}{2}\\right)^{2} = \\tfrac{9}{4}$.",
    method: [
      "Keep any minus sign inside the parentheses with the base.",
      "Flip the base: swap its numerator (top) and denominator (bottom) to take the reciprocal.",
      "Raise the reciprocal to the positive exponent. Multiply the top factors and the bottom factors, then simplify.",
    ],
    watch:
      "A negative exponent means take the reciprocal; it does not change the sign. $2^{-1} = \\tfrac{1}{2}$, not −2, and $(-2)^{-1} = -\\tfrac{1}{2}$.",
  },
  "product-of-powers-exponent": {
    goal: "Two powers of the same base are multiplied. Find the exponent of the result by adding the two exponents.",
    terms: exponentTerms,
    senses: exponentSenses,
    noLink: ["change", "whole", "third", "fourth", "rule", "rules"],
    intuition: `${exponentIntuition} Multiplying $x^2 \\times x^3$ joins two $x$s and three $x$s into five, so the exponents add.`,
    method: [
      "Check that both powers have the same base $x$, and that they are multiplied.",
      "Add the two exponents, keeping their signs.",
      "Enter the exponent $k$, not the value of the power.",
    ],
    watch:
      "Add the exponents; do not multiply them: $x^2 \\times x^3 = x^5$, not $x^6$.",
  },
  "quotient-of-powers-exponent": {
    goal: "One power is divided by another with the same base. Find the exponent of the result by subtracting.",
    terms: exponentTerms,
    senses: exponentSenses,
    noLink: ["change", "whole", "third", "fourth", "rule", "rules"],
    intuition: `${exponentIntuition} Dividing $x^5$ by $x^2$ cancels two matching $x$s, leaving $x^3$, so the exponents subtract.`,
    method: [
      "Check that both powers have the same base $x$, and that one is divided by the other.",
      "Subtract the bottom (dividing) exponent from the top exponent. Subtracting a negative adds its opposite: 2 − (−3) = 5.",
      "Enter the exponent $k$, not the value of the power.",
    ],
    watch:
      "Subtract top minus bottom, in that order; do not divide the exponents.",
  },
  "power-of-power-exponent": {
    goal: "A power is raised to another power. Find the exponent of the result by multiplying the two exponents.",
    terms: exponentTerms,
    senses: exponentSenses,
    noLink: ["change", "whole", "third", "fourth", "rule", "rules"],
    intuition: `${exponentIntuition} $(x^2)^3$ is three copies of $x^2$, three groups of two $x$s, so the exponents multiply: 2 × 3 = 6.`,
    method: [
      "Parentheses, the curved marks ( ), hold the inner power. Find the inner exponent, inside them, and the outer exponent.",
      "Multiply them, using the sign rules: a negative times a negative is positive.",
      "Enter the exponent $k$, not the value of the power.",
    ],
    watch:
      "Multiply the exponents for a power of a power. Adding them is the rule for multiplying two powers with the same base.",
  },
};
export const integerExponentPrinciples: Record<string, string> = {
  "negative-integer-power":
    "For a base $x$ other than 0 and a positive integer $n$, $x^{-n} = \\tfrac{1}{x^{n}}$. This reciprocal times $x^{n}$ equals 1.",
  "product-of-powers-exponent":
    "For $x$ other than 0 and integer exponents $m$ and $n$, $x^{m} \\times x^{n} = x^{m + n}$: the factors join, and reciprocal pairs cancel.",
  "quotient-of-powers-exponent":
    "For $x$ other than 0 and integer exponents $m$ and $n$, $x^{m} \\div x^{n} = x^{m - n}$, because dividing multiplies by the reciprocal.",
  "power-of-power-exponent":
    "For $x$ other than 0 and integer exponents $m$ and $n$, $(x^{m})^{n} = x^{m \\times n}$: whole groups of factors repeat, with reciprocals for negative powers.",
};
