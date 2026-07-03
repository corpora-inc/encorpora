// Result plumbing shared by every capability module (capability-modules.md
// §2.3): the settle-once guard (result settles EXACTLY once, never rejects),
// the abandoned-result synthesizer, and the paused-time-excluding clock
// (`durationMs` excludes paused time — modules keep an active-time
// accumulator, never `Date.now() - mountTime`; clock is injected, no
// Date.now() in engine-facing logic).
import type { ActivityDetail, ActivityResult, ActivitySpec } from "./activity"

export const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0

/** Synthesize the abandoned result a module settles with on
 *  dispose-before-settle / internal error / zero-interaction timebox. */
export const makeAbandonedResult = (
  spec: ActivitySpec,
  durationMs: number,
  detail?: ActivityDetail,
): ActivityResult => ({
  specId: spec.specId,
  score: 0,
  perItem: [],
  durationMs: Math.max(0, Math.round(durationMs)),
  abandoned: true,
  ...(detail ? { detail } : {}),
})

export interface SettleOnce {
  /** The promise handed out on the CapabilityHandle. Never rejects. */
  promise: Promise<ActivityResult>
  /** True once a terminal result has been accepted. */
  settled(): boolean
  /** First call wins; later calls are ignored (runChallenge precedent). */
  settle(result: ActivityResult): void
}

export const createSettleOnce = (): SettleOnce => {
  let resolve!: (r: ActivityResult) => void
  let settled = false
  const promise = new Promise<ActivityResult>((res) => {
    resolve = res
  })
  return {
    promise,
    settled: () => settled,
    settle: (result) => {
      if (settled) return
      settled = true
      resolve(result)
    },
  }
}

export interface ActiveClock {
  /** Active (unpaused) milliseconds accumulated so far. */
  activeMs(): number
  pause(): void
  resume(): void
  paused(): boolean
}

/**
 * Active-time accumulator. `now` is injected (defaults to performance.now)
 * so tests drive it deterministically. Starts RUNNING unless `startPaused`.
 */
export const createActiveClock = (
  now: () => number = () => performance.now(),
  startPaused = false,
): ActiveClock => {
  let accumulated = 0
  let runningSince: number | null = startPaused ? null : now()
  return {
    activeMs: () =>
      accumulated + (runningSince !== null ? now() - runningSince : 0),
    pause: () => {
      if (runningSince !== null) {
        accumulated += now() - runningSince
        runningSince = null
      }
    },
    resume: () => {
      if (runningSince === null) runningSince = now()
    },
    paused: () => runningSince === null,
  }
}
