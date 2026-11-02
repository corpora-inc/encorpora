import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const functionBehaviorMethods: Record<string, ProblemMethod> = {
  "polynomial-behavior-description": {
    goal: "Given a polynomial, describe its graph at the far left and right, at each zero, and how many turning points it can have.",
    intuition:
      "A polynomial is a sum of terms like $3x^2$ or $-5x$. The small raised number in $x^2$ is an exponent, a power of $x$. The degree is the highest power of $x$, and the leading coefficient is the number in front of that power. For very large positive or negative $x$, the highest power outweighs every other term, so the degree and the sign of the leading coefficient decide where the ends go. A zero is an input that makes the polynomial 0. Its multiplicity is how many times its factor repeats: an odd multiplicity crosses the $x$-axis, and an even one touches it and turns back.",
    terms: [
      [
        "degree-polynomial",
        "For a factored polynomial, add the degrees of the factors.",
      ],
      "leading-coefficient",
      "zero-of-a-function",
      "multiplicity",
      "turning-point",
    ],
    method: [
      "Find the degree. For factors like $(x + 1)^3$, each $x$ plus or minus a number, add the exponents. In a sum of terms, find the highest exponent.",
      "Read the sign of the leading coefficient. For an even degree both ends go the same way: up if positive, down if negative. For an odd degree they go opposite ways: down on the left and up on the right if positive, the reverse if negative.",
      "At each zero, an odd multiplicity means the graph crosses the axis, and an even multiplicity means it touches the axis and turns back.",
      "A polynomial of degree $n$, where $n$ is at least 1, has at most $n - 1$ turning points, the places where the graph changes between rising and falling.",
    ],
    watch:
      "The degree counts every exponent, not only the number of different zeros. Terms may be written out of order, so look for the highest exponent rather than the first term.",
  },
  "polynomial-graph-match": {
    goal: "Write a polynomial's factored form from its graph: a factor for each zero, its exponent from cross or touch, and the leading sign.",
    noLink: ["part"],
    intuition:
      "A zero of a polynomial is an input that makes it 0, so the graph meets the $x$-axis there. Each zero $r$ comes from a factor $(x - r)$, a part being multiplied. A graph that passes through the axis comes from a factor used an odd number of times. One that touches the axis and turns back comes from a factor used an even number of times. The far right of the graph tells the sign of the leading coefficient, the number in front.",
    terms: [
      "zero-of-a-function",
      [
        "factor-number",
        "A zero $r$ gives the factor $(x - r)$; the zero $x = -2$ gives $(x + 2)$.",
      ],
      "multiplicity",
      "leading-coefficient",
    ],
    method: [
      "Read every $x$-value where the graph meets the axis, and write one factor $(x - r)$ for each. Mind the sign: the zero at $x = -2$ gives $(x + 2)$.",
      "At each zero, decide whether the graph crosses, or touches and turns back. Use exponent 1 for a crossing and exponent 2 for a touch, the simplest choices.",
      "Look at the right end. If the graph rises there, the leading coefficient is positive, here 1. If it falls, it is negative, here $-1$.",
      "Compare with each choice: it must have the same zeros, the same exponents and the same sign.",
    ],
    watch:
      "A factor $(x + c)$ has its zero at $x = -c$. Check each choice's zeros against the graph, not just the numbers that appear in it.",
  },
  "rational-function-features": {
    goal: "Given a rational function with small linear factors, find its vertical asymptotes, hole, horizontal asymptote, intercepts, or domain.",
    senses: { rational: "rational-expression" },
    intuition:
      "A rational function is one polynomial divided by another. Its top is the numerator and its bottom the denominator. Where the denominator is 0, the function is undefined. If that factor stays after canceling, the graph shoots up or down beside a vertical line, a vertical asymptote. If it cancels completely with the same factor on top, there is just one missing point, a hole. For large $x$, comparing the degrees (highest powers) of the top and bottom tells where the graph levels off.",
    terms: [
      [
        "vertical-asymptote",
        "It sits where a factor of the denominator remains after canceling.",
      ],
      "hole",
      "horizontal-asymptote",
      "domain",
    ],
    method: [
      "Find all zeros of the denominator. These inputs are left out of the domain, the set of allowed inputs.",
      "Cancel factors that are on both the top and the bottom. A zero whose factor cancels completely is a hole; a zero whose factor remains is a vertical asymptote.",
      "For the horizontal asymptote, compare degrees. If the top's is smaller, it is $y = 0$. If they are equal, it is the ratio of the leading coefficients, the numbers in front of the highest powers. If the top's is larger, there is none.",
      "The $x$-intercepts are zeros of the simplified numerator that are in the domain. The $y$-intercept is $f(0)$ when 0 is in the domain; if $x = 0$ is a hole or an asymptote, there is none.",
    ],
    watch:
      "A factor that cancels gives a hole, not an asymptote. The hole's input is still left out of the domain, and it is never an intercept.",
  },
  "graphical-solution-table": {
    goal: "Given two functions and a table of their values, find where $f(x)=g(x)$: exactly, between two consecutive inputs, or to the nearest tenth.",
    intuition:
      "A solution of $f(x) = g(x)$ is an input where both functions give the same output. On graphs, it is the $x$-coordinate, the left-right position, of a point where the curves meet. For smooth graphs with no breaks, if $f$ is above $g$ in one table row and below it in the next, the curves crossed in between.",
    terms: [
      [
        "intersection-graphs",
        "A solution of $f(x)=g(x)$ is the $x$-coordinate of an intersection, not the shared output.",
      ],
      [
        "solution",
        "Here a bracket is two close inputs where $f - g$ changes sign, so a solution lies between them.",
      ],
    ],
    method: [
      "In each row, compare $f(x)$ with $g(x)$ and note which is larger.",
      "If the outputs are equal in a row, that input is a solution. Otherwise look for two neighboring rows where the larger function switches: a solution is between those inputs.",
      "To refine, make a finer table between those inputs and repeat. A row at the middle of the step shows which half holds the switch. The nearest tenth is the end of the step inside that half.",
    ],
    watch:
      "Report the input $x$, not the shared output. When no row has equal outputs, a switch in which function is larger signals a solution between the rows.",
  },
  "polynomial-identity-use": {
    goal: "Use an identity to compute a number quickly, to build a Pythagorean triple, or to decide which equation is true for every value of $x$.",
    intuition:
      "An identity is an equation that is true for every value of its letters, such as $(a+b)^2=a^2+2ab+b^2$. Unlike an equation you solve, you can use an identity as a shortcut: replace a hard product with an easier equal expression, or test whether a proposed rewrite is really equal for every value.",
    terms: ["identity-equation", "difference-of-squares"],
    method: [
      "Match the problem to an identity: a square of a sum or difference, a product $(a+b)(a-b)$, or a relation among given sums and products.",
      "Choose $a$ and $b$ so the arithmetic is easy, such as a round number and a small adjustment.",
      "Substitute into the identity and work out each term. To test an equation, multiply out the left side and compare every term. Trying one value of $x$ can only show that an equation is false.",
    ],
    watch:
      "A square of a two-term sum has three terms: the middle term $2ab$ is easy to leave out. One value of $x$ that makes both sides agree does not prove an identity, but one that makes them differ shows it is false.",
  },
  "binomial-coefficient": {
    goal: "Find a coefficient of $(ax+b)^n$ for $n\\le7$, including a constant or leading term, or choose the Pascal's triangle row that holds them.",
    intuition:
      "A binomial is an expression with two terms. $(ax + b)^n$ means multiplying $n$ copies of $ax + b$. Each term of the result picks either $ax$ or $b$ from every copy. The term with $x^k$ picks $ax$ from $k$ copies and $b$ from the other $n - k$. The number of ways to choose those $k$ copies is the binomial coefficient $\\binom{n}{k}$, read “$n$ choose $k$”, an entry of Pascal's triangle.",
    terms: [
      "binomial",
      [
        "binomial-coefficient",
        "It is entry $k$ of row $n$ of Pascal's triangle, counting both from 0.",
      ],
      "pascals-triangle",
    ],
    method: [
      "Write the term with $x^k$ as $\\binom{n}{k}(ax)^k b^{\\,n-k}$.",
      "Take $\\binom{n}{k}$ from row $n$ of Pascal's triangle, counting both the row and the entry from 0.",
      "Raise $a$ to the power $k$ and $b$ to the power $n-k$, keeping the sign of $b$: an odd power of a negative number is negative.",
      "Multiply the three numbers. The coefficient of the constant term is $b^n$, and the coefficient of $x^n$ is $a^n$.",
    ],
    watch:
      "The coefficient includes $a^k$ as well as the power of $b$, and the exponents add to $n$: the power of $b$ is $n-k$, not $k$.",
  },
  "number-system-closure-classify": {
    goal: "Decide whether a sum or product involving rational and irrational numbers is rational or irrational.",
    intuition:
      "A rational number can be written as a fraction of two integers, the whole numbers and their negatives, with a bottom that is not 0. An irrational number cannot. Sums, differences, products and quotients (never dividing by 0) of rational numbers are rational. Mixing in an irrational number usually keeps the result irrational, because otherwise you could undo the step and get the irrational number from rational ones. Two irrational numbers can still combine to a rational number, as when opposites cancel.",
    terms: ["rational-number", "irrational-number"],
    method: [
      "Rational plus irrational is irrational. Suppose the sum were rational; subtracting the rational number would make the irrational one rational, which is impossible.",
      "A rational number other than 0 times an irrational number is irrational, by the same argument with division. If the rational number is 0, the product is 0, which is rational.",
      "With two irrational numbers, simplify before deciding. For a positive rational $k$ whose square root is irrational, $\\sqrt{k}+(-\\sqrt{k})=0$ and $\\sqrt{k}\\cdot\\sqrt{k}=k$ are rational, while $\\sqrt2+\\sqrt3$ is irrational. The result can be either.",
    ],
    watch:
      "A decimal approximation of an irrational number is not the number: the exact decimal never ends or repeats. A factor of 0 is the one exception for a product with a rational number.",
  },
};

