import type { TemplateMetadata } from "./contracts";
import { sceneSchema } from "./scene/spec";
import { barChartGeometry } from "./scene/components/bar-chart";
import { defineAxis } from "./variation/axes";
import { chainFamily, dispatch, numberSurface, pick } from "./chain-kit";

export const thermometerReadingTemplate: TemplateMetadata = {
  id: "read-thermometer",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  title: "Reading a thermometer",
  skillId: "mass-volume",
  gradeBand: "3–5",
  difficultyOffset: -0.1,
  description:
    "Read a temperature in degrees Fahrenheit or Celsius from the top of the liquid on a marked scale, or find how many degrees warmer or colder one reading is than another.",
};

interface Scale {
  name: "Fahrenheit" | "Celsius";
  max: number;
  step: number;
  /** Readings land on a gridline, away from both ends of the scale. */
  low: number;
  high: number;
}
const scales: readonly Scale[] = [
  { name: "Fahrenheit", max: 100, step: 5, low: 4, high: 18 },
  { name: "Celsius", max: 40, step: 2, low: 3, high: 17 },
];

const axes = {
  ask: defineAxis("ask", ["read", "warmer", "colder"] as const),
  /** A bar on a gridded scale (legacy) or a drawn bulb-and-tube thermometer,
   * which older clients cannot draw. */
  display: defineAxis("display", ["bar-scale", "thermometer"] as const, {
    needs: { thermometer: "scenes-v2" },
  }),
};
type Display = "bar-scale" | "thermometer";
interface Model {
  ask: "read" | "warmer" | "colder";
  display: Display;
  scale: Scale;
  first: number;
  second: number;
}
const model = (
  r: (lo: number, hi: number) => number,
  a: { ask: Model["ask"]; display: Display },
): Model => {
  const scale = pick(r, scales);
  const first = scale.step * r(scale.low, scale.high);
  const display = a.display;
  if (a.ask === "read") return { ask: a.ask, display, scale, first, second: 0 };
  const second = scale.step * r(scale.low, scale.high);
  const hi = Math.max(first, second);
  const lo = Math.min(first, second);
  const below = display === "thermometer" ? numberedBelow : labelBelow;
  // The hint names these numbers, so the answer must not be one of them.
  if (
    hi - lo < 3 * scale.step ||
    [below(scale, lo), below(scale, hi), scale.step].includes(hi - lo)
  )
    throw new Error("Need three retries");
  return { ask: a.ask, display, scale, first, second };
};

/** A drawn thermometer numbers every 10 degrees; its small marks are the
 * scale's step. */
const NUMBERED = 10;
/** The numbered mark just below a reading on a drawn thermometer. */
const numberedBelow = (_scale: Scale, value: number) =>
  NUMBERED * Math.ceil(value / NUMBERED) - NUMBERED;

/** The labeled gridline just below a reading, as the drawn chart labels it. */
function labelBelow(scale: Scale, value: number) {
  const g = barChartGeometry({
    type: "barChart",
    bars: [{ label: "x", value: 0 }],
    max: scale.max,
    step: scale.step,
  });
  return Math.max(...[...g.labeled].filter((v) => v < value));
}

/** Pixels per degree the drawn thermometer gets in a 400 px figure: about
 * 290 px of scale after the bulb, the names and the unit (capped at 7). */
const degreesToPixels = (scale: Scale) => Math.min(7, 290 / scale.max);
function thermometerFigure(m: Model) {
  const unit = m.scale.name === "Fahrenheit" ? ("F" as const) : ("C" as const);
  const one = (id: string, reading: number, label?: string, x = 0) => ({
    type: "thermometer" as const,
    id,
    ...(x ? { at: [x, 0] as [number, number] } : {}),
    unit,
    min: 0,
    max: m.scale.max,
    minor: m.scale.step as 2 | 5,
    major: NUMBERED as 10,
    reading,
    ...(label ? { label } : {}),
    ...(m.ask === "read" ? { derived: true } : {}),
  });
  const hi = Math.max(m.first, m.second),
    lo = Math.min(m.first, m.second);
  const pair: [string, number][] =
    m.ask === "warmer"
      ? [
          ["Morning", lo],
          ["Afternoon", hi],
        ]
      : [
          ["Noon", hi],
          ["Night", lo],
        ];
  // Side by side, 120 px apart: the first's numbers clear the second's name.
  const gap = 120 / degreesToPixels(m.scale);
  return {
    kind: "scene" as const,
    scene: sceneSchema.parse({
      v: 1,
      maxHeight: 400,
      elements:
        m.ask === "read"
          ? [one("thermometer", m.first)]
          : pair.map(([label, reading], i) =>
              one(`thermometer${i}`, reading, label, i * gap),
            ),
    }),
  };
}

