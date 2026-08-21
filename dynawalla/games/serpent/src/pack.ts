// SERPENT, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface the `Host`
// type in `contract.ts` already describes — so the world, the orbs, the tail,
// the camera and the ambience are untouched.
//
// What crosses the boundary is the condition and the field under it. A
// question's canonical answer stocks the pool of orbs that may be eaten and
// its mal-rule distractors stock the maze of orbs that may not, which is why
// the wrong orbs are near misses a child actually produces rather than noise.
// The game never decides whether a bite was right in the curriculum's sense:
// it reports the label it swallowed and `items.answer` is the judge.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./index.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("serpent: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "mixed" })
  // Stocked before the first frame: the world adopts a condition the instant
  // it is created, and an arena floor with a blank condition on it is the kind
  // of thing that happens exactly once, on launch, in front of the child.
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
  console.error("[serpent] could not start", error)
  renderNoHost(root, "SERPENT")
})
