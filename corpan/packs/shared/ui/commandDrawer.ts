import "./commandDrawer.css"
import { drawerStore } from "../state/drawerStore"

/** Language info for pill buttons */
export type LanguageInfo = {
  code: string
  displayName: string
  narrator?: string
  narrationId?: string
}

/** Custom section injected by readers (e.g. stargate display settings) */
export type DrawerSectionDef = {
  id: string
  title: string
  render: (container: HTMLElement) => void
  dispose?: () => void
  /** Lower = higher in drawer (default 50) */
  priority?: number
}

export type CommandDrawerOptions = {
  cdnUrl?: string
  customSections?: DrawerSectionDef[]
  onPlayNarration?: (narrationId: string) => void
  onSelectBook?: (bookId: string) => void
  onExit?: () => void
}

export type CommandDrawer = {
  open: () => void
  close: () => void
  toggle: () => void
  isOpen: () => boolean
  /** Get the trigger button element (for reader positioning) */
  getTrigger: () => HTMLElement
  dispose: () => void
}

const SVG_MENU = `<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`

export function createCommandDrawer(
  parent: HTMLElement,
  opts: CommandDrawerOptions
): CommandDrawer {
  let isOpenState = false

  // --- DOM: Backdrop ---
  const backdrop = document.createElement("div")
  backdrop.className = "command-drawer-backdrop"
  backdrop.addEventListener("click", () => close())

  // --- DOM: Sheet ---
  const sheet = document.createElement("div")
  sheet.className = "command-drawer-sheet"
  sheet.setAttribute("dir", "auto")

  // Handle (drag target)
  const handle = document.createElement("div")
  handle.className = "command-drawer-handle"
  const handleBar = document.createElement("div")
  handleBar.className = "command-drawer-handle-bar"
  handle.appendChild(handleBar)
  sheet.appendChild(handle)

  // --- Sticky header: Now Playing + Language ---
  const sticky = document.createElement("div")
  sticky.className = "command-drawer-sticky"

  const nowPlayingEl = document.createElement("div")
  nowPlayingEl.className = "command-drawer-now-playing"

  const npTitle = document.createElement("div")
  npTitle.className = "command-drawer-now-playing-title"

  const npNarrator = document.createElement("div")
  npNarrator.className = "command-drawer-now-playing-narrator"

  // Only show now-playing block when there's a book title
  function updateNowPlayingVisibility() {
    const { nowPlaying } = drawerStore.getState()
    if (nowPlaying.bookTitle) {
      nowPlayingEl.style.display = ""
      npTitle.textContent = nowPlaying.bookTitle
      npNarrator.textContent = nowPlaying.narrator || ""
    } else {
      nowPlayingEl.style.display = "none"
    }
  }

  nowPlayingEl.append(npTitle, npNarrator)
  updateNowPlayingVisibility()

  const langContainer = document.createElement("div")
  langContainer.className = "command-drawer-languages"

  sticky.append(nowPlayingEl, langContainer)
  sheet.appendChild(sticky)

  // --- Scrollable body ---
  const body = document.createElement("div")
  body.className = "command-drawer-body"
  sheet.appendChild(body)

  // --- Custom sections ---
  const sectionEls: { def: DrawerSectionDef; el: HTMLElement }[] = []

  function renderCustomSections() {
    const sorted = [...(opts.customSections || [])].sort(
      (a, b) => (a.priority ?? 50) - (b.priority ?? 50)
    )
    for (const def of sorted) {
      const section = document.createElement("div")
      section.className = "command-drawer-section"
      section.dataset.sectionId = def.id

      const title = document.createElement("div")
      title.className = "command-drawer-section-title"
      title.textContent = def.title
      section.appendChild(title)

      const container = document.createElement("div")
      section.appendChild(container)
      def.render(container)

      body.appendChild(section)
      sectionEls.push({ def, el: section })
    }
  }

  renderCustomSections()

  // --- Footer: Exit ---
  const footer = document.createElement("div")
  footer.className = "command-drawer-footer"

  const exitBtn = document.createElement("button")
  exitBtn.className = "command-drawer-exit"
  exitBtn.textContent = "Exit"
  exitBtn.addEventListener("click", () => {
    close()
    if (opts.onExit) {
      opts.onExit()
    } else {
      window.dispatchEvent(new Event("corpan:exit"))
    }
  })
  footer.appendChild(exitBtn)
  sheet.appendChild(footer)

  // --- Trigger button ---
  const trigger = document.createElement("button")
  trigger.className = "command-drawer-trigger"
  trigger.title = "Menu"
  trigger.innerHTML = SVG_MENU
  trigger.addEventListener("click", () => toggle())

  // Append to parent
  parent.append(trigger, backdrop, sheet)

  // --- Render language pills ---
  function renderLanguagePills() {
    const { languages, currentLanguage, currentNarrationId } = drawerStore.getState()
    langContainer.innerHTML = ""
    for (const lang of languages) {
      const pill = document.createElement("button")
      pill.className = "command-drawer-lang-pill"
      const isActive = lang.narrationId
        ? lang.narrationId === currentNarrationId
        : lang.code === currentLanguage
      if (isActive) {
        pill.classList.add("command-drawer-lang-pill--active")
      }
      pill.textContent = lang.displayName
      if (languages.length === 1) {
        pill.disabled = true
      } else {
        pill.addEventListener("click", () => {
          const s = drawerStore.getState()
          if (lang.narrationId) {
            if (lang.narrationId === s.currentNarrationId) return
            drawerStore.setState({ currentNarrationId: lang.narrationId, currentLanguage: lang.code })
          } else {
            if (lang.code === s.currentLanguage) return
            drawerStore.setState({ currentLanguage: lang.code })
          }
        })
      }
      langContainer.appendChild(pill)
    }
  }

  renderLanguagePills()

  // Subscribe to store changes
  const storeUnsub = drawerStore.subscribe((state, prev) => {
    if (state.languages !== prev.languages || state.currentLanguage !== prev.currentLanguage || state.currentNarrationId !== prev.currentNarrationId) {
      renderLanguagePills()
    }
    if (state.nowPlaying !== prev.nowPlaying) {
      updateNowPlayingVisibility()
    }
  })

  // --- Gesture dismiss (swipe down on handle) ---
  let dragStartY = 0
  let dragCurrentY = 0
  let isDragging = false

  handle.addEventListener("pointerdown", (e: PointerEvent) => {
    isDragging = true
    dragStartY = e.clientY
    dragCurrentY = e.clientY
    handle.setPointerCapture(e.pointerId)
    sheet.style.transition = "none"
  })

  handle.addEventListener("pointermove", (e: PointerEvent) => {
    if (!isDragging) return
    dragCurrentY = e.clientY
    const dy = Math.max(0, dragCurrentY - dragStartY)
    sheet.style.transform = `translateY(${dy}px)`
  })

  handle.addEventListener("pointerup", (e: PointerEvent) => {
    if (!isDragging) return
    isDragging = false
    handle.releasePointerCapture(e.pointerId)
    sheet.style.transition = ""
    sheet.style.transform = ""

    const dy = dragCurrentY - dragStartY
    const threshold = sheet.offsetHeight * 0.3
    if (dy > threshold) {
      close()
    }
  })

  handle.addEventListener("pointercancel", () => {
    if (!isDragging) return
    isDragging = false
    sheet.style.transition = ""
    sheet.style.transform = ""
  })

  // --- Open / Close ---
  function open() {
    if (isOpenState) return
    isOpenState = true
    sheet.classList.remove("command-drawer-sheet--closing")
    backdrop.classList.add("command-drawer-backdrop--open")
    sheet.classList.add("command-drawer-sheet--open")
  }

  function close() {
    if (!isOpenState) return
    isOpenState = false
    sheet.classList.add("command-drawer-sheet--closing")
    backdrop.classList.remove("command-drawer-backdrop--open")
    sheet.classList.remove("command-drawer-sheet--open")
    // Remove closing class after animation
    setTimeout(() => {
      sheet.classList.remove("command-drawer-sheet--closing")
    }, 350)
  }

  function toggle() {
    if (isOpenState) close()
    else open()
  }

  function dispose() {
    close()
    storeUnsub()
    for (const { def } of sectionEls) {
      def.dispose?.()
    }
    trigger.remove()
    backdrop.remove()
    sheet.remove()
  }

  return {
    open,
    close,
    toggle,
    isOpen: () => isOpenState,
    getTrigger: () => trigger,
    dispose,
  }
}
