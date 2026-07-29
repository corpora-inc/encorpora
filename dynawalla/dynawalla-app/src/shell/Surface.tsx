import { useEffect, useId, useState } from "react"

import { Catalog } from "../catalog/Catalog.tsx"
import { IndexMark } from "../design/IndexMark.tsx"
import { strings } from "../app/strings.ts"
import type { Destination } from "../app/routes.ts"
import { WorldScreen } from "../world/Screen.tsx"
import { surfaceOf, type Row, type Section } from "./surfaces.ts"
import { useHostActions, useHostView } from "./useHost.ts"

/**
 * A row's fields without its key.
 *
 * The key belongs to the `<li>` that lists the row, not to the component that
 * draws it: spreading a row wholesale puts `key` on the child, where React logs
 * an error on every render and the key does nothing at all.
 */
type Keyless<K extends Row["kind"]> = Omit<Extract<Row, { kind: K }>, "key">

/**
 * The one rhythm every row in this host shares.
 *
 * Four of the five destinations are drawn by this file, so this string is the
 * app's feel: a 64 px child-sized row, one vertical padding, one label→value
 * gap, and one optical centre. The baseline audit found five row types that
 * were *nearly* the same — a fact optically centred at 12 px next to a choice
 * with 8 px above its control and 12 px below it — and the eye catches that
 * long before anyone can name it. Written once, here, so the five cannot drift.
 *
 * Every length in it is a role token (`--dw-row-min`, `--dw-row-pad`,
 * `--dw-row-gap`), so a short viewport brings the padding down at the rungs in
 * `tokens.css` while the 64 px target floor — a fact about a hand, not taste —
 * stays exactly where it is.
 *
 * **`--dw-row-pad` is not in it, and that is the whole of the fix for the row
 * that was never 64 px.** A one-line row's content is about 24 px and the
 * padding was inert — the 64 px minimum was doing the work. But a row holding
 * a control is 44 px of touch floor, and 44 + 2 × 10 is 64 only by accident;
 * a segmented control in its 4 px track is 54, and 54 + 20 is 74. So every
 * screen in the app drew its choice rows ten pixels taller than its fact rows
 * — measured at 74 on Parents beside facts at 64, the same Developer-mode
 * control a different height from its neighbours. The minimum alone gives all
 * of them exactly 64 and centres whatever is inside. Padding comes back, once,
 * on the two-line variants below, where there is genuinely a second line.
 */
const ROW = "flex min-h-row-min w-full items-center gap-row-gap"

/**
 * The same row when it has a second line in it: a long fact stacked under its
 * label, or a three-option control that will not fit beside one on a phone.
 * Here the padding is not inert and is what keeps two lines off the hairline.
 */
const ROW_STACKED = `${ROW} flex-col items-start py-row`

/** The label of a row: the display face at the one size a list is read at. */
const ROW_LABEL = "inscription min-w-0 text-md"

/**
 * The value of a fact, at one size whether the row is inline or stacked.
 *
 * Body face, not `--font-numeral`. The rounded grotesque is where digits live
 * when digits are the subject — a score, a price — and a version string beside
 * an old-style-serif label made one row carry two unrelated voices, which is
 * the collision FOUNDATION names. `tabular-nums` keeps the figures lining up
 * down a column without dragging a third typeface into the row.
 */
const FACT_VALUE = "text-ink-muted min-w-0 text-base break-words tabular-nums"

/**
 * A value long enough that a two-column row stops being a row.
 *
 * Developer mode prints capability grants — `core:app:allow-version` against
 * `@tauri-apps/api/app.getVersion` — and squeezed into label/value columns each
 * side wraps to two lines with a ragged gutter down the middle, which the audit
 * called the ugliest block in the app. Past this budget the row stacks instead:
 * label, then value beneath it, both flush left. Deliberate rather than
 * squeezed, and it is the same shape a native list uses for a long detail.
 */
const INLINE_BUDGET = 34

/** What a fact with nothing to report draws. Never a blank space. */
const NOTHING = "—"

