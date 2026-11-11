import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { random, shuffle } from "./distribution-practice";
import {
  makeCloud,
  scatterContexts,
  yAmount,
  type Cloud,
} from "./distribution-shape-fit-practice";
import {
  acceptsTrendLine,
  gradeTrendLine,
  throughTrendPoints,
  trendLineScene,
  type TrendLineFitResponse,
  type TrendLine,
} from "./trend-line-fit";

export const trendLineFitTemplates: readonly TemplateMetadata[] = [
  {
    id: "trend-line-fit",
    version: 1,
    title: "Fit a trend line to a scatter plot",
    skillId: "scatterplots",
    gradeBand: "6–8",
    description:
      "Move two handles to fit a straight line through a cloud of data. Judge the fit by vertical closeness, then compare with one good fit.",
    requiredResponseCapability: "trend-line-fit-v1",
  },
  {
    id: "trend-line-compare",
    version: 1,
    title: "Compare two fitted lines",
    skillId: "scatterplots",
    gradeBand: "6–8",
    description:
      "Choose which of two lines stays closer to the same data all along the cloud.",
    requiredResponseCapability: "figure-choice-v1",
    requiredFigureCapability: "scenes-v1",
  },
  {
    id: "trend-line-read",
    version: 1,
    title: "Read an estimate from a fitted line",
    skillId: "scatterplots",
    gradeBand: "6–8",
    description:
      "Use a fitted line to estimate a value within the data's range. Distinguish the model's estimate from an individual observation.",
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
  },
];
const short = (v: number) => String(Math.round(v * 10) / 10);
function surface(c: Cloud): TrendLineFitResponse {
  return {
    kind: "trend-line-fit",
    label: "Fit a line through the middle of the data",
    guessChance: 0.05,
    data: c.points,
    grid: {
      xMin: c.ctx.xAxis[0],
      xMax: c.ctx.xAxis[1],
      yMin: c.yAxis[0],
      yMax: c.yAxis[1],
      xStep: c.ctx.xStep,
      yStep: 1,
      yTick: c.ctx.yStep,
      xLabel: c.ctx.id === "study" ? "Study time in hours" : c.ctx.xName,
      yLabel: c.ctx.id === "study" ? "Test score in points" : c.ctx.yName,
    },
  };
}
/** Reuse the shipped contexts and rejection-sampled clouds without changing
 * those immutable families. Four positive contexts and two negative contexts
 * are sampled by sign first: 55% rising, 45% falling. */
