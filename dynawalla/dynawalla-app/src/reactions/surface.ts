// What an effect is allowed to draw with.
//
// Three deliberate narrowings, each of which is a rule somewhere else in the
// program made structural here:
//
//   1. **No material names.** The palette arrives as `Ink`, resolved from the
//      semantic tokens by whoever mounts the stage. `tokens.css` says nothing
//      outside its semantic block may name a material, and a canvas with a
//      brass literal in it would be a second, invisible theme that never
//      re-cuts in dark. `tokens.test.ts` fails the build over one.
//   2. **No allocation on the answer path.** The mote pool is a `Float32Array`
//      filled once at module load. An effect asks for mote `i` and gets four
//      numbers out of it; nothing is constructed per frame, per particle or per
//      reaction.
//   3. **Reduced motion is two numbers, not a second implementation.** The
//      stage pins `t` to 1, sets `travel` to 0 and `motes` to 0, and cross-fades
//      `alpha` over 200 ms. Every effect is then at its final state, with no
//      oscillation and no particles — `Q-06`'s "zero-travel cross-fade with no
//      particles", reached without a parallel code path that can rot.
//
// `Ctx` is the subset of the 2D context the effects actually use. It is a
// `Pick`, so it cannot drift from the real thing, and it is small enough that a
// test can implement it in twenty lines and record every call.

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Where the world's parts are on screen right now, in canvas pixels.
 *
 * Resolved from the DOM at fire time, after the verdict has painted. Any of
 * them may be `null` — the surface is not obliged to have a construction band
 * on it — and an effect that needs one it did not get is simply not eligible.
 */
export interface Anchor {
  /** The answer row: where the child's answer seats. */
  readonly seat: Rect | null
  /** The construction band. */
  readonly cartouche: Rect | null
  /** The aperture cut by this very answer. */
  readonly aperture: Rect | null
}

/** The semantic roles the canvas paints in, resolved to real colours. */
export interface Ink {
  readonly index: string
  readonly seat: string
  readonly strike: string
  readonly celestial: string
  readonly line: string
}

export interface Frame {
  /** Eased progress, 0→1. Pinned to 1 under reduced motion. */
  readonly t: number
  /** Global alpha for everything this effect draws. */
  readonly alpha: number
  /** 1 normally, 0 under reduced motion. Multiplies oscillation only. */
  readonly travel: number
  /** Motes this effect may emit. 0 under reduced motion. */
  readonly motes: number
  /** The effect's peak output amplitude, 0…1. */
  readonly gain: number
  readonly anchor: Anchor
  readonly ink: Ink
}

export type Ctx = Pick<
  CanvasRenderingContext2D,
  | "save"
  | "restore"
  | "beginPath"
  | "closePath"
  | "moveTo"
  | "lineTo"
  | "arc"
  | "rect"
  | "fill"
  | "stroke"
  | "clip"
  | "clearRect"
  | "fillStyle"
  | "strokeStyle"
  | "globalAlpha"
  | "lineWidth"
  | "lineCap"
>

/** The most motes any one effect may have in flight. Sizes the pool. */
export const MAX_MOTES = 24

/**
 * Four deterministic numbers per mote: two for the launch direction, one for
 * the speed, one for the phase. Filled once, read forever, never written.
 *
 * Deterministic rather than random because the committed screenshot set has to
 * be comparable frame for frame (`Q-06`, and the M6 seed set), and because a
 * pool that is refilled is a pool that allocates.
 */
const POOL = new Float32Array(MAX_MOTES * 4)
for (let i = 0; i < MAX_MOTES; i++) {
  // A cheap integer hash, spread over four channels. Any fixed sequence would
  // do; this one is stable across platforms because it is integer arithmetic.
  const h = (i * 2654435761) >>> 0
  POOL[i * 4] = ((h & 0xff) / 255) * 2 - 1
  POOL[i * 4 + 1] = (((h >>> 8) & 0xff) / 255) * 2 - 1
  POOL[i * 4 + 2] = 0.4 + ((h >>> 16) & 0xff) / 425
  POOL[i * 4 + 3] = ((h >>> 24) & 0xff) / 255
}

const pooled = (index: number, channel: number): number => POOL[(index % MAX_MOTES) * 4 + channel] ?? 0

export const easeOut = (t: number): number => 1 - (1 - t) ** 3

/**
 * A band of light crossing a rectangle.
 *
 * The one place the reduced-motion branch is more than a zero: a sweep whose
 * final state is "gone past the right edge" would draw nothing at all when `t`
 * is pinned, so with travel off it becomes a wash over the whole rectangle
 * instead. Same information, no movement.
 */
export function sweep(frame: Frame, box: Rect): { x: number; width: number } {
  if (frame.travel === 0) return { x: box.x, width: box.width }
  const width = box.width * 0.34
  return { x: box.x - width + (box.width + width) * frame.t, width }
}

/**
 * Motes: small chips of light or stone, thrown from a point and falling back.
 *
 * The **only** place particles are drawn. `reactions.test.ts` scans the effect
 * catalogue for a second one, because "no particles under reduced motion" is a
 * promise that is easy to make and easy to leak.
 */
export function motes(
  ctx: Ctx,
  frame: Frame,
  origin: { x: number; y: number },
  spread: number,
  colour: string,
): void {
  if (frame.motes <= 0) return
  ctx.fillStyle = colour
  for (let i = 0; i < frame.motes; i++) {
    const rise = frame.t * pooled(i, 2)
    const x = origin.x + pooled(i, 0) * spread * rise
    // Thrown up, then falling: the parabola is what makes it stone rather than
    // confetti, which drifts.
    const y = origin.y + pooled(i, 1) * spread * rise + spread * 1.6 * rise * rise
    const radius = (1 - frame.t) * (0.8 + pooled(i, 3) * 1.4)
    if (radius <= 0) continue
    ctx.globalAlpha = frame.alpha * frame.gain * (1 - frame.t)
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = frame.alpha
}

export function line(
  ctx: Ctx,
  from: { x: number; y: number },
  to: { x: number; y: number },
  colour: string,
  width: number,
): void {
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
}

export function centre(box: Rect): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
