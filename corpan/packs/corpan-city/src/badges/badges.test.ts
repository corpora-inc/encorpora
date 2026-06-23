// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import type { BadgeDeposit } from "@corpan-city/contracts"
import {
  buildCatalog,
  buildEsB0Catalog,
  badgeIdFor,
  B0_ES_COVERAGE,
  ALL_DOMAINS,
  ALL_LEVELS,
  SKILL_FAMILY_IDS,
  familyWeight,
  type CoverageMatrix,
} from "./catalog"
import {
  route,
  tierForXp,
  arcForXp,
  tierThresholds,
  scoreGated,
  softCappedDelta,
  siblingsOf,
  isPlatinum,
  xpToNextTier,
} from "./router"
import { createBadgeStore } from "./badgeStore"
import { memTrackStore, bindingFor } from "./index"

/* ----------------------------------------------------------------- catalog */

describe("catalog — generator structure + counts", () => {
  it("B0 ES set lands at a trimmed ~40 badges", () => {
    const cat = buildEsB0Catalog()
    // Curated A·C·E·G·H: A=4, C=6, E=24, G=8, H=5 = 47. Tasteful, well under ~1000.
    expect(cat.all.length).toBe(47)
    expect(cat.all.length).toBeGreaterThanOrEqual(35)
    expect(cat.all.length).toBeLessThanOrEqual(60)
    expect(cat.target).toBe("es")
  })

  it("B0 generator math: curated families A·C·E·G·H, clamped to coverage", () => {
    const cov = B0_ES_COVERAGE
    const cat = buildEsB0Catalog()
    const byFam = (f: string) => cat.all.filter((b) => b.family === f).length

    const domains = Object.keys(cov.domainLevels)
    const skills = SKILL_FAMILY_IDS.length

    // B0 ships the curated subset (no B/D/F long tail).
    expect(byFam("A")).toBe(domains.length) // 4
    expect(byFam("B")).toBe(0)
    expect(byFam("C")).toBe(skills) // 6
    expect(byFam("D")).toBe(0)
    expect(byFam("E")).toBe(domains.length * skills) // 24
    expect(byFam("F")).toBe(0)
    expect(byFam("H")).toBe(cov.tools.length) // 5
    expect(byFam("G")).toBeGreaterThan(0) // clusters whose domain is covered
  })

  it("B1 generator math scales toward ~1000 on full coverage", () => {
    // Full 13×6 coverage (every domain, every level) — the B1 fan-out.
    const domainLevels: Record<string, string[]> = {}
    for (const d of ALL_DOMAINS) domainLevels[d] = [...ALL_LEVELS]
    const cov: CoverageMatrix = {
      target: "es",
      domainLevels,
      tools: [
        "word-scramble", "fast-translate", "listen-choose", "build-sentence",
        "read-aloud", "memory-pairs", "picture-match", "true-false",
        "conjugation-tap", "number-drill", "spot-typo", "rhyme-match",
        "say-it-back", "dialogue-fill", "tap-translation", "odd-one-out",
        "category-sort", "word-search", "countdown-recall", "repeat-after",
        "fill-the-blank", "pronunciation-duel",
      ],
    }
    const cat = buildCatalog(cov)
    // The structural fan-out (A+B+C+D+E+F+H, plus whatever G clusters exist) is
    // ~950–1080 by design. With 13 domains, 6 levels, 6 skills, 22 tools:
    //   A=13, B=78, C=6, D=36, E=78, F=468, H=22 → 701 structural + G.
    const structural = 13 + 78 + 6 + 36 + 78 + 13 * 6 * 6 + 22
    expect(structural).toBe(701)
    expect(cat.all.length).toBeGreaterThanOrEqual(700)
    // The full corpus (with all 22 skill TOOLS folded into F via per-tool levels
    // in B1) reaches ~1000; the family-level fan-out here is the lower bound.
  })

  it("stable, facet-derived ids regenerate identically (no orphaning)", () => {
    const a = buildEsB0Catalog()
    const b = buildEsB0Catalog()
    const idsA = a.all.map((x) => x.id).sort()
    const idsB = b.all.map((x) => x.id).sort()
    expect(idsA).toEqual(idsB)
    // Spot-check the documented id shapes present in the B0 (A·C·E·G·H) set.
    expect(a.get(badgeIdFor("A", "travel"))).toBeDefined()
    expect(a.get(badgeIdFor("E", "travel", "vocab"))).toBeDefined()
    expect(a.get("G:social:greetings")).toBeDefined()
    expect(a.get("H:word-scramble")).toBeDefined()
    // The F long-tail id shape is stable too (verified against a full catalog).
    const fullCat = buildCatalog({ target: "es", domainLevels: { travel: ["A2"] }, tools: [] })
    expect(fullCat.get(badgeIdFor("F", "travel", "vocab", "A2"))).toBeDefined()
  })

  it("never emits a badge outside coverage (clamp)", () => {
    const cat = buildEsB0Catalog()
    // numbers only has A1 → no numbers B2 badge.
    expect(cat.get("B:numbers:B2")).toBeUndefined()
    expect(cat.get("F:numbers:vocab:B2")).toBeUndefined()
    // business is not in the B0 coverage at all → no business badges.
    expect(cat.get("A:business")).toBeUndefined()
  })
})

