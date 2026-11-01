import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { lesson, m } from "./regents-algebra-two-reasoning-lessons";

export const regentsAlgebraTwoGraphMethods: Record<string, ProblemMethod> = {
  "log-base-fraction-graph": m(
    "Choose the graph of a logarithm whose base is between 0 and 1.",
    "A logarithm asks: what exponent turns the base into $x$? Every logarithm graph passes through $(1,0)$, because any allowed base raised to the power 0 is 1. It stays to the right of the $y$-axis, because only positive numbers have logarithms. With a base greater than 1 it rises. With a base between 0 and 1 it falls, because larger inputs give smaller logarithms.",
    [["logarithm", "The base is the number $b$ in $\\log_b x$."]],
    [
      "Check that the graph passes through $(1,0)$ and lies to the right of the $y$-axis.",
      "Decide from the base whether it rises or falls.",
      "Rule out exponential curves, which cross the $y$-axis, for example at $(0,1)$.",
    ],
    "A curve that crosses the $y$-axis, such as one through $(0,1)$, is not a logarithm graph: a logarithm never reaches $x = 0$.",
    { senses: { base: "base-exponent", rule: "rule" } },
  ),
  "remainder-zero-graph": m(
    "Use the remainder theorem to find the graph with remainder 0.",
    "Dividing $p(x)$ by $x-r$ leaves the remainder $p(r)$. The remainder is zero exactly when the graph meets the $x$-axis at $x=r$.",
    ["remainder-theorem", "zero-of-a-function"],
    [
      "Write the remainder as $p(r)$.",
      "Read the height of each graph at $x=r$.",
      "Choose the graph that is at height 0 there.",
    ],
    "The divisor $x+3$ has $r=-3$, not 3. A graph that is close to the axis at $r$ is not enough: the height must be exactly 0.",
  ),
  "repeated-zero-rule": m(
    "Write a factored rule from a graph's zeros, the way it meets the axis there, and its end behavior.",
    "A graph that touches the axis and turns back at a zero comes from a squared factor. A graph that crosses comes from a factor that appears once. The sign of the leading coefficient follows the right-hand end of the graph.",
    ["multiplicity", "leading-coefficient"],
    [
      "List the zeros and mark which ones the graph touches and which it crosses.",
      "Write a factor $(x-r)$ for each zero and square the touching one.",
      "Use a negative sign if the graph falls to the right.",
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
    "A graph that touches the axis and turns back has a zero of multiplicity 2, and one that crosses has multiplicity 1. The function increases where the graph goes up from left to right, and the turning points mark where that changes.",
    ["end-behavior", "increasing"],
    [
      "Find the zeros and whether the graph touches or crosses.",
      "Find the turning points.",
      "Check each statement against these features.",
    ],
    "Touching is not crossing. An interval of increase is between turning points, read from left to right.",
  ),
};

export const regentsAlgebraTwoGraphPrinciples: Record<string, string> = {
  "log-base-fraction-graph":
    "For $b>0$, $b\\ne1$, the graph of $y=\\log_b x$ is defined for $x>0$, passes through $(1,0)$, rises if $b>1$ and falls if $0<b<1$. Also $\\log_{1/b}x=-\\log_b x$.",
  "remainder-zero-graph":
    "The remainder theorem says $p(x)=(x-r)q(x)+p(r)$, so the remainder is $p(r)$ and $x-r$ is a factor exactly when $p(r)=0$, that is, when the graph meets the $x$-axis at $x=r$.",
  "repeated-zero-rule":
    "If $p(x)=a(x-r)^m q(x)$ with $q(r)\\ne0$, the zero $r$ has multiplicity $m$: the graph crosses the axis at $r$ when $m$ is odd and touches it when $m$ is even. For odd degree, the graph falls to the right when $a<0$.",
  "sinusoid-compare-rule":
    "The function $A\\sin(Bx)$ with $A,B>0$ has maximum $A$, period $\\frac{2\\pi}{B}$ and frequency $\\frac{B}{2\\pi}$, the reciprocal of the period.",
  "tide-cosine-equation":
    "A sinusoid with maximum $M$, minimum $m$ and period $P$ that starts at its maximum is $y=\\frac{M-m}{2}\\cos\\left(\\frac{2\\pi}{P}x\\right)+\\frac{M+m}{2}$; one that starts at its minimum has the negative amplitude.",
  "cubic-graph-statement":
    "A cubic $k(x-a)^2(x-b)$ has a zero of multiplicity 2 at $a$ and of multiplicity 1 at $b$. If $k>0$ then $f\\to\\infty$ as $x\\to\\infty$ and $f\\to-\\infty$ as $x\\to-\\infty$, and the reverse if $k<0$. Its turning points are where its derivative is zero.",
};

export const regentsAlgebraTwoGraphLessons = [
  lesson(
    "regents-log-base-fraction-graph",
    "Graphs of logarithms with a base below 1",
    "A logarithm asks: what exponent turns the base into this number? For $y = \\log_{1/2} x$, read “log base one half of $x$”, the base is $\\tfrac{1}{2}$. Every logarithm graph passes through the point $(1, 0)$, where $x$ is 1 and $y$ is 0. With a base between 0 and 1, the graph falls as $x$ grows.",
    ["log-base-fraction-graph"],
    [
      "Recognize the features every logarithm graph shares.",
      "Decide from the base whether the graph rises or falls.",
    ],
    [
      "A logarithm answers: to what power must the base be raised to get $x$? An exponent, or power, is the small raised number, as in $b^2 = b \\times b$. Since $b^0 = 1$ for any allowed base, $\\log_b 1 = 0$. So every logarithm graph passes through the point $(1, 0)$.",
      "A positive base raised to any power gives a positive number. So a logarithm exists only for positive $x$, and its graph lies to the right of the $y$-axis, the vertical line where $x = 0$.",
      "If the base is greater than 1, bigger powers give bigger numbers, so the graph rises. If the base is between 0 and 1, like $\\tfrac{1}{2}$, bigger powers give smaller numbers: $(\\tfrac{1}{2})^1 = \\tfrac{1}{2}$ and $(\\tfrac{1}{2})^2 = \\tfrac{1}{4}$. So the graph falls as $x$ grows. A negative exponent means one divided by the power, so $(\\tfrac{1}{2})^{-2} = 4$.",
    ],
    {
      prompt:
        "Which of a rising curve through $(1,0)$ and a falling curve through $(1,0)$ is the graph of $y=\\log_{1/2}x$?",
      steps: [
        "Both curves pass through $(1, 0)$, so that point does not decide. Every logarithm graph goes through it.",
        "Look at the base. It is $\\tfrac{1}{2}$, which is between 0 and 1.",
        "With a base between 0 and 1, bigger inputs give smaller logarithms: $\\log_{1/2} 4 = -2$, because $(\\tfrac{1}{2})^{-2} = 4$. So the graph falls, and the answer is the falling curve.",
      ],
      answer: "the falling curve through $(1,0)$",
    },
    [
      "Check that the graph passes through $(1, 0)$ and stays to the right of the $y$-axis.",
      "Use the base to decide: a base greater than 1 rises, and a base between 0 and 1 falls.",
      "Rule out exponential curves such as $y = (\\tfrac{1}{2})^x$, which cross the $y$-axis at $(0, 1)$.",
    ],
    [
      "For $b > 0$ with $b \\neq 1$ ($\\neq$ means is not equal to), the graph of $y = \\log_b x$ exists for $x > 0$ and passes through $(1, 0)$. It rises if $b > 1$ and falls if $0 < b < 1$.",
      "With $\\ln$, the natural logarithm, $\\log_{1/b} x = \\tfrac{\\ln x}{\\ln(1/b)} = -\\log_b x$. So the graph of $y = \\log_{1/b} x$ is the mirror image of $y = \\log_b x$ across the $x$-axis.",
    ],
    [
      "An exponential graph with a base between 0 and 1 also falls, but it passes through $(0, 1)$, not $(1, 0)$.",
      "A base below 1 does not move the graph left or right.",
      "A logarithm does not exist for $x$ equal to 0 or less.",
    ],
    "Ask your learner which point every logarithm graph passes through, and why. Then ask what the base tells you about the graph's direction.",
    { senses: { base: "base-exponent", rule: "rule" }, noLink: ["image"] },
  ),
  lesson(
    "regents-remainder-zero-graph",
    "Remainder zero and the graph",
    "Use the remainder theorem to find the graph that meets the axis at the right place.",
    ["remainder-zero-graph"],
    [
      "State the remainder theorem.",
      "Connect a zero remainder with a graph that meets the $x$-axis at $x=r$.",
    ],
    [
      "Dividing a polynomial $p(x)$ by $x-r$ leaves a remainder equal to $p(r)$, the height of the graph at $x=r$.",
      "So the remainder is 0 exactly when the graph meets the $x$-axis at $x=r$.",
    ],
    {
      prompt:
        "For which graph is the remainder 0 when $p(x)$ is divided by $x-4$?",
      steps: [
        "The remainder is $p(4)$.",
        "We need a graph that has height 0 at $x=4$.",
        "Choose the graph that crosses the $x$-axis at 4.",
      ],
      answer: "the graph that crosses the axis at 4",
    },
    [
      "Write the remainder as $p(r)$.",
      "Find $r$ from the divisor.",
      "Check each graph at $x=r$.",
    ],
    ["If $p(r)=0$ then $x-r$ is a factor of $p(x)$ (the factor theorem)."],
    [
      "For $x+3$ the number $r$ is $-3$.",
      "A graph that passes near the axis does not have remainder 0.",
      "A raised graph has a nonzero remainder.",
    ],
    "Ask your learner to find $p(r)$ on each graph.",
  ),
  lesson(
    "regents-repeated-zero-rule",
    "A rule from a graph with a double zero",
    "Choose the factored rule from the zeros, the touching zero and the end behavior.",
    ["repeated-zero-rule"],
    [
      "Distinguish a touching zero from a crossing zero.",
      "Choose the sign of the leading coefficient from the end behavior.",
    ],
    [
      "Where a graph crosses the $x$-axis the factor appears once. Where it touches the axis and turns around, the factor is squared.",
      "A cubic that falls to the right has a negative leading coefficient.",
    ],
    {
      prompt:
        "A cubic touches the $x$-axis at $-1$, crosses at 2 and falls to the right. Write a rule.",
      steps: [
        "The factors are $(x+1)$ and $(x-2)$.",
        "$(x+1)$ is squared because the graph touches at $-1$.",
        "The leading coefficient is negative.",
      ],
      answer: "$y=-(x+1)^2(x-2)$",
    },
    [
      "List the zeros.",
      "Square the factor of the touching zero.",
      "Choose the sign from the right-hand end.",
    ],
    [
      "The multiplicity of a zero is even exactly when the graph touches the axis there without crossing.",
    ],
    [
      "The factor for the zero $r$ is $(x-r)$.",
      "Do not square the crossing factor.",
      "A falling right end means a negative leading coefficient.",
    ],
    "Ask your learner to expand to see where the leading sign comes from.",
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
    "Decide which statement about end behavior, zeros or intervals is true.",
    ["cubic-graph-statement"],
    [
      "Read multiplicity from how the graph meets the axis.",
      "Read end behavior and intervals of increase from the graph.",
    ],
    [
      "A zero where the graph touches the axis and turns back has multiplicity 2; where it crosses, multiplicity 1.",
      "Reading left to right, the graph is increasing where it goes up and decreasing where it goes down.",
    ],
    {
      prompt:
        "A cubic rises to the right, touches the axis at $-1$ and crosses at 2. Describe it.",
      steps: [
        "$-1$ has multiplicity 2 and 2 has multiplicity 1.",
        "As $x\\to\\infty$, $f(x)\\to\\infty$.",
        "It is increasing, then decreasing between its two turning points, then increasing.",
      ],
      answer:
        "multiplicity 2 at $-1$, multiplicity 1 at 2, rising to the right",
    },
    [
      "Mark zeros and turning points.",
      "Name the end behavior.",
      "Test each statement.",
    ],
    [
      "The graph of a cubic $k(x-a)^2(x-b)$ has two turning points, one at the double zero $a$.",
    ],
    [
      "Touching is not crossing.",
      "Intervals of increase are read from left to right.",
      "End behavior depends on the sign of the leading coefficient.",
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
