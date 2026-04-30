/**
 * Root mount for World Radio.
 *
 * Owns the navigation stack (browse → station list), the player + media
 * session glue, the host stack-config subscription, and analytics lifecycle.
 */

import type { HostApi, StackConfig } from "./sdk/types"
import { corpanToRadioLanguage, displayName } from "./api/languageMap"
import type { RadioStation } from "./api/radioBrowser"
import { createRadioPlayer } from "./audio/radioPlayer"
import type { PlayerState } from "./audio/radioPlayer"
import { attachMediaSession } from "./audio/mediaSessionGlue"
import { createLanguageListView } from "./views/languageList"
import { createStationListView } from "./views/stationList"
import { createPlayerBar } from "./views/playerBar"
import { prefsStore, recentsStore, toLite } from "./state/stores"
import { clear, el } from "./ui/dom"
import {
  initAnalytics,
  shutdownAnalytics,
  trackBrowseOpened,
  trackFavoriteToggled,
  trackLanguageBrowsed,
  trackStationError,
  trackStationPlay,
  trackStationStop,
} from "./analytics"

export type App = {
  dispose: () => void
}

export function mountApp(
  container: HTMLElement,
  hostApi: HostApi,
  initialState?: { stackConfig?: StackConfig }
): App {
  initAnalytics()

  container.classList.add("wr-root")

  const main = el("main", { class: "wr-main" })
  container.appendChild(main)

  const prefs = prefsStore.load()
  const player = createRadioPlayer(prefs.volume)
  const mediaGlue = attachMediaSession(player)
  void mediaGlue

  const playerBar = createPlayerBar(player)
  container.appendChild(playerBar.root)

  // Persist volume changes (debounced via raf to avoid hammering localStorage).
  let volumePersistRaf = 0
  const volumeUnsub = player.subscribe(() => {
    if (volumePersistRaf) return
    volumePersistRaf = requestAnimationFrame(() => {
      volumePersistRaf = 0
      prefsStore.save({ ...prefsStore.load(), volume: player.getVolume() })
    })
  })

  // --- Analytics: track station play/stop/error transitions ---
  // We track the active language context separately because it's the corpan
  // code (e.g. "fa"), not the loose Radio Browser string on the station.
  let activeCorpanCode: string | null = null
  let lastReportedPlayUuid: string | null = null
  let playStartedAt: number | null = null
  let lastPlayingState: { station: RadioStation; corpanCode: string } | null = null

  const analyticsUnsub = player.subscribe((state: PlayerState) => {
    const isPlaying = state.kind === "playing"
    const wasPlaying = lastPlayingState !== null

    if (isPlaying) {
      const station = state.station
      // Switching to a new station — close out the previous one first.
      if (wasPlaying && lastPlayingState && lastPlayingState.station.stationuuid !== station.stationuuid) {
        const dur = playStartedAt ? Date.now() - playStartedAt : 0
        trackStationStop(lastPlayingState.corpanCode, lastPlayingState.station, dur)
      }
      // Track new station play (deduped against rapid loading→playing flutter).
      if (lastReportedPlayUuid !== station.stationuuid && activeCorpanCode) {
        trackStationPlay(activeCorpanCode, station)
        lastReportedPlayUuid = station.stationuuid
        playStartedAt = Date.now()
        lastPlayingState = { station, corpanCode: activeCorpanCode }
      }
    } else if (state.kind === "error" && lastPlayingState) {
      // Errored mid-playback or while loading — report and clear.
      trackStationError(lastPlayingState.corpanCode, state.station, state.message)
      const dur = playStartedAt ? Date.now() - playStartedAt : 0
      trackStationStop(lastPlayingState.corpanCode, lastPlayingState.station, dur)
      lastReportedPlayUuid = null
      playStartedAt = null
      lastPlayingState = null
    } else if (state.kind === "idle" && wasPlaying && lastPlayingState) {
      // User explicitly stopped.
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
    activeCorpanCode = null
    clear(main)
    main.appendChild(browseView.root)
    void browseView.refresh()
    trackBrowseOpened()
  }

  function openStationList(corpanCode: string) {
    const radioName = corpanToRadioLanguage(corpanCode)
    if (!radioName) {
      console.error(`[world-radio] no radio mapping for ${corpanCode}`)
      return
    }
    activeCorpanCode = corpanCode

    const view = createStationListView({
      corpanCode,
      radioName,
      onBack: () => {
        view.dispose()
        activeStationListDispose = null
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
      },
    })
    activeStationListDispose?.()
    activeStationListDispose = view.dispose
    clear(main)
    main.appendChild(view.root)

    // If a station is already playing, mark its row.
    const state = player.getState()
    if (state.kind === "playing" || state.kind === "paused" || state.kind === "loading") {
      view.setActiveStation(state.station.stationuuid)
    }
    document.title = `${displayName(corpanCode)} · World Radio`
  }

  async function playStation(station: RadioStation) {
    recentsStore.push(toLite(station))
    prefsStore.save({ ...prefsStore.load(), lastStationUuid: station.stationuuid })
    await player.play(station)
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
      stackUnsub?.()
      activeStationListDispose?.()
      browseView.dispose()
      mediaGlue.dispose()
      player.dispose()
      playerBar.dispose()
      shutdownAnalytics()
      container.classList.remove("wr-root")
      clear(container)
    },
  }
}
