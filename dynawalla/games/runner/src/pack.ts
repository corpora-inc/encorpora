// VOLTA, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous `Host` surface that
// `contract.ts` already describes — so the causeway, the read band, the tier
// governor and the recharge gate are untouched.
//
// What crosses the boundary is a gate array. A question the curriculum drew
// becomes three lane values through `options.ts`, exactly as it does under the
// stub: the canonical answer in one lane and mal-rule distractors in the other
// two. The game reports the value the child drove through and the host judges
// it; the game's own idea of correct drives only the feel.
//
// `items.reveal` is not optional here, and it is declared in `pack.json` for
// that reason. Without it the adapter has no canonical answer to place, so
// there is no right lane to steer into and the pool never fills.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("runner: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })
  // Stocked before the first frame. The first gate is scheduled within a
  // second of the run starting, and a gate with three blank lanes is the kind
  // of thing that happens exactly once, on launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop, the WebGL
  // context and the audio graph come down before the frame does rather than a
  // frame or two after it.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[runner] could not start", error)
  renderNoHost(root, "VOLTA")
})
