import type { CatalogNarrationEntry, DownloadState } from "./types"
import { isInstalled, getInstalled, listInstalledForBook as _listInstalledForBook } from "./libraryStore"
import { getLanguageName } from "./searchFilter"
import { installNarration, deleteNarration, isTauriAvailable } from "./installManager"
import { subscribe as subscribeProgress, getState as getProgressState } from "./downloadProgress"

export type BookDetailOptions = {
  onPlay: (narrationId: string) => void
  onBack: () => void
  activeNarrationId?: string
}

export type BookDetail = {
  show: (narrations: CatalogNarrationEntry[]) => void
  hide: () => void
  dispose: () => void
  setActiveNarration: (id: string | undefined) => void
}

const SVG_BACK = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`

export function createBookDetail(
  parent: HTMLElement,
  opts: BookDetailOptions
): BookDetail {
  let currentNarrations: CatalogNarrationEntry[] = []
  let activeNarrationId = opts.activeNarrationId
  let visible = false
  const progressUnsubs: (() => void)[] = []

  const detail = document.createElement("div")
  detail.className = "catalog-detail"

  // Header
  const header = document.createElement("div")
  header.className = "catalog-detail-header"

  const backBtn = document.createElement("button")
  backBtn.className = "catalog-back-btn"
  backBtn.innerHTML = `${SVG_BACK} Back`
  backBtn.onclick = () => {
    hide()
    opts.onBack()
  }

  header.append(backBtn)

  // Content
  const contentEl = document.createElement("div")
  contentEl.className = "catalog-detail-content"

  detail.append(header, contentEl)
  parent.append(detail)

  function cleanupProgressSubs(): void {
    for (const unsub of progressUnsubs) unsub()
    progressUnsubs.length = 0
  }

  function renderButton(
    narration: CatalogNarrationEntry,
    container: HTMLElement
  ): void {
    const state = getProgressState(narration.id)
    const installed = isInstalled(narration.id)
    const hasTauri = isTauriAvailable()

    if (installed) {
      // Play + Delete buttons
      const actions = document.createElement("div")
      actions.className = "catalog-installed-actions"

      const isActive = narration.id === activeNarrationId

      const playBtn = document.createElement("button")
      playBtn.className = isActive ? "catalog-btn catalog-btn--success" : "catalog-btn catalog-btn--primary"
      playBtn.textContent = isActive ? "\u25B6 Playing" : "\u25B6 Play"
      playBtn.onclick = (e) => {
        e.stopPropagation()
        opts.onPlay(narration.id)
      }

      const delBtn = document.createElement("button")
      delBtn.className = "catalog-btn catalog-btn--danger"
      delBtn.innerHTML = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`
      delBtn.title = "Delete"
      delBtn.onclick = async (e) => {
        e.stopPropagation()
        await deleteNarration(narration.id)
        render()
      }

      const info = getInstalled(narration.id)
      if (info) {
        const ver = document.createElement("span")
        ver.className = "catalog-installed-version"
        ver.textContent = `v${info.version}`
        actions.append(ver)
      }

      actions.append(playBtn, delBtn)
      container.append(actions)
      return
    }

    // Download button with progress
    const btn = document.createElement("button")
    btn.className = "catalog-btn"

    if (!hasTauri) {
      btn.className = "catalog-btn catalog-btn--disabled"
      btn.textContent = "Desktop only"
      container.append(btn)
      return
    }

    function updateBtn(ds: DownloadState): void {
      switch (ds.stage) {
        case "idle":
          btn.className = "catalog-btn"
          btn.innerHTML = `<svg class="catalog-btn-icon" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2"/></svg>${Math.round(narration.sizeMb)} MB`
          btn.onclick = async (e) => {
            e.stopPropagation()
            btn.className = "catalog-btn catalog-btn--disabled"
            btn.textContent = "Starting..."
            await installNarration(narration)
            render()
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
          render() // Re-render to show Play button
          break
        case "error":
          btn.className = "catalog-btn"
          btn.innerHTML = `\u21BB ${Math.round(narration.sizeMb)} MB`
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

    container.append(btn)
  }

  function render(): void {
    cleanupProgressSubs()
    contentEl.innerHTML = ""

    if (currentNarrations.length === 0) return

    const first = currentNarrations[0]

    // Hero section
    const hero = document.createElement("div")
    hero.className = "catalog-detail-hero"

    const title = document.createElement("div")
    title.className = "catalog-detail-title"
    title.textContent = first.bookTitle

    hero.append(title)

    if (first.series) {
      const subtitle = document.createElement("div")
      subtitle.className = "catalog-detail-subtitle"
      subtitle.textContent = first.series + (first.volume ? ` \u00B7 Vol. ${first.volume}` : "")
      hero.append(subtitle)
    }

    contentEl.append(hero)

    // Separate installed vs available
    const installedNarrs = currentNarrations.filter((n) => isInstalled(n.id))
    const availableNarrs = currentNarrations.filter((n) => !isInstalled(n.id))

    // Downloaded section
    if (installedNarrs.length > 0) {
      const section = document.createElement("div")
      section.className = "catalog-detail-section"

      const sectionTitle = document.createElement("div")
      sectionTitle.className = "catalog-detail-section-title"
      sectionTitle.textContent = "Downloaded"
      section.append(sectionTitle)

      for (const narr of installedNarrs) {
        const row = document.createElement("div")
        row.className = "catalog-narration-row"

        const info = document.createElement("div")
        info.className = "catalog-narration-info"

        const lang = document.createElement("div")
        lang.className = "catalog-narration-lang"
        lang.textContent = getLanguageName(narr.language)

        const voice = document.createElement("div")
        voice.className = "catalog-narration-voice"
        voice.textContent = narr.voiceName

        info.append(lang, voice)
        row.append(info)

        renderButton(narr, row)
        section.append(row)
      }

      contentEl.append(section)
    }

    // Available section
    if (availableNarrs.length > 0) {
      const section = document.createElement("div")
      section.className = "catalog-detail-section"

      const sectionTitle = document.createElement("div")
      sectionTitle.className = "catalog-detail-section-title"
      sectionTitle.textContent = "Available"
      section.append(sectionTitle)

      for (const narr of availableNarrs) {
        const row = document.createElement("div")
        row.className = "catalog-narration-row"

        const info = document.createElement("div")
        info.className = "catalog-narration-info"

        const lang = document.createElement("div")
        lang.className = "catalog-narration-lang"
        lang.textContent = getLanguageName(narr.language)

        const voice = document.createElement("div")
        voice.className = "catalog-narration-voice"
        voice.textContent = narr.voiceName

        info.append(lang, voice)

        row.append(info)
        renderButton(narr, row)
        section.append(row)
      }

      contentEl.append(section)
    }
  }

  function show(narrations: CatalogNarrationEntry[]): void {
    currentNarrations = narrations
    visible = true
    detail.classList.add("catalog-detail--open")
    render()
  }

  function hide(): void {
    visible = false
    detail.classList.remove("catalog-detail--open")
    cleanupProgressSubs()
  }

  function dispose(): void {
    hide()
    detail.remove()
  }

  function setActiveNarration(id: string | undefined): void {
    activeNarrationId = id
    if (visible) render()
  }

  return { show, hide, dispose, setActiveNarration }
}
