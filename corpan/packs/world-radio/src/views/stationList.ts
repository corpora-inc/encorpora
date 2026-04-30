/**
 * Station list for a single language.
 * Top stations first (ordered by clickcount server-side), with codec/bitrate/country meta.
 */

import { displayName } from "../api/languageMap"
import { getStationsByLanguage } from "../api/radioBrowser"
import type { RadioStation } from "../api/radioBrowser"
import { el, clear } from "../ui/dom"
import { ICON_BACK, ICON_STAR_FILLED, ICON_STAR_OUTLINE } from "../ui/icons"
import { favoritesStore, toLite } from "../state/stores"

export type StationListView = {
  root: HTMLElement
  setActiveStation: (stationuuid: string | null) => void
  dispose: () => void
}

export function createStationListView(opts: {
  corpanCode: string
  radioName: string
  onBack: () => void
  onPlay: (station: RadioStation) => void
  onFavoriteToggled?: (station: RadioStation, added: boolean) => void
  onStationsLoaded?: (count: number) => void
}): StationListView {
  const root = el("section", { class: "wr-stationlist" })

  const header = el("header", { class: "wr-header" })
  const back = el("button", {
    class: "wr-back",
    type: "button",
    "aria-label": "Back",
    html: ICON_BACK,
  })
  back.addEventListener("click", () => opts.onBack())
  header.appendChild(back)
  header.appendChild(el("h1", { class: "wr-title" }, [displayName(opts.corpanCode)]))

  const status = el("p", { class: "wr-status" }, ["Loading stations…"])
  const list = el("ul", { class: "wr-list" })

  root.appendChild(header)
  root.appendChild(status)
  root.appendChild(list)

  let activeUuid: string | null = null
  let disposed = false

  function render(stations: RadioStation[]) {
    if (disposed) return
    clear(list)
    if (stations.length === 0) {
      status.style.display = ""
      status.textContent = `No playable ${displayName(opts.corpanCode)} stations found right now.`
      return
    }
    status.style.display = "none"

    for (const station of stations) {
      list.appendChild(stationRow(station))
    }
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
    main.addEventListener("click", () => opts.onPlay(station))

    main.appendChild(el("span", { class: "wr-station-name" }, [station.name || "Untitled station"]))
    main.appendChild(el("span", { class: "wr-station-meta" }, [stationMeta(station)]))
    li.appendChild(main)

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

  void (async () => {
    try {
      const stations = await getStationsByLanguage(opts.radioName)
      render(stations)
      opts.onStationsLoaded?.(stations.length)
    } catch (err) {
      console.error("[world-radio] station list load failed:", err)
      status.textContent = "Couldn't load stations. Check your connection."
    }
  })()

  return {
    root,
    setActiveStation(uuid) {
      activeUuid = uuid
      for (const li of Array.from(list.children) as HTMLElement[]) {
        li.classList.toggle("is-active", li.getAttribute("data-uuid") === uuid)
      }
    },
    dispose() {
      disposed = true
    },
  }
}

function stationMeta(s: RadioStation): string {
  const parts: string[] = []
  if (s.country) parts.push(s.country)
  if (s.codec) parts.push(s.codec.toUpperCase())
  if (s.bitrate > 0) parts.push(`${s.bitrate} kbps`)
  return parts.join(" · ")
}
