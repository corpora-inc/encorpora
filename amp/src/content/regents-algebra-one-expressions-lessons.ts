import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsAlgebraOneExpressionMethods: Record<string, ProblemMethod> =
  {
    "rate-unit-chain": {
      goal: "Cancel matching units in a chain of conversion factors and name the unit that remains.",
      intuition:
        "A conversion factor is a fraction equal to 1, such as $\\frac{5280\\ \\text{feet}}{1\\ \\text{mile}}$, so multiplying by it changes the unit but not the amount. A unit that appears once on top and once underneath cancels, like a common factor.",
      terms: ["conversion-factor", "rate"],
      method: [
        "Write the starting rate and each factor as fractions with their units.",
        "Cancel a unit that appears in a numerator and a denominator.",
        "Read the units left in the numerator and denominator.",
      ],
      watch:
        "Length is on top and time is underneath in a speed. A factor that flips its units brings the new unit in, so check which unit each factor cancels.",
    },
    "negative-monomial-power": {
      goal: "Raise a monomial with a negative coefficient to a power by raising each factor.",
      intuition:
        "A power of a product is the product of the powers: $(ab)^k=a^kb^k$. The negative sign belongs to the coefficient, so it is raised to the power too. An odd number of negative factors gives a negative result, an even number a positive one.",
      terms: ["monomial", "coefficient"],
      method: [
        "Raise the coefficient, including its sign, to the power.",
        "Multiply the variable's exponent by the power.",
        "Check the sign: odd power of a negative is negative, even power is positive.",
      ],
      watch:
        "Multiply the exponents, do not add them, and raise the coefficient; do not multiply it by the power.",
    },
    "combine-unlike-radicals": {
      goal: "Simplify a square root so it matches another radicand, add the like radicals, and keep the unlike one separate.",
      intuition:
        "Square roots add like objects: $3\\sqrt{5}+2\\sqrt{5}=5\\sqrt{5}$, just as 3 fives plus 2 fives is 5 fives. Different radicands, such as $\\sqrt{5}$ and $\\sqrt{3}$, are different objects and stay separate. A radical such as $\\sqrt{45}$ can hide a like radical: $\\sqrt{45}=3\\sqrt{5}$.",
      terms: ["radicand", "like-radicals"],
      method: [
        "Pull out any perfect-square factor: $\\sqrt{45}=\\sqrt{9\\cdot5}=3\\sqrt{5}$.",
        "Add the coefficients of the radicals that now have the same radicand.",
        "Write the unlike radical as its own term.",
      ],
      watch:
        "Never add the numbers under the root signs. Simplify before deciding two radicals are unlike.",
    },
    "complete-square-equation": {
      goal: "Complete the square on a monic quadratic equation and keep both sides balanced.",
      intuition:
        "The expression $x^2+bx$ becomes a perfect square when you add $(\\frac{b}{2})^2$: for example $x^2+6x+9=(x+3)^2$. Adding a number to one side changes the equation, so add it to both sides.",
      terms: ["perfect-square-trinomial", "completing-the-square"],
      method: [
        "Move the constant to the right side.",
        "Add $(\\frac{b}{2})^2$ to both sides.",
        "Write the left side as $(x+\\frac{b}{2})^2$ and simplify the right side.",
      ],
      watch:
        "Use half of $b$, with its sign, in the binomial. The number you add goes on both sides.",
    },
    "complete-square-step-property": {
      goal: "Name the property of equality behind a step of completing the square.",
      intuition:
        "An equation is a balance. A step that does the same thing to both sides keeps it balanced. Adding or subtracting the same number is the addition property of equality; multiplying or dividing both sides by the same nonzero number is the multiplication property of equality.",
      terms: ["property-of-equality", "balance-scale"],
      method: [
        "Compare the equation before and after the step.",
        "Decide what was done to both sides: a number added or subtracted, or a factor multiplied or divided.",
        "Match it: adding or subtracting is the addition property, multiplying or dividing is the multiplication property.",
      ],
      watch:
        "Subtracting is adding the opposite, and dividing is multiplying by the reciprocal, so they use the same two properties.",
    },
    "polynomial-structure": {
      goal: "Read the degree, leading coefficient and constant term of a polynomial written out of order.",
      intuition:
        "A polynomial is a sum of terms. The degree is the largest exponent of $x$, and the leading coefficient is the number multiplying that highest power, wherever it is written. The constant term is the one with no $x$.",
      terms: ["degree-polynomial", "leading-coefficient", "constant-term"],
      method: [
        "Find the highest exponent: that is the degree.",
        "Read the coefficient, with its sign, of that term.",
        "Find the term with no $x$ and read its value with its sign.",
      ],
      watch:
        "The first term written is not always the leading term, and a number multiplying $x$ is a coefficient, not the constant.",
    },
  };

