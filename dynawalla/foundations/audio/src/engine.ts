/**
 * The engine: one AudioContext, four buses, a master chain that cannot clip, a
 * voice budget that cannot be exceeded, and an unlock story that works on iOS.
 *
 * Design rules this file enforces so no prototype has to think about them:
 *
 *  - **Nothing allocates on the hot path** that can be built once. Tables,
 *    banks, curves and the impulse response are built during `init()`.
 *  - **Every sound is bus-routed.** A prototype cannot accidentally connect to
 *    `destination` and bypass the limiter.
 *  - **Cues fire even when muted.** Audio never carries information alone; see
 *    `onCue`. Mute changes what you HEAR, never what the game TELLS you.
 *  - **The context is suspended when the page is hidden.** A backgrounded tab
 *    that keeps a 48 kHz graph alive is a battery complaint and, on iOS, an
 *    audio session that fights with the user's music.
 */

import { tablesFor, warmTables } from "./dsp/tables.ts"
import { createModalBank, createStringBank, loadWorklets, type ModalBank } from "./dsp/banks.ts"
import { holdCurrent } from "./dsp/env.ts"
import { clamp, hashString, mulberry32, spread } from "./rng.ts"
import type {
  BusName,
  Cue,
  PlayOptions,
  Preset,
  RenderCtx,
  StringBank,
  Tier,
} from "./types.ts"

// ---------------------------------------------------------------------------
// Tier profiles. The mid-range tablet is the FLOOR (`medium`), never the design
// target. `ultra` exists so a capable device is genuinely staggering.
// ---------------------------------------------------------------------------

export interface TierProfile {
  /** Total simultaneous kit-managed voices. */
  maxVoices: number
  /** Reverb tail length in seconds. 0 disables the convolver entirely. */
  reverbSeconds: number
  /** Cap on modal partials per strike. */
  maxModes: number
  /** Grains per second ceiling for granular textures. */
  maxGrainRate: number
  /** Music layers allowed. */
  musicLayers: number
  /** Use the polyphonic worklet banks (false = native fallback). */
  worklets: boolean
}

export const TIERS: Record<Tier, TierProfile> = {
  ultra: { maxVoices: 48, reverbSeconds: 2.4, maxModes: 10, maxGrainRate: 140, musicLayers: 6, worklets: true },
  high: { maxVoices: 32, reverbSeconds: 1.8, maxModes: 8, maxGrainRate: 90, musicLayers: 5, worklets: true },
  medium: { maxVoices: 20, reverbSeconds: 1.1, maxModes: 6, maxGrainRate: 45, musicLayers: 4, worklets: true },
  low: { maxVoices: 12, reverbSeconds: 0, maxModes: 4, maxGrainRate: 0, musicLayers: 2, worklets: false },
}

export interface EngineOptions {
  /** Force a tier. Omit to auto-detect with a ~30ms offline benchmark. */
  tier?: Tier
  /** Master volume 0..1. */
  volume?: number
  /** Start muted (restore the child's last choice here). */
  muted?: boolean
  /** Override the worklet module URL (CSP-strict hosts). */
  workletUrl?: string
  /** Provide a context (tests, or a host that already owns one). */
  context?: AudioContext
  /** Set false to skip the auto-unlock listeners and drive `resume()` yourself. */
  autoUnlock?: boolean
}

interface ActiveVoice {
  id: string
  group: string
  endsAt: number
  startedAt: number
  weight: number
  release?: (at: number) => void
}

const NOW = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now())

/**
 * A ~25ms offline benchmark that ranks the device's audio DSP throughput.
 *
 * OfflineAudioContext renders as fast as the machine can, so `rendered seconds
 * / wall seconds` is a direct measure of DSP headroom — far better than
 * sniffing `deviceMemory` or the user agent, which lie. The graph below is
 * deliberately representative: convolution and a resonant filter bank are what
 * actually cost money in this kit.
 */
