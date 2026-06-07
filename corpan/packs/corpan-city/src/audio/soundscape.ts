/**
 * soundscape.ts — Corpan City's soul of sound. A self-contained WebAudio system
 * that gives the silent plaza a warm, subtle ambience, footsteps that track the
 * player's gait, tasteful juice SFX, and — the unfair strength — a helper to make
 * the NPC actually SPEAK the target language via the host TTS.
 *
 * DESIGN PRINCIPLES (CLAUDE.md: restraint over flash, no dark patterns):
 *   • Default ON but SUBTLE. A bad drone is worse than silence — err quiet.
 *   • Everything is synthesized; NO assets ship. The whole system is a handful of
 *     oscillators + filtered noise.
 *   • Autoplay is blocked: the AudioContext is created/resumed only from a user
 *     gesture (`resume()`), and every method is a safe no-op before that.
 *   • prefers-reduced-motion → calmer (quieter bed, no birdsong shimmer).
 *
 * THE AMBIENT BED (what actually plays, so a reviewer knows the intent):
 *   1. A warm low PAD: two slightly-detuned sine/triangle oscillators around
 *      ~110 Hz + a fifth, through a gentle lowpass, with a very slow LFO on the
 *      filter cutoff so it breathes. This is the "warmth", barely audible.
 *   2. A faint distant-town MURMUR: looping filtered brown-ish noise, heavily
 *      lowpassed (~500 Hz) at low gain — reads as "a town somewhere over there",
 *      never as static. Seamless because it's a long looping buffer.
 *   3. Sparse soft BIRDSONG: short pitched whistle chirps fired at random long
 *      intervals (8–22 s), panned, quiet. Sparse on purpose — birds you notice
 *      once in a while, never a loop. Suppressed under reduced-motion.
 *
 * The bed never hard-loops a sample you can "hear repeat": the pad/murmur are
 * continuous synth + long noise buffers; the only discrete events (birds) are
 * randomized, so there is no audible period.
 */

import {
  createStepClock,
  loadMuted,
  loadVolume,
  saveMuted,
  saveVolume,
  clamp01,
} from "./cadence"
import { noiseTap, playSfxInto, type SfxName } from "./sfx"

export interface SoundscapeOpts {
  /**
   * Honour prefers-reduced-motion as a hint toward a calmer bed (quieter pad, no
   * birdsong). Optional; defaults to reading the media query when omitted.
   */
  reducedMotion?: boolean
}

export interface Soundscape {
  /**
   * Create/resume the AudioContext. MUST be called from a user gesture (tap) the
   * first time — autoplay is blocked. Idempotent + safe to call repeatedly (e.g.
   * on every tap as a belt-and-suspenders resume).
   */
  resume: () => void
  /** Start the ambient city bed (pad + murmur + sparse birds). No-op until resumed. */
  startAmbient: () => void
  /** Stop the ambient bed (e.g. when a vignette/cutscene owns the audio). */
  stopAmbient: () => void
  /**
   * Per-frame locomotion driver. Pass the player's normalized walk speed (0..1,
   * the same `speed` the controller computes) each frame; this schedules soft
   * footstep taps at a cadence that scales with speed. No steps at rest.
   */
  onLocomotion: (speed: number, dt: number) => void
  /** Play a one-shot juice SFX. Safe no-op before `resume()`. */
  playSfx: (name: SfxName) => void
  /** Master mute. Persisted to localStorage (wp:audio:muted). */
  setMuted: (muted: boolean) => void
  /** Whether currently muted. */
  isMuted: () => boolean
  /** Master volume 0..1. Persisted to localStorage (wp:audio:volume). */
  setVolume: (v: number) => void
  /** Current master volume 0..1. */
  getVolume: () => number
  /** Tear everything down + close the AudioContext. */
  dispose: () => void
}

const SUBSCALE = 0.9 // headroom so the master never clips with the bed + an SFX

