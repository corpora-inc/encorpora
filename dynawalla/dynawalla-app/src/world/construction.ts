// The construction: what a correct answer actually builds, and what it means.
//
// One number. `placed` is the count of apertures cut into the screen, and it is
// the only durable thing the world owns — every shape, every milestone and every
// piece of the drawing is derived from it. That is deliberate: a model that
// stores which cells are cut can lose one, and `P-04` says construction never
// regresses. A monotone counter cannot regress without someone writing a
// subtraction, and there is not one in this file. `construction.test.ts` reads
// the module source and asserts that.
//
// ## The four scales, and why there are four
//
//   aperture  one correct answer, one cut cell
//   rosette   20 apertures — a ten-fold star inside a ring
//   course     3 rosettes — one row of the screen, 60 apertures
//   screen     3 courses — a finished screen, set into the wall, 180
//
// The cadence is chosen against a real session rather than a round number. Ten
// answers close the star at the middle of a rosette, so a short sitting still
// ends on something that visibly finished. Twenty close the rosette. A
// twenty-minute session is roughly forty answers, so the M2 playtest's two
// sessions reach a course — and above that a long history compounds into a wall
// rather than into a longer bar. An earlier cut had five-rosette courses and
// five-course screens; at 100 answers to a course it put every milestone a
// child could reach in one place and left four fifths of the plate empty for
// weeks.
//
// ## Boundary
//
// Nothing here imports from `src/work/` or from the engine (`Q-05`). The world
// is told that something was placed; it never asks what the problem was.

import { CELLS_PER_ROSETTE, cellCutAt, fuse, ROSETTE, rosetteCells, type Vec } from "./rosette.ts"

export { CELLS_PER_ROSETTE }

/** Rosettes in one course — one row of the screen. */
export const ROSETTES_PER_COURSE = 3
/** Courses in one screen. */
export const COURSES_PER_SCREEN = 3

export const CELLS_PER_COURSE = CELLS_PER_ROSETTE * ROSETTES_PER_COURSE
export const CELLS_PER_SCREEN = CELLS_PER_COURSE * COURSES_PER_SCREEN

/** Apertures that close the star at the middle of a rosette. */
export const CELLS_PER_STAR = CELLS_PER_ROSETTE / 2

export interface Construction {
  /** Apertures cut. Monotone, forever. */
  readonly placed: number
}

export const NOTHING_BUILT: Construction = { placed: 0 }

/**
 * Cut one more aperture.
 *
 * The only transition the world has. There is no `remove`, no `reset` and no
 * `undo`, and adding one would be a product change rather than a feature:
 * ADR-0009 makes never-regressing construction the child-safe replacement for
 * loss aversion, and `P-04` is the assertion that nobody quietly added a path
 * that takes something back.
 */
export function place(construction: Construction): Construction {
  return { placed: construction.placed + 1 }
}

/**
 * What just closed, if anything.
 *
 * Named for the thing in the world, never for a score. The reaction layer
 * escalates on these and the character speaks at them; nothing else consumes a
 * milestone, and in particular nothing counts how many the child has had.
 */
export type Milestone = "star" | "rosette" | "course" | "screen"

/** How many apertures the thing that just closed is made of. */
export function aperturesIn(milestone: Milestone): number {
  switch (milestone) {
    case "star":
      return CELLS_PER_STAR
    case "rosette":
      return CELLS_PER_ROSETTE
    case "course":
      return CELLS_PER_COURSE
    case "screen":
      return CELLS_PER_SCREEN
  }
}

/** The milestone reached by placing the `placed`-th aperture, or `null`. */
export function milestoneAt(placed: number): Milestone | null {
  if (placed <= 0) return null
  if (placed % CELLS_PER_SCREEN === 0) return "screen"
  if (placed % CELLS_PER_COURSE === 0) return "course"
  if (placed % CELLS_PER_ROSETTE === 0) return "rosette"
  if (placed % CELLS_PER_STAR === 0) return "star"
  return null
}

/**
 * Apertures cut into the rosette currently on the bench: 0…20.
 *
 * Twenty, not zero, on the answer that closes one. The closed rosette stays on
 * the bench until the next answer starts a new one, so the child sees the thing
 * they finished rather than an empty plate the instant they finish it — and the
 * MECHANISM reaction has something to play over.
 */
export function rosetteOnBench(placed: number): number {
  const clamped = Math.max(0, Math.floor(placed))
  return clamped === 0 ? 0 : ((clamped - 1) % CELLS_PER_ROSETTE) + 1
}

/**
 * One drawable piece: exactly one `<path>` in the DOM.
 *
 * The offsets are baked into `d` rather than carried on a wrapping `<g>`, so
 * the count of pieces *is* the count of live SVG nodes and `liveNodes` cannot
 * quietly become a lie.
 */
