// The effect catalogue: nine ways the mechanism responds.
//
// Everything here is drawn in the material vocabulary — a pawl dropping into a
// tooth, a counterweight rising a notch, an aperture taking light, ribs
// striking home. Nothing bursts, nothing spins, nothing is a starburst, and
// there is no effect whose job is to be exciting. EXPERIENCE_DESIGN's hostile
// reference board bans confetti and any particle vocabulary borrowed from a
// casual mobile game; motes here are chips of stone and points of cold light,
// thrown a few pixels and gone.
//
// **A gear that does not turn a thing is decoration and is banned.** So there
// are no gears. The moving parts here are the ones that are actually doing the
// work: the pawl that holds the count, the weight that drives it, and the stone
// that light passes through — which is the thing being built.
//
// ## The energy ladder
//
// Each effect declares the three factors EXPERIENCE_DESIGN's energy formula
// needs beyond its tier's budget: how many motes it throws, its peak output
// amplitude, and how many things move. `energy = budgetMs × particles ×
// peakGain × elements`, and `effects.test.ts` asserts the whole ladder is
// strictly ordered — the loudest slip is quieter than the quietest seat, the
// loudest seat quieter than the quietest engage, and so on to the top.
//
// `peakGain` is a real number that a real thing reads: every effect multiplies
// its brightest element's alpha by it. When the Web Audio layer lands at PR 2.7
// it is the same number, which is the point of naming it gain rather than
// opacity.

import { TIERS, type TierName } from "./tiers.ts"
import {
  centre,
  line,
  motes,
  sweep,
  type Ctx,
  type Frame,
  type Rect,
} from "./surface.ts"

/** What must be on screen for an effect to be drawable. */
export type Requirement = "seat" | "cartouche" | "aperture"

export interface Effect {
  readonly id: string
  readonly tier: TierName
  /** Motes thrown at peak. Feeds the energy formula and the pool. */
  readonly particles: number
  /** Peak output amplitude, 0…1. Multiplies the brightest element's alpha. */
  readonly peakGain: number
  /** Independently animated elements. */
  readonly elements: number
  readonly needs: readonly Requirement[]
  readonly draw: (ctx: Ctx, frame: Frame) => void
}

/** EXPERIENCE_DESIGN's energy measure, over one effect. */
export function energy(effect: Effect): number {
  return TIERS[effect.tier].budgetMs * effect.particles * effect.peakGain * effect.elements
}

/** The notch pitch of the pawl rail, in pixels. */
const TOOTH = 9

function rail(seat: Rect): { y: number; x: number } {
  return { y: seat.y + seat.height + 3, x: seat.x + seat.width - TOOTH * 3 }
}

/** One tooth of the rail, drawn as a short vertical incision. */
function tooth(ctx: Ctx, x: number, y: number, height: number, colour: string): void {
  line(ctx, { x, y }, { x, y: y + height }, colour, 1.5)
}

// ── Tier −1 · SLIP ─────────────────────────────────────────────────────────
// Visually interesting and clearly non-successful. Both of these are the
// mechanism failing to take: nothing advances, and one chip comes off.

const chisel: Effect = {
  id: "chisel",
  tier: "slip",
  particles: 1,
  peakGain: 0.3,
  elements: 2,
  needs: ["seat"],
  draw: (ctx, frame) => {
    const seat = frame.anchor.seat
    if (seat === null) return
    const y = seat.y + seat.height * 0.62
    const x1 = seat.x + seat.width * frame.t
    ctx.lineCap = "round"
    ctx.globalAlpha = frame.alpha * frame.gain
    line(ctx, { x: seat.x, y }, { x: x1, y: y + seat.height * 0.1 }, frame.ink.strike, 2)
    motes(ctx, frame, { x: x1, y }, 5, frame.ink.strike)
  },
}

const stall: Effect = {
  id: "stall",
  tier: "slip",
  particles: 1,
  peakGain: 0.28,
  elements: 2,
  needs: ["seat"],
  draw: (ctx, frame) => {
    const seat = frame.anchor.seat
    if (seat === null) return
    const { x, y } = rail(seat)
    // The pawl leans at the tooth and comes back. Oscillation, so it is gated
    // on `travel`: with reduced motion it simply rests where it was.
    const lean = Math.sin(Math.PI * frame.t) * TOOTH * 0.45 * frame.travel
    ctx.globalAlpha = frame.alpha * frame.gain
    for (let i = 0; i < 3; i++) tooth(ctx, x + i * TOOTH, y, 5, frame.ink.line)
    tooth(ctx, x + TOOTH + lean, y - 1, 7, frame.ink.strike)
    motes(ctx, frame, { x: x + TOOTH + lean, y: y + 5 }, 3, frame.ink.line)
  },
}

