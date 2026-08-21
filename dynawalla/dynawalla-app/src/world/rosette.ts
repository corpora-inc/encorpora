// The girih rosette, as geometry.
//
// One correct answer cuts one aperture out of a stone screen. Twenty apertures
// make a rosette: a ten-fold star surrounded by a ring of rhombi, with the
// uncut stone left standing between them as ribs. This module is the shape of
// that, and nothing else — no DOM, no colour, no React, no state. Colour
// arrives from the tokens at the call site.
//
// Girih as **structure, not wallpaper** (EXPERIENCE_DESIGN, art direction). The
// cells are not a decorative pattern laid over a progress meter; they are the
// pieces the screen is actually made of, and the light comes through exactly
// the ones that have been cut.
//
// Everything here is a pure function of its arguments, so the screen is
// byte-identical on every device — the same determinism rule the exercise
// generators live under (GATES CG-16), and what makes the committed screenshot
// set worth comparing.
//
// ## Why the cut order is not 0,1,2,…
//
// Sequential cells fill the ring like a pie chart, and a filling ring is on the
// hostile reference board by name. Cutting in opposing pairs — 0, 5, 1, 6, … —
// grows the star outward from a balanced cross instead. It reads as a thing
// being built, which is what it is.

/** A point in the rosette's own user-unit space. */
export interface Vec {
  readonly x: number
  readonly y: number
}

/** Ten-fold symmetry: the fold of the Persian rosette, and the reason 20 cells. */
export const FOLD = 10

/** Apertures in one rosette: ten star cells, then ten ring cells. */
export const CELLS_PER_ROSETTE = FOLD * 2

export interface RosetteSpec {
  /** Centre-to-outer-vertex distance, in user units. */
  readonly radius: number
  /** Star tip radius, as a fraction of `radius`. */
  readonly tip: number
  /** Star valley radius, as a fraction of `radius`. */
  readonly valley: number
  /**
   * How far each aperture is drawn back from its ideal edge, as a fraction of
   * its own size. This is the stone that stays: at 0 the cells tile the whole
   * decagon and the screen is a hole, and the rosette stops being a rosette.
   */
  readonly rib: number
}

/** The proportions the app draws at. Chunky enough to read at 24 px. */
export const ROSETTE: RosetteSpec = { radius: 10, tip: 0.62, valley: 0.3, rib: 0.1 }

/** Three decimals is finer than a device pixel and keeps the output exact. */
const r3 = (n: number): string => String(Math.round(n * 1000) / 1000)

const TURN = Math.PI * 2

/**
 * A point at `turns` around the circle, `radius` out. Zero turns points up, so
 * a rosette has a tip at twelve o'clock rather than at three.
 */
function polar(centre: Vec, radius: number, turns: number): Vec {
  const angle = (turns - 0.25) * TURN
  return { x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) }
}

/** Pull a polygon in toward its own centroid. The gap this opens is the rib. */
function inset(points: readonly Vec[], amount: number): Vec[] {
  const n = points.length
  let cx = 0
  let cy = 0
  for (const point of points) {
    cx += point.x
    cy += point.y
  }
  cx /= n
  cy /= n
  const scale = 1 - amount
  return points.map((point) => ({ x: cx + (point.x - cx) * scale, y: cy + (point.y - cy) * scale }))
}

function polygon(points: readonly Vec[]): string {
  return `M${points.map((p) => `${r3(p.x)} ${r3(p.y)}`).join("L")}Z`
}

/**
 * The twenty apertures of one rosette, centred on `centre`, indexed by cell id.
 *
 * Cells 0–9 are the star: a kite from the centre out past tip `k`, between the
 * valleys either side of it. Cells 10–19 are the ring: a rhombus sitting on
 * valley `k`, reaching out to the decagon vertex beyond it. Together they leave
 * ten triangles of uncut stone at the rim, which are the ribs that make the
 * thing read as a carved screen rather than a filled circle.
 */
export function rosetteCells(centre: Vec, spec: RosetteSpec = ROSETTE): string[] {
  const { radius, tip, valley, rib } = spec
  if (!(radius > 0)) throw new RangeError("rosetteCells: radius must be positive")
  // Ordered, not merely positive: a valley outside a tip turns the star inside
  // out, and a tip outside the rim pushes the ring cells through themselves.
  // Both draw without complaint and neither is a rosette.
  if (!(valley > 0 && valley < tip && tip < 1)) {
    throw new RangeError("rosetteCells: need 0 < valley < tip < 1")
  }
  if (!(rib >= 0 && rib < 1)) throw new RangeError("rosetteCells: rib must be in [0, 1)")

  const at = (fraction: number, turns: number): Vec => polar(centre, radius * fraction, turns)
  const cells: string[] = []

  // The star. Kite k spans from the valley before tip k to the valley after it.
  for (let k = 0; k < FOLD; k++) {
    cells.push(
      polygon(
        inset(
          [
            centre,
            at(valley, (k - 0.5) / FOLD),
            at(tip, k / FOLD),
            at(valley, (k + 0.5) / FOLD),
          ],
          rib,
        ),
      ),
    )
  }

  // The ring. Rhombus k sits on valley k, between tips k and k+1.
  for (let k = 0; k < FOLD; k++) {
    cells.push(
      polygon(
        inset(
          [
            at(valley, (k + 0.5) / FOLD),
            at(tip, k / FOLD),
            at(1, (k + 0.5) / FOLD),
            at(tip, (k + 1) / FOLD),
          ],
          rib,
        ),
      ),
    )
  }

  return cells
}

/**
 * The order the apertures are cut in: opposing pairs, star first.
 *
 * `0, 5, 1, 6, 2, 7, …` around the star, then the same walk around the ring. A
 * balanced cross appears at the second answer and grows into a closed star at
 * the tenth; the ring then pushes it out to the rim at the twentieth. Both of
 * those are milestones the child can see coming, which is the point.
 */
export const CUT_ORDER: readonly number[] = (() => {
  const walk: number[] = []
  for (let ring = 0; ring < 2; ring++) {
    for (let step = 0; step < FOLD; step++) {
      const half = FOLD / 2
      walk.push(ring * FOLD + (step % 2 === 0 ? step / 2 : half + (step - 1) / 2))
    }
  }
  return walk
})()

/** The cell cut by the `n`-th answer into a rosette (0-based). */
export function cellCutAt(n: number): number {
  const cell = CUT_ORDER[n % CELLS_PER_ROSETTE]
  if (cell === undefined) throw new RangeError("cellCutAt: cut order is empty")
  return cell
}

/**
 * One `d` attribute for many apertures.
 *
 * This is the whole of the rasterize-to-snapshot story, and it is in the model
 * rather than bolted on afterwards: a finished rosette is twenty subpaths in
 * one `<path>` — one live node — and a finished course is a hundred. Nothing is
 * rasterized to a bitmap, nothing is cached, and nothing can drift out of step
 * with the geometry, because the fused string *is* the geometry.
 */
export function fuse(paths: readonly string[]): string {
  return paths.join("")
}
