// The material palette.
//
// Ancient-futurist, and specifically *not* the failure modes on the hostile
// reference board in `docs/EXPERIENCE_DESIGN.md`: no purple-to-teal gradient, no
// glassmorphism, no neon. Colour here is what a material is, not what a light
// is doing to it — cast iron, brass, canvas, lapis night, and metal at four
// temperatures on its way down from white heat.
//
// The foundry is a night market with a ring in the middle of it. The crowd is
// lantern light at distance; the ring is the only thing lit properly.

export const NIGHT = "#0b0a10"
export const NIGHT_HIGH = "#141223"
export const LAPIS = "#1b2a55"
export const LAPIS_DEEP = "#101a38"

export const IRON = "#2b2b33"
export const IRON_EDGE = "#4a4a56"
export const IRON_DARK = "#17171d"

export const BRASS = "#c9973f"
export const BRASS_HI = "#f0cf85"
export const BRASS_DARK = "#7a5a22"

export const CANVAS = "#c8bda6"
export const CANVAS_DARK = "#8d846f"
export const CANVAS_SHADOW = "#5d5748"

/** Metal cooling: white → yellow → orange → dull red → gone. */
export const HEAT_WHITE = "#fff6e2"
export const HEAT_YELLOW = "#ffcb54"
export const HEAT_ORANGE = "#ff7a1f"
export const HEAT_RED = "#a32410"

export const CROWD_LANTERN = "#ffb457"
export const CROWD_DIM = "#3a2a1c"

export const REF_CLOTH = "#e8e2d6"
export const REF_STRIPE = "#1a1a1f"

/** The one cold colour in the building: the escape. */
export const KICKOUT = "#7fe3ff"
export const KICKOUT_DEEP = "#1d6f8f"

/** A refused total. Oxide, not a red alert light. */
export const OXIDE = "#8c3a24"

export const INK = "#0a0910"
export const CHALK = "#efe7d6"

export const UI_FONT =
  '600 16px/1 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'

/** A stamped numeral: condensed, heavy, unambiguous at 320px on a moving pedal. */
export function stamp(px: number, weight = 800): string {
  return `${weight} ${px}px/1 "Avenir Next Condensed", "Helvetica Neue", Impact, system-ui, sans-serif`
}

export function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "")
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`
}

/** Mix two hex colours. `t` 0 → `from`, 1 → `to`. */
export function mix(from: string, to: string, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const pa = from.replace("#", "")
  const pb = to.replace("#", "")
  const r = Math.round(
    Number.parseInt(pa.slice(0, 2), 16) * (1 - k) + Number.parseInt(pb.slice(0, 2), 16) * k,
  )
  const g = Math.round(
    Number.parseInt(pa.slice(2, 4), 16) * (1 - k) + Number.parseInt(pb.slice(2, 4), 16) * k,
  )
  const b = Math.round(
    Number.parseInt(pa.slice(4, 6), 16) * (1 - k) + Number.parseInt(pb.slice(4, 6), 16) * k,
  )
  return `rgb(${r},${g},${b})`
}

/**
 * The colour of metal at temperature `t`, 1 being just-poured and 0 being cold.
 *
 * Used by the canvas decals, which is where the design canon's "glow-decal
 * cooling" lives: every escape scorches the canvas, and that scorch cools
 * through this ramp over the next several seconds instead of being erased. A
 * child can read how many falls they have taken off a challenger by how much of
 * the mat is still warm.
 */
export function heatColor(t: number): string {
  const k = Math.max(0, Math.min(1, t))
  if (k > 0.72) return mix(HEAT_YELLOW, HEAT_WHITE, (k - 0.72) / 0.28)
  if (k > 0.4) return mix(HEAT_ORANGE, HEAT_YELLOW, (k - 0.4) / 0.32)
  return mix(HEAT_RED, HEAT_ORANGE, k / 0.4)
}
