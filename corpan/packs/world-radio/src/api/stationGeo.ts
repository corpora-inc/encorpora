/**
 * Resolve a placement coordinate for every radio station — real geo when
 * Radio Browser has it, country centroid + deterministic jitter otherwise.
 *
 * Jitter keeps a country's stations from stacking onto a single pixel: 200
 * Argentine stations would otherwise be a single marker at exactly the
 * centroid. We hash the stationuuid to a unit-square offset and scale it
 * to ~±1.0° lat/lon. That fans them into a small visible cloud at country
 * zoom while staying inside the country's footprint, and clusters absorb
 * them harmlessly at world zoom.
 */

import type { RadioStation } from "./radioBrowser"
import { centroidFor } from "./countryCentroids"

export type GeoSource = "real" | "centroid"

export type PlacedStation = RadioStation & {
  /** Resolved latitude used by the map (real geo or centroid+jitter). */
  _lat: number
  /** Resolved longitude used by the map. */
  _lon: number
  _geoSource: GeoSource
}

/** Max ±degrees of jitter applied to centroid placements. */
const JITTER_DEG = 1.0

/**
 * Cheap deterministic hash → two floats in [-1, 1]. Same uuid always yields
 * the same offset, so a station doesn't jump positions across reloads or
 * filter toggles.
 */
function jitterFromUuid(uuid: string): [number, number] {
  let h1 = 0x811c9dc5
  let h2 = 0xdeadbeef
  for (let i = 0; i < uuid.length; i++) {
    const c = uuid.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0
  }
  // Map two 32-bit ints into [-1, 1]
  const fx = (h1 / 0xffffffff) * 2 - 1
  const fy = (h2 / 0xffffffff) * 2 - 1
  return [fx, fy]
}

function hasRealGeo(s: RadioStation): boolean {
  return (
    typeof s.geo_lat === "number" &&
    typeof s.geo_long === "number" &&
    Number.isFinite(s.geo_lat) &&
    Number.isFinite(s.geo_long) &&
    Math.abs(s.geo_lat as number) <= 90 &&
    Math.abs(s.geo_long as number) <= 180 &&
    // Radio Browser sometimes has 0,0 placeholder rows — drop them.
    !(s.geo_lat === 0 && s.geo_long === 0)
  )
}

/**
 * Place a single station. Returns null if there's no real geo AND no
 * country centroid we can fall back to.
 */
export function placeStation(s: RadioStation): PlacedStation | null {
  if (hasRealGeo(s)) {
    return {
      ...s,
      _lat: s.geo_lat as number,
      _lon: s.geo_long as number,
      _geoSource: "real",
    }
  }
  const c = centroidFor(s.countrycode)
  if (!c) return null
  const [jx, jy] = jitterFromUuid(s.stationuuid)
  // Clamp to valid ranges in case the centroid is near a pole/antimeridian.
  const lat = Math.max(-90, Math.min(90, c[0] + jy * JITTER_DEG))
  let lon = c[1] + jx * JITTER_DEG
  if (lon > 180) lon -= 360
  if (lon < -180) lon += 360
  return { ...s, _lat: lat, _lon: lon, _geoSource: "centroid" }
}

/** Place every station, dropping ones with neither real geo nor a known country. */
export function placeStations(stations: RadioStation[]): PlacedStation[] {
  const out: PlacedStation[] = []
  for (const s of stations) {
    const p = placeStation(s)
    if (p) out.push(p)
  }
  return out
}
