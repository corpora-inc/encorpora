import musicUrl from "./assets/sfx/luna.mp3"

// Affirmative sounds
import affirmBig1 from "./assets/sfx/affirmative-short-tight-big-1.mp3"
import affirmBig2 from "./assets/sfx/affirmative-short-tight-big-2.mp3"
import affirmBig3 from "./assets/sfx/affirmative-short-tight-big-3.mp3"

// Negative sounds
import nopeBig1 from "./assets/sfx/nope-short-tight-big-1.mp3"
import nopeBig2 from "./assets/sfx/nope-short-tight-big-2.mp3"
import nopeBig3 from "./assets/sfx/nope-short-tight-big-3.mp3"

const affirmativeSounds = [affirmBig1, affirmBig2, affirmBig3]
const negativeSounds = [nopeBig1, nopeBig2, nopeBig3]

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

type SfxHandle = {
  unlock: () => void
  setVolume: (volume: number) => void
  setSfxVolume: (volume: number) => void
  setMusicVolume: (volume: number) => void
  playSuccess: () => void
  playFail: () => void
  playMusic: () => void
  stopMusic: () => void
  isMusicPlaying: () => boolean
  dispose: () => void
}

type AudioPoolEntry = {
  url: string
  pool: HTMLAudioElement[]
}

const MAX_POOL = 4
export const DEFAULT_SFX_VOLUME = 0.5
export const DEFAULT_MUSIC_VOLUME = 0.3

// iOS Safari applies heavy volume limiting, boost to compensate
const isIOS = typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)
const IOS_VOLUME_BOOST = 1.5 // 50% boost for iOS

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const createHtmlAudio = (url: string, volume: number) => {
  const audio = new Audio(url)
  audio.preload = "auto"
  const boostedVolume = isIOS ? volume * IOS_VOLUME_BOOST : volume
  audio.volume = clamp(boostedVolume, 0, 1)
  return audio
}

const createPool = (url: string, volume: number): AudioPoolEntry => ({
  url,
  pool: [createHtmlAudio(url, volume)],
})

const getPoolAudio = (entry: AudioPoolEntry) => {
  const existing = entry.pool.find((audio) => audio.paused || audio.ended)
  if (existing) {
    existing.currentTime = 0
    return existing
  }
  if (entry.pool.length < MAX_POOL) {
    const next = createHtmlAudio(
      entry.url,
      entry.pool[0]?.volume ?? DEFAULT_SFX_VOLUME
    )
    entry.pool.push(next)
    return next
  }
  const fallback = entry.pool[0]
  fallback.currentTime = 0
  return fallback
}

