// journey/engine/clock.ts — the ONLY module allowed to touch the wall clock.
//
// engine.md §0 rule 2: `Date.now()` / `new Date()` are banned everywhere in
// the engine except here. All core logic takes time from an injected Clock.

export const DAY_MS = 86_400_000

/** Injected time source (engine.md §4.1). */
export interface Clock {
  nowMs(): number
  /** Local epoch day: floor((t − tzOffsetMs) / DAY_MS) — matches the app's
   *  localDay() convention (quotas/streaks reset at local midnight). */
  epochDay(): number
  /** Returns a cancel function. The manual clock never auto-fires. */
  setTimeout(fn: () => void, ms: number): () => void
}

/** Pure epoch-day math for a known timezone offset (ms EAST-negative,
 *  i.e. `getTimezoneOffset() * 60_000`). */
export function epochDayFromMs(ms: number, tzOffsetMs = 0): number {
  return Math.floor((ms - tzOffsetMs) / DAY_MS)
}

/** The ONE Date-constructor site (ts-fsrs needs Date objects; scheduler.ts
 *  calls this instead of `new Date(...)` so the §8.1 boundary scan stays
 *  clean and deterministic-time discipline is auditable in one place). */
export function msToDate(ms: number): Date {
  return new Date(ms)
}

/** Parse a localDay "YYYY-MM-DD" string (the local-analytics envelope `day`)
 *  into an epoch day. Pure arithmetic — no Date construction. */
export function epochDayFromLocalDay(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return Math.floor(Date.UTC(y, mo - 1, d) / DAY_MS)
}

/** Production clock. The only Date.now() in the engine. */
export const systemClock: Clock = {
  nowMs: () => Date.now(),
  epochDay: () => {
    const now = Date.now()
    const tzOffsetMs = new Date(now).getTimezoneOffset() * 60_000
    return epochDayFromMs(now, tzOffsetMs)
  },
  setTimeout: (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    return () => clearTimeout(id)
  },
}

export interface ManualClock extends Clock {
  /** Advance the clock by ms. Scheduled timeouts whose deadline passed fire. */
  advance(ms: number): void
  /** Jump to the start (plus `withinDayMs`) of an absolute epoch day. */
  setDay(day: number, withinDayMs?: number): void
  setNowMs(ms: number): void
}

/** Deterministic clock for tests and the simulation harness. Timeouts are
 *  manual: they fire only when `advance` crosses their deadline. */
export function createManualClock(opts?: { startMs?: number; tzOffsetMs?: number }): ManualClock {
  let now = opts?.startMs ?? 1_760_000_000_000 // fixed, arbitrary anchor
  const tz = opts?.tzOffsetMs ?? 0
  let timerSeq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()

  const fireDue = (): void => {
    for (const [id, t] of [...timers]) {
      if (t.at <= now) {
        timers.delete(id)
        t.fn()
      }
    }
  }

  return {
    nowMs: () => now,
    epochDay: () => epochDayFromMs(now, tz),
    setTimeout(fn: () => void, ms: number) {
      timerSeq += 1
      const id = timerSeq
      timers.set(id, { at: now + ms, fn })
      return () => {
        timers.delete(id)
      }
    },
    advance(ms: number) {
      now += ms
      fireDue()
    },
    setDay(day: number, withinDayMs = 12 * 3_600_000) {
      now = day * DAY_MS + tz + withinDayMs
      fireDue()
    },
    setNowMs(ms: number) {
      now = ms
      fireDue()
    },
  }
}
