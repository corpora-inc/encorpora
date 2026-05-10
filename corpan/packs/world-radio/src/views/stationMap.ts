/**
 * Leaflet-backed map view for one language.
 *
 * Lazy-imported from stationList — Leaflet + markercluster + their CSS only
 * load when a user actually flips to map view. Tiles come from CARTO
 * Basemaps (free, no API key, no User-Agent requirement).
 *
 * Markers and popups are styled to match the rest of the pack via CSS in
 * `styles.css` — see the `.wr-marker`, `.wr-cluster`, `.wr-pop`, and
 * `.leaflet-*` overrides there.
 */

import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet.markercluster"
import "leaflet.markercluster/dist/MarkerCluster.css"
import type { RadioStation } from "../api/radioBrowser"
import type { PlacedStation } from "../api/stationGeo"
import { el, clear } from "../ui/dom"
import { createStationArt } from "../ui/stationArt"
import { countryCodeToFlag } from "../ui/flagEmoji"
import { ICON_PLAY } from "../ui/icons"

/**
 * A station the map can render. Either a raw `RadioStation` (which must
 * have `geo_lat`/`geo_long`) or a `PlacedStation` whose resolved coords
 * already live on `_lat`/`_lon`.
 */
type MapStation = RadioStation | PlacedStation

function coordsFor(s: MapStation): [number, number] | null {
  const placed = s as PlacedStation
  if (
    typeof placed._lat === "number" &&
    typeof placed._lon === "number" &&
    Number.isFinite(placed._lat) &&
    Number.isFinite(placed._lon) &&
    Math.abs(placed._lat) <= 90 &&
    Math.abs(placed._lon) <= 180
  ) {
    return [placed._lat, placed._lon]
  }
  if (
    typeof s.geo_lat === "number" &&
    typeof s.geo_long === "number" &&
    Number.isFinite(s.geo_lat) &&
    Number.isFinite(s.geo_long) &&
    Math.abs(s.geo_lat) <= 90 &&
    Math.abs(s.geo_long) <= 180 &&
    !(s.geo_lat === 0 && s.geo_long === 0)
  ) {
    return [s.geo_lat, s.geo_long]
  }
  return null
}

const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
const TILE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a> contributors · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'

export type StationMap = {
  setActiveUuid: (uuid: string | null) => void
  /** Pan/zoom to the station's coordinates and open its popup. */
  focusStation: (uuid: string) => void
  /**
   * Replace the rendered marker set without tearing down the map / tile
   * layer. Used by the global map when filters change so the user keeps
   * their current pan/zoom.
   */
  setStations: (stations: MapStation[]) => void
  dispose: () => void
}

