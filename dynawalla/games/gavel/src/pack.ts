// THE GAVEL, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the stub,
// because the adapter presents the same synchronous surface `Host` in
// `contract.ts` already describes — so the room, the paddle, the hammer and the
// consignment are untouched.
//
// **`items.reveal` is declared and is not optional.** A tablet is a rival's *bid*.
// Without the canonical value there is no bid: the room would be four expressions
// with no highest, which is not a question, and the child's `bid − 1` would be
// judged against nothing. A pack without the grant mounts, warms, and calls a
// gallery with no prices in it.
//
// **Why `items.skip` matters here more than anywhere.** A round puts three to five
// questions up and the child answers exactly one — the tablet they marked. The rest
// were read, compared and left. Reporting those as `{ correct: false, answered: ""
// }` would file four misses a round: the empty string does not parse, the learner
// model takes a wrong attempt each time, and the ladder walks *down* underneath a
// child who is doing fine. They are skipped, which is the third ending and the
// only one that is both honest and closed.
//
// Nothing about the *money* is reported. The profit is the game's own arithmetic —
// a thing the child performs with a gesture rather than a question anybody asked —
// and the host owns the mathematics.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("gavel: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "arith" })
  // Stocked before the first frame. A room is built from three to five questions at
  // once, so an empty pool on launch is not a dull moment — it is a gallery with no
  // bidders in it, in front of the child, exactly once.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context come down before the frame does rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })

  // A transition can put a sheet over the frame, and the SDK documents that the pack
  // keeps running underneath it. THE GAVEL calls `transition` at the end of every
  // consignment, so this is routine rather than hypothetical — and unguarded it is
  // the worst bug this game could have: a touch landing behind the sheet drops the
  // hammer, reports a bid on a room the child never saw, and adds two lots for it.
  mounted.client.on("pause", () => {
    handle.pause()
  })
  mounted.client.on("resume", () => {
    handle.resume()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[gavel] could not start", error)
  renderNoHost(root, "THE GAVEL")
})
