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
import type { CatalogNarrationEntry, Character, BookEntry } from "./types"
import { fetchCatalog } from "./catalogFetch"
import { buildCatalogIndex, type CatalogIndex } from "./catalogIndex"
import { createNarratorDetail, type NarratorDetail } from "./narratorDetail"
import { stopPreview } from "./voicePreview"
import { libraryStore, isInstalled, getInstalled, listInstalled } from "./libraryStore"
import { getPackUrl, isTauriAvailable, installNarration, deleteNarration, isTwoZipEntry } from "./installManager"
import {
  upgradeActiveNarration,
  runUpgradeSweep,
  maybeUpgradeOnOpen,
  setUpgradeCatalogProvider,
  NARRATION_UPGRADED_EVENT,
  ENTITLEMENTS_CHANGED_EVENT,
} from "./upgradeManager"
import {
  groupByBook,
  groupBySeries,
  sortBooks,
  type BookSort,
  chooseNextBook,
  filterByLanguage,
  searchByTitle,
  getAvailableLanguages,
  getLanguageName,
  partitionLanguagesByStack,
  sortNarrationsByStack,
} from "./searchFilter"
import type { BookGroup } from "./types"
import { hasUpdate } from "./versionUtil"
import {
  purchaseBookProduct,
  purchaseSubscriptionProduct,
  fetchStoreProducts,
  getReaderPlatform,
  requestRestorePurchases,
  SUBSCRIPTION_MONTHLY_ID,
  SUBSCRIPTION_ANNUAL_ID,
  type PurchaseOutcome,
  type StoreProduct,
} from "./purchaseManager"
import {
  createCommandDrawer,
  type CommandDrawer,
  type DrawerSectionDef,
} from "../../ui/commandDrawer"
import { createNarrationSwitcher, type NarrationSwitcher } from "../../ui/narrationSwitcher"
import { showToast } from "../../ui/toast"
import { createOfflineNotice, isOnline } from "../../ui/offlineNotice"
import type { InstallResult } from "./installManager"
import { drawerStore } from "../../state/drawerStore"
import { recordNarrationUse } from "../../state/narrationHistoryStore"
import * as analytics from "@shared/analytics"

/**
 * Translate via the main app's i18next instance, exposed as
 * `window.__corpanI18n` from `corpan-app/src/i18n.ts`. Falls back to the
 * default value if i18next isn't loaded (e.g. standalone reader dev mode).
 *
 * Every user-facing string in this file MUST go through this helper.
 */
type CorpanI18n = {
  t: (key: string, options?: Record<string, unknown>) => string
}

function tt(key: string, defaultValue: string, params?: Record<string, unknown>): string {
  const i = (window as unknown as { __corpanI18n?: CorpanI18n }).__corpanI18n
  if (i && typeof i.t === "function") {
    try {
      const result = i.t(key, { defaultValue, ...params })
      if (typeof result === "string" && result.length > 0) return result
    } catch {
      /* fall through to default */
    }
  }
  // Apply param interpolation manually for fallback path so callers can rely
  // on `{{count}}` etc. resolving even when i18next is absent.
  if (params) {
    return defaultValue.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ""))
  }
  return defaultValue
}

// V2 catalog includes premium packs; old readers use catalog.json (free only)
const DEFAULT_CDN_URL = "https://d38iwc9748jekz.cloudfront.net/catalog-v2.json"
const FALLBACK_CDN_URL = "https://d38iwc9748jekz.cloudfront.net/catalog.json"

/** The book a brand-new reader user is seeded into when their library is empty:
 *  the Tropical Rainforest (Biomes) — free preview narrations in 20+ languages,
 *  so any reasonable stack gets content. Overridable via the host's `seedBookId`. */
const DEFAULT_SEED_BOOK = "book_biomes_tropical_rainforest"

// Anonymous analytics endpoint — CloudFront in front of API Gateway in front
// of the analytics ingest Lambda. CloudFront enriches the request with the
// viewer's country header before it reaches the Lambda. The IP itself is
// never persisted. See `~/encorpora/corpan/infra/PUBLISHING.md` § Analytics.
const ANALYTICS_ENDPOINT = "https://d1xp3xghrx3jfa.cloudfront.net/v1/events"

export type ReaderInstance = {
  dispose: () => void
  isPlaying?: () => boolean
  /** Persist the current playback bookmark on demand. Used before an upgrade
   *  reload so the new (full) pack resumes exactly where the preview was. */
  persistBookmark?: () => void
}

export type ReaderFactory = (
  container: HTMLElement,
  hostApi: unknown,
  initialState?: Record<string, unknown>
) => ReaderInstance