export function createStationMap(opts: {
  container: HTMLElement
  stations: MapStation[]
  activeUuid: string | null
  onPlay: (station: RadioStation) => void
  onShowInList: (station: RadioStation) => void
  /**
   * Cluster radius — defaults to 36 (per-language). Global map bumps this
   * to 60 so the world view doesn't render a wall of overlapping clusters.
   */
  maxClusterRadius?: number
  /**
   * Stream marker insertion in chunks instead of inserting all at once.
   * markercluster's recommended switch for >5k markers — keeps the UI
   * responsive while building the cluster index.
   */
  chunkedLoading?: boolean
  /**
   * If "world", start at zoom 2 centered on [20, 0] without auto-fitting.
   * Default "fit" zooms to bounds (good for one country / one language).
   */
  initialView?: "fit" | "world"
}): StationMap {
  clear(opts.container)
  const mapEl = el("div", { class: "wr-map" })
  opts.container.appendChild(mapEl)

  const isDark = matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  const tileUrl = isDark ? TILE_DARK : TILE_LIGHT

  const map = L.map(mapEl, {
    zoomControl: true,
    worldCopyJump: true,
    attributionControl: true,
    preferCanvas: true,
  }).setView([20, 0], 2)

  L.tileLayer(tileUrl, {
    attribution: TILE_ATTRIBUTION,
    subdomains: "abcd",
    maxZoom: 12,
    minZoom: 2,
  }).addTo(map)

  // Cluster group with custom bubble.
  const cluster = (L as unknown as {
    markerClusterGroup: (opts: Record<string, unknown>) => L.LayerGroup
  }).markerClusterGroup({
    maxClusterRadius: opts.maxClusterRadius ?? 36,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    chunkedLoading: opts.chunkedLoading ?? false,
    iconCreateFunction: (c: { getChildCount: () => number }) =>
      L.divIcon({
        html: `<div class="wr-cluster">${c.getChildCount()}</div>`,
        className: "wr-cluster-wrap",
        iconSize: L.point(48, 48),
      }),
  }) as L.LayerGroup & {
    addLayers: (markers: L.Marker[]) => void
    removeLayers: (markers: L.Marker[]) => void
    clearLayers: () => void
  }
  cluster.addTo(map)

  const markersByUuid = new Map<string, L.Marker>()
  let activeUuid = opts.activeUuid
  // Only fit to bounds on the *first* mount in "fit" mode. Re-renders via
  // setStations should not throw away the user's pan/zoom.
  let firstFit = opts.initialView !== "world"

  function buildIcon(active: boolean): L.DivIcon {
    // 44x44 hit area with a 16px visible dot centered inside.
    // iOS HIG recommends 44pt minimum tap targets — important for older users
    // and anyone using a phone outside or one-handed.
    return L.divIcon({
      html: `<div class="wr-marker${active ? " is-active" : ""}"></div>`,
      className: "wr-marker-wrap",
      iconSize: L.point(44, 44),
      iconAnchor: L.point(22, 22),
    })
  }

  function loadStations(stations: MapStation[]) {
    cluster.clearLayers()
    markersByUuid.clear()

    const bounds = L.latLngBounds([])
    const markers: L.Marker[] = []
    for (const station of stations) {
      const c = coordsFor(station)
      if (!c) continue
      const [lat, lng] = c
      const isActive = activeUuid === station.stationuuid
      const marker = L.marker([lat, lng], {
        icon: buildIcon(isActive),
        title: station.name,
      })
      marker.bindPopup(
        () => buildPopover(station, opts.onPlay, opts.onShowInList),
        {
          closeButton: false,
          maxWidth: 280,
          autoPan: true,
          offset: [0, -4],
        }
      )
      markersByUuid.set(station.stationuuid, marker)
      markers.push(marker)
      bounds.extend([lat, lng])
    }
    cluster.addLayers(markers)

    if (firstFit && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 })
      firstFit = false
    }
  }

  loadStations(opts.stations)

  return {
    setActiveUuid(uuid: string | null) {
      if (activeUuid === uuid) return
      const previous = activeUuid
      activeUuid = uuid
      if (previous && markersByUuid.has(previous)) {
        markersByUuid.get(previous)!.setIcon(buildIcon(false))
      }
      if (uuid && markersByUuid.has(uuid)) {
        markersByUuid.get(uuid)!.setIcon(buildIcon(true))
      }
    },
    focusStation(uuid: string) {
      const marker = markersByUuid.get(uuid)
      if (!marker) return
      const ll = marker.getLatLng()
      // Zoom in close enough that nearby stations don't get clustered with it.
      map.setView(ll, Math.max(map.getZoom(), 8), { animate: true })
      // Defer popup until after fly so the popup positions correctly.
      requestAnimationFrame(() => marker.openPopup())
    },
    setStations(next) {
      loadStations(next)
    },
    dispose() {
      map.remove()
      markersByUuid.clear()
    },
  }
}

function buildPopover(
  station: RadioStation,
  onPlay: (station: RadioStation) => void,
  onShowInList: (station: RadioStation) => void
): HTMLElement {
  const wrap = el("div", { class: "wr-pop" })

  const art = createStationArt(station, 44)
  wrap.appendChild(art)

  const info = el("div", { class: "wr-pop-info" })
  info.appendChild(el("div", { class: "wr-pop-name", title: station.name }, [station.name || "Untitled"]))
  const flag = countryCodeToFlag(station.countrycode)
  const metaParts: string[] = []
  if (flag) metaParts.push(flag)
  if (station.country) metaParts.push(station.country)
  if (station.codec) metaParts.push(station.codec.toUpperCase())
  if (station.bitrate > 0) metaParts.push(`${station.bitrate} kbps`)
  info.appendChild(el("div", { class: "wr-pop-meta" }, [metaParts.join(" · ")]))
  wrap.appendChild(info)

  const actions = el("div", { class: "wr-pop-actions" })
  const playBtn = el("button", {
    class: "wr-pop-play",
    type: "button",
    html: `${ICON_PLAY} <span style="margin-left:4px">Play</span>`,
  })
  playBtn.style.display = "inline-flex"
  playBtn.style.alignItems = "center"
  playBtn.style.justifyContent = "center"
  playBtn.addEventListener("click", () => onPlay(station))
  actions.appendChild(playBtn)

  const listBtn = el("button", {
    class: "wr-pop-list",
    type: "button",
  }, ["Show in list"])
  listBtn.addEventListener("click", () => onShowInList(station))
  actions.appendChild(listBtn)

  wrap.appendChild(actions)
  return wrap
}
