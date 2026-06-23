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

/**
 * Map-shaped skeleton: a full-bleed gray panel with a subtle shimmer and
 * an animated globe glyph centered in it. Used while the global map's
 * station list and leaflet bundle are loading. Drops the row-shaped
 * skeleton's "artwork + 2 lines" pattern that doesn't fit a map view.
 */
export function createMapSkeleton(label: string = "Loading the world map…"): HTMLElement {
  const wrap = el("div", { class: "wr-map-skeleton", "aria-busy": "true" })
  // Inline SVG globe — meridians + equator + a couple of land hints. Strokes
  // are picked up by the CSS so dark mode swaps colors automatically.
  const globe = el("div", {
    class: "wr-map-skeleton-globe",
    html: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="28" class="wr-globe-disc" />
        <ellipse cx="32" cy="32" rx="28" ry="11" class="wr-globe-line" />
        <ellipse cx="32" cy="32" rx="11" ry="28" class="wr-globe-line" />
        <ellipse cx="32" cy="32" rx="22" ry="28" class="wr-globe-line" />
        <line x1="4" y1="32" x2="60" y2="32" class="wr-globe-line" />
      </svg>
    `,
  })
  wrap.appendChild(globe)
  wrap.appendChild(el("div", { class: "wr-map-skeleton-label" }, [label]))
  return wrap
}
