import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const functionBehaviorMethods: Record<string, ProblemMethod> = {
  "polynomial-behavior-description": {
    goal: "Given a polynomial in factored form or as a sum of terms, describe how its graph behaves at the far left and right, at each zero, and how many turning points it can have.",
    intuition:
      "For very large positive or negative $x$, the highest power of $x$ outweighs every other term, so only the degree and the sign of the leading coefficient decide where the ends go. Near a zero, a factor raised to an odd power changes sign and the graph crosses the $x$-axis; an even power keeps the sign and the graph touches the axis and turns back.",
    terms: [
      ["degree", "The highest power of $x$ after the polynomial is multiplied out. For a factored polynomial, add the exponents."],
      ["leading coefficient", "The coefficient of the highest power of $x$."],
      ["zero", "An input $x$ at which the polynomial equals 0; the graph meets the $x$-axis there."],
      ["multiplicity", "The exponent of a factor $(x-r)$: how many times $r$ is a zero."],
      ["turning point", "A point where the graph changes from rising to falling or from falling to rising."],
    ],
    method: [
      "Add the exponents of all the factors to get the degree. In a sum of terms, find the term with the highest exponent.",
      "Read the sign of the leading coefficient: for an even degree both ends go the same way (up if positive, down if negative); for an odd degree the ends go opposite ways (down on the left and up on the right if positive).",
      "For each zero, an odd multiplicity means the graph crosses the axis and an even multiplicity means it touches the axis and turns back.",
      "A polynomial of degree $n$ has at most $n-1$ turning points.",
    ],
    watch:
      "The degree counts every exponent, not only the number of different zeros. Terms of a polynomial may be written out of order, so look for the highest exponent rather than the first term.",
  },
  "rational-function-features": {
    goal: "Given a rational function with small linear factors, find its vertical asymptotes, hole, horizontal asymptote, intercepts, or domain.",
    intuition:
      "A rational function is one polynomial divided by another. Dividing by something near zero makes the output huge, which produces a vertical line the graph approaches. If the same factor sits in the numerator and denominator, it cancels and leaves a single missing point instead. For large $x$, the highest powers dominate both parts, so comparing degrees tells where the graph levels off.",
    terms: [
      ["vertical asymptote", "A vertical line $x=c$ that the graph approaches without reaching, where a denominator factor stays after canceling."],
      ["hole", "A single missing point of the graph where a factor cancels from the numerator and the denominator."],
      ["horizontal asymptote", "A horizontal line $y=h$ that the graph approaches as $x$ becomes very large in magnitude."],
      ["domain", "The set of inputs for which the function is defined."],
    ],
    method: [
      "Find all zeros of the denominator. These are the inputs left out of the domain.",
      "Cancel common factors. A zero whose factor cancels is a hole; a zero whose factor remains is a vertical asymptote.",
      "For the horizontal asymptote, compare the numerator's degree with the denominator's. If the numerator's is smaller the asymptote is $y=0$; if they are equal it is the ratio of leading coefficients; if the numerator's is larger there is none.",
      "The $x$-intercepts are zeros of the numerator that do not cancel. The $y$-intercept is $f(0)$.",
    ],
    watch:
      "A common factor gives a hole, not an asymptote, but the hole's input is still excluded from the domain and is never an intercept.",
  },
  "graphical-solution-table": {
    goal: "Given two functions and a table of their values, find where $f(x)=g(x)$: exactly, between two consecutive inputs, or to the nearest tenth.",
    intuition:
      "A solution of $f(x)=g(x)$ is an input at which both functions give the same output. On graphs these are the $x$-coordinates of the points where the two curves meet. In a table, watch which function is larger: if $f$ is above $g$ in one row and below it in the next, the curves must have crossed in between.",
    terms: [
      ["solution of $f(x)=g(x)$", "An input $x$ at which $f(x)$ and $g(x)$ are equal; it is the horizontal coordinate of an intersection, not the shared output."],
      ["bracket", "Two inputs, close together, such that $f-g$ has opposite signs at them; a solution lies between them."],
    ],
    method: [
      "In each row, compare $f(x)$ with $g(x)$ and note which is larger.",
      "If the outputs are equal in a row, that input is a solution. Otherwise find the two consecutive rows where the larger function switches: the solution is between those inputs.",
      "To refine, use a finer table of the bracketed inputs and repeat. A midpoint row shows which half contains the change, and the nearest tenth is the end of that half.",
    ],
    watch:
      "Report the input $x$, not the shared output. When no row has equal outputs, a switch in which function is larger signals the solution between rows.",
  },
  "polynomial-identity-use": {
    goal: "Use an identity to compute a number quickly, to build a Pythagorean triple, or to decide which equation is true for every value of $x$.",
    intuition:
      "An identity is an equation that is true for every value of its variables, such as $(a+b)^2=a^2+2ab+b^2$. Unlike an equation you solve, you can use an identity as a shortcut: replace a hard product with an easier equal expression, or test whether a proposed rewrite is really equal.",
    terms: [
      ["identity", "An equation that holds for all values of its variables, so both sides always have the same value."],
      ["difference of squares", "The expression $a^2-b^2$, which equals $(a+b)(a-b)$."],
    ],
    method: [
      "Match the problem to an identity: a square of a sum or difference, a product $(a+b)(a-b)$, or a relation among given sums and products.",
      "Choose $a$ and $b$ so the arithmetic is easy, such as a round number and a small adjustment.",
      "Substitute into the identity and compute each term. To test an equation, expand the left side and compare every term, or try a value of $x$.",
    ],
    watch:
      "A square of a two-term sum has three terms: the middle term $2ab$ is easy to leave out. One value of $x$ that makes both sides agree does not prove an identity, but one that makes them differ shows it is false.",
  },
  "binomial-coefficient": {
    goal: "Find a coefficient of $(ax+b)^n$ for $n\\le7$, including a negative $b$, the constant term and the leading term, or choose the row of Pascal's triangle that holds the coefficients.",
    intuition:
      "$(ax+b)^n$ means multiplying $n$ copies of $ax+b$. Each term of the product chooses either $ax$ or $b$ from every copy. The term with $x^k$ picks $ax$ from $k$ copies and $b$ from the other $n-k$, and the number of ways to choose which $k$ copies is the binomial coefficient, a row entry of Pascal's triangle.",
    terms: [
      ["binomial", "A sum of two terms, such as $ax+b$."],
      ["binomial coefficient $\\binom{n}{k}$", "The number of ways to choose $k$ items from $n$; entry $k$ of row $n$ of Pascal's triangle, counting from 0."],
      ["Pascal's triangle", "Rows of numbers in which each entry is the sum of the two entries above it. Row 0 is $1$, row 1 is $1,\\ 1$, row 2 is $1,\\ 2,\\ 1$."],
    ],
    method: [
      "Write the term with $x^k$ as $\\binom{n}{k}(ax)^k b^{\\,n-k}$.",
      "Take $\\binom{n}{k}$ from row $n$ of Pascal's triangle, counting both the row and the entry from 0.",
      "Raise $a$ to the power $k$ and $b$ to the power $n-k$, keeping the sign of $b$: an odd power of a negative number is negative.",
      "Multiply the three numbers. The coefficient of the constant term is $b^n$ and of $x^n$ is $a^n$.",
    ],
    watch:
      "The coefficient includes $a^k$ as well as the power of $b$, and the exponents add to $n$: the power of $b$ is $n-k$, not $k$.",
  },
  "number-system-closure-classify": {
    goal: "Decide whether a sum or product involving rational and irrational numbers is rational or irrational.",
    intuition:
      "A rational number can be written as a fraction of two integers; an irrational number cannot. Sums, differences, products and quotients (not by zero) of rational numbers are rational. Mixing in an irrational number usually keeps the result irrational, because otherwise you could undo the operation and get the irrational number from rational ones. Two irrational numbers can still combine to a rational number, as when opposites cancel.",
    terms: [
      ["rational number", "A number equal to $\\frac{p}{q}$ for integers $p$ and $q\\ne0$."],
      ["irrational number", "A real number that is not rational, such as $\\sqrt2$ or $\\pi$."],
    ],
    method: [
      "Rational plus irrational is irrational. Suppose the sum were rational; subtracting the rational number would make the irrational one rational, which is impossible.",
      "A nonzero rational times an irrational is irrational by the same argument with division. If the rational factor is 0, the product is 0, which is rational.",
      "With two irrational numbers, simplify before deciding: $\\sqrt{k}+(-\\sqrt{k})=0$ and $\\sqrt{k}\\cdot\\sqrt{k}=k$ are rational, while $\\sqrt2+\\sqrt3$ is irrational. The result can be either.",
    ],
    watch:
      "A decimal approximation of an irrational number is not the number: the exact decimal never ends or repeats. The zero factor is the one exception for a product with a rational number.",
  },
};

