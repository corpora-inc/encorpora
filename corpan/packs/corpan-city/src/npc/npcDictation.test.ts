// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import type { HostAsrApi, HostAsrSession } from "./hostTypes"
import { wireNpcDictation } from "./npcRuntime"

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe("NPC dictation affordance", () => {
  it("clearly shows icon-only starting, recording, level, and finishing states", async () => {
    let onLevel: ((rms: number, tMs: number) => void) | undefined
    const session: HostAsrSession = {
      onPartial: vi.fn(),
      onLevel: (cb) => { onLevel = cb },
      onError: vi.fn(),
      stop: async () => ({ text: "bonjour", confidence: 0.9, language: "fr" }),
      cancel: vi.fn(),
    }
    const asr = {
      pick: vi.fn(async () => ({
        id: "native",
        transcribe: async () => session,
      })),
      provider: vi.fn(),
    } as unknown as HostAsrApi
    const button = document.createElement("button")
    button.disabled = true
    button.setAttribute("aria-label", "Microphone")
    button.setAttribute("aria-pressed", "false")
    const field = document.createElement("textarea")

    const teardown = wireNpcDictation(asr, button, field, "fr")
    await flush()
    expect(button.disabled).toBe(false)
    expect(button.textContent).toBe("")

    button.click()
    expect(button.classList.contains("is-starting")).toBe(true)
    expect(button.getAttribute("aria-busy")).toBe("true")
    await flush()
    expect(button.classList.contains("is-live")).toBe(true)
    expect(button.getAttribute("aria-pressed")).toBe("true")
    expect(button.hasAttribute("aria-busy")).toBe(false)

    onLevel?.(0.75, 100)
    expect(button.style.getPropertyValue("--wp-npc-mic-ring")).toBe("13px")

    button.click()
    expect(button.classList.contains("is-stopping")).toBe(true)
    expect(button.getAttribute("aria-busy")).toBe("true")
    await flush()
    expect(field.value).toBe("bonjour")
    expect(button.classList.contains("is-live")).toBe(false)
    expect(button.getAttribute("aria-pressed")).toBe("false")
    expect(button.hasAttribute("aria-busy")).toBe(false)
    expect(button.textContent).toBe("")

    teardown?.()
  })
})
