import { ChoiceAnswer } from "./ChoiceAnswer.tsx"
import { ColumnGrid } from "./ColumnGrid.tsx"
import { FractionAnswer } from "./FractionAnswer.tsx"
import { VerdictWell } from "./VerdictWell.tsx"
import type { EntryKey, EntryState } from "../entry.ts"
import type { AnswerSchema } from "../curriculum.ts"
import type { Feedback } from "../session.ts"

/**
 * Where an answer is written, for every schema the slate cannot hold.
 *
 * `ProblemSlate` owns `integer` and keeps owning it: the answer is written on
 * the same run of numeral columns the problem is, under the same rule, which is
 * the whole reason it is a slate and not a form. The other three are not a run
 * of digits — two cells over a bar, a list, a grid — so each has its own
 * surface, and this picks.
 *
 * They share the verdict well, which must not be written four times: it is the
 * one live region here, its height is reserved from the first frame, and a copy
 * that announced nothing on a correct answer is a bug that happened once already.
 *
 * `null` for a schema with no surface cannot happen — `entryModelFor` returns
 * `undefined` first and `session.problemCard` throws — but it keeps the switch
 * total rather than trusting a cast.
 */
export function AnswerSurface({
  schema,
  entry,
  feedback,
  onKey,
  disabled,
}: {
  schema: AnswerSchema
  entry: EntryState
  feedback: Feedback | null
  onKey: (key: EntryKey) => void
  disabled: boolean
}) {
  return (
    <div className="dw-present flex flex-col gap-2">
      {schema.kind === "fraction" ? (
        <FractionAnswer entry={entry} onKey={onKey} disabled={disabled} />
      ) : schema.kind === "choice" ? (
        <ChoiceAnswer schema={schema} entry={entry} onKey={onKey} disabled={disabled} />
      ) : schema.kind === "columnAlgorithm" ? (
        <ColumnGrid schema={schema} entry={entry} onKey={onKey} disabled={disabled} />
      ) : null}
      <VerdictWell feedback={feedback} />
    </div>
  )
}