function Fact({ name, value }: { name: string; value: string }) {
  const shown = value.trim().length > 0 ? value : NOTHING
  const stacked = name.length + shown.length > INLINE_BUDGET

  // `min-w-0` on both children, and no `shrink-0` anywhere: a flex item's
  // default `min-width: auto` refuses to shrink below its content regardless of
  // any `shrink` setting, which is the version of the parent-area sideways
  // scroll that survives a naive fix. Keep both.
  // `--dw-space-1` and not `--dw-label-gap` between the two lines of a stacked
  // pair, and it is a pairing fix rather than a taste one: at the label gap the
  // distance from a label to its own value (~41 px of baseline separation) was
  // the same as the distance from that value across the hairline to the NEXT
  // label (~44 px), so `@tauri-apps/api/app.getVersion` was as plausibly
  // attached to the row below it as to its own. A pair has to be tighter
  // inside than the gap that separates it from the next pair.
  return stacked ? (
    <div className={`${ROW_STACKED} gap-[var(--dw-space-1)]`}>
      <span className={`${ROW_LABEL} w-full`}>{name}</span>
      <span className={`${FACT_VALUE} w-full`}>{shown}</span>
    </div>
  ) : (
    <div className={`${ROW} justify-between`}>
      <span className={ROW_LABEL}>{name}</span>
      <span className={`${FACT_VALUE} text-right`}>{shown}</span>
    </div>
  )
}

/**
 * Where the selection sits in a segmented control, as static classes.
 *
 * A thumb that slides has to know which of N it is on, and the obvious way to
 * say that is a `style` prop — which `style-src 'self'` throws away silently in
 * the shipped build while working perfectly in dev. So the two or three or four
 * positions a real control ever has are written out and picked from.
 *
 * Indexed by option count, so `THUMB_WIDTH[3]` is the width of one third.
 */
const THUMB_WIDTH: readonly string[] = ["", "w-full", "w-1/2", "w-1/3", "w-1/4"]
const THUMB_OFFSET: readonly string[] = [
  "translate-x-0",
  "translate-x-full",
  "translate-x-[200%]",
  "translate-x-[300%]",
]

/**
 * How wide a control is allowed to get once there is room.
 *
 * Half the course is the right share of a phone and absurd on a tablet: at
 * 1024 the parent area drew a 480 px On/Off pair for a two-word question, and
 * a control that grows without limit is the giveaway that a layout was
 * designed at one width. The cap is per option count, because two words and
 * four words do not want the same box, and it applies from `sm` up only —
 * below that half a phone is already the tight case, not the loose one.
 */
const TRACK_MAX: readonly string[] = [
  "",
  "sm:max-w-[9rem]",
  "sm:max-w-[12rem]",
  "sm:max-w-[18rem]",
  "sm:max-w-[24rem]",
]

/**
 * A choice, drawn as every option at once.
 *
 * Never a switch: a switch carries its state in a position and a colour, and
 * both are invisible to a screen reader that has not been told, and to anyone
 * reading a monochrome screen. `aria-pressed` is the state, the index mark is
 * the sighted signal, and the chosen option's own word is always visible.
 *
 * Drawn the way every platform draws one — **a recessed track with a raised
 * thumb in it**. The whole app used to draw it inverted: the chosen option got
 * the darker ground and the unchosen ones the lighter, so the option you had
 * not picked looked like the pressable key and the one you had looked like a
 * hole. The thumb slides on the detent curve rather than swapping, because a
 * hard swap gives a control no physical account of itself.
 *
 * `<div role="group">` rather than `<fieldset><legend>`: a legend is laid out
 * in the fieldset's border area with its own padding rules, so the gap between
 * a label and the control it labels could not be `--dw-label-gap` no matter
 * what was written.
 *
 * The index mark is always rendered and fades rather than being inserted. A
 * mark that appears into flow shifts its own label sideways the moment it is
 * chosen, which is the "text that jumps as state changes" defect. It is drawn
 * in the accent, not the index: the brand allows **one** warm point per screen
 * and on these screens that one is the navigation's diamond, not six of these.
 */
