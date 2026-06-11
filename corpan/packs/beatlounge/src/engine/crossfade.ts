/**
 * beatlounge — make-before-break crossfade for insert-chain restructures.
 *
 * Reordering / adding / removing an insert changes the chain's structural
 * signature. The naive reconciler hard-disconnects `head` and disposes the
 * live nodes BEFORE the replacement exists → an audible gap. Instead we build
 * the new chain in PARALLEL (still fed by the same `head`), each chain
 * terminating in its own fade `Gain` before `tail`, then equal-power ramp the
 * old fade 1→0 and the new fade 0→1 over `CROSSFADE_SEC`. After the window we
 * dispose ONLY the connections/nodes the old chain owns (never the broad
 * `head.disconnect()`), so sends and other taps on `head` are untouched.
 *
 * This module is the pure scheduling/teardown brain; the audioGraph supplies
 * the live `ChainState` and the AudioContext clock. It owns no Tone imports
 * beyond the `Gain` type so it stays trivially testable with stubbed nodes.
 */

import type * as Tone from "tone"

/** ~250ms — "a few hundred milliseconds". */
export const CROSSFADE_SEC = 0.25

/** A live insert chain plus the bookkeeping the crossfade needs to tear it
 *  down surgically. `fade` is the unity gain every chain now terminates in
 *  (`…lastFx → fade → tail`); an EMPTY chain is just `head → fade → tail`. */
export interface ChainState {
  /** Live effects in order; [] when the chain is empty (direct head→fade). */
  effects: { input: Tone.ToneAudioNode; output: Tone.ToneAudioNode; dispose(): void }[]
  /** Structural signature the chain was last built from. */
  sig: string
  /** Terminating unity gain (`…→ fade → tail`); the crossfade ramps it. */
  fade: Tone.Gain
  /** The node `head` connects INTO for this chain (effects[0].input, or the
   *  fade for an empty chain) — so we can targeted-disconnect head→here. */
  headTarget: Tone.ToneAudioNode
}

interface CrossfadeDeps<C extends ChainState> {
  /** The shared head this chain hangs off of. */
  head: Tone.ToneAudioNode
  /** The shared tail both chains feed during the fade. */
  tail: Tone.ToneAudioNode
  /** The old chain to fade OUT then dispose. */
  old: C
  /** The freshly-built new chain (already wired head→…→newFade→tail, fade@0). */
  next: C
  /** AudioContext clock (seconds). */
  now: number
  /** Dispose a whole chain's effects (NOT its fade gain). */
  disposeChain: (chain: C) => void
}

/**
 * Equal-power crossfade `old → next`. Both chains are already live and feeding
 * `tail`; this ramps the two fade gains and returns an idempotent `finalize()`
 * that surgically tears the OLD chain down (its head connection, its fade→tail
 * connection, its effects, and its fade gain). The caller schedules `finalize`
 * at `now + CROSSFADE_SEC` and may call it early (a newer restructure arrived)
 * — calling it twice is a no-op, so there are no leaks and no stuck gain.
 */
export const startCrossfade = <C extends ChainState>(deps: CrossfadeDeps<C>): (() => void) => {
  const { head, tail, old, next, now, disposeChain } = deps
  const end = now + CROSSFADE_SEC

  // Equal-power-ish ramp on the AudioContext clock — no click, ~constant
  // loudness. setTargetAtTime with a time-constant that effectively lands by
  // `end`; we also pin the endpoints so it can't drift / stick.
  const tau = CROSSFADE_SEC / 3
  old.fade.gain.cancelScheduledValues(now)
  old.fade.gain.setValueAtTime(old.fade.gain.value, now)
  old.fade.gain.setTargetAtTime(0, now, tau)
  old.fade.gain.setValueAtTime(0, end)

  next.fade.gain.cancelScheduledValues(now)
  next.fade.gain.setValueAtTime(next.fade.gain.value, now)
  next.fade.gain.setTargetAtTime(1, now, tau)
  next.fade.gain.setValueAtTime(1, end)

  let done = false
  const finalize = () => {
    if (done) return
    done = true
    // Surgical teardown: only the connections THIS chain made.
    //   head → old.headTarget   and   old.fade → tail
    try {
      head.disconnect(old.headTarget)
    } catch {
      // headTarget may already be gone if disposed elsewhere; ignore.
    }
    try {
      old.fade.disconnect(tail)
    } catch {
      // tail wiring may already be torn down; ignore.
    }
    disposeChain(old)
    old.fade.dispose()
  }

  return finalize
}
