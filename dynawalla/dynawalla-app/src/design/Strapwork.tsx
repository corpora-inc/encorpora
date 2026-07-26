import { strapworkTile } from "./strapwork.ts"

// One pattern definition serves every band on the page: the tile is a constant,
// so a shared id is correct and keeps the markup deterministic.
const PATTERN_ID = "dw-strapwork"

const UNIT = 24
const HEIGHT = 10
const TILE = strapworkTile({ unit: UNIT, height: HEIGHT, inset: 1.5, knot: 2 })

/**
 * An interlace band. Structural: it is the edge of the surface above it, not
 * a decoration laid on top of one.
 *
 * No viewBox — user units are CSS pixels, so the motif keeps its proportions
 * at any width and simply repeats more times on a wider screen.
 */
export function Strapwork({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="100%"
      height={HEIGHT}
      style={{ display: "block" }}
    >
      <defs>
        <pattern
          id={PATTERN_ID}
          width={UNIT}
          height={HEIGHT}
          patternUnits="userSpaceOnUse"
        >
          <path d={TILE.strapA} fill="none" stroke="var(--dw-line-strong)" strokeWidth={1} />
          <path d={TILE.strapB} fill="none" stroke="var(--dw-line-strong)" strokeWidth={1} />
          {TILE.knots.map((knot) => (
            <path key={knot} d={knot} fill="var(--dw-index)" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height={HEIGHT} fill={`url(#${PATTERN_ID})`} />
    </svg>
  )
}
