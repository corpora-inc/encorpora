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

/**
 * A colour string, as three 0..255 channels.
 *
 * **This is the reason THE GRAPPLE FOUNDRY went blank on the first kick-out.**
 *
 * `withAlpha` and `mix` used to assume `#rrggbb` and slice the string by index.
 * `heatColor` returns whatever `mix` returns, so `withAlpha(heatColor(t), a)` fed
 * `"rgb(255,246,226)"` into a hex parser: it stripped a `#` that was not there,
 * read `"rg"` as base 16, and produced `"rgba(NaN,11,37,0.3)"`. Six call sites
 * across `ring.ts`, `hud.ts`, `particles.ts` and `decals.ts` composed the two
 * that way.
 *
 * Assigning an unparseable colour to `fillStyle` is *silently ignored* by the
 * canvas — the mark comes out in whatever colour was set before it — so five of
 * those six sites merely drew the wrong colour and nothing failed anywhere. The
 * sixth handed the same string to `CanvasGradient.addColorStop`, which is
 * specified to **throw** a `SyntaxError`. That call is the scorch glow in
 * `decals.ts`, a scorch is laid down only by an escape, and it is drawn inside
 * `drawMat` — before the wrestlers, the referee, the near ropes and the whole
 * HUD. `frame()` re-arms its `requestAnimationFrame` on its first line, so the
 * loop kept running and kept throwing at the same place: every frame cleared the
 * canvas, painted the crowd, the far posts and the mat, and stopped. The audio
 * graph is not on the frame loop, so the hall kept roaring over a half-drawn
 * ring for the twelve seconds a scorch takes to cool.
 *
 * So the parser now understands every form these two functions can be handed —
 * `#rgb`, `#rrggbb`, `rgb()` and `rgba()` — and `mix` returns hex, which keeps
 * the composition closed. Anything it still cannot read is reported loudly and
 * comes back as a visible colour rather than as `NaN`: a wrong colour is a bug
 * to fix on Monday, and a `NaN` in a gradient stop is a black screen in front of
 * a child.
 */
function channels(color: string): [number, number, number] {
  const s = color.trim()
  if (s.startsWith("#")) {
    const h = s.slice(1)
    if (h.length === 3) {
      // `#abc` is `#aabbcc`: each digit doubled.
      const r = Number.parseInt(h.slice(0, 1).repeat(2), 16)
      const g = Number.parseInt(h.slice(1, 2).repeat(2), 16)
      const b = Number.parseInt(h.slice(2, 3).repeat(2), 16)
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b]
    } else if (h.length >= 6) {
      const r = Number.parseInt(h.slice(0, 2), 16)
      const g = Number.parseInt(h.slice(2, 4), 16)
      const b = Number.parseInt(h.slice(4, 6), 16)
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b]
    }
    return unreadable(color)
  }
  const open = s.indexOf("(")
  if ((s.startsWith("rgb(") || s.startsWith("rgba(")) && s.endsWith(")")) {
    const parts = s.slice(open + 1, -1).split(",")
    const r = Number.parseFloat(parts[0] ?? "")
    const g = Number.parseFloat(parts[1] ?? "")
    const b = Number.parseFloat(parts[2] ?? "")
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return [Math.round(r), Math.round(g), Math.round(b)]
    }
  }
  return unreadable(color)
}

/** Colours already complained about, so a bad one costs one line and not sixty a second. */
const complained = new Set<string>()

function unreadable(color: string): [number, number, number] {
  if (!complained.has(color)) {
    complained.add(color)
    console.error(`[foundry] unreadable colour ${JSON.stringify(color)} — drawn as grey`)
  }
  return [128, 128, 128]
}

/**
 * A channel, forced into 0..255.
 *
 * `rgba(300,-5,12,1)` is a string a canvas rejects, and a rejected colour inside
 * a gradient stop is a thrown exception in the frame loop. So the range is closed
 * here rather than trusted at every call site.
 */
function clamp8(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

/** A 0..255 channel as two hex digits. */
function hex2(n: number): string {
  return clamp8(n).toString(16).padStart(2, "0")
}

export function withAlpha(color: string, a: number): string {
  const [r, g, b] = channels(color).map(clamp8) as [number, number, number]
  const alpha = Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Mix two colours. `t` 0 → `from`, 1 → `to`.
 *
 * Returns `#rrggbb` rather than `rgb()` so that the result can be handed back to
 * `withAlpha` or to `mix` again. `heatColor` is `mix`, and every use of it in the
 * game composes, so the output form is load-bearing rather than cosmetic.
 */
export function mix(from: string, to: string, t: number): string {
  const k = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0
  const [ra, ga, ba] = channels(from)
  const [rb, gb, bb] = channels(to)
  return `#${hex2(ra * (1 - k) + rb * k)}${hex2(ga * (1 - k) + gb * k)}${hex2(ba * (1 - k) + bb * k)}`
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
