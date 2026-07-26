// The renderer bench. Development only.
//
// Every answer schema and every representation, drawn from a **real**
// `AnswerSchema` and driven by the **real** entry model, on one page — so a
// renderer can be looked at before a generator family exists to emit it. CG-8 is
// bidirectional, and a renderer nobody has drawn is a renderer nobody has
// checked.
//
// Not a route, and not in the shipped bundle: `vite build` inputs `index.html`
// and nothing else. It lives under `src/` rather than `tools/` so `npm run tsc`
// and `npm run lint` cover it. Its own chrome is untranslated English on
// purpose — no string here ships, and none counts against the practice
// surface's budget. `tools/drive-schemas.mjs` drives it and photographs it.

import { useCallback, useEffect, useState } from "react"

import { AnswerSurface } from "../work/ui/AnswerSurface.tsx"
import { Keypad } from "../work/ui/Keypad.tsx"
import { ProblemSlate, ProblemStatement } from "../work/ui/ProblemSlate.tsx"
import { Representation } from "../work/ui/Representation.tsx"
import { entryKeyFromKeyboard, entryModelFor } from "../work/entry.ts"
import type { EntryKey, EntryState } from "../work/entry.ts"
import { exact, columnOpFamily, skillId, FORM_COLUMN, FORM_FREE_ENTRY } from "../work/curriculum.ts"
import type { AnswerSchema, Exercise, RepSpec } from "../work/curriculum.ts"
import type { Feedback } from "../work/session.ts"

interface Specimen {
  readonly id: string
  readonly schema: AnswerSchema
}

/**
 * One specimen per shape a renderer has to hold, including the awkward ones: a
 * mixed number (three fields), a decimal grid (a point between two columns), a
 * six-column grid (the widest `MAX_DIGITS` allows, at 320 px).
 */
const SPECIMENS: readonly Specimen[] = [
  { id: "integer", schema: { kind: "integer", digits: 4, decimalPlaces: 0 } },
  { id: "decimal-tenths", schema: { kind: "integer", digits: 3, decimalPlaces: 1 } },
  { id: "decimal-hundredths", schema: { kind: "integer", digits: 4, decimalPlaces: 2 } },
  { id: "fraction", schema: { kind: "fraction", parts: ["num", "den"] } },
  { id: "mixed", schema: { kind: "fraction", parts: ["whole", "num", "den"] } },
  {
    id: "choice",
    schema: {
      kind: "choice",
      k: 4,
      options: [
        { kind: "fraction", num: 1n, den: 2n },
        { kind: "fraction", num: 2n, den: 3n },
        { kind: "fraction", num: 3n, den: 4n, whole: 1n },
        { kind: "number", value: exact.rational(3n, 5n), decimalPlaces: 1 },
      ],
    },
  },
  { id: "column-borrow", schema: { kind: "columnAlgorithm", cols: 4, marks: "borrow", decimalPlaces: 0 } },
  { id: "column-carry", schema: { kind: "columnAlgorithm", cols: 6, marks: "carry", decimalPlaces: 0 } },
  { id: "column-decimal", schema: { kind: "columnAlgorithm", cols: 3, marks: "borrow", decimalPlaces: 1 } },
]

const REP_SPECS: readonly { readonly id: string; readonly spec: RepSpec }[] = [
  { id: "line-quarters", spec: { rep: "number-line", params: { from: 0, to: 1, denominator: 4, mark: 3 } } },
  { id: "line-thirds", spec: { rep: "number-line", params: { from: 0, to: 2, denominator: 3, mark: 5 } } },
  { id: "line-wholes", spec: { rep: "number-line", params: { from: 2, to: 8, denominator: 1, mark: 3 } } },
  { id: "balance-level", spec: { rep: "balance-scale", params: { left: 12, right: 12 } } },
  { id: "balance-left", spec: { rep: "balance-scale", params: { left: 17, right: 12 } } },
  { id: "balance-right", spec: { rep: "balance-scale", params: { left: 8, right: 12 } } },
  // Refused, and drawing nothing is the correct outcome: an id no renderer owns.
  { id: "unrenderable", spec: { rep: "gear-train", params: { teeth: 12 } } },
]

/** A real generated column item, so the slate above the grid is not a mock. */
function columnExercise(form: string): Exercise {
  return columnOpFamily.generate({
    skillId: skillId("dw.add.regroup.subtract-across-zero"),
    level: 2,
    seed: 159579,
    params: {
      op: "sub",
      digits: 4,
      operandDigits: 4,
      regroupings: 3,
      acrossZero: 2,
      decimalPlaces: 0,
      allowZeroResult: false,
    },
    forms: [form],
  })
}

