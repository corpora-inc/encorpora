// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createQuestInterlude, type NextQuestOption } from "./questInterlude"

// jsdom/happy-dom lack WebAudio + matchMedia; stub them so the interlude runs.
beforeEach(() => {
  document.body.innerHTML = ""
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("reduce"), // reduced-motion ON → no timers/audio, instant picker
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }))
})

const OPTIONS: NextQuestOption[] = [
  { id: "es-market-haggle", title: "A Deal at the Market", whereToGo: "the market", whatToDo: "Ask the price" },
  { id: "es-directions", title: "Which Way?", whereToGo: "the fountain", whatToDo: "Ask for directions" },
]

function mountOverlay(): HTMLElement {
  const overlay = document.createElement("div")
  overlay.className = "wp-overlay"
  document.body.appendChild(overlay)
  return overlay
}

describe("createQuestInterlude — celebration + next-quest picker", () => {
  it("renders the celebration header, the completed title, and the options", async () => {
    const overlay = mountOverlay()
    const interlude = createQuestInterlude({
      overlay,
      completedQuestTitle: "Coffee on the Plaza",
      reward: { xp: 50, coins: 10 },
      options: OPTIONS,
    })
    const p = interlude.show()
    // Let the reduced-motion (instant) reveal timer flush.
    await new Promise((r) => setTimeout(r, 220))

    expect(overlay.querySelector(".wp-qi-title")?.textContent).toContain("complete")
    expect(overlay.querySelector(".wp-qi-subtitle")?.textContent).toContain("Coffee on the Plaza")
    const cards = overlay.querySelectorAll(".wp-qi-card")
    expect(cards).toHaveLength(2)
    expect(cards[0].textContent).toContain("A Deal at the Market")
    expect(cards[0].textContent).toContain("the market")

    interlude.dispose()
    await expect(p).resolves.toBeNull()
  })

  it("resolves the chosen quest id when a card is picked", async () => {
    const overlay = mountOverlay()
    const interlude = createQuestInterlude({
      overlay,
      completedQuestTitle: "Coffee on the Plaza",
      reward: { xp: 50 },
      options: OPTIONS,
    })
    const p = interlude.show()
    await new Promise((r) => setTimeout(r, 220))

    const cards = overlay.querySelectorAll<HTMLButtonElement>(".wp-qi-card")
    cards[1].click() // pick "es-directions"

    await expect(p).resolves.toEqual({ chosenQuestId: "es-directions" })
  })

  it("the opt-out resolves null (dignified, no forced choice)", async () => {
    const overlay = mountOverlay()
    const interlude = createQuestInterlude({
      overlay,
      completedQuestTitle: "X",
      reward: {},
      options: OPTIONS,
    })
    const p = interlude.show()
    await new Promise((r) => setTimeout(r, 220))
    overlay.querySelector<HTMLButtonElement>(".wp-qi-notnow")!.click()
    await expect(p).resolves.toBeNull()
  })

  it("runs a SLOW staged cinema (picker not shown instantly; Skip fast-forwards)", async () => {
    // Full-motion: matchMedia("reduce") → false, so the real timeline runs.
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }))
    const overlay = mountOverlay()
    const interlude = createQuestInterlude({
      overlay,
      completedQuestTitle: "Coffee on the Plaza",
      reward: { xp: 50, coins: 120 },
      options: OPTIONS,
    })
    const p = interlude.show()

    // Shortly after open: the celebration is up but the picker is NOT yet
    // interactive (the whole point — no rushed flash to the choice).
    await new Promise((r) => setTimeout(r, 120))
    const picker = overlay.querySelector(".wp-qi-picker")!
    expect(picker.classList.contains("wp-qi-picker--in")).toBe(false)
    expect(picker.classList.contains("wp-qi-picker--pending")).toBe(true)
    // The staged tally rendered both reward lines (XP + a coin total).
    expect(overlay.querySelectorAll(".wp-qi-line").length).toBe(2)
    // A Skip affordance is offered for repeat players.
    const skip = overlay.querySelector<HTMLButtonElement>(".wp-qi-skip")!
    expect(skip).toBeTruthy()

    // Skip fast-forwards straight to the (interactive) picker — no waiting out
    // the whole timeline.
    skip.click()
    await new Promise((r) => setTimeout(r, 20))
    expect(picker.classList.contains("wp-qi-picker--in")).toBe(true)

    // And it's still a real choice: picking a card resolves its id.
    overlay.querySelectorAll<HTMLButtonElement>(".wp-qi-card")[0].click()
    await expect(p).resolves.toEqual({ chosenQuestId: "es-market-haggle" })
  })

  it("uses the t() seam for localized strings when it resolves", async () => {
    const overlay = mountOverlay()
    const t = (key: string) =>
      key === "interlude.title" ? "¡Misión completada!" : key
    const interlude = createQuestInterlude({
      overlay,
      completedQuestTitle: "X",
      reward: {},
      options: OPTIONS,
      t,
    })
    const p = interlude.show()
    await new Promise((r) => setTimeout(r, 220))
    expect(overlay.querySelector(".wp-qi-title")?.textContent).toBe("¡Misión completada!")
    interlude.dispose()
    await p
  })
})
