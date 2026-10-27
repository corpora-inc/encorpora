import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const m = (
  goal: string,
  intuition: string,
  terms: [string, string][],
  method: string[],
  watch: string,
): ProblemMethod => ({ goal, intuition, terms, method, watch });

export const regentsAlgebraTwoReasoningMethods: Record<string, ProblemMethod> =
  {
    "study-design-classify": m(
      "Decide whether a study is an experiment or observational by asking who assigns the treatment.",
      "In an experiment the researcher decides, usually by chance, which treatment each subject gets. In an observational study the researcher only records what already happens in groups that formed on their own.",
      [
        [
          "experiment",
          "A study in which the researcher assigns the treatments.",
        ],
        [
          "observational study",
          "A study that records existing groups without assigning treatments.",
        ],
      ],
      [
        "Find the treatment or the groups being compared.",
        "Ask who decided which subjects are in which group.",
        "Choose experiment if the researcher assigned them, observational if not.",
      ],
      "Measuring a response happens in both kinds of study. Only assigning the treatment makes a study an experiment.",
    ),
    "quartic-factored-form": m(
      "Factor a quartic binomial completely: common factor first, then differences of squares.",
      "Take out the greatest common factor, then look for a difference of squares. $x^4-81$ is $(x^2)^2-9^2$, so it factors, and one of its factors $x^2-9$ factors again.",
      [
        [
          "greatest common factor",
          "The largest number that divides every term.",
        ],
        ["difference of squares", "$a^2-b^2$, which factors as $(a-b)(a+b)$."],
      ],
      [
        "Factor out the common factor.",
        "Write the remaining binomial as a difference of squares and factor it.",
        "Factor any factor that is again a difference of squares; a sum of squares stays.",
      ],
      "Keep the common factor in the answer. $x^2+9$ does not factor over the integers.",
    ),
    "cubic-quotient-factored": m(
      "Divide a cubic by one of its linear factors and factor the quotient.",
      "If $(ax+b)$ is a factor of the cubic, the quotient is the product of the other two linear factors, with leading coefficient 1 once $a$ cancels. Dividing undoes the multiplication that built the cubic.",
      [
        ["quotient", "The result of dividing."],
        ["linear factor", "A factor of the form $ax+b$."],
      ],
      [
        "Divide the cubic by the linear factor with long division or synthetic division.",
        "Factor the quadratic quotient.",
        "Check by multiplying back.",
      ],
      "The coefficient $a$ of the divisor cancels the leading coefficient of the cubic. A factor $(x-r)$ has a zero at $r$.",
    ),
    "complete-square-first-steps": m(
      "Tell which first steps of solving a quadratic keep the solutions unchanged.",
      "A step is correct when it does the same thing to both sides of the equation. Dividing every term by the same number or moving a term across with a sign change keeps the solutions; changing only some terms does not.",
      [
        ["equivalent equations", "Equations with the same solutions."],
        ["zero-product property", "If $AB=0$ then $A=0$ or $B=0$."],
      ],
      [
        "Compare each step with the equation before it.",
        "Check whether every term was treated the same way and every sign changed correctly.",
        "Use the zero-product property only when one side is 0.",
      ],
      "A product equal to a nonzero number does not let you set each factor equal to that number.",
    ),
    "exponential-points-statement": m(
      "Find the doubling time and the model from three graphed points at equal spacing.",
      "If the value is multiplied by the same factor each time $x$ grows by the same step, the points lie on an exponential curve. A factor of 2 per step of size $T$ means the value doubles every $T$ units, modeled by $a\\cdot2^{x/T}$.",
      [
        ["doubling time", "The change in $x$ over which the value doubles."],
        ["growth factor", "The number each value is multiplied by."],
      ],
      [
        "Divide neighbouring $y$-values.",
        "If the ratios agree, read the factor and the step.",
        "Write $y=a\\cdot b^{x/T}$ and test it at the given points.",
      ],
      "A constant ratio is exponential; a constant difference is linear. The exponent is $x/T$, not $x$.",
    ),
    "rational-abs-solution-count": m(
      "Count the solutions of an equation by counting the points where two graphs meet.",
      "Each solution of $f(x)=g(x)$ is an input where the two graphs have the same height. Counting meeting points counts solutions, but each must be counted once, and no solution can sit on a vertical asymptote.",
      [
        ["asymptote", "A line a graph approaches but never reaches."],
        ["intersection", "A point on both graphs."],
      ],
      [
        "Draw or read both graphs.",
        "Count the points on each side of the asymptote and of the corner of the absolute value.",
        "Check by splitting the absolute value into its two cases.",
      ],
      "Branches that look close may not touch. Count only true crossings, and count each once.",
    ),
  };

