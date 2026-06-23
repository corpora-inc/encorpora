import { describe, it, expect } from "vitest"
import type { LearnerPair } from "@corpan-city/contracts"
import { bindStackReactivity, type StackConfig } from "./index"

/**
 * Regression for the owner's "I chose Spanish, the NPC speaks Arabic" bug.
 *
 * The REAL host (corpan-app `onStackConfigChange`) fires its listener IMMEDIATELY
 * on subscribe (hostApi.ts: `emit()` before returning). The old reactivity
 * rebound to `defaultPairFor` = the stack's FIRST target, so an EN-native learner
 * of [AR, ES] who picked ES had the world instantly rebuilt in AR the moment it
 * mounted. The fix: preserve the CHOSEN target whenever it's still in the stack.
 */

// A fake host that mirrors corpan-app: onStackConfigChange EMITS ON SUBSCRIBE,
// then again on every flip.
function makeHost(initial: StackConfig) {
  let stack = initial
  let listener: ((c: StackConfig) => void) | null = null
  return {
    host: {
      getStackConfig: () => stack,
      onStackConfigChange: (l: (c: StackConfig) => void) => {
        listener = l
        l(stack) // immediate emit — the exact trigger that clobbered the choice
        return () => {
          listener = null
        }
      },
    },
    flip: (next: StackConfig) => {
      stack = next
      listener?.(stack)
    },
  }
}

const S = (langs: string[]): StackConfig => ({ activeStackId: "s", languages: langs })

describe("bindStackReactivity — preserves the chosen target", () => {
  it("does NOT clobber a chosen non-first target on the immediate emit (EN→ES, not AR)", () => {
    const { host } = makeHost(S(["en", "ar", "es"]))
    let pair: LearnerPair = { target: "es", native: "en" } // the player picked Spanish
    const changes: LearnerPair[] = []
    bindStackReactivity(
      host,
      () => pair,
      (next) => {
        changes.push(next)
        pair = next
      },
    )
    // The host already emitted on subscribe. ES is still a valid target → no rebind.
    expect(changes).toEqual([])
    expect(pair).toEqual({ target: "es", native: "en" })
  })

  it("rebinds to a remaining target ONLY when the chosen target is removed", () => {
    const { host, flip } = makeHost(S(["en", "ar", "es"]))
    let pair: LearnerPair = { target: "es", native: "en" }
    bindStackReactivity(
      host,
      () => pair,
      (next) => {
        pair = next
      },
    )
    flip(S(["en", "ar"])) // ES removed from the stack
    expect(pair).toEqual({ target: "ar", native: "en" })
  })

  it("keeps the chosen target but follows a primary (native) change", () => {
    const { host, flip } = makeHost(S(["en", "ar", "es"]))
    let pair: LearnerPair = { target: "es", native: "en" }
    bindStackReactivity(
      host,
      () => pair,
      (next) => {
        pair = next
      },
    )
    flip(S(["fr", "es", "ar"])) // primary EN→FR, ES still a target
    expect(pair).toEqual({ target: "es", native: "fr" })
  })

  it("never fires onChange when nothing relevant changed (idempotent re-emit)", () => {
    const { host, flip } = makeHost(S(["en", "ar", "es"]))
    let pair: LearnerPair = { target: "es", native: "en" }
    const changes: LearnerPair[] = []
    bindStackReactivity(
      host,
      () => pair,
      (next) => {
        changes.push(next)
        pair = next
      },
    )
    flip(S(["en", "ar", "es"])) // an unrelated settings change re-emits the SAME stack
    flip(S(["en", "ar", "es"]))
    expect(changes).toEqual([])
  })
})
