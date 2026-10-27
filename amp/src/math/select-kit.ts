import type { SemanticFigure, TemplateMetadata } from "./contracts";
import { chainFamily } from "./chain-kit";
import { answerFormatAxis } from "./variation/statement-set";
import { restrictAxis, type AxisSet, type Random } from "./variation/axes";
import {
  statementSurface,
  type StatementAxes,
  type StatementModel,
} from "./variation/compose";
import type { Statement, StatementFormat } from "./variation/statement-set";

/**
 * Shared pieces of the select-every-true-statement families. A family writes
 * one exact model: a pool of statements whose truth each model computes from
 * the numbers or figure the statement states. `statementSurface` draws a
 * set with the stated number of true statements, and the answer format axis
 * shows it as select-all or as a true/false verdict per statement.
 */

/** Statements that are complete sentences or equations read well as a
 * true/false verdict each. A bare list of numbers, fractions or figure
 * letters does not, so those families offer select-all only. */
export type SelectFormats = "both" | "select-all";

/** Both formats take the template's one capability, multi-select-v1. */
export const selectFormatAxis = restrictAxis(answerFormatAxis, [
  "select-all",
  "true-false-pair",
]);

export function selectTemplate(
  t: Omit<
    TemplateMetadata,
    "version" | "requiredResponseCapability" | "requiredFigureCapability"
  > & { figure?: NonNullable<TemplateMetadata["requiredFigureCapability"]> },
): TemplateMetadata {
  const { figure, ...rest } = t;
  return {
    ...rest,
    version: 1,
    requiredResponseCapability: "multi-select-v1",
    ...(figure ? { requiredFigureCapability: figure } : {}),
  };
}

/** TeX number with grouped thousands: 52{,}306. */
export const tex = (n: number) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "{,}");

export function st(label: string, holds: boolean, why: string): Statement {
  return { label, holds, why };
}

export type SelectModel = StatementModel & {
  hintByFormat?: (
    shown: readonly Statement[],
    format: StatementFormat,
  ) => string;
};
export interface SelectSpec {
  variant: string;
  pool: Statement[];
  /** Statements shown and how many are true in the select-all format. */
  total: number;
  k: number;
  /** Givens read before the question, "" for none. */
  context: string;
  /** The select-all question for k true statements, stating the count. */
  ask: (k: number) => string;
  /** One statement's noun and its plural in the response label. */
  one?: string;
  plural?: string;
  /** A fixed hint, or one written from the statements shown and the answer
   * format (a count to name differs between select-all and verdict pairs). */
  hint:
    string | ((shown: readonly Statement[], format: StatementFormat) => string);
  figure?: SemanticFigure;
  ordered?: boolean;
}

export function selectModel(s: SelectSpec): SelectModel {
  const one = s.one ?? "statement";
  const hintSpec = s.hint;
  const plural = s.plural ?? `${one}s`;
  const join = (...parts: string[]) => parts.filter(Boolean).join(" ");
  return {
    variant: s.variant,
    pool: s.pool,
    total: s.total,
    k: s.k,
    ...(s.ordered ? { ordered: true } : {}),
    copy: ({ k }) => ({
      selectPrompt: join(s.context, s.ask(k)),
      selectLabel: `Choose ${k} ${k === 1 ? one : plural}`,
      lead: s.context,
      one,
    }),
    hint:
      typeof hintSpec === "string"
        ? hintSpec
        : (shown) => hintSpec(shown, "select-all"),
    ...(typeof hintSpec === "string" ? {} : { hintByFormat: hintSpec }),
    ...(s.figure ? { figure: s.figure } : {}),
  };
}

/** A family on the variation layer whose only axis is the answer format. */
export function selectFamily<
  A extends AxisSet = { "answer-format": typeof selectFormatAxis },
>(
  template: TemplateMetadata,
  model: (r: Random, axes: Record<string, string>) => SelectModel,
  extraAxes?: A,
  formats: SelectFormats = "select-all",
) {
  const axes = {
    ...(formats === "both" ? { "answer-format": selectFormatAxis } : {}),
    ...(extraAxes ?? {}),
  };
  return chainFamily({
    template,
    axes,
    model: (r, a) => model(r, a as Record<string, string>),
    variant: (m: SelectModel) => m.variant,
    render: (m: SelectModel, a, r, surface) => {
      const axesNow = a as unknown as StatementAxes;
      const format = axesNow["answer-format"] ?? "select-all";
      const by = m.hintByFormat;
      return statementSurface(
        by ? { ...m, hint: (shown) => by(shown, format) } : m,
        axesNow,
        r,
        surface,
      );
    },
  });
}

/** Pick `n` entries of a pool without replacement. */
export function sample<T>(r: Random, pool: readonly T[], n: number): T[] {
  const rest = [...pool];
  const out: T[] = [];
  while (out.length < n && rest.length)
    out.push(rest.splice(r(0, rest.length - 1), 1)[0]!);
  return out;
}
