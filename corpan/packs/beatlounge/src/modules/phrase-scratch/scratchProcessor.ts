/**
 * beatlounge — phrase-SCRATCH AudioWorklet processor SOURCE (as a string).
 *
 * The pack ships as a single bundled IIFE served through a proxy — there is NO
 * separately-served worklet .js file to `addModule(url)`. So the processor source
 * lives here as a STRING; the engine wraps it in a Blob, makes an object URL, and
 * `audioWorklet.addModule(blobUrl)`s it (once per AudioContext). See `scratchEngine.ts`.
 *
 * The processor holds the phrase's channel data (Float32Array per channel) and one
 * floating-point `playhead`. It has two control modes (set via `port`):
 *   • "position" — main thread posts the exact target buffer position (samples) the
 *     needle should be at each frame; each block advances the playhead linearly
 *     toward target (increment = (target−playhead)/blockSize), reading the buffer
 *     with interpolation. The emergent per-sample rate = the finger's signed speed.
 *   • "inertia" — integrate playhead += velocity per sample with friction decay so
 *     the disc + audio coast and slow to rest; below a tiny |velocity| → silence.
 * Output is silent when |rate|≈0 (held). The playhead clamps to [0,length] — NO
 * wrap (run-off / lead-in are silence). Mono + stereo. A short gain ramp at
 * contact transitions avoids clicks (interpolation already kills most).
 *
 * !! KEEP THE DSP HERE IN LOCKSTEP WITH `scratchDsp.ts` !! The TS file is the
 * tested twin of this inlined math (renderPositionBlock / renderInertiaBlock /
 * linearSample / cubicSample). Change one → change both.
 */

export const SCRATCH_PROCESSOR_NAME = "bl-scratch-processor"

