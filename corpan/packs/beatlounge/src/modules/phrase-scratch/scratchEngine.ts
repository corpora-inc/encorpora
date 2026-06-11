/**
 * beatlounge — phrase-SCRATCH ENGINE: a REAL turntable. ONE AudioBuffer, ONE
 * floating-point playhead, signed variable rate, interpolated. The needle points
 * at ONE exact moment in the phrase; moving the disc moves that single read-head
 * forward / backward through the single wave. NO grains, NO looping, NO
 * re-triggering, NO voice spawning. (This replaces the old GrainPlayer looper.)
 *
 * ARCHITECTURE
 *   • An AudioWorklet (`scratchProcessor.ts`) holds the channel data + the float
 *     playhead and does the per-sample interpolated read each render block. Two
 *     control modes posted over its port:
 *       – POSITION (finger down): the main thread posts the exact target buffer
 *         position (samples) each animation frame; the block scrubs the playhead
 *         linearly to it. Emergent per-sample rate = the finger's signed speed.
 *       – INERTIA (released): a thrown velocity (samples/sample) coasts under
 *         friction; the audio slows + stops with the disc.
 *   • The pack is a single bundled IIFE behind a proxy — there is no served worklet
 *     file — so the processor source is a STRING wrapped in a Blob URL and added
 *     once per AudioContext. If `audioWorklet` is missing or `addModule` throws we
 *     degrade to a ScriptProcessorNode running the SAME pure DSP (`scratchDsp.ts`),
 *     never crashing the load.
 *   • Each deck connects through its own gain into a shared output, so a SECOND
 *     deck is just another instance crossfaded against the first.
 *
 * The math is the tested twin in `scratchDsp.ts` / `scratchMath.ts`.
 */

import {
  SCRATCH_PROCESSOR_NAME,
  SCRATCH_PROCESSOR_SOURCE,
} from "./scratchProcessor"
import {
  blockFriction,
  renderInertiaBlock,
  renderPositionBlock,
  cubicSample,
} from "./scratchDsp"
import { FRICTION_PER_SEC } from "./scratchMath"

const LOG = "[beatlounge/phrase-scratch]"

/** Below this |velocity| (samples/sample) the inertia coast is dead → silence. */
const STOP_SAMPLES_PER_SAMPLE = 0.02

/** A loaded turntable deck driven by the disc. */
export interface ScratchDeck {
  /** True once a buffer is loaded and the node is live. */
  isLive(): boolean
  /** POSITION mode: scrub toward this exact buffer time (seconds). Finger-down. */
  setTargetSeconds(seconds: number): void
  /** INERTIA mode: throw the playhead with this signed rate (×, buffer-sec/sec). */
  release(rate: number): void
  /** Hold the record dead-still (silence) without coasting. */
  hold(): void
  /** This deck's mix level 0..1 (the crossfader writes this). */
  setGain(gain: number): void
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

  // Transfer channel data to the processor (small phrase buffers — copy is fine).
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c).slice())
  }
  node.port.postMessage(
    { type: "load", channels, sampleRate: sr, length: buffer.length },
    channels.map((c) => c.buffer)
  )
  node.port.postMessage({ type: "config", useCubic: true, frictionPerSec: FRICTION_PER_SEC, stop: STOP_SAMPLES_PER_SAMPLE })

  return {
    isLive: () => !disposed,
    setTargetSeconds(seconds: number) {
      if (disposed) return
      node.port.postMessage({ type: "position", target: seconds * sr })
    },
    release(rate: number) {
      if (disposed) return
      // rate is buffer-seconds per real second → samples per output-sample.
      node.port.postMessage({ type: "inertia", velocity: rate })
    },
    hold() {
      if (disposed) return
      node.port.postMessage({ type: "idle" })
    },
    setGain(g: number) {
      if (disposed) return
      baseGain = clamp01(g)
      out.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.01)
    },
    duration: () => buffer.duration,
    sampleRate: () => sr,
    dispose() {
      if (disposed) return
      disposed = true
      try {
        node.port.postMessage({ type: "idle" })
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
  const length = buffer.length
  let disposed = false
  let baseGain = clamp01(gain)
  out.gain.value = baseGain

  const ch0 = buffer.getChannelData(0).slice()
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1).slice() : ch0

  let mode: "idle" | "position" | "inertia" = "idle"
  let playhead = 0
  let targetSamples = 0
  let velocity = 0
  const interp = cubicSample

  // 256-frame buffer keeps latency low while staying inside SP's allowed sizes.
  const bufSize = 256
  const sp = ctx.createScriptProcessor(bufSize, 0, 2)
  sp.onaudioprocess = (e: AudioProcessingEvent) => {
    const outL = e.outputBuffer.getChannelData(0)
    const outR = e.outputBuffer.numberOfChannels > 1 ? e.outputBuffer.getChannelData(1) : outL
    if (mode === "position") {
      const res = renderPositionBlock(ch0, outL, playhead, targetSamples, interp)
      if (outR !== outL) renderPositionBlock(ch1, outR, playhead, targetSamples, interp)
      playhead = res.playhead
    } else if (mode === "inertia") {
      const mul = blockFriction(FRICTION_PER_SEC, bufSize, sr)
      const res = renderInertiaBlock(
        ch0, outL, playhead, velocity, mul, STOP_SAMPLES_PER_SAMPLE, interp
      )
      if (outR !== outL) {
        renderInertiaBlock(ch1, outR, playhead, velocity, mul, STOP_SAMPLES_PER_SAMPLE, interp)
      }
      playhead = res.playhead
      velocity = res.velocity
      if (velocity === 0) mode = "idle"
    } else {
      outL.fill(0)
      if (outR !== outL) outR.fill(0)
    }
  }
  sp.connect(out)

  return {
    isLive: () => !disposed,
    setTargetSeconds(seconds: number) {
      if (disposed) return
      mode = "position"
      targetSamples = Math.max(0, Math.min(length, seconds * sr))
    },
    release(rate: number) {
      if (disposed) return
      mode = "inertia"
      velocity = rate
    },
    hold() {
      if (disposed) return
      mode = "idle"
      velocity = 0
    },
    setGain(g: number) {
      if (disposed) return
      baseGain = clamp01(g)
      out.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.01)
    },
    duration: () => buffer.duration,
    sampleRate: () => sr,
    dispose() {
      if (disposed) return
      disposed = true
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
      setTargetSeconds: () => {},
      release: () => {},
      hold: () => {},
      setGain: () => {},
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

export { ensureWorkletModule, STOP_SAMPLES_PER_SAMPLE }
