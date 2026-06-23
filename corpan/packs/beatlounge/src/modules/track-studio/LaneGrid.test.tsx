/**
 * beatlounge — LaneGrid select-mode (#331). A cell stroke normally PAINTS (place /
 * clear notes). When `selectMode` is on, the stroke instead toggles the SELECTION
 * of lit notes (off cells are ignored), without touching the paint path — so the
 * Drums page (which omits the select props) is unaffected.
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { LaneGrid, type LaneGridLane } from "./LaneGrid"

let container: HTMLDivElement | null = null
let root: Root | null = null

// Lane A: [on, off]   Lane B: [off, on]
const lanes: LaneGridLane[] = [
  { key: "a", selectKey: "a", label: "A", cells: [{ on: true, velocity: 1 }, { on: false, velocity: 0 }] },
  { key: "b", selectKey: "b", label: "B", cells: [{ on: false, velocity: 0 }, { on: true, velocity: 1 }] },
]
const isCellOn = (li: number, s: number) => lanes[li].cells[s].on

const baseProps = {
  lanes,
  steps: 2,
  stepsPerBeat: 1,
  playStep: -1,
  silent: false,
  selected: new Set<string>(),
  onToggleLane: () => {},
}

const render = (props: Parameters<typeof LaneGrid>[0]) => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(<LaneGrid {...props} />))
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  container = null
  root = null
})

const cells = () => Array.from(container!.querySelectorAll<HTMLButtonElement>('[role="gridcell"]'))
// cells order: [A:0 on, A:1 off, B:0 off, B:1 on]
const down = (el: HTMLButtonElement) =>
  act(() => {
    el.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true }))
  })

describe("LaneGrid — select mode (#331)", () => {
  it("paints (not selects) when selectMode is off — Drums behaviour unchanged", () => {
    const setCell = vi.fn()
    const setCellSelected = vi.fn()
    render({ ...baseProps, setCell, isCellOn, setCellSelected })
    down(cells()[1]) // A:1, an off cell → paint it on
    expect(setCell).toHaveBeenCalledWith(0, 1, true)
    expect(setCellSelected).not.toHaveBeenCalled()
  })

  it("selects a lit note (and not the paint path) in select mode", () => {
    const setCell = vi.fn()
    const setCellSelected = vi.fn()
    render({ ...baseProps, selectMode: true, selectedCells: new Set(), setCell, isCellOn, setCellSelected })
    down(cells()[0]) // A:0, a lit note → select it
    expect(setCellSelected).toHaveBeenCalledWith(0, 0, true)
    expect(setCell).not.toHaveBeenCalled()
  })

  it("ignores empty (off) cells in select mode — only notes are selectable", () => {
    const setCellSelected = vi.fn()
    render({ ...baseProps, selectMode: true, selectedCells: new Set(), setCell: vi.fn(), isCellOn, setCellSelected })
    down(cells()[1]) // A:1, an off cell
    expect(setCellSelected).not.toHaveBeenCalled()
  })

  it("drags across notes to select them (touch drag extends the stroke)", () => {
    const setCellSelected = vi.fn()
    render({ ...baseProps, selectMode: true, selectedCells: new Set(), setCell: vi.fn(), isCellOn, setCellSelected })
    down(cells()[0]) // A:0 (lit) → start a select stroke
    // finger drags onto B:1 (lit) — pointerenter must extend the selection
    act(() => cells()[3].dispatchEvent(new PointerEvent("pointerover", { bubbles: true })))
    expect(setCellSelected).toHaveBeenCalledWith(0, 0, true) // the initial cell
    expect(setCellSelected).toHaveBeenCalledWith(1, 1, true) // the dragged-onto cell
  })

  it("a hover (no active stroke) never selects", () => {
    const setCellSelected = vi.fn()
    render({ ...baseProps, selectMode: true, selectedCells: new Set(), setCell: vi.fn(), isCellOn, setCellSelected })
    act(() => cells()[3].dispatchEvent(new PointerEvent("pointerover", { bubbles: true })))
    expect(setCellSelected).not.toHaveBeenCalled()
  })

  it("deselects an already-selected note (toggle)", () => {
    const setCellSelected = vi.fn()
    render({
      ...baseProps,
      selectMode: true,
      selectedCells: new Set(["0:0"]),
      setCell: vi.fn(),
      isCellOn,
      setCellSelected,
    })
    down(cells()[0]) // A:0, already selected → toggle off
    expect(setCellSelected).toHaveBeenCalledWith(0, 0, false)
  })

  it("marks a selected lit cell with is-selected-cell", () => {
    render({
      ...baseProps,
      selectMode: true,
      selectedCells: new Set(["1:1"]),
      setCell: vi.fn(),
      isCellOn,
      setCellSelected: vi.fn(),
    })
    expect(cells()[3].classList.contains("is-selected-cell")).toBe(true) // B:1 (lit, selected)
    expect(cells()[0].classList.contains("is-selected-cell")).toBe(false) // A:0 (lit, not selected)
  })
})
