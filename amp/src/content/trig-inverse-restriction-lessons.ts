import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * HSF.TF.B.6: a trigonometric function repeats, so it has no inverse on its
 * whole domain; restricted to an interval where it is always increasing or
 * always decreasing, and still takes every value of its range, it does.
 */

const oneToOne =
  "A function is called one-to-one when no two inputs give the same output. An inverse function sends each output back to its input, so it exists only for a one-to-one function. On a graph, one-to-one means no horizontal line crosses the graph twice.";
const repeats =
  "Sine, cosine and tangent repeat, so every output comes from many inputs: $\\sin\\frac{\\pi}{6} = \\sin\\frac{5\\pi}{6} = \\frac{1}{2}$. On their whole domains they have no inverse functions. Restricting the domain means allowing only some inputs: an interval where the function is always increasing or always decreasing, and still takes every value of its range.";

export const trigInverseRestrictionMethods: Record<string, ProblemMethod> = {
  "trig-restriction-domain": {
    goal: "Choose an interval on which sine, cosine or tangent can be inverted, or the interval that defines arcsin, arccos or arctan.",
    intuition: `${oneToOne} ${repeats} By convention, $\\arcsin$ uses $\\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$, $\\arccos$ uses $[0, \\pi]$ and $\\arctan$ uses $\\left(-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right)$, but other intervals can work too.`,
    terms: [
      "inverse-function",
      "inverse-trig-function",
      "domain",
      [
        "range-function",
        "Sine and cosine have range $[-1, 1]$; tangent has every real number.",
      ],
      "increasing",
      "decreasing",
    ],
    senses: { range: "range-function" },
    noLink: ["piece", "turn"],
    method: [
      "On the graph, check that the interval contains no turning point and, for tangent, no asymptote: the function only rises or only falls there.",
      "Check that the interval reaches every value of the range: from $-1$ to $1$ for sine and cosine, every real number for tangent.",
      "Reject half a piece, a piece that turns, a full period, and the inverse's own domain $[-1, 1]$.",
    ],
    watch:
      "Always rising is not enough: the piece must also reach every value of the range. And $[-1, 1]$ is where the inverse takes its inputs, not where the original function is restricted.",
  },
  "trig-restriction-domain-graph": {
    goal: "Choose the graph whose highlighted piece of sine, cosine or tangent can be used to build an inverse function.",
    intuition: `${oneToOne} ${repeats}`,
    terms: [
      "inverse-function",
      "horizontal-line",
      [
        "range-function",
        "Sine and cosine have range $[-1, 1]$; tangent has every real number.",
      ],
    ],
    senses: { range: "range-function" },
    noLink: ["piece", "turn"],
    method: [
      "Slide a horizontal line along each highlighted piece. Reject a piece the line can cross twice.",
      "Check that the piece reaches both $y = 1$ and $y = -1$, or for tangent both very large and very negative values.",
    ],
    watch:
      "A piece that never turns but stops halfway, such as sine from 0 to $\\frac{\\pi}{2}$, misses half the range.",
  },
  "trig-one-to-one-intervals": {
    goal: "Select every interval on which the graph of sine or cosine is one-to-one, always increasing or always decreasing.",
    intuition: `${oneToOne} Sine turns at $\\frac{\\pi}{2}$, $\\frac{3\\pi}{2}$ and every $\\pi$ from there; cosine turns at 0, $\\pi$ and every $\\pi$ from there. Between two turning points the graph only rises or only falls.`,
    terms: ["increasing", "decreasing", "horizontal-line"],
    noLink: ["turn", "turns", "turning"],
    method: [
      "Mark the turning points of the graph: the highest and lowest points.",
      "Keep an interval when no turning point lies strictly inside it. A turning point at an end is fine.",
    ],
    watch:
      "Length is not the test: $[0, \\pi]$ is as long as $\\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$, but sine turns inside it.",
  },
  "restricted-trig-inverse": {
    goal: "For a trig function restricted to an interval $D$, give its direction, its inverse's domain and range, and one exact inverse value.",
    intuition: `${oneToOne} If $g$ is $\\sin x$ restricted to an interval $D$ where it never turns, then $g^{-1}$ sends each output back to the one input in $D$. The inverse swaps the roles: its domain is the range of $g$, and its range is $D$.`,
    terms: [
      "inverse-function",
      "domain",
      ["range-function", "Here, the outputs of $g$ or of $g^{-1}$."],
    ],
    senses: { range: "range-function" },
    noLink: ["piece"],
    method: [
      "Read the graph on $D$: rising means increasing, falling means decreasing.",
      "Swap: the domain of $g^{-1}$ is the range of $g$; the range of $g^{-1}$ is $D$.",
      "For $g^{-1}(v)$, list every $x$ with the right value, using the usual value and its reflections plus full turns, and keep the one in $D$.",
    ],
    watch:
      "The usual value from $\\arcsin$, $\\arccos$ or $\\arctan$ answers the usual interval only. When $D$ is different, the answer must lie in $D$.",
  },
  "trig-inverse-why-restrict": {
    goal: "Explain why a trigonometric function needs a restricted domain before it has an inverse, and which fact justifies each step.",
    intuition: `${oneToOne} ${repeats} Two different facts do two different jobs: always increasing or decreasing rules out repeats, and reaching every value fixes the inverse's domain.`,
    terms: [
      "inverse-function",
      "inverse-trig-function",
      "vertical-line-test",
      [
        "range-function",
        "Sine and cosine have range $[-1, 1]$; tangent has every real number.",
      ],
    ],
    senses: { range: "range-function" },
    noLink: ["step"],
    method: [
      "Find two inputs with the same output; that is why no inverse exists on the whole domain.",
      "Match each step to its fact: one-to-one needs always increasing or decreasing; the inverse's domain needs which values are reached.",
      "For $\\arcsin$, $\\arccos$ and $\\arctan$, the value is the one input in the usual interval.",
    ],
    watch:
      "The vertical line test says a graph is a function. One-to-one needs the horizontal line test.",
  },
};

