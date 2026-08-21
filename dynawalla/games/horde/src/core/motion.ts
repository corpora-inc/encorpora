/**
 * Where the diver goes, and which way is up.
 *
 * ── The bug this file exists to end ──────────────────────────────────────────
 *
 * DEEPSWARM's vertical control was inverted — "like a flight simulator", which
 * is what a founder playtest called it. It was not a deliberate `-dy` anywhere.
 * It was a coordinate system that changed hands without changing sign.
 *
 * `core/input.ts` measures the stick in CSS pixels, where **+y is DOWN the
 * screen**: `dy = knobY - originY`, and `kyTarget` is +1 for `s` and for
 * `ArrowDown`. Both input paths — pointer/touch and keyboard — converge on the
 * same `stick.y` before anything reads it, which is why the bug was total
 * rather than partial, and why one conversion fixes every path at once.
 *
 * The renderer, meanwhile, projects with (`gfx/shaders.ts`, `SPRITE_VS` and
 * `GLYPH_VS`, both identical):
 *
 *     gl_Position = vec4((world.x - u_cam.x) * u_cam.z,
 *                        (world.y - u_cam.y) * u_cam.w, 0.0, 1.0);
 *
 * and GL clip space puts y = +1 at the TOP of the viewport. So **world +y is UP
 * the screen**, and `movePlayer` was doing:
 *
 *     const ay = st.y * s.speed      // +1 for "down"  →  world +y  →  up
 *
 * Screen-down drove the diver up. `drawStick` had the mirror image of the same
 * mistake — it laid the joystick graphic out with `camY - hh + originY * hpp`,
 * treating the world's bottom edge as the screen's top — so the thumb ring drew
 * at the reflected height too. One sign, three symptoms, no `-` anywhere to
 * find by searching for one.
 *
 * ── The rule, in one place ──────────────────────────────────────────────────
 *
 * Everything that crosses from screen pixels into world units goes through this
 * file, and `SCREEN_Y_TO_WORLD` is the only place the sign is written down.
 *
 * **What is and is not proved in Node.** `motion.test.ts` proves that the diver
 * moves toward the part of the world that this file calls "lower on the screen"
 * when the stick is pushed down — the input and the layout agreeing, which is
 * the half of the bug a test can hold. That the renderer agrees with *both* is
 * a fact about a GLSL string on a GPU; there is no WebGL in Node and no test
 * here asserts it. It was verified by reading the two vertex shaders above, and
 * a change to either of them must be checked on a device.
 */

/** Screen +x is world +x: the projection does not touch the x sign. */
export const SCREEN_X_TO_WORLD = 1

/**
 * Screen +y is world −y.
 *
 * CSS pixels grow downward; the projection above sends world +y to clip +y,
 * which GL puts at the top. Flip this constant and the game plays like a flight
 * simulator again.
 */
export const SCREEN_Y_TO_WORLD = -1

/** The mutable diver. `game.ts` holds these as four fields; this reads them. */
export type Diver = { x: number; y: number; vx: number; vy: number }

/**
 * The world-space drive direction for a stick reading in screen space.
 *
 * `core/input.ts` normalises magnitude already, so this is a pure change of
 * basis and never rescales.
 */
export function drive(stickX: number, stickY: number): { x: number; y: number } {
  return { x: stickX * SCREEN_X_TO_WORLD, y: stickY * SCREEN_Y_TO_WORLD }
}

/**
 * One step of the diver.
 *
 * Heavy acceleration toward the stick with a hard cap, so the diver feels
 * weighty yet exact. Lifted verbatim out of `movePlayer` so the tests drive the
 * integrator the game drives rather than a lookalike.
 */
export const ACCEL_BASE = 0.00004

export function integrate(
  d: Diver,
  stickX: number,
  stickY: number,
  speed: number,
  dt: number,
): void {
  const a = drive(stickX, stickY)
  const k = 1 - Math.pow(ACCEL_BASE, dt)
  d.vx += (a.x * speed - d.vx) * k
  d.vy += (a.y * speed - d.vy) * k
  d.x += d.vx * dt
  d.y += d.vy * dt
}

/** How much world one CSS pixel spans, given the half-extents on screen. */
export type View = {
  camX: number
  camY: number
  halfW: number
  halfH: number
  cssW: number
  cssH: number
}

/**
 * A point in CSS pixels, as a point in the world.
 *
 * Screen (0, 0) is the top-left corner, which is the world's LEFT edge and its
 * TOP edge — `camY + halfH`, not `camY - halfH`. `drawStick` uses this to put
 * the joystick ring under the thumb that is holding it.
 */
export function worldFromScreen(sx: number, sy: number, v: View): { x: number; y: number } {
  const wpp = (v.halfW * 2) / Math.max(1, v.cssW)
  const hpp = (v.halfH * 2) / Math.max(1, v.cssH)
  return {
    x: v.camX + (sx * wpp - v.halfW) * SCREEN_X_TO_WORLD,
    y: v.camY + (sy * hpp - v.halfH) * SCREEN_Y_TO_WORLD,
  }
}

/**
 * The inverse: a world point, in CSS pixels.
 *
 * Nothing in the game draws through this — the GPU does that. It exists so the
 * tests can ask the question a child asks, which is "did it go DOWN the
 * screen", in the units a child sees.
 */
export function screenFromWorld(wx: number, wy: number, v: View): { x: number; y: number } {
  const wpp = (v.halfW * 2) / Math.max(1, v.cssW)
  const hpp = (v.halfH * 2) / Math.max(1, v.cssH)
  return {
    x: ((wx - v.camX) * SCREEN_X_TO_WORLD + v.halfW) / wpp,
    y: ((wy - v.camY) * SCREEN_Y_TO_WORLD + v.halfH) / hpp,
  }
}