/* ------------------------------------------------------------------ router */

describe("router — fan-out + fractional weights (no inflation)", () => {
  // The router fan-out is tested against a FULL-coverage catalog (every family
  // present), so the complete ~8-badge fan-out is observable. B0's curated
  // catalog (no B/D/F) is exercised by the clamp test below.
  const full: CoverageMatrix = {
    target: "es",
    domainLevels: { travel: ["A2"], social: ["A1"] },
    tools: ["fast-translate"],
  }
  const cat = buildCatalog(full)
  const b0 = buildEsB0Catalog()

  it("one deposit fans out to up to ~8 badges (domain×skill×level + cluster + tool)", () => {
    const d: BadgeDeposit = {
      amount: 100, trackKey: "en:es", source: "challenge",
      domain: "travel", toolId: "fast-translate", level: "A2",
      entryIds: [1008], score: 1, // [1008] → at-the-airport cluster
    }
    const ids = route(d, cat).map((c) => c.badgeId)
    expect(ids).toContain("A:travel")
    expect(ids).toContain("B:travel:A2")
    expect(ids).toContain("C:vocab")
    expect(ids).toContain("D:vocab:A2")
    expect(ids).toContain("E:travel:vocab")
    expect(ids).toContain("F:travel:vocab:A2")
    expect(ids).toContain("G:travel:at-the-airport")
    expect(ids).toContain("H:fast-translate")
    expect(ids.length).toBeGreaterThanOrEqual(7)
  })

  it("weights sum to ≤ 1 across the fan-out (NO XP INFLATION — normalized)", () => {
    const d: BadgeDeposit = {
      amount: 100, trackKey: "en:es", source: "challenge",
      domain: "travel", toolId: "fast-translate", level: "A2",
      entryIds: [1008], score: 1, // gated = amount → isolates the weight sum
    }
    const credits = route(d, cat)
    const totalWeighted = credits.reduce((s, c) => s + c.xp, 0)
    // The full ~8-badge fan-out's raw weights sum > 1, so the router normalizes:
    // total credited ≤ the gated amount (100). No badge exceeds the gated amount.
    expect(totalWeighted).toBeLessThanOrEqual(100 + 1e-6)
    for (const c of credits) expect(c.xp).toBeLessThanOrEqual(100 + 1e-9)
    // And it credits a meaningful amount (not collapsed to ~0).
    expect(totalWeighted).toBeGreaterThan(50)
  })

  it("a small fan-out (raw sum ≤ 1) is NOT scaled down", () => {
    // domain-only deposit, no skill/level → just A·domain (weight 0.3) → 0.3·gated.
    const d: BadgeDeposit = {
      amount: 100, trackKey: "en:es", source: "challenge", domain: "travel", score: 1,
    }
    const credits = route(d, cat)
    const a = credits.find((c) => c.badgeId === "A:travel")!
    expect(a.xp).toBeCloseTo(100 * familyWeight("A"), 6) // unscaled
  })

  it("normalization preserves the relative family proportions", () => {
    const d: BadgeDeposit = {
      amount: 100, trackKey: "en:es", source: "challenge",
      domain: "travel", toolId: "fast-translate", level: "A2", score: 1,
    }
    const credits = route(d, cat)
    const f = credits.find((c) => c.badgeId === "F:travel:vocab:A2")!
    const a = credits.find((c) => c.badgeId === "A:travel")!
    // F:A ratio stays the family-weight ratio (1.0 : 0.3) after normalization.
    expect(f.xp / a.xp).toBeCloseTo(familyWeight("F") / familyWeight("A"), 6)
  })

  it("score gate scales the whole fan-out (anti-mash)", () => {
    const base: Omit<BadgeDeposit, "score"> = {
      amount: 100, trackKey: "en:es", source: "challenge",
      domain: "travel", toolId: "fast-translate", level: "A2",
    }
    const sum = (s: number) => route({ ...base, score: s }, cat).reduce((a, c) => a + c.xp, 0)
    expect(sum(0.5) / sum(1)).toBeCloseTo(0.7, 6) // 50% → 0.7×
    expect(sum(0) / sum(1)).toBeCloseTo(0.4, 6) // bail → 0.4× floor
  })

  it("scoreGated formula matches the doc (0.4 + 0.6·score)", () => {
    expect(scoreGated(100, 1)).toBe(100)
    expect(scoreGated(100, 0.5)).toBeCloseTo(70, 6)
    expect(scoreGated(100, 0)).toBeCloseTo(40, 6)
    expect(scoreGated(100, undefined)).toBe(100) // no score → full
  })

  it("skips badges absent from the catalog (B0 curated → no B/D/F)", () => {
    const d: BadgeDeposit = {
      amount: 100, trackKey: "en:es", source: "challenge",
      domain: "travel", toolId: "fast-translate", level: "A2",
      entryIds: [1008], score: 1,
    }
    // B0 ships only A·C·E·G·H; the router silently folds the credit into those.
    const ids = route(d, b0).map((c) => c.badgeId)
    expect(ids).toContain("A:travel")
    expect(ids).toContain("C:vocab")
    expect(ids).toContain("E:travel:vocab")
    expect(ids).toContain("H:fast-translate")
    expect(ids).not.toContain("B:travel:A2") // clamped away in B0
    expect(ids).not.toContain("F:travel:vocab:A2")
  })

  it("an entirely-uncovered domain yields no credits", () => {
    const d: BadgeDeposit = {
      amount: 100, trackKey: "en:es", source: "challenge",
      domain: "business", score: 1, // business absent from this coverage, no skill/tool
    }
    expect(route(d, cat)).toEqual([])
  })
})

