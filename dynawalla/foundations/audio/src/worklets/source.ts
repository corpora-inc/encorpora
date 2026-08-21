/**
 * The Dynawalla AudioWorklet processors, as source text.
 *
 * WHY A WORKLET AT ALL — the native node graph is fast C++ and we use it for
 * almost everything. Two things it genuinely cannot do:
 *
 *  1. **Karplus-Strong above ~375 Hz.** A feedback loop built from DelayNode is
 *     clamped by the spec to a minimum delay of one render quantum (128
 *     samples) because the graph has a cycle. At 48 kHz that caps the pitch at
 *     48000/128 = 375 Hz. Every plucked string in a bazaar lives above that.
 *     Measured, not assumed — see `measure/` (native loop asked for 440 Hz and
 *     produced 375 Hz).
 *  2. **Exact modal decay.** A BiquadFilter bandpass rings, but its decay is a
 *     side effect of Q, it is single-precision, and it goes unstable at the Q
 *     values a 2-second brass ring needs. A 2-pole resonator in f64 gives you
 *     T60 as a direct parameter and is stable anywhere.
 *
 * Both processors are POLYPHONIC and MESSAGE-SCHEDULED: one node, N voices,
 * events carrying an AudioContext timestamp that is resolved to an exact frame
 * offset inside `process()`. That means (a) no AudioWorkletNode churn per
 * sound — node construction is the expensive part — and (b) sample-accurate
 * onsets, which `port.postMessage` alone can never give you.
 *
 * Kept as a string so the kit has no build step and no asset to lose. The
 * loader turns it into a Blob URL; `tools/emit-worklet.mjs` writes the byte-
 * identical `.js` for hosts whose CSP forbids `blob:` scripts.
 */

