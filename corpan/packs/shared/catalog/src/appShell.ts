/**
 * App Shell — wraps a reader (stargate/earthgate) with catalog browsing.
 *
 * Manages:
 * - Library button (top-left)
 * - Catalog browser overlay
 * - Book detail view
 * - Dispose-remount for book switching
 */

import "./catalog.css"
import type { CatalogNarrationEntry } from "./types"
import { fetchCatalog } from "./catalogFetch"
import { createCatalogBrowser, createLibraryButton, type CatalogBrowser } from "./catalogBrowser"
import { createBookDetail, type BookDetail } from "./bookDetail"
import { isInstalled, getInstalled, listInstalled } from "./libraryStore"
import { startListening } from "./downloadProgress"
import { getPackUrl, isTauriAvailable as _isTauriAvailable } from "./installManager"
import { groupByBook as _groupByBook } from "./searchFilter"

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
}

export type AppShell = {
  dispose: () => void
}

export function createAppShell(
  container: HTMLElement,
  opts: AppShellOptions
): AppShell {
  const cdnUrl = opts.cdnUrl || DEFAULT_CDN_URL
  let disposed = false
  let readerInstance: { dispose: () => void } | null = null
  let activeNarrationId: string | undefined
  let catalogBrowser: CatalogBrowser | null = null
  let bookDetail: BookDetail | null = null
  let libraryBtn: HTMLElement | null = null

  // All narrations from the last catalog fetch (for book detail lookups)
  let allNarrations: CatalogNarrationEntry[] = []

  // Start listening for download progress events
  void startListening()

  // --- Check if we should start with catalog or reader ---

  const installed = listInstalled()
  const hasInstalledBooks = installed.length > 0
  const hasInitialBook = Boolean(opts.initialState?.baseUrl || opts.initialState?.bookId)

  // Mount reader if we have data to show
  if (hasInitialBook || hasInstalledBooks) {
    mountReader(opts.initialState)
  }

  // Create catalog components (hidden initially unless no books)
  catalogBrowser = createCatalogBrowser(container, {
    cdnUrl,
    activeNarrationId,
    onSelectBook: (bookId) => showBookDetail(bookId),
    onPlayNarration: (narrationId) => switchToNarration(narrationId),
    onBack: () => hideCatalog(),
  })

  bookDetail = createBookDetail(container, {
    onPlay: (narrationId) => switchToNarration(narrationId),
    onBack: () => {
      bookDetail?.hide()
    },
    activeNarrationId,
  })

  // If no books at all, show catalog immediately
  if (!hasInitialBook && !hasInstalledBooks) {
    showCatalog()
  }

  // --- Reader management ---

  function mountReader(state?: Record<string, unknown>): void {
    if (readerInstance) {
      readerInstance.dispose()
      readerInstance = null
    }

    readerInstance = opts.createReader(container, opts.hostApi, state)

    // Add library button to the reader's UI overlay
    // Find the UI overlay (first child with the reader's UI class)
    const uiOverlay = container.querySelector(
      ".stargate-ui, .earthgate-ui"
    ) as HTMLElement | null
    if (uiOverlay && !libraryBtn) {
      libraryBtn = createLibraryButton(uiOverlay, () => showCatalog())
    } else if (libraryBtn) {
      // Re-attach button after remount
      const overlay = container.querySelector(
        ".stargate-ui, .earthgate-ui"
      ) as HTMLElement | null
      overlay?.append(libraryBtn)
    }
  }

  function showCatalog(): void {
    catalogBrowser?.show()
    // Prefetch catalog for book detail
    void fetchCatalog(cdnUrl).then((catalog) => {
      allNarrations = catalog.narrations
    })
  }

  function hideCatalog(): void {
    catalogBrowser?.hide()
    bookDetail?.hide()
  }

  function showBookDetail(bookId: string): void {
    const bookNarrations = allNarrations.filter((n) => n.bookId === bookId)
    if (bookNarrations.length === 0) return
    bookDetail?.show(bookNarrations)
  }

  function switchToNarration(narrationId: string): void {
    if (!isInstalled(narrationId)) return
    const info = getInstalled(narrationId)
    if (!info) return

    activeNarrationId = narrationId
    catalogBrowser?.setActiveNarration(narrationId)
    bookDetail?.setActiveNarration(narrationId)

    // Build initialState for the new reader instance
    const packUrl = getPackUrl(narrationId)
    const newState: Record<string, unknown> = {
      ...opts.initialState,
      baseUrl: packUrl,
      bookId: info.bookId,
      language: info.language,
    }

    // Close catalog and remount reader with new book
    hideCatalog()
    mountReader(newState)
  }

  // --- Dispose ---

  function dispose(): void {
    if (disposed) return
    disposed = true
    catalogBrowser?.dispose()
    bookDetail?.dispose()
    readerInstance?.dispose()
    libraryBtn?.remove()
  }

  return { dispose }
}
