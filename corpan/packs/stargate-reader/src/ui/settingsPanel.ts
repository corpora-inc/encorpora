import type { OscilloscopeConfig, PulseRingConfig, WaveformConfig } from "../state/prefsStore"

export type LanguageInfo = { code: string; displayName: string; narrator: string }

export type SettingsPanel = {
  setLanguages: (languages: LanguageInfo[], current: string) => void
  onToggleOscilloscope: (cb: (visible: boolean) => void) => void
  onToggleWaveform: (cb: (visible: boolean) => void) => void
  onTogglePulseRing: (cb: (visible: boolean) => void) => void
  onOscilloscopeConfig: (cb: (key: string, value: number) => void) => void
  onWaveformConfig: (cb: (key: string, value: number) => void) => void
  onPulseRingConfig: (cb: (key: string, value: number) => void) => void
  onLanguageChange: (cb: (lang: string) => void) => void
  dispose: () => void
}

export type SettingsPanelOptions = {
  initialOscilloscope?: boolean
  initialWaveform?: boolean
  initialPulseRing?: boolean
  initialOscilloscopeConfig?: OscilloscopeConfig
  initialWaveformConfig?: WaveformConfig
  initialPulseRingConfig?: PulseRingConfig
  onBeforeClose?: () => void
}

type SliderDef = {
  key: string
  label: string
  min: number
  max: number
  step: number
  initial: number
}

function formatSliderValue(value: number, step: number): string {
  if (step >= 1) return String(Math.round(value))
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  return value.toFixed(decimals)
}

/**
 * Create a gear button (top-right) that opens a dropdown settings panel.
 * Contains oscilloscope/waveform/pulse ring toggles with advanced sliders,
 * language selector, and exit.
 */
