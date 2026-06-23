import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getPackStreak, localDay, recordPackVisit } from "./index"

// ── in-memory localStorage stub ──────────────────────────────────
// jsdom isn't required: the module reads globalThis.localStorage, so a tiny
// stub gives us a deterministic, isolated store per test.

function installStorage(opts?: { failWrites?: boolean }) {
  const dump: Record<string, string> = {}
  const ls = {
    getItem: (k: string) => (k in dump ? dump[k] : null),
    setItem: (k: string, v: string) => {
      if (opts?.failWrites) throw new Error("QuotaExceeded")
      dump[k] = v
    },
    removeItem: (k: string) => {
      delete dump[k]
    },
  }
  ;(globalThis as { localStorage?: unknown }).localStorage = ls as unknown as Storage
  return dump
}

beforeEach(() => {
  installStorage()
  // Quiet the dispatched CustomEvent — jsdom/node may lack dispatchEvent.
  ;(globalThis as { dispatchEvent?: unknown }).dispatchEvent = vi.fn(() => true)
})

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage
})

describe("recordPackVisit", () => {
  it("a fresh pack reads as all-zero", () => {
    expect(getPackStreak("p1")).toEqual({ current: 0, longest: 0, lastDay: "" })
  })

  it("first visit starts the streak at 1", () => {
    const s = recordPackVisit("p1", "2026-06-10")
    expect(s).toEqual({ current: 1, longest: 1, lastDay: "2026-06-10" })
  })

  it("a second visit the SAME day is a no-op (idempotent)", () => {
    recordPackVisit("p1", "2026-06-10")
    const s = recordPackVisit("p1", "2026-06-10")
    expect(s).toEqual({ current: 1, longest: 1, lastDay: "2026-06-10" })
  })

  it("a consecutive day increments the streak", () => {
    recordPackVisit("p1", "2026-06-10")
    recordPackVisit("p1", "2026-06-11")
    const s = recordPackVisit("p1", "2026-06-12")
    expect(s.current).toBe(3)
    expect(s.longest).toBe(3)
    expect(s.lastDay).toBe("2026-06-12")
  })

  it("a gap of 2+ days resets current to 1 but keeps longest", () => {
    recordPackVisit("p1", "2026-06-10")
    recordPackVisit("p1", "2026-06-11")
    recordPackVisit("p1", "2026-06-12") // current 3
    const s = recordPackVisit("p1", "2026-06-15") // gap → reset
    expect(s.current).toBe(1)
    expect(s.longest).toBe(3)
    expect(s.lastDay).toBe("2026-06-15")
  })

  it("longest tracks the high-water mark across resets and re-runs", () => {
    recordPackVisit("p1", "2026-06-01")
    recordPackVisit("p1", "2026-06-02") // 2
    recordPackVisit("p1", "2026-06-10") // reset to 1
    recordPackVisit("p1", "2026-06-11") // 2
    const s = recordPackVisit("p1", "2026-06-12") // 3 — new high
    expect(s.current).toBe(3)
    expect(s.longest).toBe(3)
  })

  it("streaks are independent per pack id", () => {
    recordPackVisit("a", "2026-06-10")
    recordPackVisit("a", "2026-06-11")
    recordPackVisit("b", "2026-06-11")
    expect(getPackStreak("a").current).toBe(2)
    expect(getPackStreak("b").current).toBe(1)
  })

  it("dispatches corpan:streak-changed with the new counts", () => {
    const spy = vi.fn(() => true)
    ;(globalThis as { dispatchEvent?: unknown }).dispatchEvent = spy
    recordPackVisit("p1", "2026-06-10")
    expect(spy).toHaveBeenCalledTimes(1)
    const ev = spy.mock.calls[0][0] as CustomEvent
    expect(ev.type).toBe("corpan:streak-changed")
    expect(ev.detail).toMatchObject({ packId: "p1", current: 1, longest: 1 })
  })

  it("a same-day no-op does NOT re-dispatch", () => {
    recordPackVisit("p1", "2026-06-10")
    const spy = vi.fn(() => true)
    ;(globalThis as { dispatchEvent?: unknown }).dispatchEvent = spy
    recordPackVisit("p1", "2026-06-10")
    expect(spy).not.toHaveBeenCalled()
  })

  it("survives storage that throws on write (in-session, no crash)", () => {
    installStorage({ failWrites: true })
    expect(() => recordPackVisit("p1", "2026-06-10")).not.toThrow()
  })

  it("survives absent localStorage entirely", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage
    expect(() => recordPackVisit("p1", "2026-06-10")).not.toThrow()
    expect(getPackStreak("p1")).toEqual({ current: 0, longest: 0, lastDay: "" })
  })
})

describe("localDay", () => {
  it("formats a Date as local YYYY-MM-DD", () => {
    // Construct a local date explicitly (no UTC parsing).
    const d = new Date(2026, 5, 3) // 2026-06-03 local
    expect(localDay(d)).toBe("2026-06-03")
  })
})
