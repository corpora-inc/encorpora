/**
 * beatlounge — phrase-SCRATCH ENGINE: a REAL turntable. ONE AudioBuffer, ONE
 * floating-point playhead, ONE continuous signed RATE, interpolated. The needle
 * points at ONE exact moment in the phrase; moving the disc moves that single
 * read-head forward / backward through the single wave at the finger's speed. The
 * phrase LOOPS (wraps modulo length). NO grains, NO re-triggering, NO voice
 * spawning.
 *
 * ARCHITECTURE
 *   • An AudioWorklet (`scratchProcessor.ts`) holds the channel data + the float
 *     playhead + the signed rate and integrates `playhead += rate` EVERY sample,
 *     continuously, slewing `rate` toward the target the main thread posts. The main
 *     thread derives the target rate from the disc's angular speed each RAF tick and
 *     posts it; between posts the worklet keeps moving — so the audio NEVER freezes
 *     between frames (the old position/snap-to-target engine froze for ~13ms of each
 *     16ms frame → DC buzz). The worklet posts its true playhead back ("pos") so the
 *     needle stays locked to the audio.
 *   • The pack is a single bundled IIFE behind a proxy — there is no served worklet
 *     file — so the processor source is a STRING wrapped in a Blob URL and added
 *     once per AudioContext. If `audioWorklet` is missing or `addModule` throws we
 *     degrade to a ScriptProcessorNode running the SAME pure DSP (`scratchDsp.ts`),
 *     never crashing the load.
 *   • Each deck connects through its own gain into a shared output. That gain is the
 *     deck's LEVEL: the single-deck CUT FADER and the two-deck crossfader both write
 *     it. A SECOND deck is just another instance.
 *
 * The math is the tested twin in `scratchDsp.ts` / `scratchMath.ts`.
 */

import {
  SCRATCH_PROCESSOR_NAME,
  SCRATCH_PROCESSOR_SOURCE,
} from "./scratchProcessor"
import { renderRateBlock, cubicSample, DEFAULT_RATE_SLEW } from "./scratchDsp"

const LOG = "[beatlounge/phrase-scratch]"

/** A playhead report from the engine (seconds + current signed rate). */
export interface PosReport {
  /** True playhead in buffer-seconds (wrapped into [0, duration)). */
  seconds: number
  /** Current signed rate (buffer-sec per real-sec). */
  rate: number
}

/** A loaded turntable deck driven by the disc. */
export interface ScratchDeck {
  /** True once a buffer is loaded and the node is live. */
  isLive(): boolean
  /**
   * Set the CONTINUOUS target rate (signed, buffer-sec per real-sec). The finger
   * drag, the release coast, and Spin all just set a rate; the engine integrates it
   * smoothly every sample. 0 ≈ held.
   */
  setRate(rate: number): void
  /** Stop the record dead (rate → 0, silence). */
  hold(): void
  /** This deck's output level 0..1 (the cut fader AND the crossfader write this). */
  setGain(gain: number): void
  /** Subscribe to playhead reports (for needle/visual lock). Returns an unsubscribe. */
  onPos(cb: (p: PosReport) => void): () => void
  /** Loaded buffer duration in seconds (0 if none). */
  duration(): number
  /** Sample rate of the loaded buffer. */
  sampleRate(): number
  /** Free every node + stop sound. Idempotent. */
  dispose(): void
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/* ----------------------------------------------------- worklet module (once/ctx) */

// Guard `addModule` per AudioContext (idempotent-ish but addModule rejects a dup
// only sometimes; we never want to add twice). WeakSet keyed by the context.
const moduleLoaded = new WeakSet<BaseAudioContext>()
const moduleLoading = new WeakMap<BaseAudioContext, Promise<boolean>>()

/**
 * Ensure the scratch worklet module is added to `ctx`. Returns true if the worklet
 * is usable, false if we must fall back to a ScriptProcessor. Loads via a Blob URL
 * (no served file). Safe to call repeatedly; loads at most once per context.
 */
const ensureWorkletModule = async (ctx: BaseAudioContext): Promise<boolean> => {
  if (moduleLoaded.has(ctx)) return true
  const inflight = moduleLoading.get(ctx)
  if (inflight) return inflight
  const anyCtx = ctx as unknown as { audioWorklet?: AudioWorklet }
  if (!anyCtx.audioWorklet || typeof anyCtx.audioWorklet.addModule !== "function") {
    return false
  }
  const p = (async () => {
    let url: string | null = null
    try {
      const blob = new Blob([SCRATCH_PROCESSOR_SOURCE], {
        type: "application/javascript",
      })
      url = URL.createObjectURL(blob)
      await anyCtx.audioWorklet!.addModule(url)
      moduleLoaded.add(ctx)
      return true
    } catch (err) {
      console.warn(`${LOG} worklet addModule failed; falling back to ScriptProcessor:`, err)
      return false
    } finally {
      if (url) URL.revokeObjectURL(url)
    }
  })()
  moduleLoading.set(ctx, p)
  return p
}

/* ---------------------------------------------------------- worklet-backed deck */

const createWorkletDeck = (
  ctx: AudioContext,
  node: AudioWorkletNode,
  buffer: AudioBuffer,
  out: GainNode,
  gain: number
): ScratchDeck => {
  const sr = buffer.sampleRate
  let disposed = false
  let baseGain = clamp01(gain)
  out.gain.value = baseGain
  const posSubs = new Set<(p: PosReport) => void>()

  node.port.onmessage = (e: MessageEvent) => {
    const msg = e.data
    if (msg && msg.type === "pos" && posSubs.size > 0) {
      const report: PosReport = { seconds: msg.playhead / sr, rate: msg.rate }
      posSubs.forEach((cb) => cb(report))
    }
  }

  // Transfer channel data to the processor (small phrase buffers — copy is fine).
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c).slice())
  }
  node.port.postMessage(
    { type: "load", channels, sampleRate: sr, length: buffer.length },
    channels.map((c) => c.buffer)
  )
  node.port.postMessage({ type: "config", useCubic: true, slew: DEFAULT_RATE_SLEW })

  return {
    isLive: () => !disposed,
    setRate(rate: number) {
      if (disposed) return
      node.port.postMessage({ type: "rate", rate })
    },
    hold() {
      if (disposed) return
      node.port.postMessage({ type: "hold" })
    },
    setGain(g: number) {
      if (disposed) return
      baseGain = clamp01(g)
      out.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.008)
    },
    onPos(cb) {
      posSubs.add(cb)
      return () => posSubs.delete(cb)
    },
    duration: () => buffer.duration,
    sampleRate: () => sr,
    dispose() {
      if (disposed) return
      disposed = true
      posSubs.clear()
      try {
        node.port.onmessage = null
        node.port.postMessage({ type: "hold" })
        node.disconnect()
      } catch {
        /* ignore */
      }
      try {
        out.disconnect()
      } catch {
        /* ignore */
      }
    },
  }
}

