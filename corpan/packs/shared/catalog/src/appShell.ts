/**
 * App Shell — wraps a reader (stargate/earthgate) with a unified command drawer.
 *
 * Manages:
 * - Command drawer (trigger button, now playing, language, library, browse, exit)
 * - Catalog browser overlay (within drawer browse section)
 * - Book detail view (inline in drawer)
 * - Dispose-remount for book switching
 * - Custom section injection from readers (e.g. stargate display settings)
 */

import "./catalog.css"
import type { CatalogNarrationEntry, DownloadState } from "./types"
import { fetchCatalog } from "./catalogFetch"
import { libraryStore, isInstalled, getInstalled, listInstalled, listInstalledForBook } from "./libraryStore"
import { startListening } from "./downloadProgress"
import { getPackUrl, isTauriAvailable, installNarration, deleteNarration } from "./installManager"
import { subscribe as subscribeProgress, getState as getProgressState } from "./downloadProgress"
import {
  groupBySeries,
  filterByLanguage,
  searchByTitle,
  getAvailableLanguages,
  getLanguageName,
} from "./searchFilter"
import { hasUpdate } from "./versionUtil"
import {
  createCommandDrawer,
  type CommandDrawer,
  type DrawerSectionDef,
} from "../../ui/commandDrawer"
import { drawerStore } from "../../state/drawerStore"

const DEFAULT_CDN_URL = "https://d38iwc9748jekz.cloudfront.net/catalog.json"

export type ReaderFactory = (
  container: HTMLElement,
  hostApi: unknown,
  initialState?: Record<string, unknown>
) => { dispose: () => void; isPlaying?: () => boolean }

export type AppShellOptions = {
  /** Unique ID for this reader (e.g. "earthgate", "stargate"). Scopes persisted state so readers don't share narration selection. */
  readerId: string
  cdnUrl?: string
  createReader: ReaderFactory
  hostApi: unknown
  initialState?: Record<string, unknown>
  /** Custom drawer sections injected by readers (e.g. stargate display settings) */
  customSections?: DrawerSectionDef[]
  /** Called before exit */
  onBeforeExit?: () => void
}

export type AppShell = {
  dispose: () => void
  /** Get the command drawer instance */
  getDrawer: () => CommandDrawer
}

