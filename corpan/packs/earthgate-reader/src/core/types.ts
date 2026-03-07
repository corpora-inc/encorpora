/** Word-level timestamp from forced alignment */
export type WordTimestamp = {
  word: string
  start_ms: number
  end_ms: number
}

/** Audio manifest entry for a single segment */
export type ManifestSegment = {
  file: string
  duration_ms: number
  pause_after_ms: number
  words: WordTimestamp[]
}

/** Full audio manifest from generate_audio.py */
export type AudioManifest = {
  language: string
  voice: string
  sample_rate: number
  segments: Record<string, ManifestSegment>
}

/** Segment from segments.json */
export type BookSegment = {
  id: string
  part: number
  chapter: number
  title: string
  text?: string
  type?: "image"
  image?: string
  image_alt?: string
  tts: {
    text: string
    pause_after_ms: number
  }
}

/** Parsed segments.json */
export type SegmentsData = {
  version: string
  book_id: string
  total_segments: number
  segments: BookSegment[]
}

/** A word positioned in the timeline with absolute timing */
export type TimelineWord = {
  word: string
  /** Absolute start time in the book playback (ms) */
  absoluteStartMs: number
  /** Absolute end time in the book playback (ms) */
  absoluteEndMs: number
  /** Duration of this word (ms) */
  durationMs: number
  /** Segment ID this word belongs to */
  segmentId: string
  /** Index within the segment's word list */
  wordIndex: number
}

/** Chapter info derived from segments */
export type ChapterInfo = {
  chapter: number
  title: string
  firstSegmentIndex: number
}

/** Book catalog entry for multi-book support */
export type BookCatalogEntry = {
  id: string
  name: string
  volume: number
  series: string
  hasAudio: boolean
  availableLanguages: string[]
}

/** Playback state */
export type PlaybackState = "stopped" | "playing" | "paused"

/** Reader state */
export type ReaderState = {
  playback: PlaybackState
  currentSegmentIndex: number
  currentTimeMs: number
  totalDurationMs: number
}
