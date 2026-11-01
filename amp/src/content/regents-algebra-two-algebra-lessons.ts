import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const r2aSenses = {
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  products: "product-multiply",
  term: "term-expression",
  terms: "term-expression",
  side: "side-of-equation",
  sides: "side-of-equation",
  square: "square-number",
  squared: "square-number",
  degree: "degree-polynomial",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};
const r2aNoLink = [
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
  "opposite",
  "opposites",
  "unit",
  "units",
  "average",
  "decreasing",
  "increasing",
  "model",
  "models",
  "pattern",
  "patterns",
];

export const regentsAlgebraTwoAlgebraMethods: Record<string, ProblemMethod> = {
  "nonmonic-complex-quadratic": {
    goal: "Use the quadratic formula when $a\\ne1$ and the discriminant is negative, and write the solutions with $i$.",
    intuition:
      "A quadratic with a negative discriminant has no real solutions. The quadratic formula still gives two solutions, written with $i=\\sqrt{-1}$, and the denominator is $2a$ even when $a$ is not 1.",
    terms: [
      "discriminant",
      [
        "complex-number",
        "A nonreal solution has $b\\ne0$, so it contains $i$.",
      ],
    ],
    method: [
      "Write the equation as $ax^2+bx+c=0$ and read $a$, $b$, $c$.",
      "Find $b^2-4ac$. A negative value means the solutions contain $i$.",
      "Substitute: $x=\\dfrac{-b\\pm i\\sqrt{4ac-b^2}}{2a}$, and simplify the radical if it has a square factor.",
    ],
    watch:
      "The denominator is $2a$, not $a$. The first term is $-b$, so change the sign of $b$.",
  },
  "inverse-exponential-root": {
    goal: "Swap $x$ and $y$ and solve for $y$ to write the inverse of an exponential, or recover $f$ from a cube-root inverse.",
    senses: { rule: "rule", side: "side-of-equation", base: "base-exponent" },
    noLink: ["inverse", "cube", "renaming"],
    intuition:
      "An input is a number you start with, and an output is the number you get. A function is a rule that turns each input into one output. An inverse function is a function that undoes the original: it turns each output back into its input. It is written $f^{-1}$ and read “$f$ inverse”. The base is the number being raised to a power, and the exponent is the small raised number. A logarithm is the exponent that turns the base into a given number: $3^y = k$ means $y = \\log_3 k$. A cube root is the number whose three copies multiply to give what is inside: $\\sqrt[3]{8} = 2$. Cubing undoes it. To find an inverse, swap the input $x$ and the output $y$, then solve for $y$.",
    terms: ["inverse-function", "logarithm"],
    method: [
      "Write $y = f(x)$ and swap $x$ and $y$.",
      "Undo the steps in reverse order. For an exponential, get the power alone, then take the logarithm with the same base. For a cube root, first multiply away any number it is divided by, then cube both sides, meaning the left and the right of the equals sign, then add or subtract.",
      "Check with a number: apply $f$, then the inverse, and see that you return to the start.",
    ],
    watch:
      "Undo a number that multiplies the power, or is added to it, before taking the logarithm. Those numbers end up inside the logarithm, not outside.",
  },
  "circle-line-system": {
    goal: "Find where a line meets a circle centered at the origin, or decide what kind of numbers the intersections are.",
    intuition:
      "A solution of a system lies on both graphs, so it satisfies both equations. A line can cross a circle twice, touch it once, or miss it; when it misses, the algebra gives nonreal solutions.",
    terms: ["tangent-line", "rational-number"],
    method: [
      "Test or solve: substitute a variable from the line into the circle equation.",
      "For a vertical line $x=c$, the circle equation leaves a square of the $y$-part equal to a number.",
      "Classify: a positive perfect square gives rational $y$, other positive values give irrational $y$, zero gives one solution, negative gives nonreal solutions.",
    ],
    watch:
      "A point is a solution only if it satisfies both equations. A point on the circle alone is not enough.",
  },
  "rational-two-denominators": {
    goal: "Multiply by the common denominator, solve, and reject any value that makes a denominator zero.",
    intuition:
      "Multiplying an equation by its common denominator removes the fractions, but the new equation can have a root that makes an original denominator zero. Such a value cannot be a solution of the original equation.",
    terms: ["excluded-value", "extraneous-solution"],
    method: [
      "List the excluded values from every denominator.",
      "Multiply both sides by the common denominator and simplify; this may give a quadratic.",
      "Solve, then discard any root that equals an excluded value.",
    ],
    watch:
      "Check every root against the excluded values before you finish; a rational equation can lose one of two roots.",
  },
  "trinomial-product": {
    goal: "Multiply two three-term expressions term by term, then combine the terms with the same power of $x$.",
    intuition:
      "An expression is a calculation written with numbers and letters. In $x^2 + x + 1$, the parts joined by $+$ or $-$ are called terms, and an expression with three terms is called a trinomial. To multiply two trinomials, multiply each term of the first by each term of the second. Each result is called a product, so that makes $3 \\times 3 = 9$ products. Products with the same power of $x$, such as $-x^3$ and $x^3$, are called like terms, and they are added. The number in front of a power of $x$ is called its coefficient. The degree is the highest power of $x$. Multiplying powers adds their exponents: $x^2 \\times x = x^3$.",
    terms: ["trinomial", "like-terms"],
    senses: r2aSenses,
    noLink: r2aNoLink,
    method: [
      "Multiply the first term of one trinomial by all three terms of the other. Repeat for the second and third terms.",
      "Group the products by power: $x^4$, $x^3$, $x^2$, $x$ and the number with no $x$. Add each group.",
      "Check by putting a small value such as $x = 1$ into the two brackets and into your answer.",
    ],
    watch:
      "The $x^2$ terms come from three different products, and the $x^3$ terms from two. It is easy to miss one.",
  },
  "cubic-quotient-remainder": {
    goal: "Divide a cubic by a linear binomial and write the quotient plus the remainder over the divisor.",
    intuition:
      "Dividing like long division gives a quotient and a remainder: $\\frac{p(x)}{d(x)}=q(x)+\\frac{R}{d(x)}$. The remainder stays over the divisor because it was never divided.",
    terms: [
      [
        "quotient",
        "Here the quotient is the polynomial $q(x)$ that results from the division.",
      ],
      [
        "remainder",
        "When a polynomial is divided by $x - r$, the remainder is a number.",
      ],
    ],
    method: [
      "Use synthetic division with the zero of the divisor: for $x+3$ use $-3$.",
      "Read the quotient coefficients and the remainder from the last row.",
      "Write $q(x)+\\dfrac{R}{x+k}$ with the remainder's sign.",
    ],
    watch:
      "Use the zero of the divisor, which has the opposite sign of the constant in it.",
  },
  "powers-of-i-sum": {
    goal: "Reduce each power of $i$ using the four-step cycle and collect real and imaginary parts.",
    intuition:
      "The powers of $i$ repeat in a cycle of four: $i,-1,-i,1$. Divide the exponent by 4 and use the remainder to replace each power, then add like terms.",
    terms: ["imaginary-unit", "real-part"],
    method: [
      "Reduce each exponent: remainder 0 gives 1, 1 gives $i$, 2 gives $-1$, 3 gives $-i$.",
      "Multiply by each term's coefficient and collect real terms and terms with $i$.",
      "Write the result as a real part plus an imaginary part.",
    ],
    watch:
      "$i^2=-1$ and $i^3=-i$. Both signs are negative, which is where most slips happen.",
  },
  "two-radical-equation": {
    goal: "Solve an equation with two square roots by isolating and squaring twice, then test every candidate.",
    intuition:
      "Squaring removes a square root but can create solutions that do not fit the original equation. With two radicals you square twice, so you must check each candidate in the original equation.",
    terms: ["radicand", "extraneous-solution"],
    method: [
      "Isolate one radical and square both sides, expanding the square of the right side carefully.",
      "Isolate the remaining radical, square again and solve the resulting quadratic.",
      "Substitute each candidate into the original equation and keep only those that work.",
    ],
    watch:
      "$(c+\\sqrt{u})^2=c^2+2c\\sqrt{u}+u$, not $c^2+u$. A candidate that makes a radicand negative fails.",
  },
  "absolute-value-linear": {
    goal: "Solve $|x - p| = qx + r$ in two cases, and keep only the answers that make the original equation true.",
    intuition:
      "The absolute value $|u|$ is the distance of $u$ from 0, so it is never negative: $|3| = 3$ and $|-3| = 3$. So $|u| = w$ means $u = w$ or $u = -w$, and $w$ must be 0 or more. That splits the equation into two cases. An equation has two sides: the parts left and right of the equals sign. Each case usually gives an answer, but an answer can fail if it makes the right side negative. An answer that comes out of the work but does not fit the original equation is called extraneous. Extraneous answers often appear after squaring, which means multiplying something by itself.",
    terms: ["absolute-value", "extraneous-solution"],
    senses: r2aSenses,
    noLink: r2aNoLink,
    method: [
      "Case 1: set what is inside the bars equal to the right side. Case 2: set it equal to the opposite of the whole right side.",
      "Solve each case.",
      "Put each answer into the original equation. The right side must not be negative.",
    ],
    watch:
      "An absolute value can never equal a negative number, one less than 0. So check both answers in the original equation.",
  },
  "shifted-trinomial-factor": {
    goal: "Factor a three-term expression written with $x - k$, then write its factors using $x$.",
    intuition:
      "In $(x - 4)^2 - 5(x - 4) - 14$, the bracket $x - 4$ appears twice. Calling it $u$ turns the expression into $u^2 - 5u - 14$, where $u^2$ means $u$ times $u$. An expression like this is called a quadratic. Factoring means writing it as parts multiplied together, called factors. Factor it as usual: find two numbers that multiply to $-14$ and add to $-5$. Then put $x - 4$ back in place of $u$ and combine the numbers in each bracket. A product is the result of multiplying.",
    terms: [
      [
        "substitute",
        "Here a repeated expression is replaced by one letter, such as $u = x + 1$, to show the structure.",
      ],
      "factor-number",
    ],
    senses: r2aSenses,
    noLink: r2aNoLink,
    method: [
      "Let $u$ stand for the repeated bracket.",
      "Factor the expression in $u$: find two numbers that multiply to the last number and add to the middle one.",
      "Put the whole bracket back in place of $u$, and combine the numbers in each factor.",
    ],
    watch:
      "Replace $u$ with the whole bracket, not just $x$. If a number multiplies $u$, it multiplies the shift too.",
  },
  "rational-exponent-product": {
    goal: "Write roots as rational exponents and combine powers of one variable by adding and subtracting exponents.",
    intuition:
      "A cube root is the exponent $\\frac13$. Multiplying powers of the same variable adds exponents and dividing subtracts them, so a root, a product and a quotient can all be written as one power.",
    terms: ["rational-exponent", "perfect-cube"],
    method: [
      "Rewrite each radical as a power: $\\sqrt[3]{a}=a^{1/3}$ and $\\sqrt[3]{d^3x^m}=d\\,x^{m/3}$.",
      "Multiply: add exponents of the same base. Divide: subtract exponents. Multiply coefficients separately.",
      "Use a common denominator when adding fractions.",
    ],
    watch:
      "Add exponents when multiplying powers; do not multiply them. The cube root of a coefficient is taken separately.",
  },
};