export const regentsAlgebraTwoReasoningPrinciples: Record<string, string> = {
  "study-design-classify":
    "In a randomized experiment, subjects are assigned to treatments by the researcher using chance, which supports conclusions about cause. In an observational study, groups are formed by the subjects or by circumstances, and association alone does not show cause.",
  "quartic-factored-form":
    "$ck^4$ factors as $c(x^4-k^4)=c(x^2-k^2)(x^2+k^2)=c(x-k)(x+k)(x^2+k^2)$ using $a^2-b^2=(a-b)(a+b)$ twice. A sum of squares $x^2+k^2$ has no real linear factors.",
  "cubic-quotient-factored":
    "If $p(x)=(ax+b)(x-r)(x-s)$ then $\\frac{p(x)}{ax+b}=(x-r)(x-s)$ for $ax+b\\ne0$. By the factor theorem, $x-r$ is a factor of a polynomial exactly when $r$ is a zero.",
  "complete-square-first-steps":
    "Operations that apply the same invertible change to both sides of an equation give an equivalent equation. The zero-product property, $AB=0\\Rightarrow A=0$ or $B=0$, requires a product equal to 0.",
  "exponential-points-statement":
    "If $f(x)=a\\,b^{x/T}$ then $f(x+T)=b\\,f(x)$ for every $x$. For $b=2$ the value doubles every $T$ units. Equally spaced points on a line instead have a constant difference.",
  "rational-abs-solution-count":
    "The solutions of $f(x)=g(x)$ are the $x$-coordinates of the intersection points of the graphs of $f$ and $g$. A solution must lie in the domain of both functions, so it cannot be a zero of a denominator.",
};

export const lesson = (
  id: string,
  title: string,
  summary: string,
  templateIds: string[],
  objectives: string[],
  opening: string[],
  example: { prompt: string; steps: string[]; answer: string },
  methodSteps: string[],
  formal: string[],
  pitfalls: string[],
  parentGuide: string,
) =>
  chainLesson({
    id,
    title,
    summary,
    templateIds,
    objectives,
    openingTitle: "The idea",
    opening,
    example,
    methodTitle: "The steps",
    method: methodSteps,
    formalTitle: "The precise rule",
    formal,
    pitfalls,
    parentGuide,
  });

