/**
 * How many keeps this child has ever brought down — the one thing that buys the
 * wind, and then widens it.
 *
 * The wind used to arrive because the ladder had moved. That sounds like the same
 * thing and it is not, and the difference is measurable. `game.ts` climbs the
 * difficulty it asks for by a notch every wave and sweeps, wrapping, when a rung's
 * answers will not fit on 122 metres — so the rung a child is served oscillates.
 * Driven through the real game against the faithful ladder harness on
 * `origin/main`, the wind cap by wave came out:
 *
 *     wave  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
 *     cap   0  0  0  3  3  4  4  0  0  0  0  0  0  3  3  4  4  0  0  0
 *
 * The wind switched on at wave 4, switched OFF at wave 8, came back at 14 and went
 * again at 18 — for reasons that are entirely invisible from where the child is
 * sitting, and none of which are anything she did. A mechanic that appears and
 * disappears is not a difficulty step; it is weather in the pejorative sense.
 *
 * So it is bought instead, with right answers: a keep on the ground is a sum worked
 * out and a boulder put on the metre, and nothing else fells one. That is the only
 * signal that separates "has never played TREBUCHET" from "can already do this". It
 * is not accuracy and it is not a score — a child who takes six goes at a keep and
 * fells it has demonstrated the thing this counts, and nothing here holds the other
 * five against her.
 *
 * One counter, not two, and that is what makes every step of the ramp reachable.
 * The first twelve are NECESSARILY felled in still air, because there is no wind
 * below twelve — so the first step is bought by fluency at the one-step game, for
 * free, with no second bookkeeping. The twelve after that are felled in a wind, so
 * the wider wind is bought by fluency at the two-step game. A version of this that
 * counted only still-air kills was written first and measured: a child playing
 * perfectly froze at fifteen and could never reach the top step at all, because the
 * currency stopped being earnable the moment she crossed the first threshold.
 *
 * Once bought it is never taken back, in this sitting or any other, which is the
 * whole point: the rule about what a right answer looks like changes exactly once.
 *
 * **`localStorage` throws inside a pack frame.** The document is on an opaque
 * origin, so every access is guarded and the value is held in memory as well. When
 * storage is unreachable the failure mode is that a child meets the still-air game
 * again next sitting — extra practice at a thing she is already good at, which is
 * the right way round. The other way round is a second arithmetic step arriving
 * unannounced on a child who has never landed a boulder.
 */

// gitleaks: a dotted string constant assigned to a `*_KEY` name reads as a
// credential to every secret scanner there is. It is a storage slot name.
const FELLED_SLOT = 'dw.trebuchet.felled' // gitleaks:allow

let memory = 0
let loaded = false

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch (error) {
    console.warn('[trebuchet] localStorage is not reachable from this frame', error)
    return null
  }
}

/** Keeps felled, ever, across every sitting this device remembers. */
export function felledEver(): number {
  if (loaded) return memory
  loaded = true
  const slot = store()
  if (slot) {
    try {
      const raw = Number(slot.getItem(FELLED_SLOT) ?? '0')
      if (Number.isFinite(raw) && raw > 0) memory = Math.floor(raw)
    } catch (error) {
      console.warn('[trebuchet] the felled-keep count could not be read back', error)
    }
  }
  return memory
}

/** One more. Returns the new total. */
export function noteFelled(): number {
  const next = felledEver() + 1
  memory = next
  const slot = store()
  if (slot) {
    try {
      slot.setItem(FELLED_SLOT, String(next))
    } catch (error) {
      console.warn('[trebuchet] the felled-keep count could not be written', error)
    }
  }
  return next
}

/** Tests own the module's state; nothing in the game calls this. */
export function resetFelledForTest(): void {
  memory = 0
  loaded = false
}
