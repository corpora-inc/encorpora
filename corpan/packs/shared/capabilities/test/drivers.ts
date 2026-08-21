// Contract-suite drivers: how each capability is mounted against the mock
// host and driven to natural completion in jsdom. Shared by the per-module
// contract tests and the smoke test.
import type { ActivitySpec, CapabilityHandle } from "@shared/capabilities/core"
import {
  createMockCapabilityHost,
  type MockCapabilityHostOptions,
} from "@shared/capabilities/core/mock"
import type { ContractSuiteDriver } from "@shared/capabilities/core/contractSuite"
import { visibleDefaultModel } from "@shared/capabilities/pronounce/src/modelRegistry"
import miniSegments from "../segment-player/harness/fixtures/mini-book/segments.json"
import miniManifest from "../segment-player/harness/fixtures/mini-book/audio_manifest_en.json"

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const waitFor = async <T>(
  probe: () => T | null | undefined | false,
  timeoutMs = 3000,
  label = "condition",
): Promise<T> => {
  const start = performance.now()
  for (;;) {
    const v = probe()
    if (v) return v as T
    if (performance.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out: ${label}`)
    }
    await wait(20)
  }
}

export const pointerEvt = (type: string): Event => {
  const Ctor = (globalThis as Record<string, unknown>).PointerEvent as typeof MouseEvent
  return new Ctor(type, { bubbles: true, cancelable: true })
}

let specSeq = 0
const mintSpecId = () => `test-${++specSeq}`

// ------------------------------------------------------------ cap-pronounce

export const pronounceDriver: ContractSuiteDriver = {
  name: "cap-pronounce",
  usesStt: true,
  degradesWithoutStt: true,
  loadCapability: async () =>
    (await import("@shared/capabilities/pronounce")).capability,
  makeHost: (opts?: MockCapabilityHostOptions) =>
    createMockCapabilityHost(
      opts?.stt === false
        ? opts
        : {
            ...opts,
            stt: {
              // Report the registry's visible default as installed so the
              // availability probe + local-only prepare are both satisfied.
              installedModels: [visibleDefaultModel().folder],
              ...(opts?.stt ?? {}),
            },
          },
    ),
  makeSpec: (partial?: Partial<ActivitySpec>): ActivitySpec => ({
    specId: mintSpecId(),
    activityType: "cap-pronounce",
    itemRefs: [{ kind: "phrase", source: "base", id: "42" }],
    targetLang: "es",
    nativeLang: "en",
    params: { text: "hola mundo", lang: "es", nativeText: "hello world" },
    modelNeeds: ["stt"],
    ...partial,
  }),
  async complete(container: HTMLElement) {
    const mic = await waitFor(
      () => {
        const b = container.querySelector<HTMLButtonElement>(".capPron-mic")
        return b && !b.disabled ? b : null
      },
      3000,
      "mic enabled",
    )
    mic.dispatchEvent(pointerEvt("pointerdown"))
    await wait(40)
    mic.dispatchEvent(pointerEvt("pointerup"))
    await wait(40)
  },
}

// -------------------------------------------------------------- cap-squeeze

export const squeezeDriver: ContractSuiteDriver = {
  name: "cap-squeeze",
  loadCapability: async () =>
    (await import("@shared/capabilities/squeeze")).capability,
  makeHost: (opts?: MockCapabilityHostOptions) => createMockCapabilityHost(opts),
  makeSpec: (partial?: Partial<ActivitySpec>): ActivitySpec => ({
    specId: mintSpecId(),
    activityType: "cap-squeeze",
    itemRefs: [{ kind: "phrase", source: "base", id: "7" }],
    targetLang: "es",
    nativeLang: "en",
    params: {
      text: "the cat sleeps",
      blockLang: "en",
      promptText: "el gato duerme",
      promptLang: "es",
    },
    ...partial,
  }),
  async complete(container: HTMLElement) {
    // Tap each bank word in the correct order (tap = place at sentence end).
    const words = ["the", "cat", "sleeps"]
    for (const word of words) {
      const block = await waitFor(
        () =>
          container.querySelector<HTMLButtonElement>(
            `[data-testid="word-bank"] [data-word="${word}"]`,
          ),
        3000,
        `bank block "${word}"`,
      )
      block.dispatchEvent(pointerEvt("pointerdown"))
      block.dispatchEvent(pointerEvt("pointerup"))
      await wait(10)
    }
    await wait(20)
  },
}

// ------------------------------------------------------- cap-segment-player

export const miniBookPreloaded = () => ({
  segmentsData: miniSegments,
  audioManifest: miniManifest,
  resolveAssetUrl: (rel: string) => `fixture://mini-book/${rel}`,
})

export const segmentPlayerDriver: ContractSuiteDriver = {
  name: "cap-segment-player",
  loadCapability: async () =>
    (await import("@shared/capabilities/segment-player")).capability,
  makeHost: (opts?: MockCapabilityHostOptions) => createMockCapabilityHost(opts),
  makeSpec: (partial?: Partial<ActivitySpec>): ActivitySpec => ({
    specId: mintSpecId(),
    activityType: "cap-segment-player",
    itemRefs: [
      { kind: "segment", source: "mini_book", id: "ch01-001" },
      { kind: "segment", source: "mini_book", id: "ch01-002" },
      { kind: "segment", source: "mini_book", id: "ch01-003" },
    ],
    targetLang: "en",
    params: {
      bookId: "mini_book",
      language: "en",
      segments: ["ch01-001", "ch01-002", "ch01-003"],
      preloaded: miniBookPreloaded(),
      autoPlay: true,
    },
    ...partial,
  }),
  async complete(_container: HTMLElement, _host, handle: CapabilityHandle) {
    // Autoplay exposure: the 3-segment fixture range (~480ms of stubbed
    // audio) plays through; completion IS the natural settle.
    await Promise.race([
      handle.result,
      wait(4000).then(() => {
        throw new Error("segment range did not finish")
      }),
    ])
  },
}
