// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createFerryVignette } from "./ferry"
import { registerBuiltinVignettes, VIGNETTE_IDS } from "./index"
import { getRootHooks } from "./host"
import type { VignetteContext, VignetteFactory, VignetteHost } from "./types"

/**
 * ferry.test — the harbor ferry ride. Proves: the quay renders (boat + boatman
 * NPC reusing the harbor boatman id), riding debits the coin fare (waiving a
 * shortfall), the trip is a ROUND TRIP (no travelTo), and the ferry-token quest
 * item is NEVER touched — the es-guadalajara / harbor-ferry-ride steps that
 * live at this anchor stay intact. Registration wires `ferry` under its id.
 */

beforeEach(() => {
  document.body.innerHTML = ""
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

function makeCtx(mountRootEl: HTMLElement, opts: { balance?: number } = {}) {
  let balance = opts.balance ?? 9_999
  const calls = {
    granted: [] as Array<{ xp?: number; items?: string[] }>,
    debits: [] as number[],
    npcIds: [] as string[],
  }
  const ctx: VignetteContext = {
    mountRoot: mountRootEl,
    learnerPair: { target: "es", native: "en" },
    scene: { palette: { accent: "#e8b54a" } } as unknown as VignetteContext["scene"],
    anchorId: "harbor",
    reducedMotion: true,
    speak: async () => {},
    openNpc: (args) => {
      calls.npcIds.push(args.npcId)
      return { send() {}, close() {}, dispose() {} }
    },
    wallet: () => ({
      defaultCurrency: () => "coin",
      balance: () => balance,
      debit: (_c, units) => {
        if (units > balance) return false
        balance -= units
        calls.debits.push(units)
        return true
      },
    }),
    grant: (r) => {
      calls.granted.push(r)
      return r.items ?? []
    },
    runChallenge: async () =>
      ({ score: 1, rewards: { xp: 0 } }) as Awaited<ReturnType<VignetteContext["runChallenge"]>>,
    t: (key) => key,
    iconRenderer: {
      renderIcon: () => document.createElement("span"),
    } as unknown as VignetteContext["iconRenderer"],
  }
  return { ctx, calls }
}

describe("createFerryVignette — the harbor ferry", () => {
  it("renders the quay: boat, skyline, ride button, and the SAME boatman id", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root)
    const v = createFerryVignette({ boatmanId: "harbor-boatman" })
    void v.enter(ctx)
    await Promise.resolve()
    expect(root.querySelector(".wp-vig-ferry-boat")).toBeTruthy()
    expect(root.querySelector(".wp-vig-ferry-skyline")).toBeTruthy()
    expect(root.querySelector(".wp-vig-ferry-btn")).toBeTruthy()
    expect(calls.npcIds).toEqual(["harbor-boatman"]) // sticky voice preserved
    v.dispose()
  })

  it("a ride: fare debited, xp granted, ROUND TRIP (no travelTo), token untouched", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root)
    const v = createFerryVignette({ questStep: "ferry-sightseeing" })
    const done = v.enter(ctx)
    await Promise.resolve()
    root.querySelector<HTMLButtonElement>(".wp-vig-ferry-btn")!.click()
    const result = await vi.waitFor(async () => await done, { timeout: 15_000 })
    expect(calls.debits).toEqual([220]) // the coin fare — exactly once
    // the ferry-token is a GRANT-side item; the ride must never touch items at all
    for (const g of calls.granted) expect(g.items ?? []).toEqual([])
    expect((calls.granted[0]?.xp ?? 0)).toBeGreaterThan(0)
    expect(result.travelTo).toBeUndefined() // home to the same quay
    expect(result.questStep).toBe("ferry-sightseeing")
    v.dispose()
  }, 20_000)

  it("a short wallet is waived, never a wall", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root, { balance: 60 }) // fare is 220
    const v = createFerryVignette()
    const done = v.enter(ctx)
    await Promise.resolve()
    root.querySelector<HTMLButtonElement>(".wp-vig-ferry-btn")!.click()
    await vi.waitFor(async () => await done, { timeout: 15_000 })
    expect(calls.debits).toEqual([60])
    v.dispose()
  }, 20_000)

  it("leaving from the quay without riding resolves empty", async () => {
    const root = mountRoot()
    const { ctx } = makeCtx(root)
    const v = createFerryVignette({ questStep: "ferry-sightseeing" })
    const done = v.enter(ctx)
    await Promise.resolve()
    getRootHooks(root)!.exit({})
    const result = await done
    expect(result.questStep).toBeUndefined()
    expect(result.rewards).toBeUndefined()
    v.dispose()
  })
})

describe("registration", () => {
  it("registerBuiltinVignettes wires the ferry under its canonical id", () => {
    const registered = new Map<string, VignetteFactory>()
    const host: VignetteHost = {
      register: (id, f) => void registered.set(id, f),
      has: (id) => registered.has(id),
      enter: async () => null,
      isActive: () => false,
      dispose() {},
    }
    registerBuiltinVignettes(host)
    expect(registered.has(VIGNETTE_IDS.ferry)).toBe(true)
    const v = registered.get(VIGNETTE_IDS.ferry)!()
    expect(typeof v.enter).toBe("function")
    v.dispose()
  })
})
