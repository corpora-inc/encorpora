// COLOSSUS, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the tower, the fist, the collapse and
// the growth penalty are untouched.
//
// What crosses the boundary is the keystone. A keystone carries a problem the
// curriculum drew; the slabs standing in the tower carry numbers, and the value
// the child asserts is the product of the slabs they were holding when they
// struck. That is a value the host can judge exactly — and because two of the
// slabs planted for every keystone carry its mal-rule outputs, a wrong strike
// usually reports the misconception itself rather than noise.
//
// `items.reveal` is declared and is not optional. Without the canonical value
// there is no tower to build: the answer is what the slabs are cut from. A pack
// without the grant would mount, warm, and stand up an empty building.
//
// Splitting 72 into 8 × 9 is the game's own mathematics — a thing the child
// performs with a gesture rather than a question anybody asked — so nothing
// about the factoring is reported.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("colossus: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })
  // Stocked before the first frame. A tower is built from six keystones at
  // once, so an empty pool on launch is not a dull moment — it is a building
  // with nothing in it, in front of the child, exactly once.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context come down before the frame does rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })

  // A transition can put a sheet over the frame, and the SDK documents that the
  // pack keeps running underneath it. COLOSSUS calls `transition` at the end of
  // every tower, so this is routine rather than hypothetical — and unguarded it
  // is the worst bug this game could have: a touch landing behind the sheet
  // strikes the fist, reports an answer to a keystone the child never saw, and
  // grows the tower they have to bring down.
  //
  // These handlers are the whole subscription. `handle.pause()` is inert until
  // something calls it.
  mounted.client.on("pause", () => {
    handle.pause()
  })
  mounted.client.on("resume", () => {
    handle.resume()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[colossus] could not start", error)
  renderNoHost(root, "COLOSSUS")
})
