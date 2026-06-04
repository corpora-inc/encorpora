// @vitest-environment happy-dom
/**
 * REGRESSION: challenge-framing text must NEVER enter the NPC dialog.
 *
 * The owner flagged it three times: the challenge instruction ("Which is it?")
 * AND the pre-challenge invite/segue ("let's see how fast you are") kept showing
 * up INSIDE the NPC dialog bubble (and being spoken). The hard requirement:
 * every line that introduces/frames a challenge must (1) stay OUT of the dialog
 * log, (2) NOT be spoken, and (3) live by the Begin/Play launch button.
 *
 * This test drives a real `npcRuntime.open` with a model-less host (so the
 * deterministic scripted greeting + `presentOffer` path runs, no LLM) and a
 * `forcedOffer` (the objective NPC's Begin chip), then asserts on the live DOM:
 *   - the dialog LOG (`.wp-npc-log`) contains the NPC greeting but NOT the segue;
 *   - the segue text appears in the Play-row CAPTION (`.wp-npc-play-caption`),
 *     beneath/by the launch button (`.wp-npc-chip-play`);
 *   - the segue was NEVER passed to TTS (`host.speak`).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { NpcRole, Quest, Scene, type LearnerPair, type ChallengeToolId } from "@world-plaza/contracts"
import { createNpcRuntime } from "./npcRuntime"
import { resolveSegueForSeed } from "./challengeSegues"
import type { HostApi } from "./hostTypes"

const here = dirname(fileURLToPath(import.meta.url))
const content = (rel: string) =>
  JSON.parse(readFileSync(resolve(here, "../../content", rel), "utf8"))

/** A model-LESS host: no `llm` → the runtime takes the scripted+presentOffer path.
 *  `speak` records every utterance so we can assert the segue is never spoken. */
function makeSilentHost(spoken: string[]): HostApi {
  return {
    speak: async (_code: string, text: string) => {
      spoken.push(text)
    },
    // no `llm` → broker.ensureLLM() resolves not-ready → scripted greeting + offer.
  }
}

/** Flush microtasks so the async `kickoff()` (ensureLLM → scripted → offer) runs. */
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

describe("challenge-framing text never enters the NPC dialog (owner ×3)", () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
  })
  afterEach(() => {
    container.remove()
  })

  it("the segue lives by the Begin button, not in the log, and is never spoken", async () => {
    const roles = NpcRole.array().parse(content("npc/roles.json"))
    const quest = Quest.parse(content("quests/es-cafe.json"))
    const scene = Scene.parse(content("scenes/antigua-1770.json"))
    const role = roles[0]
    const learnerPair: LearnerPair = quest.learnerPair

    const spoken: string[] = []
    const runtime = createNpcRuntime(makeSilentHost(spoken))

    const tool: ChallengeToolId = "say-it-back"
    const handle = runtime.open({
      npcRole: role,
      scene,
      quest,
      learnerPair,
      container,
      // The objective-NPC Begin path — the strongest case (always presents an offer).
      forcedOffer: { tool, chipLabel: "Begin" },
    })

    await flush()

    // The deterministic segue the runtime should have routed to the CAPTION. The
    // forcedOffer path seeds the seed as `${npcRole.id}|begin|${turn}` with turn 0.
    const expectedSegue = resolveSegueForSeed(tool, learnerPair.target, `${role.id}|begin|0`)

    const log = container.querySelector<HTMLElement>(".wp-npc-log")
    const caption = container.querySelector<HTMLElement>(".wp-npc-play-caption")
    const playBtn = container.querySelector<HTMLElement>(".wp-npc-chip-play")

    // (1) the Begin button is present, with its caption beside it.
    expect(playBtn, "the Begin/Play launch button should be present").not.toBeNull()
    expect(caption, "the challenge intro caption should be present by the button").not.toBeNull()

    // (2) the caption carries the segue text (the framing lives at the button).
    expect(caption!.textContent).toBe(expectedSegue)

    // (3) the dialog LOG must NOT contain the segue text anywhere.
    expect(log, "the dialog log should exist").not.toBeNull()
    expect(log!.textContent ?? "").not.toContain(expectedSegue)

    // (4) the segue was NEVER spoken (TTS). The scripted greeting may be spoken;
    // the challenge framing must not.
    expect(spoken).not.toContain(expectedSegue)

    handle.close()
  })

  it("the Play-row caption sits inside the play row, beside the button (not the log)", async () => {
    const roles = NpcRole.array().parse(content("npc/roles.json"))
    const quest = Quest.parse(content("quests/es-cafe.json"))
    const scene = Scene.parse(content("scenes/antigua-1770.json"))

    const runtime = createNpcRuntime(makeSilentHost([]))
    const handle = runtime.open({
      npcRole: roles[0],
      scene,
      quest,
      learnerPair: quest.learnerPair,
      container,
      forcedOffer: { tool: "say-it-back", chipLabel: "Begin" },
    })
    await flush()

    const playrow = container.querySelector<HTMLElement>(".wp-npc-playrow")
    expect(playrow).not.toBeNull()
    // the caption is a CHILD of the play row (button chrome), not the chat log.
    expect(playrow!.querySelector(".wp-npc-play-caption")).not.toBeNull()
    expect(playrow!.querySelector(".wp-npc-chip-play")).not.toBeNull()
    expect(
      container.querySelector(".wp-npc-log .wp-npc-play-caption"),
      "the caption must never be inside the dialog log",
    ).toBeNull()

    handle.close()
  })
})
