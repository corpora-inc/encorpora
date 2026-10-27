import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  decimalText,
  dispatch,
  numberSurface,
  pick,
} from "./chain-kit";

export const heightModelChainTemplate: TemplateMetadata = {
  id: "quadratic-model-chain",
  version: 1,
  title: "Build a height model from context, then use it",
  skillId: "nonlinear-equation-modeling",
  gradeBand: "9–12",
  difficultyOffset: 0.65,
  description:
    "Set the constant of a falling-object height model from the drop height and solve for the landing time, or build a quadratic from its vertex and a zero and evaluate it at another input, rounded to the nearest tenth.",
};

const axes = {
  units: defineAxis("units", ["feet", "meters"] as const),
};
interface Model {
  kind: "drop-landing" | "vertex-zero";
  /** drop-landing: landing time and the coefficient. */
  time: number;
  coefficient: number;
  /** vertex-zero: peak, horizontal distance from the vertex to the zero, query offset from the vertex. */
  peak: number;
  halfWidth: number;
  vertexAt: number;
  offset: number;
}
function model(
  r: (lo: number, hi: number) => number,
  a: { units: "feet" | "meters" },
): Model {
  const kind = pick(r, ["drop-landing", "vertex-zero"] as const);
  const blank = {
    time: 0,
    coefficient: 0,
    peak: 0,
    halfWidth: 0,
    vertexAt: 0,
    offset: 0,
  };
  if (kind === "drop-landing")
    return {
      ...blank,
      kind,
      time: r(2, 9),
      coefficient: a.units === "feet" ? 16 : 5,
    };
  for (let tries = 0; tries < 300; tries++) {
    const peak = r(8, 40);
    const halfWidth = r(4, 12);
    const offset = r(1, halfWidth - 1) * (r(0, 1) ? 1 : -1);
    const num = peak * (halfWidth * halfWidth - offset * offset) * 10;
    const den = halfWidth * halfWidth;
    if (2 * (num % den) === den) continue; // exact tie
    if (num % den === 0) continue; // want a rounded value
    return { ...blank, kind, peak, halfWidth, vertexAt: r(4, 14), offset };
  }
  throw new Error("Need three retries");
}
export const heightModelChain = chainFamily({
  template: heightModelChainTemplate,
  axes,
  model,
  variant: (m) => m.kind,
  render: (m, a) => {
    const unit = a.units === "feet" ? "feet" : "meters";
    if (m.kind === "drop-landing") {
      const c = m.coefficient * m.time * m.time;
      return numberSurface({
        prompt: `A ball is dropped from a platform ${c} ${unit} above the ground. Its height after $t$ seconds is $h=-${m.coefficient}t^2+c$, where $c$ is a constant and $h$ is in ${unit}. After how many seconds does the ball reach the ground?`,
        answer: String(m.time),
        hint: `At $t=0$ the ball is on the platform, ${c} ${unit} up. Put $t=0$ into $h=-${m.coefficient}t^2+c$ to find the constant $c$ before you solve for the time.`,
        explanation: [
          `At $t=0$ the height is ${c}, so $c=${c}$ and the model is $h=-${m.coefficient}t^2+${c}$.`,
          `The ball reaches the ground when $h=0$: $-${m.coefficient}t^2+${c}=0$, so $${m.coefficient}t^2=${c}$.`,
          `Divide by ${m.coefficient}: $t^2=${m.time * m.time}$. Time is positive, so $t=${m.time}$.`,
          `The ball reaches the ground after ${m.time} seconds.`,
        ],
        label: "Answer (seconds)",
      });
    }
    const { peak: k, halfWidth: d, offset: u } = m;
    const x0 = m.vertexAt;
    const zeroAt = x0 + d;
    const query = x0 + u;
    const num = k * (d * d - u * u) * 10;
    const den = d * d;
    const rounded = Math.floor((2 * num + den) / (2 * den));
    return numberSurface({
      prompt: `A ball's height, in ${unit}, is a quadratic function of its horizontal distance $x$, in ${unit}, from the thrower. Its highest point is ${k} ${unit}, reached at $x=${x0}$, and it lands at $x=${zeroAt}$. How high is the ball at $x=${query}$? Round to the nearest tenth.`,
      answer: decimalText(rounded, 10),
      hint: `Use the vertex form $h=a(x-${x0})^2+${k}$. The landing point $(${zeroAt}, 0)$ must satisfy it, so substitute $x=${zeroAt}$ and $h=0$ to find $a$ first.`,
      explanation: [
        `The vertex is $(${x0}, ${k})$, so $h=a(x-${x0})^2+${k}$.`,
        `The ball lands at $(${zeroAt}, 0)$: $0=${d * d}a+${k}$, so $a=-\\frac{${k}}{${d * d}}$.`,
        `At $x=${query}$, $x-${x0}=${u}$, so $h=-\\frac{${k}}{${d * d}}\\cdot${u * u}+${k}=\\frac{${k * (d * d - u * u)}}{${d * d}}\\approx${(num / (den * 10)).toFixed(3)}$ before rounding.`,
        `Rounded to the nearest tenth, the height is ${decimalText(rounded, 10)} ${unit}.`,
      ],
      label: `Answer (${unit})`,
    });
  },
});

export const heightModelChainTemplates = [heightModelChainTemplate] as const;
export const heightModelChainGenerate = dispatch(heightModelChainTemplates, {
  "quadratic-model-chain": (seed) => heightModelChain.generate(seed).problem,
});