export const regentsAlgebraOneExpressionPrinciples: Record<string, string> = {
  "rate-unit-chain":
    "Multiplying a quantity by a conversion factor, a fraction equal to 1, changes its unit and not its amount. In a product of fractions, a unit in a numerator and the same unit in a denominator cancel, leaving the units that appear only once.",
  "negative-monomial-power":
    "For a positive integer $k$, $(ax^m)^k=a^kx^{mk}$. If $a<0$ then $a^k$ is negative when $k$ is odd and positive when $k$ is even.",
  "combine-unlike-radicals":
    "For $a\\ge0$ and $b\\ge0$, $\\sqrt{ab}=\\sqrt{a}\\sqrt{b}$, and $p\\sqrt{n}+q\\sqrt{n}=(p+q)\\sqrt{n}$ by the distributive property. The sum $\\sqrt{m}+\\sqrt{n}$ with $m\\ne n$ squarefree is not a single square root.",
  "complete-square-equation":
    "Since $(x+h)^2=x^2+2hx+h^2$, the expression $x^2+bx$ plus $\\left(\\frac{b}{2}\\right)^2$ is $\\left(x+\\frac{b}{2}\\right)^2$. Adding the same number to both sides of an equation gives an equation with the same solutions.",
  "complete-square-step-property":
    "Addition property of equality: if $a=b$ then $a+c=b+c$. Multiplication property of equality: if $a=b$ then $ac=bc$, and for $c\\ne0$ also $\\frac{a}{c}=\\frac{b}{c}$. Both preserve the solution set.",
  "polynomial-structure":
    "A polynomial in $x$ is a sum of terms $a_kx^k$ with whole-number exponents. Its degree is the largest $k$ with $a_k\\ne0$, its leading coefficient is that $a_k$, and its constant term is $a_0$.",
};

