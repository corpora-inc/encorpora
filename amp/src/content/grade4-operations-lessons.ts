import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

const entries: FormatLessonEntry[] = [
  {
    id: "multiply-two-digit",
    title: "Multiply larger whole numbers",
    summary:
      "Multiply two whole numbers with no area model, including a three-digit factor and squares from 11 to 15.",
    objectives: [
      "Multiply two two-digit whole numbers with no model shown.",
      "Multiply a three-digit number by a two-digit number, and find 11 squared through 15 squared.",
    ],
    intuition:
      "Multiplying counts equal groups. 24 × 36 means 24 groups of 36. You do not need a picture of the groups. A square such as 12 × 12 means 12 groups of 12.",
    terms: ["product-multiply"],
    senses: { product: "product-multiply" },
    method: [
      "Read the two factors, the numbers being multiplied.",
      "Multiply them. A three-digit factor is multiplied the same way as a two-digit factor.",
      "For a square, the two factors are the same number.",
    ],
    watch: "Do not add the factors. 24 × 36 is not 24 + 36.",
    principle:
      "The product $a \\times b$ is $a$ groups of $b$. Order does not change it: $a \\times b = b \\times a$. A square $n \\times n$ is $n$ groups of $n$.",
    example: {
      prompt: "What is 12 × 13?",
      steps: [
        "12 × 13 means 12 groups of 13.",
        "10 groups of 13 are 130, and 2 groups of 13 are 26.",
        "130 + 26 = 156.",
      ],
      answer: "156",
    },
    methodTitle: "Multiply the two factors",
    methodText: [
      "Break one factor into tens and ones when that makes the multiplication easier.",
      "Add the partial products. Do not add the original factors.",
    ],
    formal:
      "For whole numbers $a$ and $b$, $a \\times b$ is the product. In particular, $n^2 = n \\times n$.",
    pitfalls: [
      "Adding the factors is not multiplying them.",
      "A square uses the same factor twice: 12 squared is 12 × 12, not 12 × 2.",
    ],
    parentGuide:
      "Ask the learner to find 12 × 13 by splitting 12 into 10 and 2, then to check 13 × 12.",
  },
  {
    id: "quotient-remainder-one-digit",
    title: "Quotient and remainder",
    summary:
      "The quotient is how many times the divisor fits. The remainder is what is left, and it is a fraction of the divisor.",
    objectives: [
      "Give the quotient and the remainder for a one-digit divisor.",
      "Write the remainder as a fraction of the divisor.",
    ],
    intuition:
      "Division shares a number into equal groups. 20 ÷ 6 is 3 groups of 6, which is 18, with 2 left over. The 2 is the remainder. It is smaller than 6. As a fraction of the divisor it is 2/6.",
    terms: ["quotient", "remainder", "divisor"],
    senses: { quotient: "quotient", remainder: "remainder" },
    method: [
      "Find the largest whole number of times the divisor fits in the dividend. That is the quotient.",
      "Subtract. What is left is the remainder. It must be smaller than the divisor.",
      "The fraction of the divisor is the remainder over the divisor.",
    ],
    watch:
      "Do not report a remainder that is bigger than or equal to the divisor. Trade it for one more group.",
    principle:
      "If $n = q \\times d + r$ and $0 \\le r < d$, then the quotient is $q$ and the remainder is $r$. The same division is $q + r/d$.",
    example: {
      prompt: "Divide 20 by 6. Give the quotient and the remainder.",
      steps: [
        "6 × 3 = 18, and 20 − 18 = 2.",
        "2 is smaller than 6, so the remainder is 2.",
        "As a fraction of the divisor, the remainder is 2/6.",
      ],
      answer: "Quotient 3, remainder 2, which is 2/6 of the divisor.",
    },
    methodTitle: "How many groups, and what is left",
    methodText: [
      "Multiply the divisor by the quotient and add the remainder. You must get the dividend back.",
      "The fraction uses the remainder as the numerator and the divisor as the denominator.",
    ],
    formal:
      "$n \\div d = q$ remainder $r$ means $n = q d + r$ with $0 \\le r < d$. The same value is $q + r/d$.",
    pitfalls: [
      "The remainder is not the divisor.",
      "A remainder equal to the divisor means the quotient is one too small.",
    ],
    parentGuide:
      "Share 20 counters into groups of 6. Count the full groups and the counters left. Then write the leftover as a fraction of 6.",
  },
  {
    id: "factor-pairs-select",
    title: "Every factor",
    summary:
      "Select every factor. Factors come in pairs that multiply to the number. A prime has only 1 and itself. A square uses one factor twice.",
    objectives: [
      "Select every factor of a whole number through 100, including primes and squares.",
      "Do the same for a number through 144.",
    ],
    intuition:
      "The factors of 12 are 1, 2, 3, 4, 6 and 12. They pair as 1 × 12, 2 × 6 and 3 × 4. 7 is prime: the only factors are 1 and 7. 9 is a square: 3 × 3 is a factor pair.",
    terms: ["factor-number", "prime-number"],
    senses: { factor: "factor-number" },
    method: [
      "Try the counting numbers from 1 up to the number.",
      "Keep a number when the division leaves no remainder.",
      "A prime keeps only 1 and itself. A square keeps the factor that multiplies by itself to make the number.",
    ],
    watch:
      "A number is always a factor of itself, and 1 is always a factor. Do not stop at the pairs you notice first.",
    principle:
      "The factors of $n$ are the whole numbers $d$ from 1 to $n$ for which $n \\div d$ is a whole number. Each such $d$ pairs with $n \\div d$.",
    example: {
      prompt: "Select every factor of 9.",
      steps: [
        "1 divides 9, because 9 ÷ 1 = 9.",
        "2 does not. 3 does, because 9 ÷ 3 = 3. 9 is 3 × 3, a square.",
        "9 divides 9. The factors are 1, 3 and 9.",
      ],
      answer: "1, 3 and 9",
    },
    methodTitle: "Test each counting number",
    methodText: [
      "You can stop testing once a factor times itself is bigger than the number, then include the partners of the factors you found.",
      "Check a prime by seeing that no counting number from 2 up to one less than the number divides it.",
    ],
    formal:
      "If $d$ divides $n$, then so does $n/d$. The pair is $(d, n/d)$. When $d = n/d$, $n$ is a square.",
    pitfalls: [
      "Leaving out 1 or the number itself misses a factor pair.",
      "A square's repeated factor is still a factor. 3 is a factor of 9.",
    ],
    parentGuide:
      "Ask which of 1, 2, 3, 4 and 9 divide 9 exactly, and which factor is used twice.",
  },
  {
    id: "multiples-select",
    title: "Multiples of a one-digit number",
    summary:
      "A multiple of a number is that number times a whole number. A number one more or one less than a multiple is not a multiple.",
    objectives: [
      "Select the multiples of a one-digit number.",
      "Reject numbers that are one away from a multiple.",
    ],
    intuition:
      "The multiples of 4 are 0, 4, 8, 12, 16 and so on. 12 is a multiple because 4 × 3 = 12. 13 is one more than 12, so 4 does not divide 13.",
    terms: ["multiple"],
    senses: { multiple: "multiple" },
    method: [
      "Divide each choice by the one-digit number.",
      "Keep the choice when the remainder is 0.",
      "A choice that is one more or one less than a multiple has a remainder.",
    ],
    watch: "Being close to a multiple is not the same as being a multiple.",
    principle:
      "The multiples of a whole number $d > 0$ are $0, d, 2d, 3d,$ and so on. $d k + 1$ and $d k - 1$ are not multiples of $d$ when $d > 1$.",
    example: {
      prompt: "Which of 8, 9 and 12 are multiples of 4?",
      steps: [
        "8 ÷ 4 = 2 with nothing left, so 8 is a multiple.",
        "9 ÷ 4 is 2 with 1 left, so 9 is not.",
        "12 ÷ 4 = 3, so 12 is a multiple.",
      ],
      answer: "8 and 12",
    },
    methodTitle: "Divide and look at the remainder",
    methodText: [
      "A remainder of 0 means the number is a multiple.",
      "Adding or subtracting 1 from a multiple always leaves a remainder when the divisor is greater than 1.",
    ],
    formal:
      "$n$ is a multiple of $d$ exactly when $n = d k$ for some whole number $k$.",
    pitfalls: [
      "Do not keep a number just because it is next to a multiple.",
      "The one-digit number itself is a multiple of itself: 4 = 4 × 1.",
    ],
    parentGuide:
      "List the multiples of 4 up to 20, then ask whether 15 belongs on the list.",
  },
  {
    id: "facts-to-twelve",
    title: "Multiply and divide through 12",
    summary:
      "These facts use 11 or 12 as a factor or as a divisor. Multiplication counts equal groups. Division undoes that multiplication.",
    objectives: [
      "Multiply when one factor is 11 or 12.",
      "Divide when the divisor is 11 or 12.",
    ],
    intuition:
      "11 × 3 means 11 groups of 3, which is 33. 36 ÷ 12 asks how many groups of 12 make 36. The fact 12 × 3 = 36 answers it: the quotient is 3.",
    terms: ["product-multiply", "quotient"],
    senses: { product: "product-multiply", quotient: "quotient" },
    method: [
      "If the question is a multiplication, find the product of the two factors.",
      "If the question is a division, find the factor that multiplies the divisor to make the dividend.",
      "One of the numbers is 11 or 12 in every question.",
    ],
    watch: "Do not add. 11 × 3 is 33, not 14.",
    principle:
      "$a \\times b$ is the product. If $a \\times b = n$ and $a \\ne 0$, then $n \\div a = b$.",
    example: {
      prompt: "What is 12 × 4? What is 48 ÷ 12?",
      steps: [
        "12 × 4 is 12 groups of 4. 10 groups are 40, and 2 groups are 8, so 48.",
        "48 ÷ 12 asks what factor times 12 is 48. That factor is 4.",
      ],
      answer: "48, and 4",
    },
    methodTitle: "Use the related fact",
    methodText: [
      "A division by 11 or 12 is the multiplication fact read backwards.",
      "Check a product by dividing it by one factor. You should get the other factor.",
    ],
    formal:
      "For whole numbers through 12, $11 \\times b$ and $12 \\times b$ are the products, and dividing by 11 or 12 recovers the other factor.",
    pitfalls: [
      "11 × 12 is 132, not 11 + 12.",
      "The quotient is the missing factor, not the dividend.",
    ],
    parentGuide:
      "Practice 11 × 5 and then 55 ÷ 11, and ask how the two facts match.",
  },
  {
    id: "growing-shape-pattern",
    title: "A pattern that grows by a rule",
    summary:
      "A pattern adds the same number of tiles each step. Steps 1 to 3 are shown. Find a later step from the rule, not by counting it.",
    objectives: [
      "Read an add rule for a tile pattern.",
      "Find the number of tiles in a step that is not drawn.",
    ],
    intuition:
      "Start with 3 tiles. Add 2 tiles at each step. Step 1 has 3, step 2 has 5 and step 3 has 7. Step 5 is not drawn. It is the start plus 4 adds of 2.",
    terms: ["rule"],
    noLink: ["step", "steps"],
    method: [
      "Read the starting number of tiles and how many tiles are added each step.",
      "Check that the table matches the rule for steps 1, 2 and 3.",
      "For a later step, add the same amount once for each step after the first.",
    ],
    watch: "Do not try to count a step that is not in the table. Use the rule.",
    principle:
      "If step 1 has $a$ tiles and each next step adds $d$ tiles, step $n$ has $a + (n - 1) d$ tiles.",
    example: {
      prompt:
        "Start with 3 tiles and add 2 each step. How many tiles are in step 5?",
      steps: [
        "Step 1 has 3. Steps 2, 3, 4 and 5 each add 2.",
        "That is 4 adds: 4 × 2 = 8.",
        "3 + 8 = 11.",
      ],
      answer: "11 tiles",
    },
    methodTitle: "Start, then add once per later step",
    methodText: [
      "The table is a check. Step 2 should be the start plus one add, and step 3 the start plus two adds.",
      "Step $n$ is the start plus $(n - 1)$ adds.",
    ],
    formal:
      "An add rule $a, a + d, a + 2d, \\ldots$ has $n$th term $a + (n - 1) d$.",
    pitfalls: [
      "Adding the rule's numbers once, such as 3 + 2, is only step 2.",
      "The drawn steps stop at step 3. A later step is not a count of those tiles.",
    ],
    parentGuide:
      "Build steps 1, 2 and 3 with tiles, then ask for step 5 without building it.",
  },
];

