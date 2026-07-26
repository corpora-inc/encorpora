/**
 * The measurement harness. Everything the kit claims is produced here.
 *
 * Runs in a real browser (and therefore in a real WebView) because there is no
 * meaningful way to measure Web Audio anywhere else. Offline renders give exact,
 * reproducible signal measurements; the live context gives the latency,
 * scheduling and main-thread numbers that only exist in real time.
 *
 * Exposed on `window.DW` so a driver can call each measurement and read JSON.
 */

import { createModalBank, createStringBank, loadWorklets, strikeNative } from "../src/dsp/banks.ts"
import { MATERIALS } from "../src/dsp/materials.ts"
import { tablesFor } from "../src/dsp/tables.ts"
import { AudioKit } from "../src/index.ts"
import { ALL_PRESETS } from "../src/presets/library.ts"
import { grainCloud } from "../src/presets/voices.ts"
import { mulberry32 } from "../src/rng.ts"
import type { Preset, RenderCtx, Tier } from "../src/types.ts"
import { analyse, centsBetween, estimatePitch, measureT60, toMono, type Metrics } from "./analysis.ts"

const SR = 48000

/**
 * TRAP, HIT AND MEASURED: a message posted to an AudioWorkletNode is NOT
 * delivered before `startRendering()` resolves if you call them in the same
 * task. The render completes with total silence — no error, no warning, just a
 * zero buffer, which reads exactly like "your synth is broken".
 *
 * Measured on Chrome 149: same pluck, `startRendering()` immediately -> peak
 * 0.00000; one macrotask yield first -> peak 0.61880. Any offline bounce of
 * worklet-driven audio must yield. (Real-time contexts are unaffected: there
 * the control message queue is drained between render quanta.)
 */
const yieldToWorklet = (): Promise<void> => new Promise((r) => setTimeout(r, 30))

const channels = (buf: AudioBuffer): Float32Array[] => {
  const out: Float32Array[] = []
  for (let c = 0; c < buf.numberOfChannels; c++) out.push(buf.getChannelData(c))
  return out
}

/** Build an offline context with the worklets loaded and a master-free bus. */
const offline = async (
  seconds: number,
): Promise<{
  oc: OfflineAudioContext
  bus: GainNode
  send: GainNode | null
  strings: ReturnType<typeof createStringBank>
  modal: ReturnType<typeof createModalBank>
}> => {
  const oc = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR)
  await loadWorklets(oc)
  const bus = oc.createGain()
  bus.gain.value = 1
  bus.connect(oc.destination)
  const conv = oc.createConvolver()
  conv.buffer = tablesFor(oc).impulse("tile", 1.4)
  conv.connect(oc.destination)
  const send = oc.createGain()
  send.gain.value = 0.16
  send.connect(conv)
  const strings = createStringBank(oc)
  const modal = createModalBank(oc)
  strings?.node.connect(bus)
  modal?.node.connect(bus)
  return { oc, bus, send, strings, modal }
}

/** Render one preset in isolation and measure it. */
export const renderPreset = async (
  preset: Preset,
  opts: { seconds?: number; intensity?: number; semitones?: number; seed?: number; tier?: Tier } = {},
): Promise<{ metrics: Metrics; buffer: AudioBuffer }> => {
  const seconds = opts.seconds ?? 4
  const { oc, bus, send, strings, modal } = await offline(seconds)
  const rand = mulberry32(opts.seed ?? 12345)
  // Mirror the live path: one gain node per voice carrying the preset's level.
  const voice = oc.createGain()
  voice.gain.value = preset.gain
  voice.connect(bus)
  const rc: RenderCtx = {
    ctx: oc,
    out: voice,
    send,
    when: 0.05,
    level: preset.gain,
    intensity: opts.intensity ?? 0.8,
    semitones: opts.semitones ?? 0,
    tier: opts.tier ?? "ultra",
    rand,
    range: (lo, hi) => lo + rand() * (hi - lo),
    tables: tablesFor(oc),
    strings,
    modal,
  }
  preset.render(rc)
  await yieldToWorklet()
  const buf = await oc.startRendering()
  return { metrics: analyse(channels(buf), SR), buffer: buf }
}

