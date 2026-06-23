/**
 * beatlounge — actionCatalog tests: the PURE read-only view over the registry
 * used by the browsable actions picker (grouping, sorting, impact filter,
 * param-default derivation, and the honest source-label resolver).
 */

import { describe, expect, it } from "vitest"
import {
  defaultParams,
  groupCatalogActions,
  listCatalogActions,
  moduleLabel,
  paramDefault,
  pickerParams,
  sourceLabel,
} from "./actionCatalog"
import { createModuleRegistry } from "../registry"
import type { BeatloungeModule, ModuleAction } from "../../contracts/module"

const act = (over: Partial<ModuleAction> & Pick<ModuleAction, "name" | "impact">): ModuleAction => ({
  describe: `do ${over.name}`,
  params: {},
  run: () => ({ commands: [], summary: "" }),
  ...over,
})

const mod = (id: string, actions: ModuleAction[]): BeatloungeModule => ({
  id,
  kind: "utility",
  title: id,
  glyph: "command",
  immersive: "sheet",
  mount: () => ({ unmount: () => {} }),
  actions,
})

const fixtureRegistry = () => {
  const r = createModuleRegistry()
  // Register out of impact order to prove the helper sorts, not the input.
  r.register(
    mod("drum-pads", [
      act({ name: "clearAll", impact: "destructive" }),
      act({ name: "denser", impact: "mutate", stochastic: true }),
      act({ name: "nudge", impact: "tweak" }),
    ]),
  )
  r.register(mod("grooves", [act({ name: "scatter", impact: "mutate", stochastic: true })]))
  return r
}

describe("actionCatalog — enumeration + grouping", () => {
  it("lists every action, sorted by impact then name", () => {
    const list = listCatalogActions(fixtureRegistry())
    expect(list.map((e) => e.action.name)).toEqual([
      "nudge", // tweak
      "denser", // mutate (alpha before scatter)
      "scatter", // mutate
      "clearAll", // destructive
    ])
  })

  it("filters by impact", () => {
    const list = listCatalogActions(fixtureRegistry(), "mutate")
    expect(list.map((e) => e.action.name).sort()).toEqual(["denser", "scatter"])
    expect(list.every((e) => e.action.impact === "mutate")).toBe(true)
  })

  it("groups by module in registration order", () => {
    const groups = groupCatalogActions(fixtureRegistry(), "module")
    expect(groups.map((g) => g.key)).toEqual(["drum-pads", "grooves"])
    expect(groups[0].label).toBe("Drum Pads")
    // Within a module group the actions are still impact-then-name sorted.
    expect(groups[0].actions.map((a) => a.action.name)).toEqual(["nudge", "denser", "clearAll"])
  })

  it("groups by impact, gentlest → strongest", () => {
    const groups = groupCatalogActions(fixtureRegistry(), "impact")
    expect(groups.map((g) => g.key)).toEqual(["tweak", "mutate", "destructive"])
    expect(groups.map((g) => g.label)).toEqual(["Tweaks", "Shapers", "Clears"])
    expect(groups[1].actions.map((a) => a.action.name)).toEqual(["denser", "scatter"])
  })

  it("moduleLabel humanizes ids", () => {
    expect(moduleLabel("phrase-jam")).toBe("Phrase Jam")
    expect(moduleLabel("command-bar")).toBe("Command Bar")
  })
})

describe("actionCatalog — param controls + defaults", () => {
  it("pickerParams surfaces only simple-control params", () => {
    const a = act({
      name: "x",
      impact: "mutate",
      params: {
        amount: { type: "number", min: 0, max: 1, default: 0.5, describe: "amt" },
        mode: { type: "enum", options: ["a", "b"], default: "a", describe: "m" },
        on: { type: "boolean", default: true, describe: "o" },
        rhythmId: { type: "string", default: "samba", describe: "free string" },
        target: { type: "track", describe: "opaque" },
      },
    })
    const keys = pickerParams(a).map((p) => p.key).sort()
    expect(keys).toEqual(["amount", "mode", "on"]) // free string + track excluded
  })

  it("includes a string param when it has options", () => {
    const a = act({
      name: "x",
      impact: "mutate",
      params: { mood: { type: "string", options: ["dark", "bright"], describe: "m" } },
    })
    expect(pickerParams(a).map((p) => p.key)).toEqual(["mood"])
  })

  it("paramDefault honours schema default then type", () => {
    expect(paramDefault({ type: "number", default: 7, describe: "" })).toBe(7)
    expect(paramDefault({ type: "boolean", describe: "" })).toBe(false)
    expect(paramDefault({ type: "enum", options: ["a", "b"], describe: "" })).toBe("a")
    expect(paramDefault({ type: "number", min: 2, describe: "" })).toBe(2)
  })

  it("defaultParams builds the full default object", () => {
    const a = act({
      name: "x",
      impact: "mutate",
      params: {
        amount: { type: "number", default: 0.5, describe: "" },
        on: { type: "boolean", default: true, describe: "" },
      },
    })
    expect(defaultParams(a)).toEqual({ amount: 0.5, on: true })
  })
})

describe("actionCatalog — source label (honest)", () => {
  it("labels model paths 'assistant'", () => {
    expect(sourceLabel("model")).toBe("assistant")
    expect(sourceLabel("model-repair")).toBe("assistant")
  })
  it("labels deterministic paths 'keywords' — never fake AI", () => {
    expect(sourceLabel("keyword")).toBe("keywords")
    expect(sourceLabel("keyword-no-llm")).toBe("keywords")
  })
})
