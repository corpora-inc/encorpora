// THE ASTROLABE — the instrument that makes the child PRODUCE the ordered pair.
//
// Two brass rings turn under one fixed index at the top of the plate. The outer
// ring carries the ONES, the inner ring the TENS, and each seats in ten
// detents. A digit is not chosen from a list and it is not pointed at on the
// sky: it is *turned to*, one notch at a time, by a hand that already knows
// which digit it wants.
//
// In the middle sits the boss — the MARK — with the reading engraved on it: the
// ordered pair, and beneath it the number that pair stands for, so the child
// sees `(2, 7)` and `72` as the same fact. That equivalence is the whole
// pedagogy of the game and it is drawn, never said.
//
// Around the rim: the chain. One filled notch per link, and a fuse that drains
// as the light fades. In reduced motion those notches are the *only* place the
// chain lives, which is why they are drawn there and not merely animated there.

import {
  alpha,
  BRASS,
  BRASS_DEEP,
  BRASS_DIM,
  BRASS_LIT,
  FIGURE_FONT,
  LAPIS,
  LAPIS_LIT,
  OXIDE,
  sized,
  STARLIGHT,
  STONE,
  STONE_EDGE,
} from "./palette.ts"
import type { Layout } from "./sky.ts"

const DETENTS = 10
const ARC = (Math.PI * 2) / DETENTS

export type Ring = "ones" | "tens"

export type DialView = {
  ones: number
  tens: number
  /** Sub-detent offset, −0.5..0.5, while a ring is being dragged. */
  onesDrift: number
  tensDrift: number
  order: number
  /** What the observatory would write down. Null when nothing is sighted. */
  reading: number | null
  links: number
  chainCap: number
  fuse: number
  sightings: number
  sightingsMax: number
  /** 0..1, the boss's press. */
  press: number
  /** 0..1, a refusal shudder. */
  refuse: number
}

export function ringRadii(l: Layout): {
  outer: [number, number]
  inner: [number, number]
  boss: number
} {
  const r = l.dial.r
  return { outer: [r * 0.74, r], inner: [r * 0.45, r * 0.7], boss: r * 0.41 }
}

/** Which ring a touch landed on, or `null` for the boss or for open plate. */
export function ringAt(l: Layout, px: number, py: number): Ring | "boss" | null {
  const { outer, inner, boss } = ringRadii(l)
  const d = Math.hypot(px - l.dial.cx, py - l.dial.cy)
  if (d <= boss) return "boss"
  if (d >= inner[0] && d <= inner[1]) return "tens"
  if (d >= outer[0] && d <= outer[1]) return "ones"
  return null
}

/** The angle, in radians, of a touch about the dial's centre. */
export function angleAt(l: Layout, px: number, py: number): number {
  return Math.atan2(py - l.dial.cy, px - l.dial.cx)
}