export const trigInverseRestrictionPrinciples: Record<string, string> = {
  "trig-restriction-domain":
    "A restriction of $f$ to an interval $I$ has an inverse with domain equal to the range of $f$ exactly when $f$ is one-to-one on $I$ and $f(I)$ is the whole range. For $\\sin$ these intervals are $\\left[-\\frac{\\pi}{2} + k\\pi, \\frac{\\pi}{2} + k\\pi\\right]$; for $\\cos$, $[k\\pi, (k+1)\\pi]$; for $\\tan$, $\\left(-\\frac{\\pi}{2} + k\\pi, \\frac{\\pi}{2} + k\\pi\\right)$, for integers $k$. The case $k = 0$ defines $\\arcsin$, $\\arccos$ and $\\arctan$.",
  "trig-restriction-domain-graph":
    "A highlighted piece can be inverted to an inverse defined on the whole range when no horizontal line crosses it twice and it reaches the function's highest and lowest values (for tangent, unbounded values in both directions).",
  "trig-one-to-one-intervals":
    "A continuous function is one-to-one on an interval exactly when it is strictly increasing or strictly decreasing there. Sine and cosine change direction only at their maxima and minima, so an interval works when none of those points lies strictly inside it.",
  "restricted-trig-inverse":
    "If $g = f$ restricted to $D$ is one-to-one, then $g^{-1}$ has domain $g(D)$ and range $D$, and $g^{-1}(v)$ is the unique $x \\in D$ with $f(x) = v$. For $D \\ne$ the usual interval, $g^{-1}(v)$ differs from $\\arcsin v$, $\\arccos v$ or $\\arctan v$ by a reflection and whole multiples of $\\pi$.",
  "trig-inverse-why-restrict":
    "A function has an inverse function exactly when it is one-to-one. Periodic functions are not one-to-one, so $\\arcsin$, $\\arccos$ and $\\arctan$ invert restrictions: $\\arcsin v$ is the unique $x \\in \\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$ with $\\sin x = v$, and similarly for the others.",
};

