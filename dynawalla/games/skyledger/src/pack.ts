// SKY LEDGER, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the sky, the astrolabe, the chain and
// the ledger are untouched.
//
// What crosses the boundary is the ledger line. A star carries a problem the
// curriculum drew, and the value the child asserts is
// `order × 100 + tens × 10 + ones` — the hundreds the register had already
// ruled in, plus the two digits they turned onto the astrolabe themselves.
// That is an exact integer the host can judge against its own canonical
// answer, and when it is wrong it is usually wrong in a way the host
// recognises, because a child who drops a carry turns the ring to the digit
// their own procedure produced.
//
// `items.reveal` is declared and is not optional. Without the canonical value
// there is no station: the sky would be a lattice of a hundred points with
// nothing standing at any of them, and every item would be dropped silently.
//
// Reading a number as a place on a plane is the game's own mathematics — a
// thing the child performs with a gesture rather than a question anybody asked
// — so nothing about the lattice itself is reported.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("skyledger: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })
  // Stocked before the first frame: a watch opens with four stars at once, and
  // a star with a blank plate is the kind of thing that happens exactly once,
  // on launch, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context come down before the frame does rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })

  // A transition can put a sheet over the frame, and the SDK documents that the
  // pack keeps running underneath it. SKY LEDGER calls `transition` at the end
  // of every watch the child logged stars in, so this is routine rather than
  // hypothetical — and unguarded it is the worst bug this game could have: the
  // sky keeps falling behind the sheet, lamps go out for a watch nobody could
  // see, and a touch landing behind it marks a station against a ledger line
  // the child never read.
  //
  // These two handlers are the whole subscription. `handle.pause()` is inert
  // until something calls it.
  mounted.client.on("pause", () => {
    handle.pause()
  })
  mounted.client.on("resume", () => {
    handle.resume()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[skyledger] could not start", error)
  renderNoHost(root, "SKY LEDGER")
})