const createSfxHandle = (): SfxHandle => {
  let sfxVolume = DEFAULT_SFX_VOLUME
  let musicVolume = DEFAULT_MUSIC_VOLUME

  // Store all possible sound URLs for preloading
  const allSoundUrls = [...affirmativeSounds, ...negativeSounds]

  const htmlPools = new Map<string, AudioPoolEntry>()
  const AudioCtx =
    typeof window !== "undefined"
      ? (window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext)
      : undefined
  let ctx: AudioContext | null = null
  let sfxGain: GainNode | null = null
  let musicGain: GainNode | null = null
  let musicSource: AudioBufferSourceNode | null = null
  let musicBuffer: AudioBuffer | null = null
  let musicBufferPromise: Promise<AudioBuffer> | null = null
  let musicPlaying = false
  const buffers = new Map<string, AudioBuffer>()
  const bufferPromises = new Map<string, Promise<AudioBuffer>>()

  const ensureContext = () => {
    if (!AudioCtx) {
      return null
    }
    if (!ctx) {
      ctx = new AudioCtx()
      // Create separate gain nodes for SFX and music
      sfxGain = ctx.createGain()
      const boostedSfxVolume = isIOS ? sfxVolume * IOS_VOLUME_BOOST : sfxVolume
      sfxGain.gain.value = Math.min(boostedSfxVolume, 1)
      sfxGain.connect(ctx.destination)

      musicGain = ctx.createGain()
      const boostedMusicVolume = isIOS ? musicVolume * IOS_VOLUME_BOOST : musicVolume
      musicGain.gain.value = Math.min(boostedMusicVolume, 1)
      musicGain.connect(ctx.destination)
    }
    return ctx
  }

  const ensureBuffer = (url: string) => {
    if (buffers.has(url) || bufferPromises.has(url)) {
      return
    }
    const context = ensureContext()
    if (!context) {
      return
    }
    const promise = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(url, buffer)
        bufferPromises.delete(url)
        return buffer
      })
      .catch(() => {
        bufferPromises.delete(url)
        throw new Error("Failed to decode audio")
      })
    bufferPromises.set(url, promise)
  }

  const playHtml = (url: string) => {
    let entry = htmlPools.get(url)
    if (!entry) {
      entry = createPool(url, sfxVolume)
      htmlPools.set(url, entry)
    }
    const audio = getPoolAudio(entry)
    void audio.play().catch(() => {})
  }

  const playWebAudio = (url: string) => {
    const context = ensureContext()
    if (!context || !sfxGain) {
      playHtml(url)
      return
    }
    const buffer = buffers.get(url)
    if (!buffer) {
      playHtml(url)
      return
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(sfxGain)
    source.start()
  }

  const ensureMusicBuffer = () => {
    if (musicBuffer || musicBufferPromise) {
      return
    }
    const context = ensureContext()
    if (!context) {
      return
    }
    musicBufferPromise = fetch(musicUrl)
      .then((res) => res.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        musicBuffer = buffer
        musicBufferPromise = null
        console.log("[Audio] Music buffer loaded")
        return buffer
      })
      .catch((err) => {
        musicBufferPromise = null
        console.error("[Audio] Failed to load music:", err)
        throw err
      })
  }

  const playMusic = () => {
    const context = ensureContext()
    if (!context || !musicGain) {
      console.warn("[Audio] Cannot play music: no audio context")
      return
    }
    if (musicPlaying) {
      return // Already playing
    }
    if (!musicBuffer) {
      // Buffer not loaded yet, try again after loading
      ensureMusicBuffer()
      if (musicBufferPromise) {
        musicBufferPromise.then(() => playMusic()).catch(() => {})
      }
      return
    }
    // Create new source for looped playback
    musicSource = context.createBufferSource()
    musicSource.buffer = musicBuffer
    musicSource.loop = true
    musicSource.connect(musicGain)
    musicSource.start()
    musicPlaying = true
    console.log("[Audio] Music started")
  }

  const stopMusic = () => {
    if (musicSource) {
      try {
        musicSource.stop()
      } catch {
        // Already stopped
      }
      musicSource.disconnect()
      musicSource = null
    }
    musicPlaying = false
    console.log("[Audio] Music stopped")
  }

  const isMusicPlaying = () => musicPlaying

  const unlock = () => {
    const context = ensureContext()
    if (!context) {
      return
    }
    if (context.state === "suspended") {
      void context.resume()
    }
    // Preload all sound buffers
    allSoundUrls.forEach((url) => ensureBuffer(url))
    ensureMusicBuffer()
  }

  const setSfxVolume = (next: number) => {
    sfxVolume = clamp(next, 0, 1)
    if (sfxGain) {
      const boostedVolume = isIOS ? sfxVolume * IOS_VOLUME_BOOST : sfxVolume
      sfxGain.gain.value = Math.min(boostedVolume, 1)
    }
    htmlPools.forEach((entry) => {
      entry.pool.forEach((audio) => {
        const boostedVolume = isIOS ? sfxVolume * IOS_VOLUME_BOOST : sfxVolume
        audio.volume = clamp(boostedVolume, 0, 1)
      })
    })
  }

  const setMusicVolume = (next: number) => {
    musicVolume = clamp(next, 0, 1)
    if (musicGain) {
      const boostedVolume = isIOS ? musicVolume * IOS_VOLUME_BOOST : musicVolume
      musicGain.gain.value = Math.min(boostedVolume, 1)
    }
  }

  // Legacy setVolume - sets both SFX and music
  const setVolume = (next: number) => {
    setSfxVolume(next)
    setMusicVolume(next)
  }

  const dispose = () => {
    stopMusic()
    htmlPools.forEach((entry) => {
      entry.pool.forEach((audio) => {
        audio.pause()
        audio.currentTime = 0
        audio.src = ""
      })
      entry.pool.length = 0
    })
    if (ctx) {
      void ctx.close().catch(() => {})
    }
    ctx = null
    sfxGain = null
    musicGain = null
    musicBuffer = null
    musicBufferPromise = null
    buffers.clear()
    bufferPromises.clear()
  }

  return {
    unlock,
    setVolume,
    setSfxVolume,
    setMusicVolume,
    playSuccess: () => {
      const soundUrl = pickRandom(affirmativeSounds)
      playWebAudio(soundUrl)
    },
    playFail: () => {
      const soundUrl = pickRandom(negativeSounds)
      playWebAudio(soundUrl)
    },
    playMusic,
    stopMusic,
    isMusicPlaying,
    dispose,
  }
}

let cached: SfxHandle | null = null

export const getSfx = () => {
  if (!cached) {
    cached = createSfxHandle()
  }
  return cached
}