export const trigInverseRestrictionLessons: Lesson[] = [
  chainLesson({
    id: "trig-inverse-restriction",
    title: "Restricting a trigonometric function to invert it",
    summary:
      "An inverse function sends each output back to its input, so it needs a function that never repeats an output. Sine, cosine and tangent repeat. Keep only an interval where the graph always rises or always falls, and still reaches every value. Then the inverse exists, and its outputs come from that interval.",
    senses: { range: "range-function" },
    noLink: ["piece", "turn", "turns", "step"],
    templateIds: [
      "trig-restriction-domain",
      "trig-restriction-domain-graph",
      "trig-one-to-one-intervals",
      "restricted-trig-inverse",
      "trig-inverse-why-restrict",
    ],
    objectives: [
      "Explain why sine, cosine and tangent have no inverse function on their whole domains.",
      "Choose an interval on which the function is always increasing or always decreasing and takes every value of its range, and name the usual intervals behind arcsin, arccos and arctan.",
      "Build the inverse of a restricted function: give its domain and range and find an exact value inside the restricted interval.",
    ],
    openingTitle: "Why repeating blocks an inverse",
    opening: [
      oneToOne,
      repeats,
      "On $\\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$ sine rises from $-1$ to 1 without turning. Every value from $-1$ to 1 appears exactly once. So sine restricted there has an inverse, called $\\arcsin$: $\\arcsin\\frac{1}{2} = \\frac{\\pi}{6}$, the one input in that interval with sine $\\frac{1}{2}$.",
      "Other intervals work too. On $\\left[\\frac{\\pi}{2}, \\frac{3\\pi}{2}\\right]$ sine falls from 1 to $-1$ without turning. Its inverse sends $\\frac{1}{2}$ to $\\frac{5\\pi}{6}$, the one input there with sine $\\frac{1}{2}$.",
    ],
    example: {
      prompt:
        "Let $g(x) = \\cos x$ for $x$ in $D = [\\pi, 2\\pi]$ only. Is $g$ increasing or decreasing? Give the domain and range of $g^{-1}$, and find $g^{-1}\\left(\\frac{1}{2}\\right)$.",
      steps: [
        "On $[\\pi, 2\\pi]$ cosine rises from $\\cos\\pi = -1$ to $\\cos 2\\pi = 1$ without turning, so $g$ is increasing and one-to-one.",
        "The inverse swaps inputs and outputs: its domain is the range of $g$, $[-1, 1]$, and its range is $D = [\\pi, 2\\pi]$.",
        "The usual value is $\\arccos\\frac{1}{2} = \\frac{\\pi}{3}$. On one turn the solutions of $\\cos x = \\frac{1}{2}$ are $\\frac{\\pi}{3}$ and $2\\pi - \\frac{\\pi}{3} = \\frac{5\\pi}{3}$.",
        "Only $\\frac{5\\pi}{3}$ lies in $[\\pi, 2\\pi]$, so $g^{-1}\\left(\\frac{1}{2}\\right) = \\frac{5\\pi}{3}$. Check: $\\cos\\frac{5\\pi}{3} = \\frac{1}{2}$.",
      ],
      answer:
        "$g$ is increasing; $g^{-1}$ has domain $[-1, 1]$ and range $[\\pi, 2\\pi]$; $g^{-1}\\left(\\frac{1}{2}\\right) = \\frac{5\\pi}{3}$.",
    },
    methodTitle: "Choose and use a restriction",
    method: [
      "A good interval has no turning point inside (and, for tangent, no asymptote) and runs from the lowest value to the highest.",
      "The inverse of the restriction has the function's range as its domain and the interval as its range.",
      "To evaluate it, list the inputs with the given value, then keep the one inside the interval.",
    ],
    formalTitle: "Restrictions and inverses",
    formal: [
      "Sine is one-to-one and onto $[-1, 1]$ on each interval $\\left[-\\frac{\\pi}{2} + k\\pi, \\frac{\\pi}{2} + k\\pi\\right]$; cosine on each $[k\\pi, (k+1)\\pi]$; tangent is one-to-one onto all real numbers on each $\\left(-\\frac{\\pi}{2} + k\\pi, \\frac{\\pi}{2} + k\\pi\\right)$, for integers $k$.",
      "By convention $\\arcsin$, $\\arccos$ and $\\arctan$ invert the restrictions with $k = 0$: $\\arcsin$ and $\\arccos$ have domain $[-1, 1]$ and ranges $\\left[-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right]$ and $[0, \\pi]$; $\\arctan$ has every real number as its domain and range $\\left(-\\frac{\\pi}{2}, \\frac{\\pi}{2}\\right)$.",
    ],
    pitfalls: [
      "A piece that always rises but stops halfway misses half the range.",
      "An interval as long as $\\pi$ can still contain a turning point, or an asymptote of tangent.",
      "The usual inverse value is wrong for a different restriction: the answer must lie in the chosen interval.",
      "The vertical line test does not show one-to-one; the horizontal line test does.",
    ],
    parentGuide:
      "Ask your learner to trace the graph of sine with a finger and stop where it turns. Then ask which stretch could be reversed, and where its inverse would send the value one half.",
  }),
];

