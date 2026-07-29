import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"

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
 * The "go" mark on a card, and the app's smallest piece of line art.
 *
 * Monoline from `currentColor`, like the mark in the lintel: the card says
 * "Play", and this is the direction the word points. Purely decorative — the
 * word beside it is the label, and a chevron that also announced itself would
 * say it twice.
 */
function Chevron() {
  return (
    <svg
      viewBox="0 0 8 12"
      aria-hidden="true"
      focusable="false"
      className="h-3 w-2 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 1.5 L6.5 6 L2 10.5" />
    </svg>
  )
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
 * **It is drawn as an object, not as a bordered rectangle.** `.dw-surface` is
 * the elevation rung for a card and carries its background, its edge and its
 * cast light together; before it, a light-theme card was white on near-white
 * inside a rule at 1.06:1, so the near-black key art read as the object and
 * the card read as nothing at all.
 *
 * **`.dw-press` is the whole of the press feedback**, and it is the reason a
 * hover-only transform was wrong: on a phone there is no hover, so a tile that
 * only answered a pointer answered a child not at all. The scale runs on the
 * 90 ms press curve and the colour on the state curve — different events,
 * different timings — and both collapse under reduced motion.
 *
 * **`resting` is not a lock and is not drawn as one.** A game that already
 * reached its stopping point today keeps its full-strength artwork, its
 * full-strength name and its working control; the only difference is that the
 * small print says "Tomorrow" in the muted ink rather than "Play" in the
 * accent, and loses the chevron. No padlock, no "premium", no dimming, and it
 * is not sorted to the bottom. What the press opens is the sheet that says so,
 * which is a fact about the child's day rather than a price.
 */
function Card({ row, active }: { row: PackRow; active: DomainId | null }) {
  const grades = gradeLabel(row.grades)
  const domains = domainsOf(row.skills)
  // Lead with the subject the child actually filtered by. Taking `domains[0]`
  // instead meant a card answering a Multiplication filter labelled itself
  // "Addition & subtraction", because DOMAIN_IDS is in teaching order and `add`
  // sorts before `mul` — the card contradicted the filter that produced it.
  //
  // Two chips, not one: 126 of the 164 skills shipped are `dw.add`, so a single
  // first-domain chip printed "Addition & subtraction" on twenty-two of the
  // twenty-seven cards and told a reader nothing. The second chip is where the
  // games differ.
  const ordered =
    active !== null && domains.includes(active)
      ? [active, ...domains.filter((domain) => domain !== active)]
      : domains
  const subjects = ordered.slice(0, 2)

  return (
    <button
      type="button"
      onClick={row.play}
      className={[
        // `h-full` inside a stretched grid cell, with the small print pushed to
        // the bottom by `mt-auto`: every card in a row ends at the same line
        // whatever its name and description did. That was never sufficient on
        // its own — see the reserved boxes in `catalog.css` — but it is still
        // the floor under them.
        "dw-press dw-surface rounded-cut-lg flex h-full w-full flex-col overflow-hidden text-left",
        // Tailwind's `hover:` is already scoped to `(hover: hover)`, so this
        // cannot become the stuck-hover tell on a tablet. The card rises a rung
        // under a pointer; under a finger `.dw-press` scales it instead.
        "hover:border-line-strong hover:shadow-raised focus-visible:border-line-strong",
      ].join(" ")}
    >
      <PackArt packId={row.id} className="aspect-square" />
      <span className="p-inset flex flex-1 flex-col gap-1">
        {/* Clamped, never truncated. At the grid's narrowest column half these
            names are longer than the card — COUNTERPOISE, THE COIL OF
            NINETY-SIX — and one line with an ellipsis turns a listing of games
            into a listing of prefixes. Two lines fits every name shipped, and
            `.dw-card-title` reserves both of them whether or not the name needs
            the second, so the blurb under it starts at the same y on every card
            in a row.

            No `block` on either of these: `line-clamp-*` works by setting
            `display: -webkit-box`, and a `block` utility beside it silently
            wins and un-clamps the text. That is exactly how this shipped once,
            with descriptions running eleven lines deep. */}
        {/* The real fix for a long name is a column wide enough to hold it, not
            a cleverer way to break it — see the grid below, whose 10.5rem is
            measured against the longest word shipped at this exact size.

            15px, not 16px: at 16px COUNTERWEIGHT needs 152px and even a 10.5rem
            column offers 142px, so the one-word-too-wide case would still fire.
            `.dw-caps` is deliberately NOT used here for the same reason — its
            0.09em tracking adds about 13px to that word and puts it back over
            the column — even though these names do arrive from the manifests
            already in capitals.

            `hyphens-auto` is kept as a courtesy for real devices, but it is NOT
            load-bearing and must not be relied on — headless Chrome ships no
            hyphenation dictionary, so it silently does nothing there, which is
            how a fix that "worked" was measured as still broken. `break-words`
            is the last resort that keeps a freak name inside its card rather
            than over the top of the next one. */}
        <span className="dw-card-title inscription text-ink line-clamp-2 hyphens-auto text-[0.9375rem] tracking-wide break-words">
          {row.name}
        </span>
        {/* Rendered whether or not there is a description. A card whose blurb is
            missing keeps the same shape as the card beside it, which is what "a
            grid reads as a grid" costs; every pack shipped has one, so in
            practice the reserve is never blank. */}
        <span className="dw-card-blurb text-ink-muted line-clamp-2 text-xs">
          {row.description}
        </span>
        <span className="mt-auto flex flex-col gap-1 pt-2">
          <span className="dw-card-subjects flex flex-wrap content-start items-start gap-1">
            {subjects.map((domain) => (
              <span
                key={domain}
                className="dw-card-chip border-line text-accent-ink rounded-cut-sm border px-1.5 text-xs"
              >
                {domainName(domain)}
              </span>
            ))}
          </span>
          {/* The band on the left, the control on the right, on one line at the
              same height on every card. "Play" used to sit inside the same
              muted run as the grade band, so the one word saying the tile does
              anything was the least visible thing on it and read as part of a
              metadata string. It is the accent now, and it points. */}
          <span className="flex items-center justify-between gap-2">
            <span className="numeral text-ink-muted text-xs">{grades ?? ""}</span>
            {row.resting ? (
              <span className="text-ink-muted text-xs">{strings.packs.tomorrow}</span>
            ) : (
              <span className="text-accent-ink flex items-center gap-1 text-xs">
                {strings.packs.play}
                <Chevron />
              </span>
            )}
          </span>
        </span>
      </span>
    </button>
  )
}

/**
 * Which edges of a sideways-scrolling rail still have content beyond them.
 *
 * A permanent fade on both ends of a carousel is a decoration and says
 * nothing. A fade that appears exactly where content passes under it, and is
 * absent where the row has ended, is the signal every native carousel uses —
 * and its absence is how you know you have reached the end. That cannot be
 * done in CSS alone before scroll-driven animations, and this bundle's floor
 * is iOS 16, so it is a dozen lines of measurement written onto the element as
 * data attributes for `catalog.css` to react to. Never a `style` prop:
 * `style-src 'self'` throws one away in the shipped build.
 */
function useRailEdges(signal: unknown) {
  const rail = useRef<HTMLDivElement | null>(null)
  const [edges, setEdges] = useState({ lead: false, trail: false })

  const measure = useCallback(() => {
    const box = rail.current
    if (!box) return
    const over = box.scrollWidth - box.clientWidth
    // The rail carries a 4 px gutter so a chip's raised edge and its focus ring
    // are not clipped, and `scroll-snap-type: x proximity` rests the browser
    // AT the first chip's snap position — which is `scrollLeft: 4`, not 0.
    // Measured live at both 390 and 834, untouched, on first paint. Against a
    // flat `> 1` that lit the leading dissolve at rest and faded out the "All"
    // chip: the selected chip lost its left border and its plate dissolved
    // into the ground, on the front door, in both themes, before anyone had
    // touched anything. The gutter is not content that continues, so the
    // question is whether the rail has scrolled past its own first chip.
    const gutter = (box.firstElementChild as HTMLElement | null)?.offsetLeft ?? 0
    // A whole pixel of slack on top: sub-pixel layout leaves `scrollLeft` a
    // fraction short of the end on a 2× screen, which would otherwise fade an
    // edge that has nothing behind it, forever.
    const lead = box.scrollLeft > gutter + 1
    const trail = over - box.scrollLeft > 1
    setEdges((was) => (was.lead === lead && was.trail === trail ? was : { lead, trail }))
  }, [])

  useEffect(() => {
    const box = rail.current
    if (box === null) return
    measure()
    // The box and its children both: the rail's own width changes on rotation,
    // and the chips' widths change when the text-size setting does. Either one
    // alone leaves the fade describing a layout that is no longer on screen.
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    for (const child of Array.from(box.children)) observer.observe(child)
    return () => {
      observer.disconnect()
    }
  }, [measure, signal])

  return { rail, edges, measure }
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

  const { rail, edges, measure } = useRailEdges(chips)

  // Bring the chosen subject into view.
  //
  // Without this the rail is a control whose state you cannot see: filtering by
  // Fractions on a 390 px phone leaves "All / Number sense / Addition &
  // subtraction" on screen with none of them lit, because the chip that IS lit
  // is 400 px off the right. Every native segmented rail reveals its selection;
  // this reveals it to just clear of the edge dissolve rather than centring it,
  // so a chip that is already comfortably visible does not move at all.
  useEffect(() => {
    const box = rail.current
    if (box === null) return
    const chosen = box.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (chosen === null) return
    // `--dw-space-5`, which is the width of the dissolve in `catalog.css`. Read
    // through the root font size rather than written as 24, so it stays correct
    // when the accessibility text-size setting scales the root.
    const clear = 1.5 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
    const start = chosen.offsetLeft - box.scrollLeft
    const end = start + chosen.offsetWidth
    let next = box.scrollLeft
    if (start < clear) next = chosen.offsetLeft - clear
    else if (end > box.clientWidth - clear)
      next = chosen.offsetLeft + chosen.offsetWidth - box.clientWidth + clear
    if (Math.abs(next - box.scrollLeft) < 1) return
    // The CSS reduced-motion block forces `scroll-behavior: auto`, but a
    // `behavior` passed to `scrollTo` is an argument rather than a computed
    // style and wins over it — so the branch has to be taken here too. Both
    // sources are asked, because the in-app switch exists for a child whose
    // tablet belongs to somebody else.
    const still =
      document.documentElement.dataset["motion"] === "reduced" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    box.scrollTo({ left: Math.max(0, next), behavior: still ? "auto" : "smooth" })
  }, [rail, active])

  const clearAll = () => {
    setQuery("")
    setSubject(null)
  }

  return (
    <section className="gap-stack-tight flex flex-col">
      <label htmlFor={searchId} className="sr-only">
        {strings.catalog.find}
      </label>
      {/* A search field is a recess, which is what every platform draws and
          what the elevation ladder calls `.dw-sunk`. It used to be drawn a rung
          ABOVE the page, so the one control on the screen that receives
          something looked like the controls that do something.

          The glyph and the clear control are inside the shell rather than
          beside it, so the whole box is one object: a tap in the padding still
          lands in the field, which is how a native search bar behaves and how a
          child aims at one. */}
      <div className="dw-find dw-sunk rounded-cut-md min-h-target-comfort flex items-center gap-2 px-3">
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
          className="text-ink-muted h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M12.6 12.6 L17 17" />
        </svg>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={strings.catalog.find}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="text-ink placeholder:text-ink-muted min-w-0 flex-1 self-stretch border-0 bg-transparent text-base"
        />
        {query.length > 0 ? (
          // WebKit draws its own cancel button at about 14 px, off-palette and
          // under a third of the touch floor; `catalog.css` suppresses it and
          // this is the replacement, at 44.
          <button
            type="button"
            // The field, and only the field. This used to run `clearAll` under
            // the accessible name "All" — so a screen reader announced the ✕ as
            // "All", and a parent who had filtered to Fractions and then tapped
            // the ✕ silently lost the filter too, with nothing on screen to say
            // it had gone.
            onClick={() => {
              setQuery("")
            }}
            aria-label={strings.catalog.clear}
            className="dw-press text-ink-muted rounded-cut-sm -mr-2 flex h-target w-target shrink-0 items-center justify-center"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              focusable="false"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M5 5 L15 15 M15 5 L5 15" />
            </svg>
          </button>
        ) : null}
      </div>

      {chips.length > 1 ? (
        // A scrolling rail rather than a wrapping block: on a 320 px phone six
        // subjects wrap to three lines and push the first card off the screen,
        // and the first card is the whole point of the screen.
        //
        // Two elements, and the nesting is load-bearing: the OUTER one carries
        // the edge dissolve, because Chrome sizes a mask on a scroll container
        // against its scrollable overflow rather than against the box you can
        // see — on one element the fade landed 450 px off the right of a phone
        // and the rail clipped stone dead instead. The INNER one scrolls, with
        // `.dw-scroll-x` for momentum, containment and proximity snapping and
        // `.dw-rail` to take the bar away on EVERY pointer; a desktop was
        // painting a horizontal channel between the search field and the grid.
        <div
          data-lead={edges.lead ? "on" : "off"}
          data-trail={edges.trail ? "on" : "off"}
          className="dw-subjects -mx-1"
        >
          <div ref={rail} onScroll={measure} className="dw-scroll-x dw-rail flex gap-2 px-1 pb-1">
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
        </div>
      ) : null}

      {listed.length === 0 ? (
        /* Designed, not a fallback. A centred monoline aperture in the accent —
           the same single stroke weight as the mark and as the key art — the
           one line of prose the catalogue owns, and the way back. The way back
           matters most: this state is reachable from the search field, from a
           subject chip, or from both at once, and a child who cannot see which
           one caused it needs one control that undoes all of them. */
        <div className="dw-anim-fade gap-stack flex flex-col items-center py-8 text-center">
          {/* An empty niche: the arch this app's mark is built on, cut twice
              and with nothing standing in it. Sized to be seen on a desktop —
              at 48px in a 1152px column it read as a stray glyph rather than
              as the subject of the screen. */}
          <svg
            viewBox="0 0 48 48"
            aria-hidden="true"
            focusable="false"
            className="text-accent h-16 w-16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 42 V24 C10 14 16 7 24 2 C32 7 38 14 38 24 V42" />
            <path d="M5 42 H43" />
            <path d="M16 42 V25 C16 18 19 13 24 9 C29 13 32 18 32 25 V42" opacity="0.4" />
          </svg>
          <p className="dw-measure text-ink text-md">{strings.catalog.nothing}</p>
          <button
            type="button"
            onClick={clearAll}
            className="dw-press dw-raised text-ink rounded-cut-sm min-h-target min-w-target px-5 text-base"
          >
            {strings.catalog.showAll}
          </button>
        </div>
      ) : (
        /* The floor is measured; the ceiling is a decision.

           10.5rem, not 8.5rem: the longest single word shipped is
           COUNTERWEIGHT, which at the title's 15px needs 142px of text box, and
           an 8.5rem column offers 110px. A word wider than its column cannot be
           wrapped, only broken or clipped, which is how "COUNTERPOI / SE"
           reached a desktop screen. 10.5rem gives 142px — exactly enough — and
           still fits two columns on a 390px phone.

           But a floor is not a ceiling, and `auto-fill` alone treated a desktop
           as a phone with more room: at 1440 it drew six ~170px columns of
           twenty-seven postage stamps. A wide screen deserves FEWER, LARGER
           cards. The counts below are chosen against the 1152px frame the shell
           caps at, and each is checked against the same COUNTERWEIGHT budget:

             ≤ 639   auto-fill  →  2 columns at 390 (172px wide, 148px of text)
             640     3 columns  →  192px  (168px of text)
             768     4 columns  →  172px  (148px of text — the tightest rung)
             1024    4 columns  →  237px
             1280+   4 columns  →  265px, and no wider: the frame stops at 1152

           **Four is the last step, and a fifth was tried and removed.** With
           `xl:grid-cols-5` a 1440px screen drew 211px cards while a 1024px iPad
           drew 237px ones — a card that gets SMALLER as the screen gets bigger,
           which is the same defect as the six-column desktop wearing a
           different number. Above 1152 the frame stops growing, so a column
           added there can only take width away.

           The `key` remounts the grid when the SUBJECT changes, so the new
           listing fades in rather than being swapped in one frame — the filter
           explains what it did. Deliberately not keyed on the query: a
           cross-fade on every keystroke is decoration, and this app does not
           animate for the sake of it. */
        <ul
          key={active ?? "all"}
          className="dw-anim-fade gap-grid grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] sm:grid-cols-3 md:grid-cols-4"
        >
          {listed.map((row) => (
            <li key={row.key} className="min-w-0">
              <Card row={row} active={active} />
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
 *
 * **Drawn the way every platform draws a selection: raised.** It used to be
 * `bg-ground-sunk`, i.e. the chosen subject was a hole in the page and the five
 * unchosen ones were the things that looked pressable. The chosen chip is now
 * the elevation rung above the page and the others are transparent, which is
 * the iOS segmented control and the Android toggle group both.
 *
 * `min-w-target` is not cosmetic: "All" is a short word, and at `px-3` it
 * measured 42.1 px on the axis it is thinnest — under the touch floor, on the
 * one control that clears the filter.
 */
function Chip({ label, on, press }: { label: string; on: boolean; press: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={press}
      className={[
        "dw-press rounded-cut-sm min-h-target min-w-target shrink-0 snap-start border px-3 text-sm whitespace-nowrap",
        on ? "dw-raised border-line-strong text-ink" : "border-line text-ink-muted bg-transparent",
      ].join(" ")}
    >
      {label}
    </button>
  )
}