/** Every preset, measured. This is the loudness-matching evidence. */
export const measureLibrary = async (): Promise<Record<string, Metrics>> => {
  const out: Record<string, Metrics> = {}
  for (const p of ALL_PRESETS) {
    const { metrics } = await renderPreset(p, { seconds: 4, intensity: 0.85, seed: 7 })
    out[p.id] = metrics
  }
  return out
}

/**
 * Does the modal bank actually deliver the T60 it is asked for?
 * Renders a single mode of a material at a known frequency and fits the decay.
 */
export const measureModalT60 = async (): Promise<
  { material: string; freq: number; askedT60: number; measuredT60: number; errorPct: number }[]
> => {
  const rows = []
  for (const key of ["brass", "tile", "glass", "wood", "skin", "stone"] as const) {
    const m = MATERIALS[key]
    const freq = 220
    const { oc, bus, modal } = await offline(Math.max(1, m.t60 * 2))
    if (!modal) continue
    // Single mode, no detune, so the fit is unambiguous.
    modal.strike({
      when: 0.02,
      material: { ...m, ratios: [1], amps: [1], detuneCents: 0, beat: 0 },
      freq,
      velocity: 0.9,
      modes: 1,
      gain: 1,
      rand: mulberry32(1),
    })
    bus.gain.value = 1
    await yieldToWorklet()
    const buf = await oc.startRendering()
    const measured = measureT60(toMono(channels(buf)), SR)
    rows.push({
      material: key,
      freq,
      askedT60: m.t60,
      measuredT60: measured,
      errorPct: ((measured - m.t60) / m.t60) * 100,
    })
  }
  return rows
}

/** Is the string bank in tune? */
export const measureStringTuning = async (): Promise<
  { asked: number; measured: number; cents: number }[]
> => {
  const rows = []
  for (const f of [82.41, 146.83, 220, 293.66, 440, 587.33, 880, 1174.66, 1760]) {
    const { oc, strings } = await offline(1.2)
    if (!strings) break
    strings.pluck({ when: 0.02, freq: f, velocity: 0.9, decay: 1.5, damping: 0.15, position: 0.2, gain: 1 })
    await yieldToWorklet()
  const buf = await oc.startRendering()
    const x = toMono(channels(buf))
    // Analyse the sustain, not the attack: the pick transient is broadband.
    // Window must hold several periods of the LOWEST pitch under test and the
    // search range must bracket the answer generously — a narrow range around
    // the expected value is how you accidentally measure your own assumption.
    const seg = x.subarray(Math.floor(SR * 0.25), Math.floor(SR * 0.25) + 16384)
    const measured = estimatePitch(seg, SR, Math.max(40, f * 0.35), Math.min(SR * 0.4, f * 3))
    rows.push({ asked: f, measured, cents: centsBetween(measured, f) })
  }
  return rows
}

/**
 * THE NATIVE KARPLUS-STRONG TRAP, measured three ways.
 *
 * Builds the textbook feedback loop from native nodes — BufferSource ->
 * DelayNode -> loop filter -> gain -> back into the delay — and asks it for a
 * range of pitches, with and without compensating for the render quantum.
 *
 * What this actually proves (Chrome 149, 48 kHz):
 *   1. A DelayNode inside a CYCLE has exactly one render quantum (128 frames)
 *      ADDED to its delay. Not clamped — added. So the naive loop is flat at
 *      EVERY pitch: -336 cents at 80 Hz, -2096 cents at 880 Hz.
 *   2. Subtracting 128/sampleRate fixes tuning below the ceiling (within 7
 *      cents) and then hard-pins at 373.5 Hz for every request above it,
 *      because delayTime cannot go negative.
 *   3. The loop filter must have magnitude <= 1 at ALL frequencies. A default
 *      BiquadFilter lowpass (Q = 1) has a +1.2 dB resonant peak, so a 0.99
 *      feedback gain still gives loop gain > 1 and the "string" becomes a
 *      self-oscillator — measured peak 8.6e17 before we swapped it for the
 *      classic (x[n]+x[n-1])/2 averaging filter.
 */
