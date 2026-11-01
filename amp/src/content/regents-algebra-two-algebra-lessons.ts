import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

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
    senses: { side: "side-of-equation", base: "base-exponent" },
    noLink: ["inverse", "cube", "renaming"],
    intuition:
      "An inverse function undoes the original. It is written $f^{-1}$ and read “$f$ inverse”. A logarithm undoes a power: $3^y = k$ means $y = \\log_3 k$, the exponent that turns 3 into $k$. Cubing, multiplying a number by itself three times, undoes a cube root such as $\\sqrt[3]{8} = 2$. To find an inverse, swap the input $x$ and the output $y$, then solve for $y$.",
    terms: ["inverse-function", "logarithm"],
    method: [
      "Write $y = f(x)$ and swap $x$ and $y$.",
      "Undo the steps in reverse order. For an exponential, get the power alone, then take the logarithm with the same base. For a cube root, cube both sides, then add or subtract.",
      "Check with a number: apply $f$, then the inverse, and see that you return to the start.",
    ],
    watch:
      "Divide or subtract numbers before taking the logarithm. They end up inside the logarithm, not outside.",
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
    goal: "Multiply two trinomials term by term and combine terms with the same power.",
    intuition:
      "Each term of the first trinomial multiplies each term of the second, so there are nine products. Products with the same power of $x$ are like terms and are added.",
    terms: ["trinomial", "like-terms"],
    method: [
      "Multiply the first term of one trinomial by all three terms of the other, then repeat for the second and third terms.",
      "Collect like terms by power: $x^4$, $x^3$, $x^2$, $x$ and the constant.",
      "Check by substituting a small value such as $x=1$ into the factors and the product.",
    ],
    watch:
      "The $x^2$ coefficient has three products and the $x^3$ coefficient has two. It is easy to skip one.",
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
    goal: "Solve $|x-p|=qx+r$ in two cases and keep only the solutions that satisfy the original equation.",
    intuition:
      "The absolute value $|u|$ equals $u$ when $u\\ge0$ and $-u$ when $u<0$. So an equation with an absolute value splits into two cases, and each case's answer must be checked because it might not fit its own case.",
    terms: ["absolute-value", "extraneous-solution"],
    method: [
      "Case 1: set the inside equal to the right side. Case 2: set the inside equal to the opposite of the right side.",
      "Solve each case.",
      "Substitute each answer into the original equation; the right side must not be negative.",
    ],
    watch:
      "A negative right side cannot equal an absolute value, so check both answers.",
  },
  "shifted-trinomial-factor": {
    goal: "Factor a trinomial written in terms of $x-k$, then write the factors in terms of $x$.",
    intuition:
      "A trinomial such as $(x-4)^2-5(x-4)-14$ has the form $u^2-5u-14$ with $u=x-4$. Factor it as you would factor in $u$, then put $x-4$ back and simplify.",
    terms: [
      [
        "substitute",
        "Here a repeated expression is replaced by one letter, such as $u = x + 1$, to show the structure.",
      ],
      "factor-number",
    ],
    method: [
      "Let $u$ stand for the repeated binomial.",
      "Factor the trinomial in $u$, using product and sum conditions.",
      "Replace $u$ by the binomial and combine constants in each factor.",
    ],
    watch:
      "Replace $u$ by the whole binomial, not just by $x$, and with a leading coefficient multiply it over the shift.",
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
    "By the distributive law, $(a_1+a_2+a_3)(b_1+b_2+b_3)=\\sum a_ib_j$, nine products. The product of two quadratics has degree 4.",
  "cubic-quotient-remainder":
    "For a polynomial $p$ and divisor $x-c$, $p(x)=(x-c)q(x)+p(c)$, so $\\dfrac{p(x)}{x-c}=q(x)+\\dfrac{p(c)}{x-c}$ for $x\\ne c$.",
  "powers-of-i-sum":
    "$i^2=-1$, so $i^{n}$ depends only on $n$ modulo 4: $i^0=1$, $i^1=i$, $i^2=-1$, $i^3=-i$.",
  "two-radical-equation":
    "If $u=v$ then $u^2=v^2$, but not conversely. Every solution of the original equation is a root of the squared equation, so candidates must be checked in the original.",
  "absolute-value-linear":
    "$|u|=w$ holds exactly when $w\\ge0$ and ($u=w$ or $u=-w$). Solutions of the two cases that give $w<0$ are rejected.",
  "shifted-trinomial-factor":
    "If $u$ stands for $x-k$, any factoring of $Au^2+Bu+C$ in $u$ gives a factoring in $x$ after the substitution $u=x-k$.",
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
      "An inverse function undoes another function. If $f$ turns 2 into 18, its inverse turns 18 back into 2. It is written $f^{-1}$, read “$f$ inverse”: here the raised $-1$ is a label, not a power. A logarithm undoes a power, and cubing (multiplying a number by itself three times) undoes a cube root. So the inverse of $2 \\cdot 3^x$ is a logarithm, and the inverse of a cube root is a cube.",
    senses: { rule: "rule", base: "base-exponent", side: "side-of-equation" },
    noLink: ["inverse", "cube"],
    templateIds: ["inverse-exponential-root"],
    objectives: [
      "Find the inverse of functions like $3^x$, $2 \\cdot 3^x$ and $3^x + 4$ by swapping $x$ and $y$, then solving for $y$.",
      "Recover the original function from an inverse that contains a cube root: the number that, multiplied by itself three times, gives what is inside.",
    ],
    openingTitle: "Swap, then undo in reverse",
    opening: [
      "A function is a rule that turns each input $x$ into one output $y$. We write $y = f(x)$, read “$y$ equals $f$ of $x$”. An inverse function runs the rule backward: it turns each output back into its input. In $2 \\cdot 3^x$, the dot means times.",
      "To find an inverse, write $y = f(x)$, then swap the letters $x$ and $y$. Swapping trades the roles of input and output. Then solve for $y$ by undoing the steps in reverse order, the last step first.",
      "A logarithm undoes a power. $\\log_3 k$, read “log base 3 of $k$”, is the exponent that turns 3 into $k$, so $3^y = k$ means $y = \\log_3 k$. A cube root undoes cubing: $\\sqrt[3]{8} = 2$, because $2^3 = 2 \\times 2 \\times 2 = 8$. Cubing undoes a cube root in the same way.",
    ],
    example: {
      prompt: "Find the inverse of $f(x)=2\\cdot3^{x}$.",
      steps: [
        "Write $y = 2 \\cdot 3^x$, then swap $x$ and $y$: $x = 2 \\cdot 3^y$. Now $y$ is the unknown to solve for.",
        "Get the power alone. The 2 multiplies $3^y$, so divide both sides by 2: $3^y = \\tfrac{x}{2}$.",
        "A logarithm with the same base undoes the power: $3^y = \\tfrac{x}{2}$ means $y = \\log_3\\left(\\tfrac{x}{2}\\right)$.",
        "Check with a number. $f(2) = 2 \\cdot 3^2 = 18$. The inverse at 18 gives $\\log_3 9 = 2$, which is back where we started.",
      ],
      answer: "$f^{-1}(x)=\\log_3\\left(\\frac x2\\right)$",
    },
    methodTitle: "Isolate the power, then the logarithm",
    method: [
      "Swap $x$ and $y$.",
      "Divide or subtract so the power stands alone, undoing the last step first.",
      "Apply the logarithm with the same base as the power. For a cube root, cube both sides instead.",
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
  chainLesson({
    id: "regents-trinomial-product",
    title: "Multiplying trinomials",
    summary: "Multiply two three-term polynomials and combine like terms.",
    templateIds: ["trinomial-product"],
    objectives: [
      "Multiply each term of one trinomial by each term of the other.",
      "Combine like terms in standard form.",
    ],
    openingTitle: "Nine products, five powers",
    opening: [
      "The distributive law says each term of the first polynomial multiplies each term of the second. Two trinomials give nine products.",
      "Products with the same power of $x$ are like terms. Adding them gives the coefficients of $x^4$, $x^3$, $x^2$, $x$ and the constant.",
    ],
    example: {
      prompt: "Multiply $(x^2+x+1)(x^2-x+2)$.",
      steps: [
        "$x^4$: 1. $x^3$: $-1+1=0$. $x^2$: $2-1+1=2$. $x$: $2-1=1$. constant: 2.",
        "The product is $x^4+2x^2+x+2$.",
      ],
      answer: "$x^4+2x^2+x+2$",
    },
    methodTitle: "Organize by power",
    method: [
      "Multiply the first term by all terms, then the second, then the third.",
      "Group by exponent and add coefficients.",
      "Check with $x=1$: the factors multiply to the sum of the product's coefficients.",
    ],
    formalTitle: "Degree and check",
    formal: [
      "The degree of a product is the sum of the degrees: $2+2=4$.",
      "At $x=1$ the product of the factors equals the sum of the coefficients of the product.",
    ],
    pitfalls: [
      "The $x^2$ coefficient has three products.",
      "Do not multiply only the matching terms.",
    ],
    parentGuide: "Ask your learner to check the result by substituting $x=1$.",
  }),
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
  chainLesson({
    id: "regents-absolute-value-linear",
    title: "Absolute value equal to a linear function",
    summary: "Solve $|x-p|=qx+r$ in two cases and check both answers.",
    templateIds: ["absolute-value-linear"],
    objectives: [
      "Split an absolute-value equation into two cases.",
      "Reject a case answer that makes the right side negative.",
    ],
    openingTitle: "Two cases, then check",
    opening: [
      "The absolute value $|u|$ is the distance of $u$ from 0, so it is never negative. $|u|=w$ means $u=w$ or $u=-w$, and $w$ must not be negative.",
      "When the right side is a linear function, each case gives one answer, and an answer can fail if it makes the right side negative.",
    ],
    example: {
      prompt: "Solve $|x-1|=2x-4$.",
      steps: [
        "Case 1: $x-1=2x-4$, so $x=3$. Case 2: $x-1=-(2x-4)$, so $x=\\frac53$.",
        "Check $x=3$: $2=2$. Check $x=\\frac53$: $\\frac23\\ne-\\frac23$.",
      ],
      answer: "$x=3$",
    },
    methodTitle: "Cases, solve, check",
    method: [
      "Write both cases.",
      "Solve each.",
      "Substitute each in the original equation.",
    ],
    formalTitle: "The condition",
    formal: [
      "$|u|=w$ holds exactly when $w\\ge0$ and ($u=w$ or $u=-w$).",
      "A case answer is valid only if $w\\ge0$ at that $x$.",
    ],
    pitfalls: [
      "Do not skip the check.",
      "Negate the whole right side in Case 2.",
    ],
    parentGuide:
      "Ask your learner whether the right side is negative at each answer.",
  }),
  chainLesson({
    id: "regents-shifted-trinomial-factor",
    title: "Factoring in terms of a binomial",
    summary: "Factor a trinomial in $x-k$ and write the factors in $x$.",
    templateIds: ["shifted-trinomial-factor"],
    objectives: [
      "Rename the repeated binomial $u$ and factor the trinomial in $u$.",
      "Substitute back and simplify each factor.",
    ],
    openingTitle: "See the binomial as one thing",
    opening: [
      "In $(x-4)^2-5(x-4)-14$ the binomial $x-4$ appears twice. Calling it $u$ turns the expression into $u^2-5u-14$.",
      "Factor that trinomial, then put $x-4$ back for $u$ and combine the constants.",
    ],
    example: {
      prompt: "Factor $(x-4)^2-5(x-4)-14$.",
      steps: ["$u^2-5u-14=(u-7)(u+2)$.", "$(x-4-7)(x-4+2)=(x-11)(x-2)$."],
      answer: "$(x-11)(x-2)$",
    },
    methodTitle: "Substitute, factor, substitute back",
    method: [
      "Let $u$ stand for the binomial.",
      "Factor in $u$: find two numbers with the product and sum.",
      "Replace $u$ and simplify each factor.",
    ],
    formalTitle: "Why it works",
    formal: [
      "An identity in $u$ stays an identity when $u$ is replaced by any expression, here $x-4$.",
      "For a factor $pu+q$, the constant becomes $q-pk$ after $u=x-k$.",
    ],
    pitfalls: [
      "Replace $u$ by the whole binomial.",
      "With a leading coefficient, multiply it by the shift.",
    ],
    parentGuide:
      "Ask your learner to check by multiplying the two factors back.",
  }),
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
