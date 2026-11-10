import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
} from "./multi-part-choice";
import { axisRecord, chooseAxes, defineAxis, type Random } from "./variation/axes";

/** Choose an exponential model equation, then its base-matched solution.
 * Cards would hide the item from clients that only have multi-part choice,
 * so the two blanks are slots: four equations, then four positive integers. */
export const exponentialContextEquationTemplate: TemplateMetadata = {
  id: "exponential-context-equation",
  version: 1,
  title: "Equation for an exponential situation",
  skillId: "nonlinear-equation-modeling",
  gradeBand: "9–12",
  difficultyOffset: 0.5,
  requiredResponseCapability: "multi-part-choice-v1",
  description:
    "Choose the exponential equation for a doubling, tripling or half-life situation that can be solved by matching bases, then choose the positive integer solution. This does not use logarithms.",
};

export const exponentialContextAxes = {
  kind: defineAxis("kind", ["growth", "decay"] as const),
};

const pool = Array.from({ length: 18 }, (_, i) => 50 * (i + 1));

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1;
    const limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return low + (value % span);
  };
}
const pick = <T>(r: Random, items: readonly T[]) => items[r(0, items.length - 1)]!;

function shuffleIds(r: Random, labels: readonly string[]) {
  const order = labels.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = r(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const options = order.map((source, i) => ({
    id: "abcdef"[i]!,
    label: labels[source]!,
  }));
  return { options, key: options[order.indexOf(0)]!.id };
}

function growthModel(r: Random) {
  const base = pick(r, [2, 3, 4, 10] as const);
  const starts = pool.filter((a) => a % base === 0);
  const start = pick(r, starts);
  const steps = r(2, 6);
  const target = start * base ** steps;
  const linear = (target - start) / base;
  return { base, start, steps, target, linear, half: 0 };
}
function decayModel(r: Random) {
  const half = pick(r, [2, 3, 5, 10] as const);
  const steps = r(2, 5);
  const starts = pool.filter((a) => a % 2 ** steps === 0);
  if (!starts.length) return decayModel(r);
  const start = pick(r, starts);
  const target = start / 2 ** steps;
  const time = steps * half;
  const linear = start - target;
  return { base: 2, start, steps: time, target, linear, half };
}

export function generateExponentialContextEquation(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (templateId !== exponentialContextEquationTemplate.id)
    throw new Error(`Unknown template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const axes = chooseAxes(templateId, seed, exponentialContextAxes);
  const model = axes.kind === "decay" ? decayModel(r) : growthModel(r);
  if (
    !Number.isInteger(model.target) ||
    !Number.isInteger(model.linear) ||
    model.linear === model.steps ||
    model.linear <= 0 ||
    model.steps > 50
  )
    return generateExponentialContextEquation(templateId, `${seed}~`);
  const eq =
    axes.kind === "decay"
      ? `$${model.start}\\left(\\frac{1}{2}\\right)^{t/${model.half}}=${model.target}$`
      : `$${model.start}\\cdot ${model.base}^{t}=${model.target}$`;
  const wrongEq =
    axes.kind === "decay"
      ? [
          `$${model.start}-${model.half}t=${model.target}$`,
          `$${model.start}\\cdot \\frac{1}{2}t=${model.target}$`,
          `$\\left(\\frac{1}{2}\\right)^{t}=${model.target}$`,
        ]
      : [
          `$${model.start}+${model.base}t=${model.target}$`,
          `$${model.start}\\cdot ${model.base}t=${model.target}$`,
          `$${model.base}^{t}=${model.target}$`,
        ];
  const eqPick = shuffleIds(r, [eq, ...wrongEq]);
  const fillers = [model.steps + 1, model.steps + 2, model.steps + 3, model.linear]
    .filter((n, i, all) => n > 0 && n !== model.steps && all.indexOf(n) === i)
    .slice(0, 3);
  while (fillers.length < 3) fillers.push(model.steps + 4 + fillers.length);
  const numPick = shuffleIds(r, [String(model.steps), ...fillers.map(String)]);
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose the equation, then the solution",
    layout: "slots",
    blanks: [
      { id: "eq", label: "Equation", options: eqPick.options },
      { id: "n", label: "Solution for t", options: numPick.options },
    ],
  };
  const prompt =
    axes.kind === "decay"
      ? `A sample starts with ${model.start} atoms and has a half-life of ${model.half} hours. Which equation gives the hours $t$ until ${model.target} atoms remain? Then choose $t$.`
      : `A culture starts with ${model.start} bacteria and multiplies by ${model.base} every hour. Which equation gives the hours $t$ until there are ${model.target} bacteria? Then choose $t$.`;
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      skillId: exponentialContextEquationTemplate.skillId,
      prompt,
      response,
    },
    answer: serializeMultiPart(response, { eq: eqPick.key, n: numPick.key }),
    hint:
      axes.kind === "decay"
        ? `The sample starts at ${model.start} and the half-life is ${model.half} hours, until ${model.target} remain. Each half-life multiplies by 1/2. Match that factor, then read how many half-lives fit in t.`
        : `The culture starts at ${model.start} and multiplies by ${model.base}, until there are ${model.target}. Multiplying is not adding. Match the starting amount and the base, then read the exponent.`,
    explanation: [
      axes.kind === "decay"
        ? `After t hours the amount is ${model.start} times 1/2 to the power t/${model.half}.`
        : `After t hours the amount is ${model.start} times ${model.base} to the power t.`,
      `Set that equal to ${model.target}.`,
      axes.kind === "decay"
        ? `The powers of 1/2 match when t/${model.half} = ${model.steps / model.half}, so t = ${model.steps}.`
        : `${model.base} to the power t equals ${model.target / model.start}, which is ${model.base} to the ${model.steps}. So t = ${model.steps}.`,
      `The linear slip (target − start) ÷ ${axes.kind === "decay" ? model.half : model.base} is not ${model.steps}.`,
      "Doubling multiplies. It does not add.",
    ],
    variant: { id: axes.kind, axes: axisRecord(axes) },
  };
  return problem;
}