export const measureNativeKarplusCeiling = async (): Promise<{
  uncompensated: { asked: number; measured: number; cents: number }[]
  compensated: { asked: number; measured: number; cents: number }[]
  resonantLoopPeak: number
}> => {
  const probe = async (f: number, compensate: boolean, resonantFilter = false): Promise<{ pitch: number; peak: number }> => {
    const oc = new OfflineAudioContext(1, SR, SR)
    const exc = oc.createBuffer(1, Math.ceil(SR / f), SR)
    const d = exc.getChannelData(0)
    const rnd = mulberry32(4242)
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1
    const src = oc.createBufferSource()
    src.buffer = exc
    const delay = oc.createDelay(1)
    delay.delayTime.value = compensate ? Math.max(0, 1 / f - 128 / SR) : 1 / f
    let loop: AudioNode
    if (resonantFilter) {
      const bq = oc.createBiquadFilter()
      bq.type = "lowpass"
      bq.frequency.value = 6000
      loop = bq
    } else {
      loop = oc.createIIRFilter([0.5, 0.5], [1])
    }
    const fb = oc.createGain()
    fb.gain.value = resonantFilter ? 0.99 : 0.995
    src.connect(delay)
    delay.connect(loop)
    loop.connect(fb)
    fb.connect(delay) // <-- the cycle
    delay.connect(oc.destination)
    src.start(0)
    const buf = await oc.startRendering()
    const x = buf.getChannelData(0)
    let peak = 0
    for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]))
    const seg = x.subarray(Math.floor(SR * 0.15), Math.floor(SR * 0.15) + 16384)
    return { pitch: estimatePitch(seg, SR, 40, 8000), peak }
  }
  const freqs = [80, 110, 220, 300, 370, 375, 400, 440, 660, 880]
  const uncompensated = []
  const compensated = []
  for (const f of freqs) {
    const a = await probe(f, false)
    uncompensated.push({ asked: f, measured: a.pitch, cents: centsBetween(a.pitch, f) })
    const b = await probe(f, true)
    compensated.push({ asked: f, measured: b.pitch, cents: centsBetween(b.pitch, f) })
  }
  const res = await probe(440, false, true)
  return { uncompensated, compensated, resonantLoopPeak: res.peak }
}

/**
 * Offline DSP cost of a whole scene, rendered through the REAL master chain
 * and (optionally) the REAL voice budget.
 *
 * `realtimeFactor` is rendered-seconds / wall-seconds. The audio thread has to
 * finish one 128-frame quantum every 2.67 ms at 48 kHz, so 1/realtimeFactor is
 * the fraction of one core the audio thread needs. Anything approaching 1.0 is
 * a dropout on the target device even though it "works" on a laptop.
 *
 * Running with `budget:false` is not a fair test of the kit — it is the
 * measurement that shows WHY the budget exists.
 */
