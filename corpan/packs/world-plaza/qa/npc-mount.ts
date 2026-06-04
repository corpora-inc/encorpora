/**
 * Standalone mount for the NPC dialogue system, driven entirely by the mock
 * host (no 2.4 GB model). Loaded by qa/npc.html and exercised by qa/npc.mjs.
 *
 * Loads the same content JSON the game uses, validates it against the contracts,
 * opens a dialogue with the café baker, and exposes `window.__wpNpc` hooks so the
 * Playwright harness can send lines and read the rendered transcript.
 */

import { NpcRole, Quest, Scene, type NpcIntent } from "@world-plaza/contracts"
import rolesJson from "../content/npc/roles.json"
import questJson from "../content/quests/es-cafe.json"
import sceneJson from "../content/scenes/antigua-1770.json"
import { createNpcRuntime, type NpcDialogueHandle } from "../src/npc/npcRuntime"
import { createMockHost } from "../src/npc/mockHost"

const roles = NpcRole.array().parse(rolesJson)
const quest = Quest.parse(questJson)
const scene = Scene.parse(sceneJson)

const stage = document.getElementById("wp-stage")!
const host = createMockHost()
const runtime = createNpcRuntime(host)

const intents: NpcIntent[] = []
let handle: NpcDialogueHandle | null = null

function openBaker() {
  handle = runtime.open({
    npcRole: roles.find((r) => r.id === "cafe_counter")!,
    scene,
    quest,
    learnerPair: { target: "es", native: "en" },
    container: stage,
    npcName: "Doña Marta",
    starterChips: ["Un café, por favor", "¿Cuánto cuesta?", "Gracias"],
    onIntent: (intent) => {
      intents.push(intent)
    },
  })
}

openBaker()

// ---- dev/QA observability hooks (no gameplay logic) ----
;(window as unknown as Record<string, unknown>).__wpNpc = {
  send: (text: string) => handle?.send(text),
  intents: () => intents.map((i) => ({ ...i })),
  bubbles: () =>
    Array.from(document.querySelectorAll(".wp-npc-msg")).map((el) => ({
      role: el.classList.contains("wp-npc-msg-you")
        ? "you"
        : el.classList.contains("wp-npc-msg-note")
          ? "note"
          : "npc",
      text: el.textContent ?? "",
    })),
  toolCards: () =>
    Array.from(document.querySelectorAll(".wp-npc-toolcard")).map((el) => el.textContent ?? ""),
  reopen: openBaker,
}