export function createAppShell(
  container: HTMLElement,
  opts: AppShellOptions
): AppShell {
  const cdnUrl = opts.cdnUrl || DEFAULT_CDN_URL

  // Force synchronous hydration — zustand/persist hydrates in a microtask,
  // but we need the persisted data NOW during synchronous construction.
  function forceHydrate(store: { setState: (s: Record<string, unknown>) => void }, key: string) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.state) store.setState(parsed.state)
      }
    } catch { /* ignore */ }
  }

  const drawerKey = `corpan-drawer:${opts.readerId}`

  forceHydrate(libraryStore, "corpan-library")
  forceHydrate(drawerStore, drawerKey)

  let disposed = false
  let readerInstance: { dispose: () => void; isPlaying?: () => boolean } | null = null

  // Re-entrancy guard — prevents store subscription from re-triggering
  // switchToNarration while we're already inside it.
  let switching = false

  // THE canonical read. Every piece of code that needs the current narration
  // reads from this ONE place: drawerStore.
  function getActive(): string {
    return drawerStore.getState().currentNarrationId
  }

  // All narrations from the last catalog fetch
  let allNarrations: CatalogNarrationEntry[] = []
  const progressUnsubs: (() => void)[] = []

  // Start listening for download progress events
  void startListening()

  // --- State for section renderers (must be before createCommandDrawer,
  //     which calls render() immediately during construction) ---
  let librarySectionEl: HTMLElement | null = null
  let browseSectionEl: HTMLElement | null = null
  let browseActiveLang = ""
  let browseSearchQuery = ""
  let browseShowingDetail = false

  // --- Now-playing section state ---
  let nowPlayingSectionEl: HTMLElement | null = null
  let nowPlayingBookId = ""   // track displayed book to avoid full rebuild

  // --- Detail section state ---
  let detailBookId = ""       // track displayed book in detail screen

  // --- Build drawer sections ---
  const builtinSections: DrawerSectionDef[] = [
    {
      id: "now-playing",
      title: "",
      priority: 10,
      render: (container) => renderNowPlayingSection(container),
    },
    {
      id: "library",
      title: "My Library",
      priority: 20,
      render: (container) => renderLibrarySection(container),
    },
    {
      id: "browse",
      title: "Browse",
      priority: 30,
      render: (container) => renderBrowseSection(container),
    },
  ]

  const allSections = [
    ...builtinSections,
    ...(opts.customSections || []),
  ]

  // --- Command Drawer ---
  const drawer = createCommandDrawer(container, {
    cdnUrl,
    customSections: allSections,
    onExit: () => {
      opts.onBeforeExit?.()
      dispose()  // Stop audio NOW — don't rely on external handlers
      window.dispatchEvent(new Event("corpan:exit"))
    },
    onOpen: () => {
      // Bypass CDN cache on drawer open so user sees latest publishes
      void fetchCatalog(cdnUrl, { forceRefresh: true }).then((catalog) => {
        allNarrations = catalog.narrations
        refreshNowPlayingSection()
        refreshBrowseSection()
        refreshLibrarySection()
      })
    },
  })

  // Subscribe to store for minimal active-row update (avoids full re-render FUOC)
  const storeUnsub = drawerStore.subscribe((state, prev) => {
    if (state.currentNarrationId !== prev.currentNarrationId) {
      if (browseShowingDetail) updateDetailActiveRow(state.currentNarrationId)
      refreshLibrarySection()
      refreshNowPlayingSection()
    }
  })

  function updateDetailActiveRow(activeId: string | undefined): void {
    if (!browseSectionEl) return
    const rows = browseSectionEl.querySelectorAll("[data-narration-id]")
    for (const row of rows) {
      const el = row as HTMLElement
      const isActive = el.dataset.narrationId === activeId
      el.classList.toggle("catalog-narration-row--active", isActive)
      // Update checkmark indicator
      const existing = el.querySelector(".catalog-narration-active-indicator")
      if (isActive && !existing) {
        const check = document.createElement("div")
        check.className = "catalog-narration-active-indicator"
        check.textContent = "\u2713"
        // Insert before delete button
        const delBtn = el.querySelector(".catalog-btn--danger")
        if (delBtn) {
          el.insertBefore(check, delBtn)
        } else {
          el.appendChild(check)
        }
      } else if (!isActive && existing) {
        existing.remove()
      }
    }
  }

  /** Surgical update of narration rows within a container — no teardown/rebuild.
   *  Handles active indicator toggling and installed-state class updates.
   *  Falls back to full rebuild if row count has changed (install/delete). */
  function updateNarrationRows(container: HTMLElement, activeId: string): void {
    const rows = container.querySelectorAll("[data-narration-id]")
    if (rows.length === 0) return

    // Check if installed count changed (a narration was added or removed)
    const installedRows = container.querySelectorAll(".catalog-narration-row--installed")
    const currentInstalledCount = [...new Set(
      Array.from(installedRows).map(r => (r as HTMLElement).dataset.narrationId)
    )].filter(id => id && isInstalled(id)).length

    if (currentInstalledCount !== installedRows.length) {
      // Installed state changed — need full rebuild to add/remove rows
      if (container === nowPlayingSectionEl) {
        nowPlayingBookId = "" // force full rebuild
        refreshNowPlayingSection()
      } else {
        detailBookId = "" // force full rebuild
        renderBookDetail()
      }
      return
    }

    // Same rows — just update active state
    for (const row of rows) {
      const el = row as HTMLElement
      const isActive = el.dataset.narrationId === activeId
      el.classList.toggle("catalog-narration-row--active", isActive)

      // Toggle checkmark
      const existing = el.querySelector(".catalog-narration-active-indicator")
      if (isActive && !existing) {
        const check = document.createElement("div")
        check.className = "catalog-narration-active-indicator"
        check.textContent = "\u2713"
        const delBtn = el.querySelector(".catalog-btn--danger")
        if (delBtn) el.insertBefore(check, delBtn)
        else el.appendChild(check)
      } else if (!isActive && existing) {
        existing.remove()
      }
    }
  }

  // Subscribe for pill-triggered narration switches.
  // When the user taps a pill, commandDrawer sets drawerStore.currentNarrationId.
  // We detect that here and call switchToNarration to remount the reader.
  // The `switching` guard prevents re-entrancy (switchToNarration also sets the store).
  const narrUnsub = drawerStore.subscribe((state, prev) => {
    if (
      !switching &&
      state.currentNarrationId !== prev.currentNarrationId &&
      state.currentNarrationId
    ) {
      switchToNarration(state.currentNarrationId, false)
    }
  })

  // Persist scoped drawer state on change
  const persistUnsub = drawerStore.subscribe(() => {
    const { currentLanguage, currentNarrationId } = drawerStore.getState()
    try {
      localStorage.setItem(
        drawerKey,
        JSON.stringify({ state: { currentLanguage, currentNarrationId } })
      )
    } catch { /* quota exceeded, etc */ }
  })

  // --- Init: restore persisted narration → first installed → onboard ---
  const persistedId = drawerStore.getState().currentNarrationId
  const installed = listInstalled()

  if (persistedId && isInstalled(persistedId)) {
    // Restore exactly where we left off
    switchToNarration(persistedId)
  } else if (installed.length > 0) {
    // Pick most recently installed
    switchToNarration(installed[0].narrationId)
  } else {
    // Nothing installed — onboard to browse screen
    drawerStore.setState({ activeScreen: "browse" })
    drawer.open()
    void fetchCatalog(cdnUrl).then((catalog) => {
      allNarrations = catalog.narrations
      refreshBrowseSection()
    })
  }

  // --- Reader management ---
  function mountReader(state?: Record<string, unknown>): void {
    if (readerInstance) {
      readerInstance.dispose()
      readerInstance = null
    }

    readerInstance = opts.createReader(container, opts.hostApi, state)

    // Re-attach drawer trigger to the reader's UI overlay
    const uiOverlay = container.querySelector(
      ".stargate-ui, .earthgate-ui"
    ) as HTMLElement | null
    if (uiOverlay) {
      uiOverlay.append(drawer.getTrigger())
    }
  }

  /** THE one function for activating a narration. Sets the canonical store,
   *  mounts the reader, and updates pills. Nothing else writes narration state. */
  function switchToNarration(narrationId: string, closeDrawer = false): void {
    if (!isInstalled(narrationId)) return
    const info = getInstalled(narrationId)
    if (!info) return

    // Capture play state before disposing old reader
    const wasPlaying = readerInstance?.isPlaying?.() ?? false

    // Set the canonical store FIRST, inside the guard
    switching = true
    drawerStore.setState({ currentNarrationId: narrationId, currentLanguage: info.language })
    switching = false

    // Build initialState for the new reader instance
    const packUrl = getPackUrl(narrationId)
    const newState: Record<string, unknown> = {
      ...opts.initialState,
      baseUrl: packUrl,
      bookId: info.bookId,
      bookTitle: info.bookTitle,
      language: info.language,
      autoPlay: wasPlaying,
      startAtSegmentStart: true,
    }

    if (closeDrawer) drawer.close()
    mountReader(newState)
    updateDrawerNarrationPills(info.bookId)
  }

  /** Build language pills from installed narrations for a book.
   *  Only sets `languages` in the store — currentNarrationId is already set by switchToNarration. */
  function updateDrawerNarrationPills(bookId: string): void {
    const installed = listInstalledForBook(bookId)
    if (installed.length === 0) {
      drawerStore.setState({ languages: [] })
      return
    }

    // Count narrations per language to decide label format
    const langCounts = new Map<string, number>()
    for (const n of installed) {
      langCounts.set(n.language, (langCounts.get(n.language) || 0) + 1)
    }

    const pills: import("../../ui/commandDrawer").LanguageInfo[] = installed.map(n => {
      const multiVoice = (langCounts.get(n.language) || 0) > 1
      return {
        code: n.language,
        displayName: multiVoice
          ? `${getLanguageName(n.language)} \u00B7 ${n.voiceName}`
          : getLanguageName(n.language),
        narrator: n.voiceName,
        narrationId: n.narrationId,
      }
    })

    drawerStore.setState({ languages: pills })
  }

  // --- Now Playing section rendering ---
  function renderNowPlayingSection(container: HTMLElement): void {
    nowPlayingSectionEl = container
    refreshNowPlayingSection()
  }

  function refreshNowPlayingSection(): void {
    if (!nowPlayingSectionEl) return

    const activeId = getActive()
    if (!activeId) {
      nowPlayingBookId = ""
      nowPlayingSectionEl.innerHTML = ""
      const empty = document.createElement("div")
      empty.className = "command-drawer-browse-empty"
      empty.textContent = "No book selected"
      nowPlayingSectionEl.appendChild(empty)
      return
    }

    // Find the current book's narrations from the catalog
    const installedInfo = getInstalled(activeId)
    if (!installedInfo) return
    const bookId = installedInfo.bookId

    // Same book — surgical row update instead of full rebuild
    if (bookId === nowPlayingBookId && nowPlayingSectionEl.querySelector("[data-narration-id]")) {
      updateNarrationRows(nowPlayingSectionEl, activeId)
      return
    }

    nowPlayingBookId = bookId
    nowPlayingSectionEl.innerHTML = ""

    const bookNarrations = allNarrations.filter(n => n.bookId === bookId)

    if (bookNarrations.length === 0) {
      // Catalog not loaded yet — show just installed info
      const title = document.createElement("div")
      title.className = "command-drawer-detail-title"
      title.textContent = installedInfo.bookTitle
      nowPlayingSectionEl.appendChild(title)
      return
    }

    // Render the same detail UI used by the browse detail screen
    const detail = document.createElement("div")
    detail.className = "command-drawer-detail"

    const first = bookNarrations[0]

    // Title
    const title = document.createElement("div")
    title.className = "command-drawer-detail-title"
    title.textContent = first.bookTitle
    detail.appendChild(title)

    if (first.series) {
      const subtitle = document.createElement("div")
      subtitle.className = "command-drawer-detail-subtitle"
      subtitle.textContent = first.series + (first.volume ? ` \u00B7 Vol. ${first.volume}` : "")
      detail.appendChild(subtitle)
    }

    // Installed narrations
    const installedNarrs = bookNarrations.filter(n => isInstalled(n.id))
    const availableNarrs = bookNarrations.filter(n => !isInstalled(n.id))
    const active = getActive()

    for (const narr of installedNarrs) {
      const row = document.createElement("div")
      row.className = "catalog-narration-row catalog-narration-row--installed"
      row.dataset.narrationId = narr.id
      if (narr.id === active) {
        row.classList.add("catalog-narration-row--active")
      }
      row.style.cursor = "pointer"

      const info = document.createElement("div")
      info.className = "catalog-narration-info"

      const lang = document.createElement("div")
      lang.className = "catalog-narration-lang"
      lang.textContent = getLanguageName(narr.language)

      const voice = document.createElement("div")
      voice.className = "catalog-narration-voice"
      voice.textContent = narr.voiceName

      const instInfo = getInstalled(narr.id)
      const versionDiv = document.createElement("div")
      if (instInfo && hasUpdate(narr.version, instInfo.version)) {
        versionDiv.className = "catalog-narration-version catalog-narration-version--update"
        versionDiv.textContent = `v${instInfo.version} \u2192 v${narr.version}`
      } else if (instInfo) {
        versionDiv.className = "catalog-narration-version"
        versionDiv.textContent = `v${instInfo.version}`
      }

      info.append(lang, voice, versionDiv)
      row.appendChild(info)

      // Active indicator
      if (narr.id === active) {
        const check = document.createElement("div")
        check.className = "catalog-narration-active-indicator"
        check.textContent = "\u2713"
        row.appendChild(check)
      }

      // Update button
      if (instInfo && hasUpdate(narr.version, instInfo.version)) {
        const updateBtn = document.createElement("button")
        updateBtn.className = "catalog-btn catalog-btn--update"
        updateBtn.innerHTML = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2"/></svg>`
        updateBtn.title = "Update"
        updateBtn.addEventListener("click", async (e) => {
          e.stopPropagation()
          updateBtn.className = "catalog-btn catalog-btn--downloading"
          updateBtn.innerHTML = `<div class="catalog-btn-indeterminate"></div><span class="catalog-btn-label">Connecting\u2026</span>`
          const unsub = subscribeProgress(narr.id, (ds) => {
            if (ds.stage === "downloading") {
              const pct = ds.total > 0 ? Math.round((ds.progress / ds.total) * 100) : 0
              const downloaded = ds.progress > 0 ? (ds.progress / 1048576).toFixed(1) : "0"
              const total = ds.total > 0 ? (ds.total / 1048576).toFixed(0) : "?"
              updateBtn.innerHTML = `<span class="catalog-btn-label">${pct}% \u00B7 ${downloaded}/${total} MB</span><div class="catalog-btn-progress" style="width:${pct}%"></div>`
            } else if (ds.stage === "verifying") {
              updateBtn.innerHTML = `<div class="catalog-btn-indeterminate"></div><span class="catalog-btn-label">Verifying\u2026</span>`
            } else if (ds.stage === "extracting") {
              updateBtn.innerHTML = `<div class="catalog-btn-indeterminate"></div><span class="catalog-btn-label">Installing\u2026</span>`
            } else if (ds.stage === "complete") {
              refreshNowPlayingSection()
            }
          })
          progressUnsubs.push(unsub)
          await installNarration(narr)
          refreshNowPlayingSection()
        })
        row.appendChild(updateBtn)
      }

      // Delete button
      const delBtn = document.createElement("button")
      delBtn.className = "catalog-btn catalog-btn--danger"
      delBtn.innerHTML = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`
      delBtn.title = "Delete"
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation()
        const wasActive = narr.id === getActive()
        await deleteNarration(narr.id)

        if (wasActive) {
          const remaining = listInstalled()
          if (remaining.length > 0) {
            switchToNarration(remaining[0].narrationId)
          } else {
            switching = true
            drawerStore.setState({ currentNarrationId: "", currentLanguage: "", languages: [], nowPlaying: { bookTitle: "" } })
            switching = false
            if (readerInstance) {
              readerInstance.dispose()
              readerInstance = null
            }
          }
        }

        // Force full rebuild since a row was removed
        nowPlayingBookId = ""
        refreshNowPlayingSection()
        refreshLibrarySection()
      })
      row.appendChild(delBtn)

      row.addEventListener("click", () => {
        if (narr.id === getActive()) return
        switchToNarration(narr.id)
      })

      detail.appendChild(row)
    }

    // Available (not downloaded) narrations
    if (availableNarrs.length > 0) {
      const sTitle = document.createElement("div")
      sTitle.className = "catalog-detail-section-title"
      sTitle.textContent = "Available"
      sTitle.style.marginTop = "16px"
      detail.appendChild(sTitle)

      for (const narr of availableNarrs) {
        detail.appendChild(renderNarrationRow(narr, false))
      }
    }

    nowPlayingSectionEl.appendChild(detail)
  }

  // --- Library section rendering ---
  function renderLibrarySection(container: HTMLElement): void {
    librarySectionEl = container
    refreshLibrarySection()
  }

  function refreshLibrarySection(): void {
    if (!librarySectionEl) return
    librarySectionEl.innerHTML = ""

    const installedList = listInstalled()
    if (installedList.length === 0) {
      const empty = document.createElement("div")
      empty.className = "command-drawer-browse-empty"
      empty.textContent = "No books installed yet"
      librarySectionEl.appendChild(empty)
      return
    }

    const grid = document.createElement("div")
    grid.className = "command-drawer-library-grid"

    // Group by book to show one card per book
    const bookMap = new Map<string, typeof installedList>()
    for (const inst of installedList) {
      const existing = bookMap.get(inst.bookId) || []
      existing.push(inst)
      bookMap.set(inst.bookId, existing)
    }

    const active = getActive()

    for (const [, narrations] of bookMap) {
      const first = narrations[0]
      const card = document.createElement("div")
      card.className = "command-drawer-library-card"
      const isActiveBook = narrations.some(n => n.narrationId === active)
      if (isActiveBook) {
        card.classList.add("command-drawer-library-card--active")
        if (narrations.length === 1) {
          card.classList.add("command-drawer-library-card--current")
        }
      }

      const title = document.createElement("div")
      title.className = "command-drawer-library-card-title"
      title.textContent = first.bookTitle

      const lang = document.createElement("div")
      lang.className = "command-drawer-library-card-lang"
      const langCounts = new Map<string, number>()
      for (const n of narrations) {
        const name = getLanguageName(n.language)
        langCounts.set(name, (langCounts.get(name) || 0) + 1)
      }
      lang.textContent = [...langCounts.entries()]
        .map(([name, count]) => count > 1 ? `${name} (${count})` : name)
        .join(", ")

      card.append(title, lang)

      // Update dot — if any installed narration has a newer version in the catalog
      if (allNarrations.length > 0) {
        const hasAnyUpdate = narrations.some(inst => {
          const catalogNarr = allNarrations.find(cn => cn.id === inst.narrationId)
          return catalogNarr && hasUpdate(catalogNarr.version, inst.version)
        })
        if (hasAnyUpdate) {
          const dot = document.createElement("div")
          dot.className = "command-drawer-library-card-update"
          card.appendChild(dot)
        }
      }

      if (isActiveBook) {
        const playing = document.createElement("div")
        playing.className = "command-drawer-library-card-playing"
        playing.textContent = "\u25B6"
        card.appendChild(playing)
      }

      card.addEventListener("click", () => {
        // If only one narration, play it directly and go to now-playing
        if (narrations.length === 1) {
          if (narrations[0].narrationId !== active) {
            switchToNarration(narrations[0].narrationId)
          }
          drawerStore.setState({ activeScreen: "now-playing" })
        } else {
          // Show book detail screen for picking narration
          const catalogNarrations = allNarrations.filter(n => n.bookId === first.bookId)
          if (catalogNarrations.length > 0) {
            showInlineBookDetail(catalogNarrations)
          } else {
            // Fallback: play first narration and go to now-playing
            switchToNarration(narrations[0].narrationId)
            drawerStore.setState({ activeScreen: "now-playing" })
          }
        }
      })

      grid.appendChild(card)
    }

    librarySectionEl.appendChild(grid)
  }

  // --- Browse section rendering ---
  function renderBrowseSection(container: HTMLElement): void {
    browseSectionEl = container

    // Kick off catalog fetch
    void fetchCatalog(cdnUrl).then((catalog) => {
      allNarrations = catalog.narrations
      refreshBrowseSection()
      refreshLibrarySection()
    })

    refreshBrowseSection()
  }

  function refreshBrowseSection(): void {
    // When detail screen is active, browseSectionEl points at the detail screen.
    // Restore it to the browse screen container for refresh.
    if (browseShowingDetail) {
      const browseScreen = drawer.getScreen("browse")
      if (browseScreen) {
        const container = browseScreen.querySelector(".command-drawer-screen-content") as HTMLElement
        if (container) browseSectionEl = container
      }
      browseShowingDetail = false
      detailNarrations = []
    }
    if (!browseSectionEl) return
    cleanupProgressSubs()
    browseSectionEl.innerHTML = ""

    if (allNarrations.length === 0) {
      const loading = document.createElement("div")
      loading.className = "catalog-loading"
      loading.innerHTML = `<div class="catalog-spinner"></div> Loading catalog...`
      browseSectionEl.appendChild(loading)
      return
    }

    // Search input
    const header = document.createElement("div")
    header.className = "command-drawer-browse-header"

    const searchInput = document.createElement("input")
    searchInput.className = "command-drawer-browse-search"
    searchInput.type = "text"
    searchInput.placeholder = "Search books..."
    searchInput.value = browseSearchQuery
    searchInput.addEventListener("input", () => {
      browseSearchQuery = searchInput.value
      renderBrowseResults()
    })
    header.appendChild(searchInput)
    browseSectionEl.appendChild(header)

    // Language filter pills
    const availLangs = getAvailableLanguages(allNarrations)
    if (availLangs.length > 1) {
      const filters = document.createElement("div")
      filters.className = "command-drawer-browse-filters"

      const allPill = document.createElement("button")
      allPill.className = "catalog-filter-pill" + (!browseActiveLang ? " catalog-filter-pill--active" : "")
      allPill.textContent = "All"
      allPill.addEventListener("click", () => {
        browseActiveLang = ""
        refreshBrowseSection()
      })
      filters.appendChild(allPill)

      for (const lang of availLangs) {
        const pill = document.createElement("button")
        pill.className = "catalog-filter-pill" + (browseActiveLang === lang ? " catalog-filter-pill--active" : "")
        pill.textContent = getLanguageName(lang)
        pill.addEventListener("click", () => {
          browseActiveLang = lang
          refreshBrowseSection()
        })
        filters.appendChild(pill)
      }

      browseSectionEl.appendChild(filters)
    }

    // Results container
    const results = document.createElement("div")
    results.dataset.browseResults = "1"
    browseSectionEl.appendChild(results)

    renderBrowseResults()
  }

  function renderBrowseResults(): void {
    if (!browseSectionEl) return
    const results = browseSectionEl.querySelector("[data-browse-results]") as HTMLElement | null
    if (!results) return
    results.innerHTML = ""

    let filtered = allNarrations
    if (browseActiveLang) filtered = filterByLanguage(filtered, browseActiveLang)
    if (browseSearchQuery) filtered = searchByTitle(filtered, browseSearchQuery)

    if (filtered.length === 0) {
      const empty = document.createElement("div")
      empty.className = "command-drawer-browse-empty"
      empty.textContent = "No books match your search"
      results.appendChild(empty)
      return
    }

    const active = getActive()

    const seriesGroups = groupBySeries(filtered)
    for (const sg of seriesGroups) {
      const sectionTitle = document.createElement("div")
      sectionTitle.className = "command-drawer-section-title"
      sectionTitle.textContent = sg.series
      results.appendChild(sectionTitle)

      const grid = document.createElement("div")
      grid.className = "catalog-grid"

      for (const book of sg.books) {
        const card = document.createElement("div")
        card.className = "catalog-card"
        card.addEventListener("click", () => {
          const bookNarrations = allNarrations.filter(n => n.bookId === book.bookId)
          showInlineBookDetail(bookNarrations)
        })

        const title = document.createElement("div")
        title.className = "catalog-card-title"
        title.textContent = book.bookTitle

        const langs = document.createElement("div")
        langs.className = "catalog-card-langs"
        for (const lang of book.languages) {
          const badge = document.createElement("span")
          badge.className = "catalog-lang-badge"
          badge.textContent = getLanguageName(lang)
          langs.appendChild(badge)
        }

        const meta = document.createElement("div")
        meta.className = "catalog-card-meta"
        const firstNarr = book.narrations[0]
        meta.textContent = firstNarr?.purchase?.priceLabel || (firstNarr?.tier === "premium" ? "Premium" : "Free")

        card.append(title, langs, meta)

        // Active indicator
        if (book.narrations.some(n => n.id === active)) {
          card.classList.add("catalog-card--active")
        }

        grid.appendChild(card)
      }

      results.appendChild(grid)
    }
  }

  // --- Inline book detail ---
  // Store current detail narrations so we can re-render on language switch
  let detailNarrations: CatalogNarrationEntry[] = []

  function showInlineBookDetail(narrations: CatalogNarrationEntry[]): void {
    if (narrations.length === 0) return
    detailNarrations = narrations
    browseShowingDetail = true
    // Render into the detail screen and navigate to it
    const detailScreen = drawer.getScreen("detail")
    if (detailScreen) {
      browseSectionEl = detailScreen
    }
    renderBookDetail()
    drawerStore.setState({ activeScreen: "detail" })
  }

  function renderBookDetail(): void {
    if (!browseSectionEl || detailNarrations.length === 0) return
    const narrations = detailNarrations
    const bookId = narrations[0].bookId
    const activeId = getActive()

    // Same book — surgical row update instead of full rebuild
    if (bookId === detailBookId && browseSectionEl.querySelector("[data-narration-id]")) {
      updateNarrationRows(browseSectionEl, activeId)
      return
    }

    detailBookId = bookId
    cleanupProgressSubs()
    browseSectionEl.innerHTML = ""

    const detail = document.createElement("div")
    detail.className = "command-drawer-detail"

    // Back button
    const backBtn = document.createElement("button")
    backBtn.className = "command-drawer-detail-back"
    backBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg> Browse`
    backBtn.addEventListener("click", () => {
      browseShowingDetail = false
      detailNarrations = []
      // Restore browseSectionEl to the browse screen container
      const browseScreen = drawer.getScreen("browse")
      if (browseScreen) {
        const container = browseScreen.querySelector(".command-drawer-screen-content") as HTMLElement
        if (container) browseSectionEl = container
      }
      drawerStore.setState({ activeScreen: "browse" })
    })
    detail.appendChild(backBtn)

    const first = narrations[0]

    // Title
    const title = document.createElement("div")
    title.className = "command-drawer-detail-title"
    title.textContent = first.bookTitle
    detail.appendChild(title)

    if (first.series) {
      const subtitle = document.createElement("div")
      subtitle.className = "command-drawer-detail-subtitle"
      subtitle.textContent = first.series + (first.volume ? ` \u00B7 Vol. ${first.volume}` : "")
      detail.appendChild(subtitle)
    }

    // Installed narrations as tappable language rows (language picker)
    const installedNarrs = narrations.filter(n => isInstalled(n.id))
    const availableNarrs = narrations.filter(n => !isInstalled(n.id))
    const active = getActive()

    for (const narr of installedNarrs) {
      const row = document.createElement("div")
      row.className = "catalog-narration-row catalog-narration-row--installed"
      row.dataset.narrationId = narr.id
      if (narr.id === active) {
        row.classList.add("catalog-narration-row--active")
      }
      row.style.cursor = "pointer"

      const info = document.createElement("div")
      info.className = "catalog-narration-info"

      const lang = document.createElement("div")
      lang.className = "catalog-narration-lang"
      lang.textContent = getLanguageName(narr.language)

      const voice = document.createElement("div")
      voice.className = "catalog-narration-voice"
      voice.textContent = narr.voiceName

      const installedInfo = getInstalled(narr.id)
      const versionDiv = document.createElement("div")
      if (installedInfo && hasUpdate(narr.version, installedInfo.version)) {
        versionDiv.className = "catalog-narration-version catalog-narration-version--update"
        versionDiv.textContent = `v${installedInfo.version} → v${narr.version}`
      } else if (installedInfo) {
        versionDiv.className = "catalog-narration-version"
        versionDiv.textContent = `v${installedInfo.version}`
      }

      info.append(lang, voice, versionDiv)
      row.appendChild(info)

      // Active indicator
      if (narr.id === active) {
        const check = document.createElement("div")
        check.className = "catalog-narration-active-indicator"
        check.textContent = "\u2713"
        row.appendChild(check)
      }

      // Update button (when catalog has newer version)
      if (installedInfo && hasUpdate(narr.version, installedInfo.version)) {
        const updateBtn = document.createElement("button")
        updateBtn.className = "catalog-btn catalog-btn--update"
        updateBtn.innerHTML = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2"/></svg>`
        updateBtn.title = "Update"
        updateBtn.addEventListener("click", async (e) => {
          e.stopPropagation()
          updateBtn.className = "catalog-btn catalog-btn--downloading"
          updateBtn.innerHTML = `<div class="catalog-btn-indeterminate"></div><span class="catalog-btn-label">Connecting\u2026</span>`
          const unsub = subscribeProgress(narr.id, (ds) => {
            if (ds.stage === "downloading") {
              const pct = ds.total > 0 ? Math.round((ds.progress / ds.total) * 100) : 0
              const downloaded = ds.progress > 0 ? (ds.progress / 1048576).toFixed(1) : "0"
              const total = ds.total > 0 ? (ds.total / 1048576).toFixed(0) : "?"
              updateBtn.innerHTML = `<span class="catalog-btn-label">${pct}% \u00B7 ${downloaded}/${total} MB</span><div class="catalog-btn-progress" style="width:${pct}%"></div>`
            } else if (ds.stage === "verifying") {
              updateBtn.innerHTML = `<div class="catalog-btn-indeterminate"></div><span class="catalog-btn-label">Verifying\u2026</span>`
            } else if (ds.stage === "extracting") {
              updateBtn.innerHTML = `<div class="catalog-btn-indeterminate"></div><span class="catalog-btn-label">Installing\u2026</span>`
            } else if (ds.stage === "complete") {
              renderBookDetail()
              refreshLibrarySection()
              refreshNowPlayingSection()
            }
          })
          progressUnsubs.push(unsub)
          await installNarration(narr)
          renderBookDetail()
          refreshLibrarySection()
          refreshNowPlayingSection()
        })
        row.appendChild(updateBtn)
      }

      // Delete button
      const delBtn = document.createElement("button")
      delBtn.className = "catalog-btn catalog-btn--danger"
      delBtn.innerHTML = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`
      delBtn.title = "Delete"
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation()
        const wasActive = narr.id === getActive()
        await deleteNarration(narr.id)

        if (wasActive) {
          // Switch to another installed narration or clear
          const remaining = listInstalled()
          if (remaining.length > 0) {
            switchToNarration(remaining[0].narrationId)
          } else {
            switching = true
            drawerStore.setState({ currentNarrationId: "", currentLanguage: "", languages: [], nowPlaying: { bookTitle: "" } })
            switching = false
            if (readerInstance) {
              readerInstance.dispose()
              readerInstance = null
            }
          }
        }

        // Force full rebuild since a row was removed
        detailBookId = ""
        nowPlayingBookId = ""
        renderBookDetail()
        refreshLibrarySection()
        refreshNowPlayingSection()
      })
      row.appendChild(delBtn)

      row.addEventListener("click", () => {
        if (narr.id === getActive()) return
        switchToNarration(narr.id)
        drawerStore.setState({ activeScreen: "now-playing" })
      })

      detail.appendChild(row)
    }

    // Available (not downloaded) narrations — keep download button
    if (availableNarrs.length > 0) {
      const sTitle = document.createElement("div")
      sTitle.className = "catalog-detail-section-title"
      sTitle.textContent = "Available"
      sTitle.style.marginTop = "16px"
      detail.appendChild(sTitle)

      for (const narr of availableNarrs) {
        detail.appendChild(renderNarrationRow(narr, false))
      }
    }

    browseSectionEl.appendChild(detail)
  }

  function renderNarrationRow(narration: CatalogNarrationEntry, _installed: boolean): HTMLElement {
    const row = document.createElement("div")
    row.className = "catalog-narration-row"

    const info = document.createElement("div")
    info.className = "catalog-narration-info"

    const lang = document.createElement("div")
    lang.className = "catalog-narration-lang"
    lang.textContent = getLanguageName(narration.language)

    const voice = document.createElement("div")
    voice.className = "catalog-narration-voice"
    voice.textContent = narration.voiceName

    info.append(lang, voice)
    row.appendChild(info)

    renderActionButton(narration, row)
    return row
  }

  function renderActionButton(narration: CatalogNarrationEntry, container: HTMLElement): void {
    const hasTauri = isTauriAvailable()

    const btn = document.createElement("button")
    btn.className = "catalog-btn"

    if (!hasTauri) {
      btn.className = "catalog-btn catalog-btn--disabled"
      btn.textContent = "Desktop only"
      container.appendChild(btn)
      return
    }

    const state = getProgressState(narration.id)

    function startDownload(e: MouseEvent) {
      e.stopPropagation()
      // Show indeterminate progress immediately
      btn.className = "catalog-btn catalog-btn--downloading"
      btn.innerHTML = `<div class="catalog-btn-indeterminate"></div><span class="catalog-btn-label">Connecting\u2026</span><div class="catalog-btn-progress" style="width:0%"></div>`
      btn.onclick = null
      // Fire and forget — progress subscription handles all UI updates
      installNarration(narration).then((ok) => {
        if (ok) {
          if (browseShowingDetail) renderBookDetail()
          else refreshBrowseSection()
          refreshLibrarySection()
          refreshNowPlayingSection()
        }
      })
    }

    function updateBtn(ds: DownloadState): void {
      switch (ds.stage) {
        case "idle":
          btn.className = "catalog-btn"
          btn.style.borderColor = ""
          btn.style.color = ""
          btn.innerHTML = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2"/></svg>${Math.round(narration.sizeMb)} MB`
          btn.onclick = startDownload
          break
        case "downloading": {
          const pct = ds.total > 0 ? Math.round((ds.progress / ds.total) * 100) : 0
          const downloaded = ds.progress > 0 ? (ds.progress / 1048576).toFixed(1) : "0"
          const total = ds.total > 0 ? (ds.total / 1048576).toFixed(0) : Math.round(narration.sizeMb).toString()
          btn.className = "catalog-btn catalog-btn--downloading"
          btn.innerHTML = `<span class="catalog-btn-label">${pct}% \u00B7 ${downloaded}/${total} MB</span><div class="catalog-btn-progress" style="width:${pct}%"></div>`
          btn.onclick = null
          break
        }
        case "verifying":
          btn.className = "catalog-btn catalog-btn--downloading"
          btn.innerHTML = `<div class="catalog-btn-indeterminate"></div><span class="catalog-btn-label">Verifying\u2026</span>`
          btn.onclick = null
          break
        case "extracting":
          btn.className = "catalog-btn catalog-btn--downloading"
          btn.innerHTML = `<div class="catalog-btn-indeterminate"></div><span class="catalog-btn-label">Installing\u2026</span>`
          btn.onclick = null
          break
        case "complete":
          if (browseShowingDetail) renderBookDetail()
          else refreshBrowseSection()
          refreshLibrarySection()
          refreshNowPlayingSection()
          break
        case "error":
          btn.className = "catalog-btn catalog-btn--error"
          btn.innerHTML = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 105.64-11.36L3 10"/></svg>Retry \u00B7 ${Math.round(narration.sizeMb)} MB`
          btn.style.borderColor = ""
          btn.style.color = ""
          btn.onclick = startDownload
          break
      }
    }

    updateBtn(state)
    const unsub = subscribeProgress(narration.id, updateBtn)
    progressUnsubs.push(unsub)

    container.appendChild(btn)
  }

  function cleanupProgressSubs(): void {
    for (const unsub of progressUnsubs) unsub()
    progressUnsubs.length = 0
  }

  // --- Dispose ---
  function dispose(): void {
    if (disposed) return
    disposed = true
    storeUnsub()
    narrUnsub()
    persistUnsub()
    cleanupProgressSubs()
    drawer.dispose()
    readerInstance?.dispose()
  }

  return {
    dispose,
    getDrawer: () => drawer,
  }
}
