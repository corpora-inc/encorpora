/**
 * Corpán Book Audio Player
 * ========================
 * Plays pre-generated TTS audio for book segments.
 * Falls back to hostApi.speak() when audio files aren't available.
 *
 * Integration:
 *   import { BookAudioPlayer } from './book-audio-player'
 *   const player = new BookAudioPlayer(hostApi, '/audio/en/')
 *   await player.playSegment(segment)
 *   player.playAll(segments)  // autoplay entire chapter
 */

export interface BookSegment {
  id: string
  text: string
  language?: string
  tts?: {
    text: string
    pause_after_ms?: number
  }
}

export interface BookAudioConfig {
  /** Base path to audio files within the pack (e.g., 'audio/en/') */
  audioBasePath: string

  /** Language code for hostApi.speak() fallback */
  language: string

  /** Pause between segments in ms */
  pauseBetweenSegments: number

  /** Playback speed (1.0 = normal) */
  speed: number

  /** Callback when a segment starts playing */
  onSegmentStart?: (segmentId: string) => void

  /** Callback when a segment finishes playing */
  onSegmentEnd?: (segmentId: string) => void

  /** Callback when all segments finish */
  onPlaybackComplete?: () => void

  /** Callback on error */
  onError?: (segmentId: string, error: Error) => void
}

const DEFAULT_CONFIG: Partial<BookAudioConfig> = {
  pauseBetweenSegments: 800,
  speed: 1.0,
}

export class BookAudioPlayer {
  private hostApi: any
  private config: BookAudioConfig
  private audioCache: Map<string, HTMLAudioElement> = new Map()
  private isPlaying: boolean = false
  private isPaused: boolean = false
  private currentSegmentId: string | null = null
  private abortController: AbortController | null = null

  constructor(hostApi: any, config: Partial<BookAudioConfig> & { audioBasePath: string; language: string }) {
    this.hostApi = hostApi
    this.config = { ...DEFAULT_CONFIG, ...config } as BookAudioConfig
  }

  /**
   * Check if a pre-generated audio file exists for a segment.
   */
  private async hasAudioFile(segmentId: string): Promise<boolean> {
    const path = `${this.config.audioBasePath}${segmentId}.opus`
    try {
      const response = await fetch(path, { method: "HEAD" })
      return response.ok
    } catch {
      // Also try .wav fallback
      try {
        const wavResponse = await fetch(`${this.config.audioBasePath}${segmentId}.wav`, { method: "HEAD" })
        return wavResponse.ok
      } catch {
        return false
      }
    }
  }

  /**
   * Get or create an Audio element for a segment.
   */
  private async getAudio(segmentId: string): Promise<HTMLAudioElement | null> {
    if (this.audioCache.has(segmentId)) {
      return this.audioCache.get(segmentId)!
    }

    // Try opus first, then wav
    for (const ext of ["opus", "wav"]) {
      const path = `${this.config.audioBasePath}${segmentId}.${ext}`
      try {
        const response = await fetch(path, { method: "HEAD" })
        if (response.ok) {
          const audio = new Audio(path)
          audio.playbackRate = this.config.speed
          this.audioCache.set(segmentId, audio)
          return audio
        }
      } catch {
        continue
      }
    }

    return null
  }

  /**
   * Play a single segment — uses pre-generated audio if available,
   * falls back to hostApi.speak().
   */
  async playSegment(segment: BookSegment): Promise<void> {
    const segId = segment.id
    this.currentSegmentId = segId

    this.config.onSegmentStart?.(segId)

    const audio = await this.getAudio(segId)

    if (audio) {
      // Play pre-generated audio
      return new Promise<void>((resolve, reject) => {
        audio.currentTime = 0
        audio.playbackRate = this.config.speed

        audio.onended = () => {
          this.config.onSegmentEnd?.(segId)
          resolve()
        }

        audio.onerror = (e) => {
          const error = new Error(`Audio playback error for ${segId}`)
          this.config.onError?.(segId, error)
          // Fall back to hostApi.speak
          this.fallbackSpeak(segment).then(resolve).catch(reject)
        }

        audio.play().catch((e) => {
          // Autoplay blocked or other issue — fall back
          this.fallbackSpeak(segment).then(resolve).catch(reject)
        })
      })
    } else {
      // No pre-generated audio — use hostApi.speak()
      return this.fallbackSpeak(segment)
    }
  }

