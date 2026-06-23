/**
 * beatlounge — Tile plumbing: the interactive-vs-summary wrap + the open
 * affordance. A non-interactive tile is a tap-to-open <button>; an interactive
 * tile is an un-buttoned container with a shell-provided expand control (unless
 * the module owns its expand). Verifies the foundational contract without the
 * real store/engine — the module's mount is a stub.
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { Tile } from "./Tile"
import type {
  BeatloungeHost,
  BeatloungeModule,
  ModuleInstance,
} from "../contracts/module"

// A module whose tile mount writes a marker, so we can assert it rendered.
const makeModule = (over: Partial<BeatloungeModule> = {}): BeatloungeModule => ({
  id: "m1",
  kind: "utility",
  title: "Widget",
  glyph: "wave",
  immersive: "full",
  actions: [],
  mount: (mount): ModuleInstance => {
    mount.container.setAttribute("data-mounted", mount.surface)
    return { unmount: () => {} }
  },
  ...over,
})

const makeHost = (enterImmersive: BeatloungeHost["enterImmersive"]): BeatloungeHost =>
  ({ enterImmersive, form: () => "desktop" } as unknown as BeatloungeHost)

let container: HTMLDivElement | null = null
let root: Root | null = null

const renderTile = (module: BeatloungeModule, host: BeatloungeHost) => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(<Tile module={module} form="desktop" host={host} />)
  })
  return container
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  container = null
  root = null
})

describe("Tile", () => {
  it("wraps a non-interactive tile in a tap-to-open button that enters immersive", () => {
    const enter = vi.fn(() => () => {})
    const el = renderTile(makeModule(), makeHost(enter))

    const outer = el.querySelector(".bl-tile")
    expect(outer?.tagName).toBe("BUTTON")
    // No separate expand control on a summary tile.
    expect(el.querySelector(".bl-tile-expand")).toBeNull()
    // The whole tile opens immersive.
    act(() => (outer as HTMLButtonElement).click())
    expect(enter).toHaveBeenCalledWith("m1")
  })

  it("renders an interactive tile UN-buttoned with a shell expand that enters immersive", () => {
    const enter = vi.fn(() => () => {})
    const el = renderTile(makeModule({ tileInteractive: true }), makeHost(enter))

    const outer = el.querySelector(".bl-tile")
    expect(outer?.tagName).toBe("DIV")
    expect(outer?.classList.contains("bl-tile--live")).toBe(true)
    // The module body still mounted.
    expect(el.querySelector("[data-mounted='tile']")).not.toBeNull()
    // The shell-provided expand opens immersive.
    const expand = el.querySelector(".bl-tile-expand") as HTMLButtonElement
    expect(expand).not.toBeNull()
    act(() => expand.click())
    expect(enter).toHaveBeenCalledWith("m1")
  })

  it("routes the expand to tileExpandTo when set", () => {
    const enter = vi.fn(() => () => {})
    const el = renderTile(
      makeModule({ tileInteractive: true, tileExpandTo: "other" }),
      makeHost(enter)
    )
    act(() => (el.querySelector(".bl-tile-expand") as HTMLButtonElement).click())
    expect(enter).toHaveBeenCalledWith("other")
  })

  it("suppresses the shell expand when the module owns its affordance", () => {
    const el = renderTile(
      makeModule({ tileInteractive: true, tileOwnsExpand: true }),
      makeHost(vi.fn(() => () => {}))
    )
    expect(el.querySelector(".bl-tile--live")).not.toBeNull()
    expect(el.querySelector(".bl-tile-expand")).toBeNull()
  })
})
