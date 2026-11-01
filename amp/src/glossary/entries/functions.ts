import type { GlossaryEntry } from "../types";

/** Functions, sequences, exponential and logarithmic models, and graph features. */
export const functionsEntries: GlossaryEntry[] = [
  {
    id: "arithmetic-sequence",
    term: "arithmetic sequence",
    forms: ["arithmetic sequence", "arithmetic sequences"],
    plain:
      "A sequence that adds the same number each step to get the next number. The number added can be negative.",
    example: "5, 8, 11, 14 adds 3 each step; 20, 15, 10 adds −5.",
    uses: ["sequence"],
    band: "algebra-1",
  },
  {
    id: "asymptote",
    term: "asymptote",
    forms: ["asymptote", "asymptotes"],
    plain:
      "A line that a graph gets closer and closer to as it runs far out. The gap between the graph and the line shrinks toward 0.",
    example:
      "The graph of $y=2^x$ gets closer to the $x$-axis, $y=0$, as $x$ goes far to the left.",
    uses: ["line", "x-axis"],
    band: "algebra-1",
  },
  {
    id: "average-rate-of-change",
    term: "average rate of change",
    forms: ["average rate of change", "average rates of change"],
    plain:
      "The change in a function's output divided by the change in input between two inputs. It is the slope of the line through the two points.",
    example:
      "For $f(x)=x^2$ from $x=1$ to $x=3$: $\\frac{f(3)-f(1)}{3-1}=\\frac{9-1}{2}=4$.",
    uses: ["function", "output", "input", "change", "slope", "line", "point"],
    band: "algebra-1",
  },
  {
    id: "axis-of-symmetry",
    term: "axis of symmetry",
    forms: ["axis of symmetry", "axes of symmetry"],
    plain:
      "The line through a parabola's vertex that splits it into two mirror-image halves. For the graph of a quadratic function, it is vertical.",
    example: "For $y=(x-3)^2+1$, the axis of symmetry is the line $x=3$.",
    uses: [
      "vertical-line",
      "line",
      "vertex-parabola",
      "parabola",
      "half",
      "quadratic",
      "function",
    ],
    band: "algebra-1",
  },
  {
    id: "common-difference",
    term: "common difference",
    forms: ["common difference", "common differences"],
    plain:
      "The fixed amount added to each term of an arithmetic sequence to get the next term. It can be negative.",
    example: "In 5, 8, 11, 14, the common difference is 3.",
    uses: ["term-sequence", "arithmetic-sequence"],
    band: "algebra-1",
  },
  {
    id: "common-ratio",
    term: "common ratio",
    forms: ["common ratio", "common ratios", "constant ratio"],
    plain:
      "The fixed number each term of a geometric sequence is multiplied by to get the next term. Divide any term by the one before it.",
    example: "In 2, 6, 18, 54, the common ratio is 3.",
    uses: ["term-sequence", "geometric-sequence"],
    band: "algebra-1",
  },
  {
    id: "commute",
    term: "commute",
    forms: ["commute", "commutes"],
    plain:
      "Two operations commute when doing them in either order gives the same result.",
    example: "$f(x)=x+2$ and $g(x)=x+5$ commute: $f(g(x))=g(f(x))=x+7$.",
    uses: [],
    band: "algebra-2",
    autoLink: false,
  },
  {
    id: "composition",
    term: "composition",
    forms: [
      "composition",
      "compositions",
      "composite function",
      "composite functions",
    ],
    plain:
      "Doing one function or transformation, then doing a second one to the result.",
    example:
      "$(f\\circ g)(x)=f(g(x))$: apply $g$ first, then $f$. If $g(2)=5$ and $f(5)=1$, then $(f\\circ g)(2)=1$.",
    uses: ["function", "transformation"],
    band: "geometry",
  },
  {
    id: "compound-interest",
    term: "compound interest",
    forms: ["compound interest"],
    plain:
      "Interest added to the balance each period, so later interest is earned on the original amount plus the interest already added.",
    example:
      "At 10% a year, 100 dollars grows to 110 dollars, then to 121 dollars, because the second year's interest is 10% of 110.",
    uses: ["interest", "balance-account"],
    band: "algebra-1",
    noLink: ["period"],
  },
  {
    id: "decreasing",
    term: "decreasing",
    forms: ["decreasing", "decreasing interval", "decreasing intervals"],
    plain:
      "Getting smaller. A graph is decreasing where it falls as you move from left to right.",
    example:
      "A temperature that drops from 20° to 12° overnight has a decreasing graph.",
    uses: [],
    band: "8",
    autoLink: false,
  },
  {
    id: "discrete-graph",
    term: "discrete graph",
    forms: ["discrete graph", "discrete graphs"],
    plain:
      "A graph made of separate dots with nothing between them, used when only some inputs make sense, such as whole numbers.",
    example:
      "The sequence 3, 6, 9, … graphs as the separate points (1, 3), (2, 6), (3, 9).",
    uses: ["input", "whole-number", "sequence", "point"],
    band: "algebra-1",
  },
  {
    id: "domain",
    term: "domain",
    forms: ["domain", "domains"],
    plain:
      "The set of all inputs a function can take: every input where its rule makes sense and the situation allows.",
    example: "For $f(x)=\\frac{1}{x}$, the domain is every number except 0.",
    uses: ["function", "input", "rule"],
    band: "algebra-1",
  },
  {
    id: "doubling-time",
    term: "doubling time",
    forms: ["doubling time"],
    plain: "The time it takes a growing amount to double.",
    example:
      "Money that doubles every 9 years has a doubling time of 9 years: 500 dollars becomes 1,000, then 2,000.",
    uses: [],
    band: "algebra-1",
  },
  {
    id: "end-behavior",
    term: "end behavior",
    forms: ["end behavior"],
    plain:
      "What a graph does at its far left and far right: whether the outputs rise forever, fall forever, or level off.",
    example:
      "For $y=x^3$, the outputs fall forever as $x$ goes left and rise forever as $x$ goes right.",
    uses: ["output"],
    band: "algebra-2",
  },
  {
    id: "explicit-rule",
    term: "explicit rule",
    forms: ["explicit rule", "explicit rules", "explicit formula"],
    plain:
      "A formula that gives any term of a sequence straight from its position $n$, without finding the terms before it.",
    example: "$a_n=3n+2$ gives the 10th term at once: $a_{10}=32$.",
    uses: ["term-sequence", "sequence"],
    band: "algebra-1",
  },
  {
    id: "exponential-decay",
    term: "exponential decay",
    forms: ["exponential decay", "decay"],
    plain:
      "Shrinking by multiplying by the same number between 0 and 1 at each step.",
    example:
      "Halving each hour: 80, 40, 20, 10. The amount is multiplied by 0.5 each hour.",
    uses: [],
    band: "algebra-1",
  },
  {
    id: "exponential-function",
    term: "exponential function",
    forms: ["exponential function", "exponential functions"],
    plain:
      "A function $y=a\\cdot b^x$, with $a\\ne0$, $b>0$ and $b\\ne1$, that starts at $a$ and multiplies by $b$ each time $x$ goes up by 1.",
    example: "$y=5\\cdot 2^x$ gives 5, 10, 20, 40 for $x$ = 0, 1, 2, 3.",
    uses: ["function"],
    band: "algebra-1",
  },
  {
    id: "function",
    term: "function",
    forms: ["function", "functions"],
    plain: "A rule that gives exactly one output for each input.",
    example:
      "$f(x)=2x+1$ is a function: the input 3 always gives the output 7.",
    uses: ["rule", "output", "input"],
    band: "8",
  },
  {
    id: "function-notation",
    term: "function notation",
    forms: ["function notation"],
    plain:
      "Writing $f(x)$ for the output of function $f$ at input $x$. It is read “$f$ of $x$” and does not mean $f$ times $x$.",
    example: "If $f(x)=x^2$, then $f(3)=9$.",
    uses: ["function", "output", "input"],
    band: "algebra-1",
    noLink: ["mean"],
  },
  {
    id: "geometric-sequence",
    term: "geometric sequence",
    forms: ["geometric sequence", "geometric sequences"],
    plain:
      "A sequence that multiplies by the same number each step to get the next number.",
    example: "2, 6, 18, 54 multiplies by 3 each step.",
    uses: ["sequence"],
    band: "algebra-1",
  },
  {
    id: "geometric-series",
    term: "geometric series",
    forms: ["geometric series"],
    plain: "The sum of the terms of a geometric sequence.",
    example: "2 + 6 + 18 + 54 = 80.",
    uses: ["sum", "term-sequence", "geometric-sequence"],
    band: "algebra-2",
  },
  {
    id: "growth-factor",
    term: "growth factor",
    forms: ["growth factor", "growth factors", "decay factor", "decay factors"],
    plain:
      "The number an amount is multiplied by in each time period. Above 1 means growth; between 0 and 1 means decay.",
    example:
      "A 5% increase each year has growth factor 1.05; a 20% decrease each year has 0.8.",
    uses: ["exponential-decay"],
    band: "algebra-1",
    noLink: ["period"],
  },
  {
    id: "half-life",
    term: "half-life",
    forms: ["half-life", "half-lives"],
    plain:
      "The time it takes a shrinking amount to fall to half of what it was.",
    example:
      "With a half-life of 5 days, 80 grams becomes 40 grams after 5 days and 20 grams after 10.",
    uses: ["half", "gram"],
    band: "algebra-1",
  },
  {
    id: "hole",
    term: "hole",
    forms: ["hole", "holes"],
    plain:
      "A single missing point on a graph. It appears where a common factor of the numerator and denominator cancels.",
    example:
      "$y=\\frac{(x-2)(x+1)}{x-2}$ looks like $y=x+1$ but has a hole at $x=2$.",
    uses: ["point", "common-factor", "numerator", "denominator"],
    band: "precalculus",
    autoLink: false,
  },
  {
    id: "horizontal-asymptote",
    term: "horizontal asymptote",
    forms: ["horizontal asymptote", "horizontal asymptotes"],
    plain:
      "A flat line $y=c$ that a graph gets closer and closer to as $x$ goes far to the right or far to the left.",
    example: "$y=3+2^{-x}$ has the horizontal asymptote $y=3$.",
    uses: ["asymptote", "line"],
    band: "algebra-1",
  },
  {
    id: "increasing",
    term: "increasing",
    forms: ["increasing", "increasing interval", "increasing intervals"],
    plain:
      "Getting larger. A graph is increasing where it rises as you move from left to right.",
    example: "$y=x^2$ is increasing for $x>0$.",
    uses: [],
    band: "8",
    autoLink: false,
  },
  {
    id: "index-summation",
    term: "index",
    forms: ["index"],
    plain:
      "In a sum written with sigma notation, the counting letter that steps through whole numbers from the bottom value to the top value.",
    example:
      "In $\\sum_{k=1}^{4} k^2$ the index $k$ takes the values 1, 2, 3, 4.",
    uses: ["sum", "sigma-notation", "whole-number"],
    band: "algebra-2",
    autoLink: false,
  },
  {
    id: "initial-value",
    term: "initial value",
    forms: ["initial value", "initial values"],
    plain:
      "The output when the input is 0, usually the amount at the start of a situation.",
    example:
      "In $y=50+8x$ the initial value is 50; in $A=200\\cdot 1.03^t$ it is 200.",
    uses: ["output", "input"],
    band: "8",
  },
  {
    id: "input",
    term: "input",
    forms: ["input", "inputs"],
    plain: "The number you put into a rule to get a result, often called $x$.",
    example: "For the rule “add 3”, the input 5 gives 8.",
    uses: ["rule"],
    band: "4",
  },
  {
    id: "inverse-function",
    term: "inverse function",
    forms: ["inverse function", "inverse functions"],
    plain:
      "The function $f^{-1}$ that undoes $f$: if $f$ sends $a$ to $b$, then $f^{-1}$ sends $b$ back to $a$.",
    example:
      "If $f(x)=2x+3$, then $f^{-1}(x)=\\frac{x-3}{2}$, and $f^{-1}(f(4))=4$.",
    uses: ["function"],
    band: "algebra-2",
  },
  {
    id: "jump",
    term: "jump",
    forms: ["jump", "jumps"],
    plain:
      "A curved arrow drawn along a row of numbers to show moving: to the right to add, to the left to take away.",
    example: "To find 7 + 5, start at 7 and make a jump of 5 to land on 12.",
    uses: [],
    band: "2",
    autoLink: false,
  },
  {
    id: "jump-discontinuity",
    term: "jump",
    forms: ["jump discontinuity", "jump discontinuities"],
    plain:
      "A break where a graph suddenly leaps: the pieces on the two sides head toward different values.",
    example:
      "A piecewise function equal to 1 for $x<0$ and 3 for $x\\ge0$ has a jump discontinuity at $x=0$.",
    uses: ["piecewise-function", "equal"],
    band: "precalculus",
    noLink: ["sides"],
  },
  {
    id: "linear-function",
    term: "linear function",
    forms: ["linear function", "linear functions"],
    plain:
      "A function whose graph is a straight line. It can be written $y=mx+b$ and changes by the same amount for each step of 1 in $x$.",
    example: "$y=3x+2$ goes up 3 each time $x$ goes up 1.",
    uses: ["function", "line", "change"],
    band: "8",
  },
  {
    id: "logarithm",
    term: "logarithm",
    forms: ["logarithm", "logarithms", "log", "logs"],
    plain:
      "For positive $N$ and a positive base $b \\ne 1$, $\\log_b N$ is the exponent that turns $b$ into $N$. A log with no base written means base 10.",
    example: "$\\log_2 8=3$ because $2^3=8$; $\\log 100=2$ because $10^2=100$.",
    uses: ["exponent", "base-exponent"],
    band: "algebra-1",
  },
  {
    id: "natural-logarithm",
    term: "natural logarithm",
    forms: ["natural logarithm", "natural logarithms", "natural log"],
    plain: "The logarithm with base $e$ (about 2.718), written $\\ln$.",
    example: "$\\ln(e^3)=3$, and $\\ln 1=0$.",
    uses: ["logarithm", "base-exponent"],
    band: "algebra-1",
  },
  {
    id: "parent-graph",
    term: "parent graph",
    forms: [
      "parent graph",
      "parent graphs",
      "parent function",
      "parent functions",
    ],
    plain:
      "The simplest graph in a family of graphs; the others are moved or stretched copies of it.",
    example: "$y=x^2$ is the parent graph of $y=(x-3)^2+1$.",
    uses: [],
    band: "algebra-2",
  },
  {
    id: "period",
    term: "period",
    forms: ["period", "periods", "periodic"],
    plain:
      "The width of one full cycle of a graph that repeats. A graph that repeats this way is periodic.",
    example:
      "$y=\\sin x$ repeats every $2\\pi$, so its period is $2\\pi$; $y=\\sin(2x)$ has period $\\pi$.",
    uses: [],
    band: "algebra-2",
    autoLink: false,
  },
  {
    id: "piecewise-function",
    term: "piecewise function",
    forms: ["piecewise function", "piecewise functions"],
    plain:
      "A function made of pieces: a different rule is used for each part of the inputs.",
    example: "$f(x)=-x$ when $x<0$ and $f(x)=x$ when $x\\ge0$, so $f(-4)=4$.",
    uses: ["function", "rule", "input"],
    band: "algebra-1",
    noLink: ["part"],
  },
  {
    id: "principal",
    term: "principal",
    forms: ["principal"],
    plain:
      "The amount of money first deposited or borrowed, before any interest.",
    example: "Borrow 500 dollars at 6% interest: the principal is 500 dollars.",
    uses: ["interest"],
    band: "7",
  },
  {
    id: "recursive-rule",
    term: "recursive rule",
    forms: [
      "recursive rule",
      "recursive rules",
      "recursive formula",
      "recursion",
    ],
    plain:
      "A rule that gives each term of a sequence from the term before it, together with the first term to start from.",
    example: "$a_1=2$ and $a_{n+1}=3a_n$ give 2, 6, 18, 54.",
    uses: ["rule", "term-sequence", "sequence"],
    band: "algebra-1",
  },
  {
    id: "second-difference",
    term: "second difference",
    forms: ["second difference", "second differences"],
    plain:
      "For equally spaced inputs, subtract neighboring outputs, then subtract those results again. Constant second differences mean a quadratic.",
    example:
      "Outputs 1, 4, 9, 16 have differences 3, 5, 7 and second differences 2, 2.",
    uses: ["input", "output", "quadratic", "difference-subtract", "constant"],
    band: "algebra-1",
    noLink: ["mean"],
  },
  {
    id: "sequence",
    term: "sequence",
    forms: ["sequence", "sequences"],
    plain: "A list of numbers in a set order, usually following a rule.",
    example: "2, 4, 6, 8, … is a sequence that adds 2 each time.",
    uses: ["rule"],
    band: "4",
  },
  {
    id: "series",
    term: "series",
    forms: ["series"],
    plain: "The sum of the terms of a sequence, often the first $n$ terms.",
    example:
      "For 3, 5, 7, 9, …, the series of the first four terms is 3 + 5 + 7 + 9 = 24.",
    uses: ["sum", "term-sequence", "sequence"],
    band: "algebra-1",
  },
  {
    id: "sigma-notation",
    term: "sigma notation",
    forms: ["sigma notation", "summation notation"],
    plain:
      "A short way to write a sum with $\\sum$: it shows where counting starts and stops, and the rule for each term.",
    example: "$\\sum_{k=1}^{4} 2k=2+4+6+8=20$.",
    uses: ["sum", "rule", "term-sequence"],
    band: "algebra-2",
  },
  {
    id: "translation",
    term: "translation",
    forms: ["translation", "translations"],
    plain:
      "A slide: every point of a shape or graph moves the same amount in the same direction, with no turning, flipping or resizing.",
    example: "Translating the point (2, 1) right 3 and up 4 gives (5, 5).",
    uses: ["point"],
    band: "8",
  },
  {
    id: "turning-point",
    term: "turning point",
    forms: ["turning point", "turning points"],
    plain:
      "A point where a graph changes from going up to going down, or from going down to going up.",
    example: "$y=x^3-3x$ has turning points at $(-1, 2)$ and $(1, -2)$.",
    uses: ["point"],
    band: "algebra-1",
    noLink: ["changes"],
  },
  {
    id: "vertex",
    term: "vertex",
    forms: ["vertex", "vertices"],
    plain:
      "A corner: where two sides of a shape meet, where edges of a 3D shape meet, or where the two sides of an angle meet.",
    example: "A triangle has 3 vertices; a cube has 8.",
    uses: ["corner", "side", "edge", "angle", "triangle", "cube"],
    band: "2",
    autoLink: false,
  },
  {
    id: "vertex-form",
    term: "vertex form",
    forms: ["vertex form"],
    plain:
      "The form $y=a(x-h)^2+k$ of a quadratic, which shows the vertex $(h, k)$ directly.",
    example: "$y=2(x-1)^2+5$ has vertex $(1, 5)$ and lowest value 5.",
    uses: ["quadratic", "vertex-parabola"],
    band: "algebra-1",
  },
  {
    id: "vertex-parabola",
    term: "vertex",
    forms: ["vertex", "vertices"],
    plain:
      "The turning point of a parabola or an absolute-value graph: its lowest point if it opens up, its highest if it opens down.",
    example: "$y=(x-2)^2+3$ has vertex $(2, 3)$, its lowest point.",
    uses: ["turning-point", "parabola", "absolute-value", "point"],
    band: "algebra-1",
    autoLink: false,
  },
  {
    id: "vertical-asymptote",
    term: "vertical asymptote",
    forms: ["vertical asymptote", "vertical asymptotes"],
    plain:
      "A vertical line $x=c$ that a graph gets closer and closer to while shooting up or down without end.",
    example:
      "$y=\\frac{1}{x-2}$ has a vertical asymptote at $x=2$, where the denominator is 0.",
    uses: ["asymptote", "vertical-line", "denominator"],
    band: "algebra-2",
  },
  {
    id: "vertical-line-test",
    term: "vertical line test",
    forms: ["vertical line test"],
    plain:
      "A graph shows a function exactly when no vertical line crosses it more than once.",
    example: "A circle fails: the line $x=0$ crosses $x^2+y^2=4$ twice.",
    uses: ["function", "vertical-line", "circle", "line", "more-than"],
    band: "algebra-1",
  },
  {
    id: "x-intercept",
    term: "$x$-intercept",
    forms: ["x-intercept", "x-intercepts"],
    plain:
      "A point where a graph crosses or touches the $x$-axis. Its $y$-coordinate is 0, so it is written $(a, 0)$.",
    example: "$y=2x-6$ has $x$-intercept $(3, 0)$.",
    uses: ["point", "x-axis", "coordinate", "intercept"],
    band: "algebra-1",
  },
];
