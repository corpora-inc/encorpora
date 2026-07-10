// src/journey/celebration/sounds.ts — pentatonic chime family (feed-ux §1.5).
// Ascending notes keyed by combo depth; NEVER played while TTS is speaking
// (checked, dropped — not queued). Web Audio only, no assets.

import { fireHapticAmbient } from "./haptics.ts"

let ctx: AudioContext | null = null

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5] // C5 D5 E5 G5 A5 C6

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  return ctx
}

function ttsSpeaking(): boolean {
  try {
    return typeof speechSynthesis !== "undefined" && speechSynthesis.speaking
  } catch {
    return false
  }
}

// A struck-felt-mallet timbre: a warm sine fundamental + a quiet triangle
// harmonic that decays faster, so the chime has body without ringing like an
// arcade. `gainPeak` is the fundamental; the harmonic rides at a fraction.
function tone(freq: number, atSec: number, durSec: number, gainPeak: number): void {
  const ac = audioCtx()
  if (!ac) return
  const t0 = ac.currentTime + atSec
  const voice = (type: OscillatorType, f: number, peak: number, dur: number) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.value = f
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain).connect(ac.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }
  voice("sine", freq, gainPeak, durSec)
  // a soft octave harmonic that decays quickly = felt-mallet "strike" body
  voice("triangle", freq * 2, gainPeak * 0.22, durSec * 0.55)
}

/**
 * Map a combo depth to a rung on the pentatonic ladder. The pitch keeps
 * climbing past the base scale by shifting up octaves, so a long streak audibly
 * rises (combo-reactive) instead of plateauing at the top note.
 */
export function chimeRung(depth: number): number {
  const d = Math.max(0, Math.round(depth))
  const base = d % PENTATONIC.length
  const octave = Math.floor(d / PENTATONIC.length)
  // cap the climb at +2 octaves so it never gets shrill
  return PENTATONIC[base] * Math.pow(2, Math.min(octave, 2))
}

/** Tier-0 correct chime; depth (combo) climbs the pentatonic ladder + octaves. */
export function playChime(depth = 0): void {
  if (ttsSpeaking()) return // drop, don't queue
  tone(chimeRung(depth), 0, 0.28, 0.11)
}

/** Tier-1/2 flourish: two ascending notes, rising with the combo. */
export function playFlourish(depth = 0): void {
  if (ttsSpeaking()) return
  tone(chimeRung(depth), 0, 0.22, 0.1)
  tone(chimeRung(depth + 1), 0.09, 0.3, 0.1)
}

/** Gentle low note for a first miss — no harsh buzz (feed-ux §3.3). Also fires
 *  the soft `miss` haptic (once, never punishing), gated by the registered
 *  haptic gate so it honors reduced-motion + the sound/haptic setting. The
 *  haptic fires independently of the sound: a silent learner still feels the
 *  soft miss, and the TTS-speaking drop only suppresses the audio. */
export function playSoftMiss(): void {
  fireHapticAmbient("miss")
  if (ttsSpeaking()) return
  tone(220, 0, 0.18, 0.05)
}
