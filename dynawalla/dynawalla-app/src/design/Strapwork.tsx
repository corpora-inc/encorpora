import { useId } from "react"

import { strapworkTile, type StrapworkSpec, type StrapworkTile } from "./strapwork.ts"

/**
 * The band at two scales.
 *
 * An SVG `<pattern>` repeats in USER units, and a pattern's `width` is an
 * attribute rather than a CSS property — so a media query cannot resize the
 * motif and there is no arithmetic that makes one tile serve every screen. A
 * 24 px motif is right on a phone and wrong at 1440, where sixty repeats of a
 * fine zigzag stop reading as carved stone and start reading as a craft-store
 * border: the tell the audit called "thin and cheap on a wide screen".
 *
 * So there are two tiles, and CSS chooses between them. The motif grows with
 * the screen the way a carved course does — same geometry, same single stroke
 * weight, more of the band given to each repeat.
 */
const NARROW: StrapworkSpec = { unit: 24, height: 10, inset: 1.5, knot: 2 }
const WIDE: StrapworkSpec = { unit: 36, height: 14, inset: 2, knot: 3 }

const NARROW_TILE = strapworkTile(NARROW)
const WIDE_TILE = strapworkTile(WIDE)

function Band({
  id,
  spec,
  tile,
  className,
}: {
  id: string
  spec: StrapworkSpec
  tile: StrapworkTile
  className: string
}) {
  return (
    <svg
      aria-hidden="true"
      // `block`, not an inline style: the CSP forbids inline style entirely.
      className={className}
      width="100%"
      height={spec.height}
    >
      <defs>
        <pattern
          id={id}
          width={spec.unit}
          height={spec.height}
          patternUnits="userSpaceOnUse"
        >
          {/* The band names its own roles. `--dw-band-strap` and
              `--dw-band-knot` are the cool pair the foundation cut for it —
              the band is the edge of the surface above it, not the screen's
              warm point. That belongs to the navigation index, once. */}
          <path d={tile.strapA} fill="none" stroke="var(--dw-band-strap)" strokeWidth={1} />
          <path d={tile.strapB} fill="none" stroke="var(--dw-band-strap)" strokeWidth={1} />
          {tile.knots.map((knot) => (
            <path key={knot} d={knot} fill="var(--dw-band-knot)" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height={spec.height} fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * An interlace band. Structural: it is the edge of the surface above it, not
 * a decoration laid on top of one.
 *
 * No viewBox — user units are CSS pixels, so the motif keeps its proportions
 * at any width and simply repeats more times on a wider screen.
 */
export function Strapwork({ className }: { className?: string }) {
  // One id per band, and both bands on a screen are distinct instances, so the
  // seam is per call site AND per scale. Two bands sharing one id is invalid
  // markup, and the moment the tile takes parameters the second band silently
  // paints the first one's pattern — which is exactly what two scales are.
  // React 19 ids contain punctuation that a URL fragment should not carry, so
  // only the alphanumerics survive.
  const seed = useId().replace(/[^a-zA-Z0-9]/g, "")
  // A SPACE before the interpolation, and it is load-bearing. Tailwind reads
  // this file as text; written `md:hidden${extra}` the candidate it extracts
  // is `md:hidden${extra}`, which matches no utility, so the rule is silently
  // absent from the built stylesheet and every screen keeps the phone band.
  // It compiles, it lints, it types, and the design change never ships.
  const extra = className ?? ""

  return (
    <>
      <Band
        id={`dw-strapwork-${seed}n`}
        spec={NARROW}
        tile={NARROW_TILE}
        className={`block md:hidden ${extra}`}
      />
      <Band
        id={`dw-strapwork-${seed}w`}
        spec={WIDE}
        tile={WIDE_TILE}
        className={`hidden md:block ${extra}`}
      />
    </>
  )
}
