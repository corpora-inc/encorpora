import { strings } from "../../app/strings.ts"
import type { EntryKey, EntryModel, KeyCap } from "../entry.ts"
import type { AnswerSchema } from "../curriculum.ts"

/**
 * The keypad, laid out from whatever the entry model declares.
 *
 * It reads `model.keys(schema)` and draws that. It does not know what an integer
 * is, and it will not need changing when a fraction model adds a `/` cap or a
 * decimal model adds the locale's separator — which is the point of the entry
 * layer being a declared structure rather than a text field.
 *
 * Targets are ≥2 cm on the diagonal a child actually hits. The height comes
 * from `--dw-key-height` in the vertical scale: 4.75 rem = 76 px on a normal
 * viewport, and 3.25 rem = 52 px under 720 px of viewport height, where the
 * whole surface has to fit or the child scrolls to press Check on every card.
 * Three columns still fit inside 320 px, which makes a key 77 px wide — so the
 * short-viewport key is 77 × 52, a 93 px diagonal, 2.46 cm. Over the floor at
 * both sizes, and `surface.test.ts` computes that rather than trusting it.
 *
 * Bound on `pointerdown`, so the acknowledgement is in the frame the finger
 * lands in rather than ~100 ms later when the tap resolves.
 */
export function Keypad({
  model,
  schema,
  onKey,
  disabled,
}: {
  model: EntryModel
  schema: AnswerSchema
  onKey: (key: EntryKey) => void
  disabled: boolean
}) {
  const caps = model.keys(schema)

  return (
    <div className="grid grid-cols-3 gap-2">
      {caps.map((cap, index) =>
        cap.kind === "blank" ? (
          <div key={`blank-${String(index)}`} aria-hidden="true" />
        ) : (
          <KeyPlate key={capId(cap)} cap={cap} onKey={onKey} disabled={disabled} />
        ),
      )}
    </div>
  )
}

type PressableCap = Exclude<KeyCap, { kind: "blank" }>

function capId(cap: PressableCap): string {
  return cap.kind === "glyph" ? cap.glyph : cap.kind
}

function capKey(cap: PressableCap): EntryKey {
  switch (cap.kind) {
    case "glyph":
      return { kind: "glyph", glyph: cap.glyph }
    case "advance":
      return { kind: "advance" }
    case "delete":
      return { kind: "delete" }
  }
}

/**
 * The face of a key, and the only thing on it that is read aloud.
 *
 * A glyph is its own label — a screen reader says "7" — so it carries none, and
 * a second one would have it read twice. The two shaped keys are marks with no
 * reading, so they carry a string each.
 */
const CAP_LABEL: Readonly<Record<string, string>> = {
  delete: strings.practice.delete,
  advance: strings.practice.nextField,
}

/** `⌫` erases, `▸` moves on. Both are marks, and both are labelled above. */
const CAP_FACE: Readonly<Record<string, string>> = { delete: "⌫", advance: "▸" }

function KeyPlate({
  cap,
  onKey,
  disabled,
}: {
  cap: PressableCap
  onKey: (key: EntryKey) => void
  disabled: boolean
}) {
  const press = () => {
    if (!disabled) onKey(capKey(cap))
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={CAP_LABEL[cap.kind]}
      onPointerDown={(event) => {
        event.preventDefault()
        press()
      }}
      onClick={(event) => {
        // Keyboards do not send pointer events; Enter and Space arrive here
        // with `detail === 0`. A real tap already ran on pointer-down.
        if (event.detail === 0) press()
      }}
      className="border-line-strong rounded-cut-md bg-ground-raised text-ink numeral active:bg-ground-sunk flex min-h-[var(--dw-key-height)] items-center justify-center border text-2xl transition-colors duration-[var(--dw-motion-quick)] disabled:opacity-40"
    >
      {cap.kind === "glyph" ? cap.glyph : CAP_FACE[cap.kind]}
    </button>
  )
}
