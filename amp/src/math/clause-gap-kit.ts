import { createHash } from "node:crypto";
import {
  generatedProblemSchema,
  type GeneratedProblem,
  type PointPlotGrading,
  type ProblemResponse,
  type SemanticFigure,
} from "./contracts.js";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
  type PartOption,
} from "./multi-part-choice.js";
import { serializeSelection } from "./selection-response.js";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  type StructuredWorkResponse,
  type WorkGrading,
} from "./structured-work.js";
import { surfaceStream, type Random } from "./variation/axes.js";

export type ClauseRandom = Random;
export interface ClauseCtx {
  id: string;
  task: string;
  seed: string;
  r: ClauseRandom;
}

export const clauseRandom = (id: string, seed: string): ClauseRandom =>
  surfaceStream(id, seed);

export function shuffle<T>(r: ClauseRandom, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
export const pick = <T>(r: ClauseRandom, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;

export function problem(args: {
  id: string;
  seed: string;
  task: string;
  skillId: string;
  prompt: string;
  response: ProblemResponse;
  answer: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  choiceFeedback?: Record<string, string>;
  workGrading?: WorkGrading;
  pointGrading?: PointPlotGrading;
}): GeneratedProblem {
  const built: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([args.id, 2, args.seed, args.task]))
        .digest("hex"),
      templateId: args.id,
      templateVersion: 1,
      seed: args.seed,
      skillId: args.skillId,
      prompt: args.prompt,
      response: args.response,
      ...(args.figure ? { figure: args.figure } : {}),
    },
    answer: args.answer,
    hint: args.hint,
    explanation: args.explanation,
    ...(args.choiceFeedback ? { choiceFeedback: args.choiceFeedback } : {}),
    ...(args.workGrading ? { workGrading: args.workGrading } : {}),
    ...(args.pointGrading ? { pointGrading: args.pointGrading } : {}),
    variant: { id: args.task, axes: { clause: args.task } },
  };
  return generatedProblemSchema.parse(built);
}

export interface ChoiceSpec {
  label: string;
  correct?: boolean;
  feedback?: string;
}

/** Four or fewer choices. Ids follow the shuffled order. */
export function singleChoice(
  r: ClauseRandom,
  specs: readonly ChoiceSpec[],
  label = "Choose the answer",
): {
  response: Extract<ProblemResponse, { kind: "choice" }>;
  answer: string;
  choiceFeedback: Record<string, string>;
} {
  if (specs.length < 2 || specs.length > 4)
    throw new Error("A choice needs 2 to 4 options");
  if (specs.filter((s) => s.correct).length !== 1)
    throw new Error("A choice needs one correct option");
  if (new Set(specs.map((s) => s.label)).size !== specs.length)
    throw new Error("Choice labels must be distinct");
  const order = shuffle(r, specs);
  const options = order.map((s, i) => ({
    id: `option-${"abcd"[i]!}`,
    label: s.label,
  }));
  const answer = options[order.findIndex((s) => s.correct)]!.id;
  const choiceFeedback: Record<string, string> = {};
  order.forEach((s, i) => {
    if (!s.correct && s.feedback) choiceFeedback[options[i]!.id] = s.feedback;
  });
  return {
    response: { kind: "choice", label, options },
    answer,
    choiceFeedback,
  };
}

export interface SelectSpec {
  label: string;
  correct?: boolean;
}

/** Select-all. At least two correct, and at least one wrong. */
export function multiSelect(
  r: ClauseRandom,
  specs: readonly SelectSpec[],
  label: string,
): {
  response: Extract<ProblemResponse, { kind: "multi-select" }>;
  answer: string;
} {
  const correct = specs.filter((s) => s.correct).length;
  if (specs.length < 3 || specs.length > 8 || correct < 2 || correct >= specs.length)
    throw new Error("Select-all needs 3 to 8 options and a proper subset correct");
  if (new Set(specs.map((s) => s.label)).size !== specs.length)
    throw new Error("Select labels must be distinct");
  const order = shuffle(r, specs);
  const options = order.map((s, i) => ({
    id: `option-${"abcdefgh"[i]!}`,
    label: s.label,
  }));
  const ids = options.filter((_, i) => order[i]!.correct).map((o) => o.id);
  return {
    response: {
      kind: "multi-select",
      label,
      options,
      selectionCount: correct,
    },
    answer: serializeSelection(ids),
  };
}

