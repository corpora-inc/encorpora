/**
 * beatlounge — Dock-Rail nav: the Scenes entry. Scenes moved off the Stage tiles
 * into the persistent nav strip, so the Dock-Rail renders a Scenes button that
 * opens the drawer — but only when an `onScenes` handler is wired (the shell
 * passes it only while the Scenes module is registered). Verifies the button's
 * presence/absence and that it fires, without the real store/engine.
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { DockRail } from "./DockRail"

let container: HTMLDivElement | null = null
let root: Root | null = null

const baseProps = {
  form: "desktop" as const,
  playing: false,
  onToggle: () => {},
  bpm: 120,
  onBpm: () => {},
  masterLevel: 0,
  canUndo: false,
  canRedo: false,
  onUndo: () => {},
  onRedo: () => {},
  onCommand: () => {},
  onExit: () => {},
}

const render = (props: Parameters<typeof DockRail>[0]) => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(<DockRail {...props} />)
  })
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  container = null
  root = null
})

const scenesBtn = () =>
  container!.querySelector<HTMLButtonElement>('button[aria-label="Scenes"]')

describe("DockRail — Scenes nav entry", () => {
  it("renders the Scenes button and fires onScenes when wired", () => {
    const onScenes = vi.fn()
    render({ ...baseProps, onScenes })
    const btn = scenesBtn()
    expect(btn).toBeTruthy()
    act(() => btn!.click())
    expect(onScenes).toHaveBeenCalledTimes(1)
  })

  it("omits the Scenes button when no handler is provided", () => {
    render({ ...baseProps })
    expect(scenesBtn()).toBeNull()
  })
})
