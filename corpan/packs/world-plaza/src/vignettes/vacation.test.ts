// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  createVacationVignette,
  postcardGreeting,
  postcardSigh,
  citySkyline,
  VACATION_DESTINATIONS,
} from "./vacation"
import { registerBuiltinVignettes, VIGNETTE_IDS } from "./index"
import { getRootHooks } from "./host"
import type { VignetteContext, VignetteFactory, VignetteHost } from "./types"

/**
 * vacation.test — the airport vacation montage. Proves: the international board
 * renders all 8 real cities, a trip debits the fare (waiving a shortfall), runs
 * the gate drill, speaks BOTH target-language postcard phrases, grants the
 * souvenir + xp, and resolves with NO travelTo (a round trip — you end at the
 * airport you boarded from). Registration wires `vacation` under its id.
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
    challenges: 0,
    debits: [] as number[],
    spoke: [] as string[],
  }
  const ctx: VignetteContext = {
    mountRoot: mountRootEl,
    learnerPair: { target: "fr", native: "en" },
    scene: { palette: { accent: "#e8b54a" } } as unknown as VignetteContext["scene"],
    anchorId: "airport",
    reducedMotion: true,
    speak: async (_lang, text) => {
      calls.spoke.push(text)
    },
    openNpc: () => ({ send() {}, close() {}, dispose() {} }),
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
    runChallenge: async () => {
      calls.challenges++
      return { score: 1, rewards: { xp: 0 } } as Awaited<ReturnType<VignetteContext["runChallenge"]>>
    },
    t: (key) => key,
    iconRenderer: {
      renderIcon: () => document.createElement("span"),
    } as unknown as VignetteContext["iconRenderer"],
  }
  return { ctx, calls }
}

describe("createVacationVignette — the international gate", () => {
  it("renders all 8 real cities on the board", async () => {
    const root = mountRoot()
    const { ctx } = makeCtx(root)
    const v = createVacationVignette()
    void v.enter(ctx)
    await Promise.resolve()
    const cards = root.querySelectorAll(".wp-vig-vac-card")
    expect(cards.length).toBe(8)
    const names = [...root.querySelectorAll(".wp-vig-vac-card__name")].map((n) => n.textContent)
    for (const city of ["Paris", "London", "Beirut", "Singapore", "Kinshasa", "Mexico City", "Tokyo", "Nairobi"]) {
      expect(names).toContain(city)
    }
    v.dispose()
  })

  it("a full trip: fare debited, drill run, postcards SPOKEN in target, souvenir granted, NO travelTo", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root)
    const v = createVacationVignette({ questStep: "first-vacation" })
    const done = v.enter(ctx)
    await Promise.resolve()
    // fly to Paris (first card)
    root.querySelector<HTMLButtonElement>(".wp-vig-vac-card")!.click()
    const result = await vi.waitFor(async () => await done, { timeout: 15_000 })
    expect(calls.debits).toEqual([520]) // Paris fare
    expect(calls.challenges).toBe(1)
    // both target-language postcard phrases were spoken
    expect(calls.spoke).toContain(postcardGreeting("fr", "Paris"))
    expect(calls.spoke).toContain(postcardSigh("fr"))
    // souvenir + xp granted; ROUND TRIP — no travelTo
    expect(calls.granted.length).toBe(1)
    expect(calls.granted[0].items).toEqual(["souvenir-paris"])
    expect((calls.granted[0].xp ?? 0)).toBeGreaterThan(0)
    expect(result.travelTo).toBeUndefined()
    expect(result.questStep).toBe("first-vacation")
    v.dispose()
  }, 20_000)

  it("a short wallet is waived, never a wall", async () => {
    const root = mountRoot()
    const { ctx, calls } = makeCtx(root, { balance: 200 }) // Paris costs 520
    const v = createVacationVignette()
    const done = v.enter(ctx)
    await Promise.resolve()
    root.querySelector<HTMLButtonElement>(".wp-vig-vac-card")!.click()
    await vi.waitFor(async () => await done, { timeout: 15_000 })
    expect(calls.debits).toEqual([200]) // charged what they had
    v.dispose()
  }, 20_000)

  it("leaving from the gate without flying resolves empty", async () => {
    const root = mountRoot()
    const { ctx } = makeCtx(root)
    const v = createVacationVignette({ questStep: "first-vacation" })
    const done = v.enter(ctx)
    await Promise.resolve()
    getRootHooks(root)!.exit({})
    const result = await done
    expect(result.questStep).toBeUndefined()
    expect(result.rewards).toBeUndefined()
    v.dispose()
  })

  it("postcard phrases exist for the major ship languages", () => {
    expect(postcardGreeting("es", "Tokyo")).toBe("¡Saludos desde Tokyo!")
    expect(postcardGreeting("fr", "Paris")).toBe("Salutations de Paris !")
    expect(postcardSigh("ja")).toBe("なんてきれい！")
    expect(postcardGreeting("zz", "X")).toBe("Greetings from X!")
  })

  it("every destination has a skyline painter + a souvenir id", () => {
    for (const d of VACATION_DESTINATIONS) {
      expect(citySkyline(d.id, "day")).toContain("<svg")
      expect(citySkyline(d.id, "dusk")).toContain("<svg")
      expect(d.souvenir).toMatch(/^souvenir-/)
    }
  })
})

describe("registration", () => {
  it("registerBuiltinVignettes wires the vacation gate under its canonical id", () => {
    const registered = new Map<string, VignetteFactory>()
    const host: VignetteHost = {
      register: (id, f) => void registered.set(id, f),
      has: (id) => registered.has(id),
      enter: async () => null,
      isActive: () => false,
      dispose() {},
    }
    registerBuiltinVignettes(host)
    expect(registered.has(VIGNETTE_IDS.vacation)).toBe(true)
    const v = registered.get(VIGNETTE_IDS.vacation)!()
    expect(typeof v.enter).toBe("function")
    v.dispose()
  })
})