export const SCRATCH_PROCESSOR_SOURCE = /* js */ `
class BlScratchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.channels = []      // Float32Array[] (1 = mono, 2 = stereo)
    this.length = 0
    this.playhead = 0        // float sample index — the ONE read-head
    this.target = 0          // position-mode goal (samples)
    this.velocity = 0        // inertia-mode samples/sample
    this.mode = "idle"       // "position" | "inertia" | "idle"
    this.useCubic = true
    this.frictionPerSec = 0.12
    this.stop = 0.02         // |velocity| below this (samples/sample) = stopped
    this.gain = 0            // output trim ramp (anti-click)
    this.targetGain = 0
    this.port.onmessage = (e) => this.onMessage(e.data)
  }

  onMessage(msg) {
    if (!msg) return
    switch (msg.type) {
      case "load":
        this.channels = (msg.channels || []).map((c) => new Float32Array(c))
        this.length = msg.length || (this.channels[0] ? this.channels[0].length : 0)
        this.playhead = 0
        this.target = 0
        this.velocity = 0
        this.mode = "idle"
        break
      case "position":
        // Finger in contact: scrub toward an exact buffer position (samples).
        this.mode = "position"
        this.target = msg.target
        this.targetGain = 1
        break
      case "inertia":
        // Released with a thrown velocity (samples/sample); coast under friction.
        this.mode = "inertia"
        this.velocity = msg.velocity || 0
        this.targetGain = 1
        break
      case "config":
        if (msg.useCubic != null) this.useCubic = !!msg.useCubic
        if (msg.frictionPerSec != null) this.frictionPerSec = msg.frictionPerSec
        if (msg.stop != null) this.stop = msg.stop
        break
      case "idle":
        this.mode = "idle"
        this.velocity = 0
        break
    }
  }

  clampPh(idx) {
    if (!(this.length > 0)) return 0
    if (idx < 0) return 0
    if (idx > this.length) return this.length
    return idx
  }

  sample(data, idx) {
    const n = data.length
    if (n === 0) return 0
    if (idx < -1 || idx > n) return 0
    if (idx <= 0) return data[0] * Math.max(0, 1 + idx)
    if (idx >= n - 1) return data[n - 1] * Math.max(0, 1 - (idx - (n - 1)))
    const i = idx | 0
    const frac = idx - i
    if (!this.useCubic) {
      const a = data[i], b = data[i + 1]
      return a + (b - a) * frac
    }
    const x0 = data[i - 1 >= 0 ? i - 1 : 0]
    const x1 = data[i]
    const x2 = data[i + 1 < n ? i + 1 : n - 1]
    const x3 = data[i + 2 < n ? i + 2 : n - 1]
    const a0 = -0.5 * x0 + 1.5 * x1 - 1.5 * x2 + 0.5 * x3
    const a1 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3
    const a2 = -0.5 * x0 + 0.5 * x2
    const a3 = x1
    return ((a0 * frac + a1) * frac + a2) * frac + a3
  }

  process(_inputs, outputs) {
    const output = outputs[0]
    if (!output || output.length === 0) return true
    const blockSize = output[0].length
    if (!(this.length > 0) || this.channels.length === 0) {
      for (let ch = 0; ch < output.length; ch++) output[ch].fill(0)
      return true
    }

    const block = new Float32Array(blockSize)
    let increment = 0

    if (this.mode === "position") {
      const target = this.clampPh(this.target)
      increment = (target - this.playhead) / blockSize
      // (we compute samples per-channel below; playhead advanced once)
    } else if (this.mode === "inertia") {
      // friction over this block (frame-rate independent, exponential)
      if (Math.abs(this.velocity) < this.stop) {
        for (let ch = 0; ch < output.length; ch++) output[ch].fill(0)
        this.velocity = 0
        return true
      }
    } else {
      // idle / held: silence, but keep the node alive.
      for (let ch = 0; ch < output.length; ch++) output[ch].fill(0)
      return true
    }

    // Render each output channel from its source channel (mono → both).
    const ch0 = this.channels[0]
    const ch1 = this.channels.length > 1 ? this.channels[1] : ch0

    if (this.mode === "position") {
      const target = this.clampPh(this.target)
      for (let ch = 0; ch < output.length; ch++) {
        const src = ch === 1 && this.channels.length > 1 ? ch1 : ch0
        let ph = this.playhead
        const out = output[ch]
        for (let s = 0; s < blockSize; s++) {
          out[s] = this.sample(src, ph)
          ph += increment
        }
      }
      this.playhead = target
    } else {
      // INERTIA
      const blockMul = Math.pow(this.frictionPerSec, blockSize / sampleRate)
      const perSampleMul = Math.pow(blockMul, 1 / blockSize)
      let endPh = this.playhead
      let endV = this.velocity
      for (let ch = 0; ch < output.length; ch++) {
        const src = ch === 1 && this.channels.length > 1 ? ch1 : ch0
        let ph = this.playhead
        let v = this.velocity
        const out = output[ch]
        for (let s = 0; s < blockSize; s++) {
          out[s] = this.sample(src, ph)
          ph += v
          v *= perSampleMul
          if (ph <= 0 || ph >= this.length) {
            ph = this.clampPh(ph)
            v = 0
            for (let r = s + 1; r < blockSize; r++) out[r] = 0
            break
          }
        }
        endPh = ph
        endV = v
      }
      this.playhead = this.clampPh(endPh)
      this.velocity = Math.abs(endV) < this.stop ? 0 : endV
      // Report rest so the main thread can flip to idle + stop the visual coast.
      if (this.velocity === 0) this.port.postMessage({ type: "rest", playhead: this.playhead })
    }

    // Anti-click gain ramp (~3ms) across the block at contact transitions.
    const rampStep = 1 / Math.max(1, Math.floor(0.003 * sampleRate))
    for (let ch = 0; ch < output.length; ch++) {
      const out = output[ch]
      let g = this.gain
      for (let s = 0; s < blockSize; s++) {
        if (g < this.targetGain) g = Math.min(this.targetGain, g + rampStep)
        else if (g > this.targetGain) g = Math.max(this.targetGain, g - rampStep)
        out[s] *= g
      }
      if (ch === output.length - 1) this.gain = g
    }
    return true
  }
}

registerProcessor("${SCRATCH_PROCESSOR_NAME}", BlScratchProcessor)
`
