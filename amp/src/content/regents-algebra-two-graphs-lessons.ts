import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { lesson, m } from "./regents-algebra-two-reasoning-lessons";

export const regentsAlgebraTwoGraphMethods: Record<string, ProblemMethod> = {
  "log-base-fraction-graph": m(
    "Choose the graph of a logarithm whose base is between 0 and 1.",
    "Every logarithm graph passes through $(1,0)$ and stays to the right of the $y$-axis. With a base greater than 1 it rises; with a base between 0 and 1 it falls, because larger inputs give smaller logarithms.",
    [["logarithm", "The base is the number $b$ in $\\log_b x$."]],
    [
      "Check that the graph passes through $(1,0)$ and lies right of the $y$-axis.",
      "Decide from the base whether it rises or falls.",
      "Rule out exponential curves, which pass through $(0,1)$.",
    ],
    "A falling curve through $(0,1)$ is an exponential decay, not a logarithm.",
  ),
  "remainder-zero-graph": m(
    "Use the remainder theorem to find the graph with remainder 0.",
    "A polynomial is a sum of terms like $x^3$ and $-4x$. Dividing a polynomial $p(x)$ by $x-r$ leaves a remainder, the number left over. The remainder theorem says it equals $p(r)$, the height of the graph at $x=r$. So the remainder is zero exactly when the graph meets the $x$-axis at $x=r$.",
    ["remainder-theorem", "zero-of-a-function"],
    [
      "Find $r$ from the divisor: $x-r$ gives $r$, and $x+r$ gives $-r$. The remainder is $p(r)$.",
      "Read the height of each graph at $x=r$.",
      "Choose the graph whose height is exactly 0 there.",
    ],
    "The divisor $x+3$ has $r=-3$, not 3. A graph that is close to the axis at $r$ is not enough: the height must be exactly 0.",
  ),
  "repeated-zero-rule": m(
    "Write a factored rule from a graph's zeros, the way it meets the axis there, and its end behavior.",
    "A zero is an input where the graph meets the $x$-axis, and each zero $r$ gives a factor $(x-r)$. The exponent on a factor, the small raised number, counts its copies. In these graphs, a zero where the graph touches the axis and turns back comes from a squared factor, and one where it crosses comes from a factor that appears once. The leading coefficient, the number in front, is negative when the right-hand end falls.",
    ["multiplicity", "leading-coefficient"],
    [
      "List the zeros, and mark which ones the graph touches and which it crosses.",
      "Write a factor $(x-r)$ for each zero, and square the factor of the touching zero.",
      "Use a negative sign in front if the graph falls to the right.",
    ],
    "A factor $(x-r)$ gives the zero $r$, with the opposite sign inside. The squared factor belongs to the touching zero.",
  ),
  "sinusoid-compare-rule": m(
    "Compare the maximum and frequency of a graphed sine with those of a function given by a rule.",
    "For $A\\sin(Bx)$ the maximum is $A$ and the period is $\\frac{2\\pi}{B}$. Frequency is how many cycles fit in a unit of length, the reciprocal of the period, so a shorter period means a greater frequency.",
    ["amplitude", "frequency-wave"],
    [
      "Read the maximum and the period from the graph.",
      "Find them for the rule: maximum $A$, period $\\frac{2\\pi}{B}$.",
      "Compare maxima, then compare periods and reverse the order to compare frequencies.",
    ],
    "A greater period means a smaller frequency. The maximum is $A$, not $B$.",
  ),
  "tide-cosine-equation": m(
    "Write $y=A\\cos(Bx)+D$ from the maximum, minimum and period of a graph.",
    "The midline is halfway between the minimum and the maximum, and the amplitude is half their distance. The period gives $B=\\frac{2\\pi}{\\text{period}}$. A graph that starts at a maximum is a cosine, and one that starts at a minimum is a negative cosine.",
    ["midline", "period"],
    [
      "Compute the midline and amplitude from the extremes.",
      "Compute $B$ from the period.",
      "Choose cosine or negative cosine from the starting point.",
    ],
    "A sine starts on the midline, a cosine at an extreme. The midline is added, not used as the amplitude.",
  ),
  "cubic-graph-statement": m(
    "Read end behavior, zeros with multiplicity and increasing intervals from the graph of a cubic.",
    "A zero is an input where the graph meets the $x$-axis, and its multiplicity is how many times its factor appears. In these graphs, a zero where the graph touches the axis and turns back has multiplicity 2, and one where it crosses has multiplicity 1. Reading left to right, the function is increasing where the graph goes up, and turning points mark where that changes. End behavior is what the graph does far to the left and right.",
    ["end-behavior", "increasing"],
    [
      "Find the zeros, and whether the graph touches or crosses at each.",
      "Find the turning points and the end behavior.",
      "Check each statement against these features.",
    ],
    "Touching is not crossing. Read intervals of increase from left to right: they can lie between turning points or run off to either end.",
  ),
};

