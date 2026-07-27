// POLARITY, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the ship, the core gauge, the seals and
// the renderer are untouched.
//
// What crosses the boundary is the seal. A Seal Bearer carries a problem the
// curriculum drew and drops four orbs: the canonical answer and up to three
// mal-rule distractors, each orb's sign deciding whether it is solid to you or
// a ghost. The game never decides whether a touch was right — it reports the
// value that was absorbed and `items.answer` is the judge.
//
// The running signed sum in the core is the game's own mathematics and stays
// that way: absorbing +7 and then −4 is arithmetic the child performs by
// flying, not a question anybody asked, so nothing about it is reported.
//
// One honest limit, written down rather than discovered on a tablet: an orb's
// numeral comes from a 9×9 atlas covering −40…+40 (`core/labels.ts`), so it is
// the low levels of the rows in `pack.json` this game can actually print. There
// are no signed-integer rows in the graph yet; when there are, they belong
// here.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import type { Host } from "./contract.ts"
import { mount } from "./mount.ts"

const root = document.getElementById("app")
if (!root) throw new Error("polarity: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })
  // Stocked before the first frame: the first Bearer arrives on a timer that is
  // already running, and a hull with a blank face is the kind of thing that
  // happens exactly once, on launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop, the WebGL
  // context and the audio context are torn down before the frame is, rather
  // than a frame or two after it.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[polarity] could not start", error)
  renderNoHost(root, "POLARITY")
})
