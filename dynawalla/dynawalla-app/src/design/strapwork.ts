// Strapwork — the interlace band that carries structural edges in the shell.
//
// Two straps cross over one period and meet themselves at the seam, so one
// tile repeats through an SVG <pattern> at whatever width the device gives us
// without ever stretching the motif. A knot sits on each crossing.
//
// Geometry only: no DOM, no colour, no React. Colour arrives from the tokens
// at the call site, and everything here is a pure function of its arguments so
// the band is byte-identical on every device — the same determinism rule the
// exercise generators live under (GATES CG-16).

export interface StrapworkSpec {
  /** Width of one repeat, in user units. */
  unit: number
  /** Height of the band, in user units. */
  height: number
  /** Distance from the band edge to the strap's turning point. */
  inset: number
  /** Half-diagonal of the lozenge sitting on each crossing. 0 omits knots. */
  knot: number
}

export interface StrapworkTile {
  /** The strap that starts high. */
  strapA: string
  /** The strap that starts low. */
  strapB: string
  /** One closed lozenge per crossing, left to right. */
  knots: string[]
}

/** Three decimals is finer than a device pixel and keeps output exact. */
const r = (n: number): string => String(Math.round(n * 1000) / 1000)

const point = (x: number, y: number): string => `${r(x)},${r(y)}`

/**
 * One horizontally seamless tile of a two-strap interlace.
 *
 * Strap A runs from the top edge down to the bottom and back to the top over
 * one unit; strap B is its mirror. They cross at a quarter and three quarters
 * of the unit, which is where the knots go.
 */
export function strapworkTile(spec: StrapworkSpec): StrapworkTile {
  const { unit, height, inset, knot } = spec

  if (!(unit > 0) || !(height > 0)) {
    throw new RangeError("strapworkTile: unit and height must be positive")
  }
  if (inset < 0 || inset * 2 > height) {
    throw new RangeError("strapworkTile: inset must fit inside the band")
  }

  const top = inset
  const bottom = height - inset
  const mid = height / 2

  const strapA = `M${point(0, top)} L${point(unit / 2, bottom)} L${point(unit, top)}`
  const strapB = `M${point(0, bottom)} L${point(unit / 2, top)} L${point(unit, bottom)}`

  const knots: string[] = []
  if (knot > 0) {
    for (const cx of [unit / 4, (unit * 3) / 4]) {
      knots.push(
        `M${point(cx, mid - knot)} L${point(cx + knot, mid)} ` +
          `L${point(cx, mid + knot)} L${point(cx - knot, mid)} Z`,
      )
    }
  }

  return { strapA, strapB, knots }
}

/** Every coordinate pair in a path, in order. Used by the tests. */
export function pathPoints(path: string): [number, number][] {
  return [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ])
}
