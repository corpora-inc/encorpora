// THE STEELYARD, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the beam, the rack, the strain and the
// weigh-house are untouched.
//
// What crosses the boundary is the weight of the lot. The curriculum draws a
// column operation, the host reveals its canonical value, and that value is what
// the brass is weighed against. **`items.reveal` is declared and it is
// load-bearing**: without it the adapter gets an empty canonical value, drops
// every item, and the pack mounts and warms and serves no questions at all, with
// nothing failing anywhere.
//
// The child's answer is never a choice off a list. It is the load they put on
// their own pan, minus the one notch they are holding — reported verbatim, so a
// dropped carry arrives at the host as the mal-rule output and routes itself.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("counterweight: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add" })
  // Stocked before the first frame: the first weight is hung the instant the
  // game mounts, and a pan with a blank face is the kind of thing that happens
  // exactly once, on launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context come down before the frame does rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })

  // **The sheet.** A transition can put a surface over the frame, and the SDK
  // documents that the pack then receives `pause` while it stays mounted and
  // running. This game calls `transition` every time a scale is cleared, so it is
  // not hypothetical: an unpaused abandonment guard would run out behind that
  // sheet and rack a lot the child was never shown, while the steel quietly
  // healed. A reward that costs the child their round is the worst bug this game
  // could have.
  //
  // These two lines are the whole subscription, and without them the handle's
  // `pause`/`resume` are inert — the methods exist, and nothing ever calls them.
  mounted.client.on("pause", () => {
    handle.pause()
  })
  mounted.client.on("resume", () => {
    handle.resume()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[counterweight] could not start", error)
  renderNoHost(root, "THE STEELYARD")
})
