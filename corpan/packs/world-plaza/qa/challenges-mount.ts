/**
 * QA mount for the micro-challenge library. Exposes `window.wpRunChallenge` so
 * the Playwright harness can spin up any tool by id against the mock host, and
 * `window.wpLastResult` to read the resolved ChallengeResultPlus. Renders into
 * the out-of-flow `#overlay` layer over a stand-in stage so layout-shift can be
 * measured against `#stage`.
 */

import { runChallenge, mockChallengeHost } from "../src/challenges/registry"
import type { ChallengeContext, ChallengeToolId, ChallengeResultPlus } from "@world-plaza/contracts"

const overlay = document.getElementById("overlay") as HTMLElement
const host = mockChallengeHost({ sttScore: 0.9, seed: 11 })

const ctx: ChallengeContext = {
  language: "es",
  nativeLanguage: "en",
  level: "A1",
  mode: "solo",
}

const NPC = { name: "Mateo the Baker", avatar: "🧑‍🍳" }

declare global {
  interface Window {
    wpRunChallenge: (id: ChallengeToolId) => Promise<ChallengeResultPlus>
    wpLastResult?: ChallengeResultPlus
  }
}

window.wpRunChallenge = (id: ChallengeToolId) => {
  const p = runChallenge(id, ctx, host, { container: overlay, npc: NPC, uiLanguage: "en" })
  p.then((r) => {
    window.wpLastResult = r
    console.log(`[qa] ${id} → score=${r.score.toFixed(2)} xp=${r.rewards.xp} coins=${r.rewards.coins} items=${JSON.stringify(r.rewards.items)}`)
  })
  return p
}

console.log("[qa] challenges-mount ready")
