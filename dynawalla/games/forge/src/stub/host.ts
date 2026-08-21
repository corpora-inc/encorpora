// The local stub Host. Standalone `npm run dev` runs against this; the app
// swaps in the real one and this file stops being imported.

import type { Host, Question } from "../contract.ts"
import { makeRng } from "../core/rng.ts"
import { generate } from "./questions.ts"

export type StubOptions = {
  seed?: number
  /** Starting difficulty, 0..1. */
  level?: number
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
}

/**
 * Difficulty walks with the player: a fast correct answer nudges it up, a slow
 * one holds, a wrong one steps it back further than a right one moved it. The
 * real adaptive engine does this properly; this is enough that a competent
 * ten-year-old is doing 12 x 11 and exponent products twenty minutes in rather
 * than still adding 4 + 5.
 */
export function makeStubHost(opts: StubOptions = {}): Host & { level(): number } {
  const rng = makeRng(opts.seed ?? 0x5f0a9e)
  let level = opts.level ?? 0.05
  let reduced = false
  const mq =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null
  if (mq) {
    reduced = mq.matches
    mq.addEventListener?.("change", (e) => {
      reduced = e.matches
    })
  }

  const vibrate = (ms: number | number[]): void => {
    // Web fallback. Under Tauri the app routes this to tauri-plugin-haptics;
    // anywhere else it silently does nothing, which is the required behaviour.
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(ms)
      } catch {
        /* some browsers throw on gesture-less vibrate; ignore */
      }
    }
  }

  return {
    next(): Question {
      return generate(rng, level)
    },
    report(r) {
      if (r.correct) level += r.ms < 3500 ? 0.035 : 0.012
      else level -= 0.07
      level = Math.max(0, Math.min(1, level))
      opts.onReport?.(r)
    },
    haptic(kind) {
      switch (kind) {
        case "light":
          vibrate(8)
          break
        case "medium":
          vibrate(18)
          break
        case "heavy":
          vibrate(38)
          break
        case "success":
          vibrate([14, 40, 26])
          break
        case "failure":
          vibrate([34, 60, 34])
          break
      }
    },
    prefersReducedMotion: () => reduced,
    level: () => level,
  }
}
