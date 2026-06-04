import { describe, it, expect } from "vitest"
import type { QuestStep } from "@world-plaza/contracts"
import { createTraversalTrigger } from "./traversalTrigger"

const traverseStep: QuestStep = { id: "gate", label: "Cross the river bridge", anchorId: "bridge_n", kind: "traverse" }
const talkStep: QuestStep = { id: "docks", label: "Ask for the ferry", anchorId: "harbor", kind: "talk", toolId: "repeat-after" }

describe("traversalTrigger — walk-to-complete for traverse/find steps (#26)", () => {
  it("fires onReach once when the player arrives at a traverse step's anchor", () => {
    let player = { x: 100, z: 100 }
    const reached: string[] = []
    const trig = createTraversalTrigger({
      getPlayer: () => player,
      currentStep: () => traverseStep,
      anchorPoint: (id) => (id === "bridge_n" ? { x: 0, z: 0 } : null),
      onReach: (id) => reached.push(id),
      radius: 4,
    })

    // Far away → no fire.
    trig.update(0.016)
    expect(reached).toEqual([])

    // Walk into range → fires exactly once, even across many frames.
    player = { x: 1, z: 1 }
    trig.update(0.016)
    trig.update(0.016)
    trig.update(0.016)
    expect(reached).toEqual(["gate"])
  })

  it("does NOT fire for a talk step (those advance via the challenge)", () => {
    const reached: string[] = []
    const trig = createTraversalTrigger({
      getPlayer: () => ({ x: 0, z: 0 }),
      currentStep: () => talkStep,
      anchorPoint: () => ({ x: 0, z: 0 }), // player is AT the anchor
      onReach: (id) => reached.push(id),
    })
    trig.update(0.016)
    expect(reached).toEqual([])
    expect(trig.isActive()).toBe(false)
  })

  it("isActive reflects whether the active step is a traverse/find step", () => {
    let step: QuestStep | null = traverseStep
    const trig = createTraversalTrigger({
      getPlayer: () => ({ x: 50, z: 50 }),
      currentStep: () => step,
      anchorPoint: () => ({ x: 0, z: 0 }),
      onReach: () => {},
    })
    expect(trig.isActive()).toBe(true)
    step = talkStep
    expect(trig.isActive()).toBe(false)
    step = null
    expect(trig.isActive()).toBe(false)
  })

  it("no anchor point → never fires (degrades safely)", () => {
    const reached: string[] = []
    const trig = createTraversalTrigger({
      getPlayer: () => ({ x: 0, z: 0 }),
      currentStep: () => traverseStep,
      anchorPoint: () => null,
      onReach: (id) => reached.push(id),
    })
    trig.update(0.016)
    expect(reached).toEqual([])
  })
})
