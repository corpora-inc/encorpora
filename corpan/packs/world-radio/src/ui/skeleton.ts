import { el } from "./dom"

export function createSkeletonRows(count: number): HTMLElement {
  const wrap = el("div", { "aria-hidden": "true" })
  for (let i = 0; i < count; i += 1) {
    const row = el("div", { class: "wr-skeleton-row" })
    row.appendChild(el("div", { class: "wr-skeleton-art" }))
    const lines = el("div", { class: "wr-skeleton-lines" })
    lines.appendChild(el("div", { class: "wr-skeleton-line medium" }))
    lines.appendChild(el("div", { class: "wr-skeleton-line short" }))
    row.appendChild(lines)
    wrap.appendChild(row)
  }
  return wrap
}
