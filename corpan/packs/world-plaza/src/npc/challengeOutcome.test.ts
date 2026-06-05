// @vitest-environment happy-dom
/**
 * #62 — the NPC's post-challenge reaction must branch on OUTCOME: congratulate
 * ONLY when the player COMPLETED the minigame; on a DISMISS/bail, say a neutral
 * line, NEVER "Nicely done". The challenge overlay stamps `data-wp-ch-outcome`
 * on its scrim (completed | aborted); npcRuntime's lifecycle observer reads it.
 *
 * This drives a real `npcRuntime.open` (model-less host → the deterministic Play
 * offer), taps the Play chip to launch (which starts the overlay-lifecycle
 * observer), then simulates the overlay appearing + disappearing with each
 * outcome, and asserts the dialog-log notes.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { NpcRole, Quest, Scene, type LearnerPair } from "@world-plaza/contracts"
import { createNpcRuntime } from "./npcRuntime"
import type { HostApi } from "./hostTypes"

const here = dirname(fileURLToPath(import.meta.url))
const content = (rel: string) => JSON.parse(readFileSync(resolve(here, "../../content", rel), "utf8"))
const silentHost = (): HostApi => ({ speak: async () => {} })

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

/** Simulate the challenge overlay appearing then closing with `outcome`. */
async function runOverlay(container: HTMLElement, outcome: "completed" | "aborted") {
  const scrim = document.createElement("div")
  scrim.className = "wp-ch-scrim"
  container.appendChild(scrim) // observer sees it APPEAR
  await flush()
  scrim.dataset.wpChOutcome = outcome // overlay stamps the outcome on close
  scrim.remove() // observer sees it GO → onChallengeEnded(outcome)
  await flush()
}

const logText = (c: HTMLElement) => c.querySelector(".wp-npc-log")?.textContent ?? ""

describe("#62 — NPC congratulates only on a COMPLETED challenge, never on a bail", () => {
  let container: HTMLElement
  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
  })
  afterEach(() => container.remove())

  async function openWithOffer() {
    const roles = NpcRole.array().parse(content("npc/roles.json"))
    const quest = Quest.parse(content("quests/es-cafe.json"))
    const scene = Scene.parse(content("scenes/antigua-1770.json"))
    const learnerPair: LearnerPair = quest.learnerPair
    const handle = createNpcRuntime(silentHost()).open({
      npcRole: roles[0],
      scene,
      quest,
      learnerPair,
      container,
      forcedOffer: { tool: "say-it-back", chipLabel: "Begin" },
    })
    await flush()
    // tap the Play chip → launchChallenge → starts the overlay-lifecycle observer.
    const chip = container.querySelector<HTMLButtonElement>(".wp-npc-chip-play")
    expect(chip).not.toBeNull()
    chip!.click()
    await flush()
    return handle
  }

  it("DISMISS (aborted) → a neutral line, NOT 'Nicely done'", async () => {
    const handle = await openWithOffer()
    await runOverlay(container, "aborted")
    const text = logText(container)
    expect(text).not.toContain("Nicely done")
    expect(text).not.toContain("🎉")
    expect(text).toContain("maybe later") // the neutral challengeSkipped line
    handle.close()
  })

  it("COMPLETE (completed) → the congratulatory line DOES appear", async () => {
    const handle = await openWithOffer()
    await runOverlay(container, "completed")
    const text = logText(container)
    expect(text).toContain("Nicely done")
    expect(text).not.toContain("maybe later")
    handle.close()
  })

  it("no outcome stamped (external unmount) → treated as completed (back-compat)", async () => {
    const handle = await openWithOffer()
    // overlay vanishes WITHOUT stamping an outcome.
    const scrim = document.createElement("div")
    scrim.className = "wp-ch-scrim"
    container.appendChild(scrim)
    await flush()
    scrim.remove()
    await flush()
    expect(logText(container)).toContain("Nicely done")
    handle.close()
  })
})
