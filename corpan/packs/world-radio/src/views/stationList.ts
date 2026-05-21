/**
 * Language detail view — the discovery surface.
 *
 * Sticky header with title, subtitle, list/map toggle. Filter rail (search,
 * sort, tag chips) below. Rich station rows with artwork, flag, metadata,
 * tags, and a popular badge for top-decile stations.
 *
 * Search / sort / tag filter state is owned by `stationFilters.ts` and
 * persisted per-language via `state/listPrefs.ts`. The map view
 * (`stationMap.ts`) consumes the same filtered station list when toggled
 * to map mode — single source of truth.
 */

import { displayName } from "../api/languageMap"
import {
  getStationsByLanguage,
  isPlayableOnPlatform,
  parseTags,
  type RadioStation,
} from "../api/radioBrowser"
import { el, clear } from "../ui/dom"
import {
  ICON_BACK,
  ICON_LIST,
  ICON_MAP,
  ICON_STAR_FILLED,
  ICON_STAR_OUTLINE,
} from "../ui/icons"
import { favoritesStore, toLite } from "../state/stores"
import {
  loadLanguagePrefs,
  saveLanguagePrefs,
  type LanguagePrefs,
  type ViewMode,
} from "../state/listPrefs"
import { createStationArt } from "../ui/stationArt"
import { countryCodeToFlag } from "../ui/flagEmoji"
import { createEqGlyph, type EqGlyph, type EqMode } from "../ui/eqGlyph"
import { createAlert } from "../ui/alert"
import { createSkeletonRows } from "../ui/skeleton"
import { createOfflineNotice, isOnline } from "../../../shared/ui/offlineNotice"
import { createSegmentedToggle } from "../ui/segmentedToggle"
import {
  applyFilters,
  computeTopTags,
  createFilterRail,
  type FilterState,
} from "./stationFilters"
import type { StationMap } from "./stationMap"

export type StationListView = {
  root: HTMLElement
  setActiveStation: (stationuuid: string | null) => void
  /** Pass-through of the player state so the row's EQ glyph can reflect
   *  loading (connecting pulse) vs playing (reactive bars). */
  setPlayerKind: (kind: "idle" | "loading" | "playing" | "paused") => void
  dispose: () => void
}

