import { shuffle } from "./distribution-practice";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuralProblem,
  type FieldRule,
  type StructuredWorkResponse,
  type WorkField,
  type WorkGrading,
} from "./structured-work";
import type { Random } from "./variation/axes";
import { workSurface } from "./structured-work-kit";

/**
 * Labeled written work whose rows hold one or two fields, which may be
 * numbers or typed expressions with powers (the shared `fieldsWork` builds
 * one field per row and no powers). Each field has its own exact rule; the
 * whole response earns credit only when every learner field is right.
 */
export interface RowField {
  /** Screen-reader name and column caption, e.g. "Coefficient". */
  caption: string;
  kind: "number" | "expression";
  /** Expected value in input syntax. */
  value: string;
  unit?: string;
  fraction?: boolean;
  /** Expression: "identity" (same expression) or "sides" (same relation). */
  match?: "identity" | "sides";
  variables?: string[];
  powers?: boolean;
  relations?: boolean;
  maxLength?: number;
}
export interface RowSpec {
  label: string;
  fields: [RowField] | [RowField, RowField];
}

const fieldOf = (f: RowField, given: boolean): WorkField =>
  f.kind === "number"
    ? {
        kind: "number",
        label: f.caption,
        ...(f.unit ? { unit: f.unit } : {}),
        ...(f.maxLength ? { maxLength: f.maxLength } : {}),
        ...(given ? { given: f.value } : {}),
      }
    : {
        kind: "expression",
        label: f.caption,
        variables: f.variables ?? [],
        ...(f.relations ? { relations: true } : {}),
        ...(f.powers ? { powers: true } : {}),
        maxLength: f.maxLength ?? 24,
        ...(given ? { given: f.value } : {}),
      };
const ruleOf = (f: RowField): FieldRule =>
  f.kind === "number"
    ? {
        kind: "number",
        value: f.value,
        ...(f.fraction ? { fraction: true } : {}),
      }
    : { kind: "expression", value: f.value, match: f.match ?? "identity" };

/** Build the response, private rule and answer key of labeled rows. In
 * fill mode one or two early rows are given whole and the last rows are
 * always the learner's. */
export function rowsWork(
  specs: RowSpec[],
  mode: "build" | "fill",
  r: Random,
  label: string,
) {
  const n = specs.length;
  const given = new Set<number>();
  if (mode === "fill") {
    const count = n >= 5 ? 2 : 1;
    const pool = shuffle(r, [...Array(Math.max(1, n - 2)).keys()]);
    for (const i of pool.slice(0, count)) given.add(i);
  }
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label,
    layout: "steps",
    mode,
    banks: [],
    rows: specs.map((s, i) => ({
      id: `r${i + 1}`,
      label: s.label,
      fields: s.fields.map((f) => fieldOf(f, given.has(i))),
    })),
  };
  const grading: WorkGrading = {
    mode: "fields",
    fields: specs.map((s, i) =>
      s.fields.map((f) => (given.has(i) ? null : ruleOf(f))),
    ),
  };
  const answer = JSON.stringify(
    specs.map((s, i) => s.fields.map((f) => (given.has(i) ? "" : f.value))),
  );
  const problem = structuralProblem(response);
  if (problem) throw new Error(problem);
  if (!gradingFits(response, grading)) throw new Error("Rule does not fit");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error(`Answer key is not canonical: ${answer}`);
  if (!gradeStructuredWork(response, grading, answer))
    throw new Error(`Answer key is not credited: ${answer}`);
  return { response, workGrading: grading, answer };
}

export { workSurface };
