// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest"
import { readAloud } from "./tools/sttTools"
import type { OverlayApi } from "./overlay"
import type { ChallengeRuntimeHost, ChallengeEntry } from "./host"

/**
 * #65 — a SPEAK challenge must NEVER trap the player. When STT reports AVAILABLE
 * but the mic/record throws mid-record, the tool must fall back to the SAME
 * self-rate buttons the STT-unavailable path shows (not sit at an erroring mic).
 *
 * Reproduces the on-device dead-end: `sttAvailable()===true` (corpan has
 * whisper.cpp) but `recordAndScore` throws → before the fix the mic just errored
 * and the player was stuck. After the fix, self-rate appears and completes.
 */

const ENTRY: ChallengeEntry = {
  entry_id: 1,
  level: "A1",
  domains: ["travel"],
  source: "test",
  translations: [
    { language_code: "es", text: "un café, por favor", romanization: "" },
    { language_code: "en", text: "a coffee, please", romanization: "" },
  ],
}

/** A minimal real-DOM OverlayApi; captures `complete`. */
function makeOverlay(): { api: OverlayApi; completed: () => { score: number } | null } {
  const body = document.createElement("div")
  document.body.appendChild(body)
  let result: { score: number } | null = null
  const api = {
    body,
    setPrompt: () => {},
    setInstruction: () => {},
    feedback: () => {},
    speak: () => Promise.resolve(),
    complete: (score01: number) => {
      result = { score: score01 }
    },
  } as unknown as OverlayApi
  return { api, completed: () => result }
}

/** A host that reports STT available but THROWS on recordAndScore (the trap). */
function makeThrowingSttHost(): ChallengeRuntimeHost {
  return {
    getRandomEntries: async () => [ENTRY],
    getEntriesByIds: async () => [ENTRY],
    sttAvailable: async () => true,
    recordAndScore: async () => {
      throw new Error("mic blew up")
    },
    speak: async () => {},
  } as unknown as ChallengeRuntimeHost
}

const tick = () => new Promise((r) => setTimeout(r, 0))
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe("#65 — speak challenge falls back to self-rate when the mic errors", () => {
  it("STT 'available' but recordAndScore throws → self-rate buttons appear + completing them resolves the challenge", async () => {
    vi.useRealTimers()
    const { api, completed } = makeOverlay()
    const host = makeThrowingSttHost()

    readAloud.run(api, { tool: "read-aloud", language: "es", nativeLanguage: "en" } as never, host)
    // Let firstSpeakable + recordUI mount.
    await tick()
    await tick()

    const mic = api.body.querySelector(".wp-ch-mic") as HTMLButtonElement | null
    expect(mic, "mic button mounted (STT reported available)").toBeTruthy()
    // No self-rate yet — the mic is showing.
    expect(api.body.querySelectorAll(".wp-ch-btn").length).toBe(1) // only the "Hear it" ghost btn

    // Tap the mic → recordAndScore throws → MUST swap in self-rate (not trap).
    mic!.click()
    await tick()
    await tick()

    // The mic is GONE, replaced by the self-rate buttons.
    expect(api.body.querySelector(".wp-ch-mic"), "mic replaced after error").toBeFalsy()
    const rateButtons = Array.from(api.body.querySelectorAll<HTMLButtonElement>(".wp-ch-actions .wp-ch-btn")).filter(
      (b) => b.textContent && /tough|okay|nailed|rate/i.test(b.textContent),
    )
    // There must be self-rate options to tap (3 of them).
    const allBtns = Array.from(api.body.querySelectorAll<HTMLButtonElement>(".wp-ch-btn"))
    const selfRate = allBtns.filter((b) => b !== api.body.querySelector(".wp-ch-btn--ghost"))
    expect(selfRate.length, "self-rate buttons present after mic error").toBeGreaterThanOrEqual(3)

    // Tapping one completes the challenge (never traps).
    expect(completed()).toBeNull()
    selfRate[selfRate.length - 1].click() // "nailed it" → 0.95
    // readAloud.run wraps overlay.complete in a 360ms setTimeout after the score.
    await wait(420)
    expect(completed(), "challenge completed via self-rate after mic error").not.toBeNull()
    expect(completed()!.score).toBeGreaterThan(0.5)
    void rateButtons
  })
})
