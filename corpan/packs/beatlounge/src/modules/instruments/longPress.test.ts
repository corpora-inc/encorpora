/**
 * beatlounge — long-press vs tap decision tests (pure). The track-switcher chip
 * SWITCHES on a quick tap and RENAMES on a deliberate hold; this is the pure rule
 * the component wires to a timer + pointer handlers.
 */

import { describe, expect, it } from "vitest"
import {
  LONG_PRESS_MS,
  MOVE_TOLERANCE_PX,
  isDrag,
  resolveRelease,
  type PressStart,
} from "./longPress"

const start: PressStart = { x: 100, y: 100, t: 1000 }

describe("isDrag", () => {
  it("is false for an in-place pointer (within tolerance)", () => {
    expect(isDrag(start, 103, 102)).toBe(false)
  })
  it("is true once the pointer drifts past the slop radius", () => {
    expect(isDrag(start, 100 + MOVE_TOLERANCE_PX + 1, 100)).toBe(true)
  })
})

describe("resolveRelease", () => {
  it("a quick, in-place release is a TAP (switch)", () => {
    expect(resolveRelease(start, { x: 101, y: 101, t: start.t + 120 })).toBe("tap")
  })
  it("a held, in-place release is a LONG-PRESS (rename)", () => {
    expect(resolveRelease(start, { x: 100, y: 100, t: start.t + LONG_PRESS_MS })).toBe("long")
  })
  it("just under the threshold is still a TAP", () => {
    expect(resolveRelease(start, { x: 100, y: 100, t: start.t + LONG_PRESS_MS - 1 })).toBe("tap")
  })
  it("a drifting release is a DRAG (ignored — neither switch nor rename)", () => {
    expect(resolveRelease(start, { x: 200, y: 100, t: start.t + 50 })).toBe("drag")
  })
  it("drift wins even past the hold threshold (a scroll, not a hold)", () => {
    expect(resolveRelease(start, { x: 300, y: 100, t: start.t + LONG_PRESS_MS + 200 })).toBe(
      "drag"
    )
  })
})