export function createStationListView(opts: {
  corpanCode: string
  radioName: string
  onBack: () => void
  onPlay: (station: RadioStation) => void
  onFavoriteToggled?: (station: RadioStation, added: boolean) => void
  onStationsLoaded?: (count: number) => void
  onSearch?: (query: string, resultCount: number) => void
  onSortChanged?: (sortKey: string) => void
  onTagFilter?: (tag: string, applied: boolean) => void
  onMapView?: (markerCount: number) => void
  /** One-time view-mode override (doesn't persist to listPrefs). */
  initialView?: ViewMode
  /** Station to focus once data is loaded — scroll-to in list, fly-to in map. */
  focusUuid?: string
}): StationListView {
  const root = el("section", { class: "wr-stationlist" })

  const prefs: LanguagePrefs = loadLanguagePrefs(opts.corpanCode)
  // initialView is a one-time override (e.g. from "tap player meta" smart
  // navigation). We don't persist it — that's still up to the user toggling.
  let viewMode: ViewMode = opts.initialView ?? prefs.view
  // Mirror viewMode onto a data attribute. The .wr-root flex column is the
  // single source of layout truth (header → main → player), so styles
  // branch off `[data-view]` here without needing any class on .wr-root.
  const syncViewModeAttr = () => {
    root.setAttribute("data-view", viewMode)
  }
  syncViewModeAttr()
  // Player state for the active row's glyph. Drives the EQ mode mapping:
  // loading → connecting, playing → playing, paused/error/idle → idle.
  type RowEqState = "idle" | "loading" | "playing" | "paused"
  let rowEqState: RowEqState = "idle"
  let activeUuid: string | null = null

  function eqModeForState(s: RowEqState): EqMode {
    if (s === "loading") return "connecting"
    if (s === "playing") return "playing"
    return "idle"
  }

  // ---- Sticky region: header + filter rail stay pinned together ----
  // Wrapping both in a single sticky parent so the user can search/filter from
  // any scroll position without losing access to the title/back/toggle either.
  const sticky = el("div", { class: "wr-sticky" })
  root.appendChild(sticky)

  // ---- Header ----
  const header = el("header", { class: "wr-header" })
  const headerRow = el("div", { class: "wr-header-row" })

  const back = el("button", {
    class: "wr-back",
    type: "button",
    "aria-label": "Back",
    html: ICON_BACK,
  })
  back.addEventListener("click", () => opts.onBack())
  headerRow.appendChild(back)

  const title = el("h1", { class: "wr-title" }, [displayName(opts.corpanCode)])
  headerRow.appendChild(title)

  const toggle = createSegmentedToggle<ViewMode>({
    options: [
      { value: "list", label: "List", icon: ICON_LIST },
      { value: "map", label: "Map", icon: ICON_MAP },
    ],
    value: viewMode,
    onChange: (next) => {
      viewMode = next
      syncViewModeAttr()
      saveLanguagePrefs(opts.corpanCode, { ...currentPrefsSnapshot(), view: next })
      filterRail.setSortVisible(next === "list")
      void renderViewMode()
    },
  })
  headerRow.appendChild(toggle.root)

  header.appendChild(headerRow)

  const subtitle = el("p", { class: "wr-subtitle" }, ["Loading…"])
  header.appendChild(subtitle)
  sticky.appendChild(header)

  // ---- Filter rail ----
  const filterRail = createFilterRail({
    initial: { query: "", sort: prefs.sort, tags: [...prefs.tags] },
    onChange: (change) => {
      const fState = change.state
      saveLanguagePrefs(opts.corpanCode, {
        sort: fState.sort,
        view: viewMode,
        tags: [...fState.tags],
      })
      if (change.type === "query") {
        opts.onSearch?.(fState.query, applyFilters(allStations, fState).length)
      } else if (change.type === "sort") {
        opts.onSortChanged?.(fState.sort)
      } else if (change.type === "tag" && change.tag) {
        opts.onTagFilter?.(change.tag, change.applied ?? false)
      }
      renderResults()
    },
  })
  sticky.appendChild(filterRail.root)
  filterRail.setSortVisible(viewMode === "list")

  // ---- Body slot (skeleton / list / map / alert / empty) ----
  const body = el("div", { class: "wr-body" })
  root.appendChild(body)

  // Show skeletons immediately
  body.appendChild(createSkeletonRows(5))

  let allStations: RadioStation[] = []
  let popularThreshold = 0
  let mapView: StationMap | null = null
  let disposed = false
  /** EQ glyph for the currently-active row (only one row has a glyph). */
  let activeGlyph: EqGlyph | null = null

  function disposeActiveGlyph() {
    activeGlyph?.dispose()
    activeGlyph?.root.remove()
    activeGlyph = null
  }

  function currentPrefsSnapshot(): LanguagePrefs {
    const f = filterRail.getState()
    return { sort: f.sort, view: viewMode, tags: [...f.tags] }
  }

  function getFilteredStations(): RadioStation[] {
    return applyFilters(allStations, filterRail.getState())
  }

  function updateSubtitle(filtered: RadioStation[]) {
    const total = allStations.length
    const withGeo = allStations.filter(
      (s) => typeof s.geo_lat === "number" && typeof s.geo_long === "number"
    ).length

    if (total === 0) {
      subtitle.textContent = "No stations found"
      return
    }
    const filterActive =
      filterRail.getState().query !== "" || filterRail.getState().tags.length > 0

    const left = filterActive
      ? `Showing ${filtered.length} of ${total}`
      : `${total} stations`
    const right = withGeo > 0 ? ` · ${withGeo} with location` : ""
    subtitle.textContent = left + right
  }

  function renderListBody(filtered: RadioStation[]) {
    // Any previously-attached glyph belongs to a row about to be wiped.
    disposeActiveGlyph()
    clear(body)
    if (filtered.length === 0) {
      const empty = el("div", { class: "wr-empty" }, ["No stations match your filters."])
      const action = el("button", {
        class: "wr-empty-action",
        type: "button",
      }, ["Clear filters"])
      action.addEventListener("click", () => {
        const cleared: FilterState = { query: "", sort: filterRail.getState().sort, tags: [] }
        filterRail.setState(cleared)
        saveLanguagePrefs(opts.corpanCode, {
          sort: cleared.sort,
          view: viewMode,
          tags: [],
        })
        renderResults()
      })
      empty.appendChild(action)
      body.appendChild(empty)
      return
    }
    const list = el("ul", { class: "wr-list" })
    for (const station of filtered) {
      list.appendChild(stationRow(station))
    }
    body.appendChild(list)
  }

  function stationRow(station: RadioStation): HTMLElement {
    const li = el("li", {
      class: "wr-row wr-station-row",
      "data-uuid": station.stationuuid,
    })
    if (activeUuid === station.stationuuid) li.classList.add("is-active")

    const main = el("button", {
      class: "wr-station-btn",
      type: "button",
      "aria-label": `Play ${station.name}`,
    })

    // Artwork
    const art = createStationArt(station, 36)
    art.classList.add("wr-station-art")
    main.appendChild(art)

    // Name (with EQ glyph when active+playing)
    // Force LTR for the name so RTL station titles (Hebrew/Arabic/Persian)
    // don't flip the whole row layout. Native readers know to read RTL
    // characters within an LTR layout — the cost of `dir="auto"` (the entire
    // row reorganizing) is worse than the gain.
    const nameWrap = el("span", {
      class: "wr-station-name",
      dir: "ltr",
      title: station.name,
    })
    if (activeUuid === station.stationuuid) {
      disposeActiveGlyph()
      const glyph = createEqGlyph(eqModeForState(rowEqState))
      glyph.root.dataset.role = "playing-glyph"
      nameWrap.appendChild(glyph.root)
      activeGlyph = glyph
    }
    // Inner text span owns the ellipsis truncation. The outer .wr-station-name
    // is a flex container — text-overflow:ellipsis doesn't apply to flex
    // children directly, which is why the popular badge was getting clipped
    // when the line was too long. With this split, the text shrinks-and-
    // ellipsizes while the badge stays full-width via flex: 0 0 auto.
    const nameText = el("span", { class: "wr-station-name-text" }, [
      station.name || "Untitled station",
    ])
    nameWrap.appendChild(nameText)
    if (station.clickcount >= popularThreshold && popularThreshold > 0) {
      const badge = el("span", { class: "wr-popular" }, ["★ Popular"])
      nameWrap.appendChild(badge)
    }
    main.appendChild(nameWrap)

    // Meta line: flag · country · codec · bitrate
    const meta = el("span", { class: "wr-station-meta" })
    const flag = countryCodeToFlag(station.countrycode)
    if (flag) {
      meta.appendChild(el("span", { class: "wr-station-meta-flag" }, [flag]))
    }
    const metaParts: string[] = []
    if (station.country) metaParts.push(station.country)
    if (station.codec) metaParts.push(station.codec.toUpperCase())
    if (station.bitrate > 0) metaParts.push(`${station.bitrate} kbps`)
    metaParts.forEach((p, idx) => {
      if (idx > 0) {
        meta.appendChild(el("span", { class: "wr-station-meta-sep" }, ["·"]))
      }
      meta.appendChild(el("span", {}, [p]))
    })
    main.appendChild(meta)

    // Tags
    const tags = parseTags(station.tags).slice(0, 3)
    if (tags.length > 0) {
      const tagsRow = el("span", { class: "wr-station-tags" })
      for (const tag of tags) {
        const tagEl = el("span", { class: "wr-station-tag" }, [tag])
        tagEl.addEventListener("click", (ev) => {
          ev.stopPropagation()
          ev.preventDefault()
          const f = filterRail.getState()
          if (!f.tags.includes(tag)) {
            const next: FilterState = { ...f, tags: [...f.tags, tag] }
            filterRail.setState(next)
            saveLanguagePrefs(opts.corpanCode, {
              sort: next.sort,
              view: viewMode,
              tags: [...next.tags],
            })
            opts.onTagFilter?.(tag, true)
            renderResults()
          }
        })
        tagsRow.appendChild(tagEl)
      }
      main.appendChild(tagsRow)
    }

    main.addEventListener("click", () => opts.onPlay(station))
    li.appendChild(main)

    // Star
    const isFav = favoritesStore.has(station.stationuuid)
    const star = el("button", {
      class: "wr-star",
      type: "button",
      "aria-pressed": isFav ? "true" : "false",
      "aria-label": isFav ? "Remove favorite" : "Add favorite",
      html: isFav ? ICON_STAR_FILLED : ICON_STAR_OUTLINE,
    })
    star.addEventListener("click", (ev) => {
      ev.stopPropagation()
      const result = favoritesStore.toggle(toLite(station))
      star.setAttribute("aria-pressed", result.isFavorite ? "true" : "false")
      star.setAttribute("aria-label", result.isFavorite ? "Remove favorite" : "Add favorite")
      star.innerHTML = result.isFavorite ? ICON_STAR_FILLED : ICON_STAR_OUTLINE
      opts.onFavoriteToggled?.(station, result.isFavorite)
    })
    li.appendChild(star)
    return li
  }

  async function renderMapBody(filtered: RadioStation[]) {
    clear(body)
    const placeholder = el("div", { class: "wr-empty" }, ["Loading map…"])
    body.appendChild(placeholder)

    try {
      // Lazy-load Leaflet + the map view in a single chunk.
      const { createStationMap } = await import("./stationMap")
      if (disposed || viewMode !== "map") return

      // Dispose any old instance before mounting a new one.
      if (mapView) {
        mapView.dispose()
        mapView = null
      }

      clear(body)
      const wrap = el("div", { class: "wr-map-wrap" })
      body.appendChild(wrap)

      mapView = createStationMap({
        container: wrap,
        stations: filtered,
        activeUuid,
        onPlay: (station) => {
          opts.onPlay(station)
        },
        onShowInList: (station) => {
          // Switch to list view, marking the station active.
          viewMode = "list"
          syncViewModeAttr()
          toggle.setValue("list")
          saveLanguagePrefs(opts.corpanCode, {
            ...currentPrefsSnapshot(),
            view: "list",
          })
          renderResults()
          activeUuid = station.stationuuid
          requestAnimationFrame(() => {
            const node = root.querySelector(
              `[data-uuid="${CSS.escape(station.stationuuid)}"]`
            )
            if (node) node.scrollIntoView({ behavior: "smooth", block: "center" })
          })
        },
      })

      const markerCount = filtered.filter(
        (s) => typeof s.geo_lat === "number" && typeof s.geo_long === "number"
      ).length
      opts.onMapView?.(markerCount)

      // If we were asked to focus a station (smart nav from the player bar),
      // and we just mounted the map, fly to it now that markers exist.
      if (opts.focusUuid && activeUuid === opts.focusUuid) {
        mapView.focusStation(opts.focusUuid)
      }
    } catch (err) {
      console.error("[world-radio] map load failed:", err)
      if (disposed) return
      clear(body)
      body.appendChild(
        createAlert({
          title: "Couldn't load the map",
          body: err instanceof Error ? err.message : "Unknown error",
          actionLabel: "Try again",
          onAction: () => void renderMapBody(filtered),
        })
      )
    }
  }

  function renderResults() {
    const filtered = getFilteredStations()
    updateSubtitle(filtered)
    if (viewMode === "map") {
      void renderMapBody(filtered)
    } else {
      if (mapView) {
        mapView.dispose()
        mapView = null
      }
      renderListBody(filtered)
    }
  }

  async function renderViewMode() {
    renderResults()
  }

  function loadStations() {
    void (async () => {
      try {
        const raw = await getStationsByLanguage(opts.radioName)
        if (disposed) return
        const stations = raw.filter(isPlayableOnPlatform)
        allStations = stations

        // Compute popular threshold (top-decile clickcount) for the badge.
        const sortedClicks = [...stations].map((s) => s.clickcount).sort((a, b) => b - a)
        if (sortedClicks.length >= 10) {
          popularThreshold = sortedClicks[Math.floor(sortedClicks.length / 10)] || 0
        }

        // Populate tag chip set from this language's most common tags.
        filterRail.setAvailableTags(computeTopTags(stations, 12))

        opts.onStationsLoaded?.(stations.length)
        // If asked to focus a station and its uuid is in the loaded set,
        // mark it active so the map flies to it / the list highlights it.
        if (opts.focusUuid && stations.some((s) => s.stationuuid === opts.focusUuid)) {
          activeUuid = opts.focusUuid
        }
        renderResults()
        // List mode focus. Map mode focus is handled inside renderMapBody
        // because the map is dynamically imported and may not exist yet.
        if (opts.focusUuid && viewMode === "list") {
          requestAnimationFrame(() => {
            const node = root.querySelector(
              `[data-uuid="${CSS.escape(opts.focusUuid!)}"]`
            )
            if (node) node.scrollIntoView({ behavior: "smooth", block: "center" })
          })
        }
      } catch (err) {
        console.error("[world-radio] station list load failed:", err)
        if (disposed) return
        clear(body)
        if (!isOnline()) {
          // No cache + offline → calm notice. Stations stream live, so
          // playing requires internet even if we had the metadata.
          const notice = createOfflineNotice({
            title: "World Radio needs internet",
            subtitle:
              "Stations stream live. Reconnect to browse and listen.",
          })
          body.appendChild(notice.element)
          subtitle.textContent = ""
          return
        }
        body.appendChild(
          createAlert({
            title: "Couldn't load stations",
            body: "Check your connection and try again.",
            actionLabel: "Try again",
            onAction: () => {
              clear(body)
              body.appendChild(createSkeletonRows(5))
              loadStations()
            },
          })
        )
        subtitle.textContent = ""
      }
    })()
  }

  loadStations()

  return {
    root,
    setActiveStation(uuid) {
      activeUuid = uuid
      disposeActiveGlyph()
      for (const li of Array.from(root.querySelectorAll(".wr-row")) as HTMLElement[]) {
        const matches = li.getAttribute("data-uuid") === uuid
        li.classList.toggle("is-active", matches)
        if (matches) {
          const nameEl = li.querySelector(".wr-station-name") as HTMLElement | null
          if (nameEl) {
            const glyph = createEqGlyph(eqModeForState(rowEqState))
            glyph.root.dataset.role = "playing-glyph"
            nameEl.insertBefore(glyph.root, nameEl.firstChild)
            activeGlyph = glyph
          }
        }
      }
      mapView?.setActiveUuid(uuid)
    },
    setPlayerKind(kind) {
      const next: RowEqState =
        kind === "loading" ? "loading" :
        kind === "playing" ? "playing" :
        kind === "paused" ? "paused" :
        "idle"
      if (rowEqState === next) return
      rowEqState = next
      activeGlyph?.setMode(eqModeForState(next))
    },
    dispose() {
      disposed = true
      disposeActiveGlyph()
      filterRail.dispose()
      mapView?.dispose()
    },
  }
}