export interface Piece {
  readonly key: string
  /** What scale this piece is drawn at. Drives its material, not its shape. */
  readonly kind: "cell" | "rosette" | "course" | "panel"
  readonly d: string
}

/** The whole screen's geometry, in the units `screenBox` describes. */
export interface ScreenGeometry {
  readonly radius: number
  /** Centre-to-centre distance between neighbouring rosettes. */
  readonly pitch: number
  /** Margin between the outermost rosette and the frame. */
  readonly margin: number
}

/**
 * Rosettes sit at 1.9 radii apart, which is closer than they are wide.
 *
 * A decagon of circumradius `r` reaches `r` only at its ten vertices, and the
 * rib inset pulls the outermost apertures back from even that — so at this
 * pitch the cut fields nearly meet and the wall reads as one pierced screen.
 * At 2.15 they read as a row of separate flowers on a plate, which is a
 * pattern library rather than a building.
 */
export const SCREEN_GEOMETRY: ScreenGeometry = {
  radius: ROSETTE.radius,
  pitch: ROSETTE.radius * 1.9,
  margin: ROSETTE.radius * 0.7,
}

/**
 * Completed screens visible in the wall behind the current one.
 *
 * A stack of set panels shows its top edges and nothing more, which is both how
 * masonry works and what keeps this drawing bounded: the hundredth finished
 * screen adds no node, because it is behind the twelfth. The exact number is in
 * the text alternative, where a count belongs (`Q-10`).
 */
export const VISIBLE_PANELS = 12

/**
 * The hard ceiling on live SVG nodes in the world, from EXPERIENCE_DESIGN.
 *
 * Procedural girih at 500+ answers becomes tens of thousands of live nodes and
 * stalls a mid-range Android WebView (`Q-02`). The cap is asserted against
 * `liveNodes` at a million placed apertures, and against the deliberately
 * unfused reference implementation below, which blows it — so the test can
 * fail, which is the only thing that makes it a gate.
 */
export const NODE_CAP = 1200

/** Nodes the frame costs regardless of what is built: the ground and its rim. */
export const CHROME_NODES = 2

/**
 * How the count of placed apertures decomposes across the four scales.
 *
 * Read one *behind* the boundary at every scale — the same convention as
 * `rosetteOnBench`, for the same reason. At exactly 180 the child has just
 * finished a whole screen, and `placed % 180 === 0` would show them a blank
 * plate and a panel edge at the biggest milestone the product has. So a
 * completed thing stays on the plate until the next aperture starts a new one.
 */
export interface Breakdown {
  readonly panels: number
  readonly courses: number
  readonly rosettes: number
  readonly cells: number
}

export function breakdown(placed: number): Breakdown {
  const clamped = Math.max(0, Math.floor(placed))
  if (clamped === 0) return { panels: 0, courses: 0, rosettes: 0, cells: 0 }
  const inScreen = ((clamped - 1) % CELLS_PER_SCREEN) + 1
  const courses = Math.floor(inScreen / CELLS_PER_COURSE)
  const inCourse = inScreen - courses * CELLS_PER_COURSE
  return {
    panels: Math.floor((clamped - 1) / CELLS_PER_SCREEN),
    courses,
    rosettes: Math.floor(inCourse / CELLS_PER_ROSETTE),
    cells: inCourse % CELLS_PER_ROSETTE,
  }
}

/** Courses of the current screen that have anything in them: 1…3. */
export function coursesShown(placed: number): number {
  const { courses, rosettes, cells } = breakdown(placed)
  return Math.max(1, Math.min(courses + (rosettes + cells > 0 ? 1 : 0), COURSES_PER_SCREEN))
}

/**
 * Rosettes of the bottom course that have anything in them: 1…3.
 *
 * The horizontal half of the crop, and the half a first session actually lives
 * on. The box grew a *course* at a time and was always three rosettes wide, so
 * a child with nineteen apertures — most of a first sitting — got one small
 * flower in the left third of a wide empty plate, which is exactly the "four
 * fifths of an empty plate" `screenBox` says it exists to avoid. Once any
 * course is complete the wall is three wide and stays three wide.
 */
export function rosettesShown(placed: number): number {
  const { courses, rosettes, cells } = breakdown(placed)
  if (courses > 0) return ROSETTES_PER_COURSE
  return Math.max(1, Math.min(rosettes + (cells > 0 ? 1 : 0), ROSETTES_PER_COURSE))
}

