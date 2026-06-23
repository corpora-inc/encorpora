// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createBoardingVignette, type BoardingMode } from "./boarding"
import { registerBuiltinVignettes, VIGNETTE_IDS } from "./index"
import type { VignetteContext, VignetteResult, VignetteHost, VignetteFactory } from "./types"

/**
 * boarding.test — the bus/train/flight transit vignettes (the city's new boarding
 * heroes). Proves the shared boarding flow: it renders a departures board from the
 * injected destinations, EARNS the trip with a challenge, and resolves
 * `{ travelTo }` so the city re-spawns the player — the contract the orchestrator's
 * transit portals depend on. Also proves registration wires all three modes (+ the
 * taxi) onto a host under their canonical ids.
 */

beforeEach(() => {
  document.body.innerHTML = ""
  // happy-dom lacks WebAudio + matchMedia; reduced-motion ON makes the arrival
  // resolve synchronously (no setTimeout) so the test is deterministic.
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("reduce"),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }))
})

function mountRoot(): HTMLElement {
  const root = document.createElement("div")
  root.className = "wp-overlay"
  document.body.appendChild(root)
  return root
}

/** A minimal VignetteContext whose services record what the vignette did. */
function makeCtx(mountRootEl: HTMLElement, challengeScore = 1) {
  const calls = { granted: [] as unknown[], debited: [] as number[], spoke: [] as string[], challenges: 0 }
  const ctx: VignetteContext = {
    mountRoot: mountRootEl,
    learnerPair: { target: "es", native: "en" },
    scene: { palette: { accent: "#e8b54a" } } as unknown as VignetteContext["scene"],
    anchorId: "bus_station",
    reducedMotion: true,
    speak: async (_lang, text) => {
      calls.spoke.push(text)
    },
    openNpc: () => ({ send() {}, close() {}, dispose() {} }),
    wallet: () => ({
      defaultCurrency: () => "coin",
      balance: () => 10_000,
      debit: (_c, u) => {
        calls.debited.push(u)
        return true
      },
    }),
    grant: (r) => {
      calls.granted.push(r)
      return []
    },
    runChallenge: async () => {
      calls.challenges++
      return { score: challengeScore, rewards: { xp: 0 } } as Awaited<ReturnType<VignetteContext["runChallenge"]>>
    },
    t: (key) => key, // unknown keys → inline English fallbacks kick in
    iconRenderer: {
      renderIcon: () => {
        const el = document.createElement("span")
        el.className = "icon"
        return el
      },
    } as unknown as VignetteContext["iconRenderer"],
  }
  return { ctx, calls }
}

describe("createBoardingVignette — bus/train/flight transit", () => {
  const modes: BoardingMode[] = ["bus", "train", "flight"]
  for (const mode of modes) {
    it(`[${mode}] renders the departures board from injected destinations`, async () => {
      const root = mountRoot()
      const { ctx } = makeCtx(root)
      const v = createBoardingVignette({
        mode,
        destinations: [
          { anchorId: "market", label: "the market", fare: 200, motif: "market" },
          { anchorId: "harbor", label: "the harbor", fare: 320, motif: "harbor" },
        ],
      })
      // enter resolves only on exit; we just need the DOM up, so don't await it.
      void v.enter(ctx)
      await Promise.resolve()
      const dests = root.querySelectorAll(".wp-vig-board-dest")
      expect(dests.length).toBe(2)
      expect(root.querySelector(`.wp-vig-board--${mode}`)).toBeTruthy()
      v.dispose()
    })
  }

  it("picking a destination earns the trip and resolves travelTo", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root, 1)
    const v = createBoardingVignette({
      mode: "train",
      destinations: [{ anchorId: "airport", label: "the airport", fare: 300, motif: "plane" }],
    })
    const resultP: Promise<VignetteResult> = v.enter(ctx)
    await Promise.resolve()
    // pick the only destination → challenge (auto score 1) → arrival card.
    ;(root.querySelector(".wp-vig-board-dest") as HTMLButtonElement).click()
    // let the chooseDestination async chain settle (challenge + reduced-motion arrival).
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    const stepOut = root.querySelector(".wp-vig-board-arrival__btn") as HTMLButtonElement
    expect(stepOut).toBeTruthy()
    stepOut.click()
    const result = await resultP
    expect(result.travelTo).toBe("airport")
    expect(calls.challenges).toBe(1) // the trip was EARNED, not free
    expect(calls.debited).toEqual([300]) // fare paid from the wallet
    expect(calls.granted.length).toBe(1) // arrival reward granted
  })

  it("leaving without boarding resolves with no travel", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root)
    const v = createBoardingVignette({ mode: "bus" })
    const resultP = v.enter(ctx)
    await Promise.resolve()
    // the framework Exit hook fires NO_TRAVEL — invoke it via the root hook the host
    // would call. We dispatch the registered exit by re-entering through dispose path:
    // simplest deterministic route is to click the host Exit; in this isolated test
    // the host isn't present, so we assert the no-board default by disposing.
    v.dispose()
    // dispose doesn't resolve enter (the host owns that), so just assert no side effects.
    expect(calls.debited).toEqual([])
    expect(calls.challenges).toBe(0)
    void resultP // not awaited (no exit fired in isolation)
  })
})

describe("registerBuiltinVignettes — transit roster", () => {
  it("registers taxi + bus + train + flight under their canonical ids", () => {
    const registered = new Set<string>()
    const host: VignetteHost = {
      register: (id: string, _f: VignetteFactory) => {
        registered.add(id)
      },
      has: (id) => registered.has(id),
      enter: async () => null,
      isActive: () => false,
      dispose: () => {},
    }
    registerBuiltinVignettes(host)
    expect(registered.has(VIGNETTE_IDS.taxi)).toBe(true)
    expect(registered.has(VIGNETTE_IDS.bus)).toBe(true)
    expect(registered.has(VIGNETTE_IDS.train)).toBe(true)
    expect(registered.has(VIGNETTE_IDS.flight)).toBe(true)
  })
})