export interface SlotSpec {
  id: string;
  /** Shown beside the slot. */
  label: string;
  options: readonly string[];
  correct: string;
}

/** One slot per step. Each slot has its own options (labels may repeat
 * across slots). The layout is slots, which is multi-part-choice-v1. */
export function slots(
  r: ClauseRandom,
  steps: readonly SlotSpec[],
  label: string,
): { response: MultiPartChoiceResponse; answer: string } {
  if (steps.length < 2 || steps.length > 6)
    throw new Error("A multi-part item needs 2 to 6 slots");
  const blanks = steps.map((step) => {
    const labels = [...new Set(step.options)];
    if (!labels.includes(step.correct))
      throw new Error(`Slot ${step.id} is missing its answer`);
    if (labels.length < 2 || labels.length > 6)
      throw new Error(`Slot ${step.id} needs 2 to 6 options`);
    const options: PartOption[] = shuffle(r, labels).map((text, i) => ({
      id: "abcdef"[i]!,
      label: text,
    }));
    return {
      id: step.id,
      label: step.label,
      options,
      correctId: options.find((o) => o.label === step.correct)!.id,
    };
  });
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label,
    layout: "slots",
    blanks: blanks.map(({ id, label: blankLabel, options }) => ({
      id,
      label: blankLabel,
      options,
    })),
  };
  const key = Object.fromEntries(blanks.map((b) => [b.id, b.correctId]));
  return { response, answer: serializeMultiPart(response, key) };
}

export interface WorkRowSpec {
  label: string;
  /** One or two learner number fields. */
  values: readonly string[];
  fieldLabels?: readonly string[];
}

export function numberStack(
  rows: readonly WorkRowSpec[],
  label: string,
): {
  response: StructuredWorkResponse;
  workGrading: WorkGrading;
  answer: string;
} {
  if (rows.length < 1 || rows.length > 6) throw new Error("Stack rows");
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label,
    layout: "steps",
    mode: "build",
    banks: [],
    rows: rows.map((row, i) => ({
      id: `r${i + 1}`,
      label: row.label,
      fields: row.values.map((_, j) => ({
        kind: "number" as const,
        label: row.fieldLabels?.[j] ?? (j === 0 ? "Digit" : "Carry"),
      })),
    })),
  };
  const workGrading: WorkGrading = {
    mode: "fields",
    fields: rows.map((row) =>
      row.values.map((value) => ({ kind: "number" as const, value })),
    ),
  };
  const answer = JSON.stringify(rows.map((row) => [...row.values]));
  if (!gradingFits(response, workGrading)) throw new Error("Stack rule");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error("Stack key");
  if (!gradeStructuredWork(response, workGrading, answer))
    throw new Error("Stack grade");
  return { response, workGrading, answer };
}

/** Two number-bond rows. The stored key is one accepted pair of splits;
 * grading accepts every other valid pair too. */
export function bondPairs(
  whole: number,
  first: readonly [number, number],
  second: readonly [number, number],
): {
  response: StructuredWorkResponse;
  workGrading: WorkGrading;
  answer: string;
} {
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label: "Write two different splits",
    layout: "steps",
    mode: "build",
    banks: [],
    rows: [
      {
        id: "r1",
        label: `First way to split ${whole}`,
        fields: [
          { kind: "number", label: "First part" },
          { kind: "number", label: "Second part" },
        ],
      },
      {
        id: "r2",
        label: `A different way to split ${whole}`,
        fields: [
          { kind: "number", label: "First part" },
          { kind: "number", label: "Second part" },
        ],
      },
    ],
  };
  const workGrading: WorkGrading = { mode: "bond-pairs", whole };
  const answer = JSON.stringify([
    [String(first[0]), String(first[1])],
    [String(second[0]), String(second[1])],
  ]);
  if (!gradingFits(response, workGrading) || !gradeStructuredWork(response, workGrading, answer))
    throw new Error("Bond pairs key");
  return { response, workGrading, answer };
}
