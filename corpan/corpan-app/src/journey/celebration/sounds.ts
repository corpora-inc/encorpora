// src/journey/celebration/sounds.ts — pentatonic chime family (feed-ux §1.5).
// Ascending notes keyed by combo depth; NEVER played while TTS is speaking
// (checked, dropped — not queued). Web Audio only, no assets.

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

function tone(freq: number, atSec: number, durSec: number, gainPeak: number): void {
  const ac = audioCtx()
  if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = "sine"
  osc.frequency.value = freq
  const t0 = ac.currentTime + atSec
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec)
  osc.connect(gain).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + durSec + 0.05)
}

/** Tier-0 correct chime; depth (combo) climbs the pentatonic ladder. */
export function playChime(depth = 0): void {
  if (ttsSpeaking()) return // drop, don't queue
  const i = Math.min(Math.max(depth, 0), PENTATONIC.length - 1)
  tone(PENTATONIC[i], 0, 0.28, 0.12)
}

/** Tier-1/2 flourish: two ascending notes. */
export function playFlourish(depth = 0): void {
  if (ttsSpeaking()) return
  const i = Math.min(Math.max(depth, 0), PENTATONIC.length - 2)
  tone(PENTATONIC[i], 0, 0.22, 0.11)
  tone(PENTATONIC[i + 1], 0.09, 0.3, 0.11)
}

/** Gentle low note for a first miss — no harsh buzz (feed-ux §3.3). */
export function playSoftMiss(): void {
  if (ttsSpeaking()) return
  tone(220, 0, 0.18, 0.05)
}
