/**
 * beatlounge — the ribbon's OWN live performance voice.
 *
 * Self-contained: a Tone.MonoSynth built on the pack's shared AudioContext,
 * connected straight to the context destination. It is independent of any
 * track's instrument and of the audio graph — the ribbon owns it and disposes
 * it on unmount. Fretless gliding sets the frequency continuously (portamento);
 * fretted triggers snapped notes. Vertical expression maps to filter brightness
 * + level so the surface feels alive under the finger.
 */

import * as Tone from "tone"
import { midiToFreq } from "../../music/ribbonScales"

export type RibbonWave = "sine" | "sawtooth" | "triangle" | "square"

export interface RibbonVoice {
  /** Begin a note. `expr` 0..1 (vertical) shapes brightness + level. */
  noteOn(midi: number, expr: number): void
  /** Glide the live pitch (fretless) — frequency ramps via portamento. */
  glide(midi: number): void
  /** Hard-set the pitch immediately (fretted note crossing). */
  setPitch(midi: number): void
  /** Update vertical expression (brightness / level) while held. */
  setExpression(expr: number): void
  /** Release the note. */
  noteOff(): void
  /** Swap the oscillator waveform live. */
  setWave(wave: RibbonWave): void
  /** Set the portamento (glide) time in seconds — 0 ⇒ instant (fretted). */
  setGlide(seconds: number): void
  /** Free all audio nodes. */
  dispose(): void
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Build the voice over the shared AudioContext. We register the context with
 * Tone (idempotent) so Tone's nodes schedule against the same clock as the rest
 * of the pack, then route to its destination.
 */
export const createRibbonVoice = (
  ctx: AudioContext,
  wave: RibbonWave = "sawtooth",
  glideSeconds = 0.08
): RibbonVoice => {
  // Adopt the shared context so the voice shares one clock + destination.
  Tone.setContext(ctx)

  const out = new Tone.Gain(0.0)
  const synth = new Tone.MonoSynth({
    oscillator: { type: wave },
    // Portamento gives the fretless glide between frequencies.
    portamento: glideSeconds,
    envelope: { attack: 0.012, decay: 0.18, sustain: 0.85, release: 0.22 },
    filterEnvelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.7,
      release: 0.25,
      baseFrequency: 320,
      octaves: 4,
    },
  })
  synth.connect(out)
  out.connect(ctx.destination)

  let held = false

  /** Map vertical expression to a filter cutoff (darker low, brighter high). */
  const exprToCutoff = (expr: number): number => 420 + clamp01(expr) * 7200
  /** Map vertical expression to output level (quieter low, fuller high). */
  const exprToLevel = (expr: number): number => 0.18 + clamp01(expr) * 0.52

  const applyExpr = (expr: number) => {
    const now = Tone.now()
    synth.filter.frequency.cancelScheduledValues(now)
    synth.filter.frequency.setTargetAtTime(exprToCutoff(expr), now, 0.03)
    out.gain.cancelScheduledValues(now)
    out.gain.setTargetAtTime(exprToLevel(expr), now, 0.03)
  }

  return {
    noteOn(midi, expr) {
      const freq = midiToFreq(midi)
      applyExpr(expr)
      if (held) {
        // Re-attack only matters for fretted; for a continuous gesture we keep
        // the note held and just move the pitch.
        synth.setNote(freq)
      } else {
        synth.triggerAttack(freq, Tone.now())
        held = true
      }
    },
    glide(midi) {
      // setNote honors the synth's portamento → a smooth pitch ramp.
      synth.setNote(midiToFreq(midi))
    },
    setPitch(midi) {
      synth.frequency.cancelScheduledValues(Tone.now())
      synth.setNote(midiToFreq(midi))
    },
    setExpression(expr) {
      applyExpr(expr)
    },
    noteOff() {
      if (!held) return
      held = false
      synth.triggerRelease(Tone.now())
    },
    setWave(next) {
      synth.oscillator.type = next
    },
    setGlide(seconds) {
      synth.portamento = Math.max(0, seconds)
    },
    dispose() {
      try {
        synth.dispose()
        out.dispose()
      } catch {
        /* nodes may already be torn down — ignore */
      }
    },
  }
}
