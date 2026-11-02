import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const heightModelChainMethods: Record<string, ProblemMethod> = {
  "quadratic-model-chain": {
    goal: "Fix a height model's constant from the drop height and solve for landing time, or build a quadratic from vertex and zero and evaluate it.",
    intuition:
      "A height model has a constant that depends on the situation. At time zero the height equals the starting height, which fixes the constant. A parabola with vertex $(h,k)$ has the form $y=a(x-h)^2+k$, and a point on it, such as where it lands at height 0, fixes $a$.",
    terms: [
      ["constant-term", "In a height model, it is the height at time $t = 0$."],
      "vertex-form",
    ],
    method: [
      "Fix the unknown constant or coefficient from a known point: the start for the constant, or the landing point for $a$.",
      "Write the finished model, then set the height to 0 and solve for the time, or substitute the new input.",
      "Take the positive time, or round only the final height as the problem states.",
    ],
    watch:
      "Fix the constant from the starting height before solving. Substitute the offset $x-h$, not $x$, into vertex form.",
  },
};

export const heightModelChainPrinciples: Record<string, string> = {
  "quadratic-model-chain":
    "A function $h(t)=-gt^2+c$ has $h(0)=c$, so the constant is the starting height, and $h(t)=0$ gives $t=\\sqrt{c/g}$ for $t\\ge0$. A parabola with vertex $(p,k)$ is $y=a(x-p)^2+k$, and a zero at $x=z$ gives $a=-k/(z-p)^2$.",
};

export const heightModelChainLessons = [
  chainLesson({
    id: "quadratic-model-chain",
    title: "Build the height model, then use it",
    summary:
      "Fix the unknown in a height model from what the situation gives, then solve for a time or evaluate at a new input.",
    templateIds: ["quadratic-model-chain"],
    objectives: [
      "Use the starting height to fix the constant of a falling-object model and solve for the landing time.",
      "Build a quadratic from its vertex and a zero, then evaluate it and round to the nearest tenth.",
    ],
    openingTitle: "The situation fixes the missing number",
    opening: [
      "A height model such as $h=-16t^2+c$ has a constant $c$ that the situation decides. At time $t=0$ the object has not fallen yet, so $h(0)=c$ is the starting height. Once $c$ is known, the model is complete.",
      "A parabola can also be fixed by its highest point and one more point. The vertex form $y=a(x-h)^2+k$ uses the highest point $(h,k)$ and leaves one unknown, $a$. A point such as the landing spot, where the height is 0, determines $a$.",
    ],
    example: {
      prompt:
        "A ball's height, in feet, depends on its horizontal distance $x$ from the thrower. Its highest point is 20 feet at $x=5$, and it lands at $x=15$. How high is the ball at $x=8$? Round to the nearest tenth.",
      steps: [
        "Vertex form with vertex $(5, 20)$: $h=a(x-5)^2+20$.",
        "The landing point $(15, 0)$ gives $0=100a+20$, so $a=-\\frac{20}{100}=-0.2$.",
        "At $x=8$, $x-5=3$, so $h=-0.2\\cdot9+20=18.2$.",
        "The height is 18.2 feet, already a tenth.",
      ],
      answer: "18.2 feet",
    },
    methodTitle: "Fix, finish, then use",
    method: [
      "Fix: put the known point into the model. For a falling object, $t=0$ and the starting height give $c$. For a parabola, the zero gives $a$.",
      "Finish and use: set $h=0$ and solve $-gt^2+c=0$ for the positive $t$, or substitute the asked $x$ into the finished model and round only the final value.",
    ],
    formalTitle: "Why the point fixes the number",
    formal: [
      "A function value at a known input is an equation in the unknown parameter. For $h(t)=-gt^2+c$, $h(0)=c$ gives the parameter directly. For $y=a(x-p)^2+k$, the equation $0=a(z-p)^2+k$ is linear in $a$ and has the unique solution $a=-k/(z-p)^2$ when $z\\ne p$.",
      "The equation $-gt^2+c=0$ has solutions $t=\\pm\\sqrt{c/g}$ when $c/g\\ge0$; only the positive solution describes a time after the drop.",
    ],
    pitfalls: [
      "Use the starting height as the constant before you solve for the time.",
      "Substitute $x-p$, the offset from the vertex, into vertex form.",
      "Round only the final height, not $a$.",
    ],
    parentGuide:
      "Ask your learner what the height is at time zero and what the height is when the object lands, then to explain how each fact is used.",
  }),
];

export const heightModelChainFacetMappings: FacetMapping[] = [
  {
    templateId: "quadratic-model-chain",
    facetId: "nonlinear-equation-modeling.core",
    extent: "partial",
    rationale:
      "Numeric entry for dropping an object from a stated height with a given coefficient in feet or meters and an integer landing time, and for a quadratic built from its vertex and a zero then evaluated and rounded to the nearest tenth. Does not assess graphing the parabola, non-integer landing times, initial velocity terms, or choosing the model.",
  },
];
