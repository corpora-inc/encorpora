// SPLITBEAT, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface the `Host`
// type in `contract.ts` already describes — so the chart, the three lanes, the
// judge and the audio engine are untouched.
//
// What crosses the boundary is a bar of music. A question's answer is a
// fraction, and SPLITBEAT plays that fraction: `1/4` is a quarter note you can
// hear, so the lane carrying the right answer is the lane that sounds like the
// answer. The game never decides whether a hit was right — it reports the tile
// it was aimed at and `items.answer` is the judge.
//
// A host answer that is not a playable subdivision is already handled: the
// game falls back to reading the tile rather than playing it, which is exactly
// what `?musical=0` in the dev harness exists to prove.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./index.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("splitbeat: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "fractions" })
  // Stocked before the first frame: the first tiles are charted the moment the
  // game mounts, and a blank tile is the kind of thing that happens exactly
  // once, on launch, in front of the child.
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
  console.error("[splitbeat] could not start", error)
  renderNoHost(root, "SPLITBEAT")
})