function Choice({ name, value, options, choose }: Keyless<"choice">) {
  const labelId = useId()
  const count = options.length
  const sliding = count >= 2 && count < THUMB_WIDTH.length
  const chosen = options.findIndex((option) => option.value === value)

  // A two-way control sits on the row beside its label at every width — which
  // is where a choice row becomes exactly the same 64 px object as a fact row,
  // and Settings stops alternating between two rhythms down the screen. Three
  // options do not fit a phone's half-row without truncating a word, so those
  // take a line of their own until there is room, and take the row's rhythm
  // with them: same padding, same label gap, same rules.
  const stacks = count > 2
  const rowCls = stacks
    ? `${ROW_STACKED} gap-label sm:flex-row sm:items-center sm:gap-row-gap sm:py-0`
    : ROW

  return (
    <div role="group" aria-labelledby={labelId} className={rowCls}>
      <span id={labelId} className={`${ROW_LABEL} ${stacks ? "sm:flex-1" : "flex-1"}`}>
        {name}
      </span>
      {/* `p-1` is `--dw-space-1`: the gutter that makes the thumb read as a
          thumb sitting in a track rather than as a lid on top of it. */}
      <div
        className={[
          "dw-sunk rounded-cut-md shrink-0 p-1",
          stacks ? "w-full sm:w-1/2" : "w-1/2",
          TRACK_MAX[count] ?? "",
        ].join(" ")}
      >
        {/* No padding of its own, so it is the exact containing block the
            absolutely-positioned thumb measures its width against. */}
        <div className="relative flex">
          {sliding && chosen >= 0 ? (
            <span
              aria-hidden="true"
              className={[
                "dw-raised rounded-cut-sm pointer-events-none absolute inset-y-0 start-0",
                THUMB_WIDTH[count],
                THUMB_OFFSET[chosen],
                "transition-transform duration-[var(--dw-motion-detent)] ease-[var(--dw-ease-detent)]",
              ].join(" ")}
            />
          ) : null}
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  choose(option.value)
                }}
                className={[
                  "dw-press px-inset min-h-target relative z-10 flex flex-1 basis-0 items-center justify-center text-sm",
                  !sliding && active ? "dw-raised rounded-cut-sm" : "",
                  active ? "text-ink" : "text-ink-muted",
                ].join(" ")}
              >
                {/* Out of flow, in the segment's own padding. In flow — even at
                    zero opacity, which is what reserving its space means — the
                    mark pushed every label about 6 px right of its cell's
                    optical centre, on every segment of every control. Absolute
                    keeps the label centred AND keeps nothing moving when the
                    choice changes, which was the point of reserving it. */}
                <IndexMark
                  className={[
                    "text-accent pointer-events-none absolute start-[var(--dw-space-1)] top-1/2 -translate-y-1/2",
                    "transition-opacity duration-[var(--dw-motion-quick)]",
                    active ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                />
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * A thing this row does.
 *
 * Plain actions are drawn in the accent ink, because a row that is a control
 * and a row that is a fact must not look the same — "Add a learner" used to be
 * the same colour as "Learners 3" with an invisible index mark reserving 44 px
 * of gutter in front of it, which is where the audit's three different left
 * edges on one screen came from. The gutter is gone; every label on every
 * screen now starts at the same x.
 *
 * Destructive is the exception, and it is deliberately a different object: a
 * bounded plate, centred, in the rose the palette owns for a strike. Armed, it
 * fills with the strike wash and takes the strike line — so the press that
 * actually erases is made against a control that has visibly changed state,
 * while the label swaps in place and nothing above or below it moves.
 */
function Action({ name, tone, run, armed }: Keyless<"action"> & { armed: boolean }) {
  if (tone !== "danger") {
    return (
      <button type="button" onClick={run} className={`${ROW} dw-press text-accent-ink text-start`}>
        <span className={ROW_LABEL}>{name}</span>
      </button>
    )
  }

  // The plate sits INSIDE the row rather than being it, so the row's own
  // padding stays clear above and below and the frame does not come within a
  // hairline of the rule belonging to the control above it.
  return (
    <div className={ROW}>
      <button
        type="button"
        // The armed state is a state, not a spelling. Without this the only
        // thing that changed on a press was the control's own NAME — a silent
        // rename of the thing a screen reader has focused, with no live region
        // and no announcement, and the opposite convention to the Remove
        // button two screens away, which has carried `aria-pressed` all along.
        aria-pressed={armed}
        onClick={run}
        className={[
          "dw-press rounded-cut-md px-inset min-h-target text-strike hover:bg-strike-ground",
          "flex w-full items-center justify-center border",
          // `line-strong` at rest, not `line`. Measured in light, the plate's
          // border and the hairline between two ordinary rows were the same
          // rgb(201 188 236) — so the "bounded plate" the design calls for was
          // bounded by the same line a list separator is drawn with, and did
          // not read as bounded at all. It does in dark, which is how it was
          // missed.
          armed ? "border-strike-line bg-strike-ground" : "border-line-strong",
        ].join(" ")}
      >
        <span className={ROW_LABEL}>{name}</span>
      </button>
    </div>
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
 *
 * All three of those live at the **trailing** end. Drawn at the leading end the
 * mark indented the current learner's name by 44 px and left the other two
 * flush, so one screen had two left edges and the name field had two different
 * widths. Here every name starts where every other row's label starts, and the
 * trailing controls line up in a column: the "Use" button is still laid out for
 * the current learner, just invisible and out of the tab order, because
 * reserving the space is what stops the row reflowing when a parent switches.
 *
 * The field is drawn as a recess rather than as an underline. An underlined,
 * transparent, `flex-1` input took its width from whichever siblings happened
 * to be present, so three learners had three different underline lengths, and
 * nothing about it said "you may type here".
 *
 * Removing a learner takes two presses. It erases a child's whole record and it
 * sits a finger's width from "Use"; two rows away in the parent area the
 * *less* destructive "Erase everything" is already armed before it fires. The
 * armed plate fills solid rose, and `aria-pressed` says so.
 */
function Learner({ name, given, current, use, rename, remove }: Keyless<"learner">) {
  const [armed, arm] = useState(false)

  // All three learner fields used to answer to the same accessible name,
  // "Name", with the child only in the value — so a screen reader read a
  // column of three identical controls. The field is named for its own
  // learner, and "current" is said in words rather than only by an
  // `aria-hidden` diamond, an `aria-current` on a role-less `div` and the
  // ABSENCE of a button.
  const who = given.trim().length > 0 ? given : name

  return (
    <div className={ROW} aria-current={current ? "true" : undefined}>
      {current ? <span className="sr-only">{strings.profiles.current}</span> : null}
      <input
        type="text"
        value={given}
        placeholder={name}
        aria-label={`${strings.profiles.name}: ${who}`}
        onChange={(event) => {
          rename(event.target.value)
        }}
        className="dw-sunk inscription rounded-cut-sm px-inset min-h-target text-ink placeholder:text-ink-muted min-w-0 flex-1"
      />
      <span className="gap-label flex shrink-0 items-center">
        <IndexMark className={current ? "text-accent" : "opacity-0"} />
        <button
          type="button"
          onClick={use}
          disabled={current}
          aria-hidden={current || undefined}
          tabIndex={current ? -1 : undefined}
          className={[
            "dw-press border-line rounded-cut-sm px-inset min-h-target border text-sm",
            current ? "invisible" : "text-ink",
          ].join(" ")}
        >
          {strings.profiles.use}
        </button>
      </span>
      {remove ? (
        <button
          type="button"
          aria-pressed={armed}
          onClick={() => {
            if (armed) {
              arm(false)
              remove()
            } else {
              arm(true)
            }
          }}
          onBlur={() => {
            arm(false)
          }}
          // Quiet at rest, and quiet means QUIET: the muted ink, not the rose.
          // Three learners put three crimson words down one screen — four loud
          // points counting the tab bar's diamond, against a brand rule of one
          // — and they were the loudest thing on the profiles screen, which is
          // a screen about children rather than about deletion. Danger is what
          // the control becomes when it is armed and a second press would
          // actually erase somebody, which is also when it is worth saying.
          className={[
            "dw-press rounded-cut-sm px-inset min-h-target min-w-target shrink-0 text-sm",
            armed
              ? "bg-strike-fill text-on-strike"
              : "text-ink-muted hover:text-strike hover:bg-strike-ground",
          ].join(" ")}
        >
          {/* Both labels, stacked in one grid cell, with the longer one always
              in flow and invisible. The armed word is wider than the resting
              one, and this row's name field is `flex-1` — so a bare label swap
              would take ~20 px off the field a parent is looking at at the
              exact moment they press. Nothing moves; the word still changes. */}
          <span className="grid place-items-center">
            <span aria-hidden="true" className="invisible col-start-1 row-start-1">
              {strings.profiles.removeConfirm}
            </span>
            <span className="col-start-1 row-start-1 whitespace-nowrap">
              {armed ? strings.profiles.removeConfirm : strings.profiles.remove}
            </span>
          </span>
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
 *
 * It is capped at a hand's width on a phone and let out from `sm` up, because
 * this is the screen a child comes to in order to feel something about their
 * own work and it was using a quarter of a tablet. Not the whole measure: at
 * 1024 × 768 — iPad landscape, the shortest wide viewport this app ships to —
 * the full-measure drawing pushed the two rows under it eight pixels past the
 * fold. Measured, then capped one step below it.
 */
function Figure({ value, label }: Keyless<"figure">) {
  return (
    <div className="py-row w-full">
      <WorldScreen
        placed={value}
        label={label}
        className="mx-auto block h-auto w-full max-w-sm sm:max-w-xl"
      />
    </div>
  )
}

/**
 * One row, drawn.
 *
 * Written out rather than spread: a `Row` carries its own `key`, and
 * `<Fact {...row} />` puts that key on the child element, where React logs an
 * error on every render and the key does nothing. The `<li>` above owns the
 * key; the component gets the fields it draws.
 */
function RowView({ row, armed }: { row: Row; armed: boolean }) {
  switch (row.kind) {
    case "fact":
      return <Fact name={row.name} value={row.value} />
    case "choice": {
      const { key, ...rest } = row
      void key
      return <Choice {...rest} />
    }
    case "action": {
      const { key, ...rest } = row
      void key
      return <Action {...rest} armed={armed} />
    }
    case "learner": {
      const { key, ...rest } = row
      void key
      return <Learner {...rest} />
    }
    // A pack is never drawn as a course row. It is a card in the catalogue,
    // which is a grid rather than a list, so the whole section is handed to
    // one component below instead of each row being drawn on its own.
    case "pack":
      return null
    case "figure": {
      const { key, ...rest } = row
      void key
      return <Figure {...rest} />
    }
  }
}

/**
 * One row, and that row does something. Then the section is the footer of the
 * course above it — "Add a learner" under the learners — rather than a course
 * of its own, and on a wide screen it runs the full width instead of taking a
 * column beside the list it belongs to.
 */
function isFoot(section: Section): boolean {
  return section.rows.length === 1 && section.rows[0]?.kind === "action"
}

/** Every row in this section is a game. Then it is a catalogue, not a course. */
function isCatalogue(section: Section): boolean {
  return section.rows.length > 0 && section.rows.every((row) => row.kind === "pack")
}

export function Surface({ destination }: { destination: Destination }) {
  const [armed, arm] = useState(false)
  const view = useHostView(armed)
  const actions = useHostActions(arm)
  const sections = surfaceOf(destination, view, actions)
  const title = strings.destinations[destination]

  // The document had one title, "Dynawalla", on all five routes, and no <h1>
  // anywhere in the app. In a WebView nobody sees a title bar — but assistive
  // technology announces exactly this on a route change, and without it a
  // screen-reader user pressed a tab and heard silence. The heading is the
  // same word the tab is labelled with, so it costs no new copy, and it is
  // drawn nowhere: the tab bar already says where you are, permanently, and
  // two places saying it are two places to disagree.
  useEffect(() => {
    document.title = `${title} — ${strings.appName}`
  }, [title])

  // Two columns of courses on a wide screen — but never for the catalogue,
  // which is one section and would take half the glass and leave the other
  // half empty. `.dw-courses` itself is unconditional: it is the column, and
  // it is what takes the reading measure off a list of rows so that every left
  // edge in the app lands on one x.
  //
  // Deliberately NOT `flex flex-col` beside it. Tailwind utilities live in a
  // later cascade layer than these compositions, so a `flex` utility on the
  // element silently beat `display: grid` and the two-column rule did nothing
  // at all — measured, a settings course at 1440 came back 1104 px wide.
  const wide = sections.every((section) => !isCatalogue(section)) && sections.length > 1

  return (
    <div className={`dw-courses gap-stack ${wide ? "dw-courses-wide" : ""}`}>
      <h1 className="sr-only">{title}</h1>
      {sections.map((section) =>
        isCatalogue(section) ? (
          // The games, as a grid of cards with a search field and the subject
          // chips above them. Full measure: a listing wants columns, and the
          // 42 rem reading measure the courses below are set to would give a
          // desktop three of them.
          <Catalog
            key={section.key}
            rows={section.rows.filter((row) => row.kind === "pack")}
          />
        ) : (
          // A rule above the course and one between every pair of rows, but
          // none under the last: a closing rule plus the next section's opening
          // one reads as a double line at every seam, which is a groove nobody
          // cut.
          //
          // The rule above the course is full bleed — it is the top edge of the
          // group. The rules *between* rows are inset to the text origin, the
          // way every native list draws a separator; a 1 px line running the
          // full width between every pair of rows is a web table. Both are
          // `--dw-hairline`, which is half a pixel on a 2× screen, because a
          // 1 px border on a 3× phone is three device pixels and about three
          // times what the platform draws.
          //
          // Except on the top row of courses, where `.dw-course` in
          // `index.css` takes it away: the strapwork band already draws a
          // horizontal 24 px higher, so every destination at every width
          // opened with two parallel lines a finger apart, one of them
          // structural and the other restating it. The band IS the top edge of
          // the first group. It is done in CSS rather than by index because
          // "the top row" is one course at phone width and two at desktop.
          <ul
            key={section.key}
            className={[
              "dw-course dw-measure dw-hairline-t",
              // A course whose only row is an action is not a peer of the list
              // above it — it is that list's own footer. In two columns without
              // this, "Add a learner" was laid beside the learners rather than
              // under them, level with the first name, reading as a second
              // list with one thing in it.
              isFoot(section) ? "dw-course-span" : "",
            ].join(" ")}
          >
            {section.rows.map((row, index) => (
              <li key={row.key} className="relative">
                <RowView row={row} armed={armed} />
                {index < section.rows.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="dw-hairline-b start-inset pointer-events-none absolute end-0 bottom-0"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}
