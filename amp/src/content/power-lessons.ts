import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const powerSenses = {
  base: "base-exponent",
  factor: "factor-number",
  product: "product-multiply",
  square: "square-number",
  squared: "square-number",
  squaring: "square-number",
  squares: "square-number",
} as const;

export const powerLessons: Lesson[] = [
  {
    id: "whole-number-powers",
    title: "Powers count repeated factors",
    summary:
      "A factor is a number being multiplied. A power is a short way to write the same factor multiplied again and again. In $3^4$, the big number 3 is called the base: it is the factor that repeats. The small raised 4 is called the exponent: it counts how many 3s are multiplied. So $3^4 = 3 \\times 3 \\times 3 \\times 3 = 81$, read “3 to the fourth power”.",
    templateIds: [
      "integer-power",
      "power-repeated-product",
      "power-missing-exponent",
    ],
    senses: powerSenses,
    noLink: ["changes", "fourth", "change"],
    objectives: [
      "Write a repeated multiplication as a power, and a power as a repeated multiplication.",
      "Find the value of a power by building it from a smaller power.",
      "Find a missing exponent by dividing back down to 1.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Factors, not repeated addition",
        paragraphs: [
          "A factor is a number being multiplied, and the product is the answer when you multiply. In $3^4$, the base 3 is the factor that repeats. The exponent 4, written small and raised, counts the factors: $3^4 = 3 \\times 3 \\times 3 \\times 3 = 81$.",
          "The exponent does not multiply the base by 4. $3 \\times 4 = 12$ is four 3s added: 3 + 3 + 3 + 3. A power multiplies the 3s instead, which grows much faster.",
          "Each step up in the exponent multiplies by the base one more time: $3^1 = 3$, $3^2 = 3 \\times 3 = 9$, $3^3 = 9 \\times 3 = 27$. Each step down divides by the base: 27 ÷ 3 = 9, then 9 ÷ 3 = 3, then 3 ÷ 3 = 1. That is why $3^0 = 1$. Any base other than 0 gives 1 for the exponent 0.",
        ],
        illustration: "power-ladder",
      },
      {
        title: "Build big powers from small ones",
        paragraphs: [
          "You can split the repeated factors into smaller groups whose values you know. Four 3s are two 3s times two more 3s: $3^4 = 3^2 \\times 3^2 = 9 \\times 9 = 81$. Seven 2s are five 2s times two more 2s: $2^7 = 2^5 \\times 2^2 = 32 \\times 4 = 128$.",
          "Run it backwards to find a missing exponent. To solve $2^n = 32$, find how many 2s multiply to make 32. Divide 32 by 2 until you reach 1: 32, 16, 8, 4, 2, 1. That took five divisions, so five 2s make 32 and $n = 5$.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is $3^5$?",
      steps: [
        "$3^5$ means five 3s multiplied. Split off one 3 so the rest is a smaller power: $3^5 = 3^4 \\times 3$.",
        "Find $3^4$ from two smaller powers, because four 3s are two 3s times two 3s: $3^4 = 3^2 \\times 3^2 = 9 \\times 9 = 81$.",
        "Multiply by the 3 you split off: $81 \\times 3 = 243$.",
        "Check by multiplying one 3 at a time: 3, 9, 27, 81, 243. Five 3s give 243.",
      ],
      answer: "243",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a number $b$ and a positive whole number $n$ (1, 2, 3 and so on), the power $b^n$ is the product of $n$ factors, each equal to $b$. The base is $b$ and the exponent is $n$.",
          "For $b$ greater than 1, the equation $b^n = v$ means that dividing $v$ by $b$ exactly $n$ times reaches 1. This check needs a base greater than 1. You cannot divide by 0, and dividing by 1 never changes a number.",
        ],
      },
    ],
    pitfalls: [
      "$3^4$ is not $3 \\times 4$. And $4^3 = 4 \\times 4 \\times 4 = 64$ is a different number from $3^4 = 81$.",
      "A base other than 0 with the exponent 0 gives 1, not 0. For example, $5^0 = 1$.",
    ],
    parentGuide:
      "Fold a sheet of paper in half again and again, counting the layers: 2, 4, 8, 16. Each fold multiplies the layers by 2, so it adds one more factor of 2.",
  },
  {
    id: "comparing-powers",
    title: "Comparing powers and growth by doubling",
    summary:
      "A power such as $2^5$ means the same number multiplied again and again. The big number 2 is the base, the number that repeats. The small raised 5 is the exponent, which counts the 2s: $2^5 = 2 \\times 2 \\times 2 \\times 2 \\times 2 = 32$. Swapping the base and the exponent usually changes the value: $5^2 = 5 \\times 5 = 25$. Doubling (multiplying by 2) again and again makes a power of 2.",
    templateIds: ["power-compare", "power-order-trap", "power-doubling-story"],
    senses: { ...powerSenses, change: "change" },
    noLink: ["changes", "whole"],
    objectives: [
      "Compare two powers, such as $2^5$ and $5^2$, by finding the value of each.",
      "Find the value of an expression with powers in the right order.",
      "Read repeated doubling and tripling as powers.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare the values, not the order",
        paragraphs: [
          "$2^5$ is five 2s multiplied, which is 32. $5^2$ is two 5s multiplied, which is 25. The same two numbers appear, but the values differ. To compare two powers, find the value of each one, then compare.",
          "Compare $2^n$ (doubling) with $n^2$ ($n$ squared, meaning $n \\times n$) as $n$ grows. They tie at $n = 2$, where both are 4, and at $n = 4$, where $2^4 = 4^2 = 16$. After that, $2^n$ stays ahead for good. Each step doubles $2^n$, while $n^2$ grows by a smaller and smaller factor (the number it is multiplied by).",
        ],
        illustration: "power-race-bars",
      },
      {
        title: "An exponent touches one thing",
        paragraphs: [
          "An exponent applies only to the number or the group in parentheses just before it. In $3 \\times 4^2$, only the 4 is squared: $3 \\times 16 = 48$. Parentheses group numbers so the exponent applies to the whole group: $(3 \\times 4)^2 = 12^2 = 144$.",
          "Work in this order: first inside parentheses, then powers, then multiplication, then addition. So $(2 + 3)^2 = 5^2 = 25$. That is not $2^2 + 3^2 = 4 + 9 = 13$.",
        ],
      },
      {
        title: "Doubling is a power of 2",
        paragraphs: [
          "Each fold of a sheet of paper doubles its layers. One sheet folded 6 times has $2^6 = 2 \\times 2 \\times 2 \\times 2 \\times 2 \\times 2 = 64$ layers: one factor of 2 for each fold.",
          "A count that starts at 1 and triples (is multiplied by 3) each day is $3^n$ on day $n$, counting the start as day 0. To get from day 3 to day 5, multiply $3^3 = 27$ by 3 two more times: 81, then 243.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is greater, $2^6$ or $6^2$?",
      steps: [
        "$2^6$ is six 2s multiplied. Split them into two groups of three 2s: $2^6 = 2^3 \\times 2^3 = 8 \\times 8 = 64$.",
        "$6^2$ is two 6s multiplied: $6^2 = 6 \\times 6 = 36$.",
        "Compare the values: 64 is greater than 36, so $2^6$ is greater.",
      ],
      answer: "$2^6$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Powers are compared by their values. Exchanging the base and the exponent usually changes the value, so $a^b$ and $b^a$ must each be worked out.",
          "Powers are worked out before multiplication and addition. An exponent applies only to the base or the group in parentheses just before it.",
          "A quantity that starts at 1 and is multiplied by $b$ at each step equals $b^n$ after $n$ steps.",
        ],
      },
    ],
    pitfalls: [
      "$a^b$ and $b^a$ are usually different numbers: $2^5 = 32$ but $5^2 = 25$.",
      "In $2 \\times 3^2$, square only the 3: $2 \\times 9 = 18$. In $(2 \\times 3)^2$, square the whole product: $6^2 = 36$.",
    ],
    parentGuide:
      "Race two piles of counters. One pile gains 10 each round. The other starts at 1 and doubles each round. Ask which pile is ahead after each round, and when the doubling pile takes the lead.",
  },
];

