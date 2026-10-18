import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const quadraticMethods: Record<string, ProblemMethod> = {
  "quadratic-factored-solutions": {
    goal: "Given a quadratic equation as a product equal to zero, find every real solution.",
    terms: [
      ["factor", "An expression multiplied by another expression."],
      ["root", "A value of x that makes the polynomial equal zero."],
      [
        "repeated root",
        "A root that occurs in more than one factor; it is one distinct solution.",
      ],
    ],
    method: [
      "Set each linear factor equal to zero.",
      "In each equation, subtract the constant and divide by the nonzero coefficient of x.",
      "Include both roots if they differ; list a repeated root once. Check each root in the original product.",
    ],
    watch:
      "Dividing by a factor containing x can discard a root. Set the factors equal to zero instead.",
  },
  "quadratic-expanded-solutions": {
    goal: "Given an expanded quadratic equation with rational roots, factor it and find every real solution.",
    terms: [
      ["quadratic", "A polynomial whose highest power of x is x²."],
      ["coefficient", "The number multiplying a power of x."],
      ["root", "A value of x that makes the polynomial equal zero."],
    ],
    method: [
      "Write ax² + bx + c = 0 with a ≠ 0. If c = 0, factor out x. Otherwise, divide out any common numerical factor.",
      "Otherwise, divide out any common numerical factor, then find integers m and n with m + n = b and mn = ac. Replace bx by mx + nx and factor by grouping.",
      "Check the factors by multiplication. Set each factor equal to zero and solve both equations.",
      "List each distinct root once and check it in the original equation.",
    ],
    watch:
      "A product can be zero when either factor is zero. Include every distinct root.",
  },
  "quadratic-real-solution-count": {
    goal: "Given a quadratic equation, determine how many distinct real solutions it has.",
    terms: [
      [
        "discriminant",
        "The quantity b² − 4ac for ax² + bx + c = 0, where a ≠ 0.",
      ],
      [
        "distinct",
        "Different from one another; a repeated solution is counted once.",
      ],
      [
        "real solution",
        "A number on the real number line that makes the equation true.",
      ],
    ],
    method: [
      "Read a, b, and c with their signs; a missing x term or constant has coefficient zero.",
      "Calculate b² − 4ac, using parentheses when squaring a negative b.",
      "A positive discriminant gives two distinct real solutions, zero gives one, and a negative value gives none.",
    ],
    watch:
      "A negative discriminant means no real solutions. Complex solutions are outside this question.",
  },
};
export const quadraticPrinciples: Record<string, string> = {
  "quadratic-factored-solutions":
    "Zero-product property: a product of real numbers is zero if and only if at least one factor is zero.",
  "quadratic-expanded-solutions":
    "Factoring uses the distributive property in reverse: the factored form equals the original polynomial. The zero-product property then gives its roots.",
  "quadratic-real-solution-count":
    "In the quadratic formula x = (−b ± √(b² − 4ac))/(2a), the discriminant controls whether the square-root branches are real and distinct.",
};