/**
 * The drawing's own coordinate box, cropped to what has been built.
 *
 * A fixed box would mean a first session spent looking at four fifths of an
 * empty plate — the wall drawn at the size it will be in a year rather than the
 * size it is. It grows a rosette at a time to the right and a course at a time
 * upward, the way it is built.
 *
 * Both axes, and the first cut only did one. The height cropped and the width
 * never did, so the letterbox the crop exists to prevent was simply rotated
 * ninety degrees onto the axis a first session spends all its time on.
 */
export function screenBox(placed: number): { readonly width: number; readonly height: number } {
  const { pitch, margin } = SCREEN_GEOMETRY
  return {
    width: pitch * rosettesShown(placed) + margin * 2,
    height: pitch * coursesShown(placed) + margin * 2,
  }
}

function rosetteCentre(index: number, box: { readonly height: number }): Vec {
  const { pitch, margin } = SCREEN_GEOMETRY
  const column = index % ROSETTES_PER_COURSE
  const row = Math.floor(index / ROSETTES_PER_COURSE)
  return {
    x: margin + pitch * (column + 0.5),
    // Courses are laid bottom upward, the way a wall is built. SVG y grows
    // downward, so row 0 is the last row of the box.
    y: box.height - margin - pitch * (row + 0.5),
  }
}

/**
 * Live SVG nodes the world draws at `placed`, without building any of them.
 *
 * Bounded by construction rather than by a budget somebody remembers to check.
 * The reachable maximum is `VISIBLE_PANELS` panels plus the decomposition of
 * one screen — and the decomposition's terms are not independent: `courses`
 * reaches 3 only when `rosettes` and `cells` are both 0. The worst case is
 * 2 courses + 2 rosettes + 19 cells, so the true ceiling is
 * 12 + 2 + 2 + 19 + 2 = **37**. (`Q-02` is scoped to `/world`; the practice
 * surface's `Cartouche` draws its own fixed 40 — twenty plan outlines and at
 * most twenty cuts — and is bounded in that component.)
 */
export function liveNodes(placed: number): number {
  const { panels, courses, rosettes, cells } = breakdown(placed)
  return Math.min(panels, VISIBLE_PANELS) + courses + rosettes + cells + CHROME_NODES
}

/** One completed screen, seen edge-on in the stack behind the current one. */
function panelEdge(depth: number, box: { readonly width: number }): string {
  const { margin } = SCREEN_GEOMETRY
  const step = margin * 0.3
  const y = margin * 0.55 - depth * step
  const inset = margin * 0.4 + depth * step * 0.8
  const x0 = inset
  const x1 = box.width - inset
  const h = step * 0.5
  return `M${String(x0)} ${String(y)}H${String(x1)}V${String(y + h)}H${String(x0)}Z`
}

/**
 * Every piece of the world at `placed`, newest last.
 *
 * Fusion is what makes this bounded: a finished rosette is one path holding
 * twenty subpaths, a finished course is one path holding a hundred. The pieces
 * a child is *currently* cutting stay separate, because those are the ones that
 * have to be able to light up one at a time.
 */
export function screenPieces(placed: number): Piece[] {
  const { panels, courses, rosettes, cells } = breakdown(placed)
  const box = screenBox(placed)
  const pieces: Piece[] = []

  for (let depth = Math.min(panels, VISIBLE_PANELS); depth > 0; depth--) {
    pieces.push({ key: `panel-${String(depth)}`, kind: "panel", d: panelEdge(depth - 1, box) })
  }

  for (let course = 0; course < courses; course++) {
    const paths: string[] = []
    for (let index = 0; index < ROSETTES_PER_COURSE; index++) {
      paths.push(...rosetteCells(rosetteCentre(course * ROSETTES_PER_COURSE + index, box)))
    }
    pieces.push({ key: `course-${String(course)}`, kind: "course", d: fuse(paths) })
  }

  const base = courses * ROSETTES_PER_COURSE
  for (let index = 0; index < rosettes; index++) {
    pieces.push({
      key: `rosette-${String(base + index)}`,
      kind: "rosette",
      d: fuse(rosetteCells(rosetteCentre(base + index, box))),
    })
  }

  const live = rosetteCells(rosetteCentre(base + rosettes, box))
  for (let n = 0; n < cells; n++) {
    const cell = live[cellCutAt(n)]
    if (cell === undefined) continue
    pieces.push({ key: `cell-${String(n)}`, kind: "cell", d: cell })
  }

  return pieces
}

/**
 * The same world, drawn the obvious way: one node per aperture, forever.
 *
 * Not used by the app. It exists so `construction.test.ts` can show the cap
 * being blown — a budget that no reachable input can exceed is not a gate, it
 * is a comment. This is the implementation this file would have had if fusion
 * were an optimisation to add later, and at 5,000 answers it is over `NODE_CAP`.
 */
export function unfusedNodes(placed: number): number {
  return Math.max(0, Math.floor(placed)) + CHROME_NODES
}
