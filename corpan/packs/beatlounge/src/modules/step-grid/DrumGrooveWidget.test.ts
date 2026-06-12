/**
 * beatlounge — Drums HOME WIDGET interaction contract:
 *   • Tapping the tile BODY (head + mini-grid) opens the Drums pane
 *     (host.enterImmersive("step-grid")).
 *   • Tapping the live controls (−/+ density, shuffle) does NOT open the pane —
 *     they act in place (dispatch one undo batch onto the drum track).
 *
 * Uses the real store (createDefaultDoc ships a drum track) with a stub host +
 * audio facade — no engine. Verifies the founder fixes #3 + #2. (No JSX so the
 * file matches the `*.test.ts` runner glob — uses createElement directly.)
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import { act } from "react"
import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { createCommandBus } from "../../model/commandBus"
import { createDefaultDoc, isInstrumentTrack } from "../../model/document"
import { createBeatloungeStore, type BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeHost } from "../../contracts/module"
import { DrumGrooveWidget } from "./DrumGrooveWidget"

// React 18+ act() wants this flag set so it knows it's in a test environment.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const makeStore = (): BeatloungeStore =>
  createBeatloungeStore(createCommandBus(createDefaultDoc(0)))

const drumId = (store: BeatloungeStore): string => {
  const drum = store.vanilla
    .getState()
    .doc.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")
  if (!drum) throw new Error("no drum track")
  return drum.id
}

// Playhead never fires in the test; onPlayhead just hands back an unsubscribe.
const makeAudio = (): AudioFacade =>
  ({ onPlayhead: () => () => {} }) as unknown as AudioFacade

const makeHost = (enterImmersive: BeatloungeHost["enterImmersive"]): BeatloungeHost =>
  ({ enterImmersive, toast: () => {}, form: () => "desktop" }) as unknown as BeatloungeHost

let container: HTMLDivElement | null = null
let root: Root | null = null

const render = (store: BeatloungeStore, host: BeatloungeHost, audio: AudioFacade) => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      createElement(DrumGrooveWidget, { host, store, audio, trackId: drumId(store) })
    )
  })
  return container
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  container = null
  root = null
})

describe("DrumGrooveWidget", () => {
  it("tapping the tile body opens the Drums pane (enterImmersive step-grid)", () => {
    const enter = vi.fn(() => () => {})
    const el = render(makeStore(), makeHost(enter), makeAudio())

    const open = el.querySelector(".bl-drumwidget-open") as HTMLButtonElement
    expect(open).not.toBeNull()
    act(() => open.click())
    expect(enter).toHaveBeenCalledWith("step-grid")
  })

  it("the −/+ and shuffle controls do NOT open the pane (act in place)", () => {
    const enter = vi.fn(() => () => {})
    const store = makeStore()
    const el = render(store, makeHost(enter), makeAudio())

    const controls = Array.from(
      el.querySelectorAll(".bl-drumwidget-controls .bl-drumwidget-btn")
    ) as HTMLButtonElement[]
    // sparser, denser, shuffle.
    expect(controls.length).toBe(3)

    const before = store.vanilla.getState().doc
    act(() => controls.forEach((b) => b.click()))

    // None of the controls bubbled into "open Drums".
    expect(enter).not.toHaveBeenCalled()
    // They acted in place — the document changed (a scatter/shuffle landed).
    expect(store.vanilla.getState().doc).not.toBe(before)
  })
})