export const powerMethods: Record<string, ProblemMethod> = {
  "power-missing-exponent": {
    goal: "A base and the value of a power are given. Find the exponent, the count of repeated factors that makes that value.",
    senses: powerSenses,
    intuition:
      "A power such as $2^5$ multiplies the same number again and again. The big number 2 is the base, the number that repeats. The small raised 5 is the exponent: it counts how many 2s are multiplied. So $2^5 = 2 \\times 2 \\times 2 \\times 2 \\times 2 = 32$. A factor is a number being multiplied. To find a missing exponent, count how many times the base appears as a factor.",
    method: [
      "Divide the value by the base, then divide the result by the base again. Keep going until you reach 1.",
      "Count how many times you divided. That count is the exponent, because dividing once removes one factor of the base.",
      "Check by multiplying that many copies of the base. You should get the value back.",
    ],
    watch:
      "Count the factors, not the multiplication signs: $2 \\times 2 \\times 2$ has three factors, so it is $2^3$.",
  },
  "power-repeated-product": {
    goal: "Match a repeated multiplication to its power, or a power to its repeated multiplication.",
    senses: powerSenses,
    intuition:
      "A factor is a number being multiplied, and the product is the answer when you multiply. When the same factor repeats, we can write it as a power. In $5^4$, the big number 5 is the base, the factor that repeats. The small raised 4 is the exponent, which counts the factors: $5^4 = 5 \\times 5 \\times 5 \\times 5$.",
    method: [
      "Find the repeated factor. It is the base.",
      "Count how many times it is multiplied. That count is the exponent: $5 \\times 5 \\times 5 \\times 5 = 5^4$.",
      "Reject the look-alikes. $5 \\times 4$ multiplies 5 by the count, and $5 + 5 + 5 + 5$ adds four 5s. Only $5^4$ multiplies four 5s together.",
    ],
    watch: "Do not swap them: four factors of 5 is $5^4$, not $4^5$.",
  },
  "power-compare": {
    goal: "Decide which of two powers, or a power and a product, is greater, by finding the value of each.",
    senses: { ...powerSenses, "more than": "more-than" },
    noLink: ["changes", "mean"],
    intuition:
      "A power multiplies the same number again and again. In $2^5$, 2 is the number that repeats, called the base. The small raised 5 is called the exponent, and it counts the 2s: $2^5 = 32$. A factor is a number being multiplied, and a product is the answer when you multiply. To compare, find each value first.",
    method: [
      "Write each power as its repeated factors.",
      "Find each value. Build from small powers you know: $2^6 = 2^3 \\times 2^3 = 8 \\times 8 = 64$.",
      "Compare the two values. If they are equal, neither is greater.",
    ],
    watch:
      "Swapping the base and the exponent usually changes the value: $2^5 = 32$ but $5^2 = 25$.",
  },
  "power-order-trap": {
    goal: "Find the value of a product or sum that contains a power, working in the right order.",
    senses: powerSenses,
    noLink: ["whole"],
    intuition:
      "In $3^2$, 3 is called the base and the small raised 2 is called the exponent. Multiplying 3 by itself like this is called squaring it: $3^2 = 3 \\times 3 = 9$, read “3 squared”. An exponent applies only to the number, or the group in parentheses, just before it.",
    method: [
      "Work inside parentheses first.",
      "Then work out powers. An exponent applies only to the number or group just before it.",
      "Then multiply, and add last.",
    ],
    watch:
      "$2 \\times 3^2 = 2 \\times 9 = 18$, not $6^2$. And $(2 + 3)^2 = 5^2 = 25$, not $4 + 9$.",
  },
  "power-doubling-story": {
    goal: "A quantity doubles or triples at each step. Find its value at a later step.",
    senses: powerSenses,
    intuition:
      "Doubling means multiplying by 2. A count that starts at 1 and doubles 3 times becomes $2 \\times 2 \\times 2 = 8$, written $2^3$. The small raised 3, called the exponent, counts how many times we multiply by 2. Tripling means multiplying by 3 each step.",
    method: [
      "Find the amount at step 0, the start. After $n$ steps, multiply the start by 2 for each step of doubling, or by 3 for each step of tripling: $n$ times in all. If it starts at 1, the result is that number to the power $n$.",
      "Build the power from the last value shown: $2^7 = 2^3 \\times 2^4 = 8 \\times 16 = 128$.",
    ],
    watch:
      "Doubling multiplies by 2 each step; it does not add 2. After 5 folds there are $2^5 = 32$ layers, not 10.",
  },
};

export const powerPrinciples: Record<string, string> = {
  "power-missing-exponent":
    "For a base $b$ greater than 1 and $n$ equal to 1, 2, 3 and so on, $b^n = v$ means that dividing $v$ by $b$ exactly $n$ times reaches 1.",
  "power-repeated-product":
    "Multiplying $n$ equal factors, each equal to $b$, gives the power $b^n$. The base $b$ is the repeated factor, and the exponent $n$ is the count.",
  "power-compare":
    "Powers are compared by their values. Exchanging the base and the exponent usually changes the value.",
  "power-order-trap":
    "Powers are worked out before multiplication and addition. An exponent applies only to the base or the group in parentheses just before it.",
  "power-doubling-story":
    "A quantity that starts at 1 and is multiplied by $b$ at each step equals $b^n$ after $n$ steps.",
};
