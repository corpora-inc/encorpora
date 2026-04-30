/**
 * Filter rail for the station list — search, sort, tag chips.
 *
 * Owns the UI; emits structured change events so the parent view can apply
 * filters and persist preferences. Tag chips are populated lazily once the
 * stations have loaded (so we know which tags are common in this language).
 */

import { el, clear } from "../ui/dom"
import { ICON_CHECK, ICON_CHEVRON_DOWN, ICON_SEARCH } from "../ui/icons"
import type { SortKey } from "../state/listPrefs"

export type FilterState = {
  query: string
  sort: SortKey
  tags: string[]
}

export type FilterChange = {
  type: "query" | "sort" | "tag" | "clear"
  state: FilterState
  /** When type === "tag", the tag added or removed. */
  tag?: string
  applied?: boolean
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "name", label: "Name A–Z" },
  { value: "bitrate", label: "Bitrate" },
  { value: "country", label: "Country" },
]

const SORT_LABEL: Record<SortKey, string> = {
  popular: "Popular",
  name: "A–Z",
  bitrate: "Bitrate",
  country: "Country",
}

export type FilterRail = {
  root: HTMLElement
  /** Replace the tag-chip set (called after stations load). */
  setAvailableTags: (tags: string[]) => void
  /** Reflect external state changes into the UI without firing onChange. */
  setState: (state: FilterState) => void
  getState: () => FilterState
  /** Hide the sort control (it has no meaning in map view). */
  setSortVisible: (visible: boolean) => void
  dispose: () => void
}

export function createFilterRail(opts: {
  initial: FilterState
  onChange: (change: FilterChange) => void
}): FilterRail {
  let state: FilterState = { ...opts.initial, tags: [...opts.initial.tags] }
  let availableTags: string[] = []

  const root = el("div", { class: "wr-filters" })

  // --- Search ---
  const searchWrap = el("div", { class: "wr-search-wrap" })
  searchWrap.appendChild(el("span", { class: "wr-search-icon", html: ICON_SEARCH }))
  const search = el("input", {
    class: "wr-search",
    type: "search",
    placeholder: "Search stations or genres",
    "aria-label": "Search stations or genres",
    value: state.query,
  }) as HTMLInputElement
  let queryTimer: number | null = null
  search.addEventListener("input", () => {
    if (queryTimer) window.clearTimeout(queryTimer)
    queryTimer = window.setTimeout(() => {
      state.query = search.value.trim()
      opts.onChange({ type: "query", state: { ...state, tags: [...state.tags] } })
    }, 200)
  })
  searchWrap.appendChild(search)
  root.appendChild(searchWrap)

  // --- Sort + tags row ---
  const filterRow = el("div", { class: "wr-filter-row" })

  const sortWrap = el("div", { class: "wr-sort" })
  const sortBtn = el("button", {
    class: "wr-sort-btn",
    type: "button",
    "aria-haspopup": "listbox",
    "aria-expanded": "false",
  })
  const sortBtnText = el("span", {}, [`Sort: ${SORT_LABEL[state.sort]}`])
  sortBtn.appendChild(sortBtnText)
  const chev = el("span", { html: ICON_CHEVRON_DOWN })
  sortBtn.appendChild(chev)
  sortWrap.appendChild(sortBtn)

  const sortMenu = el("div", { class: "wr-sort-menu", role: "listbox", hidden: "true" })
  for (const option of SORT_OPTIONS) {
    const item = el("button", {
      class: "wr-sort-option",
      type: "button",
      role: "option",
      "aria-checked": option.value === state.sort ? "true" : "false",
    })
    item.appendChild(el("span", {}, [option.label]))
    if (option.value === state.sort) {
      item.appendChild(el("span", { html: ICON_CHECK }))
    }
    item.addEventListener("click", () => {
      if (state.sort === option.value) {
        closeMenu()
        return
      }
      state.sort = option.value
      sortBtnText.textContent = `Sort: ${SORT_LABEL[state.sort]}`
      // Re-render check marks
      for (const child of Array.from(sortMenu.children) as HTMLElement[]) {
        const matchValue = child.querySelector("span")?.textContent
        const matches = matchValue === SORT_OPTIONS.find(o => o.value === state.sort)?.label
        child.setAttribute("aria-checked", matches ? "true" : "false")
        const checkSpan = child.children[1] as HTMLElement | undefined
        if (matches && !checkSpan) {
          child.appendChild(el("span", { html: ICON_CHECK }))
        } else if (!matches && checkSpan) {
          checkSpan.remove()
        }
      }
      closeMenu()
      opts.onChange({ type: "sort", state: { ...state, tags: [...state.tags] } })
    })
    sortMenu.appendChild(item)
  }
  sortWrap.appendChild(sortMenu)

  function openMenu() {
    sortMenu.hidden = false
    sortBtn.setAttribute("aria-expanded", "true")
  }
  function closeMenu() {
    sortMenu.hidden = true
    sortBtn.setAttribute("aria-expanded", "false")
  }
  sortBtn.addEventListener("click", (ev) => {
    ev.stopPropagation()
    if (sortMenu.hidden) openMenu()
    else closeMenu()
  })
  const onDocClick = (ev: MouseEvent) => {
    if (!sortWrap.contains(ev.target as Node)) closeMenu()
  }
  document.addEventListener("click", onDocClick)

  filterRow.appendChild(sortWrap)

  // --- Tag chips ---
  const tagsRow = el("div", { class: "wr-tags", role: "list" })
  filterRow.appendChild(tagsRow)

  // --- Clear button (persistent, never scrolls away) ---
  // Sibling of `.wr-tags` and pinned to the right of the row, so the chip
  // strip can scroll freely while the clear button stays anchored where the
  // user can always reach it. Placed AFTER the tag row so the right-edge
  // fade in `.wr-tags` doesn't dim the clear button.
  const clearBtn = el("button", {
    class: "wr-tag-clear",
    type: "button",
    "aria-label": "Clear tag filters",
    title: "Clear tag filters",
  }, ["×"])
  clearBtn.style.display = "none"
  clearBtn.addEventListener("click", () => {
    state.tags = []
    renderTags()
    opts.onChange({ type: "clear", state: { ...state, tags: [] } })
  })
  filterRow.appendChild(clearBtn)

  root.appendChild(filterRow)

  function renderTags() {
    clear(tagsRow)
    clearBtn.style.display = state.tags.length > 0 ? "" : "none"
    const active = new Set(state.tags)
    // Show active tags first, then the top tags that aren't already active.
    const ordered: string[] = [
      ...state.tags,
      ...availableTags.filter((t) => !active.has(t)),
    ].slice(0, 14)
    for (const tag of ordered) {
      const isActive = active.has(tag)
      const chip = el("button", {
        class: "wr-tag",
        type: "button",
        role: "listitem",
        "aria-pressed": isActive ? "true" : "false",
      }, [tag])
      chip.addEventListener("click", () => {
        if (active.has(tag)) {
          state.tags = state.tags.filter((t) => t !== tag)
          opts.onChange({ type: "tag", tag, applied: false, state: { ...state, tags: [...state.tags] } })
        } else {
          state.tags = [...state.tags, tag]
          opts.onChange({ type: "tag", tag, applied: true, state: { ...state, tags: [...state.tags] } })
        }
        renderTags()
      })
      tagsRow.appendChild(chip)
    }
  }

  renderTags()

  return {
    root,
    setAvailableTags(tags: string[]) {
      availableTags = tags
      renderTags()
    },
    setState(next: FilterState) {
      state = { ...next, tags: [...next.tags] }
      search.value = state.query
      sortBtnText.textContent = `Sort: ${SORT_LABEL[state.sort]}`
      renderTags()
    },
    getState: () => ({ ...state, tags: [...state.tags] }),
    setSortVisible(visible: boolean) {
      sortWrap.style.display = visible ? "" : "none"
      if (!visible) closeMenu()
    },
    dispose() {
      document.removeEventListener("click", onDocClick)
      if (queryTimer) window.clearTimeout(queryTimer)
    },
  }
}

