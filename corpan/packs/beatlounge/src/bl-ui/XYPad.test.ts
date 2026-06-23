import { describe, expect, it } from "vitest"
import { mapPointerToValues, type XYAxis } from "./XYPad"

const rect = { left: 100, top: 200, width: 300, height: 300 }

const xAxis: XYAxis = { value: 0, min: 20, max: 18000, label: "Cutoff" }
const yAxis: XYAxis = { value: 0, min: 0.1, max: 20, label: "Q" }

describe("mapPointerToValues", () => {
  it("maps the top-left corner to (x.min, y.max) — Y is inverted", () => {
    const v = mapPointerToValues(rect, rect.left, rect.top, xAxis, yAxis)
    expect(v.x).toBeCloseTo(xAxis.min, 6)
    expect(v.y).toBeCloseTo(yAxis.max, 6) // top = max
  })

  it("maps the bottom-right corner to (x.max, y.min)", () => {
    const v = mapPointerToValues(
      rect,
      rect.left + rect.width,
      rect.top + rect.height,
      xAxis,
      yAxis
    )
    expect(v.x).toBeCloseTo(xAxis.max, 6)
    expect(v.y).toBeCloseTo(yAxis.min, 6) // bottom = min
  })

  it("maps the bottom-left corner to (x.min, y.min)", () => {
    const v = mapPointerToValues(rect, rect.left, rect.top + rect.height, xAxis, yAxis)
    expect(v.x).toBeCloseTo(xAxis.min, 6)
    expect(v.y).toBeCloseTo(yAxis.min, 6)
  })

  it("maps the center to the midpoint of both ranges", () => {
    const v = mapPointerToValues(
      rect,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      xAxis,
      yAxis
    )
    expect(v.x).toBeCloseTo((xAxis.min + xAxis.max) / 2, 6)
    expect(v.y).toBeCloseTo((yAxis.min + yAxis.max) / 2, 6)
  })

  it("clamps a pointer outside the rect to the range bounds", () => {
    // Far above-left → x.min, y.max (Y inverted, above the top is still max).
    const above = mapPointerToValues(rect, rect.left - 500, rect.top - 500, xAxis, yAxis)
    expect(above.x).toBe(xAxis.min)
    expect(above.y).toBe(yAxis.max)
    // Far below-right → x.max, y.min.
    const below = mapPointerToValues(
      rect,
      rect.left + rect.width + 500,
      rect.top + rect.height + 500,
      xAxis,
      yAxis
    )
    expect(below.x).toBe(xAxis.max)
    expect(below.y).toBe(yAxis.min)
  })

  it("round-trips: a value's normalized position maps back to that value", () => {
    for (const target of [25, 50, 75]) {
      const frac = target / 100
      // Place the pointer at `frac` across X and `frac` UP from the bottom for Y.
      const clientX = rect.left + frac * rect.width
      const clientY = rect.top + (1 - frac) * rect.height
      const v = mapPointerToValues(rect, clientX, clientY, xAxis, yAxis)
      expect(v.x).toBeCloseTo(xAxis.min + frac * (xAxis.max - xAxis.min), 4)
      expect(v.y).toBeCloseTo(yAxis.min + frac * (yAxis.max - yAxis.min), 4)
    }
  })

  it("is independent per-axis (X position does not affect Y value)", () => {
    const left = mapPointerToValues(rect, rect.left, rect.top + 90, xAxis, yAxis)
    const right = mapPointerToValues(rect, rect.left + rect.width, rect.top + 90, xAxis, yAxis)
    expect(left.y).toBeCloseTo(right.y, 6)
    expect(left.x).not.toBeCloseTo(right.x, 1)
  })

  it("handles a zero-size rect without NaN (degenerate guard)", () => {
    const degenerate = { left: 0, top: 0, width: 0, height: 0 }
    const v = mapPointerToValues(degenerate, 50, 50, xAxis, yAxis)
    expect(Number.isFinite(v.x)).toBe(true)
    expect(Number.isFinite(v.y)).toBe(true)
    // nx=0 → x.min; ny = 1 - 0 = 1 → y.max.
    expect(v.x).toBe(xAxis.min)
    expect(v.y).toBe(yAxis.max)
  })

  it("supports descending-friendly ranges and arbitrary axes", () => {
    const delayTime: XYAxis = { value: 0, min: 0, max: 3, label: "Time" }
    const feedback: XYAxis = { value: 0, min: 0, max: 1, label: "Feedback" }
    const v = mapPointerToValues(
      rect,
      rect.left + rect.width * 0.25,
      rect.top + rect.height * 0.25, // 0.75 up → 0.75 of feedback
      delayTime,
      feedback
    )
    expect(v.x).toBeCloseTo(0.75, 6)
    expect(v.y).toBeCloseTo(0.75, 6)
  })
})
