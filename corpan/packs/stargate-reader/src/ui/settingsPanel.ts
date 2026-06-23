import { createAdvancedSection, createToggleRow } from "@shared/ui"

// Stargate-specific display config types (kept local, not in shared)
export type OscilloscopeConfig = { amplitude: number; width: number; alpha: number }
export type WaveformConfig = { maxRadius: number; alpha: number; minRadius: number; reversed: boolean }
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

/**
 * Render stargate display settings (toggles + sliders) into a container.
 * Used as a custom section in the command drawer.
 */
export function renderStargateDisplaySettings(
  container: HTMLElement,
  options: DisplaySettingsOptions,
): void {
  const cbs = options.callbacks

  // --- Oscilloscope toggle + advanced ---
  const oscRow = createToggleRow({
    label: "Oscilloscope",
    initial: options.initialOscilloscope ?? true,
    onChange: cbs.onToggleOscilloscope,
  })
  container.appendChild(oscRow.row)

  const oscConfig = options.initialOscilloscopeConfig ?? { amplitude: 5, width: 2, alpha: 0.35 }
  createAdvancedSection(container, {
    sliders: [
      { key: "amplitude", label: "Swing", min: 1, max: 20, step: 1, initial: 5 },
      { key: "width", label: "Width", min: 1, max: 12, step: 1, initial: 2 },
      { key: "alpha", label: "Opacity", min: 0.05, max: 1.0, step: 0.05, initial: 0.35 },
    ],
    currentValues: oscConfig as Record<string, number>,
    onChange: (key, value) => cbs.onOscilloscopeConfig(key, value),
  })

  // --- Waveform toggle row (with direction button) + advanced ---
  const waveConfig = options.initialWaveformConfig ?? { maxRadius: 1, alpha: 0.005, minRadius: 0, reversed: false }
  let waveReversed = waveConfig.reversed ?? false

  const waveDirBtn = document.createElement("button")
  waveDirBtn.className = "stargate-settings-toggle" + (waveReversed ? " stargate-settings-toggle--active" : "")
  waveDirBtn.textContent = waveReversed ? "←" : "→"
  waveDirBtn.title = waveReversed ? "Reversed" : "Forward"
  waveDirBtn.addEventListener("click", () => {
    waveReversed = !waveReversed
    waveDirBtn.classList.toggle("stargate-settings-toggle--active", waveReversed)
    waveDirBtn.textContent = waveReversed ? "←" : "→"
    waveDirBtn.title = waveReversed ? "Reversed" : "Forward"
    cbs.onWaveformConfig("reversed", waveReversed ? 1 : 0)
  })

  const waveRow = createToggleRow({
    label: "Waveform",
    initial: options.initialWaveform ?? true,
    onChange: cbs.onToggleWaveform,
    extraControls: [waveDirBtn],
  })
  container.appendChild(waveRow.row)

  createAdvancedSection(container, {
    sliders: [
      { key: "maxRadius", label: "Peak Size", min: 0.1, max: 2, step: 0.1, initial: 1 },
      { key: "alpha", label: "Opacity", min: 0.001, max: 0.05, step: 0.001, initial: 0.005 },
      { key: "minRadius", label: "Base Size", min: 0, max: 1, step: 0.05, initial: 0 },
    ],
    currentValues: waveConfig as unknown as Record<string, number>,
    onChange: (key, value) => cbs.onWaveformConfig(key, value),
  })

  // --- Pulse Ring ---
  const pulseRow = createToggleRow({
    label: "Pulse Ring",
    initial: options.initialPulseRing ?? true,
    onChange: cbs.onTogglePulseRing,
  })
  container.appendChild(pulseRow.row)

  const pulseConfig = options.initialPulseRingConfig ?? { maxRadius: 0.2, fadeMs: 200 }
  createAdvancedSection(container, {
    sliders: [
      { key: "maxRadius", label: "Ring Size", min: 0.05, max: 0.5, step: 0.05, initial: 0.2 },
      { key: "fadeMs", label: "Trail", min: 50, max: 2000, step: 50, initial: 200 },
    ],
    currentValues: pulseConfig as Record<string, number>,
    onChange: (key, value) => cbs.onPulseRingConfig(key, value),
  })

  // --- Word Hold ---
  const holdRow = createToggleRow({
    label: "Word Hold",
    initial: options.initialWordHold ?? true,
    onChange: cbs.onToggleWordHold,
  })
  container.appendChild(holdRow.row)

  const wordHoldConfig = options.initialWordHoldConfig ?? { holdY: 0, zPull: 1.5 }
  createAdvancedSection(container, {
    sliders: [
      { key: "holdY", label: "Height", min: -0.2, max: 0.2, step: 0.02, initial: 0 },
      { key: "zPull", label: "Depth", min: 0, max: 2, step: 0.1, initial: 1.5 },
    ],
    currentValues: wordHoldConfig as Record<string, number>,
    onChange: (key, value) => cbs.onWordHoldConfig(key, value),
  })
}