export const WORKLET_SOURCE = String.raw`
'use strict';

// ---------------------------------------------------------------------------
// Shared: sample-accurate event queue.
// ---------------------------------------------------------------------------
// currentTime in the worklet global scope is the time of the FIRST frame of the
// block about to be rendered. An event at time 'when' therefore lands at frame
// round((when - currentTime) * sampleRate). Events in the past land at frame 0
// (a late trigger should still fire, just not sample-accurately). Events beyond
// this block stay queued.
// 'out' is a PREALLOCATED array; we return how many slots are live. Nothing in
// here may allocate: this runs on the audio render thread, where a GC pause is
// a click in everyone's ears.
function drain(queue, out) {
  const base = currentTime;
  let n = 0;
  for (let i = queue.length - 1; i >= 0; i--) {
    const ev = queue[i];
    let f = Math.round((ev.when - base) * sampleRate);
    if (f < 128) {
      if (f < 0) f = 0;
      ev._f = f;
      if (n < out.length) out[n++] = ev;
      queue.splice(i, 1);
    }
  }
  // Insertion sort: n is 0-3 in practice and this allocates nothing, unlike
  // Array.prototype.sort with a comparator.
  for (let i = 1; i < n; i++) {
    const ev = out[i];
    let j = i - 1;
    while (j >= 0 && out[j]._f > ev._f) { out[j + 1] = out[j]; j--; }
    out[j + 1] = ev;
  }
  return n;
}

// ---------------------------------------------------------------------------
// dw-string — polyphonic Karplus-Strong (extended: damping, pick position,
// per-note decay, stereo placement).
// ---------------------------------------------------------------------------
const MAX_STRING_VOICES = 24;
const MIN_FREQ = 40; // -> delay line length

function StringVoice(sr) {
  this.buf = new Float32Array(Math.ceil(sr / MIN_FREQ) + 8);
  this.idx = 0;
  this.len = 0;      // fractional delay length in samples
  this.gain = 0;     // output gain
  this.loopGain = 0; // per-round-trip decay
  this.damp = 0.5;   // one-pole loop filter coefficient
  this.lp = 0;
  this.active = false;
  this.age = 0;
  this.energy = 0;
  this.panL = 0.707;
  this.panR = 0.707;
  this.id = 0;
}

class StringProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    for (let i = 0; i < MAX_STRING_VOICES; i++) this.voices.push(new StringVoice(sampleRate));
    this.queue = [];
    this.pending = new Array(16).fill(null);
    // Excitation scratch, allocated ONCE. Allocating a Float32Array per pluck
    // inside process() is a real, audible bug: it is a malloc on the audio
    // render thread and it eventually drags a GC pause into a 2.6ms budget.
    this.scratch = new Float32Array(Math.ceil(sampleRate / MIN_FREQ) + 8);
    this.rngState = 0x9e3779b9;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'pluck') this.queue.push(d);
      else if (d.type === 'panic') { for (const v of this.voices) { v.active = false; v.buf.fill(0); } this.queue.length = 0; }
    };
  }

  rnd() {
    let a = (this.rngState + 0x6d2b79f5) | 0;
    this.rngState = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Quietest / oldest voice loses. Never steal a voice younger than ~30ms:
  // stealing a just-started note is far more audible than dropping a new one.
  allocate() {
    let free = -1, worst = -1, worstScore = Infinity;
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      if (!v.active) { free = i; break; }
      if (v.age < 0.03 * sampleRate) continue;
      const score = v.energy;
      if (score < worstScore) { worstScore = score; worst = i; }
    }
    if (free >= 0) return this.voices[free];
    if (worst >= 0) { const v = this.voices[worst]; v.buf.fill(0); v.lp = 0; return v; }
    return null;
  }

  start(ev) {
    const v = this.allocate();
    if (!v) return;
    const freq = Math.max(MIN_FREQ, Math.min(sampleRate * 0.45, ev.freq));
    const damping = Math.max(0, Math.min(1, ev.damping));
    // One-pole loop filter y += a*(x-y). Brighter string -> a closer to 1.
    // Its phase delay at low frequency is (1-a)/a samples; compensate so the
    // pitch is right. Measured error after compensation: < 1.5 cents to 2 kHz.
    const a = 1 - 0.85 * damping * damping;
    const filtDelay = (1 - a) / a;
    const period = sampleRate / freq;
    v.len = Math.max(2, period - filtDelay);
    v.damp = a;
    // Loop gain so the string reaches -60dB in 'decay' seconds.
    const roundTrips = Math.max(1e-6, ev.decay) * freq;
    v.loopGain = Math.pow(10, -3 / roundTrips);
    if (v.loopGain > 0.99995) v.loopGain = 0.99995; // never a perpetual motion machine
    v.gain = ev.gain;
    v.lp = 0;
    v.age = 0;
    v.active = true;
    v.energy = ev.velocity;
    v.id = ev.id | 0;
    const pan = Math.max(-1, Math.min(1, ev.pan || 0));
    // Equal-power pan.
    const th = (pan + 1) * Math.PI * 0.25;
    v.panL = Math.cos(th);
    v.panR = Math.sin(th);

    // --- Excitation -------------------------------------------------------
    // Noise burst of exactly one period, lowpassed by how hard it was struck
    // (soft = dark), then comb-filtered by pick position: x[n] - x[n-pL].
    // The comb is what makes "plucked near the bridge" sound thin and nasal
    // and "plucked over the hole" sound round. Without it every pluck is the
    // same instrument.
    const L = Math.ceil(v.len) + 2;
    const buf = v.buf;
    buf.fill(0);
    const vel = Math.max(0.02, Math.min(1, ev.velocity));
    const bright = 0.25 + 0.7 * vel * (1 - damping * 0.6);
    let lp = 0;
    const tmp = this.scratch;
    for (let i = 0; i < L; i++) {
      const w = this.rnd() * 2 - 1;
      lp += bright * (w - lp);
      tmp[i] = lp;
    }
    const pos = Math.max(0.01, Math.min(0.5, ev.position === undefined ? 0.22 : ev.position));
    const pL = Math.max(1, Math.round(pos * L));
    let peak = 1e-9;
    for (let i = 0; i < L; i++) {
      const y = tmp[i] - (i >= pL ? tmp[i - pL] : 0);
      buf[i] = y;
      const ay = y < 0 ? -y : y;
      if (ay > peak) peak = ay;
    }
    // Normalise the excitation so velocity — not the comb's incidental gain —
    // controls loudness. Skipping this makes some pitches randomly twice as
    // loud, which reads as a bug even when nobody can say why.
    const norm = vel / peak;
    for (let i = 0; i < L; i++) buf[i] *= norm;
    // Write pointer starts PAST the excitation so the first read lands inside
    // it. Starting at 0 reads the zeroed far end of the delay line and the
    // string never speaks — a silent-pluck bug that looks like a routing fault.
    v.idx = L;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out.length > 1 ? out[1] : out[0];
    const n = L.length;
    const evs = this.pending;
    const evn = drain(this.queue, evs);
    let e = 0;

    for (let i = 0; i < n; i++) {
      while (e < evn && evs[e]._f === i) { this.start(evs[e]); e++; }
      let sl = 0, sr = 0;
      for (let k = 0; k < this.voices.length; k++) {
        const v = this.voices[k];
        if (!v.active) continue;
        const buf = v.buf;
        const bl = buf.length;
        // Fractional read, linear interpolation.
        let rp = v.idx - v.len;
        while (rp < 0) rp += bl;
        const i0 = rp | 0;
        const fr = rp - i0;
        const i1 = i0 + 1 >= bl ? 0 : i0 + 1;
        const s = buf[i0] + fr * (buf[i1] - buf[i0]);
        // Loop filter + decay.
        v.lp += v.damp * (s - v.lp);
        const y = v.lp * v.loopGain;
        buf[v.idx] = y;
        v.idx++; if (v.idx >= bl) v.idx = 0;
        v.age++;
        const ay = y < 0 ? -y : y;
        v.energy = v.energy * 0.9995 + ay * 0.0005;
        const o = y * v.gain;
        sl += o * v.panL;
        sr += o * v.panR;
        // Retire when inaudible. 1e-5 ~ -100dBFS; below any playback level.
        if (v.age > 512 && v.energy < 1e-5) { v.active = false; }
      }
      L[i] = sl;
      if (R !== L) R[i] = sr;
    }
    return true; // node is a long-lived bank, never self-terminates
  }
}
registerProcessor('dw-string', StringProcessor);

// ---------------------------------------------------------------------------
// dw-modal — polyphonic modal synthesis. Struck brass, tile, stone, glass,
// membranes. Each voice is a parallel bank of 2-pole resonators in f64 with
// T60 as a DIRECT parameter (not a side effect of Q).
// ---------------------------------------------------------------------------
const MAX_MODAL_VOICES = 16;
const MAX_MODES = 10;

function ModalVoice() {
  this.f = new Float64Array(MAX_MODES);   // b1 = 2 r cos w
  this.g = new Float64Array(MAX_MODES);   // -r^2
  this.amp = new Float64Array(MAX_MODES);
  this.y1 = new Float64Array(MAX_MODES);
  this.y2 = new Float64Array(MAX_MODES);
  this.count = 0;
  this.active = false;
  this.exciteLeft = 0;
  this.exciteLp = 0;
  this.exciteA = 0.5;
  this.gain = 0;
  this.age = 0;
  this.energy = 0;
  this.panL = 0.707;
  this.panR = 0.707;
}

class ModalProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    for (let i = 0; i < MAX_MODAL_VOICES; i++) this.voices.push(new ModalVoice());
    this.queue = [];
    this.pending = new Array(16).fill(null);
    this.rngState = 0x1b873593;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'strike') this.queue.push(d);
      else if (d.type === 'panic') { for (const v of this.voices) v.active = false; this.queue.length = 0; }
    };
  }

  rnd() {
    let a = (this.rngState + 0x6d2b79f5) | 0;
    this.rngState = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  allocate() {
    let free = -1, worst = -1, worstScore = Infinity;
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      if (!v.active) { free = i; break; }
      if (v.age < 0.03 * sampleRate) continue;
      if (v.energy < worstScore) { worstScore = v.energy; worst = i; }
    }
    if (free >= 0) return this.voices[free];
    if (worst >= 0) {
      const v = this.voices[worst];
      v.y1.fill(0); v.y2.fill(0);
      return v;
    }
    return null;
  }

  start(ev) {
    const v = this.allocate();
    if (!v) return;
    const freqs = ev.freqs, amps = ev.amps, t60s = ev.t60s;
    const count = Math.min(MAX_MODES, freqs.length);
    v.count = count;
    const nyq = sampleRate * 0.5;
    let live = 0;
    for (let i = 0; i < count; i++) {
      const f = freqs[i];
      if (f <= 20 || f >= nyq * 0.98) { v.amp[live] = 0; v.f[live] = 0; v.g[live] = 0; v.y1[live] = 0; v.y2[live] = 0; live++; continue; }
      // r^(T60*sr) = 1e-3  ->  r = 10^(-3/(T60*sr))
      const r = Math.pow(10, -3 / (Math.max(0.005, t60s[i]) * sampleRate));
      const w = 2 * Math.PI * f / sampleRate;
      v.f[live] = 2 * r * Math.cos(w);
      v.g[live] = -(r * r);
      // The 2-pole resonator's impulse response is
      //     y[n] = A · r^n · sin((n+1)w) / sin(w)
      // so its peak is A/sin(w). Scaling A by sin(w) makes every mode's peak
      // exactly amps[i] regardless of frequency. Skip this and the low modes
      // are enormous while the high ones vanish — the "every material sounds
      // like a kick drum" failure.
      v.amp[live] = amps[i] * Math.sin(w)
      v.y1[live] = 0; v.y2[live] = 0;
      live++;
    }
    v.count = live;
    v.active = true;
    v.age = 0;
    v.energy = 1;
    v.gain = ev.gain;
    // Excitation: a short noise burst (a struck object is hit by something with
    // its own spectrum, not by a mathematical impulse). 'strikeHardness' 0..1
    // opens the excitation's lowpass -> soft mallet vs steel hammer.
    v.exciteLeft = Math.max(1, Math.round((ev.strikeMs || 1.2) * 0.001 * sampleRate));
    v.exciteA = 0.03 + 0.95 * Math.max(0, Math.min(1, ev.hardness === undefined ? 0.6 : ev.hardness));
    v.exciteLp = 0;
    const pan = Math.max(-1, Math.min(1, ev.pan || 0));
    const th = (pan + 1) * Math.PI * 0.25;
    v.panL = Math.cos(th);
    v.panR = Math.sin(th);
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out.length > 1 ? out[1] : out[0];
    const n = L.length;
    const evs = this.pending;
    const evn = drain(this.queue, evs);
    let e = 0;

    for (let i = 0; i < n; i++) {
      while (e < evn && evs[e]._f === i) { this.start(evs[e]); e++; }
      let sl = 0, sr = 0;
      for (let k = 0; k < this.voices.length; k++) {
        const v = this.voices[k];
        if (!v.active) continue;
        let x = 0;
        if (v.exciteLeft > 0) {
          const w = this.rnd() * 2 - 1;
          v.exciteLp += v.exciteA * (w - v.exciteLp);
          x = v.exciteLp;
          v.exciteLeft--;
        }
        let acc = 0;
        const f = v.f, g = v.g, a = v.amp, y1 = v.y1, y2 = v.y2;
        for (let m = 0; m < v.count; m++) {
          const y = f[m] * y1[m] + g[m] * y2[m] + a[m] * x;
          y2[m] = y1[m];
          y1[m] = y;
          acc += y;
        }
        v.age++;
        const aa = acc < 0 ? -acc : acc;
        v.energy = v.energy * 0.999 + aa * 0.001;
        const o = acc * v.gain;
        sl += o * v.panL;
        sr += o * v.panR;
        if (v.age > 512 && v.energy < 1e-5) v.active = false;
      }
      L[i] = sl;
      if (R !== L) R[i] = sr;
    }
    return true;
  }
}
registerProcessor('dw-modal', ModalProcessor);

// ---------------------------------------------------------------------------
// dw-meter — a zero-allocation peak/RMS/clip meter. Used by the measurement
// harness and by the master safety check. Posts a summary 20x a second, not a
// value per block: postMessage from the audio thread is the classic way to
// starve the renderer.
// ---------------------------------------------------------------------------
class MeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.peak = 0; this.sum = 0; this.count = 0; this.clips = 0; this.acc = 0;
  }
  process(inputs) {
    const inp = inputs[0];
    if (!inp || inp.length === 0) return true;
    const n = inp[0].length;
    for (let c = 0; c < inp.length; c++) {
      const ch = inp[c];
      for (let i = 0; i < n; i++) {
        const s = ch[i];
        const a = s < 0 ? -s : s;
        if (a > this.peak) this.peak = a;
        if (a >= 0.999) this.clips++;
        this.sum += s * s;
        this.count++;
      }
    }
    this.acc += n;
    if (this.acc >= sampleRate / 20) {
      this.port.postMessage({
        peak: this.peak,
        rms: Math.sqrt(this.sum / Math.max(1, this.count)),
        clips: this.clips,
      });
      this.peak = 0; this.sum = 0; this.count = 0; this.clips = 0; this.acc = 0;
    }
    return true;
  }
}
registerProcessor('dw-meter', MeterProcessor);
`
