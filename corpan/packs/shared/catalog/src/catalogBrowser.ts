import type { CatalogNarrationEntry, BookGroup, SeriesGroup as _SeriesGroup } from "./types"
import { fetchCatalog } from "./catalogFetch"
import { listInstalled, isInstalled } from "./libraryStore"
import {
  groupBySeries,
  groupByBook,
  filterByLanguage,
  searchByTitle,
  getAvailableLanguages,
  getLanguageName,
} from "./searchFilter"

export type CatalogBrowserOptions = {
  cdnUrl: string
  activeNarrationId?: string
  onSelectBook: (bookId: string) => void
  onPlayNarration: (narrationId: string) => void
  onBack: () => void
}

export type CatalogBrowser = {
  show: () => void
  hide: () => void
  refresh: () => Promise<void>
  dispose: () => void
  setActiveNarration: (id: string | undefined) => void
}

const SVG_BACK = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`
const SVG_SEARCH = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
const SVG_LIBRARY = `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`

export function createCatalogBrowser(
  parent: HTMLElement,
  opts: CatalogBrowserOptions
): CatalogBrowser {
  let narrations: CatalogNarrationEntry[] = []
  let activeLang = ""
  let searchQuery = ""
  let searchOpen = false
  let activeNarrationId = opts.activeNarrationId
  let visible = false

  // --- DOM structure ---

  const overlay = document.createElement("div")
  overlay.className = "catalog-overlay"

  // Header
  const header = document.createElement("div")
  header.className = "catalog-header"

  const backBtn = document.createElement("button")
  backBtn.className = "catalog-back-btn"
  backBtn.innerHTML = `${SVG_BACK} Reading`
  backBtn.onclick = () => opts.onBack()

  const spacer = document.createElement("div")
  spacer.className = "catalog-header-spacer"

  const searchBtn = document.createElement("button")
  searchBtn.className = "catalog-search-btn"
  searchBtn.innerHTML = SVG_SEARCH
  searchBtn.onclick = () => {
    searchOpen = !searchOpen
    searchBar.className = searchOpen ? "catalog-search-bar catalog-search-bar--open" : "catalog-search-bar"
    if (searchOpen) searchInput.focus()
    else {
      searchQuery = ""
      searchInput.value = ""
      render()
    }
  }

  header.append(backBtn, spacer, searchBtn)

  // Search bar
  const searchBar = document.createElement("div")
  searchBar.className = "catalog-search-bar"

  const searchInput = document.createElement("input")
  searchInput.className = "catalog-search-input"
  searchInput.type = "text"
  searchInput.placeholder = "Search books..."
  searchInput.oninput = () => {
    searchQuery = searchInput.value
    render()
  }
  searchBar.append(searchInput)

  // Filter pills
  const filters = document.createElement("div")
  filters.className = "catalog-filters"

  // Content area
  const content = document.createElement("div")
  content.className = "catalog-content"

  overlay.append(header, searchBar, filters, content)
  parent.append(overlay)

  // --- Rendering ---

  function renderFilters(languages: string[]): void {
    filters.innerHTML = ""

    const allPill = document.createElement("button")
    allPill.className = "catalog-filter-pill" + (!activeLang ? " catalog-filter-pill--active" : "")
    allPill.textContent = "All"
    allPill.onclick = () => {
      activeLang = ""
      render()
    }
    filters.append(allPill)

    for (const lang of languages) {
      const pill = document.createElement("button")
      pill.className = "catalog-filter-pill" + (activeLang === lang ? " catalog-filter-pill--active" : "")
      pill.textContent = getLanguageName(lang)
      pill.onclick = () => {
        activeLang = lang
        render()
      }
      filters.append(pill)
    }
  }

  function renderCard(book: BookGroup, container: HTMLElement): void {
    const card = document.createElement("div")
    card.className = "catalog-card"
    card.onclick = () => opts.onSelectBook(book.bookId)

    const title = document.createElement("div")
    title.className = "catalog-card-title"
    title.textContent = book.bookTitle

    const langs = document.createElement("div")
    langs.className = "catalog-card-langs"
    for (const lang of book.languages) {
      const badge = document.createElement("span")
      badge.className = "catalog-lang-badge"
      badge.textContent = getLanguageName(lang)
      langs.append(badge)
    }

    const meta = document.createElement("div")
    meta.className = "catalog-card-meta"
    const firstNarr = book.narrations[0]
    const tier = firstNarr?.purchase?.priceLabel || (firstNarr?.tier === "premium" ? "Premium" : "Free")
    meta.textContent = tier

    card.append(title, langs, meta)

    // Check if any narration of this book is currently playing
    const playingNarr = book.narrations.find((n) => n.id === activeNarrationId)
    if (playingNarr) {
      const playing = document.createElement("div")
      playing.className = "catalog-card-playing"
      playing.textContent = `\u25B6 ${getLanguageName(playingNarr.language)} \u00B7 Playing`
      card.append(playing)
    }

    container.append(card)
  }

  function render(): void {
    content.innerHTML = ""

    // Apply filters
    let filtered = narrations
    if (activeLang) filtered = filterByLanguage(filtered, activeLang)
    if (searchQuery) filtered = searchByTitle(filtered, searchQuery)

    const languages = getAvailableLanguages(narrations)
    renderFilters(languages)

    if (filtered.length === 0 && narrations.length === 0) {
      const loading = document.createElement("div")
      loading.className = "catalog-loading"
      loading.innerHTML = `<div class="catalog-spinner"></div> Loading catalog...`
      content.append(loading)
      return
    }

    if (filtered.length === 0) {
      const empty = document.createElement("div")
      empty.className = "catalog-empty"
      empty.innerHTML = `<div class="catalog-empty-icon">\uD83D\uDCDA</div>No books match your search`
      content.append(empty)
      return
    }

    // My Library section (installed narrations)
    const installed = listInstalled()
    if (installed.length > 0 && !searchQuery) {
      const installedBooks = groupByBook(
        filtered.filter((n) => isInstalled(n.id))
      )
      if (installedBooks.length > 0) {
        const section = document.createElement("div")
        section.className = "catalog-section"

        const sectionTitle = document.createElement("div")
        sectionTitle.className = "catalog-section-title"
        sectionTitle.textContent = "My Library"
        section.append(sectionTitle)

        const grid = document.createElement("div")
        grid.className = "catalog-grid"
        for (const book of installedBooks) {
          renderCard(book, grid)
        }
        section.append(grid)
        content.append(section)
      }
    }

    // All books grouped by series
    const seriesGroups = groupBySeries(filtered)
    for (const sg of seriesGroups) {
      const section = document.createElement("div")
      section.className = "catalog-section"

      const sectionTitle = document.createElement("div")
      sectionTitle.className = "catalog-section-title"
      sectionTitle.textContent = sg.series
      section.append(sectionTitle)

      const grid = document.createElement("div")
      grid.className = "catalog-grid"
      for (const book of sg.books) {
        renderCard(book, grid)
      }
      section.append(grid)
      content.append(section)
    }
  }

  // --- Public API ---

  async function refresh(): Promise<void> {
    const catalog = await fetchCatalog(opts.cdnUrl)
    narrations = catalog.narrations
    render()
  }

  function show(): void {
    visible = true
    overlay.classList.add("catalog-overlay--open")
    refresh()
  }

  function hide(): void {
    visible = false
    overlay.classList.remove("catalog-overlay--open")
  }

  function dispose(): void {
    hide()
    overlay.remove()
  }

  function setActiveNarration(id: string | undefined): void {
    activeNarrationId = id
    if (visible) render()
  }

  return { show, hide, refresh, dispose, setActiveNarration }
}

/** Create the library button element (top-left of reader UI) */
export function createLibraryButton(
  parent: HTMLElement,
  onClick: () => void
): HTMLElement {
  const btn = document.createElement("button")
  btn.className = "catalog-library-btn"
  btn.innerHTML = SVG_LIBRARY
  btn.title = "Library"
  btn.onclick = onClick
  parent.append(btn)
  return btn
}
