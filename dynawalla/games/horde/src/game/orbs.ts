/**
 * The three numbered orbs a CORE opens, and where they are.
 *
 * ── The bug this file exists to end ──────────────────────────────────────────
 *
 * A CORE used to place its orbs like this, once per frame, in `questTick`:
 *
 *     o.ang += dt * 0.42
 *     o.x = this.px + Math.cos(o.ang) * 172
 *     o.y = this.py + Math.sin(o.ang) * 172
 *
 * The orb's position was recomputed *from the player's current position* on
 * every frame, so it was not a place in the world at all — it was an offset
 * bolted to the diver's hip. Swimming at it moved it. The distance from the
 * diver to any orb was 172 px on the first frame of the CORE and 172 px on the
 * last one, no matter what the child did with their thumb.
 *
 * The reach test then asked whether the diver's *lead* position had closed to
 * within 40 px:
 *
 *     px = this.px + this.pvx * 0.06
 *
 * which is 12.3 px of lead at the base speed of 205 px/s. To cross the
 * remaining 172 − 40 px on lead alone the diver would have to be travelling
 * 2200 px/s. The fastest build in the game — every CURRENT card taken, +18 px/s
 * each — does not come close. So the CORE could be entered and could never be
 * answered: it opened, three numbers circled the child at arm's length for
 * eight and a half seconds, and closed as a timeout. Measured before the fix,
 * driving the diver straight at an orb with a perfect stick: 172.0 px at t=0,
 * 159.8 px at t=0.5 s, and 159.8 px at every sample after that, forever.
 *
 * ── What replaces it ────────────────────────────────────────────────────────
 *
 * An orb is a PLACE. `place` fixes an anchor in world space at the moment the
 * CORE opens, and `advance` moves the orbs around *that anchor* — never around
 * the player, whose position this module is never even given. The signature is
 * the guarantee: `advance(orbs, dt)` cannot follow a diver it cannot see.
 *
 * The ring still turns, because "time slows down and three numbered balls
 * circle you" is what the game's own how-to-play promises and the founder likes
 * the game as it is. It turns at 0.22 rad/s, which is 33 px/s of tangential
 * drift at this radius against a diver who covers 139 px/s in bullet time — a
 * ring you swim into, not a carousel you chase.
 */

export type Orb = {
  /** Live world position. Derived from the anchor; never from the player. */
  x: number
  y: number
  /** The fixed world point this orb circles. Set once, when the CORE opens. */
  ax: number
  ay: number
  ang: number
  text: string
  correct: boolean
  /** 0 untouched, 1 revealed-correct, 2 struck-wrong. */
  state: number
  t: number
}

/** How far from the CORE the ring sits. One short swim in bullet time. */
export const ORB_RADIUS = 150

/**
 * How close counts as a strike.
 *
 * Generous on purpose: the diver's own body is 15 px and the numeral drawn on
 * an orb is about 34 px wide, so 52 means "the child put the light on the
 * number", not "the child hit a pixel".
 */
export const ORB_HIT = 52

/** Radians per second the ring turns about its anchor. */
export const ORB_SPIN = 0.22

/**
 * How far ahead of the diver the strike is tested.
 *
 * A small courtesy, not a mechanism: at 205 px/s it is 12 px, so a child who is
 * already moving through an orb registers on the frame they arrive rather than
 * the frame after. When orbs were pinned to the player this was the *only*
 * closing term, which is how it came to matter at all.
 */
export const LEAD_SECONDS = 0.06

/**
 * Lay the ring down around a world point, evenly spaced from `base`.
 *
 * `texts` is already shuffled by the caller; this places what it is handed and
 * has no opinion about which position the answer lands in.
 */
export function place(
  cx: number,
  cy: number,
  texts: readonly string[],
  answer: string,
  base: number,
  radius = ORB_RADIUS,
): Orb[] {
  const orbs: Orb[] = []
  for (let i = 0; i < texts.length; i++) {
    const ang = base + (i / texts.length) * Math.PI * 2
    orbs.push({
      x: cx + Math.cos(ang) * radius,
      y: cy + Math.sin(ang) * radius,
      ax: cx,
      ay: cy,
      ang,
      text: texts[i] as string,
      correct: texts[i] === answer,
      state: 0,
      t: 0,
    })
  }
  return orbs
}

/**
 * Turn the ring.
 *
 * Takes no player. That is the whole point of the file and it is enforced by
 * the type: an orb's position is a function of its own anchor and the clock,
 * so a diver swimming toward one closes on it.
 */
export function advance(orbs: readonly Orb[], dt: number): void {
  for (const o of orbs) {
    if (o.state !== 0) {
      o.t += dt
      continue
    }
    o.ang += dt * ORB_SPIN
    const r = Math.hypot(o.x - o.ax, o.y - o.ay) || ORB_RADIUS
    o.x = o.ax + Math.cos(o.ang) * r
    o.y = o.ay + Math.sin(o.ang) * r
  }
}

/** Has the diver, at this position and velocity, struck this orb? */
export function reached(
  o: Orb,
  px: number,
  py: number,
  pvx: number,
  pvy: number,
  hit = ORB_HIT,
): boolean {
  if (o.state !== 0) return false
  const lx = px + pvx * LEAD_SECONDS
  const ly = py + pvy * LEAD_SECONDS
  const dx = o.x - lx
  const dy = o.y - ly
  return dx * dx + dy * dy < hit * hit
}

/** Distance from the diver to an orb. Used by the tests, and by nothing else. */
export function distanceTo(o: Orb, px: number, py: number): number {
  return Math.hypot(o.x - px, o.y - py)
}