export const measureLoad = async (
  scene: "idle" | "ui" | "busy" | "chaos",
  seconds = 4,
  opts: { budget?: boolean; maxVoices?: number; masterChain?: boolean } = {},
): Promise<{
  scene: string
  budget: boolean
  requested: number
  admitted: number
  peakConcurrent: number
  wallMs: number
  realtimeFactor: number
  audioThreadPct: number
  metrics: Metrics
}> => {
  const useBudget = opts.budget !== false
  const useChain = opts.masterChain !== false
  const maxVoices = opts.maxVoices ?? 20 // the `medium` tier: our mid-tablet floor
  const oc = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR)
  await loadWorklets(oc)
  const t = tablesFor(oc)

  let head: AudioNode = oc.destination
  if (useChain) {
    const ws = oc.createWaveShaper()
    ws.curve = t.safetyClip()
    ws.oversample = "2x"
    ws.connect(oc.destination)
    const comp = oc.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 6
    comp.ratio.value = 6
    comp.attack.value = 0.004
    comp.release.value = 0.16
    comp.connect(ws)
    head = comp
  }
  const master = oc.createGain()
  master.gain.value = 0.9
  master.connect(head)
  const bus = oc.createGain()
  bus.gain.value = 1
  bus.connect(master)
  const conv = oc.createConvolver()
  conv.buffer = t.impulse("tile", 1.1)
  conv.connect(master)
  const send = oc.createGain()
  send.gain.value = 0.16
  send.connect(conv)
  const strings = createStringBank(oc)
  const modal = createModalBank(oc)
  strings?.node.connect(bus)
  modal?.node.connect(bus)

  const rand = mulberry32(99)
  const byId = new Map(ALL_PRESETS.map((p) => [p.id, p]))
  const rates: Record<string, [string, number][]> = {
    idle: [],
    ui: [
      ["ui.tap", 4],
      ["ui.chunk", 1],
    ],
    busy: [
      ["ui.tap", 6],
      ["ui.chunk", 2],
      ["impact.tile", 4],
      ["reward.bead", 5],
      ["pluck.string", 4],
      ["combo", 3],
    ],
    chaos: [
      ["ui.tap", 12],
      ["impact.brass", 4],
      ["impact.tile", 8],
      ["impact.stone", 4],
      ["reward.bead", 10],
      ["pluck.string", 8],
      ["combo", 6],
      ["motion.whoosh", 3],
      ["reward.big", 1],
    ],
  }
  // Build the full request list, sorted by time, then admit it through the same
  // policy the live engine uses (minGap, per-group polyphony, global cap,
  // lowest-weight steal).
  const requests: { id: string; when: number; intensity: number }[] = []
  for (const [id, perSec] of rates[scene]) {
    const n = Math.floor(perSec * seconds)
    for (let i = 0; i < n; i++) {
      const when = 0.05 + (i / perSec) * (1 + rand() * 0.1)
      if (when < seconds - 0.1) requests.push({ id, when, intensity: 0.6 + rand() * 0.4 })
    }
  }
  requests.sort((a, b) => a.when - b.when)

  const live: { group: string; endsAt: number; startedAt: number; weight: number }[] = []
  const lastFired = new Map<string, number>()
  let admitted = 0
  let peakConcurrent = 0
  for (const r of requests) {
    const p = byId.get(r.id)
    if (!p) continue
    if (useBudget) {
      for (let i = live.length - 1; i >= 0; i--) if (live[i].endsAt <= r.when) live.splice(i, 1)
      const gap = p.minGap ?? 0.012
      const last = lastFired.get(p.id) ?? -1
      if (r.when - last < gap) continue
      const group = p.group ?? p.id
      const poly = p.poly ?? 6
      const same = live.filter((v) => v.group === group)
      const weight = (p.weight ?? 0.4) * (0.5 + r.intensity * 0.5)
      if (same.length >= poly) {
        let oldest = same[0]
        for (const v of same) if (v.startedAt < oldest.startedAt) oldest = v
        live.splice(live.indexOf(oldest), 1)
      }
      if (live.length >= maxVoices) {
        let victim: (typeof live)[0] | null = null
        for (const v of live) {
          if (r.when - v.startedAt < 0.05) continue
          if (!victim || v.weight < victim.weight) victim = v
        }
        if (!victim || victim.weight > weight) continue
        live.splice(live.indexOf(victim), 1)
      }
      lastFired.set(p.id, r.when)
      const voice = oc.createGain()
      voice.gain.value = p.gain
      voice.connect(bus)
      const res = p.render({
        ctx: oc,
        out: voice,
        send,
        when: r.when,
        level: p.gain,
        intensity: r.intensity,
        semitones: 0,
        tier: "medium",
        rand,
        range: (lo, hi) => lo + rand() * (hi - lo),
        tables: t,
        strings,
        modal,
      })
      live.push({ group, endsAt: res.endsAt, startedAt: r.when, weight })
      peakConcurrent = Math.max(peakConcurrent, live.length)
      admitted++
    } else {
      const voice2 = oc.createGain()
      voice2.gain.value = p.gain
      voice2.connect(bus)
      p.render({
        ctx: oc,
        out: voice2,
        send,
        when: r.when,
        level: p.gain,
        intensity: r.intensity,
        semitones: 0,
        tier: "ultra",
        rand,
        range: (lo, hi) => lo + rand() * (hi - lo),
        tables: t,
        strings,
        modal,
      })
      admitted++
    }
  }

  await yieldToWorklet()
  const t0 = performance.now()
  const buf = await oc.startRendering()
  const wallMs = performance.now() - t0
  const realtimeFactor = (seconds * 1000) / wallMs
  return {
    scene,
    budget: useBudget,
    requested: requests.length,
    admitted,
    peakConcurrent,
    wallMs,
    realtimeFactor,
    audioThreadPct: 100 / realtimeFactor,
    metrics: analyse(channels(buf), SR),
  }
}

