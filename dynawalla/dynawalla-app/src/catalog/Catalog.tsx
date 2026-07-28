import { useId, useMemo, useState } from "react"

import { fill, strings } from "../app/strings.ts"
import type { Row } from "../shell/surfaces.ts"
import { chipsFor, domainName, domainsOf, type DomainId } from "./domains.ts"
import { PackArt } from "./PackArt.tsx"

type PackRow = Extract<Row, { kind: "pack" }>

/** Case- and accent-insensitive enough for a child hunting for "serpent". */
const folded = (text: string): string => text.toLocaleLowerCase()

/** The band a game is written for, or nothing at all — never "Grades ?–?". */
function gradeLabel(grades: readonly [number, number] | null): string | null {
  if (grades === null) return null
  const [from, to] = grades
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return fill(strings.catalog.grades, { from, to })
}

/**
 * One game, as a card.
 *
 * A familiar listing tile: square key art on top, the name, one line about it,
 * and its small print. The whole tile is the button — a child aiming at a word
 * is a child missing — and at the grid's narrowest column it is still 140 px
 * of art plus a label, which clears the child-sized target floor several times
 * over.
 *
 * **`resting` is not a lock and is not drawn as one.** A game that already
 * reached its stopping point today keeps its full-strength artwork, its
 * full-strength name and its working control; the only difference is one word
 * in the small print, in the same type as the version. No padlock, no
 * "premium", no dimming, and it is not sorted to the bottom. What the press
 * opens is the sheet that says so, which is a fact about the child's day
 * rather than a price.
 */
function Card({ row }: { row: PackRow }) {
  const grades = gradeLabel(row.grades)
  const domains = domainsOf(row.skills)
  const subject = domains[0]

  return (
    <button
      type="button"
      onClick={row.play}
      className={[
        // `h-full` inside a stretched grid cell, with the small print pushed to
        // the bottom by `mt-auto`: every card in a row ends at the same line
        // whatever its name and description did, which is what makes a grid
        // read as a grid rather than as a ragged pile.
        "group border-line bg-ground-raised rounded-cut-lg flex h-full w-full flex-col overflow-hidden border text-left",
        "hover:border-line-strong focus-visible:border-line-strong",
        "transition-colors duration-[var(--dw-motion-quick)]",
      ].join(" ")}
    >
      <PackArt packId={row.id} className="aspect-square" />
      <span className="flex flex-1 flex-col p-3">
        {/* Clamped, never truncated. At the grid's narrowest column half these
            names are longer than the card — COUNTERPOISE, THE COIL OF
            NINETY-SIX — and one line with an ellipsis turns a listing of games
            into a listing of prefixes. Two lines fits every name shipped.

            No `block` on either of these: `line-clamp-*` works by setting
            `display: -webkit-box`, and a `block` utility beside it silently
            wins and un-clamps the text. That is exactly how this shipped once,
            with descriptions running eleven lines deep. */}
        {/* `break-words` because a clamp cannot help a single word wider than
            the column: COUNTERPOISE on a 136 px card overflowed and was
            clipped mid-word with no ellipsis to say so. */}
        <span className="inscription text-ink line-clamp-2 text-base tracking-wide break-words">
          {row.name}
        </span>
        {row.description.length > 0 ? (
          <span className="text-ink-muted mt-1 line-clamp-2 text-xs">{row.description}</span>
        ) : null}
        <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
          {subject ? (
            <span className="border-line text-accent-ink rounded-cut-sm border px-1.5 py-0.5 text-[0.6875rem]">
              {domainName(subject)}
            </span>
          ) : null}
          {grades ? <span className="numeral text-ink-muted text-[0.6875rem]">{grades}</span> : null}
          <span className="numeral text-ink-muted text-[0.6875rem]">
            {row.resting ? strings.packs.tomorrow : strings.packs.play}
          </span>
        </span>
      </span>
    </button>
  )
}

/**
 * The catalogue: every installed game, as a listing.
 *
 * A familiar game-portal grid, on purpose. The founder's instruction was
 * "regular cards like a familiar listing with artwork/logo for each game …
 * nice normal square cards", and the pass before this one drew arch-shaped
 * niches with near-identical ornaments in them and was rejected. The brand
 * lives in the chrome around this — the violet ground, the mark in the header,
 * the accent — and in the ART, never in the silhouette of a card.
 *
 * **Search and subject are view state and live here, not in the surface
 * model.** `packsSurface` describes every installed pack unconditionally; this
 * component narrows the rows it was handed. That is what keeps "no destination
 * is ever empty" a property of the model rather than a thing that happens to
 * be true while nobody has typed in the box.
 */
export function Catalog({ rows }: { rows: readonly PackRow[] }) {
  const [query, setQuery] = useState("")
  const [subject, setSubject] = useState<DomainId | null>(null)
  const searchId = useId()

  // Derived from the manifests of what is actually installed, every render.
  // Never a hardcoded list: this catalogue went from eighteen games to
  // twenty-seven in an afternoon, and a table would have been stale first.
  const chips = useMemo(() => chipsFor(rows), [rows])

  const listed = useMemo(() => {
    const needle = folded(query.trim())
    const kept = rows.filter((row) => {
      if (subject !== null && !domainsOf(row.skills).includes(subject)) return false
      if (needle.length === 0) return true
      return folded(`${row.name} ${row.description}`).includes(needle)
    })
    // `sort` on a copy rather than `toSorted`: this bundle's floor is iOS 16.0
    // and the change-array-by-copy methods land in 16.4, where the failure is
    // a thrown TypeError on the front door of the app rather than a fallback.
    return [...kept].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, query, subject])

  // A subject that stops existing — the last pack covering it was removed —
  // must not leave the grid filtered by a chip that is no longer on screen.
  const active = subject !== null && chips.includes(subject) ? subject : null

  return (
    <section className="flex flex-col gap-[var(--dw-stack-gap-tight)]">
      <label htmlFor={searchId} className="sr-only">
        {strings.catalog.find}
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={strings.catalog.find}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={[
          "border-line bg-ground-raised text-ink rounded-cut-md min-h-12 w-full border px-3 text-base",
          "placeholder:text-ink-muted",
        ].join(" ")}
      />

      {chips.length > 1 ? (
        // A scrolling row rather than a wrapping block: on a 320 px phone six
        // subjects wrap to three lines and push the first card off the screen,
        // and the first card is the whole point of the screen.
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip label={strings.catalog.all} on={active === null} press={() => setSubject(null)} />
          {chips.map((domain) => (
            <Chip
              key={domain}
              label={domainName(domain)}
              on={active === domain}
              press={() => setSubject(active === domain ? null : domain)}
            />
          ))}
        </div>
      ) : null}

      {listed.length === 0 ? (
        <p className="text-ink-muted py-8 text-center text-sm">{strings.catalog.nothing}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 sm:gap-4">
          {listed.map((row) => (
            <li key={row.key} className="min-w-0">
              <Card row={row} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * A subject filter.
 *
 * `aria-pressed` carries the state, and so does the border and the ink — never
 * a colour alone, which is the same rule the rest of this shell is drawn to.
 */
function Chip({ label, on, press }: { label: string; on: boolean; press: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={press}
      className={[
        "rounded-cut-sm min-h-11 shrink-0 border px-3 text-sm whitespace-nowrap",
        "transition-colors duration-[var(--dw-motion-quick)]",
        on ? "border-line-strong bg-ground-sunk text-ink" : "border-line text-ink-muted",
      ].join(" ")}
    >
      {label}
    </button>
  )
}
