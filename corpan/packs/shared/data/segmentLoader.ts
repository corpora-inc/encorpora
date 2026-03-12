import type { SegmentsData, AudioManifest } from "../core/types"

/** Base URL for book data — overridable for dev vs production */
let dataBaseUrl = ""

export function setDataBaseUrl(url: string) {
  dataBaseUrl = url.replace(/\/$/, "")
}

/**
 * Load and parse segments.json from the book pack.
 */
export async function loadSegments(url?: string): Promise<SegmentsData> {
  const target = url || `${dataBaseUrl}/segments.json`
  const resp = await fetch(target)
  if (!resp.ok) {
    throw new Error(`Failed to load segments: ${resp.status} ${resp.statusText}`)
  }
  return resp.json()
}

/**
 * Load and parse audio_manifest_<lang>.json.
 */
export async function loadAudioManifest(
  language: string = "en",
  url?: string
): Promise<AudioManifest> {
  const target = url || `${dataBaseUrl}/audio_manifest_${language}.json`
  const resp = await fetch(target)
  if (!resp.ok) {
    throw new Error(`Failed to load audio manifest: ${resp.status} ${resp.statusText}`)
  }
  return resp.json()
}

/**
 * Resolve an audio file path from the manifest to a full URL.
 */
export function resolveAudioUrl(relativePath: string): string {
  return `${dataBaseUrl}/${relativePath}`
}
