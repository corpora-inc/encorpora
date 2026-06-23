/**
 * Tabbed shell for the browse screen: [ Languages | World map ].
 *
 * Both child views are kept mounted (display: none toggle) once activated
 * so map state (pan/zoom, filter selections) survives tab switches without
 * a re-fetch. The active tab is persisted in prefsStore.browseTab so a
 * returning user lands wherever they last were.
 */

import { createLanguageListView, type LanguageListView } from "./languageList"
import { createGlobalMapView, type GlobalMapView } from "./globalMap"
import { createSegmentedToggle } from "../ui/segmentedToggle"
import { ICON_LIST, ICON_MAP } from "../ui/icons"
import { prefsStore } from "../state/stores"
import { el } from "../ui/dom"
import type { RadioStation } from "../api/radioBrowser"

export type BrowseTab = "languages" | "map"

export type BrowseShellView = {
  root: HTMLElement
  setStack: (codes: string[]) => void
  refresh: () => Promise<void>
  setActiveStation: (uuid: string | null) => void
  dispose: () => void
}

export function createBrowseShellView(opts: {
  initialStack: string[]
  onSelectLanguage: (corpanCode: string) => void
  onPlay: (station: RadioStation) => void
  onShowInList: (station: RadioStation) => void
  onMapTabActivated?: () => void
  onLanguageFilter?: (codes: string[]) => void
  onTagFilter?: (tag: string, applied: boolean) => void
  onSearch?: (query: string, resultCount: number) => void
}): BrowseShellView {
  const root = el("section", { class: "wr-browseshell" })

  // Sticky tab strip — kept simple: shares the same wr-sticky styling so it
  // pins below any host chrome and gets the scroll-shadow rule.
  const tabStrip = el("div", { class: "wr-browse-tabs" })
  root.appendChild(tabStrip)

  const initialPrefs = prefsStore.load()
  let active: BrowseTab = initialPrefs.browseTab ?? "languages"

  const langPanel = el("div", { class: "wr-tabpanel", "data-tab": "languages" })
  const mapPanel = el("div", { class: "wr-tabpanel", "data-tab": "map" })
  root.appendChild(langPanel)
  root.appendChild(mapPanel)

  const langView: LanguageListView = createLanguageListView({
    initialStack: opts.initialStack,
    onSelect: opts.onSelectLanguage,
  })
  langPanel.appendChild(langView.root)

  const mapView: GlobalMapView = createGlobalMapView({
    onPlay: opts.onPlay,
    onShowInList: opts.onShowInList,
    onLanguageFilter: opts.onLanguageFilter,
    onTagFilter: opts.onTagFilter,
    onSearch: opts.onSearch,
  })
  mapPanel.appendChild(mapView.root)

  function applyActive() {
    langPanel.style.display = active === "languages" ? "" : "none"
    mapPanel.style.display = active === "map" ? "" : "none"
    root.setAttribute("data-active-tab", active)
    if (active === "map") {
      mapView.activate()
      opts.onMapTabActivated?.()
    }
  }

  const toggle = createSegmentedToggle<BrowseTab>({
    options: [
      { value: "languages", label: "Languages", icon: ICON_LIST },
      { value: "map", label: "World map", icon: ICON_MAP },
    ],
    value: active,
    onChange: (next) => {
      if (next === active) return
      active = next
      prefsStore.save({ ...prefsStore.load(), browseTab: next })
      applyActive()
    },
  })
  tabStrip.appendChild(toggle.root)

  applyActive()

  return {
    root,
    setStack(codes) {
      langView.setStack(codes)
    },
    async refresh() {
      await langView.refresh()
    },
    setActiveStation(uuid) {
      mapView.setActiveStation(uuid)
    },
    dispose() {
      langView.dispose()
      mapView.dispose()
    },
  }
}
