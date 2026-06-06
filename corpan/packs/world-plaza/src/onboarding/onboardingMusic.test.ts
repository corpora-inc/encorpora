// @vitest-environment happy-dom
/**
 * The onboarding MUSIC CONSENT step is the gate that keeps the city radio from
 * starting "from nowhere" (world-plaza-onboarding-music-consent). These tests
 * assert the contract that matters: the step writes the player's CHOICE to the
 * persisted music profile — "Yes" → enabled + a concrete station/volume to resume,
 * "No" → enabled:false — and skipping setup never silently turns music on.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { runOnboarding } from "./onboarding"
import { musicProfileStore } from "../audio/musicProfile"
import { POC_STATIONS } from "../audio/cityRadio"

let root: HTMLElement

beforeEach(() => {
  localStorage.clear()
  document.body.replaceChildren()
  root = document.createElement("div")
  document.body.appendChild(root)
})

/** Click the first button whose text matches `re` inside the onboarding card. */
function click(re: RegExp): void {
  const btns = Array.from(document.querySelectorAll<HTMLButtonElement>(".wp-onb-btn"))
  const btn = btns.find((b) => re.test(b.textContent ?? ""))
  if (!btn) throw new Error(`no onboarding button matching ${re} (saw: ${btns.map((b) => b.textContent).join(" | ")})`)
  btn.click()
}

describe("onboarding — music consent", () => {
  it('"Yes, play music" persists enabled + the default station + a volume to resume', async () => {
    const done = runOnboarding(root, { startStep: 3, native: "en" })
    click(/play music/i)
    await done
    const p = musicProfileStore.get()
    expect(p.enabled).toBe(true)
    expect(p.stationId).toBe(POC_STATIONS[0].id)
    expect(p.volume).toBeGreaterThan(0)
  })

  it('"No music, thanks" persists enabled:false (a remembered quiet)', async () => {
    const done = runOnboarding(root, { startStep: 3, native: "en" })
    click(/no music/i)
    await done
    expect(musicProfileStore.get().enabled).toBe(false)
  })

  it("Skipping setup never turns music on (default stays off)", async () => {
    const done = runOnboarding(root, { startStep: 0, native: "en" })
    // The always-present Skip resolves with defaults — and must not enable music.
    document.querySelector<HTMLButtonElement>(".wp-onb-skip")!.click()
    await done
    expect(musicProfileStore.get().enabled).toBe(false)
  })

  it("the flow now has FOUR step dots (welcome · name · dress · music)", () => {
    void runOnboarding(root, { startStep: 3, native: "en" })
    expect(document.querySelectorAll(".wp-onb-dot").length).toBe(4)
  })
})
