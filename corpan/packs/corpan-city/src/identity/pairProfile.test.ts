import { describe, it, expect } from "vitest"
import { GeneratedIdentity, AvatarSpec, type LearnerPair } from "@corpan-city/contracts"
import {
  profileForPair,
  namePoolFor,
  starterGrantFor,
  starterKitItemsFor,
  characterSpecToAvatar,
  seededPersonaForPair,
  knownNamePoolIds,
  knownStarterGrantIds,
  bespokeTargets,
} from "./pairProfile"
import { generateCharacter, ANTIGUA_1770 } from "../character/characterGen"
import { CosmeticItem } from "@corpan-city/contracts"

const pair = (target: string, native: string): LearnerPair => ({ target, native })

describe("profileForPair", () => {
  it("returns the bespoke row for a known target", () => {
    const p = profileForPair(pair("es", "en"))
    expect(p.namePoolId).toBe("pool-es")
    expect(p.starterKitId).toBe("kit-market")
    expect(p.starterGrantId).toBe("grant-market")
  })

  it("falls back to _default for an unknown target — every pair resolves", () => {
    const p = profileForPair(pair("xx-Unknown", "en"))
    expect(p.namePoolId).toBe("pool-universal")
    expect(p.themeId).toBe("antigua-1770")
    expect(p.starterKitId).toBe("kit-traveler")
    expect(p.starterGrantId).toBe("grant-traveler")
  })

  it("always returns a COMPLETE profile (all four ids present)", () => {
    for (const t of ["es", "ja", "zh", "de", "ko", "ar", "qqq"]) {
      const p = profileForPair(pair(t, "en"))
      expect(typeof p.namePoolId).toBe("string")
      expect(typeof p.themeId).toBe("string")
      expect(typeof p.starterKitId).toBe("string")
      expect(typeof p.starterGrantId).toBe("string")
    }
  })

  it("immersion pair (target===native) resolves via the target row, no special case", () => {
    const p = profileForPair(pair("es", "es"))
    expect(p.namePoolId).toBe("pool-es")
  })

  it("returns a COPY (mutating the result can't corrupt the table)", () => {
    const a = profileForPair(pair("es", "en"))
    a.namePoolId = "mutated"
    const b = profileForPair(pair("es", "en"))
    expect(b.namePoolId).toBe("pool-es")
  })
})

describe("name pools", () => {
  it("loaded the universal + bespoke pools", () => {
    const ids = knownNamePoolIds()
    expect(ids).toContain("pool-universal")
    expect(ids).toContain("pool-es")
    expect(ids).toContain("pool-ja")
    expect(ids).toContain("pool-zh")
  })

  it("universal pool kept the full original lists", () => {
    const pool = namePoolFor("pool-universal")
    expect(pool.adjectives.length).toBeGreaterThanOrEqual(60)
    expect(pool.nouns.length).toBeGreaterThanOrEqual(60)
  })

  it("unknown pool id falls back to universal", () => {
    expect(namePoolFor("pool-nope")).toBe(namePoolFor("pool-universal"))
  })

  it("bespoke pools SHARE ids with universal (nameSeed portability)", () => {
    const uni = new Set(namePoolFor("pool-universal").adjectives.map((w) => w.id))
    for (const w of namePoolFor("pool-es").adjectives) {
      expect(uni.has(w.id)).toBe(true)
    }
    const uniN = new Set(namePoolFor("pool-universal").nouns.map((w) => w.id))
    for (const w of namePoolFor("pool-es").nouns) {
      expect(uniN.has(w.id)).toBe(true)
    }
  })

  it("every pool word has a non-empty id + label (no freeform / blanks)", () => {
    for (const id of knownNamePoolIds()) {
      const pool = namePoolFor(id)
      for (const w of [...pool.adjectives, ...pool.nouns]) {
        expect(w.id.length).toBeGreaterThan(0)
        expect(w.label.length).toBeGreaterThan(0)
      }
    }
  })
})

