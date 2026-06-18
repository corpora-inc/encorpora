/**
 * Station artwork — favicon with a deterministic gradient-letter fallback.
 *
 * Many stations have favicons; many don't, and many that do are HTTP-only
 * (browser blocks mixed content). We always show *something*: the favicon if
 * it loads, otherwise a colored avatar derived from the station UUID so the
 * same station looks identical every time.
 */

import { el } from "./dom"

export type StationArtInput = {
  stationuuid: string
  name: string
  favicon: string
}

/** Hash a string to an integer in [0, 360) for HSL hue. */
function hueFromUuid(uuid: string): number {
  let h = 0
  for (let i = 0; i < uuid.length; i += 1) {
    h = (h * 31 + uuid.charCodeAt(i)) >>> 0
  }
  return h % 360
}

function firstLetter(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "•"
  // Use codePointAt to handle emoji/extended chars cleanly, then uppercase.
  const cp = trimmed.codePointAt(0)
  if (cp === undefined) return "•"
  return String.fromCodePoint(cp).toUpperCase()
}

export function createStationArt(
  station: StationArtInput,
  sizePx: number,
  opts: { loadRemote?: boolean } = {}
): HTMLElement {
  const root = el("div", {
    class: "wr-art",
    style: `width:${sizePx}px;height:${sizePx}px`,
    "data-uuid": station.stationuuid,
  })

  const hue = hueFromUuid(station.stationuuid || station.name)
  const fallback = el("div", {
    class: "wr-art-fallback",
    style: `background: linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue + 40) % 360} 70% 40%));`,
    "aria-hidden": "true",
  })
  fallback.textContent = firstLetter(station.name)
  root.appendChild(fallback)

  if (opts.loadRemote !== false && station.favicon) {
    const img = el("img", {
      class: "wr-art-img",
      src: station.favicon,
      alt: "",
      loading: "lazy",
      decoding: "async",
      referrerpolicy: "no-referrer",
    }) as HTMLImageElement
    img.addEventListener("load", () => {
      img.classList.add("is-loaded")
    })
    img.addEventListener("error", () => {
      img.remove()
    })
    root.appendChild(img)
  }

  return root
}
