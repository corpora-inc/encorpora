import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { assemble, random, type Random } from "./distribution-practice";
import type { Scene } from "./scene/spec";
import type { Step } from "./scene/timeline";

/**
 * Read the temperature a liquid thermometer shows (Virginia SOL grade 3:
 * "the temperature a Fahrenheit thermometer shows"). The figure is the
 * scenes-v2 `thermometer`: one scale in °F or °C, small marks every 1 or 2
 * degrees, numbers every 5 or 10, and the liquid ending on a mark. Most
 * readings fall between numbered marks, so the learner works out what one
 * small mark is worth and counts on from the number below the liquid. A
 * minority of instances read below zero, where the numbers below 0 are
 * negative and count down.
 */
export const thermometerReadingTemplate: TemplateMetadata = {
  id: "thermometer-reading",
  version: 1,
  title: "Read a thermometer",
  skillId: "mass-volume",
  gradeBand: "3–5",
  difficultyOffset: 0.1,
  requiredFigureCapability: "scenes-v2",
  description:
    "Read the temperature a liquid thermometer shows in degrees Fahrenheit or Celsius, on scales whose small marks are 1 or 2 degrees and whose numbers go up by 5 or 10, including some readings below zero.",
};
export const thermometerReadingTemplates: readonly TemplateMetadata[] = [
  thermometerReadingTemplate,
];

/** Scales whose small marks stay at least 6 px apart and whose numbers stay
 * at least 28 px apart in a 400 px tall figure (tested). */
export const thermometerScales = [
  { minor: 1, major: 5, span: 30 },
  { minor: 1, major: 10, span: 40 },
  { minor: 2, major: 10, span: 40 },
  { minor: 2, major: 10, span: 60 },
] as const;
export const THERMOMETER_HEIGHT = 400;

export type ThermometerVariant = "fahrenheit" | "celsius" | "below-zero";
export interface ThermometerModel {
  variant: ThermometerVariant;
  unit: "F" | "C";
  minor: 1 | 2;
  major: 5 | 10;
  min: number;
  max: number;
  reading: number;
  /** The numbered mark at or below the reading, and the small marks above it. */
  base: number;
  steps: number;
}

const unitName = (unit: "F" | "C") =>
  unit === "F" ? "degrees Fahrenheit" : "degrees Celsius";
/** A signed number as typeset math: a true minus sign. */
const n = (v: number) => `$${v < 0 ? `-${-v}` : v}$`;
const degreeWord = (k: number) => (k === 1 ? "degree" : "degrees");

export function thermometerModel(r: Random): ThermometerModel {
  // Grade 3 reads Fahrenheit mostly; below zero is the minority variant.
  const roll = r(0, 9);
  const variant: ThermometerVariant =
    roll < 5 ? "fahrenheit" : roll < 8 ? "celsius" : "below-zero";
  const unit =
    variant === "fahrenheit"
      ? "F"
      : variant === "celsius"
        ? "C"
        : (["F", "C"] as const)[r(0, 1)]!;
  const scale = thermometerScales[r(0, thermometerScales.length - 1)]!;
  const { minor, major, span } = scale;
  // The lowest number on the scale, a multiple of the label step.
  const lows =
    variant === "below-zero"
      ? [-30, -20, -10].filter((m) => m + span > 0 && m % major === 0)
      : variant === "fahrenheit"
        ? [0, 10, 20, 30, 40, 50, 60].filter((m) => m % major === 0)
        : [0, 10].filter((m) => m % major === 0);
  const min = lows[r(0, lows.length - 1)]!;
  const max = min + span;
  // A reading strictly inside the scale, on a numbered mark one time in ten
  // when the scale has one to offer. A reading equal to a number the hint
  // states (the step, the label gap, the spaces between labels) is skipped.
  const marks = span / minor;
  const named = new Set<number>([minor, major, major / minor]);
  const inside: number[] = [];
  for (let k = 1; k < marks; k++) {
    const v = min + k * minor;
    if (variant === "below-zero" && v >= 0) continue;
    if (named.has(Math.abs(v))) continue;
    inside.push(v);
  }
  const labeled = inside.filter((v) => v % major === 0);
  const between = inside.filter((v) => v % major !== 0);
  const candidates = r(0, 9) === 0 && labeled.length ? labeled : between;
  const reading = candidates[r(0, candidates.length - 1)]!;
  const base = Math.floor(reading / major) * major;
  return {
    variant,
    unit,
    minor,
    major,
    min,
    max,
    reading,
    base,
    steps: (reading - base) / minor,
  };
}

