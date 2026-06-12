/**
 * beatlounge — phrase-SCRATCH AudioWorklet processor SOURCE (as a string).
 *
 * The pack ships as a single bundled IIFE served through a proxy — there is NO
 * separately-served worklet .js file to `addModule(url)`. So the processor source
 * lives here as a STRING; the engine wraps it in a Blob, makes an object URL, and
 * `audioWorklet.addModule(blobUrl)`s it (once per AudioContext). See `scratchEngine.ts`.
 *
 * THE ENGINE IS A CONTINUOUS-RATE INTEGRATOR. The processor holds the phrase's
 * channel data (Float32Array per channel), one floating-point `playhead`, and a
 * signed `rate` (buffer-samples per output-sample). EVERY sample it reads the buffer
 * (interpolated, LOOPING) at the playhead, advances `playhead += rate` (WRAPPED
 * modulo length — the phrase loops), and slews `rate` one step toward `targetRate`.
 * It NEVER snaps to a target and freezes between frames (that was the old bug: ~3ms
 * of audio then ~13ms of frozen DC buzz). The main thread just posts a target rate:
 *   • "rate"  — set the target rate (finger drag, coast, or Spin's natural 1.0).
 *   • "hold"  — target rate 0 → slews to a dead stop (silence).
 *   • "load" / "config" — buffer + tuning.
 * The processor posts back its true `playhead` periodically ("pos") so the main
 * thread can keep the needle/visual exactly locked to the audio.
 *
 * !! KEEP THE DSP HERE IN LOCKSTEP WITH `scratchDsp.ts` !! The TS file is the
 * tested twin of this inlined math (renderRateBlock / linearSample / cubicSample /
 * wrapPlayhead). Change one → change both.
 */

export const SCRATCH_PROCESSOR_NAME = "bl-scratch-processor"

export const SCRATCH_PROCESSOR_SOURCE = /* js */ `
class BlScratchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.channels = []      // Float32Array[] (1 = mono, 2 = stereo)
    this.length = 0
    this.playhead = 0        // float sample index — the ONE read-head (wraps/loops)
    this.rate = 0            // current signed rate (samples/output-sample)
    this.targetRate = 0      // rate the main thread asked for (slewed toward)
    this.useCubic = true
    this.slew = 0.0042       // per-sample one-pole coefficient toward targetRate
    this.gain = 0            // output trim ramp (anti-click on first contact)
    this.targetGain = 0
    this.posEvery = 0        // sample counter for periodic playhead reports
    this.port.onmessage = (e) => this.onMessage(e.data)
  }

  onMessage(msg) {
    if (!msg) return
    switch (msg.type) {
      case "load":
        this.channels = (msg.channels || []).map((c) => new Float32Array(c))
        this.length = msg.length || (this.channels[0] ? this.channels[0].length : 0)
        this.playhead = 0
        this.rate = 0
        this.targetRate = 0
        break
      case "rate":
        // Continuous: set the target rate; the integrator glides there + keeps moving.
        this.targetRate = msg.rate || 0
        this.targetGain = 1
        break
      case "hold":
        // Stop the record dead — slew the rate to 0 (silence).
        this.targetRate = 0
        break
      case "config":
        if (msg.useCubic != null) this.useCubic = !!msg.useCubic
        if (msg.slew != null && msg.slew > 0) this.slew = msg.slew
        break
    }
  }

  wrapPh(idx) {
    if (!(this.length > 0)) return 0
    let p = idx % this.length
    if (p < 0) p += this.length
    return p
  }

  sample(data, idx) {
    const n = data.length
    if (n === 0) return 0
    if (n < 4 || !this.useCubic) {
      let p = idx % n
      if (p < 0) p += n
      const i = p | 0
      const frac = p - i
      const a = data[i], b = data[(i + 1) % n]
      return a + (b - a) * frac
    }
    let p = idx % n
    if (p < 0) p += n
    const i = p | 0
    const frac = p - i
    const x0 = data[(i - 1 + n) % n]
    const x1 = data[i]
    const x2 = data[(i + 1) % n]
    const x3 = data[(i + 2) % n]
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

    const ch0 = this.channels[0]
    const ch1 = this.channels.length > 1 ? this.channels[1] : ch0
    const k = this.slew <= 0 ? 0 : this.slew >= 1 ? 1 : this.slew
    const length = this.length

    // Integrate the CONTINUOUS rate. Per channel we replay the SAME integration from
    // the block's start state so both channels stay phase-aligned; the shared end
    // state (playhead/rate) is captured once.
    let endPh = this.playhead
    let endRate = this.rate
    for (let ch = 0; ch < output.length; ch++) {
      const src = ch === 1 && this.channels.length > 1 ? ch1 : ch0
      let ph = this.playhead
      let r = this.rate
      const out = output[ch]
      for (let s = 0; s < blockSize; s++) {
        out[s] = this.sample(src, ph)
        ph += r
        if (ph >= length) ph -= length
        else if (ph < 0) ph += length
        if (ph >= length || ph < 0) ph = this.wrapPh(ph)
        r += (this.targetRate - r) * k
      }
      endPh = ph
      endRate = r
    }
    this.playhead = endPh
    this.rate = endRate

    // Anti-click gain ramp (~3ms) across the block at the very first contact.
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

    // Report the true playhead ~once per animation frame (every 1024 samples ≈ 21ms
    // at 48k) so the main thread can lock the needle/visual to the audio without
    // flooding the port (the RAF loop only consumes one report per frame anyway).
    this.posEvery += blockSize
    if (this.posEvery >= 1024) {
      this.posEvery = 0
      this.port.postMessage({ type: "pos", playhead: this.playhead, rate: this.rate })
    }
    return true
  }
}

registerProcessor("${SCRATCH_PROCESSOR_NAME}", BlScratchProcessor)
`
