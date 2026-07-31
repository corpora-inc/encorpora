// The auction gallery, drawn. Canvas 2D, no assets, no images to decode.
//
// Everything here is material: carved stone plates, brass rims, incised line
// work, one lapis plate for the broker's offer. There is no gradient standing in
// for a surface and there is no particle vocabulary — a lot that does not sell is
// copper oxide and a settled sale is cold celestial light, and neither of them is
// red and neither of them flashes.
//
// Reduced motion is a branch and not a degradation: the tablets cross-fade in
// place instead of rising, and nothing else changes.

import { easeOutCubic, unit } from "../core/feel.ts"
import type { Settled } from "../game/auction.ts"
import type { Room } from "../game/lot.ts"
import { MIN_NUMERAL_PX } from "../game/ladder.ts"
import { hitKey, hitTablet, layout, promptPx, type Key, type Layout, type Rect } from "./layout.ts"
import {
  BRASS,
  BRASS_DIM,
  BRASS_LIT,
  COLD,
  INCISE,
  INK,
  INK_DIM,
  LAPIS,
  LAPIS_LIT,
  NIGHT,
  OXIDE,
  STONE,
  STONE_LIT,
  WALL,
} from "./palette.ts"

export type View = {
  lot: string
  room: Room | null
  marked: number | null
  digits: string
  phase: "bidding" | "settled"
  settled: Settled | null
  /** The settled room is being held open for the child, not for a timer. */
  studying: boolean
  /** …and it is past its settle floor, so a tap would now take it down. */
  nudgeable: boolean
  coins: number
  storeroom: number
  remaining: number
  armed: boolean
  paused: boolean
  stalled: boolean
}

const FACE = "'SF Mono','Menlo','DejaVu Sans Mono',ui-monospace,monospace"
const TITLE = "system-ui,-apple-system,'Segoe UI',sans-serif"

/** How long the room takes to come up, and the settled values to appear. */
const RAISE_MS = 380
const REVEAL_MS = 260
/**
 * How long the "go on when you like" hairline takes to arrive, in ms.
 *
 * The settled room now waits for the child rather than for a clock, and a screen
 * that waits with no sign that it is waiting reads as a screen that has hung.
 * This is that sign, and it is a line rather than a sentence: state lives in the
 * design, and the string would ship fifty-odd times translated to say something
 * the shape already says.
 *
 * **It arrives only once a tap would actually work** — after `nudge`'s settle
 * floor — so it is never an invitation to press something that is being
 * swallowed. Slow on purpose: it must not read as a countdown, and anything that
 * moves quickly next to an answer competes with the answer.
 */
const CUE_MS = 900

