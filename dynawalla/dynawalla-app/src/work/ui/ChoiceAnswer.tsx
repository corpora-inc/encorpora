import { useRef } from "react"

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
 * **The arrow keys are handwritten, because nothing gives them away.** An
 * `<input type="radio">` gets arrow navigation from the platform;
 * `role="radio"` on a `<button>` gets none of it — the ARIA pattern says the
 * author supplies it, and this component shipped without one. With the roving
 * `tabIndex` in place that made the group *worse* than plain buttons: a keyboard
 * user tabbed in, landed on the first option, was selected on focus, and could
 * never reach the second. Arrow keys move and wrap, Home and End go to the ends,
 * and `1`..`k` select by ordinal — bounded here, where the option count is,
 * rather than in the entry model, which has no schema and once wrote ordinal 8
 * into a four-option list.
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
  const parsed = selectedText === "" ? -1 : Number(selectedText)
  const count = schema.options.length
  const selected = Number.isInteger(parsed) && parsed >= 0 && parsed < count ? parsed : -1
  // The one option that carries the group's tab stop. Keyed off a *bounded*
  // index, so the group always has exactly one: with `selected` taken raw, a
  // stale out-of-range value made every option `tabIndex={-1}` and the whole
  // group unreachable by keyboard — measured as [-1, -1, -1, -1].
  const stop = selected < 0 ? 0 : selected

  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const move = (to: number) => {
    const index = ((to % count) + count) % count
    buttons.current[index]?.focus()
    onKey({ kind: "focus", field: index })
  }

  return (
    <div
      role="radiogroup"
      aria-label={strings.practice.answer}
      className="mx-auto flex w-full max-w-xs flex-col gap-2"
      onKeyDown={(event) => {
        if (disabled || event.altKey || event.ctrlKey || event.metaKey) return
        // Where the *focus* is, not where the selection is. They are the same
        // once a render has committed, and an arrow pressed before it has is
        // the one case that matters: taking `selected` from the render closure
        // moved from the previously chosen option, so ArrowDown after focusing
        // the first option landed on the fourth. The pattern is defined
        // relative to the focused item, and the event says which that is.
        const target = buttons.current.indexOf(event.target as HTMLButtonElement)
        const from = target >= 0 ? target : selected < 0 ? 0 : selected
        // The list is a column, so Down and Right are both "the next one" — the
        // pattern is written for either orientation and a child's hand is not.
        if (event.key === "ArrowDown" || event.key === "ArrowRight") move(from + 1)
        else if (event.key === "ArrowUp" || event.key === "ArrowLeft") move(from - 1)
        else if (event.key === "Home") move(0)
        else if (event.key === "End") move(count - 1)
        else if (/^[1-9]$/.test(event.key) && Number(event.key) <= count) move(Number(event.key) - 1)
        else return
        // Only once a key was ours: Enter belongs to the card and Tab belongs to
        // the page, and both leave through here untouched. `preventDefault`
        // only — the key still reaches the screen's window handler, whose first
        // line is `settleReactions()`, and a child who answers fast must never
        // wait on an animation. A digit that arrives there is a no-op: the
        // choice model refuses bare glyphs.
        event.preventDefault()
      }}
    >
      {schema.options.map((option, index) => {
        const chosen = index === selected
        return (
          <button
            // The index, not the written option: two options that render alike
            // would collide as keys. `schemaDefect` refuses an option set with
            // two options of equal value, and the list is index-aligned with
            // `AnswerValue.choice.index` anyway.
            key={index}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={chosen}
            data-dw-entry="option"
            disabled={disabled}
            // Roving tabindex: one stop for the group, arrows move within it.
            // Tabbing through four options to reach the Check plate is what the
            // pattern exists to prevent.
            tabIndex={index === stop ? 0 : -1}
            onPointerDown={(event) => {
              if (disabled) return
              event.preventDefault()
              event.currentTarget.focus()
              onKey({ kind: "focus", field: index })
            }}
            // Selection follows focus, which is the radio-group contract — and
            // what keeps the arrow handler above to one statement per key.
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