// ── Tier 0 · SEAT ──────────────────────────────────────────────────────────
// Ordinary correctness. 200 ms, one detent, then earned stillness. This is the
// reaction the child sees hundreds of times, so it is the one that must never
// be in the way.

const detent: Effect = {
  id: "detent",
  tier: "seat",
  particles: 3,
  peakGain: 0.55,
  elements: 2,
  needs: ["seat"],
  draw: (ctx, frame) => {
    const seat = frame.anchor.seat
    if (seat === null) return
    const { x, y } = rail(seat)
    const overshoot = Math.sin(Math.PI * frame.t) * 1.6 * frame.travel
    const pawl = x + TOOTH * (1 + frame.t) + overshoot
    ctx.globalAlpha = frame.alpha * frame.gain * 0.6
    for (let i = 0; i < 3; i++) tooth(ctx, x + i * TOOTH, y, 5, frame.ink.line)
    ctx.globalAlpha = frame.alpha * frame.gain
    tooth(ctx, pawl, y - 1, 7, frame.ink.index)
    motes(ctx, frame, { x: pawl, y: y + 2 }, 4, frame.ink.celestial)
  },
}

const glint: Effect = {
  id: "glint",
  tier: "seat",
  particles: 3,
  peakGain: 0.52,
  elements: 2,
  needs: ["seat"],
  draw: (ctx, frame) => {
    const seat = frame.anchor.seat
    if (seat === null) return
    const band = sweep(frame, seat)
    ctx.globalAlpha = frame.alpha * frame.gain * 0.4
    ctx.fillStyle = frame.ink.celestial
    ctx.beginPath()
    ctx.rect(band.x, seat.y, band.width, seat.height)
    ctx.fill()
    ctx.globalAlpha = frame.alpha * frame.gain
    line(
      ctx,
      { x: seat.x, y: seat.y + seat.height },
      { x: seat.x + seat.width, y: seat.y + seat.height },
      frame.ink.seat,
      2,
    )
    motes(ctx, frame, centre(seat), 6, frame.ink.celestial)
  },
}

// ── Tier 1 · ENGAGE ────────────────────────────────────────────────────────
// A harder item. The machinery moves: the aperture the answer just cut takes
// light, or the weight that drives the whole thing rises a notch.

