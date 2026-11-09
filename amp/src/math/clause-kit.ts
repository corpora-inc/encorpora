import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  PointPlotResponse,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle } from "./distribution-practice";
import { chooseAxes, defineAxis, type Random } from "./variation/axes";
import type { Surface } from "./variation/compose";
import type { Element, Fn, Point, Scene } from "./scene/spec";
import { graph } from "./scene/author";
import { normalizePointPlot } from "./point-plot";

export type ClauseSurface = Surface & {
  pointGrading?: GeneratedProblem["pointGrading"];
};
export type ClauseBuilder = (r: Random, variant: string) => ClauseSurface;
export interface ClauseExtension {
  variants: readonly string[];
  build: ClauseBuilder;
  capability: TemplateMetadata["requiredResponseCapability"];
}
export const math = (s: string | number) => `$${s}$`;
export const pick = <T>(r: Random, xs: readonly T[]): T =>
  xs[r(0, xs.length - 1)]!;
export const round = (n: number) => Math.round(n * 1e8) / 1e8;
export const scene = (elements: Element[], title?: string): Scene => ({
  v: 1,
  width: 360,
  maxHeight: 300,
  ...(title ? { title } : {}),
  elements,
});
export const picture = (s: Scene): SemanticFigure => ({
  kind: "scene",
  scene: s,
});
export const curveScene = (
  fn: Fn,
  x: [number, number] = [-6, 6],
  y: [number, number] = [-8, 8],
) =>
  graph({
    x,
    y,
    grid: [1, Math.max(1, Math.ceil((y[1] - y[0]) / 40))],
    tick: [2, Math.max(2, Math.ceil((y[1] - y[0]) / 8))],
  })
    .curve(fn, { features: ["asymptotes"] })
    .scene({ width: 260, maxHeight: 260 });
export function choice(
  r: Random,
  prompt: string,
  correct: string,
  wrong: string[],
  explanation: string[],
  hint: string,
  figure?: SemanticFigure,
): ClauseSurface {
  const distinct = [...new Set(wrong)].filter((x) => x !== correct);
  if (distinct.length < 2)
    throw new Error("Clause choices need distinct distractors");
  const labels = shuffle(r, [correct, ...distinct.slice(0, 3)]);
  const options = labels.map((label, i) => ({
    id: `option-${"abcd"[i]}`,
    label,
  }));
  return {
    prompt,
    response: { kind: "choice", label: "Choose one", options },
    answer: options[labels.indexOf(correct)]!.id,
    explanation,
    hint,
    ...(figure ? { figure } : {}),
    choiceFeedback: Object.fromEntries(
      options
        .filter((o) => o.label !== correct)
        .map((o) => [
          o.id,
          `${o.label} does not justify the stated conclusion. ${explanation[0]}`,
        ]),
    ),
  };
}
/** Each slot supplies its own reason or value; ids name shuffled positions. */
export function blanks(
  r: Random,
  prompt: string,
  parts: { label: string; correct: string; wrong: string[] }[],
  explanation: string[],
  hint: string,
  figure?: SemanticFigure,
): ClauseSurface {
  const answer: Record<string, string> = {};
  const bs = parts.map((p, i) => {
    const id = `b${i + 1}`;
    const labels = shuffle(
      r,
      [p.correct, ...new Set(p.wrong.filter((w) => w !== p.correct))].slice(
        0,
        6,
      ),
    );
    const options = labels.map((label, j) => ({ id: "abcdef"[j]!, label }));
    answer[id] = options[labels.indexOf(p.correct)]!.id;
    return { id, label: p.label, options };
  });
  if (bs.length > 6) throw new Error("Split proofs with more than six blanks");
  return {
    prompt,
    response: {
      kind: "multi-part-choice",
      label: "Complete each step",
      layout: "slots",
      blanks: bs,
    },
    answer: JSON.stringify(answer),
    explanation,
    hint,
    ...(figure ? { figure } : {}),
  };
}
export function plot(
  prompt: string,
  points: Point[],
  grid: PointPlotResponse["grid"],
  explanation: string[],
  hint: string,
): ClauseSurface {
  const response: PointPlotResponse = {
    kind: "point-plot",
    label: `Place ${points.length} point${points.length === 1 ? "" : "s"}`,
    pointCount: points.length,
    ordered: false,
    connect: "none",
    grid,
  };
  const answer = normalizePointPlot(response, JSON.stringify(points));
  if (!answer)
    throw new Error(`Points outside plot grid: ${JSON.stringify(points)}`);
  return {
    prompt,
    response,
    answer,
    pointGrading: { mode: "exact" },
    explanation,
    hint,
  };
}
export function figures(
  r: Random,
  prompt: string,
  options: { label: string; scene: Scene }[],
  explanation: string[],
  hint: string,
): ClauseSurface {
  const correct = options[0]!;
  const shuffled = shuffle(r, options).map((o, i) => ({
    ...o,
    id: `option-${"abcd"[i]}`,
  }));
  return {
    prompt,
    response: {
      kind: "figure-choice",
      noun: "Graph",
      label: "Choose the graph",
      options: shuffled,
    },
    answer: shuffled.find((o) => o.scene === correct.scene)!.id,
    explanation,
    hint,
    choiceFeedback: Object.fromEntries(
      shuffled
        .filter((o) => o.scene !== correct.scene)
        .map((o) => [
          o.id,
          `${o.label} does not match the given rule. ${explanation[0]}`,
        ]),
    ),
  };
}
/** Catalog version gates preserve every old seed; legacy has half the weight. */
export function extendProblem(
  meta: TemplateMetadata,
  seed: string,
  extension: ClauseExtension,
  force?: string,
): GeneratedProblem | null {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const axis = defineAxis("clause", ["legacy", ...extension.variants], {
    legacy: "legacy",
    since: meta.version,
    silentLegacy: true,
    weights: [extension.variants.length, ...extension.variants.map(() => 1)],
    needs: Object.fromEntries(
      extension.variants.map((v) => [v, "scenes-v1" as const]),
    ),
  });
  const variant = force ?? chooseAxes(meta.id, seed, { clause: axis }).clause;
  if (variant === "legacy") return null;
  if (!extension.variants.includes(variant))
    throw new Error(`Unknown clause ${variant}`);
  const s = extension.build(
    random(`${meta.id}:clause:${variant}`, seed),
    variant,
  );
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, 1, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      skillId: meta.skillId,
      seed,
      prompt: s.prompt,
      response: s.response,
      ...(s.figure ? { figure: s.figure } : {}),
    },
    answer: s.answer,
    hint: s.hint,
    explanation: s.explanation,
    ...(s.choiceFeedback ? { choiceFeedback: s.choiceFeedback } : {}),
    ...(s.workGrading ? { workGrading: s.workGrading } : {}),
    ...(s.pointGrading ? { pointGrading: s.pointGrading } : {}),
    variant: { id: variant, axes: { clause: variant } },
  };
}
