// CLAIM, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous `Host` surface that
// `contract.ts` already describes — so the rail, the trail, the hunt and the
// exact-integer arena are untouched.
//
// What crosses the boundary is the goal. `goalFromQuestion` takes the host's
// question and uses its answer as a cell count when it can be one, and spends
// it on the revive gate when it cannot: a curriculum that hands back "15 − 8"
// is not describing an area, and the game must not depend on any particular
// one being plugged in. The game never decides whether a claim was right — it
// reports the count the child cut to and the host is the judge.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"

import "./style.css"
import type { Host } from "./contract.ts"
import { mount } from "./game/index.ts"

const root = document.getElementById("app")
if (!root) throw new Error("claim: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "fraction-of-area" })
  // Stocked before the first frame: the goal card is the first thing drawn and
  // a blank one is the kind of thing that happens exactly once, on launch, in
  // front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context are torn down before the frame is, rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[claim] could not start", error)
  renderNoHost(root, "CLAIM")
})
