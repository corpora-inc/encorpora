import affirmativeUrl from "./assets/sfx/affirmative.wav"
import nopeUrl from "./assets/sfx/nope.wav"
import musicUrl from "./assets/sfx/luna.mp3"

type SfxKey = "success" | "fail"

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
export const DEFAULT_SFX_VOLUME = 0.07
export const DEFAULT_MUSIC_VOLUME = 0.3

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const createHtmlAudio = (url: string, volume: number) => {
  const audio = new Audio(url)
  audio.preload = "auto"
  audio.volume = clamp(volume, 0, 1)
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
  const urls: Record<SfxKey, string> = {
    success: affirmativeUrl,
    fail: nopeUrl,
  }
  const htmlPools = new Map<SfxKey, AudioPoolEntry>([
    ["success", createPool(urls.success, sfxVolume)],
    ["fail", createPool(urls.fail, sfxVolume)],
  ])
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
  const buffers = new Map<SfxKey, AudioBuffer>()
  const bufferPromises = new Map<SfxKey, Promise<AudioBuffer>>()

  const ensureContext = () => {
    if (!AudioCtx) {
      return null
    }
    if (!ctx) {
      ctx = new AudioCtx()
      // Create separate gain nodes for SFX and music
      sfxGain = ctx.createGain()
      sfxGain.gain.value = sfxVolume
      sfxGain.connect(ctx.destination)

      musicGain = ctx.createGain()
      musicGain.gain.value = musicVolume
      musicGain.connect(ctx.destination)
    }
    return ctx
  }

  const ensureBuffer = (key: SfxKey) => {
    if (buffers.has(key) || bufferPromises.has(key)) {
      return
    }
    const context = ensureContext()
    if (!context) {
      return
    }
    const url = urls[key]
    const promise = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(key, buffer)
        bufferPromises.delete(key)
        return buffer
      })
      .catch(() => {
        bufferPromises.delete(key)
        throw new Error("Failed to decode audio")
      })
    bufferPromises.set(key, promise)
  }

  const playHtml = (key: SfxKey) => {
    const entry = htmlPools.get(key)
    if (!entry) {
      return
    }
    const audio = getPoolAudio(entry)
    void audio.play().catch(() => {})
  }

  const playWebAudio = (key: SfxKey) => {
    const context = ensureContext()
    if (!context || !sfxGain) {
      playHtml(key)
      return
    }
    const buffer = buffers.get(key)
    if (!buffer) {
      playHtml(key)
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
    ensureBuffer("success")
    ensureBuffer("fail")
    ensureMusicBuffer()
  }

  const setSfxVolume = (next: number) => {
    sfxVolume = clamp(next, 0, 1)
    if (sfxGain) {
      sfxGain.gain.value = sfxVolume
    }
    htmlPools.forEach((entry) => {
      entry.pool.forEach((audio) => {
        audio.volume = sfxVolume
      })
    })
  }

  const setMusicVolume = (next: number) => {
    musicVolume = clamp(next, 0, 1)
    if (musicGain) {
      musicGain.gain.value = musicVolume
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
    playSuccess: () => playWebAudio("success"),
    playFail: () => playWebAudio("fail"),
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
