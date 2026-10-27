import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  TemplateMetadata,
} from "../contracts";
import { random } from "../distribution-practice";
import {
  axisRecord,
  chooseAxes,
  surfaceStream,
  validateAxes,
  type AxisSet,
  type AxisValues,
  type Random,
} from "./axes";
import { resultFirstFlags, type Orientation } from "./orientation";
import {
  drawStatements,
  formatCapability,
  formatShape,
  orientStatements,
  quotesTrueStatement,
  renderStatementSet,
  type Statement,
  type StatementFormat,
  type StatementSetCopy,
} from "./statement-set";

/** Everything a family renders from its model for one instance. */
export interface Surface {
  prompt: string;
  response: ProblemResponse;
  answer: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  choiceFeedback?: Record<string, string>;
}

/**
 * A family with ONE exact model and the surface axes it supports.
 * `model` draws givens from the content stream (the same stream the family
 * used before axes existed). `render` writes one surface of that model; it may
 * continue drawing from the content stream (option order) and from `surface`
 * (per-item surface choices such as which equations are written result-first).
 */
export interface VariedFamily<A extends AxisSet, M> {
  template: TemplateMetadata;
  axes: A;
  model: (r: Random, axes: AxisValues<A>) => M;
  render: (
    model: M,
    axes: AxisValues<A>,
    r: Random,
    surface: Random,
  ) => Surface | null;
  /** The family's own variant label for a model (existing variant metadata). */
  variant: (model: M) => string;
}

/** Check a family's axes against its template once, at module load. */
export function defineVariedFamily<A extends AxisSet, M>(
  family: VariedFamily<A, M>,
): VariedFamily<A, M> {
  validateAxes(family.axes);
  const format = family.axes["answer-format"];
  if (format)
    for (const value of format.values) {
      const needs = formatCapability[value as StatementFormat];
      if (!needs || needs !== family.template.requiredResponseCapability)
        throw new Error(
          `${family.template.id}: format ${value} needs ${needs}, template declares ${family.template.requiredResponseCapability ?? "numeric"}`,
        );
    }
  return family;
}

export interface VariedCase<A extends AxisSet, M> {
  axes: AxisValues<A>;
  model: M;
  surface: Surface;
  problem: GeneratedProblem;
}

const retry = (error: unknown) =>
  error instanceof Error && error.message.startsWith("Need three");

/**
 * Generate one instance: axis values from their own streams, then the model
 * and its surface, redrawing on "Need three retry" or a rejected surface.
 * `force` pins axis values (tests, lesson examples); production omits it.
 */
export function generateVaried<A extends AxisSet, M>(
  family: VariedFamily<A, M>,
  seed: string,
  force: Partial<AxisValues<A>> = {},
): VariedCase<A, M> {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const template = family.template;
  const axes = { ...chooseAxes(template.id, seed, family.axes), ...force };
  for (const [key, value] of Object.entries(force))
    if (!family.axes[key]?.values.includes(value as string))
      throw new Error(`${template.id}: no axis value ${key}=${value}`);
  const r = random(template.id, seed);
  const surface = surfaceStream(template.id, seed);
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const model = family.model(r, axes);
      const s = family.render(model, axes, r, surface);
      if (!s) continue;
      const problem: GeneratedProblem = {
        public: {
          id: createHash("sha256")
            .update(JSON.stringify([template.id, 1, seed]))
            .digest("hex"),
          templateId: template.id,
          templateVersion: 1,
          seed,
          skillId: template.skillId,
          prompt: s.prompt,
          response: s.response,
          ...(s.figure ? { figure: s.figure } : {}),
        },
        answer: s.answer,
        hint: s.hint,
        explanation: s.explanation,
        ...(s.choiceFeedback ? { choiceFeedback: s.choiceFeedback } : {}),
        variant: { id: family.variant(model), axes: axisRecord(axes) },
      };
      return { axes, model, surface: s, problem };
    } catch (error) {
      if (retry(error)) continue;
      throw error;
    }
  }
  throw new Error("Could not generate a valid problem");
}

/* ------------------------------------------------ statement-set families */

/** The model of a statement-set family: a pool of statements whose truth is
 * computed, how many to show and how many are true in its select-all form. */
export interface StatementModel {
  variant: string;
  pool: Statement[];
  total: number;
  k: number;
  ordered?: boolean;
  copy: (shape: { total: number; k: number }) => StatementSetCopy;
  /** A fixed hint, or one written from the statements actually shown (it
   * must name the instance's own numbers). */
  hint: string | ((shown: readonly Statement[]) => string);
  lead?: string[];
  tail?: string[];
  figure?: SemanticFigure;
  /** Private model data for tests and oracles. */
  model?: unknown;
}
export type StatementAxes = {
  "answer-format"?: StatementFormat;
  orientation?: Orientation;
};
export interface StatementSurface extends Surface {
  /** The drawn statements in display order, after orientation. */
  statements: Statement[];
}

/** Draw, orient and format a statement model. Null when the prompt or hint
 * would quote a true statement. */
export function statementSurface(
  m: StatementModel,
  axes: StatementAxes,
  r: Random,
  surface: Random,
): StatementSurface | null {
  const format = axes["answer-format"] ?? "select-all";
  const shape = formatShape(format, { total: m.total, k: m.k }, r);
  const drawn = drawStatements(r, m.pool, shape.total, shape.k, m.ordered);
  const statements = orientStatements(
    drawn,
    resultFirstFlags(
      axes.orientation ?? "operation-first",
      drawn.length,
      surface,
    ),
  );
  const rendered = renderStatementSet(format, statements, m.copy(shape));
  const hint = typeof m.hint === "string" ? m.hint : m.hint(statements);
  if (quotesTrueStatement(`${rendered.prompt}\n${hint}`, statements))
    return null;
  return {
    prompt: rendered.prompt,
    response: rendered.response,
    answer: rendered.answer,
    hint,
    explanation: [...(m.lead ?? []), ...rendered.verdicts, ...(m.tail ?? [])],
    ...(m.figure ? { figure: m.figure } : {}),
    ...(rendered.choiceFeedback
      ? { choiceFeedback: rendered.choiceFeedback }
      : {}),
    statements,
  };
}
