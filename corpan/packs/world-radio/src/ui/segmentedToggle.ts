import { el } from "./dom"

export type SegmentOption<T extends string> = {
  value: T
  label: string
  icon: string // inline SVG markup
}

export type SegmentedToggle<T extends string> = {
  root: HTMLElement
  setValue: (value: T) => void
  getValue: () => T
}

export function createSegmentedToggle<T extends string>(opts: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
}): SegmentedToggle<T> {
  const root = el("div", { class: "wr-segmented", role: "tablist" })
  let current = opts.value
  const buttons: { value: T; el: HTMLButtonElement }[] = []

  for (const opt of opts.options) {
    const btn = el("button", {
      class: "wr-segmented-btn",
      type: "button",
      role: "tab",
      "aria-pressed": opt.value === current ? "true" : "false",
      "aria-label": opt.label,
      title: opt.label,
      html: opt.icon,
    }) as HTMLButtonElement
    btn.addEventListener("click", () => {
      if (current === opt.value) return
      current = opt.value
      for (const b of buttons) {
        b.el.setAttribute("aria-pressed", b.value === current ? "true" : "false")
      }
      opts.onChange(current)
    })
    root.appendChild(btn)
    buttons.push({ value: opt.value, el: btn })
  }

  return {
    root,
    setValue(value: T) {
      if (current === value) return
      current = value
      for (const b of buttons) {
        b.el.setAttribute("aria-pressed", b.value === current ? "true" : "false")
      }
    },
    getValue: () => current,
  }
}