/** Does the master chain hold the ceiling when everything fires at once? */
export const measureLimiter = async (): Promise<{
  withoutChain: Metrics
  withChain: Metrics
  compressorOnlyPeakDb: number
}> => {
  // 12 loud impacts at the same instant is far beyond anything the game will
  // do; if the chain holds here it holds everywhere.
  const build = async (useChain: boolean, useCompOnly = false) => {
    const { oc, send, strings, modal } = await offline(3)
    const t = tablesFor(oc)
    let head: AudioNode = oc.destination
    if (useChain || useCompOnly) {
      const comp = oc.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.knee.value = 6
      comp.ratio.value = 6
      comp.attack.value = 0.004
      comp.release.value = 0.16
      if (useChain) {
        const ws = oc.createWaveShaper()
        ws.curve = t.safetyClip()
        ws.oversample = "2x"
        comp.connect(ws)
        ws.connect(oc.destination)
      } else {
        comp.connect(oc.destination)
      }
      head = comp
    }
    const bus = oc.createGain()
    bus.gain.value = 1
    bus.connect(head)
    strings?.node.disconnect()
    modal?.node.disconnect()
    strings?.node.connect(bus)
    modal?.node.connect(bus)
    const rand = mulberry32(5)
    const byId = new Map(ALL_PRESETS.map((p) => [p.id, p]))
    for (const id of [
      "impact.brass",
      "impact.stone",
      "impact.drum",
      "reward.big",
      "impact.tile",
      "ui.chunk",
      "impact.brass",
      "impact.stone",
      "reward.chime",
      "impact.glass",
      "impact.pot",
      "ui.chunk",
    ]) {
      const p = byId.get(id)
      const vg = oc.createGain()
      vg.gain.value = p?.gain ?? 1
      vg.connect(bus)
      p?.render({
        ctx: oc,
        out: vg,
        send,
        when: 0.05,
        level: p?.gain ?? 1,
        intensity: 1,
        semitones: 0,
        tier: "ultra",
        rand,
        range: (lo, hi) => lo + rand() * (hi - lo),
        tables: t,
        strings,
        modal,
      })
    }
    await yieldToWorklet()
  const buf = await oc.startRendering()
    return analyse(channels(buf), SR)
  }
  const withoutChain = await build(false)
  const withChain = await build(true)
  const compOnly = await build(false, true)
  return { withoutChain, withChain, compressorOnlyPeakDb: compOnly.peakDb }
}

/**
 * Anti-fatigue evidence: render the same preset 60 times and report the spread
 * of pitch, centroid and level. A preset with near-zero spread is the one that
 * will drive a parent mad by lunchtime.
 */
export const measureVariation = async (
  presetId: string,
  n = 40,
): Promise<{ id: string; centroidStdPct: number; peakStdDb: number; centroidHz: number }> => {
  const p = ALL_PRESETS.find((x) => x.id === presetId)
  if (!p) throw new Error(`no preset ${presetId}`)
  const cents: number[] = []
  const peaks: number[] = []
  for (let i = 0; i < n; i++) {
    const { metrics } = await renderPreset(p, { seconds: 1.2, intensity: 0.8, seed: 1000 + i })
    cents.push(metrics.centroidHz)
    peaks.push(metrics.peakDb)
  }
  const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length
  const std = (a: number[]): number => {
    const m = mean(a)
    return Math.sqrt(mean(a.map((v) => (v - m) ** 2)))
  }
  return {
    id: presetId,
    centroidHz: mean(cents),
    centroidStdPct: (std(cents) / mean(cents)) * 100,
    peakStdDb: std(peaks),
  }
}

