// DEEPSWARM, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous `Host` surface that
// `contract.ts` already describes — so the swarm, the loadout cards, the tier
// governor and the WebGL2 renderer are untouched.
//
// What crosses the boundary is the seal. A sealed card and a rift both carry a
// problem the host drew, and the host also reveals its canonical answer so the
// game can write it on one orb and the mal-rule distractors on the others —
// placing the answer, never judging it. The game reports which orb was struck
// and the host is the judge.
//
// `mount` lives in `./index.ts` and not in `./contract.ts`: the contract file
// carries a throwing stub on purpose, so the shape stays byte-identical across
// every game without anybody importing it by accident.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"

import type { Host } from "./contract.ts"
import { mount } from "./index.ts"

const root = document.getElementById("app")
if (!root) throw new Error("horde: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "arith" })
  // Stocked before the first frame: the first level-up can arrive within
  // seconds, and a sealed card with a blank face is the kind of thing that
  // happens exactly once, on launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context are torn down before the frame is, rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[horde] could not start", error)
  renderNoHost(root, "DEEPSWARM")
})
