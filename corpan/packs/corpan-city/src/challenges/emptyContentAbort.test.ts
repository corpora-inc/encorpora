// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import type { OverlayApi } from "./overlay"
import type { ChallengeRuntimeHost, ChallengeEntry } from "./host"
import type { ToolImpl } from "./tools/_shared"
import {
  pictureMatch,
  memoryPairs,
  categorySort,
  countdownRecall,
  wordSearch,
} from "./tools/gridTools"
import { wordScramble, buildSentence, dialogueFill } from "./tools/textTools"
import { fastTranslate, tapTranslation, trueFalse, listenChoose } from "./tools/choiceTools"

/**
 * FINAL-QA BLOCKER hardening (#67/#81): a content shortfall must DEGRADE
 * (overlay.cancel() → "aborted"), NEVER flash a 0% result card ("Score 0% / Not
 * this time / Claim reward"). The owner saw the latter when a broken languageCodes
 * filter starved the corpus. The root cause is fixed in resolveMinigameContent, but
 * the tools must ALSO be bulletproof: if a draw ever returns insufficient content,
 * every minigame aborts cleanly instead of scoring a 0 fail.
 *
 * This drives EVERY content-backed tool against an EMPTY host and asserts:
 *   - overlay.cancel() WAS called (the encounter re-picks/closes cleanly), and
 *   - overlay.complete() was NEVER called (no 0% flash-fail, no quest-gate trap).
 */

/** An empty corpus → no entries → no pairs → the content-gap that caused the fail. */
function makeEmptyHost(): ChallengeRuntimeHost {
  return {
    getRandomEntries: async () => [] as ChallengeEntry[],
    getEntriesByIds: async () => [] as ChallengeEntry[],
    searchEntries: async () => [] as ChallengeEntry[],
    sttAvailable: async () => false,
    recordAndScore: async () => ({
      stop: async () => ({ score: 0, transcript: "", expected: "" }),
      cancel: async () => {},
    }),
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
    focusSafely: () => {},
  } as unknown as OverlayApi
  return { api, state }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Every content-backed tool that must degrade rather than flash-fail. */
const CONTENT_TOOLS: ToolImpl[] = [
  // grid / memory family (the owner's "matching" minigame + siblings)
  pictureMatch,
  memoryPairs,
  categorySort,
  countdownRecall,
  wordSearch,
  // text family
  wordScramble,
  buildSentence,
  dialogueFill,
  // choice family
  fastTranslate,
  tapTranslation,
  trueFalse,
  listenChoose,
]

describe("empty/insufficient content → ABORT, never a 0% flash-fail (all tools)", () => {
  for (const tool of CONTENT_TOOLS) {
    it(`${tool.id}: empty corpus → overlay.cancel(), NOT complete(0)`, async () => {
      const { api, state } = makeOverlay()
      const spec = {
        challengeId: `${tool.id}-empty-test`,
        toolId: tool.id,
        language: "es",
        nativeLanguage: "en",
        params: {},
      }
      tool.run(api, spec as never, makeEmptyHost())
      // Let the async setup (pickEntries → pairs → guard) run. The abort path has no
      // 360ms complete() timer, so a short wait is enough to observe the decision.
      await wait(60)
      expect(state.cancelled, `${tool.id} aborted on empty content`).toBe(true)
      expect(state.completed, `${tool.id} did NOT score a 0% flash-fail`).toBeNull()
    })
  }
})
