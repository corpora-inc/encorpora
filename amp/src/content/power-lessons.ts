import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const powerLessons: Lesson[] = [
  {
    id: "whole-number-powers",
    title: "Powers count repeated factors",
    summary:
      "An exponent counts how many copies of the base are multiplied: $3^4 = 3 \\cdot 3 \\cdot 3 \\cdot 3$.",
    templateIds: [
      "integer-power",
      "power-repeated-product",
      "power-missing-exponent",
    ],
    objectives: [
      "Write a repeated product as a power and a power as a repeated product.",
      "Evaluate a power by building it from a smaller power, and find a missing exponent.",
    ],
    sections: [
      {
        title: "Factors, not repeated addition",
        paragraphs: [
          "In $3^4$ the base 3 is the repeated factor and the exponent 4 counts the factors: $3^4 = 3 \\cdot 3 \\cdot 3 \\cdot 3 = 81$. It is not $3 \\cdot 4 = 12$, which adds four 3s.",
          "Each step up the exponent multiplies by the base once more: $3^1 = 3$, $3^2 = 9$, $3^3 = 27$. Each step down divides by the base, which is why $3^0 = 1$.",
        ],
        illustration: "power-ladder",
      },
      {
        title: "Build big powers from small ones",
        paragraphs: [
          "Split the factors into groups whose powers you know. $3^4 = 3^2 \\cdot 3^2 = 9 \\cdot 9 = 81$, and $2^7 = 2^5 \\cdot 2^2 = 32 \\cdot 4 = 128$.",
          "Run it backwards to find a missing exponent: to solve $2^n = 32$, divide 32 by 2 until you reach 1. Five divisions means $n = 5$.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is $3^5$?",
      steps: [
        "Peel off one factor: $3^5 = 3^4 \\cdot 3$.",
        "$3^4 = 3^2 \\cdot 3^2 = 9 \\cdot 9 = 81$.",
        "$81 \\cdot 3 = 243$.",
      ],
      answer: "243",
    },
    pitfalls: [
      "$3^4$ is not $3 \\cdot 4$, and $4^3$ is a different number.",
      "A nonzero base to the power 0 is 1, not 0.",
    ],
    parentGuide:
      "Fold a sheet of paper in half again and again, counting layers: 2, 4, 8, 16. Each fold is one more factor of 2.",
  },
  {
    id: "comparing-powers",
    title: "Comparing powers and growth by doubling",
    summary:
      "Swapping a base and its exponent changes the value, an exponent applies only to what it touches, and repeated doubling is a power of 2.",
    templateIds: ["power-compare", "power-order-trap", "power-doubling-story"],
    objectives: [
      "Compare powers such as $2^5$ and $5^2$ by evaluating both.",
      "Evaluate expressions with powers in the conventional order, and read doubling and tripling as powers.",
    ],
    sections: [
      {
        title: "Swapping changes the value",
        paragraphs: [
          "$2^5$ is five factors of 2, which is 32; $5^2$ is two factors of 5, which is 25. To compare two powers, evaluate both.",
          "Doubling ties squaring at $n = 2$ and $n = 4$, where $2^4 = 4^2 = 16$, and then pulls ahead for good: each step doubles $2^n$, while $n^2$ grows by a smaller and smaller factor.",
        ],
        illustration: "power-race-bars",
      },
      {
        title: "An exponent touches one thing",
        paragraphs: [
          "In $3 \\cdot 4^2$ the exponent belongs to 4 alone: $3 \\cdot 16 = 48$. Parentheses make the exponent apply to the whole group: $(3 \\cdot 4)^2 = 12^2 = 144$.",
          "Likewise $(2 + 3)^2 = 5^2 = 25$, which is not $2^2 + 3^2 = 13$.",
        ],
      },
      {
        title: "Doubling is a power of 2",
        paragraphs: [
          "Each fold of a sheet of paper doubles its layers, so 6 folds make $2^6 = 64$ layers: one factor of 2 per fold.",
          "A count that starts at 1 and triples each day is $3^n$ on day $n$. To reach day 5 from the bars for days 0 to 3, multiply $3^3 = 27$ by 3 twice: 81, then 243.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is greater, $2^6$ or $6^2$?",
      steps: [
        "$2^6 = 2^3 \\cdot 2^3 = 8 \\cdot 8 = 64$.",
        "$6^2 = 6 \\cdot 6 = 36$.",
        "$64 > 36$, so $2^6$ is greater.",
      ],
      answer: "$2^6$",
    },
    pitfalls: [
      "$a^b$ and $b^a$ are usually different numbers.",
      "In $2 \\cdot 3^2$ square only the 3; in $(2 \\cdot 3)^2$ square the product.",
    ],
    parentGuide:
      "Race two piles of counters: one gains 10 each round, the other doubles from 1. Ask which is ahead after each round, and when the doubling pile takes the lead.",
  },
];

export const powerMethods: Record<string, ProblemMethod> = {
  "power-missing-exponent": {
    goal: "Given a base and a value, find the exponent that makes the power equal the value.",
    method: [
      "Divide the value by the base again and again until you reach 1.",
      "Count the divisions: that count is the exponent.",
      "Check by multiplying that many factors of the base.",
    ],
    watch:
      "Count factors, not multiplication signs: $2 \\cdot 2 \\cdot 2$ has three factors, so it is $2^3$.",
  },
  "power-repeated-product": {
    goal: "Match a repeated product to its power, or a power to its repeated product.",
    method: [
      "The repeated factor is the base.",
      "The number of factors is the exponent: $5 \\cdot 5 \\cdot 5 \\cdot 5 = 5^4$.",
      "Reject sums and products of the base and exponent: $5 \\cdot 4$ and $5 + 5 + 5 + 5$ are not powers.",
    ],
    watch: "Do not swap them: four factors of 5 is $5^4$, not $4^5$.",
  },
  "power-compare": {
    goal: "Decide which of two powers, or a power and a product, is greater.",
    method: [
      "Write each power as its factors.",
      "Evaluate both, building from small powers: $2^6 = 2^3 \\cdot 2^3$.",
      "Compare the two values; equal values mean neither is greater.",
    ],
    watch:
      "Swapping base and exponent usually changes the value: $2^5 = 32$ but $5^2 = 25$.",
  },
  "power-order-trap": {
    goal: "Evaluate a product or sum that contains a power.",
    method: [
      "Work inside parentheses first.",
      "Then evaluate powers: an exponent applies only to the number or group just before it.",
      "Then multiply, then add.",
    ],
    watch:
      "$2 \\cdot 3^2 = 2 \\cdot 9 = 18$, not $6^2$; and $(2 + 3)^2 = 25$, not $4 + 9$.",
  },
  "power-doubling-story": {
    goal: "Given a quantity that doubles or triples at each step, find its value at a later step.",
    method: [
      "Each step multiplies by the same factor, so step $n$ is that factor to the power $n$.",
      "Build the power from the last bar shown: $2^7 = 2^3 \\cdot 2^4 = 8 \\cdot 16$.",
    ],
    watch:
      "Doubling is multiplying by 2 each step, not adding 2: after 5 folds there are $2^5 = 32$ layers, not 10.",
  },
};

export const powerPrinciples: Record<string, string> = {
  "power-missing-exponent":
    "If $b^n = v$, then $n$ is the number of times $v$ can be divided by $b$ to reach 1.",
  "power-repeated-product":
    "A product of $n$ equal factors $b$ is the power $b^n$: the base is the factor, the exponent the count.",
  "power-compare":
    "Powers are compared by value; exchanging base and exponent generally changes the value.",
  "power-order-trap":
    "Exponents are evaluated before multiplication and addition, and apply only to the base or parenthesized group they follow.",
  "power-doubling-story":
    "A quantity that starts at 1 and is multiplied by $b$ at each step equals $b^n$ after $n$ steps.",
};