export function createSettingsPanel(
  parent: HTMLElement,
  options?: SettingsPanelOptions
): SettingsPanel {
  const onBeforeClose = options?.onBeforeClose
  let langCb: ((lang: string) => void) | null = null
  let toggleOscCb: ((visible: boolean) => void) | null = null
  let toggleWaveCb: ((visible: boolean) => void) | null = null
  let togglePulseCb: ((visible: boolean) => void) | null = null
  let oscConfigCb: ((key: string, value: number) => void) | null = null
  let waveConfigCb: ((key: string, value: number) => void) | null = null
  let pulseConfigCb: ((key: string, value: number) => void) | null = null
  let oscVisible = options?.initialOscilloscope ?? true
  let waveVisible = options?.initialWaveform ?? true
  let pulseVisible = options?.initialPulseRing ?? true
  let isOpen = false

  /**
   * Helper: create an "Advanced" collapsible section with sliders + Reset.
   */
  function createAdvancedSection(
    parentEl: HTMLElement,
    sliderDefs: SliderDef[],
    currentValues: Record<string, number>,
    onChange: (key: string, value: number) => void,
  ) {
    const wrapper = document.createElement("div")
    wrapper.className = "stargate-settings-advanced"

    const advBtn = document.createElement("button")
    advBtn.className = "stargate-settings-advanced-btn"
    advBtn.textContent = "Advanced \u25B8"
    wrapper.appendChild(advBtn)

    const slidersDiv = document.createElement("div")
    slidersDiv.className = "stargate-settings-sliders"
    wrapper.appendChild(slidersDiv)

    const inputs: { def: SliderDef; input: HTMLInputElement; valueEl: HTMLSpanElement }[] = []

    for (const def of sliderDefs) {
      const row = document.createElement("div")
      row.className = "stargate-settings-slider-row"

      const label = document.createElement("span")
      label.className = "stargate-settings-slider-label"
      label.textContent = def.label

      const input = document.createElement("input")
      input.type = "range"
      input.className = "stargate-settings-slider"
      input.min = String(def.min)
      input.max = String(def.max)
      input.step = String(def.step)
      const currentVal = currentValues[def.key] ?? def.initial
      input.value = String(currentVal)

      const valueEl = document.createElement("span")
      valueEl.className = "stargate-settings-slider-value"
      valueEl.textContent = formatSliderValue(currentVal, def.step)

      input.addEventListener("input", () => {
        const v = parseFloat(input.value)
        valueEl.textContent = formatSliderValue(v, def.step)
        onChange(def.key, v)
      })

      row.appendChild(label)
      row.appendChild(input)
      row.appendChild(valueEl)
      slidersDiv.appendChild(row)

      inputs.push({ def, input, valueEl })
    }

    // Reset button
    const resetBtn = document.createElement("button")
    resetBtn.className = "stargate-settings-reset-btn"
    resetBtn.textContent = "Reset"
    resetBtn.addEventListener("click", () => {
      for (const { def, input, valueEl } of inputs) {
        input.value = String(def.initial)
        valueEl.textContent = formatSliderValue(def.initial, def.step)
        onChange(def.key, def.initial)
      }
    })
    slidersDiv.appendChild(resetBtn)

    // Toggle open/close
    let expanded = false
    advBtn.addEventListener("click", () => {
      expanded = !expanded
      slidersDiv.classList.toggle("stargate-settings-sliders--open", expanded)
      advBtn.textContent = expanded ? "Advanced \u25BE" : "Advanced \u25B8"
    })

    parentEl.appendChild(wrapper)
  }

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

  // 1. Dismiss button row (block-level, right-aligned — hidden on desktop via CSS)
  const dismissRow = document.createElement("div")
  dismissRow.className = "stargate-settings-dismiss-row"
  const dismissBtn = document.createElement("button")
  dismissBtn.className = "stargate-settings-dismiss"
  dismissBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  dismissBtn.addEventListener("click", close)
  dismissRow.appendChild(dismissBtn)
  dropdown.appendChild(dismissRow)

  // 2. Language select (full width, no label — self-documenting with "English – Ian")
  const langSelect = document.createElement("select")
  langSelect.className = "stargate-settings-lang-select"
  langSelect.addEventListener("change", () => {
    langCb?.(langSelect.value)
  })
  dropdown.appendChild(langSelect)

  // Divider before toggles
  const divider1 = document.createElement("div")
  divider1.className = "stargate-settings-divider"
  dropdown.appendChild(divider1)

  // --- Oscilloscope toggle row ---
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

  // Oscilloscope advanced sliders
  const oscConfig = options?.initialOscilloscopeConfig ?? { amplitude: 5, width: 12, alpha: 0.35 }
  createAdvancedSection(
    dropdown,
    [
      { key: "amplitude", label: "Swing", min: 1, max: 20, step: 1, initial: 5 },
      { key: "width", label: "Width", min: 1, max: 12, step: 1, initial: 12 },
      { key: "alpha", label: "Opacity", min: 0.05, max: 1.0, step: 0.05, initial: 0.35 },
    ],
    oscConfig as Record<string, number>,
    (key, value) => { oscConfigCb?.(key, value) },
  )

  // --- Waveform toggle row ---
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

  // Waveform advanced sliders
  const waveConfig = options?.initialWaveformConfig ?? { maxRadius: 1, alpha: 0.005, minRadius: 0 }
  createAdvancedSection(
    dropdown,
    [
      { key: "maxRadius", label: "Peak Size", min: 0.1, max: 2, step: 0.1, initial: 1 },
      { key: "alpha", label: "Opacity", min: 0.001, max: 0.05, step: 0.001, initial: 0.005 },
      { key: "minRadius", label: "Base Size", min: 0, max: 1, step: 0.05, initial: 0 },
    ],
    waveConfig as Record<string, number>,
    (key, value) => { waveConfigCb?.(key, value) },
  )

  // --- Pulse Ring toggle row ---
  const pulseRow = document.createElement("div")
  pulseRow.className = "stargate-settings-row"
  const pulseLabel = document.createElement("span")
  pulseLabel.className = "stargate-settings-label"
  pulseLabel.textContent = "Pulse Ring"
  const pulseBtn = document.createElement("button")
  pulseBtn.className = "stargate-settings-toggle" + (pulseVisible ? " stargate-settings-toggle--active" : "")
  pulseBtn.textContent = pulseVisible ? "ON" : "OFF"
  pulseBtn.addEventListener("click", () => {
    pulseVisible = !pulseVisible
    pulseBtn.classList.toggle("stargate-settings-toggle--active", pulseVisible)
    pulseBtn.textContent = pulseVisible ? "ON" : "OFF"
    togglePulseCb?.(pulseVisible)
  })
  pulseRow.appendChild(pulseLabel)
  pulseRow.appendChild(pulseBtn)
  dropdown.appendChild(pulseRow)

  // Pulse Ring advanced sliders
  const pulseConfig = options?.initialPulseRingConfig ?? { maxRadius: 1, fadeMs: 200 }
  createAdvancedSection(
    dropdown,
    [
      { key: "maxRadius", label: "Ring Size", min: 0.1, max: 1, step: 0.1, initial: 0.5 },
      { key: "fadeMs", label: "Trail", min: 50, max: 2000, step: 50, initial: 200 },
    ],
    pulseConfig as Record<string, number>,
    (key, value) => { pulseConfigCb?.(key, value) },
  )

  // Divider before exit
  const divider2 = document.createElement("div")
  divider2.className = "stargate-settings-divider"
  dropdown.appendChild(divider2)

  // Exit button
  const exitBtn = document.createElement("button")
  exitBtn.className = "stargate-settings-exit"
  exitBtn.textContent = "Exit"
  exitBtn.addEventListener("click", () => {
    onBeforeClose?.()
    window.dispatchEvent(new Event("corpan:exit"))
  })
  dropdown.appendChild(exitBtn)

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
      // Hide select when only 1 language
      langSelect.style.display = languages.length <= 1 ? "none" : ""
      divider1.style.display = languages.length <= 1 ? "none" : ""
    },

    onToggleOscilloscope(cb: (visible: boolean) => void) { toggleOscCb = cb },
    onToggleWaveform(cb: (visible: boolean) => void) { toggleWaveCb = cb },
    onTogglePulseRing(cb: (visible: boolean) => void) { togglePulseCb = cb },
    onOscilloscopeConfig(cb: (key: string, value: number) => void) { oscConfigCb = cb },
    onWaveformConfig(cb: (key: string, value: number) => void) { waveConfigCb = cb },
    onPulseRingConfig(cb: (key: string, value: number) => void) { pulseConfigCb = cb },
    onLanguageChange(cb: (lang: string) => void) { langCb = cb },

    dispose() {
      close()
      gearBtn.remove()
      dropdown.remove()
    },
  }
}