const figure = (m: Model) => ({
  kind: "scene" as const,
  scene: sceneSchema.parse({
    v: 1,
    elements: [
      {
        type: "barChart",
        id: "thermometer",
        bars:
          m.ask === "read"
            ? [{ label: "Liquid", value: m.first }]
            : m.ask === "warmer"
              ? [
                  { label: "Morning", value: Math.min(m.first, m.second) },
                  { label: "Afternoon", value: Math.max(m.first, m.second) },
                ]
              : [
                  { label: "Noon", value: Math.max(m.first, m.second) },
                  { label: "Night", value: Math.min(m.first, m.second) },
                ],
        max: m.scale.max,
        step: m.scale.step,
        unit: `Degrees ${m.scale.name}`,
      },
    ],
  }),
});

export const thermometerReadingFamily = chainFamily({
  template: thermometerReadingTemplate,
  axes,
  model,
  variant: (m) => `${m.ask}-${m.scale.name.toLowerCase()}`,
  render: (m) => {
    if (m.display === "thermometer") return renderThermometer(m);
    const { scale } = m;
    const hi = Math.max(m.first, m.second);
    const lo = Math.min(m.first, m.second);
    const tick = `Each gridline is worth ${scale.step} degrees.`;
    const surface =
      m.ask === "read"
        ? numberSurface({
            prompt: `The liquid in a thermometer rises to the top of the bar. What temperature does the thermometer show, in degrees ${scale.name}?`,
            answer: String(m.first),
            hint: `${tick} The labeled line just below the top of the bar is ${labelBelow(scale, m.first)}. Count up from it by ${scale.step}s to the top.`,
            explanation: [
              `${tick}`,
              `The top of the bar is on a gridline. Counting by ${scale.step}s from the labeled line below it reaches ${m.first}.`,
              `The thermometer shows ${m.first} degrees ${scale.name}.`,
            ],
            label: `Answer (degrees ${scale.name})`,
          })
        : numberSurface({
            prompt:
              m.ask === "warmer"
                ? `Two thermometers show the temperature in the morning and in the afternoon. How many degrees ${scale.name} warmer was the afternoon than the morning?`
                : `Two thermometers show the temperature at noon and at night. How many degrees ${scale.name} colder was the night than noon?`,
            answer: String(hi - lo),
            hint: `${tick} Read the top of each bar first, counting up by ${scale.step}s from the labeled lines ${labelBelow(scale, lo)} and ${labelBelow(scale, hi)}. Then find how far apart the two readings are.`,
            explanation: [
              `${tick} The warmer reading is ${hi} and the cooler reading is ${lo}.`,
              `The difference is $${hi}-${lo}=${hi - lo}$.`,
              `It was ${hi - lo} degrees ${scale.name} ${m.ask === "warmer" ? "warmer in the afternoon" : "colder at night"}.`,
            ],
            label: `Answer (degrees ${scale.name})`,
          });
    return { ...surface, figure: figure(m) };
  },
});

/** The same model read from drawn thermometers: small marks, numbered
 * marks every 10 degrees, and the top of the liquid. */
function renderThermometer(m: Model) {
  const { scale } = m;
  const hi = Math.max(m.first, m.second);
  const lo = Math.min(m.first, m.second);
  const tick = `Each small mark is worth ${scale.step} degrees.`;
  const surface =
    m.ask === "read"
      ? numberSurface({
          prompt: `What temperature does this thermometer show, in degrees ${scale.name}?`,
          answer: String(m.first),
          hint: `${tick} The numbered mark just below the top of the liquid is ${numberedBelow(scale, m.first)}. Count up from it by ${scale.step}s to the top of the liquid.`,
          explanation: [
            `${tick}`,
            `The liquid ends on a mark. Counting by ${scale.step}s from the numbered mark below it reaches ${m.first}.`,
            `The thermometer shows ${m.first} degrees ${scale.name}.`,
          ],
          label: `Answer (degrees ${scale.name})`,
        })
      : numberSurface({
          prompt:
            m.ask === "warmer"
              ? `Two thermometers show the temperature in the morning and in the afternoon. How many degrees ${scale.name} warmer was the afternoon than the morning?`
              : `Two thermometers show the temperature at noon and at night. How many degrees ${scale.name} colder was the night than noon?`,
          answer: String(hi - lo),
          hint: `${tick} Read the top of the liquid in each thermometer first, counting up by ${scale.step}s from the numbered marks ${numberedBelow(scale, lo)} and ${numberedBelow(scale, hi)}. Then find how far apart the two readings are.`,
          explanation: [
            `${tick} The warmer reading is ${hi} and the cooler reading is ${lo}.`,
            `The difference is $${hi}-${lo}=${hi - lo}$.`,
            `It was ${hi - lo} degrees ${scale.name} ${m.ask === "warmer" ? "warmer in the afternoon" : "colder at night"}.`,
          ],
          label: `Answer (degrees ${scale.name})`,
        });
  return { ...surface, figure: thermometerFigure(m) };
}

export const thermometerReadingTemplates = [
  thermometerReadingTemplate,
] as const;
export const thermometerReadingGenerate = dispatch(
  thermometerReadingTemplates,
  {
    "read-thermometer": (seed) =>
      thermometerReadingFamily.generate(seed).problem,
  },
);
