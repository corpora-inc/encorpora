// THE SPLIT, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the blade, the bodies, the tier
// governor and the factor tree are untouched.
//
// What crosses the boundary is the sigil. A sigil carries a problem the
// curriculum drew, and cutting it detonates that problem into four candidate
// lanterns: the canonical answer and up to three mal-rule distractors, which
// are wrong answers a child actually produces rather than noise. The game
// never decides whether a cut was right — it reports the value that was cut
// and `items.answer` is the judge.
//
// The numerals are the game's own mathematics and stay that way: a composite
// splitting into its factors is arithmetic the child performs with a gesture,
// not a question anybody asked, so nothing about it is reported.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("slice: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })
  // Stocked before the first frame: the director throws a sigil early, and a
  // sigil with a blank face is the kind of thing that happens exactly once, on
  // launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context are torn down before the frame is, rather than a frame or two
  // after it.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[slice] could not start", error)
  renderNoHost(root, "THE SPLIT")
})