export const functionBehaviorPrinciples: Record<string, string> = {
  "polynomial-behavior-description":
    "For a polynomial of degree $n$ with leading coefficient $c\\ne0$, the ends of the graph are governed by $cx^n$. A zero $r$ of multiplicity $m$ has factor $(x-r)^m$ and the sign of the polynomial changes there exactly when $m$ is odd. A polynomial of degree $n$ has at most $n-1$ turning points and at most $n$ real zeros counted with multiplicity.",
  "rational-function-features":
    "For $f=p/q$ with polynomials $p$ and $q$ and $q\\ne0$ as a polynomial, the domain excludes the zeros of $q$. After removing all common factors, a zero of the denominator gives a vertical asymptote and a canceled factor gives a hole. If $\\deg p<\\deg q$ the horizontal asymptote is $y=0$; if the degrees are equal it is the ratio of leading coefficients; if $\\deg p>\\deg q$ there is none.",
  "graphical-solution-table":
    "The solutions of $f(x)=g(x)$ are the zeros of $h=f-g$. For continuous $f$ and $g$, if $h(a)$ and $h(b)$ have opposite signs, there is a solution between $a$ and $b$ (the intermediate value theorem). Repeating the test on smaller intervals narrows the solution to any chosen precision.",
  "polynomial-identity-use":
    "The identities $(a+b)^2=a^2+2ab+b^2$, $(a-b)^2=a^2-2ab+b^2$, $a^2-b^2=(a+b)(a-b)$ and $(x^2+y^2)^2=(x^2-y^2)^2+(2xy)^2$ hold for all numbers $a$, $b$, $x$ and $y$. Two polynomials are identical when all their coefficients agree.",
  "binomial-coefficient":
    "For a nonnegative integer $n$, $(a+b)^n=\\sum_{k=0}^{n}\\binom{n}{k}a^k b^{n-k}$, where $\\binom{n}{k}=\\frac{n!}{k!(n-k)!}$ counts the ways to choose $k$ of the $n$ factors. These coefficients are the entries of row $n$ of Pascal's triangle, with $\\binom{n+1}{k}=\\binom{n}{k-1}+\\binom{n}{k}$.",
  "number-system-closure-classify":
    "The rational numbers are closed under addition, subtraction, multiplication and division by a nonzero number. If $q$ is rational and $x$ is irrational, then $q+x$ is irrational, and $qx$ is irrational when $q\\ne0$. The sum or product of two irrational numbers can be rational or irrational.",
};

