// Stargate-specific display config types (kept local, not in shared)
export type OscilloscopeConfig = { amplitude: number; width: number; alpha: number }
export type WaveformConfig = { maxRadius: number; alpha: number; minRadius: number }
export type PulseRingConfig = { maxRadius: number; fadeMs: number }
export type WordHoldConfig = { holdY: number; zPull: number }

export type LanguageInfo = { code: string; displayName: string; narrator: string }

export type DisplaySettingsCallbacks = {
  onToggleOscilloscope: (visible: boolean) => void
  onToggleWaveform: (visible: boolean) => void
  onTogglePulseRing: (visible: boolean) => void
  onToggleWordHold: (enabled: boolean) => void
  onWordHoldConfig: (key: string, value: number) => void
  onOscilloscopeConfig: (key: string, value: number) => void
  onWaveformConfig: (key: string, value: number) => void
  onPulseRingConfig: (key: string, value: number) => void
}

export type DisplaySettingsOptions = {
  initialOscilloscope?: boolean
  initialWaveform?: boolean
  initialPulseRing?: boolean
  initialWordHold?: boolean
  initialWordHoldConfig?: WordHoldConfig
  initialOscilloscopeConfig?: OscilloscopeConfig
  initialWaveformConfig?: WaveformConfig
  initialPulseRingConfig?: PulseRingConfig
  callbacks: DisplaySettingsCallbacks
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

/**
 * Render stargate display settings (toggles + sliders) into a container.
 * Used as a custom section in the command drawer.
 */
export function renderStargateDisplaySettings(
  container: HTMLElement,
  options: DisplaySettingsOptions
): void {
  const cbs = options.callbacks
  let oscVisible = options.initialOscilloscope ?? true
  let waveVisible = options.initialWaveform ?? true
  let pulseVisible = options.initialPulseRing ?? true
  let wordHoldEnabled = options.initialWordHold ?? true

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
    cbs.onToggleOscilloscope(oscVisible)
  })
  oscRow.appendChild(oscLabel)
  oscRow.appendChild(oscBtn)
  container.appendChild(oscRow)

  // Oscilloscope advanced sliders
  const oscConfig = options.initialOscilloscopeConfig ?? { amplitude: 5, width: 2, alpha: 0.35 }
  createAdvancedSection(
    container,
    [
      { key: "amplitude", label: "Swing", min: 1, max: 20, step: 1, initial: 5 },
      { key: "width", label: "Width", min: 1, max: 12, step: 1, initial: 2 },
      { key: "alpha", label: "Opacity", min: 0.05, max: 1.0, step: 0.05, initial: 0.35 },
    ],
    oscConfig as Record<string, number>,
    (key, value) => { cbs.onOscilloscopeConfig(key, value) },
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
    cbs.onToggleWaveform(waveVisible)
  })
  waveRow.appendChild(waveLabel)
  waveRow.appendChild(waveBtn)
  container.appendChild(waveRow)

  // Waveform advanced sliders
  const waveConfig = options.initialWaveformConfig ?? { maxRadius: 1, alpha: 0.005, minRadius: 0 }
  createAdvancedSection(
    container,
    [
      { key: "maxRadius", label: "Peak Size", min: 0.1, max: 2, step: 0.1, initial: 1 },
      { key: "alpha", label: "Opacity", min: 0.001, max: 0.05, step: 0.001, initial: 0.005 },
      { key: "minRadius", label: "Base Size", min: 0, max: 1, step: 0.05, initial: 0 },
    ],
    waveConfig as Record<string, number>,
    (key, value) => { cbs.onWaveformConfig(key, value) },
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
    cbs.onTogglePulseRing(pulseVisible)
  })
  pulseRow.appendChild(pulseLabel)
  pulseRow.appendChild(pulseBtn)
  container.appendChild(pulseRow)

  // Pulse Ring advanced sliders
  const pulseConfig = options.initialPulseRingConfig ?? { maxRadius: 0.2, fadeMs: 200 }
  createAdvancedSection(
    container,
    [
      { key: "maxRadius", label: "Ring Size", min: 0.05, max: 0.5, step: 0.05, initial: 0.2 },
      { key: "fadeMs", label: "Trail", min: 50, max: 2000, step: 50, initial: 200 },
    ],
    pulseConfig as Record<string, number>,
    (key, value) => { cbs.onPulseRingConfig(key, value) },
  )

  // --- Word Hold toggle row ---
  const holdRow = document.createElement("div")
  holdRow.className = "stargate-settings-row"
  const holdLabel = document.createElement("span")
  holdLabel.className = "stargate-settings-label"
  holdLabel.textContent = "Word Hold"
  const holdBtn = document.createElement("button")
  holdBtn.className = "stargate-settings-toggle" + (wordHoldEnabled ? " stargate-settings-toggle--active" : "")
  holdBtn.textContent = wordHoldEnabled ? "ON" : "OFF"
  holdBtn.addEventListener("click", () => {
    wordHoldEnabled = !wordHoldEnabled
    holdBtn.classList.toggle("stargate-settings-toggle--active", wordHoldEnabled)
    holdBtn.textContent = wordHoldEnabled ? "ON" : "OFF"
    cbs.onToggleWordHold(wordHoldEnabled)
  })
  holdRow.appendChild(holdLabel)
  holdRow.appendChild(holdBtn)
  container.appendChild(holdRow)

  // Word Hold advanced sliders
  const wordHoldConfig = options.initialWordHoldConfig ?? { holdY: 0, zPull: 0.4 }
  createAdvancedSection(
    container,
    [
      { key: "holdY", label: "Height", min: -0.2, max: 0.2, step: 0.02, initial: 0 },
      { key: "zPull", label: "Depth", min: 0, max: 2, step: 0.1, initial: 0.4 },
    ],
    wordHoldConfig as Record<string, number>,
    (key, value) => { cbs.onWordHoldConfig(key, value) },
  )
}
