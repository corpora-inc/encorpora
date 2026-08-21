// TREBUCHET, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface the `Host` in
// `contract.ts` already describes — so the ballistics, the wind, the wave
// governor and the dial are untouched.
//
// What crosses the boundary is a question and the value it is worth. A keep
// stands at its own answer in metres, which means the answer has to be known
// before the child fires rather than after — that is what `items.reveal` is
// for, and it is why the game can put an error somewhere on the ground instead
// of behind a buzzer. The game never judges: it reports the range the CHILD
// named on the dial — never the metre the ground recorded, never the value of
// whichever keep the blast happened to reach — and the host decides what that
// was worth. `sim/verdict.ts` is where that promise is kept and tested.
//
// The stub host in `stubHost.ts` stays exactly where it is. It is what
// `npm run dev` mounts, it is what the ballistics tests drive, and it is not
// what a tablet loads.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./index.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("trebuchet: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })
  // Stocked before the first frame: a wave lays out its keeps from the answers
  // it pulled, and a wave that opens with no ammunition is the kind of thing
  // that happens exactly once, on launch, in front of the child.
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
  console.error("[trebuchet] could not start", error)
  renderNoHost(root, "TREBUCHET")
})
