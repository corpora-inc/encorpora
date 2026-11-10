import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import { multiPartProblem, type Slot } from "./multi-part-support";
import type { WorkBank, WorkField, FieldRule } from "./structured-work";

export { random, shuffle };
export type { Random, Slot };
export type Context = {
  meta: TemplateMetadata;
  seed: string;
  family: string;
  r: Random;
};
export type Teaching = {
  prompt: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
};

export function problem(
  c: Context,
  t: Teaching,
  answer: string | number,
): GeneratedProblem {
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([c.meta.id, c.meta.version, c.seed]))
        .digest("hex"),
      templateId: c.meta.id,
      templateVersion: 1,
      seed: c.seed,
      skillId: c.meta.skillId,
      prompt: t.prompt,
      response: { kind: "number", label: "Answer" },
      ...(t.figure ? { figure: t.figure } : {}),
    },
    answer: String(answer),
    hint: t.hint,
    explanation: t.explanation,
    variant: { id: c.family, axes: { clause: c.family.slice(0, 31) } },
  };
}

export function choice(
  c: Context,
  t: Teaching,
  correct: string,
  wrong: string[],
): GeneratedProblem {
  const labels = shuffle(c.r, [...new Set([correct, ...wrong])]);
  if (labels.length < 3)
    throw new Error(`${c.family}: too few distinct choices`);
  const p = problem(c, t, "");
  const options = labels.map((label, i) => ({
    id: `option-${"abcdef"[i]}`,
    label,
  }));
  p.public.response = { kind: "choice", label: "Choose one answer", options };
  p.answer = options.find((o) => o.label === correct)!.id;
  p.choiceFeedback = Object.fromEntries(
    options
      .filter((o) => o.id !== p.answer)
      .map((o) => [o.id, t.explanation.join(" ")]),
  );
  return p;
}

export function parts(
  c: Context,
  t: Teaching,
  slots: Slot[],
): GeneratedProblem {
  const p = multiPartProblem(c.meta, c.seed, c.r, {
    ...t,
    layout: "slots",
    label: "Complete each part",
    slots,
  });
  return {
    ...p,
    variant: { id: c.family, axes: { clause: c.family.slice(0, 31) } },
  };
}

export const numericSlot = (
  id: string,
  label: string,
  value: number | string,
  wrong: (number | string)[],
): Slot => ({ id, label, correct: String(value), wrong: wrong.map(String) });

export type Row = {
  label: string;
  fields: { field: WorkField; value: string; rule?: FieldRule }[];
};
export const numericField = (label: string, value: number | string) => ({
  field: { kind: "number", label } as WorkField,
  value: String(value),
});
export function work(
  c: Context,
  t: Teaching,
  rows: Row[],
  banks: WorkBank[] = [],
  layout: "steps" | "proof" = "steps",
): GeneratedProblem {
  const p = problem(c, t, "");
  p.public.response = {
    kind: "structured-work",
    label: "Complete each step",
    layout,
    mode: rows.some((row) =>
      row.fields.some((f) => f.field.given !== undefined),
    )
      ? "fill"
      : "build",
    banks,
    rows: rows.map((row, i) => ({
      id: `r${i + 1}`,
      label: row.label,
      fields: row.fields.map((f) => f.field),
    })),
  };
  p.answer = JSON.stringify(
    rows.map((row) =>
      row.fields.map((f) => (f.field.given !== undefined ? "" : f.value)),
    ),
  );
  p.workGrading = {
    mode: "fields",
    fields: rows.map((row) =>
      row.fields.map((f) =>
        f.field.given !== undefined
          ? null
          : (f.rule ??
            (f.field.kind === "choice"
              ? { kind: "choice", accept: [f.value] }
              : { kind: "number", value: f.value })),
      ),
    ),
  };
  return p;
}

export const pick = <T>(r: Random, values: readonly T[]): T =>
  values[r(0, values.length - 1)]!;
export const dec = (n: number, places = 2): string =>
  (n / 10 ** places).toFixed(places).replace(/\.?0+$/, "") || "0";
export const symbol = (a: number, b: number) =>
  a < b ? "<" : a > b ? ">" : "=";
export const blockFigure = (n: number): SemanticFigure => ({
  kind: "base-ten",
  hundreds: Math.floor(n / 100),
  tens: Math.floor(n / 10) % 10,
  ones: n % 10,
});
