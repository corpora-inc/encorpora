/**
 * Root mount for World Radio.
 *
 * Owns the navigation stack (browse → station list), the player + media
 * session glue, the host stack-config subscription, analytics lifecycle, and
 * a handful of root-level UI state (has-player class, scrolled-state class
 * for sticky-header shadow, first-open hint toast).
 */

import type { HostApi, StackConfig } from "./sdk/types"
import { corpanToRadioLanguage, displayName } from "./api/languageMap"
import type { RadioStation } from "./api/radioBrowser"
import { createRadioPlayer } from "./audio/radioPlayer"
import type { PlayerState } from "./audio/radioPlayer"
import { attachMediaSession } from "./audio/mediaSessionGlue"
import { createLanguageListView } from "./views/languageList"
import { createStationListView, type StationListView } from "./views/stationList"
import { createPlayerBar } from "./views/playerBar"
import { prefsStore, recentsStore, toLite } from "./state/stores"
import { clear, el } from "./ui/dom"
import {
  initAnalytics,
  shutdownAnalytics,
  trackBrowseOpened,
  trackFavoriteToggled,
  trackLanguageBrowsed,
  trackMapViewOpened,
  trackSearchPerformed,
  trackSortChanged,
  trackStationError,
  trackStationPlay,
  trackStationStop,
  trackTagFilter,
} from "./analytics"

const HINT_KEY = "worldRadio.hints.v1"
const HINT_FLAG_LANGUAGE_DETAIL = "language_detail_seen"

export type App = {
  dispose: () => void
}