export function createSoundscape(opts: SoundscapeOpts = {}): Soundscape {
  const reducedMotion =
    opts.reducedMotion ??
    (typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) ??
    false

  let muted = loadMuted()
  let volume = loadVolume()

  let ctx: AudioContext | null = null
  let master: GainNode | null = null // master bus (volume + mute scaled)
  let ambientBus: GainNode | null = null // bed sub-bus, faded in/out independently
  let disposed = false

  // Long-lived ambient nodes (so stop/dispose can stop them).
  const ambientNodes: { stop?: () => void } = {}
  let birdTimer: ReturnType<typeof setTimeout> | null = null
  let ambientOn = false

  const stepClock = createStepClock()

  // ---- master gain math ----------------------------------------------------
  function applyMasterGain(): void {
    if (!master || !ctx) return
    const target = muted ? 0 : clamp01(volume) * SUBSCALE
    // Short ramp so toggles don't click.
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.03)
  }

  function ensureContext(): boolean {
    if (disposed) return false
    if (ctx) return true
    const AC =
      typeof window !== "undefined"
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined
    if (!AC) {
      console.warn("[wp/soundscape] WebAudio unavailable — running silent.")
      return false
    }
    try {
      ctx = new AC()
      master = ctx.createGain()
      master.connect(ctx.destination)
      ambientBus = ctx.createGain()
      ambientBus.gain.value = 0
      ambientBus.connect(master)
      applyMasterGain()
      return true
    } catch (e) {
      console.error("[wp/soundscape] failed to create AudioContext:", e)
      ctx = null
      return false
    }
  }

  const resume: Soundscape["resume"] = () => {
    if (!ensureContext() || !ctx) return
    if (ctx.state === "suspended") {
      ctx.resume().catch((e) => console.warn("[wp/soundscape] resume failed:", e))
    }
  }

  // ---- the ambient bed -----------------------------------------------------

  function buildPad(c: AudioContext, dest: AudioNode): () => void {
    // Two detuned voices + a fifth, lowpassed, with a slow filter LFO breathing.
    const base = 110 // A2
    const lp = c.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 420
    lp.Q.value = 0.4
    const padGain = c.createGain()
    padGain.gain.value = reducedMotion ? 0.05 : 0.075
    lp.connect(padGain).connect(dest)

    const oscs: OscillatorNode[] = []
    const voices: Array<{ freq: number; detune: number; type: OscillatorType; g: number }> = [
      { freq: base, detune: -4, type: "sine", g: 1 },
      { freq: base, detune: +5, type: "triangle", g: 0.6 },
      { freq: base * 1.5, detune: 0, type: "sine", g: 0.4 }, // a soft fifth
    ]
    for (const v of voices) {
      const o = c.createOscillator()
      o.type = v.type
      o.frequency.value = v.freq
      o.detune.value = v.detune
      const vg = c.createGain()
      vg.gain.value = v.g
      o.connect(vg).connect(lp)
      o.start()
      oscs.push(o)
    }

    // Slow LFO breathing the filter cutoff (skipped under reduced motion).
    let lfo: OscillatorNode | null = null
    let lfoGain: GainNode | null = null
    if (!reducedMotion) {
      lfo = c.createOscillator()
      lfo.frequency.value = 0.05 // ~20s period — barely perceptible drift
      lfoGain = c.createGain()
      lfoGain.gain.value = 120 // +/- Hz around the cutoff
      lfo.connect(lfoGain).connect(lp.frequency)
      lfo.start()
    }

    return () => {
      for (const o of oscs) {
        try {
          o.stop()
        } catch {
          /* already stopped */
        }
      }
      try {
        lfo?.stop()
      } catch {
        /* noop */
      }
    }
  }

  function buildMurmur(c: AudioContext, dest: AudioNode): () => void {
    // ~4s looping brown-ish noise, heavily lowpassed → a distant town hum.
    const seconds = 4
    const frames = c.sampleRate * seconds
    const buf = c.createBuffer(1, frames, c.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < frames; i++) {
      const white = Math.random() * 2 - 1
      // brown noise integrator → energy concentrated low, reads "distant"
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
    // Cross-fade the seam so the 4s loop is inaudible.
    const xf = Math.floor(c.sampleRate * 0.25)
    for (let i = 0; i < xf; i++) {
      const k = i / xf
      data[i] = data[i] * k + data[frames - xf + i] * (1 - k)
    }
    const src = c.createBufferSource()
    src.buffer = buf
    src.loop = true
    const lp = c.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 480
    const g = c.createGain()
    g.gain.value = 0.06
    src.connect(lp).connect(g).connect(dest)
    src.start()
    return () => {
      try {
        src.stop()
      } catch {
        /* noop */
      }
    }
  }

  function chirp(c: AudioContext, dest: AudioNode): void {
    // A short pitched whistle, 2–3 quick notes, gently panned. Quiet + sparse.
    const t0 = c.currentTime + 0.01
    const pan = c.createStereoPanner?.()
    const out: AudioNode = pan ?? dest
    if (pan) {
      pan.pan.value = Math.random() * 1.6 - 0.8
      pan.connect(dest)
    }
    const notes = 2 + Math.floor(Math.random() * 2)
    const baseHz = 2200 + Math.random() * 1400
    for (let n = 0; n < notes; n++) {
      const o = c.createOscillator()
      o.type = "sine"
      const f = baseHz * (1 + n * (0.06 + Math.random() * 0.05))
      const start = t0 + n * (0.07 + Math.random() * 0.04)
      o.frequency.setValueAtTime(f, start)
      o.frequency.exponentialRampToValueAtTime(f * 1.08, start + 0.05)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(0.035, start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.09)
      o.connect(g).connect(out)
      o.start(start)
      o.stop(start + 0.12)
    }
  }

  function scheduleNextBird(): void {
    if (reducedMotion) return // no birdsong shimmer under reduced motion
    const delay = 8000 + Math.random() * 14000 // 8–22s
    birdTimer = setTimeout(() => {
      if (ambientOn && ctx && ambientBus && ctx.state === "running") {
        try {
          chirp(ctx, ambientBus)
        } catch (e) {
          console.warn("[wp/soundscape] chirp failed:", e)
        }
      }
      scheduleNextBird()
    }, delay)
  }

  const startAmbient: Soundscape["startAmbient"] = () => {
    if (!ensureContext() || !ctx || !ambientBus) return
    if (ambientOn) return
    ambientOn = true
    resume()
    try {
      const stopPad = buildPad(ctx, ambientBus)
      const stopMurmur = buildMurmur(ctx, ambientBus)
      ambientNodes.stop = () => {
        stopPad()
        stopMurmur()
      }
    } catch (e) {
      console.error("[wp/soundscape] failed to build ambient bed:", e)
      ambientOn = false
      return
    }
    // Fade the bed in over ~2.5s so it arrives gently.
    ambientBus.gain.cancelScheduledValues(ctx.currentTime)
    ambientBus.gain.setValueAtTime(ambientBus.gain.value, ctx.currentTime)
    ambientBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5)
    scheduleNextBird()
  }

  const stopAmbient: Soundscape["stopAmbient"] = () => {
    if (!ambientOn) return
    ambientOn = false
    if (birdTimer) {
      clearTimeout(birdTimer)
      birdTimer = null
    }
    if (ctx && ambientBus) {
      // Fade out, then stop the long-lived nodes.
      const tEnd = ctx.currentTime + 0.8
      ambientBus.gain.cancelScheduledValues(ctx.currentTime)
      ambientBus.gain.setValueAtTime(ambientBus.gain.value, ctx.currentTime)
      ambientBus.gain.linearRampToValueAtTime(0, tEnd)
      const stop = ambientNodes.stop
      ambientNodes.stop = undefined
      setTimeout(() => stop?.(), 900)
    } else {
      ambientNodes.stop?.()
      ambientNodes.stop = undefined
    }
  }

  // ---- footsteps -----------------------------------------------------------

  const onLocomotion: Soundscape["onLocomotion"] = (speed, dt) => {
    if (muted || !ctx || !master || ctx.state !== "running") {
      // Keep the clock from accumulating a backlog while silent.
      if (!ctx || ctx.state !== "running") stepClock.reset()
      return
    }
    const steps = stepClock.tick(speed, dt)
    for (let i = 0; i < steps; i++) {
      // Soft, short filtered-noise tap; brisk walks slightly brighter + louder.
      const s = clamp01(speed)
      noiseTap(ctx, master, {
        cutoff: 700 + s * 500,
        gain: 0.05 + s * 0.05,
        dur: 0.05 + Math.random() * 0.02,
        // Tiny stagger between same-frame steps so they don't phase-stack.
        start: i * 0.04,
      })
    }
  }

  // ---- SFX -----------------------------------------------------------------

  const playSfx: Soundscape["playSfx"] = (name) => {
    if (muted || !ctx || !master || ctx.state !== "running") return
    try {
      playSfxInto(ctx, master, name)
    } catch (e) {
      console.warn(`[wp/soundscape] playSfx(${name}) failed:`, e)
    }
  }

  // ---- master controls -----------------------------------------------------

  const setMuted: Soundscape["setMuted"] = (m) => {
    muted = m
    saveMuted(m)
    applyMasterGain()
  }

  const setVolume: Soundscape["setVolume"] = (v) => {
    volume = clamp01(v)
    saveVolume(volume)
    applyMasterGain()
  }

  const dispose: Soundscape["dispose"] = () => {
    disposed = true
    if (birdTimer) {
      clearTimeout(birdTimer)
      birdTimer = null
    }
    ambientOn = false
    ambientNodes.stop?.()
    ambientNodes.stop = undefined
    if (ctx) {
      ctx.close().catch(() => {})
      ctx = null
    }
    master = null
    ambientBus = null
  }

  return {
    resume,
    startAmbient,
    stopAmbient,
    onLocomotion,
    playSfx,
    setMuted,
    isMuted: () => muted,
    setVolume,
    getVolume: () => volume,
    dispose,
  }
}

