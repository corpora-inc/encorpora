// Thin resolver over @shared/data — extracted from the earthgate reader's
// data-load slice (game.ts initialize(): the preloaded-data branch and the
// fetch branch). Accepts a pack `baseUrl` OR preloaded JSON (the earthgate
// `initialState` precedent) — content selection stays with the consumer
// (capability-modules.md §2.2).
import type { AudioManifest, BookSegment, SegmentsData } from "@shared/core"
import {
  createFetchDataProvider,
  createPreloadedDataProvider,
  type DataProvider,
} from "@shared/data"

export type SegmentPlayerPreloaded = {
  segmentsData: unknown
  audioManifest: unknown
  /** NOTE: makes the SPEC non-cloneable; allowed for in-process mounts only. */
  resolveAssetUrl: (rel: string) => string
}

export type SegmentPlayerSource = {
  provider: DataProvider
  segments: BookSegment[]
  manifest: AudioManifest
}

export async function loadSegmentPlayerData(opts: {
  language: string
  baseUrl?: string
  preloaded?: SegmentPlayerPreloaded
}): Promise<SegmentPlayerSource> {
  if (opts.preloaded) {
    const raw = opts.preloaded.segmentsData as
      | SegmentsData
      | { segments: BookSegment[] }
    const segments = (raw as { segments: BookSegment[] }).segments ?? []
    const segmentsData: SegmentsData = {
      version: (raw as SegmentsData).version ?? "2.0.0",
      book_id: (raw as SegmentsData).book_id ?? "",
      total_segments:
        (raw as SegmentsData).total_segments ?? segments.length,
      segments,
    }
    const manifest = opts.preloaded.audioManifest as AudioManifest
    const provider = createPreloadedDataProvider(
      segmentsData,
      manifest,
      opts.preloaded.resolveAssetUrl,
    )
    return { provider, segments, manifest }
  }

  if (!opts.baseUrl) {
    throw new Error("segment-player: baseUrl or preloaded data is required")
  }
  const provider = createFetchDataProvider(opts.baseUrl.replace(/\/$/, ""))
  const segData = await provider.loadSegments(opts.language)
  const manifest = await provider.loadAudioManifest(opts.language)
  return { provider, segments: segData.segments, manifest }
}
