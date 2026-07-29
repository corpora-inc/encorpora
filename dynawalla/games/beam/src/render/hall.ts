// Drawing the resonance hall.
//
// Everything in here is a function of state passed in; nothing owns any. The
// two pieces that matter are `drawTraces`, which is the phasing made visible,
// and `drawAutomaton`, which keeps the three classes apart by silhouette so the
// board still parses with the colour taken out.

import { columnX, project, type Geom } from "./geom.ts"
import {
  BEAM,
  BEAM_HOT,
  BEAM_LIT,
  BRASS,
  BRASS_DARK,
  BRASS_HOT,
  DISSONANT,
  font,
  HALL_LOW,
  HALL_TOP,
  INK,
  LAPIS,
  LAPIS_EDGE,
  LAPIS_HOT,
  NUM_FONT,
  PAPER,
  RESONANT,
  RESONANT_HOT,
  STONE,
  STONE_EDGE,
  UI_FONT,
  withAlpha,
} from "./palette.ts"

/**
 * A soft additive bloom.
 *
 * A radial gradient and not a flat ellipse: painted at a constant alpha, a
 * translucent disc over near-black stone has a hard rim and reads as an
 * *object* — the hall fills up with grey saucers. Light has no edge.
 */
function glow(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
): void {
  const r = Math.max(1, Math.max(rx, ry))
  const grad = g.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, withAlpha(color, alpha))
  grad.addColorStop(0.45, withAlpha(color, alpha * 0.4))
  grad.addColorStop(1, withAlpha(color, 0))
  g.save()
  g.globalCompositeOperation = "lighter"
  g.fillStyle = grad
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

export function drawHall(g: CanvasRenderingContext2D, geom: Geom): void {
  const grad = g.createLinearGradient(0, 0, 0, geom.h)
  grad.addColorStop(0, HALL_TOP)
  grad.addColorStop(0.6, HALL_TOP)
  grad.addColorStop(1, HALL_LOW)
  g.fillStyle = grad
  g.fillRect(0, 0, geom.w, geom.h)

  // The far wall: a carved band at the horizon, so the beams come *out of*
  // something rather than fading into a void.
  g.fillStyle = STONE
  g.fillRect(0, 0, geom.w, geom.horizonY)
  g.fillStyle = withAlpha(STONE_EDGE, 0.9)
  g.fillRect(0, geom.horizonY - 3, geom.w, 3)

  // Girih as structure, not wallpaper: the wall is scored by the same fan the
  // lattice uses, so the room and the mechanism are visibly the same object.
  g.strokeStyle = withAlpha(STONE_EDGE, 0.5)
  g.lineWidth = 1
  const rows = 4
  for (let r = 1; r <= rows; r++) {
    const y = (geom.horizonY * r) / (rows + 1)
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(geom.w, y)
    g.stroke()
  }

  // The floor plate the runner rides.
  g.fillStyle = STONE
  g.fillRect(0, geom.floorY + 2, geom.w, geom.h - geom.floorY)
  g.fillStyle = withAlpha(STONE_EDGE, 0.75)
  g.fillRect(0, geom.floorY + 2, geom.w, 2)
}

export type BeamStyle = {
  /** 0..1 — how lit this beam is. The ridden beam sits near 1. */
  lit: number
  label: number
}

export function drawBeams(g: CanvasRenderingContext2D, geom: Geom, styles: BeamStyle[]): void {
  for (let i = 0; i < styles.length; i++) {
    const s = styles[i] as BeamStyle
    const foot = columnX(geom, i)
    const lit = Math.max(0, Math.min(1, s.lit))
    // Two strokes: a wide dim halo and a hairline core. The halo is what makes
    // the beam read as light rather than as a drawn line.
    g.globalAlpha = 0.16 + lit * 0.34
    g.strokeStyle = lit > 0.5 ? BEAM_LIT : BEAM
    g.lineWidth = 5 + lit * 7
    g.beginPath()
    g.moveTo(geom.vpX, geom.horizonY)
    g.lineTo(foot, geom.floorY)
    g.stroke()

    g.globalAlpha = 0.45 + lit * 0.55
    g.strokeStyle = lit > 0.5 ? BEAM_HOT : BEAM_LIT
    g.lineWidth = 1 + lit * 1.4
    g.beginPath()
    g.moveTo(geom.vpX, geom.horizonY)
    g.lineTo(foot, geom.floorY)
    g.stroke()
    g.globalAlpha = 1

    // The label, carved into the floor plate at the beam's foot. This is the
    // divisor the child is choosing, so it is the largest chrome on screen.
    const size = Math.max(15, Math.min(geom.w * 0.055, 30))
    g.font = font(NUM_FONT, size)
    g.textAlign = "center"
    g.textBaseline = "middle"
    const ly = geom.labelY
    g.fillStyle = withAlpha(INK, 0.85)
    g.fillText(String(s.label), foot, ly + 1.5)
    g.fillStyle = lit > 0.5 ? BEAM_HOT : withAlpha(PAPER, 0.62)
    g.fillText(String(s.label), foot, ly)
  }
}

