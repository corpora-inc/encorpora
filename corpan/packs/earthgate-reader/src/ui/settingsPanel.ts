export type LanguageInfo = { code: string; displayName: string; narrator: string }

export type SettingsPanel = {
  setLanguages: (languages: LanguageInfo[], current: string) => void
  onLanguageChange: (cb: (lang: string) => void) => void
  dispose: () => void
}

export type SettingsPanelOptions = {
  onBeforeClose?: () => void
}

/**
 * Create a compass-rose trigger button (top-right) and fullscreen settings
 * overlay with exit, language/narrator select, and dismiss.
 */
export function createSettingsPanel(
  parent: HTMLElement,
  options?: SettingsPanelOptions
): SettingsPanel {
  const onBeforeClose = options?.onBeforeClose
  let langCb: ((lang: string) => void) | null = null
  let isOpen = false

  // --- Compass rose trigger button ---
  const triggerBtn = document.createElement("button")
  triggerBtn.className = "earthgate-settings-btn"
  triggerBtn.title = "Settings"
  triggerBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="2"/></svg>`
  parent.appendChild(triggerBtn)

  // --- Fullscreen overlay ---
  const overlay = document.createElement("div")
  overlay.className = "earthgate-settings-overlay"
  parent.appendChild(overlay)

  // Dismiss X button
  const dismissBtn = document.createElement("button")
  dismissBtn.className = "earthgate-settings-dismiss"
  dismissBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  dismissBtn.addEventListener("click", close)
  overlay.appendChild(dismissBtn)

  // Content container
  const content = document.createElement("div")
  content.className = "earthgate-settings-content"
  overlay.appendChild(content)

  // Exit button
  const exitBtn = document.createElement("button")
  exitBtn.className = "earthgate-settings-exit"
  exitBtn.textContent = "Exit"
  exitBtn.addEventListener("click", () => {
    onBeforeClose?.()
    window.dispatchEvent(new Event("corpan:exit"))
  })
  content.appendChild(exitBtn)

  // Divider
  const divider = document.createElement("div")
  divider.className = "earthgate-settings-divider"
  content.appendChild(divider)

  // Language select
  const langSelect = document.createElement("select")
  langSelect.className = "earthgate-settings-lang-select"
  langSelect.addEventListener("change", () => {
    langCb?.(langSelect.value)
  })
  content.appendChild(langSelect)

  // --- Open/close ---
  function open() {
    isOpen = true
    overlay.classList.add("earthgate-settings-overlay--open")
  }

  function close() {
    isOpen = false
    overlay.classList.remove("earthgate-settings-overlay--open")
  }

  triggerBtn.addEventListener("click", () => {
    if (isOpen) close()
    else open()
  })

  return {
    setLanguages(languages: LanguageInfo[], current: string) {
      langSelect.innerHTML = ""
      for (const lang of languages) {
        const opt = document.createElement("option")
        opt.value = lang.code
        opt.textContent = lang.narrator
          ? `${lang.displayName} \u2013 ${lang.narrator}`
          : lang.displayName
        if (lang.code === current) opt.selected = true
        langSelect.appendChild(opt)
      }
      langSelect.style.display = languages.length <= 1 ? "none" : ""
      divider.style.display = languages.length <= 1 ? "none" : ""
    },

    onLanguageChange(cb: (lang: string) => void) { langCb = cb },

    dispose() {
      close()
      triggerBtn.remove()
      overlay.remove()
    },
  }
}