export function thermometerScene(m: ThermometerModel): Scene {
  return {
    v: 1,
    title: "Thermometer",
    maxHeight: THERMOMETER_HEIGHT,
    elements: [
      {
        type: "thermometer",
        id: "t",
        unit: m.unit,
        min: m.min,
        max: m.max,
        minor: m.minor,
        major: m.major,
        reading: m.reading,
        derived: true,
      },
    ],
  };
}

function render(m: ThermometerModel) {
  const unit = unitName(m.unit);
  const spaces = m.major / m.minor;
  const symbol = `°${m.unit}`;
  const prompt = `What temperature does the thermometer show, in ${unit}?`;
  // The hint names this scale's step and spacing; on a numbered mark it does
  // not name the mark, which would be the answer.
  const hint =
    m.steps === 0
      ? `The numbers on this thermometer go up by ${m.major} ${degreeWord(m.major)}, with ${spaces} small spaces between them, so each small mark is ${m.minor} ${degreeWord(m.minor)}. Look at where the top of the liquid ends: is it on a numbered mark?`
      : `The numbers on this thermometer go up by ${m.major} ${degreeWord(m.major)}, with ${spaces} small spaces between them, so each small mark is ${m.minor} ${degreeWord(m.minor)}. Find the last numbered mark below the top of the liquid, then count the small marks up to the top.`;
  const explanation = [
    `The numbers go up by ${m.major}, and there are ${spaces} spaces between numbers, so each small mark is $${m.major}\\div${spaces}=${m.minor}$ ${degreeWord(m.minor)}.`,
    m.steps === 0
      ? `The top of the liquid is exactly at the mark numbered ${n(m.reading)}.`
      : `The last numbered mark below the top of the liquid is ${n(m.base)}. The liquid ends ${m.steps} small ${m.steps === 1 ? "mark" : "marks"} above it.`,
    ...(m.steps === 0
      ? []
      : [
          m.base < 0
            ? `Counting up from ${n(m.base)}: $-${-m.base}+${m.steps}\\times${m.minor}=${m.reading < 0 ? `-${-m.reading}` : m.reading}$. Below 0 the readings are negative, and numbers closer to 0 are warmer.`
            : `Counting up from ${n(m.base)}: $${m.base}+${m.steps}\\times${m.minor}=${m.reading}$.`,
        ]),
    `The thermometer shows ${n(m.reading)}${symbol}.`,
  ];
  // The hint plays on the figure: the numbered mark to count from.
  const hintCue: Step[] | undefined =
    m.steps === 0
      ? undefined
      : [
          {
            caption: "Start at the last numbered mark below the liquid.",
            actions: [
              { do: "highlight", target: `t.tick.${m.base}` },
              { do: "highlight", target: `t.label.${m.base}` },
            ],
          },
        ];
  return { prompt, hint, explanation, hintCue };
}

export interface ThermometerCase {
  model: ThermometerModel;
  problem: GeneratedProblem;
}

export function thermometerReadingCase(seed: string): ThermometerCase {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = thermometerReadingTemplate;
  const r = random(meta.id, seed);
  const model = thermometerModel(r);
  const { prompt, hint, explanation, hintCue } = render(model);
  const figure: SemanticFigure = {
    kind: "scene",
    scene: thermometerScene(model),
  };
  const problem = assemble(meta, seed, r, {
    prompt,
    figure,
    answer: String(model.reading),
    hint,
    explanation,
  });
  return {
    model,
    problem: {
      ...problem,
      public: {
        ...problem.public,
        response: {
          kind: "number",
          label: `Temperature in ${symbolOf(model.unit)}`,
        },
      },
      ...(hintCue ? { hintCue } : {}),
      variant: {
        id: `${model.variant}-${model.minor === 1 ? "ones" : "twos"}`,
      },
    },
  };
}
const symbolOf = (unit: "F" | "C") => `°${unit}`;

export function thermometerReadingGenerate(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (templateId !== thermometerReadingTemplate.id)
    throw new Error(`Unknown thermometer template: ${templateId}`);
  return thermometerReadingCase(seed).problem;
}
