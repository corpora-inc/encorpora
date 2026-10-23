import type { TemplateMetadata } from "./contracts.js";
import { assemble, random } from "./distribution-practice.js";
import { graph } from "./scene/author.js";

export const linearInitialValueMeaningTemplate: TemplateMetadata = {
  id: "linear-initial-value-meaning",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  requiredResponseCapability: "single-choice-v1",
  title: "Explain a model's starting value",
  skillId: "linear-models",
  gradeBand: "6–8",
  description:
    "Interpret the constant in a stated linear model as an amount at a meaningful zero input, with units.",
};

type Context = "tank" | "candle" | "ride";
type Case = {
  context: Context;
  initial: number;
  rate: number;
  duration: number;
  input: string;
  output: string;
  inputUnit: string;
  outputUnit: string;
  zeroMeaning: string;
  amount: string;
  direction: "increased" | "decreased";
  prompt: string;
  startingChoice: string;
  rateChoice: string;
  oneUnitChoice: string;
  totalChangeChoice: string;
};

/** Values stay in the stated context's domain; all four meanings are distinct. */
export function linearInitialValueMeaningCase(seed: string) {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = linearInitialValueMeaningTemplate;
  const r = random(meta.id, seed);
  const context: Context = (["tank", "candle", "ride"] as const)[r(0, 2)]!;
  const magnitude = r(context === "candle" ? 1 : 2, 5);
  const rate = context === "candle" ? -Math.min(magnitude, 2) : magnitude;
  const duration = r(
    context === "tank" ? 4 : context === "candle" ? 4 : 3,
    context === "tank" ? 7 : 6,
  );
  let initial: number;
  do
    initial = r(
      context === "candle" ? 14 : context === "tank" ? 12 : 7,
      context === "candle" ? 20 : context === "tank" ? 24 : 16,
    );
  while (initial === Math.abs(rate) * duration);
  const input = context === "tank" ? "t" : context === "candle" ? "h" : "d";
  const output = context === "tank" ? "V" : context === "candle" ? "H" : "C";
  const inputUnit =
    context === "tank" ? "minute" : context === "candle" ? "hour" : "kilometer";
  const outputUnit =
    context === "tank"
      ? "liter"
      : context === "candle"
        ? "centimeter"
        : "dollar";
  const zeroMeaning =
    context === "tank"
      ? "when filling began"
      : context === "candle"
        ? "when the candle was lit"
        : "when the booked ride began, before traveling";
  const amount =
    context === "tank"
      ? "water in the tank"
      : context === "candle"
        ? "height of the candle"
        : "ride cost";
  const direction = rate > 0 ? "increased" : "decreased";
  const changingTerm = `${Math.abs(rate)}${input}`;
  const expression =
    r(0, 1) === 0
      ? `${rate < 0 ? "-" : ""}${changingTerm} + ${initial}`
      : `${initial} ${rate < 0 ? "-" : "+"} ${changingTerm}`;
  const model = `${output} = ${expression}`;
  const quantity =
    context === "tank"
      ? "the volume $V$ of water in a tank"
      : context === "candle"
        ? "the height $H$ of a candle"
        : "the ride cost $C$";
  const inputDescription =
    context === "tank"
      ? "minutes since filling began"
      : context === "candle"
        ? "hours since the candle was lit"
        : "kilometers traveled since the booked ride began";
  const prompt = `For the first ${duration} ${inputUnit}s ${context === "tank" ? "of filling" : context === "candle" ? "after lighting" : "of a booked ride"}, ${quantity}, in ${outputUnit}s, is modeled by $${model}$, where $${input}$ is the number of ${inputDescription}. What does the number ${initial} mean in this model?`;
  const startingChoice =
    context === "tank"
      ? `There were ${initial} liters of water in the tank when filling began.`
      : context === "candle"
        ? `The candle was ${initial} centimeters tall when it was lit.`
        : `The booked ride cost ${initial} dollars before any distance was traveled.`;
  const rateChoice =
    context === "tank"
      ? `The tank gained ${initial} liters of water each minute.`
      : context === "candle"
        ? `The candle lost ${initial} centimeters of height each hour.`
        : `The ride cost increased by ${initial} dollars each kilometer.`;
  const oneUnitChoice =
    context === "tank"
      ? `There were ${initial} liters of water in the tank one minute after filling began.`
      : context === "candle"
        ? `The candle was ${initial} centimeters tall one hour after it was lit.`
        : `The ride cost ${initial} dollars after one kilometer was traveled.`;
  const totalChangeChoice =
    context === "tank"
      ? `The tank gained ${initial} liters of water during the first ${duration} minutes.`
      : context === "candle"
        ? `The candle lost ${initial} centimeters of height during the first ${duration} hours.`
        : `The ride cost increased by ${initial} dollars over the first ${duration} kilometers.`;
  const givens: Case = {
    context,
    initial,
    rate,
    duration,
    input,
    output,
    inputUnit,
    outputUnit,
    zeroMeaning,
    amount,
    direction,
    prompt,
    startingChoice,
    rateChoice,
    oneUnitChoice,
    totalChangeChoice,
  };
  const final = initial + rate * duration;
  const yMax = Math.ceil((Math.max(initial, final) + 5) / 5) * 5;
  const figure = {
    kind: "scene" as const,
    scene: graph({
      x: [0, duration],
      y: [0, yMax],
      grid: [1, 5],
      tick: [1, 5],
      axisNames: [`${inputUnit}s`, `${outputUnit}s`],
    })
      .line({ m: rate, b: initial })
      .point(0, initial, `(0, ${initial})`)
      .scene(),
  };
  const change = Math.abs(rate) * duration;
  const rateMeaning =
    context === "tank"
      ? `The tank gains ${rate} liters each minute`
      : context === "candle"
        ? `The candle loses ${-rate} centimeters of height each hour`
        : `The ride cost increases by ${rate} dollars each kilometer`;
  return {
    ...givens,
    problem: assemble(meta, seed, r, {
      prompt,
      figure,
      answer: "",
      hint: `In $${model}$, try $${input} = 0$. For this ${context === "ride" ? "booked ride" : context}, what does zero ${inputUnit}s mean, and which term is left?`,
      explanation: [
        `Here $${input} = 0$ means ${zeroMeaning}. The changing term is zero then, so $${output} = ${initial}$.`,
        `The output $${output}$ measures ${amount} in ${outputUnit}s. The point $\\left(0, ${initial}\\right)$ on the graph therefore says: ${startingChoice}`,
        `${rateMeaning}; over ${duration} ${inputUnit}s, the amount ${direction} by ${change} ${outputUnit}${change === 1 ? "" : "s"}. Those are different quantities from the starting amount.`,
      ],
      choices: [
        { label: startingChoice, correct: true },
        {
          label: rateChoice,
          feedback: `${rateMeaning}. The number ${initial} is an amount in ${outputUnit}s when $${input} = 0$, not a change per ${inputUnit}.`,
        },
        {
          label: oneUnitChoice,
          feedback: `One ${inputUnit} later, the changing term is no longer zero. To read the starting amount, use $${input} = 0$.`,
        },
        {
          label: totalChangeChoice,
          feedback: `Over ${duration} ${inputUnit}s, the change is ${change} ${outputUnit}${change === 1 ? "" : "s"}. The number ${initial} gives the amount when $${input} = 0$.`,
        },
      ],
    }),
  };
}
