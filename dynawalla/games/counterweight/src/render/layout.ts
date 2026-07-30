// Where everything stands, computed once per resize.
//
// Phone portrait, tablet portrait and a desktop window are all first-class: the
// stack is the same everywhere and only the proportions move. Nothing is
// measured from text — numerals live on a tabular grid, so a four-digit load
// does not push the beam down after a two-digit one.
//
// **Two things constrain the yard beyond the glass it is drawn on.**
//
// The first is the safe area. This pack declares `viewport-fit=cover`, which
// opts the document *into* the notch, the home indicator and the rounded
// corners. A canvas cannot read `env()`, so `layoutFor` takes the safe
// rectangle as an argument and every readable, touchable part of the yard is
// measured from it rather than from `(0, 0, w, h)`. The backdrop still bleeds
// to the full canvas — that is what `cover` is for.
//
// The second is the host's chrome. The host floats an exit control over the
// top-LEFT corner and the how-to-play control over the top-RIGHT, 44px each.
// They overlay; the room does not get to reserve a band under them, because
// giving up 67px of a 568px phone is worse than the problem it solves. So the
// HUD row — `SCALE n` at one end, the tally at the other, the day's run between
// them — is inset HORIZONTALLY, into the strip between the two corners. That
// costs no height at all, and on the narrowest phone we support the strip is
// still a little over 200px wide.

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  safeInsets,
  safeRect,
} from "../../../../packs/shared/game-chrome/index.ts"
import type { Insets } from "../../../../packs/shared/game-chrome/index.ts"
import { PLACES, type Place } from "../game/places.ts"
import { MAX_TILT } from "../sim/beam.ts"

/**
 * The platform's minimum touch target, and this game's floor for both of them.
 *
 * The rack and the stamp are the whole input vocabulary — eight faces and one
 * lever. A face a child misses is a blow they meant to land, and on this beam a
 * blow they did not mean to land is a shear. So these two get the floor and the
 * rest of the stack takes what is left, not the other way round.
 */
export const TOUCH_FLOOR = 44

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
  /** The strain gauge, and nothing else. There is no clock in this row. */
  readonly gauge: Rect
  readonly rack: Rect
  readonly pillars: readonly PillarRects[]
  readonly stamp: Rect
}

/**
 * The weigh-house, laid out inside `area`.
 *
 * `area` is REQUIRED, and deliberately so. An optional safe rectangle is a
 * rectangle a caller forgets, and forgetting it compiles, passes every test and
 * then draws the stamp under the home indicator on a device nobody in the room
 * is holding. Callers who just want "the current screen" want
 * `viewLayout` below, which is the one the renderer uses.
 */