  /**
   * Fallback: use Corpán's built-in TTS.
   */
  private async fallbackSpeak(segment: BookSegment): Promise<void> {
    const text = segment.tts?.text || segment.text
    const language = segment.language || this.config.language

    if (typeof this.hostApi.speak === "function") {
      try {
        this.hostApi.speak(language, text)
        // hostApi.speak is fire-and-forget — estimate duration for pacing
        const estimatedMs = (text.split(" ").length / 2.5) * 1000
        await this.sleep(estimatedMs)
      } catch (error) {
        console.error(`[book-audio] hostApi.speak failed for ${segment.id}:`, error)
        this.config.onError?.(segment.id, error as Error)
      }
    } else {
      console.warn("[book-audio] hostApi.speak not available, skipping segment:", segment.id)
    }

    this.config.onSegmentEnd?.(segment.id)
  }

  /**
   * Play all segments sequentially (autoplay mode).
   */
  async playAll(segments: BookSegment[]): Promise<void> {
    this.isPlaying = true
    this.isPaused = false
    this.abortController = new AbortController()

    try {
      for (let i = 0; i < segments.length; i++) {
        if (this.abortController.signal.aborted) break

        // Wait while paused
        while (this.isPaused) {
          await this.sleep(100)
          if (this.abortController.signal.aborted) break
        }
        if (this.abortController.signal.aborted) break

        await this.playSegment(segments[i])

        // Pause between segments (unless it's the last one)
        if (i < segments.length - 1 && !this.abortController.signal.aborted) {
          const pauseMs = segments[i].tts?.pause_after_ms || this.config.pauseBetweenSegments
          await this.sleep(pauseMs)
        }
      }
    } finally {
      this.isPlaying = false
      this.currentSegmentId = null
      this.config.onPlaybackComplete?.()
    }
  }

  /**
   * Play from a specific segment onwards.
   */
  async playFrom(segments: BookSegment[], startSegmentId: string): Promise<void> {
    const startIdx = segments.findIndex((s) => s.id === startSegmentId)
    if (startIdx === -1) {
      console.warn(`[book-audio] Segment ${startSegmentId} not found`)
      return
    }
    return this.playAll(segments.slice(startIdx))
  }

  /** Pause playback */
  pause(): void {
    this.isPaused = true
    // Pause current audio element if playing
    if (this.currentSegmentId) {
      const audio = this.audioCache.get(this.currentSegmentId)
      if (audio && !audio.paused) {
        audio.pause()
      }
    }
  }

  /** Resume playback */
  resume(): void {
    this.isPaused = false
    if (this.currentSegmentId) {
      const audio = this.audioCache.get(this.currentSegmentId)
      if (audio && audio.paused) {
        audio.play()
      }
    }
  }

  /** Stop playback entirely */
  stop(): void {
    this.abortController?.abort()
    this.isPlaying = false
    this.isPaused = false
    if (this.currentSegmentId) {
      const audio = this.audioCache.get(this.currentSegmentId)
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    }
    this.currentSegmentId = null
  }

  /** Set playback speed */
  setSpeed(speed: number): void {
    this.config.speed = speed
    // Update current audio if playing
    if (this.currentSegmentId) {
      const audio = this.audioCache.get(this.currentSegmentId)
      if (audio) audio.playbackRate = speed
    }
  }

  /** Get current state */
  getState(): {
    isPlaying: boolean
    isPaused: boolean
    currentSegmentId: string | null
  } {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentSegmentId: this.currentSegmentId,
    }
  }

  /** Preload audio files for upcoming segments */
  async preload(segments: BookSegment[]): Promise<void> {
    for (const seg of segments) {
      await this.getAudio(seg.id)
    }
  }

  /** Clear the audio cache */
  clearCache(): void {
    for (const audio of this.audioCache.values()) {
      audio.pause()
      audio.src = ""
    }
    this.audioCache.clear()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