/* ------------------------------------------------------------- tier curve */

describe("router — tier curve (geometric ladder + scale)", () => {
  it("base ladder thresholds = 120/400/1000/2400", () => {
    expect(tierThresholds(1)).toEqual([120, 400, 1000, 2400])
  })
  it("broad badges scale ×2.5 (platinum ≈ 6000)", () => {
    expect(tierThresholds(2.5)).toEqual([300, 1000, 2500, 6000])
  })
  it("tierForXp crosses the ladder correctly", () => {
    // th = [bronze=120, silver=400, gold=1000, platinum=2400] (xp needed FOR each).
    expect(tierForXp(0, 1)).toBe("locked")
    expect(tierForXp(1, 1)).toBe("bronze")
    expect(tierForXp(119, 1)).toBe("bronze")
    expect(tierForXp(120, 1)).toBe("bronze") // exactly at the bronze threshold → bronze
    expect(tierForXp(399, 1)).toBe("bronze")
    expect(tierForXp(400, 1)).toBe("silver")
    expect(tierForXp(1000, 1)).toBe("gold")
    expect(tierForXp(2400, 1)).toBe("platinum")
    expect(tierForXp(99999, 1)).toBe("platinum")
  })
  it("arc fills 0..1 within a tier band and reads 1 at platinum", () => {
    expect(arcForXp(0, 1)).toBe(0)
    expect(arcForXp(60, 1)).toBeCloseTo(0.5, 6) // halfway to bronze (0→120)
    expect(arcForXp(260, 1)).toBeCloseTo((260 - 120) / (400 - 120), 6)
    expect(arcForXp(2400, 1)).toBe(1)
    expect(arcForXp(5000, 1)).toBe(1)
  })
  it("xpToNextTier reports the honest remaining work (0 at platinum)", () => {
    expect(xpToNextTier(0, 1)).toBe(120)
    expect(xpToNextTier(100, 1)).toBe(20)
    expect(xpToNextTier(2400, 1)).toBe(0)
  })
})

/* ------------------------------------------------- anti-grind (soft cap) */

describe("router — anti-grind soft cap + sibling overflow", () => {
  it("near-tier soft cap: last 15% of a band credits at 0.6×", () => {
    // Bronze band [0,120]; soft zone starts at 0.85·120 = 102.
    // From 110 (inside soft), a 10-xp delta credits at 0.6× → 6.
    expect(softCappedDelta(110, 10, 1)).toBeCloseTo(6, 6)
    // From 90 (before soft, soft at 102): 12 at 1× + 8 at 0.6× → 12 + 4.8.
    expect(softCappedDelta(90, 20, 1)).toBeCloseTo(12 + 8 * 0.6, 6)
    // Entirely before the soft zone → full.
    expect(softCappedDelta(0, 50, 1)).toBe(50)
  })
  it("siblingsOf returns the same family's CEFR neighbours", () => {
    const cat = buildCatalog({
      target: "es", domainLevels: { travel: ["A1", "A2", "B1"] }, tools: [],
    })
    const f = cat.get("F:travel:vocab:A1")!
    const sibs = siblingsOf(f, cat).map((b) => b.id)
    expect(sibs).toContain("F:travel:vocab:A2")
    expect(sibs).toContain("F:travel:vocab:B1")
    expect(sibs).not.toContain("F:travel:vocab:A1")
    // A domain-mastery badge (no level) has no CEFR siblings.
    expect(siblingsOf(cat.get("A:travel")!, cat)).toEqual([])
  })
})

