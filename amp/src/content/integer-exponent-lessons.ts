import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const foundations: Lesson["sections"] = [
  {
    stage: "intuition",
    title: "Read a power",
    paragraphs: [
      "A positive integer power repeats multiplication: $2^3=2\\times2\\times2=8$. The base is the number being multiplied, and its positive exponent counts its factors. Here the base is 2 and the exponent is 3.",
      "A letter such as $x$ can represent a number. These lessons use nonzero real bases: any points on the number line except zero. You need multiplication and division of signed numbers to work with them.",
    ],
  },
  {
    stage: "intuition",
    title: "Zero powers and reciprocals",
    paragraphs: [
      "For a fixed base of 2, lowering the exponent by 1 divides the value by 2: $2^3=8$, $2^2=4$, $2^1=2$, $2^0=1$, and $2^{-1}=1/2$. An integer exponent can be positive, zero, or negative; the dividing pattern continues through zero.",
      "A fraction $a/b$ means $a$ divided by $b$; $a$ is its numerator and $b$ its nonzero denominator. A reciprocal multiplies a nonzero number to make 1: the reciprocal of 2 is $1/2$, and the reciprocal of $-2/3$ is $-3/2$. A negative exponent calls for a reciprocal, not a negative answer. Zero has no reciprocal because zero times any number is zero, never 1. Division by zero is undefined.",
    ],
  },
];

