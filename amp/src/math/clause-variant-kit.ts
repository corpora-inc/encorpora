import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import { fieldsWork } from "./structured-work-kit";
import { graph, lineTable } from "./scene/author";
import type { Scene } from "./scene/spec";
import { serializeMultiPart } from "./multi-part-choice";
import { chooseAxes, defineAxis } from "./variation/axes";

/** Clause additions use a separate, versioned stream. Legacy draws never
 * consume the original generator's stream, preserving stored workbooks. */
export function clauseDraw(
  id: string,
  seed: string,
  variants: readonly string[],
) {
  const axis = defineAxis("clause", ["legacy", ...variants], {
    since: 2,
    silentLegacy: true,
    weights: [
      id === "triangle-law-reasoning" ? 3 : variants.length,
      ...variants.map(() => 1),
    ],
    needs: Object.fromEntries(variants.map((v) => [v, "scenes-v1" as const])),
  });
  return chooseAxes(id, seed, { clause: axis }).clause;
}
export const pick = <T>(r: Random, values: readonly T[]): T =>
  values[r(0, values.length - 1)]!;
export const sum = (values: readonly number[]) =>
  values.reduce((a, b) => a + b, 0);
export const rad = (degrees: number) => (degrees * Math.PI) / 180;
export const round = (n: number, places = 1) => Number(n.toFixed(places));
export const math = (tex: string) => `$${tex}$`;
export const matrix = (a: number[][]) =>
  math(
    `\\begin{bmatrix}${a.map((row) => row.join("&")).join("\\\\")}\\end{bmatrix}`,
  );
export const vector = (v: readonly number[]) =>
  math(`\\langle ${v.join(",")}\\rangle`);
export const transpose = (a: number[][]) =>
  a[0]!.map((_, j) => a.map((row) => row[j]!));
export const multiply = (a: number[][], b: number[][]) =>
  a.map((row) => b[0]!.map((_, j) => sum(row.map((x, k) => x * b[k]![j]!))));
export const scale = (a: number[][], c: number) =>
  a.map((row) => row.map((x) => c * x));