export const functionBehaviorPrinciples: Record<string, string> = {
  "polynomial-behavior-description":
    "For a polynomial of degree $n$ with leading coefficient $c\\ne0$, the ends of the graph are governed by $cx^n$. A zero $r$ of multiplicity $m$ has factor $(x-r)^m$ and the sign of the polynomial changes there exactly when $m$ is odd. A polynomial of degree $n\\ge1$ has at most $n-1$ turning points and at most $n$ real zeros counted with multiplicity.",
  "polynomial-graph-match":
    "If $P(x)=c(x-r_1)^{m_1}\\cdots(x-r_k)^{m_k}$ with $c\\ne0$ and different real numbers $r_1,\\dots,r_k$, the graph meets the $x$-axis exactly at $r_1,\\dots,r_k$. It crosses the axis at $r_i$ when $m_i$ is odd and touches it and turns back when $m_i$ is even. For large $|x|$ the graph follows $cx^n$ with $n=\\sum m_i$, so the sign of $c$ and the parity of $n$ fix the ends.",
  "rational-function-features":
    "For $f=p/q$ with polynomials $p$ and $q$ and $q\\ne0$ as a polynomial, the domain excludes the zeros of $q$. After removing all common factors, a zero of the denominator gives a vertical asymptote and a canceled factor gives a hole. If $\\deg p<\\deg q$ the horizontal asymptote is $y=0$; if the degrees are equal it is the ratio of leading coefficients; if $\\deg p>\\deg q$ there is none.",
  "graphical-solution-table":
    "The solutions of $f(x)=g(x)$ are the zeros of $h=f-g$. For continuous $f$ and $g$, if $h(a)$ and $h(b)$ have opposite signs, there is a solution between $a$ and $b$ (the intermediate value theorem). Repeating the test on smaller intervals narrows the solution to any chosen precision.",
  "polynomial-identity-use":
    "The identities $(a+b)^2=a^2+2ab+b^2$, $(a-b)^2=a^2-2ab+b^2$, $a^2-b^2=(a+b)(a-b)$ and $(x^2+y^2)^2=(x^2-y^2)^2+(2xy)^2$ hold for all numbers $a$, $b$, $x$ and $y$. Two polynomials are identical when all their coefficients agree.",
  "binomial-coefficient":
    "For a nonnegative integer $n$, $(a+b)^n=\\sum_{k=0}^{n}\\binom{n}{k}a^k b^{n-k}$, where $\\binom{n}{k}=\\frac{n!}{k!(n-k)!}$ counts the ways to choose $k$ of the $n$ factors. These coefficients are the entries of row $n$ of Pascal's triangle, with $\\binom{n+1}{k}=\\binom{n}{k-1}+\\binom{n}{k}$ for $1\\le k\\le n$.",
  "number-system-closure-classify":
    "The rational numbers are closed under addition, subtraction, multiplication and division by a nonzero number. If $q$ is rational and $x$ is irrational, then $q+x$ is irrational, and $qx$ is irrational when $q\\ne0$. The sum or product of two irrational numbers can be rational or irrational.",
};

