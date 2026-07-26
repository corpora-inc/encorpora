import { useState } from "react"

import { IndexMark } from "../design/IndexMark.tsx"
import { strings } from "../app/strings.ts"
import type { Destination } from "../app/routes.ts"
import { WorldScreen } from "../world/Screen.tsx"
import { surfaceOf, type Row } from "./surfaces.ts"
import { useHostActions, useHostView } from "./useHost.ts"

/**
 * One renderer for every destination.
 *
 * The screens of this host are all the same object — a course of inscribed
 * rows, ruled off by hairlines, cut into the ground rather than floated on
 * cards. Five screens drawing themselves five ways would be five places for the
 * design to drift and five places for an empty one to hide.
 *
 * Rows are `min-h-16` (64 px) so every control on every screen clears the
 * child-sized target floor, and each one lays out as label-then-control with
 * the control allowed to wrap under the label at 320 px rather than squeezing
 * it.
 */
function Fact({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 py-3">
      <span className="inscription text-lg tracking-wide">{name}</span>
      <span className="numeral text-ink-muted shrink-0 text-sm">{value}</span>
    </div>
  )
}

/**
 * A choice, drawn as every option at once.
 *
 * Never a switch: a switch carries its state in a position and a colour, and
 * both are invisible to a screen reader that has not been told, and to anyone
 * reading a monochrome screen. `aria-pressed` is the state, the index mark is
 * the sighted signal, and the chosen option's own word is always visible.
 */
function Choice({
  name,
  value,
  options,
  choose,
}: Extract<Row, { kind: "choice" }>) {
  return (
    <fieldset className="min-h-16 py-3">
      <legend className="inscription mb-2 text-lg tracking-wide">{name}</legend>
      <div className="border-line-cut rounded-cut-sm flex overflow-hidden border">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => choose(option.value)}
              className={[
                "border-line-cut flex min-h-11 flex-1 items-center justify-center gap-2 border-r px-3 text-sm last:border-r-0",
                "transition-colors duration-[var(--dw-motion-quick)]",
                active ? "bg-ground text-ink" : "bg-ground-raised text-ink-muted",
              ].join(" ")}
            >
              {active ? <IndexMark className="text-index" /> : null}
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function Action({ name, tone, run }: Extract<Row, { kind: "action" }>) {
  return (
    <button
      type="button"
      onClick={run}
      className={[
        "group flex min-h-16 w-full items-center gap-3 py-3 text-left",
        "transition-colors duration-[var(--dw-motion-quick)] hover:bg-ground-sunk",
        tone === "danger" ? "text-strike" : "text-ink",
      ].join(" ")}
    >
      <IndexMark className="opacity-0 transition-opacity duration-[var(--dw-motion-quick)] group-hover:opacity-100 group-focus-visible:opacity-100" />
      <span className="inscription text-lg tracking-wide">{name}</span>
    </button>
  )
}

/**
 * A learner: an editable name, whether the app is theirs right now, and the way
 * to remove them.
 *
 * "Current" is carried three ways — the index mark, `aria-current`, and the
 * absence of the "Use" button — because which child the tablet is set to is the
 * single most consequential piece of state in this app, and none of the three
 * is a colour.
 */
function Learner({ name, given, current, use, rename, remove }: Extract<Row, { kind: "learner" }>) {
  return (
    <div
      className="flex min-h-16 items-center gap-3 py-3"
      aria-current={current ? "true" : undefined}
    >
      {current ? <IndexMark className="text-index shrink-0" /> : null}
      <input
        type="text"
        value={given}
        placeholder={name}
        aria-label={strings.profiles.name}
        onChange={(event) => rename(event.target.value)}
        className="inscription border-line focus-visible:border-line-cut min-w-0 flex-1 border-b bg-transparent py-2 text-lg tracking-wide"
      />
      {current ? null : (
        <button
          type="button"
          onClick={use}
          className="border-line-cut rounded-cut-sm text-ink-muted min-h-11 shrink-0 border px-3 text-sm"
        >
          {strings.profiles.use}
        </button>
      )}
      {remove ? (
        <button
          type="button"
          onClick={remove}
          className="text-strike min-h-11 shrink-0 px-2 text-sm"
        >
          {strings.profiles.remove}
        </button>
      ) : null}
    </div>
  )
}

/**
 * The construction: everything this learner has cut, at whatever size the
 * screen gives it.
 *
 * The drawing takes its text alternative from the row rather than building one,
 * which is what keeps `src/world/` a drawing of a number and not a part of the
 * app's copy.
 */
function Figure({ value, label }: Extract<Row, { kind: "figure" }>) {
  return (
    <div className="py-3">
      <WorldScreen placed={value} label={label} className="mx-auto block h-auto w-full max-w-sm" />
    </div>
  )
}

function RowView({ row }: { row: Row }) {
  switch (row.kind) {
    case "fact":
      return <Fact {...row} />
    case "choice":
      return <Choice {...row} />
    case "action":
      return <Action {...row} />
    case "learner":
      return <Learner {...row} />
    case "figure":
      return <Figure {...row} />
  }
}

export function Surface({ destination }: { destination: Destination }) {
  const [armed, arm] = useState(false)
  const view = useHostView(armed)
  const actions = useHostActions(arm)
  const sections = surfaceOf(destination, view, actions)

  return (
    <div className="flex flex-col gap-[var(--dw-stack-gap)]">
      {sections.map((section) => (
        // A rule above the course and one between every pair of rows, but none
        // under the last: a closing rule plus the next section's opening one
        // reads as a double line at every seam, which is a groove nobody cut.
        <ul key={section.key} className="border-line border-t">
          {section.rows.map((row) => (
            <li key={row.key} className="border-line border-b last:border-b-0">
              <RowView row={row} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}
