// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import {
  PACK_ID,
  parseJourneyToolId,
  buildChallengeInputs,
  toActivityResult,
  mountJourneyChallenge,
  synthesizeFallbackActivitySpec,
} from "./adapter"
import type { ChallengeResultPlus } from "@corpan-city/contracts"
import type {
  ActivitySpec,
  ActivityResult,
  ItemRef,
} from "../sdk/activityContract"
// The CONTRACT Zod schemas — imported from the app module itself (the one
// authoritative validator, activity-contract §3.1), not a test-local copy.
import {
  ActivitySpecSchema,
  ActivityResultSchema,
  ActivityResultEventDetailSchema,
} from "../../../../corpan-app/src/contentPacks/activitySchemas"

const ref = (id: string, source = "base"): ItemRef => ({
  kind: "phrase",
  source,
  id,
})

const makeSpec = (over: Partial<ActivitySpec> = {}): ActivitySpec => ({
  specId: "js-1750000000000-cc01",
  activityType: "corpan_city:fast-translate",
  itemRefs: [ref("11"), ref("12"), ref("13", "travel-pack")],
  params: { contentFilter: { domains: ["travel"], levels: ["A1"] } },
  level: "A1",
  targetLang: "es",
  nativeLang: "en",
  ...over,
})

/** A journey-capable host slice with an EMPTY corpus (tools abort per #67). */
function makeHost(withJourney: boolean) {
  const reported: {
    results: ActivityResult[]
    abandons: string[]
  } = { results: [], abandons: [] }
  const host: Record<string, unknown> = {
    speak: async () => {},
    getRandomEntry: async () => {
      throw new Error("empty corpus")
    },
    getRandomEntries: async () => [],
    getEntryById: async () => {
      throw new Error("empty corpus")
    },
  }
  if (withJourney) {
    host.journey = {
      isActive: () => true,
      getSpec: () => null,
      reportItem: () => {},
      reportResult: (result: ActivityResult) => reported.results.push(result),
      abandon: (reason?: string) => reported.abandons.push(reason ?? "user_exit"),
    }
  }
  return { host, reported }
}

const waitFor = async (cond: () => boolean, ms = 4000): Promise<void> => {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("waitFor timed out")
    await new Promise((r) => setTimeout(r, 25))
  }
}

