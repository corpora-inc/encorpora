// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AsrProvider, AsrSession } from "./contract"
import { attachMicInput } from "./micInput"

// A controllable fake session so we can drive partials/errors deterministically.
function fakeSession() {
  let partial: ((t: string) => void) | undefined
  let level: ((r: number, t: number) => void) | undefined
  let error: ((c: string, m?: string) => void) | undefined
  const session: AsrSession & {
    emitPartial: (t: string) => void
    emitError: (c: string) => void
  } = {
    onPartial: (cb) => { partial = cb },
    onLevel: (cb) => { level = cb },
    onError: (cb) => { error = cb },
    stop: vi.fn(async () => ({ text: "final text", confidence: 0.9, language: "en" })),
    cancel: vi.fn(),
    emitPartial: (t) => partial?.(t),
    emitError: (c) => error?.(c),
  }
  return session
}

function fakeProvider(session: AsrSession): AsrProvider {
  return {
    id: "native",
    capabilities: vi.fn(),
    isAvailable: vi.fn(),
    ensure: vi.fn(),
    transcribe: vi.fn(async () => session),
  } as unknown as AsrProvider
}

function field() {
  const input = document.createElement("input")
  document.body.appendChild(input)
  return input
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("attachMicInput", () => {
  it("renders a 44px hit-zone button after the field", () => {
    const input = field()
    attachMicInput(
      { field: input, lang: "en" },
      { resolveProvider: async () => fakeProvider(fakeSession()) },
    )
    const btn = document.querySelector(".corpan-mic-btn") as HTMLElement
    expect(btn).toBeTruthy()
    // The button is the next sibling of the field (afterend).
    expect(input.nextElementSibling?.querySelector(".corpan-mic-btn")).toBe(btn)
  })

  it("streams partials into the field value", async () => {
    const input = field()
    const session = fakeSession()
    attachMicInput(
      { field: input, lang: "en" },
      { resolveProvider: async () => fakeProvider(session) },
    )
    ;(document.querySelector(".corpan-mic-btn") as HTMLElement).click()
    await Promise.resolve(); await Promise.resolve()
    session.emitPartial("hello wor")
    expect(input.value).toBe("hello wor")
    session.emitPartial("hello world")
    expect(input.value).toBe("hello world")
  })

  it("falls back to keyboard (hides the button) when no provider resolves", async () => {
    const input = field()
    attachMicInput(
      { field: input, lang: "pa-Arab" },
      { resolveProvider: async () => null },
    )
    const btn = document.querySelector(".corpan-mic-btn") as HTMLElement
    btn.click()
    await Promise.resolve(); await Promise.resolve()
    expect(btn.style.display).toBe("none")
    expect(document.querySelector(".corpan-mic-launchpad")?.textContent)
      .toContain("type instead")
  })

  it("treats INTERRUPTED as a clean stop, not an error launchpad", async () => {
    const input = field()
    const session = fakeSession()
    attachMicInput(
      { field: input, lang: "en" },
      { resolveProvider: async () => fakeProvider(session) },
    )
    ;(document.querySelector(".corpan-mic-btn") as HTMLElement).click()
    await Promise.resolve(); await Promise.resolve()
    expect(document.querySelector(".corpan-mic")?.classList.contains("is-live")).toBe(true)
    session.emitError("INTERRUPTED")
    expect(document.querySelector(".corpan-mic")?.classList.contains("is-live")).toBe(false)
    expect(document.querySelector(".corpan-mic-launchpad")).toBeNull()
  })

  it("shows a Settings launchpad on MIC_DENIED and wires openAppSettings", async () => {
    const input = field()
    const session = fakeSession()
    const openAppSettings = vi.fn()
    attachMicInput(
      { field: input, lang: "en" },
      { resolveProvider: async () => fakeProvider(session), openAppSettings },
    )
    ;(document.querySelector(".corpan-mic-btn") as HTMLElement).click()
    await Promise.resolve(); await Promise.resolve()
    session.emitError("MIC_DENIED")
    const settingsBtn = document.querySelector(".corpan-mic-launchpad button") as HTMLElement
    expect(settingsBtn).toBeTruthy()
    settingsBtn.click()
    expect(openAppSettings).toHaveBeenCalledOnce()
  })

  it("teardown cancels the live session", async () => {
    const input = field()
    const session = fakeSession()
    const teardown = attachMicInput(
      { field: input, lang: "en" },
      { resolveProvider: async () => fakeProvider(session) },
    )
    ;(document.querySelector(".corpan-mic-btn") as HTMLElement).click()
    await Promise.resolve(); await Promise.resolve()
    teardown()
    expect(session.cancel).toHaveBeenCalled()
    expect(document.querySelector(".corpan-mic")).toBeNull()
  })

  it("flips layout to RTL when dir=rtl", () => {
    const input = field()
    attachMicInput(
      { field: input, lang: "ar", dir: "rtl" },
      { resolveProvider: async () => fakeProvider(fakeSession()) },
    )
    expect(document.querySelector(".corpan-mic")?.getAttribute("dir")).toBe("rtl")
  })
})