export function Preview() {
  const [active, setActive] = useState<string>(SPECIMENS[0]?.id ?? "")
  const [states, setStates] = useState<Readonly<Record<string, EntryState>>>(() => {
    const initial: Record<string, EntryState> = {}
    for (const specimen of SPECIMENS) {
      const model = entryModelFor(specimen.schema)
      if (model !== undefined) initial[specimen.id] = model.init(specimen.schema)
    }
    return initial
  })
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const press = useCallback(
    (id: string, key: EntryKey) => {
      const specimen = SPECIMENS.find((entry) => entry.id === id)
      const model = specimen === undefined ? undefined : entryModelFor(specimen.schema)
      if (specimen === undefined || model === undefined) return
      setStates((previous) => {
        const current = previous[id]
        if (current === undefined) return previous
        return { ...previous, [id]: model.press(current, key) }
      })
    },
    [setStates],
  )

  // The practice screen's window-level handler, routed to whichever specimen was
  // last touched, so a key pressed here takes the app's own path.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = entryKeyFromKeyboard(event.key)
      if (key === null) return
      event.preventDefault()
      press(active, key)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [active, press])

  return (
    <div className="bg-ground text-ink min-h-full p-4">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-preview="theme"
            className="border-line-strong rounded-cut-md bg-ground-raised min-h-10 border px-3 text-sm"
            onClick={() => {
              document.documentElement.classList.toggle("dw-dark")
            }}
          >
            dark
          </button>
          <button
            type="button"
            data-preview="verdict"
            className="border-line-strong rounded-cut-md bg-ground-raised min-h-10 border px-3 text-sm"
            onClick={() => {
              setFeedback((current) =>
                current === null
                  ? { kind: "seated" }
                  : current.kind === "seated"
                    ? { kind: "struck", answer: "2203", stage: "verify" }
                    : null,
              )
            }}
          >
            verdict
          </button>
          <span className="text-ink-muted text-sm" data-preview="active">
            {active}
          </span>
        </div>

        {SPECIMENS.map((specimen) => {
          const model = entryModelFor(specimen.schema)
          const state = states[specimen.id]
          if (model === undefined || state === undefined) return null
          const complete = model.complete(state)
          const value = model.value(state, specimen.schema)
          return (
            <section
              key={specimen.id}
              data-case={specimen.id}
              data-complete={String(complete)}
              data-value={value === null ? "" : JSON.stringify(value, replacer)}
              className="border-line rounded-cut-md flex flex-col gap-3 border p-3"
              onPointerDownCapture={() => {
                setActive(specimen.id)
              }}
              onFocusCapture={() => {
                setActive(specimen.id)
              }}
            >
              <h2 className="text-ink-muted text-xs tracking-wide uppercase">{specimen.id}</h2>

              {specimen.schema.kind === "integer" ? (
                <ProblemSlate
                  exercise={{ ...columnExercise(FORM_FREE_ENTRY), schema: specimen.schema }}
                  entry={state}
                  feedback={feedback}
                />
              ) : (
                <>
                  {specimen.schema.kind === "columnAlgorithm" ? (
                    <ProblemStatement exercise={columnExercise(FORM_COLUMN)} />
                  ) : null}
                  <AnswerSurface
                    schema={specimen.schema}
                    entry={state}
                    feedback={feedback}
                    onKey={(key) => {
                      press(specimen.id, key)
                    }}
                    disabled={feedback !== null}
                  />
                </>
              )}

              {model.keys(specimen.schema).length === 0 ? null : (
                <div className="mx-auto w-full max-w-xs">
                  <Keypad
                    model={model}
                    schema={specimen.schema}
                    onKey={(key) => {
                      press(specimen.id, key)
                    }}
                    disabled={feedback !== null}
                  />
                </div>
              )}
            </section>
          )
        })}

        {REP_SPECS.map((entry) => (
          <section
            key={entry.id}
            data-case={entry.id}
            className="border-line rounded-cut-md flex flex-col gap-2 border p-3"
          >
            <h2 className="text-ink-muted text-xs tracking-wide uppercase">{entry.id}</h2>
            <Representation spec={entry.spec} />
          </section>
        ))}
      </div>
    </div>
  )
}

/** `BigInt` has no JSON form, and the driver reads these values back out. */
function replacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value
}