export const regentsAlgebraTwoAlgebraPrinciples: Record<string, string> = {
  "nonmonic-complex-quadratic":
    "For $ax^2+bx+c=0$ with $a\\ne0$, $x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$. If $b^2-4ac<0$, the solutions are $\\dfrac{-b\\pm i\\sqrt{4ac-b^2}}{2a}$, a conjugate pair.",
  "inverse-exponential-root":
    "If $f$ is one-to-one with inverse $f^{-1}$, then $f^{-1}(f(x))=x$. For $b>0$, $b\\ne1$, $y=b^x$ has inverse $\\log_b x$. The inverse of $y=\\sqrt[3]{x}$ is $y=x^3$.",
  "circle-line-system":
    "A solution of a system satisfies every equation. Substituting a line into $x^2+y^2=r^2$ gives a quadratic with 2, 1 or 0 real solutions, as its discriminant is positive, zero or negative.",
  "rational-two-denominators":
    "Multiplying both sides by a nonzero common denominator gives an equivalent equation only for $x$ values that keep every denominator nonzero. Roots that make a denominator zero are rejected.",
  "trinomial-product":
    "By the distributive property, each of the three terms of one bracket multiplies each of the three terms of the other, giving nine products. Like terms are then added. The product of two quadratics has degree 4.",
  "cubic-quotient-remainder":
    "For a polynomial $p$ and divisor $x-c$, $p(x)=(x-c)q(x)+p(c)$, so $\\dfrac{p(x)}{x-c}=q(x)+\\dfrac{p(c)}{x-c}$ for $x\\ne c$.",
  "powers-of-i-sum":
    "$i^2=-1$, so $i^{n}$ depends only on $n$ modulo 4: $i^0=1$, $i^1=i$, $i^2=-1$, $i^3=-i$.",
  "two-radical-equation":
    "If $u=v$ then $u^2=v^2$, but not conversely. Every solution of the original equation is a root of the squared equation, so candidates must be checked in the original.",
  "absolute-value-linear":
    "$|u| = w$ is true exactly when $w \\ge 0$ and either $u = w$ or $u = -w$. An answer from either case that makes $w < 0$ is rejected.",
  "shifted-trinomial-factor":
    "If $u$ stands for $x - k$, then any factoring of $Au^2 + Bu + C$ in $u$ becomes a factoring in $x$ when $x - k$ is put back in place of $u$.",
  "rational-exponent-product":
    "For $a>0$, $a^{m}a^{n}=a^{m+n}$, $a^{m}/a^{n}=a^{m-n}$ and $\\sqrt[n]{a}=a^{1/n}$. For $d>0$, $\\sqrt[3]{d^3x^m}=d\\,x^{m/3}$.",
};