// ---------------------------------------------------------------------------
// LIVE measurements — need a real AudioContext.
// ---------------------------------------------------------------------------

export const measureLiveLatency = async (kit: AudioKit): Promise<Record<string, number | string>> => {
  const ctx = kit.ctx
  return {
    state: ctx.state,
    sampleRate: ctx.sampleRate,
    baseLatencyMs: (ctx.baseLatency ?? 0) * 1000,
    outputLatencyMs: (ctx.outputLatency ?? 0) * 1000,
    /** What the kit's own +4ms scheduling offset adds. */
    kitScheduleOffsetMs: 4,
    totalEstimatedMs: ((ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0)) * 1000 + 4,
  }
}

/**
 * Main-thread cost of `play()`.
 *
 * MEASUREMENT TRAP: `performance.now()` is coarsened (Chrome clamps it to ~5 us
 * in a non-cross-origin-isolated page), so timing ONE `play()` returns 0 for
 * the median and garbage for the tail. Time a BATCH and divide. The batch also
 * has to be spread across scheduled times, or the engine's own `minGap` drops
 * most of the calls and you measure the reject path.
 */
export const measureTriggerCost = (
  kit: AudioKit,
  id: string,
  batches = 24,
  perBatch = 25,
): { id: string; perCallUs: number; p95BatchUs: number; worstBatchUs: number } => {
  const times: number[] = []
  for (let b = 0; b < batches; b++) {
    const t0 = performance.now()
    for (let i = 0; i < perBatch; i++) {
      kit.play(id, { intensity: 0.7, delay: 0.05 + i * 0.05 })
    }
    times.push(((performance.now() - t0) * 1000) / perBatch)
  }
  times.sort((a, b) => a - b)
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  return {
    id,
    perCallUs: mean,
    p95BatchUs: times[Math.floor(times.length * 0.95)],
    worstBatchUs: times[times.length - 1],
  }
}

/**
 * THE NUMBER THAT MATTERS: does the audio kit cost frames?
 *
 * Drives a synthetic 60 Hz game loop, each tick burning a fixed slice of
 * main-thread work, and records the tick durations with and without the kit
 * firing sounds at `rate` per second. The 60 fps budget is 16.67 ms; the kit's
 * share of it has to be invisible.
 *
 * TRAP: `requestAnimationFrame` NEVER FIRES in a background tab, so an
 * rAF-based version of this test simply hangs forever when the harness is not
 * the foreground tab — which is exactly how an automated run works. The loop
 * below uses a `MessageChannel` ping-pong, which Chrome does not throttle, so
 * the measurement is valid whether or not anyone is looking at it. (The same
 * trap is why the kit's music scheduler must guard against waking up seconds
 * behind — see `music.ts`.)
 */
