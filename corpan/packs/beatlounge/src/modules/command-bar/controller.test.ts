/**
 * beatlounge — command-bar controller tests: the PREVIEW lifecycle over the real
 * command bus (submit → preview applied transiently; keep commits; cancel rolls
 * back — "turn over the apple cart"; reroll re-runs with a fresh seed).
 */

import { describe, expect, it, vi } from "vitest"
import { createCommandBarController } from "./controller"
import { createCommandBus } from "../../model/commandBus"
import { createBeatloungeStore } from "../../store/store"
import { createDefaultDoc } from "../../model/document"
import type { BeatloungeHost } from "../../contracts/module"
import type { CommandBus } from "../../model/commandBus"
import type { LlmGridRuntime, GridRunResult } from "../../llm/runtime"

const setup = (runtime: LlmGridRuntime) => {
  const bus = createCommandBus(createDefaultDoc(0))
  const store = createBeatloungeStore(bus)
  const toasts: { message: string; undo?: () => void }[] = []
  const host = {
    bus,
    toast: (message: string, opts?: { undo?: () => void }) => toasts.push({ message, undo: opts?.undo }),
  } as unknown as BeatloungeHost
  const ctrl = createCommandBarController({
    store,
    host,
    hostApi: {} as never,
    runtime,
  })
  return { ctrl, bus, store, toasts, busRef: bus as CommandBus }
}

/** A runtime double that returns a fixed result (or seed-varying). */
const fixedRuntime = (result: (utterance: string, seed?: number) => GridRunResult): LlmGridRuntime => ({
  run: async (utterance, opts) => result(utterance, opts?.seed),
  llmAvailable: async () => true,
})

const tempoResult = (bpm: number): GridRunResult => ({
  utterance: "x",
  call: { name: "setTempo", args: { bpm } },
  commands: [{ t: "setTempo", bpm }],
  summary: `Tempo → ${bpm} BPM`,
  source: "model",
})

describe("controller — preview lifecycle", () => {
  it("submit applies a transient preview to the live doc", async () => {
    const { ctrl, store } = setup(fixedRuntime(() => tempoResult(150)))
    await ctrl.submit("faster")
    expect(ctrl.getState().phase).toBe("preview")
    expect(store.vanilla.getState().doc.bpm).toBe(150) // applied transiently
  })

  it("keep commits onto the undo stack + toasts with undo", async () => {
    const { ctrl, store, toasts } = setup(fixedRuntime(() => tempoResult(150)))
    await ctrl.submit("faster")
    ctrl.keep()
    expect(ctrl.getState().phase).toBe("idle")
    expect(store.vanilla.getState().doc.bpm).toBe(150)
    expect(store.vanilla.getState().canUndo).toBe(true)
    const last = toasts[toasts.length - 1]
    expect(last?.message).toContain("150")
    expect(last?.undo).toBeTypeOf("function")
  })

  it("cancel rolls the preview back (apple cart)", async () => {
    const { ctrl, store } = setup(fixedRuntime(() => tempoResult(150)))
    const before = store.vanilla.getState().doc.bpm
    await ctrl.submit("faster")
    ctrl.cancel()
    expect(ctrl.getState().phase).toBe("idle")
    expect(store.vanilla.getState().doc.bpm).toBe(before) // restored
  })

  it("a new submit rolls back the prior preview first", async () => {
    let n = 0
    const { ctrl, store } = setup(fixedRuntime(() => tempoResult(n++ === 0 ? 150 : 90)))
    await ctrl.submit("faster")
    await ctrl.submit("slower")
    expect(store.vanilla.getState().doc.bpm).toBe(90)
    // Keep → exactly one undo step lands (the prior preview was rolled back).
    ctrl.keep()
    store.undo()
    expect(store.vanilla.getState().doc.bpm).toBe(createDefaultDoc(0).bpm)
  })

  it("an empty-command result shows a message, not a preview", async () => {
    const { ctrl } = setup(
      fixedRuntime(() => ({ utterance: "x", call: { name: "density", args: {} }, commands: [], summary: "No drum track", source: "keyword" })),
    )
    await ctrl.submit("more hats")
    expect(ctrl.getState().phase).toBe("idle")
    expect(ctrl.getState().message).toBe("No drum track")
  })

  it("reroll re-runs the SAME utterance with a fresh seed", async () => {
    const seen: (number | undefined)[] = []
    const { ctrl } = setup(
      fixedRuntime((_u, seed) => {
        seen.push(seed)
        return tempoResult(120)
      }),
    )
    await ctrl.submit("faster")
    await ctrl.reroll()
    expect(seen.length).toBe(2)
    expect(seen[0]).not.toBe(seen[1])
    expect(ctrl.getState().phase).toBe("preview")
  })

  it("tracks recent utterances (most-recent first, deduped)", async () => {
    const { ctrl } = setup(fixedRuntime(() => tempoResult(120)))
    await ctrl.submit("faster")
    await ctrl.submit("slower")
    await ctrl.submit("faster")
    expect(ctrl.getState().recent).toEqual(["faster", "slower"])
  })

  it("dispose rolls back a live preview", async () => {
    const { ctrl, store } = setup(fixedRuntime(() => tempoResult(150)))
    const before = store.vanilla.getState().doc.bpm
    await ctrl.submit("faster")
    ctrl.dispose()
    expect(store.vanilla.getState().doc.bpm).toBe(before)
  })

  it("subscribers are notified through the phases", async () => {
    const { ctrl } = setup(fixedRuntime(() => tempoResult(150)))
    const phases: string[] = []
    ctrl.subscribe((s) => phases.push(s.phase))
    await ctrl.submit("faster")
    expect(phases).toContain("thinking")
    expect(phases).toContain("preview")
  })

  it("never throws if the runtime rejects", async () => {
    const ctrl = createCommandBarController({
      store: createBeatloungeStore(createCommandBus(createDefaultDoc(0))),
      host: { bus: createCommandBus(createDefaultDoc(0)), toast: () => {} } as unknown as BeatloungeHost,
      hostApi: {} as never,
      runtime: { run: () => Promise.reject(new Error("boom")), llmAvailable: async () => true },
    })
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    await ctrl.submit("faster")
    expect(ctrl.getState().phase).toBe("idle")
    expect(ctrl.getState().message).toBeTruthy()
    spy.mockRestore()
  })
})
