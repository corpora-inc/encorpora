// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AsrProvider, AsrSession } from "./contract"
import { wireDictation, dictationResolver } from "./dictation"

function fakeSession() {
  let partial: ((t: string) => void) | undefined
  let error: ((c: string, m?: string) => void) | undefined
  const s: AsrSession & { emitPartial: (t: string) => void; emitError: (c: string) => void } = {
    onPartial: (cb) => { partial = cb },
    onLevel: () => {},
    onError: (cb) => { error = cb },
    stop: vi.fn(async () => ({ text: "final", confidence: 0.9, language: "en" })),
    cancel: vi.fn(),
    emitPartial: (t) => partial?.(t),
    emitError: (c) => error?.(c),
  }
  return s
}

function fakeProvider(s: AsrSession): AsrProvider {
  return {
    id: "native", capabilities: vi.fn(), isAvailable: vi.fn(), ensure: vi.fn(),
    transcribe: vi.fn(async () => s),
  } as unknown as AsrProvider
}

function fixture() {
  const button = document.createElement("button")
  const field = document.createElement("textarea")
  document.body.append(button, field)
  return { button, field }
}

const tick = async () => { await Promise.resolve(); await Promise.resolve() }

afterEach(() => { document.body.innerHTML = "" })

describe("wireDictation", () => {
  it("hides the button (keyboard floor) when no provider resolves", async () => {
    const { button, field } = fixture()
    wireDictation({ button, field, lang: "pa-Arab", resolveProvider: async () => null })
    await tick()
    expect(button.style.display).toBe("none")
  })

  it("enables the button + streams partials into the field when a provider exists", async () => {
    const { button, field } = fixture()
    const s = fakeSession()
    wireDictation({ button, field, lang: "en", resolveProvider: async () => fakeProvider(s) })
    await tick()
    expect(button.disabled).toBe(false)
    expect(button.style.display).toBe("")
    button.click()
    await tick()
    s.emitPartial("hello wor")
    expect(field.value).toBe("hello wor")
    s.emitPartial("hello world")
    expect(field.value).toBe("hello world")
  })

  it("toggles live class on start, clears on INTERRUPTED (clean stop)", async () => {
    const { button, field } = fixture()
    const s = fakeSession()
    wireDictation({ button, field, lang: "en", resolveProvider: async () => fakeProvider(s) })
    await tick()
    button.click()
    await tick()
    expect(button.classList.contains("is-live")).toBe(true)
    s.emitError("INTERRUPTED")
    expect(button.classList.contains("is-live")).toBe(false)
  })

  it("MIC_DENIED triggers openAppSettings", async () => {
    const { button, field } = fixture()
    const s = fakeSession()
    const openAppSettings = vi.fn()
    wireDictation({
      button, field, lang: "en", openAppSettings,
      resolveProvider: async () => fakeProvider(s),
    })
    await tick()
    button.click()
    await tick()
    s.emitError("MIC_DENIED")
    expect(openAppSettings).toHaveBeenCalled()
  })

  it("stop() writes the final transcript", async () => {
    const { button, field } = fixture()
    const s = fakeSession()
    wireDictation({ button, field, lang: "en", resolveProvider: async () => fakeProvider(s) })
    await tick()
    button.click(); await tick()   // start
    button.click(); await tick()   // stop
    expect(field.value).toBe("final")
  })

  it("teardown cancels a live session + removes the listener", async () => {
    const { button, field } = fixture()
    const s = fakeSession()
    const teardown = wireDictation({ button, field, lang: "en", resolveProvider: async () => fakeProvider(s) })
    await tick()
    button.click(); await tick()
    teardown()
    expect(s.cancel).toHaveBeenCalled()
  })

  it("lazy lang function is read at press time", async () => {
    const { button, field } = fixture()
    const s = fakeSession()
    const provider = fakeProvider(s)
    let lang = "en"
    wireDictation({ button, field, lang: () => lang, resolveProvider: async () => provider })
    await tick()
    lang = "ja"
    button.click(); await tick()
    expect((provider.transcribe as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ lang: "ja" }),
    )
  })

  it("dictationResolver returns null when host.asr is absent", async () => {
    const resolve = dictationResolver(undefined)
    expect(await resolve("en")).toBeNull()
  })
})
