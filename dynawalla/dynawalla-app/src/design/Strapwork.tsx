import { useId } from "react"

import { strapworkTile } from "./strapwork.ts"

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
  // One id per band. Two bands sharing one is invalid markup, and the moment
  // the tile takes parameters the second band silently paints the first one's
  // pattern. React 19 ids contain punctuation that a URL fragment should not
  // carry, so only the alphanumerics survive.
  const patternId = `dw-strapwork-${useId().replace(/[^a-zA-Z0-9]/g, "")}`

  return (
    <svg
      aria-hidden="true"
      // `block`, not an inline style: the CSP forbids inline style entirely.
      className={className ? `block ${className}` : "block"}
      width="100%"
      height={HEIGHT}
    >
      <defs>
        <pattern
          id={patternId}
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
      <rect width="100%" height={HEIGHT} fill={`url(#${patternId})`} />
    </svg>
  )
}
