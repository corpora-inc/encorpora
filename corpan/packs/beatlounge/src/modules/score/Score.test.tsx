/**
 * beatlounge — SCORE editor UI integration. Verifies the Auto migration: the
 * Feel/Motion selects + the Auto chip read/write the persisted auto-melody store
 * (not local component state), the Variation + Density controls appear ONLY when
 * armed (progressive disclosure), and a hand edit (paint a cell / +/- layer dial)
 * on an armed track auto-disarms it so manual touch wins.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { createCommandBus } from "../../model/commandBus"
import { createBeatloungeStore } from "../../store/store"
import { createDefaultDoc, isInstrumentTrack, type Id } from "../../model/document"
import type { BeatloungeHost } from "../../contracts/module"
import type { AudioFacade } from "../../contracts/audioFacade"
import { __resetAutoMelodyForTest, getAutoConfig } from "../../store/autoMelody"
import { METRIC_PROFILES } from "../../music/melody"
import { Score } from "./Score"

// Opt into React's act() environment so state updates flush synchronously in
// tests (silences the "not configured to support act(...)" warning).
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null
let root: Root | null = null

const fakeHost = { toast: vi.fn() } as unknown as BeatloungeHost
const fakeAudio = {
  start: async () => {},
  stop: () => {},
  isPlaying: () => false,
  onPlayhead: () => () => {},
  previewTrack: () => {},
  applyParam: () => {},
  playLiveVoice: () => undefined,
  context: () => ({}) as AudioContext,
  dispose: () => {},
} as unknown as AudioFacade

const setup = () => {
  const doc = createDefaultDoc(0)
  const bus = createCommandBus(doc)
  const store = createBeatloungeStore(bus)
  const trackId = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
  )!.id as Id
  return { store, trackId }
}

const render = (ui: React.ReactElement) => {
  act(() => {
    root!.render(ui)
  })
}

beforeEach(() => {
  __resetAutoMelodyForTest()
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  container = null
  root = null
})

const q = <T extends Element>(sel: string): T | null => container!.querySelector<T>(sel)
const chip = (): HTMLButtonElement => {
  const btns = Array.from(container!.querySelectorAll("button"))
  const c = btns.find((b) => b.textContent?.trim() === "Auto")
  if (!c) throw new Error("Auto chip not found")
  return c as HTMLButtonElement
}

describe("Auto chip drives the store", () => {
  it("starts disarmed; the Variation + Density controls are hidden", () => {
    const { store, trackId } = setup()
    render(<Score host={fakeHost} store={store} trackId={trackId} audio={fakeAudio} />)
    expect(chip().getAttribute("aria-pressed")).toBe("false")
    expect(q('[aria-label="Variation"]')).toBeNull()
    expect(q('[aria-label="Density"]')).toBeNull()
  })

  it("tapping Auto arms the store and reveals Variation + Density", () => {
    const { store, trackId } = setup()
    render(<Score host={fakeHost} store={store} trackId={trackId} audio={fakeAudio} />)
    act(() => chip().click())
    expect(getAutoConfig(trackId).on).toBe(true)
    expect(chip().getAttribute("aria-pressed")).toBe("true")
    expect(q('[aria-label="Variation"]')).not.toBeNull()
    expect(q('[aria-label="Density"]')).not.toBeNull()
  })
})

describe("Feel select writes the store", () => {
  it("changing Feel updates the persisted metricId", () => {
    const { store, trackId } = setup()
    render(<Score host={fakeHost} store={store} trackId={trackId} audio={fakeAudio} />)
    const feel = q<HTMLSelectElement>('select[aria-label="Melodic feel"]')!
    const target = METRIC_PROFILES[2].id
    act(() => {
      feel.value = target
      feel.dispatchEvent(new Event("change", { bubbles: true }))
    })
    expect(getAutoConfig(trackId).metricId).toBe(target)
  })
})

describe("Density stepper writes the store", () => {
  it("+ raises density, - lowers it (clamped)", () => {
    const { store, trackId } = setup()
    render(<Score host={fakeHost} store={store} trackId={trackId} audio={fakeAudio} />)
    act(() => chip().click()) // arm to reveal the stepper
    const base = getAutoConfig(trackId).density
    const densityGroup = q<HTMLElement>('[aria-label="Density"]')!
    const busier = densityGroup.querySelector<HTMLButtonElement>('button[aria-label="Busier"]')!
    act(() => busier.click())
    expect(getAutoConfig(trackId).density).toBeGreaterThan(base)
    const sparser = densityGroup.querySelector<HTMLButtonElement>('button[aria-label="Sparser"]')!
    act(() => sparser.click())
    act(() => sparser.click())
    expect(getAutoConfig(trackId).density).toBeLessThan(base)
  })
})

describe("manual edit auto-disarms an armed track", () => {
  it("the +/- layer dial disarms when armed", () => {
    const { store, trackId } = setup()
    render(<Score host={fakeHost} store={store} trackId={trackId} audio={fakeAudio} />)
    act(() => chip().click())
    expect(getAutoConfig(trackId).on).toBe(true)
    // The layer "Denser" dial button (the primary one inside the layer dial).
    const denser = container!.querySelector<HTMLButtonElement>('button[aria-label="Denser"]')!
    act(() => denser.click())
    expect(getAutoConfig(trackId).on).toBe(false)
  })
})
