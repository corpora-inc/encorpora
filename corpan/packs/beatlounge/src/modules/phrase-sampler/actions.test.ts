import { describe, it, expect } from "vitest"
import { placePhraseTextAction } from "./actions"
import { createDefaultDoc } from "../../model/document"

const ctx = () => ({ doc: createDefaultDoc(0), rng: () => 0.5 })

describe("placePhraseTextAction", () => {
  it("places a riff as one undo batch of valid commands", () => {
    const r = placePhraseTextAction.run(ctx(), { text: "agua", lang: "es", mode: "stack" })
    expect(r.commands).toHaveLength(1)
    const batch = r.commands[0]
    expect(batch.t).toBe("batch")
    if (batch.t === "batch") {
      expect(batch.commands.some((c) => c.t === "addTrack")).toBe(true)
      expect(batch.commands.some((c) => c.t === "registerFragment")).toBe(true)
      expect(batch.commands.some((c) => c.t === "placeFragment")).toBe(true)
    }
    expect(r.summary).toContain("agua")
  })

  it("no-ops without text or lang", () => {
    expect(placePhraseTextAction.run(ctx(), { text: "", lang: "es" }).commands).toHaveLength(0)
    expect(placePhraseTextAction.run(ctx(), { text: "x", lang: "" }).commands).toHaveLength(0)
  })

  it("scatter mode lays each word as its own fragment", () => {
    const r = placePhraseTextAction.run(ctx(), {
      text: "vamos ahora",
      lang: "es",
      mode: "scatter",
    })
    const batch = r.commands[0]
    if (batch.t === "batch") {
      const regs = batch.commands.filter((c) => c.t === "registerFragment")
      expect(regs).toHaveLength(2)
    }
  })
})
