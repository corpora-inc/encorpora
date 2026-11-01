import {
  quadraticIrrationalLesson,
  quadraticIrrationalMethod,
} from "./quadratic-irrational-content";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const quadraticMethods: Record<string, ProblemMethod> = {
  "quadratic-irrational-solutions": quadraticIrrationalMethod,
  "quadratic-factored-solutions": {
    goal: "The equation is a product of factors (parts being multiplied) set equal to zero. Find every value of $x$ that makes it true.",
    terms: [
      ["factor", "An expression multiplied by another expression."],
      ["root", "A value of $x$ that makes the polynomial equal zero."],
      [
        "repeated root",
        "A root that occurs in more than one factor; it is one distinct solution.",
      ],
    ],
    method: [
      "A product (the result of multiplying) is 0 only when one of its factors is 0. So set each factor equal to 0, which gives two small equations.",
      "Solve each one. Undo the added or subtracted number on both sides first. Then divide both sides by the number multiplying $x$, which leaves $x$ alone. That number is never 0 here.",
      "If the two answers are different, keep both. If they are the same, it is a repeated root, so list it once.",
      "Check each answer: put it into the original product and confirm that one factor becomes 0.",
    ],
    watch:
      "Never divide both sides by a factor that contains $x$. It could be 0, and you would lose a solution. Set each factor equal to 0 instead.",
  },
  "quadratic-expanded-solutions": {
    goal: "Given an expanded quadratic equation with rational roots, factor it and find every real solution.",
    terms: [
      ["quadratic", "A polynomial whose highest power of $x$ is x²."],
      ["coefficient", "The number multiplying a power of $x$."],
      ["root", "A value of $x$ that makes the polynomial equal zero."],
    ],
    method: [
      "Write ax² + bx + c = 0 with a ≠ 0. If c = 0, factor out $x$.",
      "Otherwise, divide out any common numerical factor, then find integers $m$ and $n$ with m + n = b and mn = ac. Replace bx by mx + nx and factor by grouping.",
      "Check the factors by multiplication. Set each factor equal to zero and solve both equations.",
      "List each distinct root once and check it in the original equation.",
    ],
    watch:
      "A product can be zero when either factor is zero. Include every distinct root.",
  },
  "quadratic-real-solution-count": {
    goal: "Given a quadratic equation, determine how many distinct real solutions it has.",
    intuition:
      "A quadratic has the form $ax^2+bx+c=0$ with $a\\ne0$; $a$, $b$, and $c$ are its signed number coefficients. Its discriminant is $D=b^2-4ac$. The sign of $D$ tells how many different real-number solutions the equation has: two if positive, one if zero, none if negative.",
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
      "Read $a$, $b$, and $c$ with their signs; a missing $x$ term or constant has coefficient zero.",
      "Calculate b² − 4ac, using parentheses when squaring a negative $b$.",
      "A positive discriminant gives two distinct real solutions, zero gives one, and a negative value gives none.",
    ],
    watch:
      "A negative discriminant means no real solutions. Complex solutions are outside this question.",
  },
};
export const quadraticPrinciples: Record<string, string> = {
  "quadratic-irrational-solutions":
    "Completing the square gives $(2ax + b)^2 = b^2 - 4ac$; both square-root branches yield $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ when $a \\ne 0$ and the discriminant is nonnegative.",
  "quadratic-factored-solutions":
    "Zero-product property: if two real numbers multiply to 0, at least one of them is 0. With letters, writing $AB$ means $A$ times $B$, and $AB = 0$ exactly when $A = 0$ or $B = 0$.",
  "quadratic-expanded-solutions":
    "Factoring uses the distributive property in reverse: the factored form equals the original polynomial. The zero-product property then gives its roots.",
  "quadratic-real-solution-count":
    "In the quadratic formula x = (−b ± √(b² − 4ac))/(2a), the discriminant controls whether the square-root branches are real and distinct.",
};

