/**
 * Settings row primitives for pack drawers.
 *
 * Shared by stargate-reader, hover-runner, and any future pack that
 * injects custom sections into the command drawer via
 * `DrawerSectionDef`. Class names keep the `stargate-settings-`
 * prefix for historical reasons; the styles live in
 * `settingsRows.css` and are imported here as a side effect.
 */

import "./settingsRows.css"

// ---------- Toggle row ----------

export type ToggleRowOpts = {
  label: string
  initial: boolean
  onChange: (next: boolean) => void
  /** Extra controls injected between the label and the toggle (e.g. a direction arrow). */
  extraControls?: HTMLElement[]
  onText?: string
  offText?: string
}

export type ToggleRow = {
  row: HTMLElement
  toggle: HTMLButtonElement
  labelEl: HTMLSpanElement
  setValue: (next: boolean) => void
  getValue: () => boolean
  /** Update the label text in place (e.g. after a language change). */
  setLabel: (next: string) => void
}

export function createToggleRow(opts: ToggleRowOpts): ToggleRow {
  const row = document.createElement("div")
  row.className = "stargate-settings-row"

  const labelEl = document.createElement("span")
  labelEl.className = "stargate-settings-label"
  labelEl.textContent = opts.label
  row.appendChild(labelEl)

  if (opts.extraControls) {
    for (const el of opts.extraControls) row.appendChild(el)
  }

  let value = opts.initial
  const onText = opts.onText ?? "ON"
  const offText = opts.offText ?? "OFF"

  const toggle = document.createElement("button")
  toggle.className =
    "stargate-settings-toggle" + (value ? " stargate-settings-toggle--active" : "")
  toggle.textContent = value ? onText : offText
  toggle.addEventListener("click", () => {
    value = !value
    toggle.classList.toggle("stargate-settings-toggle--active", value)
    toggle.textContent = value ? onText : offText
    opts.onChange(value)
  })
  row.appendChild(toggle)

  return {
    row,
    toggle,
    labelEl,
    setValue: (next: boolean) => {
      if (next === value) return
      value = next
      toggle.classList.toggle("stargate-settings-toggle--active", value)
      toggle.textContent = value ? onText : offText
    },
    getValue: () => value,
    setLabel: (next: string) => {
      labelEl.textContent = next
    },
  }
}

// ---------- Advanced collapsible ----------

export type SliderDef = {
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

export type AdvancedSectionOpts = {
  sliders: SliderDef[]
  currentValues?: Record<string, number>
  onChange: (key: string, value: number) => void
  /** Label for the toggle button. Defaults to "Advanced". */
  toggleLabel?: string
  /** Reset button label. Pass `null` to omit. Defaults to "Reset". */
  resetLabel?: string | null
  initiallyExpanded?: boolean
}

export type AdvancedSection = {
  wrapper: HTMLElement
  setExpanded: (expanded: boolean) => void
  /** Re-sync every slider's UI to a fresh `{key: value}` map. */
  syncValues: (next: Record<string, number>) => void
}

export function createAdvancedSection(
  parent: HTMLElement,
  opts: AdvancedSectionOpts,
): AdvancedSection {
  const wrapper = document.createElement("div")
  wrapper.className = "stargate-settings-advanced"

  const toggleLabel = opts.toggleLabel ?? "Advanced"
  const advBtn = document.createElement("button")
  advBtn.className = "stargate-settings-advanced-btn"
  wrapper.appendChild(advBtn)

  const slidersDiv = document.createElement("div")
  slidersDiv.className = "stargate-settings-sliders"
  wrapper.appendChild(slidersDiv)

  const inputs: {
    def: SliderDef
    input: HTMLInputElement
    valueEl: HTMLSpanElement
  }[] = []
  const current = opts.currentValues ?? {}

  for (const def of opts.sliders) {
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
    const currentVal = current[def.key] ?? def.initial
    input.value = String(currentVal)

    const valueEl = document.createElement("span")
    valueEl.className = "stargate-settings-slider-value"
    valueEl.textContent = formatSliderValue(currentVal, def.step)

    input.addEventListener("input", () => {
      const v = parseFloat(input.value)
      valueEl.textContent = formatSliderValue(v, def.step)
      opts.onChange(def.key, v)
    })

    row.appendChild(label)
    row.appendChild(input)
    row.appendChild(valueEl)
    slidersDiv.appendChild(row)

    inputs.push({ def, input, valueEl })
  }

  if (opts.resetLabel !== null) {
    const resetBtn = document.createElement("button")
    resetBtn.className = "stargate-settings-reset-btn"
    resetBtn.textContent = opts.resetLabel ?? "Reset"
    resetBtn.addEventListener("click", () => {
      for (const { def, input, valueEl } of inputs) {
        input.value = String(def.initial)
        valueEl.textContent = formatSliderValue(def.initial, def.step)
        opts.onChange(def.key, def.initial)
      }
    })
    slidersDiv.appendChild(resetBtn)
  }

  let expanded = opts.initiallyExpanded ?? false
  function setExpanded(next: boolean) {
    expanded = next
    slidersDiv.classList.toggle("stargate-settings-sliders--open", expanded)
    advBtn.textContent = expanded ? `${toggleLabel} ▾` : `${toggleLabel} ▸`
  }
  setExpanded(expanded)

  advBtn.addEventListener("click", () => setExpanded(!expanded))

  function syncValues(next: Record<string, number>) {
    for (const { def, input, valueEl } of inputs) {
      const v = next[def.key] ?? def.initial
      input.value = String(v)
      valueEl.textContent = formatSliderValue(v, def.step)
    }
  }

  parent.appendChild(wrapper)
  return { wrapper, setExpanded, syncValues }
}
