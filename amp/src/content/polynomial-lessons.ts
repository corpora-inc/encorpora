import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: ProblemMethod["terms"] = [
  [
    "polynomial",
    "A sum of terms consisting of a number times a nonnegative integer power of a variable; constants are included.",
  ],
  ["coefficient", "The number multiplying a power of the variable."],
  ["like terms", "Terms with the same variable raised to the same power."],
];
export const polynomialMethods: Record<string, ProblemMethod> = {
  "polynomial-addition": {
    goal: "Simplify a sum of polynomials by combining like terms.",
    terms,
    method: [
      "Match terms with the same power of x. A missing term has coefficient zero.",
      "Add the coefficients of each group of like terms; leave the power of x unchanged.",
      "Write terms in descending powers of x and omit zero terms. If every term cancels, write 0.",
    ],
    watch: "Adding x² terms does not produce x⁴: 2x² + 3x² = 5x².",
  },
  "polynomial-subtraction": {
    goal: "Simplify a difference of polynomials by distributing the minus sign.",
    terms,
    method: [
      "Replace subtraction of the second polynomial by addition of its opposite.",
      "Change the sign of every term in the second polynomial, including its constant.",
      "Combine terms with the same power of x by adding their signed coefficients.",
      "Write terms in descending powers of x; omit zero terms or write 0 if all terms cancel.",
    ],
    watch:
      "The minus sign before parentheses affects every term inside: −(x² − 3x + 2) = −x² + 3x − 2.",
  },
  "polynomial-multiplication": {
    goal: "Expand a product of polynomials and combine like terms.",
    terms: [
      ...terms,
      ["distribute", "Multiply a term by every term of a sum."],
    ],
    method: [
      "Multiply each term of the first factor by every term of the second factor.",
      "For each term product, multiply the coefficients and add exponents on powers of x: x^m × x^n = x^(m+n).",
      "Add the partial products. Combine only terms with the same power of x.",
      "Write the result in descending powers of x, omitting zero terms.",
    ],
    watch:
      "A square includes cross products: (x + 3)² = x² + 6x + 9, not x² + 9.",
  },
};
export const polynomialPrinciples: Record<string, string> = {
  "polynomial-addition":
    "The distributive property gives axⁿ + bxⁿ = (a + b)xⁿ. Only like terms share the same power of x.",
  "polynomial-subtraction":
    "Subtracting a sum means adding its opposite: P − (A + B) = P + (−A) + (−B). Then combine like terms.",
  "polynomial-multiplication":
    "The distributive property multiplies every term of one factor by every term of the other. Products of powers satisfy x^m × x^n = x^(m+n) for nonnegative integer exponents.",
};

