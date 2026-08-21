/**
 * ABYSSAL BLOOM — the look.
 *
 * A hydrothermal reef in the dark. Not brass, not lapis, not an orrery. The
 * world starts as near-black water lit only by what you have grown, and every
 * order of magnitude you cross floods more light into it, so a twenty-minute
 * session is visibly the story of an abyss becoming a blazing garden. The
 * escalation is the art direction.
 *
 * Two legibility rules are load-bearing and are not negotiable for prettiness:
 *
 *  1. **Every polyp carries a dark lens at its centre** and its numeral is
 *     near-white on that lens. A child has under half a second to read a
 *     moving target; the numeral must never sit on the hue.
 *  2. **Strain is a silhouette, step is a hue.** Nothing is ever distinguished
 *     by colour alone.
 */

import { MAX_RANK } from '../core/ladder.ts'

export type Rgb = readonly [number, number, number]

/** The rank ramp. Cold at the bottom of the ladder, white-hot at the top. */
const RAMP: ReadonlyArray<readonly [number, Rgb]> = [
  [0, [23, 209, 232]], // cyan
  [4, [18, 227, 176]], // aqua
  [8, [79, 240, 92]], // green
  [12, [182, 245, 42]], // chartreuse
  [16, [255, 209, 46]], // gold
  [20, [255, 144, 32]], // amber
  [24, [255, 90, 60]], // coral
  [28, [255, 61, 139]], // rose
  [32, [214, 75, 255]], // violet
  [36, [142, 160, 255]], // periwinkle
  [42, [236, 246, 255]], // white-hot
  [MAX_RANK, [255, 255, 255]],
]

export function rampAt(r: number): Rgb {
  const x = Math.max(0, Math.min(MAX_RANK, r))
  for (let i = 0; i < RAMP.length - 1; i++) {
    const a = RAMP[i]
    const b = RAMP[i + 1]
    if (!a || !b) break
    if (x >= a[0] && x <= b[0]) {
      const span = b[0] - a[0] || 1
      const t = (x - a[0]) / span
      return [
        Math.round(a[1][0] + (b[1][0] - a[1][0]) * t),
        Math.round(a[1][1] + (b[1][1] - a[1][1]) * t),
        Math.round(a[1][2] + (b[1][2] - a[1][2]) * t),
      ]
    }
  }
  return RAMP[RAMP.length - 1]?.[1] ?? [255, 255, 255]
}

export function rgba(c: Rgb, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
}

export function hex(c: Rgb): string {
  const h = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const u = Math.max(0, Math.min(1, t))
  return [
    Math.round(a[0] + (b[0] - a[0]) * u),
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
  ]
}

export function lift(c: Rgb, amount: number): Rgb {
  return mix(c, [255, 255, 255], amount)
}

/* ---------------------------------------------------------------- the water */

/** Deep water, near black, warming as the reef blooms. */
export function waterDeep(bloom: number): Rgb {
  return mix([3, 5, 13], [22, 8, 34], bloom)
}

/** Water at the top of the frame, where the far-off surface light falls. */
export function waterHigh(bloom: number): Rgb {
  return mix([8, 20, 52], [74, 36, 118], bloom)
}

/** The shelf the polyps sit on. */
export function shelf(bloom: number): Rgb {
  return mix([9, 16, 34], [38, 22, 62], bloom)
}

export const INK: Rgb = [2, 3, 9]
export const LENS: Rgb = [6, 9, 20]
export const CHALK: Rgb = [238, 246, 255]
export const DANGER: Rgb = [255, 78, 92]
export const TIDE: Rgb = [120, 232, 255]

/** Named CSS custom properties so the DOM chrome and the canvas cannot drift. */
export function cssVars(bloom: number): Record<string, string> {
  return {
    '--ab-deep': hex(waterDeep(bloom)),
    '--ab-high': hex(waterHigh(bloom)),
    '--ab-shelf': hex(shelf(bloom)),
    '--ab-ink': hex(INK),
    '--ab-chalk': hex(CHALK),
    '--ab-tide': hex(TIDE),
    '--ab-danger': hex(DANGER),
  }
}