/**
 * Compute the top-N most frequent tags across a station list.
 */
export function computeTopTags(stations: { tags: string }[], n: number = 12): string[] {
  const freq = new Map<string, number>()
  for (const s of stations) {
    if (!s.tags) continue
    for (const part of s.tags.split(",")) {
      const t = part.trim().toLowerCase()
      if (!t) continue
      freq.set(t, (freq.get(t) ?? 0) + 1)
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([t]) => t)
}

/**
 * Apply search query, sort key, and tag filter to a station list, returning a
 * NEW array. Pure function — easy to test, cheap to recompute.
 */
export function applyFilters<T extends {
  name: string
  tags: string
  clickcount: number
  bitrate: number
  country: string
}>(stations: T[], state: FilterState): T[] {
  const q = state.query.trim().toLowerCase()
  const tagSet = new Set(state.tags)

  const matched = stations.filter((s) => {
    if (q) {
      const inName = s.name.toLowerCase().includes(q)
      const inTags = s.tags.toLowerCase().includes(q)
      if (!inName && !inTags) return false
    }
    if (tagSet.size > 0) {
      const stationTags = new Set(s.tags.toLowerCase().split(",").map((t) => t.trim()))
      for (const t of tagSet) {
        if (!stationTags.has(t)) return false
      }
    }
    return true
  })

  switch (state.sort) {
    case "name":
      matched.sort((a, b) => a.name.localeCompare(b.name))
      break
    case "bitrate":
      matched.sort((a, b) => b.bitrate - a.bitrate || a.name.localeCompare(b.name))
      break
    case "country":
      matched.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name))
      break
    case "popular":
    default:
      matched.sort((a, b) => b.clickcount - a.clickcount)
      break
  }

  return matched
}
