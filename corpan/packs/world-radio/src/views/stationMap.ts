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
import { el, clear } from "../ui/dom"
import { createStationArt } from "../ui/stationArt"
import { countryCodeToFlag } from "../ui/flagEmoji"
import { ICON_PLAY } from "../ui/icons"

const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
const TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
const TILE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a> contributors · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'

export type StationMap = {
  setActiveUuid: (uuid: string | null) => void
  /** Pan/zoom to the station's coordinates and open its popup. */
  focusStation: (uuid: string) => void
  dispose: () => void
}

export function createStationMap(opts: {
  container: HTMLElement
  stations: RadioStation[]
  activeUuid: string | null
  onPlay: (station: RadioStation) => void
  onShowInList: (station: RadioStation) => void
}): StationMap {
  clear(opts.container)
  const mapEl = el("div", { class: "wr-map" })
  opts.container.appendChild(mapEl)

  // Filter to stations with valid geo coords.
  const placed = opts.stations.filter(
    (s) =>
      typeof s.geo_lat === "number" &&
      typeof s.geo_long === "number" &&
      Number.isFinite(s.geo_lat) &&
      Number.isFinite(s.geo_long) &&
      Math.abs(s.geo_lat as number) <= 90 &&
      Math.abs(s.geo_long as number) <= 180
  )

  if (placed.length === 0) {
    clear(opts.container)
    const empty = el("div", { class: "wr-empty" }, [
      "None of these stations have map locations yet.",
    ])
    opts.container.appendChild(empty)
    return {
      setActiveUuid: () => {},
      focusStation: () => {},
      dispose: () => {},
    }
  }

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
    maxClusterRadius: 36,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: (c: { getChildCount: () => number }) =>
      L.divIcon({
        html: `<div class="wr-cluster">${c.getChildCount()}</div>`,
        className: "wr-cluster-wrap",
        iconSize: L.point(48, 48),
      }),
  }) as L.LayerGroup & {
    addLayers: (markers: L.Marker[]) => void
    clearLayers: () => void
  }

  const markersByUuid = new Map<string, L.Marker>()
  let activeUuid = opts.activeUuid

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

  const markers: L.Marker[] = []
  const bounds = L.latLngBounds([])
  for (const station of placed) {
    const lat = station.geo_lat as number
    const lng = station.geo_long as number
    const isActive = activeUuid === station.stationuuid
    const marker = L.marker([lat, lng], {
      icon: buildIcon(isActive),
      title: station.name,
    })
    marker.bindPopup(() => buildPopover(station, opts.onPlay, opts.onShowInList), {
      closeButton: false,
      maxWidth: 280,
      autoPan: true,
      offset: [0, -4],
    })
    markersByUuid.set(station.stationuuid, marker)
    markers.push(marker)
    bounds.extend([lat, lng])
  }

  cluster.addLayers(markers)
  cluster.addTo(map)

  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 })
  }

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
