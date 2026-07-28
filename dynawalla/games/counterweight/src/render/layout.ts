// Where everything stands, computed once per resize.
//
// Phone portrait, tablet portrait and a desktop window are all first-class: the
// stack is the same everywhere and only the proportions move. Nothing is
// measured from text — numerals live on a tabular grid, so a four-digit load
// does not push the beam down after a two-digit one.

import { PLACES, type Place } from "../game/places.ts"

export type Rect = { x: number; y: number; w: number; h: number }

export type PillarRects = {
  readonly place: Place
  /** Hang weight on. */
  readonly up: Rect
  /** Take weight off. */
  readonly down: Rect
  readonly cx: number
}

export type Layout = {
  readonly w: number
  readonly h: number
  /** Narrow enough that the rack labels shorten and the pans stack tighter. */
  readonly compact: boolean
  readonly unit: number
  readonly hud: Rect
  readonly stage: Rect
  readonly fulcrum: { x: number; y: number }
  /** Half the beam, centre to pan hook. */
  readonly arm: number
  readonly panDrop: number
  readonly panW: number
  readonly panH: number
  readonly gauge: Rect
  readonly rack: Rect
  readonly pillars: readonly PillarRects[]
  readonly seat: Rect
}

export function layoutFor(w: number, h: number): Layout {
  const compact = Math.min(w, h) < 420
  const unit = Math.max(11, Math.min(w, h) * (compact ? 0.038 : 0.03))

  const pad = Math.round(unit * 0.9)
  const hudH = Math.round(unit * 3.1)
  // The rack is the thing a thumb has to reach, so it is sized from the shorter
  // edge and given the floor rather than the leftovers.
  const rackH = Math.round(Math.min(h * 0.34, unit * 12.4))
  const seatH = Math.round(Math.min(h * 0.1, unit * 3.4))
  const gaugeH = Math.round(unit * 1.5)

  const hud: Rect = { x: pad, y: pad, w: w - pad * 2, h: hudH }
  const seat: Rect = { x: pad, y: h - pad - seatH, w: w - pad * 2, h: seatH }
  const rack: Rect = { x: pad, y: seat.y - pad * 0.6 - rackH, w: w - pad * 2, h: rackH }
  const gauge: Rect = {
    x: pad,
    y: rack.y - pad * 0.5 - gaugeH,
    w: w - pad * 2,
    h: gaugeH,
  }
  const stageTop = hud.y + hud.h + pad * 0.4
  const stage: Rect = { x: pad, y: stageTop, w: w - pad * 2, h: Math.max(unit * 6, gauge.y - pad * 0.5 - stageTop) }

  const arm = Math.min(stage.w * 0.4, stage.h * 0.78)
  const panW = Math.min(arm * 0.92, stage.w * 0.42)
  const panH = Math.min(stage.h * 0.46, unit * 6.2)
  const panDrop = Math.min(stage.h * 0.3, unit * 3.2)
  const fulcrum = {
    x: stage.x + stage.w / 2,
    y: stage.y + Math.min(stage.h * 0.34, unit * 4.4),
  }

  const gap = Math.round(unit * 0.5)
  const pillarW = (rack.w - gap * (PLACES.length - 1)) / PLACES.length
  const faceH = (rack.h - gap) / 2
  const pillars: PillarRects[] = PLACES.map((place, i) => {
    const x = rack.x + i * (pillarW + gap)
    return {
      place,
      up: { x, y: rack.y, w: pillarW, h: faceH },
      down: { x, y: rack.y + faceH + gap, w: pillarW, h: faceH },
      cx: x + pillarW / 2,
    }
  })

  return {
    w,
    h,
    compact,
    unit,
    hud,
    stage,
    fulcrum,
    arm,
    panDrop,
    panW,
    panH,
    gauge,
    rack,
    pillars,
    seat,
  }
}

export function hit(rect: Rect, x: number, y: number, slack = 0): boolean {
  return (
    x >= rect.x - slack &&
    x <= rect.x + rect.w + slack &&
    y >= rect.y - slack &&
    y <= rect.y + rect.h + slack
  )
}
