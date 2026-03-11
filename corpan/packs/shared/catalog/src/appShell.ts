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
import { isInstalled, getInstalled, listInstalled, listInstalledForBook } from "./libraryStore"
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
) => { dispose: () => void }

export type AppShellOptions = {
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
  let disposed = false
  let readerInstance: { dispose: () => void } | null = null
  let activeNarrationId: string | undefined

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

  // --- Build drawer sections ---
  const builtinSections: DrawerSectionDef[] = [
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
      window.dispatchEvent(new Event("corpan:exit"))
    },
  })

  // Subscribe to store for book detail re-rendering
  const storeUnsub = drawerStore.subscribe((state, prev) => {
    if (state.currentLanguage !== prev.currentLanguage && browseShowingDetail && detailNarrations.length > 0) {
      renderBookDetail()
    }
  })

  // Subscribe for pill-triggered narration switches
  const narrUnsub = drawerStore.subscribe((state, prev) => {
    if (
      state.currentNarrationId !== prev.currentNarrationId &&
      state.currentNarrationId &&
      state.currentNarrationId !== activeNarrationId
    ) {
      switchToNarration(state.currentNarrationId)
    }
  })

  // --- Check if we should start with catalog or reader ---
  const installed = listInstalled()
  const hasInstalledBooks = installed.length > 0
  const hasInitialBook = Boolean(opts.initialState?.baseUrl || opts.initialState?.bookId)

  // Restore persisted narration or pick most recent installed
  if (hasInitialBook) {
    mountReader(opts.initialState)
  } else if (hasInstalledBooks) {
    const persistedNarrId = drawerStore.getState().currentNarrationId
    const targetNarr = (persistedNarrId && isInstalled(persistedNarrId))
      ? persistedNarrId
      : installed[0].narrationId
    switchToNarration(targetNarr)
  }

  // If no books at all, open drawer to Browse immediately
  if (!hasInitialBook && !hasInstalledBooks) {
    drawer.open()
    // Prefetch catalog
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

  function switchToNarration(narrationId: string): void {
    if (!isInstalled(narrationId)) return
    const info = getInstalled(narrationId)
    if (!info) return

    activeNarrationId = narrationId

    // Build initialState for the new reader instance
    const packUrl = getPackUrl(narrationId)
    const newState: Record<string, unknown> = {
      ...opts.initialState,
      baseUrl: packUrl,
      bookId: info.bookId,
      language: info.language,
    }

    drawerStore.setState({ currentNarrationId: narrationId, currentLanguage: info.language })

    // Close drawer and remount reader with new book
    drawer.close()
    mountReader(newState)
    updateDrawerNarrationPills(info.bookId)
  }

  function updateDrawerNarrationPills(bookId: string): void {
    const installed = listInstalledForBook(bookId)
    if (installed.length === 0) return

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

    drawerStore.setState({
      languages: pills,
      currentNarrationId: activeNarrationId || "",
      currentLanguage: getInstalled(activeNarrationId || "")?.language || "",
    })
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

    for (const [, narrations] of bookMap) {
      const first = narrations[0]
      const card = document.createElement("div")
      card.className = "command-drawer-library-card"
      if (narrations.some(n => n.narrationId === activeNarrationId)) {
        card.classList.add("command-drawer-library-card--active")
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

      if (narrations.some(n => n.narrationId === activeNarrationId)) {
        const playing = document.createElement("div")
        playing.className = "command-drawer-library-card-playing"
        playing.textContent = "\u25B6"
        card.appendChild(playing)
      }

      card.addEventListener("click", () => {
        // If only one narration, play it directly
        if (narrations.length === 1) {
          switchToNarration(narrations[0].narrationId)
        } else {
          // Show book detail inline in browse section for picking narration
          const catalogNarrations = allNarrations.filter(n => n.bookId === first.bookId)
          if (catalogNarrations.length > 0) {
            showInlineBookDetail(catalogNarrations)
          } else {
            // Fallback: play first narration
            switchToNarration(narrations[0].narrationId)
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
    if (!browseSectionEl || browseShowingDetail) return
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
        if (book.narrations.some(n => n.id === activeNarrationId)) {
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
    if (!browseSectionEl || narrations.length === 0) return
    detailNarrations = narrations
    browseShowingDetail = true
    renderBookDetail()
  }

  function renderBookDetail(): void {
    if (!browseSectionEl || detailNarrations.length === 0) return
    cleanupProgressSubs()
    browseSectionEl.innerHTML = ""

    const narrations = detailNarrations
    const detail = document.createElement("div")
    detail.className = "command-drawer-detail"

    // Back button
    const backBtn = document.createElement("button")
    backBtn.className = "command-drawer-detail-back"
    backBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg> Browse`
    backBtn.addEventListener("click", () => {
      browseShowingDetail = false
      detailNarrations = []
      refreshBrowseSection()
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

    for (const narr of installedNarrs) {
      const row = document.createElement("div")
      row.className = "catalog-narration-row catalog-narration-row--installed"
      if (narr.id === activeNarrationId) {
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

      info.append(lang, voice)
      row.appendChild(info)

      // Active indicator
      if (narr.id === activeNarrationId) {
        const check = document.createElement("div")
        check.className = "catalog-narration-active-indicator"
        check.textContent = "\u2713"
        row.appendChild(check)
      }

      // Delete button
      const delBtn = document.createElement("button")
      delBtn.className = "catalog-btn catalog-btn--danger"
      delBtn.innerHTML = "\uD83D\uDDD1"
      delBtn.title = "Delete"
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation()
        const wasActive = narr.id === activeNarrationId
        await deleteNarration(narr.id)

        if (wasActive) {
          // Switch to another installed narration or clear
          const remaining = listInstalled()
          if (remaining.length > 0) {
            switchToNarration(remaining[0].narrationId)
          } else {
            activeNarrationId = undefined
            if (readerInstance) {
              readerInstance.dispose()
              readerInstance = null
            }
            drawerStore.setState({ currentNarrationId: "", currentLanguage: "", languages: [], nowPlaying: { bookTitle: "" } })
          }
        }

        browseShowingDetail = false
        detailNarrations = []
        refreshBrowseSection()
        refreshLibrarySection()
      })
      row.appendChild(delBtn)

      row.addEventListener("click", () => {
        if (narr.id === activeNarrationId) return
        switchToNarration(narr.id)
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

    const size = document.createElement("div")
    size.className = "catalog-narration-size"
    size.textContent = `${narration.sizeMb} MB`
    row.appendChild(size)

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

    function updateBtn(ds: DownloadState): void {
      switch (ds.stage) {
        case "idle":
          btn.className = "catalog-btn"
          btn.innerHTML = `Download ${narration.sizeMb} MB`
          btn.onclick = async (e) => {
            e.stopPropagation()
            btn.className = "catalog-btn catalog-btn--disabled"
            btn.textContent = "Starting..."
            await installNarration(narration)
            browseShowingDetail = false
            refreshBrowseSection()
            refreshLibrarySection()
          }
          break
        case "downloading": {
          btn.className = "catalog-btn catalog-btn--disabled"
          const pct = ds.total > 0 ? Math.round((ds.progress / ds.total) * 100) : 0
          btn.innerHTML = `<span>${pct}%</span><div class="catalog-btn-progress" style="width:${pct}%"></div>`
          break
        }
        case "verifying":
          btn.className = "catalog-btn catalog-btn--disabled"
          btn.textContent = "Verifying..."
          break
        case "extracting":
          btn.className = "catalog-btn catalog-btn--disabled"
          btn.textContent = "Installing..."
          break
        case "complete":
          browseShowingDetail = false
          refreshBrowseSection()
          refreshLibrarySection()
          break
        case "error":
          btn.className = "catalog-btn"
          btn.innerHTML = `\u21BB Retry ${narration.sizeMb} MB`
          btn.style.borderColor = "var(--catalog-error)"
          btn.style.color = "var(--catalog-error)"
          btn.onclick = async (e) => {
            e.stopPropagation()
            await installNarration(narration)
          }
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
    cleanupProgressSubs()
    drawer.dispose()
    readerInstance?.dispose()
  }

  return {
    dispose,
    getDrawer: () => drawer,
  }
}
