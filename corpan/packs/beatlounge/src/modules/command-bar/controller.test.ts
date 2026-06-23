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
import { createModuleRegistry } from "../registry"
import type { BeatloungeHost, BeatloungeModule, ModuleAction } from "../../contracts/module"
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

  it("exposes the registry it was given (for the picker)", () => {
    const registry = createModuleRegistry()
    const ctrl = createCommandBarController({
      store: createBeatloungeStore(createCommandBus(createDefaultDoc(0))),
      host: { bus: createCommandBus(createDefaultDoc(0)), toast: () => {} } as unknown as BeatloungeHost,
      hostApi: {} as never,
      runtime: fixedRuntime(() => tempoResult(120)),
      registry,
    })
    expect(ctrl.registry()).toBe(registry)
  })

  it("registry() is undefined when none was provided", () => {
    const { ctrl } = setup(fixedRuntime(() => tempoResult(120)))
    expect(ctrl.registry()).toBeUndefined()
  })
})

// A picker action that sets the tempo via a command (deterministic-given-rng).
const tempoModule = (): BeatloungeModule => {
  const action: ModuleAction = {
    name: "setTempo",
    describe: "Set the tempo.",
    params: { bpm: { type: "number", default: 100, describe: "bpm" } },
    impact: "mutate",
    run: (_ctx, params) => {
      const bpm = Number(params.bpm ?? 100)
      return { commands: [{ t: "setTempo", bpm }], summary: `Tempo → ${bpm}` }
    },
  }
  // A stochastic action that derives its tempo from rng, so reroll varies it.
  const rollAction: ModuleAction = {
    name: "rollTempo",
    describe: "Roll a random tempo.",
    params: {},
    stochastic: true,
    impact: "mutate",
    run: (ctx) => {
      const bpm = 80 + Math.floor(ctx.rng() * 80)
      return { commands: [{ t: "setTempo", bpm }], summary: `Tempo → ${bpm}` }
    },
  }
  return {
    id: "tempo",
    kind: "utility",
    title: "Tempo",
    glyph: "command",
    immersive: "sheet",
    mount: () => ({ unmount: () => {} }),
    actions: [action, rollAction],
  }
}

describe("controller — runAction (picker path)", () => {
  const pickerSetup = () => {
    const bus = createCommandBus(createDefaultDoc(0))
    const store = createBeatloungeStore(bus)
    const toasts: { message: string }[] = []
    const host = {
      bus,
      toast: (message: string) => toasts.push({ message }),
    } as unknown as BeatloungeHost
    const registry = createModuleRegistry()
    const mod = tempoModule()
    registry.register(mod)
    const ctrl = createCommandBarController({
      store,
      host,
      hostApi: {} as never,
      runtime: fixedRuntime(() => tempoResult(120)),
      registry,
    })
    return { ctrl, store, toasts, mod }
  }

  it("runs an action with explicit params as a transient preview", () => {
    const { ctrl, store, mod } = pickerSetup()
    ctrl.runAction(mod.id, mod.actions[0], { bpm: 144 })
    expect(ctrl.getState().phase).toBe("preview")
    expect(ctrl.getState().result?.source).toBe("keyword") // honest: no model
    expect(store.vanilla.getState().doc.bpm).toBe(144)
  })

  it("fills missing params from the schema default", () => {
    const { ctrl, store, mod } = pickerSetup()
    ctrl.runAction(mod.id, mod.actions[0]) // no params → default 100
    expect(store.vanilla.getState().doc.bpm).toBe(100)
  })

  it("keep commits the picker preview onto the undo stack", () => {
    const { ctrl, store } = pickerSetup()
    const { mod } = pickerSetup()
    ctrl.runAction(mod.id, mod.actions[0], { bpm: 132 })
    ctrl.keep()
    expect(ctrl.getState().phase).toBe("idle")
    expect(store.vanilla.getState().doc.bpm).toBe(132)
    expect(store.vanilla.getState().canUndo).toBe(true)
  })

  it("cancel rolls a picker preview back", () => {
    const { ctrl, store, mod } = pickerSetup()
    const before = store.vanilla.getState().doc.bpm
    ctrl.runAction(mod.id, mod.actions[0], { bpm: 200 })
    ctrl.cancel()
    expect(store.vanilla.getState().doc.bpm).toBe(before)
  })

  it("reroll re-runs a stochastic picker action with a fresh seed", async () => {
    const { ctrl, store, mod } = pickerSetup()
    ctrl.runAction(mod.id, mod.actions[1]) // rollTempo
    const first = store.vanilla.getState().doc.bpm
    // Reroll many times; a fresh seed should eventually land on a different bpm.
    let changed = false
    for (let i = 0; i < 12 && !changed; i++) {
      await ctrl.reroll()
      if (store.vanilla.getState().doc.bpm !== first) changed = true
    }
    expect(changed).toBe(true)
    expect(ctrl.getState().phase).toBe("preview")
  })

  it("never throws if an action's run throws", () => {
    const { ctrl } = pickerSetup()
    const boom: ModuleAction = {
      name: "boom",
      describe: "throws",
      params: {},
      impact: "mutate",
      run: () => {
        throw new Error("nope")
      },
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    ctrl.runAction("x", boom)
    expect(ctrl.getState().phase).toBe("idle")
    expect(ctrl.getState().message).toBeTruthy()
    spy.mockRestore()
  })
})

describe("controller — error path", () => {
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
