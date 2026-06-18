/**
 * Global station list — the list counterpart to the top-level world map.
 *
 * This is intentionally separate from the per-language station detail: it
 * uses the global station dataset, no Corpan language code, and its own small
 * preference key so "Show in list" from the world map stays in world context.
 */

import {
  getAllStations,
  parseTags,
  type RadioStation,
} from "../api/radioBrowser"
import { el, clear } from "../ui/dom"
import {
  ICON_BACK,
  ICON_STAR_FILLED,
  ICON_STAR_OUTLINE,
} from "../ui/icons"
import { favoritesStore, toLite } from "../state/stores"
import type { SortKey } from "../state/listPrefs"
import { createStationArt } from "../ui/stationArt"
import { countryCodeToFlag } from "../ui/flagEmoji"
import { createEqGlyph, type EqGlyph, type EqMode } from "../ui/eqGlyph"
import { createAlert } from "../ui/alert"
import { createSkeletonRows } from "../ui/skeleton"
import { createOfflineNotice, isOnline } from "../../../shared/ui/offlineNotice"
import {
  applyFilters,
  computeTopTags,
  createFilterRail,
  type FilterState,
} from "./stationFilters"

const PREFS_KEY = "worldRadio.globalListPrefs.v1"

type GlobalListPrefs = {
  sort: SortKey
  tags: string[]
}

const DEFAULT_PREFS: GlobalListPrefs = {
  sort: "popular",
  tags: [],
}

export type GlobalStationListView = {
  root: HTMLElement
  setActiveStation: (stationuuid: string | null) => void
  setPlayerKind: (kind: "idle" | "loading" | "playing" | "paused") => void
  dispose: () => void
}

