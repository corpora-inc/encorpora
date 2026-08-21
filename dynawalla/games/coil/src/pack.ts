// THE COIL OF NINETY-SIX, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the coil, the shear, the lane and the
// wall are untouched by the swap.
//
// What crosses the boundary is the item, and the game reads exactly two things
// off it: the prompt, which it carves on the wall and parses into a whole and a
// demand, and the canonical answer, which is what `items.reveal` is for. The
// game never decides whether a cut was right — it reports the number the
// machine is left holding, and the host judges it.
//
// `items.reveal` is declared in `pack.json` for that reason and is not
// optional: without it the adapter's pool never fills, and a pack that mounts,
// warms and serves nothing is the failure mode with no symptom.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("coil: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })
  // Stocked before the first frame: the first coil is built from the first
  // item, and a coil with no number behind it is the kind of thing that happens
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
  console.error("[coil] could not start", error)
  renderNoHost(root, "THE COIL OF NINETY-SIX")
})
