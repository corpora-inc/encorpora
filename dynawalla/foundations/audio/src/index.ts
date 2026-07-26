/**
 * @dynawalla/audio — the whole kit, in one object.
 *
 * The entire API a prototype needs:
 *
 *     import { audio } from "@dynawalla/audio"
 *
 *     await audio.init()            // once, anywhere; unlock is automatic
 *     audio.play("ui.chunk")        // a sound
 *     audio.combo(streak)           // a rising ladder that stays musical
 *     audio.music.setIntensity(0.7) // the score responds
 *     audio.ambience("bazaar")      // the place
 *     audio.onCue(c => flash(c))    // visuals, so sound is never the only channel
 *
 * That is the deliverable. Everything below exists so those six lines are
 * always correct: on iOS, on a silenced phone, on a cheap tablet, with audio
 * turned off, at 60 fps, after ten thousand taps.
 */

import { AudioEngine, TIERS, probeTier, type EngineOptions, type TierProfile } from "./engine.ts"
import { tablesFor } from "./dsp/tables.ts"
import { Ambience, type AmbienceId } from "./music/ambience.ts"
import { ProceduralMusic } from "./music/music.ts"
import { ALL_PRESETS, HIJAZ, type PresetId } from "./presets/library.ts"
import { holdCurrent } from "./dsp/env.ts"
import { clamp } from "./rng.ts"
import type { BusName, Cue, PlayOptions, Preset, Tier } from "./types.ts"

export * from "./types.ts"
export { MATERIALS, expandMaterial } from "./dsp/materials.ts"
export { ALL_PRESETS, HIJAZ, PENTA, ROOT_HZ } from "./presets/library.ts"
export type { PresetId } from "./presets/library.ts"
export { AudioEngine, TIERS, probeTier } from "./engine.ts"
export type { AmbienceId } from "./music/ambience.ts"

export interface AudioKitOptions extends EngineOptions {
  /** Extra presets on top of the built-in library. */
  presets?: Preset[]
  /** Start with audio switched off (still emits cues). */
  enabled?: boolean
}

export class AudioKit {
  private engine: AudioEngine
  private presets = new Map<string, Preset>()
  private _music: ProceduralMusic | null = null
  private _ambience: Ambience | null = null
  private comboStep = 0
  private enabled: boolean

  constructor(options: AudioKitOptions = {}) {
    this.engine = new AudioEngine(options)
    for (const p of ALL_PRESETS) this.presets.set(p.id, p)
    for (const p of options.presets ?? []) this.presets.set(p.id, p)
    this.enabled = options.enabled ?? true
  }

  /**
   * Build everything. Safe to call from anywhere (it does NOT need a gesture);
   * the context stays suspended until the first tap, which `armUnlock` handles.
   */
  async init(): Promise<AudioKit> {
    await this.engine.init()
    if (!this.enabled) this.engine.setMuted(true)
    await this.warm()
    return this
  }

  /**
   * Music and ambience are built on FIRST USE, not at init.
   *
   * Each one needs its own polyphonic worklet banks (so it can be ducked and
   * faded independently of SFX), and an idle bank measured ~0.33% of a core
   * just for existing. A prototype that never plays music should never pay for
   * a music bank.
   */
  private musicEngine(): ProceduralMusic | null {
    if (!this.engine.ready) return null
    if (!this._music) {
      const e = this.engine
      this._music = new ProceduralMusic({
        ctx: e.ctx,
        out: e.busNode("music"),
        send: e.sendNode("music"),
        tables: tablesFor(e.ctx),
        strings: e.stringsFor("music"),
        modal: e.modalFor("music"),
        tier: e.tier,
        maxLayers: e.profile.musicLayers,
      })
    }
    return this._music
  }

  private ambienceEngine(): Ambience | null {
    if (!this.engine.ready) return null
    if (!this._ambience) {
      const e = this.engine
      this._ambience = new Ambience({
        ctx: e.ctx,
        out: e.busNode("ambience"),
        send: e.sendNode("ambience"),
        tables: tablesFor(e.ctx),
        modal: e.modalFor("ambience"),
        tier: e.tier,
      })
    }
    return this._ambience
  }

