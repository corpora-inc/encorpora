import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPaywallGate } from "./index"
import type { GateConfig, PaywallRequestDetail, StorageLike } from "./index"

// ── deterministic harness ────────────────────────────────────────

/** In-memory Storage stub with optional throw-on-write (WebKit-full sim). */
function makeStorage(opts?: { failWrites?: boolean }): StorageLike & { dump: Record<string, string> } {
  const dump: Record<string, string> = {}
  return {
    dump,
    getItem: (k) => (k in dump ? dump[k] : null),
    setItem: (k, v) => {
      if (opts?.failWrites) throw new Error("QuotaExceeded")
      dump[k] = v
    },
    removeItem: (k) => {
      delete dump[k]
    },
  }
}

/** A controllable clock. */
function makeClock(start = 1_700_000_000_000) {
  let t = start
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
    set: (ms: number) => {
      t = ms
    },
  }
}

function setup(overrides: Partial<GateConfig> = {}) {
  const clock = makeClock()
  const storage = makeStorage()
  const fires: PaywallRequestDetail[] = []
  const requestPaywall = vi.fn((d: PaywallRequestDetail) => {
    fires.push(d)
  })
  const isSubscribed = vi.fn(() => false)
  const base: GateConfig = {
    packId: "testpack",
    surface: "test_surface",
    mode: "action",
    limit: 3,
    now: clock.now,
    storage,
    requestPaywall,
    isSubscribed,
    ...overrides,
  }
  const gate = createPaywallGate(base)
  return { gate, clock, storage, fires, requestPaywall, isSubscribed }
}

