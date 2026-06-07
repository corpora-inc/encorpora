import { describe, it, expect } from "vitest"
import {
  K_ANON,
  PlaceReveal,
  SafeProfile,
  resolvePlaceReveal,
  InviteMessage,
  TradeEnvelope,
  parseSafeProfile,
  type Continent,
} from "@corpan-city/contracts"

/** A histogram helper backed by plain count maps (counts INCLUDE the subject). */
function hist(countries: Record<string, number>, continents: Record<string, number>) {
  return {
    countryCount: (c: string) => countries[c] ?? 0,
    continentCount: (c: Continent) => continents[c] ?? 0,
  }
}

describe("k-anonymity place reveal", () => {
  it("reveals a country only when > K_ANON players share it", () => {
    const raw = { country: "JP", continent: "asia" as const }
    // exactly K_ANON (incl subject) → NOT enough others → coarsen.
    const atFloor = resolvePlaceReveal(
      raw,
      hist({ JP: K_ANON }, { asia: K_ANON + 50 }),
    )
    expect(atFloor.granularity).toBe("continent")

    // above the floor → country is safe.
    const above = resolvePlaceReveal(
      raw,
      hist({ JP: K_ANON + 1 }, { asia: K_ANON + 50 }),
    )
    expect(above).toEqual({ granularity: "country", country: "JP", continent: "asia" })
  })

  it("falls back to continent, then hidden, as buckets shrink", () => {
    const raw = { country: "IS", continent: "europe" as const } // tiny country
    const continentOk = resolvePlaceReveal(raw, hist({ IS: 1 }, { europe: K_ANON + 1 }))
    expect(continentOk).toEqual({ granularity: "continent", continent: "europe" })

    const allTooSmall = resolvePlaceReveal(raw, hist({ IS: 1 }, { europe: 2 }))
    expect(allTooSmall).toEqual({ granularity: "hidden" })
  })

  it("hides place entirely when the player declined to share a country", () => {
    expect(resolvePlaceReveal(undefined, hist({}, {})).granularity).toBe("hidden")
    expect(resolvePlaceReveal({}, hist({}, {})).granularity).toBe("hidden")
  })

  it("never lets a PlaceReveal carry anything finer than a country", () => {
    // The schema has no city/region/coords variant — a payload with one is rejected.
    const sneaky = { granularity: "country", country: "JP", continent: "asia", city: "Tokyo" }
    const parsed = PlaceReveal.parse(sneaky)
    expect(parsed).not.toHaveProperty("city")
  })

  it("rejects a malformed country code", () => {
    expect(() => PlaceReveal.parse({ granularity: "country", country: "japan", continent: "asia" })).toThrow()
  })
})

describe("SafeProfile shape", () => {
  it("accepts a minimal hidden-place card", () => {
    const card = parseSafeProfile({
      playerId: "p-1",
      name: "Quiet Heron",
      stack: { target: "es", native: "en" },
      place: { granularity: "hidden" },
    })
    expect(card.stack.target).toBe("es")
  })

  it("has no field for free-text bio / links", () => {
    const card: SafeProfile = SafeProfile.parse({
      playerId: "p-2",
      name: "Quick Otter",
      stack: { target: "ja", native: "es" },
      place: { granularity: "continent", continent: "asia" },
      // any extra UGC-ish field is stripped by the schema:
      bio: "follow me @evil",
      url: "http://evil",
    } as unknown)
    expect(card).not.toHaveProperty("bio")
    expect(card).not.toHaveProperty("url")
  })
})

describe("mp wire envelopes", () => {
  it("validates a challenge invite", () => {
    const inv = InviteMessage.parse({
      inviteId: "inv-1",
      to: "p-9",
      offer: {
        kind: "challenge",
        tool: "translate-fast",
        mode: "duel",
        spec: {
          toolId: "translate-fast",
          challengeId: "c-1",
          language: "es",
          mode: "duel",
        },
      },
    })
    expect(inv.offer.kind).toBe("challenge")
  })

  it("routes a trade envelope with an opaque proposal body", () => {
    const env = TradeEnvelope.parse({
      tradeId: "t-1",
      to: "p-3",
      action: "propose",
      proposal: { offer: { items: [], coins: 5 }, request: { items: [], coins: 0 } },
    })
    expect(env.action).toBe("propose")
  })
})
