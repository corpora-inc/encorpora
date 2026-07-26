import { ANCHOR_APERTURE } from "../design/anchors.ts"
import { strings, fill } from "../app/strings.ts"
import { cellCutAt, rosetteCells, ROSETTE } from "./rosette.ts"
import { rosetteOnBench } from "./construction.ts"

const CENTRE = { x: ROSETTE.radius + 1, y: ROSETTE.radius + 1 }
const SPAN = (ROSETTE.radius + 1) * 2
const CELLS = rosetteCells(CENTRE)

/**
 * The rosette on the bench: the one the child is cutting right now.
 *
 * The uncut apertures are drawn as incised outlines, not omitted. A mason works
 * to a plan, and showing it is the difference between a shape assembling and a
 * meter filling — the child can see what the next answer does before they give
 * it, and can see the star close at ten and the ring close at twenty without
 * anything counting at them.
 *
 * Bounded at forty nodes, forever: twenty outlines and at most twenty cut
 * cells. The world view has a different job and a different budget
 * (`construction.ts`).
 *
 * The newest aperture carries the reaction layer's anchor class, which is how
 * the stage knows where on screen to put the light without the reaction layer
 * ever knowing what a rosette is.
 *
 * ## The rim is heavier here than in the world view, and that is the point
 *
 * This drawing ships at 44 px. The rosette's radius is 10 units, so a span of
 * 22 units renders at two pixels per unit — and a 0.35-unit rim is 0.7 of a
 * device-independent pixel, which is not a line, it is a suggestion. In dark,
 * where the cut fill and the band it is cut into were two steps of the same
 * basalt, that rim was the whole of the difference between a cut cell and an
 * uncut one, and it was not carrying it: at 44 px the cartouche read as
 * outlines with no discernible change from one aperture to nineteen. The world
 * view draws the same geometry five to twelve times larger and keeps the fine
 * rim; this one gets 0.45 units, because the size a thing is drawn at is part
 * of the drawing.
 *
 * 0.45, and not more, is a rendered decision rather than a computed one. A
 * stroke is centred on its path and these cells are two units across at the
 * waist, so 0.9 swallowed the fill entirely and the cartouche read as a bright
 * blue star rather than a pierced screen — a worse failure than the one it
 * fixed, and visible only in a capture. Checked at 4 and 19 apertures in both
 * themes; the M6 seed set takes 1 / 10 / 19 / 20 in dark so it stays checked.
 */
export function Cartouche({ placed, className }: { placed: number; className?: string }) {
  const cut = rosetteOnBench(placed)

  return (
    <svg
      role="img"
      aria-label={fill(strings.world.cut, { apertures: placed })}
      className={className}
      viewBox={`0 0 ${String(SPAN)} ${String(SPAN)}`}
      focusable="false"
    >
      {CELLS.map((d, cell) => (
        <path key={`plan-${String(cell)}`} d={d} fill="none" stroke="var(--dw-line-strong)" strokeWidth="0.4" />
      ))}
      {Array.from({ length: cut }, (_, n) => {
        const d = CELLS[cellCutAt(n)]
        if (d === undefined) return null
        return (
          <path
            key={`cut-${String(n)}`}
            className={n === cut - 1 ? ANCHOR_APERTURE : undefined}
            d={d}
            fill="var(--dw-aperture)"
            stroke="var(--dw-aperture-rim)"
            strokeWidth="0.45"
          />
        )
      })}
    </svg>
  )
}