  /**
   * Force every preset through its code path once, silently and off the audio
   * thread, so nothing JITs during play.
   *
   * MEASURED: the first `play()` of a given preset costs up to ~200 us on the
   * main thread (V8 compiling the render function and touching each node
   * constructor for the first time); steady state is 6-11 us. 200 us is not a
   * dropped frame on its own, but a screen transition that fires six new
   * presets at once is over a millisecond of jank at exactly the moment the
   * player is watching. This removes it.
   *
   * The warm pass runs in an OfflineAudioContext, so it costs NOTHING on the
   * real-time audio thread — it is pure main-thread JIT priming, ~20 ms once.
   */
  async warm(): Promise<number> {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now()
    const OAC = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext
    if (!OAC) return 0
    try {
      const oc = new OAC(1, 2048, 48000)
      const bus = oc.createGain()
      bus.gain.value = 0
      bus.connect(oc.destination)
      const tables = tablesFor(oc)
      const rand = (): number => 0.5
      for (const p of this.presets.values()) {
        try {
          p.render({
            ctx: oc,
            out: bus,
            send: null,
            when: 0.01,
            level: p.gain,
            intensity: 0.7,
            semitones: 0,
            tier: this.engine.tier,
            rand,
            range: (lo, hi) => (lo + hi) / 2,
            tables,
            // No banks: the worklet path is a postMessage, which has no JIT
            // cost worth priming, and an offline bank would need its own module.
            strings: null,
            modal: null,
          })
        } catch {
          /* a preset that cannot render offline is still fine live */
        }
      }
    } catch {
      /* warming is an optimisation, never a requirement */
    }
    return (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0
  }

  // -------------------------------------------------------------------------

  /**
   * Play a preset. Returns the Cue that was emitted, so a caller can drive a
   * visual from the same call:
   *
   *     const cue = audio.play("impact.brass", { intensity: 0.9 })
   *     shake(cue.weight)
   */
  play(id: PresetId | string, opts: PlayOptions = {}): Cue {
    const preset = this.presets.get(id)
    if (!preset) {
      // A typo must be loud in development and silent in production, never a
      // crash mid-play. This is the one place the kit logs.
      if (typeof console !== "undefined") console.warn(`[audio] unknown preset "${id}"`)
      return { id, when: 0, intensity: 0, semitones: 0, haptic: "none", weight: 0, silent: true }
    }
    const e = this.engine
    const ctx = e.ctx
    // Schedule a hair ahead so the attack always lands on a clean block
    // boundary. Triggering at exactly currentTime means the first few samples
    // of the envelope are already in the past and the attack is clipped —
    // which is heard as an inconsistent, slightly "spitty" transient.
    const when = ctx.currentTime + 0.004 + (opts.delay ?? 0)
    const rand = e.rngFor(preset, opts.seed)
    const semitones = (opts.semitones ?? 0) + e.jitter(preset, rand())
    const intensity = clamp(opts.intensity ?? 0.7, 0, 1)
    const weight = (preset.weight ?? 0.4) * (0.5 + intensity * 0.5)

    const audible = this.enabled && !e.muted && e.ready
    let silent = !audible
    if (audible) {
      if (!e.claim(preset, when, weight)) {
        silent = true
      } else {
        // ONE gain node per voice. It carries the preset's own level (so the
        // library can be loudness-matched without every preset re-deriving its
        // gains), and — the part that actually matters — it gives the voice
        // stealer something to FADE. Without it, `kill()` can only forget a
        // voice, not silence it, so a stolen sound keeps ringing and the
        // polyphony cap does nothing audible.
        const voice = ctx.createGain()
        voice.gain.value = preset.gain
        voice.connect(e.busNode(preset.bus))
        const rc = e.renderCtx(preset, { ...opts, intensity }, when, semitones, voice)
        const res = preset.render(rc)
        const release = (at: number): void => {
          // 25 ms is short enough to free the budget immediately and long
          // enough that the cut is a duck, not a click.
          holdCurrent(voice.gain, at)
          voice.gain.linearRampToValueAtTime(0, at + 0.025)
          res.release?.(at)
        }
        e.track(preset, when, res.endsAt, weight, release)
        const duck = opts.duck ?? preset.duck ?? 0
        if (duck > 0) e.duck(duck, 0.18 + duck * 0.4)
      }
    }

    const cue: Cue = {
      id: preset.id,
      when,
      intensity,
      semitones,
      haptic: preset.haptic ?? "none",
      weight,
      silent,
    }
    e.emitCue(cue)
    return cue
  }

  /**
   * The combo ladder.
   *
   * Pass the streak length; the kit owns the musicality. Steps walk up Hijaz,
   * then keep climbing by octave while ALSO adding low weight, so a long streak
   * gets more exciting instead of just more shrill. Reset with `resetCombo()`
   * or by passing 0.
   *
   * This is a kit-level function on purpose: every prototype needs it, and
   * every prototype that rolls its own gets it wrong in the same way (linear
   * semitones, which runs out of ear before it runs out of streak).
   */
  combo(streak?: number, opts: PlayOptions = {}): Cue {
    if (streak === 0) {
      this.comboStep = 0
      return this.play("combo", { ...opts, intensity: 0.2 })
    }
    const n = streak ?? ++this.comboStep
    this.comboStep = n
    const idx = Math.max(0, n - 1)
    // Walk the scale; above one octave keep climbing but compress, so step 30
    // is still inside the range a small speaker reproduces.
    const within = idx % HIJAZ.length
    const octaves = Math.floor(idx / HIJAZ.length)
    const semis = HIJAZ[within] + Math.min(2, octaves) * 12 + Math.max(0, octaves - 2) * 2
    return this.play("combo", {
      ...opts,
      semitones: (opts.semitones ?? 0) + semis,
      intensity: opts.intensity ?? clamp(0.3 + idx * 0.055, 0, 1),
    })
  }

  resetCombo(): void {
    this.comboStep = 0
  }

  // -------------------------------------------------------------------------

  get music(): {
    start(): void
    stop(fade?: number): void
    setIntensity(v: number, glide?: number): void
  } {
    return {
      start: () => this.musicEngine()?.start(),
      stop: (fade?: number) => this._music?.stop(fade),
      setIntensity: (v: number, glide?: number) => this.musicEngine()?.setIntensity(v, glide),
    }
  }

  /** Crossfade the ambient bed. `null` fades everything out. */
  ambience(id: AmbienceId | null, fade = 1.6): void {
    if (id === null) this._ambience?.set(null, fade)
    else this.ambienceEngine()?.set(id, fade)
  }

  /** Duck music + ambience manually (e.g. under a spoken line). */
  duck(amount: number, hold = 0.3): void {
    this.engine.duck(amount, hold)
  }

  onCue(fn: (c: Cue) => void): () => void {
    return this.engine.onCue(fn)
  }

  /**
   * The audio on/off switch a settings screen binds to.
   *
   * Disabling STOPS sound but keeps cues flowing, so anything wired to `onCue`
   * (flashes, shakes, haptics) keeps working. That is the rule: audio may
   * never be the only channel carrying information.
   */
  setEnabled(on: boolean): void {
    this.enabled = on
    this.engine.setMuted(!on)
    if (!on) {
      this._music?.stop(0.4)
      this._ambience?.set(null, 0.4)
      this.engine.panic()
    }
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  setVolume(v: number): void {
    this.engine.setVolume(v)
  }
  setBusVolume(bus: BusName, v: number): void {
    this.engine.setBusVolume(bus, v)
  }

  /** Call from a gesture handler if `autoUnlock:false`. */
  resume(): Promise<void> {
    return this.engine.resume()
  }

  panic(): void {
    this.engine.panic()
  }

  get tier(): Tier {
    return this.engine.tier
  }
  get profile(): TierProfile {
    return this.engine.profile
  }
  get stats(): AudioEngine["stats"] & { activeVoices: number; worklets: boolean } {
    return {
      ...this.engine.stats,
      activeVoices: this.engine.activeVoices(),
      worklets: this.engine.workletStatus.ok,
    }
  }
  get ctx(): AudioContext {
    return this.engine.ctx
  }
  /** Escape hatch for a prototype that wants to build its own voices on the bus. */
  bus(b: BusName): AudioNode {
    return this.engine.busNode(b)
  }
  presetIds(): string[] {
    return [...this.presets.keys()]
  }

  dispose(): void {
    this._music?.dispose()
    this._ambience?.dispose()
    this.engine.dispose()
  }
}

export const createAudio = (opts: AudioKitOptions = {}): AudioKit => new AudioKit(opts)

let singleton: AudioKit | null = null

/**
 * The default kit. Lazily constructed so importing this module never touches
 * the audio hardware (which matters: constructing an AudioContext at import
 * time on iOS starts an audio session before the user has asked for anything).
 */
export const audio: AudioKit = new Proxy({} as AudioKit, {
  get(_t, prop: string | symbol) {
    singleton ??= new AudioKit()
    const v = (singleton as unknown as Record<string | symbol, unknown>)[prop]
    return typeof v === "function" ? v.bind(singleton) : v
  },
  set(_t, prop: string | symbol, value: unknown) {
    singleton ??= new AudioKit()
    ;(singleton as unknown as Record<string | symbol, unknown>)[prop] = value
    return true
  },
})

export { TIERS as TIER_PROFILES, probeTier as probeAudioTier }
