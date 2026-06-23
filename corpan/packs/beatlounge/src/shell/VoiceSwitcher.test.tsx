/**
 * beatlounge — Home voice switcher: presentational prev / name / next control.
 * Verifies it renders the voice name and fires the right handler per arrow,
 * without the real store/engine. Cycle/wrap math is covered in presets.test.ts.
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { VoiceSwitcher } from "./VoiceSwitcher"

let container: HTMLDivElement | null = null
let root: Root | null = null

const render = (props: Parameters<typeof VoiceSwitcher>[0]) => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(<VoiceSwitcher {...props} />)
  })
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  container = null
  root = null
})

const prevBtn = () =>
  container!.querySelector<HTMLButtonElement>('button[aria-label="Previous voice"]')
const nextBtn = () =>
  container!.querySelector<HTMLButtonElement>('button[aria-label="Next voice"]')

describe("VoiceSwitcher", () => {
  it("shows the voice name", () => {
    render({ name: "Warm Pad", onPrev: () => {}, onNext: () => {} })
    expect(container!.querySelector(".bl-voice-name")?.textContent).toBe("Warm Pad")
  })

  it("fires onPrev / onNext from the arrows", () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render({ name: "Saw Lead", onPrev, onNext })
    act(() => prevBtn()!.click())
    act(() => nextBtn()!.click())
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