export type AppShellOptions = {
  /** Unique ID for this reader (e.g. "earthgate", "stargate"). Scopes persisted state so readers don't share narration selection. */
  readerId: string
  /** Reader bundle version — passed through to anonymous analytics. Read from manifest.json. */
  readerVersion?: string
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

  // Initialize analytics. Disabled in dev (no endpoint configured) and in
  // any build without an endpoint — analytics.init is idempotent so this
  // is safe across remounts.
  analytics.init({
    readerId: opts.readerId,
    readerVersion: opts.readerVersion || "",
    endpoint: ANALYTICS_ENDPOINT,
    enabled: ANALYTICS_ENDPOINT.length > 0,
  })

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

  // ---------------------------------------------------------------------
  // Live entitlement state — IN-MEMORY ONLY, never persisted.
  //
  // Refreshed on:
  //   - mount (immediately after createAppShell returns)
  //   - visibilitychange (foregrounding the app)
  //   - corpan:purchase-recorded events (post-buy from reader)
  //   - corpan:subscription-recorded events (post-subscribe from reader)
  //   - corpan:restore-purchases-completed events (after main app finishes
  //     a Restore Purchases flow it dispatches this back at the reader)
  //
  // Source of truth: `plugin:iap|restore_purchases` for both inapp and subs.
  // That call iterates Transaction.currentEntitlements internally, which
  // is a non-network local query — fast and authoritative.
  //
  // While `loaded === false` (initial load and during refresh), all UI that
  // gates on entitlement renders skeletons. We never fall back to a
  // persisted snapshot — if the platform query fails, the UI shows that
  // it failed.
  // ---------------------------------------------------------------------
  type EntitlementSnapshot = {
    loaded: boolean
    iapAvailable: boolean
    subscribed: boolean
    ownedBooks: Set<string>
    error: string | null
  }

  let entitlements: EntitlementSnapshot = {
    loaded: false,
    iapAvailable: false,
    subscribed: false,
    ownedBooks: new Set(),
    error: null,
  }

  const entitlementListeners = new Set<() => void>()
  function notifyEntitlementListeners(): void {
    for (const fn of entitlementListeners) {
      try { fn() } catch (err) { console.warn("[appShell] entitlement listener threw:", err) }
    }
  }

  function entitlementsLoaded(): boolean { return entitlements.loaded }
  function iapAvailableSync(): boolean { return entitlements.iapAvailable }
  function isSubscriberSync(): boolean { return entitlements.subscribed }

  /** What the user will ACTUALLY download for this entry, given their
   *  entitlement. For a two-ZIP entry a non-subscriber gets the small public
   *  preview (first ~95 segments); a subscriber gets the full signed ZIP.
   *  Legacy entries always report their single `sizeMb`. Returning isPreview
   *  lets the row mark the download as a free preview so 27-min books don't
   *  masquerade as a ~5 MB taste. */
  function effectiveDownload(
    narration: CatalogNarrationEntry
  ): { sizeMb: number; isPreview: boolean } {
    if (isTwoZipEntry(narration)) {
      // Full ZIP if entitled — a subscriber OR a one-time owner of this book.
      // (Don't advertise the free-preview size to someone who's already paid.)
      if (isEntitledToNarrationSync(narration)) return { sizeMb: narration.full.sizeMb, isPreview: false }
      return { sizeMb: narration.preview.sizeMb, isPreview: true }
    }
    return { sizeMb: narration.sizeMb, isPreview: false }
  }
  function ownsBookSync(productId: string): boolean { return entitlements.ownedBooks.has(productId) }

  function isEntitledToNarrationSync(n: { purchase: { type: string; productId?: string | null } }): boolean {
    if (n.purchase.type === "free") return true
    if (n.purchase.type !== "iap") return false
    if (entitlements.subscribed) return true
    return n.purchase.productId ? entitlements.ownedBooks.has(n.purchase.productId) : false
  }

  let entitlementsRefreshing = false
  let entitlementRefreshSeq = 0
  async function refreshEntitlements(reason: string = "unspecified"): Promise<void> {
    if (entitlementsRefreshing) {
      console.info(`[appShell.entitlements] refresh skipped (already in flight) — reason=${reason}`)
      return
    }
    entitlementsRefreshing = true
    const seq = ++entitlementRefreshSeq
    const t0 = Date.now()
    try {
      const platform = getReaderPlatform()
      const iapAvailable =
        platform === "ios" ||
        platform === "android" ||
        platform === "macos" ||
        platform === "windows"

      console.info(
        `[appShell.entitlements] refresh #${seq} START — reason=${reason} platform=${platform ?? "null"} iapAvailable=${iapAvailable}`
      )

      if (!iapAvailable) {
        entitlements = {
          loaded: true,
          iapAvailable: false,
          subscribed: false,
          ownedBooks: new Set(),
          error: null,
        }
        console.info(
          `[appShell.entitlements] refresh #${seq} DONE (no IAP) — ${Date.now() - t0}ms`
        )
        notifyEntitlementListeners()
        return
      }

      const w = window as Window & {
        __TAURI_INTERNALS__?: {
          invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
        }
      }
      const invoke = w.__TAURI_INTERNALS__?.invoke
      if (!invoke) {
        console.warn(
          `[appShell.entitlements] refresh #${seq} ABORT — no Tauri invoke available`
        )
        entitlements = {
          loaded: true,
          iapAvailable: false,
          subscribed: false,
          ownedBooks: new Set(),
          error: null,
        }
        notifyEntitlementListeners()
        return
      }

      type RawPurchase = {
        productId?: string
        orderId?: string
        id?: string
        environment?: string
      }
      const fetchType = async (
        productType: "inapp" | "subs"
      ): Promise<RawPurchase[] | { error: string }> => {
        try {
          const r = (await invoke("plugin:iap|restore_purchases", {
            payload: { productType },
          })) as { purchases?: RawPurchase[] }
          const arr = r?.purchases ?? []
          console.info(
            `[appShell.entitlements] refresh #${seq} restore_purchases(${productType}) →`,
            arr.length,
            "items:",
            arr.map((p) => ({
              productId: p.productId,
              orderId: p.orderId ?? p.id,
              env: p.environment,
            }))
          )
          return arr
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(
            `[appShell.entitlements] refresh #${seq} restore_purchases(${productType}) FAILED:`,
            msg
          )
          return { error: msg }
        }
      }

      const [inappRes, subsRes] = await Promise.all([fetchType("inapp"), fetchType("subs")])

      // If BOTH calls errored, surface the error. If one succeeded, we
      // trust its answer for that product type and treat the other as
      // empty.
      const inappArr = Array.isArray(inappRes) ? inappRes : []
      const subsArr = Array.isArray(subsRes) ? subsRes : []
      const bothErrored = !Array.isArray(inappRes) && !Array.isArray(subsRes)

      const ownedBooks = new Set<string>()
      for (const p of inappArr) {
        if (p?.productId) ownedBooks.add(p.productId)
      }

      let subscribed = false
      for (const p of subsArr) {
        if (p?.productId === SUBSCRIPTION_MONTHLY_ID || p?.productId === SUBSCRIPTION_ANNUAL_ID) {
          subscribed = true
          break
        }
      }

      const errorMsg = bothErrored
        ? ((inappRes as { error: string }).error || (subsRes as { error: string }).error)
        : null

      console.info(
        `[appShell.entitlements] refresh #${seq} RESULT — subscribed=${subscribed} ownedBooks=[${[...ownedBooks].join(", ")}] error=${errorMsg ?? "none"} ${Date.now() - t0}ms`
      )

      entitlements = {
        loaded: true,
        iapAvailable: true,
        subscribed,
        ownedBooks,
        error: errorMsg,
      }
      notifyEntitlementListeners()
    } finally {
      entitlementsRefreshing = false
    }
  }

  let disposed = false
  let readerInstance: ReaderInstance | null = null

  // Re-entrancy guard — prevents store subscription from re-triggering
  // switchToNarration while we're already inside it.
  let switching = false

  // Narration IDs currently downloading. When a download finishes, `onInstalled`
  // triggers a full rebuild of the detail/library/now-playing rows — which
  // destroys any still-in-flight download buttons along with their spinner
  // state. On row (re)creation, `createCompactDownloadButton` consults this
  // set to restore the spinner for narrations whose download hasn't landed yet.
  const activeDownloads = new Set<string>()

  // THE canonical read. Every piece of code that needs the current narration
  // reads from this ONE place: drawerStore.
  function getActive(): string {
    return drawerStore.getState().currentNarrationId
  }

  // All narrations from the last catalog fetch
  let allNarrations: CatalogNarrationEntry[] = []
  // Hydrated lookup tables (characters, voiceProfiles, books). Synthesized for
  // legacy catalogs so every UI surface can assume hydrated rows exist.
  let catalogIndex: CatalogIndex | null = null

  // -----------------------------------------------------------------------
  // User's stack languages — drives stack-first ordering in the catalog UI.
  //
  // Surfaces that consult `stackLanguages`:
  //   - browse book cards (3 stack pills + "+N more" chip, or "N languages"
  //     count when there's no overlap)
  //   - book detail (narration rows sorted stack-first, with a "Your
  //     languages" / "More languages" divider)
  //   - narrator profile (stack pills accented, rest collapsed behind a
  //     "Show all" expander)
  //
  // Hydrated synchronously from `hostApi.getStackConfig()` and kept in sync
  // via `onStackConfigChange`. We expect both methods on every real host;
  // the structural typing here keeps appShell decoupled from @shared/sdk.
  // -----------------------------------------------------------------------
  type StackAwareHostApi = {
    getStackConfig?: () => { languages?: string[] } | undefined
    onStackConfigChange?: (
      listener: (next: { languages?: string[] }) => void,
    ) => () => void
  }
  const stackHost = opts.hostApi as StackAwareHostApi
  let stackLanguages: string[] = (() => {
    try {
      const langs = stackHost.getStackConfig?.()?.languages
      return Array.isArray(langs) ? [...langs] : []
    } catch (err) {
      console.warn("[appShell] getStackConfig threw:", err)
      return []
    }
  })()
  const stackUnsub = stackHost.onStackConfigChange?.((next) => {
    const incoming = Array.isArray(next?.languages) ? [...next.languages] : []
    if (sameStringList(incoming, stackLanguages)) return
    stackLanguages = incoming
    // Re-render everywhere stack ordering matters. Browse + library +
    // now-playing all rebuild their lists; the narrator profile, if mounted,
    // re-renders via its own setter so we don't tear it down.
    refreshBrowseSection()
    refreshLibrarySection()
    refreshNowPlayingSection()
    if (browseShowingDetail) {
      if (detailMode === "book") {
        detailBookId = "" // force full rebuild so the divider re-renders
        renderBookDetail()
      } else if (detailMode === "narrator" && narratorDetailInstance) {
        narratorDetailInstance.setStackLanguages(stackLanguages)
      }
    }
  })

  function sameStringList(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }

  // --- State for section renderers (must be before createCommandDrawer,
  //     which calls render() immediately during construction) ---
  let librarySectionEl: HTMLElement | null = null
  let browseSectionEl: HTMLElement | null = null
  let browseActiveLang = ""
  let browseSearchQuery = ""
  let browseShowingDetail = false
  /** Which dimension the browse list is showing. */
  let browseMode: "books" | "narrators" = "books"

  // --- Browse view density + sort (persisted, pack-scoped) ---
  // "compact" = dense scannable rows (default, à la Apple Books / Audible list
  // rows); "expanded" = large-cover cards grouped by series. Sort drives the
  // compact flat list AND the order series float in expanded view.
  type BrowseView = "compact" | "expanded"
  const viewKey = `corpan-catalog-view:${opts.readerId}`
  const sortKey = `corpan-catalog-sort:${opts.readerId}`

  function loadBrowseView(): BrowseView {
    try {
      return localStorage.getItem(viewKey) === "expanded" ? "expanded" : "compact"
    } catch {
      return "compact"
    }
  }
  function loadBrowseSort(): BookSort {
    try {
      const raw = localStorage.getItem(sortKey)
      if (raw === "latest" || raw === "title" || raw === "series") return raw
    } catch { /* ignore */ }
    return "series"
  }
  let browseView: BrowseView = loadBrowseView()
  let browseSort: BookSort = loadBrowseSort()

  // --- Now-playing section state ---
  let nowPlayingSectionEl: HTMLElement | null = null
  let nowPlayingBookId = ""   // track displayed book to avoid full rebuild

  // --- Detail section state ---
  let detailBookId = ""       // track displayed book in detail screen
  /** What kind of detail view is currently mounted in the "detail" screen. */
  let detailMode: "book" | "narrator" = "book"
  /** Active narrator profile id when detailMode === "narrator". */
  let detailNarratorId = ""
  let narratorDetailInstance: NarratorDetail | null = null

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
    {
      id: "privacy",
      title: "Privacy",
      priority: 90,
      render: (container) => renderPrivacySection(container),
    },
  ]

  const allSections = [
    ...builtinSections,
    ...(opts.customSections || []),
  ]

  // --- Narration switcher (compact strip on reader; same component in drawer) ---
  // Build BEFORE the drawer so we can hand the drawer-mode element to it.
  // Both switchers read the same live state via callbacks, so they always agree.
  function getActiveBookId(): string {
    const id = getActive()
    if (!id) return ""
    return getInstalled(id)?.bookId ?? ""
  }

  function refreshSwitchers(): void {
    compactSwitcher.refresh()
  }

  function reportInstallFailure(result: Extract<InstallResult, { ok: false }>): void {
    showToast(result.message, { kind: "error", detail: result.detail })
  }

  async function installAndSwitchNarration(entry: CatalogNarrationEntry): Promise<boolean> {
    const result = await installNarration(entry)
    if (!result.ok) {
      reportInstallFailure(result)
      return false
    }
    switchToNarration(entry.id, false)
    rebuildAll()
    return true
  }

  // --- End-of-book "read next" suggestion ---
  // A tasteful overlay shown when a full book finishes. Reuses the catalog
  // theming vars + .catalog-btn styles so it inherits each reader's look.
  let endOfBookEl: HTMLElement | null = null

  function dismissEndOfBookSuggestion(): void {
    if (!endOfBookEl) return
    endOfBookEl.classList.remove("catalog-eob--open")
    const el = endOfBookEl
    endOfBookEl = null
    // Let the fade-out finish before removing.
    window.setTimeout(() => el.remove(), 250)
  }

  /** Show the next-book suggestion for the book that just finished. */
  function showEndOfBookSuggestion(finishedBookId: string, language: string): void {
    if (disposed) return
    // Only meaningful once the catalog is loaded.
    if (allNarrations.length === 0) return
    const next = chooseNextBook(allNarrations, finishedBookId, language)
    if (!next) return // nothing sensible to suggest — stay out of the way

    // Replace any prior suggestion (e.g. user re-finished a book).
    dismissEndOfBookSuggestion()

    const overlay = document.createElement("div")
    overlay.className = "catalog-eob"
    overlay.setAttribute("dir", "auto")

    const card = document.createElement("div")
    card.className = "catalog-eob-card"

    // Close (×) — dismiss without leaving the finished book.
    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.className = "catalog-eob-close"
    closeBtn.setAttribute("aria-label", tt("reader.eob.dismiss", "Dismiss"))
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`
    closeBtn.addEventListener("click", dismissEndOfBookSuggestion)
    card.appendChild(closeBtn)

    const kicker = document.createElement("div")
    kicker.className = "catalog-eob-kicker"
    kicker.textContent = tt("reader.eob.finished", "End of book")
    card.appendChild(kicker)

    // Cover (if we have one) + next title.
    const coverUrl = catalogIndex?.getCoverUrl(next.book.bookId, next.narration) ?? ""
    if (coverUrl) {
      const cover = document.createElement("div")
      cover.className = "catalog-eob-cover"
      cover.style.backgroundImage = `url(${cssUrl(coverUrl)})`
      card.appendChild(cover)
    }

    const lead = document.createElement("div")
    lead.className = "catalog-eob-lead"
    lead.textContent = tt("reader.eob.upNext", "Up next")
    card.appendChild(lead)

    const title = document.createElement("div")
    title.className = "catalog-eob-title"
    title.textContent = next.book.bookTitle
    card.appendChild(title)

    if (next.book.series) {
      const series = document.createElement("div")
      series.className = "catalog-eob-series"
      series.textContent =
        next.book.series + (next.book.volume ? ` · Vol. ${next.book.volume}` : "")
      card.appendChild(series)
    }

    const actions = document.createElement("div")
    actions.className = "catalog-eob-actions"

    const readBtn = document.createElement("button")
    readBtn.type = "button"
    readBtn.className = "catalog-btn catalog-btn--primary"
    readBtn.textContent = tt("reader.eob.readNext", "Read next")
    readBtn.addEventListener("click", () => {
      dismissEndOfBookSuggestion()
      void installAndSwitchNarration(next.narration)
    })

    const browseBtn = document.createElement("button")
    browseBtn.type = "button"
    browseBtn.className = "catalog-btn"
    browseBtn.textContent = tt("reader.eob.browse", "Browse books")
    browseBtn.addEventListener("click", () => {
      dismissEndOfBookSuggestion()
      drawer.open()
      drawer.navigateTo("browse")
    })

    actions.append(readBtn, browseBtn)
    card.appendChild(actions)
    overlay.appendChild(card)

    container.appendChild(overlay)
    endOfBookEl = overlay
    // Next frame → trigger the fade/translate-in transition.
    requestAnimationFrame(() => overlay.classList.add("catalog-eob--open"))
  }

  const switcherCallbacks = {
    getActiveId: () => getActive(),
    getActiveBookId,
    getInstalled: () => listInstalled(),
    getCatalog: () => allNarrations,
    isIapAvailable: () => iapAvailableSync(),
    isSubscriber: () => isSubscriberSync(),
    ownsBook: (productId: string) => ownsBookSync(productId),
    getLanguageName: (code: string) => getLanguageName(code),
    onSwitch: (id: string) => switchToNarration(id, false),
    onInstallAndSwitch: (entry: CatalogNarrationEntry) => installAndSwitchNarration(entry),
  }

  const compactSwitcher: NarrationSwitcher = createNarrationSwitcher({
    mode: "compact",
    ...switcherCallbacks,
  })

  // --- Compact narration switcher placement ---
  // The book title used to render in its own row above this switcher; it now
  // lives inline next to the chapter label inside the transport bar (set by
  // each reader via `transport.setBookTitle`), so this slot only carries the
  // language pills. Inserted as the first child of the transport bar so the
  // pills sit right above the chapter / scrub / controls.

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
      void fetchCatalog(cdnUrl, { forceRefresh: true, fallbackUrl: FALLBACK_CDN_URL }).then((catalog) => {
        allNarrations = catalog.narrations
        refreshNowPlayingSection()
        refreshBrowseSection()
        refreshLibrarySection()
        refreshSwitchers()
      })
    },
  })

  // Refresh switchers when libraryStore changes (install/uninstall) so the strip
  // stays in sync without each caller having to remember.
  const librarySwitcherUnsub = libraryStore.subscribe(() => refreshSwitchers())

  // Subscribe to store for minimal active-row update (avoids full re-render FUOC)
  const storeUnsub = drawerStore.subscribe((state, prev) => {
    if (state.currentNarrationId !== prev.currentNarrationId) {
      if (browseShowingDetail) updateDetailActiveRow(state.currentNarrationId)
      refreshLibrarySection()
      refreshNowPlayingSection()
      refreshSwitchers()
    }
  })

  function updateDetailActiveRow(activeId: string | undefined): void {
    if (!browseSectionEl) return
    const rows = browseSectionEl.querySelectorAll("[data-narration-id]")
    for (const row of rows) {
      const el = row as HTMLElement
      const isActive = el.dataset.narrationId === activeId
      el.classList.toggle("catalog-row--active", isActive)
      const rail = el.querySelector(".catalog-row-rail") as HTMLElement | null
      rail?.classList.toggle("catalog-row-rail--active", isActive)
    }
  }

  /** Surgical update of narration rows within a container — no teardown/rebuild.
   *  Falls back to full rebuild if the installed row set has changed. */
  function updateNarrationRows(container: HTMLElement, activeId: string): void {
    const rows = container.querySelectorAll("[data-narration-id]")
    if (rows.length === 0) return

    const installedRows = container.querySelectorAll(".catalog-row--installed")
    const stillInstalled = Array.from(installedRows).every((r) => {
      const id = (r as HTMLElement).dataset.narrationId
      return id ? isInstalled(id) : false
    })

    if (!stillInstalled) {
      if (container === nowPlayingSectionEl) {
        nowPlayingBookId = ""
        refreshNowPlayingSection()
      } else {
        detailBookId = ""
        renderBookDetail()
      }
      return
    }

    for (const row of rows) {
      const el = row as HTMLElement
      const isActive = el.dataset.narrationId === activeId
      el.classList.toggle("catalog-row--active", isActive)
      const rail = el.querySelector(".catalog-row-rail") as HTMLElement | null
      rail?.classList.toggle("catalog-row-rail--active", isActive)
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

  // -----------------------------------------------------------------------
  // Entitlement refresh wiring
  // -----------------------------------------------------------------------
  // Refresh entitlements on:
  //   - mount (immediately, fire-and-forget)
  //   - visibilitychange to "visible" (with 30s throttle)
  //   - corpan:purchase-recorded (immediate)
  //   - corpan:subscription-recorded (immediate)
  //   - corpan:restore-purchases-completed (immediate)
  //
  // After every refresh, rebuild the visible UI so paywalls / lock icons
  // / subscription badges reflect the new state.
  let lastEntitlementRefreshAt = 0
  const ENTITLEMENT_REFRESH_THROTTLE_MS = 30_000

  function entitlementChanged(): void {
    rebuildAll()
  }
  entitlementListeners.add(entitlementChanged)

  void refreshEntitlements("mount")

  const onVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") return
    const now = Date.now()
    if (now - lastEntitlementRefreshAt < ENTITLEMENT_REFRESH_THROTTLE_MS) return
    lastEntitlementRefreshAt = now
    void refreshEntitlements("visibilitychange")
  }
  document.addEventListener("visibilitychange", onVisibilityChange)

  const onPurchaseEvent = (e: Event): void => {
    lastEntitlementRefreshAt = Date.now()
    void refreshEntitlements(`event:${e.type}`)
  }
  window.addEventListener("corpan:purchase-recorded", onPurchaseEvent)
  window.addEventListener("corpan:subscription-recorded", onPurchaseEvent)
  window.addEventListener("corpan:restore-purchases-completed", onPurchaseEvent)

  // End of a full book → suggest the next one to read (subscriber/owned path).
  // The reader signals `corpan:book-finished`; we own the catalog, so we pick
  // the next title and present it.
  const onBookFinished = (e: Event): void => {
    const detail = (e as CustomEvent).detail as
      | { bookId?: string; language?: string }
      | undefined
    if (!detail?.bookId) return
    const bookId = detail.bookId
    const language = detail.language || drawerStore.getState().currentLanguage
    // A returning user can open an installed book straight from the restored
    // library and finish it without ever opening the drawer — so the catalog
    // was never fetched and `showEndOfBookSuggestion` would no-op. Lazy-hydrate
    // it here, then suggest the next book.
    if (allNarrations.length === 0) {
      void fetchCatalog(cdnUrl, { fallbackUrl: FALLBACK_CDN_URL })
        .then((catalog) => {
          if (disposed) return
          allNarrations = catalog.narrations
          showEndOfBookSuggestion(bookId, language)
        })
        .catch(() => {})
      return
    }
    showEndOfBookSuggestion(bookId, language)
  }
  window.addEventListener("corpan:book-finished", onBookFinished)

  // -----------------------------------------------------------------------
  // Corpán Plus preview → full upgrade (3 layers).
  //
  // The upgrade manager reuses OUR in-memory catalog so it never double-fetches.
  setUpgradeCatalogProvider(() => allNarrations)

  // Layer 1 + 2 trigger: the app dispatches `corpan:entitlements-changed`
  // {plus:true} the moment Plus becomes active (purchase / restore / async
  // StoreKit delivery). First upgrade the ACTIVE book on ANY connection (the
  // one they just paid to finish), then kick the background sweep for the rest
  // (gated to Wi-Fi inside runUpgradeSweep).
  let upgradeKickInFlight = false
  const onEntitlementsChanged = (e: Event): void => {
    const detail = (e as CustomEvent<{ plus?: boolean }>).detail
    if (!detail?.plus) return
    if (upgradeKickInFlight) return
    upgradeKickInFlight = true
    void (async () => {
      try {
        // Make sure our entitlement snapshot reflects Plus before we rebuild UI.
        await refreshEntitlements("event:entitlements-changed")
        const active = getActive()
        if (active) {
          // High priority: the active book first, any connection.
          await upgradeActiveNarration(active)
        }
        // Then everything else, best-effort + Wi-Fi-gated.
        await runUpgradeSweep()
      } catch (err) {
        console.warn("[appShell] upgrade kick failed:", err)
      } finally {
        upgradeKickInFlight = false
      }
    })()
  }
  window.addEventListener(ENTITLEMENTS_CHANGED_EVENT, onEntitlementsChanged)

  // Layer D: when a narration finishes upgrading preview → full, if it's the
  // one currently open, reload it so the reader picks up the now-full
  // segments.json and AUTO-CONTINUES from the saved bookmark (seamless — the
  // preview cut off at its last segment; the full pack flows on from there).
  const onNarrationUpgraded = (e: Event): void => {
    const detail = (e as CustomEvent<{ narrationId?: string }>).detail
    const upgradedId = detail?.narrationId
    if (!upgradedId) return
    // Refresh library/now-playing chrome so size/labels reflect the full pack.
    refreshLibrarySection()
    refreshNowPlayingSection()
    refreshSwitchers()
    if (upgradedId !== getActive()) return
    // Persist the live position before tearing down, so the reload resumes from
    // exactly where the preview ended, then auto-continue into the full content.
    try {
      readerInstance?.persistBookmark?.()
    } catch (err) {
      console.warn("[appShell] persistBookmark before upgrade reload failed:", err)
    }
    switchToNarration(upgradedId, false, true)
  }
  window.addEventListener(NARRATION_UPGRADED_EVENT, onNarrationUpgraded)

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
    // Nothing installed → the first-run "instant wow": auto-download the FREE
    // preview narrations of a default book for the user's stack and open it
    // ready to play. Self-sufficient on PURPOSE — we seed whenever the library
    // is empty, whether or not onboarding passed a `seedBookId` (so opening a
    // freshly-installed reader from anywhere still gets content). The host param
    // only overrides WHICH book. On any failure we degrade to browse.
    const seedBookId =
      (typeof opts.initialState?.seedBookId === "string" && opts.initialState.seedBookId) ||
      DEFAULT_SEED_BOOK
    void seedFirstBook(seedBookId)
  }

  function showBrowseOnboarding(): void {
    drawerStore.setState({ activeScreen: "browse" })
    drawer.open()
    void fetchCatalog(cdnUrl, { fallbackUrl: FALLBACK_CDN_URL }).then((catalog) => {
      allNarrations = catalog.narrations
      refreshBrowseSection()
    })
  }

  /** Resilient catalog fetch for the seed — a couple of attempts before we give
   *  up (the resilient layer already retries per call; this rides out a longer
   *  outage on a cold launch). */
  async function fetchCatalogForSeed(): Promise<CatalogNarrationEntry[] | null> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const catalog = await fetchCatalog(cdnUrl, { fallbackUrl: FALLBACK_CDN_URL })
        if (catalog?.narrations?.length) return catalog.narrations
      } catch (err) {
        console.warn(`[appShell] seed catalog fetch attempt ${attempt} failed:`, err)
      }
      await new Promise((r) => setTimeout(r, 600 * attempt))
    }
    return null
  }

  /**
   * First-run "instant wow": auto-download the FREE preview narrations of the
   * seed book for the user's stack languages — the PRIMARY first (opens ready to
   * play), the rest in the BACKGROUND (the switcher refreshes as each lands).
   * Free for everyone (preview ZIPs are public). Resilient: retries the catalog,
   * falls back across languages (stack → English → any), and only degrades to
   * the browse screen when there's genuinely nothing to install.
   */
  async function seedFirstBook(bookId: string): Promise<void> {
    const base = (t: string) => (t.split("-")[0] || t).toLowerCase()
    try {
      const rawStack = (stackHost.getStackConfig?.()?.languages ?? []).filter(Boolean)
      // Never bail on an empty stack — default to English so the user always
      // gets a book to open.
      const stack = rawStack.length ? rawStack : ["en"]
      console.log("[appShell] seedFirstBook start", { bookId, stack })

      const narrations = await fetchCatalogForSeed()
      if (!narrations) {
        console.warn("[appShell] seedFirstBook: catalog unavailable → browse")
        return showBrowseOnboarding()
      }
      allNarrations = narrations

      // Free-preview narrations of the seed book, indexed by base language.
      const previewByLang = new Map<string, CatalogNarrationEntry>()
      for (const n of narrations) {
        if (n.bookId !== bookId || !n.preview) continue
        const b = base(n.language)
        if (!previewByLang.has(b)) previewByLang.set(b, n)
      }
      console.log("[appShell] seedFirstBook previews", {
        book: bookId,
        langs: [...previewByLang.keys()],
      })
      if (previewByLang.size === 0) {
        console.warn("[appShell] seedFirstBook: no preview narrations for", bookId, "→ browse")
        return showBrowseOnboarding()
      }

      // The narrations to install = the user's STACK languages that have a free
      // preview (in stack order), deduped. We install ONLY the stack — not every
      // language the book offers — so the switcher mirrors the user's stack.
      const stackEntries: CatalogNarrationEntry[] = []
      const seen = new Set<string>()
      for (const l of stack) {
        const b = base(l)
        const e = previewByLang.get(b)
        if (e && !seen.has(b)) { seen.add(b); stackEntries.push(e) }
      }
      // Primary = first stack language with a preview; if the stack has none,
      // fall back to English, then any available preview, so we ALWAYS open a
      // book (the instant "wow" never degrades to an empty screen).
      const primaryEntry =
        stackEntries[0] ?? previewByLang.get("en") ?? [...previewByLang.values()][0]
      if (!primaryEntry) {
        console.warn("[appShell] seedFirstBook: no installable narration → browse")
        return showBrowseOnboarding()
      }
      // Background = the rest of the stack (never the off-stack extras).
      const background = stackEntries.filter((e) => e.id !== primaryEntry.id)
      console.log("[appShell] seedFirstBook installing primary", primaryEntry?.language, primaryEntry?.id)
      let res = await installNarration(primaryEntry)
      if (!res.ok) {
        res = await installNarration(primaryEntry) // one retry
      }
      if (!res.ok || !isInstalled(primaryEntry.id)) {
        console.warn("[appShell] seedFirstBook: primary install failed → browse", res)
        return showBrowseOnboarding()
      }
      console.log("[appShell] seedFirstBook primary installed → opening", primaryEntry.language)
      switchToNarration(primaryEntry.id)

      // Background: install the rest of the stack SEQUENTIALLY — concurrent native
      // installs (content_packs_install_from_url) can collide on shared temp/lock
      // state, so we queue them one at a time. The switcher refreshes as each
      // lands, so the user can flip languages the moment each is ready.
      void (async () => {
        for (const entry of background) {
          try {
            const r = await installNarration(entry)
            if (r.ok) {
              console.log("[appShell] seedFirstBook bg installed", entry.language)
              refreshSwitchers()
            } else {
              console.warn("[appShell] seedFirstBook bg failed", entry.language, r)
            }
          } catch (e) {
            console.warn("[appShell] seedFirstBook bg error", entry.language, e)
          }
        }
      })()
    } catch (err) {
      console.warn("[appShell] seedFirstBook failed:", err)
      showBrowseOnboarding()
    }
  }

  // --- Reader management ---
  function mountReader(state?: Record<string, unknown>): void {
    if (readerInstance) {
      readerInstance.dispose()
      readerInstance = null
    }

    readerInstance = opts.createReader(container, opts.hostApi, state)

    // Re-attach drawer trigger + compact narration switcher.
    // The trigger is a top-right absolute button on the UI overlay.
    // The switcher sits full-width as the first child of the transport bar so
    // it renders right above the playback controls — the natural "keep-my-eyes
    // here" position for language toggling while reading.
    const uiOverlay = container.querySelector(
      ".stargate-ui, .earthgate-ui"
    ) as HTMLElement | null
    if (uiOverlay) {
      uiOverlay.append(drawer.getTrigger())
    }
    const transportEl = container.querySelector(
      ".earthgate-transport, .stargate-transport"
    ) as HTMLElement | null
    if (transportEl) {
      transportEl.insertBefore(compactSwitcher.element, transportEl.firstChild)
    } else if (uiOverlay) {
      uiOverlay.append(compactSwitcher.element)
    }
    compactSwitcher.refresh()
  }

  /** THE one function for activating a narration. Sets the canonical store,
   *  mounts the reader, and updates pills. Nothing else writes narration state.
   *
   *  `forcePlay` makes the new instance auto-continue playback even when the
   *  outgoing reader wasn't playing — used for the post-purchase upgrade reload,
   *  where the preview's playback had just ENDED at the paywall but we want to
   *  flow straight into the now-full content from the saved bookmark. */
  function switchToNarration(
    narrationId: string,
    closeDrawer = false,
    forcePlay = false
  ): void {
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
      autoPlay: forcePlay || wasPlaying,
      startAtSegmentStart: true,
    }

    // Track recent-use so the switcher's most-recent ordering reflects reality.
    recordNarrationUse(narrationId)

    if (closeDrawer) drawer.close()
    mountReader(newState)
    refreshSwitchers()

    // Anonymous analytics — bookOpened auto-closes any prior open book and
    // emits a language_switch event when this book was previously seen in a
    // different language (within-session OR across sessions).
    analytics.bookOpened({
      bookId: info.bookId,
      narrationPackId: narrationId,
      language: info.language,
      voiceId: info.voiceId,
    })

    // Layer 3 (JIT self-heal): opening a preview while Plus upgrades it in the
    // background. Fire-and-forget — on success it dispatches
    // `corpan:narration-upgraded`, which reloads this same book into the full
    // content (auto-continuing). `forcePlay` here would just be the reload's
    // job, so we DON'T re-open with play; we let the upgraded event drive it
    // (and only if it's still the active book). No-op when already full / not Plus.
    if (!forcePlay) {
      void maybeUpgradeOnOpen(narrationId)
    }
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

    // Paid-book CTA — edge case but matters: user was listening with a
    // subscription that since expired, still has the downloaded narration
    // playing, but wants to keep access to this book. Same Buy offer
    // block as the Browse detail screen. Hidden on the happy path
    // (subscriber, already owns the book, or free book).
    const npBookProductId = getBookProductId(bookNarrations)
    const npBookIsPaid = bookNarrations.some(n => n.purchase.type === "iap")
    const npUserOwnsBook = npBookIsPaid && npBookProductId
      ? ownsBookSync(npBookProductId)
      : !npBookIsPaid
    const npIsSubscriber = isSubscriberSync()
    const npIapAvailable = iapAvailableSync()
    // Don't show any paywall until entitlements have loaded — otherwise
    // a subscriber sees the Buy CTA flash for a frame before the live
    // state lands. With `entitlementsLoaded()` gate, the slot stays empty
    // until we know the truth.
    if (
      entitlementsLoaded() &&
      npBookIsPaid &&
      npBookProductId &&
      !npUserOwnsBook &&
      !npIsSubscriber &&
      npIapAvailable
    ) {
      detail.appendChild(
        createBookCta(bookNarrations, npBookProductId, () => rebuildAll())
      )
    }

    // Installed narrations
    const installedNarrs = bookNarrations.filter(n => isInstalled(n.id))
    const availableNarrs = bookNarrations.filter(n => !isInstalled(n.id))
    const active = getActive()

    const rowHandlers: RowHandlers = {
      activeId: active,
      onSwitch: (narr) => {
        if (narr.id === getActive()) return
        switchToNarration(narr.id)
      },
      onDeleted: () => {
        nowPlayingBookId = ""
        refreshNowPlayingSection()
        refreshLibrarySection()
      },
      // Downloading a narration from Now Playing SELECTS it — the user pulled
      // this language/voice from the surface that shows what's currently
      // playing, so make it the active narration (then rebuild every surface).
      onInstalled: (narr) => {
        if (isInstalled(narr.id) && narr.id !== getActive()) {
          switchToNarration(narr.id)
        }
        rebuildAll()
      },
    }

    for (const narr of installedNarrs) {
      detail.appendChild(createCompactRow(narr, rowHandlers))
    }

    if (availableNarrs.length > 0) {
      const sTitle = document.createElement("div")
      sTitle.className = "catalog-detail-section-title"
      sTitle.textContent = installedNarrs.length > 0 ? "More narrations" : "Narrations"
      sTitle.style.marginTop = "16px"
      detail.appendChild(sTitle)

      for (const narr of availableNarrs) {
        detail.appendChild(createCompactRow(narr, rowHandlers))
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
    void fetchCatalog(cdnUrl, { fallbackUrl: FALLBACK_CDN_URL }).then((catalog) => {
      allNarrations = catalog.narrations
      catalogIndex = buildCatalogIndex(catalog)
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
    browseSectionEl.innerHTML = ""

    if (allNarrations.length === 0) {
      const loading = document.createElement("div")
      loading.className = "catalog-loading"
      loading.innerHTML = `<div class="catalog-spinner"></div> Loading catalog...`
      browseSectionEl.appendChild(loading)
      return
    }

    // Books / Narrators tab strip — only when we have more than one character
    // worth showing. Single-narrator catalogs don't benefit from a tab.
    const showTabs = (catalogIndex?.characters.length ?? 0) > 1
    if (showTabs) {
      const tabs = document.createElement("div")
      tabs.className = "catalog-tabs"

      const booksTab = document.createElement("button")
      booksTab.type = "button"
      booksTab.className =
        "catalog-tab" + (browseMode === "books" ? " catalog-tab--active" : "")
      booksTab.textContent = tt("catalog.tab.books", "Books")
      booksTab.onclick = () => {
        if (browseMode === "books") return
        browseMode = "books"
        refreshBrowseSection()
      }
      tabs.appendChild(booksTab)

      const narratorsTab = document.createElement("button")
      narratorsTab.type = "button"
      narratorsTab.className =
        "catalog-tab" + (browseMode === "narrators" ? " catalog-tab--active" : "")
      narratorsTab.textContent = tt("catalog.tab.narrators", "Narrators")
      narratorsTab.onclick = () => {
        if (browseMode === "narrators") return
        browseMode = "narrators"
        refreshBrowseSection()
      }
      tabs.appendChild(narratorsTab)

      browseSectionEl.appendChild(tabs)
    } else {
      // Catalog only knows one narrator — keep the books view; flip the flag in
      // case it had been set by a prior catalog with more characters.
      browseMode = "books"
    }

    // Search input
    const header = document.createElement("div")
    header.className = "command-drawer-browse-header"

    const searchInput = document.createElement("input")
    searchInput.className = "command-drawer-browse-search"
    searchInput.type = "text"
    searchInput.placeholder =
      browseMode === "narrators"
        ? tt("catalog.search.narrators", "Search narrators...")
        : tt("catalog.search.books", "Search books...")
    searchInput.value = browseSearchQuery
    searchInput.addEventListener("input", () => {
      browseSearchQuery = searchInput.value
      renderBrowseResults()
    })
    header.appendChild(searchInput)
    browseSectionEl.appendChild(header)

    // View density + sort controls — books mode only. The narrators tab is an
    // avatar grid that doesn't benefit from a dense/sort toggle.
    if (browseMode === "books") {
      browseSectionEl.appendChild(buildBrowseControls())
    }

    // Language filter — single chooser button; bottom-sheet for scale.
    // Narrators view doesn't filter by language at the top level (the per-narrator
    // language pills do that on the profile screen).
    const availLangs = getAvailableLanguages(allNarrations)
    if (browseMode === "books" && availLangs.length > 1) {
      const chooser = document.createElement("button")
      chooser.type = "button"
      chooser.className = "catalog-lang-chooser"

      const renderChooserLabel = () => {
        const label = browseActiveLang
          ? getLanguageName(browseActiveLang)
          : "All Languages"
        chooser.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
          <span class="catalog-lang-chooser-label">${label}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="catalog-lang-chooser-caret"><polyline points="6 9 12 15 18 9"/></svg>
        `
      }
      renderChooserLabel()

      chooser.addEventListener("click", () => {
        openLanguageChooser(availLangs, browseActiveLang, (code) => {
          browseActiveLang = code
          refreshBrowseSection()
        })
      })

      browseSectionEl.appendChild(chooser)
    }

    // Results container
    const results = document.createElement("div")
    results.dataset.browseResults = "1"
    browseSectionEl.appendChild(results)

    renderBrowseResults()
  }

  // SVG glyphs for the compact/expanded view toggle.
  const SVG_VIEW_COMPACT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`
  const SVG_VIEW_EXPANDED = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`

  /**
   * Browse controls bar: a Latest / Title / Series sort segment + a
   * compact/expanded density toggle. Both choices persist (pack-scoped) and
   * trigger a results re-render only — the catalog isn't refetched.
   */
  function buildBrowseControls(): HTMLElement {
    const bar = document.createElement("div")
    bar.className = "catalog-controls"

    // --- Sort segmented control ---
    const seg = document.createElement("div")
    seg.className = "catalog-sort"
    seg.setAttribute("role", "radiogroup")
    seg.setAttribute(
      "aria-label",
      tt("catalog.sort.label", "Sort books"),
    )

    const sortOptions: { id: BookSort; label: string }[] = [
      { id: "latest", label: tt("catalog.sort.latest", "Latest") },
      { id: "title", label: tt("catalog.sort.title", "Title") },
      { id: "series", label: tt("catalog.sort.series", "Series") },
    ]
    for (const opt of sortOptions) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className =
        "catalog-sort-opt" + (browseSort === opt.id ? " catalog-sort-opt--active" : "")
      btn.textContent = opt.label
      btn.setAttribute("role", "radio")
      btn.setAttribute("aria-checked", browseSort === opt.id ? "true" : "false")
      btn.addEventListener("click", () => {
        if (browseSort === opt.id) return
        browseSort = opt.id
        try { localStorage.setItem(sortKey, browseSort) } catch { /* ignore */ }
        refreshBrowseSection()
      })
      seg.appendChild(btn)
    }
    bar.appendChild(seg)

    // --- Density toggle (compact ↔ expanded) ---
    const toggle = document.createElement("button")
    toggle.type = "button"
    toggle.className = "catalog-view-toggle"
    const compactNext = browseView === "expanded"
    // The button SHOWS the icon of the mode it switches TO, with a label
    // describing that target, so it reads as an action.
    toggle.innerHTML = compactNext ? SVG_VIEW_COMPACT : SVG_VIEW_EXPANDED
    const toggleLabel = compactNext
      ? tt("catalog.view.compact", "Compact")
      : tt("catalog.view.expanded", "Expanded")
    const labelSpan = document.createElement("span")
    labelSpan.className = "catalog-view-toggle-label"
    labelSpan.textContent = toggleLabel
    toggle.appendChild(labelSpan)
    toggle.setAttribute("aria-label", toggleLabel)
    toggle.title = toggleLabel
    toggle.addEventListener("click", () => {
      browseView = browseView === "compact" ? "expanded" : "compact"
      try { localStorage.setItem(viewKey, browseView) } catch { /* ignore */ }
      refreshBrowseSection()
    })
    bar.appendChild(toggle)

    return bar
  }

  function renderBrowseResults(): void {
    if (!browseSectionEl) return
    const results = browseSectionEl.querySelector("[data-browse-results]") as HTMLElement | null
    if (!results) return
    results.innerHTML = ""

    if (browseMode === "narrators") {
      renderNarratorsResults(results)
      return
    }

    let filtered = allNarrations
    if (browseActiveLang) filtered = filterByLanguage(filtered, browseActiveLang)
    if (browseSearchQuery) filtered = searchByTitle(filtered, browseSearchQuery)

    if (filtered.length === 0) {
      // Cold-start offline with no cached catalog → calm notice instead of
      // a misleading "no matches" empty state. Installed narrations still
      // play from the local pack — only the discovery surface needs net.
      if (allNarrations.length === 0 && !isOnline()) {
        const notice = createOfflineNotice({
          title: "Browse needs internet",
          subtitle:
            "Reconnect to discover new narrations. Your installed books still play offline.",
        })
        results.appendChild(notice.element)
        return
      }
      const empty = document.createElement("div")
      empty.className = "command-drawer-browse-empty"
      empty.textContent = "No books match your search"
      results.appendChild(empty)
      return
    }

    const active = getActive()

    if (browseView === "compact") {
      // Dense, flat, scannable list (Apple Books / Audible list rows). Series
      // grouping is dropped in favor of packing rows; the "Series" sort still
      // keeps each series contiguous and in volume order, so a series is never
      // scattered. A small series caption sits in each row's meta line.
      const books = sortBooks(groupByBook(filtered), browseSort)
      const list = document.createElement("div")
      list.className = "catalog-list"
      for (const book of books) {
        list.appendChild(buildBookRow(book, active))
      }
      results.appendChild(list)
    } else if (browseSort === "series") {
      // Expanded + series sort → the classic grouped grid with series headers.
      const seriesGroups = groupBySeries(filtered)
      for (const sg of seriesGroups) {
        const sectionTitle = document.createElement("div")
        sectionTitle.className = "command-drawer-section-title"
        sectionTitle.textContent = sg.series
        results.appendChild(sectionTitle)

        const grid = document.createElement("div")
        grid.className = "catalog-grid"
        for (const book of sg.books) {
          grid.appendChild(buildBookCard(book, active))
        }
        results.appendChild(grid)
      }
    } else {
      // Expanded + latest/title → a single flat grid in the chosen order, so the
      // sort is actually expressed (series headers would fight a date/title sort).
      const books = sortBooks(groupByBook(filtered), browseSort)
      const grid = document.createElement("div")
      grid.className = "catalog-grid"
      for (const book of books) {
        grid.appendChild(buildBookCard(book, active))
      }
      results.appendChild(grid)
    }
  }

  /** Large-cover book card (expanded view). */
  function buildBookCard(
    book: BookGroup,
    active: string,
  ): HTMLElement {
    const card = document.createElement("div")
    card.className = "catalog-card"
    card.addEventListener("click", () => {
      const bookNarrations = allNarrations.filter(n => n.bookId === book.bookId)
      showInlineBookDetail(bookNarrations)
    })

    const bookEntry = catalogIndex?.getBook(book.bookId)
    const coverUrl = catalogIndex?.getCoverUrl(book.bookId, book.narrations[0]) ?? ""
    if (coverUrl || bookEntry) {
      const thumb = document.createElement("div")
      if (coverUrl) {
        thumb.className = "catalog-cover-thumb"
        thumb.style.backgroundImage = `url(${cssUrl(coverUrl)})`
      } else {
        thumb.className = "catalog-cover-thumb catalog-cover-thumb--placeholder"
        thumb.textContent = initials(book.bookTitle)
      }
      const chips = makeNarratorChipsForBook(book.narrations, "on-cover")
      if (chips) {
        const overlay = document.createElement("div")
        overlay.className = "catalog-cover-thumb-overlay"
        overlay.appendChild(chips)
        thumb.appendChild(overlay)
      }
      card.appendChild(thumb)
    }

    const title = document.createElement("div")
    title.className = "catalog-card-title"
    title.textContent = book.bookTitle

    const langs = renderStackFirstLangBadges(book.languages, { variant: "card" })

    card.append(title, langs)

    if (book.narrations.some(n => n.id === active)) {
      card.classList.add("catalog-card--active")
    }
    return card
  }

  /** Dense list row (compact view): small thumb + title + meta + lang badges. */
  function buildBookRow(
    book: BookGroup,
    active: string,
  ): HTMLElement {
    const row = document.createElement("button")
    row.type = "button"
    row.className = "catalog-list-row"
    if (book.narrations.some(n => n.id === active)) {
      row.classList.add("catalog-list-row--active")
    }
    row.addEventListener("click", () => {
      const bookNarrations = allNarrations.filter(n => n.bookId === book.bookId)
      showInlineBookDetail(bookNarrations)
    })

    // Leading thumbnail
    const coverUrl = catalogIndex?.getCoverUrl(book.bookId, book.narrations[0]) ?? ""
    const thumb = document.createElement("div")
    if (coverUrl) {
      thumb.className = "catalog-list-thumb"
      thumb.style.backgroundImage = `url(${cssUrl(coverUrl)})`
    } else {
      thumb.className = "catalog-list-thumb catalog-list-thumb--placeholder"
      thumb.textContent = initials(book.bookTitle)
    }
    row.appendChild(thumb)

    // Info column: title + meta line (series · author/price), then lang badges.
    const info = document.createElement("div")
    info.className = "catalog-list-info"

    const title = document.createElement("div")
    title.className = "catalog-list-title"
    title.textContent = book.bookTitle
    info.appendChild(title)

    const bookEntry = catalogIndex?.getBook(book.bookId)
    const metaBits: string[] = []
    if (book.series) {
      metaBits.push(book.series + (book.volume ? ` · Vol. ${book.volume}` : ""))
    }
    if (bookEntry?.author) metaBits.push(bookEntry.author)

    const sub = document.createElement("div")
    sub.className = "catalog-list-sub"
    if (metaBits.length > 0) {
      const subText = document.createElement("span")
      subText.className = "catalog-list-sub-text"
      subText.textContent = metaBits.join(" · ")
      sub.appendChild(subText)
    }
    info.appendChild(sub)

    const langs = renderStackFirstLangBadges(book.languages, { variant: "card" })
    langs.classList.add("catalog-list-langs")
    info.appendChild(langs)

    row.appendChild(info)

    return row
  }

  /** Render the Narrators tab — avatar grid of every active character. */
  function renderNarratorsResults(results: HTMLElement): void {
    if (!catalogIndex) return
    const q = browseSearchQuery.trim().toLowerCase()
    const active = catalogIndex.characters.filter((c) => c.status !== "deprecated")
    const filtered = q
      ? active.filter(
          (c) =>
            c.displayName.toLowerCase().includes(q) ||
            (c.tagline?.toLowerCase().includes(q) ?? false),
        )
      : active

    if (filtered.length === 0) {
      const empty = document.createElement("div")
      empty.className = "command-drawer-browse-empty"
      empty.textContent = q
        ? tt("catalog.narrators.empty.search", "No narrators match your search")
        : tt("catalog.narrators.empty", "No narrators yet")
      results.appendChild(empty)
      return
    }

    const grid = document.createElement("div")
    grid.className = "catalog-narrator-grid"
    for (const c of filtered) {
      grid.appendChild(makeNarratorCard(c))
    }
    results.appendChild(grid)
  }

  function makeNarratorCard(character: Character): HTMLElement {
    const card = document.createElement("button")
    card.type = "button"
    card.className = "catalog-narrator-card"
    card.onclick = () => showInlineNarratorDetail(character.id)

    const avatar = document.createElement("div")
    if (character.avatarUrl) {
      avatar.className = "catalog-narrator-card-avatar"
      avatar.style.backgroundImage = `url(${cssUrl(character.avatarUrl)})`
    } else {
      avatar.className =
        "catalog-narrator-card-avatar catalog-narrator-card-avatar--placeholder"
      avatar.textContent = initials(character.displayName)
    }
    card.appendChild(avatar)

    const name = document.createElement("div")
    name.className = "catalog-narrator-card-name"
    name.textContent = character.displayName
    card.appendChild(name)

    if (catalogIndex) {
      const narrationCount = catalogIndex.getNarrationsForCharacter(character.id).length
      const langCount = catalogIndex.getCharacterLanguages(character.id).length
      const meta = document.createElement("div")
      meta.className = "catalog-narrator-card-meta"
      const narrLabel = tt(
        "catalog.narrators.card.narrations",
        "{{count}} narrations",
        { count: narrationCount },
      )
      const langLabel = tt(
        "catalog.narrators.card.languages",
        "{{count}} languages",
        { count: langCount },
      )
      meta.textContent = `${narrLabel} · ${langLabel}`
      card.appendChild(meta)
    }

    return card
  }

  /**
   * Build a chip (or row of chips) representing the distinct narrators of a
   * book's narrations. Returns null when there's nothing meaningful to show
   * (no character data hydrated, or no avatar/name to render).
   */
  function makeNarratorChipsForBook(
    narrations: CatalogNarrationEntry[],
    placement: "on-cover" | "default",
  ): HTMLElement | null {
    if (!catalogIndex) return null
    const seen = new Set<string>()
    const characters: Character[] = []
    for (const n of narrations) {
      const c = catalogIndex.getCharacterForNarration(n)
      if (!c) continue
      if (seen.has(c.id)) continue
      seen.add(c.id)
      characters.push(c)
      if (characters.length >= 2) break
    }
    if (characters.length === 0) return null
    const wrap = document.createElement("div")
    wrap.style.display = "inline-flex"
    wrap.style.gap = "6px"
    wrap.style.flexWrap = "wrap"
    wrap.style.minWidth = "0"
    for (const c of characters) {
      wrap.appendChild(makeCharacterChip(c, placement))
    }
    return wrap
  }

  function makeCharacterChip(
    character: Character,
    placement: "on-cover" | "default",
  ): HTMLElement {
    const chip = document.createElement("button")
    chip.type = "button"
    chip.className =
      "catalog-character-chip" +
      (placement === "on-cover" ? " catalog-character-chip--on-cover" : "")
    chip.onclick = (e) => {
      e.stopPropagation()
      showInlineNarratorDetail(character.id)
    }

    const avatar = document.createElement("span")
    if (character.avatarUrl) {
      avatar.className = "catalog-character-chip-avatar"
      avatar.style.backgroundImage = `url(${cssUrl(character.avatarUrl)})`
    } else {
      avatar.className =
        "catalog-character-chip-avatar catalog-character-chip-avatar--placeholder"
      avatar.textContent = initials(character.displayName)
    }
    chip.appendChild(avatar)

    const name = document.createElement("span")
    name.className = "catalog-character-chip-name"
    name.textContent = character.displayName
    chip.appendChild(name)

    return chip
  }

  /**
   * Render a row of language badges for a book card, prioritizing the user's
   * stack. With 50-language books, a flat pill row is visual noise; this
   * surfaces the languages the user actually cares about and collapses
   * everything ELSE into a "+N more" or "N languages" chip.
   *
   * Behaviour:
   *   - Books with ≤3 total languages render every language directly.
   *   - Books with stack matches render EVERY stack-matched language (in
   *     stack order) + a "+N more" chip counting only the non-stack langs.
   *     Stacks of 5–15 are common — wrapping across rows is acceptable;
   *     hiding a stack language behind a count is not.
   *   - Books with zero stack overlap render a single muted "N languages"
   *     count chip — a nudge that this title exists in many languages.
   */
  function renderStackFirstLangBadges(
    allLanguages: string[],
    opts: { variant: "card" | "pill" },
  ): HTMLElement {
    const wrap = document.createElement("div")
    wrap.className =
      opts.variant === "card" ? "catalog-card-langs" : "catalog-narrator-detail-langs"

    const { stack, other } = partitionLanguagesByStack(allLanguages, stackLanguages)
    const badgeClass =
      opts.variant === "card" ? "catalog-lang-badge" : "catalog-narrator-detail-lang-pill"

    // Small book — render everything directly. With ≤3 languages there's no
    // reason to summarize.
    if (allLanguages.length <= 3) {
      // Even small books benefit from stack-first ordering: a 3-lang book in
      // [English, Korean, Spanish] should put the user's primary first.
      const ordered = [...stack, ...other]
      for (const lang of ordered) {
        wrap.appendChild(makeLangBadge(lang, badgeClass, "stack-included"))
      }
      return wrap
    }

    // No stack overlap — show a single count chip.
    if (stack.length === 0) {
      const count = document.createElement("span")
      count.className = `${badgeClass} ${badgeClass}--count`
      count.textContent = tt(
        "catalog.languages.count",
        "{{count}} languages",
        { count: allLanguages.length },
      )
      wrap.appendChild(count)
      return wrap
    }

    // Stack-first: render every stack-matched language, then a "+N more"
    // chip for the non-stack remainder. The user's stack IS the set of
    // languages they care about — never hide any of those behind a count.
    for (const lang of stack) {
      wrap.appendChild(makeLangBadge(lang, badgeClass, "stack"))
    }
    if (other.length > 0) {
      const more = document.createElement("span")
      more.className = `${badgeClass} ${badgeClass}--more`
      more.textContent = tt(
        "catalog.languages.more",
        "+{{count}} more",
        { count: other.length },
      )
      wrap.appendChild(more)
    }
    return wrap
  }

  function makeLangBadge(
    lang: string,
    badgeClass: string,
    kind: "stack" | "stack-included" | "other",
  ): HTMLElement {
    const badge = document.createElement("span")
    const inStack = stackLanguages.includes(lang)
    const stackMod = inStack && kind !== "other" ? ` ${badgeClass}--stack` : ""
    const otherMod = !inStack && kind === "other" ? ` ${badgeClass}--other` : ""
    badge.className = `${badgeClass}${stackMod}${otherMod}`
    badge.textContent = getLanguageName(lang)
    return badge
  }

  function showInlineNarratorDetail(characterId: string): void {
    if (!catalogIndex) return
    if (!catalogIndex.getCharacter(characterId)) {
      console.warn(`[appShell] showInlineNarratorDetail: unknown character "${characterId}"`)
      return
    }
    detailMode = "narrator"
    detailNarratorId = characterId
    browseShowingDetail = true
    detailNarrations = []
    detailBookId = ""

    const detailScreen = drawer.getScreen("detail")
    if (!detailScreen) return
    browseSectionEl = detailScreen

    if (narratorDetailInstance) narratorDetailInstance.dispose()
    detailScreen.innerHTML = ""
    narratorDetailInstance = createNarratorDetail(detailScreen, {
      characterId,
      index: catalogIndex,
      onSelectBook: (bookId, _preferredVoiceId) => {
        const bookNarrations = allNarrations.filter((n) => n.bookId === bookId)
        if (bookNarrations.length === 0) return
        // _preferredVoiceId is reserved for a future enhancement: auto-pick
        // this narrator's voice in the book-detail language pills.
        showInlineBookDetail(bookNarrations)
      },
      onBack: () => exitDetailScreen(),
      t: tt,
      stackLanguages,
    })
    narratorDetailInstance.render()
    drawerStore.setState({ activeScreen: "detail" })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scroller = detailScreen.parentElement
        if (scroller) scroller.scrollTop = 0
      })
    })
  }

  function exitDetailScreen(): void {
    stopPreview()
    if (narratorDetailInstance) {
      narratorDetailInstance.dispose()
      narratorDetailInstance = null
    }
    browseShowingDetail = false
    detailMode = "book"
    detailNarrations = []
    detailBookId = ""
    detailNarratorId = ""
    const browseScreen = drawer.getScreen("browse")
    if (browseScreen) {
      const c = browseScreen.querySelector(".command-drawer-screen-content") as HTMLElement | null
      if (c) browseSectionEl = c
    }
    drawerStore.setState({ activeScreen: "browse" })
  }

  // ── Small DOM helpers reused by browse, narrator profile, book detail ──
  function cssUrl(raw: string): string {
    return `"${raw.replace(/"/g, '\\"')}"`
  }

  function initials(name: string): string {
    const parts = (name || "").trim().split(/\s+/).slice(0, 2)
    return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?"
  }

  // --- Inline book detail ---
  // Store current detail narrations so we can re-render on language switch
  let detailNarrations: CatalogNarrationEntry[] = []
  /**
   * If set, the book detail back button returns to the narrator profile for
   * this character instead of the browse list. Cleared whenever we leave the
   * book detail screen.
   */
  let bookDetailReturnToNarratorId: string | null = null
  /**
   * Whether the "More languages" section on the book detail page is
   * expanded. Resets to collapsed every time the user opens a new book —
   * the point is to keep the page short by default and let curious users
   * dig into the full list of N languages on demand.
   */
  let bookDetailMoreExpanded = false

  function showInlineBookDetail(narrations: CatalogNarrationEntry[]): void {
    if (narrations.length === 0) return
    bookDetailMoreExpanded = false
    if (detailMode === "narrator") {
      // Coming from narrator profile — remember to return to it on back.
      bookDetailReturnToNarratorId = detailNarratorId
      if (narratorDetailInstance) {
        narratorDetailInstance.dispose()
        narratorDetailInstance = null
      }
    } else {
      // Coming from anywhere else (browse, library, now-playing) — back goes
      // to the browse list, not to a stale narrator profile.
      bookDetailReturnToNarratorId = null
    }
    detailMode = "book"
    detailNarratorId = ""
    detailNarrations = narrations
    browseShowingDetail = true
    // Render into the detail screen and navigate to it
    const detailScreen = drawer.getScreen("detail")
    if (detailScreen) {
      browseSectionEl = detailScreen
    }
    renderBookDetail()
    drawerStore.setState({ activeScreen: "detail" })
    // Scroll the parent screen-container back to top — the user expects to
    // land at the start of the book detail, not at whatever offset they had
    // in the Browse list. Two RAFs so it runs after the screen becomes visible.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scroller = detailScreen?.parentElement
        if (scroller) scroller.scrollTop = 0
      })
    })
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
    browseSectionEl.innerHTML = ""

    const detail = document.createElement("div")
    detail.className = "command-drawer-detail"

    // Back button \u2014 when navigated here from a narrator profile, the back
    // button label and target are the narrator profile, not the browse list.
    const backBtn = document.createElement("button")
    backBtn.className = "command-drawer-detail-back"
    const backLabel = bookDetailReturnToNarratorId
      ? catalogIndex?.getCharacter(bookDetailReturnToNarratorId)?.displayName ??
        tt("catalog.detail.back", "Back")
      : tt("catalog.detail.back.browse", "Browse")
    backBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg> `
    backBtn.appendChild(document.createTextNode(backLabel))
    backBtn.addEventListener("click", () => {
      const returnTo = bookDetailReturnToNarratorId
      bookDetailReturnToNarratorId = null
      if (returnTo) {
        // Re-mount the narrator profile rather than dropping back to browse.
        showInlineNarratorDetail(returnTo)
        return
      }
      exitDetailScreen()
    })
    detail.appendChild(backBtn)

    const first = narrations[0]
    const bookEntry: BookEntry | undefined = catalogIndex?.getBook(first.bookId)
    const coverUrl = catalogIndex?.getCoverUrl(first.bookId, first) ?? ""

    // Hero: cover image + title/series/author/description, side-by-side.
    const hero = document.createElement("div")
    hero.className = "command-drawer-book-hero"

    const coverEl = document.createElement("div")
    if (coverUrl) {
      coverEl.className = "command-drawer-book-hero-cover"
      coverEl.style.backgroundImage = `url(${cssUrl(coverUrl)})`
    } else {
      coverEl.className =
        "command-drawer-book-hero-cover command-drawer-book-hero-cover--placeholder"
      coverEl.textContent = initials(first.bookTitle)
    }
    hero.appendChild(coverEl)

    const heroMeta = document.createElement("div")
    heroMeta.className = "command-drawer-book-hero-meta"

    const title = document.createElement("div")
    title.className = "command-drawer-book-hero-title"
    title.textContent = first.bookTitle
    heroMeta.appendChild(title)

    if (first.series) {
      const sub = document.createElement("div")
      sub.className = "command-drawer-book-hero-series"
      sub.textContent = first.series + (first.volume ? ` \u00B7 Vol. ${first.volume}` : "")
      heroMeta.appendChild(sub)
    }
    if (bookEntry?.author) {
      const author = document.createElement("div")
      author.className = "command-drawer-book-hero-author"
      author.textContent = tt("catalog.detail.byAuthor", "by {{author}}", {
        author: bookEntry.author,
      })
      heroMeta.appendChild(author)
    }

    // Narrator chip(s) — clickable, navigate to the narrator profile.
    const narratorChips = makeNarratorChipsForBook(narrations, "default")
    if (narratorChips) {
      const wrap = document.createElement("div")
      wrap.style.marginTop = "6px"
      wrap.appendChild(narratorChips)
      heroMeta.appendChild(wrap)
    }

    hero.appendChild(heroMeta)
    detail.appendChild(hero)

    if (bookEntry?.description) {
      const desc = document.createElement("div")
      desc.className = "command-drawer-book-hero-description"
      desc.textContent = bookEntry.description
      detail.appendChild(desc)
    }

    // Paid-book CTA — one offer above the rows instead of a Buy button per language.
    const bookProductId = getBookProductId(narrations)
    const bookIsPaid = narrations.some(n => n.purchase.type === "iap")
    const userOwnsBook = bookIsPaid && bookProductId
      ? ownsBookSync(bookProductId)
      : !bookIsPaid
    const isSubscriber = isSubscriberSync()
    const iapAvailable = iapAvailableSync()
    if (
      entitlementsLoaded() &&
      bookIsPaid &&
      bookProductId &&
      !userOwnsBook &&
      !isSubscriber &&
      iapAvailable
    ) {
      detail.appendChild(
        createBookCta(narrations, bookProductId, () => rebuildAll())
      )
    }

    // Installed narrations as tappable language rows (language picker).
    // Installed rows always render — small list, no need to collapse — but
    // we still sort stack-first so the user's primary languages appear at
    // the top of the picker.
    const installedNarrs = sortNarrationsByStack(
      narrations.filter(n => isInstalled(n.id)),
      stackLanguages,
    )
    const availableNarrs = narrations.filter(n => !isInstalled(n.id))

    // Split "available" into stack-matched vs everything else. With 50-language
    // books, this is the wedge that keeps the page from becoming a wall: the
    // user's stack languages render eagerly under "Your languages", and the
    // rest hide behind a "Show all N languages" expander.
    const stackSet = new Set(stackLanguages)
    const stackAvailable = sortNarrationsByStack(
      availableNarrs.filter(n => stackSet.has(n.language)),
      stackLanguages,
    )
    const otherAvailable = sortNarrationsByStack(
      availableNarrs.filter(n => !stackSet.has(n.language)),
      [], // pure alphabetical
    )
    const active = getActive()

    const detailHandlers: RowHandlers = {
      activeId: active,
      onSwitch: (narr) => {
        if (narr.id === getActive()) return
        switchToNarration(narr.id)
        drawerStore.setState({ activeScreen: "now-playing" })
      },
      onDeleted: () => {
        detailBookId = ""
        nowPlayingBookId = ""
        renderBookDetail()
        refreshLibrarySection()
        refreshNowPlayingSection()
      },
      onInstalled: () => rebuildAll(),
    }

    for (const narr of installedNarrs) {
      detail.appendChild(createCompactRow(narr, detailHandlers))
    }

    // "Your languages" header — only when the user actually has stack
    // matches that aren't already installed. If no stack langs match (or
    // they're all installed already), skip the header entirely and label
    // the next section neutrally.
    if (stackAvailable.length > 0) {
      const sTitle = document.createElement("div")
      sTitle.className = "catalog-detail-section-title catalog-detail-section-title--stack"
      sTitle.textContent = tt("catalog.detail.yourLanguages", "Your languages")
      sTitle.style.marginTop = "16px"
      detail.appendChild(sTitle)
      for (const narr of stackAvailable) {
        detail.appendChild(createCompactRow(narr, detailHandlers))
      }
    }

    if (otherAvailable.length > 0) {
      const sTitle = document.createElement("div")
      sTitle.className = "catalog-detail-section-title"
      sTitle.style.marginTop = "16px"

      // Label depends on what came before — if we already showed stack
      // matches, this section is "more"; if we didn't, it's just the
      // narrations list.
      const haveStackContext = stackAvailable.length > 0 || installedNarrs.some(n => stackSet.has(n.language))
      sTitle.textContent = haveStackContext
        ? tt("catalog.detail.moreLanguages", "More languages")
        : (installedNarrs.length > 0
            ? tt("catalog.detail.moreNarrations", "More narrations")
            : tt("catalog.detail.narrations", "Narrations"))
      detail.appendChild(sTitle)

      // Collapse threshold: when the user has a meaningful stack subset to
      // anchor on AND the "other" list is long, hide it behind an expander.
      // Without a stack anchor, leave everything visible — collapsing the
      // entire list provides no benefit there.
      const shouldCollapse =
        haveStackContext && otherAvailable.length > 8 && !bookDetailMoreExpanded

      if (shouldCollapse) {
        const expand = document.createElement("button")
        expand.type = "button"
        expand.className = "catalog-detail-expand-btn"
        expand.textContent = tt(
          "catalog.detail.showAll",
          "Show all {{count}} languages",
          { count: otherAvailable.length },
        )
        expand.onclick = () => {
          bookDetailMoreExpanded = true
          detailBookId = "" // force full rebuild so the rows render
          renderBookDetail()
        }
        detail.appendChild(expand)
      } else {
        for (const narr of otherAvailable) {
          detail.appendChild(createCompactRow(narr, detailHandlers))
        }
      }
    }

    browseSectionEl.appendChild(detail)
  }

  // SVG glyphs shared by compact row buttons
  const SVG_DOWNLOAD = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2"/></svg>`
  const SVG_RETRY = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 105.64-11.36L3 10"/></svg>`
  const SVG_SPINNER = `<svg class="catalog-btn-icon catalog-btn-spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="50 20" stroke-linecap="round"/></svg>`

  function rebuildAll(): void {
    nowPlayingBookId = ""
    detailBookId = ""
    if (browseShowingDetail) renderBookDetail()
    else refreshBrowseSection()
    refreshLibrarySection()
    refreshNowPlayingSection()
  }

  // --- Unified compact narration row ------------------------------------
  // One renderer for all row states: installed-active, installed-idle,
  // available-free, available-paid-not-entitled, available-paid-entitled.
  // Layout:
  //   ┌─────────────────────────────────────────────────────────┐
  //   │ [•] Language · voice · v1.2.3 · 20MB        [action][⋯] │
  //   └─────────────────────────────────────────────────────────┘
  // Second line only appears for price or update chip.

  const SVG_DELETE = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`
  const SVG_MORE = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>`

  type RowHandlers = {
    /** Active narration id, to render the active-state accent. */
    activeId: string
    /** User tapped an installed row (switch to this narration). */
    onSwitch: (narration: CatalogNarrationEntry) => void
    /** User deleted an installed narration. */
    onDeleted: () => void
    /** User completed a fresh install (download or post-purchase). The
     *  freshly-installed narration is passed so callers can select it. */
    onInstalled: (narration: CatalogNarrationEntry) => void
  }

  function formatMetaLine(
    narration: CatalogNarrationEntry,
    installedVersion: string | null
  ): string {
    // Prefer the variant displayName ("Calm") from the hydrated voice profile;
    // fall back to legacy voiceName ("Ian") when the catalog hasn't published
    // the new fields yet.
    const variant = catalogIndex?.getVoiceProfileForNarration(narration)?.displayName
    const parts: string[] = [variant || narration.voiceName]
    if (installedVersion) {
      if (hasUpdate(narration.version, installedVersion)) {
        parts.push(`v${installedVersion} \u2192 v${narration.version}`)
      } else {
        parts.push(`v${installedVersion}`)
      }
    } else {
      parts.push(`v${narration.version}`)
    }
    // For an un-installed two-ZIP entry, show the size the user will actually
    // pull (preview for non-subscribers) and tag it so a long book's small
    // preview can't read as the whole thing.
    if (installedVersion) {
      if (narration.sizeMb) parts.push(`${Math.round(narration.sizeMb)} MB`)
    } else {
      const dl = effectiveDownload(narration)
      if (dl.sizeMb) parts.push(`${Math.round(dl.sizeMb)} MB`)
      if (dl.isPreview) parts.push("Free preview")
    }
    return parts.join(" \u00B7 ")
  }

  function createCompactRow(
    narration: CatalogNarrationEntry,
    handlers: RowHandlers
  ): HTMLElement {
    const installedInfo = getInstalled(narration.id)
    const isActive = narration.id === handlers.activeId
    const iap = narration.purchase.type === "iap"
    const entitled = isEntitledToNarrationSync(narration)
    const iapAvailable = iapAvailableSync()
    const isSubscriber = isSubscriberSync()
    const locked = iap && !entitled && !isSubscriber

    const row = document.createElement("div")
    row.className = "catalog-row"
    row.dataset.narrationId = narration.id
    if (installedInfo) row.classList.add("catalog-row--installed")
    if (isActive) row.classList.add("catalog-row--active")
    if (locked) row.classList.add("catalog-row--locked")

    // Leading rail: active dot or subscription "Included" hint
    const rail = document.createElement("div")
    rail.className = "catalog-row-rail"
    if (isActive) rail.classList.add("catalog-row-rail--active")
    row.appendChild(rail)

    // Info column — single line for language, sub line for voice/version/size
    const info = document.createElement("div")
    info.className = "catalog-row-info"

    const lang = document.createElement("div")
    lang.className = "catalog-row-lang"
    lang.textContent = getLanguageName(narration.language)
    info.appendChild(lang)

    const meta = document.createElement("div")
    meta.className = "catalog-row-meta"
    const hasUpdateAvailable = installedInfo
      ? hasUpdate(narration.version, installedInfo.version)
      : false
    if (hasUpdateAvailable) meta.classList.add("catalog-row-meta--update")
    meta.textContent = formatMetaLine(narration, installedInfo?.version ?? null)
    info.appendChild(meta)

    row.appendChild(info)

    // Trailing action area
    const actions = document.createElement("div")
    actions.className = "catalog-row-actions"
    row.appendChild(actions)

    // Tag chip — only "Included" for subscribers; locked rows get the lock glyph below.
    if (iap && !installedInfo && isSubscriber && entitled) {
      const chip = document.createElement("span")
      chip.className = "catalog-chip catalog-chip--included"
      chip.textContent = "Included"
      actions.appendChild(chip)
    }

    // --- Installed row: clickable to switch, overflow menu with delete ---
    if (installedInfo) {
      row.style.cursor = "pointer"
      row.addEventListener("click", () => handlers.onSwitch(narration))

      // Update button gated on entitlement. Without this gate, a user
      // whose subscription expired sees an Update button on a narration
      // they already have — taps it, backend rejects the receipt, they
      // get a confusing "Backend rejected this receipt" error on
      // content they already own. Locked + installed rows keep their
      // existing download (still playable offline) but the update
      // prompt turns into a lock glyph until the user re-entitles.
      if (hasUpdateAvailable && entitled) {
        actions.appendChild(createCompactUpdateButton(narration, handlers))
      } else if (hasUpdateAvailable && locked && iapAvailable) {
        const lock = document.createElement("span")
        lock.className = "catalog-row-lock"
        lock.setAttribute(
          "aria-label",
          "Update locked — unlock via the offer above"
        )
        lock.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`
        actions.appendChild(lock)
      }

      const more = document.createElement("button")
      more.className = "catalog-row-more"
      more.type = "button"
      more.title = "More"
      more.setAttribute("aria-label", "More options")
      more.innerHTML = SVG_MORE
      more.addEventListener("click", (e) => {
        e.stopPropagation()
        openRowOverflow(more, narration, handlers)
      })
      actions.appendChild(more)
      return row
    }

    // --- Available row: download, or locked glyph when the book is paid ---
    if (!isTauriAvailable()) {
      const disabled = document.createElement("span")
      disabled.className = "catalog-chip catalog-chip--muted"
      disabled.textContent = "Mobile only"
      actions.appendChild(disabled)
      return row
    }

    if (locked) {
      // Book-level purchase is handled by the CTA at the top of the detail
      // screen — individual rows stay calm and informational.
      if (!iapAvailable) {
        const disabled = document.createElement("span")
        disabled.className = "catalog-chip catalog-chip--muted"
        disabled.textContent = "Unavailable"
        actions.appendChild(disabled)
        return row
      }
      const lock = document.createElement("span")
      lock.className = "catalog-row-lock"
      lock.setAttribute("aria-label", "Locked — unlock via the offer above")
      lock.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`
      actions.appendChild(lock)
      return row
    }

    // Free, or already entitled (purchased or subscribed) — download
    actions.appendChild(createCompactDownloadButton(narration, handlers))
    return row
  }

  // Run an install attempt with active-download tracking. On success, triggers
  // handlers.onInstalled() (which rebuilds rows). On failure, wires up a retry
  // on the same button. Either way, activeDownloads gets cleaned up in finally.
  async function runCompactInstall(
    narration: CatalogNarrationEntry,
    btn: HTMLButtonElement,
    handlers: RowHandlers,
    label: string
  ): Promise<void> {
    if (activeDownloads.has(narration.id)) return
    activeDownloads.add(narration.id)
    setButtonBusy(btn)
    try {
      const result = await installNarration(narration)
      if (result.ok) {
        handlers.onInstalled(narration)
      } else {
        reportInstallFailure(result)
        setButtonError(btn, label, () => runCompactInstall(narration, btn, handlers, label))
      }
    } finally {
      activeDownloads.delete(narration.id)
    }
  }

  function createCompactDownloadButton(
    narration: CatalogNarrationEntry,
    handlers: RowHandlers
  ): HTMLButtonElement {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "catalog-btn catalog-btn--compact"
    const label = `${Math.round(effectiveDownload(narration).sizeMb)} MB`
    btn.innerHTML = `${SVG_DOWNLOAD}<span class="catalog-btn-label">${label}</span>`
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      void runCompactInstall(narration, btn, handlers, label)
    })
    // Row was (re)created mid-download (e.g. a sibling download completed and
    // triggered rebuildAll). Restore the spinner so the user sees this download
    // is still in flight.
    if (activeDownloads.has(narration.id)) {
      setButtonBusy(btn)
    }
    return btn
  }

  function createCompactUpdateButton(
    narration: CatalogNarrationEntry,
    handlers: RowHandlers
  ): HTMLButtonElement {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "catalog-btn catalog-btn--compact catalog-btn--update"
    btn.title = "Update"
    btn.innerHTML = `${SVG_DOWNLOAD}<span class="catalog-btn-label">Update</span>`
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      void runCompactInstall(narration, btn, handlers, "Update")
    })
    if (activeDownloads.has(narration.id)) {
      setButtonBusy(btn)
    }
    return btn
  }

  function setButtonBusy(btn: HTMLButtonElement): void {
    btn.classList.add("catalog-btn--downloading")
    btn.classList.remove("catalog-btn--error")
    btn.innerHTML = SVG_SPINNER
    btn.style.pointerEvents = "none"
  }

  function setButtonError(
    btn: HTMLButtonElement,
    label: string,
    onRetry: () => void | Promise<void>
  ): void {
    btn.classList.remove("catalog-btn--downloading")
    btn.classList.add("catalog-btn--error")
    btn.innerHTML = `${SVG_RETRY}<span class="catalog-btn-label">${label}</span>`
    btn.style.pointerEvents = ""
    btn.onclick = async (e) => {
      e.stopPropagation()
      await onRetry()
    }
  }

  // --- Book-level paid CTA ------------------------------------------------
  // When the user opens a paid book they don't own yet, we show ONE offer at
  // the top: buy-the-book ($4.99, unlocks every language) or subscribe
  // (monthly/annual, unlocks everything). The individual rows below stay
  // informational with a lock glyph — no 23 Buy buttons.

  function getBookProductId(narrs: CatalogNarrationEntry[]): string | null {
    for (const n of narrs) {
      if (n.purchase.type === "iap" && n.purchase.productId) return n.purchase.productId
    }
    return null
  }


  /**
   * Book paywall as a strict three-state component: loading skeleton →
   * ready (real prices from the platform) → error block. No fallback
   * prices, no "try again" button suffixes, no half-loaded buttons.
   *
   * Restore Purchases is always visible at the bottom of the card —
   * Apple's 2025-2026 review guidance places it here, on the paywall.
   */
  function createBookCta(
    narrations: CatalogNarrationEntry[],
    bookProductId: string,
    onUnlocked: () => void
  ): HTMLElement {
    const langCount = new Set(narrations.map(n => n.language)).size

    const cta = document.createElement("div")
    cta.className = "catalog-cta"

    const eyebrow = document.createElement("div")
    eyebrow.className = "catalog-cta-eyebrow"
    eyebrow.textContent =
      langCount > 1
        ? tt("catalogPaywall.allLanguages", "All {{count}} languages", { count: langCount })
        : tt("catalogPaywall.thisBook", "This book")
    cta.appendChild(eyebrow)

    const blurb = document.createElement("div")
    blurb.className = "catalog-cta-blurb"
    blurb.textContent =
      langCount > 1
        ? tt(
            "catalogPaywall.blurbAll",
            "Every narration, now and future. Yours forever."
          )
        : tt("catalogPaywall.blurbOne", "Yours forever.")
    cta.appendChild(blurb)

    const body = document.createElement("div")
    body.className = "catalog-cta-body"
    cta.appendChild(body)

    const restoreLink = document.createElement("button")
    restoreLink.type = "button"
    restoreLink.className = "catalog-cta-restore"
    restoreLink.textContent = tt("restore.button", "Restore Purchases")
    restoreLink.addEventListener("click", (e) => {
      e.stopPropagation()
      requestRestorePurchases()
    })
    cta.appendChild(restoreLink)

    type CtaState =
      | { kind: "loading" }
      | { kind: "ready"; bookProduct: StoreProduct | null; subProducts: StoreProduct[] }
      | { kind: "error"; error: string }
      | { kind: "pending" }

    let state: CtaState = { kind: "loading" }

    function renderBody(): void {
      body.innerHTML = ""

      if (state.kind === "loading") {
        for (let i = 0; i < 3; i++) {
          const sk = document.createElement("div")
          sk.className = "catalog-cta-skeleton"
          body.appendChild(sk)
        }
        return
      }

      if (state.kind === "error") {
        const heading = document.createElement("div")
        heading.className = "catalog-cta-error-heading"
        heading.textContent = tt(
          "catalogPaywall.errorHeading",
          "We couldn't load the App Store right now."
        )
        body.appendChild(heading)

        const detail = document.createElement("div")
        detail.className = "catalog-cta-error-detail"
        detail.textContent = state.error
        body.appendChild(detail)

        const retryBtn = document.createElement("button")
        retryBtn.type = "button"
        retryBtn.className = "catalog-cta-retry"
        retryBtn.textContent = tt("catalogPaywall.tryAgain", "Try again")
        retryBtn.addEventListener("click", (e) => {
          e.stopPropagation()
          void runFetch()
        })
        body.appendChild(retryBtn)
        return
      }

      if (state.kind === "pending") {
        const ph = document.createElement("div")
        ph.className = "catalog-cta-pending-heading"
        ph.textContent = tt("catalogPaywall.pendingHeading", "Waiting for approval")
        body.appendChild(ph)

        const pd = document.createElement("div")
        pd.className = "catalog-cta-pending-detail"
        pd.textContent = tt(
          "catalogPaywall.pendingDetail",
          "Your purchase is awaiting approval (Ask to Buy or bank verification). It will activate automatically once approved."
        )
        body.appendChild(pd)
        return
      }

      // Ready
      if (state.bookProduct) {
        const buyBtn = document.createElement("button")
        buyBtn.type = "button"
        buyBtn.className = "catalog-cta-primary"
        const buyLabel = tt("catalogPaywall.buyWithPrice", "Buy — {{price}}", {
          price: state.bookProduct.price,
        })
        buyBtn.innerHTML = `<span class="catalog-cta-primary-label">${buyLabel}</span>`
        buyBtn.addEventListener("click", async (e) => {
          e.stopPropagation()
          buyBtn.classList.add("catalog-cta--busy")
          buyBtn.style.pointerEvents = "none"
          const outcome = await purchaseBookProduct(bookProductId)
          handleOutcome(outcome)
        })
        body.appendChild(buyBtn)
      }

      if (state.subProducts.length > 0) {
        const or = document.createElement("div")
        or.className = "catalog-cta-or"
        const orLabel = tt("catalogPaywall.orUnlockEverything", "or unlock everything")
        or.innerHTML = `<span>${orLabel}</span>`
        body.appendChild(or)

        const subsRow = document.createElement("div")
        subsRow.className = "catalog-cta-subs"

        const monthly = state.subProducts.find(p => p.productId === SUBSCRIPTION_MONTHLY_ID)
        const annual = state.subProducts.find(p => p.productId === SUBSCRIPTION_ANNUAL_ID)

        if (monthly) {
          subsRow.appendChild(
            buildSubscribeBtn(
              SUBSCRIPTION_MONTHLY_ID,
              tt("catalogPaywall.subMonthly", "Monthly"),
              monthly.price,
              tt("catalogPaywall.subMonthlyPeriod", "per month")
            )
          )
        }
        if (annual) {
          const btn = buildSubscribeBtn(
            SUBSCRIPTION_ANNUAL_ID,
            tt("catalogPaywall.subYearly", "Yearly"),
            annual.price,
            tt("catalogPaywall.subYearlyPeriod", "per year · best value")
          )
          btn.classList.add("catalog-cta-sub--highlight")
          subsRow.appendChild(btn)
        }

        body.appendChild(subsRow)

        // Required by Apple when subscription buttons are shown:
        // auto-renew disclosure + Terms of Use + Privacy Policy.
        const autoRenew = document.createElement("div")
        autoRenew.className = "catalog-cta-auto-renew"
        autoRenew.textContent = tt(
          "subscription.autoRenewNotice",
          "Subscriptions renew automatically. Cancel anytime in your {{store}} account.",
          { store: tt("subscription.storeApple", "Apple ID") }
        )
        body.appendChild(autoRenew)

        const legal = document.createElement("div")
        legal.className = "catalog-cta-legal"
        const terms = document.createElement("a")
        terms.textContent = tt("subscription.termsOfUse", "Terms of Use")
        terms.href = "https://encorpora.io/terms"
        terms.target = "_blank"
        terms.rel = "noopener noreferrer"
        const privacy = document.createElement("a")
        privacy.textContent = tt("subscription.privacyPolicy", "Privacy Policy")
        privacy.href = "https://encorpora.io/privacy"
        privacy.target = "_blank"
        privacy.rel = "noopener noreferrer"
        const sep = document.createElement("span")
        sep.textContent = " · "
        sep.className = "catalog-cta-legal-sep"
        legal.appendChild(terms)
        legal.appendChild(sep)
        legal.appendChild(privacy)
        body.appendChild(legal)
      }
    }

    function buildSubscribeBtn(
      productId: string,
      label: string,
      price: string,
      period: string
    ): HTMLButtonElement {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "catalog-cta-sub"
      btn.innerHTML = `
        <span class="catalog-cta-sub-label">${label}</span>
        <span class="catalog-cta-sub-price">${price}</span>
        <span class="catalog-cta-sub-period">${period}</span>
      `
      btn.addEventListener("click", async (e) => {
        e.stopPropagation()
        btn.classList.add("catalog-cta--busy")
        btn.style.pointerEvents = "none"
        const outcome = await purchaseSubscriptionProduct(productId)
        handleOutcome(outcome)
      })
      return btn
    }

    function handleOutcome(outcome: PurchaseOutcome): void {
      if (outcome.kind === "ok" || outcome.kind === "alreadyOwned") {
        onUnlocked()
        return
      }
      if (outcome.kind === "cancelled") {
        renderBody()
        return
      }
      if (outcome.kind === "pending") {
        state = { kind: "pending" }
        renderBody()
        return
      }
      state = { kind: "error", error: `${outcome.code}: ${outcome.message}` }
      renderBody()
    }

    async function runFetch(): Promise<void> {
      state = { kind: "loading" }
      renderBody()

      const [bookFetch, subsFetch] = await Promise.all([
        fetchStoreProducts([bookProductId], "inapp"),
        fetchStoreProducts([SUBSCRIPTION_MONTHLY_ID, SUBSCRIPTION_ANNUAL_ID], "subs"),
      ])

      if (!bookFetch.ok && !subsFetch.ok) {
        state = { kind: "error", error: bookFetch.error }
        renderBody()
        return
      }
      const bookProduct = bookFetch.ok
        ? bookFetch.products.find(p => p.productId === bookProductId) ?? null
        : null
      const subProducts = subsFetch.ok ? subsFetch.products : []

      // If both calls succeeded but the catalog returned nothing useful,
      // we'd render a paywall body with just the eyebrow + Restore link
      // and no purchase CTA. Treat that as a soft error instead so the
      // user (and reviewer) sees a clear retry path.
      if (!bookProduct && subProducts.length === 0) {
        state = {
          kind: "error",
          error: tt(
            "catalogPaywall.noProductsError",
            "App Store didn't return any products. This usually clears in a few seconds — please try again."
          ),
        }
        renderBody()
        return
      }

      state = { kind: "ready", bookProduct, subProducts }
      renderBody()
    }

    void runFetch()
    return cta
  }


  /** Inline overflow menu for installed rows — currently just Delete. */
  function openRowOverflow(
    anchor: HTMLElement,
    narration: CatalogNarrationEntry,
    handlers: RowHandlers
  ): void {
    // Close any existing menu
    document.querySelectorAll(".catalog-row-menu").forEach((el) => el.remove())

    const menu = document.createElement("div")
    menu.className = "catalog-row-menu"

    const del = document.createElement("button")
    del.type = "button"
    del.className = "catalog-row-menu-item catalog-row-menu-item--danger"
    del.innerHTML = `${SVG_DELETE}<span>Delete</span>`
    del.addEventListener("click", async (e) => {
      e.stopPropagation()
      menu.remove()
      const wasActive = narration.id === getActive()
      await deleteNarration(narration.id)
      if (wasActive) {
        const remaining = listInstalled()
        if (remaining.length > 0) {
          switchToNarration(remaining[0].narrationId)
        } else {
          switching = true
          drawerStore.setState({
            currentNarrationId: "",
            currentLanguage: "",
            languages: [],
            nowPlaying: { bookTitle: "" },
          })
          switching = false
          if (readerInstance) {
            readerInstance.dispose()
            readerInstance = null
          }
        }
      }
      handlers.onDeleted()
    })
    menu.appendChild(del)

    const rect = anchor.getBoundingClientRect()
    menu.style.position = "fixed"
    menu.style.top = `${Math.round(rect.bottom + 6)}px`
    menu.style.right = `${Math.round(window.innerWidth - rect.right)}px`
    document.body.appendChild(menu)

    const onDocClick = (evt: MouseEvent) => {
      if (!menu.contains(evt.target as Node)) {
        menu.remove()
        document.removeEventListener("click", onDocClick, true)
      }
    }
    // Defer a tick so the click that opened the menu doesn't immediately close it
    setTimeout(() => document.addEventListener("click", onDocClick, true), 0)
  }

  // --- Language chooser (bottom-sheet modal, scales to many languages) ---
  function openLanguageChooser(
    availableLangs: string[],
    selected: string,
    onChoose: (lang: string) => void
  ): void {
    const scrim = document.createElement("div")
    scrim.className = "catalog-sheet-scrim"

    const sheet = document.createElement("div")
    sheet.className = "catalog-sheet"

    const header = document.createElement("div")
    header.className = "catalog-sheet-header"
    const title = document.createElement("div")
    title.className = "catalog-sheet-title"
    title.textContent = "Language"
    header.appendChild(title)
    const close = document.createElement("button")
    close.type = "button"
    close.className = "catalog-sheet-close"
    close.setAttribute("aria-label", "Close")
    close.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    close.addEventListener("click", () => dismiss())
    header.appendChild(close)
    sheet.appendChild(header)

    const search = document.createElement("input")
    search.type = "text"
    search.placeholder = "Search languages"
    search.className = "catalog-sheet-search"
    sheet.appendChild(search)

    const list = document.createElement("div")
    list.className = "catalog-sheet-list"
    sheet.appendChild(list)

    function renderList(): void {
      list.innerHTML = ""
      const q = search.value.trim().toLowerCase()

      const addItem = (code: string, label: string) => {
        const item = document.createElement("button")
        item.type = "button"
        item.className = "catalog-sheet-item"
        if (code === selected) item.classList.add("catalog-sheet-item--active")
        const name = document.createElement("span")
        name.textContent = label
        item.appendChild(name)
        if (code === selected) {
          const check = document.createElement("span")
          check.className = "catalog-sheet-item-check"
          check.textContent = "\u2713"
          item.appendChild(check)
        }
        item.addEventListener("click", () => {
          onChoose(code)
          dismiss()
        })
        list.appendChild(item)
      }

      if (!q || "all languages".includes(q)) {
        addItem("", "All Languages")
      }

      for (const code of availableLangs) {
        const name = getLanguageName(code)
        if (!q || name.toLowerCase().includes(q) || code.toLowerCase().includes(q)) {
          addItem(code, name)
        }
      }

      if (list.childElementCount === 0) {
        const empty = document.createElement("div")
        empty.className = "catalog-sheet-empty"
        empty.textContent = "No languages match"
        list.appendChild(empty)
      }
    }

    search.addEventListener("input", renderList)

    const dismiss = () => {
      scrim.classList.remove("catalog-sheet-scrim--open")
      sheet.classList.remove("catalog-sheet--open")
      setTimeout(() => {
        scrim.remove()
        sheet.remove()
      }, 180)
    }

    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) dismiss()
    })

    document.body.appendChild(scrim)
    document.body.appendChild(sheet)
    renderList()
    // Trigger enter animation on next frame
    requestAnimationFrame(() => {
      scrim.classList.add("catalog-sheet-scrim--open")
      sheet.classList.add("catalog-sheet--open")
    })
    // Autofocus search for quick filtering on desktop; on mobile this
    // opens the keyboard which is fine given 30+ languages.
    setTimeout(() => search.focus(), 50)
  }

  // --- Privacy section: anonymous analytics opt-out ---
  function renderPrivacySection(container: HTMLElement): void {
    container.innerHTML = ""

    const blurb = document.createElement("div")
    blurb.className = "command-drawer-privacy-blurb"
    blurb.textContent =
      "When you open a book we send an anonymous event: book and language, how long you stayed, plus app version, platform, locale, and country. No accounts, no IPs, no device IDs, no advertising trackers. Toggle off any time."
    container.appendChild(blurb)

    const row = document.createElement("label")
    row.className = "command-drawer-privacy-row"

    const text = document.createElement("span")
    text.textContent = "Anonymous usage analytics"
    row.appendChild(text)

    const toggle = document.createElement("input")
    toggle.type = "checkbox"
    toggle.checked = !analytics.getOptOut()
    toggle.addEventListener("change", () => {
      analytics.setOptOut(!toggle.checked)
    })
    row.appendChild(toggle)

    container.appendChild(row)
  }

  // --- Dispose ---
  function dispose(): void {
    if (disposed) return
    disposed = true
    analytics.bookClosed()
    storeUnsub()
    narrUnsub()
    persistUnsub()
    librarySwitcherUnsub()
    stackUnsub?.()
    entitlementListeners.delete(entitlementChanged)
    document.removeEventListener("visibilitychange", onVisibilityChange)
    window.removeEventListener("corpan:purchase-recorded", onPurchaseEvent)
    window.removeEventListener("corpan:subscription-recorded", onPurchaseEvent)
    window.removeEventListener("corpan:restore-purchases-completed", onPurchaseEvent)
    window.removeEventListener("corpan:book-finished", onBookFinished)
    dismissEndOfBookSuggestion()
    window.removeEventListener(ENTITLEMENTS_CHANGED_EVENT, onEntitlementsChanged)
    window.removeEventListener(NARRATION_UPGRADED_EVENT, onNarrationUpgraded)
    setUpgradeCatalogProvider(null)
    if (narratorDetailInstance) {
      narratorDetailInstance.dispose()
      narratorDetailInstance = null
    }
    stopPreview()
    compactSwitcher.dispose()
    drawer.dispose()
    readerInstance?.dispose()
  }

  return {
    dispose,
    getDrawer: () => drawer,
  }
}
