// @vitest-environment happy-dom
/**
 * #55 — conversation-driven completion: a TRAVERSE/FIND quest step completes by
 * TALKING to the NPC (a "Done" CONFIRM chip), NOT a silent proximity trigger.
 * `forcedOffer.onConfirm` makes the Begin/Done chip fire a callback (the
 * orchestrator advances the step) instead of launching a challenge, and closes
 * the dialogue. This locks that the confirm chip:
 *   - appears,
 *   - on tap calls onConfirm exactly once,
 *   - does NOT launch a challenge (no callTool intent, no challenge overlay),
 *   - carries NO challenge segue caption (its label is "Done"; the keeper's
 *     greeting is the flavour).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { NpcRole, Quest, Scene, type LearnerPair, type NpcIntent } from "@corpan-city/contracts"
import { createNpcRuntime } from "./npcRuntime"
import type { HostApi } from "./hostTypes"

const here = dirname(fileURLToPath(import.meta.url))
const content = (rel: string) => JSON.parse(readFileSync(resolve(here, "../../content", rel), "utf8"))

function makeSilentHost(): HostApi {
  return { speak: async () => {} } // no llm → scripted greeting + presentOffer
}

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

describe("#55 — traverse/find step completes by TALKING (confirm chip), not a challenge", () => {
  let container: HTMLElement
  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
  })
  afterEach(() => container.remove())

  it("the confirm chip fires onConfirm once, launches NO challenge, and shows no segue", async () => {
    const roles = NpcRole.array().parse(content("npc/roles.json"))
    const quest = Quest.parse(content("quests/es-cafe.json"))
    const scene = Scene.parse(content("scenes/antigua-1770.json"))
    const learnerPair: LearnerPair = quest.learnerPair

    const onConfirm = vi.fn()
    const intents: NpcIntent[] = []
    const handle = createNpcRuntime(makeSilentHost()).open({
      npcRole: roles[0],
      scene,
      quest,
      learnerPair,
      container,
      // A traverse-step objective NPC: the Begin chip is a CONFIRM.
      forcedOffer: { tool: "say-it-back", chipLabel: "Done", onConfirm },
      onIntent: (i) => intents.push(i),
    })
    await flush()

    const chip = container.querySelector<HTMLButtonElement>(".wp-npc-chip-play")
    expect(chip, "the Done/confirm chip should be present").not.toBeNull()
    expect(chip!.textContent).toBe("Done")
    // CONFIRM offer → no challenge segue caption.
    expect(container.querySelector(".wp-npc-play-caption")).toBeNull()

    chip!.click()
    await flush()

    // onConfirm fired exactly once.
    expect(onConfirm).toHaveBeenCalledTimes(1)
    // NO challenge was launched: no callTool intent, no challenge overlay mounted.
    expect(intents.some((i) => i.kind === "callTool")).toBe(false)
    expect(container.querySelector(".wp-ch-scrim")).toBeNull()

    handle.close()
  })
})
