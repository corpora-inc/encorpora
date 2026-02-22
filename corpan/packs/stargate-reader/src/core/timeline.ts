import type {
  AudioManifest,
  BookSegment,
  TimelineWord,
} from "./types"
import { MS_PER_Z_UNIT } from "./constants"

/**
 * Build a flat timeline of all words across all segments with absolute timestamps.
 *
 * Each segment's audio plays sequentially, with pause_after_ms gaps between them.
 * Words within each segment use the precomputed start_ms/end_ms from forced alignment,
 * offset by the segment's absolute start time.
 */
export function buildTimeline(
  segments: BookSegment[],
  manifest: AudioManifest
): {
  words: TimelineWord[]
  segmentStartTimes: Map<string, number>
  totalDurationMs: number
} {
  const words: TimelineWord[] = []
  const segmentStartTimes = new Map<string, number>()
  let cursor = 0

  for (const segment of segments) {
    const manifestEntry = manifest.segments[segment.id]
    if (!manifestEntry) continue

    segmentStartTimes.set(segment.id, cursor)

    for (let i = 0; i < manifestEntry.words.length; i++) {
      const w = manifestEntry.words[i]
      words.push({
        word: w.word,
        absoluteStartMs: cursor + w.start_ms,
        absoluteEndMs: cursor + w.end_ms,
        durationMs: w.end_ms - w.start_ms,
        segmentId: segment.id,
        wordIndex: i,
      })
    }

    cursor += manifestEntry.duration_ms + manifestEntry.pause_after_ms
  }

  return {
    words,
    segmentStartTimes,
    totalDurationMs: cursor,
  }
}

/**
 * Convert a word's absolute time to z-position relative to the "now" plane.
 *
 * Positive z = ahead (not yet spoken), negative z = behind (already spoken).
 * The "now" plane is at z=0.
 */
export function wordToZ(wordMidpointMs: number, currentPlaybackMs: number): number {
  return (wordMidpointMs - currentPlaybackMs) / MS_PER_Z_UNIT
}

/**
 * Get the z-depth (thickness) of a word based on its spoken duration.
 */
export function wordZDepth(durationMs: number): number {
  return durationMs / MS_PER_Z_UNIT
}

/**
 * Find the index of the word currently being spoken.
 * Returns -1 if no word is being spoken at this time.
 */
export function findCurrentWordIndex(
  words: TimelineWord[],
  currentMs: number,
  searchHint: number = 0
): number {
  // Start searching near the hint (last known position) for efficiency
  const start = Math.max(0, searchHint - 5)
  const end = Math.min(words.length, searchHint + 50)

  // Search near hint first
  for (let i = start; i < end; i++) {
    if (currentMs >= words[i].absoluteStartMs && currentMs <= words[i].absoluteEndMs) {
      return i
    }
  }

  // Fallback: binary search for the nearest word
  let lo = 0
  let hi = words.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (currentMs < words[mid].absoluteStartMs) {
      hi = mid - 1
    } else if (currentMs > words[mid].absoluteEndMs) {
      lo = mid + 1
    } else {
      return mid
    }
  }

  return -1
}

/**
 * Find the range of words visible in the viewport.
 * Returns [startIndex, endIndex) — words whose z-position falls within the view range.
 */
export function findVisibleRange(
  words: TimelineWord[],
  currentMs: number,
  lookAheadMs: number,
  lookBehindMs: number
): [number, number] {
  const minMs = currentMs - lookBehindMs
  const maxMs = currentMs + lookAheadMs

  // Binary search for start
  let lo = 0
  let hi = words.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    const wordEnd = words[mid].absoluteEndMs
    if (wordEnd < minMs) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  const startIdx = lo

  // Binary search for end
  lo = startIdx
  hi = words.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    const wordStart = words[mid].absoluteStartMs
    if (wordStart <= maxMs) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  const endIdx = lo

  return [startIdx, endIdx]
}

/**
 * Given current playback time, determine which segment index is active.
 */
export function findCurrentSegmentIndex(
  segments: BookSegment[],
  segmentStartTimes: Map<string, number>,
  _manifest: AudioManifest,
  currentMs: number
): number {
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    const startTime = segmentStartTimes.get(seg.id)
    if (startTime !== undefined && currentMs >= startTime) {
      return i
    }
  }
  return 0
}