export const integerExponentLessons: Lesson[] = [
  {
    id: "negative-integer-power",
    title: "Understand and evaluate negative powers",
    summary:
      "Each step down in a power divides by the base. Continue past an exponent of zero to make a negative power: $2^0=1$, then $2^{-1}=1/2$.",
    templateIds: ["negative-integer-power"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain zero and negative exponents using repeated division.",
      "Evaluate powers of nonzero signed fractions exactly.",
    ],
    sections: [
      ...foundations,
      {
        stage: "method",
        title: "Follow the pattern through zero",
        paragraphs: [
          "In the table, the base stays 2. Moving down one row decreases the exponent by 1 and divides the value by 2.",
          "The values stay positive even when the exponents become negative.",
        ],
        illustration: "integer-exponent-ladder",
      },
      {
        stage: "method",
        title: "A fractional or negative base",
        paragraphs: [
          "For a nonzero fraction, exchange the numerator and denominator to take its reciprocal. Raising that reciprocal to a positive power gives the original fraction raised to the corresponding negative power: (2 / 3)^(−2) = (3 / 2)^2 = 9/4.",
          "Parentheses identify the entire base. In (−2)^2, both factors are −2, so the result is 4. In −2^2, the exponent applies to 2 first, and the leading minus gives −4. A negative base raised to an even integer power is positive; an odd integer power is negative. Taking a reciprocal does not change that sign.",
          "To raise a fraction to a positive integer power, raise its numerator and denominator to that power. For example, (3 / 2)^2 = (3 × 3) / (2 × 2) = 9/4. Keep the answer as a fraction rather than rounding a decimal.",
        ],
      },
    ],
    workedExample: {
      prompt: "Evaluate (−2 / 3)^(−3).",
      steps: [
        "The base is −2/3. Its reciprocal is −3/2 because (−2 / 3) × (−3 / 2) = 1.",
        "Use the reciprocal with a positive exponent: (−2 / 3)^(−3) = (−3 / 2)^3.",
        "Multiply three copies: (−3 / 2)^3 = ((−3) × (−3) × (−3)) / (2 × 2 × 2).",
        "The numerator is −27 and the denominator is 8. The value is −27/8.",
        "Check: the original base to the positive third power is −8/27. Its product with −27/8 is 1, as required for reciprocals.",
      ],
      answer: "−27/8",
    },
    closingSections: [
      {
        stage: "formal",
        title: "The precise rule",
        paragraphs: [
          "For a nonzero real base $x$ and a positive integer $n$, $x^{-n}=1/x^n$. Also $x^0=1$. The base cannot be zero because $1/0$ is undefined.",
          "If the base is a fraction $a/b$ with nonzero $a$ and $b$, then $(a/b)^{-n}=(b/a)^n$. Parentheses make the whole signed fraction the base.",
        ],
      },
    ],
    pitfalls: [
      "A negative exponent does not mean change the sign of the base.",
      "Take the reciprocal of the whole fraction, then apply the positive exponent.",
      "Zero has no reciprocal, so a negative power of zero is undefined.",
    ],
    parentGuide:
      "Ask why 2^(−3) is positive but (−2)^(−3) is negative. Have the learner multiply each result by the corresponding positive third power to check that the product is 1.",
  },
  {
    id: "product-of-powers-exponent",
    title: "Multiply powers with the same base",
    summary:
      "Two powers with the same base contribute groups of the same factor. Multiplying them joins those groups.",
    templateIds: ["product-of-powers-exponent"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain the product rule by counting factors.",
      "Combine positive, zero, and negative integer exponents.",
    ],
    sections: [
      ...foundations,
      {
        title: "Join the factors",
        paragraphs: [
          "A product is the result of multiplication. In x^2 × x^3, the first power contributes two factors equal to $x$ and the second contributes three. There are five altogether: (x × x) × (x × x × x) = x^5. The base stays $x$; only the number of factors changes.",
          "For any nonzero $x$ and integer exponents $m$ and $n$, $x^{m} \\times  x^{n} = x^{m + n}$. The words same base matter: 2^3 × 5^2 cannot be combined by adding 3 and 2 to make a power of either base.",
        ],
      },
      {
        title: "Reciprocals make the rule work for negative exponents",
        paragraphs: [
          "In x^3 × x^(−2), the negative power means 1 / x^2. Two of the three numerator factors cancel with the two denominator factors. One factor $x$ is left, agreeing with 3 + (−2) = 1.",
          "If both exponents are negative, both powers are reciprocals. Their denominators combine: x^(−2) × x^(−3) = 1 / x^5 = x^(−5). If the exponents sum to zero, the product is x^0 = 1. Multiplication by x^0 changes nothing because it is multiplication by 1.",
        ],
      },
    ],
    workedExample: {
      prompt: "For every nonzero real $x$, x^(−3) × x^5 = x^k. What is $k$?",
      steps: [
        "The two powers have the same base $x$. Add their exponents: −3 + 5 = 2.",
        "Therefore x^(−3) × x^5 = x^2, so k = 2.",
        "To see why, write x^(−3) as 1 / x^3. The product is x^5 / x^3. Cancel three nonzero factors equal to $x$, leaving two.",
      ],
      answer: "2",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For nonzero $x$ and integer exponents $m$ and $n$, $x^{m} \\times  x^{n} = x^{m + n}$: combine factors and cancel reciprocal pairs.",
        ],
      },
    ],
    pitfalls: [
      "Multiply the powers but add their exponents. Multiplying the exponents is a different rule.",
      "Keep each exponent's sign when adding.",
      "The requested answer $k$ is an exponent, not the value of the power.",
    ],
    parentGuide:
      "Ask the learner to explain why x^4 × x^(−4) equals 1 for nonzero $x$, then why x^4 + x^(−4) does not use the product rule.",
  },
  {
    id: "quotient-of-powers-exponent",
    title: "Divide powers with the same base",
    summary:
      "Dividing powers of the same nonzero base cancels matching factors, leaving the difference between their exponents.",
    templateIds: ["quotient-of-powers-exponent"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain the quotient rule by cancellation or reciprocals.",
      "Subtract signed exponents in the correct order.",
    ],
    sections: [
      ...foundations,
      {
        title: "Cancel matching factors",
        paragraphs: [
          "A quotient is the result of division. In x^5 / x^2, the numerator has five factors equal to $x$ and the denominator has two. Each matching numerator and denominator factor gives x/x = 1. Three numerator factors remain, so the quotient is x^3.",
          "If the denominator has more factors, the uncancelled factors stay below the fraction bar. For example, x^2 / x^5 = 1 / x^3 = x^(−3). The exponent calculation is 2 − 5 = −3.",
        ],
      },
      {
        title: "Subtract the denominator's exponent",
        paragraphs: [
          "For nonzero $x$ and any integers $m$ and $n$, $x^{m} \\div  x^{n} = x^{m - n}$. Dividing by x^n means multiplying by its reciprocal x^(−n). The product rule then adds $m$ and −n, giving m − n.",
          "The order is numerator exponent minus denominator exponent. Subtracting a negative adds its positive opposite: 2 − (−3) = 2 + 3 = 5. If the exponents match, the quotient is x^0 = 1. The condition x ≠ 0 makes every division valid.",
        ],
      },
    ],
    workedExample: {
      prompt: "For every nonzero real $x$, x^(−2) ÷ x^(−5) = x^k. What is $k$?",
      steps: [
        "Subtract the denominator's exponent from the numerator's exponent: k = −2 − (−5).",
        "Subtracting −5 adds 5: −2 + 5 = 3. Therefore k = 3.",
        "Check with reciprocals: x^(−2) ÷ x^(−5) = (1 / x^2) ÷ (1 / x^5). Dividing by 1 / x^5 multiplies by x^5, giving x^5 / x^2 = x^3.",
      ],
      answer: "3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For nonzero $x$ and integer exponents $m$ and $n$, $x^{m} \\div  x^{n} = x^{m - n}$: division multiplies by the reciprocal.",
        ],
      },
    ],
    pitfalls: [
      "Subtract exponents; do not divide them.",
      "Reversing the subtraction reverses the exponent's sign.",
      "Keep parentheses around a negative denominator exponent until you apply the subtraction.",
    ],
    parentGuide:
      "Compare x^2 / x^5 with x^5 / x^2. Ask why their results are reciprocals and their exponents are opposites.",
  },
  {
    id: "power-of-power-exponent",
    title: "Raise a power to another power",
    summary:
      "Raising a power to another power repeats whole groups of factors. Count the groups and the factors in each group.",
    templateIds: ["power-of-power-exponent"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Distinguish a product of powers from a power of a power.",
      "Combine nested powers with positive, zero, and negative integer exponents.",
    ],
    sections: [
      ...foundations,
      {
        title: "Count groups of factors",
        paragraphs: [
          "Parentheses tell you which expression the outer exponent acts on. In (x^2)^3, the outer exponent 3 requests three copies of x^2: x^2 × x^2 × x^2. Each copy contains two factors equal to $x$. Three groups of two give six factors, so (x^2)^3 = x^6.",
          "For nonzero $x$ and integer exponents $m$ and $n$, $(x^{m})^{n} = x^{m \\times  n}$. Multiply the inner exponent by the outer exponent. Compare (x^2)^3 with x^2 × x^3: the first has exponent 2 × 3 = 6; the second has exponent 2 + 3 = 5.",
        ],
      },
      {
        title: "A negative or zero outer exponent",
        paragraphs: [
          "A negative outer exponent takes a reciprocal after forming the positive power. For example, (x^2)^(−3) = 1 / (x^2)^3 = 1 / x^6 = x^(−6). If the inner exponent is also negative, taking the reciprocal reverses its sign again.",
          "A zero outer exponent gives 1 because the inner power is nonzero. A zero inner exponent also gives 1: the inner power is x^0 = 1, and any integer power of 1 is 1. Both cases agree with multiplying the exponents to obtain 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "For every nonzero real $x$, (x^(−2))^(−3) = x^k. What is $k$?",
      steps: [
        "The inner exponent is −2 and the outer exponent is −3. Multiply: (−2) × (−3) = 6.",
        "Therefore (x^(−2))^(−3) = x^6, so k = 6.",
        "Check the meaning: x^(−2) = 1 / x^2. The outer exponent −3 takes the reciprocal of three copies of 1 / x^2. Their product is 1 / x^6; its reciprocal is x^6.",
      ],
      answer: "6",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For nonzero $x$ and integer exponents $m$ and $n$, $(x^{m})^{n} = x^{m \\times  n}$: repeat groups of factors, using reciprocals for negative powers.",
        ],
      },
    ],
    pitfalls: [
      "Add exponents for a product of powers; multiply exponents for a power of a power.",
      "A negative outer exponent takes a reciprocal, not an opposite.",
      "These rules use integer exponents and a nonzero base; do not apply them to undefined expressions.",
    ],
    parentGuide:
      "Ask the learner to expand (x^3)^2 into factors and compare it with x^3 × x^2. Then ask why a zero in either exponent of a power of a power gives a value of 1.",
  },
];