export class Scene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly reduced: boolean

  private w = 320
  private h = 480
  private lay: Layout
  private lastCount = 3

  /** 0..1, how far the room is up. */
  private raise = 1
  /** 0..1, how far the settled values are in. */
  private reveal = 0
  /** 0..1, how far the "go on when you like" hairline is in. */
  private cue = 0
  private shownCoins = 0
  private pressed: string | null = null
  private pressAge = 0

  constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("gavel: no 2d context")
    this.ctx = ctx
    this.reduced = reduced
    this.lay = layout(this.w, this.h, this.lastCount)
    this.resize()
  }

  get layout(): Layout {
    return this.lay
  }

  resize(): void {
    const dpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1))
    const rect = this.canvas.getBoundingClientRect()
    this.w = Math.max(240, Math.round(rect.width || this.w))
    this.h = Math.max(320, Math.round(rect.height || this.h))
    this.canvas.width = Math.round(this.w * dpr)
    this.canvas.height = Math.round(this.h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.lay = layout(this.w, this.h, this.lastCount)
  }

  /** A new room came up. */
  raiseRoom(count: number): void {
    this.lastCount = count
    this.lay = layout(this.w, this.h, count)
    this.raise = this.reduced ? 0.001 : 0
    this.reveal = 0
  }

  /** The hammer fell. */
  settle(): void {
    this.reveal = 0
  }

  press(id: string): void {
    this.pressed = id
    this.pressAge = 0
  }

  advance(dt: number, view: View): void {
    this.raise = unit(this.raise + dt / RAISE_MS)
    if (view.phase === "settled") this.reveal = unit(this.reveal + dt / REVEAL_MS)
    this.cue =
      view.phase === "settled" && view.studying && view.nudgeable
        ? unit(this.cue + dt / CUE_MS)
        : 0
    // The coin counter walks rather than jumping, because the walk is the reward.
    const gap = view.coins - this.shownCoins
    this.shownCoins =
      Math.abs(gap) < 0.51 ? view.coins : this.shownCoins + Math.sign(gap) * Math.max(1, dt / 34)
    if (this.pressed !== null) {
      this.pressAge += dt
      if (this.pressAge > 140) this.pressed = null
    }
  }

  keyAt(x: number, y: number): Key | null {
    return hitKey(this.lay, x, y)
  }

  tabletAt(x: number, y: number): number | null {
    return hitTablet(this.lay, x, y)
  }

  draw(view: View): void {
    const g = this.ctx
    const l = this.lay
    g.save()
    this.background()

    if (view.stalled) {
      this.centred("THE GALLERY IS DARK", INK, 20, l.gallery.y + l.gallery.h / 2)
      this.centred("no lots the auctioneer can call", INK_DIM, 13, l.gallery.y + l.gallery.h / 2 + 26)
      g.restore()
      return
    }

    this.plaque(view)
    this.strip(view)
    this.block(view)
    this.gallery(view)
    this.onward()
    this.paddle(view)
    this.keys(view)

    if (view.paused) {
      g.fillStyle = "rgba(6,8,18,0.62)"
      g.fillRect(0, 0, this.w, this.h)
    }
    g.restore()
  }

  // ── pieces ────────────────────────────────────────────────────────────────

  private background(): void {
    const g = this.ctx
    const l = this.lay
    g.fillStyle = NIGHT
    g.fillRect(0, 0, this.w, this.h)

    // The back wall of the gallery, and the arcade standing in front of it: pointed
    // arches, incised, springing from the floor. Structure rather than wallpaper — it is
    // the room the auction is happening in, and the plates below sit on top of it.
    const top = Math.max(0, l.strip.y - 14)
    g.fillStyle = WALL
    g.fillRect(0, top, this.w, this.h - top)
    g.strokeStyle = INCISE
    g.lineWidth = 1
    const span = Math.max(84, Math.min(190, this.w / 5))
    const spring = top + Math.min(120, (this.h - top) * 0.34)
    for (let x = -span / 2; x < this.w + span; x += span) {
      g.beginPath()
      g.moveTo(x, this.h)
      g.lineTo(x, spring)
      g.quadraticCurveTo(x + span / 2, top + 2, x + span, spring)
      g.lineTo(x + span, this.h)
      g.stroke()
    }
  }

  /**
   * A mark for the lot on the block: an eight-point girih rosette, turned by the lot's
   * own name so no two objects carry the same one.
   *
   * Cheap on purpose — sixteen line segments and two circles. The alternative was an
   * illustration per object, and sixteen illustrations is an art budget rather than a
   * first cut.
   */
  private sigil(cx: number, cy: number, r: number, name: string): void {
    const g = this.ctx
    if (r < 9) return
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff
    const points = 6 + (hash % 4)
    const turn = ((hash >> 4) % 90) * (Math.PI / 180)
    g.strokeStyle = BRASS_DIM
    g.lineWidth = 1
    g.beginPath()
    for (let i = 0; i < points * 2; i++) {
      const a = turn + (i * Math.PI) / points
      const rad = i % 2 === 0 ? r : r * 0.52
      const x = cx + Math.cos(a) * rad
      const y = cy + Math.sin(a) * rad
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
    g.stroke()
    g.beginPath()
    g.arc(cx, cy, r * 0.3, 0, Math.PI * 2)
    g.stroke()
  }

  /** The strongbox: how many coins are in it. The only score in the game. */
  private plaque(view: View): void {
    const g = this.ctx
    const r = this.lay.coins
    this.plate(r, STONE, BRASS_DIM)
    const size = Math.min(20, r.h - 8)
    g.textBaseline = "middle"
    g.textAlign = "left"
    g.font = `600 ${String(Math.round(size * 0.62))}px ${TITLE}`
    g.fillStyle = INK_DIM
    g.fillText("STRONGBOX", r.x + 12, r.y + r.h / 2)
    g.textAlign = "right"
    g.font = `700 ${String(Math.round(size))}px ${FACE}`
    g.fillStyle = BRASS_LIT
    g.fillText(`${String(Math.round(this.shownCoins))} ◉`, r.x + r.w - 12, r.y + r.h / 2)
    void view
  }

  /**
   * One pip per lot still owed to the broker, and one oxide pip per lot on the shelf.
   *
   * **Countable, and drawn rather than written.** This used to print `CONSIGNMENT 1` and
   * `3 UNSOLD` at nine pixels — numerals a child has to read, at two thirds of this pack's
   * own stated floor of thirteen, next to a comment citing SERPENT's four-pixel orbs. The
   * information was never the numeral: a wrong bid means one more pip, and the shelf is a
   * row of dull ones. Both are legible from across a room, which nine-pixel type is not,
   * and the consignment ordinal was narration nobody needs.
   */
  private strip(view: View): void {
    const g = this.ctx
    const r = this.lay.strip
    const owed = Math.max(1, view.remaining)
    const total = owed + view.storeroom
    const pip = Math.max(4, Math.min(13, r.w / Math.max(10, total + 2) - 3))
    let x = r.x
    for (let i = 0; i < owed; i++) {
      g.fillStyle = i === 0 ? BRASS_LIT : BRASS_DIM
      this.pip(x, r, pip)
      x += pip + 3
    }
    // The shelf, in copper oxide: lots bought over the offer that nobody will buy. Set
    // apart by a gap, because they are not lots still to be sold.
    x += pip
    for (let i = 0; i < view.storeroom; i++) {
      g.fillStyle = OXIDE
      this.pip(x, r, pip)
      x += pip + 3
    }
  }

  /** One lozenge on the consignment strip. */
  private pip(x: number, r: Rect, w: number): void {
    const g = this.ctx
    g.beginPath()
    g.moveTo(x + w / 2, r.y + 1)
    g.lineTo(x + w, r.y + r.h / 2)
    g.lineTo(x + w / 2, r.y + r.h - 1)
    g.lineTo(x, r.y + r.h / 2)
    g.closePath()
    g.fill()
  }

  /** The lot on the block, and the offer plate beside it. */
  private block(view: View): void {
    const g = this.ctx
    const r = this.lay.block
    const o = this.lay.offer
    const left: Rect = { x: r.x, y: r.y, w: Math.max(60, o.x - r.x - 8), h: r.h }
    this.plate(left, STONE_LIT, INCISE)

    g.textBaseline = "middle"
    g.textAlign = "left"
    const nameSize = Math.min(15, Math.max(11, left.h * 0.24))
    g.font = `700 ${String(Math.round(nameSize))}px ${TITLE}`
    g.fillStyle = BRASS
    const sigilR = Math.min(left.h * 0.34, left.w * 0.16)
    this.wrapped(
      view.lot,
      left.x + 12,
      left.y + left.h * 0.42,
      left.w - 32 - sigilR * 2,
      nameSize + 3,
    )
    this.sigil(left.x + left.w - 14 - sigilR, left.y + left.h / 2, sigilR, view.lot)

    const settled = view.phase === "settled" ? view.settled : null
    // The verdict carries the coins earned, so it is a numeral a child reads and it obeys
    // the floor. It used to print at eleven pixels.
    g.font = `600 ${String(MIN_NUMERAL_PX)}px ${TITLE}`
    g.fillStyle = settled ? this.tint(settled) : INK_DIM
    g.fillText(
      settled ? this.verdict(settled) : "ON THE BLOCK",
      left.x + 12,
      left.y + left.h - 13,
    )

    // The offer. Lapis, and lapis is used for nothing else in the game.
    this.plate(o, LAPIS, LAPIS_LIT)
    g.textAlign = "center"
    g.font = `600 10px ${TITLE}`
    g.fillStyle = "rgba(230,240,255,0.75)"
    g.fillText("BROKER PAYS", o.x + o.w / 2, o.y + 15)
    const offerSize = Math.min(34, Math.max(18, o.h * 0.46))
    g.font = `700 ${String(Math.round(offerSize))}px ${FACE}`
    g.fillStyle = "#f4f8ff"
    g.fillText(
      view.room ? String(view.room.offer) : "—",
      o.x + o.w / 2,
      o.y + o.h / 2 + offerSize * 0.22,
    )
  }

  private gallery(view: View): void {
    const g = this.ctx
    const room = view.room
    if (!room) return
    const rise = this.reduced ? 1 : easeOutCubic(this.raise)
    for (let i = 0; i < this.lay.tablets.length; i++) {
      const rect = this.lay.tablets[i]
      const tablet = room.tablets[i]
      if (!rect || !tablet) continue
      const lift = this.reduced ? 0 : (1 - rise) * 18
      const box: Rect = { x: rect.x, y: rect.y + lift, w: rect.w, h: rect.h }
      const marked = view.marked === i
      const top = view.phase === "settled" && tablet.value === room.highest

      g.globalAlpha = this.reduced ? rise : 1
      this.plate(box, marked ? STONE_LIT : STONE, marked ? BRASS_LIT : INCISE, marked ? 2 : 1)

      // The prompt. Never the total — working it out is the game.
      const size = promptPx(tablet.prompt, box.w, box.h)
      g.textAlign = "center"
      g.textBaseline = "middle"
      g.font = `600 ${String(size)}px ${FACE}`
      g.fillStyle = marked ? INK : "#dcd8cc"
      const promptY = view.phase === "settled" ? box.y + box.h * 0.36 : box.y + box.h * 0.5
      g.fillText(tablet.prompt, box.x + box.w / 2, promptY)

      if (view.phase === "settled") {
        g.globalAlpha = this.reduced ? rise * this.reveal : this.reveal
        g.font = `700 ${String(Math.round(size * 1.05))}px ${FACE}`
        g.fillStyle = top ? COLD : BRASS
        g.fillText(String(tablet.value), box.x + box.w / 2, box.y + box.h * 0.74)
        if (top) {
          g.strokeStyle = COLD
          g.lineWidth = 2
          this.round(box.x + 1, box.y + 1, box.w - 2, box.h - 2, 7)
          g.stroke()
        }
        g.globalAlpha = 1
      }

      if (marked) {
        // The pin the child drops on the tablet they mean to beat.
        g.fillStyle = BRASS_LIT
        g.beginPath()
        g.arc(box.x + box.w - 11, box.y + 11, 4, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
    }
  }

  /**
   * "Go on when you like": a brass hairline under the gallery, and nothing else.
   *
   * See `CUE_MS`. It is drawn short of the full width and centred so it reads as
   * a mark rather than as a rule, and it never blinks — a flash next to a
   * finished sum is a distraction, and this is a children's product with a hard
   * flash-rate limit anyway.
   */
  private onward(): void {
    if (this.cue <= 0) return
    const g = this.ctx
    const r = this.lay.gallery
    const w = r.w * 0.34 * this.cue
    const y = r.y + r.h + 5
    g.strokeStyle = BRASS_DIM
    g.globalAlpha = 0.28 + 0.4 * this.cue
    g.lineWidth = 2
    g.lineCap = "round"
    g.beginPath()
    g.moveTo(r.x + r.w / 2 - w / 2, y)
    g.lineTo(r.x + r.w / 2 + w / 2, y)
    g.stroke()
    g.globalAlpha = 1
    g.lineCap = "butt"
  }

  /** The paddle: what you are about to bid, and what you are beating. */
  private paddle(view: View): void {
    const g = this.ctx
    const r = this.lay.paddle
    this.plate(r, STONE_LIT, view.armed ? BRASS_LIT : INCISE, view.armed ? 2 : 1)
    const marked = view.marked !== null ? (view.room?.tablets[view.marked] ?? null) : null

    g.textBaseline = "middle"
    g.textAlign = "left"
    // `BEATING 88 + 61` is the marked tablet's own sum — exactly the class of text the
    // floor exists for — and it used to print at ten pixels.
    g.font = `600 ${String(MIN_NUMERAL_PX)}px ${TITLE}`
    g.fillStyle = INK_DIM
    g.fillText(
      marked ? `BEATING  ${marked.prompt}` : "MARK A TABLET, THEN BID",
      r.x + 12,
      r.y + r.h / 2,
    )

    g.textAlign = "right"
    const size = Math.min(30, Math.max(18, r.h * 0.6))
    g.font = `700 ${String(Math.round(size))}px ${FACE}`
    g.fillStyle = view.digits === "" ? BRASS_DIM : BRASS_LIT
    g.fillText(view.digits === "" ? "···" : view.digits, r.x + r.w - 12, r.y + r.h / 2)
  }

  private keys(view: View): void {
    const g = this.ctx
    for (const key of this.lay.keys) {
      const live =
        key.id === "gavel" ? view.armed : key.id === "back" ? view.digits !== "" : !view.paused
      const down = this.pressed === key.id
      const fill = key.id === "gavel" && view.armed ? BRASS : down ? STONE_LIT : STONE
      this.plate(key.rect, fill, down ? BRASS_LIT : INCISE)
      g.textAlign = "center"
      g.textBaseline = "middle"
      const size =
        key.digit === null
          ? Math.min(15, Math.max(11, key.rect.h * 0.3))
          : Math.min(24, Math.max(16, key.rect.h * 0.46))
      g.font =
        key.digit === null
          ? `700 ${String(Math.round(size))}px ${TITLE}`
          : `600 ${String(Math.round(size))}px ${FACE}`
      g.fillStyle =
        key.id === "gavel" && view.armed ? "#1a1405" : live ? INK : "rgba(242,238,228,0.35)"
      g.fillText(key.label, key.rect.x + key.rect.w / 2, key.rect.y + key.rect.h / 2)
    }
  }

  // ── primitives ────────────────────────────────────────────────────────────

  private plate(r: Rect, fill: string, rim: string, width = 1): void {
    const g = this.ctx
    g.fillStyle = fill
    this.round(r.x, r.y, r.w, r.h, 6)
    g.fill()
    g.strokeStyle = rim
    g.lineWidth = width
    this.round(r.x + width / 2, r.y + width / 2, r.w - width, r.h - width, 6)
    g.stroke()
  }

  private round(x: number, y: number, w: number, h: number, r: number): void {
    const g = this.ctx
    const rad = Math.min(r, w / 2, h / 2)
    g.beginPath()
    g.moveTo(x + rad, y)
    g.arcTo(x + w, y, x + w, y + h, rad)
    g.arcTo(x + w, y + h, x, y + h, rad)
    g.arcTo(x, y + h, x, y, rad)
    g.arcTo(x, y, x + w, y, rad)
    g.closePath()
  }

  private centred(text: string, colour: string, size: number, y: number): void {
    const g = this.ctx
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.font = `600 ${String(size)}px ${TITLE}`
    g.fillStyle = colour
    g.fillText(text, this.w / 2, y)
  }

  /** Two lines at most: a lot's name is two or three words. */
  private wrapped(text: string, x: number, y: number, w: number, lh: number): void {
    const g = this.ctx
    const words = text.split(" ")
    let line = ""
    let row = 0
    for (const word of words) {
      const next = line === "" ? word : `${line} ${word}`
      if (g.measureText(next).width > w && line !== "") {
        g.fillText(line, x, y + row * lh)
        line = word
        row++
        if (row > 1) break
      } else {
        line = next
      }
    }
    g.fillText(line, x, y + row * lh)
  }

  private verdict(s: Settled): string {
    switch (s.outcome) {
      // Short, because they are drawn at the legibility floor on a 320px phone, where the
      // block's left plate is about 180 pixels wide. The long-form versions of these
      // ("PAID OVER THE OFFER — NOBODY WILL BUY IT") needed 254 pixels at that size, so
      // the choice was between shortening them and printing them too small to read. What
      // a wrong bid costs is on the strip and in the manual; the verdict names it.
      case "sold":
        return s.keen ? `KEEN BID  +${String(s.coins)} ◉` : `SOLD  +${String(s.coins)} ◉`
      case "even":
        return "SOLD  NOTHING IN IT"
      case "outbid":
        return "OUTBID"
      case "unsold":
        return "OVER THE OFFER  UNSOLD"
      case "folded":
        return s.coins > 0 ? `FOLDED  +${String(s.coins)} ◉` : "FOLDED"
    }
  }

  private tint(s: Settled): string {
    switch (s.outcome) {
      case "sold":
        return COLD
      case "even":
        return INK_DIM
      case "outbid":
        return BRASS_DIM
      case "unsold":
        return OXIDE
      case "folded":
        return s.coins > 0 ? COLD : INK_DIM
    }
  }
}
