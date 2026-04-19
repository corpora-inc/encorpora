/**
 * Narration switcher — horizontal scrollable pill strip with sticky overflow.
 *
 * Two placements share this component:
 *  - On the reader surface (top-left, mirror of the drawer trigger), `mode: "compact"`.
 *  - Inside the drawer header (replacing the wrapping pill grid), `mode: "drawer"`.
 *
 * Behavior:
 *  - Renders pills for narrations of the CURRENT BOOK only.
 *  - Order: active narration first, then other recent narrations of this book by
 *    most-recent-use, then any remaining installed narrations of this book.
 *  - 1-tap on an inactive pill switches narrations.
 *  - The "⋯" pill stays sticky on the right and opens a bottom sheet showing
 *    all installed languages of this book at the top, plus all not-yet-installed
 *    languages from the catalog below (with a tap-to-install affordance).
 *
 * Scales gracefully to 50+ languages: long names truncate; the strip scrolls
 * horizontally; the sheet is the discovery surface for the long tail.
 */

import type { CatalogNarrationEntry, InstalledNarration } from "../catalog/src/types"
import { getRecentNarrations } from "../state/narrationHistoryStore"

const SVG_MORE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>`
const SVG_DOWNLOAD = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2"/></svg>`
const SVG_LOCK = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`
const SVG_SPINNER = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="40 20"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>`
const SVG_CLOSE = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`

export type NarrationSwitcherMode = "compact" | "drawer"

export type NarrationSwitcherOptions = {
  mode: NarrationSwitcherMode
  /** Current active narration ID (or "" if none). */
  getActiveId: () => string
  /** Current active book ID (used to filter narrations). "" hides the widget. */
  getActiveBookId: () => string
  /** All installed narrations (any book). */
  getInstalled: () => InstalledNarration[]
  /** Full catalog of narrations (any book). May be empty before catalog loads. */
  getCatalog: () => CatalogNarrationEntry[]
  /** True if IAP is available on this platform (for showing/hiding lock vs install). */
  isIapAvailable: () => boolean
  /** True if user has an active subscription (unlocks all). */
  isSubscriber: () => boolean
  /** True if the user owns the given book (per its product ID). */
  ownsBook: (bookProductId: string) => boolean
  /** Localized native language name for a code (uses LANG_NAMES). */
  getLanguageName: (code: string) => string
  /** Switch to an installed narration. */
  onSwitch: (narrationId: string) => void
  /** Install a not-yet-installed narration, then switch to it on completion. */
  onInstallAndSwitch: (entry: CatalogNarrationEntry) => Promise<boolean>
}

export type NarrationSwitcher = {
  element: HTMLElement
  refresh: () => void
  dispose: () => void
}

export function createNarrationSwitcher(opts: NarrationSwitcherOptions): NarrationSwitcher {
  const root = document.createElement("div")
  root.className = `narration-switcher narration-switcher--${opts.mode}`
  root.setAttribute("dir", "ltr")

  const strip = document.createElement("div")
  strip.className = "narration-switcher-strip"
  root.appendChild(strip)

  const moreBtn = document.createElement("button")
  moreBtn.type = "button"
  moreBtn.className = "narration-switcher-more"
  moreBtn.setAttribute("aria-label", "All languages")
  moreBtn.innerHTML = SVG_MORE
  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation()
    openSheet()
  })
  root.appendChild(moreBtn)

  // ---- Pill builders ----

  function pillLabel(narr: { language: string; voiceName?: string }, multiVoiceForLang: boolean): string {
    const name = opts.getLanguageName(narr.language) || narr.language.toUpperCase()
    if (multiVoiceForLang && narr.voiceName) {
      // Suffix the voice initial so two pills for the same language are distinguishable.
      return `${name} \u00B7 ${narr.voiceName.charAt(0)}`
    }
    return name
  }

  function makePill(
    narrationId: string,
    label: string,
    isActive: boolean
  ): HTMLButtonElement {
    const pill = document.createElement("button")
    pill.type = "button"
    pill.className = "narration-switcher-pill"
    if (isActive) pill.classList.add("narration-switcher-pill--active")
    pill.dataset.narrationId = narrationId
    pill.title = label
    const span = document.createElement("span")
    span.className = "narration-switcher-pill-label"
    span.textContent = label
    pill.appendChild(span)
    pill.addEventListener("click", (e) => {
      e.stopPropagation()
      if (narrationId === opts.getActiveId()) return
      opts.onSwitch(narrationId)
    })
    return pill
  }

  // ---- Render ----

  function refresh(): void {
    const activeBookId = opts.getActiveBookId()
    const activeId = opts.getActiveId()
    const installed = opts.getInstalled()
    const bookInstalled = installed.filter((n) => n.bookId === activeBookId)

    if (!activeBookId || bookInstalled.length === 0) {
      // Nothing to switch between — hide the whole strip.
      // Keep the "more" button visible only if the catalog has alternatives to install.
      const catalog = opts.getCatalog()
      const bookCatalog = catalog.filter((n) => n.bookId === activeBookId)
      strip.innerHTML = ""
      root.style.display = bookCatalog.length > 1 ? "" : "none"
      return
    }
    root.style.display = ""

    // Order: active first, then by most-recent-use, then any remaining.
    const recent = getRecentNarrations()
    const recentSet = new Set(recent)
    const installedById = new Map(bookInstalled.map((n) => [n.narrationId, n]))
    const ordered: InstalledNarration[] = []
    if (activeId && installedById.has(activeId)) {
      ordered.push(installedById.get(activeId)!)
      installedById.delete(activeId)
    }
    for (const id of recent) {
      if (installedById.has(id)) {
        ordered.push(installedById.get(id)!)
        installedById.delete(id)
      }
    }
    for (const n of installedById.values()) {
      if (!recentSet.has(n.narrationId)) ordered.push(n)
    }

    // Detect languages with multiple installed voices for disambiguation.
    const langCounts = new Map<string, number>()
    for (const n of bookInstalled) {
      langCounts.set(n.language, (langCounts.get(n.language) ?? 0) + 1)
    }

    strip.innerHTML = ""
    let activePill: HTMLButtonElement | null = null
    for (const n of ordered) {
      const multi = (langCounts.get(n.language) ?? 0) > 1
      const label = pillLabel(n, multi)
      const pill = makePill(n.narrationId, label, n.narrationId === activeId)
      strip.appendChild(pill)
      if (n.narrationId === activeId) activePill = pill
    }

    // Bring the active pill into view so it's always visible after a switch
    // even when the strip overflows (50+ langs scenario).
    if (activePill) {
      requestAnimationFrame(() => {
        activePill?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
      })
    }

    // The "more" button is always rendered; it lets the user reach not-installed languages.
  }

  // ---- Bottom sheet ("more" action) ----

  let sheetEl: HTMLElement | null = null
  let scrimEl: HTMLElement | null = null
  let sheetCloseTimer: ReturnType<typeof setTimeout> | null = null

  function openSheet(): void {
    if (sheetEl) return
    const activeBookId = opts.getActiveBookId()
    if (!activeBookId) return

    scrimEl = document.createElement("div")
    scrimEl.className = "catalog-sheet-scrim"
    scrimEl.addEventListener("click", (e) => {
      if (e.target === scrimEl) closeSheet()
    })

    sheetEl = document.createElement("div")
    sheetEl.className = "catalog-sheet"

    const header = document.createElement("div")
    header.className = "catalog-sheet-header"
    const title = document.createElement("div")
    title.className = "catalog-sheet-title"
    title.textContent = "Languages"
    header.appendChild(title)
    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.className = "catalog-sheet-close"
    closeBtn.setAttribute("aria-label", "Close")
    closeBtn.innerHTML = SVG_CLOSE
    closeBtn.addEventListener("click", () => closeSheet())
    header.appendChild(closeBtn)
    sheetEl.appendChild(header)

    const list = document.createElement("div")
    list.className = "catalog-sheet-list"
    sheetEl.appendChild(list)

    renderSheetList(list)

    document.body.appendChild(scrimEl)
    document.body.appendChild(sheetEl)
    requestAnimationFrame(() => {
      scrimEl?.classList.add("catalog-sheet-scrim--open")
      sheetEl?.classList.add("catalog-sheet--open")
    })
  }

  function closeSheet(): void {
    if (!sheetEl) return
    scrimEl?.classList.remove("catalog-sheet-scrim--open")
    sheetEl.classList.remove("catalog-sheet--open")
    if (sheetCloseTimer) clearTimeout(sheetCloseTimer)
    const s = sheetEl
    const sc = scrimEl
    sheetCloseTimer = setTimeout(() => {
      s?.remove()
      sc?.remove()
      sheetCloseTimer = null
    }, 200)
    sheetEl = null
    scrimEl = null
  }

  function renderSheetList(list: HTMLElement): void {
    list.innerHTML = ""

    const activeBookId = opts.getActiveBookId()
    const activeId = opts.getActiveId()
    const installed = opts.getInstalled().filter((n) => n.bookId === activeBookId)
    const installedIds = new Set(installed.map((n) => n.narrationId))
    const catalog = opts.getCatalog().filter((n) => n.bookId === activeBookId)

    // Section: installed (sorted by recent-use, active first)
    if (installed.length > 0) {
      const recent = getRecentNarrations()
      const ordered = [...installed].sort((a, b) => {
        if (a.narrationId === activeId) return -1
        if (b.narrationId === activeId) return 1
        const ai = recent.indexOf(a.narrationId)
        const bi = recent.indexOf(b.narrationId)
        if (ai === -1 && bi === -1) return b.installedAt - a.installedAt
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })

      const sectionTitle = document.createElement("div")
      sectionTitle.className = "narration-switcher-sheet-section"
      sectionTitle.textContent = "Installed"
      list.appendChild(sectionTitle)

      for (const n of ordered) {
        list.appendChild(makeSheetRowInstalled(n, n.narrationId === activeId))
      }
    }

    // Section: not-yet-installed catalog narrations of this book
    const available = catalog.filter((n) => !installedIds.has(n.id))
    if (available.length > 0) {
      const sectionTitle = document.createElement("div")
      sectionTitle.className = "narration-switcher-sheet-section"
      sectionTitle.textContent = "Add a language"
      list.appendChild(sectionTitle)
      for (const entry of available) {
        list.appendChild(makeSheetRowAvailable(entry))
      }
    }

    if (installed.length === 0 && available.length === 0) {
      const empty = document.createElement("div")
      empty.className = "catalog-sheet-empty"
      empty.textContent = "No languages available yet"
      list.appendChild(empty)
    }
  }

  function makeSheetRowInstalled(n: InstalledNarration, isActive: boolean): HTMLElement {
    const item = document.createElement("button")
    item.type = "button"
    item.className = "catalog-sheet-item"
    if (isActive) item.classList.add("catalog-sheet-item--active")
    const name = document.createElement("span")
    name.className = "narration-switcher-sheet-name"
    const langName = opts.getLanguageName(n.language) || n.language.toUpperCase()
    name.textContent =
      n.voiceName && n.voiceName !== "Default"
        ? `${langName} \u00B7 ${n.voiceName}`
        : langName
    item.appendChild(name)
    if (isActive) {
      const check = document.createElement("span")
      check.className = "catalog-sheet-item-check"
      check.textContent = "\u2713"
      item.appendChild(check)
    }
    item.addEventListener("click", () => {
      if (!isActive) opts.onSwitch(n.narrationId)
      closeSheet()
    })
    return item
  }

  function makeSheetRowAvailable(entry: CatalogNarrationEntry): HTMLElement {
    const item = document.createElement("button")
    item.type = "button"
    item.className = "catalog-sheet-item"

    const name = document.createElement("span")
    name.className = "narration-switcher-sheet-name"
    const langName = opts.getLanguageName(entry.language) || entry.language.toUpperCase()
    name.textContent =
      entry.voiceName && entry.voiceName !== "Default"
        ? `${langName} \u00B7 ${entry.voiceName}`
        : langName
    item.appendChild(name)

    const isPaid = entry.purchase.type === "iap"
    const productId = entry.purchase.productId
    const entitled =
      !isPaid ||
      opts.isSubscriber() ||
      (productId ? opts.ownsBook(productId) : false)
    const locked = isPaid && !entitled

    const action = document.createElement("span")
    action.className = "narration-switcher-sheet-action"

    if (locked) {
      action.classList.add("narration-switcher-sheet-action--locked")
      action.innerHTML = SVG_LOCK
      item.disabled = true
      item.classList.add("catalog-sheet-item--locked")
    } else {
      action.classList.add("narration-switcher-sheet-action--download")
      const sizeLabel = entry.sizeMb ? ` ${Math.round(entry.sizeMb)} MB` : ""
      action.innerHTML = `${SVG_DOWNLOAD}<span class="narration-switcher-sheet-size">${sizeLabel.trim()}</span>`
      item.addEventListener("click", async () => {
        if (item.disabled) return
        item.disabled = true
        action.innerHTML = SVG_SPINNER
        const ok = await opts.onInstallAndSwitch(entry)
        if (ok) {
          closeSheet()
        } else {
          item.disabled = false
          const sizeLabel2 = entry.sizeMb ? ` ${Math.round(entry.sizeMb)} MB` : ""
          action.innerHTML = `${SVG_DOWNLOAD}<span class="narration-switcher-sheet-size">${sizeLabel2.trim()}</span>`
        }
      })
    }
    item.appendChild(action)
    return item
  }

  // ---- Lifecycle ----

  refresh()

  function dispose(): void {
    closeSheet()
    root.remove()
  }

  return { element: root, refresh, dispose }
}
