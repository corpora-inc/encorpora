import { describe, it, expect, beforeEach } from "vitest"
import { GeneratedIdentity, AvatarSpec, type LearnerPair } from "@corpan-city/contracts"
import {
  identityForPair,
  loadPairIdentity,
  savePairIdentity,
  pairHasIdentity,
  claimStarterGrant,
  starterGrantClaimed,
  type PairIdentity,
} from "./identityStore"
import type { StarterGrant } from "./pairProfile"

/* ---- a synchronous in-memory localStorage shim (node test env) ---- */
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  get length() {
    return this.m.size
  }
}

const pair = (target: string, native: string): LearnerPair => ({ target, native })

// Reinstall a FRESH shim before every test AND clear it, so this file is fully
// isolation-independent — it must pass identically whether run alone or after any
// other test file that left the shared `globalThis.localStorage` dirty (vitest
// runs node-env files in a shared worker global; without this a leftover key from
// economy.test.ts / npc.test.ts could leak in). Also ensure DOMException exists
// (the economy shim relies on it; cross-file order must not leave it undefined).
beforeEach(() => {
  const store = new MemStorage()
  store.clear()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = store as unknown as Storage
  ;(globalThis as unknown as { DOMException: typeof Error }).DOMException ??= Error as never
})

describe("identityForPair — fresh pair birth", () => {
  it("births a fresh pair from the seeded resolver (isNew + a grant)", () => {
    const r = identityForPair(pair("es", "en"), "pl-1")
    expect(r.isNew).toBe(true)
    expect(r.grant).toBeDefined()
    expect(() => GeneratedIdentity.parse(r.identity.name)).not.toThrow()
    expect(() => AvatarSpec.parse(r.identity.avatar)).not.toThrow()
  })

  it("persists the born identity so it sticks (second call is NOT new)", () => {
    const a = identityForPair(pair("es", "en"), "pl-1")
    const b = identityForPair(pair("es", "en"), "pl-1")
    expect(a.isNew).toBe(true)
    expect(b.isNew).toBe(false)
    expect(b.grant).toBeUndefined()
    expect(b.identity.name.displayName).toBe(a.identity.name.displayName)
  })

  it("THE BUG: two pairs (EN→ES vs EN→JA) get DISTINCT characters (name OR outfit)", () => {
    const es = identityForPair(pair("es", "en"), "pl-1").identity
    const ja = identityForPair(pair("ja", "en"), "pl-1").identity
    // The avatar is track-seeded, so it MUST differ across pairs (the owner's bug:
    // same outfit). The name very likely differs too (different pool/seed).
    const sameName = es.name.displayName === ja.name.displayName
    const sameAvatar = JSON.stringify(es.avatar) === JSON.stringify(ja.avatar)
    expect(sameAvatar).toBe(false)
    expect(sameName && sameAvatar).toBe(false)
  })

  it("is deterministic — the SAME fresh pair births the SAME persona", () => {
    const a = identityForPair(pair("es", "en"), "pl-1").identity
    // wipe + rebuild the same pair from scratch
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = new MemStorage() as unknown as Storage
    const b = identityForPair(pair("es", "en"), "pl-1").identity
    expect(b.name.nameSeed).toEqual(a.name.nameSeed)
    expect(b.avatar).toEqual(a.avatar)
  })
})

describe("starter grant — claimed AT MOST ONCE per pair (durable guard)", () => {
  it("birth returns the grant exactly once; a re-birth of the SAME fresh pair does not", () => {
    const first = identityForPair(pair("es", "en"), "pl-1")
    expect(first.isNew).toBe(true)
    expect(first.grant).toBeDefined()
    expect(starterGrantClaimed(pair("es", "en"))).toBe(true)

    // Simulate a session rebuild of the SAME fresh pair BEFORE its identity settled:
    // wipe only the identity record, keep the grant-claim marker (durable guard).
    localStorage.removeItem("wp:identity:en:es")
    const rebuilt = identityForPair(pair("es", "en"), "pl-1")
    expect(rebuilt.isNew).toBe(true) // identity gone → re-seeded
    expect(rebuilt.grant).toBeUndefined() // …but the grant is NOT handed out again
  })

  it("claimStarterGrant returns the grant once, then undefined forever", () => {
    const g: StarterGrant = { xp: 0, currency: { "gold-real": 100 }, items: ["water-skin"] }
    expect(claimStarterGrant(pair("ko", "en"), g)).toEqual(g)
    expect(claimStarterGrant(pair("ko", "en"), g)).toBeUndefined()
    expect(claimStarterGrant(pair("ko", "en"), g)).toBeUndefined()
    expect(starterGrantClaimed(pair("ko", "en"))).toBe(true)
  })

  it("the claim is PER-PAIR — a different pair still gets its own grant", () => {
    const g: StarterGrant = { currency: { "gold-real": 100 } }
    expect(claimStarterGrant(pair("es", "en"), g)).toEqual(g)
    expect(claimStarterGrant(pair("ja", "en"), g)).toEqual(g) // distinct pair, own claim
    expect(starterGrantClaimed(pair("fr", "en"))).toBe(false)
  })
})

