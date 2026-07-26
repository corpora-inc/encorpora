// Latency instrumentation for the loop.
//
// EXPERIENCE_DESIGN budgets the machine's contribution and never the child's:
// `commit → judgement` under 1 ms, the first feedback frame within 16 ms, and the
// next problem ready without the current one waiting. Those are numbers, so they
// are measured rather than asserted.
//
// Two spans, kept apart on purpose:
//
//   `commitToJudgement` the pure decision: judge, diagnose, plan the follow-up.
//                       Budgeted under 1 ms and synchronous. This is the number
//                       that is actually the app's work.
//   `commitToFeedback`  the child's key to the frame that paints the verdict.
//                       Probed with a double `requestAnimationFrame`, so its
//                       floor is one compositor frame (16.7 ms at 60 Hz) by
//                       construction: it answers "does the verdict land on the
//                       next frame", not "how many milliseconds of work".
//   `feedbackToReady`   the verdict painting to the next card being in hand.
//                       Concurrent with the reaction tail; if it is ever on the
//                       critical path, the deck was empty and that is a bug.
//
// A fixed-size ring, no allocation per sample beyond the number itself, and no
// consumer in the shipped bundle: `expose()` is called only under
// `import.meta.env.DEV`, so a production build tree-shakes the window handle
// away. Traces never ship (A-18).

export type Span = "commitToJudgement" | "commitToFeedback" | "feedbackToReady" | "generate"

const CAPACITY = 256

const rings: Record<Span, number[]> = {
  commitToJudgement: [],
  commitToFeedback: [],
  feedbackToReady: [],
  generate: [],
}

/** Monotonic milliseconds. `performance` is absent under `node --test`. */
export function now(): number {
  const perf = (globalThis as { performance?: { now: () => number } }).performance
  return typeof perf?.now === "function" ? perf.now() : Date.now()
}

export function record(span: Span, ms: number): void {
  const ring = rings[span]
  ring.push(ms)
  if (ring.length > CAPACITY) ring.shift()
}

/** Time `run` into `span` and return its value. */
export function measure<T>(span: Span, run: () => T): T {
  const started = now()
  const out = run()
  record(span, now() - started)
  return out
}

export function samples(span: Span): readonly number[] {
  return rings[span]
}

export function reset(): void {
  for (const span of Object.keys(rings) as Span[]) rings[span] = []
}

/** Nearest-rank percentile. `p` is 0..100. `null` on an empty ring. */
export function percentile(span: Span, p: number): number | null {
  const sorted = [...rings[span]].sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[rank] ?? null
}

export interface MetricsReport {
  readonly count: number
  readonly p50: number | null
  readonly p95: number | null
  readonly max: number | null
}

export function report(span: Span): MetricsReport {
  const ring = rings[span]
  return {
    count: ring.length,
    p50: percentile(span, 50),
    p95: percentile(span, 95),
    max: ring.length === 0 ? null : Math.max(...ring),
  }
}

/**
 * Hand the rings to whatever is driving the app in dev — a browser session, the
 * bench, a person with a console open. Guarded by the caller, never called in a
 * production bundle.
 */
export function expose(): void {
  ;(globalThis as { __dwMetrics?: unknown }).__dwMetrics = { report, samples, reset }
}
