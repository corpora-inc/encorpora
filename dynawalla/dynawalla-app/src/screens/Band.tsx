import { Link } from "react-router"

import { Automaton } from "../character/Automaton.tsx"
import { useCharacter } from "../character/store.ts"
import { ANCHOR_CARTOUCHE } from "../design/anchors.ts"
import { destinationPath } from "../app/routes.ts"
import { strings, fill } from "../app/strings.ts"
import { Cartouche } from "../world/Cartouche.tsx"
import { worldStore } from "../world/live.ts"

/**
 * The band above the work: a window onto the world, cut into the wall.
 *
 * Three things live in it and its height never changes because of any of them.
 * The Dynawalla is at the left, present and usually silent. The rosette on the
 * bench is at the right, one aperture further along than it was before the last
 * correct answer. Between them is carved stone — empty most of the time, and
 * the place his line is cut when he has one.
 *
 * **The empty middle is the design, not a gap.** A remark that pushed the slate
 * down the screen would be the jolting reflow the design rules forbid outright,
 * and a remark with nowhere reserved for it would have to be a toast. Reserving
 * the room permanently costs 72 px and buys a character who can speak without
 * the work surface moving a pixel.
 *
 * **A fixed height, not a minimum.** The first cut used `min-h-16`, which held
 * at 390 px and 360 px and then grew from 64 px to 67.5 px at 320 px, where the
 * text column is only 160 px and the longest line takes three lines — a 3.5 px
 * shift of everything below, on the rarest and most deliberate moment in the
 * product. Reserving three lines at the narrowest width we ship to, as a fixed
 * height, is what makes "the band never moves the work" structural rather than
 * true at the widths somebody happened to check. The line clamps if a
 * translation overruns it: a clipped line is a bug to fix in the translation,
 * and a taller band is a bug in the work surface.
 *
 * Fixed at each viewport, not fixed forever: `--dw-band-height` comes down a
 * rung under 720 px of viewport height, where the surface below it did not fit
 * on screen at all. It cannot change while the child is working — only a
 * rotation or a resize moves it — so the promise it makes to the work surface
 * is unaffected. Two lines of clamp there instead of three.
 *
 * It is also the reaction stage's `cartouche` anchor — the region the ENGAGE
 * and ILLUMINATE effects play in. The marker class does nothing else.
 */
export function Band() {
  const placed = worldStore((state) => state.placed)
  const utterance = useCharacter((state) => state.utterance)

  return (
    <div
      className={`${ANCHOR_CARTOUCHE} border-t-line-cut border-b-line bg-ground-raised mb-[var(--dw-stack-gap-tight)] flex h-[var(--dw-band-height)] items-center gap-3 overflow-hidden border-t border-b px-3 py-2`}
    >
      <Automaton speaking={utterance !== null} />

      {/* Always in the layout, empty or not, and the one live region up here.
          Announced when it changes; silent — and zero-height contribution —
          when there is nothing to say. */}
      <p
        role="status"
        className="text-ink-muted inscription line-clamp-3 min-w-0 flex-1 text-xs leading-snug tracking-wide"
      >
        {utterance === null ? null : <span className="dw-utterance">{utterance.line}</span>}
      </p>

      {/* The way through to the whole screen. Progress is persisted card by
          card, so leaving mid-session and coming back resumes rather than
          restarts — which is what makes it safe to put a door here at all.

          The label carries the count. An explicit `aria-label` on an ancestor
          wins the accessible-name computation outright, so the Cartouche's own
          "{{apertures}} apertures cut." was computed and then discarded — the
          only always-visible representation of the construction, and a screen
          reader on this surface never heard it change. No new string: it is the
          destination's name and the world's one text alternative, joined.

          The target is the padding, not the drawing. `size-11` is 44 px on a
          surface whose keypad sets the bar at 76; stretching the link to the
          band's full height and padding it out makes the hit box 68 × 72 — a
          99 px diagonal, 2.6 cm — while the rosette stays the size it reads
          at. It cannot be taller than the band, and the band is fixed. */}
      <Link
        to={destinationPath("world")}
        aria-label={`${strings.destinations.world}: ${fill(strings.world.cut, { apertures: placed })}`}
        className="rounded-cut-sm -mr-1 -my-2 flex shrink-0 items-center self-stretch px-3"
      >
        <Cartouche placed={placed} className="size-11" />
      </Link>
    </div>
  )
}