export const regentsAlgebraTwoAlgebraLessons = [
  chainLesson({
    id: "regents-nonmonic-complex-quadratic",
    title: "Nonreal solutions of a non-monic quadratic",
    summary:
      "Use the quadratic formula on $ax^2+bx+c=0$ with a negative discriminant.",
    templateIds: ["nonmonic-complex-quadratic"],
    objectives: [
      "Read $a$, $b$, $c$ and find the discriminant.",
      "Write the solutions with $i$ over $2a$ and a simplified radical.",
    ],
    openingTitle: "A negative discriminant gives imaginary solutions",
    opening: [
      "The quadratic formula gives $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$. When $b^2-4ac$ is negative, the square root is of a negative number, so the solutions contain $i=\\sqrt{-1}$ and are not real.",
      "When $a$ is not 1, the denominator is $2a$ for both terms.",
    ],
    example: {
      prompt: "Solve $3x^2+2x+1=0$.",
      steps: [
        "$a=3$, $b=2$, $c=1$, so $b^2-4ac=4-12=-8$.",
        "$x=\\frac{-2\\pm\\sqrt{-8}}{6}=\\frac{-2\\pm2i\\sqrt2}{6}=\\frac{-1\\pm i\\sqrt2}{3}$.",
      ],
      answer: "$x=\\dfrac{-1\\pm i\\sqrt2}{3}$",
    },
    methodTitle: "Discriminant first",
    method: [
      "Compute $b^2-4ac$ and check its sign.",
      "Write $\\sqrt{-n}=i\\sqrt{n}$.",
      "Reduce common factors in the whole fraction.",
    ],
    formalTitle: "The formula",
    formal: [
      "Completing the square on $ax^2+bx+c=0$ gives $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$ for $a\\ne0$.",
      "For real $a,b,c$ and a negative discriminant, the two solutions are complex conjugates.",
    ],
    pitfalls: [
      "The denominator is $2a$, not $a$.",
      "Use $-b$, so a positive $b$ gives a negative first term.",
      "The radicand under $i\\sqrt{\\ }$ is $4ac-b^2$.",
    ],
    parentGuide:
      "Ask your learner to compute the discriminant before anything else and say what its sign means.",
  }),
  chainLesson({
    id: "regents-inverse-exponential-root",
    title: "Inverses of exponentials and cube roots",
    summary:
      "A function is a rule that turns each input, the number you start with, into one output, the number you get. An inverse function is a function that undoes another function. If $f$ turns 2 into 18, its inverse turns 18 back into 2. It is written $f^{-1}$, read “$f$ inverse”: here the raised $-1$ is a label, not a power. A logarithm is an exponent, and it undoes a power. A cube root is the number whose three copies multiply to give what is inside. Cubing undoes a cube root. So the inverse of $2 \\cdot 3^x$ is a logarithm, and the inverse of a cube root is a cube.",
    senses: { rule: "rule", base: "base-exponent", side: "side-of-equation" },
    noLink: ["inverse", "cube"],
    templateIds: ["inverse-exponential-root"],
    objectives: [
      "Find the inverse of functions like $3^x$, $2 \\cdot 3^x$ and $3^x + 4$ by swapping $x$ and $y$, then solving for $y$.",
      "Recover the original function from an inverse that contains a cube root: the number whose three copies multiply to give what is inside.",
    ],
    openingTitle: "Swap, then undo in reverse",
    opening: [
      "A function is a rule that turns each input $x$ into one output $y$. We write $y = f(x)$, read “$y$ equals $f$ of $x$”. An inverse function runs the rule backward: it turns each output back into its input. In $2 \\cdot 3^x$, the dot means times.",
      "To find an inverse, write $y = f(x)$, then swap the letters $x$ and $y$. Swapping trades the roles of input and output. Then solve for $y$ by undoing the steps in reverse order, the last step first.",
      "The base is the number being raised to a power. A logarithm undoes a power. $\\log_3 k$, read “log base 3 of $k$”, is the exponent that turns 3 into $k$, so $3^y = k$ means $y = \\log_3 k$. A cube root undoes cubing: $\\sqrt[3]{8} = 2$, because $2^3 = 2 \\times 2 \\times 2 = 8$. Cubing undoes a cube root in the same way.",
    ],
    example: {
      prompt: "Find the inverse of $f(x)=2\\cdot3^{x}$.",
      steps: [
        "Write $y = 2 \\cdot 3^x$, then swap $x$ and $y$: $x = 2 \\cdot 3^y$. Now $y$ is the unknown to solve for.",
        "Get the power alone. The 2 multiplies $3^y$, so divide both sides, the left and the right of the equals sign, by 2: $3^y = \\tfrac{x}{2}$.",
        "A logarithm with the same base undoes the power: $3^y = \\tfrac{x}{2}$ means $y = \\log_3\\left(\\tfrac{x}{2}\\right)$.",
        "Check with a number. $f(2) = 2 \\cdot 3^2 = 18$. The inverse at 18 gives $\\log_3 9 = 2$, which is back where we started.",
      ],
      answer: "$f^{-1}(x)=\\log_3\\left(\\frac x2\\right)$",
    },
    methodTitle: "Isolate the power, then the logarithm",
    method: [
      "Swap $x$ and $y$.",
      "Divide or subtract so the power stands alone, undoing the last step first.",
      "Apply the logarithm with the same base as the power. For a cube root, multiply away any number it is divided by, then cube both sides instead.",
    ],
    formalTitle: "Definition",
    formal: [
      "If $y = b^x$ with $b > 0$ and $b \\neq 1$ ($\\neq$ means is not equal to), then $x = \\log_b y$. So the inverse of $b^x$ is $\\log_b x$, defined for $x > 0$.",
      "A function has an inverse function when it is one-to-one: no two inputs give the same output.",
    ],
    pitfalls: [
      "A number that multiplies the power, or is added to it, is undone first, so it ends up inside the logarithm.",
      "$\\log_b\\left(\\tfrac{x}{a}\\right)$ is not the same as $\\tfrac{\\log_b x}{a}$.",
    ],
    parentGuide:
      "Have your learner test the answer with a number: apply $f$, then the inverse, and see whether the starting number comes back.",
  }),
  chainLesson({
    id: "regents-circle-line-system",
    title: "A circle and a line",
    summary:
      "Find the points where a line meets a circle, or say what kind of numbers they are.",
    templateIds: ["circle-line-system"],
    objectives: [
      "Check candidate points in both equations of a circle-and-line system.",
      "Classify the solutions of a circle and a vertical line using the value under the root.",
    ],
    openingTitle: "A solution lies on both graphs",
    opening: [
      "A circle $x^2+y^2=r^2$ and a line can meet at two points, one point or none. A solution is a point that satisfies both equations.",
      "For a vertical line $x=c$, substituting leaves $y^2=r^2-c^2$ (for a circle at the origin). The sign and type of $r^2-c^2$ decide the kind of solutions.",
    ],
    example: {
      prompt: "Does the line $x+y=7$ meet $x^2+y^2=25$ at $(3,4)$?",
      steps: [
        "On the circle: $9+16=25$.",
        "On the line: $3+4=7$.",
        "Both hold, so $(3,4)$ is a solution.",
      ],
      answer: "Yes",
    },
    methodTitle: "Substitute and classify",
    method: [
      "Substitute a point into both equations.",
      "Or substitute a variable of the line into the circle and solve the quadratic.",
      "Look at the discriminant or the value under the root.",
    ],
    formalTitle: "Counting solutions",
    formal: [
      "Substituting a line into a circle gives a quadratic. Its discriminant is positive for 2 intersections, zero for tangency and negative for none.",
      "A positive perfect square under the root gives rational coordinates when the other numbers are rational.",
    ],
    pitfalls: [
      "A point on the circle but not on the line is not a solution.",
      "A negative value under the root means nonreal solutions, not 'no solution' in the complex numbers.",
    ],
    parentGuide: "Ask which equation each point has been tested in.",
  }),
  chainLesson({
    id: "regents-rational-two-denominators",
    title: "Rational equations with an extraneous root",
    summary:
      "Clear two denominators, solve the quadratic and reject the excluded value.",
    templateIds: ["rational-two-denominators"],
    objectives: [
      "List excluded values from each denominator.",
      "Clear fractions, solve, and reject a root that is excluded.",
    ],
    openingTitle: "Clearing denominators can add a root",
    opening: [
      "Multiplying both sides of an equation by an expression that can be zero may bring in a root that does not belong. A denominator can never be zero.",
      "So before solving, list the values of $x$ that make a denominator zero. Afterwards, throw out any root on that list.",
    ],
    example: {
      prompt: "Solve $\\frac{x}{x+1}-\\frac{2}{x-3}=\\frac{-8}{(x+1)(x-3)}$.",
      steps: [
        "Excluded: $x=-1$ and $x=3$.",
        "Multiply by $(x+1)(x-3)$: $x(x-3)-2(x+1)=-8$.",
        "$x^2-5x+6=0$, so $x=2$ or $x=3$.",
        "$x=3$ is excluded, so $x=2$.",
      ],
      answer: "$x=2$",
    },
    methodTitle: "Exclude, clear, solve, check",
    method: [
      "Write the excluded values.",
      "Multiply every term by the common denominator.",
      "Solve and compare roots with the excluded values.",
    ],
    formalTitle: "Why roots are rejected",
    formal: [
      "A fraction $\\frac{A}{B}$ is defined only for $B\\ne0$, so the domain of the equation excludes zeros of every denominator.",
      "The cleared equation is equivalent to the original only on the domain.",
    ],
    pitfalls: [
      "Check roots against excluded values, not only by solving.",
      "Multiply every term, including the right side.",
    ],
    parentGuide:
      "Ask your learner which values make a denominator zero before they solve anything.",
  }),
  {
    ...chainLesson({
      id: "regents-trinomial-product",
      title: "Multiplying trinomials",
      summary:
        "An expression is a calculation written with numbers and letters. One with three parts joined by $+$ or $-$, like $x^2 + x + 1$, is called a trinomial. To multiply two of them, multiply each part of the first by each part of the second. Each result is called a product, so that makes nine products. Then add the ones with the same power of $x$.",
      templateIds: ["trinomial-product"],
      objectives: [
        "Multiply each term of one trinomial by each term of the other.",
        "Combine like terms and write the answer from the highest power down.",
      ],
      openingTitle: "Nine products, five powers",
      opening: [
        "The parts of an expression joined by $+$ or $-$ are called terms. Each keeps the sign in front of it, so $x^2 - x + 2$ has the terms $x^2$, $-x$ and 2.",
        "Multiplying a sum by something multiplies each of its terms. This is the distributive property. So each term of the first trinomial multiplies each term of the second, and two trinomials give $3 \\times 3 = 9$ products.",
        "To multiply powers of $x$, add the exponents (the small raised numbers): $x^2 \\times x^2 = x^4$ and $x^2 \\times x = x^3$.",
        "Products with the same power of $x$ are called like terms. Adding them gives the number in front of $x^4$, $x^3$, $x^2$ and $x$, and the number with no $x$.",
      ],
      example: {
        prompt: "Multiply $(x^2+x+1)(x^2-x+2)$.",
        steps: [
          "Multiply $x^2$ by each term of the second trinomial: $x^4 - x^3 + 2x^2$. Multiply $x$ by each: $x^3 - x^2 + 2x$. Multiply 1 by each: $x^2 - x + 2$.",
          "Add like terms. $x^4$: just $x^4$. $x^3$: $-x^3 + x^3 = 0$. $x^2$: $2x^2 - x^2 + x^2 = 2x^2$. $x$: $2x - x = x$. Numbers: 2.",
          "The product is $x^4 + 2x^2 + x + 2$. Check with $x = 1$: the two brackets give $3 \\times 2 = 6$, and the answer gives $1 + 2 + 1 + 2 = 6$.",
        ],
        answer: "$x^4+2x^2+x+2$",
      },
      methodTitle: "Organize by power",
      method: [
        "Multiply the first term by all three terms, then the second, then the third.",
        "Group the products by exponent and add their coefficients (the numbers in front).",
        "Check with $x = 1$: the two brackets multiplied should equal the sum of the answer's coefficients.",
      ],
      formalTitle: "Degree and check",
      formal: [
        "The degree is the highest power of $x$ in a polynomial. The degree of a product is the sum of the degrees: $2 + 2 = 4$.",
        "At $x = 1$, every power of $x$ is 1. So the value of the product there is the sum of its coefficients.",
      ],
      pitfalls: [
        "The $x^2$ terms come from three products. Find all three.",
        "Do not multiply only the matching terms, such as first by first.",
      ],
      parentGuide:
        "Ask your learner to check the result by putting $x = 1$ into both the factors and the answer.",
    }),
    senses: r2aSenses,
    noLink: r2aNoLink,
  },
  chainLesson({
    id: "regents-cubic-quotient-remainder",
    title: "Quotient plus remainder over the divisor",
    summary:
      "Divide a cubic by $x\\pm k$ and write the quotient with the remainder fraction.",
    templateIds: ["cubic-quotient-remainder"],
    objectives: [
      "Use synthetic division with the zero of the divisor.",
      "Write $q(x)+\\frac{R}{x+k}$ with the right signs.",
    ],
    openingTitle: "A remainder is still divided",
    opening: [
      "When a polynomial does not divide evenly, the division leaves a remainder. Like $7\\div2=3+\\frac12$, the remainder is written over the divisor.",
      "Synthetic division is a short way to divide by $x-c$: use the zero $c$ of the divisor.",
    ],
    example: {
      prompt:
        "Write $\\frac{x^3+2x^2-x+4}{x+1}$ as a quotient plus a remainder.",
      steps: [
        "The zero of $x+1$ is $-1$. Bring down 1; $2-1=1$; $-1-1=-2$; $4+2=6$.",
        "Quotient $x^2+x-2$, remainder 6.",
      ],
      answer: "$x^2+x-2+\\dfrac{6}{x+1}$",
    },
    methodTitle: "Synthetic division",
    method: [
      "Use the zero of the divisor.",
      "Read quotient coefficients, and the last number as the remainder.",
      "Write the remainder over the divisor.",
    ],
    formalTitle: "The remainder theorem",
    formal: [
      "Dividing by $x-c$ gives $p(x)=(x-c)q(x)+p(c)$.",
      "So the remainder is $p(c)$, the value of the polynomial at the zero of the divisor.",
    ],
    pitfalls: [
      "Use $-1$ for $x+1$, not $1$.",
      "Do not add the remainder as a constant; keep the fraction.",
    ],
    parentGuide:
      "Ask your learner to check by multiplying the quotient by the divisor and adding the remainder.",
  }),
  chainLesson({
    id: "regents-powers-of-i-sum",
    title: "Sums of imaginary powers",
    summary:
      "Reduce powers of $i$ and collect real and imaginary parts with letters as coefficients.",
    templateIds: ["powers-of-i-sum"],
    objectives: [
      "Reduce $i^n$ using the cycle of four.",
      "Collect real and imaginary parts when coefficients contain a letter.",
    ],
    openingTitle: "The powers repeat every four",
    opening: [
      "The imaginary unit $i$ satisfies $i^2=-1$. Then $i^3=-i$, $i^4=1$, and the pattern repeats: $i,-1,-i,1$.",
      "To reduce $i^n$, divide $n$ by 4 and use the remainder: 0 gives 1, 1 gives $i$, 2 gives $-1$, 3 gives $-i$.",
    ],
    example: {
      prompt: "Simplify $3xi^{6}+2i^{7}-xi^{4}$.",
      steps: ["$i^6=-1$, $i^7=-i$, $i^4=1$.", "$-3x-2i-x=-4x-2i$."],
      answer: "$-4x-2i$",
    },
    methodTitle: "Reduce, multiply, collect",
    method: [
      "Reduce each power.",
      "Multiply by the coefficient.",
      "Add real terms together and terms with $i$ together.",
    ],
    formalTitle: "Why four",
    formal: [
      "$i^4=1$, so $i^{n+4}=i^n$ for every integer $n$.",
      "Letters representing real numbers combine like ordinary variables; the form $A+Bi$ has $A$ and $B$ real.",
    ],
    pitfalls: [
      "$i^2=-1$, not $1$.",
      "$i^3=-i$, not $i$.",
      "Terms with $x$ and terms without $x$ do not combine.",
    ],
    parentGuide:
      "Ask your learner to write the four-step cycle before reducing.",
  }),
  chainLesson({
    id: "regents-two-radical-equation",
    title: "Two square roots and an extraneous solution",
    summary:
      "Isolate and square twice, then test candidates in the original equation.",
    templateIds: ["two-radical-equation"],
    objectives: [
      "Square an equation with two radicals twice without dropping the middle term.",
      "Reject a candidate that does not satisfy the original equation.",
    ],
    openingTitle: "Squaring can add false solutions",
    opening: [
      "A square root is removed by squaring. With two radicals, one squaring leaves one radical, so you isolate it and square again.",
      "Squaring can create candidates that fail the original equation, so test each one.",
    ],
    example: {
      prompt: "Solve $\\sqrt{x+9}-\\sqrt{x}=1$.",
      steps: [
        "$\\sqrt{x+9}=1+\\sqrt x$; square: $x+9=1+2\\sqrt x+x$, so $\\sqrt x=4$.",
        "$x=16$. Check: $\\sqrt{25}-\\sqrt{16}=1$.",
      ],
      answer: "$x=16$",
    },
    methodTitle: "Isolate, square, repeat, check",
    method: [
      "Isolate one radical.",
      "Square both sides, keeping the middle term of the square of a sum.",
      "Repeat, solve, and check each candidate in the original equation.",
    ],
    formalTitle: "Why checking is required",
    formal: [
      "If $A=B$ then $A^2=B^2$, but $A^2=B^2$ also holds when $A=-B$.",
      "A candidate that makes a radicand negative is outside the domain.",
    ],
    pitfalls: [
      "$(1+\\sqrt x)^2$ has a middle term $2\\sqrt x$.",
      "Always substitute into the original equation, not the squared one.",
    ],
    parentGuide:
      "Ask your learner to write the check for every candidate, even the one they believe is right.",
  }),
  {
    ...chainLesson({
      id: "regents-absolute-value-linear",
      title: "Absolute value equal to a linear function",
      summary:
        "The absolute value of a number is its distance from 0, written with bars: $|-5| = 5$ and $|5| = 5$. A distance is never negative. So when $|x - 1|$ equals something, the inside is either that something or its opposite. An equation has two sides: the parts left and right of the equals sign. Solve both cases, then check each answer, because one may make the other side negative.",
      templateIds: ["absolute-value-linear"],
      objectives: [
        "Split an absolute-value equation into two cases.",
        "Reject a case answer that makes the right side negative.",
      ],
      openingTitle: "Two cases, then check",
      opening: [
        "The absolute value $|u|$ is the distance of $u$ from 0, so it is never negative. Both 3 and $-3$ are 3 away from 0.",
        "So $|u| = w$ means $u = w$ or $u = -w$. And $w$ must be 0 or more, because a distance cannot be negative.",
        "In this lesson, the right side is a straight-line expression in $x$, like $2x - 4$. Each case usually gives one answer. But an answer can make the right side negative, and then it does not work.",
        "An answer that comes out of the steps but does not make the original equation true is called extraneous. It is thrown away.",
      ],
      example: {
        prompt: "Solve $|x-1|=2x-4$.",
        steps: [
          "Case 1, the inside equals the right side: $x - 1 = 2x - 4$. Subtract $x$ from both sides and add 4: $x = 3$.",
          "Case 2, the inside equals the opposite of the whole right side: $x - 1 = -(2x - 4) = -2x + 4$. Add $2x$ and 1 to both sides: $3x = 5$, so $x = \\frac{5}{3}$.",
          "Check $x = 3$: the left side is $|3 - 1| = 2$ and the right side is $6 - 4 = 2$. They match, so 3 works.",
          "Check $x = \\frac{5}{3}$: the left side is $\\left|\\frac{2}{3}\\right| = \\frac{2}{3}$, but the right side is $\\frac{10}{3} - 4 = -\\frac{2}{3}$. A distance cannot be negative, so $\\frac{5}{3}$ is extraneous.",
        ],
        answer: "$x=3$",
      },
      methodTitle: "Cases, solve, check",
      method: [
        "Write both cases: inside = right side, and inside = the opposite of the right side.",
        "Solve each case.",
        "Put each answer into the original equation, and keep only those that make it true.",
      ],
      formalTitle: "The condition",
      formal: [
        "$|u| = w$ is true exactly when $w \\ge 0$ and either $u = w$ or $u = -w$. Here $\\ge$ means greater than or equal to.",
        "So an answer from either case is valid only if $w \\ge 0$ at that value of $x$.",
      ],
      pitfalls: [
        "Do not skip the check. One case often gives an extraneous answer.",
        "In Case 2, take the opposite of the whole right side, not just its first term (its first part).",
      ],
      parentGuide:
        "Ask your learner whether the right side is negative at each answer, and what that means.",
    }),
    senses: r2aSenses,
    noLink: r2aNoLink,
  },
  {
    ...chainLesson({
      id: "regents-shifted-trinomial-factor",
      title: "Factoring in terms of a binomial",
      summary:
        "In $(x - 4)^2 - 5(x - 4) - 14$, the bracket $x - 4$ shows up twice. Give it a nickname, $u$, and the expression becomes $u^2 - 5u - 14$, which is easier to factor, or write as parts multiplied together. Factoring means writing it as parts multiplied together: $(u - 7)(u + 2)$. Then put $x - 4$ back in place of $u$ and tidy up.",
      templateIds: ["shifted-trinomial-factor"],
      objectives: [
        "Name the repeated bracket $u$, and factor the expression in $u$.",
        "Put the bracket back in place of $u$, and simplify each factor.",
      ],
      openingTitle: "See the binomial as one thing",
      opening: [
        "A two-term expression like $x - 4$ is called a binomial. In $(x - 4)^2 - 5(x - 4) - 14$, it appears twice. Calling it $u$ turns the expression into $u^2 - 5u - 14$. Here $u^2$ means $u$ times $u$, and $5u$ means 5 times $u$.",
        "To factor $u^2 - 5u - 14$, find two numbers that multiply to $-14$ and add to $-5$. They are $-7$ and 2. So $u^2 - 5u - 14 = (u - 7)(u + 2)$. The parts being multiplied, $u - 7$ and $u + 2$, are called factors.",
        "Then put $x - 4$ back in place of $u$ in each factor, and combine the numbers.",
      ],
      example: {
        prompt: "Factor $(x-4)^2-5(x-4)-14$.",
        steps: [
          "Let $u = x - 4$. The expression becomes $u^2 - 5u - 14$. The numbers $-7$ and 2 multiply to $-14$ and add to $-5$, so it factors as $(u - 7)(u + 2)$.",
          "Put $x - 4$ back in place of $u$: $(x - 4 - 7)(x - 4 + 2)$. Combine the numbers in each bracket: $(x - 11)(x - 2)$.",
        ],
        answer: "$(x-11)(x-2)$",
      },
      methodTitle: "Substitute, factor, substitute back",
      method: [
        "Let $u$ stand for the repeated bracket.",
        "Factor in $u$: find two numbers with the right product (the result of multiplying) and sum.",
        "Put the whole bracket back in place of $u$, and simplify each factor.",
      ],
      formalTitle: "Why it works",
      formal: [
        "An equation that is true for every value of $u$ stays true when $u$ is replaced by any expression, here $x - 4$.",
        "For a factor $pu + q$, putting $u = x - k$ gives $p(x - k) + q = px + (q - pk)$. So the number in the factor becomes $q - pk$.",
      ],
      pitfalls: [
        "Replace $u$ with the whole bracket, not just $x$.",
        "If a number multiplies $u$, multiply it by the shift too: $2u$ becomes $2(x - 4) = 2x - 8$.",
      ],
      parentGuide:
        "Ask your learner to check the answer by multiplying the two factors back out and comparing with the original.",
    }),
    senses: r2aSenses,
    noLink: r2aNoLink,
  },
  chainLesson({
    id: "regents-rational-exponent-product",
    title: "Roots and powers as one exponent",
    summary:
      "Combine a cube root, powers and a quotient into one power, or take a perfect-cube coefficient out of a radical.",
    templateIds: ["rational-exponent-product"],
    objectives: [
      "Write a cube root as the exponent $\\frac13$ and combine exponents of one variable.",
      "Take the cube root of a perfect-cube coefficient separately from the variable part.",
    ],
    openingTitle: "A root is a fractional exponent",
    opening: [
      "A cube root is the exponent $\\frac13$: $\\sqrt[3]{a}=a^{1/3}$. Multiplying powers of the same base adds exponents; dividing subtracts them.",
      "So a root, a product and a quotient of powers of $a$ can be combined into a single power by adding and subtracting fractions.",
    ],
    example: {
      prompt: "Simplify $3x\\sqrt[3]{8x^{4}}$.",
      steps: [
        "$\\sqrt[3]{8x^4}=2x^{4/3}$.",
        "Coefficient: $3\\cdot2=6$. Exponent: $1+\\frac43=\\frac73$.",
      ],
      answer: "$6x^{7/3}$",
    },
    methodTitle: "Convert, then add exponents",
    method: [
      "Write each radical as a power.",
      "Take cube roots of cube coefficients.",
      "Combine exponents with a common denominator.",
    ],
    formalTitle: "The laws",
    formal: [
      "For $a>0$: $a^ma^n=a^{m+n}$, $a^m/a^n=a^{m-n}$, $a^{1/n}=\\sqrt[n]{a}$.",
      "$\\sqrt[3]{d^3x^m}=d\\,x^{m/3}$ for $d>0$ and $x>0$.",
    ],
    pitfalls: [
      "Exponents add when multiplying; they do not multiply.",
      "Take the root of the coefficient too.",
    ],
    parentGuide:
      "Ask your learner to write the exponent sum with a common denominator.",
  }),
];

