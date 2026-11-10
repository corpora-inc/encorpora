import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Methods, principles and the lesson for trigonometric equations from
 * sinusoidal models (HSF.TF.B.7): isolate, invert in radians, complete the
 * solution set by symmetry and period, and read the solutions in context.
 */

const senses = { period: "period", periods: "period", model: "model" };
const noLink = ["opposite", "half", "range", "even", "turn"];

export const trigModelEquationsMethods: Record<string, ProblemMethod> = {
  "trig-model-inverse-setup": {
    goal: "Isolate the sine or cosine in a model's equation, write one solution with the inverse function, and find the first time.",
    intuition:
      "A sinusoidal model such as $d(t)=1.5\\sin\\left(\\frac{\\pi}{6}(t-2)\\right)+5$ is a wave. To find when it equals a value, undo the outside steps first: subtract the midline and divide by the amplitude. Only then does the inverse sine or cosine give an angle. Undo the inside steps last, to turn that angle into a time.",
    senses,
    noLink,
    terms: ["inverse-trig-function", "radian", "amplitude", "midline"],
    method: [
      "Subtract the midline value and divide by the amplitude, so the sine or cosine stands alone.",
      "Apply the inverse function to both sides, with the calculator in radian mode: $\\arcsin$ for sine, $\\arccos$ for cosine.",
      "Divide by the number in front of $t$ (multiply by its reciprocal) and add back the shift.",
      "If that time is before the domain or another solution comes first, use the second angle or add a period.",
    ],
    watch:
      "Do not apply the inverse to the whole equation before isolating the sine or cosine, and keep the calculator in radians.",
  },
  "trig-model-solve-interval": {
    goal: "Find every time in a model's domain when it reaches a value, the next such time, or how many there are.",
    intuition:
      "The inverse sine or cosine gives one angle, but a wave reaches each value twice in every cycle. The second angle comes from symmetry: $\\pi-\\theta$ has the same sine as $\\theta$, and $-\\theta$ has the same cosine. After that the wave repeats every period, so adding the period gives more solutions.",
    senses,
    noLink,
    terms: ["inverse-trig-function", "period", "unit-circle"],
    method: [
      "Isolate the sine or cosine and find one angle $\\theta$ with the inverse function, in radians.",
      "Find the second angle: $\\pi-\\theta$ for sine, $-\\theta$ for cosine. Turn both angles into times.",
      "Add or subtract the period while the time stays in the domain, then list the times in order.",
    ],
    watch:
      "Two solutions in each cycle, not one. Check the list against the graph: one time for each crossing of the dashed line.",
  },
  "trig-model-interpret-solutions": {
    goal: "Say what the solutions of a model's equation mean: instants, repeats, no solution, negative times, above or below.",
    intuition:
      "In a model, $t$ is a time and the output is a measured quantity, such as a depth in meters. A solution of $d(t)=4.2$ is an instant when the depth is exactly 4.2 m. It is not how long the depth stays there. A wave repeats every period, so every solution repeats too. A value beyond the wave's highest or lowest point is never reached.",
    senses,
    noLink,
    terms: ["period", "midline", "amplitude"],
    method: [
      "Say each solution as a sentence with units: at about this time, the quantity is this value.",
      "Repeat each solution every period. A negative time is before the start; add a period to bring it into the domain.",
      "If the value is outside the range from the minimum to the maximum, there is no solution. Between two solutions, test one time to see whether the quantity is above or below.",
    ],
    watch:
      "A solution is a moment, not a duration. The two solutions in a cycle are not evenly spaced unless the value is the midline.",
  },
};

export const trigModelEquationsPrinciples: Record<string, string> = {
  "trig-model-inverse-setup":
    "If $A\\sin(B(t-C))+D=k$, then $\\sin(B(t-C))=\\frac{k-D}{A}$ and one solution is $t=C+\\frac{1}{B}\\arcsin\\left(\\frac{k-D}{A}\\right)$, with $\\arcsin$ in radians. With cosine, use $\\arccos$. The inverse gives the angle in its restricted range only.",
  "trig-model-solve-interval":
    "If $\\sin x=r$ with $|r|<1$, the solutions are $x=\\theta+2\\pi n$ and $x=\\pi-\\theta+2\\pi n$, where $\\theta=\\arcsin r$. If $\\cos x=r$, they are $x=\\pm\\theta+2\\pi n$, where $\\theta=\\arccos r$. In a model these become two times per period, repeated every period.",
  "trig-model-interpret-solutions":
    "A solution of $f(t)=k$ is an instant at which the quantity equals $k$. A sinusoid with midline $D$ and amplitude $A$ takes every value strictly between $D-A$ and $D+A$ twice per period, repeats every period, and never takes a value outside $[D-A,D+A]$.",
};