export const quadraticLessons: Lesson[] = [
  {
    id: "quadratic-factored-solutions",
    title: "Solve a factored quadratic",
    summary:
      "Use the zero-product property to find the complete real solution set.",
    templateIds: ["quadratic-factored-solutions"],
    objectives: [
      "Solve each linear factor equation.",
      "Retain zero and fractional roots; count a repeated root once.",
    ],
    sections: [
      {
        title: "Why either factor can be zero",
        paragraphs: [
          "A factor is an expression in a product. A root is a value that makes a polynomial zero. If AB = 0, then A = 0 or B = 0: when A is nonzero, division by A gives B = 0.",
          "For (2x − 3)(x + 4) = 0, solve 2x − 3 = 0 and x + 4 = 0 separately. The roots are 3/2 and −4. Either root makes the product zero.",
        ],
      },
      {
        title: "Keep every distinct root",
        paragraphs: [
          "For x(x − 5) = 0, zero is a root. Dividing by x would lose it. For (x − 2)² = 0, both factors give 2: one distinct solution, called a repeated root.",
          "The product must equal zero. For (x − 2)(x + 3) = 4, neither x = 2 nor x = −3 is a solution: both give zero instead of four.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve (3x + 2)(x − 5) = 0.",
      steps: [
        "Set either factor equal to zero: 3x + 2 = 0 or x − 5 = 0.",
        "Subtract 2 and divide by 3 in the first equation: x = −2/3. The second gives x = 5.",
        "At −2/3 the first factor is zero; at 5 the second factor is zero. Each value makes the original product zero.",
      ],
      answer: "x = −2/3 or x = 5",
    },
    pitfalls: [
      "The zero-product property requires the product to equal zero.",
      "The factors do not have to be zero at the same value of x.",
    ],
    parentGuide:
      "Ask the learner to explain why both roots belong and why dividing by x loses a root in x(x − 5) = 0.",
  },
  {
    id: "quadratic-expanded-solutions",
    title: "Factor to solve a quadratic",
    summary:
      "Rewrite an expanded quadratic as a product, then solve its factor equations.",
    templateIds: ["quadratic-expanded-solutions"],
    objectives: [
      "Factor quadratics with integer coefficients and rational roots.",
      "Check the factorization and the complete solution set.",
    ],
    sections: [
      {
        title: "Find and check the factors",
        paragraphs: [
          "A quadratic polynomial has highest power x². In ax² + bx + c, the numbers a, b, and c are coefficients, with a ≠ 0. The term bx is the linear term; c is the constant term. Factoring rewrites the polynomial as a product without changing its value.",
          "If c = 0, factor out x: ax² + bx = x(ax + b). Otherwise, divide out any common numerical factor, then find integers m and n whose sum is b and whose product is ac. Replace bx by mx + nx, then factor the two pairs of terms by grouping.",
        ],
      },
      {
        title: "Recover all solutions",
        paragraphs: [
          "Multiplying the factors must recover the original coefficients. Once their product equals zero, set each factor equal to zero. List each distinct root once and substitute it into the original equation to check.",
          "These exercises have rational roots. A quadratic that does not factor over the rational numbers may need completing the square or the quadratic formula.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve 6x² + x − 2 = 0.",
      steps: [
        "Here ac = 6 × (−2) = −12. The numbers 4 and −3 have product −12 and sum 1.",
        "Split the middle term: 6x² + 4x − 3x − 2 = 2x(3x + 2) − (3x + 2).",
        "Factor the shared expression: (2x − 1)(3x + 2) = 0.",
        "Set each factor to zero: x = 1/2 or x = −2/3. Substitution gives 3/2 + 1/2 − 2 = 0 and 8/3 − 2/3 − 2 = 0.",
      ],
      answer: "x = −2/3 or x = 1/2",
    },
    pitfalls: [
      "When a is not 1, the numbers used to split bx must multiply to ac, not merely to c.",
      "Keep a zero root when factoring out x.",
    ],
    parentGuide:
      "Ask the learner to multiply the factors before solving. Include an example with no constant term and one with a repeated root.",
  },
  {
    id: "quadratic-real-solution-count",
    title: "Count distinct real solutions",
    summary:
      "The sign of the discriminant determines the number of real quadratic solutions.",
    templateIds: ["quadratic-real-solution-count"],
    objectives: [
      "Identify signed coefficients, including missing zero terms.",
      "Distinguish zero, one, and two distinct real solutions.",
    ],
    sections: [
      {
        title: "Read the square root in the formula",
        paragraphs: [
          "For ax² + bx + c = 0 with a ≠ 0, the quadratic formula is x = (−b ± √(b² − 4ac))/(2a). The discriminant is the quantity b² − 4ac under the square root.",
          "If the discriminant is positive, adding and subtracting its positive square root give two distinct real values. If it is zero, the two branches agree: one repeated root. If it is negative, its square root is not real: no real solutions.",
        ],
      },
      {
        title: "Count roots and keep coefficient signs",
        paragraphs: [
          "Distinct means different. You do not count the same root twice. A missing x term means b = 0; a missing constant means c = 0. Keep negative coefficients in parentheses when substituting.",
          "For x² − 4 = 0, the discriminant is 16, giving two roots: −2 and 2. For x² = 0, it is zero, giving the single root 0. For x² + 4 = 0, it is −16, giving no real roots.",
        ],
      },
    ],
    workedExample: {
      prompt: "How many distinct real solutions does 2x² − 4x + 5 = 0 have?",
      steps: [
        "The coefficients are a = 2, b = −4, and c = 5.",
        "The discriminant is (−4)² − 4 × 2 × 5 = 16 − 40 = −24.",
        "The discriminant is negative, so the equation has no real solutions.",
      ],
      answer: "0",
    },
    pitfalls: [
      "Square the signed coefficient: (−4)² = 16.",
      "Zero discriminant means one distinct real solution, not zero solutions.",
    ],
    parentGuide:
      "Compare x² − 4 = 0, x² = 0, and x² + 4 = 0. Ask why the counts are two, one, and zero without using decimal approximations.",
  },
];
