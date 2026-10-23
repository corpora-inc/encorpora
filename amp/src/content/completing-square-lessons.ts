import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
const foundations: Lesson["sections"] = [
  {
    stage: "intuition",
    title: "Read a quadratic expression",
    paragraphs: [
      "A variable is a letter standing for a number. An expression describes a calculation; it does not by itself ask you to solve an equation. In $x^2 + 6x + 5$, the exponent 2 means multiply $x$ by itself, and 6x means 6 times $x$. The three terms are $x^2$, 6x, and 5. A term's coefficient is its numerical multiplier. The constant term, 5, does not depend on $x$.",
      "A quadratic expression has a nonzero $x^2$ term and no higher power of $x$. Its general form is $ax^2 + bx + c$, where $a$, $b$, and $c$ are fixed numbers and $a$ is not zero. The leading coefficient $a$ multiplies the highest power. When $a$ is 1, the quadratic is called monic. A missing $x$ term or constant has coefficient zero. A binomial has two terms; a squared binomial multiplies the entire two-term expression by itself, as in $(x+3)^2$.",
    ],
  },
  {
    title: "Fraction and signed arithmetic",
    paragraphs: [
      "You will use addition, subtraction, multiplication, and division with positive and negative numbers and fractions. A fraction means division: its numerator is divided by its nonzero denominator. For positive fractions, the denominator counts equal parts in a whole and the numerator counts those parts. For example, 3/2 is three halves. Multiplying a fraction by itself squares both numerator and denominator: $\\left(\\frac{3}{2}\\right)^2 = \\frac{9}{4}$.",
      "To multiply a fraction by a whole number, multiply its numerator: $2 \\times \\frac{3}{4} = \\frac{6}{4} = \\frac{3}{2}$. To divide a fraction by a nonzero whole number, multiply its denominator: $\\frac{3}{2} \\div 2 = \\frac{3}{4}$. For subtraction, first express both quantities in equal-sized parts: $1 - \\frac{9}{4} = \\frac{4}{4} - \\frac{9}{4} = -\\frac{5}{4}$. A product of two negative numbers is positive; a product with exactly one negative factor is negative.",
    ],
  },
  {
    title: "Expand a square to find its middle term",
    paragraphs: [
      "A binomial is an expression with two terms. Squaring the binomial x + h means multiplying two identical factors: $(x + h)^2 = (x + h)(x + h)$. The letter $h$ stands for a fixed number, which may be positive, negative, or zero.",
      "Distribute each term of the first factor across the second: $(x + h)(x + h) = x^2 + xh + hx + h^2$. Since xh and hx are the same product, they combine to 2hx. Therefore $(x + h)^2 = x^2 + 2hx + h^2$. The middle coefficient is twice $h$, and the final constant is the square of $h$.",
      "This equality is an identity: it holds for every real value of $x$. Real numbers include whole numbers, negative numbers, fractions, and all other points on the number line. Rewriting an expression preserves its value for every permitted input; it does not choose one value of $x$ that makes an equation true.",
    ],
  },
];
const finish: Lesson["sections"] = [
  {
    title: "Add a square without changing the value",
    paragraphs: [
      "Completing the square means rewriting a quadratic using a squared binomial and a constant. For a monic quadratic, halve the coefficient $b$ to find $h$. The square needs the constant $h^2$. Add that amount and subtract the same amount so that the value stays unchanged: $x^2 + bx + c = (x^2 + bx + h^2) + (c - h^2)$.",
      "The first group is $(x + h)^2$. Write the remaining constant as $k$: $x^2 + bx + c = (x + h)^2 + k$, where $h = b/2$ and $k = c - h^2$. The letter $k$ names what remains after accounting for the square's constant. If $k$ is negative, subtract its positive opposite. If $h$ or $k$ is zero, omit that added zero.",
      "An odd integer $b$ produces a fractional $h$. Keep the fraction exact. For example, $x^2 + 3x + 1 = \\left(x + \\frac{3}{2}\\right)^2 - \\frac{5}{4}$ because $1 - \\frac{9}{4} = -\\frac{5}{4}$. A negative $b$ gives a negative $h$: $x^2 - 6x + 5 = (x - 3)^2 - 4$.",
    ],
  },
];
export const completingSquareLessons: Lesson[] = [
  {
    id: "complete-square-term",
    title: "Find the term that completes a square",
    summary:
      "We want to rewrite a calculation as one two-term expression multiplied by itself. In $x^2+bx+c$, the coefficient $b$ multiplies $x$; a square $(x+h)^2$ has middle term $2hx$, so halve $b$ to find $h$, then square $h$ to find $c$.",
    templateIds: ["complete-square-term"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why a squared binomial has two cross-products.",
      "Find the exact missing constant, including fractional and zero cases.",
    ],
    sections: [
      ...foundations,
      {
        title: "Supply the missing corner",
        paragraphs: [
          "To make $x^2 + 6x + c$ a squared binomial, split 6x into two equal terms, 3x and 3x. In an area model with positive lengths, attach one rectangle of area 3x to each of two adjacent sides of a square of area $x^2$. A square corner with side length 3 is missing. Its area is 9, so adding 9 completes the larger square.",
          "The area picture explains the name completing the square. Its lengths are positive; the algebraic identity also works when $x$ or $h$ is negative. Multiplying the two factors, rather than assigning negative side lengths to a picture, verifies those cases.",
          "For a general middle coefficient $b$, the equation $2h = b$ gives $h = b/2$. The missing constant is $c = h^2$, not $b$ squared and not $b$ divided by 2. If $b$ is zero, $h$ and $c$ are both zero. A negative $h$ still has a nonnegative square because multiplying two negative numbers gives a positive product.",
        ],
        illustration: "complete-square-area",
      },
    ],
    workedExample: {
      prompt: "Find $c$ so that $x^2 - 5x + c$ is a squared binomial.",
      steps: [
        "Write the desired square as $(x+h)^2$, where $h$ is the number inside the parentheses. Its middle term is $2hx$, so $2h=-5$ and $h=-\\frac{5}{2}$.",
        "Square the entire fraction: $c = \\left(-\\frac{5}{2}\\right)^2 = \\frac{(-5)(-5)}{2 \\times 2} = \\frac{25}{4}$.",
        "Write the identity: $x^2 - 5x + \\frac{25}{4} = \\left(x - \\frac{5}{2}\\right)^2$.",
        "Expand to check: the two cross-products add to $-\\frac{5}{2}x - \\frac{5}{2}x = -5x$, and the constant is $\\frac{25}{4}$.",
      ],
      answer: "$\\frac{25}{4}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For all real $x$ and $h$, $(x+h)^2=x^2+2hx+h^2$. To make $x^2+bx+c$ a squared binomial, set $h=b/2$ and $c=h^2=b^2/4$.",
        ],
      },
    ],
    pitfalls: [
      "Halve the coefficient of $x$ before squaring.",
      "Square both parts of a fraction, including its sign.",
      "The question asks for $c$; $h$ is an intermediate value.",
    ],
    parentGuide:
      "Ask why the coefficient of $x$ is twice the number inside the binomial. Have the learner multiply both factors to justify the answer.",
  },
  {
    id: "complete-square-monic",
    title: "Complete the square with leading coefficient one",
    summary:
      "A squared binomial is a two-term expression multiplied by itself, such as $(x+h)^2$. Add the square needed to form it, then subtract the same amount to keep the original value.",
    templateIds: ["complete-square-monic"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Rewrite a monic quadratic using an exact squared binomial and constant.",
      "Verify the result by comparing every coefficient after expansion.",
    ],
    sections: [
      ...foundations,
      ...finish,
      {
        title: "Account for the original constant",
        paragraphs: [
          "In $x^2 + 6x + 5$, the binomial square $(x + 3)^2$ contains a constant 9. The original constant is only 5, so subtract 4 from that square: $x^2 + 6x + 5 = (x + 3)^2 - 4$.",
          "The subtraction is outside the square; changing the number inside would also change the coefficient of $x$.",
        ],
        illustration: "complete-square-balance",
      },
    ],
    workedExample: {
      prompt: "Rewrite $x^2 + 3x - 5$ in completed-square form.",
      steps: [
        "Halve the coefficient of $x$: $h = \\frac{3}{2}$.",
        "Square that number: $h^2 = \\frac{9}{4}$. Add and subtract it: $x^2 + 3x - 5 = x^2 + 3x + \\frac{9}{4} - \\frac{9}{4} - 5$.",
        "Group the square and combine constants: $x^2 + 3x - 5 = \\left(x + \\frac{3}{2}\\right)^2 - \\frac{9}{4} - \\frac{20}{4} = \\left(x + \\frac{3}{2}\\right)^2 - \\frac{29}{4}$.",
        "Expand to check: the coefficient of $x$ is $2 \\times \\frac{3}{2} = 3$, and the constant is $\\frac{9}{4} - \\frac{29}{4} = -5$.",
      ],
      answer: "$\\left(x + \\frac{3}{2}\\right)^2 - \\frac{29}{4}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For all real $x$, $b$ and $c$, $x^2+bx+c=(x+b/2)^2+(c-b^2/4)$. The added and subtracted square cancel, so both forms have the same value for every input.",
        ],
      },
    ],
    pitfalls: [
      "Adding a square term alone changes the expression; subtract the same amount.",
      "Keep the original constant in the calculation.",
      "A correct rewrite must match the x², $x$, and constant terms.",
    ],
    parentGuide:
      "Ask the learner to expand the answer. Matching the middle coefficient alone does not check the remaining constant.",
  },
  {
    id: "complete-square-nonmonic",
    title: "Complete the square with any leading coefficient",
    summary:
      "When $a$ multiplies an entire squared expression, an amount added inside is multiplied by $a$ too. Subtract that scaled amount outside to keep the expression's value.",
    templateIds: ["complete-square-nonmonic"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Complete the square when the leading coefficient is positive or negative.",
      "Track how an outside factor scales the constant added inside parentheses.",
    ],
    sections: [
      ...foundations,
      ...finish,
      {
        title: "Factor before halving",
        paragraphs: [
          "If the leading coefficient $a$ is not 1, factor it out of both variable terms: $ax^2 + bx + c = a\\left(x^2 + \\frac{b}{a}x\\right) + c$. Division by $a$ is permitted because $a$ is nonzero. The coefficient to halve inside the parentheses is b/a, not the original $b$.",
          "Set $h = \\frac{b}{2a}$. Adding $h^2$ inside the parentheses adds $ah^2$ to the whole expression. Subtract exactly that scaled amount outside: $ax^2 + bx + c = a(x + h)^2 + (c - ah^2)$. Thus the remaining constant is $k = c - ah^2$.",
          "This also works for negative $a$. If $a$ is -2 and $h$ is 1, adding 1 inside changes the expression by -2. Compensate by subtracting -2, which means adding 2. The outside negative sign must remain on the completed square.",
        ],
        illustration: "complete-square-scaled",
      },
    ],
    workedExample: {
      prompt: "Rewrite $-2x^2 + 6x + 1$ in completed-square form.",
      steps: [
        "Factor -2 from both variable terms: $-2x^2 + 6x + 1 = -2(x^2 - 3x) + 1$.",
        "Halve -3: $h = -\\frac{3}{2}$. Its square is $h^2 = \\frac{9}{4}$.",
        "Add and subtract $\\frac{9}{4}$ inside the parentheses. These terms cancel, so the value stays the same. The first three terms are $x^2 - 3x + \\frac{9}{4}$.",
        "Group the square and distribute -2 across the remaining term: $-2\\left(x - \\frac{3}{2}\\right)^2 + \\frac{9}{2} + 1 = -2\\left(x - \\frac{3}{2}\\right)^2 + \\frac{11}{2}$.",
        "Check: the coefficient of $x$ is $2 \\times (-2) \\times \\left(-\\frac{3}{2}\\right) = 6$. The constant is $-\\frac{9}{2} + \\frac{11}{2} = 1$. The leading coefficient remains -2.",
      ],
      answer: "$-2\\left(x - \\frac{3}{2}\\right)^2 + \\frac{11}{2}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For real $a$, $b$, $c$ with $a\\ne0$, $ax^2+bx+c=a(x+b/(2a))^2+(c-b^2/(4a))$ for every real $x$. The outside factor $a$ multiplies the added square, so its compensation is $b^2/(4a)$.",
        ],
      },
    ],
    pitfalls: [
      "Halve b/a after factoring a out of both variable terms.",
      "Adding h² inside parentheses changes the whole expression by ah².",
      "Retain a negative leading coefficient and check the sign of the compensation.",
    ],
    parentGuide:
      "Ask how adding 4 inside parentheses changes an expression multiplied by -3. Then ask what must be added outside to restore the original value.",
  },
];
const terms: NonNullable<ProblemMethod["terms"]> = [
  [
    "Quadratic",
    "An expression whose highest variable power is 2, with a nonzero coefficient on that power.",
  ],
  ["Coefficient", "A number multiplying a variable term."],
  ["Constant", "A fixed number that does not change when $x$ changes."],
  ["Squared binomial", "Two identical factors, such as (x + h)(x + h)."],
];
export const completingSquareMethods: Record<string, ProblemMethod> = {
  "complete-square-term": {
    goal: "Find the constant that makes $x^2 + bx + c$ a squared binomial.",
    terms,
    method: [
      "Expand (x + h)² as x² + 2hx + h².",
      "Match the coefficient of $x$: 2h = b, so h = b/2.",
      "Square $h$ to find $c$; retain exact fractions.",
      "Expand the resulting squared binomial to check every term.",
    ],
    watch: "Halve $b$ first, then square the result.",
  },
  "complete-square-monic": {
    goal: "Rewrite a quadratic with leading coefficient one as (x + h)² + k.",
    terms,
    method: [
      "Halve the coefficient of $x$ to find $h$.",
      "Add and subtract h², so the original value stays unchanged.",
      "Group x² + 2hx + h² as (x + h)²; combine the remaining constants to find $k$.",
      "Expand to verify the coefficient of $x$ and the constant.",
    ],
    watch: "Keep the original constant; do not replace it by h².",
  },
  "complete-square-nonmonic": {
    goal: "Rewrite ax² + bx + c as a(x + h)² + k, with a nonzero.",
    terms: [...terms, ["Leading coefficient", "The number multiplying x²."]],
    method: [
      "Factor a out of both variable terms, leaving x² + (b/a)x inside.",
      "Halve b/a to find h = b/(2a), then square $h$.",
      "Adding h² inside adds ah² to the whole expression. Subtract ah² outside: k = c − ah².",
      "Group the squared binomial and verify all coefficients by expansion.",
    ],
    watch:
      "The outside factor scales the added square, even when it is negative.",
  },
};
export const completingSquarePrinciples: Record<string, string> = {
  "complete-square-term":
    "The two cross-products in (x + h)² combine to 2hx; its constant is h².",
  "complete-square-monic":
    "Adding and subtracting the same square preserves the expression's value.",
  "complete-square-nonmonic":
    "An outside factor multiplies every term inside, including the constant used to complete the square.",
};