function drawRing(
  g: CanvasRenderingContext2D,
  l: Layout,
  radii: [number, number],
  value: number,
  drift: number,
  hot: boolean,
): void {
  const { cx, cy } = l.dial
  const [ri, ro] = radii
  const mid = (ri + ro) / 2

  g.save()
  g.beginPath()
  g.arc(cx, cy, ro, 0, Math.PI * 2)
  g.arc(cx, cy, ri, 0, Math.PI * 2, true)
  g.fillStyle = STONE
  g.fill("evenodd")
  g.strokeStyle = hot ? alpha(BRASS, 0.8) : STONE_EDGE
  g.lineWidth = Math.max(1, l.rpx * 2)
  g.beginPath()
  g.arc(cx, cy, ro, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.arc(cx, cy, ri, 0, Math.PI * 2)
  g.stroke()
  g.restore()

  // The ring turns so that the seated digit comes under the index at the top.
  const turn = -(value + drift) * ARC
  const size = Math.max(10, Math.min((ro - ri) * 0.52, 26 * Math.max(1, l.rpx * 1.4)))
  g.font = sized(FIGURE_FONT, size)
  g.textAlign = "center"
  g.textBaseline = "middle"

  for (let d = 0; d < DETENTS; d++) {
    const a = -Math.PI / 2 + turn + d * ARC
    const px = cx + Math.cos(a) * mid
    const py = cy + Math.sin(a) * mid
    const seated = d === value
    g.save()
    g.translate(px, py)
    g.rotate(a + Math.PI / 2)
    g.fillStyle = seated ? BRASS_LIT : alpha(BRASS_DIM, 0.8)
    g.fillText(String(d), 0, 0)
    g.restore()

    // A notch on the outer edge for every detent: the ring is a mechanism and
    // it has to look like one that can only stop in ten places.
    const na = a
    g.strokeStyle = alpha(BRASS_DEEP, 0.9)
    g.lineWidth = Math.max(1, l.rpx * 1.6)
    g.beginPath()
    g.moveTo(cx + Math.cos(na) * (ro - (ro - ri) * 0.16), cy + Math.sin(na) * (ro - (ro - ri) * 0.16))
    g.lineTo(cx + Math.cos(na) * ro, cy + Math.sin(na) * ro)
    g.stroke()
  }
}

export function drawAstrolabe(
  g: CanvasRenderingContext2D,
  l: Layout,
  v: DialView,
  held: Ring | null,
  reduced: boolean,
): void {
  const { cx, cy, r } = l.dial
  const { outer, inner, boss } = ringRadii(l)

  // The plate.
  g.fillStyle = STONE
  g.beginPath()
  g.arc(cx, cy, r * 1.05, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = alpha(BRASS_DEEP, 0.9)
  g.lineWidth = Math.max(1, l.rpx * 3)
  g.stroke()

  drawRing(g, l, outer, v.ones, v.onesDrift, held === "ones")
  drawRing(g, l, inner, v.tens, v.tensDrift, held === "tens")

  // The index: one fixed brass pointer at the top. Both rings read under it.
  g.fillStyle = BRASS_LIT
  g.beginPath()
  g.moveTo(cx, cy - r * 1.02)
  g.lineTo(cx - r * 0.045, cy - r * 1.13)
  g.lineTo(cx + r * 0.045, cy - r * 1.13)
  g.closePath()
  g.fill()

  // ── the chain, on the rim's foot ─────────────────────────────────────────
  //
  // Reduced motion or not, this is where the link count lives. Nothing about
  // this drawing depends on the world slowing down or the colour splitting, so
  // the information survives the branch intact. It sits at six o'clock, well
  // clear of the index, and it is the first thing a child's eye goes to when
  // a chain is running.
  const notches = Math.min(v.links, v.chainCap)
  const fan = 0.155
  for (let i = 0; i < v.chainCap; i++) {
    // Filling left to right, the way a count does.
    const a = Math.PI / 2 + ((v.chainCap - 1) / 2 - i) * fan
    const lit = i < notches
    const rr = r * 1.07
    const out = r * (lit ? 0.1 : 0.05)
    g.strokeStyle = lit ? BRASS_LIT : alpha(BRASS_DEEP, 0.75)
    g.lineWidth = Math.max(1.5, l.rpx * (lit ? 4.5 : 2.4))
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
    g.lineTo(cx + Math.cos(a) * (rr + out), cy + Math.sin(a) * (rr + out))
    g.stroke()
  }
  if (v.links > 0 && v.fuse > 0) {
    // The fuse: the light still in the chain, draining across the same arc.
    const half = (fan * (v.chainCap - 1)) / 2
    g.strokeStyle = alpha(STARLIGHT, 0.6)
    g.lineWidth = Math.max(1.5, l.rpx * 3)
    g.beginPath()
    g.arc(cx, cy, r * 1.07, Math.PI / 2 - half * v.fuse, Math.PI / 2 + half * v.fuse)
    g.stroke()
  }

  // ── the sightings, in a column beside the plate ──────────────────────────
  const pitch = r * 0.15
  for (let i = 0; i < v.sightingsMax; i++) {
    const px = cx - r * 1.16
    const py = cy + (i - (v.sightingsMax - 1) / 2) * pitch
    g.fillStyle = i < v.sightings ? BRASS : alpha(BRASS_DEEP, 0.8)
    g.beginPath()
    g.arc(px, py, Math.max(2, r * 0.032), 0, Math.PI * 2)
    g.fill()
  }

  // ── the boss: MARK, with the reading engraved on it ──────────────────────
  const shake = v.refuse > 0 && !reduced ? Math.sin(v.refuse * 42) * l.rpx * 4 * v.refuse : 0
  g.save()
  g.translate(shake, 0)
  g.fillStyle = v.refuse > 0 ? alpha(OXIDE, 0.35) : alpha(LAPIS, 0.55)
  g.beginPath()
  g.arc(cx, cy, boss * (1 - 0.045 * v.press), 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = v.refuse > 0 ? OXIDE : BRASS
  g.lineWidth = Math.max(1.5, l.rpx * 3)
  g.stroke()

  const pairSize = Math.max(12, Math.min(boss * 0.3, 32 * Math.max(1, l.rpx * 1.3)))
  g.textAlign = "center"
  g.textBaseline = "middle"

  // Which ring is which, said once, right over the digit each one seats. No
  // leader lines, no legend: the label is directly above the numeral it names.
  const gap = pairSize * 1.5
  g.font = sized(FIGURE_FONT, pairSize * 0.48)
  g.fillStyle = held === "ones" ? BRASS_LIT : alpha(LAPIS_LIT, 0.95)
  g.fillText("ONES", cx - gap, cy - boss * 0.6)
  g.fillStyle = held === "tens" ? BRASS_LIT : alpha(LAPIS_LIT, 0.95)
  g.fillText("TENS", cx + gap, cy - boss * 0.6)

  g.font = sized(FIGURE_FONT, pairSize)
  g.fillStyle = alpha(BRASS_DIM, 0.9)
  g.fillText("(", cx - gap * 1.75, cy - boss * 0.3)
  g.fillText(",", cx, cy - boss * 0.3)
  g.fillText(")", cx + gap * 1.75, cy - boss * 0.3)
  g.fillStyle = BRASS_LIT
  g.font = sized(FIGURE_FONT, pairSize * 1.18)
  g.fillText(String(v.ones), cx - gap, cy - boss * 0.3)
  g.fillText(String(v.tens), cx + gap, cy - boss * 0.3)

  // The same fact, as a number. `(2, 7)` and `72` sit one above the other and
  // the child is never told they are the same thing.
  g.font = sized(FIGURE_FONT, pairSize * 1.6)
  g.fillStyle = v.reading === null ? alpha(BRASS_DIM, 0.5) : STARLIGHT
  g.fillText(v.reading === null ? "—" : String(v.reading), cx, cy + boss * 0.22)

  g.font = sized(FIGURE_FONT, pairSize * 0.58)
  g.fillStyle = alpha(BRASS_DIM, 0.95)
  g.fillText("MARK", cx, cy + boss * 0.68)
  g.restore()
}