describe("journey adapter — spec parsing + field mapping (contract §6.3)", () => {
  it("fixture spec passes the contract schema", () => {
    expect(ActivitySpecSchema.safeParse(makeSpec()).success).toBe(true)
  })

  it("parses corpan_city:<toolId> and rejects foreign/unknown types", () => {
    expect(parseJourneyToolId("corpan_city:fast-translate")).toBe("fast-translate")
    // Legacy contract ids stay parseable (runChallenge resolves the alias).
    expect(parseJourneyToolId("corpan_city:speed-drill")).toBe("speed-drill")
    expect(parseJourneyToolId("corpan_city:not-a-tool")).toBeNull()
    expect(parseJourneyToolId("lingo_hero:round")).toBeNull()
    expect(parseJourneyToolId("fast-translate")).toBeNull()
  })

  it("maps ActivitySpec → ChallengeContext/partialSpec both directions of the table", () => {
    const { ctx, partialSpec, entrySources, refByEntryId } =
      buildChallengeInputs(makeSpec())
    expect(ctx.language).toBe("es")
    expect(ctx.nativeLanguage).toBe("en")
    expect(ctx.level).toBe("A1")
    expect(ctx.mode).toBe("solo")
    expect(ctx.entryIds).toEqual([11, 12, 13])
    // THEMED/LEVEL filter forwarded from params.contentFilter.
    expect(ctx.domains).toEqual(["travel"])
    expect(ctx.levels).toEqual(["A1"])
    // The internal challengeId IS the specId (round-trip key).
    expect(partialSpec.challengeId).toBe("js-1750000000000-cc01")
    // Non-base refs travel through params.entrySources (entry_id is only
    // unique per source).
    expect(entrySources).toEqual({ "13": "travel-pack" })
    expect(
      (partialSpec.params as Record<string, unknown>).entrySources,
    ).toEqual({ "13": "travel-pack" })
    expect(refByEntryId.get(13)?.source).toBe("travel-pack")
  })

  it("maps a completed ChallengeResultPlus → schema-valid score-only ActivityResult (R9)", () => {
    const spec = makeSpec()
    const { refByEntryId } = buildChallengeInputs(spec)
    const plus = {
      challengeId: spec.specId,
      toolId: "fast-translate",
      playerId: "player-local",
      score: 0.8,
      // Aggregate detail only — NO item:* keys (today's city tools).
      detail: { score: 0.8, xp: 12, coins: 3, items: 0 },
      xp: [],
      completedAt: Date.now(),
      offline: true,
      rewards: { xp: 12, coins: 3, items: [] },
      outcome: "completed",
    } as unknown as ChallengeResultPlus
    const result = toActivityResult(spec, plus, 61_000, refByEntryId)
    expect(ActivityResultSchema.safeParse(result).success).toBe(true)
    expect(result.specId).toBe(spec.specId)
    expect(result.score).toBe(0.8)
    // Aggregate-only tools report SCORE-ONLY — never fabricated per-item rows.
    expect(result.perItem).toEqual([])
    expect(result.abandoned).toBeUndefined()
    expect(result.durationMs).toBe(61_000)
    // R3 envelope: city numeric detail lands in detail.numbers verbatim.
    expect(result.detail?.numbers?.xp).toBe(12)
  })

  it("emits perItem ONLY for genuine item:<entryId> verdicts, skipping unscheduled ids", () => {
    const spec = makeSpec()
    const { refByEntryId } = buildChallengeInputs(spec)
    const plus = {
      challengeId: spec.specId,
      toolId: "memory-pairs",
      playerId: "player-local",
      score: 0.5,
      detail: { score: 0.5, "item:11": 1, "item:12": 0.5, "item:13": 0, "item:999": 1 },
      xp: [],
      completedAt: Date.now(),
      offline: true,
      rewards: { xp: 0, coins: 0, items: [] },
      outcome: "completed",
    } as unknown as ChallengeResultPlus
    const result = toActivityResult(spec, plus, 45_000, refByEntryId)
    expect(ActivityResultSchema.safeParse(result).success).toBe(true)
    expect(result.perItem.map((i) => [i.itemRef.id, i.outcome])).toEqual([
      ["11", "pass"],
      ["12", "partial"],
      ["13", "fail"],
    ])
    // The engine's exact refs come back — including the phrase-pack source.
    expect(result.perItem[2].itemRef.source).toBe("travel-pack")
  })

  it("single scheduled item + no item:* detail → aggregate-binned perItem (R9, interlude drill)", () => {
    const spec = makeSpec({ itemRefs: [ref("42", "travel-pack")] })
    const { refByEntryId } = buildChallengeInputs(spec)
    const plus = {
      challengeId: spec.specId,
      toolId: "fast-translate",
      playerId: "player-local",
      score: 0.9,
      detail: { score: 0.9, xp: 8 }, // aggregate only — no item:* keys
      xp: [],
      completedAt: Date.now(),
      offline: true,
      rewards: { xp: 8, coins: 0, items: [] },
      outcome: "completed",
    } as unknown as ChallengeResultPlus
    const result = toActivityResult(spec, plus, 30_000, refByEntryId)
    expect(ActivityResultSchema.safeParse(result).success).toBe(true)
    expect(result.perItem).toHaveLength(1)
    expect(result.perItem[0].itemRef.id).toBe("42")
    expect(result.perItem[0].itemRef.source).toBe("travel-pack")
    expect(result.perItem[0].outcome).toBe("pass")
    // The reserved flag that makes the engine clamp the grade to [Hard, Good].
    expect(result.perItem[0].detail?.flags?.aggregateBinned).toBe(true)
  })

  it("single-item binning maps a low score to fail and a mid score to partial", () => {
    const spec = makeSpec({ itemRefs: [ref("7")] })
    const { refByEntryId } = buildChallengeInputs(spec)
    const mk = (score: number, outcome: string = "completed") =>
      ({
        challengeId: spec.specId,
        toolId: "fast-translate",
        playerId: "p",
        score,
        detail: { score },
        xp: [],
        completedAt: Date.now(),
        offline: true,
        rewards: { xp: 0, coins: 0, items: [] },
        outcome,
      }) as unknown as ChallengeResultPlus
    expect(
      toActivityResult(spec, mk(0.5), 1000, refByEntryId).perItem[0].outcome,
    ).toBe("partial")
    expect(
      toActivityResult(spec, mk(0), 1000, refByEntryId).perItem[0].outcome,
    ).toBe("fail")
    // An aborted single-item round stays SCORE-ONLY (abandoned, no binned hit).
    const aborted = toActivityResult(spec, mk(0, "aborted"), 1000, refByEntryId)
    expect(aborted.perItem).toEqual([])
    expect(aborted.abandoned).toBe(true)
  })

  it("MULTI-item round with no item:* detail stays score-only (never fans out)", () => {
    const spec = makeSpec({ itemRefs: [ref("1"), ref("2"), ref("3")] })
    const { refByEntryId } = buildChallengeInputs(spec)
    const plus = {
      challengeId: spec.specId,
      toolId: "fast-translate",
      playerId: "p",
      score: 0.7,
      detail: { score: 0.7 },
      xp: [],
      completedAt: Date.now(),
      offline: true,
      rewards: { xp: 0, coins: 0, items: [] },
      outcome: "completed",
    } as unknown as ChallengeResultPlus
    const result = toActivityResult(spec, plus, 40_000, refByEntryId)
    expect(result.perItem).toEqual([])
  })

  it("maps outcome 'aborted' → abandoned: true and clamps score", () => {
    const spec = makeSpec()
    const { refByEntryId } = buildChallengeInputs(spec)
    const plus = {
      challengeId: "fast-translate-aborted-x",
      toolId: "fast-translate",
      playerId: "player-local",
      score: 0,
      detail: { score: 0 },
      xp: [],
      completedAt: Date.now(),
      offline: true,
      rewards: { xp: 0, coins: 0, items: [] },
      outcome: "aborted",
    } as unknown as ChallengeResultPlus
    const result = toActivityResult(spec, plus, 900, refByEntryId)
    expect(ActivityResultSchema.safeParse(result).success).toBe(true)
    // specId comes from the SPEC, never the tool's minted abort id.
    expect(result.specId).toBe(spec.specId)
    expect(result.abandoned).toBe(true)
  })
})

