// The measurement harness. Shared by the Node runner and the browser runner so
// that both report the same numbers computed the same way.
//
// What it measures and why:
//
// - We report p50/p95/p99/max of the PER-STEP cost, never the mean alone. A
//   60 fps budget is not an average, it is a promise about the worst frame a
//   child sees. The dominoes scene proves the point: an engine with sleeping
//   does nothing at all for 200 steps and then does everything at once, and its
//   mean is a lie.
// - We time `step()` and `snapshot()` separately. Reading transforms out for
//   the renderer is real per-frame cost that a "physics benchmark" usually
//   hides, and for a WASM engine with a handle-based binding it can rival the
//   solve.
// - We hash the final state so the same scene can be compared across engines,
//   across runs, and across JS engines. See determinism.mjs.

/** FNV-1a over the raw bytes of a Float64Array. Order-sensitive, which is what we want. */
export function hashState(f64) {
  const bytes = new Uint8Array(f64.buffer, f64.byteOffset, f64.byteLength)
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

/** Quantised hash: tolerant to sub-millimetre drift, still catches divergence. */
export function hashQuantised(f64, places = 4) {
  const m = 10 ** places
  let h = 0x811c9dc5
  for (let i = 0; i < f64.length; i++) {
    // `| 0` after rounding keeps this integer-exact for our world scale.
    const q = Math.round(f64[i] * m) | 0
    h ^= q & 0xff
    h = Math.imul(h, 0x01000193) >>> 0
    h ^= (q >>> 8) & 0xff
    h = Math.imul(h, 0x01000193) >>> 0
    h ^= (q >>> 16) & 0xff
    h = Math.imul(h, 0x01000193) >>> 0
    h ^= (q >>> 24) & 0xff
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[i]
}

const now =
  typeof performance !== "undefined" && performance.now
    ? () => performance.now()
    : () => Number(process.hrtime.bigint()) / 1e6

/**
 * @param {object} sim   built by an adapter
 * @param {number} steps
 * @param {object} opts  { warmup, snapshotEvery }
 */
export function measure(sim, steps, opts = {}) {
  const warmup = opts.warmup ?? 30
  // Snapshot every frame by default: that is what a renderer does.
  const snapshotEvery = opts.snapshotEvery ?? 1

  for (let i = 0; i < warmup; i++) sim.step()

  const stepTimes = new Float64Array(steps)
  const snapTimes = []
  let awakeMax = 0
  let awakeSum = 0

  for (let i = 0; i < steps; i++) {
    const t0 = now()
    sim.step()
    const t1 = now()
    stepTimes[i] = t1 - t0
    if (i % snapshotEvery === 0) {
      const s0 = now()
      sim.snapshot()
      snapTimes.push(now() - s0)
    }
    if (i % 30 === 0) {
      const a = sim.awake()
      awakeSum += a
      if (a > awakeMax) awakeMax = a
    }
  }

  const finalState = Float64Array.from(sim.snapshot())
  const sorted = Float64Array.from(stepTimes).sort()
  const snapSorted = Float64Array.from(snapTimes).sort()
  const total = stepTimes.reduce((a, b) => a + b, 0)

  return {
    steps,
    mean: total / steps,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
    snapMean: snapTimes.reduce((a, b) => a + b, 0) / Math.max(1, snapTimes.length),
    snapP99: percentile(snapSorted, 99),
    awakeMax,
    awakeMean: awakeSum / Math.ceil(steps / 30),
    hash: hashState(finalState),
    hashQ: hashQuantised(finalState),
    state: finalState,
  }
}

/**
 * Scene-specific quality probes. Speed is necessary but not sufficient: a fast
 * engine that lets the pyramid sink into the floor or the rope stretch to twice
 * its length is not usable for a product where the physics IS the explanation.
 */
export function quality(sceneName, scene, state, ropeRest = 12.25) {
  const dyn = scene.bodies.map((b, i) => [b, i]).filter(([b]) => b.kind !== "static")
  const at = (k) => ({ x: state[k * 3], y: state[k * 3 + 1], a: state[k * 3 + 2] })

  if (sceneName === "rope-60") {
    // Measured chain span vs rest length. A sequential-impulse solver with too
    // few iterations shows up here as a rope that visibly stretches under the
    // bob. The floor is dynamic-body index -1 in this scene (it is static), so
    // the chain starts at dynamic 0.
    const n = dyn.length
    let span = 0
    for (let k = 1; k < n; k++) {
      const p = at(k - 1)
      const q = at(k)
      span += Math.hypot(q.x - p.x, q.y - p.y)
    }
    return { stretchPct: ((span - ropeRest) / ropeRest) * 100 }
  }

  if (sceneName === "balance-scale") {
    // The beam is body index 2 (dynamic #0). Equal mass in both pans must read
    // as level. Anything over ~1 degree is visible and reads as a broken
    // equals sign.
    const beam = at(0)
    return { beamTiltDeg: (beam.a * 180) / Math.PI }
  }

  if (sceneName === "pyramid-topple" || sceneName === "debris-500") {
    // Deepest penetration below the floor surface (floor top is y = 0).
    // Bodies that rolled off the end of the floor are excluded — they are
    // falling, not sinking, and would swamp the metric.
    //
    // A settled box can legitimately have its centre as low as its SMALLEST
    // half-extent (resting on its long face), so that is the floor we measure
    // against. Anything below it is penetration the engine failed to push out.
    const edge = sceneName === "pyramid-topple" ? 13.5 : 9.5
    let worst = 0
    for (let k = 0; k < dyn.length; k++) {
      const [b] = dyn[k]
      const p = at(k)
      if (Math.abs(p.x) > edge) continue
      const lowest = b.shape.box ? Math.min(b.shape.box[0], b.shape.box[1]) : b.shape.circle
      const bottom = p.y - lowest
      if (bottom < worst) worst = bottom
    }
    return { sinkMm: Math.round(-worst * 1000) }
  }

  if (sceneName === "dominoes-300") {
    // How far the chain reaction actually travelled: count fallen dominoes.
    let fallen = 0
    for (let k = 0; k < dyn.length; k++) {
      if (Math.abs(at(k).a) > 0.7) fallen++
    }
    return { fallen, ofTotal: dyn.length }
  }
  return {}
}
