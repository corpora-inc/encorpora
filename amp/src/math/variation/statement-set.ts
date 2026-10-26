import type { ProblemResponse, ResponseCapability } from "../contracts";
import { serializeSelection } from "../selection-response";
import { defineAxis, type Random } from "./axes";
import { writeEquation, type EquationSides } from "./orientation";

/**
 * Answer formats for a set of statements whose truth the model computes.
 *
 * - `select-all`: options are the statements; choose the true ones.
 * - `true-false-pair`: each statement appears twice, "… is true." and
 *   "… is false."; choose the correct one of every pair.
 * - `single-true` / `single-false`: one choice question keyed to the only
 *   true (or only false) statement.
 *
 * All four reuse the existing response protocols (multi-select-v1 or
 * single-choice-v1), so the public payload has exactly today's shape.
 */
export const answerFormatAxis = defineAxis("answer-format", [
  "select-all",
  "true-false-pair",
  "single-true",
  "single-false",
]);
export type StatementFormat = (typeof answerFormatAxis.values)[number];

/** The response protocol each format needs. A family's template declares one
 * capability; every format it offers must need exactly that one. */
export const formatCapability: Readonly<
  Record<StatementFormat, ResponseCapability>
> = {
  "select-all": "multi-select-v1",
  "true-false-pair": "multi-select-v1",
  "single-true": "single-choice-v1",
  "single-false": "single-choice-v1",
};

export interface Statement {
  /** Display text, e.g. "$7\times3=21$". Unique within a set. */
  label: string;
  /** Computed from the numbers the statement states, never asserted. */
  holds: boolean;
  /** Why it is true or false, naming its own numbers. */
  why: string;
  /** When the statement is an equation: its sides, so orientation can rewrite it. */
  equation?: EquationSides;
}

/** How many statements a format shows and how many of them are true. */
export function formatShape(
  format: StatementFormat,
  legacy: { total: number; k: number },
  r: Random,
): { total: number; k: number } {
  switch (format) {
    case "select-all":
      return legacy;
    case "true-false-pair": {
      // As many equations as the select-all form keys, so the count a
      // learner reads is the same in both formats.
      // Any number of them may be true, all or none included, so the last
      // verdict never follows from the others.
      const total = Math.min(4, Math.max(2, legacy.k));
      return { total, k: r(0, total) };
    }
    case "single-true":
      return { total: 4, k: 1 };
    case "single-false":
      return { total: 4, k: 3 };
  }
}