export const functionBehaviorLessons: Lesson[] = [
  {
    id: "polynomial-behavior-description",
    title: "How a polynomial graph behaves",
    summary:
      "A polynomial is a sum of terms such as $3x^2$ or $-5x$. Each term is a number times a whole-number power of $x$. The degree is the highest power of $x$, and the leading coefficient is the number in front of that power. Together they decide where the two ends of the graph go. The zeros, the inputs that make the polynomial 0, decide where the graph meets the $x$-axis.",
    senses: {
      term: "term-expression",
      degree: "degree-polynomial",
      factor: "factor-number",
      side: "side",
    },
    noLink: ["part", "changes", "opposite"],
    templateIds: ["polynomial-behavior-description"],
    objectives: [
      "Describe where the ends of a polynomial's graph go from its degree and leading coefficient.",
      "Decide whether the graph crosses or touches the $x$-axis at each zero, and find the most turning points it can have.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Large inputs and repeated factors",
        paragraphs: [
          "In $x^3 + 5x$, try a very large input such as $x = 1000$. Then $x^3$ is a billion, while $5x$ is only 5000. The highest power of $x$ outweighs every other term, so it controls the far left and the far right of the graph.",
          "A zero of a polynomial is an input that makes it equal 0. On the graph, a zero is where the curve meets the $x$-axis, the line where $y = 0$. If $r$ is a zero, then $(x - r)$ is a factor, a part being multiplied.",
          "A factor can repeat. In $(x - 2)^3$, the small raised 3 is an exponent: it says $(x - 2)$ is used three times. The number of copies is called the multiplicity of the zero 2. For factors like these, each $x$ plus or minus a number, the degree is the sum of the exponents: $(x + 1)^3 x^2$ has degree $3 + 2 = 5$.",
          "Multiplicity decides what the graph does at the zero, because the other factors keep their sign close to it. With an odd multiplicity (1, 3, 5, …), the repeated factor changes sign at the zero, so the graph crosses the axis. With an even multiplicity (2, 4, …), it keeps the same sign on both sides, so the graph touches the axis and turns back.",
          "A turning point is where the graph changes from rising to falling, or from falling to rising.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Let $P(x)=-2(x+1)^{3}x^{2}(x-3)$. Describe the ends, the behavior at each zero, and the greatest number of turning points of a polynomial of this degree.",
      steps: [
        "Each factor is $x$ plus or minus a number, so each copy adds one power of $x$. Add the exponents to get the degree: $3 + 2 + 1 = 6$. The degree is 6, which is even.",
        "The leading coefficient is the number in front, $-2$, which is negative. Multiplied out, the highest-power term is $-2x^6$. For large inputs on either side, $x^6$ is positive, so $-2x^6$ is negative: the graph falls on both the left and the right.",
        "At $x = -1$ the multiplicity is 3, which is odd, so the graph crosses the axis. At $x = 0$ the factor $x^2$ gives multiplicity 2, which is even, so the graph touches the axis and turns back. At $x = 3$ the multiplicity is 1, so the graph crosses.",
        "A polynomial of degree 6 has at most $6 - 1 = 5$ turning points: its graph can change direction at most one time fewer than its degree.",
      ],
      answer:
        "Falls on both ends; crosses at $x=-1$ and $x=3$; touches at $x=0$; at most 5 turning points",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Ends from the leading term",
        paragraphs: [
          "Only the term with the highest power matters at the ends. If the degree is even, both ends go the same way: up when the leading coefficient is positive, down when it is negative. If the degree is odd, the ends go opposite ways. With a positive leading coefficient the graph falls on the left and rises on the right, and a negative one does the reverse.",
          "If the polynomial is written as a sum with its terms out of order, find the term with the highest exponent first. In $5x - x^4 + 2$, the highest-power term is $-x^4$.",
        ],
      },
      {
        stage: "formal",
        title: "Multiplicity and turning points",
        paragraphs: [
          "If $P(x) = (x - r)^m Q(x)$ with $Q(r) \\neq 0$ ($\\neq$ means is not equal to), then close to $r$ the polynomial behaves like $Q(r)(x - r)^m$. It changes sign at $r$ exactly when $m$ is odd. For odd $m$ of 3 or more, the graph still crosses, but it flattens as it passes through.",
          "A polynomial of degree $n$, where $n$ is at least 1, has at most $n - 1$ turning points, because its slope is a polynomial of degree $n - 1$ with at most $n - 1$ zeros. Some have fewer: $x^3$ has none.",
        ],
      },
    ],
    pitfalls: [
      "For a factored polynomial whose factors are $x$ plus or minus a number, add all the exponents to get the degree. Counting only the different zeros gives the wrong degree.",
      "An odd multiplicity such as 3 still crosses the axis. Only an even multiplicity touches and turns back.",
      "The degree limits the number of zeros. The limit on turning points is one less than the degree.",
    ],
    parentGuide:
      "Ask the learner what the degree of $(x - 1)^2(x + 2)$ is, and whether its graph crosses or touches the $x$-axis at 1. Then ask why.",
  },
  {
    id: "polynomial-graph-match",
    title: "From a polynomial graph to its factors",
    summary:
      "A polynomial is a sum of terms such as $3x^2$ or $-5x$. A zero of a polynomial is an input that makes it 0, so the graph meets the $x$-axis there. Each zero $r$ gives a factor $(x - r)$, a part being multiplied. Writing the polynomial as its factors multiplied together is called factored form. Whether the graph crosses or touches the axis tells whether that factor's exponent is odd or even. The right end of the graph tells the sign of the leading coefficient, the number in front.",
    senses: {
      term: "term-expression",
      factor: "factor-number",
      degree: "degree-polynomial",
      side: "side",
    },
    noLink: ["part", "changes"],
    templateIds: ["polynomial-graph-match"],
    objectives: [
      "Write one factor for each zero shown on a graph, with the right sign.",
      "Choose each exponent from whether the graph crosses or touches, and the leading sign from the right end.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Reading factors from a picture",
        paragraphs: [
          "A zero is an input where the polynomial equals 0, so the graph meets the $x$-axis, the line $y = 0$. If $r$ is a zero, then $(x - r)$ is a factor: the zero $x = 3$ gives $(x - 3)$, and the zero $x = -2$ gives $(x + 2)$, because $x - (-2) = x + 2$.",
          "The exponent on a factor, the small raised number, counts how many copies of it are multiplied. An odd number of copies changes the sign of the polynomial at the zero, so the graph crosses the axis. An even number keeps the same sign on both sides, so the graph touches the axis and turns back.",
          "These problems use the simplest choice: exponent 1 for a crossing and exponent 2 for a touch. A higher odd or even exponent would look the same, only flatter at the zero.",
          "The leading coefficient is the number in front of the factors. For large inputs on the right, every factor $(x - r)$ is positive. So the right end rises when the leading coefficient is positive and falls when it is negative.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A graph has zeros at $x=-2$ and $x=1$. It crosses the axis at $x=-2$, touches it at $x=1$, and its right end rises. Write the factored form.",
      steps: [
        "The zeros $x = -2$ and $x = 1$ give the factors $(x + 2)$ and $(x - 1)$.",
        "The graph crosses at $x = -2$, so $(x + 2)$ gets an odd exponent, and the simplest is 1. It touches at $x = 1$, so $(x - 1)$ gets an even exponent, and the simplest is 2.",
        "The right end rises, so the leading coefficient is positive. With the simplest choice, it is 1.",
        "Multiply the factors: $(x + 2)(x - 1)^2$. Check: the degree is $1 + 2 = 3$, which is odd, so the left end falls while the right end rises.",
      ],
      answer: "$P(x)=(x+2)(x-1)^{2}$",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Check a choice against the graph",
        paragraphs: [
          "For each answer choice, list its zeros, then its exponents, then the sign of its leading coefficient. A choice that fails any one of these three checks is not the graph.",
        ],
      },
      {
        stage: "formal",
        title: "Why the right end gives the sign",
        paragraphs: [
          "For large positive $x$, every factor $(x - r)$ is positive, so the polynomial has the sign of its leading coefficient $c$. So the right end rises when $c > 0$ and falls when $c < 0$, whatever the degree. The left end also depends on whether the degree is even or odd.",
        ],
      },
    ],
    pitfalls: [
      "The zero $x = -2$ gives the factor $(x + 2)$, not $(x - 2)$.",
      "A touch needs an even exponent, and a crossing needs an odd one.",
      "Read the sign from the right end, not the left: the left end also depends on the degree.",
    ],
    parentGuide:
      "Ask the learner which factor gives a zero at $x = -3$, and whether a graph that touches the axis there needs an odd or even exponent.",
  },
  {
    id: "rational-function-features",
    title: "Asymptotes, holes and intercepts",
    summary:
      "A polynomial, like $x + 3$ or $2x^2 - 5$, is a sum of terms: numbers times whole-number powers of $x$. A rational function is one polynomial divided by another, like $\\tfrac{2}{x + 3}$. A fraction is undefined when its bottom, the denominator, is 0, so those inputs are left out. Near such an input the graph either shoots up or down beside a vertical line, called a vertical asymptote, or has a single missing point, called a hole. Factoring the top and bottom shows which.",
    senses: {
      rational: "rational-expression",
      term: "term-expression",
      hole: "hole",
      factor: "factor-number",
      degree: "degree-polynomial",
    },
    noLink: ["leaves"],
    templateIds: ["rational-function-features"],
    objectives: [
      "Find the inputs a rational function leaves out, and tell a vertical asymptote from a hole.",
      "Find the horizontal asymptote and the intercepts from the factors and the degrees.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A fraction of two polynomials",
        paragraphs: [
          "A rational function divides one polynomial by another, such as $f(x) = \\tfrac{2(x - 1)}{(x - 1)(x + 3)}$. The top is called the numerator and the bottom the denominator. A fraction is undefined when its denominator is 0. So $x = 1$ and $x = -3$ are not in the domain, the set of inputs the function allows.",
          "Near $x = -3$ the denominator is close to 0 while the numerator is not, so the outputs grow very large. The graph runs beside the vertical line $x = -3$ without touching it. A line like this is called a vertical asymptote.",
          "The factor $(x - 1)$ is on both the top and the bottom, once each. Away from $x = 1$ it cancels, leaving $\\tfrac{2}{x + 3}$. So the graph looks like $y = \\tfrac{2}{x + 3}$ with one point missing at $x = 1$. That missing point is called a hole.",
          "For very large inputs, only the highest powers matter. Comparing the degrees, the highest powers, of the top and the bottom tells which flat line $y = c$ the graph levels off toward. That line is called a horizontal asymptote.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "For $f(x)=\\dfrac{2(x-1)}{(x-1)(x+3)}$, find the vertical asymptote, the hole, the horizontal asymptote and the domain.",
      steps: [
        "The denominator is 0 at $x = 1$ and $x = -3$. So the domain is all real numbers, all the numbers on the number line, except 1 and $-3$.",
        "The factor $(x - 1)$ appears once on the top and once on the bottom, so it cancels, leaving $\\tfrac{2}{x + 3}$. The zero $x = -3$ is still in the denominator, so there is a vertical asymptote at $x = -3$.",
        "The canceled factor gives a hole at $x = 1$. Its height is the simplified function's value there: $\\tfrac{2}{1 + 3} = \\tfrac{1}{2}$. So the hole is at $(1, \\tfrac{1}{2})$.",
        "The numerator $2(x - 1)$ has degree 1, and the denominator has degree 2. The bottom grows faster, so the outputs shrink toward 0, and the horizontal asymptote is $y = 0$.",
      ],
      answer:
        "Vertical asymptote $x=-3$; hole at $(1,\\ \\frac12)$; horizontal asymptote $y=0$; domain all reals except $1$ and $-3$",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Intercepts and the horizontal asymptote",
        paragraphs: [
          "An $x$-intercept is an input where the graph meets the $x$-axis, so the output is 0. It is a zero of the simplified numerator that is still in the domain. The $y$-intercept is the output at $x = 0$, written $f(0)$: the height where the graph crosses the $y$-axis. It exists only when 0 is in the domain, so there is none if $x = 0$ is a hole or a vertical asymptote.",
          "For the horizontal asymptote, compare the degrees of the top and the bottom. A smaller top degree gives $y = 0$. Equal degrees give $y$ equal to the top's leading coefficient divided by the bottom's, the numbers in front of the highest powers. A larger top degree gives no horizontal asymptote.",
        ],
      },
      {
        stage: "formal",
        title: "Why the degrees decide",
        paragraphs: [
          "For very large $|x|$, the size of $x$ ignoring its sign, each polynomial is dominated by its leading term, its highest-power term. So $\\tfrac{p}{q}$ behaves like $\\tfrac{c x^m}{d x^n} = \\tfrac{c}{d} x^{m - n}$. This tends to 0 when $m < n$, equals $\\tfrac{c}{d}$ when $m = n$, and grows without bound when $m > n$.",
          "A factor that appears at least as many times on the top as on the bottom cancels completely from the bottom and gives a hole. Its height is the value of the simplified function there. The original function is still not defined at that input.",
        ],
      },
    ],
    pitfalls: [
      "A factor that cancels completely gives a hole, not a vertical asymptote and not an intercept.",
      "A hole's input is still outside the domain.",
      "A factor $(x - c)$ is 0 at $x = c$: keep the sign.",
    ],
    parentGuide:
      "Ask the learner which factor cancels in $\\dfrac{(x-2)(x+1)}{(x-2)(x-4)}$, and what that does to the graph at $x = 2$.",
  },
  {
    id: "graphical-solution-table",
    title: "Solve two functions with a table",
    summary:
      "A solution of $f(x) = g(x)$ is an input where the two functions give the same output. On a graph, it is where the two curves meet. In a table, look for a row where the outputs match, or for two rows where the larger function switches. For graphs with no breaks, a switch means the curves crossed in between.",
    senses: { interval: "interval" },
    noLink: ["jumps", "changes", "change", "opposite"],
    templateIds: ["graphical-solution-table"],
    objectives: [
      "Find an input where two functions give the same output, or the two neighboring inputs it lies between.",
      "Narrow a solution to the nearest tenth with a finer table.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Where two outputs match",
        paragraphs: [
          "A function gives one output for each input $x$. The equation $f(x) = g(x)$ asks for an input where both outputs are the same. On graphs, these inputs are the $x$-coordinates, the left-right positions, of the points where the curves meet. Integers are the whole numbers and their negatives. Consecutive integers are integers next to each other, like $-1$ and 0, or 0 and 1.",
          "Some graphs have no breaks or jumps. They are called continuous. For continuous functions, one graph can go from above the other to below it only by crossing. So if $f$ is larger in one row and smaller in the next, a solution lies between the two inputs. A table can still miss a solution, for example when the curves cross twice between two rows.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Let $f(x)=x^2-3$ and $g(x)=4x-4$. At which consecutive integers does a solution of $f(x)=g(x)$ lie? Use values at $x=0$ and $x=1$.",
      steps: [
        "At $x = 0$: $f(0) = 0^2 - 3 = -3$ and $g(0) = 4 \\times 0 - 4 = -4$. Since $-3 > -4$ ($>$ means is greater than), $f$ is above $g$.",
        "At $x = 1$: $f(1) = 1 - 3 = -2$ and $g(1) = 4 - 4 = 0$. Since $-2 < 0$ ($<$ means is less than), $f$ is below $g$.",
        "Both graphs are smooth curves with no breaks, so the larger function can change only where they cross. The solution is between $x = 0$ and $x = 1$.",
        "Check with algebra: $x^2 - 3 = 4x - 4$ gives $x^2 - 4x + 1 = 0$, whose solutions are $2 \\pm \\sqrt{3}$ ($\\pm$ means plus or minus), about 0.27 and 3.73. The first lies between 0 and 1.",
      ],
      answer: "Between $x=0$ and $x=1$",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Narrowing the interval",
        paragraphs: [
          "To get the solution to the nearest tenth, rounded to one decimal place, make a table of tenths between the two inputs. Find the tenth-long step where the larger function changes. Then check the middle of that step: if the change happens before the middle, the nearest tenth is the lower end; otherwise it is the upper end.",
          "If the outputs are exactly equal in a row, that input is the solution. The shared output is the height of the meeting point, not the solution.",
        ],
      },
      {
        stage: "formal",
        title: "Why a change of order means a solution",
        paragraphs: [
          "Let $h(x) = f(x) - g(x)$. A solution of $f(x) = g(x)$ is a zero of $h$, an input where $h$ is 0. If $f$ and $g$ are continuous and $h(a)$ and $h(b)$ have opposite signs, then $h$ is 0 somewhere between $a$ and $b$. This is called the intermediate value theorem.",
          "Halving the interval and testing the sign at its middle keeps a solution inside an interval half as long each time.",
        ],
      },
    ],
    pitfalls: [
      "Give the input $x$, not the shared output.",
      "Compare the two functions row by row. A smaller output of $f$ alone does not locate the solution.",
      "After finding the step, check its middle before rounding to a tenth.",
    ],
    parentGuide:
      "Ask the learner to say, row by row, which of two functions is larger, and where that changes.",
  },
  {
    id: "polynomial-identity-use",
    title: "Use a polynomial identity",
    summary:
      "Most equations are true only for some values: $x + 2 = 5$ is true only for $x = 3$. An identity is an equation that is true for every value of its letters, such as $(a + b)^2 = a^2 + 2ab + b^2$. Because it always holds, it can turn a hard product into an easy one, or check whether two expressions are really equal.",
    senses: {
      identity: "identity-equation",
      product: "product-multiply",
      square: "square-number",
      side: "side-of-equation",
      term: "term-expression",
    },
    templateIds: ["polynomial-identity-use"],
    objectives: [
      "Use an identity to work out a product or a square quickly.",
      "Test whether an equation is true for every value, and build a Pythagorean triple.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A true equation for every value",
        paragraphs: [
          "Most equations are true only for some values: $x + 2 = 5$ is true only for $x = 3$. An identity is true for every value. For example, $(a + b)^2 = a^2 + 2ab + b^2$ holds for all numbers $a$ and $b$. Here $a^2$ means $a \\times a$, and $2ab$ means 2 times $a$ times $b$.",
          "Because the identity is always true, you can pick friendly numbers. To find $52^2$, write $52 = 50 + 2$. Then $52^2 = 50^2 + 2 \\times 50 \\times 2 + 2^2$, which is easy to work out.",
        ],
      },
    ],
    workedExample: {
      prompt: "Use an identity to find $52^2$.",
      steps: [
        "Write $52 = 50 + 2$, so $a = 50$ and $b = 2$ in $(a + b)^2 = a^2 + 2ab + b^2$.",
        "Work out the three terms: $a^2 = 2500$, $2ab = 2 \\times 50 \\times 2 = 200$, and $b^2 = 4$.",
        "Add them: $2500 + 200 + 4 = 2704$.",
        "Check by multiplying another way: $52 \\times 52 = 50 \\times 52 + 2 \\times 52 = 2600 + 104 = 2704$.",
      ],
      answer: "$2704$",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Other identities and testing an equation",
        paragraphs: [
          "The identity $a^2 - b^2 = (a + b)(a - b)$ is called a difference of squares. It turns $43 \\times 37 = (40 + 3)(40 - 3)$ into $1600 - 9 = 1591$. It also gives $x^2 - y^2$ from the values of $x + y$ and $x - y$. From $(x + y)^2 = x^2 + 2xy + y^2$ you get $x^2 + y^2 = (x + y)^2 - 2xy$.",
          "A Pythagorean triple is three whole numbers that can be the lengths of a right triangle's two legs and hypotenuse, like 3, 4 and 5, because $3^2 + 4^2 = 5^2$. For whole numbers $x$ and $y$ with $x > y > 0$, the numbers $x^2 - y^2$, $2xy$ and $x^2 + y^2$ form one: $x = 2$ and $y = 1$ give 3, 4 and 5.",
          "To test whether an equation is an identity, multiply out one side and compare every term. Trying one value such as $x = 1$ can show that an equation is false, but it cannot prove that it is always true.",
        ],
      },
      {
        stage: "formal",
        title: "Why identities hold",
        paragraphs: [
          "Multiplying out $(a + b)(a + b)$ term by term gives $a^2 + ab + ba + b^2 = a^2 + 2ab + b^2$. Replacing $b$ by $-b$ gives $(a - b)^2 = a^2 - 2ab + b^2$. Multiplying out $(a + b)(a - b)$ gives $a^2 - ab + ba - b^2 = a^2 - b^2$.",
          "For the triple, multiplying out gives $(x^2 - y^2)^2 + (2xy)^2 = x^4 - 2x^2y^2 + y^4 + 4x^2y^2 = x^4 + 2x^2y^2 + y^4 = (x^2 + y^2)^2$.",
        ],
      },
    ],
    pitfalls: [
      "$(a + b)^2$ has the middle term $2ab$: it is not $a^2 + b^2$.",
      "A difference of squares has no middle term, and the second square is subtracted.",
      "In a Pythagorean triple, the largest number is the hypotenuse, the longest of the three lengths. List it last.",
    ],
    parentGuide:
      "Ask the learner to work out $49 \\times 51$ by writing it as $(50 - 1)(50 + 1)$.",
  },
  {
    id: "binomial-coefficient",
    title: "Coefficients of a binomial power",
    summary:
      "A binomial is an expression with two terms, like $x + 2$. A binomial power such as $(x + 2)^3$ means $(x + 2)(x + 2)(x + 2)$. When you multiply it out, each term of the result picks either $x$ or 2 from every bracket. Pascal's triangle counts the ways to pick. The coefficient, the number in front of a term, is that count times the numbers picked: in $(x + 2)^3$ the $x^2$ term is $3 \\times 2 = 6$ times $x^2$.",
    senses: { term: "term-expression", rule: "rule" },
    templateIds: ["binomial-coefficient"],
    objectives: [
      "Find the number in front of any term of $(ax + b)^n$, using a row of Pascal's triangle.",
      "Find the constant term and the coefficient of the highest power, keeping the signs right.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Choosing a term from every factor",
        paragraphs: [
          "A binomial is a sum of two terms, such as $x + 2$. A power of it, such as $(x + 2)^3$, means three copies multiplied: $(x + 2)(x + 2)(x + 2)$. Multiplying out, every term of the result picks either $x$ or 2 from each of the three brackets.",
          "The term with $x^2$ picks $x$ from two brackets and 2 from the other one. There are 3 choices for which bracket gives the 2, so the term is $3 \\times x^2 \\times 2 = 6x^2$. The number of choices, here 3, is called a binomial coefficient.",
          "Pascal's triangle lists these numbers. Each row starts and ends with 1, and every number inside a row is the sum of the two numbers just above it. Counting the top row as row 0, row 3 is 1, 3, 3, 1.",
          "We write $\\binom{n}{k}$, read “$n$ choose $k$”, for the number of ways to choose $k$ of $n$ brackets. It is entry $k$ of row $n$, counting both the row and the entry from 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the coefficient of $x^2$ in $(2x-3)^4$.",
      steps: [
        "Row 4 of Pascal's triangle, counting the top row as row 0, is 1, 4, 6, 4, 1. The term with $x^2$ picks $2x$ from two of the four brackets, so it uses entry 2, which is $\\binom{4}{2} = 6$.",
        "The term is $\\binom{4}{2}(2x)^2(-3)^2$: two brackets give $2x$ and the other two give $-3$. Here $(2x)^2 = 4x^2$, so it brings a 4, and $(-3)^2 = 9$.",
        "Multiply the numbers: $6 \\times 4 \\times 9 = 216$.",
        "Check the sign. An even power of $-3$ is positive, so the coefficient, the number in front of $x^2$, is positive.",
      ],
      answer: "$216$",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Building the row and handling edge terms",
        paragraphs: [
          "Every number inside a row of Pascal's triangle is the sum of the two numbers above it, and each row starts and ends with 1. So row 3 is 1, 3, 3, 1, and row 4 is 1, 4, 6, 4, 1. Row $n$ lists the coefficients of $(x + y)^n$.",
          "The constant term of $(ax + b)^n$, the term with no $x$, is $b^n$. The coefficient of $x^n$ is $a^n$. With a negative $b$, a term's sign depends on whether its power of $b$ is odd or even.",
        ],
      },
      {
        stage: "formal",
        title: "The binomial theorem",
        paragraphs: [
          "For a whole number $n$, $(a + b)^n = \\sum_{k=0}^{n}\\binom{n}{k}a^k b^{n-k}$. The symbol $\\Sigma$ means add up the terms for $k = 0, 1, \\dots, n$. Here $\\binom{n}{k} = \\dfrac{n!}{k!\\,(n-k)!}$ is the number of ways to choose which $k$ of the $n$ brackets give $a$, and the factorial $n!$ means $n \\times (n - 1) \\times \\cdots \\times 1$, with $0! = 1$.",
          "The coefficient of $x^k$ in $(ax + b)^n$ is $\\binom{n}{k}a^k b^{n-k}$. For $k$ from 1 to $n$, the coefficients obey $\\binom{n+1}{k} = \\binom{n}{k-1} + \\binom{n}{k}$, which is the rule of Pascal's triangle.",
        ],
      },
    ],
    pitfalls: [
      "Raise $a$ to the power $k$ too, not only $b$.",
      "The power of $b$ is $n - k$: the two exponents add to $n$.",
      "Count the rows and entries of Pascal's triangle from 0.",
    ],
    parentGuide:
      "Ask the learner to multiply out $(x + 1)^3$ by building row 3 of Pascal's triangle.",
  },
  {
    id: "number-system-closure-classify",
    title: "Rational and irrational sums and products",
    summary:
      "A rational number can be written as a fraction of two integers, the whole numbers and their negatives, like $\\tfrac{3}{4}$ or $-5$. An irrational number cannot, like $\\sqrt{2}$. A rational number plus an irrational number is always irrational. A rational number other than 0 times an irrational number is irrational too. Two irrational numbers can combine to give a rational number.",
    senses: {
      product: "product-multiply",
      side: "side-of-equation",
      difference: "difference-subtract",
      opposite: "opposite-number",
    },
    noLink: ["impossible"],
    templateIds: ["number-system-closure-classify"],
    objectives: [
      "Decide whether a sum or product of a rational and an irrational number is rational or irrational, and explain why.",
      "Simplify a sum or product of two irrational numbers before deciding.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which operations keep a number rational",
        paragraphs: [
          "A rational number is a number that can be written as a fraction of two integers, the whole numbers and their negatives, with a bottom that is not 0. Examples are $\\tfrac{3}{4}$ and $-5 = \\tfrac{-5}{1}$. An irrational number is one that cannot be written this way, such as $\\sqrt{2}$ and $\\pi$. Its decimal goes on forever without repeating.",
          "Adding, subtracting, multiplying or dividing two rational numbers (never dividing by 0) always gives a rational number. When an irrational number is mixed in, the result usually stays irrational. Otherwise you could undo the step and build the irrational number from rational ones, which is impossible.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Is $\\frac12+\\sqrt3$ rational or irrational? Is $\\sqrt3+(-\\sqrt3)$?",
      steps: [
        "Suppose $\\tfrac{1}{2} + \\sqrt{3} = q$ for some rational number $q$. Subtract $\\tfrac{1}{2}$ from both sides: $\\sqrt{3} = q - \\tfrac{1}{2}$. A difference of two rational numbers is rational.",
        "That would make $\\sqrt{3}$ rational, but it is irrational. So the supposition was false, and $\\tfrac{1}{2} + \\sqrt{3}$ is irrational.",
        "For $\\sqrt{3} + (-\\sqrt{3})$, both numbers are irrational, but they are opposites: the same distance from 0 on either side. Their sum is 0.",
        "The number $0 = \\tfrac{0}{1}$ is rational. So the sum of two irrational numbers can be rational.",
      ],
      answer:
        "$\\frac12+\\sqrt3$ is irrational; $\\sqrt3+(-\\sqrt3)=0$ is rational",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Products, and two irrational numbers",
        paragraphs: [
          "A rational number $q$ other than 0 times an irrational number is irrational. If $q\\sqrt{3}$ were rational, dividing by $q$ would make $\\sqrt{3}$ rational. If $q = 0$, the product is 0, which is rational, so the condition matters.",
          "Two irrational numbers can have a rational product: $\\sqrt{3} \\times \\sqrt{3} = 3$, and $\\sqrt{2} \\times \\sqrt{8} = \\sqrt{16} = 4$. They can also have an irrational one: $\\sqrt{2} \\times \\sqrt{3} = \\sqrt{6}$. Simplify before deciding.",
        ],
      },
      {
        stage: "formal",
        title: "Closure and the zero exception",
        paragraphs: [
          "Let $q$ be rational and $x$ irrational. If $q + x$ were rational, then $x = (q + x) - q$ would be rational, a contradiction. If $q \\ne 0$ ($\\ne$ means is not equal to) and $qx$ were rational, then $x = \\tfrac{qx}{q}$ would be rational, a contradiction.",
          "A set of numbers is closed under an operation if combining any two members always gives a member. The rational numbers are closed under addition, subtraction, multiplication and division by a number other than 0. The irrational numbers are not closed under any of these: $\\sqrt{2} + (-\\sqrt{2}) = 0$ and $\\sqrt{2} \\times \\sqrt{2} = 2$.",
        ],
      },
    ],
    pitfalls: [
      "A decimal approximation of an irrational number does not make it rational.",
      "Rational times irrational is irrational only when the rational number is not 0.",
      "A sum or product of two irrational numbers can be rational, so simplify before deciding.",
    ],
    parentGuide:
      "Ask the learner why $2\\sqrt{5}$ cannot be rational, using division by 2.",
  },
];
