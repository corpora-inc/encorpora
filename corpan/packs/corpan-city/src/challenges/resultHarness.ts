/**
 * resultHarness — a standalone harness that mounts the challenge overlay and
 * shows the reward card at an arbitrary score, so the QA sweep can screenshot
 * the result-card MOOD at 0% / mid / 100% in WebKit (`shotResult.mjs`).
 * Dev-only; not shipped.
 */
import { mountChallengeOverlay } from "./overlay"
import type { ChallengeReward } from "@corpan-city/contracts"

const overlay = document.getElementById("wp-overlay") as HTMLElement

function show(score01: number, withItems: boolean) {
  overlay.replaceChildren()
  const handle = mountChallengeOverlay(
    overlay,
    { npcName: "Mateo", avatar: "", line: "My market words got all jumbled — help me sort them?" },
    {
      speak: async () => {},
      onComplete: () => {},
      onCancel: () => {},
    },
  )
  const reward: ChallengeReward = {
    xp: Math.round(8 * 2 * (0.4 + 0.6 * score01)),
    coins: Math.round(2 * 2 * score01),
    items: withItems ? (score01 >= 0.92 ? ["item-ferry-token"] : ["item-spice-pouch"]) : [],
  }
  handle.api.complete(score01, reward)
}

interface HarnessWindow extends Window {
  __wpResult: (score01: number, withItems?: boolean) => void
}
;(window as unknown as HarnessWindow).__wpResult = (s, withItems = true) => show(s, withItems)

// default boot: the failing case (0%) — the regression the fix targets.
show(0, true)