// ---------------------------------------------------------------------------
// THE CITY SPEAKS — host-TTS greeting helper (the single biggest missed
// strength). Ready-to-wire: the lead drops `speakNpcGreeting(...)` into the NPC
// engage path so you HEAR the target language the instant you walk up to someone.
// ---------------------------------------------------------------------------

/** The minimal host slice this helper needs (matches `npc/hostTypes.ts :: HostApi`). */
export interface SpeakingHost {
  speak: (uiCode: string, text: string) => Promise<void>
  speakVoice?: (uiCode: string, text: string, voiceId: string) => Promise<void>
  stopSpeech?: () => Promise<void>
}

/**
 * Speak a short TARGET-LANGUAGE greeting through the host TTS. This is the
 * "barista greets you in Spanish" moment. Fire-and-forget; never throws.
 *
 * @param host       the pack host (`npcHost` in game.ts) — provides `speak`.
 * @param targetLang BCP-47/ui code of the language being LEARNED (`learnerPair.target`).
 * @param text       the greeting in the target language (authored or from the corpus).
 * @param voiceId    optional sticky NPC voice id (uses `speakVoice` when the host
 *                   exposes it — see npcVoice.ts; otherwise language-only speak).
 *
 * NOTE: when the full NPC dialogue opens, `npcRuntime` already speaks the model/
 * scripted greeting via `voiceResolver.speak(...)`. Use THIS helper for the
 * immediate, deterministic "hello" at the moment of ENGAGE (before the model has
 * loaded/greeted), so the city always talks instantly — even with no LLM. Pass a
 * different/empty string (or skip) if you don't want a double-greet; see the
 * wiring note in the module that calls it.
 */
export async function speakNpcGreeting(
  host: SpeakingHost,
  targetLang: string,
  text: string,
  voiceId?: string,
): Promise<void> {
  const clean = (text ?? "").trim()
  if (!clean || !targetLang) return
  try {
    if (voiceId && host.speakVoice) {
      await host.speakVoice(targetLang, clean, voiceId)
    } else {
      await host.speak(targetLang, clean)
    }
  } catch (e) {
    console.warn("[wp/soundscape] speakNpcGreeting failed:", e)
  }
}
