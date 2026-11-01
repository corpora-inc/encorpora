import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const r1Senses = {
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  products: "product-multiply",
  root: "root-radical",
  roots: "root-radical",
  side: "side-of-equation",
  sides: "side-of-equation",
  square: "square-number",
  squares: "square-number",
  squared: "square-number",
  term: "term-expression",
  terms: "term-expression",
  degree: "degree-polynomial",
  balance: "balance-scale",
  unit: "unit",
  units: "unit",
  opposite: "opposite-number",
  average: "mean-average",
  base: "base-exponent",
  bases: "base-exponent",
  opposites: "opposite-number",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  decreasing: "decreasing",
  increasing: "increasing",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
  scale: "balance-scale",
};
const r1NoLink = [
  "part",
  "parts",
  "whole",
  "more than",
  "change",
  "changes",
  "leaves",
  "key",
  "jumps",
  "jump",
  "third",
  "mean",
  "means",
  "sort",
  "image",
  "images",
  "solid",
  "scales",
  "net",
  "inverse",
  "population",
  "period",
  "periods",
  "quarter",
  "quarters",
  "one quarter",
  "mirror image",
  "rule",
  "rules",
];

export const regentsAlgebraOneExpressionMethods: Record<string, ProblemMethod> =
  {
    "rate-unit-chain": {
      goal: "Cancel matching units in a chain of conversion fractions, and name the unit that is left.",
      intuition:
        "Since 1 mile and 5280 feet are the same distance, the fraction $\\frac{5280\\ \\text{feet}}{1\\ \\text{mile}}$ equals 1. A fraction like this is called a conversion factor. Multiplying by it changes the unit but not the amount. When the same unit appears once on top of a fraction and once on the bottom, the two cancel, just like a number that appears on top and bottom. The units left over are the answer's unit.",
      terms: ["conversion-factor", "rate"],
      senses: r1Senses,
      noLink: r1NoLink,
      method: [
        "Write the starting rate and each conversion factor as fractions, with their units.",
        "Cancel a unit that appears on the top of one fraction and the bottom of another.",
        "Read what is left: the top unit “per” the bottom unit.",
      ],
      watch:
        "A speed has a length on top and a time on the bottom. Each factor cancels one unit and brings in another, so check which unit each one cancels.",
    },
    "negative-monomial-power": {
      goal: "Raise a single term with a negative number in front to a power, by raising each part to that power.",
      intuition:
        "A power counts repeated multiplying: $(-2x^2)^3$ means $(-2x^2) \\times (-2x^2) \\times (-2x^2)$. A single term like $-2x^2$ is called a monomial, and its number, $-2$, is its coefficient. The power goes to every part: $(-2)^3 \\times (x^2)^3$. The minus sign belongs to the coefficient, so it is raised too. An odd number of negatives multiplied gives a negative; an even number gives a positive. And $(x^2)^3 = x^2 \\times x^2 \\times x^2 = x^6$, so the exponents multiply.",
      terms: ["monomial", "coefficient"],
      senses: r1Senses,
      noLink: r1NoLink,
      method: [
        "Raise the coefficient, with its sign, to the power: $(-2)^3 = -8$.",
        "Multiply the variable's exponent by the power: $(x^2)^3 = x^6$.",
        "Check the sign: a negative to an odd power is negative, and to an even power it is positive.",
      ],
      watch:
        "Multiply the exponents; do not add them. Raise the coefficient to the power; do not multiply it by the power.",
    },
    "combine-unlike-radicals": {
      goal: "Simplify a square root so it matches another one, add the matching roots, and keep the different one separate.",
      intuition:
        "A square root of a number is a number that times itself gives it, so $\\sqrt{9} = 3$. The number under the root sign is called the radicand. Square roots with the same radicand add like objects: $3\\sqrt{5} + 2\\sqrt{5} = 5\\sqrt{5}$, just as 3 fives plus 2 fives is 5 fives. Roots with different radicands, like $\\sqrt{5}$ and $\\sqrt{3}$, stay separate. A root like $\\sqrt{45}$ can hide a matching one: $\\sqrt{45} = \\sqrt{9 \\times 5} = 3\\sqrt{5}$.",
      terms: ["radicand", "like-radicals"],
      senses: r1Senses,
      noLink: r1NoLink,
      method: [
        "Take out any perfect-square factor (like 4, 9 or 25): $\\sqrt{45} = \\sqrt{9 \\times 5} = 3\\sqrt{5}$.",
        "Add the numbers in front of the roots that now have the same radicand.",
        "Write a root with a different radicand as its own term.",
      ],
      watch:
        "Never add the numbers under the root signs. Simplify each root before deciding two roots do not match.",
    },
    "complete-square-equation": {
      goal: "Complete the square on an equation that starts with $x^2$, keeping both sides equal.",
      intuition:
        "A perfect square is something times itself: $(x + 3)^2 = (x + 3)(x + 3) = x^2 + 6x + 9$. So $x^2 + bx$ becomes a perfect square when you add half of $b$, squared: $\\left(\\frac{b}{2}\\right)^2$. For $x^2 + 6x$, half of 6 is 3 and $3^2 = 9$. Adding a number to only one side would make the equation false, so add it to both sides.",
      terms: ["perfect-square-trinomial", "completing-the-square"],
      senses: r1Senses,
      noLink: r1NoLink,
      method: [
        "Move the number with no $x$ to the right side.",
        "Add $\\left(\\frac{b}{2}\\right)^2$, half the $x$ coefficient squared, to both sides.",
        "Write the left side as $\\left(x + \\frac{b}{2}\\right)^2$ and add up the right side.",
      ],
      watch:
        "Use half of $b$, with its sign, inside the bracket. The number you add goes on both sides.",
    },
    "complete-square-step-property": {
      goal: "Name the rule of equality that allows a step of completing the square.",
      intuition:
        "An equation is like a balanced scale: both sides are equal. A step that does the same thing to both sides keeps it balanced. Adding or subtracting the same number on both sides is called the addition property of equality. Multiplying or dividing both sides by the same number (not 0) is called the multiplication property of equality.",
      terms: ["property-of-equality", "balance-scale"],
      senses: r1Senses,
      noLink: r1NoLink,
      method: [
        "Compare the equation before and after the step.",
        "Decide what was done to both sides: a number added or subtracted, or both sides multiplied or divided by a number.",
        "Match it: adding or subtracting is the addition property, and multiplying or dividing is the multiplication property.",
      ],
      watch:
        "Subtracting is adding the opposite, and dividing is multiplying by one over the number, so those steps use the same two properties.",
    },
    "polynomial-structure": {
      goal: "Read the degree, leading coefficient and constant term of a polynomial whose terms are out of order.",
      intuition:
        "A polynomial is a sum of terms like $3x^4$, $-x$ and $-5$. The degree is the largest exponent (small raised number) on $x$. The leading coefficient is the number multiplying that highest power, wherever it is written. The constant term is the term with no $x$. Each term keeps the sign in front of it.",
      terms: ["degree-polynomial", "leading-coefficient", "constant-term"],
      senses: r1Senses,
      noLink: r1NoLink,
      method: [
        "Find the largest exponent on $x$ anywhere. That is the degree.",
        "Read the coefficient of that term, with its sign. That is the leading coefficient.",
        "Find the term with no $x$, and read it with its sign. That is the constant term.",
      ],
      watch:
        "The first term written is not always the leading term. A number multiplying $x$ is a coefficient, not the constant term.",
    },
  };