/** Shuffle in place with the generators' Fisher–Yates order. */
function shuffle<T>(r: Random, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = r(0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** Draw `total` statements holding exactly `k` true ones (labels deduplicated),
 * shuffled unless `ordered`. Throws "Need three retry" when the pool is short,
 * which generators treat as a redraw. */
export function drawStatements<S extends Statement>(
  r: Random,
  pool: readonly S[],
  total: number,
  k: number,
  ordered = false,
): S[] {
  const seen = new Set<string>();
  const unique = pool.filter((s) => {
    if (seen.has(s.label)) return false;
    seen.add(s.label);
    return true;
  });
  const yes = unique.filter((s) => s.holds);
  const no = unique.filter((s) => !s.holds);
  if (yes.length < k || no.length < total - k)
    throw new Error("Need three retry: not enough statements");
  const drawn = [
    ...shuffle(r, yes).slice(0, k),
    ...shuffle(r, no).slice(0, total - k),
  ];
  return ordered
    ? drawn.sort((a, b) => unique.indexOf(a) - unique.indexOf(b))
    : shuffle(r, drawn);
}

/** Rewrite equation statements with the given orientation flags. */
export function orientStatements<S extends Statement>(
  statements: readonly S[],
  resultFirst: readonly boolean[],
): S[] {
  return statements.map((s, i) =>
    s.equation && resultFirst[i]
      ? { ...s, label: `$${writeEquation(s.equation, true)}$` }
      : s,
  );
}

export interface StatementSetCopy {
  /** select-all prompt in the family's own words, stating the count. */
  selectPrompt: string;
  /** select-all response label, e.g. "Choose 3 true equations". */
  selectLabel: string;
  /** Context before a generic pair or single-choice instruction ("" for none). */
  lead: string;
  /** One statement's noun: "equation". */
  one: string;
}
export interface RenderedStatementSet {
  prompt: string;
  response: ProblemResponse;
  answer: string;
  /** "<statement>: true. <why>" for each statement, in display order. */
  verdicts: string[];
  /** single-choice formats only: why each unkeyed option is wrong. */
  choiceFeedback?: Record<string, string>;
}

const ids = "abcdefgh";
export const pairLabel = (s: Statement, claim: boolean) =>
  `${s.label} is ${claim ? "true" : "false"}.`;
const verdict = (s: Statement) =>
  `${s.label.replace(/\.$/, "")}: ${s.holds ? "true" : "false"}. ${s.why}`;
const join = (lead: string, rest: string) => (lead ? `${lead} ${rest}` : rest);

/** Render one statement set in an answer format. Pure: the statements' order
 * and truth were fixed by the model and the draw. */
export function renderStatementSet(
  format: StatementFormat,
  statements: readonly Statement[],
  copy: StatementSetCopy,
): RenderedStatementSet {
  const n = statements.length;
  const k = statements.filter((s) => s.holds).length;
  const verdicts = statements.map(verdict);
  if (format === "select-all") {
    const options = statements.map((s, i) => ({
      id: `option-${ids[i]}`,
      label: s.label,
    }));
    return {
      prompt: copy.selectPrompt,
      response: {
        kind: "multi-select",
        label: copy.selectLabel,
        selectionCount: k,
        options,
      },
      answer: serializeSelection(
        options.filter((_, i) => statements[i]!.holds).map((o) => o.id),
      ),
      verdicts,
    };
  }
  if (format === "true-false-pair") {
    if (2 * n > ids.length) throw new Error("Too many statements for pairs");
    const options = statements.flatMap((s, i) => [
      { id: `option-${ids[2 * i]}`, label: pairLabel(s, true) },
      { id: `option-${ids[2 * i + 1]}`, label: pairLabel(s, false) },
    ]);
    return {
      prompt: join(
        copy.lead,
        `Decide whether each of the ${n} ${copy.one}s is true or false, and choose the correct statement for each ${copy.one}.`,
      ),
      response: {
        kind: "multi-select",
        label: `Choose ${n} correct statements`,
        selectionCount: n,
        options,
      },
      answer: serializeSelection(
        statements.map((s, i) => `option-${ids[2 * i + (s.holds ? 0 : 1)]}`),
      ),
      verdicts,
    };
  }
  const want = format === "single-true";
  const keyed = statements.filter((s) => s.holds === want);
  if (keyed.length !== 1 || n < 2 || n > 4)
    throw new Error(`A ${format} set needs exactly one keyed statement`);
  const options = statements.map((s, i) => ({
    id: `option-${ids[i]}`,
    label: s.label,
  }));
  const answer = options[statements.indexOf(keyed[0]!)]!.id;
  return {
    prompt: join(copy.lead, `Which ${copy.one} is ${want ? "true" : "false"}?`),
    response: { kind: "choice", label: "Choose one answer", options },
    answer,
    verdicts,
    choiceFeedback: Object.fromEntries(
      statements.flatMap((s, i) =>
        options[i]!.id === answer
          ? []
          : [
              [
                options[i]!.id,
                `${s.label} is ${s.holds ? "true" : "false"}: ${s.why}`,
              ],
            ],
      ),
    ),
  };
}

/** A prompt or hint must never quote a keyed statement verbatim. */
export const quotesTrueStatement = (
  text: string,
  statements: readonly Statement[],
) => statements.some((s) => s.holds && text.includes(s.label));
