import { describe, it, expect } from "vitest"
import {
  createChallengeHost,
  mockChallengeHost,
  type CorpanChallengeHostApi,
  type ChallengeEntry,
} from "./host"
import {
  baseSpec,
  specContentFilter,
  randomEntries,
  CONTENT_FILTER_PARAM,
} from "./tools/_shared"
import type { ChallengeContext, LanguageCode } from "@corpan-city/contracts"

/**
 * The THEMED + LEVEL-SCALED content filter must flow END-TO-END:
 *   ChallengeContext → baseSpec(params.contentFilter) → randomEntries →
 *   host.getRandomEntries({ domains, levels, ... }) → the corpus command's filter.
 *
 * AND it must DEGRADE GRACEFULLY: a host with no batch sampler, or one that
 * predates the options form, still returns content (just unfiltered) — the core
 * loop never dead-ends on an over-specific filter.
 */

const ES = "es" as LanguageCode
const EN = "en" as LanguageCode

function ctx(extra: Partial<ChallengeContext> = {}): ChallengeContext {
  return { language: ES, nativeLanguage: EN, mode: "solo", ...extra }
}

describe("baseSpec ↔ specContentFilter — the filter round-trips through params", () => {
  it("stamps domains/levels/languageCodes into params.contentFilter", () => {
    const spec = baseSpec("fast-translate", ctx({ domains: ["travel"], levels: ["A1", "A2"], languageCodes: ["es"] }), {})
    const filter = specContentFilter(spec)
    expect(filter).toEqual({ domains: ["travel"], levels: ["A1", "A2"], languageCodes: ["es"] })
  })

  it("omits the filter key entirely when no axis is set (clean spec)", () => {
    const spec = baseSpec("fast-translate", ctx(), { rounds: 5 })
    expect(spec.params?.[CONTENT_FILTER_PARAM]).toBeUndefined()
    expect(specContentFilter(spec)).toBeUndefined()
    // existing params survive
    expect(spec.params?.rounds).toBe(5)
  })

  it("preserves the tool's own params alongside the filter", () => {
    const spec = baseSpec("fast-translate", ctx({ domains: ["health"] }), { rounds: 7 })
    expect(spec.params?.rounds).toBe(7)
    expect(specContentFilter(spec)?.domains).toEqual(["health"])
  })
})

describe("createChallengeHost — forwards the filter to a capable host", () => {
  it("passes the options form when a filter is present", async () => {
    let seen: unknown = null
    const api: CorpanChallengeHostApi = {
      speak: async () => {},
      getRandomEntries: async (q) => {
        seen = q
        return []
      },
      getRandomEntry: async () => entry(1, "A1", ["travel"]),
      getEntryById: async (id) => entry(id, "A1", ["travel"]),
    }
    const host = createChallengeHost(api)
    await host.getRandomEntries({ count: 8, domains: ["travel"], levels: ["A1", "A2"] })
    expect(seen).toEqual({ count: 8, domains: ["travel"], levels: ["A1", "A2"] })
  })

  it("passes the bare count when NO filter is present (back-compat)", async () => {
    let seen: unknown = null
    const api: CorpanChallengeHostApi = {
      speak: async () => {},
      getRandomEntries: async (q) => {
        seen = q
        return []
      },
      getRandomEntry: async () => entry(1, "A1", []),
      getEntryById: async (id) => entry(id, "A1", []),
    }
    const host = createChallengeHost(api)
    await host.getRandomEntries(6) // legacy numeric form
    expect(seen).toBe(6)
    await host.getRandomEntries({ count: 4 }) // options form, empty filter
    expect(seen).toBe(4)
  })

  it("degrades to repeated single draws when there is no batch sampler", async () => {
    let calls = 0
    const api: CorpanChallengeHostApi = {
      speak: async () => {},
      getRandomEntry: async () => {
        calls++
        return entry(calls, "A1", ["travel"])
      },
      getEntryById: async (id) => entry(id, "A1", ["travel"]),
    }
    const host = createChallengeHost(api)
    const got = await host.getRandomEntries({ count: 3, domains: ["travel"] })
    expect(got.length).toBe(3) // filter ignored, but content still flows
    expect(calls).toBe(3)
  })
})

describe("mockChallengeHost — filters in-memory and relaxes when starved", () => {
  it("restricts to the requested domain when the pool can fill the draw", async () => {
    const host = mockChallengeHost({ seed: 3 })
    const got = await host.getRandomEntries({ count: 4, domains: ["food"] })
    expect(got.length).toBe(4)
    expect(got.every((e) => e.domains.includes("food"))).toBe(true)
  })

  it("restricts by CEFR level", async () => {
    const host = mockChallengeHost({ seed: 5 })
    const got = await host.getRandomEntries({ count: 3, levels: ["A1"] })
    expect(got.every((e) => e.level === "A1")).toBe(true)
  })

  it("RELAXES to the full corpus rather than starve on an over-strict filter", async () => {
    const host = mockChallengeHost({ seed: 9 })
    // no mock rows carry this domain → the filtered pool is empty → relax.
    const got = await host.getRandomEntries({ count: 6, domains: ["technology"] })
    expect(got.length).toBe(6) // never a dead-end
  })

  it("still honors the legacy numeric form", async () => {
    const host = mockChallengeHost({ seed: 1 })
    const got = await host.getRandomEntries(5)
    expect(got.length).toBe(5)
  })

  it("VARIES the draw across plays for the same filter (bottomless feel)", async () => {
    const a = mockChallengeHost({ seed: 11 })
    const b = mockChallengeHost({ seed: 99 })
    const fa = (await a.getRandomEntries({ count: 4, domains: ["food"] })).map((e) => e.entry_id)
    const fb = (await b.getRandomEntries({ count: 4, domains: ["food"] })).map((e) => e.entry_id)
    // different seeds (≈ repeat plays) yield a different ordering/selection
    expect(fa.join(",")).not.toBe(fb.join(","))
  })
})

describe("randomEntries — the shared tool seam threads the spec filter", () => {
  it("forwards the spec's stashed filter to the host", async () => {
    let seen: unknown = null
    const probe = {
      ...mockChallengeHost(),
      getRandomEntries: async (q: unknown) => {
        seen = q
        return [] as ChallengeEntry[]
      },
    }
    const spec = baseSpec("fast-translate", ctx({ domains: ["travel"], levels: ["A1"] }), {})
    await randomEntries(probe, spec, 8)
    expect(seen).toEqual({ count: 8, domains: ["travel"], levels: ["A1"] })
  })

  it("forwards a bare count when the spec carries no filter", async () => {
    let seen: unknown = null
    const probe = {
      ...mockChallengeHost(),
      getRandomEntries: async (q: unknown) => {
        seen = q
        return [] as ChallengeEntry[]
      },
    }
    const spec = baseSpec("fast-translate", ctx(), {})
    await randomEntries(probe, spec, 6)
    expect(seen).toBe(6)
  })
})

function entry(id: number, level: string, domains: string[]): ChallengeEntry {
  return {
    entry_id: id,
    level,
    domains,
    source: "base",
    translations: [
      { language_code: "en", text: `en-${id}`, romanization: "" },
      { language_code: "es", text: `es-${id}`, romanization: "" },
    ],
  }
}