export const polynomialLessons: Lesson[] = [
  {
    id: "polynomial-addition",
    title: "Add polynomials",
    summary:
      "Combine coefficients of like terms without changing their powers.",
    templateIds: ["polynomial-addition"],
    objectives: [
      "Identify like terms, including missing powers and constants.",
      "Add signed coefficients and simplify cancellation.",
    ],
    sections: [
      {
        title: "Which terms combine",
        paragraphs: [
          "A polynomial is a sum of terms such as 3x², −2x, and 5. A coefficient is the number multiplying a power of x. In −x² the coefficient is −1. A constant has no variable factor.",
          "Like terms have the same power of x. The distributive property explains their sum: 3x² + 4x² = (3 + 4)x² = 7x². Terms 3x² and 4x are unlike and cannot be combined into one term.",
        ],
      },
      {
        title: "Missing terms and cancellation",
        paragraphs: [
          "Line up terms by power, not by their position in an expression. In x³ + 2x, the coefficients of x² and the constant are both zero. A missing power contributes nothing to its group.",
          "Opposite coefficients cancel: 5x + (−5x) = 0. Write the remaining terms in descending powers. For example, (x² + 3) + (−x² + 2x − 3) = 2x. If all terms cancel, the polynomial is 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "Simplify (3x³ − 2x + 5) + (−x³ + 4x² + 2x − 8).",
      steps: [
        "Group by power: (3 − 1)x³ + (0 + 4)x² + (−2 + 2)x + (5 − 8).",
        "Add the coefficients: 2x³ + 4x² + 0x − 3.",
        "Omit the zero x term and keep descending powers: 2x³ + 4x² − 3.",
      ],
      answer: "2x³ + 4x² − 3",
    },
    pitfalls: [
      "Do not add exponents when adding terms; the common variable factor stays the same.",
      "A missing power has coefficient zero. Do not combine terms merely because they occupy the same position.",
    ],
    parentGuide:
      "Ask the learner to name the power for each group and explain why the power stays unchanged. Include an example where opposite coefficients cancel.",
  },
  {
    id: "polynomial-subtraction",
    title: "Subtract polynomials",
    summary:
      "Negate every term of the second polynomial, then combine like terms.",
    templateIds: ["polynomial-subtraction"],
    objectives: [
      "Distribute a minus sign to every term of a polynomial.",
      "Combine signed coefficients and recognize zero or constant differences.",
    ],
    sections: [
      {
        title: "Subtract the whole expression",
        paragraphs: [
          "A polynomial is a sum of terms with nonnegative integer powers of a variable. Subtracting a polynomial means adding its opposite. Multiplication by −1 changes the sign of every term, including the constant.",
          "For example, −(2x² − 3x + 4) = −2x² + 3x − 4. The −3x becomes +3x because (−1)(−3) = 3. The parentheses determine which terms the minus sign affects.",
        ],
      },
      {
        title: "Combine after changing signs",
        paragraphs: [
          "Like terms have the same power of the variable; their coefficients are the signed numbers multiplying that power. After distributing −1, add the coefficients in each group. A missing power has coefficient zero.",
          "The degree is the highest power with a nonzero coefficient. A difference can have lower degree than either original polynomial: (x² + 5) − (x² + 2) = 3. A polynomial minus itself is 0. Cancellation removes terms; it does not introduce a new power.",
        ],
      },
    ],
    workedExample: {
      prompt: "Simplify (4x² − x + 3) − (−2x² + 5x − 7).",
      steps: [
        "Distribute −1: −(−2x² + 5x − 7) = 2x² − 5x + 7.",
        "Rewrite as a sum: (4x² − x + 3) + (2x² − 5x + 7).",
        "Combine like terms: (4 + 2)x² + (−1 − 5)x + (3 + 7) = 6x² − 6x + 10.",
      ],
      answer: "6x² − 6x + 10",
    },
    pitfalls: [
      "Changing only the first sign inside parentheses gives the wrong difference.",
      "Subtracting a negative coefficient adds its positive opposite: 3 − (−4) = 7.",
    ],
    parentGuide:
      "Have the learner rewrite the subtraction as addition before combining terms. Ask which signs change and why; each term in the second polynomial is multiplied by −1.",
  },
  {
    id: "polynomial-multiplication",
    title: "Multiply polynomials",
    summary: "Distribute each term, multiply powers, and combine like terms.",
    templateIds: ["polynomial-multiplication"],
    objectives: [
      "Include every pair of terms when distributing a product.",
      "Distinguish adding exponents in a product from adding coefficients in a sum.",
    ],
    sections: [
      {
        title: "Every term multiplies every term",
        paragraphs: [
          "A polynomial is a sum of terms with nonnegative integer powers of a variable. A coefficient is the number multiplying a power. To distribute a product, multiply each term of one factor by every term of the other: (A + B)C = AC + BC.",
          "For term products, multiply coefficients and add exponents on the same variable: (2x)(3x²) = 6x³, because x × x² = x³. Include signs: (−2x)(−3) = 6x. A constant multiplies every term too.",
        ],
      },
      {
        title: "Add the partial products",
        paragraphs: [
          "A partial product comes from distributing one term of the first factor. After finding all partial products, combine like terms, which have the same power of x. Addition changes their coefficients, not their exponents.",
          "Special products follow the same rule: (x + 3)² = x² + 3x + 3x + 9 = x² + 6x + 9. For (x + 3)(x − 3), the cross terms cancel: x² − 3x + 3x − 9 = x² − 9.",
        ],
      },
    ],
    workedExample: {
      prompt: "Expand and simplify (2x − 3)(x² + 4x − 1).",
      steps: [
        "Distribute 2x: (2x)(x² + 4x − 1) = 2x³ + 8x² − 2x.",
        "Distribute −3: (−3)(x² + 4x − 1) = −3x² − 12x + 3.",
        "Add the partial products and group like terms: 2x³ + (8 − 3)x² + (−2 − 12)x + 3.",
        "Combine coefficients: 2x³ + 5x² − 14x + 3.",
      ],
      answer: "2x³ + 5x² − 14x + 3",
    },
    pitfalls: [
      "Multiplying only the first and last terms omits cross products.",
      "Multiply x × x² to get x³, but add 2x² + 3x² to get 5x². The operations use different rules.",
    ],
    parentGuide:
      "Ask the learner to point to every pair of terms that was multiplied. For a two-term factor times a three-term factor, there are six term products before combining like terms.",
  },
];