const formatted = formatLessons(entries);

export const grade4OperationsLessons = formatted.lessons;
export const grade4OperationsMethods = formatted.methods;
export const grade4OperationsPrinciples = formatted.principles;

const partial = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({ templateId, facetId, extent: "partial", rationale });

export const grade4OperationsFacetMappings: readonly FacetMapping[] = [
  partial(
    "multiply-two-digit",
    "whole-multiplication.core",
    "Multiply two two-digit numbers, a three-digit number by a two-digit number, or a square from 11 squared to 15 squared, with no area model. Does not assess a written algorithm or an area model.",
  ),
  partial(
    "quotient-remainder-one-digit",
    "whole-division.core",
    "Give the quotient and the remainder for a dividend from 100 to 9,999 and a one-digit divisor, or write the remainder as a fraction of the divisor. Does not assess two-digit divisors.",
  ),
  partial(
    "factor-pairs-select",
    "factors-multiples.core",
    "Select every factor of a number through 100, including primes and squares, and sometimes through 144. Does not assess listing the pairs in a required order.",
  ),
  partial(
    "multiples-select",
    "factors-multiples.core",
    "Select the multiples of a one-digit number. Distractors are one more or one less than a multiple. Does not assess common multiples of two numbers.",
  ),
  partial(
    "facts-to-twelve",
    "whole-multiplication.core",
    "Multiply or divide when one factor or the divisor is 11 or 12, through 12 × 12. Does not assess facts that use only factors through 10.",
  ),
  partial(
    "growing-shape-pattern",
    "rule-patterns.core",
    "Find a later step of a tile pattern whose add rule is stated in words. Steps 1 to 3 are shown and the asked step is at least 5. Does not assess a multiply rule or drawing the step.",
  ),
];