export const regentsAlgebraTwoGraphPrinciples: Record<string, string> = {
  "log-base-fraction-graph":
    "For $b>0$, $b\\ne1$, the graph of $y=\\log_b x$ is defined for $x>0$, passes through $(1,0)$, rises if $b>1$ and falls if $0<b<1$. Also $\\log_{1/b}x=-\\log_b x$.",
  "remainder-zero-graph":
    "The remainder theorem says $p(x)=(x-r)q(x)+p(r)$, so the remainder is $p(r)$ and $x-r$ is a factor exactly when $p(r)=0$, that is, when the graph meets the $x$-axis at $x=r$.",
  "repeated-zero-rule":
    "If $p(x)=(x-r)^m q(x)$ with $q(r)\\ne0$ ($\\ne$ means is not equal to), the zero $r$ has multiplicity $m$: the graph crosses the axis at $r$ when $m$ is odd and touches it when $m$ is even. The graph falls to the right when the leading coefficient of $p$ is negative.",
  "sinusoid-compare-rule":
    "The function $A\\sin(Bx)$ with $A,B>0$ has maximum $A$, period $\\frac{2\\pi}{B}$ and frequency $\\frac{B}{2\\pi}$, the reciprocal of the period.",
  "tide-cosine-equation":
    "A sinusoid with maximum $M$, minimum $m$ and period $P$ that starts at its maximum is $y=\\frac{M-m}{2}\\cos\\left(\\frac{2\\pi}{P}x\\right)+\\frac{M+m}{2}$; one that starts at its minimum has the negative amplitude.",
  "cubic-graph-statement":
    "For different numbers $a$ and $b$ and $k\\ne0$, the cubic $k(x-a)^2(x-b)$ has a zero of multiplicity 2 at $a$ and of multiplicity 1 at $b$. If $k>0$ then $f\\to\\infty$ as $x\\to\\infty$ and $f\\to-\\infty$ as $x\\to-\\infty$, and the reverse if $k<0$. Its turning points are where the graph changes between rising and falling.",
};

