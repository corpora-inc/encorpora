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
import type { RadioStation } from "./api/radioBrowser"

declare const __WORLD_RADIO_VERSION__: string

const ANALYTICS_ENDPOINT = "https://d1xp3xghrx3jfa.cloudfront.net/v1/events"
const READER_ID = "world_radio"

let initialized = false

export function initAnalytics(): void {
  if (initialized) return
  initialized = true
  analytics.init({
    readerId: READER_ID,
    readerVersion: __WORLD_RADIO_VERSION__,
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

/** User typed in the search box (debounced; fired with the final result count). */
export function trackSearchPerformed(corpanCode: string, query: string, resultCount: number): void {
  analytics.track("radio_search_performed", {
    language: corpanCode,
    query_length: query.length,
    result_count: resultCount,
  })
}

/** User changed sort order. */
export function trackSortChanged(corpanCode: string, sortKey: string): void {
  analytics.track("radio_sort_changed", {
    language: corpanCode,
    sort_key: sortKey,
  })
}

/** User toggled a tag chip. applied=true → narrowed; false → removed. */
export function trackTagFilter(corpanCode: string, tag: string, applied: boolean): void {
  analytics.track("radio_tag_filter", {
    language: corpanCode,
    tag: truncate(tag, 40),
    applied,
  })
}

/** User flipped to map view. marker_count = stations with valid geo coords. */
export function trackMapViewOpened(corpanCode: string, markerCount: number): void {
  analytics.track("radio_map_view_opened", {
    language: corpanCode,
    marker_count: markerCount,
  })
}

/** User pressed Play on a map popover (vs a list row). */
export function trackMarkerPlay(corpanCode: string, station: RadioStation): void {
  analytics.track("radio_marker_play", {
    language: corpanCode,
    station_uuid: station.stationuuid,
  })
}

/** User opened the global (top-level) world map. */
export function trackGlobalMapOpened(): void {
  analytics.track("radio_global_map_opened")
}

/** User changed the language filter on the global map. */
export function trackGlobalMapLanguageFilter(codes: string[]): void {
  analytics.track("radio_global_map_lang_filter", {
    languages: codes.slice(0, 12).join(","),
    count: codes.length,
  })
}

/** User toggled a tag chip on the global map. */
export function trackGlobalMapTagFilter(tag: string, applied: boolean): void {
  analytics.track("radio_global_map_tag_filter", {
    tag: truncate(tag, 40),
    applied,
  })
}

function truncate(s: string, max: number): string {
  if (!s) return ""
  return s.length > max ? s.slice(0, max) : s
}
