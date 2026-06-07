// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createFoodVignette, deliciousIn } from "./food"
import { registerBuiltinVignettes, VIGNETTE_IDS } from "./index"
import { getRootHooks } from "./host"
import type { VignetteContext, VignetteFactory, VignetteHost } from "./types"

/**
 * food.test — the street-food stand vignette. Proves: the stand renders (menu +
 * vendor NPC), an order DEBITS the wallet (and waives a shortfall instead of
 * walling), runs the order drill, grants xp, and leaving after ≥1 order resolves
 * the aggregated rewards (+ the injected quest step). Reduced-motion path: the
 * consume beat still resolves. Registration wires `food` under its canonical id.
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
    granted: [] as Array<{ xp?: number }>,
    challenges: 0,
    opened: 0,
    debits: [] as number[],
    spoke: [] as string[],
  }
  const ctx: VignetteContext = {
    mountRoot: mountRootEl,
    learnerPair: { target: "es", native: "en" },
    scene: { palette: { accent: "#e8b54a" } } as unknown as VignetteContext["scene"],
    anchorId: "fountain",
    reducedMotion: true,
    speak: async (_lang, text) => {
      calls.spoke.push(text)
    },
    openNpc: () => {
      calls.opened++
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
      return []
    },
    runChallenge: async () => {
      calls.challenges++
      return { score: 1, rewards: { xp: 0 } } as Awaited<ReturnType<VignetteContext["runChallenge"]>>
    },
    t: (key) => key, // unknown keys → inline English fallbacks kick in
    iconRenderer: {
      renderIcon: () => document.createElement("span"),
    } as unknown as VignetteContext["iconRenderer"],
  }
  return { ctx, calls, currentBalance: () => balance }
}

const exitVia = (root: HTMLElement) => {
  // fire the same leave the host's Exit button / ESC would
  const hooks = getRootHooks(root)
  expect(hooks, "registered root hooks (Exit affordance)").toBeTruthy()
  hooks!.exit({})
}

describe("createFoodVignette — the street-food stand", () => {
  it("renders the stand: menu items, vendor NPC, awning", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root)
    const v = createFoodVignette()
    void v.enter(ctx)
    await Promise.resolve()
    expect(root.querySelector(".wp-vig-food")).toBeTruthy()
    expect(root.querySelectorAll(".wp-vig-food-item").length).toBe(4)
    expect(root.querySelector(".wp-vig-food-vendor")).toBeTruthy()
    expect(calls.opened).toBe(1)
    v.dispose()
  })

  it("ordering debits the wallet, runs the drill, grants xp, speaks the payoff", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root)
    const v = createFoodVignette({ questStep: "grab-a-bite" })
    const done = v.enter(ctx)
    await Promise.resolve()
    const item = root.querySelector<HTMLButtonElement>(".wp-vig-food-item")!
    item.click()
    // reduced-motion consume resolves on a short timer
    await vi.waitFor(() => expect(calls.granted.length).toBe(1), { timeout: 3000 })
    expect(calls.debits).toEqual([300]) // pizza price, full charge
    expect(calls.challenges).toBe(1)
    expect((calls.granted[0].xp ?? 0)).toBeGreaterThan(0)
    expect(calls.spoke).toContain(deliciousIn("es"))
    exitVia(root)
    const result = await done
    expect(result.questStep).toBe("grab-a-bite")
    expect(result.rewards?.xp).toBe(calls.granted[0].xp)
    v.dispose()
  })

  it("a short wallet is WAIVED, never a wall (the taxi's grace)", async () => {
    const root = mountRoot()
    const { ctx, calls, currentBalance } = makeCtx(root, { balance: 100 }) // pizza costs 300
    const v = createFoodVignette()
    void v.enter(ctx)
    await Promise.resolve()
    root.querySelector<HTMLButtonElement>(".wp-vig-food-item")!.click()
    await vi.waitFor(() => expect(calls.granted.length).toBe(1), { timeout: 3000 })
    expect(calls.debits).toEqual([100]) // charged what they had…
    expect(currentBalance()).toBe(0) // …and not a unit more
    v.dispose()
  })

  it("leaving without ordering resolves an empty result", async () => {
    const root = mountRoot()
    const { ctx } = makeCtx(root)
    const v = createFoodVignette({ questStep: "grab-a-bite" })
    const done = v.enter(ctx)
    await Promise.resolve()
    exitVia(root)
    const result = await done
    expect(result.questStep).toBeUndefined()
    expect(result.rewards).toBeUndefined()
    v.dispose()
  })

  it("the payoff word is target-language for every ship language", () => {
    expect(deliciousIn("es")).toBe("¡Delicioso!")
    expect(deliciousIn("ja")).toBe("おいしい！")
    expect(deliciousIn("ar")).toBe("لذيذ!")
    expect(deliciousIn("zz-unknown")).toBe("Delicious!")
  })
})

describe("registration", () => {
  it("registerBuiltinVignettes wires the food stand under its canonical id", () => {
    const registered = new Map<string, VignetteFactory>()
    const host: VignetteHost = {
      register: (id, f) => void registered.set(id, f),
      has: (id) => registered.has(id),
      enter: async () => null,
      isActive: () => false,
      dispose() {},
    }
    registerBuiltinVignettes(host)
    expect(registered.has(VIGNETTE_IDS.food)).toBe(true)
    const v = registered.get(VIGNETTE_IDS.food)!()
    expect(typeof v.enter).toBe("function")
    expect(typeof v.dispose).toBe("function")
    v.dispose()
  })
})
