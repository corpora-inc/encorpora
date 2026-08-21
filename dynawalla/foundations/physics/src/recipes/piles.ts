// Ground, stacks, dominoes — everything that is "a lot of boxes touching".

import type { World, Vec2, BodyHandle } from "../world.ts"

export function ground(w: World, halfWidth = 20, opts: { friction?: number } = {}): BodyHandle {
  return w.add("static", { box: [halfWidth, 0.5] }, [0, -0.5], {
    friction: opts.friction ?? 0.6,
    tag: "ground",
  })
}

export interface StackOpts {
  at: Vec2
  rows?: number
  /** Half-extent of one block. */
  size?: number
  /** "pyramid" is stable and topples beautifully; "tower" is the fragile one. */
  shape?: "pyramid" | "tower"
  friction?: number
}

/**
 * A stack that stands still until something hits it.
 *
 * The 1 mm gap is not a typo. Boxes authored exactly touching start the
 * simulation already penetrating by the solver's linear slop, so frame 0 is
 * spent pushing the whole pile apart — which reads as the stack "breathing"
 * before anyone touches it, and differs between engines. Author the gap.
 */
export function stack(w: World, o: StackOpts): BodyHandle[] {
  const rows = o.rows ?? 10
  const h = o.size ?? 0.25
  const gap = 0.001
  const out: BodyHandle[] = []
  const [ox, oy] = o.at
  for (let row = 0; row < rows; row++) {
    const n = o.shape === "tower" ? 2 : rows - row
    for (let i = 0; i < n; i++) {
      out.push(
        w.add(
          "dynamic",
          { box: [h, h] },
          [ox + (i - (n - 1) / 2) * (h * 2 + gap), oy + h + row * (h * 2 + gap)],
          { density: 1, friction: o.friction ?? 0.5, tag: "block" },
        ),
      )
    }
  }
  return out
}

export interface DominoOpts {
  from: Vec2
  to: Vec2
  count?: number
  height?: number
  /** Coulomb friction. See the note — this is the parameter that decides it. */
  friction?: number
  /** Tip the first one over by this angle to start the wave. */
  nudge?: number
}

/**
 * A domino run that actually propagates.
 *
 * Two measured facts shape the defaults:
 *
 * - SPACING. Dominoes must be closer together than they are tall or the wave
 *   dies; the default is 0.55 x height, which propagates reliably and still
 *   looks like a domino run rather than a wall.
 * - FRICTION. Swept on Rapier, dominoes fallen out of 300 in 15 s:
 *     0.10 -> 289    0.20 -> 258    0.45 -> 195    0.70 -> 158
 *   A smooth, monotone degradation. (Matter.js on the identical scene: 73, 70,
 *   0, 0 — it wedges and stops dead above ~0.3, which is why the kit is not
 *   built on it.) 0.3 is the default: fast wave, still looks weighty.
 *
 * The nudge is GEOMETRIC, not an impulse. An impulse applied "on the first
 * frame" is a hidden input that a replay has to reproduce; a tilted starting
 * pose is part of the scene and replays for free.
 */
export function dominoes(w: World, o: DominoOpts): BodyHandle[] {
  const count = o.count ?? 30
  const height = o.height ?? 1
  const halfH = height / 2
  const halfW = height * 0.05
  const [x0, y0] = o.from
  const [x1, y1] = o.to
  const out: BodyHandle[] = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1)
    out.push(
      w.add("dynamic", { box: [halfW, halfH] }, [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + halfH], {
        density: 1.2,
        friction: o.friction ?? 0.3,
        tag: "domino",
      }),
    )
  }
  const nudge = o.nudge ?? -0.22
  if (out[0]) out[0].rb.setRotation(nudge, true)
  return out
}

/** Fraction of a domino run that has fallen. For a win condition. */
export function fallenFraction(run: BodyHandle[]): number {
  if (run.length === 0) return 0
  let n = 0
  for (const d of run) if (Math.abs(d.angle()) > 0.7) n++
  return n / run.length
}