export function generateTrendLineFit(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = trendLineFitTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown trend-line template: ${templateId}`);
  const r = random(templateId, seed);
  const sign = r(1, 100) <= 55 ? 1 : -1;
  const contexts = scatterContexts.filter((c) => c.sign === sign);
  const ctx = contexts[r(0, contexts.length - 1)]!;
  let c: Cloud | undefined;
  for (let attempt = 0; attempt < 2000; attempt++) {
    try {
      const candidate = makeCloud(r, ctx, "linear");
      if (
        gradeTrendLine(surface(candidate), JSON.stringify(candidate.through))
      ) {
        c = candidate;
        break;
      }
    } catch {
      /* Rejection sampling consumes this seed's RNG, never a new RNG. */
    }
  }
  if (!c) throw new Error("Could not generate a reachable scatter fit");
  const response = surface(c);
  const line = throughTrendPoints(c.through);
  const common = {
    id: createHash("sha256")
      .update(JSON.stringify([meta.id, meta.version, seed]))
      .digest("hex"),
    templateId,
    templateVersion: meta.version,
    seed,
    skillId: meta.skillId,
  };
  const residuals = c.points.map(([x, y]) => y - line.m * x - line.b);
  const above = residuals.filter((d) => d > 1e-9).length;
  const below = residuals.filter((d) => d < -1e-9).length;
  const explanation = [
    `Each dot represents one of ${c.n} ${ctx.members}. Read ${response.grid.xLabel.toLowerCase().replace("°f", "°F").replace("°c", "°C")} across and ${response.grid.yLabel.toLowerCase().replace("°f", "°F").replace("°c", "°C")} up.`,
    `The dots ${sign > 0 ? "rise" : "fall"} from left to right, so a fitting line should ${sign > 0 ? "rise" : "fall"} too.`,
    `Place the line through the middle and follow the tilt at both ends. The shown good line has ${above} dots above and ${below} below.`,
    `A vertical distance is the gap straight up or down from a dot to the line at the same horizontal position. The largest gap here is about ${yAmount(short(Math.max(...residuals.map(Math.abs))), ctx.yUnit)}.`,
    "Other nearby lines also fit well. A trend line models the whole cloud; it does not need to pass through particular dots.",
  ];
  const hint = `Look at all ${c.n} dots from left to right. Put your line through their middle and follow their direction at both ends.`;
  const variant = {
    id: sign > 0 ? "fit-positive" : "fit-negative",
    axes: { context: ctx.id },
  };
  const walkthrough = trendLineScene(response, { line, distances: true });
  if (templateId === "trend-line-fit")
    return {
      public: {
        ...common,
        prompt: `Fit a straight line to all ${c.n} dots. Each dot represents one ${({ study: "student", lemonade: "day of lemonade sales", car: "used car", "arm-span": "student", tv: "student", plant: "bean plant" } as Record<string, string>)[ctx.id]}.`,
        response,
      },
      answer: JSON.stringify(c.through),
      explanation,
      hint,
      variant,
      walkthrough,
    };
  if (templateId === "trend-line-compare") {
    let tag = [
      "shift-up",
      "shift-down",
      "too-steep",
      "too-flat",
      "connect-dots",
    ][r(0, 4)]!;
    let bad: TrendLine;
    if (tag.startsWith("shift"))
      bad = {
        m: line.m,
        b:
          line.b +
          (tag === "shift-up" ? 1 : -1) *
            Math.max(...residuals.map(Math.abs)) *
            1.4,
      };
    else if (tag === "connect-dots") {
      const candidates = c.points
        .flatMap((p, i) =>
          c!.points
            .slice(i + 1)
            .filter((q) => q[0] !== p[0])
            .map((q) => throughTrendPoints([p, q])),
        )
        .filter((l) => !acceptsTrendLine(c!.points, l) && l.m * line.m > 0);
      bad = candidates[r(0, candidates.length - 1)] ?? {
        m: line.m * 2,
        b: c.center[1] - line.m * 2 * c.center[0],
      };
    } else {
      const m = line.m * (tag === "too-steep" ? 2 : 0.4);
      bad = { m, b: c.center[1] - m * c.center[0] };
    }
    // Keep a visibly different comparison, including dot-connecting lines.
    const mse = (l: TrendLine) =>
      c!.points.reduce((s, [x, y]) => s + (y - l.m * x - l.b) ** 2, 0) / c!.n;
    if (mse(bad) < 2.5 * mse(line)) {
      tag = "too-steep";
      bad = { m: line.m * 2, b: c.center[1] - line.m * 2 * c.center[0] };
    }
    const lines = shuffle(r, [line, bad]);
    const options = lines.map((l, i) => ({
      id: `option-${"ab"[i]}`,
      label: `${response.grid.xLabel}; ${response.grid.yLabel}. Dots: ${c!.points.map((p) => `(${p.join(",")})`).join(" ")}. Line through (${c!.through[0][0]},${short(l.m * c!.through[0][0] + l.b)}) and (${c!.through[1][0]},${short(l.m * c!.through[1][0] + l.b)}).`,
      scene: trendLineScene(response, { line: l, card: true }),
    }));
    const answer = options[lines.indexOf(line)]!.id;
    return {
      public: {
        ...common,
        prompt: `Both graphs show the same ${c.n} ${ctx.members}. Which line fits the data better?`,
        response: {
          kind: "figure-choice",
          label: "Compare the closeness of the dots to each line",
          noun: "Graph",
          options,
        },
      },
      answer,
      hint: `Compare the gaps from all ${c.n} dots to each line, including dots near both ends.`,
      explanation: [
        `Graph ${"AB"[lines.indexOf(line)]} keeps the dots closer along the whole cloud.`,
        ...explanation,
      ],
      choiceFeedback: {
        [options[lines.indexOf(bad)]!.id]:
          "This line leaves larger vertical gaps. A line can touch two dots or cross the middle and still miss the overall pattern.",
      },
      variant: { id: tag, axes: { context: ctx.id } },
      walkthrough,
    };
  }
  const xs = [...new Set(c.points.map(([x]) => x))];
  const x = xs[r(2, xs.length - 3)]!;
  const y = Math.round(line.m * x + line.b);
  const values = shuffle(r, [
    y,
    y + ctx.yStep,
    y - ctx.yStep,
    y + 2 * ctx.yStep,
  ]);
  const options = values.map((v, i) => ({
    id: `option-${"abcd"[i]}`,
    label: `${v} ${ctx.yUnit}`,
  }));
  return {
    public: {
      ...common,
      prompt: `For these ${c.n} ${ctx.members}, what does the fitted line predict at ${ctx.xAt(x)}? Choose the nearest whole ${ctx.yUnit === "hours" ? "hour" : "value"}.`,
      response: {
        kind: "choice",
        label: "Read the estimate on the line",
        options,
      },
      figure: { kind: "scene", scene: trendLineScene(response, { line }) },
    },
    answer: options[values.indexOf(y)]!.id,
    explanation: [
      `Start at ${ctx.xAt(x)} on the horizontal axis. Move vertically to the fitted line, then across to the vertical axis.`,
      `The line gives about ${y} ${ctx.yUnit}. This estimates the overall pattern; an individual dot may be above or below it.`,
    ],
    hint: `Find ${ctx.xAt(x)} on the horizontal axis. Move straight up to the line before reading the vertical value.`,
    variant: { id: "read-within-data", axes: { context: ctx.id } },
    walkthrough,
  };
}