export const measureFrameImpact = async (
  kit: AudioKit,
  opts: { rate?: number; seconds?: number; ids?: string[]; workMs?: number } = {},
): Promise<{
  control: { meanMs: number; p95Ms: number; worstMs: number; ticks: number; over16_7: number }
  withAudio: { meanMs: number; p95Ms: number; worstMs: number; ticks: number; over16_7: number }
  audioCostPerTickMs: number
  triggersFired: number
  peakVoices: number
}> => {
  const rate = opts.rate ?? 30
  const seconds = opts.seconds ?? 3
  const workMs = opts.workMs ?? 6
  const ids = opts.ids ?? ["ui.tap", "impact.tile", "reward.bead", "pluck.string", "combo", "ui.chunk"]

  const burn = (ms: number): number => {
    const end = performance.now() + ms
    let acc = 0
    while (performance.now() < end) for (let i = 0; i < 2000; i++) acc += Math.sqrt(i + acc % 7)
    return acc
  }

  const sample = async (fire: boolean): Promise<{
    stats: { meanMs: number; p95Ms: number; worstMs: number; ticks: number; over16_7: number }
    fired: number
    peak: number
  }> => {
    const durations: number[] = []
    let fired = 0
    let peak = 0
    const start = performance.now()
    const end = start + seconds * 1000
    let nextFire = start
    const mc = new MessageChannel()
    await new Promise<void>((resolve) => {
      mc.port1.onmessage = () => {
        const t0 = performance.now()
        burn(workMs)
        if (fire) {
          while (nextFire <= t0) {
            kit.play(ids[fired % ids.length], { intensity: 0.5 + (fired % 5) * 0.1 })
            fired++
            nextFire += 1000 / rate
          }
          peak = Math.max(peak, kit.stats.activeVoices)
        }
        durations.push(performance.now() - t0)
        if (performance.now() < end) mc.port2.postMessage(0)
        else resolve()
      }
      mc.port2.postMessage(0)
    })
    durations.shift()
    const sorted = [...durations].sort((a, b) => a - b)
    return {
      stats: {
        meanMs: durations.reduce((a, b) => a + b, 0) / durations.length,
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
        worstMs: sorted[sorted.length - 1],
        ticks: durations.length,
        over16_7: durations.filter((d) => d > 16.7).length,
      },
      fired,
      peak,
    }
  }
  const control = await sample(false)
  const withAudio = await sample(true)
  return {
    control: control.stats,
    withAudio: withAudio.stats,
    audioCostPerTickMs: withAudio.stats.meanMs - control.stats.meanMs,
    triggersFired: withAudio.fired,
    peakVoices: withAudio.peak,
  }
}

/** Render-quantum health under load, if the browser exposes it. */
export const measureRenderCapacity = async (
  kit: AudioKit,
  seconds = 3,
): Promise<Record<string, number> | { unsupported: true }> => {
  const rc = (kit.ctx as AudioContext & { renderCapacity?: { start(o: object): void; stop(): void; onupdate: ((e: object) => void) | null } })
    .renderCapacity
  if (!rc) return { unsupported: true }
  const peaks: number[] = []
  const avgs: number[] = []
  let underruns = 0
  rc.onupdate = (e: object) => {
    const ev = e as { averageLoad: number; peakLoad: number; underrunRatio: number }
    avgs.push(ev.averageLoad)
    peaks.push(ev.peakLoad)
    if (ev.underrunRatio > 0) underruns++
  }
  rc.start({ updateInterval: 0.2 })
  await new Promise((r) => setTimeout(r, seconds * 1000))
  rc.stop()
  return {
    samples: avgs.length,
    avgLoad: avgs.reduce((a, b) => a + b, 0) / Math.max(1, avgs.length),
    peakLoad: Math.max(0, ...peaks),
    underrunIntervals: underruns,
  }
}

/**
 * Component cost breakdown — where the audio thread's money actually goes.
 * Each row renders 4 s of ONE thing and reports the fraction of a core it
 * needs. This is what the tier profiles are built from.
 */
export const measureComponents = async (): Promise<
  { component: string; realtimeFactor: number; audioThreadPct: number }[]
