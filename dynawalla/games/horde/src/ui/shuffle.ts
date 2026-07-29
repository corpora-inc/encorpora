/**
 * Where the answer goes, and what nothing may say about it.
 *
 * COUNTERPOISE shipped with the answer sitting in a predictable place and a bot
 * that did no arithmetic at all scored 97.2%. Any surface here that lays out
 * candidates — the RIFT's four buttons, the SEALED CACHE's orbs, the CORE's
 * three world orbs — has to be free of that, in two separate ways:
 *
 *   1. **Position must be uniform.** This function is the only shuffle any of
 *      them uses, and `shuffle.test.ts` measures the distribution rather than
 *      trusting the algorithm's name.
 *
 *   2. **Nothing may look different.** A uniform shuffle is worthless if one
 *      seat is painted. The RIFT used to call `.focus()` on the FIRST answer
 *      button as soon as the panel opened, which paints a focus ring on it: a
 *      founder playtest reported "the answer on the left for the rift appears
 *      highlighted". It was the leftmost seat, not the correct answer — the
 *      code never consulted `correct` — so it was a tell about position and not
 *      a giveaway of the answer. It is still a tell, and it is gone.
 */

import type { Question } from "../contract.ts"

/**
 * The answer and up to `count - 1` distractors, in a uniformly random order.
 *
 * `rng` is injected so the distribution can be measured; the game passes
 * nothing and gets `Math.random`.
 */
export function shuffleWithAnswer(q: Question, count = 4, rng: () => number = Math.random): string[] {
  const opts = [q.answer, ...q.distractors.slice(0, count - 1)]
  // Fisher-Yates, downward. `j` must be able to equal `i`, or position 0 is
  // starved and the answer drifts to the right — the exact defect class above.
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = opts[i] as string
    opts[i] = opts[j] as string
    opts[j] = t
  }
  return opts
}