export function createGlobalStationListView(opts: {
  onBack: () => void
  onPlay: (station: RadioStation) => void
  onFavoriteToggled?: (station: RadioStation, added: boolean) => void
  onStationsLoaded?: (count: number) => void
  onSearch?: (query: string, resultCount: number) => void
  onSortChanged?: (sortKey: string) => void
  onTagFilter?: (tag: string, applied: boolean) => void
  focusUuid?: string
}): GlobalStationListView {
  const root = el("section", { class: "wr-stationlist", "data-view": "list" })

  const prefs = loadGlobalListPrefs()
  type RowEqState = "idle" | "loading" | "playing" | "paused"
  let rowEqState: RowEqState = "idle"
  let activeUuid: string | null = null

  function eqModeForState(s: RowEqState): EqMode {
    if (s === "loading") return "connecting"
    if (s === "playing") return "playing"
    return "idle"
  }

  const sticky = el("div", { class: "wr-sticky" })
  root.appendChild(sticky)

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

  headerRow.appendChild(el("h1", { class: "wr-title" }, ["All stations"]))
  header.appendChild(headerRow)

  const subtitle = el("p", { class: "wr-subtitle" }, ["Loading..."])
  header.appendChild(subtitle)
  sticky.appendChild(header)

  const filterRail = createFilterRail({
    initial: { query: "", sort: prefs.sort, tags: [...prefs.tags] },
    onChange: (change) => {
      const fState = change.state
      saveGlobalListPrefs({
        sort: fState.sort,
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
  filterRail.setSortVisible(true)

  const body = el("div", { class: "wr-body" })
  root.appendChild(body)
  body.appendChild(createSkeletonRows(5))

  let allStations: RadioStation[] = []
  let popularThreshold = 0
  let disposed = false
  let activeGlyph: EqGlyph | null = null

  function disposeActiveGlyph() {
    activeGlyph?.dispose()
    activeGlyph?.root.remove()
    activeGlyph = null
  }

  function getFilteredStations(): RadioStation[] {
    return applyFilters(allStations, filterRail.getState())
  }

  function updateSubtitle(filtered: RadioStation[]) {
    const total = allStations.length
    if (total === 0) {
      subtitle.textContent = "No stations found"
      return
    }
    const filterActive =
      filterRail.getState().query !== "" || filterRail.getState().tags.length > 0
    subtitle.textContent = filterActive
      ? `Showing ${filtered.length.toLocaleString()} of ${total.toLocaleString()}`
      : `${total.toLocaleString()} stations`
  }

  function ensureFocusIsVisible() {
    if (!opts.focusUuid) return
    const filtered = getFilteredStations()
    if (filtered.some((s) => s.stationuuid === opts.focusUuid)) return
    const current = filterRail.getState()
    const cleared: FilterState = { query: "", sort: current.sort, tags: [] }
    filterRail.setState(cleared)
    saveGlobalListPrefs({ sort: cleared.sort, tags: [] })
  }

  function scrollToStation(uuid: string) {
    requestAnimationFrame(() => {
      const node = root.querySelector(`[data-uuid="${CSS.escape(uuid)}"]`)
      if (node) node.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  function renderListBody(filtered: RadioStation[]) {
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
        saveGlobalListPrefs({ sort: cleared.sort, tags: [] })
        renderResults()
      })
      empty.appendChild(action)
      body.appendChild(empty)
      return
    }

    const favoriteUuids = new Set(favoritesStore.load().map((s) => s.uuid))
    const list = el("ul", { class: "wr-list" })
    for (const station of filtered) {
      list.appendChild(stationRow(station, favoriteUuids))
    }
    body.appendChild(list)
  }

  function stationRow(station: RadioStation, favoriteUuids: Set<string>): HTMLElement {
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

    const art = createStationArt(station, 36)
    art.classList.add("wr-station-art")
    main.appendChild(art)

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
    const nameText = el("span", { class: "wr-station-name-text" }, [
      station.name || "Untitled station",
    ])
    nameWrap.appendChild(nameText)
    if (station.clickcount >= popularThreshold && popularThreshold > 0) {
      nameWrap.appendChild(el("span", { class: "wr-popular" }, ["★ Popular"]))
    }
    main.appendChild(nameWrap)

    const meta = el("span", { class: "wr-station-meta" })
    const flag = countryCodeToFlag(station.countrycode)
    if (flag) {
      meta.appendChild(el("span", { class: "wr-station-meta-flag" }, [flag]))
    }
    const metaParts: string[] = []
    if (station.country) metaParts.push(station.country)
    if (station.language) metaParts.push(station.language)
    if (station.codec) metaParts.push(station.codec.toUpperCase())
    if (station.bitrate > 0) metaParts.push(`${station.bitrate} kbps`)
    metaParts.forEach((p, idx) => {
      if (idx > 0) {
        meta.appendChild(el("span", { class: "wr-station-meta-sep" }, ["·"]))
      }
      meta.appendChild(el("span", {}, [p]))
    })
    main.appendChild(meta)

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
            saveGlobalListPrefs({
              sort: next.sort,
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

    const isFav = favoriteUuids.has(station.stationuuid)
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

  function renderResults() {
    const filtered = getFilteredStations()
    updateSubtitle(filtered)
    renderListBody(filtered)
  }

  function loadStations() {
    void (async () => {
      try {
        const stations = await getAllStations(10000)
        if (disposed) return
        allStations = stations

        const sortedClicks = [...stations].map((s) => s.clickcount).sort((a, b) => b - a)
        if (sortedClicks.length >= 10) {
          popularThreshold = sortedClicks[Math.floor(sortedClicks.length / 10)] || 0
        }

        filterRail.setAvailableTags(computeTopTags(stations, 14))
        if (opts.focusUuid && stations.some((s) => s.stationuuid === opts.focusUuid)) {
          activeUuid = opts.focusUuid
        }
        ensureFocusIsVisible()
        opts.onStationsLoaded?.(stations.length)
        renderResults()
        if (opts.focusUuid) scrollToStation(opts.focusUuid)
      } catch (err) {
        console.error("[world-radio] global station list load failed:", err)
        if (disposed) return
        clear(body)
        if (!isOnline()) {
          const notice = createOfflineNotice({
            title: "World Radio needs internet",
            subtitle: "Stations stream live. Reconnect to browse and listen.",
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
    },
  }
}

function loadGlobalListPrefs(): GlobalListPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS, tags: [] }
    const parsed = JSON.parse(raw) as Partial<GlobalListPrefs>
    return {
      sort: parsed.sort ?? DEFAULT_PREFS.sort,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    }
  } catch (err) {
    console.error("[world-radio] loadGlobalListPrefs failed:", err)
    return { ...DEFAULT_PREFS, tags: [] }
  }
}

function saveGlobalListPrefs(prefs: GlobalListPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch (err) {
    console.error("[world-radio] saveGlobalListPrefs failed:", err)
  }
}
