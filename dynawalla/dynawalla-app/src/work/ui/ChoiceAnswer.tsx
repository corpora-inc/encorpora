import { strings } from "../../app/strings.ts"
import { writeChoiceOption } from "../notation.ts"
import { FIELD_CHOICE } from "../entry.ts"
import type { EntryKey, EntryState } from "../entry.ts"
import type { AnswerSchema } from "../curriculum.ts"

/**
 * A closed list of options, one of which is the answer.
 *
 * A real radio group: `role="radiogroup"` over `role="radio"`, roving
 * `tabIndex`, selection following focus — the ARIA pattern, and what a screen
 * reader's arrow keys already expect. A row of plain buttons gives no count
 * ("2 of 4"), no group name and no way to hear what is chosen.
 *
 * **Chosen is not carried by colour.** The chosen option is inset into the
 * ground with a solid index rule down its leading edge, and is the only one
 * whose `aria-checked` is true (`Q-10`, CG-18).
 *
 * One column, not a grid: options are numbers of different widths — `3/4`,
 * `0.75`, `12` — and a two-column grid at 320 px wraps the longest while the
 * shortest sits in a field of white.
 */
export function ChoiceAnswer({
  schema,
  entry,
  onKey,
  disabled,
}: {
  schema: Extract<AnswerSchema, { kind: "choice" }>
  entry: EntryState
  onKey: (key: EntryKey) => void
  disabled: boolean
}) {
  const selectedText = entry.fields.find((field) => field.id === FIELD_CHOICE)?.text ?? ""
  const selected = selectedText === "" ? -1 : Number(selectedText)

  return (
    <div
      role="radiogroup"
      aria-label={strings.practice.answer}
      className="mx-auto flex w-full max-w-xs flex-col gap-2"
    >
      {schema.options.map((option, index) => {
        const chosen = index === selected
        return (
          <button
            key={writeChoiceOption(option)}
            type="button"
            role="radio"
            aria-checked={chosen}
            data-dw-entry="option"
            disabled={disabled}
            // Roving tabindex: one stop for the group, arrows move within it.
            // Tabbing through four options to reach the Check plate is what the
            // pattern exists to prevent. Nothing is focusable when the group has
            // no selection yet except the first option, which is where a
            // keyboard user starts.
            tabIndex={chosen || (selected < 0 && index === 0) ? 0 : -1}
            onPointerDown={(event) => {
              if (disabled) return
              event.preventDefault()
              event.currentTarget.focus()
              onKey({ kind: "focus", field: index })
            }}
            // Selection follows focus, which is the radio-group contract and is
            // what makes the arrow keys work without a key handler of their own.
            onFocus={() => {
              if (!disabled) onKey({ kind: "focus", field: index })
            }}
            onClick={(event) => {
              // Keyboards send no pointer event; Space arrives here with
              // `detail === 0`. A real tap already ran on pointer-down.
              if (event.detail === 0 && !disabled) onKey({ kind: "focus", field: index })
            }}
            className={[
              "numeral rounded-cut-md flex min-h-14 items-center gap-3 border px-4 text-left text-xl",
              "transition-colors duration-[var(--dw-motion-quick)] disabled:opacity-40",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dw-focus)]",
              chosen
                ? "border-line-strong border-l-4 border-l-[var(--dw-index)] bg-ground-sunk text-ink"
                : "border-line-strong bg-ground-raised text-ink",
            ].join(" ")}
          >
            {writeChoiceOption(option)}
          </button>
        )
      })}
    </div>
  )
}