describe("journey adapter — fixture journey mount (world never boots)", () => {
  it("unsupported activityType → abandon('unsupported') + corpan:exit, no result", async () => {
    const { host, reported } = makeHost(true)
    let exits = 0
    const onExit = () => exits++
    window.addEventListener("corpan:exit", onExit)
    try {
      const container = document.createElement("div")
      document.body.appendChild(container)
      mountJourneyChallenge(
        container,
        host,
        makeSpec({ activityType: "corpan_city:not-a-tool" }),
      )
      expect(reported.abandons).toEqual(["unsupported"])
      expect(reported.results).toEqual([])
      expect(exits).toBe(1)
    } finally {
      window.removeEventListener("corpan:exit", onExit)
    }
  })

  it("empty-content abort: mount → runChallenge aborts → schema-valid abandoned result on the typed rail + corpan:exit", async () => {
    const { host, reported } = makeHost(true)
    let exits = 0
    const onExit = () => exits++
    window.addEventListener("corpan:exit", onExit)
    try {
      const container = document.createElement("div")
      document.body.appendChild(container)
      const spec = makeSpec()
      mountJourneyChallenge(container, host, spec)
      await waitFor(() => reported.results.length === 1)
      const result = reported.results[0]
      expect(ActivityResultSchema.safeParse(result).success).toBe(true)
      expect(result.specId).toBe(spec.specId)
      expect(result.abandoned).toBe(true)
      expect(result.score).toBe(0)
      expect(result.perItem).toEqual([])
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
      expect(exits).toBe(1)
    } finally {
      window.removeEventListener("corpan:exit", onExit)
    }
  })

  it("event-rail fallback: no hostApi.journey → corpan:activity-result carries {packId, result}", async () => {
    const { host } = makeHost(false)
    const events: unknown[] = []
    const onResult = (e: Event) => events.push((e as CustomEvent).detail)
    window.addEventListener("corpan:activity-result", onResult)
    try {
      const container = document.createElement("div")
      document.body.appendChild(container)
      const spec = makeSpec()
      mountJourneyChallenge(container, host, spec)
      await waitFor(() => events.length === 1)
      const parsed = ActivityResultEventDetailSchema.safeParse(events[0])
      expect(parsed.success).toBe(true)
      expect((events[0] as { packId: string }).packId).toBe(PACK_ID)
      expect((events[0] as { result: ActivityResult }).result.specId).toBe(
        spec.specId,
      )
    } finally {
      window.removeEventListener("corpan:activity-result", onResult)
    }
  })

  it("unmount before the tool resolves → no late result is reported (host synthesis owns it)", async () => {
    const { host, reported } = makeHost(true)
    const container = document.createElement("div")
    document.body.appendChild(container)
    const handle = mountJourneyChallenge(container, host, makeSpec())
    handle.unmount()
    await new Promise((r) => setTimeout(r, 300))
    expect(reported.results).toEqual([])
  })
})