export const regentsAlgebraTwoGraphLessons = [
  lesson(
    "regents-log-base-fraction-graph",
    "Graphs of logarithms with a base below 1",
    "Choose the logarithm graph that falls and passes through $(1,0)$.",
    ["log-base-fraction-graph"],
    [
      "Recognize the common features of logarithm graphs.",
      "Decide from the base whether the graph rises or falls.",
    ],
    [
      "A logarithm answers the question: to what power must the base be raised to get $x$? Since $b^0=1$, the graph always passes through $(1,0)$, and since powers of a positive base are positive, the graph lies to the right of the $y$-axis.",
      "If the base is less than 1, raising it to bigger powers gives smaller numbers, so the logarithm falls as $x$ grows.",
    ],
    {
      prompt:
        "Which of a rising curve through $(1,0)$ and a falling curve through $(1,0)$ is the graph of $y=\\log_{1/2}x$?",
      steps: [
        "Both pass through $(1,0)$.",
        "The base $\\frac{1}{2}$ is less than 1.",
        "So the logarithm falls: the falling curve.",
      ],
      answer: "the falling curve through $(1,0)$",
    },
    [
      "Look for $(1,0)$ and a curve right of the $y$-axis.",
      "Use the base to choose rising or falling.",
      "Reject curves through $(0,1)$.",
    ],
    [
      "$\\log_{1/b}x=\\frac{\\ln x}{\\ln(1/b)}=-\\log_b x$, so the graph is the reflection of $y=\\log_b x$ over the $x$-axis.",
    ],
    [
      "An exponential graph also falls but passes through $(0,1)$.",
      "The base below 1 does not move the graph left or right.",
      "A logarithm is not defined for $x\\le0$.",
    ],
    "Ask your learner which point every logarithm graph passes through.",
  ),
  lesson(
    "regents-remainder-zero-graph",
    "Remainder zero and the graph",
    "A polynomial is a sum of terms like $x^3$ and $-4x$, and $p(x)$, read “$p$ of $x$”, is its value at input $x$. Dividing $p(x)$ by $x - r$ leaves a remainder, the number left over, equal to $p(r)$. That is the height of the graph at $x = r$. So the remainder is 0 exactly when the graph meets the $x$-axis at $x = r$.",
    ["remainder-zero-graph"],
    [
      "Use the remainder theorem: the remainder of $p(x) \\div (x - r)$ is $p(r)$.",
      "Find the graph whose height is 0 at $x = r$.",
    ],
    [
      "Dividing a polynomial $p(x)$ by $x - r$ gives a quotient, the main result, and a remainder, the number left over. The remainder theorem says the remainder equals $p(r)$, the value of $p$ when the input is $r$. On the graph, $p(r)$ is the height of the curve at $x = r$.",
      "So the remainder is 0 exactly when the graph meets the $x$-axis, the line where the height is 0, at $x = r$. The graph may cross the axis there, or touch it and turn back.",
      "Read $r$ from the divisor carefully: $x - 4$ gives $r = 4$, and $x + 3 = x - (-3)$ gives $r = -3$.",
    ],
    {
      prompt:
        "For which graph is the remainder 0 when $p(x)$ is divided by $x-4$?",
      steps: [
        "By the remainder theorem, the remainder on dividing by $x - 4$ is $p(4)$, the height of the graph at $x = 4$.",
        "The remainder is 0 exactly when that height is 0, so we need a graph that meets the $x$-axis at $x = 4$.",
        "Only one of the graphs meets the axis at 4, and it crosses there. A graph that touched the axis at 4 would also have remainder 0.",
      ],
      answer: "the graph that crosses the axis at 4",
    },
    [
      "Write the remainder as $p(r)$, where $r$ makes the divisor $x - r$ zero.",
      "Find $r$ from the divisor: $x - r$ gives $r$, and $x + r$ gives $-r$.",
      "Check the height of each graph at $x = r$, and choose the one where it is exactly 0.",
    ],
    [
      "Since $p(x) = (x - r)q(x) + p(r)$, if $p(r) = 0$ then $x - r$ is a factor of $p(x)$. This is called the factor theorem.",
    ],
    [
      "For $x + 3$ the number $r$ is $-3$.",
      "A graph that only passes near the axis at $r$ does not have remainder 0: the height must be exactly 0.",
      "A graph shifted up or down at $r$ has a remainder that is not 0.",
    ],
    "Ask your learner to read $p(r)$, the height at $x = r$, on each graph, and say which one is 0.",
  ),
  lesson(
    "regents-repeated-zero-rule",
    "A rule from a graph with a double zero",
    "A cubic is a polynomial whose highest power is $x^3$. Its graph meets the $x$-axis at its zeros, the inputs that make it 0, and each zero $r$ gives a factor $(x - r)$. Where the graph touches the axis and turns back, the factor is squared; where it crosses, the factor appears once. The right end of the graph gives the sign of the leading coefficient, the number in front.",
    ["repeated-zero-rule"],
    [
      "Write a factor for each zero, and square the factor of a zero where the graph touches the axis.",
      "Choose the sign in front from the right-hand end of the graph.",
    ],
    [
      "A zero of a polynomial is an input that makes it 0, so the graph meets the $x$-axis there. Each zero $r$ gives a factor $(x - r)$, a part being multiplied: the zero $-1$ gives $(x + 1)$.",
      "The exponent on a factor, the small raised number, counts its copies. In these problems the graph crosses the axis where a factor appears once, and touches the axis and turns back where a factor is squared. A squared factor never goes negative, so the graph keeps its sign on both sides.",
      "The leading coefficient is the number multiplying the highest power of $x$. For a cubic, the graph falls to the right when it is negative and rises to the right when it is positive.",
    ],
    {
      prompt:
        "A cubic touches the $x$-axis at $-1$, crosses at 2 and falls to the right. Write a rule.",
      steps: [
        "The zeros $-1$ and 2 give the factors $(x + 1)$ and $(x - 2)$.",
        "The graph touches the axis at $-1$, so $(x + 1)$ is squared. It crosses at 2, so $(x - 2)$ appears once. That makes $2 + 1 = 3$ copies of $x$ in all, a cubic.",
        "The graph falls to the right, so the leading coefficient is negative. The simplest choice is $-1$, written as a minus sign in front.",
      ],
      answer: "$y=-(x+1)^2(x-2)$",
    },
    [
      "List the zeros, and mark which ones the graph touches and which it crosses.",
      "Write a factor $(x - r)$ for each zero, and square the factor of the touching zero.",
      "Put a minus sign in front if the graph falls to the right.",
    ],
    [
      "The multiplicity of a zero, the number of copies of its factor, is even exactly when the graph touches the axis there without crossing.",
    ],
    [
      "The factor for the zero $r$ is $(x - r)$: the zero $-1$ gives $(x + 1)$.",
      "Do not square the factor of a zero where the graph crosses.",
      "A right end that falls means a negative leading coefficient.",
    ],
    "Ask your learner to multiply out the rule, or just its first terms, to see where the leading sign comes from.",
  ),
  lesson(
    "regents-sinusoid-compare-rule",
    "Comparing a graph with a rule",
    "Compare maximum and frequency of a graphed sine with a sine rule.",
    ["sinusoid-compare-rule"],
    [
      "Read the maximum and period from a graph.",
      "Find them from a rule and compare frequencies.",
    ],
    [
      "The maximum of $A\\sin(Bx)$ is $A$ and the period is $\\frac{2\\pi}{B}$. Frequency is the number of cycles in one unit, the reciprocal of the period.",
      "A graph with peaks closer together has a shorter period and a greater frequency.",
    ],
    {
      prompt:
        "A graphed function has maximum 3 and period 4. Another is $2\\sin\\left(\\frac{2\\pi}{8}x\\right)$. Compare them.",
      steps: [
        "The rule has maximum 2, smaller than 3.",
        "Its period is 8, longer than 4.",
        "So it has a smaller maximum and a smaller frequency.",
      ],
      answer: "smaller maximum, smaller frequency",
    },
    [
      "Find maxima and compare.",
      "Find periods and compare.",
      "Reverse the comparison for frequency.",
    ],
    ["Frequency $=\\frac{1}{\\text{period}}=\\frac{B}{2\\pi}$."],
    [
      "A longer period means a smaller frequency.",
      "The maximum is $A$, not the coefficient inside.",
      "Read the period from the distance between peaks.",
    ],
    "Ask your learner to compare two graphs by counting peaks in the same window.",
  ),
  lesson(
    "regents-tide-cosine-equation",
    "A cosine model from a graph",
    "Find amplitude, midline and period from a graph and write the cosine equation.",
    ["tide-cosine-equation"],
    [
      "Compute amplitude and midline from the extremes.",
      "Find $B$ from the period and choose cosine or negative cosine.",
    ],
    [
      "The midline is halfway between the lowest and highest values. The amplitude is half the distance between them.",
      "A graph that starts at an extreme is a cosine; one that starts at a minimum is a negative cosine.",
    ],
    {
      prompt:
        "A graph starts at a maximum of 9 at $t=0$, has a minimum of 3 and period 12. Write the equation.",
      steps: [
        "Midline $\\frac{9+3}{2}=6$ and amplitude $\\frac{9-3}{2}=3$.",
        "$B=\\frac{2\\pi}{12}=\\frac{\\pi}{6}$.",
        "$y=3\\cos\\left(\\frac{\\pi}{6}t\\right)+6$.",
      ],
      answer: "$y=3\\cos\\left(\\frac{\\pi}{6}t\\right)+6$",
    },
    [
      "Midline and amplitude from the extremes.",
      "$B$ from the period.",
      "Cosine or negative cosine from the start.",
    ],
    [
      "For $y=A\\cos(Bx)+D$ the maximum is $D+|A|$, the minimum $D-|A|$, and the period $\\frac{2\\pi}{B}$.",
    ],
    [
      "Do not swap the amplitude and the midline.",
      "A sine would start on the midline.",
      "Use $\\frac{2\\pi}{\\text{period}}$, not the period itself.",
    ],
    "Ask your learner to check the equation at $t=0$.",
  ),
  lesson(
    "regents-cubic-graph-statement",
    "Reading a cubic's graph",
    "A cubic is a polynomial whose highest power is $x^3$. To decide which statement about its graph is true, read three things. Read what the ends do, how the graph meets the $x$-axis at each zero, and where it rises or falls.",
    ["cubic-graph-statement"],
    [
      "Read the zeros of a cubic and how many times each factor appears.",
      "Describe where the graph rises, where it falls, and what its ends do.",
    ],
    [
      "A zero is an input where the graph meets the $x$-axis. Its multiplicity is how many times its factor appears. In these graphs, a zero where the graph touches the axis and turns back has multiplicity 2, and a zero where it crosses has multiplicity 1.",
      "Reading from left to right, a graph is increasing where it goes up and decreasing where it goes down. A turning point is where it switches between the two.",
      "End behavior is what the graph does far to the right and far to the left. We write $x \\to \\infty$, read “$x$ grows without bound”, for moving far to the right, and $f(x) \\to \\infty$ for the outputs growing without bound.",
    ],
    {
      prompt:
        "A cubic rises to the right, touches the axis at $-1$ and crosses at 2. Describe it.",
      steps: [
        "The graph touches the axis at $-1$, so $-1$ is a zero of multiplicity 2. It crosses at 2, so 2 has multiplicity 1.",
        "It rises to the right, so as $x \\to \\infty$, $f(x) \\to \\infty$.",
        "Reading left to right, it rises to the turning point at $-1$, falls to a second turning point between $-1$ and 2, then rises again.",
      ],
      answer:
        "multiplicity 2 at $-1$, multiplicity 1 at 2, rising to the right",
    },
    [
      "Mark the zeros, and whether the graph touches or crosses at each.",
      "Mark the turning points, and say what the graph does far to the right and far to the left.",
      "Test each statement against these features.",
    ],
    [
      "For different numbers $a$ and $b$ and a number $k \\ne 0$ ($\\ne$ means is not equal to), the graph of the cubic $k(x - a)^2(x - b)$ has two turning points, one at the double zero $a$.",
    ],
    [
      "Touching the axis is not crossing it.",
      "Read intervals of increase from left to right; they can also run off to the far left or the far right.",
      "End behavior depends on the sign of the leading coefficient, the number in front.",
    ],
    "Ask your learner to trace the graph with a finger and say up or down.",
  ),
];

