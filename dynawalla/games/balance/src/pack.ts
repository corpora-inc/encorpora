// COUNTERPOISE, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous `Host` surface that
// `contract.ts` already describes — so the beam, the weights and the puzzle
// ladder are untouched.
//
// What crosses the boundary is the puzzle. The host draws a problem; the beam
// is where it gets answered, because hanging mass until the arm sits level IS
// the equality. The game never decides whether a hang was right — it reports
// the value the child settled on and the host is the judge.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./game.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("balance: #app missing")

async function start(el: HTMLElement): Promise<void> {
  // `items.reveal` is not optional. The shared host resolves an item's
  // canonical value through it (`game-host/index.ts:160`); without the grant
  // `canonical` is "", the item is dropped, and the pool never fills — a pack
  // that mounts, warms, and then serves nothing, with no crash and no failing
  // gate. COUNTERPOISE also needs the value up front for its own reason: a
  // counterweight has to be worth the answer before the child hangs it.
  const mounted = await createGameHost({ domain: "equality" })
  // Stocked before the first frame: the beam presents a puzzle immediately, and
  // a beam with a blank face is the kind of thing that happens exactly once, on
  // launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context are torn down before the frame is, rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[balance] could not start", error)
  renderNoHost(root, "COUNTERPOISE")
})
