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
  /**
   * 0..7, the rung of the ladder the stub sits on.
   *
   * **A `level` PINS the stub.** The game now asks for a difficulty on every deal
   * (see `dealer.ts`), so without a pin a stub would follow the game's own ladder
   * and a test that wanted to sweep every rung would only ever see the rungs the
   * bot happened to climb to. With a pin the stub serves that rung and ignores the
   * request, which is what "play this rung for me" means.
   */
  level?: number
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  onNext?: (difficulty: number) => void
  onSkip?: (questionId: string) => void
  onHaptic?: (k: string) => void
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0x7a1e5)
  let served = 0

  return {
    next(o) {
      const asked = o?.difficulty
      const level = Math.max(
        0,
        Math.min(
          7,
          Math.round(opts.level ?? (asked === undefined ? 3 : asked * 8)),
        ),
      )
      opts.onNext?.(o?.difficulty ?? -1)
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

    // The third ending. A stub host has no ledger to close, so all this does is
    // let the dev harness show that a lapse went across as a skip and NOT as a
    // report — which is the whole of what the real one guarantees.
    skip(questionId) {
      opts.onSkip?.(questionId)
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
