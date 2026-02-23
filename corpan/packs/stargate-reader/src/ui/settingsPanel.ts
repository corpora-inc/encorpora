export type SettingsPanel = {
  setLanguages: (languages: string[], current: string) => void
  onToggleOscilloscope: (cb: (visible: boolean) => void) => void
  onToggleWaveform: (cb: (visible: boolean) => void) => void
  onLanguageChange: (cb: (lang: string) => void) => void
  dispose: () => void
}

export type SettingsPanelOptions = {
  initialOscilloscope?: boolean
  initialWaveform?: boolean
  onBeforeClose?: () => void
}

/**
 * Create a gear button (top-right) that opens a dropdown settings panel.
 * Contains oscilloscope/waveform toggles, language selector, and exit.
 */
export function createSettingsPanel(
  parent: HTMLElement,
  options?: SettingsPanelOptions
): SettingsPanel {
  const onBeforeClose = options?.onBeforeClose
  let langCb: ((lang: string) => void) | null = null
  let toggleOscCb: ((visible: boolean) => void) | null = null
  let toggleWaveCb: ((visible: boolean) => void) | null = null
  let oscVisible = options?.initialOscilloscope ?? true
  let waveVisible = options?.initialWaveform ?? true
  let isOpen = false

  // --- Gear button ---
  const gearBtn = document.createElement("button")
  gearBtn.className = "stargate-settings-btn"
  gearBtn.title = "Settings"
  gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`
  parent.appendChild(gearBtn)

  // --- Dropdown ---
  const dropdown = document.createElement("div")
  dropdown.className = "stargate-settings-dropdown"
  parent.appendChild(dropdown)

  // Dismiss button (visible on mobile full-screen)
  const dismissBtn = document.createElement("button")
  dismissBtn.className = "stargate-settings-dismiss"
  dismissBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  dismissBtn.addEventListener("click", close)
  dropdown.appendChild(dismissBtn)

  // Oscilloscope toggle row
  const oscRow = document.createElement("div")
  oscRow.className = "stargate-settings-row"
  const oscLabel = document.createElement("span")
  oscLabel.className = "stargate-settings-label"
  oscLabel.textContent = "Oscilloscope"
  const oscBtn = document.createElement("button")
  oscBtn.className = "stargate-settings-toggle" + (oscVisible ? " stargate-settings-toggle--active" : "")
  oscBtn.textContent = oscVisible ? "ON" : "OFF"
  oscBtn.addEventListener("click", () => {
    oscVisible = !oscVisible
    oscBtn.classList.toggle("stargate-settings-toggle--active", oscVisible)
    oscBtn.textContent = oscVisible ? "ON" : "OFF"
    toggleOscCb?.(oscVisible)
  })
  oscRow.appendChild(oscLabel)
  oscRow.appendChild(oscBtn)
  dropdown.appendChild(oscRow)

  // Waveform toggle row
  const waveRow = document.createElement("div")
  waveRow.className = "stargate-settings-row"
  const waveLabel = document.createElement("span")
  waveLabel.className = "stargate-settings-label"
  waveLabel.textContent = "Waveform"
  const waveBtn = document.createElement("button")
  waveBtn.className = "stargate-settings-toggle" + (waveVisible ? " stargate-settings-toggle--active" : "")
  waveBtn.textContent = waveVisible ? "ON" : "OFF"
  waveBtn.addEventListener("click", () => {
    waveVisible = !waveVisible
    waveBtn.classList.toggle("stargate-settings-toggle--active", waveVisible)
    waveBtn.textContent = waveVisible ? "ON" : "OFF"
    toggleWaveCb?.(waveVisible)
  })
  waveRow.appendChild(waveLabel)
  waveRow.appendChild(waveBtn)
  dropdown.appendChild(waveRow)

  // Language row
  const langRow = document.createElement("div")
  langRow.className = "stargate-settings-row"
  const langLabel = document.createElement("span")
  langLabel.className = "stargate-settings-label"
  langLabel.textContent = "Language"
  const langSelect = document.createElement("select")
  langSelect.className = "stargate-settings-lang-select"
  langSelect.addEventListener("change", () => {
    langCb?.(langSelect.value)
  })
  langRow.appendChild(langLabel)
  langRow.appendChild(langSelect)
  dropdown.appendChild(langRow)

  // Divider
  const divider = document.createElement("div")
  divider.className = "stargate-settings-divider"
  dropdown.appendChild(divider)

  // Exit button
  const exitBtn = document.createElement("button")
  exitBtn.className = "stargate-settings-exit"
  exitBtn.textContent = "Exit"
  exitBtn.addEventListener("click", () => {
    onBeforeClose?.()
    window.dispatchEvent(new Event("corpan:exit"))
  })
  dropdown.appendChild(exitBtn)

  // Future: "Find more books"

  // --- Open/close logic ---
  function open() {
    isOpen = true
    dropdown.classList.add("stargate-settings-dropdown--open")
    document.addEventListener("pointerdown", onOutsideClick, true)
  }

  function close() {
    isOpen = false
    dropdown.classList.remove("stargate-settings-dropdown--open")
    document.removeEventListener("pointerdown", onOutsideClick, true)
  }

  function onOutsideClick(e: PointerEvent) {
    const target = e.target as Node
    if (!dropdown.contains(target) && target !== gearBtn && !gearBtn.contains(target)) {
      close()
    }
  }

  gearBtn.addEventListener("click", () => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  })

  return {
    setLanguages(languages: string[], current: string) {
      langSelect.innerHTML = ""
      for (const lang of languages) {
        const opt = document.createElement("option")
        opt.value = lang
        opt.textContent = lang.toUpperCase()
        if (lang === current) opt.selected = true
        langSelect.appendChild(opt)
      }
      // Hide row when only 1 language
      langRow.style.display = languages.length <= 1 ? "none" : ""
    },

    onToggleOscilloscope(cb: (visible: boolean) => void) { toggleOscCb = cb },
    onToggleWaveform(cb: (visible: boolean) => void) { toggleWaveCb = cb },
    onLanguageChange(cb: (lang: string) => void) { langCb = cb },

    dispose() {
      close()
      gearBtn.remove()
      dropdown.remove()
    },
  }
}