const tessera: Effect = {
  id: "tessera",
  tier: "engage",
  particles: 6,
  peakGain: 0.7,
  elements: 3,
  needs: ["aperture"],
  draw: (ctx, frame) => {
    const cell = frame.anchor.aperture
    if (cell === null) return
    const at = centre(cell)
    const radius = Math.max(cell.width, cell.height) * (0.35 + 0.55 * frame.t)
    ctx.fillStyle = frame.ink.celestial
    ctx.globalAlpha = frame.alpha * frame.gain * (1 - frame.t * 0.7)
    ctx.beginPath()
    ctx.arc(at.x, at.y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = frame.alpha * frame.gain
    line(ctx, at, { x: at.x, y: at.y + radius * 2.2 }, frame.ink.celestial, 1)
    motes(ctx, frame, at, 7, frame.ink.celestial)
  },
}

const counterweight: Effect = {
  id: "counterweight",
  tier: "engage",
  particles: 5,
  peakGain: 0.66,
  elements: 3,
  needs: ["cartouche"],
  draw: (ctx, frame) => {
    const band = frame.anchor.cartouche
    if (band === null) return
    const x = band.x + 6
    const top = band.y + 4
    const bottom = band.y + band.height - 6
    const at = bottom - (bottom - top) * frame.t
    ctx.globalAlpha = frame.alpha * frame.gain * 0.5
    line(ctx, { x, y: top }, { x, y: bottom }, frame.ink.line, 1)
    ctx.globalAlpha = frame.alpha * frame.gain
    ctx.fillStyle = frame.ink.index
    ctx.beginPath()
    ctx.rect(x - 3, at - 3, 6, 6)
    ctx.fill()
    motes(ctx, frame, { x, y: at }, 6, frame.ink.index)
  },
}

// ── Tier 2 · ILLUMINATE ────────────────────────────────────────────────────
// The star inside a rosette closing, or a misunderstanding repaired. The whole
// band catches light.

const rosetteLight: Effect = {
  id: "rosetteLight",
  tier: "illuminate",
  particles: 14,
  peakGain: 0.85,
  elements: 4,
  needs: ["cartouche"],
  draw: (ctx, frame) => {
    const band = frame.anchor.cartouche
    if (band === null) return
    const band2 = sweep(frame, band)
    ctx.fillStyle = frame.ink.celestial
    ctx.globalAlpha = frame.alpha * frame.gain * 0.28
    ctx.beginPath()
    ctx.rect(band2.x, band.y, band2.width, band.height)
    ctx.fill()

    const cell = frame.anchor.aperture ?? band
    const at = centre(cell)
    ctx.globalAlpha = frame.alpha * frame.gain
    ctx.strokeStyle = frame.ink.celestial
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(at.x, at.y, band.height * (0.2 + 0.35 * frame.t), 0, Math.PI * 2)
    ctx.stroke()
    line(
      ctx,
      { x: band.x, y: band.y + band.height },
      { x: band.x + band.width, y: band.y + band.height },
      frame.ink.index,
      1.5,
    )
    motes(ctx, frame, at, 14, frame.ink.celestial)
  },
}

const armature: Effect = {
  id: "armature",
  tier: "illuminate",
  particles: 10,
  peakGain: 0.8,
  elements: 4,
  needs: ["cartouche", "aperture"],
  draw: (ctx, frame) => {
    const band = frame.anchor.cartouche
    const cell = frame.anchor.aperture
    if (band === null || cell === null) return
    const at = centre(cell)
    const radius = band.height * 0.38
    ctx.globalAlpha = frame.alpha * frame.gain
    ctx.strokeStyle = frame.ink.index
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(at.x, at.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frame.t)
    ctx.stroke()
    ctx.globalAlpha = frame.alpha * frame.gain * 0.6
    ctx.beginPath()
    ctx.arc(at.x, at.y, radius * 0.55, 0, Math.PI * 2)
    ctx.stroke()
    line(ctx, { x: band.x, y: band.y }, { x: band.x + band.width, y: band.y }, frame.ink.index, 1)
    motes(ctx, frame, at, 9, frame.ink.index)
  },
}

// ── Tier 3 · MECHANISM ─────────────────────────────────────────────────────
// A rosette closes and is set into the screen. Once a session, and any input
// settles it — a child who answers fast never waits on this.

const closure: Effect = {
  id: "closure",
  tier: "mechanism",
  particles: 24,
  peakGain: 1,
  elements: 5,
  needs: ["cartouche", "aperture"],
  draw: (ctx, frame) => {
    const band = frame.anchor.cartouche
    const cell = frame.anchor.aperture
    if (band === null || cell === null) return
    const at = centre(cell)
    const radius = band.height * 0.42

    // The ribs strike home: ten incisions closing on the centre.
    ctx.globalAlpha = frame.alpha * frame.gain
    ctx.strokeStyle = frame.ink.index
    ctx.lineWidth = 1.5
    for (let k = 0; k < 10; k++) {
      const angle = (k / 10) * Math.PI * 2 - Math.PI / 2
      const outer = radius * (1.7 - 0.7 * frame.t)
      ctx.beginPath()
      ctx.moveTo(at.x + Math.cos(angle) * radius * 0.5, at.y + Math.sin(angle) * radius * 0.5)
      ctx.lineTo(at.x + Math.cos(angle) * outer, at.y + Math.sin(angle) * outer)
      ctx.stroke()
    }

    // …and then the screen has somewhere to put the light.
    const shaft = band.height * 4 * frame.t
    ctx.fillStyle = frame.ink.celestial
    ctx.globalAlpha = frame.alpha * frame.gain * 0.16 * (1 - frame.t)
    ctx.beginPath()
    ctx.moveTo(at.x - radius * 0.6, at.y)
    ctx.lineTo(at.x + radius * 0.6, at.y)
    ctx.lineTo(at.x + radius * 1.9, at.y + shaft)
    ctx.lineTo(at.x - radius * 1.9, at.y + shaft)
    ctx.closePath()
    ctx.fill()

    ctx.globalAlpha = frame.alpha * frame.gain * 0.5
    line(
      ctx,
      { x: band.x, y: band.y + band.height },
      { x: band.x + band.width, y: band.y + band.height },
      frame.ink.index,
      2,
    )
    motes(ctx, frame, at, 12, frame.ink.celestial)
  },
}

/** Every effect, in energy order within each tier. */
export const EFFECTS: readonly Effect[] = [
  stall,
  chisel,
  glint,
  detent,
  counterweight,
  tessera,
  armature,
  rosetteLight,
  closure,
]

export function effectsIn(tier: TierName): readonly Effect[] {
  return EFFECTS.filter((effect) => effect.tier === tier)
}