describe("createPaywallGate", () => {
  describe("subscriber no-op", () => {
    it("never fires, never blocks, remaining is Infinity", () => {
      const { gate, fires } = setup({ isSubscribed: () => true, hardness: "hard" })
      for (let i = 0; i < 10; i++) {
        gate.note()
        gate.onInteraction()
      }
      expect(fires).toHaveLength(0)
      expect(gate.isBlocked()).toBe(false)
      expect(gate.remaining()).toBe(Infinity)
    })

    it("treats live subscribe mid-session as a no-op", () => {
      const isSubscribed = vi.fn(() => false)
      const { gate, fires } = setup({ isSubscribed, limit: 1 })
      gate.note()
      gate.note() // past limit, armed
      // user subscribes
      isSubscribed.mockReturnValue(true)
      gate.onInteraction()
      expect(fires).toHaveLength(0)
      expect(gate.remaining()).toBe(Infinity)
    })
  })

  describe("action mode", () => {
    it("fires on the interaction after crossing the limit", () => {
      const { gate, fires } = setup({ limit: 3, mode: "action" })
      gate.note()
      gate.onInteraction()
      expect(fires).toHaveLength(0) // 1 < 3
      gate.note()
      gate.note() // count = 3, armed
      gate.onInteraction()
      expect(fires).toHaveLength(1)
      expect(fires[0]).toMatchObject({
        surface: "test_surface",
        packId: "testpack",
        reason: "action",
        hardness: "soft",
      })
    })

    it("soft gate keeps counting and never blocks", () => {
      const { gate } = setup({ limit: 2, mode: "action", hardness: "soft" })
      gate.note()
      gate.note()
      gate.note()
      expect(gate.isBlocked()).toBe(false)
    })

    it("hard gate blocks once past the limit", () => {
      const { gate } = setup({ limit: 2, mode: "action", hardness: "hard" })
      expect(gate.isBlocked()).toBe(false)
      gate.note()
      expect(gate.isBlocked()).toBe(false) // 1 < 2
      gate.note()
      expect(gate.isBlocked()).toBe(true) // 2 >= 2
    })

    it("remaining() decrements and floors at 0", () => {
      const { gate } = setup({ limit: 3, mode: "action" })
      expect(gate.remaining()).toBe(3)
      gate.note()
      expect(gate.remaining()).toBe(2)
      gate.note()
      gate.note()
      gate.note()
      expect(gate.remaining()).toBe(0)
    })
  })

  describe("daily mode", () => {
    it("resets the counter across a local-day boundary", () => {
      const { gate, clock } = setup({ mode: "daily", limit: 2 })
      gate.note()
      gate.note()
      expect(gate.remaining()).toBe(0)
      // jump forward > 1 day
      clock.advance(26 * 60 * 60 * 1000)
      expect(gate.remaining()).toBe(2) // reset
      gate.note()
      expect(gate.remaining()).toBe(1)
    })

    it("fires with reason 'daily'", () => {
      const { gate, fires } = setup({ mode: "daily", limit: 1 })
      gate.note()
      gate.note()
      gate.onInteraction()
      expect(fires[0].reason).toBe("daily")
    })
  })

  describe("timed mode", () => {
    it("only fires on onInteraction after the interval, never on a bare timer", () => {
      const { gate, clock, fires } = setup({
        mode: "timed",
        intervalMs: 5_000,
        limit: undefined,
      })
      // interval not elapsed
      clock.advance(4_000)
      gate.onInteraction()
      expect(fires).toHaveLength(0)
      // elapse the interval — but NO interaction → still nothing
      clock.advance(2_000)
      expect(fires).toHaveLength(0)
      // now an interaction fires it
      gate.onInteraction()
      expect(fires).toHaveLength(1)
      expect(fires[0].reason).toBe("timed")
    })

    it("re-arms after firing", () => {
      const { gate, clock, fires } = setup({ mode: "timed", intervalMs: 5_000 })
      clock.advance(6_000)
      gate.onInteraction()
      expect(fires).toHaveLength(1)
      // immediately again — not re-armed yet
      gate.onInteraction()
      expect(fires).toHaveLength(1)
      // wait the interval again
      clock.advance(6_000)
      gate.onInteraction()
      expect(fires).toHaveLength(2)
    })

    it("note() is a no-op; isBlocked false; remaining null", () => {
      const { gate, fires } = setup({ mode: "timed", intervalMs: 1_000, hardness: "hard" })
      gate.note()
      gate.note()
      expect(fires).toHaveLength(0)
      expect(gate.isBlocked()).toBe(false)
      expect(gate.remaining()).toBeNull()
    })
  })

  describe("session cap backstop", () => {
    it("stops firing after sessionCap fires", () => {
      const { gate, fires } = setup({ mode: "action", limit: 1, sessionCap: 2 })
      gate.note()
      gate.note() // armed
      gate.onInteraction()
      gate.onInteraction()
      gate.onInteraction()
      gate.onInteraction()
      expect(fires).toHaveLength(2) // capped at 2
    })

    it("caps timed fires too", () => {
      const { gate, clock, fires } = setup({
        mode: "timed",
        intervalMs: 1_000,
        sessionCap: 1,
      })
      clock.advance(2_000)
      gate.onInteraction()
      clock.advance(2_000)
      gate.onInteraction()
      expect(fires).toHaveLength(1)
    })
  })

  describe("persistence + resilience", () => {
    it("persists the action count under a namespaced key", () => {
      const { gate, storage } = setup({ packId: "p1", surface: "s1", mode: "action", limit: 5 })
      gate.note()
      gate.note()
      expect(storage.dump["corpan:gate:p1:s1"]).toBeTruthy()
      const parsed = JSON.parse(storage.dump["corpan:gate:p1:s1"])
      expect(parsed.count).toBe(2)
    })

    it("survives malformed stored JSON", () => {
      const storage = makeStorage()
      storage.dump["corpan:gate:testpack:test_surface"] = "{not json"
      const clock = makeClock()
      const gate = createPaywallGate({
        packId: "testpack",
        surface: "test_surface",
        mode: "action",
        limit: 3,
        now: clock.now,
        storage,
        isSubscribed: () => false,
        requestPaywall: () => {},
      })
      expect(gate.remaining()).toBe(3)
      gate.note()
      expect(gate.remaining()).toBe(2)
    })

    it("works with no storage (in-memory mirror carries the session)", () => {
      const clock = makeClock()
      const fires: PaywallRequestDetail[] = []
      const gate = createPaywallGate({
        packId: "testpack",
        surface: "test_surface",
        mode: "action",
        limit: 1,
        now: clock.now,
        storage: undefined,
        isSubscribed: () => false,
        requestPaywall: (d) => fires.push(d),
      })
      gate.note()
      expect(gate.remaining()).toBe(0)
      gate.note()
      gate.onInteraction()
      expect(fires).toHaveLength(1)
    })

    it("survives storage that throws on write", () => {
      const storage = makeStorage({ failWrites: true })
      const clock = makeClock()
      const gate = createPaywallGate({
        packId: "testpack",
        surface: "test_surface",
        mode: "action",
        limit: 2,
        now: clock.now,
        storage,
        isSubscribed: () => false,
        requestPaywall: () => {},
      })
      gate.note()
      gate.note()
      // counted in memory despite write failures
      expect(gate.remaining()).toBe(0)
    })
  })

  describe("reset / dispose", () => {
    it("reset clears persisted + session-cap state", () => {
      const { gate, storage, fires } = setup({ mode: "action", limit: 1, sessionCap: 1 })
      gate.note()
      gate.note()
      gate.onInteraction()
      expect(fires).toHaveLength(1)
      gate.reset()
      expect(storage.dump["corpan:gate:testpack:test_surface"]).toBeUndefined()
      expect(gate.remaining()).toBe(1)
      // session cap also reset → fires again after re-arming
      gate.note()
      gate.note()
      gate.onInteraction()
      expect(fires).toHaveLength(2)
    })

    it("dispose makes note/onInteraction no-ops", () => {
      const { gate, fires } = setup({ mode: "action", limit: 1 })
      gate.dispose()
      gate.note()
      gate.note()
      gate.onInteraction()
      expect(fires).toHaveLength(0)
    })
  })

  describe("default detail + extras", () => {
    it("merges config.detail into the request", () => {
      const fires: PaywallRequestDetail[] = []
      const clock = makeClock()
      const gate = createPaywallGate({
        packId: "reader",
        surface: "reader_eof_free",
        mode: "action",
        limit: 1,
        detail: { theme: "stargate", bookId: "b1" },
        now: clock.now,
        storage: makeStorage(),
        isSubscribed: () => false,
        requestPaywall: (d) => fires.push(d),
      })
      gate.note()
      gate.note()
      gate.onInteraction()
      expect(fires[0]).toMatchObject({
        theme: "stargate",
        bookId: "b1",
        surface: "reader_eof_free",
        packId: "reader",
      })
    })
  })
})