export const regentsAlgebraOneExpressionLessons = [
  chainLesson({
    id: "regents-rate-unit-chain",
    title: "The unit of a converted rate",
    summary:
      "Cancel units across a chain of conversion factors to find which units a rate ends up in.",
    templateIds: ["rate-unit-chain"],
    objectives: [
      "Write a conversion as a product of fractions that each equal 1.",
      "Cancel matching units and name the unit left over.",
    ],
    openingTitle: "Units cancel like numbers",
    opening: [
      "Since 1 mile and 5280 feet are the same distance, the fraction $\\frac{5280\\ \\text{feet}}{1\\ \\text{mile}}$ equals 1. Multiplying a quantity by it changes the unit, not the amount.",
      "In a product of fractions, a unit that appears above and below cancels. Whatever is left above is the new numerator unit, and whatever is left below is the new denominator unit.",
    ],
    example: {
      prompt:
        "Find the unit of $\\frac{45\\ \\text{miles}}{1\\ \\text{hour}}\\cdot\\frac{5280\\ \\text{feet}}{1\\ \\text{mile}}\\cdot\\frac{1\\ \\text{hour}}{3600\\ \\text{seconds}}$.",
      steps: [
        "The miles in the first fraction's numerator cancel with the mile in the second fraction's denominator.",
        "The hour in the first fraction's denominator cancels with the hour in the third fraction's numerator.",
        "Feet remain on top and seconds remain underneath.",
      ],
      answer: "feet per second",
    },
    methodTitle: "Cancel top against bottom",
    method: [
      "List each unit and mark where it appears, above or below.",
      "Cancel a unit that is above in one fraction and below in another.",
      "Read the remaining units as numerator per denominator.",
    ],
    formalTitle: "Why unit cancellation is valid",
    formal: [
      "A conversion factor $\\frac{a\\ \\text{unit A}}{b\\ \\text{unit B}}$ equals 1 because the two amounts are equal. Multiplying by 1 does not change the quantity.",
      "Units behave like factors in a product: $\\frac{\\text{A}}{\\text{B}}\\cdot\\frac{\\text{B}}{\\text{C}}=\\frac{\\text{A}}{\\text{C}}$.",
    ],
    pitfalls: [
      "A speed has length on top and time underneath; do not turn it upside down.",
      "A factor that cancels one unit brings in another, so the original unit is gone.",
      "Cancel only a unit that appears once above and once below.",
    ],
    parentGuide:
      "Ask your learner to cross out matching units one pair at a time and say what is left.",
  }),
  chainLesson({
    id: "regents-powers-and-radicals",
    title: "Powers of monomials and sums of square roots",
    summary:
      "Raise a monomial with a negative coefficient to a power and combine square roots that become like radicals.",
    templateIds: ["negative-monomial-power", "combine-unlike-radicals"],
    objectives: [
      "Apply a power to the coefficient and the variable part of a monomial, keeping the sign.",
      "Simplify a square root to match another radicand and add only like radicals.",
    ],
    openingTitle: "Handle each factor separately",
    opening: [
      "A power of a product multiplies out: $(-2x^2)^3=(-2)^3\\cdot(x^2)^3$. The sign belongs to the coefficient, three negative factors multiply to a negative, and a power of a power multiplies the exponents.",
      "Square roots add like objects. $3\\sqrt{5}+2\\sqrt{5}=5\\sqrt{5}$, but $\\sqrt{5}$ and $\\sqrt{3}$ are different, so $\\sqrt{5}+\\sqrt{3}$ stays as it is. A root like $\\sqrt{45}$ may hide a like radical.",
    ],
    example: {
      prompt:
        "Simplify $(-2x^2)^3$, and simplify $3\\sqrt{5}+2\\sqrt{3}+\\sqrt{45}$.",
      steps: [
        "$(-2)^3=-8$ and $(x^2)^3=x^6$, so $(-2x^2)^3=-8x^6$.",
        "$\\sqrt{45}=\\sqrt{9\\cdot5}=3\\sqrt{5}$.",
        "Add the like radicals: $3\\sqrt{5}+3\\sqrt{5}=6\\sqrt{5}$, and keep $2\\sqrt{3}$ separate.",
      ],
      answer: "$-8x^6$ and $6\\sqrt{5}+2\\sqrt{3}$",
    },
    methodTitle: "Factor by factor, radical by radical",
    method: [
      "Raise the sign and coefficient to the power, then multiply the variable's exponent by the power.",
      "For radicals, pull out perfect squares first, then add coefficients of identical radicals.",
      "Leave different radicals as separate terms.",
    ],
    formalTitle: "The rules behind the steps",
    formal: [
      "$(ab)^k=a^kb^k$ and $(x^m)^k=x^{mk}$ for whole-number $m$ and $k$. A negative base to an odd power is negative.",
      "$\\sqrt{ab}=\\sqrt{a}\\sqrt{b}$ for nonnegative $a,b$, and $p\\sqrt{n}+q\\sqrt{n}=(p+q)\\sqrt{n}$ by the distributive property.",
    ],
    pitfalls: [
      "Multiply the exponents of a power of a power; adding them is for multiplying like bases.",
      "Raise the coefficient to the power; do not multiply it by the power.",
      "Do not add the numbers under the root signs.",
    ],
    parentGuide:
      "Ask your learner to substitute $x=1$ into the original and simplified powers, or to check a radical sum with a calculator.",
  }),
  chainLesson({
    id: "regents-complete-the-square-steps",
    title: "Completing the square and why each step is allowed",
    summary:
      "Turn a monic quadratic into $(x+h)^2=k$ and name the property of equality behind each step.",
    templateIds: ["complete-square-equation", "complete-square-step-property"],
    objectives: [
      "Add $(\\frac{b}{2})^2$ to both sides and write the left side as a square.",
      "Name the addition or multiplication property of equality for a step.",
    ],
    openingTitle: "Make a perfect square, keep the balance",
    opening: [
      "A perfect square trinomial like $x^2+6x+9$ factors as $(x+3)^2$. The 9 is half of 6, squared. Given $x^2+6x$, adding 9 makes the square.",
      "An equation stays true when the same thing is done to both sides. So to add 9 on the left we also add 9 on the right. This is the addition property of equality.",
    ],
    example: {
      prompt: "Complete the square for $x^2-6x-5=0$.",
      steps: [
        "Add 5 to both sides: $x^2-6x=5$ (addition property of equality).",
        "Half of $-6$ is $-3$, and $(-3)^2=9$. Add 9 to both sides: $x^2-6x+9=14$.",
        "Factor the left side: $(x-3)^2=14$.",
      ],
      answer: "$(x-3)^2=14$",
    },
    methodTitle: "Constant right, add the square, factor",
    method: [
      "Move the constant to the right side.",
      "Add the square of half the middle coefficient to both sides.",
      "Factor the left side as $(x+h)^2$ where $h$ is half the middle coefficient with its sign.",
    ],
    formalTitle: "The properties of equality",
    formal: [
      "If $a=b$ then $a+c=b+c$ (addition property); subtracting is adding the opposite. If $a=b$ then $ac=bc$ (multiplication property); dividing by $c\\ne0$ is multiplying by $\\frac{1}{c}$.",
      "$(x+h)^2=x^2+2hx+h^2$, so the middle coefficient $b=2h$ and the number to add is $h^2=(\\frac{b}{2})^2$.",
    ],
    pitfalls: [
      "Add the new number to both sides, not only the left.",
      "Use half the middle coefficient, with its sign, in the binomial.",
      "Subtracting a number and dividing by a number still use the two named properties.",
    ],
    parentGuide:
      "Ask your learner to expand the completed square to see that it gives back the original left side plus the added number.",
  }),
  chainLesson({
    id: "regents-polynomial-structure",
    title: "Degree, leading coefficient and constant term",
    summary:
      "Read these three features from a polynomial whose terms are not in descending order.",
    templateIds: ["polynomial-structure"],
    objectives: [
      "Find the degree as the largest exponent anywhere in the expression.",
      "Identify the leading coefficient and constant term with their signs.",
    ],
    openingTitle: "Look for the highest power, not the first term",
    opening: [
      "A polynomial is a sum of terms like $3x^4$, $-x$ and $-5$. The degree is the largest exponent of $x$. The leading coefficient is the number multiplying the term with that exponent. The constant term is the term without $x$.",
      "Terms can appear in any order, so the first term written is not necessarily the leading term.",
    ],
    example: {
      prompt:
        "Find the degree, leading coefficient and constant term of $-5+2x^2+3x^4-x$.",
      steps: [
        "The exponents are 0, 2, 4 and 1, so the degree is 4.",
        "The term with exponent 4 is $3x^4$, so the leading coefficient is 3.",
        "The term with no $x$ is $-5$, so the constant term is $-5$.",
      ],
      answer: "degree 4, leading coefficient 3, constant term $-5$",
    },
    methodTitle: "Highest exponent first",
    method: [
      "Scan all the exponents for the largest one.",
      "Read that term's coefficient with its sign.",
      "Find the term with no variable.",
    ],
    formalTitle: "Standard form of a polynomial",
    formal: [
      "A polynomial in standard form is written $a_nx^n+\\dots+a_1x+a_0$ with $a_n\\ne0$. Rearranging the terms does not change the polynomial.",
      "A term such as $-5x$ has coefficient $-5$ and degree 1, not degree 0, so it is not the constant term.",
    ],
    pitfalls: [
      "The number of terms is not the degree.",
      "A number multiplying $x$ is a coefficient, not the constant term.",
      "The sign belongs to the term: in $-5+2x$ the constant is $-5$.",
    ],
    parentGuide:
      "Ask your learner to rewrite the polynomial in descending order and read the three features from the rewritten form.",
  }),
];

