/**
 * beatlounge — audition / preview a phrase fragment, ALWAYS through our own Web
 * Audio graph. NEVER calls the OS `speak()` (which ducks the music and never
 * restores). It renders the TTS to a buffer, decodes it, and plays a one-shot
 * BufferSource (pitch-shiftable via detune). If no real bytes exist yet it plays
 * a brief synth tone so audition is never silent — but never the OS speaker.
 */

import type { AudioSource } from "./audioSource"
import { decodeFragmentBytes } from "./decode"

export type AuditionResult = "audio" | "tone"

/** Play a decoded buffer as a one-shot, pitch-shifted, through `ctx.destination`. */
const playBuffer = (
  ctx: AudioContext,
  buffer: AudioBuffer,
  pitchSemis: number,
  gain: number
): void => {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  try {
    src.detune.value = Math.max(-2400, Math.min(2400, pitchSemis * 100))
  } catch {
    // Older WebKit: fall back to playbackRate for coarse pitch.
    src.playbackRate.value = Math.pow(2, pitchSemis / 12)
  }
  const g = ctx.createGain()
  g.gain.value = gain
  src.connect(g).connect(ctx.destination)
  src.onended = () => {
    src.disconnect()
    g.disconnect()
  }
  src.start()
}

/** A short vocal-ish synth tone (sine + a little vibrato), Web Audio only. */
const playTone = (ctx: AudioContext, pitchSemis: number, gain: number): void => {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = "sine"
  const base = 220 * Math.pow(2, pitchSemis / 12)
  osc.frequency.value = base
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(gain * 0.5, now + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  osc.connect(g).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.45)
  osc.onended = () => {
    osc.disconnect()
    g.disconnect()
  }
}

/**
 * Render (or read cached) audio for `text` and play it through Web Audio.
 * Returns whether real rendered AUDIO played, or the synth-tone fallback.
 */
export const auditionPhrase = async (
  ctx: AudioContext,
  audioSource: AudioSource,
  text: string,
  lang: string,
  opts: { voiceId?: string; pitchSemis?: number; gain?: number } = {}
): Promise<AuditionResult> => {
  const pitchSemis = opts.pitchSemis ?? 0
  const gain = opts.gain ?? 0.9
  if (ctx.state === "suspended") {
    try {
      await ctx.resume()
    } catch {
      /* needs a gesture; the caller is one */
    }
  }
  try {
    const resolved = await audioSource.resolveFragmentAudio(text, lang, opts.voiceId)
    if (resolved.audio && resolved.audio.bytes.byteLength > 0) {
      const buffer = await decodeFragmentBytes(ctx, resolved.audio)
      if (buffer) {
        playBuffer(ctx, buffer, pitchSemis, gain)
        return "audio"
      }
    }
  } catch (err) {
    console.warn("[beatlounge/audition] render failed; tone fallback:", err)
  }
  playTone(ctx, pitchSemis, gain)
  return "tone"
}
