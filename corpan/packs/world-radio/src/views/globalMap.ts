/**
 * Global map view — every Radio Browser station the world over, on one map.
 *
 * Owns:
 *   - the global station fetch (`getAllStations`) + placement
 *     (real geo or country centroid + jitter via `placeStations`),
 *   - a filter rail (search + tag chips, reused from stationFilters.ts) plus
 *     a language chip strip specific to this view,
 *   - the leaflet instance (mounted via createStationMap with global-tuned
 *     cluster + chunked loading + world-zoom initial view).
 *
 * Filtering is purely client-side: 10k stations × ~150 bytes is tiny to
 * scan in JS, and re-rendering the cluster layer (without rebuilding the
 * map / tile layer) keeps the user's pan/zoom intact across filter
 * tweaks.
 */

import { getAllStations, type RadioStation } from "../api/radioBrowser"
import { placeStations, type PlacedStation } from "../api/stationGeo"
import {
  ALL_CORPAN_LANGUAGES,
  corpanToRadioLanguage,
  displayName,
} from "../api/languageMap"
import { applyFilters, computeTopTags, createFilterRail } from "./stationFilters"
import type { StationMap } from "./stationMap"
import { el, clear } from "../ui/dom"
import { createAlert } from "../ui/alert"
import { createMapSkeleton } from "../ui/skeleton"

export type GlobalMapView = {
  root: HTMLElement
  setActiveStation: (uuid: string | null) => void
  /** Called when this view is shown (e.g. tab activated) — kicks data load
   *  on first activation; cheap on subsequent ones. */
  activate: () => void
  dispose: () => void
}

export function createGlobalMapView(opts: {
  onPlay: (station: RadioStation) => void
  onShowInList: (station: RadioStation) => void
  onMapReady?: (markerCount: number) => void
  onLanguageFilter?: (codes: string[]) => void
  onTagFilter?: (tag: string, applied: boolean) => void
  onSearch?: (query: string, resultCount: number) => void
}): GlobalMapView {
  const root = el("section", { class: "wr-globalmap" })

  // ---- Sticky region (filter rail + language chips) ----
  const sticky = el("div", { class: "wr-sticky" })
  root.appendChild(sticky)

  // Filter rail (search + tag chips). Sort is irrelevant on a map — hide it.
  let allStations: PlacedStation[] = []
  let activeUuid: string | null = null
  let mapView: StationMap | null = null
  let activated = false
  let loaded = false
  let loading = false
  let disposed = false
  let activeLanguageCodes: string[] = []

  const filterRail = createFilterRail({
    initial: { query: "", sort: "popular", tags: [] },
    onChange: (change) => {
      if (change.type === "query") {
        const filtered = computeFiltered()
        opts.onSearch?.(change.state.query, filtered.length)
        applyToMap(filtered)
      } else if (change.type === "tag") {
        if (change.tag) opts.onTagFilter?.(change.tag, change.applied ?? false)
        applyToMap()
      } else if (change.type === "clear") {
        applyToMap()
      }
    },
  })
  filterRail.setSortVisible(false)
  sticky.appendChild(filterRail.root)

  // Language chip strip — multi-select. Reuses Corpan's known display names
  // so it's consistent with the Languages tab. Hidden until stations load.
  const langStrip = el("div", { class: "wr-langstrip" })
  langStrip.style.display = "none"
  sticky.appendChild(langStrip)

  function renderLanguageChips() {
    clear(langStrip)
    if (allStations.length === 0) return
    langStrip.style.display = ""
    const active = new Set(activeLanguageCodes)
    // "All" reset chip
    const allChip = el("button", {
      class: "wr-langchip",
      type: "button",
      "aria-pressed": active.size === 0 ? "true" : "false",
    }, ["All"])
    allChip.addEventListener("click", () => {
      if (activeLanguageCodes.length === 0) return
      activeLanguageCodes = []
      opts.onLanguageFilter?.([])
      renderLanguageChips()
      applyToMap()
    })
    langStrip.appendChild(allChip)

    for (const code of ALL_CORPAN_LANGUAGES) {
      // Skip codes that have no Radio Browser mapping — they'd never match.
      if (!corpanToRadioLanguage(code)) continue
      const isActive = active.has(code)
      const chip = el("button", {
        class: "wr-langchip",
        type: "button",
        "aria-pressed": isActive ? "true" : "false",
      }, [displayName(code)])
      chip.addEventListener("click", () => {
        if (isActive) {
          activeLanguageCodes = activeLanguageCodes.filter((c) => c !== code)
        } else {
          activeLanguageCodes = [...activeLanguageCodes, code]
        }
        opts.onLanguageFilter?.([...activeLanguageCodes])
        renderLanguageChips()
        applyToMap()
      })
      langStrip.appendChild(chip)
    }
  }

  // ---- Body slot (skeleton / map / alert) ----
  const body = el("div", { class: "wr-globalmap-body" })
  root.appendChild(body)

  function showSkeleton() {
    clear(body)
    body.appendChild(createMapSkeleton())
  }
  showSkeleton()

  function computeFiltered(): PlacedStation[] {
    const f = filterRail.getState()
    const stateWithLang = {
      ...f,
      tags: [...f.tags],
      languageCodes: activeLanguageCodes.length > 0 ? activeLanguageCodes : undefined,
    }
    return applyFilters(allStations, stateWithLang)
  }

  function applyToMap(precomputed?: PlacedStation[]) {
    const filtered = precomputed ?? computeFiltered()
    if (mapView) {
      mapView.setStations(filtered)
    }
  }

  async function mountMap() {
    const { createStationMap } = await import("./stationMap")
    if (disposed) return
    clear(body)
    const wrap = el("div", { class: "wr-map-wrap" })
    body.appendChild(wrap)
    mapView = createStationMap({
      container: wrap,
      stations: computeFiltered(),
      activeUuid,
      onPlay: opts.onPlay,
      onShowInList: opts.onShowInList,
      maxClusterRadius: 60,
      chunkedLoading: true,
      initialView: "world",
    })
    opts.onMapReady?.(allStations.length)
  }

  async function loadOnce() {
    if (loaded || loading) return
    loading = true
    try {
      const stations = await getAllStations(10000)
      if (disposed) return
      allStations = placeStations(stations)
      // Populate tag chips from the global set (same heuristic — top 12).
      filterRail.setAvailableTags(computeTopTags(stations, 14))
      loaded = true
      renderLanguageChips()
      await mountMap()
    } catch (err) {
      console.error("[world-radio] global map load failed:", err)
      if (disposed) return
      clear(body)
      body.appendChild(
        createAlert({
          title: "Couldn't load the world map",
          body: "Check your connection and try again.",
          actionLabel: "Try again",
          onAction: () => {
            loading = false
            showSkeleton()
            void loadOnce()
          },
        })
      )
    } finally {
      loading = false
    }
  }

  return {
    root,
    setActiveStation(uuid) {
      activeUuid = uuid
      mapView?.setActiveUuid(uuid)
    },
    activate() {
      if (activated) return
      activated = true
      void loadOnce()
    },
    dispose() {
      disposed = true
      filterRail.dispose()
      mapView?.dispose()
      mapView = null
    },
  }
}
