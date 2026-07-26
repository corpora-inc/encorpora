/**
 * Wrap an exact value in the answer shape a column-op item's schema expects.
 * Shared by the generator and by the mal-rules, so a buggy procedure's output is
 * always comparable to the canonical answer with `answerEquals`.
 */

import type { Rational } from "../../math/rational.ts";
import type { AnswerSchema, AnswerValue, ColumnMark } from "../../types/answer.ts";

export function answerValueFor(
  schema: AnswerSchema,
  value: Rational,
  marks: readonly ColumnMark[] = [],
): AnswerValue {
  switch (schema.kind) {
    case "integer":
      return { kind: "integer", value };
    case "columnAlgorithm":
      return { kind: "columnAlgorithm", value, marks };
    default:
      throw new TypeError(`gen.arith.column-op does not emit a ${schema.kind} answer`);
  }
}