export const trigInverseRestrictionFacetMappings: FacetMapping[] = [
  {
    templateId: "trig-restriction-domain",
    facetId: "inverse-trigonometry.HSF.TF.B.6",
    extent: "partial",
    rationale:
      "Choose a non-conventional interval on which sine, cosine or tangent is monotonic and onto its range, rejecting half a piece, a piece that turns or crosses an asymptote and a full period, or name the conventional restriction behind arcsin, arccos or arctan. Does not assess proving monotonicity.",
  },
  {
    templateId: "trig-restriction-domain-graph",
    facetId: "inverse-trigonometry.HSF.TF.B.6",
    extent: "partial",
    rationale:
      "Choose, from four graphs of sine, cosine or tangent each highlighting an interval, the piece that is monotonic and reaches the whole range. Does not assess drawing the restriction.",
  },
  {
    templateId: "trig-one-to-one-intervals",
    facetId: "inverse-trigonometry.HSF.TF.B.6",
    extent: "partial",
    rationale:
      "Select every interval on which sine or cosine is one-to-one, rejecting intervals of length π that contain a turning point, a full period and intervals that turn inside. Tangent is left out because every interval in its domain is one-to-one.",
  },
  {
    templateId: "restricted-trig-inverse",
    facetId: "inverse-trigonometry.HSF.TF.B.6",
    extent: "partial",
    rationale:
      "Construct the inverse of sine, cosine or tangent restricted to a conventional or non-conventional interval: its direction, the inverse's domain and range, and an exact inverse value at a special value, among the conventional value, other solutions, coterminal values and the opposite. Does not assess graphing the inverse.",
  },
  {
    templateId: "restricted-trig-inverse",
    facetId: "inverse-trigonometry.core",
    extent: "partial",
    rationale:
      "Interpret an inverse trigonometric function as the inverse of a restriction and evaluate it on that restricted range. Does not assess compositions.",
  },
  {
    templateId: "trig-inverse-why-restrict",
    facetId: "inverse-trigonometry.HSF.TF.B.6",
    extent: "partial",
    rationale:
      "Choose why a trigonometric function on its whole domain has no inverse, find the flaw in a claim that an inverse trigonometric value has two values, and choose the fact (monotonic versus onto) that justifies a step in building the inverse. Does not assess an explanation written freely.",
  },
];
