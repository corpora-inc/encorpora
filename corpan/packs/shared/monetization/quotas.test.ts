import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  createDailyQuota,
  createPaywallGate,
  getQuota,
  QUOTAS,
  type GateRegistry,
  type StorageLike,
} from "./index"

// ── deterministic harness ────────────────────────────────────────

function makeStorage(): StorageLike & { dump: Record<string, string> } {
  const dump: Record<string, string> = {}
  return {
    dump,
    getItem: (k) => (k in dump ? dump[k] : null),
    setItem: (k, v) => {
      dump[k] = v
    },
    removeItem: (k) => {
      delete dump[k]
    },
  }
}

function makeClock(start = 1_700_000_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

function localDay(now: number): string {
  const d = new Date(now)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

beforeEach(() => {
  ;(globalThis as { __CORPAN_HOST_CAPS?: { dailyLock?: boolean } }).__CORPAN_HOST_CAPS = {
    dailyLock: true,
  }
  ;(globalThis as { __corpanGates?: GateRegistry }).__corpanGates = {}
})
afterEach(() => {
  delete (globalThis as { __CORPAN_HOST_CAPS?: unknown }).__CORPAN_HOST_CAPS
  delete (globalThis as { __corpanGates?: unknown }).__corpanGates
  // Always clear any remote override the test installed.
  delete (globalThis as { __corpanQuotaConfig?: unknown }).__corpanQuotaConfig
})

/** Install a remote-config override on the global `getQuota` reads. */
function setRemoteConfig(cfg: unknown): void {
  ;(globalThis as { __corpanQuotaConfig?: unknown }).__corpanQuotaConfig = cfg
}

// ── registry ─────────────────────────────────────────────────────

describe("QUOTAS registry", () => {
  it("has the expected metered surfaces with the verified values", () => {
    expect(QUOTAS.phrase_flips).toMatchObject({
      packId: "corpan_app",
      dailyLimit: 20,
      softNagEvery: 10,
      unitLabel: "phrases",
    })
    expect(QUOTAS.parlometron_daily).toMatchObject({
      packId: "pronunciation_coach",
      dailyLimit: 10,
      softNagEvery: 0,
      unitLabel: "phrases",
    })
    expect(QUOTAS.hover_phrases).toMatchObject({ packId: "hover-runner", dailyLimit: 20 })
    expect(QUOTAS.juice_phrases).toMatchObject({ packId: "juice_squeeze", dailyLimit: 20 })
    expect(QUOTAS.hanzipan_chars).toMatchObject({
      packId: "hanzipan",
      dailyLimit: 20,
      unitLabel: "characters",
    })
    expect(QUOTAS.tutomaton_daily).toMatchObject({
      packId: "tutomaton",
      dailyLimit: 20,
      unitLabel: "messages",
      legacyKey: "tutomaton.quota",
    })
  })

  it("every row's surface matches its key", () => {
    for (const [key, cfg] of Object.entries(QUOTAS)) {
      expect(cfg.surface).toBe(key)
    }
  })

  it("getQuota returns the row; throws on an unknown surface", () => {
    expect(getQuota("hover_phrases").packId).toBe("hover-runner")
    // @ts-expect-error — intentionally invalid surface
    expect(() => getQuota("nope_surface")).toThrow()
  })
})

// ── remote-config override (getQuota merge seam) ─────────────────

describe("getQuota remote-config override", () => {
  it("no config → returns the baked row unchanged", () => {
    expect(getQuota("hover_phrases")).toEqual(QUOTAS.hover_phrases)
  })

  it("merges dailyLimit AND softNagEvery OVER the baked row", () => {
    setRemoteConfig({
      version: 3,
      quotas: { hover_phrases: { dailyLimit: 30, softNagEvery: 10 } },
    })
    const q = getQuota("hover_phrases")
    expect(q.dailyLimit).toBe(30)
    expect(q.softNagEvery).toBe(10)
    // identity fields always stay baked
    expect(q.packId).toBe("hover-runner")
    expect(q.surface).toBe("hover_phrases")
    expect(q.unitLabel).toBe("phrases")
  })

  it("a partial override touches only the provided field (limit only)", () => {
    setRemoteConfig({ version: 1, quotas: { phrase_flips: { dailyLimit: 12 } } })
    const q = getQuota("phrase_flips")
    expect(q.dailyLimit).toBe(12)
    expect(q.softNagEvery).toBe(QUOTAS.phrase_flips.softNagEvery) // baked 10
  })

  it("a partial override touches only the provided field (nag only)", () => {
    setRemoteConfig({ version: 1, quotas: { phrase_flips: { softNagEvery: 3 } } })
    const q = getQuota("phrase_flips")
    expect(q.dailyLimit).toBe(QUOTAS.phrase_flips.dailyLimit) // baked 20
    expect(q.softNagEvery).toBe(3)
  })

  it("does NOT mutate the baked QUOTAS row (returns a copy when overriding)", () => {
    setRemoteConfig({ version: 1, quotas: { hover_phrases: { dailyLimit: 50 } } })
    const q = getQuota("hover_phrases")
    expect(q.dailyLimit).toBe(50)
    expect(QUOTAS.hover_phrases.dailyLimit).toBe(20) // baked untouched
  })

  // ── clamping ──
  it("clamps an over-range dailyLimit to the max (1000)", () => {
    setRemoteConfig({ version: 1, quotas: { hover_phrases: { dailyLimit: 99999 } } })
    expect(getQuota("hover_phrases").dailyLimit).toBe(1000)
  })

  it("clamps a below-range / zero dailyLimit to the min (1)", () => {
    setRemoteConfig({ version: 1, quotas: { hover_phrases: { dailyLimit: 0 } } })
    expect(getQuota("hover_phrases").dailyLimit).toBe(1)
  })

  it("ignores a negative dailyLimit by clamping to the min (1)", () => {
    setRemoteConfig({ version: 1, quotas: { hover_phrases: { dailyLimit: -5 } } })
    expect(getQuota("hover_phrases").dailyLimit).toBe(1)
  })

  it("drops a non-number dailyLimit → keeps baked", () => {
    setRemoteConfig({
      version: 1,
      quotas: { hover_phrases: { dailyLimit: "30" as unknown as number } },
    })
    expect(getQuota("hover_phrases").dailyLimit).toBe(20)
  })

  it("drops NaN / Infinity values → keeps baked", () => {
    setRemoteConfig({
      version: 1,
      quotas: {
        hover_phrases: { dailyLimit: NaN, softNagEvery: Infinity },
      },
    })
    const q = getQuota("hover_phrases")
    expect(q.dailyLimit).toBe(20)
    expect(q.softNagEvery).toBe(10)
  })

  it("clamps softNagEvery to the (overridden) dailyLimit", () => {
    setRemoteConfig({
      version: 1,
      quotas: { hover_phrases: { dailyLimit: 8, softNagEvery: 99 } },
    })
    const q = getQuota("hover_phrases")
    expect(q.dailyLimit).toBe(8)
    expect(q.softNagEvery).toBe(8) // capped at the new limit, not 99
  })

  it("rounds fractional values to ints", () => {
    setRemoteConfig({
      version: 1,
      quotas: { hover_phrases: { dailyLimit: 24.7 } },
    })
    expect(getQuota("hover_phrases").dailyLimit).toBe(25)
  })

  // ── unknown / malformed ──
  it("ignores an unknown surface in the override (doesn't affect known ones)", () => {
    setRemoteConfig({
      version: 1,
      quotas: { some_unknown_surface: { dailyLimit: 5 } },
    })
    expect(getQuota("hover_phrases")).toEqual(QUOTAS.hover_phrases)
  })

  it("malformed config (quotas not an object) → baked defaults", () => {
    setRemoteConfig({ version: 1, quotas: "nope" })
    expect(getQuota("hover_phrases")).toEqual(QUOTAS.hover_phrases)
  })

  it("malformed config (null / wrong shape) → baked defaults, no throw", () => {
    setRemoteConfig(null)
    expect(getQuota("hover_phrases")).toEqual(QUOTAS.hover_phrases)
    setRemoteConfig(42)
    expect(getQuota("hover_phrases")).toEqual(QUOTAS.hover_phrases)
    setRemoteConfig({ quotas: { hover_phrases: null } })
    expect(getQuota("hover_phrases")).toEqual(QUOTAS.hover_phrases)
  })

  it("the override flows through createDailyQuota → the live gate's remaining()", () => {
    setRemoteConfig({ version: 1, quotas: { juice_phrases: { dailyLimit: 7 } } })
    const gate = createDailyQuota("juice_phrases", {
      storage: makeStorage(),
      now: makeClock().now,
      isSubscribed: () => false,
    })
    expect(gate.remaining()).toBe(7) // overridden cap, not baked 20
  })
})

// ── createDailyQuota ─────────────────────────────────────────────

describe("createDailyQuota", () => {
  it("builds a gate-v2 daily gate from the registry row (key/limit/nag/unit)", () => {
    const clock = makeClock()
    const storage = makeStorage()
    const locks: Array<{ doneToday: number; limit: number; unitLabel: string }> = []
    const gate = createDailyQuota("parlometron_daily", {
      storage,
      now: clock.now,
      isSubscribed: () => false,
      requestDailyLock: (d) => locks.push(d),
    })
    // 10 free new phrases (the registry value), no soft nag, then a hard lock.
    expect(gate.remaining()).toBe(10)
    for (let i = 0; i < 10; i++) gate.note()
    expect(gate.remaining()).toBe(0)
    expect(gate.isBlocked()).toBe(true)
    expect(locks.at(-1)).toMatchObject({ doneToday: 10, limit: 10, unitLabel: "phrases" })
    // persisted under the standard key
    expect(storage.dump["corpan:gate:pronunciation_coach:parlometron_daily"]).toBeTruthy()
  })

  it("fires the soft nag at the registry cadence before the cap", () => {
    const storage = makeStorage()
    const clock = makeClock()
    const fires: unknown[] = []
    const gate = createDailyQuota("hover_phrases", {
      storage,
      now: clock.now,
      isSubscribed: () => false,
      requestPaywall: (d) => fires.push(d),
    })
    for (let i = 0; i < 9; i++) gate.note()
    expect(fires).toHaveLength(0)
    gate.note() // 10th → first soft nag
    expect(fires).toHaveLength(1)
  })

  it("subscribers are a no-op", () => {
    const gate = createDailyQuota("juice_phrases", {
      storage: makeStorage(),
      now: makeClock().now,
      isSubscribed: () => true,
    })
    for (let i = 0; i < 50; i++) gate.note()
    expect(gate.isBlocked()).toBe(false)
    expect(gate.remaining()).toBe(Infinity)
  })
})

// ── legacy-key migration ─────────────────────────────────────────

describe("legacy-key migration", () => {
  it("imports a legacy <packId>.quota count once when the standard key is absent", () => {
    const clock = makeClock()
    const storage = makeStorage()
    const today = localDay(clock.now())
    // pre-gate build left a `tutomaton.quota` with 7 messages today
    storage.dump["tutomaton.quota"] = JSON.stringify({ day: today, count: 7 })
    const gate = createPaywallGate({
      packId: "tutomaton",
      surface: "tutomaton_daily",
      mode: "daily",
      dailyLimit: 20,
      legacyKey: "tutomaton.quota",
      now: clock.now,
      storage,
      isSubscribed: () => false,
    })
    // count preserved → 20 - 7 = 13 remaining
    expect(gate.remaining()).toBe(13)
    const std = JSON.parse(storage.dump["corpan:gate:tutomaton:tutomaton_daily"])
    expect(std.count).toBe(7)
  })

  it("does NOT overwrite an existing standard key", () => {
    const clock = makeClock()
    const storage = makeStorage()
    const today = localDay(clock.now())
    storage.dump["corpan:gate:tutomaton:tutomaton_daily"] = JSON.stringify({
      day: today,
      count: 3,
      lastFireAt: 0,
    })
    storage.dump["tutomaton.quota"] = JSON.stringify({ day: today, count: 7 })
    const gate = createPaywallGate({
      packId: "tutomaton",
      surface: "tutomaton_daily",
      mode: "daily",
      dailyLimit: 20,
      legacyKey: "tutomaton.quota",
      now: clock.now,
      storage,
      isSubscribed: () => false,
    })
    expect(gate.remaining()).toBe(17) // 20 - 3 (the standard key wins)
  })

  it("survives a malformed legacy key (no crash, fresh start)", () => {
    const clock = makeClock()
    const storage = makeStorage()
    storage.dump["tutomaton.quota"] = "{not json"
    const gate = createPaywallGate({
      packId: "tutomaton",
      surface: "tutomaton_daily",
      mode: "daily",
      dailyLimit: 20,
      legacyKey: "tutomaton.quota",
      now: clock.now,
      storage,
      isSubscribed: () => false,
    })
    expect(gate.remaining()).toBe(20)
  })

  it("createDailyQuota wires the registry legacyKey through for tutomaton", () => {
    const clock = makeClock()
    const storage = makeStorage()
    const today = localDay(clock.now())
    storage.dump["tutomaton.quota"] = JSON.stringify({ day: today, count: 4 })
    const gate = createDailyQuota("tutomaton_daily", {
      storage,
      now: clock.now,
      isSubscribed: () => false,
    })
    expect(gate.remaining()).toBe(16) // 20 - 4 imported
  })
})

// ── live registry + debug set ────────────────────────────────────

describe("globalThis.__corpanGates registry", () => {
  it("registers on construct under packId:surface and unregisters on dispose", () => {
    const reg = (globalThis as { __corpanGates?: GateRegistry }).__corpanGates!
    const gate = createDailyQuota("hover_phrases", {
      storage: makeStorage(),
      now: makeClock().now,
      isSubscribed: () => false,
    })
    expect(reg["hover-runner:hover_phrases"]?.gate).toBe(gate)
    expect(reg["hover-runner:hover_phrases"]).toMatchObject({
      packId: "hover-runner",
      surface: "hover_phrases",
    })
    gate.dispose()
    expect(reg["hover-runner:hover_phrases"]).toBeUndefined()
  })

  it("debug-set pattern: reset + write standard key reflects `used` exactly, no reload", () => {
    const clock = makeClock()
    const storage = makeStorage()
    const gate = createDailyQuota("juice_phrases", {
      storage,
      now: clock.now,
      isSubscribed: () => false,
    })
    // simulate use
    for (let i = 0; i < 10; i++) gate.note()
    expect(gate.remaining()).toBe(10)
    // debug set to 18 used (the registry+debug-set path: reset() then write)
    const reg = (globalThis as { __corpanGates?: GateRegistry }).__corpanGates!
    const entry = Object.values(reg).find((g) => g.surface === "juice_phrases")!
    entry.gate.reset()
    storage.dump[`corpan:gate:${entry.packId}:${entry.surface}`] = JSON.stringify({
      day: localDay(clock.now()),
      count: 18,
      lastFireAt: 0,
    })
    // downward+upward both reflect because reset() cleared the memory floor
    expect(gate.remaining()).toBe(2)
    // and we can also drive it back DOWN (the old max() bug)
    entry.gate.reset()
    storage.dump[`corpan:gate:${entry.packId}:${entry.surface}`] = JSON.stringify({
      day: localDay(clock.now()),
      count: 1,
      lastFireAt: 0,
    })
    expect(gate.remaining()).toBe(19)
  })
})
