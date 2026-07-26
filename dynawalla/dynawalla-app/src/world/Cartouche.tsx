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
            fill="var(--dw-ground-deep)"
            stroke="var(--dw-field-ink)"
            strokeWidth="0.35"
          />
        )
      })}
    </svg>
  )
}