export const regentsAlgebraTwoReasoningLessons = [
  lesson(
    "regents-study-design-classify",
    "Experiment or observational study",
    "Decide the kind of study by asking who assigned the treatment.",
    ["study-design-classify"],
    [
      "Distinguish assigning a treatment from recording existing groups.",
      "Give the reason that supports the classification.",
    ],
    [
      "A study compares groups. The key question is how the subjects came to be in their groups.",
      "If the researcher decided, by chance, who gets which treatment, the study is an experiment. If the groups already existed, the study is observational.",
    ],
    {
      prompt:
        "A researcher flips a coin for each of 60 volunteers to decide who takes a vitamin or a placebo. Classify the study.",
      steps: [
        "The researcher assigns each volunteer to a treatment.",
        "Assigning treatments makes it an experiment.",
      ],
      answer: "an experiment, because the researcher assigned the treatments",
    },
    [
      "Name the groups being compared.",
      "Ask who chose each subject's group.",
      "Match the answer to the definitions.",
    ],
    [
      "A randomized experiment can support a conclusion about cause. An observational study shows association, and other factors may explain it.",
    ],
    [
      "Measuring a response does not make a study an experiment.",
      "A large sample does not make a study an experiment.",
      "Subjects who choose their own group make the study observational.",
    ],
    "Ask your learner who decided which group each subject was in.",
  ),
  lesson(
    "regents-quartic-factored-form",
    "Factoring a quartic binomial",
    "Take out the common factor, then factor the difference of squares twice.",
    ["quartic-factored-form"],
    [
      "Factor out a greatest common factor before anything else.",
      "Factor $x^4-k^4$ as a difference of squares and then factor $x^2-k^2$.",
    ],
    [
      "The expression $2x^4-32$ has the common factor 2. What is left, $x^4-16$, is $(x^2)^2-4^2$, a difference of squares.",
      "One of the new factors, $x^2-4$, is again a difference of squares, but $x^2+4$ is not.",
    ],
    {
      prompt: "Factor $2x^4-32$ completely.",
      steps: [
        "Factor out 2: $2(x^4-16)$.",
        "Difference of squares: $2(x^2-4)(x^2+4)$.",
        "Factor again: $2(x-2)(x+2)(x^2+4)$.",
      ],
      answer: "$2(x-2)(x+2)(x^2+4)$",
    },
    [
      "Factor out the greatest common factor.",
      "Apply $a^2-b^2=(a-b)(a+b)$ with $a=x^2$.",
      "Repeat on any factor that is a difference of squares.",
    ],
    [
      "Expanding $c(x-k)(x+k)(x^2+k^2)$ gives $c(x^4-k^4)$, which confirms the factoring.",
    ],
    [
      "Keep the common factor in the final answer.",
      "A sum of squares does not factor over the integers.",
      "The two linear factors have opposite signs.",
    ],
    "Ask your learner to multiply the answer back out to check it.",
  ),
  lesson(
    "regents-cubic-quotient-factored",
    "Dividing a cubic by a linear factor",
    "Divide a cubic by one of its factors and factor the quotient.",
    ["cubic-quotient-factored"],
    [
      "Divide a cubic by a linear binomial that is one of its factors.",
      "Write the quotient in factored form.",
    ],
    [
      "If a cubic is built as $(3x-2)(x-5)(x+1)$, dividing by $3x-2$ gives back $(x-5)(x+1)$.",
      "The leading coefficient 3 of the divisor cancels the 3 at the front of the cubic.",
    ],
    {
      prompt: "Write $\\frac{3x^3-14x^2-7x+10}{3x-2}$ in factored form.",
      steps: [
        "Dividing gives $x^2-4x-5$.",
        "Factor: numbers with product $-5$ and sum $-4$ are $-5$ and $1$.",
        "The quotient is $(x-5)(x+1)$.",
      ],
      answer: "$(x-5)(x+1)$",
    },
    [
      "Divide the cubic by the divisor.",
      "Factor the quadratic quotient.",
      "Multiply back to check.",
    ],
    [
      "For $ax+b\\ne0$, $\\frac{(ax+b)q(x)}{ax+b}=q(x)$. The quotient is defined wherever the divisor is not zero.",
    ],
    [
      "A factor $(x-r)$ has zero $r$, so check the signs.",
      "The divisor's coefficient cancels; it does not stay in the quotient.",
      "Check by multiplication.",
    ],
    "Have your learner multiply the quotient by the divisor to get the cubic back.",
  ),
  lesson(
    "regents-complete-square-first-steps",
    "Which first steps are valid",
    "Decide which steps on a quadratic equation keep its solutions.",
    ["complete-square-first-steps"],
    [
      "Check that a step treats both sides and every term the same way.",
      "Recognize when the zero-product property cannot be used.",
    ],
    [
      "A step in solving an equation is correct when the new equation has exactly the same solutions as the old one.",
      "Dividing every term by a number and moving a term with a sign change are safe. Dividing only some terms is not.",
    ],
    {
      prompt: "For $2x^2+8x-10=0$, is $2x^2+8x=10$ a correct step?",
      steps: [
        "Subtract $-10$, that is, add 10, to both sides.",
        "The left side is $2x^2+8x$ and the right side is 10.",
        "So the step is correct.",
      ],
      answer: "yes",
    },
    [
      "Look at each term and each sign.",
      "Ask whether the same operation was applied to both sides.",
      "Remember that the zero-product property needs a product equal to 0.",
    ],
    [
      "Two equations are equivalent when they have the same solution set. Adding the same number to both sides, or dividing both sides by the same nonzero number, gives an equivalent equation.",
    ],
    [
      "Moving a term to the other side changes its sign.",
      "Divide every term, including the constant.",
      "A product equal to a nonzero number does not mean each factor equals that number.",
    ],
    "Ask your learner to substitute a solution of the original equation into each step.",
  ),
  lesson(
    "regents-exponential-points-statement",
    "Doubling time from three points",
    "Use equally spaced points to find the factor, the doubling time and the model.",
    ["exponential-points-statement"],
    [
      "Find the factor between points at equal spacing.",
      "Write the matching model $a\\cdot2^{x/T}$.",
    ],
    [
      "If each value is twice the previous one at equal steps, the quantity doubles each step. A line adds the same amount instead.",
      "If the step is $T$ units wide, the model is $y=a\\cdot2^{x/T}$.",
    ],
    {
      prompt:
        "Points $(0,20)$, $(3,40)$ and $(6,80)$ lie on a graph. Find the model.",
      steps: [
        "$40\\div20=2$ and $80\\div40=2$.",
        "The value doubles every 3 units.",
        "$y=20\\cdot2^{x/3}$.",
      ],
      answer: "$y=20\\cdot2^{x/3}$",
    },
    [
      "Divide neighbouring $y$-values.",
      "Read the step in $x$.",
      "Write and test the model.",
    ],
    ["If $y=a\\,2^{x/T}$ then $y(x+T)=2y(x)$."],
    [
      "The exponent is $x/T$, not $x$.",
      "Do not confuse the doubling time with the total span of the points.",
      "A constant difference means linear.",
    ],
    "Ask your learner to test the model at all three points.",
  ),
  lesson(
    "regents-rational-abs-solution-count",
    "Counting solutions from two graphs",
    "Count the points where a rational graph meets an absolute-value graph.",
    ["rational-abs-solution-count"],
    [
      "Interpret solutions of $f(x)=g(x)$ as meeting points of two graphs.",
      "Split an absolute value into two cases to check a count.",
    ],
    [
      "A solution of $f(x)=g(x)$ is an input where the graphs have the same height. So counting solutions means counting meeting points.",
      "A rational graph has a vertical asymptote that no solution can touch, and an absolute-value graph has a corner.",
    ],
    {
      prompt:
        "The graphs of $y=\\frac{1}{x}$ and $y=|x|-2$ are drawn. How many solutions does $\\frac{1}{x}=|x|-2$ have?",
      steps: [
        "For $x>0$: $\\frac{1}{x}=x-2$ gives $x^2-2x-1=0$, and the root $1+\\sqrt{2}$ is positive.",
        "For $x<0$: $\\frac{1}{x}=-x-2$ gives $x^2+2x+1=0$, with the root $x=-1$, which is negative.",
        "There are two solutions.",
      ],
      answer: "2",
    },
    [
      "Look at where the graphs cross.",
      "Count each crossing once.",
      "Confirm with the two cases of the absolute value.",
    ],
    [
      "The solution set of $f(x)=g(x)$ is the set of $x$-coordinates of the intersection points, restricted to inputs where both functions are defined.",
    ],
    [
      "Graphs that approach each other need not meet.",
      "No solution can lie on the asymptote.",
      "Count each meeting point once.",
    ],
    "Ask your learner to say where the asymptote and the corner are before counting.",
  ),
];

