import { detectPlatform } from "@/lib/getPlatform"

export type StorePlatform = "ios" | "android" | "mac"

export type LatestVersionResult = {
  platform: StorePlatform
  version: string
  storeUrl: string
}

const BUNDLE_ID = "com.corpora.corpan"

// Apple App Store ID for Corpán — drives the trackViewUrl fallback below.
const APPLE_TRACK_ID = "6746082061"

const APPLE_LOOKUP_URL =
  `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}`

// CDN-hosted manifest we control. Lives next to catalog-v2.json. Shape:
// { "android": { "version": "0.15.6", "url": "https://play.google.com/..." } }
// Missing entries are treated as "no update info" — we err on the side of
// NOT prompting, so a stale CDN file is harmless.
const CDN_APP_VERSION_URL =
  "https://d38iwc9748jekz.cloudfront.net/app-version.json"

const APPLE_STORE_FALLBACK =
  `https://apps.apple.com/app/id${APPLE_TRACK_ID}`
const PLAY_STORE_FALLBACK =
  `https://play.google.com/store/apps/details?id=${BUNDLE_ID}`

/** Public store listings — single source of truth (share links, etc.). */
export const APP_STORE_URL = APPLE_STORE_FALLBACK
export const PLAY_STORE_URL = PLAY_STORE_FALLBACK

type AppleLookupResponse = {
  results?: Array<{ version?: string; trackViewUrl?: string }>
}

type CdnAppVersion = {
  ios?: { version?: string; url?: string }
  android?: { version?: string; url?: string }
  mac?: { version?: string; url?: string }
}

async function fetchAppleLatest(): Promise<{
  version: string
  storeUrl: string
} | null> {
  try {
    // Cache-bust hourly — Apple's CDN caches lookup responses aggressively.
    const bust = Math.floor(Date.now() / (60 * 60 * 1000))
    const res = await fetch(`${APPLE_LOOKUP_URL}&_=${bust}`)
    if (!res.ok) return null
    const json = (await res.json()) as AppleLookupResponse
    const entry = json.results?.[0]
    if (!entry?.version) return null
    return {
      version: entry.version,
      storeUrl: entry.trackViewUrl ?? APPLE_STORE_FALLBACK,
    }
  } catch {
    return null
  }
}

async function fetchCdnLatest(): Promise<CdnAppVersion | null> {
  try {
    const bust = Math.floor(Date.now() / (60 * 60 * 1000))
    const res = await fetch(`${CDN_APP_VERSION_URL}?_=${bust}`)
    if (!res.ok) return null
    return (await res.json()) as CdnAppVersion
  } catch {
    return null
  }
}

export async function fetchLatestVersion(): Promise<LatestVersionResult | null> {
  const platform = await detectPlatform()

  if (platform === "ios" || platform === "mac") {
    const apple = await fetchAppleLatest()
    if (apple) {
      return { platform, version: apple.version, storeUrl: apple.storeUrl }
    }
    return null
  }

  if (platform === "android") {
    const cdn = await fetchCdnLatest()
    const entry = cdn?.android
    if (entry?.version) {
      return {
        platform,
        version: entry.version,
        storeUrl: entry.url ?? PLAY_STORE_FALLBACK,
      }
    }
    return null
  }

  // web / windows / linux / unknown — no in-app update prompt today.
  return null
}
