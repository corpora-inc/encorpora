// MOSAIC, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the wall, the physics, the camera and
// the particle budget are untouched.
//
// What crosses the boundary is THE FORGE. Eight shattered tiles charge the
// paddle, and pressing it opens a beat where four runes rise carrying one
// problem the curriculum drew: the canonical answer and up to three mal-rule
// distractors, each rune also holding a power-up. The game never decides
// whether a rune was right — it reports the text that was chosen and
// `items.answer` is the judge.
//
// The wall's own times table stays the game's mathematics: a tile that is
// guilty under the wave's rule is a fact the child reads off the glass, not a
// question anybody asked, so nothing about it is reported.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import type { Host } from "./contract.ts"
import { mount } from "./mount.ts"

const root = document.getElementById("app")
if (!root) throw new Error("mosaic: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "mul-div" })
  // Stocked before the first frame: the forge opens the moment the paddle is
  // charged, and a rune with a blank face is the kind of thing that happens
  // exactly once, early, in front of the child.
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
  console.error("[mosaic] could not start", error)
  renderNoHost(root, "MOSAIC")
})
