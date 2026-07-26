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
// ## Particles start at ENGAGE, and that is the doc's rule
//
// EXPERIENCE_DESIGN's SEAT row reads "One detent click, one gear tooth, a
// `light` haptic, **no particles**". The first cut of this file gave both SEAT
// effects three motes each, which contradicted the doc on the reaction the
// child sees most — and the contradiction was load-bearing, because under a
// *multiplicative* energy formula a particle-free effect scores zero and
// `energy(SLIP) < energy(SEAT)` cannot hold at all.
//
// Two changes, together. The particle term is additive — `(1 + particles)` —
// so a particle-free effect has a real energy that its budget, gain and moving
// parts still order. And nothing below ENGAGE throws a mote: SEAT because the
// doc says so, SLIP because SLIP must be quieter than SEAT and a chip of stone
// flying off is unarguably more animated than a pawl dropping into a tooth.
// That is the "catapult falling short" failure EXPERIENCE_DESIGN names, and
// the only way to rule it out is to not have the catapult.
//
// ## The energy ladder
//
// `energy = budgetMs × (1 + particles) × peakGain × elements`, and
// `reactions.test.ts` asserts the whole ladder is strictly ordered — the
// loudest slip is quieter than the quietest seat, the loudest seat quieter
// than the quietest engage, and so on to the top.
//
// `particles` and `elements` are **disjoint** counts: `elements` is the drawn
// parts the frame animates and the mote cloud is not one of them. They were
// tangled in the first cut, which is why dropping the motes from SEAT would
// otherwise have left `elements` counting something that is no longer drawn.
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
  /** Motes thrown at peak. Zero below ENGAGE. Feeds the energy formula and the pool. */
  readonly particles: number
  /** Peak output amplitude, 0…1. Multiplies the brightest element's alpha. */
  readonly peakGain: number
  /** Independently animated drawn parts. Does **not** count the mote cloud. */
  readonly elements: number
  readonly needs: readonly Requirement[]
  /**
   * The anchor this effect may not draw outside of, or `null` for no clip.
   *
   * The canvas is `fixed inset-0` over the whole app, so an arc struck around a
   * 44 px rosette in a 72 px band overran the band's top edge and drew across
   * the header. A clip is the honest fix: the effect keeps its geometry and the
   * stage keeps it inside the thing it is playing on.
   */
  readonly clip: Requirement | null
  readonly draw: (ctx: Ctx, frame: Frame) => void
}

/** EXPERIENCE_DESIGN's energy measure, over one effect. */
export function energy(effect: Effect): number {
  return TIERS[effect.tier].budgetMs * (1 + effect.particles) * effect.peakGain * effect.elements
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
// mechanism failing to take: nothing advances. No motes — see the header: the
// chip of stone flying off was the loudest thing in the bottom two tiers, on
// the outcome that must never be the interesting one.

const chisel: Effect = {
  id: "chisel",
  tier: "slip",
  particles: 0,
  peakGain: 0.3,
  elements: 1,
  needs: ["seat"],
  clip: null,
  draw: (ctx, frame) => {
    const seat = frame.anchor.seat
    if (seat === null) return
    const y = seat.y + seat.height * 0.62
    const x1 = seat.x + seat.width * frame.t
    ctx.lineCap = "round"
    ctx.globalAlpha = frame.alpha * frame.gain
    line(ctx, { x: seat.x, y }, { x: x1, y: y + seat.height * 0.1 }, frame.ink.strike, 2)
  },
}

const stall: Effect = {
  id: "stall",
  tier: "slip",
  particles: 0,
  peakGain: 0.28,
  elements: 2,
  needs: ["seat"],
  clip: null,
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
  },
}

// ── Tier 0 · SEAT ──────────────────────────────────────────────────────────
// Ordinary correctness. 200 ms, one detent, then earned stillness. This is the
// reaction the child sees hundreds of times, so it is the one that must never
// be in the way — and, per EXPERIENCE_DESIGN's SEAT row, the one with no
// particles in it at all.

const detent: Effect = {
  id: "detent",
  tier: "seat",
  particles: 0,
  peakGain: 0.55,
  elements: 2,
  needs: ["seat"],
  clip: null,
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
  },
}

const glint: Effect = {
  id: "glint",
  tier: "seat",
  particles: 0,
  peakGain: 0.52,
  elements: 2,
  needs: ["seat"],
  clip: null,
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
  elements: 2,
  needs: ["aperture"],
  clip: "cartouche",
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
  elements: 2,
  needs: ["cartouche"],
  clip: "cartouche",
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
// band catches light — and, in `keystone`, so does the answer row.
//
// `keystone` exists because the three loudest tiers all played in the 72 px
// construction band at the top of the screen, four hundred pixels from where
// the child's eyes are. Only SEAT drew at the seat, which is the tier that is
// deliberately the quietest. So the escalation was invisible at the place the
// escalation is *about*. It is also the quietest effect in its tier, and the
// picker weights inversely to energy — so it is the ILLUMINATE the child
// usually gets.

const keystone: Effect = {
  id: "keystone",
  tier: "illuminate",
  particles: 8,
  peakGain: 0.75,
  elements: 3,
  needs: ["seat"],
  clip: null,
  draw: (ctx, frame) => {
    const seat = frame.anchor.seat
    if (seat === null) return
    const at = centre(seat)
    const depth = seat.height * 0.44
    const half = seat.width * 0.1

    // The recess takes light.
    ctx.fillStyle = frame.ink.celestial
    ctx.globalAlpha = frame.alpha * frame.gain * 0.22
    ctx.beginPath()
    ctx.rect(seat.x, seat.y, seat.width, seat.height)
    ctx.fill()

    // The keystone comes down the last of its travel and seats on the rule.
    // Carried by `t`, which the stage pins to 1 under reduced motion, so with
    // motion off it is simply drawn where it lands.
    const lands = seat.y + seat.height - depth
    const top = lands - seat.height * 0.8 * (1 - frame.t)
    ctx.globalAlpha = frame.alpha * frame.gain
    ctx.fillStyle = frame.ink.index
    ctx.beginPath()
    ctx.moveTo(at.x - half, top)
    ctx.lineTo(at.x + half, top)
    ctx.lineTo(at.x + half * 1.6, top + depth)
    ctx.lineTo(at.x - half * 1.6, top + depth)
    ctx.closePath()
    ctx.fill()

    // …and the rule it seats on goes solid under it.
    ctx.globalAlpha = frame.alpha * frame.gain * (0.4 + 0.6 * frame.t)
    line(
      ctx,
      { x: seat.x, y: seat.y + seat.height },
      { x: seat.x + seat.width, y: seat.y + seat.height },
      frame.ink.seat,
      2,
    )
    motes(ctx, frame, { x: at.x, y: top + depth }, 8, frame.ink.celestial)
  },
}

const rosetteLight: Effect = {
  id: "rosetteLight",
  tier: "illuminate",
  particles: 14,
  peakGain: 0.85,
  elements: 3,
  needs: ["cartouche"],
  clip: "cartouche",
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
  elements: 3,
  needs: ["cartouche", "aperture"],
  clip: "cartouche",
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
  elements: 3,
  needs: ["cartouche", "aperture"],
  clip: "cartouche",
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
  chisel,
  stall,
  glint,
  detent,
  counterweight,
  tessera,
  keystone,
  armature,
  rosetteLight,
  closure,
]

export function effectsIn(tier: TierName): readonly Effect[] {
  return EFFECTS.filter((effect) => effect.tier === tier)
}
