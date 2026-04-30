/**
 * Stack-first language browse view.
 *
 * Top section:    "Your stack"  — the user's learning languages (in stack order).
 * Bottom section: "All languages" — the rest, alphabetized by display name.
 *
 * Each row shows the display name + indexed station count; tapping it opens the
 * station list view.
 */

import { ALL_CORPAN_LANGUAGES, corpanToRadioLanguage, displayName } from "../api/languageMap"
import { getLanguages } from "../api/radioBrowser"
import { el, clear } from "../ui/dom"

export type LanguageListView = {
  root: HTMLElement
  setStack: (codes: string[]) => void
  refresh: () => Promise<void>
  dispose: () => void
}

export function createLanguageListView(opts: {
  initialStack: string[]
  onSelect: (corpanCode: string) => void
}): LanguageListView {
  const root = el("section", { class: "wr-langlist" })
  const stackHeading = el("h2", { class: "wr-section-h" }, ["Your stack"])
  const stackList = el("ul", { class: "wr-list" })
  const allHeading = el("h2", { class: "wr-section-h" }, ["All languages"])
  const allList = el("ul", { class: "wr-list" })
  const status = el("p", { class: "wr-status" }, ["Loading languages…"])

  root.appendChild(status)
  root.appendChild(stackHeading)
  root.appendChild(stackList)
  root.appendChild(allHeading)
  root.appendChild(allList)

  let stack = [...opts.initialStack]
  let counts: Map<string, number> = new Map()
  let disposed = false

  function row(corpanCode: string, count: number | undefined): HTMLElement {
    const li = el("li", { class: "wr-row" })
    const button = el("button", {
      class: "wr-row-btn",
      type: "button",
      "data-code": corpanCode,
      "aria-label": `Browse ${displayName(corpanCode)} stations`,
    })
    button.appendChild(el("span", { class: "wr-row-name" }, [displayName(corpanCode)]))
    const meta = count === undefined
      ? "—"
      : count === 0
      ? "no stations"
      : `${formatCount(count)} stations`
    button.appendChild(el("span", { class: "wr-row-count" }, [meta]))
    button.addEventListener("click", () => opts.onSelect(corpanCode))
    li.appendChild(button)
    return li
  }

  function render() {
    if (disposed) return
    clear(stackList)
    clear(allList)

    const stackSet = new Set(stack)
    let stackRendered = 0
    for (const code of stack) {
      if (!ALL_CORPAN_LANGUAGES.includes(code)) continue
      const count = counts.get(code)
      if (count !== undefined && count === 0) continue
      stackList.appendChild(row(code, count))
      stackRendered += 1
    }
    stackHeading.style.display = stackRendered > 0 ? "" : "none"

    const rest = ALL_CORPAN_LANGUAGES.filter((c) => !stackSet.has(c))
      .map((code) => ({ code, count: counts.get(code) }))
      .filter((entry) => entry.count === undefined || entry.count > 0)
      .sort((a, b) => displayName(a.code).localeCompare(displayName(b.code)))

    for (const { code, count } of rest) {
      allList.appendChild(row(code, count))
    }

    status.style.display = counts.size === 0 ? "" : "none"
  }

  async function refresh() {
    try {
      const languages = await getLanguages()
      const byName = new Map<string, number>()
      for (const l of languages) byName.set(l.name.toLowerCase(), l.stationcount)

      const next = new Map<string, number>()
      for (const code of ALL_CORPAN_LANGUAGES) {
        const radioName = corpanToRadioLanguage(code)
        if (!radioName) continue
        next.set(code, byName.get(radioName.toLowerCase()) ?? 0)
      }
      counts = next
      render()
    } catch (err) {
      console.error("[world-radio] language list refresh failed:", err)
      status.textContent = "Couldn't reach the radio directory. Check your connection."
    }
  }

  render()

  return {
    root,
    setStack(codes) {
      stack = [...codes]
      render()
    },
    refresh,
    dispose() {
      disposed = true
    },
  }
}

function formatCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`
  return `${Math.round(n / 1000)}k`
}