export const probeTier = async (): Promise<{ tier: Tier; realtimeFactor: number; ms: number }> => {
  const OAC =
    (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext
  if (!OAC) return { tier: "medium", realtimeFactor: 0, ms: 0 }
  const sr = 48000
  const seconds = 1.0
  const oc = new OAC(2, sr * seconds, sr)
  const t = tablesFor(oc)
  const noise = oc.createBufferSource()
  noise.buffer = t.pink()
  noise.loop = true
  const conv = oc.createConvolver()
  conv.buffer = t.impulse("tile", 1.2)
  const g = oc.createGain()
  g.gain.value = 0.2
  noise.connect(g)
  // 12 resonators — the shape of a busy moment in the bazaar.
  for (let i = 0; i < 12; i++) {
    const bp = oc.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = 120 * (i + 1)
    bp.Q.value = 24
    g.connect(bp)
    bp.connect(conv)
  }
  conv.connect(oc.destination)
  noise.start(0)
  const t0 = NOW()
  await oc.startRendering()
  const ms = NOW() - t0
  const realtimeFactor = (seconds * 1000) / Math.max(0.01, ms)
  // CALIBRATION. Measured reference: Apple M-series laptop, Chrome 149,
  // 48 kHz -> realtimeFactor 74. That is a fast device, so the thresholds are
  // anchored to it and scaled down for the tablets we actually target. They
  // are intentionally conservative: a device that lands one tier low still
  // sounds excellent, a device one tier too high crackles, and crackle is the
  // only unrecoverable audio failure.
  //
  // Recalibrate by running `measure/index.html` on a real target device and
  // reading `stats.realtimeFactor` — do not guess from the user agent.
  const tier: Tier =
    realtimeFactor > 55 ? "ultra" : realtimeFactor > 28 ? "high" : realtimeFactor > 10 ? "medium" : "low"
  return { tier, realtimeFactor, ms }
}

export class AudioEngine {
  readonly ctx: AudioContext
  tier: Tier
  profile: TierProfile

  private master!: GainNode
  private comp!: DynamicsCompressorNode
  private safety!: WaveShaperNode
  private busGain: Record<BusName, GainNode> = {} as Record<BusName, GainNode>
  private duckGain: Record<BusName, GainNode> = {} as Record<BusName, GainNode>
  private sendGain: Record<BusName, GainNode> = {} as Record<BusName, GainNode>
  private reverbReturn: AudioNode | null = null

  /**
   * The polyphonic banks are PER BUS, created lazily.
   *
   * A worklet bank is ONE node shared by many voices, which means its output
   * cannot pass through a per-voice gain node and cannot be re-routed per
   * trigger. If every preset shared one bank, a UI tick's modal body would land
   * on the SFX bus and ignore both the UI fader and the preset's own level.
   * Per-bus banks fix the routing; the per-voice level is applied by scaling
   * the bank's own `gain` message field (see `rc.level`).
   *
   * MEASURED: an IDLE AudioWorkletNode is not free — about 0.33% of one core
   * each, just for existing (12 idle banks measured 3.98%). Hence lazy: a
   * prototype that never starts music never pays for a music bank.
   */
  private modalBanks = new Map<BusName, ModalBank | null>()
  private stringBanks = new Map<BusName, StringBank | null>()
  private worklandReady = false

  private voices: ActiveVoice[] = []
  private lastFired = new Map<string, number>()
  private lastVariant = new Map<string, number>()
  private seq = 0
  private sweeper: ReturnType<typeof setInterval> | null = null
  private cueHandlers: ((c: Cue) => void)[] = []
  private duckUntil = 0
  private duckDepth = 0
  private unlocked = false
  private unlockHandlers: (() => void) | null = null

  muted: boolean
  volume: number
  ready = false
  workletStatus: { ok: boolean; error?: string; ms: number } = { ok: false, ms: 0 }
  /** Populated at init — real, measured numbers a prototype can print. */
  stats = { sampleRate: 0, baseLatency: 0, outputLatency: 0, probeMs: 0, realtimeFactor: 0, initMs: 0 }

  private opts: EngineOptions

  constructor(opts: EngineOptions = {}) {
    this.opts = opts
    const Ctor =
      (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) throw new Error("Web Audio is unavailable in this environment")
    // NOTE: we deliberately do NOT pass `sampleRate`. Forcing 44100 on a device
    // whose hardware runs at 48000 inserts a resampler in front of the output
    // and costs both latency and CPU. Let the device choose; adapt to it.
    this.ctx = opts.context ?? new Ctor({ latencyHint: "interactive" })
    this.tier = opts.tier ?? "medium"
    this.profile = TIERS[this.tier]
    this.muted = opts.muted ?? false
    this.volume = opts.volume ?? 0.9
  }

  /** Build the graph, probe the device, load the worklets, warm the tables. */
  async init(): Promise<void> {
    if (this.ready) return
    const t0 = NOW()
    if (!this.opts.tier) {
      const p = await probeTier()
      this.tier = p.tier
      this.stats.probeMs = p.ms
      this.stats.realtimeFactor = p.realtimeFactor
    }
    this.profile = TIERS[this.tier]
    this.buildGraph()

    if (this.profile.worklets) {
      this.workletStatus = await loadWorklets(this.ctx, this.opts.workletUrl)
      this.worklandReady = this.workletStatus.ok
      if (this.worklandReady) {
        // Pre-create the two buses every prototype uses on its first frame.
        this.modalFor("sfx")
        this.modalFor("ui")
        this.stringsFor("sfx")
      }
    }
    warmTables(this.ctx, this.profile.reverbSeconds)

    this.sweeper = setInterval(() => this.sweep(), 250)
    if (this.opts.autoUnlock !== false) this.armUnlock()
    this.watchVisibility()
    this.stats.sampleRate = this.ctx.sampleRate
    this.stats.baseLatency = this.ctx.baseLatency ?? 0
    this.stats.outputLatency = this.ctx.outputLatency ?? 0
    this.stats.initMs = NOW() - t0
    this.ready = true
  }

  private buildGraph(): void {
    const ctx = this.ctx
    const t = tablesFor(ctx)

    this.safety = ctx.createWaveShaper()
    this.safety.curve = t.safetyClip()
    // 2x oversampling: the knee is smooth, but a hard transient still folds a
    // little energy above Nyquist. 2x is a good trade; 4x measurably costs more
    // than it buys here.
    this.safety.oversample = "2x"
    this.safety.connect(ctx.destination)

    // DynamicsCompressorNode is NOT a brickwall limiter — it has a ~6ms
    // lookahead and a soft knee, and it lets transients past threshold. It is
    // here to hold the MIX together (10 simultaneous sounds should sound
    // dense, not loud), and the waveshaper behind it is the actual ceiling.
    this.comp = ctx.createDynamicsCompressor()
    this.comp.threshold.value = -14
    this.comp.knee.value = 6
    this.comp.ratio.value = 6
    this.comp.attack.value = 0.004
    this.comp.release.value = 0.16
    this.comp.connect(this.safety)

    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : this.volume
    this.master.connect(this.comp)

    if (this.profile.reverbSeconds > 0) {
      const conv = ctx.createConvolver()
      conv.normalize = true
      conv.buffer = t.impulse("tile", this.profile.reverbSeconds)
      const ret = ctx.createGain()
      ret.gain.value = 0.9
      conv.connect(ret)
      ret.connect(this.master)
      this.reverbReturn = conv
    }

    const buses: BusName[] = ["sfx", "ui", "music", "ambience"]
    const defaults: Record<BusName, number> = { sfx: 1, ui: 0.85, music: 0.55, ambience: 0.4 }
    const sendDefaults: Record<BusName, number> = { sfx: 0.16, ui: 0.06, music: 0.1, ambience: 0.22 }
    for (const b of buses) {
      const duck = ctx.createGain()
      duck.gain.value = 1
      duck.connect(this.master)
      this.duckGain[b] = duck

      const g = ctx.createGain()
      g.gain.value = defaults[b]
      g.connect(duck)
      this.busGain[b] = g

      const s = ctx.createGain()
      s.gain.value = sendDefaults[b]
      if (this.reverbReturn) s.connect(this.reverbReturn)
      this.sendGain[b] = s
    }
  }

  // -------------------------------------------------------------------------
  // Unlock. The whole iOS/Chrome autoplay story, in one place.
  // -------------------------------------------------------------------------

  /**
   * Arm one-shot listeners that resume the context on the first real gesture.
   *
   * Details that matter:
   *  - `resume()` must be called SYNCHRONOUSLY inside the gesture handler. An
   *    `await` before it and the gesture is spent — the promise resolves and
   *    the context stays suspended.
   *  - iOS additionally wants a source to have STARTED inside a gesture in some
   *    versions; we start a 1-frame silent buffer, which is free and settles it.
   *  - `touchend` matters on iOS Safari; `pointerdown` alone is not enough on
   *    older WebKit.
   */
  armUnlock(): void {
    if (this.unlocked || this.unlockHandlers) return
    if (typeof document === "undefined") return
    const events = ["pointerdown", "touchend", "keydown", "mousedown"]
    const handler = () => {
      const ctx = this.ctx
      // Synchronous — never behind an await.
      void ctx.resume()
      try {
        const b = ctx.createBuffer(1, 1, ctx.sampleRate)
        const s = ctx.createBufferSource()
        s.buffer = b
        s.connect(ctx.destination)
        s.start(0)
      } catch {
        /* older WebKit throws on a 1-frame buffer; the resume above is enough */
      }
      if (ctx.state === "running" || ctx.state === "suspended") {
        // Verify asynchronously; only disarm once actually running.
        void Promise.resolve().then(() => {
          if (this.ctx.state === "running") this.disarmUnlock()
        })
      }
    }
    this.unlockHandlers = () => {
      for (const e of events) document.removeEventListener(e, handler, true)
    }
    for (const e of events) document.addEventListener(e, handler, true)
  }

  private disarmUnlock(): void {
    this.unlocked = true
    this.unlockHandlers?.()
    this.unlockHandlers = null
  }

  /** Call from a gesture if you are driving unlock yourself. */
  async resume(): Promise<void> {
    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume()
      } catch {
        /* the next gesture will do it */
      }
    }
    if (this.ctx.state === "running") this.disarmUnlock()
  }

  private watchVisibility(): void {
    if (typeof document === "undefined") return
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        void this.ctx.suspend()
      } else if (this.unlocked) {
        void this.ctx.resume()
      }
    })
  }

  // -------------------------------------------------------------------------
  // Mix control
  // -------------------------------------------------------------------------

  setVolume(v: number, ramp = 0.05): void {
    this.volume = clamp(v, 0, 1)
    if (!this.master) return
    const t = this.ctx.currentTime
    holdCurrent(this.master.gain, t)
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : this.volume, t + ramp)
  }

  setMuted(m: boolean): void {
    this.muted = m
    this.setVolume(this.volume)
  }

  setBusVolume(bus: BusName, v: number, ramp = 0.08): void {
    const g = this.busGain[bus]
    if (!g) return
    const t = this.ctx.currentTime
    holdCurrent(g.gain, t)
    g.gain.linearRampToValueAtTime(clamp(v, 0, 1), t + ramp)
  }

  /**
   * Duck music + ambience under a foreground event.
   *
   * Overlapping ducks do not stack (that is how you get a mix that pumps into
   * silence). We hold the DEEPEST active duck and one shared release.
   */
  duck(amount: number, holdSec = 0.25, releaseSec = 0.45): void {
    const now = this.ctx.currentTime
    const depth = clamp(amount, 0, 0.95)
    const until = now + holdSec
    if (now > this.duckUntil) this.duckDepth = 0
    this.duckDepth = Math.max(this.duckDepth * (this.duckUntil > now ? 1 : 0), depth)
    this.duckUntil = Math.max(this.duckUntil, until)
    const target = 1 - this.duckDepth
    for (const b of ["music", "ambience"] as BusName[]) {
      const g = this.duckGain[b]
      if (!g) continue
      holdCurrent(g.gain, now)
      g.gain.linearRampToValueAtTime(target, now + 0.03)
      g.gain.setValueAtTime(target, this.duckUntil)
      g.gain.setTargetAtTime(1, this.duckUntil, releaseSec / 3)
      g.gain.setValueAtTime(1, this.duckUntil + releaseSec)
    }
  }

  onCue(fn: (c: Cue) => void): () => void {
    this.cueHandlers.push(fn)
    return () => {
      const i = this.cueHandlers.indexOf(fn)
      if (i >= 0) this.cueHandlers.splice(i, 1)
    }
  }

  emitCue(c: Cue): void {
    for (let i = 0; i < this.cueHandlers.length; i++) this.cueHandlers[i](c)
  }

  // -------------------------------------------------------------------------
  // Voice budget
  // -------------------------------------------------------------------------

  private sweep(): void {
    const now = this.ctx.currentTime
    let w = 0
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i]
      if (v.endsAt > now) this.voices[w++] = v
    }
    this.voices.length = w
  }

  activeVoices(): number {
    this.sweep()
    return this.voices.length
  }

  /**
   * Decide whether a trigger is allowed and, if the budget is full, steal.
   *
   * Policy, in order:
   *  1. A preset retriggered inside its `minGap` is dropped. Two identical
   *     transients 8 ms apart do not sound "twice as good", they phase-sum into
   *     a 6 dB spike and read as a glitch.
   *  2. Over the preset's own polyphony, steal that preset's oldest voice.
   *  3. Over the global budget, steal the lowest-weight voice that is at least
   *     50 ms old — never the one that just started, because a cut-off attack
   *     is far more audible than a missing tail.
   *  4. If everything alive outranks the newcomer, drop the newcomer.
   */
  claim(preset: Preset, when: number, weight: number): boolean {
    const now = this.ctx.currentTime
    const gap = preset.minGap ?? 0.012
    const last = this.lastFired.get(preset.id) ?? -1
    if (when - last < gap) return false
    this.sweep()

    const group = preset.group ?? preset.id
    const poly = preset.poly ?? 6
    let count = 0
    let oldest: ActiveVoice | null = null
    for (const v of this.voices) {
      if (v.group !== group) continue
      count++
      if (!oldest || v.startedAt < oldest.startedAt) oldest = v
    }
    if (count >= poly && oldest) this.kill(oldest, now)

    if (this.voices.length >= this.profile.maxVoices) {
      let victim: ActiveVoice | null = null
      for (const v of this.voices) {
        if (now - v.startedAt < 0.05) continue
        if (!victim || v.weight < victim.weight) victim = v
      }
      if (!victim || victim.weight > weight) return false
      this.kill(victim, now)
    }
    this.lastFired.set(preset.id, when)
    return true
  }

  private kill(v: ActiveVoice, at: number): void {
    v.release?.(at)
    v.endsAt = Math.min(v.endsAt, at + 0.05)
    const i = this.voices.indexOf(v)
    if (i >= 0) this.voices.splice(i, 1)
  }

  track(preset: Preset, startedAt: number, endsAt: number, weight: number, release?: (at: number) => void): void {
    this.voices.push({
      id: preset.id,
      group: preset.group ?? preset.id,
      startedAt,
      endsAt,
      weight,
      release,
    })
  }

  /** Per-trigger deterministic RNG. Same seed -> same sound, always. */
  rngFor(preset: Preset, seed?: number): () => number {
    const s = seed ?? (hashString(preset.id) ^ (this.seq++ * 0x9e3779b9)) >>> 0
    return mulberry32(s)
  }

  variantFor(id: string, n: number, r: number): number {
    const last = this.lastVariant.get(id) ?? -1
    if (n <= 1) return 0
    let i = Math.floor(r * (n - 1))
    if (i >= last) i += 1
    this.lastVariant.set(id, i)
    return i
  }

  /** The modal bank for a bus, created on first use. */
  modalFor(bus: BusName): ModalBank | null {
    if (!this.worklandReady) return null
    let b = this.modalBanks.get(bus)
    if (b === undefined) {
      b = createModalBank(this.ctx)
      b?.node.connect(this.busGain[bus])
      this.modalBanks.set(bus, b)
    }
    return b
  }

  /** The string bank for a bus, created on first use. */
  stringsFor(bus: BusName): StringBank | null {
    if (!this.worklandReady) return null
    let b = this.stringBanks.get(bus)
    if (b === undefined) {
      b = createStringBank(this.ctx)
      b?.node.connect(this.busGain[bus])
      this.stringBanks.set(bus, b)
    }
    return b
  }

  /** Build the RenderCtx a preset receives. `out` is the voice's own gain node. */
  renderCtx(preset: Preset, opts: PlayOptions, when: number, semis: number, out?: AudioNode): RenderCtx {
    const rand = this.rngFor(preset, opts.seed)
    const bus = preset.bus
    return {
      ctx: this.ctx,
      out: out ?? this.busGain[bus],
      level: preset.gain,
      send: this.reverbReturn ? this.sendGain[bus] : null,
      when,
      intensity: clamp(opts.intensity ?? 0.7, 0, 1),
      semitones: semis,
      tier: this.tier,
      rand,
      range: (lo, hi) => lo + rand() * (hi - lo),
      tables: tablesFor(this.ctx),
      strings: this.stringsFor(bus),
      modal: this.modalFor(bus),
    }
  }

  /** Jitter in semitones, shaped so repeats never cluster at the centre. */
  jitter(preset: Preset, r: number): number {
    const c = preset.jitterCents ?? 30
    return (spread(r) * c) / 100
  }

  /** Stop everything immediately. Used on route changes and on `panic`. */
  panic(): void {
    for (const b of this.modalBanks.values()) (b?.node as AudioWorkletNode | undefined)?.port?.postMessage({ type: "panic" })
    for (const b of this.stringBanks.values()) (b?.node as AudioWorkletNode | undefined)?.port?.postMessage({ type: "panic" })
    const now = this.ctx.currentTime
    for (const v of [...this.voices]) this.kill(v, now)
    this.voices.length = 0
  }

  dispose(): void {
    if (this.sweeper) clearInterval(this.sweeper)
    this.sweeper = null
    this.unlockHandlers?.()
    for (const b of this.modalBanks.values()) b?.dispose()
    for (const b of this.stringBanks.values()) b?.dispose()
    this.cueHandlers.length = 0
    if (!this.opts.context) void this.ctx.close()
  }

  busNode(b: BusName): GainNode {
    return this.busGain[b]
  }
  sendNode(b: BusName): GainNode | null {
    return this.reverbReturn ? this.sendGain[b] : null
  }
}
