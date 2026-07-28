// THE TRUE DRAW, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the round clock, the truth balancer, the
// statement builder and the slate are untouched.
//
// What crosses the boundary is the claim. `items.reveal` is declared and is not
// optional here: without the canonical value there is no such thing as a true
// statement, and the pack would mount, warm, and serve a slate with nothing on
// it. The distractors that come with the item are the mal-rule outputs a real
// broken procedure produces, and they are what the slate lies with.
//
// The game never decides whether a call was right. It reports the value the
// child effectively asserted and the host judges — and on a wrong draw that
// value is the mal-rule itself, so the diagnosis routes with no extra wiring.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("truedraw: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })
  // Stocked before the first frame. The first slate goes up within a second of
  // the first tap, and a blank one is the kind of thing that happens exactly
  // once, on launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context come down before the frame does rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[truedraw] could not start", error)
  renderNoHost(root, "THE TRUE DRAW")
})