const fm = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({ templateId, facetId, extent: "partial", rationale });
export const regentsAlgebraTwoGraphFacetMappings: FacetMapping[] = [
  fm(
    "log-base-fraction-graph",
    "logarithms.core",
    "Figure choice of the graph of a logarithm with base one half, one third or one fourth among reciprocal-base and exponential graphs. Does not assess shifted logarithms, domain statements or evaluating logarithms.",
  ),
  fm(
    "remainder-zero-graph",
    "polynomial-division.core",
    "Figure choice of the cubic graph with zero remainder on division by $x-r$, by the remainder theorem. Does not assess division itself or polynomials of higher degree.",
  ),
  fm(
    "repeated-zero-rule",
    "polynomial-zeros.core",
    "Single choice for the factored rule of a drawn cubic with one double zero and one simple zero and a negative leading coefficient. Does not assess non-integer zeros, nonmonic scaling or higher degrees.",
  ),
  fm(
    "sinusoid-compare-rule",
    "trigonometric-graphs.core",
    "Single choice comparing the maximum and frequency of a drawn sine with those of a rule, with no phase or vertical shift. Does not assess midlines, phase shifts or writing an equation.",
  ),
  fm(
    "tide-cosine-equation",
    "periodic-modeling.core",
    "Single choice for the cosine equation of a drawn graph that starts at an extreme, with integer extremes and period 8 or 12. Does not assess phase shifts other than reflection or graphing the model.",
  ),
  fm(
    "cubic-graph-statement",
    "polynomial-behavior.core",
    "Single choice for a true statement about a drawn cubic with a double and a simple zero: end behavior, multiplicity or an interval of increase. Does not assess quartics, rational functions or the justification.",
  ),
];