export const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export const table = (rows: string[][]): SemanticFigure => {
  // A line table has at most ten rows. Frequency tables wrap into blocks of
  // paired columns, preserving every bin and a heading above each block.
  if (rows.length <= 10)
    return { kind: "scene", scene: lineTable(rows, { header: "row" }).scene() };
  const body = rows.slice(1),
    blocks = Math.ceil(body.length / 9);
  const wrapped = Array.from({ length: 10 }, (_, i) =>
    Array.from({ length: blocks }, (_, j) =>
      i === 0 ? rows[0]! : (body[j * 9 + i - 1] ?? rows[0]!.map(() => "")),
    ).flat(),
  );
  return {
    kind: "scene",
    scene: lineTable(wrapped, { header: "row" }).scene(),
  };
};
export const sceneFigure = (scene: Scene): SemanticFigure => ({
  kind: "scene",
  scene,
});
export function scatter(
  points: [number, number][],
  labels: [string, string] = ["x", "y"],
  fit?: { m: number; b: number },
): SemanticFigure {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const x: [number, number] = [Math.min(0, ...xs) - 1, Math.max(...xs) + 1],
    y: [number, number] = [Math.min(0, ...ys) - 2, Math.max(...ys) + 2];
  return sceneFigure(
    graph({
      x,
      y,
      axisNames: labels,
      grid: [
        Math.max(1, Math.ceil((x[1] - x[0]) / 20)),
        Math.max(1, Math.ceil((y[1] - y[0]) / 20)),
      ],
    })
      .scatter(points, fit)
      .scene(),
  );
}
export type Copy = {
  prompt: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
};
export type Part = { label: string; correct: string; wrong: string[] };
export class ClauseBuilder {
  readonly r: Random;
  constructor(
    readonly meta: TemplateMetadata,
    readonly seed: string,
    readonly variant: string,
  ) {
    if (!seed.length || seed.length > 128)
      throw new Error("Seed must contain 1–128 characters");
    this.r = random(`${meta.id}:clauses:${variant}`, seed);
  }
  base(copy: Copy): Omit<GeneratedProblem, "answer"> {
    return {
      public: {
        id: createHash("sha256")
          .update(JSON.stringify([this.meta.id, 2, this.seed]))
          .digest("hex"),
        templateId: this.meta.id,
        templateVersion: 1,
        skillId: this.meta.skillId,
        seed: this.seed,
        prompt: copy.prompt,
        response: { kind: "number", label: "Answer" },
        ...(copy.figure ? { figure: copy.figure } : {}),
      },
      hint: copy.hint,
      explanation: copy.explanation,
      variant: { id: this.variant, axes: { clause: this.variant } },
    };
  }
  labels(correct: string, wrong: string[], minimum = 3) {
    const alternatives = [...new Set(wrong)].filter((s) => s !== correct);
    if (alternatives.length < minimum)
      throw new Error(
        `Not enough distinct alternatives: ${this.meta.id}/${this.variant}`,
      );
    return shuffle(this.r, [correct, ...alternatives.slice(0, minimum)]);
  }
  choice(copy: Copy, correct: string, wrong: string[]): GeneratedProblem {
    const labels = this.labels(correct, wrong);
    const options = labels.map((label, i) => ({
      id: `option-${"abcd"[i]}`,
      label,
    }));
    const p = this.base(copy);
    p.public.response = { kind: "choice", label: "Choose one answer", options };
    return {
      ...p,
      answer: options.find((o) => o.label === correct)!.id,
      choiceFeedback: Object.fromEntries(
        options
          .filter((o) => o.label !== correct)
          .map((o) => [o.id, copy.explanation.join(" ")]),
      ),
    };
  }
  parts(copy: Copy, parts: Part[]): GeneratedProblem {
    const p = this.base(copy);
    const blanks = parts.map((part, i) => ({
      id: `p${i + 1}`,
      label: part.label,
      options: this.labels(
        part.correct,
        part.wrong,
        Math.min(3, new Set(part.wrong.filter((w) => w !== part.correct)).size),
      ).map((label, j) => ({ id: "abcdef"[j]!, label })),
    }));
    const response = {
      kind: "multi-part-choice",
      label: "Choose an answer for each part",
      layout: "slots",
      blanks,
    } as const;
    p.public.response = response;
    return {
      ...p,
      answer: serializeMultiPart(
        response,
        Object.fromEntries(
          blanks.map((b, i) => [
            b.id,
            b.options.find((o) => o.label === parts[i]!.correct)!.id,
          ]),
        ),
      ),
    };
  }
  work(
    copy: Copy,
    fields: { label: string; value: number | string; unit?: string }[],
  ): GeneratedProblem {
    const p = this.base(copy);
    const { response, ...privateWork } = fieldsWork(
      fields.map((f) => ({
        ...f,
        value: String(f.value),
        kind: "number" as const,
      })),
      "build",
      this.r,
      "Complete each value",
    );
    p.public.response = response;
    return { ...p, ...privateWork };
  }
  plot(
    copy: Copy,
    points: [number, number][],
    grid: {
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
      xLabel: string;
      yLabel: string;
    },
    given?: { x: number; y: number; label: string }[],
  ): GeneratedProblem {
    const p = this.base(copy);
    p.public.response = {
      kind: "point-plot",
      label: `Plot ${points.length === 1 ? "the point" : `the ${points.length} points`}`,
      grid: { ...grid, step: 1 },
      pointCount: points.length,
      ordered: false,
      connect: "none",
      ...(given ? { given: { vertices: given, closed: false } } : {}),
    };
    return {
      ...p,
      pointGrading: { mode: "exact" },
      answer: JSON.stringify(
        [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      ),
    };
  }
  figures(
    copy: Copy,
    candidates: { label: string; scene: Scene }[],
  ): GeneratedProblem {
    const p = this.base(copy),
      correct = candidates[0]!;
    const options = shuffle(this.r, candidates).map((o, i) => ({
      ...o,
      id: `option-${"abcd"[i]}`,
      scene: { ...o.scene, width: 280, maxHeight: 280 },
    }));
    p.public.response = {
      kind: "figure-choice",
      noun: "Graph",
      label: "Choose the graph",
      options,
    };
    return { ...p, answer: options.find((o) => o.label === correct.label)!.id };
  }
  select(copy: Copy, correct: string[], wrong: string[]): GeneratedProblem {
    const p = this.base(copy);
    const options = shuffle(this.r, [...correct, ...wrong]).map((label, i) => ({
      id: `option-${"abcdefgh"[i]}`,
      label,
    }));
    p.public.response = {
      kind: "multi-select",
      label: "Select all the patterns shown",
      options,
      selectionCount: correct.length,
    };
    return {
      ...p,
      answer: JSON.stringify(
        options
          .filter((o) => correct.includes(o.label))
          .map((o) => o.id)
          .sort(),
      ),
    };
  }
}
