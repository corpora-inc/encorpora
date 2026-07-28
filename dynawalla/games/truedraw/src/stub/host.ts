// A local stub Host so the game is playable standalone with `npm run dev`.
//
// It stands in for the runtime, not for the curriculum: it serves the same shape
// the real adapter serves — an exact canonical answer plus mal-rule distractors,
// most diagnostic first — so the statement builder behaves identically here and
// on a device.

import type { Host, Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { drawProblem, GLYPH } from "./questions.ts"

export type StubHostOptions = {
  seed?: number
  reducedMotion?: boolean
  /** 0..7, the rung of the ladder the stub sits on. */
  level?: number
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  onHaptic?: (k: string) => void
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0x7a1e5)
  let served = 0

  return {
    next(o) {
      const level = Math.max(
        0,
        Math.min(7, Math.round(o?.difficulty === undefined ? (opts.level ?? 3) : o.difficulty * 8)),
      )
      const drawn = drawProblem(level, rng)
      served++
      return {
        id: `stub-${String(served)}`,
        prompt: `${String(drawn.a)} ${GLYPH[drawn.op]} ${String(drawn.b)}`,
        answer: String(drawn.answer),
        distractors: drawn.distractors.map(String),
        domain: o?.domain ?? "add",
        difficulty: level / 8,
      } satisfies Question
    },

    report(r) {
      opts.onReport?.(r)
    },

    haptic(k) {
      opts.onHaptic?.(k)
      const nav = globalThis.navigator as Navigator | undefined
      if (!nav || typeof nav.vibrate !== "function") return
      const ms =
        k === "light" ? 8 : k === "medium" ? 18 : k === "heavy" ? 34 : k === "success" ? 12 : 40
      try {
        if (k === "success") nav.vibrate([ms, 26, ms])
        else nav.vibrate(ms)
      } catch {
        // A browser that exposes `vibrate` but refuses it — no user gesture yet,
        // or a policy block — must never take the frame down with it.
        console.warn("[truedraw] navigator.vibrate refused")
      }
    },

    prefersReducedMotion() {
      if (opts.reducedMotion !== undefined) return opts.reducedMotion
      return (
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    },
  }
}
