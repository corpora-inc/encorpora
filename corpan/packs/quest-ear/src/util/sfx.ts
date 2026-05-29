/**
 * Sound-effects layer for quest-ear. The pack is otherwise pure TTS, so this is
 * the first bundled-audio path. Modeled on hover-runner/src/audio.ts (WebAudio
 * context, iOS volume boost, lazy ensureContext, unlock on first gesture,
 * getQuestSfx() singleton).
 *
 * When a thrown phrase lands we play `playImpact()`: a synthesized low "thud"
 * for the physical punch, LAYERED with a short multilingual "let's go!" shout
 * (Jeff's voice-clone clips) for fun — sound is the weapon, so the King gets
 * yelled at in a different tongue every hit.
 *
 * The WAVs are 16-bit PCM (iOS-safe). If WebAudio is unavailable we fall back to
 * an HTMLAudioElement; if a clip hasn't decoded yet the synth thud still plays,
 * so the fight is always audible.
 */

import impact01 from "../assets/sfx/impact-01.wav"
import impact02 from "../assets/sfx/impact-02.wav"
import impact03 from "../assets/sfx/impact-03.wav"
import impact04 from "../assets/sfx/impact-04.wav"
import impact05 from "../assets/sfx/impact-05.wav"
import impact06 from "../assets/sfx/impact-06.wav"
import impact07 from "../assets/sfx/impact-07.wav"
import impact08 from "../assets/sfx/impact-08.wav"
import impact09 from "../assets/sfx/impact-09.wav"
import impact10 from "../assets/sfx/impact-10.wav"
import impact11 from "../assets/sfx/impact-11.wav"
import impact12 from "../assets/sfx/impact-12.wav"
import impact13 from "../assets/sfx/impact-13.wav"

const IMPACT_URLS = [
  impact01, impact02, impact03, impact04, impact05, impact06, impact07,
  impact08, impact09, impact10, impact11, impact12, impact13,
]

const isIOS =
  typeof navigator !== "undefined" && /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)
const IOS_VOLUME_BOOST = 1.5
const SFX_VOLUME = 0.6

export interface QuestSfx {
  /** Resume the audio context + preload clips on a user gesture (iOS autoplay). */
  unlock: () => void
  /** The sound-as-force impact when a thrown phrase lands. */
  playImpact: () => void
  dispose: () => void
}

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const createSfx = (): QuestSfx => {
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      : undefined
  let ctx: AudioContext | null = null
  let sfxGain: GainNode | null = null
  const buffers = new Map<string, AudioBuffer>()
  const bufferPromises = new Map<string, Promise<AudioBuffer>>()
  const htmlPool = new Map<string, HTMLAudioElement>()

  const ensureContext = (): AudioContext | null => {
    if (!AudioCtx) return null
    if (!ctx) {
      ctx = new AudioCtx()
      sfxGain = ctx.createGain()
      const vol = isIOS ? SFX_VOLUME * IOS_VOLUME_BOOST : SFX_VOLUME
      sfxGain.gain.value = Math.min(vol, 1)
      sfxGain.connect(ctx.destination)
    }
    return ctx
  }

  const ensureBuffer = (url: string) => {
    if (buffers.has(url) || bufferPromises.has(url)) return
    const context = ensureContext()
    if (!context) return
    const p = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buf) => {
        buffers.set(url, buf)
        bufferPromises.delete(url)
        return buf
      })
      .catch((err) => {
        bufferPromises.delete(url)
        throw err
      })
    bufferPromises.set(url, p)
  }

  /** Synthesized low "thud": sine sweep + a short noise transient. ~220 ms. */
  const playSynthThud = () => {
    const context = ensureContext()
    if (!context || !sfxGain) return
    const now = context.currentTime
    const dur = 0.22

    const env = context.createGain()
    env.gain.setValueAtTime(0.0001, now)
    env.gain.exponentialRampToValueAtTime(0.9, now + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    env.connect(sfxGain)

    const osc = context.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(55, now + dur)
    osc.connect(env)
    osc.start(now)
    osc.stop(now + dur)

    const noiseLen = Math.floor(context.sampleRate * 0.06)
    const noiseBuf = context.createBuffer(1, noiseLen, context.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
    const noise = context.createBufferSource()
    noise.buffer = noiseBuf
    const noiseGain = context.createGain()
    noiseGain.gain.setValueAtTime(0.35, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)
    noise.connect(noiseGain)
    noiseGain.connect(sfxGain)
    noise.start(now)
    noise.stop(now + 0.07)
  }

  const playClipWebAudio = (url: string): boolean => {
    const context = ensureContext()
    if (!context || !sfxGain) return false
    const buf = buffers.get(url)
    if (!buf) {
      ensureBuffer(url) // warm it for next time
      return false
    }
    const src = context.createBufferSource()
    src.buffer = buf
    src.connect(sfxGain)
    src.start()
    return true
  }

  const playClipHtml = (url: string) => {
    let a = htmlPool.get(url)
    if (!a) {
      a = new Audio(url)
      a.preload = "auto"
      a.volume = Math.min(isIOS ? SFX_VOLUME * IOS_VOLUME_BOOST : SFX_VOLUME, 1)
      htmlPool.set(url, a)
    }
    a.currentTime = 0
    void a.play().catch(() => {})
  }

  const unlock = () => {
    const context = ensureContext()
    if (context && context.state === "suspended") void context.resume()
    IMPACT_URLS.forEach((u) => ensureBuffer(u))
  }

  const playImpact = () => {
    try {
      // Physical punch — always.
      playSynthThud()
      // Multilingual "let's go!" shout layered on top, if we can.
      const url = pickRandom(IMPACT_URLS)
      if (!playClipWebAudio(url) && !ctx) playClipHtml(url)
    } catch {
      /* never let audio break the fight */
    }
  }

  const dispose = () => {
    htmlPool.forEach((a) => {
      a.pause()
      a.src = ""
    })
    htmlPool.clear()
    buffers.clear()
    bufferPromises.clear()
    if (ctx) void ctx.close().catch(() => {})
    ctx = null
    sfxGain = null
  }

  return { unlock, playImpact, dispose }
}

let cached: QuestSfx | null = null

export const getQuestSfx = (): QuestSfx => {
  if (!cached) cached = createSfx()
  return cached
}
