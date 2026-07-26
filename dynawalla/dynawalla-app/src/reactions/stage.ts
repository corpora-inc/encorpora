// The reaction stage: one canvas, one effect at a time, nothing to wait for.
//
// ## The law this file exists to keep
//
// EXPERIENCE_DESIGN: *nothing awaits a reaction*. There is no promise here, no
// completion callback, and no way for a caller to find out when an effect
// finished, because there is no correct thing to do with that information.
// `fire` starts something and returns; `settleNow` stops it and returns. The
// loop's next card presents concurrently with the reaction tail.
//
// `settleNow()` is called synchronously by the input handler **before any event
// is processed** — not after, and not from an effect. It returns in
// microseconds and the picture is gone within `SETTLE_MS`.
//
// That budget is 64 ms, not the 80 it shipped at, and the difference is what a
// browser measurement costs. `Q-04` allows 90 ms from the interrupting
// keypress to an empty canvas, and the only honest way to observe "empty" is
// to sample the pixels on a frame callback — which adds up to one whole frame
// of quantisation on top of the settle. At 80 ms `bench-reactions.mjs` read
// 87.7 ms and 89.6 ms against a 90 ms limit: passing, and one slow frame from
// not. 64 ms is four frames of cross-fade and leaves the measured figure a
// frame of headroom.
//
// A child who answers fast never waits on an animation, and the input is
// neither dropped nor delayed to make that true.
//
// ## Reduced motion
//
// A branch, not a degradation. `t` is pinned to 1 so every effect is drawn at
// its final state, `travel` is 0 so nothing oscillates, `motes` is 0 so nothing
// particulates, and `alpha` cross-fades in and out over `REDUCED_MS` = 200. One
// code path, two numbers — there is no second renderer to fall behind.
//
// ## Boundary
//
// Nothing here imports from `src/work/` or from the engine (`Q-05`). The stage
// is told an `Outcome`; it never asks what the problem was, and it could not
// find out. Anchors arrive as rectangles, resolved from the DOM by whoever
// mounts the stage.

import { pick, FRESH, type PickerState } from "./picker.ts"
import { chooseTier, type Outcome, type TierName, TIERS } from "./tiers.ts"
import { easeOut, type Anchor, type Ctx, type Frame, type Ink } from "./surface.ts"
import type { Effect } from "./effects.ts"

/** How long a settling reaction takes to disappear. `Q-04` allows 90. */
export const SETTLE_MS = 64

/** The reduced-motion cross-fade, in and out. */
export const REDUCED_MS = 200

export interface StageDeps {
  readonly ctx: Ctx
  /** Canvas size in CSS pixels. Read every frame; cheap, and never stale. */
  readonly size: () => { readonly width: number; readonly height: number }
  readonly now: () => number
  readonly schedule: (run: () => void) => number
  readonly cancel: (handle: number) => void
  readonly reducedMotion: () => boolean
  readonly ink: () => Ink
  readonly anchor: () => Anchor
  /** Injected for the tests; `Math.random` in the app. */
  readonly draw?: () => number
}

export interface Stage {
  /** Start a reaction. Returns the tier actually drawn, or `null`. */
  fire: (outcome: Outcome) => TierName | null
  /** Stop whatever is running. Synchronous, and gone within `SETTLE_MS`. */
  settleNow: () => void
  /** Advance one frame. The scheduler calls it; tests call it directly. */
  tick: () => void
  readonly running: () => boolean
  /** Drop the once-a-session budgets. Called when a session begins. */
  reset: () => void
  dispose: () => void
}

interface Live {
  readonly effect: Effect
  readonly budgetMs: number
  readonly startedAt: number
  readonly anchor: Anchor
  settlingAt: number | null
}

export function createStage(deps: StageDeps): Stage {
  let picker: PickerState = FRESH
  let live: Live | null = null
  let handle: number | null = null
  let disposed = false

  const clear = (): void => {
    const { width, height } = deps.size()
    deps.ctx.clearRect(0, 0, width, height)
  }

  const stop = (): void => {
    if (handle !== null) deps.cancel(handle)
    handle = null
    live = null
    clear()
  }

  const arm = (): void => {
    if (handle !== null || disposed) return
    handle = deps.schedule(() => {
      handle = null
      tick()
    })
  }

  const tick = (): void => {
    if (live === null || disposed) return
    const reduced = deps.reducedMotion()
    const elapsed = deps.now() - live.startedAt
    const span = reduced ? REDUCED_MS : live.budgetMs
    const raw = span <= 0 ? 1 : Math.min(elapsed / span, 1)

    let alpha = reduced ? Math.sin(Math.PI * raw) : 1 - raw ** 2
    if (live.settlingAt !== null) {
      const settled = (deps.now() - live.settlingAt) / SETTLE_MS
      if (settled >= 1) {
        stop()
        return
      }
      alpha *= 1 - settled
    }

    if (raw >= 1 && live.settlingAt === null) {
      stop()
      return
    }

    clear()
    const frame: Frame = {
      t: reduced ? 1 : easeOut(raw),
      alpha: Math.max(alpha, 0),
      travel: reduced ? 0 : 1,
      motes: reduced ? 0 : live.effect.particles,
      gain: live.effect.peakGain,
      anchor: live.anchor,
      ink: deps.ink(),
    }
    deps.ctx.save()
    // The canvas covers the whole app, so an effect anchored on a 44 px rosette
    // inside a 72 px band drew arcs across the header above it. Clipping to the
    // anchor the effect declares keeps a reaction inside the thing it is
    // reacting on, without changing a line of its geometry.
    const region = live.effect.clip === null ? null : live.anchor[live.effect.clip]
    if (region !== null) {
      deps.ctx.beginPath()
      deps.ctx.rect(region.x, region.y, region.width, region.height)
      deps.ctx.clip()
    }
    live.effect.draw(deps.ctx, frame)
    deps.ctx.restore()
    arm()
  }

  return {
    fire: (outcome) => {
      if (disposed) return null
      const anchor = deps.anchor()
      const chosen = pick(chooseTier(outcome), anchor, picker, (deps.draw ?? Math.random)())
      if (chosen === null) {
        stop()
        return null
      }
      picker = chosen.state
      live = {
        effect: chosen.effect,
        budgetMs: TIERS[chosen.tier].budgetMs,
        startedAt: deps.now(),
        anchor,
        settlingAt: null,
      }
      // Draw the first frame now rather than next tick. The reaction is fired
      // from a frame callback that has already run after the verdict painted,
      // so waiting for another one puts the acknowledgement a whole frame
      // behind the thing it acknowledges.
      tick()
      return chosen.tier
    },

    settleNow: () => {
      if (live === null || live.settlingAt !== null) return
      live.settlingAt = deps.now()
      arm()
    },

    tick,
    running: () => live !== null,
    reset: () => {
      picker = FRESH
    },
    dispose: () => {
      disposed = true
      if (handle !== null) deps.cancel(handle)
      handle = null
      live = null
    },
  }
}