const m = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({ templateId, facetId, extent: "partial", rationale });
export const regentsAlgebraTwoAlgebraFacetMappings: FacetMapping[] = [
  m(
    "nonmonic-complex-quadratic",
    "complex-numbers.HSN.CN.C.7",
    "Single choice for quadratics with $a=2,3,5$ and a negative discriminant whose radicand has no square factor, in zero-right and constant-right arrangements. Does not assess completing the square, perfect-square discriminants, or checking solutions.",
  ),
  m(
    "inverse-exponential-root",
    "inverse-functions.core",
    "Single choice for the logarithmic inverse of $b^x$, $a\\cdot b^x$ and $b^x+k$, and for the function whose inverse is a scaled cube root of a linear expression. Does not assess domain and range, composition checks, or graphing.",
  ),
  m(
    "circle-line-system",
    "nonlinear-systems.HSA.REI.C.7",
    "Single choice for lattice-point intersections of a circle at the origin with a line, and for classifying the solutions of a circle and a vertical line. Does not assess solving by hand with non-integer intersections, a parabola, or graphing.",
  ),
  m(
    "rational-two-denominators",
    "rational-equations.core",
    "Single choice for a rational equation with two linear denominators whose cleared quadratic has one valid root and one excluded root. Does not assess equations with no extraneous root, three denominators, or applications.",
  ),
  m(
    "trinomial-product",
    "polynomial-arithmetic.core",
    "Single choice for a product of two quadratic trinomials or the square of one, with small integer coefficients. Does not assess higher degrees, special products by name, or area models.",
  ),
  m(
    "cubic-quotient-remainder",
    "polynomial-division.divide-by-linear",
    "Single choice for a cubic divided by $x\\pm k$ with $k\\le3$, quotient plus remainder over the divisor. Does not assess long division by a quadratic, the remainder theorem stated in words, or zero remainders.",
  ),
  m(
    "powers-of-i-sum",
    "complex-numbers.HSN.CN.A.1",
    "Single choice for sums of three or four terms with a letter or integer coefficient and powers of $i$ up to 11. Does not assess products of complex numbers, conjugates, or division.",
  ),
  m(
    "two-radical-equation",
    "radical-equations.core",
    "Numeric entry for an equation $\\sqrt{px+a}-\\sqrt{x+b}=c$ with $p=2$ to $5$, a single valid integer solution and one extraneous integer candidate. Does not assess the written solution, no-solution cases, or cube roots.",
  ),
  m(
    "absolute-value-linear",
    "absolute-value-equations.affine-solution-set",
    "Single choice for $|x-p|=qx+r$ with integer solutions from both cases and either both valid or one extraneous. Does not assess graphing the functions, inequalities, or non-integer solutions.",
  ),
  m(
    "shifted-trinomial-factor",
    "expression-structure.rewrite-by-structure",
    "Single choice for factoring a monic or non-monic trinomial in $x-k$ into binomials in $x$. Does not assess factoring by grouping, higher degrees, or complex factors.",
  ),
  m(
    "rational-exponent-product",
    "rational-exponents.core",
    "Single choice for a cube root times powers divided by a power of one variable, and for a coefficient times a power times a cube root of a perfect-cube coefficient and a power. Does not assess other roots, negative exponents, or evaluating numerically.",
  ),
];
