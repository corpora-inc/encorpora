// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { fastTranslate } from "./tools/choiceTools"
import type { OverlayApi } from "./overlay"
import type { ChallengeRuntimeHost, ChallengeEntry } from "./host"

/**
 * #67 — a multiple-choice challenge with 0 buildable rounds (missing/empty
 * content) must ABORT (cancel), NOT score a 0 → instant "Try again" fail. A scored
 * 0 on missing content is a silent dead-end that can trap a quest gate; an abort
 * resolves with outcome "aborted" so it's never counted against the player.
 */

/** An empty corpus → no pairs → 0 rounds (the content-gap that caused the fail). */
function makeEmptyHost(): ChallengeRuntimeHost {
  return {
    getRandomEntries: async () => [] as ChallengeEntry[],
    getEntriesByIds: async () => [] as ChallengeEntry[],
    sttAvailable: async () => false,
    recordAndScore: async () => ({ stop: async () => ({ score: 0, transcript: "", expected: "" }) }),
    speak: async () => {},
  } as unknown as ChallengeRuntimeHost
}

function makeOverlay(): {
  api: OverlayApi
  state: { completed: { score: number } | null; cancelled: boolean }
} {
  const body = document.createElement("div")
  document.body.appendChild(body)
  const state = { completed: null as { score: number } | null, cancelled: false }
  const api = {
    body,
    setPrompt: () => {},
    setInstruction: () => {},
    startTimer: () => {},
    stopTimer: () => {},
    setScore: () => {},
    setStreak: () => {},
    feedback: () => {},
    speak: () => Promise.resolve(),
    complete: (score01: number) => {
      state.completed = { score: score01 }
    },
    cancel: () => {
      state.cancelled = true
    },
  } as unknown as OverlayApi
  return { api, state }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe("#67 — MC challenge with 0 rounds aborts instead of scoring a fail", () => {
  it("empty corpus → 0 rounds → overlay.cancel() (abort), NOT complete(0) (fail)", async () => {
    const { api, state } = makeOverlay()
    const spec = {
      challengeId: "fast-translate-test",
      toolId: "fast-translate",
      language: "es",
      nativeLanguage: "en",
    }
    fastTranslate.run(api, spec as never, makeEmptyHost())
    // Let pickEntries + pairsOf + runSeries run; runSeries(0) cancels synchronously
    // after the async setup, with no 360ms complete() timer in the abort path.
    await wait(40)
    expect(state.cancelled, "0-rounds challenge aborted").toBe(true)
    expect(state.completed, "did NOT score a 0 fail").toBeNull()
  })
})