export const trigModelEquationsLessons: Lesson[] = [
  chainLesson({
    id: "trig-model-equations-lesson",
    title: "Solving and reading equations from wave models",
    summary:
      "To find when a sinusoidal model reaches a value, isolate the sine or cosine, apply the inverse function in radians, and undo the inside of the function. Then use symmetry and the period to find every solution, and read each one as an instant in context.",
    senses,
    noLink,
    templateIds: [
      "trig-model-inverse-setup",
      "trig-model-solve-interval",
      "trig-model-interpret-solutions",
    ],
    objectives: [
      "Solve a sinusoidal model's equation with an inverse function and a calculator in radian mode, and complete the solution set on the domain.",
      "Interpret the solutions in context: instants, repeats every period, no solution, negative times, and when the quantity is above or below a value.",
    ],
    openingTitle: "Undo the outside, then the inside",
    opening: [
      "Tides, Ferris wheels, temperatures and springs repeat. A sinusoidal model describes them: $y=A\\sin(B(t-C))+D$ or the same with cosine. $D$ is the midline, $A$ the amplitude, $C$ the shift, and the period is $\\frac{2\\pi}{B}$.",
      "To find when the model equals a value, peel off the outside first: subtract $D$ and divide by $A$. Now the sine or cosine is alone, equal to a number between $-1$ and $1$.",
      "The inverse function gives one angle. $\\arcsin$ returns an angle between $-\\frac{\\pi}{2}$ and $\\frac{\\pi}{2}$, and $\\arccos$ one between $0$ and $\\pi$. Use radian mode, because $B$ is written with $\\pi$.",
      "A wave reaches each value twice per cycle. The second angle is $\\pi-\\theta$ for sine and $-\\theta$ for cosine. Then add whole periods.",
    ],
    example: {
      prompt:
        "The depth of the water at a dock, in meters, $t$ hours after midnight is $d(t)=2\\sin\\left(\\frac{\\pi}{6}(t-1)\\right)+5$ for $0\\le t\\le 24$. When is the depth 6 m?",
      steps: [
        "Subtract 5 and divide by 2: $\\sin\\left(\\frac{\\pi}{6}(t-1)\\right)=0.5$.",
        "One angle is $\\arcsin(0.5)=\\frac{\\pi}{6}$; the other with the same sine is $\\pi-\\frac{\\pi}{6}=\\frac{5\\pi}{6}$.",
        "So $\\frac{\\pi}{6}(t-1)=\\frac{\\pi}{6}$ or $\\frac{5\\pi}{6}$, giving $t=2$ or $t=6$.",
        "The period is $\\frac{2\\pi}{\\pi/6}=12$ hours, so the depth is also 6 m at $t=14$ and $t=18$.",
      ],
      answer: "At 2, 6, 14 and 18 hours after midnight",
    },
    methodTitle: "Isolate, invert, complete, interpret",
    method: [
      "Isolate the sine or cosine; apply its inverse in radian mode.",
      "Find the second angle by symmetry, turn both angles into times, and add whole periods inside the domain.",
      "Read each time as an instant with units, and check it on the graph.",
    ],
    formalTitle: "The general solution",
    formal: [
      "For $|r|\\le1$, $\\sin x=r$ exactly when $x=\\arcsin r+2\\pi n$ or $x=\\pi-\\arcsin r+2\\pi n$ for an integer $n$; and $\\cos x=r$ exactly when $x=\\pm\\arccos r+2\\pi n$.",
      "For $|r|>1$ there is no solution: the model never reaches the value, because $D-A\\le y\\le D+A$.",
    ],
    pitfalls: [
      "Applying the inverse before subtracting the midline and dividing by the amplitude.",
      "Forgetting to divide by $B$, or leaving the calculator in degree mode.",
      "Stopping at the one angle the inverse gives, or forgetting to add periods.",
      "Reading a solution as a length of time instead of an instant.",
    ],
    parentGuide:
      "Ask your learner to say each answer as a sentence with units, and to point to it on the graph where the dashed line meets the curve.",
  }),
];

const tf = "trigonometric-equations.HSF.TF.B.7";
export const trigModelEquationsFacetMappings: FacetMapping[] = [
  {
    templateId: "trig-model-inverse-setup",
    facetId: tf,
    extent: "partial",
    rationale:
      "Solves an equation from a sinusoidal model (tide, Ferris wheel, temperature, daylight, spring) with an inverse function: isolate the sine or cosine, choose the inverse-function expression for one solution, and evaluate the first time in the domain with a radian-mode calculator, against degree-mode, dropped-shift and dropped-division slips. Choices, not typed entries; the app's calculator has no trigonometric keys, so the learner uses their own.",
  },
  {
    templateId: "trig-model-solve-interval",
    facetId: tf,
    extent: "partial",
    rationale:
      "Finds the complete solution set of a model's equation on its domain, the next solution after a given one, or the number of solutions, using the second angle by symmetry and the period. Distractors track principal-branch-only, wrong-symmetry, ignored-shift, first-period-only and degree-mode answers.",
  },
  {
    templateId: "trig-model-interpret-solutions",
    facetId: tf,
    extent: "partial",
    rationale:
      "Interprets the solutions of a model's equation in context: instants rather than durations, repetition every period, no solution when the value is outside the model's range, a negative time moved into the domain by a period, and the stretches where the quantity is above or below the value.",
  },
];
