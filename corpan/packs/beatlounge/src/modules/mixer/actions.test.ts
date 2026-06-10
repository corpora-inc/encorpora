import { describe, expect, it } from "vitest"
import type { ActionContext } from "../../contracts/module"
import { createDefaultDoc } from "../../model/document"
import { unmuteAllAction, unsoloAllAction } from "./actions"

const ctx = (): ActionContext => ({
  doc: createDefaultDoc(0),
  rng: () => 0.5,
})

describe("mixer unsoloAll", () => {
  it("clears solo on every soloed track in one step", () => {
    const c = ctx()
    c.doc.tracks[0].solo = true
    c.doc.tracks[1].solo = true
    const r = unsoloAllAction.run(c, {})
    const batch = r.commands[0]
    expect(batch.t).toBe("batch")
    if (batch.t === "batch") {
      expect(batch.commands).toHaveLength(2)
      expect(
        batch.commands.every(
          (cm) => cm.t === "setTrackProp" && cm.prop === "solo" && cm.value === false
        )
      ).toBe(true)
    }
  })

  it("emits a single bare command when only one is soloed", () => {
    const c = ctx()
    c.doc.tracks[0].solo = true
    const r = unsoloAllAction.run(c, {})
    expect(r.commands).toHaveLength(1)
    expect(r.commands[0].t).toBe("setTrackProp")
  })

  it("is a no-op with no solos", () => {
    expect(unsoloAllAction.run(ctx(), {}).commands).toHaveLength(0)
  })
})

describe("mixer unmuteAll", () => {
  it("un-mutes every muted track", () => {
    const c = ctx()
    c.doc.tracks[0].mute = true
    const r = unmuteAllAction.run(c, {})
    expect(r.commands).toHaveLength(1)
    const cmd = r.commands[0]
    expect(cmd.t).toBe("setTrackProp")
    if (cmd.t === "setTrackProp") {
      expect(cmd.prop).toBe("mute")
      expect(cmd.value).toBe(false)
    }
  })

  it("is a no-op with nothing muted", () => {
    expect(unmuteAllAction.run(ctx(), {}).commands).toHaveLength(0)
  })
})