export const functionBehaviorLessons: Lesson[] = [
  {
    id: "polynomial-behavior-description",
    title: "How a polynomial graph behaves",
    summary:
      "The degree and leading coefficient decide the ends; each zero's multiplicity decides whether the graph crosses or touches the axis there.",
    templateIds: ["polynomial-behavior-description"],
    objectives: [
      "Find the degree and leading coefficient of a factored polynomial.",
      "Describe the end behavior and the crossing or touching at each zero.",
      "State the greatest number of turning points for a given degree.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Large inputs and repeated factors",
        paragraphs: [
          "A polynomial is a sum of terms such as $x^3$ and $5x$. Its degree is the highest power of $x$. For a very large $x$ such as 1000, $x^3$ is a billion while $5x$ is only 5000, so the highest power controls the picture at the far left and right.",
          "A zero is an input where the polynomial equals 0. A factor $(x-r)$ appears $m$ times if the polynomial has $(x-r)^m$; $m$ is the multiplicity. One copy changes sign at $r$, two copies change it twice and so return to the same sign.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Let $P(x)=-2(x+1)^{3}x^{2}(x-3)$. Describe the ends, the behavior at each zero, and the greatest number of turning points of a polynomial of this degree.",
      steps: [
        "Add the exponents: $3+2+1=6$. The degree is 6, which is even.",
        "The leading coefficient is $-2$, which is negative. An even degree with a negative leading coefficient falls on both the left and the right.",
        "The zero $x=-1$ has multiplicity 3 (odd), so the graph crosses the axis there. The zero $x=0$ has multiplicity 2 (even), so it touches the axis and turns back. The zero $x=3$ has multiplicity 1, so it crosses.",
        "A polynomial of degree 6 has at most $6-1=5$ turning points.",
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
          "Only the term with the highest power matters at the ends. If the degree is even, both ends go the same way: up when the leading coefficient is positive, down when it is negative. If the degree is odd, the ends go opposite ways: positive coefficients fall on the left and rise on the right, negative coefficients do the reverse.",
          "If the polynomial is written as a sum with its terms out of order, find the term with the highest exponent first.",
        ],
      },
      {
        stage: "formal",
        title: "Multiplicity and turning points",
        paragraphs: [
          "If $P(x)=(x-r)^m Q(x)$ with $Q(r)\\ne0$, then near $r$ the polynomial behaves like $Q(r)(x-r)^m$. This changes sign at $r$ exactly when $m$ is odd. For odd $m\\ge3$ the graph still crosses, but flattens as it passes through.",
          "A polynomial of degree $n$ has at most $n-1$ turning points, because its slope is a polynomial of degree $n-1$ with at most $n-1$ zeros. Some polynomials of degree $n$ have fewer: $x^3$ has none.",
        ],
      },
    ],
    pitfalls: [
      "Add all exponents for the degree; counting the different zeros gives the wrong parity.",
      "An odd multiplicity of 3 still crosses the axis; only even multiplicities touch and turn back.",
      "The degree bounds the number of zeros; the bound on turning points is one less.",
    ],
    parentGuide:
      "Ask the learner what the degree of $(x-1)^2(x+2)$ is, and whether the graph crosses or touches the axis at 1.",
  },
  {
    id: "rational-function-features",
    title: "Asymptotes, holes and intercepts",
    summary:
      "Factor a rational function, cancel common factors, and read its asymptotes, hole, intercepts and domain from the factors.",
    templateIds: ["rational-function-features"],
    objectives: [
      "Tell a vertical asymptote from a hole by canceling common factors.",
      "Find the horizontal asymptote by comparing degrees.",
      "Find the intercepts and the domain.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A fraction of two polynomials",
        paragraphs: [
          "A rational function divides one polynomial by another, such as $f(x)=\\dfrac{2(x-1)}{(x-1)(x+3)}$. A fraction is undefined when its denominator is 0, so $x=1$ and $x=-3$ are not in the domain, the set of allowed inputs.",
          "Near $x=-3$ the denominator is close to 0, so the outputs become very large and the graph runs along the vertical line $x=-3$, a vertical asymptote. The factor $(x-1)$ is in both parts. After it cancels, the function is $\\dfrac{2}{x+3}$ for $x\\ne1$, so the graph is smooth at $x=1$ except for one missing point, a hole.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "For $f(x)=\\dfrac{2(x-1)}{(x-1)(x+3)}$, find the vertical asymptote, the hole, the horizontal asymptote and the domain.",
      steps: [
        "The denominator is 0 at $x=1$ and $x=-3$, so the domain is all real numbers except $x=1$ and $x=-3$.",
        "The factor $(x-1)$ cancels, leaving $\\dfrac{2}{x+3}$. The zero $x=-3$ remains in the denominator: a vertical asymptote at $x=-3$.",
        "The canceled factor gives a hole at $x=1$, with height $\\dfrac{2}{1+3}=\\dfrac12$: the hole is $(1,\\ \\frac12)$.",
        "The numerator has degree 1 and the denominator has degree 2, so the denominator grows faster and the horizontal asymptote is $y=0$.",
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
          "An $x$-intercept is where the graph meets the $x$-axis, so the function equals 0: use zeros of the numerator that remain after canceling. The $y$-intercept is the point on the $y$-axis, $f(0)$, found by substituting $x=0$ into every factor.",
          "For the horizontal asymptote, compare the degrees. A smaller numerator degree gives $y=0$. Equal degrees give $y=\\dfrac{\\text{numerator leading coefficient}}{\\text{denominator leading coefficient}}$. A larger numerator degree gives no horizontal asymptote.",
        ],
      },
      {
        stage: "formal",
        title: "Why the degrees decide",
        paragraphs: [
          "For very large $|x|$, a polynomial is close to its leading term. So $p/q$ is close to $\\dfrac{c x^m}{d x^n}=\\dfrac{c}{d}x^{m-n}$. This tends to 0 when $m<n$, equals $c/d$ when $m=n$, and grows without bound when $m>n$.",
          "A hole at $x=c$ has height $\\lim_{x\\to c}f(x)$, the value of the simplified function at $c$. The original function is not defined at $c$.",
        ],
      },
    ],
    pitfalls: [
      "A canceled factor is a hole: it is not an asymptote, and not an intercept.",
      "A hole's input is still outside the domain.",
      "A factor $(x-c)$ is zero at $x=c$; keep the sign.",
    ],
    parentGuide:
      "Ask the learner which factor cancels in $\\dfrac{(x-2)(x+1)}{(x-2)(x-4)}$ and what that does to the graph at $x=2$.",
  },
  {
    id: "graphical-solution-table",
    title: "Solve f(x) = g(x) with a table",
    summary:
      "The solutions of $f(x)=g(x)$ are the inputs where the two outputs match. A table shows an exact match or the step where one function overtakes the other.",
    templateIds: ["graphical-solution-table"],
    objectives: [
      "Read an exact solution from a table of two functions.",
      "Bracket a solution between consecutive inputs.",
      "Refine a bracket to the nearest tenth.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Where two outputs match",
        paragraphs: [
          "Two functions $f$ and $g$ each give an output for every input $x$. The equation $f(x)=g(x)$ asks for an input where the outputs are the same. On graphs, these inputs are the $x$-coordinates of the points where the curves meet.",
          "Between two rows of a table, a graph can move from above the other to below it only by crossing. So if $f$ is the larger function in one row and the smaller in the next, a solution lies between the two inputs.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Let $f(x)=x^2-3$ and $g(x)=4x-4$. At which consecutive integers does a solution of $f(x)=g(x)$ lie? Use values at $x=0$ and $x=1$.",
      steps: [
        "At $x=0$: $f(0)=-3$ and $g(0)=-4$. Since $-3>-4$, $f$ is above $g$.",
        "At $x=1$: $f(1)=-2$ and $g(1)=0$. Since $-2<0$, $f$ is below $g$.",
        "The larger function changed between the two inputs, so the graphs crossed there: the solution is between $x=0$ and $x=1$.",
        "Check with algebra: $x^2-3=4x-4$ gives $x^2-4x+1=0$, whose solutions are $2\\pm\\sqrt3$, about $0.27$ and $3.73$. The first lies between 0 and 1.",
      ],
      answer: "Between $x=0$ and $x=1$",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Narrowing the interval",
        paragraphs: [
          "To get the solution to the nearest tenth, make a table of tenths between the two inputs, find the tenth step where the larger function changes, then look at the midpoint of that step. If the change is before the midpoint, the nearest tenth is the lower end; otherwise it is the upper end.",
          "If the outputs are exactly equal in a row, that input is the solution. The common output is the height of the intersection and is not the solution.",
        ],
      },
      {
        stage: "formal",
        title: "Why a change of order means a solution",
        paragraphs: [
          "Let $h(x)=f(x)-g(x)$. A solution of $f(x)=g(x)$ is a zero of $h$. If $f$ and $g$ are continuous and $h(a)$ and $h(b)$ have opposite signs, then $h$ is zero somewhere between $a$ and $b$ (the intermediate value theorem).",
          "Halving the interval and testing the sign at the midpoint keeps a solution inside an interval half as long each time.",
        ],
      },
    ],
    pitfalls: [
      "Give the input $x$, not the shared output.",
      "Compare the functions row by row; a smaller output of $f$ alone does not locate the solution.",
      "After bracketing, check the midpoint before rounding to a tenth.",
    ],
    parentGuide:
      "Ask the learner to say, row by row, which of two functions is larger, and where that changes.",
  },
  {
    id: "polynomial-identity-use",
    title: "Use a polynomial identity",
    summary:
      "An identity is true for every value of its variables, so it can replace a hard product with an easy one or check a proposed rewrite.",
    templateIds: ["polynomial-identity-use"],
    objectives: [
      "Compute squares and products quickly with $(a+b)^2$ and $a^2-b^2$.",
      "Build a Pythagorean triple from $(x^2+y^2)^2=(x^2-y^2)^2+(2xy)^2$.",
      "Decide which equation is true for every $x$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A true equation for every value",
        paragraphs: [
          "Most equations are true only for some values: $x+2=5$ is true only for $x=3$. An identity is true for every value. For example $(a+b)^2=a^2+2ab+b^2$ holds for all numbers $a$ and $b$, so you can use it as a rule.",
          "Because the rule is always true, it lets you pick friendly numbers: to find $52^2$, write $52=50+2$ and compute $50^2+2\\cdot50\\cdot2+2^2$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Use an identity to find $52^2$.",
      steps: [
        "Write $52=50+2$, so $a=50$ and $b=2$ in $(a+b)^2=a^2+2ab+b^2$.",
        "Compute the three terms: $a^2=2500$, $2ab=2\\cdot50\\cdot2=200$, $b^2=4$.",
        "Add: $2500+200+4=2704$.",
        "Check: $52\\cdot52=50\\cdot52+2\\cdot52=2600+104=2704$.",
      ],
      answer: "$2704$",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Other identities and testing an equation",
        paragraphs: [
          "The identity $a^2-b^2=(a+b)(a-b)$ turns $43\\cdot37=(40+3)(40-3)$ into $1600-9=1591$. It also gives $x^2-y^2=(x+y)(x-y)$ from the values of $x+y$ and $x-y$. From $(x+y)^2=x^2+2xy+y^2$ you get $x^2+y^2=(x+y)^2-2xy$.",
          "With $x$ and $y$ whole numbers, $(x^2-y^2,\\ 2xy,\\ x^2+y^2)$ is a Pythagorean triple: for $x=2$ and $y=1$ it is $3,\\ 4,\\ 5$.",
          "To test whether an equation is an identity, expand one side and compare every term. Substituting a value such as $x=1$ can show an equation is false but cannot prove it true.",
        ],
      },
      {
        stage: "formal",
        title: "Why identities hold",
        paragraphs: [
          "Multiplying $(a+b)(a+b)$ by distribution gives $a^2+ab+ba+b^2=a^2+2ab+b^2$. Replacing $b$ by $-b$ gives $(a-b)^2=a^2-2ab+b^2$. Multiplying $(a+b)(a-b)$ gives $a^2-ab+ba-b^2=a^2-b^2$.",
          "For the triple, expanding gives $(x^2-y^2)^2+(2xy)^2=x^4-2x^2y^2+y^4+4x^2y^2=x^4+2x^2y^2+y^4=(x^2+y^2)^2$.",
        ],
      },
    ],
    pitfalls: [
      "$(a+b)^2$ has the middle term $2ab$; it is not $a^2+b^2$.",
      "A difference of squares has no middle term, and the second square is subtracted.",
      "Check that the numbers in a Pythagorean triple are the two legs and the hypotenuse, with the longest side last.",
    ],
    parentGuide:
      "Ask the learner to compute $49\\cdot51$ by writing it as $(50-1)(50+1)$.",
  },
  {
    id: "binomial-coefficient",
    title: "Coefficients of (ax + b)^n",
    summary:
      "Each term of a binomial power picks $ax$ or $b$ from every factor; Pascal's triangle counts the ways.",
    templateIds: ["binomial-coefficient"],
    objectives: [
      "Find a coefficient of $(ax+b)^n$ for $n\\le7$.",
      "Handle a negative $b$, the constant term and the leading term.",
      "Read the coefficients from a row of Pascal's triangle.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Choosing a term from every factor",
        paragraphs: [
          "A binomial is a sum of two terms such as $x+2$. A power such as $(x+2)^3$ means $(x+2)(x+2)(x+2)$. Multiplying out, every term picks either $x$ or $2$ from each of the three factors.",
          "The term with $x^2$ picks $x$ from two factors and $2$ from one. There are 3 choices for which factor gives the 2, so the term is $3\\cdot x^2\\cdot2=6x^2$. The number of choices is the binomial coefficient, found in Pascal's triangle.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find the coefficient of $x^2$ in $(2x-3)^4$.",
      steps: [
        "Row 4 of Pascal's triangle, counting the top row as row 0, is $1,\\ 4,\\ 6,\\ 4,\\ 1$. The term with $x^2$ uses entry 2, which is $6$.",
        "The term is $\\binom{4}{2}(2x)^2(-3)^2$. Here $(2x)^2$ has coefficient $4$ and $(-3)^2=9$.",
        "Multiply: $6\\cdot4\\cdot9=216$.",
        "Check the sign: an even power of $-3$ is positive.",
      ],
      answer: "$216$",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Building the row and handling edge terms",
        paragraphs: [
          "Each entry of Pascal's triangle is the sum of the two entries above it: row 3 is $1,\\ 3,\\ 3,\\ 1$ and row 4 is $1,\\ 4,\\ 6,\\ 4,\\ 1$. Row $n$ lists the coefficients of $(x+y)^n$.",
          "The constant term of $(ax+b)^n$ is $b^n$ and the coefficient of $x^n$ is $a^n$. A negative $b$ makes the sign of a term depend on whether its power of $b$ is odd or even.",
        ],
      },
      {
        stage: "formal",
        title: "The binomial theorem",
        paragraphs: [
          "For a nonnegative integer $n$, $(a+b)^n=\\sum_{k=0}^{n}\\binom{n}{k}a^kb^{n-k}$, where $\\binom{n}{k}=\\dfrac{n!}{k!\\,(n-k)!}$ is the number of ways to choose $k$ of the $n$ factors to give $a$.",
          "The coefficient of $x^k$ in $(ax+b)^n$ is $\\binom{n}{k}a^kb^{n-k}$. The coefficients obey $\\binom{n+1}{k}=\\binom{n}{k-1}+\\binom{n}{k}$, which is the rule of Pascal's triangle.",
        ],
      },
    ],
    pitfalls: [
      "Raise $a$ to the power $k$ too, not only $b$.",
      "The power of $b$ is $n-k$; the two exponents add to $n$.",
      "Count rows and entries of Pascal's triangle from 0.",
    ],
    parentGuide:
      "Ask the learner to expand $(x+1)^3$ by building row 3 of Pascal's triangle.",
  },
  {
    id: "number-system-closure-classify",
    title: "Rational and irrational sums and products",
    summary:
      "A rational number plus an irrational number is irrational, and a nonzero rational times an irrational is irrational. Two irrational numbers can combine to a rational one.",
    templateIds: ["number-system-closure-classify"],
    objectives: [
      "Classify sums and products of a rational and an irrational number.",
      "Recognize the zero exception.",
      "Give examples of two irrational numbers with a rational sum or product.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which operations keep a number rational",
        paragraphs: [
          "A rational number is a number that can be written as a fraction of two integers, such as $\\frac34$ or $-5$. An irrational number cannot, for example $\\sqrt2$ and $\\pi$; its decimal never ends or repeats.",
          "Adding, subtracting, multiplying or dividing (by a nonzero number) two rational numbers always gives a rational number. When an irrational number is mixed in, the result stays irrational in most cases, because you could otherwise undo the operation and get the irrational number from rational ones.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Is $\\frac12+\\sqrt3$ rational or irrational? Is $\\sqrt3+(-\\sqrt3)$?",
      steps: [
        "Suppose $\\frac12+\\sqrt3=q$ for a rational $q$. Then $\\sqrt3=q-\\frac12$, a difference of two rational numbers, which is rational.",
        "That contradicts the fact that $\\sqrt3$ is irrational, so $\\frac12+\\sqrt3$ is irrational.",
        "For $\\sqrt3+(-\\sqrt3)$, both numbers are irrational, but they are opposites, so their sum is $0$.",
        "The number $0=\\frac01$ is rational, so the sum of two irrational numbers can be rational.",
      ],
      answer: "$\\frac12+\\sqrt3$ is irrational; $\\sqrt3+(-\\sqrt3)=0$ is rational",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Products, and two irrational numbers",
        paragraphs: [
          "A nonzero rational times an irrational is irrational: if $q\\sqrt3$ were rational, dividing by $q$ would make $\\sqrt3$ rational. If $q=0$ the product is $0$, a rational number, so the nonzero condition is needed.",
          "Two irrational numbers can have a rational product: $\\sqrt3\\cdot\\sqrt3=3$ and $\\sqrt2\\cdot\\sqrt8=\\sqrt{16}=4$. They can also have an irrational one: $\\sqrt2\\cdot\\sqrt3=\\sqrt6$. Simplify before deciding.",
        ],
      },
      {
        stage: "formal",
        title: "Closure and the zero exception",
        paragraphs: [
          "Let $q$ be rational and $x$ irrational. If $q+x$ were rational, then $x=(q+x)-q$ would be rational, a contradiction. If $q\\ne0$ and $qx$ were rational, then $x=(qx)/q$ would be rational, a contradiction.",
          "A set is closed under an operation if combining any two members gives a member. The rational numbers are closed under addition, subtraction, multiplication and division by a nonzero number. The irrational numbers are not closed under any of these: $\\sqrt2+(-\\sqrt2)=0$ and $\\sqrt2\\cdot\\sqrt2=2$.",
        ],
      },
    ],
    pitfalls: [
      "A decimal approximation of an irrational number does not make it rational.",
      "Rational times irrational is irrational only when the rational factor is not zero.",
      "A sum or product of two irrational numbers can be rational, so simplify before deciding.",
    ],
    parentGuide:
      "Ask the learner why $2\\sqrt5$ cannot be rational, using division by 2.",
  },
];