/* ----------------------------------------------- ScriptProcessor fallback deck */

const createScriptProcessorDeck = (
  ctx: AudioContext,
  buffer: AudioBuffer,
  out: GainNode,
  gain: number
): ScratchDeck => {
  const sr = buffer.sampleRate
  let disposed = false
  let baseGain = clamp01(gain)
  out.gain.value = baseGain
  const posSubs = new Set<(p: PosReport) => void>()

  const ch0 = buffer.getChannelData(0).slice()
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1).slice() : ch0

  let playhead = 0
  let rate = 0
  let targetRate = 0
  const interp = cubicSample

  // 256-frame buffer keeps latency low while staying inside SP's allowed sizes.
  const bufSize = 256
  const sp = ctx.createScriptProcessor(bufSize, 0, 2)
  let posCounter = 0
  sp.onaudioprocess = (e: AudioProcessingEvent) => {
    const outL = e.outputBuffer.getChannelData(0)
    const outR = e.outputBuffer.numberOfChannels > 1 ? e.outputBuffer.getChannelData(1) : outL
    const res = renderRateBlock(ch0, outL, playhead, rate, targetRate, DEFAULT_RATE_SLEW, interp)
    if (outR !== outL) {
      renderRateBlock(ch1, outR, playhead, rate, targetRate, DEFAULT_RATE_SLEW, interp)
    }
    playhead = res.playhead
    rate = res.rate
    posCounter += bufSize
    if (posCounter >= 1024 && posSubs.size > 0) {
      posCounter = 0
      const report: PosReport = { seconds: playhead / sr, rate }
      posSubs.forEach((cb) => cb(report))
    }
  }
  sp.connect(out)

  return {
    isLive: () => !disposed,
    setRate(r: number) {
      if (disposed) return
      targetRate = r
    },
    hold() {
      if (disposed) return
      targetRate = 0
    },
    setGain(g: number) {
      if (disposed) return
      baseGain = clamp01(g)
      out.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.008)
    },
    onPos(cb) {
      posSubs.add(cb)
      return () => posSubs.delete(cb)
    },
    duration: () => buffer.duration,
    sampleRate: () => sr,
    dispose() {
      if (disposed) return
      disposed = true
      posSubs.clear()
      try {
        sp.onaudioprocess = null
        sp.disconnect()
      } catch {
        /* ignore */
      }
      try {
        out.disconnect()
      } catch {
        /* ignore */
      }
    },
  }
}

/* --------------------------------------------------------------- public factory */

/**
 * Build a scratch DECK over the shared AudioContext for a decoded buffer, connected
 * through a fresh gain into `destination` (default: ctx.destination). Tries the
 * AudioWorklet engine; degrades to a ScriptProcessor running the same DSP if the
 * worklet is unavailable. Never throws on a missing worklet — it always returns a
 * usable deck (or a silent stub if even the fallback can't build).
 */
export const createScratchDeck = async (
  ctx: AudioContext,
  buffer: AudioBuffer,
  opts: { gain?: number; destination?: AudioNode } = {}
): Promise<ScratchDeck> => {
  const gain = opts.gain ?? 0.95
  const out = ctx.createGain()
  out.connect(opts.destination ?? ctx.destination)

  const haveWorklet = await ensureWorkletModule(ctx)
  if (haveWorklet) {
    try {
      const node = new AudioWorkletNode(ctx, SCRATCH_PROCESSOR_NAME, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      })
      node.connect(out)
      return createWorkletDeck(ctx, node, buffer, out, gain)
    } catch (err) {
      console.warn(`${LOG} AudioWorkletNode construction failed; ScriptProcessor:`, err)
    }
  }

  try {
    return createScriptProcessorDeck(ctx, buffer, out, gain)
  } catch (err) {
    console.warn(`${LOG} ScriptProcessor fallback failed — scratch disabled:`, err)
    // Dignified silent stub: never crash the load.
    return {
      isLive: () => false,
      setRate: () => {},
      hold: () => {},
      setGain: () => {},
      onPos: () => () => {},
      duration: () => buffer.duration,
      sampleRate: () => buffer.sampleRate,
      dispose: () => {
        try {
          out.disconnect()
        } catch {
          /* ignore */
        }
      },
    }
  }
}

export { ensureWorkletModule }
