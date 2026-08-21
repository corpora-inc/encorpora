/**
 * Worklet loading + the two polyphonic banks (strings, modal) + a native
 * fallback modal bank for the rare host where AudioWorklet is unavailable or
 * blocked.
 *
 * TRAPS THIS FILE EXISTS TO ABSORB
 * --------------------------------
 * - `audioWorklet.addModule()` is async and MUST resolve before you construct
 *   an `AudioWorkletNode`, or you get `InvalidStateError` with a message that
 *   does not say "you did not await". The kit therefore boots the banks during
 *   `init()` and every preset degrades gracefully if they are absent.
 * - A `blob:` URL is the only way to load a worklet with no build step, but a
 *   strict CSP (Tauri's default `script-src 'self'`) rejects it. `loadWorklets`
 *   takes an override URL; `tools/emit-worklet.mjs` writes the identical `.js`
 *   so a host can serve it from its own origin.
 * - The banks are LONG-LIVED single nodes. Creating an `AudioWorkletNode` per
 *   sound costs a cross-thread construction and is the main reason people
 *   conclude "worklets are slow".
 */

import { WORKLET_SOURCE } from "../worklets/source.ts"
import { MATERIALS, expandMaterial, type Material, type ModeArrays } from "./materials.ts"
import type { ModalVoiceBank, StringBank } from "../types.ts"

export interface ModalBank extends ModalVoiceBank {
  readonly node: AudioNode
  dispose(): void
}

let blobUrl: string | null = null

/** The worklet source as a Blob URL, created once per page. */
export const workletBlobUrl = (): string => {
  if (!blobUrl) {
    blobUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "text/javascript" }))
  }
  return blobUrl
}

export interface WorkletLoad {
  ok: boolean
  error?: string
  /** ms spent in addModule — measured, reported, budgeted. */
  ms: number
}

/**
 * Load the processors. Safe to call repeatedly (addModule is idempotent for the
 * same source). `url` overrides the blob for CSP-strict hosts.
 */
export const loadWorklets = async (ctx: BaseAudioContext, url?: string): Promise<WorkletLoad> => {
  const t0 = now()
  const anyCtx = ctx as BaseAudioContext & { audioWorklet?: AudioWorklet }
  if (!anyCtx.audioWorklet) return { ok: false, error: "AudioWorklet unavailable", ms: 0 }
  try {
    await anyCtx.audioWorklet.addModule(url ?? workletBlobUrl())
    return { ok: true, ms: now() - t0 }
  } catch (e) {
    return { ok: false, error: String(e), ms: now() - t0 }
  }
}

const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now()

/** Polyphonic Karplus-Strong bank. One node, 24 voices, sample-accurate. */
export const createStringBank = (ctx: BaseAudioContext): StringBank | null => {
  let node: AudioWorkletNode
  try {
    node = new AudioWorkletNode(ctx, "dw-string", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    })
  } catch {
    return null
  }
  // A trigger message is a plain object; V8 keeps the shape monomorphic if we
  // always send exactly these keys in this order.
  return {
    node,
    pluck(o) {
      node.port.postMessage({
        type: "pluck",
        when: o.when,
        freq: o.freq,
        velocity: o.velocity,
        decay: o.decay,
        damping: o.damping,
        position: o.position ?? 0.22,
        pan: o.pan ?? 0,
        gain: o.gain ?? 1,
        id: 0,
      })
    },
    dispose() {
      node.port.postMessage({ type: "panic" })
      node.disconnect()
    },
  }
}

/** Polyphonic modal bank. One node, 16 voices x up to 10 modes. */
export const createModalBank = (ctx: BaseAudioContext): ModalBank | null => {
  let node: AudioWorkletNode
  try {
    node = new AudioWorkletNode(ctx, "dw-modal", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    })
  } catch {
    return null
  }
  // Scratch reused across strikes: postMessage structured-clones synchronously,
  // so the arrays are safe to overwrite the instant it returns.
  const scratch: ModeArrays = {
    freqs: new Float32Array(10),
    amps: new Float32Array(10),
    t60s: new Float32Array(10),
  }
  return {
    node,
    strike(o) {
      const m = o.material
      const sustain = o.sustain ?? 1
      const { freqs, amps, t60s } = expandMaterial(m, o.freq, {
        damp: o.damp ?? 0,
        bright: 0.25 + o.velocity * 0.75,
        rand: o.rand,
        modes: o.modes,
        into: scratch,
      })
      if (sustain !== 1) for (let i = 0; i < t60s.length; i++) t60s[i] *= sustain
      node.port.postMessage({
        type: "strike",
        when: o.when,
        freqs,
        amps,
        t60s,
        strikeMs: m.strikeMs,
        hardness: m.hardness * (0.55 + o.velocity * 0.45),
        pan: o.pan ?? 0,
        gain: (o.gain ?? 1) * (0.25 + o.velocity * 0.75),
      })
    },
    dispose() {
      node.port.postMessage({ type: "panic" })
      node.disconnect()
    },
  }
}

/**
 * Native fallback modal voice — a parallel bank of BiquadFilter bandpasses.
 *
 * Used when the worklet cannot load. It is genuinely worse and the code says so
 * honestly: Q is single-precision, the required Q for a long ring is enormous
 * (Q = T60·f/2.1988 — a 2 s ring at 440 Hz needs Q = 400) and the achieved
 * decay drifts from the requested one. Good enough that nothing is silent;
 * never the default.
 */
export const strikeNative = (
  ctx: BaseAudioContext,
  out: AudioNode,
  o: {
    when: number
    material: Material
    freq: number
    velocity: number
    modes?: number
    pan?: number
    gain?: number
    rand?: () => number
    noise: AudioBuffer
  },
): number => {
  const m = o.material
  const { freqs, amps, t60s } = expandMaterial(m, o.freq, {
    bright: 0.25 + o.velocity * 0.75,
    rand: o.rand,
    modes: Math.min(o.modes ?? m.ratios.length, 6),
  })
  const src = ctx.createBufferSource()
  src.buffer = o.noise
  const rnd = o.rand ?? Math.random
  src.loop = true
  const exciteGain = ctx.createGain()
  const strikeSec = m.strikeMs * 0.001
  exciteGain.gain.setValueAtTime(0, o.when)
  exciteGain.gain.linearRampToValueAtTime(1, o.when + 0.0004)
  exciteGain.gain.exponentialRampToValueAtTime(0.0001, o.when + strikeSec)
  src.connect(exciteGain)

  const sum = ctx.createGain()
  sum.gain.value = (o.gain ?? 1) * (0.25 + o.velocity * 0.75) * 0.5
  let endsAt = o.when
  for (let i = 0; i < freqs.length; i++) {
    const bp = ctx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = freqs[i]
    // Q = T60 · f / 2.1988 (bandpass -3dB bandwidth = f/Q, envelope e^(-π·BW·t)).
    // Capped: above ~600 the filter is numerically noisy in single precision.
    bp.Q.value = Math.min(600, (t60s[i] * freqs[i]) / 2.1988)
    const g = ctx.createGain()
    g.gain.value = amps[i]
    exciteGain.connect(bp)
    bp.connect(g)
    g.connect(sum)
    endsAt = Math.max(endsAt, o.when + t60s[i])
  }
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
  if (panner) {
    panner.pan.value = o.pan ?? 0
    sum.connect(panner)
    panner.connect(out)
  } else {
    sum.connect(out)
  }
  src.start(o.when, rnd() * 0.4)
  src.stop(endsAt + 0.02)
  return endsAt
}

export { MATERIALS }
