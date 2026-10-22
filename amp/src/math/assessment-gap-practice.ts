import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  rational,
  shown,
  type Draft,
} from "./distribution-practice";
import { circleDiagram, scene } from "./scene/author";

export const assessmentGapTemplates: readonly TemplateMetadata[] = [
  {
    id: "measurement-error-bound",
    title: "Bounds from measurement error",
    skillId: "units-and-precision",
    description:
      "Find an inclusive lower or upper bound from an explicitly stated absolute or relative measurement error.",
  },
  {
    id: "margin-of-error-interval",
    title: "Interpret a margin of error",
    skillId: "statistical-inference",
    description:
      "Select the interval centered on a sample estimate with the stated margin of error; distinguish percentage points from a relative percentage.",
    requiredResponseCapability: "single-choice-v1" as const,
  },
  {
    id: "radian-arc-ratio",
    title: "Radians from an arc",
    skillId: "radians-unit-circle",
    description:
      "Find an angle in radians by comparing a counterclockwise arc length with its positive radius.",
    requiredFigureCapability: "scenes-v1" as const,
  },
].map((t) => ({ ...t, version: 1, gradeBand: "9–12" }));

export function generateAssessmentGapProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  const meta = assessmentGapTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown assessment-gap template");
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  let draft: Draft;
  if (id === "measurement-error-bound") {
    const relative = r(0, 1) === 1,
      upper = r(0, 1) === 1;
    const reading = relative ? 20 * r(5, 40) : r(100, 8000) / 100;
    const rate = [1, 2, 5, 10][r(0, 3)]!;
    const errorHundredths = relative
      ? reading * rate
      : r(1, Math.min(75, Math.floor(reading * 50)));
    const answerHundredths =
      Math.round(reading * 100) + (upper ? errorHundredths : -errorHundredths);
    const R = String(reading),
      E = shown(errorHundredths, 100);
    const errorText = relative ? `${rate}% of the reported mass` : `${E} g`;
    draft = {
      prompt: `An instrument reports a mass of ${R} g. The actual mass differs from the reported mass by at most ${errorText}. What is the ${upper ? "greatest" : "smallest"} possible actual mass, in grams?`,
      answer: rational(answerHundredths, 100),
      fraction: true,
      hint: relative
        ? `The error limit is ${rate}% of the reported ${R} g. Find that amount first, then use it to bound the actual mass.`
        : `Start at the reported ${R} g. The actual mass may lie up to ${E} g on either side; which direction gives the ${upper ? "greatest" : "smallest"} value?`,
      explanation: [
        relative
          ? `Convert the error limit to grams: ${R} × ${rate}/100 = ${E} g.`
          : `The error limit is ${E} g, measured in the same unit as the reported mass.`,
        `The actual mass lies from ${R} − ${E} = ${shown(Math.round(reading * 100) - errorHundredths, 100)} g to ${R} + ${E} = ${shown(Math.round(reading * 100) + errorHundredths, 100)} g.`,
        `“At most” includes the endpoints. The ${upper ? "greatest" : "smallest"} possible mass is ${shown(answerHundredths, 100)} g.`,
      ],
    };
  } else if (id === "margin-of-error-interval") {
    const percentage = r(0, 1) === 1;
    const estimate = percentage ? r(20, 80) : r(30, 150);
    const margin = r(1, 8),
      sampleSize = 20 * r(20, 80);
    const context = percentage
      ? "the percentage of residents supporting a proposed park"
      : "the mean daily water use per household in liters";
    const unit = percentage ? "%" : " liters";
    const marginUnit = `${percentage ? "percentage point" : "liter"}${margin === 1 ? "" : "s"}`;
    const endpoints = (lo: number, hi: number) =>
      `From ${lo}${unit} to ${hi}${unit}.`;
    const lo = estimate - margin,
      hi = estimate + margin;
    draft = {
      prompt: `A random sample of ${sampleSize} ${percentage ? "residents" : "households"} estimates ${context} as ${estimate}${unit}. A 95% confidence interval uses a margin of error of ${margin} ${marginUnit}. Which interval is produced by this estimate and margin of error?`,
      answer: "",
      hint: `Use ${estimate}${unit} as the center. The margin of error, ${margin} ${marginUnit}, is the distance to each endpoint, not the full width.`,
      choices: [
        { label: endpoints(lo, hi), correct: true },
        {
          label: endpoints(estimate - margin / 2, estimate + margin / 2),
          feedback: `This makes the full width ${margin}; the margin of error is the distance on each side of the estimate.`,
        },
        {
          label: endpoints(estimate, estimate + 2 * margin),
          feedback:
            "The interval must be centered on the estimate, not start there.",
        },
        {
          label: endpoints(estimate - 2 * margin, estimate),
          feedback: "The estimate is the center, not the upper endpoint.",
        },
      ],
      explanation: [
        `Subtract the margin from the estimate: ${estimate} − ${margin} = ${lo}.`,
        `Add the same margin to the estimate: ${estimate} + ${margin} = ${hi}.`,
        `The interval runs from ${lo}${unit} to ${hi}${unit}. It estimates a population ${percentage ? "percentage" : "mean"}, not the values of individual ${percentage ? "residents" : "households"}.`,
        "The 95% confidence level describes how often this interval-producing method covers the population value over repeated random samples, under its assumptions. It is not a guarantee for this particular interval.",
      ],
    };
  } else {
    const radius = r(2, 20),
      arc = r(Math.ceil(radius / 2), 5 * radius);
    const angle = ((arc / radius) * 180) / Math.PI;
    const figure = scene(
      circleDiagram({
        points: [
          { name: "A", at: 0 },
          { name: "B", at: angle },
        ],
        center: true,
        segments: [
          { from: "O", to: "A", label: `${radius} cm` },
          { from: "O", to: "B" },
        ],
        arcs: [{ from: "A", to: "B", label: `${arc} cm` }],
      }),
    ).build({
      title: "Radius and counterclockwise arc",
      note: `The counterclockwise arc from A to B is ${arc} cm on a circle of radius ${radius} cm; the angle follows that arc.`,
      width: 360,
      maxHeight: 260,
    });
    draft = {
      prompt: `A circle has radius ${radius} cm. Starting at $A$, a counterclockwise arc to $B$ has length ${arc} cm and makes less than one full turn. What is the angle swept out at the center, in radians? Enter an exact fraction if needed.`,
      figure: { kind: "scene", scene: figure },
      answer: rational(arc, radius),
      fraction: true,
      hint: `Compare the ${arc} cm arc with the ${radius} cm radius. How many radius-lengths fit along that arc?`,
      explanation: [
        "One radian is the angle subtending an arc whose length equals the radius.",
        `Divide the arc length by the radius: $\\theta = ${arc}/${radius} = ${rational(arc, radius)}$ radians.`,
        `Check by multiplying the angle by the radius: $${radius} \\times \\frac{${arc}}{${radius}} = ${arc}$ cm. The length units cancel in the ratio.`,
        "The chosen counterclockwise arc determines the swept angle, including arcs larger than a semicircle.",
      ],
    };
  }
  return assemble(meta, seed, r, draft);
}