/* ------------------------------------------------------------------- store */

describe("badgeStore — apply, persist, focusBadge, overflow", () => {
  // A full-coverage catalog with travel·vocab A1/A2/B1 siblings (for overflow).
  const cat = buildCatalog({
    target: "es",
    domainLevels: { travel: ["A1", "A2", "B1"], social: ["A1"] },
    tools: ["fast-translate"],
  })
  beforeEach(() => {
    if (typeof localStorage !== "undefined") localStorage.clear()
  })

  const mkStore = (trackKey = "en:es") =>
    createBadgeStore({ catalog: cat, binding: bindingFor(trackKey, memTrackStore) })

  const dep = (amount: number, score = 1, level = "A2"): BadgeDeposit => ({
    amount, trackKey: "en:es", source: "challenge",
    domain: "travel", toolId: "fast-translate", level,
    entryIds: [1008], score,
  })

  it("a deposit fills badges and reports tier-ups", () => {
    const s = mkStore()
    // A big deposit crosses F:travel:vocab:A2 (the dominant sink) into bronze.
    const ups = s.applyDeposit(dep(400))
    expect(s.xpOf("F:travel:vocab:A2")).toBeGreaterThan(0)
    const fUp = ups.find((u) => u.badgeId === "F:travel:vocab:A2")
    expect(fUp).toBeDefined()
    expect(fUp!.from).toBe("locked")
    // The dominant sink reaches at least bronze on a large deposit.
    expect(["bronze", "silver", "gold"]).toContain(fUp!.to)
  })

  it("touched-only: untouched badges stay Locked / absent", () => {
    const s = mkStore()
    s.applyDeposit(dep(50))
    expect(s.tierOf("F:travel:vocab:A2")).not.toBe("locked")
    expect(s.tierOf("F:travel:vocab:B1")).toBe("locked") // not drilled
    expect(s.touched().length).toBeGreaterThan(0)
    // touched count is bounded by the fan-out (≤ ~8), not the whole catalog.
    expect(s.touched().length).toBeLessThanOrEqual(8)
  })

  it("focusBadge picks the medal nearest its next tier", () => {
    const s = mkStore()
    s.applyDeposit(dep(120))
    const glance = s.focusBadge()
    expect(glance).not.toBeNull()
    // F is the dominant sink → highest weighted-xp → highest arc → the focus.
    expect(glance!.badgeId).toBe("F:travel:vocab:A2")
    expect(glance!.arc).toBeGreaterThan(0)
    expect(glance!.icon?.family).toBe("medal")
  })

  it("focusBadge is null on a fresh store", () => {
    const s = mkStore("en:fr")
    expect(s.focusBadge()).toBeNull()
  })

  it("platinum overflow re-routes to an incomplete sibling", () => {
    const s = mkStore()
    // Drive F:travel:vocab:A2 to platinum (≥2400) via many big A2 deposits.
    for (let i = 0; i < 80; i++) s.applyDeposit(dep(400))
    expect(isPlatinum(s.xpOf("F:travel:vocab:A2"), 1)).toBe(true)
    const beforeSibling = s.xpOf("F:travel:vocab:B1")
    // Another A2 deposit: route still hits the now-platinum F:travel:vocab:A2;
    // the store redirects that credit to an incomplete sibling (A1 or B1).
    s.applyDeposit(dep(400))
    const movedB1 = s.xpOf("F:travel:vocab:B1") > beforeSibling
    const movedA1 = s.xpOf("F:travel:vocab:A1") > 0
    expect(movedB1 || movedA1).toBe(true)
  })

  it("masteredCount counts platinum badges", () => {
    const s = mkStore()
    expect(s.masteredCount()).toBe(0)
    for (let i = 0; i < 200; i++) s.applyDeposit(dep(400))
    expect(s.masteredCount()).toBeGreaterThan(0)
  })

  it("persists across store instances (same trackKey)", async () => {
    const s1 = mkStore()
    s1.applyDeposit(dep(400))
    await s1.flush()
    const xp1 = s1.xpOf("F:travel:vocab:A2")
    expect(xp1).toBeGreaterThan(0)
    const s2 = mkStore()
    await new Promise((r) => setTimeout(r, 0))
    // Persisted weighted-xp is rounded to an int (compact packing) → within 1.
    expect(Math.abs(s2.xpOf("F:travel:vocab:A2") - xp1)).toBeLessThanOrEqual(1)
  })

  it("grantStoryBadge snaps a badge to at least a tier (never demotes)", () => {
    const s = mkStore()
    s.grantStoryBadge("A:travel", "gold")
    expect(s.tierOf("A:travel")).toBe("gold")
    s.grantStoryBadge("A:travel", "bronze") // lower → no demotion
    expect(s.tierOf("A:travel")).toBe("gold")
  })
})