export function layoutFor(w: number, h: number, area: Rect): Layout {
  const short = Math.max(1, Math.min(area.w, area.h))
  const compact = short < 420
  const unit = Math.max(11, short * (compact ? 0.038 : 0.03))

  const pad = Math.round(unit * 0.9)
  const gap = Math.round(unit * 0.5)
  const hudH = Math.round(unit * 3.1)
  // The rack is the thing a thumb has to reach, so it is sized from the shorter
  // edge and given the floor rather than the leftovers — literally the floor:
  // two faces of at least 44px, whatever that costs the stage above it.
  const rackH = Math.round(
    Math.max(TOUCH_FLOOR * 2 + gap, Math.min(area.h * 0.34, unit * 12.4)),
  )
  // The stamp commits the answer. It was sized at a tenth of the height, which
  // on a phone held sideways is 39px — under the touch floor, for the one
  // control the whole round ends on.
  const stampH = Math.round(Math.max(TOUCH_FLOOR, Math.min(area.h * 0.1, unit * 3.4)))
  const gaugeH = Math.round(unit * 1.5)

  const innerX = area.x + pad
  const innerW = area.w - pad * 2

  // The HUD, and only the HUD, steps in past the host's two corners. Nothing
  // else up here is read or touched, and nothing below the corners needs it.
  const corner = HOST_MARGIN + HOST_CONTROL + Math.round(unit * 0.4)
  const hudX = area.x + corner
  const hudW = Math.max(unit * 4, area.w - corner * 2)

  // Four faces at the touch floor is the requirement. The margin beside the
  // rack and the gaps between its pillars are not: on a narrow safe area they
  // give way first, because a 41px plate is a plate a child misses.
  const rackNeeds = TOUCH_FLOOR * PLACES.length
  const rackPad = Math.min(pad, Math.max(0, (area.w - rackNeeds) / 2))
  const rackX = area.x + rackPad
  const rackW = area.w - rackPad * 2
  const faceGap = Math.max(0, Math.min(gap, (rackW - rackNeeds) / (PLACES.length - 1)))

  const hud: Rect = { x: hudX, y: area.y + pad, w: hudW, h: hudH }
  const stamp: Rect = { x: innerX, y: area.y + area.h - pad - stampH, w: innerW, h: stampH }
  const rack: Rect = { x: rackX, y: stamp.y - pad * 0.6 - rackH, w: rackW, h: rackH }
  const gauge: Rect = {
    x: innerX,
    y: rack.y - pad * 0.5 - gaugeH,
    w: innerW,
    h: gaugeH,
  }
  // The stage carries the two numbers of the round — the chit and your brass —
  // so it starts below the host's corners as well as below the HUD. On a phone
  // that is a few pixels; the HUD is already almost past them.
  const stageTop = Math.max(
    hud.y + hud.h + pad * 0.4,
    area.y + HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL,
  )
  const stage: Rect = {
    x: innerX,
    y: stageTop,
    w: innerW,
    h: Math.max(0, gauge.y - pad * 0.5 - stageTop),
  }

  const arm = Math.min(stage.w * 0.36, stage.h * 0.78)
  // A pan hangs centred on the end of the beam, so half of it sticks out past
  // the hook. `stage.w - 2 * arm` is the width that leaves it exactly inside
  // the stage when the beam is level, which is the widest the beam ever
  // reaches; every tilt is narrower.
  const panW = Math.max(unit * 3, Math.min(arm * 0.92, stage.w * 0.42, stage.w - arm * 2))
  const fulcrumDrop = Math.min(stage.h * 0.34, unit * 4.4)
  // The room below the *lowest* the far hook ever swings. Chain and pan have to
  // fit in that, or a tilted beam posts the number a child is reading off the
  // bottom of the stage and into the gauge.
  const room = Math.max(0, stage.h - fulcrumDrop - Math.sin(MAX_TILT) * arm)
  const panDrop = Math.min(stage.h * 0.3, unit * 3.2, room * 0.3)
  const panH = Math.min(stage.h * 0.46, unit * 6.2, room - panDrop)
  const fulcrum = {
    x: stage.x + stage.w / 2,
    y: stage.y + fulcrumDrop,
  }

  const pillarW = (rack.w - faceGap * (PLACES.length - 1)) / PLACES.length
  const faceH = (rack.h - faceGap) / 2
  const pillars: PillarRects[] = PLACES.map((place, i) => {
    const x = rack.x + i * (pillarW + faceGap)
    return {
      place,
      up: { x, y: rack.y, w: pillarW, h: faceH },
      down: { x, y: rack.y + faceH + faceGap, w: pillarW, h: faceH },
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
    stamp,
  }
}

/**
 * The layout for the screen as it actually is.
 *
 * **This is the only entry point the renderer uses**, and that is the point of
 * it existing. If the test called `layoutFor` with a safe rectangle it made up
 * itself, it would pass whether or not the renderer ever asked for one — the
 * clearance would be a property of the test, not of the game. Going through
 * here means the test walks the same path the frame does.
 */
export function viewLayout(w: number, h: number, insets: Insets = safeInsets()): Layout {
  return layoutFor(w, h, safeRect(w, h, insets))
}

/** Where the two hooks are, at a given tilt. The beam is drawn between them. */
export function beamEnds(
  l: Layout,
  tilt: number,
): { lx: number; ly: number; rx: number; ry: number } {
  const dx = Math.cos(tilt) * l.arm
  const dy = Math.sin(tilt) * l.arm
  return {
    lx: l.fulcrum.x - dx,
    ly: l.fulcrum.y - dy,
    rx: l.fulcrum.x + dx,
    ry: l.fulcrum.y + dy,
  }
}

/** The pan hanging from a hook: centred on it, one chain-drop below. */
export function panRect(l: Layout, hookX: number, hookY: number): Rect {
  return { x: hookX - l.panW / 2, y: hookY + l.panDrop, w: l.panW, h: l.panH }
}

/**
 * The box both pans stay inside across every tilt the beam is read at.
 *
 * The brass and the chit are the two numbers of the round, so this is the rect
 * the tests hold to the safe area. A shear *slams* past this — that is a
 * transient with nothing readable in it, and it is meant to look like the beam
 * lost the argument.
 */
export function panExtent(l: Layout): Rect {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const tilt of [-MAX_TILT, 0, MAX_TILT]) {
    const ends = beamEnds(l, tilt)
    for (const r of [panRect(l, ends.lx, ends.ly), panRect(l, ends.rx, ends.ry)]) {
      x0 = Math.min(x0, r.x)
      y0 = Math.min(y0, r.y)
      x1 = Math.max(x1, r.x + r.w)
      y1 = Math.max(y1, r.y + r.h)
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function hit(rect: Rect, x: number, y: number, slack = 0): boolean {
  return (
    x >= rect.x - slack &&
    x <= rect.x + rect.w + slack &&
    y >= rect.y - slack &&
    y <= rect.y + rect.h + slack
  )
}