export const integerExponentMethods: Record<string, ProblemMethod> =
  Object.fromEntries(
    integerExponentLessons.map((lesson) => [
      lesson.id,
      {
        goal: lesson.objectives[1]!,
        terms: [
          "base-exponent",
          [
            "exponent",
            "A positive exponent counts factors, and a zero exponent gives 1 for a nonzero base.",
          ],
          "negative-exponent",
        ],
        method:
          lesson.id === "negative-integer-power"
            ? [
                "Keep any negative sign inside the base's parentheses.",
                "Exchange the nonzero numerator and denominator to take the reciprocal.",
                "Raise that reciprocal to the positive exponent. Multiply numerator factors and denominator factors, then simplify.",
              ]
            : [
                "Check the operation and keep the same nonzero base $x$.",
                lesson.id === "product-of-powers-exponent"
                  ? "For a product, add the two exponents."
                  : lesson.id === "quotient-of-powers-exponent"
                    ? "For a quotient, subtract the denominator's exponent from the numerator's exponent."
                    : "For a power of a power, multiply the inner and outer exponents.",
                "Calculate with the signed integers. Enter the exponent $k$, not the value of the power.",
              ],
        watch: lesson.pitfalls[0],
      },
    ]),
  );
export const integerExponentPrinciples: Record<string, string> = {
  "negative-integer-power":
    "For a nonzero base $x$ and positive integer $n$, $x^{-n} = 1 / x^{n}$. The reciprocal makes the product with x^n equal 1.",
  "product-of-powers-exponent":
    "For nonzero $x$ and integer exponents $m$ and $n$, $x^{m} \\times  x^{n} = x^{m + n}$: combine factors and cancel reciprocal pairs.",
  "quotient-of-powers-exponent":
    "For nonzero $x$ and integer exponents $m$ and $n$, $x^{m} \\div  x^{n} = x^{m - n}$: division multiplies by the reciprocal.",
  "power-of-power-exponent":
    "For nonzero $x$ and integer exponents $m$ and $n$, $(x^{m})^{n} = x^{m \\times  n}$: repeat groups of factors, using reciprocals for negative powers.",
};
