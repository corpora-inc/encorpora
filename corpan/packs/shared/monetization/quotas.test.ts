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
})

// ── registry ─────────────────────────────────────────────────────

describe("QUOTAS registry", () => {
  it("has the expected metered surfaces with the verified values", () => {
    expect(QUOTAS.phrase_flips).toMatchObject({
      packId: "corpan_app",
      dailyLimit: 20,
      softNagEvery: 5,
      unitLabel: "phrases",
    })
    expect(QUOTAS.parlometron_daily).toMatchObject({
      packId: "pronunciation_coach",
      dailyLimit: 15,
      softNagEvery: 5,
      unitLabel: "rounds",
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
    // 15 free rounds (the registry value), then a hard lock.
    expect(gate.remaining()).toBe(15)
    for (let i = 0; i < 15; i++) gate.note()
    expect(gate.remaining()).toBe(0)
    expect(gate.isBlocked()).toBe(true)
    expect(locks.at(-1)).toMatchObject({ doneToday: 15, limit: 15, unitLabel: "rounds" })
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
    for (let i = 0; i < 4; i++) gate.note()
    expect(fires).toHaveLength(0)
    gate.note() // 5th → first soft nag
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
