/**
 * beatlounge — "New…" world form: renders the eight lockable facet rows, toggles
 * a lock, rerolls (keeping locks), and applies on Create. The roll/lock/build math
 * is covered in startFresh.test.ts; here we test the surface + controller wiring
 * with a stub controller.
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { NewWorldForm } from "./NewWorldForm"
import { rollDraftWorld } from "./startFresh"
import type { ScenesController } from "./scenesController"
import { makeRng } from "../../music/chords/random"

let container: HTMLDivElement | null = null
let root: Root | null = null

const draft = rollDraftWorld(makeRng(1))
const makeCtrl = () =>
  ({
    rollWorld: vi.fn(() => draft),
    applyWorld: vi.fn(),
  }) as unknown as ScenesController

const render = (props: Parameters<typeof NewWorldForm>[0]) => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(<NewWorldForm {...props} />))
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  container = null
  root = null
})

describe("NewWorldForm", () => {
  it("renders all eight facet rows", () => {
    render({ ctrl: makeCtrl(), onCreate: () => {}, onCancel: () => {} })
    expect(container!.querySelectorAll(".bl-newworld-row").length).toBe(8)
    // a couple of human labels are present
    const facets = Array.from(container!.querySelectorAll(".bl-newworld-facet")).map(
      (e) => e.textContent
    )
    expect(facets).toContain("Meter")
    expect(facets).toContain("Groove")
  })

  it("toggles a facet lock", () => {
    render({ ctrl: makeCtrl(), onCreate: () => {}, onCancel: () => {} })
    const lock = container!.querySelector<HTMLButtonElement>('button[aria-label="Lock Meter"]')!
    expect(lock.getAttribute("aria-pressed")).toBe("false")
    act(() => lock.click())
    expect(lock.getAttribute("aria-pressed")).toBe("true")
    expect(lock.classList.contains("is-locked")).toBe(true)
  })

  it("reroll asks the controller for a fresh draft, carrying the current draft", () => {
    const ctrl = makeCtrl()
    render({ ctrl, onCreate: () => {}, onCancel: () => {} })
    ;(ctrl.rollWorld as ReturnType<typeof vi.fn>).mockClear()
    act(() => container!.querySelector<HTMLButtonElement>(".bl-newworld-reroll")!.click())
    expect(ctrl.rollWorld).toHaveBeenCalledTimes(1)
    expect((ctrl.rollWorld as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      from: draft,
    })
  })

  it("per-facet dice rerolls only that facet (locks every other one)", () => {
    const ctrl = makeCtrl()
    render({ ctrl, onCreate: () => {}, onCancel: () => {} })
    ;(ctrl.rollWorld as ReturnType<typeof vi.fn>).mockClear()
    const dice = container!.querySelector<HTMLButtonElement>('button[aria-label="Reroll Kit"]')!
    act(() => dice.click())
    expect(ctrl.rollWorld).toHaveBeenCalledTimes(1)
    const arg = (ctrl.rollWorld as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.from).toBe(draft)
    // every facet but "kit" is locked, so only kit can move
    const locked = arg.lock as ReadonlySet<string>
    expect(locked.has("kit")).toBe(false)
    expect(locked.has("meter")).toBe(true)
    expect(locked.size).toBe(7)
  })

  it("disables a facet's dice while that facet is locked", () => {
    render({ ctrl: makeCtrl(), onCreate: () => {}, onCancel: () => {} })
    const dice = () =>
      container!.querySelector<HTMLButtonElement>('button[aria-label="Reroll Meter"]')!
    expect(dice().disabled).toBe(false)
    act(() => container!.querySelector<HTMLButtonElement>('button[aria-label="Lock Meter"]')!.click())
    expect(dice().disabled).toBe(true)
  })

  it("Create applies the draft and notifies the caller", () => {
    const ctrl = makeCtrl()
    const onCreate = vi.fn()
    render({ ctrl, onCreate, onCancel: () => {} })
    act(() => container!.querySelector<HTMLButtonElement>(".bl-newworld-create")!.click())
    expect(ctrl.applyWorld).toHaveBeenCalledWith(draft)
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})
