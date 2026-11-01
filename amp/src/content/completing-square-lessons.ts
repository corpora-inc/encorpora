import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
const foundations: Lesson["sections"] = [
  {
    stage: "intuition",
    title: "Read a quadratic expression",
    paragraphs: [
      "A variable is a letter, like $x$, that stands for a number. An expression is a calculation written with numbers and variables, like $x^2 + 6x + 5$. It does not have an equals sign, so there is nothing to solve. We only rewrite it.",
      "In $x^2 + 6x + 5$, the small raised 2 means $x$ times $x$, read “$x$ squared”. Writing $6x$ means 6 times $x$. The parts joined by $+$ or $-$ signs are called terms, so the terms are $x^2$, $6x$ and $5$.",
      "The number that multiplies a term's variable is called its coefficient. Here 1 multiplies $x^2$ and 6 multiplies $x$. The term 5 has no variable, so it is called the constant term. A missing term has coefficient 0.",
      "An expression with an $x^2$ term and no higher power, like $x^3$, is called a quadratic. We write it as $ax^2 + bx + c$, where $a$, $b$ and $c$ are fixed numbers and $a \\ne 0$ ($\\ne$ means is not equal to). The number $a$ in front of $x^2$ is called the leading coefficient. When $a = 1$, the quadratic is called monic.",
      "A binomial is an expression with two terms, like $x + 3$. Squaring a binomial means multiplying the whole binomial by itself: $(x + 3)^2 = (x + 3)(x + 3)$. Two brackets written next to each other are multiplied.",
    ],
  },
  {
    title: "Fraction and signed arithmetic",
    paragraphs: [
      "You will add, subtract, multiply and divide positive numbers, negative numbers and fractions. A fraction means division: the top number (the numerator) is divided by the bottom number (the denominator), which is never 0. So $\\frac{3}{2}$ means $3 \\div 2$, or three halves.",
      "To square a fraction, square the top and square the bottom: $\\left(\\frac{3}{2}\\right)^2 = \\frac{3 \\times 3}{2 \\times 2} = \\frac{9}{4}$.",
      "To multiply a fraction by a whole number, multiply its top: $2 \\times \\frac{3}{4} = \\frac{6}{4} = \\frac{3}{2}$. To divide a fraction by a whole number other than 0, multiply its bottom: $\\frac{3}{2} \\div 2 = \\frac{3}{4}$.",
      "To subtract, first write both numbers with the same bottom number: $1 - \\frac{9}{4} = \\frac{4}{4} - \\frac{9}{4} = -\\frac{5}{4}$.",
      "A negative number times a negative number is positive, so $(-3) \\times (-3) = 9$. A product with exactly one negative number is negative, so $(-2) \\times 3 = -6$.",
    ],
  },
  {
    title: "Expand a square to find its middle term",
    paragraphs: [
      "Start with numbers. $(x + 3)^2$ means $(x + 3)(x + 3)$. Multiply each term of the first bracket by each term of the second: $x \\times x = x^2$, $x \\times 3 = 3x$, $3 \\times x = 3x$ and $3 \\times 3 = 9$. Together, $(x + 3)^2 = x^2 + 6x + 9$.",
      "Notice two things. The middle coefficient, 6, is twice 3, because the $3x$ appears twice. The constant, 9, is 3 squared.",
      "Now use a letter. Let $h$ stand for a fixed number, which can be positive, negative or zero. Then $(x + h)^2 = x^2 + hx + hx + h^2 = x^2 + 2hx + h^2$. The middle coefficient is twice $h$, and the constant is $h$ squared.",
      "This equation is true for every value of $x$, so it is called an identity. Rewriting with it never changes the value of the expression. It does not find one special value of $x$.",
    ],
  },
];
const finish: Lesson["sections"] = [
  {
    title: "Add a square without changing the value",
    paragraphs: [
      "Completing the square means rewriting a quadratic as a squared binomial plus a number. For a monic quadratic $x^2 + bx + c$, halve $b$ to get $h$. A perfect square $(x + h)^2$ needs the constant $h^2$.",
      "Adding a number changes the value, so add $h^2$ and also subtract $h^2$. Together they add 0: $x^2 + bx + c = (x^2 + bx + h^2) + (c - h^2)$.",
      "The first group is exactly $(x + h)^2$. Call the leftover number $k$, so $k = c - h^2$. Then $x^2 + bx + c = (x + h)^2 + k$. If $k$ is negative, write it as a subtraction. If $h$ or $k$ is 0, leave that part out.",
      "When $b$ is odd, $h$ is a fraction. Keep it exact: $x^2 + 3x + 1 = \\left(x + \\frac{3}{2}\\right)^2 - \\frac{5}{4}$, because $1 - \\frac{9}{4} = -\\frac{5}{4}$. When $b$ is negative, $h$ is negative: $x^2 - 6x + 5 = (x - 3)^2 - 4$.",
    ],
  },
];
const senses: Lesson["senses"] = {
  square: "square-number",
  squares: "square-number",
  squared: "square-number",
  squaring: "square-number",
  term: "term-expression",
  terms: "term-expression",
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  side: "side",
  sides: "side",
  unit: "unit",
  units: "unit",
  average: "mean-average",
  base: "base-exponent",
  bases: "base-exponent",
  opposite: "opposite-number",
  opposites: "opposite-number",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  decreasing: "decreasing",
  increasing: "increasing",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
  rule: "rule",
  rules: "rule",
};
const noLink = [
  "part",
  "parts",
  "whole",
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
  "more than",
  "period",
  "periods",
  "quarter",
  "quarters",
  "one quarter",
  "mirror image",
];
export const completingSquareLessons: Lesson[] = [
  {
    id: "complete-square-term",
    title: "Find the term that completes a square",
    summary:
      "When you multiply $x + 3$ by itself, you get $x^2 + 6x + 9$. The middle number, 6, is twice 3, and the last number, 9, is 3 times 3. So to make $x^2 + bx + c$ a perfect square, halve $b$ and then square the result to find $c$. For $x^2 + 10x + c$, half of 10 is 5 and 5 squared is 25, so $c = 25$ and $x^2 + 10x + 25 = (x + 5)^2$.",
    templateIds: ["complete-square-term"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Explain why squaring $x + h$ gives the middle term $2hx$: the $hx$ appears twice.",
      "Find the exact missing constant, including when it is a fraction or 0.",
    ],
    sections: [
      ...foundations,
      {
        title: "Supply the missing corner",
        paragraphs: [
          "Think of $x^2 + 6x$ as area. Draw a square with side $x$, so its area is $x^2$. Split $6x$ into two equal rectangles, each 3 by $x$, with area $3x$. Attach one rectangle to the right of the square and one to the bottom.",
          "The shape is almost a bigger square with side $x + 3$. Only a small corner is missing, 3 by 3. Its area is 9. Adding 9 completes the big square, which is where the name completing the square comes from.",
          "The picture uses positive lengths. The algebra also works when $x$ or $h$ is negative. To check those cases, multiply the two brackets out instead of drawing.",
          "For any middle coefficient $b$, we need $2h = b$, so $h = \\frac{b}{2}$, half of $b$. The missing constant is $h^2$. It is not $b$ squared, and it is not half of $b$. If $b = 0$, then $h = 0$ and the constant is 0. A negative $h$ still gives a positive square, because a negative times a negative is positive.",
        ],
        illustration: "complete-square-area",
      },
    ],
    workedExample: {
      prompt: "Find $c$ so that $x^2 - 5x + c$ is a squared binomial.",
      steps: [
        "Aim for $(x + h)^2 = x^2 + 2hx + h^2$. Its middle coefficient is $2h$, and here the middle coefficient is $-5$. So $2h = -5$. Divide both sides by 2: $h = -\\frac{5}{2}$.",
        "The constant of the square is $h^2$. Square the whole fraction, sign included: $c = \\left(-\\frac{5}{2}\\right)^2 = \\frac{(-5) \\times (-5)}{2 \\times 2} = \\frac{25}{4}$. It is positive because a negative times a negative is positive.",
        "Write the result: $x^2 - 5x + \\frac{25}{4} = \\left(x - \\frac{5}{2}\\right)^2$.",
        "Check by multiplying out. The two middle products are $-\\frac{5}{2}x$ and $-\\frac{5}{2}x$, which add to $-5x$. The constant is $\\frac{25}{4}$. Both match.",
      ],
      answer: "$\\frac{25}{4}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For all real numbers $x$ and $h$ (numbers on the number line), $(x + h)^2 = x^2 + 2hx + h^2$. So $x^2 + bx + c$ is a squared binomial exactly when $c = h^2$ with $h = \\frac{b}{2}$. That is, $c = \\frac{b^2}{4}$.",
        ],
      },
    ],
    pitfalls: [
      "Halve the coefficient of $x$ first, then square the result.",
      "Square a whole fraction, top and bottom, and remember that a negative squared is positive.",
      "The question asks for $c$. The number $h$ is only a step on the way.",
    ],
    parentGuide:
      "Ask the learner why the number multiplying $x$ is twice the number inside the bracket. (The product $hx$ appears twice when you multiply out.) Then have them multiply both brackets out to check the answer.",
  },
  {
    id: "complete-square-monic",
    title: "Complete the square with leading coefficient one",
    summary:
      "Completing the square rewrites an expression like $x^2 + 6x + 5$ as a square plus a number. Squaring $x + 3$ gives $x^2 + 6x + 9$, which has the right $x^2$ and $6x$ but the constant 9 instead of 5. Since 5 is 4 less than 9, subtract 4: $x^2 + 6x + 5 = (x + 3)^2 - 4$. The 3 is half of 6. Every step keeps the value the same.",
    templateIds: ["complete-square-monic"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Rewrite a quadratic whose $x^2$ term has coefficient 1 as an exact square plus a number.",
      "Check the result by multiplying out and comparing every term.",
    ],
    sections: [
      ...foundations,
      ...finish,
      {
        title: "Account for the original constant",
        paragraphs: [
          "In $x^2 + 6x + 5$, half of 6 is 3, and $(x + 3)^2 = x^2 + 6x + 9$ has the constant 9. The original constant is only 5, which is 4 less. So subtract 4 after the square: $x^2 + 6x + 5 = (x + 3)^2 - 4$.",
          "The subtraction goes outside the bracket. Changing the number inside the bracket would also change the $x$ term.",
        ],
        illustration: "complete-square-balance",
      },
    ],
    workedExample: {
      prompt: "Rewrite $x^2 + 3x - 5$ in completed-square form.",
      steps: [
        "Halve the coefficient of $x$ to find the number inside the bracket: $h = \\frac{3}{2}$.",
        "Square it: $h^2 = \\frac{9}{4}$. Add it and subtract it, which adds 0 and keeps the value: $x^2 + 3x - 5 = x^2 + 3x + \\frac{9}{4} - \\frac{9}{4} - 5$.",
        "The first three terms form a square: $x^2 + 3x + \\frac{9}{4} = \\left(x + \\frac{3}{2}\\right)^2$. Combine the leftover numbers, writing 5 as $\\frac{20}{4}$: $-\\frac{9}{4} - \\frac{20}{4} = -\\frac{29}{4}$. So the expression is $\\left(x + \\frac{3}{2}\\right)^2 - \\frac{29}{4}$.",
        "Check by multiplying out. The $x$ term is $2 \\times \\frac{3}{2} = 3$, so $3x$. The constant is $\\frac{9}{4} - \\frac{29}{4} = -\\frac{20}{4} = -5$. Both match the original.",
      ],
      answer: "$\\left(x + \\frac{3}{2}\\right)^2 - \\frac{29}{4}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For all real numbers $x$, $b$ and $c$: $x^2 + bx + c = \\left(x + \\frac{b}{2}\\right)^2 + \\left(c - \\frac{b^2}{4}\\right)$. The added and subtracted square cancel, so both forms have the same value for every $x$.",
        ],
      },
    ],
    pitfalls: [
      "Adding the square alone changes the expression. Subtract the same amount too.",
      "Keep the original constant in the calculation. Do not replace it with the square's constant.",
      "Check all three terms after multiplying out: the $x^2$ term, the $x$ term and the constant.",
    ],
    parentGuide:
      "Ask the learner to multiply the answer back out. Matching only the $x$ term is not enough, because the constant must match too.",
  },
  {
    id: "complete-square-nonmonic",
    title: "Complete the square with any leading coefficient",
    summary:
      "Sometimes a number other than 1 multiplies $x^2$, as in $2x^2 + 12x + 5$. Take that number out of the first two terms: $2(x^2 + 6x) + 5$. Complete the square inside the bracket by adding 9, which is 3 squared. The 2 outside multiplies that 9 too, so you really added 18. Subtract 18 to keep the value: $2(x + 3)^2 - 13$.",
    templateIds: ["complete-square-nonmonic"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Complete the square when the number multiplying $x^2$ is positive or negative and not 1.",
      "Track how the number outside the bracket multiplies the constant you add inside.",
    ],
    sections: [
      ...foundations,
      ...finish,
      {
        title: "Factor before halving",
        paragraphs: [
          "If the leading coefficient $a$ is not 1, take it out of the two terms that contain $x$: $ax^2 + bx + c = a\\left(x^2 + \\frac{b}{a}x\\right) + c$. Dividing by $a$ is allowed because $a$ is not 0. Inside the bracket, the coefficient to halve is $\\frac{b}{a}$, not $b$.",
          "Let $h = \\frac{b}{2a}$, which is half of $\\frac{b}{a}$. Adding $h^2$ inside the bracket adds $a$ times $h^2$ to the whole expression, because $a$ multiplies everything inside. So subtract $ah^2$ outside: $ax^2 + bx + c = a(x + h)^2 + (c - ah^2)$. The leftover number is $k = c - ah^2$.",
          "This also works when $a$ is negative. Say $a = -2$ and you add 1 inside the bracket. That changes the expression by $-2 \\times 1 = -2$. To undo it, subtract $-2$, which is the same as adding 2. Keep the negative number in front of the square.",
        ],
        illustration: "complete-square-scaled",
      },
    ],
    workedExample: {
      prompt: "Rewrite $-2x^2 + 6x + 1$ in completed-square form.",
      steps: [
        "Take $-2$ out of the two terms with $x$. Dividing each by $-2$ gives $x^2$ and $-3x$: $-2x^2 + 6x + 1 = -2(x^2 - 3x) + 1$.",
        "Halve the coefficient inside the bracket: half of $-3$ is $h = -\\frac{3}{2}$. Its square is $h^2 = \\frac{9}{4}$.",
        "Add and subtract $\\frac{9}{4}$ inside the bracket, which adds 0: $-2\\left(x^2 - 3x + \\frac{9}{4} - \\frac{9}{4}\\right) + 1$. The first three terms inside form the square $\\left(x - \\frac{3}{2}\\right)^2$.",
        "Move the $-\\frac{9}{4}$ out of the bracket. It is multiplied by $-2$ on the way: $-2 \\times \\left(-\\frac{9}{4}\\right) = \\frac{9}{2}$. So the expression is $-2\\left(x - \\frac{3}{2}\\right)^2 + \\frac{9}{2} + 1 = -2\\left(x - \\frac{3}{2}\\right)^2 + \\frac{11}{2}$.",
        "Check by multiplying out. The $x$ term is $-2 \\times 2 \\times \\left(-\\frac{3}{2}\\right) = 6$, so $6x$. The constant is $-2 \\times \\frac{9}{4} + \\frac{11}{2} = -\\frac{9}{2} + \\frac{11}{2} = 1$. The $x^2$ coefficient is still $-2$.",
      ],
      answer: "$-2\\left(x - \\frac{3}{2}\\right)^2 + \\frac{11}{2}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For real numbers $a$, $b$ and $c$ with $a \\ne 0$: $ax^2 + bx + c = a\\left(x + \\frac{b}{2a}\\right)^2 + \\left(c - \\frac{b^2}{4a}\\right)$ for every real $x$. The number $a$ outside multiplies the added square, so the amount subtracted outside is $a \\times \\left(\\frac{b}{2a}\\right)^2 = \\frac{b^2}{4a}$.",
        ],
      },
    ],
    pitfalls: [
      "Take $a$ out of both terms with $x$ first. Then halve $\\frac{b}{a}$, not $b$.",
      "Adding $h^2$ inside the bracket changes the whole expression by $a$ times $h^2$.",
      "Keep a negative leading coefficient in front of the square, and check the sign of what you add back.",
    ],
    parentGuide:
      "Ask the learner how adding 4 inside a bracket changes an expression that is multiplied by $-3$. (It changes it by $-12$.) Then ask what must be added outside to get back the original value.",
  },
];
const terms: NonNullable<ProblemMethod["terms"]> = [
  "quadratic",
  "coefficient",
  "constant",
  "perfect-square-trinomial",
];
const methodSenses: ProblemMethod["senses"] = {
  square: "square-number",
  squared: "square-number",
  squares: "square-number",
  term: "term-expression",
  terms: "term-expression",
  factor: "factor-number",
  product: "product-multiply",
  unit: "unit",
  units: "unit",
  average: "mean-average",
  base: "base-exponent",
  bases: "base-exponent",
  opposite: "opposite-number",
  opposites: "opposite-number",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  decreasing: "decreasing",
  increasing: "increasing",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
  rule: "rule",
  rules: "rule",
};
const intuitionBase =
  "In $x^2 + bx + c$, $x^2$ ($x$ squared) means $x$ times $x$, and $bx$ means $b$ times $x$. The parts joined by $+$ or $-$ are called terms. The number multiplying a term's variable is its coefficient, and $c$, with no variable, is the constant. A squared binomial is a two-term expression times itself: $(x + h)^2 = (x + h)(x + h) = x^2 + 2hx + h^2$. Its middle coefficient is twice $h$, and its constant is $h$ squared.";
