/**
 * Thin wrapper around @shared/analytics for World Radio.
 *
 * Privacy + behavior come straight from the shared module:
 *   - In-memory session id, gone when the page closes.
 *   - localStorage opt-out flag (`corpan-analytics-disabled`).
 *   - Fire-and-forget; never throws.
 *
 * What we add here is the event vocabulary specific to live-radio listening.
 * Anything user-identifying (favicon URLs, IP, etc.) stays client-side.
 */

import * as analytics from "@shared/analytics"
import manifest from "../manifest.json"
import type { RadioStation } from "./api/radioBrowser"

const ANALYTICS_ENDPOINT = "https://d1xp3xghrx3jfa.cloudfront.net/v1/events"
const READER_ID = "world_radio"

let initialized = false

export function initAnalytics(): void {
  if (initialized) return
  initialized = true
  analytics.init({
    readerId: READER_ID,
    readerVersion: manifest.version,
    endpoint: ANALYTICS_ENDPOINT,
    enabled: ANALYTICS_ENDPOINT.length > 0,
  })
}

export function shutdownAnalytics(): void {
  analytics.shutdown()
  initialized = false
}

/** User opened the language browse view (e.g. on first mount or back-nav). */
export function trackBrowseOpened(): void {
  analytics.track("radio_browse_open")
}

/** User tapped into the station list for a language. */
export function trackLanguageBrowsed(corpanCode: string, radioName: string, stationCount: number): void {
  analytics.track("radio_language_browse", {
    language: corpanCode,
    radio_language: radioName,
    station_count: stationCount,
  })
}

/** A station started playing successfully. */
export function trackStationPlay(corpanCode: string, station: RadioStation): void {
  analytics.track("radio_station_play", {
    language: corpanCode,
    station_uuid: station.stationuuid,
    station_name: truncate(station.name, 80),
    country_code: station.countrycode || "",
    codec: station.codec || "",
    bitrate_kbps: station.bitrate || 0,
  })
}

/** A station stopped (user-stopped or replaced). duration_ms = how long it played. */
export function trackStationStop(corpanCode: string, station: RadioStation, durationMs: number): void {
  analytics.track("radio_station_stop", {
    language: corpanCode,
    station_uuid: station.stationuuid,
    duration_ms: Math.max(0, Math.round(durationMs)),
  })
}

/** Stream errored (network, decode, etc.). */
export function trackStationError(corpanCode: string, station: RadioStation, message: string): void {
  analytics.track("radio_station_error", {
    language: corpanCode,
    station_uuid: station.stationuuid,
    codec: station.codec || "",
    error_message: truncate(message, 200),
  })
}

/** User toggled a favorite. `added=true` means added; false means removed. */
export function trackFavoriteToggled(corpanCode: string, station: RadioStation, added: boolean): void {
  analytics.track("radio_favorite_toggled", {
    language: corpanCode,
    station_uuid: station.stationuuid,
    added,
  })
}

function truncate(s: string, max: number): string {
  if (!s) return ""
  return s.length > max ? s.slice(0, max) : s
}