describe("journey adapter — synthesizeFallbackActivitySpec (WS-D defense in depth)", () => {
  it("no host at all → schema-valid spec on the DEFAULT_PAIR target (es), no UI", () => {
    const spec = synthesizeFallbackActivitySpec(undefined)
    expect(ActivitySpecSchema.safeParse(spec).success).toBe(true)
    expect(spec.activityType).toBe("corpan_city:fast-translate")
    expect(spec.itemRefs).toEqual([])
    expect(spec.targetLang).toBe("es")
    // No stack at all → defaultPairFor's immersion branch (native mirrors
    // target); nativeLang is correctly omitted (matches `pairFor`'s existing,
    // separately-relied-on semantics — see `src/entry/index.ts`).
    expect(spec.nativeLang).toBeUndefined()
    // parseJourneyToolId must resolve it — it has to actually be runnable.
    expect(parseJourneyToolId(spec.activityType)).toBe("fast-translate")
  })

  it("derives the pair from the live stack (multi-target → FIRST target, no chooser)", () => {
    const host = {
      getStackConfig: () => ({
        activeStackId: "s1",
        languages: ["fr", "de", "it"],
      }),
    }
    const spec = synthesizeFallbackActivitySpec(host)
    expect(spec.targetLang).toBe("de") // languages[1] — the first target
    expect(spec.nativeLang).toBe("fr")
  })

  it("single-language (immersion) stack → target===native and nativeLang omitted", () => {
    const host = {
      getStackConfig: () => ({ activeStackId: "s1", languages: ["ja"] }),
    }
    const spec = synthesizeFallbackActivitySpec(host)
    expect(spec.targetLang).toBe("ja")
    expect(spec.nativeLang).toBeUndefined()
  })

  it("mints a fresh specId per call", () => {
    const a = synthesizeFallbackActivitySpec(undefined)
    const b = synthesizeFallbackActivitySpec(undefined)
    expect(a.specId).not.toBe(b.specId)
  })
})