describe("starter grants", () => {
  it("loaded the traveler + bespoke grants", () => {
    const ids = knownStarterGrantIds()
    expect(ids).toContain("grant-traveler")
    expect(ids).toContain("grant-market")
    expect(ids).toContain("grant-tokyo")
  })

  it("unknown grant id falls back to grant-traveler", () => {
    expect(starterGrantFor("grant-nope")).toEqual(starterGrantFor("grant-traveler"))
  })

  it("grants are modest + well-formed (positive currency, string item ids)", () => {
    for (const id of knownStarterGrantIds()) {
      const g = starterGrantFor(id)
      for (const units of Object.values(g.currency ?? {})) {
        expect(units).toBeGreaterThan(0)
        expect(Number.isInteger(units)).toBe(true)
      }
      for (const it of g.items ?? []) expect(typeof it).toBe("string")
    }
  })
})

describe("starter kits", () => {
  it("resolves a kit's items and they parse as CosmeticItems", () => {
    for (const kitId of ["kit-traveler", "kit-market", "kit-tokyo"]) {
      const items = starterKitItemsFor(kitId)
      expect(items.length).toBeGreaterThan(0)
      for (const it of items) expect(() => CosmeticItem.parse(it)).not.toThrow()
    }
  })

  it("unknown kit id falls back to a non-empty traveler kit", () => {
    expect(starterKitItemsFor("kit-nope").length).toBeGreaterThan(0)
  })
})

describe("characterSpecToAvatar", () => {
  it("produces a valid AvatarSpec from a generated character", () => {
    const spec = generateCharacter("traveler", "seed-1", ANTIGUA_1770)
    const avatar = characterSpecToAvatar(spec)
    expect(() => AvatarSpec.parse(avatar)).not.toThrow()
    // skin tone carried onto the face layer + palette
    const face = avatar.layers.find((l) => l.slot === "face")
    expect(face?.tint).toBe(spec.skinTone)
    expect(avatar.palette?.skin).toBe(spec.skinTone)
  })
})

describe("seededPersonaForPair", () => {
  it("is deterministic — same (pair, trackId, playerId) => same persona", () => {
    const a = seededPersonaForPair(pair("es", "en"), "en:es", "player-local")
    const b = seededPersonaForPair(pair("es", "en"), "en:es", "player-local")
    expect(a.identity.displayName).toBe(b.identity.displayName)
    expect(a.identity.nameSeed).toEqual(b.identity.nameSeed)
    expect(a.avatar).toEqual(b.avatar)
  })

  it("different pairs yield visibly distinct personas (different track seed)", () => {
    const es = seededPersonaForPair(pair("es", "en"), "en:es", "player-local")
    const ja = seededPersonaForPair(pair("ja", "en"), "en:ja", "player-local")
    // at minimum the seed namespace differs → avatar differs (names may rarely
    // collide across pools, but the track-seeded avatar should not).
    expect(es.avatar).not.toEqual(ja.avatar)
  })

  it("produces a contract-valid identity + avatar (the game can trust it)", () => {
    const persona = seededPersonaForPair(pair("zz", "en"), "en:zz", "player-local")
    expect(() => GeneratedIdentity.parse(persona.identity)).not.toThrow()
    expect(() => AvatarSpec.parse(persona.avatar)).not.toThrow()
  })

  it("the name draws from the resolved pool (es persona uses an es id)", () => {
    const persona = seededPersonaForPair(pair("es", "en"), "en:es", "player-local")
    const esAdjIds = new Set(namePoolFor("pool-es").adjectives.map((w) => w.id))
    expect(esAdjIds.has(persona.identity.nameSeed.adjId)).toBe(true)
  })

  it("carries the resolved grant for the caller to apply once", () => {
    const persona = seededPersonaForPair(pair("ja", "en"), "en:ja", "player-local")
    expect(persona.grant).toEqual(starterGrantFor("grant-tokyo"))
    expect(persona.profile.starterGrantId).toBe("grant-tokyo")
  })
})

describe("introspection", () => {
  it("reports the bespoke targets", () => {
    const t = bespokeTargets()
    expect(t).toContain("es")
    expect(t).toContain("ja")
    expect(t).toContain("zh")
  })
})