const fm = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({
  templateId,
  facetId,
  extent: "partial",
  rationale,
});
export const regentsAlgebraOneExpressionFacetMappings: FacetMapping[] = [
  fm(
    "rate-unit-chain",
    "units-and-precision.core",
    "Single choice for the unit of a rate after two conversion factors, from length and time units. Does not assess computing the converted value, choosing the factors, or significant digits.",
  ),
  fm(
    "negative-monomial-power",
    "exponent-laws.core",
    "Single choice for a monomial with a negative integer coefficient raised to an odd or even power of 2 to 5. Does not assess several variables, negative or zero exponents, or quotients.",
  ),
  fm(
    "combine-unlike-radicals",
    "rational-exponents.core",
    "Single choice for a sum of three square-root terms where one simplifies to match another radicand. Does not assess products of radicals, cube roots, rationalizing denominators, or decimal approximations.",
  ),
  fm(
    "complete-square-equation",
    "complete-square.core",
    "Single choice for the completed-square form of a monic quadratic equation with an even middle coefficient. Does not assess nonmonic equations, odd middle coefficients, or solving for $x$.",
  ),
  fm(
    "complete-square-step-property",
    "equation-reasoning.core",
    "Single choice for the addition or multiplication property of equality justifying a step of completing the square. Does not assess written justification or other properties such as factoring a perfect square.",
  ),
  fm(
    "polynomial-structure",
    "polynomial-arithmetic.core",
    "Single choice for the polynomial matching a stated degree, leading coefficient and constant term when the terms are out of order. Does not assess adding or multiplying polynomials, or polynomials in several variables.",
  ),
];
