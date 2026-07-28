// THE GRAPPLE FOUNDRY, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the bout, the plates, the referee and
// the cooling canvas are untouched.
//
// What crosses the boundary is the target. The curriculum draws a column sum,
// the host reveals its canonical value, and that value becomes the number the
// bar has to reach. The plates are the game's own: `game/plates.ts` cuts a pair
// for the target it was handed, so a two-digit sum hangs a 7 and a 20 on the
// frame and a four-digit one hangs something heavier. Nothing about the
// decomposition is reported — it is arithmetic the child performs with their
// thumbs, not a question anybody asked.
//
// `items.reveal` is declared and it is load-bearing: without it the adapter
// gets an empty canonical value, drops every item, and the pack mounts and
// warms and serves no questions at all, with nothing failing anywhere.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("foundry: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add" })
  // Stocked before the first frame: the first fall is cut the instant the game
  // mounts, and a board with a blank face is the kind of thing that happens
  // exactly once, on launch, in front of the child.
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
  console.error("[foundry] could not start", error)
  renderNoHost(root, "THE GRAPPLE FOUNDRY")
})