export const quadraticLessons: Lesson[] = [
  quadraticIrrationalLesson,
  {
    id: "quadratic-factored-solutions",
    title: "Solve a factored quadratic",
    summary:
      "If two numbers multiply to make zero, at least one of them is zero. Two brackets written side by side are multiplied. In $(x - 2)(x + 3) = 0$, the factors (the parts being multiplied) are $x - 2$ and $x + 3$. So either $x - 2 = 0$, which gives $x = 2$, or $x + 3 = 0$, which gives $x = -3$. A value that makes the equation true is called a solution. This method finds every solution.",
    templateIds: ["quadratic-factored-solutions"],
    objectives: [
      "Set each factor (each part being multiplied) equal to zero, and solve each small equation.",
      "Keep every solution, including 0 and fractions, and list a solution that two factors share only once.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Why one factor must be zero",
        paragraphs: [
          "Try to multiply two numbers and get 0. $5 \\times 0 = 0$ works, and so does $0 \\times (-3) = 0$. But $5 \\times 2$ and $(-4) \\times 3$ do not, because neither number in them is 0. The result of a multiplication is called a product. Whenever a product is 0, at least one of the numbers being multiplied is 0.",
          "Here is why. Suppose $A \\times B = 0$, and $A$ is not 0. Dividing both sides by a number that is not 0 keeps them equal, so divide both sides by $A$. The left side becomes $B$, and $0 \\div A$ is 0, so $B = 0$. Either $A$ is 0, or $B$ must be.",
          "The parts being multiplied are called factors. In $(2x - 3)(x + 4) = 0$, the letter $x$ stands for an unknown number, and $2x$ means 2 times $x$. Two brackets written side by side are multiplied. So the factors are $2x - 3$ and $x + 4$. A solution is a value of $x$ that makes the equation true. A solution of an equation like this is also called a root.",
          "The product is 0 only when one factor is 0. So split the problem into two small equations. From $2x - 3 = 0$, add 3 to both sides to undo the subtraction: $2x = 3$. Then divide both sides by 2 to undo the multiplication: $x = \\tfrac{3}{2}$. From $x + 4 = 0$, subtract 4 from both sides to undo the addition: $x = -4$. Check $x = -4$: the second factor is $-4 + 4 = 0$, and any number times 0 is 0.",
          "Multiplying out the brackets turns $(2x - 3)(x + 4)$ into $2x^2 + 5x - 12$. That has an $x^2$ part ($x$ squared, meaning $x$ times $x$) and nothing like $x^3$. An equation whose highest power is $x^2$ is called a quadratic. Writing it as factors multiplied together is called factored form. Factored form is the easiest form to solve, because each factor gives a solution directly.",
        ],
      },
      {
        title: "Keep every solution",
        paragraphs: [
          "Each factor gives its own solution, and the factors do not have to be zero at the same time. At $x = \\tfrac{3}{2}$, only the first factor of $(2x - 3)(x + 4)$ is 0. At $x = -4$, only the second one is. One zero factor is enough to make the whole product 0.",
          "Zero can be a solution. In $x(x - 5) = 0$, the factors are $x$ and $x - 5$. The first factor is 0 when $x = 0$, so 0 is a solution. The second gives $x = 5$. Do not divide both sides by $x$. That step only works if $x$ is not 0, so it throws the solution $x = 0$ away.",
          "Sometimes both factors give the same number. In $(x - 2)^2 = 0$, the small raised 2 means the factor is used twice: $(x - 2)(x - 2) = 0$. Both factors are 0 at $x = 2$. That is one solution, called a repeated root: a solution that comes from more than one factor. List it once.",
          "The other side must be 0. Look at $(x - 2)(x + 3) = 4$. Try $x = 2$: the product is $0 \\times 5 = 0$, not 4. Many pairs of numbers multiply to 4, so a product of 4 does not tell you what either factor is. Only 0 has this special property. To solve that equation, you would first multiply out the brackets and subtract 4 from both sides, so that one side is 0, then factor again.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve (3x + 2)(x − 5) = 0.",
      steps: [
        "The two factors are $3x + 2$ and $x - 5$, and their product is 0. So at least one factor is 0. Write two equations: $3x + 2 = 0$ or $x - 5 = 0$.",
        "Solve the first. Subtract 2 from both sides so the $x$ part stands alone: $3x = -2$. Divide both sides by 3 to undo the multiplication: $x = -\\tfrac{2}{3}$.",
        "Solve the second. Add 5 to both sides to undo the subtraction: $x = 5$.",
        "Check both in the original equation. At $x = -\\tfrac{2}{3}$, the first factor is $3 \\times (-\\tfrac{2}{3}) + 2 = -2 + 2 = 0$. At $x = 5$, the second factor is $5 - 5 = 0$. Each value makes one factor 0, so each makes the product 0.",
      ],
      answer: "x = −2/3 or x = 5",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Real numbers are all the numbers on the number line, including fractions and negatives. Writing letters side by side, as in $AB$, means $A$ times $B$. Zero-product property: for real numbers $A$ and $B$, $AB = 0$ exactly when $A = 0$ or $B = 0$. Both can be 0 at once.",
          "Take the equation $(px + q)(rx + s) = 0$, where $p$, $q$, $r$ and $s$ are numbers, $p \\ne 0$ and $r \\ne 0$ ($\\ne$ means is not equal to). Setting $px + q = 0$ gives $x = -\\tfrac{q}{p}$. Setting $rx + s = 0$ gives $x = -\\tfrac{s}{r}$. These are the only solutions. When they are equal, they are one repeated root.",
        ],
      },
    ],
    pitfalls: [
      "Use this method only when one side is exactly 0. A product equal to 4 does not tell you which factor is which.",
      "The factors do not have to be 0 at the same value of $x$. Each factor gives its own solution, and you keep them all.",
      "Never divide both sides by a factor that contains $x$. That factor might be 0, and dividing would lose a solution.",
    ],
    parentGuide:
      "Ask the learner to explain, in their own words, why a product of 0 (the answer to a multiplication) means one factor (one of the numbers multiplied) is 0. Then give $x(x - 5) = 0$ and ask for every solution. If they divide by $x$ and find only 5, ask what happens when $x = 0$.",
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
        stage: "intuition",
        title: "Find and check the factors",
        paragraphs: [
          "A quadratic polynomial has highest power x². In ax² + bx + c, the numbers $a$, $b$, and $c$ are coefficients, with a ≠ 0. The term bx is the linear term; $c$ is the constant term. Factoring rewrites the polynomial as a product without changing its value.",
          "If $c = 0$, factor out $x$: $ax^2 + bx = x(ax + b)$. Otherwise, divide out any common numerical factor, then find integers $m$ and $n$ whose sum is $b$ and whose product is ac. Replace bx by mx + nx, then factor the two pairs of terms by grouping.",
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
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Factoring uses the distributive property in reverse: the factored form equals the original polynomial. The zero-product property then gives its roots.",
        ],
      },
    ],
    pitfalls: [
      "When $a$ is not 1, the numbers used to split bx must multiply to ac, not merely to $c$.",
      "Keep a zero root when factoring out $x$.",
    ],
    parentGuide:
      "Ask the learner to multiply the factors before solving. Include an example with no constant term and one with a repeated root.",
  },
  {
    id: "quadratic-real-solution-count",
    title: "Count distinct real solutions",
    summary:
      "The number under the quadratic formula’s square root tells whether the equation has two, one, or no real solutions.",
    templateIds: ["quadratic-real-solution-count"],
    objectives: [
      "Identify signed coefficients, including missing zero terms.",
      "Distinguish zero, one, and two distinct real solutions.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read the square root in the formula",
        paragraphs: [
          "A quadratic equation has a squared variable but no higher power. In $ax^2+bx+c=0$, the numbers $a$, $b$, and $c$ are coefficients and $a\\ne0$. The quadratic formula gives solutions $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$; $\\pm$ means both a plus and a minus choice. The discriminant is the number $D=b^2-4ac$ under the square root.",
          "If the discriminant is positive, adding and subtracting its positive square root give two distinct real values. If it is zero, the two branches agree: one repeated root. If it is negative, its square root is not real: no real solutions.",
        ],
      },
      {
        title: "Count roots and keep coefficient signs",
        paragraphs: [
          "Distinct means different. You do not count the same root twice. A missing $x$ term means b = 0; a missing constant means c = 0. Keep negative coefficients in parentheses when substituting.",
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
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For real coefficients $a$, $b$, and $c$ with $a \\ne 0$, let $D=b^2-4ac$. The equation $ax^2+bx+c=0$ has two distinct real solutions when $D>0$, one when $D=0$, and none when $D<0$.",
        ],
      },
    ],
    pitfalls: [
      "Square the signed coefficient: (−4)² = 16.",
      "Zero discriminant means one distinct real solution, not zero solutions.",
    ],
    parentGuide:
      "Compare x² − 4 = 0, x² = 0, and x² + 4 = 0. Ask why the counts are two, one, and zero without using decimal approximations.",
  },
];
