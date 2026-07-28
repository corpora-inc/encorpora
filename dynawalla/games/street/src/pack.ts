// FOUNDRY STREET, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// stub, because the adapter presents the same synchronous `Host` surface
// `contract.ts` already describes — so the crowd, the breaker bar, the push and
// the crack are untouched.
//
// ## What crosses the boundary, and what does not
//
// **The shutter does.** It carries a problem the curriculum drew, four rivets
// carry the canonical answer and the host's mal-rule outputs, and the rivet the
// child strikes is reported as-is. The game never marks it: `items.reveal` is
// declared and is not optional, because without the canonical value there is no
// such thing as a plate that opens — but the *verdict* is the host's, and the
// value reported on a wrong strike is the mal-rule itself, so the misconception
// routes with no extra wiring.
//
// **The factoring does not.** Only the `add` domain has active rows, so the
// host serves whole-number column arithmetic no matter what a pack declares —
// and a mob of twelve coming apart into four ranks of three is not a question
// anybody asked. It is arithmetic the child performs with a gesture, the way
// slicing a composite is in THE SPLIT, and nothing about it is reported. What
// `covers.skills` claims is the shutter, and every id on it is an `active` row
// of `dw.add`.
//
// ## The sheet
//
// The host may put a sheet over a pack that is still mounted and still running,
// and the call most likely to raise one is this game's own `transition` on a
// finished block. `pause` and `resume` are wired here because the methods on
// the handle are inert unless this file subscribes — a clock left running
// behind a sheet would clear a wave nobody watched and would report the length
// of the sheet as the child's thinking time on a plate they never saw.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts"
import { mount } from "./contract.ts"
import type { Host } from "./contract.ts"

const root = document.getElementById("app")
if (!root) throw new Error("street: #app missing")

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" })
  // Stocked before the first frame: the plate comes down inside half a second
  // of launch, and a plate with a blank face is the kind of thing that happens
  // exactly once, in front of the child.
  await mounted.warm()

  const handle = mount(el, mounted.host as unknown as Host)

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context come down before the frame does rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount()
  })

  mounted.client.on("pause", () => {
    handle.pause()
  })
  mounted.client.on("resume", () => {
    handle.resume()
  })
}

void start(root).catch((error: unknown) => {
  console.error("[street] could not start", error)
  renderNoHost(root, "FOUNDRY STREET")
})