const fm = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({ templateId, facetId, extent: "partial", rationale });
export const regentsAlgebraTwoReasoningFacetMappings: FacetMapping[] = [
  fm(
    "study-design-classify",
    "causal-claims.core",
    "Single choice classifying a described study as an experiment or observational and choosing the reason. Does not assess designing a study, randomization methods, or writing the reason.",
  ),
  fm(
    "quartic-factored-form",
    "factor-quadratics.core",
    "Single choice for the complete factorization of $cx^4-ck^4$ with a common factor and repeated difference of squares. Does not assess other quartics or factoring over the complex numbers.",
  ),
  fm(
    "cubic-quotient-factored",
    "rational-expressions.core",
    "Single choice for the factored quotient of a cubic and one of its linear factors with leading coefficient 2, 3 or 5. Does not assess division with a remainder, or simplifying general rational expressions.",
  ),
  fm(
    "complete-square-first-steps",
    "equation-reasoning.core",
    "Single choice judging three first steps on a quadratic equation, including a sign slip, a partial division and a zero-product error. Does not assess carrying out the completion or writing a justification.",
  ),
  fm(
    "exponential-points-statement",
    "exponential-models.core",
    "Single choice for the doubling time and model through three equally spaced graphed points with ratio 2. Does not assess other bases, fitting data by regression, or points that are not equally spaced.",
  ),
  fm(
    "rational-abs-solution-count",
    "graphical-equation-solving.core",
    "Single choice for the number of solutions of a rational expression equal to an absolute-value expression, shown with both graphs. Does not assess finding the solutions or other function pairs.",
  ),
];
