// @vitest-environment happy-dom
/**
 * Unit tests for the city-radio control SEAM the Phone drives — the pure state +
 * duck/transport logic, independent of any real audio output. In this
 * (happy-dom) environment there is no Tauri plugin, so the radio resolves to the
 * `webaudio` path; `<audio>.play()` rejects (no real media), which is caught +
 * logged — we assert the STATE machine, not the sound (a human verifies audio).
 *
 * Covers the deferred work that landed with the Phone: `duck()`/`unduck()`
 * ref-counting (overlapping NPC lines), the reactive `subscribe()` snapshot, and
 * the next/prev dial wrap.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createCityRadio, POC_STATIONS } from "./cityRadio"

beforeEach(() => {
  // Tear down any prior single-instance slot between tests.
  const slot = (globalThis as { __wpCityRadioSlot?: { current?: { dispose(): void } } })
    .__wpCityRadioSlot
  slot?.current?.dispose()
  vi.restoreAllMocks()
})

describe("cityRadio — control seam", () => {
  it("resolves to a usable (non-native) mode with the station dial", async () => {
    const radio = await createCityRadio({ volume: 0.5 })
    // No Tauri here → webaudio (happy-dom provides Audio) or unavailable.
    expect(["webaudio", "unavailable"]).toContain(radio.mode())
    expect(radio.channels().length).toBe(POC_STATIONS.length)
    radio.dispose()
  })

  it("subscribe() fires immediately with the current snapshot", async () => {
    const radio = await createCityRadio({ volume: 0.4 })
    const seen: number[] = []
    const unsub = radio.subscribe((s) => seen.push(s.volume))
    expect(seen.length).toBe(1)
    expect(seen[0]).toBeCloseTo(0.4)
    unsub()
    radio.dispose()
  })

  it("setVolume clamps 0..1 and notifies subscribers", async () => {
    const radio = await createCityRadio({ volume: 0.5 })
    const states: number[] = []
    radio.subscribe((s) => states.push(s.volume))
    radio.setVolume(2) // over → clamp to 1
    radio.setVolume(-1) // under → clamp to 0
    expect(radio.getState().volume).toBe(0)
    // first push (immediate) + two setVolume pushes
    expect(states.length).toBe(3)
    radio.dispose()
  })

  it("duck()/unduck() is ref-counted — restores only after the LAST unduck", async () => {
    const radio = await createCityRadio({ volume: 0.5 })
    expect(radio.getState().ducked).toBe(false)

    radio.duck() // line 1 speaks
    radio.duck() // line 2 overlaps
    expect(radio.getState().ducked).toBe(true)

    radio.unduck() // line 1 ends — still ducked (line 2 active)
    expect(radio.getState().ducked).toBe(true)

    radio.unduck() // line 2 ends — now restored
    expect(radio.getState().ducked).toBe(false)
    radio.dispose()
  })

  it("over-unduck never goes negative (stays un-ducked)", async () => {
    const radio = await createCityRadio({ volume: 0.5 })
    radio.unduck()
    radio.unduck()
    expect(radio.getState().ducked).toBe(false)
    radio.duck()
    expect(radio.getState().ducked).toBe(true) // a real duck still works after spurious unducks
    radio.dispose()
  })

  it("next()/prev() wrap the dial as a ring", async () => {
    const radio = await createCityRadio({ volume: 0.5 })
    const n = POC_STATIONS.length
    // start() selects index 0; prev() should wrap to the last station.
    await radio.start()
    expect(radio.getState().channel?.id).toBe(POC_STATIONS[0].id)
    await radio.prev()
    expect(radio.getState().channel?.id).toBe(POC_STATIONS[n - 1].id)
    await radio.next()
    expect(radio.getState().channel?.id).toBe(POC_STATIONS[0].id)
    radio.dispose()
  })

  it("a single global instance — creating a second disposes the first", async () => {
    const a = await createCityRadio({ volume: 0.5 })
    const aDispose = vi.spyOn(a, "dispose")
    const b = await createCityRadio({ volume: 0.5 })
    expect(aDispose).toHaveBeenCalled()
    b.dispose()
  })
})
