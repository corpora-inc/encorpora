import type { SegmentsData, AudioManifest } from "../core/types"

export type DataProvider = {
  loadSegments: (language?: string) => Promise<SegmentsData>
  loadAudioManifest: (language: string) => Promise<AudioManifest>
  resolveAudioUrl: (relativePath: string) => string
  detectLanguages?: () => Promise<string[]>
}

/**
 * Create a DataProvider that fetches data via HTTP.
 * Used in dev mode (Vite dev server or dev:corpan HTTP server).
 */
export function createFetchDataProvider(baseUrl: string): DataProvider {
  const base = baseUrl.replace(/\/$/, "")

  return {
    async loadSegments(language?: string): Promise<SegmentsData> {
      const file = language && language !== "en" ? `segments_${language}.json` : "segments.json"
      const resp = await fetch(`${base}/${file}`)
      if (!resp.ok) {
        throw new Error(`Failed to load segments: ${resp.status} ${resp.statusText}`)
      }
      return resp.json()
    },

    async loadAudioManifest(language: string): Promise<AudioManifest> {
      const resp = await fetch(`${base}/audio_manifest_${language}.json`)
      if (!resp.ok) {
        throw new Error(`Failed to load audio manifest: ${resp.status} ${resp.statusText}`)
      }
      return resp.json()
    },

    resolveAudioUrl(relativePath: string): string {
      return `${base}/${relativePath}`
    },

    async detectLanguages(): Promise<string[]> {
      const catalogUrl = base.replace(/\/books\/[^/]+$/, "/catalog.json")
      const bookId = base.split("/").pop() || ""
      try {
        const resp = await fetch(catalogUrl)
        if (!resp.ok) return []
        const catalog = (await resp.json()) as { id: string; availableLanguages?: string[] }[]
        const entry = catalog.find((e) => e.id === bookId)
        return entry?.availableLanguages || []
      } catch {
        return []
      }
    },
  }
}

/**
 * Create a DataProvider from preloaded data (production — host provides JSON).
 * Falls back to fetch for language switching (loading new manifests).
 */
export function createPreloadedDataProvider(
  segments: SegmentsData,
  manifest: AudioManifest,
  resolveUrl: (path: string) => string
): DataProvider {
  return {
    async loadSegments(language?: string): Promise<SegmentsData> {
      // For the initially-provided language (or default), return preloaded segments
      if (!language || language === (manifest.language || "en")) {
        return segments
      }
      // For other languages, fetch via the host's URL resolver
      const file = language !== "en" ? `segments_${language}.json` : "segments.json"
      const url = resolveUrl(file)
      const resp = await fetch(url)
      if (!resp.ok) {
        throw new Error(`Failed to load segments for ${language}: ${resp.status}`)
      }
      return resp.json()
    },

    async loadAudioManifest(language: string): Promise<AudioManifest> {
      // For the initially-provided language, return the preloaded manifest
      if (language === manifest.language) {
        return manifest
      }
      // For other languages, fetch via the host's URL resolver
      const url = resolveUrl(`audio_manifest_${language}.json`)
      const resp = await fetch(url)
      if (!resp.ok) {
        throw new Error(`Failed to load audio manifest for ${language}: ${resp.status}`)
      }
      return resp.json()
    },

    resolveAudioUrl(relativePath: string): string {
      return resolveUrl(relativePath)
    },
  }
}