export const regentsAlgebraOneExpressionPrinciples: Record<string, string> = {
  "rate-unit-chain":
    "Multiplying a quantity by a conversion factor, a fraction equal to 1, changes its unit and not its amount. In a product of fractions, a unit on top and the same unit on the bottom cancel, leaving the units that appear only once.",
  "negative-monomial-power":
    "For a counting number $k$, $(ax^m)^k = a^k x^{mk}$: raise the coefficient and multiply the exponents. If $a < 0$, then $a^k$ is negative when $k$ is odd and positive when $k$ is even.",
  "combine-unlike-radicals":
    "For numbers $a$ and $b$ that are 0 or more, $\\sqrt{ab} = \\sqrt{a}\\sqrt{b}$. And $p\\sqrt{n} + q\\sqrt{n} = (p + q)\\sqrt{n}$ by the distributive property. Roots of different fully simplified radicands do not combine into one root.",
  "complete-square-equation":
    "Since $(x + h)^2 = x^2 + 2hx + h^2$, adding $\\left(\\frac{b}{2}\\right)^2$ to $x^2 + bx$ gives $\\left(x + \\frac{b}{2}\\right)^2$. Adding the same number to both sides of an equation keeps the same solutions.",
  "complete-square-step-property":
    "Addition property of equality: if $a = b$, then $a + c = b + c$. Multiplication property of equality: if $a = b$, then $ac = bc$, and for $c \\ne 0$ also $\\frac{a}{c} = \\frac{b}{c}$. Both keep the same solutions.",
  "polynomial-structure":
    "A polynomial in $x$ is a sum of terms, each a number times a whole-number power of $x$. Its degree is the largest power with a coefficient other than 0, its leading coefficient is that coefficient, and its constant term is the term with no $x$.",
};
export const regentsAlgebraOneExpressionLessons = [
  {
    ...chainLesson({
      id: "regents-rate-unit-chain",
      title: "The unit of a converted rate",
      summary:
        "A car going 45 miles per hour can also be described in feet per second. To change units, multiply by fractions that each equal 1, such as 5280 feet over 1 mile. When the same unit is on the top of one fraction and the bottom of another, the two cancel. The units left over tell you the unit of the answer.",
      templateIds: ["rate-unit-chain"],
      objectives: [
        "Write a unit change as a product of fractions that each equal 1.",
        "Cancel matching units and name the unit that is left.",
      ],
      openingTitle: "Units cancel like numbers",
      opening: [
        "A rate compares two amounts with different units, like 45 miles per hour. We can write it as a fraction: $\\frac{45\\ \\text{miles}}{1\\ \\text{hour}}$.",
        "Since 1 mile and 5280 feet are the same distance, the fraction $\\frac{5280\\ \\text{feet}}{1\\ \\text{mile}}$ equals 1. A fraction like this is called a conversion factor. Multiplying by 1 changes the unit but not the amount.",
        "When fractions are multiplied, a number that appears on the top and on the bottom cancels: $\\frac{2}{3} \\times \\frac{3}{5} = \\frac{2}{5}$. Units cancel the same way. Whatever unit is left on top is the new top unit, and whatever is left on the bottom is the new bottom unit.",
      ],
      example: {
        prompt:
          "Find the unit of $\\frac{45\\ \\text{miles}}{1\\ \\text{hour}}\\cdot\\frac{5280\\ \\text{feet}}{1\\ \\text{mile}}\\cdot\\frac{1\\ \\text{hour}}{3600\\ \\text{seconds}}$.",
        steps: [
          "Miles are on top of the first fraction and on the bottom of the second, so they cancel.",
          "Hours are on the bottom of the first fraction and on top of the third, so they cancel too.",
          "Feet are left on top and seconds are left on the bottom. So the unit is feet per second.",
        ],
        answer: "feet per second",
      },
      methodTitle: "Cancel top against bottom",
      method: [
        "List each unit and mark where it appears: on top or on the bottom.",
        "Cancel a unit that is on top in one fraction and on the bottom in another.",
        "Read the units that are left as “top unit per bottom unit”.",
      ],
      formalTitle: "Why unit cancellation is valid",
      formal: [
        "A conversion factor equals 1, because its top and bottom are the same amount written in two units. Multiplying by 1 does not change a quantity.",
        "Units behave like factors (parts being multiplied) in a product: miles per hour times hours per second gives miles per second, because the hours cancel.",
      ],
      pitfalls: [
        "A speed has a length on top and a time on the bottom. Do not turn it upside down.",
        "A factor that cancels one unit brings in another, so the original unit is gone.",
        "Cancel only a unit that appears once on top and once on the bottom.",
      ],
      parentGuide:
        "Ask your learner to cross out matching units one pair at a time, and to say what is left.",
    }),
    senses: r1Senses,
    noLink: r1NoLink,
  },
  {
    ...chainLesson({
      id: "regents-powers-and-radicals",
      title: "Powers of monomials and sums of square roots",
      summary:
        "Raising to a power means multiplying something by itself: $(-2x)^2 = (-2x) \\times (-2x) = 4x^2$. The power applies to the number and to the letter, and the minus sign comes along. Square roots can be added only when the numbers under the root sign match: three square roots of 5 plus two square roots of 5 make five square roots of 5. Sometimes a root must be simplified first to show that it matches.",
      templateIds: ["negative-monomial-power", "combine-unlike-radicals"],
      objectives: [
        "Apply a power to both the number and the letter part of a single term, keeping the sign.",
        "Simplify a square root to match another one, and add only roots that match.",
      ],
      openingTitle: "Handle each factor separately",
      opening: [
        "A single term such as $-2x^2$ is called a monomial. Its number, $-2$, is called its coefficient. The small raised number is an exponent, and it counts repeated multiplying: $x^2 = x \\times x$.",
        "A power of a product goes to every factor (every part being multiplied): $(-2x^2)^3 = (-2)^3 \\times (x^2)^3$. The minus sign belongs to the coefficient, so it is raised too. Three negatives multiplied make a negative, so $(-2)^3 = -8$.",
        "A power of a power multiplies the exponents: $(x^2)^3 = x^2 \\times x^2 \\times x^2 = x^6$, which is $x^{2 \\times 3}$.",
        "A square root of a number is a number that times itself gives it: $\\sqrt{9} = 3$. The number under the root sign is called the radicand. Roots with the same radicand are called like radicals, and they add like objects: $3\\sqrt{5} + 2\\sqrt{5} = 5\\sqrt{5}$. Roots with different radicands, like $\\sqrt{5} + \\sqrt{3}$, stay as they are.",
        "A root can hide a like radical. Since $45 = 9 \\times 5$ and $\\sqrt{9} = 3$, $\\sqrt{45} = 3\\sqrt{5}$.",
      ],
      example: {
        prompt:
          "Simplify $(-2x^2)^3$, and simplify $3\\sqrt{5}+2\\sqrt{3}+\\sqrt{45}$.",
        steps: [
          "Raise each factor to the power 3. The coefficient: $(-2)^3 = (-2) \\times (-2) \\times (-2) = -8$. The letter part: $(x^2)^3 = x^6$, multiplying the exponents. So $(-2x^2)^3 = -8x^6$.",
          "For the roots, simplify $\\sqrt{45}$ first. It has the perfect-square factor 9: $\\sqrt{45} = \\sqrt{9 \\times 5} = 3\\sqrt{5}$.",
          "Now add the like radicals: $3\\sqrt{5} + 3\\sqrt{5} = 6\\sqrt{5}$. The term $2\\sqrt{3}$ has a different radicand, so it stays separate: $6\\sqrt{5} + 2\\sqrt{3}$.",
        ],
        answer: "$-8x^6$ and $6\\sqrt{5}+2\\sqrt{3}$",
      },
      methodTitle: "Factor by factor, radical by radical",
      method: [
        "Raise the sign and the coefficient to the power. Then multiply the letter's exponent by the power.",
        "For roots, take out perfect squares first. Then add the numbers in front of roots that match.",
        "Leave roots that do not match as separate terms.",
      ],
      formalTitle: "The rules behind the steps",
      formal: [
        "$(ab)^k = a^k b^k$ and $(x^m)^k = x^{mk}$ for whole-number exponents $m$ and $k$. A negative number to an odd power is negative.",
        "$\\sqrt{ab} = \\sqrt{a}\\sqrt{b}$ when $a$ and $b$ are 0 or more. And $p\\sqrt{n} + q\\sqrt{n} = (p + q)\\sqrt{n}$, by the distributive property.",
      ],
      pitfalls: [
        "Multiply the exponents for a power of a power. Adding exponents is for multiplying, like $x^2 \\times x^3 = x^5$.",
        "Raise the coefficient to the power. Do not multiply it by the power.",
        "Do not add the numbers under the root signs.",
      ],
      parentGuide:
        "Ask your learner to put $x = 1$ into the original power and the simplified one to check they match, or to check a sum of roots with a calculator.",
    }),
    senses: r1Senses,
    noLink: r1NoLink,
  },
  {
    ...chainLesson({
      id: "regents-complete-the-square-steps",
      title: "Completing the square and why each step is allowed",
      summary:
        "Multiplying $x + 3$ by itself gives $x^2 + 6x + 9$. So adding 9 to $x^2 + 6x$ makes it a perfect square, something times itself. Completing the square uses this idea to rewrite an equation as a square equal to a number, like $(x - 3)^2 = 14$. Each step does the same thing to both sides of the equation, which keeps it true. This lesson also names the rule that allows each step.",
      templateIds: [
        "complete-square-equation",
        "complete-square-step-property",
      ],
      objectives: [
        "Add half the $x$ coefficient, squared, to both sides, and write the left side as a square.",
        "Name the addition property or the multiplication property of equality for a step.",
      ],
      openingTitle: "Make a perfect square, keep the balance",
      opening: [
        "A perfect square is something times itself, like $(x + 3)^2 = (x + 3)(x + 3)$. Multiplying out gives $x^2 + 3x + 3x + 9 = x^2 + 6x + 9$. The 6 is twice 3, and the 9 is 3 squared.",
        "So, given $x^2 + 6x$, take half of 6, which is 3, and square it to get 9. Adding 9 makes the perfect square $(x + 3)^2$.",
        "An equation is like a balanced scale. It stays true when the same thing is done to both sides. So to add 9 on the left, we also add 9 on the right.",
        "Adding or subtracting the same number on both sides is called the addition property of equality. Multiplying or dividing both sides by the same number (not 0) is called the multiplication property of equality.",
      ],
      example: {
        prompt: "Complete the square for $x^2-6x-5=0$.",
        steps: [
          "Add 5 to both sides to move the number away from the $x$ terms: $x^2 - 6x = 5$. This uses the addition property of equality.",
          "Half of $-6$ is $-3$, and $(-3)^2 = 9$. Add 9 to both sides, again by the addition property: $x^2 - 6x + 9 = 14$.",
          "The left side is a perfect square, because $(x - 3)(x - 3) = x^2 - 6x + 9$. So $(x - 3)^2 = 14$.",
        ],
        answer: "$(x-3)^2=14$",
      },
      methodTitle: "Constant right, add the square, factor",
      method: [
        "Move the number with no $x$ to the right side.",
        "Add the square of half the $x$ coefficient to both sides.",
        "Write the left side as $(x + h)^2$, where $h$ is half the $x$ coefficient, with its sign.",
      ],
      formalTitle: "The properties of equality",
      formal: [
        "Addition property: if $a = b$, then $a + c = b + c$. Subtracting is adding the opposite, so it uses the same property.",
        "Multiplication property: if $a = b$, then $ac = bc$. Dividing by a number $c \\ne 0$ ($c$ not equal to 0) is multiplying by $\\frac{1}{c}$, so it uses the same property.",
        "$(x + h)^2 = x^2 + 2hx + h^2$. So the $x$ coefficient is $b = 2h$, and the number to add is $h^2 = \\left(\\frac{b}{2}\\right)^2$.",
      ],
      pitfalls: [
        "Add the new number to both sides, not only the left.",
        "Use half the $x$ coefficient, with its sign, inside the bracket.",
        "Subtracting a number and dividing by a number still use the two named properties.",
      ],
      parentGuide:
        "Ask your learner to multiply out the completed square, to see that it gives back the original left side plus the number that was added.",
    }),
    senses: r1Senses,
    noLink: r1NoLink,
  },
  {
    ...chainLesson({
      id: "regents-polynomial-structure",
      title: "Degree, leading coefficient and constant term",
      summary:
        "In $-5 + 2x^2 + 3x^4 - x$, the parts joined by $+$ and $-$ are called terms. The highest power of $x$ is 4, in $3x^4$, so the expression has degree 4. The number in front of that term, 3, is the leading coefficient. The term with no $x$, $-5$, is the constant term. The terms can be written in any order, so look at every one.",
      templateIds: ["polynomial-structure"],
      objectives: [
        "Find the degree as the largest exponent on $x$ anywhere in the expression.",
        "Find the leading coefficient and the constant term, with their signs.",
      ],
      openingTitle: "Look for the highest power, not the first term",
      opening: [
        "A polynomial is a sum of terms like $3x^4$, $-x$ and $-5$. Each term keeps the sign in front of it. The small raised number on $x$ is its exponent, so $x^4 = x \\times x \\times x \\times x$.",
        "The degree of a polynomial is the largest exponent on $x$. The number multiplying a term's power of $x$ is called its coefficient. The leading coefficient is the coefficient of the term with the largest exponent. The constant term is the term with no $x$.",
        "Terms can be written in any order. So the first term written is not always the leading term.",
      ],
      example: {
        prompt:
          "Find the degree, leading coefficient and constant term of $-5+2x^2+3x^4-x$.",
        steps: [
          "List the exponents. The term $-5$ has no $x$ (exponent 0), $2x^2$ has 2, $3x^4$ has 4, and $-x$ has 1. The largest is 4, so the degree is 4.",
          "The term with exponent 4 is $3x^4$, so the leading coefficient is 3.",
          "The term with no $x$ is $-5$. It keeps its minus sign, so the constant term is $-5$.",
        ],
        answer: "degree 4, leading coefficient 3, constant term $-5$",
      },
      methodTitle: "Highest exponent first",
      method: [
        "Look at every exponent and find the largest.",
        "Read that term's coefficient, with its sign.",
        "Find the term with no variable, with its sign.",
      ],
      formalTitle: "Standard form of a polynomial",
      formal: [
        "A polynomial in standard form lists its terms from the highest power down: $a_nx^n + \\dots + a_1x + a_0$, with $a_n \\ne 0$. The small numbers written low are labels. Rearranging the terms does not change the polynomial.",
        "A term such as $-5x$ has coefficient $-5$ and degree 1, not 0, so it is not the constant term.",
      ],
      pitfalls: [
        "The number of terms is not the degree.",
        "A number multiplying $x$ is a coefficient, not the constant term.",
        "The sign belongs to the term: in $-5 + 2x$, the constant term is $-5$.",
      ],
      parentGuide:
        "Ask your learner to rewrite the polynomial from the highest power down, then read the three features from the rewritten form.",
    }),
    senses: r1Senses,
    noLink: r1NoLink,
  },
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