export async function mountApp(
  container: HTMLElement,
  hostApi: HostApi,
  initialState?: { stackConfig?: StackConfig }
): Promise<App> {
  initAnalytics()

  container.classList.add("wr-root")

  const main = el("main", { class: "wr-main" })
  container.appendChild(main)

  // Close-pack button — fires the `corpan:exit` window event the host listens
  // for (corpan-app/src/App.tsx) to dismiss the pack overlay and return to
  // Corpan. Without this there's no in-pack way back to the host.
  const closeBtn = el("button", {
    class: "wr-close-pack",
    type: "button",
    "aria-label": "Close pack",
    title: "Close",
  }, ["×"])
  closeBtn.addEventListener("click", () => {
    try { player.stop() } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  })
  container.appendChild(closeBtn)

  const prefs = prefsStore.load()
  // Async: probes the host for the native `radio-stream` plugin and picks
  // the native or WebView player accordingly. ~50 ms round-trip on Tauri,
  // immediate (resolved promise) in browser dev.
  const player = await createRadioPlayer(prefs.volume)
  const mediaGlue = attachMediaSession(player)
  void mediaGlue

  let currentStationListView: StationListView | null = null

  const playerBar = createPlayerBar(player, {
    onMetaTap: (station) => {
      // Smart nav: send the user to the station's language detail (not the
      // language they're currently browsing). Prefer map view when the
      // station has coordinates so they can see *where* it's coming from;
      // otherwise list mode with the row scrolled into view.
      const corpanCode = lastPlayingState?.corpanCode ?? activeCorpanCode
      if (!corpanCode) return
      const hasGeo =
        typeof station.geo_lat === "number" &&
        typeof station.geo_long === "number" &&
        Number.isFinite(station.geo_lat as number) &&
        Number.isFinite(station.geo_long as number)
      openStationList(corpanCode, {
        focusUuid: station.stationuuid,
        initialView: hasGeo ? "map" : "list",
      })
    },
  })
  container.appendChild(playerBar.root)

  // --- has-player class drives the main scroll inset for the bar ---
  const playerInsetUnsub = player.subscribe((state) => {
    container.classList.toggle("has-player", state.kind !== "idle")
  })

  // --- is-scrolled class for sticky-header bottom-rule fade-in ---
  let scrollRaf = 0
  const onScroll = () => {
    if (scrollRaf) return
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0
      container.classList.toggle("is-scrolled", main.scrollTop > 4)
    })
  }
  main.addEventListener("scroll", onScroll, { passive: true })

  // Persist volume changes (debounced via raf to avoid hammering localStorage).
  let volumePersistRaf = 0
  const volumeUnsub = player.subscribe(() => {
    if (volumePersistRaf) return
    volumePersistRaf = requestAnimationFrame(() => {
      volumePersistRaf = 0
      prefsStore.save({ ...prefsStore.load(), volume: player.getVolume() })
    })
  })

  // --- Active station + EQ glyph propagation to the station list view ---
  const stationListSyncUnsub = player.subscribe((state) => {
    if (!currentStationListView) return
    if (state.kind === "playing" || state.kind === "paused" || state.kind === "loading") {
      currentStationListView.setActiveStation(state.station.stationuuid)
      currentStationListView.setPlayerKind(state.kind)
    } else {
      currentStationListView.setActiveStation(null)
      currentStationListView.setPlayerKind("idle")
    }
  })

  // --- Analytics: track station play/stop/error transitions ---
  let activeCorpanCode: string | null = null
  let lastReportedPlayUuid: string | null = null
  let playStartedAt: number | null = null
  let lastPlayingState: { station: RadioStation; corpanCode: string } | null = null

  const analyticsUnsub = player.subscribe((state: PlayerState) => {
    const isPlaying = state.kind === "playing"
    const wasPlaying = lastPlayingState !== null

    if (isPlaying) {
      const station = state.station
      if (wasPlaying && lastPlayingState && lastPlayingState.station.stationuuid !== station.stationuuid) {
        const dur = playStartedAt ? Date.now() - playStartedAt : 0
        trackStationStop(lastPlayingState.corpanCode, lastPlayingState.station, dur)
      }
      if (lastReportedPlayUuid !== station.stationuuid && activeCorpanCode) {
        trackStationPlay(activeCorpanCode, station)
        lastReportedPlayUuid = station.stationuuid
        playStartedAt = Date.now()
        lastPlayingState = { station, corpanCode: activeCorpanCode }
      }
    } else if (state.kind === "error" && lastPlayingState) {
      trackStationError(lastPlayingState.corpanCode, state.station, state.message)
      const dur = playStartedAt ? Date.now() - playStartedAt : 0
      trackStationStop(lastPlayingState.corpanCode, lastPlayingState.station, dur)
      lastReportedPlayUuid = null
      playStartedAt = null
      lastPlayingState = null
    } else if (state.kind === "idle" && wasPlaying && lastPlayingState) {
      const dur = playStartedAt ? Date.now() - playStartedAt : 0
      trackStationStop(lastPlayingState.corpanCode, lastPlayingState.station, dur)
      lastReportedPlayUuid = null
      playStartedAt = null
      lastPlayingState = null
    }
  })

  let currentStack: string[] = initialState?.stackConfig?.languages ?? hostApi.getStackConfig().languages
  let activeStationListDispose: (() => void) | null = null

  const browseView = createLanguageListView({
    initialStack: currentStack,
    onSelect: (corpanCode) => openStationList(corpanCode),
  })

  function showBrowse() {
    closeBtn.style.display = ""
    activeCorpanCode = null
    currentStationListView = null
    clear(main)
    main.appendChild(browseView.root)
    void browseView.refresh()
    trackBrowseOpened()
    container.classList.remove("is-scrolled")
  }

  function openStationList(
    corpanCode: string,
    options: { focusUuid?: string; initialView?: "list" | "map" } = {}
  ) {
    const radioName = corpanToRadioLanguage(corpanCode)
    if (!radioName) {
      console.error(`[world-radio] no radio mapping for ${corpanCode}`)
      return
    }
    // Detail views have their own back button; the pack-close X would be
    // redundant noise. Only show it on the browse (language list) screen.
    closeBtn.style.display = "none"
    activeCorpanCode = corpanCode

    const view = createStationListView({
      corpanCode,
      radioName,
      onBack: () => {
        view.dispose()
        activeStationListDispose = null
        currentStationListView = null
        showBrowse()
      },
      onPlay: (station) => {
        void playStation(station)
        view.setActiveStation(station.stationuuid)
      },
      onFavoriteToggled: (station, added) => {
        trackFavoriteToggled(corpanCode, station, added)
      },
      onStationsLoaded: (count) => {
        trackLanguageBrowsed(corpanCode, radioName, count)
        // First-open hint toast.
        if (!hintShown(HINT_FLAG_LANGUAGE_DETAIL)) {
          showHint("Tap any station to play. Search to narrow, ⊞ for the map.")
          markHintShown(HINT_FLAG_LANGUAGE_DETAIL)
        }
        // focusUuid is handled inside the station-list view itself.
      },
      onSearch: (query, resultCount) => {
        trackSearchPerformed(corpanCode, query, resultCount)
      },
      onSortChanged: (sortKey) => {
        trackSortChanged(corpanCode, sortKey)
      },
      onTagFilter: (tag, applied) => {
        trackTagFilter(corpanCode, tag, applied)
      },
      onMapView: (markerCount) => {
        trackMapViewOpened(corpanCode, markerCount)
      },
      initialView: options.initialView,
      focusUuid: options.focusUuid,
    })
    activeStationListDispose?.()
    activeStationListDispose = () => view.dispose()
    currentStationListView = view
    clear(main)
    main.appendChild(view.root)

    // If a station is already playing, mark its row + glyph state.
    const state = player.getState()
    if (state.kind === "playing" || state.kind === "paused" || state.kind === "loading") {
      view.setActiveStation(state.station.stationuuid)
      view.setPlayerKind(state.kind)
    }
    document.title = `${displayName(corpanCode)} · World Radio`
    container.classList.remove("is-scrolled")
    main.scrollTop = 0
  }

  async function playStation(station: RadioStation) {
    recentsStore.push(toLite(station))
    prefsStore.save({ ...prefsStore.load(), lastStationUuid: station.stationuuid })
    await player.play(station)
  }

  // --- Hint toast ---
  let hintTimer: number | null = null
  let hintEl: HTMLElement | null = null
  function showHint(text: string) {
    if (hintEl) {
      hintEl.remove()
      hintEl = null
    }
    if (hintTimer) {
      window.clearTimeout(hintTimer)
      hintTimer = null
    }
    const node = el("div", { class: "wr-hint", role: "status" }, [text])
    container.appendChild(node)
    requestAnimationFrame(() => node.classList.add("is-visible"))
    hintEl = node
    hintTimer = window.setTimeout(() => {
      node.classList.remove("is-visible")
      window.setTimeout(() => {
        if (node.parentNode) node.parentNode.removeChild(node)
        if (hintEl === node) hintEl = null
      }, 320)
    }, 3500)
  }

  function hintShown(flag: string): boolean {
    try {
      const raw = localStorage.getItem(HINT_KEY)
      if (!raw) return false
      const obj = JSON.parse(raw) as Record<string, boolean>
      return !!obj[flag]
    } catch {
      return false
    }
  }
  function markHintShown(flag: string): void {
    try {
      const raw = localStorage.getItem(HINT_KEY)
      const obj = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
      obj[flag] = true
      localStorage.setItem(HINT_KEY, JSON.stringify(obj))
    } catch (err) {
      console.error("[world-radio] hint persist failed:", err)
    }
  }

  // React to host stack changes.
  const stackUnsub = hostApi.onStackConfigChange?.((next) => {
    currentStack = next.languages
    browseView.setStack(currentStack)
  })

  showBrowse()

  return {
    dispose() {
      volumeUnsub()
      analyticsUnsub()
      playerInsetUnsub()
      stationListSyncUnsub()
      stackUnsub?.()
      main.removeEventListener("scroll", onScroll)
      activeStationListDispose?.()
      browseView.dispose()
      mediaGlue.dispose()
      player.dispose()
      playerBar.dispose()
      shutdownAnalytics()
      if (hintEl) hintEl.remove()
      if (hintTimer) window.clearTimeout(hintTimer)
      container.classList.remove("wr-root", "has-player", "is-scrolled")
      clear(container)
    },
  }
}
