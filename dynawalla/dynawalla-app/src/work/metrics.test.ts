import { test } from "node:test"
import assert from "node:assert/strict"

import { idleScheduler } from "./idle.ts"
import { measure, percentile, record, report, reset, samples } from "./metrics.ts"
import { generateProblem } from "./session.ts"
import { LADDER } from "./ladder.ts"
import { planAt } from "./plan-fixtures.ts"

test("percentiles are nearest-rank and empty rings report nothing rather than zero", () => {
  reset()
  assert.equal(percentile("generate", 95), null)
  assert.deepEqual(report("generate"), { count: 0, p50: null, p95: null, max: null })
  for (const ms of [5, 1, 4, 2, 3]) record("generate", ms)
  assert.equal(percentile("generate", 50), 3)
  assert.equal(percentile("generate", 100), 5)
  assert.equal(report("generate").max, 5)
})

test("the ring is bounded, so a long session does not grow without limit", () => {
  reset()
  for (let i = 0; i < 1000; i++) record("commitToFeedback", i)
  assert.equal(samples("commitToFeedback").length, 256)
})

test("generate() stays inside the per-item budget on every rung", () => {
  // EXPERIENCE_DESIGN: if a single `generate()` exceeds 4 ms measured, generation
  // moves to a Worker rather than being optimised in place. This is that
  // measurement, on the developer machine — the device number is `Q-01` and is a
  // device item. The bound here is deliberately generous relative to what the
  // family actually costs, so it catches a regression of an order of magnitude
  // and not CI jitter.
  reset()
  for (let rung = 0; rung < LADDER.length; rung++) {
    for (let seed = 0; seed < 200; seed++) {
      measure("generate", () => generateProblem(planAt(rung, seed)))
    }
  }
  const generated = report("generate")
  assert.equal(generated.count, 256, "the ring is bounded; the last 256 are what is reported")
  assert.ok(
    (generated.p95 ?? Infinity) < 4,
    `generate() p95 is ${String(generated.p95)} ms — over the 4 ms Worker threshold`,
  )
})

test("the idle scheduler falls back where requestIdleCallback does not exist", () => {
  // Safari shipped `requestIdleCallback` in 16.4 and this app promises iOS 16.0.
  // A missing scheduler must degrade to a worse one, never to no generation.
  const host = globalThis as { requestIdleCallback?: unknown }
  const original = host.requestIdleCallback
  try {
    delete host.requestIdleCallback
    const schedule = idleScheduler()
    let ran = false
    const cancel = schedule(() => {
      ran = true
    })
    assert.equal(typeof cancel, "function")
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        assert.equal(ran, true, "the fallback never ran the callback")
        resolve()
      }, 5)
    })
  } finally {
    if (original !== undefined) host.requestIdleCallback = original
  }
})

test("an idle callback is given a timeout so a busy WebView cannot starve the deck", () => {
  const host = globalThis as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }
  const original = host.requestIdleCallback
  let sawTimeout: number | undefined
  try {
    host.requestIdleCallback = (_cb, opts) => {
      sawTimeout = opts?.timeout
      return 1
    }
    idleScheduler()(() => undefined)
    assert.equal(typeof sawTimeout, "number")
    assert.ok((sawTimeout ?? 0) > 0)
  } finally {
    if (original === undefined) delete host.requestIdleCallback
    else host.requestIdleCallback = original
  }
})
