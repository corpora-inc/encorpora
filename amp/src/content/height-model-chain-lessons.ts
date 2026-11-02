import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const heightModelChainMethods: Record<string, ProblemMethod> = {
  "quadratic-model-chain": {
    goal: "Fix a height model's constant from the drop height and solve for landing time, or build a quadratic from vertex and zero and evaluate it.",
    senses: { sides: "side-of-equation", difference: "difference-subtract" },
    noLink: ["change"],
    intuition:
      "A height model is a formula for an object's height. In a falling-object model $h=-gt^2+c$, the constant $c$, a number that does not change, depends on the situation. At time zero the height equals the starting height, which fixes $c$. A parabola is the U-shaped graph of a quadratic, and its vertex is its turning point. A parabola with vertex $(h,k)$ has the form $y=a(x-h)^2+k$, called vertex form. A point on it, such as where it lands at height 0, fixes the number $a$.",
    terms: [
      [
        "constant-term",
        "In a falling-object model $-gt^2+c$, it is the height at time $t = 0$.",
      ],
      "vertex-form",
    ],
    method: [
      "Fix the unknown number from a known point: use the starting point for the constant, or the landing point for $a$.",
      "Write the finished model. Then set the height to 0 and solve for the time, or put in the new input.",
      "Keep the time that is not negative, because time is counted from the drop. Or round only the final height, as the problem asks.",
    ],
    watch:
      "Fix the constant from the starting height before solving. Put the difference $x-h$, how far across the input is from the vertex, into vertex form, not $x$ alone.",
  },
};

export const heightModelChainPrinciples: Record<string, string> = {
  "quadratic-model-chain":
    "A function $h(t)=-gt^2+c$, with $g>0$ and $c\\ge0$, has $h(0)=c$, so the constant is the starting height. Then $h(t)=0$ gives $t=\\sqrt{\\frac{c}{g}}$ for $t\\ge0$. A parabola with vertex $(p,k)$ is $y=a(x-p)^2+k$. A zero at $x=z$, with $z\\ne p$, gives $a=-\\frac{k}{(z-p)^2}$.",
};

export const heightModelChainLessons = [
  chainLesson({
    id: "quadratic-model-chain",
    title: "Build the height model, then use it",
    summary:
      "A height model is a formula for an object's height, such as $h=-16t^2+c$ for something dropped. Its missing number comes from the situation. At time $t=0$ nothing has fallen yet, so the height is $c$, the starting height. Once the missing number is known, use the model: solve for when the height is 0, or find the height at a new input.",
    templateIds: ["quadratic-model-chain"],
    senses: {
      model: "model",
      vertex: "vertex-parabola",
      parameter: "parameter",
      difference: "difference-subtract",
    },
    noLink: ["change", "leaves"],
    objectives: [
      "Use the starting height to fix the constant of a falling-object model and solve for the landing time.",
      "Build a quadratic from its vertex and a zero, then evaluate it and round to the nearest tenth.",
    ],
    openingTitle: "The situation fixes the missing number",
    opening: [
      "A model is a formula that describes a real situation. In $h=-16t^2+c$, $h$ is the height in feet after $t$ seconds, and $t^2$ means $t$ times $t$. The constant $c$, a number that does not change, is decided by the situation. At $t=0$, $h(0)=-16\\cdot0+c=c$, so $c$ is the starting height. Once $c$ is known, the model is complete.",
      "A parabola, the U-shaped graph of a quadratic, can also be fixed by its highest point and one more point. Vertex form, $y=a(x-p)^2+k$, uses the vertex $(p,k)$, which here is the highest point. That leaves one unknown, the number $a$. A point such as the landing spot, where the height is 0, gives an equation for $a$.",
    ],
    example: {
      prompt:
        "A ball's height, in feet, depends on its horizontal distance $x$ from the thrower. Its highest point is 20 feet at $x=5$, and it lands at $x=15$. How high is the ball at $x=8$? Round to the nearest tenth.",
      steps: [
        "Use vertex form with the highest point, the vertex, at $(5, 20)$: $h=a(x-5)^2+20$. Here $h$ is the height, and $a$ is still unknown.",
        "The ball lands at $x=15$ with height 0, so put in the point $(15, 0)$: $0=a(15-5)^2+20=100a+20$. Subtract 20 and divide by 100: $a=-\\frac{20}{100}=-0.2$.",
        "Now use the finished model at $x=8$. Since $x-5=3$ and $3^2=9$, $h=-0.2\\cdot9+20=-1.8+20=18.2$.",
        "The height is 18.2 feet. It already has one decimal place, so rounding to the nearest tenth does not change it.",
      ],
      answer: "18.2 feet",
    },
    methodTitle: "Fix, finish, then use",
    method: [
      "Fix: put the known point into the model. For a falling object, $t=0$ and the starting height give $c$. For a parabola, the landing point, where the height is 0, gives $a$.",
      "Finish and use: to find when the object lands, set $h=0$ and solve $-gt^2+c=0$ for the positive $t$. Here $-g$ is the number multiplying $t^2$, so $g$ is a positive number such as 16. Or put the new $x$ into the finished model, and round only the final value.",
    ],
    formalTitle: "Why the point fixes the number",
    formal: [
      "A function value at a known input gives an equation for the unknown number, called a parameter. For $h(t)=-gt^2+c$, $h(0)=c$ gives the parameter directly. For $y=a(x-p)^2+k$, a zero at $x=z$ gives $0=a(z-p)^2+k$. When $z\\ne p$, this has exactly one solution, $a=-\\frac{k}{(z-p)^2}$.",
      "For $g>0$ and $c\\ge0$, the equation $-gt^2+c=0$ has solutions $t=\\pm\\sqrt{\\frac{c}{g}}$, where $\\pm$ means plus or minus. Only $t=\\sqrt{\\frac{c}{g}}$, the solution that is not negative, can be a time at or after the drop.",
    ],
    pitfalls: [
      "Use the starting height as the constant before you solve for the time.",
      "Put the difference $x-p$, how far across the input is from the vertex, into vertex form, not $x$ alone.",
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
