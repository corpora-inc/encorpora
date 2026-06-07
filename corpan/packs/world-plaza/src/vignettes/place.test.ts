// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createPlaceVignette } from "./place"
import { registerBuiltinVignettes, VIGNETTE_IDS } from "./index"
import type { VignetteContext, VignetteResult, VignetteHost, VignetteFactory } from "./types"

/**
 * place.test — the enterable PLACE-interior vignette (#14, the café + shop
 * walk-ins). Proves the café flow: it renders a warm interior + a resident NPC,
 * the primary "Order" action EARNS the beat with a challenge and resolves
 * `{ questStep }` so the city advances the café-order quest. Also proves the shop
 * skin's commerce HANDOFF fires `onShop`, and that registration wires `cafe` onto
 * a host under its canonical id. (Perf note: the interior is pure DOM — no Babylon
 * mesh is created here, which is exactly why entering a building is perf-zero.)
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

function makeCtx(mountRootEl: HTMLElement, challengeScore = 1) {
  const calls = { granted: [] as unknown[], challenges: 0, opened: 0 }
  const ctx: VignetteContext = {
    mountRoot: mountRootEl,
    learnerPair: { target: "es", native: "en" },
    scene: { palette: { accent: "#e8b54a" } } as unknown as VignetteContext["scene"],
    anchorId: "cafe",
    reducedMotion: true,
    speak: async () => {},
    openNpc: () => {
      calls.opened++
      return { send() {}, close() {}, dispose() {} }
    },
    wallet: () => ({ defaultCurrency: () => "coin", balance: () => 9_999, debit: () => true }),
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
      renderIcon: () => document.createElement("span"),
    } as unknown as VignetteContext["iconRenderer"],
  }
  return { ctx, calls }
}

describe("createPlaceVignette — café interior", () => {
  it("renders the warm interior + a resident barista", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root)
    const v = createPlaceVignette({
      kind: "cafe",
      copyKey: "cafe",
      fallback: { sign: "Café", title: "Corner Café", sub: "Coffee", keeper: "the barista", greet: ["Welcome!"] },
      persona: { tone: "warm barista", quirks: [] },
      objective: { label: ["k", "Order a coffee"], tool: "translate-fast", questStep: "order" },
    })
    void v.enter(ctx)
    await Promise.resolve()
    expect(root.querySelector(".wp-vig-place--cafe")).toBeTruthy()
    expect(root.querySelector(".wp-vig-place-keeper")).toBeTruthy()
    expect(calls.opened).toBe(1) // the barista conversation opened
    expect(root.querySelector(".wp-vig-place-btn--primary")).toBeTruthy()
    v.dispose()
  })

  it("ordering earns the beat, grants the reward, and resolves the quest step", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root, 1)
    const v = createPlaceVignette({
      kind: "cafe",
      copyKey: "cafe",
      fallback: { sign: "Café", title: "Corner Café", sub: "Coffee", keeper: "the barista", greet: ["Welcome!"] },
      persona: { tone: "warm barista", quirks: [] },
      objective: { label: ["k", "Order a coffee"], tool: "translate-fast", questStep: "order", reward: { xp: 12 } },
    })
    const resultP: Promise<VignetteResult> = v.enter(ctx)
    await Promise.resolve()
    ;(root.querySelector(".wp-vig-place-btn--primary") as HTMLButtonElement).click()
    const result = await resultP
    expect(calls.challenges).toBe(1) // the order was EARNED, not free
    expect(calls.granted).toEqual([{ xp: 12 }]) // reward granted
    expect(result.questStep).toBe("order") // the city advances the café step
  })

  it("a shop skin hands off to commerce via onShop", async () => {
    const root = mountRoot()
    const { ctx } = makeCtx(root)
    let shopOpened = 0
    const v = createPlaceVignette({
      kind: "shop",
      copyKey: "general_store",
      fallback: { sign: "Store", title: "General Store", sub: "Goods", keeper: "the keeper", greet: ["Welcome!"] },
      persona: { tone: "keeper", quirks: [] },
      onShop: () => {
        shopOpened++
      },
      shopLabel: ["k", "Browse the shelves"],
    })
    void v.enter(ctx)
    await Promise.resolve()
    const browse = root.querySelector(".wp-vig-place-btn--shop") as HTMLButtonElement
    expect(browse).toBeTruthy()
    browse.click()
    expect(shopOpened).toBe(1)
    v.dispose()
  })
})

describe("the civic-interior kinds (clinic / civic) + the buying objective", () => {
  it("clinic and civic skins render with their own room classes", async () => {
    for (const kind of ["clinic", "civic"] as const) {
      document.body.innerHTML = ""
      const root = mountRoot()
      const { ctx } = makeCtx(root)
      const v = createPlaceVignette({
        kind,
        copyKey: kind,
        fallback: { sign: "X", title: "X", sub: "x", keeper: "the keeper", greet: ["Hi!"] },
        persona: { tone: "kind", quirks: [] },
      })
      void v.enter(ctx)
      await Promise.resolve()
      expect(root.querySelector(`.wp-vig-place--${kind}`), kind).toBeTruthy()
      expect(root.querySelector(".wp-vig-place-keeper")).toBeTruthy()
      v.dispose()
    }
  })

  it("a priced objective DEBITS the wallet (and waives a shortfall)", async () => {
    const root = mountRoot()
    let balance = 100 // loaf costs 240 — short on purpose
    const debits: number[] = []
    const { ctx, calls } = makeCtx(root)
    ctx.wallet = () => ({
      defaultCurrency: () => "coin",
      balance: () => balance,
      debit: (_c, units) => {
        if (units > balance) return false
        balance -= units
        debits.push(units)
        return true
      },
    })
    const v = createPlaceVignette({
      kind: "cafe",
      copyKey: "bakery",
      fallback: { sign: "Bakery", title: "Bakery", sub: "Bread", keeper: "the baker", greet: ["Hi!"] },
      persona: { tone: "proud baker", quirks: [] },
      objective: {
        label: ["k", "Buy a loaf"],
        tool: "translate-fast",
        price: 240,
        reward: { xp: 10, items: ["fresh-bread"] },
      },
    })
    const resultP = v.enter(ctx)
    await Promise.resolve()
    ;(root.querySelector(".wp-vig-place-btn--primary") as HTMLButtonElement).click()
    const result = await resultP
    expect(debits).toEqual([100]) // charged what they had — waived, not walled
    expect(balance).toBe(0)
    expect(calls.granted).toEqual([{ xp: 10, items: ["fresh-bread"] }]) // the loaf is theirs
    expect(result.questStep).toBeUndefined() // the bakery binds no quest
    v.dispose()
  })
})

describe("registerBuiltinVignettes — café", () => {
  it("registers the café under its canonical id", () => {
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
    expect(registered.has(VIGNETTE_IDS.cafe)).toBe(true)
  })
})