> => {
  const seconds = 4
  const run = async (
    name: string,
    build: (oc: OfflineAudioContext, bus: GainNode, send: GainNode, banks: {
      strings: ReturnType<typeof createStringBank>
      modal: ReturnType<typeof createModalBank>
      tables: ReturnType<typeof tablesFor>
    }) => void,
  ): Promise<{ component: string; realtimeFactor: number; audioThreadPct: number }> => {
    const oc = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR)
    await loadWorklets(oc)
    const tables = tablesFor(oc)
    const bus = oc.createGain()
    bus.connect(oc.destination)
    const send = oc.createGain()
    send.gain.value = 0
    send.connect(oc.destination)
    const strings = createStringBank(oc)
    const modal = createModalBank(oc)
    strings?.node.connect(bus)
    modal?.node.connect(bus)
    build(oc, bus, send, { strings, modal, tables })
    await yieldToWorklet()
    const t0 = performance.now()
    await oc.startRendering()
    const wallMs = performance.now() - t0
    const rtf = (seconds * 1000) / wallMs
    return { component: name, realtimeFactor: rtf, audioThreadPct: 100 / rtf }
  }

  const rows = []
  rows.push(await run("empty graph", () => {}))
  rows.push(
    await run("convolver 1.1s (medium tier reverb)", (oc, _bus, _s, b) => {
      const c = oc.createConvolver()
      c.buffer = b.tables.impulse("tile", 1.1)
      c.connect(oc.destination)
      const n = oc.createBufferSource()
      n.buffer = b.tables.pink()
      n.loop = true
      const g = oc.createGain()
      g.gain.value = 0.2
      n.connect(g)
      g.connect(c)
      n.start(0)
    }),
  )
  rows.push(
    await run("convolver 2.4s (ultra tier reverb)", (oc, _bus, _s, b) => {
      const c = oc.createConvolver()
      c.buffer = b.tables.impulse("tile", 2.4)
      c.connect(oc.destination)
      const n = oc.createBufferSource()
      n.buffer = b.tables.pink()
      n.loop = true
      const g = oc.createGain()
      g.gain.value = 0.2
      n.connect(g)
      g.connect(c)
      n.start(0)
    }),
  )
  rows.push(
    await run("modal bank, 16 voices x 8 modes sustained", (_oc, _bus, _s, b) => {
      for (let i = 0; i < 16; i++) {
        b.modal?.strike({
          when: 0.02 + i * 0.001,
          material: MATERIALS.brass,
          freq: 180 + i * 20,
          velocity: 0.9,
          modes: 8,
          sustain: 2,
          gain: 0.3,
          rand: mulberry32(i),
        })
      }
    }),
  )
  rows.push(
    await run("string bank, 24 voices sustained", (_oc, _bus, _s, b) => {
      for (let i = 0; i < 24; i++) {
        b.strings?.pluck({
          when: 0.02 + i * 0.001,
          freq: 150 + i * 25,
          velocity: 0.8,
          decay: 4,
          damping: 0.15,
          position: 0.2,
          gain: 0.25,
        })
      }
    }),
  )
  rows.push(
    await run("140 grains/s cloud (ultra tier ceiling)", (oc, bus, send, b) => {
      const rand = mulberry32(3)
      const rc: RenderCtx = {
        ctx: oc,
        out: bus,
        send,
        when: 0.05,
        level: 1,
        intensity: 1,
        semitones: 0,
        tier: "ultra",
        rand,
        range: (lo, hi) => lo + rand() * (hi - lo),
        tables: b.tables,
        strings: b.strings,
        modal: b.modal,
      }
      grainCloud(rc, { rate: 140, seconds: 3.5, freq: 4200, spreadSemis: 14, gain: 0.3, send: 0.35 })
    }),
  )
  rows.push(
    await run("100 native BiquadFilter voices (fallback modal path)", (oc, bus, _s, b) => {
      const rand = mulberry32(11)
      for (let i = 0; i < 100; i++) {
        strikeNative(oc, bus, {
          when: 0.02 + i * 0.03,
          material: MATERIALS.tile,
          freq: 200 + (i % 12) * 30,
          velocity: 0.7,
          rand,
          noise: b.tables.white(),
        })
      }
    }),
  )
  return rows
}

declare global {
  interface Window {
    DW: Record<string, unknown>
  }
}

export const install = (): void => {
  window.DW = {
    AudioKit,
    ALL_PRESETS,
    MATERIALS,
    renderPreset,
    measureLibrary,
    measureModalT60,
    measureStringTuning,
    measureNativeKarplusCeiling,
    measureLoad,
    measureComponents,
    measureLimiter,
    measureVariation,
    measureLiveLatency,
    measureTriggerCost,
    measureFrameImpact,
    measureRenderCapacity,
    analyse,
    estimatePitch,
    measureT60,
  }
}
