import "./commandDrawer.css"
import { drawerStore, type DrawerScreen } from "../state/drawerStore"

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
  onOpen?: () => void
}

export type CommandDrawer = {
  open: () => void
  close: () => void
  toggle: () => void
  isOpen: () => boolean
  /** Get the trigger button element (for reader positioning) */
  getTrigger: () => HTMLElement
  /** Navigate to a specific screen within the drawer */
  navigateTo: (screen: DrawerScreen) => void
  /** Get the screen container element for a given screen (for direct rendering) */
  getScreen: (screen: DrawerScreen) => HTMLElement | undefined
  dispose: () => void
}

const SVG_MENU = `<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`
const SVG_CLOSE = `<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`

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

  // Only show now-playing block when there's a book title
  function updateNowPlayingVisibility() {
    const { nowPlaying } = drawerStore.getState()
    if (nowPlaying.bookTitle) {
      nowPlayingEl.style.display = ""
      npTitle.textContent = nowPlaying.bookTitle
    } else {
      nowPlayingEl.style.display = "none"
    }
  }

  nowPlayingEl.append(npTitle)
  updateNowPlayingVisibility()

  const langContainer = document.createElement("div")
  langContainer.className = "command-drawer-languages"

  // Close button (mobile only — hidden on desktop via CSS)
  const closeBtn = document.createElement("button")
  closeBtn.className = "command-drawer-close"
  closeBtn.title = "Close"
  closeBtn.innerHTML = SVG_CLOSE
  closeBtn.addEventListener("click", () => close())

  sticky.append(closeBtn, nowPlayingEl, langContainer)
  sheet.appendChild(sticky)

  // --- Screen nav tabs ---
  const screenNav = document.createElement("div")
  screenNav.className = "command-drawer-screen-nav"

  const SCREENS: { id: DrawerScreen; label: string }[] = [
    { id: "now-playing", label: "Now Playing" },
    { id: "library", label: "Library" },
    { id: "browse", label: "Browse" },
  ]

  const screenTabs = new Map<DrawerScreen, HTMLButtonElement>()
  for (const { id, label } of SCREENS) {
    const tab = document.createElement("button")
    tab.className = "command-drawer-screen-tab"
    tab.textContent = label
    tab.dataset.screen = id
    tab.addEventListener("click", () => navigateToScreen(id))
    screenNav.appendChild(tab)
    screenTabs.set(id, tab)
  }
  sheet.appendChild(screenNav)

  // --- Screen container (shows one screen at a time) ---
  const screenContainer = document.createElement("div")
  screenContainer.className = "command-drawer-screen-container"

  // Create screen elements
  const screens = new Map<DrawerScreen, HTMLElement>()
  for (const { id } of SCREENS) {
    const screen = document.createElement("div")
    screen.className = "command-drawer-screen"
    screen.dataset.screen = id
    screenContainer.appendChild(screen)
    screens.set(id, screen)
  }
  // Detail screen (sub-screen of browse, not in nav)
  const detailScreen = document.createElement("div")
  detailScreen.className = "command-drawer-screen"
  detailScreen.dataset.screen = "detail"
  screenContainer.appendChild(detailScreen)
  screens.set("detail", detailScreen)

  sheet.appendChild(screenContainer)

  // --- Render custom sections into "now-playing" screen ---
  const sectionEls: { def: DrawerSectionDef; el: HTMLElement }[] = []

  function renderCustomSections() {
    const nowPlayingScreen = screens.get("now-playing")
    if (!nowPlayingScreen) return

    const sorted = [...(opts.customSections || [])].sort(
      (a, b) => (a.priority ?? 50) - (b.priority ?? 50)
    )
    for (const def of sorted) {
      // Skip sections that have dedicated screens
      if (def.id === "library" || def.id === "browse" || def.id === "now-playing") continue

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

      nowPlayingScreen.appendChild(section)
      sectionEls.push({ def, el: section })
    }
  }

  // Render screen-level sections into their dedicated screens
  function renderScreenSections() {
    const sorted = [...(opts.customSections || [])].sort(
      (a, b) => (a.priority ?? 50) - (b.priority ?? 50)
    )
    for (const def of sorted) {
      if (def.id === "now-playing") {
        const npScreen = screens.get("now-playing")
        if (npScreen) {
          const container = document.createElement("div")
          container.className = "command-drawer-screen-content"
          // Insert at the TOP of the now-playing screen (before custom sections like Display)
          npScreen.insertBefore(container, npScreen.firstChild)
          def.render(container)
          sectionEls.push({ def, el: container })
        }
      } else if (def.id === "library") {
        const libraryScreen = screens.get("library")
        if (libraryScreen) {
          const container = document.createElement("div")
          container.className = "command-drawer-screen-content"
          libraryScreen.appendChild(container)
          def.render(container)
          sectionEls.push({ def, el: container })
        }
      } else if (def.id === "browse") {
        const browseScreen = screens.get("browse")
        if (browseScreen) {
          const container = document.createElement("div")
          container.className = "command-drawer-screen-content"
          browseScreen.appendChild(container)
          def.render(container)
          sectionEls.push({ def, el: container })
        }
      }
    }
  }

  renderCustomSections()
  renderScreenSections()

  // --- Screen navigation ---
  function navigateToScreen(screen: DrawerScreen) {
    drawerStore.setState({ activeScreen: screen })
  }

  function updateActiveScreen() {
    const { activeScreen } = drawerStore.getState()
    // Update tabs
    for (const [id, tab] of screenTabs) {
      tab.classList.toggle("command-drawer-screen-tab--active", id === activeScreen)
    }
    // Show/hide screens
    for (const [id, el] of screens) {
      const isActive = id === activeScreen
      el.classList.toggle("command-drawer-screen--active", isActive)
    }
    // Hide browse tab highlight when on detail (detail is a sub-screen of browse)
    if (activeScreen === "detail") {
      screenTabs.get("browse")?.classList.add("command-drawer-screen-tab--active")
    }
  }

  updateActiveScreen()

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
    if (state.activeScreen !== prev.activeScreen) {
      updateActiveScreen()
    }
  })

  // --- Gesture dismiss (swipe down on handle + sticky header) ---
  let dragStartY = 0
  let dragStartTime = 0
  let isDragging = false

  const desktopMq = window.matchMedia("(min-width: 1024px)")

  function attachDragListeners(el: HTMLElement, guardButtons: boolean) {
    el.addEventListener("pointerdown", (e: PointerEvent) => {
      if (guardButtons && (e.target as HTMLElement).closest("button")) return
      if (guardButtons && desktopMq.matches) return
      isDragging = true
      dragStartY = e.clientY
      dragStartTime = Date.now()
      el.setPointerCapture(e.pointerId)
      sheet.style.transition = "none"
    })

    el.addEventListener("pointermove", (e: PointerEvent) => {
      if (!isDragging) return
      const dy = Math.max(0, e.clientY - dragStartY)
      sheet.style.transform = `translateY(${dy}px)`
    })

    el.addEventListener("pointerup", (e: PointerEvent) => {
      if (!isDragging) return
      isDragging = false
      el.releasePointerCapture(e.pointerId)

      const dy = e.clientY - dragStartY
      const elapsed = Date.now() - dragStartTime
      const velocity = elapsed > 0 ? dy / elapsed : 0
      const threshold = sheet.offsetHeight * 0.15
      if (dy > threshold || (velocity > 0.5 && dy > 20)) {
        // Let close() handle the transition — clear inline transform first
        sheet.style.transition = ""
        sheet.style.transform = ""
        close()
      } else {
        // Snap back — restore transition and reset transform
        sheet.style.transition = ""
        sheet.style.transform = ""
      }
    })

    el.addEventListener("pointercancel", () => {
      if (!isDragging) return
      isDragging = false
      sheet.style.transition = ""
      sheet.style.transform = ""
    })
  }

  attachDragListeners(handle, false)
  attachDragListeners(sticky, true)

  // --- Open / Close ---
  function open() {
    if (isOpenState) return
    isOpenState = true
    sheet.classList.remove("command-drawer-sheet--closing")
    backdrop.classList.add("command-drawer-backdrop--open")
    sheet.classList.add("command-drawer-sheet--open")
    opts.onOpen?.()
  }

  function close() {
    if (!isOpenState) return
    isOpenState = false
    // Immediately block touch on sheet so it doesn't eat taps during close animation
    sheet.style.pointerEvents = "none"
    sheet.classList.add("command-drawer-sheet--closing")
    backdrop.classList.remove("command-drawer-backdrop--open")
    sheet.classList.remove("command-drawer-sheet--open")
    // Remove closing class after animation
    setTimeout(() => {
      sheet.classList.remove("command-drawer-sheet--closing")
      sheet.style.pointerEvents = ""
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
    navigateTo: navigateToScreen,
    getScreen: (screen: DrawerScreen) => screens.get(screen),
    dispose,
  }
}