export const completingSquareMethods: Record<string, ProblemMethod> = {
  "complete-square-term": {
    goal: "Find the constant $c$ that makes $x^2 + bx + c$ a squared binomial, a two-term expression times itself.",
    intuition: `${intuitionBase} So halve $b$ to find $h$, then square $h$ to find $c$. For $x^2 + 6x + c$: half of 6 is 3, and 3 squared is 9.`,
    terms,
    senses: methodSenses,
    noLink,
    method: [
      "Write the target square: $(x + h)^2 = x^2 + 2hx + h^2$.",
      "Match the middle coefficient: $2h = b$, so $h = \\frac{b}{2}$, half of $b$.",
      "Square $h$ to find $c$. Keep fractions exact, and remember that a negative squared is positive.",
      "Multiply $(x + h)^2$ back out to check every term.",
    ],
    watch: "Halve $b$ first, then square the result. Do not square $b$ itself.",
  },
  "complete-square-monic": {
    goal: "Rewrite a quadratic whose $x^2$ coefficient is 1 as $(x + h)^2 + k$, a square plus a number.",
    intuition: `${intuitionBase} To rewrite $x^2 + bx + c$, take $h$ as half of $b$. Add $h^2$ and subtract it again, which keeps the value. The leftover number is $k$.`,
    terms,
    senses: methodSenses,
    noLink,
    method: [
      "Halve the coefficient of $x$ to find $h$.",
      "Add $h^2$ and subtract $h^2$. Together they add 0, so the value stays the same.",
      "Group $x^2 + 2hx + h^2$ as $(x + h)^2$. Combine the leftover numbers to find $k = c - h^2$.",
      "Multiply back out to check the $x$ term and the constant.",
    ],
    watch:
      "Keep the original constant $c$. The answer's number $k$ is $c - h^2$, not $h^2$.",
  },
  "complete-square-nonmonic": {
    goal: "Rewrite $ax^2 + bx + c$, with $a \\ne 0$, as $a(x + h)^2 + k$: a number times a square, plus a number.",
    intuition: `${intuitionBase} When $a$ is not 1, take $a$ out of the two terms with $x$ first. Any number you add inside the bracket is then multiplied by $a$, so the amount to subtract outside is $a$ times it. Here $a \\ne 0$ means $a$ is not equal to 0.`,
    terms: [...terms, "leading-coefficient"],
    senses: methodSenses,
    noLink,
    method: [
      "Take $a$ out of the two terms with $x$, leaving $x^2 + \\frac{b}{a}x$ inside the bracket.",
      "Halve $\\frac{b}{a}$ to find $h = \\frac{b}{2a}$. Then square $h$.",
      "Adding $h^2$ inside adds $ah^2$ to the whole expression. So subtract $ah^2$ outside: $k = c - ah^2$.",
      "Write $a(x + h)^2 + k$ and multiply back out to check all three terms.",
    ],
    watch:
      "The number outside the bracket multiplies what you add inside, even when that number is negative.",
  },
};
export const completingSquarePrinciples: Record<string, string> = {
  "complete-square-term":
    "Multiplying out $(x + h)^2$ gives $x^2 + 2hx + h^2$: the product $hx$ appears twice, and the constant is $h^2$. So the constant that completes $x^2 + bx$ is $\\left(\\frac{b}{2}\\right)^2$.",
  "complete-square-monic":
    "Adding and subtracting the same number adds 0, so $x^2 + bx + c = \\left(x + \\frac{b}{2}\\right)^2 + c - \\frac{b^2}{4}$ for every $x$.",
  "complete-square-nonmonic":
    "A number outside a bracket multiplies every term inside, including the constant added to complete the square. So $ax^2 + bx + c = a\\left(x + \\frac{b}{2a}\\right)^2 + c - \\frac{b^2}{4a}$ when $a \\ne 0$.",
};