describe("identityForPair — existing pair keeps the player's choices", () => {
  it("loads a stored (player-edited) identity and never re-seeds it", () => {
    const edited: PairIdentity = {
      name: GeneratedIdentity.parse({
        playerId: "pl-1",
        displayName: "Custom Hero",
        nameSeed: { adjId: "adj-brave", nounId: "noun-otter" },
      }),
      avatar: AvatarSpec.parse({
        base: "paper-doll-a",
        layers: [{ slot: "face", itemId: "face-base", tint: "#a06a3c" }],
      }),
    }
    savePairIdentity(pair("es", "en"), edited)
    const r = identityForPair(pair("es", "en"), "pl-1")
    expect(r.isNew).toBe(false)
    expect(r.identity.name.displayName).toBe("Custom Hero")
    expect(r.identity.avatar.layers[0].tint).toBe("#a06a3c")
  })
})

describe("legacy global migration", () => {
  it("adopts the legacy wp:identity:v1 into the FIRST fresh pair (not re-seeded)", () => {
    const legacy: PairIdentity = {
      name: GeneratedIdentity.parse({
        playerId: "pl-1",
        displayName: "Legacy Traveler",
        nameSeed: { adjId: "adj-sunny", nounId: "noun-finch" },
      }),
      avatar: AvatarSpec.parse({ base: "paper-doll-a", layers: [] }),
    }
    localStorage.setItem("wp:identity:v1", JSON.stringify(legacy))

    const first = identityForPair(pair("es", "en"), "pl-1")
    expect(first.isNew).toBe(false) // adopted, not born → no starter grant
    expect(first.grant).toBeUndefined()
    expect(first.identity.name.displayName).toBe("Legacy Traveler")

    // A DIFFERENT pair does NOT adopt the legacy — it is born fresh + distinct.
    const second = identityForPair(pair("ja", "en"), "pl-1")
    expect(second.isNew).toBe(true)
    expect(second.identity.name.displayName).not.toBe("Legacy Traveler")
  })

  it("adoptLegacyForFresh:false forces a fresh seed even with a legacy global", () => {
    localStorage.setItem(
      "wp:identity:v1",
      JSON.stringify({
        name: GeneratedIdentity.parse({
          playerId: "pl-1",
          displayName: "Legacy Traveler",
          nameSeed: { adjId: "adj-sunny", nounId: "noun-finch" },
        }),
        avatar: AvatarSpec.parse({ base: "paper-doll-a", layers: [] }),
      }),
    )
    const r = identityForPair(pair("es", "en"), "pl-1", { adoptLegacyForFresh: false })
    expect(r.isNew).toBe(true)
    expect(r.identity.name.displayName).not.toBe("Legacy Traveler")
  })
})

describe("load/save round-trip + probes", () => {
  it("loadPairIdentity returns null for an unseen pair", () => {
    expect(loadPairIdentity(pair("ko", "en"))).toBeNull()
    expect(pairHasIdentity(pair("ko", "en"))).toBe(false)
  })

  it("a corrupt stored record is treated as absent (resilient)", () => {
    localStorage.setItem("wp:identity:en:es", "{not json")
    expect(loadPairIdentity(pair("es", "en"))).toBeNull()
  })

  it("pairHasIdentity is true after a birth", () => {
    identityForPair(pair("es", "en"), "pl-1")
    expect(pairHasIdentity(pair("es", "en"))).toBe(true)
  })
})
