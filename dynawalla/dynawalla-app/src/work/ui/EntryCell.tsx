import type { EntryField } from "../entry.ts"

/**
 * One cell of a multi-field answer: a numerator, a denominator, a column of a
 * grid, the regrouping written above it.
 *
 * A `<button>`, because the only element every platform's keyboard, screen
 * reader and switch control already knows how to reach is a control. An
 * `<input>` would raise a soft keyboard over this app's own keypad on every tap,
 * and a `<div tabIndex={0}>` is a button with the free parts taken back out.
 *
 * `data-dw-entry` tells the screen's Enter handler that this button is part of
 * the answer rather than a control of its own. Without it, focusing a cell and
 * pressing Enter activated the button and committed nothing — the child inside
 * the answer with no way out but the mouse, which is the same class of bug as
 * the Enter that trapped a keyboard user on a card with no entry at all.
 *
 * Empty is a no-break space: an empty line box collapses and the cell loses its
 * height, which moves every cell beside it.
 */
export function EntryCell({
  field,
  label,
  current,
  onFocus,
  disabled,
  tone = "answer",
}: {
  field: EntryField
  /** Read aloud. The place value for a grid cell, the part for a fraction. */
  label: string
  /** Is this the cell the keypad is writing into? */
  current: boolean
  onFocus: () => void
  disabled: boolean
  /** `answer` is written in ink; `mark` is the lighter hand of a regrouping. */
  tone?: "answer" | "mark"
}) {
  const base =
    "numeral rounded-cut-sm flex items-center justify-center border-b-2 transition-colors duration-[var(--dw-motion-quick)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dw-focus)] disabled:opacity-40"
  const size =
    tone === "mark"
      ? "text-ink-muted min-h-8 min-w-8 text-sm"
      : "text-ink min-h-[var(--dw-cell-height)] min-w-[var(--dw-cell-width)] text-[length:var(--dw-numeral-size)]"
  // The cell being written into is named by a solid brass rule, the others by a
  // hairline. Never by colour alone and never by a fill: a filled cell reads as
  // a cell that already has something in it.
  const edge = current ? "border-index bg-ground-raised" : "border-line"

  return (
    <button
      type="button"
      data-dw-entry="cell"
      disabled={disabled}
      aria-label={label}
      // The cell the keypad writes into, in the accessibility tree as well as on
      // the surface. `aria-current` and not `aria-selected`: nothing here is a
      // selection, it is where the next key lands.
      {...(current ? { "aria-current": "true" as const } : {})}
      onPointerDown={(event) => {
        if (disabled) return
        // Focus is moved explicitly rather than left to the platform: a tap does
        // not focus a button on iOS Safari, and a cell the keypad is writing
        // into that the keyboard cannot then reach is worse than no focus at all.
        event.preventDefault()
        event.currentTarget.focus()
        onFocus()
      }}
      // Tab lands here without a pointer event. Selecting on focus is what makes
      // Tab and the keypad agree about which cell is current.
      onFocus={onFocus}
      className={`${base} ${size} ${edge}`}
    >
      {field.text === "" ? " " : field.text}
    </button>
  )
}