/**
 * THE PHASING. Two waveforms drawn along the ridden beam, separated by the
 * phase offset of the automaton overhead.
 *
 * At offset zero the two curves are the same curve and the eye sees one bright
 * line; at any other offset they cross each other repeatedly and the beam looks
 * braided. This is the picture the sound is making, and it carries the same
 * information — so the game is playable with the volume off.
 *
 * Under reduced motion the curves do not travel: `scroll` is passed as a
 * constant and what is drawn is a still figure of the same two waves. That is a
 * branch, not a degradation — the phase relationship, which is the whole point,
 * is fully legible standing still.
 */
export function drawTraces(
  g: CanvasRenderingContext2D,
  geom: Geom,
  col: number,
  phase: number,
  scroll: number,
  samples: number,
  locked: boolean,
): void {
  const foot = columnX(geom, col)
  const dx = foot - geom.vpX
  const dy = geom.floorY - geom.horizonY
  const len = Math.hypot(dx, dy) || 1
  // Perpendicular to the beam, so the wave rides on it rather than across it.
  const nx = -dy / len
  const ny = dx / len
  const CYCLES = 5

  for (const [offset, color, width, alpha] of [
    [0, BEAM_HOT, 2.2, 0.95],
    [phase, locked ? BEAM_HOT : RESONANT, 2.2, locked ? 0.95 : 0.8],
  ] as const) {
    g.strokeStyle = color
    g.lineWidth = width
    g.globalAlpha = alpha
    g.beginPath()
    for (let i = 0; i <= samples; i++) {
      // All the way to 1: the wave has to arrive at the runner's feet. Stopping
      // at 0.98 left an eighty-pixel dead gap above the shuttle, because the
      // perspective divide crowds the last stretch of the beam.
      const t = 0.02 + (i / samples) * 0.98
      const p = project(geom, col, t)
      const amp = 5 + 16 * p.scale
      const wave = Math.sin((t * CYCLES + scroll + offset) * Math.PI * 2)
      const x = p.x + nx * wave * amp
      const y = p.y + ny * wave * amp
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  g.globalAlpha = 1
}

export type HullSpec = {
  x: number
  y: number
  /** Half-width of the hull in screen pixels. */
  r: number
  text: string
  kind: number
  ring: number
  /** 0..1 — resonance with the beam the runner is on right now. */
  hot: number
  glow: boolean
}

const A_CORE = 1
const A_CANDIDATE = 2

// Note what is *not* in `HullSpec`: whether a candidate is the canonical one.
// The renderer is never told, so it cannot leak it. A candidate carrying the
// answer is drawn exactly like one that is not.

export function drawAutomaton(g: CanvasRenderingContext2D, s: HullSpec): void {
  const ringing = s.ring > 0
  const edge = s.kind === A_CORE ? LAPIS_EDGE : ringing ? DISSONANT : s.hot > 0 ? RESONANT : BRASS
  const fill = s.kind === A_CORE ? LAPIS : BRASS_DARK
  const w = s.kind === A_CORE ? s.r * 2.35 : s.r
  const h = s.kind === A_CORE ? s.r * 0.82 : s.r

  if (s.glow) {
    glow(g, s.x, s.y, w * 2.1, h * 2.1, s.hot > 0 ? RESONANT : edge, 0.16 + s.hot * 0.3)
  }

  g.beginPath()
  if (s.kind === A_CORE) {
    // A slab. Wide, flat, unmistakably not one of the numbers.
    g.moveTo(s.x - w, s.y)
    g.lineTo(s.x - w * 0.86, s.y - h)
    g.lineTo(s.x + w * 0.86, s.y - h)
    g.lineTo(s.x + w, s.y)
    g.lineTo(s.x + w * 0.86, s.y + h)
    g.lineTo(s.x - w * 0.86, s.y + h)
  } else if (s.kind === A_CANDIDATE) {
    // A hexagon — a thing that was struck off something larger.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      const px = s.x + Math.cos(a) * w
      const py = s.y + Math.sin(a) * h
      if (i === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    }
  } else {
    // A rhombus, point down: it reads as descending even in a still frame.
    g.moveTo(s.x, s.y - h * 1.12)
    g.lineTo(s.x + w, s.y)
    g.lineTo(s.x, s.y + h * 1.12)
    g.lineTo(s.x - w, s.y)
  }
  g.closePath()
  g.fillStyle = fill
  g.fill()
  g.lineWidth = Math.max(1.2, s.r * 0.11)
  g.strokeStyle = edge
  g.stroke()

  if (s.hot > 0 && s.kind !== A_CORE) {
    // The lock ring: the automaton the runner's beam currently divides wears a
    // hairline of the resonance colour. Confirmation, after the judgement.
    g.globalAlpha = 0.55 + s.hot * 0.45
    g.lineWidth = Math.max(1, s.r * 0.07)
    g.strokeStyle = RESONANT_HOT
    g.beginPath()
    g.ellipse(s.x, s.y, w * 1.32, h * 1.32, 0, 0, Math.PI * 2)
    g.stroke()
    g.globalAlpha = 1
  }

  const size = Math.max(9, s.kind === A_CORE ? s.r * 0.78 : s.r * 1.05)
  g.font = font(NUM_FONT, size)
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillStyle = withAlpha(INK, 0.8)
  g.fillText(s.text, s.x, s.y + 1.2)
  g.fillStyle = s.kind === A_CORE ? LAPIS_HOT : ringing ? PAPER : BRASS_HOT
  g.fillText(s.text, s.x, s.y)
}

/** The runner: a brass shuttle seated on the floor plate. */
export function drawRunner(
  g: CanvasRenderingContext2D,
  geom: Geom,
  col: number,
  charge: number,
  lit: boolean,
): void {
  const x = columnX(geom, col)
  const y = geom.floorY
  const r = Math.max(15, Math.min(geom.w * 0.045, 30))
  if (lit) glow(g, x, y, r * 2.4, r * 1.5, BEAM_LIT, 0.2 + charge * 0.34)
  g.beginPath()
  g.moveTo(x, y - r * 1.15)
  g.lineTo(x + r * 0.92, y + r * 0.55)
  g.lineTo(x, y + r * 0.18)
  g.lineTo(x - r * 0.92, y + r * 0.55)
  g.closePath()
  g.fillStyle = BRASS
  g.fill()
  g.lineWidth = 2
  g.strokeStyle = charge > 0.5 ? BEAM_HOT : BRASS_HOT
  g.stroke()
}

/** The pulse: a rung of light climbing the beam. */
export function drawPulse(
  g: CanvasRenderingContext2D,
  geom: Geom,
  col: number,
  t: number,
): void {
  const p = project(geom, col, t)
  const w = (18 + 34 * p.scale) * 0.5
  g.save()
  g.globalCompositeOperation = "lighter"
  for (const [ww, a, hh] of [
    [w * 1.9, 0.22, 9],
    [w, 0.8, 4],
    [w * 0.5, 1, 2],
  ] as const) {
    g.globalAlpha = a
    g.fillStyle = a === 1 ? BEAM_HOT : BEAM_LIT
    g.fillRect(p.x - ww, p.y - hh * p.scale * 0.9, ww * 2, hh * p.scale * 1.8 + 1.5)
  }
  g.restore()
  g.globalAlpha = 1
}

/** The anchors: three lamps set into the floor plate. */
export function drawAnchors(
  g: CanvasRenderingContext2D,
  geom: Geom,
  lit: number,
  total: number,
  credit: number,
  perAnchor: number,
): void {
  // Placed by the geometry, under the host's how-to-play control rather than
  // behind it. The anchors ARE the lives: three lamps hidden by a button is a
  // child who cannot tell how close the lattice is to going dark.
  const { r, gap, y } = geom.anchors
  const x0 = geom.anchors.right - (total - 1) * gap
  for (let i = 0; i < total; i++) {
    const on = i < lit
    g.beginPath()
    g.arc(x0 + i * gap, y, r, 0, Math.PI * 2)
    g.fillStyle = on ? RESONANT : withAlpha(PAPER, 0.13)
    g.fill()
    if (on) glow(g, x0 + i * gap, y, r * 2.4, r * 2.4, RESONANT, 0.4)
  }
  // Progress toward relighting one, drawn as an arc filling on the next lamp.
  if (lit < total && credit > 0) {
    const cx = x0 + lit * gap
    g.beginPath()
    g.arc(cx, y, r + 3, -Math.PI / 2, -Math.PI / 2 + (credit / perAnchor) * Math.PI * 2)
    g.strokeStyle = RESONANT_HOT
    g.lineWidth = 2
    g.stroke()
  }
}

export function drawScore(
  g: CanvasRenderingContext2D,
  geom: Geom,
  score: number,
  resonance: number,
): void {
  // Under the host's exit control, not behind it. `(14, 20)` was the exact
  // square the host paints "back" into.
  const { x, y } = geom.hud
  g.font = font(UI_FONT, Math.max(17, Math.min(geom.area.w * 0.055, 27)))
  g.textAlign = "left"
  g.textBaseline = "middle"
  g.fillStyle = withAlpha(PAPER, 0.9)
  g.fillText(String(score), x, y + 20)
  if (resonance > 1) {
    g.font = font(UI_FONT, 14)
    g.fillStyle = RESONANT
    g.fillText(`RESONANCE ×${resonance}`, x, y + 42)
  }
}
