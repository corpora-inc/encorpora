// Per-pack visit streaks — the shared retention primitive for every Corpán pack.
//
// A visit streak counts consecutive LOCAL days the user opened a pack. It is a
// quiet, dignified retention signal shown to ALL users (subscribed or not). It
// NEVER gates anything — there is no paywall path through this module.
//
// State is persisted per pack under `corpan.streak.v1.<packId>`, independent of
// the global reading-segment streak (progress.ts) and the monetization gate
// counters (corpan:gate:*). Every storage access is guarded so private/full
// storage degrades to an in-session no-op rather than throwing.

import type { StreakChangedDetail, StreakState } from "./types"

const KEY_PREFIX = "corpan.streak.v1."

const EMPTY: StreakState = { current: 0, longest: 0, lastDay: "" }

/** Local `YYYY-MM-DD` — the same notion the monetization gate's `localDay` uses. */
export function localDay(d: Date = new Date()): string {
  const yyyy = String(d.getFullYear())
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/** Local `YYYY-MM-DD` for the local day before `d` (used to detect consecutiveness). */
function localYesterday(d: Date = new Date()): string {
  const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
  return localDay(y)
}

function storageKey(packId: string): string {
  return `${KEY_PREFIX}${packId}`
}

/** localStorage, guarded — undefined in non-DOM / locked-down contexts. */
function getStorage(): Storage | undefined {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage
    return ls ?? undefined
  } catch {
    return undefined
  }
}

function readState(packId: string): StreakState {
  const ls = getStorage()
  if (!ls) return { ...EMPTY }
  try {
    const raw = ls.getItem(storageKey(packId))
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<StreakState>
    return {
      current: Math.max(0, Number(parsed.current) || 0),
      longest: Math.max(0, Number(parsed.longest) || 0),
      lastDay: typeof parsed.lastDay === "string" ? parsed.lastDay : "",
    }
  } catch {
    return { ...EMPTY }
  }
}

function writeState(packId: string, state: StreakState): void {
  const ls = getStorage()
  if (!ls) return
  try {
    ls.setItem(storageKey(packId), JSON.stringify(state))
  } catch {
    /* private mode / quota full — this session simply isn't persisted */
  }
}

/** Dispatch the `corpan:streak-changed` window event the host/badges listen for. */
function dispatchChanged(detail: StreakChangedDetail): void {
  try {
    const w = globalThis as { dispatchEvent?: (e: Event) => boolean }
    if (typeof w.dispatchEvent !== "function" || typeof CustomEvent === "undefined") return
    w.dispatchEvent(new CustomEvent("corpan:streak-changed", { detail }))
  } catch {
    /* host not present (SSR/standalone) — silently skip */
  }
}

/**
 * Read-only access to a pack's current visit streak. Defaults to an all-zero
 * state for a pack never visited. Never writes, never dispatches.
 */
export function getPackStreak(packId: string): StreakState {
  return readState(packId)
}

/**
 * Record that the user visited `packId` today. Idempotent within a local day.
 *
 * - same local day  → unchanged (a second open today doesn't inflate the count)
 * - the next day    → current + 1 (the streak continues)
 * - a gap of 2+ days (or first ever visit) → current resets to 1
 *
 * `longest` tracks the high-water mark. Persists the new state and dispatches
 * `corpan:streak-changed`. Returns the resulting state.
 */
export function recordPackVisit(packId: string, today: string = localDay()): StreakState {
  const prev = readState(packId)

  let current: number
  if (prev.lastDay === today) {
    // Already counted today — nothing changes.
    return prev
  } else if (prev.lastDay === localYesterday(new Date(`${today}T00:00:00`))) {
    current = prev.current + 1
  } else {
    current = 1
  }

  const next: StreakState = {
    current,
    longest: Math.max(prev.longest, current),
    lastDay: today,
  }
  writeState(packId, next)
  dispatchChanged({ packId, current: next.current, longest: next.longest })
  return next
}
